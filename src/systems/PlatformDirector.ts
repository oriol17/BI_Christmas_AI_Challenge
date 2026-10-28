import type Phaser from 'phaser';
import type { BalanceConfig, PlatformPatternId } from '../config/balance';
import { DEPTH, LAYOUT } from '../config/layout';
import type { Player } from '../entities/Player';
import { TEXTURES } from '../graphics/textureKeys';
import { getDifficulty, getWorldSpeed } from '../logic/difficulty';
import {
  PLATFORM_PATTERN_CATALOG,
  isPatternValidForSpeeds,
  patternHasMdr,
  sectionLength,
  selectPlatformPattern,
  validatePlatformPattern,
  type PlatformMechanic,
  type PlatformPatternDefinition,
} from '../logic/PlatformPlanner';
import type { AntibioticType, PlatformLevel } from '../types/game';
import { randomRange, type RandomSource } from '../utils/random';
import type { SpawnDirector } from './SpawnDirector';
import type { ReservedSpan, TorpedoDirector } from './TorpedoDirector';

export interface PlatformEncounters {
  readonly hasEncounteredMdr: boolean;
  readonly hasEncounteredTorpedo: boolean;
}

type PlatformImage = Phaser.Types.Physics.Arcade.ImageWithStaticBody;

/** Generous section length used to estimate the speed range a section will be played at. */
const SPEED_ESTIMATE_LENGTH_PIXELS = 3000;
/** The development `?pattern=` preview starts almost immediately. */
const PREVIEW_START_METERS = 15;

/**
 * Spawns authored, simulator-validated platform sections. Each section reserves its own span of
 * the world: normal bacteria and random torpedoes stay out of it, and its shelves, threats,
 * rewards and torpedo share one coordinate system so they stay aligned at any speed.
 */
export class PlatformDirector {
  private readonly pool: PlatformImage[] = [];
  private readonly spans: { start: number; end: number; origin: number; pattern: PlatformPatternDefinition }[] = [];
  private readonly recentPatterns: PlatformPatternId[] = [];
  private readonly recentMechanics: PlatformMechanic[] = [];
  private nextSectionDistance: number;
  private lastPattern: PlatformPatternDefinition | null = null;
  private lastRouteIds: readonly string[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly player: Player,
    private readonly balance: BalanceConfig,
    private readonly rng: RandomSource,
    private readonly spawner: SpawnDirector,
    private readonly torpedoes: TorpedoDirector,
    private readonly forcedPatternId: PlatformPatternId | null = null,
  ) {
    this.nextSectionDistance = forcedPatternId ? PREVIEW_START_METERS : balance.platforms.unlockDistanceMeters;
    for (let index = 0; index < balance.platforms.maximumConcurrentPlatforms; index += 1) {
      const platform = scene.physics.add.staticImage(-1000, -1000, TEXTURES.environment.platform);
      platform.setDepth(DEPTH.platforms).setVisible(false).setActive(false);
      const body = platform.body;
      body.enable = false;
      // One-way shelves: land from above, jump up through them from below or the sides.
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;
      this.pool.push(platform);
    }

    scene.physics.add.collider(player.sprite, this.pool, (_player, gameObject) => {
      const level = (gameObject as Phaser.GameObjects.Image).getData('platformLevel') as PlatformLevel | undefined;
      if (level !== undefined) player.markPlatformLevel(level);
    });
  }

  get reservedSpans(): readonly ReservedSpan[] {
    return this.spans;
  }

  /** The section currently around Santa, or the most recently spawned one. */
  get activePatternId(): PlatformPatternId | null {
    return this.currentSection()?.pattern.id ?? this.lastPattern?.id ?? null;
  }

  get activeRouteDescription(): string {
    const pattern = this.currentSection()?.pattern ?? this.lastPattern;
    if (!pattern) return 'none (normal bacteria)';
    const valid = pattern.routes.filter((route) => this.lastRouteIds.includes(route.id));
    return (valid.length > 0 ? valid : pattern.routes).map((route) => route.id).join(' | ');
  }

  get activePlatformCount(): number {
    return this.pool.filter((platform) => platform.active).length;
  }

  update(
    deltaSeconds: number,
    worldSpeed: number,
    distanceMeters: number,
    readiness: Readonly<Record<AntibioticType, boolean>>,
    encounters: PlatformEncounters,
  ): void {
    const dx = worldSpeed * deltaSeconds;
    for (const platform of this.pool) {
      if (!platform.active) continue;
      platform.x -= dx;
      platform.refreshBody();
      if (platform.x + platform.displayWidth / 2 < LAYOUT.despawnX) {
        platform.setActive(false).setVisible(false);
        platform.body.enable = false;
      }
    }
    for (let index = this.spans.length - 1; index >= 0; index -= 1) {
      const span = this.spans[index]!;
      span.start -= dx;
      span.end -= dx;
      span.origin -= dx;
      if (span.end < LAYOUT.despawnX) this.spans.splice(index, 1);
    }

    const unlocked = this.forcedPatternId !== null || distanceMeters >= this.balance.platforms.unlockDistanceMeters;
    if (distanceMeters < this.nextSectionDistance || !unlocked) return;
    const pattern = this.choosePattern(distanceMeters, worldSpeed, encounters);
    if (!pattern) {
      // Nothing valid right now (e.g. Santa is still airborne): try again shortly.
      this.nextSectionDistance = distanceMeters + 4;
      return;
    }
    this.spawnSection(pattern, worldSpeed, distanceMeters, readiness);
  }

  private estimatedSpeedRange(distanceMeters: number, worldSpeed: number): { min: number; max: number } {
    const startX = this.spawner.previewSectionStart(worldSpeed);
    const aheadMeters = (startX + SPEED_ESTIMATE_LENGTH_PIXELS - LAYOUT.playerX) / this.balance.world.pixelsPerMeter;
    return { min: worldSpeed, max: Math.max(worldSpeed, getWorldSpeed(distanceMeters + aheadMeters, this.balance)) };
  }

  private choosePattern(
    distanceMeters: number,
    worldSpeed: number,
    encounters: PlatformEncounters,
  ): PlatformPatternDefinition | null {
    const speeds = this.estimatedSpeedRange(distanceMeters, worldSpeed);
    if (this.forcedPatternId) {
      const forced = PLATFORM_PATTERN_CATALOG[this.forcedPatternId];
      return this.player.currentPlatformLevel === forced.entryPlatformLevel &&
        isPatternValidForSpeeds(forced, this.balance, speeds.min, speeds.max)
        ? forced
        : null;
    }
    return selectPlatformPattern(
      {
        distanceMeters,
        worldSpeed: speeds.min,
        maximumWorldSpeed: speeds.max,
        currentPlatformLevel: this.player.currentPlatformLevel,
        recentPatternIds: this.recentPatterns,
        recentMechanics: this.recentMechanics,
        hasEncounteredMdr: encounters.hasEncounteredMdr,
        hasEncounteredTorpedo: encounters.hasEncounteredTorpedo,
      },
      this.balance,
      this.rng,
    );
  }

  private spawnSection(
    pattern: PlatformPatternDefinition,
    worldSpeed: number,
    distanceMeters: number,
    readiness: Readonly<Record<AntibioticType, boolean>>,
  ): void {
    const { platforms, mdr } = this.balance;
    const length = sectionLength(pattern);
    const startX = this.spawner.reserveSection(length, worldSpeed);
    const rise = platforms.levelRisePixels;

    for (const segment of pattern.platforms) {
      const platform = this.pool.find((candidate) => !candidate.active);
      if (!platform) break;
      platform
        .setPosition(startX + segment.left + segment.width / 2, LAYOUT.groundY - segment.level * rise + platforms.platformThicknessPixels / 2)
        .setDisplaySize(segment.width, platforms.platformThicknessPixels)
        .setActive(true)
        .setVisible(true)
        .setData('platformLevel', segment.level);
      platform.body.enable = true;
      platform.refreshBody();
    }

    const warningSeconds = Math.max(
      pattern.torpedoWarningTimingSeconds,
      getDifficulty(distanceMeters, this.balance).torpedoWarningSeconds,
    );
    for (const threat of pattern.threats) {
      if (threat.kind === 'torpedo') {
        this.torpedoes.queueSectionTorpedo(startX + threat.x, threat.lane, threat.level, warningSeconds);
      } else {
        this.spawner.spawnSectionThreat(threat, startX + threat.x, false);
      }
    }
    for (const reward of pattern.rewards) {
      if (reward.kind === 'cookie') {
        this.spawner.spawnSectionReward(reward, startX + reward.x, null);
        continue;
      }
      // Route antibiotics obey the same scarcity rules; when none is due, the route is just riskier.
      const antibiotic = this.spawner.claimRouteAntibiotic(distanceMeters, readiness);
      if (antibiotic) this.spawner.spawnSectionReward(reward, startX + reward.x, antibiotic);
    }
    if (patternHasMdr(pattern)) this.spawner.requirePlannerLeadingGap(mdr.clearanceSeconds);

    this.spans.push({
      start: startX - platforms.entryClearanceSeconds * worldSpeed,
      end: startX + length + platforms.exitClearanceSeconds * worldSpeed,
      origin: startX,
      pattern,
    });
    this.lastPattern = pattern;
    this.lastRouteIds = validatePlatformPattern(pattern, this.balance, [worldSpeed]).validRouteIds;
    this.recentPatterns.push(pattern.id);
    if (this.recentPatterns.length > 8) this.recentPatterns.shift();
    const primary = pattern.requiredMechanics[0];
    if (primary) {
      this.recentMechanics.push(primary);
      if (this.recentMechanics.length > 6) this.recentMechanics.shift();
    }
    const sectionEndMeters = (startX + length - LAYOUT.playerX) / this.balance.world.pixelsPerMeter;
    this.nextSectionDistance =
      distanceMeters +
      sectionEndMeters +
      randomRange(this.rng, platforms.sectionIntervalMinMeters, platforms.sectionIntervalMaxMeters);
  }

  private currentSection(): { pattern: PlatformPatternDefinition } | null {
    return this.spans.find((span) => span.start <= LAYOUT.playerX && span.end >= LAYOUT.playerX) ?? null;
  }
}

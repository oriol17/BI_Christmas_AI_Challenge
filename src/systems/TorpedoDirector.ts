import type Phaser from 'phaser';
import type { BalanceConfig } from '../config/balance';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, LAYOUT, TORPEDO_LANE_HEIGHT } from '../config/layout';
import { COLORS, CSS_COLORS } from '../config/theme';
import { VirusTorpedo } from '../entities/VirusTorpedo';
import type { Bacterium } from '../entities/Bacterium';
import { TEXTURES } from '../graphics/textureKeys';
import { getDifficulty, getMinimumReactionWindowSeconds, getTorpedoProbability } from '../logic/difficulty';
import { getSafeTorpedoLanes } from '../logic/torpedoRules';
import type { PlatformLevel, TorpedoLane } from '../types/game';
import { bodyText } from '../ui/textStyles';
import { lerp } from '../utils/math';
import { pickRandom, randomRange, type RandomSource } from '../utils/random';

export interface TorpedoDirectorEvents {
  readonly onWarning: (torpedo: VirusTorpedo) => void;
}

/** World spans (scrolling x ranges) reserved by platform sections. */
export interface ReservedSpan {
  readonly start: number;
  readonly end: number;
}

export interface TorpedoWorldContext {
  readonly reservedSpans: readonly ReservedSpan[];
  /** Planner items left of this x already exist, so their timing can be checked. */
  readonly plannedHorizonX: number;
}

const WARN_LABEL: Readonly<Record<TorpedoLane, string>> = {
  low: 'JUMP',
  mid: 'DUCK',
  high: 'STAY LOW',
};
const LEVEL_LABEL: Readonly<Record<PlatformLevel, string>> = { 0: 'FLOOR', 1: 'WALKWAY', 2: 'TOP SHELF' };

interface SectionTorpedo {
  impactX: number;
  readonly lane: TorpedoLane;
  readonly level: PlatformLevel;
  readonly warningSeconds: number;
}

interface WarningIndicator {
  readonly container: Phaser.GameObjects.Container;
  readonly text: Phaser.GameObjects.Text;
}

/** Separate pooled projectile system; torpedoes bypass antibiotic and invulnerability rules. */
export class TorpedoDirector {
  readonly torpedoes: Phaser.Physics.Arcade.Group;
  private elapsedSeconds = 0;
  private nextOpportunitySeconds: number;
  private firstTorpedoLaunched = false;
  private lastLaunchSeconds = Number.NEGATIVE_INFINITY;
  private readonly sectionTorpedoes: SectionTorpedo[] = [];
  private readonly indicators = new Map<VirusTorpedo, WarningIndicator>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly balance: BalanceConfig,
    private readonly rng: RandomSource,
    private readonly events: TorpedoDirectorEvents,
  ) {
    // Pool covers random torpedoes plus one authored section torpedo in flight.
    this.torpedoes = scene.physics.add.group({
      classType: VirusTorpedo,
      maxSize: balance.torpedoes.maximumActive + 1,
      runChildUpdate: false,
    });
    this.nextOpportunitySeconds = balance.torpedoes.firstOpportunityDelaySeconds;
  }

  update(
    deltaSeconds: number,
    worldSpeed: number,
    distanceMeters: number,
    activeBacteria: readonly Bacterium[],
    reducedMotion: boolean,
    world: TorpedoWorldContext,
  ): void {
    this.elapsedSeconds += deltaSeconds;
    const dx = worldSpeed * deltaSeconds;
    for (const torpedo of this.activeTorpedoes()) {
      torpedo.advance(deltaSeconds, worldSpeed);
      if (torpedo.x < LAYOUT.despawnX) torpedo.deactivate();
    }
    this.launchSectionTorpedoes(dx, worldSpeed);
    this.refreshIndicators(reducedMotion);

    if (distanceMeters < this.balance.torpedoes.unlockDistanceMeters) return;
    this.nextOpportunitySeconds -= deltaSeconds;
    if (this.nextOpportunitySeconds > 0) return;

    const difficulty = getDifficulty(distanceMeters, this.balance);
    const warningSeconds = difficulty.torpedoWarningSeconds;
    const reactionPixels = getMinimumReactionWindowSeconds(this.balance) * worldSpeed;
    const impactX = LAYOUT.playerX + worldSpeed * warningSeconds;
    const blockedBySection = world.reservedSpans.some(
      (span) => impactX + reactionPixels > span.start && impactX - reactionPixels < span.end,
    );
    const futureUnknown = world.plannedHorizonX < impactX + reactionPixels;
    const safeLanes = this.getSafeLanes(activeBacteria, worldSpeed, warningSeconds);
    if (
      blockedBySection ||
      futureUnknown ||
      safeLanes.length === 0 ||
      this.activeTorpedoes().length >= this.balance.torpedoes.maximumActive ||
      this.elapsedSeconds - this.lastLaunchSeconds < this.balance.torpedoes.minimumSeparationSeconds
    ) {
      this.nextOpportunitySeconds = 0.25;
      return;
    }

    const isFirst = !this.firstTorpedoLaunched;
    if (isFirst || this.rng() < getTorpedoProbability(distanceMeters, this.balance)) {
      this.launch(worldSpeed, 0, pickRandom(this.rng, safeLanes), warningSeconds);
    }
    const minimumInterval = this.balance.torpedoes.minimumOpportunityIntervalSeconds;
    const maximumInterval = lerp(this.balance.torpedoes.initialOpportunityIntervalSeconds, minimumInterval, difficulty.level);
    this.nextOpportunitySeconds = randomRange(this.rng, minimumInterval, maximumInterval);
  }

  activeTorpedoes(): VirusTorpedo[] {
    return this.torpedoes.getMatching('active', true) as VirusTorpedo[];
  }

  /** Authored section torpedo: it reaches Santa exactly when the given world x does. */
  queueSectionTorpedo(impactX: number, lane: TorpedoLane, level: PlatformLevel, warningSeconds: number): void {
    this.sectionTorpedoes.push({ impactX, lane, level, warningSeconds });
  }

  getDebugStatus(worldSpeed: number): string {
    const active = this.activeTorpedoes();
    if (active.length === 0) return this.sectionTorpedoes.length > 0 ? 'section torpedo queued' : 'none active';
    return active
      .map((torpedo) => `${torpedo.lane} L${torpedo.platformLevel} · ${torpedo.timeToImpact(worldSpeed).toFixed(1)}s`)
      .join(', ');
  }

  private launchSectionTorpedoes(dx: number, worldSpeed: number): void {
    for (let index = this.sectionTorpedoes.length - 1; index >= 0; index -= 1) {
      const queued = this.sectionTorpedoes[index]!;
      queued.impactX -= dx;
      const timeToImpact = (queued.impactX - LAYOUT.playerX) / worldSpeed;
      if (timeToImpact > queued.warningSeconds) continue;
      this.sectionTorpedoes.splice(index, 1);
      if (timeToImpact > 0) this.launch(worldSpeed, queued.level, queued.lane, timeToImpact);
    }
  }

  private getSafeLanes(activeBacteria: readonly Bacterium[], worldSpeed: number, impactSeconds: number): TorpedoLane[] {
    return getSafeTorpedoLanes(
      activeBacteria
        .filter((bacterium) => !bacterium.resolved && bacterium.x > LAYOUT.playerX)
        .map((bacterium) => ({ arrivalSeconds: (bacterium.x - LAYOUT.playerX) / worldSpeed, lane: bacterium.lane })),
      impactSeconds,
      getMinimumReactionWindowSeconds(this.balance),
    );
  }

  private launch(worldSpeed: number, level: PlatformLevel, lane: TorpedoLane, secondsToImpact: number): void {
    const torpedo = this.torpedoes.get(0, 0) as VirusTorpedo | null;
    // Pool exhaustion only happens if limits are misconfigured; skipping a launch is always safe.
    if (!torpedo) return;
    const speed = this.balance.torpedoes.speedPixelsPerSecond;
    const x = LAYOUT.playerX + (worldSpeed + speed) * secondsToImpact;
    const surface = LAYOUT.groundY - level * this.balance.platforms.levelRisePixels;
    const y = Math.max(70, Math.min(GAME_HEIGHT - 50, surface - TORPEDO_LANE_HEIGHT[lane]));
    torpedo.launch(lane, level, x, y, speed, this.balance.torpedoes.hitboxWidthPixels, this.balance.torpedoes.hitboxHeightPixels);
    torpedo.warningShown = true;
    this.firstTorpedoLaunched = true;
    this.lastLaunchSeconds = this.elapsedSeconds;
    this.events.onWarning(torpedo);
  }

  private refreshIndicators(reducedMotion: boolean): void {
    for (const child of this.torpedoes.getChildren()) {
      const torpedo = child as VirusTorpedo;
      const indicator = this.indicators.get(torpedo);
      // The edge warning covers the approach and disappears once the torpedo itself is on screen.
      if (!torpedo.active || torpedo.x < GAME_WIDTH - 20) {
        indicator?.container.setVisible(false);
        continue;
      }
      const shown = indicator ?? this.createIndicator(torpedo);
      const label = torpedo.platformLevel === 0
        ? `${WARN_LABEL[torpedo.lane]} · VIRUS`
        : `${LEVEL_LABEL[torpedo.platformLevel]} · ${WARN_LABEL[torpedo.lane]}`;
      if (shown.text.text !== label) shown.text.setText(label);
      const pulse = reducedMotion ? 1 : 0.7 + Math.abs(Math.sin(this.elapsedSeconds * 11)) * 0.3;
      shown.container.setPosition(GAME_WIDTH - 76, torpedo.y).setAlpha(pulse).setVisible(true);
    }
  }

  private createIndicator(torpedo: VirusTorpedo): WarningIndicator {
    const backing = this.scene.add.rectangle(0, 24, 160, 28, COLORS.labDeep, 0.92).setOrigin(0.5, 0);
    const icon = this.scene.add.image(0, 0, TEXTURES.hazards.virusTorpedo).setDisplaySize(58, 28);
    const text = this.scene.add.text(0, 24, '', bodyText(15, CSS_COLORS.white, { fontStyle: 'bold' })).setOrigin(0.5, 0);
    const container = this.scene.add
      .container(GAME_WIDTH - 76, torpedo.y, [backing, icon, text])
      .setDepth(DEPTH.warnings + 2)
      .setVisible(false);
    const indicator = { container, text };
    this.indicators.set(torpedo, indicator);
    return indicator;
  }
}

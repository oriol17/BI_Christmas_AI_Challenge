import type Phaser from 'phaser';
import type { BalanceConfig } from '../config/balance';
import { GAME_WIDTH, LAYOUT } from '../config/layout';
import { Bacterium } from '../entities/Bacterium';
import { Collectable, type CollectableKind } from '../entities/Collectable';
import type { PlannedPatternId, SpawnPlanner } from '../logic/SpawnPlanner';
import { getDifficulty } from '../logic/difficulty';
import type { IntensityPhase } from '../logic/IntensityWave';
import type { SectionReward, SectionThreat } from '../logic/routeSimulator';
import type { AntibioticType, BacteriumType, CollectableLane, HazardLane, PlatformLevel, Trajectory } from '../types/game';
import type { RandomSource } from '../utils/random';

export interface SpawnDirectorEvents {
  /** A bacterium scrolled into view (used for Grumpus throw animations). */
  readonly onBacteriumVisible: (bacterium: Bacterium) => void;
  /** An MDR bacterium was scheduled off-screen. */
  readonly onMdrScheduled: (isFirst: boolean) => void;
  /** The MDR warning has reached its configured reaction-time window. */
  readonly onMdrWarning: (isFirst: boolean) => void;
}

const MAX_BACTERIA = 40;
const MAX_COLLECTABLES = 40;

/**
 * Converts planner chunks (expressed in seconds) into pooled entities positioned off-screen.
 * Everything scrolls at the same world speed, so the planner's time gaps are preserved.
 * Platform sections reserve a span of the world; normal planning resumes only after it.
 */
export class SpawnDirector {
  readonly bacteria: Phaser.Physics.Arcade.Group;
  readonly collectables: Phaser.Physics.Arcade.Group;
  /** x position of the last scheduled planner item; it scrolls left with the world. */
  private frontierX: number = LAYOUT.spawnEdgeX;
  private mdrScheduled = 0;
  private runTimeSeconds = 0;
  private latestPatternId: PlannedPatternId = 'opening';

  constructor(
    scene: Phaser.Scene,
    private readonly planner: SpawnPlanner,
    private readonly balance: BalanceConfig,
    private readonly rng: RandomSource,
    private readonly events: SpawnDirectorEvents,
  ) {
    this.bacteria = scene.physics.add.group({ classType: Bacterium, maxSize: MAX_BACTERIA, runChildUpdate: false });
    this.collectables = scene.physics.add.group({ classType: Collectable, maxSize: MAX_COLLECTABLES, runChildUpdate: false });
  }

  update(
    deltaSeconds: number,
    worldSpeed: number,
    distanceMeters: number,
    readiness: Readonly<Record<AntibioticType, boolean>>,
    phase: IntensityPhase = 'active',
  ): void {
    const dx = worldSpeed * deltaSeconds;
    this.runTimeSeconds += deltaSeconds;
    const mdrWarningSeconds = getDifficulty(distanceMeters, this.balance).mdrWarningSeconds;
    this.frontierX -= dx;

    while (this.frontierX < LAYOUT.spawnEdgeX) {
      const chunk = this.planner.planChunk(distanceMeters, readiness, phase, this.runTimeSeconds);
      this.latestPatternId = chunk.patternId;
      const firstMdrInChunk = chunk.hasMdr && this.mdrScheduled === 0;
      for (const item of chunk.items) {
        const x = this.frontierX + item.time * worldSpeed;
        if (item.kind === 'bacterium') {
          this.spawnBacterium(item.bacterium, item.lane, item.trajectory, x, firstMdrInChunk);
        } else {
          this.spawnCollectable(item.kind, item.lane, x, item.kind === 'antibiotic' ? item.antibiotic : null);
        }
      }
      if (chunk.hasMdr) {
        this.mdrScheduled += 1;
        this.events.onMdrScheduled(this.mdrScheduled === 1);
      }
      this.frontierX += Math.max(chunk.duration, 0.1) * worldSpeed;
    }

    for (const bacterium of this.activeBacteria()) {
      bacterium.advance(dx, deltaSeconds);
      if (
        bacterium.bacteriumType === 'mdr' &&
        !bacterium.warningAnnounced &&
        bacterium.x > LAYOUT.playerX &&
        (bacterium.x - LAYOUT.playerX) / worldSpeed <= mdrWarningSeconds
      ) {
        bacterium.warningAnnounced = true;
        this.events.onMdrWarning(bacterium.firstMdr);
      }
      if (!bacterium.announced && bacterium.x < GAME_WIDTH + 10) {
        bacterium.announced = true;
        this.events.onBacteriumVisible(bacterium);
      }
      if (bacterium.x < LAYOUT.despawnX) bacterium.deactivate();
    }
    for (const collectable of this.activeCollectables()) {
      if (!collectable.collected) collectable.advance(dx, deltaSeconds);
      if (collectable.x < LAYOUT.despawnX) collectable.deactivate();
    }
  }

  activeBacteria(): Bacterium[] {
    return this.bacteria.getMatching('active', true) as Bacterium[];
  }

  activeCollectables(): Collectable[] {
    return this.collectables.getMatching('active', true) as Collectable[];
  }

  get activePatternId(): PlannedPatternId {
    return this.latestPatternId;
  }

  get antibioticCooldownSecondsRemaining(): number {
    return this.planner.antibioticCooldownSecondsRemaining;
  }

  /** Every planner item at or left of this x already exists in the world. */
  get plannedHorizonX(): number {
    return this.frontierX;
  }

  /** Where a section would start if reserved now (after all planned items plus the entry clearance). */
  previewSectionStart(worldSpeed: number): number {
    const { platforms } = this.balance;
    const entryGap = Math.max(platforms.entryClearanceSeconds, this.planner.pendingLeadingGapSeconds);
    return Math.max(LAYOUT.spawnEdgeX + platforms.sectionLeadPixels, this.frontierX + entryGap * worldSpeed);
  }

  /**
   * Reserves a stretch of the world for a platform section and returns its start x. The section
   * begins after every already-planned item plus the entry clearance (longer after an MDR), and
   * normal planning resumes only after the section plus the exit clearance.
   */
  reserveSection(lengthPixels: number, worldSpeed: number): number {
    const startX = this.previewSectionStart(worldSpeed);
    this.frontierX = startX + lengthPixels + this.balance.platforms.exitClearanceSeconds * worldSpeed;
    return startX;
  }

  /** After a section with MDR, the next planned chunk must keep the MDR clearance. */
  requirePlannerLeadingGap(seconds: number): void {
    this.planner.requireLeadingGap(seconds);
  }

  claimRouteAntibiotic(
    distanceMeters: number,
    readiness: Readonly<Record<AntibioticType, boolean>>,
  ): AntibioticType | null {
    return this.planner.claimRouteAntibiotic(distanceMeters, this.runTimeSeconds, readiness);
  }

  spawnSectionThreat(threat: Exclude<SectionThreat, { kind: 'torpedo' }>, worldX: number, firstMdr: boolean): void {
    this.spawnBacterium(threat.kind, threat.lane, 'straight', worldX, firstMdr, threat.level);
    if (threat.kind === 'mdr') {
      this.mdrScheduled += 1;
      this.events.onMdrScheduled(this.mdrScheduled === 1);
    }
  }

  get hasScheduledMdr(): boolean {
    return this.mdrScheduled > 0;
  }

  spawnSectionReward(reward: SectionReward, worldX: number, antibiotic: AntibioticType | null): void {
    this.spawnCollectable(reward.kind, reward.lane, worldX, antibiotic, reward.level);
  }

  private spawnBacterium(
    type: BacteriumType,
    lane: HazardLane,
    trajectory: Trajectory,
    x: number,
    firstMdrInChunk: boolean,
    platformLevel: PlatformLevel = 0,
  ): void {
    const bacterium = this.bacteria.get(x, 0) as Bacterium | null;
    if (!bacterium) return;
    bacterium.launch(
      type,
      lane,
      trajectory,
      x,
      this.rng() * Math.PI * 2,
      firstMdrInChunk,
      platformLevel,
      this.balance.platforms.levelRisePixels,
    );
  }

  private spawnCollectable(
    kind: CollectableKind,
    lane: CollectableLane,
    x: number,
    antibiotic: AntibioticType | null,
    platformLevel: PlatformLevel = 0,
  ): void {
    const collectable = this.collectables.get(x, 0) as Collectable | null;
    if (!collectable) return;
    collectable.launch(
      kind,
      lane,
      x,
      antibiotic,
      this.rng() * Math.PI * 2,
      platformLevel * this.balance.platforms.levelRisePixels,
    );
  }
}

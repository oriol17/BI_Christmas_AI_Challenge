import type Phaser from 'phaser';
import { GAME_WIDTH, LAYOUT } from '../config/layout';
import { Bacterium } from '../entities/Bacterium';
import { Collectable, type CollectableKind } from '../entities/Collectable';
import type { SpawnPlanner } from '../logic/SpawnPlanner';
import type { AntibioticType, BacteriumType, CollectableLane, HazardLane, Trajectory } from '../types/game';
import type { RandomSource } from '../utils/random';

export interface SpawnDirectorEvents {
  /** A bacterium scrolled into view (used for Grumpus throw animations). */
  readonly onBacteriumVisible: (bacterium: Bacterium) => void;
  /** An MDR bacterium was scheduled off-screen. */
  readonly onMdrScheduled: (isFirst: boolean) => void;
}

const MAX_BACTERIA = 40;
const MAX_COLLECTABLES = 40;

/**
 * Converts planner chunks (expressed in seconds) into pooled entities positioned off-screen.
 * Everything scrolls at the same world speed, so the planner's time gaps are preserved.
 */
export class SpawnDirector {
  readonly bacteria: Phaser.Physics.Arcade.Group;
  readonly collectables: Phaser.Physics.Arcade.Group;
  /** x position of the last scheduled hazard; it scrolls left with the world. */
  private frontierX: number = LAYOUT.spawnEdgeX;
  private mdrScheduled = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly planner: SpawnPlanner,
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
  ): void {
    const dx = worldSpeed * deltaSeconds;
    this.frontierX -= dx;

    while (this.frontierX < LAYOUT.spawnEdgeX) {
      const chunk = this.planner.planChunk(distanceMeters, readiness);
      for (const item of chunk.items) {
        const x = this.frontierX + item.time * worldSpeed;
        if (item.kind === 'bacterium') {
          this.spawnBacterium(item.bacterium, item.lane, item.trajectory, x);
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

  private spawnBacterium(type: BacteriumType, lane: HazardLane, trajectory: Trajectory, x: number): void {
    const bacterium = this.bacteria.get(x, 0) as Bacterium | null;
    if (!bacterium) return;
    bacterium.launch(type, lane, trajectory, x, this.rng() * Math.PI * 2);
  }

  private spawnCollectable(kind: CollectableKind, lane: CollectableLane, x: number, antibiotic: AntibioticType | null): void {
    const collectable = this.collectables.get(x, 0) as Collectable | null;
    if (!collectable) return;
    collectable.launch(kind, lane, x, antibiotic, this.rng() * Math.PI * 2);
  }
}

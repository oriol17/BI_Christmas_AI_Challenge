import type Phaser from 'phaser';
import { DEPTH, GAME_WIDTH, LAYOUT } from '../config/layout';
import { TEXTURES } from '../graphics/textureKeys';
import { nextCheckpointDistance } from '../logic/scoring';

/**
 * Places a decorative "Present Dispatch" station in the world so that Santa passes it
 * exactly when a delivery checkpoint is reached. Purely visual: deliveries are triggered
 * by RunState distance, not by collision.
 */
export class DeliveryMarkers {
  private readonly stations: Phaser.GameObjects.Image[] = [];
  private scheduledCheckpoint = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly intervalMeters: number,
    private readonly pixelsPerMeter: number,
  ) {}

  update(scrollPx: number, distanceMeters: number): void {
    for (const station of this.stations) {
      if (!station.visible) continue;
      station.x -= scrollPx;
      if (station.x < -station.width) station.setVisible(false);
    }

    const next = nextCheckpointDistance(distanceMeters, this.intervalMeters);
    if (next === this.scheduledCheckpoint) return;
    const x = LAYOUT.playerX + (next - distanceMeters) * this.pixelsPerMeter;
    if (x > GAME_WIDTH + 200) return;
    this.scheduledCheckpoint = next;
    const station = this.stations.find((candidate) => !candidate.visible) ?? this.createStation();
    station.setPosition(Math.max(x, GAME_WIDTH + 120), LAYOUT.groundY + 4).setVisible(true);
  }

  /** Position of the dispatch tube closest to Santa, for the "present flies in" effect. */
  nearestStationTop(): { x: number; y: number } | null {
    let best: Phaser.GameObjects.Image | null = null;
    for (const station of this.stations) {
      if (!station.visible) continue;
      if (!best || Math.abs(station.x - LAYOUT.playerX) < Math.abs(best.x - LAYOUT.playerX)) best = station;
    }
    return best ? { x: best.x - best.width / 2 + 52, y: best.y - best.height + 20 } : null;
  }

  private createStation(): Phaser.GameObjects.Image {
    const station = this.scene.add
      .image(0, 0, TEXTURES.environment.deliveryStation)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.deliveryStation);
    this.stations.push(station);
    return station;
  }
}

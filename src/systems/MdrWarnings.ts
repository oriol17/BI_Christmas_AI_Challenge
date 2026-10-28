import type Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, LAYOUT } from '../config/layout';
import { COLORS, CSS_COLORS } from '../config/theme';
import type { Bacterium } from '../entities/Bacterium';
import { TEXTURES } from '../graphics/textureKeys';
import { REQUIRED_ACTION } from '../logic/SpawnPlanner';
import type { PlatformLevel } from '../types/game';
import { displayText } from '../ui/textStyles';

interface Indicator {
  readonly container: Phaser.GameObjects.Container;
  readonly label: Phaser.GameObjects.Text;
}

const ACTION_LABEL = { jump: 'JUMP!', crouch: 'DUCK!', stay: 'STAY!' } as const;

/**
 * Off-screen warnings for incoming MDR bacteria: a flashing icon at the right edge at the
 * bacterium's height, a "JUMP!/DUCK!" hint and a red edge glow.
 */
export class MdrWarnings {
  private readonly indicators: Indicator[] = [];
  private readonly edgeGlow: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    this.edgeGlow = scene.add.graphics().setDepth(DEPTH.warnings).setVisible(false);
    for (let band = 0; band < 12; band += 1) {
      this.edgeGlow.fillStyle(COLORS.mdrDanger, 0.04 + band * 0.02);
      this.edgeGlow.fillRect(GAME_WIDTH - 12 * (12 - band), 0, 12, GAME_HEIGHT);
    }
  }

  update(
    bacteria: readonly Bacterium[],
    worldSpeed: number,
    warningSeconds: number,
    timeMs: number,
    reducedMotion: boolean,
    playerLevel: PlatformLevel = 0,
  ): void {
    const warningEdgeX = LAYOUT.playerX + worldSpeed * warningSeconds;
    const incoming = bacteria.filter(
      (b) => b.bacteriumType === 'mdr' && !b.resolved && b.x > LAYOUT.playerX && b.x <= warningEdgeX,
    );
    const blink = reducedMotion ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(timeMs / 120));

    this.edgeGlow.setVisible(incoming.length > 0).setAlpha(reducedMotion ? 0.6 : blink);
    incoming.forEach((bacterium, index) => {
      const indicator = this.indicators[index] ?? this.createIndicator();
      // The lane action only applies on the MDR's own level; from another level the advice is to stay put.
      const action = bacterium.platformLevel === playerLevel
        ? ACTION_LABEL[REQUIRED_ACTION[bacterium.lane]]
        : bacterium.platformLevel > playerLevel
          ? 'STAY LOW!'
          : 'STAY UP!';
      indicator.label.setText(action);
      indicator.container.setVisible(true).setPosition(GAME_WIDTH - 54, bacterium.y).setAlpha(blink);
    });
    for (let index = incoming.length; index < this.indicators.length; index += 1) {
      this.indicators[index]?.container.setVisible(false);
    }
  }

  private createIndicator(): Indicator {
    const icon = this.scene.add.image(0, 0, TEXTURES.ui.warning);
    const mdr = this.scene.add.text(0, 38, 'MDR', displayText(18, CSS_COLORS.mdr)).setOrigin(0.5, 0);
    const label = this.scene.add.text(-44, 0, 'JUMP!', displayText(24, CSS_COLORS.white)).setOrigin(1, 0.5);
    const container = this.scene.add.container(0, 0, [icon, mdr, label]).setDepth(DEPTH.warnings + 1);
    const indicator = { container, label };
    this.indicators.push(indicator);
    return indicator;
  }
}

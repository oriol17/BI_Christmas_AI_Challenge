import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/layout';
import { COLORS, CSS_COLORS } from '../config/theme';
import { ANIMATIONS, TEXTURES } from '../graphics/textureKeys';
import { getServices } from '../systems/services';
import { bodyText, displayText } from '../ui/textStyles';
import { onEscapeKey } from '../utils/escapeKey';
import { SCENES } from './sceneKeys';

type Speaker = 'Narrator' | 'Scientist Santa' | 'The Grumpus';

interface Beat {
  readonly speaker: Speaker;
  readonly text: string;
  readonly enter: () => void;
}

/** Interior stage is shifted up so characters stay clear of the dialogue panel. */
const INTERIOR_X = 1280;
const INTERIOR_WIDTH = 1920;
const STAGE_FLOOR_Y = 540;
const SANTA_X = INTERIOR_X + 300;
const GRUMPUS_X = INTERIOR_X + 1600;
const TYPE_SPEED_MS = 20;
const AUTO_ADVANCE_BASE_MS = 2600;

const SPEAKER_COLORS: Record<Speaker, string> = {
  Narrator: CSS_COLORS.cyanSoft,
  'Scientist Santa': CSS_COLORS.red,
  'The Grumpus': CSS_COLORS.mdr,
};

/**
 * Short in-engine cinematic built from the same procedural art as the game.
 * ENTER/SPACE/click advances, ESC (or the Skip button) jumps straight into the run.
 */
export class IntroScene extends Phaser.Scene {
  private beats: Beat[] = [];
  private beatIndex = -1;
  private typingEvent: Phaser.Time.TimerEvent | null = null;
  private autoAdvanceEvent: Phaser.Time.TimerEvent | null = null;
  private fullText = '';
  private speakerText!: Phaser.GameObjects.Text;
  private dialogueText!: Phaser.GameObjects.Text;
  private santa!: Phaser.GameObjects.Sprite;
  private grumpus!: Phaser.GameObjects.Container;
  private grumpusFigure!: Phaser.GameObjects.Image;
  private exteriorBuilding!: Phaser.GameObjects.Image;
  private leaving = false;

  constructor() {
    super(SCENES.intro);
  }

  create(): void {
    this.beatIndex = -1;
    this.leaving = false;
    this.typingEvent = null;
    this.autoAdvanceEvent = null;
    const camera = this.cameras.main;
    camera.setBounds(0, 0, INTERIOR_X + INTERIOR_WIDTH, GAME_HEIGHT);
    camera.setBackgroundColor(COLORS.night);
    camera.fadeIn(400, 7, 18, 42);

    this.buildExterior();
    this.buildInterior();
    this.buildDialogueUi();
    this.beats = this.createBeats();

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-ENTER', () => this.advance());
    keyboard?.on('keydown-SPACE', () => this.advance());
    onEscapeKey(this, () => this.startGame());
    keyboard?.on('keydown-S', () => this.startGame());
    this.input.on(Phaser.Input.Events.POINTER_UP, (_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.advance();
    });

    this.nextBeat();
  }

  private buildExterior(): void {
    this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, TEXTURES.environment.night).setOrigin(0);
    this.add.image(1040, 120, TEXTURES.environment.moon).setScale(1.2);
    // The building slowly "zooms" towards the viewer instead of zooming the camera, so the
    // fixed dialogue UI is never scaled or clipped.
    this.exteriorBuilding = this.add.image(GAME_WIDTH / 2, STAGE_FLOOR_Y + 6, TEXTURES.environment.building).setOrigin(0.5, 1);
    const snowGround = this.add.graphics();
    snowGround.fillStyle(0xeef5ff, 1);
    snowGround.fillRect(0, STAGE_FLOOR_Y, GAME_WIDTH, GAME_HEIGHT - STAGE_FLOOR_Y);
    const snow = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, TEXTURES.environment.snow).setOrigin(0);
    this.tweens.add({ targets: snow, tilePositionY: -400, tilePositionX: 80, duration: 10000, repeat: -1 });
  }

  private buildInterior(): void {
    const top = STAGE_FLOOR_Y - 600;
    const layers: [string, number][] = [
      [TEXTURES.environment.night, 0],
      [TEXTURES.environment.wall, 0],
      [TEXTURES.environment.equipment, 0xa9bbd0],
      [TEXTURES.environment.benches, 0xb7c7d8],
    ];
    for (const [key, tint] of layers) {
      const sprite = this.add.tileSprite(INTERIOR_X, top, INTERIOR_WIDTH, 600, key).setOrigin(0);
      if (tint) sprite.setTint(tint);
    }
    this.add.tileSprite(INTERIOR_X, STAGE_FLOOR_Y, INTERIOR_WIDTH, GAME_HEIGHT - STAGE_FLOOR_Y, TEXTURES.environment.floor).setOrigin(0);

    this.santa = this.add
      .sprite(INTERIOR_X - 80, STAGE_FLOOR_Y, TEXTURES.santa.run[0])
      .setOrigin(0.5, 1)
      .setScale(1.5)
      .setVisible(false);
    this.grumpusFigure = this.add.image(0, 58, TEXTURES.grumpus.idle).setOrigin(0.5, 1);
    this.grumpus = this.add
      .container(GRUMPUS_X, -200, [this.add.image(0, 70, TEXTURES.grumpus.platform), this.grumpusFigure])
      .setScale(1.4);
  }

  private buildDialogueUi(): void {
    const panelY = GAME_HEIGHT - 140;
    const panel = this.add.graphics().setScrollFactor(0).setDepth(100);
    panel.fillStyle(COLORS.labDeep, 0.92);
    panel.fillRoundedRect(40, panelY, GAME_WIDTH - 80, 124, 18);
    panel.lineStyle(3, COLORS.gold, 1);
    panel.strokeRoundedRect(40, panelY, GAME_WIDTH - 80, 124, 18);

    this.speakerText = this.add.text(70, panelY + 12, '', displayText(22, CSS_COLORS.gold)).setScrollFactor(0).setDepth(101);
    this.dialogueText = this.add
      .text(70, panelY + 46, '', bodyText(22, CSS_COLORS.white, { wordWrap: { width: GAME_WIDTH - 160 }, lineSpacing: 4 }))
      .setScrollFactor(0)
      .setDepth(101);
    this.add
      .text(GAME_WIDTH - 64, panelY + 104, 'ENTER / SPACE / click: next', bodyText(15, CSS_COLORS.grey))
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(101);

    const skip = this.add
      .text(GAME_WIDTH - 24, 24, 'Skip intro  [ESC]', bodyText(18, CSS_COLORS.ink, { fontStyle: 'bold', backgroundColor: CSS_COLORS.gold, padding: { x: 12, y: 6 } }))
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(101)
      .setInteractive({ useHandCursor: true });
    skip.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.startGame());
    skip.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => skip.setBackgroundColor(CSS_COLORS.white));
    skip.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => skip.setBackgroundColor(CSS_COLORS.gold));
  }

  private createBeats(): Beat[] {
    const camera = this.cameras.main;
    const interiorCenter = INTERIOR_X + GAME_WIDTH / 2;
    const grumpusCenter = INTERIOR_X + INTERIOR_WIDTH - GAME_WIDTH / 2;
    const bugPositions = {
      gramPositive: { x: INTERIOR_X + 880, y: STAGE_FLOOR_Y - 40 },
      gramNegative: { x: INTERIOR_X + 1080, y: STAGE_FLOOR_Y - 40 },
      mdr: { x: INTERIOR_X + 1280, y: STAGE_FLOOR_Y - 60 },
    };
    const bugs: Phaser.GameObjects.Container[] = [];

    return [
      {
        speaker: 'Narrator',
        text: 'It is Christmas Eve at the North Pole. Snow is falling, the sleigh is loaded… almost.',
        enter: () => {
          camera.setScroll(0, 0);
          this.tweens.add({ targets: this.exteriorBuilding, scale: 1.08, duration: 6000, ease: 'Sine.easeInOut' });
        },
      },
      {
        speaker: 'Narrator',
        text: 'Scientist Santa must still deliver the last presents, and tonight his route runs straight through the North Pole Pharma Labs.',
        enter: () => {
          this.transition(() => {
            camera.centerOn(interiorCenter, GAME_HEIGHT / 2);
            this.santa.setVisible(true).play(ANIMATIONS.santaRun);
            this.tweens.add({
              targets: this.santa,
              x: SANTA_X,
              duration: 1400,
              ease: 'Sine.easeOut',
              onComplete: () => {
                this.santa.anims.stop();
                this.santa.setTexture(TEXTURES.santa.run[0]);
              },
            });
          });
        },
      },
      {
        speaker: 'Scientist Santa',
        text: 'Ho ho ho! Lab coat on, presents packed… and one dose of each antibiotic, just in case!',
        enter: () => {
          this.popLabel(SANTA_X - 70, STAGE_FLOOR_Y - 230, TEXTURES.antibiotics.gramPositive, 'Gram+ antibiotic', CSS_COLORS.gramPositive);
          this.time.delayedCall(250, () =>
            this.popLabel(SANTA_X + 90, STAGE_FLOOR_Y - 230, TEXTURES.antibiotics.gramNegative, 'Gram− antibiotic', CSS_COLORS.gramNegative),
          );
        },
      },
      {
        speaker: 'The Grumpus',
        text: 'Not so fast, Santa! If I can’t stop Christmas with my cold heart, I’ll stop it with GERMS!',
        enter: () => {
          camera.pan(grumpusCenter, GAME_HEIGHT / 2, 1100, 'Sine.easeInOut');
          this.grumpusFigure.setTexture(TEXTURES.grumpus.warn);
          this.tweens.add({ targets: this.grumpus, y: 170, duration: 900, delay: 500, ease: 'Back.easeOut' });
          this.time.delayedCall(1300, () => camera.flash(250, 214, 40, 59));
        },
      },
      {
        speaker: 'The Grumpus',
        text: 'Gram-positive bacteria! Gram-negative bacteria! Fresh from my petri dishes!',
        enter: () => {
          this.grumpusFigure.setTexture(TEXTURES.grumpus.throw);
          (['gramPositive', 'gramNegative'] as const).forEach((type, index) => {
            const label = type === 'gramPositive' ? 'Gram-positive (+)' : 'Gram-negative (−)';
            const color = type === 'gramPositive' ? CSS_COLORS.gramPositive : CSS_COLORS.gramNegative;
            this.time.delayedCall(index * 450, () => bugs.push(this.throwBug(type, bugPositions[type], label, color, 1.4)));
          });
        },
      },
      {
        speaker: 'The Grumpus',
        text: 'And my masterpiece: a MULTIDRUG-RESISTANT superbug! No antibiotic can stop it. Mwa-ha-ha!',
        enter: () => {
          this.grumpusFigure.setTexture(TEXTURES.grumpus.warn);
          const mdr = this.throwBug('mdr', bugPositions.mdr, 'MDR superbug ⚠', CSS_COLORS.mdr, 1.5);
          bugs.push(mdr);
          const ring = this.add.image(bugPositions.mdr.x, bugPositions.mdr.y, TEXTURES.particles.ring).setTint(COLORS.mdrDanger).setAlpha(0);
          this.tweens.add({ targets: ring, alpha: 0.8, scale: 2.6, duration: 600, delay: 700, yoyo: true, repeat: -1 });
          this.time.delayedCall(700, () => camera.flash(200, 255, 59, 47));
        },
      },
      {
        speaker: 'Scientist Santa',
        text: 'My antibiotics handle Gram-positive and Gram-negative bacteria, one dose each. But nothing works on MDR… that one I must dodge!',
        enter: () => {
          camera.pan(interiorCenter + 120, GAME_HEIGHT / 2, 1000, 'Sine.easeInOut');
          this.showRulesCard();
        },
      },
      {
        speaker: 'Narrator',
        text: 'Jump, crouch, collect antibiotics and gingerbread cookies, and save Christmas!',
        enter: () => {
          const go = this.add
            .text(GAME_WIDTH / 2, 230, 'DELIVER THE PRESENTS!', displayText(52, CSS_COLORS.gold, { strokeThickness: 9 }))
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(90)
            .setScale(0.3);
          this.tweens.add({ targets: go, scale: 1, duration: 450, ease: 'Back.easeOut' });
          this.santa.play(ANIMATIONS.santaRun);
        },
      },
    ];
  }

  private nextBeat(): void {
    this.beatIndex += 1;
    const beat = this.beats[this.beatIndex];
    if (!beat) {
      this.startGame();
      return;
    }
    beat.enter();
    this.speakerText.setText(beat.speaker).setColor(SPEAKER_COLORS[beat.speaker]);
    this.typeText(beat.text);
  }

  private typeText(text: string): void {
    this.typingEvent?.remove();
    this.autoAdvanceEvent?.remove();
    this.fullText = text;
    this.dialogueText.setText('');
    let shown = 0;
    this.typingEvent = this.time.addEvent({
      delay: TYPE_SPEED_MS,
      repeat: text.length - 1,
      callback: () => {
        shown += 1;
        this.dialogueText.setText(text.slice(0, shown));
        if (shown >= text.length) this.onTypingComplete();
      },
    });
  }

  private onTypingComplete(): void {
    this.typingEvent = null;
    this.autoAdvanceEvent = this.time.delayedCall(AUTO_ADVANCE_BASE_MS + this.fullText.length * 25, () => this.advance());
  }

  private advance(): void {
    if (this.leaving) return;
    if (this.typingEvent) {
      this.typingEvent.remove();
      this.dialogueText.setText(this.fullText);
      this.onTypingComplete();
      return;
    }
    getServices(this).audio.play('ui-move');
    this.nextBeat();
  }

  private transition(midpoint: () => void): void {
    const camera = this.cameras.main;
    camera.fadeOut(300, 7, 18, 42);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      midpoint();
      camera.fadeIn(350, 7, 18, 42);
    });
  }

  private popLabel(x: number, y: number, texture: string, label: string, color: string): void {
    const icon = this.add.image(0, 0, texture).setScale(1.3);
    const text = this.add.text(0, 44, label, bodyText(18, color, { fontStyle: 'bold', stroke: CSS_COLORS.ink, strokeThickness: 4 })).setOrigin(0.5, 0);
    const container = this.add.container(x, y, [icon, text]).setScale(0);
    this.tweens.add({ targets: container, scale: 1, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: icon, y: -6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private throwBug(
    type: 'gramPositive' | 'gramNegative' | 'mdr',
    target: { x: number; y: number },
    label: string,
    color: string,
    scale: number,
  ): Phaser.GameObjects.Container {
    const image = this.add.image(0, 0, TEXTURES.bacteria[type]).setScale(scale);
    const text = this.add
      .text(0, 40 * scale, label, bodyText(18, color, { fontStyle: 'bold', stroke: CSS_COLORS.ink, strokeThickness: 4 }))
      .setOrigin(0.5, 0)
      .setAlpha(0);
    const startX = GRUMPUS_X - 60;
    const startY = 150;
    const container = this.add.container(startX, startY, [image, text]);
    this.tweens.add({ targets: container, x: target.x, duration: 700, ease: 'Linear' });
    this.tweens.add({
      targets: container,
      y: target.y,
      duration: 700,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.tweens.add({ targets: text, alpha: 1, duration: 200 });
        this.tweens.add({ targets: image, angle: type === 'mdr' ? 360 : 12, duration: type === 'mdr' ? 3000 : 600, yoyo: type !== 'mdr', repeat: -1 });
      },
    });
    return container;
  }

  private showRulesCard(): void {
    const x = GAME_WIDTH / 2 - 215;
    const y = 64;
    const card = this.add.container(x, y).setScrollFactor(0).setDepth(90).setAlpha(0);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.labDeep, 0.9);
    bg.fillRoundedRect(0, 0, 430, 196, 16);
    bg.lineStyle(3, COLORS.cyan, 1);
    bg.strokeRoundedRect(0, 0, 430, 196, 16);
    card.add(bg);
    const rows: [string, string, string, string][] = [
      [TEXTURES.bacteria.gramPositive, 'Gram+  →  Gram+ antibiotic', '✔', CSS_COLORS.green],
      [TEXTURES.bacteria.gramNegative, 'Gram−  →  Gram− antibiotic', '✔', CSS_COLORS.green],
      [TEXTURES.bacteria.mdr, 'MDR  →  nothing works. DODGE!', '✕', CSS_COLORS.red],
    ];
    rows.forEach(([texture, text, mark, color], index) => {
      const rowY = 38 + index * 60;
      card.add(this.add.image(46, rowY, texture).setScale(index === 2 ? 0.48 : 0.7));
      card.add(this.add.text(92, rowY, text, bodyText(19, CSS_COLORS.white, { fontStyle: 'bold' })).setOrigin(0, 0.5));
      card.add(this.add.text(404, rowY, mark, displayText(26, color)).setOrigin(0.5));
    });
    this.tweens.add({ targets: card, alpha: 1, duration: 300, delay: 600 });
  }

  private startGame(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.typingEvent?.remove();
    this.autoAdvanceEvent?.remove();
    getServices(this).audio.play('ui-select');
    const camera = this.cameras.main;
    camera.fadeOut(300, 7, 18, 42);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENES.game));
  }
}

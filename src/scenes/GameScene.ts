import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH, LAYOUT } from '../config/layout';
import { COLORS, CSS_COLORS } from '../config/theme';
import type { Bacterium } from '../entities/Bacterium';
import type { Collectable } from '../entities/Collectable';
import { GrumpusHeckler } from '../entities/GrumpusHeckler';
import { Player } from '../entities/Player';
import { TEXTURES } from '../graphics/textureKeys';
import { getWorldSpeed } from '../logic/difficulty';
import { RunState } from '../logic/RunState';
import { SpawnPlanner } from '../logic/SpawnPlanner';
import type { AntibioticType, DefeatCause } from '../types/game';
import { DeliveryMarkers } from '../systems/DeliveryMarkers';
import { Effects } from '../systems/Effects';
import { MdrWarnings } from '../systems/MdrWarnings';
import { ParallaxBackground } from '../systems/ParallaxBackground';
import { PlayerInput } from '../systems/PlayerInput';
import { getServices, type GameServices } from '../systems/services';
import { SpawnDirector } from '../systems/SpawnDirector';
import { Hud } from '../ui/Hud';
import { ToastManager } from '../ui/ToastManager';
import { onEscapeKey } from '../utils/escapeKey';
import { SCENES } from './sceneKeys';

export interface GameOverData {
  readonly cause: DefeatCause;
  readonly distanceMeters: number;
  readonly cookies: number;
  readonly presents: number;
  readonly score: number;
  readonly best: number;
  readonly isNewBest: boolean;
}

const ANTIBIOTIC_NAMES: Record<AntibioticType, string> = {
  gramPositive: 'Gram+',
  gramNegative: 'Gram−',
};
const ANTIBIOTIC_COLORS: Record<AntibioticType, number> = {
  gramPositive: COLORS.gramPositive,
  gramNegative: COLORS.gramNegative,
};
const DEFEAT_DELAY_MS = 1500;
const MAX_FRAME_MS = 50;

type HintId = 'jump' | 'crouch' | 'sky' | 'protected' | 'empty-slot' | 'first-pickup' | 'cookie';

/**
 * Orchestrates a run. Game rules live in RunState / SpawnPlanner (pure, tested); this scene
 * wires them to Phaser systems, entities, UI and audio.
 */
export class GameScene extends Phaser.Scene {
  private services!: GameServices;
  private run!: RunState;
  private player!: Player;
  private playerInput!: PlayerInput;
  private background!: ParallaxBackground;
  private director!: SpawnDirector;
  private grumpus!: GrumpusHeckler;
  private deliveries!: DeliveryMarkers;
  private effects!: Effects;
  private warnings!: MdrWarnings;
  private toasts!: ToastManager;
  private hud!: Hud;
  private status: 'running' | 'defeated' = 'running';
  private elapsedMs = 0;
  private shownHints = new Set<HintId>();

  constructor() {
    super(SCENES.game);
  }

  create(): void {
    this.services = getServices(this);
    const { balance, settings, audio, save } = this.services;
    this.status = 'running';
    this.elapsedMs = 0;
    this.shownHints = new Set();
    const rng = Math.random;

    this.physics.world.setBounds(0, -2000, GAME_WIDTH, LAYOUT.groundY + 2000);
    this.physics.world.setBoundsCollision(false, false, false, true);

    this.background = new ParallaxBackground(this);
    this.grumpus = new GrumpusHeckler(this, rng);
    this.deliveries = new DeliveryMarkers(this, balance.deliveries.intervalMeters, balance.world.pixelsPerMeter);
    this.run = new RunState(balance);
    this.player = new Player(this, LAYOUT.playerX, LAYOUT.groundY, balance);
    this.playerInput = new PlayerInput(this);
    this.director = new SpawnDirector(this, new SpawnPlanner(balance, rng), rng, {
      onBacteriumVisible: () => this.onBacteriumVisible(),
      onMdrScheduled: (isFirst) => this.onMdrScheduled(isFirst),
    });
    this.effects = new Effects(this, settings, balance);
    this.warnings = new MdrWarnings(this);
    this.toasts = new ToastManager(this);
    this.hud = new Hud(this, save.getBestScore(), () => this.toggleMute());

    this.physics.add.overlap(this.player.sprite, this.director.bacteria, (_player, bacterium) =>
      this.onBacteriumContact(bacterium as Bacterium),
    );
    this.physics.add.overlap(this.player.sprite, this.director.collectables, (_player, collectable) =>
      this.onCollectableContact(collectable as Collectable),
    );

    const keyboard = this.input.keyboard;
    onEscapeKey(this, () => this.openPause());
    keyboard?.on('keydown-P', () => this.openPause());
    keyboard?.on('keydown-M', () => this.toggleMute());

    // Auto-pause when the browser tab/window loses focus.
    const onBlur = (): void => this.openPause();
    const onResume = (): void => this.playerInput.reset();
    this.game.events.on(Phaser.Core.Events.BLUR, onBlur);
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, onBlur);
      this.events.off(Phaser.Scenes.Events.RESUME, onResume);
      this.toasts.clear();
    });

    this.cameras.main.fadeIn(350, 7, 18, 42);
    this.toasts.show('Deliver the presents! GO!', { large: true, color: CSS_COLORS.gold, accent: COLORS.gold, durationMs: 1600 });
    this.time.delayedCall(900, () => this.showHint('jump', 'Press SPACE or ↑ to jump over floor bacteria!'));
    audio.startMusic();
    this.refreshHud();
  }

  override update(_time: number, rawDeltaMs: number): void {
    const deltaMs = Math.min(rawDeltaMs, MAX_FRAME_MS);
    const deltaSeconds = deltaMs / 1000;
    this.elapsedMs += deltaMs;

    if (this.status === 'defeated') {
      this.player.update(deltaMs, { jumpPressed: false, jumpHeld: false, crouchHeld: false });
      return;
    }

    const { balance, audio, settings } = this.services;
    const worldSpeed = getWorldSpeed(this.run.distanceMeters, balance);
    const scrollPx = worldSpeed * deltaSeconds;

    const playerEvents = this.player.update(deltaMs, this.playerInput.read());
    if (playerEvents.jumped) audio.play('jump');
    if (playerEvents.crouchStarted) audio.play('crouch');

    const { deliveries } = this.run.advance(scrollPx / balance.world.pixelsPerMeter);
    for (let index = 0; index < deliveries; index += 1) this.celebrateDelivery();

    this.background.update(scrollPx, deltaSeconds);
    this.deliveries.update(scrollPx, this.run.distanceMeters);
    this.director.update(deltaSeconds, worldSpeed, this.run.distanceMeters, this.run.inventory.readiness());
    this.grumpus.update(deltaMs);
    this.warnings.update(this.director.activeBacteria(), this.elapsedMs, settings.reducedMotion);
    this.updateProgressHints();
    this.refreshHud();
  }

  private refreshHud(): void {
    this.hud.update({
      score: this.run.score,
      distanceMeters: this.run.distanceMeters,
      cookies: this.run.cookies,
      presents: this.run.presents,
      readiness: this.run.inventory.readiness(),
      muted: this.services.settings.muted,
    });
  }

  private onBacteriumContact(bacterium: Bacterium): void {
    if (this.status !== 'running' || bacterium.resolved) return;
    const outcome = this.run.resolveContact(bacterium.bacteriumType, this.player.isInvulnerable);

    switch (outcome.kind) {
      case 'ignored':
        // Harmless pass-through during post-protection invulnerability.
        bacterium.resolved = true;
        bacterium.setAlpha(0.5);
        return;
      case 'protected': {
        const { balance, audio } = this.services;
        const type = outcome.antibiotic;
        const color = ANTIBIOTIC_COLORS[type];
        bacterium.neutralise(() => bacterium.deactivate());
        this.player.grantInvulnerability(balance.collision.invulnerabilityMs);
        this.player.flashProtected();
        this.effects.sparkBurst(bacterium.x, bacterium.y, color, 18);
        this.effects.ring(bacterium.x, bacterium.y, COLORS.cyanSoft);
        this.effects.floatText(LAYOUT.playerX, LAYOUT.groundY - 140, `${ANTIBIOTIC_NAMES[type]} antibiotic used!`, CSS_COLORS.cyanSoft, 22);
        this.effects.shake(0.6);
        this.hud.flashSlot(type, COLORS.white);
        audio.play('protected');
        this.showHint('protected', `Protected! Your ${ANTIBIOTIC_NAMES[type]} slot is now EMPTY. Look for a refill.`);
        return;
      }
      case 'defeated':
        bacterium.resolved = true;
        this.handleDefeat(outcome.cause);
        return;
    }
  }

  private onCollectableContact(collectable: Collectable): void {
    if (this.status !== 'running' || collectable.collected) return;
    const { audio } = this.services;

    if (collectable.kind === 'cookie') {
      const points = this.run.collectCookie();
      this.effects.cookieBurst(collectable.x, collectable.y);
      this.effects.floatText(collectable.x, collectable.y - 30, `+${points}`, CSS_COLORS.gold);
      audio.play('cookie');
      collectable.collect(null, () => collectable.deactivate());
      this.showHint('cookie', 'Gingerbread cookie! +100 points.');
      return;
    }

    const type = collectable.antibiotic;
    if (!type) return;
    if (this.run.collectAntibiotic(type) === 'restocked') {
      this.effects.sparkBurst(collectable.x, collectable.y, COLORS.ready, 12);
      this.effects.floatText(collectable.x, collectable.y - 34, `${ANTIBIOTIC_NAMES[type]} READY!`, CSS_COLORS.green);
      audio.play('antibiotic-pickup');
      collectable.collect(this.hud.slotPosition(type), () => {
        collectable.deactivate();
        this.hud.flashSlot(type, COLORS.ready);
      });
      return;
    }

    // Full slot: the pickup stays in the world (dimmed) with a one-time hint.
    if (!collectable.hintShown) {
      collectable.hintShown = true;
      collectable.setAlpha(0.45);
      this.effects.floatText(collectable.x, collectable.y - 34, 'Already stocked', CSS_COLORS.grey, 18);
      audio.play('already-stocked');
    }
  }

  private onBacteriumVisible(): void {
    if (this.grumpus.throwBacterium()) this.services.audio.play('grumpus-throw');
  }

  private onMdrScheduled(isFirst: boolean): void {
    this.grumpus.warnMdr(isFirst);
    this.services.audio.play('mdr-warning');
    if (isFirst) {
      this.toasts.show('⚠ MULTIDRUG-RESISTANT SUPERBUG!', { large: true, color: CSS_COLORS.mdrDanger, accent: COLORS.mdrDanger, durationMs: 3200 });
      this.toasts.show('No antibiotic works on MDR. Watch the red warning and DODGE it!', {
        color: CSS_COLORS.white,
        accent: COLORS.mdrDanger,
        durationMs: 3600,
      });
      this.effects.flash(COLORS.mdrDanger, 0.18);
    } else {
      this.toasts.show('⚠ MDR superbug incoming!', { color: CSS_COLORS.mdrDanger, accent: COLORS.mdrDanger, durationMs: 1600 });
    }
  }

  private celebrateDelivery(): void {
    const { audio, balance } = this.services;
    audio.play('delivery');
    this.toasts.show(`🎁 Present delivered! +${balance.deliveries.score}`, { color: CSS_COLORS.gold, accent: COLORS.gold, durationMs: 2000 });
    const target = this.deliveries.nearestStationTop() ?? { x: LAYOUT.playerX + 80, y: LAYOUT.groundY - 200 };
    const gift = this.add.image(LAYOUT.playerX, LAYOUT.groundY - 70, TEXTURES.present).setDepth(DEPTH.effects);
    this.tweens.add({
      targets: gift,
      x: target.x,
      y: target.y,
      scale: 0.6,
      angle: 360,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.effects.confettiBurst(target.x, target.y, 46);
        gift.destroy();
      },
    });
    this.effects.sparkBurst(LAYOUT.playerX, LAYOUT.groundY - 80, COLORS.gold, 16);
    if (this.grumpus.isVisible) this.grumpus.say('Grrr! Another present?!', 1400);
  }

  private handleDefeat(cause: DefeatCause): void {
    const { audio, save } = this.services;
    this.status = 'defeated';
    this.player.defeat();
    this.effects.flash(COLORS.mdrDanger, 0.3);
    this.effects.shake(1.6);
    audio.stopMusic();
    audio.play('defeat');
    if (this.grumpus.isVisible) this.grumpus.say('Mwa-ha-ha!', 1400);

    const { best, isNewBest } = save.submitScore(this.run.score);
    const data: GameOverData = {
      cause,
      distanceMeters: this.run.distanceMeters,
      cookies: this.run.cookies,
      presents: this.run.presents,
      score: this.run.score,
      best,
      isNewBest,
    };
    this.time.delayedCall(DEFEAT_DELAY_MS, () => {
      this.cameras.main.fadeOut(350, 7, 18, 42);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENES.gameOver, data));
    });
  }

  private openPause(): void {
    if (this.status !== 'running' || !this.scene.isActive()) return;
    this.services.audio.play('pause');
    this.scene.launch(SCENES.pause);
    this.scene.pause();
  }

  private toggleMute(): void {
    const muted = this.services.audio.toggleMute();
    this.toasts.show(muted ? 'Sound off' : 'Sound on', { durationMs: 900 });
    this.refreshHud();
  }

  private showHint(id: HintId, message: string): void {
    if (this.shownHints.has(id) || this.status !== 'running') return;
    this.shownHints.add(id);
    this.toasts.show(message, { color: CSS_COLORS.cyanSoft, accent: COLORS.cyan, durationMs: 3000 });
  }

  private updateProgressHints(): void {
    const { unlocks } = this.services.balance.spawning;
    const distance = this.run.distanceMeters;
    if (distance >= unlocks.highLane - 25) this.showHint('crouch', 'Hold ↓ to duck under bacteria flying at head height!');
    if (distance >= unlocks.skyLane - 25) this.showHint('sky', 'Bacteria flying high? Just keep running, don’t jump!');
    const readiness = this.run.inventory.readiness();
    if ((!readiness.gramPositive || !readiness.gramNegative) && this.shownHints.has('protected')) {
      this.showHint('empty-slot', 'With an EMPTY slot, that bacterium type is dangerous. Dodge it!');
    }
    const visiblePickup = this.director
      .activeCollectables()
      .some((item) => item.kind === 'antibiotic' && item.x < GAME_WIDTH - 40 && !item.collected);
    if (visiblePickup) this.showHint('first-pickup', 'Antibiotic pickup ahead! It refills an EMPTY slot.');
  }
}

import Phaser from 'phaser';
import type { BalanceConfig, PlatformPatternId } from '../config/balance';
import { DEPTH, GAME_WIDTH, LAYOUT } from '../config/layout';
import { COLORS, CSS_COLORS } from '../config/theme';
import type { Bacterium } from '../entities/Bacterium';
import type { Collectable } from '../entities/Collectable';
import type { VirusTorpedo } from '../entities/VirusTorpedo';
import { GrumpusHeckler } from '../entities/GrumpusHeckler';
import { Player } from '../entities/Player';
import { TEXTURES } from '../graphics/textureKeys';
import { getDifficulty, getWorldSpeed } from '../logic/difficulty';
import { IntensityWave, type IntensityPhase } from '../logic/IntensityWave';
import { PLATFORM_PATTERN_CATALOG } from '../logic/platformPatterns';
import { RunState } from '../logic/RunState';
import { SpawnPlanner } from '../logic/SpawnPlanner';
import type { AntibioticType, DefeatCause } from '../types/game';
import { DeliveryMarkers } from '../systems/DeliveryMarkers';
import { Effects } from '../systems/Effects';
import { MdrWarnings } from '../systems/MdrWarnings';
import { ParallaxBackground } from '../systems/ParallaxBackground';
import { PlayerInput } from '../systems/PlayerInput';
import { PlatformDirector } from '../systems/PlatformDirector';
import { getServices, type GameServices } from '../systems/services';
import { SpawnDirector } from '../systems/SpawnDirector';
import { TorpedoDirector } from '../systems/TorpedoDirector';
import { Hud } from '../ui/Hud';
import { ToastManager } from '../ui/ToastManager';
import { bodyText } from '../ui/textStyles';
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

/** Development-only `?pattern=ID` forces one platform section for playtesting. */
function readDevPatternPreview(): PlatformPatternId | null {
  if (!import.meta.env.DEV) return null;
  const requested = new URLSearchParams(window.location.search).get('pattern');
  return requested && requested in PLATFORM_PATTERN_CATALOG ? (requested as PlatformPatternId) : null;
}

type HintId =
  | 'jump'
  | 'crouch'
  | 'sky'
  | 'protected'
  | 'empty-slot'
  | 'first-pickup'
  | 'cookie'
  | 'platform'
  | 'fast-fall'
  | 'torpedo';

/**
 * Orchestrates a run. Game rules live in RunState / SpawnPlanner (pure, tested); this scene
 * wires them to Phaser systems, entities, UI and audio.
 */
export class GameScene extends Phaser.Scene {
  private services!: GameServices;
  private balance!: BalanceConfig;
  private intensity!: IntensityWave;
  private intensityPhase: IntensityPhase = 'preparation';
  private run!: RunState;
  private player!: Player;
  private playerInput!: PlayerInput;
  private background!: ParallaxBackground;
  private director!: SpawnDirector;
  private platforms!: PlatformDirector;
  private torpedoes!: TorpedoDirector;
  private grumpus!: GrumpusHeckler;
  private deliveries!: DeliveryMarkers;
  private effects!: Effects;
  private warnings!: MdrWarnings;
  private toasts!: ToastManager;
  private hud!: Hud;
  private status: 'running' | 'defeated' = 'running';
  private elapsedMs = 0;
  private shownHints = new Set<HintId>();
  private hintsEnabled = true;
  private hasEncounteredMdr = false;
  private hasEncounteredTorpedo = false;
  private debugText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SCENES.game);
  }

  create(): void {
    this.services = getServices(this);
    const { settings, audio, save } = this.services;
    const balance = this.services.getBalance();
    this.balance = balance;
    this.status = 'running';
    this.elapsedMs = 0;
    this.shownHints = new Set();
    this.hintsEnabled = settings.hintsEnabled;
    this.hasEncounteredMdr = false;
    this.hasEncounteredTorpedo = false;
    this.debugText = null;
    const rng = Math.random;
    this.intensity = new IntensityWave(balance, rng);
    this.intensityPhase = this.intensity.phase;

    this.physics.world.setBounds(0, -2000, GAME_WIDTH, LAYOUT.groundY + 2000);
    this.physics.world.setBoundsCollision(false, false, false, true);

    this.background = new ParallaxBackground(this);
    this.grumpus = new GrumpusHeckler(this, rng);
    this.deliveries = new DeliveryMarkers(this, balance.deliveries.intervalMeters, balance.world.pixelsPerMeter);
    this.run = new RunState(balance);
    this.player = new Player(this, LAYOUT.playerX, LAYOUT.groundY, balance);
    this.playerInput = new PlayerInput(this);
    this.director = new SpawnDirector(this, new SpawnPlanner(balance, rng), balance, rng, {
      onBacteriumVisible: () => this.onBacteriumVisible(),
      onMdrScheduled: (isFirst) => this.onMdrScheduled(isFirst),
      onMdrWarning: (isFirst) => this.onMdrWarning(isFirst),
    });
    this.torpedoes = new TorpedoDirector(this, balance, rng, {
      onWarning: () => this.onTorpedoWarning(),
    });
    this.platforms = new PlatformDirector(
      this,
      this.player,
      balance,
      rng,
      this.director,
      this.torpedoes,
      readDevPatternPreview(),
    );
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
    this.physics.add.overlap(this.player.sprite, this.torpedoes.torpedoes, (_player, torpedo) =>
      this.onTorpedoContact(torpedo as VirusTorpedo),
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
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug')) {
      this.debugText = this.add
        .text(16, 116, '', {
          ...bodyText(13, CSS_COLORS.white),
          backgroundColor: 'rgba(5, 14, 30, 0.88)',
          padding: { x: 8, y: 6 },
        })
        .setDepth(DEPTH.hud + 1)
        .setScrollFactor(0);
    }
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

    const { audio, settings } = this.services;
    const balance = this.balance;
    const worldSpeed = getWorldSpeed(this.run.distanceMeters, balance);
    const scrollPx = worldSpeed * deltaSeconds;
    for (const transition of this.intensity.advance(deltaSeconds)) {
      this.intensityPhase = transition.to;
      this.onIntensityTransition(transition.to, transition.wave);
    }

    const intent = this.playerInput.read();
    if (intent.hintsTogglePressed) {
      this.hintsEnabled = !this.hintsEnabled;
      this.services.settings.setHintsEnabled(this.hintsEnabled);
      this.toasts.show(`Gameplay hints ${this.hintsEnabled ? 'on' : 'off'} (saved)`, { durationMs: 1000 });
    }
    const playerEvents = this.player.update(deltaMs, intent);
    if (this.player.isFastFalling) {
      this.showHint('fast-fall', 'Aerial tuck! Hold ↓ in the air to fast-fall onto a lower route.');
    }
    if (playerEvents.jumped) audio.play('jump');
    if (playerEvents.crouchStarted) audio.play('crouch');

    const { deliveries } = this.run.advance(scrollPx / balance.world.pixelsPerMeter);
    for (let index = 0; index < deliveries; index += 1) this.celebrateDelivery();

    this.background.update(scrollPx, deltaSeconds);
    this.deliveries.update(scrollPx, this.run.distanceMeters);
    this.director.update(
      deltaSeconds,
      worldSpeed,
      this.run.distanceMeters,
      this.run.inventory.readiness(),
      this.intensityPhase,
    );
    this.platforms.update(
      deltaSeconds,
      worldSpeed,
      this.run.distanceMeters,
      this.run.inventory.readiness(),
      { hasEncounteredMdr: this.hasEncounteredMdr, hasEncounteredTorpedo: this.hasEncounteredTorpedo },
    );
    this.torpedoes.update(
      deltaSeconds,
      worldSpeed,
      this.run.distanceMeters,
      this.director.activeBacteria(),
      settings.reducedMotion,
      { reservedSpans: this.platforms.reservedSpans, plannedHorizonX: this.director.plannedHorizonX },
    );
    this.grumpus.update(deltaMs);
    this.warnings.update(
      this.director.activeBacteria(),
      worldSpeed,
      getDifficulty(this.run.distanceMeters, balance).mdrWarningSeconds,
      this.elapsedMs,
      settings.reducedMotion,
      this.player.currentPlatformLevel,
    );
    this.updateProgressHints();
    this.refreshHud();
    this.refreshDebug();
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
        const { audio } = this.services;
        const balance = this.balance;
        const type = outcome.antibiotic;
        const color = ANTIBIOTIC_COLORS[type];
        bacterium.neutralise(() => bacterium.deactivate());
        this.player.grantInvulnerability(balance.collision.invulnerabilityMs);
        this.player.stumble(balance.collision.protectedRecoveryMs);
        this.effects.sparkBurst(bacterium.x, bacterium.y, color, 18);
        this.effects.ring(bacterium.x, bacterium.y, COLORS.mdrDanger);
        this.effects.floatText(
          LAYOUT.playerX,
          LAYOUT.groundY - 140,
          `${ANTIBIOTIC_NAMES[type]} dose used · −${balance.collision.protectedCollisionPenalty} PTS`,
          CSS_COLORS.mdrDanger,
          21,
        );
        this.effects.shake(1.25);
        this.effects.flash(COLORS.mdrDanger, 0.2);
        this.hud.flashSlot(type, COLORS.mdrDanger);
        audio.play('stumble');
        this.showHint('protected', `Antibiotic saved you, but cost ${balance.collision.protectedCollisionPenalty} points. Dodge when you can.`);
        return;
      }
      case 'defeated':
        bacterium.resolved = true;
        this.handleDefeat(outcome.cause);
        return;
    }
  }

  private onTorpedoContact(torpedo: VirusTorpedo): void {
    if (this.status !== 'running' || torpedo.resolved) return;
    torpedo.resolved = true;
    torpedo.deactivate();
    const outcome = this.run.resolveTorpedoContact();
    if (outcome.kind === 'defeated') {
      this.services.audio.play('torpedo-impact');
      this.handleDefeat(outcome.cause);
    }
  }

  private onTorpedoWarning(): void {
    const first = !this.hasEncounteredTorpedo;
    this.hasEncounteredTorpedo = true;
    this.services.audio.play('torpedo-warning');
    this.grumpus.warnTorpedo();
    this.toasts.show(first ? '⚠ VIRUS TORPEDO! ALWAYS LETHAL — DODGE!' : '⚠ VIRUS TORPEDO INCOMING!', {
      color: CSS_COLORS.white,
      accent: COLORS.mdrDanger,
      durationMs: first ? 2400 : 1500,
    });
    if (first) this.showHint('torpedo', 'Antibiotics do not work on virus torpedoes. Follow the level warning and dodge!');
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
      this.effects.floatText(collectable.x, collectable.y - 34, `RARE ${ANTIBIOTIC_NAMES[type]} DOSE!`, CSS_COLORS.green);
      this.effects.ring(collectable.x, collectable.y, COLORS.ready);
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
  }

  private onMdrWarning(isFirst: boolean): void {
    this.hasEncounteredMdr = true;
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

  private onIntensityTransition(phase: IntensityPhase, wave: number): void {
    if (phase === 'surge') {
      this.toasts.show(`⚡ WAVE ${wave}: INTENSITY SURGE!`, {
        large: true,
        color: CSS_COLORS.gold,
        accent: COLORS.gold,
        durationMs: 1400,
      });
    } else if (phase === 'breathing') {
      this.toasts.show('Brief breathing window — prepare for the next wave.', {
        color: CSS_COLORS.cyanSoft,
        accent: COLORS.cyan,
        durationMs: 1100,
      });
    }
  }

  private celebrateDelivery(): void {
    const { audio } = this.services;
    const balance = this.balance;
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
    if (!this.hintsEnabled || this.shownHints.has(id) || this.status !== 'running') return;
    this.shownHints.add(id);
    this.toasts.show(message, { color: CSS_COLORS.cyanSoft, accent: COLORS.cyan, durationMs: 3000 });
  }

  private updateProgressHints(): void {
    const { unlocks } = this.balance.spawning;
    const distance = this.run.distanceMeters;
    if (this.platforms.activePlatformCount > 0) {
      this.showHint('platform', 'Lab walkways ahead! HOLD jump to reach a shelf; hold ↓ in the air to fast-fall back down.');
    }
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

  private refreshDebug(): void {
    if (!this.debugText) return;
    const difficulty = getDifficulty(this.run.distanceMeters, this.balance);
    const mdr = this.director.activeBacteria().find(
      (bacterium) => bacterium.bacteriumType === 'mdr' && !bacterium.resolved && bacterium.x > LAYOUT.playerX,
    );
    const mdrStatus = mdr
      ? `${mdr.lane} · ${((mdr.x - LAYOUT.playerX) / difficulty.worldSpeed).toFixed(1)}s`
      : 'none active';
    this.debugText.setText([
      `Mode ${this.services.settings.difficultyMode} · difficulty ${(difficulty.level * 100).toFixed(0)}% · speed ${difficulty.worldSpeed.toFixed(0)} px/s`,
      `Template ${this.platforms.activePatternId ?? 'none'} · platform L${this.player.currentPlatformLevel} · shelves ${this.platforms.activePlatformCount} · pattern ${this.director.activePatternId}`,
      `Valid route ${this.platforms.activeRouteDescription}`,
      `Bacteria interval ${difficulty.spawnIntervalSeconds.toFixed(2)}s · antibiotic cooldown ${this.director.antibioticCooldownSecondsRemaining.toFixed(1)}s`,
      `MDR ${Math.round(difficulty.mdrProbability * 100)}% · torpedo ${Math.round(difficulty.torpedoProbability * 100)}%`,
      `Warnings: MDR ${mdrStatus} · torpedo ${this.torpedoes.getDebugStatus(difficulty.worldSpeed)}`,
      `Torpedo ${this.balance.torpedoes.speedPixelsPerSecond} px/s · warning ${difficulty.torpedoWarningSeconds.toFixed(2)}s`,
      `Wave ${this.intensityPhase} · fast-fall ${this.player.isFastFalling ? 'active' : 'off'}`,
    ]);
  }
}

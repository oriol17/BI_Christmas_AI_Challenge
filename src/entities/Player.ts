import type Phaser from 'phaser';
import type { BalanceConfig } from '../config/balance';
import { DEPTH, PLAYER_BODY, PLAYER_FRAME } from '../config/layout';
import { ANIMATIONS, TEXTURES } from '../graphics/textureKeys';
import { clampFallVelocity, getFastFallAcceleration } from '../logic/fastFall';
import type { PlatformLevel } from '../types/game';

export interface PlayerIntent {
  readonly jumpPressed: boolean;
  readonly jumpHeld: boolean;
  readonly crouchHeld: boolean;
  readonly hintsTogglePressed?: boolean;
}

export interface PlayerStepEvents {
  readonly jumped: boolean;
  readonly crouchStarted: boolean;
}

type BodyShape = (typeof PLAYER_BODY)[keyof typeof PLAYER_BODY];

/**
 * Scientist Santa's controller. Horizontal position is fixed; the world scrolls instead.
 * Rendering only uses texture keys from TEXTURES so artwork can be swapped freely.
 */
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly body: Phaser.Physics.Arcade.Body;
  private readonly shield: Phaser.GameObjects.Image;
  private readonly fastFallTrail: Phaser.GameObjects.Image;
  private crouchRemainingMs = 0;
  private crouchHeldMs = 0;
  private crouchCooldownRemainingMs = 0;
  private coyoteRemainingMs = 0;
  private jumpBufferRemainingMs = 0;
  private invulnerableRemainingMs = 0;
  private crouching = false;
  private ascendingFromJump = false;
  private defeated = false;
  private mustReleaseCrouch = false;
  private fastFalling = false;
  private platformLevel: PlatformLevel = 0;
  private elapsedMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    private readonly groundY: number,
    private readonly balance: BalanceConfig,
  ) {
    this.sprite = scene.physics.add.sprite(x, groundY, TEXTURES.santa.run[0]);
    this.sprite.setOrigin(0.5, 1).setDepth(DEPTH.player);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setGravityY(balance.player.gravity);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(0, balance.player.maximumFallSpeed);
    this.applyBody(PLAYER_BODY.standing);
    this.sprite.play(ANIMATIONS.santaRun);

    this.shield = scene.add.image(x, groundY - 52, TEXTURES.ui.shield).setDepth(DEPTH.player + 1).setVisible(false);
    this.fastFallTrail = scene.add.image(x, groundY - 45, TEXTURES.particles.ring)
      .setDepth(DEPTH.player - 1)
      .setTint(0x8ff4ff)
      .setScale(0.35, 0.8)
      .setAlpha(0.55)
      .setVisible(false);
  }

  get isGrounded(): boolean {
    return this.body.blocked.down || this.body.touching.down;
  }

  get isCrouching(): boolean {
    return this.crouching;
  }

  get isInvulnerable(): boolean {
    return this.invulnerableRemainingMs > 0;
  }

  get isDefeated(): boolean {
    return this.defeated;
  }

  get isFastFalling(): boolean {
    return this.fastFalling;
  }

  get currentPlatformLevel(): PlatformLevel {
    return this.platformLevel;
  }

  markPlatformLevel(level: PlatformLevel): void {
    this.platformLevel = level;
  }

  update(deltaMs: number, intent: PlayerIntent): PlayerStepEvents {
    this.elapsedMs += deltaMs;
    this.updateInvulnerability(deltaMs);
    if (this.defeated) {
      if (this.isGrounded && this.sprite.texture.key !== TEXTURES.santa.defeat) this.sprite.setTexture(TEXTURES.santa.defeat);
      return { jumped: false, crouchStarted: false };
    }

    const { player } = this.balance;
    const grounded = this.isGrounded;
    if (grounded && this.body.bottom >= this.groundY - 2) this.platformLevel = 0;
    let jumped = false;
    let crouchStarted = false;
    this.crouchCooldownRemainingMs = Math.max(0, this.crouchCooldownRemainingMs - deltaMs);
    if (!intent.crouchHeld) this.mustReleaseCrouch = false;

    this.coyoteRemainingMs = grounded ? player.coyoteTimeMs : Math.max(0, this.coyoteRemainingMs - deltaMs);
    this.jumpBufferRemainingMs = intent.jumpPressed
      ? player.jumpBufferMs
      : Math.max(0, this.jumpBufferRemainingMs - deltaMs);
    if (grounded && this.body.velocity.y >= 0) this.ascendingFromJump = false;

    // Holding crouch is bounded so it stays an intentional action rather than a permanent safe state.
    if (intent.crouchHeld) {
      if (grounded) {
        if (!this.crouching && this.crouchCooldownRemainingMs <= 0 && !this.mustReleaseCrouch) {
          this.setCrouching(true);
          crouchStarted = true;
        }
        if (this.crouching) {
          this.crouchHeldMs += deltaMs;
          this.crouchRemainingMs = player.crouchDurationMs;
        }
      } else {
        this.ascendingFromJump = false;
      }
    }
    this.setFastFalling(
      !grounded && intent.crouchHeld,
      player.fastFallAcceleration,
      player.fastFallVelocity,
      player.maximumFallSpeed,
    );
    if (this.crouching) {
      if (!intent.crouchHeld) this.crouchRemainingMs -= deltaMs;
      if (this.crouchHeldMs >= player.maxCrouchHoldMs) {
        this.mustReleaseCrouch = true;
        this.endCrouch();
      } else if (this.crouchRemainingMs <= 0 && !intent.crouchHeld) {
        this.endCrouch();
      }
    }

    // Jumping (with coyote time and input buffering). Jumping cancels a crouch.
    const canJump = this.coyoteRemainingMs > 0 || (player.allowAirJump && !grounded);
    if (this.jumpBufferRemainingMs > 0 && canJump) {
      if (this.crouching) this.endCrouch();
      this.body.setVelocityY(-player.jumpVelocity);
      this.coyoteRemainingMs = 0;
      this.jumpBufferRemainingMs = 0;
      this.ascendingFromJump = true;
      jumped = true;
    }

    // Variable jump height: releasing early shortens the hop.
    if (this.ascendingFromJump && !intent.jumpHeld && this.body.velocity.y < -player.jumpCutVelocity) {
      this.body.setVelocityY(-player.jumpCutVelocity);
    }

    this.updateVisual(jumped ? false : grounded);
    return { jumped, crouchStarted };
  }

  grantInvulnerability(durationMs: number): void {
    this.invulnerableRemainingMs = durationMs;
    this.shield.setVisible(true).setAlpha(1).setScale(0.6);
    this.scene.tweens.add({ targets: this.shield, scale: 1, duration: 180, ease: 'Back.easeOut' });
  }

  /** Brief, non-blocking collision reaction; movement controls remain responsive. */
  stumble(durationMs: number): void {
    this.sprite.setTintFill(0xff675e);
    this.scene.tweens.add({
      targets: this.sprite,
      angle: { from: -7, to: 5 },
      duration: Math.max(80, durationMs / 2),
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this.sprite.setAngle(0);
        if (!this.defeated) this.sprite.clearTint();
      },
    });
  }

  defeat(): void {
    if (this.defeated) return;
    this.defeated = true;
    this.setCrouching(false);
    this.sprite.anims.stop();
    this.sprite.setTexture(TEXTURES.santa.hit);
    this.sprite.setTint(0xffc2c2);
    this.body.setVelocityY(-380);
    this.shield.setVisible(false);
    this.invulnerableRemainingMs = 0;
    this.sprite.setAlpha(1);
    this.scene.time.delayedCall(260, () => this.sprite.clearTint());
  }

  destroy(): void {
    this.shield.destroy();
    this.fastFallTrail.destroy();
    this.sprite.destroy();
  }

  private updateInvulnerability(deltaMs: number): void {
    if (this.invulnerableRemainingMs <= 0) return;
    this.invulnerableRemainingMs = Math.max(0, this.invulnerableRemainingMs - deltaMs);
    const remaining = this.invulnerableRemainingMs;
    this.shield.setPosition(this.sprite.x, this.sprite.y - (this.crouching ? 30 : 52));
    this.shield.setAlpha(remaining < 300 ? remaining / 300 : 0.75 + Math.sin(this.elapsedMs / 60) * 0.25);
    this.sprite.setAlpha(Math.floor(this.elapsedMs / 80) % 2 === 0 ? 1 : 0.65);
    if (remaining === 0) {
      this.shield.setVisible(false);
      this.sprite.setAlpha(1);
    }
  }

  private setCrouching(crouching: boolean): void {
    this.crouching = crouching;
    this.crouchRemainingMs = crouching ? this.balance.player.crouchDurationMs : 0;
    this.crouchHeldMs = 0;
    this.applyBody(crouching ? PLAYER_BODY.crouching : PLAYER_BODY.standing);
  }

  private setFastFalling(
    fastFalling: boolean,
    acceleration: number,
    targetVelocity: number,
    maximumFallSpeed: number,
  ): void {
    if (this.fastFalling !== fastFalling) {
      this.fastFalling = fastFalling;
      // Landing from a fast-fall while Down is held must keep the crouch hitbox that just started.
      this.applyBody(
        fastFalling ? PLAYER_BODY.fastFalling : this.crouching ? PLAYER_BODY.crouching : PLAYER_BODY.standing,
      );
    }
    this.body.setAccelerationY(
      getFastFallAcceleration(fastFalling, true, this.body.velocity.y, targetVelocity, acceleration),
    );
    this.body.setVelocityY(clampFallVelocity(this.body.velocity.y, maximumFallSpeed));
    this.fastFallTrail.setVisible(fastFalling);
    if (fastFalling) {
      this.fastFallTrail.setPosition(this.sprite.x, this.sprite.y - 38);
      this.fastFallTrail.setAlpha(0.42 + Math.sin(this.elapsedMs / 45) * 0.12);
    }
  }

  private endCrouch(): void {
    if (!this.crouching) return;
    this.setCrouching(false);
    this.crouchCooldownRemainingMs = this.balance.player.crouchCooldownMs;
  }

  private applyBody(shape: BodyShape): void {
    this.body.setSize(shape.width, shape.height, false);
    this.body.setOffset((PLAYER_FRAME.width - shape.width) / 2, PLAYER_FRAME.height - shape.height);
  }

  private updateVisual(grounded: boolean): void {
    if (this.fastFalling) {
      this.showStatic(TEXTURES.santa.fastFall);
    } else if (this.crouching) {
      this.showStatic(TEXTURES.santa.crouch);
    } else if (!grounded) {
      this.showStatic(this.body.velocity.y < 0 ? TEXTURES.santa.jump : TEXTURES.santa.fall);
    } else if (!this.sprite.anims.isPlaying || this.sprite.anims.currentAnim?.key !== ANIMATIONS.santaRun) {
      this.sprite.play(ANIMATIONS.santaRun, true);
    }
  }

  private showStatic(key: string): void {
    if (this.sprite.anims.isPlaying) this.sprite.anims.stop();
    if (this.sprite.texture.key !== key) this.sprite.setTexture(key);
  }
}

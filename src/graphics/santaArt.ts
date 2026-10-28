import { PLAYER_FRAME } from '../config/layout';
import { createCanvasTexture, fillCircle, fillEllipse, fillRoundRect, line, starPath } from './canvas';
import { TEXTURES } from './textureKeys';
import type Phaser from 'phaser';

const C = {
  outline: '#0a1426',
  red: '#d6283b',
  redDark: '#9e1a2a',
  coat: '#f4f8fc',
  coatShade: '#c9d6e3',
  skin: '#ffd2b0',
  blush: '#ff9d9d',
  beard: '#ffffff',
  beardShade: '#dbe5ef',
  boot: '#1d1d26',
  belt: '#20202a',
  gold: '#ffc94a',
  goggle: '#2de2e6',
  glove: '#4fa3ff',
  flask: '#7dffb2',
};

type LegPose = readonly [footBackX: number, footBackY: number, footFrontX: number, footFrontY: number, kneeBend: number];
type ArmPose = readonly [backHandX: number, backHandY: number, frontHandX: number, frontHandY: number];
type Face = 'happy' | 'surprised' | 'sick';

interface StandingPose {
  readonly legs: LegPose;
  readonly arms: ArmPose;
  readonly bob: number;
  readonly face: Face;
  readonly hatSwing: number;
}

const RUN_POSES: readonly StandingPose[] = [
  { legs: [30, 109, 68, 107, 0], arms: [28, 74, 70, 72], bob: 0, face: 'happy', hatSwing: 0 },
  { legs: [44, 100, 54, 111, 6], arms: [38, 80, 62, 78], bob: -3, face: 'happy', hatSwing: 3 },
  { legs: [66, 107, 32, 109, 0], arms: [52, 80, 54, 80], bob: 0, face: 'happy', hatSwing: 0 },
  { legs: [54, 111, 42, 100, 6], arms: [40, 78, 64, 76], bob: -3, face: 'happy', hatSwing: 3 },
];

const JUMP_POSE: StandingPose = { legs: [38, 98, 62, 96, 10], arms: [32, 46, 76, 44], bob: -2, face: 'happy', hatSwing: 6 };
const FALL_POSE: StandingPose = { legs: [42, 111, 58, 110, 0], arms: [24, 62, 78, 60], bob: 0, face: 'happy', hatSwing: -4 };
const FAST_FALL_POSE: StandingPose = { legs: [38, 101, 62, 103, 8], arms: [26, 83, 78, 82], bob: 2, face: 'surprised', hatSwing: -8 };
const HIT_POSE: StandingPose = { legs: [34, 109, 64, 108, 0], arms: [26, 56, 76, 54], bob: 0, face: 'surprised', hatSwing: -6 };

function strokeFill(ctx: CanvasRenderingContext2D, fill: string, width = 2.5): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.strokeStyle = C.outline;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function limb(ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], color: string, width: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [stroke, w] of [
    [C.outline, width + 4],
    [color, width],
  ] as const) {
    ctx.beginPath();
    points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.strokeStyle = stroke;
    ctx.lineWidth = w;
    ctx.stroke();
  }
}

function boot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  fillRoundRect(ctx, x - 7, y - 7, 17, 9, 4, C.boot, C.outline, 2);
  fillRoundRect(ctx, x - 7, y - 9, 10, 4, 2, '#f4f8fc');
}

function flask(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(-2.5, -12);
  ctx.lineTo(2.5, -12);
  ctx.lineTo(2.5, -6);
  ctx.lineTo(8, 4);
  ctx.quadraticCurveTo(9, 7, 6, 7);
  ctx.lineTo(-6, 7);
  ctx.quadraticCurveTo(-9, 7, -8, 4);
  ctx.lineTo(-2.5, -6);
  ctx.closePath();
  ctx.fillStyle = 'rgba(220, 245, 255, 0.85)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.outline;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6.5, 1);
  ctx.lineTo(6.5, 1);
  ctx.lineTo(7, 5);
  ctx.lineTo(-7, 5);
  ctx.closePath();
  ctx.fillStyle = C.flask;
  ctx.fill();
  ctx.restore();
}

function head(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, face: Face, hatSwing: number): void {
  // Hat cone (behind head), flopping back as Santa runs right.
  ctx.beginPath();
  ctx.moveTo(cx - r - 2, cy - r + 6);
  ctx.quadraticCurveTo(cx - r - 4, cy - r - 14, cx - r - 16, cy - r - 12 + hatSwing);
  ctx.quadraticCurveTo(cx - 4, cy - r - 20, cx + r + 2, cy - r + 4);
  ctx.closePath();
  strokeFill(ctx, C.red);
  fillCircle(ctx, cx - r - 17, cy - r - 11 + hatSwing, 6, C.beard, C.outline, 2);

  // Face
  fillCircle(ctx, cx, cy, r, C.skin, C.outline, 2.5);
  fillCircle(ctx, cx + r * 0.25, cy + r * 0.25, r * 0.28, C.blush);

  // Beard
  ctx.beginPath();
  ctx.moveTo(cx - r + 1, cy + 1);
  ctx.quadraticCurveTo(cx - r + 2, cy + r * 1.9, cx + r * 0.25, cy + r * 2.1);
  ctx.quadraticCurveTo(cx + r * 1.15, cy + r * 1.5, cx + r, cy + 1);
  ctx.quadraticCurveTo(cx + r * 0.3, cy + r * 0.7, cx - r + 1, cy + 1);
  ctx.closePath();
  strokeFill(ctx, C.beard, 2.5);
  fillEllipse(ctx, cx + 1, cy + r * 1.1, r * 0.5, r * 0.25, C.beardShade);

  // Eyes and brows
  if (face === 'surprised') {
    fillCircle(ctx, cx + r * 0.45, cy - r * 0.2, 2.6, C.outline);
    fillCircle(ctx, cx - r * 0.05, cy - r * 0.2, 2.6, C.outline);
  } else if (face === 'sick') {
    line(ctx, cx + r * 0.25, cy - r * 0.3, cx + r * 0.65, cy - r * 0.1, C.outline, 2);
    line(ctx, cx - r * 0.25, cy - r * 0.3, cx + r * 0.1, cy - r * 0.1, C.outline, 2);
  } else {
    ctx.beginPath();
    ctx.arc(cx + r * 0.45, cy - r * 0.15, 2.6, Math.PI, 0);
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  line(ctx, cx + r * 0.15, cy - r * 0.55, cx + r * 0.75, cy - r * 0.5, C.beard, 3);

  // Nose and moustache
  fillCircle(ctx, cx + r * 0.85, cy + r * 0.12, 3.6, '#ff8c8c', C.outline, 1.5);
  fillEllipse(ctx, cx + r * 0.35, cy + r * 0.48, r * 0.55, r * 0.22, C.beard, -0.15);
  if (face === 'surprised') fillCircle(ctx, cx + r * 0.5, cy + r * 0.85, 3, '#7a2030');

  // Hat brim (white fur) with safety goggles
  fillRoundRect(ctx, cx - r - 3, cy - r - 2, r * 2 + 6, 8, 4, C.beard, C.outline, 2);
  fillCircle(ctx, cx + r * 0.2, cy - r + 1, 4.5, C.goggle, C.outline, 2);
  fillCircle(ctx, cx + r * 0.85, cy - r + 1, 4.5, C.goggle, C.outline, 2);
  fillCircle(ctx, cx + r * 0.1, cy - r, 1.4, '#ffffff');
  fillCircle(ctx, cx + r * 0.75, cy - r, 1.4, '#ffffff');
}

function drawStanding(ctx: CanvasRenderingContext2D, pose: StandingPose): void {
  const b = pose.bob;
  const [bx, by, fx, fy, bend] = pose.legs;
  const [bhx, bhy, fhx, fhy] = pose.arms;

  // Back arm and back leg are drawn first so they sit behind the coat.
  limb(ctx, [[42, 60 + b], [bhx, bhy + b]], C.coatShade, 8);
  fillCircle(ctx, bhx, bhy + b, 4.5, C.glove, C.outline, 1.5);
  limb(ctx, [[44, 86 + b], [(44 + bx) / 2 - bend, (86 + by) / 2 + b / 2], [bx, by - 6]], C.redDark, 10);
  boot(ctx, bx, by);
  limb(ctx, [[54, 86 + b], [(54 + fx) / 2 + bend, (86 + fy) / 2 + b / 2], [fx, fy - 6]], C.red, 10);
  boot(ctx, fx, fy);

  // Lab coat over the Santa suit
  ctx.beginPath();
  ctx.moveTo(37, 52 + b);
  ctx.lineTo(63, 52 + b);
  ctx.quadraticCurveTo(70, 70 + b, 70, 94 + b);
  ctx.lineTo(29, 96 + b);
  ctx.quadraticCurveTo(29, 70 + b, 37, 52 + b);
  ctx.closePath();
  strokeFill(ctx, C.coat);
  // Red jacket peeking through the open coat front, with belt and buckle
  ctx.beginPath();
  ctx.moveTo(53, 54 + b);
  ctx.lineTo(63, 54 + b);
  ctx.quadraticCurveTo(68, 72 + b, 67, 92 + b);
  ctx.lineTo(55, 93 + b);
  ctx.closePath();
  ctx.fillStyle = C.red;
  ctx.fill();
  ctx.fillStyle = C.belt;
  ctx.fillRect(55, 76 + b, 12, 6);
  fillRoundRect(ctx, 58, 75.5 + b, 6, 7, 1.5, C.gold);
  line(ctx, 53, 55 + b, 55, 94 + b, C.coatShade, 2);
  // Coat pocket with pen
  fillRoundRect(ctx, 34, 74 + b, 11, 9, 2, C.coatShade);
  line(ctx, 38, 70 + b, 38, 76 + b, C.goggle, 2);
  // Name badge
  fillRoundRect(ctx, 44, 60 + b, 7, 5, 1, C.goggle);

  head(ctx, 54, 36 + b, 14, pose.face, pose.hatSwing);

  // Front arm holding an Erlenmeyer flask
  limb(ctx, [[58, 60 + b], [fhx, fhy + b]], C.coat, 8);
  flask(ctx, fhx + 4, fhy + b - 4);
  fillCircle(ctx, fhx, fhy + b, 4.5, C.glove, C.outline, 1.5);
}

function drawCrouch(ctx: CanvasRenderingContext2D): void {
  // Legs bent in a deep squat
  limb(ctx, [[44, 96], [34, 102], [38, 106]], C.redDark, 10);
  boot(ctx, 40, 111);
  limb(ctx, [[54, 96], [66, 98], [64, 106]], C.red, 10);
  boot(ctx, 66, 111);

  limb(ctx, [[44, 86], [30, 98]], C.coatShade, 8);
  fillCircle(ctx, 30, 98, 4.5, C.glove, C.outline, 1.5);

  // Hunched coat
  ctx.beginPath();
  ctx.moveTo(34, 84);
  ctx.quadraticCurveTo(52, 74, 72, 82);
  ctx.quadraticCurveTo(76, 96, 72, 104);
  ctx.lineTo(28, 104);
  ctx.quadraticCurveTo(26, 92, 34, 84);
  ctx.closePath();
  strokeFill(ctx, C.coat);
  ctx.beginPath();
  ctx.moveTo(60, 80);
  ctx.quadraticCurveTo(70, 82, 72, 90);
  ctx.lineTo(70, 103);
  ctx.lineTo(60, 103);
  ctx.closePath();
  ctx.fillStyle = C.red;
  ctx.fill();
  ctx.fillStyle = C.belt;
  ctx.fillRect(60, 94, 12, 5);
  fillRoundRect(ctx, 63, 93.5, 5, 6, 1.5, C.gold);

  head(ctx, 66, 80, 12, 'happy', 8);

  limb(ctx, [[64, 88], [82, 96]], C.coat, 8);
  flask(ctx, 86, 92, 0.9);
  fillCircle(ctx, 82, 96, 4.5, C.glove, C.outline, 1.5);
}

function drawDefeat(ctx: CanvasRenderingContext2D): void {
  // Sitting on the floor with a thermometer and dizzy stars - poorly, but cosy.
  limb(ctx, [[46, 100], [72, 104]], C.redDark, 10);
  boot(ctx, 78, 108);
  limb(ctx, [[50, 102], [80, 108]], C.red, 10);
  boot(ctx, 86, 111);

  ctx.beginPath();
  ctx.moveTo(30, 66);
  ctx.lineTo(58, 66);
  ctx.quadraticCurveTo(66, 84, 64, 106);
  ctx.lineTo(22, 106);
  ctx.quadraticCurveTo(22, 84, 30, 66);
  ctx.closePath();
  strokeFill(ctx, C.coat);
  ctx.beginPath();
  ctx.moveTo(48, 68);
  ctx.lineTo(58, 68);
  ctx.quadraticCurveTo(63, 86, 62, 104);
  ctx.lineTo(50, 104);
  ctx.closePath();
  ctx.fillStyle = C.red;
  ctx.fill();

  // Blanket scarf
  fillRoundRect(ctx, 28, 62, 34, 10, 5, '#3fbf6f', C.outline, 2);

  ctx.save();
  ctx.translate(46, 48);
  ctx.rotate(-0.12);
  head(ctx, 0, 0, 14, 'sick', -6);
  ctx.restore();
  // Thermometer
  line(ctx, 56, 58, 72, 50, '#ffffff', 3.5);
  fillCircle(ctx, 72, 50, 2.5, '#ff4d5e');
  // Tissue in hand
  limb(ctx, [[34, 74], [22, 86]], C.coat, 8);
  fillRoundRect(ctx, 12, 80, 12, 10, 3, '#ffffff', C.outline, 1.5);

  // Dizzy stars
  for (const [x, y] of [
    [22, 18],
    [46, 10],
    [70, 20],
  ] as const) {
    starPath(ctx, x, y, 5, 6, 2.6);
    ctx.fillStyle = C.gold;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = C.outline;
    ctx.stroke();
  }
}

export function generateSantaTextures(textures: Phaser.Textures.TextureManager): void {
  const { width, height } = PLAYER_FRAME;
  RUN_POSES.forEach((pose, index) => {
    const key = TEXTURES.santa.run[index];
    if (key) createCanvasTexture(textures, key, width, height, (ctx) => drawStanding(ctx, pose));
  });
  createCanvasTexture(textures, TEXTURES.santa.jump, width, height, (ctx) => drawStanding(ctx, JUMP_POSE));
  createCanvasTexture(textures, TEXTURES.santa.fall, width, height, (ctx) => drawStanding(ctx, FALL_POSE));
  createCanvasTexture(textures, TEXTURES.santa.fastFall, width, height, (ctx) => drawStanding(ctx, FAST_FALL_POSE));
  createCanvasTexture(textures, TEXTURES.santa.hit, width, height, (ctx) => drawStanding(ctx, HIT_POSE));
  createCanvasTexture(textures, TEXTURES.santa.crouch, width, height, drawCrouch);
  createCanvasTexture(textures, TEXTURES.santa.defeat, width, height, drawDefeat);
}

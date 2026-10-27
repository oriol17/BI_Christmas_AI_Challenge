import type Phaser from 'phaser';
import { createCanvasTexture, fillCircle, fillEllipse, fillRoundRect, line, roundRectPath } from './canvas';
import { TEXTURES } from './textureKeys';

const G = {
  outline: '#0a1426',
  fur: '#6cbf3a',
  furDark: '#3f8a22',
  furLight: '#9be35c',
  eye: '#ffe14a',
  pupil: '#c0262f',
  sweater: '#5b2a86',
  sweaterDark: '#3d1b5c',
  glove: '#1d1d26',
  dish: '#bfefff',
};

export const GRUMPUS_FRAME = { width: 120, height: 150 } as const;
type GrumpusPose = 'idle' | 'throw' | 'warn';

function furTufts(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  const tufts = 14;
  for (let index = 0; index <= tufts; index += 1) {
    const angle = (index / tufts) * Math.PI * 2;
    const radius = index % 2 === 0 ? r + 4 : r - 1;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * 1.05;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = G.fur;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = G.outline;
  ctx.stroke();
}

function arm(ctx: CanvasRenderingContext2D, from: [number, number], elbow: [number, number], hand: [number, number]): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [color, width] of [
    [G.outline, 13],
    [G.sweater, 9],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(...from);
    ctx.lineTo(...elbow);
    ctx.lineTo(...hand);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  fillCircle(ctx, hand[0], hand[1], 6, G.glove, G.outline, 2);
}

function petriDish(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  fillEllipse(ctx, x, y, 13, 5, G.dish);
  ctx.lineWidth = 2;
  ctx.strokeStyle = G.outline;
  ctx.beginPath();
  ctx.ellipse(x, y, 13, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
  fillCircle(ctx, x - 5, y - 1, 2.5, '#8e4dff');
  fillCircle(ctx, x + 2, y, 2.2, '#ff5fa2');
  fillCircle(ctx, x + 7, y - 1, 2, '#8e4dff');
}

function drawGrumpus(ctx: CanvasRenderingContext2D, pose: GrumpusPose): void {
  // Legs
  line(ctx, 52, 120, 48, 146, G.outline, 12);
  line(ctx, 52, 120, 48, 146, G.furDark, 8);
  line(ctx, 70, 120, 74, 146, G.outline, 12);
  line(ctx, 70, 120, 74, 146, G.furDark, 8);
  fillEllipse(ctx, 44, 146, 10, 4, G.outline);
  fillEllipse(ctx, 78, 146, 10, 4, G.outline);

  // Back arm
  if (pose === 'throw') arm(ctx, [48, 82], [30, 70], [26, 46]);
  else if (pose === 'warn') arm(ctx, [48, 82], [26, 64], [18, 36]);
  else arm(ctx, [48, 82], [36, 100], [50, 104]);

  // Sweater body (pear shaped)
  ctx.beginPath();
  ctx.moveTo(44, 70);
  ctx.quadraticCurveTo(60, 62, 78, 70);
  ctx.quadraticCurveTo(92, 102, 80, 124);
  ctx.lineTo(42, 124);
  ctx.quadraticCurveTo(30, 102, 44, 70);
  ctx.closePath();
  ctx.fillStyle = G.sweater;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = G.outline;
  ctx.stroke();
  for (let y = 84; y < 122; y += 9) line(ctx, 40, y, 84, y, G.sweaterDark, 2);
  // Scarf
  fillRoundRect(ctx, 40, 64, 42, 10, 5, '#ff9f1c', G.outline, 2);
  fillRoundRect(ctx, 70, 70, 9, 22, 4, '#ff9f1c', G.outline, 2);

  // Head
  furTufts(ctx, 60, 42, 24);
  fillEllipse(ctx, 62, 50, 16, 12, G.furLight);
  // Tall droopy ear tufts
  ctx.beginPath();
  ctx.moveTo(42, 26);
  ctx.quadraticCurveTo(26, 6, 36, 2);
  ctx.quadraticCurveTo(44, 12, 50, 22);
  ctx.closePath();
  ctx.fillStyle = G.fur;
  ctx.fill();
  ctx.stroke();

  // Eyes with heavy brows
  const angry = pose !== 'idle';
  for (const ex of [52, 70]) {
    fillEllipse(ctx, ex, 38, 7, 6, G.eye);
    ctx.lineWidth = 2;
    ctx.strokeStyle = G.outline;
    ctx.beginPath();
    ctx.ellipse(ex, 38, 7, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    fillCircle(ctx, ex + 2, 39, 2.6, G.pupil);
    fillCircle(ctx, ex + 2, 39, 1.2, G.outline);
  }
  line(ctx, 44, angry ? 29 : 31, 58, angry ? 34 : 31, G.furDark, 5);
  line(ctx, 64, angry ? 34 : 31, 78, angry ? 29 : 31, G.furDark, 5);

  // Mouth: sly grin or wide laugh
  ctx.beginPath();
  if (pose === 'warn') {
    ctx.moveTo(46, 52);
    ctx.quadraticCurveTo(62, 72, 80, 50);
    ctx.quadraticCurveTo(62, 58, 46, 52);
    ctx.fillStyle = '#40101a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = G.outline;
    ctx.stroke();
  } else {
    ctx.moveTo(46, 52);
    ctx.quadraticCurveTo(60, 62, 80, 48);
    ctx.lineWidth = 3;
    ctx.strokeStyle = G.outline;
    ctx.stroke();
  }

  // Front arm
  if (pose === 'throw') {
    arm(ctx, [74, 80], [92, 70], [104, 52]);
    petriDish(ctx, 106, 46);
  } else if (pose === 'warn') {
    arm(ctx, [74, 80], [94, 62], [102, 36]);
  } else {
    arm(ctx, [74, 80], [92, 96], [78, 104]);
    petriDish(ctx, 66, 104);
  }
}

function drawPlatform(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // Thruster glow
  const gradient = ctx.createRadialGradient(width / 2, height - 10, 2, width / 2, height - 10, 40);
  gradient.addColorStop(0, 'rgba(143, 244, 255, 0.9)');
  gradient.addColorStop(1, 'rgba(45, 226, 230, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height - 40, width, 40);

  // Deck
  fillRoundRect(ctx, 6, 14, width - 12, 18, 8, '#3a4f69', '#0a1426', 2.5);
  // Hazard stripes along the deck edge
  ctx.save();
  roundRectPath(ctx, 10, 22, width - 20, 7, 3);
  ctx.clip();
  for (let x = 0; x < width; x += 14) {
    ctx.fillStyle = (x / 14) % 2 === 0 ? '#ffc94a' : '#1d1d26';
    ctx.beginPath();
    ctx.moveTo(x, 30);
    ctx.lineTo(x + 7, 20);
    ctx.lineTo(x + 14, 20);
    ctx.lineTo(x + 7, 30);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Railing
  line(ctx, 14, 14, 14, 0, '#9fb0c4', 3);
  line(ctx, width - 14, 14, width - 14, 0, '#9fb0c4', 3);
  line(ctx, 14, 2, width - 14, 2, '#9fb0c4', 3);
  // Warning lamps
  fillCircle(ctx, 22, 38, 5, '#ff3b2f', '#0a1426', 2);
  fillCircle(ctx, width - 22, 38, 5, '#ff3b2f', '#0a1426', 2);
  // Thruster nozzle
  fillRoundRect(ctx, width / 2 - 18, 32, 36, 12, 4, '#2a3a50', '#0a1426', 2);
}

export function generateGrumpusTextures(textures: Phaser.Textures.TextureManager): void {
  const { width, height } = GRUMPUS_FRAME;
  createCanvasTexture(textures, TEXTURES.grumpus.idle, width, height, (ctx) => drawGrumpus(ctx, 'idle'));
  createCanvasTexture(textures, TEXTURES.grumpus.throw, width, height, (ctx) => drawGrumpus(ctx, 'throw'));
  createCanvasTexture(textures, TEXTURES.grumpus.warn, width, height, (ctx) => drawGrumpus(ctx, 'warn'));
  createCanvasTexture(textures, TEXTURES.grumpus.platform, 180, 64, drawPlatform);
}

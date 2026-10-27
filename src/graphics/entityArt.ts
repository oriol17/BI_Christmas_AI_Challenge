import type Phaser from 'phaser';
import { createCanvasTexture, fillCircle, fillEllipse, fillRoundRect, glow, line, noGlow, roundRectPath, starPath } from './canvas';
import { TEXTURES } from './textureKeys';

/**
 * Bacteria are distinguishable without colour:
 * - Gram-positive: round grape-like cluster, very thick wall outline, "+" symbol
 * - Gram-negative: elongated rod with double thin outline and wavy flagella, "−" symbol
 * - MDR: large spiky silhouette, hazard ring and warning triangle "!" with "MDR" label
 */
export const BACTERIUM_FRAME = {
  gramPositive: { width: 68, height: 68 },
  gramNegative: { width: 80, height: 56 },
  mdr: { width: 108, height: 108 },
} as const;

const OUTLINE = '#0a1426';

function angryEyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, spread: number, size: number): void {
  for (const dx of [-spread, spread]) {
    fillCircle(ctx, cx + dx, cy, size, '#ffffff', OUTLINE, 1.5);
    fillCircle(ctx, cx + dx - size * 0.3, cy + size * 0.15, size * 0.5, OUTLINE);
  }
  line(ctx, cx - spread - size, cy - size - 1, cx - spread + size, cy - size + 2, OUTLINE, 2.2);
  line(ctx, cx + spread - size, cy - size + 2, cx + spread + size, cy - size - 1, OUTLINE, 2.2);
}

function drawGramPositive(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const lobes: readonly [number, number, number][] = [
    [cx - 15, cy - 12, 11],
    [cx + 15, cy - 12, 11],
    [cx - 17, cy + 11, 11],
    [cx + 17, cy + 11, 11],
    [cx, cy + 18, 10],
  ];
  glow(ctx, 'rgba(142, 77, 255, 0.8)', 8);
  for (const [x, y, r] of lobes) fillCircle(ctx, x, y, r, '#a774ff', '#2c0f5c', 4.5);
  fillCircle(ctx, cx, cy, 17, '#8e4dff', '#2c0f5c', 5);
  noGlow(ctx);
  for (const [x, y, r] of lobes) fillCircle(ctx, x - r * 0.35, y - r * 0.35, r * 0.28, 'rgba(255,255,255,0.45)');
  angryEyes(ctx, cx, cy - 7, 6, 3.6);
  // Bold plus symbol
  fillRoundRect(ctx, cx - 9, cy + 2, 18, 6, 2, '#ffffff', OUTLINE, 1.5);
  fillRoundRect(ctx, cx - 3, cy - 4, 6, 18, 2, '#ffffff', OUTLINE, 1.5);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - 7.5, cy + 3.2, 15, 3.6);
}

function drawGramNegative(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cy = h / 2;
  // Flagella trailing behind (to the right, as the bacterium moves left)
  ctx.lineCap = 'round';
  for (const offset of [-8, 0, 8]) {
    ctx.beginPath();
    ctx.moveTo(62, cy + offset);
    for (let x = 62; x <= w - 2; x += 2) ctx.lineTo(x, cy + offset + Math.sin((x - 62) * 0.55) * 3);
    ctx.strokeStyle = '#ffb3d1';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Rod body with a double (outer membrane) outline
  glow(ctx, 'rgba(255, 95, 162, 0.8)', 8);
  roundRectPath(ctx, 6, cy - 15, 58, 30, 15);
  ctx.fillStyle = '#ff5fa2';
  ctx.fill();
  noGlow(ctx);
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  roundRectPath(ctx, 10, cy - 11, 50, 22, 11);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#ffe0ee';
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  fillEllipse(ctx, 24, cy - 8, 10, 3, 'rgba(255,255,255,0.4)');
  angryEyes(ctx, 20, cy - 2, 5, 3.4);
  // Bold minus symbol
  fillRoundRect(ctx, 34, cy - 3.5, 20, 7, 3, '#ffffff', OUTLINE, 1.5);
}

function drawMdr(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  // Spiky mutated silhouette
  glow(ctx, 'rgba(156, 255, 46, 0.9)', 14);
  starPath(ctx, cx, cy, 13, 50, 36);
  ctx.fillStyle = '#3b1747';
  ctx.fill();
  noGlow(ctx);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#9cff2e';
  ctx.stroke();
  // Hazard ring
  ctx.beginPath();
  ctx.arc(cx, cy, 31, 0, Math.PI * 2);
  ctx.setLineDash([7, 5]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ff3b2f';
  ctx.stroke();
  ctx.setLineDash([]);
  fillCircle(ctx, cx, cy, 27, '#25102e', OUTLINE, 2);
  // Mutation blotches
  fillCircle(ctx, cx - 16, cy + 14, 4, 'rgba(156,255,46,0.6)');
  fillCircle(ctx, cx + 17, cy - 15, 3, 'rgba(156,255,46,0.6)');
  // Three angry eyes
  for (const [ex, ey, r] of [
    [cx - 11, cy - 13, 4.2],
    [cx + 11, cy - 13, 4.2],
    [cx, cy - 20, 3.2],
  ] as const) {
    fillCircle(ctx, ex, ey, r, '#ff3b2f', OUTLINE, 1.5);
    fillCircle(ctx, ex, ey, r * 0.4, '#ffe14a');
  }
  // Warning triangle with exclamation mark
  ctx.beginPath();
  ctx.moveTo(cx, cy - 6);
  ctx.lineTo(cx + 13, cy + 15);
  ctx.lineTo(cx - 13, cy + 15);
  ctx.closePath();
  ctx.fillStyle = '#ffc94a';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(cx - 1.5, cy + 1, 3, 8);
  ctx.fillRect(cx - 1.5, cy + 11, 3, 2.5);
  ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9cff2e';
  ctx.fillText('MDR', cx, cy + 25);
}

function drawAntibioticGramPositive(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const halo = ctx.createRadialGradient(cx, cy, 4, cx, cy, w / 2);
  halo.addColorStop(0, 'rgba(255,255,255,0.75)');
  halo.addColorStop(1, 'rgba(180,240,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  // Two-tone capsule pill
  ctx.save();
  ctx.translate(cx, cy + 2);
  ctx.rotate(-0.6);
  ctx.save();
  roundRectPath(ctx, -20, -9, 40, 18, 9);
  ctx.clip();
  ctx.fillStyle = '#8e4dff';
  ctx.fillRect(-20, -9, 20, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, -9, 20, 18);
  ctx.restore();
  roundRectPath(ctx, -20, -9, 40, 18, 9);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  fillEllipse(ctx, -9, -4, 6, 2, 'rgba(255,255,255,0.6)');
  ctx.restore();
  // "+" badge
  fillCircle(ctx, w - 13, 12, 10, '#ffffff', '#8e4dff', 3);
  ctx.fillStyle = '#5a1fd1';
  ctx.fillRect(w - 19, 10, 12, 4);
  ctx.fillRect(w - 15, 6, 4, 12);
  // Medical cross sparkle
  ctx.fillStyle = '#46e38a';
  ctx.fillRect(7, h - 16, 10, 4);
  ctx.fillRect(10, h - 19, 4, 10);
}

function drawAntibioticGramNegative(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  const halo = ctx.createRadialGradient(cx, h / 2, 4, cx, h / 2, w / 2);
  halo.addColorStop(0, 'rgba(255,255,255,0.75)');
  halo.addColorStop(1, 'rgba(180,240,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  // Medicine vial
  fillRoundRect(ctx, cx - 8, 6, 16, 8, 2, '#4fa3ff', OUTLINE, 2);
  fillRoundRect(ctx, cx - 6, 13, 12, 5, 1, '#dfefff', OUTLINE, 1.5);
  fillRoundRect(ctx, cx - 12, 17, 24, 30, 6, 'rgba(225,245,255,0.95)', OUTLINE, 2.5);
  ctx.save();
  roundRectPath(ctx, cx - 12, 17, 24, 30, 6);
  ctx.clip();
  ctx.fillStyle = '#ff5fa2';
  ctx.fillRect(cx - 12, 30, 24, 17);
  ctx.restore();
  fillRoundRect(ctx, cx - 9, 25, 18, 12, 2, '#ffffff', OUTLINE, 1.2);
  fillRoundRect(ctx, cx - 6, 29.5, 12, 3.5, 1.5, '#d61f6e');
  fillRoundRect(ctx, cx - 9, 19, 3, 22, 1.5, 'rgba(255,255,255,0.7)');
  // Medical cross sparkle
  ctx.fillStyle = '#46e38a';
  ctx.fillRect(w - 15, h - 16, 10, 4);
  ctx.fillRect(w - 12, h - 19, 4, 10);
}

function drawCookie(ctx: CanvasRenderingContext2D, w: number): void {
  const cx = w / 2;
  ctx.fillStyle = '#c77a3a';
  ctx.strokeStyle = '#5a2e10';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(cx, 12, 9, 0, Math.PI * 2);
  ctx.moveTo(cx - 8, 20);
  ctx.lineTo(cx - 19, 22);
  ctx.quadraticCurveTo(cx - 22, 28, cx - 17, 29);
  ctx.lineTo(cx - 8, 28);
  ctx.lineTo(cx - 13, 43);
  ctx.quadraticCurveTo(cx - 11, 48, cx - 6, 46);
  ctx.lineTo(cx, 36);
  ctx.lineTo(cx + 6, 46);
  ctx.quadraticCurveTo(cx + 11, 48, cx + 13, 43);
  ctx.lineTo(cx + 8, 28);
  ctx.lineTo(cx + 17, 29);
  ctx.quadraticCurveTo(cx + 22, 28, cx + 19, 22);
  ctx.lineTo(cx + 8, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  fillCircle(ctx, cx, 12, 9, '#c77a3a', '#5a2e10', 2.5);
  // Icing
  fillCircle(ctx, cx - 3, 10, 1.6, '#ffffff');
  fillCircle(ctx, cx + 3, 10, 1.6, '#ffffff');
  ctx.beginPath();
  ctx.arc(cx, 13, 4, 0.2, Math.PI - 0.2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  fillCircle(ctx, cx, 26, 2, '#d6283b');
  fillCircle(ctx, cx, 32, 2, '#2fae66');
  line(ctx, cx - 17, 24, cx - 13, 26, '#ffffff', 1.5);
  line(ctx, cx + 13, 26, cx + 17, 24, '#ffffff', 1.5);
}

function drawPresent(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  fillRoundRect(ctx, 4, 14, w - 8, h - 18, 4, '#d6283b', OUTLINE, 2.5);
  fillRoundRect(ctx, 2, 10, w - 4, 9, 3, '#e8394c', OUTLINE, 2.5);
  ctx.fillStyle = '#ffc94a';
  ctx.fillRect(w / 2 - 3, 10, 6, h - 14);
  ctx.beginPath();
  ctx.ellipse(w / 2 - 7, 7, 7, 4.5, -0.4, 0, Math.PI * 2);
  ctx.ellipse(w / 2 + 7, 7, 7, 4.5, 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffc94a';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function drawWarning(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  glow(ctx, 'rgba(255, 59, 47, 0.9)', 10);
  ctx.beginPath();
  ctx.moveTo(w / 2, 6);
  ctx.lineTo(w - 6, h - 8);
  ctx.lineTo(6, h - 8);
  ctx.closePath();
  ctx.fillStyle = '#ff3b2f';
  ctx.fill();
  noGlow(ctx);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(w / 2 - 3.5, 22, 7, 20);
  ctx.fillRect(w / 2 - 3.5, 46, 7, 6);
}

function drawShield(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w / 2);
  gradient.addColorStop(0, 'rgba(143,244,255,0)');
  gradient.addColorStop(0.8, 'rgba(143,244,255,0.25)');
  gradient.addColorStop(1, 'rgba(143,244,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 4, 0, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(143,244,255,0.9)';
  ctx.setLineDash([10, 6]);
  ctx.stroke();
}

function drawSpeaker(ctx: CanvasRenderingContext2D, muted: boolean): void {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 13);
  ctx.lineTo(12, 13);
  ctx.lineTo(19, 6);
  ctx.lineTo(19, 30);
  ctx.lineTo(12, 23);
  ctx.lineTo(6, 23);
  ctx.closePath();
  ctx.fill();
  if (muted) {
    line(ctx, 23, 12, 32, 24, '#ff4d5e', 3);
    line(ctx, 32, 12, 23, 24, '#ff4d5e', 3);
  } else {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(19, 18, 6, -0.9, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(19, 18, 11, -0.9, 0.9);
    ctx.stroke();
  }
}

export function generateEntityTextures(textures: Phaser.Textures.TextureManager): void {
  const { gramPositive, gramNegative, mdr } = BACTERIUM_FRAME;
  createCanvasTexture(textures, TEXTURES.bacteria.gramPositive, gramPositive.width, gramPositive.height, drawGramPositive);
  createCanvasTexture(textures, TEXTURES.bacteria.gramNegative, gramNegative.width, gramNegative.height, drawGramNegative);
  createCanvasTexture(textures, TEXTURES.bacteria.mdr, mdr.width, mdr.height, drawMdr);
  createCanvasTexture(textures, TEXTURES.antibiotics.gramPositive, 56, 56, drawAntibioticGramPositive);
  createCanvasTexture(textures, TEXTURES.antibiotics.gramNegative, 56, 56, drawAntibioticGramNegative);
  createCanvasTexture(textures, TEXTURES.cookie, 48, 50, (ctx, w) => drawCookie(ctx, w));
  createCanvasTexture(textures, TEXTURES.present, 40, 40, drawPresent);

  createCanvasTexture(textures, TEXTURES.particles.dot, 10, 10, (ctx) => fillCircle(ctx, 5, 5, 5, '#ffffff'));
  createCanvasTexture(textures, TEXTURES.particles.star, 18, 18, (ctx) => {
    starPath(ctx, 9, 9, 5, 9, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
  createCanvasTexture(textures, TEXTURES.particles.confetti, 6, 11, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 6, 11);
  });
  createCanvasTexture(textures, TEXTURES.particles.ring, 64, 64, (ctx) => {
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  });
  createCanvasTexture(textures, TEXTURES.particles.crumb, 7, 7, (ctx) => fillCircle(ctx, 3.5, 3.5, 3.5, '#c77a3a'));

  createCanvasTexture(textures, TEXTURES.ui.warning, 64, 60, drawWarning);
  createCanvasTexture(textures, TEXTURES.ui.shield, 112, 132, drawShield);
  createCanvasTexture(textures, TEXTURES.ui.soundOn, 36, 36, (ctx) => drawSpeaker(ctx, false));
  createCanvasTexture(textures, TEXTURES.ui.soundOff, 36, 36, (ctx) => drawSpeaker(ctx, true));
}

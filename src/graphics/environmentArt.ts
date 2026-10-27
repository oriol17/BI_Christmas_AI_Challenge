import type Phaser from 'phaser';
import { GAME_HEIGHT, LAYOUT } from '../config/layout';
import { createCanvasTexture, decorRandom, fillCircle, fillEllipse, fillRoundRect, glow, line, noGlow, roundRectPath, starPath } from './canvas';
import { TEXTURES } from './textureKeys';

const OUTLINE = '#0a1426';
const BULB_COLORS = ['#ff4d5e', '#ffc94a', '#2de2e6', '#46e38a'] as const;
const WALL_HEIGHT = LAYOUT.groundY;

function drawNight(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#060d22');
  sky.addColorStop(0.6, '#13275a');
  sky.addColorStop(1, '#2a4a7e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const random = decorRandom(42);
  for (let index = 0; index < 70; index += 1) {
    fillCircle(ctx, random() * w, random() * h * 0.6, random() * 1.4 + 0.3, `rgba(255,255,255,${0.4 + random() * 0.6})`);
  }
  // Seamless snowy hills and a sleepy village (periods divide the texture width)
  for (const [base, amp, color, period] of [
    [h - 150, 26, '#2c4f86', w / 2],
    [h - 100, 18, '#dfeaf7', w / 4],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, base + Math.sin((x / period) * Math.PI * 2) * amp);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  for (let x = 30; x < w; x += 128) {
    const y = h - 120 + Math.sin((x / (w / 4)) * Math.PI * 2) * 18;
    ctx.fillStyle = '#5b3a2a';
    ctx.fillRect(x, y - 18, 34, 22);
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 18);
    ctx.lineTo(x + 17, y - 34);
    ctx.lineTo(x + 38, y - 18);
    ctx.closePath();
    ctx.fillStyle = '#f4f8fc';
    ctx.fill();
    ctx.fillStyle = '#ffd36b';
    ctx.fillRect(x + 6, y - 12, 7, 7);
    ctx.fillRect(x + 21, y - 12, 7, 7);
  }
}

function drawSnow(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const random = decorRandom(7);
  for (let index = 0; index < 60; index += 1) {
    fillCircle(ctx, random() * w, random() * h, random() * 2 + 0.8, `rgba(255,255,255,${0.5 + random() * 0.5})`);
  }
}

function garland(ctx: CanvasRenderingContext2D, w: number, y: number, period: number, sag: number): void {
  ctx.beginPath();
  for (let x = 0; x <= w; x += 4) {
    const t = (x % period) / period;
    const yy = y + Math.sin(t * Math.PI) * sag;
    if (x === 0) ctx.moveTo(x, yy);
    else ctx.lineTo(x, yy);
  }
  ctx.strokeStyle = '#1f7a45';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = '#2fae66';
  ctx.lineWidth = 4;
  ctx.stroke();
  let bulb = 0;
  for (let x = period / 8; x < w; x += period / 4) {
    const t = (x % period) / period;
    const yy = y + Math.sin(t * Math.PI) * sag + 7;
    const color = BULB_COLORS[bulb % BULB_COLORS.length]!;
    glow(ctx, color, 10);
    fillEllipse(ctx, x, yy, 3.5, 5, color);
    noGlow(ctx);
    bulb += 1;
  }
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.clearRect(x, y, w, h);
  // Frost in the corners
  const frost = ctx.createRadialGradient(x, y + h, 0, x, y + h, w * 0.5);
  frost.addColorStop(0, 'rgba(230,245,255,0.55)');
  frost.addColorStop(1, 'rgba(230,245,255,0)');
  ctx.fillStyle = frost;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#9fb0c4';
  ctx.lineWidth = 10;
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = 5;
  line(ctx, x + w / 2, y, x + w / 2, y + h, '#9fb0c4', 6);
  line(ctx, x, y + h * 0.45, x + w, y + h * 0.45, '#9fb0c4', 6);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
  // Snowy sill
  fillRoundRect(ctx, x - 14, y + h + 2, w + 28, 12, 4, '#7d93ad', OUTLINE, 2);
  fillRoundRect(ctx, x - 10, y + h - 4, w + 20, 8, 4, '#ffffff');
}

function drawWall(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#173455');
  wall.addColorStop(1, '#10263f');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 120) line(ctx, x, 60, x, h, 'rgba(255,255,255,0.05)', 2);
  // Lower wall panels
  ctx.fillStyle = '#0e2238';
  ctx.fillRect(0, h - 140, w, 140);
  line(ctx, 0, h - 140, w, h - 140, '#2de2e6', 2);

  drawWindow(ctx, 90, 130, 240, 260);
  drawWindow(ctx, 570, 130, 240, 260);

  // Ceiling with lamp fixtures
  const ceiling = ctx.createLinearGradient(0, 0, 0, 60);
  ceiling.addColorStop(0, '#08121f');
  ceiling.addColorStop(1, '#1d3550');
  ctx.fillStyle = ceiling;
  ctx.fillRect(0, 0, w, 60);
  for (let x = 120; x < w; x += 240) {
    fillRoundRect(ctx, x - 40, 46, 80, 10, 4, '#cfe9ff');
    const beam = ctx.createLinearGradient(0, 56, 0, 260);
    beam.addColorStop(0, 'rgba(200,240,255,0.18)');
    beam.addColorStop(1, 'rgba(200,240,255,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x - 40, 56);
    ctx.lineTo(x + 40, 56);
    ctx.lineTo(x + 110, 260);
    ctx.lineTo(x - 110, 260);
    ctx.closePath();
    ctx.fill();
  }
  // Pipes along the ceiling and the lower wall
  for (const [y, color] of [
    [64, '#5d7896'],
    [h - 120, '#4a6582'],
  ] as const) {
    fillRoundRect(ctx, -10, y, w + 20, 12, 6, color, OUTLINE, 2);
    for (let x = 60; x < w; x += 200) fillRoundRect(ctx, x, y - 3, 14, 18, 3, '#8aa4bf', OUTLINE, 2);
  }
  garland(ctx, w, 84, 240, 26);

  // Wreath between windows
  ctx.beginPath();
  ctx.arc(450, 230, 34, 0, Math.PI * 2);
  ctx.strokeStyle = '#1f7a45';
  ctx.lineWidth = 16;
  ctx.stroke();
  const random = decorRandom(3);
  for (let index = 0; index < 14; index += 1) {
    const angle = random() * Math.PI * 2;
    fillCircle(ctx, 450 + Math.cos(angle) * 34, 230 + Math.sin(angle) * 34, 3.5, BULB_COLORS[index % 4]!);
  }
  ctx.fillStyle = '#d6283b';
  ctx.beginPath();
  ctx.moveTo(450, 262);
  ctx.lineTo(436, 280);
  ctx.lineTo(450, 272);
  ctx.lineTo(464, 280);
  ctx.closePath();
  ctx.fill();

  // Lab sign and warning beacon
  fillRoundRect(ctx, 850, 150, 92, 54, 8, '#0b1a2e', '#2de2e6', 3);
  ctx.fillStyle = '#8ff4ff';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('LAB 24', 896, 174);
  ctx.font = '11px Arial';
  ctx.fillStyle = '#ffc94a';
  ctx.fillText('Q.C. & GIFTS', 896, 193);
  fillRoundRect(ctx, 880, 248, 32, 10, 3, '#4a6582', OUTLINE, 2);
  glow(ctx, '#ff3b2f', 14);
  ctx.beginPath();
  ctx.arc(896, 248, 13, Math.PI, 0);
  ctx.fillStyle = '#ff5a4a';
  ctx.fill();
  noGlow(ctx);
}

function cylinderTank(ctx: CanvasRenderingContext2D, x: number, w: number, top: number, liquid: string): void {
  const body = ctx.createLinearGradient(x, 0, x + w, 0);
  body.addColorStop(0, '#3c5674');
  body.addColorStop(0.4, '#7d97b3');
  body.addColorStop(1, '#2c4560');
  fillRoundRect(ctx, x, top, w, WALL_HEIGHT - top, 18, '#3c5674', OUTLINE, 2.5);
  roundRectPath(ctx, x, top, w, WALL_HEIGHT - top, 18);
  ctx.fillStyle = body;
  ctx.fill();
  // Glass window with glowing culture medium and bubbles
  const wx = x + w * 0.25;
  const ww = w * 0.5;
  fillRoundRect(ctx, wx, top + 40, ww, 140, 12, '#0b1a2e', OUTLINE, 2);
  glow(ctx, liquid, 16);
  fillRoundRect(ctx, wx + 4, top + 80, ww - 8, 96, 10, liquid);
  noGlow(ctx);
  const random = decorRandom(x);
  for (let index = 0; index < 8; index += 1) {
    fillCircle(ctx, wx + 8 + random() * (ww - 16), top + 90 + random() * 80, 2 + random() * 3, 'rgba(255,255,255,0.6)');
  }
  fillEllipse(ctx, x + w / 2, top + 4, w / 2 - 4, 10, '#8aa4bf');
  line(ctx, x + w / 2, top - 4, x + w / 2, top - 40, '#5d7896', 10);
  fillRoundRect(ctx, x + 10, WALL_HEIGHT - 70, w - 20, 16, 4, '#1d3550', OUTLINE, 2);
  for (let index = 0; index < 3; index += 1) fillCircle(ctx, x + 22 + index * 14, WALL_HEIGHT - 62, 3, BULB_COLORS[index]!);
}

function glassware(ctx: CanvasRenderingContext2D, x: number, baseY: number, kind: number, color: string): void {
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  if (kind === 0) {
    fillRoundRect(ctx, x, baseY - 34, 18, 34, 3, 'rgba(220,240,255,0.5)', OUTLINE, 2);
    fillRoundRect(ctx, x + 2, baseY - 18, 14, 16, 2, color);
  } else if (kind === 1) {
    ctx.beginPath();
    ctx.moveTo(x + 7, baseY - 40);
    ctx.lineTo(x + 13, baseY - 40);
    ctx.lineTo(x + 13, baseY - 26);
    ctx.lineTo(x + 22, baseY);
    ctx.lineTo(x - 2, baseY);
    ctx.lineTo(x + 7, baseY - 26);
    ctx.closePath();
    ctx.fillStyle = 'rgba(220,240,255,0.5)';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 2, baseY - 10);
    ctx.lineTo(x + 18, baseY - 10);
    ctx.lineTo(x + 21, baseY - 1);
    ctx.lineTo(x - 1, baseY - 1);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    fillCircle(ctx, x + 10, baseY - 13, 12, 'rgba(220,240,255,0.5)', OUTLINE, 2);
    fillRoundRect(ctx, x + 7, baseY - 40, 6, 18, 2, 'rgba(220,240,255,0.5)', OUTLINE, 2);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + 10, baseY - 13, 10.5, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(x - 2, baseY - 12, 24, 14);
    ctx.restore();
  }
}

function christmasTree(ctx: CanvasRenderingContext2D, cx: number, baseY: number, height: number): void {
  ctx.fillStyle = '#5b3a2a';
  ctx.fillRect(cx - 8, baseY - 26, 16, 26);
  for (let tier = 0; tier < 4; tier += 1) {
    const top = baseY - height + tier * (height * 0.2);
    const half = 26 + tier * 18;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + half, top + height * 0.32);
    ctx.lineTo(cx - half, top + height * 0.32);
    ctx.closePath();
    ctx.fillStyle = tier % 2 === 0 ? '#1f7a45' : '#25904f';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
  const random = decorRandom(cx);
  for (let index = 0; index < 18; index += 1) {
    const t = random();
    const y = baseY - height + 30 + t * (height - 60);
    const spread = 14 + t * 60;
    const color = BULB_COLORS[index % 4]!;
    glow(ctx, color, 8);
    fillCircle(ctx, cx + (random() * 2 - 1) * spread, y, 4, color);
    noGlow(ctx);
  }
  glow(ctx, '#ffc94a', 16);
  starPath(ctx, cx, baseY - height - 4, 5, 15, 7);
  ctx.fillStyle = '#ffc94a';
  ctx.fill();
  noGlow(ctx);
}

function giftPile(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  const boxes: readonly [number, number, number, string, string][] = [
    [0, 34, 30, '#d6283b', '#ffc94a'],
    [32, 28, 26, '#2fae66', '#ffffff'],
    [12, 24, 22, '#4fa3ff', '#ffc94a'],
  ];
  boxes.forEach(([dx, w, h, fill, ribbon], index) => {
    const y = index === 2 ? baseY - 30 - h : baseY - h;
    fillRoundRect(ctx, x + dx, y, w, h, 3, fill, OUTLINE, 2);
    ctx.fillStyle = ribbon;
    ctx.fillRect(x + dx + w / 2 - 3, y, 6, h);
    ctx.fillRect(x + dx, y + h / 2 - 3, w, 6);
  });
}

function drawEquipment(ctx: CanvasRenderingContext2D, w: number): void {
  const floor = WALL_HEIGHT;
  cylinderTank(ctx, 50, 130, 300, '#2de2e6');

  // Shelving with glassware
  fillRoundRect(ctx, 250, 330, 220, floor - 330, 6, '#1a3350', OUTLINE, 2);
  for (const y of [380, 450, 520]) fillRoundRect(ctx, 256, y, 208, 8, 2, '#5d7896', OUTLINE, 1.5);
  const colors = ['#8e4dff', '#ff5fa2', '#46e38a', '#ffc94a', '#2de2e6'];
  let k = 0;
  for (const y of [380, 450, 520]) {
    for (let x = 268; x < 450; x += 36) {
      glassware(ctx, x, y, k % 3, colors[k % colors.length]!);
      k += 1;
    }
  }

  // Incubator with warm glow
  fillRoundRect(ctx, 520, 400, 130, floor - 400, 8, '#c9d6e3', OUTLINE, 2.5);
  glow(ctx, '#ff9f1c', 18);
  fillRoundRect(ctx, 536, 420, 98, 90, 6, '#ffb347');
  noGlow(ctx);
  for (const y of [445, 475]) line(ctx, 540, y, 630, y, '#a35a00', 2);
  fillRoundRect(ctx, 548, 522, 74, 20, 4, '#0b1a2e', OUTLINE, 1.5);
  ctx.fillStyle = '#46e38a';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('37.0°C', 585, 537);

  // Monitor cart with growth curves
  fillRoundRect(ctx, 700, 352, 140, 96, 8, '#0b1a2e', '#8aa4bf', 4);
  ctx.beginPath();
  for (let x = 0; x <= 120; x += 4) {
    const y = 430 - 60 / (1 + Math.exp(-(x - 60) / 12));
    if (x === 0) ctx.moveTo(710 + x, y);
    else ctx.lineTo(710 + x, y);
  }
  ctx.strokeStyle = '#2de2e6';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  line(ctx, 710, 404, 830, 404, 'rgba(255,90,74,0.7)', 1.5);
  line(ctx, 770, 448, 770, floor - 20, '#5d7896', 8);
  fillRoundRect(ctx, 730, floor - 24, 80, 12, 4, '#3c5674', OUTLINE, 2);

  christmasTree(ctx, 950, floor - 4, 240);
  giftPile(ctx, 900, floor - 2);
  cylinderTank(ctx, 1080, 110, 340, '#46e38a');

  // Microscope on a stand
  fillRoundRect(ctx, 1200, 470, 60, floor - 470, 4, '#1a3350', OUTLINE, 2);
  line(ctx, 1215, 466, 1240, 420, '#e8eef5', 8);
  fillRoundRect(ctx, 1232, 404, 14, 26, 4, '#e8eef5', OUTLINE, 2);
  fillRoundRect(ctx, 1210, 458, 40, 10, 3, '#e8eef5', OUTLINE, 2);
  if (w < 1280) throw new Error('Equipment texture must be at least 1280px wide');
}

function drawBenches(ctx: CanvasRenderingContext2D): void {
  const top = 512;
  const floor = WALL_HEIGHT;
  const bench = (x: number, w: number): void => {
    fillRoundRect(ctx, x, top, w, 12, 3, '#6f879f', OUTLINE, 2);
    fillRoundRect(ctx, x + 8, top + 12, w - 16, floor - top - 12, 2, '#203a57', OUTLINE, 2);
    for (let dx = 20; dx < w - 30; dx += 70) {
      fillRoundRect(ctx, x + dx, top + 22, 52, floor - top - 30, 3, '#274566', OUTLINE, 1.5);
      fillRoundRect(ctx, x + dx + 20, top + 30, 12, 4, 2, '#8aa4bf');
    }
  };
  bench(40, 340);
  bench(600, 330);

  // Bench-top equipment
  // Microscope
  fillRoundRect(ctx, 80, top - 8, 46, 8, 3, '#e8eef5', OUTLINE, 2);
  line(ctx, 92, top - 8, 110, top - 50, '#e8eef5', 7);
  fillRoundRect(ctx, 104, top - 66, 12, 24, 3, '#e8eef5', OUTLINE, 2);
  // Test tube rack
  fillRoundRect(ctx, 160, top - 10, 70, 10, 2, '#8aa4bf', OUTLINE, 2);
  ['#8e4dff', '#ff5fa2', '#46e38a', '#ffc94a', '#2de2e6'].forEach((color, index) => {
    fillRoundRect(ctx, 166 + index * 12, top - 34, 8, 28, 4, 'rgba(220,240,255,0.6)', OUTLINE, 1.5);
    fillRoundRect(ctx, 167 + index * 12, top - 20, 6, 13, 3, color);
  });
  // Centrifuge
  fillRoundRect(ctx, 260, top - 32, 70, 32, 10, '#c9d6e3', OUTLINE, 2);
  fillEllipse(ctx, 295, top - 30, 28, 6, '#8aa4bf');
  fillCircle(ctx, 318, top - 14, 4, '#46e38a');
  // Gifts and poinsettia
  giftPile(ctx, 640, top);
  fillRoundRect(ctx, 760, top - 22, 26, 22, 4, '#d6283b', OUTLINE, 2);
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    fillEllipse(ctx, 773 + Math.cos(angle) * 12, top - 32 + Math.sin(angle) * 8, 9, 4, '#ff4d5e', angle);
  }
  fillCircle(ctx, 773, top - 32, 4, '#ffc94a');
  // Beakers
  glassware(ctx, 830, top, 2, '#2de2e6');
  glassware(ctx, 860, top, 1, '#8e4dff');
}

function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#132b47';
  ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 64) {
    for (let y = 12; y < h; y += 54) {
      ctx.fillStyle = ((x / 64 + Math.floor(y / 54)) % 2 === 0) ? '#173556' : '#122a45';
      ctx.fillRect(x + 1, y + 1, 62, 52);
    }
  }
  ctx.fillStyle = '#1e4670';
  ctx.fillRect(0, 0, w, 12);
  glow(ctx, '#2de2e6', 10);
  ctx.fillStyle = '#2de2e6';
  ctx.fillRect(0, 0, w, 3);
  noGlow(ctx);
  // Hazard tape strip
  for (let x = 0; x < w; x += 32) {
    ctx.fillStyle = '#ffc94a';
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x + 16, 12);
    ctx.lineTo(x + 8, 18);
    ctx.lineTo(x - 8, 18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, 18, w, 10);
}

function drawDeliveryStation(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Pneumatic dispatch tube
  fillRoundRect(ctx, 30, 0, 44, h - 70, 20, 'rgba(160,230,255,0.25)', '#8ff4ff', 3);
  line(ctx, 40, 10, 40, h - 80, 'rgba(255,255,255,0.4)', 3);
  // Dispatch machine
  fillRoundRect(ctx, 10, h - 90, w - 20, 88, 10, '#2a4a6b', OUTLINE, 3);
  fillRoundRect(ctx, 24, h - 76, 70, 40, 6, '#0b1a2e', '#2de2e6', 2);
  ctx.fillStyle = '#46e38a';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('READY', 59, h - 51);
  // Conveyor belt
  fillRoundRect(ctx, 100, h - 50, w - 112, 14, 7, '#1d1d26', OUTLINE, 2);
  for (let x = 108; x < w - 18; x += 16) fillCircle(ctx, x, h - 43, 3, '#5d7896');
  // Sign
  glow(ctx, '#ffc94a', 14);
  fillRoundRect(ctx, 86, 30, w - 96, 50, 10, '#d6283b', '#ffc94a', 3);
  noGlow(ctx);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px Arial';
  ctx.fillText('PRESENT', 86 + (w - 96) / 2, 52);
  ctx.fillText('DISPATCH', 86 + (w - 96) / 2, 70);
  line(ctx, 100, 80, 100, h - 90, '#8aa4bf', 5);
  line(ctx, w - 24, 80, w - 24, h - 90, '#8aa4bf', 5);
  // Lights around the sign
  for (let index = 0; index < 8; index += 1) {
    const color = BULB_COLORS[index % 4]!;
    glow(ctx, color, 8);
    fillCircle(ctx, 92 + index * ((w - 108) / 7), 26, 3.5, color);
    noGlow(ctx);
  }
}

function drawBuilding(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const roofY = 90;
  fillRoundRect(ctx, 30, roofY, w - 60, h - roofY, 6, '#1d3a5c', OUTLINE, 3);
  // Snowy roof
  ctx.beginPath();
  ctx.moveTo(14, roofY + 6);
  ctx.quadraticCurveTo(w / 2, roofY - 34, w - 14, roofY + 6);
  ctx.lineTo(w - 14, roofY + 18);
  ctx.quadraticCurveTo(w / 2, roofY - 20, 14, roofY + 18);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  // Chimney stack / vent tower
  fillRoundRect(ctx, w - 130, 20, 36, 70, 4, '#4a6582', OUTLINE, 2);
  fillRoundRect(ctx, w - 136, 14, 48, 12, 4, '#ffffff', OUTLINE, 2);
  // Windows
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const x = 62 + col * ((w - 124) / 6);
      const y = roofY + 50 + row * 80;
      glow(ctx, '#ffd36b', 14);
      fillRoundRect(ctx, x, y, 48, 44, 4, row === 1 && col === 2 ? '#8ff4ff' : '#ffd36b', OUTLINE, 2);
      noGlow(ctx);
      line(ctx, x + 24, y, x + 24, y + 44, OUTLINE, 2);
    }
  }
  // Door with wreath
  fillRoundRect(ctx, w / 2 - 34, h - 84, 68, 84, 6, '#5b3a2a', OUTLINE, 2.5);
  ctx.beginPath();
  ctx.arc(w / 2, h - 52, 14, 0, Math.PI * 2);
  ctx.strokeStyle = '#2fae66';
  ctx.lineWidth = 7;
  ctx.stroke();
  // Sign
  fillRoundRect(ctx, w / 2 - 170, roofY + 6, 340, 34, 8, '#0b1a2e', '#2de2e6', 3);
  ctx.fillStyle = '#8ff4ff';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('NORTH POLE PHARMA LABS', w / 2, roofY + 30);
  garland(ctx, w, roofY + 40, (w - 0) / 4, 14);
}

function drawMoon(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const halo = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
  halo.addColorStop(0, 'rgba(255,250,220,0.6)');
  halo.addColorStop(1, 'rgba(255,250,220,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  fillCircle(ctx, w / 2, h / 2, w * 0.28, '#fff6d8');
  fillCircle(ctx, w / 2 - 10, h / 2 - 6, 6, '#efe2b8');
  fillCircle(ctx, w / 2 + 12, h / 2 + 10, 4, '#efe2b8');
}

export function generateEnvironmentTextures(textures: Phaser.Textures.TextureManager): void {
  const env = TEXTURES.environment;
  createCanvasTexture(textures, env.night, 1024, WALL_HEIGHT, drawNight);
  createCanvasTexture(textures, env.snow, 256, 256, drawSnow);
  createCanvasTexture(textures, env.wall, 960, WALL_HEIGHT, drawWall);
  createCanvasTexture(textures, env.equipment, 1280, WALL_HEIGHT, (ctx, w) => drawEquipment(ctx, w));
  createCanvasTexture(textures, env.benches, 1024, WALL_HEIGHT, drawBenches);
  createCanvasTexture(textures, env.floor, 256, GAME_HEIGHT - LAYOUT.groundY, drawFloor);
  createCanvasTexture(textures, env.deliveryStation, 230, 270, drawDeliveryStation);
  createCanvasTexture(textures, env.building, 620, 380, drawBuilding);
  createCanvasTexture(textures, env.moon, 140, 140, drawMoon);
}

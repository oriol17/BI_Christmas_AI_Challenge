export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function inverseLerp(from: number, to: number, value: number): number {
  if (from === to) return 0;
  return clamp((value - from) / (to - from), 0, 1);
}

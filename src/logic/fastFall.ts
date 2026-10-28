export function getFastFallAcceleration(
  airborne: boolean,
  downHeld: boolean,
  velocityY: number,
  targetVelocity: number,
  acceleration: number,
): number {
  return airborne && downHeld && velocityY < targetVelocity ? acceleration : 0;
}

export function clampFallVelocity(velocityY: number, maximumFallSpeed: number): number {
  return Math.min(velocityY, maximumFallSpeed);
}

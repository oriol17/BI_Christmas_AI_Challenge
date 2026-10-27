import type { BalanceConfig } from '../config/balance';

export interface ScoreInput {
  readonly distanceMeters: number;
  readonly cookies: number;
  readonly presents: number;
}

export interface ScoreBreakdown {
  readonly distancePoints: number;
  readonly cookiePoints: number;
  readonly deliveryPoints: number;
  readonly total: number;
}

export function calculateScoreBreakdown(input: ScoreInput, balance: BalanceConfig): ScoreBreakdown {
  const distancePoints = Math.floor(Math.max(0, input.distanceMeters) * balance.scoring.pointsPerMeter);
  const cookiePoints = Math.max(0, input.cookies) * balance.cookies.score;
  const deliveryPoints = Math.max(0, input.presents) * balance.deliveries.score;
  return {
    distancePoints,
    cookiePoints,
    deliveryPoints,
    total: distancePoints + cookiePoints + deliveryPoints,
  };
}

export function calculateScore(input: ScoreInput, balance: BalanceConfig): number {
  return calculateScoreBreakdown(input, balance).total;
}

/** Number of delivery checkpoints passed when moving from `previousMeters` to `currentMeters`. */
export function countCheckpointsCrossed(previousMeters: number, currentMeters: number, intervalMeters: number): number {
  if (intervalMeters <= 0 || currentMeters <= previousMeters) return 0;
  const before = Math.floor(Math.max(0, previousMeters) / intervalMeters);
  const after = Math.floor(Math.max(0, currentMeters) / intervalMeters);
  return Math.max(0, after - before);
}

/** Distance of the next checkpoint strictly ahead of `distanceMeters`. */
export function nextCheckpointDistance(distanceMeters: number, intervalMeters: number): number {
  if (intervalMeters <= 0) return Number.POSITIVE_INFINITY;
  return (Math.floor(Math.max(0, distanceMeters) / intervalMeters) + 1) * intervalMeters;
}

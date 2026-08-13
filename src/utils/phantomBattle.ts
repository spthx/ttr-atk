import type { Property } from '../types';
import {
  SAVAGE_RAID_DEFINITIONS,
  type SavageRaidDefinition,
} from './savage';

export const PHANTOM_TRADE_DUTY = {
  name: '幻・商戦',
  subtitle: '過去の零式を、絶相当の基礎力で',
  description:
    '商戦 零式の全12層から一戦ごとに相手を抽選します。層固有のギミックはそのまま、競合の基礎資本と判断速度だけが絶相当へ引き上がります。',
} as const;

export const normalizePhantomWinStreak = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value)));
};

const normalizeRandomUnit = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1 - Number.EPSILON, Math.max(0, value));
};

/**
 * Uniformly chooses one of the authored twelve Savage encounters. Supplying
 * the random source keeps balance and migration checks deterministic.
 */
export const pickRandomPhantomRaid = (
  random: () => number = Math.random
): SavageRaidDefinition => {
  const index = Math.floor(
    normalizeRandomUnit(random()) * SAVAGE_RAID_DEFINITIONS.length
  );
  return SAVAGE_RAID_DEFINITIONS[index];
};

export const findPhantomProperty = (
  savageProperties: readonly Property[],
  raidId: string
) => savageProperties.find((property) => property.id === raidId) ?? null;

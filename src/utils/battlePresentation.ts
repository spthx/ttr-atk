import type { BattlePhase } from '../types';

export const getCapitalVisualStage = (amount: number) => {
  if (amount <= 0) return 0;
  if (amount < 500) return 1;
  if (amount < 2_500) return 2;
  if (amount < 10_000) return 3;
  if (amount < 50_000) return 4;
  if (amount < 250_000) return 5;
  if (amount < 2_500_000) return 6;
  return 7;
};

export const shouldInertBattleFooter = (
  backgroundInert: boolean,
  hasWinner: boolean,
  battlePhase: BattlePhase
) =>
  backgroundInert &&
  !(hasWinner && battlePhase === 'finisher_notice');

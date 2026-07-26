import type { BattlePhase } from '../types';

export const BATTLE_CINEMATIC_TIMING = {
  startAnnouncementMs: 3_800,
  conditionAnnouncementMs: 1_650,
  shortDelayMs: 420,
  shortNoticeMs: 3_200,
  finalAnnouncementMs: 1_200,
  finalDecisiveStartMs: 1_400,
  limitAnnouncementMs: 1_800,
  limitResolveMs: 1_850,
  limitTerminalImpactMs: 650,
  decisiveImpactMs: 420,
  decisiveClearMs: 1_400,
  decisiveResolveMs: 1_800,
  finishNoticeMs: 1_450,
} as const;

export const getCapitalVisualStage = (amount: number) => {
  if (amount <= 0) return 0;
  if (amount < 500) return 1;
  if (amount < 5_000) return 2;
  if (amount < 50_000) return 3;
  if (amount < 500_000) return 4;
  if (amount < 10_000_000) return 5;
  if (amount < 1_000_000_000) return 6;
  return 7;
};

const CAPITAL_VISUAL_BUNDLE_COUNTS = [0, 1, 2, 3, 5, 7, 10, 13] as const;

export const getCapitalVisualBundleCount = (stage: number) =>
  CAPITAL_VISUAL_BUNDLE_COUNTS[
    Math.max(0, Math.min(CAPITAL_VISUAL_BUNDLE_COUNTS.length - 1, Math.floor(stage)))
  ];

const CAPITAL_VISUAL_STAGE_RANGES = [
  null,
  { minimum: 1, maximum: 499, minimumBundles: 1, maximumBundles: 1 },
  { minimum: 500, maximum: 4_999, minimumBundles: 2, maximumBundles: 3 },
  { minimum: 5_000, maximum: 49_999, minimumBundles: 3, maximumBundles: 5 },
  { minimum: 50_000, maximum: 499_999, minimumBundles: 5, maximumBundles: 7 },
  { minimum: 500_000, maximum: 9_999_999, minimumBundles: 7, maximumBundles: 9 },
  { minimum: 10_000_000, maximum: 999_999_999, minimumBundles: 9, maximumBundles: 12 },
  { minimum: 1_000_000_000, maximum: Number.POSITIVE_INFINITY, minimumBundles: 13, maximumBundles: 13 },
] as const;

/**
 * Absolute capital controls the spectacle across the full campaign, while
 * interpolation inside each stage lets repeated investments visibly add
 * bundles instead of jumping straight to a completed pile.
 */
export const getCapitalVisualBundleCountForAmount = (amount: number) => {
  const normalizedAmount = Math.max(0, amount);
  const stage = getCapitalVisualStage(normalizedAmount);
  if (stage === 0) return 0;

  const range = CAPITAL_VISUAL_STAGE_RANGES[stage];
  if (!range || range.minimumBundles === range.maximumBundles) {
    return range?.minimumBundles ?? 0;
  }

  const logarithmicMinimum = Math.log10(range.minimum);
  const logarithmicMaximum = Math.log10(range.maximum);
  const progress = Math.max(
    0,
    Math.min(
      1,
      (Math.log10(normalizedAmount) - logarithmicMinimum) /
        Math.max(0.0001, logarithmicMaximum - logarithmicMinimum)
    )
  );

  return Math.min(
    range.maximumBundles,
    range.minimumBundles +
      Math.floor(progress * (range.maximumBundles - range.minimumBundles + 1))
  );
};

export const shouldInertBattleFooter = (
  backgroundInert: boolean,
  hasWinner: boolean,
  battlePhase: BattlePhase
) =>
  backgroundInert &&
  !(hasWinner && battlePhase === 'finisher_notice');

export type BattleCinematicLayer =
  | 'battle_announcement'
  | 'condition_announcement'
  | 'short'
  | 'decisive'
  | 'finish'
  | null;

/**
 * Full-screen battle cues are deliberately exclusive. State timers may finish
 * on adjacent frames, but the player must never have to read stacked SHORT,
 * action, decisive and result cards at the same time.
 */
export const getBattleCinematicLayer = ({
  battlePhase,
  hasBattleAnnouncement,
  hasConditionAnnouncement,
  hasDecisiveBlow,
  hasWinner,
  finishTelegraphVisible,
}: {
  battlePhase: BattlePhase;
  hasBattleAnnouncement: boolean;
  hasConditionAnnouncement: boolean;
  hasDecisiveBlow: boolean;
  hasWinner: boolean;
  finishTelegraphVisible: boolean;
}): BattleCinematicLayer => {
  if (hasDecisiveBlow || battlePhase === 'decisive') return 'decisive';
  if (
    battlePhase === 'finisher_notice' &&
    hasWinner &&
    finishTelegraphVisible
  ) {
    return 'finish';
  }
  if (battlePhase === 'short_notice') return 'short';
  if (hasBattleAnnouncement) return 'battle_announcement';
  if (battlePhase === 'active' && hasConditionAnnouncement) {
    return 'condition_announcement';
  }
  return null;
};

export const canShowShortNotice = ({
  battlePhase,
  ended,
  decisive,
}: {
  battlePhase: BattlePhase;
  ended: boolean;
  decisive: boolean;
}) => battlePhase === 'active' && !ended && !decisive;

import type { BattlePhase } from '../types';

export const BATTLE_CINEMATIC_TIMING = {
  startAnnouncementMs: 3_800,
  conditionAnnouncementMs: 1_650,
  limitAnnouncementMs: 1_800,
  limitResolveMs: 1_850,
  finishNoticeMs: 1_450,
} as const;

export const RESULT_CONFIRM_ARM_DELAY_MS = 1_200;
export const BATTLE_GAUGE_VISUAL_COMMIT_MS = 100;

/**
 * One terminal sequence owns the final offer, impact and result reveal.
 * Simulation code must latch the winner before this sequence starts and must
 * not use these stages as additional chances to mutate battle state.
 */
export const TERMINAL_CINEMATIC_TIMING = {
  anticipationMs: 1_200,
  impactMs: 520,
  resolutionMs: 900,
  totalMs: 2_620,
  reducedMotionAnticipationMs: 180,
  reducedMotionImpactMs: 140,
  reducedMotionResolutionMs: 600,
  reducedMotionTotalMs: 920,
} as const;

export type TerminalCinematicStage =
  | 'anticipation'
  | 'impact'
  | 'resolution'
  | 'complete';

export interface TerminalCinematicPresentation {
  stage: TerminalCinematicStage;
  timeScale: 0 | 0.1;
  showImpact: boolean;
  showResolution: boolean;
  suppressAmbientEffects: boolean;
  complete: boolean;
}

/**
 * Pure timeline projection for the single terminal cinematic.
 *
 * `elapsedMs` is measured from the instant the terminal winner is latched.
 * Reduced-motion keeps the readable resolution card while replacing the
 * moving anticipation and impact with short, static beats.
 */
export const getTerminalCinematicPresentation = (
  elapsedMs: number,
  reducedMotion = false
): TerminalCinematicPresentation => {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const anticipationEnd = reducedMotion
    ? TERMINAL_CINEMATIC_TIMING.reducedMotionAnticipationMs
    : TERMINAL_CINEMATIC_TIMING.anticipationMs;
  const impactEnd =
    anticipationEnd +
    (reducedMotion
      ? TERMINAL_CINEMATIC_TIMING.reducedMotionImpactMs
      : TERMINAL_CINEMATIC_TIMING.impactMs);
  const resolutionEnd =
    impactEnd +
    (reducedMotion
      ? TERMINAL_CINEMATIC_TIMING.reducedMotionResolutionMs
      : TERMINAL_CINEMATIC_TIMING.resolutionMs);

  if (elapsed < anticipationEnd) {
    return {
      stage: 'anticipation',
      timeScale: 0.1,
      showImpact: false,
      showResolution: false,
      suppressAmbientEffects: true,
      complete: false,
    };
  }

  if (elapsed < impactEnd) {
    return {
      stage: 'impact',
      timeScale: 0,
      showImpact: true,
      showResolution: false,
      suppressAmbientEffects: true,
      complete: false,
    };
  }

  if (elapsed < resolutionEnd) {
    return {
      stage: 'resolution',
      timeScale: 0,
      showImpact: false,
      showResolution: true,
      suppressAmbientEffects: true,
      complete: false,
    };
  }

  return {
    stage: 'complete',
    timeScale: 0,
    showImpact: false,
    showResolution: true,
    suppressAmbientEffects: true,
    complete: true,
  };
};

export const BATTLE_STATUS_MESSAGE_DURATION_MS = 1_650;
export const BATTLE_STATUS_MESSAGE_MAX_CHARS_PER_LINE = 32;

export const enqueueBattleStatusMessage = <
  T extends { text: string; priority: number },
>(
  current: readonly T[],
  next: T,
  activeText: string | null = null,
  maximum = 6
) => {
  if (
    activeText === next.text ||
    current.some((item) => item.text === next.text)
  ) {
    return [...current];
  }
  return [...current, next]
    .sort((left, right) => right.priority - left.priority)
    .slice(0, maximum);
};

export type BattleStatusMessageTone =
  | 'neutral'
  | 'ally'
  | 'enemy'
  | 'chaos';

export interface BattleStatusMessageCandidate {
  id: string;
  text: string;
  tone: BattleStatusMessageTone;
  terminal?: boolean;
  createdAt: number;
}

const BATTLE_STATUS_MESSAGE_PRIORITY: Record<
  BattleStatusMessageTone,
  number
> = {
  neutral: 0,
  ally: 1,
  chaos: 2,
  enemy: 2,
};

/**
 * A status window has room for two short lines. Sanitising at the presentation
 * boundary prevents long log text from turning it into a second battle log.
 */
export const normalizeBattleStatusMessageText = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((line) =>
      line.length > BATTLE_STATUS_MESSAGE_MAX_CHARS_PER_LINE
        ? `${line.slice(0, BATTLE_STATUS_MESSAGE_MAX_CHARS_PER_LINE - 1)}…`
        : line
    )
    .join('\n');

/**
 * Selects exactly one notice. Terminal beats outrank danger, danger/chaos
 * outrank positive news, and newer notices win ties.
 */
export const selectBattleStatusMessage = (
  candidates: readonly BattleStatusMessageCandidate[]
): BattleStatusMessageCandidate | null =>
  candidates.reduce<BattleStatusMessageCandidate | null>((selected, candidate) => {
    if (!selected) return candidate;
    const selectedPriority = selected.terminal
      ? 3
      : BATTLE_STATUS_MESSAGE_PRIORITY[selected.tone];
    const candidatePriority = candidate.terminal
      ? 3
      : BATTLE_STATUS_MESSAGE_PRIORITY[candidate.tone];
    if (candidatePriority !== selectedPriority) {
      return candidatePriority > selectedPriority ? candidate : selected;
    }
    return candidate.createdAt >= selected.createdAt ? candidate : selected;
  }, null);

export const canConfirmBattleResult = ({
  battlePhase,
  hasWinner,
  armed,
  alreadyConfirmed,
}: {
  battlePhase: BattlePhase;
  hasWinner: boolean;
  armed: boolean;
  alreadyConfirmed: boolean;
}) =>
  battlePhase === 'result' &&
  hasWinner &&
  armed &&
  !alreadyConfirmed;

export const getVictoryConfettiParticleCount = (
  viewportWidth: number,
  reducedMotion: boolean
) => {
  if (reducedMotion) return 0;
  // Canvas confetti can force an iPad WebContent reload when it overlaps the
  // terminal field animations. Compact/tablet finishes use the CSS resolution
  // beat only; the richer particle finish remains on desktop.
  return viewportWidth <= 1024 ? 0 : 110;
};

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

const BATTLE_CAPITAL_RATIO_THRESHOLDS = [
  0.12,
  0.28,
  0.5,
  0.8,
  1.15,
  1.55,
  2,
  2.6,
  3.4,
  4.4,
  5.7,
  7.5,
] as const;

/**
 * Live battles need to show the act of stacking capital, not the campaign's
 * nominal gil scale. A first offer therefore starts with one visible bundle
 * in every chapter, while a pre-funded opponent remains a modest pile.
 * Repeated over-investment can still grow into the full thirteen-piece wall.
 */
export const getBattleCapitalVisualBundleCount = (
  amount: number,
  marketPrice: number
) => {
  const normalizedAmount = Math.max(0, amount);
  if (normalizedAmount <= 0) return 0;

  const ratio = normalizedAmount / Math.max(1, marketPrice);
  const thresholdIndex = BATTLE_CAPITAL_RATIO_THRESHOLDS.findIndex(
    (threshold) => ratio <= threshold
  );
  const baseBundleCount = thresholdIndex < 0
    ? CAPITAL_VISUAL_BUNDLE_COUNTS.at(-1) ?? 13
    : thresholdIndex + 1;
  if (baseBundleCount <= 1) return baseBundleCount;

  const campaignScaleBonus =
    marketPrice >= 1_000_000_000 ? 2 : marketPrice >= 10_000_000 ? 1 : 0;
  return Math.min(13, baseBundleCount + campaignScaleBonus);
};

export const getCapitalVisualStageForBundleCount = (bundleCount: number) => {
  // The live field owns thirteen distinct capital beats. Do not collapse them
  // into seven visual classes: a player should see every additional offer
  // build the mound, while the DOM renderer remains capped separately.
  return Math.max(0, Math.min(13, Math.floor(bundleCount)));
};

/**
 * A detailed hoard does not need one DOM image per visible bundle. Five
 * foreground sprites plus the CSS-composited mound bands preserve the staged
 * silhouette while keeping mobile paint and layout work bounded.
 */
export const getCapitalVisualSpriteCount = (bundleCount: number) =>
  Math.max(0, Math.min(5, Math.floor(bundleCount)));

export const shouldInertBattleFooter = (
  backgroundInert: boolean,
  hasWinner: boolean,
  battlePhase: BattlePhase
) =>
  backgroundInert &&
  !(hasWinner && battlePhase === 'finisher_notice');

export type BattleCinematicLayer =
  | 'battle_announcement'
  | 'decisive'
  | 'finish'
  | null;

/**
 * Full-screen battle cues are deliberately exclusive. State timers may finish
 * on adjacent frames, but the player must never have to read stacked action,
 * decisive and result cards at the same time.
 */
export const getBattleCinematicLayer = ({
  battlePhase,
  hasBattleAnnouncement,
  hasDecisiveBlow,
  hasWinner,
  finishTelegraphVisible,
}: {
  battlePhase: BattlePhase;
  hasBattleAnnouncement: boolean;
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
  if (hasBattleAnnouncement) return 'battle_announcement';
  return null;
};

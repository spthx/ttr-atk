import type { BattlePhase } from '../types';

export const BATTLE_CINEMATIC_TIMING = {
  startAnnouncementMs: 3_800,
  conditionAnnouncementMs: 1_650,
  limitAnnouncementMs: 1_800,
  limitResolveMs: 1_850,
  limitImpactHandoffMs: 650,
  finishNoticeMs: 1_450,
} as const;

export const RESULT_CONFIRM_ARM_DELAY_MS = 1_200;
export const BATTLE_GAUGE_VISUAL_COMMIT_MS = 100;
export const LIGHTWEIGHT_GAUGE_FRAME_MS = 1_000 / 30;

export const BATTLE_HIT_STOP_TIMING = {
  standardMs: 55,
  heavyMs: 78,
  lightweightStandardMs: 38,
  lightweightHeavyMs: 52,
  releaseMs: 230,
  lightweightReleaseMs: 150,
} as const;

export const getBattleHitStopTiming = (
  heavy = false,
  lightweightMode = false
) => ({
  hitStopMs: lightweightMode
    ? heavy
      ? BATTLE_HIT_STOP_TIMING.lightweightHeavyMs
      : BATTLE_HIT_STOP_TIMING.lightweightStandardMs
    : heavy
      ? BATTLE_HIT_STOP_TIMING.heavyMs
      : BATTLE_HIT_STOP_TIMING.standardMs,
  releaseMs: lightweightMode
    ? BATTLE_HIT_STOP_TIMING.lightweightReleaseMs
    : BATTLE_HIT_STOP_TIMING.releaseMs,
});

export type CapitalCommitTier = 'small' | 'medium' | 'heavy';
export type CapitalCommitStage =
  | 'prepare'
  | 'travel'
  | 'impact'
  | 'afterglow';

export interface CapitalCommitTiming {
  tier: CapitalCommitTier;
  prepareMs: number;
  travelMs: number;
  hitStopMs: number;
  settleMs: number;
  afterglowMs: number;
  totalMs: number;
}

const CAPITAL_COMMIT_TIMINGS: Record<
  'standard' | 'compact',
  Record<CapitalCommitTier, Omit<CapitalCommitTiming, 'tier'>>
> = {
  standard: {
    small: {
      prepareMs: 150,
      travelMs: 170,
      hitStopMs: 55,
      settleMs: 420,
      afterglowMs: 320,
      totalMs: 1_115,
    },
    medium: {
      prepareMs: 190,
      travelMs: 210,
      hitStopMs: 64,
      settleMs: 480,
      afterglowMs: 360,
      totalMs: 1_304,
    },
    heavy: {
      prepareMs: 300,
      travelMs: 320,
      hitStopMs: 88,
      settleMs: 610,
      afterglowMs: 520,
      totalMs: 1_838,
    },
  },
  compact: {
    small: {
      prepareMs: 90,
      travelMs: 110,
      hitStopMs: 38,
      settleMs: 250,
      afterglowMs: 200,
      totalMs: 688,
    },
    medium: {
      prepareMs: 100,
      travelMs: 125,
      hitStopMs: 45,
      settleMs: 280,
      afterglowMs: 220,
      totalMs: 770,
    },
    heavy: {
      prepareMs: 120,
      travelMs: 150,
      hitStopMs: 52,
      settleMs: 320,
      afterglowMs: 260,
      totalMs: 902,
    },
  },
};

/**
 * Direct investment is the game's primary reward beat. Small offers stay
 * light, while all-in offers receive a longer wind-up and afterglow. The
 * timeline only changes presentation; battle state is still committed once,
 * synchronously, by the caller.
 */
export const getCapitalCommitTiming = (
  investmentLevel: number,
  compact = false
): CapitalCommitTiming => {
  const level = Math.max(1, Math.min(5, Math.round(investmentLevel)));
  const tier: CapitalCommitTier =
    level <= 2 ? 'small' : level === 3 ? 'medium' : 'heavy';
  return {
    tier,
    ...CAPITAL_COMMIT_TIMINGS[compact ? 'compact' : 'standard'][tier],
  };
};

export const shouldProcessGaugeFrame = (
  elapsedMs: number,
  lightweightMode: boolean
) =>
  !lightweightMode ||
  Math.max(0, elapsedMs) + Number.EPSILON >= LIGHTWEIGHT_GAUGE_FRAME_MS;

/**
 * Skills read as a short chain of deliberate beats instead of one crowded
 * frame: name card, actor wind-up, impact, then a brief readable result.
 */
export const SKILL_CINEMATIC_TIMING = {
  nameMs: 320,
  castMs: 340,
  hitStopMs: 80,
  impactMs: 280,
  resolveMs: 260,
  totalMs: 1_280,
} as const;

export const LIGHTWEIGHT_SKILL_CINEMATIC_TIMING = {
  nameMs: 180,
  castMs: 180,
  hitStopMs: 40,
  impactMs: 140,
  resolveMs: 180,
  totalMs: 720,
} as const;

export type SkillCinematicStage =
  | 'name'
  | 'cast'
  | 'hitstop'
  | 'impact'
  | 'resolve';

export const getSkillCinematicTiming = (compact = false) =>
  compact
    ? LIGHTWEIGHT_SKILL_CINEMATIC_TIMING
    : SKILL_CINEMATIC_TIMING;

export const getNextBattleSkillId = (
  skillIds: readonly string[],
  currentSkillId: string | null,
  direction = 1
) => {
  if (skillIds.length === 0) return null;
  const currentIndex = currentSkillId
    ? skillIds.indexOf(currentSkillId)
    : -1;
  const offset = direction >= 0 ? 1 : -1;
  if (currentIndex < 0) {
    return offset > 0 ? skillIds[0] : skillIds[skillIds.length - 1];
  }
  return skillIds[
    (currentIndex + offset + skillIds.length) % skillIds.length
  ];
};

/**
 * One terminal sequence owns the final offer, impact and result reveal.
 * Simulation code must latch the winner before this sequence starts and must
 * not use these stages as additional chances to mutate battle state.
 */
export const TERMINAL_CINEMATIC_TIMING = {
  anticipationMs: 1_000,
  hitStopMs: 90,
  impactMs: 420,
  resolutionMs: 900,
  totalMs: 2_410,
  reducedMotionAnticipationMs: 140,
  reducedMotionHitStopMs: 40,
  reducedMotionImpactMs: 120,
  reducedMotionResolutionMs: 520,
  reducedMotionTotalMs: 820,
} as const;

export type TerminalCinematicStage =
  | 'anticipation'
  | 'hitstop'
  | 'impact'
  | 'resolution'
  | 'complete';

export interface TerminalCinematicPresentation {
  stage: TerminalCinematicStage;
  timeScale: 0;
  showImpact: boolean;
  showResolution: boolean;
  suppressAmbientEffects: boolean;
  complete: boolean;
}

/**
 * Pure timeline projection for the single terminal cinematic.
 *
 * `elapsedMs` is measured from the instant the terminal winner is latched.
 * Every stage freezes simulation so presentation mode cannot alter battle
 * results. Reduced-motion keeps the readable resolution card while replacing
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
  const hitStopEnd =
    anticipationEnd +
    (reducedMotion
      ? TERMINAL_CINEMATIC_TIMING.reducedMotionHitStopMs
      : TERMINAL_CINEMATIC_TIMING.hitStopMs);
  const impactEnd =
    hitStopEnd +
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
      timeScale: 0,
      showImpact: false,
      showResolution: false,
      suppressAmbientEffects: true,
      complete: false,
    };
  }

  if (elapsed < impactEnd) {
    if (elapsed < hitStopEnd) {
      return {
        stage: 'hitstop',
        timeScale: 0,
        showImpact: true,
        showResolution: false,
        suppressAmbientEffects: true,
        complete: false,
      };
    }
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
  reducedMotion: boolean,
  lightweightMode = false
) => {
  if (reducedMotion || lightweightMode) return 0;
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
 * Repeated over-investment can still reach the twelfth and final visual beat.
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
  // The live field owns twelve decorative beats (0-11). Capital may keep
  // growing numerically after the last beat, but the mound itself stays
  // bounded and uses glow/motion for over-cap investment.
  return Math.max(0, Math.min(11, Math.floor(bundleCount)));
};

/**
 * A detailed hoard does not need one DOM image per visible bundle. Five
 * foreground sprites plus the CSS-composited mound bands preserve the staged
 * silhouette while keeping mobile paint and layout work bounded.
 */
export const getCapitalVisualSpriteCount = (bundleCount: number) =>
  Math.max(0, Math.min(5, Math.floor(bundleCount)));

export const CAPITAL_PRIMARY_DROP_COUNT = 1;
export const CAPITAL_OVERFLOW_PARTICLE_COUNT = 7;
export const CAPITAL_DELUGE_PARTICLE_COUNT = 8;
export const MAX_CAPITAL_DROP_PARTICLE_COUNT = 16;

/**
 * The carried stake is one readable cargo silhouette, never a coin-per-value
 * pile. Its sprite and scale communicate the selected level; the bounded
 * 0-11 hoard remains the place where accumulated capital is shown.
 */
export const getInvestmentStakeVisualPieceCount = (_level: number) => 1;

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

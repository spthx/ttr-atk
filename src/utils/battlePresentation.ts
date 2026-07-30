import type { BattlePhase } from '../types';
import type { BossAbilityTier } from './gameBalance';

export const BATTLE_CINEMATIC_TIMING = {
  startAnnouncementMs: 3_800,
  conditionAnnouncementMs: 1_650,
  limitAnnouncementMs: 1_900,
  limitResolveMs: 2_300,
  limitImpactHandoffMs: 800,
  finishNoticeMs: 1_450,
} as const;

export const RESULT_CONFIRM_ARM_DELAY_MS = 1_200;
export const BATTLE_GAUGE_VISUAL_COMMIT_MS = 100;
export const BATTLE_STATE_UPDATE_INTERVAL_MS = 100;
export type BattleFrameRate = 30 | 60;
export const BATTLE_GAUGE_FRAME_MS: Record<BattleFrameRate, number> = {
  30: 1_000 / 30,
  60: 1_000 / 60,
};

export const getBossEnemyPartySize = ({
  bossAbilityTier,
  isSavage = false,
  isUltimate = false,
}: {
  bossAbilityTier: BossAbilityTier;
  isSavage?: boolean;
  isUltimate?: boolean;
}) => {
  if (bossAbilityTier === 'none') return 1;
  if (
    isSavage ||
    isUltimate ||
    bossAbilityTier === 'enhanced_cover' ||
    bossAbilityTier === 'invincible'
  ) {
    return 3;
  }
  return 2;
};

export const BATTLE_HIT_STOP_TIMING = {
  standardMs: 55,
  heavyMs: 78,
  reducedMotionStandardMs: 38,
  reducedMotionHeavyMs: 52,
  releaseMs: 230,
  reducedMotionReleaseMs: 150,
} as const;

export const getBattleHitStopTiming = (
  heavy = false,
  reducedMotion = false
) => ({
  hitStopMs: reducedMotion
    ? heavy
      ? BATTLE_HIT_STOP_TIMING.reducedMotionHeavyMs
      : BATTLE_HIT_STOP_TIMING.reducedMotionStandardMs
    : heavy
      ? BATTLE_HIT_STOP_TIMING.heavyMs
      : BATTLE_HIT_STOP_TIMING.standardMs,
  releaseMs: reducedMotion
    ? BATTLE_HIT_STOP_TIMING.reducedMotionReleaseMs
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
      prepareMs: 220,
      travelMs: 240,
      hitStopMs: 55,
      settleMs: 590,
      afterglowMs: 480,
      totalMs: 1_585,
    },
    medium: {
      prepareMs: 280,
      travelMs: 300,
      hitStopMs: 64,
      settleMs: 700,
      afterglowMs: 570,
      totalMs: 1_914,
    },
    heavy: {
      prepareMs: 400,
      travelMs: 440,
      hitStopMs: 88,
      settleMs: 860,
      afterglowMs: 760,
      totalMs: 2_548,
    },
  },
  compact: {
    small: {
      prepareMs: 120,
      travelMs: 140,
      hitStopMs: 38,
      settleMs: 360,
      afterglowMs: 242,
      totalMs: 900,
    },
    medium: {
      prepareMs: 150,
      travelMs: 170,
      hitStopMs: 45,
      settleMs: 430,
      afterglowMs: 355,
      totalMs: 1_150,
    },
    heavy: {
      prepareMs: 190,
      travelMs: 210,
      hitStopMs: 52,
      settleMs: 600,
      afterglowMs: 448,
      totalMs: 1_500,
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
  frameRate: BattleFrameRate
) =>
  Math.max(0, elapsedMs) + 0.5 >= BATTLE_GAUGE_FRAME_MS[frameRate];

/**
 * Skills read as a short chain of deliberate beats instead of one crowded
 * frame: name card, actor wind-up, impact, then a brief readable result.
 */
export const SKILL_CINEMATIC_TIMING = {
  nameMs: 420,
  castMs: 460,
  hitStopMs: 90,
  impactMs: 360,
  resolveMs: 420,
  totalMs: 1_750,
} as const;

export const REDUCED_MOTION_SKILL_CINEMATIC_TIMING = {
  nameMs: 210,
  castMs: 220,
  hitStopMs: 42,
  impactMs: 180,
  resolveMs: 260,
  totalMs: 912,
} as const;

export type SkillCinematicStage =
  | 'name'
  | 'cast'
  | 'hitstop'
  | 'impact'
  | 'resolve';

export const getSkillCinematicTiming = (reducedMotion = false) =>
  reducedMotion
    ? REDUCED_MOTION_SKILL_CINEMATIC_TIMING
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

export const resolveBattleSkillSelection = (
  usableEquippedIds: readonly string[],
  _usableAvailableIds: readonly string[],
  selectedSkillId: string | null
) => {
  const poolIds = [...usableEquippedIds];
  const resolvedSelectedId =
    selectedSkillId && poolIds.includes(selectedSkillId)
      ? selectedSkillId
      : poolIds[0] ?? null;

  return {
    poolIds,
    selectedSkillId: resolvedSelectedId,
    usingFallback: false,
  };
};

/**
 * One terminal sequence owns the final offer, impact and result reveal.
 * Simulation code must latch the winner before this sequence starts and must
 * not use these stages as additional chances to mutate battle state.
 */
export const TERMINAL_CINEMATIC_TIMING = {
  anticipationMs: 1_250,
  hitStopMs: 120,
  impactMs: 720,
  fanfareLeadMs: 320,
  resolutionMs: 1_200,
  totalMs: 3_610,
  reducedMotionAnticipationMs: 180,
  reducedMotionHitStopMs: 50,
  reducedMotionImpactMs: 180,
  reducedMotionFanfareLeadMs: 100,
  reducedMotionResolutionMs: 620,
  reducedMotionTotalMs: 1_130,
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
      ? TERMINAL_CINEMATIC_TIMING.reducedMotionFanfareLeadMs
      : TERMINAL_CINEMATIC_TIMING.fanfareLeadMs) +
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

export const BATTLE_CAPITAL_VISUAL_STAGE_COUNT = 60;
export const MAX_BATTLE_CAPITAL_VISUAL_STAGE =
  BATTLE_CAPITAL_VISUAL_STAGE_COUNT - 1;

const BATTLE_CAPITAL_RATIO_THRESHOLDS = [
  ...Array.from(
    { length: 50 },
    (_, index) => Number(((index + 1) * 0.05).toFixed(2))
  ),
  2.7,
  2.9,
  3.1,
  3.4,
  3.8,
  4.4,
  5.2,
  6.2,
  Number.POSITIVE_INFINITY,
] as const;

/**
 * Live battles need to show the act of stacking capital, not the campaign's
 * nominal gil scale. A small first offer starts sparsely in every chapter,
 * while a standard ten-percent offer exposes two compact beats. Five-percent
 * steps stay legible through 250% of the asking price; the last nine stages
 * cover late-raid overcapital without enlarging a bundle. These are logical
 * paint states, not images or amount-proportional DOM nodes.
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
    ? BATTLE_CAPITAL_RATIO_THRESHOLDS.length
    : thresholdIndex + 1;
  return Math.min(BATTLE_CAPITAL_RATIO_THRESHOLDS.length, baseBundleCount);
};

export const getCapitalVisualStageForBundleCount = (bundleCount: number) => {
  // The live field owns sixty logical beats (0-59). Capital may keep growing
  // numerically after the last beat, while the mound retains fixed DOM caps.
  return Math.max(
    0,
    Math.min(MAX_BATTLE_CAPITAL_VISUAL_STAGE, Math.floor(bundleCount))
  );
};

/**
 * Small painted bundles read as a growing treasury better than a handful of
 * oversized props. Eight foreground sprites plus six already-mounted formation
 * slots provide close-up depth. Three repeated, clipped background bands carry
 * the sixty fine-grained width changes without creating one node per coin or
 * per gil amount.
 */
export const getCapitalVisualSpriteCount = (bundleCount: number) => {
  const stage = Math.max(0, Math.floor(bundleCount));
  if (stage === 0) return 0;
  if (stage <= 4) return 1;
  return Math.min(8, 1 + Math.ceil((stage - 4) / 8));
};

export const getCapitalFormationPieceCount = (stage: number) =>
  Math.max(0, Math.min(6, Math.floor((Math.max(0, stage) + 1) / 10)));

export const getCapitalHoardBandCount = (stage: number) =>
  stage < 1 ? 0 : stage < 3 ? 1 : stage < 6 ? 2 : 3;

const CAPITAL_HOARD_ROW_SEQUENCE = [
  ...Array.from(
    { length: 8 },
    () => ['near', 'near', 'mid', 'near', 'mid', 'far'] as const
  ).flat(),
  'far',
  'mid',
  'far',
  'mid',
  'far',
  'mid',
  'far',
  'mid',
  'far',
  'far',
  'far',
] as const;

const CAPITAL_HOARD_FILL_STAGES = Array.from(
  { length: BATTLE_CAPITAL_VISUAL_STAGE_COUNT },
  (_, stage) => {
    const counts = { near: 0, mid: 0, far: 0 };
    CAPITAL_HOARD_ROW_SEQUENCE
      .slice(0, stage)
      .forEach((row) => {
        counts[row] += 1;
      });
    return {
      near: counts.near / 24,
      mid: counts.mid / 20,
      far: counts.far / 15,
    } as const;
  }
);

export const getCapitalHoardFillRatios = (stage: number) => {
  const normalizedStage = getCapitalVisualStageForBundleCount(stage);
  return CAPITAL_HOARD_FILL_STAGES[normalizedStage];
};

/**
 * Builds a bounded monotonic sequence for the painted pile during one landing.
 * It is independent from gil amount and never creates DOM nodes.
 */
export const getCapitalStageSequence = (
  previousStage: number,
  targetStage: number,
  maxFrames: number
) => {
  const from = Math.max(
    0,
    Math.min(MAX_BATTLE_CAPITAL_VISUAL_STAGE, Math.floor(previousStage))
  );
  const to = Math.max(
    0,
    Math.min(MAX_BATTLE_CAPITAL_VISUAL_STAGE, Math.floor(targetStage))
  );
  const frameCount = Math.max(1, Math.floor(maxFrames));
  if (from === to) return [to];
  const direction = to > from ? 1 : -1;
  const distance = Math.abs(to - from);
  const steps = Math.min(distance, frameCount);
  const sequence: number[] = [];
  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    const stage =
      index === steps
        ? to
        : from + direction * Math.max(1, Math.round(distance * progress));
    if (sequence.at(-1) !== stage) sequence.push(stage);
  }
  if (sequence.at(-1) !== to) sequence.push(to);
  return sequence;
};

export const MAX_CAPITAL_DROP_PARTICLE_COUNT = 16;

const CAPITAL_DROP_PARTICLE_COUNTS: Record<
  CapitalCommitTier,
  Readonly<{ standard: number; compact: number }>
> = {
  small: { standard: 4, compact: 2 },
  medium: { standard: 8, compact: 4 },
  heavy: { standard: 12, compact: 6 },
};

/**
 * A direct investment gets one bounded shower based on its command tier, not
 * its gil value. Compact mode reduces paint work while keeping the same audio
 * cadence and presentation time.
 */
export const getCapitalDropParticleCount = (
  tier: CapitalCommitTier,
  compact = false
) =>
  Math.min(
    MAX_CAPITAL_DROP_PARTICLE_COUNT,
    CAPITAL_DROP_PARTICLE_COUNTS[tier][compact ? 'compact' : 'standard']
  );

/**
 * The carried stake is one readable cargo silhouette, never a coin-per-value
 * pile. Its sprite and static size communicate the selected level; the bounded
 * 0-59 hoard remains the place where accumulated capital is shown.
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

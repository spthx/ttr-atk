import type { BattlePhase } from '../types';
import type { BossAbilityTier } from './gameBalance';
import {
  BATTLE_CAPITAL_OVERFLOW_LAYERS_PER_TIER,
  BATTLE_CAPITAL_RACK_SHIFT_FRAME_MS,
} from './battleCapitalCanvasLayout';

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
export const ENEMY_SUPPORT_POST_PILE_GRACE_MS = 800;

/**
 * Compact capital presentation is reserved for reduced-motion accessibility.
 * Difficulty and campaign order never shorten the authored coin cadence.
 */
export const shouldUseCompactCapitalPresentation = ({
  reducedMotion,
  isHighEndRaid: _isHighEndRaid,
}: {
  reducedMotion: boolean;
  isHighEndRaid: boolean;
}) => reducedMotion;

export const shouldUseCompactTerminalPresentation = ({
  reducedMotion,
}: {
  reducedMotion: boolean;
}) => reducedMotion;

export const getBattleClockScales = ({
  baseTimeScale,
  simulationPaused,
  capitalPileActive,
  capitalPileAllowsCommandRecharge,
  fullPresentationActive,
}: {
  baseTimeScale: number;
  simulationPaused: boolean;
  capitalPileActive: boolean;
  capitalPileAllowsCommandRecharge: boolean;
  fullPresentationActive: boolean;
}) => {
  const normalizedBaseTimeScale = Math.max(0, baseTimeScale);
  const simulationTimeScale = simulationPaused ? 0 : normalizedBaseTimeScale;
  const commandTimeScale =
    simulationPaused &&
    capitalPileActive &&
    capitalPileAllowsCommandRecharge &&
    !fullPresentationActive
      ? normalizedBaseTimeScale
      : simulationTimeScale;

  return { commandTimeScale, simulationTimeScale };
};

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

export type BattleImpactStopPhase = 'hitstop' | 'release';

export const isBattleImpactPresentationActive = (
  phase: BattleImpactStopPhase | null | undefined
) => phase === 'hitstop' || phase === 'release';

export const advanceEnemySupportTelegraphClock = ({
  remainingMs,
  elapsedMs,
  blocked,
}: {
  remainingMs: number;
  elapsedMs: number;
  blocked: boolean;
}) => {
  const normalizedRemaining = Math.max(
    0,
    Number.isFinite(remainingMs) ? remainingMs : 0
  );
  const normalizedElapsed = Math.max(
    0,
    Number.isFinite(elapsedMs) ? elapsedMs : 0
  );
  const nextRemainingMs = blocked
    ? normalizedRemaining
    : Math.max(0, normalizedRemaining - normalizedElapsed);

  return {
    remainingMs: nextRemainingMs,
    castDue: !blocked && nextRemainingMs <= 0,
  };
};

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
      prepareMs: 140,
      travelMs: 170,
      hitStopMs: 50,
      settleMs: 760,
      afterglowMs: 240,
      totalMs: 1_360,
    },
    medium: {
      prepareMs: 150,
      travelMs: 190,
      hitStopMs: 55,
      settleMs: 1_320,
      afterglowMs: 280,
      totalMs: 1_995,
    },
    heavy: {
      prepareMs: 160,
      travelMs: 220,
      hitStopMs: 72,
      settleMs: 4_788,
      afterglowMs: 320,
      totalMs: 5_560,
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

export type CapitalPresentationRecoveryAction =
  | 'none'
  | 'release_stale'
  | 'resume_terminal';

/**
 * Resolves an interrupted capital presentation without coupling the decision
 * to React timers. A future Unity runner can feed the same visible/runtime
 * snapshot after a scene reload and either keep waiting, release a stale lock,
 * or continue a terminal handoff exactly once.
 */
export const getCapitalPresentationRecoveryAction = ({
  ended,
  hasVisiblePresentation,
  runnerActive,
  pendingTimerCount,
  terminalHandoffPending,
}: {
  ended: boolean;
  hasVisiblePresentation: boolean;
  runnerActive: boolean;
  pendingTimerCount: number;
  terminalHandoffPending: boolean;
}): CapitalPresentationRecoveryAction => {
  if (ended || runnerActive || pendingTimerCount > 0) return 'none';
  if (terminalHandoffPending) return 'resume_terminal';
  return hasVisiblePresentation ? 'release_stale' : 'none';
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
export interface SkillCinematicTiming {
  readonly nameMs: number;
  readonly castMs: number;
  readonly hitStopMs: number;
  readonly impactMs: number;
  readonly resolveMs: number;
  readonly totalMs: number;
}

export const SKILL_CINEMATIC_TIMING: SkillCinematicTiming = {
  nameMs: 420,
  castMs: 460,
  hitStopMs: 90,
  impactMs: 360,
  // Keep the resolved effect card on screen long enough to read its value and
  // duration. Simulation remains paused, so this adds clarity without changing
  // the strength or effective lifetime of the skill.
  resolveMs: 900,
  totalMs: 2_230,
} as const;

export const REDUCED_MOTION_SKILL_CINEMATIC_TIMING: SkillCinematicTiming = {
  nameMs: 210,
  castMs: 220,
  hitStopMs: 42,
  impactMs: 180,
  // Reduced motion shortens movement, not the time needed to read the result.
  resolveMs: 600,
  totalMs: 1_252,
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

export interface SkillCinematicTimelineState {
  stage: SkillCinematicStage;
  castDue: boolean;
  effectDue: boolean;
  completionDue: boolean;
  nextTransitionInMs: number | null;
}

export interface SkillCinematicConsumedEvents {
  cast: boolean;
  effect: boolean;
  completion: boolean;
}

export interface SkillCinematicEventDecision {
  fireCast: boolean;
  fireEffect: boolean;
  fireCompletion: boolean;
  waitForPresentation: boolean;
  consumed: SkillCinematicConsumedEvents;
}

/**
 * Pure projection for an ability/SYNERGY presentation. Consumers may render
 * `stage` directly and consume each due event once per run. Keeping the event
 * deadlines outside React lets another runtime (including Unity) resume the
 * same presentation without an acknowledgement click or a chain of orphanable
 * UI timers.
 */
export const getSkillCinematicTimelineState = (
  elapsedMs: number,
  timing: SkillCinematicTiming = SKILL_CINEMATIC_TIMING
): SkillCinematicTimelineState => {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const castAt = timing.nameMs;
  const effectAt = castAt + timing.castMs;
  const impactAt = effectAt + timing.hitStopMs;
  const resolveAt = impactAt + timing.impactMs;
  const completeAt = resolveAt + timing.resolveMs;

  if (elapsed >= completeAt) {
    return {
      stage: 'resolve',
      castDue: true,
      effectDue: true,
      completionDue: true,
      nextTransitionInMs: null,
    };
  }

  if (elapsed >= resolveAt) {
    return {
      stage: 'resolve',
      castDue: true,
      effectDue: true,
      completionDue: false,
      nextTransitionInMs: completeAt - elapsed,
    };
  }

  if (elapsed >= impactAt) {
    return {
      stage: 'impact',
      castDue: true,
      effectDue: true,
      completionDue: false,
      nextTransitionInMs: resolveAt - elapsed,
    };
  }

  if (elapsed >= effectAt) {
    return {
      stage: 'hitstop',
      castDue: true,
      effectDue: true,
      completionDue: false,
      nextTransitionInMs: impactAt - elapsed,
    };
  }

  if (elapsed >= castAt) {
    return {
      stage: 'cast',
      castDue: true,
      effectDue: false,
      completionDue: false,
      nextTransitionInMs: effectAt - elapsed,
    };
  }

  return {
    stage: 'name',
    castDue: false,
    effectDue: false,
    completionDue: false,
    nextTransitionInMs: castAt - elapsed,
  };
};

/**
 * Converts cumulative timeline deadlines into one-shot events. The caller owns
 * the consumed flags, so re-running this decision after a render, timer replay,
 * or runtime handoff cannot apply an effect or completion twice.
 */
export const getSkillCinematicEventDecision = ({
  timeline,
  consumed,
  completionBlocked = false,
  runMatches = true,
}: {
  timeline: SkillCinematicTimelineState;
  consumed: SkillCinematicConsumedEvents;
  completionBlocked?: boolean;
  runMatches?: boolean;
}): SkillCinematicEventDecision => {
  if (!runMatches) {
    return {
      fireCast: false,
      fireEffect: false,
      fireCompletion: false,
      waitForPresentation: false,
      consumed,
    };
  }

  const fireCast = timeline.castDue && !consumed.cast;
  const fireEffect = timeline.effectDue && !consumed.effect;
  const waitForPresentation =
    timeline.completionDue && completionBlocked && !consumed.completion;
  const fireCompletion =
    timeline.completionDue && !completionBlocked && !consumed.completion;

  return {
    fireCast,
    fireEffect,
    fireCompletion,
    waitForPresentation,
    consumed: {
      cast: consumed.cast || fireCast,
      effect: consumed.effect || fireEffect,
      completion: consumed.completion || fireCompletion,
    },
  };
};

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

/** Four staggered SFC tray rows: 4 + 5 + 5 + 4 fixed coin rolls. */
export const BATTLE_CAPITAL_COLUMN_COUNT = 18;
/** Columns are allowed to continue past the top edge like the original game. */
export const MAX_BATTLE_CAPITAL_COLUMN_LAYERS = 512;
export const MAX_BATTLE_CAPITAL_VISIBLE_UNITS =
  BATTLE_CAPITAL_COLUMN_COUNT * MAX_BATTLE_CAPITAL_COLUMN_LAYERS;

/** One maximum direct-investment command fills one complete treasury page. */
export const BATTLE_CAPITAL_FULL_PAGE_MARKET_RATIO = 0.35;

const CAPITAL_SHOWCASE_FILL_ORDER = [
  // Build a compact mound from the front-centre of the SFC 4/5/5/4 tray.
  // Every rear roll is introduced only after a nearer, horizontally
  // overlapping roll exists, so one or two visible coins can never hang in
  // the empty rear of the platter. A complete pass still touches all eighteen
  // fixed rolls before any roll gains another visible seam.
  15, 16, 14, 17,
  11, 10, 12, 9, 13,
  6, 5, 7, 4, 8,
  1, 2, 0, 3,
] as const;

// Screen-space order for the eighteen persistent columns. Presentation uses
// this independently from the showcase fill order so incoming bundles travel as
// one continuous hose-like sweep instead of jumping between distant columns.
const CAPITAL_COLUMN_LEFT_TO_RIGHT_ORDER = [
  0, 13, 4, 9, 1, 14, 5, 10, 2,
  15, 6, 11, 3, 16, 7, 12, 17, 8,
] as const;

/**
 * Converts capital into the fixed eighteen-column display used by the live field.
 * The asking price chooses the campaign-scale height once for both sides, while
 * the square-root curve keeps small offers readable and prevents late-game
 * capital from requiring amount-proportional DOM nodes.
 */
const getBattleCapitalLayersAtTarget = (marketPrice: number) => {
  const normalizedPrice = Math.max(1_000, marketPrice);
  const priceMagnitude = Math.log10(normalizedPrice);
  return Math.max(
    6,
    Math.min(
      MAX_BATTLE_CAPITAL_COLUMN_LAYERS,
      Math.round(6 + (priceMagnitude - 3) * 4)
    )
  );
};

const getBattleCapitalLayerDemand = (amount: number, marketPrice: number) => {
  const normalizedAmount = Math.max(0, amount);
  if (normalizedAmount <= 0) return 0;

  const normalizedPrice = Math.max(1_000, marketPrice);
  const layersAtTarget = getBattleCapitalLayersAtTarget(normalizedPrice);
  const ratio = normalizedAmount / normalizedPrice;
  return layersAtTarget * Math.sqrt(ratio);
};

export interface BattleCapitalPageState {
  /** Total visual treasury pages represented by the committed capital. */
  pageEquivalent: number;
  /** Completed pages already stored below the reusable upper field. */
  bankedPileCount: number;
  /** Fraction of the currently visible upper page, on the 0..1 scale. */
  activePageFraction: number;
  /** Fixed-column units belonging only to the reusable upper page. */
  activeVisibleUnits: number;
  /** Capital represented by one full upper page at this asking price. */
  fullPageCapital: number;
}

/**
 * Splits capital into completed off-screen pages and one reusable upper page.
 *
 * Every page is linear: twice the committed capital means twice the visible
 * page work. Small offers remain readable through fixed coin artwork and glow,
 * not by inflating their represented mass with a square-root curve.
 */
export const getBattleCapitalPageState = (
  amount: number,
  marketPrice: number
): BattleCapitalPageState => {
  const normalizedAmount = Math.max(0, amount);
  const normalizedPrice = Math.max(1_000, marketPrice);
  // A page is a unit of visible action, not a lifetime-balance bucket. The
  // largest direct investment is 35% of the asking price, so one such command
  // must build one complete 18-column visual page at every campaign scale. The five
  // investment levels then occupy stable fractions of that same page and an
  // equal follow-up command can bank the old page and refill an equal one.
  const fullPageCapital =
    normalizedPrice * BATTLE_CAPITAL_FULL_PAGE_MARKET_RATIO;
  if (normalizedAmount <= 0) {
    return {
      pageEquivalent: 0,
      bankedPileCount: 0,
      activePageFraction: 0,
      activeVisibleUnits: 0,
      fullPageCapital,
    };
  }
  const rawPageEquivalent = normalizedAmount / fullPageCapital;
  const nearestWholePage = Math.round(rawPageEquivalent);
  // Only snap around a completed page. Snapping toward zero erased ordinary
  // 2% and 5% bids because both legitimately occupy less than one hundredth
  // of a page; every positive commitment must leave visible settled mass.
  const pageEquivalent = nearestWholePage >= 1 &&
    Math.abs(rawPageEquivalent - nearestWholePage) <= 0.0015
      ? nearestWholePage
      : rawPageEquivalent;
  // The first physical page is always the reusable active tray. We retain the
  // same page capacity for the whole battle; later money is represented by
  // banking completed pages rather than recalibrating against lifetime total.
  const completedPages = Math.max(0, Math.floor(pageEquivalent + 1e-9));
  const fractionalPage = Math.max(0, pageEquivalent - completedPages);
  // Once a completed page has a non-empty successor, move that completed page
  // into the lower bank. Exact whole-page amounts keep the newest full page in
  // the reusable upper field (1.0 => bank 0 + active 1, 1.5 => bank 1 +
  // active .5, 2.0 => bank 1 + active 1). This prevents a positive commitment
  // just above one page from visually shrinking the treasury.
  const bankedPileCount = Math.max(
    0,
    completedPages - (fractionalPage > 1e-9 ? 0 : 1)
  );
  const activePageFraction = pageEquivalent >= 1
    ? (fractionalPage > 1e-9 ? fractionalPage : 1)
    : pageEquivalent;
  return {
    pageEquivalent,
    bankedPileCount,
    activePageFraction,
    activeVisibleUnits: Math.round(
      MAX_BATTLE_CAPITAL_VISIBLE_UNITS * activePageFraction
    ),
    fullPageCapital,
  };
};

export const getBattleCapitalVisibleUnits = (
  amount: number,
  marketPrice: number
) => {
  const layerDemand = getBattleCapitalLayerDemand(amount, marketPrice);
  if (layerDemand <= 0) return 0;
  return Math.max(
    1,
    Math.min(
      MAX_BATTLE_CAPITAL_VISIBLE_UNITS,
      Math.round(BATTLE_CAPITAL_COLUMN_COUNT * layerDemand)
    )
  );
};

/**
 * Keeps the visible incoming mass tied to this commitment instead of the
 * square-root-compressed size of the pile that was already on the table.
 * The result is deliberately bounded so a large bid reads as a dense wave
 * without turning the Canvas renderer into an amount-proportional particle
 * system.
 */
export const getCapitalIncomingBundleCopies = (
  previousCapital: number,
  nextCapital: number,
  marketPrice: number
) => {
  const deltaRatio =
    Math.max(0, nextCapital - previousCapital) / Math.max(1, marketPrice);
  if (deltaRatio <= 0) return 1;
  return Math.min(
    3,
    Math.max(1, Math.ceil(Math.sqrt(deltaRatio / 0.05) - Number.EPSILON))
  );
};

/** Same amount always produces the same monotonic eighteen-stack showcase. */
export const getCapitalColumnHeights = (visibleUnits: number) => {
  const normalizedUnits = Math.max(
    0,
    Math.min(MAX_BATTLE_CAPITAL_VISIBLE_UNITS, Math.round(visibleUnits))
  );
  const heights = Array<number>(BATTLE_CAPITAL_COLUMN_COUNT).fill(0);
  for (let unit = 0; unit < normalizedUnits; unit += 1) {
    const columnIndex =
      CAPITAL_SHOWCASE_FILL_ORDER[unit % CAPITAL_SHOWCASE_FILL_ORDER.length];
    heights[columnIndex] += 1;
  }
  return heights;
};

export interface MechanicalCapitalColumnFrame {
  visibleUnits: number;
  /** Settled coins in the reusable upper field. */
  columnHeights: number[];
  /** Settled upper-field shape after the current incoming wave lands. */
  settledAfterColumnHeights?: number[];
  /**
   * The most recently completed upper page after it has been banked below the
   * field divider. Older pages are represented by `bankedPileCount`; renderers
   * must keep their node/column count bounded.
   */
  bankedColumnHeights?: number[];
  /** Number of completed upper pages stored below the divider. */
  bankedPileCount?: number;
  /** Number of complete pages moved by the single bank-transfer frame. */
  bankTransferPages?: number;
  activeColumnIndices: number[];
  /** Number of short incoming bundles drawn per active column (one to three). */
  incomingBundleCopies?: number;
  /** Coin layers in each incoming bundle; large mass curtains use a taller roll. */
  incomingBundleLayers?: number;
  /** Heavy/reload anticipation marker; renderers must not pre-lower an empty rack. */
  rackCompressed?: boolean;
  /** One-based overflow reload pass, used only to retrigger the bounded stamp. */
  overflowPass?: number;
  /** One-based mechanical dealing beat inside an overflow reload pass. */
  stackBeat?: number;
  /** @deprecated Compatibility alias for `bankedPileCount`. */
  rackDepth?: number;
  /** @deprecated Compatibility alias for settled `bankedPileCount`. */
  stackDepth?: number;
  /** @deprecated Compatibility alias for `bankTransfer`. */
  rackShift?: boolean;
  /**
   * One silent beat that moves the whole completed active page and its tray to
   * the bank in a single motion. Incoming packets begin only after this beat.
   */
  bankTransfer?: boolean;
}

export const CAPITAL_STACK_BEAT_MS = {
  // Two independent SFC captures place a complete nine-wave page between
  // 1.40s and 1.55s. Five 30fps frames per wave gives 1.485s per page.
  standard: 165,
  heavy: 165,
  compact: 62,
} as const;

export const CAPITAL_OVERFLOW_RESTACK_BEATS = {
  // Five adjacent screen-space groups travel from the inner edge to the outer
  // edge and then back again. Duplicating each turn keeps the direction change
  // readable, like a hose pausing briefly before it sweeps back.
  standard: 10,
  heavy: 10,
  compact: 10,
} as const;

// Overflow still carries every authored sweep and every bounded mass copy.
// SFC-authentic five-frame bundle cadence. The cached audio roll deliberately
// remains denser than this outer visual clock, matching the many coin contacts
// inside one falling cylindrical bundle.
export const CAPITAL_OVERFLOW_RAPID_BEAT_MS = 165;
/** Dense treasury pages land on the reviewed five-frame visual beat. */
export const CAPITAL_COIN_WAVE_MS = CAPITAL_OVERFLOW_RAPID_BEAT_MS;
export const CAPITAL_COIN_WAVES_PER_PAGE = 9;
export const CAPITAL_COIN_WAVE_MIN_COLUMNS = BATTLE_CAPITAL_COLUMN_COUNT;
export const CAPITAL_COIN_WAVE_MAX_COLUMNS = BATTLE_CAPITAL_COLUMN_COUNT;
export const CAPITAL_COIN_WAVE_MAX_COUNT = 64;
/** The falling SFC sprite is a short cylinder, not an individual flat coin. */
export const CAPITAL_COIN_WAVE_BUNDLE_LAYERS = 4;
/** Sub-pixel page remainder that does not need a dedicated prefill wave. */
const CAPITAL_PAGE_PREFILL_EPSILON = 0.005;
/** Legacy logical-clock constants retained for command recharge equivalence. */
export const CAPITAL_MASS_CURTAIN_BEATS = 6;
export const CAPITAL_MASS_CURTAIN_BUNDLE_LAYERS = 9;
export const MAX_BATTLE_CAPITAL_VISUAL_LAYERS_PER_COLUMN = 512;
const CAPITAL_MASS_CURTAIN_MINIMUM_MARKET_RATIO = 0.18;

const getCapitalSweepGroups = (
  order: readonly number[],
  maximumColumnsPerBeat: number
) => {
  const beatCount = Math.max(
    1,
    Math.ceil(order.length / Math.max(1, maximumColumnsPerBeat))
  );
  const minimumGroupSize = Math.floor(order.length / beatCount);
  const largerGroupCount = order.length % beatCount;
  let offset = 0;

  return Array.from({ length: beatCount }, (_, beatIndex) => {
    const groupSize = minimumGroupSize + (beatIndex < largerGroupCount ? 1 : 0);
    const group = order.slice(offset, offset + groupSize);
    offset += groupSize;
    return group;
  });
};

/**
 * Converts exceptional funding into a bounded number of full-rack reloads.
 * The amount changes the number of presentation passes, never the column count.
 */
export const getCapitalOverflowPassCount = (
  previousCapital: number,
  nextCapital: number,
  marketPrice: number,
  heavy = false
) => {
  const price = Math.max(1, marketPrice);
  const previous = Math.max(0, previousCapital);
  const next = Math.max(0, nextCapital);
  const deltaRatio = Math.max(0, next - previous) / price;
  if (next <= previous) return 0;
  // Persistent overflow still begins at 1.5x asking price, but a heavy new
  // wave must visibly deal across the full rack even on the first 20/35/75%
  // command. The old total-only gate made the game's most common all-in skip
  // the large-capital treatment entirely. The renderer still keeps the floor
  // visible until the completed columns actually reach its upper safe line.
  if (!heavy && next / price < 1.5) return 0;

  const previousBand = Math.max(
    0,
    Math.floor(Math.log2(Math.max(1, previous / price)))
  );
  const nextBand = Math.max(
    0,
    Math.floor(Math.log2(Math.max(1, next / price)))
  );
  const crossedBands = Math.max(0, nextBand - previousBand);
  const impactPasses = !heavy
    ? 0
    : deltaRatio >= 1.5
      ? 3
      : deltaRatio >= 0.65
        ? 2
        : deltaRatio >= 0.18
          ? 1
          : 0;
  return Math.min(3, Math.max(crossedBands, impactPasses));
};

/**
 * Deals capital into the fixed rack as deterministic four/five-column bundles.
 * Each visible beat spends a balanced share of the remaining mass, so a large
 * mountain keeps arriving continuously without amount-proportional DOM nodes.
 */
export const getMechanicalCapitalColumnFrames = (
  previousUnits: number,
  targetUnits: number,
  maxFrames: number,
  columnsPerBeat = 5,
  overflowPasses = 0,
  overflowBeats: number = CAPITAL_OVERFLOW_RESTACK_BEATS.standard,
  compressWhileLoading = false,
  side: 'player' | 'enemy' = 'player'
): MechanicalCapitalColumnFrame[] => {
  const from = Math.max(
    0,
    Math.min(MAX_BATTLE_CAPITAL_VISIBLE_UNITS, Math.round(previousUnits))
  );
  const to = Math.max(
    0,
    Math.min(MAX_BATTLE_CAPITAL_VISIBLE_UNITS, Math.round(targetUnits))
  );
  const current = getCapitalColumnHeights(from);
  const target = getCapitalColumnHeights(to);
  if (from === to && overflowPasses <= 0) {
    return [{
      visibleUnits: to,
      columnHeights: target,
      activeColumnIndices: [],
    }];
  }

  const totalDistance = Math.abs(to - from);
  const groupSize = Math.max(
    1,
    Math.min(BATTLE_CAPITAL_COLUMN_COUNT, Math.floor(columnsPerBeat))
  );
  let frameCount = from === to
    ? 0
    : Math.max(
    1,
    Math.min(
      30,
      Math.floor(maxFrames),
      Math.ceil(totalDistance / groupSize)
    )
  );
  const direction = to > from ? 1 : -1;
  // Each side starts beside the centre line and sweeps toward its own outer
  // edge. Capital removal runs the same physical path in reverse.
  const innerToOuterOrder = side === 'player'
    ? [...CAPITAL_COLUMN_LEFT_TO_RIGHT_ORDER].reverse()
    : [...CAPITAL_COLUMN_LEFT_TO_RIGHT_ORDER];
  const order = direction > 0
    ? innerToOuterOrder
    : [...innerToOuterOrder].reverse();
  const sweepGroups = getCapitalSweepGroups(order, groupSize);
  const frames: MechanicalCapitalColumnFrame[] = [];
  const groupPlans = sweepGroups
    .map((group) => ({
      group,
      distance: group.reduce(
        (sum, columnIndex) =>
          sum + Math.abs(target[columnIndex] - current[columnIndex]),
        0
      ),
    }))
    .filter((plan) => plan.distance > 0);
  frameCount = Math.max(frameCount, groupPlans.length);

  // Growth follows a closed pendulum: inner -> outer -> outer -> inner. The
  // repeated turn groups keep every row's visit count balanced while every
  // moving beat remains spatially adjacent.
  const pendulumPlans = [
    ...groupPlans,
    ...[...groupPlans].reverse(),
  ];
  const scheduledGroups = Array.from(
    { length: frameCount },
    (_, frameIndex) => pendulumPlans[frameIndex % pendulumPlans.length]
  );
  const scheduledVisitTotals = new Map<(typeof groupPlans)[number], number>();
  scheduledGroups.forEach((plan) => {
    scheduledVisitTotals.set(
      plan,
      (scheduledVisitTotals.get(plan) ?? 0) + 1
    );
  });

  const completedVisits = new Map<(typeof groupPlans)[number], number>();
  scheduledGroups.forEach((plan) => {
    const visitsDone = completedVisits.get(plan) ?? 0;
    const visitsRemaining =
      (scheduledVisitTotals.get(plan) ?? 1) - visitsDone;
    const groupDistance = plan.group.reduce(
      (sum, columnIndex) =>
        sum + Math.abs(target[columnIndex] - current[columnIndex]),
      0
    );
    let budget = Math.ceil(groupDistance / Math.max(1, visitsRemaining));
    const active = new Set<number>();

    while (budget > 0) {
      let roundChanged = false;
      plan.group.forEach((columnIndex) => {
        if (budget <= 0 || current[columnIndex] === target[columnIndex]) return;
        current[columnIndex] += direction;
        budget -= 1;
        roundChanged = true;
        active.add(columnIndex);
      });
      if (!roundChanged) break;
    }
    completedVisits.set(plan, visitsDone + 1);
    frames.push({
      visibleUnits: current.reduce((sum, height) => sum + height, 0),
      columnHeights: [...current],
      activeColumnIndices: [...active],
      rackCompressed: compressWhileLoading && direction > 0,
    });
  });

  const boundedPasses = Math.max(0, Math.min(3, Math.floor(overflowPasses)));
  // A reload uses the same deliberate inner-to-outer-to-inner round trip.
  const outwardGroups = getCapitalSweepGroups(
    innerToOuterOrder,
    groupSize
  );
  const roundTripGroups = [
    ...outwardGroups,
    ...[...outwardGroups].reverse(),
  ];
  const maximumRoundTripBeats = roundTripGroups.length;
  const boundedBeats = Math.max(
    1,
    Math.min(maximumRoundTripBeats, Math.floor(overflowBeats))
  );
  for (let passIndex = 0; passIndex < boundedPasses; passIndex += 1) {
    const pass = passIndex + 1;
    frames.push({
      visibleUnits: to,
      columnHeights: [...target],
      activeColumnIndices: [],
      rackCompressed: true,
      overflowPass: pass,
      stackBeat: 0,
    });
    for (let beatIndex = 0; beatIndex < boundedBeats; beatIndex += 1) {
      frames.push({
        visibleUnits: to,
        columnHeights: [...target],
        activeColumnIndices: roundTripGroups[beatIndex],
        rackCompressed: true,
        overflowPass: pass,
        stackBeat: beatIndex + 1,
      });
    }
    frames.push({
      visibleUnits: to,
      columnHeights: [...target],
      activeColumnIndices: [],
      rackCompressed: true,
      overflowPass: pass,
      stackBeat: boundedBeats + 1,
    });
  }

  if (frames.length === 0) {
    frames.push({
      visibleUnits: to,
      columnHeights: target,
      activeColumnIndices: [],
    });
  }
  return frames;
};

export type CapitalStackSide = 'player' | 'enemy';
export type CapitalStackSource =
  | 'direct'
  | 'support'
  | 'opening'
  | 'enemy-defense'
  | 'skill';
export type CapitalStackIntensity = 'standard' | 'heavy' | 'compact';
export type CapitalStackPhase = 'preload' | 'pour' | 'settle';

/**
 * Renderer-neutral input produced after battle capital has been committed.
 * It never mutates the ledger; React and a future Unity renderer consume the
 * same deterministic scene description.
 */
export interface CapitalStackEvent {
  id: string;
  side: CapitalStackSide;
  source: CapitalStackSource;
  previousCapital: number;
  nextCapital: number;
  marketPrice: number;
  intensity: CapitalStackIntensity;
  seed: number;
  /** Previously banked presentation depth; never affects committed capital. */
  previousRackDepth?: number;
}

export interface CapitalStackTimelineFrame
  extends MechanicalCapitalColumnFrame {
  phase: CapitalStackPhase;
  atMs: number;
  durationMs: number;
  /** Keeps command recharge on the pre-acceleration logical clock. */
  commandRechargeScale: number;
  presentedCapital: number;
  packetSeed: number;
}

export interface CapitalStackTimeline {
  event: CapitalStackEvent;
  beatMs: number;
  preloadMs: number;
  pourDurationMs: number;
  settleMs: number;
  totalMs: number;
  frames: CapitalStackTimelineFrame[];
}

/**
 * Builds one fixed-column Canvas stacking scene. Amount changes heights and the bounded
 * number of beats, never the number of rendered columns. Frame-rate changes
 * only how often a renderer samples this absolute timeline.
 */
const buildLegacyCapitalStackTimeline = (
  event: CapitalStackEvent
): CapitalStackTimeline => {
  const compact = event.intensity === 'compact';
  const heavy = event.intensity === 'heavy';
  const beatMs = CAPITAL_STACK_BEAT_MS[event.intensity];
  const settleMs = compact ? 72 : heavy ? 280 : 190;
  const previousStage = getBattleCapitalVisibleUnits(
    event.previousCapital,
    event.marketPrice
  );
  const targetStage = getBattleCapitalVisibleUnits(
    event.nextCapital,
    event.marketPrice
  );
  const previousBankedPileCount = Math.max(
    0,
    Math.floor(event.previousRackDepth ?? 0)
  );
  const capitalGain = Math.max(0, event.nextCapital - event.previousCapital);
  const marketGainRatio = capitalGain / Math.max(1, event.marketPrice);
  // Once pages have been banked, compare the next offer with one page rather
  // than the lifetime capital total. Equal 300M waves must therefore keep
  // producing equal pages at 600->900M, 900->1.2B and beyond.
  const estimatedActivePageCapital = event.previousCapital /
    Math.max(1, previousBankedPileCount + 1);
  const usesMassCurtain =
    event.previousCapital > 0 &&
    previousStage >= MAX_BATTLE_CAPITAL_VISIBLE_UNITS * 0.9 &&
    capitalGain > 0 &&
    marketGainRatio >= CAPITAL_MASS_CURTAIN_MINIMUM_MARKET_RATIO &&
    capitalGain >= estimatedActivePageCapital * 0.5;
  // A treasury-sized repeat does not stretch the same rolls. The completed
  // active page is promoted to the bank, the upper field becomes empty, then
  // a fresh page is dealt. This is presentation-only: committed capital and
  // ownership are still supplied by the caller and never changed here.
  const targetBankedPileCount =
    previousBankedPileCount + (usesMassCurtain ? 1 : 0);
  const emptyColumnHeights = getCapitalColumnHeights(0);
  const previousActiveColumnHeights = getCapitalColumnHeights(previousStage);
  const previousBankedColumnHeights = previousBankedPileCount > 0
    ? getCapitalColumnHeights(MAX_BATTLE_CAPITAL_VISIBLE_UNITS)
    : emptyColumnHeights;
  const requestedReloadPasses = getCapitalOverflowPassCount(
    event.previousCapital,
    event.nextCapital,
    event.marketPrice,
    heavy
  );
  // Once the bounded rack is full, any further positive capital still needs a
  // visible packet. Otherwise common 7–16% enemy counters update only the
  // ledger and the core coin contest appears to stop at saturation.
  const reloadPasses = Math.min(
    3,
    previousStage === targetStage && event.nextCapital > event.previousCapital
      ? Math.max(1, requestedReloadPasses)
      : requestedReloadPasses
  );
  const willCompress = heavy || reloadPasses > 0 || usesMassCurtain;
  // Heavy/reload commands keep a readable anticipation beat before the first
  // packet. This marker must never move an empty rack ahead of the visible coins.
  const preloadMs = compact ? 24 : willCompress ? 300 : 90;
  const reloadBeats = compact
    ? CAPITAL_OVERFLOW_RESTACK_BEATS.compact
    : heavy
      ? CAPITAL_OVERFLOW_RESTACK_BEATS.heavy
      : CAPITAL_OVERFLOW_RESTACK_BEATS.standard;
  const rawMechanicalFrames = getMechanicalCapitalColumnFrames(
    previousStage,
    targetStage,
    compact ? 4 : heavy ? 24 : 22,
    compact ? 6 : heavy ? 5 : 4,
    reloadPasses,
    reloadBeats,
    heavy,
    event.side
  );
  const legacyMechanicalFrames = rawMechanicalFrames;
  const growthFrames = rawMechanicalFrames.filter(
    (frame) => (frame.overflowPass ?? 0) === 0
  );
  const authoredOverflowFrames = rawMechanicalFrames.filter(
    (frame) =>
      (frame.overflowPass ?? 0) > 0 && frame.activeColumnIndices.length > 0
  );
  const overflowFrames: MechanicalCapitalColumnFrame[] = usesMassCurtain
    ? Array.from({ length: CAPITAL_MASS_CURTAIN_BEATS }, (_, beatIndex) => ({
        visibleUnits: Math.round(
          targetStage * (beatIndex + 1) / CAPITAL_MASS_CURTAIN_BEATS
        ),
        columnHeights: getCapitalColumnHeights(
          Math.round(
            targetStage * (beatIndex + 1) / CAPITAL_MASS_CURTAIN_BEATS
          )
        ),
        bankedColumnHeights: previousActiveColumnHeights,
        bankedPileCount: targetBankedPileCount,
        activeColumnIndices: [...CAPITAL_COLUMN_LEFT_TO_RIGHT_ORDER],
        incomingBundleCopies: 3,
        incomingBundleLayers: CAPITAL_MASS_CURTAIN_BUNDLE_LAYERS,
        rackCompressed: true,
        overflowPass: 1,
        stackBeat: beatIndex + 1,
      }))
    : authoredOverflowFrames;
  // All requested reload sweeps retain their mass, but pass-boundary idle
  // frames are removed. A real multi-tier crossing gets one total rack shift,
  // never a staircase of separate descents.
  let mechanicalFrames: MechanicalCapitalColumnFrame[] = [
    ...(usesMassCurtain ? [] : growthFrames),
    ...overflowFrames,
  ];
  if (usesMassCurtain) {
    const rackShiftFrame: MechanicalCapitalColumnFrame = {
      visibleUnits: previousStage,
      columnHeights: previousActiveColumnHeights,
      bankedColumnHeights: previousBankedColumnHeights,
      bankedPileCount: targetBankedPileCount,
      activeColumnIndices: [],
      incomingBundleCopies: 1,
      rackCompressed: true,
      overflowPass: 1,
      stackBeat: 0,
      rackShift: true,
      bankTransfer: true,
    };
    mechanicalFrames = [rackShiftFrame, ...overflowFrames];
  }
  const seed = Number.isFinite(event.seed) ? Math.trunc(event.seed) : 0;
  const capitalDistance = event.nextCapital - event.previousCapital;
  const incomingBundleCopies = getCapitalIncomingBundleCopies(
    event.previousCapital,
    event.nextCapital,
    event.marketPrice
  );
  const stageDistance = targetStage - previousStage;
  const activeFrameCount = mechanicalFrames.filter(
    (frame) => frame.activeColumnIndices.length > 0
  ).length;
  const presentedCapitalFor = (
    visibleUnits: number,
    completedActiveFrames: number
  ) => {
    if (capitalDistance === 0) return event.nextCapital;
    // Once the fixed rack is visually saturated, overflow reloads still need
    // a readable ledger climb. Interpolate across the bounded packet sequence
    // instead of snapping the displayed amount on its first frame.
    if (reloadPasses > 0) {
      const progress = completedActiveFrames / Math.max(1, activeFrameCount);
      return Math.round(event.previousCapital + capitalDistance * progress);
    }
    const progress = Math.max(
      0,
      Math.min(1, (visibleUnits - previousStage) / stageDistance)
    );
    return Math.round(event.previousCapital + capitalDistance * progress);
  };
  const preloadFrame: CapitalStackTimelineFrame = {
    phase: 'preload',
    atMs: 0,
    durationMs: preloadMs,
    commandRechargeScale: 1,
    visibleUnits: previousStage,
    columnHeights: previousActiveColumnHeights,
    bankedColumnHeights: previousBankedColumnHeights,
    bankedPileCount: previousBankedPileCount,
    activeColumnIndices: [],
    incomingBundleCopies,
    rackCompressed: willCompress,
    rackDepth: previousBankedPileCount,
    stackDepth: previousBankedPileCount,
    presentedCapital: event.previousCapital,
    packetSeed: seed,
  };
  const legacyPourDurationMs = legacyMechanicalFrames.reduce((total, frame) => {
    const legacyRackShift =
      (frame.overflowPass ?? 0) > 0 && (frame.stackBeat ?? 0) === 0;
    return total + (
      legacyRackShift ? BATTLE_CAPITAL_RACK_SHIFT_FRAME_MS : beatMs
    );
  }, 0);
  const acceleratedPourDurationMs = mechanicalFrames.reduce(
    (total, frame) =>
      total + (
        frame.bankTransfer === true
          ? BATTLE_CAPITAL_RACK_SHIFT_FRAME_MS
          : reloadPasses > 0
            ? CAPITAL_OVERFLOW_RAPID_BEAT_MS
            : beatMs
      ),
    0
  );
  // Rendering may be compressed into one descent and a short coin curtain,
  // but the command clock must receive exactly the legacy pour duration.
  const commandRechargeScale = acceleratedPourDurationMs > 0
    ? legacyPourDurationMs / acceleratedPourDurationMs
    : 1;
  let pourAtMs = preloadMs;
  let completedActiveFrames = 0;
  let settledVisibleUnits = previousStage;
  let settledColumnHeights = previousActiveColumnHeights;
  const pourFrames = mechanicalFrames.map(
    (frame, index): CapitalStackTimelineFrame => {
      const isBankTransfer = frame.bankTransfer === true;
      const isActive = frame.activeColumnIndices.length > 0;
      const completedBefore = completedActiveFrames;
      // Finish the one full-page transfer before the first replacement bundle.
      // Thereafter every reload sweep runs at the rapid metallic tick cadence.
      const durationMs = isBankTransfer
        ? BATTLE_CAPITAL_RACK_SHIFT_FRAME_MS
        : reloadPasses > 0
          ? CAPITAL_OVERFLOW_RAPID_BEAT_MS
          : beatMs;
      const timelineFrame: CapitalStackTimelineFrame = {
        ...frame,
        // Draw falling bundles against the previously settled pile. The raw
        // mechanical frame becomes settled only on the following beat, so new
        // coins are never visible both in the mountain and in mid-air.
        visibleUnits:
          isActive && reloadPasses > 0
            ? settledVisibleUnits
            : frame.visibleUnits,
        columnHeights: isActive && reloadPasses > 0
          ? [...settledColumnHeights]
          : [...frame.columnHeights],
        settledAfterColumnHeights: isActive
          ? [...frame.columnHeights]
          : undefined,
        // Use a timeline-global beat so persistent fixed DOM nodes can alternate
        // their CSS animation name and visibly relaunch every packet.
        stackBeat: index + 1,
        incomingBundleCopies:
          frame.incomingBundleCopies ?? incomingBundleCopies,
        incomingBundleLayers: frame.incomingBundleLayers,
        bankedColumnHeights: frame.bankedColumnHeights ??
          previousBankedColumnHeights,
        bankedPileCount: frame.bankedPileCount ?? previousBankedPileCount,
        phase: 'pour',
        atMs: pourAtMs,
        durationMs,
        commandRechargeScale,
        rackDepth: frame.bankedPileCount ?? previousBankedPileCount,
        stackDepth: isBankTransfer
          ? previousBankedPileCount
          : frame.bankedPileCount ?? previousBankedPileCount,
        rackShift: isBankTransfer,
        bankTransfer: isBankTransfer,
        presentedCapital: presentedCapitalFor(
          isActive && reloadPasses > 0
            ? settledVisibleUnits
            : frame.visibleUnits,
          completedBefore
        ),
        packetSeed: seed + (index + 1) * 7_919,
      };
      if (isActive) {
        completedActiveFrames += 1;
        settledVisibleUnits = frame.visibleUnits;
        settledColumnHeights = [...frame.columnHeights];
      }
      if (isBankTransfer) {
        // The promoted page now lives below the divider. Replacement packets
        // must land into a genuinely empty upper field.
        settledVisibleUnits = 0;
        settledColumnHeights = emptyColumnHeights;
      }
      pourAtMs += durationMs;
      return timelineFrame;
    }
  );
  const pourDurationMs = pourAtMs - preloadMs;
  const settleFrame: CapitalStackTimelineFrame = {
    phase: 'settle',
    atMs: preloadMs + pourDurationMs,
    durationMs: settleMs,
    commandRechargeScale: 1,
    visibleUnits: targetStage,
    columnHeights: getCapitalColumnHeights(targetStage),
    bankedColumnHeights: usesMassCurtain
      ? previousActiveColumnHeights
      : previousBankedColumnHeights,
    bankedPileCount: targetBankedPileCount,
    activeColumnIndices: [],
    incomingBundleCopies,
    rackCompressed: heavy,
    rackDepth: targetBankedPileCount,
    stackDepth: targetBankedPileCount,
    presentedCapital: event.nextCapital,
    packetSeed: seed + (pourFrames.length + 1) * 7_919,
  };
  return {
    event,
    beatMs,
    preloadMs,
    pourDurationMs,
    settleMs,
    totalMs: preloadMs + pourDurationMs + settleMs,
    frames: [preloadFrame, ...pourFrames, settleFrame],
  };
};

/**
 * Builds the broad, page-based treasury presentation measured from the trade
 * reference. A completed upper page is moved in one decisive transfer; coin
 * volume is then expressed as repeated full-tray waves, never by stretching a
 * handful of columns. All values are presentation-only.
 */
const buildPageCapitalStackTimeline = (
  event: CapitalStackEvent
): CapitalStackTimeline => {
  const compact = event.intensity === 'compact';
  const heavy = event.intensity === 'heavy';
  const beatMs = CAPITAL_STACK_BEAT_MS[event.intensity];
  const settleMs = compact ? 72 : heavy ? 280 : 190;
  const previousPage = getBattleCapitalPageState(
    event.previousCapital,
    event.marketPrice
  );
  const targetPage = getBattleCapitalPageState(
    event.nextCapital,
    event.marketPrice
  );
  const previousBankedPileCount = previousPage.bankedPileCount;
  const targetBankedPileCount = Math.max(
    previousBankedPileCount,
    targetPage.bankedPileCount
  );
  const bankTransferPages = Math.max(
    0,
    targetBankedPileCount - previousBankedPileCount
  );
  const previousStage = previousPage.activeVisibleUnits;
  const targetStage = targetPage.activeVisibleUnits;
  const emptyColumnHeights = getCapitalColumnHeights(0);
  const fullColumnHeights = getCapitalColumnHeights(
    MAX_BATTLE_CAPITAL_VISIBLE_UNITS
  );
  const seed = Number.isFinite(event.seed) ? Math.trunc(event.seed) : 0;
  const capitalDistance = Math.max(
    0,
    event.nextCapital - event.previousCapital
  );
  const pageWork = Math.max(
    0,
    targetPage.pageEquivalent - previousPage.pageEquivalent
  );
  const baseWaveCount = capitalDistance > 0
    ? compact
      ? 1
      : bankTransferPages >= 4 || pageWork >= 4
        ? CAPITAL_COIN_WAVE_MAX_COUNT
        : Math.min(
            CAPITAL_COIN_WAVE_MAX_COUNT,
            Math.max(1, Math.ceil(pageWork * CAPITAL_COIN_WAVES_PER_PAGE))
          )
    : 0;

  const legacyTimeline = buildLegacyCapitalStackTimeline(event);
  const legacyPourDurationMs = legacyTimeline.frames
    .filter((frame) => frame.phase === 'pour')
    .reduce(
      (total, frame) =>
        total + frame.durationMs * frame.commandRechargeScale,
      0
    );
  const preloadMs = compact ? 24 : heavy || bankTransferPages > 0 ? 300 : 90;

  type AuthoredBeat = {
    kind: 'wave' | 'transfer';
    settledBefore: number;
    settledAfter: number;
    bankedPileCount: number;
    waveOrdinal: number;
  };
  const beats: AuthoredBeat[] = [];
  let settledUnits = previousStage;
  let waveOrdinal = 0;

  // Finish a partial upper page before moving every newly completed page in
  // the one precomputed drop requested by the user. Exact full pages transfer
  // immediately; an initial empty bid necessarily lays its first page first.
  const requestedPrefillWaves = !compact && bankTransferPages > 0 &&
    previousPage.activePageFraction < 1 - CAPITAL_PAGE_PREFILL_EPSILON
      ? Math.ceil(
          (1 - previousPage.activePageFraction) *
            CAPITAL_COIN_WAVES_PER_PAGE
        )
      : 0;
  const requestedRefillWaves = compact
    ? (capitalDistance > 0 ? 1 : 0)
    : Math.max(
        0,
        Math.ceil(
          targetPage.activePageFraction * CAPITAL_COIN_WAVES_PER_PAGE
        )
      );
  // Crossing a page boundary needs enough authored work to finish the old
  // upper page and to begin the replacement page. Do not subtract one from a
  // tiny one-wave event: that used to bank an unfinished 98% page and create a
  // nearly empty successor in a single pop.
  const waveCount = compact
    ? baseWaveCount
    : bankTransferPages > 0
    ? Math.min(
        CAPITAL_COIN_WAVE_MAX_COUNT,
        Math.max(
          baseWaveCount,
          requestedPrefillWaves + requestedRefillWaves
        )
      )
    : baseWaveCount;
  const prefillWaveCount = Math.min(waveCount, requestedPrefillWaves);
  for (let index = 0; index < prefillWaveCount; index += 1) {
    const settledAfter = Math.round(
      previousStage +
        (MAX_BATTLE_CAPITAL_VISIBLE_UNITS - previousStage) *
          ((index + 1) / Math.max(1, prefillWaveCount))
    );
    beats.push({
      kind: 'wave',
      settledBefore: settledUnits,
      settledAfter,
      bankedPileCount: previousBankedPileCount,
      waveOrdinal,
    });
    waveOrdinal += 1;
    settledUnits = settledAfter;
  }
  if (bankTransferPages > 0) {
    beats.push({
      kind: 'transfer',
      settledBefore: settledUnits,
      settledAfter: 0,
      bankedPileCount: targetBankedPileCount,
      waveOrdinal: -1,
    });
    settledUnits = 0;
  }

  const refillWaveCount = Math.max(0, waveCount - prefillWaveCount);
  if (refillWaveCount > 0) {
    const refillStartUnits = settledUnits;
    const visibleFillWaves = Math.min(
      refillWaveCount,
      Math.max(
        1,
        requestedRefillWaves
      )
    );
    for (let index = 0; index < refillWaveCount; index += 1) {
      const settledAfter = index < visibleFillWaves
        ? Math.round(
            refillStartUnits +
              (targetStage - refillStartUnits) *
                ((index + 1) / visibleFillWaves)
          )
        : targetStage;
      beats.push({
        kind: 'wave',
        settledBefore: settledUnits,
        settledAfter,
        bankedPileCount: targetBankedPileCount,
        waveOrdinal,
      });
      waveOrdinal += 1;
      settledUnits = settledAfter;
    }
  }

  const acceleratedPourDurationMs = beats.reduce(
    (total, beat) => total + (beat.kind === 'transfer'
      ? compact ? 24 : BATTLE_CAPITAL_RACK_SHIFT_FRAME_MS
      : compact ? CAPITAL_STACK_BEAT_MS.compact : CAPITAL_COIN_WAVE_MS),
    0
  );
  const commandRechargeScale = acceleratedPourDurationMs > 0
    ? Math.max(1, legacyPourDurationMs) / acceleratedPourDurationMs
    : 1;
  const preloadFrame: CapitalStackTimelineFrame = {
    phase: 'preload',
    atMs: 0,
    durationMs: preloadMs,
    commandRechargeScale: 1,
    visibleUnits: previousStage,
    columnHeights: getCapitalColumnHeights(previousStage),
    bankedColumnHeights: previousBankedPileCount > 0
      ? fullColumnHeights
      : emptyColumnHeights,
    bankedPileCount: previousBankedPileCount,
    activeColumnIndices: [],
    incomingBundleCopies: 1,
    rackCompressed: heavy || bankTransferPages > 0,
    rackDepth: previousBankedPileCount,
    stackDepth: previousBankedPileCount,
    presentedCapital: event.previousCapital,
    packetSeed: seed,
  };

  let atMs = preloadMs;
  let completedWaveCount = 0;
  const activeWaveCount = beats.filter((beat) => beat.kind === 'wave').length;
  const pourFrames = beats.map((beat, index): CapitalStackTimelineFrame => {
    const isTransfer = beat.kind === 'transfer';
    const durationMs = isTransfer
      ? compact ? 24 : BATTLE_CAPITAL_RACK_SHIFT_FRAME_MS
      : compact ? CAPITAL_STACK_BEAT_MS.compact : CAPITAL_COIN_WAVE_MS;
    const progress = completedWaveCount / Math.max(1, activeWaveCount);
    const frame: CapitalStackTimelineFrame = {
      phase: 'pour',
      atMs,
      durationMs,
      commandRechargeScale,
      visibleUnits: beat.settledBefore,
      columnHeights: getCapitalColumnHeights(beat.settledBefore),
      settledAfterColumnHeights: isTransfer
        ? undefined
        : getCapitalColumnHeights(beat.settledAfter),
      bankedColumnHeights: beat.bankedPileCount > 0
        ? fullColumnHeights
        : emptyColumnHeights,
      bankedPileCount: beat.bankedPileCount,
      bankTransferPages: isTransfer ? bankTransferPages : undefined,
      activeColumnIndices: isTransfer
        ? []
        : getCapitalWaveColumnIndices(seed, beat.waveOrdinal),
      incomingBundleCopies: compact ? 1 : 3,
      incomingBundleLayers: CAPITAL_COIN_WAVE_BUNDLE_LAYERS,
      rackCompressed: heavy || bankTransferPages > 0,
      overflowPass: bankTransferPages > 0 ? 1 : undefined,
      stackBeat: index + 1,
      rackDepth: beat.bankedPileCount,
      stackDepth: isTransfer
        ? previousBankedPileCount
        : beat.bankedPileCount,
      rackShift: isTransfer,
      bankTransfer: isTransfer,
      presentedCapital: Math.round(
        event.previousCapital + capitalDistance * progress
      ),
      packetSeed: seed + (index + 1) * 7_919,
    };
    if (!isTransfer) completedWaveCount += 1;
    atMs += durationMs;
    return frame;
  });
  const pourDurationMs = atMs - preloadMs;
  const settleFrame: CapitalStackTimelineFrame = {
    phase: 'settle',
    atMs,
    durationMs: settleMs,
    commandRechargeScale: 1,
    visibleUnits: targetStage,
    columnHeights: getCapitalColumnHeights(targetStage),
    bankedColumnHeights: targetBankedPileCount > 0
      ? fullColumnHeights
      : emptyColumnHeights,
    bankedPileCount: targetBankedPileCount,
    activeColumnIndices: [],
    incomingBundleCopies: 1,
    rackCompressed: heavy,
    rackDepth: targetBankedPileCount,
    stackDepth: targetBankedPileCount,
    presentedCapital: event.nextCapital,
    packetSeed: seed + (pourFrames.length + 1) * 7_919,
  };
  return {
    event,
    beatMs,
    preloadMs,
    pourDurationMs,
    settleMs,
    totalMs: preloadMs + pourDurationMs + settleMs,
    frames: [preloadFrame, ...pourFrames, settleFrame],
  };
};

/**
 * Builds the SFC-style capital pour: one fixed 4/5/5/4 tray, one short gold
 * roll per active lane and no page banking. Tall piles remain continuous and
 * naturally clip above the viewport, exactly as late-game source captures do.
 */
export const buildCapitalStackTimeline = (
  event: CapitalStackEvent
): CapitalStackTimeline => {
  const compact = event.intensity === 'compact';
  const beatMs = compact ? CAPITAL_STACK_BEAT_MS.compact : CAPITAL_COIN_WAVE_MS;
  const preloadMs = compact ? 24 : CAPITAL_COIN_WAVE_MS;
  const settleMs = compact ? 72 : CAPITAL_COIN_WAVE_MS;
  const previousUnits = getBattleCapitalVisibleUnits(
    event.previousCapital,
    event.marketPrice
  );
  const targetUnits = getBattleCapitalVisibleUnits(
    event.nextCapital,
    event.marketPrice
  );
  const distance = Math.max(0, targetUnits - previousUnits);
  // The original's early bids are readable because even a small first wall is
  // built as a sequence, not as one broad pop. Keep nine authored beats for a
  // normal bid (one page), while tiny sub-nine-unit corrections still resolve
  // one visible unit at a time. Compact/reduced-motion remains a single beat.
  const waveCount = distance <= 0
    ? 0
    : compact
      ? 1
      : Math.min(CAPITAL_COIN_WAVES_PER_PAGE, Math.max(1, distance));
  const legacyTimeline = buildLegacyCapitalStackTimeline(event);
  const legacyPourDurationMs = legacyTimeline.frames
    .filter((frame) => frame.phase === 'pour')
    .reduce(
      (total, frame) =>
        total + frame.durationMs * frame.commandRechargeScale,
      0
    );
  const authoredPourDurationMs = waveCount * beatMs;
  const commandRechargeScale = authoredPourDurationMs > 0
    ? Math.max(1, legacyPourDurationMs) / authoredPourDurationMs
    : 1;
  const seed = Number.isFinite(event.seed) ? Math.trunc(event.seed) : 0;
  const capitalDistance = event.nextCapital - event.previousCapital;
  const emptyHeights = Array<number>(BATTLE_CAPITAL_COLUMN_COUNT).fill(0);
  const preloadFrame: CapitalStackTimelineFrame = {
    phase: 'preload',
    atMs: 0,
    durationMs: preloadMs,
    commandRechargeScale: 1,
    visibleUnits: previousUnits,
    columnHeights: getCapitalColumnHeights(previousUnits),
    bankedColumnHeights: emptyHeights,
    bankedPileCount: 0,
    activeColumnIndices: [],
    incomingBundleCopies: 1,
    rackDepth: 0,
    stackDepth: 0,
    presentedCapital: event.previousCapital,
    packetSeed: seed,
  };

  let atMs = preloadMs;
  const pourFrames = Array.from(
    { length: waveCount },
    (_, index): CapitalStackTimelineFrame => {
      const beforeProgress = index / Math.max(1, waveCount);
      const afterProgress = (index + 1) / Math.max(1, waveCount);
      const beforeUnits = Math.round(
        previousUnits + distance * beforeProgress
      );
      const afterUnits = Math.round(
        previousUnits + distance * afterProgress
      );
      const beforeHeights = getCapitalColumnHeights(beforeUnits);
      const afterHeights = getCapitalColumnHeights(afterUnits);
      const activeColumnIndices = CAPITAL_COLUMN_LEFT_TO_RIGHT_ORDER.filter(
        (columnIndex) => afterHeights[columnIndex] > beforeHeights[columnIndex]
      );
      const frame: CapitalStackTimelineFrame = {
        phase: 'pour',
        atMs,
        durationMs: beatMs,
        commandRechargeScale,
        visibleUnits: beforeUnits,
        columnHeights: beforeHeights,
        settledAfterColumnHeights: afterHeights,
        bankedColumnHeights: emptyHeights,
        bankedPileCount: 0,
        activeColumnIndices,
        incomingBundleCopies: 1,
        incomingBundleLayers: CAPITAL_COIN_WAVE_BUNDLE_LAYERS,
        stackBeat: index + 1,
        rackDepth: 0,
        stackDepth: 0,
        presentedCapital: Math.round(
          event.previousCapital + capitalDistance * beforeProgress
        ),
        packetSeed: seed + (index + 1) * 7_919,
      };
      atMs += beatMs;
      return frame;
    }
  );
  const settleFrame: CapitalStackTimelineFrame = {
    phase: 'settle',
    atMs,
    durationMs: settleMs,
    commandRechargeScale: 1,
    visibleUnits: targetUnits,
    columnHeights: getCapitalColumnHeights(targetUnits),
    bankedColumnHeights: emptyHeights,
    bankedPileCount: 0,
    activeColumnIndices: [],
    incomingBundleCopies: 1,
    rackDepth: 0,
    stackDepth: 0,
    presentedCapital: event.nextCapital,
    packetSeed: seed + (waveCount + 1) * 7_919,
  };
  const pourDurationMs = authoredPourDurationMs;
  return {
    event,
    beatMs,
    preloadMs,
    pourDurationMs,
    settleMs,
    totalMs: preloadMs + pourDurationMs + settleMs,
    frames: [preloadFrame, ...pourFrames, settleFrame],
  };
};

/**
 * Structural depth beyond the drawable fixed rack. The first familiar visual
 * grades remain continuous; beyond that point
 * the depth remains continuous and logarithmic, so another material funding
 * wave can lower the completed treasury again without creating an unbounded
 * amount-proportional particle system.
 */
export const getBattleCapitalOverflowDepth = (
  amount: number,
  marketPrice: number
) => {
  const overflowLayers = Math.max(
    0,
    getBattleCapitalLayerDemand(amount, marketPrice) -
      MAX_BATTLE_CAPITAL_COLUMN_LAYERS
  );
  if (overflowLayers <= 1e-9) return 0;
  const legacyCapacity = BATTLE_CAPITAL_OVERFLOW_LAYERS_PER_TIER * 3;
  if (overflowLayers <= legacyCapacity + 1e-9) {
    return Math.max(
      1,
      Math.ceil(
        overflowLayers / BATTLE_CAPITAL_OVERFLOW_LAYERS_PER_TIER - 1e-9
      )
    );
  }
  return 3 + Math.log2(overflowLayers / legacyCapacity);
};

const getCapitalWaveColumnIndices = (seed: number, waveIndex: number) => {
  const span =
    CAPITAL_COIN_WAVE_MAX_COLUMNS - CAPITAL_COIN_WAVE_MIN_COLUMNS + 1;
  const count = CAPITAL_COIN_WAVE_MIN_COLUMNS +
    Math.abs(Math.trunc(seed + waveIndex * 17)) % span;
  const rotation = Math.abs(Math.trunc(seed * 7 + waveIndex * 5)) %
    CAPITAL_COLUMN_LEFT_TO_RIGHT_ORDER.length;
  const rotated = [
    ...CAPITAL_COLUMN_LEFT_TO_RIGHT_ORDER.slice(rotation),
    ...CAPITAL_COLUMN_LEFT_TO_RIGHT_ORDER.slice(0, rotation),
  ];
  return rotated.slice(0, count);
};

/** Three bounded decoration grades; physical rack depth is continuous. */
export const getBattleCapitalOverflowTier = (
  amount: number,
  marketPrice: number
) => Math.min(3, Math.ceil(getBattleCapitalOverflowDepth(amount, marketPrice)));

/**
 * Bounded deterministic paint sequence. It changes only presentation state;
 * battle capital remains committed exactly once by the caller.
 */
export const getCapitalVisibleUnitSequence = (
  previousUnits: number,
  targetUnits: number,
  maxFrames: number
) => {
  const from = Math.max(
    0,
    Math.min(MAX_BATTLE_CAPITAL_VISIBLE_UNITS, Math.round(previousUnits))
  );
  const to = Math.max(
    0,
    Math.min(MAX_BATTLE_CAPITAL_VISIBLE_UNITS, Math.round(targetUnits))
  );
  if (from === to) return [to];
  const frameCount = Math.max(1, Math.min(30, Math.floor(maxFrames)));
  const distance = Math.abs(to - from);
  const direction = to > from ? 1 : -1;
  const steps = Math.min(distance, frameCount);
  const sequence: number[] = [];
  for (let index = 1; index <= steps; index += 1) {
    const next = index === steps
      ? to
      : from + direction * Math.max(1, Math.round(distance * index / steps));
    if (sequence.at(-1) !== next) sequence.push(next);
  }
  return sequence;
};

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

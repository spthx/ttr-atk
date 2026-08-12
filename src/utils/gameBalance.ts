import type { BattleMode, CommunityType, Property, TacticalSkill } from '../types';
import { COMMUNITY_CAMPAIGN_ORDER } from '../data/worldData';
import {
  BLACKEST_NIGHT_BALANCE,
  CAPITAL_REVERSAL_BALANCE,
  DIVINE_BENISON_BALANCE,
  ENEMY_SUPPORT_SKILL_BALANCE,
  FORCED_LIQUIDATION_BALANCE,
  SAVAGE_ENEMY_AUTO_PROFILES,
  SAVAGE_ENEMY_SUPPORT_PROFILES,
  ULTIMATE_ENEMY_AUTO_PATTERNS,
  type EnemySupportSkillId,
} from '../data/battleEncounterData';
import {
  CAMPAIGN_ENCOUNTER_DEFINITIONS,
  getCampaignEncounterDefinition,
} from '../data/campaignEncounterData';

export {
  BLACKEST_NIGHT_BALANCE,
  CAPITAL_REVERSAL_BALANCE,
  DIVINE_BENISON_BALANCE,
  ENEMY_SUPPORT_SKILL_BALANCE,
  FORCED_LIQUIDATION_BALANCE,
  ULTIMATE_ENEMY_AUTO_PATTERNS,
};
export type { EnemySupportSkillId };

export const PASSIVE_REVENUE_MULTIPLIER = 2;
export const INITIAL_PLAYER_FUNDS = 20_000;
export const PLAYER_BATTLE_CASH_CAP_RATIO = 1;
export const BATTLE_GAUGE_SPEED_FACTOR = 4;
export const NORMAL_BATTLE_GAUGE_SPEED_FACTOR = 4.5;
export const INITIAL_BATTLE_COMMAND_PROGRESS = 100;
export const TRAINING_GAUGE_SPEED_MULTIPLIER = 0.1;
export const TRAINING_MIN_OWNERSHIP_PERCENT = 1;
export const ENEMY_INITIAL_COMMITMENT_RATIO = 0.25;
export const SAVAGE_ENEMY_BUDGET_MULTIPLIER = 1.58;
export const SAVAGE_LAYER_BUDGET_MULTIPLIERS = [1, 1.08, 1.18, 1.25] as const;
export const SAVAGE_SERIES_BUDGET_MULTIPLIERS = [1, 1.035, 1.075] as const;
export const ULTIMATE_ENEMY_BUDGET_MULTIPLIER = 2.75;
export const LIMIT_BREAK_CHARGE_PER_BAR = 100;
export const LIMIT_BREAK_MAX_BARS = 3;

export const applyTrainingGaugeSpeed = (
  velocity: number,
  isTraining: boolean
) => velocity * (isTraining ? TRAINING_GAUGE_SPEED_MULTIPLIER : 1);

export const resolveBattleGaugeSpeedFactor = ({
  isTraining,
  isHighEndRaid,
}: {
  isTraining: boolean;
  isHighEndRaid: boolean;
}) =>
  isTraining || isHighEndRaid
    ? BATTLE_GAUGE_SPEED_FACTOR
    : NORMAL_BATTLE_GAUGE_SPEED_FACTOR;

/**
 * Claims a once-per-battle synergy without mutating the caller's Set.
 * Returning null lets the UI and effect handler share one atomic guard.
 */
export const claimBattleSynergyUsage = (
  usedSynergyIds: ReadonlySet<string>,
  synergyId: string
) => {
  if (usedSynergyIds.has(synergyId)) return null;
  const next = new Set(usedSynergyIds);
  next.add(synergyId);
  return next;
};

export const calculatePlayerBattleCashLimit = (marketPrice: number) =>
  Math.max(10, Math.round(Math.max(0, marketPrice) * PLAYER_BATTLE_CASH_CAP_RATIO));
export const holdTrainingGaugeAboveDefeat = (
  gauge: number,
  isTraining: boolean
) => isTraining
  ? Math.min(gauge, 100 - TRAINING_MIN_OWNERSHIP_PERCENT * 2)
  : gauge;

export const DIRECT_INVESTMENT_BALANCE = {
  baseGaugeImpact: 1.9,
  gaugeImpactPerMarketRatio: 29,
  largeCommitThresholdRatio: 0.1,
  largeCommitBonusPerMarketRatio: 19,
  standardImpactCap: 19,
  levelOneTrainingMultiplier: 12.5,
  levelOneTrainingImpactCap: 50,
  advancedTrainingMultiplier: 2,
  advancedTrainingImpactCap: 24,
} as const;

/**
 * Direct investment normally uses one campaign-wide curve. The first
 * training dummy alone amplifies that same input so a new player can see a
 * complete capital cycle in a few commands instead of grinding for minutes.
 */
export const calculateDirectInvestmentGaugeImpact = ({
  investmentAmount,
  marketPrice,
  windMultiplier = 1,
  levelOneTraining = false,
  trainingLevel,
}: {
  investmentAmount: number;
  marketPrice: number;
  windMultiplier?: number;
  levelOneTraining?: boolean;
  trainingLevel?: number;
}) => {
  const marketRatio =
    Math.max(0, investmentAmount) / Math.max(1, marketPrice);
  const baseImpact =
    (
      DIRECT_INVESTMENT_BALANCE.baseGaugeImpact +
      marketRatio * DIRECT_INVESTMENT_BALANCE.gaugeImpactPerMarketRatio +
      Math.max(
        0,
        marketRatio - DIRECT_INVESTMENT_BALANCE.largeCommitThresholdRatio
      ) * DIRECT_INVESTMENT_BALANCE.largeCommitBonusPerMarketRatio
    ) *
    Math.max(0, windMultiplier);

  const resolvedTrainingLevel = levelOneTraining ? 1 : trainingLevel;

  return resolvedTrainingLevel === 1
    ? Math.min(
        DIRECT_INVESTMENT_BALANCE.levelOneTrainingImpactCap,
        baseImpact *
          DIRECT_INVESTMENT_BALANCE.levelOneTrainingMultiplier
      )
    : resolvedTrainingLevel && resolvedTrainingLevel >= 2
      ? Math.min(
          DIRECT_INVESTMENT_BALANCE.advancedTrainingImpactCap,
          baseImpact *
            DIRECT_INVESTMENT_BALANCE.advancedTrainingMultiplier
        )
    : Math.min(
        DIRECT_INVESTMENT_BALANCE.standardImpactCap,
        baseImpact
      );
};

export type BattleTerminalWinner = 'player' | 'opponent' | null;

/**
 * Ownership alone decides a completed battle. Hand cash and enemy reserve are
 * deliberately absent so a temporary liquidity shortage can never settle it.
 */
export const getBattleTerminalWinner = (
  gauge: number
): BattleTerminalWinner => {
  if (gauge <= -100) return 'player';
  if (gauge >= 100) return 'opponent';
  return null;
};
export const LIMIT_BREAK_MAX_CHARGE =
  LIMIT_BREAK_CHARGE_PER_BAR * LIMIT_BREAK_MAX_BARS;
export const LIMIT_BREAK_CHARGE_GAIN_MULTIPLIER = 1.2;
export const BATTLE_CASH_RECOVERY_RATE_PER_SECOND = 0.003;
export const BATTLE_CASH_RECOVERY_TOTAL_CAP_RATIO = 0.2;

export interface EnemySupportDifficultyContext {
  isSavage?: boolean;
  isUltimate?: boolean;
  isCruel?: boolean;
}

export type BattleCashRecoveryWindType =
  | 'TAILWIND_PLAYER'
  | 'HEADWIND_PLAYER'
  | 'TAILWIND_ENEMY'
  | 'CROSSWIND'
  | 'CALM';

export const BATTLE_CASH_RECOVERY_WIND_MULTIPLIERS: Record<
  BattleCashRecoveryWindType,
  Readonly<{ player: number; enemy: number }>
> = {
  TAILWIND_PLAYER: { player: 1.25, enemy: 1 },
  HEADWIND_PLAYER: { player: 0.75, enemy: 1 },
  TAILWIND_ENEMY: { player: 1, enemy: 1.25 },
  CROSSWIND: { player: 1.2, enemy: 1.2 },
  CALM: { player: 1, enemy: 1 },
};

export interface BattleCashRecoveryState {
  availableFunds: number;
  cumulativeRecovered: number;
}

export interface BattleCashRecoveryStepInput
  extends BattleCashRecoveryState {
  baselineFunds: number;
  elapsedSeconds: number;
  timeScale: number;
  windMultiplier: number;
  terminal: boolean;
  cumulativeCapRatio?: number;
}

export interface BattleCashRecoveryStepResult
  extends BattleCashRecoveryState {
  recoveredThisStep: number;
  cumulativeRecoveryRatio: number;
}

const finiteNonNegative = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

/**
 * Advances one side's battle-local cash tank without touching ownership,
 * invested capital, or any persistent economy value.
 */
export const advanceBattleCashRecovery = ({
  baselineFunds,
  availableFunds,
  cumulativeRecovered,
  elapsedSeconds,
  timeScale,
  windMultiplier,
  terminal,
  cumulativeCapRatio = BATTLE_CASH_RECOVERY_TOTAL_CAP_RATIO,
}: BattleCashRecoveryStepInput): BattleCashRecoveryStepResult => {
  const baseline = finiteNonNegative(baselineFunds);
  // Drain may legitimately put the battle-local reserve above its authored
  // opening budget. Preserve that surplus; recovery waits until the reserve
  // falls below the original baseline instead of deleting transferred funds.
  const currentFunds = finiteNonNegative(availableFunds);
  const cumulativeCap =
    baseline * Math.max(
      0,
      Math.min(BATTLE_CASH_RECOVERY_TOTAL_CAP_RATIO, cumulativeCapRatio)
    );
  const recoveredSoFar = Math.min(
    cumulativeCap,
    finiteNonNegative(cumulativeRecovered)
  );
  const unchanged = {
    availableFunds: currentFunds,
    cumulativeRecovered: recoveredSoFar,
    recoveredThisStep: 0,
    cumulativeRecoveryRatio:
      baseline > 0 ? recoveredSoFar / baseline : 0,
  };

  if (
    terminal ||
    baseline <= 0 ||
    elapsedSeconds <= 0 ||
    timeScale <= 0 ||
    windMultiplier <= 0
  ) {
    return unchanged;
  }

  const requestedRecovery =
    baseline *
    BATTLE_CASH_RECOVERY_RATE_PER_SECOND *
    finiteNonNegative(elapsedSeconds) *
    finiteNonNegative(timeScale) *
    finiteNonNegative(windMultiplier);
  const recoveredThisStep = Math.min(
    requestedRecovery,
    Math.max(0, baseline - currentFunds),
    cumulativeCap - recoveredSoFar
  );
  const nextCumulativeRecovered =
    recoveredSoFar + recoveredThisStep;

  return {
    availableFunds: currentFunds + recoveredThisStep,
    cumulativeRecovered: nextCumulativeRecovered,
    recoveredThisStep,
    cumulativeRecoveryRatio:
      baseline > 0 ? nextCumulativeRecovered / baseline : 0,
  };
};

export const getBattleCashRecoveryWindMultipliers = (
  windType: BattleCashRecoveryWindType
) => BATTLE_CASH_RECOVERY_WIND_MULTIPLIERS[windType];

export interface BlackestNightGaugeInput {
  currentGauge: number;
  nextGauge: number;
  protects: 'player' | 'opponent';
  remainingGaugeCapacity: number;
}

/**
 * Shared player/enemy finite barrier resolver. It deliberately contains no
 * React state or timers so the same contract can be exported to Unity.
 */
export const applyBlackestNightToGaugeDelta = ({
  currentGauge,
  nextGauge,
  protects,
  remainingGaugeCapacity,
}: BlackestNightGaugeInput) => {
  const current = Number.isFinite(currentGauge) ? currentGauge : 0;
  const candidate = Number.isFinite(nextGauge) ? nextGauge : current;
  const capacity = finiteNonNegative(remainingGaugeCapacity);
  const delta = candidate - current;
  const incoming =
    protects === 'player' ? Math.max(0, delta) : Math.max(0, -delta);
  const absorbedGauge = Math.min(
    incoming * BLACKEST_NIGHT_BALANCE.absorbRatio,
    capacity
  );
  const nextCapacity = Math.max(0, capacity - absorbedGauge);

  return {
    nextGauge:
      protects === 'player'
        ? candidate - absorbedGauge
        : candidate + absorbedGauge,
    absorbedGauge,
    remainingGaugeCapacity: nextCapacity,
    didFullyBreak: capacity > 0 && incoming > 0 && nextCapacity === 0,
  };
};

export const getBlackestNightDisplayPercent = ({
  remainingGaugeCapacity,
  remainingMs,
}: {
  remainingGaugeCapacity: number;
  remainingMs: number;
}) => {
  if (remainingGaugeCapacity <= 0 || remainingMs <= 0) return 0;
  const capacityRatio =
    finiteNonNegative(remainingGaugeCapacity) /
    BLACKEST_NIGHT_BALANCE.gaugeCapacity;
  const timeRatio =
    finiteNonNegative(remainingMs) / BLACKEST_NIGHT_BALANCE.durationMs;
  const rawPercent = Math.max(0, Math.min(1, capacityRatio, timeRatio)) * 100;
  return Math.max(5, Math.min(100, Math.ceil(rawPercent / 5) * 5));
};

export const shouldEnemyUseBlackestNight = ({
  playerOwnership,
  terminal,
}: {
  playerOwnership: number;
  terminal: boolean;
}) =>
  !terminal &&
  normalizeBattleOwnership(playerOwnership) >=
    BLACKEST_NIGHT_BALANCE.triggerPlayerOwnership;

export const getBlackestNightDarkWaveGaugeDelta = (
  protects: 'player' | 'opponent'
) =>
  protects === 'player'
    ? -BLACKEST_NIGHT_BALANCE.darkWaveGaugeDelta
    : BLACKEST_NIGHT_BALANCE.darkWaveGaugeDelta;

/** Resolves the one direct-investment hit consumed by 資本反転. */
export const resolveCapitalReversal = (
  intendedOwnershipPush: number,
  reflectedOwnershipCap: number = CAPITAL_REVERSAL_BALANCE.reflectedOwnershipCap
) => {
  const intended = finiteNonNegative(intendedOwnershipPush);
  const normalizedReflectionCap = Number.isFinite(reflectedOwnershipCap)
    ? finiteNonNegative(reflectedOwnershipCap)
    : Number.POSITIVE_INFINITY;
  const retainedOwnershipPush =
    intended * CAPITAL_REVERSAL_BALANCE.retainedDirectInvestmentRatio;
  const reflectedOwnershipPush = Math.min(
    intended * CAPITAL_REVERSAL_BALANCE.reflectedOwnershipRatio,
    normalizedReflectionCap
  );
  return {
    retainedOwnershipPush,
    reflectedOwnershipPush,
    netPlayerOwnershipPush: retainedOwnershipPush - reflectedOwnershipPush,
    gaugeDelta: (reflectedOwnershipPush - retainedOwnershipPush) * 2,
  };
};

/** Unmitigated 強制清算 pressure; mitigation and barriers apply afterwards. */
export const calculateForcedLiquidationGaugeDelta = (
  currentPlayerOwnership: number
) =>
  Math.max(
    0,
    normalizeBattleOwnership(currentPlayerOwnership) -
      FORCED_LIQUIDATION_BALANCE.unmitigatedTargetPlayerOwnership
  ) * 2;

/**
 * Resolves the continuous ownership velocity during 強制清算 recovery.
 *
 * Both sides pause during the authored grace. If the player lets that grace
 * expire without answering, enemy pressure resumes but pre-cast player-side
 * pressure stays suspended until the first genuine counter-command.
 */
export const resolveForcedLiquidationContinuousVelocity = ({
  velocity,
  recoveryRemaining,
  awaitingManualCounter,
}: {
  velocity: number;
  recoveryRemaining: number;
  awaitingManualCounter: boolean;
}) => {
  if (awaitingManualCounter) {
    return recoveryRemaining > 0 ? 0 : Math.max(0, velocity);
  }
  return recoveryRemaining > 0 ? Math.min(0, velocity) : velocity;
};

/** @deprecated Use the Blackest Night names in current runtime code. */
export type DivineBenisonGaugeInput = BlackestNightGaugeInput;
/** @deprecated Use applyBlackestNightToGaugeDelta. */
export const applyDivineBenisonToGaugeDelta = applyBlackestNightToGaugeDelta;
/** @deprecated Use getBlackestNightDisplayPercent. */
export const getDivineBenisonDisplayPercent = getBlackestNightDisplayPercent;
/** @deprecated Use shouldEnemyUseBlackestNight. */
export const shouldEnemyUseDivineBenison = shouldEnemyUseBlackestNight;

export const calculateEnemyDrainAmount = ({
  playerCash,
  marketPrice,
}: {
  playerCash: number;
  marketPrice: number;
}) =>
  Math.max(
    0,
    Math.min(
      Math.round(
        finiteNonNegative(playerCash) *
          ENEMY_SUPPORT_SKILL_BALANCE.drain.handCashRatio
      ),
      Math.round(
        finiteNonNegative(marketPrice) *
          ENEMY_SUPPORT_SKILL_BALANCE.drain.marketPriceCapRatio
      )
    )
  );

/** Moves only uncommitted battle cash; ownership, invested capital and LB stay untouched. */
export const resolveEnemyDrainTransfer = ({
  playerCash,
  enemyReserve,
  marketPrice,
}: {
  playerCash: number;
  enemyReserve: number;
  marketPrice: number;
}) => {
  const safePlayerCash = finiteNonNegative(playerCash);
  const safeEnemyReserve = finiteNonNegative(enemyReserve);
  const transferred = calculateEnemyDrainAmount({
    playerCash: safePlayerCash,
    marketPrice,
  });
  return {
    playerCash: safePlayerCash - transferred,
    enemyReserve: safeEnemyReserve + transferred,
    transferred,
  };
};

export const getEnemyDrillOwnershipPush = ({
  isSavage = false,
  isUltimate = false,
  isCruel = false,
}: EnemySupportDifficultyContext) =>
  isUltimate || isCruel
    ? ENEMY_SUPPORT_SKILL_BALANCE.drill.ultimateOwnershipPush
    : isSavage
      ? ENEMY_SUPPORT_SKILL_BALANCE.drill.savageOwnershipPush
      : ENEMY_SUPPORT_SKILL_BALANCE.drill.normalOwnershipPush;

export const calculateEnemyDrillReserveCost = (enemyBudget: number) =>
  finiteNonNegative(enemyBudget) <= 0
    ? 0
    : Math.max(
        1,
        Math.round(
          finiteNonNegative(enemyBudget) *
            ENEMY_SUPPORT_SKILL_BALANCE.drill.reserveCostRatio
        )
      );

export const canEnemyAffordDrill = (
  enemyReserve: number,
  enemyBudget: number
) =>
  calculateEnemyDrillReserveCost(enemyBudget) > 0 &&
  finiteNonNegative(enemyReserve) >=
    calculateEnemyDrillReserveCost(enemyBudget);

/**
 * Ultimate cannot be defeated by skipping its authored critical action with one
 * oversized push. This is a mechanic check, not extra enemy capital: draining
 * the reserve needed for Drill remains a valid way to deny that action.
 */
export const shouldForceUltimateCriticalBeforeVictory = ({
  isUltimate,
  terminalWinner,
  criticalSkillId,
  criticalSkillUsed,
  gateConsumed,
  enemyReserve,
  enemyBudget,
}: {
  isUltimate: boolean;
  terminalWinner: 'player' | 'opponent' | null;
  criticalSkillId: EnemySupportSkillId | null;
  criticalSkillUsed: boolean;
  gateConsumed: boolean;
  enemyReserve: number;
  enemyBudget: number;
}) =>
  isUltimate &&
  terminalWinner === 'player' &&
  criticalSkillId !== null &&
  !criticalSkillUsed &&
  !gateConsumed &&
  (
    criticalSkillId !== 'drill' ||
    canEnemyAffordDrill(enemyReserve, enemyBudget)
  );

export const getEnemyDrillImpact = ({
  enemyBudget,
  isSavage = false,
  isUltimate = false,
  isCruel = false,
}: EnemySupportDifficultyContext & { enemyBudget: number }) => {
  const baseOwnershipPush = getEnemyDrillOwnershipPush({
    isSavage,
    isUltimate,
    isCruel,
  });
  const ownershipPush = Number(baseOwnershipPush.toFixed(2));
  return {
    baseOwnershipPush,
    ownershipPush,
    gaugeDelta: Number((ownershipPush * 2).toFixed(2)),
    reserveCost: calculateEnemyDrillReserveCost(enemyBudget),
  };
};

export const getEnemyDivinationDurationMs = ({
  isSavage = false,
  isUltimate = false,
  isCruel = false,
}: EnemySupportDifficultyContext) =>
  isSavage || isUltimate || isCruel
    ? ENEMY_SUPPORT_SKILL_BALANCE.divination.highDifficultyDurationMs
    : ENEMY_SUPPORT_SKILL_BALANCE.divination.normalDurationMs;

export const TACTICAL_SKILL_BALANCE = {
  fastAction: {
    durationMs: 15_000,
    cooldownMs: 0,
    maxUsesPerBattle: 1,
    baseCommandProgressPerTick: 2.8,
    boostedCommandProgressPerTick: 5.2,
  },
  moraleSupport: {
    loyaltyRiskDivisor: 2,
  },
  disruption: {
    /** Legacy STUN data retained only for older authored content. */
    durationMs: 0,
    interruptChance: 1,
    collapseMarketRatio: 0,
    requiresEnemyTelegraph: true,
    maxInterruptsPerUse: 1,
  },
  feint: {
    durationMs: 10_000,
    enemyPushMultiplier: 0.9,
    maxUsesPerBattle: 1,
  },
  cover: {
    durationMs: 16_000,
    absorbRatio: 0.92,
    gaugeCapacity: 84,
  },
  capitalBoost: {
    marketRatio: 0.4,
  },
  livingDead: {
    waitingDurationMs: 10_000,
    recoveryDurationMs: 10_000,
    minimumOwnership: 1,
    recoveryOwnership: 30,
    requiredAssetValue: 1_000_000,
  },
} as const;

export const calculateBattleVictoryReward = (
  marketPrice: number,
  isPlayerVictory: boolean,
  mode: BattleMode,
  alreadyCleared = false
) => {
  if (
    !isPlayerVictory ||
    mode === 'training' ||
    (mode !== 'normal' && alreadyCleared)
  ) {
    return 0;
  }
  return Math.round(Math.max(0, marketPrice) * 0.05);
};

export type LivingDeadPhase =
  | 'inactive'
  | 'waiting'
  | 'recovery'
  | 'survived'
  | 'failed';

export type LivingDeadOutcome =
  | 'none'
  | 'waiting_expired'
  | 'triggered'
  | 'recovered'
  | 'failed';

export const normalizeBattleOwnership = (ownership: number) =>
  Number.isFinite(ownership) ? Math.max(0, Math.min(100, ownership)) : 0;

export const calculateOwnershipFromGauge = (gauge: number) =>
  normalizeBattleOwnership((100 - gauge) / 2);

export const NORMAL_CLOSEOUT_OWNERSHIP_THRESHOLD = 85;
export const NORMAL_CLOSEOUT_MIN_GAUGE_PER_SECOND = 0.75;

/**
 * Prevents a normal battle from lingering after one side has earned a decisive
 * lead. The floor only follows the current pressure direction, so a capital
 * reversal immediately cancels or reverses the closeout push.
 */
export const applyNormalClosingMomentum = ({
  velocity,
  gauge,
  isTraining,
  isHighEndRaid,
}: {
  velocity: number;
  gauge: number;
  isTraining: boolean;
  isHighEndRaid: boolean;
}) => {
  if (isTraining || isHighEndRaid) return velocity;

  const playerOwnership = calculateOwnershipFromGauge(gauge);
  if (
    playerOwnership >= NORMAL_CLOSEOUT_OWNERSHIP_THRESHOLD &&
    velocity < 0
  ) {
    return Math.min(velocity, -NORMAL_CLOSEOUT_MIN_GAUGE_PER_SECOND);
  }
  if (
    playerOwnership <= 100 - NORMAL_CLOSEOUT_OWNERSHIP_THRESHOLD &&
    velocity > 0
  ) {
    return Math.max(velocity, NORMAL_CLOSEOUT_MIN_GAUGE_PER_SECOND);
  }
  return velocity;
};

export const CRITICAL_AUTO_OWNERSHIP_THRESHOLD = 25;

export interface CriticalAutoInterception {
  shouldIntercept: boolean;
  heldGauge: number;
}

export type CriticalAutoResolutionPhase =
  | 'idle'
  | 'held'
  | 'cinematic'
  | 'effect_committed'
  | 'presentation_complete';

export type CriticalAutoResolutionEvent =
  | 'hold'
  | 'start_cinematic'
  | 'commit_effect'
  | 'complete_presentation'
  | 'release'
  | 'cancel';

/**
 * Pure ordering contract for the critical AUTO interrupt. The web UI and a
 * future Unity runner can share the same rule: hold the battle, show the
 * ability, commit its effect, finish any capital presentation, then release.
 * Invalid out-of-order events are ignored instead of unlocking combat early.
 */
export const advanceCriticalAutoResolution = (
  phase: CriticalAutoResolutionPhase,
  event: CriticalAutoResolutionEvent
): CriticalAutoResolutionPhase => {
  if (event === 'cancel') return 'idle';
  if (phase === 'idle' && event === 'hold') return 'held';
  if (phase === 'held' && event === 'start_cinematic') return 'cinematic';
  if (phase === 'cinematic' && event === 'commit_effect') {
    return 'effect_committed';
  }
  if (
    phase === 'effect_committed' &&
    event === 'complete_presentation'
  ) {
    return 'presentation_complete';
  }
  if (phase === 'presentation_complete' && event === 'release') return 'idle';
  return phase;
};

/**
 * Resolves the state boundary for a once-per-battle critical AUTO skill.
 *
 * The triggering enemy push stops at 25% ownership before the AUTO effect is
 * resolved. Its overshoot is deliberately not replayed afterwards. A late
 * frame may observe the player just below the line, so the once-per-battle
 * interrupt still restores the held 25% boundary instead of firing uselessly
 * at 7% immediately before defeat. The caller must arm this transition before
 * combat pressure begins; it must not become available dynamically below the
 * threshold. Named mechanics that have already resolved all mitigation may
 * opt into preserving their candidate value while still triggering the AUTO.
 */
export const resolveCriticalAutoInterception = ({
  currentGauge,
  candidateGauge,
  canIntercept,
  preserveResolvedCandidate = false,
}: {
  currentGauge: number;
  candidateGauge: number;
  canIntercept: boolean;
  preserveResolvedCandidate?: boolean;
}): CriticalAutoInterception => {
  if (
    !canIntercept ||
    !Number.isFinite(currentGauge) ||
    !Number.isFinite(candidateGauge) ||
    candidateGauge <= currentGauge ||
    calculateOwnershipFromGauge(candidateGauge) >
      CRITICAL_AUTO_OWNERSHIP_THRESHOLD
  ) {
    return { shouldIntercept: false, heldGauge: candidateGauge };
  }

  const thresholdGauge =
    100 - CRITICAL_AUTO_OWNERSHIP_THRESHOLD * 2;
  return {
    shouldIntercept: true,
    heldGauge: preserveResolvedCandidate
      ? candidateGauge
      : thresholdGauge,
  };
};

export const resolveLivingDeadOutcome = (
  phase: LivingDeadPhase,
  ownership: number,
  remainingMs: number
): LivingDeadOutcome => {
  const normalizedOwnership = normalizeBattleOwnership(ownership);
  if (phase === 'waiting') {
    if (remainingMs <= 0) return 'waiting_expired';
    if (normalizedOwnership <= 0) return 'triggered';
  }
  if (phase === 'recovery') {
    if (normalizedOwnership >= TACTICAL_SKILL_BALANCE.livingDead.recoveryOwnership) {
      return 'recovered';
    }
    if (remainingMs <= 0) return 'failed';
  }
  return 'none';
};

export const LIMIT_BREAK_MULTIPLIERS = {
  1: 1.56,
  2: 1.98,
  3: 2.46,
} as const;

export type LimitBreakTier = 0 | 1 | 2 | 3;

export const LIMIT_BREAK_OWNERSHIP_CAPS: Record<
  Exclude<LimitBreakTier, 0>,
  number
> = {
  1: 7,
  2: 14,
  3: 30,
};

/**
 * Early LIMIT BREAKs still aggregate every participating company, but may not
 * turn a cheap target after a price-band transition into several targets'
 * worth of permanent capital. LB3 remains the uncapped late-game payoff.
 */
export const LIMIT_BREAK_CAPITAL_CAP_RATIOS: Record<
  Exclude<LimitBreakTier, 0>,
  number | null
> = {
  1: 0.8,
  2: 1.2,
  3: null,
};

export const ENEMY_BALANCE_FACTOR = {
  tutorial: 0.98,
  gridania: 1.3,
  limsa: 1.42,
  uldah: 1.55,
  goldSaucer: 1.68,
  advanced: 1.55,
  cartelMember: 1.68,
  cartelHQ: 1.85,
} as const;

export const BATTLE_SUPPORT_BALANCE = {
  subsidiaryMarketRatio: 0.75,
  subsidiaryImpactBase: 2.5,
  subsidiaryImpactPerMarketRatio: 13,
  subsidiaryImpactCap: 12,
  synergyMemberMarketRatio: 0.65,
  synergyDefaultMultiplier: 1.45,
  synergyImpactBase: 5,
  synergyImpactPerMarketRatio: 13,
  synergyImpactCap: 22,
} as const;

/**
 * One network request retains full strength. Every later direct request in the
 * same battle decays even when the player changes companies, so rotating the
 * contact list cannot bypass diminishing returns. The shared counter is
 * battle-local, so old saves need no migration.
 */
export const REPEATED_NETWORK_SUPPORT_BALANCE = {
  fullStrengthUses: 1,
  reductionPerPreviousUse: 0.1,
  minimumMultiplier: 0.5,
} as const;

/**
 * High difficulty asks the player to plan a build instead of replacing every
 * mistake with another company call. Savage has room to learn the authored
 * guard baits. Ultimate is tighter: eight requests make the player assign each
 * contact to a telegraphed danger instead of consuming a full support rotation.
 * Cruel keeps its separate assessment tuning.
 */
export const SAVAGE_NETWORK_SUPPORT_LIMIT = 18;
export const ULTIMATE_NETWORK_SUPPORT_LIMIT = 8;
export const ULTIMATE_LIMIT_BREAK_LIMIT = 1;
export const ULTIMATE_APPRAISAL_LIMIT_MS = 108_000;

export const canRequestLimitedNetworkSupport = (
  previousUses: number,
  limit: number
) => {
  const normalizedUses = Number.isFinite(previousUses)
    ? Math.max(0, Math.floor(previousUses))
    : 0;
  return normalizedUses < Math.max(0, Math.floor(limit));
};

export const getRepeatedNetworkSupportMultiplier = (previousUses: number) => {
  const normalizedUses = Number.isFinite(previousUses)
    ? Math.max(0, Math.floor(previousUses))
    : 0;
  const decaySteps = Math.max(
    0,
    normalizedUses - (REPEATED_NETWORK_SUPPORT_BALANCE.fullStrengthUses - 1)
  );
  return Math.max(
    REPEATED_NETWORK_SUPPORT_BALANCE.minimumMultiplier,
    1 - REPEATED_NETWORK_SUPPORT_BALANCE.reductionPerPreviousUse * decaySteps
  );
};

export const applyRepeatedNetworkSupportDecay = (
  amount: number,
  previousUses: number
) =>
  Math.round(
    Math.max(0, amount) * getRepeatedNetworkSupportMultiplier(previousUses)
  );

export const BATTLE_LOYALTY_BALANCE = {
  individualRiskIncrease: 12,
  limitBreakRiskIncrease: 8,
  synergyRiskIncrease: 10,
  // 五分の祝儀は勝利利益の50%を人脈全体へ均等に配る。
  // 大盤振る舞いは利益をすべて配り、今回の離反を防いで危険度も回復する。
  profitShareRewardRatio: 0.5,
  lavishRiskRecovery: 30,
  reacquisitionSupportBonusPerLevel: 0.1,
  reacquisitionRiskReductionPerLevel: 2,
  maxReacquisitionLevel: 2,
} as const;

/**
 * Endgame duties are fought by the whole acquired network, not petty cash.
 * The extra weight keeps ally calls satisfying after enemy barriers, Passage and
 * LB3 were made meaningful, without raising the player's personal bankroll.
 */
export const HIGH_DIFFICULTY_SUPPORT_MULTIPLIER = 1.7;

export const PROFIT_ALLOCATION_OPTIONS = [
  {
    id: 'keep',
    label: '利益独占',
    rate: 0,
    departureProbabilityMultiplier: 1,
    loyaltyRiskReduction: 0,
  },
  {
    id: 'share50',
    label: '五分の祝儀',
    rate: 0.5,
    // 高コストに見合う強い抑止。ただし離反を保証で0にはしない。
    departureProbabilityMultiplier: 0.2,
    loyaltyRiskReduction: 0,
  },
  {
    id: 'share100',
    label: '大盤振る舞い',
    rate: 1,
    departureProbabilityMultiplier: 0,
    loyaltyRiskReduction: BATTLE_LOYALTY_BALANCE.lavishRiskRecovery,
  },
] as const;

export type ProfitAllocationOption =
  (typeof PROFIT_ALLOCATION_OPTIONS)[number];
export type ProfitAllocationOptionId = ProfitAllocationOption['id'];
export type ProfitAllocationRate = ProfitAllocationOption['rate'];

export const getReacquisitionLevel = (property: Property) =>
  Math.max(
    0,
    Math.min(
      BATTLE_LOYALTY_BALANCE.maxReacquisitionLevel,
      Math.floor(property.reacquisitionLevel ?? 0)
    )
  );

export const isExtremeReacquisition = (property: Property) =>
  property.owner === 'independent' && getReacquisitionLevel(property) > 0;

export const EXTREME_REACQUISITION_BALANCE = {
  budgetMultiplierByLevel: [1, 1.2, 1.35],
  maximumDifficultyLevel: 5,
} as const;

export const getExtremeReacquisitionBudgetMultiplier = (
  property: Property
) =>
  isExtremeReacquisition(property)
    ? EXTREME_REACQUISITION_BALANCE.budgetMultiplierByLevel[
        getReacquisitionLevel(property)
      ]
    : 1;

export const getExtremeReacquisitionOpeningSkill = (
  property: Property
): EnemySupportSkillId => {
  const campaignIndex = COMMUNITY_CAMPAIGN_ORDER.indexOf(property.community);
  // Extreme reacquisition is a payoff battle. It may present a small barrier,
  // but never takes permanent cash through Drain.
  if (campaignIndex <= 2) return 'blackest_night';
  if (campaignIndex <= 6) return 'divination';
  return 'drill';
};

export const getSubsidiarySupportMultiplier = (property: Property) =>
  1 +
  getReacquisitionLevel(property) *
    BATTLE_LOYALTY_BALANCE.reacquisitionSupportBonusPerLevel;

export const calculateSubsidiarySupportAmount = (
  property: Property,
  previousNetworkSupportUses = 0
) =>
  applyRepeatedNetworkSupportDecay(
    property.marketPrice *
      BATTLE_SUPPORT_BALANCE.subsidiaryMarketRatio *
      getSubsidiarySupportMultiplier(property),
    previousNetworkSupportUses
  );

/** Inverts the LIMIT BREAK pressure formula: amount / price * 85 = push pt. */
export const calculateLimitBreakPushGilEquivalent = (
  marketPrice: number,
  ownershipPoints: number
) =>
  Math.round(
    (Math.max(0, marketPrice) * Math.max(0, ownershipPoints)) / 85
  );

export const sortSubsidiariesBySupport = (properties: Property[]) =>
  [...properties].sort((left, right) => {
    const supportDifference =
      calculateSubsidiarySupportAmount(right) -
      calculateSubsidiarySupportAmount(left);
    if (supportDifference !== 0) return supportDifference;
    return left.name.localeCompare(right.name, 'ja');
  });

export const getSubsidiaryRiskIncrease = (
  property: Property,
  baseIncrease: number
) =>
  Math.max(
    1,
    baseIncrease -
      getReacquisitionLevel(property) *
        BATTLE_LOYALTY_BALANCE.reacquisitionRiskReductionPerLevel
  );

export const calculateProfitAllocationCost = (
  subsidiaries: Property[],
  victoryReward: number,
  rate: number = BATTLE_LOYALTY_BALANCE.profitShareRewardRatio
) => {
  const normalizedRate = Number.isFinite(rate)
    ? Math.max(0, Math.min(1, rate))
    : 0;
  if (
    subsidiaries.length === 0 ||
    victoryReward <= 0 ||
    normalizedRate <= 0
  ) {
    return 0;
  }
  // `rate` is the total pool shared by every ally, not a per-ally charge.
  return Math.max(
    1,
    Math.round(victoryReward * normalizedRate)
  );
};

/**
 * A target-independent company strength score used by the map comparison and
 * victory growth presentation. Cash is immediately deployable; subsidiaries
 * contribute their repeatable support value and stable revenue.
 */
export const calculateCompanyStrengthScore = (
  totalFunds: number,
  subsidiaries: Property[]
) =>
  Math.max(
    0,
    Math.round(
      Math.max(0, totalFunds) +
        subsidiaries.reduce(
          (total, property) =>
            total +
            property.marketPrice *
              BATTLE_SUPPORT_BALANCE.subsidiaryMarketRatio *
              getSubsidiarySupportMultiplier(property) +
            property.annualRevenue * PASSIVE_REVENUE_MULTIPLIER * 12,
          0
        )
    )
  );

export interface CompanyStrengthLevel {
  level: number;
  progressPercent: number;
  currentThreshold: number;
  nextThreshold: number;
}

export const getCompanyStrengthLevel = (
  strengthScore: number
): CompanyStrengthLevel => {
  const score = Math.max(0, strengthScore);
  const level = Math.max(
    1,
    Math.min(99, Math.floor(Math.log2(score / 5_000 + 1) * 4) + 1)
  );
  const currentThreshold =
    5_000 * (2 ** ((level - 1) / 4) - 1);
  const nextThreshold =
    5_000 * (2 ** (level / 4) - 1);
  const progressPercent =
    nextThreshold <= currentThreshold
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ((score - currentThreshold) /
              (nextThreshold - currentThreshold)) *
              100
          )
        );
  return {
    level,
    progressPercent,
    currentThreshold: Math.round(currentThreshold),
    nextThreshold: Math.round(nextThreshold),
  };
};

export const getEnemyMinimumCommitment = (marketPrice: number) =>
  Math.max(10, Math.round(Math.max(0, marketPrice) * 0.02));

/** Normal-mode only. Savage and Ultimate keep their full encounter budgets. */
export const NORMAL_ENEMY_BUDGET_MULTIPLIER = 0.96;

export const NORMAL_ENEMY_CAMPAIGN_MULTIPLIERS = {
  tutorial: 0.62,
  gridania: 0.82,
  limsa: 0.86,
  midgameAndLater: 1,
} as const;

export const getNormalEnemyCampaignMultiplier = (
  targetProperty: Property,
  isTutorial: boolean
) => {
  if (isTutorial) return NORMAL_ENEMY_CAMPAIGN_MULTIPLIERS.tutorial;
  const campaignIndex = COMMUNITY_CAMPAIGN_ORDER.indexOf(
    targetProperty.community
  );
  if (campaignIndex === 0) {
    return NORMAL_ENEMY_CAMPAIGN_MULTIPLIERS.gridania;
  }
  if (campaignIndex === 1) {
    return NORMAL_ENEMY_CAMPAIGN_MULTIPLIERS.limsa;
  }
  return NORMAL_ENEMY_CAMPAIGN_MULTIPLIERS.midgameAndLater;
};

interface InfluenceBudgetModifier {
  enemyBudgetDiscount: number;
}

interface EnemyBudgetContext {
  targetProperty: Property;
  industryInfluence: InfluenceBudgetModifier;
  regionalInfluence: InfluenceBudgetModifier;
  isTutorial: boolean;
  isSavage?: boolean;
  isUltimate?: boolean;
  isCruel?: boolean;
  isCityBoss?: boolean;
}

interface SkillUnlockContext {
  skill: TacticalSkill;
  ownedProperties: Property[];
  totalFunds: number;
  activeSynergyCount: number;
  conqueredCommunityIds?: ReadonlySet<CommunityType>;
  savageClearedRaidIds?: ReadonlySet<string>;
}

export const countsTowardCityConquest = (property: Property) =>
  property.countsTowardCityConquest !== false;

export const getCampaignProperties = (
  properties: Property[],
  community: CommunityType
) => {
  const propertyById = new Map(
    properties.map((property) => [property.id, property])
  );
  return CAMPAIGN_ENCOUNTER_DEFINITIONS.flatMap((definition) => {
    const property = propertyById.get(definition.targetPropertyId);
    return property &&
      property.community === community &&
      countsTowardCityConquest(property)
      ? [property]
      : [];
  });
};

export type BossAbilityTier =
  | 'none'
  | 'boss'
  | 'cover'
  | 'enhanced_cover'
  | 'invincible';

export const isNormalCityBoss = (
  properties: Property[],
  targetProperty: Property
) => {
  const cityTargets = getCampaignProperties(
    properties,
    targetProperty.community
  );
  return cityTargets.at(-1)?.id === targetProperty.id;
};

export const getBossAbilityTier = ({
  targetProperty,
  isCityBoss,
  isSavage = false,
  isUltimate = false,
  isCruel = false,
}: {
  targetProperty: Property;
  isCityBoss: boolean;
  isSavage?: boolean;
  isUltimate?: boolean;
  isCruel?: boolean;
}): BossAbilityTier => {
  if (isUltimate) return 'invincible';
  if (isCruel) return 'enhanced_cover';
  if (isSavage) {
    const layer = getSavageLayer(targetProperty);
    if (layer >= 4) return 'invincible';
    if (layer >= 2) return 'enhanced_cover';
    return 'cover';
  }
  // A returning company is a reward battle against a slightly strengthened
  // former subsidiary, not a replay of a late boss's long invulnerability.
  if (isExtremeReacquisition(targetProperty)) return 'boss';
  if (isCityBoss) {
    const campaignIndex = COMMUNITY_CAMPAIGN_ORDER.indexOf(
      targetProperty.community
    );
    if (campaignIndex >= 9) return 'invincible';
    if (campaignIndex >= 7) return 'enhanced_cover';
    if (campaignIndex >= 3) return 'cover';
    return 'boss';
  }
  if (targetProperty.isCartelHQ) return 'enhanced_cover';
  if (targetProperty.cartelId) return 'cover';
  return 'none';
};

export const BOSS_COVER_BALANCE = {
  triggerPlayerOwnership: 60,
  cover: {
    durationMs: 18_000,
    absorbRatio: 0.84,
    gaugeCapacity: 58,
    counterCapitalRatio: 0.06,
  },
  enhancedCover: {
    durationMs: 16_000,
    absorbRatio: 0.92,
    gaugeCapacity: 84,
    counterCapitalRatio: 0.12,
  },
  invincible: {
    durationMs: 5_000,
    absorbRatio: 1,
    gaugeCapacity: Number.POSITIVE_INFINITY,
    counterCapitalRatio: 0.18,
    followupDurationMs: 6_000,
    followupGaugeCapacity: 44,
  },
} as const;

export const applyCoverToGaugeDelta = ({
  currentGauge,
  nextGauge,
  protects,
  absorbRatio,
  remainingGaugeCapacity,
}: {
  currentGauge: number;
  nextGauge: number;
  protects: 'player' | 'opponent';
  absorbRatio: number;
  remainingGaugeCapacity: number;
}) => {
  const delta = nextGauge - currentGauge;
  const incoming =
    protects === 'player' ? Math.max(0, delta) : Math.max(0, -delta);
  if (incoming <= 0 || absorbRatio <= 0 || remainingGaugeCapacity <= 0) {
    return {
      nextGauge,
      absorbedGauge: 0,
      remainingGaugeCapacity: Math.max(0, remainingGaugeCapacity),
    };
  }
  const absorbedGauge = Math.min(
    incoming * Math.min(1, Math.max(0, absorbRatio)),
    remainingGaugeCapacity
  );
  return {
    nextGauge:
      protects === 'player'
        ? nextGauge - absorbedGauge
        : nextGauge + absorbedGauge,
    absorbedGauge,
    remainingGaugeCapacity: Math.max(
      0,
      remainingGaugeCapacity - absorbedGauge
    ),
  };
};

export const getCoverGuardDisplayPercent = ({
  remainingGaugeCapacity,
  maximumGaugeCapacity,
  remainingMs,
  durationMs,
}: {
  remainingGaugeCapacity: number;
  maximumGaugeCapacity: number;
  remainingMs: number;
  durationMs: number;
}) => {
  if (remainingMs <= 0 || durationMs <= 0 || remainingGaugeCapacity <= 0) {
    return 0;
  }
  const capacityRatio = Number.isFinite(maximumGaugeCapacity)
    ? remainingGaugeCapacity / Math.max(1, maximumGaugeCapacity)
    : 1;
  const timeRatio = remainingMs / durationMs;
  const rawPercent =
    Math.max(0, Math.min(1, capacityRatio, timeRatio)) * 100;
  return Math.max(5, Math.min(100, Math.ceil(rawPercent / 5) * 5));
};

export const getSavageLayer = (targetProperty: Property) => {
  const match = targetProperty.name.match(/商戦 零式：第([1-4])層/);
  return match ? Math.max(1, Math.min(4, Number(match[1]))) : 1;
};

export const getSavageSeries = (targetProperty: Property) => {
  const match = targetProperty.id.match(/^savage_raid_([1-3])_layer_[1-4]$/);
  return match ? Math.max(1, Math.min(3, Number(match[1]))) : 1;
};

const NO_ENEMY_SUPPORT_SKILLS: readonly EnemySupportSkillId[] = [];
const BENISON_ONLY: readonly EnemySupportSkillId[] = ['blackest_night'];
const BENISON_DRAIN: readonly EnemySupportSkillId[] = [
  'blackest_night',
  'drain',
];
const DRAIN_ONLY: readonly EnemySupportSkillId[] = ['drain'];
const DRAIN_DIVINATION: readonly EnemySupportSkillId[] = [
  'drain',
  'divination',
];
const DRAIN_DRILL: readonly EnemySupportSkillId[] = ['drain', 'drill'];
const DIVINATION_ONLY: readonly EnemySupportSkillId[] = ['divination'];
const BENISON_DIVINATION: readonly EnemySupportSkillId[] = [
  'blackest_night',
  'divination',
];
const BENISON_RAPID_ASSAULT: readonly EnemySupportSkillId[] = [
  'blackest_night',
  'rapid_assault',
];
const ALL_ENEMY_SUPPORT_SKILLS: readonly EnemySupportSkillId[] = [
  'blackest_night',
  'drain',
  'drill',
  'divination',
  'capital_reversal',
  'forced_liquidation',
];
const CRUEL_ENEMY_SUPPORT_SKILLS: readonly EnemySupportSkillId[] = [
  'blackest_night',
  'drill',
  'divination',
  'rapid_assault',
  'limit_break_3',
];

export interface EnemySupportProfileContext
  extends EnemySupportDifficultyContext {
  targetProperty: Property;
  isCityBoss: boolean;
}

export interface EnemySupportAutoProfile {
  opening: EnemySupportSkillId | null;
  critical: EnemySupportSkillId | null;
}

export const getUltimateEnemyAutoProfile = (
  patternIndex: number
): EnemySupportAutoProfile => {
  const normalizedIndex = Number.isFinite(patternIndex)
    ? Math.abs(Math.floor(patternIndex)) %
      ULTIMATE_ENEMY_AUTO_PATTERNS.length
    : 0;
  const pattern = ULTIMATE_ENEMY_AUTO_PATTERNS[normalizedIndex];
  return {
    opening: pattern.opening,
    critical: pattern.critical,
  };
};

/**
 * Keeps support mechanics on authored boss encounters. Ordinary properties
 * and training battles retain their existing AI and balance.
 */
export const getEnemySupportSkillProfile = ({
  targetProperty,
  isCityBoss,
  isSavage = false,
  isUltimate = false,
  isCruel = false,
}: EnemySupportProfileContext): readonly EnemySupportSkillId[] => {
  if (isCruel) return CRUEL_ENEMY_SUPPORT_SKILLS;
  if (isUltimate) return ALL_ENEMY_SUPPORT_SKILLS;
  if (isSavage) {
    const series = getSavageSeries(targetProperty);
    const layer = getSavageLayer(targetProperty);
    return SAVAGE_ENEMY_SUPPORT_PROFILES[series - 1][layer - 1];
  }
  if (isExtremeReacquisition(targetProperty)) {
    return [getExtremeReacquisitionOpeningSkill(targetProperty)];
  }
  if (!isCityBoss && targetProperty.cartelId === 'cartel_abyss') {
    return targetProperty.isCartelHQ ? DRAIN_DRILL : DRAIN_DIVINATION;
  }
  if (!isCityBoss && targetProperty.cartelId === 'cartel_dofor') {
    return targetProperty.isCartelHQ ? DRAIN_DIVINATION : BENISON_DRAIN;
  }
  if (!isCityBoss) return NO_ENEMY_SUPPORT_SKILLS;

  const campaignIndex = COMMUNITY_CAMPAIGN_ORDER.indexOf(
    targetProperty.community
  );
  if (campaignIndex === 2) return DRAIN_ONLY;
  if (campaignIndex === 3) return BENISON_ONLY;
  if (campaignIndex === 4) return BENISON_RAPID_ASSAULT;
  if (campaignIndex === 5) return BENISON_ONLY;
  if (campaignIndex === 6) return DRAIN_ONLY;
  if (campaignIndex === 7) return DRAIN_DRILL;
  if (campaignIndex === 8) return DIVINATION_ONLY;
  if (campaignIndex === 9) return BENISON_DIVINATION;
  return NO_ENEMY_SUPPORT_SKILLS;
};

/**
 * High-end duties reserve explicit support actions for authored battle beats.
 * Savage layer two owns a separate opening Cover. Layer three adds one
 * interruptible opening check, while layer four keeps its authored opening
 * and critical pair. Ultimate chooses one curated pair at battle start so
 * every surprise remains deterministic for that attempt.
 */
export const getEnemySupportAutoProfile = ({
  targetProperty,
  isSavage = false,
  isUltimate = false,
  isCruel = false,
  ultimatePatternIndex = 0,
}: EnemySupportProfileContext & {
  ultimatePatternIndex?: number;
}): EnemySupportAutoProfile => {
  if (isCruel) {
    return { opening: 'divination', critical: null };
  }
  if (isUltimate) {
    return getUltimateEnemyAutoProfile(ultimatePatternIndex);
  }
  if (isSavage) {
    const series = getSavageSeries(targetProperty);
    const layer = getSavageLayer(targetProperty);
    return SAVAGE_ENEMY_AUTO_PROFILES[series - 1][layer - 1];
  }
  if (isExtremeReacquisition(targetProperty)) {
    return {
      opening: getExtremeReacquisitionOpeningSkill(targetProperty),
      critical: null,
    };
  }
  if (targetProperty.isCartelHQ) {
    return targetProperty.cartelId === 'cartel_abyss'
      ? { opening: 'divination', critical: 'drill' }
      : { opening: 'drain', critical: 'blackest_night' };
  }
  return {
    opening: null,
    critical: null,
  };
};

export const getOpeningBossAbilityTier = ({
  targetProperty,
  isSavage = false,
}: {
  targetProperty: Property;
  isSavage?: boolean;
}): BossAbilityTier =>
  isSavage && getSavageLayer(targetProperty) === 2 ? 'cover' : 'none';

export const getSavageLayerBudgetMultiplier = (targetProperty: Property) =>
  SAVAGE_LAYER_BUDGET_MULTIPLIERS[getSavageLayer(targetProperty) - 1];

export const getSavageSeriesBudgetMultiplier = (targetProperty: Property) =>
  SAVAGE_SERIES_BUDGET_MULTIPLIERS[getSavageSeries(targetProperty) - 1];

export const SAVAGE_ENEMY_DIFFICULTY_LEVELS = [
  [4, 5, 5, 6],
  [5, 5, 6, 6],
  [5, 6, 6, 6],
] as const;

export const getEnemyDifficultyLevel = (
  targetProperty: Property,
  isTutorial: boolean,
  isSavage = false,
  isUltimate = false,
  isCityBoss = false,
  isCruel = false
) => {
  if (isCruel) return 6;
  if (isUltimate) return 6;
  if (isSavage) {
    return SAVAGE_ENEMY_DIFFICULTY_LEVELS[getSavageSeries(targetProperty) - 1][
      getSavageLayer(targetProperty) - 1
    ];
  }
  if (isExtremeReacquisition(targetProperty)) {
    const campaignIndex = COMMUNITY_CAMPAIGN_ORDER.indexOf(
      targetProperty.community
    );
    const baseDifficulty =
      campaignIndex <= 0
        ? 1
        : campaignIndex === 1
          ? 2
          : campaignIndex === 2
            ? 3
            : 4;
    return Math.min(
      EXTREME_REACQUISITION_BALANCE.maximumDifficultyLevel,
      baseDifficulty + 1
    );
  }
  if (isTutorial) return 0;
  if (targetProperty.id === 'prop_casino_grand') {
    // ゴールドソーサーは専用の高予算補正だけで十分に手強い。
    // 都市ボス補正まで重ねると、判断レベル5の温存挙動で泥仕合化する。
    return 4;
  }
  const campaignIndex = COMMUNITY_CAMPAIGN_ORDER.indexOf(targetProperty.community);
  const baseDifficulty =
    campaignIndex === 0
      ? 1
      : campaignIndex === 1
        ? 2
        : campaignIndex === 2
          ? 3
          : 4;
  return Math.min(
    6,
    baseDifficulty +
      (isCityBoss ? 1 : 0) +
      (targetProperty.cartelId ? 1 : 0) +
      (targetProperty.isCartelHQ ? 1 : 0)
  );
};

export const calculateEnemyBudget = ({
  targetProperty,
  industryInfluence,
  regionalInfluence,
  isTutorial,
  isSavage = false,
  isUltimate = false,
  isCruel = false,
  isCityBoss = false,
}: EnemyBudgetContext) => {
  const price = targetProperty.marketPrice;
  const isExtreme = isExtremeReacquisition(targetProperty);
  const rankFactor =
    price >= 20_000_000
      ? 1.05
      : price >= 1_000_000
        ? 0.82
        : price >= 200_000
          ? 0.68
          : 0.54;
  const defenseDiscount = Math.min(
    0.3,
    industryInfluence.enemyBudgetDiscount +
      regionalInfluence.enemyBudgetDiscount
  );
  const baseBudget =
    price *
    (rankFactor +
      (
        targetProperty.isCartelHQ &&
        !isSavage &&
        !isUltimate &&
        !isCruel
          ? 0.3
          : 0
      )) *
    (1 - defenseDiscount);
  const balanceFactor = isSavage || isUltimate || isCruel
    ? ENEMY_BALANCE_FACTOR.advanced
    : isTutorial && !isExtreme
    ? ENEMY_BALANCE_FACTOR.tutorial
    : targetProperty.isCartelHQ
      ? ENEMY_BALANCE_FACTOR.cartelHQ
      : targetProperty.cartelId
        ? ENEMY_BALANCE_FACTOR.cartelMember
        : targetProperty.id === 'prop_casino_grand'
          ? ENEMY_BALANCE_FACTOR.goldSaucer
          : COMMUNITY_CAMPAIGN_ORDER.indexOf(targetProperty.community) === 0
            ? ENEMY_BALANCE_FACTOR.gridania
            : COMMUNITY_CAMPAIGN_ORDER.indexOf(targetProperty.community) === 1
              ? ENEMY_BALANCE_FACTOR.limsa
              : COMMUNITY_CAMPAIGN_ORDER.indexOf(targetProperty.community) === 2
                ? ENEMY_BALANCE_FACTOR.uldah
                : ENEMY_BALANCE_FACTOR.advanced;

  const campaignIndex = COMMUNITY_CAMPAIGN_ORDER.indexOf(
    targetProperty.community
  );
  const authoredNormalBudgetMultiplier =
    !isSavage && !isUltimate && !isCruel
      ? getCampaignEncounterDefinition(targetProperty.id)
          ?.enemyBudgetMultiplier ?? 1
      : 1;
  const cityBossBudgetMultiplier =
    !isCityBoss ||
    campaignIndex < 0 ||
    targetProperty.id === 'prop_casino_grand'
      ? 1
      : campaignIndex <= 1
        ? 1.05
        : campaignIndex <= 4
          ? 1.04
          : 1.02;

  const calculatedBudget = Math.round(
    baseBudget * balanceFactor * cityBossBudgetMultiplier *
    authoredNormalBudgetMultiplier *
    (isUltimate || isCruel
      ? ULTIMATE_ENEMY_BUDGET_MULTIPLIER
      : isSavage
        ? SAVAGE_ENEMY_BUDGET_MULTIPLIER *
          getSavageLayerBudgetMultiplier(targetProperty) *
          getSavageSeriesBudgetMultiplier(targetProperty)
        : NORMAL_ENEMY_BUDGET_MULTIPLIER *
          getNormalEnemyCampaignMultiplier(
            targetProperty,
            isTutorial && !isExtreme
          )) *
      (isSavage || isUltimate || isCruel
        ? 1
        : getExtremeReacquisitionBudgetMultiplier(targetProperty))
  );

  return calculatedBudget;
};

export const getLimitBreakTier = (
  companyCount: number
): LimitBreakTier => {
  if (companyCount >= 16) return 3;
  if (companyCount >= 8) return 2;
  if (companyCount >= 4) return 1;
  return 0;
};

export const getLimitBreakChargeCapacity = (tier: LimitBreakTier) =>
  tier * LIMIT_BREAK_CHARGE_PER_BAR;

export const getChargedLimitBreakTier = (
  charge: number,
  unlockedTier: LimitBreakTier
): LimitBreakTier => {
  const filledBars = Math.floor(
    Math.max(0, charge) / LIMIT_BREAK_CHARGE_PER_BAR
  );
  return Math.min(unlockedTier, filledBars, LIMIT_BREAK_MAX_BARS) as LimitBreakTier;
};

/** Every LIMIT BREAK spends the entire stored gauge, even when only one bar fires. */
export const consumeLimitBreakCharge = (_charge: number) => 0;

export const calculateLimitBreakChargeGain = (
  effectiveCapitalMovement: number,
  targetMarketPrice: number
) => {
  if (effectiveCapitalMovement <= 0) return 0;
  const movementRatio =
    effectiveCapitalMovement / Math.max(targetMarketPrice, 1);
  const baseGain = Math.min(24, 3 + movementRatio * 48);
  return Math.max(
    1,
    Math.round(baseGain * LIMIT_BREAK_CHARGE_GAIN_MULTIPLIER)
  );
};

export const calculateLimitBreakAmount = (
  targetMarketPrice: number,
  participatingSubsidiaries: Property[],
  tier: LimitBreakTier,
  previousNetworkSupportUses: Readonly<Record<string, number>> = {}
) => {
  if (tier === 0) return 0;
  const selfSlot = Math.round(targetMarketPrice * 0.28);
  const subsidiarySlots = participatingSubsidiaries.reduce(
    (total, property) =>
      total +
      Math.round(
        property.marketPrice *
          0.28 *
          getSubsidiarySupportMultiplier(property) *
          getRepeatedNetworkSupportMultiplier(
            previousNetworkSupportUses[property.id] ?? 0
          )
      ),
    0
  );
  const aggregatedAmount = Math.round(
    (selfSlot + subsidiarySlots) * LIMIT_BREAK_MULTIPLIERS[tier]
  );
  const capRatio = LIMIT_BREAK_CAPITAL_CAP_RATIOS[tier];
  return capRatio === null
    ? aggregatedAmount
    : Math.min(
        aggregatedAmount,
        Math.round(Math.max(0, targetMarketPrice) * capRatio)
      );
};

export const calculateLimitBreakOwnershipPush = (
  amount: number,
  targetMarketPrice: number,
  tier: LimitBreakTier,
  windMultiplier: number
) => {
  if (tier === 0) return 0;
  const rawPush =
    (amount / Math.max(targetMarketPrice, 1)) * 85 * windMultiplier;
  return Math.min(LIMIT_BREAK_OWNERSHIP_CAPS[tier], rawPush);
};

export const calculateLimitBreakOwnershipAfterDefense = (
  currentOwnership: number,
  ownershipPush: number,
  defenseGaugeShock: number
) => currentOwnership + ownershipPush - defenseGaugeShock / 2;

export const calculateTotalAssetValue = (
  totalFunds: number,
  ownedProperties: Property[]
) =>
  Math.max(0, totalFunds) +
  ownedProperties.reduce(
    (total, property) => total + property.marketPrice,
    0
  );

export const isSkillUnlocked = ({
  skill,
  ownedProperties,
  totalFunds,
  activeSynergyCount,
  conqueredCommunityIds = new Set<CommunityType>(),
  savageClearedRaidIds = new Set<string>(),
}: SkillUnlockContext) => {
  const ownedPropertyIds = new Set(
    ownedProperties.map((property) => property.id)
  );
  const ownedIndustries = new Set(
    ownedProperties.map((property) => property.industry)
  );

  if (
    skill.requiredIndustries &&
    !skill.requiredIndustries.some((industry) =>
      ownedIndustries.has(industry)
    )
  ) {
    return false;
  }
  if (
    skill.requiredPropertyIds &&
    !skill.requiredPropertyIds.some((id) => ownedPropertyIds.has(id))
  ) {
    return false;
  }
  if (
    skill.requiredAllPropertyIds &&
    !skill.requiredAllPropertyIds.every((id) => ownedPropertyIds.has(id))
  ) {
    return false;
  }
  if (
    skill.requiredAssetValue &&
    calculateTotalAssetValue(totalFunds, ownedProperties) <
      skill.requiredAssetValue
  ) {
    return false;
  }
  if (skill.requiresActiveSynergy && activeSynergyCount <= 0) {
    return false;
  }
  if (
    skill.unlockAfterCommunity &&
    !conqueredCommunityIds.has(skill.unlockAfterCommunity)
  ) {
    return false;
  }
  if (
    skill.unlockAfterSavageRaidId &&
    !savageClearedRaidIds.has(skill.unlockAfterSavageRaidId)
  ) {
    return false;
  }
  return true;
};

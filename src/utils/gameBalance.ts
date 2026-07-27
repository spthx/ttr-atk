import type { BattleMode, CommunityType, Property, TacticalSkill } from '../types';
import { COMMUNITY_CAMPAIGN_ORDER } from '../data/worldData';

export const PASSIVE_REVENUE_MULTIPLIER = 2;
export const INITIAL_PLAYER_FUNDS = 20_000;
export const PLAYER_BATTLE_CASH_CAP_RATIO = 1;
export const BATTLE_GAUGE_SPEED_FACTOR = 4;
export const TRAINING_GAUGE_SPEED_MULTIPLIER = 0.1;
export const TRAINING_MIN_OWNERSHIP_PERCENT = 1;
export const ENEMY_INITIAL_COMMITMENT_RATIO = 0.25;
export const SAVAGE_ENEMY_BUDGET_MULTIPLIER = 1.58;
export const SAVAGE_LAYER_BUDGET_MULTIPLIERS = [1, 1.08, 1.16, 1.25] as const;
export const ULTIMATE_ENEMY_BUDGET_MULTIPLIER = 2.2;
export const LIMIT_BREAK_CHARGE_PER_BAR = 100;
export const LIMIT_BREAK_MAX_BARS = 3;

export const applyTrainingGaugeSpeed = (
  velocity: number,
  isTraining: boolean
) => velocity * (isTraining ? TRAINING_GAUGE_SPEED_MULTIPLIER : 1);

export const calculatePlayerBattleCashLimit = (marketPrice: number) =>
  Math.max(10, Math.round(Math.max(0, marketPrice) * PLAYER_BATTLE_CASH_CAP_RATIO));
export const holdTrainingGaugeAboveDefeat = (
  gauge: number,
  isTraining: boolean
) => isTraining
  ? Math.min(gauge, 100 - TRAINING_MIN_OWNERSHIP_PERCENT * 2)
  : gauge;

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
}: BattleCashRecoveryStepInput): BattleCashRecoveryStepResult => {
  const baseline = finiteNonNegative(baselineFunds);
  const currentFunds = Math.min(
    baseline,
    finiteNonNegative(availableFunds)
  );
  const cumulativeCap =
    baseline * BATTLE_CASH_RECOVERY_TOTAL_CAP_RATIO;
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
    baseline - currentFunds,
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

export const TACTICAL_SKILL_BALANCE = {
  fastAction: {
    durationMs: 10_000,
    cooldownMs: 18_000,
    baseCommandProgressPerTick: 2.8,
    boostedCommandProgressPerTick: 5,
  },
  moraleSupport: {
    loyaltyRiskDivisor: 2,
  },
  disruption: {
    durationMs: 9_000,
    interruptChance: 0.7,
    collapseMarketRatio: 0.12,
  },
  demoralize: {
    durationMs: 9_000,
    enemyWaitMultiplier: 1.6,
  },
  capitalBoost: {
    marketRatio: 0.3,
  },
  livingDead: {
    waitingDurationMs: 10_000,
    recoveryDurationMs: 10_000,
    minimumOwnership: 1,
    recoveryOwnership: 30,
    requiredAssetValue: 1_000_000,
  },
  battleLitany: {
    durationMs: 7_000,
    pushMultiplier: 1.5,
  },
  eraWind: {
    durationMs: 28_000,
    cooldownMs: 0,
    minimumCost: 100_000,
    marketCostRatio: 0.02,
    useCostMultipliers: [1],
    baseGaugePushPerSecond: 1.35,
    pushStepPerUse: 0,
    maxUsesPerBattle: 1,
  },
} as const;

export const calculateEraWindCost = (
  marketPrice: number,
  previousUses: number
) => {
  const baseCost = Math.max(
    TACTICAL_SKILL_BALANCE.eraWind.minimumCost,
    Math.round(
      Math.max(0, marketPrice) *
        TACTICAL_SKILL_BALANCE.eraWind.marketCostRatio
    )
  );
  const multipliers = TACTICAL_SKILL_BALANCE.eraWind.useCostMultipliers;
  const multiplier =
    multipliers[Math.min(multipliers.length - 1, Math.max(0, previousUses))];
  return Math.round(baseCost * multiplier);
};

export const getEraWindGaugePushPerSecond = (previousUses: number) =>
  TACTICAL_SKILL_BALANCE.eraWind.baseGaugePushPerSecond +
  Math.min(
    TACTICAL_SKILL_BALANCE.eraWind.maxUsesPerBattle - 1,
    Math.max(0, previousUses)
  ) * TACTICAL_SKILL_BALANCE.eraWind.pushStepPerUse;

export const calculateBattleVictoryReward = (
  marketPrice: number,
  isPlayerVictory: boolean,
  mode: BattleMode,
  alreadyCleared = false
) => {
  if (
    !isPlayerVictory ||
    mode === 'ultimate' ||
    mode === 'training' ||
    (mode === 'savage' && alreadyCleared)
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
  1: 1.44,
  2: 1.8,
  3: 2.22,
} as const;

export type LimitBreakTier = 0 | 1 | 2 | 3;

export const LIMIT_BREAK_OWNERSHIP_CAPS: Record<
  Exclude<LimitBreakTier, 0>,
  number
> = {
  1: 10,
  2: 20,
  3: 30,
};

export const ENEMY_BALANCE_FACTOR = {
  tutorial: 1.08,
  gridania: 1.3,
  limsa: 1.42,
  uldah: 1.55,
  goldSaucer: 1.72,
  advanced: 1.55,
  cartelHQ: 1.75,
} as const;

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
}

interface SkillUnlockContext {
  skill: TacticalSkill;
  ownedProperties: Property[];
  totalFunds: number;
  activeSynergyCount: number;
}

export const countsTowardCityConquest = (property: Property) =>
  property.countsTowardCityConquest !== false;

export const getCampaignProperties = (
  properties: Property[],
  community: CommunityType
) =>
  properties.filter(
    (property) =>
      property.community === community && countsTowardCityConquest(property)
  );

export const getSavageLayer = (targetProperty: Property) => {
  const match = targetProperty.name.match(/商戦 零式：第([1-4])層/);
  return match ? Math.max(1, Math.min(4, Number(match[1]))) : 1;
};

export const getSavageLayerBudgetMultiplier = (targetProperty: Property) =>
  SAVAGE_LAYER_BUDGET_MULTIPLIERS[getSavageLayer(targetProperty) - 1];

export const getEnemyDifficultyLevel = (
  targetProperty: Property,
  isTutorial: boolean,
  isSavage = false,
  isUltimate = false
) => {
  if (isTutorial) return 0;
  if (isUltimate) return 6;
  if (isSavage) return getSavageLayer(targetProperty) >= 3 ? 6 : 5;
  if (targetProperty.id === 'prop_casino_grand') return 4;
  const campaignIndex = COMMUNITY_CAMPAIGN_ORDER.indexOf(targetProperty.community);
  if (campaignIndex === 0) return 1;
  if (campaignIndex === 1) return 2;
  if (campaignIndex === 2) return 3;
  return 4;
};

export const calculateEnemyBudget = ({
  targetProperty,
  industryInfluence,
  regionalInfluence,
  isTutorial,
  isSavage = false,
  isUltimate = false,
}: EnemyBudgetContext) => {
  const price = targetProperty.marketPrice;
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
    (rankFactor + (targetProperty.isCartelHQ ? 0.3 : 0)) *
    (1 - defenseDiscount);
  const balanceFactor = isTutorial
    ? ENEMY_BALANCE_FACTOR.tutorial
    : targetProperty.isCartelHQ
      ? ENEMY_BALANCE_FACTOR.cartelHQ
      : targetProperty.id === 'prop_casino_grand'
        ? ENEMY_BALANCE_FACTOR.goldSaucer
        : COMMUNITY_CAMPAIGN_ORDER.indexOf(targetProperty.community) === 0
          ? ENEMY_BALANCE_FACTOR.gridania
          : COMMUNITY_CAMPAIGN_ORDER.indexOf(targetProperty.community) === 1
            ? ENEMY_BALANCE_FACTOR.limsa
            : COMMUNITY_CAMPAIGN_ORDER.indexOf(targetProperty.community) === 2
              ? ENEMY_BALANCE_FACTOR.uldah
              : ENEMY_BALANCE_FACTOR.advanced;

  return Math.round(
    baseBudget * balanceFactor *
    (isUltimate
      ? ULTIMATE_ENEMY_BUDGET_MULTIPLIER
      : isSavage
        ? SAVAGE_ENEMY_BUDGET_MULTIPLIER *
          getSavageLayerBudgetMultiplier(targetProperty)
        : 1)
  );
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
  tier: LimitBreakTier
) => {
  if (tier === 0) return 0;
  const selfSlot = Math.round(targetMarketPrice * 0.28);
  const subsidiarySlots = participatingSubsidiaries.reduce(
    (total, property) => total + Math.round(property.marketPrice * 0.28),
    0
  );
  return Math.round(
    (selfSlot + subsidiarySlots) * LIMIT_BREAK_MULTIPLIERS[tier]
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
  return true;
};

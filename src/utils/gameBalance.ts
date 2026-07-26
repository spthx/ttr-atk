import type { BattleMode, CommunityType, Property, TacticalSkill } from '../types';
import { COMMUNITY_CAMPAIGN_ORDER } from '../data/worldData';

export const PASSIVE_REVENUE_MULTIPLIER = 2;
export const BATTLE_GAUGE_SPEED_FACTOR = 4;
export const ENEMY_INITIAL_COMMITMENT_RATIO = 0.25;
export const SAVAGE_ENEMY_BUDGET_MULTIPLIER = 1.45;
export const ULTIMATE_ENEMY_BUDGET_MULTIPLIER = 1.72;
export const LIMIT_BREAK_CHARGE_PER_BAR = 100;
export const LIMIT_BREAK_MAX_BARS = 3;
export const LIMIT_BREAK_MAX_CHARGE =
  LIMIT_BREAK_CHARGE_PER_BAR * LIMIT_BREAK_MAX_BARS;
export const LIMIT_BREAK_CHARGE_GAIN_MULTIPLIER = 1.2;
export const SHORT_MANUAL_FINISH_GAUGE = -99;

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
} as const;

export const calculateBattleVictoryReward = (
  marketPrice: number,
  isPlayerVictory: boolean,
  mode: BattleMode,
  alreadyCleared = false
) => {
  if (
    !isPlayerVictory ||
    mode === 'ultimate' ||
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

export const getEnemyDifficultyLevel = (
  targetProperty: Property,
  isTutorial: boolean,
  isSavage = false,
  isUltimate = false
) => {
  if (isTutorial) return 0;
  if (isUltimate) return 6;
  if (isSavage) return 5;
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
        ? SAVAGE_ENEMY_BUDGET_MULTIPLIER
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

/**
 * Once the rival is SHORT, passive capital pressure may reach 99.5% ownership,
 * but the player must provide the finishing input.
 */
export const holdGaugeForManualShortFinish = (
  nextGauge: number,
  enemyReserve: number
) =>
  enemyReserve <= 0 && nextGauge <= -100
    ? SHORT_MANUAL_FINISH_GAUGE
    : nextGauge;

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

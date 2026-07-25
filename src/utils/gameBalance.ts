import type { CommunityType, Property, TacticalSkill } from '../types';
import { COMMUNITY_CAMPAIGN_ORDER } from '../data/worldData';

export const PASSIVE_REVENUE_MULTIPLIER = 2;

export const LIMIT_BREAK_MULTIPLIERS = {
  1: 1.2,
  2: 1.5,
  3: 1.85,
} as const;

export type LimitBreakTier = 0 | 1 | 2 | 3;

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
  isTutorial: boolean
) => {
  if (isTutorial) return 0;
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

  return Math.round(baseBudget * balanceFactor);
};

export const getLimitBreakTier = (
  companyCount: number
): LimitBreakTier => {
  if (companyCount >= 16) return 3;
  if (companyCount >= 8) return 2;
  if (companyCount >= 4) return 1;
  return 0;
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

import {
  INITIAL_GROUP_SYNERGIES,
  INITIAL_PROPERTIES,
  INITIAL_SKILLS,
} from '../src/data/initialData';
import { COMMUNITY_CAMPAIGN_ORDER } from '../src/data/worldData';
import type {
  BattleMode,
  GroupSynergy,
  Property,
} from '../src/types';
import {
  BATTLE_GAUGE_SPEED_FACTOR,
  BATTLE_LOYALTY_BALANCE,
  BATTLE_SUPPORT_BALANCE,
  BOSS_COVER_BALANCE,
  ENEMY_INITIAL_COMMITMENT_RATIO,
  PASSIVE_REVENUE_MULTIPLIER,
  TACTICAL_SKILL_BALANCE,
  advanceBattleCashRecovery,
  applyCoverToGaugeDelta,
  calculateBattleVictoryReward,
  calculateCelebrationGiftCost,
  calculateEnemyBudget,
  calculateLimitBreakAmount,
  calculateLimitBreakChargeGain,
  calculateLimitBreakOwnershipAfterDefense,
  calculateLimitBreakOwnershipPush,
  calculatePlayerBattleCashLimit,
  calculateSubsidiarySupportAmount,
  getBossAbilityTier,
  getChargedLimitBreakTier,
  getEnemyDifficultyLevel,
  getEnemyMinimumCommitment,
  getLimitBreakChargeCapacity,
  getLimitBreakTier,
  getSubsidiaryRiskIncrease,
  getSubsidiarySupportMultiplier,
  isNormalCityBoss,
  isSkillUnlocked,
  type BossAbilityTier,
  type LimitBreakTier,
} from '../src/utils/gameBalance';
import {
  calculateGaugeVelocity,
} from '../src/utils/formatter';
import {
  decideEnemyAction,
  type PlayerBattleAction,
} from '../src/utils/enemyAi';
import {
  calculateAllianceSupport,
} from '../src/utils/alliance';
import {
  calculateLiquidationCashback,
  resolvePostVictoryLoyalty,
} from '../src/utils/battleSettlement';
import {
  WIND_CONDITIONS,
  getWindPool,
  getWindProgressionStage,
  type WindCondition,
  type WindType,
} from '../src/components/WindIndicator';
import {
  advanceBattleWind,
  createBattleWindState,
} from '../src/utils/battleWind';

export class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }
  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }
  int(max: number) {
    return Math.floor(this.next() * Math.max(1, max));
  }
  bool(probability = 0.5) {
    return this.next() < probability;
  }
  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)];
  }
}

export type SupportPolicy = 'none' | 'best_once' | 'one_each' | 'repeat_safe';
export type InitialLimitBreakMode = 'empty' | 'one_bar' | 'full';
export type GiftPolicy = 'never' | 'risk_only' | 'always';

export interface AuditStrategy {
  id: string;
  label: string;
  description: string;
  directLevel: 1 | 2 | 3 | 4 | 5;
  supportPolicy: SupportPolicy;
  maxRequestsPerProperty: number;
  useLimitBreak: boolean;
  useSynergy: boolean;
  useAlliance: boolean;
  useCapitalBoost: boolean;
  waitDuringBadWind: boolean;
  initialLimitBreak: InitialLimitBreakMode;
  giftPolicy: GiftPolicy;
  task2CashRatio: number;
}

export const AUDIT_STRATEGIES: readonly AuditStrategy[] = [
  {
    id: 'novice_all_in',
    label: '初心者・全力連打',
    description: '支援や風を読まず、最大出資を繰り返す。',
    directLevel: 5,
    supportPolicy: 'none',
    maxRequestsPerProperty: 0,
    useLimitBreak: false,
    useSynergy: false,
    useAlliance: false,
    useCapitalBoost: false,
    waitDuringBadWind: false,
    initialLimitBreak: 'empty',
    giftPolicy: 'never',
    task2CashRatio: 1,
  },
  {
    id: 'steady',
    label: '標準・支援一巡',
    description: '支援元へ一巡してから10%出資し、貯まったLBを使う。',
    directLevel: 3,
    supportPolicy: 'one_each',
    maxRequestsPerProperty: 1,
    useLimitBreak: true,
    useSynergy: false,
    useAlliance: false,
    useCapitalBoost: false,
    waitDuringBadWind: false,
    initialLimitBreak: 'empty',
    giftPolicy: 'risk_only',
    task2CashRatio: 0.8,
  },
  {
    id: 'expert_fresh',
    label: '熟練・現地調達',
    description: '悪い風を待ち、SYNERGY・協力・安全な支援とLBを組み合わせる。',
    directLevel: 3,
    supportPolicy: 'repeat_safe',
    maxRequestsPerProperty: 2,
    useLimitBreak: true,
    useSynergy: true,
    useAlliance: true,
    useCapitalBoost: false,
    waitDuringBadWind: true,
    initialLimitBreak: 'empty',
    giftPolicy: 'risk_only',
    task2CashRatio: 0.8,
  },
  {
    id: 'expert_prepared',
    label: '熟練・準備完了',
    description: '持越しLBと意気衝天を準備し、全システムを使用する。',
    directLevel: 4,
    supportPolicy: 'one_each',
    maxRequestsPerProperty: 1,
    useLimitBreak: true,
    useSynergy: true,
    useAlliance: true,
    useCapitalBoost: true,
    waitDuringBadWind: true,
    initialLimitBreak: 'full',
    giftPolicy: 'always',
    task2CashRatio: 1,
  },
] as const;

export interface InfluenceSummary {
  industryOwned: number;
  industryTotal: number;
  industryPlayerBonus: number;
  industryEnemyDiscount: number;
  regionalOwned: number;
  regionalTotal: number;
  regionalPlayerBonus: number;
  regionalEnemyDiscount: number;
  tradeNetworkBonus: number;
}

export interface SimulateBattleInput {
  targetProperty: Property;
  ownedProperties: Property[];
  totalFunds: number;
  conqueredCommunityCount: number;
  mode: BattleMode;
  strategy: AuditStrategy;
  seed: number;
  initialLimitBreakCharge?: number;
  windOverride?: WindType | null;
  maxSeconds?: number;
}

export interface BattleAuditResult {
  winner: 'player' | 'opponent' | 'timeout';
  mode: BattleMode;
  targetId: string;
  targetName: string;
  community: string;
  strategyId: string;
  seed: number;
  durationSeconds: number;
  finalOwnership: number;
  gauge: number;
  enemyBudget: number;
  enemyBudgetRatio: number;
  companyInvested: number;
  demandInvested: number;
  companyInvestedRatio: number;
  demandInvestedRatio: number;
  initialBattleCash: number;
  remainingBattleCash: number;
  battleCashRecovered: number;
  enemyCashRecovered: number;
  enemyRemainingReserve: number;
  playerActions: number;
  enemyActions: number;
  supportRequests: number;
  synergyUses: number;
  allianceUses: number;
  capitalBoostUses: number;
  limitBreakUses: number;
  limitBreakTierUsed: number;
  bossCoverTriggered: boolean;
  windSeconds: Record<WindType, number>;
  brokerageFee: number;
  settlementCost: number;
  victoryReward: number;
  celebrationGiftCost: number;
  liquidationCashback: number;
  passiveIncomeDuringBattle: number;
  fundsDelta: number;
  finalFunds: number;
  leavingProperties: Property[];
  survivingProperties: Property[];
  finalLimitBreakCharge: number;
  influence: InfluenceSummary;
}

const INVESTMENT_RATIOS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 0.02,
  2: 0.05,
  3: 0.1,
  4: 0.2,
  5: 0.35,
};

export function normalCampaignProperties() {
  return COMMUNITY_CAMPAIGN_ORDER.flatMap((community) =>
    INITIAL_PROPERTIES.filter(
      (property) =>
        property.community === community &&
        property.countsTowardCityConquest !== false,
    ),
  );
}

export function cloneAsOwned(properties: readonly Property[], companyName = '監査商会') {
  return properties.map((property) => ({
    ...property,
    owner: 'player' as const,
    ownerName: companyName,
  }));
}

export function activeSynergies(ownedProperties: readonly Property[]) {
  const ownedIds = new Set(ownedProperties.map((property) => property.id));
  return INITIAL_GROUP_SYNERGIES.filter((synergy) =>
    synergy.requiredPropertyIds.every((id) => ownedIds.has(id)),
  );
}

export function calculatePassiveRevenue(ownedProperties: readonly Property[]) {
  const synergies = activeSynergies(ownedProperties);
  const multiplier = synergies.reduce(
    (current, synergy) => current * synergy.bonusYieldMultiplier,
    1,
  );
  const base = ownedProperties.reduce(
    (total, property) => total + property.annualRevenue,
    0,
  );
  return Math.round(base * multiplier * PASSIVE_REVENUE_MULTIPLIER);
}

export function calculateInfluence(
  ownedProperties: readonly Property[],
  targetProperty: Property,
  conqueredCommunityCount: number,
  mode: BattleMode,
): InfluenceSummary {
  if (mode === 'savage' || mode === 'ultimate' || mode === 'training') {
    return {
      industryOwned: 0,
      industryTotal: 0,
      industryPlayerBonus: 0,
      industryEnemyDiscount: 0,
      regionalOwned: 0,
      regionalTotal: 0,
      regionalPlayerBonus: 0,
      regionalEnemyDiscount: 0,
      tradeNetworkBonus: 0,
    };
  }

  const industryProperties = INITIAL_PROPERTIES.filter(
    (property) => property.industry === targetProperty.industry,
  );
  const industryOwned = ownedProperties.filter(
    (property) => property.industry === targetProperty.industry,
  ).length;
  const industryRatio = industryOwned / Math.max(1, industryProperties.length);
  let industryPlayerBonus = 0;
  let industryEnemyDiscount = 0;
  if (industryOwned >= 3 || industryRatio >= 0.4) industryPlayerBonus = 0.05;
  if (industryRatio > 0.5) {
    industryPlayerBonus = 0.1;
    industryEnemyDiscount = 0.1;
  }

  const regionalProperties = INITIAL_PROPERTIES.filter(
    (property) =>
      property.community === targetProperty.community &&
      property.countsTowardCityConquest !== false,
  );
  const regionalOwned = ownedProperties.filter(
    (property) =>
      property.community === targetProperty.community &&
      property.countsTowardCityConquest !== false,
  ).length;
  const regionalRatio = regionalOwned / Math.max(1, regionalProperties.length);
  let regionalPlayerBonus = regionalOwned > 0 ? 0.03 : 0;
  let regionalEnemyDiscount = 0;
  if (regionalRatio >= 0.5) {
    regionalPlayerBonus = 0.08;
    regionalEnemyDiscount = 0.05;
  }
  if (regionalProperties.length > 0 && regionalOwned === regionalProperties.length) {
    regionalPlayerBonus = 0.12;
    regionalEnemyDiscount = 0.08;
  }

  return {
    industryOwned,
    industryTotal: industryProperties.length,
    industryPlayerBonus,
    industryEnemyDiscount,
    regionalOwned,
    regionalTotal: regionalProperties.length,
    regionalPlayerBonus,
    regionalEnemyDiscount,
    tradeNetworkBonus: Math.min(0.16, conqueredCommunityCount * 0.02),
  };
}

function selectedSynergy(
  ownedProperties: readonly Property[],
): { synergy: GroupSynergy; members: Property[]; amount: number } | null {
  const candidates = activeSynergies(ownedProperties).flatMap((synergy) => {
    const members = synergy.requiredPropertyIds
      .map((id) => ownedProperties.find((property) => property.id === id))
      .filter((property): property is Property => !!property);
    if (members.length !== synergy.requiredPropertyIds.length || members.length === 0) {
      return [];
    }
    const raw = members.reduce(
      (total, member) =>
        total +
        Math.round(
          member.marketPrice *
            BATTLE_SUPPORT_BALANCE.synergyMemberMarketRatio *
            getSubsidiarySupportMultiplier(member),
        ),
      0,
    );
    return [{
      synergy,
      members,
      amount: Math.round(
        raw *
          (synergy.battleGroupMultiplier ??
            BATTLE_SUPPORT_BALANCE.synergyDefaultMultiplier),
      ),
    }];
  });
  return candidates.reduce<(typeof candidates)[number] | null>(
    (best, current) => (!best || current.amount > best.amount ? current : best),
    null,
  );
}

function isBadWind(wind: WindCondition) {
  return wind.type === 'HEADWIND_PLAYER' || wind.type === 'TAILWIND_ENEMY';
}

function commandActionForLevel(level: 1 | 2 | 3 | 4 | 5): PlayerBattleAction {
  if (level === 1) return 'SMALL';
  if (level === 2) return 'STEADY';
  if (level === 3) return 'BOLD';
  if (level === 4) return 'LARGE';
  return 'ALL_IN';
}

function initialLimitBreakCharge(
  strategy: AuditStrategy,
  unlockedTier: LimitBreakTier,
) {
  if (strategy.initialLimitBreak === 'empty') return 0;
  if (strategy.initialLimitBreak === 'one_bar') {
    return Math.min(100, getLimitBreakChargeCapacity(unlockedTier));
  }
  return getLimitBreakChargeCapacity(unlockedTier);
}

function canUseCapitalBoost(
  ownedProperties: Property[],
  totalFunds: number,
) {
  const skill = INITIAL_SKILLS.find(
    (candidate) => candidate.effectType === 'CAPITAL_BOOST',
  );
  if (!skill) return false;
  return isSkillUnlocked({
    skill,
    ownedProperties,
    totalFunds,
    activeSynergyCount: activeSynergies(ownedProperties).length,
  });
}

export function simulateBattle(input: SimulateBattleInput): BattleAuditResult {
  const {
    targetProperty,
    ownedProperties,
    totalFunds,
    conqueredCommunityCount,
    mode,
    strategy,
    seed,
    initialLimitBreakCharge: suppliedInitialLimitBreak,
    windOverride = null,
    maxSeconds = 180,
  } = input;
  const rng = new SeededRandom(seed);
  const price = Math.max(1, targetProperty.marketPrice);
  const isTutorial = mode === 'normal' && targetProperty.id === 'prop_starter_farm';
  const isSavage = mode === 'savage';
  const isUltimate = mode === 'ultimate';
  const influence = calculateInfluence(
    ownedProperties,
    targetProperty,
    conqueredCommunityCount,
    mode,
  );
  const enemyBudget = calculateEnemyBudget({
    targetProperty,
    industryInfluence: {
      enemyBudgetDiscount: influence.industryEnemyDiscount,
    },
    regionalInfluence: {
      enemyBudgetDiscount: influence.regionalEnemyDiscount,
    },
    isTutorial,
    isSavage,
    isUltimate,
  });
  const enemyDifficultyLevel = getEnemyDifficultyLevel(
    targetProperty,
    isTutorial,
    isSavage,
    isUltimate,
  );
  const brokerageFee = mode === 'training' ? 0 : Math.round(price * 0.03);
  const availableBattleCash = Math.max(0, totalFunds - brokerageFee);
  const initialBattleCash = Math.min(
    availableBattleCash,
    calculatePlayerBattleCashLimit(price),
  );
  let cash = initialBattleCash;
  let battleCashRecovered = 0;
  let enemyCashRecovered = 0;
  let companyInvested = 0;
  let demandInvested = 0;
  let enemyInvested = Math.round(enemyBudget * ENEMY_INITIAL_COMMITMENT_RATIO);
  let enemyReserve = enemyBudget - enemyInvested;
  let gauge = 0;
  let time = 0;
  let playerCommandProgress = 100;
  let enemyProgress = 0;
  let enemyCycle = 0;
  let lastPlayerAction: PlayerBattleAction | null = null;
  let playerActions = 0;
  let enemyActions = 0;
  let supportRequests = 0;
  let synergyUses = 0;
  let allianceUses = 0;
  let capitalBoostUses = 0;
  let limitBreakUses = 0;
  let limitBreakTierUsed = 0;
  let synergyUsed = false;
  let allianceUsed = false;
  let capitalBoostUsed = false;
  let winner: BattleAuditResult['winner'] = 'timeout';
  const battleSubs = ownedProperties.map((property) => ({ ...property }));
  const requestCounts = new Map<string, number>();
  const activeBattleSynergy = selectedSynergy(battleSubs);
  const unlockedLimitBreakTier = getLimitBreakTier(battleSubs.length + 1);
  const limitBreakCapacity = getLimitBreakChargeCapacity(unlockedLimitBreakTier);
  let limitBreakCharge = Math.min(
    limitBreakCapacity,
    Math.max(
      0,
      suppliedInitialLimitBreak ??
        initialLimitBreakCharge(strategy, unlockedLimitBreakTier),
    ),
  );
  const allianceAvailable = strategy.useAlliance && conqueredCommunityCount >= 3;
  const capitalBoostAvailable =
    strategy.useCapitalBoost && canUseCapitalBoost(battleSubs, totalFunds);
  let windState = createBattleWindState();
  const windStage = getWindProgressionStage(
    conqueredCommunityCount,
    ownedProperties.length,
  );
  const windPool = getWindPool(windStage);
  const windSeconds: Record<WindType, number> = {
    TAILWIND_PLAYER: 0,
    HEADWIND_PLAYER: 0,
    TAILWIND_ENEMY: 0,
    CROSSWIND: 0,
    CALM: 0,
  };
  const bossTier: BossAbilityTier = getBossAbilityTier({
    targetProperty,
    isCityBoss:
      mode === 'normal' && isNormalCityBoss(INITIAL_PROPERTIES, targetProperty),
    isSavage,
    isUltimate,
  });
  let bossCoverTriggered = false;
  let bossCoverRemaining = 0;
  let bossCoverCapacity = 0;

  const chargeLimitBreak = (effectiveMovement: number) => {
    if (limitBreakCapacity <= 0 || effectiveMovement <= 0) return;
    limitBreakCharge = Math.min(
      limitBreakCapacity,
      limitBreakCharge + calculateLimitBreakChargeGain(effectiveMovement, price),
    );
  };

  const activateBossCover = () => {
    if (
      bossCoverTriggered ||
      bossTier === 'none' ||
      bossTier === 'boss'
    ) return;
    bossCoverTriggered = true;
    const balance =
      bossTier === 'invincible'
        ? BOSS_COVER_BALANCE.invincible
        : bossTier === 'enhanced_cover'
          ? BOSS_COVER_BALANCE.enhancedCover
          : BOSS_COVER_BALANCE.cover;
    bossCoverRemaining = balance.durationMs / 1_000;
    bossCoverCapacity = balance.gaugeCapacity;
  };

  const applyPlayerGauge = (candidate: number) => {
    const predictedOwnership = Math.max(0, Math.min(100, (100 - candidate) / 2));
    if (
      candidate < gauge &&
      predictedOwnership >= BOSS_COVER_BALANCE.triggerPlayerOwnership &&
      !bossCoverTriggered
    ) {
      activateBossCover();
    }
    if (candidate < gauge && bossCoverRemaining > 0 && bossCoverCapacity > 0) {
      const balance =
        bossTier === 'invincible'
          ? BOSS_COVER_BALANCE.invincible
          : bossTier === 'enhanced_cover'
            ? BOSS_COVER_BALANCE.enhancedCover
            : BOSS_COVER_BALANCE.cover;
      const covered = applyCoverToGaugeDelta({
        currentGauge: gauge,
        nextGauge: candidate,
        protects: 'opponent',
        absorbRatio: balance.absorbRatio,
        remainingGaugeCapacity: bossCoverCapacity,
      });
      bossCoverCapacity = covered.remainingGaugeCapacity;
      if (bossCoverCapacity <= 0) bossCoverRemaining = 0;
      gauge = covered.nextGauge;
      return;
    }
    gauge = candidate;
  };

  const applyEnemyGauge = (candidate: number) => {
    gauge = candidate;
  };

  const currentWind = (): WindCondition => {
    if (windOverride) return WIND_CONDITIONS[windOverride];
    return WIND_CONDITIONS[windState.windType];
  };

  const currentOwnership = () => Math.max(0, Math.min(100, (100 - gauge) / 2));

  const supportCandidates = () => {
    const available = battleSubs.filter((property) => {
      const count = requestCounts.get(property.id) ?? 0;
      return count < strategy.maxRequestsPerProperty;
    });
    return available.sort((left, right) => {
      if (strategy.supportPolicy === 'repeat_safe') {
        const riskDifference = left.loyaltyRisk - right.loyaltyRisk;
        if (riskDifference !== 0) return riskDifference;
      }
      return (
        calculateSubsidiarySupportAmount(right) -
        calculateSubsidiarySupportAmount(left)
      );
    });
  };

  const useDirectInvestment = (wind: WindCondition) => {
    const desiredLevel = strategy.directLevel;
    const affordableLevels = ([5, 4, 3, 2, 1] as const).filter(
      (level) =>
        level <= desiredLevel &&
        cash >= Math.max(10, Math.round(price * INVESTMENT_RATIOS[level])),
    );
    const level = affordableLevels[0];
    if (!level) return false;
    const amount = Math.max(10, Math.round(price * INVESTMENT_RATIOS[level]));
    cash -= amount;
    companyInvested += amount;
    chargeLimitBreak(amount * wind.playerMultiplier);
    const impact = Math.min(
      14,
      (1.2 + (amount / price) * 20) * wind.playerMultiplier,
    );
    applyPlayerGauge(gauge - impact);
    lastPlayerAction = commandActionForLevel(level);
    if (level >= 4) enemyProgress = Math.max(enemyProgress, level === 5 ? 82 : 70);
    return true;
  };

  const useSubsidiarySupport = (wind: WindCondition) => {
    if (strategy.supportPolicy === 'none') return false;
    const property = supportCandidates()[0];
    if (!property) return false;
    const riskIncrease = getSubsidiaryRiskIncrease(
      property,
      BATTLE_LOYALTY_BALANCE.individualRiskIncrease,
    );
    property.loyaltyRisk = Math.min(100, property.loyaltyRisk + riskIncrease);
    requestCounts.set(property.id, (requestCounts.get(property.id) ?? 0) + 1);
    const amount = calculateSubsidiarySupportAmount(property);
    demandInvested += amount;
    chargeLimitBreak(amount * wind.playerMultiplier);
    const impact = Math.min(
      BATTLE_SUPPORT_BALANCE.subsidiaryImpactCap,
      (
        BATTLE_SUPPORT_BALANCE.subsidiaryImpactBase +
        (amount / price) * BATTLE_SUPPORT_BALANCE.subsidiaryImpactPerMarketRatio
      ) * wind.playerMultiplier,
    );
    applyPlayerGauge(gauge - impact);
    lastPlayerAction = 'FUNDS';
    supportRequests += 1;
    return true;
  };

  const useGroupSynergy = (wind: WindCondition) => {
    if (
      !strategy.useSynergy ||
      synergyUsed ||
      !activeBattleSynergy
    ) return false;
    synergyUsed = true;
    synergyUses += 1;
    for (const member of activeBattleSynergy.members) {
      const live = battleSubs.find((property) => property.id === member.id);
      if (!live) continue;
      live.loyaltyRisk = Math.min(
        100,
        live.loyaltyRisk +
          getSubsidiaryRiskIncrease(
            live,
            BATTLE_LOYALTY_BALANCE.synergyRiskIncrease,
          ),
      );
    }
    demandInvested += activeBattleSynergy.amount;
    chargeLimitBreak(activeBattleSynergy.amount * wind.playerMultiplier);
    const impact = Math.min(
      BATTLE_SUPPORT_BALANCE.synergyImpactCap,
      (
        BATTLE_SUPPORT_BALANCE.synergyImpactBase +
        (activeBattleSynergy.amount / price) *
          BATTLE_SUPPORT_BALANCE.synergyImpactPerMarketRatio
      ) * wind.playerMultiplier,
    );
    applyPlayerGauge(gauge - impact);
    lastPlayerAction = 'SYNERGY';
    return true;
  };

  const useAllianceSupport = (wind: WindCondition) => {
    if (!allianceAvailable || allianceUsed) return false;
    allianceUsed = true;
    allianceUses += 1;
    const amount = calculateAllianceSupport(price);
    demandInvested += amount;
    chargeLimitBreak(amount * wind.playerMultiplier);
    lastPlayerAction = 'ALLIANCE';
    return true;
  };

  const useCapitalBoost = (wind: WindCondition) => {
    if (!capitalBoostAvailable || capitalBoostUsed) return false;
    capitalBoostUsed = true;
    capitalBoostUses += 1;
    const amount = Math.round(
      price * TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio,
    );
    demandInvested += amount;
    chargeLimitBreak(amount * wind.playerMultiplier);
    return true;
  };

  const useLimitBreak = (wind: WindCondition) => {
    if (!strategy.useLimitBreak) return false;
    const chargedTier = getChargedLimitBreakTier(
      limitBreakCharge,
      unlockedLimitBreakTier,
    );
    if (chargedTier === 0) return false;
    const ownership = currentOwnership();
    const shouldUse =
      strategy.initialLimitBreak === 'full' ||
      ownership >= 62 ||
      time >= 22 ||
      enemyReserve <= enemyBudget * 0.45;
    if (!shouldUse) return false;

    for (const member of battleSubs) {
      member.loyaltyRisk = Math.min(
        100,
        member.loyaltyRisk +
          getSubsidiaryRiskIncrease(
            member,
            BATTLE_LOYALTY_BALANCE.limitBreakRiskIncrease,
          ),
      );
      requestCounts.set(member.id, (requestCounts.get(member.id) ?? 0) + 1);
    }
    const amount = calculateLimitBreakAmount(price, battleSubs, chargedTier);
    demandInvested += amount;
    limitBreakCharge = 0;
    limitBreakUses += 1;
    limitBreakTierUsed = Math.max(limitBreakTierUsed, chargedTier);
    const emergencyDefense = Math.min(
      enemyReserve,
      Math.round(amount * 0.45),
    );
    enemyReserve -= emergencyDefense;
    enemyInvested += emergencyDefense;
    const counterShock = Math.min(
      10,
      (1.5 + (emergencyDefense / price) * 18) * wind.enemyMultiplier,
    );
    const ownershipPush = calculateLimitBreakOwnershipPush(
      amount,
      price,
      chargedTier,
      wind.playerMultiplier,
    );
    const ownershipAfter = calculateLimitBreakOwnershipAfterDefense(
      ownership,
      ownershipPush,
      counterShock,
    );
    applyPlayerGauge(100 - ownershipAfter * 2);
    lastPlayerAction = 'LIMIT_BREAK';
    enemyProgress = 0;
    enemyCycle += 1;
    return true;
  };

  const choosePlayerAction = (wind: WindCondition) => {
    if (
      strategy.waitDuringBadWind &&
      isBadWind(wind) &&
      currentOwnership() > 18 &&
      time < maxSeconds - 15
    ) {
      return false;
    }
    if (useCapitalBoost(wind)) return true;
    if (useLimitBreak(wind)) return true;
    if (useGroupSynergy(wind)) return true;

    if (strategy.supportPolicy === 'best_once') {
      if (supportRequests === 0 && useSubsidiarySupport(wind)) return true;
    } else if (
      strategy.supportPolicy === 'one_each' ||
      strategy.supportPolicy === 'repeat_safe'
    ) {
      if (useSubsidiarySupport(wind)) return true;
    }

    if (useAllianceSupport(wind)) return true;
    if (useDirectInvestment(wind)) return true;
    if (strategy.supportPolicy === 'repeat_safe' && useSubsidiarySupport(wind)) {
      return true;
    }
    return false;
  };

  const dt = 0.1;
  while (time < maxSeconds) {
    if (!windOverride && windPool.length > 0) {
      windState = advanceBattleWind(
        windState,
        dt,
        windPool,
        () => rng.next(),
      );
    }
    const wind = currentWind();
    windSeconds[wind.type] += dt;
    if (bossCoverRemaining > 0) {
      bossCoverRemaining = Math.max(0, bossCoverRemaining - dt);
    }

    const playerRecovery = advanceBattleCashRecovery({
      baselineFunds: initialBattleCash,
      availableFunds: cash,
      cumulativeRecovered: battleCashRecovered,
      elapsedSeconds: dt,
      timeScale: 1,
      windMultiplier:
        wind.type === 'TAILWIND_PLAYER'
          ? 1.25
          : wind.type === 'HEADWIND_PLAYER'
            ? 0.75
            : wind.type === 'CROSSWIND'
              ? 1.2
              : 1,
      terminal: false,
    });
    cash = playerRecovery.availableFunds;
    battleCashRecovered = playerRecovery.cumulativeRecovered;

    const enemyRecovery = advanceBattleCashRecovery({
      baselineFunds: enemyBudget,
      availableFunds: enemyReserve,
      cumulativeRecovered: enemyCashRecovered,
      elapsedSeconds: dt,
      timeScale: 1,
      windMultiplier:
        wind.type === 'TAILWIND_ENEMY'
          ? 1.25
          : wind.type === 'CROSSWIND'
            ? 1.2
            : 1,
      terminal: false,
    });
    enemyReserve = enemyRecovery.availableFunds;
    enemyCashRecovered = enemyRecovery.cumulativeRecovered;

    playerCommandProgress = Math.min(
      100,
      playerCommandProgress +
        TACTICAL_SKILL_BALANCE.fastAction.baseCommandProgressPerTick * 2 * dt * 10,
    );
    if (playerCommandProgress >= 100) {
      if (choosePlayerAction(wind)) {
        playerCommandProgress = 0;
        playerActions += 1;
      }
    }

    if (gauge <= -100) {
      winner = 'player';
      break;
    }
    if (gauge >= 100) {
      winner = 'opponent';
      break;
    }

    const playerInvestedEffective =
      (companyInvested + demandInvested) * wind.playerMultiplier;
    const enemyInvestedEffective = enemyInvested * wind.enemyMultiplier;
    const enemyOwnershipForAi = Math.round(((100 + gauge) / 2) / 5) * 5;
    const enemyReservePercent =
      enemyReserve <= 0
        ? 0
        : Math.min(100, (enemyReserve / Math.max(1, enemyBudget)) * 100);
    const enemyDecision = decideEnemyAction({
      enemyOwnership: enemyOwnershipForAi,
      enemyReservePercent,
      windType: wind.type,
      windRemainingSeconds: windOverride
        ? maxSeconds - time
        : windState.secondsRemaining,
      lastPlayerAction,
      effectiveCapitalGap: playerInvestedEffective - enemyInvestedEffective,
      marketPrice: price,
      isCartelHQ: !!targetProperty.isCartelHQ,
      isTutorial,
      slowed: false,
      cycle: enemyCycle,
      difficultyLevel: enemyDifficultyLevel,
    });
    if (enemyReserve >= getEnemyMinimumCommitment(price)) {
      enemyProgress = Math.min(
        100,
        enemyProgress + (100 / (enemyDecision.waitMs / 1_000)) * dt,
      );
    }
    if (enemyProgress >= 100) {
      if (enemyDecision.investmentRatio > 0) {
        const requested = price * enemyDecision.investmentRatio;
        const actual = Math.max(0, Math.min(Math.round(requested), enemyReserve));
        enemyReserve -= actual;
        enemyInvested += actual;
        chargeLimitBreak(actual * wind.enemyMultiplier);
        const shock = Math.min(
          10,
          (1.5 + (actual / price) * 18) * wind.enemyMultiplier,
        );
        applyEnemyGauge(gauge + shock);
      }
      enemyActions += 1;
      enemyCycle += 1;
      lastPlayerAction = null;
      enemyProgress = 0;
    }

    if (gauge <= -100) {
      winner = 'player';
      break;
    }
    if (gauge >= 100) {
      winner = 'opponent';
      break;
    }

    const effectivePlayerInvested =
      (companyInvested + demandInvested) * wind.playerMultiplier;
    const effectiveEnemyInvested = enemyInvested * wind.enemyMultiplier;
    const effectiveGap = effectivePlayerInvested - effectiveEnemyInvested;
    const baseVelocity = calculateGaugeVelocity(
      effectivePlayerInvested,
      effectiveEnemyInvested,
      price,
      1 +
        influence.industryPlayerBonus +
        influence.regionalPlayerBonus +
        influence.tradeNetworkBonus,
    );
    const gapRatio = Math.abs(effectiveGap) / price;
    const leverage = 1 + Math.min(2.4, gapRatio * 3.2);
    const deadZone = gapRatio < 0.025 ? 0.32 : 1;
    const velocity =
      baseVelocity *
      BATTLE_GAUGE_SPEED_FACTOR *
      leverage *
      deadZone *
      wind.speedMultiplier;
    const nextGauge = gauge + velocity * dt;
    if (velocity < 0) applyPlayerGauge(nextGauge);
    else applyEnemyGauge(nextGauge);

    time += dt;
    if (gauge <= -100) {
      winner = 'player';
      break;
    }
    if (gauge >= 100) {
      winner = 'opponent';
      break;
    }
  }

  const passiveRevenue = calculatePassiveRevenue(ownedProperties);
  const passiveIncomeDuringBattle = Math.floor(passiveRevenue * time);
  const settlementCost = Math.round(
    companyInvested * (winner === 'player' ? 0.35 : 0.75),
  );
  const victoryReward = calculateBattleVictoryReward(
    price,
    winner === 'player',
    mode,
    targetProperty.owner === 'player',
  );
  const shouldGift =
    winner === 'player' &&
    mode === 'normal' &&
    strategy.giftPolicy !== 'never' &&
    (strategy.giftPolicy === 'always' ||
      battleSubs.some((property) => property.loyaltyRisk >= 55));
  const celebrationGiftCost = shouldGift
    ? calculateCelebrationGiftCost(battleSubs, victoryReward)
    : 0;
  const loyalty =
    winner === 'player' && mode === 'normal'
      ? resolvePostVictoryLoyalty(battleSubs, shouldGift, () => rng.next())
      : { survivors: battleSubs, leaving: [] as Property[] };
  const liquidationCashback =
    mode === 'normal' ? calculateLiquidationCashback(loyalty.leaving) : 0;
  const fundsDelta =
    passiveIncomeDuringBattle -
    brokerageFee -
    settlementCost +
    (winner === 'player' ? victoryReward : 0) +
    liquidationCashback -
    celebrationGiftCost;
  const finalFunds = Math.max(0, totalFunds + fundsDelta);

  return {
    winner,
    mode,
    targetId: targetProperty.id,
    targetName: targetProperty.name,
    community: targetProperty.community,
    strategyId: strategy.id,
    seed,
    durationSeconds: time,
    finalOwnership: currentOwnership(),
    gauge,
    enemyBudget,
    enemyBudgetRatio: enemyBudget / price,
    companyInvested,
    demandInvested,
    companyInvestedRatio: companyInvested / price,
    demandInvestedRatio: demandInvested / price,
    initialBattleCash,
    remainingBattleCash: cash,
    battleCashRecovered,
    enemyCashRecovered,
    enemyRemainingReserve: enemyReserve,
    playerActions,
    enemyActions,
    supportRequests,
    synergyUses,
    allianceUses,
    capitalBoostUses,
    limitBreakUses,
    limitBreakTierUsed,
    bossCoverTriggered,
    windSeconds,
    brokerageFee,
    settlementCost,
    victoryReward,
    celebrationGiftCost,
    liquidationCashback,
    passiveIncomeDuringBattle,
    fundsDelta,
    finalFunds,
    leavingProperties: loyalty.leaving,
    survivingProperties: loyalty.survivors,
    finalLimitBreakCharge: limitBreakCharge,
    influence,
  };
}

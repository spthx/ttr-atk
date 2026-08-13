import type { Property } from '../types';
import {
  BATTLE_LOYALTY_BALANCE,
  calculateProfitAllocationCost,
  getReacquisitionLevel,
  PROFIT_ALLOCATION_OPTIONS,
  type ProfitAllocationOptionId,
  type ProfitAllocationRate,
} from './gameBalance';
import { calculateRebellionProbability } from './formatter';

export interface PropertyRiskUpdate {
  id: string;
  loyaltyRisk: number;
}

interface ApplyNormalBattlePropertyUpdatesArgs {
  properties: Property[];
  winner: 'player' | 'opponent';
  targetPropertyId: string;
  companyName: string;
  rebelledProperties: Property[];
  survivingRiskUpdates: PropertyRiskUpdate[];
}

interface ApplyLoyaltySettlementPropertyUpdatesArgs {
  properties: Property[];
  rebelledProperties: Property[];
  survivingRiskUpdates: PropertyRiskUpdate[];
}

export const calculateLiquidationCashback = (
  rebelledProperties: Property[]
) => {
  const uniqueProperties = new Map(
    rebelledProperties.map((property) => [property.id, property])
  );
  return Array.from(uniqueProperties.values()).reduce(
    (total, property) => total + property.marketPrice,
    0
  );
};

export interface BattleSettlementSummary {
  transactionDelta: number;
  fundsDelta: number;
  outcome: 'profit' | 'loss' | 'balanced';
}

/**
 * Keeps the result headline tied to the battle itself. Liquidation proceeds
 * are reported separately so a profitable asset sale cannot disguise a
 * loss-making acquisition.
 */
export const calculateBattleSettlementSummary = ({
  victoryReward,
  brokerageFee,
  settlementCost,
  celebrationGiftCost,
  liquidationCashback,
  battleCashDelta = 0,
}: {
  victoryReward: number;
  brokerageFee: number;
  settlementCost: number;
  celebrationGiftCost: number;
  liquidationCashback: number;
  /** Battle-time cash movements such as Drain. Negative values are losses. */
  battleCashDelta?: number;
}): BattleSettlementSummary => {
  const transactionDelta =
    victoryReward -
    brokerageFee -
    settlementCost -
    celebrationGiftCost +
    battleCashDelta;
  const fundsDelta = transactionDelta + liquidationCashback;

  return {
    transactionDelta,
    fundsDelta,
    outcome:
      transactionDelta > 0
        ? 'profit'
        : transactionDelta < 0
          ? 'loss'
          : 'balanced',
  };
};

export interface PostVictoryLoyaltySettlement {
  survivors: Property[];
  leaving: Property[];
}

export type DepartureProbabilityMultiplier = number | boolean;

/**
 * The boolean branch keeps older callers compatible with the original
 * two-choice settlement contract. `true` continues to mean the 50% share.
 */
export const normalizeDepartureProbabilityMultiplier = (
  multiplier: DepartureProbabilityMultiplier
) => {
  if (typeof multiplier === 'boolean') {
    return multiplier
      ? PROFIT_ALLOCATION_OPTIONS[1].departureProbabilityMultiplier
      : PROFIT_ALLOCATION_OPTIONS[0].departureProbabilityMultiplier;
  }
  return Number.isFinite(multiplier)
    ? Math.max(0, Math.min(1, multiplier))
    : 1;
};

export const calculateAtLeastOneDepartureProbability = (
  subsidiaries: Property[],
  probabilityMultiplier: DepartureProbabilityMultiplier = 1
) => {
  const normalizedMultiplier =
    normalizeDepartureProbabilityMultiplier(probabilityMultiplier);
  const noDepartureProbability = subsidiaries.reduce(
    (probability, property) =>
      probability *
      (
        1 -
        calculateRebellionProbability(property.loyaltyRisk) *
          normalizedMultiplier
      ),
    1
  );
  return Math.max(0, Math.min(1, 1 - noDepartureProbability));
};

export interface VictoryProfitAllocationChoice {
  id: ProfitAllocationOptionId;
  label: string;
  rate: ProfitAllocationRate;
  departureProbabilityMultiplier: number;
  loyaltyRiskReduction: number;
  cost: number;
  departureProbability: number;
}

/**
 * Pure settlement projection shared by the web presentation and a future
 * Unity client. The UI only renders these choices; it does not recreate any
 * rates, costs or loyalty modifiers.
 */
export const getVictoryProfitAllocationChoices = (
  subsidiaries: Property[],
  victoryReward: number
): VictoryProfitAllocationChoice[] =>
  PROFIT_ALLOCATION_OPTIONS.map((option) => ({
    ...option,
    cost: calculateProfitAllocationCost(
      subsidiaries,
      victoryReward,
      option.rate
    ),
    departureProbability: calculateAtLeastOneDepartureProbability(
      subsidiaries,
      option.departureProbabilityMultiplier
    ),
  }));

export const resolvePostVictoryLoyalty = (
  subsidiaries: Property[],
  probabilityMultiplier: DepartureProbabilityMultiplier = 1,
  random: () => number = Math.random,
  loyaltyRiskReduction = 0
): PostVictoryLoyaltySettlement => {
  const normalizedMultiplier =
    normalizeDepartureProbabilityMultiplier(probabilityMultiplier);
  const normalizedRiskReduction = Number.isFinite(loyaltyRiskReduction)
    ? Math.max(0, loyaltyRiskReduction)
    : 0;

  return subsidiaries.reduce<PostVictoryLoyaltySettlement>(
    (result, property) => {
      const departureProbability =
        calculateRebellionProbability(property.loyaltyRisk) *
        normalizedMultiplier;
      if (random() < departureProbability) {
        result.leaving.push({ ...property });
      } else {
        result.survivors.push({
          ...property,
          loyaltyRisk: Math.max(
            0,
            Math.min(100, property.loyaltyRisk - normalizedRiskReduction)
          ),
        });
      }
      return result;
    },
    { survivors: [], leaving: [] }
  );
};

/**
 * Applies only the persistent network consequences of a victory settlement.
 * High-difficulty synthetic targets must never be acquired through this path.
 */
export const applyLoyaltySettlementPropertyUpdates = ({
  properties,
  rebelledProperties,
  survivingRiskUpdates,
}: ApplyLoyaltySettlementPropertyUpdatesArgs): Property[] => {
  const rebelIds = new Set(rebelledProperties.map((property) => property.id));
  const survivingRisks = new Map(
    survivingRiskUpdates.map(({ id, loyaltyRisk }) => [
      id,
      Math.max(0, Math.min(100, loyaltyRisk)),
    ])
  );

  return properties.map((property) => {
    if (rebelIds.has(property.id)) {
      return {
        ...property,
        owner: 'independent',
        ownerName: '独立物件',
        loyaltyRisk: 0,
        reacquisitionLevel: Math.min(
          BATTLE_LOYALTY_BALANCE.maxReacquisitionLevel,
          getReacquisitionLevel(property) + 1
        ),
      };
    }

    const updatedRisk = survivingRisks.get(property.id);
    return updatedRisk === undefined
      ? property
      : { ...property, loyaltyRisk: updatedRisk };
  });
};

export const applyNormalBattlePropertyUpdates = ({
  properties,
  winner,
  targetPropertyId,
  companyName,
  rebelledProperties,
  survivingRiskUpdates,
}: ApplyNormalBattlePropertyUpdatesArgs): Property[] => {
  return applyLoyaltySettlementPropertyUpdates({
    properties,
    rebelledProperties,
    survivingRiskUpdates,
  }).map((property) => {
    if (winner === 'player' && property.id === targetPropertyId) {
      return {
        ...property,
        owner: 'player',
        ownerName: companyName,
        loyaltyRisk: 0,
      };
    }

    return property;
  });
};

import type { Property } from '../types';
import {
  BATTLE_LOYALTY_BALANCE,
  CELEBRATION_GIFT_OPTIONS,
  getReacquisitionLevel,
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
}: {
  victoryReward: number;
  brokerageFee: number;
  settlementCost: number;
  celebrationGiftCost: number;
  liquidationCashback: number;
}): BattleSettlementSummary => {
  const transactionDelta =
    victoryReward -
    brokerageFee -
    settlementCost -
    celebrationGiftCost;
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
 * The boolean branch temporarily keeps the existing result UI source
 * compatible while it migrates to the explicit 0/10/20 percent options.
 * `true` represents the former 10 percent gift.
 */
export const normalizeDepartureProbabilityMultiplier = (
  multiplier: DepartureProbabilityMultiplier
) => {
  if (typeof multiplier === 'boolean') {
    return multiplier
      ? CELEBRATION_GIFT_OPTIONS[1].departureProbabilityMultiplier
      : CELEBRATION_GIFT_OPTIONS[0].departureProbabilityMultiplier;
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

export const resolvePostVictoryLoyalty = (
  subsidiaries: Property[],
  probabilityMultiplier: DepartureProbabilityMultiplier = 1,
  random: () => number = Math.random
): PostVictoryLoyaltySettlement => {
  const normalizedMultiplier =
    normalizeDepartureProbabilityMultiplier(probabilityMultiplier);

  return subsidiaries.reduce<PostVictoryLoyaltySettlement>(
    (result, property) => {
      const departureProbability =
        calculateRebellionProbability(property.loyaltyRisk) *
        normalizedMultiplier;
      if (random() < departureProbability) {
        result.leaving.push({ ...property });
      } else {
        result.survivors.push({ ...property });
      }
      return result;
    },
    { survivors: [], leaving: [] }
  );
};

export const applyNormalBattlePropertyUpdates = ({
  properties,
  winner,
  targetPropertyId,
  companyName,
  rebelledProperties,
  survivingRiskUpdates,
}: ApplyNormalBattlePropertyUpdatesArgs): Property[] => {
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

    if (winner === 'player' && property.id === targetPropertyId) {
      return {
        ...property,
        owner: 'player',
        ownerName: companyName,
        loyaltyRisk: 0,
      };
    }

    const updatedRisk = survivingRisks.get(property.id);
    return updatedRisk === undefined
      ? property
      : { ...property, loyaltyRisk: updatedRisk };
  });
};

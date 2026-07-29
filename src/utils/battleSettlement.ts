import type { Property } from '../types';
import {
  BATTLE_LOYALTY_BALANCE,
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

export const resolvePostVictoryLoyalty = (
  subsidiaries: Property[],
  distributeGift: boolean,
  random: () => number = Math.random
): PostVictoryLoyaltySettlement => {
  const adjustedSubsidiaries = subsidiaries.map((property) => ({
    ...property,
    loyaltyRisk: distributeGift
      ? Math.max(
          0,
          property.loyaltyRisk -
            BATTLE_LOYALTY_BALANCE.celebrationRiskReduction
        )
      : property.loyaltyRisk,
  }));

  return adjustedSubsidiaries.reduce<PostVictoryLoyaltySettlement>(
    (result, property) => {
      if (random() < calculateRebellionProbability(property.loyaltyRisk)) {
        result.leaving.push({ ...property, loyaltyRisk: 100 });
      } else {
        result.survivors.push(property);
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

import type { Property } from '../types';

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

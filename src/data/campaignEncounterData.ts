/**
 * Authored normal-campaign encounters. Each entry is one real business and
 * one permanent regional-network discovery when first acquired.
 *
 * This data is deliberately presentation-agnostic so a future Unity client
 * can consume the same encounter/reward relationship.
 */
export interface CampaignEncounterDefinition {
  targetPropertyId: string;
  /** Normal-route correction; Extreme then layers its own multiplier on top. */
  enemyBudgetMultiplier?: number;
}

export const CAMPAIGN_ENCOUNTER_DEFINITIONS: readonly CampaignEncounterDefinition[] = [
  {
    targetPropertyId: 'prop_starter_farm',
  },
  {
    targetPropertyId: 'prop_timber_ake',
  },
  {
    targetPropertyId: 'prop_land_transport',
  },
  {
    targetPropertyId: 'prop_brewery_beer',
    enemyBudgetMultiplier: 2,
  },
  {
    targetPropertyId: 'prop_iron_mine',
  },
  {
    targetPropertyId: 'prop_casino_grand',
    enemyBudgetMultiplier: 0.85,
  },
  {
    targetPropertyId: 'prop_ranch_1',
  },
  {
    targetPropertyId: 'prop_weapon_dealer',
    enemyBudgetMultiplier: 1.05,
  },
  {
    targetPropertyId: 'prop_detective',
  },
  {
    targetPropertyId: 'prop_info_broker',
    enemyBudgetMultiplier: 1.1,
  },
  {
    targetPropertyId: 'prop_inn_town',
    enemyBudgetMultiplier: 1.18,
  },
  {
    targetPropertyId: 'prop_wheat_farm',
    enemyBudgetMultiplier: 1.18,
  },
  {
    targetPropertyId: 'prop_security_firm',
    enemyBudgetMultiplier: 1.18,
  },
  {
    targetPropertyId: 'prop_coffee_aurora',
    enemyBudgetMultiplier: 1.25,
  },
  {
    targetPropertyId: 'prop_abyss_heavy',
    enemyBudgetMultiplier: 1.2,
  },
  {
    targetPropertyId: 'prop_abyss_mine',
    enemyBudgetMultiplier: 1.3,
  },
] as const;

/**
 * The first two city networks intentionally finish before the combat kit
 * expands with LIMIT BREAK I and 疾風怒濤. Keeping this authored boundary in
 * the encounter data avoids accidentally accelerating a later fight merely
 * because it happens to share the same region or price band.
 */
export const EARLY_NORMAL_ENCOUNTER_COUNT = 4;

const earlyNormalEncounterIds = new Set(
  CAMPAIGN_ENCOUNTER_DEFINITIONS.slice(0, EARLY_NORMAL_ENCOUNTER_COUNT).map(
    (definition) => definition.targetPropertyId
  )
);

export const isEarlyNormalEncounterPropertyId = (propertyId: string) =>
  earlyNormalEncounterIds.has(propertyId);

const encounterByTargetId = new Map(
  CAMPAIGN_ENCOUNTER_DEFINITIONS.map((definition) => [
    definition.targetPropertyId,
    definition,
  ])
);

export const isCampaignEncounterPropertyId = (propertyId: string) =>
  encounterByTargetId.has(propertyId);

export const getCampaignEncounterDefinition = (propertyId: string) =>
  encounterByTargetId.get(propertyId) ?? null;

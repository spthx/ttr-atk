import type {
  CommunityType,
  GroupSynergy,
  IndustryType,
  Property,
} from '../types';

export type SavageLayer = 1 | 2 | 3 | 4;

export interface SavageRaidDefinition {
  /** Uses a legacy normal-property ID so existing schema-v3 clear records stay useful. */
  id: string;
  layer: SavageLayer;
  encounterName: string;
  coalitionName: string;
  battlePropertyId: string;
  memberPropertyIds: string[];
  communities: CommunityType[];
  rewardSynergyIds: string[];
  marketPrice: number;
  description: string;
}

export const SAVAGE_YIELD_BONUS_PER_RANK = 0.05;
export const SAVAGE_PROPERTY_YIELD_BONUS = 0.1;
export const SAVAGE_GROUP_MULTIPLIER_BASE = 1.28;
export const SAVAGE_GROUP_MULTIPLIER_BONUS_PER_RANK = 0.04;

/**
 * This four-layer tier borrows only the current FFXIV progression rhythm.
 * The coalitions, encounter names, rewards and trade-battle rules are original.
 */
export const SAVAGE_RAID_DEFINITIONS: readonly SavageRaidDefinition[] = [
  {
    id: 'prop_starter_farm',
    layer: 1,
    encounterName: '森海生活商圏連合',
    coalitionName: '三都市通商連合',
    battlePropertyId: 'prop_starter_farm',
    memberPropertyIds: [
      'prop_starter_farm',
      'prop_starter_bakery',
      'prop_timber_ake',
      'prop_land_transport',
      'prop_brewery_beer',
      'prop_iron_mine',
      'prop_pub_central',
      'prop_casino_grand',
    ],
    communities: ['グリダニア', 'リムサ・ロミンサ', 'ウルダハ'],
    rewardSynergyIds: [
      'GRIDANIA_FOREST_ECONOMY',
      'EORZEA_FOOD_ROUTE',
      'ULDAH_LUXURY_MARKET',
    ],
    marketPrice: 600_000_000,
    description:
      '三都市の生活物資網が共同防衛する第1層。小口の連携と資金源管理を同時に試します。',
  },
  {
    id: 'prop_blacksmith',
    layer: 2,
    encounterName: '蒼天産業共同体',
    coalitionName: '北方・東方交易連合',
    battlePropertyId: 'prop_blacksmith',
    memberPropertyIds: [
      'prop_ranch_1',
      'prop_horse_meat',
      'prop_blacksmith',
      'prop_weapon_dealer',
      'prop_detective',
      'prop_info_broker',
    ],
    communities: ['イシュガルド', 'クガネ'],
    rewardSynergyIds: ['ISHGARD_DEFENSE_INDUSTRY', 'KUGANE_TRADE_GATEWAY'],
    marketPrice: 900_000_000,
    description:
      '北方の生産拠点が一体となる第2層。短い予兆から続く集中防衛を崩します。',
  },
  {
    id: 'prop_wheat_farm',
    layer: 3,
    encounterName: '星海学商連合',
    coalitionName: '第一世界・学都・サベネア共同市場',
    battlePropertyId: 'prop_wheat_farm',
    memberPropertyIds: [
      'prop_inn_town',
      'prop_wheat_farm',
      'prop_security_firm',
    ],
    communities: ['クリスタリウム', 'オールド・シャーレアン', 'ラザハン'],
    rewardSynergyIds: ['EORZEA_FOOD_ROUTE'],
    marketPrice: 1_350_000_000,
    description:
      '異なる世界と学術都市の調達網を結ぶ第3層。風と競合アクションの読み合いが重なります。',
  },
  {
    id: 'prop_abyss_heavy',
    layer: 4,
    encounterName: '黄金新興経済連合',
    coalitionName: 'トラル・未来都市共同戦線',
    battlePropertyId: 'prop_abyss_heavy',
    memberPropertyIds: [
      'prop_coffee_aurora',
      'prop_abyss_heavy',
      'prop_abyss_mine',
    ],
    communities: ['トライヨラ', 'ソリューション・ナイン'],
    rewardSynergyIds: [],
    marketPrice: 2_000_000_000,
    description:
      '資源調達から販売網までを束ねた最終層。全システムを使う長期の総力戦です。',
  },
] as const;

export const ULTIMATE_RAID_ID = 'ultimate_starwide_trade';

export const ULTIMATE_RAID_DEFINITION = {
  id: ULTIMATE_RAID_ID,
  name: '絶商戦：星海大繁盛の終局',
  coalitionName: '全地域交易共同戦線',
  communities: [
    'グリダニア',
    'リムサ・ロミンサ',
    'ウルダハ',
    'イシュガルド',
    'クガネ',
    'クリスタリウム',
    'オールド・シャーレアン',
    'ラザハン',
    'トライヨラ',
    'ソリューション・ナイン',
  ] as CommunityType[],
  marketPrice: 3_000_000_000,
  industry: '娯楽・商業' as IndustryType,
  community: 'ソリューション・ナイン' as CommunityType,
  description:
    '商戦 零式4層を踏破した商会だけが挑める、本作独自の単独・最終高難度交易戦。通常の所有権と収益からは独立した名誉記録です。',
} as const;

const propertyById = (properties: Property[], id: string) =>
  properties.find((property) => property.id === id);

export const getSavageTargetIds = (properties: Property[]) =>
  SAVAGE_RAID_DEFINITIONS
    .filter((raid) => propertyById(properties, raid.battlePropertyId))
    .map((raid) => raid.id);

/**
 * Converts the former 20-encounter clear list into the four-layer tier.
 * A legacy layer counts only when every normal encounter assigned to it was
 * cleared. New saves carry a progress-version marker and store the four IDs
 * directly.
 */
export const normalizeSavageClearedRaidIds = (
  savedIds: readonly string[],
  isCurrentFormat: boolean,
  legacyTierWasComplete = false
) => {
  const saved = new Set(savedIds);
  if (isCurrentFormat) {
    return SAVAGE_RAID_DEFINITIONS
      .filter((raid) => saved.has(raid.id))
      .map((raid) => raid.id);
  }
  if (legacyTierWasComplete) {
    return SAVAGE_RAID_DEFINITIONS.map((raid) => raid.id);
  }
  return SAVAGE_RAID_DEFINITIONS
    .filter((raid) =>
      raid.memberPropertyIds.every((propertyId) => saved.has(propertyId))
    )
    .map((raid) => raid.id);
};

export const getSavageRaidDefinition = (id: string) =>
  SAVAGE_RAID_DEFINITIONS.find((raid) => raid.id === id) ?? null;

export const buildSavageProperties = (
  properties: Property[],
  clearedPropertyIds: ReadonlySet<string>,
  companyName: string
) =>
  SAVAGE_RAID_DEFINITIONS.flatMap((raid) => {
    const source = propertyById(properties, raid.battlePropertyId);
    if (!source) return [];
    const cleared = clearedPropertyIds.has(raid.id);
    return [{
      ...source,
      id: raid.id,
      name: `${raid.encounterName} 商戦 零式：第${raid.layer}層`,
      marketPrice: raid.marketPrice,
      annualRevenue: 0,
      owner: cleared ? 'player' as const : 'independent' as const,
      ownerName: cleared ? `${companyName}・零式踏破` : raid.coalitionName,
      loyaltyRisk: 0,
      countsTowardCityConquest: false,
      groupKeys: raid.rewardSynergyIds,
      description:
        `${raid.description} 通常物件の所有権・毎秒収益・独立危険度は変化しません。`,
    }];
  });

export const buildUltimateProperty = (
  cleared: boolean,
  companyName: string
): Property => ({
  id: ULTIMATE_RAID_DEFINITION.id,
  name: ULTIMATE_RAID_DEFINITION.name,
  industry: ULTIMATE_RAID_DEFINITION.industry,
  community: ULTIMATE_RAID_DEFINITION.community,
  marketPrice: ULTIMATE_RAID_DEFINITION.marketPrice,
  annualRevenue: 0,
  owner: cleared ? 'player' : 'independent',
  ownerName: cleared
    ? `${companyName}・絶踏破`
    : ULTIMATE_RAID_DEFINITION.coalitionName,
  loyaltyRisk: 0,
  countsTowardCityConquest: false,
  groupKeys: [],
  description: ULTIMATE_RAID_DEFINITION.description,
});

export const getUnlockedSavageRaidIds = (
  clearedPropertyIds: ReadonlySet<string>
) => {
  const unlocked = new Set<string>();
  for (const raid of SAVAGE_RAID_DEFINITIONS) {
    unlocked.add(raid.id);
    if (!clearedPropertyIds.has(raid.id)) break;
  }
  return unlocked;
};

export const getSavageSynergyRanks = (
  clearedPropertyIds: ReadonlySet<string>
) => {
  const ranks = new Map<string, number>();
  SAVAGE_RAID_DEFINITIONS.forEach((raid) => {
    if (!clearedPropertyIds.has(raid.id)) return;
    raid.rewardSynergyIds.forEach((synergyId) => {
      ranks.set(synergyId, (ranks.get(synergyId) ?? 0) + 1);
    });
  });
  return ranks;
};

export const getSavagePropertyYieldMultiplier = (
  propertyId: string,
  clearedPropertyIds: ReadonlySet<string>
) => {
  const clearedBoosts = SAVAGE_RAID_DEFINITIONS.filter(
    (raid) =>
      clearedPropertyIds.has(raid.id) &&
      raid.memberPropertyIds.includes(propertyId)
  ).length;
  return 1 + clearedBoosts * SAVAGE_PROPERTY_YIELD_BONUS;
};

export const applySavageSynergyUpgrades = (
  synergies: GroupSynergy[],
  clearedPropertyIds: ReadonlySet<string>
) => {
  const ranks = getSavageSynergyRanks(clearedPropertyIds);
  return synergies.map((synergy) => {
    const savageRank = ranks.get(synergy.id) ?? 0;
    return {
      ...synergy,
      savageRank,
      bonusYieldMultiplier: Number(
        (synergy.bonusYieldMultiplier + savageRank * SAVAGE_YIELD_BONUS_PER_RANK)
          .toFixed(2)
      ),
      battleGroupMultiplier: Number(
        (
          SAVAGE_GROUP_MULTIPLIER_BASE +
          savageRank * SAVAGE_GROUP_MULTIPLIER_BONUS_PER_RANK
        ).toFixed(2)
      ),
    };
  });
};

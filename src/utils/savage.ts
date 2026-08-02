import type {
  CommunityType,
  GroupSynergy,
  IndustryType,
  Property,
} from '../types';

export type SavageLayer = 1 | 2 | 3 | 4;
export type SavageSeries = 1 | 2 | 3;
export type SavageProgressVersion = 2 | 3;

export interface SavageRaidDefinition {
  /** The first four IDs stay equal to the former four-layer save keys. */
  id: string;
  series: SavageSeries;
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
export const SAVAGE_GROUP_MULTIPLIER_BASE = 1.45;
export const SAVAGE_GROUP_MULTIPLIER_BONUS_PER_RANK = 0.04;
export const SAVAGE_BATTLE_ONLY_CAPITAL_BONUS_PER_RANK = 0.02;

export const SAVAGE_SERIES_DEFINITIONS = [
  {
    series: 1,
    name: '三都市交易編',
    subtitle: '森・海・砂都の基礎商流',
  },
  {
    series: 2,
    name: '蒼天・東方交易編',
    subtitle: '生産拠点と情報網の集中防衛',
  },
  {
    series: 3,
    name: '星海・黄金交易編',
    subtitle: '世界をまたぐ最終資本戦線',
  },
] as const satisfies readonly {
  series: SavageSeries;
  name: string;
  subtitle: string;
}[];

/**
 * Three original four-layer tiers: twelve encounters in one linear unlock path.
 * The first tier keeps the former four save IDs so partial schema-v3 progress
 * has an unambiguous, lossless migration target.
 */
export const SAVAGE_RAID_DEFINITIONS: readonly SavageRaidDefinition[] = [
  {
    id: 'prop_starter_farm',
    series: 1,
    layer: 1,
    encounterName: '森海生活商圏連合',
    coalitionName: '黒衣森共同調達会',
    battlePropertyId: 'prop_starter_farm',
    memberPropertyIds: [
      'prop_starter_farm',
      'prop_timber_ake',
    ],
    communities: ['グリダニア'],
    rewardSynergyIds: ['GRIDANIA_FOREST_ECONOMY'],
    marketPrice: 3_000_000_000,
    description:
      '森林資源と生活物資の連携を崩す開幕層。小口の連携と人脈管理を同時に試します。',
  },
  {
    id: 'prop_blacksmith',
    series: 1,
    layer: 2,
    encounterName: '黒潮輸送共同体',
    coalitionName: 'バイルブランド海陸運連合',
    battlePropertyId: 'prop_land_transport',
    memberPropertyIds: ['prop_land_transport'],
    communities: ['リムサ・ロミンサ'],
    rewardSynergyIds: [],
    marketPrice: 3_200_000_000,
    description:
      '海運と陸運が交互に資本を運ぶ第2層。短い予兆から続く集中防衛を崩します。',
  },
  {
    id: 'prop_wheat_farm',
    series: 1,
    layer: 3,
    encounterName: '砂都歓楽市場連合',
    coalitionName: 'ザナラーン興行・飲食共同市場',
    battlePropertyId: 'prop_wheat_farm',
    memberPropertyIds: [
      'prop_brewery_beer',
    ],
    communities: ['リムサ・ロミンサ', 'ウルダハ'],
    rewardSynergyIds: ['EORZEA_FOOD_ROUTE'],
    marketPrice: 3_400_000_000,
    description:
      '需要の波を味方につける第3層。時代の風と競合アクションの読み合いが重なります。',
  },
  {
    id: 'prop_abyss_heavy',
    series: 1,
    layer: 4,
    encounterName: '三都市通商総力戦',
    coalitionName: '三都市黄金資本防衛線',
    battlePropertyId: 'prop_abyss_heavy',
    memberPropertyIds: [
      'prop_iron_mine',
      'prop_casino_grand',
    ],
    communities: ['ウルダハ'],
    rewardSynergyIds: ['ULDAH_LUXURY_MARKET', 'GRAND_COMPANY_EORZEA'],
    marketPrice: 3_600_000_000,
    description:
      '三都市編の締めとなる無敵防衛戦。全押し込み経路を見極めて突破する総力戦です。',
  },
  {
    id: 'savage_raid_2_layer_1',
    series: 2,
    layer: 1,
    encounterName: '蒼天畜産共同体',
    coalitionName: 'クルザス生産者連盟',
    battlePropertyId: 'prop_ranch_1',
    memberPropertyIds: ['prop_ranch_1'],
    communities: ['イシュガルド'],
    rewardSynergyIds: [],
    marketPrice: 3_200_000_000,
    description:
      '寒冷地の供給網が粘り強く資本を戻す第1層。基礎手順を高い速度で試します。',
  },
  {
    id: 'savage_raid_2_layer_2',
    series: 2,
    layer: 2,
    encounterName: '蒼天産業共同体',
    coalitionName: 'イシュガルド機工防衛会',
    battlePropertyId: 'prop_weapon_dealer',
    memberPropertyIds: ['prop_weapon_dealer'],
    communities: ['イシュガルド'],
    rewardSynergyIds: ['ISHGARD_DEFENSE_INDUSTRY'],
    marketPrice: 3_400_000_000,
    description:
      '生産拠点が一体となる第2層。パッセージ・オブ・アームズを挟む集中防衛を崩します。',
  },
  {
    id: 'savage_raid_2_layer_3',
    series: 2,
    layer: 3,
    encounterName: '東方相場監査局',
    coalitionName: 'クガネ情報商会連合',
    battlePropertyId: 'prop_detective',
    memberPropertyIds: ['prop_detective'],
    communities: ['クガネ'],
    rewardSynergyIds: [],
    marketPrice: 3_600_000_000,
    description:
      '投入履歴を読んで先回りする第3層。情報戦と資本の間を崩さず攻め続けます。',
  },
  {
    id: 'savage_raid_2_layer_4',
    series: 2,
    layer: 4,
    encounterName: '紅蓮交易関門',
    coalitionName: '東方海運・仲介共同戦線',
    battlePropertyId: 'prop_info_broker',
    memberPropertyIds: ['prop_info_broker'],
    communities: ['クガネ'],
    rewardSynergyIds: ['KUGANE_TRADE_GATEWAY', 'GRAND_COMPANY_EORZEA'],
    marketPrice: 3_800_000_000,
    description:
      '東方交易の全経路を閉ざす第4層。無敵時間を越えて決定打を通す連続戦です。',
  },
  {
    id: 'savage_raid_3_layer_1',
    series: 3,
    layer: 1,
    encounterName: '第一世界復興商圏',
    coalitionName: 'クリスタリウム商旅連盟',
    battlePropertyId: 'prop_inn_town',
    memberPropertyIds: ['prop_inn_town'],
    communities: ['クリスタリウム'],
    rewardSynergyIds: [],
    marketPrice: 3_500_000_000,
    description:
      '復興需要が絶えず循環する最終編第1層。資金回復を含む長期戦の入口です。',
  },
  {
    id: 'savage_raid_3_layer_2',
    series: 3,
    layer: 2,
    encounterName: '星海学商連合',
    coalitionName: '学都・サベネア共同市場',
    battlePropertyId: 'prop_security_firm',
    memberPropertyIds: ['prop_wheat_farm', 'prop_security_firm'],
    communities: ['オールド・シャーレアン', 'ラザハン'],
    rewardSynergyIds: ['EORZEA_FOOD_ROUTE'],
    marketPrice: 3_700_000_000,
    description:
      '学術予測と港湾防衛が同期する第2層。パッセージ・オブ・アームズの後隙へ商流を集中させます。',
  },
  {
    id: 'savage_raid_3_layer_3',
    series: 3,
    layer: 3,
    encounterName: '黄金香料交易網',
    coalitionName: 'トラル国際交易会',
    battlePropertyId: 'prop_coffee_aurora',
    memberPropertyIds: ['prop_coffee_aurora'],
    communities: ['トライヨラ'],
    rewardSynergyIds: [],
    marketPrice: 3_900_000_000,
    description:
      '世界規模の需要変動を操る第3層。風・支援・アビリティの順序が勝敗を分けます。',
  },
  {
    id: 'savage_raid_3_layer_4',
    series: 3,
    layer: 4,
    encounterName: '黄金新興経済連合',
    coalitionName: 'トラル・未来都市共同戦線',
    battlePropertyId: 'prop_abyss_mine',
    memberPropertyIds: ['prop_abyss_heavy', 'prop_abyss_mine'],
    communities: ['トライヨラ', 'ソリューション・ナイン'],
    rewardSynergyIds: ['GRAND_COMPANY_EORZEA'],
    marketPrice: 4_200_000_000,
    description:
      '資源調達から販売網までを束ねた最終層。無敵防衛を含む全システムの総力戦です。',
  },
] as const;

/**
 * Presentation-only disclosure policy shared by the web UI and a future
 * native client: open only the series containing the next playable chapter.
 */
export const getDefaultOpenSavageSeries = ({
  clearedIds,
  unlockedIds,
}: {
  clearedIds: readonly string[];
  unlockedIds: readonly string[];
}): SavageSeries | null => {
  const cleared = new Set(clearedIds);
  if (SAVAGE_RAID_DEFINITIONS.every((raid) => cleared.has(raid.id))) {
    return null;
  }
  const unlocked = new Set(unlockedIds);
  return (
    SAVAGE_RAID_DEFINITIONS.find(
      (raid) => unlocked.has(raid.id) && !cleared.has(raid.id)
    )?.series ??
    SAVAGE_RAID_DEFINITIONS.find((raid) => !cleared.has(raid.id))?.series ??
    null
  );
};

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
  marketPrice: 6_000_000_000,
  industry: '娯楽・商業' as IndustryType,
  community: 'ソリューション・ナイン' as CommunityType,
  description:
    '商戦 零式3編・全12章を踏破した商会だけが挑める、本作独自の単独・最終高難度交易戦。通常の所有権と収益からは独立した名誉記録です。',
} as const;

export const CRUEL_RAID_ID = 'cruel_another_trade';

export const CRUEL_RAID_DEFINITION = {
  id: CRUEL_RAID_ID,
  name: '酷・もうひとつの商戦',
  coalitionName: '闇タタルの大繁盛商店',
  communities: ['ソリューション・ナイン'] as CommunityType[],
  marketPrice: Math.round(ULTIMATE_RAID_DEFINITION.marketPrice * 1.25),
  industry: '娯楽・商業' as IndustryType,
  community: 'ソリューション・ナイン' as CommunityType,
  description:
    '絶商戦の踏破後に現れる、本作独自の超高難度・単独記録戦。闇タタルが既存の商戦術を容赦なく組み合わせます。通常事業・人脈・独立危険度は保護され、踏破報酬は称号と記録のみです。',
} as const;

const propertyById = (properties: Property[], id: string) =>
  properties.find((property) => property.id === id);

const LEGACY_FOUR_LAYER_MIGRATIONS = [
  {
    legacyRaidId: 'prop_starter_farm',
    newRaidIds: [
      'prop_starter_farm',
      'prop_blacksmith',
      'prop_wheat_farm',
      'prop_abyss_heavy',
    ],
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
  },
  {
    legacyRaidId: 'prop_blacksmith',
    newRaidIds: [
      'savage_raid_2_layer_1',
      'savage_raid_2_layer_2',
      'savage_raid_2_layer_3',
      'savage_raid_2_layer_4',
    ],
    memberPropertyIds: [
      'prop_ranch_1',
      'prop_horse_meat',
      'prop_blacksmith',
      'prop_weapon_dealer',
      'prop_detective',
      'prop_info_broker',
    ],
  },
  {
    legacyRaidId: 'prop_wheat_farm',
    newRaidIds: [
      'savage_raid_3_layer_1',
      'savage_raid_3_layer_2',
    ],
    memberPropertyIds: [
      'prop_inn_town',
      'prop_wheat_farm',
      'prop_security_firm',
    ],
  },
  {
    legacyRaidId: 'prop_abyss_heavy',
    newRaidIds: [
      'savage_raid_3_layer_3',
      'savage_raid_3_layer_4',
    ],
    memberPropertyIds: [
      'prop_coffee_aurora',
      'prop_abyss_heavy',
      'prop_abyss_mine',
    ],
  },
] as const;

export const getSavageTargetIds = (properties: Property[]) =>
  SAVAGE_RAID_DEFINITIONS
    .filter((raid) => propertyById(properties, raid.battlePropertyId))
    .map((raid) => raid.id);

/**
 * Progress-version 3 stores all twelve IDs directly. Version 2 stored the
 * former four layers; each one expands to the new chapters that carry the same
 * property and synergy rewards. Pre-versioned 20-encounter saves still require
 * every encounter in a former layer. A previously acknowledged Savage ending
 * is grandfathered as a complete tier so an already unlocked Ultimate duty is
 * never relocked.
 */
export const normalizeSavageClearedRaidIds = (
  savedIds: readonly string[],
  progressVersion: SavageProgressVersion | undefined,
  legacyTierWasComplete = false
) => {
  const saved = new Set(savedIds);
  if (legacyTierWasComplete) {
    return SAVAGE_RAID_DEFINITIONS.map((raid) => raid.id);
  }
  if (progressVersion === 3) {
    return SAVAGE_RAID_DEFINITIONS
      .filter((raid) => saved.has(raid.id))
      .map((raid) => raid.id);
  }
  const migrated = new Set(
    LEGACY_FOUR_LAYER_MIGRATIONS.flatMap((migration) => {
      const completed =
        progressVersion === 2
          ? saved.has(migration.legacyRaidId)
          : migration.memberPropertyIds.every((propertyId) =>
              saved.has(propertyId)
            );
      return completed ? migration.newRaidIds : [];
    })
  );
  return SAVAGE_RAID_DEFINITIONS
    .filter((raid) => migrated.has(raid.id))
    .map((raid) => raid.id);
};

export const getSavageRaidDefinition = (id: string) =>
  SAVAGE_RAID_DEFINITIONS.find((raid) => raid.id === id) ?? null;

export const getSavageSeriesDefinition = (series: SavageSeries) =>
  SAVAGE_SERIES_DEFINITIONS.find(
    (definition) => definition.series === series
  ) ?? SAVAGE_SERIES_DEFINITIONS[0];

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
        `第${raid.series}編「${getSavageSeriesDefinition(raid.series).name}」。${raid.description} 通常物件の所有権・毎秒収益・独立危険度は変化しません。`,
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

export const buildCruelProperty = (
  cleared: boolean,
  companyName: string
): Property => ({
  id: CRUEL_RAID_DEFINITION.id,
  name: CRUEL_RAID_DEFINITION.name,
  industry: CRUEL_RAID_DEFINITION.industry,
  community: CRUEL_RAID_DEFINITION.community,
  marketPrice: CRUEL_RAID_DEFINITION.marketPrice,
  annualRevenue: 0,
  owner: cleared ? 'player' : 'independent',
  ownerName: cleared
    ? `${companyName}・酷踏破`
    : CRUEL_RAID_DEFINITION.coalitionName,
  loyaltyRisk: 0,
  countsTowardCityConquest: false,
  groupKeys: [],
  description: CRUEL_RAID_DEFINITION.description,
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
    if (synergy.battleOnly) {
      return {
        ...synergy,
        savageRank,
        bonusYieldMultiplier: 1,
        battleEffect: synergy.battleEffect
          ? {
              ...synergy.battleEffect,
              capitalPressureMultiplier: Number(
                (
                  synergy.battleEffect.capitalPressureMultiplier +
                  savageRank * SAVAGE_BATTLE_ONLY_CAPITAL_BONUS_PER_RANK
                ).toFixed(2)
              ),
            }
          : undefined,
      };
    }
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

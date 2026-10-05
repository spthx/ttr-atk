/** Static raid data for renewal. No runtime helpers or save migration. */

export type IndustryType =
  | '馬・畜産'
  | '飲食・酒類'
  | '木材・農園'
  | '鉱工業・武器'
  | '情報・警備'
  | '娯楽・商業';

export type CommunityType =
  | 'リムサ・ロミンサ'
  | 'グリダニア'
  | 'ウルダハ'
  | 'イシュガルド'
  | 'クガネ'
  | 'クリスタリウム'
  | 'オールド・シャーレアン'
  | 'ラザハン'
  | 'トライヨラ'
  | 'ソリューション・ナイン';

export type SavageLayer = 1 | 2 | 3 | 4;
export type SavageSeries = 1 | 2 | 3;

export interface SavageRaidDefinition {
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

export interface FinalRaidDefinition {
  id: string;
  name: string;
  subtitle?: string;
  coalitionName: string;
  communities: readonly CommunityType[];
  marketPrice: number;
  industry: IndustryType;
  community: CommunityType;
  description: string;
}

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
      '生産拠点が一体となる第2層。パッセを挟む集中防衛を崩します。',
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
      '学術予測と港湾防衛が同期する第2層。パッセの後隙へ商流を集中させます。',
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
    '商戦 零式3編・全12章を踏破した商会だけが挑める、本作独自の単独・最終高難度交易戦。ボス自体は取得せず、初回踏破では攻略報酬と人脈清算が発生します。',
} as const satisfies FinalRaidDefinition;

export const CRUEL_RAID_ID = 'cruel_another_trade';

export const CRUEL_RAID_DEFINITION = {
  id: CRUEL_RAID_ID,
  name: '酷商戦',
  subtitle: '酷-もう1人のわたし',
  coalitionName: '闇タタルの大繁盛商店',
  communities: ['ソリューション・ナイン'] as CommunityType[],
  marketPrice: 7_500_000_000,
  industry: '娯楽・商業' as IndustryType,
  community: 'ソリューション・ナイン' as CommunityType,
  description:
    '絶商戦の踏破後に現れる、本作独自の超高難度・単独記録戦。闇タタルが既存の商戦術を容赦なく組み合わせます。敗北・撤退・再戦では通常人脈を保護し、初回踏破では称号・記録・攻略報酬と人脈清算が発生します。',
} as const satisfies FinalRaidDefinition;

export const KARMA_RAID_ID = 'karma_priceless_share';

export const KARMA_RAID_DEFINITION = {
  id: KARMA_RAID_ID,
  name: '業商戦：値札のない一株',
  subtitle: '業-その商い、そっくりお返しします',
  coalitionName: '星海中央清算院・ものまね師',
  communities: ['ソリューション・ナイン'] as CommunityType[],
  /**
   * Cruel already reaches this scale. Karma becomes harder through authored
   * single-action imitation checks instead of another raw-stat increase.
   */
  marketPrice: 7_500_000_000,
  industry: '娯楽・商業' as IndustryType,
  community: 'ソリューション・ナイン' as CommunityType,
  description:
    '酷商戦踏破後に現れる、本作独自の最高難度記録戦。ものまね師が所有率の節目ごとにこちらの一手を一つだけ覚え、予告して再現し、解決後に消去します。通常資金・所有権・人脈・LB・幻の連勝記録は変化しません。',
} as const satisfies FinalRaidDefinition;

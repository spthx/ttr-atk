import type { CommunityType, Property } from '../types';
import { COMMUNITY_CAMPAIGN_ORDER } from '../data/worldData';
import { countsTowardCityConquest, getCampaignProperties } from './gameBalance';

export const SAVAGE_CITY_PRICE_FLOORS: Record<CommunityType, number> = {
  'グリダニア': 500_000_000,
  'リムサ・ロミンサ': 650_000_000,
  'ウルダハ': 800_000_000,
  'イシュガルド': 950_000_000,
  'クガネ': 1_150_000_000,
  'ラザハン': 1_350_000_000,
  'クリスタリウム': 1_650_000_000,
  'オールド・シャーレアン': 2_000_000_000,
  'トライヨラ': 2_400_000_000,
  'ソリューション・ナイン': 3_000_000_000,
};

const roundSavagePrice = (value: number) =>
  Math.max(1_000_000, Math.round(value / 1_000_000) * 1_000_000);

export const getSavageTargetIds = (properties: Property[]) =>
  properties
    .filter(countsTowardCityConquest)
    .map((property) => property.id);

export const calculateSavageMarketPrice = (
  property: Property,
  allProperties: Property[]
) => {
  const cityTargets = getCampaignProperties(allProperties, property.community);
  const cityMaxPrice = Math.max(
    1,
    ...cityTargets.map((target) => target.marketPrice)
  );
  const relativePrice = property.marketPrice / cityMaxPrice;
  const cityFloor = SAVAGE_CITY_PRICE_FLOORS[property.community];
  const stagedPrice = cityFloor * (0.72 + relativePrice * 0.28);
  return roundSavagePrice(Math.max(property.marketPrice * 4, stagedPrice));
};

export const buildSavageProperties = (
  properties: Property[],
  clearedPropertyIds: ReadonlySet<string>,
  companyName: string
) =>
  properties
    .filter(countsTowardCityConquest)
    .map((property) => {
      const cleared = clearedPropertyIds.has(property.id);
      const layer =
        getCampaignProperties(properties, property.community)
          .findIndex((target) => target.id === property.id) + 1;
      return {
        ...property,
        name: `${property.name}商戦 零式：第${layer}層`,
        marketPrice: calculateSavageMarketPrice(property, properties),
        annualRevenue: 0,
        owner: cleared ? 'player' as const : property.owner,
        ownerName: cleared ? `${companyName}・零式踏破` : property.ownerName,
        loyaltyRisk: 0,
        description: `${property.community}の通常戦「${property.name}」を再構成した高難度交易レイド。零式記録戦では所有権・毎秒収益・通常物件の独立は発生しません。`,
      };
    });

export const getSavageCommunityProgress = (
  savageProperties: Property[],
  clearedPropertyIds: ReadonlySet<string>
) =>
  COMMUNITY_CAMPAIGN_ORDER.map((community) => {
    const targets = getCampaignProperties(savageProperties, community);
    const cleared = targets.filter((property) =>
      clearedPropertyIds.has(property.id)
    ).length;
    return {
      community,
      cleared,
      total: targets.length,
      conquered: targets.length > 0 && cleared === targets.length,
    };
  });

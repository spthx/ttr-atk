import type { Property } from '../types';

export type TrainingDummyLevel = 1 | 2 | 3 | 4 | 5;

export interface TrainingDummyDefinition {
  id: string;
  level: TrainingDummyLevel;
  name: string;
  marketPrice: number;
  requiredConqueredCommunityCount: number;
  description: string;
}

export const TRAINING_DUMMY_DEFINITIONS = [
  {
    id: 'training_dummy_level_1',
    level: 1,
    name: '入門',
    marketPrice: 7_500,
    requiredConqueredCommunityCount: 0,
    description: '小口出資と所有率の動きを確かめる、最初の商戦木人です。',
  },
  {
    id: 'training_dummy_level_2',
    level: 2,
    name: '基礎',
    marketPrice: 60_000,
    requiredConqueredCommunityCount: 1,
    description: '資金を残しながら複数回投入する、商戦の基礎を試します。',
  },
  {
    id: 'training_dummy_level_3',
    level: 3,
    name: '上級',
    marketPrice: 800_000,
    requiredConqueredCommunityCount: 3,
    description: '支援元、有効なアビリティ、LIMIT BREAKを組み合わせる練習向けです。',
  },
  {
    id: 'training_dummy_level_4',
    level: 4,
    name: '熟練',
    marketPrice: 6_500_000,
    requiredConqueredCommunityCount: 6,
    description: '中盤以降の長い攻防を想定し、資金配分の精度を確かめます。',
  },
  {
    id: 'training_dummy_level_5',
    level: 5,
    name: '達人',
    marketPrice: 450_000_000,
    requiredConqueredCommunityCount: 10,
    description: '通常交易網の最終盤を想定した、最高耐久の商戦木人です。',
  },
] as const satisfies readonly TrainingDummyDefinition[];

export const isTrainingDummyUnlocked = (
  definition: TrainingDummyDefinition,
  conqueredCommunityCount: number
) =>
  Math.max(0, conqueredCommunityCount) >=
  definition.requiredConqueredCommunityCount;

export const buildTrainingDummyProperty = (
  definition: TrainingDummyDefinition
): Property => ({
  id: definition.id,
  name: `商戦木人 LEVEL ${definition.level}：${definition.name}`,
  industry: '娯楽・商業',
  community: 'グリダニア',
  marketPrice: definition.marketPrice,
  annualRevenue: 0,
  owner: 'independent',
  ownerName: `商戦訓練所・木人 LEVEL ${definition.level}`,
  loyaltyRisk: 0,
  countsTowardCityConquest: false,
  groupKeys: [],
  description:
    `${definition.description} 参加費は0ギル。追加防衛は行わず、` +
    '勝敗・出資・離反・LIMIT BREAKの変動はセーブデータへ反映されません。',
});

export const getTrainingDummyDefinition = (propertyId: string) =>
  TRAINING_DUMMY_DEFINITIONS.find(
    (definition) => definition.id === propertyId
  ) ?? null;

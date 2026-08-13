import { COMMUNITY_CAMPAIGN_ORDER } from '../data/worldData';
import type { BattleMode, CommunityType } from '../types';
import {
  getTrainingDummyDefinition,
  isTrainingDummyUnlocked,
  TRAINING_DUMMY_DEFINITIONS,
  type TrainingDummyLevel,
} from './trainingDummy';

export interface NormalBattleNavigation {
  community: CommunityType;
  mode: 'targets';
  unlockedCommunity: CommunityType | null;
}

export type BattleResultDestination =
  | 'next-case'
  | 'next-community'
  | 'same-community'
  | 'alliance-list'
  | 'high-end-list'
  | 'training-list'
  | 'campaign-ending';

export type BattleResultCtaIntent = 'continue' | 'retry' | 'return';

export interface BattleResultCta {
  destination: BattleResultDestination;
  intent: BattleResultCtaIntent;
  label: string;
  departureLabel: string;
}

/**
 * Result-screen wording is derived from the same destination facts that drive
 * progression. Keeping this pure makes the intent portable to a later Unity
 * scene-flow controller instead of embedding route assumptions in React copy.
 */
export const getBattleResultCta = ({
  battleMode,
  winner,
  hasNextCommunity = false,
  isCityBoss = false,
  isReacquisition = false,
  returnToAlliance = false,
}: {
  battleMode: BattleMode;
  winner: 'player' | 'opponent';
  hasNextCommunity?: boolean;
  isCityBoss?: boolean;
  isReacquisition?: boolean;
  returnToAlliance?: boolean;
}): BattleResultCta => {
  if (battleMode === 'training') {
    return {
      destination: 'training-list',
      intent: 'return',
      label: '訓練結果を保存せず木人一覧へ戻る',
      departureLabel: '離脱報告を確認して木人一覧へ戻る',
    };
  }

  if (
    battleMode === 'savage' ||
    battleMode === 'ultimate' ||
    battleMode === 'cruel' ||
    battleMode === 'karma' ||
    battleMode === 'phantom'
  ) {
    return {
      destination: 'high-end-list',
      intent: winner === 'player' ? 'continue' : 'retry',
      label:
        winner === 'player'
          ? '攻略結果を確定して高難度一覧へ'
          : '敗因を記録して高難度一覧へ',
      departureLabel: '離脱報告を確認して高難度一覧へ',
    };
  }

  if (returnToAlliance) {
    return {
      destination: 'alliance-list',
      intent: winner === 'player' ? 'continue' : 'retry',
      label:
        winner === 'player'
          ? '交渉結果を確定してアライアンスへ'
          : '敗因を記録してアライアンスへ',
      departureLabel: '離脱報告を確認してアライアンスへ',
    };
  }

  if (isReacquisition) {
    return {
      destination: 'same-community',
      intent: winner === 'player' ? 'continue' : 'retry',
      label:
        winner === 'player'
          ? '再買収結果を確定して保有案件へ'
          : '敗因を記録して再買収案件へ',
      departureLabel: '離脱報告を確認して保有案件へ',
    };
  }

  if (winner === 'opponent') {
    return {
      destination: 'same-community',
      intent: 'retry',
      label: '敗因を記録して案件一覧へ',
      departureLabel: '離脱報告を確認して案件一覧へ',
    };
  }

  if (hasNextCommunity) {
    return {
      destination: 'next-community',
      intent: 'continue',
      label: '買収結果を確定して次の都市へ',
      departureLabel: '離脱報告を確認して次の都市へ',
    };
  }

  if (isCityBoss) {
    return {
      destination: 'campaign-ending',
      intent: 'continue',
      label: '買収結果を確定してエンディングへ',
      departureLabel: '離脱報告を確認してエンディングへ',
    };
  }

  return {
    destination: 'next-case',
    intent: 'continue',
    label: '買収結果を確定して次の案件へ',
    departureLabel: '離脱報告を確認して次の案件へ',
  };
};

/**
 * Keep campaign momentum inside the target list. The wide-area map is an
 * explicit player destination, not an automatic result-screen destination.
 */
export const getNormalBattleNavigation = ({
  winner,
  targetCommunity,
  newlyConquered,
  isReacquisition = false,
}: {
  winner: 'player' | 'opponent';
  targetCommunity: CommunityType;
  newlyConquered: boolean;
  isReacquisition?: boolean;
}): NormalBattleNavigation => {
  // Reacquisition restores a holding inside an already visited route. Even if
  // a legacy save lacks that historical conquest marker, its result must not
  // replay a city-unlock announcement the player has already acknowledged.
  if (winner !== 'player' || !newlyConquered || isReacquisition) {
    return {
      community: targetCommunity,
      mode: 'targets',
      unlockedCommunity: null,
    };
  }

  const campaignIndex = COMMUNITY_CAMPAIGN_ORDER.indexOf(targetCommunity);
  const nextCommunity =
    campaignIndex >= 0
      ? COMMUNITY_CAMPAIGN_ORDER[campaignIndex + 1] ?? null
      : null;
  return {
    community: nextCommunity ?? targetCommunity,
    mode: 'targets',
    unlockedCommunity: nextCommunity,
  };
};

/**
 * A successful drill advances the selection only when that next level is
 * already unlocked. A wipe and the final level naturally return to a retry.
 */
export const getTrainingReturnLevel = ({
  propertyId,
  winner,
  conqueredCommunityCount,
}: {
  propertyId: string;
  winner: 'player' | 'opponent';
  conqueredCommunityCount: number;
}): TrainingDummyLevel | null => {
  const currentDefinition = getTrainingDummyDefinition(propertyId);
  if (!currentDefinition) return null;
  if (winner !== 'player') return currentDefinition.level;

  const currentIndex = TRAINING_DUMMY_DEFINITIONS.findIndex(
    (definition) => definition.id === currentDefinition.id
  );
  const nextDefinition = TRAINING_DUMMY_DEFINITIONS[currentIndex + 1];
  return nextDefinition &&
    isTrainingDummyUnlocked(nextDefinition, conqueredCommunityCount)
    ? nextDefinition.level
    : currentDefinition.level;
};

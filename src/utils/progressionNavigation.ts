import { COMMUNITY_CAMPAIGN_ORDER } from '../data/worldData';
import type { CommunityType } from '../types';
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

/**
 * Keep campaign momentum inside the target list. The wide-area map is an
 * explicit player destination, not an automatic result-screen destination.
 */
export const getNormalBattleNavigation = ({
  winner,
  targetCommunity,
  newlyConquered,
}: {
  winner: 'player' | 'opponent';
  targetCommunity: CommunityType;
  newlyConquered: boolean;
}): NormalBattleNavigation => {
  if (winner !== 'player' || !newlyConquered) {
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

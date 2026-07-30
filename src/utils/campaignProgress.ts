import { COMMUNITY_CAMPAIGN_ORDER } from '../data/worldData';
import type { CommunityType, Property } from '../types';
import { getCampaignProperties } from './gameBalance';

const validCommunityIds = new Set<CommunityType>(COMMUNITY_CAMPAIGN_ORDER);
const legacyFeatureConquestDepth: Readonly<Record<string, number>> = {
  market_wind: 1,
  rival_wind: 2,
  turbulent_wind: 3,
  trade_alliance: 3,
  opening_auto: 5,
  critical_auto: 7,
};

export const getCurrentlyControlledCommunityIds = (
  properties: readonly Property[]
) =>
  COMMUNITY_CAMPAIGN_ORDER.filter((communityId) => {
    const targets = getCampaignProperties(properties as Property[], communityId);
    return (
      targets.length > 0 &&
      targets.every((property) => property.owner === 'player')
    );
  });

/**
 * Restores permanent campaign progress without breaking schema-v3 saves.
 *
 * Owning anything in a later city proves every earlier route was unlocked at
 * some point, even if an earlier subsidiary has since become independent.
 */
export const normalizeConqueredCommunityIds = ({
  properties,
  savedCommunityIds,
  seenUnlockIds,
  normalEndingSeen,
}: {
  properties: readonly Property[];
  savedCommunityIds?: readonly string[];
  seenUnlockIds?: readonly string[];
  normalEndingSeen?: boolean;
}): CommunityType[] => {
  if (normalEndingSeen) return [...COMMUNITY_CAMPAIGN_ORDER];

  const conquered = new Set<CommunityType>();
  const includeThrough = (lastIndex: number) => {
    for (let index = 0; index <= lastIndex; index += 1) {
      conquered.add(COMMUNITY_CAMPAIGN_ORDER[index]);
    }
  };

  for (const communityId of savedCommunityIds ?? []) {
    if (!validCommunityIds.has(communityId as CommunityType)) continue;
    includeThrough(COMMUNITY_CAMPAIGN_ORDER.indexOf(communityId as CommunityType));
  }

  // Older schema-v3 saves did not store route history, but several acknowledged
  // feature tutorials prove a minimum number of cities had been conquered.
  for (const unlockId of seenUnlockIds ?? []) {
    includeThrough((legacyFeatureConquestDepth[unlockId] ?? 0) - 1);
  }

  for (const communityId of getCurrentlyControlledCommunityIds(properties)) {
    includeThrough(COMMUNITY_CAMPAIGN_ORDER.indexOf(communityId));
  }

  let furthestOwnedIndex = -1;
  for (const property of properties) {
    if (property.owner !== 'player') continue;
    furthestOwnedIndex = Math.max(
      furthestOwnedIndex,
      COMMUNITY_CAMPAIGN_ORDER.indexOf(property.community)
    );
  }
  // A holding in city N proves cities before N were conquered, but does not
  // prove city N itself was completed.
  includeThrough(furthestOwnedIndex - 1);

  return COMMUNITY_CAMPAIGN_ORDER.filter((communityId) =>
    conquered.has(communityId)
  );
};

export const getUnlockedCommunityIds = (
  conqueredCommunityIds: ReadonlySet<CommunityType>
) => {
  const unlocked = new Set<CommunityType>();
  COMMUNITY_CAMPAIGN_ORDER.forEach((communityId, index) => {
    if (
      index === 0 ||
      COMMUNITY_CAMPAIGN_ORDER
        .slice(0, index)
        .every((priorId) => conqueredCommunityIds.has(priorId))
    ) {
      unlocked.add(communityId);
    }
  });
  return unlocked;
};

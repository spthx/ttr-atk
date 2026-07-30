import type { CommunityType, GroupSynergy } from '../types';

export const GRAND_COMPANY_EORZEA_ID = 'GRAND_COMPANY_EORZEA';

export const isProgressionBattleSynergy = (synergy: GroupSynergy) =>
  synergy.battleOnly === true &&
  synergy.battleEffect?.kind === 'timed_capital_buff';

export const isGroupSynergyUnlocked = ({
  synergy,
  ownedPropertyIds,
  conqueredCommunityIds,
}: {
  synergy: GroupSynergy;
  ownedPropertyIds: ReadonlySet<string>;
  conqueredCommunityIds: ReadonlySet<CommunityType>;
}) => {
  if (isProgressionBattleSynergy(synergy)) {
    return !!synergy.unlockAfterCommunity &&
      conqueredCommunityIds.has(synergy.unlockAfterCommunity);
  }
  return synergy.requiredPropertyIds.every((id) => ownedPropertyIds.has(id));
};

export const getGroupSynergySelectionPriority = (synergy: GroupSynergy) =>
  synergy.selectionPriority ?? synergy.bonusYieldMultiplier;

export const getLatestProgressionBattleSynergy = (
  synergies: readonly GroupSynergy[]
) =>
  synergies
    .filter(isProgressionBattleSynergy)
    .reduce<GroupSynergy | null>(
      (latest, synergy) =>
        !latest ||
        getGroupSynergySelectionPriority(synergy) >
          getGroupSynergySelectionPriority(latest)
          ? synergy
          : latest,
      null
    );

export const getBattleOnlySynergyMultiplier = (
  synergy: GroupSynergy,
  allBusinessesIntegrated = false
) => {
  const base = synergy.battleEffect?.capitalPressureMultiplier ?? 1;
  const integrationBonus =
    synergy.id === GRAND_COMPANY_EORZEA_ID && allBusinessesIntegrated
      ? 0.07
      : 0;
  return Number((base + integrationBonus).toFixed(2));
};

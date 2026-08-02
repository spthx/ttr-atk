import type { Cartel } from '../types';

const MINIMUM_HEADQUARTERS_DEFENSE = 50_000_000;
const WEAKENED_HEADQUARTERS_RATIO = 0.05;

/**
 * A cartel counts as high-end-raid preparation only after the player owns
 * both its headquarters and every participating company.
 */
export const isCartelFullyPrepared = (
  cartel: Pick<Cartel, 'hqPropertyId' | 'subsidiaryIds'>,
  ownedPropertyIds: ReadonlySet<string>
) =>
  ownedPropertyIds.has(cartel.hqPropertyId) &&
  cartel.subsidiaryIds.every((propertyId) => ownedPropertyIds.has(propertyId));

export const calculateCartelHeadquartersDefense = (
  cartel: Cartel,
  ownedSubsCount: number,
  totalSubsCount: number
) => {
  if (ownedSubsCount >= totalSubsCount) {
    return Math.max(
      MINIMUM_HEADQUARTERS_DEFENSE,
      Math.round(cartel.maxDefenseCapital * WEAKENED_HEADQUARTERS_RATIO)
    );
  }

  return Math.round(
    cartel.maxDefenseCapital *
      ((totalSubsCount - ownedSubsCount + 1) / (totalSubsCount + 1))
  );
};

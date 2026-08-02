export const MANUAL_ABILITY_SLOT_COUNT = 3;
export const AUTO_ABILITY_SLOT_COUNT = 2;
export const RESERVE_ABILITY_SLOT_COUNT = 1;
export const TOTAL_ABILITY_LOADOUT_SLOTS =
  MANUAL_ABILITY_SLOT_COUNT +
  AUTO_ABILITY_SLOT_COUNT +
  RESERVE_ABILITY_SLOT_COUNT;

export type AbilityActivationMode =
  | 'manual'
  | 'opening_auto'
  | 'critical_auto'
  | 'reserve';

export interface AbilityLoadout {
  equippedSkillIds: string[];
  openingAutoSkillId: string | null;
  criticalAutoSkillId: string | null;
  reserveSkillId: string | null;
  manualSkillIds: string[];
}

const uniqueKnownIds = (
  values: readonly string[],
  validSkillIds: ReadonlySet<string>
) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (!validSkillIds.has(value) || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};
/**
 * A deterministic, JSON-friendly loadout boundary shared by save migration,
 * the React UI and a future Unity importer. AUTO slots take precedence, the
 * manual row is capped at three, and one remaining learned ability may wait
 * in reserve without leaking into battle.
 */
export const normalizeAbilityLoadout = ({
  equippedSkillIds,
  openingAutoSkillId,
  criticalAutoSkillId,
  reserveSkillId,
  validSkillIds,
}: {
  equippedSkillIds: readonly string[];
  openingAutoSkillId: unknown;
  criticalAutoSkillId: unknown;
  reserveSkillId: unknown;
  validSkillIds: ReadonlySet<string>;
}): AbilityLoadout => {
  const knownIds = uniqueKnownIds(equippedSkillIds, validSkillIds);
  const knownSet = new Set(knownIds);
  const validEquippedId = (value: unknown): value is string =>
    typeof value === 'string' &&
    knownSet.has(value) &&
    validSkillIds.has(value);

  const opening = validEquippedId(openingAutoSkillId)
    ? openingAutoSkillId
    : null;
  const critical =
    validEquippedId(criticalAutoSkillId) &&
    criticalAutoSkillId !== opening
      ? criticalAutoSkillId
      : null;
  const explicitReserve =
    validEquippedId(reserveSkillId) &&
    reserveSkillId !== opening &&
    reserveSkillId !== critical
      ? reserveSkillId
      : null;

  const manualCandidates = knownIds.filter(
    (skillId) =>
      skillId !== opening &&
      skillId !== critical &&
      skillId !== explicitReserve
  );
  const manualSkillIds = manualCandidates.slice(
    0,
    MANUAL_ABILITY_SLOT_COUNT
  );
  const reserve =
    explicitReserve ??
    manualCandidates[MANUAL_ABILITY_SLOT_COUNT] ??
    null;
  const activeIds = new Set(
    [
      ...manualSkillIds,
      opening,
      critical,
      reserve,
    ].filter((skillId): skillId is string => !!skillId)
  );

  return {
    equippedSkillIds: knownIds.filter((skillId) => activeIds.has(skillId)),
    openingAutoSkillId: opening,
    criticalAutoSkillId: critical,
    reserveSkillId: reserve,
    manualSkillIds,
  };
};

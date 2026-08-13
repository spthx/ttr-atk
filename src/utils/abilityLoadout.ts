export const MANUAL_ABILITY_SLOT_COUNT = 3;
export const AUTO_ABILITY_SLOT_COUNT = 2;
export const TOTAL_ABILITY_LOADOUT_SLOTS =
  MANUAL_ABILITY_SLOT_COUNT + AUTO_ABILITY_SLOT_COUNT;

export type AbilityActivationMode =
  | 'manual'
  | 'opening_auto'
  | 'critical_auto';

export interface AbilityLoadout {
  equippedSkillIds: string[];
  openingAutoSkillId: string | null;
  criticalAutoSkillId: string | null;
  /** Legacy save compatibility only. There is no reserve/waiting slot. */
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
 * manual row is capped at three. Learned abilities outside the three manual
 * and two unlocked AUTO roles are simply unequipped; there is no waiting slot.
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
  const legacyReserve =
    validEquippedId(reserveSkillId) &&
    reserveSkillId !== opening &&
    reserveSkillId !== critical
      ? reserveSkillId
      : null;
  const manualCandidates = knownIds.filter(
    (skillId) =>
      skillId !== opening &&
      skillId !== critical &&
      skillId !== legacyReserve
  );
  const manualSkillIds = manualCandidates.slice(
    0,
    MANUAL_ABILITY_SLOT_COUNT
  );
  const activeIds = new Set(
    [
      ...manualSkillIds,
      opening,
      critical,
    ].filter((skillId): skillId is string => !!skillId)
  );

  return {
    equippedSkillIds: knownIds.filter((skillId) => activeIds.has(skillId)),
    openingAutoSkillId: opening,
    criticalAutoSkillId: critical,
    // A legacy reserve id is intentionally discarded during normalization.
    reserveSkillId: null,
    manualSkillIds,
  };
};

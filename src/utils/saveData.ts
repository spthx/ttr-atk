import { INITIAL_PROPERTIES, INITIAL_SKILLS } from '../data/initialData';
import type { AllianceState, CommunityType, Property } from '../types';
import { COMMUNITY_CAMPAIGN_ORDER } from '../data/worldData';
import { LIMIT_BREAK_MAX_CHARGE } from './gameBalance';
import type { SavageProgressVersion } from './savage';
import { normalizeAbilityLoadout } from './abilityLoadout';
import { ERA_WIND_SYNERGY_ID } from './synergy';
import { normalizePhantomWinStreak } from './phantomBattle';

export const SAVE_SCHEMA_VERSION = 3;
export const SAVE_STORAGE_KEY = 'tataru-world-trade-save-v3';
export const LEGACY_COMPANY_NAME_KEY = 'tataru-company-name';
export const MAX_OFFLINE_SECONDS = 30 * 60;

interface SavedPropertyState {
  id: string;
  owner: Property['owner'];
  ownerName: string;
  loyaltyRisk: number;
  reacquisitionLevel?: number;
}

export interface GameSaveData {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  companyName: string;
  totalFunds: number;
  properties: SavedPropertyState[];
  equippedSkillIds: string[];
  /** Optional schema-v3 additions. AUTO skills consume the five active slots. */
  openingAutoSkillId?: string | null;
  criticalAutoSkillId?: string | null;
  /** Legacy only. Reserve/waiting slots were removed; normalized to null. */
  reserveSkillId?: string | null;
  alliance: AllianceState;
  /** Optional so schema v3 saves created before staged unlocks stay compatible. */
  seenUnlockIds?: string[];
  /** Optional so older schema v3 saves begin with an empty persistent LB gauge. */
  limitBreakCharge?: number;
  /** Optional schema-v3 additions. Old completed saves unlock the normal ending automatically. */
  savageClearedPropertyIds?: string[];
  /** Distinguishes the current 12-encounter route from former Savage formats. */
  savageProgressVersion?: SavageProgressVersion;
  normalEndingSeen?: boolean;
  /** Permanent route progress. A subsidiary leaving never relocks a cleared city. */
  conqueredCommunityIds?: CommunityType[];
  /** Optional schema-v3 additions for the post-Savage Ultimate route. */
  savageEndingSeen?: boolean;
  ultimateCleared?: boolean;
  /** Optional post-Ultimate challenge record. Missing values remain uncleared. */
  cruelCleared?: boolean;
  /** Current Phantom Trade win streak. No best score or encounter history is saved. */
  phantomWinStreak?: number;
  /** Optional honor record for the post-Cruel Karma duty. Attempt ledgers are never saved. */
  karmaCleared?: boolean;
  trueEndingSeen?: boolean;
  /** One manual battle-synergy slot. Missing/unknown values fall back in App. */
  selectedBattleSynergyId?: string | null;
  /** Permanent reward for having held all normal businesses at once. */
  grandCompanyEorzeaIntegrated?: boolean;
  /**
   * Legacy schema-v3 field. Training no longer pauses passive income.
   * Kept optional so older saves load, then normalized to false.
   */
  passiveIncomePaused?: boolean;
  lastSavedAt: number;
}

const knownSkillIds = new Set(INITIAL_SKILLS.map((skill) => skill.id));
const LEGACY_ERA_WIND_SKILL_ID = 'skill_era_wind';
const ERA_WIND_UNLOCK_RAID_ID = 'savage_raid_2_layer_2';

export const normalizeAutoSkillLoadout = ({
  equippedSkillIds,
  openingAutoSkillId,
  criticalAutoSkillId,
  validSkillIds = knownSkillIds,
}: {
  equippedSkillIds: readonly string[];
  openingAutoSkillId: unknown;
  criticalAutoSkillId: unknown;
  validSkillIds?: ReadonlySet<string>;
}) => {
  const equippedIds = new Set(equippedSkillIds);
  const isValidEquippedSkill = (value: unknown): value is string =>
    typeof value === 'string' &&
    equippedIds.has(value) &&
    validSkillIds.has(value);
  const normalizedOpeningAutoSkillId = isValidEquippedSkill(
    openingAutoSkillId
  )
    ? openingAutoSkillId
    : null;
  const normalizedCriticalAutoSkillId =
    isValidEquippedSkill(criticalAutoSkillId) &&
    criticalAutoSkillId !== normalizedOpeningAutoSkillId
      ? criticalAutoSkillId
      : null;

  return {
    openingAutoSkillId: normalizedOpeningAutoSkillId,
    criticalAutoSkillId: normalizedCriticalAutoSkillId,
  };
};

export const normalizeSavedAbilityLoadout = ({
  equippedSkillIds,
  openingAutoSkillId,
  criticalAutoSkillId,
  reserveSkillId,
  validSkillIds = knownSkillIds,
}: {
  equippedSkillIds: readonly string[];
  openingAutoSkillId: unknown;
  criticalAutoSkillId: unknown;
  reserveSkillId: unknown;
  validSkillIds?: ReadonlySet<string>;
}) =>
  normalizeAbilityLoadout({
    equippedSkillIds,
    openingAutoSkillId,
    criticalAutoSkillId,
    reserveSkillId,
    validSkillIds,
  });

export const normalizeLimitBreakCharge = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(LIMIT_BREAK_MAX_CHARGE, value))
    : 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isAllianceState = (value: unknown): value is AllianceState =>
  isRecord(value) &&
  typeof value.allyId === 'string' &&
  typeof value.allyName === 'string' &&
  typeof value.active === 'boolean' &&
  (value.allyKind === undefined || value.allyKind === 'company' || value.allyKind === 'grand_company') &&
  (value.relationType === undefined || value.relationType === 'commercial_alliance' || value.relationType === 'public_patronage');

export const normalizeAllianceState = (alliance: AllianceState): AllianceState => {
  const allyKind = alliance.allyKind === 'grand_company' ? 'grand_company' : 'company';
  return {
    allyId: alliance.allyId,
    allyName: alliance.allyName,
    active: alliance.active,
    allyKind,
    relationType: allyKind === 'grand_company' ? 'public_patronage' : 'commercial_alliance',
  };
};

const isSavedProperty = (value: unknown): value is SavedPropertyState =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.owner === 'string' &&
  typeof value.ownerName === 'string' &&
  typeof value.loyaltyRisk === 'number' &&
  (value.reacquisitionLevel === undefined ||
    (typeof value.reacquisitionLevel === 'number' &&
      Number.isFinite(value.reacquisitionLevel)));

export const loadLegacyCompanyName = () => {
  if (typeof window === 'undefined') return null;
  try {
    const name = window.localStorage.getItem(LEGACY_COMPANY_NAME_KEY)?.trim();
    return name || null;
  } catch {
    return null;
  }
};

export const loadGameSave = (): GameSaveData | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);

    if (!isRecord(parsed) || parsed.schemaVersion !== SAVE_SCHEMA_VERSION) {
      console.warn('[タタルの大繁盛商店] 対応していないセーブデータのため初期状態で開始します。');
      return null;
    }

    if (
      typeof parsed.companyName !== 'string' ||
      typeof parsed.totalFunds !== 'number' ||
      !Number.isFinite(parsed.totalFunds) ||
      !Array.isArray(parsed.properties) ||
      !parsed.properties.every(isSavedProperty) ||
      !Array.isArray(parsed.equippedSkillIds) ||
      !parsed.equippedSkillIds.every((id) => typeof id === 'string') ||
      !isAllianceState(parsed.alliance) ||
      typeof parsed.lastSavedAt !== 'number'
    ) {
      console.warn('[タタルの大繁盛商店] セーブデータが壊れているため初期状態で開始します。');
      return null;
    }

    const abilityLoadout = normalizeSavedAbilityLoadout({
      equippedSkillIds: parsed.equippedSkillIds,
      openingAutoSkillId: parsed.openingAutoSkillId,
      criticalAutoSkillId: parsed.criticalAutoSkillId,
      reserveSkillId: parsed.reserveSkillId,
    });
    const migratedSelectedBattleSynergyId =
      parsed.equippedSkillIds.includes(LEGACY_ERA_WIND_SKILL_ID) &&
      Array.isArray(parsed.savageClearedPropertyIds) &&
      parsed.savageClearedPropertyIds.includes(ERA_WIND_UNLOCK_RAID_ID)
        ? ERA_WIND_SYNERGY_ID
        : typeof parsed.selectedBattleSynergyId === 'string'
          ? parsed.selectedBattleSynergyId
          : null;

    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      companyName: parsed.companyName.trim(),
      totalFunds: Math.max(0, parsed.totalFunds),
      properties: parsed.properties,
      equippedSkillIds: abilityLoadout.equippedSkillIds,
      openingAutoSkillId: abilityLoadout.openingAutoSkillId,
      criticalAutoSkillId: abilityLoadout.criticalAutoSkillId,
      reserveSkillId: abilityLoadout.reserveSkillId,
      alliance: normalizeAllianceState(parsed.alliance),
      seenUnlockIds: Array.isArray(parsed.seenUnlockIds)
        ? parsed.seenUnlockIds.filter((id): id is string => typeof id === 'string')
        : [],
      limitBreakCharge: normalizeLimitBreakCharge(parsed.limitBreakCharge),
      savageClearedPropertyIds: Array.isArray(parsed.savageClearedPropertyIds)
        ? parsed.savageClearedPropertyIds.filter((id): id is string => typeof id === 'string')
        : [],
      savageProgressVersion:
        parsed.savageProgressVersion === 2 ||
        parsed.savageProgressVersion === 3
          ? parsed.savageProgressVersion
          : undefined,
      normalEndingSeen: parsed.normalEndingSeen === true,
      conqueredCommunityIds: Array.isArray(parsed.conqueredCommunityIds)
        ? parsed.conqueredCommunityIds.filter(
            (id): id is CommunityType =>
              typeof id === 'string' &&
              COMMUNITY_CAMPAIGN_ORDER.includes(id as CommunityType)
          )
        : [],
      savageEndingSeen:
        parsed.savageEndingSeen === true ||
        (parsed.ultimateCleared === undefined && parsed.trueEndingSeen === true),
      ultimateCleared: parsed.ultimateCleared === true,
      cruelCleared: parsed.cruelCleared === true,
      phantomWinStreak: normalizePhantomWinStreak(parsed.phantomWinStreak),
      karmaCleared: parsed.karmaCleared === true,
      trueEndingSeen:
        parsed.ultimateCleared === true && parsed.trueEndingSeen === true,
      selectedBattleSynergyId: migratedSelectedBattleSynergyId,
      grandCompanyEorzeaIntegrated:
        parsed.grandCompanyEorzeaIntegrated === true,
      passiveIncomePaused: false,
      lastSavedAt: parsed.lastSavedAt,
    };
  } catch (error) {
    console.warn('[タタルの大繁盛商店] セーブデータを読み込めませんでした。', error);
    return null;
  }
};

export const restoreProperties = (save: GameSaveData | null): Property[] => {
  if (!save) return INITIAL_PROPERTIES;
  const savedById = new Map(save.properties.map((property) => [property.id, property]));

  return INITIAL_PROPERTIES.map((property) => {
    const saved = savedById.get(property.id);
    if (!saved) return property;
    return {
      ...property,
      owner: saved.owner,
      ownerName:
        saved.owner === 'player'
          ? saved.ownerName
          : saved.owner === 'independent'
            ? '独立物件'
            : property.ownerName,
      loyaltyRisk: Math.max(0, Math.min(100, saved.loyaltyRisk)),
      reacquisitionLevel: Math.max(
        0,
        Math.min(2, Math.floor(saved.reacquisitionLevel ?? 0))
      ),
    };
  });
};

export const saveGame = (data: Omit<GameSaveData, 'schemaVersion' | 'lastSavedAt'>) => {
  if (typeof window === 'undefined') return true;
  const payload: GameSaveData = {
    ...data,
    properties: data.properties.map(({
      id,
      owner,
      ownerName,
      loyaltyRisk,
      reacquisitionLevel,
    }) => ({
      id,
      owner,
      ownerName,
      loyaltyRisk,
      reacquisitionLevel,
    })),
    schemaVersion: SAVE_SCHEMA_VERSION,
    lastSavedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    return false;
  }
  try {
    window.localStorage.setItem(LEGACY_COMPANY_NAME_KEY, payload.companyName);
  } catch {
    // The legacy company-name mirror is non-authoritative. A failure here
    // must not invalidate the complete versioned save written above.
  }
  return true;
};

export const clearGameSave = () => {
  if (typeof window === 'undefined') return true;
  try {
    window.localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    return false;
  }
  try {
    window.localStorage.removeItem(LEGACY_COMPANY_NAME_KEY);
  } catch {
    // The authoritative save is already gone.
  }
  return true;
};

export const calculateOfflineIncome = (
  passiveRevenue: number,
  lastSavedAt: number,
  now = Date.now()
) => {
  const elapsedSeconds = Math.max(
    0,
    Math.min(MAX_OFFLINE_SECONDS, Math.floor((now - lastSavedAt) / 1000))
  );
  return Math.max(0, Math.floor(passiveRevenue * elapsedSeconds));
};

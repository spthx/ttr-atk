import { INITIAL_PROPERTIES } from '../data/initialData';
import type { AllianceState, Property } from '../types';

export const SAVE_SCHEMA_VERSION = 3;
export const SAVE_STORAGE_KEY = 'tataru-world-trade-save-v3';
export const LEGACY_COMPANY_NAME_KEY = 'tataru-company-name';
export const MAX_OFFLINE_SECONDS = 30 * 60;

interface SavedPropertyState {
  id: string;
  owner: Property['owner'];
  ownerName: string;
  loyaltyRisk: number;
}

export interface GameSaveData {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  companyName: string;
  totalFunds: number;
  properties: SavedPropertyState[];
  equippedSkillIds: string[];
  alliance: AllianceState;
  lastSavedAt: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isAllianceState = (value: unknown): value is AllianceState =>
  isRecord(value) &&
  typeof value.allyId === 'string' &&
  typeof value.allyName === 'string' &&
  typeof value.active === 'boolean';

const isSavedProperty = (value: unknown): value is SavedPropertyState =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.owner === 'string' &&
  typeof value.ownerName === 'string' &&
  typeof value.loyaltyRisk === 'number';

export const loadLegacyCompanyName = () => {
  if (typeof window === 'undefined') return null;
  const name = window.localStorage.getItem(LEGACY_COMPANY_NAME_KEY)?.trim();
  return name || null;
};

export const loadGameSave = (): GameSaveData | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);

    if (!isRecord(parsed) || parsed.schemaVersion !== SAVE_SCHEMA_VERSION) {
      console.warn('[タタルの大繁盛店] 対応していないセーブデータのため初期状態で開始します。');
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
      console.warn('[タタルの大繁盛店] セーブデータが壊れているため初期状態で開始します。');
      return null;
    }

    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      companyName: parsed.companyName.trim(),
      totalFunds: Math.max(0, parsed.totalFunds),
      properties: parsed.properties,
      equippedSkillIds: parsed.equippedSkillIds,
      alliance: parsed.alliance,
      lastSavedAt: parsed.lastSavedAt,
    };
  } catch (error) {
    console.warn('[タタルの大繁盛店] セーブデータを読み込めませんでした。', error);
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
      ownerName: saved.ownerName,
      loyaltyRisk: Math.max(0, Math.min(100, saved.loyaltyRisk)),
    };
  });
};

export const saveGame = (data: Omit<GameSaveData, 'schemaVersion' | 'lastSavedAt'>) => {
  if (typeof window === 'undefined') return;
  const payload: GameSaveData = {
    ...data,
    properties: data.properties.map(({ id, owner, ownerName, loyaltyRisk }) => ({
      id,
      owner,
      ownerName,
      loyaltyRisk,
    })),
    schemaVersion: SAVE_SCHEMA_VERSION,
    lastSavedAt: Date.now(),
  };
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
  window.localStorage.setItem(LEGACY_COMPANY_NAME_KEY, payload.companyName);
};

export const clearGameSave = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SAVE_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_COMPANY_NAME_KEY);
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

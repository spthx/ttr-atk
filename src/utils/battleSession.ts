import type { BattleMode, Property } from '../types';

export const PENDING_BATTLE_SESSION_KEY = 'tataru_trade_pending_battle_v1';
export const PENDING_BATTLE_RECOVERY_KEY =
  'tataru_trade_pending_battle_recovery_v1';
export const PENDING_BATTLE_SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export interface PendingBattleSession {
  version: 1;
  mode: BattleMode;
  targetProperty: Property;
  startedAt: number;
}

const BATTLE_MODES: readonly BattleMode[] = [
  'normal',
  'savage',
  'ultimate',
  'training',
];

const isRecoverableProperty = (value: unknown): value is Property => {
  if (!value || typeof value !== 'object') return false;
  const property = value as Partial<Property>;
  return (
    typeof property.id === 'string' &&
    property.id.length > 0 &&
    typeof property.name === 'string' &&
    typeof property.industry === 'string' &&
    typeof property.community === 'string' &&
    typeof property.marketPrice === 'number' &&
    Number.isFinite(property.marketPrice) &&
    typeof property.annualRevenue === 'number' &&
    Number.isFinite(property.annualRevenue) &&
    typeof property.owner === 'string' &&
    typeof property.ownerName === 'string' &&
    typeof property.loyaltyRisk === 'number' &&
    Number.isFinite(property.loyaltyRisk) &&
    Array.isArray(property.groupKeys) &&
    typeof property.description === 'string'
  );
};

export const parsePendingBattleSession = (
  raw: string | null,
  now = Date.now()
): PendingBattleSession | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingBattleSession>;
    if (
      parsed.version !== 1 ||
      !BATTLE_MODES.includes(parsed.mode as BattleMode) ||
      !isRecoverableProperty(parsed.targetProperty) ||
      typeof parsed.startedAt !== 'number' ||
      !Number.isFinite(parsed.startedAt) ||
      parsed.startedAt > now + 60_000 ||
      now - parsed.startedAt > PENDING_BATTLE_SESSION_MAX_AGE_MS
    ) {
      return null;
    }
    return parsed as PendingBattleSession;
  } catch {
    return null;
  }
};

export const loadPendingBattleSession = (): PendingBattleSession | null => {
  if (typeof window === 'undefined') return null;
  const candidates: Array<[Storage | undefined, string]> = [];
  try {
    candidates.push([window.sessionStorage, PENDING_BATTLE_SESSION_KEY]);
  } catch {
    candidates.push([undefined, PENDING_BATTLE_SESSION_KEY]);
  }
  try {
    candidates.push([window.localStorage, PENDING_BATTLE_RECOVERY_KEY]);
  } catch {
    candidates.push([undefined, PENDING_BATTLE_RECOVERY_KEY]);
  }
  for (const [storage, key] of candidates) {
    if (!storage) continue;
    try {
      const session = parsePendingBattleSession(storage.getItem(key));
      if (session) return session;
    } catch {
      // Try the durable mirror when session storage is unavailable.
    }
  }
  return null;
};

export const persistPendingBattleSession = (
  mode: BattleMode,
  targetProperty: Property,
  startedAt = Date.now()
) => {
  if (typeof window === 'undefined') return;
  const session: PendingBattleSession = {
    version: 1,
    mode,
    targetProperty,
    startedAt,
  };
  const serialized = JSON.stringify(session);
  try {
    window.sessionStorage.setItem(PENDING_BATTLE_SESSION_KEY, serialized);
  } catch {
    // The durable mirror below still protects an interrupted iOS WebContent process.
  }
  try {
    window.localStorage.setItem(PENDING_BATTLE_RECOVERY_KEY, serialized);
  } catch {
    // Storage can be unavailable in private browsing. The battle remains usable.
  }
};

export const clearPendingBattleSession = () => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_BATTLE_SESSION_KEY);
  } catch {
    // Best-effort cleanup only.
  }
  try {
    window.localStorage.removeItem(PENDING_BATTLE_RECOVERY_KEY);
  } catch {
    // Best-effort cleanup only.
  }
};

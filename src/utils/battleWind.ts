import type { WindType } from '../components/WindIndicator';

export const BATTLE_WIND_INITIAL_CALM_SECONDS = 10;
export const BATTLE_WIND_ROLL_INTERVAL_SECONDS = 10;
export const BATTLE_WIND_ROLL_CHANCE = 0.25;
export const BATTLE_WIND_TELEGRAPH_SECONDS = 2;
export const BATTLE_WIND_ACTIVE_MIN_SECONDS = 10;
export const BATTLE_WIND_ACTIVE_MAX_SECONDS = 13;
export const BATTLE_WIND_COOLDOWN_SECONDS = 18;

export type BattleWindPhase =
  | 'grace'
  | 'waiting'
  | 'telegraph'
  | 'active'
  | 'cooldown';

export interface BattleWindState {
  phase: BattleWindPhase;
  windType: WindType;
  pendingWindType: WindType | null;
  lastWindType: WindType | null;
  secondsRemaining: number;
}

export const createBattleWindState = (): BattleWindState => ({
  phase: 'grace',
  windType: 'CALM',
  pendingWindType: null,
  lastWindType: null,
  secondsRemaining: BATTLE_WIND_INITIAL_CALM_SECONDS,
});

export const shouldAdvanceBattleWind = ({
  battleActive,
  settled,
  presentationLocked,
  eraWindActive,
}: {
  battleActive: boolean;
  settled: boolean;
  presentationLocked: boolean;
  eraWindActive: boolean;
}) =>
  battleActive &&
  !settled &&
  !presentationLocked &&
  !eraWindActive;

const chooseWindType = (
  pool: readonly WindType[],
  lastWindType: WindType | null,
  random: () => number
) => {
  const candidates = pool.filter(
    (type) => type !== 'CALM' && type !== lastWindType
  );
  const fallback = pool.filter((type) => type !== 'CALM');
  const available = candidates.length > 0 ? candidates : fallback;
  if (available.length === 0) return null;
  return available[
    Math.min(available.length - 1, Math.floor(random() * available.length))
  ];
};

/**
 * Advances only the battle-local market wind. Callers simply skip this
 * function while a briefing/result overlay or 「時代の風」 is active.
 */
export const advanceBattleWind = (
  current: BattleWindState,
  elapsedSeconds: number,
  pool: readonly WindType[],
  random: () => number = Math.random
): BattleWindState => {
  let state = { ...current };
  let remainingElapsed = Math.max(0, elapsedSeconds);

  while (remainingElapsed > 0) {
    if (state.secondsRemaining > remainingElapsed) {
      state.secondsRemaining -= remainingElapsed;
      break;
    }

    remainingElapsed -= state.secondsRemaining;
    if (state.phase === 'active') {
      state = {
        phase: 'cooldown',
        windType: 'CALM',
        pendingWindType: null,
        lastWindType: state.windType,
        secondsRemaining: BATTLE_WIND_COOLDOWN_SECONDS,
      };
      continue;
    }

    if (state.phase === 'telegraph') {
      const windType = state.pendingWindType ?? 'CALM';
      const activeRange =
        BATTLE_WIND_ACTIVE_MAX_SECONDS -
        BATTLE_WIND_ACTIVE_MIN_SECONDS +
        1;
      state = {
        ...state,
        phase: 'active',
        windType,
        pendingWindType: null,
        secondsRemaining:
          BATTLE_WIND_ACTIVE_MIN_SECONDS +
          Math.floor(random() * activeRange),
      };
      continue;
    }

    if (state.phase === 'cooldown') {
      state = {
        ...state,
        phase: 'waiting',
        windType: 'CALM',
        secondsRemaining: BATTLE_WIND_ROLL_INTERVAL_SECONDS,
      };
      continue;
    }

    if (random() < BATTLE_WIND_ROLL_CHANCE) {
      const pendingWindType = chooseWindType(
        pool,
        state.lastWindType,
        random
      );
      if (pendingWindType) {
        state = {
          ...state,
          phase: 'telegraph',
          windType: 'CALM',
          pendingWindType,
          secondsRemaining: BATTLE_WIND_TELEGRAPH_SECONDS,
        };
        continue;
      }
    }

    state = {
      ...state,
      phase: 'waiting',
      windType: 'CALM',
      pendingWindType: null,
      secondsRemaining: BATTLE_WIND_ROLL_INTERVAL_SECONDS,
    };
  }

  return state;
};

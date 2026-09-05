import { memo, useCallback, useLayoutEffect, useRef, type ReactElement } from 'react';
import type { BattleMode, Property } from '../types';
import type { BattleReadinessResult } from './battleReadiness';

/** Event handlers only: render-time selectors must declare their dependencies. */
export function useAppEvent<Args extends unknown[], Result>(
  handler: (...args: Args) => Result
): (...args: Args) => Result {
  const committedHandler = useRef(handler);
  useLayoutEffect(() => {
    committedHandler.current = handler;
  });
  return useCallback((...args: Args) => committedHandler.current(...args), []);
}

/** One cache per immutable readiness context; never key a changing property by ID. */
export function createReadinessPerformanceCache(
  calculate: (target: Property, mode: BattleMode) => BattleReadinessResult
) {
  const targets = new WeakMap<Property, Map<BattleMode, BattleReadinessResult>>();
  return (target: Property, mode: BattleMode = 'normal') => {
    let modes = targets.get(target);
    if (!modes) {
      modes = new Map();
      targets.set(target, modes);
    }
    let result = modes.get(mode);
    if (!result) {
      result = calculate(target, mode);
      modes.set(mode, result);
    }
    return result;
  };
}

type BackgroundProps = {
  battleActive: boolean;
  children: ReactElement;
};

export function areAppBackgroundPropsEqual(previous: BackgroundProps, next: BackgroundProps) {
  // Keep the mounted ledger (filters, scroll and focus targets) through battle.
  // Entry and exit always reconcile; only covered, in-battle updates are skipped.
  return previous.battleActive === next.battleActive &&
    (next.battleActive || previous.children === next.children);
}

export const AppBattleBackground = memo(
  function AppBattleBackground({ children }: BackgroundProps) {
    return children;
  },
  areAppBackgroundPropsEqual
);

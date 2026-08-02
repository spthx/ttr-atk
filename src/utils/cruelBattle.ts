import {
  CRUEL_SCRIPTED_BATTLE,
  type CruelScriptPhase,
} from '../data/battleEncounterData';

const finiteOwnership = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

export const shouldTriggerCruelFirstPhase = ({
  isCruel,
  phase,
  activeElapsedMs,
}: {
  isCruel: boolean;
  phase: CruelScriptPhase;
  activeElapsedMs: number;
}) =>
  isCruel &&
  phase === 'awaiting_first' &&
  activeElapsedMs >= CRUEL_SCRIPTED_BATTLE.firstTriggerActiveMs;

export const resolveCruelFirstImpact = (currentPlayerOwnership: number) =>
  Math.min(
    finiteOwnership(currentPlayerOwnership),
    CRUEL_SCRIPTED_BATTLE.firstImpactPlayerOwnership
  );

export const shouldTriggerCruelSecondPhase = ({
  phase,
  currentPlayerOwnership,
  recoveryElapsedMs,
}: {
  phase: CruelScriptPhase;
  currentPlayerOwnership: number;
  recoveryElapsedMs: number;
}) =>
  phase === 'recovery' &&
  (
    finiteOwnership(currentPlayerOwnership) >=
      CRUEL_SCRIPTED_BATTLE.secondTriggerPlayerOwnership ||
    recoveryElapsedMs >= CRUEL_SCRIPTED_BATTLE.forcedSecondTriggerRecoveryMs
  );

export interface CruelSecondImpactResult {
  outcome: 'break' | 'defeat';
  ownershipBefore: number;
  ownershipAfter: number;
}

export const resolveCruelSecondImpact = (
  currentPlayerOwnership: number
): CruelSecondImpactResult => {
  const ownershipBefore = finiteOwnership(currentPlayerOwnership);
  if (ownershipBefore >= CRUEL_SCRIPTED_BATTLE.successPlayerOwnership) {
    return {
      outcome: 'break',
      ownershipBefore,
      ownershipAfter: ownershipBefore,
    };
  }
  return {
    outcome: 'defeat',
    ownershipBefore,
    ownershipAfter: CRUEL_SCRIPTED_BATTLE.secondFailureDisplayedOwnership,
  };
};

export const shouldHoldCruelVictory = (
  isCruel: boolean,
  phase: CruelScriptPhase
) => isCruel && phase !== 'resolved' && phase !== 'inactive';

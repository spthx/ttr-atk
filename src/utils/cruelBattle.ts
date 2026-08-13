import {
  CRUEL_SCRIPTED_BATTLE,
  type CruelScriptPhase,
} from '../data/battleEncounterData';

const finiteOwnership = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

const finiteNonNegative = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

export const calculateCruelSignatureRequirement = (marketPrice: number) =>
  Math.round(
    finiteNonNegative(marketPrice) *
      CRUEL_SCRIPTED_BATTLE.secondSignatureMarketRatio
  );

export const calculateCruelEntryRequirement = (
  marketPrice: number,
  brokerageFee = Math.round(finiteNonNegative(marketPrice) * 0.03)
) =>
  Math.round(finiteNonNegative(brokerageFee)) +
  calculateCruelSignatureRequirement(marketPrice);

export const resolveCruelRecoveryContinuousVelocity = ({
  velocity,
  isCruel,
  phase,
}: {
  velocity: number;
  isCruel: boolean;
  phase: CruelScriptPhase;
}) => {
  const finiteVelocity = Number.isFinite(velocity) ? velocity : 0;
  return isCruel && phase === 'recovery' && finiteVelocity < 0
    ? finiteVelocity *
        CRUEL_SCRIPTED_BATTLE.recoveryPlayerFavorablePressureMultiplier
    : finiteVelocity;
};

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
  ownershipSatisfied: boolean;
  signatureSatisfied: boolean;
  signaturePaid: number;
  signatureRequired: number;
}

export const resolveCruelSecondImpact = (
  currentPlayerOwnership: number,
  directInvestmentDuringCountdown: number,
  marketPrice: number
): CruelSecondImpactResult => {
  const ownershipBefore = finiteOwnership(currentPlayerOwnership);
  const signaturePaid = finiteNonNegative(directInvestmentDuringCountdown);
  const signatureRequired = calculateCruelSignatureRequirement(marketPrice);
  const ownershipSatisfied =
    ownershipBefore >= CRUEL_SCRIPTED_BATTLE.successPlayerOwnership;
  const signatureSatisfied = signaturePaid >= signatureRequired;
  if (ownershipSatisfied && signatureSatisfied) {
    return {
      outcome: 'break',
      ownershipBefore,
      ownershipAfter: ownershipBefore,
      ownershipSatisfied,
      signatureSatisfied,
      signaturePaid,
      signatureRequired,
    };
  }
  return {
    outcome: 'defeat',
    ownershipBefore,
    ownershipAfter: CRUEL_SCRIPTED_BATTLE.secondFailureDisplayedOwnership,
    ownershipSatisfied,
    signatureSatisfied,
    signaturePaid,
    signatureRequired,
  };
};

export const shouldHoldCruelVictory = (
  isCruel: boolean,
  phase: CruelScriptPhase
) => isCruel && phase !== 'resolved' && phase !== 'inactive';

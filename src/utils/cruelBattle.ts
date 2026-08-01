export const CRUEL_OMNICAPITALIZATION_BALANCE = {
  triggerPlayerOwnership: 75,
  telegraphMs: 4_500,
  maximumOwnershipPush: 40,
} as const;

export interface CruelOmnicapitalizationImpact {
  reserveRatio: number;
  ownershipPush: number;
  gaugeDelta: number;
}

const finiteNonNegative = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

/**
 * 万象資本化は「開幕時に未投入だった予備資金」を満額の基準にする。
 * ケアル等で基準を超えても40ptを越えず、敵へ先に資金を使わせれば
 * 同じ割合で弱体化する。
 */
export const calculateCruelOmnicapitalizationImpact = ({
  remainingReserve,
  openingReserve,
}: {
  remainingReserve: number;
  openingReserve: number;
}): CruelOmnicapitalizationImpact => {
  const baseline = finiteNonNegative(openingReserve);
  const reserveRatio =
    baseline <= 0
      ? 0
      : Math.min(1, finiteNonNegative(remainingReserve) / baseline);
  const ownershipPush = Number(
    (
      CRUEL_OMNICAPITALIZATION_BALANCE.maximumOwnershipPush * reserveRatio
    ).toFixed(2)
  );
  return {
    reserveRatio,
    ownershipPush,
    gaugeDelta: Number((ownershipPush * 2).toFixed(2)),
  };
};

export const shouldTriggerCruelOmnicapitalization = ({
  isCruel,
  alreadyUsed,
  pending,
  currentPlayerOwnership,
  candidatePlayerOwnership,
}: {
  isCruel: boolean;
  alreadyUsed: boolean;
  pending: boolean;
  currentPlayerOwnership: number;
  candidatePlayerOwnership: number;
}) =>
  isCruel &&
  !alreadyUsed &&
  !pending &&
  currentPlayerOwnership <
    CRUEL_OMNICAPITALIZATION_BALANCE.triggerPlayerOwnership &&
  candidatePlayerOwnership >=
    CRUEL_OMNICAPITALIZATION_BALANCE.triggerPlayerOwnership;

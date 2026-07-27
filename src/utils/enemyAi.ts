export type EnemyIntent =
  | 'CONSERVE'
  | 'WAIT_FOR_WIND'
  | 'STANDARD_DEFENSE'
  | 'AGGRESSIVE_DEFENSE'
  | 'EMERGENCY_DEFENSE'
  | 'COUNTER_ATTACK';

export type PlayerBattleAction =
  | 'SMALL'
  | 'STEADY'
  | 'BOLD'
  | 'LARGE'
  | 'ALL_IN'
  | 'FUNDS'
  | 'SYNERGY'
  | 'ALLIANCE'
  | 'LIMIT_BREAK';

type WindType =
  | 'TAILWIND_PLAYER'
  | 'HEADWIND_PLAYER'
  | 'TAILWIND_ENEMY'
  | 'CROSSWIND'
  | 'CALM';

export interface EnemyDecisionContext {
  enemyOwnership: number;
  enemyReservePercent: number;
  windType: WindType;
  windRemainingSeconds: number;
  lastPlayerAction: PlayerBattleAction | null;
  effectiveCapitalGap: number;
  marketPrice: number;
  isCartelHQ: boolean;
  isTutorial: boolean;
  slowed: boolean;
  cycle: number;
  difficultyLevel: number;
}

export interface EnemyDecision {
  intent: EnemyIntent;
  waitMs: number;
  investmentRatio: number;
  reserveProtected: boolean;
  reason: string;
}

export const ENEMY_INTENT_LABELS: Record<EnemyIntent, string> = {
  CONSERVE: '資金温存',
  WAIT_FOR_WIND: '追い風待ち',
  STANDARD_DEFENSE: '標準防衛',
  AGGRESSIVE_DEFENSE: '敵大規模防衛出資',
  EMERGENCY_DEFENSE: '緊急防衛',
  COUNTER_ATTACK: '大口出資へ対抗',
};

const jitter = (cycle: number) => {
  const value = Math.sin((cycle + 1) * 91.17) * 43758.5453;
  return value - Math.floor(value);
};

export const getEnemyBaseWaitMs = (
  difficultyLevel: number,
  isTutorial: boolean,
  isCartelHQ: boolean
) => {
  const intellect = Math.max(0, Math.min(6, difficultyLevel));
  return isTutorial
    ? 3400
    : Math.max(1780, 3020 - intellect * 245 - (isCartelHQ ? 140 : 0));
};

export const decideEnemyAction = ({
  enemyOwnership,
  enemyReservePercent,
  windType,
  windRemainingSeconds,
  lastPlayerAction,
  effectiveCapitalGap,
  marketPrice,
  isCartelHQ,
  isTutorial,
  slowed,
  cycle,
  difficultyLevel,
}: EnemyDecisionContext): EnemyDecision => {
  const intellect = Math.max(0, Math.min(6, difficultyLevel));
  const enemyWind = windType === 'TAILWIND_ENEMY' || windType === 'HEADWIND_PLAYER';
  const playerWind = windType === 'TAILWIND_PLAYER';
  const pressured =
    effectiveCapitalGap > marketPrice * (0.12 - intellect * 0.008);
  const severePressure =
    effectiveCapitalGap > marketPrice * (0.3 - intellect * 0.018);
  const baitAction = lastPlayerAction === 'SMALL' || lastPlayerAction === 'STEADY';
  const reactedToLarge =
    lastPlayerAction === 'LARGE' ||
    lastPlayerAction === 'ALL_IN' ||
    lastPlayerAction === 'LIMIT_BREAK';
  const trueEmergency =
    enemyOwnership < 24 ||
    lastPlayerAction === 'ALL_IN' ||
    lastPlayerAction === 'LIMIT_BREAK' ||
    (isCartelHQ && enemyOwnership < 38);
  const reserveFloor = 15;
  const reserveProtected = enemyReservePercent <= reserveFloor && !trueEmergency;
  const baseWait = getEnemyBaseWaitMs(
    difficultyLevel,
    isTutorial,
    isCartelHQ
  );
  const slowedMultiplier = slowed ? 1.9 : 1;
  const randomDelay = 0.9 + jitter(cycle) * 0.2;
  const responseScale = 1 + intellect * 0.075;

  if (reserveProtected) {
    return {
      intent: 'CONSERVE',
      waitMs: Math.round(baseWait * 1.45 * slowedMultiplier),
      investmentRatio: 0,
      reserveProtected: true,
      reason: `最終予備資金${reserveFloor}%を死守`,
    };
  }

  if (intellect >= 2 && baitAction && enemyOwnership >= 43 && !pressured) {
    return {
      intent: 'CONSERVE',
      waitMs: Math.round(baseWait * 1.18 * slowedMultiplier),
      investmentRatio: 0,
      reserveProtected: false,
      reason: '小口の囮を見切り、追随せず温存',
    };
  }

  if (
    enemyOwnership >= 57 &&
    effectiveCapitalGap <= marketPrice * 0.06 &&
    !reactedToLarge
  ) {
    return {
      intent: 'CONSERVE',
      waitMs: Math.round(baseWait * 1.25 * slowedMultiplier * randomDelay),
      investmentRatio: intellect >= 3 && enemyWind ? 0.016 : 0,
      reserveProtected: false,
      reason: enemyWind && intellect >= 3 ? '優勢を維持する最小限の増資' : '所有率優勢、無駄な追随を停止',
    };
  }

  if (reactedToLarge && enemyReservePercent > 0) {
    return {
      intent: enemyOwnership < 27 ? 'EMERGENCY_DEFENSE' : 'COUNTER_ATTACK',
      waitMs: Math.round(baseWait * (0.62 - intellect * 0.035) * slowedMultiplier),
      investmentRatio: (lastPlayerAction === 'LIMIT_BREAK' ? 0.16 : 0.11) * responseScale,
      reserveProtected: false,
      reason: lastPlayerAction === 'LIMIT_BREAK' ? 'LB後の硬直を読んだ緊急防衛' : '大口出資だけを選別して対抗',
    };
  }

  if (playerWind && windRemainingSeconds > 1.1 && !severePressure) {
    return {
      intent: 'WAIT_FOR_WIND',
      waitMs: Math.round(baseWait * (1.18 + intellect * 0.05) * slowedMultiplier),
      investmentRatio: 0,
      reserveProtected: false,
      reason: '自社の強い追い風を警戒し、風切れまで待機',
    };
  }

  if (enemyOwnership < 40) {
    const critical = enemyOwnership < 27;
    return {
      intent: critical ? 'EMERGENCY_DEFENSE' : 'AGGRESSIVE_DEFENSE',
      waitMs: Math.round(baseWait * (critical ? 0.52 : 0.7) * slowedMultiplier),
      investmentRatio: (critical ? 0.145 : enemyWind ? 0.12 : 0.092) * responseScale,
      reserveProtected: false,
      reason: critical ? '所有率危険域、予備資金を解放' : '劣勢分だけを計算して押し返す',
    };
  }

  if (enemyWind && (pressured || enemyOwnership < 52)) {
    return {
      intent: 'AGGRESSIVE_DEFENSE',
      waitMs: Math.round(baseWait * 0.68 * slowedMultiplier),
      investmentRatio: 0.1 * responseScale,
      reserveProtected: false,
      reason: '競合追い風を利用し、必要額だけ攻勢',
    };
  }

  return {
    intent: pressured ? 'AGGRESSIVE_DEFENSE' : 'STANDARD_DEFENSE',
    waitMs: Math.round(baseWait * randomDelay * slowedMultiplier),
    investmentRatio: (pressured ? 0.085 : 0.05) * responseScale,
    reserveProtected: false,
    reason: pressured ? '資金差を先読みし防衛額を増加' : '残予算を崩さない標準防衛',
  };
};

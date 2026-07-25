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
  capitalGap: number;
  marketPrice: number;
  isCartelHQ: boolean;
  isTutorial: boolean;
  slowed: boolean;
  cycle: number;
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

export const decideEnemyAction = ({
  enemyOwnership,
  enemyReservePercent,
  windType,
  windRemainingSeconds,
  lastPlayerAction,
  capitalGap,
  marketPrice,
  isCartelHQ,
  isTutorial,
  slowed,
  cycle,
}: EnemyDecisionContext): EnemyDecision => {
  const enemyWind =
    windType === 'TAILWIND_ENEMY' || windType === 'HEADWIND_PLAYER';
  const playerWind = windType === 'TAILWIND_PLAYER';
  const pressured = capitalGap > marketPrice * 0.12;
  const severePressure = capitalGap > marketPrice * 0.3;
  const reactedToLarge =
    lastPlayerAction === 'LARGE' ||
    lastPlayerAction === 'ALL_IN' ||
    lastPlayerAction === 'LIMIT_BREAK';
  const emergency =
    enemyOwnership < 30 ||
    reactedToLarge ||
    enemyWind ||
    isCartelHQ;
  const reserveProtected = enemyReservePercent <= 15 && !emergency;
  const baseWait = isTutorial ? 3600 : isCartelHQ ? 2250 : 2850;
  const slowedMultiplier = slowed ? 1.6 : 1;
  const randomDelay = 0.9 + jitter(cycle) * 0.22;

  if (reserveProtected) {
    return {
      intent: 'CONSERVE',
      waitMs: Math.round(baseWait * 1.55 * slowedMultiplier),
      investmentRatio: 0,
      reserveProtected: true,
      reason: '最終予備資金を温存',
    };
  }

  if (reactedToLarge && enemyReservePercent > 0) {
    return {
      intent: enemyOwnership < 25 ? 'EMERGENCY_DEFENSE' : 'COUNTER_ATTACK',
      waitMs: Math.round(baseWait * 0.58 * slowedMultiplier),
      investmentRatio: lastPlayerAction === 'LIMIT_BREAK' ? 0.14 : 0.105,
      reserveProtected: false,
      reason: lastPlayerAction === 'LIMIT_BREAK' ? 'LB直後の緊急防衛' : '大口出資へ対抗',
    };
  }

  if (enemyOwnership >= 65) {
    if (playerWind && windRemainingSeconds > 1.2 && !severePressure) {
      return {
        intent: 'WAIT_FOR_WIND',
        waitMs: Math.round(baseWait * 1.4 * slowedMultiplier),
        investmentRatio: 0,
        reserveProtected: false,
        reason: '有利を保ち風向きの変化を待つ',
      };
    }
    return {
      intent: 'CONSERVE',
      waitMs: Math.round(baseWait * 1.25 * slowedMultiplier * randomDelay),
      investmentRatio: pressured ? 0.04 : 0.025,
      reserveProtected: false,
      reason: '所有率優勢につき小口防衛',
    };
  }

  if (enemyOwnership < 35) {
    return {
      intent: enemyOwnership < 25 ? 'EMERGENCY_DEFENSE' : 'AGGRESSIVE_DEFENSE',
      waitMs: Math.round(baseWait * (enemyOwnership < 25 ? 0.58 : 0.76) * slowedMultiplier),
      investmentRatio: enemyOwnership < 25 ? 0.13 : enemyWind ? 0.11 : 0.085,
      reserveProtected: false,
      reason: enemyOwnership < 25 ? '所有率危険域、緊急防衛' : '劣勢を押し返す大規模防衛',
    };
  }

  if (playerWind && windRemainingSeconds > 1.5 && !severePressure) {
    return {
      intent: 'WAIT_FOR_WIND',
      waitMs: Math.round(baseWait * 1.25 * slowedMultiplier),
      investmentRatio: 0,
      reserveProtected: false,
      reason: '自社追い風を警戒し投入を保留',
    };
  }

  if (enemyWind) {
    return {
      intent: 'AGGRESSIVE_DEFENSE',
      waitMs: Math.round(baseWait * 0.72 * slowedMultiplier),
      investmentRatio: 0.095,
      reserveProtected: false,
      reason: '敵追い風の終了前に攻勢',
    };
  }

  return {
    intent: pressured ? 'AGGRESSIVE_DEFENSE' : 'STANDARD_DEFENSE',
    waitMs: Math.round(baseWait * randomDelay * slowedMultiplier),
    investmentRatio: pressured ? 0.08 : 0.052,
    reserveProtected: false,
    reason: pressured ? '資金差を警戒し防衛を増額' : '標準防衛を準備',
  };
};

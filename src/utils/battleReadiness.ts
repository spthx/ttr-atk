import type { GroupSynergy, Property } from '../types';
import { calculateRebellionProbability } from './formatter';
import {
  LIMIT_BREAK_MULTIPLIERS,
  getChargedLimitBreakTier,
  getLimitBreakChargeCapacity,
  getLimitBreakTier,
  PLAYER_BATTLE_CASH_CAP_RATIO,
  TACTICAL_SKILL_BALANCE,
} from './gameBalance';

export type BattleReadinessGrade =
  | 'advantage'
  | 'even'
  | 'challenge'
  | 'danger';

export type BattleReadinessSupportRoute =
  | '支援元一巡'
  | '戦闘連携'
  | 'LIMIT BREAK'
  | '支援なし';

export interface BattleReadinessCapitalComponent {
  key: 'cash' | 'subsidiaries' | 'synergy' | 'limit_break' | 'alliance' | 'capital_boost';
  label: string;
  amount: number;
}

export interface BattleReadinessInput {
  targetMarketPrice: number;
  availableCash: number;
  subsidiaries: Property[];
  selectedBattleSynergy?: GroupSynergy | null;
  limitBreakCharge: number;
  allianceSupport: number;
  hasCapitalBoost: boolean;
  enemyBudget: number;
  enemyDifficultyLevel: number;
  enemyBaseReactionSeconds: number;
  playerPushBonus: number;
  cashCapRatio?: number | null;
}

export interface BattleReadinessResult {
  grade: BattleReadinessGrade;
  symbol: '◎' | '＝' | '△' | '！';
  label: string;
  advice: string;
  playerExpectedCapital: number;
  enemyBudget: number;
  enemyOpeningCapital: number;
  enemyReserveCapital: number;
  ratio: number;
  ratioPercent: number;
  assessmentRatio: number;
  assessmentRatioPercent: number;
  minimumInvestment: number;
  directInvestmentAvailable: boolean;
  deployableCash: number;
  capitalComponents: BattleReadinessCapitalComponent[];
  supportRoute: BattleReadinessSupportRoute;
  supportCapital: number;
  supportRequestCount: number;
  supportVolatile: boolean;
  maxSupportFailureProbability: number;
  cumulativeSupportFailureProbability: number;
  expectedEnemyResponsesDuringSupport: number;
  sequentialSupportGradeCapped: boolean;
  enemyDifficultyLevel: number;
  enemyBaseReactionSeconds: number;
  playerPushBonus: number;
  battleCashLimit: number;
}

interface SupportRoute {
  name: BattleReadinessResult['supportRoute'];
  amount: number;
  actionCount: number;
  maxFailureProbability: number;
  cumulativeFailureProbability: number;
  componentKey: BattleReadinessCapitalComponent['key'] | null;
  componentLabel: string;
}

const expectedSupport = (
  properties: Property[],
  riskIncrease: number,
  marketRatio: number
) =>
  properties.reduce(
    (summary, property) => {
      const failureProbability = calculateRebellionProbability(
        Math.min(100, property.loyaltyRisk + riskIncrease)
      );
      const expectedAmount =
        Math.round(property.marketPrice * marketRatio) *
        (1 - failureProbability);
      return {
        amount: summary.amount + expectedAmount,
        maxFailureProbability: Math.max(
          summary.maxFailureProbability,
          failureProbability
        ),
        allSucceedProbability:
          summary.allSucceedProbability * (1 - failureProbability),
      };
    },
    {
      amount: 0,
      maxFailureProbability: 0,
      allSucceedProbability: 1,
    }
  );

const getBestSupportRoute = ({
  targetMarketPrice,
  subsidiaries,
  selectedBattleSynergy,
  limitBreakCharge,
}: Pick<
  BattleReadinessInput,
  | 'targetMarketPrice'
  | 'subsidiaries'
  | 'selectedBattleSynergy'
  | 'limitBreakCharge'
>) => {
  const routes: SupportRoute[] = [];

  if (subsidiaries.length > 0) {
    const onePass = expectedSupport(subsidiaries, 18, 0.45);
    routes.push({
      name: '支援元一巡',
      amount: Math.round(onePass.amount),
      actionCount: subsidiaries.length,
      maxFailureProbability: onePass.maxFailureProbability,
      cumulativeFailureProbability: 1 - onePass.allSucceedProbability,
      componentKey: 'subsidiaries',
      componentLabel: `支援元${subsidiaries.length}件へ各1回（一巡）`,
    });
  }

  if (selectedBattleSynergy) {
    const memberIds = new Set(selectedBattleSynergy.requiredPropertyIds);
    const members = subsidiaries.filter((property) =>
      memberIds.has(property.id)
    );
    if (
      members.length === selectedBattleSynergy.requiredPropertyIds.length &&
      members.length > 0
    ) {
      const synergySupport = expectedSupport(members, 14, 0.34);
      routes.push({
        name: '戦闘連携',
        amount: Math.round(
          synergySupport.amount *
            (selectedBattleSynergy.battleGroupMultiplier ?? 1.28)
        ),
        actionCount: 1,
        maxFailureProbability: synergySupport.maxFailureProbability,
        cumulativeFailureProbability:
          1 - synergySupport.allSucceedProbability,
        componentKey: 'synergy',
        componentLabel: `SYNERGY「${selectedBattleSynergy.name}」1回`,
      });
    }
  }

  const unlockedLimitTier = getLimitBreakTier(subsidiaries.length + 1);
  const chargedLimitTier = getChargedLimitBreakTier(
    Math.min(
      limitBreakCharge,
      getLimitBreakChargeCapacity(unlockedLimitTier)
    ),
    unlockedLimitTier
  );
  if (chargedLimitTier > 0) {
    const limitSupport = expectedSupport(subsidiaries, 12, 0.28);
    routes.push({
      name: 'LIMIT BREAK',
      amount: Math.round(
        (Math.round(targetMarketPrice * 0.28) + limitSupport.amount) *
          LIMIT_BREAK_MULTIPLIERS[chargedLimitTier]
      ),
      actionCount: 1,
      maxFailureProbability: limitSupport.maxFailureProbability,
      cumulativeFailureProbability:
        1 - limitSupport.allSucceedProbability,
      componentKey: 'limit_break',
      componentLabel: `LB${chargedLimitTier}（蓄積分を全消費）`,
    });
  }

  return routes.reduce<SupportRoute>(
    (best, route) => (route.amount > best.amount ? route : best),
    {
      name: '支援なし',
      amount: 0,
      actionCount: 0,
      maxFailureProbability: 0,
      cumulativeFailureProbability: 0,
      componentKey: null,
      componentLabel: '支援なし',
    }
  );
};

const getGradeForRatio = (ratio: number) => {
  if (ratio >= 1.15) {
    return {
      grade: 'advantage',
      symbol: '◎',
      label: '余力あり',
      advice: '基礎資本は上回っています。残金と独立危険度を守れば安定圏です。',
    } as const;
  }
  if (ratio >= 0.9) {
    return {
      grade: 'even',
      symbol: '＝',
      label: '接戦',
      advice: '投入順と競合の追加防衛を見れば、十分に勝負できます。',
    } as const;
  }
  if (ratio >= 0.7) {
    return {
      grade: 'challenge',
      symbol: '△',
      label: '要工夫',
      advice: '妨害・LB・追い風など、明確な一手を用意して挑む相手です。',
    } as const;
  }
  return {
    grade: 'danger',
    symbol: '！',
    label: '準備不足',
    advice: '先に安い対象を取得し、現金と安全な支援元を増やすのが堅実です。',
  } as const;
};

export const calculateBattleReadiness = ({
  targetMarketPrice,
  availableCash,
  subsidiaries,
  selectedBattleSynergy,
  limitBreakCharge,
  allianceSupport,
  hasCapitalBoost,
  enemyBudget,
  enemyDifficultyLevel,
  enemyBaseReactionSeconds,
  playerPushBonus,
  cashCapRatio = PLAYER_BATTLE_CASH_CAP_RATIO,
}: BattleReadinessInput): BattleReadinessResult => {
  const minimumInvestment = Math.max(
    10,
    Math.round(Math.max(0, targetMarketPrice) * 0.02)
  );
  const directInvestmentAvailable = availableCash >= minimumInvestment;
  const unrestrictedDeployableCash =
    !directInvestmentAvailable
      ? 0
      : Math.floor(Math.max(0, availableCash) / minimumInvestment) *
        minimumInvestment;
  const battleCashLimit =
    cashCapRatio === null
      ? Math.max(0, availableCash)
      : Math.max(
          minimumInvestment,
          Math.round(
            Math.max(0, targetMarketPrice) * Math.max(0, cashCapRatio)
          )
        );
  const deployableCash = Math.min(
    unrestrictedDeployableCash,
    battleCashLimit
  );
  const supportRoute = getBestSupportRoute({
    targetMarketPrice,
    subsidiaries,
    selectedBattleSynergy,
    limitBreakCharge,
  });
  const capitalBoost = hasCapitalBoost
    ? Math.round(
        Math.max(0, targetMarketPrice) *
          TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio
      )
    : 0;
  const rawPlayerCapital =
    deployableCash +
    supportRoute.amount +
    Math.max(0, allianceSupport) +
    capitalBoost;
  // 押し込み補正は同額資本が所有率を動かす速度であり、動員できる資本そのものではない。
  // 強さ表示では資本差を逆転させないよう、金額には乗算せず別情報として扱う。
  const playerExpectedCapital = Math.round(rawPlayerCapital);
  const normalizedEnemyBudget = Math.max(1, Math.round(enemyBudget));
  const ratio = playerExpectedCapital / normalizedEnemyBudget;
  const ratioPercent = Math.round(ratio * 100);
  const supportShare =
    supportRoute.amount / Math.max(playerExpectedCapital, 1);
  const commandRecoverySeconds =
    100 /
    (TACTICAL_SKILL_BALANCE.fastAction.baseCommandProgressPerTick * 10);
  const expectedEnemyResponsesDuringSupport =
    supportRoute.name === '支援元一巡' && supportRoute.actionCount > 1
      ? ((supportRoute.actionCount - 1) * commandRecoverySeconds) /
        Math.max(0.1, enemyBaseReactionSeconds)
      : 0;
  const sequentialSupportGradeCapped =
    ratio >= 1.15 &&
    supportRoute.name === '支援元一巡' &&
    supportShare >= 0.2 &&
    expectedEnemyResponsesDuringSupport >= 1;
  // 一巡総額は得られても、その操作中に競合が反応する場合は「安定圏」と断定しない。
  // 金額自体を架空に減らさず、等級だけを最大「接戦」へ抑える。
  const assessmentRatio = sequentialSupportGradeCapped
    ? Math.min(ratio, 1.149)
    : ratio;
  const assessmentRatioPercent = Math.round(assessmentRatio * 100);
  const supportVolatile =
    supportRoute.amount >= playerExpectedCapital * 0.2 &&
    supportRoute.cumulativeFailureProbability >= 0.25;
  const gradePresentation = getGradeForRatio(assessmentRatio);
  const capitalComponents: BattleReadinessCapitalComponent[] = [
    {
      key: 'cash',
      label:
        unrestrictedDeployableCash > battleCashLimit
          ? '自社現金（商戦持込上限）'
          : '自社現金（複数回投入）',
      amount: deployableCash,
    },
  ];
  if (supportRoute.componentKey && supportRoute.amount > 0) {
    capitalComponents.push({
      key: supportRoute.componentKey,
      label: supportRoute.componentLabel,
      amount: supportRoute.amount,
    });
  }
  if (allianceSupport > 0) {
    capitalComponents.push({
      key: 'alliance',
      label: '協力支援1回',
      amount: Math.max(0, allianceSupport),
    });
  }
  if (capitalBoost > 0) {
    capitalComponents.push({
      key: 'capital_boost',
      label: '意気衝天1回',
      amount: capitalBoost,
    });
  }

  return {
    grade: gradePresentation.grade,
    symbol: gradePresentation.symbol,
    label: gradePresentation.label,
    advice: sequentialSupportGradeCapped
      ? '総額は上回りますが、支援元への一巡要求中に競合が動きます。安定圏ではなく操作勝負です。'
      : gradePresentation.advice,
    playerExpectedCapital,
    enemyBudget: normalizedEnemyBudget,
    enemyOpeningCapital: Math.round(normalizedEnemyBudget * 0.25),
    enemyReserveCapital: Math.round(normalizedEnemyBudget * 0.75),
    ratio,
    ratioPercent,
    assessmentRatio,
    assessmentRatioPercent,
    minimumInvestment,
    directInvestmentAvailable,
    deployableCash,
    capitalComponents,
    supportRoute: supportRoute.name,
    supportCapital: supportRoute.amount,
    supportRequestCount: supportRoute.actionCount,
    supportVolatile,
    maxSupportFailureProbability: supportRoute.maxFailureProbability,
    cumulativeSupportFailureProbability:
      supportRoute.cumulativeFailureProbability,
    expectedEnemyResponsesDuringSupport,
    sequentialSupportGradeCapped,
    enemyDifficultyLevel,
    enemyBaseReactionSeconds,
    playerPushBonus,
    battleCashLimit,
  };
};

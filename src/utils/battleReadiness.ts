import type { BattleMode, GroupSynergy, Property } from '../types';
import { calculateRebellionProbability } from './formatter';
import {
  BATTLE_LOYALTY_BALANCE,
  BATTLE_SUPPORT_BALANCE,
  DIRECT_INVESTMENT_BALANCE,
  LIMIT_BREAK_MULTIPLIERS,
  getChargedLimitBreakTier,
  getLimitBreakChargeCapacity,
  getLimitBreakTier,
  PLAYER_BATTLE_CASH_CAP_RATIO,
  TACTICAL_SKILL_BALANCE,
  getSubsidiaryRiskIncrease,
  getSubsidiarySupportMultiplier,
} from './gameBalance';

export type BattleReadinessGrade =
  | 'advantage'
  | 'even'
  | 'challenge'
  | 'danger';

export type BattleReadinessMechanicSeverity =
  | 'none'
  | 'warning'
  | 'severe';

export type BattleReadinessSupportRoute =
  | '人脈一巡'
  | '戦闘連携'
  | 'LIMIT BREAK'
  | '支援なし';

export interface BattleReadinessCapitalComponent {
  key:
    | 'cash'
    | 'subsidiaries'
    | 'synergy'
    | 'limit_break'
    | 'alliance'
    | 'capital_boost'
    | 'battle_synergy';
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
  battleMode?: BattleMode;
  /**
   * 敵固有の防御・開幕・土壇場ギミックなど、資金総額だけでは測れない警告。
   * 通常都市ボスや企業連合本部も呼び出し側から明示できる。
   */
  mechanicWarning?: string | null;
  /**
   * warning は評価を最大「接戦」、severe は最大「要工夫」に抑える。
   */
  mechanicSeverity?: BattleReadinessMechanicSeverity;
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
  mechanicCheckRequired: boolean;
  mechanicWarning: string | null;
  mechanicSeverity: BattleReadinessMechanicSeverity;
  mechanicGradeCapped: boolean;
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
        Math.min(
          100,
          property.loyaltyRisk +
            getSubsidiaryRiskIncrease(property, riskIncrease)
        )
      );
      const expectedAmount =
        Math.round(
          property.marketPrice *
            marketRatio *
            getSubsidiarySupportMultiplier(property)
        );
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
    const onePass = expectedSupport(
      subsidiaries,
      BATTLE_LOYALTY_BALANCE.individualRiskIncrease,
      BATTLE_SUPPORT_BALANCE.subsidiaryMarketRatio
    );
    routes.push({
      name: '人脈一巡',
      amount: Math.round(onePass.amount),
      actionCount: subsidiaries.length,
      maxFailureProbability: onePass.maxFailureProbability,
      cumulativeFailureProbability: 1 - onePass.allSucceedProbability,
      componentKey: 'subsidiaries',
      componentLabel: `人脈${subsidiaries.length}件へ各1回（一巡）`,
    });
  }

  if (selectedBattleSynergy && !selectedBattleSynergy.battleOnly) {
    const memberIds = new Set(selectedBattleSynergy.requiredPropertyIds);
    const members = subsidiaries.filter((property) =>
      memberIds.has(property.id)
    );
    if (
      members.length === selectedBattleSynergy.requiredPropertyIds.length &&
      members.length > 0
    ) {
      const synergySupport = expectedSupport(
        members,
        BATTLE_LOYALTY_BALANCE.synergyRiskIncrease,
        BATTLE_SUPPORT_BALANCE.synergyMemberMarketRatio
      );
      routes.push({
        name: '戦闘連携',
        amount: Math.round(
          synergySupport.amount *
            (selectedBattleSynergy.battleGroupMultiplier ??
              BATTLE_SUPPORT_BALANCE.synergyDefaultMultiplier)
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
    const limitSupport = expectedSupport(
      subsidiaries,
      BATTLE_LOYALTY_BALANCE.limitBreakRiskIncrease,
      0.28
    );
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
    advice: '先に安い対象を取得し、現金と安全な人脈を増やすのが堅実です。',
  } as const;
};

export const calculateBattleSynergyReadinessEquivalent = ({
  targetMarketPrice,
  synergy,
  followUpCapital,
}: {
  targetMarketPrice: number;
  synergy?: GroupSynergy | null;
  followUpCapital: number;
}) => {
  const effect = synergy?.battleOnly ? synergy.battleEffect : null;
  if (!effect) return 0;

  const rallyGaugeMovement = Math.max(0, effect.ownershipPush ?? 0) * 2;
  const rallyMarketRatio = Math.max(
    0,
    (
      rallyGaugeMovement -
      DIRECT_INVESTMENT_BALANCE.baseGaugeImpact
    ) / DIRECT_INVESTMENT_BALANCE.gaugeImpactPerMarketRatio
  );
  const rallyEquivalent =
    Math.max(0, targetMarketPrice) * rallyMarketRatio;
  const durationWeight = Math.min(
    1,
    Math.max(0, effect.durationMs) /
      TACTICAL_SKILL_BALANCE.battleLitany.durationMs
  );
  const pressureEquivalent =
    Math.max(0, followUpCapital) *
    Math.max(0, effect.capitalPressureMultiplier - 1) *
    durationWeight;

  return Math.round(rallyEquivalent + pressureEquivalent);
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
  battleMode = 'normal',
  mechanicWarning: requestedMechanicWarning,
  mechanicSeverity: requestedMechanicSeverity,
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
  const battleSynergyEquivalent =
    calculateBattleSynergyReadinessEquivalent({
      targetMarketPrice,
      synergy: selectedBattleSynergy,
      followUpCapital: Math.max(
        supportRoute.amount,
        Math.min(deployableCash, Math.max(0, targetMarketPrice) * 0.25)
      ),
    });
  const rawPlayerCapital =
    deployableCash +
    supportRoute.amount +
    Math.max(0, allianceSupport) +
    capitalBoost +
    battleSynergyEquivalent;
  // 恒常的な押し込み補正は速度であり、動員資本そのものではないため
  // 金額へ乗算しない。一方、1戦1回の手動SYNERGYは即時ラリーと
  // 続く一手の実効値を直接変えるため、上で限定的に戦力換算する。
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
    supportRoute.name === '人脈一巡' && supportRoute.actionCount > 1
      ? ((supportRoute.actionCount - 1) * commandRecoverySeconds) /
        Math.max(0.1, enemyBaseReactionSeconds)
      : 0;
  const sequentialSupportGradeCapped =
    ratio >= 1.15 &&
    supportRoute.name === '人脈一巡' &&
    supportShare >= 0.2 &&
    expectedEnemyResponsesDuringSupport >= 1;
  // 一巡総額は得られても、その操作中に競合が反応する場合は「安定圏」と断定しない。
  // 金額自体を架空に減らさず、等級だけを最大「接戦」へ抑える。
  const supportAdjustedRatio = sequentialSupportGradeCapped
    ? Math.min(ratio, 1.149)
    : ratio;
  const builtInMechanicWarning =
    battleMode === 'cruel'
      ? '酷は残予備資金を全投入する「万象資本化」を決着前に必ず解決します。4～5秒の構えをスタンするか、防御アビリティで受ける準備が必要です。'
      : battleMode === 'ultimate'
      ? '絶は開幕・土壇場アビリティを決着前に必ず解決します。戦力が足りても、構えへの対応を誤ると敗北します。'
      : battleMode === 'savage'
        ? '零式は層ごとの開幕・土壇場・防御ギミックを含みます。戦力比だけでは勝利を保証しません。'
        : null;
  const initialMechanicWarning =
    requestedMechanicWarning === undefined
      ? builtInMechanicWarning
      : requestedMechanicWarning;
  const mechanicSeverity =
    requestedMechanicSeverity ??
    (battleMode === 'ultimate' || battleMode === 'cruel'
      ? 'severe'
      : battleMode === 'savage' || initialMechanicWarning
        ? 'warning'
        : 'none');
  const mechanicWarning =
    initialMechanicWarning ??
    (mechanicSeverity !== 'none'
      ? 'この相手には資金総額だけでは測れない固有ギミックがあります。戦闘前に内容を確認してください。'
      : null);
  const mechanicRatioCap =
    mechanicSeverity === 'severe'
      ? 0.899
      : mechanicSeverity === 'warning'
        ? 1.149
        : Number.POSITIVE_INFINITY;
  const mechanicGradeCapped = supportAdjustedRatio > mechanicRatioCap;
  const assessmentRatio = Math.min(
    supportAdjustedRatio,
    mechanicRatioCap
  );
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
      label: '外部アライアンス1回',
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
  if (battleSynergyEquivalent > 0 && selectedBattleSynergy) {
    capitalComponents.push({
      key: 'battle_synergy',
      label: `${selectedBattleSynergy.name}（号令＋次の一手）`,
      amount: battleSynergyEquivalent,
    });
  }
  const mechanicCheckRequired =
    mechanicSeverity !== 'none' || mechanicWarning !== null;

  return {
    grade: gradePresentation.grade,
    symbol: gradePresentation.symbol,
    label: gradePresentation.label,
    advice: mechanicGradeCapped
      ? mechanicSeverity === 'severe'
        ? '資本総額が上回っても、決着を覆す固有ギミックがあります。対処手段まで含めて準備してください。'
        : '資本総額は上回りますが、固有ギミックを無視した余裕判定はできません。内容を確認して挑みましょう。'
      : sequentialSupportGradeCapped
        ? '総額は上回りますが、人脈への一巡要求中に競合が動きます。安定圏ではなく操作勝負です。'
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
    mechanicCheckRequired,
    mechanicWarning,
    mechanicSeverity,
    mechanicGradeCapped,
  };
};

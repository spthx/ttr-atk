import type { BattleMode, GroupSynergy, Property } from '../types';
import { calculateRebellionProbability } from './formatter';
import { calculateCruelSignatureRequirement } from './cruelBattle';
import {
  BATTLE_LOYALTY_BALANCE,
  BATTLE_SUPPORT_BALANCE,
  DIRECT_INVESTMENT_BALANCE,
  HIGH_DIFFICULTY_SUPPORT_MULTIPLIER,
  LIMIT_BREAK_MULTIPLIERS,
  getChargedLimitBreakTier,
  getLimitBreakChargeCapacity,
  getLimitBreakTier,
  getRepeatedNetworkSupportMultiplier,
  PLAYER_BATTLE_CASH_CAP_RATIO,
  TACTICAL_SKILL_BALANCE,
  calculateSubsidiarySupportAmount,
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

export interface MobilizationPointComponent {
  key: BattleReadinessCapitalComponent['key'];
  label: string;
  points: number;
  amount: number;
}

const MOBILIZATION_COMPONENT_LABELS: Record<
  BattleReadinessCapitalComponent['key'],
  string
> = {
  cash: '手元資金',
  subsidiaries: '人脈',
  synergy: 'SYNERGY',
  limit_break: 'LIMIT BREAK',
  alliance: '外部協力',
  capital_boost: '資金アビリティ',
  battle_synergy: 'SYNERGY',
};

/**
 * Converts the real-gil readiness model into an exact, additive score with
 * enemy defense fixed at 100. Largest-remainder rounding keeps the displayed
 * component equation equal to the displayed mobilization total.
 */
export const buildMobilizationPointBreakdown = (
  components: ReadonlyArray<BattleReadinessCapitalComponent>,
  enemyBudget: number
): MobilizationPointComponent[] => {
  const normalizedEnemyBudget = Math.max(1, Math.round(enemyBudget));
  const prepared = components
    .filter((component) => Number.isFinite(component.amount) && component.amount > 0)
    .map((component, index) => {
      const rawPoints = (component.amount / normalizedEnemyBudget) * 100;
      const points = Math.floor(rawPoints);
      return {
        key: component.key,
        label: MOBILIZATION_COMPONENT_LABELS[component.key],
        amount: component.amount,
        points,
        remainder: rawPoints - points,
        index,
      };
    });

  if (prepared.length === 0) return [];

  const targetTotal = Math.round(
    (prepared.reduce((total, component) => total + component.amount, 0) /
      normalizedEnemyBudget) *
      100
  );
  const flooredTotal = prepared.reduce(
    (total, component) => total + component.points,
    0
  );
  const rankedForRounding = [...prepared].sort(
    (left, right) =>
      right.remainder - left.remainder || left.index - right.index
  );

  for (let offset = 0; offset < targetTotal - flooredTotal; offset += 1) {
    rankedForRounding[offset].points += 1;
  }

  return prepared.map(({ key, label, amount, points }) => ({
    key,
    label,
    amount,
    points,
  }));
};

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
  /**
   * `extreme` is a presentation-only assessment mode for reacquisition.
   * The live battle still uses the normal settlement and real-gil rules, but
   * an overwhelmingly stronger current company must not be mislabeled as a
   * close fight merely because deploying several contacts takes time.
   */
  battleMode?: BattleMode | 'extreme';
  /**
   * 敵固有の防御・開幕・瀕死ギミックなど、資金総額だけでは測れない警告。
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
  components: BattleReadinessCapitalComponent[];
}

const isHighDifficultyBattleMode = (
  battleMode: BattleReadinessInput['battleMode']
) =>
  battleMode === 'savage' ||
  battleMode === 'ultimate' ||
  battleMode === 'cruel' ||
  battleMode === 'karma' ||
  battleMode === 'phantom';

const expectedSupport = (
  properties: Property[],
  riskIncrease: number,
  marketRatio: number,
  amountMultiplier = 1
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
            getSubsidiarySupportMultiplier(property) *
            amountMultiplier
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
  battleMode,
}: Pick<
  BattleReadinessInput,
  | 'targetMarketPrice'
  | 'subsidiaries'
  | 'selectedBattleSynergy'
  | 'limitBreakCharge'
  | 'battleMode'
>) => {
  const routes: SupportRoute[] = [];
  const supportMultiplier = isHighDifficultyBattleMode(battleMode)
    ? HIGH_DIFFICULTY_SUPPORT_MULTIPLIER
    : 1;
  const highDifficultyLabel =
    supportMultiplier > 1
      ? `（高難度×${supportMultiplier.toFixed(2)}）`
      : '';

  if (subsidiaries.length > 0) {
    const onePass = expectedSupport(
      subsidiaries,
      BATTLE_LOYALTY_BALANCE.individualRiskIncrease,
      BATTLE_SUPPORT_BALANCE.subsidiaryMarketRatio
    );
    const orderedSupportAmounts = subsidiaries
      .map((property) =>
        Math.round(calculateSubsidiarySupportAmount(property) * supportMultiplier)
      )
      .sort((a, b) => b - a);
    const networkTotal = orderedSupportAmounts.reduce(
      (total, amount, requestIndex) =>
        total +
        Math.round(
          amount * getRepeatedNetworkSupportMultiplier(requestIndex)
        ),
      0
    );
    routes.push({
      name: '人脈一巡',
      amount: networkTotal,
      actionCount: subsidiaries.length,
      maxFailureProbability: onePass.maxFailureProbability,
      cumulativeFailureProbability: 1 - onePass.allSucceedProbability,
      components: [
        {
          key: 'subsidiaries',
          label: `人脈${subsidiaries.length}件を強い順に要請（2回目から全体減衰）${highDifficultyLabel}`,
          amount: networkTotal,
        },
      ],
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
        BATTLE_SUPPORT_BALANCE.synergyMemberMarketRatio,
        supportMultiplier
      );
      const synergyMultiplier =
        selectedBattleSynergy.battleGroupMultiplier ??
        BATTLE_SUPPORT_BALANCE.synergyDefaultMultiplier;
      const synergyTotal = Math.round(
        synergySupport.amount * synergyMultiplier
      );
      routes.push({
        name: '戦闘連携',
        amount: synergyTotal,
        actionCount: 1,
        maxFailureProbability: synergySupport.maxFailureProbability,
        cumulativeFailureProbability:
          1 - synergySupport.allSucceedProbability,
        components: [
          {
            key: 'subsidiaries',
            label: `人脈${members.length}件（SYNERGY参加企業）${highDifficultyLabel}`,
            amount: synergySupport.amount,
          },
          {
            key: 'synergy',
            label: `SYNERGY「${selectedBattleSynergy.name}」の上乗せ`,
            amount: Math.max(0, synergyTotal - synergySupport.amount),
          },
        ],
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
    const limitMultiplier = LIMIT_BREAK_MULTIPLIERS[chargedLimitTier];
    const limitTotal = Math.round(
      (Math.round(targetMarketPrice * 0.28) + limitSupport.amount) *
        limitMultiplier
    );
    const limitNetworkAmount = limitSupport.amount;
    routes.push({
      name: 'LIMIT BREAK',
      amount: limitTotal,
      actionCount: 1,
      maxFailureProbability: limitSupport.maxFailureProbability,
      cumulativeFailureProbability:
        1 - limitSupport.allSucceedProbability,
      components: [
        {
          key: 'subsidiaries',
          label: `人脈${subsidiaries.length}件（LB参加企業）`,
          amount: limitNetworkAmount,
        },
        {
          key: 'limit_break',
          label: `LB${chargedLimitTier}の上乗せ（蓄積分を全消費）`,
          amount: Math.max(0, limitTotal - limitNetworkAmount),
        },
      ],
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
      components: [],
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
  // Fourteen seconds is the neutral window used to value a timed battle
  // synergy. Keep this independent from any individual tactical ability so
  // the readiness model survives ability catalogue changes and ports cleanly.
  const battleSynergyBaselineDurationMs = 14_000;
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
      battleSynergyBaselineDurationMs
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
    battleMode,
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
  const reacquisitionAssessment = battleMode === 'extreme';
  const sequentialSupportGradeCapped =
    !reacquisitionAssessment &&
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
      ? `酷は約15秒後、投入資本・資金・LBを維持して所有率10%から立て直します。復帰中は自社へ進む継続速度が50%。10秒以内に50%へ戻すか、未到達でも15秒の第二査定が強制開始。終了時に所有率75%以上＋査定中の自社直接出資${Math.round(calculateCruelSignatureRequirement(targetMarketPrice) / 1_000_000)}M（相場10%）が必要です。直接出資2回分を温存してください。人脈・LB・SYNERGY・外部アライアンスは署名対象外です。`
      : battleMode === 'ultimate'
      ? '絶は開幕・瀕死アビリティを決着前に必ず解決します。短時間防御は開始直後に空撃ちせず、ドリルや敵LB3の危険予告へ合わせてください。戦力が足りても、構えへの対応を誤ると敗北します。'
      : battleMode === 'phantom'
        ? '幻は抽選された零式層の開幕・瀕死・防御ギミックをそのまま使い、競合の基礎資金力と判断速度だけが絶相当です。戦力比が足りても、層の予告と対策を誤ると敗北します。'
      : battleMode === 'karma'
        ? '業は所有率55／70／85／95%の節目ごとに、その時の一手を1件だけ覚えてものまねします。画面に出ている現在の一手と対抗方法だけを見て、計4回を順番に破ってください。'
      : battleMode === 'savage'
        ? '零式は層ごとの開幕・瀕死・防御ギミックを含みます。戦力比だけでは勝利を保証しません。'
        : null;
  const initialMechanicWarning =
    requestedMechanicWarning === undefined
      ? builtInMechanicWarning
      : requestedMechanicWarning;
  const mechanicSeverity =
    requestedMechanicSeverity ??
    (battleMode === 'ultimate' ||
      battleMode === 'cruel' ||
      battleMode === 'karma' ||
      battleMode === 'phantom'
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
    reacquisitionAssessment
      ? Number.POSITIVE_INFINITY
      : mechanicSeverity === 'severe'
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
  capitalComponents.push(
    ...supportRoute.components.filter((component) => component.amount > 0)
  );
  if (allianceSupport > 0) {
    capitalComponents.push({
      key: 'alliance',
      label: '外部アライアンス1回（高難度補正なし）',
      amount: Math.max(0, allianceSupport),
    });
  }
  if (capitalBoost > 0) {
    capitalComponents.push({
      key: 'capital_boost',
      label: 'ぶんどる1回',
      amount: capitalBoost,
    });
  }
  if (battleSynergyEquivalent > 0 && selectedBattleSynergy) {
    capitalComponents.push({
      key: 'battle_synergy',
      label: `${selectedBattleSynergy.name}（シナジー＋次の一手）`,
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

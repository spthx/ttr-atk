import { mkdir, writeFile } from 'node:fs/promises';
import { INITIAL_PROPERTIES } from '../src/data/initialData';
import { COMMUNITY_CAMPAIGN_ORDER } from '../src/data/worldData';
import type { Property } from '../src/types';
import {
  AUDIT_STRATEGIES,
  SeededRandom,
  calculatePassiveRevenue,
  cloneAsOwned,
  normalCampaignProperties,
  simulateBattle,
  type AuditStrategy,
  type BattleAuditResult,
} from './tataru-simulation-core';
import {
  buildSavageProperties,
  buildUltimateProperty,
  getSavagePropertyYieldMultiplier,
} from '../src/utils/savage';
import {
  calculateLiquidationCashback,
  resolvePostVictoryLoyalty,
} from '../src/utils/battleSettlement';
import { INITIAL_PLAYER_FUNDS } from '../src/utils/gameBalance';

const TOTAL_CAMPAIGNS = Math.max(
  1_000,
  Number(process.env.TATARU_ECONOMY_AUDIT_CAMPAIGNS ?? 1_000),
);
const EXPLOIT_TRIALS = Math.max(
  1_000,
  Number(process.env.TATARU_LIQUIDATION_AUDIT_TRIALS ?? 1_000),
);
const MAX_ATTEMPTS_PER_TARGET = 6;
const MAX_NORMAL_BATTLES = 120;
const MAX_HIGH_END_BATTLES = 40;

interface CampaignPolicy {
  id: string;
  label: string;
  strategy: AuditStrategy;
  order: 'random' | 'cheap' | 'roi' | 'expensive';
}

const POLICIES: readonly CampaignPolicy[] = [
  {
    id: 'random_all_in',
    label: '無計画・全力連打',
    strategy: AUDIT_STRATEGIES.find((strategy) => strategy.id === 'novice_all_in')!,
    order: 'random',
  },
  {
    id: 'cheap_steady',
    label: '安物優先・支援一巡',
    strategy: AUDIT_STRATEGIES.find((strategy) => strategy.id === 'steady')!,
    order: 'cheap',
  },
  {
    id: 'roi_expert',
    label: '収益効率優先・熟練運用',
    strategy: AUDIT_STRATEGIES.find((strategy) => strategy.id === 'expert_fresh')!,
    order: 'roi',
  },
  {
    id: 'expensive_prepared',
    label: '高額優先・全機能運用',
    strategy: AUDIT_STRATEGIES.find((strategy) => strategy.id === 'expert_prepared')!,
    order: 'expensive',
  },
] as const;

interface CampaignResult {
  policyId: string;
  campaignIndex: number;
  normalComplete: boolean;
  savageComplete: boolean;
  ultimateComplete: boolean;
  softlocked: boolean;
  stoppedReason: string | null;
  conqueredCities: number;
  savageClears: number;
  totalSeconds: number;
  waitingSeconds: number;
  battleSeconds: number;
  normalCompleteAt: number | null;
  savageCompleteAt: number | null;
  ultimateCompleteAt: number | null;
  cityCompletedAt: Array<number | null>;
  firstSavageWaitSeconds: number | null;
  totalBattles: number;
  normalBattles: number;
  highEndBattles: number;
  battleLosses: number;
  timeouts: number;
  departures: number;
  reacquisitions: number;
  maxOwnedProperties: number;
  finalOwnedProperties: number;
  finalFunds: number;
  finalPassiveRevenue: number;
  finalLimitBreakCharge: number;
  totalBrokerage: number;
  totalSettlement: number;
  totalVictoryRewards: number;
  totalLiquidationCashback: number;
}

function mean(values: number[]) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
}

function percentile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))
  ];
}

function pct(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function withSavageYield(
  owned: readonly Property[],
  clearedIds: ReadonlySet<string>,
) {
  return owned.map((property) => ({
    ...property,
    annualRevenue: Math.round(
      property.annualRevenue *
        getSavagePropertyYieldMultiplier(property.id, clearedIds),
    ),
  }));
}

function chooseTarget(
  missing: Property[],
  policy: CampaignPolicy,
  rng: SeededRandom,
) {
  if (policy.order === 'random') return rng.pick(missing);
  return [...missing].sort((left, right) => {
    if (policy.order === 'cheap') return left.marketPrice - right.marketPrice;
    if (policy.order === 'expensive') return right.marketPrice - left.marketPrice;
    const leftRoi = left.annualRevenue / Math.max(1, left.marketPrice);
    const rightRoi = right.annualRevenue / Math.max(1, right.marketPrice);
    if (rightRoi !== leftRoi) return rightRoi - leftRoi;
    return left.marketPrice - right.marketPrice;
  })[0];
}

function ensureBrokerageFunds(args: {
  funds: number;
  target: Property;
  owned: Property[];
  clearedSavageIds: ReadonlySet<string>;
}) {
  const brokerageFee = Math.round(args.target.marketPrice * 0.03);
  if (args.funds >= brokerageFee) {
    return { possible: true, funds: args.funds, waitSeconds: 0 };
  }
  const passiveRevenue = calculatePassiveRevenue(
    withSavageYield(args.owned, args.clearedSavageIds),
  );
  if (passiveRevenue <= 0) {
    return { possible: false, funds: args.funds, waitSeconds: 0 };
  }
  const waitSeconds = Math.ceil((brokerageFee - args.funds) / passiveRevenue);
  return {
    possible: true,
    funds: args.funds + waitSeconds * passiveRevenue,
    waitSeconds,
  };
}

function applyBattleResult(
  currentOwned: Property[],
  target: Property,
  result: BattleAuditResult,
) {
  const survivors = result.survivingProperties.map((property) => ({ ...property }));
  if (result.winner === 'player') {
    const existing = survivors.find((property) => property.id === target.id);
    if (!existing) {
      survivors.push({
        ...target,
        owner: 'player',
        ownerName: '監査商会',
        loyaltyRisk: 0,
      });
    }
  }
  return survivors;
}

function simulateCampaign(policy: CampaignPolicy, campaignIndex: number): CampaignResult {
  const rng = new SeededRandom(
    campaignIndex * 1_000_003 + POLICIES.indexOf(policy) * 100_003,
  );
  const normalTargets = normalCampaignProperties();
  let owned: Property[] = [];
  let funds = INITIAL_PLAYER_FUNDS;
  let limitBreakCharge: number | undefined = undefined;
  let conqueredCities = 0;
  let normalComplete = false;
  let savageComplete = false;
  let ultimateComplete = false;
  let softlocked = false;
  let stoppedReason: string | null = null;
  let totalSeconds = 0;
  let waitingSeconds = 0;
  let battleSeconds = 0;
  let normalCompleteAt: number | null = null;
  let savageCompleteAt: number | null = null;
  let ultimateCompleteAt: number | null = null;
  const cityCompletedAt = Array(COMMUNITY_CAMPAIGN_ORDER.length).fill(null) as Array<number | null>;
  let firstSavageWaitSeconds: number | null = null;
  let totalBattles = 0;
  let normalBattles = 0;
  let highEndBattles = 0;
  let battleLosses = 0;
  let timeouts = 0;
  let departures = 0;
  let reacquisitions = 0;
  let maxOwnedProperties = 0;
  let totalBrokerage = 0;
  let totalSettlement = 0;
  let totalVictoryRewards = 0;
  let totalLiquidationCashback = 0;
  const everAcquired = new Set<string>();
  const clearedSavageIds = new Set<string>();

  const applyAccounting = (result: BattleAuditResult) => {
    totalBattles += 1;
    battleSeconds += result.durationSeconds;
    totalSeconds += result.durationSeconds;
    funds = result.finalFunds;
    limitBreakCharge = result.finalLimitBreakCharge;
    totalBrokerage += result.brokerageFee;
    totalSettlement += result.settlementCost;
    totalVictoryRewards += result.victoryReward;
    totalLiquidationCashback += result.liquidationCashback;
    departures += result.leavingProperties.length;
    if (result.winner !== 'player') battleLosses += 1;
    if (result.winner === 'timeout') timeouts += 1;
  };

  for (let cityIndex = 0; cityIndex < COMMUNITY_CAMPAIGN_ORDER.length; cityIndex += 1) {
    const community = COMMUNITY_CAMPAIGN_ORDER[cityIndex];
    const cityTargets = normalTargets.filter(
      (property) => property.community === community,
    );
    let cityBattles = 0;

    while (
      !cityTargets.every((target) => owned.some((property) => property.id === target.id))
    ) {
      if (normalBattles >= MAX_NORMAL_BATTLES || cityBattles >= 40) {
        stoppedReason = `normal battle cap at ${community}`;
        break;
      }
      const missing = cityTargets.filter(
        (target) => !owned.some((property) => property.id === target.id),
      );
      const target = chooseTarget(missing, policy, rng);
      let won = false;

      for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_TARGET; attempt += 1) {
        const funding = ensureBrokerageFunds({
          funds,
          target,
          owned,
          clearedSavageIds,
        });
        if (!funding.possible) {
          softlocked = true;
          stoppedReason = `brokerage softlock at ${community}/${target.id}`;
          break;
        }
        funds = funding.funds;
        waitingSeconds += funding.waitSeconds;
        totalSeconds += funding.waitSeconds;

        const result = simulateBattle({
          targetProperty: target,
          ownedProperties: withSavageYield(owned, clearedSavageIds),
          totalFunds: funds,
          conqueredCommunityCount: conqueredCities,
          mode: 'normal',
          strategy: policy.strategy,
          seed:
            campaignIndex * 10_000_019 +
            totalBattles * 100_003 +
            attempt * 4_099 +
            cityIndex,
          initialLimitBreakCharge: limitBreakCharge,
          maxSeconds: 180,
        });
        normalBattles += 1;
        cityBattles += 1;
        applyAccounting(result);
        owned = applyBattleResult(owned, target, result);
        maxOwnedProperties = Math.max(maxOwnedProperties, owned.length);

        if (result.winner === 'player') {
          if (everAcquired.has(target.id)) reacquisitions += 1;
          everAcquired.add(target.id);
          won = true;
          break;
        }
        if (softlocked) break;
      }

      if (softlocked || stoppedReason || !won) {
        if (!stoppedReason) {
          stoppedReason = `failed ${MAX_ATTEMPTS_PER_TARGET} attempts at ${community}/${target.id}`;
        }
        break;
      }
    }

    if (softlocked || stoppedReason) break;
    conqueredCities += 1;
    cityCompletedAt[cityIndex] = totalSeconds;
  }

  if (conqueredCities === COMMUNITY_CAMPAIGN_ORDER.length) {
    normalComplete = true;
    normalCompleteAt = totalSeconds;
  }

  if (normalComplete) {
    const savageTargets = buildSavageProperties(
      INITIAL_PROPERTIES,
      new Set<string>(),
      '監査商会',
    );
    for (let layer = 0; layer < savageTargets.length; layer += 1) {
      const target = savageTargets[layer];
      let won = false;
      for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_TARGET; attempt += 1) {
        if (highEndBattles >= MAX_HIGH_END_BATTLES) {
          stoppedReason = `high-end battle cap at savage layer ${layer + 1}`;
          break;
        }
        const funding = ensureBrokerageFunds({
          funds,
          target,
          owned,
          clearedSavageIds,
        });
        if (!funding.possible) {
          softlocked = true;
          stoppedReason = `savage brokerage softlock at layer ${layer + 1}`;
          break;
        }
        if (layer === 0 && attempt === 0) firstSavageWaitSeconds = funding.waitSeconds;
        funds = funding.funds;
        waitingSeconds += funding.waitSeconds;
        totalSeconds += funding.waitSeconds;

        const result = simulateBattle({
          targetProperty: target,
          ownedProperties: withSavageYield(owned, clearedSavageIds),
          totalFunds: funds,
          conqueredCommunityCount: conqueredCities,
          mode: 'savage',
          strategy: policy.strategy,
          seed:
            campaignIndex * 20_000_033 +
            highEndBattles * 200_003 +
            layer * 10_007 +
            attempt,
          initialLimitBreakCharge: limitBreakCharge,
          maxSeconds: 300,
        });
        highEndBattles += 1;
        applyAccounting(result);
        if (result.winner === 'player') {
          clearedSavageIds.add(target.id);
          won = true;
          break;
        }
      }
      if (!won || softlocked || stoppedReason) break;
    }
    if (clearedSavageIds.size === savageTargets.length) {
      savageComplete = true;
      savageCompleteAt = totalSeconds;
    }
  }

  if (savageComplete) {
    const target = buildUltimateProperty(false, '監査商会');
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_TARGET; attempt += 1) {
      const funding = ensureBrokerageFunds({
        funds,
        target,
        owned,
        clearedSavageIds,
      });
      if (!funding.possible) {
        softlocked = true;
        stoppedReason = 'ultimate brokerage softlock';
        break;
      }
      funds = funding.funds;
      waitingSeconds += funding.waitSeconds;
      totalSeconds += funding.waitSeconds;
      const result = simulateBattle({
        targetProperty: target,
        ownedProperties: withSavageYield(owned, clearedSavageIds),
        totalFunds: funds,
        conqueredCommunityCount: conqueredCities,
        mode: 'ultimate',
        strategy: policy.strategy,
        seed:
          campaignIndex * 30_000_043 +
          highEndBattles * 300_007 +
          attempt,
        initialLimitBreakCharge: limitBreakCharge,
        maxSeconds: 360,
      });
      highEndBattles += 1;
      applyAccounting(result);
      if (result.winner === 'player') {
        ultimateComplete = true;
        ultimateCompleteAt = totalSeconds;
        break;
      }
    }
    if (!ultimateComplete && !stoppedReason) {
      stoppedReason = `failed ${MAX_ATTEMPTS_PER_TARGET} ultimate attempts`;
    }
  }

  return {
    policyId: policy.id,
    campaignIndex,
    normalComplete,
    savageComplete,
    ultimateComplete,
    softlocked,
    stoppedReason,
    conqueredCities,
    savageClears: clearedSavageIds.size,
    totalSeconds,
    waitingSeconds,
    battleSeconds,
    normalCompleteAt,
    savageCompleteAt,
    ultimateCompleteAt,
    cityCompletedAt,
    firstSavageWaitSeconds,
    totalBattles,
    normalBattles,
    highEndBattles,
    battleLosses,
    timeouts,
    departures,
    reacquisitions,
    maxOwnedProperties,
    finalOwnedProperties: owned.length,
    finalFunds: funds,
    finalPassiveRevenue: calculatePassiveRevenue(
      withSavageYield(owned, clearedSavageIds),
    ),
    finalLimitBreakCharge: limitBreakCharge ?? 0,
    totalBrokerage,
    totalSettlement,
    totalVictoryRewards,
    totalLiquidationCashback,
  };
}

function aggregatePolicy(policy: CampaignPolicy, results: CampaignResult[]) {
  const completedNormal = results.filter((result) => result.normalComplete);
  const completedSavage = results.filter((result) => result.savageComplete);
  const completedUltimate = results.filter((result) => result.ultimateComplete);
  const cityStats = COMMUNITY_CAMPAIGN_ORDER.map((community, index) => {
    const values = results
      .map((result) => result.cityCompletedAt[index])
      .filter((value): value is number => value !== null);
    return {
      community,
      reached: values.length,
      completionRate: values.length / Math.max(1, results.length),
      averageCompletedAt: mean(values),
      p90CompletedAt: percentile(values, 0.9),
    };
  });
  return {
    policyId: policy.id,
    policyLabel: policy.label,
    trials: results.length,
    normalCompletionRate: completedNormal.length / Math.max(1, results.length),
    savageCompletionRate: completedSavage.length / Math.max(1, results.length),
    ultimateCompletionRate: completedUltimate.length / Math.max(1, results.length),
    softlockRate:
      results.filter((result) => result.softlocked).length /
      Math.max(1, results.length),
    averageConqueredCities: mean(results.map((result) => result.conqueredCities)),
    averageNormalCompleteSeconds: mean(
      completedNormal.map((result) => result.normalCompleteAt ?? 0),
    ),
    p90NormalCompleteSeconds: percentile(
      completedNormal.map((result) => result.normalCompleteAt ?? 0),
      0.9,
    ),
    averageUltimateCompleteSeconds: mean(
      completedUltimate.map((result) => result.ultimateCompleteAt ?? 0),
    ),
    averageWaitingSeconds: mean(results.map((result) => result.waitingSeconds)),
    averageBattleSeconds: mean(results.map((result) => result.battleSeconds)),
    averageBattles: mean(results.map((result) => result.totalBattles)),
    averageLosses: mean(results.map((result) => result.battleLosses)),
    averageDepartures: mean(results.map((result) => result.departures)),
    averageReacquisitions: mean(results.map((result) => result.reacquisitions)),
    averageFinalFunds: mean(results.map((result) => result.finalFunds)),
    averageFinalPassiveRevenue: mean(
      results.map((result) => result.finalPassiveRevenue),
    ),
    averageFirstSavageWaitSeconds: mean(
      completedNormal
        .map((result) => result.firstSavageWaitSeconds)
        .filter((value): value is number => value !== null),
    ),
    cityStats,
  };
}

function auditLiquidationCycle() {
  const target = [...normalCampaignProperties()].sort(
    (left, right) => right.marketPrice - left.marketPrice,
  )[0];
  const ownedOthers = cloneAsOwned(
    normalCampaignProperties().filter((property) => property.id !== target.id),
  );
  const strategy = AUDIT_STRATEGIES.find(
    (candidate) => candidate.id === 'expert_fresh',
  )!;
  let departures = 0;
  let successfulReacquisitions = 0;
  let failedReacquisitions = 0;
  let totalCashback = 0;
  let totalReacquisitionCost = 0;
  let totalProfit = 0;

  for (let trial = 1; trial <= EXPLOIT_TRIALS; trial += 1) {
    const risky = {
      ...target,
      owner: 'player' as const,
      ownerName: '監査商会',
      loyaltyRisk: 100,
    };
    const loyalty = resolvePostVictoryLoyalty(
      [risky],
      false,
      () => new SeededRandom(trial * 65_537).next(),
    );
    const cashback = calculateLiquidationCashback(loyalty.leaving);
    if (cashback <= 0) continue;
    departures += 1;
    totalCashback += cashback;

    let reacquired = false;
    let cycleCost = 0;
    let limitBreakCharge: number | undefined = undefined;
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_TARGET; attempt += 1) {
      const result = simulateBattle({
        targetProperty: {
          ...target,
          owner: 'independent',
          ownerName: '独立物件',
          loyaltyRisk: 0,
          reacquisitionLevel: 2,
        },
        ownedProperties: ownedOthers.map((property) => ({ ...property })),
        totalFunds: target.marketPrice,
        conqueredCommunityCount: COMMUNITY_CAMPAIGN_ORDER.length,
        mode: 'normal',
        strategy,
        seed: trial * 1_000_003 + attempt * 10_007,
        initialLimitBreakCharge: limitBreakCharge,
        maxSeconds: 180,
      });
      limitBreakCharge = result.finalLimitBreakCharge;
      cycleCost +=
        result.brokerageFee +
        result.settlementCost -
        result.victoryReward +
        result.celebrationGiftCost;
      if (result.winner === 'player') {
        reacquired = true;
        break;
      }
    }
    if (reacquired) {
      successfulReacquisitions += 1;
      totalReacquisitionCost += cycleCost;
      totalProfit += cashback - cycleCost;
    } else {
      failedReacquisitions += 1;
      totalReacquisitionCost += cycleCost;
      totalProfit += cashback - cycleCost;
    }
  }

  return {
    targetId: target.id,
    targetName: target.name,
    marketPrice: target.marketPrice,
    trials: EXPLOIT_TRIALS,
    departures,
    departureRate: departures / EXPLOIT_TRIALS,
    successfulReacquisitions,
    failedReacquisitions,
    averageCashbackPerTrial: totalCashback / EXPLOIT_TRIALS,
    averageReacquisitionCostPerDeparture:
      totalReacquisitionCost / Math.max(1, departures),
    averageProfitPerTrial: totalProfit / EXPLOIT_TRIALS,
    averageProfitPerDeparture: totalProfit / Math.max(1, departures),
    profitToMarketPrice: totalProfit / Math.max(1, departures) / target.marketPrice,
  };
}

function deriveFindings(
  policyAggregates: ReturnType<typeof aggregatePolicy>[],
  liquidation: ReturnType<typeof auditLiquidationCycle>,
) {
  const findings: Array<{
    severity: 'high' | 'medium' | 'low' | 'info';
    title: string;
    detail: string;
  }> = [];
  const anySoftlock = policyAggregates.filter((row) => row.softlockRate > 0);
  if (anySoftlock.length) {
    findings.push({
      severity: 'high',
      title: '序盤敗北後に仲介手数料も毎秒収益もなく進行不能になる経路がある',
      detail: anySoftlock
        .map((row) => `${row.policyLabel}: ${pct(row.softlockRate)}`)
        .join(' / '),
    });
  }

  const routeSpread =
    Math.max(...policyAggregates.map((row) => row.normalCompletionRate)) -
    Math.min(...policyAggregates.map((row) => row.normalCompletionRate));
  if (routeSpread > 0.3) {
    findings.push({
      severity: 'medium',
      title: '取得順と操作方針で通常編完走率が30ポイント以上変わる',
      detail: `方針間の通常編完走率差は${pct(routeSpread)}。無計画プレイへの救済、または推奨順の表示を検討できます。`,
    });
  }

  const excessiveWait = policyAggregates.filter(
    (row) => row.averageWaitingSeconds > 900,
  );
  if (excessiveWait.length) {
    findings.push({
      severity: 'medium',
      title: '平均15分を超える資金待ちが発生する方針がある',
      detail: excessiveWait
        .map(
          (row) =>
            `${row.policyLabel}: ${(row.averageWaitingSeconds / 60).toFixed(1)}分`,
        )
        .join(' / '),
    });
  }

  if (liquidation.averageProfitPerDeparture > 0) {
    findings.push({
      severity: 'high',
      title: '独立→全額清算→再買収の反復が期待値プラスになる',
      detail: `${liquidation.targetName}（価格${liquidation.marketPrice.toLocaleString('ja-JP')}）で、危険度100の独立率${pct(liquidation.departureRate)}、独立1回あたり平均利益${Math.round(liquidation.averageProfitPerDeparture).toLocaleString('ja-JP')}ギル（価格比${pct(liquidation.profitToMarketPrice)}）。市場価格100%の清算返金が、再買収の仲介手数料・精算損を上回ります。`,
    });
  }

  const strongPolicy = [...policyAggregates].sort(
    (left, right) => right.ultimateCompletionRate - left.ultimateCompletionRate,
  )[0];
  if (strongPolicy && strongPolicy.ultimateCompletionRate > 0.8) {
    findings.push({
      severity: 'medium',
      title: '最適方針では零式・絶まで高確率で連続完走できる',
      detail: `${strongPolicy.policyLabel}の絶までの完走率は${pct(strongPolicy.ultimateCompletionRate)}。高難度の資金消耗と再挑戦コストが十分か確認が必要です。`,
    });
  }

  if (!findings.length) {
    findings.push({
      severity: 'info',
      title: '設定した詰み・待ち時間・清算期待値の警戒閾値を超えなかった',
      detail: '取得順別の所要時間と高難度到達率を継続監視してください。',
    });
  }
  return findings;
}

async function main() {
  const campaigns: CampaignResult[] = [];
  for (let index = 0; index < TOTAL_CAMPAIGNS; index += 1) {
    campaigns.push(
      simulateCampaign(POLICIES[index % POLICIES.length], index + 1),
    );
  }
  const policyAggregates = POLICIES.map((policy) =>
    aggregatePolicy(
      policy,
      campaigns.filter((result) => result.policyId === policy.id),
    ),
  );
  const liquidation = auditLiquidationCycle();
  const findings = deriveFindings(policyAggregates, liquidation);
  const report = {
    generatedAt: new Date().toISOString(),
    totalCampaigns: TOTAL_CAMPAIGNS,
    liquidationTrials: EXPLOIT_TRIALS,
    policies: POLICIES.map((policy) => ({
      id: policy.id,
      label: policy.label,
      strategyId: policy.strategy.id,
      order: policy.order,
    })),
    policyAggregates,
    liquidation,
    findings,
    campaigns,
    modelNotes: [
      '通常編は都市ごとに未取得物件を方針別に選び、現金・毎秒収益・離反・再買収・永久的な都市解放を持ち越します。',
      '零式4層と絶も同じ資金・LB・通常物件を持ち越し、初回零式踏破の通常物件収益+10%を反映します。',
      '画面操作待ちと演出時間は除外し、戦闘ロジック上の秒数と仲介手数料不足を埋めるオンライン待機時間を集計します。',
    ],
  };

  const markdown = [
    '# タタルの大繁盛店 経済進行・詰み監査',
    '',
    `生成日時: ${report.generatedAt}`,
    '',
    `通しキャンペーン: **${TOTAL_CAMPAIGNS.toLocaleString('ja-JP')}回**`,
    `清算サイクル: **${EXPLOIT_TRIALS.toLocaleString('ja-JP')}回**`,
    '',
    '## 判定',
    '',
    ...findings.flatMap((finding) => [
      `### ${finding.severity.toUpperCase()}: ${finding.title}`,
      '',
      finding.detail,
      '',
    ]),
    '## 方針別の通し結果',
    '',
    '|方針|試行|通常編完走|零式4層完走|絶完走|ソフトロック|通常編平均|待機平均|戦闘平均|敗北平均|離反平均|再買収平均|',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...policyAggregates.map((row) =>
      `|${row.policyLabel}|${row.trials}|${pct(row.normalCompletionRate)}|${pct(row.savageCompletionRate)}|${pct(row.ultimateCompletionRate)}|${pct(row.softlockRate)}|${(row.averageNormalCompleteSeconds / 60).toFixed(1)}分|${(row.averageWaitingSeconds / 60).toFixed(1)}分|${(row.averageBattleSeconds / 60).toFixed(1)}分|${row.averageLosses.toFixed(2)}|${row.averageDepartures.toFixed(2)}|${row.averageReacquisitions.toFixed(2)}|`,
    ),
    '',
    '## 都市到達時刻',
    '',
    '|方針|都市|到達率|平均到達|P90到達|',
    '|---|---|---:|---:|---:|',
    ...policyAggregates.flatMap((row) =>
      row.cityStats.map((city) =>
        `|${row.policyLabel}|${city.community}|${pct(city.completionRate)}|${(city.averageCompletedAt / 60).toFixed(1)}分|${(city.p90CompletedAt / 60).toFixed(1)}分|`,
      ),
    ),
    '',
    '## 独立・清算サイクル',
    '',
    `対象: **${liquidation.targetName}**／市場価格 ${liquidation.marketPrice.toLocaleString('ja-JP')}ギル`,
    '',
    `- 危険度100からの独立: ${liquidation.departures}/${liquidation.trials}（${pct(liquidation.departureRate)}）`,
    `- 独立1回あたり平均清算返金: ${Math.round(liquidation.averageCashbackPerTrial / Math.max(liquidation.departureRate, 0.0001)).toLocaleString('ja-JP')}ギル`,
    `- 独立1回あたり平均再買収費用: ${Math.round(liquidation.averageReacquisitionCostPerDeparture).toLocaleString('ja-JP')}ギル`,
    `- 独立1回あたり平均差益: **${Math.round(liquidation.averageProfitPerDeparture).toLocaleString('ja-JP')}ギル**`,
    '',
    '## 解釈上の注意',
    '',
    ...report.modelNotes.map((note) => `- ${note}`),
    '',
  ].join('\n');

  const summaryCsvHeader = [
    'policy',
    'trials',
    'normal_complete_rate',
    'savage_complete_rate',
    'ultimate_complete_rate',
    'softlock_rate',
    'avg_normal_seconds',
    'avg_wait_seconds',
    'avg_battle_seconds',
    'avg_losses',
    'avg_departures',
    'avg_reacquisitions',
    'avg_final_funds',
    'avg_final_passive_revenue',
  ];
  const summaryCsvRows = policyAggregates.map((row) => [
    row.policyLabel,
    row.trials,
    row.normalCompletionRate,
    row.savageCompletionRate,
    row.ultimateCompletionRate,
    row.softlockRate,
    row.averageNormalCompleteSeconds,
    row.averageWaitingSeconds,
    row.averageBattleSeconds,
    row.averageLosses,
    row.averageDepartures,
    row.averageReacquisitions,
    row.averageFinalFunds,
    row.averageFinalPassiveRevenue,
  ]);
  const csv = [summaryCsvHeader, ...summaryCsvRows]
    .map((row) => row.join(','))
    .join('\n');

  await mkdir('artifacts/tataru-economy-progression', { recursive: true });
  await writeFile(
    'artifacts/tataru-economy-progression/report.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    'artifacts/tataru-economy-progression/report.md',
    markdown,
    'utf8',
  );
  await writeFile(
    'artifacts/tataru-economy-progression/summary.csv',
    `${csv}\n`,
    'utf8',
  );
  console.log(markdown);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

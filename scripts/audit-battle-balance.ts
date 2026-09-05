import { mkdir, writeFile } from 'node:fs/promises';
import {
  AUDIT_STRATEGIES,
  cloneAsOwned,
  normalCampaignProperties,
  simulateBattle,
  type AuditStrategy,
  type BattleAuditResult,
} from './tataru-simulation-core';
import { COMMUNITY_CAMPAIGN_ORDER } from '../src/data/worldData';
import {
  buildSavageProperties,
  buildUltimateProperty,
} from '../src/utils/savage';
import type { BattleMode, Property } from '../src/types';
import type { WindType } from '../src/components/WindIndicator';
import { INITIAL_PLAYER_FUNDS } from '../src/utils/gameBalance';

const SEEDS_PER_CELL = Math.max(
  50,
  Number(process.env.TATARU_BATTLE_AUDIT_SEEDS ?? 80),
);
const WIND_SEEDS = Math.max(
  100,
  Number(process.env.TATARU_BATTLE_WIND_SEEDS ?? 250),
);

interface Encounter {
  id: string;
  label: string;
  mode: BattleMode;
  target: Property;
  owned: Property[];
  conqueredCount: number;
  order: number;
}

interface Aggregate {
  trials: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  timeoutRate: number;
  averageDuration: number;
  p90Duration: number;
  averageFinalOwnership: number;
  averageCompanyInvestedRatio: number;
  averageDemandInvestedRatio: number;
  averageEnemyBudgetRatio: number;
  averageFundsDeltaRatio: number;
  averagePlayerActions: number;
  averageEnemyActions: number;
  averageSupportRequests: number;
  averageLimitBreakUses: number;
  averageBattleCashRecoveryRatio: number;
  averageEnemyCashRecoveryRatio: number;
  bossCoverTriggerRate: number;
  departureRate: number;
}

function mean(values: number[]) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
}

function percentile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(q * sorted.length) - 1),
  );
  return sorted[index];
}

function pct(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function aggregate(results: BattleAuditResult[]): Aggregate {
  const wins = results.filter((result) => result.winner === 'player').length;
  const losses = results.filter((result) => result.winner === 'opponent').length;
  const timeouts = results.filter((result) => result.winner === 'timeout').length;
  return {
    trials: results.length,
    wins,
    losses,
    timeouts,
    winRate: wins / Math.max(1, results.length),
    timeoutRate: timeouts / Math.max(1, results.length),
    averageDuration: mean(results.map((result) => result.durationSeconds)),
    p90Duration: percentile(results.map((result) => result.durationSeconds), 0.9),
    averageFinalOwnership: mean(results.map((result) => result.finalOwnership)),
    averageCompanyInvestedRatio: mean(
      results.map((result) => result.companyInvestedRatio),
    ),
    averageDemandInvestedRatio: mean(
      results.map((result) => result.demandInvestedRatio),
    ),
    averageEnemyBudgetRatio: mean(
      results.map((result) => result.enemyBudgetRatio),
    ),
    averageFundsDeltaRatio: mean(
      results.map((result) =>
        result.fundsDelta /
        Math.max(1, result.brokerageFee / 0.03),
      ),
    ),
    averagePlayerActions: mean(results.map((result) => result.playerActions)),
    averageEnemyActions: mean(results.map((result) => result.enemyActions)),
    averageSupportRequests: mean(
      results.map((result) => result.supportRequests),
    ),
    averageLimitBreakUses: mean(
      results.map((result) => result.limitBreakUses),
    ),
    averageBattleCashRecoveryRatio: mean(
      results.map((result) =>
        result.battleCashRecovered / Math.max(1, result.initialBattleCash),
      ),
    ),
    averageEnemyCashRecoveryRatio: mean(
      results.map((result) =>
        result.enemyCashRecovered / Math.max(1, result.enemyBudget),
      ),
    ),
    bossCoverTriggerRate:
      results.filter((result) => result.bossCoverTriggered).length /
      Math.max(1, results.length),
    departureRate:
      results.filter((result) => result.leavingProperties.length > 0).length /
      Math.max(1, results.length),
  };
}

function createEncounters(): Encounter[] {
  const normal = normalCampaignProperties();
  const normalEncounters = normal.map((target, index) => {
    const communityIndex = COMMUNITY_CAMPAIGN_ORDER.indexOf(target.community);
    return {
      id: `normal-${target.id}`,
      label: `${target.community} / ${target.name}`,
      mode: 'normal' as const,
      target,
      owned: cloneAsOwned(normal.slice(0, index)),
      conqueredCount: Math.max(0, communityIndex),
      order: index,
    };
  });
  const allOwned = cloneAsOwned(normal);
  const savage = buildSavageProperties(
    normal,
    new Set<string>(),
    '監査商会',
  ).map((target, index) => ({
    id: `savage-${target.id}`,
    label: target.name,
    mode: 'savage' as const,
    target,
    owned: allOwned.map((property) => ({ ...property })),
    conqueredCount: COMMUNITY_CAMPAIGN_ORDER.length,
    order: normal.length + index,
  }));
  const ultimateTarget = buildUltimateProperty(false, '監査商会');
  const ultimate: Encounter = {
    id: `ultimate-${ultimateTarget.id}`,
    label: ultimateTarget.name,
    mode: 'ultimate',
    target: ultimateTarget,
    owned: allOwned.map((property) => ({ ...property })),
    conqueredCount: COMMUNITY_CAMPAIGN_ORDER.length,
    order: normal.length + savage.length,
  };
  return [...normalEncounters, ...savage, ultimate];
}

function validateResult(result: BattleAuditResult) {
  const numbers = [
    result.durationSeconds,
    result.finalOwnership,
    result.gauge,
    result.enemyBudget,
    result.companyInvested,
    result.demandInvested,
    result.finalFunds,
    result.fundsDelta,
  ];
  return numbers.every(Number.isFinite) &&
    result.durationSeconds >= 0 &&
    result.finalOwnership >= 0 &&
    result.finalOwnership <= 100 &&
    result.enemyBudget >= 0 &&
    result.companyInvested >= 0 &&
    result.demandInvested >= 0 &&
    result.finalFunds >= 0;
}

function battleFunds(encounter: Encounter, strategy: AuditStrategy) {
  const price = encounter.target.marketPrice;
  const brokerage = Math.round(price * 0.03);
  return Math.max(
    INITIAL_PLAYER_FUNDS,
    brokerage + Math.round(price * strategy.task2CashRatio),
  );
}

function runMainMatrix(encounters: Encounter[]) {
  const rows: Array<{
    encounter: Encounter;
    strategy: AuditStrategy;
    aggregate: Aggregate;
  }> = [];
  const invalidResults: Array<Pick<BattleAuditResult, 'targetId' | 'strategyId' | 'seed'>> = [];
  let simulations = 0;

  for (const encounter of encounters) {
    for (const strategy of AUDIT_STRATEGIES) {
      const results: BattleAuditResult[] = [];
      for (let seedIndex = 1; seedIndex <= SEEDS_PER_CELL; seedIndex += 1) {
        const seed =
          seedIndex * 1_000_003 +
          encounter.order * 100_003 +
          AUDIT_STRATEGIES.indexOf(strategy) * 10_007;
        const result = simulateBattle({
          targetProperty: encounter.target,
          ownedProperties: encounter.owned.map((property) => ({ ...property })),
          totalFunds: battleFunds(encounter, strategy),
          conqueredCommunityCount: encounter.conqueredCount,
          mode: encounter.mode,
          strategy,
          seed,
          maxSeconds: encounter.mode === 'normal' ? 150 : 240,
        });
        simulations += 1;
        if (!validateResult(result)) {
          invalidResults.push({
            targetId: result.targetId,
            strategyId: result.strategyId,
            seed: result.seed,
          });
        }
        results.push(result);
      }
      rows.push({ encounter, strategy, aggregate: aggregate(results) });
    }
  }

  return { rows, invalidResults, simulations };
}

function runWindSensitivity(encounters: Encounter[]) {
  const lateBoss = [...encounters]
    .filter((encounter) => encounter.mode === 'normal')
    .reverse()
    .find((encounter) => encounter.target.community === 'トライヨラ') ??
    [...encounters].reverse().find((encounter) => encounter.mode === 'normal')!;
  const strategy = AUDIT_STRATEGIES.find((candidate) => candidate.id === 'steady')!;
  const winds: WindType[] = [
    'CALM',
    'TAILWIND_PLAYER',
    'HEADWIND_PLAYER',
    'TAILWIND_ENEMY',
    'CROSSWIND',
  ];
  return winds.map((wind) => {
    const results: BattleAuditResult[] = [];
    for (let seedIndex = 1; seedIndex <= WIND_SEEDS; seedIndex += 1) {
      results.push(
        simulateBattle({
          targetProperty: lateBoss.target,
          ownedProperties: lateBoss.owned.map((property) => ({ ...property })),
          totalFunds: battleFunds(lateBoss, strategy),
          conqueredCommunityCount: lateBoss.conqueredCount,
          mode: lateBoss.mode,
          strategy,
          seed: seedIndex * 65_537 + winds.indexOf(wind) * 4_099,
          windOverride: wind,
          maxSeconds: 180,
        }),
      );
    }
    return {
      targetId: lateBoss.target.id,
      targetName: lateBoss.target.name,
      wind,
      aggregate: aggregate(results),
    };
  });
}

function summarizeByCommunity(
  rows: ReturnType<typeof runMainMatrix>['rows'],
) {
  return COMMUNITY_CAMPAIGN_ORDER.flatMap((community) =>
    AUDIT_STRATEGIES.map((strategy) => {
      const matching = rows.filter(
        (row) =>
          row.encounter.mode === 'normal' &&
          row.encounter.target.community === community &&
          row.strategy.id === strategy.id,
      );
      const weightedTrials = matching.reduce(
        (total, row) => total + row.aggregate.trials,
        0,
      );
      const wins = matching.reduce((total, row) => total + row.aggregate.wins, 0);
      const timeouts = matching.reduce(
        (total, row) => total + row.aggregate.timeouts,
        0,
      );
      return {
        community,
        strategyId: strategy.id,
        strategyLabel: strategy.label,
        targets: matching.length,
        trials: weightedTrials,
        winRate: wins / Math.max(1, weightedTrials),
        timeoutRate: timeouts / Math.max(1, weightedTrials),
        averageDuration: mean(
          matching.map((row) => row.aggregate.averageDuration),
        ),
        averageFundsDeltaRatio: mean(
          matching.map((row) => row.aggregate.averageFundsDeltaRatio),
        ),
      };
    }),
  );
}

function deriveFindings(
  rows: ReturnType<typeof runMainMatrix>['rows'],
  windSensitivity: ReturnType<typeof runWindSensitivity>,
) {
  const findings: Array<{
    severity: 'high' | 'medium' | 'low' | 'info';
    title: string;
    detail: string;
  }> = [];
  const normalRows = rows.filter((row) => row.encounter.mode === 'normal');
  const steady = normalRows.filter((row) => row.strategy.id === 'steady');
  const novice = normalRows.filter((row) => row.strategy.id === 'novice_all_in');
  const prepared = rows.filter((row) => row.strategy.id === 'expert_prepared');
  const highEndPrepared = prepared.filter((row) => row.encounter.mode !== 'normal');

  const tooHard = steady.filter((row) => row.aggregate.winRate < 0.4);
  if (tooHard.length) {
    findings.push({
      severity: 'high',
      title: '標準操作で勝率40%未満の通常戦がある',
      detail: tooHard
        .map(
          (row) =>
            `${row.encounter.label}: ${pct(row.aggregate.winRate)}`,
        )
        .join(' / '),
    });
  }

  const tooEasy = steady.filter((row) => row.aggregate.winRate > 0.97);
  if (tooEasy.length >= Math.max(3, Math.floor(steady.length / 3))) {
    findings.push({
      severity: 'medium',
      title: '支援一巡だけで通常戦の多くがほぼ確勝になる',
      detail: `${tooEasy.length}/${steady.length}戦が標準代理で勝率97%超。支援資本の雪だるま化または敵予算曲線の不足を示します。`,
    });
  }

  const noviceAverage = mean(novice.map((row) => row.aggregate.winRate));
  const steadyAverage = mean(steady.map((row) => row.aggregate.winRate));
  if (steadyAverage - noviceAverage > 0.35) {
    findings.push({
      severity: 'info',
      title: '全力連打と支援運用の差が大きい',
      detail: `通常編平均は全力連打${pct(noviceAverage)}、支援一巡${pct(steadyAverage)}。大口出資へ敵AIが即応する設計が明確に機能しています。`,
    });
  }

  const highEndAverage = mean(
    highEndPrepared.map((row) => row.aggregate.winRate),
  );
  if (highEndPrepared.length && highEndAverage > 0.9) {
    findings.push({
      severity: 'high',
      title: '準備済みLB込みでは零式・絶が高勝率になりすぎる可能性',
      detail: `準備完了代理の高難度平均勝率は${pct(highEndAverage)}。持越しLB、全支援元、意気衝天の同時利用に対して敵予算・かばうが不足している可能性があります。`,
    });
  }

  const calm = windSensitivity.find((row) => row.wind === 'CALM')!;
  const playerTailwind = windSensitivity.find(
    (row) => row.wind === 'TAILWIND_PLAYER',
  )!;
  const enemyTailwind = windSensitivity.find(
    (row) => row.wind === 'TAILWIND_ENEMY',
  )!;
  if (
    playerTailwind.aggregate.winRate - enemyTailwind.aggregate.winRate >
    0.25
  ) {
    findings.push({
      severity: 'info',
      title: '風は勝率を明確に動かす',
      detail: `${calm.targetName}の標準代理で、静穏${pct(calm.aggregate.winRate)}、自社追い風${pct(playerTailwind.aggregate.winRate)}、競合追い風${pct(enemyTailwind.aggregate.winRate)}。待機判断が実力差になります。`,
    });
  }

  const timeoutRows = rows.filter((row) => row.aggregate.timeoutRate > 0.05);
  if (timeoutRows.length) {
    findings.push({
      severity: 'medium',
      title: '180～240秒で決着しない組合せがある',
      detail: timeoutRows
        .slice(0, 8)
        .map(
          (row) =>
            `${row.encounter.label}/${row.strategy.label}: ${pct(row.aggregate.timeoutRate)}`,
        )
        .join(' / '),
    });
  }

  if (!findings.length) {
    findings.push({
      severity: 'info',
      title: '設定した警戒閾値を超える断層は検出されなかった',
      detail: '都市別勝率、所要時間、風感度、高難度を継続監視してください。',
    });
  }
  return findings;
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function main() {
  const encounters = createEncounters();
  const matrix = runMainMatrix(encounters);
  const windSensitivity = runWindSensitivity(encounters);
  const communitySummary = summarizeByCommunity(matrix.rows);
  const findings = deriveFindings(matrix.rows, windSensitivity);
  const totalSimulations =
    matrix.simulations + windSensitivity.reduce((total, row) => total + row.aggregate.trials, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    seedsPerEncounterStrategy: SEEDS_PER_CELL,
    windSeedsPerCondition: WIND_SEEDS,
    totalSimulations,
    encounterCount: encounters.length,
    strategies: AUDIT_STRATEGIES,
    invalidResults: matrix.invalidResults,
    rows: matrix.rows.map((row) => ({
      encounter: {
        id: row.encounter.id,
        label: row.encounter.label,
        mode: row.encounter.mode,
        targetId: row.encounter.target.id,
        targetName: row.encounter.target.name,
        community: row.encounter.target.community,
        marketPrice: row.encounter.target.marketPrice,
        ownedCount: row.encounter.owned.length,
      },
      strategy: {
        id: row.strategy.id,
        label: row.strategy.label,
      },
      aggregate: row.aggregate,
    })),
    communitySummary,
    windSensitivity,
    findings,
    modelNotes: [
      'BattleModalの資金投入ショック、継続ゲージ、敵AI、資金回復、風、支援、SYNERGY、協力支援、LB緊急防衛、都市ボスかばう、精算を再現した決定論的代理です。',
      '画面演出時間、連環計・リビングデッド・時代の風など全アビリティの手動選択は含めません。絶対勝率より同条件の戦略差と章間差を重視します。',
    ],
  };

  const standardRows = report.rows.filter(
    (row) => row.strategy.id === 'steady',
  );
  const markdown = [
    '# タタルの大繁盛店 買収戦バランス監査',
    '',
    `生成日時: ${report.generatedAt}`,
    '',
    `総シミュレーション数: **${totalSimulations.toLocaleString('ja-JP')}戦**`,
    '',
    '## 判定',
    '',
    ...findings.flatMap((finding) => [
      `### ${finding.severity.toUpperCase()}: ${finding.title}`,
      '',
      finding.detail,
      '',
    ]),
    '## 標準代理・全戦闘',
    '',
    '|区分|都市／戦闘|価格|勝率|時間平均|P90|自社出資/価格|支援/価格|敵予算/価格|資金増減/価格|LB回数|離反戦率|',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...standardRows.map((row) =>
      `|${row.encounter.mode}|${row.encounter.label}|${row.encounter.marketPrice.toLocaleString('ja-JP')}|${pct(row.aggregate.winRate)}|${row.aggregate.averageDuration.toFixed(1)}秒|${row.aggregate.p90Duration.toFixed(1)}秒|${pct(row.aggregate.averageCompanyInvestedRatio)}|${pct(row.aggregate.averageDemandInvestedRatio)}|${row.aggregate.averageEnemyBudgetRatio.toFixed(2)}x|${pct(row.aggregate.averageFundsDeltaRatio)}|${row.aggregate.averageLimitBreakUses.toFixed(2)}|${pct(row.aggregate.departureRate)}|`,
    ),
    '',
    '## 都市別・戦略別',
    '',
    '|都市|戦略|勝率|タイムアウト|平均時間|資金増減/価格|',
    '|---|---|---:|---:|---:|---:|',
    ...communitySummary.map((row) =>
      `|${row.community}|${row.strategyLabel}|${pct(row.winRate)}|${pct(row.timeoutRate)}|${row.averageDuration.toFixed(1)}秒|${pct(row.averageFundsDeltaRatio)}|`,
    ),
    '',
    '## 風の固定感度',
    '',
    `対象: ${windSensitivity[0]?.targetName ?? ''}／標準・支援一巡`,
    '',
    '|風|勝率|平均時間|自社出資/価格|支援/価格|',
    '|---|---:|---:|---:|---:|',
    ...windSensitivity.map((row) =>
      `|${row.wind}|${pct(row.aggregate.winRate)}|${row.aggregate.averageDuration.toFixed(1)}秒|${pct(row.aggregate.averageCompanyInvestedRatio)}|${pct(row.aggregate.averageDemandInvestedRatio)}|`,
    ),
    '',
    '## 解釈上の注意',
    '',
    ...report.modelNotes.map((note) => `- ${note}`),
    '',
  ].join('\n');

  const csvHeader = [
    'mode',
    'community',
    'target',
    'strategy',
    'trials',
    'win_rate',
    'timeout_rate',
    'avg_duration_sec',
    'p90_duration_sec',
    'company_invested_ratio',
    'demand_invested_ratio',
    'enemy_budget_ratio',
    'funds_delta_ratio',
    'avg_lb_uses',
    'departure_rate',
  ];
  const csvRows = report.rows.map((row) => [
    row.encounter.mode,
    row.encounter.community,
    row.encounter.targetName,
    row.strategy.label,
    row.aggregate.trials,
    row.aggregate.winRate,
    row.aggregate.timeoutRate,
    row.aggregate.averageDuration,
    row.aggregate.p90Duration,
    row.aggregate.averageCompanyInvestedRatio,
    row.aggregate.averageDemandInvestedRatio,
    row.aggregate.averageEnemyBudgetRatio,
    row.aggregate.averageFundsDeltaRatio,
    row.aggregate.averageLimitBreakUses,
    row.aggregate.departureRate,
  ]);
  const csv = [csvHeader, ...csvRows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');

  await mkdir('artifacts/tataru-battle-balance', { recursive: true });
  await writeFile(
    'artifacts/tataru-battle-balance/report.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    'artifacts/tataru-battle-balance/report.md',
    markdown,
    'utf8',
  );
  await writeFile(
    'artifacts/tataru-battle-balance/results.csv',
    `${csv}\n`,
    'utf8',
  );
  console.log(markdown);
  if (matrix.invalidResults.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

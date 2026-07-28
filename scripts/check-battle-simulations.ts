import assert from 'node:assert/strict';
import { INITIAL_PROPERTIES } from '../src/data/initialData';
import { decideEnemyAction } from '../src/utils/enemyAi';
import {
  advanceBattleCashRecovery,
  applyTrainingGaugeSpeed,
  BATTLE_GAUGE_SPEED_FACTOR,
  BATTLE_SUPPORT_BALANCE,
  calculateDirectInvestmentGaugeImpact,
  calculateEnemyBudget,
  calculateSubsidiarySupportAmount,
  ENEMY_INITIAL_COMMITMENT_RATIO,
  getEnemyDifficultyLevel,
  getEnemyMinimumCommitment,
} from '../src/utils/gameBalance';
import {
  getBattleHitStopTiming,
  getCapitalCommitTiming,
} from '../src/utils/battlePresentation';
import { calculateGaugeVelocity } from '../src/utils/formatter';
import { buildTrainingDummyProperty } from '../src/utils/trainingDummy';
import type { PlayerBattleAction } from '../src/utils/enemyAi';
import type { Property } from '../src/types';

const NO_INFLUENCE = { enemyBudgetDiscount: 0 };
const STEP_SECONDS = 0.05;
const MAX_SECONDS = 240;
const INVESTMENT_LEVELS = [
  { level: 1, ratio: 0.02, action: 'SMALL' },
  { level: 2, ratio: 0.05, action: 'STEADY' },
  { level: 3, ratio: 0.1, action: 'BOLD' },
  { level: 4, ratio: 0.2, action: 'LARGE' },
  { level: 5, ratio: 0.35, action: 'ALL_IN' },
] as const satisfies readonly {
  level: number;
  ratio: number;
  action: PlayerBattleAction;
}[];

interface SimulationScenario {
  id: string;
  target: Property;
  isTutorial?: boolean;
  isTraining?: boolean;
  influenceBonus?: number;
  supportSources?: readonly Property[];
  supportAfterDirectActions?: (supportIndex: number, seed: number) => number;
}

interface SimulationResult {
  winner: 'player' | 'opponent' | 'timeout';
  wallSeconds: number;
  directActions: number;
  supportActions: number;
  finalOwnership: number;
}

const deterministicReactionDelay = (seed: number, actionCount: number) =>
  ((seed * 17 + actionCount * 11) % 8) * 0.05;

const getAffordableInvestment = (cash: number, marketPrice: number) =>
  INVESTMENT_LEVELS.find(
    ({ level, ratio }) =>
      level === 3 &&
      Math.max(10, Math.round(marketPrice * ratio)) <= cash
  ) ??
  [...INVESTMENT_LEVELS]
    .reverse()
    .find(
      ({ ratio }) =>
        Math.max(10, Math.round(marketPrice * ratio)) <= cash
    ) ??
  null;

const simulateBattle = (
  scenario: SimulationScenario,
  seed: number
): SimulationResult => {
  const marketPrice = scenario.target.marketPrice;
  const isTraining = scenario.isTraining ?? false;
  const isTutorial = scenario.isTutorial ?? false;
  const enemyDifficulty = getEnemyDifficultyLevel(
    scenario.target,
    isTutorial
  );
  const enemyBudget = isTraining
    ? marketPrice
    : calculateEnemyBudget({
        targetProperty: scenario.target,
        industryInfluence: NO_INFLUENCE,
        regionalInfluence: NO_INFLUENCE,
        isTutorial,
      });
  const initialEnemyCommitment = isTraining
    ? enemyBudget
    : Math.round(enemyBudget * ENEMY_INITIAL_COMMITMENT_RATIO);
  const playerBaselineCash = isTraining ? 20_000 : marketPrice;

  let gauge = 0;
  let playerInvested = 0;
  let enemyInvested = initialEnemyCommitment;
  let playerCash = playerBaselineCash;
  let enemyReserve = enemyBudget - initialEnemyCommitment;
  let playerRecovered = 0;
  let enemyRecovered = 0;
  let commandProgress = 100;
  let aiProgress = 0;
  let aiCycle = 0;
  let lastPlayerAction: PlayerBattleAction | null = null;
  let presentationLockSeconds = 0;
  let reactionDelaySeconds = deterministicReactionDelay(seed, 0);
  let directActions = 0;
  let supportActions = 0;
  let wallSeconds = 0;

  const finish = (): SimulationResult | null => {
    if (gauge <= -100) {
      return {
        winner: 'player',
        wallSeconds,
        directActions,
        supportActions,
        finalOwnership: (100 - gauge) / 2,
      };
    }
    if (!isTraining && gauge >= 100) {
      return {
        winner: 'opponent',
        wallSeconds,
        directActions,
        supportActions,
        finalOwnership: 0,
      };
    }
    if (isTraining) gauge = Math.min(gauge, 98);
    return null;
  };

  while (wallSeconds < MAX_SECONDS) {
    wallSeconds += STEP_SECONDS;

    if (presentationLockSeconds > 0) {
      presentationLockSeconds = Math.max(
        0,
        presentationLockSeconds - STEP_SECONDS
      );
      continue;
    }

    commandProgress = Math.min(
      100,
      commandProgress + 2.8
    );
    if (commandProgress >= 100) {
      reactionDelaySeconds = Math.max(
        0,
        reactionDelaySeconds - STEP_SECONDS
      );
    }

    const playerRecovery = advanceBattleCashRecovery({
      baselineFunds: playerBaselineCash,
      availableFunds: playerCash,
      cumulativeRecovered: playerRecovered,
      elapsedSeconds: STEP_SECONDS,
      timeScale: 1,
      windMultiplier: 1,
      terminal: false,
    });
    playerCash = playerRecovery.availableFunds;
    playerRecovered = playerRecovery.cumulativeRecovered;

    const enemyRecovery = advanceBattleCashRecovery({
      baselineFunds: enemyBudget,
      availableFunds: enemyReserve,
      cumulativeRecovered: enemyRecovered,
      elapsedSeconds: STEP_SECONDS,
      timeScale: 1,
      windMultiplier: 1,
      terminal: false,
    });
    enemyReserve = enemyRecovery.availableFunds;
    enemyRecovered = enemyRecovery.cumulativeRecovered;

    if (commandProgress >= 100 && reactionDelaySeconds <= 0) {
      const supportSource = scenario.supportSources?.[supportActions];
      const supportThreshold =
        scenario.supportAfterDirectActions?.(supportActions, seed) ??
        Number.POSITIVE_INFINITY;

      if (supportSource && directActions >= supportThreshold) {
        const amount = calculateSubsidiarySupportAmount(supportSource);
        const impact = Math.min(
          BATTLE_SUPPORT_BALANCE.subsidiaryImpactCap,
          BATTLE_SUPPORT_BALANCE.subsidiaryImpactBase +
            (amount / Math.max(1, marketPrice)) *
              BATTLE_SUPPORT_BALANCE.subsidiaryImpactPerMarketRatio
        );
        playerInvested += amount;
        gauge -= impact;
        supportActions += 1;
        commandProgress = 0;
        lastPlayerAction = 'FUNDS';
        presentationLockSeconds = 0.23;
      } else {
        const investment = getAffordableInvestment(
          playerCash,
          marketPrice
        );
        if (investment) {
          const amount = Math.max(
            10,
            Math.round(marketPrice * investment.ratio)
          );
          playerCash -= amount;
          playerInvested += amount;
          gauge -= calculateDirectInvestmentGaugeImpact({
            investmentAmount: amount,
            marketPrice,
            levelOneTraining:
              isTraining && scenario.target.id === 'training_dummy_level_1',
          });
          directActions += 1;
          commandProgress = 0;
          lastPlayerAction = investment.action;
          presentationLockSeconds =
            getCapitalCommitTiming(investment.level, true).totalMs / 1_000;
        }
      }

      reactionDelaySeconds = deterministicReactionDelay(
        seed,
        directActions + supportActions
      );
      const terminal = finish();
      if (terminal) return terminal;
      if (presentationLockSeconds > 0) continue;
    }

    if (
      !isTraining &&
      enemyReserve >= getEnemyMinimumCommitment(marketPrice)
    ) {
      const enemyOwnership = Math.round(((100 + gauge) / 2) / 5) * 5;
      const enemyReservePercent =
        enemyBudget > 0 ? (enemyReserve / enemyBudget) * 100 : 0;
      const enemyDecision = decideEnemyAction({
        enemyOwnership,
        enemyReservePercent,
        windType: 'CALM',
        windRemainingSeconds: 0,
        lastPlayerAction,
        effectiveCapitalGap: playerInvested - enemyInvested,
        marketPrice,
        isCartelHQ: !!scenario.target.isCartelHQ,
        isTutorial,
        slowed: false,
        cycle: aiCycle,
        difficultyLevel: enemyDifficulty,
      });
      aiProgress +=
        (100 / (enemyDecision.waitMs / 1_000)) * STEP_SECONDS;

      if (aiProgress >= 100) {
        if (enemyDecision.investmentRatio > 0) {
          const actual = Math.min(
            enemyReserve,
            Math.round(marketPrice * enemyDecision.investmentRatio)
          );
          enemyReserve -= actual;
          enemyInvested += actual;
          gauge += Math.min(
            10,
            1.5 + (actual / Math.max(1, marketPrice)) * 18
          );
          const impactTiming = getBattleHitStopTiming(
            actual / Math.max(1, marketPrice) >= 0.14,
            true
          );
          presentationLockSeconds =
            (impactTiming.hitStopMs + impactTiming.releaseMs) / 1_000;
        }
        aiCycle += 1;
        aiProgress = 0;
        lastPlayerAction = null;
        const terminal = finish();
        if (terminal) return terminal;
        if (presentationLockSeconds > 0) continue;
      }
    }

    const gapRatio =
      Math.abs(playerInvested - enemyInvested) /
      Math.max(1, marketPrice);
    const leverage = 1 + Math.min(2.4, gapRatio * 3.2);
    const deadZone = gapRatio < 0.025 ? 0.32 : 1;
    const velocity = applyTrainingGaugeSpeed(
      calculateGaugeVelocity(
        playerInvested,
        enemyInvested,
        marketPrice,
        1 + (scenario.influenceBonus ?? 0)
      ) *
        BATTLE_GAUGE_SPEED_FACTOR *
        leverage *
        deadZone,
      isTraining
    );
    gauge += velocity * STEP_SECONDS;

    const terminal = finish();
    if (terminal) return terminal;
  }

  return {
    winner: 'timeout',
    wallSeconds,
    directActions,
    supportActions,
    finalOwnership: (100 - gauge) / 2,
  };
};

const percentile = (
  values: readonly number[],
  ratio: number
) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(
      sorted.length - 1,
      Math.max(0, Math.floor((sorted.length - 1) * ratio))
    )
  ];
};

const summarize = (
  scenario: SimulationScenario,
  count: number,
  seedOffset: number
) => {
  const results = Array.from({ length: count }, (_, index) =>
    simulateBattle(scenario, seedOffset + index)
  );
  const playerWins = results.filter(
    (result) => result.winner === 'player'
  );
  return {
    id: scenario.id,
    battles: count,
    wins: playerWins.length,
    losses: results.filter((result) => result.winner === 'opponent').length,
    timeouts: results.filter((result) => result.winner === 'timeout').length,
    medianSeconds: percentile(
      results.map((result) => result.wallSeconds),
      0.5
    ),
    p90Seconds: percentile(
      results.map((result) => result.wallSeconds),
      0.9
    ),
    medianDirectActions: percentile(
      results.map((result) => result.directActions),
      0.5
    ),
    medianSupportActions: percentile(
      results.map((result) => result.supportActions),
      0.5
    ),
  };
};

const trainingLevelOne = buildTrainingDummyProperty({
  id: 'training_dummy_level_1',
  level: 1,
  name: '入門',
  marketPrice: 7_500,
  requiredConqueredCommunityCount: 0,
  description: 'simulation',
});
const starterFarm = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_starter_farm'
)!;
const starterBakery = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_starter_bakery'
)!;
const gridaniaBoss = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_timber_ake'
)!;

const reports = [
  summarize(
    {
      id: 'training_level_1',
      target: trainingLevelOne,
      isTraining: true,
    },
    200,
    0
  ),
  summarize(
    {
      id: 'gridania_first',
      target: starterFarm,
      isTutorial: true,
    },
    200,
    200
  ),
  summarize(
    {
      id: 'gridania_second_with_support',
      target: starterBakery,
      influenceBonus: 0.03,
      supportSources: [starterFarm],
      supportAfterDirectActions: (_supportIndex, seed) => 6 + (seed % 3),
    },
    200,
    400
  ),
  summarize(
    {
      id: 'gridania_second_without_support',
      target: starterBakery,
      influenceBonus: 0.03,
    },
    200,
    600
  ),
  summarize(
    {
      id: 'gridania_boss_unchanged',
      target: gridaniaBoss,
      influenceBonus: 0.03,
      supportSources: [starterFarm, starterBakery],
      supportAfterDirectActions: (supportIndex, seed) =>
        4 + supportIndex * 4 + (seed % 2),
    },
    200,
    800
  ),
] as const;

assert.equal(
  reports.reduce((total, report) => total + report.battles, 0),
  1_000,
  'the deterministic audit executes exactly one thousand battles'
);

const reportById = Object.fromEntries(
  reports.map((report) => [report.id, report])
);
console.log(JSON.stringify({
  totalBattles: 1_000,
  reports,
}, null, 2));

assert.equal(reportById.training_level_1.wins, 200);
assert.ok(
  reportById.training_level_1.medianDirectActions >= 3 &&
    reportById.training_level_1.medianDirectActions <= 5,
  'level-one training should take three to five default direct offers'
);
assert.ok(reportById.training_level_1.p90Seconds <= 25);
assert.equal(reportById.gridania_first.wins, 200);
assert.ok(
  reportById.gridania_first.medianDirectActions >= 10 &&
    reportById.gridania_first.medianDirectActions <= 12
);
assert.equal(reportById.gridania_second_with_support.wins, 200);
assert.equal(
  reportById.gridania_second_with_support.medianSupportActions,
  1
);
assert.ok(
  reportById.gridania_second_with_support.medianSeconds + 15 <
    reportById.gridania_second_without_support.medianSeconds,
  'the first acquired ally saves a clearly perceptible amount of time'
);
assert.ok(
  reportById.gridania_second_with_support.medianDirectActions <
    reportById.gridania_second_without_support.medianDirectActions,
  'the first acquired ally reduces the direct-investment grind'
);
assert.equal(reportById.gridania_boss_unchanged.wins, 200);

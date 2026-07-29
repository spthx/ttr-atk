import assert from 'node:assert/strict';
import { INITIAL_PROPERTIES } from '../src/data/initialData';
import { decideEnemyAction } from '../src/utils/enemyAi';
import {
  advanceBattleCashRecovery,
  applyTrainingGaugeSpeed,
  BATTLE_GAUGE_SPEED_FACTOR,
  BATTLE_SUPPORT_BALANCE,
  BATTLE_CASH_RECOVERY_TOTAL_CAP_RATIO,
  BOSS_COVER_BALANCE,
  calculateDirectInvestmentGaugeImpact,
  calculateEnemyBudget,
  calculateSubsidiarySupportAmount,
  ENEMY_INITIAL_COMMITMENT_RATIO,
  ENEMY_SUPPORT_SKILL_BALANCE,
  applyCoverToGaugeDelta,
  applyEnemyCureRecovery,
  canEnemyAffordDrill,
  getEnemyDivinationDurationMs,
  getEnemyDifficultyLevel,
  getEnemyDrillImpact,
  getEnemyMinimumCommitment,
  getEnemySupportSkillProfile,
  getBossAbilityTier,
  shouldEnemyUseCure,
  TACTICAL_SKILL_BALANCE,
} from '../src/utils/gameBalance';
import {
  getBattleHitStopTiming,
  getCapitalCommitTiming,
} from '../src/utils/battlePresentation';
import { calculateGaugeVelocity } from '../src/utils/formatter';
import {
  buildSavageProperties,
  buildUltimateProperty,
} from '../src/utils/savage';
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
  isCityBoss?: boolean;
  isSavage?: boolean;
  isUltimate?: boolean;
  disableEnemySupport?: boolean;
  maxSeconds?: number;
  influenceBonus?: number;
  supportSources?: readonly Property[];
  supportAfterDirectActions?: (supportIndex: number, seed: number) => number;
}

type EnemySupportActivationCounts = Record<
  'cure' | 'mug' | 'drill' | 'divination',
  number
>;

interface SimulationResult {
  winner: 'player' | 'opponent' | 'timeout';
  wallSeconds: number;
  directActions: number;
  supportActions: number;
  finalOwnership: number;
  enemySupportActivations: EnemySupportActivationCounts;
  maximumEnemyRecoveryRatio: number;
  minimumEnemyReserve: number;
  enemyBossDefenseTier: ReturnType<typeof getBossAbilityTier>;
  enemyBossDefenseActivations: number;
  enemyBossDefenseAbsorbedGauge: number;
}

const createEnemySupportActivationCounts =
  (): EnemySupportActivationCounts => ({
    cure: 0,
    mug: 0,
    drill: 0,
    divination: 0,
  });

const ENEMY_SUPPORT_PRESENTATION = {
  cure: {
    telegraphSeconds: 0.52,
    castSeconds: 1.2,
    impactSeconds: 0.36,
    afterglowSeconds: 0.72,
    leavingSeconds: 0.62,
  },
  mug: {
    telegraphSeconds: 0.48,
    castSeconds: 0.65,
    impactSeconds: 0.3,
    afterglowSeconds: 0.7,
    leavingSeconds: 0.62,
  },
  drill: {
    telegraphSeconds: 1.6,
    castSeconds: 1.1,
    impactSeconds: 0.42,
    afterglowSeconds: 0.78,
    leavingSeconds: 0.65,
  },
  divination: {
    telegraphSeconds: 0.7,
    castSeconds: 1.1,
    impactSeconds: 0.36,
    afterglowSeconds: 0.76,
    leavingSeconds: 0.65,
  },
} as const;

type EnemySupportSkillId = keyof typeof ENEMY_SUPPORT_PRESENTATION;

interface PendingEnemySupport {
  skill: EnemySupportSkillId;
  impactRemainingSeconds: number;
  completeRemainingSeconds: number;
  impacted: boolean;
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
  const isSavage = scenario.isSavage ?? false;
  const isUltimate = scenario.isUltimate ?? false;
  const enemySupportProfile = scenario.disableEnemySupport
    ? []
    : getEnemySupportSkillProfile({
        targetProperty: scenario.target,
        isCityBoss: scenario.isCityBoss ?? false,
        isSavage,
        isUltimate,
      });
  const enemyBossDefenseTier = getBossAbilityTier({
    targetProperty: scenario.target,
    isCityBoss: scenario.isCityBoss ?? false,
    isSavage,
    isUltimate,
  });
  const enemyBossDefenseBalance =
    enemyBossDefenseTier === 'invincible'
      ? BOSS_COVER_BALANCE.invincible
      : enemyBossDefenseTier === 'enhanced_cover'
        ? BOSS_COVER_BALANCE.enhancedCover
        : enemyBossDefenseTier === 'cover'
          ? BOSS_COVER_BALANCE.cover
          : null;
  const enemyDifficulty = getEnemyDifficultyLevel(
    scenario.target,
    isTutorial,
    isSavage,
    isUltimate
  );
  const enemyBudget = isTraining
    ? marketPrice
    : calculateEnemyBudget({
        targetProperty: scenario.target,
        industryInfluence: NO_INFLUENCE,
        regionalInfluence: NO_INFLUENCE,
        isTutorial,
        isSavage,
        isUltimate,
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
  let mugMarkActive = false;
  let divinationRemainingSeconds = 0;
  let maximumEnemyRecoveryRatio = 0;
  let minimumEnemyReserve = enemyReserve;
  let pendingEnemySupport: PendingEnemySupport | null = null;
  let enemyBossDefenseUsed = false;
  let enemyBossDefenseRemainingSeconds = 0;
  let enemyBossDefenseCapacity = 0;
  let enemyBossDefenseActivations = 0;
  let enemyBossDefenseAbsorbedGauge = 0;
  const usedEnemySupportSkills = new Set(
    [] as (typeof enemySupportProfile)[number][]
  );
  const enemySupportActivations =
    createEnemySupportActivationCounts();

  const applyPlayerGaugeCandidate = (nextGauge: number) => {
    if (nextGauge >= gauge) {
      gauge = nextGauge;
      return;
    }
    const predictedPlayerOwnership = (100 - nextGauge) / 2;
    if (
      enemyBossDefenseBalance &&
      !enemyBossDefenseUsed &&
      predictedPlayerOwnership >=
        BOSS_COVER_BALANCE.triggerPlayerOwnership
    ) {
      enemyBossDefenseUsed = true;
      enemyBossDefenseActivations += 1;
      enemyBossDefenseRemainingSeconds =
        enemyBossDefenseBalance.durationMs / 1_000;
      enemyBossDefenseCapacity =
        enemyBossDefenseBalance.gaugeCapacity;
    }
    if (enemyBossDefenseRemainingSeconds > 0) {
      const covered = applyCoverToGaugeDelta({
        currentGauge: gauge,
        nextGauge,
        protects: 'opponent',
        absorbRatio: enemyBossDefenseBalance!.absorbRatio,
        remainingGaugeCapacity: enemyBossDefenseCapacity,
      });
      nextGauge = covered.nextGauge;
      enemyBossDefenseCapacity = covered.remainingGaugeCapacity;
      enemyBossDefenseAbsorbedGauge += covered.absorbedGauge;
      if (enemyBossDefenseCapacity <= 0) {
        enemyBossDefenseRemainingSeconds = 0;
      }
    }
    gauge = nextGauge;
  };

  const finish = (): SimulationResult | null => {
    if (gauge <= -100) {
      return {
        winner: 'player',
        wallSeconds,
        directActions,
        supportActions,
        finalOwnership: (100 - gauge) / 2,
        enemySupportActivations,
        maximumEnemyRecoveryRatio,
        minimumEnemyReserve,
        enemyBossDefenseTier,
        enemyBossDefenseActivations,
        enemyBossDefenseAbsorbedGauge,
      };
    }
    if (!isTraining && gauge >= 100) {
      return {
        winner: 'opponent',
        wallSeconds,
        directActions,
        supportActions,
        finalOwnership: 0,
        enemySupportActivations,
        maximumEnemyRecoveryRatio,
        minimumEnemyReserve,
        enemyBossDefenseTier,
        enemyBossDefenseActivations,
        enemyBossDefenseAbsorbedGauge,
      };
    }
    if (isTraining) gauge = Math.min(gauge, 98);
    return null;
  };

  const resolveEnemySupportImpact = (
    skill: EnemySupportSkillId
  ) => {
    if (skill === 'cure') {
      const recovery = applyEnemyCureRecovery({
        baselineFunds: enemyBudget,
        availableFunds: enemyReserve,
        cumulativeRecovered: enemyRecovered,
        isSavage,
        isUltimate,
      });
      enemyReserve = recovery.availableFunds;
      enemyRecovered = recovery.cumulativeRecovered;
    } else if (skill === 'mug') {
      mugMarkActive = true;
    } else if (skill === 'drill') {
      const impact = getEnemyDrillImpact({
        enemyBudget,
        hasMugMark: mugMarkActive,
        isSavage,
        isUltimate,
      });
      if (enemyReserve >= impact.reserveCost) {
        enemyReserve -= impact.reserveCost;
        gauge += impact.gaugeDelta;
        if (impact.consumesMugMark) mugMarkActive = false;
      }
    } else {
      divinationRemainingSeconds =
        getEnemyDivinationDurationMs({
          isSavage,
          isUltimate,
        }) / 1_000;
    }

    minimumEnemyReserve = Math.min(
      minimumEnemyReserve,
      enemyReserve
    );
    maximumEnemyRecoveryRatio = Math.max(
      maximumEnemyRecoveryRatio,
      enemyBudget > 0 ? enemyRecovered / enemyBudget : 0
    );
  };

  while (wallSeconds < (scenario.maxSeconds ?? MAX_SECONDS)) {
    wallSeconds += STEP_SECONDS;

    if (pendingEnemySupport) {
      pendingEnemySupport.impactRemainingSeconds -= STEP_SECONDS;
      pendingEnemySupport.completeRemainingSeconds -= STEP_SECONDS;
      if (
        !pendingEnemySupport.impacted &&
        pendingEnemySupport.impactRemainingSeconds <= 0
      ) {
        pendingEnemySupport.impacted = true;
        resolveEnemySupportImpact(pendingEnemySupport.skill);
        const terminal = finish();
        if (terminal) return terminal;
      }
      if (pendingEnemySupport.completeRemainingSeconds <= 0) {
        pendingEnemySupport = null;
      }
      continue;
    }

    if (presentationLockSeconds > 0) {
      presentationLockSeconds = Math.max(
        0,
        presentationLockSeconds - STEP_SECONDS
      );
      continue;
    }

    enemyBossDefenseRemainingSeconds = Math.max(
      0,
      enemyBossDefenseRemainingSeconds - STEP_SECONDS
    );
    if (enemyBossDefenseRemainingSeconds <= 0) {
      enemyBossDefenseCapacity = 0;
    }

    if (divinationRemainingSeconds > 0) {
      divinationRemainingSeconds = Math.max(
        0,
        divinationRemainingSeconds - STEP_SECONDS
      );
    }

    const playerOwnership = (100 - gauge) / 2;
    const bossGuardNeedsPriority =
      !!enemyBossDefenseBalance &&
      !enemyBossDefenseUsed &&
      playerOwnership >=
        BOSS_COVER_BALANCE.triggerPlayerOwnership - 5;
    if (
      !bossGuardNeedsPriority &&
      enemyBossDefenseRemainingSeconds <= 0
    ) {
      const skill = enemySupportProfile.find((candidate) => {
        if (usedEnemySupportSkills.has(candidate)) return false;
        if (candidate === 'cure') {
          return shouldEnemyUseCure({
            baselineFunds: enemyBudget,
            availableFunds: enemyReserve,
            cumulativeRecovered: enemyRecovered,
            playerOwnership,
            terminal: false,
            isSavage,
            isUltimate,
          });
        }
        if (candidate === 'mug') {
          return aiCycle >= 1 || playerOwnership >= 52;
        }
        if (candidate === 'drill') {
          return (
            commandProgress >= 100 &&
            mugMarkActive &&
            canEnemyAffordDrill(enemyReserve, enemyBudget)
          );
        }
        return (
          (aiCycle >= 2 || playerOwnership >= 58) &&
          divinationRemainingSeconds <= 0
        );
      });
      if (skill) {
        const presentation = ENEMY_SUPPORT_PRESENTATION[skill];
        const impactRemainingSeconds =
          presentation.telegraphSeconds +
          presentation.castSeconds;
        pendingEnemySupport = {
          skill,
          impactRemainingSeconds,
          completeRemainingSeconds:
            impactRemainingSeconds +
            presentation.impactSeconds +
            presentation.afterglowSeconds +
            presentation.leavingSeconds,
          impacted: false,
        };
        usedEnemySupportSkills.add(skill);
        enemySupportActivations[skill] += 1;
        continue;
      }
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
    maximumEnemyRecoveryRatio = Math.max(
      maximumEnemyRecoveryRatio,
      enemyBudget > 0 ? enemyRecovered / enemyBudget : 0
    );

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
        applyPlayerGaugeCandidate(gauge - impact);
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
          applyPlayerGaugeCandidate(
            gauge -
              calculateDirectInvestmentGaugeImpact({
                investmentAmount: amount,
                marketPrice,
                levelOneTraining:
                  isTraining &&
                  scenario.target.id ===
                    'training_dummy_level_1',
              })
          );
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
      const enemyCapitalMultiplier =
        divinationRemainingSeconds > 0
          ? ENEMY_SUPPORT_SKILL_BALANCE.divination
              .enemyInvestmentMultiplier
          : 1;
      const effectiveEnemyInvested =
        enemyInvested * enemyCapitalMultiplier;
      const enemyDecision = decideEnemyAction({
        enemyOwnership,
        enemyReservePercent,
        windType: 'CALM',
        windRemainingSeconds: 0,
        lastPlayerAction,
        effectiveCapitalGap: playerInvested - effectiveEnemyInvested,
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
          const markMultiplier = mugMarkActive
            ? ENEMY_SUPPORT_SKILL_BALANCE.mug
                .nextGaugeImpactMultiplier
            : 1;
          const enemyGaugeShock = Math.min(
            10,
            (
              1.5 +
              (actual / Math.max(1, marketPrice)) * 18
            ) *
              enemyCapitalMultiplier *
              markMultiplier
          );
          if (mugMarkActive) {
            mugMarkActive = false;
          }
          gauge += enemyGaugeShock;
          minimumEnemyReserve = Math.min(
            minimumEnemyReserve,
            enemyReserve
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
      Math.abs(
        playerInvested -
          enemyInvested *
            (divinationRemainingSeconds > 0
              ? ENEMY_SUPPORT_SKILL_BALANCE.divination
                  .enemyInvestmentMultiplier
              : 1)
      ) /
      Math.max(1, marketPrice);
    const leverage = 1 + Math.min(2.4, gapRatio * 3.2);
    const deadZone = gapRatio < 0.025 ? 0.32 : 1;
    const velocity = applyTrainingGaugeSpeed(
      calculateGaugeVelocity(
        playerInvested,
        enemyInvested *
          (divinationRemainingSeconds > 0
            ? ENEMY_SUPPORT_SKILL_BALANCE.divination
                .enemyInvestmentMultiplier
            : 1),
        marketPrice,
        1 + (scenario.influenceBonus ?? 0)
      ) *
        BATTLE_GAUGE_SPEED_FACTOR *
        leverage *
        deadZone,
      isTraining
    );
    const nextGauge = gauge + velocity * STEP_SECONDS;
    if (velocity < 0) {
      applyPlayerGaugeCandidate(nextGauge);
    } else {
      gauge = nextGauge;
    }

    const terminal = finish();
    if (terminal) return terminal;
  }

  return {
    winner: 'timeout',
    wallSeconds,
    directActions,
    supportActions,
    finalOwnership: (100 - gauge) / 2,
    enemySupportActivations,
    maximumEnemyRecoveryRatio,
    minimumEnemyReserve,
    enemyBossDefenseTier,
    enemyBossDefenseActivations,
    enemyBossDefenseAbsorbedGauge,
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

const summarizeEnemySupport = (
  scenario: SimulationScenario,
  count: number,
  seedOffset: number
) => {
  const results = Array.from({ length: count }, (_, index) =>
    simulateBattle(scenario, seedOffset + index)
  );
  const activations = results.reduce(
    (totals, result) => {
      totals.cure += result.enemySupportActivations.cure;
      totals.mug += result.enemySupportActivations.mug;
      totals.drill += result.enemySupportActivations.drill;
      totals.divination +=
        result.enemySupportActivations.divination;
      return totals;
    },
    createEnemySupportActivationCounts()
  );
  const profile = scenario.disableEnemySupport
    ? []
    : getEnemySupportSkillProfile({
        targetProperty: scenario.target,
        isCityBoss: scenario.isCityBoss ?? false,
        isSavage: scenario.isSavage,
        isUltimate: scenario.isUltimate,
      });

  return {
    id: scenario.id,
    targetId: scenario.target.id,
    profile,
    battles: count,
    wins: results.filter((result) => result.winner === 'player')
      .length,
    losses: results.filter(
      (result) => result.winner === 'opponent'
    ).length,
    timeouts: results.filter(
      (result) => result.winner === 'timeout'
    ).length,
    medianSeconds: percentile(
      results.map((result) => result.wallSeconds),
      0.5
    ),
    p90Seconds: percentile(
      results.map((result) => result.wallSeconds),
      0.9
    ),
    activations,
    bossDefenseTier: results[0]?.enemyBossDefenseTier ?? 'none',
    bossDefenseActivations: results.reduce(
      (total, result) =>
        total + result.enemyBossDefenseActivations,
      0
    ),
    medianBossDefenseAbsorbedGauge: percentile(
      results.map(
        (result) => result.enemyBossDefenseAbsorbedGauge
      ),
      0.5
    ),
    maximumEnemyRecoveryRatio: Math.max(
      ...results.map(
        (result) => result.maximumEnemyRecoveryRatio
      )
    ),
    minimumEnemyReserve: Math.min(
      ...results.map((result) => result.minimumEnemyReserve)
    ),
    allWallTimesFinite: results.every(
      (result) =>
        Number.isFinite(result.wallSeconds) &&
        result.wallSeconds > 0
    ),
  };
};

const runDrillTelegraphCoverProbe = () => {
  const presentation = ENEMY_SUPPORT_PRESENTATION.drill;
  const coverActivatedAtSeconds =
    presentation.telegraphSeconds / 2;
  const impactAtSeconds =
    presentation.telegraphSeconds + presentation.castSeconds;
  const coverRemainingAtImpactMs = Math.max(
    0,
    TACTICAL_SKILL_BALANCE.cover.durationMs -
      (impactAtSeconds - coverActivatedAtSeconds) * 1_000
  );
  const currentGauge = -10;
  const drill = getEnemyDrillImpact({
    enemyBudget: 1_000_000,
    hasMugMark: true,
  });
  const covered = applyCoverToGaugeDelta({
    currentGauge,
    nextGauge: currentGauge + drill.gaugeDelta,
    protects: 'player',
    absorbRatio: TACTICAL_SKILL_BALANCE.cover.absorbRatio,
    remainingGaugeCapacity:
      TACTICAL_SKILL_BALANCE.cover.gaugeCapacity,
  });

  return {
    coverActivatedAtSeconds,
    telegraphEndsAtSeconds: presentation.telegraphSeconds,
    impactAtSeconds,
    coverRemainingAtImpactMs,
    rawGaugeDelta: drill.gaugeDelta,
    coveredGaugeDelta: Number(
      (covered.nextGauge - currentGauge).toFixed(4)
    ),
    absorbedGauge: Number(
      covered.absorbedGauge.toFixed(4)
    ),
    remainingGaugeCapacity: Number(
      covered.remainingGaugeCapacity.toFixed(4)
    ),
  };
};

const runDivinationEraWindCancelProbe = () => {
  const presentation = ENEMY_SUPPORT_PRESENTATION.divination;
  const eraWindActivatedAtSeconds =
    presentation.telegraphSeconds / 2;
  let stage: 'telegraph' | 'cancelled' = 'telegraph';
  let impactPending = true;
  let enemyMarketWindRemainingMs = 0;

  if (
    stage === 'telegraph' &&
    eraWindActivatedAtSeconds <
      presentation.telegraphSeconds
  ) {
    stage = 'cancelled';
    impactPending = false;
  }
  if (impactPending) {
    enemyMarketWindRemainingMs =
      getEnemyDivinationDurationMs({});
  }

  return {
    eraWindActivatedAtSeconds,
    telegraphEndsAtSeconds: presentation.telegraphSeconds,
    cancelled: stage === 'cancelled',
    impactApplied: impactPending,
    enemyMarketWindRemainingMs,
    enemyCapitalMultiplier:
      enemyMarketWindRemainingMs > 0
        ? ENEMY_SUPPORT_SKILL_BALANCE.divination
            .enemyInvestmentMultiplier
        : 1,
    eraWindActive: true,
  };
};

const runForcedInvincibleProbe = ({
  id,
  target,
  isCityBoss = false,
  isUltimate = false,
}: {
  id: string;
  target: Property;
  isCityBoss?: boolean;
  isUltimate?: boolean;
}) => {
  const tier = getBossAbilityTier({
    targetProperty: target,
    isCityBoss,
    isUltimate,
  });
  const balance = BOSS_COVER_BALANCE.invincible;
  let gauge = -18;
  let used = false;
  let activations = 0;
  let remainingMs = 0;
  let capacity = 0;
  let totalAbsorbedGauge = 0;

  const applyPlayerPush = (
    gaugeDelta: number,
    path: string
  ) => {
    const currentGauge = gauge;
    let nextGauge = gauge - gaugeDelta;
    const predictedOwnership = (100 - nextGauge) / 2;
    if (
      !used &&
      predictedOwnership >=
        BOSS_COVER_BALANCE.triggerPlayerOwnership
    ) {
      used = true;
      activations += 1;
      remainingMs = balance.durationMs;
      capacity = balance.gaugeCapacity;
    }
    let absorbedGauge = 0;
    if (remainingMs > 0) {
      const covered = applyCoverToGaugeDelta({
        currentGauge,
        nextGauge,
        protects: 'opponent',
        absorbRatio: balance.absorbRatio,
        remainingGaugeCapacity: capacity,
      });
      nextGauge = covered.nextGauge;
      capacity = covered.remainingGaugeCapacity;
      absorbedGauge = covered.absorbedGauge;
      totalAbsorbedGauge += absorbedGauge;
    }
    gauge = nextGauge;
    return {
      path,
      incomingGauge: gaugeDelta,
      appliedGauge: Number(
        (gauge - currentGauge).toFixed(4)
      ),
      absorbedGauge: Number(absorbedGauge.toFixed(4)),
    };
  };

  const trigger = applyPlayerPush(2, 'threshold_exact_60');
  const blockedPaths = [
    applyPlayerPush(8, 'direct_investment'),
    applyPlayerPush(12, 'subsidiary_support'),
    applyPlayerPush(20, 'limit_break'),
    applyPlayerPush(6, 'era_wind'),
    applyPlayerPush(4, 'continuous_pressure'),
  ];
  remainingMs = 1;
  const finalActiveMillisecond = applyPlayerPush(
    5,
    'duration_last_millisecond'
  );
  remainingMs = 0;
  const afterExpiry = applyPlayerPush(
    5,
    'after_duration_expiry'
  );

  return {
    id,
    tier,
    activations,
    configuredDurationMs: balance.durationMs,
    capacityIsInfinite:
      balance.gaugeCapacity === Number.POSITIVE_INFINITY &&
      capacity === Number.POSITIVE_INFINITY,
    trigger,
    blockedPaths,
    finalActiveMillisecond,
    afterExpiry,
    totalAbsorbedGauge: Number(
      totalAbsorbedGauge.toFixed(4)
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
const crystariumBoss = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_inn_town'
)!;
const oldSharlayanBoss = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_wheat_farm'
)!;
const radzAtHanBoss = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_security_firm'
)!;
const tuliyollalBoss = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_coffee_aurora'
)!;
const solutionNineBoss = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_abyss_mine'
)!;
const kuganeTradeBroker = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_info_broker'
)!;
const ishgardWeaponDealer = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_weapon_dealer'
)!;
const solutionNineIndustry = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_abyss_heavy'
)!;
const easternAldenardHeadquarters = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_dofor_hq'
)!;
const knowledgeAllianceHeadquarters = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_abyss_hq'
)!;
const savageProperties = buildSavageProperties(
  INITIAL_PROPERTIES,
  new Set(),
  '決定論監査商会'
);
const savageLayerSanityTargets = savageProperties.slice(0, 4);
const ultimateSanityTarget = buildUltimateProperty(
  false,
  '決定論監査商会'
);
const useProgressionSupport = (supportIndex: number, seed: number) =>
  3 + supportIndex * 3 + (seed % 2);

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

const cityAuditScenarios = [
  {
    id: 'city_6_crystarium_cure',
    target: crystariumBoss,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [kuganeTradeBroker, ishgardWeaponDealer],
    supportAfterDirectActions: useProgressionSupport,
  },
  {
    id: 'city_7_old_sharlayan_mug',
    target: oldSharlayanBoss,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [crystariumBoss, kuganeTradeBroker],
    supportAfterDirectActions: useProgressionSupport,
  },
  {
    id: 'city_8_radz_at_han_mug_drill',
    target: radzAtHanBoss,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [oldSharlayanBoss, crystariumBoss],
    supportAfterDirectActions: useProgressionSupport,
  },
  {
    id: 'city_9_tuliyollal_divination',
    target: tuliyollalBoss,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [radzAtHanBoss, oldSharlayanBoss],
    supportAfterDirectActions: useProgressionSupport,
  },
  {
    id: 'city_10_solution_nine_cure_divination',
    target: solutionNineBoss,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [
      solutionNineIndustry,
      tuliyollalBoss,
      radzAtHanBoss,
    ],
    supportAfterDirectActions: useProgressionSupport,
  },
] as const satisfies readonly SimulationScenario[];

const enemySupportReports = cityAuditScenarios.map(
  (scenario, index) =>
    summarizeEnemySupport(
      scenario,
      200,
      10_000 + index * 200
    )
);

const enemySupportBaselineReports = cityAuditScenarios.map(
  (scenario, index) =>
    summarizeEnemySupport(
      {
        ...scenario,
        id: `${scenario.id}_support_disabled`,
        disableEnemySupport: true,
      },
      100,
      10_000 + index * 200
    )
);

const enemySupportWinRateComparison = enemySupportReports.map(
  (enabled, index) => {
    const baseline = enemySupportBaselineReports[index];
    const enabledWinRate = enabled.wins / enabled.battles;
    const baselineWinRate = baseline.wins / baseline.battles;
    return {
      id: cityAuditScenarios[index].id,
      enabledWinRate,
      baselineWinRate,
      percentagePointDelta: Number(
        ((enabledWinRate - baselineWinRate) * 100).toFixed(1)
      ),
    };
  }
);

const highDifficultySupportSources = [
  knowledgeAllianceHeadquarters,
  easternAldenardHeadquarters,
  solutionNineIndustry,
  solutionNineBoss,
  tuliyollalBoss,
] as const;
const highDifficultyScenarios: SimulationScenario[] = [
  ...savageLayerSanityTargets.map((target, index) => ({
    id: `savage_layer_${index + 1}_support_sanity`,
    target,
    isSavage: true,
    maxSeconds: 900,
    supportSources: highDifficultySupportSources,
    supportAfterDirectActions: useProgressionSupport,
  })),
  {
    id: 'ultimate_support_sanity',
    target: ultimateSanityTarget,
    isUltimate: true,
    maxSeconds: 1_200,
  },
];
const highDifficultySupportReports =
  highDifficultyScenarios.map((scenario, index) =>
    summarizeEnemySupport(
      scenario,
      100,
      20_000 + index * 100
    )
  );
const runtimeAlignmentProbes = {
  drillTelegraphPlayerCover:
    runDrillTelegraphCoverProbe(),
  divinationTelegraphEraWindCancel:
    runDivinationEraWindCancelProbe(),
  forcedInvincible: [
    runForcedInvincibleProbe({
      id: 'city_10_invincible_forced',
      target: solutionNineBoss,
      isCityBoss: true,
    }),
    runForcedInvincibleProbe({
      id: 'ultimate_invincible_forced',
      target: ultimateSanityTarget,
      isUltimate: true,
    }),
  ],
};

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
  enemySupportAudit: {
    totalBattles: enemySupportReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
    reports: enemySupportReports,
  },
  enemySupportDisabledBaselineAudit: {
    totalBattles: enemySupportBaselineReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
    reports: enemySupportBaselineReports,
    winRateComparison: enemySupportWinRateComparison,
  },
  highDifficultySupportSanityAudit: {
    totalBattles: highDifficultySupportReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
    reports: highDifficultySupportReports,
  },
  runtimeAlignmentProbes,
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

assert.equal(
  enemySupportReports.reduce(
    (total, report) => total + report.battles,
    0
  ),
  1_000,
  'the enemy-support audit executes exactly one thousand additional battles'
);
for (const report of enemySupportReports) {
  assert.equal(
    report.timeouts,
    0,
    `${report.id} should always reach a finite battle result`
  );
  assert.equal(
    report.allWallTimesFinite,
    true,
    `${report.id} should only report finite positive wall times`
  );
  assert.ok(
    report.minimumEnemyReserve >= 0,
    `${report.id} must never overspend the enemy reserve`
  );
  assert.ok(
    report.maximumEnemyRecoveryRatio <=
      BATTLE_CASH_RECOVERY_TOTAL_CAP_RATIO + Number.EPSILON,
    `${report.id} must share the cumulative 20% recovery cap`
  );
  for (const skill of [
    'cure',
    'mug',
    'drill',
    'divination',
  ] as const) {
    if (report.profile.includes(skill)) {
      assert.ok(
        report.activations[skill] > 0 &&
          report.activations[skill] <= report.battles,
        `${report.id} should exercise configured ${skill} without double activation`
      );
    } else {
      assert.equal(report.activations[skill], 0);
    }
  }
}

for (const expected of [
  {
    id: 'city_8_radz_at_han_mug_drill',
    tier: 'enhanced_cover',
  },
  {
    id: 'city_9_tuliyollal_divination',
    tier: 'enhanced_cover',
  },
  {
    id: 'city_10_solution_nine_cure_divination',
    tier: 'invincible',
  },
] as const) {
  const report = enemySupportReports.find(
    (candidate) => candidate.id === expected.id
  )!;
  assert.equal(report.bossDefenseTier, expected.tier);
  assert.ok(report.bossDefenseActivations <= report.battles);
  if (expected.tier === 'enhanced_cover') {
    assert.ok(
      report.bossDefenseActivations > 0,
      `${expected.id} should reach and exercise enhanced Cover`
    );
    assert.ok(report.medianBossDefenseAbsorbedGauge > 0);
  }
}

assert.equal(
  enemySupportBaselineReports.reduce(
    (total, report) => total + report.battles,
    0
  ),
  500,
  'the support-disabled baseline compares five cities at one hundred battles each'
);
for (const report of enemySupportBaselineReports) {
  assert.equal(report.timeouts, 0);
  assert.equal(report.allWallTimesFinite, true);
  assert.ok(report.minimumEnemyReserve >= 0);
  assert.ok(
    report.maximumEnemyRecoveryRatio <=
      BATTLE_CASH_RECOVERY_TOTAL_CAP_RATIO + Number.EPSILON
  );
  assert.deepEqual(report.profile, []);
  assert.deepEqual(
    report.activations,
    createEnemySupportActivationCounts()
  );
}

assert.equal(savageLayerSanityTargets.length, 4);
assert.equal(
  highDifficultySupportReports.reduce(
    (total, report) => total + report.battles,
    0
  ),
  500,
  'Savage layers one through four and Ultimate each execute one hundred sanity battles'
);
for (const report of highDifficultySupportReports) {
  assert.equal(
    report.timeouts,
    0,
    `${report.id} should reach a finite high-difficulty result`
  );
  assert.equal(report.allWallTimesFinite, true);
  assert.ok(report.minimumEnemyReserve >= 0);
  assert.ok(
    report.maximumEnemyRecoveryRatio <=
      BATTLE_CASH_RECOVERY_TOTAL_CAP_RATIO + Number.EPSILON
  );
  assert.ok(report.bossDefenseActivations <= report.battles);
  if (!report.id.startsWith('ultimate_')) {
    assert.ok(
      report.bossDefenseActivations > 0,
      `${report.id} should exercise its authored boss defense`
    );
    assert.ok(report.medianBossDefenseAbsorbedGauge > 0);
  }
  const totalSupportActivations = Object.values(
    report.activations
  ).reduce((total, count) => total + count, 0);
  assert.ok(
    totalSupportActivations > 0,
    `${report.id} should exercise at least one enemy support skill`
  );
  for (const count of Object.values(report.activations)) {
    assert.ok(count <= report.battles);
  }
}

const drillCoverProbe =
  runtimeAlignmentProbes.drillTelegraphPlayerCover;
assert.ok(
  drillCoverProbe.coverActivatedAtSeconds <
    drillCoverProbe.telegraphEndsAtSeconds,
  'player Cover can be activated during the Drill telegraph'
);
assert.ok(
  drillCoverProbe.impactAtSeconds >
    drillCoverProbe.telegraphEndsAtSeconds
);
assert.ok(drillCoverProbe.coverRemainingAtImpactMs > 0);
assert.ok(
  drillCoverProbe.coveredGaugeDelta > 0 &&
    drillCoverProbe.coveredGaugeDelta <
      drillCoverProbe.rawGaugeDelta,
  'Cover reduces the Drill impact without reversing it'
);
assert.ok(drillCoverProbe.absorbedGauge > 0);
assert.ok(drillCoverProbe.remainingGaugeCapacity > 0);

const divinationCancelProbe =
  runtimeAlignmentProbes.divinationTelegraphEraWindCancel;
assert.ok(
  divinationCancelProbe.eraWindActivatedAtSeconds <
    divinationCancelProbe.telegraphEndsAtSeconds
);
assert.equal(divinationCancelProbe.cancelled, true);
assert.equal(divinationCancelProbe.impactApplied, false);
assert.equal(
  divinationCancelProbe.enemyMarketWindRemainingMs,
  0
);
assert.equal(
  divinationCancelProbe.enemyCapitalMultiplier,
  1
);
assert.equal(divinationCancelProbe.eraWindActive, true);

assert.equal(
  runtimeAlignmentProbes.forcedInvincible.length,
  2
);
for (const probe of runtimeAlignmentProbes.forcedInvincible) {
  assert.equal(probe.tier, 'invincible');
  assert.equal(probe.activations, 1);
  assert.equal(
    probe.configuredDurationMs,
    BOSS_COVER_BALANCE.invincible.durationMs
  );
  assert.equal(probe.capacityIsInfinite, true);
  assert.equal(probe.trigger.appliedGauge, 0);
  assert.equal(
    probe.trigger.absorbedGauge,
    probe.trigger.incomingGauge
  );
  for (const path of probe.blockedPaths) {
    assert.equal(
      path.appliedGauge,
      0,
      `${probe.id} should block ${path.path}`
    );
    assert.equal(path.absorbedGauge, path.incomingGauge);
  }
  assert.equal(
    probe.finalActiveMillisecond.appliedGauge,
    0,
    `${probe.id} remains invincible through the final active millisecond`
  );
  assert.equal(
    probe.afterExpiry.appliedGauge,
    -probe.afterExpiry.incomingGauge,
    `${probe.id} allows player pressure after eight seconds expire`
  );
  assert.ok(probe.totalAbsorbedGauge > 0);
}

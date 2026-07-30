import assert from 'node:assert/strict';
import { INITIAL_PROPERTIES } from '../src/data/initialData';
import { COMMUNITY_CAMPAIGN_ORDER } from '../src/data/worldData';
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
  getOpeningBossAbilityTier,
  getEnemySupportAutoProfile,
  getEnemySupportSkillProfile,
  getBossAbilityTier,
  getCampaignProperties,
  LIMIT_BREAK_OWNERSHIP_CAPS,
  shouldEnemyUseCure,
  TACTICAL_SKILL_BALANCE,
  HIGH_DIFFICULTY_SUPPORT_MULTIPLIER,
  ULTIMATE_ENEMY_AUTO_PATTERNS,
  type EnemySupportSkillId,
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
import {
  buildTrainingDummyProperty,
  TRAINING_DUMMY_DEFINITIONS,
} from '../src/utils/trainingDummy';
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
  ultimateAutoPatternIndex?: number;
  disableEnemySupport?: boolean;
  maxSeconds?: number;
  playerBaselineCash?: number;
  openingCapitalBoostRatio?: number;
  influenceBonus?: number;
  supportSources?: readonly Property[];
  supportAfterDirectActions?: (supportIndex: number, seed: number) => number;
  timedCapitalBuff?: {
    triggerAfterDirectActions: number;
    triggerAfterSupportActions?: number;
    durationSeconds: number;
    multiplier: number;
    ownershipPush: number;
  };
}

type EnemySupportActivationCounts = Record<EnemySupportSkillId, number>;

interface SimulationResult {
  winner: 'player' | 'opponent' | 'timeout';
  wallSeconds: number;
  directActions: number;
  supportActions: number;
  finalOwnership: number;
  enemySupportActivations: EnemySupportActivationCounts;
  maximumPlayerRecoveryRatio: number;
  maximumEnemyRecoveryRatio: number;
  minimumEnemyReserve: number;
  enemyBossDefenseTier: ReturnType<typeof getBossAbilityTier>;
  enemyBossDefenseActivations: number;
  enemyBossDefenseAbsorbedGauge: number;
  timedCapitalBuffActivations: number;
}

const createEnemySupportActivationCounts =
  (): EnemySupportActivationCounts => ({
    cure: 0,
    mug: 0,
    drill: 0,
    divination: 0,
    rapid_assault: 0,
    limit_break_3: 0,
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
  rapid_assault: {
    telegraphSeconds: 0.62,
    castSeconds: 0.9,
    impactSeconds: 0.34,
    afterglowSeconds: 0.72,
    leavingSeconds: 0.62,
  },
  limit_break_3: {
    telegraphSeconds: 1.8,
    castSeconds: 1.4,
    impactSeconds: 0.52,
    afterglowSeconds: 0.9,
    leavingSeconds: 0.72,
  },
} as const;

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
  const enemySupportAutoProfile = scenario.disableEnemySupport
    ? { opening: null, critical: null }
    : getEnemySupportAutoProfile({
        targetProperty: scenario.target,
        isCityBoss: scenario.isCityBoss ?? false,
        isSavage,
        isUltimate,
        ultimatePatternIndex: scenario.ultimateAutoPatternIndex,
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
  const openingBossAbilityTier = getOpeningBossAbilityTier({
    targetProperty: scenario.target,
    isSavage,
  });
  const openingBossDefenseBalance =
    openingBossAbilityTier === 'cover'
      ? BOSS_COVER_BALANCE.cover
      : null;
  const enemyDifficulty = getEnemyDifficultyLevel(
    scenario.target,
    isTutorial,
    isSavage,
    isUltimate,
    scenario.isCityBoss ?? false
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
        isCityBoss: scenario.isCityBoss ?? false,
      });
  const initialEnemyCommitment = isTraining
    ? enemyBudget
    : Math.round(enemyBudget * ENEMY_INITIAL_COMMITMENT_RATIO);
  const playerBaselineCash =
    scenario.playerBaselineCash ??
    (isTraining ? 20_000 : marketPrice);

  let gauge = 0;
  let playerInvested =
    marketPrice * (scenario.openingCapitalBoostRatio ?? 0);
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
  let rapidAssaultRemainingSeconds = 0;
  let maximumPlayerRecoveryRatio = 0;
  let maximumEnemyRecoveryRatio = 0;
  let minimumEnemyReserve = enemyReserve;
  let pendingEnemySupport: PendingEnemySupport | null = null;
  let enemyBossDefenseUsed = false;
  let enemyActiveBossDefenseBalance:
    | (typeof BOSS_COVER_BALANCE)[
        | 'cover'
        | 'enhancedCover'
        | 'invincible']
    | null = openingBossDefenseBalance;
  let enemyBossDefenseRemainingSeconds = openingBossDefenseBalance
    ? openingBossDefenseBalance.durationMs / 1_000
    : 0;
  let enemyBossDefenseCapacity =
    openingBossDefenseBalance?.gaugeCapacity ?? 0;
  let enemyBossDefenseActivations =
    openingBossDefenseBalance ? 1 : 0;
  let enemyBossDefenseAbsorbedGauge = 0;
  let timedCapitalBuffUsed = false;
  let timedCapitalBuffRemainingSeconds = 0;
  let timedCapitalBuffActivations = 0;
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
      enemyBossDefenseRemainingSeconds <= 0 &&
      predictedPlayerOwnership >=
        BOSS_COVER_BALANCE.triggerPlayerOwnership
    ) {
      enemyBossDefenseUsed = true;
      enemyBossDefenseActivations += 1;
      enemyBossDefenseRemainingSeconds =
        enemyBossDefenseBalance.durationMs / 1_000;
      enemyBossDefenseCapacity =
        enemyBossDefenseBalance.gaugeCapacity;
      enemyActiveBossDefenseBalance = enemyBossDefenseBalance;
    }
    if (
      enemyBossDefenseRemainingSeconds > 0 &&
      enemyActiveBossDefenseBalance
    ) {
      const covered = applyCoverToGaugeDelta({
        currentGauge: gauge,
        nextGauge,
        protects: 'opponent',
        absorbRatio: enemyActiveBossDefenseBalance.absorbRatio,
        remainingGaugeCapacity: enemyBossDefenseCapacity,
      });
      nextGauge = covered.nextGauge;
      enemyBossDefenseCapacity = covered.remainingGaugeCapacity;
      enemyBossDefenseAbsorbedGauge += covered.absorbedGauge;
      if (enemyBossDefenseCapacity <= 0) {
        enemyBossDefenseRemainingSeconds = 0;
        enemyActiveBossDefenseBalance = null;
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
        maximumPlayerRecoveryRatio,
        maximumEnemyRecoveryRatio,
        minimumEnemyReserve,
        enemyBossDefenseTier,
        enemyBossDefenseActivations,
        enemyBossDefenseAbsorbedGauge,
        timedCapitalBuffActivations,
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
        maximumPlayerRecoveryRatio,
        maximumEnemyRecoveryRatio,
        minimumEnemyReserve,
        enemyBossDefenseTier,
        enemyBossDefenseActivations,
        enemyBossDefenseAbsorbedGauge,
        timedCapitalBuffActivations,
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
    } else if (skill === 'divination') {
      divinationRemainingSeconds =
        getEnemyDivinationDurationMs({
          isSavage,
          isUltimate,
        }) / 1_000;
    } else if (skill === 'rapid_assault') {
      rapidAssaultRemainingSeconds =
        ENEMY_SUPPORT_SKILL_BALANCE.rapidAssault.durationMs / 1_000;
    } else {
      gauge += ENEMY_SUPPORT_SKILL_BALANCE.limitBreak3.gaugeDelta;
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
      enemyActiveBossDefenseBalance = null;
    }

    if (divinationRemainingSeconds > 0) {
      divinationRemainingSeconds = Math.max(
        0,
        divinationRemainingSeconds - STEP_SECONDS
      );
    }
    if (rapidAssaultRemainingSeconds > 0) {
      rapidAssaultRemainingSeconds = Math.max(
        0,
        rapidAssaultRemainingSeconds - STEP_SECONDS
      );
    }
    if (timedCapitalBuffRemainingSeconds > 0) {
      timedCapitalBuffRemainingSeconds = Math.max(
        0,
        timedCapitalBuffRemainingSeconds - STEP_SECONDS
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
      const openingAutoSkill =
        enemySupportAutoProfile.opening &&
        aiCycle === 0 &&
        !usedEnemySupportSkills.has(enemySupportAutoProfile.opening)
          ? enemySupportAutoProfile.opening
          : null;
      const criticalAutoSkill =
        enemySupportAutoProfile.critical &&
        playerOwnership >= 70 &&
        !usedEnemySupportSkills.has(enemySupportAutoProfile.critical) &&
        (
          enemySupportAutoProfile.critical !== 'drill' ||
          canEnemyAffordDrill(enemyReserve, enemyBudget)
        )
          ? enemySupportAutoProfile.critical
          : null;
      const skill =
        openingAutoSkill ??
        criticalAutoSkill ??
        enemySupportProfile.find((candidate) => {
        if (usedEnemySupportSkills.has(candidate)) return false;
        if (
          candidate === enemySupportAutoProfile.critical &&
          playerOwnership < 70
        ) {
          return false;
        }
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
    maximumPlayerRecoveryRatio = Math.max(
      maximumPlayerRecoveryRatio,
      playerBaselineCash > 0
        ? playerRecovered / playerBaselineCash
        : 0
    );

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
      const timedCapitalBuff = scenario.timedCapitalBuff;
      if (
        timedCapitalBuff &&
        !timedCapitalBuffUsed &&
        directActions >= timedCapitalBuff.triggerAfterDirectActions &&
        supportActions >=
          (timedCapitalBuff.triggerAfterSupportActions ?? 0)
      ) {
        timedCapitalBuffUsed = true;
        timedCapitalBuffActivations += 1;
        timedCapitalBuffRemainingSeconds =
          timedCapitalBuff.durationSeconds;
        applyPlayerGaugeCandidate(
          gauge - timedCapitalBuff.ownershipPush * 2
        );
        // Progression SYNERGY consumes the ready command, then its rally
        // effect explicitly prepares the next action when the cinematic lands.
        commandProgress = 100;
        presentationLockSeconds = 1.8;
        lastPlayerAction = 'SYNERGY';
        continue;
      }
      const playerCapitalMultiplier =
        timedCapitalBuffRemainingSeconds > 0
          ? scenario.timedCapitalBuff?.multiplier ?? 1
          : 1;
      const supportSource = scenario.supportSources?.[supportActions];
      const supportThreshold =
        scenario.supportAfterDirectActions?.(supportActions, seed) ??
        Number.POSITIVE_INFINITY;

      if (supportSource && directActions >= supportThreshold) {
        const amount = Math.round(
          calculateSubsidiarySupportAmount(supportSource) *
            (isSavage || isUltimate
              ? HIGH_DIFFICULTY_SUPPORT_MULTIPLIER
              : 1)
        );
        const impact = Math.min(
          BATTLE_SUPPORT_BALANCE.subsidiaryImpactCap,
          (
            BATTLE_SUPPORT_BALANCE.subsidiaryImpactBase +
              (amount / Math.max(1, marketPrice)) *
                BATTLE_SUPPORT_BALANCE.subsidiaryImpactPerMarketRatio
          ) * playerCapitalMultiplier
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
                windMultiplier: playerCapitalMultiplier,
                trainingLevel: isTraining
                  ? Number(
                      scenario.target.id.match(
                        /training_dummy_level_(\d+)/
                      )?.[1] ?? 0
                    ) || undefined
                  : undefined,
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
        (100 / (enemyDecision.waitMs / 1_000)) *
        STEP_SECONDS *
        (
          rapidAssaultRemainingSeconds > 0
            ? ENEMY_SUPPORT_SKILL_BALANCE.rapidAssault
                .actionProgressMultiplier
            : 1
        );

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
        playerInvested *
          (
            timedCapitalBuffRemainingSeconds > 0
              ? scenario.timedCapitalBuff?.multiplier ?? 1
              : 1
          ) -
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
        playerInvested *
          (
            timedCapitalBuffRemainingSeconds > 0
              ? scenario.timedCapitalBuff?.multiplier ?? 1
              : 1
          ),
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
    maximumPlayerRecoveryRatio,
    maximumEnemyRecoveryRatio,
    minimumEnemyReserve,
    enemyBossDefenseTier,
    enemyBossDefenseActivations,
    enemyBossDefenseAbsorbedGauge,
    timedCapitalBuffActivations,
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
  const wins = results.filter(
    (result) => result.winner === 'player'
  ).length;
  const timeouts = results.filter(
    (result) => result.winner === 'timeout'
  ).length;
  const activations = results.reduce(
    (totals, result) => {
      totals.cure += result.enemySupportActivations.cure;
      totals.mug += result.enemySupportActivations.mug;
      totals.drill += result.enemySupportActivations.drill;
      totals.divination +=
        result.enemySupportActivations.divination;
      totals.rapid_assault +=
        result.enemySupportActivations.rapid_assault;
      totals.limit_break_3 +=
        result.enemySupportActivations.limit_break_3;
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
    wins,
    winRate: wins / count,
    losses: results.filter((result) => result.winner === 'opponent').length,
    timeouts,
    timeoutRate: timeouts / count,
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
    p90DirectActions: percentile(
      results.map((result) => result.directActions),
      0.9
    ),
    medianSupportActions: percentile(
      results.map((result) => result.supportActions),
      0.5
    ),
    p90SupportActions: percentile(
      results.map((result) => result.supportActions),
      0.9
    ),
    activations,
    bossDefenseTier: results[0]?.enemyBossDefenseTier ?? 'none',
    openingBossDefenseTier: getOpeningBossAbilityTier({
      targetProperty: scenario.target,
      isSavage: scenario.isSavage,
    }),
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
    timedCapitalBuffActivations: results.reduce(
      (total, result) =>
        total + result.timedCapitalBuffActivations,
      0
    ),
    maximumPlayerRecoveryRatio: Math.max(
      ...results.map(
        (result) => result.maximumPlayerRecoveryRatio
      )
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

const runForcedBossDefenseProbe = ({
  id,
  target,
  isCityBoss = false,
  isSavage = false,
  isUltimate = false,
}: {
  id: string;
  target: Property;
  isCityBoss?: boolean;
  isSavage?: boolean;
  isUltimate?: boolean;
}) => {
  const tier = getBossAbilityTier({
    targetProperty: target,
    isCityBoss,
    isSavage,
    isUltimate,
  });
  const balance =
    tier === 'cover'
      ? BOSS_COVER_BALANCE.cover
      : tier === 'enhanced_cover'
        ? BOSS_COVER_BALANCE.enhancedCover
        : tier === 'invincible'
          ? BOSS_COVER_BALANCE.invincible
          : null;
  assert.ok(balance, `${id} must have an active boss defense`);

  const createDefenseState = () => ({
    gauge: -18,
    used: false,
    activations: 0,
    remainingMs: 0,
    capacity: 0,
    totalAbsorbedGauge: 0,
  });

  const applyPlayerPush = (
    state: ReturnType<typeof createDefenseState>,
    gaugeDelta: number,
    path: string
  ) => {
    const currentGauge = state.gauge;
    let nextGauge = state.gauge - gaugeDelta;
    const predictedOwnership = (100 - nextGauge) / 2;
    if (
      !state.used &&
      predictedOwnership >=
        BOSS_COVER_BALANCE.triggerPlayerOwnership
    ) {
      state.used = true;
      state.activations += 1;
      state.remainingMs = balance.durationMs;
      state.capacity = balance.gaugeCapacity;
    }
    let absorbedGauge = 0;
    if (state.remainingMs > 0) {
      const covered = applyCoverToGaugeDelta({
        currentGauge,
        nextGauge,
        protects: 'opponent',
        absorbRatio: balance.absorbRatio,
        remainingGaugeCapacity: state.capacity,
      });
      nextGauge = covered.nextGauge;
      state.capacity = covered.remainingGaugeCapacity;
      absorbedGauge = covered.absorbedGauge;
      state.totalAbsorbedGauge += absorbedGauge;
    }
    state.gauge = nextGauge;
    return {
      path,
      incomingGauge: gaugeDelta,
      appliedGauge: Number(
        (state.gauge - currentGauge).toFixed(4)
      ),
      absorbedGauge: Number(absorbedGauge.toFixed(4)),
      remainingGaugeCapacity: state.capacity,
    };
  };

  const exercisePath = (
    path: string,
    incomingGauge: number
  ) => {
    const state = createDefenseState();
    const trigger = applyPlayerPush(
      state,
      2,
      'threshold_exact_60'
    );
    const impact = applyPlayerPush(
      state,
      incomingGauge,
      path
    );
    return {
      path,
      trigger,
      impact,
      activations: state.activations,
      totalAbsorbedGauge: Number(
        state.totalAbsorbedGauge.toFixed(4)
      ),
    };
  };

  const independentPaths = [
    exercisePath('direct_investment', 8),
    exercisePath('subsidiary_support', 12),
    exercisePath(
      'limit_break_1',
      LIMIT_BREAK_OWNERSHIP_CAPS[1] * 2
    ),
    exercisePath(
      'limit_break_2',
      LIMIT_BREAK_OWNERSHIP_CAPS[2] * 2
    ),
    exercisePath(
      'limit_break_3',
      LIMIT_BREAK_OWNERSHIP_CAPS[3] * 2
    ),
    exercisePath('era_wind', 6),
    exercisePath('timed_synergy', 16),
    exercisePath('continuous_pressure', 4),
  ];

  const durationState = createDefenseState();
  const durationTrigger = applyPlayerPush(
    durationState,
    2,
    'threshold_exact_60'
  );
  durationState.remainingMs = 1;
  const finalActiveMillisecond = applyPlayerPush(
    durationState,
    5,
    'duration_last_millisecond'
  );
  durationState.remainingMs = 0;
  const afterExpiry = applyPlayerPush(
    durationState,
    5,
    'after_duration_expiry'
  );

  return {
    id,
    tier,
    absorbRatio: balance.absorbRatio,
    configuredDurationMs: balance.durationMs,
    configuredGaugeCapacity: balance.gaugeCapacity,
    independentPaths,
    durationTrigger,
    finalActiveMillisecond,
    afterExpiry,
  };
};

const trainingDummies = TRAINING_DUMMY_DEFINITIONS.map(
  buildTrainingDummyProperty
);
const starterFarm = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_starter_farm'
)!;
const starterBakery = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_starter_bakery'
)!;
const limsaTransport = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_land_transport'
)!;
const uldahPub = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_pub_central'
)!;
const uldahIronMine = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_iron_mine'
)!;
const gridaniaBoss = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_timber_ake'
)!;
const limsaBoss = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_brewery_beer'
)!;
const uldahBoss = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_casino_grand'
)!;
const ishgardBoss = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_weapon_dealer'
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
const kuganeOrdinaryTarget = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_detective'
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
const ultimateSanityTarget = buildUltimateProperty(
  false,
  '決定論監査商会'
);
const useProgressionSupport = (supportIndex: number, seed: number) =>
  3 + supportIndex * 3 + (seed % 2);
const useHighDifficultySupport = () => 0;
const grandCompanyEorzeaBurst = {
  // Manual progression SYNERGY is available after Radz-at-Han.
  triggerAfterDirectActions: 0,
  durationSeconds: 18,
  multiplier: 1.78,
  ownershipPush: 12,
} as const;
const ultimateGrandCompanyEorzeaBurst = {
  ...grandCompanyEorzeaBurst,
  // Three Savage upgrades (+0.06) and full integration (+0.07).
  multiplier: 1.91,
} as const;

const trainingReports = trainingDummies.map((target, index) =>
  summarize(
    {
      id: `training_level_${index + 1}`,
      target,
      isTraining: true,
      playerBaselineCash:
        index === 0 ? 20_000 : target.marketPrice,
      maxSeconds: index === 0 ? MAX_SECONDS : 900,
    },
    8,
    1_000 + index * 100
  )
);

const normalScenarios = [
  {
    id: 'gridania_first',
    target: starterFarm,
    isTutorial: true,
  },
  {
    id: 'gridania_second_with_support',
    target: starterBakery,
    influenceBonus: 0.03,
    supportSources: [starterFarm],
    supportAfterDirectActions: (_supportIndex, seed) => 6 + (seed % 3),
  },
  {
    id: 'gridania_second_without_support',
    target: starterBakery,
    influenceBonus: 0.03,
  },
  {
    id: 'normal_mid_kugane',
    target: kuganeOrdinaryTarget,
    maxSeconds: 600,
    supportSources: [ishgardWeaponDealer, gridaniaBoss],
    supportAfterDirectActions: useProgressionSupport,
  },
  {
    id: 'normal_late_solution_nine',
    target: solutionNineIndustry,
    maxSeconds: 600,
    supportSources: [
      easternAldenardHeadquarters,
      tuliyollalBoss,
      radzAtHanBoss,
      oldSharlayanBoss,
    ],
    supportAfterDirectActions: useProgressionSupport,
    timedCapitalBuff: grandCompanyEorzeaBurst,
  },
] as const satisfies readonly SimulationScenario[];

const normalReports = normalScenarios.map((scenario, index) =>
  summarize(scenario, 8, 2_000 + index * 100)
);

const authoredCityBossTargets = COMMUNITY_CAMPAIGN_ORDER.map(
  (community) =>
    getCampaignProperties(INITIAL_PROPERTIES, community).at(-1)!
);
const cityAuditScenarios = [
  {
    id: 'city_1_gridania_display',
    target: gridaniaBoss,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [starterFarm, starterBakery],
    supportAfterDirectActions: useProgressionSupport,
  },
  {
    id: 'city_2_limsa_display',
    target: limsaBoss,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [gridaniaBoss, starterBakery],
    supportAfterDirectActions: useProgressionSupport,
  },
  {
    id: 'city_3_uldah_display',
    target: uldahBoss,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [
      uldahPub,
      uldahIronMine,
      limsaTransport,
      limsaBoss,
      gridaniaBoss,
      starterBakery,
      starterFarm,
    ],
    supportAfterDirectActions: useProgressionSupport,
  },
  {
    id: 'city_4_ishgard_cover',
    target: ishgardBoss,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [uldahBoss, limsaBoss],
    supportAfterDirectActions: useProgressionSupport,
  },
  {
    id: 'city_5_kugane_cover',
    target: kuganeTradeBroker,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [ishgardBoss, uldahBoss],
    supportAfterDirectActions: useProgressionSupport,
  },
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
    timedCapitalBuff: grandCompanyEorzeaBurst,
  },
  {
    id: 'city_10_solution_nine_cure_divination',
    target: solutionNineBoss,
    isCityBoss: true,
    maxSeconds: 600,
    openingCapitalBoostRatio:
      TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio,
    supportSources: [
      solutionNineIndustry,
      tuliyollalBoss,
      radzAtHanBoss,
    ],
    supportAfterDirectActions: useProgressionSupport,
    timedCapitalBuff: grandCompanyEorzeaBurst,
  },
] as const satisfies readonly SimulationScenario[];

const cityReports = cityAuditScenarios.map(
  (scenario, index) =>
    summarize(
      scenario,
      10,
      3_000 + index * 100
    )
);

const cityEnemySupportScenarios = cityAuditScenarios.slice(5);
const cityEnemySupportDisabledReports =
  cityEnemySupportScenarios.map(
  (scenario, index) =>
    summarize(
      {
        ...scenario,
        id: `${scenario.id}_support_disabled`,
        disableEnemySupport: true,
      },
      10,
      3_000 + (index + 5) * 100
    )
  );

const cityEnemySupportComparison =
  cityReports.slice(5).map(
  (enabled, index) => {
    const baseline = cityEnemySupportDisabledReports[index];
    return {
      id: cityEnemySupportScenarios[index].id,
      enabledWinRate: enabled.winRate,
      baselineWinRate: baseline.winRate,
      percentagePointDelta: Number(
        ((enabled.winRate - baseline.winRate) * 100).toFixed(1)
      ),
      p90SecondsDelta: Number(
        (enabled.p90Seconds - baseline.p90Seconds).toFixed(2)
      ),
    };
  }
);

const highDifficultySupportSources = [...INITIAL_PROPERTIES]
  .sort(
    (left, right) =>
      calculateSubsidiarySupportAmount(right) -
      calculateSubsidiarySupportAmount(left)
  )
  .slice(0, 12);
const highDifficultySupportRotation = [
  ...highDifficultySupportSources,
  ...highDifficultySupportSources,
];
const savageScenarios: SimulationScenario[] =
  savageProperties.map((target, index) => ({
    id: `savage_chapter_${index + 1}`,
    target,
    isSavage: true,
    maxSeconds: 900,
    // Normal-clear cash can be far below a late Savage target's market price.
    // Audit the intended ally/AUTO route with only a 10% personal war chest
    // instead of silently granting the simulator a full target-price bankroll.
    playerBaselineCash: Math.round(target.marketPrice * 0.1),
    openingCapitalBoostRatio:
      TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio,
    supportSources: highDifficultySupportRotation,
    // A low-cash normal-clear save must be able to open with its holdings.
    // Requiring three personal buys before the first ally call made the
    // simulator test an impossible route rather than the in-game support plan.
    supportAfterDirectActions: useHighDifficultySupport,
    timedCapitalBuff: {
      ...grandCompanyEorzeaBurst,
      // Spend the early calls baiting Cover / Passage / Invincible, then
      // land the manual rally after the guard window. Layer 2 deliberately
      // punishes a carried-over LB, but a player who reads the opening guard
      // should not also be forced to waste their manual synergy into it.
      triggerAfterSupportActions:
        index % 4 === 1 ? 6 : index % 4 >= 2 ? 8 : 0,
    },
  }));
const savageReports = savageScenarios.map(
  (scenario, index) =>
    summarize(
      scenario,
      10,
      5_000 + index * 100
    )
);
const savageEnemySupportDisabledReports =
  savageScenarios.map((scenario, index) =>
    summarize(
      {
        ...scenario,
        id: `${scenario.id}_support_disabled`,
        disableEnemySupport: true,
      },
      10,
      5_000 + index * 100
    )
  );
const savageEnemySupportComparison = savageReports.map(
  (enabled, index) => {
    const baseline =
      savageEnemySupportDisabledReports[index];
    return {
      id: savageScenarios[index].id,
      enabledWinRate: enabled.winRate,
      baselineWinRate: baseline.winRate,
      percentagePointDelta: Number(
        ((enabled.winRate - baseline.winRate) * 100).toFixed(1)
      ),
      p90SecondsDelta: Number(
        (enabled.p90Seconds - baseline.p90Seconds).toFixed(2)
      ),
    };
  }
);
const ultimateScenarioBase = {
  id: 'ultimate_pattern_base',
  target: ultimateSanityTarget,
  isUltimate: true,
  maxSeconds: 1_200,
  playerBaselineCash: Math.round(
    ultimateSanityTarget.marketPrice * 0.1
  ),
  openingCapitalBoostRatio:
    TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio,
  supportSources: highDifficultySupportRotation,
  supportAfterDirectActions: useHighDifficultySupport,
  timedCapitalBuff: {
    ...ultimateGrandCompanyEorzeaBurst,
    triggerAfterSupportActions: 8,
  },
} as const satisfies SimulationScenario;
const ultimatePatternReports = ULTIMATE_ENEMY_AUTO_PATTERNS.map(
  (pattern, patternIndex) =>
    summarize(
      {
        ...ultimateScenarioBase,
        id: `ultimate_pattern_${pattern.id}`,
        ultimateAutoPatternIndex: patternIndex,
      },
      4,
      9_000 + patternIndex * 100
    )
);
const ultimateSupportDisabledReport = summarize(
  {
    ...ultimateScenarioBase,
    id: 'ultimate_support_disabled',
    disableEnemySupport: true,
  },
  6,
  9_900
);
const ultimateReports = [
  ...ultimatePatternReports,
  ultimateSupportDisabledReport,
];
const runtimeAlignmentProbes = {
  drillTelegraphPlayerCover:
    runDrillTelegraphCoverProbe(),
  divinationTelegraphEraWindCancel:
    runDivinationEraWindCancelProbe(),
  forcedBossDefense: [
    runForcedBossDefenseProbe({
      id: 'city_4_cover_forced',
      target: ishgardBoss,
      isCityBoss: true,
    }),
    runForcedBossDefenseProbe({
      id: 'city_8_enhanced_cover_forced',
      target: radzAtHanBoss,
      isCityBoss: true,
    }),
    runForcedBossDefenseProbe({
      id: 'city_10_invincible_forced',
      target: solutionNineBoss,
      isCityBoss: true,
    }),
    runForcedBossDefenseProbe({
      id: 'savage_layer_1_cover_forced',
      target: savageProperties[0],
      isSavage: true,
    }),
    runForcedBossDefenseProbe({
      id: 'savage_layer_2_enhanced_cover_forced',
      target: savageProperties[1],
      isSavage: true,
    }),
    runForcedBossDefenseProbe({
      id: 'savage_layer_4_invincible_forced',
      target: savageProperties[3],
      isSavage: true,
    }),
    runForcedBossDefenseProbe({
      id: 'ultimate_invincible_forced',
      target: ultimateSanityTarget,
      isUltimate: true,
    }),
  ],
};

const allReports = [
  ...trainingReports,
  ...normalReports,
  ...cityReports,
  ...cityEnemySupportDisabledReports,
  ...savageReports,
  ...savageEnemySupportDisabledReports,
  ...ultimateReports,
];
const totalBattles = allReports.reduce(
  (total, report) => total + report.battles,
  0
);
assert.equal(
  totalBattles,
  500,
  'the deterministic audit executes exactly five hundred battles'
);

const reportById = Object.fromEntries(
  allReports.map((report) => [report.id, report])
);
console.log(JSON.stringify({
  totalBattles,
  trainingAudit: {
    totalBattles: trainingReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
    reports: trainingReports,
  },
  normalProgressionAudit: {
    totalBattles: normalReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
    reports: normalReports,
  },
  cityBossAudit: {
    totalBattles: cityReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
    reports: cityReports,
  },
  cityEnemySupportDisabledAudit: {
    totalBattles: cityEnemySupportDisabledReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
    reports: cityEnemySupportDisabledReports,
    comparison: cityEnemySupportComparison,
  },
  savageAudit: {
    totalBattles: savageReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
    reports: savageReports,
  },
  savageEnemySupportDisabledAudit: {
    totalBattles: savageEnemySupportDisabledReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
    reports: savageEnemySupportDisabledReports,
    comparison: savageEnemySupportComparison,
  },
  ultimateAudit: {
    totalBattles: ultimateReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
    reports: ultimateReports,
  },
  runtimeAlignmentProbes,
}, null, 2));

assert.equal(reportById.training_level_1.wins, 8);
for (const report of trainingReports) {
  assert.equal(
    report.wins,
    report.battles,
    `${report.id} should remain completable with its authored training funds`
  );
}
assert.ok(
  reportById.training_level_1.medianDirectActions >= 3 &&
    reportById.training_level_1.medianDirectActions <= 5,
  'level-one training should take three to five default direct offers'
);
assert.ok(reportById.training_level_1.p90Seconds <= 25);
assert.equal(reportById.gridania_first.wins, 8);
assert.ok(
  reportById.gridania_first.medianDirectActions >= 10 &&
    reportById.gridania_first.medianDirectActions <= 12
);
assert.equal(reportById.gridania_second_with_support.wins, 8);
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
assert.equal(
  reportById.city_8_radz_at_han_mug_drill.timedCapitalBuffActivations,
  0,
  'Grand Company Eorzea is not available during the Radz-at-Han boss itself'
);
for (const id of [
  'normal_late_solution_nine',
  'city_9_tuliyollal_divination',
  'city_10_solution_nine_cure_divination',
] as const) {
  assert.equal(
    reportById[id].timedCapitalBuffActivations,
    reportById[id].battles,
    `${id} can use Grand Company Eorzea after Radz-at-Han`
  );
}

for (const report of allReports) {
  assert.equal(
    report.wins + report.losses + report.timeouts,
    report.battles,
    `${report.id} must account for every battle`
  );
  assert.ok(
    report.timeouts >= 0 &&
      report.timeouts <= report.battles,
    `${report.id} must report a valid timeout count`
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
    report.maximumPlayerRecoveryRatio <=
      BATTLE_CASH_RECOVERY_TOTAL_CAP_RATIO + Number.EPSILON,
    `${report.id} must keep player recovery within the cumulative 20% cap`
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
        report.activations[skill] <= report.battles,
        `${report.id} must not activate configured ${skill} more than once per battle`
      );
    } else {
      assert.equal(report.activations[skill], 0);
    }
  }
  assert.ok(
    report.bossDefenseActivations <=
      report.battles *
        (report.openingBossDefenseTier === 'none' ? 1 : 2),
    `${report.id} must not repeat either its opening or main boss defense`
  );
}

for (const report of [
  ...trainingReports,
  ...normalReports,
  ...cityReports,
  ...cityEnemySupportDisabledReports,
]) {
  assert.equal(
    report.timeouts,
    0,
    `${report.id} should resolve within its deterministic normal-difficulty audit window`
  );
}

for (const report of [
  ...trainingReports,
  ...normalReports,
  ...cityReports,
]) {
  assert.ok(
    report.p90Seconds < 120,
    `${report.id} should keep its p90 below two minutes`
  );
  assert.ok(
    report.p90DirectActions + report.p90SupportActions < 30,
    `${report.id} should not require thirty capital commands`
  );
}

const expectedCityBossIds = [
  'prop_timber_ake',
  'prop_brewery_beer',
  'prop_casino_grand',
  'prop_weapon_dealer',
  'prop_info_broker',
  'prop_inn_town',
  'prop_wheat_farm',
  'prop_security_firm',
  'prop_coffee_aurora',
  'prop_abyss_mine',
] as const;
const expectedCityDefenseTiers = [
  'boss',
  'boss',
  'boss',
  'cover',
  'cover',
  'cover',
  'cover',
  'enhanced_cover',
  'enhanced_cover',
  'invincible',
] as const;
const expectedCitySupportProfiles = [
  [],
  [],
  [],
  [],
  [],
  ['cure'],
  ['mug'],
  ['mug', 'drill'],
  ['divination'],
  ['cure', 'divination'],
] as const;

assert.equal(cityReports.length, 10);
assert.deepEqual(
  authoredCityBossTargets.map((target) => target.id),
  expectedCityBossIds
);
cityReports.forEach((report, index) => {
  assert.equal(report.targetId, expectedCityBossIds[index]);
  assert.equal(
    report.bossDefenseTier,
    expectedCityDefenseTiers[index]
  );
  assert.deepEqual(
    report.profile,
    expectedCitySupportProfiles[index]
  );
});

assert.equal(cityEnemySupportDisabledReports.length, 5);
for (const report of cityEnemySupportDisabledReports) {
  assert.deepEqual(report.profile, []);
  assert.deepEqual(
    report.activations,
    createEnemySupportActivationCounts()
  );
}

assert.equal(savageProperties.length, 12);
assert.equal(savageReports.length, 12);
savageReports.forEach((report, index) => {
  const layer = (index % 4) + 1;
  const expectedTier =
    layer === 1
      ? 'cover'
      : layer < 4
        ? 'enhanced_cover'
        : 'invincible';
  const expectedProfile =
    layer === 1
      ? ['cure', 'mug']
      : layer === 2
        ? ['mug', 'divination']
        : layer === 3
          ? ['mug', 'drill']
          : ['cure', 'mug', 'drill', 'divination'];
  assert.equal(report.bossDefenseTier, expectedTier);
  assert.equal(
    report.openingBossDefenseTier,
    layer === 2 ? 'cover' : 'none',
    `${report.id} uses guaranteed opening Cover only on layer two`
  );
  assert.deepEqual(report.profile, expectedProfile);
  assert.equal(
    report.wins,
    report.battles,
    `${report.id} remains clearable with opening AUTO, support and Grand Company Eorzea`
  );
  assert.ok(
    report.p90Seconds < 120,
    `${report.id} avoids a two-minute mud fight`
  );
  assert.ok(
    report.p90DirectActions + report.p90SupportActions < 30,
    `${report.id} avoids a thirty-action investment grind`
  );
  assert.equal(
    report.timedCapitalBuffActivations,
    report.battles,
    `${report.id} evaluates the manual Grand Company Eorzea burst`
  );
});

assert.equal(savageEnemySupportDisabledReports.length, 12);
for (const report of savageEnemySupportDisabledReports) {
  assert.deepEqual(report.profile, []);
  assert.deepEqual(
    report.activations,
    createEnemySupportActivationCounts()
  );
}

assert.equal(
  ultimatePatternReports.length,
  ULTIMATE_ENEMY_AUTO_PATTERNS.length
);
let ultimatePatternWins = 0;
ultimatePatternReports.forEach((report, index) => {
  const pattern = ULTIMATE_ENEMY_AUTO_PATTERNS[index];
  assert.deepEqual(
    report.profile,
    ['cure', 'mug', 'drill', 'divination']
  );
  assert.equal(
    report.openingBossDefenseTier,
    'none',
    'Ultimate keeps its opening surprise in the AUTO pattern, not a hidden second guard'
  );
  assert.equal(
    report.activations[pattern.opening],
    report.battles,
    `${report.id} always presents its selected opening action`
  );
  assert.equal(
    report.activations[pattern.critical],
    report.battles,
    `${report.id} always presents its selected critical action`
  );
  for (const special of [
    'rapid_assault',
    'limit_break_3',
  ] as const) {
    const expectedActivations =
      pattern.opening === special || pattern.critical === special
        ? report.battles
        : 0;
    assert.equal(
      report.activations[special],
      expectedActivations,
      `${report.id} must fire only the special action selected for that attempt`
    );
  }
  assert.equal(report.timeouts, 0);
  assert.ok(
    report.p90Seconds < 120,
    `${report.id} resolves inside the two-minute Ultimate target`
  );
  assert.ok(
    report.p90DirectActions + report.p90SupportActions < 30,
    `${report.id} resolves before thirty investment actions`
  );
  assert.equal(
    report.timedCapitalBuffActivations,
    report.battles,
    `${report.id} evaluates Grand Company Eorzea against the selected surprise`
  );
  ultimatePatternWins += report.wins;
});
assert.ok(
  ultimatePatternWins > 0 &&
    ultimatePatternWins < ultimatePatternReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
  'an unadapted support route can clear some Ultimate patterns but still wipes to the final surprises'
);
assert.deepEqual(ultimateSupportDisabledReport.profile, []);
assert.deepEqual(
  ultimateSupportDisabledReport.activations,
  createEnemySupportActivationCounts()
);

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

assert.deepEqual(BOSS_COVER_BALANCE.cover, {
  durationMs: 20_000,
  absorbRatio: 0.78,
  gaugeCapacity: 48,
});
assert.deepEqual(BOSS_COVER_BALANCE.enhancedCover, {
  durationMs: 22_000,
  absorbRatio: 0.9,
  gaugeCapacity: 68,
});
assert.deepEqual(BOSS_COVER_BALANCE.invincible, {
  durationMs: 8_000,
  absorbRatio: 1,
  gaugeCapacity: Number.POSITIVE_INFINITY,
});

const expectedForcedDefenseTiers = [
  'cover',
  'enhanced_cover',
  'invincible',
  'cover',
  'enhanced_cover',
  'invincible',
  'invincible',
] as const;
const assertNearlyEqual = (
  actual: number,
  expected: number,
  message: string
) =>
  assert.ok(
    Math.abs(actual - expected) <= 0.0001,
    `${message}: expected ${expected}, received ${actual}`
  );

assert.equal(
  runtimeAlignmentProbes.forcedBossDefense.length,
  expectedForcedDefenseTiers.length
);
runtimeAlignmentProbes.forcedBossDefense.forEach(
  (probe, probeIndex) => {
    assert.equal(
      probe.tier,
      expectedForcedDefenseTiers[probeIndex]
    );
    const balance =
      probe.tier === 'cover'
        ? BOSS_COVER_BALANCE.cover
        : probe.tier === 'enhanced_cover'
          ? BOSS_COVER_BALANCE.enhancedCover
          : BOSS_COVER_BALANCE.invincible;
    assert.equal(
      probe.configuredDurationMs,
      balance.durationMs
    );
    assert.equal(
      probe.configuredGaugeCapacity,
      balance.gaugeCapacity
    );
    assert.equal(probe.absorbRatio, balance.absorbRatio);

    for (const path of probe.independentPaths) {
      assert.equal(
        path.activations,
        1,
        `${probe.id} should independently activate for ${path.path}`
      );
      const triggerAbsorbed =
        path.trigger.incomingGauge * balance.absorbRatio;
      assertNearlyEqual(
        path.trigger.absorbedGauge,
        triggerAbsorbed,
        `${probe.id} trigger absorption`
      );
      const capacityAfterTrigger =
        balance.gaugeCapacity === Number.POSITIVE_INFINITY
          ? Number.POSITIVE_INFINITY
          : balance.gaugeCapacity - triggerAbsorbed;
      const expectedAbsorbed = Math.min(
        path.impact.incomingGauge * balance.absorbRatio,
        capacityAfterTrigger
      );
      assertNearlyEqual(
        path.impact.absorbedGauge,
        expectedAbsorbed,
        `${probe.id} ${path.path} absorption`
      );
      assertNearlyEqual(
        path.impact.appliedGauge,
        -(path.impact.incomingGauge - expectedAbsorbed),
        `${probe.id} ${path.path} applied gauge`
      );
      assert.ok(
        path.totalAbsorbedGauge > 0,
        `${probe.id} ${path.path} must absorb player pressure`
      );
    }

    assert.ok(
      probe.finalActiveMillisecond.absorbedGauge > 0,
      `${probe.id} remains defensive through the final active millisecond`
    );
    assert.equal(
      probe.afterExpiry.absorbedGauge,
      0,
      `${probe.id} stops absorbing after its authored duration`
    );
    assert.equal(
      probe.afterExpiry.appliedGauge,
      -probe.afterExpiry.incomingGauge,
      `${probe.id} allows player pressure after expiry`
    );
  }
);

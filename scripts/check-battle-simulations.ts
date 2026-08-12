import assert from 'node:assert/strict';
import {
  INITIAL_GROUP_SYNERGIES,
  INITIAL_PROPERTIES,
} from '../src/data/initialData';
import { COMMUNITY_CAMPAIGN_ORDER } from '../src/data/worldData';
import { getCampaignEncounterDefinition } from '../src/data/campaignEncounterData';
import { decideEnemyAction } from '../src/utils/enemyAi';
import {
  BLACKEST_NIGHT_BALANCE,
  CAPITAL_REVERSAL_BALANCE,
  CRUEL_SCRIPTED_BATTLE,
  ENEMY_SUPPORT_ACTIONS,
  FORCED_LIQUIDATION_BALANCE,
  SAVAGE_ENEMY_AUTO_PROFILES,
  SAVAGE_ENEMY_SUPPORT_PROFILES,
  type CruelScriptPhase,
} from '../src/data/battleEncounterData';
import {
  advanceBattleCashRecovery,
  applyNormalClosingMomentum,
  applyTrainingGaugeSpeed,
  BATTLE_SUPPORT_BALANCE,
  BATTLE_CASH_RECOVERY_TOTAL_CAP_RATIO,
  BOSS_COVER_BALANCE,
  calculateDirectInvestmentGaugeImpact,
  calculateEnemyBudget,
  calculateLimitBreakChargeGain,
  calculateLimitBreakAmount,
  calculateLimitBreakOwnershipPush,
  calculateSubsidiarySupportAmount,
  ENEMY_INITIAL_COMMITMENT_RATIO,
  ENEMY_SUPPORT_SKILL_BALANCE,
  applyBlackestNightToGaugeDelta,
  applyCoverToGaugeDelta,
  canEnemyAffordDrill,
  getEnemyDivinationDurationMs,
  getEnemyDifficultyLevel,
  getEnemyDrillImpact,
  getEnemyMinimumCommitment,
  getLimitBreakTier,
  getOpeningBossAbilityTier,
  getEnemySupportAutoProfile,
  getEnemySupportSkillProfile,
  getBossAbilityTier,
  getCampaignProperties,
  isExtremeReacquisition,
  INITIAL_BATTLE_COMMAND_PROGRESS,
  LIMIT_BREAK_OWNERSHIP_CAPS,
  resolveEnemyDrainTransfer,
  resolveCapitalReversal,
  calculateForcedLiquidationGaugeDelta,
  resolveForcedLiquidationContinuousVelocity,
  resolveBattleGaugeSpeedFactor,
  shouldEnemyUseBlackestNight,
  shouldForceUltimateCriticalBeforeVictory,
  TACTICAL_SKILL_BALANCE,
  HIGH_DIFFICULTY_SUPPORT_MULTIPLIER,
  isNormalPlayerLiquidityCloseoutActive,
  SAVAGE_NETWORK_SUPPORT_LIMIT,
  ULTIMATE_APPRAISAL_LIMIT_MS,
  ULTIMATE_NETWORK_SUPPORT_LIMIT,
  ULTIMATE_ENEMY_AUTO_PATTERNS,
  type EnemySupportSkillId,
  type LimitBreakTier,
} from '../src/utils/gameBalance';
import {
  buildCapitalStackTimeline,
  getBattleHitStopTiming,
  getCapitalCommitTiming,
} from '../src/utils/battlePresentation';
import { calculateGaugeVelocity } from '../src/utils/formatter';
import {
  buildCruelProperty,
  buildSavageProperties,
  buildUltimateProperty,
  SAVAGE_RAID_DEFINITIONS,
} from '../src/utils/savage';
import {
  calculateCruelSignatureRequirement,
  resolveCruelFirstImpact,
  resolveCruelRecoveryContinuousVelocity,
  resolveCruelSecondImpact,
  shouldHoldCruelVictory,
  shouldTriggerCruelFirstPhase,
  shouldTriggerCruelSecondPhase,
} from '../src/utils/cruelBattle';
import type { PlayerBattleAction } from '../src/utils/enemyAi';
import type { Property } from '../src/types';
import { ALLIANCE_SUPPORT_MARKET_RATIO } from '../src/utils/alliance';

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
  isCruel?: boolean;
  isPhantom?: boolean;
  ultimateAutoPatternIndex?: number;
  disableEnemySupport?: boolean;
  maxSeconds?: number;
  playerBaselineCash?: number;
  /** Legacy-only preload used by older deterministic baselines. */
  openingCapitalBoostRatio?: number;
  /** Legacy-only preload used by older deterministic baselines. */
  openingAllianceSupportRatio?: number;
  /** Executes ぶんどる as a real ready-command action instead of preloading it. */
  manualCapitalBoostRatio?: number;
  /** Executes external-alliance support as a real ready-command action. */
  manualAllianceSupportRatio?: number;
  openingPlayerPassage?: boolean;
  playerPassageOnLimitBreak?: boolean;
  influenceBonus?: number;
  supportSources?: readonly Property[];
  supportAfterDirectActions?: (supportIndex: number, seed: number) => number;
  timedCapitalBuff?: {
    triggerAfterDirectActions: number;
    triggerAfterSupportActions?: number;
    durationSeconds: number;
    multiplier: number;
    ownershipPush: number;
    continuousGaugePushPerSecond?: number;
    limitBreakChargeMultiplier?: number;
  };
  preparedLimitBreak?: {
    tier: LimitBreakTier;
    triggerAfterDirectActions?: number;
    triggerAfterSupportActions: number;
    participants: readonly Property[];
  };
  /** Requires the simulated command route to earn the requested LB bars. */
  requireChargedLimitBreak?: boolean;
  /** Models the full live normal-pile duration while command recharge continues. */
  modelFullNormalPresentation?: boolean;
  allowDirectInvestment?: boolean;
  preferDirectInvestmentActions?: number;
  /** Additional human hesitation after each ready command. */
  reactionDelayExtraSeconds?: number;
  /** Allows audits to distinguish a prepared route from one that ignores regen. */
  playerRecoveryCapRatio?: number;
  /** Captures the first expired 強制清算 tick without a real counter-command. */
  captureForcedLiquidationNoCounter?: boolean;
}

type EnemySupportActivationCounts = Record<EnemySupportSkillId, number>;

interface SimulationResult {
  winner: 'player' | 'opponent' | 'timeout';
  wallSeconds: number;
  directActions: number;
  supportActions: number;
  limitBreakActions: number;
  manualOpeningActions: number;
  finalOwnership: number;
  enemySupportActivations: EnemySupportActivationCounts;
  maximumPlayerRecoveryRatio: number;
  maximumEnemyRecoveryRatio: number;
  minimumEnemyReserve: number;
  liquidityCloseoutSeconds: number | null;
  finishAction: PlayerBattleAction | null;
  enemyBossDefenseTier: ReturnType<typeof getBossAbilityTier>;
  enemyBudget: number;
  enemyDifficultyLevel: number;
  enemySupportAutoProfile: ReturnType<typeof getEnemySupportAutoProfile>;
  networkSupportLimit: number;
  ultimateAppraisalEnabled: boolean;
  ultimateLimitBreakUseLimit: 1 | null;
  ultimateCriticalGateEnabled: boolean;
  enemyBossDefenseActivations: number;
  enemyBossDefenseAbsorbedGauge: number;
  timedCapitalBuffActivations: number;
  cruelSecondSignatureInvested: number;
  cruelSecondStartOwnership: number | null;
  forcedLiquidationNoCounterSnapshot?: {
    actionCountAtImpact: number;
    actionCountAtExpiry: number;
    awaitingManualCounter: boolean;
    rawVelocity: number;
    appliedVelocity: number;
  } | null;
}

const createEnemySupportActivationCounts =
  (): EnemySupportActivationCounts => ({
    blackest_night: 0,
    drain: 0,
    drill: 0,
    divination: 0,
    rapid_assault: 0,
    limit_break_3: 0,
    capital_reversal: 0,
    forced_liquidation: 0,
    omnicapitalization: 0,
    cruel_reckoning: 0,
  });

const ENEMY_SUPPORT_PRESENTATION = Object.fromEntries(
  Object.entries(ENEMY_SUPPORT_ACTIONS).map(([skillId, action]) => [
    skillId,
    {
      telegraphSeconds: action.telegraphMs / 1_000,
      castSeconds: action.castMs / 1_000,
      impactSeconds: action.impactMs / 1_000,
      afterglowSeconds: action.afterglowMs / 1_000,
      leavingSeconds: action.leavingMs / 1_000,
    },
  ])
) as Record<
  EnemySupportSkillId,
  {
    telegraphSeconds: number;
    castSeconds: number;
    impactSeconds: number;
    afterglowSeconds: number;
    leavingSeconds: number;
  }
>;

interface PendingEnemySupport {
  skill: EnemySupportSkillId;
  impactRemainingSeconds: number;
  completeRemainingSeconds: number;
  impacted: boolean;
}

const deterministicReactionDelay = (seed: number, actionCount: number) =>
  ((seed * 17 + actionCount * 11) % 8) * 0.05;

const getScenarioReactionDelay = (
  scenario: SimulationScenario,
  seed: number,
  actionCount: number
) =>
  deterministicReactionDelay(seed, actionCount) +
  Math.max(0, scenario.reactionDelayExtraSeconds ?? 0);

const getAffordableInvestment = (cash: number, marketPrice: number) =>
  [...INVESTMENT_LEVELS]
    .reverse()
    .find(
      ({ ratio }) =>
        Math.max(10, Math.round(marketPrice * ratio)) <= cash
    ) ??
  null;

const getForcedLiquidationSimulationGraceMs = (
  scenario: SimulationScenario
) => {
  const usesSavageMechanics =
    scenario.isSavage === true || scenario.isPhantom === true;
  const savageSeries = usesSavageMechanics
    ? SAVAGE_RAID_DEFINITIONS.find(
        (definition) => definition.id === scenario.target.id
      )?.series
    : undefined;
  return scenario.isUltimate
    ? FORCED_LIQUIDATION_BALANCE.ultimateRecoveryGraceMs
    : savageSeries === 1
      ? FORCED_LIQUIDATION_BALANCE.firstClearRecoveryGraceMs
      : FORCED_LIQUIDATION_BALANCE.laterSavageRecoveryGraceMs;
};

const runForcedLiquidationManualCounterProbe = () => {
  let gauge = -99;
  // Forced Liquidation itself grants a ready counter-command; keep this probe
  // independent from the normal battle opener.
  let commandProgress = 100;
  let awaitingManualCounter = true;
  const recoveryRemaining =
    FORCED_LIQUIDATION_BALANCE.laterSavageRecoveryGraceMs;
  const waitingVelocity = resolveForcedLiquidationContinuousVelocity({
    velocity: -6,
    recoveryRemaining,
    awaitingManualCounter,
  });
  const expiredWaitingPlayerVelocity =
    resolveForcedLiquidationContinuousVelocity({
      velocity: -6,
      recoveryRemaining: 0,
      awaitingManualCounter,
    });
  const expiredWaitingEnemyVelocity =
    resolveForcedLiquidationContinuousVelocity({
      velocity: 6,
      recoveryRemaining: 0,
      awaitingManualCounter,
    });
  gauge += waitingVelocity * STEP_SECONDS;
  const winnerBeforeManual = gauge <= -100 ? 'player' : null;

  const manualCommandConsumed = commandProgress >= 100;
  if (manualCommandConsumed) {
    awaitingManualCounter = false;
    commandProgress = 0;
    gauge -= 2;
  }
  const winnerAfterManual =
    recoveryRemaining > 0 && awaitingManualCounter
      ? null
      : gauge <= -100
        ? 'player'
        : gauge >= 100
          ? 'opponent'
          : null;

  return {
    recoveryRemaining,
    waitingVelocity,
    expiredWaitingPlayerVelocity,
    expiredWaitingEnemyVelocity,
    winnerBeforeManual,
    manualCommandConsumed,
    awaitingManualCounter,
    commandProgress,
    winnerAfterManual,
  };
};

const simulateBattle = (
  scenario: SimulationScenario,
  seed: number
): SimulationResult => {
  const marketPrice = scenario.target.marketPrice;
  const isTraining = scenario.isTraining ?? false;
  const isTutorial = scenario.isTutorial ?? false;
  const isSavage = scenario.isSavage ?? false;
  const isUltimate = scenario.isUltimate ?? false;
  const isCruel = scenario.isCruel ?? false;
  const isPhantom = scenario.isPhantom ?? false;
  const isExtremeBattle = isExtremeReacquisition(scenario.target);
  const campaignEncounterDefinition =
    getCampaignEncounterDefinition(scenario.target.id);
  const usesSavageMechanics = isSavage || isPhantom;
  const usesUltimateBasePower = isUltimate || isPhantom;
  const isHighEndRaid =
    usesSavageMechanics || isUltimate || isCruel;
  const networkSupportLimit = usesSavageMechanics
    ? SAVAGE_NETWORK_SUPPORT_LIMIT
    : isUltimate
      ? ULTIMATE_NETWORK_SUPPORT_LIMIT
      : Number.POSITIVE_INFINITY;
  const enemySupportProfile = scenario.disableEnemySupport
    ? []
    : getEnemySupportSkillProfile({
        targetProperty: scenario.target,
        isCityBoss: scenario.isCityBoss ?? false,
         isSavage: usesSavageMechanics,
         isUltimate,
         isCruel,
      });
  const enemySupportAutoProfile = scenario.disableEnemySupport
    ? { opening: null, critical: null }
    : getEnemySupportAutoProfile({
        targetProperty: scenario.target,
        isCityBoss: scenario.isCityBoss ?? false,
         isSavage: usesSavageMechanics,
         isUltimate,
         isCruel,
        ultimatePatternIndex: scenario.ultimateAutoPatternIndex,
      });
  const enemyBossDefenseTier = getBossAbilityTier({
    targetProperty: scenario.target,
    isCityBoss: scenario.isCityBoss ?? false,
    isSavage: usesSavageMechanics,
    isUltimate,
    isCruel,
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
    isSavage: usesSavageMechanics,
  });
  const openingBossDefenseBalance =
    openingBossAbilityTier === 'cover'
      ? BOSS_COVER_BALANCE.cover
      : null;
  const enemyDifficulty = getEnemyDifficultyLevel(
    scenario.target,
    isTutorial,
    usesSavageMechanics,
    usesUltimateBasePower,
    scenario.isCityBoss ?? false,
    isCruel
  );
  const enemyBudget = isTraining
    ? marketPrice
    : calculateEnemyBudget({
        targetProperty: scenario.target,
        industryInfluence: NO_INFLUENCE,
        regionalInfluence: NO_INFLUENCE,
        isTutorial,
        isSavage,
        isUltimate: usesUltimateBasePower,
        isCruel,
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
    marketPrice *
    ((scenario.openingCapitalBoostRatio ?? 0) +
      (scenario.openingAllianceSupportRatio ?? 0));
  let enemyInvested = initialEnemyCommitment;
  let playerCash = playerBaselineCash;
  let enemyReserve = enemyBudget - initialEnemyCommitment;
  let playerRecovered = 0;
  let enemyRecovered = 0;
  let commandProgress = INITIAL_BATTLE_COMMAND_PROGRESS;
  let aiProgress = 0;
  let aiCycle = 0;
  let lastPlayerAction: PlayerBattleAction | null = null;
  let lastPlayerCapitalAction: PlayerBattleAction | null = null;
  let presentationLockSeconds = 0;
  let presentationAllowsCommandRecharge = false;
  let reactionDelaySeconds = getScenarioReactionDelay(scenario, seed, 0);
  let directActions = 0;
  let supportActions = 0;
  let limitBreakActions = 0;
  let earnedLimitBreakCharge = 0;
  let campaignNetworkFinisherArmed = false;
  let manualOpeningActions = 0;
  let manualCapitalBoostUsed = false;
  let manualAllianceSupportUsed = false;
  const supportUseCounts: Record<string, number> = {};
  let wallSeconds = 0;
  let enemyBlackestNightRemainingSeconds = 0;
  let enemyBlackestNightCapacity = 0;
  let capitalReversalRemainingSeconds = 0;
  let forcedLiquidationRecoveryRemainingSeconds = 0;
  let forcedLiquidationAwaitingManualCounter = false;
  let forcedLiquidationActionCountAtImpact: number | null = null;
  let forcedLiquidationNoCounterSnapshot:
    | NonNullable<SimulationResult['forcedLiquidationNoCounterSnapshot']>
    | null = null;
  let playerPassageRemainingSeconds = scenario.openingPlayerPassage
    ? TACTICAL_SKILL_BALANCE.cover.durationMs / 1_000
    : 0;
  let playerPassageCapacity = scenario.openingPlayerPassage
    ? TACTICAL_SKILL_BALANCE.cover.gaugeCapacity
    : 0;
  let divinationRemainingSeconds = 0;
  let rapidAssaultRemainingSeconds = 0;
  let enemyLimitBreakHoldRemainingSeconds = 0;
  let cruelPhase: CruelScriptPhase = isCruel
    ? 'awaiting_first'
    : 'inactive';
  let cruelActiveSeconds = 0;
  let cruelRecoverySeconds = 0;
  let cruelSecondSignatureInvested = 0;
  let cruelSecondStartOwnership: number | null = null;
  let maximumPlayerRecoveryRatio = 0;
  let maximumEnemyRecoveryRatio = 0;
  let minimumEnemyReserve = enemyReserve;
  let liquidityCloseoutActiveSince: number | null = null;
  let pendingEnemySupport: PendingEnemySupport | null = null;
  let cruelSecondFailurePending = false;
  let enemyBossDefenseUsed = false;
  let enemyActiveBossDefenseBalance:
    | {
        durationMs: number;
        absorbRatio: number;
        gaugeCapacity: number;
        counterCapitalRatio: number;
      }
    | null = openingBossDefenseBalance;
  let enemyActiveBossDefenseTier = openingBossAbilityTier;
  let enemyBossDefenseRemainingSeconds = openingBossDefenseBalance
    ? openingBossDefenseBalance.durationMs / 1_000
    : 0;
  let enemyBossDefenseCapacity =
    openingBossDefenseBalance?.gaugeCapacity ?? 0;
  let enemyBossDefenseActivations =
    openingBossDefenseBalance ? 1 : 0;
  let enemyBossDefenseAbsorbedGauge = 0;
  let ultimateCriticalGateConsumed = false;
  let timedCapitalBuffUsed = false;
  let preparedLimitBreakUsed = false;
  let timedCapitalBuffRemainingSeconds = 0;
  let timedCapitalBuffActivations = 0;
  const usedEnemySupportSkills = new Set(
    [] as (typeof enemySupportProfile)[number][]
  );
  const enemySupportActivations =
    createEnemySupportActivationCounts();

  const commitEnemyGuardCapital = (counterCapitalRatio: number) => {
    const guardCapital = Math.min(
      enemyReserve,
      Math.round(marketPrice * counterCapitalRatio)
    );
    enemyReserve -= guardCapital;
    enemyInvested += guardCapital;
    minimumEnemyReserve = Math.min(minimumEnemyReserve, enemyReserve);
  };
  if (openingBossDefenseBalance) {
    commitEnemyGuardCapital(openingBossDefenseBalance.counterCapitalRatio);
  }

  const applyEnemyGaugeCandidate = (nextGauge: number) => {
    if (nextGauge <= gauge) {
      gauge = nextGauge;
      return;
    }
    if (
      playerPassageRemainingSeconds > 0 &&
      playerPassageCapacity > 0
    ) {
      const passage = applyCoverToGaugeDelta({
        currentGauge: gauge,
        nextGauge,
        protects: 'player',
        absorbRatio: TACTICAL_SKILL_BALANCE.cover.absorbRatio,
        remainingGaugeCapacity: playerPassageCapacity,
      });
      nextGauge = passage.nextGauge;
      playerPassageCapacity = passage.remainingGaugeCapacity;
      if (playerPassageCapacity <= 0) {
        playerPassageRemainingSeconds = 0;
      }
    }
    gauge = nextGauge;
  };

  const applyPlayerGaugeCandidate = (nextGauge: number) => {
    if (nextGauge >= gauge) {
      applyEnemyGaugeCandidate(nextGauge);
      return;
    }
    const predictedPlayerOwnership = (100 - nextGauge) / 2;
    if (
      enemyBossDefenseBalance &&
      !enemyBossDefenseUsed &&
      enemyBossDefenseRemainingSeconds <= 0 &&
      (enemyBlackestNightRemainingSeconds <= 0 ||
        enemyBlackestNightCapacity <= 0) &&
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
      enemyActiveBossDefenseTier = enemyBossDefenseTier;
      commitEnemyGuardCapital(enemyBossDefenseBalance.counterCapitalRatio);
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
        enemyActiveBossDefenseTier = 'none';
      }
    }
    if (
      enemyBlackestNightRemainingSeconds > 0 &&
      enemyBlackestNightCapacity > 0
    ) {
      const barrier = applyBlackestNightToGaugeDelta({
        currentGauge: gauge,
        nextGauge,
        protects: 'opponent',
        remainingGaugeCapacity: enemyBlackestNightCapacity,
      });
      nextGauge = barrier.nextGauge;
      enemyBlackestNightCapacity = barrier.remainingGaugeCapacity;
      if (enemyBlackestNightCapacity <= 0) {
        enemyBlackestNightRemainingSeconds = 0;
        if (barrier.didFullyBreak) {
          // Dark Wave is part of the same gauge transaction and may itself be
          // mitigated by the player's active defensive state.
          applyEnemyGaugeCandidate(
            nextGauge + BLACKEST_NIGHT_BALANCE.darkWaveGaugeDelta
          );
          nextGauge = gauge;
        }
      }
    }
    gauge = nextGauge;
  };

  const finish = (): SimulationResult | null => {
    if (
      forcedLiquidationRecoveryRemainingSeconds > 0 &&
      forcedLiquidationAwaitingManualCounter
    ) {
      gauge = Math.max(-98, Math.min(98, gauge));
      return null;
    }
    if (
      (usesSavageMechanics || isUltimate) &&
      enemySupportProfile.includes('capital_reversal') &&
      !usedEnemySupportSkills.has('capital_reversal') &&
      gauge <= 100 - CAPITAL_REVERSAL_BALANCE.triggerPlayerOwnership * 2
    ) {
      gauge = 100 - CAPITAL_REVERSAL_BALANCE.triggerPlayerOwnership * 2;
      return null;
    }
    if (
      (usesSavageMechanics || isUltimate) &&
      enemySupportProfile.includes('forced_liquidation') &&
      usedEnemySupportSkills.has('capital_reversal') &&
      !usedEnemySupportSkills.has('forced_liquidation') &&
      gauge <= 100 - FORCED_LIQUIDATION_BALANCE.triggerPlayerOwnership * 2
    ) {
      gauge = 100 - FORCED_LIQUIDATION_BALANCE.triggerPlayerOwnership * 2;
      return null;
    }
    if (gauge <= -100) {
      if (capitalReversalRemainingSeconds > 0) {
        gauge = -98;
        return null;
      }
      if (shouldHoldCruelVictory(isCruel, cruelPhase)) {
        gauge = -98;
        return null;
      }
      if (
        shouldForceUltimateCriticalBeforeVictory({
          isUltimate,
          terminalWinner: 'player',
          criticalSkillId: enemySupportAutoProfile.critical,
          criticalSkillUsed:
            !!enemySupportAutoProfile.critical &&
            usedEnemySupportSkills.has(enemySupportAutoProfile.critical),
          gateConsumed: ultimateCriticalGateConsumed,
          enemyReserve,
          enemyBudget,
        })
      ) {
        ultimateCriticalGateConsumed = true;
        gauge = -98;
        return null;
      }
      return {
        winner: 'player',
        wallSeconds,
        directActions,
        supportActions,
        limitBreakActions,
        manualOpeningActions,
        finalOwnership: (100 - gauge) / 2,
        enemySupportActivations,
        maximumPlayerRecoveryRatio,
        maximumEnemyRecoveryRatio,
        minimumEnemyReserve,
        liquidityCloseoutSeconds:
          liquidityCloseoutActiveSince === null
            ? null
            : wallSeconds - liquidityCloseoutActiveSince,
        finishAction: lastPlayerCapitalAction,
        enemyBossDefenseTier,
        enemyBudget,
        enemyDifficultyLevel: enemyDifficulty,
        enemySupportAutoProfile,
        networkSupportLimit,
        ultimateAppraisalEnabled: isUltimate,
        ultimateLimitBreakUseLimit: isUltimate ? 1 : null,
        ultimateCriticalGateEnabled: isUltimate,
        enemyBossDefenseActivations,
        enemyBossDefenseAbsorbedGauge,
        timedCapitalBuffActivations,
        cruelSecondSignatureInvested,
        cruelSecondStartOwnership,
        ...(scenario.captureForcedLiquidationNoCounter
          ? { forcedLiquidationNoCounterSnapshot }
          : {}),
      };
    }
    if (!isTraining && gauge >= 100) {
      return {
        winner: 'opponent',
        wallSeconds,
        directActions,
        supportActions,
        limitBreakActions,
        manualOpeningActions,
        finalOwnership: 0,
        enemySupportActivations,
        maximumPlayerRecoveryRatio,
        maximumEnemyRecoveryRatio,
        minimumEnemyReserve,
        liquidityCloseoutSeconds:
          liquidityCloseoutActiveSince === null
            ? null
            : wallSeconds - liquidityCloseoutActiveSince,
        finishAction: null,
        enemyBossDefenseTier,
        enemyBudget,
        enemyDifficultyLevel: enemyDifficulty,
        enemySupportAutoProfile,
        networkSupportLimit,
        ultimateAppraisalEnabled: isUltimate,
        ultimateLimitBreakUseLimit: isUltimate ? 1 : null,
        ultimateCriticalGateEnabled: isUltimate,
        enemyBossDefenseActivations,
        enemyBossDefenseAbsorbedGauge,
        timedCapitalBuffActivations,
        cruelSecondSignatureInvested,
        cruelSecondStartOwnership,
        ...(scenario.captureForcedLiquidationNoCounter
          ? { forcedLiquidationNoCounterSnapshot }
          : {}),
      };
    }
    if (isTraining) gauge = Math.min(gauge, 98);
    return null;
  };

  const resolveEnemySupportImpact = (
    skill: EnemySupportSkillId
  ) => {
    if (skill === 'blackest_night') {
      enemyBlackestNightRemainingSeconds =
        BLACKEST_NIGHT_BALANCE.durationMs / 1_000;
      enemyBlackestNightCapacity = BLACKEST_NIGHT_BALANCE.gaugeCapacity;
    } else if (skill === 'drain') {
      const transfer = resolveEnemyDrainTransfer({
        playerCash,
        enemyReserve,
        marketPrice,
      });
      playerCash = transfer.playerCash;
      enemyReserve = transfer.enemyReserve;
    } else if (skill === 'drill') {
      const impact = getEnemyDrillImpact({
        enemyBudget,
        isSavage: usesSavageMechanics,
        isUltimate,
        isCruel,
      });
      if (enemyReserve >= impact.reserveCost) {
        enemyReserve -= impact.reserveCost;
        applyEnemyGaugeCandidate(gauge + impact.gaugeDelta);
      }
    } else if (skill === 'divination') {
      divinationRemainingSeconds =
        getEnemyDivinationDurationMs({
          isSavage: usesSavageMechanics,
          isUltimate,
          isCruel,
        }) / 1_000;
    } else if (skill === 'rapid_assault') {
      rapidAssaultRemainingSeconds =
        ENEMY_SUPPORT_SKILL_BALANCE.rapidAssault.durationMs / 1_000;
    } else if (skill === 'limit_break_3') {
      if (
        scenario.playerPassageOnLimitBreak &&
        playerPassageRemainingSeconds <= 0 &&
        playerPassageCapacity <= 0
      ) {
        playerPassageRemainingSeconds =
          TACTICAL_SKILL_BALANCE.cover.durationMs / 1_000;
        playerPassageCapacity = TACTICAL_SKILL_BALANCE.cover.gaugeCapacity;
      }
      const capitalSupport = Math.min(
        enemyReserve,
        Math.round(
          marketPrice *
            ENEMY_SUPPORT_SKILL_BALANCE.limitBreak3.capitalSupportRatio
        )
      );
      enemyReserve -= capitalSupport;
      enemyInvested += capitalSupport;
      applyEnemyGaugeCandidate(
        gauge + ENEMY_SUPPORT_SKILL_BALANCE.limitBreak3.gaugeDelta
      );
      enemyLimitBreakHoldRemainingSeconds =
        ENEMY_SUPPORT_SKILL_BALANCE.limitBreak3.momentumHoldMs / 1_000;
    } else if (skill === 'capital_reversal') {
      capitalReversalRemainingSeconds =
        CAPITAL_REVERSAL_BALANCE.durationMs / 1_000;
    } else if (skill === 'forced_liquidation') {
      const currentPlayerOwnership = (100 - gauge) / 2;
      applyEnemyGaugeCandidate(
        gauge + calculateForcedLiquidationGaugeDelta(currentPlayerOwnership)
      );
      forcedLiquidationRecoveryRemainingSeconds =
        getForcedLiquidationSimulationGraceMs(scenario) / 1_000;
      forcedLiquidationAwaitingManualCounter = true;
      if (scenario.captureForcedLiquidationNoCounter) {
        forcedLiquidationActionCountAtImpact = directActions + supportActions;
      }
      commandProgress = 100;
    } else if (skill === 'omnicapitalization') {
      const ownership = (100 - gauge) / 2;
      gauge = 100 - resolveCruelFirstImpact(ownership) * 2;
      cruelPhase = 'recovery';
      cruelRecoverySeconds = 0;
    } else if (skill === 'cruel_reckoning') {
      const ownership = (100 - gauge) / 2;
      const result = resolveCruelSecondImpact(
        ownership,
        cruelSecondSignatureInvested,
        marketPrice
      );
      gauge = 100 - result.ownershipAfter * 2;
      if (result.outcome === 'break') {
        enemyInvested *= 1 - CRUEL_SCRIPTED_BATTLE.bossBreakCapitalRatio;
        enemyReserve = 0;
        cruelPhase = 'resolved';
      } else {
        cruelSecondFailurePending = true;
        cruelPhase = 'second_failed';
      }
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

    let interactiveCruelCountdown = false;
    if (pendingEnemySupport) {
      pendingEnemySupport.impactRemainingSeconds -= STEP_SECONDS;
      pendingEnemySupport.completeRemainingSeconds -= STEP_SECONDS;
      if (
        !pendingEnemySupport.impacted &&
        pendingEnemySupport.impactRemainingSeconds <= 0
      ) {
        pendingEnemySupport.impacted = true;
        resolveEnemySupportImpact(pendingEnemySupport.skill);
        if (!cruelSecondFailurePending) {
          const terminal = finish();
          if (terminal) return terminal;
        }
      }
      if (pendingEnemySupport.completeRemainingSeconds <= 0) {
        pendingEnemySupport = null;
        if (cruelSecondFailurePending) {
          cruelSecondFailurePending = false;
          const terminal = finish();
          if (terminal) return terminal;
        }
      }
      interactiveCruelCountdown = !!(
        pendingEnemySupport &&
        !pendingEnemySupport.impacted &&
        (pendingEnemySupport.skill === 'omnicapitalization' ||
          pendingEnemySupport.skill === 'cruel_reckoning') &&
        pendingEnemySupport.impactRemainingSeconds >
          ENEMY_SUPPORT_PRESENTATION[pendingEnemySupport.skill].castSeconds
      );
      if (!interactiveCruelCountdown) continue;
    }

    if (presentationLockSeconds > 0) {
      presentationLockSeconds = Math.max(
        0,
        presentationLockSeconds - STEP_SECONDS
      );
      if (
        scenario.modelFullNormalPresentation &&
        presentationAllowsCommandRecharge
      ) {
        commandProgress = Math.min(100, commandProgress + 2.8);
      }
      continue;
    }

    enemyBossDefenseRemainingSeconds = Math.max(
      0,
      enemyBossDefenseRemainingSeconds - STEP_SECONDS
    );
    if (enemyBossDefenseRemainingSeconds <= 0) {
      if (
        enemyActiveBossDefenseTier === 'invincible' &&
        BOSS_COVER_BALANCE.invincible.followupDurationMs > 0
      ) {
        enemyActiveBossDefenseTier = 'enhanced_cover';
        enemyActiveBossDefenseBalance = {
          durationMs: BOSS_COVER_BALANCE.invincible.followupDurationMs,
          absorbRatio: BOSS_COVER_BALANCE.enhancedCover.absorbRatio,
          gaugeCapacity:
            BOSS_COVER_BALANCE.invincible.followupGaugeCapacity,
          counterCapitalRatio: 0,
        };
        enemyBossDefenseRemainingSeconds =
          BOSS_COVER_BALANCE.invincible.followupDurationMs / 1_000;
        enemyBossDefenseCapacity =
          BOSS_COVER_BALANCE.invincible.followupGaugeCapacity;
      } else {
        enemyBossDefenseCapacity = 0;
        enemyActiveBossDefenseBalance = null;
        enemyActiveBossDefenseTier = 'none';
      }
    }

    if (divinationRemainingSeconds > 0) {
      divinationRemainingSeconds = Math.max(
        0,
        divinationRemainingSeconds - STEP_SECONDS
      );
    }
    if (enemyBlackestNightRemainingSeconds > 0) {
      enemyBlackestNightRemainingSeconds = Math.max(
        0,
        enemyBlackestNightRemainingSeconds - STEP_SECONDS
      );
      if (enemyBlackestNightRemainingSeconds <= 0) {
        enemyBlackestNightCapacity = 0;
      }
    }
    capitalReversalRemainingSeconds = Math.max(
      0,
      capitalReversalRemainingSeconds - STEP_SECONDS
    );
    forcedLiquidationRecoveryRemainingSeconds = Math.max(
      0,
      forcedLiquidationRecoveryRemainingSeconds - STEP_SECONDS
    );
    if (playerPassageRemainingSeconds > 0) {
      playerPassageRemainingSeconds = Math.max(
        0,
        playerPassageRemainingSeconds - STEP_SECONDS
      );
      if (playerPassageRemainingSeconds <= 0) {
        playerPassageCapacity = 0;
      }
    }
    if (rapidAssaultRemainingSeconds > 0) {
      rapidAssaultRemainingSeconds = Math.max(
        0,
        rapidAssaultRemainingSeconds - STEP_SECONDS
      );
    }
    if (enemyLimitBreakHoldRemainingSeconds > 0) {
      enemyLimitBreakHoldRemainingSeconds = Math.max(
        0,
        enemyLimitBreakHoldRemainingSeconds - STEP_SECONDS
      );
    }
    if (timedCapitalBuffRemainingSeconds > 0) {
      timedCapitalBuffRemainingSeconds = Math.max(
        0,
        timedCapitalBuffRemainingSeconds - STEP_SECONDS
      );
    }

    if (cruelPhase === 'awaiting_first') {
      cruelActiveSeconds += STEP_SECONDS;
    } else if ((cruelPhase as CruelScriptPhase) === 'recovery') {
      cruelRecoverySeconds += STEP_SECONDS;
    }
    const currentCruelOwnership = (100 - gauge) / 2;
    const cruelAction = shouldTriggerCruelFirstPhase({
      isCruel,
      phase: cruelPhase,
      activeElapsedMs: cruelActiveSeconds * 1_000,
    })
      ? CRUEL_SCRIPTED_BATTLE.firstActionId
      : shouldTriggerCruelSecondPhase({
            phase: cruelPhase,
            currentPlayerOwnership: currentCruelOwnership,
            recoveryElapsedMs: cruelRecoverySeconds * 1_000,
          })
        ? CRUEL_SCRIPTED_BATTLE.secondActionId
        : null;
    if (cruelAction && !pendingEnemySupport) {
      if (cruelAction === CRUEL_SCRIPTED_BATTLE.secondActionId) {
        cruelSecondSignatureInvested = 0;
        cruelSecondStartOwnership = currentCruelOwnership;
      }
      cruelPhase =
        cruelAction === CRUEL_SCRIPTED_BATTLE.firstActionId
          ? 'first_countdown'
          : 'second_countdown';
      commandProgress = 100;
      const presentation = ENEMY_SUPPORT_PRESENTATION[cruelAction];
      const impactRemainingSeconds =
        presentation.telegraphSeconds + presentation.castSeconds;
      pendingEnemySupport = {
        skill: cruelAction,
        impactRemainingSeconds,
        completeRemainingSeconds:
          impactRemainingSeconds +
          presentation.impactSeconds +
          presentation.afterglowSeconds +
          presentation.leavingSeconds,
        impacted: false,
      };
      enemySupportActivations[cruelAction] += 1;
      continue;
    }

    const playerOwnership = (100 - gauge) / 2;
    const bossGuardNeedsPriority =
      !!enemyBossDefenseBalance &&
      !enemyBossDefenseUsed &&
      playerOwnership >=
        BOSS_COVER_BALANCE.triggerPlayerOwnership - 5;
    if (
      (!isCruel ||
        (cruelPhase as CruelScriptPhase) === 'resolved') &&
      forcedLiquidationRecoveryRemainingSeconds <= 0 &&
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
        if (candidate === 'blackest_night') {
          return shouldEnemyUseBlackestNight({
            playerOwnership,
            terminal: false,
          });
        }
        if (candidate === 'capital_reversal') {
          return playerOwnership >= CAPITAL_REVERSAL_BALANCE.triggerPlayerOwnership;
        }
        if (candidate === 'forced_liquidation') {
          return playerOwnership >= FORCED_LIQUIDATION_BALANCE.triggerPlayerOwnership;
        }
        if (candidate === 'drain') {
          return aiCycle >= 1 || playerOwnership >= 52;
        }
        if (candidate === 'drill') {
          return (
            commandProgress >= 100 &&
            (aiCycle >= 2 || playerOwnership >= 58) &&
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
      cumulativeCapRatio: scenario.playerRecoveryCapRatio,
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
      cumulativeCapRatio:
        ENEMY_SUPPORT_SKILL_BALANCE.cashRecovery.passiveRecoveryCapRatio,
    });
    enemyReserve = enemyRecovery.availableFunds;
    enemyRecovered = enemyRecovery.cumulativeRecovered;
    maximumEnemyRecoveryRatio = Math.max(
      maximumEnemyRecoveryRatio,
      enemyBudget > 0 ? enemyRecovered / enemyBudget : 0
    );

    const livePlayerPressureVelocity = calculateGaugeVelocity(
      playerInvested,
      enemyInvested,
      marketPrice
    );
    const campaignNetworkFinisherActive =
      campaignNetworkFinisherArmed && livePlayerPressureVelocity < 0;
    const onboardingLiquidityCloseoutLocked =
      !isTraining &&
      !isHighEndRaid &&
      !isExtremeBattle &&
      getLimitBreakTier((scenario.supportSources?.length ?? 0) + 1) === 0 &&
      (
        campaignNetworkFinisherActive ||
        isNormalPlayerLiquidityCloseoutActive({
          playerOwnership: (100 - gauge) / 2,
          enemyReserve,
          enemyMinimumCommitment: getEnemyMinimumCommitment(marketPrice),
          velocity: livePlayerPressureVelocity,
        })
      );

    if (
      commandProgress >= 100 &&
      reactionDelaySeconds <= 0 &&
      !onboardingLiquidityCloseoutLocked
    ) {
      if (campaignNetworkFinisherArmed) {
        campaignNetworkFinisherArmed = false;
      }
      const manualCapitalBoostRatio = Math.max(
        0,
        scenario.manualCapitalBoostRatio ?? 0
      );
      if (!manualCapitalBoostUsed && manualCapitalBoostRatio > 0) {
        forcedLiquidationAwaitingManualCounter = false;
        manualCapitalBoostUsed = true;
        manualOpeningActions += 1;
        const amount = Math.round(marketPrice * manualCapitalBoostRatio);
        playerInvested += amount;
        earnedLimitBreakCharge += calculateLimitBreakChargeGain(
          amount,
          marketPrice
        );
        commandProgress = 0;
        lastPlayerAction = 'SYNERGY';
        presentationLockSeconds = 1.8;
        reactionDelaySeconds = getScenarioReactionDelay(
          scenario,
          seed,
          directActions + supportActions + manualOpeningActions
        );
        const terminal = finish();
        if (terminal) return terminal;
        continue;
      }

      const manualAllianceSupportRatio = Math.max(
        0,
        scenario.manualAllianceSupportRatio ?? 0
      );
      if (!manualAllianceSupportUsed && manualAllianceSupportRatio > 0) {
        forcedLiquidationAwaitingManualCounter = false;
        manualAllianceSupportUsed = true;
        manualOpeningActions += 1;
        const amount = Math.round(marketPrice * manualAllianceSupportRatio);
        playerInvested += amount;
        earnedLimitBreakCharge += calculateLimitBreakChargeGain(
          amount,
          marketPrice
        );
        commandProgress = 0;
        lastPlayerAction = 'ALLIANCE';
        presentationLockSeconds = 0.23;
        reactionDelaySeconds = getScenarioReactionDelay(
          scenario,
          seed,
          directActions + supportActions + manualOpeningActions
        );
        const terminal = finish();
        if (terminal) return terminal;
        continue;
      }

      const cruelSignaturePending =
        isCruel &&
        (cruelPhase as CruelScriptPhase) === 'second_countdown' &&
        cruelSecondSignatureInvested <
          calculateCruelSignatureRequirement(marketPrice);
      const timedCapitalBuff = scenario.timedCapitalBuff;
      if (
        timedCapitalBuff &&
        !timedCapitalBuffUsed &&
        !cruelSignaturePending &&
        directActions >= timedCapitalBuff.triggerAfterDirectActions &&
        supportActions >=
          (timedCapitalBuff.triggerAfterSupportActions ?? 0)
      ) {
        const releasedForcedLiquidationCounter =
          forcedLiquidationAwaitingManualCounter;
        forcedLiquidationAwaitingManualCounter = false;
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
        if (releasedForcedLiquidationCounter) {
          const terminal = finish();
          if (terminal) return terminal;
        }
        continue;
      }
      const playerCapitalMultiplier =
        timedCapitalBuffRemainingSeconds > 0
          ? scenario.timedCapitalBuff?.multiplier ?? 1
          : 1;
      const preparedLimitBreak = scenario.preparedLimitBreak;
      if (
        preparedLimitBreak &&
        !preparedLimitBreakUsed &&
        !cruelSignaturePending &&
        directActions >=
          (preparedLimitBreak.triggerAfterDirectActions ?? 0) &&
        supportActions >= preparedLimitBreak.triggerAfterSupportActions &&
        (
          !scenario.requireChargedLimitBreak ||
          earnedLimitBreakCharge >= preparedLimitBreak.tier * 100
        ) &&
        (
          !enemyBossDefenseBalance ||
          (enemyBossDefenseUsed && enemyBossDefenseRemainingSeconds <= 0)
        )
      ) {
        forcedLiquidationAwaitingManualCounter = false;
        preparedLimitBreakUsed = true;
        const amount = calculateLimitBreakAmount(
          marketPrice,
          [...preparedLimitBreak.participants],
          preparedLimitBreak.tier,
          supportUseCounts
        );
        preparedLimitBreak.participants.forEach((property) => {
          supportUseCounts[property.id] =
            (supportUseCounts[property.id] ?? 0) + 1;
        });
        playerInvested += amount;

        const emergencyDefense = Math.min(
          enemyReserve,
          Math.round(amount * 0.45)
        );
        enemyReserve -= emergencyDefense;
        enemyInvested += emergencyDefense;
        minimumEnemyReserve = Math.min(minimumEnemyReserve, enemyReserve);
        const enemyCapitalMultiplier =
          divinationRemainingSeconds > 0
            ? ENEMY_SUPPORT_SKILL_BALANCE.divination
                .enemyInvestmentMultiplier
            : 1;
        const counterShock = Math.min(
          10,
          (
            1.5 +
            (emergencyDefense / Math.max(1, marketPrice)) * 18
          ) * enemyCapitalMultiplier
        );
        const ownershipPush = calculateLimitBreakOwnershipPush(
          amount,
          marketPrice,
          preparedLimitBreak.tier,
          playerCapitalMultiplier
        );
        applyPlayerGaugeCandidate(
          gauge - ownershipPush * 2 + counterShock
        );
        // Keep the global action-limit audit honest without conflating the LB
        // with another network request.
        directActions += 1;
        limitBreakActions += 1;
        commandProgress = 0;
        lastPlayerAction = 'LIMIT_BREAK';
        lastPlayerCapitalAction = 'LIMIT_BREAK';
        presentationLockSeconds = 2.4;
        presentationAllowsCommandRecharge = false;
        reactionDelaySeconds = getScenarioReactionDelay(
          scenario,
          seed,
          directActions + supportActions + manualOpeningActions
        );
        const terminal = finish();
        if (terminal) return terminal;
        continue;
      }
      const preferDirectInvestment =
        directActions < (scenario.preferDirectInvestmentActions ?? 0);
      const supportSource = cruelSignaturePending || preferDirectInvestment ||
        supportActions >= networkSupportLimit
        ? undefined
        : scenario.supportSources?.[supportActions];
      const supportThreshold =
        scenario.supportAfterDirectActions?.(supportActions, seed) ??
        Number.POSITIVE_INFINITY;

      if (supportSource && directActions >= supportThreshold) {
        forcedLiquidationAwaitingManualCounter = false;
        const previousSupportUses = supportActions;
        const previousPlayerInvested = playerInvested;
        const amount = Math.round(
          calculateSubsidiarySupportAmount(
            supportSource,
            previousSupportUses
          ) *
            (previousSupportUses === 0 &&
            !isTraining &&
            !isHighEndRaid &&
            !isExtremeBattle
              ? campaignEncounterDefinition?.firstNetworkSupportMultiplier ?? 1
              : 1) *
            (isHighEndRaid
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
        earnedLimitBreakCharge += calculateLimitBreakChargeGain(
          amount,
          marketPrice
        );
        applyPlayerGaugeCandidate(gauge - impact);
        supportUseCounts[supportSource.id] =
          (supportUseCounts[supportSource.id] ?? 0) + 1;
        supportActions += 1;
        if (
          previousSupportUses === 0 &&
          campaignEncounterDefinition?.firstNetworkFinisher === true
        ) {
          campaignNetworkFinisherArmed = true;
        }
        commandProgress = 0;
        lastPlayerAction = 'FUNDS';
        lastPlayerCapitalAction = 'FUNDS';
        presentationLockSeconds = scenario.modelFullNormalPresentation
          ? buildCapitalStackTimeline({
              id: `audit-support-${supportActions}`,
              side: 'player',
              source: 'support',
              previousCapital: previousPlayerInvested,
              nextCapital: playerInvested,
              marketPrice,
              intensity:
                amount / Math.max(marketPrice, 1) >= 0.14 &&
                previousSupportUses < 3
                  ? 'heavy'
                  : 'standard',
              seed: supportActions,
            }).frames.reduce(
              (total, frame) => total + frame.durationMs,
              0
            ) / 1_000
          : 0.23;
        presentationAllowsCommandRecharge =
          scenario.modelFullNormalPresentation;
      } else {
        const investment =
          scenario.allowDirectInvestment === false
            ? null
            : getAffordableInvestment(playerCash, marketPrice);
        if (investment) {
          forcedLiquidationAwaitingManualCounter = false;
          const amount = Math.max(
            10,
            Math.round(marketPrice * investment.ratio)
          );
          playerCash -= amount;
          playerInvested += amount;
          earnedLimitBreakCharge += calculateLimitBreakChargeGain(
            amount,
            marketPrice
          );
          if (
            isCruel &&
            (cruelPhase as CruelScriptPhase) === 'second_countdown'
          ) {
            cruelSecondSignatureInvested += amount;
          }
          const intendedGaugeImpact = calculateDirectInvestmentGaugeImpact({
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
          });
          if (capitalReversalRemainingSeconds > 0) {
            const reversal = resolveCapitalReversal(intendedGaugeImpact / 2);
            applyPlayerGaugeCandidate(gauge + reversal.gaugeDelta);
            capitalReversalRemainingSeconds = 0;
          } else {
            applyPlayerGaugeCandidate(gauge - intendedGaugeImpact);
          }
          directActions += 1;
          commandProgress = 0;
          lastPlayerAction = investment.action;
          lastPlayerCapitalAction = investment.action;
          presentationLockSeconds =
            getCapitalCommitTiming(
              investment.level,
              !scenario.modelFullNormalPresentation
            ).totalMs / 1_000;
          presentationAllowsCommandRecharge =
            scenario.modelFullNormalPresentation;
        }
      }

      reactionDelaySeconds = getScenarioReactionDelay(
        scenario,
        seed,
        directActions + supportActions + manualOpeningActions
      );
      const terminal = finish();
      if (terminal) return terminal;
      if (presentationLockSeconds > 0) continue;
    }

    if (
      !isTraining &&
      !pendingEnemySupport &&
      enemyReserve >= getEnemyMinimumCommitment(marketPrice)
    ) {
      const enemyOwnership = Math.round(((100 + gauge) / 2) / 5) * 5;
      const enemyReservePercent =
        enemyBudget > 0 ? (enemyReserve / enemyBudget) * 100 : 0;
      const enemyCapitalMultiplier =
        (divinationRemainingSeconds > 0
          ? ENEMY_SUPPORT_SKILL_BALANCE.divination
              .enemyInvestmentMultiplier
          : 1) *
        ((cruelPhase as CruelScriptPhase) === 'recovery'
          ? CRUEL_SCRIPTED_BATTLE.recoveryEnemyPressureMultiplier
          : 1);
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
          earnedLimitBreakCharge += calculateLimitBreakChargeGain(
            actual * enemyCapitalMultiplier,
            marketPrice
          );
          const enemyGaugeShock = Math.min(
            10,
            (
              1.5 +
              (actual / Math.max(1, marketPrice)) * 18
            ) *
              enemyCapitalMultiplier
          );
          applyEnemyGaugeCandidate(gauge + enemyGaugeShock);
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
            ((divinationRemainingSeconds > 0
              ? ENEMY_SUPPORT_SKILL_BALANCE.divination
                  .enemyInvestmentMultiplier
              : 1) *
              ((cruelPhase as CruelScriptPhase) === 'recovery'
                ? CRUEL_SCRIPTED_BATTLE.recoveryEnemyPressureMultiplier
                : 1))
      ) /
      Math.max(1, marketPrice);
    const leverage = 1 + Math.min(2.4, gapRatio * 3.2);
    const deadZone = gapRatio < 0.025 ? 0.32 : 1;
    const continuousSynergyGaugePushPerSecond =
      timedCapitalBuffRemainingSeconds > 0
        ? scenario.timedCapitalBuff?.continuousGaugePushPerSecond ?? 0
        : 0;
    const rawVelocity = applyTrainingGaugeSpeed(
      calculateGaugeVelocity(
        playerInvested *
          (
            timedCapitalBuffRemainingSeconds > 0
              ? scenario.timedCapitalBuff?.multiplier ?? 1
              : 1
          ),
        enemyInvested *
          ((divinationRemainingSeconds > 0
            ? ENEMY_SUPPORT_SKILL_BALANCE.divination
                .enemyInvestmentMultiplier
            : 1) *
            ((cruelPhase as CruelScriptPhase) === 'recovery'
              ? CRUEL_SCRIPTED_BATTLE.recoveryEnemyPressureMultiplier
              : 1)),
        marketPrice,
        1 + (scenario.influenceBonus ?? 0)
      ) *
        resolveBattleGaugeSpeedFactor({
          isTraining,
          isHighEndRaid,
        }) *
        leverage *
        deadZone -
        continuousSynergyGaugePushPerSecond,
      isTraining
    );
    const enemyMinimumCommitment =
      getEnemyMinimumCommitment(marketPrice);
    const liquidityCloseoutActive =
      !isTraining &&
      !isHighEndRaid &&
      !isExtremeBattle &&
      isNormalPlayerLiquidityCloseoutActive({
        playerOwnership: (100 - gauge) / 2,
        enemyReserve,
        enemyMinimumCommitment,
        velocity: rawVelocity,
      });
    if (liquidityCloseoutActive) {
      liquidityCloseoutActiveSince ??= wallSeconds;
    } else {
      liquidityCloseoutActiveSince = null;
    }
    const closingAdjustedVelocity = applyNormalClosingMomentum({
      velocity: rawVelocity,
      gauge,
      isTraining,
      isHighEndRaid,
      enemyReserve: isExtremeBattle
        ? Number.POSITIVE_INFINITY
        : enemyReserve,
      enemyMinimumCommitment,
    });
    const limitAdjustedVelocity =
      enemyLimitBreakHoldRemainingSeconds > 0
        ? Math.max(0, closingAdjustedVelocity)
        : closingAdjustedVelocity;
    const forcedLiquidationAdjustedVelocity =
      resolveForcedLiquidationContinuousVelocity({
      velocity: limitAdjustedVelocity,
      recoveryRemaining: forcedLiquidationRecoveryRemainingSeconds,
      awaitingManualCounter: forcedLiquidationAwaitingManualCounter,
    });
    if (
      scenario.captureForcedLiquidationNoCounter &&
      !forcedLiquidationNoCounterSnapshot &&
      forcedLiquidationActionCountAtImpact !== null &&
      forcedLiquidationRecoveryRemainingSeconds <= 0 &&
      forcedLiquidationAwaitingManualCounter
    ) {
      forcedLiquidationNoCounterSnapshot = {
        actionCountAtImpact: forcedLiquidationActionCountAtImpact,
        actionCountAtExpiry: directActions + supportActions,
        awaitingManualCounter: true,
        rawVelocity: limitAdjustedVelocity,
        appliedVelocity: forcedLiquidationAdjustedVelocity,
      };
    }
    const velocity = resolveCruelRecoveryContinuousVelocity({
      velocity: forcedLiquidationAdjustedVelocity,
      isCruel,
      phase: cruelPhase,
    });
    const nextGauge = gauge + velocity * STEP_SECONDS;
    if (velocity < 0) {
      applyPlayerGaugeCandidate(nextGauge);
    } else {
      applyEnemyGaugeCandidate(nextGauge);
    }

    const terminal = finish();
    if (terminal) return terminal;
  }

  return {
    winner: isUltimate ? 'opponent' : 'timeout',
    wallSeconds,
    directActions,
    supportActions,
    limitBreakActions,
    manualOpeningActions,
    finalOwnership: (100 - gauge) / 2,
    enemySupportActivations,
    maximumPlayerRecoveryRatio,
    maximumEnemyRecoveryRatio,
    minimumEnemyReserve,
    liquidityCloseoutSeconds:
      liquidityCloseoutActiveSince === null
        ? null
        : wallSeconds - liquidityCloseoutActiveSince,
    finishAction: null,
    enemyBossDefenseTier,
    enemyBudget,
    enemyDifficultyLevel: enemyDifficulty,
    enemySupportAutoProfile,
    networkSupportLimit,
    ultimateAppraisalEnabled: isUltimate,
    ultimateLimitBreakUseLimit: isUltimate ? 1 : null,
    ultimateCriticalGateEnabled: isUltimate,
    enemyBossDefenseActivations,
    enemyBossDefenseAbsorbedGauge,
    timedCapitalBuffActivations,
    cruelSecondSignatureInvested,
    cruelSecondStartOwnership,
    ...(scenario.captureForcedLiquidationNoCounter
      ? { forcedLiquidationNoCounterSnapshot }
      : {}),
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
      totals.blackest_night +=
        result.enemySupportActivations.blackest_night;
      totals.drain += result.enemySupportActivations.drain;
      totals.drill += result.enemySupportActivations.drill;
      totals.divination +=
        result.enemySupportActivations.divination;
      totals.rapid_assault +=
        result.enemySupportActivations.rapid_assault;
      totals.limit_break_3 +=
        result.enemySupportActivations.limit_break_3;
      totals.capital_reversal +=
        result.enemySupportActivations.capital_reversal;
      totals.forced_liquidation +=
        result.enemySupportActivations.forced_liquidation;
      totals.omnicapitalization +=
        result.enemySupportActivations.omnicapitalization;
      totals.cruel_reckoning +=
        result.enemySupportActivations.cruel_reckoning;
      return totals;
    },
    createEnemySupportActivationCounts()
  );
  const profile = scenario.disableEnemySupport
    ? []
    : getEnemySupportSkillProfile({
        targetProperty: scenario.target,
        isCityBoss: scenario.isCityBoss ?? false,
        isSavage: scenario.isSavage || scenario.isPhantom,
        isUltimate: scenario.isUltimate,
        isCruel: scenario.isCruel,
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
    limitBreakFinishes: results.filter(
      (result) => result.finishAction === 'LIMIT_BREAK'
    ).length,
    networkFinishes: results.filter(
      (result) => result.finishAction === 'FUNDS'
    ).length,
    liquidityCloseoutActivations: results.filter(
      (result) => result.liquidityCloseoutSeconds !== null
    ).length,
    maximumLiquidityCloseoutSeconds: Math.max(
      0,
      ...results.map((result) => result.liquidityCloseoutSeconds ?? 0)
    ),
    p90SupportActions: percentile(
      results.map((result) => result.supportActions),
      0.9
    ),
    minimumManualOpeningActions: Math.min(
      ...results.map((result) => result.manualOpeningActions)
    ),
    maximumManualOpeningActions: Math.max(
      ...results.map((result) => result.manualOpeningActions)
    ),
    maximumSeconds: Math.max(...results.map((result) => result.wallSeconds)),
    maximumCapitalActions: Math.max(
      ...results.map(
        (result) =>
          result.directActions +
          result.supportActions +
          result.manualOpeningActions
      )
    ),
    activations,
    bossDefenseTier: results[0]?.enemyBossDefenseTier ?? 'none',
    enemyBudget: results[0]?.enemyBudget ?? 0,
    enemyDifficultyLevel: results[0]?.enemyDifficultyLevel ?? 0,
    enemySupportAutoProfile:
      results[0]?.enemySupportAutoProfile ?? {
        opening: null,
        critical: null,
      },
    networkSupportLimit:
      results[0]?.networkSupportLimit ?? Number.POSITIVE_INFINITY,
    ultimateAppraisalEnabled:
      results[0]?.ultimateAppraisalEnabled ?? false,
    ultimateLimitBreakUseLimit:
      results[0]?.ultimateLimitBreakUseLimit ?? null,
    ultimateCriticalGateEnabled:
      results[0]?.ultimateCriticalGateEnabled ?? false,
    allRuleSnapshotsStable: results.every(
      (result) =>
        result.enemyBudget === results[0]?.enemyBudget &&
        result.enemyDifficultyLevel === results[0]?.enemyDifficultyLevel &&
        result.networkSupportLimit === results[0]?.networkSupportLimit &&
        result.ultimateAppraisalEnabled ===
          results[0]?.ultimateAppraisalEnabled &&
        result.ultimateLimitBreakUseLimit ===
          results[0]?.ultimateLimitBreakUseLimit &&
        result.ultimateCriticalGateEnabled ===
          results[0]?.ultimateCriticalGateEnabled &&
        result.enemySupportAutoProfile.opening ===
          results[0]?.enemySupportAutoProfile.opening &&
        result.enemySupportAutoProfile.critical ===
          results[0]?.enemySupportAutoProfile.critical
    ),
    openingBossDefenseTier: getOpeningBossAbilityTier({
      targetProperty: scenario.target,
      isSavage: scenario.isSavage || scenario.isPhantom,
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
    medianCruelSecondSignatureRatio: percentile(
      results.map(
        (result) =>
          result.cruelSecondSignatureInvested / Math.max(1, scenario.target.marketPrice)
      ),
      0.5
    ),
    medianCruelSecondStartOwnership: percentile(
      results.map((result) => result.cruelSecondStartOwnership ?? 0),
      0.5
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

const starterFarm = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_starter_farm'
)!;
const limsaTransport = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_land_transport'
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
const cruelSanityTarget = buildCruelProperty(false, '決定論監査商会');
const useProgressionSupport = (supportIndex: number, seed: number) =>
  2 + supportIndex * 2 + (seed % 2);
const useHighDifficultySupport = () => 0;
const useSavageSupport = (supportIndex: number) =>
  supportIndex < 4 ? 0 : Math.floor((supportIndex - 4) / 4) + 1;
const progressionSynergyBurst = (synergyId: string) => {
  const synergy = INITIAL_GROUP_SYNERGIES.find(
    (candidate) => candidate.id === synergyId
  );
  const effect = synergy?.battleEffect;
  assert.equal(effect?.kind, 'timed_capital_buff');
  return {
    triggerAfterDirectActions: 0,
    durationSeconds: effect.durationMs / 1_000,
    multiplier: effect.capitalPressureMultiplier,
    ownershipPush: effect.ownershipPush,
    continuousGaugePushPerSecond:
      effect.continuousGaugePushPerSecond ?? 0,
    limitBreakChargeMultiplier:
      effect.limitBreakChargeMultiplier ?? 1,
  };
};
const crystalBravesBurst = progressionSynergyBurst('CRYSTAL_BRAVES');
const lightOfHopeBurst = progressionSynergyBurst('LIGHT_OF_HOPE');
const grandCompanyEorzeaBurst = progressionSynergyBurst(
  'GRAND_COMPANY_EORZEA'
);
const eraWindBurst = progressionSynergyBurst('ERA_WIND_SYNERGY');
const ultimateGrandCompanyEorzeaBurst = {
  ...grandCompanyEorzeaBurst,
  // Three Savage upgrades (+0.06) and full integration (+0.07).
  multiplier: Number((grandCompanyEorzeaBurst.multiplier + 0.13).toFixed(2)),
} as const;

const normalScenarios = [
  {
    id: 'gridania_first',
    target: starterFarm,
    isTutorial: true,
    modelFullNormalPresentation: true,
  },
  {
    id: 'gridania_boss_with_network_support',
    target: gridaniaBoss,
    influenceBonus: 0.03,
    supportSources: [starterFarm],
    // The first real contact becomes the player's first callable network in
    // the second (boss) fight. No retired business is granted in the background.
    supportAfterDirectActions: () => 3,
    modelFullNormalPresentation: true,
  },
  {
    id: 'gridania_boss_without_network_support',
    target: gridaniaBoss,
    influenceBonus: 0.03,
  },
  {
    id: 'normal_mid_kugane',
    target: kuganeOrdinaryTarget,
    maxSeconds: 600,
    supportSources: [ishgardWeaponDealer, gridaniaBoss],
    supportAfterDirectActions: useProgressionSupport,
    timedCapitalBuff: lightOfHopeBurst,
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

/**
 * Explicit first-two-city cadence probes stay outside the historical fixed
 * 500-battle matrix so adding coverage does not silently weaken any later
 * difficulty sample.
 */
const earlyNormalCadenceReports = [
  summarize(
    {
      id: 'limsa_first_with_network_support',
      target: limsaTransport,
      influenceBonus: 0.03,
      supportSources: [gridaniaBoss],
      supportAfterDirectActions: () => 1,
      modelFullNormalPresentation: true,
    },
    8,
    2_600
  ),
  summarize(
    {
      id: 'limsa_boss_limit_break_finish',
      target: limsaBoss,
      isCityBoss: true,
      influenceBonus: 0.03,
      supportSources: [limsaTransport, gridaniaBoss, starterFarm],
      supportAfterDirectActions: () => 2,
      preferDirectInvestmentActions: 3,
      preparedLimitBreak: {
        tier: 1,
        triggerAfterDirectActions: 3,
        triggerAfterSupportActions: 3,
        participants: [limsaTransport, gridaniaBoss, starterFarm],
      },
      requireChargedLimitBreak: true,
      modelFullNormalPresentation: true,
    },
    8,
    2_700
  ),
];

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
    supportSources: [starterFarm],
    supportAfterDirectActions: useProgressionSupport,
  },
  {
    id: 'city_2_limsa_display',
    target: limsaBoss,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [limsaTransport, gridaniaBoss, starterFarm],
    supportAfterDirectActions: useProgressionSupport,
  },
  {
    id: 'city_3_uldah_display',
    target: uldahBoss,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [
      uldahIronMine,
      limsaTransport,
      limsaBoss,
      gridaniaBoss,
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
    timedCapitalBuff: crystalBravesBurst,
  },
  {
    id: 'city_5_kugane_cover',
    target: kuganeTradeBroker,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [ishgardBoss, uldahBoss],
    supportAfterDirectActions: useProgressionSupport,
    timedCapitalBuff: lightOfHopeBurst,
  },
  {
    id: 'city_6_crystarium_blackest_night',
    target: crystariumBoss,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [kuganeTradeBroker, ishgardWeaponDealer],
    supportAfterDirectActions: useProgressionSupport,
    timedCapitalBuff: lightOfHopeBurst,
  },
  {
    id: 'city_7_old_sharlayan_drain',
    target: oldSharlayanBoss,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [crystariumBoss, kuganeTradeBroker],
    supportAfterDirectActions: useProgressionSupport,
    timedCapitalBuff: lightOfHopeBurst,
  },
  {
    id: 'city_8_radz_at_han_drain_drill',
    target: radzAtHanBoss,
    isCityBoss: true,
    maxSeconds: 600,
    supportSources: [oldSharlayanBoss, crystariumBoss],
    supportAfterDirectActions: useProgressionSupport,
    timedCapitalBuff: lightOfHopeBurst,
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
    id: 'city_10_solution_nine_blackest_night_divination',
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
const preparedUltimateSupportRotation = [...INITIAL_PROPERTIES].sort(
  (left, right) =>
    calculateSubsidiarySupportAmount(right) -
    calculateSubsidiarySupportAmount(left)
);
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
    // Shared network fatigue makes later ally calls a supplement rather than a
    // complete solution. Audit a prepared clear with a finite 35% personal war
    // chest so direct investment and support decisions both matter.
    playerBaselineCash: Math.round(
      target.marketPrice * (index % 4 === 3 ? 0.55 : 0.35)
    ),
    // A prepared Savage route equips the already-learned Passé. The first
    // layer uses it manually; after 1-1 the same action may occupy opening AUTO.
    openingPlayerPassage: index < 4,
    // From the second series onward, save the once-per-battle Passé for the
    // authored LB3 hit instead of spending it in the opener.
    playerPassageOnLimitBreak: index >= 4,
    openingCapitalBoostRatio:
      TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio,
    openingAllianceSupportRatio: ALLIANCE_SUPPORT_MARKET_RATIO,
    supportSources: highDifficultySupportRotation,
    // A low-cash normal-clear save must be able to open with its holdings.
    // Requiring three personal buys before the first ally call made the
    // simulator test an impossible route rather than the in-game support plan.
    supportAfterDirectActions: useSavageSupport,
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

/**
 * Human-readiness matrix kept outside the fixed 500-battle regression total.
 * Each route changes one major factor so tuning can distinguish insufficient
 * preparation, ignored cash recovery, and slow command decisions.
 */
const savageHumanReadinessReports = savageScenarios.flatMap(
  (preparedScenario, index) => {
    const target = preparedScenario.target;
    const auditSeed = 7_500 + index * 30;
    const shared = {
      ...preparedScenario,
      maxSeconds: 180,
    } satisfies SimulationScenario;
    return [
      summarize(
        {
          ...shared,
          id: `${preparedScenario.id}_unprepared`,
          playerBaselineCash: Math.round(target.marketPrice * 0.1),
          openingCapitalBoostRatio: undefined,
          openingAllianceSupportRatio: undefined,
          openingPlayerPassage: false,
          playerPassageOnLimitBreak: false,
          timedCapitalBuff: undefined,
          preparedLimitBreak: undefined,
        },
        5,
        auditSeed
      ),
      summarize(
        {
          ...shared,
          id: `${preparedScenario.id}_no_recovery`,
          playerRecoveryCapRatio: 0,
        },
        5,
        auditSeed + 10
      ),
      summarize(
        {
          ...shared,
          id: `${preparedScenario.id}_careless`,
          reactionDelayExtraSeconds: 2,
        },
        5,
        auditSeed + 20
      ),
    ];
  }
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
/**
 * Historical deterministic baseline. These two opening ratios predate the
 * command-lane audit and intentionally remain here only to keep the fixed
 * 500-battle campaign sample comparable with earlier reports.
 */
const ultimateFreePreloadScenarioBase = {
  id: 'ultimate_pattern_base',
  target: ultimateSanityTarget,
  isUltimate: true,
  maxSeconds: ULTIMATE_APPRAISAL_LIMIT_MS / 1000,
  playerBaselineCash: Math.round(
    ultimateSanityTarget.marketPrice * 0.1
  ),
  openingCapitalBoostRatio:
    TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio,
  openingAllianceSupportRatio: ALLIANCE_SUPPORT_MARKET_RATIO,
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
        ...ultimateFreePreloadScenarioBase,
        id: `ultimate_pattern_${pattern.id}`,
        ultimateAutoPatternIndex: patternIndex,
      },
      3,
      9_000 + patternIndex * 100
    )
);
const ultimateLegacyPreparedPatternReports = ULTIMATE_ENEMY_AUTO_PATTERNS.map(
  (pattern, patternIndex) =>
    summarize(
      {
        ...ultimateFreePreloadScenarioBase,
        id: `ultimate_legacy_preload_${pattern.id}`,
        ultimateAutoPatternIndex: patternIndex,
        playerBaselineCash: Math.round(
          ultimateSanityTarget.marketPrice
        ),
        preferDirectInvestmentActions: 4,
        openingPlayerPassage: true,
        timedCapitalBuff: {
          ...eraWindBurst,
          triggerAfterSupportActions: 8,
        },
        // A prepared clear route assigns the eight available contacts to the
        // authored warnings while battle-wide fatigue still applies.
        supportSources: preparedUltimateSupportRotation,
        preparedLimitBreak: {
          tier: 3,
          triggerAfterSupportActions: 8,
          participants: preparedUltimateSupportRotation,
        },
      },
      1,
      9_600 + patternIndex * 10
    )
);

/**
 * Runtime-shaped prepared route. Passage occupies opening AUTO, while
 * ぶんどる and the external alliance each wait for and consume a real command.
 * Their capital is no longer present before the first interactive action.
 */
const ultimateManualPreparedScenarioBase = {
  ...ultimateFreePreloadScenarioBase,
  id: 'ultimate_manual_prepared_base',
  openingCapitalBoostRatio: 0,
  openingAllianceSupportRatio: 0,
  manualCapitalBoostRatio: TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio,
  manualAllianceSupportRatio: ALLIANCE_SUPPORT_MARKET_RATIO,
  playerBaselineCash: ultimateSanityTarget.marketPrice,
  preferDirectInvestmentActions: 4,
  openingPlayerPassage: true,
  timedCapitalBuff: {
    ...eraWindBurst,
    triggerAfterSupportActions: 8,
  },
  supportSources: preparedUltimateSupportRotation,
  preparedLimitBreak: {
    tier: 3,
    triggerAfterSupportActions: 8,
    participants: preparedUltimateSupportRotation,
  },
} as const satisfies SimulationScenario;
const ultimatePreparedPatternReports = ULTIMATE_ENEMY_AUTO_PATTERNS.map(
  (pattern, patternIndex) =>
    summarize(
      {
        ...ultimateManualPreparedScenarioBase,
        id: `ultimate_prepared_manual_${pattern.id}`,
        ultimateAutoPatternIndex: patternIndex,
      },
      5,
      9_700 + patternIndex * 20
    )
);
const ultimateHumanReadinessReports = ULTIMATE_ENEMY_AUTO_PATTERNS.flatMap(
  (pattern, patternIndex) => {
    const preparedScenario: SimulationScenario = {
      ...ultimateManualPreparedScenarioBase,
      id: `ultimate_human_${pattern.id}`,
      ultimateAutoPatternIndex: patternIndex,
    };
    const auditSeed = 10_000 + patternIndex * 20;
    return [
      summarize(
        {
          ...preparedScenario,
          id: `${preparedScenario.id}_no_recovery`,
          playerRecoveryCapRatio: 0,
        },
        5,
        auditSeed
      ),
      summarize(
        {
          ...preparedScenario,
          id: `${preparedScenario.id}_careless`,
          reactionDelayExtraSeconds: 2,
        },
        5,
        auditSeed + 10
      ),
    ];
  }
);
const ultimateSupportDisabledReport = summarize(
  {
    ...ultimateFreePreloadScenarioBase,
    id: 'ultimate_support_disabled',
    disableEnemySupport: true,
  },
  6,
  9_900
);
const ultimateReports = [
  ...ultimatePatternReports,
  ...ultimateLegacyPreparedPatternReports,
  ultimateSupportDisabledReport,
];

/**
 * Phantom is a record-only rematch of one authored Savage layer. These
 * probes deliberately stay outside the historical fixed 500-battle matrix:
 * they verify the orthogonal ruleset rather than rebalance its sample sizes.
 */
const PHANTOM_SAMPLE_COUNT_PER_LAYER = 3;
const PHANTOM_MAX_SECONDS = 240;
const phantomScenarios: SimulationScenario[] = savageProperties.map(
  (target, index) => ({
    id: `phantom_savage_${Math.floor(index / 4) + 1}_${(index % 4) + 1}`,
    target,
    isPhantom: true,
    maxSeconds: PHANTOM_MAX_SECONDS,
    // A Cruel-cleared company brings the complete command kit and a full
    // market-price war chest, but no Phantom-only progression or reward.
    playerBaselineCash: target.marketPrice,
    preferDirectInvestmentActions: 4,
    openingPlayerPassage: true,
    playerPassageOnLimitBreak: true,
    manualCapitalBoostRatio:
      TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio,
    manualAllianceSupportRatio: ALLIANCE_SUPPORT_MARKET_RATIO,
    supportSources: preparedUltimateSupportRotation,
    supportAfterDirectActions: useHighDifficultySupport,
    timedCapitalBuff: {
      ...ultimateGrandCompanyEorzeaBurst,
      triggerAfterSupportActions: 8,
    },
    preparedLimitBreak: {
      tier: 3,
      triggerAfterSupportActions: 12,
      participants: preparedUltimateSupportRotation,
    },
  })
);
const phantomReports = phantomScenarios.map((scenario, index) =>
  summarize(
    scenario,
    PHANTOM_SAMPLE_COUNT_PER_LAYER,
    12_500 + index * 20
  )
);

// The live Cruel battle receives only normal owned properties from App.tsx.
// Ultimate and Savage records are not callable subsidiaries.
const cruelSupportRotation = preparedUltimateSupportRotation;
assert.equal(cruelSupportRotation.length, 22);
const cruelScenarioBase = {
  target: cruelSanityTarget,
  isCruel: true,
  maxSeconds: 120,
  openingAllianceSupportRatio: ALLIANCE_SUPPORT_MARKET_RATIO,
  supportSources: cruelSupportRotation,
  supportAfterDirectActions: useHighDifficultySupport,
} as const satisfies Omit<SimulationScenario, 'id'>;
const cruelScenarios: SimulationScenario[] = [
  {
    ...cruelScenarioBase,
    id: 'cruel_prepared_conservative_10_percent',
    playerBaselineCash: Math.round(cruelSanityTarget.marketPrice * 0.1),
    openingCapitalBoostRatio:
      TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio,
    timedCapitalBuff: {
      ...ultimateGrandCompanyEorzeaBurst,
      triggerAfterSupportActions: 8,
    },
    preparedLimitBreak: {
      tier: 3,
      triggerAfterSupportActions: 12,
      participants: cruelSupportRotation,
    },
  },
  {
    ...cruelScenarioBase,
    id: 'cruel_prepared_full_cash',
    playerBaselineCash: cruelSanityTarget.marketPrice,
    openingCapitalBoostRatio:
      TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio,
    timedCapitalBuff: {
      ...ultimateGrandCompanyEorzeaBurst,
      triggerAfterSupportActions: 8,
    },
    preparedLimitBreak: {
      tier: 3,
      triggerAfterSupportActions: 12,
      participants: cruelSupportRotation,
    },
  },
  {
    ...cruelScenarioBase,
    id: 'cruel_no_limit_break_full_cash',
    playerBaselineCash: cruelSanityTarget.marketPrice,
    preferDirectInvestmentActions: 2,
    timedCapitalBuff: {
      ...ultimateGrandCompanyEorzeaBurst,
      triggerAfterSupportActions: 8,
    },
  },
  {
    ...cruelScenarioBase,
    id: 'cruel_support_only_full_cash',
    playerBaselineCash: cruelSanityTarget.marketPrice,
    allowDirectInvestment: false,
    timedCapitalBuff: {
      ...ultimateGrandCompanyEorzeaBurst,
      triggerAfterSupportActions: 10,
    },
  },
];
const cruelReports = cruelScenarios.map((scenario, index) =>
  summarize(scenario, 10, 10_500 + index * 100)
);
const cruelHumanReadinessReports = [
  summarize(
    {
      ...cruelScenarios[1],
      id: 'cruel_prepared_no_recovery',
      playerRecoveryCapRatio: 0,
    },
    5,
    11_000
  ),
  summarize(
    {
      ...cruelScenarios[1],
      id: 'cruel_prepared_careless',
      reactionDelayExtraSeconds: 2,
    },
    5,
    11_010
  ),
];
const runtimeAlignmentProbes = {
  drillTelegraphPlayerCover:
    runDrillTelegraphCoverProbe(),
  divinationTelegraphEraWindCancel:
    runDivinationEraWindCancelProbe(),
  forcedLiquidationManualCounter:
    runForcedLiquidationManualCounterProbe(),
  forcedLiquidationNoCounterBattle: simulateBattle(
    {
      id: 'savage_first_fourth_no_counter',
      target: savageProperties[3],
      isSavage: true,
      maxSeconds: 120,
      playerBaselineCash: savageProperties[3].marketPrice * 2.5,
      openingCapitalBoostRatio: 1.25,
      playerRecoveryCapRatio: 0,
      captureForcedLiquidationNoCounter: true,
    },
    12_000
  ),
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
  ...normalReports,
  ...cityReports,
  ...cityEnemySupportDisabledReports,
  ...savageReports,
  ...savageEnemySupportDisabledReports,
  ...ultimateReports,
  ...cruelReports,
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
const phantomProbeBattles = phantomReports.reduce(
  (total, report) => total + report.battles,
  0
);
assert.equal(
  phantomProbeBattles,
  SAVAGE_RAID_DEFINITIONS.length * PHANTOM_SAMPLE_COUNT_PER_LAYER,
  'Phantom samples all twelve authored Savage layers with three seeds each'
);
assert.equal(
  allReports.some((report) => report.id.startsWith('phantom_')),
  false,
  'Phantom probes must remain outside the fixed 500-battle campaign matrix'
);

const reportById = Object.fromEntries(
  allReports.map((report) => [report.id, report])
);
console.log(JSON.stringify({
  ultimateTuningSummary: {
    prepared: ultimatePreparedPatternReports.map((report) => ({
      id: report.id,
      battles: report.battles,
      wins: report.wins,
      medianSeconds: report.medianSeconds,
    })),
    humanReadiness: ultimateHumanReadinessReports.map((report) => ({
      id: report.id,
      battles: report.battles,
      wins: report.wins,
      medianSeconds: report.medianSeconds,
    })),
  },
}, null, 2));
console.log(JSON.stringify({
  totalBattles,
  cruelAudit: {
    totalBattles: cruelReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
    reports: cruelReports,
  },
  cruelHumanReadinessAudit: {
    totalBattles: cruelHumanReadinessReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
    reports: cruelHumanReadinessReports,
  },
  normalProgressionAudit: {
    totalBattles: normalReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
    reports: normalReports,
    earlyCadenceReports: earlyNormalCadenceReports,
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
  savageHumanReadinessAudit: {
    totalBattles: savageHumanReadinessReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
    reports: savageHumanReadinessReports,
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
  ultimateHumanReadinessAudit: {
    totalBattles: ultimateHumanReadinessReports.reduce(
      (total, report) => total + report.battles,
      0
    ),
    reports: ultimateHumanReadinessReports,
  },
  phantomAudit: {
    includedInFixed500: false,
    totalBattles: phantomProbeBattles,
    reports: phantomReports,
  },
  runtimeAlignmentProbes,
}, null, 2));

for (const report of cruelReports) {
  assert.equal(
    report.activations.omnicapitalization,
    report.battles,
    `${report.id} must always reach the first scripted collapse`
  );
  assert.equal(
    report.activations.cruel_reckoning,
    report.battles,
    `${report.id} must always resolve the second recovery check`
  );
}
const conservativeCruelReport =
  reportById.cruel_prepared_conservative_10_percent;
const fullCashCruelReport = reportById.cruel_prepared_full_cash;
const noLimitBreakCruelReport = reportById.cruel_no_limit_break_full_cash;
const supportOnlyCruelReport = reportById.cruel_support_only_full_cash;
const noRecoveryCruelReport = cruelHumanReadinessReports.find(
  (report) => report.id === 'cruel_prepared_no_recovery'
)!;
const carelessCruelReport = cruelHumanReadinessReports.find(
  (report) => report.id === 'cruel_prepared_careless'
)!;
assert.equal(conservativeCruelReport.wins, 10);
assert.equal(
  conservativeCruelReport.medianCruelSecondSignatureRatio,
  CRUEL_SCRIPTED_BATTLE.secondSignatureMarketRatio,
  'the minimum-cash prepared route spends exactly its reserved 10% signature'
);
assert.equal(fullCashCruelReport.wins, 10);
assert.ok(
  fullCashCruelReport.medianSeconds >= 80 &&
    fullCashCruelReport.p90Seconds <= 100,
  'the observed 100%-cash fan route remains an 80-to-100-second Cruel clear'
);
assert.ok(
  fullCashCruelReport.medianCruelSecondSignatureRatio >=
    CRUEL_SCRIPTED_BATTLE.secondSignatureMarketRatio,
  'the full-cash clear must satisfy the second appraisal with direct capital'
);
assert.equal(
  noLimitBreakCruelReport.wins,
  10,
  'a human direct-investment-first route can clear Cruel without a limit break'
);
assert.equal(supportOnlyCruelReport.wins, 0);
assert.equal(
  supportOnlyCruelReport.medianCruelSecondSignatureRatio,
  0,
  'support and SYNERGY cannot masquerade as the direct-capital signature'
);
assert.equal(
  noRecoveryCruelReport.wins,
  noRecoveryCruelReport.battles,
  'a fully prepared direct-capital route may clear without waiting for passive revenue'
);
assert.equal(
  carelessCruelReport.wins,
  0,
  'the ten-second rebuild rejects a prepared route that delays every decision by two seconds'
);
assert.deepEqual(
  runtimeAlignmentProbes.forcedLiquidationManualCounter,
  {
    recoveryRemaining: FORCED_LIQUIDATION_BALANCE.laterSavageRecoveryGraceMs,
    waitingVelocity: 0,
    expiredWaitingPlayerVelocity: 0,
    expiredWaitingEnemyVelocity: 6,
    winnerBeforeManual: null,
    manualCommandConsumed: true,
    awaitingManualCounter: false,
    commandProgress: 0,
    winnerAfterManual: 'player',
  },
  'Forced Liquidation resumes only enemy pressure after expiry until one ready manual command answers it'
);
const forcedLiquidationNoCounterBattle =
  runtimeAlignmentProbes.forcedLiquidationNoCounterBattle;
const forcedLiquidationNoCounterSnapshot =
  forcedLiquidationNoCounterBattle.forcedLiquidationNoCounterSnapshot;
assert.equal(
  forcedLiquidationNoCounterBattle.enemySupportActivations.forced_liquidation,
  1,
  'the no-counter battle probe must reach 強制清算 exactly once'
);
assert.ok(
  forcedLiquidationNoCounterSnapshot,
  'the no-counter battle probe must capture the first expired recovery tick'
);
assert.equal(forcedLiquidationNoCounterSnapshot.awaitingManualCounter, true);
assert.ok(
  forcedLiquidationNoCounterSnapshot.rawVelocity < 0,
  'pre-liquidation committed capital must still favor the player before the gate'
);
assert.equal(
  forcedLiquidationNoCounterSnapshot.appliedVelocity,
  0,
  'pre-liquidation player pressure must remain stopped after grace expiry'
);
assert.equal(
  forcedLiquidationNoCounterSnapshot.actionCountAtImpact,
  forcedLiquidationNoCounterSnapshot.actionCountAtExpiry,
  'no player command may slip into the recovery window'
);
assert.equal(
  forcedLiquidationNoCounterSnapshot.actionCountAtExpiry,
  forcedLiquidationNoCounterBattle.directActions +
    forcedLiquidationNoCounterBattle.supportActions,
  'the battle must end without a post-liquidation counter-command'
);
assert.equal(
  forcedLiquidationNoCounterBattle.directActions +
    forcedLiquidationNoCounterBattle.supportActions,
  8,
  'the probe must exhaust all eight direct actions before 強制清算'
);
assert.equal(forcedLiquidationNoCounterBattle.winner, 'opponent');
assert.equal(forcedLiquidationNoCounterBattle.finalOwnership, 0);
assert.equal(
  getForcedLiquidationSimulationGraceMs({
    id: 'first_savage_grace_probe',
    target: savageProperties[3],
    isSavage: true,
  }),
  FORCED_LIQUIDATION_BALANCE.firstClearRecoveryGraceMs,
  'only the first Savage series keeps the three-second learning grace'
);
assert.equal(
  getForcedLiquidationSimulationGraceMs({
    id: 'later_savage_grace_probe',
    target: savageProperties[7],
    isSavage: true,
  }),
  FORCED_LIQUIDATION_BALANCE.laterSavageRecoveryGraceMs,
  'later Savage series use the 1.4-second execution window'
);
assert.equal(
  getForcedLiquidationSimulationGraceMs({
    id: 'ultimate_grace_probe',
    target: ultimateSanityTarget,
    isUltimate: true,
  }),
  FORCED_LIQUIDATION_BALANCE.ultimateRecoveryGraceMs,
  'Ultimate restores a four-second rebuild window after the forced drop'
);
assert.equal(reportById.gridania_first.wins, 8);
assert.ok(
  reportById.gridania_first.medianDirectActions >= 4 &&
    reportById.gridania_first.medianDirectActions <= 6
);
assert.equal(reportById.gridania_boss_with_network_support.wins, 8);
assert.ok(
  reportById.gridania_boss_with_network_support.medianSupportActions >= 1
);
assert.ok(
  reportById.gridania_boss_with_network_support.medianDirectActions <=
    reportById.gridania_boss_without_network_support.medianDirectActions,
  'the first Gridania network contact adds free capital without requiring another direct investment'
);
assert.ok(
  reportById.gridania_boss_with_network_support.maximumCapitalActions <= 6,
  'the first network lesson stays within one handful of visible commitments'
);
assert.equal(
  reportById.gridania_boss_with_network_support.networkFinishes,
  reportById.gridania_boss_with_network_support.battles,
  'the second fight can end from the first ally stack after the player builds the lead'
);
assert.equal(
  reportById.gridania_boss_with_network_support.medianDirectActions,
  3,
  'the second fight teaches three self-funded stacks before the ally finish'
);
assert.equal(
  reportById.gridania_boss_with_network_support.medianSupportActions,
  1,
  'the first network request is the only ally command needed for the lesson'
);
for (const report of earlyNormalCadenceReports) {
  assert.equal(
    report.wins,
    report.battles,
    `${report.id} must remain a deterministic first-clear victory`
  );
  assert.ok(
    report.medianDirectActions >= 1 &&
      report.medianDirectActions <= 5 &&
      report.medianSupportActions >= 1 &&
      report.medianSupportActions <= 3 &&
    report.medianDirectActions + report.medianSupportActions >= 3 &&
      report.medianDirectActions + report.medianSupportActions <= 7,
    `${report.id} should resolve in one short handful of meaningful commands`
  );
  assert.ok(
    report.p90Seconds <= 40,
    `${report.id} keeps the full normal pile cadence without a long post-action stall`
  );
}
const limsaFirstCadence = earlyNormalCadenceReports.find(
  (report) => report.id === 'limsa_first_with_network_support'
)!;
assert.ok(
  limsaFirstCadence.liquidityCloseoutActivations > 0 &&
    limsaFirstCadence.liquidityCloseoutActivations <= limsaFirstCadence.battles,
  'ordinary progression may sweep only in deterministic seeds where the rival actually runs dry'
);
assert.ok(
  limsaFirstCadence.maximumLiquidityCloseoutSeconds <= 6.5,
  'the visible liquidity sweep resolves before passive recovery funds another commitment'
);
const firstLimitBreakCadence = earlyNormalCadenceReports.find(
  (report) => report.id === 'limsa_boss_limit_break_finish'
)!;
assert.equal(
  firstLimitBreakCadence.limitBreakFinishes,
  firstLimitBreakCadence.battles,
  'the fourth authored fight supports a direct → network → LB I finishing route'
);
assert.equal(
  firstLimitBreakCadence.medianDirectActions,
  4,
  'the fourth fight uses three direct investments and one LB command'
);
assert.equal(
  firstLimitBreakCadence.medianSupportActions,
  3,
  'the fourth fight gives all three unlocked allies a visible stack before LB I'
);
assert.equal(
  reportById.city_8_radz_at_han_drain_drill.timedCapitalBuffActivations,
  reportById.city_8_radz_at_han_drain_drill.battles,
  'Light of Hope remains available before Grand Company Eorzea replaces it'
);
for (const id of [
  'normal_late_solution_nine',
  'city_9_tuliyollal_divination',
  'city_10_solution_nine_blackest_night_divination',
] as const) {
  assert.equal(
    reportById[id].timedCapitalBuffActivations,
    reportById[id].battles,
    `${id} can use Grand Company Eorzea after Radz-at-Han`
  );
}

const savageAutoSkillsByReportId = new Map(
  savageReports.map((report, index) => {
    const profile = SAVAGE_ENEMY_AUTO_PROFILES[Math.floor(index / 4)][index % 4];
    return [
      report.id,
      new Set<EnemySupportSkillId>(
        [profile.opening, profile.critical].filter(Boolean)
      ),
    ] as const;
  })
);
const ultimateAutoSkillsByReportId = new Map(
  [
    ...ultimatePatternReports,
    ...ultimateLegacyPreparedPatternReports,
    ...ultimatePreparedPatternReports,
  ].map(
    (report, index) => {
      const pattern =
        ULTIMATE_ENEMY_AUTO_PATTERNS[
          index % ULTIMATE_ENEMY_AUTO_PATTERNS.length
        ];
      return [
        report.id,
        new Set<EnemySupportSkillId>([
          pattern.opening,
          pattern.critical,
        ]),
      ] as const;
    }
  )
);

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
    'blackest_night',
    'drain',
    'drill',
    'divination',
    'rapid_assault',
    'limit_break_3',
    'capital_reversal',
    'forced_liquidation',
  ] as const) {
    if (
      report.profile.includes(skill) ||
      savageAutoSkillsByReportId.get(report.id)?.has(skill) ||
      ultimateAutoSkillsByReportId.get(report.id)?.has(skill)
    ) {
      assert.ok(
        report.activations[skill] <= report.battles,
        `${report.id} must not activate configured ${skill} more than once per battle`
      );
    } else {
      assert.equal(
        report.activations[skill],
        0,
        `${report.id} must not activate unconfigured ${skill}`
      );
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
  ...normalReports,
  ...cityReports,
  ...cityEnemySupportDisabledReports,
  ...cruelReports,
]) {
  assert.equal(
    report.timeouts,
    0,
    `${report.id} should resolve within its deterministic normal-difficulty audit window`
  );
}

for (const report of [
  ...normalReports,
  ...cityReports,
  ...cruelReports,
]) {
  assert.ok(
    report.p90Seconds < 130,
    `${report.id} should keep its p90 near two minutes even after Blackest Night`
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
  ['drain'],
  ['blackest_night'],
  ['blackest_night', 'rapid_assault'],
  ['blackest_night'],
  ['drain'],
  ['drain', 'drill'],
  ['divination'],
  ['blackest_night', 'divination'],
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
  const seriesIndex = Math.floor(index / 4);
  const expectedTier =
    layer === 1
      ? 'cover'
      : layer < 4
        ? 'enhanced_cover'
        : 'invincible';
  const expectedProfile = SAVAGE_ENEMY_SUPPORT_PROFILES[seriesIndex][layer - 1];
  assert.equal(report.bossDefenseTier, expectedTier);
  assert.equal(
    report.openingBossDefenseTier,
    layer === 2 ? 'cover' : 'none',
    `${report.id} uses guaranteed opening Cover only on layer two`
  );
  assert.deepEqual(report.profile, expectedProfile);
  if (layer >= 3) {
    assert.equal(
      report.activations.capital_reversal,
      report.battles,
      `${report.id} must teach 資本反転 exactly once after the 55% gate`
    );
  }
  if (layer === 4) {
    assert.equal(
      report.activations.forced_liquidation,
      report.battles,
      `${report.id} must resolve 強制清算 exactly once after 資本反転`
    );
  }
  const expectedAuto = SAVAGE_ENEMY_AUTO_PROFILES[seriesIndex][layer - 1];
  if (expectedAuto.opening) {
    assert.equal(
      report.activations[expectedAuto.opening],
      report.battles,
      `${report.id} presents its authored opening action exactly once per run`
    );
  }
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

for (let seriesIndex = 0; seriesIndex < 3; seriesIndex += 1) {
  const seriesReports = savageReports.slice(seriesIndex * 4, seriesIndex * 4 + 4);
  for (let layerIndex = 1; layerIndex < seriesReports.length; layerIndex += 1) {
    const previous = seriesReports[layerIndex - 1];
    const current = seriesReports[layerIndex];
    assert.ok(
      current.p90Seconds > previous.p90Seconds,
      `Savage series ${seriesIndex + 1} p90 rises from layer ${layerIndex} (${previous.p90Seconds.toFixed(2)}s) to layer ${layerIndex + 1} (${current.p90Seconds.toFixed(2)}s)`
    );
  }
}

assert.equal(phantomScenarios.length, SAVAGE_RAID_DEFINITIONS.length);
assert.equal(phantomReports.length, SAVAGE_RAID_DEFINITIONS.length);
phantomReports.forEach((report, index) => {
  const scenario = phantomScenarios[index];
  const definition = SAVAGE_RAID_DEFINITIONS[index];
  const seriesIndex = definition.series - 1;
  const layerIndex = definition.layer - 1;
  const expectedProfile =
    SAVAGE_ENEMY_SUPPORT_PROFILES[seriesIndex][layerIndex];
  const expectedAuto =
    SAVAGE_ENEMY_AUTO_PROFILES[seriesIndex][layerIndex];
  const expectedBossTier =
    definition.layer === 1
      ? 'cover'
      : definition.layer < 4
        ? 'enhanced_cover'
        : 'invincible';
  const ultimateBaseBudget = calculateEnemyBudget({
    targetProperty: scenario.target,
    industryInfluence: NO_INFLUENCE,
    regionalInfluence: NO_INFLUENCE,
    isTutorial: false,
    isSavage: false,
    isUltimate: true,
    isCruel: false,
    isCityBoss: false,
  });
  const savageBudget = calculateEnemyBudget({
    targetProperty: scenario.target,
    industryInfluence: NO_INFLUENCE,
    regionalInfluence: NO_INFLUENCE,
    isTutorial: false,
    isSavage: true,
    isUltimate: false,
    isCruel: false,
    isCityBoss: false,
  });

  assert.equal(report.targetId, definition.id);
  assert.equal(report.battles, PHANTOM_SAMPLE_COUNT_PER_LAYER);
  assert.equal(
    report.wins + report.losses + report.timeouts,
    report.battles,
    `${report.id} must account for every Phantom sample`
  );
  assert.equal(
    report.allWallTimesFinite,
    true,
    `${report.id} must execute only finite positive wall times`
  );
  assert.equal(
    report.allRuleSnapshotsStable,
    true,
    `${report.id} must retain one deterministic Phantom ruleset across seeds`
  );
  assert.equal(
    report.timeouts,
    0,
    `${report.id} must resolve without an Ultimate appraisal timeout`
  );
  assert.ok(
    (scenario.maxSeconds ?? 0) > ULTIMATE_APPRAISAL_LIMIT_MS / 1_000,
    `${report.id} must not inherit the 108-second Ultimate appraisal limit`
  );
  assert.ok(
    report.maximumSeconds < PHANTOM_MAX_SECONDS,
    `${report.id} must resolve inside the independent Phantom audit window`
  );
  assert.deepEqual(
    report.profile,
    expectedProfile,
    `${report.id} must retain its authored Savage support profile`
  );
  assert.deepEqual(
    report.enemySupportAutoProfile,
    expectedAuto,
    `${report.id} must retain its authored Savage AUTO instead of an Ultimate pattern`
  );
  assert.equal(report.bossDefenseTier, expectedBossTier);
  assert.equal(
    report.openingBossDefenseTier,
    definition.layer === 2 ? 'cover' : 'none',
    `${report.id} must retain the authored Savage opening defense`
  );
  assert.equal(
    report.enemyBudget,
    ultimateBaseBudget,
    `${report.id} must use Ultimate-equivalent base capital`
  );
  assert.notEqual(
    report.enemyBudget,
    savageBudget,
    `${report.id} must not fall back to the layer-scaled Savage budget`
  );
  assert.equal(
    report.enemyDifficultyLevel,
    6,
    `${report.id} must use Ultimate-equivalent decision speed`
  );
  assert.equal(
    report.networkSupportLimit,
    SAVAGE_NETWORK_SUPPORT_LIMIT,
    `${report.id} must keep the Savage eighteen-call network limit`
  );
  assert.equal(report.ultimateAppraisalEnabled, false);
  assert.equal(report.ultimateLimitBreakUseLimit, null);
  assert.equal(report.ultimateCriticalGateEnabled, false);
  assert.equal(
    getForcedLiquidationSimulationGraceMs(scenario),
    definition.series === 1
      ? FORCED_LIQUIDATION_BALANCE.firstClearRecoveryGraceMs
      : FORCED_LIQUIDATION_BALANCE.laterSavageRecoveryGraceMs,
    `${report.id} must retain its Savage forced-liquidation recovery window`
  );

  if (expectedAuto.opening) {
    assert.equal(
      report.activations[expectedAuto.opening],
      report.battles,
      `${report.id} must execute its authored Savage opening AUTO once per sample`
    );
  }
  if (definition.layer >= 3) {
    assert.equal(
      report.activations.capital_reversal,
      report.battles,
      `${report.id} must retain the Savage capital-reversal gate`
    );
  }
  if (definition.layer === 4) {
    assert.equal(
      report.activations.forced_liquidation,
      report.battles,
      `${report.id} must retain the Savage forced-liquidation gate`
    );
  }

  const configuredSkills = new Set<EnemySupportSkillId>([
    ...expectedProfile,
    ...[expectedAuto.opening, expectedAuto.critical].filter(
      (skill): skill is EnemySupportSkillId => skill !== null
    ),
  ]);
  for (const skill of Object.keys(
    createEnemySupportActivationCounts()
  ) as EnemySupportSkillId[]) {
    if (!configuredSkills.has(skill)) {
      assert.equal(
        report.activations[skill],
        0,
        `${report.id} must not inject unconfigured Ultimate action ${skill}`
      );
    }
  }
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
    ['blackest_night', 'drain', 'drill', 'divination', 'capital_reversal', 'forced_liquidation']
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
  assert.ok(
    report.activations[pattern.critical] + report.losses >= report.battles,
    `${report.id} presents its selected critical action unless the opening action already defeats the player`
  );
  for (const special of [
    'rapid_assault',
    'limit_break_3',
  ] as const) {
    const expectedActivations =
      pattern.opening === special
        ? report.battles
        : pattern.critical === special
          ? report.activations[pattern.critical]
          : 0;
    assert.equal(
      report.activations[special],
      expectedActivations,
      `${report.id} must fire only the special action selected for that attempt`
    );
  }
  assert.equal(report.timeouts, 0);
  assert.ok(
    report.p90Seconds <= ULTIMATE_APPRAISAL_LIMIT_MS / 1000 + STEP_SECONDS,
    `${report.id} resolves at or before the two-minute Ultimate appraisal`
  );
  assert.ok(
    report.p90DirectActions + report.p90SupportActions < 30,
    `${report.id} resolves before thirty investment actions`
  );
  assert.ok(
    report.timedCapitalBuffActivations + report.losses >= report.battles,
    `${report.id} evaluates Grand Company Eorzea unless the opening surprise already defeats the unprepared route`
  );
  ultimatePatternWins += report.wins;
});
const ultimatePatternBattles = ultimatePatternReports.reduce(
  (total, report) => total + report.battles,
  0
);
assert.ok(
  ultimatePatternWins <= Math.floor(ultimatePatternBattles * 0.4),
  'an unadapted repeated-support route may solve the two defensive patterns, but loses most Ultimate attempts'
);
assert.ok(
  ultimatePatternReports
    .filter((_, index) => {
      const pattern = ULTIMATE_ENEMY_AUTO_PATTERNS[index];
      return (
        pattern.opening === 'limit_break_3' ||
        pattern.critical === 'limit_break_3'
      );
    })
    .every((report) => report.losses === report.battles),
  'an unadapted repeated-support route cannot survive any Ultimate LB3 surprise'
);
assert.equal(
  ultimatePreparedPatternReports.length,
  ULTIMATE_ENEMY_AUTO_PATTERNS.length
);
const ultimatePreparedWins = ultimatePreparedPatternReports.reduce(
  (total, report) => total + report.wins,
  0
);
const ultimatePreparedBattles = ultimatePreparedPatternReports.reduce(
  (total, report) => total + report.battles,
  0
);
const ultimatePreparedWinRate =
  ultimatePreparedWins / Math.max(1, ultimatePreparedBattles);
assert.ok(
  ultimatePreparedPatternReports.every(
    (report) =>
      report.battles >= 5 &&
      report.minimumManualOpeningActions === 2 &&
      report.maximumManualOpeningActions === 2
  ),
  'every prepared Ultimate pattern must sample multiple seeds and execute ぶんどる plus external alliance through the command lane'
);
assert.ok(
  ultimatePreparedWinRate >= 0.25 && ultimatePreparedWinRate <= 0.4,
  `the runtime-shaped prepared Ultimate route must clear 25-40% of attempts (actual ${(ultimatePreparedWinRate * 100).toFixed(1)}%)`
);
const ultimateNoRecoveryReports = ultimateHumanReadinessReports.filter(
  (report) => report.id.endsWith('_no_recovery')
);
const ultimateCarelessReports = ultimateHumanReadinessReports.filter(
  (report) => report.id.endsWith('_careless')
);
const ultimateNoRecoveryWins = ultimateNoRecoveryReports.reduce(
  (total, report) => total + report.wins,
  0
);
const ultimateCarelessWins = ultimateCarelessReports.reduce(
  (total, report) => total + report.wins,
  0
);
const ultimateCarelessBattles = ultimateCarelessReports.reduce(
  (total, report) => total + report.battles,
  0
);
assert.equal(
  ultimateNoRecoveryWins,
  0,
  'disabling passive recovery must defeat every runtime-shaped prepared Ultimate sample'
);
assert.ok(
  ultimateCarelessWins / Math.max(1, ultimateCarelessBattles) <= 0.2,
  'adding two seconds to every prepared command must keep Ultimate clears at or below 20%'
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
  durationMs: 18_000,
  absorbRatio: 0.84,
  gaugeCapacity: 58,
  counterCapitalRatio: 0.06,
});
assert.deepEqual(BOSS_COVER_BALANCE.enhancedCover, {
  durationMs: 16_000,
  absorbRatio: 0.92,
  gaugeCapacity: 84,
  counterCapitalRatio: 0.12,
});
assert.deepEqual(BOSS_COVER_BALANCE.invincible, {
  durationMs: 5_000,
  absorbRatio: 1,
  gaugeCapacity: Number.POSITIVE_INFINITY,
  counterCapitalRatio: 0.18,
  followupDurationMs: 6_000,
  followupGaugeCapacity: 44,
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

// Deterministic post-Ultimate mechanic probes stay outside the 500-run
// campaign sample: they lock authored transitions rather than sample RNG.
const cruelSimulationTarget = buildCruelProperty(false, '検証商会');
assert.equal(
  getEnemyDifficultyLevel(
    cruelSimulationTarget,
    false,
    false,
    false,
    false,
    true
  ),
  6
);
assert.equal(
  getBossAbilityTier({
    targetProperty: cruelSimulationTarget,
    isCityBoss: false,
    isCruel: true,
  }),
  'enhanced_cover'
);
assert.deepEqual(
  getEnemySupportAutoProfile({
    targetProperty: cruelSimulationTarget,
    isCityBoss: false,
    isCruel: true,
  }),
  { opening: 'divination', critical: null }
);
const cruelFirstPhaseProbe = {
  isCruel: true,
  phase: 'awaiting_first' as const,
  activeElapsedMs: 15_000,
};
assert.equal(shouldTriggerCruelFirstPhase(cruelFirstPhaseProbe), true);
assert.equal(
  shouldHoldCruelVictory(true, 'first_countdown'),
  true,
  'overkill stays held until both authored declarations resolve'
);
assert.equal(
  shouldTriggerCruelFirstPhase({
    ...cruelFirstPhaseProbe,
    phase: 'recovery',
  }),
  false,
  'the first declaration cannot fire twice after recovery begins'
);
assert.equal(resolveCruelFirstImpact(100), 10);
assert.equal(resolveCruelFirstImpact(8), 8);
assert.equal(
  shouldTriggerCruelSecondPhase({
    phase: 'recovery',
    currentPlayerOwnership: 50,
    recoveryElapsedMs: 8_000,
  }),
  true
);

// Reacquisition reward-battle probes use the full deterministic battle loop,
// but stay outside the fixed 500-run campaign audit. The player keeps a late
// save's command kit while the target's authored gil value remains untouched.
const buildExtremeProbeProperty = (
  property: Property,
  reacquisitionLevel: 1 | 2
): Property => ({
  ...property,
  owner: 'independent',
  ownerName: '独立勢力',
  reacquisitionLevel,
});
const earlyExtremeTarget = buildExtremeProbeProperty(starterFarm, 1);
const lateExtremeTarget = buildExtremeProbeProperty(solutionNineIndustry, 2);
assert.equal(earlyExtremeTarget.marketPrice, starterFarm.marketPrice);
assert.equal(lateExtremeTarget.marketPrice, solutionNineIndustry.marketPrice);

const extremeReacquisitionScenarios = [
  {
    id: 'extreme_reacquisition_early_grown_player',
    target: earlyExtremeTarget,
    maxSeconds: 120,
    playerBaselineCash: earlyExtremeTarget.marketPrice * 2,
    openingCapitalBoostRatio: TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio,
    supportSources: [starterFarm],
    supportAfterDirectActions: () => 4,
  },
  {
    id: 'extreme_reacquisition_late_grown_player',
    target: lateExtremeTarget,
    maxSeconds: 120,
    playerBaselineCash: lateExtremeTarget.marketPrice * 2,
    openingCapitalBoostRatio: TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio,
    supportSources: [solutionNineBoss],
    supportAfterDirectActions: () => 3,
  },
] as const satisfies readonly SimulationScenario[];
const extremeReacquisitionReports = extremeReacquisitionScenarios.map(
  (scenario, index) => summarize(scenario, 8, 12_000 + index * 100)
);
for (const report of extremeReacquisitionReports) {
  assert.equal(report.wins, report.battles, `${report.id} should be a reward clear`);
  assert.equal(report.timeouts, 0, `${report.id} should never time out`);
  assert.ok(
    report.maximumSeconds < 120,
    `${report.id} should never become a two-minute grind`
  );
  assert.ok(
    report.maximumCapitalActions < 30,
    `${report.id} should never require thirty capital commands`
  );
  assert.ok(
    report.p90DirectActions + report.p90SupportActions <= 8,
    `${report.id} should resolve in a few large calls`
  );
}
const [earlyExtremeReport, lateExtremeReport] = extremeReacquisitionReports;
assert.ok(
  earlyExtremeReport.medianSeconds >= 10 &&
    earlyExtremeReport.medianSeconds <= 25,
  'an early-company 極 should be a short, emphatic grown-player victory'
);
assert.ok(
  lateExtremeReport.medianSeconds >= 20 &&
    lateExtremeReport.medianSeconds <= 40,
  'a late-company 極 should land in the authored twenty-to-forty-second band'
);

// Cruel's phase checks use only active time and ownership. Feint, Passé and
// Living Dead remain useful around the declarations, but phase changes are
// not cancellable actions.
const cruelCriticalPhaseProbes = {
  firstFromFull: resolveCruelFirstImpact(100),
  firstFromLow: resolveCruelFirstImpact(7),
  secondAtThreshold: resolveCruelSecondImpact(
    50,
    calculateCruelSignatureRequirement(cruelSimulationTarget.marketPrice),
    cruelSimulationTarget.marketPrice
  ),
  secondPrepared: resolveCruelSecondImpact(
    75,
    calculateCruelSignatureRequirement(cruelSimulationTarget.marketPrice),
    cruelSimulationTarget.marketPrice
  ),
  secondAlmostPrepared: resolveCruelSecondImpact(
    74,
    calculateCruelSignatureRequirement(cruelSimulationTarget.marketPrice),
    cruelSimulationTarget.marketPrice
  ),
};
assert.equal(cruelCriticalPhaseProbes.firstFromFull, 10);
assert.equal(cruelCriticalPhaseProbes.firstFromLow, 7);
assert.deepEqual(cruelCriticalPhaseProbes.secondAtThreshold, {
  outcome: 'defeat',
  ownershipBefore: 50,
  ownershipAfter: 0,
  ownershipSatisfied: false,
  signatureSatisfied: true,
  signaturePaid: 750_000_000,
  signatureRequired: 750_000_000,
});
assert.deepEqual(cruelCriticalPhaseProbes.secondPrepared, {
  outcome: 'break',
  ownershipBefore: 75,
  ownershipAfter: 75,
  ownershipSatisfied: true,
  signatureSatisfied: true,
  signaturePaid: 750_000_000,
  signatureRequired: 750_000_000,
});
assert.deepEqual(cruelCriticalPhaseProbes.secondAlmostPrepared, {
  outcome: 'defeat',
  ownershipBefore: 74,
  ownershipAfter: 0,
  ownershipSatisfied: false,
  signatureSatisfied: true,
  signaturePaid: 750_000_000,
  signatureRequired: 750_000_000,
}, 'a failed second assessment deterministically loses after its presentation');

console.log(
  JSON.stringify(
    {
      additionalDeterministicProbes: {
        extremeReacquisition: extremeReacquisitionReports,
        cruelCriticalPhase: cruelCriticalPhaseProbes,
      },
    },
    null,
    2
  )
);

assert.equal(
  resolveCruelFirstImpact(82),
  10,
  'Cruel phase damage ignores Cover because it changes the encounter state'
);

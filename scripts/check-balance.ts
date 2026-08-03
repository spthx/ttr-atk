import assert from 'node:assert/strict';
import {
  INITIAL_CARTELS,
  INITIAL_GROUP_SYNERGIES,
  INITIAL_PROPERTIES,
  INITIAL_SKILLS,
} from '../src/data/initialData';
import { ALLIANCE_CANDIDATES, GRAND_COMPANY_NAMES } from '../src/data/allianceData';
import { COMMUNITY_CAMPAIGN_ORDER } from '../src/data/worldData';
import { CAMPAIGN_ENCOUNTER_DEFINITIONS } from '../src/data/campaignEncounterData';
import {
  decideEnemyAction,
  getEnemyBaseWaitMs,
  type EnemyDecisionContext,
} from '../src/utils/enemyAi';
import {
  calculateBattleReadiness,
  calculateBattleSynergyReadinessEquivalent,
} from '../src/utils/battleReadiness';
import {
  applyNormalBattlePropertyUpdates,
  calculateAtLeastOneDepartureProbability,
  calculateBattleSettlementSummary,
  calculateLiquidationCashback,
  getVictoryProfitAllocationChoices,
  normalizeDepartureProbabilityMultiplier,
  resolvePostVictoryLoyalty,
} from '../src/utils/battleSettlement';
import {
  BATTLE_CINEMATIC_TIMING,
  BATTLE_GAUGE_VISUAL_COMMIT_MS,
  BATTLE_CAPITAL_VISUAL_STAGE_COUNT,
  BATTLE_STATE_UPDATE_INTERVAL_MS,
  BATTLE_HIT_STOP_TIMING,
  BATTLE_STATUS_MESSAGE_DURATION_MS,
  advanceEnemySupportTelegraphClock,
  canConfirmBattleResult,
  enqueueBattleStatusMessage,
  getBattleCapitalVisualBundleCount,
  getBattleCapitalOverflowTier,
  getBattleCapitalVisibleUnits,
  getCapitalColumnHeights,
  getCapitalVisibleUnitSequence,
  getMechanicalCapitalColumnFrames,
  getCapitalCommitTiming,
  getCapitalDropParticleCount,
  getCapitalFormationPieceCount,
  getCapitalHoardBandCount,
  getCapitalHoardFillRatios,
  getCapitalStageSequence,
  getNextBattleSkillId,
  resolveBattleSkillSelection,
  getTerminalCinematicPresentation,
  getBattleCinematicLayer,
  getBossEnemyPartySize,
  getCapitalVisualBundleCount,
  getCapitalVisualBundleCountForAmount,
  getCapitalVisualSpriteCount,
  getCapitalVisualStage,
  getCapitalVisualStageForBundleCount,
  getInvestmentStakeVisualPieceCount,
  getBattleHitStopTiming,
  getBattleClockScales,
  isBattleImpactPresentationActive,
  getSkillCinematicEventDecision,
  getSkillCinematicTimelineState,
  getSkillCinematicTiming,
  getVictoryConfettiParticleCount,
  BATTLE_GAUGE_FRAME_MS,
  ENEMY_SUPPORT_POST_PILE_GRACE_MS,
  REDUCED_MOTION_SKILL_CINEMATIC_TIMING,
  MAX_CAPITAL_DROP_PARTICLE_COUNT,
  MAX_BATTLE_CAPITAL_VISUAL_STAGE,
  MAX_BATTLE_CAPITAL_VISIBLE_UNITS,
  normalizeBattleStatusMessageText,
  RESULT_CONFIRM_ARM_DELAY_MS,
  selectBattleStatusMessage,
  SKILL_CINEMATIC_TIMING,
  shouldProcessGaugeFrame,
  shouldInertBattleFooter,
  TERMINAL_CINEMATIC_TIMING,
} from '../src/utils/battlePresentation';
import {
  isPendingBattleTargetAvailable,
  parsePendingBattleSession,
  PENDING_BATTLE_SESSION_MAX_AGE_MS,
  shouldRestorePendingBattleSession,
} from '../src/utils/battleSession';
import { calculateCartelHeadquartersDefense } from '../src/utils/cartel';
import {
  calculateGaugeVelocity,
  calculateRebellionProbability,
} from '../src/utils/formatter';
import {
  getWindPool,
  getWindProgressionStage,
} from '../src/components/WindIndicator';
import {
  calculateOfflineIncome,
  loadLegacyCompanyName,
  loadGameSave,
  normalizeAllianceState,
  normalizeAutoSkillLoadout,
  normalizeSavedAbilityLoadout,
  normalizeLimitBreakCharge,
  restoreProperties,
  saveGame,
  SAVE_STORAGE_KEY,
} from '../src/utils/saveData';
import {
  getCompletedCommunityNetworkIds,
  getCommunityNetworkProgress,
  getCurrentlyControlledCommunityIds,
  getUnlockedCommunityIds,
  hasCompletedCommunityNetwork,
  normalizeConqueredCommunityIds,
  wouldCompleteCommunityNetwork,
} from '../src/utils/campaignProgress';
import { getNormalBattleNavigation } from '../src/utils/progressionNavigation';
import {
  applySavageSynergyUpgrades,
  buildCruelProperty,
  buildUltimateProperty,
  buildSavageProperties,
  getSavagePropertyYieldMultiplier,
  getSavageSynergyRanks,
  getSavageTargetIds,
  getDefaultOpenSavageSeries,
  getUnlockedSavageRaidIds,
  normalizeSavageClearedRaidIds,
  SAVAGE_BATTLE_ONLY_CAPITAL_BONUS_PER_RANK,
  SAVAGE_GROUP_MULTIPLIER_BASE,
  SAVAGE_GROUP_MULTIPLIER_BONUS_PER_RANK,
  SAVAGE_PROPERTY_YIELD_BONUS,
  SAVAGE_RAID_DEFINITIONS,
  SAVAGE_SERIES_DEFINITIONS,
  SAVAGE_YIELD_BONUS_PER_RANK,
  CRUEL_RAID_DEFINITION,
  ULTIMATE_RAID_DEFINITION,
} from '../src/utils/savage';
import {
  calculateCruelEntryRequirement,
  calculateCruelSignatureRequirement,
  resolveCruelFirstImpact,
  resolveCruelRecoveryContinuousVelocity,
  resolveCruelSecondImpact,
  shouldHoldCruelVictory,
  shouldTriggerCruelFirstPhase,
  shouldTriggerCruelSecondPhase,
} from '../src/utils/cruelBattle';
import {
  BLACKEST_NIGHT_BALANCE,
  BATTLE_CONTENT_MANIFEST,
  BATTLE_CONTENT_SCHEMA_VERSION,
  CAPITAL_REVERSAL_BALANCE,
  CRUEL_SCRIPTED_BATTLE,
  ENEMY_SUPPORT_ACTIONS,
  FORCED_LIQUIDATION_BALANCE,
} from '../src/data/battleEncounterData';
import {
  ERA_WIND_SYNERGY_ID,
  GRAND_COMPANY_EORZEA_ID,
  getBattleOnlySynergyMultiplier,
  getLatestProgressionBattleSynergy,
  isGroupSynergyUnlocked,
} from '../src/utils/synergy';
import {
  getSkillUnlockExplanation,
  getSynergyUnlockExplanation,
} from '../src/utils/unlockExplanation';
import {
  calculateAllianceSupport,
  shouldBreakAllianceForTarget,
} from '../src/utils/alliance';
import {
  buildTrainingDummyProperty,
  isTrainingDummyUnlocked,
  TRAINING_DUMMY_DEFINITIONS,
} from '../src/utils/trainingDummy';
import {
  advanceBattleCashRecovery,
  applyBlackestNightToGaugeDelta,
  applyCoverToGaugeDelta,
  applyTrainingGaugeSpeed,
  applyNormalClosingMomentum,
  BOSS_COVER_BALANCE,
  BATTLE_CASH_RECOVERY_RATE_PER_SECOND,
  BATTLE_CASH_RECOVERY_TOTAL_CAP_RATIO,
  BATTLE_CASH_RECOVERY_WIND_MULTIPLIERS,
  BATTLE_GAUGE_SPEED_FACTOR,
  NORMAL_BATTLE_GAUGE_SPEED_FACTOR,
  BATTLE_LOYALTY_BALANCE,
  BATTLE_SUPPORT_BALANCE,
  PROFIT_ALLOCATION_OPTIONS,
  calculateDirectInvestmentGaugeImpact,
  calculateEnemyDrillReserveCost,
  calculateLimitBreakPushGilEquivalent,
  calculateSubsidiarySupportAmount,
  calculateProfitAllocationCost,
  calculateCompanyStrengthScore,
  calculateBattleVictoryReward,
  calculatePlayerBattleCashLimit,
  ENEMY_INITIAL_COMMITMENT_RATIO,
  ENEMY_BALANCE_FACTOR,
  INITIAL_PLAYER_FUNDS,
  INITIAL_BATTLE_COMMAND_PROGRESS,
  PASSIVE_REVENUE_MULTIPLIER,
  PLAYER_BATTLE_CASH_CAP_RATIO,
  resolveBattleGaugeSpeedFactor,
  TACTICAL_SKILL_BALANCE,
  TRAINING_GAUGE_SPEED_MULTIPLIER,
  TRAINING_MIN_OWNERSHIP_PERCENT,
  calculateEnemyBudget,
  calculateEnemyDrainAmount,
  calculateLimitBreakAmount,
  calculateLimitBreakChargeGain,
  consumeLimitBreakCharge,
  calculateOwnershipFromGauge,
  calculateLimitBreakOwnershipAfterDefense,
  calculateLimitBreakOwnershipPush,
  countsTowardCityConquest,
  getCampaignProperties,
  getBossAbilityTier,
  getCoverGuardDisplayPercent,
  HIGH_DIFFICULTY_SUPPORT_MULTIPLIER,
  getBattleCashRecoveryWindMultipliers,
  getCompanyStrengthLevel,
  getEnemyMinimumCommitment,
  getBattleTerminalWinner,
  getChargedLimitBreakTier,
  getLimitBreakChargeCapacity,
  getLimitBreakTier,
  getReacquisitionLevel,
  getExtremeReacquisitionBudgetMultiplier,
  getExtremeReacquisitionOpeningSkill,
  isExtremeReacquisition,
  EXTREME_REACQUISITION_BALANCE,
  getSubsidiaryRiskIncrease,
  getSubsidiarySupportMultiplier,
  holdTrainingGaugeAboveDefeat,
  isNormalCityBoss,
  isSkillUnlocked,
  LIMIT_BREAK_CHARGE_GAIN_MULTIPLIER,
  LIMIT_BREAK_CAPITAL_CAP_RATIOS,
  LIMIT_BREAK_MULTIPLIERS,
  LIMIT_BREAK_OWNERSHIP_CAPS,
  NORMAL_ENEMY_CAMPAIGN_MULTIPLIERS,
  REPEATED_NETWORK_SUPPORT_BALANCE,
  advanceCriticalAutoResolution,
  resolveCriticalAutoInterception,
  resolveLivingDeadOutcome,
  sortSubsidiariesBySupport,
  SAVAGE_ENEMY_BUDGET_MULTIPLIER,
  SAVAGE_ENEMY_DIFFICULTY_LEVELS,
  SAVAGE_LAYER_BUDGET_MULTIPLIERS,
  SAVAGE_SERIES_BUDGET_MULTIPLIERS,
  ULTIMATE_ENEMY_BUDGET_MULTIPLIER,
  getEnemyDifficultyLevel,
  getBlackestNightDarkWaveGaugeDelta,
  getBlackestNightDisplayPercent,
  getEnemyDivinationDurationMs,
  getEnemyDrillImpact,
  getEnemyDrillOwnershipPush,
  getOpeningBossAbilityTier,
  getEnemySupportAutoProfile,
  getEnemySupportSkillProfile,
  getSavageLayerBudgetMultiplier,
  getSavageSeriesBudgetMultiplier,
  getRepeatedNetworkSupportMultiplier,
  canEnemyAffordDrill,
  shouldForceUltimateCriticalBeforeVictory,
  ENEMY_SUPPORT_SKILL_BALANCE,
  ULTIMATE_ENEMY_AUTO_PATTERNS,
  resolveEnemyDrainTransfer,
  resolveCapitalReversal,
  calculateForcedLiquidationGaugeDelta,
  claimBattleSynergyUsage,
  resolveForcedLiquidationContinuousVelocity,
  shouldEnemyUseBlackestNight,
} from '../src/utils/gameBalance';
import {
  advanceBattleWind,
  BATTLE_WIND_ACTIVE_MAX_SECONDS,
  BATTLE_WIND_ACTIVE_MIN_SECONDS,
  BATTLE_WIND_COOLDOWN_SECONDS,
  BATTLE_WIND_INITIAL_CALM_SECONDS,
  BATTLE_WIND_ROLL_INTERVAL_SECONDS,
  BATTLE_WIND_TELEGRAPH_SECONDS,
  createBattleWindState,
  shouldAdvanceBattleWind,
} from '../src/utils/battleWind';

const noInfluence = { enemyBudgetDiscount: 0 };
assert.equal(INITIAL_PLAYER_FUNDS, 20_000);
assert.equal(PLAYER_BATTLE_CASH_CAP_RATIO, 1);
assert.equal(calculatePlayerBattleCashLimit(2_000), 2_000);
const expectedCampaignCounts = [2, 2, 2, 2, 2, 1, 1, 1, 1, 2];
const expectedCampaignTargetIds = [
  ['prop_starter_farm', 'prop_timber_ake'],
  ['prop_land_transport', 'prop_brewery_beer'],
  ['prop_iron_mine', 'prop_casino_grand'],
  ['prop_ranch_1', 'prop_weapon_dealer'],
  ['prop_detective', 'prop_info_broker'],
  ['prop_inn_town'],
  ['prop_wheat_farm'],
  ['prop_security_firm'],
  ['prop_coffee_aurora'],
  ['prop_abyss_heavy', 'prop_abyss_mine'],
] as const;
const expectedStageMaxPrices = [
  15_000,
  60_000,
  800_000,
  700_000,
  1_400_000,
  3_000_000,
  4_500_000,
  5_500_000,
  6_500_000,
  450_000_000,
];

assert.deepEqual(COMMUNITY_CAMPAIGN_ORDER, [
  'グリダニア',
  'リムサ・ロミンサ',
  'ウルダハ',
  'イシュガルド',
  'クガネ',
  'クリスタリウム',
  'オールド・シャーレアン',
  'ラザハン',
  'トライヨラ',
  'ソリューション・ナイン',
]);

assert.equal(getWindProgressionStage(0), 0);
assert.equal(
  getWindProgressionStage(1),
  1,
  'Gridania network completion unlocks the first wind lesson in Limsa'
);
assert.deepEqual(getWindPool(1), ['TAILWIND_PLAYER']);
assert.equal(getWindProgressionStage(2), 2);
assert.ok(getWindPool(2).includes('TAILWIND_ENEMY'));
assert.equal(
  getWindProgressionStage(3),
  2,
  'Ul\'dah and Ishgard add enemy mechanics without adding a new wind rule'
);
assert.equal(
  getWindProgressionStage(5),
  3,
  'Kugane conquest unlocks player headwind and crosswind'
);
assert.ok(getWindPool(3).includes('HEADWIND_PLAYER'));
assert.ok(getWindPool(3).includes('CROSSWIND'));
let battleWind = createBattleWindState();
assert.equal(battleWind.phase, 'grace');
assert.equal(battleWind.windType, 'CALM');
assert.equal(
  battleWind.secondsRemaining,
  BATTLE_WIND_INITIAL_CALM_SECONDS
);
battleWind = advanceBattleWind(
  battleWind,
  BATTLE_WIND_INITIAL_CALM_SECONDS - 0.01,
  getWindPool(3),
  () => 0
);
assert.equal(
  battleWind.phase,
  'grace',
  'battle wind stays CALM for the full opening grace'
);
const deterministicRolls = [0, 0, 0];
battleWind = advanceBattleWind(
  battleWind,
  0.01,
  getWindPool(3),
  () => deterministicRolls.shift() ?? 0
);
assert.equal(battleWind.phase, 'telegraph');
assert.equal(battleWind.windType, 'CALM');
assert.ok(
  Math.abs(battleWind.secondsRemaining - BATTLE_WIND_TELEGRAPH_SECONDS) < 1e-9
);
assert.equal(BATTLE_WIND_TELEGRAPH_SECONDS, 2);
assert.equal(BATTLE_WIND_ACTIVE_MIN_SECONDS, 7);
assert.equal(BATTLE_WIND_ACTIVE_MAX_SECONDS, 9);
const telegraphedWind = battleWind.pendingWindType;
battleWind = advanceBattleWind(
  battleWind,
  BATTLE_WIND_TELEGRAPH_SECONDS,
  getWindPool(3),
  () => 0
);
assert.equal(battleWind.phase, 'active');
assert.equal(battleWind.windType, telegraphedWind);
assert.ok(
  battleWind.secondsRemaining >= BATTLE_WIND_ACTIVE_MIN_SECONDS &&
    battleWind.secondsRemaining <= BATTLE_WIND_ACTIVE_MAX_SECONDS
);
battleWind = advanceBattleWind(
  battleWind,
  battleWind.secondsRemaining,
  getWindPool(3),
  () => 0
);
assert.equal(battleWind.phase, 'cooldown');
assert.equal(battleWind.windType, 'CALM');
assert.equal(battleWind.secondsRemaining, BATTLE_WIND_COOLDOWN_SECONDS);
battleWind = advanceBattleWind(
  battleWind,
  BATTLE_WIND_COOLDOWN_SECONDS,
  getWindPool(3),
  () => 0
);
assert.equal(battleWind.phase, 'waiting');
assert.equal(
  battleWind.secondsRemaining,
  BATTLE_WIND_ROLL_INTERVAL_SECONDS,
  'a new wind roll waits after the full cooldown'
);
assert.equal(shouldAdvanceBattleWind({
  battleActive: false,
  settled: false,
  presentationLocked: false,
  eraWindActive: false,
}), false, 'briefing does not consume battle wind time');
assert.equal(shouldAdvanceBattleWind({
  battleActive: true,
  settled: true,
  presentationLocked: false,
  eraWindActive: false,
}), false, 'results do not consume battle wind time');
assert.equal(shouldAdvanceBattleWind({
  battleActive: true,
  settled: false,
  presentationLocked: false,
  eraWindActive: true,
}), false, '時代の風 pauses random market wind');
const noRepeatWind = advanceBattleWind({
  phase: 'waiting',
  windType: 'CALM',
  pendingWindType: null,
  lastWindType: 'TAILWIND_PLAYER',
  secondsRemaining: BATTLE_WIND_ROLL_INTERVAL_SECONDS,
}, BATTLE_WIND_ROLL_INTERVAL_SECONDS, getWindPool(3), (() => {
  const values = [0, 0];
  return () => values.shift() ?? 0;
})());
assert.equal(noRepeatWind.phase, 'telegraph');
assert.notEqual(noRepeatWind.pendingWindType, 'TAILWIND_PLAYER');
assert.equal(
  shouldInertBattleFooter(true, false, 'finisher_notice'),
  true,
  'the live battle footer remains inert during locked presentations'
);
assert.equal(
  shouldInertBattleFooter(true, true, 'finisher_notice'),
  false,
  'the settled footer must stay interactive so the result analysis can open'
);
assert.equal(RESULT_CONFIRM_ARM_DELAY_MS, 1_200);
assert.equal(
  isBattleImpactPresentationActive(undefined),
  false,
  'battle clocks run when no impact presentation is active'
);
assert.equal(
  isBattleImpactPresentationActive('hitstop'),
  true,
  'the impact hitstop locks every battle clock'
);
assert.equal(
  isBattleImpactPresentationActive('release'),
  true,
  'the impact release keeps every battle clock locked while controls say presentation wait'
);
const heldEnemyTelegraph = advanceEnemySupportTelegraphClock({
  remainingMs: 2_400,
  elapsedMs: 2_208,
  blocked: true,
});
assert.deepEqual(
  heldEnemyTelegraph,
  { remainingMs: 2_400, castDue: false },
  'enemy telegraphs do not consume their warning window during a presentation'
);
const resumedEnemyTelegraph = advanceEnemySupportTelegraphClock({
  remainingMs: heldEnemyTelegraph.remainingMs,
  elapsedMs: 800,
  blocked: false,
});
assert.deepEqual(
  resumedEnemyTelegraph,
  { remainingMs: 1_600, castDue: false },
  'enemy telegraphs resume from the same warning time after a presentation'
);
assert.deepEqual(
  advanceEnemySupportTelegraphClock({
    remainingMs: resumedEnemyTelegraph.remainingMs,
    elapsedMs: 1_600,
    blocked: false,
  }),
  { remainingMs: 0, castDue: true },
  'enemy support casts only after its full active-time warning has elapsed'
);
assert.deepEqual(
  advanceEnemySupportTelegraphClock({
    remainingMs: 100,
    elapsedMs: 1_000,
    blocked: true,
  }),
  { remainingMs: 100, castDue: false },
  'a presentation cannot consume the final readable telegraph beat'
);
assert.equal(
  BATTLE_GAUGE_VISUAL_COMMIT_MS,
  100,
  'the continuous gauge simulation commits React visuals at 10Hz'
);
assert.equal(
  BATTLE_STATE_UPDATE_INTERVAL_MS,
  100,
  'battle countdowns share a 10Hz state tick instead of rerendering at 20Hz'
);
assert.deepEqual(
  getBattleClockScales({
    baseTimeScale: 1,
    simulationPaused: false,
    capitalPileActive: false,
    capitalPileAllowsCommandRecharge: true,
    fullPresentationActive: false,
  }),
  { commandTimeScale: 1, simulationTimeScale: 1 },
  'the command and simulation clocks advance together during ordinary battle time'
);
assert.deepEqual(
  getBattleClockScales({
    baseTimeScale: 1,
    simulationPaused: true,
    capitalPileActive: true,
    capitalPileAllowsCommandRecharge: true,
    fullPresentationActive: false,
  }),
  { commandTimeScale: 1, simulationTimeScale: 0 },
  'ordinary coin stacking advances only the player command clock'
);
assert.deepEqual(
  getBattleClockScales({
    baseTimeScale: 1,
    simulationPaused: true,
    capitalPileActive: true,
    capitalPileAllowsCommandRecharge: false,
    fullPresentationActive: false,
  }),
  { commandTimeScale: 0, simulationTimeScale: 0 },
  'capital piles tagged as exceptional keep every battle clock paused'
);
assert.deepEqual(
  getBattleClockScales({
    baseTimeScale: 1,
    simulationPaused: true,
    capitalPileActive: true,
    capitalPileAllowsCommandRecharge: true,
    fullPresentationActive: true,
  }),
  { commandTimeScale: 0, simulationTimeScale: 0 },
  'an overlapping skill or full presentation overrides ordinary pile recharge'
);
assert.deepEqual(
  getBattleClockScales({
    baseTimeScale: 0.12,
    simulationPaused: false,
    capitalPileActive: false,
    capitalPileAllowsCommandRecharge: true,
    fullPresentationActive: false,
  }),
  { commandTimeScale: 0.12, simulationTimeScale: 0.12 },
  'decision grace continues to scale both clocks outside a presentation pause'
);
assert.deepEqual(
  getBattleClockScales({
    baseTimeScale: -1,
    simulationPaused: false,
    capitalPileActive: false,
    capitalPileAllowsCommandRecharge: true,
    fullPresentationActive: false,
  }),
  { commandTimeScale: 0, simulationTimeScale: 0 },
  'battle clock scales never become negative'
);
assert.equal(
  ENEMY_SUPPORT_POST_PILE_GRACE_MS,
  800,
  'an enemy support warning held by coin stacking reopens a readable input window'
);
assert.ok(
  Math.abs(BATTLE_GAUGE_FRAME_MS[30] - (1_000 / 30)) < 0.001 &&
    Math.abs(BATTLE_GAUGE_FRAME_MS[60] - (1_000 / 60)) < 0.001,
  'the battle gauge is explicitly capped at either 30 or 60 updates per second'
);
assert.equal(
  shouldProcessGaugeFrame(16, 30),
  false,
  '30fps mode skips sub-frame gauge calculations'
);
assert.equal(
  shouldProcessGaugeFrame(34, 30),
  true,
  '30fps mode processes the accumulated gauge frame'
);
assert.equal(
  shouldProcessGaugeFrame(8, 60),
  false,
  '60fps mode still caps work on high-refresh displays'
);
assert.equal(
  shouldProcessGaugeFrame(17, 60),
  true,
  '60fps mode processes one bounded gauge frame'
);
assert.equal(
  SKILL_CINEMATIC_TIMING.nameMs +
    SKILL_CINEMATIC_TIMING.castMs +
    SKILL_CINEMATIC_TIMING.hitStopMs +
    SKILL_CINEMATIC_TIMING.impactMs +
    SKILL_CINEMATIC_TIMING.resolveMs,
  SKILL_CINEMATIC_TIMING.totalMs,
  'skill name, cast, hit-stop, impact and result form one sequential timeline'
);
assert.equal(
  REDUCED_MOTION_SKILL_CINEMATIC_TIMING.nameMs +
    REDUCED_MOTION_SKILL_CINEMATIC_TIMING.castMs +
    REDUCED_MOTION_SKILL_CINEMATIC_TIMING.hitStopMs +
    REDUCED_MOTION_SKILL_CINEMATIC_TIMING.impactMs +
    REDUCED_MOTION_SKILL_CINEMATIC_TIMING.resolveMs,
  REDUCED_MOTION_SKILL_CINEMATIC_TIMING.totalMs,
  'reduced-motion skill beats remain complete instead of truncating the sequence'
);
assert.equal(
  getSkillCinematicTiming(false),
  SKILL_CINEMATIC_TIMING,
  'standard mode owns the full skill timeline'
);
assert.equal(
  getSkillCinematicTiming(true),
  REDUCED_MOTION_SKILL_CINEMATIC_TIMING,
  'the operating-system reduced-motion preference owns a bounded timeline'
);
assert.ok(
  REDUCED_MOTION_SKILL_CINEMATIC_TIMING.totalMs <=
    SKILL_CINEMATIC_TIMING.totalMs,
  'reduced-motion staging never lasts longer than standard staging'
);
for (const timing of [
  SKILL_CINEMATIC_TIMING,
  REDUCED_MOTION_SKILL_CINEMATIC_TIMING,
]) {
  const castAt = timing.nameMs;
  const effectAt = castAt + timing.castMs;
  const impactAt = effectAt + timing.hitStopMs;
  const resolveAt = impactAt + timing.impactMs;

  assert.deepEqual(
    getSkillCinematicTimelineState(Number.NaN, timing),
    getSkillCinematicTimelineState(-1, timing),
    'invalid or negative elapsed time safely restarts from the skill name beat'
  );
  assert.deepEqual(
    getSkillCinematicTimelineState(castAt - 1, timing),
    {
      stage: 'name',
      castDue: false,
      effectDue: false,
      completionDue: false,
      nextTransitionInMs: 1,
    },
    'the skill name beat owns the full pre-cast interval'
  );
  assert.deepEqual(
    getSkillCinematicTimelineState(castAt, timing),
    {
      stage: 'cast',
      castDue: true,
      effectDue: false,
      completionDue: false,
      nextTransitionInMs: timing.castMs,
    },
    'cast begins exactly once at the pure name deadline'
  );
  assert.deepEqual(
    getSkillCinematicTimelineState(effectAt, timing),
    {
      stage: 'hitstop',
      castDue: true,
      effectDue: true,
      completionDue: false,
      nextTransitionInMs: timing.hitStopMs,
    },
    'the battle effect becomes due at the hit-stop boundary'
  );
  assert.equal(
    getSkillCinematicTimelineState(impactAt, timing).stage,
    'impact',
    'impact follows hit-stop without an acknowledgement click'
  );
  assert.deepEqual(
    getSkillCinematicTimelineState(resolveAt, timing),
    {
      stage: 'resolve',
      castDue: true,
      effectDue: true,
      completionDue: false,
      nextTransitionInMs: timing.resolveMs,
    },
    'the resolved value remains visible for its readable afterglow'
  );
  assert.equal(
    getSkillCinematicTimelineState(timing.totalMs - 1, timing)
      .nextTransitionInMs,
    1,
    'the final readable millisecond is retained before auto-resume'
  );
  assert.deepEqual(
    getSkillCinematicTimelineState(timing.totalMs + 30_000, timing),
    {
      stage: 'resolve',
      castDue: true,
      effectDue: true,
      completionDue: true,
      nextTransitionInMs: null,
    },
    'a delayed or HMR-restored runner catches up instead of stranding the battle'
  );
}

const completedSkillTimeline = getSkillCinematicTimelineState(
  SKILL_CINEMATIC_TIMING.totalMs,
  SKILL_CINEMATIC_TIMING
);
const initialSkillEvents = {
  cast: false,
  effect: false,
  completion: false,
};
const blockedSkillDecision = getSkillCinematicEventDecision({
  timeline: completedSkillTimeline,
  consumed: initialSkillEvents,
  completionBlocked: true,
});
assert.deepEqual(
  blockedSkillDecision,
  {
    fireCast: true,
    fireEffect: true,
    fireCompletion: false,
    waitForPresentation: true,
    consumed: { cast: true, effect: true, completion: false },
  },
  'catch-up applies cast/effect once but waits for a capital presentation'
);
const replayedBlockedSkillDecision = getSkillCinematicEventDecision({
  timeline: completedSkillTimeline,
  consumed: blockedSkillDecision.consumed,
  completionBlocked: true,
});
assert.equal(
  replayedBlockedSkillDecision.fireCast ||
    replayedBlockedSkillDecision.fireEffect ||
    replayedBlockedSkillDecision.fireCompletion,
  false,
  'timer or HMR replay cannot double-fire a consumed skill event'
);
const resumedSkillDecision = getSkillCinematicEventDecision({
  timeline: completedSkillTimeline,
  consumed: replayedBlockedSkillDecision.consumed,
});
assert.equal(
  resumedSkillDecision.fireCompletion,
  true,
  'completion fires once after the presentation lock clears'
);
const replayedCompletionDecision = getSkillCinematicEventDecision({
  timeline: completedSkillTimeline,
  consumed: resumedSkillDecision.consumed,
});
assert.equal(
  replayedCompletionDecision.fireCast ||
    replayedCompletionDecision.fireEffect ||
    replayedCompletionDecision.fireCompletion,
  false,
  'a replay after completion cannot resume the battle queue twice'
);
assert.equal(
  getSkillCinematicEventDecision({
    timeline: completedSkillTimeline,
    consumed: initialSkillEvents,
    runMatches: false,
  }).fireEffect,
  false,
  'a stale cinematic run cannot apply its effect to the active queue item'
);
assert.deepEqual(
  getBattleHitStopTiming(false, false),
  {
    hitStopMs: BATTLE_HIT_STOP_TIMING.standardMs,
    releaseMs: BATTLE_HIT_STOP_TIMING.releaseMs,
  },
  'standard investments use one bounded hit-stop and release'
);
assert.deepEqual(
  getBattleHitStopTiming(true, true),
  {
    hitStopMs: BATTLE_HIT_STOP_TIMING.reducedMotionHeavyMs,
    releaseMs: BATTLE_HIT_STOP_TIMING.reducedMotionReleaseMs,
  },
  'reduced-motion heavy impacts preserve the beat with less animated time'
);
assert.ok(
  BATTLE_HIT_STOP_TIMING.heavyMs <= 80 &&
    BATTLE_HIT_STOP_TIMING.reducedMotionHeavyMs <=
      BATTLE_HIT_STOP_TIMING.heavyMs &&
    BATTLE_HIT_STOP_TIMING.releaseMs <= 230,
  'routine impact staging stays below the input-latency and animation budget'
);
const smallCapitalCommit = getCapitalCommitTiming(1, false);
const mediumCapitalCommit = getCapitalCommitTiming(3, false);
const heavyCapitalCommit = getCapitalCommitTiming(5, false);
const compactHeavyCapitalCommit = getCapitalCommitTiming(5, true);
[
  smallCapitalCommit,
  mediumCapitalCommit,
  heavyCapitalCommit,
  compactHeavyCapitalCommit,
].forEach((timing) => {
  assert.equal(
    timing.prepareMs +
      timing.travelMs +
      timing.hitStopMs +
      timing.settleMs +
      timing.afterglowMs,
    timing.totalMs,
    `${timing.tier} capital preparation, delivery, landing and afterglow form one timeline`
  );
  assert.ok(
    timing.prepareMs > 0 &&
      timing.travelMs > 0 &&
      timing.hitStopMs > 0 &&
      timing.settleMs > 0 &&
      timing.afterglowMs > 0,
    'every capital commit preserves all five readable beats'
  );
});
assert.ok(
  smallCapitalCommit.totalMs <
    mediumCapitalCommit.totalMs &&
    mediumCapitalCommit.totalMs <
      heavyCapitalCommit.totalMs,
  'larger investments receive progressively heavier staging'
);
assert.ok(
  compactHeavyCapitalCommit.totalMs <
    heavyCapitalCommit.totalMs &&
    compactHeavyCapitalCommit.totalMs >= 1_400 &&
    compactHeavyCapitalCommit.totalMs <= 1_550,
  'lightweight staging reduces animated nodes without erasing the heavy pause'
);
assert.equal(
  getNextBattleSkillId(
    ['skill_fast_horse', 'skill_demoralize', 'skill_capital_boost'],
    'skill_fast_horse'
  ),
  'skill_demoralize',
  'skill selection changes without executing the selected action'
);
assert.equal(
  getNextBattleSkillId(
    ['skill_fast_horse', 'skill_demoralize', 'skill_capital_boost'],
    'skill_capital_boost'
  ),
  'skill_fast_horse',
  'skill selection wraps like the five-step investment selector'
);
assert.equal(
  getNextBattleSkillId(
    ['skill_fast_horse', 'skill_demoralize'],
    null
  ),
  'skill_fast_horse',
  'a missing legacy selection safely starts at the first equipped skill'
);
assert.deepEqual(
  resolveBattleSkillSelection(
    ['skill_demoralize', 'skill_fast_horse'],
    ['skill_fast_horse', 'skill_demoralize', 'skill_capital_boost'],
    'skill_fast_horse'
  ),
  {
    poolIds: ['skill_demoralize', 'skill_fast_horse'],
    selectedSkillId: 'skill_fast_horse',
    usingFallback: false,
  },
  'battle skill selection preserves equipped order and a valid current selection'
);
assert.deepEqual(
  resolveBattleSkillSelection(
    [],
    ['skill_capital_boost', 'skill_demoralize'],
    null
  ),
  {
    poolIds: [],
    selectedSkillId: null,
    usingFallback: false,
  },
  'an empty equipped pool never grants an unequipped ability'
);
assert.deepEqual(
  resolveBattleSkillSelection(
    ['skill_demoralize', 'skill_fast_horse'],
    ['skill_fast_horse', 'skill_demoralize'],
    'skill_removed_from_battle'
  ),
  {
    poolIds: ['skill_demoralize', 'skill_fast_horse'],
    selectedSkillId: 'skill_demoralize',
    usingFallback: false,
  },
  'a stale battle skill selection resets deterministically to the first usable equipped skill'
);
assert.equal(
  canConfirmBattleResult({
    battlePhase: 'finisher_notice',
    hasWinner: true,
    armed: true,
    alreadyConfirmed: false,
  }),
  false,
  'settlement cannot run directly from the finishing-blow phase'
);
assert.equal(
  canConfirmBattleResult({
    battlePhase: 'result',
    hasWinner: true,
    armed: false,
    alreadyConfirmed: false,
  }),
  false,
  'the result dialog rejects a carried-over tap before arming'
);
assert.equal(
  canConfirmBattleResult({
    battlePhase: 'result',
    hasWinner: true,
    armed: true,
    alreadyConfirmed: false,
  }),
  true,
  'an armed result dialog accepts one explicit confirmation'
);
assert.equal(
  canConfirmBattleResult({
    battlePhase: 'result',
    hasWinner: true,
    armed: true,
    alreadyConfirmed: true,
  }),
  false,
  'a confirmed result cannot settle twice'
);
assert.equal(getVictoryConfettiParticleCount(402, false), 0);
assert.equal(
  getVictoryConfettiParticleCount(1024, false),
  0,
  'tablet-sized victory effects avoid a second canvas animation'
);
assert.equal(getVictoryConfettiParticleCount(1440, false), 110);
assert.equal(getVictoryConfettiParticleCount(402, true), 0);

const pendingBattleNow = 1_800_000_000_000;
const pendingBattleProperty = INITIAL_PROPERTIES[0];
const pendingBattleSession = parsePendingBattleSession(
  JSON.stringify({
    version: 1,
    mode: 'normal',
    targetProperty: pendingBattleProperty,
    startedAt: pendingBattleNow - 5_000,
  }),
  pendingBattleNow
);
assert.equal(pendingBattleSession?.targetProperty.id, pendingBattleProperty.id);
assert.equal(pendingBattleSession?.mode, 'normal');
assert.equal(
  pendingBattleSession?.normalOrigin,
  'market',
  'legacy pending normal battles without an origin remain compatible'
);
const pendingAllianceBattleSession = parsePendingBattleSession(
  JSON.stringify({
    version: 1,
    mode: 'normal',
    targetProperty: pendingBattleProperty,
    startedAt: pendingBattleNow - 5_000,
    normalOrigin: 'cartels',
  }),
  pendingBattleNow
);
assert.equal(
  pendingAllianceBattleSession?.normalOrigin,
  'cartels',
  'an interrupted Alliance battle restores its Alliance return context'
);
assert.equal(
  parsePendingBattleSession(
    JSON.stringify({
      version: 1,
      mode: 'normal',
      targetProperty: pendingBattleProperty,
      startedAt: pendingBattleNow - 5_000,
      normalOrigin: 'invalid',
    }),
    pendingBattleNow
  ),
  null,
  'unknown pending battle origins are rejected'
);
const currentNormalPropertyIds = new Set(
  INITIAL_PROPERTIES.map((property) => property.id)
);
assert.equal(
  isPendingBattleTargetAvailable(
    pendingBattleSession!,
    currentNormalPropertyIds
  ),
  true
);
assert.equal(
  isPendingBattleTargetAvailable(
    {
      ...pendingBattleSession!,
      targetProperty: {
        ...pendingBattleSession!.targetProperty,
        id: 'prop_starter_bakery',
      },
    },
    currentNormalPropertyIds
  ),
  false,
  'a removed normal business cannot reopen as a ghost battle'
);
assert.equal(
  isPendingBattleTargetAvailable(
    {
      ...pendingBattleSession!,
      mode: 'savage',
      targetProperty: {
        ...pendingBattleSession!.targetProperty,
        id: 'prop_blacksmith',
      },
    },
    currentNormalPropertyIds
  ),
  true,
  'legacy high-end save IDs remain recoverable without becoming normal contacts'
);
assert.equal(
  shouldRestorePendingBattleSession(
    pendingBattleSession!,
    pendingBattleSession!.startedAt - 1
  ),
  true,
  'a battle marker newer than the pre-battle save remains recoverable'
);
assert.equal(
  shouldRestorePendingBattleSession(
    pendingBattleSession!,
    pendingBattleSession!.startedAt
  ),
  true,
  'same-millisecond start saves must not discard an active battle'
);
assert.equal(
  shouldRestorePendingBattleSession(
    pendingBattleSession!,
    pendingBattleSession!.startedAt + 1
  ),
  false,
  'a newer authoritative result save suppresses a stale recovery marker'
);
assert.equal(
  parsePendingBattleSession(
    JSON.stringify({
      version: 1,
      mode: 'normal',
      targetProperty: pendingBattleProperty,
      startedAt:
        pendingBattleNow - PENDING_BATTLE_SESSION_MAX_AGE_MS - 1,
    }),
    pendingBattleNow
  ),
  null,
  'stale interrupted battles do not reopen indefinitely'
);
assert.equal(
  parsePendingBattleSession(
    JSON.stringify({
      version: 1,
      mode: 'invalid',
      targetProperty: pendingBattleProperty,
      startedAt: pendingBattleNow,
    }),
    pendingBattleNow
  ),
  null
);
const capitalPresentationAmounts = [
  0,
  999,
  1_000,
  9_999,
  10_000,
  99_999,
  100_000,
  999_999,
  1_000_000,
  9_999_999,
  10_000_000,
  99_999_999,
  100_000_000,
  1_000_000_000,
];
const capitalPresentationStages = capitalPresentationAmounts.map(
  getCapitalVisualStage
);
assert.ok(
  capitalPresentationStages.every(
    (stage, index) =>
      index === 0 || stage >= capitalPresentationStages[index - 1]
  ),
  'absolute capital presentation stages are monotonically non-decreasing'
);
assert.equal(capitalPresentationStages[0], 0);
assert.equal(capitalPresentationStages.at(-1), 7);
assert.equal(getCapitalVisualStage(499), 1);
assert.equal(getCapitalVisualStage(500), 2);
assert.equal(getCapitalVisualStage(49_999), 3);
assert.equal(getCapitalVisualStage(50_000), 4);
assert.equal(getCapitalVisualStage(499_999), 4);
assert.equal(getCapitalVisualStage(500_000), 5);
assert.equal(getCapitalVisualStage(9_999_999), 5);
assert.equal(getCapitalVisualStage(10_000_000), 6);
assert.equal(getCapitalVisualStage(999_999_999), 6);
assert.equal(getCapitalVisualStage(1_000_000_000), 7);
const capitalBundleCounts = capitalPresentationStages.map(
  getCapitalVisualBundleCount
);
assert.ok(
  capitalBundleCounts.every(
    (count, index) =>
      index === 0 || count >= capitalBundleCounts[index - 1]
  ),
  'capital bundle counts grow monotonically with absolute capital'
);
assert.equal(getCapitalVisualBundleCount(0), 0);
assert.equal(getCapitalVisualBundleCount(7), 13);
const capitalAmountBundleCounts = capitalPresentationAmounts.map(
  getCapitalVisualBundleCountForAmount
);
assert.ok(
  capitalAmountBundleCounts.every(
    (count, index) =>
      index === 0 || count >= capitalAmountBundleCounts[index - 1]
  ),
  'committed-capital bundle counts grow monotonically with absolute capital'
);
assert.equal(getCapitalVisualBundleCountForAmount(0), 0);
assert.equal(getCapitalVisualBundleCountForAmount(200), 1);
assert.equal(getCapitalVisualBundleCountForAmount(500), 2);
assert.equal(getCapitalVisualBundleCountForAmount(4_999), 3);
assert.equal(getCapitalVisualBundleCountForAmount(50_000), 5);
assert.equal(getCapitalVisualBundleCountForAmount(1_000_000_000), 13);
const battleCapitalRatios = [
  0,
  0.02,
  0.08,
  0.2,
  0.5,
  1,
  1.5,
  2,
  3,
  4,
  5,
  8,
  10,
  14,
  20,
];
const battleCapitalBundleCounts = battleCapitalRatios.map((ratio) =>
  getBattleCapitalVisualBundleCount(ratio * 100_000, 100_000)
);
assert.ok(
  battleCapitalBundleCounts.every(
    (count, index) =>
      index === 0 || count >= battleCapitalBundleCounts[index - 1]
  ),
  'live battle bundles grow monotonically as offers are stacked'
);
assert.equal(getBattleCapitalVisualBundleCount(0, 100_000), 0);
assert.equal(getBattleCapitalVisualBundleCount(2_000, 100_000), 1);
assert.equal(
  getBattleCapitalVisualBundleCount(10_000, 100_000),
  2,
  'the default first offer reveals two small, separate capital beats'
);
assert.equal(getBattleCapitalVisualBundleCount(20_000, 100_000), 4);
assert.deepEqual(
  [0.1, 0.2, 0.3, 0.4].map((ratio) =>
    getBattleCapitalVisualBundleCount(ratio * 100_000, 100_000)
  ),
  [2, 4, 6, 8],
  'repeated default offers climb through five-percent capital beats'
);
assert.equal(
  getBattleCapitalVisualBundleCount(50_000, 100_000),
  10,
  'a typical opening defence stays a modest pile'
);
assert.equal(getBattleCapitalVisualBundleCount(100_000, 100_000), 20);
assert.equal(getBattleCapitalVisualBundleCount(368_000, 100_000), 55);
assert.equal(getBattleCapitalVisualBundleCount(2_000_000, 100_000), 59);
assert.equal(
  getBattleCapitalVisualBundleCount(20_000, 1_000_000),
  1,
  'the first visible offer is sparse in later chapters too'
);
assert.equal(
  getBattleCapitalVisualBundleCount(100_000_000, 1_000_000_000),
  2,
  'a first 10% offer stays sparse even in the final chapter'
);
assert.equal(
  getBattleCapitalVisualBundleCount(500_000_000, 1_000_000_000),
  getBattleCapitalVisualBundleCount(50_000, 100_000),
  'the same relative pressure follows the same visual steps in every chapter'
);
assert.equal(getCapitalVisualStageForBundleCount(0), 0);
assert.equal(getCapitalVisualStageForBundleCount(4), 4);
assert.equal(getCapitalVisualStageForBundleCount(11), 11);
assert.equal(getCapitalVisualStageForBundleCount(13), 13);
assert.equal(getCapitalVisualStageForBundleCount(99), 59);
assert.equal(getCapitalVisualSpriteCount(0), 0);
assert.equal(
  getCapitalVisualSpriteCount(3),
  1,
  'the first committed capital is visible without a placeholder money bag'
);
assert.equal(
  getCapitalVisualSpriteCount(13),
  3,
  'field-filling hoards keep a bounded foreground sprite count'
);
assert.equal(getCapitalVisualSpriteCount(59), 8);
assert.deepEqual(
  [0, 9, 19, 29, 39, 49, 59].map(getCapitalFormationPieceCount),
  [0, 1, 2, 3, 4, 5, 6],
  'fixed formation slots reveal gradually without amount-proportional DOM'
);
assert.deepEqual(
  [0, 1, 2, 3, 5, 6, 59].map(getCapitalHoardBandCount),
  [0, 1, 1, 2, 2, 3, 3],
  'three fixed background bands provide bounded late-stage density'
);
assert.deepEqual(getCapitalHoardFillRatios(0), { near: 0, mid: 0, far: 0 });
assert.deepEqual(getCapitalHoardFillRatios(24), {
  near: 0.5,
  mid: 0.4,
  far: 4 / 15,
});
assert.deepEqual(getCapitalHoardFillRatios(48), {
  near: 1,
  mid: 0.8,
  far: 8 / 15,
});
assert.deepEqual(getCapitalHoardFillRatios(59), { near: 1, mid: 1, far: 1 });
const liveCapitalPresentationStages = Array.from(
  { length: BATTLE_CAPITAL_VISUAL_STAGE_COUNT },
  (_, stage) => stage
);
assert.ok(
  liveCapitalPresentationStages.every(
    (stage) =>
      getCapitalVisualSpriteCount(stage) <= 8 &&
      getCapitalFormationPieceCount(stage) <= 6 &&
      getCapitalHoardBandCount(stage) <= 3
  ),
  'all sixty logical pile stages preserve fixed DOM caps'
);
assert.ok(
  liveCapitalPresentationStages.every(
    (stage, index) =>
      index === 0 ||
      (
        getCapitalVisualSpriteCount(stage) >=
          getCapitalVisualSpriteCount(stage - 1) &&
        getCapitalFormationPieceCount(stage) >=
          getCapitalFormationPieceCount(stage - 1) &&
        getCapitalHoardBandCount(stage) >=
          getCapitalHoardBandCount(stage - 1)
      )
  ),
  'all fixed pile layers reveal monotonically'
);
assert.ok(
  liveCapitalPresentationStages.every((stage, index) => {
    if (index === 0) return true;
    const previousFill = getCapitalHoardFillRatios(stage - 1);
    const currentFill = getCapitalHoardFillRatios(stage);
    return (['near', 'mid', 'far'] as const).every(
      (band) => currentFill[band] >= previousFill[band]
    );
  }),
  'all three hoard band widths grow monotonically across stages 0-59'
);
assert.ok(
  liveCapitalPresentationStages.slice(1).every((stage) => {
    const previousFill = getCapitalHoardFillRatios(stage - 1);
    const currentFill = getCapitalHoardFillRatios(stage);
    return (['near', 'mid', 'far'] as const).filter(
      (band) => currentFill[band] > previousFill[band]
    ).length === 1;
  }),
  'each non-empty hoard stage advances exactly one painted band'
);
assert.ok(
  liveCapitalPresentationStages.every((stage) => {
    const fill = getCapitalHoardFillRatios(stage);
    return Math.round(fill.near * 24 + fill.mid * 20 + fill.far * 15) === stage;
  }),
  'every logical stage adds exactly one painted bundle slot'
);
assert.deepEqual(
  getCapitalStageSequence(1, MAX_BATTLE_CAPITAL_VISUAL_STAGE, 8),
  [8, 16, 23, 30, 37, 45, 52, 59],
  'heavy investments retain eight readable stacking beats'
);
assert.deepEqual(
  getCapitalStageSequence(4, 12, 2),
  [8, 12],
  'lightweight mode keeps the destination while reducing paint work'
);
const earlyColumnUnits = getBattleCapitalVisibleUnits(15_000, 15_000);
const lateColumnUnits = getBattleCapitalVisibleUnits(
  4_200_000_000,
  4_200_000_000
);
assert.ok(
  lateColumnUnits > earlyColumnUnits,
  'the same relative offer becomes a taller treasury in later chapters'
);
assert.equal(
  MAX_BATTLE_CAPITAL_VISIBLE_UNITS,
  792,
  'twenty-two fixed columns may now reach thirty-six layers without adding DOM'
);
assert.equal(
  getBattleCapitalVisibleUnits(60_000_000_000, 6_000_000_000),
  MAX_BATTLE_CAPITAL_VISIBLE_UNITS,
  'ultimate overcapital stops at the fixed twenty-two-column height cap'
);
[0, 1, 19, 20, 21, 279, 280, MAX_BATTLE_CAPITAL_VISIBLE_UNITS].forEach(
  (units) => {
    const heights = getCapitalColumnHeights(units);
    assert.equal(heights.length, 22, 'the capital field always owns twenty-two columns');
    assert.equal(
      heights.reduce((total, height) => total + height, 0),
      units,
      'column heights preserve the visible-unit total'
    );
    assert.ok(
      Math.max(...heights) - Math.min(...heights) <= 1,
      'fixed columns grow almost level without random mounds'
    );
    assert.deepEqual(
      getCapitalColumnHeights(units),
      heights,
      'the same amount always produces the same column silhouette'
    );
  }
);
const mechanicalColumnSequence = getCapitalVisibleUnitSequence(12, 480, 22);
assert.equal(mechanicalColumnSequence.at(-1), 480);
assert.ok(mechanicalColumnSequence.length <= 22);
assert.ok(
  mechanicalColumnSequence.every(
    (units, index) => index === 0 || units > mechanicalColumnSequence[index - 1]
  ),
  'a funding wave advances the column field monotonically'
);
const mechanicalRackFrames = getMechanicalCapitalColumnFrames(
  0,
  MAX_BATTLE_CAPITAL_VISIBLE_UNITS,
  22,
  5
);
assert.equal(
  mechanicalRackFrames.at(-1)?.visibleUnits,
  MAX_BATTLE_CAPITAL_VISIBLE_UNITS
);
assert.ok(mechanicalRackFrames.length <= 22);
assert.ok(
  mechanicalRackFrames.every((frame, index) =>
    index === 0 ||
    frame.visibleUnits >= mechanicalRackFrames[index - 1].visibleUnits
  ),
  'the automatic rack never removes capital during a funding wave'
);
assert.ok(
  mechanicalRackFrames.slice(0, -1).every(
    (frame) => frame.activeColumnIndices.length <= 5
  ),
  'each mechanical beat touches at most one five-column rack group'
);
assert.deepEqual(
  [1.49, 1.5, 3, 6].map((ratio) =>
    getBattleCapitalOverflowTier(ratio * 1_000_000, 1_000_000)
  ),
  [0, 1, 2, 3],
  'overcapital spectacle uses three bounded grades instead of amount-scaled DOM'
);
assert.deepEqual(
  [1, 2, 3, 4, 5].map(getInvestmentStakeVisualPieceCount),
  [1, 1, 1, 1, 1],
  'every investment level carries one bounded cargo silhouette'
);
assert.deepEqual(
  (['small', 'medium', 'heavy'] as const).map((tier) =>
    getCapitalDropParticleCount(tier, false)
  ),
  [4, 8, 12],
  'standard capital drops use three fixed, non-monetary particle tiers'
);
assert.deepEqual(
  (['small', 'medium', 'heavy'] as const).map((tier) =>
    getCapitalDropParticleCount(tier, true)
  ),
  [2, 4, 6],
  'compact mode halves visual drops while preserving the presentation beat'
);
assert.ok(
  getCapitalDropParticleCount('heavy', false) <=
    MAX_CAPITAL_DROP_PARTICLE_COUNT,
  'the heaviest transient shower remains inside the sixteen-node cap'
);
assert.equal(
  shouldInertBattleFooter(true, true, 'result'),
  true,
  'the result dialog keeps the settled footer inert behind its modal surface'
);
assert.equal(
  getBattleCinematicLayer({
    battlePhase: 'decisive',
    hasBattleAnnouncement: true,
    hasDecisiveBlow: true,
    hasWinner: false,
    finishTelegraphVisible: false,
  }),
  'decisive',
  'the decisive blow replaces every older full-screen announcement'
);
assert.equal(
  getBattleCinematicLayer({
    battlePhase: 'finisher_notice',
    hasBattleAnnouncement: true,
    hasDecisiveBlow: false,
    hasWinner: true,
    finishTelegraphVisible: true,
  }),
  'finish',
  'the result telegraph replaces stale action and condition announcements'
);
assert.equal(
  getBattleCinematicLayer({
    battlePhase: 'active',
    hasBattleAnnouncement: true,
    hasDecisiveBlow: false,
    hasWinner: false,
    finishTelegraphVisible: false,
  }),
  'battle_announcement',
  'only one full-screen cue is selected when action and condition timers coincide'
);
const queuedStatusMessages = enqueueBattleStatusMessage(
  [
    { text: '自社への追い風', priority: 1 },
    { text: '風が静まった', priority: 0 },
  ],
  { text: '競合への追い風', priority: 2 }
);
assert.deepEqual(
  queuedStatusMessages.map((message) => message.text),
  ['競合への追い風', '自社への追い風', '風が静まった'],
  'status events wait in a single priority-ordered presentation queue'
);
assert.equal(
  enqueueBattleStatusMessage(
    queuedStatusMessages,
    { text: '競合への追い風', priority: 2 },
    null
  ).length,
  3,
  'the presentation queue does not stack duplicate event cards'
);
assert.ok(
  BATTLE_CINEMATIC_TIMING.limitAnnouncementMs <=
    BATTLE_CINEMATIC_TIMING.limitResolveMs,
  'LIMIT BREAK announcement finishes before its capital impact'
);
assert.ok(
  BATTLE_CINEMATIC_TIMING.limitResolveMs -
    BATTLE_CINEMATIC_TIMING.limitAnnouncementMs >=
    300,
  'LIMIT BREAK keeps a readable pause between its announcement and resolution'
);
assert.equal(getBattleTerminalWinner(-99.999), null);
assert.equal(getBattleTerminalWinner(-100), 'player');
assert.equal(getBattleTerminalWinner(99.999), null);
assert.equal(getBattleTerminalWinner(100), 'opponent');
assert.equal(
  getBattleTerminalWinner(-99.5),
  null,
  'zero enemy reserve is not a terminal condition and 99.5% no longer stops play'
);
for (const [route, gauge, expectedWinner] of [
  ['direct company investment', -104, 'player'],
  ['subsidiary support', -101, 'player'],
  ['synergy support', -106, 'player'],
  ['alliance or skill pressure', -100.1, 'player'],
  ['era wind pressure', -100.01, 'player'],
  ['continuous capital pressure', -100, 'player'],
  ['enemy defense pressure', 100, 'opponent'],
] as const) {
  assert.equal(
    getBattleTerminalWinner(gauge),
    expectedWinner,
    `${route} reaches the shared ownership terminal`
  );
}
for (const tier of [1, 2, 3] as const) {
  const rawOwnershipAfterLimitBreak =
    99 + LIMIT_BREAK_OWNERSHIP_CAPS[tier];
  assert.equal(
    getBattleTerminalWinner(100 - rawOwnershipAfterLimitBreak * 2),
    'player',
    `LIMIT BREAK ${tier} uses the same terminal latch`
  );
}
assert.equal(
  getTerminalCinematicPresentation(
    TERMINAL_CINEMATIC_TIMING.anticipationMs - 1
  ).stage,
  'anticipation'
);
assert.equal(
  getTerminalCinematicPresentation(
    TERMINAL_CINEMATIC_TIMING.anticipationMs
  ).stage,
  'hitstop'
);
assert.equal(
  getTerminalCinematicPresentation(
    TERMINAL_CINEMATIC_TIMING.anticipationMs +
      TERMINAL_CINEMATIC_TIMING.hitStopMs
  ).stage,
  'impact'
);
assert.equal(
  getTerminalCinematicPresentation(
    TERMINAL_CINEMATIC_TIMING.anticipationMs +
      TERMINAL_CINEMATIC_TIMING.hitStopMs +
      TERMINAL_CINEMATIC_TIMING.impactMs
  ).stage,
  'resolution'
);
assert.equal(
  getTerminalCinematicPresentation(TERMINAL_CINEMATIC_TIMING.totalMs).stage,
  'complete'
);
assert.equal(
  TERMINAL_CINEMATIC_TIMING.anticipationMs +
    TERMINAL_CINEMATIC_TIMING.hitStopMs +
    TERMINAL_CINEMATIC_TIMING.impactMs +
    TERMINAL_CINEMATIC_TIMING.fanfareLeadMs +
    TERMINAL_CINEMATIC_TIMING.resolutionMs,
  TERMINAL_CINEMATIC_TIMING.totalMs,
  'the final offer, hit-stop, knockdown and WIN reveal form one sequential timeline'
);
assert.equal(
  TERMINAL_CINEMATIC_TIMING.reducedMotionAnticipationMs +
    TERMINAL_CINEMATIC_TIMING.reducedMotionHitStopMs +
    TERMINAL_CINEMATIC_TIMING.reducedMotionImpactMs +
    TERMINAL_CINEMATIC_TIMING.reducedMotionFanfareLeadMs +
    TERMINAL_CINEMATIC_TIMING.reducedMotionResolutionMs,
  TERMINAL_CINEMATIC_TIMING.reducedMotionTotalMs,
  'compact terminal staging keeps every semantic beat'
);
for (const elapsed of [
  0,
  TERMINAL_CINEMATIC_TIMING.anticipationMs,
  TERMINAL_CINEMATIC_TIMING.anticipationMs +
    TERMINAL_CINEMATIC_TIMING.hitStopMs,
  TERMINAL_CINEMATIC_TIMING.anticipationMs +
    TERMINAL_CINEMATIC_TIMING.hitStopMs +
    TERMINAL_CINEMATIC_TIMING.impactMs,
]) {
  assert.equal(
    getTerminalCinematicPresentation(elapsed).timeScale,
    0,
    'terminal staging never advances simulation behind the cinematic'
  );
}
assert.ok(
  TERMINAL_CINEMATIC_TIMING.totalMs <= 3_800 &&
    TERMINAL_CINEMATIC_TIMING.reducedMotionTotalMs <= 1_200,
  'terminal staging keeps the readable afterglow inside bounded UX budgets'
);
assert.equal(
  normalizeBattleStatusMessageText(
    '一行目\n二行目\n表示してはいけない三行目'
  ),
  '一行目\n二行目'
);
assert.equal(BATTLE_STATUS_MESSAGE_DURATION_MS, 1_650);
assert.equal(
  selectBattleStatusMessage([
    {
      id: 'ally',
      text: '自社への追い風！',
      tone: 'ally',
      createdAt: 2,
    },
    {
      id: 'danger',
      text: '自社不利！',
      tone: 'enemy',
      createdAt: 1,
    },
  ])?.id,
  'danger',
  'danger outranks newer positive notices'
);
assert.equal(
  selectBattleStatusMessage([
    {
      id: 'danger',
      text: '自社不利！',
      tone: 'enemy',
      createdAt: 2,
    },
    {
      id: 'terminal',
      text: 'DEAL CLOSED',
      tone: 'ally',
      terminal: true,
      createdAt: 1,
    },
  ])?.id,
  'terminal',
  'the terminal notice always owns the single status window'
);

const readinessProperty = {
  ...INITIAL_PROPERTIES[0],
  marketPrice: 100_000,
  loyaltyRisk: 0,
};
const safeReadiness = calculateBattleReadiness({
  targetMarketPrice: 100_000,
  availableCash: 100_000,
  subsidiaries: [readinessProperty],
  selectedBattleSynergy: null,
  limitBreakCharge: 0,
  allianceSupport: 0,
  hasCapitalBoost: false,
  enemyBudget: 100_000,
  enemyDifficultyLevel: 2,
  enemyBaseReactionSeconds: getEnemyBaseWaitMs(2, false, false) / 1000,
  playerPushBonus: 0,
});
const riskyReadiness = calculateBattleReadiness({
  targetMarketPrice: 100_000,
  availableCash: 100_000,
  subsidiaries: [{ ...readinessProperty, loyaltyRisk: 60 }],
  selectedBattleSynergy: null,
  limitBreakCharge: 0,
  allianceSupport: 0,
  hasCapitalBoost: false,
  enemyBudget: 100_000,
  enemyDifficultyLevel: 2,
  enemyBaseReactionSeconds: getEnemyBaseWaitMs(2, false, false) / 1000,
  playerPushBonus: 0,
});
assert.equal(
  safeReadiness.playerExpectedCapital,
  riskyReadiness.playerExpectedCapital,
  'post-victory departure risk does not discount capital available in the current battle'
);
assert.equal(safeReadiness.grade, 'advantage');
assert.equal(riskyReadiness.grade, 'advantage');
const cappedCashReadiness = calculateBattleReadiness({
  targetMarketPrice: 100_000,
  availableCash: 500_000,
  subsidiaries: [],
  selectedBattleSynergy: null,
  limitBreakCharge: 0,
  allianceSupport: 0,
  hasCapitalBoost: false,
  enemyBudget: 100_000,
  enemyDifficultyLevel: 2,
  enemyBaseReactionSeconds: getEnemyBaseWaitMs(2, false, false) / 1000,
  playerPushBonus: 0,
});
assert.equal(cappedCashReadiness.deployableCash, 100_000);
assert.equal(cappedCashReadiness.battleCashLimit, 100_000);
assert.match(cappedCashReadiness.capitalComponents[0].label, /持込上限/);
const uncappedTrainingReadiness = calculateBattleReadiness({
  targetMarketPrice: 100_000,
  availableCash: 500_000,
  subsidiaries: [],
  selectedBattleSynergy: null,
  limitBreakCharge: 0,
  allianceSupport: 0,
  hasCapitalBoost: false,
  enemyBudget: 100_000,
  enemyDifficultyLevel: 0,
  enemyBaseReactionSeconds: 3.4,
  playerPushBonus: 0,
  cashCapRatio: null,
});
assert.equal(uncappedTrainingReadiness.deployableCash, 500_000);
const noDirectCashReadiness = calculateBattleReadiness({
  targetMarketPrice: 100_000,
  availableCash: 1_999,
  subsidiaries: [],
  selectedBattleSynergy: null,
  limitBreakCharge: 0,
  allianceSupport: 0,
  hasCapitalBoost: false,
  enemyBudget: 100_000,
  enemyDifficultyLevel: 1,
  enemyBaseReactionSeconds: getEnemyBaseWaitMs(1, false, false) / 1000,
  playerPushBonus: 0,
});
assert.equal(
  noDirectCashReadiness.grade,
  'danger',
  'missing direct cash does not replace the capital comparison grade'
);
assert.equal(
  noDirectCashReadiness.directInvestmentAvailable,
  false,
  'readiness independently warns when the 2% minimum investment is unavailable'
);

const pushNeutralReadiness = calculateBattleReadiness({
  targetMarketPrice: 100_000,
  availableCash: 100_000,
  subsidiaries: [],
  selectedBattleSynergy: null,
  limitBreakCharge: 0,
  allianceSupport: 0,
  hasCapitalBoost: false,
  enemyBudget: 100_000,
  enemyDifficultyLevel: 1,
  enemyBaseReactionSeconds: getEnemyBaseWaitMs(1, false, false) / 1000,
  playerPushBonus: 0.5,
});
assert.equal(
  pushNeutralReadiness.playerExpectedCapital,
  100_000,
  'push speed bonuses are not multiplied into effective capital'
);
assert.equal(
  pushNeutralReadiness.ratioPercent,
  100,
  'push speed bonuses do not reverse the capital ratio'
);

const twoSafeSubsidiaries = [
  { ...readinessProperty, id: 'readiness_a' },
  { ...readinessProperty, id: 'readiness_b' },
];
const multiRequestReadiness = calculateBattleReadiness({
  targetMarketPrice: 100_000,
  availableCash: 30_000,
  subsidiaries: twoSafeSubsidiaries,
  selectedBattleSynergy: null,
  limitBreakCharge: 0,
  allianceSupport: 0,
  hasCapitalBoost: false,
  enemyBudget: 100_000,
  enemyDifficultyLevel: 3,
  enemyBaseReactionSeconds: 2,
  playerPushBonus: 0,
});
const perSafeRequestFailure = calculateRebellionProbability(
  BATTLE_LOYALTY_BALANCE.individualRiskIncrease
);
assert.ok(
  Math.abs(
    multiRequestReadiness.cumulativeSupportFailureProbability -
      (1 - (1 - perSafeRequestFailure) ** 2)
  ) < 1e-10,
  'one-pass rebellion risk is 1 - product(1 - p)'
);
assert.equal(
  multiRequestReadiness.grade,
  'even',
  'multi-request support cannot claim a stable advantage while the enemy can react'
);
assert.equal(multiRequestReadiness.sequentialSupportGradeCapped, true);
assert.ok(
  multiRequestReadiness.capitalComponents.some(
    (component) => component.label.includes('人脈2件を強い順に要請')
  ),
  'readiness details the subsidiary one-pass assumption'
);

const overwhelmingReacquisitionSubsidiaries = Array.from(
  { length: 3 },
  (_, index) => ({
    ...readinessProperty,
    id: `extreme_readiness_${index}`,
    marketPrice: 10_000_000,
  })
);
const overwhelmingNormalReadiness = calculateBattleReadiness({
  targetMarketPrice: 100_000,
  availableCash: 100_000,
  subsidiaries: overwhelmingReacquisitionSubsidiaries,
  selectedBattleSynergy: null,
  limitBreakCharge: 0,
  allianceSupport: 0,
  hasCapitalBoost: false,
  enemyBudget: 100_000,
  enemyDifficultyLevel: 3,
  enemyBaseReactionSeconds: 2,
  playerPushBonus: 0,
  battleMode: 'normal',
  mechanicWarning: '代表ギミックあり',
  mechanicSeverity: 'warning',
});
const overwhelmingExtremeReadiness = calculateBattleReadiness({
  targetMarketPrice: 100_000,
  availableCash: 100_000,
  subsidiaries: overwhelmingReacquisitionSubsidiaries,
  selectedBattleSynergy: null,
  limitBreakCharge: 0,
  allianceSupport: 0,
  hasCapitalBoost: false,
  enemyBudget: 100_000,
  enemyDifficultyLevel: 3,
  enemyBaseReactionSeconds: 2,
  playerPushBonus: 0,
  battleMode: 'extreme',
  mechanicWarning: '代表ギミックあり',
  mechanicSeverity: 'warning',
});
assert.ok(
  overwhelmingExtremeReadiness.ratio >= 150,
  'the Extreme regression fixture represents an overwhelmingly stronger current company'
);
assert.equal(
  overwhelmingExtremeReadiness.playerExpectedCapital,
  overwhelmingNormalReadiness.playerExpectedCapital,
  'Extreme assessment never changes the real deployable gil calculation'
);
assert.equal(overwhelmingNormalReadiness.grade, 'even');
assert.equal(overwhelmingExtremeReadiness.grade, 'advantage');
assert.equal(
  overwhelmingExtremeReadiness.assessmentRatio,
  overwhelmingExtremeReadiness.ratio,
  'Extreme readiness reports the real ratio instead of a close-fight presentation cap'
);
assert.equal(overwhelmingExtremeReadiness.sequentialSupportGradeCapped, false);
assert.equal(overwhelmingExtremeReadiness.mechanicGradeCapped, false);

const lbReadiness = calculateBattleReadiness({
  targetMarketPrice: 1_000_000,
  availableCash: 20_000,
  subsidiaries: [
    { ...readinessProperty, id: 'lb_a' },
    { ...readinessProperty, id: 'lb_b' },
    { ...readinessProperty, id: 'lb_c' },
  ],
  selectedBattleSynergy: null,
  limitBreakCharge: 100,
  allianceSupport: 320_000,
  hasCapitalBoost: true,
  enemyBudget: 1_000_000,
  enemyDifficultyLevel: 3,
  enemyBaseReactionSeconds: 2,
  playerPushBonus: 0,
});
assert.equal(lbReadiness.supportRoute, 'LIMIT BREAK');
assert.ok(
  lbReadiness.capitalComponents.some(
    (component) => component.label.includes('蓄積分を全消費')
  ),
  'readiness states that LB consumes the charged bar'
);
assert.ok(
  lbReadiness.capitalComponents.some(
    (component) => component.label === '外部アライアンス1回（高難度補正なし）'
  ),
  'readiness states the once-per-battle cooperation assumption'
);
assert.ok(
  lbReadiness.capitalComponents.some(
    (component) => component.label === 'ぶんどる1回'
  ),
  'readiness states the capital boost assumption'
);

const campaignSummary = COMMUNITY_CAMPAIGN_ORDER.map((community, index) => {
  const targets = getCampaignProperties(INITIAL_PROPERTIES, community);
  assert.equal(targets.length, expectedCampaignCounts[index], `campaign target count: stage ${index + 1}`);
  assert.ok(targets.length <= 2, `normal city has at most two encounters: ${community}`);
  assert.deepEqual(
    targets.map((property) => property.id),
    expectedCampaignTargetIds[index],
    `authored existing-property encounters: stage ${index + 1}`
  );
  const maxPrice = Math.max(...targets.map((property) => property.marketPrice));
  assert.equal(maxPrice, expectedStageMaxPrices[index], `stage max price: stage ${index + 1}`);
  targets.forEach((property) => {
    const paybackSeconds = property.marketPrice /
      Math.max(1, property.annualRevenue * PASSIVE_REVENUE_MULTIPLIER);
    assert.ok(paybackSeconds >= 45 && paybackSeconds <= 210, `payback range: ${property.id}`);
  });
  const boss = targets.at(-1)!;
  assert.equal(isNormalCityBoss(INITIAL_PROPERTIES, boss), true);
  targets.slice(0, -1).forEach((property) =>
    assert.equal(isNormalCityBoss(INITIAL_PROPERTIES, property), false)
  );
  const expectedBossTier =
    index >= 9
      ? 'invincible'
      : index >= 7
        ? 'enhanced_cover'
        : index >= 3
          ? 'cover'
          : 'boss';
  assert.equal(
    getBossAbilityTier({
      targetProperty: boss,
      isCityBoss: true,
    }),
    expectedBossTier
  );
  return {
    stage: index + 1,
    targetCount: targets.length,
    minPrice: Math.min(...targets.map((property) => property.marketPrice)),
    maxPrice,
    revenuePerSecond: targets.reduce(
      (total, property) => total + property.annualRevenue * PASSIVE_REVENUE_MULTIPLIER,
      0
    ),
  };
});

const expectedNormalEnemySupportProfiles = [
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
COMMUNITY_CAMPAIGN_ORDER.forEach((community, index) => {
  const targets = getCampaignProperties(INITIAL_PROPERTIES, community);
  const boss = targets.at(-1)!;
  assert.deepEqual(
    getEnemySupportSkillProfile({
      targetProperty: boss,
      isCityBoss: true,
    }),
    expectedNormalEnemySupportProfiles[index],
    `normal city ${index + 1} has its authored enemy support profile`
  );
  if (targets.length > 1 && !targets[0].cartelId) {
    assert.deepEqual(
      getEnemySupportSkillProfile({
        targetProperty: targets[0],
        isCityBoss: false,
      }),
      [],
      `normal city ${index + 1} ordinary encounters keep the base AI`
    );
  }
});

const firstCartelMember = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_dofor_ship'
)!;
const firstCartelHeadquarters = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_dofor_hq'
)!;
const lateCartelMember = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_abyss_heavy'
)!;
const lateCartelHeadquarters = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_abyss_hq'
)!;
assert.deepEqual(
  getEnemySupportSkillProfile({
    targetProperty: firstCartelMember,
    isCityBoss: false,
  }),
  ['blackest_night', 'drain']
);
assert.deepEqual(
  getEnemySupportSkillProfile({
    targetProperty: firstCartelHeadquarters,
    isCityBoss: false,
  }),
  ['drain', 'divination']
);
assert.deepEqual(
  getEnemySupportSkillProfile({
    targetProperty: lateCartelMember,
    isCityBoss: false,
  }),
  ['drain', 'divination']
);
assert.deepEqual(
  getEnemySupportSkillProfile({
    targetProperty: lateCartelHeadquarters,
    isCityBoss: false,
  }),
  ['drain', 'drill']
);
assert.equal(
  getBossAbilityTier({
    targetProperty: firstCartelMember,
    isCityBoss: false,
  }),
  'cover'
);
assert.equal(
  getBossAbilityTier({
    targetProperty: lateCartelHeadquarters,
    isCityBoss: false,
  }),
  'enhanced_cover'
);
assert.deepEqual(
  getEnemySupportAutoProfile({
    targetProperty: firstCartelHeadquarters,
    isCityBoss: false,
  }),
  { opening: 'drain', critical: 'blackest_night' }
);
assert.deepEqual(
  getEnemySupportAutoProfile({
    targetProperty: lateCartelHeadquarters,
    isCityBoss: false,
  }),
  { opening: 'divination', critical: 'drill' }
);
assert.equal(getEnemyDifficultyLevel(firstCartelMember, false), 4);
assert.equal(getEnemyDifficultyLevel(firstCartelHeadquarters, false), 5);
assert.equal(getEnemyDifficultyLevel(lateCartelMember, false), 5);
assert.equal(getEnemyDifficultyLevel(lateCartelHeadquarters, false), 6);

for (let index = 4; index <= 8; index += 1) {
  assert.ok(
    campaignSummary[index].maxPrice > campaignSummary[index - 1].maxPrice,
    `mid-game price curve: stage ${index + 1}`
  );
}

const savageTargetIds = getSavageTargetIds(INITIAL_PROPERTIES);
const savageProperties = buildSavageProperties(INITIAL_PROPERTIES, new Set(), '検証商会');
assert.equal(savageTargetIds.length, 12);
assert.equal(savageProperties.length, savageTargetIds.length);
assert.equal(new Set(savageTargetIds).size, savageTargetIds.length);
assert.deepEqual(
  SAVAGE_SERIES_DEFINITIONS.map((series) => series.series),
  [1, 2, 3]
);
assert.deepEqual(
  SAVAGE_RAID_DEFINITIONS.map((raid) => raid.layer),
  [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4]
);
assert.equal(
  getDefaultOpenSavageSeries({
    clearedIds: [],
    unlockedIds: [SAVAGE_RAID_DEFINITIONS[0].id],
  }),
  1,
  'the compact high-end list opens the first playable Savage series'
);
assert.equal(
  getDefaultOpenSavageSeries({
    clearedIds: SAVAGE_RAID_DEFINITIONS.slice(0, 4).map((raid) => raid.id),
    unlockedIds: [SAVAGE_RAID_DEFINITIONS[4].id],
  }),
  2,
  'the disclosure follows the next playable series'
);
assert.equal(
  getDefaultOpenSavageSeries({
    clearedIds: SAVAGE_RAID_DEFINITIONS.map((raid) => raid.id),
    unlockedIds: SAVAGE_RAID_DEFINITIONS.map((raid) => raid.id),
  }),
  null,
  'all Savage series stay collapsed after all twelve clears'
);
assert.deepEqual(
  savageProperties.map((property) =>
    getEnemySupportSkillProfile({
      targetProperty: property,
      isCityBoss: false,
      isSavage: true,
    })
  ),
  [
    ['blackest_night'], ['drain', 'divination'], ['divination', 'capital_reversal'], ['blackest_night', 'drill', 'divination', 'capital_reversal', 'forced_liquidation'],
    ['drain'], ['blackest_night', 'divination'], ['drain', 'rapid_assault', 'capital_reversal'], ['blackest_night', 'divination', 'rapid_assault', 'limit_break_3', 'capital_reversal', 'forced_liquidation'],
    ['blackest_night', 'divination'], ['drill'], ['drain', 'rapid_assault', 'capital_reversal'], ['drill', 'divination', 'limit_break_3', 'capital_reversal', 'forced_liquidation'],
  ],
  'the twelve Savage layers must use the authored progression-specific support pattern'
);
assert.equal(
  savageProperties.filter((property) =>
    getEnemySupportSkillProfile({
      targetProperty: property,
      isCityBoss: false,
      isSavage: true,
    }).includes('drain')
  ).length,
  4,
  'Drain must stay a notable cash-pressure mechanic instead of appearing in every Savage layer'
);
assert.deepEqual(
  savageProperties.map((property) =>
    getEnemySupportAutoProfile({
      targetProperty: property,
      isCityBoss: false,
      isSavage: true,
    })
  ),
  [
    { opening: null, critical: null },
    { opening: null, critical: null },
    { opening: 'rapid_assault', critical: null },
    { opening: 'blackest_night', critical: 'drill' },
    { opening: null, critical: null },
    { opening: null, critical: null },
    { opening: 'divination', critical: null },
    { opening: 'divination', critical: 'limit_break_3' },
    { opening: null, critical: null },
    { opening: null, critical: null },
    { opening: 'divination', critical: null },
    { opening: 'rapid_assault', critical: 'limit_break_3' },
  ],
  'Savage layer three adds one authored opening check and layer four reserves its opening/critical pair'
);
assert.deepEqual(
  savageProperties.map((property) =>
    getOpeningBossAbilityTier({
      targetProperty: property,
      isSavage: true,
    })
  ),
  [
    'none', 'cover', 'none', 'none',
    'none', 'cover', 'none', 'none',
    'none', 'cover', 'none', 'none',
  ],
  'only every Savage layer-two boss opens with guaranteed normal Cover'
);
SAVAGE_SERIES_DEFINITIONS.forEach((series) => {
  assert.deepEqual(
    SAVAGE_RAID_DEFINITIONS
      .filter((raid) => raid.series === series.series)
      .map((raid) => raid.layer),
    [1, 2, 3, 4],
    `Savage series ${series.series} owns exactly layers 1 through 4`
  );
});
SAVAGE_SERIES_DEFINITIONS.forEach((series) => {
  const prices = SAVAGE_RAID_DEFINITIONS
    .filter((raid) => raid.series === series.series)
    .map((raid) => raid.marketPrice);
  assert.deepEqual(
    prices,
    [...prices].sort((left, right) => left - right),
    `Savage series ${series.series} prices rise through layers one to four`
  );
});
savageProperties.forEach((property) => {
  assert.match(property.name, /商戦 零式：第[1-4]層$/);
  assert.equal(property.annualRevenue, 0);
  assert.match(property.description, /所有権・毎秒収益・独立危険度は変化しません/);
});
assert.deepEqual(
  Array.from(getUnlockedSavageRaidIds(new Set())),
  [SAVAGE_RAID_DEFINITIONS[0].id]
);
assert.deepEqual(
  Array.from(getUnlockedSavageRaidIds(new Set([SAVAGE_RAID_DEFINITIONS[0].id]))),
  [SAVAGE_RAID_DEFINITIONS[0].id, SAVAGE_RAID_DEFINITIONS[1].id]
);
assert.deepEqual(
  Array.from(
    getUnlockedSavageRaidIds(
      new Set(SAVAGE_RAID_DEFINITIONS.slice(0, 4).map((raid) => raid.id))
    )
  ),
  SAVAGE_RAID_DEFINITIONS.slice(0, 5).map((raid) => raid.id),
  'clearing series 1 unlocks only series 2 layer 1'
);
assert.deepEqual(
  Array.from(
    getUnlockedSavageRaidIds(
      new Set(SAVAGE_RAID_DEFINITIONS.slice(0, 11).map((raid) => raid.id))
    )
  ),
  savageTargetIds,
  'the final chapter unlocks only after the preceding eleven chapters'
);

const normalCampaignIds = COMMUNITY_CAMPAIGN_ORDER.flatMap((community) =>
  getCampaignProperties(INITIAL_PROPERTIES, community).map((property) => property.id)
);
const authoredCampaignIds = CAMPAIGN_ENCOUNTER_DEFINITIONS.map(
  (definition) => definition.targetPropertyId
);
const retiredNormalPropertyIds = [
  'prop_starter_bakery',
  'prop_pub_central',
  'prop_horse_meat',
  'prop_blacksmith',
] as const;
assert.equal(new Set(normalCampaignIds).size, normalCampaignIds.length);
assert.deepEqual(authoredCampaignIds, normalCampaignIds);
const allNormalBusinessIds = INITIAL_PROPERTIES.filter(
  countsTowardCityConquest
).map((property) => property.id);
assert.deepEqual(
  [...normalCampaignIds].sort(),
  [...allNormalBusinessIds].sort(),
  'all sixteen retained businesses are real encounters and real network contacts'
);
assert.equal(normalCampaignIds.length, 16);
retiredNormalPropertyIds.forEach((propertyId) => {
  assert.equal(
    INITIAL_PROPERTIES.some((property) => property.id === propertyId),
    false,
    `${propertyId} is absent from assets, revenue and battle support`
  );
});
const raidMemberIds = SAVAGE_RAID_DEFINITIONS.flatMap((raid) => raid.memberPropertyIds);
assert.equal(raidMemberIds.length, allNormalBusinessIds.length);
assert.equal(new Set(raidMemberIds).size, raidMemberIds.length);
assert.deepEqual([...raidMemberIds].sort(), [...allNormalBusinessIds].sort());

const synergyIds = new Set(INITIAL_GROUP_SYNERGIES.map((synergy) => synergy.id));
assert.equal(
  getBossEnemyPartySize({ bossAbilityTier: 'none' }),
  1,
  'ordinary enemies remain a single actor'
);
assert.equal(
  getBossEnemyPartySize({ bossAbilityTier: 'cover' }),
  2,
  'early and mid-city bosses show a two-actor formation'
);
assert.equal(
  getBossEnemyPartySize({ bossAbilityTier: 'enhanced_cover' }),
  3,
  'late bosses show a three-actor formation'
);
assert.equal(
  getBossEnemyPartySize({
    bossAbilityTier: 'invincible',
    isUltimate: true,
  }),
  3,
  'ultimate encounters keep the complete boss formation at either frame rate'
);
const progressionBattleSynergies = INITIAL_GROUP_SYNERGIES.filter(
  (synergy) => synergy.battleOnly
);
assert.deepEqual(
  progressionBattleSynergies.map((synergy) => synergy.id),
  [
    'CRYSTAL_BRAVES',
    'LIGHT_OF_HOPE',
    GRAND_COMPANY_EORZEA_ID,
    ERA_WIND_SYNERGY_ID,
  ],
  'the four manual progression synergies keep their narrative order'
);
assert.equal(
  progressionBattleSynergies.every(
    (synergy) => synergy.bonusYieldMultiplier === 1
  ),
  true,
  'manual progression synergies never leak into passive revenue'
);
const conqueredThrough = (community: (typeof COMMUNITY_CAMPAIGN_ORDER)[number]) =>
  new Set(
    COMMUNITY_CAMPAIGN_ORDER.slice(
      0,
      COMMUNITY_CAMPAIGN_ORDER.indexOf(community) + 1
    )
  );
const noOwnedPropertyIds = new Set<string>();
const crystalBraves = progressionBattleSynergies[0];
const lightOfHope = progressionBattleSynergies[1];
const grandCompanyEorzea = progressionBattleSynergies[2];
const eraWindSynergy = progressionBattleSynergies[3];
assert.equal(
  grandCompanyEorzea.unlockAfterCommunity,
  'ラザハン',
  'Grand Company Eorzea is formed by the Radz-at-Han clear event'
);
assert.match(grandCompanyEorzea.description, /ラザハン/);
const uldahLuxuryMarket = INITIAL_GROUP_SYNERGIES.find(
  (synergy) => synergy.id === 'ULDAH_LUXURY_MARKET'
)!;
const unlockFastHorseSkill = INITIAL_SKILLS.find(
  (skill) => skill.id === 'skill_fast_horse'
)!;
const fastHorseExplanation = getSkillUnlockExplanation(unlockFastHorseSkill);
assert.equal(fastHorseExplanation.key, 'skill:skill_fast_horse');
assert.match(fastHorseExplanation.detail, /15秒間/);
assert.match(fastHorseExplanation.detail, /リキャストタイム/);
assert.doesNotMatch(fastHorseExplanation.detail, /再使用まで/);
assert.match(fastHorseExplanation.operation, /手動3枠/);
assert.match(fastHorseExplanation.operation, /開幕・瀕死枠/);
assert.doesNotMatch(fastHorseExplanation.operation, /控え|待機/);
const forestSynergyExplanation = getSynergyUnlockExplanation(
  INITIAL_GROUP_SYNERGIES[0]
);
assert.equal(
  forestSynergyExplanation.key,
  'synergy:GRIDANIA_FOREST_ECONOMY'
);
assert.match(forestSynergyExplanation.detail, /25%上昇/);
assert.match(forestSynergyExplanation.operation, /SYNERGY枠/);
const lightOfHopeExplanation = getSynergyUnlockExplanation(lightOfHope);
assert.match(lightOfHopeExplanation.detail, /12秒/);
assert.match(lightOfHopeExplanation.detail, /1.95倍/);
assert.match(lightOfHopeExplanation.operation, /手動発動/);
assert.equal(crystalBraves.battleEffect?.capitalPressureMultiplier, 1.16);
assert.equal(crystalBraves.battleEffect?.durationMs, 8_000);
assert.equal(crystalBraves.battleEffect?.ownershipPush, 2);
assert.ok(
  (lightOfHope.battleEffect?.capitalPressureMultiplier ?? 0) >
    uldahLuxuryMarket.bonusYieldMultiplier,
  'Light of Hope is explicitly stronger than the Ul dah synergy'
);
assert.equal(lightOfHope.battleEffect?.ownershipPush, 8);
assert.deepEqual(
  [
    crystalBraves.battleEffect?.durationMs,
    lightOfHope.battleEffect?.durationMs,
    grandCompanyEorzea.battleEffect?.durationMs,
    eraWindSynergy.battleEffect?.durationMs,
  ],
  [8_000, 12_000, 16_000, 16_000],
  'progression battle synergies use compressed 8-to-16-second windows'
);
assert.ok(
  (grandCompanyEorzea.battleEffect?.capitalPressureMultiplier ?? 0) >
    (lightOfHope.battleEffect?.capitalPressureMultiplier ?? 0),
  'Grand Company Eorzea remains stronger than Light of Hope'
);
assert.equal(grandCompanyEorzea.battleEffect?.ownershipPush, 12);
assert.equal(eraWindSynergy.id, ERA_WIND_SYNERGY_ID);
assert.equal(
  eraWindSynergy.unlockAfterAllCartelHqs,
  true,
  'Era Wind unlocks after every enterprise-alliance headquarters is conquered'
);
assert.ok(
  (eraWindSynergy.battleEffect?.capitalPressureMultiplier ?? 0) >
    (grandCompanyEorzea.battleEffect?.capitalPressureMultiplier ?? 0),
  'Era Wind is the direct upgrade above Grand Company Eorzea'
);
assert.equal(eraWindSynergy.battleEffect?.capitalPressureMultiplier, 2.18);
assert.equal(eraWindSynergy.battleEffect?.limitBreakChargeMultiplier, 1.25);
assert.equal(eraWindSynergy.battleEffect?.continuousGaugePushPerSecond, 0.85);
assert.equal(eraWindSynergy.battleEffect?.countersMarketWind, true);
assert.equal(
  isGroupSynergyUnlocked({
    synergy: eraWindSynergy,
    ownedPropertyIds: noOwnedPropertyIds,
    conqueredCommunityIds: new Set(),
    savageClearedRaidIds: new Set(),
  }),
  false
);
assert.equal(
  isGroupSynergyUnlocked({
    synergy: eraWindSynergy,
    ownedPropertyIds: new Set(eraWindSynergy.requiredPropertyIds),
    conqueredCommunityIds: new Set(),
    savageClearedRaidIds: new Set(),
  }),
  true,
  'owning every authored alliance HQ unlocks Era Wind without a Savage gate'
);
const grandCompanyReadinessEquivalent =
  calculateBattleSynergyReadinessEquivalent({
    targetMarketPrice: 6_000_000_000,
    synergy: grandCompanyEorzea,
    followUpCapital: 1_000_000_000,
  });
assert.ok(
  grandCompanyReadinessEquivalent > 0,
  'readiness values the selected manual progression synergy instead of omitting it'
);
const ultimateReadinessWithGrandCompany = calculateBattleReadiness({
  targetMarketPrice: 6_000_000_000,
  availableCash: 6_000_000_000,
  subsidiaries: [],
  selectedBattleSynergy: grandCompanyEorzea,
  limitBreakCharge: 0,
  allianceSupport: 0,
  hasCapitalBoost: false,
  enemyBudget: 16_500_000_000,
  enemyDifficultyLevel: 6,
  enemyBaseReactionSeconds: 1.5,
  playerPushBonus: 0,
  battleMode: 'ultimate',
});
assert.ok(
  ultimateReadinessWithGrandCompany.capitalComponents.some(
    (component) => component.key === 'battle_synergy'
  ),
  'the pre-battle breakdown names the selected manual synergy contribution'
);
assert.equal(ultimateReadinessWithGrandCompany.mechanicCheckRequired, true);
assert.match(
  ultimateReadinessWithGrandCompany.mechanicWarning ?? '',
  /開幕・瀕死/
);
assert.equal(
  isGroupSynergyUnlocked({
    synergy: crystalBraves,
    ownedPropertyIds: noOwnedPropertyIds,
    conqueredCommunityIds: conqueredThrough('リムサ・ロミンサ'),
  }),
  false
);
assert.equal(
  isGroupSynergyUnlocked({
    synergy: crystalBraves,
    ownedPropertyIds: noOwnedPropertyIds,
    conqueredCommunityIds: conqueredThrough('ウルダハ'),
  }),
  true,
  'Crystal Braves unlocks after Ul dah'
);
assert.equal(
  isGroupSynergyUnlocked({
    synergy: lightOfHope,
    ownedPropertyIds: noOwnedPropertyIds,
    conqueredCommunityIds: conqueredThrough('イシュガルド'),
  }),
  true,
  'Light of Hope replaces the prototype after Ishgard'
);
assert.equal(
  isGroupSynergyUnlocked({
    synergy: grandCompanyEorzea,
    ownedPropertyIds: noOwnedPropertyIds,
    conqueredCommunityIds: conqueredThrough('オールド・シャーレアン'),
  }),
  false
);
assert.equal(
  isGroupSynergyUnlocked({
    synergy: grandCompanyEorzea,
    ownedPropertyIds: noOwnedPropertyIds,
    conqueredCommunityIds: conqueredThrough('ラザハン'),
  }),
  true,
  'Grand Company Eorzea unlocks after Radz-at-Han'
);
assert.equal(
  isGroupSynergyUnlocked({
    synergy: grandCompanyEorzea,
    ownedPropertyIds: noOwnedPropertyIds,
    conqueredCommunityIds: conqueredThrough('トライヨラ'),
  }),
  true
);
assert.equal(
  isGroupSynergyUnlocked({
    synergy: grandCompanyEorzea,
    ownedPropertyIds: noOwnedPropertyIds,
    conqueredCommunityIds: conqueredThrough('ソリューション・ナイン'),
  }),
  true,
  'Grand Company Eorzea remains unlocked through the normal finale'
);
assert.equal(
  getLatestProgressionBattleSynergy([
    crystalBraves,
    lightOfHope,
  ])?.id,
  'LIGHT_OF_HOPE',
  'only the highest unlocked generation remains selectable'
);
SAVAGE_RAID_DEFINITIONS.forEach((raid) => {
  assert.ok(
    INITIAL_PROPERTIES.some((property) => property.id === raid.battlePropertyId),
    `Savage battle property exists: ${raid.battlePropertyId}`
  );
  raid.memberPropertyIds.forEach((id) => {
    assert.ok(
      INITIAL_PROPERTIES.some((property) => property.id === id),
      `Savage member property exists: ${id}`
    );
  });
  raid.rewardSynergyIds.forEach((id) => {
    assert.ok(synergyIds.has(id), `Savage reward synergy exists: ${id}`);
  });
});
const savageUpgradeableSynergyIds = new Set(
  INITIAL_GROUP_SYNERGIES
    .filter(
      (synergy) =>
        !synergy.battleOnly || synergy.id === GRAND_COMPANY_EORZEA_ID
    )
    .map((synergy) => synergy.id)
);
assert.deepEqual(
  new Set(SAVAGE_RAID_DEFINITIONS.flatMap((raid) => raid.rewardSynergyIds)),
  savageUpgradeableSynergyIds,
  'passive synergies and Grand Company Eorzea have Savage upgrade routes'
);
assert.deepEqual(
  SAVAGE_RAID_DEFINITIONS.slice(0, 4).map((raid) => raid.id),
  ['prop_starter_farm', 'prop_blacksmith', 'prop_wheat_farm', 'prop_abyss_heavy'],
  'the former four direct save IDs remain the first series migration targets'
);
const legacyFirstLayerMemberIds = [
  'prop_starter_farm',
  'prop_starter_bakery',
  'prop_timber_ake',
  'prop_land_transport',
  'prop_brewery_beer',
  'prop_iron_mine',
  'prop_pub_central',
  'prop_casino_grand',
];
assert.deepEqual(
  normalizeSavageClearedRaidIds(
    legacyFirstLayerMemberIds,
    undefined
  ),
  savageTargetIds.slice(0, 4),
  'a legacy regional layer expands to every new chapter carrying its rewards'
);
assert.deepEqual(
  normalizeSavageClearedRaidIds(
    legacyFirstLayerMemberIds.slice(0, -1),
    undefined
  ),
  [],
  'partial legacy regional progress does not skip the new coalition encounter'
);
assert.deepEqual(
  normalizeSavageClearedRaidIds(savageTargetIds.slice(0, 2), 3),
  savageTargetIds.slice(0, 2),
  'current twelve-chapter progress remains direct'
);
assert.deepEqual(
  normalizeSavageClearedRaidIds(savageTargetIds.slice(0, 2), 2),
  savageTargetIds.slice(0, 8),
  'the first two former layers expand to the first two four-chapter reward groups'
);
assert.deepEqual(
  normalizeSavageClearedRaidIds([savageTargetIds[2]], 2),
  savageTargetIds.slice(8, 10),
  'the former third layer expands to its two replacement chapters'
);
assert.deepEqual(
  normalizeSavageClearedRaidIds(savageTargetIds.slice(0, 4), 2),
  savageTargetIds,
  'a former four-layer clear preserves the already unlocked Ultimate duty'
);
assert.deepEqual(
  normalizeSavageClearedRaidIds(
    [...allNormalBusinessIds, ...retiredNormalPropertyIds],
    undefined
  ),
  savageTargetIds,
  'a complete pre-versioned twenty-encounter clear also remains complete'
);
assert.deepEqual(
  normalizeSavageClearedRaidIds([], 2, true),
  savageTargetIds,
  'an acknowledged legacy completion preserves every unlock including Ultimate'
);
const migratedLegacyLayerOne = new Set(
  normalizeSavageClearedRaidIds(legacyFirstLayerMemberIds, undefined)
);
legacyFirstLayerMemberIds
  .filter((propertyId) => allNormalBusinessIds.includes(propertyId))
  .forEach((propertyId) => {
  assert.equal(
    getSavagePropertyYieldMultiplier(propertyId, migratedLegacyLayerOne),
    1 + SAVAGE_PROPERTY_YIELD_BONUS,
    `legacy first-layer property reward remains intact: ${propertyId}`
  );
  });
assert.deepEqual(
  Array.from(getSavageSynergyRanks(migratedLegacyLayerOne).entries()).sort(),
  [
    ['EORZEA_FOOD_ROUTE', 1],
    ['GRAND_COMPANY_EORZEA', 1],
    ['GRIDANIA_FOREST_ECONOMY', 1],
    ['ULDAH_LUXURY_MARKET', 1],
  ],
  'legacy first-layer synergy ranks are neither lost nor over-granted'
);

const fullyClearedSavage = buildSavageProperties(
  INITIAL_PROPERTIES,
  new Set(savageTargetIds),
  '検証商会'
);
assert.equal(fullyClearedSavage.every((property) => property.owner === 'player'), true);
assert.equal(
  INITIAL_PROPERTIES.some((property) => property.owner === 'player'),
  false,
  'savage derivation never mutates normal ownership'
);

const savageRanks = getSavageSynergyRanks(new Set(savageTargetIds));
const upgradedSynergies = applySavageSynergyUpgrades(
  INITIAL_GROUP_SYNERGIES,
  new Set(savageTargetIds)
);
upgradedSynergies.forEach((synergy) => {
  const rank = savageRanks.get(synergy.id) ?? 0;
  const base = INITIAL_GROUP_SYNERGIES.find((item) => item.id === synergy.id)!;
  if (synergy.battleOnly) {
    assert.equal(synergy.bonusYieldMultiplier, base.bonusYieldMultiplier);
    assert.equal(synergy.battleGroupMultiplier, base.battleGroupMultiplier);
    assert.equal(
      synergy.battleEffect?.capitalPressureMultiplier,
      Number(
        (
          (base.battleEffect?.capitalPressureMultiplier ?? 1) +
          rank * SAVAGE_BATTLE_ONLY_CAPITAL_BONUS_PER_RANK
        ).toFixed(2)
      )
    );
    return;
  }
  assert.equal(
    synergy.bonusYieldMultiplier,
    Number((base.bonusYieldMultiplier + rank * SAVAGE_YIELD_BONUS_PER_RANK).toFixed(2))
  );
  assert.equal(
    synergy.battleGroupMultiplier,
    Number((SAVAGE_GROUP_MULTIPLIER_BASE + rank * SAVAGE_GROUP_MULTIPLIER_BONUS_PER_RANK).toFixed(2))
  );
});
assert.equal(
  getSavagePropertyYieldMultiplier('prop_coffee_aurora', new Set(savageTargetIds)),
  1 + SAVAGE_PROPERTY_YIELD_BONUS
);
assert.equal(
  getSavagePropertyYieldMultiplier('prop_dofor_hq', new Set(savageTargetIds)),
  1,
  'optional cartel properties are not silently upgraded'
);

const ultimateProperty = buildUltimateProperty(false, '検証商会');
assert.equal(ultimateProperty.id, ULTIMATE_RAID_DEFINITION.id);
assert.equal(ultimateProperty.annualRevenue, 0);
assert.deepEqual(
  getEnemySupportSkillProfile({
    targetProperty: ultimateProperty,
    isCityBoss: false,
    isUltimate: true,
  }),
  ['blackest_night', 'drain', 'drill', 'divination', 'capital_reversal', 'forced_liquidation'],
  'Ultimate exposes the complete sequential enemy support kit'
);
assert.deepEqual(
  getEnemySupportAutoProfile({
    targetProperty: ultimateProperty,
    isCityBoss: false,
    isUltimate: true,
  }),
  { opening: 'drain', critical: 'drill' },
  'Ultimate reserves both an opening and a critical automatic ability'
);
assert.equal(ULTIMATE_ENEMY_AUTO_PATTERNS.length, 6);
assert.ok(
  ULTIMATE_ENEMY_AUTO_PATTERNS.some(
    (pattern) => pattern.opening === 'rapid_assault'
  ),
  'Ultimate can open with the enemy equivalent of Fast Action'
);
assert.ok(
  ULTIMATE_ENEMY_AUTO_PATTERNS.some(
    (pattern) => pattern.opening === 'limit_break_3'
  ) &&
    ULTIMATE_ENEMY_AUTO_PATTERNS.some(
      (pattern) => pattern.critical === 'limit_break_3'
    ),
  'Ultimate LB3 can be selected either as the opening shock or the critical surprise'
);
ULTIMATE_ENEMY_AUTO_PATTERNS.forEach((pattern, index) => {
  assert.deepEqual(
    getEnemySupportAutoProfile({
      targetProperty: ultimateProperty,
      isCityBoss: false,
      isUltimate: true,
      ultimatePatternIndex: index,
    }),
    { opening: pattern.opening, critical: pattern.critical }
  );
});
assert.equal(
  shouldForceUltimateCriticalBeforeVictory({
    isUltimate: true,
    terminalWinner: 'player',
    criticalSkillId: 'limit_break_3',
    criticalSkillUsed: false,
    gateConsumed: false,
    enemyReserve: 0,
    enemyBudget: 1,
  }),
  true,
  'Ultimate resolves its critical action before accepting player victory'
);
assert.equal(
  shouldForceUltimateCriticalBeforeVictory({
    isUltimate: false,
    terminalWinner: 'player',
    criticalSkillId: 'limit_break_3',
    criticalSkillUsed: false,
    gateConsumed: false,
    enemyReserve: 0,
    enemyBudget: 1,
  }),
  false,
  'the critical victory gate never leaks into normal or Savage battles'
);
assert.equal(
  shouldForceUltimateCriticalBeforeVictory({
    isUltimate: true,
    terminalWinner: 'player',
    criticalSkillId: 'drill',
    criticalSkillUsed: false,
    gateConsumed: false,
    enemyReserve: 0,
    enemyBudget: 10_000,
  }),
  false,
  'draining the Drill reserve remains a valid Ultimate counterplay'
);
assert.ok(
  ultimateProperty.marketPrice > savageProperties[savageProperties.length - 1].marketPrice
);
assert.match(ultimateProperty.description, /単独・最終高難度交易戦/);

const cruelProperty = buildCruelProperty(false, '検証商会');
assert.equal(cruelProperty.id, CRUEL_RAID_DEFINITION.id);
assert.equal(
  cruelProperty.marketPrice,
  ULTIMATE_RAID_DEFINITION.marketPrice * 1.25,
  'Cruel starts at 1.25 times the current Ultimate market price'
);
assert.equal(cruelProperty.annualRevenue, 0);
assert.equal(cruelProperty.countsTowardCityConquest, false);
assert.equal(getEnemyDifficultyLevel(cruelProperty, false, false, false, false, true), 6);
assert.equal(
  getBossAbilityTier({
    targetProperty: cruelProperty,
    isCityBoss: false,
    isCruel: true,
  }),
  'enhanced_cover',
  'Cruel uses Passage instead of inheriting Ultimate invincibility'
);
assert.deepEqual(
  getEnemySupportSkillProfile({
    targetProperty: cruelProperty,
    isCityBoss: false,
    isCruel: true,
  }),
  ['blackest_night', 'drill', 'divination', 'rapid_assault', 'limit_break_3'],
  'Cruel deliberately excludes Drain so its two capital assessments stay legible'
);
assert.deepEqual(
  getEnemySupportAutoProfile({
    targetProperty: cruelProperty,
    isCityBoss: false,
    isCruel: true,
  }),
  { opening: 'divination', critical: null },
  'Cruel always opens with Divination and reserves its critical beat for Omnicapitalization'
);
assert.equal(
  calculateBattleVictoryReward(cruelProperty.marketPrice, true, 'cruel'),
  0,
  'Cruel awards only its record and title, never repeatable cash'
);

const exportedBattleContent = JSON.parse(
  JSON.stringify(BATTLE_CONTENT_MANIFEST)
);
assert.equal(exportedBattleContent.schemaVersion, BATTLE_CONTENT_SCHEMA_VERSION);
assert.equal(
  exportedBattleContent.enemySupportActions.length,
  Object.keys(ENEMY_SUPPORT_ACTIONS).length,
  'Unity/editor battle content manifest must survive a JSON round trip'
);
assert.equal(
  exportedBattleContent.enemySupportActions.some(
    (action: { id?: string }) => action.id === 'limit_break_3'
  ),
  true
);

assert.equal(CRUEL_SCRIPTED_BATTLE.firstTriggerActiveMs, 15_000);
assert.equal(resolveCruelFirstImpact(90), 10);
assert.equal(resolveCruelFirstImpact(5), 5);
assert.equal(
  shouldTriggerCruelFirstPhase({
    isCruel: true,
    phase: 'awaiting_first',
    activeElapsedMs: 15_000,
  }),
  true,
  'Cruel first declaration follows active battle time, not ownership'
);
assert.equal(
  shouldTriggerCruelSecondPhase({
    phase: 'recovery',
    currentPlayerOwnership: 50,
    recoveryElapsedMs: 1_000,
  }),
  true,
  'recovering to 50% starts the second declaration once'
);
assert.equal(
  shouldTriggerCruelSecondPhase({
    phase: 'recovery',
    currentPlayerOwnership: 20,
    recoveryElapsedMs: 35_000,
  }),
  true,
  'the second declaration is forced before a two-minute mud fight'
);
const cruelSignatureRequirement = calculateCruelSignatureRequirement(
  cruelProperty.marketPrice
);
assert.equal(cruelSignatureRequirement, 750_000_000);
assert.equal(
  calculateCruelEntryRequirement(cruelProperty.marketPrice),
  975_000_000,
  'Cruel entry reserves its 3% brokerage fee and 10% self-capital signature'
);
assert.equal(
  resolveCruelRecoveryContinuousVelocity({
    velocity: -8,
    isCruel: true,
    phase: 'recovery',
  }),
  -4,
  'only player-favorable continuous pressure is halved during Cruel recovery'
);
assert.equal(
  resolveCruelRecoveryContinuousVelocity({
    velocity: 8,
    isCruel: true,
    phase: 'recovery',
  }),
  8,
  'enemy-favorable continuous pressure stays unchanged during Cruel recovery'
);
assert.equal(
  resolveCruelRecoveryContinuousVelocity({
    velocity: -8,
    isCruel: true,
    phase: 'second_countdown',
  }),
  -8,
  'the second assessment countdown uses normal continuous pressure'
);
assert.equal(
  resolveCruelRecoveryContinuousVelocity({
    velocity: -8,
    isCruel: false,
    phase: 'recovery',
  }),
  -8,
  'the recovery modifier never leaks into another difficulty'
);
assert.deepEqual(resolveCruelSecondImpact(
  75,
  cruelSignatureRequirement,
  cruelProperty.marketPrice
), {
  outcome: 'break',
  ownershipBefore: 75,
  ownershipAfter: 75,
  ownershipSatisfied: true,
  signatureSatisfied: true,
  signaturePaid: cruelSignatureRequirement,
  signatureRequired: cruelSignatureRequirement,
});
assert.deepEqual(resolveCruelSecondImpact(
  50,
  cruelSignatureRequirement,
  cruelProperty.marketPrice
), {
  outcome: 'defeat',
  ownershipBefore: 50,
  ownershipAfter: 0,
  ownershipSatisfied: false,
  signatureSatisfied: true,
  signaturePaid: cruelSignatureRequirement,
  signatureRequired: cruelSignatureRequirement,
});
assert.deepEqual(resolveCruelSecondImpact(
  75,
  cruelSignatureRequirement - 1,
  cruelProperty.marketPrice
), {
  outcome: 'defeat',
  ownershipBefore: 75,
  ownershipAfter: 0,
  ownershipSatisfied: true,
  signatureSatisfied: false,
  signaturePaid: cruelSignatureRequirement - 1,
  signatureRequired: cruelSignatureRequirement,
});
assert.equal(shouldHoldCruelVictory(true, 'second_failed'), true);
assert.equal(shouldHoldCruelVictory(true, 'second_countdown'), true);
assert.equal(shouldHoldCruelVictory(true, 'resolved'), false);

assert.equal(
  calculateBattleVictoryReward(600_000_000, true, 'savage', false),
  30_000_000,
  'first Savage clear grants its one-time record reward'
);
assert.equal(
  calculateBattleVictoryReward(600_000_000, true, 'savage', true),
  0,
  'Savage replay cannot farm the record reward'
);
assert.equal(
  calculateBattleVictoryReward(3_000_000_000, true, 'ultimate', false),
  0,
  'Ultimate is an honor clear and never a repeatable cash source'
);

assert.deepEqual(
  TRAINING_DUMMY_DEFINITIONS.map((definition) => definition.level),
  [1, 2, 3, 4, 5],
  'training dummies provide exactly LEVEL 1 through LEVEL 5'
);
assert.equal(
  TRAINING_DUMMY_DEFINITIONS[0].marketPrice,
  7_500,
  'LEVEL 1 training dummy keeps its reduced entry-level durability'
);
const trainingDummyIds = TRAINING_DUMMY_DEFINITIONS.map(
  (definition) => definition.id
);
const trainingDummyIdSet = new Set<string>(trainingDummyIds);
assert.equal(
  trainingDummyIdSet.size,
  trainingDummyIds.length,
  'training dummy IDs are unique'
);
for (let index = 1; index < TRAINING_DUMMY_DEFINITIONS.length; index += 1) {
  const previous = TRAINING_DUMMY_DEFINITIONS[index - 1];
  const current = TRAINING_DUMMY_DEFINITIONS[index];
  assert.ok(
    current.marketPrice > previous.marketPrice,
    `training dummy price increases from LEVEL ${previous.level} to ${current.level}`
  );
  assert.ok(
    current.requiredConqueredCommunityCount >
      previous.requiredConqueredCommunityCount,
    `training dummy unlock threshold increases from LEVEL ${previous.level} to ${current.level}`
  );
}
TRAINING_DUMMY_DEFINITIONS.forEach((definition) => {
  const property = buildTrainingDummyProperty(definition);
  assert.equal(property.annualRevenue, 0);
  assert.equal(countsTowardCityConquest(property), false);
  assert.equal(
    isTrainingDummyUnlocked(
      definition,
      definition.requiredConqueredCommunityCount
    ),
    true
  );
  if (definition.requiredConqueredCommunityCount > 0) {
    assert.equal(
      isTrainingDummyUnlocked(
        definition,
        definition.requiredConqueredCommunityCount - 1
      ),
      false
    );
  }
  assert.equal(
    calculateBattleVictoryReward(
      definition.marketPrice,
      true,
      'training',
      false
    ),
    0,
    `training victory grants no reward at LEVEL ${definition.level}`
  );
  assert.equal(
    calculateBattleVictoryReward(
      definition.marketPrice,
      false,
      'training',
      false
    ),
    0,
    `training defeat grants no reward at LEVEL ${definition.level}`
  );
});
assert.equal(
  INITIAL_PROPERTIES.some(
    (property) =>
      property.id.startsWith('training_dummy_') ||
      trainingDummyIdSet.has(property.id)
  ),
  false,
  'training dummies never enter INITIAL_PROPERTIES'
);

const optionalCartelIds = new Set([
  'prop_dofor_ship',
  'prop_dofor_bank',
  'prop_dofor_shipping',
  'prop_dofor_hq',
  'prop_abyss_dark',
  'prop_abyss_hq',
]);
INITIAL_PROPERTIES.filter((property) => optionalCartelIds.has(property.id)).forEach((property) => {
  assert.equal(countsTowardCityConquest(property), false, `optional cartel gate: ${property.id}`);
});
assert.equal(countsTowardCityConquest(INITIAL_PROPERTIES.find((property) => property.id === 'prop_abyss_heavy')!), true);
assert.equal(countsTowardCityConquest(INITIAL_PROPERTIES.find((property) => property.id === 'prop_abyss_mine')!), true);

const grandCompanyCandidates = ALLIANCE_CANDIDATES.filter(
  (candidate) => candidate.allyKind === 'grand_company'
);
assert.deepEqual(GRAND_COMPANY_NAMES, ['双蛇党', '黒渦団', '不滅隊']);
assert.equal(grandCompanyCandidates.length, 3);
const propertyAndCartelText = [
  ...INITIAL_PROPERTIES.flatMap((property) => [property.name, property.ownerName]),
  ...INITIAL_CARTELS.flatMap((cartel) => [cartel.name, cartel.description, cartel.id, cartel.hqPropertyId, ...cartel.subsidiaryIds]),
].join(' ');
GRAND_COMPANY_NAMES.forEach((name) => {
  assert.equal(propertyAndCartelText.includes(name), false, `Grand Company is not buyout data: ${name}`);
});
grandCompanyCandidates.forEach((candidate) => {
  assert.equal('marketPrice' in candidate, false);
  assert.equal(candidate.relationType, 'public_patronage');
  const restored = normalizeAllianceState(JSON.parse(JSON.stringify({ ...candidate, active: true })));
  assert.equal(restored.allyKind, 'grand_company');
  assert.equal(restored.relationType, 'public_patronage');
  assert.equal(restored.allyName, candidate.allyName);
  assert.equal(shouldBreakAllianceForTarget(restored, { ownerName: '通常の独立企業' }), false);
});
const legacyGarlandAlliance = normalizeAllianceState({
  allyId: 'garland_ironworks',
  allyName: 'ガーロンド・アイアンワークス',
  active: true,
});
assert.equal(legacyGarlandAlliance.allyKind, 'company');
assert.equal(legacyGarlandAlliance.relationType, 'commercial_alliance');
assert.equal(
  shouldBreakAllianceForTarget(legacyGarlandAlliance, { ownerName: 'ガーロンド・アイアンワークス系列' }),
  true
);
assert.equal(calculateAllianceSupport(1_000_000), 750_000);
const agoraTradeAgreement = INITIAL_PROPERTIES.find(
  (property) => property.id === 'prop_abyss_hq'
)!;
assert.equal(
  calculateAllianceSupport(agoraTradeAgreement.marketPrice),
  calculateSubsidiarySupportAmount(agoraTradeAgreement),
  'one external alliance request must match one full-strength Agora network request at the same scale'
);
assert.equal(getRepeatedNetworkSupportMultiplier(0), 1);
assert.equal(getRepeatedNetworkSupportMultiplier(1), 0.9);
assert.equal(getRepeatedNetworkSupportMultiplier(2), 0.8);
assert.equal(
  getRepeatedNetworkSupportMultiplier(99),
  REPEATED_NETWORK_SUPPORT_BALANCE.minimumMultiplier
);

const extremeBaseProperty = {
  ...INITIAL_PROPERTIES.find((property) => property.id === 'prop_coffee_aurora')!,
  owner: 'independent' as const,
  ownerName: '独立物件',
  reacquisitionLevel: 0,
};
const extremeLevelOneProperty = {
  ...extremeBaseProperty,
  reacquisitionLevel: 1,
};
const extremeLevelTwoProperty = {
  ...extremeBaseProperty,
  reacquisitionLevel: 2,
};
assert.equal(isExtremeReacquisition(extremeBaseProperty), false);
assert.equal(isExtremeReacquisition(extremeLevelOneProperty), true);
assert.deepEqual(
  EXTREME_REACQUISITION_BALANCE.budgetMultiplierByLevel,
  [1, 1.2, 1.35]
);
assert.equal(getExtremeReacquisitionBudgetMultiplier(extremeLevelOneProperty), 1.2);
assert.equal(getExtremeReacquisitionBudgetMultiplier(extremeLevelTwoProperty), 1.35);
assert.equal(
  getEnemyDifficultyLevel(extremeLevelOneProperty, false),
  Math.min(5, getEnemyDifficultyLevel(extremeBaseProperty, false) + 1),
  'Extreme raises normal AI by one level but never above LEVEL 5'
);
assert.equal(
  getEnemyDifficultyLevel(extremeLevelTwoProperty, false),
  5,
  'late Extreme reacquisition remains capped at LEVEL 5'
);
assert.equal(
  getExtremeReacquisitionOpeningSkill(extremeLevelOneProperty),
  'drill',
  'late returning companies retain one representative opening action'
);
const baseReacquisitionBudget = calculateEnemyBudget({
  targetProperty: extremeBaseProperty,
  industryInfluence: noInfluence,
  regionalInfluence: noInfluence,
  isTutorial: false,
});
const levelOneReacquisitionBudget = calculateEnemyBudget({
  targetProperty: extremeLevelOneProperty,
  industryInfluence: noInfluence,
  regionalInfluence: noInfluence,
  isTutorial: false,
});
const levelTwoReacquisitionBudget = calculateEnemyBudget({
  targetProperty: extremeLevelTwoProperty,
  industryInfluence: noInfluence,
  regionalInfluence: noInfluence,
  isTutorial: false,
});
assert.ok(
  Math.abs(levelOneReacquisitionBudget / baseReacquisitionBudget - 1.2) < 0.0001
);
assert.ok(
  Math.abs(levelTwoReacquisitionBudget / baseReacquisitionBudget - 1.35) < 0.0001
);
assert.equal(
  calculateSubsidiarySupportAmount(
    { ...INITIAL_PROPERTIES[0], marketPrice: 100_000, reacquisitionLevel: 0 },
    1
  ),
  67_500,
  'the second battle-local network request decays by ten percent'
);
assert.equal(calculateLimitBreakPushGilEquivalent(1_000_000, 8.5), 100_000);
assert.deepEqual(
  INITIAL_CARTELS.map((cartel) =>
    calculateCartelHeadquartersDefense(
      cartel,
      cartel.subsidiaryIds.length,
      cartel.subsidiaryIds.length
    )
  ),
  [50_000_000, 250_000_000],
  'all enterprise-alliance headquarters keep the same 5% defense floor'
);
assert.equal(getLimitBreakTier(4), 1, 'public patronage never changes participating company count');
const worldText = INITIAL_PROPERTIES.flatMap((property) => [property.name, property.description, property.ownerName]).join(' ');
['フォルタン家騎兵牧場', 'ハイウィンド飛空社', 'ラストスタンド食材組合', 'ゴールドソーサー運営局'].forEach((legacyLabel) => {
  assert.equal(worldText.includes(legacyLabel), false, `world-text migration: ${legacyLabel}`);
});
assert.match(worldText, /MGPそのものをギルへ換金する事業ではない/);
assert.match(worldText, /知識・技術交易連盟/);
const restoredWorldCopy = restoreProperties({
  schemaVersion: 3,
  companyName: '旧セーブ商会',
  totalFunds: 100_000,
  properties: [
    { id: 'prop_abyss_heavy', owner: 'independent', ownerName: '独立物件', loyaltyRisk: 0 },
    { id: 'prop_abyss_mine', owner: 'abyss', ownerName: '古い連盟表示', loyaltyRisk: 0 },
    { id: 'prop_starter_farm', owner: 'player', ownerName: '旧セーブ商会', loyaltyRisk: 12 },
    { id: 'prop_starter_bakery', owner: 'player', ownerName: '旧セーブ商会', loyaltyRisk: 0 },
    { id: 'prop_pub_central', owner: 'player', ownerName: '旧セーブ商会', loyaltyRisk: 0 },
    { id: 'prop_horse_meat', owner: 'player', ownerName: '旧セーブ商会', loyaltyRisk: 0 },
    { id: 'prop_blacksmith', owner: 'independent', ownerName: '独立物件', loyaltyRisk: 0, reacquisitionLevel: 1 },
    {
      id: 'prop_timber_ake',
      owner: 'player',
      ownerName: '旧セーブ商会',
      loyaltyRisk: 0,
      reacquisitionLevel: 2,
    },
  ],
  equippedSkillIds: [],
  alliance: { allyId: '', allyName: '', active: false },
  lastSavedAt: 1,
});
assert.equal(restoredWorldCopy.find((property) => property.id === 'prop_abyss_heavy')?.ownerName, '独立物件');
assert.equal(restoredWorldCopy.find((property) => property.id === 'prop_abyss_heavy')?.owner, 'independent');
assert.equal(restoredWorldCopy.find((property) => property.id === 'prop_abyss_mine')?.ownerName, '知識・技術交易連盟');
assert.equal(restoredWorldCopy.find((property) => property.id === 'prop_starter_farm')?.ownerName, '旧セーブ商会');
retiredNormalPropertyIds.forEach((propertyId) => {
  assert.equal(
    restoredWorldCopy.some((property) => property.id === propertyId),
    false,
    `old saves cannot restore retired support contact ${propertyId}`
  );
});
assert.equal(
  restoredWorldCopy.find((property) => property.id === 'prop_starter_farm')
    ?.reacquisitionLevel,
  0,
  'old schema-v3 saves default the reacquisition level to zero'
);
assert.equal(
  restoredWorldCopy.find((property) => property.id === 'prop_timber_ake')
    ?.reacquisitionLevel,
  2,
  'new schema-v3 saves restore the optional reacquisition level'
);
const enemyBudgetRatio = (propertyId: string, isTutorial = false) => {
  const property = INITIAL_PROPERTIES.find((candidate) => candidate.id === propertyId)!;
  return calculateEnemyBudget({
    targetProperty: property,
    industryInfluence: noInfluence,
    regionalInfluence: noInfluence,
    isTutorial,
  }) / property.marketPrice;
};
assert.ok(Math.abs(enemyBudgetRatio('prop_starter_farm', true) - 0.315) < 0.001);
assert.ok(Math.abs(enemyBudgetRatio('prop_timber_ake') - 0.5526) < 0.001);
assert.ok(Math.abs(enemyBudgetRatio('prop_land_transport') - 0.6331) < 0.001);
assert.ok(Math.abs(enemyBudgetRatio('prop_brewery_beer') - 1.2661) < 0.001);
assert.ok(Math.abs(enemyBudgetRatio('prop_casino_grand') - 0.9327) < 0.001);
assert.ok(Math.abs(enemyBudgetRatio('prop_coffee_aurora') - 1.5252) < 0.001);
assert.ok(Math.abs(enemyBudgetRatio('prop_abyss_heavy') - 2.0321) < 0.001);
assert.ok(Math.abs(enemyBudgetRatio('prop_abyss_hq') - 2.3976) < 0.001);
const savageBudgetTarget = savageProperties[0];
const savageBudget = calculateEnemyBudget({
  targetProperty: savageBudgetTarget,
  industryInfluence: noInfluence,
  regionalInfluence: noInfluence,
  isTutorial: false,
  isSavage: true,
});
assert.equal(
  savageBudget,
  Math.round(
    savageBudgetTarget.marketPrice *
      1.05 *
      ENEMY_BALANCE_FACTOR.advanced *
      SAVAGE_ENEMY_BUDGET_MULTIPLIER *
      getSavageLayerBudgetMultiplier(savageBudgetTarget) *
      getSavageSeriesBudgetMultiplier(savageBudgetTarget)
  )
);
assert.equal(getEnemyDifficultyLevel(savageBudgetTarget, false, true), 4);
assert.deepEqual(
  savageProperties.map((property) =>
    getBossAbilityTier({
      targetProperty: property,
      isCityBoss: false,
      isSavage: true,
    })
  ),
  [
    'cover', 'enhanced_cover', 'enhanced_cover', 'invincible',
    'cover', 'enhanced_cover', 'enhanced_cover', 'invincible',
    'cover', 'enhanced_cover', 'enhanced_cover', 'invincible',
  ],
  'all three Savage series repeat the complete visible defensive pattern'
);
assert.deepEqual(
  SAVAGE_RAID_DEFINITIONS.map((raid) =>
    Number(
      (
        SAVAGE_ENEMY_BUDGET_MULTIPLIER *
        SAVAGE_LAYER_BUDGET_MULTIPLIERS[raid.layer - 1] *
        SAVAGE_SERIES_BUDGET_MULTIPLIERS[raid.series - 1]
      ).toFixed(3)
    )
  ),
  savageProperties.map((property) =>
    Number(
      (
        SAVAGE_ENEMY_BUDGET_MULTIPLIER *
        getSavageLayerBudgetMultiplier(property) *
        getSavageSeriesBudgetMultiplier(property)
      ).toFixed(3)
    )
  ),
  'every Savage encounter combines its authored layer and series rhythm'
);
assert.deepEqual(
  savageProperties.map((property) =>
    getEnemyDifficultyLevel(property, false, true)
  ),
  SAVAGE_ENEMY_DIFFICULTY_LEVELS.flat()
);
const fullyUpgradedGrandCompanyEorzea = upgradedSynergies.find(
  (synergy) => synergy.id === GRAND_COMPANY_EORZEA_ID
)!;
assert.equal(
  fullyUpgradedGrandCompanyEorzea.battleEffect?.capitalPressureMultiplier,
  2.06,
  'three Savage layer-four clears add 0.02 each'
);
assert.equal(
  getBattleOnlySynergyMultiplier(fullyUpgradedGrandCompanyEorzea, true),
  2.13,
  'all-business integration adds the permanent final 0.07'
);
const absoluteSavageBudgets = savageProperties.map((targetProperty) =>
  calculateEnemyBudget({
    targetProperty,
    industryInfluence: noInfluence,
    regionalInfluence: noInfluence,
    isTutorial: false,
    isSavage: true,
  })
);
assert.deepEqual(
  absoluteSavageBudgets,
  SAVAGE_RAID_DEFINITIONS.map((raid) =>
    Math.round(
      raid.marketPrice *
        1.05 *
        ENEMY_BALANCE_FACTOR.advanced *
        SAVAGE_ENEMY_BUDGET_MULTIPLIER *
        SAVAGE_LAYER_BUDGET_MULTIPLIERS[raid.layer - 1] *
        SAVAGE_SERIES_BUDGET_MULTIPLIERS[raid.series - 1]
    )
  ),
  'Savage budgets ignore inherited normal-property cartel flags'
);
for (let seriesStart = 0; seriesStart < absoluteSavageBudgets.length; seriesStart += 4) {
  for (let layer = 1; layer < 4; layer += 1) {
    assert.ok(
      absoluteSavageBudgets[seriesStart + layer] >
        absoluteSavageBudgets[seriesStart + layer - 1],
      `Savage series ${seriesStart / 4 + 1} budget rises from layer ${layer} to ${layer + 1}`
    );
  }
}
for (let series = 1; series < 3; series += 1) {
  const previousStart = (series - 1) * 4;
  const nextStart = series * 4;
  assert.ok(
    absoluteSavageBudgets[nextStart] < absoluteSavageBudgets[previousStart + 3],
    `Savage series ${series + 1} layer 1 drops below the previous layer 4 peak`
  );
  assert.ok(
    absoluteSavageBudgets[nextStart] > absoluteSavageBudgets[previousStart],
    `Savage series ${series + 1} layer 1 exceeds the previous series layer 1`
  );
}
const ultimateBudget = calculateEnemyBudget({
  targetProperty: ultimateProperty,
  industryInfluence: noInfluence,
  regionalInfluence: noInfluence,
  isTutorial: false,
  isUltimate: true,
});
assert.equal(
  ultimateBudget,
  Math.round(
    ultimateProperty.marketPrice *
      1.05 *
      ENEMY_BALANCE_FACTOR.advanced *
      ULTIMATE_ENEMY_BUDGET_MULTIPLIER
  )
);
assert.ok(ultimateBudget > absoluteSavageBudgets.at(-1)!);
assert.equal(getEnemyDifficultyLevel(ultimateProperty, false, false, true), 6);

const baseAiContext: EnemyDecisionContext = {
  enemyOwnership: 50,
  enemyReservePercent: 80,
  windType: 'CALM',
  windRemainingSeconds: 5,
  lastPlayerAction: null,
  effectiveCapitalGap: 0,
  marketPrice: 1_000_000,
  isCartelHQ: false,
  isTutorial: false,
  slowed: false,
  cycle: 0,
  difficultyLevel: 4,
};
assert.equal(decideEnemyAction({ ...baseAiContext, enemyOwnership: 70, lastPlayerAction: 'SMALL' }).intent, 'CONSERVE');
assert.equal(decideEnemyAction({ ...baseAiContext, windType: 'TAILWIND_PLAYER' }).intent, 'WAIT_FOR_WIND');
assert.equal(decideEnemyAction({ ...baseAiContext, effectiveCapitalGap: 200_000 }).intent, 'AGGRESSIVE_DEFENSE');
assert.equal(decideEnemyAction({ ...baseAiContext, enemyOwnership: 20, enemyReservePercent: 10 }).intent, 'EMERGENCY_DEFENSE');
const normalEnemyDecision = decideEnemyAction(baseAiContext);
const savageEnemyDecision = decideEnemyAction({ ...baseAiContext, difficultyLevel: 5 });
const ultimateEnemyDecision = decideEnemyAction({ ...baseAiContext, difficultyLevel: 6 });
assert.ok(savageEnemyDecision.waitMs <= normalEnemyDecision.waitMs, 'savage AI reacts at least as fast');
assert.ok(ultimateEnemyDecision.waitMs <= savageEnemyDecision.waitMs, 'Ultimate AI reacts at least as fast');
const slowedEnemyDecision = decideEnemyAction({ ...baseAiContext, slowed: true });
assert.ok(
  Math.abs(
    slowedEnemyDecision.waitMs / normalEnemyDecision.waitMs -
    1.9
  ) < 0.002,
  'legacy enemy slow input remains deterministic'
);
const protectedReserve = decideEnemyAction({ ...baseAiContext, enemyReservePercent: 14 });
assert.equal(protectedReserve.intent, 'CONSERVE');
assert.equal(protectedReserve.reserveProtected, true);
assert.equal(
  decideEnemyAction({
    ...baseAiContext,
    difficultyLevel: 6,
    enemyReservePercent: 10,
  }).reserveProtected,
  false,
  'Ultimate AI may spend below the normal 15% reserve floor'
);
assert.equal(
  decideEnemyAction({
    ...baseAiContext,
    difficultyLevel: 6,
    enemyReservePercent: 9,
  }).reserveProtected,
  true,
  'Ultimate AI still retains a bounded final reserve outside emergencies'
);
for (const lastPlayerAction of ['FUNDS', 'SYNERGY', 'ALLIANCE'] as const) {
  assert.equal(
    decideEnemyAction({
      ...baseAiContext,
      difficultyLevel: 5,
      lastPlayerAction,
      effectiveCapitalGap: 50_000,
    }).intent,
    'COUNTER_ATTACK',
    `high-end AI recognizes the ${lastPlayerAction} capital burst`
  );
}
const allInCounter = decideEnemyAction({ ...baseAiContext, enemyReservePercent: 14, lastPlayerAction: 'ALL_IN' });
assert.equal(allInCounter.reserveProtected, false);
assert.equal(allInCounter.intent, 'COUNTER_ATTACK');

const livingDeadSkill = INITIAL_SKILLS.find((skill) => skill.id === 'skill_sns_blitz')!;
const fastHorseSkill = INITIAL_SKILLS.find((skill) => skill.id === 'skill_fast_horse')!;
const disruptionSkill = INITIAL_SKILLS.find((skill) => skill.id === 'skill_sabotage')!;
const coverSkill = INITIAL_SKILLS.find((skill) => skill.id === 'skill_demoralize')!;
const capitalBoostSkill = INITIAL_SKILLS.find((skill) => skill.id === 'skill_capital_boost')!;
const synergyPushSkill = INITIAL_SKILLS.find((skill) => skill.id === 'skill_synergy_push')!;
const noAssets = { ownedProperties: [], totalFunds: 50_000, activeSynergyCount: 0 };
assert.equal(isSkillUnlocked({ skill: livingDeadSkill, ...noAssets }), false);
assert.equal(isSkillUnlocked({ skill: fastHorseSkill, ...noAssets }), false);
assert.equal(isSkillUnlocked({ skill: capitalBoostSkill, ...noAssets }), false);
assert.equal(isSkillUnlocked({ skill: synergyPushSkill, ...noAssets }), false);
assert.equal(
  isSkillUnlocked({ skill: disruptionSkill, ...noAssets }),
  true,
  'Feint is the useful initial manual ability'
);
assert.equal(
  isSkillUnlocked({
    skill: synergyPushSkill,
    ...noAssets,
    activeSynergyCount: 1,
  }),
  false,
  'Blackest Night does not unlock from an unrelated active SYNERGY count'
);
assert.equal(
  isSkillUnlocked({
    skill: synergyPushSkill,
    ...noAssets,
    conqueredCommunityIds: conqueredThrough('イシュガルド'),
  }),
  true,
  'Blackest Night unlocks after Ishgard conquest'
);
assert.equal(
  isSkillUnlocked({
    skill: fastHorseSkill,
    ...noAssets,
    conqueredCommunityIds: conqueredThrough('リムサ・ロミンサ'),
  }),
  true,
  '疾風怒濤 unlocks after Limsa conquest'
);
assert.equal(
  isSkillUnlocked({
    skill: capitalBoostSkill,
    ...noAssets,
    conqueredCommunityIds: conqueredThrough('クガネ'),
  }),
  true,
  'ぶんどる unlocks after Kugane conquest'
);
assert.equal(
  isSkillUnlocked({
    skill: livingDeadSkill,
    ...noAssets,
    savageClearedRaidIds: new Set(['prop_abyss_heavy']),
  }),
  true,
  'Living Dead unlocks with the first Savage fourth-floor clear'
);
assert.equal(capitalBoostSkill.oncePerBattle, true);
assert.deepEqual(
  INITIAL_SKILLS.map((skill) => skill.id),
  [
    'skill_fast_horse',
    'skill_synergy_push',
    'skill_demoralize',
    'skill_capital_boost',
    'skill_sns_blitz',
    'skill_sabotage',
  ],
  'manual abilities keep six stable legacy IDs after Era Wind becomes SYNERGY'
);
assert.ok(
  INITIAL_SKILLS.every(
    (skill) => skill.cooldownMs === 0 && skill.oncePerBattle === true
  ),
  'every player ability is limited to exactly one use per battle'
);
assert.equal(fastHorseSkill.cooldownMs, TACTICAL_SKILL_BALANCE.fastAction.cooldownMs);
assert.equal(fastHorseSkill.oncePerBattle, true);
assert.equal(TACTICAL_SKILL_BALANCE.fastAction.maxUsesPerBattle, 1);
const fastActionRatio =
  TACTICAL_SKILL_BALANCE.fastAction.boostedCommandProgressPerTick /
  TACTICAL_SKILL_BALANCE.fastAction.baseCommandProgressPerTick;
assert.ok(fastActionRatio > 1.85 && fastActionRatio < 1.86);
assert.match(fastHorseSkill.description, /リキャストタイム/);
assert.match(fastHorseSkill.description, /約47%短縮/);
assert.equal(INITIAL_SKILLS.some((skill) => skill.id === 'skill_nemawashi'), false);
assert.equal(disruptionSkill.name, '牽制');
assert.equal(disruptionSkill.effectType, 'FEINT');
assert.equal(disruptionSkill.oncePerBattle, true);
assert.deepEqual(TACTICAL_SKILL_BALANCE.feint, {
  durationMs: 10_000,
  enemyPushMultiplier: 0.9,
  maxUsesPerBattle: 1,
});
assert.match(disruptionSkill.description, /10秒間/);
assert.match(disruptionSkill.description, /10%軽減/);
assert.match(disruptionSkill.description, /演出中は残り時間が減らない/);
assert.doesNotMatch(disruptionSkill.description, /予告|中断|予約/);
assert.equal(coverSkill.id, 'skill_demoralize', 'legacy equipped ability id remains valid');
assert.equal(coverSkill.effectType, 'COVER');
assert.equal(coverSkill.oncePerBattle, true);
assert.equal(TACTICAL_SKILL_BALANCE.cover.durationMs, 16_000);
assert.equal(HIGH_DIFFICULTY_SUPPORT_MULTIPLIER, 1.7);
assert.equal(TACTICAL_SKILL_BALANCE.cover.absorbRatio, 0.92);
assert.equal(TACTICAL_SKILL_BALANCE.cover.gaugeCapacity, 84);
assert.deepEqual(
  TACTICAL_SKILL_BALANCE.cover,
  {
    durationMs: BOSS_COVER_BALANCE.enhancedCover.durationMs,
    absorbRatio: BOSS_COVER_BALANCE.enhancedCover.absorbRatio,
    gaugeCapacity: BOSS_COVER_BALANCE.enhancedCover.gaugeCapacity,
  },
  'player Passage and enemy Passage share the same defensive contract'
);
assert.equal(BOSS_COVER_BALANCE.cover.durationMs, 18_000);
assert.equal(BOSS_COVER_BALANCE.enhancedCover.durationMs, 16_000);
assert.equal(BOSS_COVER_BALANCE.invincible.durationMs, 5_000);
assert.equal(BOSS_COVER_BALANCE.cover.gaugeCapacity, 58);
assert.equal(BOSS_COVER_BALANCE.enhancedCover.gaugeCapacity, 84);
assert.equal(BOSS_COVER_BALANCE.invincible.followupDurationMs, 6_000);
assert.equal(BOSS_COVER_BALANCE.invincible.followupGaugeCapacity, 44);
assert.match(coverSkill.description, /16秒間/);
assert.deepEqual(
  applyCoverToGaugeDelta({
    currentGauge: 0,
    nextGauge: 20,
    protects: 'player',
    absorbRatio: 0.6,
    remainingGaugeCapacity: 16,
  }),
  {
    nextGauge: 8,
    absorbedGauge: 12,
    remainingGaugeCapacity: 4,
  }
);
assert.deepEqual(
  applyCoverToGaugeDelta({
    currentGauge: 0,
    nextGauge: -30,
    protects: 'opponent',
    absorbRatio: 0.8,
    remainingGaugeCapacity: 20,
  }),
  {
    nextGauge: -10,
    absorbedGauge: 20,
    remainingGaugeCapacity: 0,
  }
);
assert.equal(
  getCoverGuardDisplayPercent({
    remainingGaugeCapacity: 84,
    maximumGaugeCapacity: 84,
    remainingMs: 16_000,
    durationMs: 16_000,
  }),
  100,
  'a fresh Cover guard starts with a full display gauge'
);
assert.equal(
  getCoverGuardDisplayPercent({
    remainingGaugeCapacity: 42,
    maximumGaugeCapacity: 84,
    remainingMs: 14_000,
    durationMs: 16_000,
  }),
  50,
  'the display gauge follows the lower of absorption capacity and duration'
);
assert.equal(
  getCoverGuardDisplayPercent({
    remainingGaugeCapacity: Number.POSITIVE_INFINITY,
    maximumGaugeCapacity: Number.POSITIVE_INFINITY,
    remainingMs: 2_500,
    durationMs: 5_000,
  }),
  50,
  'Invincible displays its remaining duration as guard gauge'
);
assert.equal(
  getCoverGuardDisplayPercent({
    remainingGaugeCapacity: 0,
    maximumGaugeCapacity: 84,
    remainingMs: 14_000,
    durationMs: 16_000,
  }),
  0,
  'a depleted guard reaches zero before the knight is blown away'
);
const terminalLimitBreakBeforeCover = -102;
const terminalLimitBreakCovered = applyCoverToGaugeDelta({
  currentGauge: -80,
  nextGauge: terminalLimitBreakBeforeCover,
  protects: 'opponent',
  absorbRatio: BOSS_COVER_BALANCE.cover.absorbRatio,
  remainingGaugeCapacity: BOSS_COVER_BALANCE.cover.gaugeCapacity,
});
assert.equal(
  getBattleTerminalWinner(terminalLimitBreakBeforeCover),
  'player',
  'the raw LB would otherwise end the battle'
);
assert.equal(
  getBattleTerminalWinner(terminalLimitBreakCovered.nextGauge),
  null,
  'boss Cover intercepts the full LB movement before terminal preview'
);
assert.equal(
  terminalLimitBreakCovered.absorbedGauge,
  18.48,
  'Cover absorbs the movement from the pre-LB gauge, not the 99% preview'
);
assert.ok(
  ENEMY_SUPPORT_SKILL_BALANCE.rapidAssault.durationMs >= 12_000,
  'Ultimate Rapid Assault keeps a clearly readable sustained window'
);
assert.ok(
  ENEMY_SUPPORT_SKILL_BALANCE.rapidAssault.actionProgressMultiplier >= 2,
  'Ultimate Rapid Assault materially increases enemy action speed'
);
assert.equal(
  ENEMY_SUPPORT_SKILL_BALANCE.limitBreak3.ownershipPush,
  LIMIT_BREAK_OWNERSHIP_CAPS[3],
  'enemy LB3 has the same maximum ownership push as player LB3'
);
const enemyLimitBreakCovered = applyCoverToGaugeDelta({
  currentGauge: 0,
  nextGauge: ENEMY_SUPPORT_SKILL_BALANCE.limitBreak3.gaugeDelta,
  protects: 'player',
  absorbRatio: TACTICAL_SKILL_BALANCE.cover.absorbRatio,
  remainingGaugeCapacity: TACTICAL_SKILL_BALANCE.cover.gaugeCapacity,
});
assert.ok(
  Math.abs(enemyLimitBreakCovered.nextGauge - 4.8) < 0.0001,
  'a prepared player Passage reduces enemy LB3 from 30 ownership points to 2.4'
);
assert.equal(TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio, 0.4);
assert.equal(
  Math.round(6_000_000_000 * TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio),
  2_400_000_000,
  'Ultimate critical Capital Boost commits exactly 40% of the 6B market'
);
assert.equal(livingDeadSkill.id, 'skill_sns_blitz', 'legacy save-compatible skill id');
assert.equal(livingDeadSkill.effectType, 'LIVING_DEAD');
assert.equal(livingDeadSkill.cooldownMs, 0);
assert.equal(livingDeadSkill.oncePerBattle, true);
assert.equal(TACTICAL_SKILL_BALANCE.livingDead.waitingDurationMs, 10_000);
assert.equal(TACTICAL_SKILL_BALANCE.livingDead.recoveryDurationMs, 10_000);
assert.equal(TACTICAL_SKILL_BALANCE.livingDead.minimumOwnership, 1);
assert.equal(TACTICAL_SKILL_BALANCE.livingDead.recoveryOwnership, 30);
assert.match(livingDeadSkill.description, /1争奪戦につき1回/);
assert.equal(calculateOwnershipFromGauge(98), 1);
assert.equal(calculateOwnershipFromGauge(40), 30);
assert.deepEqual(
  resolveCriticalAutoInterception({
    currentGauge: 40,
    candidateGauge: 70,
    canIntercept: true,
  }),
  { shouldIntercept: true, heldGauge: 50 },
  'critical AUTO holds an enemy push at 25% ownership'
);
assert.deepEqual(
  resolveCriticalAutoInterception({
    currentGauge: 40,
    candidateGauge: 120,
    canIntercept: true,
  }),
  { shouldIntercept: true, heldGauge: 50 },
  'critical AUTO discards a lethal overshoot instead of replaying it after the skill'
);
assert.deepEqual(
  resolveCriticalAutoInterception({
    currentGauge: 40,
    candidateGauge: 94,
    canIntercept: true,
    preserveResolvedCandidate: false,
  }),
  { shouldIntercept: true, heldGauge: 50 },
  'ordinary enemy pressure explicitly keeps the generic 25% critical AUTO boundary'
);
assert.deepEqual(
  resolveCriticalAutoInterception({
    currentGauge: 40,
    candidateGauge: 94,
    canIntercept: true,
    preserveResolvedCandidate: true,
  }),
  { shouldIntercept: true, heldGauge: 94 },
  'Forced Liquidation may trigger critical AUTO without erasing its resolved 3% impact'
);
assert.deepEqual(
  resolveCriticalAutoInterception({
    currentGauge: 60,
    candidateGauge: 80,
    canIntercept: true,
  }),
  { shouldIntercept: true, heldGauge: 50 },
  'an armed critical AUTO recovers a late frame to its held 25% boundary'
);
assert.deepEqual(
  resolveCriticalAutoInterception({
    currentGauge: 40,
    candidateGauge: 70,
    canIntercept: false,
  }),
  { shouldIntercept: false, heldGauge: 70 },
  'an unavailable or already-used critical AUTO cannot alter the enemy push'
);
assert.deepEqual(
  resolveCriticalAutoInterception({
    currentGauge: 40,
    candidateGauge: 45,
    canIntercept: true,
  }),
  { shouldIntercept: false, heldGauge: 45 },
  'critical AUTO does not trigger above the ownership threshold'
);
assert.equal(
  advanceCriticalAutoResolution('idle', 'hold'),
  'held',
  'critical AUTO first owns the battle clock at the held boundary'
);
assert.equal(
  advanceCriticalAutoResolution('held', 'release'),
  'held',
  'critical AUTO cannot release before its cinematic and effect'
);
assert.equal(
  advanceCriticalAutoResolution('held', 'start_cinematic'),
  'cinematic'
);
assert.equal(
  advanceCriticalAutoResolution('cinematic', 'commit_effect'),
  'effect_committed'
);
assert.equal(
  advanceCriticalAutoResolution('effect_committed', 'release'),
  'effect_committed',
  'critical AUTO cannot release while its capital presentation is incomplete'
);
assert.equal(
  advanceCriticalAutoResolution(
    'effect_committed',
    'complete_presentation'
  ),
  'presentation_complete',
  'critical AUTO records presentation completion as a portable state boundary'
);
assert.equal(
  advanceCriticalAutoResolution('presentation_complete', 'release'),
  'idle',
  'critical AUTO releases only after the effect presentation is complete'
);
assert.equal(
  advanceCriticalAutoResolution('cinematic', 'cancel'),
  'idle',
  'critical AUTO can be safely cancelled during teardown'
);
assert.equal(resolveLivingDeadOutcome('waiting', 50, 1), 'none');
assert.equal(resolveLivingDeadOutcome('waiting', 0, 10_000), 'triggered');
assert.equal(resolveLivingDeadOutcome('waiting', 0, 0), 'waiting_expired');
assert.equal(resolveLivingDeadOutcome('recovery', 29.99, 1), 'none');
assert.equal(resolveLivingDeadOutcome('recovery', 30, 1), 'recovered');
assert.equal(resolveLivingDeadOutcome('recovery', 29.99, 0), 'failed');
assert.deepEqual(BATTLE_SUPPORT_BALANCE, {
  subsidiaryMarketRatio: 0.75,
  subsidiaryImpactBase: 2.5,
  subsidiaryImpactPerMarketRatio: 13,
  subsidiaryImpactCap: 12,
  synergyMemberMarketRatio: 0.65,
  synergyDefaultMultiplier: 1.45,
  synergyImpactBase: 5,
  synergyImpactPerMarketRatio: 13,
  synergyImpactCap: 22,
});
assert.deepEqual(BATTLE_LOYALTY_BALANCE, {
  individualRiskIncrease: 12,
  limitBreakRiskIncrease: 8,
  synergyRiskIncrease: 10,
  profitShareRewardRatio: 0.5,
  reacquisitionSupportBonusPerLevel: 0.1,
  reacquisitionRiskReductionPerLevel: 2,
  maxReacquisitionLevel: 2,
});
assert.deepEqual(PROFIT_ALLOCATION_OPTIONS, [
  {
    id: 'keep',
    label: '独占',
    rate: 0,
    departureProbabilityMultiplier: 1,
  },
  {
    id: 'share50',
    label: '山分け',
    rate: 0.5,
    departureProbabilityMultiplier: 0.2,
  },
]);
assert.equal(
  PROFIT_ALLOCATION_OPTIONS.length,
  2,
  'victory settlement exposes only the exclusive and equal-share choices'
);
const returningSubsidiary = {
  ...readinessProperty,
  reacquisitionLevel: 1,
};
assert.equal(getReacquisitionLevel(returningSubsidiary), 1);
assert.equal(getSubsidiarySupportMultiplier(returningSubsidiary), 1.1);
assert.equal(
  calculateSubsidiarySupportAmount(returningSubsidiary),
  Math.round(
    returningSubsidiary.marketPrice *
      BATTLE_SUPPORT_BALANCE.subsidiaryMarketRatio *
      1.1
  )
);
const supportOrderInput = [
  { ...readinessProperty, id: 'support-low', name: '小口支援', marketPrice: 1_000 },
  {
    ...readinessProperty,
    id: 'support-high',
    name: '大口支援',
    marketPrice: 2_000,
  },
];
assert.deepEqual(
  sortSubsidiariesBySupport(supportOrderInput).map((property) => property.id),
  ['support-high', 'support-low'],
  'funding sources are shown from strongest to weakest'
);
assert.deepEqual(
  supportOrderInput.map((property) => property.id),
  ['support-low', 'support-high'],
  'support sorting never mutates the saved subsidiary order'
);
assert.equal(
  getSubsidiaryRiskIncrease(
    returningSubsidiary,
    BATTLE_LOYALTY_BALANCE.individualRiskIncrease
  ),
  10
);
assert.equal(
  calculateProfitAllocationCost(
    [{ ...readinessProperty, marketPrice: 100_000 }],
    10_000,
    PROFIT_ALLOCATION_OPTIONS[0].rate
  ),
  0,
  'keeping the full reward has no allocation cost'
);
assert.equal(
  calculateProfitAllocationCost(
    [{ ...readinessProperty, marketPrice: 100_000 }],
    10_000,
    PROFIT_ALLOCATION_OPTIONS[1].rate
  ),
  5_000,
  'equal sharing uses 50% of the earned victory profit in total'
);
assert.equal(
  calculateProfitAllocationCost(
    [
      { ...readinessProperty, id: 'share-a' },
      { ...readinessProperty, id: 'share-b' },
      { ...readinessProperty, id: 'share-c' },
    ],
    10_000,
    PROFIT_ALLOCATION_OPTIONS[1].rate
  ),
  5_000,
  'the 50% pool is divided across all allies rather than charged once per ally'
);
assert.equal(
  calculateProfitAllocationCost(
    [{ ...readinessProperty, marketPrice: 100_000 }],
    300,
    PROFIT_ALLOCATION_OPTIONS[1].rate
  ),
  150,
  'equal sharing scales with small victory rewards'
);
assert.equal(
  calculateProfitAllocationCost([], 10_000),
  0,
  'there is no profit allocation cost without subsidiaries'
);
assert.equal(
  calculateProfitAllocationCost(
    [{ ...readinessProperty, marketPrice: 100_000 }],
    10_000,
    -0.1
  ),
  0,
  'a negative allocation rate cannot create a credit'
);
assert.equal(
  calculateProfitAllocationCost(
    [{ ...readinessProperty, marketPrice: 100_000 }],
    10_000,
    Number.NaN
  ),
  0,
  'a non-finite allocation rate cannot charge the player'
);
assert.equal(
  calculateProfitAllocationCost(
    [{ ...readinessProperty, marketPrice: 100_000 }],
    10_000,
    2
  ),
  10_000,
  'allocation cost is capped at the earned reward'
);
const projectedProfitAllocationChoices = getVictoryProfitAllocationChoices(
  [
    { ...readinessProperty, id: 'projection-a', loyaltyRisk: 50 },
    { ...readinessProperty, id: 'projection-b', loyaltyRisk: 50 },
    { ...readinessProperty, id: 'projection-c', loyaltyRisk: 50 },
  ],
  10_000
);
assert.deepEqual(
  projectedProfitAllocationChoices.map(({ id, label, rate, cost }) => ({
    id,
    label,
    rate,
    cost,
  })),
  [
    { id: 'keep', label: '独占', rate: 0, cost: 0 },
    { id: 'share50', label: '山分け', rate: 0.5, cost: 5_000 },
  ],
  'the pure settlement projection is the sole source for UI choice labels and total costs'
);
assert.equal(calculateRebellionProbability(30), 0);
assert.ok(
  calculateRebellionProbability(40) <
    calculateRebellionProbability(60) &&
    calculateRebellionProbability(60) <
      calculateRebellionProbability(80),
  'post-victory departure probability rises gradually above risk 30'
);
assert.equal(calculateRebellionProbability(100), 0.9);
assert.equal(getEnemyMinimumCommitment(100_000), 2_000);
assert.equal(getEnemyMinimumCommitment(100), 10);
const strengthBeforeAcquisition = calculateCompanyStrengthScore(
  20_000,
  []
);
const strengthAfterAcquisition = calculateCompanyStrengthScore(
  21_000,
  [readinessProperty]
);
assert.ok(strengthAfterAcquisition > strengthBeforeAcquisition);
assert.ok(
  getCompanyStrengthLevel(strengthAfterAcquisition).level >=
    getCompanyStrengthLevel(strengthBeforeAcquisition).level,
  'company level never falls after a profitable acquisition'
);
const highRiskSettlementProperty = {
  ...readinessProperty,
  id: 'loyalty_high_risk',
  loyaltyRisk: 50,
};
const highRiskDepartureProbability = calculateRebellionProbability(
  highRiskSettlementProperty.loyaltyRisk
);
const exclusiveLoyaltySettlement = resolvePostVictoryLoyalty(
  [highRiskSettlementProperty],
  PROFIT_ALLOCATION_OPTIONS[0].departureProbabilityMultiplier,
  () => 0.06
);
assert.equal(exclusiveLoyaltySettlement.leaving.length, 1);
const sharedLoyaltySettlement = resolvePostVictoryLoyalty(
  [highRiskSettlementProperty],
  PROFIT_ALLOCATION_OPTIONS[1].departureProbabilityMultiplier,
  () => 0.06
);
assert.equal(
  sharedLoyaltySettlement.leaving.length,
  0,
  'the 50% share strongly reduces only this settlement departure probability'
);
assert.equal(
  sharedLoyaltySettlement.survivors[0].loyaltyRisk,
  highRiskSettlementProperty.loyaltyRisk,
  'the 50% share never reduces saved loyalty risk'
);
const sharedNonzeroRiskSettlement = resolvePostVictoryLoyalty(
  [highRiskSettlementProperty],
  PROFIT_ALLOCATION_OPTIONS[1].departureProbabilityMultiplier,
  () => 0.01
);
assert.equal(
  sharedNonzeroRiskSettlement.leaving.length,
  1,
  'the 50% share suppresses departure strongly but never guarantees survival'
);
assert.equal(
  highRiskSettlementProperty.loyaltyRisk,
  50,
  'settlement never mutates its input property'
);
assert.equal(
  normalizeDepartureProbabilityMultiplier(false),
  PROFIT_ALLOCATION_OPTIONS[0].departureProbabilityMultiplier
);
assert.equal(
  normalizeDepartureProbabilityMultiplier(true),
  PROFIT_ALLOCATION_OPTIONS[1].departureProbabilityMultiplier,
  'the temporary boolean compatibility path maps true to the strongest allocation'
);
assert.equal(normalizeDepartureProbabilityMultiplier(-1), 0);
assert.equal(normalizeDepartureProbabilityMultiplier(2), 1);
assert.equal(normalizeDepartureProbabilityMultiplier(Number.NaN), 1);
assert.equal(
  calculateAtLeastOneDepartureProbability([], 1),
  0,
  'no subsidiaries means no departure probability'
);
assert.equal(
  calculateAtLeastOneDepartureProbability(
    [{ ...highRiskSettlementProperty, loyaltyRisk: 30 }],
    1
  ),
  0,
  'risk 30 remains inside the safe boundary'
);
assert.ok(
  Math.abs(
    calculateAtLeastOneDepartureProbability(
      [highRiskSettlementProperty],
      PROFIT_ALLOCATION_OPTIONS[1].departureProbabilityMultiplier
    ) -
      highRiskDepartureProbability *
        PROFIT_ALLOCATION_OPTIONS[1].departureProbabilityMultiplier
  ) < Number.EPSILON * 4,
  'one-subsidiary aggregate probability matches its adjusted individual probability'
);
const twoMaximumRiskSubsidiaries = [
  { ...highRiskSettlementProperty, id: 'risk-max-a', loyaltyRisk: 100 },
  { ...highRiskSettlementProperty, id: 'risk-max-b', loyaltyRisk: 100 },
];
assert.ok(
  Math.abs(
    calculateAtLeastOneDepartureProbability(
      twoMaximumRiskSubsidiaries,
      PROFIT_ALLOCATION_OPTIONS[0].departureProbabilityMultiplier
    ) -
      0.99
  ) < 1e-12,
  'at-least-one probability is 1 minus the product of every survival chance'
);
assert.ok(
  calculateAtLeastOneDepartureProbability(
    twoMaximumRiskSubsidiaries,
    PROFIT_ALLOCATION_OPTIONS[1].departureProbabilityMultiplier
  ) <
    calculateAtLeastOneDepartureProbability(
      twoMaximumRiskSubsidiaries,
      PROFIT_ALLOCATION_OPTIONS[0].departureProbabilityMultiplier
    ),
  'equal sharing lowers aggregate departure probability for the whole network'
);
assert.deepEqual(
  resolvePostVictoryLoyalty([], true, () => 0),
  { survivors: [], leaving: [] },
  'a battle with no subsidiaries has no departure settlement'
);

const rebelledSettlementProperty = {
  ...INITIAL_PROPERTIES[0],
  owner: 'player' as const,
  ownerName: '検証商会',
  marketPrice: 2_000,
  loyaltyRisk: 100,
};
const survivingSettlementProperty = {
  ...INITIAL_PROPERTIES[1],
  owner: 'player' as const,
  ownerName: '検証商会',
  loyaltyRisk: 0,
};
const targetSettlementProperty = {
  ...INITIAL_PROPERTIES[2],
  owner: 'independent' as const,
  ownerName: '独立物件',
};
assert.equal(
  calculateLiquidationCashback([
    rebelledSettlementProperty,
    rebelledSettlementProperty,
  ]),
  2_000,
  'liquidation cashback is calculated outside React state updaters and deduplicated'
);
assert.deepEqual(
  calculateBattleSettlementSummary({
    victoryReward: 5_000,
    brokerageFee: 3_000,
    settlementCost: 1_000,
    celebrationGiftCost: 0,
    liquidationCashback: 0,
  }),
  {
    transactionDelta: 1_000,
    fundsDelta: 1_000,
    outcome: 'profit',
  },
  'a profitable acquisition is labelled from the battle transaction itself'
);
assert.deepEqual(
  calculateBattleSettlementSummary({
    victoryReward: 5_000,
    brokerageFee: 3_000,
    settlementCost: 4_000,
    celebrationGiftCost: 500,
    liquidationCashback: 8_000,
  }),
  {
    transactionDelta: -2_500,
    fundsDelta: 5_500,
    outcome: 'loss',
  },
  'liquidation proceeds cannot disguise a loss-making acquisition'
);
assert.equal(
  calculateBattleSettlementSummary({
    victoryReward: 4_000,
    brokerageFee: 3_000,
    settlementCost: 1_000,
    celebrationGiftCost: 0,
    liquidationCashback: 0,
  }).outcome,
  'balanced',
  'zero transaction profit is reported as balanced rather than black ink'
);
const settledProperties = applyNormalBattlePropertyUpdates({
  properties: [
    rebelledSettlementProperty,
    survivingSettlementProperty,
    targetSettlementProperty,
  ],
  winner: 'player',
  targetPropertyId: targetSettlementProperty.id,
  companyName: '検証商会',
  rebelledProperties: [rebelledSettlementProperty],
  survivingRiskUpdates: [
    { id: survivingSettlementProperty.id, loyaltyRisk: 18 },
  ],
});
assert.equal(
  settledProperties.find(
    (property) => property.id === rebelledSettlementProperty.id
  )?.owner,
  'independent'
);
assert.equal(
  settledProperties.find(
    (property) => property.id === rebelledSettlementProperty.id
  )?.reacquisitionLevel,
  1,
  'a leaving subsidiary records one permanent reacquisition level'
);
assert.equal(
  settledProperties.find(
    (property) => property.id === survivingSettlementProperty.id
  )?.loyaltyRisk,
  18,
  'surviving subsidiary risk persists into the next battle'
);
assert.equal(
  settledProperties.find(
    (property) => property.id === targetSettlementProperty.id
  )?.owner,
  'player'
);
const reacquiredProperties = applyNormalBattlePropertyUpdates({
  properties: settledProperties,
  winner: 'player',
  targetPropertyId: rebelledSettlementProperty.id,
  companyName: '検証商会',
  rebelledProperties: [],
  survivingRiskUpdates: [],
});
assert.equal(
  reacquiredProperties.find(
    (property) => property.id === rebelledSettlementProperty.id
  )?.reacquisitionLevel,
  1,
  'reacquisition keeps the returning subsidiary support upgrade'
);

const lbSubs = [
  { ...INITIAL_PROPERTIES[0], marketPrice: 1_000 },
  { ...INITIAL_PROPERTIES[1], marketPrice: 2_000 },
  { ...INITIAL_PROPERTIES[2], marketPrice: 3_000 },
];
const lbTier = getLimitBreakTier(lbSubs.length + 1);
assert.equal(lbTier, 1);
assert.equal(
  calculateLimitBreakAmount(1_000, lbSubs, lbTier),
  800,
  'LB1 cannot turn legacy high-price subsidiaries into more than 0.8 target prices'
);
const freshNetworkLimitAmount = calculateLimitBreakAmount(
  10_000,
  lbSubs,
  lbTier
);
const repeatedNetworkLimitAmount = calculateLimitBreakAmount(
  10_000,
  lbSubs,
  lbTier,
  Object.fromEntries(lbSubs.map((property) => [property.id, 3]))
);
assert.ok(
  repeatedNetworkLimitAmount < freshNetworkLimitAmount,
  'repeated network calls reduce the subsidiary portion of later LIMIT BREAK funding'
);
const lbTier2Subs = Array.from({ length: 7 }, (_, index) => ({
  ...INITIAL_PROPERTIES[index % INITIAL_PROPERTIES.length],
  id: `lb-tier-2-${index}`,
  marketPrice: 5_000,
}));
assert.equal(
  calculateLimitBreakAmount(1_000, lbTier2Subs, 2),
  1_200,
  'LB2 keeps its larger payoff but stops at 1.2 target prices'
);
assert.ok(
  calculateLimitBreakAmount(1_000, lbTier2Subs, 3) > 1_200,
  'LB3 keeps the uncapped late-game aggregation payoff'
);
const originalSynergyUsage = new Set<string>();
const firstSynergyClaim = claimBattleSynergyUsage(
  originalSynergyUsage,
  'forest-material-network'
);
assert.ok(firstSynergyClaim?.has('forest-material-network'));
assert.equal(
  originalSynergyUsage.has('forest-material-network'),
  false,
  'claiming a manual synergy does not mutate an older render snapshot'
);
assert.equal(
  claimBattleSynergyUsage(
    firstSynergyClaim ?? new Set<string>(),
    'forest-material-network'
  ),
  null,
  'the same manual synergy cannot be claimed twice in one battle'
);
assert.equal(BATTLE_GAUGE_SPEED_FACTOR, 4);
assert.equal(
  INITIAL_BATTLE_COMMAND_PROGRESS,
  100,
  'every battle opens with one player command before enemy presentation chains'
);
assert.equal(NORMAL_BATTLE_GAUGE_SPEED_FACTOR, 4.5);
assert.equal(
  resolveBattleGaugeSpeedFactor({ isTraining: false, isHighEndRaid: false }),
  4.5
);
assert.equal(
  resolveBattleGaugeSpeedFactor({ isTraining: true, isHighEndRaid: false }),
  4
);
assert.equal(
  resolveBattleGaugeSpeedFactor({ isTraining: false, isHighEndRaid: true }),
  4
);
assert.equal(
  applyNormalClosingMomentum({
    velocity: -0.2,
    gauge: -70,
    isTraining: false,
    isHighEndRaid: false,
  }),
  -0.75
);
assert.equal(
  applyNormalClosingMomentum({
    velocity: 0.2,
    gauge: 70,
    isTraining: false,
    isHighEndRaid: false,
  }),
  0.75
);
assert.equal(
  applyNormalClosingMomentum({
    velocity: -0.2,
    gauge: -69.8,
    isTraining: false,
    isHighEndRaid: false,
  }),
  -0.2
);
assert.equal(
  applyNormalClosingMomentum({
    velocity: 0.2,
    gauge: -70,
    isTraining: false,
    isHighEndRaid: false,
  }),
  0.2
);
assert.equal(
  applyNormalClosingMomentum({
    velocity: -0.2,
    gauge: -70,
    isTraining: false,
    isHighEndRaid: true,
  }),
  -0.2
);
assert.equal(TRAINING_GAUGE_SPEED_MULTIPLIER, 0.1);
assert.equal(TRAINING_MIN_OWNERSHIP_PERCENT, 1);
assert.ok(
  Math.abs(
    calculateDirectInvestmentGaugeImpact({
      investmentAmount: 100,
      marketPrice: 1_000,
    }) - 4.8
  ) < 1e-9,
  'normal direct investment keeps the campaign-wide impact curve'
);
const maximumCommitSequenceImpact = [0.35, 0.35, 0.2, 0.1].reduce(
  (sum, ratio) =>
    sum +
    calculateDirectInvestmentGaugeImpact({
      investmentAmount: 1_000 * ratio,
      marketPrice: 1_000,
    }),
  0
);
const tenSteadyCommitmentsImpact =
  calculateDirectInvestmentGaugeImpact({
    investmentAmount: 100,
    marketPrice: 1_000,
  }) * 10;
assert.ok(
  Math.abs(maximumCommitSequenceImpact - tenSteadyCommitmentsImpact) < 1e-9,
  'maximum-first capital keeps the same total pressure as ten steady offers'
);
assert.ok(
  Math.abs(
    calculateDirectInvestmentGaugeImpact({
      investmentAmount: 750,
      marketPrice: 7_500,
      levelOneTraining: true,
    }) - 50
  ) < 1e-9,
  'level-one training keeps a strong default offer at its safe impact cap'
);
assert.equal(
  calculateDirectInvestmentGaugeImpact({
    investmentAmount: 2_625,
    marketPrice: 7_500,
    levelOneTraining: true,
  }),
  50,
  'level-one training amplification remains capped'
);
assert.ok(
  Math.abs(
    calculateDirectInvestmentGaugeImpact({
      investmentAmount: 100,
      marketPrice: 1_000,
      trainingLevel: 2,
    }) - 9.6
  ) < 1e-9,
  'advanced training keeps a shorter dedicated practice curve'
);
assert.equal(applyTrainingGaugeSpeed(12, false), 12);
assert.ok(Math.abs(applyTrainingGaugeSpeed(12, true) - 1.2) < 1e-9);
assert.equal(holdTrainingGaugeAboveDefeat(140, false), 140);
assert.equal(holdTrainingGaugeAboveDefeat(140, true), 98);
const unansweredTrainingVelocity = Math.abs(
  applyTrainingGaugeSpeed(
    calculateGaugeVelocity(0, 1, 1) *
      BATTLE_GAUGE_SPEED_FACTOR *
      3.4,
    true
  )
);
const unansweredTrainingSeconds =
  (100 - TRAINING_MIN_OWNERSHIP_PERCENT * 2) /
  unansweredTrainingVelocity;
const baseCommandRecoverySeconds =
  100 /
  (TACTICAL_SKILL_BALANCE.fastAction.baseCommandProgressPerTick * 20);
assert.ok(
  unansweredTrainingSeconds >= 60,
  'training dummy takes at least one minute to reach its protected 1% floor'
);
assert.ok(
  unansweredTrainingSeconds / baseCommandRecoverySeconds >= 30,
  'training dummy allows at least thirty command cycles before its protected floor'
);
assert.equal(LIMIT_BREAK_CHARGE_GAIN_MULTIPLIER, 1.2);
assert.deepEqual(LIMIT_BREAK_CAPITAL_CAP_RATIOS, {
  1: 0.8,
  2: 1.2,
  3: null,
});
assert.deepEqual(LIMIT_BREAK_MULTIPLIERS, { 1: 1.56, 2: 1.98, 3: 2.46 });
assert.deepEqual(LIMIT_BREAK_OWNERSHIP_CAPS, { 1: 7, 2: 14, 3: 30 });
assert.deepEqual(NORMAL_ENEMY_CAMPAIGN_MULTIPLIERS, {
  tutorial: 0.62,
  gridania: 0.82,
  limsa: 0.86,
  midgameAndLater: 1,
});
assert.equal(ENEMY_INITIAL_COMMITMENT_RATIO, 0.25);
assert.equal(BATTLE_CASH_RECOVERY_RATE_PER_SECOND, 0.003);
assert.equal(BATTLE_CASH_RECOVERY_TOTAL_CAP_RATIO, 0.2);
assert.deepEqual(getBattleCashRecoveryWindMultipliers('CALM'), {
  player: 1,
  enemy: 1,
});
assert.deepEqual(
  getBattleCashRecoveryWindMultipliers('TAILWIND_PLAYER'),
  { player: 1.25, enemy: 1 }
);
assert.deepEqual(
  getBattleCashRecoveryWindMultipliers('HEADWIND_PLAYER'),
  { player: 0.75, enemy: 1 }
);
assert.deepEqual(
  getBattleCashRecoveryWindMultipliers('TAILWIND_ENEMY'),
  { player: 1, enemy: 1.25 }
);
assert.deepEqual(getBattleCashRecoveryWindMultipliers('CROSSWIND'), {
  player: 1.2,
  enemy: 1.2,
});
assert.deepEqual(BATTLE_CASH_RECOVERY_WIND_MULTIPLIERS.CALM, {
  player: 1,
  enemy: 1,
});

const recoveryBaseline = 10_000;
const calmSixtySecondRecovery = advanceBattleCashRecovery({
  baselineFunds: recoveryBaseline,
  availableFunds: 0,
  cumulativeRecovered: 0,
  elapsedSeconds: 60,
  timeScale: 1,
  windMultiplier: 1,
  terminal: false,
});
assert.equal(calmSixtySecondRecovery.availableFunds, 1_800);
assert.equal(calmSixtySecondRecovery.cumulativeRecovered, 1_800);
assert.equal(calmSixtySecondRecovery.cumulativeRecoveryRatio, 0.18);

const recoveryAtSixtySixPointSevenSeconds = advanceBattleCashRecovery({
  baselineFunds: recoveryBaseline,
  availableFunds: 0,
  cumulativeRecovered: 0,
  elapsedSeconds: 66.7,
  timeScale: 1,
  windMultiplier: 1,
  terminal: false,
});
assert.equal(recoveryAtSixtySixPointSevenSeconds.availableFunds, 2_000);
assert.equal(
  recoveryAtSixtySixPointSevenSeconds.cumulativeRecovered,
  2_000
);
assert.equal(
  recoveryAtSixtySixPointSevenSeconds.cumulativeRecoveryRatio,
  0.2
);
assert.deepEqual(
  advanceBattleCashRecovery({
    baselineFunds: recoveryBaseline,
    availableFunds: recoveryAtSixtySixPointSevenSeconds.availableFunds,
    cumulativeRecovered:
      recoveryAtSixtySixPointSevenSeconds.cumulativeRecovered,
    elapsedSeconds: 600,
    timeScale: 1,
    windMultiplier: 1.25,
    terminal: false,
  }),
  {
    availableFunds: 2_000,
    cumulativeRecovered: 2_000,
    recoveredThisStep: 0,
    cumulativeRecoveryRatio: 0.2,
  },
  'battle cash recovery stops permanently at 20% of the opening baseline'
);

const currentCashCap = advanceBattleCashRecovery({
  baselineFunds: recoveryBaseline,
  availableFunds: 9_500,
  cumulativeRecovered: 0,
  elapsedSeconds: 60,
  timeScale: 1,
  windMultiplier: 1,
  terminal: false,
});
assert.equal(currentCashCap.availableFunds, recoveryBaseline);
assert.equal(currentCashCap.cumulativeRecovered, 500);
assert.equal(currentCashCap.cumulativeRecoveryRatio, 0.05);

const tacticalRecovery = advanceBattleCashRecovery({
  baselineFunds: recoveryBaseline,
  availableFunds: 0,
  cumulativeRecovered: 0,
  elapsedSeconds: 60,
  timeScale: 0.1,
  windMultiplier: 1,
  terminal: false,
});
assert.equal(tacticalRecovery.availableFunds, 180);
assert.equal(tacticalRecovery.cumulativeRecoveryRatio, 0.018);

const playerTailwindRecovery = advanceBattleCashRecovery({
  baselineFunds: recoveryBaseline,
  availableFunds: 0,
  cumulativeRecovered: 0,
  elapsedSeconds: 10,
  timeScale: 1,
  windMultiplier:
    getBattleCashRecoveryWindMultipliers('TAILWIND_PLAYER').player,
  terminal: false,
});
assert.equal(playerTailwindRecovery.availableFunds, 375);
const playerHeadwindRecovery = advanceBattleCashRecovery({
  baselineFunds: recoveryBaseline,
  availableFunds: 0,
  cumulativeRecovered: 0,
  elapsedSeconds: 10,
  timeScale: 1,
  windMultiplier:
    getBattleCashRecoveryWindMultipliers('HEADWIND_PLAYER').player,
  terminal: false,
});
assert.equal(playerHeadwindRecovery.availableFunds, 225);
const enemyTailwindRecovery = advanceBattleCashRecovery({
  baselineFunds: recoveryBaseline,
  availableFunds: 0,
  cumulativeRecovered: 0,
  elapsedSeconds: 10,
  timeScale: 1,
  windMultiplier:
    getBattleCashRecoveryWindMultipliers('TAILWIND_ENEMY').enemy,
  terminal: false,
});
assert.equal(enemyTailwindRecovery.availableFunds, 375);
const crosswindPlayerRecovery = advanceBattleCashRecovery({
  baselineFunds: recoveryBaseline,
  availableFunds: 0,
  cumulativeRecovered: 0,
  elapsedSeconds: 10,
  timeScale: 1,
  windMultiplier: getBattleCashRecoveryWindMultipliers('CROSSWIND').player,
  terminal: false,
});
const crosswindEnemyRecovery = advanceBattleCashRecovery({
  baselineFunds: recoveryBaseline,
  availableFunds: 0,
  cumulativeRecovered: 0,
  elapsedSeconds: 10,
  timeScale: 1,
  windMultiplier: getBattleCashRecoveryWindMultipliers('CROSSWIND').enemy,
  terminal: false,
});
assert.equal(crosswindPlayerRecovery.availableFunds, 360);
assert.equal(crosswindEnemyRecovery.availableFunds, 360);

const trainingRecovery = advanceBattleCashRecovery({
  baselineFunds: recoveryBaseline,
  availableFunds: 1_000,
  cumulativeRecovered: 0,
  elapsedSeconds: 10,
  timeScale: 1,
  windMultiplier: 1,
  terminal: false,
});
assert.equal(trainingRecovery.availableFunds, 1_300);
assert.equal(
  trainingRecovery.cumulativeRecovered,
  300,
  'training uses the same current-100% and cumulative-20% recovery limits'
);

const terminalRecoveryState = {
  baselineFunds: recoveryBaseline,
  availableFunds: 1_234,
  cumulativeRecovered: 567,
  elapsedSeconds: 60,
  timeScale: 1,
  windMultiplier: 1.25,
  terminal: true,
};
assert.deepEqual(
  advanceBattleCashRecovery(terminalRecoveryState),
  {
    availableFunds: 1_234,
    cumulativeRecovered: 567,
    recoveredThisStep: 0,
    cumulativeRecoveryRatio: 0.0567,
  },
  'terminal battle state freezes cash recovery'
);

assert.deepEqual(BLACKEST_NIGHT_BALANCE, {
  durationMs: 7_000,
  absorbRatio: 1,
  gaugeCapacity: 50,
  triggerPlayerOwnership: 52,
  maxUsesPerBattle: 1,
  darkWaveOwnershipPush: 10,
  darkWaveGaugeDelta: 20,
  procOnlyOnFullBreak: true,
});
assert.deepEqual(
  ENEMY_SUPPORT_SKILL_BALANCE.blackestNight,
  BLACKEST_NIGHT_BALANCE,
  'player and enemy Blackest Night share one finite-barrier contract'
);
assert.deepEqual(ENEMY_SUPPORT_SKILL_BALANCE.drain, {
  handCashRatio: 0.18,
  marketPriceCapRatio: 0.1,
  maxUsesPerBattle: 1,
});
assert.deepEqual(ENEMY_SUPPORT_SKILL_BALANCE.cashRecovery, {
  passiveRecoveryCapRatio: 0.12,
});
assert.deepEqual(
  applyBlackestNightToGaugeDelta({
    currentGauge: 0,
    nextGauge: -64,
    protects: 'opponent',
    remainingGaugeCapacity: 50,
  }),
  {
    nextGauge: -14,
    absorbedGauge: 50,
    remainingGaugeCapacity: 0,
    didFullyBreak: true,
  },
  'enemy Blackest Night absorbs 25 ownership points, lets overflow through and marks a full break'
);
assert.deepEqual(
  applyBlackestNightToGaugeDelta({
    currentGauge: 0,
    nextGauge: 18,
    protects: 'player',
    remainingGaugeCapacity: 50,
  }),
  {
    nextGauge: 0,
    absorbedGauge: 18,
    remainingGaugeCapacity: 32,
    didFullyBreak: false,
  },
  'player Blackest Night uses the same gauge-capacity rule in the opposite direction'
);
assert.deepEqual(
  applyBlackestNightToGaugeDelta({
    currentGauge: 0,
    nextGauge: 10,
    protects: 'opponent',
    remainingGaugeCapacity: 50,
  }),
  {
    nextGauge: 10,
    absorbedGauge: 0,
    remainingGaugeCapacity: 50,
    didFullyBreak: false,
  },
  'Blackest Night ignores pressure moving away from its protected side'
);
assert.equal(
  getBlackestNightDisplayPercent({
    remainingGaugeCapacity: 50,
    remainingMs: 7_000,
  }),
  100
);
assert.equal(
  getBlackestNightDisplayPercent({
    remainingGaugeCapacity: 25,
    remainingMs: 7_000,
  }),
  50
);
assert.equal(
  getBlackestNightDisplayPercent({
    remainingGaugeCapacity: 50,
    remainingMs: 3_500,
  }),
  50,
  'barrier HUD displays the lower of capacity and remaining time'
);
assert.equal(
  getBlackestNightDisplayPercent({
    remainingGaugeCapacity: 50,
    remainingMs: 0,
  }),
  0
);
assert.equal(
  shouldEnemyUseBlackestNight({ playerOwnership: 51.99, terminal: false }),
  false
);
assert.equal(
  shouldEnemyUseBlackestNight({ playerOwnership: 52, terminal: false }),
  true,
  'enemy Blackest Night trigger includes the exact 52% pressure boundary'
);
assert.equal(
  shouldEnemyUseBlackestNight({ playerOwnership: 100, terminal: true }),
  false,
  'enemy Blackest Night never starts after terminal settlement'
);
assert.equal(getBlackestNightDarkWaveGaugeDelta('player'), -20);
assert.equal(getBlackestNightDarkWaveGaugeDelta('opponent'), 20);
assert.deepEqual(CAPITAL_REVERSAL_BALANCE, {
  durationMs: 10_000,
  triggerPlayerOwnership: 55,
  retainedDirectInvestmentRatio: 0.7,
  reflectedOwnershipRatio: 0.3,
  reflectedOwnershipCap: 8,
  maxUsesPerBattle: 1,
  requiresResolutionBeforeSettlement: true,
});
assert.deepEqual(resolveCapitalReversal(40), {
  retainedOwnershipPush: 28,
  reflectedOwnershipPush: 8,
  netPlayerOwnershipPush: 20,
  gaugeDelta: -40,
});
assert.deepEqual(FORCED_LIQUIDATION_BALANCE, {
  triggerPlayerOwnership: 75,
  unmitigatedTargetPlayerOwnership: 3,
  firstClearRecoveryGraceMs: 3_000,
  repeatRecoveryGraceMs: 1_800,
  maxUsesPerBattle: 1,
});
assert.equal(
  calculateForcedLiquidationGaugeDelta(75),
  144,
  'unmitigated liquidation falls from 75% ownership to the authored 3% target'
);
assert.equal(
  resolveForcedLiquidationContinuousVelocity({
    velocity: -6,
    recoveryRemaining: 1_800,
    awaitingManualCounter: true,
  }),
  0,
  'pre-cast player and friendly continuous pressure cannot win before a manual counter-command'
);
assert.equal(
  resolveForcedLiquidationContinuousVelocity({
    velocity: -6,
    recoveryRemaining: 1_800,
    awaitingManualCounter: false,
  }),
  -6,
  'the first genuine manual command releases player continuous pressure during the grace'
);
assert.equal(
  resolveForcedLiquidationContinuousVelocity({
    velocity: -6,
    recoveryRemaining: 0,
    awaitingManualCounter: true,
  }),
  -6,
  'grace expiry releases player continuous pressure even without a manual command'
);
assert.equal(
  resolveForcedLiquidationContinuousVelocity({
    velocity: 6,
    recoveryRemaining: 1_800,
    awaitingManualCounter: false,
  }),
  0,
  'enemy continuous pressure stays suspended for the full authored grace'
);
assert.equal(
  calculateEnemyDrainAmount({ playerCash: 10_000, marketPrice: 10_000 }),
  1_000,
  'Drain is capped at 10% of target price'
);
assert.equal(
  calculateEnemyDrainAmount({ playerCash: 2_000, marketPrice: 10_000 }),
  360,
  'Drain takes 18% of the player hand when below its market cap'
);
assert.deepEqual(
  resolveEnemyDrainTransfer({
    playerCash: 10_000,
    enemyReserve: 4_000,
    marketPrice: 10_000,
  }),
  {
    playerCash: 9_000,
    enemyReserve: 5_000,
    transferred: 1_000,
  },
  'Drain moves the same uncommitted cash amount between both ledgers'
);
assert.deepEqual(
  resolveEnemyDrainTransfer({
    playerCash: Number.NaN,
    enemyReserve: Number.POSITIVE_INFINITY,
    marketPrice: -1,
  }),
  {
    playerCash: 0,
    enemyReserve: 0,
    transferred: 0,
  },
  'Drain sanitizes invalid inputs without creating capital'
);

assert.deepEqual(
  advanceBattleCashRecovery({
    baselineFunds: recoveryBaseline,
    availableFunds: 11_000,
    cumulativeRecovered: 0,
    elapsedSeconds: 60,
    timeScale: 1,
    windMultiplier: 1,
    terminal: false,
  }),
  {
    availableFunds: 11_000,
    cumulativeRecovered: 0,
    recoveredThisStep: 0,
    cumulativeRecoveryRatio: 0,
  },
  'passive recovery preserves Drain reserve above the opening baseline'
);
assert.deepEqual(
  advanceBattleCashRecovery({
    baselineFunds: recoveryBaseline,
    availableFunds: 9_000,
    cumulativeRecovered: 0,
    elapsedSeconds: 10,
    timeScale: 1,
    windMultiplier: 1,
    terminal: false,
  }),
  {
    availableFunds: 9_300,
    cumulativeRecovered: 300,
    recoveredThisStep: 300,
    cumulativeRecoveryRatio: 0.03,
  },
  'passive recovery resumes normally after the surplus is spent below baseline'
);

assert.equal(calculateEnemyDrillReserveCost(10_000), 600);
assert.equal(calculateEnemyDrillReserveCost(0), 0);
assert.equal(canEnemyAffordDrill(599, 10_000), false);
assert.equal(canEnemyAffordDrill(600, 10_000), true);
assert.equal(canEnemyAffordDrill(0, 0), false);
assert.equal(getEnemyDrillOwnershipPush({}), 5);
assert.equal(getEnemyDrillOwnershipPush({ isSavage: true }), 8);
assert.equal(getEnemyDrillOwnershipPush({ isUltimate: true }), 10);
assert.deepEqual(
  getEnemyDrillImpact({
    enemyBudget: 10_000,
  }),
  {
    baseOwnershipPush: 5,
    ownershipPush: 5,
    gaugeDelta: 10,
    reserveCost: 600,
  }
);
assert.deepEqual(
  getEnemyDrillImpact({
    enemyBudget: 10_000,
    isUltimate: true,
  }),
  {
    baseOwnershipPush: 10,
    ownershipPush: 10,
    gaugeDelta: 20,
    reserveCost: 600,
  },
  'Drill is self-contained and no longer depends on a hidden vulnerability mark'
);
assert.equal(getEnemyDivinationDurationMs({}), 4_000);
assert.equal(getEnemyDivinationDurationMs({ isSavage: true }), 5_000);
assert.equal(getEnemyDivinationDurationMs({ isUltimate: true }), 5_000);
assert.equal(
  ENEMY_SUPPORT_SKILL_BALANCE.divination.enemyInvestmentMultiplier,
  1.42
);

const enemyOwnershipBeforeReserveRecovery = 48;
const recoveredEnemyReserve = advanceBattleCashRecovery({
  baselineFunds: recoveryBaseline,
  availableFunds: 2_500,
  cumulativeRecovered: 0,
  elapsedSeconds: 10,
  timeScale: 1,
  windMultiplier: 1,
  terminal: false,
});
assert.equal(recoveredEnemyReserve.availableFunds, 2_800);
assert.equal(enemyOwnershipBeforeReserveRecovery, 48);
assert.equal(
  Object.hasOwn(recoveredEnemyReserve, 'ownership'),
  false,
  'enemy reserve recovery has no ownership side effect before the AI invests it'
);
assert.equal(calculateLimitBreakOwnershipPush(2_822, 1_000, 1, 1), 7);
assert.equal(calculateLimitBreakOwnershipPush(20_000, 1_000, 2, 1.15), 14);
assert.equal(calculateLimitBreakOwnershipPush(50_000, 1_000, 3, 1.15), 30);
assert.equal(calculateLimitBreakOwnershipPush(50_000, 1_000, 0, 1.15), 0);
assert.equal(
  calculateLimitBreakOwnershipAfterDefense(50, 14, 10),
  59,
  'LB2 from 50% stays below the 60% boss Cover threshold after emergency defense'
);
assert.equal(
  calculateLimitBreakOwnershipAfterDefense(51, 14, 10),
  60,
  'LB2 from 51% reaches the 60% boss Cover threshold'
);
assert.equal(calculateLimitBreakOwnershipAfterDefense(92, 10, 6), 99);
assert.equal(calculateLimitBreakOwnershipAfterDefense(94, 10, 6), 101);
assert.equal(getLimitBreakChargeCapacity(1), 100);
assert.equal(getLimitBreakChargeCapacity(2), 200);
assert.equal(getLimitBreakChargeCapacity(3), 300);
assert.equal(getChargedLimitBreakTier(99, 3), 0);
assert.equal(getChargedLimitBreakTier(100, 3), 1);
assert.equal(getChargedLimitBreakTier(250, 3), 2);
assert.equal(getChargedLimitBreakTier(300, 3), 3);
assert.equal(calculateLimitBreakChargeGain(0, 1_000), 0);
assert.equal(calculateLimitBreakChargeGain(20, 1_000), 5);
assert.equal(calculateLimitBreakChargeGain(100, 1_000), 9);
assert.equal(calculateLimitBreakChargeGain(350, 1_000), 24);
assert.equal(calculateLimitBreakChargeGain(1_000, 1_000), 29);
const mediumExchangeCharge =
  calculateLimitBreakChargeGain(200, 1_000) +
  calculateLimitBreakChargeGain(100, 1_000);
assert.equal(mediumExchangeCharge, 24);
assert.ok(mediumExchangeCharge * 4 < 100);
assert.ok(mediumExchangeCharge * 5 >= 100);
let repeatableLimitBreakCharge = 0;
for (let activation = 0; activation < 3; activation += 1) {
  for (let exchange = 0; exchange < 5; exchange += 1) {
    repeatableLimitBreakCharge = Math.min(
      getLimitBreakChargeCapacity(1),
      repeatableLimitBreakCharge + mediumExchangeCharge
    );
  }
  assert.equal(getChargedLimitBreakTier(repeatableLimitBreakCharge, 1), 1);
  repeatableLimitBreakCharge = consumeLimitBreakCharge(repeatableLimitBreakCharge);
  assert.equal(repeatableLimitBreakCharge, 0);
}
assert.equal(calculateOwnershipFromGauge(-100), 100);
assert.equal(normalizeLimitBreakCharge(undefined), 0);
assert.equal(normalizeLimitBreakCharge(Number.NaN), 0);
assert.equal(normalizeLimitBreakCharge(-20), 0);
assert.equal(normalizeLimitBreakCharge(175), 175);
assert.equal(normalizeLimitBreakCharge(999), 300);

const firstCampaignCommunity = COMMUNITY_CAMPAIGN_ORDER[0];
const secondCampaignCommunity = COMMUNITY_CAMPAIGN_ORDER[1];
const thirdCampaignCommunity = COMMUNITY_CAMPAIGN_ORDER[2];
const firstCampaignTargetIds = new Set(
  getCampaignProperties(INITIAL_PROPERTIES, firstCampaignCommunity).map(
    (property) => property.id
  )
);
const conqueredFirstCityProperties = INITIAL_PROPERTIES.map((property) =>
  firstCampaignTargetIds.has(property.id)
    ? { ...property, owner: 'player' as const, ownerName: '進行テスト商会' }
    : { ...property }
);
assert.ok(
  getCurrentlyControlledCommunityIds(conqueredFirstCityProperties).includes(
    firstCampaignCommunity
  )
);
assert.deepEqual(
  normalizeConqueredCommunityIds({
    properties: conqueredFirstCityProperties,
  }),
  [firstCampaignCommunity],
  'a fully controlled city becomes permanent campaign history'
);

const rebelledFirstCityProperties = conqueredFirstCityProperties.map(
  (property) =>
    property.id === Array.from(firstCampaignTargetIds)[0]
      ? {
          ...property,
          owner: 'independent' as const,
          ownerName: '独立物件',
          reacquisitionLevel: 1,
        }
      : property
);
assert.ok(
  !getCurrentlyControlledCommunityIds(rebelledFirstCityProperties).includes(
    firstCampaignCommunity
  ),
  'rebellion removes current regional control'
);
assert.ok(
  getCompletedCommunityNetworkIds(rebelledFirstCityProperties).includes(
    firstCampaignCommunity
  ),
  'a departed contact remains part of the explored city-network record'
);
assert.deepEqual(
  getCommunityNetworkProgress(
    rebelledFirstCityProperties,
    firstCampaignCommunity
  ),
  { available: 1, connected: 2, total: 2, complete: true },
  'route discovery and currently callable support remain separate'
);
const [firstNetworkContactId, firstNetworkBossId] = Array.from(
  firstCampaignTargetIds
);
const completionWithSameSettlementDeparture =
  applyNormalBattlePropertyUpdates({
    properties: INITIAL_PROPERTIES.map((property) =>
      property.id === firstNetworkContactId
        ? { ...property, owner: 'player' as const, ownerName: '進行テスト商会' }
        : property
    ),
    winner: 'player',
    targetPropertyId: firstNetworkBossId,
    companyName: '進行テスト商会',
    rebelledProperties: [
      INITIAL_PROPERTIES.find(
        (property) => property.id === firstNetworkContactId
      )!,
    ],
    survivingRiskUpdates: [],
  });
assert.equal(
  hasCompletedCommunityNetwork(
    completionWithSameSettlementDeparture,
    firstCampaignCommunity
  ),
  true,
  'a contact leaving in the boss settlement cannot erase the route just explored'
);
assert.equal(
  wouldCompleteCommunityNetwork(
    rebelledFirstCityProperties,
    firstCampaignCommunity,
    firstNetworkBossId
  ),
  true,
  'the pre-result victory presentation also recognizes a previously explored departed contact'
);
assert.equal(
  completionWithSameSettlementDeparture.find(
    (property) => property.id === firstNetworkContactId
  )?.owner,
  'independent',
  'the departed contact is still unavailable for battle support'
);
const retainedConquestAfterRebellion = normalizeConqueredCommunityIds({
  properties: rebelledFirstCityProperties,
  savedCommunityIds: [firstCampaignCommunity],
});
assert.deepEqual(
  retainedConquestAfterRebellion,
  [firstCampaignCommunity],
  'rebellion does not erase permanent route progress'
);
assert.ok(
  getUnlockedCommunityIds(
    new Set(retainedConquestAfterRebellion)
  ).has(secondCampaignCommunity),
  'the next city remains unlocked after a subsidiary rebels'
);
assert.deepEqual(
  getNormalBattleNavigation({
    winner: 'player',
    targetCommunity: firstCampaignCommunity,
    newlyConquered: true,
    isReacquisition: true,
  }),
  {
    community: firstCampaignCommunity,
    mode: 'targets',
    unlockedCommunity: null,
  },
  'Extreme reacquisition returns to the restored city without replaying an acknowledged city unlock'
);
assert.equal(
  getNormalBattleNavigation({
    winner: 'player',
    targetCommunity: firstCampaignCommunity,
    newlyConquered: true,
  }).unlockedCommunity,
  secondCampaignCommunity,
  'a genuine first conquest still announces the next city'
);

const laterCityHoldingId = getCampaignProperties(
  INITIAL_PROPERTIES,
  thirdCampaignCommunity
)[0].id;
const laterCityHoldingProperties = INITIAL_PROPERTIES.map((property) =>
  property.id === laterCityHoldingId
    ? { ...property, owner: 'player' as const, ownerName: '旧セーブ商会' }
    : { ...property }
);
assert.deepEqual(
  normalizeConqueredCommunityIds({
    properties: laterCityHoldingProperties,
  }),
  COMMUNITY_CAMPAIGN_ORDER.slice(0, 2),
  'legacy saves infer previously cleared routes from a later-city holding'
);
assert.deepEqual(
  normalizeConqueredCommunityIds({
    properties: rebelledFirstCityProperties,
    seenUnlockIds: ['rival_wind'],
  }),
  COMMUNITY_CAMPAIGN_ORDER.slice(0, 2),
  'legacy feature tutorials recover the minimum previously cleared route depth'
);
assert.deepEqual(
  normalizeConqueredCommunityIds({
    properties: rebelledFirstCityProperties,
    seenUnlockIds: ['opening_auto'],
  }),
  COMMUNITY_CAMPAIGN_ORDER,
  'a legacy opening AUTO tutorial implies the completed normal story needed to reach Savage'
);
assert.deepEqual(
  normalizeConqueredCommunityIds({
    properties: rebelledFirstCityProperties,
    seenUnlockIds: ['critical_auto'],
  }),
  COMMUNITY_CAMPAIGN_ORDER,
  'a legacy critical AUTO tutorial implies the completed normal story needed to reach Savage'
);
assert.equal(
  normalizeConqueredCommunityIds({
    properties: conqueredFirstCityProperties,
    savedCommunityIds: [firstCampaignCommunity],
  }).filter((communityId) => communityId === firstCampaignCommunity).length,
  1,
  'reacquiring a rebelled city does not create a second conquest'
);

const originalWindow = globalThis.window;
let savedPayload = '';
let legacyCompanyName = '';
let failPrimaryWrite = false;
let failLegacyWrite = false;
let failLegacyRead = false;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => {
        if (key === SAVE_STORAGE_KEY) return savedPayload;
        if (failLegacyRead) throw new DOMException('denied', 'SecurityError');
        return legacyCompanyName || null;
      },
      setItem: (key: string, value: string) => {
        if (key === SAVE_STORAGE_KEY) {
          if (failPrimaryWrite) throw new DOMException('denied', 'SecurityError');
          savedPayload = value;
          return;
        }
        if (failLegacyWrite) throw new DOMException('denied', 'SecurityError');
        legacyCompanyName = value;
      },
      removeItem: () => undefined,
    },
  },
});
const legacySchemaThreePayload = {
  schemaVersion: 3,
  companyName: '旧セーブ商会',
  totalFunds: 123_456,
  properties: [],
  equippedSkillIds: [],
  alliance: { allyId: '', allyName: '', active: false },
  lastSavedAt: 1,
};
assert.deepEqual(
  normalizeAutoSkillLoadout({
    equippedSkillIds: ['skill_fast_horse', 'skill_demoralize'],
    openingAutoSkillId: 'skill_fast_horse',
    criticalAutoSkillId: 'skill_demoralize',
  }),
  {
    openingAutoSkillId: 'skill_fast_horse',
    criticalAutoSkillId: 'skill_demoralize',
  },
  'AUTO assignments use skills from the existing equipped slots'
);
assert.deepEqual(
  normalizeAutoSkillLoadout({
    equippedSkillIds: ['skill_fast_horse'],
    openingAutoSkillId: 'skill_fast_horse',
    criticalAutoSkillId: 'skill_fast_horse',
  }),
  {
    openingAutoSkillId: 'skill_fast_horse',
    criticalAutoSkillId: null,
  },
  'one equipped ability cannot occupy both AUTO slots'
);
assert.deepEqual(
  normalizeAutoSkillLoadout({
    equippedSkillIds: ['unknown_skill'],
    openingAutoSkillId: 'unknown_skill',
    criticalAutoSkillId: 42,
  }),
  {
    openingAutoSkillId: null,
    criticalAutoSkillId: null,
  },
  'unknown, unequipped and malformed AUTO assignments normalize to null'
);
assert.deepEqual(
  normalizeSavedAbilityLoadout({
    equippedSkillIds: [
      'skill_fast_horse',
      'skill_synergy_push',
      'skill_demoralize',
      'skill_capital_boost',
      'skill_sns_blitz',
      'skill_sabotage',
      'skill_fast_horse',
      'skill_era_wind',
    ],
    openingAutoSkillId: 'skill_fast_horse',
    criticalAutoSkillId: 'skill_sns_blitz',
    reserveSkillId: 'skill_sabotage',
  }),
  {
    equippedSkillIds: [
      'skill_fast_horse',
      'skill_synergy_push',
      'skill_demoralize',
      'skill_capital_boost',
      'skill_sns_blitz',
    ],
    openingAutoSkillId: 'skill_fast_horse',
    criticalAutoSkillId: 'skill_sns_blitz',
    reserveSkillId: null,
    manualSkillIds: [
      'skill_synergy_push',
      'skill_demoralize',
      'skill_capital_boost',
    ],
  },
  'legacy reserve saves migrate to three manual and two AUTO slots without a waiting ability'
);
assert.deepEqual(
  normalizeSavedAbilityLoadout({
    equippedSkillIds: [
      'skill_fast_horse',
      'skill_synergy_push',
      'skill_demoralize',
      'skill_capital_boost',
      'skill_sns_blitz',
      'skill_sabotage',
      'skill_era_wind',
    ],
    openingAutoSkillId: null,
    criticalAutoSkillId: null,
    reserveSkillId: null,
  }),
  {
    equippedSkillIds: [
      'skill_fast_horse',
      'skill_synergy_push',
      'skill_demoralize',
    ],
    openingAutoSkillId: null,
    criticalAutoSkillId: null,
    reserveSkillId: null,
    manualSkillIds: [
      'skill_fast_horse',
      'skill_synergy_push',
      'skill_demoralize',
    ],
  },
  'legacy overfilled saves migrate deterministically without auto-equipping unexpected skills'
);
savedPayload = JSON.stringify(legacySchemaThreePayload);
const restoredLegacySave = loadGameSave();
assert.ok(restoredLegacySave);
assert.equal(
  restoredLegacySave.passiveIncomePaused,
  false,
  'legacy training pause markers migrate without suppressing future income'
);
assert.deepEqual(restoredLegacySave.savageClearedPropertyIds, []);
assert.equal(restoredLegacySave.normalEndingSeen, false);
assert.equal(restoredLegacySave.savageEndingSeen, false);
assert.equal(restoredLegacySave.ultimateCleared, false);
assert.equal(restoredLegacySave.trueEndingSeen, false);
assert.equal(restoredLegacySave.selectedBattleSynergyId, null);
assert.equal(restoredLegacySave.openingAutoSkillId, null);
assert.equal(restoredLegacySave.criticalAutoSkillId, null);
assert.equal(restoredLegacySave.grandCompanyEorzeaIntegrated, false);
assert.equal(restoredLegacySave.savageProgressVersion, undefined);
assert.deepEqual(restoredLegacySave.conqueredCommunityIds, []);
savedPayload = JSON.stringify({
  ...legacySchemaThreePayload,
  conqueredCommunityIds: [
    firstCampaignCommunity,
    secondCampaignCommunity,
    '存在しない都市',
  ],
});
const restoredCampaignHistory = loadGameSave();
assert.deepEqual(restoredCampaignHistory?.conqueredCommunityIds, [
  firstCampaignCommunity,
  secondCampaignCommunity,
]);
const durableTestSave = {
  companyName: '勝利確定テスト商会',
  totalFunds: 98_765,
  properties: conqueredFirstCityProperties,
  equippedSkillIds: [],
  alliance: {
    allyId: '',
    allyName: '',
    active: false,
    allyKind: 'company',
    relationType: 'commercial_alliance',
  },
  conqueredCommunityIds: [firstCampaignCommunity],
} satisfies Parameters<typeof saveGame>[0];
assert.equal(saveGame(durableTestSave), true);
const immediatelyCommittedVictory = loadGameSave();
assert.equal(immediatelyCommittedVictory?.totalFunds, 98_765);
assert.deepEqual(immediatelyCommittedVictory?.conqueredCommunityIds, [
  firstCampaignCommunity,
]);
assert.equal(
  immediatelyCommittedVictory?.properties.find(
    (property) => property.id === Array.from(firstCampaignTargetIds)[0]
  )?.owner,
  'player',
  'victory ownership and permanent route progress are durable in the same save'
);
assert.equal(
  saveGame({
    ...durableTestSave,
    equippedSkillIds: ['skill_fast_horse', 'skill_demoralize'],
    openingAutoSkillId: 'skill_fast_horse',
    criticalAutoSkillId: 'skill_demoralize',
  }),
  true
);
const restoredAutoLoadout = loadGameSave();
assert.equal(restoredAutoLoadout?.openingAutoSkillId, 'skill_fast_horse');
assert.equal(restoredAutoLoadout?.criticalAutoSkillId, 'skill_demoralize');
assert.equal(
  saveGame({
    ...durableTestSave,
    equippedSkillIds: [
      'skill_fast_horse',
      'skill_synergy_push',
      'skill_demoralize',
      'skill_capital_boost',
      'skill_sns_blitz',
      'skill_sabotage',
    ],
    openingAutoSkillId: 'skill_fast_horse',
    criticalAutoSkillId: 'skill_sns_blitz',
    reserveSkillId: 'skill_sabotage',
  }),
  true
);
const restoredSixRoleLoadout = loadGameSave();
assert.deepEqual(restoredSixRoleLoadout?.equippedSkillIds, [
  'skill_fast_horse',
  'skill_synergy_push',
  'skill_demoralize',
  'skill_capital_boost',
  'skill_sns_blitz',
]);
assert.equal(restoredSixRoleLoadout?.openingAutoSkillId, 'skill_fast_horse');
assert.equal(restoredSixRoleLoadout?.criticalAutoSkillId, 'skill_sns_blitz');
assert.equal(restoredSixRoleLoadout?.reserveSkillId, null);
assert.equal(
  saveGame({
    ...durableTestSave,
    grandCompanyEorzeaIntegrated: true,
  }),
  true
);
assert.equal(
  loadGameSave()?.grandCompanyEorzeaIntegrated,
  true,
  'the all-business integration milestone survives a save round trip'
);
failLegacyWrite = true;
assert.equal(
  saveGame({ ...durableTestSave, totalFunds: 98_766 }),
  true,
  'a failed legacy-name mirror does not invalidate the authoritative save'
);
failLegacyWrite = false;
const saveBeforeDeniedPrimary = savedPayload;
failPrimaryWrite = true;
assert.equal(
  saveGame({ ...durableTestSave, totalFunds: 1 }),
  false,
  'a denied primary write reports failure to the result-confirmation flow'
);
assert.equal(savedPayload, saveBeforeDeniedPrimary);
failPrimaryWrite = false;
failLegacyRead = true;
assert.equal(
  loadLegacyCompanyName(),
  null,
  'legacy-name access denial cannot crash application initialization'
);
failLegacyRead = false;
savedPayload = JSON.stringify({
  ...legacySchemaThreePayload,
  passiveIncomePaused: true,
});
const restoredPausedTrainingSave = loadGameSave();
assert.equal(
  restoredPausedTrainingSave?.passiveIncomePaused,
  false,
  'training no longer pauses passive or offline income'
);
assert.equal(
  calculateOfflineIncome(40, 1_000, 61_000),
  2_400,
  'one minute spent in training still earns the normal passive income'
);
savedPayload = JSON.stringify({
  ...legacySchemaThreePayload,
  savageClearedPropertyIds: savageTargetIds.slice(0, 3),
  savageProgressVersion: 2,
  normalEndingSeen: true,
  trueEndingSeen: false,
});
const restoredSavageSave = loadGameSave();
assert.deepEqual(restoredSavageSave?.savageClearedPropertyIds, savageTargetIds.slice(0, 3));
assert.equal(restoredSavageSave?.savageProgressVersion, 2);
assert.equal(restoredSavageSave?.normalEndingSeen, true);
assert.equal(restoredSavageSave?.trueEndingSeen, false);
savedPayload = JSON.stringify({
  ...legacySchemaThreePayload,
  savageClearedPropertyIds: allNormalBusinessIds,
  normalEndingSeen: true,
  trueEndingSeen: true,
});
const restoredOldTrueEndingSave = loadGameSave();
assert.equal(restoredOldTrueEndingSave?.savageEndingSeen, true);
assert.equal(restoredOldTrueEndingSave?.ultimateCleared, false);
assert.equal(restoredOldTrueEndingSave?.trueEndingSeen, false);
savedPayload = JSON.stringify({
  ...legacySchemaThreePayload,
  savageClearedPropertyIds: savageTargetIds,
  savageProgressVersion: 3,
  normalEndingSeen: true,
  savageEndingSeen: true,
  ultimateCleared: true,
  trueEndingSeen: true,
  selectedBattleSynergyId: 'KUGANE_TRADE_GATEWAY',
});
const restoredUltimateSave = loadGameSave();
assert.equal(restoredUltimateSave?.savageProgressVersion, 3);
assert.equal(restoredUltimateSave?.ultimateCleared, true);
assert.equal(restoredUltimateSave?.trueEndingSeen, true);
assert.equal(restoredUltimateSave?.selectedBattleSynergyId, 'KUGANE_TRADE_GATEWAY');
assert.equal(
  restoredUltimateSave?.cruelCleared,
  false,
  'schema-v3 saves made before Cruel default to an uncleared optional record'
);
savedPayload = JSON.stringify({
  ...legacySchemaThreePayload,
  equippedSkillIds: ['skill_fast_horse', 'skill_era_wind'],
  savageClearedPropertyIds: savageTargetIds,
  savageProgressVersion: 3,
  selectedBattleSynergyId: 'KUGANE_TRADE_GATEWAY',
});
const restoredLegacyEraWindSave = loadGameSave();
assert.equal(
  restoredLegacyEraWindSave?.selectedBattleSynergyId,
  'ERA_WIND_SYNERGY',
  'legacy Era Wind equipment migrates to the unlocked top-tier battle synergy'
);
savedPayload = JSON.stringify({
  ...legacySchemaThreePayload,
  savageClearedPropertyIds: savageTargetIds,
  savageProgressVersion: 3,
  savageEndingSeen: true,
  ultimateCleared: true,
  trueEndingSeen: true,
  cruelCleared: true,
});
const restoredCruelSave = loadGameSave();
assert.equal(restoredCruelSave?.cruelCleared, true);
assert.equal(restoredCruelSave?.ultimateCleared, true);
assert.equal(
  restoredCruelSave?.trueEndingSeen,
  true,
  'the optional Cruel record never rewrites or replays the true ending'
);
Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });

const preFinalCommunityIds = new Set(COMMUNITY_CAMPAIGN_ORDER.slice(0, 9));
const preFinalTargets = INITIAL_PROPERTIES.filter(
  (property) =>
    preFinalCommunityIds.has(property.community) &&
    countsTowardCityConquest(property)
);
const preFinalRevenue = preFinalTargets.reduce(
  (total, property) => total + property.annualRevenue * PASSIVE_REVENUE_MULTIPLIER,
  0
);
const bridgeToFirstCartelSeconds = 40_000_000 / preFinalRevenue;
assert.ok(bridgeToFirstCartelSeconds >= 120 && bridgeToFirstCartelSeconds <= 300);

console.log(JSON.stringify({
  campaignSummary,
  preFinalRevenue,
  bridgeToFirstCartelSeconds: Math.round(bridgeToFirstCartelSeconds),
  savageSummary: {
    targetCount: savageProperties.length,
    minPrice: Math.min(...savageProperties.map((property) => property.marketPrice)),
    maxPrice: Math.max(...savageProperties.map((property) => property.marketPrice)),
    enemyBudgetMultiplier: SAVAGE_ENEMY_BUDGET_MULTIPLIER,
    ultimatePrice: ultimateProperty.marketPrice,
    ultimateEnemyBudgetMultiplier: ULTIMATE_ENEMY_BUDGET_MULTIPLIER,
  },
  enemyBudgetRatios: {
    tutorial: enemyBudgetRatio('prop_starter_farm', true),
    goldSaucer: enemyBudgetRatio('prop_casino_grand'),
    lateNormal: enemyBudgetRatio('prop_coffee_aurora'),
    cartelMember: enemyBudgetRatio('prop_abyss_heavy'),
    cartelHq: enemyBudgetRatio('prop_abyss_hq'),
  },
}, null, 2));

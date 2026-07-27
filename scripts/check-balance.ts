import assert from 'node:assert/strict';
import {
  INITIAL_CARTELS,
  INITIAL_GROUP_SYNERGIES,
  INITIAL_PROPERTIES,
  INITIAL_SKILLS,
} from '../src/data/initialData';
import { ALLIANCE_CANDIDATES, GRAND_COMPANY_NAMES } from '../src/data/allianceData';
import { COMMUNITY_CAMPAIGN_ORDER } from '../src/data/worldData';
import {
  decideEnemyAction,
  getEnemyBaseWaitMs,
  type EnemyDecisionContext,
} from '../src/utils/enemyAi';
import { calculateBattleReadiness } from '../src/utils/battleReadiness';
import {
  applyNormalBattlePropertyUpdates,
  calculateLiquidationCashback,
} from '../src/utils/battleSettlement';
import {
  BATTLE_CINEMATIC_TIMING,
  BATTLE_GAUGE_VISUAL_COMMIT_MS,
  BATTLE_STATUS_MESSAGE_DURATION_MS,
  canConfirmBattleResult,
  enqueueBattleStatusMessage,
  getBattleCapitalVisualBundleCount,
  getNextBattleSkillId,
  getTerminalCinematicPresentation,
  getBattleCinematicLayer,
  getCapitalVisualBundleCount,
  getCapitalVisualBundleCountForAmount,
  getCapitalVisualSpriteCount,
  getCapitalVisualStage,
  getCapitalVisualStageForBundleCount,
  getVictoryConfettiParticleCount,
  normalizeBattleStatusMessageText,
  RESULT_CONFIRM_ARM_DELAY_MS,
  selectBattleStatusMessage,
  SKILL_CINEMATIC_TIMING,
  shouldInertBattleFooter,
  TERMINAL_CINEMATIC_TIMING,
} from '../src/utils/battlePresentation';
import {
  parsePendingBattleSession,
  PENDING_BATTLE_SESSION_MAX_AGE_MS,
} from '../src/utils/battleSession';
import { calculateCartelHeadquartersDefense } from '../src/utils/cartel';
import {
  calculateGaugeVelocity,
  calculateRebellionProbability,
} from '../src/utils/formatter';
import {
  getWindPool,
  getWindProgressionStage,
  WIND_ACTIVE_SECONDS,
  WIND_CALM_SECONDS,
} from '../src/components/WindIndicator';
import {
  calculateOfflineIncome,
  loadGameSave,
  normalizeAllianceState,
  normalizeLimitBreakCharge,
  restoreProperties,
  saveGame,
  SAVE_STORAGE_KEY,
} from '../src/utils/saveData';
import {
  getCurrentlyControlledCommunityIds,
  getUnlockedCommunityIds,
  normalizeConqueredCommunityIds,
} from '../src/utils/campaignProgress';
import {
  applySavageSynergyUpgrades,
  buildUltimateProperty,
  buildSavageProperties,
  getSavagePropertyYieldMultiplier,
  getSavageSynergyRanks,
  getSavageTargetIds,
  getUnlockedSavageRaidIds,
  normalizeSavageClearedRaidIds,
  SAVAGE_GROUP_MULTIPLIER_BASE,
  SAVAGE_GROUP_MULTIPLIER_BONUS_PER_RANK,
  SAVAGE_PROPERTY_YIELD_BONUS,
  SAVAGE_RAID_DEFINITIONS,
  SAVAGE_YIELD_BONUS_PER_RANK,
  ULTIMATE_RAID_DEFINITION,
} from '../src/utils/savage';
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
  applyTrainingGaugeSpeed,
  BATTLE_CASH_RECOVERY_RATE_PER_SECOND,
  BATTLE_CASH_RECOVERY_TOTAL_CAP_RATIO,
  BATTLE_CASH_RECOVERY_WIND_MULTIPLIERS,
  BATTLE_GAUGE_SPEED_FACTOR,
  calculateBattleVictoryReward,
  calculatePlayerBattleCashLimit,
  ENEMY_INITIAL_COMMITMENT_RATIO,
  INITIAL_PLAYER_FUNDS,
  PASSIVE_REVENUE_MULTIPLIER,
  PLAYER_BATTLE_CASH_CAP_RATIO,
  TACTICAL_SKILL_BALANCE,
  TRAINING_GAUGE_SPEED_MULTIPLIER,
  TRAINING_MIN_OWNERSHIP_PERCENT,
  calculateEnemyBudget,
  calculateLimitBreakAmount,
  calculateLimitBreakChargeGain,
  consumeLimitBreakCharge,
  calculateOwnershipFromGauge,
  calculateLimitBreakOwnershipAfterDefense,
  calculateLimitBreakOwnershipPush,
  countsTowardCityConquest,
  getCampaignProperties,
  getBattleCashRecoveryWindMultipliers,
  getBattleTerminalWinner,
  getChargedLimitBreakTier,
  getLimitBreakChargeCapacity,
  getLimitBreakTier,
  holdTrainingGaugeAboveDefeat,
  isSkillUnlocked,
  LIMIT_BREAK_CHARGE_GAIN_MULTIPLIER,
  LIMIT_BREAK_MULTIPLIERS,
  LIMIT_BREAK_OWNERSHIP_CAPS,
  NORMAL_ENEMY_BUDGET_MULTIPLIER,
  resolveLivingDeadOutcome,
  SAVAGE_ENEMY_BUDGET_MULTIPLIER,
  SAVAGE_LAYER_BUDGET_MULTIPLIERS,
  ULTIMATE_ENEMY_BUDGET_MULTIPLIER,
  getEnemyDifficultyLevel,
  getSavageLayerBudgetMultiplier,
  calculateEraWindCost,
  getEraWindGaugePushPerSecond,
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
const expectedCampaignCounts = [3, 2, 3, 4, 2, 1, 1, 1, 1, 2];
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

assert.equal(getWindProgressionStage(0, 0), 0);
assert.equal(
  getWindProgressionStage(1, 3),
  0,
  'the first Limsa battle remains a wind-free fundamentals battle'
);
assert.equal(getWindProgressionStage(1, 4), 1);
assert.deepEqual(getWindPool(1), ['TAILWIND_PLAYER']);
assert.equal(getWindProgressionStage(2, 5), 2);
assert.ok(getWindPool(2).includes('TAILWIND_ENEMY'));
assert.equal(getWindProgressionStage(3, 8), 3);
assert.ok(getWindPool(3).includes('HEADWIND_PLAYER'));
assert.ok(getWindPool(3).includes('CROSSWIND'));
assert.ok(
  WIND_ACTIVE_SECONDS + WIND_CALM_SECONDS >= 26,
  'non-calm wind events are separated by a readable calm interval'
);
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
assert.equal(battleWind.secondsRemaining, BATTLE_WIND_TELEGRAPH_SECONDS);
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
  BATTLE_GAUGE_VISUAL_COMMIT_MS,
  100,
  'the continuous gauge simulation commits React visuals at 10Hz'
);
assert.equal(
  SKILL_CINEMATIC_TIMING.nameMs +
    SKILL_CINEMATIC_TIMING.castMs +
    SKILL_CINEMATIC_TIMING.impactMs +
    SKILL_CINEMATIC_TIMING.resolveMs,
  SKILL_CINEMATIC_TIMING.totalMs,
  'skill name, cast, impact and result beats form one non-overlapping timeline'
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
  1,
  'the default first offer starts with one visible bundle'
);
assert.equal(getBattleCapitalVisualBundleCount(20_000, 100_000), 2);
assert.equal(
  getBattleCapitalVisualBundleCount(50_000, 100_000),
  3,
  'a typical opening defence stays a modest pile'
);
assert.equal(getBattleCapitalVisualBundleCount(100_000, 100_000), 5);
assert.equal(getBattleCapitalVisualBundleCount(2_000_000, 100_000), 13);
assert.equal(
  getBattleCapitalVisualBundleCount(20_000, 1_000_000),
  1,
  'the first visible offer is sparse in later chapters too'
);
assert.equal(
  getBattleCapitalVisualBundleCount(100_000_000, 1_000_000_000),
  1,
  'a first 10% offer stays sparse even in the final chapter'
);
assert.ok(
  getBattleCapitalVisualBundleCount(500_000_000, 1_000_000_000) >
    getBattleCapitalVisualBundleCount(50_000, 100_000),
  'the same relative pressure becomes a larger spectacle in late chapters'
);
assert.equal(getCapitalVisualStageForBundleCount(0), 0);
assert.equal(getCapitalVisualStageForBundleCount(4), 4);
assert.equal(getCapitalVisualStageForBundleCount(13), 13);
assert.equal(getCapitalVisualStageForBundleCount(99), 13);
assert.equal(getCapitalVisualSpriteCount(0), 0);
assert.equal(getCapitalVisualSpriteCount(3), 3);
assert.equal(
  getCapitalVisualSpriteCount(13),
  5,
  'field-filling hoards keep a bounded foreground sprite count'
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
  'impact'
);
assert.equal(
  getTerminalCinematicPresentation(
    TERMINAL_CINEMATIC_TIMING.anticipationMs +
      TERMINAL_CINEMATIC_TIMING.impactMs
  ).stage,
  'resolution'
);
assert.equal(
  getTerminalCinematicPresentation(TERMINAL_CINEMATIC_TIMING.totalMs).stage,
  'complete'
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
assert.ok(
  safeReadiness.playerExpectedCapital >
    riskyReadiness.playerExpectedCapital,
  'readiness discounts subsidiary support by rebellion probability'
);
assert.equal(safeReadiness.grade, 'advantage');
assert.notEqual(riskyReadiness.grade, 'advantage');
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
const perSafeRequestFailure = calculateRebellionProbability(18);
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
    (component) => component.label.includes('支援元2件へ各1回')
  ),
  'readiness details the subsidiary one-pass assumption'
);

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
    (component) => component.label === '協力支援1回'
  ),
  'readiness states the once-per-battle cooperation assumption'
);
assert.ok(
  lbReadiness.capitalComponents.some(
    (component) => component.label === '意気衝天1回'
  ),
  'readiness states the capital boost assumption'
);

const campaignSummary = COMMUNITY_CAMPAIGN_ORDER.map((community, index) => {
  const targets = getCampaignProperties(INITIAL_PROPERTIES, community);
  assert.equal(targets.length, expectedCampaignCounts[index], `campaign target count: stage ${index + 1}`);
  const maxPrice = Math.max(...targets.map((property) => property.marketPrice));
  assert.equal(maxPrice, expectedStageMaxPrices[index], `stage max price: stage ${index + 1}`);
  targets.forEach((property) => {
    const paybackSeconds = property.marketPrice /
      Math.max(1, property.annualRevenue * PASSIVE_REVENUE_MULTIPLIER);
    assert.ok(paybackSeconds >= 45 && paybackSeconds <= 210, `payback range: ${property.id}`);
  });
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

for (let index = 4; index <= 8; index += 1) {
  assert.ok(
    campaignSummary[index].maxPrice > campaignSummary[index - 1].maxPrice,
    `mid-game price curve: stage ${index + 1}`
  );
}

const savageTargetIds = getSavageTargetIds(INITIAL_PROPERTIES);
const savageProperties = buildSavageProperties(INITIAL_PROPERTIES, new Set(), '検証商会');
assert.equal(savageTargetIds.length, 4);
assert.equal(savageProperties.length, savageTargetIds.length);
assert.equal(new Set(savageTargetIds).size, savageTargetIds.length);
assert.deepEqual(SAVAGE_RAID_DEFINITIONS.map((raid) => raid.layer), [1, 2, 3, 4]);
assert.deepEqual(
  SAVAGE_RAID_DEFINITIONS.map((raid) => raid.marketPrice),
  [...SAVAGE_RAID_DEFINITIONS].map((raid) => raid.marketPrice).sort((a, b) => a - b),
  'Savage prices rise from layer 1 through layer 4'
);
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

const normalCampaignIds = COMMUNITY_CAMPAIGN_ORDER.flatMap((community) =>
  getCampaignProperties(INITIAL_PROPERTIES, community).map((property) => property.id)
);
const raidMemberIds = SAVAGE_RAID_DEFINITIONS.flatMap((raid) => raid.memberPropertyIds);
assert.equal(raidMemberIds.length, normalCampaignIds.length);
assert.equal(new Set(raidMemberIds).size, raidMemberIds.length);
assert.deepEqual([...raidMemberIds].sort(), [...normalCampaignIds].sort());

const synergyIds = new Set(INITIAL_GROUP_SYNERGIES.map((synergy) => synergy.id));
SAVAGE_RAID_DEFINITIONS.forEach((raid) => {
  assert.equal(
    raid.id,
    raid.battlePropertyId,
    `four-layer save key reuses its representative normal encounter: ${raid.id}`
  );
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
assert.deepEqual(
  new Set(SAVAGE_RAID_DEFINITIONS.flatMap((raid) => raid.rewardSynergyIds)),
  synergyIds,
  'all existing synergies have a Savage upgrade route'
);
assert.deepEqual(
  normalizeSavageClearedRaidIds(
    SAVAGE_RAID_DEFINITIONS[0].memberPropertyIds,
    false
  ),
  [SAVAGE_RAID_DEFINITIONS[0].id],
  'a legacy regional layer migrates only after all of its former encounters were cleared'
);
assert.deepEqual(
  normalizeSavageClearedRaidIds(
    SAVAGE_RAID_DEFINITIONS[0].memberPropertyIds.slice(0, -1),
    false
  ),
  [],
  'partial legacy regional progress does not skip the new coalition encounter'
);
assert.deepEqual(
  normalizeSavageClearedRaidIds(savageTargetIds.slice(0, 2), true),
  savageTargetIds.slice(0, 2),
  'current four-layer progress remains direct'
);
assert.deepEqual(
  normalizeSavageClearedRaidIds([], false, true),
  savageTargetIds,
  'legacy completed tier unlocks all four coalition layers'
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
assert.ok(
  ultimateProperty.marketPrice > savageProperties[savageProperties.length - 1].marketPrice
);
assert.match(ultimateProperty.description, /単独・最終高難度交易戦/);
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
assert.equal(calculateAllianceSupport(1_000_000), 320_000);
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
  ],
  equippedSkillIds: [],
  alliance: { allyId: '', allyName: '', active: false },
  lastSavedAt: 1,
});
assert.equal(restoredWorldCopy.find((property) => property.id === 'prop_abyss_heavy')?.ownerName, '独立物件');
assert.equal(restoredWorldCopy.find((property) => property.id === 'prop_abyss_heavy')?.owner, 'independent');
assert.equal(restoredWorldCopy.find((property) => property.id === 'prop_abyss_mine')?.ownerName, '知識・技術交易連盟');
assert.equal(restoredWorldCopy.find((property) => property.id === 'prop_starter_farm')?.ownerName, '旧セーブ商会');

const enemyBudgetRatio = (propertyId: string, isTutorial = false) => {
  const property = INITIAL_PROPERTIES.find((candidate) => candidate.id === propertyId)!;
  return calculateEnemyBudget({
    targetProperty: property,
    industryInfluence: noInfluence,
    regionalInfluence: noInfluence,
    isTutorial,
  }) / property.marketPrice;
};
assert.ok(Math.abs(enemyBudgetRatio('prop_starter_farm', true) - 0.5599) < 0.001);
assert.ok(Math.abs(enemyBudgetRatio('prop_casino_grand') - 1.1228) < 0.001);
assert.ok(Math.abs(enemyBudgetRatio('prop_coffee_aurora') - 1.2202) < 0.001);
assert.ok(Math.abs(enemyBudgetRatio('prop_abyss_heavy') - 1.5624) < 0.001);
assert.ok(Math.abs(enemyBudgetRatio('prop_abyss_hq') - 2.268) < 0.001);
const savageBudgetTarget = savageProperties[0];
const savageBudget = calculateEnemyBudget({
  targetProperty: savageBudgetTarget,
  industryInfluence: noInfluence,
  regionalInfluence: noInfluence,
  isTutorial: false,
  isSavage: true,
});
const sameTargetNormalBudget = calculateEnemyBudget({
  targetProperty: savageBudgetTarget,
  industryInfluence: noInfluence,
  regionalInfluence: noInfluence,
  isTutorial: false,
});
assert.equal(
  savageBudget,
  Math.round(
    sameTargetNormalBudget *
      (1 / NORMAL_ENEMY_BUDGET_MULTIPLIER) *
      SAVAGE_ENEMY_BUDGET_MULTIPLIER *
      getSavageLayerBudgetMultiplier(savageBudgetTarget)
  )
);
assert.equal(getEnemyDifficultyLevel(savageBudgetTarget, false, true), 5);
const savageLayerBudgets = savageProperties.map((targetProperty) => {
  const normalBudget = calculateEnemyBudget({
    targetProperty,
    industryInfluence: noInfluence,
    regionalInfluence: noInfluence,
    isTutorial: false,
  });
  return calculateEnemyBudget({
    targetProperty,
    industryInfluence: noInfluence,
    regionalInfluence: noInfluence,
    isTutorial: false,
    isSavage: true,
  }) / (normalBudget / NORMAL_ENEMY_BUDGET_MULTIPLIER);
});
assert.deepEqual(
  savageLayerBudgets.map((ratio) => Number(ratio.toFixed(3))),
  SAVAGE_LAYER_BUDGET_MULTIPLIERS.map((layerMultiplier) =>
    Number((SAVAGE_ENEMY_BUDGET_MULTIPLIER * layerMultiplier).toFixed(3))
  ),
  'Savage budgets rise clearly from layer 1 through layer 4'
);
assert.equal(getEnemyDifficultyLevel(savageProperties[1], false, true), 5);
assert.equal(getEnemyDifficultyLevel(savageProperties[2], false, true), 6);
assert.equal(getEnemyDifficultyLevel(savageProperties[3], false, true), 6);
const ultimateBudget = calculateEnemyBudget({
  targetProperty: ultimateProperty,
  industryInfluence: noInfluence,
  regionalInfluence: noInfluence,
  isTutorial: false,
  isUltimate: true,
});
const ultimateAsNormalBudget = calculateEnemyBudget({
  targetProperty: ultimateProperty,
  industryInfluence: noInfluence,
  regionalInfluence: noInfluence,
  isTutorial: false,
});
assert.equal(
  ultimateBudget,
  Math.round(
    (ultimateAsNormalBudget / NORMAL_ENEMY_BUDGET_MULTIPLIER) *
      ULTIMATE_ENEMY_BUDGET_MULTIPLIER
  )
);
assert.ok(ultimateBudget > savageBudget);
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
    TACTICAL_SKILL_BALANCE.demoralize.enemyWaitMultiplier
  ) < 0.002,
  'demoralize wait multiplier'
);
const protectedReserve = decideEnemyAction({ ...baseAiContext, enemyReservePercent: 14 });
assert.equal(protectedReserve.intent, 'CONSERVE');
assert.equal(protectedReserve.reserveProtected, true);
const allInCounter = decideEnemyAction({ ...baseAiContext, enemyReservePercent: 14, lastPlayerAction: 'ALL_IN' });
assert.equal(allInCounter.reserveProtected, false);
assert.equal(allInCounter.intent, 'COUNTER_ATTACK');

const livingDeadSkill = INITIAL_SKILLS.find((skill) => skill.id === 'skill_sns_blitz')!;
const fastHorseSkill = INITIAL_SKILLS.find((skill) => skill.id === 'skill_fast_horse')!;
const moraleSupportSkill = INITIAL_SKILLS.find((skill) => skill.id === 'skill_nemawashi')!;
const disruptionSkill = INITIAL_SKILLS.find((skill) => skill.id === 'skill_sabotage')!;
const demoralizeSkill = INITIAL_SKILLS.find((skill) => skill.id === 'skill_demoralize')!;
const capitalBoostSkill = INITIAL_SKILLS.find((skill) => skill.id === 'skill_capital_boost')!;
const synergyPushSkill = INITIAL_SKILLS.find((skill) => skill.id === 'skill_synergy_push')!;
const eraWindSkill = INITIAL_SKILLS.find((skill) => skill.id === 'skill_era_wind')!;
const noAssets = { ownedProperties: [], totalFunds: 50_000, activeSynergyCount: 0 };
assert.equal(isSkillUnlocked({ skill: livingDeadSkill, ...noAssets }), false);
assert.equal(isSkillUnlocked({ skill: fastHorseSkill, ...noAssets }), false);
assert.equal(isSkillUnlocked({ skill: capitalBoostSkill, ...noAssets }), false);
assert.equal(isSkillUnlocked({ skill: synergyPushSkill, ...noAssets }), false);
assert.equal(isSkillUnlocked({ skill: eraWindSkill, ...noAssets }), false);
assert.equal(isSkillUnlocked({ skill: capitalBoostSkill, ...noAssets, totalFunds: 1_000_000 }), true);
assert.equal(isSkillUnlocked({ skill: livingDeadSkill, ...noAssets, totalFunds: 999_999 }), false);
assert.equal(isSkillUnlocked({ skill: livingDeadSkill, ...noAssets, totalFunds: 1_000_000 }), true);
assert.equal(isSkillUnlocked({ skill: synergyPushSkill, ...noAssets, activeSynergyCount: 1 }), true);
assert.equal(isSkillUnlocked({
  skill: fastHorseSkill,
  ...noAssets,
  ownedProperties: [INITIAL_PROPERTIES.find((property) => property.id === 'prop_ranch_1')!],
}), true);
const eraWindRequiredProperties = eraWindSkill.requiredAllPropertyIds!.map(
  (id) => INITIAL_PROPERTIES.find((property) => property.id === id)!
);
assert.equal(isSkillUnlocked({
  skill: eraWindSkill,
  ...noAssets,
  ownedProperties: eraWindRequiredProperties.slice(0, 2),
}), false);
assert.equal(isSkillUnlocked({
  skill: eraWindSkill,
  ...noAssets,
  ownedProperties: eraWindRequiredProperties,
}), true);
assert.equal(capitalBoostSkill.oncePerBattle, true);
assert.deepEqual(
  INITIAL_SKILLS.map((skill) => skill.name),
  ['疾風怒濤の計', '守りのサンバ', '連環計', '消沈', '意気衝天', 'リビングデッド', 'バトルリタニー', '時代の風']
);
assert.equal(fastHorseSkill.cooldownMs, TACTICAL_SKILL_BALANCE.fastAction.cooldownMs);
assert.equal(
  fastHorseSkill.cooldownMs - TACTICAL_SKILL_BALANCE.fastAction.durationMs,
  8_000,
  '疾風怒濤の計 cannot maintain permanent uptime'
);
const fastActionRatio =
  TACTICAL_SKILL_BALANCE.fastAction.boostedCommandProgressPerTick /
  TACTICAL_SKILL_BALANCE.fastAction.baseCommandProgressPerTick;
assert.ok(fastActionRatio > 1.78 && fastActionRatio < 1.79);
assert.equal(TACTICAL_SKILL_BALANCE.moraleSupport.loyaltyRiskDivisor, 2);
assert.match(moraleSupportSkill.description, /半減/);
assert.equal(TACTICAL_SKILL_BALANCE.disruption.interruptChance, 0.7);
assert.equal(TACTICAL_SKILL_BALANCE.disruption.collapseMarketRatio, 0.12);
assert.match(disruptionSkill.description, /中断分は追加防衛枠から消費されない/);
assert.match(demoralizeSkill.description, /1\.6倍/);
assert.equal(TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio, 0.3);
assert.equal(livingDeadSkill.id, 'skill_sns_blitz', 'legacy save-compatible skill id');
assert.equal(livingDeadSkill.effectType, 'LIVING_DEAD');
assert.equal(livingDeadSkill.cooldownMs, 0);
assert.equal(livingDeadSkill.oncePerBattle, true);
assert.equal(TACTICAL_SKILL_BALANCE.livingDead.waitingDurationMs, 10_000);
assert.equal(TACTICAL_SKILL_BALANCE.livingDead.recoveryDurationMs, 10_000);
assert.equal(TACTICAL_SKILL_BALANCE.livingDead.minimumOwnership, 1);
assert.equal(TACTICAL_SKILL_BALANCE.livingDead.recoveryOwnership, 30);
assert.equal(calculateEraWindCost(1_000_000, 0), 100_000);
assert.equal(calculateEraWindCost(100_000_000, 0), 2_000_000);
assert.equal(calculateEraWindCost(100_000_000, 1), 2_000_000);
assert.equal(TACTICAL_SKILL_BALANCE.eraWind.durationMs, 28_000);
assert.equal(TACTICAL_SKILL_BALANCE.eraWind.maxUsesPerBattle, 1);
assert.equal(getEraWindGaugePushPerSecond(0), 1.35);
assert.equal(getEraWindGaugePushPerSecond(2), 1.35);
assert.equal(
  Number(
    (
      getEraWindGaugePushPerSecond(0) *
      (TACTICAL_SKILL_BALANCE.eraWind.durationMs / 1000) /
      2
    ).toFixed(1)
  ),
  18.9,
  'one full Era Wind pushes displayed ownership by about 18.9 points'
);
assert.equal(eraWindSkill.oncePerBattle, true);
assert.match(eraWindSkill.description, /28秒間/);
assert.match(eraWindSkill.description, /1交渉につき1回/);
assert.match(livingDeadSkill.description, /1交渉につき1回/);
assert.equal(calculateOwnershipFromGauge(98), 1);
assert.equal(calculateOwnershipFromGauge(40), 30);
assert.equal(resolveLivingDeadOutcome('waiting', 50, 1), 'none');
assert.equal(resolveLivingDeadOutcome('waiting', 0, 10_000), 'triggered');
assert.equal(resolveLivingDeadOutcome('waiting', 0, 0), 'waiting_expired');
assert.equal(resolveLivingDeadOutcome('recovery', 29.99, 1), 'none');
assert.equal(resolveLivingDeadOutcome('recovery', 30, 1), 'recovered');
assert.equal(resolveLivingDeadOutcome('recovery', 29.99, 0), 'failed');
assert.equal(TACTICAL_SKILL_BALANCE.battleLitany.pushMultiplier, 1.5);

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

const lbSubs = [
  { ...INITIAL_PROPERTIES[0], marketPrice: 1_000 },
  { ...INITIAL_PROPERTIES[1], marketPrice: 2_000 },
  { ...INITIAL_PROPERTIES[2], marketPrice: 3_000 },
];
const lbTier = getLimitBreakTier(lbSubs.length + 1);
assert.equal(lbTier, 1);
assert.equal(calculateLimitBreakAmount(1_000, lbSubs, lbTier), 3_058);
assert.equal(BATTLE_GAUGE_SPEED_FACTOR, 4);
assert.equal(TRAINING_GAUGE_SPEED_MULTIPLIER, 0.1);
assert.equal(TRAINING_MIN_OWNERSHIP_PERCENT, 1);
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
assert.deepEqual(LIMIT_BREAK_MULTIPLIERS, { 1: 1.56, 2: 1.98, 3: 2.46 });
assert.deepEqual(LIMIT_BREAK_OWNERSHIP_CAPS, { 1: 10, 2: 20, 3: 30 });
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
assert.equal(calculateLimitBreakOwnershipPush(2_822, 1_000, 1, 1), 10);
assert.equal(calculateLimitBreakOwnershipPush(20_000, 1_000, 2, 1.15), 20);
assert.equal(calculateLimitBreakOwnershipPush(50_000, 1_000, 3, 1.15), 30);
assert.equal(calculateLimitBreakOwnershipPush(50_000, 1_000, 0, 1.15), 0);
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
        }
      : property
);
assert.ok(
  !getCurrentlyControlledCommunityIds(rebelledFirstCityProperties).includes(
    firstCampaignCommunity
  ),
  'rebellion removes current regional control'
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
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => key === SAVE_STORAGE_KEY ? savedPayload : null,
      setItem: (key: string, value: string) => {
        if (key === SAVE_STORAGE_KEY) savedPayload = value;
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
saveGame({
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
});
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
  savageClearedPropertyIds: normalCampaignIds,
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
  savageProgressVersion: 2,
  normalEndingSeen: true,
  savageEndingSeen: true,
  ultimateCleared: true,
  trueEndingSeen: true,
  selectedBattleSynergyId: 'KUGANE_TRADE_GATEWAY',
});
const restoredUltimateSave = loadGameSave();
assert.equal(restoredUltimateSave?.ultimateCleared, true);
assert.equal(restoredUltimateSave?.trueEndingSeen, true);
assert.equal(restoredUltimateSave?.selectedBattleSynergyId, 'KUGANE_TRADE_GATEWAY');
Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });

const preFinalTargets = COMMUNITY_CAMPAIGN_ORDER.slice(0, 9).flatMap((community) =>
  getCampaignProperties(INITIAL_PROPERTIES, community)
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

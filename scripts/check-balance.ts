import assert from 'node:assert/strict';
import { INITIAL_CARTELS, INITIAL_PROPERTIES, INITIAL_SKILLS } from '../src/data/initialData';
import { ALLIANCE_CANDIDATES, GRAND_COMPANY_NAMES } from '../src/data/allianceData';
import { COMMUNITY_CAMPAIGN_ORDER } from '../src/data/worldData';
import { decideEnemyAction, type EnemyDecisionContext } from '../src/utils/enemyAi';
import { normalizeAllianceState, normalizeLimitBreakCharge } from '../src/utils/saveData';
import {
  calculateAllianceSupport,
  shouldBreakAllianceForTarget,
} from '../src/utils/alliance';
import {
  BATTLE_GAUGE_SPEED_FACTOR,
  ENEMY_INITIAL_COMMITMENT_RATIO,
  PASSIVE_REVENUE_MULTIPLIER,
  TACTICAL_SKILL_BALANCE,
  calculateEnemyBudget,
  calculateLimitBreakAmount,
  calculateLimitBreakChargeGain,
  calculateOwnershipFromGauge,
  calculateLimitBreakOwnershipAfterDefense,
  calculateLimitBreakOwnershipPush,
  countsTowardCityConquest,
  getCampaignProperties,
  getChargedLimitBreakTier,
  getLimitBreakChargeCapacity,
  getLimitBreakTier,
  isSkillUnlocked,
  LIMIT_BREAK_CHARGE_GAIN_MULTIPLIER,
  LIMIT_BREAK_MULTIPLIERS,
  resolveLivingDeadOutcome,
} from '../src/utils/gameBalance';

const noInfluence = { enemyBudgetDiscount: 0 };
const expectedCampaignCounts = [3, 2, 3, 4, 2, 1, 1, 1, 1, 2];
const expectedStageMaxPrices = [
  15_000,
  60_000,
  800_000,
  700_000,
  1_400_000,
  2_000_000,
  3_000_000,
  4_500_000,
  6_500_000,
  450_000_000,
];

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
assert.equal(getLimitBreakTier(4), 1, 'public patronage never changes participating company count');

const enemyBudgetRatio = (propertyId: string, isTutorial = false) => {
  const property = INITIAL_PROPERTIES.find((candidate) => candidate.id === propertyId)!;
  return calculateEnemyBudget({
    targetProperty: property,
    industryInfluence: noInfluence,
    regionalInfluence: noInfluence,
    isTutorial,
  }) / property.marketPrice;
};
assert.ok(Math.abs(enemyBudgetRatio('prop_starter_farm', true) - 0.5832) < 0.001);
assert.ok(Math.abs(enemyBudgetRatio('prop_casino_grand') - 1.1696) < 0.001);
assert.ok(Math.abs(enemyBudgetRatio('prop_coffee_aurora') - 1.271) < 0.001);
assert.ok(Math.abs(enemyBudgetRatio('prop_abyss_heavy') - 1.6275) < 0.001);
assert.ok(Math.abs(enemyBudgetRatio('prop_abyss_hq') - 2.3625) < 0.001);

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
const noAssets = { ownedProperties: [], totalFunds: 50_000, activeSynergyCount: 0 };
assert.equal(isSkillUnlocked({ skill: livingDeadSkill, ...noAssets }), false);
assert.equal(isSkillUnlocked({ skill: fastHorseSkill, ...noAssets }), false);
assert.equal(isSkillUnlocked({ skill: capitalBoostSkill, ...noAssets }), false);
assert.equal(isSkillUnlocked({ skill: synergyPushSkill, ...noAssets }), false);
assert.equal(isSkillUnlocked({ skill: capitalBoostSkill, ...noAssets, totalFunds: 1_000_000 }), true);
assert.equal(isSkillUnlocked({ skill: livingDeadSkill, ...noAssets, totalFunds: 999_999 }), false);
assert.equal(isSkillUnlocked({ skill: livingDeadSkill, ...noAssets, totalFunds: 1_000_000 }), true);
assert.equal(isSkillUnlocked({ skill: synergyPushSkill, ...noAssets, activeSynergyCount: 1 }), true);
assert.equal(isSkillUnlocked({
  skill: fastHorseSkill,
  ...noAssets,
  ownedProperties: [INITIAL_PROPERTIES.find((property) => property.id === 'prop_ranch_1')!],
}), true);
assert.equal(capitalBoostSkill.oncePerBattle, true);
assert.deepEqual(
  INITIAL_SKILLS.map((skill) => skill.name),
  ['神速魔', '士気高揚の策', '連環計', '消沈', '意気衝天', 'リビングデッド', 'バトルリタニー']
);
assert.equal(fastHorseSkill.cooldownMs, TACTICAL_SKILL_BALANCE.fastAction.cooldownMs);
assert.equal(
  fastHorseSkill.cooldownMs - TACTICAL_SKILL_BALANCE.fastAction.durationMs,
  8_000,
  '神速魔 cannot maintain permanent uptime'
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

const lbSubs = [
  { ...INITIAL_PROPERTIES[0], marketPrice: 1_000 },
  { ...INITIAL_PROPERTIES[1], marketPrice: 2_000 },
  { ...INITIAL_PROPERTIES[2], marketPrice: 3_000 },
];
const lbTier = getLimitBreakTier(lbSubs.length + 1);
assert.equal(lbTier, 1);
assert.equal(calculateLimitBreakAmount(1_000, lbSubs, lbTier), 2_822);
assert.equal(BATTLE_GAUGE_SPEED_FACTOR, 4);
assert.equal(LIMIT_BREAK_CHARGE_GAIN_MULTIPLIER, 1.2);
assert.deepEqual(LIMIT_BREAK_MULTIPLIERS, { 1: 1.44, 2: 1.8, 3: 2.22 });
assert.equal(ENEMY_INITIAL_COMMITMENT_RATIO, 0.25);
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
assert.equal(normalizeLimitBreakCharge(undefined), 0);
assert.equal(normalizeLimitBreakCharge(Number.NaN), 0);
assert.equal(normalizeLimitBreakCharge(-20), 0);
assert.equal(normalizeLimitBreakCharge(175), 175);
assert.equal(normalizeLimitBreakCharge(999), 300);

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
  enemyBudgetRatios: {
    tutorial: enemyBudgetRatio('prop_starter_farm', true),
    goldSaucer: enemyBudgetRatio('prop_casino_grand'),
    lateNormal: enemyBudgetRatio('prop_coffee_aurora'),
    cartelMember: enemyBudgetRatio('prop_abyss_heavy'),
    cartelHq: enemyBudgetRatio('prop_abyss_hq'),
  },
}, null, 2));

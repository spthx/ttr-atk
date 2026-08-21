import assert from 'node:assert/strict';
import {
  buildMobilizationPointBreakdown,
  calculateBattleReadiness,
  type BattleReadinessInput,
} from '../src/utils/battleReadiness';
import {
  INITIAL_GROUP_SYNERGIES,
  INITIAL_PROPERTIES,
} from '../src/data/initialData';
import {
  BATTLE_SUPPORT_BALANCE,
  HIGH_DIFFICULTY_SUPPORT_MULTIPLIER,
  SAVAGE_NETWORK_SUPPORT_LIMIT,
  getRepeatedNetworkSupportMultiplier,
  getSubsidiarySupportMultiplier,
} from '../src/utils/gameBalance';
import {
  KARMA_LEDGER_THRESHOLDS,
  createKarmaBattleState,
  getKarmaCounterEffectiveness,
  getKarmaCounterPlan,
  recordKarmaAction,
  resolveNextKarmaCounter,
  shouldHoldKarmaVictory,
} from '../src/utils/karmaBattle';

const baseInput: BattleReadinessInput = {
  targetMarketPrice: 100_000,
  availableCash: 500_000,
  subsidiaries: [],
  selectedBattleSynergy: null,
  limitBreakCharge: 0,
  allianceSupport: 50_000,
  hasCapitalBoost: false,
  enemyBudget: 100_000,
  enemyDifficultyLevel: 5,
  enemyBaseReactionSeconds: 2,
  playerPushBonus: 0,
};

const capitalOnly = calculateBattleReadiness(baseInput);
assert.equal(capitalOnly.grade, 'advantage');
assert.equal(capitalOnly.mechanicCheckRequired, false);
assert.equal(
  capitalOnly.capitalComponents.find((component) => component.key === 'alliance')
    ?.label,
  '外部アライアンス1回（高難度補正なし）'
);
const capitalOnlyPoints = buildMobilizationPointBreakdown(
  capitalOnly.capitalComponents,
  capitalOnly.enemyBudget
);
assert.deepEqual(
  capitalOnlyPoints.map(({ key, label, points }) => ({ key, label, points })),
  [
    { key: 'cash', label: '手元資金', points: 100 },
    { key: 'alliance', label: '外部協力', points: 50 },
  ],
  'the simple UI must show cash plus external cooperation against defense 100'
);
assert.equal(
  capitalOnlyPoints.reduce((total, component) => total + component.points, 0),
  Math.round((capitalOnly.playerExpectedCapital / capitalOnly.enemyBudget) * 100)
);

const roundingSource = [
  { key: 'cash' as const, label: 'cash detail', amount: 333 },
  { key: 'alliance' as const, label: 'alliance detail', amount: 333 },
  { key: 'battle_synergy' as const, label: 'synergy detail', amount: 334 },
];
const roundingSnapshot = structuredClone(roundingSource);
assert.deepEqual(
  buildMobilizationPointBreakdown(roundingSource, 1_000).map(
    ({ key, label, points }) => ({ key, label, points })
  ),
  [
    { key: 'cash', label: '手元資金', points: 33 },
    { key: 'alliance', label: '外部協力', points: 33 },
    { key: 'battle_synergy', label: 'SYNERGY', points: 34 },
  ],
  'largest-remainder rounding must keep the displayed equation equal to 100'
);
assert.deepEqual(roundingSource, roundingSnapshot, 'point conversion is non-mutating');

const warning = calculateBattleReadiness({
  ...baseInput,
  mechanicWarning: '開幕に防御役が割り込みます。',
  mechanicSeverity: 'warning',
});
assert.equal(warning.grade, 'even');
assert.equal(warning.label, '接戦');
assert.equal(warning.mechanicGradeCapped, true);
assert.equal(warning.mechanicWarning, '開幕に防御役が割り込みます。');

const severe = calculateBattleReadiness({
  ...baseInput,
  mechanicWarning: '決着を覆す開幕・瀕死ギミックがあります。',
  mechanicSeverity: 'severe',
});
assert.equal(severe.grade, 'challenge');
assert.equal(severe.label, '要工夫');
assert.equal(severe.mechanicGradeCapped, true);

const ultimate = calculateBattleReadiness({
  ...baseInput,
  battleMode: 'ultimate',
});
assert.equal(ultimate.grade, 'challenge');
assert.equal(ultimate.mechanicSeverity, 'severe');
assert.match(
  ultimate.mechanicWarning ?? '',
  /絶.*短時間防御.*開始直後に空撃ちせず.*ドリルや敵LB3.*危険予告/,
  'Ultimate readiness must teach where short defenses belong before entry'
);

const savage = calculateBattleReadiness({
  ...baseInput,
  battleMode: 'savage',
});
assert.equal(savage.grade, 'even');
assert.equal(savage.mechanicSeverity, 'warning');

const phantom = calculateBattleReadiness({
  ...baseInput,
  battleMode: 'phantom',
});
assert.equal(phantom.grade, 'challenge');
assert.equal(phantom.mechanicSeverity, 'severe');
assert.match(phantom.mechanicWarning ?? '', /幻.*零式層/);
assert.match(phantom.mechanicWarning ?? '', /基礎資金力と判断速度.*絶相当/);
assert.match(phantom.mechanicWarning ?? '', /予告と対策を誤ると敗北/);

const karma = calculateBattleReadiness({
  ...baseInput,
  battleMode: 'karma',
});
assert.equal(karma.grade, 'challenge');
assert.equal(karma.mechanicSeverity, 'severe');
assert.match(karma.mechanicWarning ?? '', /55／70／85／95%/);
assert.match(karma.mechanicWarning ?? '', /1件だけ/);
assert.match(karma.mechanicWarning ?? '', /計4回/);

assert.deepEqual(
  KARMA_LEDGER_THRESHOLDS,
  [55, 70, 85, 95],
  'Karma must record four actual ownership advances after the fifty-percent opening line.'
);
let karmaState = createKarmaBattleState();
let copiedPlan: ReturnType<typeof getKarmaCounterPlan> | null = null;
for (const [index, [serial, kind, ownershipAfter]] of (
  [
    [1, 'direct', 60],
    [2, 'network', 75],
    [3, 'synergy', 90],
    [4, 'limit_break', 99],
  ] as const
).entries()) {
  karmaState = recordKarmaAction(karmaState, {
    serial,
    kind,
    strengthBand: 'medium',
    ownershipAfter,
  });
  assert.equal(karmaState.phase, 'countering');
  assert.deepEqual(
    karmaState.entries.map((entry) => [entry.page, entry.threshold, entry.kind]),
    [[index + 1, KARMA_LEDGER_THRESHOLDS[index], kind]],
    'Karma must remember only the one action that crossed the current checkpoint.'
  );
  assert.equal(karmaState.counterQueue.length, 1);
  assert.equal(
    shouldHoldKarmaVictory(true, karmaState),
    true,
    'Karma must hold a nominal victory while the current imitation remains unresolved.'
  );

  const ignoredWhileRemembering = recordKarmaAction(karmaState, {
    serial: serial + 100,
    kind: 'alliance',
    strengthBand: 'small',
    ownershipAfter: 99,
  });
  assert.strictEqual(
    ignoredWhileRemembering,
    karmaState,
    'Karma cannot remember a second action while one imitation is active.'
  );

  copiedPlan ??= getKarmaCounterPlan(karmaState.counterQueue[0]!);
  karmaState = resolveNextKarmaCounter(
    karmaState,
    karmaState.counterQueue[0]!.serial
  );
  assert.deepEqual(karmaState.entries, []);
  assert.deepEqual(karmaState.counterQueue, []);
  assert.equal(
    karmaState.phase,
    index === KARMA_LEDGER_THRESHOLDS.length - 1 ? 'resolved' : 'recording',
    'each imitation must be forgotten before the next checkpoint is armed.'
  );
}
assert.deepEqual(
  karmaState.resolvedCounterSerials,
  [1, 2, 3, 4],
  'Karma must resolve four separate one-action checks in checkpoint order.'
);
assert.equal(
  shouldHoldKarmaVictory(true, karmaState),
  false,
  'Karma releases a nominal victory after the fourth separate imitation.'
);
assert.ok(copiedPlan);
assert.equal(copiedPlan.instantDefeat, false);
assert.ok(copiedPlan.ownershipPush > 0 && copiedPlan.ownershipPush < 25);
assert.equal(
  copiedPlan.telegraphMs,
  6_000,
  'every Karma copy must present a six-second counter window.'
);
assert.equal(copiedPlan.perfectCounterKinds.length, 2);
assert.equal(
  getKarmaCounterEffectiveness(copiedPlan, copiedPlan.perfectCounterKinds[0]),
  0,
  'the authored perfect answer must cancel the copied action.'
);
const improvisedKarmaKind = (
  [
    'direct',
    'network',
    'synergy',
    'alliance',
    'limit_break',
    'ability',
  ] as const
).find(
  (kind) =>
    kind !== copiedPlan.entry.kind &&
    !copiedPlan.perfectCounterKinds.includes(kind)
)!;
assert.equal(
  getKarmaCounterEffectiveness(copiedPlan, improvisedKarmaKind),
  0.5,
  'an unlisted different action family must reduce the copied action to fifty percent.'
);
assert.equal(
  getKarmaCounterEffectiveness(copiedPlan, copiedPlan.entry.kind),
  1,
  'repeating the copied action family must take the full finite hit.'
);

const weakCapital = calculateBattleReadiness({
  ...baseInput,
  availableCash: 1_000,
  mechanicSeverity: 'severe',
});
assert.equal(weakCapital.grade, 'danger');
assert.equal(weakCapital.mechanicGradeCapped, false);

const contact = {
  ...INITIAL_PROPERTIES[0],
  marketPrice: 100_000,
  loyaltyRisk: 0,
};
const contactReadiness = calculateBattleReadiness({
  ...baseInput,
  availableCash: 30_000,
  subsidiaries: [contact],
});
assert.equal(contactReadiness.supportRoute, '人脈一巡');
assert.ok(
  contactReadiness.capitalComponents.some((component) =>
    component.label.includes('人脈1件')
  )
);

const rotatingContacts = Array.from({ length: 3 }, (_, index) => ({
  ...contact,
  id: `rotating_contact_${index}`,
}));
const rotatingContactReadiness = calculateBattleReadiness({
  ...baseInput,
  availableCash: 2_000,
  allianceSupport: 0,
  subsidiaries: rotatingContacts,
});
assert.equal(
  rotatingContactReadiness.capitalComponents.find(
    (component) => component.key === 'subsidiaries'
  )?.amount,
  [0, 1, 2].reduce(
    (total, requestIndex) =>
      total + Math.round(75_000 * getRepeatedNetworkSupportMultiplier(requestIndex)),
    0
  ),
  'switching companies must not bypass the battle-wide ten-percent network decay'
);

const highDifficultyContactReadiness = calculateBattleReadiness({
  ...baseInput,
  availableCash: 2_000,
  subsidiaries: [contact],
  allianceSupport: 0,
  battleMode: 'savage',
});
assert.equal(
  highDifficultyContactReadiness.supportCapital,
  Array.from({ length: SAVAGE_NETWORK_SUPPORT_LIMIT }, (_, requestIndex) =>
    Math.round(
      75_000 *
        getRepeatedNetworkSupportMultiplier(requestIndex) *
        HIGH_DIFFICULTY_SUPPORT_MULTIPLIER
    )
  ).reduce((total, amount) => total + amount, 0),
  'Savage readiness must model the live strongest-contact one-tap limit'
);
assert.match(
  highDifficultyContactReadiness.capitalComponents.find(
    (component) => component.key === 'subsidiaries'
  )?.label ?? '',
  /最有力先.*最大18回.*高難度×0\.50/
);

const regularGroupSynergy = INITIAL_GROUP_SYNERGIES.find(
  (synergy) => synergy.id === 'GRIDANIA_FOREST_ECONOMY'
)!;
const regularGroupMembers = regularGroupSynergy.requiredPropertyIds.map(
  (propertyId) =>
    INITIAL_PROPERTIES.find((property) => property.id === propertyId)!
);
const normalGroupReadiness = calculateBattleReadiness({
  ...baseInput,
  availableCash: 2_000,
  subsidiaries: regularGroupMembers,
  selectedBattleSynergy: regularGroupSynergy,
  allianceSupport: 0,
  battleMode: 'normal',
});
const highDifficultyGroupReadiness = calculateBattleReadiness({
  ...baseInput,
  availableCash: 2_000,
  subsidiaries: regularGroupMembers,
  selectedBattleSynergy: regularGroupSynergy,
  allianceSupport: 0,
  battleMode: 'ultimate',
  networkSupportLimit: 0,
});
assert.equal(normalGroupReadiness.supportRoute, '戦闘連携');
assert.equal(highDifficultyGroupReadiness.supportRoute, '戦闘連携');
const highDifficultyGroupBaseSupport = regularGroupMembers.reduce(
  (total, member) =>
    total +
    Math.round(
      member.marketPrice *
        BATTLE_SUPPORT_BALANCE.synergyMemberMarketRatio *
        getSubsidiarySupportMultiplier(member) *
        HIGH_DIFFICULTY_SUPPORT_MULTIPLIER
    ),
  0
);
assert.equal(
  highDifficultyGroupReadiness.supportCapital,
  Math.round(
    highDifficultyGroupBaseSupport *
      (regularGroupSynergy.battleGroupMultiplier ??
        BATTLE_SUPPORT_BALANCE.synergyDefaultMultiplier)
  )
);
assert.match(
  highDifficultyGroupReadiness.capitalComponents.find(
    (component) => component.key === 'subsidiaries'
  )?.label ?? '',
  /高難度×0\.50/
);
assert.equal(
  highDifficultyGroupReadiness.capitalComponents.find(
    (component) => component.key === 'subsidiaries'
  )?.amount,
  highDifficultyGroupBaseSupport,
  'regular SYNERGY shows the participating network capital as its own addend'
);
assert.match(
  highDifficultyGroupReadiness.capitalComponents.find(
    (component) => component.key === 'synergy'
  )?.label ?? '',
  /SYNERGY.*上乗せ/
);
assert.equal(
  highDifficultyGroupReadiness.capitalComponents
    .filter(
      (component) =>
        component.key === 'subsidiaries' || component.key === 'synergy'
    )
    .reduce((total, component) => total + component.amount, 0),
  highDifficultyGroupReadiness.supportCapital,
  'network capital plus the SYNERGY bonus must equal the unchanged route total'
);
assert.equal(
  highDifficultyGroupReadiness.capitalComponents.reduce(
    (total, component) => total + component.amount,
    0
  ),
  highDifficultyGroupReadiness.playerExpectedCapital,
  'the decomposed SYNERGY route must preserve total expected capital'
);
assert.equal(
  buildMobilizationPointBreakdown(
    highDifficultyGroupReadiness.capitalComponents,
    highDifficultyGroupReadiness.enemyBudget
  ).reduce((total, component) => total + component.points, 0),
  highDifficultyGroupReadiness.ratioPercent,
  'the decomposed SYNERGY point equation must preserve the displayed total'
);

const lowValueContacts = Array.from({ length: 3 }, (_, index) => ({
  ...contact,
  id: `lb_contact_${index}`,
  marketPrice: 1,
}));
const normalLimitReadiness = calculateBattleReadiness({
  ...baseInput,
  availableCash: 2_000,
  subsidiaries: lowValueContacts,
  limitBreakCharge: 100,
  allianceSupport: 0,
  battleMode: 'normal',
});
const highDifficultyLimitReadiness = calculateBattleReadiness({
  ...baseInput,
  availableCash: 2_000,
  subsidiaries: lowValueContacts,
  limitBreakCharge: 100,
  allianceSupport: 0,
  battleMode: 'cruel',
});
assert.equal(normalLimitReadiness.supportRoute, 'LIMIT BREAK');
assert.equal(highDifficultyLimitReadiness.supportRoute, 'LIMIT BREAK');
assert.equal(
  highDifficultyLimitReadiness.supportCapital,
  normalLimitReadiness.supportCapital,
  'the high-difficulty support multiplier must not increase LIMIT BREAK'
);
const visibleLimitContacts = Array.from({ length: 3 }, (_, index) => ({
  ...contact,
  id: `visible_lb_contact_${index}`,
  marketPrice: 100_000,
}));
const visibleLimitReadiness = calculateBattleReadiness({
  ...baseInput,
  targetMarketPrice: 1_000_000,
  availableCash: 2_000,
  subsidiaries: visibleLimitContacts,
  selectedBattleSynergy: null,
  limitBreakCharge: 100,
  allianceSupport: 0,
  enemyBudget: 1_000_000,
});
assert.equal(visibleLimitReadiness.supportRoute, 'LIMIT BREAK');
const visibleLimitComponents = visibleLimitReadiness.capitalComponents.filter(
  (component) =>
    component.key === 'subsidiaries' || component.key === 'limit_break'
);
assert.deepEqual(
  visibleLimitComponents.map((component) => component.key),
  ['subsidiaries', 'limit_break'],
  'LIMIT BREAK displays the participating network and technique bonus separately'
);
assert.equal(
  visibleLimitComponents.reduce((total, component) => total + component.amount, 0),
  visibleLimitReadiness.supportCapital,
  'network capital plus the LIMIT BREAK bonus must equal the unchanged route total'
);
assert.equal(
  visibleLimitReadiness.capitalComponents.reduce(
    (total, component) => total + component.amount,
    0
  ),
  visibleLimitReadiness.playerExpectedCapital,
  'the decomposed LIMIT BREAK route must preserve total expected capital'
);
assert.equal(
  buildMobilizationPointBreakdown(
    visibleLimitReadiness.capitalComponents,
    visibleLimitReadiness.enemyBudget
  ).reduce((total, component) => total + component.points, 0),
  visibleLimitReadiness.ratioPercent,
  'the decomposed LIMIT BREAK point equation must preserve the displayed total'
);
const visibleLimitNetworkBase = visibleLimitContacts.reduce(
  (total, member) =>
    total +
    Math.round(
      member.marketPrice *
        0.28 *
        getSubsidiarySupportMultiplier(member)
    ),
  0
);
assert.equal(
  visibleLimitComponents[0].amount,
  visibleLimitNetworkBase,
  'the network addend stays unamplified so the LIMIT BREAK addend owns the technique bonus'
);
assert.match(visibleLimitComponents[0].label, /人脈3件.*LB参加企業/);
assert.match(visibleLimitComponents[1].label, /LB.*上乗せ.*蓄積分を全消費/);
assert.match(highDifficultyLimitReadiness.mechanicWarning ?? '', /15秒/);
assert.match(highDifficultyLimitReadiness.mechanicWarning ?? '', /10秒以内/);
assert.match(highDifficultyLimitReadiness.mechanicWarning ?? '', /未到達でも/);
assert.match(highDifficultyLimitReadiness.mechanicWarning ?? '', /直接出資2回分/);
assert.match(highDifficultyLimitReadiness.mechanicWarning ?? '', /所有率75%以上/);
assert.match(highDifficultyLimitReadiness.mechanicWarning ?? '', /自社直接出資/);
assert.match(highDifficultyLimitReadiness.mechanicWarning ?? '', /人脈・LB・SYNERGY・外部アライアンス/);

console.log('readiness mechanic checks passed');

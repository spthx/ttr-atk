import assert from 'node:assert/strict';
import {
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
  getRepeatedNetworkSupportMultiplier,
  getSubsidiarySupportMultiplier,
} from '../src/utils/gameBalance';

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
assert.match(ultimate.mechanicWarning ?? '', /絶/);

const savage = calculateBattleReadiness({
  ...baseInput,
  battleMode: 'savage',
});
assert.equal(savage.grade, 'even');
assert.equal(savage.mechanicSeverity, 'warning');

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
const normalContactReadiness = calculateBattleReadiness({
  ...baseInput,
  availableCash: 2_000,
  subsidiaries: [contact],
  allianceSupport: 0,
  battleMode: 'normal',
});
assert.equal(
  highDifficultyContactReadiness.supportCapital,
  Math.round(
    normalContactReadiness.supportCapital *
      HIGH_DIFFICULTY_SUPPORT_MULTIPLIER
  )
);
assert.match(
  highDifficultyContactReadiness.capitalComponents.find(
    (component) => component.key === 'subsidiaries'
  )?.label ?? '',
  /高難度×1\.70/
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
});
assert.equal(normalGroupReadiness.supportRoute, '戦闘連携');
assert.equal(highDifficultyGroupReadiness.supportRoute, '戦闘連携');
assert.equal(
  highDifficultyGroupReadiness.supportCapital,
  Math.round(
    regularGroupMembers.reduce(
      (total, member) =>
        total +
        Math.round(
          member.marketPrice *
            BATTLE_SUPPORT_BALANCE.synergyMemberMarketRatio *
            getSubsidiarySupportMultiplier(member) *
            HIGH_DIFFICULTY_SUPPORT_MULTIPLIER
        ),
      0
    ) *
      (regularGroupSynergy.battleGroupMultiplier ??
        BATTLE_SUPPORT_BALANCE.synergyDefaultMultiplier)
  )
);
assert.match(
  highDifficultyGroupReadiness.capitalComponents.find(
    (component) => component.key === 'synergy'
  )?.label ?? '',
  /高難度×1\.70/
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

console.log('readiness mechanic checks passed');

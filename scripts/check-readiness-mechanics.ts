import assert from 'node:assert/strict';
import {
  calculateBattleReadiness,
  type BattleReadinessInput,
} from '../src/utils/battleReadiness';
import { INITIAL_PROPERTIES } from '../src/data/initialData';

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
  mechanicWarning: '決着を覆す開幕・土壇場ギミックがあります。',
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

console.log('readiness mechanic checks passed');

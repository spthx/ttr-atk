import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMUNITY_CAMPAIGN_ORDER } from '../src/data/worldData';
import {
  getBattleResultCta,
  getNormalBattleNavigation,
  getTrainingReturnLevel,
} from '../src/utils/progressionNavigation';
import { isCartelFullyPrepared } from '../src/utils/cartel';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appSource = readFileSync(resolve(repositoryRoot, 'src/App.tsx'), 'utf8');
const abilityViewSource = readFileSync(
  resolve(repositoryRoot, 'src/components/SkillsSynergyView.tsx'),
  'utf8'
);

const firstCommunity = COMMUNITY_CAMPAIGN_ORDER[0];
const secondCommunity = COMMUNITY_CAMPAIGN_ORDER[1];
const finalCommunity = COMMUNITY_CAMPAIGN_ORDER.at(-1);

assert.ok(firstCommunity && secondCommunity && finalCommunity);

assert.deepEqual(
  getNormalBattleNavigation({
    winner: 'player',
    targetCommunity: firstCommunity,
    newlyConquered: false,
  }),
  {
    community: firstCommunity,
    mode: 'targets',
    unlockedCommunity: null,
  },
  'A victory inside a city must continue in that city target list.'
);

assert.deepEqual(
  getNormalBattleNavigation({
    winner: 'player',
    targetCommunity: firstCommunity,
    newlyConquered: true,
  }),
  {
    community: secondCommunity,
    mode: 'targets',
    unlockedCommunity: secondCommunity,
  },
  'A newly conquered city must introduce and then open the next city targets.'
);

assert.deepEqual(
  getNormalBattleNavigation({
    winner: 'opponent',
    targetCommunity: secondCommunity,
    newlyConquered: false,
  }),
  {
    community: secondCommunity,
    mode: 'targets',
    unlockedCommunity: null,
  },
  'A defeat must return to the same city instead of the wide-area map.'
);

assert.deepEqual(
  getNormalBattleNavigation({
    winner: 'player',
    targetCommunity: finalCommunity,
    newlyConquered: true,
  }),
  {
    community: finalCommunity,
    mode: 'targets',
    unlockedCommunity: null,
  },
  'The final city must not fabricate another route unlock.'
);

assert.deepEqual(
  getBattleResultCta({
    battleMode: 'normal',
    winner: 'player',
  }),
  {
    destination: 'next-case',
    intent: 'continue',
    label: '買収結果を確定して次の案件へ',
    departureLabel: '離脱報告を確認して次の案件へ',
  },
  'A normal in-city victory must describe the next case, not the world map.'
);

assert.deepEqual(
  getBattleResultCta({
    battleMode: 'normal',
    winner: 'player',
    hasNextCommunity: true,
    isCityBoss: true,
    isReacquisition: true,
    returnToAlliance: true,
  }),
  {
    destination: 'alliance-list',
    intent: 'continue',
    label: '交渉結果を確定してアライアンスへ',
    departureLabel: '離脱報告を確認してアライアンスへ',
  },
  'An Alliance-origin victory must return to Alliance even when the target also belongs to story progression.'
);

assert.deepEqual(
  getBattleResultCta({
    battleMode: 'normal',
    winner: 'opponent',
    returnToAlliance: true,
  }),
  {
    destination: 'alliance-list',
    intent: 'retry',
    label: '敗因を記録してアライアンスへ',
    departureLabel: '離脱報告を確認してアライアンスへ',
  },
  'An Alliance-origin defeat must return to the same Alliance target list.'
);

assert.equal(
  getBattleResultCta({
    battleMode: 'normal',
    winner: 'player',
    hasNextCommunity: true,
    isCityBoss: true,
  }).destination,
  'next-community',
  'A conquered non-final city must continue to the newly unlocked city.'
);

assert.equal(
  getBattleResultCta({
    battleMode: 'normal',
    winner: 'player',
    isCityBoss: true,
  }).label,
  '買収結果を確定してエンディングへ',
  'The final city boss must announce the ending rather than a fabricated map return.'
);

assert.deepEqual(
  getBattleResultCta({
    battleMode: 'normal',
    winner: 'player',
    hasNextCommunity: true,
    isCityBoss: true,
    isReacquisition: true,
  }),
  {
    destination: 'same-community',
    intent: 'continue',
    label: '再買収結果を確定して保有案件へ',
    departureLabel: '離脱報告を確認して保有案件へ',
  },
  'Reacquisition must never replay a next-city route even for a former city boss.'
);

assert.equal(
  getBattleResultCta({
    battleMode: 'savage',
    winner: 'opponent',
  }).label,
  '敗因を記録して高難度一覧へ',
  'A high-end wipe must identify the high-end list as its actual destination.'
);

assert.equal(
  getBattleResultCta({
    battleMode: 'training',
    winner: 'player',
  }).destination,
  'training-list',
  'Training keeps its isolated return destination.'
);

assert.equal(
  getBattleResultCta({
    battleMode: 'normal',
    winner: 'opponent',
  }).intent,
  'retry',
  'A normal defeat returns to the same community case list for a retry.'
);

assert.equal(
  getTrainingReturnLevel({
    propertyId: 'training_dummy_level_1',
    winner: 'player',
    conqueredCommunityCount: 0,
  }),
  1,
  'Training must not focus a locked next level.'
);

assert.equal(
  getTrainingReturnLevel({
    propertyId: 'training_dummy_level_1',
    winner: 'player',
    conqueredCommunityCount: 1,
  }),
  2,
  'Training victory should focus the next unlocked level.'
);

assert.equal(
  getTrainingReturnLevel({
    propertyId: 'training_dummy_level_3',
    winner: 'opponent',
    conqueredCommunityCount: 10,
  }),
  3,
  'Training defeat should focus the same level for a retry.'
);

assert.equal(
  getTrainingReturnLevel({
    propertyId: 'training_dummy_level_5',
    winner: 'player',
    conqueredCommunityCount: 10,
  }),
  5,
  'The final training level should remain available for a retry.'
);

const cartelPreparationFixture = {
  hqPropertyId: 'cartel-hq',
  subsidiaryIds: ['cartel-member-a', 'cartel-member-b'],
};

assert.equal(
  isCartelFullyPrepared(
    cartelPreparationFixture,
    new Set(['cartel-hq'])
  ),
  false,
  'Owning only a cartel headquarters must not satisfy Savage preparation.'
);

assert.equal(
  isCartelFullyPrepared(
    cartelPreparationFixture,
    new Set(['cartel-member-a', 'cartel-member-b'])
  ),
  false,
  'Owning only every participating company must not satisfy Savage preparation.'
);

assert.equal(
  isCartelFullyPrepared(
    cartelPreparationFixture,
    new Set(['cartel-hq', 'cartel-member-a', 'cartel-member-b'])
  ),
  true,
  'One complete cartel—headquarters plus all participating companies—must satisfy Savage preparation.'
);

assert.equal(
  [
    cartelPreparationFixture,
    { hqPropertyId: 'other-hq', subsidiaryIds: ['other-member'] },
  ].some((cartel) =>
    isCartelFullyPrepared(
      cartel,
      new Set(['cartel-hq', 'cartel-member-a', 'cartel-member-b'])
    )
  ),
  true,
  'Completing one cartel must be sufficient; preparation must not require every cartel.'
);

assert.match(
  appSource,
  /const returnFromAbilitySetup[\s\S]*destination === 'savage'[\s\S]*setActiveTab\('savage'\)[\s\S]*destination === 'cartels'[\s\S]*setActiveTab\('cartels'\)[\s\S]*mode: 'targets'[\s\S]*community: skillsStoryReturn\.community/,
  'Ability setup must return to Alliance, the Savage list, or the exact story enemy-selection screen.'
);
assert.match(
  appSource,
  /persistPendingBattleSession\('normal', property, \{ normalOrigin: origin \}\)[\s\S]*onStartBuyout=\{\(property\) =>[\s\S]*handleStartBuyout\(property, 'cartels'\)/,
  'Alliance battles must persist their explicit screen origin instead of inferring it from a shared property ID.'
);
assert.match(
  appSource,
  /returnsToAlliance[\s\S]*destination: 'cartels'[\s\S]*setActiveTab\(returnsToAlliance \? 'cartels' : 'market'\)/,
  'Alliance victories with an ability or synergy unlock must preserve a one-step Alliance return.'
);
assert.match(
  appSource,
  /destination === 'cartels'[\s\S]*アライアンス攻略へ戻る/,
  'The ability screen must name the Alliance return destination explicitly.'
);
assert.match(
  abilityViewSource,
  /onReturnToStory && \([\s\S]*onClick=\{onReturnToStory\}[\s\S]*storyReturnLabel/,
  'A progression-opened ability screen must display a direct story-return control.'
);
assert.doesNotMatch(
  abilityViewSource,
  /控えアビリティ|待機アビリティ|reserveSkillId/,
  'Navigation and loadout copy must not imply a removed waiting ability slot.'
);

console.log('Progression navigation checks passed.');

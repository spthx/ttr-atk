import assert from 'node:assert/strict';
import { COMMUNITY_CAMPAIGN_ORDER } from '../src/data/worldData';
import {
  getNormalBattleNavigation,
  getTrainingReturnLevel,
} from '../src/utils/progressionNavigation';

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

console.log('Progression navigation checks passed.');

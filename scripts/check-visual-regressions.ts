import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BATTLE_CAPITAL_COLUMN_COUNT,
  CAPITAL_OVERFLOW_RESTACK_BEATS,
  CAPITAL_STACK_BEAT_MS,
  getCapitalOverflowPassCount,
  getCapitalPresentationRecoveryAction,
  getMechanicalCapitalColumnFrames,
} from '../src/utils/battlePresentation';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readSource = (path: string) =>
  readFileSync(resolve(repositoryRoot, path), 'utf8');

const battleModal = readSource('src/components/BattleModal.tsx');
const app = readSource('src/App.tsx');
const appPage = readSource('app/page.tsx');
const battlePresentation = readSource('src/utils/battlePresentation.ts');
const capitalCss = readSource('src/battle-capital-layer.css');
const buyoutCss = readSource('src/battle-buyout.css');
const integratedCss = readSource('src/battle-integrated-field.css');
const header = readSource('src/components/Header.tsx');
const cartelAllianceView = readSource('src/components/CartelAllianceView.tsx');
const skillsSynergyView = readSource('src/components/SkillsSynergyView.tsx');
const gameBalance = readSource('src/utils/gameBalance.ts');
const battleSettlement = readSource('src/utils/battleSettlement.ts');
const helpText = readSource('src/data/helpText.ts');
const battleEncounterData = readSource('src/data/battleEncounterData.ts');
const cruelBattle = readSource('src/utils/cruelBattle.ts');
const highEndRaidView = readSource('src/components/HighEndRaidView.tsx');
const highEndRaidCss = readSource('src/high-end-raids.css');
const marketView = readSource('src/components/MarketView.tsx');
const indexCss = readSource('src/index.css');
const saveData = readSource('src/utils/saveData.ts');
const battleSession = readSource('src/utils/battleSession.ts');
const cartel = readSource('src/utils/cartel.ts');

assert.match(
  capitalCss,
  /battlefield-casino-wide\.webp/,
  'desktop battles must use the premium casino table'
);
assert.match(
  capitalCss,
  /battlefield-casino-mobile\.webp/,
  'phone battles must use the portrait casino table'
);
assert.doesNotMatch(
  `${capitalCss}\n${integratedCss}`,
  /buyout-screen--lightweight/,
  'battle artwork must not depend on the removed lightweight mode'
);
assert.match(
  capitalCss,
  /@media \(orientation: landscape\) and \(max-width: 950px\) and \(max-height: 500px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(18rem, \.62fr\)[\s\S]*\.buyout-footer:not\(\.buyout-footer--settled\)[\s\S]*min-height: 2\.75rem/,
  'short landscape phones must keep the action and investment controls above a 44px footer'
);
assert.match(
  app,
  /BATTLE_FRAME_RATE_STORAGE_KEY/,
  'the 30/60fps preference must remain available'
);
assert.match(
  app,
  /announcedEndingRef[\s\S]*soundFx\.playVictory\(\)/,
  'ending fanfare must be guarded against StrictMode double playback'
);
assert.match(
  appPage,
  /EMBEDDED_GAME_VERSION\s*=\s*["'`]casino-field-/,
  'the embedded game cache key must retain the casino-field generation'
);
assert.doesNotMatch(
  `${app}\n${battleModal}`,
  /\blightweightMode\b/,
  '30/60fps must not reintroduce a visual lightweight branch'
);
assert.match(
  battleModal,
  /const \[selectedLevel, setSelectedLevel\] = useState\([\s\S]{0,420}\[\.\.\.INVESTMENT_LEVELS\][\s\S]{0,220}initialBattleCashRef\.current/,
  'battle investment must initially select the maximum amount the player can afford'
);
assert.doesNotMatch(
  battleModal,
  /const \[selectedLevel, setSelectedLevel\] = useState\(3\)/,
  'the old fixed mid-level default must not return'
);

assert.doesNotMatch(
  `${battleModal}\n${capitalCss}\n${integratedCss}`,
  /InvestmentStakePreview|investment-stake-preview|gil-chip-player|capital-cargo-player|cargo-bag|gil-tower__coins|className=["'`]gil-coin/,
  'the fleeting investment bundle, removed bags and placeholder coin paths must not return'
);
[
  'src/assets/battle/capital-cargo-player.webp',
  'src/assets/battle/battlefield-premium-wide.webp',
  'src/assets/battle/battlefield-premium-mobile.webp',
].forEach((path) => {
  assert.equal(
    existsSync(resolve(repositoryRoot, path)),
    false,
    `${path} must remain deleted so it cannot silently return as a fallback`
  );
});
const capitalColumnSlots =
  battleModal.match(
    /const CAPITAL_COLUMN_SLOTS = \[([\s\S]*?)\] as const;/
  )?.[1] ?? '';
assert.equal(
  (capitalColumnSlots.match(/\{ x:/g) ?? []).length,
  22,
  'coin formation DOM must retain exactly twenty-two fixed columns per side'
);
assert.equal(
  (capitalColumnSlots.match(/phoneX:/g) ?? []).length,
  22,
  'every fixed coin column must have a portrait-phone spread position'
);
assert.match(
  battleModal,
  /CAPITAL_COLUMN_SLOTS\.map\([\s\S]*className="capital-fixed-column"/,
  'coin formation must paint the fixed columns instead of amount-scaled DOM'
);
assert.match(
  battleModal,
  /getMechanicalCapitalColumnFrames\([\s\S]*strongPresentation \? 8 : 7/,
  'funding waves must advance a bounded rack group instead of lifting every column together'
);
assert.match(
  battleModal,
  /overflowTier:\s*getBattleCapitalOverflowTier\(committedCapital, marketPrice\)/,
  'exceptional committed capital must keep the fixed rack seated after the burst ends'
);
assert.match(
  battleModal,
  /frame\.overflowTier > 0 && frame\.presentationSerial > 0/,
  'overflow pieces must remain a finite preview effect instead of permanent animation'
);
assert.match(
  battleModal,
  /約\$\{formatCurrency\(limitBreakApproximateAmount\)\}/,
  'the LB button must explain its current contribution in player-readable gil'
);
assert.match(
  battleModal,
  /selectedBattleSynergyEffectLabel[\s\S]*圧力\+\$\{Math\.round/,
  'the synergy button must expose its active pressure bonus and duration'
);
assert.match(
  battleModal,
  /disabled=\{skillSelectionLocked\}/,
  'ability selection must remain independently available while action execution is locked'
);
assert.match(
  battleModal,
  /aria-label={`人脈。\$\{commandReady/,
  'the support drawer must read as player relationships rather than an abstract fund source'
);
assert.match(
  capitalCss,
  /\.gil-floater--support[\s\S]*bottom:\s*calc\(46%/,
  'support amounts must remain above the coin field command area'
);
assert.match(
  battleModal,
  /const requestAlliance[\s\S]*startCapitalPilePreview\([\s\S]*committedCapital\.next,[\s\S]*true,[\s\S]*true/,
  'late-game alliance funding must always receive the heavy stacking presentation'
);
assert.match(
  capitalCss,
  /capital-overflow-stamp[\s\S]*capital-overflow-machine-drop/,
  'overcapital must use one bounded finite machine-drop beat'
);
assert.match(
  capitalCss,
  /@media \(max-width: 430px\)[\s\S]*--coin-column-width: clamp\(\.7rem, 3\.25vw, \.84rem\)[\s\S]*--coin-layer-step: clamp\(\.17rem, \.88vw, \.22rem\)[\s\S]*left: var\(--column-phone-x\)/,
  'portrait phones must use the oversized, taller fixed capital formation'
);
assert.match(
  capitalCss,
  /@media \(max-width: 639px\) and \(min-height: 701px\)[\s\S]*gil-tower--player \.gil-tower__chips[\s\S]*top: -3rem;[\s\S]*right: -10%;[\s\S]*left: 20%;/,
  'tall portrait phones must spend their free vertical area on the coin mountain'
);
assert.doesNotMatch(
  capitalCss,
  /capital-fixed-column\[data-machine-active="true"\][^{]*\{[^}]*z-index/,
  'a stacking column must not jump ahead of nearer rows while it moves'
);
assert.match(
  capitalCss,
  /gil-tower__chips[\s\S]*isolation: isolate;[\s\S]*capital-overflow-stamp[\s\S]*z-index: 12;/,
  'coin depth and finite overflow pieces must remain inside an isolated layer below actors and readouts'
);
assert.match(
  battleModal,
  /const CAPITAL_OVERFLOW_LANE_ORDER = \[3, 4, 2, 5, 1, 6, 0, 7\] as const;/,
  'overcapital lanes must run from the center toward the outer edges'
);
assert.match(
  battleModal,
  /Math\.min\(16, 8 \+ frame\.overflowTier \* 2\)/,
  'overcapital must keep the falling piece count at sixteen or fewer'
);
assert.match(
  battleModal,
  /CAPITAL_OVERFLOW_LANE_ORDER\[\s*index % CAPITAL_OVERFLOW_LANE_ORDER\.length\s*\]/,
  'overcapital pieces must reuse only the eight bounded lanes'
);
assert.match(
  integratedCss,
  /ownership-fighter--enemy:not\(\.ownership-fighter--boss-party\)[\s\S]*\.ownership-avatar--enemy[\s\S]*width: 68%;[\s\S]*height: 72%/,
  'a single enemy must stay near Tataru visual size and leave its coin field readable'
);
assert.match(
  integratedCss,
  /@media \(max-width: 639px\)[\s\S]*ownership-fighter--enemy\.ownership-fighter--boss-party[\s\S]*width: min\(7\.2rem, 38vw\)/,
  'mobile boss parties must stay inside a Tataru-sized visual envelope'
);
assert.match(
  app,
  /const openingAutoUnlocked = savageClearedSet\.has\([\s\S]*FIRST_SAVAGE_FIRST_LAYER_ID[\s\S]*const criticalAutoUnlocked = savageClearedSet\.has\([\s\S]*FIRST_SAVAGE_FOURTH_LAYER_ID/,
  'opening and last-stand roles must unlock after the first Savage floor and first fourth floor'
);
assert.match(
  app,
  /const tradeAllianceUnlocked = !!communityProgress\.find\([\s\S]*community\.id === 'クリスタリウム'/,
  'enterprise Alliance must wait until the Crystarium route is conquered'
);
assert.doesNotMatch(
  app,
  /living_dead_skill|総資産100万ギル達成/,
  'the retired asset-value Living Dead tutorial must not survive the layer-four unlock migration'
);
assert.match(
  indexCss,
  /\.city-unlock__card\s*\{[\s\S]*max-height: calc\(100dvh[\s\S]*overflow-y: auto !important/,
  'unlock explanations must scroll within the 402x874 safe viewport'
);
assert.match(
  skillsSynergyView,
  /SKILL_PROGRESSION_ORDER = \[[\s\S]*skill_sabotage[\s\S]*skill_fast_horse[\s\S]*skill_synergy_push[\s\S]*skill_capital_boost[\s\S]*skill_demoralize[\s\S]*skill_sns_blitz[\s\S]*orderedSkills/,
  'the ability catalogue must follow campaign learning order'
);
assert.doesNotMatch(
  skillsSynergyView,
  /控えアビリティ|待機アビリティ|reserveSkillId|mode:\s*'reserve'/,
  'the removed reserve/waiting slot must not return to the ability UI'
);
assert.match(
  skillsSynergyView,
  /onReturnToStory && \([\s\S]*onClick=\{onReturnToStory\}[\s\S]*MapPinned[\s\S]*storyReturnLabel/,
  'ability setup opened by progression must expose one obvious return-to-story action'
);
assert.match(
  app,
  /const returnFromAbilitySetup[\s\S]*destination === 'savage'[\s\S]*setActiveTab\('savage'\)[\s\S]*mode: 'targets'[\s\S]*community: skillsStoryReturn\.community/,
  'the return action must restore either the high-end list or the exact story enemy list'
);
assert.doesNotMatch(
  `${app}\n${battleModal}\n${skillsSynergyView}`,
  /窮地アビリティ|土壇場アビリティ/,
  'the player-facing auto slot must consistently use 瀕死アビリティ'
);
assert.match(
  battlePresentation,
  /MAX_CAPITAL_DROP_PARTICLE_COUNT = 16/,
  'falling coin particles must remain capped at sixteen'
);
assert.match(
  battlePresentation,
  /return Math\.min\(8,/,
  'foreground coin sprites must remain capped at eight'
);
assert.match(
  battlePresentation,
  /BATTLE_CAPITAL_VISUAL_STAGE_COUNT = 60/,
  'the fine-grained coin pile must retain sixty logical paint stages'
);
assert.match(
  battlePresentation,
  /MAX_BATTLE_CAPITAL_VISIBLE_UNITS =\s*BATTLE_CAPITAL_COLUMN_COUNT \* MAX_BATTLE_CAPITAL_COLUMN_LAYERS/,
  'campaign coin height must remain bounded by the fixed column pool'
);
assert.match(
  battlePresentation,
  /MAX_BATTLE_CAPITAL_COLUMN_LAYERS = 36/,
  'inflation-era columns must retain the taller thirty-six-layer cap'
);
const saturatedReloadPasses = getCapitalOverflowPassCount(
  8_000_000,
  11_000_000,
  1_000_000,
  true
);
assert.equal(
  saturatedReloadPasses,
  3,
  'one exceptional funding event may request at most three full-rack reloads'
);
const saturatedReloadFrames = getMechanicalCapitalColumnFrames(
  BATTLE_CAPITAL_COLUMN_COUNT * 36,
  BATTLE_CAPITAL_COLUMN_COUNT * 36,
  30,
  8,
  saturatedReloadPasses,
  CAPITAL_OVERFLOW_RESTACK_BEATS.heavy
);
assert.equal(
  saturatedReloadFrames.filter((frame) => frame.rackCompressed).length,
  saturatedReloadPasses * (CAPITAL_OVERFLOW_RESTACK_BEATS.heavy + 2),
  'a saturated rack must retain every sink and mechanical reload beat'
);
assert.equal(
  saturatedReloadFrames.at(-1)?.rackCompressed,
  true,
  'the final overflow frame must keep the rack down instead of restoring its root'
);
assert.ok(
  saturatedReloadFrames.every(
    (frame) => frame.columnHeights.length === BATTLE_CAPITAL_COLUMN_COUNT
  ),
  'overflow reloads must reuse the same fixed column pool'
);
const oneOverflowSweep = getMechanicalCapitalColumnFrames(
  BATTLE_CAPITAL_COLUMN_COUNT * 36,
  BATTLE_CAPITAL_COLUMN_COUNT * 36,
  24,
  8,
  1,
  CAPITAL_OVERFLOW_RESTACK_BEATS.heavy
)
  .filter(
    (frame) =>
      frame.overflowPass === 1 && frame.activeColumnIndices.length > 0
  )
  .flatMap((frame) => frame.activeColumnIndices);
const outwardCapitalSweep = [
  6, 17, 1, 2, 11, 12, 5, 7, 16, 18, 0,
  3, 10, 13, 4, 8, 15, 19, 9, 14, 20, 21,
];
assert.deepEqual(
  oneOverflowSweep.slice(0, BATTLE_CAPITAL_COLUMN_COUNT),
  outwardCapitalSweep,
  'one overflow pass must first deal every fixed column from the centre spines outwards'
);
assert.deepEqual(
  oneOverflowSweep.slice(BATTLE_CAPITAL_COLUMN_COUNT),
  [...outwardCapitalSweep].reverse(),
  'one overflow pass must return from the outer edges to the centre spines'
);
assert.equal(
  oneOverflowSweep.length,
  BATTLE_CAPITAL_COLUMN_COUNT * 2,
  'a round-trip overflow pass must touch every fixed column once in each direction'
);
outwardCapitalSweep.forEach((columnIndex) => {
  assert.equal(
    oneOverflowSweep.filter((activeIndex) => activeIndex === columnIndex).length,
    2,
    `fixed column ${columnIndex} must be touched exactly once per sweep direction`
  );
});
assert.ok(
  CAPITAL_STACK_BEAT_MS.heavy <= CAPITAL_STACK_BEAT_MS.standard,
  'large capital must be dealt at least as quickly per beat as an ordinary offer'
);
assert.ok(
  saturatedReloadFrames.length * CAPITAL_STACK_BEAT_MS.heavy <= 1_000,
  'all three overflow reload passes must finish their bounded frame sequence within one second'
);
assert.match(
  battleModal,
  /terminalCapitalHandoffRef\.current[\s\S]*capitalCommitTimersRef\.current\.length > 0[\s\S]*capitalPilePreviewTimersRef\.current\.player\.length > 0/,
  'terminal resolution must wait for every registered capital presentation timer'
);
assert.equal(
  getCapitalPresentationRecoveryAction({
    ended: false,
    hasVisiblePresentation: true,
    runnerActive: false,
    pendingTimerCount: 0,
    terminalHandoffPending: false,
  }),
  'release_stale',
  'an orphaned non-terminal capital card must release its input lock'
);
assert.equal(
  getCapitalPresentationRecoveryAction({
    ended: false,
    hasVisiblePresentation: false,
    runnerActive: false,
    pendingTimerCount: 0,
    terminalHandoffPending: true,
  }),
  'resume_terminal',
  'a terminal handoff interrupted by refresh must resume once its runner is gone'
);
assert.equal(
  getCapitalPresentationRecoveryAction({
    ended: false,
    hasVisiblePresentation: true,
    runnerActive: true,
    pendingTimerCount: 0,
    terminalHandoffPending: true,
  }),
  'none',
  'a live capital runner must retain the full pile and terminal handoff order'
);
assert.match(
  battleModal,
  /const clearCapitalCommitTimers[\s\S]*setCapitalCommit\(null\)[\s\S]*setCapitalPreviewStage\(null\)/,
  'capital timer cleanup must release both the runtime and visible commit lock'
);
assert.match(
  battleModal,
  /terminalCapitalRefreshRecoveryRef\.current\s*=\s*terminalCapitalHandoffRef\.current;[\s\S]*getCapitalPresentationRecoveryAction[\s\S]*resumeTerminal\?\.\(\)/,
  'Fast Refresh must preserve and resume a pending terminal capital handoff'
);
assert.match(
  battleModal,
  /availableSkills\.filter\([\s\S]*!autoSkillIds\.has\(skill\.id\)/,
  'opening and last-stand auto abilities must not return through the manual fallback pool'
);
assert.match(
  battleModal,
  /playerStrongSupportPresentationCountRef\.current < 3[\s\S]*playerStrongSupportPresentationCountRef\.current \+= 1/,
  'ally support must cap its heavy impact treatment at three presentations per battle'
);
assert.doesNotMatch(
  battleModal,
  /const stageTimers = columnFrames\.map/,
  'capital frames must run through one sequential timer instead of one timer per frame'
);
assert.match(
  battleModal,
  /startCompanyCapitalPresentation\([\s\S]*const terminalInvestment = applyGaugeCandidate/,
  'a terminal direct investment must start its capital runner before victory is latched'
);
assert.match(
  battleModal,
  /const startCompanyCapitalPresentation[\s\S]*commandRecharge: 'continue'[\s\S]*const investCompanyFunds/,
  'ordinary direct-investment stacking must advance the command recharge clock'
);
const fullCommandPauseBlock = battleModal.slice(
  battleModal.indexOf('const fullCommandPauseActive'),
  battleModal.indexOf('const { commandTimeScale }')
);
assert.doesNotMatch(
  fullCommandPauseBlock,
  /!!capitalCommit/,
  'direct-investment presentation must not add a second full command-recharge wait'
);
assert.match(
  battlePresentation,
  /resolveMs: 900,[\s\S]*totalMs: 2_230/,
  'skill effects must retain a readable result beat'
);
assert.ok(
  (
    battleModal.match(/startSkillCinematic\(\{/g) ?? []
  ).length >= 3,
  'manual group support, battle-only SYNERGY, abilities and AUTO must share the self-advancing cinematic runner'
);
assert.match(
  battleModal,
  /const \[usedBattleSynergyIds, setUsedBattleSynergyIds\][\s\S]*const battleSynergyUsed =[\s\S]*usedBattleSynergyIds\.has\(selectedBattleSynergy\.id\)/,
  'regular and progression SYNERGY must share one per-battle usage ledger'
);
assert.match(
  battleModal,
  /const demandFromGroup = \(\s*synergyId: string,[\s\S]*usedBattleSynergyIds\.has\(synergyId\)[\s\S]*setUsedBattleSynergyIds\(\(current\) => new Set\(current\)\.add\(synergyId\)\)/,
  'regular group SYNERGY must reject and record repeat use in the same battle'
);
assert.match(
  battleModal,
  /disabled=\{[\s\S]*!battleSynergyReady[\s\S]*battleSynergyUsed[\s\S]*<em>\{battleSynergyUsed\s*\? '使用済み'/,
  'the SYNERGY action must disable and visibly report every used synergy type'
);
assert.match(
  battleModal,
  /getSkillCinematicTimelineState\(\s*performance\.now\(\) - startedAtMs,\s*timing\s*\)[\s\S]*getSkillCinematicEventDecision[\s\S]*capitalCommitActiveRef\.current[\s\S]*capitalPilePreviewActiveRef\.current\.player[\s\S]*capitalPilePreviewActiveRef\.current\.enemy[\s\S]*window\.setTimeout\(advance, 50\)/,
  'the pure elapsed-time runner must hold completion while any capital presentation remains active'
);
assert.match(
  battleModal,
  /runtime\.completionFired = completionDecision\.consumed\.completion;[\s\S]*if \(!completionDecision\.fireCompletion\) return;[\s\S]*skillCinematicRuntimeRef\.current = null;[\s\S]*runtime\.onComplete\?\.\(\);/,
  'ability auto-completion must consume and resume each queued action exactly once'
);
assert.match(
  battleModal,
  /sequenceCapitalPresentation[\s\S]*deferCapitalPile: sequenceCapitalPresentation[\s\S]*presentation\(onComplete\)/,
  'critical capital skills must show their card before the deferred fixed-DOM pile'
);
assert.match(
  battleModal,
  /criticalAutoResolutionPhaseRef\.current[\s\S]*simulationPausedRef\.current = true;[\s\S]*const releaseCriticalAuto[\s\S]*setDecisionGraceActive\(true\);[\s\S]*setCommandProgress\(100\);[\s\S]*decisionGraceArmedRef\.current = true;[\s\S]*sequenceCapitalPresentation: true[\s\S]*'commit_effect'[\s\S]*'complete_presentation'[\s\S]*releaseCriticalAuto\(false\)/,
  'critical AUTO must synchronously hold combat until effect and pile completion'
);
assert.match(
  battleModal,
  /criticalAutoResolutionPhaseRef\.current === 'effect_committed'[\s\S]*'complete_presentation'[\s\S]*releaseCriticalAuto\(false\)/,
  'Fast Refresh must recover a committed critical AUTO whose pile callback was cleared'
);
assert.doesNotMatch(
  battleModal,
  /const releaseCriticalAuto[\s\S]{0,1200}applyGaugeCandidate\(/,
  'critical AUTO completion must not replay the discarded lethal overshoot'
);
assert.doesNotMatch(
  battleModal,
  /skillCinematicTimersRef|scheduleSkillCinematicCompletion/,
  'skill progress must not regress to an orphanable fan-out of UI timers'
);
const battleCleanupBlock = battleModal.slice(
  battleModal.indexOf('terminalCapitalHandoffRef.current = null;'),
  battleModal.indexOf(
    'soundFx.stopBattleCinematicAudio(80);',
    battleModal.indexOf('terminalCapitalHandoffRef.current = null;')
  )
);
assert.match(
  battleCleanupBlock,
  /clearSkillCinematicTimer\(\)/,
  'unmount and Fast Refresh cleanup must clear the pending skill timer'
);
assert.doesNotMatch(
  battleCleanupBlock,
  /skillCinematicRuntimeRef\.current = null|cancelSkillCinematic\(\)/,
  'Fast Refresh cleanup must preserve the skill runtime so the pure timeline can resume'
);
assert.doesNotMatch(
  `${battleModal}\n${capitalCss}`,
  /battle-skill-nameplate__continue|効果を確認して続行/,
  'the removed ability acknowledgement button must not return in JSX or CSS'
);
assert.match(
  battleModal,
  /skillCinematic\.stage === 'name' \|\|[\s\S]*skillCinematic\.stage === 'cast'[\s\S]*\? '構え'[\s\S]*: skillCinematic\.resultHeadline/,
  'synergy and ability nameplates must replace the preparation text in place'
);
assert.match(
  capitalCss,
  /\.battle-skill-nameplate--stage-cast,[\s\S]*\.battle-skill-nameplate--stage-hitstop,[\s\S]*\.battle-skill-nameplate--stage-impact,[\s\S]*\.battle-skill-nameplate--stage-resolve[\s\S]*opacity: 1;[\s\S]*translate: -50% 0;/,
  'the skill nameplate must remain mounted and visible through impact and resolve'
);
assert.doesNotMatch(
  capitalCss,
  /\.battle-skill-nameplate--stage-(?:hitstop|impact)[^{]*\{[^}]*opacity:\s*0|\.battle-skill-nameplate--stage-resolve[^{]*\{[^}]*animation:/,
  'skill resolution must not hide and re-enter the same nameplate'
);
assert.match(
  capitalCss,
  /\.battle-skill-nameplate__effect--pending,[\s\S]*\.battle-skill-nameplate__duration--pending[\s\S]*visibility: hidden;/,
  'preparation must reserve a stable result layout while showing only name and stance'
);
assert.match(
  battleModal,
  /const displayedPlayerInvested = totalPlayerInvested;[\s\S]*const displayedOwnership =\s*capitalRevealPending && activeCapitalSnapshot[\s\S]*activeCapitalSnapshot\.previousOwnership[\s\S]*: ownership;/,
  'accepted gil must update immediately while ownership alone waits for the capital reveal'
);
assert.match(
  battleModal,
  /const displayedCompanyInvested = companyInvested;/,
  'the company-capital readout must update as soon as the command is committed'
);
assert.doesNotMatch(
  battleModal,
  /const displayed(?:Player|Company)Invested\s*=\s*capitalRevealPending/,
  'capitalRevealPending must never roll the displayed gil totals back'
);
const activeCapitalColumnStart = capitalCss.indexOf(
  '.capital-fixed-column[data-machine-active="true"]'
);
const activeCapitalColumnCss = capitalCss.slice(
  activeCapitalColumnStart,
  capitalCss.indexOf('.capital-overflow-stamp', activeCapitalColumnStart)
);
assert.ok(
  activeCapitalColumnCss.length > 0,
  'the active fixed-column CSS section must remain discoverable'
);
assert.match(
  activeCapitalColumnCss,
  /data-machine-active="true"\]::before[\s\S]*animation:\s*capital-column-machine-feed/,
  'an active column must show a short incoming coin cap instead of flashing the whole pillar'
);
assert.doesNotMatch(
  activeCapitalColumnCss,
  /filter:\s*brightness|capital-column-machine-seat/,
  'mechanical column loading must not use brightness flashing'
);
assert.doesNotMatch(
  capitalCss,
  /@keyframes capital-column-machine-seat/,
  'the retired whole-column brightness animation must not return'
);
assert.match(
  capitalCss,
  /gil-column-field\s*\{[\s\S]*--capital-rack-compression:\s*0rem;[\s\S]*translate:\s*0 calc\([\s\S]*var\(--capital-rack-sink, 0rem\) \+ var\(--capital-rack-compression\)[\s\S]*\)/,
  'the fixed rack must combine its persistent overflow sink with the loading-time descent'
);
for (const tier of [1, 2, 3]) {
  assert.match(
    capitalCss,
    new RegExp(
      `gil-column-field\\[data-overflow-tier="${tier}"\\]\\s*\\{[\\s\\S]*?--capital-rack-sink:`
    ),
    `overflow tier ${tier} must keep a persistent downward rack offset`
  );
}
assert.match(
  capitalCss,
  /gil-column-field\[data-rack-compressed="true"\]\s*\{[\s\S]*?--capital-rack-compression:\s*\.55rem;/,
  'an exceptional funding frame must visibly lower the fixed rack while coins are loaded'
);
assert.match(
  capitalCss,
  /@media \(max-width: 430px\)[\s\S]*gil-column-field\[data-rack-compressed="true"\]\s*\{[\s\S]*?--capital-rack-compression:\s*\.62rem;/,
  'portrait phones must retain the stronger loading-time rack descent'
);
assert.match(
  battleModal,
  /data-rack-compressed=\{frame\.rackCompressed \? 'true' : 'false'\}/,
  'the mechanical overflow frame must remain connected to the rack descent CSS'
);
assert.doesNotMatch(
  capitalCss,
  /gil-tower--impact \.capital-fixed-column\s*\{[\s\S]*?translate:/,
  'a hit must not move every fixed column root and then snap it back'
);
assert.match(
  capitalCss,
  /integrated-battlefield--terminal-direct\.integrated-battlefield--terminal-winner-player[\s\S]*integrated-battlefield--settled-player\.integrated-battlefield--settled-direct[\s\S]*ownership-fighter--player[\s\S]*z-index:\s*66/,
  'Tataru must travel above both fixed coin racks during the direct victory finisher'
);
assert.match(
  capitalCss,
  /integrated-battlefield--settled-player\.integrated-battlefield--settled-direct[\s\S]*ownership-fighter--enemy[\s\S]*z-index:\s*65/,
  'the struck enemy must remain visible above the coin racks during the direct finisher'
);
assert.match(
  buyoutCss,
  /result-celebration-choice > div\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
  'the two profit-allocation choices must remain equal side-by-side columns on phones'
);
assert.match(
  buyoutCss,
  /result-celebration-choice > div > button\s*\{[\s\S]*min-height:\s*3\.25rem/,
  'each phone profit-allocation choice must retain a touch-safe height'
);
assert.doesNotMatch(
  buyoutCss,
  /@media \(max-width:\s*390px\)[\s\S]*result-celebration-choice > div[\s\S]*grid-template-columns:\s*1fr/,
  'narrow phones must not collapse the two allocation choices into a clipped vertical stack'
);
assert.match(
  capitalCss,
  /@media \(max-width: 430px\)[\s\S]*buyout-result-overlay[\s\S]*max-height: calc\([\s\S]*100dvh[\s\S]*result-celebration-choice[\s\S]*overflow-wrap: anywhere/,
  '402px portrait results and profit-sharing copy must retain the last line inside the safe viewport'
);
assert.match(
  capitalCss,
  /result-return-map[\s\S]*min-height: 3\.6rem[\s\S]*line-height: 1\.35/,
  'the post-victory return action must allow a readable wrapped label'
);
assert.match(
  battleModal,
  /profitAllocationChoices\.map\(\(option\) => \{[\s\S]*option\.cost[\s\S]*option\.departureProbability/,
  'the result modal must only map the pure settlement choice projections'
);
assert.match(
  `${gameBalance}\n${battleSettlement}`,
  /id:\s*'keep'[\s\S]*label:\s*'独占'[\s\S]*id:\s*'share50'[\s\S]*label:\s*'山分け'[\s\S]*departureProbabilityMultiplier:\s*0\.2/,
  'the portable settlement contract must define exclusive or 50% sharing with nonzero departure risk'
);
assert.doesNotMatch(
  `${gameBalance}\n${battleSettlement}\n${battleModal}\n${app}\n${helpText}`,
  /'gift10'|'gift20'|ご祝儀なし|標準のご祝儀|安心のご祝儀/,
  'the retired three-choice gift contract must not return in logic or player-facing copy'
);
assert.match(
  battleModal,
  /aria-label="商店戦力の変化"[\s\S]*<small>今回の戦力増減<\/small>/,
  'the result growth card must identify its signed number as this battle\'s change, not an absolute strength value'
);
assert.match(
  app,
  /const isExtreme =\s*mode === 'normal' && isExtremeReacquisition\(targetProperty\);[\s\S]*battleMode: isExtreme \? 'extreme' : mode/,
  'market cards must request the dedicated Extreme readiness assessment'
);
assert.match(
  battleModal,
  /battleMode: isTraining[\s\S]*isExtremeBattle[\s\S]*\? 'extreme'[\s\S]*: 'normal'/,
  'the pre-battle modal must use the same Extreme readiness assessment as its market card'
);
assert.match(
  app,
  /isExtremeReacquisitionBattle[\s\S]*getNormalBattleNavigation\([\s\S]*isReacquisition: isExtremeReacquisitionBattle/,
  'Extreme settlement must identify itself to navigation so an old city unlock is not replayed'
);
assert.ok(
  (header.match(/アライアンス/g) ?? []).length >= 2,
  'desktop and mobile navigation must both call the cooperation tab アライアンス'
);
assert.match(
  cartelAllianceView,
  /EXTERNAL ALLIANCE[\s\S]*相場75%固定（高難度補正なし）[\s\S]*人脈疲労なし[\s\S]*離反なし[\s\S]*OWNED NETWORK[\s\S]*1回目100%、以後1回ごとに10ポイント低下（下限50%）[\s\S]*独立リスクあり/,
  'the alliance screen must contrast risk-free external support with the reusable but risky owned network'
);
assert.match(
  highEndRaidView,
  /cartels\.some\(\(cartel\) =>[\s\S]*isCartelFullyPrepared\(cartel, ownedNormalPropertyIds\)[\s\S]*raid\.series === 1 && raid\.layer === 4 && !hasFullyPreparedCartel/,
  'Savage series 1 layer 4 must keep its preparation warning until one complete cartel is owned'
);
assert.match(
  cartel,
  /ownedPropertyIds\.has\(cartel\.hqPropertyId\)[\s\S]*cartel\.subsidiaryIds\.every/,
  'cartel preparation must require its headquarters and every participating company'
);
assert.match(
  highEndRaidCss,
  /savage-layer-card__preparation button\s*\{[\s\S]*min-height:\s*2\.75rem/,
  'the direct cartel-preparation action must retain a 44px touch target'
);
assert.match(
  highEndRaidView,
  /getDefaultOpenSavageSeries[\s\S]*<details[\s\S]*className="savage-series"[\s\S]*<summary className="savage-series__header"/,
  'the twelve Savage cards stay grouped behind a compact, tappable series disclosure'
);
assert.match(
  highEndRaidCss,
  /\.savage-series__header\s*\{[\s\S]*min-height:\s*2\.75rem[\s\S]*cursor:\s*pointer/,
  'each Savage series summary keeps a 44px touch target'
);
assert.match(
  marketView,
  /campaignMode === 'normal' && !hasStartedCampaign && \([\s\S]*<BeginnerGuide defaultOpen/,
  'the full beginner guide must leave the main market after the first acquisition'
);
assert.match(
  indexCss,
  /\.game-legal-notice a\s*\{[\s\S]*display:\s*inline-flex[\s\S]*min-height:\s*2\.75rem/,
  'legal links remain 44px touch targets on phones'
);
assert.match(
  integratedCss,
  /@media \(max-width: 639px\)[\s\S]*\.battle-action-strip__action em\s*\{[\s\S]*display:\s*block[\s\S]*font-size:\s*\.48rem/,
  'compact phone commands retain a visible one-line state badge'
);
assert.match(
  app,
  /calculateAllianceSupport\(targetProperty\.marketPrice\)/,
  'market-card readiness must use the fixed external-alliance amount'
);
assert.ok(
  (battleModal.match(/calculateAllianceSupport\(targetProperty\.marketPrice\)/g) ?? []).length >= 2,
  'the battle display and executed external-alliance request must use the same fixed amount'
);
assert.match(
  battleModal,
  /高難度支援補正：人脈・通常グループSYNERGY[\s\S]*外部アライアンス・LBは対象外/,
  'high-difficulty rules must exclude both external alliance and LIMIT BREAK'
);
const requestAllianceSource = battleModal.slice(
  battleModal.indexOf('const requestAlliance ='),
  battleModal.indexOf('const selectSkill =')
);
assert.doesNotMatch(
  requestAllianceSource,
  /chargeLimitBreak/,
  'risk-free external alliance support must not charge LIMIT BREAK'
);
assert.ok(
  (battleModal.match(/capitalCommit \|\|\s+capitalPilePresentationLocked \|\|/g) ?? []).length >= 4,
  'enemy and player auto actions must wait for both sides of the capital pile presentation queue'
);
assert.match(
  battleModal,
  /commandRecharge: CapitalPileCommandRecharge = 'continue'/,
  'ordinary capital pile previews must opt into command recharge by default'
);
assert.ok(
  (battleModal.match(/^\s*'pause',?\s*$/gm) ?? []).length >= 5,
  'limit breaks, effect cards and exceptional enemy capital piles must retain a full pause'
);
assert.match(
  battleModal,
  /!capitalPresentationActive \|\|[\s\S]*commandTimeScale <= 0[\s\S]*setCommandProgress\([\s\S]*commandProgressPerTick \* commandTimeScale/,
  'the dedicated pile interval must advance only the player command clock'
);
assert.match(
  battleModal,
  /const consumeCommand[\s\S]*capitalPilePreviewActiveRef\.current\.player \|\|[\s\S]*capitalPilePreviewActiveRef\.current\.enemy/,
  'a recharged command must remain unusable until both capital piles finish'
);
assert.match(
  battleModal,
  /const \[feintRemaining, setFeintRemaining\][\s\S]*TACTICAL_SKILL_BALANCE\.feint\.enemyPushMultiplier/,
  'Feint must own one timed 10% enemy-pressure reduction instead of a reactive interrupt state'
);
assert.match(
  battleModal,
  /skill\.effectType === 'FEINT'[\s\S]*feintRemainingRef\.current = TACTICAL_SKILL_BALANCE\.feint\.durationMs[\s\S]*setFeintRemaining/,
  'pressing Feint must activate its full duration immediately'
);
assert.doesNotMatch(
  battleModal,
  /interruptEnemySupportTelegraph|stunInterruptedActionRef|スタン可能|スタンで遅延|発動予約|牽制待機/,
  'the retired Stun/activation-reservation behavior and copy must not return'
);
assert.match(
  battleModal,
  /applyFeintToEnemyGaugeCandidate[\s\S]*applyCoverToGaugeCandidate[\s\S]*pendingDarkWavesRef\.current\.length[\s\S]*getBlackestNightDarkWaveGaugeDelta/,
  'enemy pressure must resolve Feint, finite defenses, then same-transaction Dark Wave'
);
assert.match(
  battleModal,
  /barrier\.remainingGaugeCapacity <= 0[\s\S]*releaseBlackestNight\('player', true\)[\s\S]*releaseBlackestNight\('enemy', true\)/,
  'Blackest Night must queue Dark Wave only when the finite barrier fully breaks'
);
assert.match(
  battleModal,
  /capitalReversalRequired[\s\S]*triggerPlayerOwnership[\s\S]*startEnemySupportSkill\('capital_reversal'\)[\s\S]*forcedLiquidationRequired[\s\S]*triggerPlayerOwnership[\s\S]*startEnemySupportSkill\('forced_liquidation'\)/,
  'Savage layer three and four mechanics must hold their authored ownership thresholds before settlement'
);
assert.match(
  battleModal,
  /const reversalActive = capitalReversalRemainingRef\.current > 0[\s\S]*resolveCapitalReversal\([\s\S]*reflectedOwnershipCap[\s\S]*capitalReversalRemainingRef\.current = 0/,
  'only direct investment must consume 資本反転 with the first-series reflection cap'
);
assert.match(
  battleModal,
  /if \(skillId === 'forced_liquidation'\)[\s\S]*forcedLiquidationRecoveryRemainingRef\.current = recoveryMs;[\s\S]*forcedLiquidationAwaitingManualCounterRef\.current = true/,
  '強制清算 impact must arm a manual-counter gate for pre-existing player continuous pressure'
);
assert.match(
  battleModal,
  /const consumeCommand = \(\) => \{[\s\S]*forcedLiquidationRecoveryRemainingRef\.current > 0[\s\S]*forcedLiquidationAwaitingManualCounterRef\.current = false[\s\S]*setCommandProgress\(0\)/,
  'the first successfully consumed manual command must release player continuous pressure'
);
assert.match(
  battleModal,
  /if \(nextRecovery <= 0\) \{[\s\S]*forcedLiquidationAwaitingManualCounterRef\.current = false/,
  '強制清算 grace expiry must release player continuous pressure without requiring a command'
);
assert.match(
  battleModal,
  /resolveForcedLiquidationContinuousVelocity\(\{[\s\S]*velocity: limitAdjustedVelocity,[\s\S]*recoveryRemaining: forcedLiquidationRecoveryRemainingRef\.current,[\s\S]*awaitingManualCounter:[\s\S]*forcedLiquidationAwaitingManualCounterRef\.current/,
  'the live gauge loop must resolve both sides through the 強制清算 continuous-pressure gate'
);
assert.match(
  gameBalance,
  /if \(recoveryRemaining <= 0\) return velocity;[\s\S]*if \(awaitingManualCounter\) return 0;[\s\S]*return Math\.min\(0, velocity\);/,
  'the gate must freeze both sides before a counter, then keep only enemy pressure frozen for the remaining grace'
);
assert.match(
  battleModal,
  /const applyGaugeCandidate = \([\s\S]*criticalAutoKeepsResolvedImpact = false[\s\S]*preserveResolvedCandidate: criticalAutoKeepsResolvedImpact/,
  'ordinary enemy pressure must default to the generic 25% critical AUTO boundary'
);
assert.match(
  battleModal,
  /if \(skillId === 'forced_liquidation'\)[\s\S]*applyGaugeCandidate\([\s\S]*gaugeRef\.current \+ liquidationGaugeDelta,[\s\S]*'enemy',[\s\S]*'NORMAL',[\s\S]*true,[\s\S]*false,[\s\S]*true[\s\S]*forcedLiquidationRecoveryRemainingRef\.current = recoveryMs/,
  'Forced Liquidation must preserve its already-mitigated impact while triggering critical AUTO'
);
assert.match(
  battleModal,
  /const \[companyInvested, setCompanyInvested\] = useState\(0\);[\s\S]*const \[reflectedCompanyInvested, setReflectedCompanyInvested\][\s\S]*const totalPlayerInvested = companyInvested \+ demandInvested;[\s\S]*const displayedCompanyInvested = companyInvested;[\s\S]*commitPlayerCapital\('company', retainedCapital\);[\s\S]*setReflectedCompanyInvested\([\s\S]*current \+ reflectedCapital[\s\S]*const companyCapitalAtRisk =[\s\S]*companyInvested \+ reflectedCompanyInvested;[\s\S]*const resultSettlementCost =[\s\S]*companyCapitalAtRisk \* \(winner === 'player' \? 0\.35 : 0\.75\)[\s\S]*companyFundsInvested: companyCapitalAtRisk/,
  'capital reflected to the enemy must stay out of player pressure while remaining in settlement risk and BattleResult'
);
assert.doesNotMatch(
  battleModal,
  /commitPlayerCapital\('company', reflectedCapital\)|setCompanyInvested\([\s\S]{0,180}reflectedCapital|const totalPlayerInvested\s*=\s*companyCapitalAtRisk/,
  'reflected company capital must never leak back into the player pressure ledger'
);
assert.match(
  battleModal,
  /enemySupportTelegraphTickerRef = useRef<number \| null>\(null\)[\s\S]*window\.setInterval\([\s\S]*\}, 250\)/,
  'enemy support telegraphs must use one dedicated 250ms display ticker'
);
assert.match(
  battleModal,
  /const visibleRemaining = Math\.max\([\s\S]*100,[\s\S]*Math\.ceil\(clock\.remainingMs \/ 100\) \* 100[\s\S]*\)/,
  'an enemy telegraph held by capital stacking must never show zero seconds'
);
assert.match(
  battleModal,
  /const enemySupportCastBlocked =[\s\S]*capitalPilePresentationLocked \|\|[\s\S]*useEffect\(\(\) => \{[\s\S]*resumePendingCast\(\)/,
  'both capital-pile queues must hold an expired enemy support cast'
);
assert.match(
  battleModal,
  /const beginCast = \(grantPostPileGrace = false\)[\s\S]*capitalPilePreviewActiveRef\.current\.player[\s\S]*capitalPilePreviewActiveRef\.current\.enemy[\s\S]*beginCast\(grantPostPileGrace \|\| capitalPileBlocked\)[\s\S]*if \(grantPostPileGrace\)[\s\S]*startEnemySupportTelegraphTicker\([\s\S]*ENEMY_SUPPORT_POST_PILE_GRACE_MS,[\s\S]*\(\) => beginCast\(false\)/,
  'an enemy support cast deferred by stacking must grant a readable post-pile action window'
);
assert.match(
  battleModal,
  /const beginCast[\s\S]*updateStage\('cast'\)[\s\S]*clearEnemySupportTelegraphTicker\(\)[\s\S]*setEnemySupportTelegraphRemainingMs\(null\)[\s\S]*startEnemySupportTelegraphTicker\([\s\S]*presentation\.telegraphMs,[\s\S]*\(\) => beginCast\(false\)/,
  'the enemy countdown must own the warning duration and stop only when the actual cast starts'
);
assert.match(
  battleModal,
  /const clearEnemySupportTimers[\s\S]*clearEnemySupportTelegraphTicker\(\)[\s\S]*setEnemySupportTelegraphRemainingMs\(null\)[\s\S]*const cancelEnemySupportTelegraph[\s\S]*clearEnemySupportTimers\(\)[\s\S]*useEffect\(\(\) => \(\) => \{[\s\S]*clearEnemySupportTimers\(\)/,
  'cancel and unmount paths must both clear the enemy countdown ticker'
);
assert.match(
  battleModal,
  /enemy-support-actor__countdown[\s\S]*発動まで[\s\S]*enemySupportTelegraphRemainingMs \/ 1000[\s\S]*toFixed\(1\)[\s\S]*秒/,
  'the enemy support actor must expose a readable remaining time without Stun instructions'
);
assert.match(
  capitalCss,
  /\.enemy-support-actor__countdown[\s\S]*min-width: max-content[\s\S]*white-space: nowrap/,
  'the cast countdown must stay legible beside the enemy support name'
);
assert.doesNotMatch(
  battleModal,
  /enemyDisruptionRemaining|setEnemyDisruptionRemaining|連環計/,
  'the removed timed disruption and capital-collapse implementation must not return'
);
assert.match(
  battleModal,
  /calculateSubsidiarySupportAmount\([\s\S]*networkRequestCount/,
  'the network drawer must preview battle-wide network fatigue across companies'
);
assert.match(
  battleModal,
  /integrated-battlefield--settled-\$\{winner\}/,
  'terminal actor positions must remain latched through the result handoff'
);
assert.match(
  battleModal,
  /shouldForceUltimateCriticalBeforeVictory[\s\S]*setUltimateCriticalGatePending\(true\)[\s\S]*updateGauge\(-98, true\)/,
  'Ultimate must resolve its authored critical action before accepting victory'
);
assert.match(
  battleModal,
  /ultimateCriticalGatePending[\s\S]*startEnemySupportSkill\(criticalSkillId\)/,
  'the Ultimate victory hold must hand off to the critical action presentation'
);
assert.match(
  battleModal,
  /simulationPausedRef\.current = presentationPauseActive[\s\S]*simulationPausedRef\.current \|\|[\s\S]*timeScale <= 0/,
  'presentation pauses must synchronously block queued enemy actions'
);
assert.match(
  battleModal,
  /const impactPresentationActive =[\s\S]{0,120}isBattleImpactPresentationActive\(impactStop\?\.phase\)/,
  'impact locking must use one shared phase rule'
);
assert.match(
  battleModal,
  /const presentationPauseActive =[\s\S]{0,520}impactPresentationActive/,
  'impact hitstop and release must both pause the battle simulation'
);
assert.match(
  battleModal,
  /const fullCommandPauseActive =[\s\S]{0,520}impactPresentationActive/,
  'impact hitstop and release must both pause command recharge'
);
assert.doesNotMatch(
  battleModal,
  /impactStop\?\.phase === 'hitstop'/,
  'the release phase must never be excluded from battle-clock locking'
);
assert.match(
  battleModal,
  /const capitalPresentationActive =\s*capitalCommit !== null \|\| capitalPilePresentationLocked/,
  'direct investments and queued piles must share one presentation clock'
);
assert.match(
  battleModal,
  /const capitalPresentationAllowsCommandRecharge =[\s\S]{0,240}capitalPreviewStage\?\.commandRecharge !== 'pause'[\s\S]{0,240}playerCapitalPilePreviewStage\?\.commandRecharge !== 'pause'[\s\S]{0,240}enemyCapitalPilePreviewStage\?\.commandRecharge !== 'pause'/,
  'every capital presentation must carry its command-recharge policy'
);
assert.match(
  battleModal,
  /capitalPileActive: capitalPresentationActive[\s\S]{0,180}capitalPileAllowsCommandRecharge:\s*capitalPresentationAllowsCommandRecharge/,
  'the clock helper must receive the unified capital presentation state'
);
assert.match(
  battleModal,
  /useEffect\(\(\) => \{\s*if \(\s*!capitalPresentationActive[\s\S]{0,720}setCommandProgress/,
  'direct coin stacking must use the presentation-only command recharge loop'
);
assert.match(
  battleModal,
  /advanceEnemySupportTelegraphClock\(\{[\s\S]{0,420}enemySupportCastBlockedRef\.current[\s\S]{0,240}capitalCommitActiveRef\.current[\s\S]{0,240}capitalPilePreviewActiveRef\.current\.player[\s\S]{0,240}capitalPilePreviewActiveRef\.current\.enemy/,
  'enemy telegraphs must freeze behind every active presentation blocker'
);
assert.doesNotMatch(
  battleModal,
  /window\.setTimeout\([\s\S]{0,120}\(\) => beginCast\(false\)[\s\S]{0,120}presentation\.telegraphMs/,
  'enemy telegraphs must not use a wall-clock cast timeout'
);
assert.match(
  battleModal,
  /if \(terminalRef\.current \|\| simulationPausedRef\.current\) return;[\s\S]*setAiProgress/,
  'enemy action progress must remain frozen throughout presentation beats'
);
assert.match(
  battleModal,
  /primarySkillActionLocked && primarySkillStateText === '発動可'[\s\S]*'演出待ち'/,
  'a locked ready ability must explain that it is waiting for the presentation'
);
assert.match(
  battleModal,
  /displayedPlayerInvested\s*\/\s*Math\.max\(1, targetProperty\.marketPrice\)\s*\*\s*100[\s\S]*data-extreme-opponent-scale-ratio[\s\S]*相手企業規模比/,
  'Extreme presents the real accumulated gil relative to the opponent company scale'
);
assert.match(
  battleModal,
  /<GilTower[\s\S]{0,320}amount=\{displayedPlayerInvested\}[\s\S]{0,220}marketPrice=\{targetProperty\.marketPrice\}/,
  'Extreme reuses the real gil amount and company scale without inflating game state or DOM units'
);
assert.match(
  gameBalance,
  /budgetMultiplierByLevel:\s*\[1, 1\.2, 1\.35\][\s\S]*maximumDifficultyLevel:\s*5/,
  'Extreme budget growth and AI cap must remain modest and deterministic'
);
assert.match(
  highEndRaidView,
  /ultimate-raid-card[\s\S]*\{cruelUnlocked && \([\s\S]*酷へ再挑戦/,
  'Cruel remains one replayable card directly below Ultimate'
);
assert.match(
  highEndRaidView,
  /万象資本化[\s\S]*開始約15秒後[\s\S]*所有率10%[\s\S]*第二査定[\s\S]*75%以上/,
  'the Cruel card must disclose its two recovery checks without implying a required loadout'
);
assert.match(
  highEndRaidCss,
  /@media \(max-width: 720px\)[\s\S]*\.cruel-raid-card__actions button\s*\{[\s\S]*width:\s*100%/,
  'the Cruel action remains a clear 402px portrait control'
);
assert.match(
  battleEncounterData,
  /firstTriggerActiveMs:\s*15_000[\s\S]*firstImpactPlayerOwnership:\s*10[\s\S]*secondTriggerPlayerOwnership:\s*50[\s\S]*forcedSecondTriggerRecoveryMs:\s*35_000[\s\S]*successPlayerOwnership:\s*75[\s\S]*secondFailureOutcome:\s*'player_defeat'[\s\S]*secondFailureDisplayedOwnership:\s*0/,
  'Cruel must retain the authored first collapse, recovery trigger, timeout, and second check'
);
assert.match(
  cruelBattle,
  /resolveCruelFirstImpact[\s\S]*Math\.min\([\s\S]*firstImpactPlayerOwnership[\s\S]*resolveCruelSecondImpact[\s\S]*outcome:\s*'defeat'[\s\S]*secondFailureDisplayedOwnership/,
  'Cruel preserves first-phase capital while a failed final assessment resolves deterministically'
);
assert.match(
  battleModal,
  /cruelSecondFailurePendingRef[\s\S]*updateCruelScriptPhase\('second_failed'\)[\s\S]*skillId === 'cruel_reckoning'[\s\S]*finishBattle\([\s\S]*'CRUEL_RECKONING_FAILED'/,
  'a failed Cruel assessment must finish its support-card timeline before one terminal defeat'
);
assert.match(
  battleModal,
  /中断不能フェーズ技 \/ カウント中も行動可能/,
  'Cruel scripted declarations must explain their phase-changing role without retired Stun copy'
);
assert.match(
  battleModal,
  /<em aria-live="off">[\s\S]{0,240}normalizedOwnership[\s\S]{0,240}cruelSecondSignatureInvested/,
  'Cruel keeps its static appraisal alert while continuous ownership progress stays out of the live region'
);
assert.match(
  battleModal,
  /cruelSecondFailureSnapshotRef\.current = \{[\s\S]{0,180}ownership: resolution\.ownershipBefore[\s\S]{0,180}directInvestment: resolution\.signaturePaid/,
  'Cruel must retain both measured appraisal values for the final defeat explanation'
);
assert.match(
  battleModal,
  /formatCruelReckoningFailureRequirements[\s\S]{0,900}必要75%[\s\S]{0,900}必要10%/,
  'Cruel failure copy must state the ownership and direct-investment requirements together'
);
assert.ok(
  (battleModal.match(/formatCruelReckoningFailureRequirements\(\)/g) ?? [])
    .length >= 2,
  'Cruel must reuse its measured two-condition explanation in both the terminal log and Tatar analysis'
);
assert.doesNotMatch(
  battleModal,
  /終極資本査定の終了時に所有率75%へ届か/,
  'Cruel must not falsely describe a signature-only failure as an ownership-only miss'
);
assert.match(
  battleModal,
  /const isHighEndRaid = isSavage \|\| isUltimate \|\| isCruel;[\s\S]*const isProtectedBattle = isHighEndRaid \|\| isTraining/,
  'Cruel inherits the high-end protection path for ownership and departure state'
);
assert.match(
  saveData,
  /cruelCleared\?: boolean[\s\S]*cruelCleared:\s*parsed\.cruelCleared === true/,
  'Cruel clear storage remains optional and backward compatible'
);
assert.match(
  battleSession,
  /'ultimate',[\s\S]*'cruel',[\s\S]*'training'/,
  'an interrupted Cruel attempt remains recoverable'
);
assert.match(
  app,
  /projectedProperties = isNormalBattle[\s\S]*:\s*properties;[\s\S]*projectedCruelCleared[\s\S]*cruelCleared:\s*projectedCruelCleared/,
  'Cruel settlement saves only its record while normal properties stay protected'
);
assert.match(
  app,
  /if \(ultimateCleared && !trueEndingSeen\)[\s\S]*setEndingNotice\('true'\)/,
  'Cruel completion must not become a second true-ending trigger'
);
assert.match(
  capitalCss,
  /boss-party-final-knock-away[\s\S]*integrated-battlefield--settled-player[\s\S]*boss-enemy-party__member/,
  'boss party members must leave with their leader and remain offstage'
);

const assertCompactWebp = (path: string, maximumBytes: number) => {
  const absolutePath = resolve(repositoryRoot, path);
  const bytes = readFileSync(absolutePath);
  assert.equal(
    bytes.subarray(0, 4).toString('ascii'),
    'RIFF',
    `${path} is not RIFF`
  );
  assert.equal(
    bytes.subarray(8, 12).toString('ascii'),
    'WEBP',
    `${path} is not WebP`
  );
  assert.ok(
    statSync(absolutePath).size <= maximumBytes,
    `${path} exceeds the ${maximumBytes}-byte visual budget`
  );
};

assertCompactWebp('src/assets/battle/battlefield-casino-wide.webp', 100_000);
assertCompactWebp('src/assets/battle/battlefield-casino-mobile.webp', 100_000);
assertCompactWebp('src/assets/battle/gil-chip-player.webp', 180_000);

console.log('Visual regression checks passed.');

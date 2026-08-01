import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BATTLE_CAPITAL_COLUMN_COUNT,
  CAPITAL_OVERFLOW_RESTACK_BEATS,
  CAPITAL_STACK_BEAT_MS,
  getCapitalOverflowPassCount,
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
const cruelBattle = readSource('src/utils/cruelBattle.ts');
const highEndRaidView = readSource('src/components/HighEndRaidView.tsx');
const highEndRaidCss = readSource('src/high-end-raids.css');
const saveData = readSource('src/utils/saveData.ts');
const battleSession = readSource('src/utils/battleSession.ts');

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
  /getMechanicalCapitalColumnFrames\([\s\S]*strongPresentation \? 5 : 4/,
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
  /const openingAutoUnlocked = savageUnlocked;[\s\S]*const criticalAutoUnlocked = savageClearedSet\.has\([\s\S]*FIRST_SAVAGE_FOURTH_LAYER_ID/,
  'opening and last-stand abilities must unlock at Savage and its first fourth floor'
);
assert.match(
  skillsSynergyView,
  /SKILL_PROGRESSION_ORDER = \[[\s\S]*skill_synergy_push[\s\S]*skill_era_wind[\s\S]*orderedSkills\.map/,
  'the ability catalogue must follow campaign learning order'
);
assert.doesNotMatch(
  `${app}\n${battleModal}\n${skillsSynergyView}`,
  /窮地アビリティ/,
  'the player-facing auto slot must consistently use 土壇場アビリティ'
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
  5,
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
  5,
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
  battlePresentation,
  /resolveMs: 900,[\s\S]*totalMs: 2_230/,
  'skill effects must retain a readable result beat'
);
assert.ok(
  (
    battleModal.match(
      /scheduleSkillCinematicCompletion\((?:timing|skillTiming)\.resolveMs\)/g
    ) ?? []
  ).length >= 3,
  'player skills, auto skills and synergies must all auto-complete after their readable resolve beat'
);
assert.match(
  battleModal,
  /const scheduleSkillCinematicCompletion[\s\S]*capitalCommitActiveRef\.current[\s\S]*capitalPilePreviewActiveRef\.current\.player[\s\S]*capitalPilePreviewActiveRef\.current\.enemy[\s\S]*window\.setTimeout\(\s*finishWhenPresentationIsReady,\s*50\s*\)/,
  'ability auto-completion must poll at 50ms while either capital presentation is still active'
);
assert.match(
  battleModal,
  /const onComplete = skillCinematicCompletionRef\.current;[\s\S]*skillCinematicCompletionRef\.current = null;[\s\S]*onComplete\?\.\(\);/,
  'ability auto-completion must resume its queued battle action through the completion ref'
);
assert.doesNotMatch(
  `${battleModal}\n${capitalCss}`,
  /battle-skill-nameplate__continue|効果を確認して続行/,
  'the removed ability acknowledgement button must not return in JSX or CSS'
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
  /gil-column-field\s*\{[\s\S]*translate:\s*0 var\(--capital-rack-sink, 0rem\)/,
  'the fixed rack must apply its overflow sink as persistent layout state'
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
assert.doesNotMatch(
  capitalCss,
  /--capital-rack-compression/,
  'overflow completion must not remove a temporary compression offset and pop the rack root back up'
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
assert.ok(
  (header.match(/アライアンス/g) ?? []).length >= 2,
  'desktop and mobile navigation must both call the cooperation tab アライアンス'
);
assert.match(
  cartelAllianceView,
  /EXTERNAL ALLIANCE[\s\S]*相場75%・各争奪戦1回[\s\S]*離反なし[\s\S]*OWNED NETWORK[\s\S]*3回目から減衰[\s\S]*独立リスクあり/,
  'the alliance screen must contrast risk-free external support with owned networks such as Agora'
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
  /cancelEnemySupportTelegraph\(false\)[\s\S]*aiProgress >= 72[\s\S]*stunInterruptedActionRef\.current = 'standard'/,
  'Stun must interrupt either a special telegraph or a clearly advanced normal action warning'
);
assert.doesNotMatch(
  battleModal,
  /enemyDisruptionRemaining|setEnemyDisruptionRemaining|連環計/,
  'the removed timed disruption and capital-collapse implementation must not return'
);
assert.match(
  battleModal,
  /calculateSubsidiarySupportAmount\([\s\S]*subRequestCounts\[property\.id\]/,
  'the network drawer must preview the battle-local decayed support amount'
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
  /万象資本化[\s\S]*4～5秒[\s\S]*スタンまたは防御/,
  'the Cruel card must disclose the response window and its counters'
);
assert.match(
  highEndRaidCss,
  /@media \(max-width: 720px\)[\s\S]*\.cruel-raid-card__actions button\s*\{[\s\S]*width:\s*100%/,
  'the Cruel action remains a clear 402px portrait control'
);
assert.match(
  cruelBattle,
  /triggerPlayerOwnership:\s*75[\s\S]*telegraphMs:\s*4_500[\s\S]*maximumOwnershipPush:\s*40/,
  'Omnicapitalization keeps its 75% trigger, readable telegraph and 40pt cap'
);
assert.match(
  battleModal,
  /remainingReserve\s*=\s*Math\.max\(0, enemyReserveRef\.current\)[\s\S]*commitEnemyCapital\(remainingReserve\)[\s\S]*startCapitalPilePreview\([\s\S]*applyGaugeCandidate/,
  'Cruel snapshots and commits its real reserve before resolving the held terminal candidate'
);
assert.match(
  battleModal,
  /万象資本化を中断[\s\S]*予備資金は残存/,
  'Stun consumes Omnicapitalization without spending the preserved enemy reserve'
);
assert.match(
  battleModal,
  /cancelEnemySupportTelegraph\(false\)/,
  'Stun uses the authored enemy-telegraph cancellation path'
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

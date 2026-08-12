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
  shouldUseCompactCapitalPresentation,
  shouldUseCompactTerminalPresentation,
} from '../src/utils/battlePresentation';
import {
  EARLY_NORMAL_ENCOUNTER_COUNT,
  isEarlyNormalEncounterPropertyId,
} from '../src/data/campaignEncounterData';
import {
  BATTLE_CANVAS_MAX_DPR,
  resolveBattleCanvasDpr,
} from '../src/utils/battleCanvasQuality';
import {
  BATTLE_CAPITAL_CANVAS_ROW_COUNTS,
  BATTLE_CAPITAL_RACK_TWEEN_MS,
  easeBattleCapitalRackDepth,
  resolveBattleCapitalCanvasLayout,
  resolveBattleCapitalRackOffset,
  resolveBattleCapitalVisualLayers,
} from '../src/utils/battleCapitalCanvasLayout';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readSource = (path: string) =>
  readFileSync(resolve(repositoryRoot, path), 'utf8');

const battleModal = readSource('src/components/BattleModal.tsx');
const app = readSource('src/App.tsx');
const appPage = readSource('app/page.tsx');
const battlePresentation = readSource('src/utils/battlePresentation.ts');
const battleCanvasQuality = readSource('src/utils/battleCanvasQuality.ts');
const battleCapitalCanvasLayout = readSource(
  'src/utils/battleCapitalCanvasLayout.ts'
);
const capitalCss = readSource('src/battle-capital-layer.css');
const balanceCss = readSource('src/battle-balance.css');
const battleCapitalCanvas = readSource(
  'src/components/BattleCapitalCanvas.tsx'
);
const battleCapitalCanvasCss = readSource(
  'src/components/BattleCapitalCanvas.css'
);
const finalWindCss = readSource('src/battle-final-wind.css');
const buyoutCss = readSource('src/battle-buyout.css');
const integratedCss = readSource('src/battle-integrated-field.css');
const launchIntro = readSource('src/components/LaunchIntro.tsx');
const header = readSource('src/components/Header.tsx');
const cartelAllianceView = readSource('src/components/CartelAllianceView.tsx');
const skillsSynergyView = readSource('src/components/SkillsSynergyView.tsx');
const gameBalance = readSource('src/utils/gameBalance.ts');
const battleSettlement = readSource('src/utils/battleSettlement.ts');
const helpText = readSource('src/data/helpText.ts');
const battleEncounterData = readSource('src/data/battleEncounterData.ts');
const campaignEncounterData = readSource('src/data/campaignEncounterData.ts');
const cruelBattle = readSource('src/utils/cruelBattle.ts');
const highEndRaidView = readSource('src/components/HighEndRaidView.tsx');
const highEndRaidCss = readSource('src/high-end-raids.css');
const marketView = readSource('src/components/MarketView.tsx');
const strengthComparison = readSource('src/components/StrengthComparison.tsx');
const strengthComparisonCss = readSource('src/strength-comparison.css');
const battleReadiness = readSource('src/utils/battleReadiness.ts');
const indexCss = readSource('src/index.css');
const saveData = readSource('src/utils/saveData.ts');
const battleSession = readSource('src/utils/battleSession.ts');
const phantomBattle = readSource('src/utils/phantomBattle.ts');
const cartel = readSource('src/utils/cartel.ts');
const audio = readSource('src/utils/audio.ts');
const fankitAssets = readSource('src/data/fankitAssets.ts');
const pagesWorkflow = readSource('.github/workflows/deploy-pages.yml');

const liveBattlefieldStart = battleModal.indexOf(
  '<main className="buyout-main">'
);
const liveBattlefieldEnd = battleModal.indexOf(
  '<footer className={`buyout-footer',
  liveBattlefieldStart
);
assert.ok(
  liveBattlefieldStart >= 0 && liveBattlefieldEnd > liveBattlefieldStart,
  'the live battle markup must remain discoverable for renderer regression checks'
);
const liveBattlefield = battleModal.slice(
  liveBattlefieldStart,
  liveBattlefieldEnd
);
const liveCapitalCanvasStart = liveBattlefield.indexOf(
  '<BattleCapitalCanvas'
);
const liveCapitalCanvasEnd = liveBattlefield.indexOf(
  '/>',
  liveCapitalCanvasStart
);
assert.ok(
  liveCapitalCanvasStart >= 0 && liveCapitalCanvasEnd > liveCapitalCanvasStart,
  'the live battle must mount the capital canvas'
);
const liveCapitalCanvas = liveBattlefield.slice(
  liveCapitalCanvasStart,
  liveCapitalCanvasEnd + 2
);

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
  launchIntro,
  /launch-intro__next[\s\S]{0,180}shrink-0[\s\S]{0,180}whitespace-nowrap/,
  'the portrait intro action must remain a single readable line'
);
assert.match(
  indexCss,
  /\.launch-intro__next[\s\S]{0,180}flex:\s*0 0 auto[\s\S]{0,180}white-space:\s*nowrap/,
  'intro CSS must prevent the next action from shrinking into two lines'
);
assert.match(
  indexCss,
  /@media \(max-width: 639px\)[\s\S]*?\.launch-intro__panel\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?animation-name:\s*launch-panel-mobile/,
  'the portrait intro panel must stay inside the viewport during its entrance'
);
assert.match(
  indexCss,
  /@keyframes launch-panel-mobile\s*\{[\s\S]*?translateY\(12px\)[\s\S]*?transform:\s*none/,
  'the portrait intro entrance must not translate the name field off-screen'
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
assert.equal(EARLY_NORMAL_ENCOUNTER_COUNT, 4);
for (const propertyId of [
  'prop_starter_farm',
  'prop_timber_ake',
  'prop_land_transport',
  'prop_brewery_beer',
]) {
  assert.equal(isEarlyNormalEncounterPropertyId(propertyId), true);
}
assert.equal(isEarlyNormalEncounterPropertyId('prop_iron_mine'), false);
assert.equal(
  shouldUseCompactCapitalPresentation({
    reducedMotion: false,
    isHighEndRaid: false,
    isEarlyNormalBattle: true,
  }),
  true
);
assert.equal(
  shouldUseCompactTerminalPresentation({
    reducedMotion: false,
    isEarlyNormalBattle: true,
  }),
  true
);
assert.match(
  campaignEncounterData,
  /CAMPAIGN_ENCOUNTER_DEFINITIONS\.slice\(0, EARLY_NORMAL_ENCOUNTER_COUNT\)/,
  'the compact opening boundary must follow authored encounter order'
);
assert.match(
  battleModal,
  /const isEarlyNormalBattle =[\s\S]{0,220}!isTraining[\s\S]{0,220}!isHighEndRaid[\s\S]{0,220}!isExtremeBattle[\s\S]{0,220}isEarlyNormalEncounterPropertyId\(targetProperty\.id\)/,
  'only first-clear normal encounters may use the accelerated presentation'
);
assert.match(
  battleModal,
  /applyNormalClosingMomentum\(\{[\s\S]{0,240}acceleratedEarlyNormal: isEarlyNormalBattle/,
  'the live gauge loop must opt into the player-only early closeout helper'
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
assert.equal(
  BATTLE_CAPITAL_CANVAS_ROW_COUNTS.reduce((sum, count) => sum + count, 0),
  22,
  'the Canvas2D coin formation must retain exactly twenty-two columns per side'
);
assert.match(
  battleCapitalCanvas,
  /import casinoWideUrl from '\.\.\/assets\/battle\/battlefield-casino-wide\.webp';[\s\S]*import casinoMobileUrl from '\.\.\/assets\/battle\/battlefield-casino-mobile\.webp';[\s\S]*import '\.\/BattleCapitalCanvas\.css';/,
  'the Canvas2D renderer must own both approved responsive backdrops and its non-interactive surface CSS'
);
assert.match(
  battleCapitalCanvas,
  /const sourceHeights =\s*preview\?\.columnHeights \?\? getCapitalColumnHeights\(visibleUnits\);[\s\S]{0,260}sourceHeights\[index\] \?\? 0/,
  'the Canvas2D rack must consume the renderer-neutral staged column heights'
);
assert.match(
  battleCapitalCanvas,
  /const overflowTier = Math\.round\([\s\S]{0,120}Math\.max\([\s\S]{0,160}preview\?\.overflowTier \?\?[\s\S]{0,120}getBattleCapitalOverflowTier\(amount, marketPrice\)[\s\S]{0,100}state\.rackFloorTier \?\? 0/,
  'the Canvas2D rack must retain the deepest preview or battle-lifetime overflow footing'
);
assert.match(
  battleCapitalCanvas,
  /rackCompressed:\s*state\.rackLowered === true \|\| preview\?\.rackCompressed === true/,
  'the Canvas2D rack must retain a latched descent after its active preview ends'
);
assert.match(
  battleCapitalCanvas,
  /const layout = resolveBattleCapitalCanvasLayout\(width, height\);[\s\S]*for \(const \[index, column\] of layout\.columns\.entries\(\)\)[\s\S]*drawCoinColumn\([\s\S]*activeColumns\.has\(index\)/,
  'the Canvas2D renderer must paint the responsive twenty-two-column tray from the staged frame'
);
assert.equal(
  (battleCapitalCanvas.match(/<canvas\b/g) ?? []).length,
  1,
  'the capital renderer must own one canvas and no auxiliary canvas layers'
);
assert.match(
  battleCapitalCanvas,
  /getContext\('2d',\s*\{\s*alpha:\s*false,\s*desynchronized:\s*true,?\s*\}\)/,
  'the capital renderer must request one opaque Canvas2D surface'
);
assert.match(
  battleCapitalCanvas,
  /<canvas[\s\S]{0,260}data-renderer="canvas2d-snapshot"[\s\S]{0,120}aria-hidden="true"/,
  'the decorative canvas must stay hidden from assistive technology'
);
assert.match(
  battleCapitalCanvasCss,
  /\.battle-capital-canvas\s*\{[\s\S]*background:\s*#02070c;[\s\S]*pointer-events:\s*none;/,
  'the opaque capital canvas must never intercept battle controls'
);
assert.match(
  battleCapitalCanvas,
  /createBattleCapitalCanvasScene[\s\S]*player:\s*normalizeSide\('player', player\),[\s\S]*enemy:\s*normalizeSide\('enemy', enemy\),/,
  'player and enemy capital must be normalized into the same canvas scene'
);
assert.match(
  battleCapitalCanvas,
  /drawCapitalSide\(context, width, height, scene\.player\);[\s\S]*drawCapitalSide\(context, width, height, scene\.enemy\);/,
  'one opaque frame must paint both armies from the same scene snapshot'
);
assert.equal(
  (liveBattlefield.match(/<BattleCapitalCanvas\b/g) ?? []).length,
  1,
  'the live arena must mount exactly one shared capital canvas'
);
assert.match(
  liveBattlefield,
  /integrated-battlefield--canvas2d/,
  'the live arena must opt into the Canvas2D consolidation layer'
);
assert.match(
  liveBattlefield,
  /data-capital-renderer="canvas2d"/,
  'the live arena must expose its active renderer for runtime QA'
);
assert.match(
  liveCapitalCanvas,
  /player=\{\{[\s\S]*amount:\s*displayedPlayerInvested,[\s\S]*previewFrame:\s*capitalPreviewStage \?\? playerCapitalPilePreviewStage,[\s\S]*rackLowered:\s*playerCapitalRackLowered,[\s\S]*rackFloorTier:\s*playerCapitalRackFloorTier,[\s\S]*enemy=\{\{[\s\S]*amount:\s*displayedEnemyInvested,[\s\S]*previewFrame:\s*enemyCapitalPilePreviewStage,[\s\S]*rackLowered:\s*enemyCapitalRackLowered,[\s\S]*rackFloorTier:\s*enemyCapitalRackFloorTier,/,
  'both live capital ledgers and their latched rack state must feed the shared canvas'
);
assert.match(
  liveCapitalCanvas,
  /ownershipPercent=\{displayedOwnership\}[\s\S]*pressureDirection=\{battleDirection\}[\s\S]*windSide=\{[\s\S]*difficulty=\{[\s\S]*compact=\{isHighEndRaid\}[\s\S]*frameRate=\{battleFrameRate\}/,
  'the shared canvas must receive the live ownership, pressure, wind, difficulty, compact and frame-rate state'
);
assert.doesNotMatch(
  liveBattlefield,
  /<GilTower\b|<GilPileVisual\b|className="(?:gil-column-field|capital-fixed-column)"|className="(?:battlefield-territory|battlefield-pressure-lane|battle-commerce-flow)"/,
  'the live arena must not mount the retired forty-four column or ambient DOM renderer'
);
assert.match(
  capitalCss,
  /\.integrated-battlefield--canvas2d::after,[\s\S]*\.battlefield-territory,[\s\S]*\.battlefield-pressure-lane,[\s\S]*\.battle-commerce-flow\s*\{[\s\S]*display:\s*none !important;[\s\S]*animation:\s*none !important;[\s\S]*filter:\s*none !important;/,
  'the Canvas2D arena must keep legacy ambient fallback layers disabled'
);
assert.match(
  capitalCss,
  /\.integrated-battlefield--canvas2d[\s\S]{0,180}\.player-capital-stack \.capital-visual-row,[\s\S]{0,180}\.enemy-capital-stack \.capital-visual-row[\s\S]{0,120}::before,[\s\S]{0,260}::after\s*\{[\s\S]{0,180}display:\s*none !important;[\s\S]{0,120}animation:\s*none !important;/,
  'the retired capital-row aura pseudos must not repaint over the canvas'
);
assert.match(
  capitalCss,
  /\.integrated-battlefield--canvas2d \.ownership-track\s*\{[\s\S]{0,80}opacity:\s*1;[\s\S]{0,160}\}[\s\S]{0,100}\.integrated-battlefield--canvas2d \.capital-clash/,
  'the semantic ownership gauge must remain visibly mounted above the consolidated canvas'
);
assert.doesNotMatch(
  capitalCss,
  /\.integrated-battlefield--canvas2d \.ownership-track[^,{]*\{[^}]*(?:animation|filter|transition):\s*none !important;/,
  'the Canvas2D override must not flatten the gauge flow, glow or interpolation again'
);
assert.doesNotMatch(
  capitalCss,
  /\.integrated-battlefield--canvas2d \.ownership-track \*/,
  'the Canvas2D override must not blanket-disable the gauge descendants again'
);
assert.match(
  balanceCss,
  /\.ownership-track\s*\{[\s\S]{0,260}animation:\s*enemy-bid-flow[\s\S]*\.ownership-track__player\s*\{[\s\S]{0,240}animation:\s*player-bid-flow[\s\S]*\.ownership-track__player::after,[\s\S]*animation:\s*bid-shimmer[\s\S]*\.ownership-track__tension\s*\{[\s\S]*animation:\s*tension-breathe[\s\S]*\.ownership-track__marker > i\s*\{[\s\S]*animation:\s*ownership-spark[\s\S]*knot-pull-player[\s\S]*knot-pull-enemy[\s\S]*track-impact/,
  'the ownership gauge must retain moving bids, shimmer, tension, sparks, directional pull and impact feedback'
);
assert.match(
  capitalCss,
  /\.integrated-battlefield \.ownership-track__player,[\s\S]{0,100}\.ownership-track__enemy-flow\s*\{[\s\S]{0,180}transition:\s*transform var\(--battle-gauge-interpolation, 110ms\) linear;[\s\S]*\.ownership-track__tension,[\s\S]{0,100}\.ownership-track__marker\s*\{[\s\S]{0,180}transition:\s*left var\(--battle-gauge-interpolation, 110ms\) linear;/,
  'the rich gauge must still bridge every logical ownership update smoothly'
);
assert.match(
  capitalCss,
  /\.integrated-battlefield--canvas2d \.capital-clash,[\s\S]{0,100}\.integrated-battlefield--canvas2d \.capital-vs\s*\{[\s\S]{0,80}visibility:\s*hidden;/,
  'the retired DOM clash marker must stay hidden behind the canvas-owned VS marker'
);
assert.match(
  battleCapitalCanvas,
  /const frontX = width \* \(scene\.ownershipPercent \/ 100\);[\s\S]{0,900}const frontlineWidth = clamp\(width \* 0\.026, 7, 18\);[\s\S]{0,900}context\.fillRect\(frontX - frontlineWidth, 0, frontlineWidth \* 2, height\);[\s\S]{0,300}context\.lineTo\(frontX, height \* 0\.91\);/,
  'the static canvas backdrop must turn ownership into strong territory colour and a full-height frontline'
);
assert.match(
  battleCapitalCanvas,
  /if \(scene\.pressureDirection !== 'even'\) \{[\s\S]{0,500}for \(let row = 0; row < 5; row \+= 1\)[\s\S]{0,180}for \(let step = 1; step <= 3; step \+= 1\)[\s\S]{0,420}context\.lineTo\(tipX, y\);/,
  'the canvas battlefield must show a bounded directional chevron field when either side is pushing'
);
assert.doesNotMatch(
  battleCapitalCanvas,
  /drawOwnershipTrack/,
  'the Canvas painter must not duplicate the richer semantic DOM gauge'
);
const portraitCapitalLayout = resolveBattleCapitalCanvasLayout(402, 414);
const landscapeCapitalLayout = resolveBattleCapitalCanvasLayout(874, 171);
assert.equal(portraitCapitalLayout.columns.length, 22);
assert.equal(landscapeCapitalLayout.columns.length, 22);
for (const [label, layout, maxGapRatio] of [
  ['portrait', portraitCapitalLayout, 0.15],
  ['landscape', landscapeCapitalLayout, 0.09],
] as const) {
  const widestGapRatio = Math.max(
    ...layout.columns.map((column) =>
      Math.max(0, column.pitch - column.coinWidth) / column.pitch
    )
  );
  assert.ok(
    widestGapRatio <= maxGapRatio,
    `${label} coin rows must stay dense instead of widening their empty gaps`
  );
}
assert.ok(
  portraitCapitalLayout.columns.every((column) => column.coinWidth >= 24),
  'portrait coins must remain large enough to read as decorated rolls'
);
assert.ok(
  landscapeCapitalLayout.columns.every((column) => column.coinWidth >= 47),
  'landscape coins must grow with the tray instead of staying at the retired 17px cap'
);
assert.ok(
  resolveBattleCapitalVisualLayers({
    layers: 12,
    depth: 0,
    maxRawLayers: 12,
    variation: 1,
  }) >
    resolveBattleCapitalVisualLayers({
      layers: 12,
      depth: 3,
      maxRawLayers: 12,
      variation: 1,
    }),
  'medium capital must keep a broad stepped treasury tray'
);
for (let depth = 0; depth < 4; depth += 1) {
  assert.equal(
    resolveBattleCapitalVisualLayers({
      layers: 36,
      depth,
      maxRawLayers: 36,
      variation: 0.94,
    }),
    36,
    'a saturated tray must become a level wall instead of retaining a short front row'
  );
}
assert.ok(
  resolveBattleCapitalRackOffset(414, false, 4) >= 60,
  'portrait overflow tier three must lower the rack by the original screen-scale distance'
);
assert.ok(
  resolveBattleCapitalRackOffset(171, true, 4) >= 45,
  'landscape overflow tier three must visibly scroll the rack beyond the short field'
);
assert.equal(BATTLE_CAPITAL_RACK_TWEEN_MS, 280);
assert.equal(easeBattleCapitalRackDepth(0, 4, 0), 0);
assert.equal(easeBattleCapitalRackDepth(0, 4, BATTLE_CAPITAL_RACK_TWEEN_MS), 4);
assert.match(
  battleCapitalCanvasLayout,
  /const span = ROW_SPANS\[depth\] \* \(landscape \? 0\.84 : 1\);[\s\S]{0,240}const coinWidth = clamp\(pitch \* \(landscape \? 0\.92 : 0\.86\), 12, 72\);/,
  'coin width must follow each row pitch in both orientations'
);
assert.match(
  battleCapitalCanvas,
  /context\.ellipse\(\s*centerX,\s*baseY \+ rackHeight \* 0\.34,[\s\S]{0,500}context\.ellipse\(\s*centerX,\s*baseY,\s*rackWidth \* 0\.49/,
  'each side must retain a broad two-tier treasury pedestal under its separate coin rolls'
);
assert.match(
  battleCapitalCanvas,
  /const seamCount = Math\.min\(15, Math\.max\(0, layers - 1\)\);/,
  'coin columns must retain enough visible seams to read as stacks rather than flat bars'
);
assert.match(
  battleCapitalCanvas,
  /context\.ellipse\(\s*x,\s*topY - coinHeight \* 0\.04,\s*width \* 0\.29,[\s\S]{0,220}context\.stroke\(\);\s*context\.fillStyle = 'rgba\(255, 249, 202, \.9\)'/,
  'coin columns must retain readable layer seams, embossed rims and specular highlights'
);
assert.match(
  battleCapitalCanvas,
  /enemy:\s*\{[\s\S]{0,180}glow:\s*'rgba\(255, 61, 101, \.28\)'[\s\S]{0,120}coinLight:\s*'#ffc2b8'[\s\S]{0,120}coinMid:\s*'#dc3d49'/,
  'enemy coins must stay visually distinct from the player gold without losing their metallic highlights'
);

assert.match(
  battleCapitalCanvas,
  /frameRate\?:\s*30 \| 60;/,
  'the capital canvas cadence must be restricted to the supported 30/60fps modes'
);
assert.match(
  battleCapitalCanvas,
  /const hasPackets = \(\['player', 'enemy'\] as const\)\.some\([\s\S]*activeColumnIndices\.length > 0[\s\S]*const intervalMs = 1_000 \/ frameRate;/,
  'the renderer must derive its 30/60fps loop only from bounded visual work'
);
assert.match(
  battleCapitalCanvas,
  /const packetKey = getCapitalPacketAnimationKey\(scene\[side\]\);[\s\S]{0,160}packetClockRef\.current\[side\] = \{[\s\S]{0,100}startedAt: effectStartedAt[\s\S]*packetProgress:[\s\S]{0,260}\(now - packetClockRef\.current\[side\.side\]\.startedAt\) \/[\s\S]{0,80}side\.frame\.beatDurationMs/,
  'each bounded packet must retain its keyed start clock and interpolate against its renderer-neutral frame duration'
);
assert.match(
  battleCapitalCanvas,
  /const packetLayers =\s*6 \+ Math\.abs\(side\.frame\.packetSeed \+ index \* 3\) % 7;[\s\S]{0,220}side\.frame\.packetProgress - Math\.max\(0, packetOrder\) \* 0\.025/,
  'each active Canvas2D column must receive one deterministic six-to-twelve-layer staggered packet'
);
assert.match(
  battleCapitalCanvas,
  /const rackClockRef = useRef<[\s\S]*CapitalRackClock[\s\S]*fromDepth:\s*0[\s\S]*targetDepth:\s*0[\s\S]*const hasRackMotion = [\s\S]*readRackDepth\(clock, effectStartedAt\) < clock\.targetDepth - 0\.001/,
  'each rack must keep one bounded 280ms descent clock without changing battle state'
);
assert.match(
  battleCapitalCanvas,
  /const resume = \(\) => \{[\s\S]*if \(disposed \|\| document\.hidden \|\| animationFrame\) return;[\s\S]*if \(\(hasPackets \|\| hasRackMotion\) && !reducedMotion\) \{\s*animationFrame = requestAnimationFrame\(tick\);\s*\} else \{\s*repaint\(project\(performance\.now\(\)\)\);\s*\}/,
  'an idle or reduced-motion canvas must repaint once without starting an animation loop'
);
assert.match(
  battleCapitalCanvas,
  /if \(complete\) return;\s*\}[\s\S]{0,100}animationFrame = requestAnimationFrame\(tick\);/,
  'the active packet loop must stop scheduling frames as soon as both sides settle'
);
assert.equal(
  (battleCapitalCanvas.match(/requestAnimationFrame\(tick\)/g) ?? []).length,
  2,
  'capital Canvas2D must schedule frames only when starting or continuing an active packet'
);
assert.match(
  battleCapitalCanvas,
  /const handleVisibility = \(\) => \{\s*if \(document\.hidden\) \{\s*if \(animationFrame\) cancelAnimationFrame\(animationFrame\);\s*animationFrame = 0;\s*return;\s*\}\s*resume\(\);\s*\};/,
  'backgrounding must stop and foregrounding must resume only the renderer-owned frame'
);
assert.match(
  battleCapitalCanvas,
  /document\.addEventListener\('visibilitychange', handleVisibility\);[\s\S]{0,220}disposed = true;[\s\S]{0,120}cancelAnimationFrame\(animationFrame\);[\s\S]{0,120}document\.removeEventListener\('visibilitychange', handleVisibility\);/,
  'unmount and StrictMode replay must cancel the renderer frame and visibility listener'
);
assert.match(
  battleCapitalCanvas,
  /const BATTLE_BACKDROP_SOURCES:[\s\S]{0,160}wide: casinoWideUrl,[\s\S]{0,80}mobile: casinoMobileUrl[\s\S]{0,180}const battleBackdropCache = new Map[\s\S]{0,160}const battleBackdropLoads = new Map[\s\S]*const ensureResponsiveBackdrop = useCallback\([\s\S]{0,180}const kind: BattleBackdropKind = width <= 620 \? 'mobile' : 'wide';[\s\S]{0,160}loadBattleBackdrop\(kind\)[\s\S]{0,180}backgroundsRef\.current\[kind\] = image;[\s\S]{0,80}repaint\(\);/,
  'the responsive casino backdrop must cache and decode only the currently required width variant before repainting'
);
assert.match(
  battleCapitalCanvas,
  /const handleResize = \(\) => \{[\s\S]{0,120}ensureResponsiveBackdrop\(canvas\.getBoundingClientRect\(\)\.width\);[\s\S]{0,80}repaint\(\);[\s\S]{0,100}if \(typeof ResizeObserver !== 'undefined'\) \{[\s\S]{0,120}const observer = new ResizeObserver\(handleResize\);[\s\S]{0,80}observer\.observe\(canvas\);[\s\S]{0,80}return \(\) => observer\.disconnect\(\);[\s\S]{0,180}window\.addEventListener\('resize', handleResize, \{ passive: true \}\);[\s\S]{0,120}window\.removeEventListener\('resize', handleResize\);/,
  'orientation and layout changes must repaint once and release either resize observer path'
);
assert.doesNotMatch(
  battleCapitalCanvas,
  /setInterval\(|setTimeout\(|simulationPaused|setBattlePhase|setOwnership/,
  'the visibility-aware renderer must not own or pause battle progression state'
);

const paintCapitalCanvasStart = battleCapitalCanvas.indexOf(
  'export const paintBattleCapitalCanvas'
);
const paintCapitalCanvasEnd = battleCapitalCanvas.indexOf(
  'export const BattleCapitalCanvas =',
  paintCapitalCanvasStart
);
assert.ok(
  paintCapitalCanvasStart >= 0 && paintCapitalCanvasEnd > paintCapitalCanvasStart,
  'the pure Canvas2D painter must remain discoverable for DPR checks'
);
const paintCapitalCanvas = battleCapitalCanvas.slice(
  paintCapitalCanvasStart,
  paintCapitalCanvasEnd
);
assert.match(
  paintCapitalCanvas,
  /const nativeDpr =\s*typeof window === 'undefined' \? 1 : window\.devicePixelRatio \|\| 1;[\s\S]*const requestedDpr = Number\.isFinite\(devicePixelRatio\)[\s\S]*:\s*nativeDpr;[\s\S]*resolveBattleCanvasDpr\(\{ requestedDpr, frameRate \}\)/,
  'the production canvas must send native or test DPR through the frame-rate quality policy'
);
assert.match(
  battleCanvasQuality,
  /BATTLE_CANVAS_MAX_DPR = \{[\s\S]*30:\s*1\.5[\s\S]*60:\s*2[\s\S]*Math\.min\(normalizedDpr, BATTLE_CANVAS_MAX_DPR\[frameRate\]\)/,
  '30fps must cap Canvas2D at DPR 1.5 and 60fps at DPR 2 without changing CSS size'
);
assert.deepEqual(BATTLE_CANVAS_MAX_DPR, { 30: 1.5, 60: 2 });
assert.equal(resolveBattleCanvasDpr({ requestedDpr: 3, frameRate: 30 }), 1.5);
assert.equal(resolveBattleCanvasDpr({ requestedDpr: 3, frameRate: 60 }), 2);
assert.equal(resolveBattleCanvasDpr({ requestedDpr: 1.25, frameRate: 30 }), 1.25);
assert.equal(resolveBattleCanvasDpr({ requestedDpr: Number.NaN, frameRate: 30 }), 1);

const canvasZIndex = Number(
  battleCapitalCanvasCss.match(
    /\.battle-capital-canvas\s*\{[\s\S]*?z-index:\s*(-?\d+);/
  )?.[1]
);
const actorZIndex = Number(
  capitalCss.match(
    /\.integrated-battlefield \.capital-visual-row \.ownership-fighter\s*\{[\s\S]*?z-index:\s*(-?\d+);/
  )?.[1]
);
const investedReadoutZIndex = Number(
  integratedCss.match(
    /\.integrated-battlefield \.ownership-capital-readout\s*\{[\s\S]*?z-index:\s*(-?\d+);/
  )?.[1]
);
assert.ok(
  Number.isFinite(canvasZIndex) &&
    Number.isFinite(actorZIndex) &&
    canvasZIndex < actorZIndex,
  'the capital canvas must remain behind the interactive battle actors'
);
assert.ok(
  Number.isFinite(investedReadoutZIndex) &&
    canvasZIndex < investedReadoutZIndex &&
    investedReadoutZIndex > actorZIndex,
  'invested totals must stay readable above both coins and landscape actors'
);

assert.equal(
  (liveBattlefield.match(/className="battle-capital-canvas-a11y"/g) ?? [])
    .length,
  2,
  'both Canvas2D armies must retain semantic capital descriptions'
);
assert.match(
  liveBattlefield,
  /className="battle-capital-canvas-a11y"[\s\S]{0,100}role="img"[\s\S]{0,180}displayedPlayerInvested[\s\S]{0,100}cash/,
  'the player canvas pile must retain its invested and reserve accessibility readout'
);
assert.match(
  liveBattlefield,
  /className="battle-capital-canvas-a11y"[\s\S]{0,100}role="img"[\s\S]{0,180}displayedEnemyInvested/,
  'the enemy canvas pile must retain its invested-capital accessibility readout'
);
assert.match(
  liveBattlefield,
  /className=\{`ownership-track[\s\S]{0,240}role="progressbar"[\s\S]{0,220}aria-valuenow=\{Number\(displayedOwnership\.toFixed\(1\)\)\}/,
  'the canvas ownership track must keep its DOM progressbar semantics'
);
assert.doesNotMatch(
  liveBattlefield,
  /className=(?:"|\{`)(?:player-budget-overlay|enemy-budget-overlay|capital-effective-detail|capital-source-bar|enemy-reserve-bar)/,
  'budget, regeneration, source and reserve overlays must not cover the live coin battlefield'
);
assert.match(
  liveBattlefield,
  /className="ownership-capital-readout"[\s\S]{0,80}role="group"[\s\S]{0,220}aria-label=\{`[^`]*displayedPlayerInvested[^`]*displayedEnemyInvested[^`]*`\}/,
  'the gauge must visibly restore both packet-synchronized invested totals without restoring budget noise'
);
const investedReadoutStart = liveBattlefield.indexOf(
  'className="ownership-capital-readout"'
);
const investedReadoutEnd = liveBattlefield.indexOf(
  '{windVisible && !conditionAnnouncement',
  investedReadoutStart
);
const investedReadout = liveBattlefield.slice(
  investedReadoutStart,
  investedReadoutEnd
);
assert.match(
  investedReadout,
  /<small>自社投入<\/small>[\s\S]*displayedPlayerInvested[\s\S]*<span>CAPITAL<\/span>[\s\S]*<small>競合投入<\/small>[\s\S]*displayedEnemyInvested/,
  'the restored row must label the player and rival totals directly below the gauge'
);
assert.match(
  integratedCss,
  /\.integrated-battlefield \.ownership-capital-readout\s*\{[\s\S]{0,220}z-index:\s*30;[\s\S]{0,220}display:\s*grid;[\s\S]{0,180}grid-template-columns:\s*minmax\(0, 1fr\) 4\.6rem minmax\(0, 1fr\);/,
  'the restored invested totals must stay aligned immediately below the ownership gauge'
);
assert.match(
  capitalCss,
  /@media \(orientation: landscape\) and \(max-width: 950px\) and \(max-height: 500px\)[\s\S]*ownership-capital-readout > strong:first-child[\s\S]{0,100}padding-left:\s*clamp\(5\.4rem, 12vw, 7rem\);[\s\S]*ownership-capital-readout > strong:last-child[\s\S]{0,100}padding-right:\s*clamp\(5\.4rem, 12vw, 7rem\);/,
  'landscape invested totals must clear both edge actors while staying under the gauge'
);
assert.doesNotMatch(
  liveBattlefield,
  /商流から回復中|商流回復は上限/,
  'commercial-regeneration status copy must stay out of the live battlefield'
);
assert.match(
  battleModal,
  /const timeline = buildCapitalStackTimeline\(\{[\s\S]*intensity,[\s\S]*seed: serial/,
  'every live funding wave must consume the renderer-neutral capital timeline'
);
assert.doesNotMatch(
  battleModal,
  /className="capital-overflow-stamp"/,
  'thin overflow ellipses must not compete with the Canvas2D capital bundles'
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
const actionStripStart = battleModal.indexOf(
  'className="battle-action-strip"'
);
const limitBreakActionStart = battleModal.indexOf(
  '{limitBreakCapacityTier > 0 && (',
  actionStripStart
);
const synergyActionStart = battleModal.indexOf(
  '{selectedBattleSynergy && (',
  limitBreakActionStart
);
const skillSelectionActionStart = battleModal.indexOf(
  '{primarySkill && (',
  synergyActionStart
);
const networkActionStart = battleModal.indexOf(
  '{hasNetworkSupport && (',
  skillSelectionActionStart
);
const actionStripEnd = battleModal.indexOf('</section>', networkActionStart);
assert.ok(
  actionStripStart >= 0 &&
    limitBreakActionStart > actionStripStart &&
    synergyActionStart > limitBreakActionStart &&
    skillSelectionActionStart > synergyActionStart &&
    networkActionStart > skillSelectionActionStart &&
    actionStripEnd > networkActionStart,
  'the visible action-strip blocks must remain discoverable in their reviewed order'
);
const limitBreakAction = battleModal.slice(
  limitBreakActionStart,
  synergyActionStart
);
const synergyAction = battleModal.slice(
  synergyActionStart,
  skillSelectionActionStart
);
const networkAction = battleModal.slice(networkActionStart, actionStripEnd);
assert.match(
  battleModal,
  /const networkSupportSummary = battleSubs\.length > 0[\s\S]{0,760}`人脈 残り\$\{limitedNetworkSupportRemaining\}回\$\{alliance\.active && !allianceUsed \? '／外部協力 1回' : ''\}`/,
  'finite high-end relationship support must be summarized as an explicit remaining-use count'
);
assert.match(
  networkAction,
  /limitedNetworkSupportRemaining !== null[\s\S]{0,160}`残\$\{limitedNetworkSupportRemaining\}回\$\{alliance\.active && !allianceUsed \? '＋協力' : ''\}`/,
  'the compact high-end network action must show its remaining uses without opening the drawer'
);
assert.match(
  battleModal,
  /className=\{`investment-execute-button[\s\S]{0,600}aria-label=\{`投資実行。[\s\S]{0,180}現在の手元資金\$\{formatCurrency\(cash\)\}`\}/,
  'the investment execute button must announce both the selected investment and current cash'
);
assert.match(
  battleModal,
  /<small>\{!maxAffordableConfig[\s\S]{0,180}`手元\$\{formatCurrency\(cash\)\.replace\(' ギル', ''\)\}｜資金不足`[\s\S]{0,120}: `投入\$\{formatCurrency\(selectedCost\)\.replace\(' ギル', ''\)\}｜手元\$\{formatCurrency\(cash\)\.replace\(' ギル', ''\)\}`\}<\/small>/,
  'the visible investment execute button must carry the selected amount and uninvested cash even while recharging'
);
assert.match(
  battleModal,
  /const actionsLocked =[\s\S]{0,320}limitImpactActive/,
  'the LIMIT BREAK impact cut-in must lock every executable action'
);
assert.match(
  limitBreakAction,
  /^\{limitBreakCapacityTier > 0 && \([\s\S]*aria-label=\{actionsLocked[\s\S]{0,180}演出中のため発動できません[\s\S]{0,180}: limitedLimitBreakSpent[\s\S]{0,180}使用済み[\s\S]{0,240}発動可能/,
  'LIMIT BREAK must stay visible and announce the cut-in lock before spent or available state'
);
assert.match(
  limitBreakAction,
  /<b>\{actionsLocked \? 'LB 演出中' : limitedLimitBreakSpent[\s\S]{0,120}<small>\{actionsLocked[\s\S]{0,120}: limitedLimitBreakSpent[\s\S]*<em>\{actionsLocked[\s\S]{0,120}: limitedLimitBreakSpent/,
  'the visible LIMIT BREAK title, detail and badge must all prioritize the cut-in lock'
);
assert.match(
  synergyAction,
  /^\{selectedBattleSynergy && \([\s\S]*disabled=\{[\s\S]{0,180}actionsLocked[\s\S]{0,180}aria-label=\{`\$\{selectedBattleSynergy\.name\}（SYNERGY）[\s\S]{0,240}\$\{actionsLocked \? '演出中のため発動できません'/,
  'SYNERGY must stay visible, disabled and labelled as presentation-locked during the cut-in'
);
assert.match(
  networkAction,
  /^\{hasNetworkSupport && \([\s\S]*disabled=\{[\s\S]{0,140}actionsLocked[\s\S]{0,240}aria-label=\{`人脈\$\{limitedNetworkSupportRemaining !== null \? `、残り\$\{limitedNetworkSupportRemaining\}回` : ''\}。\$\{\s*actionsLocked\s*\? '演出中のため要請できません'/,
  'network support must stay visible, disabled and labelled as presentation-locked during the cut-in'
);
assert.match(
  battleModal,
  /aria-label=\{actionsLocked[\s\S]{0,160}演出中のため発動できません[\s\S]{0,180}: limitedLimitBreakSpent[\s\S]{0,180}: `LIMIT BREAK \$\{limitBreakTier > 0 \? `\$\{limitBreakTier\}発動可能`/,
  'LIMIT BREAK accessibility text must announce the presentation lock before spent or available-state messages'
);
assert.match(
  battleModal,
  /aria-label=\{`\$\{selectedBattleSynergy\.name\}（SYNERGY）[\s\S]{0,180}\$\{actionsLocked \? '演出中のため発動できません' : battleSynergyReady \? '選択中の事業連携を発動'/,
  'SYNERGY accessibility text must announce the presentation lock before an available-state message'
);
assert.match(
  battleModal,
  /aria-label=\{`人脈\$\{limitedNetworkSupportRemaining !== null \? `、残り\$\{limitedNetworkSupportRemaining\}回` : ''\}。\$\{\s*actionsLocked\s*\? '演出中のため要請できません'[\s\S]{0,160}: commandReady[\s\S]{0,180}'利用可能な支援へ即時要請可能'/,
  'network accessibility text must announce the presentation lock before an available-state message'
);
assert.match(
  battleModal,
  /disabled=\{skillSelectionLocked\}/,
  'ability selection must remain independently available while action execution is locked'
);
assert.match(
  battleModal,
  /const hasNetworkSupport = battleSubs\.length > 0 \|\| alliance\.active;[\s\S]*\{hasNetworkSupport && \([\s\S]*aria-label=\{`人脈\$\{limitedNetworkSupportRemaining !== null/,
  'the support drawer must stay absent until the player has a relationship or an alliance request'
);
assert.match(
  battleModal,
  /aria-label="現在使用できる商戦アクション"/,
  'the dynamic action strip must not announce locked features that are not rendered yet'
);
assert.match(
  battleModal,
  /disabled=\{[\s\S]{0,120}!hasAvailableNetworkSupport[\s\S]{0,420}今回使える支援はありません/,
  'an exhausted alliance-only drawer must remain visible as state but cannot open an empty action panel'
);
assert.match(
  battleModal,
  /const networkSupportLimit =[\s\S]{0,650}canRequestLimitedNetworkSupport\(networkRequestCount, networkSupportLimit\)/,
  'Savage and Ultimate must expose finite battle-local relationship-support budgets'
);
assert.match(
  battleModal,
  /disabled=\{!commandReady \|\| actionsLocked \|\| limitedNetworkSupportExhausted\}/,
  'limited high-difficulty relationship companies must stop accepting requests after the visible budget is spent'
);
assert.match(
  battleModal,
  /const limitedLimitBreakSpent =\s*isUltimate && limitBreakUseCount >= ULTIMATE_LIMIT_BREAK_LIMIT/,
  'only Ultimate must treat Limit Break as a battle-local finite decision'
);
assert.doesNotMatch(
  battleModal,
  /SAVAGE_LIMIT_BREAK_LIMIT|limitedLimitBreakSpent = isSavage/,
  'Savage must allow Limit Break again after the gauge is recharged'
);
assert.match(
  battleModal,
  /<em>\{actionsLocked[\s\S]{0,120}: limitedLimitBreakSpent[\s\S]{0,120}\? '使用済み'[\s\S]{0,220}\? '発動可'/,
  'the Limit Break badge must prioritize the active presentation lock, then report a spent high-difficulty use'
);
assert.match(
  battleModal,
  /panel !== 'capital'[\s\S]{0,180}title: '人脈を選択中'[\s\S]{0,160}閉じて商戦へ戻ります/,
  'the command state must explain that an open relationship drawer intentionally pauses selection'
);
assert.match(
  battleModal,
  /disabled=\{!commandReady \|\| limitBreakTier === 0 \|\| actionsLocked \|\| limitedLimitBreakSpent\}/,
  'a spent high-difficulty Limit Break must not become actionable again after recharging'
);
assert.match(
  battleModal,
  /ultimateAppraisalRemainingMsRef\.current -[\s\S]{0,220}BATTLE_STATE_UPDATE_INTERVAL_MS \* timeScale[\s\S]{0,900}ULTIMATE_APPRAISAL_EXPIRED/,
  'Ultimate must end the passive-recovery stalemate at its visible appraisal deadline'
);
assert.match(
  battleModal,
  /終極査定 \{Math\.ceil\(ultimateAppraisalRemainingMs \/ 1000\)\}秒/,
  'Ultimate must keep its appraisal countdown visible during battle'
);
assert.match(
  battleModal,
  /絶は108秒の終極査定。[\s\S]{0,180}敵予告・着弾演出中[\s\S]{0,160}停止[\s\S]{0,220}ボタン1回[\s\S]{0,180}8回/,
  'Ultimate briefing must explain the fair pause rule and the finite resource plan'
);
assert.match(
  battleModal,
  /briefing-ultimate-loadout[\s\S]{0,420}開幕AUTOパッセ[\s\S]{0,180}瀕死AUTOリビングデッド[\s\S]{0,180}手動ぶんどる[\s\S]{0,180}LB III/,
  'Ultimate briefing must compare the current build with one stable prepared route'
);
assert.match(
  battleModal,
  /briefing-ultimate-pattern[\s\S]{0,220}今回の敵手順[\s\S]{0,220}counterPlan[\s\S]{0,180}開始直後に空撃ちせず[\s\S]{0,120}危険予告/,
  'Ultimate must disclose the selected attempt pattern and its counter before battle'
);
assert.match(
  battleModal,
  /playerBlackestNightUnusedOwnershipAtFadeRef = useRef\(0\)/,
  'Ultimate loss telemetry must retain unused player Blackest Night capacity'
);
assert.match(
  battleModal,
  /const startBattle = \(\) => \{[\s\S]{0,900}playerBlackestNightUnusedOwnershipAtFadeRef\.current = 0/,
  'Ultimate loss telemetry must reset at the start of every attempt'
);
assert.match(
  battleModal,
  /const releaseBlackestNight = \([\s\S]{0,600}if \(isPlayer && !broke && capacityRef\.current > 0\)[\s\S]{0,420}capacityRef\.current \/ 2/,
  'Ultimate loss telemetry must capture unused player Blackest Night capacity on fade'
);
assert.match(
  battleModal,
  /const ultimateUnusedPreparationRoutes[\s\S]{0,260}equippedCapitalBoostSkill &&[\s\S]{0,160}!usedSkillIds\.has\(equippedCapitalBoostSkill\.id\)[\s\S]{0,220}ultimateUnusedPreparationRoutes\.push/,
  'Ultimate result analysis must inspect unused Buntoru preparation'
);
assert.match(
  battleModal,
  /alliance\.active && !allianceUsed[\s\S]{0,260}ultimateUnusedPreparationRoutes\.push[\s\S]{0,180}外部協力/,
  'Ultimate result analysis must inspect unused alliance preparation'
);
assert.match(
  battleModal,
  /const passagePreparedOrUsed =[\s\S]{0,320}equippedPassageSkill[\s\S]{0,260}ultimateUnusedPreparationRoutes\.push/,
  'Ultimate result analysis must inspect unused Passage preparation'
);
assert.match(
  battleModal,
  /ブラックナイトが所有率\$\{fadedBlackestNightOwnership[\s\S]{0,280}障壁を残したまま[\s\S]{0,220}開始直後ではなく[\s\S]{0,180}ドリルや敵LB3の危険予告中/,
  'an expired player Blackest Night must report measured waste and one exact timing correction'
);
assert.match(
  highEndRaidView,
  /limitBreakCharge: number/,
  'high-end entry cards must receive the persistent LB charge'
);
assert.match(
  highEndRaidView,
  /const preparedLimitBreakTier = getChargedLimitBreakTier\([\s\S]{0,650}LB IIIまであと/,
  'high-end entry cards must derive current LB tier and remaining preparation'
);
assert.match(
  app,
  /<HighEndRaidView[\s\S]{0,1200}limitBreakCharge=\{limitBreakCharge\}/,
  'the high-end route must pass persistent LB readiness before entry'
);
assert.match(
  highEndRaidView,
  /安定攻略の準備例[\s\S]{0,260}開幕AUTOにパッセ[\s\S]{0,220}LB III/,
  'the high-end route must pass and present actionable LB/build readiness before entry'
);
assert.match(
  highEndRaidView,
  /<details className="ultimate-raid-card__warning high-end-raid-hint">[\s\S]{0,120}<summary>攻略のヒント<\/summary>[\s\S]{0,320}安定攻略の準備例/,
  'Ultimate strategy detail must start collapsed under the shared hint label'
);
assert.match(
  battleModal,
  /compact: shouldUseCompactCapitalPresentation\(\{[\s\S]{0,180}reducedMotion,[\s\S]{0,100}isHighEndRaid,[\s\S]{0,100}isEarlyNormalBattle/,
  'high-end repeated investments must use the compact pile timeline to preserve decision tempo'
);
assert.match(
  battleModal,
  /const compact = shouldUseCompactCapitalPresentation\(\{[\s\S]{0,180}reducedMotion,[\s\S]{0,100}isHighEndRaid,[\s\S]{0,100}isEarlyNormalBattle/,
  'high-end support and enemy capital previews must use the compact pile timeline too'
);
assert.match(
  battleModal,
  /const enemySupportPausesBattle =\s*!!enemySupportCinematic && !cruelScriptedCountdownActive/,
  'enemy telegraphs must pause passive pressure so difficulty stays in the response choice'
);
assert.equal(
  (battleModal.match(/getSkillCinematicTiming\(reducedMotion \|\| isHighEndRaid\)/g) ?? []).length,
  3,
  'all player skill cinematic paths must use compact high-end timing'
);
assert.match(
  battleModal,
  /const highEndNetworkChoiceRequired =[\s\S]{0,260}quickNetworkSupportProperty[\s\S]{0,220}alliance\.active &&[\s\S]{0,80}!allianceUsed/,
  'high-end support must detect when owned-network and external-alliance routes both need a visible choice'
);
assert.match(
  battleModal,
  /onClick=\{\(\) => \{[\s\S]{0,180}!isHighEndRaid \|\| highEndNetworkChoiceRequired[\s\S]{0,160}setPanel\('funds'\)[\s\S]{0,360}demandFromProperty\(quickNetworkSupportProperty\)[\s\S]{0,140}requestAlliance\(\)/,
  'high-end support must open one source choice when both routes exist, then return to direct requests after that choice is resolved'
);
assert.match(
  battleModal,
  /highEndNetworkChoiceRequired\s*\?\s*'仲間か外部協力を選択可能'/,
  'the compact high-end action must announce when tapping it opens the network-versus-alliance choice'
);
assert.match(
  battleModal,
  /highEndNetworkChoiceRequired\s*\?\s*'選択可'/,
  'the compact high-end action badge must switch from immediate request to source selection'
);
assert.match(
  battleModal,
  /仲間\$\{battleSubs\.length\}件\$\{alliance\.active && !allianceUsed \? '＋外部協力' : ''\}/,
  'the compact support summary must stop advertising external cooperation after its one use'
);
assert.match(
  battleEncounterData,
  /drain:\s*\{[\s\S]{0,180}telegraphText:\s*'未投入資金ドレイン――直接出資で退避'/,
  'Drain must tell the player what is at risk and which live counter avoids it'
);
assert.match(
  marketView,
  /ソリューション・ナイン[\s\S]{0,260}未投入資金ドレイン[\s\S]{0,80}予告中に直接出資して退避/,
  'Solution Nine must teach the Drain counter before charging the challenge fee'
);
assert.match(
  battleModal,
  /enemyDrainStolen > 0 && !isHighEndRaid[\s\S]{0,260}予告中に直接出資し、手元資金を積載へ退避/,
  'a normal-mode Drain defeat must report measured damage and one concrete next action'
);
assert.match(
  battleEncounterData,
  /forced_liquidation:\s*\{[\s\S]{0,220}telegraphText:\s*'強制清算――所有率3%へ。着弾直後の反撃を1回残せ'/,
  'Forced Liquidation must disclose the three-percent drop and the saved-counter requirement before impact'
);
assert.match(
  battleModal,
  /enemySupportUsed\.has\('forced_liquidation'\)[\s\S]{0,260}人脈・SYNERGY・LBのどれか1回を温存/,
  'a Forced Liquidation defeat must name the mechanic and one concrete recovery command'
);
assert.match(
  battleModal,
  /enemySupportUsed\.has\('blackest_night'\)[\s\S]{0,120}companyInvested <= 0[\s\S]{0,260}清算後へ残すのは反撃1回ぶん[\s\S]{0,260}障壁中は直接出資を温存し、終了後に人脈→SYNERGY→LB/,
  'a Blackest Night defeat must distinguish over-saving from spending direct capital into the barrier'
);
assert.match(
  battleModal,
  /const recoveryResourceAvailableAtResult =\s*hasAvailableNetworkSupport \|\|\s*limitBreakTier > 0 \|\|\s*cash >= Math\.round\(targetProperty\.marketPrice \* 0\.1\)/,
  'Walking Dead recovery advice must inspect remaining network, LB, and large-investment resources'
);
assert.match(
  battleModal,
  /defeatReason === 'WALKING_DEAD_FAILED'[\s\S]{0,120}recoveryResourceAvailableAtResult[\s\S]{0,300}清算後へ抱えたままにせず、猶予中にすぐ投入/,
  'Walking Dead advice must tell players to use recovery resources that were still available at defeat'
);
assert.match(
  battleEncounterData,
  /cruel_reckoning:\s*\{[\s\S]{0,240}telegraphText:\s*'終極資本査定――15秒で所有75%＋直接出資10%'[\s\S]{0,100}telegraphMs:\s*15_000/,
  'Cruel Reckoning must expose the fifteen-second assessment contract'
);
assert.match(
  battleModal,
  /shouldTriggerCruelSecondPhase\([\s\S]*startEnemySupportSkill\(CRUEL_SCRIPTED_BATTLE\.secondActionId\)[\s\S]{0,520}setPanel\('capital'\)[\s\S]{0,240}setCommandProgress\(100\)/,
  'Cruel Reckoning must close the relationship drawer and arm direct investment for its live countdown'
);
assert.match(
  battleModal,
  /const presentationBlocksCommands =[\s\S]{0,180}panel !== 'capital'/,
  'the command-state label must not announce受付中 while a modal drawer keeps the investment deck inert'
);
assert.match(
  finalWindCss,
  /\.battle-announcement::before,\s*\.battle-announcement::after[\s\S]*\.battle-announcement::before \{ top: 38%; \}[\s\S]*\.battle-announcement::after \{ bottom: 38%; \}/,
  'battle announcements must draw balanced upper and lower divider lines'
);
assert.doesNotMatch(
  capitalCss,
  /buyout-screen--limit-tier-1[\s\S]{0,160}battle-announcement--limit::after[\s\S]{0,80}display:\s*none/,
  'LIMIT BREAK I must not remove the lower announcement divider'
);
assert.match(
  battleModal,
  /capitalPileOwnsField[\s\S]*isFundingAmount[\s\S]*if \(capitalPileOwnsField && isFundingAmount\) return;/,
  'capital funding amounts must yield the field to the pile and fixed ledger'
);
assert.match(
  battleModal,
  /const requestAlliance[\s\S]*startCapitalPilePreview\([\s\S]*committedCapital\.next,[\s\S]*true,[\s\S]*true/,
  'late-game alliance funding must always receive the heavy stacking presentation'
);
assert.match(
  battleCapitalCanvasLayout,
  /const landscape = safeWidth \/ safeHeight >= 1\.45;[\s\S]{0,1200}xRatio:\s*0\.5 \+ centered \* \(pitch \/ areaWidth\)/,
  'portrait and landscape canvases must resolve a real orientation-specific dense spread'
);
assert.doesNotMatch(
  battleModal,
  /CAPITAL_OVERFLOW_LANE_ORDER|overflowPieceCount/,
  'the renderer must not add a second amount-like overflow particle system'
);
assert.match(
  battleCapitalCanvas,
  /const packetLayers =\s*6 \+ Math\.abs\(side\.frame\.packetSeed \+ index \* 3\) % 7/,
  'each of the fixed active columns must receive one deterministic six-to-twelve-layer packet'
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
const playerCapitalSweepGroups = [
  [21, 14, 19, 8, 13],
  [3, 18, 7, 12, 2],
  [17, 6, 11, 1],
  [16, 5, 10, 0],
  [15, 4, 9, 20],
];
const outwardCapitalSweep = playerCapitalSweepGroups.flat();
const inwardCapitalSweep = [...playerCapitalSweepGroups].reverse().flat();
assert.deepEqual(
  oneOverflowSweep.slice(0, BATTLE_CAPITAL_COLUMN_COUNT),
  outwardCapitalSweep,
  'one player overflow pass must first sweep adjacent columns from the battle centre outwards'
);
assert.deepEqual(
  oneOverflowSweep.slice(BATTLE_CAPITAL_COLUMN_COUNT),
  inwardCapitalSweep,
  'one player overflow pass must return along the same adjacent path from the outer edge'
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
const enemyOverflowSweep = getMechanicalCapitalColumnFrames(
  BATTLE_CAPITAL_COLUMN_COUNT * 36,
  BATTLE_CAPITAL_COLUMN_COUNT * 36,
  24,
  5,
  1,
  CAPITAL_OVERFLOW_RESTACK_BEATS.heavy,
  false,
  'enemy'
)
  .filter(
    (frame) =>
      frame.overflowPass === 1 && frame.activeColumnIndices.length > 0
  )
  .flatMap((frame) => frame.activeColumnIndices);
assert.deepEqual(
  enemyOverflowSweep.slice(0, BATTLE_CAPITAL_COLUMN_COUNT),
  [...outwardCapitalSweep].reverse(),
  'the enemy sweep must mirror the player path from its own inner edge'
);
assert.ok(
  CAPITAL_STACK_BEAT_MS.heavy > CAPITAL_STACK_BEAT_MS.standard &&
    CAPITAL_STACK_BEAT_MS.heavy >= 100,
  'large capital must keep every bundle visible across at least three 30fps samples'
);
assert.ok(
  saturatedReloadFrames.length * CAPITAL_STACK_BEAT_MS.heavy >= 3_000,
  'exceptional reloads must spend time on visible stacking instead of collapsing inside one second'
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
  /const \[usedBattleSynergyIds, setUsedBattleSynergyIds\][\s\S]*const usedBattleSynergyIdsRef = useRef<Set<string>>\(new Set\(\)\)[\s\S]*const battleSynergyUsed =[\s\S]*usedBattleSynergyIds\.has\(selectedBattleSynergy\.id\)[\s\S]*usedBattleSynergyIdsRef\.current\.has\(selectedBattleSynergy\.id\)/,
  'regular and progression SYNERGY must share a synchronous per-battle usage ledger and rendered state mirror'
);
assert.match(
  battleModal,
  /const demandFromGroup = \(\s*synergyId: string,[\s\S]*usedBattleSynergyIdsRef\.current\.has\(synergyId\)[\s\S]*claimBattleSynergyUsage\(\s*usedBattleSynergyIdsRef\.current,\s*synergyId\s*\)[\s\S]*usedBattleSynergyIdsRef\.current = claimedSynergyIds;[\s\S]*setUsedBattleSynergyIds\(claimedSynergyIds\)/,
  'regular group SYNERGY must synchronously reject and record repeat use in the same battle'
);
assert.match(
  battleModal,
  /const activateProgressionBattleSynergy = \(synergy: GroupSynergy\) => \{[\s\S]*usedBattleSynergyIdsRef\.current\.has\(synergy\.id\)[\s\S]*claimBattleSynergyUsage\(\s*usedBattleSynergyIdsRef\.current,\s*synergy\.id\s*\)[\s\S]*usedBattleSynergyIdsRef\.current = claimedSynergyIds;[\s\S]*setUsedBattleSynergyIds\(claimedSynergyIds\)/,
  'progression SYNERGY must use the same synchronous once-per-battle claim'
);
assert.match(
  synergyAction,
  /disabled=\{[\s\S]*!battleSynergyReady[\s\S]*battleSynergyUsed[\s\S]*<em>\{actionsLocked[\s\S]{0,120}: battleSynergyUsed[\s\S]{0,80}\? '使用済み'/,
  'the SYNERGY action must disable every used synergy and report it whenever a cut-in is not the higher-priority state'
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
  /const \[openingDecisionPending, setOpeningDecisionPending\] = useState\(false\);[\s\S]*const openingDecisionPendingRef = useRef\(false\);[\s\S]*source: 'opening-auto',[\s\S]*onComplete: \(\) => \{[\s\S]*openingDecisionPendingRef\.current = true;[\s\S]*setOpeningDecisionPending\(true\);[\s\S]*setCommandProgress\(INITIAL_BATTLE_COMMAND_PROGRESS\);[\s\S]*setOpeningAutoPending\(false\)/,
  'opening AUTO completion must preserve a ready manual command behind a durable first-decision gate'
);
assert.match(
  battleModal,
  /const presentationPauseActive =[\s\S]*openingAutoPending \|\|[\s\S]*openingDecisionPending \|\|[\s\S]*useLayoutEffect/,
  'the opening decision gate must stop battle clocks without becoming an action lock'
);
assert.match(
  battleModal,
  /const presentationLocked =[\s\S]*capitalPresentationActive \|\|\s*enemyOpeningCapitalPending \|\|\s*openingAutoPending \|\|\s*!!criticalAutoPending/,
  'opening capital may lock its authored scene while the later decision gate stays actionable'
);
const presentationLockBlock = battleModal.slice(
  battleModal.indexOf('const presentationLocked ='),
  battleModal.indexOf('const decisiveLocked =')
);
const actionLockBlock = battleModal.slice(
  battleModal.indexOf('const actionsLocked ='),
  battleModal.indexOf('const primarySkillActionLocked =')
);
assert.doesNotMatch(
  presentationLockBlock,
  /openingDecisionPending/,
  'the opening decision gate must never become a presentation lock'
);
assert.doesNotMatch(
  actionLockBlock,
  /openingDecisionPending/,
  'the opening decision gate must never disable the command buttons'
);
assert.match(
  battleModal,
  /const consumeCommand = \(\) => \{[\s\S]*if \(openingDecisionPendingRef\.current\) \{[\s\S]*openingDecisionPendingRef\.current = false;[\s\S]*setOpeningDecisionPending\(false\);[\s\S]*setCommandProgress\(0\)/,
  'only a successfully consumed manual command may release the opening decision gate'
);
assert.match(
  battleModal,
  /openingBossAbilityTier === 'none' \|\|[\s\S]*openingSlowActive \|\|[\s\S]*openingAutoPending \|\|[\s\S]*activateEnemyBossAbility\(\{[\s\S]*tier: openingBossAbilityTier/,
  'authored opening Cover must wait for the player opening AUTO cinematic to finish'
);
assert.match(
  battleModal,
  /enemySupportProfile\.length === 0 \|\|\s*openingDecisionPending \|\|/,
  'enemy support selection must wait until the player consumes the guaranteed opening command'
);
assert.match(
  battleModal,
  /sequenceCapitalPresentation[\s\S]*deferCapitalPile: sequenceCapitalPresentation[\s\S]*presentation\(onComplete\)/,
  'critical capital skills must show their card before the deferred renderer-neutral pile'
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
  /const activePlayerPileFrame =[\s\S]*capitalPreviewStage \?\? playerCapitalPilePreviewStage;[\s\S]*activePlayerPileFrame\?\.presentedCapital \?\? totalPlayerInvested;[\s\S]*enemyCapitalPilePreviewStage\?\.presentedCapital \?\?[\s\S]*enemyOpeningVisualConcealed \? 0 : enemyInvested/,
  'both fixed ledgers must advance with the same packet timeline as their visible piles'
);
assert.doesNotMatch(
  liveBattlefield,
  /displayedCompanyInvested|capitalPressureLabel/,
  'retired numeric capital-composition and pressure labels must not return over the coin scene'
);
assert.doesNotMatch(
  battleModal,
  /showFloater\(`着金 \+\$\{formatCurrency\(snapshot\.amount\)\}`/,
  'direct stacking must not mount a second amount floater over the coin scene'
);
const capitalBoostEffectStart = battleModal.lastIndexOf(
  "} else if (skill.effectType === 'CAPITAL_BOOST')"
);
const capitalBoostEffectBlock = battleModal.slice(
  capitalBoostEffectStart,
  battleModal.indexOf(
    "} else if (skill.effectType === 'LIVING_DEAD')",
    capitalBoostEffectStart
  )
);
assert.doesNotMatch(
  capitalBoostEffectBlock,
  /showFloater\(/,
  'ぶんどる must never queue a funding floater before its deferred AUTO pile'
);
assert.doesNotMatch(
  battleModal,
  /className=\{`capital-commit-cue/,
  'direct stacking must not add an amount overlay above the pile or fixed ledger'
);
assert.doesNotMatch(
  capitalCss,
  /\.capital-commit-cue/,
  'the removed amount overlay must not survive as dead responsive CSS'
);
assert.match(
  battleModal,
  /: capitalCommitCueText[\s\S]{0,220}title: capitalCommitCueText[\s\S]{0,120}detail: 'コイン積載中'/,
  'the single capital telop must reuse the existing one-line command-state lane'
);
assert.match(
  battleModal,
  /const openingTimeline = buildCapitalStackTimeline\(\{[\s\S]*source: 'opening',[\s\S]*previousCapital: 0,[\s\S]*nextCapital: initialEnemyCommitment/,
  'the already-committed enemy opening ledger must still receive a visual zero-to-final scene'
);
assert.match(
  battleModal,
  /const enemyOpeningVisualConcealed =[\s\S]*battlePhase === 'briefing'[\s\S]*enemyOpeningCapitalPending && enemyCapitalPilePreviewStage === null[\s\S]*displayedEnemyInvested =[\s\S]*enemyOpeningVisualConcealed \? 0 : enemyInvested/,
  'the enemy opening pile and readout must stay empty until the zero-to-final timeline owns them'
);
assert.match(
  liveCapitalCanvas,
  /enemy=\{\{[\s\S]{0,120}amount:\s*displayedEnemyInvested,[\s\S]{0,160}previewFrame:\s*enemyCapitalPilePreviewStage,/,
  'the enemy canvas must consume both the staged opening amount and its preview frame instead of flashing the committed ledger'
);
assert.match(
  battleModal,
  /enemyOpeningCapitalPending[\s\S]*startCapitalPilePreview\(\s*'enemy',\s*0,\s*initialEnemyCommitment,[\s\S]*'pause'/,
  'the opening pile must block battle clocks until its queue is complete'
);
assert.match(
  battleCapitalCanvas,
  /const loweredBy = resolveBattleCapitalRackOffset\([\s\S]{0,120}layout\.landscape,[\s\S]{0,80}side\.frame\.rackDepth[\s\S]{0,100}const baseY = height \* 0\.82 \+ loweredBy;/,
  'the Canvas2D rack must project its latched compression and overflow depth into a screen-scale descent'
);
assert.match(
  battleModal,
  /--capital-actor-impact-duration':[\s\S]*Math\.min\(460,[\s\S]*--capital-actor-return-duration':[\s\S]*Math\.min\(160,/,
  'Tataru movement must use short actor-only clocks instead of the multi-second coin timeline'
);
assert.match(
  capitalCss,
  /capital-tataru-impact[\s\S]*var\(--capital-actor-impact-duration, 460ms\)[\s\S]*@keyframes capital-tataru-impact[\s\S]*82%[\s\S]*100% \{ transform: scaleX\(-1\); \}/,
  'Tataru must return to the fixed origin early while the remaining coin packets continue'
);
assert.match(
  battleCapitalCanvas,
  /const packetOrder = side\.frame\.activeColumnIndices\.indexOf\(index\);[\s\S]{0,120}side\.frame\.packetProgress - Math\.max\(0, packetOrder\) \* 0\.025/,
  'the four-to-five fixed packet columns must arrive as a short cascade rather than one flat flash'
);
assert.match(
  battleCapitalCanvas,
  /const reducedMotion =[\s\S]{0,120}prefers-reduced-motion: reduce[\s\S]*packetProgress:[\s\S]{0,180}activeColumnIndices\.length === 0 \|\| reducedMotion[\s\S]{0,80}\? 1/,
  'reduced motion must settle Canvas2D packets without starting a falling animation'
);
assert.match(
  integratedCss,
  /--battle-gauge-interpolation:\s*110ms;[\s\S]*recast-meter > i > u[\s\S]*transition:\s*width var\(--battle-gauge-interpolation\) linear;/,
  'player and enemy recast meters must bridge every 100ms logical update without an idle gap'
);
assert.match(
  battleModal,
  /const \[playerCapitalRackLowered, setPlayerCapitalRackLowered\][\s\S]*const \[enemyCapitalRackLowered, setEnemyCapitalRackLowered\]/,
  'each side must own a battle-lifetime latch for its lowered capital rack'
);
assert.match(
  battleModal,
  /timeline\.frames\.some\(\(frame\) => frame\.rackCompressed\)[\s\S]{0,240}setPlayerCapitalRackLowered\(true\)[\s\S]{0,180}setEnemyCapitalRackLowered\(true\)/,
  'a generic heavy pour must latch the lowered footing for the acting side'
);
assert.match(
  liveCapitalCanvas,
  /rackLowered:\s*playerCapitalRackLowered,[\s\S]{0,100}rackFloorTier:\s*playerCapitalRackFloorTier,[\s\S]*rackLowered:\s*enemyCapitalRackLowered,[\s\S]{0,100}rackFloorTier:\s*enemyCapitalRackFloorTier/,
  'ending or replacing a preview must not raise a rack that was already lowered'
);
assert.doesNotMatch(
  battleModal,
  /set(?:Player|Enemy)CapitalRackLowered\(false\)/,
  'a lowered rack must never return upward during the same battle'
);
assert.match(
  battleModal,
  /const \[playerCapitalRackFloorTier, setPlayerCapitalRackFloorTier\][\s\S]*const \[enemyCapitalRackFloorTier, setEnemyCapitalRackFloorTier\]/,
  'each side must retain the deepest overflow footing reached during the battle'
);
assert.match(
  battleModal,
  /const deepestRackFloorTier = Math\.max\([\s\S]{0,260}overflowPass[\s\S]{0,220}setPlayerCapitalRackFloorTier\(\(current\) =>[\s\S]{0,100}Math\.max\(current, deepestRackFloorTier\)/,
  'temporary reload sink depth must be latched monotonically instead of released at completion'
);
assert.doesNotMatch(
  battleModal,
  /set(?:Player|Enemy)CapitalRackFloorTier\(0\)/,
  'the deepest rack footing must never reset while the battle modal remains mounted'
);
assert.deepEqual(
  CAPITAL_STACK_BEAT_MS,
  { standard: 90, heavy: 128, compact: 62 },
  'coin painting should use the approved slightly faster cadence at every intensity'
);
assert.match(
  fankitAssets,
  /capitalRapidFire:\s*publicAsset\('game-audio\/capital-rapid-fire\.mp3'\)/,
  'capital stacking must resolve the approved local click through the public base path'
);
const capitalRapidFireAsset = resolve(
  repositoryRoot,
  'public/game-audio/capital-rapid-fire.mp3'
);
assert.ok(
  existsSync(capitalRapidFireAsset) && statSync(capitalRapidFireAsset).size === 6_368,
  'the approved Click_001 payload must remain present and byte-sized as reviewed'
);
assert.match(
  pagesWorkflow,
  /cp -R public\/game-audio dist\/game-audio/,
  'GitHub Pages must publish the approved rapid-fire audio directory'
);
assert.match(
  audio,
  /const chunkMs = Math\.min\(1_000, remainingMs\)[\s\S]*offsetMs \+= 38/,
  'each stream chunk must be capped at one second and fire the click every 38ms'
);
assert.match(
  audio,
  /session\.active &&[\s\S]{0,180}performance\.now\(\) < session\.stopAtMs[\s\S]{0,160}startCapitalRapidFireChunk\(session, buffer\)/,
  'a completed one-second chunk may restart only while coin painting is still active'
);
assert.match(
  audio,
  /session\.stopAtMs = performance\.now\(\) \+ stopDelayMs[\s\S]{0,220}stopCapitalStackStream\(side\)/,
  'the final painted packet must stop the stream at the same frame boundary'
);
assert.match(
  battleModal,
  /playCapitalStackStep\([\s\S]{0,220}frame\.durationMs/,
  'capital rendering must pass the final packet duration into audio shutdown'
);
assert.match(
  battleModal,
  /clearCapitalPilePreview[\s\S]{0,420}soundFx\.stopCapitalStackStream/,
  'cancelled or replaced pile previews must immediately stop their audio stream'
);
assert.doesNotMatch(
  audio,
  /getCapitalRapidFireBuffer|partialRatios|One bounded metallic beat/,
  'the rejected procedural metallic/pulse synth must not return'
);
const directCapitalPresentation = battleModal.match(
  /const startCompanyCapitalPresentation[\s\S]*?const investCompanyFunds/
)?.[0] ?? '';
assert.doesNotMatch(
  directCapitalPresentation,
  /soundFx\.playCoin\(\)/,
  'direct investment must not layer the retired metal coin chime over the rapid-fire stream'
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
  'the three allocation choices must use a readable two-column base on phones'
);
assert.match(
  buyoutCss,
  /result-celebration-choice > div > button:nth-child\(3\)[\s\S]*grid-column:\s*1 \/ -1/,
  'the lavish allocation must span the second row instead of becoming a narrow orphan column'
);
assert.match(
  buyoutCss,
  /result-celebration-choice > div > button\s*\{[\s\S]*min-height:\s*3\.25rem/,
  'each phone profit-allocation choice must retain a touch-safe height'
);
assert.doesNotMatch(
  buyoutCss,
  /@media \(max-width:\s*390px\)[\s\S]*result-celebration-choice > div[\s\S]*grid-template-columns:\s*1fr/,
  'narrow phones must keep the 2+1 allocation layout inside the scrollable result card'
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
  battleModal,
  /celebrationProjectionRef\.current = \{[\s\S]*baseDepartureProbability:\s*liveBaseDepartureProbability[\s\S]*selectedDepartureProbability:\s*option\.departureProbability[\s\S]*resolvePostVictoryLoyalty\([\s\S]*option\.loyaltyRiskReduction/,
  'the confirmed settlement must preserve its pre-choice risk projection and apply the selected risk recovery'
);
assert.match(
  `${gameBalance}\n${battleSettlement}`,
  /id:\s*'keep'[\s\S]*label:\s*'利益独占'[\s\S]*id:\s*'share50'[\s\S]*label:\s*'五分の祝儀'[\s\S]*departureProbabilityMultiplier:\s*0\.2[\s\S]*id:\s*'share100'[\s\S]*label:\s*'大盤振る舞い'[\s\S]*departureProbabilityMultiplier:\s*0[\s\S]*loyaltyRiskReduction:\s*BATTLE_LOYALTY_BALANCE\.lavishRiskRecovery/,
  'the portable settlement contract must define 0%, 50% and 100% choices with explicit loyalty effects'
);
assert.doesNotMatch(
  `${gameBalance}\n${battleSettlement}\n${battleModal}\n${app}\n${helpText}`,
  /'gift10'|'gift20'|ご祝儀なし|標準のご祝儀|安心のご祝儀/,
  'the retired fixed-amount gift contract must not return in logic or player-facing copy'
);
assert.match(
  battleModal,
  /const growthLabel =[\s\S]*戦力を再編[\s\S]*大きく成長[\s\S]*着実に成長[\s\S]*aria-label="商店戦力の変化"[\s\S]*<small>今回の変化<\/small>[\s\S]*祝儀・離反を含む精算後の戦力/,
  'the result strength card must describe both growth and post-settlement decline without exposing another finance-sized score'
);
assert.match(
  strengthComparison,
  /buildMobilizationPointBreakdown[\s\S]*味方の動員力[\s\S]*競合の防衛力[\s\S]*<b>100<\/b>[\s\S]*strength-comparison__equation[\s\S]*component\.label[\s\S]*component\.points[\s\S]*相手の手数：\{enemyPace\}/,
  'readiness must show an additive mobilization equation against defense 100'
);
assert.match(
  battleReadiness,
  /cash:\s*'手元資金'[\s\S]*subsidiaries:\s*'人脈'[\s\S]*synergy:\s*'SYNERGY'[\s\S]*limit_break:\s*'LIMIT BREAK'[\s\S]*alliance:\s*'外部協力'[\s\S]*battle_synergy:\s*'SYNERGY'/,
  'the 100-point equation must use player-facing resource names and distinguish external cooperation'
);
assert.match(
  battleReadiness,
  /name:\s*'戦闘連携'[\s\S]*key:\s*'subsidiaries'[\s\S]*SYNERGY参加企業[\s\S]*key:\s*'synergy'[\s\S]*SYNERGY.*上乗せ[\s\S]*synergyTotal - synergySupport\.amount/,
  'regular SYNERGY must expose network capital plus its additive bonus without changing the route total'
);
assert.match(
  battleReadiness,
  /name:\s*'LIMIT BREAK'[\s\S]*key:\s*'subsidiaries'[\s\S]*LB参加企業[\s\S]*key:\s*'limit_break'[\s\S]*LB.*上乗せ[\s\S]*limitTotal - limitNetworkAmount/,
  'LIMIT BREAK must expose participating network capital plus its additive bonus'
);
assert.doesNotMatch(
  strengthComparison,
  /判定用戦力比|AI Lv|基準反応 約|戦力換算は自社が|戦力換算は競合が/,
  'internal assessment ratios and AI tuning numbers must stay off the readiness surface'
);
assert.match(
  strengthComparison,
  /<details className="strength-comparison__details">[\s\S]*実際のギル額と計算条件[\s\S]*formatCurrency\(result\.playerExpectedCapital\)[\s\S]*formatCurrency\(result\.enemyBudget\)/,
  'real gil values remain available on demand instead of competing with the primary equation'
);
assert.match(
  strengthComparisonCss,
  /\.strength-comparison__equation\s*\{[\s\S]{0,180}flex-wrap:\s*wrap[\s\S]{0,400}min-width:\s*3\.25rem/,
  'the additive equation must wrap without forcing horizontal page overflow on portrait phones'
);
assert.match(
  marketView,
  /勝利すると強くなること[\s\S]*この企業が人脈に加わり、毎秒収益が増える[\s\S]*有効な事業連携[\s\S]*<details className="trade-target-card__details">[\s\S]*勝利後の毎秒収益：\+\{formatCurrency\(prop\.annualRevenue\)\}/,
  'market targets must lead with qualitative growth and keep exact revenue in optional details'
);
assert.match(
  marketView,
  /const companyStrengthSummary = \([\s\S]*className="sr-only"[\s\S]*余力あり\$\{readinessCounts\.advantage\}件[\s\S]*準備不足\$\{readinessCounts\.danger\}件/,
  'the map keeps readiness totals for assistive technology without another visible finance strip'
);
assert.doesNotMatch(
  marketView,
  /className="market-readiness-overview"/,
  'the progress map must not repeat funds, contacts, and four readiness totals in a visible dashboard'
);
assert.doesNotMatch(
  liveBattlefield,
  /追加防衛の余力|残りわずか|商流から回復中/,
  'enemy reserve and commercial-regeneration labels must not compete with its visible coin pile'
);
assert.match(
  battleModal,
  /<summary>収支内訳を見る<\/summary>[\s\S]*result-battle-details/,
  'result details must remain available on demand while keeping the first view focused'
);
assert.match(
  app,
  /const isExtreme =\s*mode === 'normal' && isExtremeReacquisition\(targetProperty\);[\s\S]*battleMode:\s*isExtreme \? 'extreme' : mode/,
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
assert.match(
  header,
  /協力・企業連合[\s\S]*aria-current=\{activeTab === 'market'[\s\S]*aria-current=\{activeTab === 'portfolio'[\s\S]*aria-current=\{activeTab === 'skills'[\s\S]*aria-current=\{activeTab === 'cartels'[\s\S]*連合攻略[\s\S]*aria-current=\{activeTab === 'savage'/,
  'desktop navigation names both concepts while mobile uses a short alliance goal and exposes the current page'
);
assert.doesNotMatch(
  header,
  /fixed bottom-0[^>]*backdrop-blur/,
  'the always-visible mobile navigation must avoid a continuous backdrop blur layer'
);
assert.match(
  cartelAllianceView,
  /味方の外部協力[\s\S]*外部協力：\$\{alliance\.allyName\}[\s\S]*毎戦1回・手元資金の消費なし・離反なし[\s\S]*<details[\s\S]*協力内容を確認・変更[\s\S]*対象相場の75%相当[\s\S]*保有する人脈は複数回[\s\S]*現在の協定を解除[\s\S]*攻略対象：競合企業連合[\s\S]*参加企業を味方にする → 本部の守りが下がる → 本部へ挑戦/,
  'the alliance screen must keep friendly support compact and lead into the rival alliance objective above the fold'
);
assert.match(
  cartelAllianceView,
  /const defensePercent = Math\.round[\s\S]*本部の守り[\s\S]*最大時の\{defensePercent\}%[\s\S]*味方になった参加企業 \{ownedSubsCount\} \/ \{totalSubsCount\}/,
  'rival alliance progress must lead with relative defense and recruited companies instead of another finance-sized total'
);
assert.doesNotMatch(
  cartelAllianceView,
  /EXTERNAL ALLIANCE|OWNED NETWORK|未提携組織:|企業連合（競合）攻略|animate-pulse/,
  'retired alliance jargon and ambient pulse must not return to the progression screen'
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
  /高難度支援：人脈・通常グループSYNERGYが強化（外部アライアンス・LBは別枠）/,
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
  /if \(skillId === 'forced_liquidation'\)[\s\S]*forcedLiquidationRecoveryRemainingRef\.current = recoveryMs;[\s\S]*forcedLiquidationAwaitingManualCounterRef\.current = true;[\s\S]*setPanel\('capital'\)/,
  '強制清算 impact must arm the manual-counter gate and return to the actionable capital panel'
);
assert.match(
  battleModal,
  /const consumeCommand = \(\) => \{[\s\S]*forcedLiquidationAwaitingManualCounterRef\.current[\s\S]*forcedLiquidationAwaitingManualCounterRef\.current = false[\s\S]*setCommandProgress\(0\)/,
  'the first successfully consumed manual command must release player continuous pressure even after grace expiry'
);
assert.doesNotMatch(
  battleModal,
  /if \(nextRecovery <= 0\) \{[\s\S]*forcedLiquidationAwaitingManualCounterRef\.current = false/,
  '強制清算 grace expiry must not release pre-cast player pressure without a command'
);
assert.match(
  battleModal,
  /resolveForcedLiquidationContinuousVelocity\(\{[\s\S]*velocity: limitAdjustedVelocity,[\s\S]*recoveryRemaining: forcedLiquidationRecoveryRemainingRef\.current,[\s\S]*awaitingManualCounter:[\s\S]*forcedLiquidationAwaitingManualCounterRef\.current/,
  'the live gauge loop must resolve both sides through the 強制清算 continuous-pressure gate'
);
assert.match(
  gameBalance,
  /if \(awaitingManualCounter\) \{[\s\S]*recoveryRemaining > 0 \? 0 : Math\.max\(0, velocity\)[\s\S]*return recoveryRemaining > 0 \? Math\.min\(0, velocity\) : velocity;/,
  'the gate must freeze both sides during grace, then resume only enemy pressure until a real counter-command'
);
assert.match(
  battleModal,
  /反撃猶予が終了。競合は行動を再開するが、自社の事前圧力は反撃の一手まで停止する/,
  'the battle log must explain why pre-liquidation pressure cannot auto-recover after grace expiry'
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
  /const \[companyInvested, setCompanyInvested\] = useState\(0\);[\s\S]*const \[reflectedCompanyInvested, setReflectedCompanyInvested\][\s\S]*const totalPlayerInvested = companyInvested \+ demandInvested;[\s\S]*commitPlayerCapital\('company', retainedCapital\);[\s\S]*setReflectedCompanyInvested\([\s\S]*current \+ reflectedCapital[\s\S]*const companyCapitalAtRisk =[\s\S]*companyInvested \+ reflectedCompanyInvested;[\s\S]*const resultSettlementCost = isRecordOnlyBattle[\s\S]*companyCapitalAtRisk \* \(winner === 'player' \? 0\.35 : 0\.75\)[\s\S]*companyFundsInvested: isRecordOnlyBattle \? 0 : companyCapitalAtRisk/,
  'capital reflected to the enemy must stay out of player pressure, remain settlement risk in economic battles, and stay isolated from record-only results'
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
  /battleCommandState[\s\S]{0,1400}終極査定 残り[\s\S]{0,1400}操作受付中[\s\S]{0,1400}次の操作を準備中/,
  'the live command lane must distinguish Cruel, presentation, ready, and recharge states'
);
assert.match(
  battleModal,
  /操作受付中[\s\S]{0,220}投資・アビリティを選べます[\s\S]{0,160}投資・支援・アビリティを選べます[\s\S]{0,500}次の操作を準備中[\s\S]{0,160}ゲージ満了後に操作できます/,
  'the command lane must explain ready and recharge states without duplicating the visible gauge percentage'
);
assert.match(
  battleModal,
  /battle-command-state--\$\{battleCommandState\.tone\}[\s\S]{0,320}battleCommandState\.title[\s\S]{0,240}battleCommandState\.detail/,
  'the live command lane must render its short title and readable detail together'
);
assert.match(
  integratedCss,
  /\.battle-command-state[\s\S]{0,900}\.battle-command-state--ready[\s\S]{0,900}\.battle-command-state--cruel/,
  'portrait battles must visually distinguish ready, locked, and Cruel command states'
);
assert.match(
  capitalCss,
  /cruel-omnicapitalization-card__exclusion[\s\S]{0,240}font-size:\s*\.7rem/,
  'Cruel direct-investment exclusions must remain legible on a portrait phone'
);
assert.match(
  battleModal,
  /displayedPlayerInvested\s*\/\s*Math\.max\(1, targetProperty\.marketPrice\)\s*\*\s*100[\s\S]*data-extreme-opponent-scale-ratio/,
  'Extreme must retain real capital scaling for the pile without exposing another numeric comparison label'
);
assert.match(
  liveCapitalCanvas,
  /player=\{\{[\s\S]{0,120}amount:\s*displayedPlayerInvested,[\s\S]{0,120}marketPrice:\s*targetProperty\.marketPrice,[\s\S]{0,180}previewFrame:\s*capitalPreviewStage \?\? playerCapitalPilePreviewStage,/,
  'Extreme reuses the real gil amount and staged player frame without inflating game state or DOM units'
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
  /勝負どころ：第二査定[\s\S]*10秒以内に所有率50%まで再建[\s\S]*未到達でも第二査定を強制開始[\s\S]*15秒[\s\S]*所有率75%＋自社直接10%/,
  'the Cruel card must disclose the ten-second forced recovery and final check in one concise plan'
);
assert.match(
  highEndRaidView,
  /<details className="cruel-raid-card__warning high-end-raid-hint">[\s\S]{0,120}<summary>攻略のヒント<\/summary>[\s\S]{0,320}勝負どころ：第二査定/,
  'Cruel strategy detail must start collapsed under the same hint label'
);
assert.equal(
  (highEndRaidView.match(/<summary>攻略のヒント<\/summary>/g) ?? []).length,
  2,
  'Ultimate and Cruel must expose exactly two consistent strategy disclosures'
);
assert.doesNotMatch(
  highEndRaidView,
  /<details[^>]*high-end-raid-hint[^>]*\sopen(?:\s|=|>)/,
  'high-end strategy disclosures must not expand by default'
);
assert.match(
  highEndRaidCss,
  /\.high-end-raid-hint\s*>\s*summary\s*\{[\s\S]{0,280}min-height:\s*2\.75rem[\s\S]{0,420}cursor:\s*pointer/,
  'high-end hint summaries must retain a 44px pointer-friendly control'
);
assert.doesNotMatch(
  highEndRaidView,
  /AI LEVEL 6/,
  'the high-difficulty list must not expose an internal AI level'
);
assert.match(
  strengthComparison,
  /人脈だけでは競合の手数に押されます。資金・アビリティ・LBも組み合わせてください。/,
  'support timing risk must be explained as an actionable plan instead of a simulation count'
);
assert.doesNotMatch(
  strengthComparison,
  /expectedEnemyResponsesDuringSupport\.toFixed/,
  'the player-facing comparison must not expose a false-precision enemy response count'
);
assert.match(
  highEndRaidCss,
  /@media \(max-width: 720px\)[\s\S]*\.cruel-raid-card__actions button\s*\{[\s\S]*width:\s*100%/,
  'the Cruel action remains a clear 402px portrait control'
);
assert.match(
  battleEncounterData,
  /firstTriggerActiveMs:\s*15_000[\s\S]*firstImpactPlayerOwnership:\s*10[\s\S]*secondTriggerPlayerOwnership:\s*50[\s\S]*forcedSecondTriggerRecoveryMs:\s*10_000[\s\S]*successPlayerOwnership:\s*75[\s\S]*secondFailureOutcome:\s*'player_defeat'[\s\S]*secondFailureDisplayedOwnership:\s*0/,
  'Cruel must retain the authored first collapse, recovery trigger, timeout, and second check'
);
assert.match(
  battleModal,
  /回復猶予10秒[\s\S]*10秒以内に50%へ[\s\S]*10秒以内に所有率50%へ戻せなくても第二査定を強制開始/,
  'Cruel must show the shortened recovery deadline before the forced second appraisal'
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
  /const isHighEndRaid = isSavage \|\| isUltimate \|\| isCruel \|\| isPhantom;[\s\S]*const isProtectedBattle = isHighEndRaid \|\| isTraining/,
  'Cruel and Phantom inherit the high-end protected briefing path'
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
  /const settlesHighEndVictory =[\s\S]*winner === 'player'[\s\S]*victoryReward > 0[\s\S]*activeBattleMode === 'cruel'[\s\S]*applyLoyaltySettlementPropertyUpdates[\s\S]*projectedCruelCleared[\s\S]*cruelCleared:\s*projectedCruelCleared/,
  'a rewarded high-end victory persists only its network settlement and clear record'
);
assert.match(
  battleModal,
  /const loyaltySettlementPersists =[\s\S]*!isRecordOnlyBattle && winner === 'player' && resultVictoryReward > 0[\s\S]*const celebrationDecisionRequired =[\s\S]*loyaltySettlementPersists/,
  'defeat, training, Phantom and rewardless replays must never open or persist a loyalty settlement'
);
assert.match(
  app,
  /if \(ultimateCleared && !trueEndingSeen\)[\s\S]*setEndingNotice\('true'\)/,
  'Cruel completion must not become a second true-ending trigger'
);
assert.match(
  phantomBattle,
  /SAVAGE_RAID_DEFINITIONS[\s\S]*normalizeRandomUnit\(random\(\)\)[\s\S]*SAVAGE_RAID_DEFINITIONS\[index\]/,
  'Phantom must choose directly from the twelve authored Savage encounters without cloning their mechanics'
);
assert.match(
  highEndRaidView,
  /\{phantomUnlocked && \([\s\S]*PHANTOM_TRADE_DUTY\.name[\s\S]*\{phantomWinStreak\}連勝[\s\S]*最高記録や層別戦績は保存しません[\s\S]*この幻影へ挑戦/,
  'Cruel clear unlocks a Phantom card that presents only the current streak and current random opponent'
);
assert.doesNotMatch(
  highEndRaidView,
  /phantomBest|bestPhantom|phantomCleared/i,
  'Phantom must not introduce a best score, per-layer record or permanent clear flag'
);
assert.match(
  highEndRaidCss,
  /\.phantom-raid-card[\s\S]*\.phantom-raid-card__streak[\s\S]*@media[\s\S]*\.phantom-raid-card__copy/,
  'the unlocked Phantom duty has a responsive high-end card and readable streak treatment'
);
assert.match(
  app,
  /const phantomUnlocked = cruelCleared;[\s\S]*persistPendingBattleSession\('phantom', property\)[\s\S]*setActiveBattleMode\('phantom'\)/,
  'Phantom remains locked to Cruel completion and starts as its own recoverable battle mode'
);
assert.match(
  app,
  /if \(activeBattleMode === 'phantom'\)[\s\S]*winner === 'player'[\s\S]*phantomWinStreak \+ 1[\s\S]*protectedTotalFunds[\s\S]*properties,[\s\S]*alliance,[\s\S]*limitBreakCharge,[\s\S]*phantomWinStreak: projectedPhantomWinStreak[\s\S]*setPhantomRaidId\(pickRandomPhantomRaid\(\)\.id\)[\s\S]*return true/,
  'Phantom settlement is an early record-only branch that preserves the economic save and rerolls after every result'
);
assert.match(
  app,
  /setPhantomBattleLimitBreakCharge\(limitBreakCharge\)[\s\S]*limitBreakCharge=\{[\s\S]*activeBattleMode === 'phantom'[\s\S]*phantomBattleLimitBreakCharge[\s\S]*onLimitBreakChargeChange=\{[\s\S]*setPhantomBattleLimitBreakCharge[\s\S]*isPhantom=\{activeBattleMode === 'phantom'\}/,
  'Phantom passes a battle-local LB copy and an explicit orthogonal mode flag to the presenter'
);
assert.match(
  app,
  /const usesSavageMechanics = mode === 'savage' \|\| mode === 'phantom';[\s\S]*const usesUltimateBasePower =[\s\S]*mode === 'ultimate' \|\| mode === 'phantom';[\s\S]*battleMode: isExtreme \? 'extreme' : mode,/,
  'Phantom readiness keeps the sampled Savage gimmick while lifting only base power to Ultimate'
);
assert.match(
  battleReadiness,
  /battleMode === 'phantom';[\s\S]*battleMode === 'phantom'[\s\S]*幻は抽選された零式層[\s\S]*基礎資金力と判断速度だけが絶相当[\s\S]*battleMode === 'phantom'[\s\S]*\? 'severe'/,
  'Phantom readiness must present its Ultimate-equivalent base power and sampled Savage mechanics as a severe warning'
);
assert.match(
  battleModal,
  /isPhantom\?: boolean;[\s\S]*isPhantom = false[\s\S]*const usesSavageMechanics = isSavage \|\| isPhantom;[\s\S]*const usesUltimateBasePower = isUltimate \|\| isPhantom;[\s\S]*const isRecordOnlyBattle = isTraining \|\| isPhantom;[\s\S]*const isHighEndRaid = isSavage \|\| isUltimate \|\| isCruel \|\| isPhantom;/,
  'Phantom is an explicit orthogonal battle mode, Savage-mechanics host and record-only settlement'
);
assert.match(
  battleModal,
  /getEnemyDifficultyLevel\([\s\S]*usesSavageMechanics,[\s\S]*usesUltimateBasePower,[\s\S]*calculateEnemyBudget\(\{[\s\S]*isSavage,[\s\S]*isUltimate: usesUltimateBasePower[\s\S]*const savageRaidDefinition = usesSavageMechanics[\s\S]*getEnemySupportSkillProfile\(\{[\s\S]*isSavage: usesSavageMechanics,[\s\S]*isUltimate,[\s\S]*getEnemySupportAutoProfile\(\{[\s\S]*isSavage: usesSavageMechanics,[\s\S]*isUltimate,/,
  'Phantom lifts only enemy budget and difficulty to Ultimate while retaining the sampled Savage support profile and AUTO'
);
assert.match(
  battleModal,
  /const limitedLimitBreakSpent =[\s\S]*isUltimate && limitBreakUseCount >= ULTIMATE_LIMIT_BREAK_LIMIT;[\s\S]*const networkSupportLimit = usesSavageMechanics[\s\S]*SAVAGE_NETWORK_SUPPORT_LIMIT[\s\S]*const capitalReversalRequired =[\s\S]*usesSavageMechanics && savageLayer >= 3[\s\S]*const forcedLiquidationRequired =[\s\S]*usesSavageMechanics && savageLayer >= 4/,
  'Phantom retains Savage network limits and layer mechanics without inheriting the Ultimate one-use LB rule'
);
assert.match(
  battleModal,
  /const resultSettlementCost = isRecordOnlyBattle[\s\S]*const resultVictoryReward = isRecordOnlyBattle[\s\S]*brokerageFee: isRecordOnlyBattle \? 0 : brokerageFee[\s\S]*battleCashDelta: isRecordOnlyBattle \? 0 : -enemyDrainStolen[\s\S]*rebelledProperties: isRecordOnlyBattle \? \[\] : rebelled[\s\S]*survivingRiskUpdates: isRecordOnlyBattle/,
  'Phantom returns an economy-neutral, loyalty-neutral BattleResult even before the App settlement guard'
);
assert.match(
  battleModal,
  /const phantomNoPlayerOpeningAction =[\s\S]{0,420}playerCommittedCapitalRef\.current <= 0[\s\S]{0,220}networkRequestCount === 0[\s\S]{0,220}usedSkillIds\.size === 0[\s\S]{0,220}usedBattleSynergyIds\.size === 0[\s\S]{0,220}limitBreakUseCount === 0[\s\S]{0,120}!allianceUsed/,
  'Phantom must distinguish an opening wipe with no committed capital or player route used'
);
assert.match(
  battleModal,
  /: isUltimate[\s\S]{0,100}\? ultimateCapitalCollapseAnalysis[\s\S]{0,100}: phantomNoPlayerOpeningAction[\s\S]{0,520}味方資本の投入\$\{formatCurrency\(playerCommittedCapitalRef\.current\)\}[\s\S]{0,240}所有率0%へ到達[\s\S]{0,240}phantomOpeningDefensePlan[\s\S]{0,120}phantomOpeningFollowUpPlan/,
  'Phantom zero-action advice must preserve Ultimate priority and report evidence plus a concrete opening plan'
);
assert.match(
  battleModal,
  /const phantomOpeningDefensePlan =[\s\S]{0,240}開幕AUTO「\$\{openingAutoSkill\.name\}」を維持[\s\S]{0,160}開幕AUTOをパッセへ変更[\s\S]{0,240}const phantomOpeningFollowUpPlan =[\s\S]{0,260}slice\(0, 2\)[\s\S]{0,180}最初の一手へ固定[\s\S]{0,180}人脈を1社以上編成し、LBを貯めてから再挑戦/,
  'Phantom zero-action advice must tailor defense and one or two truthful available follow-up routes'
);
assert.match(
  saveData,
  /phantomWinStreak\?: number[\s\S]*phantomWinStreak:\s*normalizePhantomWinStreak\(parsed\.phantomWinStreak\)/,
  'Phantom stores one backward-compatible normalized current streak field'
);
assert.match(
  battleSession,
  /'cruel',[\s\S]*'phantom',[\s\S]*'training'/,
  'an interrupted Phantom attempt remains recoverable without masquerading as a normal battle'
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

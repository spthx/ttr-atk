import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readSource = (path: string) =>
  readFileSync(resolve(repositoryRoot, path), 'utf8');

const battleModal = readSource('src/components/BattleModal.tsx');
const app = readSource('src/App.tsx');
const appPage = readSource('app/page.tsx');
const battlePresentation = readSource('src/utils/battlePresentation.ts');
const capitalCss = readSource('src/battle-capital-layer.css');
const integratedCss = readSource('src/battle-integrated-field.css');

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
  /gil-chip-player\.webp/,
  'coin piles must use the compressed WebP coin bundle'
);
assert.match(
  battleModal,
  /const cargo = \{ kind: 'bundle', src: gilChipPlayer \} as const/,
  'every investment preview must use the same small coin bundle'
);
assert.doesNotMatch(
  battleModal,
  /capital-cargo-player|cargo-bag|gil-tower__coins|className=["'`]gil-coin/,
  'the removed bag and CSS-placeholder coin paths must not return'
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
assert.match(
  battleModal,
  /Array\.from\(\{ length: 6 \}/,
  'coin formation DOM must retain its fixed six-slot pool'
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
  /resolveMs: 900,[\s\S]*totalMs: 2_230/,
  'skill effects must retain a readable result beat'
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
  /actionsLocked && primarySkillStateText === '発動可'[\s\S]*'演出待ち'/,
  'a locked ready ability must explain that it is waiting for the presentation'
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

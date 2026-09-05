import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import ts from 'typescript';
import { INITIAL_PROPERTIES, INITIAL_SKILLS, INITIAL_GROUP_SYNERGIES } from '../src/data/initialData';
import { GAME_WORLD } from '../src/data/worldData';
import type { BattleMode, Property } from '../src/types';
import * as balance from '../src/utils/gameBalance';
import { calculateAllianceSupport } from '../src/utils/alliance';
import { getEnemyBaseWaitMs } from '../src/utils/enemyAi';
import { calculateBattleReadiness, type BattleReadinessResult } from '../src/utils/battleReadiness';
import { areAppBackgroundPropsEqual, createReadinessPerformanceCache } from '../src/utils/app-performance';

// Run with: node node_modules/tsx/dist/cli.mjs scripts/check-app-performance.ts
// These are source-backed selector, update-admission and persistence checks.
// They do not measure browser commits, paint time or FPS.
const app = ts.createSourceFile('App.tsx', readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map<string, ts.VariableDeclaration>();
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, node);
  ts.forEachChild(node, visit);
}
visit(app);
function initializer(name: string) {
  const value = declarations.get(name)?.initializer;
  assert.ok(value, `Missing App declaration: ${name}`);
  return value;
}
function call(name: string) {
  const value = initializer(name);
  assert.ok(ts.isCallExpression(value));
  return value;
}
function evaluate<T>(node: ts.Node, bindings: Record<string, unknown> = {}): T {
  const { outputText } = ts.transpileModule(`const result = ${node.getText()};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  return new Function(...Object.keys(bindings), `${outputText}\nreturn result;`)(...Object.values(bindings));
}

const owned = INITIAL_PROPERTIES.slice(0, 12).map((property): Property => ({
  ...property, owner: 'player', ownerName: 'Performance check', loyaltyRisk: 20,
}));
const context = {
  alliance: { active: true },
  battleEquippedSkills: INITIAL_SKILLS,
  industryInfluence: Object.fromEntries(INITIAL_PROPERTIES.map(p => [p.industry, { playerBonus: .1, enemyBudgetDiscount: .1 }])),
  limitBreakCharge: 175,
  ownedProperties: owned,
  properties: [...owned, ...INITIAL_PROPERTIES.slice(12)],
  regionalInfluence: Object.fromEntries(INITIAL_PROPERTIES.map(p => [p.community, { playerBonus: .12, enemyBudgetDiscount: .08 }])),
  savageUnlocked: true,
  selectedBattleSynergy: INITIAL_GROUP_SYNERGIES[0],
  totalFunds: 2_000_000,
  tradeNetworkBonus: .16,
};
const readinessCall = call('getBattleReadinessForTarget');
assert.equal(readinessCall.expression.getText(app), 'useMemo');
const factory = readinessCall.arguments[0];
assert.ok(ts.isArrowFunction(factory) && ts.isCallExpression(factory.body));
const uncachedCalculator = factory.body.arguments[0];
const deps = readinessCall.arguments[1];
assert.ok(ts.isArrayLiteralExpression(deps));
// Audit context dependencies against identifiers actually used in the App calculator.
const used = new Set<string>();
function collectContext(node: ts.Node) {
  if (ts.isIdentifier(node) && Object.hasOwn(context, node.text) &&
      !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) used.add(node.text);
  ts.forEachChild(node, collectContext);
}
collectContext(uncachedCalculator);
for (const name of used) {
  assert.ok(deps.elements.some(dep => dep.getText(app).split('.')[0] === name), `Untracked readiness input: ${name}`);
}
let calculations = 0;
const bindings = {
  ...balance, calculateAllianceSupport, getEnemyBaseWaitMs,
  calculateBattleReadiness: (...args: Parameters<typeof calculateBattleReadiness>) => {
    calculations += 1;
    return calculateBattleReadiness(...args);
  },
  createReadinessPerformanceCache,
  ENEMY_MECHANIC_NAMES: evaluate(initializer('ENEMY_MECHANIC_NAMES')),
};
type Calculator = (property: Property, mode?: BattleMode) => BattleReadinessResult;
function selectors(nextContext = context) {
  const scope = { ...bindings, ...nextContext };
  return {
    cached: evaluate<() => Calculator>(factory, scope)(),
    direct: evaluate<Calculator>(uncachedCalculator, scope),
    dependencies: evaluate<unknown[]>(deps, scope),
  };
}
const modes: BattleMode[] = ['normal', 'savage', 'ultimate', 'cruel', 'karma', 'phantom', 'training'];
const targets = [...INITIAL_PROPERTIES, { ...INITIAL_PROPERTIES[0], reacquisitionLevel: 2 }];
const { cached, direct, dependencies } = selectors();
const beforeInputs = JSON.stringify({ context, targets });
for (const mode of modes) {
  for (const target of targets) {
    assert.deepEqual(cached(target, mode), direct(target, mode));
    const first = cached(target, mode);
    assert.strictEqual(cached(target, mode), first);
  }
}
assert.equal(JSON.stringify({ context, targets }), beforeInputs, 'Readiness must not mutate economy or target data');
assert.strictEqual(cached(targets[0]), cached(targets[0], 'normal'));
const changedTarget = { ...targets[0], marketPrice: targets[0].marketPrice * 2 };
const beforeReplacement = calculations;
assert.deepEqual(cached(changedTarget), direct(changedTarget, 'normal'));
assert.equal(calculations - beforeReplacement, 2, 'Same ID with a replaced property must be recalculated');

const changes: Partial<typeof context>[] = [
  { totalFunds: context.totalFunds + 1 }, { limitBreakCharge: 0 },
  { alliance: { active: false } }, { ownedProperties: [] },
  { properties: [...context.properties] }, { battleEquippedSkills: [] },
  { industryInfluence: {} }, { regionalInfluence: {} },
  { selectedBattleSynergy: null }, { savageUnlocked: false }, { tradeNetworkBonus: 0 },
];
for (const change of changes) {
  const next = selectors({ ...context, ...change });
  assert.ok(next.dependencies.some((value, i) => !Object.is(value, dependencies[i])),
    `Readiness cache must invalidate for ${Object.keys(change).join(', ')}`);
  for (const mode of modes) assert.deepEqual(next.cached(targets[0], mode), next.direct(targets[0], mode));
}
const benchmark = selectors();
calculations = 0;
// Recommendation, accessible totals and the visible card request the same targets.
for (let pass = 0; pass < 3; pass += 1) for (const target of targets) benchmark.direct(target, 'normal');
const directCalls = calculations;
calculations = 0;
for (let pass = 0; pass < 3; pass += 1) for (const target of targets) benchmark.cached(target, 'normal');
const cachedCalls = calculations;
assert.equal(cachedCalls, targets.length);
assert.equal(directCalls, cachedCalls * 3);

const idle = { battleActive: false, children: createElement('section', { 'data-funds': 100 }) };
let lastDelivered: Parameters<typeof areAppBackgroundPropsEqual>[0] = {
  battleActive: true, children: createElement('section', { 'data-funds': 100 }),
};
assert.equal(areAppBackgroundPropsEqual(idle, lastDelivered), false, 'Entry must reach the mounted ledger');
let admittedUpdates = 0;
for (let update = 1; update <= 600; update += 1) {
  const next = { battleActive: true, children: createElement('section', { 'data-lb': update }) };
  if (!areAppBackgroundPropsEqual(lastDelivered, next)) { admittedUpdates += 1; lastDelivered = next; }
}
assert.equal(admittedUpdates, 0);
const settled = { battleActive: false, children: createElement('section', { 'data-funds': 200 }) };
assert.equal(areAppBackgroundPropsEqual(lastDelivered, settled), false, 'Settlement must deliver the latest state');
assert.equal(areAppBackgroundPropsEqual(idle, settled), false, 'Visible ledgers must accept changed inputs');

// Exercise the production event hook with controlled render/commit phases.
// An uncommitted render cannot change handlers on the still-mounted ledger.
const performanceSource = ts.createSourceFile('app-performance.ts',
  readFileSync(new URL('../src/utils/app-performance.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
const eventHook = performanceSource.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === 'useAppEvent');
assert.ok(eventHook);
const hookText = eventHook.getText().replace(/^export /, '');
const eventExpression = ts.createSourceFile('hook.ts', `const hook = ${hookText};`, ts.ScriptTarget.Latest, true);
const eventDeclaration = eventExpression.statements[0] as ts.VariableStatement;
let eventRef: { current: (value: number) => number } | undefined;
let stableEvent: ((value: number) => number) | undefined;
let commit: () => void;
const hook = evaluate<(handler: (value: number) => number) => (value: number) => number>(
  eventDeclaration.declarationList.declarations[0].initializer!, {
    useRef: (current: (value: number) => number) => eventRef ??= { current },
    useCallback: (handler: (value: number) => number) => stableEvent ??= handler,
    useLayoutEffect: (effect: () => void) => { commit = effect; },
  });
const firstEvent = hook(value => value + 100);
commit();
const nextEvent = hook(value => value + 200);
assert.strictEqual(firstEvent, nextEvent);
assert.equal(firstEvent(5), 105, 'Pending render must not leak into a committed event');
commit();
assert.equal(firstEvent(5), 205, 'The mounted event must read current funds/loadout after commit');

const memoPanels = new Set(['Header', 'MarketView', 'PortfolioView', 'SkillsSynergyView', 'CartelAllianceView', 'HighEndRaidView', 'BattleModal']);
function checkCallbacks(node: ts.Node) {
  if (ts.isJsxSelfClosingElement(node) && memoPanels.has(node.tagName.getText(app))) {
    for (const prop of node.attributes.properties) {
      if (!ts.isJsxAttribute(prop) || !prop.initializer || !ts.isJsxExpression(prop.initializer)) continue;
      const name = prop.name.getText(app);
      if (!name.startsWith('on') && !name.startsWith('set') && name !== 'getStrengthComparison') continue;
      const expression = prop.initializer.expression;
      assert.ok(expression && !ts.isArrowFunction(expression) && !ts.isFunctionExpression(expression),
        `${node.tagName.getText(app)}.${name} must not allocate an inline callback`);
    }
  }
  ts.forEachChild(node, checkCallbacks);
}
checkCallbacks(app);

const saveContext = {
  GAME_WORLD, companyName: ' Check ', totalFunds: 100, properties: INITIAL_PROPERTIES,
  equippedSkillIds: ['skill_sabotage'], effectiveAbilityLoadout: { openingAutoSkillId: null, criticalAutoSkillId: null },
  alliance: { active: false }, seenUnlockIds: [], limitBreakCharge: 50,
  savageClearedPropertyIds: [], normalEndingSeen: false, conqueredCommunityIds: [],
  savageEndingSeen: false, ultimateCleared: false, cruelCleared: false, karmaCleared: false,
  phantomWinStreak: 0, trueEndingSeen: false, selectedBattleSynergyId: null, grandCompanyEorzeaIntegrated: false,
};
const saveCall = call('savePayload');
const savePayload = evaluate<() => Record<string, unknown>>(saveCall.arguments[0], saveContext)();
assert.equal(savePayload.companyName, 'Check');
assert.strictEqual(savePayload.properties, INITIAL_PROPERTIES);
assert.equal(savePayload.reserveSkillId, null);
assert.equal(savePayload.passiveIncomePaused, false);
assert.equal(savePayload.savageProgressVersion, 3);
assert.equal(savePayload.limitBreakCharge, 50);
const saved: unknown[] = [];
let storageOK = false;
let warning: unknown;
const persist = evaluate<(overrides?: Record<string, unknown>) => boolean>(call('persistGameState').arguments[0], {
  savePayload, saveGame: (payload: unknown) => { saved.push(payload); return storageOK; },
  setStorageWarning: (value: unknown) => { warning = value; },
});
assert.equal(persist({ totalFunds: 250 }), false);
assert.ok(warning);
storageOK = true;
assert.equal(persist({ totalFunds: 250 }), true);
assert.equal(warning, null);
assert.deepEqual(saved[1], { ...savePayload, totalFunds: 250 });
assert.equal(savePayload.totalFunds, 100, 'Settlement overrides cannot mutate the current snapshot');

const deferredBattleIncomeRef = { current: 75 };
const actions: string[] = [];
const close = evaluate<() => void>(call('handleCloseBattle').arguments[0], {
  totalFunds: 100, deferredBattleIncomeRef,
  persistGameState: (overrides: { totalFunds: number }) => {
    assert.equal(overrides.totalFunds, 175); actions.push('save'); return storageOK;
  },
  setTotalFunds: (value: number) => { assert.equal(value, 175); actions.push('funds'); },
  clearPendingBattleSession: () => actions.push('clear-recovery'),
  setActiveBattleProperty: () => actions.push('close'),
  setActiveBattleMode: () => actions.push('normal'),
});
storageOK = false;
close();
assert.deepEqual(actions, ['save']);
assert.equal(deferredBattleIncomeRef.current, 75);
storageOK = true;
actions.length = 0;
close();
assert.deepEqual(actions, ['save', 'funds', 'clear-recovery', 'close', 'normal']);
assert.equal(deferredBattleIncomeRef.current, 0);

// Execute App's autosave effect itself with a controlled clock. Battle LB ticks
// must never write the authoritative save or consume the pending-battle marker.
const effects: ts.CallExpression[] = [];
function collectEffects(node: ts.Node) {
  if (ts.isCallExpression(node) && node.expression.getText(app) === 'useEffect') effects.push(node);
  ts.forEachChild(node, collectEffects);
}
collectEffects(app);
const autosave = effects.find(effect => effect.arguments[1]?.getText(app).includes('savePayload'));
assert.ok(autosave);
let writes = 0;
let delay = 0;
let pending: (() => void) | undefined;
const clock = {
  setTimeout: (callback: () => void, ms: number) => { pending = callback; delay = ms; return 1; },
  clearTimeout: () => { pending = undefined; },
};
const runAutosave = (activeBattleProperty: Property | null, showLaunchIntro = false) =>
  evaluate<() => (() => void) | undefined>(autosave.arguments[0], {
    activeBattleProperty, showLaunchIntro, window: clock, persistGameState: () => { writes += 1; },
  })();
runAutosave(targets[0]);
assert.equal(pending, undefined);
runAutosave(null, true);
assert.equal(pending, undefined);
const cancelSave = runAutosave(null);
assert.equal(delay, 400);
assert.equal(writes, 0);
cancelSave?.();
assert.equal(pending, undefined);
runAutosave(null);
pending?.();
assert.equal(writes, 1);

console.log(`readiness: ${directCalls} -> ${cachedCalls} calculations for three passes (${targets.length} targets)`);
console.log(`covered ledger: 600 parent updates -> ${admittedUpdates} admitted updates; entry/settlement refresh verified`);
console.log(`equivalence: ${targets.length * modes.length} target/mode pairs + ${changes.length} dependency changes; no input mutation`);
console.log('callbacks: stable identity, latest committed inputs and memo-panel callback props verified');
console.log('save: 400 ms debounce, battle/intro suppression, settlement failure/retry and deferred income verified');

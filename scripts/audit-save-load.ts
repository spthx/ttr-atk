import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  INITIAL_GROUP_SYNERGIES,
  INITIAL_PROPERTIES,
  INITIAL_SKILLS,
} from '../src/data/initialData';
import { COMMUNITY_CAMPAIGN_ORDER } from '../src/data/worldData';
import {
  SAVE_SCHEMA_VERSION,
  SAVE_STORAGE_KEY,
  LEGACY_COMPANY_NAME_KEY,
  calculateOfflineIncome,
  clearGameSave,
  loadGameSave,
  normalizeLimitBreakCharge,
  restoreProperties,
  saveGame,
  type GameSaveData,
} from '../src/utils/saveData';
import {
  PENDING_BATTLE_RECOVERY_KEY,
  PENDING_BATTLE_SESSION_KEY,
  PENDING_BATTLE_SESSION_MAX_AGE_MS,
  clearPendingBattleSession,
  loadPendingBattleSession,
  parsePendingBattleSession,
  persistPendingBattleSession,
} from '../src/utils/battleSession';
import { LIMIT_BREAK_MAX_CHARGE } from '../src/utils/gameBalance';
import { SAVAGE_RAID_DEFINITIONS } from '../src/utils/savage';
import type { AllianceState, OwnerType, Property } from '../src/types';

const ITERATIONS = Math.max(1_000, Number(process.env.TATARU_SAVE_AUDIT_ITERATIONS ?? 1_000));

class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }
  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }
  int(max: number) {
    return Math.floor(this.next() * Math.max(1, max));
  }
  bool(probability = 0.5) {
    return this.next() < probability;
  }
  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)];
  }
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  failGet = false;
  failSet = false;
  failRemove = false;

  get length() {
    return this.values.size;
  }
  clear() {
    if (this.failRemove) throw new DOMException('blocked', 'SecurityError');
    this.values.clear();
  }
  getItem(key: string) {
    if (this.failGet) throw new DOMException('blocked', 'SecurityError');
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    if (this.failRemove) throw new DOMException('blocked', 'SecurityError');
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failSet) throw new DOMException('quota', 'QuotaExceededError');
    this.values.set(key, String(value));
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
const originalWindow = globalThis.window;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage, sessionStorage },
});

const ownerTypes: OwnerType[] = ['player', 'independent', 'dofor', 'abyss'];
const validSkillIds = INITIAL_SKILLS.map((skill) => skill.id);
const validSynergyIds = INITIAL_GROUP_SYNERGIES.map((synergy) => synergy.id);
const savageIds = SAVAGE_RAID_DEFINITIONS.map((raid) => raid.id);

function randomAlliance(rng: SeededRandom): AllianceState {
  if (!rng.bool(0.45)) {
    return {
      allyId: '',
      allyName: '',
      active: false,
      allyKind: 'company',
      relationType: 'commercial_alliance',
    };
  }
  const publicPatronage = rng.bool(0.25);
  return {
    allyId: `ally-${rng.int(20)}`,
    allyName: publicPatronage ? '監査グランドカンパニー' : '監査協力商会',
    active: true,
    allyKind: publicPatronage ? 'grand_company' : 'company',
    relationType: publicPatronage ? 'public_patronage' : 'commercial_alliance',
  };
}

function randomProperties(rng: SeededRandom): Property[] {
  return INITIAL_PROPERTIES.map((property, index) => {
    const owner = rng.pick(ownerTypes);
    return {
      ...property,
      owner,
      ownerName:
        owner === 'player'
          ? `監査商会-${index}`
          : owner === 'independent'
            ? '独立物件'
            : property.ownerName,
      loyaltyRisk: rng.int(101),
      reacquisitionLevel: rng.int(3),
    };
  });
}

function randomSubset<T>(items: readonly T[], rng: SeededRandom, probability = 0.5) {
  return items.filter(() => rng.bool(probability));
}

function expectedAlliance(alliance: AllianceState): AllianceState {
  const allyKind = alliance.allyKind === 'grand_company' ? 'grand_company' : 'company';
  return {
    allyId: alliance.allyId,
    allyName: alliance.allyName,
    active: alliance.active,
    allyKind,
    relationType: allyKind === 'grand_company' ? 'public_patronage' : 'commercial_alliance',
  };
}

function makePayload(index: number, rng: SeededRandom): Omit<GameSaveData, 'schemaVersion' | 'lastSavedAt'> {
  const conqueredCount = rng.int(COMMUNITY_CAMPAIGN_ORDER.length + 1);
  const ultimateCleared = rng.bool(0.2);
  const trueEndingSeen = ultimateCleared && rng.bool(0.5);
  return {
    companyName: `  監査商会${index}  `,
    totalFunds: rng.int(4_000_000_000),
    properties: randomProperties(rng),
    equippedSkillIds: randomSubset(validSkillIds, rng, 0.35),
    alliance: randomAlliance(rng),
    seenUnlockIds: randomSubset(
      [
        'market_wind',
        'rival_wind',
        'turbulent_wind',
        'subsidiary_support',
        'light_party_limit_break',
        'guild_synergy',
        'living_dead_skill',
        'full_party',
        'trade_alliance',
      ],
      rng,
      0.45,
    ),
    limitBreakCharge: rng.int(LIMIT_BREAK_MAX_CHARGE + 1),
    savageClearedPropertyIds: randomSubset(savageIds, rng, 0.5),
    savageProgressVersion: 2,
    normalEndingSeen: rng.bool(0.5),
    conqueredCommunityIds: COMMUNITY_CAMPAIGN_ORDER.slice(0, conqueredCount),
    savageEndingSeen: rng.bool(0.35),
    ultimateCleared,
    trueEndingSeen,
    selectedBattleSynergyId: rng.bool(0.5) ? rng.pick(validSynergyIds) : null,
    passiveIncomePaused: false,
  };
}

function verifyRoundTrip(payload: Omit<GameSaveData, 'schemaVersion' | 'lastSavedAt'>) {
  const before = Date.now();
  saveGame(payload);
  const loaded = loadGameSave();
  const after = Date.now();
  assert.ok(loaded, 'valid save must load');
  assert.equal(loaded.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(loaded.companyName, payload.companyName.trim());
  assert.equal(loaded.totalFunds, Math.max(0, payload.totalFunds));
  assert.deepEqual(loaded.equippedSkillIds, payload.equippedSkillIds);
  assert.deepEqual(loaded.alliance, expectedAlliance(payload.alliance));
  assert.deepEqual(loaded.seenUnlockIds, payload.seenUnlockIds);
  assert.equal(loaded.limitBreakCharge, normalizeLimitBreakCharge(payload.limitBreakCharge));
  assert.deepEqual(loaded.savageClearedPropertyIds, payload.savageClearedPropertyIds);
  assert.equal(loaded.savageProgressVersion, 2);
  assert.equal(loaded.normalEndingSeen, payload.normalEndingSeen === true);
  assert.deepEqual(loaded.conqueredCommunityIds, payload.conqueredCommunityIds);
  assert.equal(loaded.savageEndingSeen, payload.savageEndingSeen === true);
  assert.equal(loaded.ultimateCleared, payload.ultimateCleared === true);
  assert.equal(
    loaded.trueEndingSeen,
    payload.ultimateCleared === true && payload.trueEndingSeen === true,
  );
  assert.equal(loaded.selectedBattleSynergyId, payload.selectedBattleSynergyId);
  assert.equal(loaded.passiveIncomePaused, false);
  assert.ok(loaded.lastSavedAt >= before && loaded.lastSavedAt <= after);
  assert.equal(loaded.properties.length, payload.properties.length);

  const restored = restoreProperties(loaded);
  assert.equal(restored.length, INITIAL_PROPERTIES.length);
  for (const initial of INITIAL_PROPERTIES) {
    const saved = payload.properties.find((property) => property.id === initial.id)!;
    const actual = restored.find((property) => property.id === initial.id)!;
    assert.equal(actual.owner, saved.owner);
    assert.equal(actual.loyaltyRisk, Math.max(0, Math.min(100, saved.loyaltyRisk)));
    assert.equal(
      actual.reacquisitionLevel,
      Math.max(0, Math.min(2, Math.floor(saved.reacquisitionLevel ?? 0))),
    );
    assert.equal(
      actual.ownerName,
      saved.owner === 'player'
        ? saved.ownerName
        : saved.owner === 'independent'
          ? '独立物件'
          : initial.ownerName,
    );
  }
}

function makeLegacyPayload(index: number, rng: SeededRandom) {
  return {
    schemaVersion: 3,
    companyName: `旧監査商会${index}`,
    totalFunds: rng.int(1_000_000),
    properties: [],
    equippedSkillIds: [],
    alliance: {
      allyId: '',
      allyName: '',
      active: false,
    },
    lastSavedAt: 1,
  };
}

function randomGarbage(rng: SeededRandom): string {
  const modes = [
    () => '{',
    () => 'null',
    () => '[]',
    () => JSON.stringify({ schemaVersion: rng.int(10) }),
    () => JSON.stringify({ schemaVersion: 3, companyName: 4 }),
    () =>
      JSON.stringify({
        schemaVersion: 3,
        companyName: '壊れた商会',
        totalFunds: 'many',
        properties: [],
        equippedSkillIds: [],
        alliance: { allyId: '', allyName: '', active: false },
        lastSavedAt: 1,
      }),
  ];
  return rng.pick(modes)();
}

function validPendingProperty(index: number) {
  const property = INITIAL_PROPERTIES[index % INITIAL_PROPERTIES.length];
  return { ...property };
}

async function main() {
  const rng = new SeededRandom(0x5a17e202);
  const failures: string[] = [];
  const findings: Array<{ severity: 'high' | 'medium' | 'low'; title: string; detail: string }> = [];
  const counts = {
    validRoundTrips: 0,
    legacyMigrations: 0,
    malformedReads: 0,
    pendingRoundTrips: 0,
    pendingInvalidations: 0,
    offlineIncomeChecks: 0,
  };

  for (let index = 0; index < ITERATIONS; index += 1) {
    try {
      verifyRoundTrip(makePayload(index, rng));
      counts.validRoundTrips += 1;
    } catch (error) {
      failures.push(`roundtrip ${index}: ${String(error)}`);
    }
  }

  for (let index = 0; index < ITERATIONS; index += 1) {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(makeLegacyPayload(index, rng)));
    try {
      const loaded = loadGameSave();
      assert.ok(loaded);
      assert.equal(loaded.limitBreakCharge, 0);
      assert.deepEqual(loaded.savageClearedPropertyIds, []);
      assert.deepEqual(loaded.conqueredCommunityIds, []);
      assert.equal(loaded.passiveIncomePaused, false);
      assert.equal(loaded.selectedBattleSynergyId, null);
      counts.legacyMigrations += 1;
    } catch (error) {
      failures.push(`legacy ${index}: ${String(error)}`);
    }
  }

  for (let index = 0; index < ITERATIONS; index += 1) {
    localStorage.setItem(SAVE_STORAGE_KEY, randomGarbage(rng));
    try {
      assert.equal(loadGameSave(), null);
      counts.malformedReads += 1;
    } catch (error) {
      failures.push(`malformed ${index}: ${String(error)}`);
    }
  }

  const now = 1_900_000_000_000;
  for (let index = 0; index < ITERATIONS; index += 1) {
    const property = validPendingProperty(index);
    const startedAt = now - rng.int(PENDING_BATTLE_SESSION_MAX_AGE_MS);
    const raw = JSON.stringify({
      version: 1,
      mode: rng.pick(['normal', 'savage', 'ultimate', 'training'] as const),
      targetProperty: property,
      startedAt,
    });
    const parsed = parsePendingBattleSession(raw, now);
    if (!parsed || parsed.targetProperty.id !== property.id) {
      failures.push(`pending parse ${index}: valid session rejected`);
    } else {
      counts.pendingRoundTrips += 1;
    }

    const stale = JSON.stringify({
      version: 1,
      mode: 'normal',
      targetProperty: property,
      startedAt: now - PENDING_BATTLE_SESSION_MAX_AGE_MS - 1 - index,
    });
    if (parsePendingBattleSession(stale, now) !== null) {
      failures.push(`pending stale ${index}: stale session accepted`);
    } else {
      counts.pendingInvalidations += 1;
    }
  }

  for (let index = 0; index < ITERATIONS; index += 1) {
    const revenue = rng.int(10_000_000);
    const elapsed = rng.int(20_000) - 2_000;
    const lastSavedAt = now - elapsed * 1_000;
    const income = calculateOfflineIncome(revenue, lastSavedAt, now);
    const expectedSeconds = Math.max(0, Math.min(30 * 60, Math.floor(elapsed)));
    if (income !== Math.floor(revenue * expectedSeconds) || income < 0) {
      failures.push(`offline ${index}: expected ${revenue * expectedSeconds}, got ${income}`);
    } else {
      counts.offlineIncomeChecks += 1;
    }
  }

  // Durable pending-battle fallback is deliberately protected by try/catch.
  sessionStorage.failSet = true;
  localStorage.failSet = false;
  persistPendingBattleSession('normal', INITIAL_PROPERTIES[0], now);
  const durablePending = loadPendingBattleSession();
  if (durablePending?.targetProperty.id !== INITIAL_PROPERTIES[0].id) {
    failures.push('pending battle durable fallback failed when sessionStorage was blocked');
  }
  sessionStorage.failSet = false;
  clearPendingBattleSession();

  // Main save writes are not protected. Record the behavior without failing the audit process.
  localStorage.failSet = true;
  let saveWriteThrew = false;
  try {
    saveGame(makePayload(ITERATIONS + 1, rng));
  } catch {
    saveWriteThrew = true;
  }
  localStorage.failSet = false;
  if (saveWriteThrew) {
    findings.push({
      severity: 'high',
      title: 'localStorage書込み不能時に通常セーブが例外終了する',
      detail:
        '戦闘中断セッションは例外を握って永続ミラーへフォールバックしますが、saveGame本体はQuotaExceededError/SecurityErrorを捕捉しません。iOSプライベートブラウズ、容量超過、WebContent異常時に自動保存処理へ例外が伝播します。',
    });
  }

  localStorage.failRemove = true;
  let clearThrew = false;
  try {
    clearGameSave();
  } catch {
    clearThrew = true;
  }
  localStorage.failRemove = false;
  if (clearThrew) {
    findings.push({
      severity: 'medium',
      title: 'ストレージ削除不能時にセーブ初期化が例外終了する',
      detail: 'clearGameSaveはremoveItemをtry/catchしていないため、ブラウザがStorageを拒否すると初期化操作が完了しません。',
    });
  }

  // Runtime validation gaps that valid JSON can exploit or inherit from future/old builds.
  const invalidOwnerPayload = makePayload(ITERATIONS + 2, rng) as unknown as Record<string, unknown>;
  const invalidOwnerProperties = structuredClone(invalidOwnerPayload.properties as object[]) as Array<Record<string, unknown>>;
  invalidOwnerProperties[0].owner = 'unknown-owner';
  invalidOwnerPayload.properties = invalidOwnerProperties;
  invalidOwnerPayload.schemaVersion = 3;
  invalidOwnerPayload.lastSavedAt = now;
  localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(invalidOwnerPayload));
  const invalidOwnerLoaded = loadGameSave();
  const invalidOwnerRestored = restoreProperties(invalidOwnerLoaded);
  if (invalidOwnerRestored[0].owner === ('unknown-owner' as OwnerType)) {
    findings.push({
      severity: 'medium',
      title: 'セーブ内のowner文字列が列挙値として検証されない',
      detail:
        'isSavedPropertyはownerがstringであることだけを確認します。未知ownerが復元後のPropertyへ残り、市場表示・所有判定・収益判定の不整合を起こせます。',
    });
  }

  const blankNamePayload = makePayload(ITERATIONS + 3, rng) as unknown as Record<string, unknown>;
  blankNamePayload.companyName = '   ';
  blankNamePayload.schemaVersion = 3;
  blankNamePayload.lastSavedAt = now;
  localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(blankNamePayload));
  if (loadGameSave()?.companyName === '') {
    findings.push({
      severity: 'low',
      title: '空白だけの商会名が空文字としてロードされる',
      detail: '通常UIではフォールバック名を使いますが、保存層単体では空文字を有効データとして返します。',
    });
  }

  const forgedPending = JSON.stringify({
    version: 1,
    mode: 'normal',
    targetProperty: {
      ...INITIAL_PROPERTIES[0],
      id: 'forged-property',
      community: '存在しない都市',
      industry: '存在しない業界',
      marketPrice: 9_999_999_999,
    },
    startedAt: now,
  });
  if (parsePendingBattleSession(forgedPending, now)?.targetProperty.id === 'forged-property') {
    findings.push({
      severity: 'medium',
      title: '中断戦闘の物件ID・都市・業界が現行データと照合されない',
      detail:
        '型がstring/numberであれば未知の物件を再開できます。破損・古いデータ・手動改変で高額な架空戦闘を開けるため、INITIAL_PROPERTIES/高難度定義との照合が必要です。',
    });
  }

  localStorage.setItem(LEGACY_COMPANY_NAME_KEY, '監査旧名');
  clearGameSave();
  if (
    localStorage.getItem(SAVE_STORAGE_KEY) !== null ||
    localStorage.getItem(LEGACY_COMPANY_NAME_KEY) !== null
  ) {
    failures.push('clearGameSave did not remove both save keys');
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    iterationsPerCoreCase: ITERATIONS,
    counts,
    failures,
    findings,
    verdict:
      failures.length === 0
        ? findings.some((finding) => finding.severity === 'high')
          ? 'round-trip logic passed, but browser-storage write failure is not contained'
          : 'passed'
        : 'failed',
  };

  const markdown = [
    '# タタルの大繁盛店 セーブ／ロード監査',
    '',
    `生成日時: ${report.generatedAt}`,
    '',
    '## 実行結果',
    '',
    `- 正常セーブ往復: ${counts.validRoundTrips.toLocaleString('ja-JP')} / ${ITERATIONS.toLocaleString('ja-JP')}`,
    `- 旧schema v3移行: ${counts.legacyMigrations.toLocaleString('ja-JP')} / ${ITERATIONS.toLocaleString('ja-JP')}`,
    `- 破損JSON拒否: ${counts.malformedReads.toLocaleString('ja-JP')} / ${ITERATIONS.toLocaleString('ja-JP')}`,
    `- 中断戦闘の正常復元: ${counts.pendingRoundTrips.toLocaleString('ja-JP')} / ${ITERATIONS.toLocaleString('ja-JP')}`,
    `- 期限切れ中断戦闘の拒否: ${counts.pendingInvalidations.toLocaleString('ja-JP')} / ${ITERATIONS.toLocaleString('ja-JP')}`,
    `- オフライン収益境界値: ${counts.offlineIncomeChecks.toLocaleString('ja-JP')} / ${ITERATIONS.toLocaleString('ja-JP')}`,
    `- アサーション失敗: ${failures.length}`,
    '',
    '## 判定',
    '',
    failures.length === 0
      ? '通常データの1000回往復、旧データ移行、破損拒否、2時間以内の戦闘中断復帰、30分上限のオフライン収益はすべて一致しました。'
      : `再現可能な失敗が${failures.length}件あります。JSONを確認してください。`,
    '',
    '## 発見事項',
    '',
    ...findings.flatMap((finding) => [
      `### ${finding.severity.toUpperCase()}: ${finding.title}`,
      '',
      finding.detail,
      '',
    ]),
    '## 優先修正',
    '',
    '1. saveGameとclearGameSaveのStorage操作をtry/catchし、保存失敗状態をUIへ返す。',
    '2. ownerをplayer/independent/dofor/abyssへ限定して検証する。',
    '3. 中断戦闘のtargetPropertyを現行の通常・零式・絶・木人定義へID照合し、保存オブジェクト全体ではなくIDとmodeだけを永続化する。',
    '',
  ].join('\n');

  await mkdir('artifacts/tataru-save-load', { recursive: true });
  await writeFile(
    'artifacts/tataru-save-load/report.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  await writeFile('artifacts/tataru-save-load/report.md', markdown, 'utf8');
  console.log(markdown);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

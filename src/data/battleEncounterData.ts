/**
 * Authored battle content shared by the web runtime, validation scripts, and a
 * future Unity/editor exporter. Values in this file describe content; battle
 * state and timers remain in the runtime.
 */
export type EnemySupportSkillId =
  | 'divine_benison'
  | 'drain'
  | 'drill'
  | 'divination'
  | 'rapid_assault'
  | 'limit_break_3'
  | 'omnicapitalization'
  | 'cruel_reckoning';

export type EnemyActionInterruptibility =
  | 'interruptible'
  | 'delay_only'
  | 'unstoppable';

export interface EnemySupportActionDefinition {
  id: EnemySupportSkillId;
  jobName: string;
  actionName: string;
  telegraphText: string;
  artKey:
    | 'whiteMage'
    | 'blackMage'
    | 'machinist'
    | 'astrologian'
    | 'bard'
    | 'warrior'
    | 'darkTataru';
  telegraphMs: number;
  castMs: number;
  impactMs: number;
  afterglowMs: number;
  leavingMs: number;
  interruptibility: EnemyActionInterruptibility;
}

export const ENEMY_SUPPORT_ACTIONS: Record<
  EnemySupportSkillId,
  EnemySupportActionDefinition
> = {
  divine_benison: {
    id: 'divine_benison',
    jobName: 'WHITE MAGE',
    actionName: 'ディヴァインベニゾン',
    telegraphText: '白魔道士が障壁展開の構え',
    artKey: 'whiteMage',
    telegraphMs: 1_800,
    castMs: 1_100,
    impactMs: 360,
    afterglowMs: 720,
    leavingMs: 620,
    interruptibility: 'interruptible',
  },
  drain: {
    id: 'drain',
    jobName: 'ENEMY MAGE',
    actionName: 'ドレイン',
    telegraphText: '敵術師が資金吸収の構え',
    artKey: 'blackMage',
    telegraphMs: 1_900,
    castMs: 800,
    impactMs: 300,
    afterglowMs: 700,
    leavingMs: 620,
    interruptibility: 'interruptible',
  },
  drill: {
    id: 'drill',
    jobName: 'MACHINIST',
    actionName: '整備 → ドリル',
    telegraphText: '機工士が狙撃の構え',
    artKey: 'machinist',
    telegraphMs: 1_850,
    castMs: 1_000,
    impactMs: 420,
    afterglowMs: 780,
    leavingMs: 650,
    interruptibility: 'interruptible',
  },
  divination: {
    id: 'divination',
    jobName: 'ASTROLOGIAN',
    actionName: 'ディヴィネーション',
    telegraphText: '占星術師が相場誘導の構え',
    artKey: 'astrologian',
    telegraphMs: 1_700,
    castMs: 1_050,
    impactMs: 360,
    afterglowMs: 760,
    leavingMs: 650,
    interruptibility: 'interruptible',
  },
  rapid_assault: {
    id: 'rapid_assault',
    jobName: 'BARD',
    actionName: '疾風怒濤の陣',
    telegraphText: '吟遊詩人が速攻支援の構え',
    artKey: 'bard',
    telegraphMs: 1_700,
    castMs: 850,
    impactMs: 340,
    afterglowMs: 720,
    leavingMs: 620,
    interruptibility: 'interruptible',
  },
  limit_break_3: {
    id: 'limit_break_3',
    jobName: 'ENEMY ALLIANCE',
    actionName: 'LIMIT BREAK 3',
    telegraphText: '競合連合が限界突破の構え',
    artKey: 'warrior',
    telegraphMs: 2_500,
    castMs: 1_200,
    impactMs: 520,
    afterglowMs: 1_000,
    leavingMs: 720,
    interruptibility: 'delay_only',
  },
  omnicapitalization: {
    id: 'omnicapitalization',
    jobName: 'DARK TATARU',
    actionName: '星海資本の宣告',
    telegraphText: '闇タタルが星海資本の宣告を開始',
    artKey: 'darkTataru',
    telegraphMs: 4_500,
    castMs: 850,
    impactMs: 620,
    afterglowMs: 1_100,
    leavingMs: 720,
    interruptibility: 'unstoppable',
  },
  cruel_reckoning: {
    id: 'cruel_reckoning',
    jobName: 'DARK TATARU',
    actionName: '終極資本査定',
    telegraphText: '闇タタルが終極資本査定を開始',
    artKey: 'darkTataru',
    telegraphMs: 12_000,
    castMs: 850,
    impactMs: 620,
    afterglowMs: 1_100,
    leavingMs: 720,
    interruptibility: 'unstoppable',
  },
};

/**
 * One finite barrier contract shared by the player and enemy implementation.
 * Gauge capacity 24 equals 12 ownership points: it stops LB1, heavily softens
 * LB2, and deliberately cannot erase LB3.
 */
export const DIVINE_BENISON_BALANCE = {
  durationMs: 8_000,
  absorbRatio: 1,
  gaugeCapacity: 24,
  triggerPlayerOwnership: 52,
  maxUsesPerBattle: 1,
} as const;

export const ENEMY_SUPPORT_SKILL_BALANCE = {
  divineBenison: DIVINE_BENISON_BALANCE,
  drain: {
    handCashRatio: 0.18,
    marketPriceCapRatio: 0.1,
    maxUsesPerBattle: 1,
  },
  cashRecovery: {
    passiveRecoveryCapRatio: 0.12,
  },
  drill: {
    normalOwnershipPush: 5,
    savageOwnershipPush: 8,
    ultimateOwnershipPush: 10,
    reserveCostRatio: 0.06,
  },
  divination: {
    normalDurationMs: 4_000,
    highDifficultyDurationMs: 5_000,
    enemyInvestmentMultiplier: 1.42,
  },
  rapidAssault: {
    durationMs: 13_000,
    actionProgressMultiplier: 2.05,
  },
  limitBreak3: {
    ownershipPush: 30,
    gaugeDelta: 60,
    capitalSupportRatio: 0.18,
    stunDelayMs: 2_400,
    momentumHoldMs: 1_200,
  },
} as const;

export const SAVAGE_ENEMY_SUPPORT_PROFILES = [
  [
    ['divine_benison'],
    ['drain', 'divination'],
    ['divination'],
    ['divine_benison', 'drill', 'divination'],
  ],
  [
    ['drain'],
    ['divine_benison', 'divination'],
    ['drain', 'rapid_assault'],
    ['divine_benison', 'divination', 'rapid_assault', 'limit_break_3'],
  ],
  [
    ['divine_benison', 'divination'],
    ['drill'],
    ['drain', 'rapid_assault'],
    ['drill', 'divination', 'limit_break_3'],
  ],
] as const satisfies readonly (readonly (readonly EnemySupportSkillId[])[])[];

export const SAVAGE_ENEMY_AUTO_PROFILES = [
  [
    { opening: null, critical: null },
    { opening: null, critical: null },
    { opening: 'rapid_assault', critical: null },
    { opening: 'divine_benison', critical: 'drill' },
  ],
  [
    { opening: null, critical: null },
    { opening: null, critical: null },
    { opening: 'divination', critical: null },
    { opening: 'divination', critical: 'limit_break_3' },
  ],
  [
    { opening: null, critical: null },
    { opening: null, critical: null },
    { opening: 'divination', critical: null },
    { opening: 'rapid_assault', critical: 'limit_break_3' },
  ],
] as const satisfies readonly (readonly {
  opening: EnemySupportSkillId | null;
  critical: EnemySupportSkillId | null;
}[])[];

export const ULTIMATE_ENEMY_AUTO_PATTERNS = [
  { id: 'drain_drill', opening: 'drain', critical: 'drill' },
  {
    id: 'divination_divine_benison',
    opening: 'divination',
    critical: 'divine_benison',
  },
  { id: 'rapid_assault_drill', opening: 'rapid_assault', critical: 'drill' },
  { id: 'drain_limit_break_3', opening: 'drain', critical: 'limit_break_3' },
  {
    id: 'limit_break_3_divine_benison',
    opening: 'limit_break_3',
    critical: 'divine_benison',
  },
  {
    id: 'rapid_assault_limit_break_3',
    opening: 'rapid_assault',
    critical: 'limit_break_3',
  },
] as const satisfies readonly {
  id: string;
  opening: EnemySupportSkillId;
  critical: EnemySupportSkillId;
}[];

export type CruelScriptPhase =
  | 'inactive'
  | 'awaiting_first'
  | 'first_countdown'
  | 'recovery'
  | 'second_countdown'
  | 'second_failed'
  | 'resolved';

export const CRUEL_SCRIPTED_BATTLE = {
  firstTriggerActiveMs: 15_000,
  firstActionId: 'omnicapitalization' as EnemySupportSkillId,
  firstImpactPlayerOwnership: 10,
  recoveryEnemyPressureMultiplier: 0.58,
  secondTriggerPlayerOwnership: 50,
  forcedSecondTriggerRecoveryMs: 35_000,
  secondActionId: 'cruel_reckoning' as EnemySupportSkillId,
  successPlayerOwnership: 75,
  secondFailureOutcome: 'player_defeat',
  secondFailureDisplayedOwnership: 0,
  bossBreakCapitalRatio: 0.28,
} as const;

/**
 * Stable, JSON-serializable boundary for a future Unity importer and the
 * Daifuku content editor. Runtime helpers deliberately stay outside this
 * object so JSON.stringify() never loses functions or browser-only values.
 */
export const BATTLE_CONTENT_SCHEMA_VERSION = 2;

export const BATTLE_CONTENT_MANIFEST = {
  schemaVersion: BATTLE_CONTENT_SCHEMA_VERSION,
  enemySupportActions: Object.values(ENEMY_SUPPORT_ACTIONS),
  divineBenisonBalance: DIVINE_BENISON_BALANCE,
  enemySupportBalance: ENEMY_SUPPORT_SKILL_BALANCE,
  savageSupportProfiles: SAVAGE_ENEMY_SUPPORT_PROFILES,
  savageAutoProfiles: SAVAGE_ENEMY_AUTO_PROFILES,
  ultimateAutoPatterns: ULTIMATE_ENEMY_AUTO_PATTERNS,
  cruelScriptedBattle: CRUEL_SCRIPTED_BATTLE,
} as const;

export const getEnemyActionInterruptibility = (
  skillId: EnemySupportSkillId
) => ENEMY_SUPPORT_ACTIONS[skillId].interruptibility;

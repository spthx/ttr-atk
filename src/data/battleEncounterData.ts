/**
 * Authored battle content shared by the web runtime, validation scripts, and a
 * future Unity/editor exporter. Values in this file describe content; battle
 * state and timers remain in the runtime.
 */
export type EnemySupportSkillId =
  | 'blackest_night'
  | 'drain'
  | 'drill'
  | 'divination'
  | 'rapid_assault'
  | 'limit_break_3'
  | 'capital_reversal'
  | 'forced_liquidation'
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
    | 'darkKnight'
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
  blackest_night: {
    id: 'blackest_night',
    jobName: 'DARK KNIGHT',
    actionName: 'ブラックナイト',
    telegraphText: '暗黒騎士が最強の単体バリアを展開',
    artKey: 'darkKnight',
    telegraphMs: 1_800,
    castMs: 1_100,
    impactMs: 360,
    afterglowMs: 720,
    leavingMs: 620,
    interruptibility: 'unstoppable',
  },
  drain: {
    id: 'drain',
    jobName: 'ENEMY MAGE',
    actionName: 'ドレイン',
    telegraphText: '未投入資金ドレイン――直接出資で退避',
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
    actionName: '疾風怒濤',
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
  capital_reversal: {
    id: 'capital_reversal',
    jobName: 'ENEMY BROKER',
    actionName: '資本反転',
    telegraphText: '競合仲介人が次の直接出資を反転契約に接続',
    artKey: 'astrologian',
    telegraphMs: 2_700,
    castMs: 800,
    impactMs: 360,
    afterglowMs: 720,
    leavingMs: 620,
    interruptibility: 'unstoppable',
  },
  forced_liquidation: {
    id: 'forced_liquidation',
    jobName: 'ENEMY ALLIANCE',
    actionName: '強制清算',
    telegraphText: '強制清算――所有率3%へ。着弾直後の反撃を1回残せ',
    artKey: 'warrior',
    telegraphMs: 4_000,
    castMs: 1_000,
    impactMs: 620,
    afterglowMs: 1_000,
    leavingMs: 720,
    interruptibility: 'unstoppable',
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
    telegraphText: '終極資本査定――15秒で所有75%＋直接出資10%',
    artKey: 'darkTataru',
    telegraphMs: 15_000,
    castMs: 850,
    impactMs: 620,
    afterglowMs: 1_100,
    leavingMs: 720,
    interruptibility: 'unstoppable',
  },
};

/**
 * One finite barrier contract shared by the player and enemy implementation.
 * The battle gauge uses two internal units per displayed ownership point, so
 * capacity 50 is the requested 25-point barrier. A full break immediately
 * queues one 10-point Dark Wave for the barrier owner; expiry never procs it.
 */
export const BLACKEST_NIGHT_BALANCE = {
  durationMs: 7_000,
  absorbRatio: 1,
  gaugeCapacity: 50,
  triggerPlayerOwnership: 52,
  maxUsesPerBattle: 1,
  darkWaveOwnershipPush: 10,
  darkWaveGaugeDelta: 20,
  procOnlyOnFullBreak: true,
} as const;

/** @deprecated Runtime compatibility alias; authored content uses Blackest Night. */
export const DIVINE_BENISON_BALANCE = BLACKEST_NIGHT_BALANCE;

export const CAPITAL_REVERSAL_BALANCE = {
  durationMs: 10_000,
  triggerPlayerOwnership: 55,
  retainedDirectInvestmentRatio: 0.7,
  reflectedOwnershipRatio: 0.3,
  /** First-series teaching cap; later series may explicitly pass Infinity. */
  reflectedOwnershipCap: 8,
  maxUsesPerBattle: 1,
  requiresResolutionBeforeSettlement: true,
} as const;

export const FORCED_LIQUIDATION_BALANCE = {
  triggerPlayerOwnership: 75,
  unmitigatedTargetPlayerOwnership: 3,
  firstClearRecoveryGraceMs: 3_000,
  laterSavageRecoveryGraceMs: 1_400,
  ultimateRecoveryGraceMs: 4_000,
  maxUsesPerBattle: 1,
} as const;

export const ENEMY_SUPPORT_SKILL_BALANCE = {
  blackestNight: BLACKEST_NIGHT_BALANCE,
  /** @deprecated Use blackestNight. Kept for non-runtime tooling migration. */
  divineBenison: BLACKEST_NIGHT_BALANCE,
  capitalReversal: CAPITAL_REVERSAL_BALANCE,
  forcedLiquidation: FORCED_LIQUIDATION_BALANCE,
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
    momentumHoldMs: 1_200,
  },
} as const;

export const SAVAGE_ENEMY_SUPPORT_PROFILES = [
  [
    ['blackest_night'],
    ['drain', 'divination'],
    ['divination', 'capital_reversal'],
    [
      'blackest_night',
      'drill',
      'divination',
      'capital_reversal',
      'forced_liquidation',
    ],
  ],
  [
    ['drain'],
    ['blackest_night', 'divination'],
    ['drain', 'rapid_assault', 'capital_reversal'],
    [
      'blackest_night',
      'divination',
      'rapid_assault',
      'limit_break_3',
      'capital_reversal',
      'forced_liquidation',
    ],
  ],
  [
    ['blackest_night', 'divination'],
    ['drill'],
    ['drain', 'rapid_assault', 'capital_reversal'],
    [
      'drill',
      'divination',
      'limit_break_3',
      'capital_reversal',
      'forced_liquidation',
    ],
  ],
] as const satisfies readonly (readonly (readonly EnemySupportSkillId[])[])[];

export const SAVAGE_ENEMY_AUTO_PROFILES = [
  [
    { opening: null, critical: null },
    { opening: null, critical: null },
    { opening: 'rapid_assault', critical: null },
    { opening: 'blackest_night', critical: 'drill' },
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
  {
    id: 'drain_drill',
    opening: 'drain',
    critical: 'drill',
    counterPlan:
      'ドレイン予告中に大口出資で手元資金を退避。ドリル予告へパッセかブラックナイトを合わせ、着弾後に人脈とLBを重ねる。',
  },
  {
    id: 'divination_blackest_night',
    opening: 'divination',
    critical: 'blackest_night',
    counterPlan:
      'ディヴィネーション予告を時代の風で解除。敵ブラックナイト中は直接出資を止め、障壁終了後に人脈、LB、大口出資を重ねる。',
  },
  {
    id: 'rapid_assault_drill',
    opening: 'rapid_assault',
    critical: 'drill',
    counterPlan:
      '疾風怒濤中は支援を使い切らず、ドリル予告へパッセかブラックナイトを合わせる。防御後に人脈と大口出資で押し返す。',
  },
  {
    id: 'drain_limit_break_3',
    opening: 'drain',
    critical: 'limit_break_3',
    counterPlan:
      'ドレイン予告中に大口出資で手元資金を退避。敵LB3の予告へブラックナイトを合わせ、着弾後に人脈、自社LB、大口出資で再建する。',
  },
  {
    id: 'limit_break_3_blackest_night',
    opening: 'limit_break_3',
    critical: 'blackest_night',
    counterPlan:
      '開幕LB3の予告へパッセかブラックナイトを合わせる。後半の敵ブラックナイト中は直接出資を止め、終了後に残した人脈とLBを重ねる。',
  },
  {
    id: 'rapid_assault_limit_break_3',
    opening: 'rapid_assault',
    critical: 'limit_break_3',
    counterPlan:
      '疾風怒濤中は防御とLBを温存。敵LB3の予告へブラックナイトを合わせ、着弾後に人脈、自社LB、大口出資をまとめて使う。',
  },
] as const satisfies readonly {
  id: string;
  opening: EnemySupportSkillId;
  critical: EnemySupportSkillId;
  counterPlan: string;
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
  recoveryPlayerFavorablePressureMultiplier: 0.5,
  secondTriggerPlayerOwnership: 50,
  forcedSecondTriggerRecoveryMs: 10_000,
  secondActionId: 'cruel_reckoning' as EnemySupportSkillId,
  successPlayerOwnership: 75,
  secondSignatureMarketRatio: 0.1,
  secondFailureOutcome: 'player_defeat',
  secondFailureDisplayedOwnership: 0,
  bossBreakCapitalRatio: 0.28,
} as const;

/**
 * Stable, JSON-serializable boundary for a future Unity importer and the
 * Daifuku content editor. Runtime helpers deliberately stay outside this
 * object so JSON.stringify() never loses functions or browser-only values.
 */
export const BATTLE_CONTENT_SCHEMA_VERSION = 3;

export const BATTLE_CONTENT_MANIFEST = {
  schemaVersion: BATTLE_CONTENT_SCHEMA_VERSION,
  enemySupportActions: Object.values(ENEMY_SUPPORT_ACTIONS),
  blackestNightBalance: BLACKEST_NIGHT_BALANCE,
  capitalReversalBalance: CAPITAL_REVERSAL_BALANCE,
  forcedLiquidationBalance: FORCED_LIQUIDATION_BALANCE,
  enemySupportBalance: ENEMY_SUPPORT_SKILL_BALANCE,
  savageSupportProfiles: SAVAGE_ENEMY_SUPPORT_PROFILES,
  savageAutoProfiles: SAVAGE_ENEMY_AUTO_PROFILES,
  ultimateAutoPatterns: ULTIMATE_ENEMY_AUTO_PATTERNS,
  cruelScriptedBattle: CRUEL_SCRIPTED_BATTLE,
} as const;

export const getEnemyActionInterruptibility = (
  skillId: EnemySupportSkillId
) => ENEMY_SUPPORT_ACTIONS[skillId].interruptibility;

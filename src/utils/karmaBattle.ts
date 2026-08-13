import type { CommunityType, IndustryType, Property } from '../types';

export const KARMA_RAID_ID = 'karma_priceless_share';

export const KARMA_RAID_DEFINITION = {
  id: KARMA_RAID_ID,
  name: '業商戦：値札のない一株',
  subtitle: '業-その商い、そっくりお返しします',
  coalitionName: '星海中央清算院・ものまね師',
  communities: ['ソリューション・ナイン'] as CommunityType[],
  /**
   * Cruel already reaches this scale. Karma becomes harder through authored
   * imitation and correction decisions instead of another raw-stat increase.
   */
  marketPrice: 7_500_000_000,
  industry: '娯楽・商業' as IndustryType,
  community: 'ソリューション・ナイン' as CommunityType,
  description:
    '酷商戦踏破後に現れる、本作独自の最高難度記録戦。ものまね師が所有率の節目でこちらの一手を記帳し、一度だけ許された修正仕訳の後、反対仕訳として逆順に再現します。通常資金・所有権・人脈・LB・幻の連勝記録は変化しません。',
} as const;

export const buildKarmaProperty = (
  cleared: boolean,
  companyName: string
): Property => ({
  id: KARMA_RAID_DEFINITION.id,
  name: KARMA_RAID_DEFINITION.name,
  industry: KARMA_RAID_DEFINITION.industry,
  community: KARMA_RAID_DEFINITION.community,
  marketPrice: KARMA_RAID_DEFINITION.marketPrice,
  annualRevenue: 0,
  owner: cleared ? 'player' : 'independent',
  ownerName: cleared
    ? `${companyName}・業踏破`
    : KARMA_RAID_DEFINITION.coalitionName,
  loyaltyRisk: 0,
  countsTowardCityConquest: false,
  groupKeys: [],
  description: KARMA_RAID_DEFINITION.description,
});

// A normal duel opens at 50% ownership. These checkpoints therefore begin
// above the opening line and record four actual advances, not two free pages.
export const KARMA_LEDGER_THRESHOLDS = [55, 70, 85, 95] as const;

export type KarmaLedgerPage = 1 | 2 | 3 | 4;
export type KarmaActionKind =
  | 'direct'
  | 'network'
  | 'synergy'
  | 'alliance'
  | 'limit_break'
  | 'ability';
export type KarmaAbilityClass =
  | 'offense'
  | 'defense'
  | 'tempo'
  | 'survival';
export type KarmaStrengthBand = 'small' | 'medium' | 'large';
export type KarmaPhase =
  | 'recording'
  | 'correction_select'
  | 'correction_action'
  | 'countering'
  | 'resolved';

export interface KarmaEntry {
  serial: number;
  page: KarmaLedgerPage;
  threshold: (typeof KARMA_LEDGER_THRESHOLDS)[number];
  kind: KarmaActionKind;
  strengthBand: KarmaStrengthBand;
  abilityClass?: KarmaAbilityClass;
}

export interface KarmaCommittedAction {
  serial: number;
  kind: KarmaActionKind;
  strengthBand: KarmaStrengthBand;
  abilityClass?: KarmaAbilityClass;
  ownershipAfter: number;
}

export interface KarmaActionClassificationInput {
  serial: number;
  kind: KarmaActionKind;
  committedCapital?: number;
  marketPrice?: number;
  ownershipAfter: number;
  abilityClass?: KarmaAbilityClass;
  strengthBand?: KarmaStrengthBand;
}

export interface KarmaBattleState {
  phase: KarmaPhase;
  entries: readonly KarmaEntry[];
  counterQueue: readonly KarmaEntry[];
  resolvedCounterSerials: readonly number[];
  seenActionSerials: readonly number[];
  correctionPage: KarmaLedgerPage | null;
  correctionUsed: boolean;
}

export type KarmaBattleEvent =
  | { type: 'PLAYER_ACTION_COMMITTED'; action: KarmaCommittedAction }
  | { type: 'SELECT_CORRECTION'; page: KarmaLedgerPage }
  | { type: 'SKIP_CORRECTION' }
  | { type: 'COUNTER_RESOLVED'; serial: number }
  | { type: 'RESET' };

export type KarmaCounterEffect =
  | 'direct_commitment'
  | 'network_commitment'
  | 'synergy_burst'
  | 'alliance_guard'
  | 'limit_break'
  | 'ability_offense'
  | 'ability_defense'
  | 'ability_tempo'
  | 'ability_survival';

export interface KarmaCounterPlan {
  entry: KarmaEntry;
  effect: KarmaCounterEffect;
  actionLabel: string;
  telegraphText: string;
  telegraphMs: number;
  /** Bounded market-price ratio used for the rival coin-pile presentation. */
  enemyCapitalMarketRatio: number;
  /** Bounded ownership push. A Karma counter can never directly kill. */
  ownershipPush: number;
  /** Finite guard size for copied defensive actions. */
  barrierOwnership: number;
  /** Finite copied tempo/guard duration. Zero means no timed effect. */
  durationMs: number;
  /** The two action families that erase this copy before it lands. */
  perfectCounterKinds: readonly [KarmaActionKind, KarmaActionKind];
  counterHints: readonly [string, string];
  instantDefeat: false;
}

export type KarmaCounterEffectiveness = 0 | 0.5 | 1;

const finiteOwnership = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

const normalizeSerial = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const getKarmaStrengthBand = (
  committedCapital: number,
  marketPrice: number
): KarmaStrengthBand => {
  const safeCapital = Number.isFinite(committedCapital)
    ? Math.max(0, committedCapital)
    : 0;
  const safeMarketPrice = Number.isFinite(marketPrice)
    ? Math.max(1, marketPrice)
    : 1;
  const ratio = safeCapital / safeMarketPrice;
  if (ratio >= 0.15) return 'large';
  if (ratio >= 0.05) return 'medium';
  return 'small';
};

export const classifyKarmaAction = ({
  serial,
  kind,
  committedCapital = 0,
  marketPrice = 1,
  ownershipAfter,
  abilityClass,
  strengthBand,
}: KarmaActionClassificationInput): KarmaCommittedAction => ({
  serial: normalizeSerial(serial),
  kind,
  strengthBand:
    strengthBand ?? getKarmaStrengthBand(committedCapital, marketPrice),
  ...(kind === 'ability'
    ? { abilityClass: abilityClass ?? 'offense' }
    : {}),
  ownershipAfter: finiteOwnership(ownershipAfter),
});

export const createKarmaBattleState = (): KarmaBattleState => ({
  phase: 'recording',
  entries: [],
  counterQueue: [],
  resolvedCounterSerials: [],
  seenActionSerials: [],
  correctionPage: null,
  correctionUsed: false,
});

const toLedgerPage = (entryIndex: number): KarmaLedgerPage =>
  (entryIndex + 1) as KarmaLedgerPage;

const appendSeenSerial = (state: KarmaBattleState, serial: number) => ({
  ...state,
  seenActionSerials: [...state.seenActionSerials, serial],
});

export const buildKarmaCounterQueue = (
  entries: readonly KarmaEntry[]
): readonly KarmaEntry[] =>
  [...entries].sort((left, right) => right.page - left.page);

export const recordKarmaAction = (
  state: KarmaBattleState,
  committedAction: KarmaCommittedAction
): KarmaBattleState => {
  if (
    state.phase !== 'recording' &&
    state.phase !== 'correction_action'
  ) {
    return state;
  }

  const action = classifyKarmaAction(committedAction);
  if (state.seenActionSerials.includes(action.serial)) return state;

  const seenState = appendSeenSerial(state, action.serial);
  if (state.phase === 'correction_action') {
    if (state.correctionPage === null) return seenState;
    const replacementIndex = state.entries.findIndex(
      (entry) => entry.page === state.correctionPage
    );
    if (replacementIndex < 0) return seenState;
    const replacedEntry = state.entries[replacementIndex];
    const replacement: KarmaEntry = {
      serial: action.serial,
      page: replacedEntry.page,
      threshold: replacedEntry.threshold,
      kind: action.kind,
      strengthBand: action.strengthBand,
      ...(action.kind === 'ability'
        ? { abilityClass: action.abilityClass ?? 'offense' }
        : {}),
    };
    const entries = state.entries.map((entry, index) =>
      index === replacementIndex ? replacement : entry
    );
    return {
      ...seenState,
      phase: 'countering',
      entries,
      counterQueue: buildKarmaCounterQueue(entries),
      correctionUsed: true,
    };
  }

  const entryIndex = state.entries.length;
  const threshold = KARMA_LEDGER_THRESHOLDS[entryIndex];
  if (
    threshold === undefined ||
    finiteOwnership(action.ownershipAfter) < threshold
  ) {
    return seenState;
  }

  const entry: KarmaEntry = {
    serial: action.serial,
    page: toLedgerPage(entryIndex),
    threshold,
    kind: action.kind,
    strengthBand: action.strengthBand,
    ...(action.kind === 'ability'
      ? { abilityClass: action.abilityClass ?? 'offense' }
      : {}),
  };
  const entries = [...state.entries, entry];
  return {
    ...seenState,
    entries,
    phase:
      entries.length === KARMA_LEDGER_THRESHOLDS.length
        ? 'correction_select'
        : 'recording',
  };
};

export const selectKarmaCorrectionPage = (
  state: KarmaBattleState,
  page: KarmaLedgerPage
): KarmaBattleState => {
  if (
    state.phase !== 'correction_select' ||
    !state.entries.some((entry) => entry.page === page)
  ) {
    return state;
  }
  return {
    ...state,
    phase: 'correction_action',
    correctionPage: page,
  };
};

export const skipKarmaCorrection = (
  state: KarmaBattleState
): KarmaBattleState => {
  if (state.phase !== 'correction_select') return state;
  return {
    ...state,
    phase: 'countering',
    counterQueue: buildKarmaCounterQueue(state.entries),
    correctionPage: null,
  };
};

export const resolveNextKarmaCounter = (
  state: KarmaBattleState,
  serial: number
): KarmaBattleState => {
  if (
    state.phase !== 'countering' ||
    state.counterQueue.length === 0 ||
    state.counterQueue[0].serial !== normalizeSerial(serial)
  ) {
    return state;
  }
  const [resolved, ...counterQueue] = state.counterQueue;
  return {
    ...state,
    phase: counterQueue.length === 0 ? 'resolved' : 'countering',
    counterQueue,
    resolvedCounterSerials: [
      ...state.resolvedCounterSerials,
      resolved.serial,
    ],
  };
};

const BAND_VALUES: Record<
  KarmaStrengthBand,
  {
    capitalRatio: number;
    ownershipPush: number;
    barrierOwnership: number;
    durationMs: number;
  }
> = {
  small: {
    capitalRatio: 0.04,
    ownershipPush: 5,
    barrierOwnership: 10,
    durationMs: 5_000,
  },
  medium: {
    capitalRatio: 0.07,
    ownershipPush: 8,
    barrierOwnership: 16,
    durationMs: 7_000,
  },
  large: {
    capitalRatio: 0.1,
    ownershipPush: 12,
    barrierOwnership: 22,
    durationMs: 9_000,
  },
};

const getAbilityEffect = (
  abilityClass: KarmaAbilityClass
): KarmaCounterEffect => `ability_${abilityClass}`;

export const getKarmaCounterPlan = (
  entry: KarmaEntry
): KarmaCounterPlan => {
  const values = BAND_VALUES[entry.strengthBand];
  const abilityClass = entry.abilityClass ?? 'offense';
  const common = {
    entry,
    telegraphMs: 6_000,
    instantDefeat: false as const,
  };

  if (entry.kind === 'direct') {
    return {
      ...common,
      effect: 'direct_commitment',
      actionLabel: 'ものまね：自社直接出資',
      telegraphText: '帳簿の直接出資を、競合資本として反対計上',
      enemyCapitalMarketRatio: values.capitalRatio,
      ownershipPush: values.ownershipPush,
      barrierOwnership: 0,
      durationMs: 0,
      perfectCounterKinds: ['network', 'synergy'],
      counterHints: ['人脈を一波残して写しを崩す', 'SYNERGYを予告中に重ねる'],
    };
  }
  if (entry.kind === 'network') {
    return {
      ...common,
      effect: 'network_commitment',
      actionLabel: 'ものまね：人脈支援',
      telegraphText: '帳簿の人脈を、競合連合の支援網として反対計上',
      enemyCapitalMarketRatio: values.capitalRatio * 0.9,
      ownershipPush: Math.max(4, values.ownershipPush - 1),
      barrierOwnership: 0,
      durationMs: 0,
      perfectCounterKinds: ['direct', 'ability'],
      counterHints: ['自社直接出資で連合支援を上回る', 'アビリティで調達の足並みを崩す'],
    };
  }
  if (entry.kind === 'synergy') {
    return {
      ...common,
      effect: 'synergy_burst',
      actionLabel: 'ものまね：SYNERGY',
      telegraphText: '帳簿の連携を、競合側の相場連携として再現',
      enemyCapitalMarketRatio: values.capitalRatio * 0.8,
      ownershipPush: values.ownershipPush,
      barrierOwnership: 0,
      durationMs: values.durationMs,
      perfectCounterKinds: ['ability', 'limit_break'],
      counterHints: ['アビリティで連携の起点を外す', 'LBを予告へ合わせて押し切る'],
    };
  }
  if (entry.kind === 'alliance') {
    return {
      ...common,
      effect: 'alliance_guard',
      actionLabel: 'ものまね：外部アライアンス',
      telegraphText: '帳簿の外部協力を、競合の有限防衛契約として再現',
      enemyCapitalMarketRatio: values.capitalRatio * 0.75,
      ownershipPush: Math.max(3, values.ownershipPush - 2),
      barrierOwnership: values.barrierOwnership,
      durationMs: values.durationMs,
      perfectCounterKinds: ['direct', 'ability'],
      counterHints: ['自社直接出資で外部資本を上回る', 'アビリティで協定の着地をずらす'],
    };
  }
  if (entry.kind === 'limit_break') {
    return {
      ...common,
      effect: 'limit_break',
      actionLabel: 'ものまね：LIMIT BREAK',
      telegraphText: '帳簿の総力出資を、競合連合が限界突破として再現',
      enemyCapitalMarketRatio: Math.min(0.2, values.capitalRatio * 1.6),
      ownershipPush: Math.min(24, values.ownershipPush * 2),
      barrierOwnership: 0,
      durationMs: 0,
      perfectCounterKinds: ['ability', 'network'],
      counterHints: ['防御アビリティを予告へ合わせる', '人脈を一波残して限界突破を分散する'],
    };
  }

  const effect = getAbilityEffect(abilityClass);
  const defensive = abilityClass === 'defense' || abilityClass === 'survival';
  return {
    ...common,
    effect,
    actionLabel: `ものまね：${
      abilityClass === 'defense'
        ? '防御アビリティ'
        : abilityClass === 'tempo'
          ? '加速アビリティ'
          : abilityClass === 'survival'
            ? '立て直しアビリティ'
            : '攻勢アビリティ'
    }`,
    telegraphText: '帳簿のアビリティ運用を、競合の対応策として再現',
    enemyCapitalMarketRatio: defensive
      ? values.capitalRatio * 0.5
      : values.capitalRatio,
    ownershipPush: defensive
      ? Math.max(2, values.ownershipPush - 3)
      : values.ownershipPush + 2,
    barrierOwnership: defensive ? values.barrierOwnership : 0,
    durationMs:
      abilityClass === 'tempo' || defensive ? values.durationMs : 0,
    perfectCounterKinds: ['direct', 'synergy'],
    counterHints: defensive
      ? ['自社直接出資で防御の外から積む', 'SYNERGYで障壁の期限を越える']
      : ['自社直接出資で押し返す', 'SYNERGYで模倣の起点を上書きする'],
  };
};

/**
 * A named answer cancels the copy, an improvised different family halves it,
 * and repeating the copied family (or doing nothing) accepts the full entry.
 */
export const getKarmaCounterEffectiveness = (
  plan: KarmaCounterPlan,
  responseKind: KarmaActionKind | null
): KarmaCounterEffectiveness => {
  if (
    responseKind !== null &&
    plan.perfectCounterKinds.includes(responseKind)
  ) {
    return 0;
  }
  if (responseKind !== null && responseKind !== plan.entry.kind) return 0.5;
  return 1;
};

/**
 * A copied action may put the player into a critical position, but its impact
 * alone never resolves an instant defeat. Normal pressure resumes afterward,
 * leaving one real response window as promised by the telegraph.
 */
export const resolveKarmaCounterOwnership = (
  currentPlayerOwnership: number,
  plan: KarmaCounterPlan,
  effectiveness: KarmaCounterEffectiveness = 1
) => {
  const ownership = finiteOwnership(currentPlayerOwnership);
  if (ownership <= 0) return 0;
  if (effectiveness === 0) return ownership;
  return Math.max(
    1,
    ownership - Math.max(0, plan.ownershipPush) * effectiveness
  );
};

export const shouldHoldKarmaVictory = (
  isKarma: boolean,
  state: KarmaBattleState
) => isKarma && state.phase !== 'resolved';

export const reduceKarmaBattle = (
  state: KarmaBattleState,
  event: KarmaBattleEvent
): KarmaBattleState => {
  switch (event.type) {
    case 'PLAYER_ACTION_COMMITTED':
      return recordKarmaAction(state, event.action);
    case 'SELECT_CORRECTION':
      return selectKarmaCorrectionPage(state, event.page);
    case 'SKIP_CORRECTION':
      return skipKarmaCorrection(state);
    case 'COUNTER_RESOLVED':
      return resolveNextKarmaCounter(state, event.serial);
    case 'RESET':
      return createKarmaBattleState();
  }
};

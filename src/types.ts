export type IndustryType =
  | '馬・畜産'
  | '飲食・酒類'
  | '木材・農園'
  | '鉱工業・武器'
  | '情報・警備'
  | '娯楽・商業';

export type CommunityType =
  | 'リムサ・ロミンサ'
  | 'グリダニア'
  | 'ウルダハ'
  | 'イシュガルド'
  | 'クガネ'
  | 'クリスタリウム'
  | 'オールド・シャーレアン'
  | 'ラザハン'
  | 'トライヨラ'
  | 'ソリューション・ナイン';

export type OwnerType = 'player' | 'independent' | 'dofor' | 'abyss';

export type MarketTrendType = 'BULL' | 'BEAR' | 'VOLATILE' | 'STABLE';

export type AppTab = 'market' | 'portfolio' | 'skills' | 'cartels' | 'savage';
export type BattleMode =
  | 'normal'
  | 'savage'
  | 'ultimate'
  | 'cruel'
  | 'phantom'
  | 'training';

export interface MarketCondition {
  trend: MarketTrendType;
  title: string;
  description: string;
  multiplier: number; // Applied to player push power or price fluctuations
  updatedAt: number;
}

export interface Property {
  id: string;
  name: string;
  industry: IndustryType;
  community: CommunityType;
  marketPrice: number; // Base market price (P_market)
  currentPrice?: number; // Real-time market price fluctuating with trends
  priceChangePercent?: number; // e.g. +4.5%, -8.2%
  annualRevenue: number; // Passive yield per second (I_net)
  owner: OwnerType;
  ownerName: string; // 表示用の商会・企業連合・独立組織名
  loyaltyRisk: number; // L_risk in [0, 100]
  /**
   * Increases when a former subsidiary leaves, then carries into its
   * reacquisition. Optional so existing schema-v3 saves remain compatible.
   */
  reacquisitionLevel?: number;
  cartelId?: string; // Cartel this belongs to
  isCartelHQ?: boolean;
  countsTowardCityConquest?: boolean; // Defaults to true. Optional cartel battles can opt out.
  groupKeys: string[]; // Industry group synergy keys, e.g. "JUNGLE_FEVER"
  description: string;
}

export interface TacticalSkill {
  id: string;
  name: string;
  costType: 'low' | 'medium' | 'high';
  cooldownMs: number;
  description: string;
  effectType:
    | 'COOLDOWN_REDUCTION' // 疾風怒濤
    | 'NEMAWASHI' // Legacy effect type retained for older saves/content.
    | 'FEINT' // 牽制（旧skill_sabotage IDを維持）
    | 'INDEPENDENCE_SABOTAGE' // Legacy STUN effect kept only for older saved/content values.
    | 'COVER' // パッセ（旧skill_demoralize IDを維持）
    | 'BARRIER' // ブラックナイト（旧skill_synergy_push IDを維持）
    | 'CAPITAL_BOOST' // ぶんどる（旧skill_capital_boost IDを維持）
    | 'LIVING_DEAD' // リビングデッド（旧skill_sns_blitz IDを維持）
    | 'SYNERGY_PUSH' // Legacy presentation value kept for older saved content.
    | 'ERA_WIND'; // Legacy presentation value kept for older saved content.
  unlockRequirements: string; // Text description
  requiredIndustries?: IndustryType[];
  requiredPropertyIds?: string[];
  requiredAllPropertyIds?: string[];
  requiredAssetValue?: number;
  requiresActiveSynergy?: boolean;
  /** Permanent normal-route milestone; avoids order-dependent asset unlocks. */
  unlockAfterCommunity?: CommunityType;
  /** Permanent high-end clear milestone. */
  unlockAfterSavageRaidId?: string;
  oncePerBattle?: boolean;
}

export interface GroupSynergy {
  id: string;
  name: string;
  requiredPropertyIds: string[];
  requiredIndustryCount?: { industry: IndustryType; count: number };
  description: string;
  fundSupplyPower: '極大' | '高' | '中';
  systemRisk: '危険度急上昇' | '中程度' | '低（耐えうる）';
  bonusYieldMultiplier: number;
  /** Derived from cleared Savage encounters. Not stored independently. */
  savageRank?: number;
  /** Effective group-support multiplier used by the single battle synergy slot. */
  battleGroupMultiplier?: number;
  skillId?: string;
  /**
   * Progression synergies are manual battle buffs. They never contribute to
   * passive revenue and unlock from permanent city-clear progress instead of
   * current subsidiary ownership.
   */
  battleOnly?: boolean;
  unlockAfterCommunity?: CommunityType;
  /** Unlocks after every authored alliance/cartel HQ in requiredPropertyIds is owned. */
  unlockAfterAllCartelHqs?: boolean;
  /** Optional high-end milestone; derived from the existing Savage clear IDs. */
  unlockAfterSavageRaidId?: string;
  selectionPriority?: number;
  battleEffect?: {
    kind: 'timed_capital_buff';
    durationMs: number;
    capitalPressureMultiplier: number;
    /** Immediate ownership rally when the manual order lands. */
    ownershipPush?: number;
    /** Multiplies only LB charge gain while this battle-only buff is active. */
    limitBreakChargeMultiplier?: number;
    /** Adds a bounded continuous push without changing invested capital. */
    continuousGaugePushPerSecond?: number;
    /** Clears enemy market manipulation and suspends random wind while active. */
    countersMarketWind?: boolean;
    oncePerBattle: boolean;
  };
}

export interface Cartel {
  id: string;
  name: string;
  hqPropertyId: string;
  maxDefenseCapital: number; // e.g., $1,000M
  currentDefenseCapital: number;
  subsidiaryIds: string[];
  isWeakened: boolean;
  isDefeated: boolean;
  description: string;
}

export interface BattleState {
  targetProperty: Property;
  gauge: number; // G in [-100, 100]. -100 = Player Win, +100 = Opponent Win
  gaugeSpeed: number; // dG/dt
  playerInvestedCompany: number; // Company principal invested (A_play,company) - REFUNDABLE
  playerInvestedDemand: number; // Demand from subsidiaries invested (A_play,demand) - NON-REFUNDABLE
  playerTotalInvested: number; // A_play = company + demand
  opponentTotalInvested: number; // A_opp
  brokerageFee: number; // 3% non-refundable
  activeSkillMultiplier: number; // Phi_skill
  skillCooldowns: Record<string, number>; // skillId -> remaining ms
  enemyDemoralizedUntil: number; // timestamp ms
  fastHorseActiveUntil: number; // timestamp ms
  logs: string[];
  isEnded: boolean;
  winner?: 'player' | 'opponent';
}

export interface GameLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
}

export type AllianceAllyKind = 'company' | 'grand_company';
export type AllianceRelationType = 'commercial_alliance' | 'public_patronage';

export interface AllianceState {
  allyId: string; // External company or public-organization ID. Never a Property ID.
  allyName: string;
  active: boolean;
  /** Optional for compatibility with schema-v3 saves created before public patronage. */
  allyKind?: AllianceAllyKind;
  /** Missing values are normalized to commercial_alliance on load. */
  relationType?: AllianceRelationType;
}

export type FinishMethod =
  | 'LIMIT_BREAK_1'
  | 'LIMIT_BREAK_2'
  | 'LIMIT_BREAK_3'
  | 'FINAL_PUSH'
  | 'CAPITAL_PRESSURE'
  | 'NORMAL';

export type BattlePhase =
  | 'briefing'
  | 'active'
  | 'short_notice'
  | 'limit_charge'
  | 'decisive'
  | 'finisher_notice'
  | 'result';

export interface BattleResult {
  winner: 'player' | 'opponent';
  targetProperty: Property;
  companyFundsInvested: number;
  demandFundsInvested: number;
  brokerageFee: number;
  settlementCost: number;
  battleCashDelta: number;
  victoryReward: number;
  /** 勝利利益から人脈全体へ均等に分配した総額。 */
  celebrationGiftCost: number;
  /** 利益独占は0、五分の祝儀は50%、大盤振る舞いは100%。 */
  celebrationGiftRate: 0 | 0.5 | 1;
  rebelledProperties: Property[];
  survivingRiskUpdates: Array<{
    id: string;
    loyaltyRisk: number;
  }>;
  finishMethod: FinishMethod;
  finalOwnership: number;
  overkill: number;
}

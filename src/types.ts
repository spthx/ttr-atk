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
    | 'COOLDOWN_REDUCTION' // 早馬
    | 'NEMAWASHI' // ネマワシ (reduces L_risk)
    | 'INDEPENDENCE_SABOTAGE' // 物件独立工作 (forces enemy property independence)
    | 'DEMORALIZE' // 消沈 (slows enemy AI)
    | 'CAPITAL_BOOST' // 資本即時投入
    | 'SNS_BLITZ' // SNS工作
    | 'SYNERGY_PUSH'; // Group synergy skill
  unlockRequirements: string; // Text description
  requiredIndustries?: IndustryType[];
  requiredPropertyIds?: string[];
  requiredAssetValue?: number;
  requiresActiveSynergy?: boolean;
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
  skillId?: string;
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

export interface AllianceState {
  allyId: string; // Cartel/Company ID
  allyName: string;
  active: boolean;
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
  rebelledProperties: Property[];
  finishMethod: FinishMethod;
  finalOwnership: number;
  overkill: number;
}

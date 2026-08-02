import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  CircleHelp,
  Crown,
  HandCoins,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Swords,
  Trophy,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  AllianceState,
  BattlePhase,
  BattleResult,
  FinishMethod,
  GroupSynergy,
  Property,
  TacticalSkill,
} from '../types';
import {
  calculateGaugeVelocity,
  formatCurrency,
} from '../utils/formatter';
import { soundFx } from '../utils/audio';
import { calculateAllianceSupport, isPublicPatronage } from '../utils/alliance';
import {
  FANKIT_ART,
  getFankitCommerceIcon,
  getFankitJobArt,
  getFankitJobPartyArt,
  getFankitTrainingDummyArt,
} from '../data/fankitAssets';
import {
  CRUEL_SCRIPTED_BATTLE,
  ENEMY_SUPPORT_ACTIONS as ENEMY_SUPPORT_PRESENTATION,
  getEnemyActionInterruptibility,
  type CruelScriptPhase,
} from '../data/battleEncounterData';
import {
  getWindPool,
  WIND_CONDITIONS,
  type WindCondition,
  type WindProgressionStage,
} from './WindIndicator';
import {
  decideEnemyAction,
  ENEMY_INTENT_LABELS,
  getEnemyBaseWaitMs,
  PlayerBattleAction,
} from '../utils/enemyAi';
import { calculateBattleReadiness } from '../utils/battleReadiness';
import {
  calculateBattleSettlementSummary,
  getVictoryProfitAllocationChoices,
  resolvePostVictoryLoyalty,
} from '../utils/battleSettlement';
import {
  BATTLE_CINEMATIC_TIMING,
  CAPITAL_OVERFLOW_RESTACK_BEATS,
  CAPITAL_STACK_BEAT_MS,
  BATTLE_GAUGE_VISUAL_COMMIT_MS,
  BATTLE_STATE_UPDATE_INTERVAL_MS,
  BATTLE_STATUS_MESSAGE_DURATION_MS,
  ENEMY_SUPPORT_POST_PILE_GRACE_MS,
  canConfirmBattleResult,
  enqueueBattleStatusMessage,
  getBattleHitStopTiming,
  getBossEnemyPartySize,
  getBattleCinematicLayer,
  getBattleCapitalOverflowTier,
  getBattleCapitalVisibleUnits,
  getCapitalOverflowPassCount,
  getCapitalColumnHeights,
  getMechanicalCapitalColumnFrames,
  getCapitalCommitTiming,
  getCapitalPresentationRecoveryAction,
  getCapitalDropParticleCount,
  getBattleClockScales,
  getNextBattleSkillId,
  getSkillCinematicEventDecision,
  getSkillCinematicTimelineState,
  getSkillCinematicTiming,
  getVictoryConfettiParticleCount,
  normalizeBattleStatusMessageText,
  resolveBattleSkillSelection,
  RESULT_CONFIRM_ARM_DELAY_MS,
  shouldProcessGaugeFrame,
  shouldInertBattleFooter,
  TERMINAL_CINEMATIC_TIMING,
  type BattleStatusMessageTone,
  type CapitalCommitStage,
  type MechanicalCapitalColumnFrame,
  type SkillCinematicStage,
  type SkillCinematicTiming,
  type TerminalCinematicStage,
} from '../utils/battlePresentation';
import { getTrainingDummyDefinition } from '../utils/trainingDummy';
import { getSavageRaidDefinition } from '../utils/savage';
import { getBattleResultCta } from '../utils/progressionNavigation';
import {
  resolveCruelFirstImpact,
  resolveCruelSecondImpact,
  shouldHoldCruelVictory,
  shouldTriggerCruelFirstPhase,
  shouldTriggerCruelSecondPhase,
} from '../utils/cruelBattle';
import {
  advanceBattleWind,
  BATTLE_WIND_ACTIVE_MAX_SECONDS,
  BATTLE_WIND_ACTIVE_MIN_SECONDS,
  BATTLE_WIND_COOLDOWN_SECONDS,
  BATTLE_WIND_TELEGRAPH_SECONDS,
  createBattleWindState,
  shouldAdvanceBattleWind,
} from '../utils/battleWind';
import { StrengthComparison } from './StrengthComparison';
import {
  applyTrainingGaugeSpeed,
  advanceBattleCashRecovery,
  applyCoverToGaugeDelta,
  applyDivineBenisonToGaugeDelta,
  BOSS_COVER_BALANCE,
  BATTLE_LOYALTY_BALANCE,
  BATTLE_SUPPORT_BALANCE,
  BATTLE_GAUGE_SPEED_FACTOR,
  type ProfitAllocationOptionId,
  canEnemyAffordDrill,
  calculateBattleVictoryReward,
  calculateCompanyStrengthScore,
  calculateDirectInvestmentGaugeImpact,
  ENEMY_SUPPORT_SKILL_BALANCE,
  calculateSubsidiarySupportAmount,
  HIGH_DIFFICULTY_SUPPORT_MULTIPLIER,
  calculateEnemyBudget,
  calculateOwnershipFromGauge,
  calculatePlayerBattleCashLimit,
  calculateLimitBreakAmount,
  calculateLimitBreakChargeGain,
  calculateLimitBreakOwnershipAfterDefense,
  calculateLimitBreakOwnershipPush,
  calculateLimitBreakPushGilEquivalent,
  consumeLimitBreakCharge,
  ENEMY_BALANCE_FACTOR,
  ENEMY_INITIAL_COMMITMENT_RATIO,
  getChargedLimitBreakTier,
  getCompanyStrengthLevel,
  getBossAbilityTier,
  getEnemyDifficultyLevel,
  getEnemyDivinationDurationMs,
  getEnemyDrillImpact,
  getEnemyMinimumCommitment,
  getOpeningBossAbilityTier,
  getRepeatedNetworkSupportMultiplier,
  getEnemySupportAutoProfile,
  getEnemySupportSkillProfile,
  getBattleCashRecoveryWindMultipliers,
  getBattleTerminalWinner,
  getCoverGuardDisplayPercent,
  getDivineBenisonDisplayPercent,
  getLimitBreakChargeCapacity,
  getLimitBreakTier,
  isExtremeReacquisition,
  getReacquisitionLevel,
  getSubsidiaryRiskIncrease,
  getSubsidiarySupportMultiplier,
  LIMIT_BREAK_CHARGE_GAIN_MULTIPLIER,
  LIMIT_BREAK_CHARGE_PER_BAR,
  LIMIT_BREAK_MULTIPLIERS,
  LIMIT_BREAK_OWNERSHIP_CAPS,
  advanceCriticalAutoResolution,
  holdTrainingGaugeAboveDefeat,
  resolveCriticalAutoInterception,
  resolveEnemyDrainTransfer,
  resolveLivingDeadOutcome,
  shouldEnemyUseDivineBenison,
  shouldForceUltimateCriticalBeforeVictory,
  sortSubsidiariesBySupport,
  TACTICAL_SKILL_BALANCE,
  DIVINE_BENISON_BALANCE,
  ULTIMATE_ENEMY_AUTO_PATTERNS,
  type BossAbilityTier,
  type CriticalAutoResolutionPhase,
  type EnemySupportSkillId,
  type LimitBreakTier,
  type LivingDeadPhase,
} from '../utils/gameBalance';
import '../battle-buyout.css';
import '../battle-balance.css';
import '../battle-clarity.css';
import '../battle-enemy-budget.css';
import '../battle-command-refine.css';
import '../battle-final-wind.css';

type VictoryConfetti = typeof import('canvas-confetti');
let confettiModulePromise: Promise<VictoryConfetti> | null = null;
const loadVictoryConfetti = () => {
  confettiModulePromise ??= import('canvas-confetti')
    .then((module) => {
      const interoperableModule = module as unknown as {
        default?: VictoryConfetti;
      };
      return (interoperableModule.default ?? module) as VictoryConfetti;
    })
    .catch((error) => {
      confettiModulePromise = null;
      throw error;
    });
  return confettiModulePromise;
};
import '../battle-update-v2.css';
import '../battle-update-v3.css';
import '../battle-chip-stack-v3.css';
import '../battle-special-actions.css';
import '../battle-stage-unified.css';
import '../battle-wind-onboarding.css';
import '../battle-integrated-field.css';
import '../battle-capital-layer.css';

interface BattleModalProps {
  targetProperty: Property;
  companyName: string;
  totalFunds: number;
  ownedProperties: Property[];
  equippedSkills: TacticalSkill[];
  availableSkills: TacticalSkill[];
  alliance: AllianceState;
  activeSynergies: GroupSynergy[];
  selectedBattleSynergy: GroupSynergy | null;
  openingAutoSkillId?: string | null;
  criticalAutoSkillId?: string | null;
  industryInfluence: { owned: number; total: number; label: string; playerBonus: number; enemyBudgetDiscount: number };
  regionalInfluence: { owned: number; total: number; label: string; playerBonus: number; enemyBudgetDiscount: number };
  tradeNetworkBonus: number;
  limitBreakCharge: number;
  onLimitBreakChargeChange: React.Dispatch<React.SetStateAction<number>>;
  windProgressionStage: WindProgressionStage;
  battleContextLabel?: string;
  battleRegionLabel?: string;
  nextCommunity?: string | null;
  isTutorial?: boolean;
  isSavage?: boolean;
  isUltimate?: boolean;
  isCruel?: boolean;
  isTraining?: boolean;
  isCityBoss?: boolean;
  onAddFunds?: (amount: number) => void;
  onResetFunds?: () => void;
  onTimeScaleChange?: (scale: number) => void;
  battleFrameRate: 30 | 60;
  onBattleEnd: (result: BattleResult) => boolean;
  onClose: () => void;
}

type Panel = 'capital' | 'funds';
type ResultStep = 'summary' | 'departures';
type CelebrationDecision = ProfitAllocationOptionId | null;
type BattleMotion = 'idle' | 'player' | 'enemy' | 'rebel';
type ImpactStopSide = 'player' | 'opponent';
type CapitalPileSide = 'player' | 'enemy';
type CapitalPileCommandRecharge = 'continue' | 'pause';
type CapitalLedger = 'company' | 'support';
type ImpactStopPhase = 'hitstop' | 'release';
interface ImpactStop {
  side: ImpactStopSide;
  phase: ImpactStopPhase;
  heavy: boolean;
  serial: number;
}
interface CapitalCommitSnapshot {
  amount: number;
  level: number;
  previousCapital: number;
  previousOwnership: number;
  compact: boolean;
}
interface CapitalCommitSequence extends CapitalCommitSnapshot {
  stage: CapitalCommitStage;
  serial: number;
}
interface CapitalPilePresentationFrame extends MechanicalCapitalColumnFrame {
  overflowTier: number;
  presentationSerial: number;
  commandRecharge: CapitalPileCommandRecharge;
}
type LogCategory = 'system' | 'player' | 'enemy' | 'funds' | 'skill' | 'result';
type BattleAnnouncement = 'start' | 'limit';
type CoverKnightPhase = 'absent' | 'active' | 'breaking' | 'leaving';
const COVER_KNIGHT_MIN_ACTIVE_MS = 1_200;
const COVER_KNIGHT_BREAK_MS = 340;
const COVER_KNIGHT_EXIT_MS = 780;
type EnemySupportStage =
  | 'telegraph'
  | 'cast'
  | 'impact'
  | 'afterglow'
  | 'leaving';
interface EnemySupportCinematic {
  skillId: EnemySupportSkillId;
  stage: EnemySupportStage;
  serial: number;
}
const ENEMY_SUPPORT_ACTOR_CLASS: Record<EnemySupportSkillId, string> = {
  divine_benison: 'white-mage',
  drain: 'black-mage',
  drill: 'machinist',
  divination: 'astrologian',
  rapid_assault: 'bard',
  limit_break_3: 'limit-break',
  omnicapitalization: 'dark-tataru',
  cruel_reckoning: 'dark-tataru',
};
const ENEMY_SUPPORT_ART: Record<
  (typeof ENEMY_SUPPORT_PRESENTATION)[EnemySupportSkillId]['artKey'],
  string
> = {
  whiteMage: FANKIT_ART.whiteMage,
  blackMage: FANKIT_ART.blackMage,
  machinist: FANKIT_ART.machinist,
  astrologian: FANKIT_ART.astrologian,
  bard: FANKIT_ART.bard,
  warrior: FANKIT_ART.warrior,
  darkTataru: FANKIT_ART.tataru.windUp,
};
type BattleConditionKind =
  | 'player'
  | 'enemy'
  | 'cross'
  | 'calm'
  | 'wind_telegraph'
  | 'synergy'
  | 'burst'
  | 'era_wind';
type DefeatReason =
  | 'CAPITAL_COLLAPSE'
  | 'WALKING_DEAD_FAILED'
  | 'CRUEL_RECKONING_FAILED';
type TerminalCause =
  | 'company'
  | 'subsidiary'
  | 'synergy'
  | 'alliance'
  | 'limit_break'
  | 'skill'
  | 'era_wind'
  | 'pressure'
  | 'enemy'
  | 'withdrawal'
  | 'living_dead';

interface TerminalResolution {
  winner: 'player' | 'opponent';
  method: FinishMethod;
  rawOwnership: number;
  defeatReason: DefeatReason;
  cause: TerminalCause;
}

interface PendingCriticalGaugeCandidate {
  nextGauge: number;
  cause: TerminalCause;
  method: FinishMethod;
  commitVisual: boolean;
  coverAlreadyResolved: boolean;
}

type SkillActivationSource =
  | 'manual'
  | 'opening-auto'
  | 'critical-auto'
  | 'reaction';

interface SkillActivationOptions {
  source?: SkillActivationSource;
  commandAlreadyConsumed?: boolean;
  sequenceCapitalPresentation?: boolean;
  onEffectCommitted?: () => void;
  onComplete?: () => void;
}

type DeferredSkillPresentation = (onComplete?: () => void) => void;

const TERMINAL_CAUSE_LABELS: Record<TerminalCause, string> = {
  company: '自社資金',
  subsidiary: '人脈資金',
  synergy: '事業連携',
  alliance: '協力支援',
  limit_break: 'LIMIT BREAK',
  skill: 'アビリティ支援',
  era_wind: '時代の風',
  pressure: '継続圧力',
  enemy: '競合防衛',
  withdrawal: '撤退',
  living_dead: '蘇生猶予',
};

interface BattleConditionAnnouncement {
  kind: BattleConditionKind;
  tone: BattleStatusMessageTone;
  text: string;
  priority: number;
  sound?: 'warning' | 'skill' | 'cash';
}

interface SkillCinematic {
  runId: number;
  startedAtMs: number;
  timing: SkillCinematicTiming;
  skillId: string;
  skillName: string;
  effectType: TacticalSkill['effectType'];
  stage: SkillCinematicStage;
  targetsRival: boolean;
  resultHeadline: string;
  effectSummary?: string;
  durationLabel?: string;
}

type SkillCinematicBase = Omit<
  SkillCinematic,
  'runId' | 'startedAtMs' | 'timing' | 'stage'
>;

interface SkillCinematicRuntime {
  runId: number;
  castStarted: boolean;
  effectApplied: boolean;
  completionFired: boolean;
  onCast?: () => void;
  onEffect: () => void;
  onComplete?: () => void;
}

const MarqueeText = React.memo(function MarqueeText({
  text,
  className = '',
  delayMs = 0,
}: {
  text: string;
  className?: string;
  delayMs?: number;
}) {
  const viewportRef = useRef<HTMLSpanElement | null>(null);
  const contentRef = useRef<HTMLSpanElement | null>(null);
  const [overflowDistance, setOverflowDistance] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const measure = () => {
      const nextDistance = Math.max(
        0,
        Math.ceil(content.scrollWidth - viewport.clientWidth)
      );
      setOverflowDistance((current) =>
        current === nextDistance ? current : nextDistance
      );
    };
    const frame = window.requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(measure);
    observer?.observe(viewport);
    observer?.observe(content);
    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [text]);

  const durationSeconds = Math.max(
    6,
    Math.min(14, 5 + overflowDistance / 26)
  );

  return (
    <span
      ref={viewportRef}
      className={`battle-marquee ${overflowDistance > 0 ? 'battle-marquee--active' : ''} ${className}`.trim()}
      title={text}
      style={{
        '--marquee-shift': `${-overflowDistance}px`,
        '--marquee-duration': `${durationSeconds}s`,
        '--marquee-delay': `${delayMs}ms`,
      } as React.CSSProperties}
    >
      <span ref={contentRef}>{text}</span>
    </span>
  );
});

interface DecisiveBlow {
  winner: 'player' | 'opponent';
  impacted: boolean;
}

const isRivalOnlySkill = (skill: TacticalSkill) =>
  skill.effectType === 'INDEPENDENCE_SABOTAGE';

const isSkillUsableInBattle = ({
  skill,
  isTraining,
  subsidiaryCount,
}: {
  skill: TacticalSkill;
  isTraining: boolean;
  subsidiaryCount: number;
}) => {
  if (isTraining && isRivalOnlySkill(skill)) return false;
  if (skill.effectType === 'NEMAWASHI' && subsidiaryCount <= 0) return false;
  return true;
};

const isDirectTerminalCause = (cause: TerminalCause | undefined) =>
  cause === 'company' ||
  cause === 'subsidiary' ||
  cause === 'synergy' ||
  cause === 'alliance' ||
  cause === 'limit_break' ||
  cause === 'skill';

const getQuickSkillSummary = (
  skill: TacticalSkill,
  isTraining = false
) => {
  if (isTraining && isRivalOnlySkill(skill)) return '木人では対象なし';
  switch (skill.effectType) {
    case 'COOLDOWN_REDUCTION':
      return 'リキャストタイム 約47%短縮・15秒';
    case 'NEMAWASHI':
      return '全人脈の独立危険度を半減';
    case 'INDEPENDENCE_SABOTAGE':
      return '中断可能な予告中の競合行動を1回中断';
    case 'COVER':
      return `パッセ：押し込み${Math.round(
        TACTICAL_SKILL_BALANCE.cover.absorbRatio * 100
      )}%軽減・防御力上限あり・${Math.round(
        TACTICAL_SKILL_BALANCE.cover.durationMs / 1000
      )}秒・1回`;
    case 'BARRIER':
      return `ベニゾン：所有率${DIVINE_BENISON_BALANCE.gaugeCapacity / 2}%分を吸収・${Math.round(DIVINE_BENISON_BALANCE.durationMs / 1000)}秒・1回`;
    case 'CAPITAL_BOOST':
      return '相場40%を即時支援';
    case 'LIVING_DEAD':
      return '致死回避 → 30%復帰';
    case 'SYNERGY_PUSH':
      return 'SYNERGY専用効果';
    case 'ERA_WIND':
      return '上位SYNERGY専用効果';
  }
};

const getSkillCinematicResult = (
  skill: TacticalSkill,
  isTraining = false
): Pick<
  SkillCinematic,
  'resultHeadline' | 'effectSummary' | 'durationLabel'
> => {
  if (isTraining && isRivalOnlySkill(skill)) {
    return {
      resultHeadline: '対象なし',
      effectSummary: '木人では競合行動を中断できません',
      durationLabel: '即時効果',
    };
  }
  switch (skill.effectType) {
    case 'COOLDOWN_REDUCTION':
      return {
        resultHeadline: '行動性能アップ！',
        effectSummary: 'リキャストタイムを約47%短縮',
        durationLabel: `${Math.round(
          TACTICAL_SKILL_BALANCE.fastAction.durationMs / 1000
        )}秒`,
      };
    case 'NEMAWASHI':
      return {
        resultHeadline: '独立抑止性能アップ！',
        effectSummary: '全人脈の独立危険度を半減',
        durationLabel: '即時効果',
      };
    case 'INDEPENDENCE_SABOTAGE':
      return {
        resultHeadline: 'スタン判定！',
        effectSummary: '中断可能な予告中の競合行動を1回中断',
        durationLabel: '即時効果',
      };
    case 'COVER':
      return {
        resultHeadline: '防御性能アップ！',
        effectSummary: `押し込み${Math.round(
          TACTICAL_SKILL_BALANCE.cover.absorbRatio * 100
        )}%軽減・防御力上限あり・1回`,
        durationLabel: `${Math.round(
          TACTICAL_SKILL_BALANCE.cover.durationMs / 1000
        )}秒`,
      };
    case 'BARRIER':
      return {
        resultHeadline: '有限障壁を付与！',
        effectSummary: `次の押し込みを所有率${DIVINE_BENISON_BALANCE.gaugeCapacity / 2}%分まで吸収`,
        durationLabel: `${Math.round(DIVINE_BENISON_BALANCE.durationMs / 1000)}秒`,
      };
    case 'CAPITAL_BOOST':
      return {
        resultHeadline: '調達性能アップ！',
        effectSummary: '相場40%分の支援資金を即時投入',
        durationLabel: '即時効果',
      };
    case 'LIVING_DEAD':
      return {
        resultHeadline: '致死回避を付与！',
        effectSummary: '所有率0%到達後、30%まで復帰',
        durationLabel: `待機 ${Math.round(
          TACTICAL_SKILL_BALANCE.livingDead.waitingDurationMs / 1000
        )}秒`,
      };
    case 'SYNERGY_PUSH':
      return {
        resultHeadline: '事業連携を発動！',
        effectSummary: '選択中のSYNERGY効果を適用',
        durationLabel: 'SYNERGY',
      };
    case 'ERA_WIND':
      return {
        resultHeadline: '時代の風！',
        effectSummary: '上位SYNERGY効果を適用',
        durationLabel: 'SYNERGY',
      };
  }
};

interface BattleLog {
  id: string;
  category: LogCategory;
  text: string;
}

interface FloatingGil {
  id: number;
  side: 'player' | 'enemy' | 'center';
  text: string;
  tone: 'positive' | 'negative' | 'notice';
  kind: 'normal' | 'support';
}

type PendingCruelGaugeCandidate = PendingCriticalGaugeCandidate;

const FINISH_LABELS: Record<FinishMethod, string> = {
  LIMIT_BREAK_1: 'LIMIT BREAK I',
  LIMIT_BREAK_2: 'LIMIT BREAK II',
  LIMIT_BREAK_3: 'LIMIT BREAK III',
  FINAL_PUSH: 'DEAL CLOSED',
  CAPITAL_PRESSURE: 'CAPITAL PRESSURE',
  NORMAL: 'NORMAL BUYOUT',
};

const getOverkillRating = (overkill: number) => {
  if (overkill < 5) return '精密交渉';
  if (overkill < 20) return '決定的優勢';
  if (overkill < 50) return '圧倒的買収';
  return '過剰制圧';
};

const INVESTMENT_LEVELS = [
  { level: 1, ratio: 0.02, label: '小口' },
  { level: 2, ratio: 0.05, label: '堅実' },
  { level: 3, ratio: 0.1, label: '強気' },
  { level: 4, ratio: 0.2, label: '大口' },
  { level: 5, ratio: 0.35, label: '全力' },
];

const getInvestmentCost = (marketPrice: number, level: number) => {
  const config = INVESTMENT_LEVELS.find((item) => item.level === level) || INVESTMENT_LEVELS[0];
  return Math.max(10, Math.round(marketPrice * config.ratio));
};

const riskPresentation = (risk: number) => {
  if (risk <= 0) return { label: '忠誠', className: 'risk-black' };
  if (risk < 30) return { label: '安定', className: 'risk-blue' };
  if (risk < 60) return { label: '警戒', className: 'risk-yellow' };
  return { label: '独立寸前', className: 'risk-red' };
};

const CAPITAL_COLUMN_SLOTS = [
  { x: 42.5, phoneX: 34.6, bottom: 30, depth: 0 }, { x: 47.5, phoneX: 44.9, bottom: 32, depth: 0 },
  { x: 52.5, phoneX: 55.1, bottom: 32, depth: 0 }, { x: 57.5, phoneX: 65.4, bottom: 30, depth: 0 },
  { x: 40, phoneX: 29.5, bottom: 20, depth: 1 }, { x: 45, phoneX: 39.8, bottom: 22, depth: 1 },
  { x: 50, phoneX: 50, bottom: 23, depth: 1 }, { x: 55, phoneX: 60.3, bottom: 22, depth: 1 },
  { x: 60, phoneX: 70.5, bottom: 20, depth: 1 },
  { x: 37.5, phoneX: 24.4, bottom: 10, depth: 2 }, { x: 42.5, phoneX: 34.6, bottom: 12, depth: 2 },
  { x: 47.5, phoneX: 44.9, bottom: 13, depth: 2 }, { x: 52.5, phoneX: 55.1, bottom: 13, depth: 2 },
  { x: 57.5, phoneX: 65.4, bottom: 12, depth: 2 }, { x: 62.5, phoneX: 75.6, bottom: 10, depth: 2 },
  { x: 40, phoneX: 29.5, bottom: 0, depth: 3 }, { x: 45, phoneX: 39.8, bottom: 2, depth: 3 },
  { x: 50, phoneX: 50, bottom: 3, depth: 3 }, { x: 55, phoneX: 60.3, bottom: 2, depth: 3 },
  { x: 60, phoneX: 70.5, bottom: 0, depth: 3 },
  { x: 35, phoneX: 19.3, bottom: 9, depth: 2 }, { x: 65, phoneX: 80.8, bottom: 9, depth: 2 },
] as const;

// A bounded eight-lane mechanical sweep. When sixteen pieces are needed this
// same center-out pass repeats once, never turning into a random scatter.
const CAPITAL_OVERFLOW_LANE_ORDER = [3, 4, 2, 5, 1, 6, 0, 7] as const;

const GilPileVisual = React.memo(function GilPileVisual({
  frame,
  side,
}: {
  frame: CapitalPilePresentationFrame;
  side: 'player' | 'enemy';
}) {
  const activeColumns = new Set(frame.activeColumnIndices);
  const overflowPieceCount =
    frame.overflowTier > 0 && frame.presentationSerial > 0
      ? Math.min(16, 8 + frame.overflowTier * 2)
      : 0;

  return (
    <span
      className={`gil-column-field gil-column-field--${side}`}
      data-overflow-tier={frame.overflowTier}
      data-rack-compressed={frame.rackCompressed ? 'true' : 'false'}
      data-overflow-pass={frame.overflowPass ?? 0}
      data-stack-beat={frame.stackBeat ?? 0}
      aria-hidden="true"
    >
      {CAPITAL_COLUMN_SLOTS.map((slot, index) => (
        <i
          key={`${side}-${index}`}
          className="capital-fixed-column"
          data-depth={slot.depth}
          data-empty={frame.columnHeights[index] <= 0}
          data-machine-active={activeColumns.has(index)}
          style={{
            '--column-x': `${slot.x}%`,
            '--column-phone-x': `${slot.phoneX}%`,
            '--column-tablet-x': `${slot.phoneX}%`,
            '--column-bottom': `${slot.bottom}%`,
            '--column-depth': slot.depth,
            '--column-layers': frame.columnHeights[index],
          } as React.CSSProperties}
        />
      ))}
      {overflowPieceCount > 0 && (
        <span
          key={`${frame.presentationSerial}-${frame.overflowTier}`}
          className="capital-overflow-stamp"
          data-overflow-tier={frame.overflowTier}
        >
          {Array.from({ length: overflowPieceCount }, (_, index) => (
            <i
              key={index}
              style={{
                '--overflow-index': index,
                '--overflow-lane':
                  CAPITAL_OVERFLOW_LANE_ORDER[
                    index % CAPITAL_OVERFLOW_LANE_ORDER.length
                  ],
              } as React.CSSProperties}
            />
          ))}
        </span>
      )}
    </span>
  );
});

const GilTower: React.FC<{
  amount: number;
  reserveAmount?: number;
  marketPrice: number;
  side: 'player' | 'enemy';
  motion: BattleMotion;
  visualFrameOverride?: CapitalPilePresentationFrame | null;
}> = ({
  amount,
  reserveAmount = 0,
  marketPrice,
  side,
  motion,
  visualFrameOverride = null,
}) => {
  const committedCapital = Math.max(0, amount);
  const visibleUnits = getBattleCapitalVisibleUnits(
    committedCapital,
    marketPrice
  );
  const visualFrame: CapitalPilePresentationFrame = visualFrameOverride ?? {
    visibleUnits,
    columnHeights: getCapitalColumnHeights(visibleUnits),
    activeColumnIndices: [],
    // Exceptional totals keep the fixed rack seated lower after the brief
    // stacking burst. The additional falling pieces remain preview-only.
    overflowTier: getBattleCapitalOverflowTier(committedCapital, marketPrice),
    presentationSerial: 0,
    commandRecharge: 'continue',
  };
  const capitalRatio = committedCapital / Math.max(marketPrice, 1);

  return (
    <div
      className={`gil-tower gil-tower--${side} ${motion === side ? 'gil-tower--impact' : ''} ${visualFrame.overflowTier > 0 && visualFrame.presentationSerial > 0 ? 'gil-tower--overflow-impact' : ''}`}
      data-capital-stage={visualFrame.visibleUnits}
      data-capital-units={visibleUnits}
      data-capital-ratio={Math.max(0, Math.round(capitalRatio * 100))}
    >
      <div
        className="gil-tower__chips"
        aria-label={
          reserveAmount > 0
            ? `${formatCurrency(amount)}を投入済み、未投入資金${formatCurrency(reserveAmount)}`
            : `${formatCurrency(amount)}を投入済み`
        }
      >
        <GilPileVisual
          frame={visualFrame}
          side={side}
        />
      </div>
    </div>
  );
};

const CompanyGrowthResult = React.memo(function CompanyGrowthResult({
  before,
  after,
  animate,
  onRevealed,
}: {
  before: number;
  after: number;
  animate: boolean;
  onRevealed: () => void;
}) {
  const [displayed, setDisplayed] = useState(animate ? before : after);
  const beforeLevel = getCompanyStrengthLevel(before);
  const afterLevel = getCompanyStrengthLevel(after);

  useEffect(() => {
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
      false;
    if (!animate || reducedMotion || after === before) {
      setDisplayed(after);
      onRevealed();
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const durationMs = 900;
    setDisplayed(before);
    const update = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayed(Math.round(before + (after - before) * eased));
      if (progress < 1) {
        frame = window.requestAnimationFrame(update);
      } else {
        onRevealed();
      }
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [after, animate, before, onRevealed]);

  return (
    <section
      className="result-company-growth"
      aria-label="商店戦力の変化"
    >
      <header>
        <span>
          <small>COMPANY LEVEL</small>
          <b>商店 LV.{afterLevel.level}</b>
        </span>
        <strong>
          <small>今回の戦力増減</small>
          {displayed - before >= 0 ? '+' : '-'}
          {formatCurrency(Math.abs(displayed - before))}
        </strong>
      </header>
      <div className="result-company-growth__score">
        <span>{formatCurrency(before)}</span>
        <i>→</i>
        <b>{formatCurrency(displayed)}</b>
      </div>
      <div className="result-company-growth__meter">
        <i style={{ width: `${afterLevel.progressPercent}%` }} />
      </div>
      <small>
        {afterLevel.level > beforeLevel.level
          ? `RANK UP！ LV.${beforeLevel.level} → LV.${afterLevel.level}`
          : `次のレベルまで ${formatCurrency(
              Math.max(0, afterLevel.nextThreshold - after)
            )}`}
      </small>
    </section>
  );
});

export const BattleModal: React.FC<BattleModalProps> = ({
  targetProperty,
  companyName,
  totalFunds,
  ownedProperties,
  equippedSkills,
  availableSkills,
  alliance,
  activeSynergies,
  selectedBattleSynergy,
  openingAutoSkillId = null,
  criticalAutoSkillId = null,
  industryInfluence,
  regionalInfluence,
  tradeNetworkBonus,
  limitBreakCharge,
  onLimitBreakChargeChange,
  windProgressionStage,
  battleContextLabel,
  battleRegionLabel,
  nextCommunity = null,
  isTutorial = false,
  isSavage = false,
  isUltimate = false,
  isCruel = false,
  isTraining = false,
  isCityBoss = false,
  onTimeScaleChange,
  battleFrameRate,
  onBattleEnd,
  onClose,
}) => {
  const brokerageFee = isTraining
    ? 0
    : Math.round(targetProperty.marketPrice * 0.03);
  const influenceBonus = industryInfluence.playerBonus + regionalInfluence.playerBonus + tradeNetworkBonus;
  const isHighEndRaid = isSavage || isUltimate || isCruel;
  const isProtectedBattle = isHighEndRaid || isTraining;
  const isExtremeBattle = isExtremeReacquisition(targetProperty);
  const bossAbilityTier: BossAbilityTier = getBossAbilityTier({
    targetProperty,
    isCityBoss,
    isSavage,
    isUltimate,
    isCruel,
  });
  const isBossBattle = bossAbilityTier !== 'none';
  const enemyDifficultyLevel = getEnemyDifficultyLevel(
    targetProperty,
    isTutorial,
    isSavage,
    isUltimate,
    isCityBoss,
    isCruel
  );

  const enemyBudget = useMemo(
    () =>
      isTraining
        ? Math.max(1, Math.round(targetProperty.marketPrice))
        : calculateEnemyBudget({
            targetProperty,
            industryInfluence,
            regionalInfluence,
            isTutorial,
            isSavage,
            isUltimate,
            isCruel,
            isCityBoss,
          }),
    [
      industryInfluence,
      isSavage,
      isCityBoss,
      isTutorial,
      isTraining,
      isUltimate,
      isCruel,
      regionalInfluence,
      targetProperty,
    ]
  );

  const initialEnemyCommitment = isTraining
    ? enemyBudget
    : Math.round(enemyBudget * ENEMY_INITIAL_COMMITMENT_RATIO);
  const [battlePhase, setBattlePhase] = useState<BattlePhase>('briefing');
  const battlePhaseRef = useRef<BattlePhase>('briefing');
  const changeBattlePhase = useCallback((next: BattlePhase) => {
    battlePhaseRef.current = next;
    setBattlePhase(next);
  }, []);
  const [gauge, setGauge] = useState(0);
  const gaugeRef = useRef(0);
  const updateGauge = useCallback(
    (
      next: number | ((current: number) => number),
      commitVisual = true
      ) => {
        const resolved = typeof next === 'function' ? next(gaugeRef.current) : next;
        gaugeRef.current = resolved;
        if (commitVisual) {
        setGauge(resolved);
      }
      return resolved;
    },
    []
  );
  const [gaugeSpeed, setGaugeSpeed] = useState(0);
  const [companyInvested, setCompanyInvested] = useState(0);
  const [demandInvested, setDemandInvested] = useState(0);
  const [enemyInvested, setEnemyInvested] = useState(initialEnemyCommitment);
  const playerCommittedCapitalRef = useRef(0);
  const enemyCommittedCapitalRef = useRef(initialEnemyCommitment);
  const initialEnemyReserveRef = useRef(enemyBudget - initialEnemyCommitment);
  const [enemyReserve, setEnemyReserve] = useState(initialEnemyReserveRef.current);
  const enemyReserveRef = useRef(initialEnemyReserveRef.current);
  const availableBattleCash = Math.max(0, totalFunds - brokerageFee);
  const initialBattleCashRef = useRef(
    isTraining
      ? availableBattleCash
      : Math.min(
          availableBattleCash,
          calculatePlayerBattleCashLimit(targetProperty.marketPrice)
        )
  );
  const [cash, setCash] = useState(initialBattleCashRef.current);
  const cashRef = useRef(initialBattleCashRef.current);
  const updateCash = useCallback(
    (next: number | ((current: number) => number)) => {
      const resolved = typeof next === 'function' ? next(cashRef.current) : next;
      cashRef.current = Math.max(0, Math.min(initialBattleCashRef.current, resolved));
      setCash(cashRef.current);
      return cashRef.current;
    },
    []
  );
  const [battleCashRecovered, setBattleCashRecovered] = useState(0);
  const battleCashRecoveredRef = useRef(0);
  const [enemyCashRecovered, setEnemyCashRecovered] = useState(0);
  const enemyCashRecoveredRef = useRef(0);
  const [enemyDrainStolen, setEnemyDrainStolen] = useState(0);
  const enemyDrainStolenRef = useRef(0);
  const [limitImpactActive, setLimitImpactActive] = useState(false);
  const [battleSubs, setBattleSubs] = useState<Property[]>(ownedProperties);
  const [subRequestCounts, setSubRequestCounts] = useState<Record<string, number>>({});
  const [networkRequestCount, setNetworkRequestCount] = useState(0);
  const [rebelled, setRebelled] = useState<Property[]>([]);
  const [allianceUsed, setAllianceUsed] = useState(false);
  const [activeLimitBreakTier, setActiveLimitBreakTier] = useState<LimitBreakTier>(0);
  const [panel, setPanel] = useState<Panel>('capital');
  const [selectedLevel, setSelectedLevel] = useState(
    () =>
      [...INVESTMENT_LEVELS]
        .reverse()
        .find(
          (item) =>
            getInvestmentCost(targetProperty.marketPrice, item.level) <=
            initialBattleCashRef.current
        )?.level ?? 1
  );
  const [commandProgress, setCommandProgress] = useState(0);
  const [fastHorseRemaining, setFastHorseRemaining] = useState(0);
  const [enemyRapidAssaultRemaining, setEnemyRapidAssaultRemaining] =
    useState(0);
  const [enemyLimitBreakHoldRemaining, setEnemyLimitBreakHoldRemaining] =
    useState(0);
  const [playerCoverRemaining, setPlayerCoverRemaining] = useState(0);
  const [enemyCoverRemaining, setEnemyCoverRemaining] = useState(0);
  const [playerCoverCapacity, setPlayerCoverCapacity] = useState(0);
  const [enemyCoverCapacity, setEnemyCoverCapacity] = useState(0);
  const [playerBarrierRemaining, setPlayerBarrierRemaining] = useState(0);
  const [enemyBarrierRemaining, setEnemyBarrierRemaining] = useState(0);
  const [playerBarrierCapacity, setPlayerBarrierCapacity] = useState(0);
  const [enemyBarrierCapacity, setEnemyBarrierCapacity] = useState(0);
  const [playerCoverKnightPhase, setPlayerCoverKnightPhase] =
    useState<CoverKnightPhase>('absent');
  const [enemyCoverKnightPhase, setEnemyCoverKnightPhase] =
    useState<CoverKnightPhase>('absent');
  const [enemyActiveCoverTier, setEnemyActiveCoverTier] =
    useState<BossAbilityTier>('none');
  const [progressionSynergyRemaining, setProgressionSynergyRemaining] =
    useState(0);
  const [usedProgressionSynergyIds, setUsedProgressionSynergyIds] =
    useState<Set<string>>(() => new Set());
  const [enemyMarketWindRemaining, setEnemyMarketWindRemaining] = useState(0);
  const [enemySupportCinematic, setEnemySupportCinematic] =
    useState<EnemySupportCinematic | null>(null);
  const [enemySupportTelegraphRemainingMs, setEnemySupportTelegraphRemainingMs] =
    useState<number | null>(null);
  const [enemySupportUsed, setEnemySupportUsed] =
    useState<Set<EnemySupportSkillId>>(() => new Set());
  const [ultimateEnemyPatternIndex] = useState(() =>
    Math.floor(Math.random() * ULTIMATE_ENEMY_AUTO_PATTERNS.length)
  );
  const [battleWindState, setBattleWindState] = useState(
    createBattleWindState
  );
  const [skillCooldowns, setSkillCooldowns] = useState<Record<string, number>>({});
  const [usedSkillIds, setUsedSkillIds] = useState<Set<string>>(() => new Set());
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(
    () =>
      equippedSkills.find(
        (skill) =>
          skill.id !== openingAutoSkillId &&
          skill.id !== criticalAutoSkillId
      )?.id ?? null
  );
  const [skillCinematic, setSkillCinematic] =
    useState<SkillCinematic | null>(null);
  const [livingDeadPhase, setLivingDeadPhase] = useState<LivingDeadPhase>('inactive');
  const [livingDeadRemaining, setLivingDeadRemaining] = useState(0);
  const [motion, setMotion] = useState<BattleMotion>('idle');
  const [motionSerial, setMotionSerial] = useState(0);
  const [capitalCommit, setCapitalCommit] =
    useState<CapitalCommitSequence | null>(null);
  const [capitalPreviewStage, setCapitalPreviewStage] =
    useState<CapitalPilePresentationFrame | null>(null);
  const [playerCapitalPilePreviewStage, setPlayerCapitalPilePreviewStage] =
    useState<CapitalPilePresentationFrame | null>(null);
  const [enemyCapitalPilePreviewStage, setEnemyCapitalPilePreviewStage] =
    useState<CapitalPilePresentationFrame | null>(null);
  const [terminalCapitalSnapshot, setTerminalCapitalSnapshot] =
    useState<CapitalCommitSnapshot | null>(null);
  const [impactStop, setImpactStop] = useState<ImpactStop | null>(null);
  const [statusText, setStatusText] = useState(
    isTraining
      ? '条件を確認して商戦木人訓練を開始してください'
      : '効果を確認して交渉を開始してください'
  );
  const [aiText, setAiText] = useState(
    isTraining ? '木人は追加防衛を行いません' : '敵大規模防衛出資を準備中'
  );
  const [aiProgress, setAiProgress] = useState(0);
  const resolvingAiActionRef = useRef(false);
  const [winner, setWinner] = useState<'player' | 'opponent' | null>(null);
  const [finishMethod, setFinishMethod] = useState<FinishMethod>('NORMAL');
  const [finalOwnership, setFinalOwnership] = useState(50);
  const [overkill, setOverkill] = useState(0);
  const [defeatReason, setDefeatReason] = useState<DefeatReason>('CAPITAL_COLLAPSE');
  const [battleAnnouncement, setBattleAnnouncement] = useState<BattleAnnouncement | null>(null);
  const [conditionAnnouncement, setConditionAnnouncement] = useState<BattleConditionAnnouncement | null>(null);
  const [conditionAnnouncementQueue, setConditionAnnouncementQueue] = useState<
    BattleConditionAnnouncement[]
  >([]);
  const [openingSlowActive, setOpeningSlowActive] = useState(false);
  const [decisiveBlow, setDecisiveBlow] = useState<DecisiveBlow | null>(null);
  const [terminalCinematicStage, setTerminalCinematicStage] =
    useState<TerminalCinematicStage | null>(null);
  const [lastPlayerAction, setLastPlayerAction] = useState<PlayerBattleAction | null>(null);
  const [aiCycle, setAiCycle] = useState(0);
  const [finishTelegraphVisible, setFinishTelegraphVisible] = useState(false);
  const [resultConfirmArmed, setResultConfirmArmed] = useState(false);
  const [resultStep, setResultStep] = useState<ResultStep>('summary');
  const [celebrationDecision, setCelebrationDecision] =
    useState<CelebrationDecision>(null);
  const [openingAutoPending, setOpeningAutoPending] = useState(false);
  const [criticalAutoPending, setCriticalAutoPending] =
    useState<PendingCriticalGaugeCandidate | null>(null);
  const [ultimateCriticalGatePending, setUltimateCriticalGatePending] =
    useState(false);
  const [cruelOmnicapitalizationPending, setCruelOmnicapitalizationPending] =
    useState<PendingCruelGaugeCandidate | null>(null);
  const [cruelScriptPhase, setCruelScriptPhaseState] =
    useState<CruelScriptPhase>(isCruel ? 'awaiting_first' : 'inactive');
  const [decisionGraceActive, setDecisionGraceActive] = useState(false);
  const [companyGrowthRevealed, setCompanyGrowthRevealed] = useState(false);
  const revealCompanyGrowth = useCallback(
    () => setCompanyGrowthRevealed(true),
    []
  );
  const [showLog, setShowLog] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [floaters, setFloaters] = useState<FloatingGil[]>([]);
  const [logs, setLogs] = useState<BattleLog[]>([
    {
      id: 'start',
      category: 'system',
      text: isTraining
        ? `${companyName}が${targetProperty.name}の訓練準備へ入りました。`
        : `${companyName}が${targetProperty.name}の買収準備へ入りました。`,
    },
  ]);
  const endedRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const lastTickRef = useRef(performance.now());
  const lastGaugeVisualCommitRef = useRef(0);
  const announcementTimerRef = useRef<number | null>(null);
  const limitBreakTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const resultConfirmTimerRef = useRef<number | null>(null);
  const limitImpactTimerRef = useRef<number | null>(null);
  const limitTerminalHandoffTimerRef = useRef<number | null>(null);
  const conditionTimerRef = useRef<number | null>(null);
  const skillCinematicTimerRef = useRef<number | null>(null);
  const skillCinematicRunIdRef = useRef(0);
  const skillCinematicRuntimeRef = useRef<SkillCinematicRuntime | null>(null);
  const stunInterruptedActionRef = useRef<
    | EnemySupportSkillId
    | 'standard'
    | 'limit_break_delay'
    | 'unstoppable'
    | null
    | undefined
  >(undefined);
  const openingSlowTimerRef = useRef<number | null>(null);
  const decisiveImpactTimerRef = useRef<number | null>(null);
  const decisiveReleaseTimerRef = useRef<number | null>(null);
  const decisiveResolveTimerRef = useRef<number | null>(null);
  const livingDeadNoticeTimerRef = useRef<number | null>(null);
  const motionTimerRef = useRef<number | null>(null);
  const capitalCommitTimersRef = useRef<number[]>([]);
  const capitalCommitSerialRef = useRef(0);
  const capitalCommitActiveRef = useRef(false);
  const capitalPilePreviewTimersRef = useRef<Record<CapitalPileSide, number[]>>({
    player: [],
    enemy: [],
  });
  const capitalPilePreviewSerialRef = useRef<Record<CapitalPileSide, number>>({
    player: 0,
    enemy: 0,
  });
  const capitalPilePreviewActiveRef = useRef<Record<CapitalPileSide, boolean>>({
    player: false,
    enemy: false,
  });
  const playerStrongSupportPresentationCountRef = useRef(0);
  const terminalCapitalHandoffRef = useRef<(() => void) | null>(null);
  const terminalCapitalRefreshRecoveryRef = useRef<(() => void) | null>(null);
  const impactStopTimerRef = useRef<number | null>(null);
  const impactReleaseTimerRef = useRef<number | null>(null);
  const impactStopSerialRef = useRef(0);
  const commandReadySoundArmedRef = useRef(false);
  const decisionGraceArmedRef = useRef(true);
  const decisionGraceTimerRef = useRef<number | null>(null);
  const playerCoverRemainingRef = useRef(0);
  const enemyCoverRemainingRef = useRef(0);
  const playerCoverCapacityRef = useRef(0);
  const enemyCoverCapacityRef = useRef(0);
  const playerBarrierRemainingRef = useRef(0);
  const enemyBarrierRemainingRef = useRef(0);
  const playerBarrierCapacityRef = useRef(0);
  const enemyBarrierCapacityRef = useRef(0);
  const enemyActiveCoverTierRef = useRef<BossAbilityTier>('none');
  const playerCoverActivatedAtRef = useRef(0);
  const enemyCoverActivatedAtRef = useRef(0);
  const enemyBossAbilityUsedRef = useRef(false);
  const enemyOpeningCoverUsedRef = useRef(false);
  const enemySupportSerialRef = useRef(0);
  const enemySupportTimersRef = useRef<number[]>([]);
  const enemySupportTelegraphTickerRef = useRef<number | null>(null);
  const enemySupportTelegraphDeadlineRef = useRef(0);
  const enemySupportActiveRef = useRef(false);
  const enemySupportPendingCastRef = useRef<(() => void) | null>(null);
  const enemySupportRetryNotBeforeRef = useRef(0);
  const enemySupportUsedRef = useRef<Set<EnemySupportSkillId>>(new Set());
  const enemySupportCastBlockedRef = useRef(false);
  const simulationPausedRef = useRef(true);
  const playerCoverExitTimerRef = useRef<number | null>(null);
  const enemyCoverExitTimerRef = useRef<number | null>(null);
  const floaterTimersRef = useRef<Set<number>>(new Set());
  const decisiveRef = useRef(false);
  const terminalRef = useRef<TerminalResolution | null>(null);
  const lastPressureCauseRef = useRef<TerminalCause>('pressure');
  const liquidityWarningShownRef = useRef(false);
  const resultConfirmArmedRef = useRef(false);
  const resultConfirmedRef = useRef(false);
  const celebrationDecisionRef = useRef<CelebrationDecision>(null);
  const openingAutoTriggeredRef = useRef(false);
  const criticalAutoArmedRef = useRef(false);
  const criticalAutoTriggeredRef = useRef(false);
  const criticalAutoResolutionPhaseRef =
    useRef<CriticalAutoResolutionPhase>('idle');
  const criticalAutoPendingRef =
    useRef<PendingCriticalGaugeCandidate | null>(null);
  const ultimateCriticalGateConsumedRef = useRef(false);
  const ultimateCriticalGatePendingRef = useRef(false);
  const cruelOmnicapitalizationPendingRef =
    useRef<PendingCruelGaugeCandidate | null>(null);
  const cruelSecondFailurePendingRef = useRef(false);
  const cruelScriptPhaseRef = useRef<CruelScriptPhase>(
    isCruel ? 'awaiting_first' : 'inactive'
  );
  const cruelActiveElapsedMsRef = useRef(0);
  const cruelRecoveryElapsedMsRef = useRef(0);
  const lastAnnouncedWindRef = useRef<WindCondition['type']>('CALM');
  const lastTelegraphedWindRef = useRef<WindCondition['type'] | null>(null);
  const livingDeadPhaseRef = useRef<LivingDeadPhase>('inactive');
  const livingDeadRemainingRef = useRef(0);
  const fundsDrawerRef = useRef<HTMLElement | null>(null);
  const helpDialogRef = useRef<HTMLElement | null>(null);
  const logDialogRef = useRef<HTMLElement | null>(null);
  const phaseDialogRef = useRef<HTMLElement | null>(null);
  const rootDialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const initialFocusRef = useRef<HTMLElement | null>(null);

  const updateCruelScriptPhase = (phase: CruelScriptPhase) => {
    cruelScriptPhaseRef.current = phase;
    setCruelScriptPhaseState(phase);
  };

  const clearSkillCinematicTimer = useCallback(() => {
    if (skillCinematicTimerRef.current !== null) {
      window.clearTimeout(skillCinematicTimerRef.current);
      skillCinematicTimerRef.current = null;
    }
  }, []);

  const cancelSkillCinematic = useCallback(() => {
    clearSkillCinematicTimer();
    skillCinematicRuntimeRef.current = null;
  }, [clearSkillCinematicTimer]);

  const startSkillCinematic = ({
    cinematic,
    timing,
    onCast,
    onEffect,
    onComplete,
  }: {
    cinematic: SkillCinematicBase;
    timing: SkillCinematicTiming;
    onCast?: () => void;
    onEffect: () => void;
    onComplete?: () => void;
  }) => {
    if (skillCinematicRuntimeRef.current) return false;
    clearSkillCinematicTimer();
    const runId = skillCinematicRunIdRef.current + 1;
    skillCinematicRunIdRef.current = runId;
    const startedAtMs = performance.now();
    skillCinematicRuntimeRef.current = {
      runId,
      castStarted: false,
      effectApplied: false,
      completionFired: false,
      onCast,
      onEffect,
      onComplete,
    };
    setSkillCinematic({
      ...cinematic,
      runId,
      startedAtMs,
      timing,
      stage: 'name',
    });
    return true;
  };

  const useReactionStun = () => {
    if (!stunSkill || !stunOpportunity) return;
    if (enemySupportInterruptibility === 'unstoppable') {
      soundFx.playWarning();
      setStatusText('このフェーズ技はスタンで中断できません');
      return;
    }
    useSkill(stunSkill, {
      source: 'reaction',
      commandAlreadyConsumed: true,
    });
  };

  useEffect(() => {
    if (!skillCinematic) return;
    const { runId, startedAtMs, timing } = skillCinematic;

    const advance = () => {
      skillCinematicTimerRef.current = null;
      const runtime = skillCinematicRuntimeRef.current;
      if (
        !runtime ||
        runtime.runId !== runId ||
        endedRef.current ||
        terminalRef.current
      ) {
        return;
      }

      const timeline = getSkillCinematicTimelineState(
        performance.now() - startedAtMs,
        timing
      );

      const dueEvents = getSkillCinematicEventDecision({
        timeline,
        consumed: {
          cast: runtime.castStarted,
          effect: runtime.effectApplied,
          completion: runtime.completionFired,
        },
        // An effect may start a capital presentation in this same turn. Resolve
        // cast/effect first, then decide completion from the updated locks.
        completionBlocked: true,
      });
      runtime.castStarted = dueEvents.consumed.cast;
      runtime.effectApplied = dueEvents.consumed.effect;
      if (dueEvents.fireCast) {
        runtime.onCast?.();
      }
      if (dueEvents.fireEffect) {
        // The pure decision marks this consumed before the callback, so Strict
        // Mode, HMR replay, and effect-triggered renders cannot apply it twice.
        runtime.onEffect();
      }
      if (skillCinematicRuntimeRef.current !== runtime) return;

      setSkillCinematic((current) =>
        current?.runId === runId && current.stage !== timeline.stage
          ? { ...current, stage: timeline.stage }
          : current
      );

      const completionDecision = getSkillCinematicEventDecision({
        timeline,
        consumed: {
          cast: runtime.castStarted,
          effect: runtime.effectApplied,
          completion: runtime.completionFired,
        },
        completionBlocked:
          capitalCommitActiveRef.current ||
          capitalPilePreviewActiveRef.current.player ||
          capitalPilePreviewActiveRef.current.enemy,
      });
      runtime.completionFired = completionDecision.consumed.completion;

      if (timeline.completionDue) {
        if (completionDecision.waitForPresentation) {
          skillCinematicTimerRef.current = window.setTimeout(advance, 50);
          return;
        }
        if (!completionDecision.fireCompletion) return;
        skillCinematicRuntimeRef.current = null;
        setSkillCinematic((current) =>
          current?.runId === runId ? null : current
        );
        stunInterruptedActionRef.current = undefined;
        runtime.onComplete?.();
        return;
      }

      skillCinematicTimerRef.current = window.setTimeout(
        advance,
        Math.max(1, Math.ceil(timeline.nextTransitionInMs ?? 1))
      );
    };

    advance();
    return clearSkillCinematicTimer;
  }, [clearSkillCinematicTimer, skillCinematic]);

  const clearEnemySupportTelegraphTicker = useCallback(() => {
    if (enemySupportTelegraphTickerRef.current !== null) {
      window.clearInterval(enemySupportTelegraphTickerRef.current);
      enemySupportTelegraphTickerRef.current = null;
    }
    enemySupportTelegraphDeadlineRef.current = 0;
  }, []);

  const refreshEnemySupportTelegraphDeadline = useCallback(
    (durationMs: number) => {
      const readableDuration = Math.max(100, durationMs);
      enemySupportTelegraphDeadlineRef.current =
        performance.now() + readableDuration;
      setEnemySupportTelegraphRemainingMs(readableDuration);
    },
    []
  );

  const startEnemySupportTelegraphTicker = useCallback(
    (durationMs: number) => {
      clearEnemySupportTelegraphTicker();
      refreshEnemySupportTelegraphDeadline(durationMs);
      enemySupportTelegraphTickerRef.current = window.setInterval(() => {
        const rawRemaining =
          enemySupportTelegraphDeadlineRef.current - performance.now();
        // A telegraph can remain interruptible while capital stacking finishes.
        // Keep a non-zero affordance until the cast actually begins.
        const visibleRemaining = Math.max(
          100,
          Math.ceil(rawRemaining / 100) * 100
        );
        setEnemySupportTelegraphRemainingMs((current) =>
          current === visibleRemaining ? current : visibleRemaining
        );
      }, 250);
    },
    [clearEnemySupportTelegraphTicker, refreshEnemySupportTelegraphDeadline]
  );

  const clearEnemySupportTimers = useCallback(() => {
    enemySupportSerialRef.current += 1;
    enemySupportTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer)
    );
    enemySupportTimersRef.current = [];
    enemySupportPendingCastRef.current = null;
    enemySupportActiveRef.current = false;
    clearEnemySupportTelegraphTicker();
    setEnemySupportTelegraphRemainingMs(null);
  }, [clearEnemySupportTelegraphTicker]);

  const cancelEnemySupportTelegraph = (
    allowRetry: boolean,
    expectedSkillId?: EnemySupportSkillId,
    force = false
  ) => {
    if (
      !enemySupportCinematic ||
      enemySupportCinematic.stage !== 'telegraph' ||
      (expectedSkillId &&
        enemySupportCinematic.skillId !== expectedSkillId)
    ) {
      return null;
    }
    const skillId = enemySupportCinematic.skillId;
    if (
      !force &&
      getEnemyActionInterruptibility(skillId) !== 'interruptible'
    ) {
      return null;
    }
    clearEnemySupportTimers();
    setEnemySupportCinematic(null);
    setAiProgress(0);
    if (allowRetry) {
      enemySupportUsedRef.current.delete(skillId);
      setEnemySupportUsed(new Set(enemySupportUsedRef.current));
    }
    return skillId;
  };

  const interruptEnemySupportTelegraph = () => {
    if (
      !enemySupportCinematic ||
      enemySupportCinematic.stage !== 'telegraph'
    ) {
      return null;
    }
    const skillId = enemySupportCinematic.skillId;
    const policy = getEnemyActionInterruptibility(skillId);
    if (policy === 'unstoppable') return 'unstoppable' as const;
    if (policy === 'delay_only') {
      cancelEnemySupportTelegraph(true, skillId, true);
      enemySupportRetryNotBeforeRef.current =
        performance.now() + ENEMY_SUPPORT_SKILL_BALANCE.limitBreak3.stunDelayMs;
      const retryTimer = window.setTimeout(() => {
        setAiCycle((cycle) => cycle + 1);
      }, ENEMY_SUPPORT_SKILL_BALANCE.limitBreak3.stunDelayMs);
      enemySupportTimersRef.current = [retryTimer];
      return 'limit_break_delay' as const;
    }
    return cancelEnemySupportTelegraph(false, skillId, true);
  };

  const commitPlayerCapital = useCallback(
    (ledger: CapitalLedger, amount: number) => {
      const committed = Math.max(0, Math.round(amount));
      const previous = playerCommittedCapitalRef.current;
      const next = previous + committed;
      playerCommittedCapitalRef.current = next;
      if (ledger === 'company') {
        setCompanyInvested((current) => current + committed);
      } else {
        setDemandInvested((current) => current + committed);
      }
      return { previous, next };
    },
    []
  );

  const commitEnemyCapital = useCallback((delta: number) => {
    const previous = enemyCommittedCapitalRef.current;
    const next = Math.max(0, previous + Math.round(delta));
    enemyCommittedCapitalRef.current = next;
    setEnemyInvested(next);
    return { previous, next };
  }, []);

  const releaseTerminalAfterCapital = useCallback(() => {
    if (
      capitalCommitActiveRef.current ||
      capitalPilePreviewActiveRef.current.player ||
      capitalPilePreviewActiveRef.current.enemy ||
      capitalCommitTimersRef.current.length > 0 ||
      capitalPilePreviewTimersRef.current.player.length > 0 ||
      capitalPilePreviewTimersRef.current.enemy.length > 0
    ) {
      return;
    }
    const handoff = terminalCapitalHandoffRef.current;
    if (!handoff) return;
    terminalCapitalHandoffRef.current = null;
    handoff();
  }, []);

  const clearCapitalPilePreview = useCallback(
    (side?: CapitalPileSide) => {
      const sides: CapitalPileSide[] = side
        ? [side]
        : ['player', 'enemy'];
      sides.forEach((targetSide) => {
        capitalPilePreviewSerialRef.current[targetSide] += 1;
        capitalPilePreviewTimersRef.current[targetSide].forEach((timer) =>
          window.clearTimeout(timer)
        );
        capitalPilePreviewTimersRef.current[targetSide] = [];
        capitalPilePreviewActiveRef.current[targetSide] = false;
        if (targetSide === 'player') {
          setPlayerCapitalPilePreviewStage(null);
        } else {
          setEnemyCapitalPilePreviewStage(null);
        }
      });
    },
    []
  );

  const startCapitalPilePreview = useCallback(
    (
      side: CapitalPileSide,
      previousCapital: number,
      nextCapital: number,
      heavy = false,
      includeFinalWeight = true,
      commandRecharge: CapitalPileCommandRecharge = 'continue',
      onComplete?: () => void
    ) => {
      clearCapitalPilePreview(side);
      const serial = capitalPilePreviewSerialRef.current[side];
      capitalPilePreviewActiveRef.current[side] = true;
      simulationPausedRef.current = true;
      const strongPresentation =
        heavy &&
        (
          side !== 'player' ||
          playerStrongSupportPresentationCountRef.current < 3
        );
      if (side === 'player' && strongPresentation) {
        playerStrongSupportPresentationCountRef.current += 1;
      }
      const reducedMotion =
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
        false;
      const compact = reducedMotion;
      const previousStage = getBattleCapitalVisibleUnits(
        previousCapital,
        targetProperty.marketPrice
      );
      const targetStage = getBattleCapitalVisibleUnits(
        nextCapital,
        targetProperty.marketPrice
      );
      const previousOverflowTier = getBattleCapitalOverflowTier(
        previousCapital,
        targetProperty.marketPrice
      );
      const overflowPasses = getCapitalOverflowPassCount(
        previousCapital,
        nextCapital,
        targetProperty.marketPrice,
        strongPresentation
      );
      const overflowBeats = compact
        ? CAPITAL_OVERFLOW_RESTACK_BEATS.compact
        : strongPresentation
          ? CAPITAL_OVERFLOW_RESTACK_BEATS.heavy
          : CAPITAL_OVERFLOW_RESTACK_BEATS.standard;
      const columnFrames = getMechanicalCapitalColumnFrames(
        previousStage,
        targetStage,
        compact ? 4 : strongPresentation ? 24 : 22,
        compact ? 6 : strongPresentation ? 8 : 7,
        overflowPasses,
        overflowBeats
      );
      const overflowTier = getBattleCapitalOverflowTier(
        nextCapital,
        targetProperty.marketPrice
      );
      const setPreviewStage =
        side === 'player'
          ? setPlayerCapitalPilePreviewStage
          : setEnemyCapitalPilePreviewStage;
      const timing = getCapitalCommitTiming(strongPresentation ? 5 : 3, compact);
      const settleLeadMs = compact ? 25 : strongPresentation ? 30 : 45;
      const beatMs = compact
        ? CAPITAL_STACK_BEAT_MS.compact
        : strongPresentation
          ? CAPITAL_STACK_BEAT_MS.heavy
          : CAPITAL_STACK_BEAT_MS.standard;
      const settleMs = Math.max(timing.settleMs, columnFrames.length * beatMs);
      const isStacking = nextCapital >= previousCapital;
      const audibleBeatCount = Math.min(
        strongPresentation ? 12 : 8,
        columnFrames.length
      );
      const audibleFrameIndices = new Map<number, number>();
      for (let soundIndex = 0; soundIndex < audibleBeatCount; soundIndex += 1) {
        const frameIndex = audibleBeatCount <= 1
          ? columnFrames.length - 1
          : Math.round(
              soundIndex * (columnFrames.length - 1) /
                (audibleBeatCount - 1)
            );
        audibleFrameIndices.set(frameIndex, soundIndex);
      }

      setPreviewStage({
        visibleUnits: previousStage,
        columnHeights: getCapitalColumnHeights(previousStage),
        activeColumnIndices: [],
        overflowTier: previousOverflowTier,
        presentationSerial: serial,
        commandRecharge,
      });
      const frameIntervalMs = Math.ceil(
        settleMs / Math.max(1, columnFrames.length)
      );
      const schedule = (callback: () => void, delayMs: number) => {
        const timer = window.setTimeout(() => {
          if (
            capitalPilePreviewSerialRef.current[side] !== serial ||
            endedRef.current
          ) {
            return;
          }
          capitalPilePreviewTimersRef.current[side] = [];
          callback();
        }, delayMs);
        capitalPilePreviewTimersRef.current[side] = [timer];
      };
      const complete = () => {
        capitalPilePreviewActiveRef.current[side] = false;
        setPreviewStage(null);
        onComplete?.();
        releaseTerminalAfterCapital();
      };
      const paintFrame = (index: number) => {
        const frame = columnFrames[index];
        const isFinalFrame = index === columnFrames.length - 1;
        const overflowReloading = (frame.overflowPass ?? 0) > 0;
        setPreviewStage({
          ...frame,
          overflowTier: isFinalFrame
            ? overflowTier
            : overflowReloading
              ? Math.max(1, overflowTier)
              : previousOverflowTier,
          presentationSerial: overflowReloading
            ? serial * 100 + (frame.overflowPass ?? 0)
            : serial,
          commandRecharge,
        });
        const audibleIndex = audibleFrameIndices.get(index);
        if (isStacking && audibleIndex !== undefined) {
          soundFx.playCapitalStackStep(
            side === 'player' ? 'player' : 'opponent',
            audibleIndex,
            audibleBeatCount,
            includeFinalWeight
          );
        }
        if (isFinalFrame) {
          if (isStacking && overflowTier > 0) {
            soundFx.playCapitalImpact(
              side === 'player' ? 'player' : 'opponent',
              Math.min(1, 0.68 + overflowTier * 0.1)
            );
          }
          schedule(complete, timing.afterglowMs);
          return;
        }
        schedule(() => paintFrame(index + 1), frameIntervalMs);
      };
      schedule(() => paintFrame(0), settleLeadMs + frameIntervalMs);
    },
    [
      clearCapitalPilePreview,
      releaseTerminalAfterCapital,
      targetProperty.marketPrice,
    ]
  );

  const clearCapitalCommitTimers = useCallback(() => {
    capitalCommitSerialRef.current += 1;
    capitalCommitTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer)
    );
    capitalCommitTimersRef.current = [];
    capitalCommitActiveRef.current = false;
    setCapitalCommit(null);
    setCapitalPreviewStage(null);
  }, []);

  const clearImpactStop = useCallback(() => {
    impactStopSerialRef.current += 1;
    if (impactStopTimerRef.current) {
      window.clearTimeout(impactStopTimerRef.current);
      impactStopTimerRef.current = null;
    }
    if (impactReleaseTimerRef.current) {
      window.clearTimeout(impactReleaseTimerRef.current);
      impactReleaseTimerRef.current = null;
    }
    setImpactStop(null);
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (battlePhaseRef.current !== 'briefing' || endedRef.current) return;
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (resultConfirmTimerRef.current) {
      window.clearTimeout(resultConfirmTimerRef.current);
      resultConfirmTimerRef.current = null;
    }
    resultConfirmArmedRef.current = false;
    setResultConfirmArmed(false);
    if (battlePhase !== 'result' || !winner) return;

    resultConfirmTimerRef.current = window.setTimeout(() => {
      resultConfirmTimerRef.current = null;
      resultConfirmArmedRef.current = true;
      setResultConfirmArmed(true);
    }, RESULT_CONFIRM_ARM_DELAY_MS);

    return () => {
      if (resultConfirmTimerRef.current) {
        window.clearTimeout(resultConfirmTimerRef.current);
        resultConfirmTimerRef.current = null;
      }
    };
  }, [battlePhase, winner]);

  useEffect(() => {
    initialFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return () => {
      initialFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const activeSurface = showHelp
      ? helpDialogRef.current
      : showLog
        ? logDialogRef.current
        : panel === 'funds'
          ? fundsDrawerRef.current
          : battlePhase === 'briefing' || battlePhase === 'result'
              ? phaseDialogRef.current
              : rootDialogRef.current;
    if (!activeSurface) return;

    const getFocusable = () =>
      Array.from(
        activeSurface.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (element) =>
          !element.hasAttribute('hidden') &&
          !element.closest('[inert]')
      );
    const focusTimer = window.setTimeout(() => {
      if (
        activeSurface === rootDialogRef.current ||
        (battlePhase === 'result' && activeSurface === phaseDialogRef.current)
      ) {
        activeSurface.focus();
        return;
      }
      const preferred = activeSurface.querySelector<HTMLElement>('[data-modal-close]');
      (preferred ?? getFocusable()[0] ?? activeSurface).focus();
    }, 0);
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (showHelp) setShowHelp(false);
        else if (showLog) setShowLog(false);
        else if (panel !== 'capital') setPanel('capital');
        else if (battlePhase === 'briefing') requestClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        activeSurface.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', trapFocus);
    };
  }, [battlePhase, panel, requestClose, resultStep, showHelp, showLog]);

  const updateLivingDeadState = (phase: LivingDeadPhase, remainingMs = 0) => {
    livingDeadPhaseRef.current = phase;
    livingDeadRemainingRef.current = remainingMs;
    setLivingDeadPhase(phase);
    setLivingDeadRemaining(remainingMs);
  };
  const livingDeadGaugeFloor =
    100 - TACTICAL_SKILL_BALANCE.livingDead.minimumOwnership * 2;

  const selectedBattleSynergyMembers = useMemo(
    () =>
      selectedBattleSynergy
        ? selectedBattleSynergy.requiredPropertyIds
            .map((id) => battleSubs.find((property) => property.id === id))
            .filter((property): property is Property => !!property)
        : [],
    [battleSubs, selectedBattleSynergy]
  );
  const battleSynergyReady =
    !!selectedBattleSynergy &&
    (
      selectedBattleSynergy.battleOnly ||
      selectedBattleSynergyMembers.length ===
        selectedBattleSynergy.requiredPropertyIds.length
    );

  const totalPlayerInvested = companyInvested + demandInvested;
  const rawOwnership = (100 - gauge) / 2;
  const normalizedOwnership = calculateOwnershipFromGauge(gauge);
  const ownership =
    livingDeadPhase === 'recovery'
      ? Math.max(
          TACTICAL_SKILL_BALANCE.livingDead.minimumOwnership,
          normalizedOwnership
        )
      : normalizedOwnership;
  const terminalCapitalStage: CapitalCommitStage | null =
    terminalCapitalSnapshot && terminalCinematicStage
      ? terminalCinematicStage === 'anticipation'
        ? 'prepare'
        : terminalCinematicStage === 'hitstop'
          ? 'impact'
          : terminalCinematicStage === 'impact'
            ? 'afterglow'
            : null
      : null;
  const activeCapitalSnapshot =
    capitalCommit ?? terminalCapitalSnapshot;
  const capitalPresentationStage =
    capitalCommit?.stage ?? terminalCapitalStage;
  const capitalRevealPending =
    capitalCommit?.stage === 'prepare' ||
    capitalCommit?.stage === 'travel' ||
    capitalCommit?.stage === 'impact' ||
    (
      !!terminalCapitalSnapshot &&
      (
        terminalCinematicStage === 'anticipation' ||
        terminalCinematicStage === 'hitstop' ||
        terminalCinematicStage === 'impact'
      )
    );
  // Capital is committed when the command is accepted. Show the exact amount
  // immediately; the fixed coin rack then catches up as the visible receipt.
  const displayedPlayerInvested = totalPlayerInvested;
  const displayedOwnership =
    capitalRevealPending && activeCapitalSnapshot
      ? activeCapitalSnapshot.previousOwnership
      : ownership;
  const activeCapitalTiming = activeCapitalSnapshot
    ? getCapitalCommitTiming(
        activeCapitalSnapshot.level,
        activeCapitalSnapshot.compact
      )
    : null;
  const regularCapitalDropVisible =
    capitalCommit?.stage === 'impact' ||
    capitalCommit?.stage === 'afterglow';
  const terminalCapitalDropVisible =
    !!terminalCapitalSnapshot &&
    (
      terminalCinematicStage === 'hitstop' ||
      terminalCinematicStage === 'impact' ||
      terminalCinematicStage === 'resolution'
    );
  const capitalDropParticleCount =
    (regularCapitalDropVisible || terminalCapitalDropVisible) &&
    activeCapitalTiming &&
    activeCapitalSnapshot
      ? getCapitalDropParticleCount(
          activeCapitalTiming.tier,
          activeCapitalSnapshot.compact
        )
      : 0;
  const playerCapitalMotion: BattleMotion =
    capitalPresentationStage === 'impact' ||
    capitalPresentationStage === 'afterglow'
      ? 'player'
      : activeCapitalSnapshot
        ? 'idle'
        : motion;
  const capitalCommitCueText =
    capitalCommit?.stage === 'impact' || capitalCommit?.stage === 'afterglow'
      ? `+${formatCurrency(capitalCommit.amount)}`
      : '';
  const ownershipTrackImpactActive = activeCapitalSnapshot
    ? capitalPresentationStage === 'impact'
    : motion !== 'idle';
  const commandReady = commandProgress >= 100;
  const sortedBattleSubs = useMemo(
    () => sortSubsidiariesBySupport(battleSubs),
    [battleSubs]
  );
  const selectedCost = getInvestmentCost(targetProperty.marketPrice, selectedLevel);
  const activeProgressionSynergyEffect =
    progressionSynergyRemaining > 0
      ? selectedBattleSynergy?.battleEffect ?? null
      : null;
  const eraWindActive =
    activeProgressionSynergyEffect?.countersMarketWind === true;
  const eraWindPushPerSecond = Math.max(
    0,
    activeProgressionSynergyEffect?.continuousGaugePushPerSecond ?? 0
  );
  const limitBreakChargeMultiplier = Math.max(
    1,
    activeProgressionSynergyEffect?.limitBreakChargeMultiplier ?? 1
  );
  const enemyMarketWindActive = enemyMarketWindRemaining > 0;
  const currentWind = eraWindActive
    ? WIND_CONDITIONS.CALM
    : WIND_CONDITIONS[battleWindState.windType];
  const enemyCapitalMultiplier =
    (enemyMarketWindActive
      ? ENEMY_SUPPORT_SKILL_BALANCE.divination.enemyInvestmentMultiplier
      : currentWind.enemyMultiplier) *
    (cruelScriptPhase === 'recovery'
      ? CRUEL_SCRIPTED_BATTLE.recoveryEnemyPressureMultiplier
      : 1);
  const windCountdown = Math.max(
    0,
    Math.ceil(
      eraWindActive
        ? progressionSynergyRemaining / 1000
        : enemyMarketWindActive
          ? enemyMarketWindRemaining / 1000
        : battleWindState.secondsRemaining
    )
  );
  const pendingWindCondition = battleWindState.pendingWindType
    ? WIND_CONDITIONS[battleWindState.pendingWindType]
    : null;
  const selectedInvestmentConfig =
    INVESTMENT_LEVELS.find((item) => item.level === selectedLevel) ??
    INVESTMENT_LEVELS[0];
  const maxAffordableConfig = [...INVESTMENT_LEVELS].reverse()
    .find((item) => getInvestmentCost(targetProperty.marketPrice, item.level) <= cash);
  const progressionSynergyMultiplier =
    activeProgressionSynergyEffect?.capitalPressureMultiplier ?? 1;
  const effectivePlayerInvested =
    totalPlayerInvested *
    currentWind.playerMultiplier *
    progressionSynergyMultiplier;
  const effectiveEnemyInvested = enemyInvested * enemyCapitalMultiplier;
  const effectiveCapitalGap = effectivePlayerInvested - effectiveEnemyInvested;
  const effectiveCapitalTotal = effectivePlayerInvested + effectiveEnemyInvested;
  const effectivePlayerShare = effectiveCapitalTotal > 0
    ? effectivePlayerInvested / effectiveCapitalTotal * 100
    : 50;
  const displayedPlayerCapitalProgress =
    displayedPlayerInvested / Math.max(1, targetProperty.marketPrice) * 100;
  const extremeOpponentScaleRatio = Math.max(
    0,
    Math.round(displayedPlayerCapitalProgress)
  );
  const displayedCompanyInvested = companyInvested;
  const displayedEffectivePlayerInvested =
    displayedPlayerInvested *
    currentWind.playerMultiplier *
    progressionSynergyMultiplier;
  const enemyCapitalProgress =
    enemyInvested / Math.max(1, targetProperty.marketPrice) * 100;
  const capitalPressureLabel = effectivePlayerShare >= 58
    ? '自社優勢'
    : effectivePlayerShare <= 42
      ? isTraining ? '木人優勢' : '競合優勢'
      : isTraining ? '訓練資本拮抗' : '資本拮抗';
  const savageRaidDefinition = isSavage
    ? getSavageRaidDefinition(targetProperty.id)
    : null;
  const savageLayerMatch = isSavage
    ? targetProperty.name.match(/第([1-4])層/)
    : null;
  const savageLayer = isSavage
    ? savageRaidDefinition?.layer ?? Number(savageLayerMatch?.[1] ?? 1)
    : 0;
  const savageSeries = isSavage ? savageRaidDefinition?.series ?? 1 : 0;
  const enemySupportProfile = getEnemySupportSkillProfile({
    targetProperty,
    isCityBoss,
    isSavage,
    isUltimate,
    isCruel,
  });
  const openingBossAbilityTier = getOpeningBossAbilityTier({
    targetProperty,
    isSavage,
  });
  const enemySupportAutoProfile = useMemo(
    () =>
      getEnemySupportAutoProfile({
        targetProperty,
        isCityBoss,
        isSavage,
        isUltimate,
        isCruel,
        ultimatePatternIndex: ultimateEnemyPatternIndex,
      }),
    [
      isCityBoss,
      isSavage,
      isUltimate,
      isCruel,
      targetProperty,
      ultimateEnemyPatternIndex,
    ]
  );
  const trainingDummyDefinition = isTraining
    ? getTrainingDummyDefinition(targetProperty.id)
    : null;
  const opponentArtSeed = `${targetProperty.id}-${targetProperty.community}-${targetProperty.industry}-${targetProperty.ownerName}`;
  const opponentCharacterArt = trainingDummyDefinition
    ? getFankitTrainingDummyArt(trainingDummyDefinition.level)
    : isCruel
      ? FANKIT_ART.tataru.windUp
    : getFankitJobArt(opponentArtSeed);
  const bossEnemyPartySize = getBossEnemyPartySize({
    bossAbilityTier,
    isSavage,
    isUltimate,
  });
  const bossEnemyPartyArts = useMemo(
    () =>
      trainingDummyDefinition || isCruel
        ? [opponentCharacterArt]
        : getFankitJobPartyArt(opponentArtSeed, bossEnemyPartySize),
    [
      bossEnemyPartySize,
      opponentArtSeed,
      opponentCharacterArt,
      isCruel,
      trainingDummyDefinition,
    ]
  );
  const autoSkillIds = useMemo(
    () =>
      new Set(
        [openingAutoSkillId, criticalAutoSkillId].filter(
          (id): id is string => !!id
        )
      ),
    [criticalAutoSkillId, openingAutoSkillId]
  );
  const openingAutoSkill =
    equippedSkills.find((skill) => skill.id === openingAutoSkillId) ?? null;
  const criticalAutoSkill =
    equippedSkills.find((skill) => skill.id === criticalAutoSkillId) ?? null;
  const usableEquippedSkills = useMemo(
    () =>
      equippedSkills.filter(
        (skill) =>
          !autoSkillIds.has(skill.id) &&
          isSkillUsableInBattle({
            skill,
            isTraining,
            subsidiaryCount: battleSubs.length,
          })
      ),
    [autoSkillIds, battleSubs.length, equippedSkills, isTraining]
  );
  const usableAvailableSkills = useMemo(
    () =>
      availableSkills.filter(
        (skill) =>
          !autoSkillIds.has(skill.id) &&
          isSkillUsableInBattle({
            skill,
            isTraining,
            subsidiaryCount: battleSubs.length,
          })
      ),
    [autoSkillIds, availableSkills, battleSubs.length, isTraining]
  );
  const skillSelection = resolveBattleSkillSelection(
    usableEquippedSkills.map((skill) => skill.id),
    usableAvailableSkills.map((skill) => skill.id),
    selectedSkillId
  );
  const battleSkillPool =
    usableEquippedSkills;

  useEffect(() => {
    if (selectedSkillId === skillSelection.selectedSkillId) return;
    setSelectedSkillId(skillSelection.selectedSkillId);
  }, [selectedSkillId, skillSelection.selectedSkillId]);

  const primarySkill =
    battleSkillPool.find(
      (skill) => skill.id === skillSelection.selectedSkillId
    ) ??
    null;
  const stunSkill =
    battleSkillPool.find(
      (skill) => skill.effectType === 'INDEPENDENCE_SABOTAGE'
    ) ?? null;
  const usingSkillFallback = skillSelection.usingFallback;
  const primarySkillCooldown = primarySkill
    ? skillCooldowns[primarySkill.id] || 0
    : 0;
  const primarySkillUsed = !!primarySkill?.oncePerBattle &&
    usedSkillIds.has(primarySkill.id);
  const primarySkillUnavailable =
    !!primarySkill && isTraining && isRivalOnlySkill(primarySkill);
  const primarySkillDefenseConflict =
    !!primarySkill &&
    (primarySkill.effectType === 'COVER' ||
      primarySkill.effectType === 'BARRIER') &&
    (playerCoverRemaining > 0 || playerBarrierRemaining > 0);
  const criticalAutoReadyForTrigger =
    !!criticalAutoSkill &&
    (skillCooldowns[criticalAutoSkill.id] || 0) <= 0 &&
    (!criticalAutoSkill.oncePerBattle ||
      !usedSkillIds.has(criticalAutoSkill.id)) &&
    isSkillUsableInBattle({
      skill: criticalAutoSkill,
      isTraining,
      subsidiaryCount: battleSubs.length,
    }) &&
    !(
      (criticalAutoSkill.effectType === 'COVER' ||
        criticalAutoSkill.effectType === 'BARRIER') &&
      (playerCoverRemaining > 0 || playerBarrierRemaining > 0)
    );
  const primarySkillExecutionBlocked =
    !primarySkill ||
    primarySkillUnavailable ||
    primarySkillDefenseConflict ||
    !commandReady ||
    primarySkillCooldown > 0 ||
    primarySkillUsed;
  const primarySkillStateText = !primarySkill
    ? '未選択'
    : primarySkillUnavailable
      ? '対象なし'
      : primarySkillDefenseConflict
        ? '防御中'
      : primarySkillUsed
            ? '使用済み'
            : primarySkillCooldown > 0
              ? `${(primarySkillCooldown / 1000).toFixed(1)}秒`
              : commandReady
                ? '発動可'
                : '準備中';
  const ownershipRate = Math.abs(gaugeSpeed) / 2;
  const battleDirection = gaugeSpeed < -0.08 ? 'player' : gaugeSpeed > 0.08 ? 'enemy' : 'even';
  const enemyReserveCapacity = Math.max(1, enemyBudget);
  const enemyMinimumCommitment = getEnemyMinimumCommitment(
    targetProperty.marketPrice
  );
  const enemyCanCommit =
    isTraining || enemyReserve >= enemyMinimumCommitment;
  const enemySupportInterruptibility =
    enemySupportCinematic?.stage === 'telegraph'
      ? getEnemyActionInterruptibility(enemySupportCinematic.skillId)
      : null;
  const stunOpportunity =
    !!stunSkill &&
    (
      enemySupportCinematic?.stage === 'telegraph' ||
      (aiProgress >= 72 && enemyCanCommit && !resolvingAiActionRef.current)
    );
  const stunQuickUnavailable =
    !stunSkill ||
    (skillCooldowns[stunSkill.id] || 0) > 0 ||
    (!!stunSkill.oncePerBattle && usedSkillIds.has(stunSkill.id)) ||
    enemySupportInterruptibility === 'unstoppable';
  const enemyReservePercent = enemyReserve <= 0
    ? 0
    : Math.min(100, (enemyReserve / enemyReserveCapacity) * 100);
  const enemyReserveState = isTraining
    ? 'healthy'
    : enemyReservePercent <= 0 ? 'short' : enemyReservePercent <= 10 ? 'critical'
      : enemyReservePercent <= 25 ? 'danger' : enemyReservePercent <= 50 ? 'warning' : 'healthy';
  const playerReserveCapacity = Math.max(1, initialBattleCashRef.current);
  const playerReservePercent = Math.max(0, Math.min(100, (cash / playerReserveCapacity) * 100));
  const playerRecoveryPercent = initialBattleCashRef.current > 0
    ? Math.min(20, battleCashRecovered / initialBattleCashRef.current * 100)
    : 0;
  const enemyRecoveryPercent = enemyBudget > 0
    ? Math.min(20, enemyCashRecovered / enemyBudget * 100)
    : 0;
  const playerReserveState = playerReservePercent <= 0 ? 'short' : playerReservePercent <= 10 ? 'critical'
    : playerReservePercent <= 25 ? 'danger' : playerReservePercent <= 50 ? 'warning' : 'healthy';
  const windEnabled = !isTraining && windProgressionStage > 0;
  const windTelegraphVisible =
    windEnabled &&
    battleWindState.phase === 'telegraph' &&
    !!pendingWindCondition;
  const presentedWind = windTelegraphVisible
    ? pendingWindCondition
    : currentWind;
  const windSide = eraWindActive
    ? 'player'
    : enemyMarketWindActive
      ? 'enemy'
    : !windEnabled
      ? 'calm'
      : presentedWind.type === 'TAILWIND_PLAYER'
        ? 'player'
        : presentedWind.type === 'TAILWIND_ENEMY' ||
            presentedWind.type === 'HEADWIND_PLAYER'
          ? 'enemy'
          : presentedWind.type === 'CROSSWIND'
            ? 'cross'
            : 'calm';
  const liveActiveSynergies = useMemo(
    () =>
      activeSynergies.filter(
        (synergy) =>
          !synergy.battleOnly &&
          synergy.requiredPropertyIds.every((propertyId) =>
            battleSubs.some((property) => property.id === propertyId)
          )
      ),
    [activeSynergies, battleSubs]
  );
  const hasActiveBattleSynergy =
    liveActiveSynergies.length > 0 ||
    progressionSynergyRemaining > 0 ||
    industryInfluence.playerBonus > 0 ||
    regionalInfluence.playerBonus > 0 ||
    tradeNetworkBonus > 0 ||
    battleSubs.length + 1 >= 4;
  const isBurstTime =
    !eraWindActive &&
    battleWindState.phase === 'active' &&
    windSide === 'player' &&
    hasActiveBattleSynergy;
  const windVisible =
    battlePhase === 'active' &&
    !winner &&
    !decisiveBlow &&
    (
      eraWindActive ||
      enemyMarketWindActive ||
      (windEnabled &&
        (windTelegraphVisible || currentWind.type !== 'CALM'))
    );
  const eraWindOwnershipPushPerSecond = eraWindPushPerSecond / 2;
  const eraWindGilPerSecond = calculateLimitBreakPushGilEquivalent(
    targetProperty.marketPrice,
    eraWindOwnershipPushPerSecond
  );
  const windTitle = eraWindActive
    ? '時代の風'
    : enemyMarketWindActive
      ? 'ディヴィネーション'
    : windTelegraphVisible
      ? '市場気配'
      : isBurstTime
        ? 'BURST TIME'
        : windSide === 'player'
          ? '味方追い風'
          : windSide === 'enemy'
            ? '敵方優勢の風'
            : windSide === 'cross'
              ? '乱旋風'
              : '静穏';
  const windHudTitle = windTitle;
  const recoveryWindMultipliers = getBattleCashRecoveryWindMultipliers(
    eraWindActive || enemyMarketWindActive ? 'CALM' : currentWind.type
  );
  const windDetail = eraWindActive
    ? `風が……来る！ 毎秒約${formatCurrency(eraWindGilPerSecond)}相当 / 商流リジェネ ×1.00`
    : enemyMarketWindActive
      ? `競合が相場を誘導――敵防衛 ×${enemyCapitalMultiplier.toFixed(2)} / 商流リジェネ ×1.00`
    : windTelegraphVisible
      ? `${BATTLE_WIND_TELEGRAPH_SECONDS}秒後に${presentedWind.title}`
      : isBurstTime
        ? `風 × SYNERGY / 自社効果 ×${currentWind.playerMultiplier.toFixed(2)} / 商流リジェネ ×${recoveryWindMultipliers.player.toFixed(2)}`
        : currentWind.type === 'HEADWIND_PLAYER'
          ? `自社効果 ×${currentWind.playerMultiplier.toFixed(2)} / 商流リジェネ ×${recoveryWindMultipliers.player.toFixed(2)}`
          : windSide === 'player'
            ? `自社効果 ×${currentWind.playerMultiplier.toFixed(2)} / 商流リジェネ ×${recoveryWindMultipliers.player.toFixed(2)}`
            : windSide === 'enemy'
              ? `敵防衛 ×${currentWind.enemyMultiplier.toFixed(2)} / 敵回復 ×${recoveryWindMultipliers.enemy.toFixed(2)}`
              : currentWind.type === 'CROSSWIND'
                ? `双方 ×${currentWind.playerMultiplier.toFixed(2)} / 商流リジェネ ×${recoveryWindMultipliers.player.toFixed(2)}`
                : '双方の資金効果 ×1.00';
  const fastHorse = fastHorseRemaining > 0;
  const limitBreakCapacityTier = getLimitBreakTier(battleSubs.length + 1);
  const limitBreakChargeCapacity = getLimitBreakChargeCapacity(limitBreakCapacityTier);
  const visibleLimitBreakCharge = Math.min(
    limitBreakChargeCapacity,
    Math.max(0, limitBreakCharge)
  );
  const limitBreakTier = getChargedLimitBreakTier(
    visibleLimitBreakCharge,
    limitBreakCapacityTier
  );
  const limitBreakGaugeFull =
    limitBreakChargeCapacity > 0 &&
    visibleLimitBreakCharge >= limitBreakChargeCapacity;
  const limitBreakMultiplier = limitBreakTier > 0 ? LIMIT_BREAK_MULTIPLIERS[limitBreakTier] : 0;
  const limitBreakOwnershipCap = limitBreakTier > 0
    ? LIMIT_BREAK_OWNERSHIP_CAPS[limitBreakTier]
    : 0;
  const limitBreakCapEquivalent = calculateLimitBreakPushGilEquivalent(
    targetProperty.marketPrice,
    limitBreakOwnershipCap
  );
  const limitBreakApproximateAmount = limitBreakTier > 0
    ? calculateLimitBreakAmount(
        targetProperty.marketPrice,
        battleSubs,
        limitBreakTier,
        subRequestCounts
      )
    : 0;
  const selectedBattleSynergyEffectLabel = selectedBattleSynergy?.battleOnly &&
    selectedBattleSynergy.battleEffect
      ? `圧力+${Math.round(
          (selectedBattleSynergy.battleEffect.capitalPressureMultiplier - 1) * 100
        )}%${selectedBattleSynergy.battleEffect.limitBreakChargeMultiplier
          ? `・LB蓄積×${selectedBattleSynergy.battleEffect.limitBreakChargeMultiplier.toFixed(2)}`
          : ''}・${
          progressionSynergyRemaining > 0
            ? `残${Math.ceil(progressionSynergyRemaining / 1000)}秒`
            : `${Math.round(selectedBattleSynergy.battleEffect.durationMs / 1000)}秒`
        }`
      : selectedBattleSynergy
        ? `一斉支援×${(
            selectedBattleSynergy.battleGroupMultiplier ??
            BATTLE_SUPPORT_BALANCE.synergyDefaultMultiplier
          ).toFixed(2)}`
        : '';
  const alliancePublicPatronage = isPublicPatronage(alliance);
  const allianceSupport = alliance.active && !allianceUsed
    ? calculateAllianceSupport(targetProperty.marketPrice)
    : 0;
  const readinessMechanics: string[] = [];
  if (bossAbilityTier === 'invincible') {
    readinessMechanics.push('インビンシブル5秒→有限パッセ6秒');
  } else if (bossAbilityTier === 'enhanced_cover') {
    readinessMechanics.push('パッセージ・オブ・アームズ');
  } else if (bossAbilityTier === 'cover') {
    readinessMechanics.push('かばう');
  } else if (bossAbilityTier === 'boss') {
    readinessMechanics.push('都市ボス固有の防衛判断');
  }
  enemySupportProfile.forEach((skillId) => {
    readinessMechanics.push(ENEMY_SUPPORT_PRESENTATION[skillId].actionName);
  });
  if (enemySupportAutoProfile.opening) {
    readinessMechanics.push(
      ENEMY_SUPPORT_PRESENTATION[enemySupportAutoProfile.opening].actionName
    );
  }
  if (enemySupportAutoProfile.critical) {
    readinessMechanics.push(
      ENEMY_SUPPORT_PRESENTATION[enemySupportAutoProfile.critical].actionName
    );
  }
  const normalReadinessMechanics = Array.from(new Set(readinessMechanics));
  const normalMechanicWarning =
    !isSavage &&
    !isUltimate &&
    !isCruel &&
    normalReadinessMechanics.length > 0
      ? `固有ギミック：${normalReadinessMechanics.join('・')}。資金総額だけでなく、行動予告と防御時間を見て投入してください。`
      : undefined;
  const normalMechanicSeverity =
    normalMechanicWarning
      ? targetProperty.isCartelHQ || bossAbilityTier === 'invincible'
        ? 'severe' as const
        : 'warning' as const
      : undefined;
  const [battleReadiness] = useState(() =>
    calculateBattleReadiness({
      targetMarketPrice: targetProperty.marketPrice,
      availableCash: cash,
      subsidiaries: battleSubs,
      selectedBattleSynergy,
      limitBreakCharge,
      allianceSupport,
      hasCapitalBoost: equippedSkills.some(
        (skill) => skill.effectType === 'CAPITAL_BOOST'
      ),
      enemyBudget,
      enemyDifficultyLevel,
      enemyBaseReactionSeconds:
        getEnemyBaseWaitMs(
          enemyDifficultyLevel,
          isTutorial,
          !!targetProperty.isCartelHQ
        ) / 1000,
      playerPushBonus: influenceBonus,
      cashCapRatio: isTraining ? null : undefined,
      battleMode: isTraining
        ? 'training'
        : isCruel
          ? 'cruel'
        : isUltimate
          ? 'ultimate'
          : isSavage
            ? 'savage'
            : isExtremeBattle
              ? 'extreme'
              : 'normal',
      mechanicWarning: normalMechanicWarning,
      mechanicSeverity: normalMechanicSeverity,
    })
  );
  const commandProgressPerTick = fastHorse
    ? TACTICAL_SKILL_BALANCE.fastAction.boostedCommandProgressPerTick
    : TACTICAL_SKILL_BALANCE.fastAction.baseCommandProgressPerTick;
  const enemySupportPresentationLocked =
    !!enemySupportCinematic &&
    enemySupportCinematic.stage !== 'telegraph';
  const cruelScriptedCountdownActive =
    enemySupportCinematic?.stage === 'telegraph' &&
    (enemySupportCinematic.skillId === 'omnicapitalization' ||
      enemySupportCinematic.skillId === 'cruel_reckoning');
  const enemySupportPausesBattle =
    !!enemySupportCinematic && !cruelScriptedCountdownActive;
  const enemyOpeningCoverPending =
    openingBossAbilityTier !== 'none' &&
    !enemyOpeningCoverUsedRef.current;
  const capitalPilePresentationLocked =
    playerCapitalPilePreviewStage !== null ||
    enemyCapitalPilePreviewStage !== null;
  const capitalPileAllowsCommandRecharge =
    playerCapitalPilePreviewStage?.commandRecharge !== 'pause' &&
    enemyCapitalPilePreviewStage?.commandRecharge !== 'pause';
  const presentationLocked =
    !!battleAnnouncement ||
    !!conditionAnnouncement ||
    !!skillCinematic ||
    !!capitalCommit ||
    capitalPilePresentationLocked ||
    openingAutoPending ||
    !!criticalAutoPending ||
    ultimateCriticalGatePending ||
    enemyOpeningCoverPending ||
    enemySupportPresentationLocked;
  const decisiveLocked = !!terminalRef.current || !!decisiveBlow;
  const actionsLocked =
    !!winner ||
    battlePhase !== 'active' ||
    presentationLocked ||
    decisiveLocked ||
    !!impactStop ||
    showHelp ||
    showLog;
  const primarySkillActionLocked = actionsLocked;
  const skillSelectionLocked =
    battleSkillPool.length <= 1 ||
    !!winner ||
    decisiveLocked ||
    showHelp ||
    showLog;
  const displayedPrimarySkillStateText =
    primarySkillActionLocked && primarySkillStateText === '発動可'
      ? '演出待ち'
      : primarySkillStateText;
  const backgroundInert =
    panel !== 'capital' ||
    showHelp ||
    showLog ||
    battlePhase !== 'active' ||
    presentationLocked ||
    decisiveLocked ||
    !!impactStop;
  const playerCoverGuardPercent = getCoverGuardDisplayPercent({
    remainingGaugeCapacity: playerCoverCapacity,
    maximumGaugeCapacity: TACTICAL_SKILL_BALANCE.cover.gaugeCapacity,
    remainingMs: playerCoverRemaining,
    durationMs: TACTICAL_SKILL_BALANCE.cover.durationMs,
  });
  const playerBarrierPercent = getDivineBenisonDisplayPercent({
    remainingGaugeCapacity: playerBarrierCapacity,
    remainingMs: playerBarrierRemaining,
  });
  const enemyCoverBalance =
    enemyActiveCoverTier === 'invincible'
      ? BOSS_COVER_BALANCE.invincible
      : bossAbilityTier === 'invincible' &&
          enemyActiveCoverTier === 'enhanced_cover'
        ? {
            gaugeCapacity:
              BOSS_COVER_BALANCE.invincible.followupGaugeCapacity,
            durationMs: BOSS_COVER_BALANCE.invincible.followupDurationMs,
          }
      : enemyActiveCoverTier === 'enhanced_cover'
        ? BOSS_COVER_BALANCE.enhancedCover
        : BOSS_COVER_BALANCE.cover;
  const enemyCoverGuardPercent = getCoverGuardDisplayPercent({
    remainingGaugeCapacity: enemyCoverCapacity,
    maximumGaugeCapacity: enemyCoverBalance.gaugeCapacity,
    remainingMs: enemyCoverRemaining,
    durationMs: enemyCoverBalance.durationMs,
  });
  const enemyBarrierPercent = getDivineBenisonDisplayPercent({
    remainingGaugeCapacity: enemyBarrierCapacity,
    remainingMs: enemyBarrierRemaining,
  });
  const footerInteractionBlocked =
    panel !== 'capital' ||
    showHelp ||
    showLog ||
    battlePhase === 'briefing' ||
    battlePhase === 'decisive' ||
    battlePhase === 'result';
  const footerInert = shouldInertBattleFooter(
    footerInteractionBlocked,
    !!winner,
    battlePhase
  );
  const presentationPauseActive =
    battlePhase !== 'active' ||
    !!terminalCinematicStage ||
    !!skillCinematic ||
    !!capitalCommit ||
    enemySupportPausesBattle ||
    openingAutoPending ||
    !!criticalAutoPending ||
    ultimateCriticalGatePending ||
    presentationLocked ||
    decisiveLocked ||
    showHelp ||
    showLog ||
    panel !== 'capital';
  useLayoutEffect(() => {
    simulationPausedRef.current = presentationPauseActive;
  }, [presentationPauseActive]);
  const timeScale = presentationPauseActive
    ? 0
    : decisionGraceActive
      ? 0.12
    : openingAutoPending || criticalAutoPending
      ? 0
    : capitalCommit
      ? 0
    : impactStop?.phase === 'hitstop'
      ? 0
    : terminalCinematicStage
      ? 0
      : skillCinematic
        ? 0
      : enemySupportPausesBattle
        ? 0
      : battlePhase !== 'active'
        ? 0
        : openingSlowActive
          ? 0.1
          : 1;
  const baseCommandTimeScale = decisionGraceActive
    ? 0.12
    : openingSlowActive
      ? 0.1
      : 1;
  const fullCommandPauseActive =
    battlePhase !== 'active' ||
    !!winner ||
    !!terminalCinematicStage ||
    !!battleAnnouncement ||
    !!conditionAnnouncement ||
    !!skillCinematic ||
    enemySupportPausesBattle ||
    openingAutoPending ||
    !!criticalAutoPending ||
    ultimateCriticalGatePending ||
    enemyOpeningCoverPending ||
    decisiveLocked ||
    impactStop?.phase === 'hitstop' ||
    showHelp ||
    showLog ||
    panel !== 'capital';
  const { commandTimeScale } = getBattleClockScales({
    baseTimeScale: baseCommandTimeScale,
    simulationPaused:
      presentationPauseActive || impactStop?.phase === 'hitstop',
    capitalPileActive: capitalPilePresentationLocked,
    capitalPileAllowsCommandRecharge,
    fullPresentationActive: fullCommandPauseActive,
  });
  const enemySupportCastBlocked =
    !!battleAnnouncement ||
    !!conditionAnnouncement ||
    !!skillCinematic ||
    !!capitalCommit ||
    capitalPilePresentationLocked ||
    openingAutoPending ||
    !!criticalAutoPending ||
    ultimateCriticalGatePending ||
    !!impactStop ||
    limitImpactActive ||
    !!terminalCinematicStage ||
    showHelp ||
    showLog ||
    panel !== 'capital';
  useEffect(() => {
    enemySupportCastBlockedRef.current = enemySupportCastBlocked;
    if (!enemySupportCastBlocked) {
      const resumePendingCast = enemySupportPendingCastRef.current;
      if (resumePendingCast) {
        enemySupportPendingCastRef.current = null;
        resumePendingCast();
      }
    }
  }, [enemySupportCastBlocked]);
  const enemyOwnershipForAi = Math.round((100 - ownership) / 5) * 5;
  const enemyDecision = useMemo(() => decideEnemyAction({
    enemyOwnership: enemyOwnershipForAi,
    enemyReservePercent,
    windType: currentWind.type,
    windRemainingSeconds: windCountdown,
    lastPlayerAction,
    effectiveCapitalGap,
    marketPrice: targetProperty.marketPrice,
    isCartelHQ: !!targetProperty.isCartelHQ,
    isTutorial,
    slowed: false,
    cycle: aiCycle,
    difficultyLevel: enemyDifficultyLevel,
  }), [
    aiCycle, currentWind.type, effectiveCapitalGap, enemyOwnershipForAi, enemyReservePercent,
    enemyDifficultyLevel, isTutorial, lastPlayerAction, targetProperty.isCartelHQ,
    targetProperty.marketPrice, windCountdown,
  ]);
  const livingDeadDuration = livingDeadPhase === 'waiting'
    ? TACTICAL_SKILL_BALANCE.livingDead.waitingDurationMs
    : livingDeadPhase === 'recovery'
      ? TACTICAL_SKILL_BALANCE.livingDead.recoveryDurationMs
      : 0;
  const livingDeadProgress = livingDeadDuration > 0
    ? Math.max(0, Math.min(100, livingDeadRemaining / livingDeadDuration * 100))
    : livingDeadPhase === 'survived' ? 100 : 0;
  useEffect(() => {
    if (
      terminalRef.current ||
      winner ||
      battlePhase !== 'active' ||
      selectedCost <= cash ||
      !maxAffordableConfig
    ) return;
    setSelectedLevel(maxAffordableConfig.level);
    setStatusText(`残高に合わせて投資額を「${maxAffordableConfig.label}」へ自動調整`);
  }, [battlePhase, cash, maxAffordableConfig, selectedCost, winner]);

  useEffect(() => {
    onTimeScaleChange?.(timeScale);
  }, [onTimeScaleChange, timeScale]);

  useEffect(() => {
    if (
      !windEnabled ||
      !shouldAdvanceBattleWind({
        battleActive: battlePhase === 'active',
        settled: !!winner || decisiveLocked,
        presentationLocked: false,
        eraWindActive: eraWindActive || enemyMarketWindActive,
      }) ||
      timeScale <= 0
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      if (terminalRef.current || simulationPausedRef.current) return;
      setBattleWindState((current) =>
        advanceBattleWind(
          current,
          0.25 * timeScale,
          getWindPool(windProgressionStage)
        )
      );
    }, 250);
    return () => window.clearInterval(timer);
  }, [
    battlePhase,
    decisiveLocked,
    enemyMarketWindActive,
    eraWindActive,
    timeScale,
    windEnabled,
    windProgressionStage,
    winner,
  ]);

  useEffect(() => {
    if (!commandReady) {
      commandReadySoundArmedRef.current = true;
      decisionGraceArmedRef.current = true;
      return;
    }
    if (
      commandReadySoundArmedRef.current &&
      battlePhase === 'active' &&
      !winner
    ) {
      commandReadySoundArmedRef.current = false;
      soundFx.playCommandReady();
    }
  }, [battlePhase, commandReady, winner]);

  useEffect(() => {
    if (
      !commandReady ||
      !decisionGraceArmedRef.current ||
      battlePhase !== 'active' ||
      winner ||
      presentationLocked ||
      decisiveLocked
    ) {
      return;
    }
    decisionGraceArmedRef.current = false;
    setDecisionGraceActive(true);
    if (decisionGraceTimerRef.current) {
      window.clearTimeout(decisionGraceTimerRef.current);
    }
    decisionGraceTimerRef.current = window.setTimeout(() => {
      decisionGraceTimerRef.current = null;
      setDecisionGraceActive(false);
    }, 1_800);
  }, [
    battlePhase,
    commandReady,
    decisiveLocked,
    presentationLocked,
    winner,
  ]);

  useEffect(() => {
    if (
      battlePhase !== 'active' ||
      winner ||
      presentationLocked ||
      timeScale < 0.5 ||
      Math.abs(gaugeSpeed) < 0.03
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      soundFx.playBattlePulse(
        gaugeSpeed < 0 ? 'player' : 'opponent',
        Math.min(1, 0.35 + Math.abs(gaugeSpeed) / 2.5)
      );
    }, 720);
    return () => window.clearInterval(timer);
  }, [battlePhase, gaugeSpeed, presentationLocked, timeScale, winner]);

  useEffect(() => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const root = document.getElementById('root');
    const elements: HTMLElement[] = [document.documentElement, document.body];
    if (root) elements.push(root);
    const previous = elements.map((element) => ({
      element,
      overflow: element.style.overflow,
      overscrollBehavior: element.style.overscrollBehavior,
    }));

    previous.forEach(({ element }) => {
      element.style.overflow = 'hidden';
      element.style.overscrollBehavior = 'none';
    });

    return () => {
      previous.forEach(({ element, overflow, overscrollBehavior }) => {
        element.style.overflow = overflow;
        element.style.overscrollBehavior = overscrollBehavior;
      });
      window.scrollTo(scrollX, scrollY);
    };
  }, []);

  useEffect(() => () => {
    terminalCapitalRefreshRecoveryRef.current =
      terminalCapitalHandoffRef.current;
    terminalCapitalHandoffRef.current = null;
    onTimeScaleChange?.(1);
    if (announcementTimerRef.current) window.clearTimeout(announcementTimerRef.current);
    if (limitBreakTimerRef.current) window.clearTimeout(limitBreakTimerRef.current);
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    if (resultConfirmTimerRef.current) window.clearTimeout(resultConfirmTimerRef.current);
    if (limitImpactTimerRef.current) window.clearTimeout(limitImpactTimerRef.current);
    if (limitTerminalHandoffTimerRef.current) {
      window.clearTimeout(limitTerminalHandoffTimerRef.current);
    }
    if (conditionTimerRef.current) window.clearTimeout(conditionTimerRef.current);
    if (openingSlowTimerRef.current) window.clearTimeout(openingSlowTimerRef.current);
    if (decisiveImpactTimerRef.current) window.clearTimeout(decisiveImpactTimerRef.current);
    if (decisiveReleaseTimerRef.current) window.clearTimeout(decisiveReleaseTimerRef.current);
    if (decisiveResolveTimerRef.current) window.clearTimeout(decisiveResolveTimerRef.current);
    if (livingDeadNoticeTimerRef.current) window.clearTimeout(livingDeadNoticeTimerRef.current);
    if (decisionGraceTimerRef.current) window.clearTimeout(decisionGraceTimerRef.current);
    if (motionTimerRef.current) window.clearTimeout(motionTimerRef.current);
    if (impactStopTimerRef.current) window.clearTimeout(impactStopTimerRef.current);
    if (impactReleaseTimerRef.current) window.clearTimeout(impactReleaseTimerRef.current);
    if (playerCoverExitTimerRef.current) window.clearTimeout(playerCoverExitTimerRef.current);
    if (enemyCoverExitTimerRef.current) window.clearTimeout(enemyCoverExitTimerRef.current);
    floaterTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    floaterTimersRef.current.clear();
    clearCapitalCommitTimers();
    clearCapitalPilePreview();
    capitalCommitActiveRef.current = false;
    clearSkillCinematicTimer();
    clearEnemySupportTimers();
    void confettiModulePromise
      ?.then((victoryConfetti) => victoryConfetti.reset())
      .catch(() => undefined);
    soundFx.stopBattleCinematicAudio(80);
  }, [
    clearCapitalCommitTimers,
    clearCapitalPilePreview,
    clearEnemySupportTimers,
    clearSkillCinematicTimer,
    onTimeScaleChange,
  ]);

  useEffect(() => {
    if (
      terminalRef.current ||
      winner ||
      battlePhase === 'finisher_notice' ||
      battlePhase === 'result'
    ) return;
    setAiText(`${ENEMY_INTENT_LABELS[enemyDecision.intent]} / ${enemyDecision.reason}`);
  }, [
    battlePhase,
    enemyDecision.intent,
    enemyDecision.reason,
    winner,
  ]);

  const addLog = (text: string, category: LogCategory = 'system') => {
    const entry = { id: `${Date.now()}-${Math.random()}`, category, text };
    setLogs((current) => [entry, ...current].slice(0, 100));
  };

  const showFloater = (
    text: string,
    side: FloatingGil['side'],
    tone: FloatingGil['tone'] = 'positive',
    kind: FloatingGil['kind'] = 'normal'
  ) => {
    const id = Date.now() + Math.random();
    setFloaters((current) => [
      ...current.slice(-2),
      { id, text, side, tone, kind },
    ]);
    const timer = window.setTimeout(() => {
      floaterTimersRef.current.delete(timer);
      setFloaters((current) => current.filter((item) => item.id !== id));
    }, 2600);
    floaterTimersRef.current.add(timer);
  };

  const playMotion = (next: BattleMotion) => {
    if (motionTimerRef.current) window.clearTimeout(motionTimerRef.current);
    setMotion(next);
    setMotionSerial((current) => current + 1);
    motionTimerRef.current = window.setTimeout(() => {
      motionTimerRef.current = null;
      setMotion('idle');
    }, 620);
  };

  const triggerImpactStop = useCallback((
    side: ImpactStopSide,
    heavy = false
  ) => {
    if (endedRef.current || terminalRef.current) return;
    simulationPausedRef.current = true;
    clearImpactStop();
    impactStopSerialRef.current += 1;
    const serial = impactStopSerialRef.current;
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
      false;
    const timing = getBattleHitStopTiming(heavy, reducedMotion);
    setImpactStop({ side, phase: 'hitstop', heavy, serial });
    impactStopTimerRef.current = window.setTimeout(() => {
      if (impactStopSerialRef.current !== serial) return;
      impactStopTimerRef.current = null;
      if (endedRef.current || terminalRef.current) return;
      setImpactStop((current) =>
        current?.serial === serial
          ? { ...current, phase: 'release' }
          : current
      );
    }, timing.hitStopMs);
    impactReleaseTimerRef.current = window.setTimeout(() => {
      if (impactStopSerialRef.current !== serial) return;
      impactReleaseTimerRef.current = null;
      setImpactStop((current) =>
        current?.serial === serial ? null : current
      );
      if (motionTimerRef.current) {
        window.clearTimeout(motionTimerRef.current);
        motionTimerRef.current = null;
      }
      setMotion('idle');
    }, timing.hitStopMs + timing.releaseMs);
  }, [clearImpactStop]);

  const chargeLimitBreak = (effectiveCapitalMovement: number) => {
    if (limitBreakChargeCapacity <= 0 || effectiveCapitalMovement <= 0) return 0;
    const baseGain = calculateLimitBreakChargeGain(
      effectiveCapitalMovement,
      targetProperty.marketPrice
    );
    const gain = baseGain * limitBreakChargeMultiplier;
    onLimitBreakChargeChange((current) =>
      Math.min(limitBreakChargeCapacity, Math.max(0, current) + gain)
    );
    return gain;
  };

  const announceBattle = (announcement: BattleAnnouncement, duration = 2000) => {
    if (announcementTimerRef.current) window.clearTimeout(announcementTimerRef.current);
    simulationPausedRef.current = true;
    enemySupportCastBlockedRef.current = true;
    setBattleAnnouncement(announcement);
    announcementTimerRef.current = window.setTimeout(() => setBattleAnnouncement(null), duration);
  };

  const announceCondition = (announcement: BattleConditionAnnouncement) => {
    if (terminalRef.current || endedRef.current) return;
    simulationPausedRef.current = true;
    setConditionAnnouncementQueue((current) =>
      enqueueBattleStatusMessage(
        current,
        announcement,
        conditionAnnouncement?.text ?? null
      )
    );
  };

  useEffect(() => {
    if (
      conditionAnnouncement ||
      battleAnnouncement ||
      limitImpactActive ||
      impactStop ||
      skillCinematic ||
      capitalCommit ||
      openingAutoPending ||
      criticalAutoPending ||
      enemySupportCinematic ||
      terminalRef.current ||
      endedRef.current ||
      conditionAnnouncementQueue.length === 0
    ) {
      return;
    }
    const [next, ...rest] = conditionAnnouncementQueue;
    setConditionAnnouncement(next);
    setConditionAnnouncementQueue(rest);
    if (next.sound === 'warning') soundFx.playWarning();
    else if (next.sound === 'cash') soundFx.playBigCash();
    else if (next.sound === 'skill') soundFx.playSkillSpark();
    conditionTimerRef.current = window.setTimeout(() => {
      conditionTimerRef.current = null;
      setConditionAnnouncement(null);
    }, BATTLE_STATUS_MESSAGE_DURATION_MS);
  }, [
    battleAnnouncement,
    conditionAnnouncement,
    conditionAnnouncementQueue,
    capitalCommit,
    enemySupportCinematic,
    impactStop,
    limitImpactActive,
    openingAutoPending,
    criticalAutoPending,
    skillCinematic,
  ]);

  const announceCurrentWind = () => {
    if (!windEnabled) return false;
    if (currentWind.type === 'CALM') {
      const text = '静穏――風補正が終了し、双方の資金効果が基準値へ戻りました';
      announceCondition({
        kind: 'calm',
        tone: 'neutral',
        text: '風が静まった。',
        priority: 0,
        sound: 'skill',
      });
      const entry = {
        id: `wind-${Date.now()}`,
        category: 'system' as LogCategory,
        text,
      };
      setStatusText(text);
      setLogs((current) => [
        entry,
        ...current,
      ].slice(0, 100));
      return false;
    }

    let announcement: BattleConditionAnnouncement;
    if (isBurstTime) {
      announcement = {
        kind: 'burst',
        tone: 'ally',
        text: '好機（BURST TIME）！\n追い風と事業連携が共鳴！',
        priority: 1,
        sound: 'cash',
      };
    } else if (currentWind.type === 'TAILWIND_PLAYER') {
      announcement = {
        kind: 'player',
        tone: 'ally',
        text: '風向きが変わった！\n自社への追い風！',
        priority: 1,
        sound: 'skill',
      };
    } else if (currentWind.type === 'HEADWIND_PLAYER') {
      announcement = {
        kind: 'enemy',
        tone: 'enemy',
        text: '自社に向かい風！\n競合有利の市場気配！',
        priority: 2,
        sound: 'warning',
      };
    } else if (currentWind.type === 'TAILWIND_ENEMY') {
      announcement = {
        kind: 'enemy',
        tone: 'enemy',
        text: '風向きが変わった！\n競合への追い風！',
        priority: 2,
        sound: 'warning',
      };
    } else if (currentWind.type === 'CROSSWIND') {
      announcement = {
        kind: 'cross',
        tone: 'chaos',
        text: '乱風が吹き荒れる！',
        priority: 2,
        sound: 'warning',
      };
    } else return false;
    announceCondition(announcement);
    const text = normalizeBattleStatusMessageText(announcement.text).replace(/\n/g, '――');
    const entry = {
      id: `wind-${Date.now()}`,
      category: 'system' as LogCategory,
      text,
    };
    setStatusText(text);
    setLogs((current) => [
      entry,
      ...current,
    ].slice(0, 100));
    return true;
  };

  const startBattle = () => {
    if (battlePhaseRef.current !== 'briefing' || endedRef.current) return;
    criticalAutoArmedRef.current = criticalAutoReadyForTrigger;
    criticalAutoTriggeredRef.current = false;
    criticalAutoResolutionPhaseRef.current = 'idle';
    criticalAutoPendingRef.current = null;
    ultimateCriticalGateConsumedRef.current = false;
    ultimateCriticalGatePendingRef.current = false;
    cruelOmnicapitalizationPendingRef.current = null;
    cruelSecondFailurePendingRef.current = false;
    cruelActiveElapsedMsRef.current = 0;
    cruelRecoveryElapsedMsRef.current = 0;
    updateCruelScriptPhase(isCruel ? 'awaiting_first' : 'inactive');
    setCriticalAutoPending(null);
    setUltimateCriticalGatePending(false);
    setCruelOmnicapitalizationPending(null);
    const openingLog = {
      id: `open-${Date.now()}`,
      category: 'system' as LogCategory,
      text: isTraining
        ? `${companyName}、${targetProperty.name}の訓練開始。木人は耐久資本${formatCurrency(initialEnemyCommitment)}を全配置しました。`
        : `${companyName}対${targetProperty.name}、争奪戦開始。競合は${formatCurrency(initialEnemyCommitment)}を先に積みました。`,
    };
    changeBattlePhase('active');
    setCommandProgress(0);
    const canQueueOpeningAuto =
      !!openingAutoSkill &&
      isSkillUsableInBattle({
        skill: openingAutoSkill,
        isTraining,
        subsidiaryCount: battleSubs.length,
      });
    openingAutoTriggeredRef.current = false;
    setOpeningAutoPending(canQueueOpeningAuto);
    setOpeningSlowActive(true);
    setStatusText(
      isTraining
        ? '木人訓練開始――投入・人脈・アビリティを自由に試してください'
        : canQueueOpeningAuto
          ? `${openingAutoSkill.name}を開幕アビリティへ予約`
          : '投資レベルを選び、投資実行でギルを積んでください'
    );
    setLogs((current) => [
      openingLog,
      ...current,
    ]);
    soundFx.playDutyStart();
    announceBattle('start', BATTLE_CINEMATIC_TIMING.startAnnouncementMs);
    if (openingSlowTimerRef.current) window.clearTimeout(openingSlowTimerRef.current);
    openingSlowTimerRef.current = window.setTimeout(
      () => setOpeningSlowActive(false),
      3900
    );
  };

  useEffect(() => {
    if (
      battlePhase !== 'active' ||
      decisiveLocked ||
      winner ||
      !windEnabled ||
      currentWind.type === lastAnnouncedWindRef.current
    ) return;
    lastAnnouncedWindRef.current = currentWind.type;
    announceCurrentWind();
  }, [
    battlePhase,
    currentWind.enemyMultiplier,
    currentWind.playerMultiplier,
    currentWind.speedMultiplier,
    currentWind.type,
    decisiveLocked,
    isBurstTime,
    windEnabled,
    winner,
  ]);

  useEffect(() => {
    if (
      battlePhase !== 'active' ||
      decisiveLocked ||
      winner ||
      battleWindState.phase !== 'telegraph' ||
      !battleWindState.pendingWindType ||
      battleWindState.pendingWindType === lastTelegraphedWindRef.current
    ) {
      return;
    }
    lastTelegraphedWindRef.current = battleWindState.pendingWindType;
    const nextWind = WIND_CONDITIONS[battleWindState.pendingWindType];
    const text = `市場気配――風が……来る！ ${BATTLE_WIND_TELEGRAPH_SECONDS}秒後に${nextWind.title}`;
    announceCondition({
      kind: 'wind_telegraph',
      tone:
        nextWind.type === 'TAILWIND_ENEMY' ||
        nextWind.type === 'HEADWIND_PLAYER'
          ? 'enemy'
          : 'neutral',
      text:
        nextWind.type === 'TAILWIND_ENEMY' ||
        nextWind.type === 'HEADWIND_PLAYER'
          ? '風の兆し……\n自社不利の気配！'
          : '風の兆し……',
      priority:
        nextWind.type === 'TAILWIND_ENEMY' ||
        nextWind.type === 'HEADWIND_PLAYER'
          ? 2
          : 0,
      sound:
        nextWind.type === 'TAILWIND_ENEMY' ||
        nextWind.type === 'HEADWIND_PLAYER'
          ? 'warning'
          : 'skill',
    });
    setStatusText(text);
    setLogs((current) => [
      {
        id: `wind-telegraph-${Date.now()}`,
        category: 'system' as const,
        text,
      },
      ...current,
    ].slice(0, 100));
  }, [
    battlePhase,
    battleWindState.pendingWindType,
    battleWindState.phase,
    decisiveLocked,
    winner,
  ]);

  const consumeCommand = () => {
    if (
      !commandReady ||
      capitalCommitActiveRef.current ||
      capitalPilePreviewActiveRef.current.player ||
      capitalPilePreviewActiveRef.current.enemy ||
      endedRef.current ||
      decisiveRef.current ||
      battlePhase !== 'active' ||
      presentationLocked
    ) {
      soundFx.playWarning();
      return false;
    }
    if (decisionGraceTimerRef.current) {
      window.clearTimeout(decisionGraceTimerRef.current);
      decisionGraceTimerRef.current = null;
    }
    setDecisionGraceActive(false);
    decisionGraceArmedRef.current = true;
    setCommandProgress(0);
    return true;
  };

  const releaseCoverKnight = (
    side: 'player' | 'enemy',
    announce = true
  ) => {
    const isPlayer = side === 'player';
    const timerRef = isPlayer
      ? playerCoverExitTimerRef
      : enemyCoverExitTimerRef;
    if (timerRef.current) return;
    const activatedAtRef = isPlayer
      ? playerCoverActivatedAtRef
      : enemyCoverActivatedAtRef;
    const setKnightPhase = isPlayer
      ? setPlayerCoverKnightPhase
      : setEnemyCoverKnightPhase;
    if (isPlayer) {
      playerCoverRemainingRef.current = 0;
      playerCoverCapacityRef.current = 0;
      setPlayerCoverRemaining(0);
      setPlayerCoverCapacity(0);
    } else {
      enemyCoverRemainingRef.current = 0;
      enemyCoverCapacityRef.current = 0;
      setEnemyCoverRemaining(0);
      setEnemyCoverCapacity(0);
    }
    if (announce) {
      const text = isPlayer
        ? 'パッセの防御ゲージが尽きた――ナイトが吹き飛ばされた！'
        : '競合側の防御ゲージを破壊――ナイトを吹き飛ばした！';
      setStatusText(text);
      addLog(text, 'skill');
      showFloater(
        'GUARD BREAK',
        side,
        side === 'player' ? 'negative' : 'positive'
      );
      soundFx.playCapitalImpact(
        side === 'player' ? 'opponent' : 'player',
        0.72
      );
    }
    const beginGuardBreak = () => {
      setKnightPhase('breaking');
      timerRef.current = window.setTimeout(() => {
        setKnightPhase('leaving');
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          setKnightPhase('absent');
          if (!isPlayer) {
            enemyActiveCoverTierRef.current = 'none';
            setEnemyActiveCoverTier('none');
          }
        }, COVER_KNIGHT_EXIT_MS);
      }, COVER_KNIGHT_BREAK_MS);
    };
    const activeElapsed = Math.max(
      0,
      performance.now() - activatedAtRef.current
    );
    const minimumHoldRemaining = Math.max(
      0,
      COVER_KNIGHT_MIN_ACTIVE_MS - activeElapsed
    );
    if (minimumHoldRemaining > 0) {
      timerRef.current = window.setTimeout(
        beginGuardBreak,
        minimumHoldRemaining
      );
    } else {
      beginGuardBreak();
    }
  };

  const releaseDivineBenison = (
    side: 'player' | 'enemy',
    broke: boolean
  ) => {
    const isPlayer = side === 'player';
    const remainingRef = isPlayer
      ? playerBarrierRemainingRef
      : enemyBarrierRemainingRef;
    const capacityRef = isPlayer
      ? playerBarrierCapacityRef
      : enemyBarrierCapacityRef;
    if (remainingRef.current <= 0 && capacityRef.current <= 0) return;
    remainingRef.current = 0;
    capacityRef.current = 0;
    if (isPlayer) {
      setPlayerBarrierRemaining(0);
      setPlayerBarrierCapacity(0);
    } else {
      setEnemyBarrierRemaining(0);
      setEnemyBarrierCapacity(0);
    }
    const breakLabel = broke ? 'BARRIER BREAK' : 'BARRIER FADE';
    const text = isPlayer
      ? broke
        ? 'ディヴァインベニゾンの障壁が砕けた！'
        : 'ディヴァインベニゾンの効果が終了'
      : broke
        ? '競合のディヴァインベニゾンを破壊！'
        : '競合のディヴァインベニゾンが消滅';
    setStatusText(text);
    showFloater(
      breakLabel,
      side,
      broke
        ? isPlayer
          ? 'negative'
          : 'positive'
        : 'notice'
    );
    addLog(text, 'skill');
    if (broke) soundFx.playCapitalImpact(isPlayer ? 'opponent' : 'player', 0.45);
  };

  const clearPlayerDefenseForCriticalAuto = () => {
    const hadCover =
      playerCoverRemainingRef.current > 0 ||
      playerCoverCapacityRef.current > 0;
    const hadBarrier =
      playerBarrierRemainingRef.current > 0 ||
      playerBarrierCapacityRef.current > 0;
    const coverExitWasPending = playerCoverExitTimerRef.current !== null;
    if (!hadCover && !hadBarrier && !coverExitWasPending) return false;

    if (playerCoverExitTimerRef.current) {
      window.clearTimeout(playerCoverExitTimerRef.current);
      playerCoverExitTimerRef.current = null;
    }
    playerCoverRemainingRef.current = 0;
    playerCoverCapacityRef.current = 0;
    playerBarrierRemainingRef.current = 0;
    playerBarrierCapacityRef.current = 0;
    playerCoverActivatedAtRef.current = 0;
    setPlayerCoverRemaining(0);
    setPlayerCoverCapacity(0);
    setPlayerBarrierRemaining(0);
    setPlayerBarrierCapacity(0);
    if (hadCover || coverExitWasPending) {
      setPlayerCoverKnightPhase('absent');
    }
    return hadCover || hadBarrier;
  };

  const activateDivineBenison = (side: 'player' | 'enemy') => {
    const isPlayer = side === 'player';
    if (
      (isPlayer
        ? playerCoverRemainingRef.current
        : enemyCoverRemainingRef.current) > 0 ||
      (isPlayer
        ? playerBarrierRemainingRef.current
        : enemyBarrierRemainingRef.current) > 0
    ) {
      return false;
    }
    if (isPlayer) {
      playerBarrierRemainingRef.current = DIVINE_BENISON_BALANCE.durationMs;
      playerBarrierCapacityRef.current = DIVINE_BENISON_BALANCE.gaugeCapacity;
      setPlayerBarrierRemaining(DIVINE_BENISON_BALANCE.durationMs);
      setPlayerBarrierCapacity(DIVINE_BENISON_BALANCE.gaugeCapacity);
    } else {
      enemyBarrierRemainingRef.current = DIVINE_BENISON_BALANCE.durationMs;
      enemyBarrierCapacityRef.current = DIVINE_BENISON_BALANCE.gaugeCapacity;
      setEnemyBarrierRemaining(DIVINE_BENISON_BALANCE.durationMs);
      setEnemyBarrierCapacity(DIVINE_BENISON_BALANCE.gaugeCapacity);
    }
    return true;
  };

  const activatePlayerCover = () => {
    if (
      playerBarrierRemainingRef.current > 0 ||
      playerCoverRemainingRef.current > 0
    ) {
      return false;
    }
    if (playerCoverExitTimerRef.current) {
      window.clearTimeout(playerCoverExitTimerRef.current);
      playerCoverExitTimerRef.current = null;
    }
    playerCoverRemainingRef.current = TACTICAL_SKILL_BALANCE.cover.durationMs;
    playerCoverCapacityRef.current =
      TACTICAL_SKILL_BALANCE.cover.gaugeCapacity;
    playerCoverActivatedAtRef.current = performance.now();
    setPlayerCoverRemaining(TACTICAL_SKILL_BALANCE.cover.durationMs);
    setPlayerCoverCapacity(TACTICAL_SKILL_BALANCE.cover.gaugeCapacity);
    setPlayerCoverKnightPhase('active');
    return true;
  };

  const activateEnemyBossAbility = ({
    tier = bossAbilityTier,
    consumeMainAbility = true,
  }: {
    tier?: BossAbilityTier;
    consumeMainAbility?: boolean;
  } = {}) => {
    if (
      (consumeMainAbility && enemyBossAbilityUsedRef.current) ||
      tier === 'none' ||
      tier === 'boss' ||
      enemyCoverRemainingRef.current > 0 ||
      enemyBarrierRemainingRef.current > 0
    ) {
      return false;
    }
    // Boss guard always owns the stage. A support job that is still only
    // telegraphing can retry after the knight has left.
    cancelEnemySupportTelegraph(true);
    if (consumeMainAbility) {
      enemyBossAbilityUsedRef.current = true;
    }
    const balance =
      tier === 'invincible'
        ? BOSS_COVER_BALANCE.invincible
        : tier === 'enhanced_cover'
          ? BOSS_COVER_BALANCE.enhancedCover
          : BOSS_COVER_BALANCE.cover;
    if (enemyCoverExitTimerRef.current) {
      window.clearTimeout(enemyCoverExitTimerRef.current);
      enemyCoverExitTimerRef.current = null;
    }
    enemyCoverRemainingRef.current = balance.durationMs;
    enemyCoverCapacityRef.current = balance.gaugeCapacity;
    enemyActiveCoverTierRef.current = tier;
    enemyCoverActivatedAtRef.current = performance.now();
    setEnemyCoverRemaining(balance.durationMs);
    setEnemyCoverCapacity(balance.gaugeCapacity);
    setEnemyActiveCoverTier(tier);
    setEnemyCoverKnightPhase('active');
    const guardCapital = Math.min(
      enemyReserveRef.current,
      Math.round(targetProperty.marketPrice * balance.counterCapitalRatio)
    );
    if (guardCapital > 0) {
      enemyReserveRef.current -= guardCapital;
      setEnemyReserve(enemyReserveRef.current);
      const committedCapital = commitEnemyCapital(guardCapital);
      startCapitalPilePreview(
        'enemy',
        committedCapital.previous,
        committedCapital.next,
        tier === 'invincible' || tier === 'enhanced_cover',
        true,
        'continue'
      );
    }
    const abilityName =
      tier === 'invincible'
        ? 'インビンシブル'
        : tier === 'enhanced_cover'
          ? 'パッセージ・オブ・アームズ'
          : 'かばう';
    announceCondition({
      kind: 'enemy',
      tone: 'enemy',
      text: `ナイトが防御の構え\n${abilityName}発動`,
      priority: 4,
      sound: 'warning',
    });
    setStatusText(
      `${abilityName}――競合側のナイトが${Math.round(
        balance.durationMs / 1000
      )}秒間、防衛線へ入り、${formatCurrency(guardCapital)}を防衛へ積む`
    );
    showFloater(
      `${abilityName} ${Math.round(balance.durationMs / 1000)}秒`,
      'enemy',
      'negative'
    );
    addLog(
      `都市ボスが${abilityName}を発動。ナイトが防衛線へ参加し、${formatCurrency(guardCapital)}を恒久防衛資本へ積んだ。`,
      'enemy'
    );
    soundFx.playSkillCast('COVER');
    return true;
  };

  useEffect(() => {
    if (
      openingBossAbilityTier === 'none' ||
      enemyOpeningCoverUsedRef.current ||
      battlePhase !== 'active' ||
      openingSlowActive ||
      battleAnnouncement ||
      conditionAnnouncement ||
      skillCinematic ||
      capitalCommit ||
      impactStop ||
      terminalRef.current ||
      endedRef.current
    ) {
      return;
    }
    enemyOpeningCoverUsedRef.current = true;
    activateEnemyBossAbility({
      tier: openingBossAbilityTier,
      consumeMainAbility: false,
    });
  }, [
    battleAnnouncement,
    battlePhase,
    capitalCommit,
    conditionAnnouncement,
    impactStop,
    openingBossAbilityTier,
    openingSlowActive,
    skillCinematic,
  ]);

  const finalizeBattle = (
    result: 'player' | 'opponent',
    method: FinishMethod = 'NORMAL',
    rawOwnership = ownership,
    resolvedDefeatReason: DefeatReason = 'CAPITAL_COLLAPSE'
  ) => {
    if (endedRef.current) return;
    endedRef.current = true;
    criticalAutoArmedRef.current = false;
    criticalAutoResolutionPhaseRef.current = advanceCriticalAutoResolution(
      criticalAutoResolutionPhaseRef.current,
      'cancel'
    );
    criticalAutoPendingRef.current = null;
    setCriticalAutoPending(null);
    terminalCapitalHandoffRef.current = null;
    decisiveRef.current = false;
    const keepTerminalResolution =
      terminalRef.current?.cause !== 'withdrawal';
    if (!keepTerminalResolution) {
      setTerminalCinematicStage(null);
      setDecisiveBlow(null);
    }
    setBattleAnnouncement(null);
    setConditionAnnouncement(null);
    setConditionAnnouncementQueue([]);
    clearCapitalCommitTimers();
    clearCapitalPilePreview();
    capitalCommitActiveRef.current = false;
    setCapitalCommit(null);
    if (!keepTerminalResolution) {
      setTerminalCapitalSnapshot(null);
    }
    cancelSkillCinematic();
    stunInterruptedActionRef.current = undefined;
    setSkillCinematic(null);
    clearEnemySupportTimers();
    setEnemySupportCinematic(null);
    setLimitImpactActive(false);
    setFloaters([]);
    const resolvedOwnership = Math.max(0, rawOwnership);
    const resolvedOverkill = result === 'player' ? Math.max(0, resolvedOwnership - 100) : 0;
    setWinner(result);
    setDefeatReason(resolvedDefeatReason);
    setFinishMethod(method);
    setFinalOwnership(resolvedOwnership);
    setOverkill(resolvedOverkill);
    updateGauge(result === 'player' ? -100 : 100);
    setGaugeSpeed(0);
    changeBattlePhase('finisher_notice');
    setFinishTelegraphVisible(true);
    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches ?? false;
    const compactCinematic = reducedMotion;
    const finishNoticeDuration =
      terminalRef.current?.cause !== 'withdrawal'
        ? compactCinematic
          ? TERMINAL_CINEMATIC_TIMING.reducedMotionResolutionMs
          : TERMINAL_CINEMATIC_TIMING.resolutionMs
        : BATTLE_CINEMATIC_TIMING.finishNoticeMs;
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    finishTimerRef.current = window.setTimeout(() => {
      finishTimerRef.current = null;
      setFinishTelegraphVisible(false);
      setTerminalCinematicStage(null);
      setDecisiveBlow(null);
      setTerminalCapitalSnapshot(null);
    }, finishNoticeDuration);
    setStatusText(
      isTraining
        ? result === 'player'
          ? '木人耐久率0%――木人訓練成功！'
          : '商戦木人訓練を終了しました'
        : result === 'player'
          ? '所有率100%――買収成立！'
          : resolvedDefeatReason === 'WALKING_DEAD_FAILED'
            ? '蘇生猶予終了――所有率30%へ届かず買収失敗'
            : resolvedDefeatReason === 'CRUEL_RECKONING_FAILED'
              ? '終極資本査定 未達――酷商戦攻略失敗'
              : '所有率0%――買収失敗'
    );
    addLog(
      isTraining
        ? result === 'player'
          ? `${companyName}が${targetProperty.name}の耐久資本を削り切りました。`
          : `${companyName}は${targetProperty.name}の訓練を終了しました。`
        : result === 'player'
          ? `${companyName}が${targetProperty.name}を${FINISH_LABELS[method]}で押し切りました。`
          : resolvedDefeatReason === 'WALKING_DEAD_FAILED'
            ? `リビングデッドの蘇生猶予中に所有率30%へ戻せず、${companyName}は敗北しました。`
            : resolvedDefeatReason === 'CRUEL_RECKONING_FAILED'
              ? `終極資本査定の終了時に所有率75%へ届かず、${companyName}は攻略失敗となりました。`
              : `${companyName}は競合に所有率を押し切られました。`,
      'result'
    );
    if (result === 'player') {
      const particleCount = getVictoryConfettiParticleCount(
        window.innerWidth,
        reducedMotion
      );
      if (particleCount > 0) {
        const compactEffects = window.innerWidth <= 1024;
        void loadVictoryConfetti()
          .then((confetti) => {
            confetti.reset();
            confetti({
              particleCount,
              spread: compactEffects ? 72 : 96,
              startVelocity: compactEffects ? 26 : 34,
              ticks: compactEffects ? 80 : 120,
              scalar: compactEffects ? 0.78 : 0.92,
              origin: { y: 0.48 },
              disableForReducedMotion: true,
            });
          })
          .catch(() => {
            // Celebration audio and result flow remain intact if the optional
            // visual chunk cannot be loaded.
          });
      }
    }
  };

  const finishBattle = (
    result: 'player' | 'opponent',
    method: FinishMethod = 'NORMAL',
    rawOwnership = ownership,
    cinematic = true,
    resolvedDefeatReason: DefeatReason = 'CAPITAL_COLLAPSE',
    cause: TerminalCause = result === 'player' ? lastPressureCauseRef.current : 'enemy'
  ) => {
    if (
      endedRef.current ||
      terminalRef.current ||
      ultimateCriticalGatePendingRef.current
    ) {
      return false;
    }
    terminalRef.current = {
      winner: result,
      method,
      rawOwnership,
      defeatReason: resolvedDefeatReason,
      cause,
    };
    cruelSecondFailurePendingRef.current = false;
    soundFx.stopBattleCinematicAudio(80);
    if (cause === 'withdrawal') {
      clearCapitalCommitTimers();
      clearCapitalPilePreview();
      capitalCommitActiveRef.current = false;
      setCapitalCommit(null);
    }
    cancelSkillCinematic();
    stunInterruptedActionRef.current = undefined;
    setSkillCinematic(null);
    clearEnemySupportTimers();
    setEnemySupportCinematic(null);
    setEnemyMarketWindRemaining(0);
    setEnemyRapidAssaultRemaining(0);
    clearImpactStop();
    decisiveRef.current = true;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    resolvingAiActionRef.current = false;
    setPanel('capital');
    setShowHelp(false);
    setShowLog(false);
    if (announcementTimerRef.current) {
      window.clearTimeout(announcementTimerRef.current);
      announcementTimerRef.current = null;
    }
    if (conditionTimerRef.current) {
      window.clearTimeout(conditionTimerRef.current);
      conditionTimerRef.current = null;
    }
    if (limitImpactTimerRef.current) {
      window.clearTimeout(limitImpactTimerRef.current);
      limitImpactTimerRef.current = null;
    }
    if (limitTerminalHandoffTimerRef.current) {
      window.clearTimeout(limitTerminalHandoffTimerRef.current);
      limitTerminalHandoffTimerRef.current = null;
    }
    setBattleAnnouncement(null);
    setConditionAnnouncement(null);
    setConditionAnnouncementQueue([]);
    setLimitImpactActive(false);
    setFloaters([]);
    playerCoverRemainingRef.current = 0;
    enemyCoverRemainingRef.current = 0;
    playerCoverCapacityRef.current = 0;
    enemyCoverCapacityRef.current = 0;
    playerBarrierRemainingRef.current = 0;
    enemyBarrierRemainingRef.current = 0;
    playerBarrierCapacityRef.current = 0;
    enemyBarrierCapacityRef.current = 0;
    enemyActiveCoverTierRef.current = 'none';
    setPlayerCoverRemaining(0);
    setEnemyCoverRemaining(0);
    setPlayerCoverCapacity(0);
    setEnemyCoverCapacity(0);
    setPlayerBarrierRemaining(0);
    setEnemyBarrierRemaining(0);
    setPlayerBarrierCapacity(0);
    setEnemyBarrierCapacity(0);
    setEnemyActiveCoverTier('none');
    if (playerCoverKnightPhase !== 'absent') {
      releaseCoverKnight('player', false);
    }
    if (enemyCoverKnightPhase !== 'absent') {
      releaseCoverKnight('enemy', false);
    }
    setAiProgress(0);
    setGaugeSpeed(0);
    const capitalPresentationPending =
      capitalCommitActiveRef.current ||
      capitalPilePreviewActiveRef.current.player ||
      capitalPilePreviewActiveRef.current.enemy ||
      capitalCommitTimersRef.current.length > 0 ||
      capitalPilePreviewTimersRef.current.player.length > 0 ||
      capitalPilePreviewTimersRef.current.enemy.length > 0;
    if (cause !== 'withdrawal' && capitalPresentationPending) {
      terminalCapitalHandoffRef.current = () => {
        const latched = terminalRef.current;
        if (!latched || endedRef.current) return;
        terminalRef.current = null;
        // The committed pile has already completed its full reveal. Do not let
        // the finisher handoff roll the displayed amount back to its pre-offer
        // snapshot and replay the same capital drop a second time.
        setTerminalCapitalSnapshot(null);
        finishBattle(
          latched.winner,
          latched.method,
          latched.rawOwnership,
          cinematic,
          latched.defeatReason,
          latched.cause
        );
      };
      return true;
    }
    terminalCapitalHandoffRef.current = null;
    if (!cinematic) {
      if (result === 'player') {
        soundFx.playVictory();
      } else {
        soundFx.playDefeat();
      }
      finalizeBattle(result, method, rawOwnership, resolvedDefeatReason);
      return true;
    }

    changeBattlePhase('decisive');
    setTerminalCinematicStage('anticipation');
    updateGauge(result === 'player' ? -99 : 99);
    setDecisiveBlow({ winner: result, impacted: false });
    const directFinisher =
      result === 'player' || isDirectTerminalCause(cause);
    setStatusText(
      isTraining
        ? result === 'player'
          ? directFinisher
            ? '最終提示――最後の資金が木人耐久へ届く！'
            : '耐久崩壊――積み上がった圧力で木人が倒れる！'
          : '訓練終了――木人の耐久資本に押し戻される'
        : result === 'player'
          ? directFinisher
            ? `FINAL OFFER――${TERMINAL_CAUSE_LABELS[cause]}が防衛線を押し切る！`
            : `資本崩壊――${TERMINAL_CAUSE_LABELS[cause]}に耐えきれず競合が自壊する！`
          : resolvedDefeatReason === 'WALKING_DEAD_FAILED'
            ? '蘇生猶予終了――自社の防衛線が崩壊する'
            : resolvedDefeatReason === 'CRUEL_RECKONING_FAILED'
              ? '終極資本査定 未達――闇タタルの帳簿が決着を告げる'
              : `FINAL OFFER――${TERMINAL_CAUSE_LABELS[cause]}が押し切る！`
    );
    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches ?? false;
    const compactCinematic = reducedMotion;
    const anticipationMs = compactCinematic
      ? TERMINAL_CINEMATIC_TIMING.reducedMotionAnticipationMs
      : TERMINAL_CINEMATIC_TIMING.anticipationMs;
    const hitStopMs = compactCinematic
      ? TERMINAL_CINEMATIC_TIMING.reducedMotionHitStopMs
      : TERMINAL_CINEMATIC_TIMING.hitStopMs;
    const impactMs = compactCinematic
      ? TERMINAL_CINEMATIC_TIMING.reducedMotionImpactMs
      : TERMINAL_CINEMATIC_TIMING.impactMs;
    const fanfareLeadMs = compactCinematic
      ? TERMINAL_CINEMATIC_TIMING.reducedMotionFanfareLeadMs
      : TERMINAL_CINEMATIC_TIMING.fanfareLeadMs;

    decisiveImpactTimerRef.current = window.setTimeout(() => {
      decisiveImpactTimerRef.current = null;
      setTerminalCinematicStage('hitstop');
      updateGauge(result === 'player' ? -100 : 100);
      setDecisiveBlow({ winner: result, impacted: true });
      // The tiered LB impact already supplies the contact beat. Reusing it
      // avoids a second synthesized hit during compact terminal timelines.
      if (cause !== 'limit_break' || !compactCinematic) {
        soundFx.playCapitalImpact(result, 1);
      }
    }, anticipationMs);
    decisiveReleaseTimerRef.current = window.setTimeout(() => {
      decisiveReleaseTimerRef.current = null;
      if (endedRef.current || !terminalRef.current) return;
      setTerminalCinematicStage('impact');
    }, anticipationMs + hitStopMs);
    decisiveResolveTimerRef.current = window.setTimeout(() => {
      decisiveResolveTimerRef.current = null;
      setTerminalCinematicStage('resolution');
      if (result === 'player') {
        soundFx.playVictory();
      } else {
        soundFx.playDefeat();
      }
      decisiveResolveTimerRef.current = window.setTimeout(() => {
        decisiveResolveTimerRef.current = null;
        finalizeBattle(
          result,
          method,
          rawOwnership,
          resolvedDefeatReason
        );
      }, fanfareLeadMs);
    }, anticipationMs + hitStopMs + impactMs);
    return true;
  };

  const triggerWalkingDead = () => {
    const outcome = resolveLivingDeadOutcome(
      livingDeadPhaseRef.current,
      0,
      livingDeadRemainingRef.current
    );
    if (outcome !== 'triggered') return false;
    updateLivingDeadState(
      'recovery',
      TACTICAL_SKILL_BALANCE.livingDead.recoveryDurationMs
    );
    setGaugeSpeed(0);
    setStatusText('WALKING DEAD――10秒以内に所有率30%まで押し戻してください');
    showFloater('WALKING DEAD / 1%', 'center', 'notice');
    playMotion('player');
    soundFx.playWarning();
    soundFx.playSkillSpark();
    addLog('リビングデッド発動。所有率1%で踏みとどまり、10秒の蘇生猶予へ移行。', 'skill');
    return true;
  };

  const applyCoverToGaugeCandidate = (
    nextGauge: number,
    cause: TerminalCause,
    logicalCurrentGauge = gaugeRef.current
  ) => {
    const currentGauge = logicalCurrentGauge;
    let absorbedGauge = 0;
    let barrierAbsorbedGauge = 0;
    if (
      cause === 'enemy' &&
      playerCoverRemainingRef.current > 0 &&
      nextGauge > currentGauge
    ) {
      const covered = applyCoverToGaugeDelta({
        currentGauge,
        nextGauge,
        protects: 'player',
        absorbRatio: TACTICAL_SKILL_BALANCE.cover.absorbRatio,
        remainingGaugeCapacity: playerCoverCapacityRef.current,
      });
      nextGauge = covered.nextGauge;
      absorbedGauge += covered.absorbedGauge;
      playerCoverCapacityRef.current = covered.remainingGaugeCapacity;
      setPlayerCoverCapacity(covered.remainingGaugeCapacity);
      if (covered.absorbedGauge >= 1) {
        showFloater(
          `パッセ 約${formatCurrency(
            calculateLimitBreakPushGilEquivalent(
              targetProperty.marketPrice,
              covered.absorbedGauge / 2
            )
          )}防御`,
          'player',
          'notice'
        );
      }
      if (covered.remainingGaugeCapacity <= 0) {
        releaseCoverKnight('player');
      }
    }
    if (
      cause === 'enemy' &&
      playerBarrierRemainingRef.current > 0 &&
      nextGauge > currentGauge
    ) {
      const barrier = applyDivineBenisonToGaugeDelta({
        currentGauge,
        nextGauge,
        protects: 'player',
        remainingGaugeCapacity: playerBarrierCapacityRef.current,
      });
      nextGauge = barrier.nextGauge;
      barrierAbsorbedGauge = barrier.absorbedGauge;
      absorbedGauge += barrier.absorbedGauge;
      playerBarrierCapacityRef.current = barrier.remainingGaugeCapacity;
      setPlayerBarrierCapacity(barrier.remainingGaugeCapacity);
      if (barrier.absorbedGauge >= 1) {
        showFloater(
          `ベニゾン 約${formatCurrency(
            calculateLimitBreakPushGilEquivalent(
              targetProperty.marketPrice,
              barrier.absorbedGauge / 2
            )
          )}吸収`,
          'player',
          'notice'
        );
      }
      if (barrier.remainingGaugeCapacity <= 0) {
        releaseDivineBenison('player', true);
      }
    } else if (cause !== 'enemy' && nextGauge < currentGauge) {
      const predictedPlayerOwnership = calculateOwnershipFromGauge(nextGauge);
      if (
        enemyCoverRemainingRef.current <= 0 &&
        enemyBarrierRemainingRef.current <= 0 &&
        predictedPlayerOwnership >=
          BOSS_COVER_BALANCE.triggerPlayerOwnership
      ) {
        activateEnemyBossAbility();
      }
      if (enemyCoverRemainingRef.current > 0) {
        const balance =
          enemyActiveCoverTierRef.current === 'invincible'
            ? BOSS_COVER_BALANCE.invincible
            : enemyActiveCoverTierRef.current === 'enhanced_cover'
              ? BOSS_COVER_BALANCE.enhancedCover
              : BOSS_COVER_BALANCE.cover;
        const covered = applyCoverToGaugeDelta({
          currentGauge,
          nextGauge,
          protects: 'opponent',
          absorbRatio: balance.absorbRatio,
          remainingGaugeCapacity: enemyCoverCapacityRef.current,
        });
        nextGauge = covered.nextGauge;
        absorbedGauge += covered.absorbedGauge;
        enemyCoverCapacityRef.current = covered.remainingGaugeCapacity;
        setEnemyCoverCapacity(covered.remainingGaugeCapacity);
        if (covered.absorbedGauge >= 1) {
          showFloater(
            `${
              enemyActiveCoverTierRef.current === 'invincible'
                ? '無効'
                : enemyActiveCoverTierRef.current === 'enhanced_cover'
                  ? 'パッセ'
                  : 'かばう'
            } 約${formatCurrency(
              calculateLimitBreakPushGilEquivalent(
                targetProperty.marketPrice,
                covered.absorbedGauge / 2
              )
            )}防御`,
            'enemy',
            'negative'
          );
        }
        if (covered.remainingGaugeCapacity <= 0) {
          releaseCoverKnight('enemy');
        }
      }
      if (enemyBarrierRemainingRef.current > 0 && nextGauge < currentGauge) {
        const barrier = applyDivineBenisonToGaugeDelta({
          currentGauge,
          nextGauge,
          protects: 'opponent',
          remainingGaugeCapacity: enemyBarrierCapacityRef.current,
        });
        nextGauge = barrier.nextGauge;
        barrierAbsorbedGauge = barrier.absorbedGauge;
        absorbedGauge += barrier.absorbedGauge;
        enemyBarrierCapacityRef.current = barrier.remainingGaugeCapacity;
        setEnemyBarrierCapacity(barrier.remainingGaugeCapacity);
        if (barrier.absorbedGauge >= 1) {
          showFloater(
            `ベニゾン 約${formatCurrency(
              calculateLimitBreakPushGilEquivalent(
                targetProperty.marketPrice,
                barrier.absorbedGauge / 2
              )
            )}吸収`,
            'enemy',
            'negative'
          );
        }
        if (barrier.remainingGaugeCapacity <= 0) {
          releaseDivineBenison('enemy', true);
        }
      }
    }
    return { nextGauge, absorbedGauge, barrierAbsorbedGauge };
  };

  const applyGaugeCandidate = (
    nextGauge: number,
    cause: TerminalCause,
    method: FinishMethod = 'NORMAL',
    commitVisual = true,
    coverAlreadyResolved = false
  ) => {
    if (
      endedRef.current ||
      terminalRef.current ||
      ultimateCriticalGatePendingRef.current
    ) {
      return false;
    }
    // A critical AUTO owns the battle clock from the held 25% boundary until
    // its card and any deferred capital pile have both completed.
    if (criticalAutoPendingRef.current) return false;
    if (cause !== 'enemy') {
      lastPressureCauseRef.current = cause;
    }
    // Resolve Cover once before testing the critical line. Previewing Cover
    // here used to leave its capacity untouched when AUTO intercepted.
    if (!coverAlreadyResolved) {
      nextGauge = applyCoverToGaugeCandidate(nextGauge, cause).nextGauge;
      coverAlreadyResolved = true;
    }
    const criticalInterception = resolveCriticalAutoInterception({
      currentGauge: gaugeRef.current,
      candidateGauge: nextGauge,
      canIntercept:
        criticalAutoArmedRef.current &&
        !criticalAutoTriggeredRef.current &&
        cause === 'enemy',
    });
    if (criticalInterception.shouldIntercept) {
      const pendingCandidate: PendingCriticalGaugeCandidate = {
        nextGauge: criticalInterception.heldGauge,
        cause,
        method,
        commitVisual,
        coverAlreadyResolved,
      };
      criticalAutoArmedRef.current = false;
      criticalAutoTriggeredRef.current = true;
      criticalAutoResolutionPhaseRef.current = advanceCriticalAutoResolution(
        criticalAutoResolutionPhaseRef.current,
        'hold'
      );
      criticalAutoPendingRef.current = pendingCandidate;
      simulationPausedRef.current = true;
      enemySupportCastBlockedRef.current = true;
      setCriticalAutoPending(pendingCandidate);
      setGaugeSpeed(0);
      updateGauge(criticalInterception.heldGauge);
      setStatusText(
        `瀕死アビリティ――${criticalAutoSkill.name}を割り込み予約`
      );
      return false;
    }
    const trainingGauge = holdTrainingGaugeAboveDefeat(nextGauge, isTraining);
    if (trainingGauge !== nextGauge) {
      setGaugeSpeed(0);
      updateGauge(trainingGauge, true);
      return false;
    }
    const terminalWinner = getBattleTerminalWinner(nextGauge);
    if (
      terminalWinner === 'player' &&
      shouldHoldCruelVictory(isCruel, cruelScriptPhaseRef.current)
    ) {
      updateGauge(-98, commitVisual);
      setGaugeSpeed(0);
      setStatusText('闇タタルの査定が終わるまで、決着は保留されている');
      return false;
    }
    const ultimateCriticalSkillId = enemySupportAutoProfile.critical;
    if (
      shouldForceUltimateCriticalBeforeVictory({
        isUltimate,
        terminalWinner,
        criticalSkillId: ultimateCriticalSkillId,
        criticalSkillUsed:
          !!ultimateCriticalSkillId &&
          enemySupportUsedRef.current.has(ultimateCriticalSkillId),
        gateConsumed: ultimateCriticalGateConsumedRef.current,
        enemyReserve: enemyReserveRef.current,
        enemyBudget,
      })
    ) {
      const criticalActionName =
        ultimateCriticalSkillId
          ? ENEMY_SUPPORT_PRESENTATION[ultimateCriticalSkillId].actionName
          : '瀕死アビリティ';
      ultimateCriticalGateConsumedRef.current = true;
      ultimateCriticalGatePendingRef.current = true;
      setUltimateCriticalGatePending(true);
      setGaugeSpeed(0);
      updateGauge(-98, true);
      setStatusText(
        `絶・瀕死アビリティ――${criticalActionName}を先に解決`
      );
      addLog(
        `絶商戦の瀕死ギミックが割り込み。${criticalActionName}の解決まで決着を保留。`,
        'enemy'
      );
      return false;
    }
    if (terminalWinner === 'player') {
      return finishBattle(
        'player',
        method,
        (100 - nextGauge) / 2,
        true,
        'CAPITAL_COLLAPSE',
        cause
      );
    }
    if (terminalWinner === 'opponent') {
      if (triggerWalkingDead()) {
        updateGauge(livingDeadGaugeFloor);
        return false;
      }
      if (livingDeadPhaseRef.current === 'recovery') {
        updateGauge(nextGauge, true);
        return false;
      }
      return finishBattle(
        'opponent',
        'NORMAL',
        0,
        true,
        'CAPITAL_COLLAPSE',
        cause
      );
    }
    updateGauge(nextGauge, commitVisual);
    return false;
  };

  const resumeCruelOmnicapitalizationCandidate = (
    enemyGaugeDelta = 0
  ) => {
    const pending = cruelOmnicapitalizationPendingRef.current;
    cruelOmnicapitalizationPendingRef.current = null;
    setCruelOmnicapitalizationPending(null);
    if (!pending || endedRef.current || terminalRef.current) return false;

    if (enemyGaugeDelta > 0) {
      const defended = applyCoverToGaugeCandidate(
        pending.nextGauge + enemyGaugeDelta,
        'enemy',
        // The visible gauge is held at the 75% warning line during the cast.
        // Cover must absorb the full counterattack from the held candidate,
        // including when the triggering hit leapt beyond the victory line.
        pending.nextGauge
      );
      return applyGaugeCandidate(
        defended.nextGauge,
        'enemy',
        pending.method,
        pending.commitVisual,
        true
      );
    }

    return applyGaugeCandidate(
      pending.nextGauge,
      pending.cause,
      pending.method,
      pending.commitVisual,
      true
    );
  };

  const showLiquidityWarning = () => {
    if (
      isTraining ||
      liquidityWarningShownRef.current ||
      battlePhaseRef.current !== 'active' ||
      terminalRef.current
    ) return;
    liquidityWarningShownRef.current = true;
    setAiText('LIQUIDITY LOW / 資金繰り逼迫');
    setStatusText('競合は資金繰りに苦しんでいる');
    announceCondition({
      kind: 'enemy',
      tone: 'ally',
      text: '競合は資金繰りに\n苦しんでいる',
      priority: 1,
      sound: 'warning',
    });
    addLog('LIQUIDITY LOW――競合の手元資金が一時的に底をついた。', 'enemy');
  };

  const commitEnemyFunds = (
    requested: number,
    reason: string,
    applyGaugeShock = true,
    scheduleLiquidityWarning = true,
    chargeLimit = true,
    playImpact = true,
    commandRecharge: CapitalPileCommandRecharge = 'continue'
  ) => {
    if (isTraining) {
      return { actual: 0, counterShock: 0 };
    }
    const actual = Math.max(0, Math.min(Math.round(requested), enemyReserveRef.current));
    if (actual <= 0) {
      setAiText('LIQUIDITY LOW / 回復待ち');
      if (!isTraining && scheduleLiquidityWarning) showLiquidityWarning();
      return { actual: 0, counterShock: 0 };
    }
    const nextReserve = enemyReserveRef.current - actual;
    enemyReserveRef.current = nextReserve;
    setEnemyReserve(nextReserve);
    const committedCapital = commitEnemyCapital(actual);
    startCapitalPilePreview(
      'enemy',
      committedCapital.previous,
      committedCapital.next,
      actual / Math.max(targetProperty.marketPrice, 1) >= 0.14,
      false,
      commandRecharge
    );
    if (chargeLimit) {
      chargeLimitBreak(actual * enemyCapitalMultiplier);
    }
    const counterShock = Math.min(
      10,
      (
        1.5 +
        (actual / Math.max(targetProperty.marketPrice, 1)) * 18
      ) *
        enemyCapitalMultiplier
    );
    let terminalFromShock = false;
    if (applyGaugeShock) {
      terminalFromShock = applyGaugeCandidate(
        gaugeRef.current + counterShock,
        'enemy',
        'CAPITAL_PRESSURE'
      );
    }
    if (terminalFromShock) {
      return { actual, counterShock };
    }
    setStatusText(`敵大規模防衛出資――${formatCurrency(actual)}を対抗投入`);
    setAiText(nextReserve > 0 ? '次の敵大規模防衛出資を詠唱中' : 'LIQUIDITY LOW / 回復待ち');
    showFloater(`防衛 +${formatCurrency(actual)}`, 'enemy', 'negative');
    playMotion('enemy');
    if (playImpact) {
      soundFx.playCapitalImpact(
        'opponent',
        actual / Math.max(targetProperty.marketPrice, 1)
      );
      triggerImpactStop(
        'opponent',
        actual / Math.max(targetProperty.marketPrice, 1) >= 0.14
      );
    }
    addLog(`${reason}として${formatCurrency(actual)}を投入。残予算${formatCurrency(nextReserve)}。`, 'enemy');
    if (!isTraining && nextReserve <= 0 && scheduleLiquidityWarning) {
      showLiquidityWarning();
    }
    return { actual, counterShock };
  };

  const markEnemySupportUsed = (skillId: EnemySupportSkillId) => {
    enemySupportUsedRef.current.add(skillId);
    setEnemySupportUsed(new Set(enemySupportUsedRef.current));
  };

  const resolveEnemySupportImpact = (
    skillId: EnemySupportSkillId
  ) => {
    if (endedRef.current || terminalRef.current) return;

    if (skillId === 'omnicapitalization') {
      const currentOwnership = calculateOwnershipFromGauge(gaugeRef.current);
      const nextOwnership = resolveCruelFirstImpact(currentOwnership);
      updateGauge(100 - nextOwnership * 2, true);
      setGaugeSpeed(0);
      cruelRecoveryElapsedMsRef.current = 0;
      updateCruelScriptPhase('recovery');
      setStatusText(
        `星海資本の宣告――所有率${nextOwnership.toFixed(0)}%。積んだ資本・資金・LBは失われない`
      );
      setAiText('RECOVERY PHASE / 所有率50%まで盛り返せ');
      showFloater(`OWNERSHIP ${nextOwnership.toFixed(0)}%`, 'player', 'negative');
      playMotion('enemy');
      soundFx.playCapitalImpact('opponent', 1);
      triggerImpactStop('opponent', true);
      addLog(
        `闇タタルの中断不能な宣告により所有率は${nextOwnership.toFixed(0)}%へ低下。投入済み資本・手元資金・LBゲージは維持された。`,
        'enemy'
      );
      return;
    }

    if (skillId === 'cruel_reckoning') {
      const currentOwnership = calculateOwnershipFromGauge(gaugeRef.current);
      const resolution = resolveCruelSecondImpact(currentOwnership);
      if (resolution.outcome === 'break') {
        const brokenCapital = Math.round(
          enemyCommittedCapitalRef.current *
            CRUEL_SCRIPTED_BATTLE.bossBreakCapitalRatio
        );
        if (brokenCapital > 0) commitEnemyCapital(-brokenCapital);
        enemyReserveRef.current = 0;
        setEnemyReserve(0);
        updateCruelScriptPhase('resolved');
        setStatusText('終極資本査定を突破――闇タタルの資本網が崩れた！');
        setAiText('BREAK / 最終押し込みへ');
        showFloater('PHASE BREAK', 'enemy', 'positive');
        addLog(
          `第二査定を所有率${currentOwnership.toFixed(1)}%で突破。競合資本${formatCurrency(brokenCapital)}を崩し、最終局面へ移行。`,
          'skill'
        );
      } else {
        updateGauge(
          100 - CRUEL_SCRIPTED_BATTLE.secondFailureDisplayedOwnership * 2,
          true
        );
        updateCruelScriptPhase('second_failed');
        cruelSecondFailurePendingRef.current = true;
        setStatusText('終極資本査定 未達――余韻の後、攻略失敗が確定');
        setAiText('RECKONING FAILED / 所有率75%未達');
        showFloater('ASSESSMENT FAILED', 'player', 'negative');
        addLog(
          `第二査定終了時の所有率${currentOwnership.toFixed(1)}%。必要な75%へ届かず、終極資本査定の失敗が確定。`,
          'enemy'
        );
      }
      playMotion('enemy');
      soundFx.playCapitalImpact('opponent', 1);
      triggerImpactStop('opponent', true);
      return;
    }

    if (skillId === 'divine_benison') {
      if (!activateDivineBenison('enemy')) return;
      setStatusText(
        `ディヴァインベニゾン――競合に所有率${DIVINE_BENISON_BALANCE.gaugeCapacity / 2}%分の有限障壁`
      );
      showFloater(
        `BENISON / ${DIVINE_BENISON_BALANCE.gaugeCapacity / 2}%吸収`,
        'enemy',
        'negative'
      );
      soundFx.playSkillImpact('BARRIER', 'opponent');
      addLog(
        `白魔道士がディヴァインベニゾンを実行。${Math.round(
          DIVINE_BENISON_BALANCE.durationMs / 1000
        )}秒間、直接出資・人脈・LB・SYNERGY・継続圧力を同じ有限障壁で吸収する。`,
        'enemy'
      );
      return;
    }

    if (skillId === 'drain') {
      const transfer = resolveEnemyDrainTransfer({
        playerCash: cashRef.current,
        enemyReserve: enemyReserveRef.current,
        marketPrice: targetProperty.marketPrice,
      });
      updateCash(transfer.playerCash);
      enemyReserveRef.current = transfer.enemyReserve;
      setEnemyReserve(transfer.enemyReserve);
      enemyDrainStolenRef.current += transfer.transferred;
      setEnemyDrainStolen(enemyDrainStolenRef.current);
      if (transfer.transferred > 0) {
        liquidityWarningShownRef.current = false;
        setStatusText(
          `ドレイン――手元資金${formatCurrency(transfer.transferred)}を競合予備資金へ吸収された`
        );
        showFloater(
          `手元資金 -${formatCurrency(transfer.transferred)}`,
          'player',
          'negative'
        );
        showFloater(
          `予備資金 +${formatCurrency(transfer.transferred)}`,
          'enemy',
          'negative'
        );
      } else {
        setStatusText('ドレイン不発――手元資金を投入済みのため吸収なし');
        showFloater('DRAIN 0 / 回避', 'player', 'positive');
      }
      soundFx.playSkillImpact('INDEPENDENCE_SABOTAGE', 'opponent');
      addLog(
        transfer.transferred > 0
          ? `敵術師がドレインを実行。未投入の手元資金${formatCurrency(
              transfer.transferred
            )}を競合予備資金へ同額移動。投入済み資本・所有率・人脈・LBは変化しない。`
          : '敵術師がドレインを実行したが、未投入の手元資金がなく吸収は0。敵行動は消費された。',
        'enemy'
      );
      return;
    }

    if (skillId === 'drill') {
      const impact = getEnemyDrillImpact({
        enemyBudget,
        isSavage,
        isUltimate,
        isCruel,
      });
      const impactGilEquivalent = calculateLimitBreakPushGilEquivalent(
        targetProperty.marketPrice,
        impact.ownershipPush
      );
      if (enemyReserveRef.current < impact.reserveCost) return;
      const nextReserve = enemyReserveRef.current - impact.reserveCost;
      enemyReserveRef.current = nextReserve;
      setEnemyReserve(nextReserve);
      setStatusText(
        `整備・ドリル――競合が${formatCurrency(
          impact.reserveCost
        )}を投じ、約${formatCurrency(impactGilEquivalent)}相当を押し戻す`
      );
      showFloater(
        `ドリル 約${formatCurrency(impactGilEquivalent)}`,
        'player',
        'negative'
      );
      playMotion('enemy');
      soundFx.playSkillImpact('INDEPENDENCE_SABOTAGE', 'opponent');
      soundFx.playCapitalImpact('opponent', 0.72);
      triggerImpactStop('opponent', true);
      addLog(
        `機工士が整備からドリルを実行。競合予備資金${formatCurrency(
          impact.reserveCost
        )}を消費し、約${formatCurrency(impactGilEquivalent)}相当を押し戻した。`,
        'enemy'
      );
      applyGaugeCandidate(
        gaugeRef.current + impact.gaugeDelta,
        'enemy',
        'CAPITAL_PRESSURE'
      );
      return;
    }

    if (skillId === 'rapid_assault') {
      setEnemyRapidAssaultRemaining(
        ENEMY_SUPPORT_SKILL_BALANCE.rapidAssault.durationMs
      );
      setStatusText(
        `疾風怒濤の陣――${Math.round(
          ENEMY_SUPPORT_SKILL_BALANCE.rapidAssault.durationMs / 1000
        )}秒間、競合の行動準備速度が約${ENEMY_SUPPORT_SKILL_BALANCE.rapidAssault.actionProgressMultiplier.toFixed(
          1
        )}倍`
      );
      showFloater(
        `敵行動 ×${ENEMY_SUPPORT_SKILL_BALANCE.rapidAssault.actionProgressMultiplier.toFixed(
          1
        )}`,
        'enemy',
        'negative'
      );
      soundFx.playSkillImpact('FAST_ACTION', 'opponent');
      addLog(
        `吟遊詩人が疾風怒濤の陣を実行。競合の行動準備速度が${Math.round(
          ENEMY_SUPPORT_SKILL_BALANCE.rapidAssault.durationMs / 1000
        )}秒間加速。`,
        'enemy'
      );
      return;
    }

    if (skillId === 'limit_break_3') {
      const capitalSupport = Math.min(
        enemyReserveRef.current,
        Math.round(
          targetProperty.marketPrice *
            ENEMY_SUPPORT_SKILL_BALANCE.limitBreak3.capitalSupportRatio
        )
      );
      if (capitalSupport > 0) {
        enemyReserveRef.current -= capitalSupport;
        setEnemyReserve(enemyReserveRef.current);
        const committedCapital = commitEnemyCapital(capitalSupport);
        startCapitalPilePreview(
          'enemy',
          committedCapital.previous,
          committedCapital.next,
          true,
          true,
          'pause'
        );
      }
      setEnemyLimitBreakHoldRemaining(
        ENEMY_SUPPORT_SKILL_BALANCE.limitBreak3.momentumHoldMs
      );
      const ownershipPush =
        ENEMY_SUPPORT_SKILL_BALANCE.limitBreak3.ownershipPush;
      const impactGilEquivalent = calculateLimitBreakPushGilEquivalent(
        targetProperty.marketPrice,
        ownershipPush
      );
      setStatusText(
        `敵LIMIT BREAK 3――${formatCurrency(capitalSupport)}を積み、約${formatCurrency(impactGilEquivalent)}相当を押し戻す`
      );
      showFloater(`敵LB3 約${formatCurrency(impactGilEquivalent)}`, 'player', 'negative');
      playMotion('enemy');
      soundFx.playLimitBreakImpact(3, 'opponent');
      addLog(
        `競合連合がLIMIT BREAK 3を発動。${formatCurrency(capitalSupport)}を恒久資本へ積み、約${formatCurrency(impactGilEquivalent)}相当を押し戻した。`,
        'enemy'
      );
      applyGaugeCandidate(
        gaugeRef.current +
          ENEMY_SUPPORT_SKILL_BALANCE.limitBreak3.gaugeDelta,
        'enemy',
        'NORMAL'
      );
      return;
    }

    const durationMs = getEnemyDivinationDurationMs({
      isSavage,
      isUltimate,
      isCruel,
    });
    setEnemyMarketWindRemaining(durationMs);
    setStatusText(
      `ディヴィネーション――${(durationMs / 1000).toFixed(
        1
      )}秒間、競合の投入効果×${ENEMY_SUPPORT_SKILL_BALANCE.divination.enemyInvestmentMultiplier.toFixed(
        2
      )}`
    );
    showFloater(
      `相場誘導 ×${ENEMY_SUPPORT_SKILL_BALANCE.divination.enemyInvestmentMultiplier.toFixed(
        2
      )}`,
      'enemy',
      'negative'
    );
    soundFx.playSkillImpact('ERA_WIND', 'opponent');
    addLog(
      `占星術師がディヴィネーションを実行。${(
        durationMs / 1000
      ).toFixed(1)}秒間、競合の投入効果が${ENEMY_SUPPORT_SKILL_BALANCE.divination.enemyInvestmentMultiplier.toFixed(2)}倍。`,
      'enemy'
    );
  };

  const startEnemySupportSkill = (
    skillId: EnemySupportSkillId
  ) => {
    if (
      enemySupportActiveRef.current ||
      performance.now() < enemySupportRetryNotBeforeRef.current ||
      endedRef.current ||
      terminalRef.current ||
      battlePhaseRef.current !== 'active'
    ) {
      return false;
    }
    if (
      skillId === 'drill' &&
      !canEnemyAffordDrill(enemyReserveRef.current, enemyBudget)
    ) {
      return false;
    }
    if (
      skillId === 'divine_benison' &&
      (enemyCoverRemainingRef.current > 0 ||
        enemyBarrierRemainingRef.current > 0)
    ) {
      return false;
    }

    simulationPausedRef.current = true;
    enemySupportRetryNotBeforeRef.current = 0;
    clearEnemySupportTimers();
    const serial = enemySupportSerialRef.current;
    const presentation = ENEMY_SUPPORT_PRESENTATION[skillId];
    enemySupportActiveRef.current = true;
    markEnemySupportUsed(skillId);
    setAiProgress(0);
    setEnemySupportCinematic({
      skillId,
      stage: 'telegraph',
      serial,
    });
    startEnemySupportTelegraphTicker(presentation.telegraphMs);
    setStatusText(`${presentation.telegraphText}――次の行動を予告`);
    setAiText(`${presentation.telegraphText} / 次の行動を予告`);
    soundFx.playSkillCast(
      skillId === 'limit_break_3'
        ? 'CAPITAL_BOOST'
        : skillId === 'rapid_assault'
          ? 'FAST_ACTION'
          : skillId === 'divination'
            ? 'ERA_WIND'
            : skillId === 'drain' || skillId === 'drill'
              ? 'INDEPENDENCE_SABOTAGE'
              : 'COVER'
    );

    const valid = () =>
      enemySupportSerialRef.current === serial &&
      !endedRef.current &&
      !terminalRef.current;
    const updateStage = (stage: EnemySupportStage) => {
      if (!valid()) return false;
      setEnemySupportCinematic((current) =>
        current?.serial === serial
          ? { ...current, stage }
          : current
      );
      return true;
    };

    const beginCast = (grantPostPileGrace = false) => {
      if (!valid()) return;
      const capitalPileBlocked =
        capitalCommitActiveRef.current ||
        capitalPilePreviewActiveRef.current.player ||
        capitalPilePreviewActiveRef.current.enemy;
      if (
        enemySupportCastBlockedRef.current ||
        capitalPileBlocked
      ) {
        enemySupportPendingCastRef.current = () =>
          beginCast(grantPostPileGrace || capitalPileBlocked);
        enemySupportTimersRef.current = [];
        return;
      }
      enemySupportPendingCastRef.current = null;
      if (grantPostPileGrace) {
        // The warning can expire while a large capital pile owns the stage.
        // Keep the existing ticker and reopen a short, real input window once
        // stacking is clear instead of casting on the same frame.
        refreshEnemySupportTelegraphDeadline(
          ENEMY_SUPPORT_POST_PILE_GRACE_MS
        );
        const graceTimer = window.setTimeout(
          () => beginCast(false),
          ENEMY_SUPPORT_POST_PILE_GRACE_MS
        );
        enemySupportTimersRef.current = [graceTimer];
        return;
      }
      if (!updateStage('cast')) return;
      clearEnemySupportTelegraphTicker();
      setEnemySupportTelegraphRemainingMs(null);
      setStatusText(`${presentation.actionName}――効果を詠唱中……`);
      if (skillId === 'limit_break_3') {
        soundFx.playLimitBreak();
      } else {
        soundFx.playSkillWhoosh(
          skillId === 'rapid_assault'
            ? 'FAST_ACTION'
            : skillId === 'divination'
              ? 'ERA_WIND'
              : skillId === 'divine_benison'
                ? 'BARRIER'
                : 'INDEPENDENCE_SABOTAGE'
        );
      }

      const impactAt = presentation.castMs;
      const afterglowAt = impactAt + presentation.impactMs;
      const leavingAt = afterglowAt + presentation.afterglowMs;
      const completeAt = leavingAt + presentation.leavingMs;
      const impactTimer = window.setTimeout(() => {
        if (!updateStage('impact')) return;
        resolveEnemySupportImpact(skillId);
      }, impactAt);
      const afterglowTimer = window.setTimeout(() => {
        updateStage('afterglow');
      }, afterglowAt);
      const leavingTimer = window.setTimeout(() => {
        updateStage('leaving');
      }, leavingAt);
      const completeTimer = window.setTimeout(() => {
        if (!valid()) return;
        enemySupportTimersRef.current = [];
        enemySupportActiveRef.current = false;
        setEnemySupportCinematic(null);
        if (
          skillId === 'cruel_reckoning' &&
          cruelSecondFailurePendingRef.current
        ) {
          cruelSecondFailurePendingRef.current = false;
          finishBattle(
            'opponent',
            'NORMAL',
            0,
            true,
            'CRUEL_RECKONING_FAILED',
            'enemy'
          );
          return;
        }
        setAiText('競合が次の防衛資金を準備中');
      }, completeAt);
      enemySupportTimersRef.current = [
        impactTimer,
        afterglowTimer,
        leavingTimer,
        completeTimer,
      ];
    };

    const castTimer = window.setTimeout(
      () => beginCast(false),
      presentation.telegraphMs
    );
    enemySupportTimersRef.current = [castTimer];
    return true;
  };

  useEffect(() => {
    if (
      !isCruel ||
      battlePhase !== 'active' ||
      winner ||
      terminalRef.current ||
      openingSlowActive
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      if (
        endedRef.current ||
        terminalRef.current ||
        simulationPausedRef.current ||
        enemySupportActiveRef.current
      ) {
        return;
      }
      const elapsed = BATTLE_STATE_UPDATE_INTERVAL_MS;
      if (cruelScriptPhaseRef.current === 'awaiting_first') {
        cruelActiveElapsedMsRef.current += elapsed;
        if (
          shouldTriggerCruelFirstPhase({
            isCruel,
            phase: cruelScriptPhaseRef.current,
            activeElapsedMs: cruelActiveElapsedMsRef.current,
          }) &&
          startEnemySupportSkill(CRUEL_SCRIPTED_BATTLE.firstActionId)
        ) {
          updateCruelScriptPhase('first_countdown');
          setCommandProgress(100);
          setStatusText('「すべての商いは、星海へ還るでっす」――宣告開始');
          addLog(
            '闇タタルが中断不能の第一宣告を開始。投入済み資本を保ったまま、所有率10%から立て直す局面へ移行する。',
            'enemy'
          );
        }
        return;
      }
      if (cruelScriptPhaseRef.current !== 'recovery') return;
      cruelRecoveryElapsedMsRef.current += elapsed;
      const currentOwnership = calculateOwnershipFromGauge(gaugeRef.current);
      const recoveredEnough =
        currentOwnership >= CRUEL_SCRIPTED_BATTLE.secondTriggerPlayerOwnership;
      if (
        shouldTriggerCruelSecondPhase({
          phase: cruelScriptPhaseRef.current,
          currentPlayerOwnership: currentOwnership,
          recoveryElapsedMs: cruelRecoveryElapsedMsRef.current,
        }) &&
        startEnemySupportSkill(CRUEL_SCRIPTED_BATTLE.secondActionId)
      ) {
        updateCruelScriptPhase('second_countdown');
        setCommandProgress(100);
        setStatusText(
          recoveredEnough
            ? '「では、その商いの価値を査定するでっす」――第二宣告開始'
            : '「待つのは終わりでっす」――終極資本査定を強制開始'
        );
        addLog(
          `終極資本査定のカウント開始。現在所有率${currentOwnership.toFixed(1)}%、75%以上で完全突破。`,
          'enemy'
        );
      }
    }, BATTLE_STATE_UPDATE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [battlePhase, isCruel, openingSlowActive, winner]);

  useEffect(() => {
    if (!ultimateCriticalGatePending) return;
    const criticalSkillId = enemySupportAutoProfile.critical;
    if (!criticalSkillId) {
      ultimateCriticalGatePendingRef.current = false;
      setUltimateCriticalGatePending(false);
      return;
    }
    if (
      enemySupportActiveRef.current ||
      battlePhase !== 'active' ||
      winner ||
      terminalRef.current ||
      openingSlowActive ||
      battleAnnouncement ||
      conditionAnnouncement ||
      conditionAnnouncementQueue.length > 0 ||
      skillCinematic ||
      capitalCommit ||
      capitalPilePresentationLocked ||
      impactStop ||
      limitImpactActive ||
      showHelp ||
      showLog ||
      panel !== 'capital' ||
      enemyCoverKnightPhase !== 'absent'
    ) {
      return;
    }
    if (startEnemySupportSkill(criticalSkillId)) {
      ultimateCriticalGatePendingRef.current = false;
      setUltimateCriticalGatePending(false);
    }
  }, [
    battleAnnouncement,
    battlePhase,
    capitalCommit,
    capitalPilePresentationLocked,
    conditionAnnouncement,
    conditionAnnouncementQueue.length,
    enemyCoverKnightPhase,
    enemySupportAutoProfile,
    impactStop,
    limitImpactActive,
    openingSlowActive,
    panel,
    showHelp,
    showLog,
    skillCinematic,
    ultimateCriticalGatePending,
    winner,
  ]);

  useEffect(() => {
    const recoveryAction = getCapitalPresentationRecoveryAction({
      ended: endedRef.current,
      hasVisiblePresentation:
        capitalCommit !== null ||
        playerCapitalPilePreviewStage !== null ||
        enemyCapitalPilePreviewStage !== null,
      runnerActive:
        capitalCommitActiveRef.current ||
        capitalPilePreviewActiveRef.current.player ||
        capitalPilePreviewActiveRef.current.enemy,
      pendingTimerCount:
        capitalCommitTimersRef.current.length +
        capitalPilePreviewTimersRef.current.player.length +
        capitalPilePreviewTimersRef.current.enemy.length,
      terminalHandoffPending:
        terminalCapitalRefreshRecoveryRef.current !== null,
    });
    if (recoveryAction === 'none') return;

    clearCapitalCommitTimers();
    clearCapitalPilePreview();
    if (recoveryAction !== 'resume_terminal') return;

    const resumeTerminal = terminalCapitalRefreshRecoveryRef.current;
    terminalCapitalRefreshRecoveryRef.current = null;
    resumeTerminal?.();
  }, [
    capitalCommit,
    clearCapitalCommitTimers,
    clearCapitalPilePreview,
    enemyCapitalPilePreviewStage,
    playerCapitalPilePreviewStage,
  ]);

  useEffect(() => {
    if (
      enemySupportProfile.length === 0 ||
      (isCruel && cruelScriptPhase !== 'resolved') ||
      cruelOmnicapitalizationPending ||
      ultimateCriticalGatePending ||
      enemySupportActiveRef.current ||
      resolvingAiActionRef.current ||
      aiProgress >= 100 ||
      enemySupportCinematic ||
      battlePhase !== 'active' ||
      winner ||
      terminalRef.current ||
      openingSlowActive ||
      battleAnnouncement ||
      conditionAnnouncement ||
      conditionAnnouncementQueue.length > 0 ||
      skillCinematic ||
      capitalCommit ||
      capitalPilePresentationLocked ||
      impactStop ||
      limitImpactActive ||
      showHelp ||
      showLog ||
      panel !== 'capital' ||
      enemyCoverKnightPhase !== 'absent'
    ) {
      return;
    }

    const bossGuardNeedsPriority =
      bossAbilityTier !== 'none' &&
      bossAbilityTier !== 'boss' &&
      !enemyBossAbilityUsedRef.current &&
      ownership >= BOSS_COVER_BALANCE.triggerPlayerOwnership - 5;
    if (bossGuardNeedsPriority) return;

    const openingAutoSkill =
      enemySupportAutoProfile.opening &&
      aiCycle === 0 &&
      !enemySupportUsedRef.current.has(
        enemySupportAutoProfile.opening
      )
        ? enemySupportAutoProfile.opening
        : null;
    const criticalAutoSkill =
      enemySupportAutoProfile.critical &&
      ownership >= 70 &&
      !enemySupportUsedRef.current.has(
        enemySupportAutoProfile.critical
      ) &&
      (
        enemySupportAutoProfile.critical !== 'drill' ||
        canEnemyAffordDrill(enemyReserveRef.current, enemyBudget)
      )
        ? enemySupportAutoProfile.critical
        : null;
      const nextSkill =
        openingAutoSkill ??
        criticalAutoSkill ??
        enemySupportProfile.find((skillId) => {
        if (enemySupportUsedRef.current.has(skillId)) return false;
        if (
          skillId === enemySupportAutoProfile.critical &&
          ownership < 70
        ) {
          return false;
        }
        if (skillId === 'divine_benison') {
          return (
            enemyCoverRemainingRef.current <= 0 &&
            enemyBarrierRemainingRef.current <= 0 &&
            shouldEnemyUseDivineBenison({
            playerOwnership: ownership,
            terminal: false,
            })
          );
        }
        if (skillId === 'drain') {
          return aiCycle >= 1 || ownership >= 52;
        }
        if (skillId === 'drill') {
          return (
            commandReady &&
            canEnemyAffordDrill(enemyReserveRef.current, enemyBudget)
          );
        }
        return (
          (aiCycle >= 2 || ownership >= 58) &&
          !eraWindActive &&
          !enemyMarketWindActive &&
          currentWind.type === 'CALM' &&
          battleWindState.phase !== 'telegraph'
        );
      });
    if (
      nextSkill === 'divine_benison' &&
      (enemyCoverRemainingRef.current > 0 ||
        enemyBarrierRemainingRef.current > 0)
    ) {
      return;
    }
    if (nextSkill) {
      startEnemySupportSkill(nextSkill);
    }
  }, [
    aiCycle,
    aiProgress,
    battleAnnouncement,
    battlePhase,
    battleWindState.phase,
    bossAbilityTier,
    capitalCommit,
    capitalPilePresentationLocked,
    conditionAnnouncement,
    conditionAnnouncementQueue.length,
    commandReady,
    cruelOmnicapitalizationPending,
    cruelScriptPhase,
    currentWind.type,
    enemyBudget,
    enemyCoverKnightPhase,
    enemyBarrierRemaining,
    enemyMarketWindActive,
    enemySupportCinematic,
    enemySupportAutoProfile,
    enemySupportProfile,
    enemySupportUsed,
    eraWindActive,
    impactStop,
    isSavage,
    isCruel,
    isUltimate,
    limitImpactActive,
    openingSlowActive,
    ownership,
    panel,
    showHelp,
    showLog,
    skillCinematic,
    winner,
  ]);

  useEffect(() => {
    if (
      !capitalPilePresentationLocked ||
      commandTimeScale <= 0 ||
      timeScale > 0 ||
      winner ||
      battlePhase !== 'active' ||
      terminalRef.current
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      if (terminalRef.current) return;
      const tickScale = BATTLE_STATE_UPDATE_INTERVAL_MS / 50;
      setCommandProgress((value) =>
        Math.min(
          100,
          value + commandProgressPerTick * commandTimeScale * tickScale
        )
      );
    }, BATTLE_STATE_UPDATE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [
    battlePhase,
    capitalPilePresentationLocked,
    commandProgressPerTick,
    commandTimeScale,
    timeScale,
    winner,
  ]);

  useEffect(() => {
    if (
      timeScale <= 0 ||
      winner ||
      battlePhase !== 'active' ||
      terminalRef.current
    ) return;
    const interval = window.setInterval(() => {
      if (terminalRef.current || simulationPausedRef.current) return;
      const elapsed = BATTLE_STATE_UPDATE_INTERVAL_MS * timeScale;
      const tickScale = BATTLE_STATE_UPDATE_INTERVAL_MS / 50;
      const commandProgressPerTick = fastHorse
        ? TACTICAL_SKILL_BALANCE.fastAction.boostedCommandProgressPerTick
        : TACTICAL_SKILL_BALANCE.fastAction.baseCommandProgressPerTick;
      setCommandProgress((value) =>
        Math.min(
          100,
          value + commandProgressPerTick * timeScale * tickScale
        )
      );
      setSkillCooldowns((current) => {
        let changed = false;
        const next = { ...current };
        Object.keys(next).forEach((key) => {
          if (next[key] > 0) {
            next[key] = Math.max(0, next[key] - elapsed);
            changed = true;
          }
        });
        return changed ? next : current;
      });
      setFastHorseRemaining((value) => Math.max(0, value - elapsed));
      setEnemyRapidAssaultRemaining((value) =>
        Math.max(0, value - elapsed)
      );
      setEnemyLimitBreakHoldRemaining((value) =>
        Math.max(0, value - elapsed)
      );
      if (playerCoverRemainingRef.current > 0) {
        const nextPlayerCover = Math.max(
          0,
          playerCoverRemainingRef.current - elapsed
        );
        playerCoverRemainingRef.current = nextPlayerCover;
        setPlayerCoverRemaining(nextPlayerCover);
        if (nextPlayerCover <= 0) releaseCoverKnight('player');
      }
      if (enemyCoverRemainingRef.current > 0) {
        const nextEnemyCover = Math.max(
          0,
          enemyCoverRemainingRef.current - elapsed
        );
        enemyCoverRemainingRef.current = nextEnemyCover;
        setEnemyCoverRemaining(nextEnemyCover);
        if (nextEnemyCover <= 0) {
          if (enemyActiveCoverTierRef.current === 'invincible') {
            enemyActiveCoverTierRef.current = 'enhanced_cover';
            enemyCoverRemainingRef.current =
              BOSS_COVER_BALANCE.invincible.followupDurationMs;
            enemyCoverCapacityRef.current =
              BOSS_COVER_BALANCE.invincible.followupGaugeCapacity;
            setEnemyActiveCoverTier('enhanced_cover');
            setEnemyCoverRemaining(
              BOSS_COVER_BALANCE.invincible.followupDurationMs
            );
            setEnemyCoverCapacity(
              BOSS_COVER_BALANCE.invincible.followupGaugeCapacity
            );
            setStatusText(
              'インビンシブル終了――同じナイトが有限パッセへ移行。防御ゲージを割れ！'
            );
            addLog(
              '完全無敵が終了し、ナイトは6秒の有限パッセージ・オブ・アームズへ移行。',
              'enemy'
            );
          } else {
            releaseCoverKnight('enemy');
          }
        }
      }
      if (playerBarrierRemainingRef.current > 0) {
        const nextPlayerBarrier = Math.max(
          0,
          playerBarrierRemainingRef.current - elapsed
        );
        playerBarrierRemainingRef.current = nextPlayerBarrier;
        setPlayerBarrierRemaining(nextPlayerBarrier);
        if (nextPlayerBarrier <= 0) releaseDivineBenison('player', false);
      }
      if (enemyBarrierRemainingRef.current > 0) {
        const nextEnemyBarrier = Math.max(
          0,
          enemyBarrierRemainingRef.current - elapsed
        );
        enemyBarrierRemainingRef.current = nextEnemyBarrier;
        setEnemyBarrierRemaining(nextEnemyBarrier);
        if (nextEnemyBarrier <= 0) releaseDivineBenison('enemy', false);
      }
      setProgressionSynergyRemaining((value) =>
        Math.max(0, value - elapsed)
      );
      setEnemyMarketWindRemaining((value) =>
        Math.max(0, value - elapsed)
      );
      if (livingDeadPhaseRef.current === 'waiting' || livingDeadPhaseRef.current === 'recovery') {
        const nextRemaining = Math.max(0, livingDeadRemainingRef.current - elapsed);
        livingDeadRemainingRef.current = nextRemaining;
        setLivingDeadRemaining(nextRemaining);
      }
    }, BATTLE_STATE_UPDATE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [
    battlePhase,
    fastHorse,
    timeScale,
    winner,
  ]);

  useEffect(() => {
    if (winner || terminalRef.current) return;
    const outcome = resolveLivingDeadOutcome(
      livingDeadPhase,
      normalizedOwnership,
      livingDeadRemaining
    );
    if (outcome === 'waiting_expired') {
      updateLivingDeadState('inactive');
      setStatusText('リビングデッドの待機効果が終了');
      addLog('リビングデッドは発動条件を満たさず終了。', 'skill');
      return;
    }
    if (outcome === 'recovered') {
      updateLivingDeadState('survived');
      setStatusText('UNDEAD REBIRTH――所有率30%へ復帰。商戦を続行します');
      showFloater('UNDEAD REBIRTH / SUCCESS', 'player', 'positive');
      soundFx.playFeatureUnlocked();
      addLog('蘇生成功。所有率30%以上へ戻し、リビングデッドを完遂。', 'result');
      if (livingDeadNoticeTimerRef.current) window.clearTimeout(livingDeadNoticeTimerRef.current);
      livingDeadNoticeTimerRef.current = window.setTimeout(
        () => updateLivingDeadState('inactive'),
        1800
      );
      return;
    }
    if (outcome === 'failed') {
      updateLivingDeadState('failed');
      setStatusText('WALKING DEAD FAILED――蘇生猶予が尽きました');
      showFloater('RESURRECTION FAILED', 'player', 'negative');
      addLog('蘇生猶予終了。所有率30%へ届かず、リビングデッド失敗。', 'result');
      finishBattle(
        'opponent',
        'NORMAL',
        0,
        true,
        'WALKING_DEAD_FAILED',
        'living_dead'
      );
    }
  }, [livingDeadPhase, livingDeadRemaining, normalizedOwnership, winner]);

  useEffect(() => {
    if (
      timeScale <= 0 ||
      winner ||
      battlePhase !== 'active' ||
      terminalRef.current
    ) return;
    const interval = window.setInterval(() => {
      if (terminalRef.current || simulationPausedRef.current) return;
      const playerRecovery = advanceBattleCashRecovery({
        baselineFunds: initialBattleCashRef.current,
        availableFunds: cashRef.current,
        cumulativeRecovered: battleCashRecoveredRef.current,
        elapsedSeconds: 0.1,
        timeScale,
        windMultiplier: recoveryWindMultipliers.player,
        terminal: false,
      });
      if (playerRecovery.recoveredThisStep > 0) {
        battleCashRecoveredRef.current =
          playerRecovery.cumulativeRecovered;
        setBattleCashRecovered(playerRecovery.cumulativeRecovered);
        updateCash(playerRecovery.availableFunds);
      }

      const enemyRecovery = advanceBattleCashRecovery({
        baselineFunds: enemyBudget,
        availableFunds: enemyReserveRef.current,
        cumulativeRecovered: enemyCashRecoveredRef.current,
        elapsedSeconds: 0.1,
        timeScale,
        windMultiplier: recoveryWindMultipliers.enemy,
        terminal: false,
        cumulativeCapRatio:
          ENEMY_SUPPORT_SKILL_BALANCE.cashRecovery.passiveRecoveryCapRatio,
      });
      if (enemyRecovery.recoveredThisStep > 0) {
        enemyCashRecoveredRef.current =
          enemyRecovery.cumulativeRecovered;
        enemyReserveRef.current = enemyRecovery.availableFunds;
        setEnemyCashRecovered(enemyRecovery.cumulativeRecovered);
        setEnemyReserve(enemyRecovery.availableFunds);
        if (enemyRecovery.availableFunds > 0) {
          liquidityWarningShownRef.current = false;
        }
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [
    battlePhase,
    enemyBudget,
    recoveryWindMultipliers.enemy,
    recoveryWindMultipliers.player,
    timeScale,
    updateCash,
    winner,
  ]);

  useEffect(() => {
    if (
      isTraining ||
      timeScale <= 0 ||
      winner ||
      battlePhase !== 'active' ||
      terminalRef.current ||
      !enemyCanCommit
    ) {
      return;
    }
    const enemyActionProgressMultiplier =
      enemyRapidAssaultRemaining > 0
        ? ENEMY_SUPPORT_SKILL_BALANCE.rapidAssault
            .actionProgressMultiplier
        : 1;
    const step =
      (100 / (enemyDecision.waitMs / 100)) *
      timeScale *
      enemyActionProgressMultiplier;
    const interval = window.setInterval(() => {
      if (terminalRef.current || simulationPausedRef.current) return;
      setAiProgress((value) => Math.min(100, value + step));
    }, 100);
    return () => window.clearInterval(interval);
  }, [
    battlePhase,
    enemyDecision.waitMs,
    enemyCanCommit,
    enemyRapidAssaultRemaining,
    isTraining,
    timeScale,
    winner,
  ]);

  useEffect(() => {
    if (isTraining) {
      resolvingAiActionRef.current = false;
      return;
    }
    if (enemySupportActiveRef.current) {
      resolvingAiActionRef.current = false;
      return;
    }
    if (aiProgress < 100) {
      resolvingAiActionRef.current = false;
      return;
    }
    if (
      simulationPausedRef.current ||
      timeScale <= 0 ||
      winner ||
      battlePhase !== 'active' ||
      terminalRef.current
    ) {
      return;
    }
    if (resolvingAiActionRef.current) return;
    resolvingAiActionRef.current = true;

    if (!isTraining && enemyReserveRef.current <= 0) {
      resolvingAiActionRef.current = false;
      setAiProgress(0);
      return;
    }
    if (
      !isTraining &&
      enemyReserveRef.current < enemyMinimumCommitment
    ) {
      resolvingAiActionRef.current = false;
      setAiText(
        `商流リジェネ待ち／次回防衛 ${formatCurrency(enemyMinimumCommitment)}`
      );
      setAiProgress(0);
      return;
    }
    if (enemyDecision.investmentRatio > 0) {
      commitEnemyFunds(
        targetProperty.marketPrice * enemyDecision.investmentRatio,
        enemyDecision.reason
      );
    } else {
      setStatusText(enemyDecision.reserveProtected
        ? '競合は最終予備資金を守り、こちらの出方を見ています'
        : '競合は不利な風を避け、投入を保留しています');
    }
    if (terminalRef.current) {
      resolvingAiActionRef.current = false;
      return;
    }
    setAiCycle((cycle) => cycle + 1);
    setLastPlayerAction(null);
    setAiProgress(0);
  }, [
    aiProgress,
    battlePhase,
    enemyDecision,
    isTraining,
    enemyMinimumCommitment,
    targetProperty.marketPrice,
    timeScale,
    winner,
  ]);

  useEffect(() => {
    lastTickRef.current = performance.now();
    if (timeScale <= 0 || winner || terminalRef.current) {
      setGaugeSpeed(0);
      return;
    }
    const tick = (now: number) => {
      if (terminalRef.current || simulationPausedRef.current) {
        setGaugeSpeed(0);
        lastTickRef.current = now;
        if (!terminalRef.current) {
          animationRef.current = requestAnimationFrame(tick);
        }
        return;
      }
      const elapsedMs = now - lastTickRef.current;
      if (!shouldProcessGaugeFrame(elapsedMs, battleFrameRate)) {
        animationRef.current = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(0.1, elapsedMs / 1000) * timeScale;
      lastTickRef.current = now;
      const baseVelocity = calculateGaugeVelocity(
        totalPlayerInvested *
          currentWind.playerMultiplier *
          progressionSynergyMultiplier,
        enemyInvested * enemyCapitalMultiplier,
        targetProperty.marketPrice,
        1 + influenceBonus
      );
      const gapRatio = Math.abs(effectiveCapitalGap) / Math.max(targetProperty.marketPrice, 1);
      const leverage = 1 + Math.min(2.4, gapRatio * 3.2);
      const deadZone = gapRatio < 0.025 ? 0.32 : 1;
      const rawVelocity = applyTrainingGaugeSpeed(
        baseVelocity *
          BATTLE_GAUGE_SPEED_FACTOR *
          leverage *
          deadZone *
          currentWind.speedMultiplier -
          (eraWindActive ? eraWindPushPerSecond : 0),
        isTraining
      );
      const velocity =
        enemyLimitBreakHoldRemaining > 0
          ? Math.max(0, rawVelocity)
          : rawVelocity;
      const commitVisual =
        now - lastGaugeVisualCommitRef.current >=
        BATTLE_GAUGE_VISUAL_COMMIT_MS;
      if (commitVisual) {
        lastGaugeVisualCommitRef.current = now;
        setGaugeSpeed(velocity);
      }
      const next = gaugeRef.current + velocity * dt;
      const terminalReached = applyGaugeCandidate(
        next,
        velocity > 0
          ? 'enemy'
          : eraWindActive
            ? 'era_wind'
            : lastPressureCauseRef.current,
        velocity < 0 ? 'CAPITAL_PRESSURE' : 'NORMAL',
        commitVisual
      );
      if (terminalReached || terminalRef.current) return;
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [battleFrameRate, criticalAutoReadyForTrigger, currentWind.playerMultiplier, currentWind.speedMultiplier, effectiveCapitalGap, enemyCapitalMultiplier, enemyInvested, enemyLimitBreakHoldRemaining, eraWindActive, eraWindPushPerSecond, influenceBonus, isTraining, progressionSynergyMultiplier, targetProperty.marketPrice, timeScale, totalPlayerInvested, updateGauge, winner]);

  const startCompanyCapitalPresentation = (
    snapshot: CapitalCommitSnapshot,
    ownershipGain: number
  ) => {
    clearCapitalPilePreview('player');
    clearCapitalCommitTimers();
    simulationPausedRef.current = true;
    const serial = capitalCommitSerialRef.current;
    const timing = getCapitalCommitTiming(snapshot.level, snapshot.compact);
    const previousStage = getBattleCapitalVisibleUnits(
      snapshot.previousCapital,
      targetProperty.marketPrice
    );
    const targetStage = getBattleCapitalVisibleUnits(
      snapshot.previousCapital + snapshot.amount,
      targetProperty.marketPrice
    );
    const previousOverflowTier = getBattleCapitalOverflowTier(
      snapshot.previousCapital,
      targetProperty.marketPrice
    );
    const overflowPasses = getCapitalOverflowPassCount(
      snapshot.previousCapital,
      snapshot.previousCapital + snapshot.amount,
      targetProperty.marketPrice,
      snapshot.level >= 4
    );
    const overflowBeats = snapshot.compact
      ? CAPITAL_OVERFLOW_RESTACK_BEATS.compact
      : snapshot.level >= 4
        ? CAPITAL_OVERFLOW_RESTACK_BEATS.heavy
        : CAPITAL_OVERFLOW_RESTACK_BEATS.standard;
    const columnFrames = getMechanicalCapitalColumnFrames(
      previousStage,
      targetStage,
      snapshot.compact ? 4 : snapshot.level >= 4 ? 24 : 22,
      snapshot.compact ? 6 : snapshot.level >= 4 ? 8 : 7,
      overflowPasses,
      overflowBeats
    );
    const overflowTier = getBattleCapitalOverflowTier(
      snapshot.previousCapital + snapshot.amount,
      targetProperty.marketPrice
    );
    capitalCommitActiveRef.current = true;
    setCapitalPreviewStage({
      visibleUnits: previousStage,
      columnHeights: getCapitalColumnHeights(previousStage),
      activeColumnIndices: [],
      overflowTier: previousOverflowTier,
      presentationSerial: serial,
      commandRecharge: 'continue',
    });
    setCapitalCommit({
      ...snapshot,
      serial,
      stage: 'prepare',
    });
    setStatusText(
      `${formatCurrency(snapshot.amount)}の投資資金を整えています……`
    );
    soundFx.playCoin();

    const beatMs = snapshot.compact
      ? CAPITAL_STACK_BEAT_MS.compact
      : snapshot.level >= 4
        ? CAPITAL_STACK_BEAT_MS.heavy
        : CAPITAL_STACK_BEAT_MS.standard;
    const settleMs = Math.max(timing.settleMs, columnFrames.length * beatMs);
    const audibleBeatCount = Math.min(
      snapshot.level >= 4 ? 12 : 8,
      columnFrames.length
    );
    const audibleFrameIndices = new Map<number, number>();
    for (let soundIndex = 0; soundIndex < audibleBeatCount; soundIndex += 1) {
      const frameIndex = audibleBeatCount <= 1
        ? columnFrames.length - 1
        : Math.round(
            soundIndex * (columnFrames.length - 1) /
              (audibleBeatCount - 1)
          );
      audibleFrameIndices.set(frameIndex, soundIndex);
    }
    const frameIntervalMs = Math.ceil(
      settleMs / Math.max(1, columnFrames.length)
    );
    const schedule = (callback: () => void, delayMs: number) => {
      const timer = window.setTimeout(() => {
        if (
          capitalCommitSerialRef.current !== serial ||
          endedRef.current
        ) {
          return;
        }
        capitalCommitTimersRef.current = [];
        callback();
      }, delayMs);
      capitalCommitTimersRef.current = [timer];
    };
    const complete = () => {
      capitalCommitActiveRef.current = false;
      setCapitalCommit((current) =>
        current?.serial === serial ? null : current
      );
      setMotion('idle');
      setCapitalPreviewStage(null);
      releaseTerminalAfterCapital();
    };
    const enterAfterglow = () => {
      setCapitalCommit((current) =>
        current?.serial === serial
          ? { ...current, stage: 'afterglow' }
          : current
      );
      setCapitalPreviewStage({
        visibleUnits: targetStage,
        columnHeights: getCapitalColumnHeights(targetStage),
        activeColumnIndices: [],
        overflowTier,
        presentationSerial: serial,
        commandRecharge: 'continue',
      });
      setMotion('idle');
      setStatusText(
        `${formatCurrency(snapshot.amount)}の資本を積み上げた――約${formatCurrency(
          calculateLimitBreakPushGilEquivalent(
            targetProperty.marketPrice,
            ownershipGain
          )
        )}相当の押し込み`
      );
      schedule(complete, timing.afterglowMs);
    };
    const paintFrame = (index: number) => {
      const frame = columnFrames[index];
      const isFinalFrame = index === columnFrames.length - 1;
      const overflowReloading = (frame.overflowPass ?? 0) > 0;
      setCapitalPreviewStage({
        ...frame,
        overflowTier: isFinalFrame
          ? overflowTier
          : overflowReloading
            ? Math.max(1, overflowTier)
            : previousOverflowTier,
        presentationSerial: overflowReloading
          ? serial * 100 + (frame.overflowPass ?? 0)
          : serial,
        commandRecharge: 'continue',
      });
      const audibleIndex = audibleFrameIndices.get(index);
      if (audibleIndex !== undefined) {
        soundFx.playCapitalStackStep(
          'player',
          audibleIndex,
          audibleBeatCount,
          isFinalFrame
        );
      }
      if (isFinalFrame) {
        if (overflowTier > 0) {
          soundFx.playCapitalImpact(
            'player',
            Math.min(1, 0.68 + overflowTier * 0.1)
          );
        }
        schedule(enterAfterglow, frameIntervalMs);
        return;
      }
      schedule(() => paintFrame(index + 1), frameIntervalMs);
    };
    const enterImpact = () => {
      setCapitalCommit((current) =>
        current?.serial === serial
          ? { ...current, stage: 'impact' }
          : current
      );
      setStatusText(
        `${formatCurrency(snapshot.amount)}着金――資本を積載中！`
      );
      showFloater(`着金 +${formatCurrency(snapshot.amount)}`, 'player');
      soundFx.playCapitalImpact('player', snapshot.level / 5);
      schedule(() => paintFrame(0), timing.hitStopMs + frameIntervalMs);
    };
    const enterTravel = () => {
      if (motionTimerRef.current) {
        window.clearTimeout(motionTimerRef.current);
        motionTimerRef.current = null;
      }
      setCapitalCommit((current) =>
        current?.serial === serial
          ? { ...current, stage: 'travel' }
          : current
      );
      setMotion('player');
      setMotionSerial((current) => current + 1);
      setStatusText('タタルが資金を運びます……');
      schedule(enterImpact, timing.travelMs);
    };
    schedule(enterTravel, timing.prepareMs);
  };

  const investCompanyFunds = () => {
    if (cash < selectedCost) {
      soundFx.playWarning();
      setStatusText(`自社資金不足。必要額は${formatCurrency(selectedCost)}`);
      return;
    }
    if (!consumeCommand()) return;
    capitalCommitActiveRef.current = true;
    setPanel('capital');
    const previousCapital = playerCommittedCapitalRef.current;
    const previousOwnership = ownership;
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
      false;
    const presentationSnapshot: CapitalCommitSnapshot = {
      amount: selectedCost,
      level: selectedLevel,
      previousCapital,
      previousOwnership,
      compact: reducedMotion,
    };
    setTerminalCapitalSnapshot(presentationSnapshot);
    const impact = calculateDirectInvestmentGaugeImpact({
      investmentAmount: selectedCost,
      marketPrice: targetProperty.marketPrice,
      windMultiplier:
        currentWind.playerMultiplier * progressionSynergyMultiplier,
      trainingLevel: trainingDummyDefinition?.level,
    });
    const rawGaugeAfter = gaugeRef.current - impact;
    updateCash((value) => value - selectedCost);
    commitPlayerCapital('company', selectedCost);
    chargeLimitBreak(selectedCost * currentWind.playerMultiplier);
    addLog(`${companyName}が自社資金${formatCurrency(selectedCost)}を直接投入。`, 'player');
    const action: PlayerBattleAction =
      selectedLevel === 1 ? 'SMALL' :
        selectedLevel === 2 ? 'STEADY' :
          selectedLevel === 3 ? 'BOLD' :
            selectedLevel === 4 ? 'LARGE' : 'ALL_IN';
    setLastPlayerAction(action);
    if (!isTraining && selectedLevel >= 4) {
      setAiProgress((value) =>
        Math.max(value, selectedLevel === 5 ? 82 : 70)
      );
    }
    const ownershipGain = Math.max(
      0,
      calculateOwnershipFromGauge(rawGaugeAfter) - previousOwnership
    );
    startCompanyCapitalPresentation(
      presentationSnapshot,
      ownershipGain
    );
    const terminalInvestment = applyGaugeCandidate(
      rawGaugeAfter,
      'company',
      'NORMAL'
    );
    if (terminalInvestment || terminalRef.current) return;
    setTerminalCapitalSnapshot(null);
  };

  const canConfirmInvestment =
    commandReady &&
    !!maxAffordableConfig &&
    cash >= selectedCost &&
    !actionsLocked;
  const getBattleSupportAmount = (property: Property) =>
    Math.round(
      calculateSubsidiarySupportAmount(
        property,
        networkRequestCount
      ) *
        (isSavage || isUltimate || isCruel
          ? HIGH_DIFFICULTY_SUPPORT_MULTIPLIER
          : 1)
    );

  const cycleInvestmentLevel = (direction = 1) => {
    const affordableLevels = INVESTMENT_LEVELS.filter(
      (item) => getInvestmentCost(targetProperty.marketPrice, item.level) <= cash
    );
    if (affordableLevels.length === 0) {
      soundFx.playWarning();
      setStatusText('自社資金不足。商流リジェネか人脈からの支援を待ってください');
      return;
    }
    const currentIndex = affordableLevels.findIndex(
      (item) => item.level === selectedLevel
    );
    const normalizedIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex =
      (normalizedIndex + direction + affordableLevels.length) %
      affordableLevels.length;
    const next = affordableLevels[nextIndex];
    setSelectedLevel(next.level);
    soundFx.playGaugeTick(0.82 + next.level * 0.1);
    setStatusText(
      `投入額「${next.label}」${formatCurrency(
        getInvestmentCost(targetProperty.marketPrice, next.level)
      )}――投資実行で確定`
    );
  };

  const demandFromProperty = (property: Property) => {
    if (!consumeCommand()) return;
    setPanel('capital');
    setLastPlayerAction('FUNDS');
    const riskIncrease = getSubsidiaryRiskIncrease(
      property,
      BATTLE_LOYALTY_BALANCE.individualRiskIncrease
    );
    const nextRisk = Math.min(100, property.loyaltyRisk + riskIncrease);
    const amount = getBattleSupportAmount(property);
    setSubRequestCounts((current) => ({ ...current, [property.id]: (current[property.id] || 0) + 1 }));
    setNetworkRequestCount((current) => current + 1);

    setBattleSubs((current) => current.map((item) => item.id === property.id ? { ...item, loyaltyRisk: nextRisk } : item));
    const committedCapital = commitPlayerCapital('support', amount);
    startCapitalPilePreview(
      'player',
      committedCapital.previous,
      committedCapital.next,
      amount / Math.max(targetProperty.marketPrice, 1) >= 0.14
    );
    chargeLimitBreak(amount * currentWind.playerMultiplier);
    const impact = Math.min(
      BATTLE_SUPPORT_BALANCE.subsidiaryImpactCap,
      (
        BATTLE_SUPPORT_BALANCE.subsidiaryImpactBase +
        (amount / Math.max(targetProperty.marketPrice, 1)) *
          BATTLE_SUPPORT_BALANCE.subsidiaryImpactPerMarketRatio
      ) * currentWind.playerMultiplier * progressionSynergyMultiplier
    );
    const terminalSupport = applyGaugeCandidate(
      gaugeRef.current - impact,
      'subsidiary',
      'CAPITAL_PRESSURE'
    );
    if (terminalSupport) return;
    setStatusText(
      `${property.name}から${formatCurrency(amount)}を調達――独立危険度${nextRisk}%`
    );
    showFloater(
      `人脈 +${formatCurrency(amount)}`,
      'player',
      'positive',
      'support'
    );
    playMotion('player');
    triggerImpactStop(
      'player',
      impact >= BATTLE_SUPPORT_BALANCE.subsidiaryImpactCap * 0.7
    );
    addLog(`人脈支援第${networkRequestCount + 1}波：${property.name}へ第${(subRequestCounts[property.id] || 0) + 1}次資金要求。${formatCurrency(amount)}を調達、独立危険度${nextRisk}%。離脱判定は勝利後に1回だけ行います。`, 'funds');
  };

  const demandFromAllies = () => {
    if (
      limitBreakTier === 0 ||
      limitBreakTimerRef.current !== null ||
      limitTerminalHandoffTimerRef.current !== null ||
      !consumeCommand()
    ) {
      return;
    }
    setPanel('capital');
    setLastPlayerAction('LIMIT_BREAK');
    setActiveLimitBreakTier(limitBreakTier);
    onLimitBreakChargeChange(consumeLimitBreakCharge);
    changeBattlePhase('limit_charge');
    setGaugeSpeed(0);
    announceBattle('limit', BATTLE_CINEMATIC_TIMING.limitAnnouncementMs);
    soundFx.playLimitBreak();

    const survivors = battleSubs.map((member) => ({
      ...member,
      loyaltyRisk: Math.min(
        100,
        member.loyaltyRisk +
          getSubsidiaryRiskIncrease(
            member,
            BATTLE_LOYALTY_BALANCE.limitBreakRiskIncrease
          )
      ),
    }));

    const amount = calculateLimitBreakAmount(
      targetProperty.marketPrice,
      survivors,
      limitBreakTier,
      subRequestCounts
    );
    setStatusText(`LIMIT BREAK ${limitBreakTier}――自社と人脈${survivors.length}件の出資を集約中`);
    addLog(`LIMIT BREAK ${limitBreakTier}発動。自社と人脈${battleSubs.length}件が一斉出資へ参加。`, 'skill');

    limitBreakTimerRef.current = window.setTimeout(() => {
      limitBreakTimerRef.current = null;
      if (endedRef.current) return;
      // The fan-kit cue owns the charge-up. Fade it before the capital impact
      // so a cached cue or a late first decode cannot spill into the decisive
      // slow-motion and WIN presentation.
      soundFx.stopBattleCinematicAudio(160);
      setBattleSubs((current) => current.map(
        (item) =>
          survivors.find((survivor) => survivor.id === item.id) || item
      ));
      setSubRequestCounts((current) => {
        const next = { ...current };
        battleSubs.forEach((member) => {
          next[member.id] = (next[member.id] || 0) + 1;
        });
        return next;
      });
      const committedCapital = commitPlayerCapital('support', amount);
      startCapitalPilePreview(
        'player',
        committedCapital.previous,
        committedCapital.next,
        true,
        true,
        'pause'
      );
      setLimitImpactActive(true);
      if (limitImpactTimerRef.current) window.clearTimeout(limitImpactTimerRef.current);
      limitImpactTimerRef.current = window.setTimeout(() => setLimitImpactActive(false), 1450);

      const emergencyDefense = isTraining
        ? 0
        : Math.min(
            enemyReserveRef.current,
            Math.round(amount * 0.45)
          );
      const defenseResult = emergencyDefense > 0
        ? commitEnemyFunds(
            emergencyDefense,
            'LIMIT BREAKへの緊急防衛',
            false,
            false,
            false,
            false,
            'pause'
          )
        : { actual: 0, counterShock: 0 };
      if (terminalRef.current) return;
      const ownershipPush = calculateLimitBreakOwnershipPush(
        amount,
        targetProperty.marketPrice,
        limitBreakTier,
        currentWind.playerMultiplier
      );
      const defenseOwnershipPushback = defenseResult.counterShock / 2;
      const rawOwnershipAfter = calculateLimitBreakOwnershipAfterDefense(
        livingDeadPhaseRef.current === 'recovery'
          ? rawOwnership
          : ownership,
        ownershipPush,
        defenseResult.counterShock
      );
      const rawGaugeAfter = 100 - rawOwnershipAfter * 2;
      // Resolve boss Cover/Invincible against the full LB movement before the
      // terminal preview clamps the visible gauge to 99%. Otherwise only the
      // tiny gap from that preview position would be intercepted.
      const coveredLimitBreak = applyCoverToGaugeCandidate(
        rawGaugeAfter,
        'limit_break'
      );
      const resolvedGaugeAfter = coveredLimitBreak.nextGauge;
      const barrierOwnershipPushback =
        coveredLimitBreak.barrierAbsorbedGauge / 2;
      const coverOwnershipPushback = Math.max(
        0,
        coveredLimitBreak.absorbedGauge / 2 - barrierOwnershipPushback
      );
      const netOwnershipPush = Math.max(
        0,
        ownershipPush -
          defenseOwnershipPushback -
          coverOwnershipPushback -
          barrierOwnershipPushback
      );
      const netPushGilEquivalent = calculateLimitBreakPushGilEquivalent(
        targetProperty.marketPrice,
        netOwnershipPush
      );
      const defenseGilEquivalent = calculateLimitBreakPushGilEquivalent(
        targetProperty.marketPrice,
        defenseOwnershipPushback
      );
      const coverGilEquivalent = calculateLimitBreakPushGilEquivalent(
        targetProperty.marketPrice,
        coverOwnershipPushback
      );
      const barrierGilEquivalent = calculateLimitBreakPushGilEquivalent(
        targetProperty.marketPrice,
        barrierOwnershipPushback
      );
      const coverResultLabel =
        enemyActiveCoverTierRef.current === 'invincible'
          ? '無敵'
          : enemyActiveCoverTierRef.current === 'enhanced_cover'
            ? 'パッセ'
            : 'かばう';
      const limitBreakResultText =
        `LIMIT BREAK ${limitBreakTier}！ 実効 約${formatCurrency(netPushGilEquivalent)}相当` +
        (defenseResult.actual > 0
          ? ` / 緊急防衛 約${formatCurrency(defenseGilEquivalent)}`
          : '') +
        (coverOwnershipPushback > 0
          ? ` / ${coverResultLabel} 約${formatCurrency(coverGilEquivalent)}防御`
          : '') +
        (barrierOwnershipPushback > 0
          ? ` / ベニゾン 約${formatCurrency(barrierGilEquivalent)}吸収`
          : '');
      addLog(limitBreakResultText, 'skill');
      soundFx.playLimitBreakImpact(limitBreakTier);
      const pendingLimitWinner = getBattleTerminalWinner(resolvedGaugeAfter);
      if (pendingLimitWinner) {
        updateGauge(pendingLimitWinner === 'player' ? -99 : 99);
        setGaugeSpeed(0);
        setStatusText(limitBreakResultText);
        showFloater(`LB 実効 約${formatCurrency(netPushGilEquivalent)}`, 'player');
        if (defenseResult.actual > 0) {
          showFloater(
            `緊急防衛 約${formatCurrency(defenseGilEquivalent)}`,
            'enemy',
            'negative'
          );
        }
        playMotion('player');
        limitTerminalHandoffTimerRef.current = window.setTimeout(() => {
          limitTerminalHandoffTimerRef.current = null;
          if (endedRef.current || terminalRef.current) return;
          const terminalStarted = applyGaugeCandidate(
            resolvedGaugeAfter,
            'limit_break',
            `LIMIT_BREAK_${limitBreakTier}` as FinishMethod,
            true,
            true
          );
          if (!terminalStarted && !terminalRef.current) {
            setLimitImpactActive(false);
            changeBattlePhase('active');
            setBattleAnnouncement(null);
            setLastPlayerAction(null);
            setAiProgress(0);
            setAiCycle((cycle) => cycle + 1);
          }
        }, BATTLE_CINEMATIC_TIMING.limitImpactHandoffMs);
        return;
      }
      const terminalLimitBreak = applyGaugeCandidate(
        resolvedGaugeAfter,
        'limit_break',
        `LIMIT_BREAK_${limitBreakTier}` as FinishMethod,
        true,
        true
      );
      if (terminalLimitBreak) return;
      showFloater(`LB 実効 約${formatCurrency(netPushGilEquivalent)}`, 'player');
      if (defenseResult.actual > 0) {
        showFloater(
          `緊急防衛 約${formatCurrency(defenseGilEquivalent)}`,
          'enemy',
          'negative'
        );
      }
      playMotion('player');
      setStatusText(limitBreakResultText);

      changeBattlePhase('active');
      setBattleAnnouncement(null);
      setLastPlayerAction(null);
      setAiProgress(0);
      setAiCycle((cycle) => cycle + 1);
      if (!isTraining && enemyReserveRef.current <= 0) {
        showLiquidityWarning();
      }
    }, BATTLE_CINEMATIC_TIMING.limitResolveMs);
  };

  const demandFromGroup = (
    name: string,
    members: Property[],
    groupMultiplier: number
  ) => {
    if (
      skillCinematic ||
      skillCinematicRuntimeRef.current ||
      !consumeCommand()
    ) return;
    setPanel('capital');
    setLastPlayerAction('SYNERGY');
    let amount = 0;
    const survivors: Property[] = [];

    members.forEach((member) => {
      const nextRisk = Math.min(
        100,
        member.loyaltyRisk +
          getSubsidiaryRiskIncrease(
            member,
            BATTLE_LOYALTY_BALANCE.synergyRiskIncrease
          )
      );
      survivors.push({ ...member, loyaltyRisk: nextRisk });
      amount += Math.round(
        member.marketPrice *
          BATTLE_SUPPORT_BALANCE.synergyMemberMarketRatio *
          getSubsidiarySupportMultiplier(member) *
          getRepeatedNetworkSupportMultiplier(
            subRequestCounts[member.id] ?? 0
          ) *
          (isSavage || isUltimate || isCruel
            ? HIGH_DIFFICULTY_SUPPORT_MULTIPLIER
            : 1)
      );
    });
    amount = Math.round(amount * groupMultiplier);
    const groupImpact = Math.min(
      BATTLE_SUPPORT_BALANCE.synergyImpactCap,
      (
        BATTLE_SUPPORT_BALANCE.synergyImpactBase +
        (amount / Math.max(targetProperty.marketPrice, 1)) *
        BATTLE_SUPPORT_BALANCE.synergyImpactPerMarketRatio
      ) * currentWind.playerMultiplier * progressionSynergyMultiplier
    );
    const groupImpactGilEquivalent = calculateLimitBreakPushGilEquivalent(
      targetProperty.marketPrice,
      groupImpact / 2
    );
    enemySupportCastBlockedRef.current = true;
    simulationPausedRef.current = true;
    const baseCinematic: SkillCinematicBase = {
      skillId: `group-${name}`,
      skillName: name,
      effectType: 'SYNERGY_PUSH',
      targetsRival: false,
      resultHeadline: '一斉調達！',
      effectSummary: `${members.length}件連携・${formatCurrency(
        amount
      )}を一斉調達・約${formatCurrency(groupImpactGilEquivalent)}相当の押し込み`,
      durationLabel: '即時効果',
    };
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
      false;
    const timing = getSkillCinematicTiming(reducedMotion);
    setStatusText(`${name}――一斉調達を準備`);
    soundFx.playSkillCast('SYNERGY_PUSH');

    startSkillCinematic({
      cinematic: baseCinematic,
      timing,
      onCast: () => {
        playMotion('player');
        soundFx.playSkillWhoosh('SYNERGY_PUSH');
      },
      onEffect: () => {
        setBattleSubs((current) =>
          current.map(
            (item) =>
              survivors.find((survivor) => survivor.id === item.id) ??
              item
          )
        );
        const committedCapital = commitPlayerCapital('support', amount);
        startCapitalPilePreview(
          'player',
          committedCapital.previous,
          committedCapital.next,
          true,
          true,
          'pause'
        );
        setSubRequestCounts((current) => {
          const next = { ...current };
          members.forEach((member) => {
            next[member.id] = (next[member.id] ?? 0) + 1;
          });
          return next;
        });
        chargeLimitBreak(amount * currentWind.playerMultiplier);
        soundFx.playSkillImpact('SYNERGY_PUSH', 'player');
        applyGaugeCandidate(
          gaugeRef.current - groupImpact,
          'synergy',
          'CAPITAL_PRESSURE'
        );
        setStatusText(
          `${name}発動！ ${formatCurrency(
            amount
          )}を一斉調達――約${formatCurrency(groupImpactGilEquivalent)}相当を押し込んだ`
        );
        showFloater(
          `SYNERGY +${formatCurrency(amount)}`,
          'player',
          'positive',
          'support'
        );
        addLog(
          `${name}の人脈${members.length}件から${formatCurrency(
            amount
          )}を一斉調達。同じ人脈へ続けて頼むと次回の調達額は下がります。離脱判定は勝利後に1回だけ行います。`,
          'funds'
        );
      },
    });
  };

  const activateProgressionBattleSynergy = (synergy: GroupSynergy) => {
    const effect = synergy.battleEffect;
    if (
      !effect ||
      usedProgressionSynergyIds.has(synergy.id) ||
      skillCinematic ||
      skillCinematicRuntimeRef.current ||
      !consumeCommand()
    ) {
      return;
    }
    setPanel('capital');
    setLastPlayerAction('SYNERGY');
    lastPressureCauseRef.current = 'synergy';
    enemySupportCastBlockedRef.current = true;
    simulationPausedRef.current = true;
    setUsedProgressionSynergyIds((current) =>
      new Set(current).add(synergy.id)
    );
    const rallyOwnershipPush = Math.max(0, effect.ownershipPush ?? 0);
    const rallyGilEquivalent = calculateLimitBreakPushGilEquivalent(
      targetProperty.marketPrice,
      rallyOwnershipPush
    );
    const baseCinematic: SkillCinematicBase = {
      skillId: synergy.id,
      skillName: synergy.name,
      effectType: 'SYNERGY_PUSH',
      targetsRival: false,
      resultHeadline: `資本圧力${Math.round(
        (effect.capitalPressureMultiplier - 1) * 100
      )}%アップ！`,
      effectSummary:
        `約${formatCurrency(rallyGilEquivalent)}相当を即時押し込み` +
        (effect.limitBreakChargeMultiplier
          ? `・LB蓄積×${effect.limitBreakChargeMultiplier.toFixed(2)}`
          : ''),
      durationLabel: `${Math.round(effect.durationMs / 1000)}秒`,
    };
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
      false;
    const timing = getSkillCinematicTiming(reducedMotion);
    setStatusText(`${synergy.name}――シナジー準備`);
    soundFx.playSkillCast('SYNERGY_PUSH');

    startSkillCinematic({
      cinematic: baseCinematic,
      timing,
      onCast: () => {
        playMotion('player');
        soundFx.playSkillWhoosh('SYNERGY_PUSH');
      },
      onEffect: () => {
        const counteredDivination = effect.countersMarketWind
          ? cancelEnemySupportTelegraph(false, 'divination') === 'divination'
          : false;
        if (effect.countersMarketWind) {
          setEnemyMarketWindRemaining(0);
          setBattleWindState((current) => ({
            phase: 'cooldown',
            windType: 'CALM',
            pendingWindType: null,
            lastWindType:
              current.windType === 'CALM'
                ? current.lastWindType
                : current.windType,
            secondsRemaining: BATTLE_WIND_COOLDOWN_SECONDS,
          }));
        }
        setProgressionSynergyRemaining(effect.durationMs);
        setStatusText(
          `${counteredDivination ? '相場誘導を打ち消した！ ' : ''}${synergy.name}――資本圧力${Math.round(
            (effect.capitalPressureMultiplier - 1) * 100
          )}%強化・約${formatCurrency(rallyGilEquivalent)}相当を押し込み${
            effect.limitBreakChargeMultiplier
              ? `・LB蓄積×${effect.limitBreakChargeMultiplier.toFixed(2)}`
              : ''
          }・${Math.round(effect.durationMs / 1000)}秒。次の一手へ`
        );
        showFloater(
          `シナジー 約${formatCurrency(rallyGilEquivalent)} / ×${effect.capitalPressureMultiplier.toFixed(2)}`,
          'player',
          'positive'
        );
        soundFx.playSkillImpact('SYNERGY_PUSH', 'player');
        setCommandProgress(100);
        if (rallyOwnershipPush > 0) {
          applyGaugeCandidate(
            gaugeRef.current - rallyOwnershipPush * 2,
            'synergy',
            'CAPITAL_PRESSURE'
          );
        }
        addLog(
          `${synergy.name}を発動。${Math.round(
            effect.durationMs / 1000
          )}秒間、資本圧力×${effect.capitalPressureMultiplier.toFixed(2)}${
            effect.limitBreakChargeMultiplier
              ? `、LB蓄積×${effect.limitBreakChargeMultiplier.toFixed(2)}`
              : ''
          }。約${formatCurrency(rallyGilEquivalent)}相当を押し返し、次の行動準備が完了。`,
          'skill'
        );
      },
    });
  };

  const requestAlliance = () => {
    if (!alliance.active || allianceUsed || !consumeCommand()) return;
    setPanel('capital');
    setLastPlayerAction('ALLIANCE');
    const amount = calculateAllianceSupport(targetProperty.marketPrice);
    lastPressureCauseRef.current = 'alliance';
    const committedCapital = commitPlayerCapital('support', amount);
    startCapitalPilePreview(
      'player',
      committedCapital.previous,
      committedCapital.next,
      true,
      true
    );
    setAllianceUsed(true);
    setStatusText(alliancePublicPatronage
      ? `${alliance.allyName}へ通商支援を要請――後援支援 +${formatCurrency(amount)}相当`
      : `${alliance.allyName}から${formatCurrency(amount)}の協力支援`);
    showFloater(
      alliancePublicPatronage
        ? `後援支援 +${formatCurrency(amount)}`
        : `協力支援 +${formatCurrency(amount)}`,
      'player',
      'positive',
      'support'
    );
    playMotion('player');
    addLog(alliancePublicPatronage
      ? `${alliance.allyName}へ通商支援を要請。許認可・調達・輸送を含む${formatCurrency(amount)}相当の後援支援。`
      : `${alliance.allyName}へ協力支援を要請。${formatCurrency(amount)}を調達。`, 'funds');
  };

  const selectSkill = (skill: TacticalSkill) => {
    if (skillSelectionLocked) return;
    setSelectedSkillId(skill.id);
    setPanel('capital');
    soundFx.playGaugeTick(0.96);
    setStatusText(
      `${skill.name}を選択――「アビリティ発動」で実行`
    );
  };

  const cycleSkillSelection = () => {
    if (skillSelectionLocked || battleSkillPool.length === 0) return;
    const nextId = getNextBattleSkillId(
      battleSkillPool.map((skill) => skill.id),
      primarySkill?.id ?? null
    );
    const nextSkill = battleSkillPool.find((skill) => skill.id === nextId);
    if (nextSkill) selectSkill(nextSkill);
  };

  const resolveSkillEffect = (
    skill: TacticalSkill,
    {
      deferCapitalPile = false,
      replaceActiveDefense = false,
    }: {
      deferCapitalPile?: boolean;
      replaceActiveDefense?: boolean;
    } = {}
  ): DeferredSkillPresentation | null => {
    let deferredPresentation: DeferredSkillPresentation | null = null;
    let replacedActiveDefense = false;
    const targetsRival = isRivalOnlySkill(skill);
    if (skill.effectType === 'COOLDOWN_REDUCTION') {
      setFastHorseRemaining(TACTICAL_SKILL_BALANCE.fastAction.durationMs);
      setStatusText('疾風怒濤の計――15秒間、行動のリキャストタイムを約47%短縮');
      showFloater('リキャスト短縮 47% / 15秒', 'player');
    } else if (skill.effectType === 'NEMAWASHI') {
      setBattleSubs((current) => current.map((item) => ({
        ...item,
        loyaltyRisk: Math.floor(
          item.loyaltyRisk / TACTICAL_SKILL_BALANCE.moraleSupport.loyaltyRiskDivisor
        ),
      })));
      setStatusText('ネマワシ――全人脈の独立危険度が半減');
      showFloater('独立危険度 半減', 'player');
    } else if (skill.effectType === 'INDEPENDENCE_SABOTAGE') {
      const interruptedSkillId = stunInterruptedActionRef.current ?? null;
      stunInterruptedActionRef.current = undefined;
      if (interruptedSkillId === 'limit_break_delay') {
        setStatusText('スタン成功――敵LIMIT BREAK 3の発動を2.4秒遅延');
        showFloater('STUN / LB3 遅延', 'enemy', 'notice');
        addLog(
          'スタンで敵LIMIT BREAK 3の集約を2.4秒遅らせた。最強技そのものは取り消せない。',
          'skill'
        );
      } else if (interruptedSkillId === 'unstoppable') {
        setStatusText('スタン無効――この宣告は戦闘フェーズそのものを変える');
        showFloater('INTERRUPT IMMUNE', 'enemy', 'negative');
        addLog(
          'スタンを試みたが、闇タタルの宣告は中断不能。通常行動へのスタンは引き続き有効。',
          'skill'
        );
      } else if (interruptedSkillId) {
        const interruptedAction =
          interruptedSkillId === 'standard'
            ? '追加防衛'
            : ENEMY_SUPPORT_PRESENTATION[interruptedSkillId].actionName;
        setStatusText(`スタン成功――競合の「${interruptedAction}」を中断`);
        showFloater(`STUN / ${interruptedAction}中断`, 'enemy', 'negative');
      } else {
        setStatusText('スタン不発――競合は行動を予告していなかった');
        showFloater('STUN / 不発', 'enemy', 'notice');
      }
    } else if (skill.effectType === 'COVER') {
      if (replaceActiveDefense) {
        replacedActiveDefense = clearPlayerDefenseForCriticalAuto();
      }
      if (activatePlayerCover()) {
        setStatusText(
          replacedActiveDefense
            ? `瀕死防御更新――パッセージ・オブ・アームズへ入れ替え、ナイトが${Math.round(
                TACTICAL_SKILL_BALANCE.cover.durationMs / 1000
              )}秒間、自社の防衛線へ入る`
            : `パッセージ・オブ・アームズ――ナイトが${Math.round(
                TACTICAL_SKILL_BALANCE.cover.durationMs / 1000
              )}秒間、自社の防衛線へ入る`
        );
        showFloater(
          `パッセ / ${Math.round(
            TACTICAL_SKILL_BALANCE.cover.durationMs / 1000
          )}秒`,
          'player',
          'notice'
        );
      }
    } else if (skill.effectType === 'BARRIER') {
      if (replaceActiveDefense) {
        replacedActiveDefense = clearPlayerDefenseForCriticalAuto();
      }
      if (activateDivineBenison('player')) {
        setStatusText(
          replacedActiveDefense
            ? `瀕死防御更新――ディヴァインベニゾンへ入れ替え、${Math.round(
                DIVINE_BENISON_BALANCE.durationMs / 1000
              )}秒間、所有率${DIVINE_BENISON_BALANCE.gaugeCapacity / 2}%分の有限障壁`
            : `ディヴァインベニゾン――${Math.round(
                DIVINE_BENISON_BALANCE.durationMs / 1000
              )}秒間、所有率${DIVINE_BENISON_BALANCE.gaugeCapacity / 2}%分の有限障壁`
        );
        showFloater(
          `BENISON / ${DIVINE_BENISON_BALANCE.gaugeCapacity / 2}%吸収`,
          'player',
          'notice'
        );
      }
    } else if (skill.effectType === 'CAPITAL_BOOST') {
      const amount = Math.round(
        targetProperty.marketPrice * TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio
      );
      lastPressureCauseRef.current = 'skill';
      const committedCapital = commitPlayerCapital('support', amount);
      const presentCommittedCapital: DeferredSkillPresentation = (onComplete) =>
        startCapitalPilePreview(
          'player',
          committedCapital.previous,
          committedCapital.next,
          true,
          true,
          'pause',
          onComplete
        );
      if (deferCapitalPile) {
        deferredPresentation = presentCommittedCapital;
      } else {
        presentCommittedCapital();
      }
      chargeLimitBreak(amount * currentWind.playerMultiplier);
      setStatusText(`意気衝天――無料支援資金${formatCurrency(amount)}を即時投入`);
      showFloater(
        `支援 +${formatCurrency(amount)}`,
        'player',
        'positive',
        'support'
      );
    } else if (skill.effectType === 'LIVING_DEAD') {
      updateLivingDeadState(
        'waiting',
        TACTICAL_SKILL_BALANCE.livingDead.waitingDurationMs
      );
    setStatusText('リビングデッド――10秒間、所有率0%への到達を待機');
      showFloater('LIVING DEAD / ARMED', 'player', 'notice');
    }
    soundFx.playSkillImpact(
      skill.effectType,
      targetsRival ? 'opponent' : 'player'
    );
    addLog(
      replacedActiveDefense
        ? `瀕死アビリティ――発動中の防御を${skill.name}へ更新。${skill.description}`
        : `${skill.name}を使用。${skill.description}`,
      'skill'
    );
    return deferredPresentation;
  };

  const useSkill = (
    skill: TacticalSkill,
    {
      source = 'manual',
      commandAlreadyConsumed = false,
      sequenceCapitalPresentation = false,
      onEffectCommitted,
      onComplete,
    }: SkillActivationOptions = {}
  ) => {
    const canReplaceActiveDefense =
      source === 'critical-auto' &&
      (skill.effectType === 'COVER' || skill.effectType === 'BARRIER');
    if (
      !canReplaceActiveDefense &&
      skill.effectType === 'COVER' &&
      (playerCoverRemainingRef.current > 0 ||
        playerBarrierRemainingRef.current > 0)
    ) {
      soundFx.playWarning();
      setStatusText('防御効果の発動中は、パッセを重ねられません');
      return false;
    }
    if (
      !canReplaceActiveDefense &&
      skill.effectType === 'BARRIER' &&
      (playerBarrierRemainingRef.current > 0 ||
        playerCoverRemainingRef.current > 0)
    ) {
      soundFx.playWarning();
      setStatusText('防御効果の発動中は、ベニゾンを重ねられません');
      return false;
    }
    if (
      skillCinematic ||
      skillCinematicRuntimeRef.current ||
      (isTraining && isRivalOnlySkill(skill)) ||
      (skillCooldowns[skill.id] || 0) > 0 ||
      (skill.oncePerBattle && usedSkillIds.has(skill.id))
    ) return false;
    if (!commandAlreadyConsumed) {
      if (source === 'manual') {
        if (!consumeCommand()) return false;
      } else if (source === 'critical-auto') {
        if (!commandReady) return false;
        setCommandProgress(0);
      }
    }

    if (skill.effectType === 'INDEPENDENCE_SABOTAGE') {
      const interruptedSupportAction = interruptEnemySupportTelegraph();
      if (interruptedSupportAction) {
        stunInterruptedActionRef.current = interruptedSupportAction;
      } else if (
        aiProgress >= 72 &&
        enemyCanCommit &&
        !resolvingAiActionRef.current
      ) {
        setAiProgress(0);
        setAiCycle((cycle) => cycle + 1);
        stunInterruptedActionRef.current = 'standard';
      } else {
        stunInterruptedActionRef.current = null;
      }
    } else {
      stunInterruptedActionRef.current = undefined;
    }

    setPanel('capital');
    enemySupportCastBlockedRef.current = true;
    simulationPausedRef.current = true;
    setSkillCooldowns((current) => ({ ...current, [skill.id]: skill.cooldownMs }));
    if (skill.oncePerBattle) {
      setUsedSkillIds((current) => new Set(current).add(skill.id));
    }

    const targetsRival = isRivalOnlySkill(skill);
    const cinematicResult = getSkillCinematicResult(skill, isTraining);
    if (skill.effectType === 'INDEPENDENCE_SABOTAGE') {
      cinematicResult.resultHeadline = stunInterruptedActionRef.current
        ? stunInterruptedActionRef.current === 'unstoppable'
          ? 'スタン無効'
          : 'スタン成功！'
        : 'スタン不発';
      cinematicResult.effectSummary = stunInterruptedActionRef.current
        ? stunInterruptedActionRef.current === 'limit_break_delay'
          ? '敵LB3を2.4秒遅延'
          : stunInterruptedActionRef.current === 'unstoppable'
            ? 'フェーズ技は中断不能'
            : '競合の予告行動を1回中断'
        : '中断できる予告行動なし';
    }
    const baseCinematic: SkillCinematicBase = {
      skillId: skill.id,
      skillName: skill.name,
      effectType: skill.effectType,
      targetsRival,
      ...cinematicResult,
    };
    setStatusText(
      source === 'opening-auto'
        ? `開幕アビリティ――${skill.name}`
        : source === 'critical-auto'
          ? `瀕死アビリティ――${skill.name}`
          : `${skill.name}――発動`
    );
    soundFx.playSkillCast(skill.effectType);
    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches ?? false;
    const skillTiming = getSkillCinematicTiming(reducedMotion);
    let deferredPresentation: DeferredSkillPresentation | null = null;

    startSkillCinematic({
      cinematic: baseCinematic,
      timing: skillTiming,
      onCast: () => {
        playMotion('player');
        soundFx.playSkillWhoosh(skill.effectType);
      },
      onEffect: () => {
        deferredPresentation = resolveSkillEffect(skill, {
          deferCapitalPile: sequenceCapitalPresentation,
          replaceActiveDefense: canReplaceActiveDefense,
        });
        onEffectCommitted?.();
      },
      onComplete: () => {
        if (deferredPresentation) {
          const presentation = deferredPresentation;
          deferredPresentation = null;
          presentation(onComplete);
          return;
        }
        onComplete?.();
      },
    });
    return true;
  };

  useEffect(() => {
    if (
      !openingAutoPending ||
      openingAutoTriggeredRef.current ||
      battlePhase !== 'active' ||
      winner ||
      endedRef.current ||
      terminalRef.current ||
      battleAnnouncement ||
      conditionAnnouncement ||
      skillCinematic ||
      capitalCommit ||
      capitalPilePresentationLocked ||
      enemySupportPresentationLocked ||
      impactStop
    ) {
      return;
    }
    if (!openingAutoSkill) {
      setOpeningAutoPending(false);
      setOpeningSlowActive(false);
      return;
    }
    openingAutoTriggeredRef.current = true;
    const started = useSkill(openingAutoSkill, {
      source: 'opening-auto',
      onComplete: () => {
        setOpeningAutoPending(false);
        setOpeningSlowActive(false);
      },
    });
    if (!started) {
      setOpeningAutoPending(false);
      setOpeningSlowActive(false);
    }
  }, [
    battleAnnouncement,
    battlePhase,
    capitalCommit,
    capitalPilePresentationLocked,
    conditionAnnouncement,
    enemySupportPresentationLocked,
    impactStop,
    openingAutoPending,
    openingAutoSkill,
    skillCinematic,
    winner,
  ]);

  useEffect(() => {
    if (
      !criticalAutoPending ||
      battlePhase !== 'active' ||
      winner ||
      endedRef.current ||
      terminalRef.current ||
      battleAnnouncement ||
      conditionAnnouncement ||
      skillCinematic ||
      skillCinematicRuntimeRef.current ||
      capitalCommit ||
      capitalPilePresentationLocked ||
      enemySupportPresentationLocked ||
      impactStop
    ) {
      return;
    }

    const releaseCriticalAuto = (cancelled = false) => {
      const candidate = criticalAutoPendingRef.current;
      criticalAutoResolutionPhaseRef.current = advanceCriticalAutoResolution(
        criticalAutoResolutionPhaseRef.current,
        cancelled ? 'cancel' : 'release'
      );
      if (!cancelled && criticalAutoResolutionPhaseRef.current !== 'idle') {
        return;
      }
      criticalAutoPendingRef.current = null;
      // Keep the first resumed frame inside the existing decision grace. The
      // passive grace effect will own its 1.8-second timer after this batched
      // render, but this immediate state prevents a one-frame full-speed gap.
      setDecisionGraceActive(true);
      setCriticalAutoPending(null);
      // AUTO is a reserved slot, not a manual command. Give the player the
      // existing 1.8-second decision grace after the card and pile finish.
      setCommandProgress(100);
      decisionGraceArmedRef.current = true;
      if (!candidate || endedRef.current || terminalRef.current) return;
      setGaugeSpeed(0);
      setStatusText(
        cancelled
          ? '瀕死アビリティを実行できず、商戦を再開'
          : `瀕死アビリティ――${criticalAutoSkill?.name ?? '効果'}完了。次の一手へ`
      );
    };

    if (
      criticalAutoResolutionPhaseRef.current === 'effect_committed'
    ) {
      // Fast Refresh can clear a deferred pile timer after the skill effect was
      // committed. With no runner or fixed-DOM presentation left, promote the
      // serialized action to completion instead of leaving combat paused.
      criticalAutoResolutionPhaseRef.current = advanceCriticalAutoResolution(
        criticalAutoResolutionPhaseRef.current,
        'complete_presentation'
      );
      releaseCriticalAuto(false);
      return;
    }
    if (
      criticalAutoResolutionPhaseRef.current === 'presentation_complete'
    ) {
      releaseCriticalAuto(false);
      return;
    }
    if (criticalAutoResolutionPhaseRef.current !== 'held') return;
    if (!criticalAutoSkill) {
      releaseCriticalAuto(true);
      return;
    }
    criticalAutoResolutionPhaseRef.current = advanceCriticalAutoResolution(
      criticalAutoResolutionPhaseRef.current,
      'start_cinematic'
    );
    const started = useSkill(criticalAutoSkill, {
      source: 'critical-auto',
      commandAlreadyConsumed: true,
      sequenceCapitalPresentation: true,
      onEffectCommitted: () => {
        criticalAutoResolutionPhaseRef.current = advanceCriticalAutoResolution(
          criticalAutoResolutionPhaseRef.current,
          'commit_effect'
        );
      },
      onComplete: () => {
        criticalAutoResolutionPhaseRef.current = advanceCriticalAutoResolution(
          criticalAutoResolutionPhaseRef.current,
          'complete_presentation'
        );
        releaseCriticalAuto(false);
      },
    });
    if (!started) {
      releaseCriticalAuto(true);
    }
  }, [
    battleAnnouncement,
    battlePhase,
    capitalCommit,
    capitalPilePresentationLocked,
    conditionAnnouncement,
    criticalAutoPending,
    criticalAutoSkill,
    enemySupportPresentationLocked,
    impactStop,
    skillCinematic,
    winner,
  ]);

  const resultSettlementCost = isTraining
    ? 0
    : Math.round(
        companyInvested * (winner === 'player' ? 0.35 : 0.75)
      );
  const resultVictoryReward = isTraining
    ? 0
    : calculateBattleVictoryReward(
        targetProperty.marketPrice,
        winner === 'player',
        isCruel
          ? 'cruel'
          : isUltimate
            ? 'ultimate'
            : isSavage
              ? 'savage'
              : 'normal',
        targetProperty.owner === 'player'
      );
  const resultLoyaltyPool = Array.from(
    new Map(
      [...battleSubs, ...rebelled].map((property) => [
        property.id,
        property,
      ] as const)
    ).values()
  );
  const profitAllocationChoices = getVictoryProfitAllocationChoices(
    resultLoyaltyPool,
    resultVictoryReward
  );
  const celebrationGiftOption = celebrationDecision
    ? profitAllocationChoices.find(
        (option) => option.id === celebrationDecision
      ) ?? null
    : null;
  const celebrationGiftRate = celebrationGiftOption?.rate ?? 0;
  const celebrationGiftCost =
    !isTraining && !isHighEndRaid && winner === 'player'
      ? celebrationGiftOption?.cost ?? 0
      : 0;
  const celebrationDecisionRequired =
    resultLoyaltyPool.length > 0 &&
    resultVictoryReward > 0 &&
    winner === 'player' &&
    !isTraining &&
    !isHighEndRaid;
  const appliedCelebrationGiftCost = celebrationGiftCost;
  const resultSettlementPending =
    celebrationDecisionRequired && !celebrationDecision;
  const baseDepartureProbability =
    profitAllocationChoices[0]?.departureProbability ?? 0;
  const selectedDepartureProbability =
    celebrationGiftOption?.departureProbability ?? baseDepartureProbability;
  const resultLiquidationCashback = isProtectedBattle
    ? 0
    : Array.from(
        new Map(rebelled.map((property) => [property.id, property])).values()
      ).reduce((total, property) => total + property.marketPrice, 0);
  const resultSettlementSummary = isTraining
    ? {
        transactionDelta: 0,
        fundsDelta: 0,
        outcome: 'balanced' as const,
      }
    : calculateBattleSettlementSummary({
        victoryReward: resultVictoryReward,
        brokerageFee,
        settlementCost: resultSettlementCost,
        celebrationGiftCost: appliedCelebrationGiftCost,
        liquidationCashback: resultLiquidationCashback,
        battleCashDelta: -enemyDrainStolen,
      });
  const resultTransactionDelta = resultSettlementSummary.transactionDelta;
  const resultFundsDelta = resultSettlementSummary.fundsDelta;
  const resultSettlementTone =
    resultSettlementPending
      ? 'is-neutral'
      : resultSettlementSummary.outcome === 'profit'
      ? 'is-positive'
      : resultSettlementSummary.outcome === 'loss'
        ? 'is-negative'
        : 'is-neutral';
  const resultSettlementLabel =
    resultSettlementPending
      ? '配分前収支'
      : resultSettlementSummary.outcome === 'balanced'
      ? '収支均衡'
      : resultSettlementSummary.outcome === 'profit'
        ? isHighEndRaid
          ? '黒字攻略'
          : winner === 'player'
            ? '黒字買収'
            : '黒字撤退'
        : winner === 'player'
          ? isHighEndRaid
            ? '赤字攻略'
            : '赤字買収'
          : '赤字撤退';
  const resultTransactionName = isHighEndRaid ? '攻略' : '買収';
  const resultNavigationCta = winner
    ? getBattleResultCta({
        battleMode: isTraining
          ? 'training'
          : isCruel
            ? 'cruel'
            : isUltimate
              ? 'ultimate'
              : isSavage
                ? 'savage'
                : 'normal',
        winner,
        hasNextCommunity: !!nextCommunity,
        isCityBoss,
        isReacquisition: isExtremeBattle,
      })
    : null;
  const resultFinancialComment = isTraining
    ? '訓練の収支は0ギル。帳簿への影響はなしでっす。'
    : resultSettlementPending
      ? '利益の配分を決めれば、買収収支が確定するでっす。'
      : resultSettlementSummary.outcome === 'balanced'
      ? `${resultTransactionName}収支はきれいに均衡でっす。`
      : winner === 'player'
        ? resultSettlementSummary.outcome === 'profit'
          ? `${resultTransactionName}収支は${formatCurrency(
              Math.abs(resultTransactionDelta)
            )}の黒字を確保したでっす！`
          : `${resultTransactionName}収支は${formatCurrency(
              Math.abs(resultTransactionDelta)
            )}の赤字。次の利益で取り返すでっす。`
        : `今回は${formatCurrency(
            Math.abs(resultTransactionDelta)
          )}の赤字撤退。立て直して再挑戦するでっす。`;
  const resultLiquidationComment =
    resultLiquidationCashback > 0
      ? ` 離脱資産の清算を含めた資金増減は${resultFundsDelta >= 0 ? '+' : '-'}${formatCurrency(
          Math.abs(resultFundsDelta)
        )}でっす。`
      : '';

  const { companyStrengthBefore, companyStrengthAfter } = useMemo(
    () => {
      const rebelledPropertyIds = new Set(
        rebelled.map((property) => property.id)
      );
      const continuingProperties = ownedProperties.filter(
        (property) => !rebelledPropertyIds.has(property.id)
      );
      const growthProperties =
        winner === 'player' &&
        !isTraining &&
        !isHighEndRaid &&
        !ownedProperties.some(
          (property) => property.id === targetProperty.id
        )
          ? [
              ...continuingProperties,
              {
                ...targetProperty,
                owner: 'player' as const,
                ownerName: companyName,
                loyaltyRisk: 0,
              },
            ]
          : continuingProperties;
      return {
        companyStrengthBefore: calculateCompanyStrengthScore(
          totalFunds,
          ownedProperties
        ),
        companyStrengthAfter: calculateCompanyStrengthScore(
          Math.max(0, totalFunds + resultFundsDelta),
          growthProperties
        ),
      };
    },
    [
      companyName,
      isHighEndRaid,
      isTraining,
      ownedProperties,
      rebelled,
      resultFundsDelta,
      targetProperty,
      totalFunds,
      winner,
    ]
  );
  useEffect(() => {
    if (
      battlePhase !== 'result' ||
      winner !== 'player' ||
      isTraining
    ) {
      setCompanyGrowthRevealed(false);
    }
  }, [
    battlePhase,
    isTraining,
    winner,
  ]);

  const resolveVictorySettlement = (
    decision: Exclude<CelebrationDecision, null>
  ) => {
    if (
      celebrationDecisionRef.current ||
      winner !== 'player'
    ) {
      return;
    }
    const option = profitAllocationChoices.find(
      (candidate) => candidate.id === decision
    );
    if (!option) return;
    celebrationDecisionRef.current = decision;
    const { leaving, survivors } = resolvePostVictoryLoyalty(
      battleSubs,
      option.departureProbabilityMultiplier
    );
    setCelebrationDecision(decision);
    setRebelled(leaving);
    setBattleSubs(survivors);
    if (option.rate > 0) {
      soundFx.playCoin();
    } else {
      soundFx.playGaugeTick(0.9);
    }
  };

  const openResultAnalysis = () => {
    if (
      battlePhaseRef.current !== 'finisher_notice' ||
      !winner ||
      finishTelegraphVisible
    ) {
      return;
    }
    changeBattlePhase('result');
  };

  const completeBattleResult = () => {
    if (!winner) return;
    if (resultConfirmedRef.current) return;
    resultConfirmedRef.current = true;
    resultConfirmArmedRef.current = false;
    setResultConfirmArmed(false);
    const committed = onBattleEnd({
      winner,
      targetProperty,
      companyFundsInvested: companyInvested,
      demandFundsInvested: demandInvested,
      brokerageFee,
      settlementCost: resultSettlementCost,
      battleCashDelta: -enemyDrainStolen,
      victoryReward: resultVictoryReward,
      celebrationGiftCost: appliedCelebrationGiftCost,
      celebrationGiftRate,
      rebelledProperties: isTraining ? [] : rebelled,
      survivingRiskUpdates: isTraining
        ? []
        : battleSubs.map(({ id, loyaltyRisk }) => ({
            id,
            loyaltyRisk,
          })),
      finishMethod,
      finalOwnership,
      overkill,
    });
    if (!committed) {
      resultConfirmedRef.current = false;
      resultConfirmArmedRef.current = true;
      setResultConfirmArmed(true);
      soundFx.playWarning();
      const text =
        'セーブ領域へ書き込めませんでした。空き容量・ブラウザ設定を確認して、もう一度結果を確定してください。';
      setStatusText(text);
      addLog(text, 'system');
    }
  };

  const confirmResult = () => {
    if (!winner) return;
    if (
      !canConfirmBattleResult({
        battlePhase: battlePhaseRef.current,
        hasWinner: true,
        armed: resultConfirmArmedRef.current,
        alreadyConfirmed: resultConfirmedRef.current,
      })
    ) {
      return;
    }
    if (celebrationDecisionRequired && !celebrationDecision) {
      soundFx.playWarning();
      return;
    }
    if (rebelled.length > 0) {
      soundFx.playWarning();
      setResultStep('departures');
      return;
    }
    completeBattleResult();
  };

  const confirmDepartureReport = () => {
    if (
      battlePhaseRef.current !== 'result' ||
      resultStep !== 'departures' ||
      !winner
    ) {
      return;
    }
    completeBattleResult();
  };

  const resultAnalysis = isTraining
    ? winner === 'player'
      ? demandInvested > companyInvested
        ? '人脈と協力先をうまく組み合わせ、木人耐久資本を削り切ったでっす！ 訓練中の出資と離反は通常の事業・契約へ残らないでっす。'
        : '自社資金の投入順が安定していたでっす！ 同じLEVELへ何度でも挑み、アビリティやLIMIT BREAKも試せるでっす。'
      : rebelled.length > 0
        ? `${rebelled.length}件が訓練中に一時離脱したでっす。通常の事業・契約は保護されるので、支援の順番を変えて再挑戦するでっす。`
        : '木人の初期耐久資本を削り切れなかったでっす。費用も進行変化もないので、投入順を変えて再挑戦するでっす。'
    : winner === 'player'
      ? finishMethod.startsWith('LIMIT_BREAK')
        ? 'カンパニー網の総動員が勝因でっす！ LIMIT BREAKの一斉出資で、所有率を見事に押し切ったでっす。'
        : demandInvested > companyInvested
          ? `人脈と協力先の連携が勝因でっす！ 合計${formatCurrency(
              demandInvested
            )}の支援が競り値を押し上げたでっす。`
          : `最後まで資金差を維持できたのが勝因でっす！ 競合の防衛を崩し、${FINISH_LABELS[finishMethod]}で押し切ったでっす。`
      : defeatReason === 'WALKING_DEAD_FAILED'
        ? 'リビングデッドは発動したものの、10秒以内に所有率30%へ戻せなかったでっす。次は意気衝天や大口出資を温存しておくでっす。'
        : defeatReason === 'CRUEL_RECKONING_FAILED'
          ? '終極資本査定の終了時に所有率75%へ届かなかったでっす。第一宣告後の資本とLBを温存し、12秒の査定中にまとめて積むでっす。'
        : rebelled.length > 0
          ? isHighEndRaid
            ? `${rebelled.length}件が記録戦中に一時離脱し、支援の山が崩れたでっす。事業・契約は保護されるので、資金要求の順番を組み直すでっす。`
            : `${rebelled.length}件の独立で資金の山が崩れたでっす。次は危険度の高い人脈へ頼る前に、ネマワシや山分けで備えるでっす。`
          : '風と支援を含めた競り値で劣勢となり、所有率を押し戻されたでっす。資金を積む順番から見直すでっす。';

  const briefingSynergies = [
    ...(battleSubs.length + 1 >= 4
? [`ライトパーティ：自社＋人脈${battleSubs.length}件・SYNERGY / 味方追い風でBURST TIME`]
      : []),
    ...(industryInfluence.playerBonus > 0 || industryInfluence.enemyBudgetDiscount > 0
      ? [`${targetProperty.industry} ${industryInfluence.label}：自社押込 +${Math.round(industryInfluence.playerBonus * 100)}% / 敵予算 -${Math.round(industryInfluence.enemyBudgetDiscount * 100)}%`]
      : []),
    ...(regionalInfluence.playerBonus > 0 || regionalInfluence.enemyBudgetDiscount > 0
      ? [`${targetProperty.community} ${regionalInfluence.label}：自社押込 +${Math.round(regionalInfluence.playerBonus * 100)}% / 敵予算 -${Math.round(regionalInfluence.enemyBudgetDiscount * 100)}%`]
      : []),
    ...(liveActiveSynergies.length > 0
      ? [`成立中の事業連携 ${liveActiveSynergies.length}件：受動収益はすべて有効`]
      : []),
    ...(selectedBattleSynergy
      ? [
          `戦闘連携 1枠：${selectedBattleSynergy.name}／${
            selectedBattleSynergy.battleOnly && selectedBattleSynergy.battleEffect
              ? `手動発動・約${formatCurrency(
                  calculateLimitBreakPushGilEquivalent(
                    targetProperty.marketPrice,
                    selectedBattleSynergy.battleEffect.ownershipPush ?? 0
                  )
                )}相当・資本圧力×${selectedBattleSynergy.battleEffect.capitalPressureMultiplier.toFixed(2)}・${Math.round(selectedBattleSynergy.battleEffect.durationMs / 1000)}秒`
              : battleSynergyReady
              ? `${selectedBattleSynergyMembers.length}件で発動可能`
              : '必要な事業・契約が不足'
          }`,
        ]
      : []),
    ...(isSavage || isUltimate || isCruel
      ? [`高難度支援補正：人脈・通常グループSYNERGY ×${HIGH_DIFFICULTY_SUPPORT_MULTIPLIER.toFixed(2)}（外部アライアンス・LBは対象外）`]
      : []),
    ...(tradeNetworkBonus > 0 ? [`都市交易網：自社押込 +${Math.round(tradeNetworkBonus * 100)}%`] : []),
  ];
  const cinematicLayer = getBattleCinematicLayer({
    battlePhase,
    hasBattleAnnouncement: !!battleAnnouncement,
    hasDecisiveBlow: !!decisiveBlow,
    hasWinner: !!winner,
    finishTelegraphVisible,
  });
  const terminalUsesDirectFinisher =
    decisiveBlow?.winner === 'player' ||
    isDirectTerminalCause(terminalRef.current?.cause);
  const terminalUsesSelfCollapse =
    decisiveBlow?.winner === 'player' && !terminalUsesDirectFinisher;
  const displayedLimitBreakTier =
    activeLimitBreakTier || limitBreakTier || 1;
  const announcementEncounterName = isSavage
    ? targetProperty.name.replace(
        /\s*商戦 零式：第([1-4])層$/,
        '：第$1層'
      )
    : targetProperty.name;
  const announcementDutySuffix = isTraining
    ? '訓練開始'
    : isCruel
      ? '酷・もうひとつの商戦'
    : isSavage
      ? '争奪戦・零式'
      : isExtremeBattle
        ? '争奪戦・極'
      : '争奪戦';

  return (
    <div
      ref={rootDialogRef}
      className={`buyout-screen buyout-screen--phase-${battlePhase} buyout-screen--living-${livingDeadPhase} ${presentationPauseActive ? 'buyout-screen--ambient-paused' : ''} ${isTraining ? 'buyout-screen--training' : ''} ${isCruel ? 'buyout-screen--cruel' : ''} ${isExtremeBattle ? 'buyout-screen--extreme' : ''} ${isBossBattle ? `buyout-screen--boss buyout-screen--boss-${bossAbilityTier}` : ''} ${limitImpactActive ? 'buyout-screen--limit-impact' : ''} ${battleAnnouncement === 'limit' || limitImpactActive ? `buyout-screen--limit-tier-${displayedLimitBreakTier}` : ''} ${impactStop ? `buyout-screen--impact-${impactStop.phase} buyout-screen--impact-${impactStop.side} ${impactStop.heavy ? 'buyout-screen--impact-heavy' : ''}` : ''} ${capitalPresentationStage && activeCapitalTiming ? `buyout-screen--capital-commit buyout-screen--capital-${capitalPresentationStage} buyout-screen--capital-${activeCapitalTiming.tier}` : ''} ${skillCinematic ? `buyout-screen--skill-cinematic buyout-screen--skill-stage-${skillCinematic.stage} buyout-screen--skill-${skillCinematic.effectType.toLowerCase().replaceAll('_', '-')}` : ''} ${isBurstTime ? 'buyout-screen--burst' : ''} ${decisiveBlow ? `buyout-screen--decisive buyout-screen--decisive-${decisiveBlow.winner}` : ''} ${terminalCinematicStage ? `buyout-screen--terminal-cinematic buyout-screen--terminal-${terminalCinematicStage}` : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={
        isTraining
          ? `${targetProperty.name}の木人訓練`
          : `${targetProperty.name}との商戦`
      }
      tabIndex={-1}
      style={{ '--battle-time-scale': timeScale } as React.CSSProperties}
    >
      <img
        className="buyout-backdrop"
        src={FANKIT_ART.battleBackdrop}
        alt=""
        aria-hidden="true"
        decoding="async"
      />
      {limitImpactActive && (
        <div
          className={`limit-impact-field limit-impact-field--tier-${displayedLimitBreakTier}`}
          data-limit-tier={displayedLimitBreakTier}
          aria-hidden="true"
        >
          <span /><span /><span />
        </div>
      )}

      {cinematicLayer === 'battle_announcement' && battleAnnouncement && (
        <div
          className={`battle-announcement battle-announcement--${battleAnnouncement}${battleAnnouncement === 'limit' ? ` battle-announcement--limit-tier-${displayedLimitBreakTier}` : ''}`}
          data-limit-tier={battleAnnouncement === 'limit' ? displayedLimitBreakTier : undefined}
          aria-live="assertive"
        >
          <div>
            <small>{battleAnnouncement === 'start' ? isTraining ? 'TRAINING COMMENCED' : 'CONTENT COMMENCED' : `LIMIT BREAK ${activeLimitBreakTier || limitBreakTier}`}</small>
            <strong>
              {battleAnnouncement === 'start' ? (
                <>
                  <span className="battle-announcement__encounter">
                    {announcementEncounterName}
                  </span>
                  <span className="battle-announcement__duty">
                    {announcementDutySuffix}
                  </span>
                </>
              ) : (
                '全人脈・資金総動員'
              )}
            </strong>
            <span>{battleAnnouncement === 'start' ? `START! / ${companyName}` : `${battleSubs.length + 1}件の支援を解放`}</span>
          </div>
        </div>
      )}

      {livingDeadPhase !== 'inactive' && !decisiveBlow && !winner && (
        <div className={`battle-living-dead battle-living-dead--${livingDeadPhase}`} aria-live="assertive">
          <img src={FANKIT_ART.darkKnight} alt="" aria-hidden="true" />
          <div>
            <small>{livingDeadPhase === 'waiting' ? 'DARK KNIGHT ACTION' : livingDeadPhase === 'recovery' ? 'RESURRECTION WINDOW' : 'LIVING DEAD RESULT'}</small>
            <strong>{livingDeadPhase === 'waiting' ? 'LIVING DEAD' : livingDeadPhase === 'recovery' ? 'WALKING DEAD' : livingDeadPhase === 'survived' ? 'UNDEAD REBIRTH' : 'WALKING DEAD FAILED'}</strong>
            <span>{livingDeadPhase === 'waiting'
              ? '致死待機中：所有率0%で1%に踏みとどまる'
              : livingDeadPhase === 'recovery'
                ? `蘇生猶予：所有率30%以上へ回復（現在 ${ownership.toFixed(1)}%）`
                : livingDeadPhase === 'survived'
                  ? '蘇生成功：通常の商戦へ復帰'
                  : '蘇生失敗：所有率30%へ届かなかった'}</span>
            <i><u style={{ width: `${livingDeadProgress}%` }} /></i>
          </div>
          <b>{livingDeadDuration > 0 ? `${(livingDeadRemaining / 1000).toFixed(1)}秒` : livingDeadPhase === 'survived' ? '成功' : '失敗'}</b>
        </div>
      )}

      <header className="buyout-header" inert={backgroundInert}>
        <div>
          <span>{isTraining ? '商戦木人 訓練中' : isCruel ? '酷・闇タタル 攻略中' : isUltimate ? '絶商戦 攻略中' : isSavage ? '商戦 零式 攻略中' : isExtremeBattle ? '離脱企業 再買収・極' : '買収交渉中'}</span>
          <strong className="battle-title-ticker">
            <MarqueeText text={targetProperty.name} />
          </strong>
          <small>
            {battleContextLabel ?? `${targetProperty.community}・${targetProperty.industry}`}
            {battleRegionLabel ? `／${battleRegionLabel}` : ''}
          </small>
        </div>
        <div className="buyout-header__actions">
          <button type="button" onClick={() => setShowHelp(true)} aria-label={isTraining ? '木人訓練の遊び方' : '買収交渉の遊び方'}><CircleHelp /></button>
          {battlePhase === 'briefing' && (
            <button type="button" onClick={requestClose} aria-label={isTraining ? '木人一覧へ戻る' : '買収交渉を閉じる'}><X /></button>
          )}
        </div>
      </header>

      <main className="buyout-main">
        <section
          className={`battle-stage integrated-battlefield integrated-battlefield--push-${battleDirection} integrated-battlefield--motion-${motion} ${conditionAnnouncement ? 'integrated-battlefield--condition-active' : ''} ${impactStop ? `integrated-battlefield--impact-${impactStop.phase} integrated-battlefield--impact-${impactStop.side} ${impactStop.heavy ? 'integrated-battlefield--impact-heavy' : ''}` : ''} ${capitalPresentationStage && activeCapitalTiming ? `integrated-battlefield--capital-commit integrated-battlefield--capital-${capitalPresentationStage} integrated-battlefield--capital-${activeCapitalTiming.tier}` : ''} ${skillCinematic ? `integrated-battlefield--skill-cinematic integrated-battlefield--skill-stage-${skillCinematic.stage} integrated-battlefield--skill-${skillCinematic.effectType.toLowerCase().replaceAll('_', '-')}` : ''} ${windVisible && eraWindActive ? 'integrated-battlefield--era-wind integrated-battlefield--era-wind-3' : ''} ${windVisible && windTelegraphVisible ? 'integrated-battlefield--wind-telegraph' : ''} ${decisiveBlow?.winner === 'player' && terminalUsesDirectFinisher ? 'integrated-battlefield--finisher-player integrated-battlefield--finisher-direct' : decisiveBlow?.winner === 'player' ? 'integrated-battlefield--finisher-collapse' : decisiveBlow?.winner === 'opponent' ? 'integrated-battlefield--finisher-enemy' : ''} ${decisiveBlow?.impacted ? 'integrated-battlefield--finisher-impact' : ''} ${terminalCinematicStage ? `integrated-battlefield--terminal-${terminalCinematicStage} integrated-battlefield--terminal-winner-${terminalRef.current?.winner ?? 'player'} ${terminalUsesSelfCollapse ? 'integrated-battlefield--terminal-self-collapse' : 'integrated-battlefield--terminal-direct'}` : ''} ${winner ? `integrated-battlefield--settled integrated-battlefield--settled-${winner} ${terminalUsesDirectFinisher ? 'integrated-battlefield--settled-direct' : 'integrated-battlefield--settled-collapse'}` : ''} ownership-board--wind-${windSide} ${isSavage ? 'integrated-battlefield--savage' : ''} ${isUltimate ? 'integrated-battlefield--ultimate' : ''} ${isCruel ? 'integrated-battlefield--cruel' : ''} ${enemySupportUsed.has('omnicapitalization') ? 'integrated-battlefield--omnicapitalization' : ''}`}
          aria-label="所有率、両陣営、投入資金、行動予兆の統合商戦フィールド"
          inert={backgroundInert && !conditionAnnouncement && !skillCinematic}
          data-company-invested={companyInvested}
          data-flow-direction={battleDirection}
          data-flow-intensity={ownershipRate > 1.7 ? 'surge' : ownershipRate > 0.65 ? 'fast' : 'calm'}
          style={{
            '--battle-frontline': `${displayedOwnership}%`,
            '--battle-frontline-ratio': displayedOwnership / 100,
            '--field-flow-duration': `${Math.max(.46, 1.9 - Math.min(1, ownershipRate / 4))}s`,
            '--capital-prepare-duration': activeCapitalTiming
              ? `${activeCapitalTiming.prepareMs}ms`
              : undefined,
            '--capital-travel-duration': activeCapitalTiming
              ? `${activeCapitalTiming.travelMs}ms`
              : undefined,
            '--capital-impact-duration': activeCapitalTiming
              ? `${activeCapitalTiming.hitStopMs + activeCapitalTiming.settleMs}ms`
              : undefined,
            '--capital-afterglow-duration': activeCapitalTiming
              ? `${activeCapitalTiming.afterglowMs}ms`
              : undefined,
          } as React.CSSProperties}
        >
        <span className="battlefield-territory" aria-hidden="true">
          <i className="battlefield-territory__player" />
          <i className="battlefield-territory__enemy" />
        </span>
        <div className="battlefield-pressure-lane" aria-hidden="true">
          <i className="battlefield-pressure-lane__player" />
          <i className="battlefield-pressure-lane__enemy" />
          <span className="battlefield-pressure-lane__front"><i /><i /><i /></span>
        </div>
        <span className="battle-commerce-flow" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
        </span>
        {skillCinematic && (
          <>
            <span
              className={`battle-skill-field battle-skill-field--${skillCinematic.effectType.toLowerCase().replaceAll('_', '-')} battle-skill-field--stage-${skillCinematic.stage}`}
              aria-hidden="true"
            >
              {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
            </span>
            <div
              className={`battle-skill-nameplate battle-skill-nameplate--${skillCinematic.targetsRival ? 'enemy' : 'ally'} battle-skill-nameplate--stage-${skillCinematic.stage}`}
              data-action-kind={
                skillCinematic.effectType === 'SYNERGY_PUSH'
                  ? 'synergy'
                  : 'ability'
              }
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <small>
                {skillCinematic.effectType === 'SYNERGY_PUSH'
                  ? 'SYNERGY'
                  : 'ABILITY'}
              </small>
              <strong>
                {skillCinematic.skillName}
              </strong>
              <em>
                {skillCinematic.stage === 'name' ||
                skillCinematic.stage === 'cast'
                  ? '構え'
                  : skillCinematic.resultHeadline}
              </em>
              {skillCinematic.effectSummary && (
                <span
                  className={`battle-skill-nameplate__effect ${
                    skillCinematic.stage === 'name' ||
                    skillCinematic.stage === 'cast'
                      ? 'battle-skill-nameplate__effect--pending'
                      : ''
                  }`}
                  aria-hidden={
                    skillCinematic.stage === 'name' ||
                    skillCinematic.stage === 'cast'
                  }
                >
                  {skillCinematic.effectSummary}
                </span>
              )}
              {skillCinematic.durationLabel && (
                <span
                  className={`battle-skill-nameplate__duration ${
                    skillCinematic.stage === 'name' ||
                    skillCinematic.stage === 'cast'
                      ? 'battle-skill-nameplate__duration--pending'
                      : ''
                  }`}
                  aria-hidden={
                    skillCinematic.stage === 'name' ||
                    skillCinematic.stage === 'cast'
                  }
                >
                  {skillCinematic.durationLabel}
                </span>
              )}
            </div>
          </>
        )}
        {capitalCommit &&
          activeCapitalTiming &&
          (capitalCommit.stage === 'impact' ||
            capitalCommit.stage === 'afterglow') && (
          <div
            key={`${capitalCommit.serial}-${capitalCommit.stage}`}
            className={`capital-commit-cue capital-commit-cue--${capitalCommit.stage} capital-commit-cue--${activeCapitalTiming.tier}`}
            role="status"
            aria-live="polite"
          >
            <strong>{capitalCommitCueText}</strong>
          </div>
        )}
        {conditionAnnouncement && !battleAnnouncement && !terminalCinematicStage && (
          <div
            className={`battle-status-message battle-status-message--${conditionAnnouncement.tone} battle-status-message--kind-${conditionAnnouncement.kind}`}
            data-tone={conditionAnnouncement.tone}
            data-kind={conditionAnnouncement.kind}
            role="status"
            aria-live={conditionAnnouncement.tone === 'enemy' ? 'assertive' : 'polite'}
          >
            <span>{normalizeBattleStatusMessageText(conditionAnnouncement.text)}</span>
          </div>
        )}
        {capitalDropParticleCount > 0 && (
          <span className="battlefield-capital-deluge battlefield-capital-deluge--player" aria-hidden="true">
            {Array.from({ length: capitalDropParticleCount }).map((_, index) => (
              <i
                key={index}
                style={{
                  '--deluge-x': `${8 + (index % 6) * 7.2}%`,
                  '--deluge-drift': `${((index % 3) - 1) * 0.24}rem`,
                  '--deluge-size': `${0.18 + (index % 4) * 0.045}rem`,
                  animationDelay: activeCapitalSnapshot?.compact
                    ? `${(index % 6) * 0.01}s`
                    : `${Math.floor(index / 6) * 0.16 + (index % 6) * 0.025}s`,
                  animationDuration: `${0.76 + (index % 3) * 0.08}s`,
                } as React.CSSProperties}
              />
            ))}
          </span>
        )}
        {(isSavage || isUltimate || isCruel) && (
          <div className={`battlefield-raid-marker ${isCruel ? 'battlefield-raid-marker--cruel' : isUltimate ? 'battlefield-raid-marker--ultimate' : ''}`}>
            {isCruel ? (
              <><b>酷・もうひとつの商戦</b><span>闇タタル</span></>
            ) : isUltimate ? (
              <><b>絶商戦</b><span>最終高難度</span></>
            ) : (
              <>
                <b>零式 {savageSeries}編 {savageLayer}/4層</b>
                <span aria-label={`第${savageLayer}層`}>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <i key={index} className={index + 1 === savageLayer ? 'active' : index + 1 < savageLayer ? 'cleared' : ''} />
                  ))}
                </span>
              </>
            )}
          </div>
        )}
        <section className={`ownership-board battlefield-overview ownership-board--wind-${windSide}`}>
          <div className="ownership-board__labels">
            <b
              className="company-name-compact"
              title={companyName}
              aria-label={`${companyName} 所有率 ${displayedOwnership.toFixed(1)}%`}
            >
              <MarqueeText text={companyName} delayMs={450} />
            </b>
            <span className={gaugeSpeed < -0.02 ? 'push-player' : gaugeSpeed > 0.02 ? 'push-enemy' : ''}>
              {isTraining
                ? gaugeSpeed < -0.02
                  ? '▶ 木人耐久を削り中'
                  : gaugeSpeed > 0.02
                    ? '◀ 木人耐久に押し戻される'
                    : '◆ 訓練資本拮抗'
                : gaugeSpeed < -0.02
                  ? '▶ 買収推進中'
                  : gaugeSpeed > 0.02
                    ? '◀ 競合防衛中'
                    : '◆ 競り値拮抗'}
            </span>
            <b
              className="company-name-compact"
              title={targetProperty.name}
              aria-label={`${targetProperty.name} 所有率 ${(100 - displayedOwnership).toFixed(1)}%`}
            >
              {isBossBattle && (
                <span
                  className={`battle-boss-mark battle-boss-mark--${bossAbilityTier}`}
                  aria-label="ボス"
                  title="ボス"
                >
                  <Crown aria-hidden="true" />
                </span>
              )}
              <MarqueeText text={targetProperty.name} delayMs={900} />
            </b>
          </div>
          <div className="ownership-duel">
            <div
              className={`ownership-track ownership-track--${battleDirection} wind-field--${windSide} ${ownershipTrackImpactActive ? 'ownership-track--impact' : ''}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Number(displayedOwnership.toFixed(1))}
              aria-label={`${companyName}の所有率${displayedOwnership.toFixed(1)}%`}
              style={{ '--flow-duration': `${Math.max(.32, 1.4 - Math.min(1, ownershipRate / 4))}s` } as React.CSSProperties}
            >
              <div className="ownership-track__fills" aria-hidden="true">
                <div className="ownership-track__player" />
                <div className="ownership-track__enemy-flow" />
              </div>
              {windVisible && (
                <div className={`battle-wind-magic ${eraWindActive ? 'battle-wind-magic--era' : ''} ${windTelegraphVisible ? 'battle-wind-magic--telegraph' : ''}`} aria-hidden="true"><i /><i /><i /><i /></div>
              )}
              <div className="ownership-track__tension" />
              <div className="ownership-track__ticks">{Array.from({ length: 9 }).map((_, index) => <i key={index} />)}</div>
              <div className="ownership-track__marker"><i /><i /><i /></div>
            </div>
            <div
              className="ownership-capital-readout"
              aria-label={`投入総額。自社${formatCurrency(displayedPlayerInvested)}、競合${formatCurrency(enemyInvested)}`}
            >
              <strong
                className={
                  capitalPresentationStage === 'impact' ||
                  (
                    !activeCapitalSnapshot &&
                    motion === 'player'
                  )
                    ? 'is-acting'
                    : ''
                }
                data-empty={displayedPlayerInvested <= 0}
              >
                <small>自社投入</small>
                {formatCurrency(displayedPlayerInvested)}
              </strong>
              <span>CAPITAL</span>
              <strong
                className={motion === 'enemy' ? 'is-acting' : ''}
                data-empty={enemyInvested <= 0}
              >
                <small>競合投入</small>
                {formatCurrency(enemyInvested)}
              </strong>
            </div>
            {windVisible && !conditionAnnouncement && (
              <div
                key={`${battleWindState.phase}-${presentedWind.type}-${selectedBattleSynergy?.id ?? 'none'}`}
                className={`battle-wind-sigil battle-wind-sigil--${windSide} ${eraWindActive ? 'battle-wind-sigil--era' : ''} ${windTelegraphVisible ? 'battle-wind-sigil--telegraph' : ''}`}
              >
                <Sparkles />
                <b>{windHudTitle}</b>
                <small>
                  {windTelegraphVisible
                    ? '到来まで'
                    : eraWindActive
                      ? '時流終了まで'
                      : enemyMarketWindActive
                        ? '相場復帰まで'
                        : '静穏まで'}{' '}
                  {windCountdown}秒
                </small>
              </div>
            )}
          </div>
          <p className="battle-status-summary" aria-live="polite">{statusText}</p>
        </section>

        <section className="capital-arena battlefield-capital">
          <div className={`capital-arena__side ${motion === 'player' ? 'is-acting' : motion === 'enemy' || motion === 'rebel' ? 'is-hit' : ''}`}>
            <div
              className="player-capital-stack"
              data-extreme-opponent-scale-ratio={
                isExtremeBattle ? extremeOpponentScaleRatio : undefined
              }
            >
              <div className="capital-visual-row">
                <GilTower
                  amount={displayedPlayerInvested}
                  reserveAmount={cash}
                  marketPrice={targetProperty.marketPrice}
                  side="player"
                  motion={playerCapitalMotion}
                  visualFrameOverride={
                    capitalPreviewStage ?? playerCapitalPilePreviewStage
                  }
                />
                {playerCoverKnightPhase !== 'absent' && (
                  <div
                    className={`cover-knight cover-knight--player cover-knight--${playerCoverKnightPhase}`}
                    aria-label={
                      playerCoverKnightPhase === 'breaking'
                        ? 'パッセを終え、防御を解除するナイト'
                        : 'パッセージ・オブ・アームズを実行中のナイト'
                    }
                  >
                    <img src={FANKIT_ART.paladin} alt="" aria-hidden="true" />
                    <span className="cover-knight__label">
                      {playerCoverKnightPhase === 'breaking'
                        ? 'GUARD BREAK'
                        : 'パッセ'}
                    </span>
                    <span
                      className="cover-knight__guard"
                      role="progressbar"
                      aria-label={`ナイトの防御ゲージ ${playerCoverGuardPercent}%`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={playerCoverGuardPercent}
                    >
                      <i style={{ width: `${playerCoverGuardPercent}%` }} />
                    </span>
                  </div>
                )}
                <div className="ownership-fighter ownership-fighter--player">
                  <img
                    className={`ownership-avatar ownership-avatar--player ${motion === 'player' ? 'avatar-act' : motion === 'enemy' || motion === 'rebel' ? 'avatar-hurt' : ''}`}
                    src={FANKIT_ART.tataru.windUp}
                    alt="タタル"
                  />
                  <div className="battle-status-rail battle-status-rail--player" aria-label="自社の継続効果">
                    {fastHorseRemaining > 0 && (
                      <span role="img" aria-label={`疾風怒濤の計 残り${Math.ceil(fastHorseRemaining / 1000)}秒`} title={`疾風怒濤の計 残り${Math.ceil(fastHorseRemaining / 1000)}秒`}>
                        <Zap /><b>{Math.ceil(fastHorseRemaining / 1000)}</b>
                      </span>
                    )}
                    {playerCoverRemaining > 0 && (
                      <span
                        role="img"
                        aria-label={`パッセージ・オブ・アームズ 残り${Math.ceil(playerCoverRemaining / 1000)}秒`}
                        title={`パッセージ・オブ・アームズ 残り${Math.ceil(playerCoverRemaining / 1000)}秒`}
                      >
                        <ShieldAlert />
                        <b>{Math.ceil(playerCoverRemaining / 1000)}</b>
                      </span>
                    )}
                    {playerBarrierRemaining > 0 && (
                      <span
                        className="battle-status-rail__barrier"
                        role="img"
                        aria-label={`ディヴァインベニゾン 残り${Math.ceil(playerBarrierRemaining / 1000)}秒・障壁${playerBarrierPercent}%`}
                        title={`ディヴァインベニゾン：障壁${playerBarrierPercent}%`}
                      >
                        <ShieldAlert /><b>{playerBarrierPercent}%</b>
                      </span>
                    )}
                    {progressionSynergyRemaining > 0 && selectedBattleSynergy && (
                      <span
                        role="img"
                        aria-label={`${selectedBattleSynergy.name} 残り${Math.ceil(progressionSynergyRemaining / 1000)}秒`}
                        title={`${selectedBattleSynergy.name} 残り${Math.ceil(progressionSynergyRemaining / 1000)}秒`}
                      >
                        <Swords />
                        <b>{Math.ceil(progressionSynergyRemaining / 1000)}</b>
                      </span>
                    )}
                    {(livingDeadPhase === 'waiting' || livingDeadPhase === 'recovery') && (
                      <span role="img" aria-label={`リビングデッド 残り${Math.ceil(livingDeadRemaining / 1000)}秒`} className="battle-status-rail__living" title={`リビングデッド 残り${Math.ceil(livingDeadRemaining / 1000)}秒`}>
                        <ShieldAlert /><b>{Math.ceil(livingDeadRemaining / 1000)}</b>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className={`player-budget-overlay player-budget-overlay--${playerReserveState}`}>
                <small>{isTraining ? '訓練用未投入資金' : '未投入資金'}</small>
                <strong>{formatCurrency(cash)}</strong>
                <span className="battle-budget-meta">
                  <b>残量 {playerReservePercent.toFixed(1)}%・{playerReservePercent <= 0 ? '回復待ち' : playerReservePercent <= 10 ? '枯渇寸前' : '投入可能'}</b>
                  <em>商流リジェネ {playerRecoveryPercent.toFixed(1)}% / 20%</em>
                </span>
              </div>
            </div>
            <small className="capital-effective-detail">
              <span>
                {isExtremeBattle
                  ? `相手企業規模比 ${extremeOpponentScaleRatio}%　`
                  : `積上げ ${displayedPlayerCapitalProgress.toFixed(0)}%　`}
                自社 {formatCurrency(displayedCompanyInvested)} / 支援 {formatCurrency(demandInvested)}
              </span>
              {(windVisible || progressionSynergyRemaining > 0) && <b>補正後 {formatCurrency(displayedEffectivePlayerInvested)}相当（×{(currentWind.playerMultiplier * progressionSynergyMultiplier).toFixed(2)}）</b>}
            </small>
            <div className="capital-source-bar"><i style={{ width: `${displayedPlayerInvested > 0 ? displayedCompanyInvested / displayedPlayerInvested * 100 : 0}%` }} /><span /></div>
          </div>
          <div className="capital-arena__center">
            <div className={`capital-clash capital-clash--${battleDirection}`}><i /><i /><i /></div>
            <b className="capital-vs">VS</b>
            <strong>{capitalPressureLabel}</strong>
          </div>
          <div className={`capital-arena__side ${motion === 'enemy' ? 'is-acting' : motion === 'player' ? 'is-hit' : ''}`}>
            <div className="enemy-capital-stack">
              <div className="capital-visual-row">
                <GilTower
                  amount={enemyInvested}
                  marketPrice={targetProperty.marketPrice}
                  side="enemy"
                  motion={motion}
                  visualFrameOverride={enemyCapitalPilePreviewStage}
                />
                {enemySupportCinematic && (
                  <div
                    key={`${enemySupportCinematic.serial}-${enemySupportCinematic.skillId}`}
                    className={`enemy-support-actor enemy-support-actor--${ENEMY_SUPPORT_ACTOR_CLASS[enemySupportCinematic.skillId]} enemy-support-actor--${enemySupportCinematic.stage}`}
                    aria-label={`${ENEMY_SUPPORT_PRESENTATION[enemySupportCinematic.skillId].jobName}が${ENEMY_SUPPORT_PRESENTATION[enemySupportCinematic.skillId].actionName}を実行中`}
                    style={{
                      '--enemy-support-cast-duration': `${ENEMY_SUPPORT_PRESENTATION[enemySupportCinematic.skillId].castMs}ms`,
                    } as React.CSSProperties}
                  >
                    <img
                      className="enemy-support-actor__portrait"
                      src={
                        ENEMY_SUPPORT_ART[
                          ENEMY_SUPPORT_PRESENTATION[enemySupportCinematic.skillId].artKey
                        ]
                      }
                      alt=""
                      aria-hidden="true"
                    />
                    <span className="enemy-support-actor__name">
                      {enemySupportCinematic.stage === 'telegraph'
                        ? ENEMY_SUPPORT_PRESENTATION[
                            enemySupportCinematic.skillId
                          ].telegraphText
                        : ENEMY_SUPPORT_PRESENTATION[
                            enemySupportCinematic.skillId
                          ].actionName}
                    </span>
                    {enemySupportCinematic.stage === 'telegraph' &&
                      enemySupportTelegraphRemainingMs !== null && (
                        <span
                          className="enemy-support-actor__stun-window"
                          aria-hidden="true"
                        >
                          {enemySupportInterruptibility === 'unstoppable'
                            ? '中断不能'
                            : enemySupportInterruptibility === 'delay_only'
                              ? 'スタンで遅延'
                              : 'スタン可能'}{' '}
                          残
                          {(enemySupportTelegraphRemainingMs / 1000).toFixed(1)}
                          秒
                        </span>
                      )}
                    <span className="enemy-support-actor__castbar" aria-hidden="true">
                      <i className="enemy-support-actor__castbar-fill" />
                    </span>
                  </div>
                )}
                {enemyCoverKnightPhase !== 'absent' && (
                  <div
                    className={`cover-knight cover-knight--enemy cover-knight--${enemyCoverKnightPhase} cover-knight--${enemyActiveCoverTier}`}
                    aria-label={
                      enemyCoverKnightPhase === 'breaking'
                        ? '競合側の防御を突破されたナイト'
                        : `競合側の${
                            enemyActiveCoverTier === 'invincible'
                              ? 'インビンシブル'
                              : enemyActiveCoverTier === 'enhanced_cover'
                                ? 'パッセージ・オブ・アームズ'
                                : 'かばう'
                          }を実行中のナイト`
                    }
                  >
                    <img src={FANKIT_ART.paladin} alt="" aria-hidden="true" />
                    <span className="cover-knight__label">
                      {enemyCoverKnightPhase === 'breaking'
                        ? 'GUARD BREAK'
                        : enemyActiveCoverTier === 'invincible'
                        ? '無敵'
                        : enemyActiveCoverTier === 'enhanced_cover'
                          ? 'パッセ'
                          : 'かばう'}
                    </span>
                    <span
                      className="cover-knight__guard"
                      role="progressbar"
                      aria-label={`競合ナイトの防御ゲージ ${enemyCoverGuardPercent}%`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={enemyCoverGuardPercent}
                    >
                      <i style={{ width: `${enemyCoverGuardPercent}%` }} />
                    </span>
                  </div>
                )}
                <div
                  className={`ownership-fighter ownership-fighter--enemy ${
                    bossEnemyPartyArts.length > 1
                      ? 'ownership-fighter--boss-party'
                      : ''
                  }`}
                  data-party-size={bossEnemyPartyArts.length}
                  role={bossEnemyPartyArts.length > 1 ? 'group' : undefined}
                  aria-label={
                    bossEnemyPartyArts.length > 1
                      ? `競合ボス ${bossEnemyPartyArts.length}人編成`
                      : undefined
                  }
                >
                  {bossEnemyPartyArts.slice(1).map((art, index) => (
                    <img
                      key={art}
                      className={`boss-enemy-party__member boss-enemy-party__member--${index + 1}`}
                      src={art}
                      alt=""
                      aria-hidden="true"
                    />
                  ))}
                  <img
                    className={`ownership-avatar ownership-avatar--enemy ${motion === 'enemy' ? 'avatar-act' : motion === 'player' ? 'avatar-hurt' : ''}`}
                    src={opponentCharacterArt}
                    alt={
                      bossEnemyPartyArts.length > 1
                        ? ''
                        : isTraining
                          ? '商戦訓練用サボテンダー'
                          : '競合代表'
                    }
                  />
                  <div className="battle-status-rail battle-status-rail--enemy" aria-label={isTraining ? '商戦木人への継続効果' : '競合の継続効果'}>
                    {enemyMarketWindActive && (
                      <span
                        role="img"
                        aria-label={`ディヴィネーション 残り${Math.ceil(enemyMarketWindRemaining / 1000)}秒`}
                        title={`ディヴィネーション 残り${Math.ceil(enemyMarketWindRemaining / 1000)}秒`}
                      >
                        <Sparkles />
                        <b>{Math.ceil(enemyMarketWindRemaining / 1000)}</b>
                      </span>
                    )}
                    {enemyRapidAssaultRemaining > 0 && (
                      <span
                        role="img"
                        aria-label={`疾風怒濤の陣 残り${Math.ceil(enemyRapidAssaultRemaining / 1000)}秒`}
                        title={`疾風怒濤の陣 残り${Math.ceil(enemyRapidAssaultRemaining / 1000)}秒`}
                      >
                        <Zap />
                        <b>{Math.ceil(enemyRapidAssaultRemaining / 1000)}</b>
                      </span>
                    )}
                    {enemyCoverRemaining > 0 && (
                      <span
                        role="img"
                        aria-label={`${enemyActiveCoverTier === 'invincible' ? 'インビンシブル' : enemyActiveCoverTier === 'enhanced_cover' ? 'パッセージ・オブ・アームズ' : 'かばう'} 残り${Math.ceil(enemyCoverRemaining / 1000)}秒`}
                        title={`${enemyActiveCoverTier === 'invincible' ? 'インビンシブル' : enemyActiveCoverTier === 'enhanced_cover' ? 'パッセージ・オブ・アームズ' : 'かばう'} 残り${Math.ceil(enemyCoverRemaining / 1000)}秒`}
                      >
                        <ShieldAlert /><b>{Math.ceil(enemyCoverRemaining / 1000)}</b>
                      </span>
                    )}
                    {enemyBarrierRemaining > 0 && (
                      <span
                        className="battle-status-rail__barrier"
                        role="img"
                        aria-label={`ディヴァインベニゾン 残り${Math.ceil(enemyBarrierRemaining / 1000)}秒・障壁${enemyBarrierPercent}%`}
                        title={`ディヴァインベニゾン：障壁${enemyBarrierPercent}%`}
                      >
                        <ShieldAlert /><b>{enemyBarrierPercent}%</b>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className={`enemy-budget-overlay enemy-budget-overlay--${enemyReserveState}`}>
                <small>{isTraining ? '木人保留資金' : '追加防衛枠'}</small>
                <strong>{formatCurrency(enemyReserve)}</strong>
                <span className="battle-budget-meta">
                  <b>{isTraining ? 'AI出資なし' : `残量 ${enemyReservePercent.toFixed(1)}%・${!enemyCanCommit ? '回復待ち' : enemyReservePercent <= 10 ? '枯渇寸前' : '追加投入余力'}`}</b>
                  <em>商流リジェネ {enemyRecoveryPercent.toFixed(1)}% / 20%</em>
                </span>
              </div>
            </div>
            <small className="capital-effective-detail">
              <span>{isTraining ? `木人耐久 ${enemyCapitalProgress.toFixed(0)}%　追加防衛なし` : `積上げ ${enemyCapitalProgress.toFixed(0)}%　追加防衛枠 ${formatCurrency(enemyReserve)}`}</span>
              {windVisible && <b>風反映後 {formatCurrency(effectiveEnemyInvested)}相当（×{enemyCapitalMultiplier.toFixed(2)}）</b>}
            </small>
            <div className="enemy-reserve-bar"><i style={{ width: `${enemyReservePercent}%` }} /></div>
          </div>
        </section>
        {(enemySupportCinematic?.skillId === 'omnicapitalization' ||
          enemySupportCinematic?.skillId === 'cruel_reckoning') &&
          !skillCinematic && (
            <div
              className={`cruel-omnicapitalization-card cruel-omnicapitalization-card--${enemySupportCinematic.stage}`}
              role="alert"
              aria-live="assertive"
              style={{
                '--cruel-telegraph-duration': `${ENEMY_SUPPORT_PRESENTATION[enemySupportCinematic.skillId].telegraphMs}ms`,
              } as React.CSSProperties}
            >
              <small>CRUEL ENEMY ACTION</small>
              <strong>{ENEMY_SUPPORT_PRESENTATION[enemySupportCinematic.skillId].actionName}</strong>
              {enemySupportCinematic.skillId === 'omnicapitalization' ? (
                <>
                  <span>「神も、星も、英雄も……帳簿の上では、ただの数字でっす！」</span>
                  <span>「積んだものは残すでっす。10%から、もう一度見せるでっす！」</span>
                  <em>所有率10%へ・資本／資金／LB維持</em>
                  <b>中断不能フェーズ技 / カウント中も行動可能</b>
                </>
              ) : (
                <>
                  <span>「その盛り返し、本当に価値があるか査定するでっす！」</span>
                  <span>「75%まで積めば、この帳簿を破れるでっす！」</span>
                  <em>75%以上で完全突破 / 未達は攻略失敗</em>
                  <b>中断不能フェーズ技 / カウント中も行動可能</b>
                </>
              )}
              <i aria-hidden="true"><u /></i>
            </div>
          )}
        <div className="battle-flying-texts" aria-live="polite" aria-atomic="false">
          {floaters.map((item, index) => (
            <i
              key={item.id}
              className={`gil-floater gil-floater--${item.side} gil-floater--${item.tone} gil-floater--${item.kind}`}
              style={{ '--floater-index': index } as React.CSSProperties}
            >
              {item.text}
            </i>
          ))}
        </div>

        <section className="active-time battlefield-timing" aria-label="行動準備ゲージ">
          <div
            className={`recast-meter recast-meter--player ${commandReady ? 'is-ready' : ''}`}
            role="progressbar"
            aria-label="自社の次回行動準備"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(commandProgress)}
            aria-valuetext={commandReady ? '行動可能' : `準備 ${Math.round(commandProgress)}%`}
          >
            <i><u style={{ width: `${commandProgress}%` }} /></i>
          </div>
          {!isTraining && (
            <div
              className={`recast-meter recast-meter--enemy ${aiProgress >= 72 ? 'is-danger' : ''} ${!enemyCanCommit ? 'is-short' : ''}`}
              role="progressbar"
              aria-label="競合の次回行動予兆"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={!enemyCanCommit ? 0 : Math.round(aiProgress)}
              aria-valuetext={!enemyCanCommit ? `商流リジェネ待ち・次回防衛${formatCurrency(enemyMinimumCommitment)}` : `${aiText}・準備 ${Math.round(aiProgress)}%`}
              title={!enemyCanCommit ? `商流リジェネ待ち・${formatCurrency(enemyMinimumCommitment)}以上で防衛再開` : aiText}
            >
              <i><u style={{ width: `${!enemyCanCommit ? 0 : aiProgress}%` }} /></i>
            </div>
          )}
        </section>
        </section>

        <section
          className="battle-action-strip"
          aria-label="LIMIT BREAK、SYNERGY、アビリティ、人脈"
          inert={panel !== 'capital' || showHelp || showLog || decisiveLocked}
        >
          {stunOpportunity && stunSkill && (
            <button
              type="button"
              className={`battle-action-strip__action battle-action-strip__action--skill-execute battle-action-strip__action--stun ${stunQuickUnavailable ? 'is-unavailable' : 'is-ready'}`}
              onClick={useReactionStun}
              disabled={stunQuickUnavailable || actionsLocked}
              aria-label={`スタンで競合の予告行動を中断。${enemySupportInterruptibility === 'unstoppable' ? 'この行動は中断不能' : '今すぐ発動可能。自社リキャストタイムを消費しない'}`}
              title="予告中だけ使える即応スタン（通常行動のリキャストタイムは消費しません）"
            >
              <Zap />
              <span>
                <b>STUN CHANCE</b>
                <small>{enemySupportCinematic?.stage === 'telegraph'
                  ? ENEMY_SUPPORT_PRESENTATION[enemySupportCinematic.skillId].actionName
                  : '追加防衛の予告'}</small>
              </span>
              <em>{enemySupportInterruptibility === 'unstoppable'
                ? '中断不能'
                : '今すぐ発動'}</em>
            </button>
          )}
          {limitBreakCapacityTier > 0 && (
            <button
              type="button"
              className={`battle-action-strip__action battle-action-strip__action--lb ${limitBreakGaugeFull ? 'is-overflowing' : ''} ${limitBreakTier > 0 && commandReady && !actionsLocked ? 'is-ready' : 'is-waiting'}`}
              onClick={demandFromAllies}
              disabled={!commandReady || limitBreakTier === 0 || actionsLocked}
              aria-label={`LIMIT BREAK ${limitBreakTier > 0 ? `${limitBreakTier}発動可能` : '蓄積中'}。ゲージ${Math.floor(visibleLimitBreakCharge)}／${limitBreakChargeCapacity}。発動時は全消費`}
              title={`発動すると蓄積したLBゲージをすべて消費します（押し込みは最大約${formatCurrency(limitBreakCapEquivalent)}相当）`}
            >
              {limitBreakGaugeFull && (
                <span className="battle-action-strip__overflow" aria-hidden="true"><i /><i /><i /><i /></span>
              )}
              <img
                className="battle-action-strip__fankit-icon"
                src={FANKIT_ART.commerceIcons[0]}
                alt=""
                aria-hidden="true"
              />
              <span>
                <b>{limitBreakTier > 0 ? `LB ${limitBreakTier}` : 'LB'}</b>
                <small>{limitBreakTier > 0
                  ? actionsLocked
                    ? '演出待ち'
                    : commandReady
                      ? `約${formatCurrency(limitBreakApproximateAmount)}`
                      : '準備中'
                  : `${Math.floor(visibleLimitBreakCharge)}/${limitBreakChargeCapacity}`}</small>
              </span>
              <span
                className="battle-action-strip__lb-bars"
                aria-hidden="true"
              >
                {Array.from({ length: limitBreakCapacityTier }).map((_, index) => {
                  const segmentCharge = Math.max(
                    0,
                    Math.min(
                      LIMIT_BREAK_CHARGE_PER_BAR,
                      visibleLimitBreakCharge - index * LIMIT_BREAK_CHARGE_PER_BAR
                    )
                  );
                  return <i key={index}><u style={{ width: `${segmentCharge}%` }} /></i>;
                })}
              </span>
              <em>{actionsLocked
                ? '演出待ち'
                : !commandReady
                  ? '準備中'
                  : limitBreakTier > 0
                    ? '発動可'
                    : '蓄積中'}</em>
            </button>
          )}

          {selectedBattleSynergy && (
            <button
              type="button"
              className={`battle-action-strip__action battle-action-strip__action--synergy ${battleSynergyReady && commandReady && !actionsLocked && !usedProgressionSynergyIds.has(selectedBattleSynergy.id) ? 'is-ready' : 'is-waiting'}`}
              onClick={() =>
                selectedBattleSynergy.battleOnly
                  ? activateProgressionBattleSynergy(selectedBattleSynergy)
                  : demandFromGroup(
                      selectedBattleSynergy.name,
                      selectedBattleSynergyMembers,
                      selectedBattleSynergy.battleGroupMultiplier ??
                        BATTLE_SUPPORT_BALANCE.synergyDefaultMultiplier
                    )
              }
              disabled={
                !commandReady ||
                !battleSynergyReady ||
                actionsLocked ||
                (
                  selectedBattleSynergy.battleOnly &&
                  usedProgressionSynergyIds.has(selectedBattleSynergy.id)
                )
              }
              aria-label={`${selectedBattleSynergy.name}（SYNERGY）。効果 ${selectedBattleSynergyEffectLabel}。${battleSynergyReady ? '選択中の事業連携を発動' : '必要な事業・契約が不足'}`}
              title={`${selectedBattleSynergy.name}：${selectedBattleSynergyEffectLabel}`}
            >
              <img
                className="battle-action-strip__fankit-icon"
                src={getFankitCommerceIcon(selectedBattleSynergy.name)}
                alt=""
                aria-hidden="true"
              />
              <span>
                <b><MarqueeText text={selectedBattleSynergy.name} /></b>
                <small>{selectedBattleSynergyEffectLabel}</small>
              </span>
              <em>{selectedBattleSynergy.battleOnly &&
                usedProgressionSynergyIds.has(selectedBattleSynergy.id)
                ? '使用済み'
                : !battleSynergyReady
                ? '連携崩壊'
                : actionsLocked
                  ? '演出待ち'
                  : commandReady
                  ? '発動可'
                  : '準備中'}</em>
            </button>
          )}

          {primarySkill && (
            <button
              type="button"
              className="battle-action-strip__action battle-action-strip__action--skill-select"
              onClick={cycleSkillSelection}
              disabled={skillSelectionLocked}
              aria-label={
                battleSkillPool.length > 1
                  ? `アビリティ変更ボタン。選択中は${primarySkill.name}。押すたび次のアビリティへ変更${usingSkillFallback ? '。未装備のため今回だけ臨時選択' : ''}`
                  : `アビリティ選択。選択中は${primarySkill.name}。変更候補なし${usingSkillFallback ? '。未装備のため今回だけ臨時選択' : ''}`
              }
              title={
                battleSkillPool.length > 1
                  ? `アビリティを変更（選択中：${primarySkill.name}）／${getQuickSkillSummary(primarySkill, isTraining)}`
                  : `選択中：${primarySkill.name}（変更候補なし）`
              }
            >
              <RefreshCw />
              <span>
                <b>{battleSkillPool.length > 1 ? '① アビリティ切替' : '① 選択中'}</b>
                <small>
                  <MarqueeText
                    text={`${usingSkillFallback ? '今回だけ：' : '選択中：'}${primarySkill.name}`}
                  />
                </small>
              </span>
              <span
                className="battle-action-strip__skill-steps"
                aria-hidden="true"
              >
                {battleSkillPool.map((skill) => (
                  <i
                    key={skill.id}
                    className={skill.id === primarySkill.id ? 'is-selected' : ''}
                  />
                ))}
              </span>
            </button>
          )}

          {primarySkill && (
            <button
              type="button"
              className={`battle-action-strip__action battle-action-strip__action--skill-execute ${primarySkill.effectType === 'LIVING_DEAD' ? 'is-living-dead' : ''} ${primarySkillExecutionBlocked || primarySkillActionLocked ? 'is-unavailable' : 'is-ready'}`}
              onClick={() => useSkill(primarySkill)}
              disabled={primarySkillExecutionBlocked || primarySkillActionLocked}
              aria-label={`選択中のアビリティを発動するボタン。${primarySkill.name}。${displayedPrimarySkillStateText}${usingSkillFallback ? '。今回だけ臨時使用' : ''}`}
              title={`選択中の${primarySkill.name}を発動／${getQuickSkillSummary(primarySkill, isTraining)}`}
            >
              {primarySkill.effectType === 'LIVING_DEAD' ? <ShieldAlert /> : <Zap />}
              <span>
                <b>② アビリティ発動</b>
                <small><MarqueeText text={primarySkill.name} /></small>
              </span>
              <em>{displayedPrimarySkillStateText}</em>
            </button>
          )}

          <button
            type="button"
            className={`battle-action-strip__action battle-action-strip__action--drawer ${panel === 'funds' ? 'active' : ''}`}
            onClick={() => setPanel('funds')}
            disabled={!commandReady || actionsLocked}
            aria-label={`人脈。${commandReady ? '仲間へ支援要請可能' : '自社コマンドの準備中'}`}
          >
            <Building2 />
            <span>
              <b>人脈</b>
              <small>{commandReady ? `仲間${battleSubs.length}件＋協力` : '準備中'}</small>
            </span>
            <em>{actionsLocked ? '演出待ち' : commandReady ? '選択可' : '準備中'}</em>
          </button>
        </section>

        <section className="command-deck command-deck--compact" inert={backgroundInert}>
          <div className="command-panel command-panel--capital">
            <div className="investment-controls">
              <button
                type="button"
                className="investment-level-button"
                onClick={() => cycleInvestmentLevel()}
                disabled={!maxAffordableConfig || actionsLocked}
                aria-label={`投資レベル変更。現在 ${selectedInvestmentConfig.label} ${formatCurrency(selectedCost)}。押すと次のレベル`}
                aria-describedby="investment-control-help"
                data-investment-level={selectedLevel}
                data-investment-cost={selectedCost}
              >
                <span>
                  <small>投資レベル</small>
                  <b>{selectedInvestmentConfig.label}</b>
                  <strong>{formatCurrency(selectedCost)}</strong>
                </span>
                <span className="investment-level-button__steps" aria-hidden="true">
                  {INVESTMENT_LEVELS.map((item) => {
                    const cost = getInvestmentCost(targetProperty.marketPrice, item.level);
                    return (
                      <i
                        key={item.level}
                        className={`${selectedLevel === item.level ? 'is-selected' : ''} ${cost > cash ? 'is-locked' : ''}`}
                      />
                    );
                  })}
                </span>
              </button>

              <button
                type="button"
                className={`investment-execute-button ${canConfirmInvestment ? 'is-ready' : 'is-recharging'}`}
                onClick={investCompanyFunds}
                disabled={!canConfirmInvestment}
                aria-label={`投資実行。${selectedInvestmentConfig.label} ${formatCurrency(selectedCost)}を1回投入`}
                data-investment-level={selectedLevel}
                data-investment-cost={selectedCost}
                data-command-ready={commandReady}
              >
                <span
                  className="investment-execute-button__charge"
                  style={{ width: `${commandProgress}%` }}
                  aria-hidden="true"
                />
                <HandCoins />
                <span>
                  <b>投資実行</b>
                  <small>{!maxAffordableConfig
                    ? '資金不足'
                    : commandReady
                      ? formatCurrency(selectedCost)
                      : '準備中'}</small>
                </span>
              </button>
            </div>
            <p id="investment-control-help" className={maxAffordableConfig && maxAffordableConfig.level < 5 ? 'investment-auto-note' : ''}>
              {maxAffordableConfig && maxAffordableConfig.level < 5
                ? `残高に合わせ「${maxAffordableConfig.label}」まで選択できます`
                : '左で5段階を切替／右で1回投入'}
            </p>
          </div>
        </section>

        {panel === 'funds' && (
          <div className="battle-drawer-shell" role="presentation">
            <button type="button" className="battle-drawer-backdrop" onClick={() => setPanel('capital')} aria-label="人脈を閉じる" />
            <section ref={fundsDrawerRef} className="battle-drawer" role="dialog" aria-modal="true" aria-label="人脈" tabIndex={-1}>
              <header>
                <span><Building2 /><b>人脈</b><small>第{networkRequestCount + 1}波 ×{getRepeatedNetworkSupportMultiplier(networkRequestCount).toFixed(2)}・選択中は停止</small></span>
                <button type="button" data-modal-close onClick={() => setPanel('capital')} aria-label="人脈を閉じる"><X /></button>
              </header>
              {windVisible && (
                <div className={`command-wind-context command-wind-context--${windSide}`}>
                  <span><Sparkles /><b>{windTitle}</b><em>{windDetail}</em></span>
                  <small>戦術選択中は風も停止。静穏まで{windCountdown}秒。</small>
                </div>
              )}
              <div className="command-panel command-panel--funds">
              {alliance.active && (
                <button type="button" className="alliance-fund" onClick={requestAlliance} disabled={!commandReady || allianceUsed || actionsLocked}>
                  <Users /><span>{alliancePublicPatronage ? '公的後援' : '協力協定'}：{alliance.allyName}</span><b>{allianceUsed ? '要請済み' : `+${formatCurrency(allianceSupport)}相当`}</b>
                </button>
              )}

              <div className="property-funds">
                {sortedBattleSubs.map((property) => {
                  const risk = riskPresentation(property.loyaltyRisk);
                  return (
                    <button type="button" key={property.id} onClick={() => demandFromProperty(property)} disabled={!commandReady || actionsLocked}>
                      <span><b>{property.name}</b><small>個別要求 {subRequestCounts[property.id] || 0}回・人脈全体 {networkRequestCount}回</small></span>
                      <em className={risk.className}>
                        {getReacquisitionLevel(property) > 0 &&
                          `復帰強化${getReacquisitionLevel(property)}・`}
                        {risk.label} {property.loyaltyRisk}%
                      </em>
                      <strong>
                        +{formatCurrency(getBattleSupportAmount(property))}
                      </strong>
                    </button>
                  );
                })}
              </div>
              {battleSubs.length === 0 && <p className="empty-funds">資金を要求できる人脈がありません。</p>}
              </div>
            </section>
          </div>
        )}

      </main>

      <footer className={`buyout-footer ${winner ? 'buyout-footer--settled' : ''}`} inert={footerInert}>
        {winner ? (
          <>
            <span>{isTraining
              ? winner === 'player'
                ? `TRAINING COMPLETE / 木人耐久突破 ${finalOwnership.toFixed(1)}%`
                : 'TRAINING ENDED / セーブ反映なし'
              : winner === 'player'
                ? `${FINISH_LABELS[finishMethod]} / 所有率 ${finalOwnership.toFixed(1)}%`
                : defeatReason === 'WALKING_DEAD_FAILED'
                  ? 'WALKING DEAD FAILED / 蘇生失敗'
                  : defeatReason === 'CRUEL_RECKONING_FAILED'
                    ? 'RECKONING FAILED / 終極資本査定 未達'
                    : 'CAPITAL COLLAPSE / 買収失敗'}</span>
            <button type="button" className="battle-next-button" onClick={openResultAnalysis} disabled={finishTelegraphVisible}>
              {finishTelegraphVisible ? '演出中' : '分析へ →'}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setShowLog(true)}><ScrollText />戦局ログ</button>
            <span title={logs[0]?.text}>{logs[0]?.text}</span>
            <button
              type="button"
              onClick={() =>
                finishBattle(
                  'opponent',
                  'NORMAL',
                  ownership,
                  false,
                  'CAPITAL_COLLAPSE',
                  'withdrawal'
                )
              }
            >
              {isTraining ? '訓練を終了' : '撤退'}
            </button>
          </>
        )}
      </footer>

      {battlePhase === 'briefing' && (
        <div className="buyout-overlay buyout-briefing-overlay">
          <article
            ref={phaseDialogRef}
            className="buyout-dialog buyout-briefing"
            role="dialog"
            aria-modal="true"
            aria-label={
              isTraining
                ? `${targetProperty.name}の訓練準備`
                : `${targetProperty.name}との交渉準備`
            }
            tabIndex={-1}
          >
            <header><Swords /><strong>{isTraining ? 'TRAINING DUMMY DUTY' : isCruel ? 'CRUEL TRADE DUTY' : isUltimate ? 'ULTIMATE TRADE DUTY' : isSavage ? 'SAVAGE TRADE RAID' : isExtremeBattle ? 'EXTREME REACQUISITION' : '買収交渉'}</strong></header>
            <div className="briefing-versus">
              <b className="company-name-full" title={companyName}>{companyName}</b>
              <span>VS</span>
              <b className="company-name-full" title={targetProperty.name}>{targetProperty.name}</b>
            </div>
            <dl className="briefing-facts briefing-facts--summary">
              <div>
                <dt>{isTraining ? '木人耐久資本' : '現在相場'}</dt>
                <dd>{formatCurrency(targetProperty.marketPrice)}</dd>
              </div>
              <div>
                <dt>{isTraining ? '参加費' : '仲介手数料'}</dt>
                <dd>{formatCurrency(brokerageFee)}</dd>
              </div>
              <div>
                <dt>{isTraining ? '訓練用持込資金' : '自社持込資金'}</dt>
                <dd>{formatCurrency(initialBattleCashRef.current)}</dd>
              </div>
            </dl>
            <details className="briefing-advanced-details">
              <summary>
                <ScrollText />
                <span>戦力差・競合詳細を見る</span>
                <b>{battleReadiness.symbol}{battleReadiness.label}</b>
              </summary>
              <div className="briefing-advanced-details__body">
                <StrengthComparison result={battleReadiness} isTraining={isTraining} />
                <dl className="briefing-facts">
              <div>
                <dt>{isTraining ? '訓練区分' : isHighEndRaid ? '競合連合・対象地域' : '対象都市・業界'}</dt>
                <dd>
                  {battleContextLabel ?? (isTraining ? '商戦訓練所・木人訓練' : `${targetProperty.community}・${targetProperty.industry}`)}
                  {battleRegionLabel ? <small>{battleRegionLabel}</small> : null}
                </dd>
              </div>
              <div><dt>{isTraining ? '木人耐久資本' : '現在相場'}</dt><dd>{formatCurrency(targetProperty.marketPrice)}</dd></div>
              <div><dt>{isTraining ? '参加費' : '仲介手数料'}</dt><dd>{formatCurrency(brokerageFee)}</dd></div>
              <div>
                <dt>{isTraining ? '訓練用持込資金' : '自社現金持込枠'}</dt>
                <dd>
                  {formatCurrency(initialBattleCashRef.current)}
                  <small>
                    {isTraining
                      ? '現在資金を訓練内だけで使用'
                      : `上限は対象相場と同額・余剰${formatCurrency(Math.max(0, availableBattleCash - initialBattleCashRef.current))}は商会に留保`}
                  </small>
                </dd>
              </div>
              <div>
                <dt>{isTraining ? '初期防衛資本' : '競合想定予算'}</dt>
                <dd>
                  {formatCurrency(enemyBudget)}
                  <small>{isTraining ? `開幕 ${formatCurrency(enemyBudget)}／追加防衛 0 ギル` : `開幕 ${formatCurrency(battleReadiness.enemyOpeningCapital)}／追加防衛 ${formatCurrency(battleReadiness.enemyReserveCapital)}`}</small>
                </dd>
              </div>
              <div><dt>{isTraining ? '木人行動' : '競合戦術'}</dt><dd>{isTraining ? '追加防衛・敵AI行動なし' : `${isCruel ? '酷商戦' : isUltimate ? '絶商戦' : isSavage ? '零式レイド' : isExtremeBattle ? '極' : 'AI'} LEVEL ${enemyDifficultyLevel}`}</dd></div>
              <div><dt>{isTraining ? '訓練用出資の精算' : '自社直接出資の確定損'}</dt><dd>{isTraining ? 'なし（セーブ資金差引 0）' : '勝利35%／敗北・撤退75%'}</dd></div>
              <div><dt>LBゲージ</dt><dd>{limitBreakCapacityTier === 0 ? '未解放（自社＋人脈が合計4枠で解放）' : isTraining ? `${Math.floor(visibleLimitBreakCharge)}/${limitBreakChargeCapacity}（訓練専用・終了時に破棄）` : `${Math.floor(visibleLimitBreakCharge)}/${limitBreakChargeCapacity}（最大${limitBreakCapacityTier}本・次戦へ継承）`}</dd></div>
                </dl>
                <section className="briefing-section">
              <h3><Sparkles />今回の事業連携・戦闘連携</h3>
              {briefingSynergies.length > 0
                ? <ul>{briefingSynergies.map((effect) => <li key={effect}>{effect}</li>)}</ul>
                : <p>今回発動するSYNERGYはありません。</p>}
              {usingSkillFallback && primarySkill && (
                <p className="briefing-skill-fallback">
                  {equippedSkills.length === 0
                    ? `アビリティが未装備のため、修得済みの「${primarySkill.name}」を今回だけ臨時選択しました。`
                    : `装備中のアビリティは今回使用できないため、「${primarySkill.name}」を今回だけ臨時選択しました。`}
                  商戦中は「変更」で候補を選び、「発動」で効果を実行します。
                </p>
              )}
              {(openingAutoSkill || criticalAutoSkill) && (
                <p className="briefing-skill-fallback">
                  自動専用：
                  {openingAutoSkill
                    ? `開幕「${openingAutoSkill.name}」`
                    : '開幕なし'}
                  {' / '}
                  {criticalAutoSkill
                    ? `瀕死「${criticalAutoSkill.name}」`
                    : '瀕死なし'}
                  。設定中の技は通常の手動選択には表示されません。
                </p>
              )}
              {battleSkillPool.length === 0 && (
                <p className="briefing-skill-fallback">
                  {autoSkillIds.size > 0
                    ? '手動発動できるアビリティはありません。自動アビリティと資金投入・人脈で商戦を進めます。'
                    : '今回使用できるアビリティはありません。資金投入と人脈で商戦を進めます。'}
                </p>
              )}
                </section>
                <section className="briefing-section">
              <h3><Users />外部協力・公的後援</h3>
              <p>{alliance.active
                ? alliancePublicPatronage
                  ? `公的後援：${alliance.allyName}／通商支援1回 +${formatCurrency(allianceSupport)}相当（所有・LB参加件数には不算入）`
                  : `協力協定：${alliance.allyName}／協力支援1回 +${formatCurrency(allianceSupport)}`
                : '今回利用できる外部協力・公的後援はありません。'}</p>
                </section>
                {isProtectedBattle && (
                  <section className="briefing-section briefing-savage">
                <h3><Swords />{isTraining ? '商戦木人ルール' : isCruel ? '酷・記録戦ルール' : isUltimate ? '絶商戦ルール' : '零式ルール'}</h3>
                <p>{isTraining ? '参加費・報酬・精算・清算はすべて0。通常事業・契約の保有状態、独立危険度、零式・絶の進行は変化せず、同じLEVELへ何度でも再挑戦できます。' : isCruel ? '絶踏破後の単独記録戦です。通常事業・人脈・独立危険度・通常進行は保護され、敗北・撤退後も何度でも再挑戦できます。' : '通常編の地域・業界・交易網補正は無効。通常事業・契約の保有状態・収益・独立危険度は変化せず、失敗後も同じ戦いへ再挑戦できます。'}</p>
                {!isTraining && <p>人脈・通常グループSYNERGYの支援額は高難度補正で×{HIGH_DIFFICULTY_SUPPORT_MULTIPLIER.toFixed(2)}。外部アライアンスとLIMIT BREAKの威力は変わりません。</p>}
                {isCruel && <p>開始約15秒後の第一宣告は所有率を10%へ下げますが、投入済み資本・資金・LBは残ります。50%まで盛り返すと第二査定が始まり、75%以上なら完全突破、未達は余韻の後に攻略失敗となります。二つの宣告は中断不能ですが、カウント中も通常行動は使えます。</p>}
                  </section>
                )}
                <section className="briefing-section">
              <h3><ShieldAlert />勝敗条件</h3>
              <p>{isTraining ? '木人は全耐久資本を開幕に配置します。所有率100%まで押し切ると訓練成功です。木人側に押されても自社1%で踏みとどまり、任意に訓練を終了できます。' : '未投入資金や追加防衛枠が残っていても、所有率0%になった側は敗北します。'}</p>
              {!isTraining && <p>勝敗は所有率100%への到達だけで決まります。追加防衛枠が0でも停止せず、商流リジェネと継続圧力を含めて攻防が続きます。</p>}
              {battleSkillPool.some((skill) => skill.effectType === 'LIVING_DEAD') && (
                <p className="briefing-living-dead">例外：リビングデッド待機中は1%で踏みとどまり、10秒以内に正規化所有率30%へ戻せば続行できます。</p>
              )}
                </section>
              </div>
            </details>
            <button type="button" className="dialog-close briefing-start" onClick={startBattle}>
              {isTraining
                ? '木人訓練を開始'
                : isCruel
                  ? `酷・もうひとつの商戦を開始（${battleReadiness.symbol}${battleReadiness.label}）`
                : isUltimate
                ? `絶商戦を開始（${battleReadiness.symbol}${battleReadiness.label}）`
                : isSavage
                  ? `零式レイド開始（${battleReadiness.symbol}${battleReadiness.label}）`
                  : isExtremeBattle
                    ? `再買収・極を開始（${battleReadiness.symbol}${battleReadiness.label}）`
                  : `この条件で争奪戦開始（${battleReadiness.symbol}${battleReadiness.label}）`}
            </button>
            <button type="button" className="dialog-close briefing-cancel" onClick={requestClose}>
              {isTraining ? '木人一覧へ戻る' : '今回は交渉を見送る'}
            </button>
          </article>
        </div>
      )}

      {cinematicLayer === 'finish' && winner && finishTelegraphVisible && (
        <div className={`battle-terminal-resolution battle-terminal-resolution--${winner}`} aria-live="assertive">
          <div>
            <small>
              {isTraining
                ? winner === 'player'
                  ? 'TRAINING COMPLETE'
                  : 'TRAINING ENDED'
                : winner === 'player'
                  ? terminalUsesSelfCollapse
                    ? 'CAPITAL COLLAPSE'
                    : 'DEAL CLOSED'
                  : 'DEAL LOST'}
            </small>
            <strong>
              {isTraining
                ? winner === 'player'
                  ? 'COMPLETE'
                  : 'ENDED'
                : winner === 'player'
                  ? 'WIN'
                  : 'LOSE'}
            </strong>
            <span>{isTraining
              ? winner === 'player'
                ? terminalUsesSelfCollapse
                  ? '積み上がった資本で木人を押し切った'
                  : '最後の一手で木人耐久を削り切った'
                : '訓練を終了した'
              : winner === 'player'
                ? terminalUsesSelfCollapse
                  ? `${TERMINAL_CAUSE_LABELS[terminalRef.current?.cause ?? 'pressure']}で競合の防衛線が崩れた！`
                  : `${TERMINAL_CAUSE_LABELS[terminalRef.current?.cause ?? 'pressure']}で契約成立！`
                : defeatReason === 'WALKING_DEAD_FAILED'
                  ? '蘇生猶予終了'
                  : defeatReason === 'CRUEL_RECKONING_FAILED'
                    ? '終極資本査定 未達'
                  : '買収交渉敗北'}</span>
            {winner === 'player' && overkill >= 0.5 && <em>OVERKILL +{overkill.toFixed(1)}%</em>}
          </div>
        </div>
      )}

      {showHelp && (
        <div className="buyout-overlay">
          <article ref={helpDialogRef} className="buyout-dialog" role="dialog" aria-modal="true" aria-label={isTraining ? '木人訓練の遊び方' : '買収交渉の遊び方'} tabIndex={-1}>
            <header><CircleHelp /><strong>{isTraining ? '木人訓練の遊び方' : '買収交渉の遊び方'}</strong><button type="button" data-modal-close onClick={() => setShowHelp(false)} aria-label="ヘルプを閉じる"><X /></button></header>
            <ol>
              <li><b>ギルを積む</b><span>左の投資レベルボタンで金額を5段階から選び、右の投資実行ボタンで1回投入します。人脈・SYNERGYの支援は上のアイコンから使います。</span></li>
              {isTraining && <li><b>木人訓練</b><span>参加費・報酬・精算・清算は0。木人は初期耐久資本を全配置し、追加防衛や敵AI行動を行いません。押されても自社1%で訓練を継続でき、その間も通常の毎秒収益とオフライン収益は自社資金へ加算されます。</span></li>}
              <li>
                <b>戦術選択</b>
                <span>
                  演出・人脈・ログ表示中は周囲の商戦進行を停止します。選んだ技そのものの効果は、演出の着弾時に反映されます。
                </span>
              </li>
              <li><b>未投入資金</b><span>通常商戦へ持ち込める自社現金は対象相場と同額まで。超過分は商会に安全資金として残り、戦後も失われません。木人訓練は制限対象外です。</span></li>
              <li><b>商流リジェネ</b><span>自社は開始時の持込資金、競合は開始時の総予算を基準に、双方0.3%/秒で手元資金だけを回復します。現在値は基準100%まで、累積は1戦20%まで。風は回復速度だけを変え、所有率へ直接加算しません。</span></li>
              <li><b>市場の風を読む</b><span>{isTraining ? '木人訓練では風は発生せず、自社・木人双方への補正もありません。' : `グリダニアは風なし。進行後も開始から最低10秒は静穏です。その後は低頻度の市場気配、${BATTLE_WIND_TELEGRAPH_SECONDS}秒の予兆を経て${BATTLE_WIND_ACTIVE_MIN_SECONDS}～${BATTLE_WIND_ACTIVE_MAX_SECONDS}秒だけ風が吹き、終了後は最低18秒の静穏を挟みます。`}</span></li>
              {!isTraining && <li><b>時代の風</b><span>零式 第2編2層の突破後、グランドカンパニー・エオルゼアから更新される上位SYNERGYです。18秒間、資本圧力×2.05・LB蓄積×1.25・継続圧力+0.75/秒となり、敵の相場風を解除して再発を防ぎます。1争奪戦につき1回です。</span></li>}
              <li><b>LIMIT BREAK</b><span>攻防の資金衝突で通常比20%速く蓄積し、動員資金も20%増加。自社＋人脈が合計4/8/16枠で1/2/3本まで解放され、LB1/2の集約資金は対象相場の80%/120%が上限です。発動のたび全ゲージを0にし、同じ戦闘でも再蓄積すれば再発動できます。</span></li>
              <li><b>特殊アクション</b><span>商戦フィールド直下のアイコンからLB・選択中のSYNERGY・主要アビリティを1タップで実行できます。未解放の枠は表示せず、人脈はドロワーで開きます。アビリティの選択だけは演出待ち中も変更できます。</span></li>
              <li><b>効果通知</b><span>味方への良い効果は青く上昇し、競合への妨害や悪い効果は赤く下降します。詳しい履歴は戦局ログで後から確認できます。</span></li>
              <li><b>リビングデッド</b><span>10秒の待機中に所有率0%へ到達すると表示上1%で耐えます。攻防の内部値は進み続け、その後10秒以内に30%以上へ戻せなければ敗北。1争奪戦につき1回です。</span></li>
              <li><b>協力協定</b><span>外部協力先から1争奪戦につき1回の支援です。LBの参加件数や投入額には含みません。</span></li>
              <li><b>独立リスク</b><span>支援要求で危険度は上がりますが、商戦中には離脱しません。通常商戦の勝利後、利益を独占するか、勝利利益の50%を人脈全体へ均等に山分けするかを選んで各人脈を一度だけ判定します。山分けは今回の離反率を大きく抑えますが、危険度そのものと離反の可能性は残ります。</span></li>
              {!isTraining && <li><b>資金繰り逼迫</b><span>競合の手元資金が0になると小さく通知しますが、商戦は停止しません。競合は商流リジェネ後、通常のAI判断で再び防衛資金を投入できます。</span></li>}
              <li><b>決着</b><span>所有率100%到達を内部確定した時点ですべての数値を固定し、約1秒の最終提示演出後にDEAL CLOSED／DEAL LOSTを1回だけ表示します。追加のとどめ操作は不要です。</span></li>
              <li><b>OVERKILL</b><span>所有率100%をどれだけ超えて押し切ったかを示す派手さの評価です。</span></li>
            </ol>
            <button type="button" className="dialog-close" onClick={() => setShowHelp(false)}>{isTraining ? '木人訓練へ戻る' : '商談へ戻る'}</button>
          </article>
        </div>
      )}

      {showLog && (
        <div className="buyout-overlay buyout-log-overlay">
          <article ref={logDialogRef} className="buyout-dialog buyout-log" role="dialog" aria-modal="true" aria-label="戦局ログ" tabIndex={-1}>
            <header><ScrollText /><strong>戦局ログ</strong><button type="button" data-modal-close onClick={() => setShowLog(false)} aria-label="戦局ログを閉じる"><X /></button></header>
            <div>{logs.map((entry) => <p key={entry.id} data-category={entry.category}>{entry.text}</p>)}</div>
            <button type="button" className="dialog-close" onClick={() => setShowLog(false)}>閉じる</button>
          </article>
        </div>
      )}

      {battlePhase === 'result' && winner && (
        <div className="buyout-overlay buyout-result-overlay">
          {resultStep === 'departures' ? (
          <article
            ref={phaseDialogRef}
            className="buyout-dialog buyout-result buyout-departure-report"
            role="dialog"
            aria-modal="true"
            aria-label="人脈の離脱報告"
            tabIndex={-1}
          >
            <header>
              <ShieldAlert />
              <strong>{isProtectedBattle ? '一時離脱報告' : '独立離脱報告'}</strong>
            </header>
            <div className="departure-report__lead">
              <img src={FANKIT_ART.tataru.windUp} alt="タタル" />
              <p>
                <b>{rebelled.length}件の人脈が戦列を離れました</b>
                <span>
                  {isProtectedBattle
                    ? 'この戦いは保護対象のため、通常の保有状態と独立危険度には反映されません。'
                    : '独立した事業・契約は人脈から外れ、評価額が自社資金へ強制清算されます。'}
                </span>
              </p>
            </div>
            <div className="departure-report__list">
              {rebelled.map((property) => (
                <article key={property.id}>
                  <ShieldAlert />
                  <span>
                    <b>{property.name}</b>
                    <small>{isProtectedBattle ? '演習内のみ一時離脱' : '独立・支援終了'}</small>
                  </span>
                  <strong>
                    {isProtectedBattle
                      ? '保有維持'
                      : `${formatCurrency(property.marketPrice)}清算`}
                  </strong>
                </article>
              ))}
            </div>
            <p className="departure-report__advice">
              次の商戦では、危険度の高い人脈へ頼る前に、ネマワシや山分けで備えるでっす。
            </p>
            <button
              type="button"
              className="dialog-close result-confirm result-return-map result-return-map--departure"
              onClick={confirmDepartureReport}
            >
              <CheckCircle2 />
              <span>{resultNavigationCta?.departureLabel ?? '離脱報告を確認して案件一覧へ'}</span>
            </button>
          </article>
          ) : (
          <article
            ref={phaseDialogRef}
            className={`buyout-dialog buyout-result buyout-result--${winner}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              isTraining
                ? `${targetProperty.name}の訓練結果`
                : `${targetProperty.name}の交渉結果`
            }
            tabIndex={-1}
          >
            <header>
              {winner === 'player' ? <Trophy /> : <XCircle />}
              <strong>{isTraining
                ? winner === 'player'
                  ? '木人訓練成功'
                  : '木人訓練終了'
                : winner === 'player'
                ? isCruel
                  ? '酷・もうひとつの商戦 踏破'
                  : isUltimate
                    ? '絶商戦 踏破'
                  : isSavage
                    ? '零式 踏破'
                    : '買収成立'
                : defeatReason === 'WALKING_DEAD_FAILED'
                  ? '蘇生失敗'
                  : defeatReason === 'CRUEL_RECKONING_FAILED'
                    ? '終極資本査定 未達'
                  : isHighEndRaid
                    ? '攻略失敗'
                    : '買収失敗'}</strong>
            </header>
            <h2>{targetProperty.name}</h2>
            <div className="tataru-analysis">
              <img src={FANKIT_ART.tataru.windUp} alt="タタル" />
              <p>
                <b>{isTraining ? 'タタルの訓練分析' : `タタルの${winner === 'player' ? '勝因' : '敗因'}分析`}</b>
                <span>「{resultAnalysis}」</span>
                <span className="tataru-analysis__finance">
                  {resultFinancialComment}{resultLiquidationComment}
                </span>
              </p>
            </div>
            {winner === 'player' && !isTraining && (
              <CompanyGrowthResult
                before={companyStrengthBefore}
                after={companyStrengthAfter}
                animate={!celebrationDecision}
                onRevealed={revealCompanyGrowth}
              />
            )}
            {!isTraining && (
              <section
                className={`result-settlement-summary ${resultSettlementTone}`}
                aria-label={`${resultTransactionName}収支の精算`}
              >
                <header>
                  <span>
                    <small>{isHighEndRaid ? 'RAID P/L' : 'BUYOUT P/L'}</small>
                    <b>{resultSettlementLabel}</b>
                  </span>
                  <strong>
                    {resultTransactionDelta >= 0 ? '+' : '-'}
                    {formatCurrency(Math.abs(resultTransactionDelta))}
                  </strong>
                </header>
                <dl>
                  <div>
                    <dt>{winner === 'player' ? '攻略報酬' : '参加報酬'}</dt>
                    <dd>+{formatCurrency(resultVictoryReward)}</dd>
                  </div>
                  <div>
                    <dt>手数料・確定支出</dt>
                    <dd>-{formatCurrency(brokerageFee + resultSettlementCost)}</dd>
                  </div>
                  {enemyDrainStolen > 0 && (
                    <div>
                      <dt>ドレイン被害</dt>
                      <dd>-{formatCurrency(enemyDrainStolen)}</dd>
                    </div>
                  )}
                  {resultLiquidationCashback > 0 && (
                    <div>
                      <dt>離脱資産の清算（別枠・{rebelled.length}件）</dt>
                      <dd>+{formatCurrency(resultLiquidationCashback)}</dd>
                    </div>
                  )}
                  {celebrationDecisionRequired && (
                    <div>
                      <dt>勝利利益の配分</dt>
                      <dd>
                        {!celebrationDecision
                          ? '選択待ち'
                          : celebrationGiftRate > 0
                            ? `-${formatCurrency(appliedCelebrationGiftCost)}`
                            : '0ギル'}
                      </dd>
                    </div>
                  )}
                  {resultLiquidationCashback > 0 && (
                    <div className="result-settlement-summary__funds-total">
                      <dt>清算込みの資金増減</dt>
                      <dd>
                        {resultFundsDelta >= 0 ? '+' : '-'}
                        {formatCurrency(Math.abs(resultFundsDelta))}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
            {!isTraining && winner === 'player' && nextCommunity && <p className="next-community"><CheckCircle2 />次の都市「{nextCommunity}」への交易路が開きます。</p>}
            {celebrationDecisionRequired && companyGrowthRevealed && (
              <section className="result-celebration-choice">
                <header>
                  <HandCoins />
                    <span>
                      <b>勝利の利益をどう配分しますか？</b>
                    <small>選択後、各人脈の離脱判定を1回だけ行います</small>
                  </span>
                </header>
                {celebrationDecision ? (
                  <p
                    className={`result-celebration-gift ${
                      celebrationGiftRate > 0 ? 'is-applied' : ''
                    }`}
                  >
                    <HandCoins />
                      <span>
                        <b>
                        {celebrationGiftOption?.label ?? '利益配分'}を確定
                        </b>
                        <small>
                        {celebrationGiftRate > 0
                          ? `人脈全体へ${formatCurrency(celebrationGiftCost)}を均等分配`
                          : '配分 0ギル'}
                        ・1件以上の離反率{' '}
                        {(baseDepartureProbability * 100).toFixed(1)}%
                        →{(selectedDepartureProbability * 100).toFixed(1)}%
                        （独立危険度は保存）
                      </small>
                    </span>
                  </p>
                ) : (
                  <div>
                    {profitAllocationChoices.map((option) => {
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => resolveVictorySettlement(option.id)}
                        >
                          <b>
                            {option.label}
                            （{Math.round(option.rate * 100)}%）
                          </b>
                          <small>
                            {option.rate > 0
                              ? `人脈全体へ均等に${formatCurrency(option.cost)}`
                              : '配分なし'}
                            <br />
                            離反率 {(option.departureProbability * 100).toFixed(1)}%
                          </small>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
            <button
              type="button"
              className={`dialog-close result-confirm result-return-map ${
                winner === 'player'
                  ? 'result-return-map--victory'
                  : 'result-return-map--defeat'
              }`}
              onClick={confirmResult}
              disabled={
                !resultConfirmArmed ||
                (celebrationDecisionRequired && !celebrationDecision)
              }
              aria-describedby="battle-result-confirm-note"
            >
              {resultConfirmArmed && <CheckCircle2 />}
              <span>{!resultConfirmArmed
                ? '結果を確認中…'
                : celebrationDecisionRequired && !companyGrowthRevealed
                ? '商店戦力を集計中…'
                : celebrationDecisionRequired && !celebrationDecision
                ? '利益の配分を選んでください'
                : rebelled.length > 0
                ? '結果を確認して離脱報告へ'
                : resultNavigationCta?.label ?? '結果を確定して案件一覧へ'}</span>
            </button>
            <small id="battle-result-confirm-note" className="sr-only">
              このボタンを押すまで商戦結果は確定されず、画面も閉じません。
            </small>
            <details className="result-battle-details">
              <summary><ScrollText />戦闘記録を見る</summary>
              <div className="result-numbers">
                <span><small>FINISH</small><b>{isTraining ? winner === 'player' ? 'DUMMY BREAK' : 'TRAINING END' : winner === 'opponent' && defeatReason === 'WALKING_DEAD_FAILED' ? 'WALKING DEAD FAILED' : winner === 'opponent' && defeatReason === 'CRUEL_RECKONING_FAILED' ? 'RECKONING FAILED' : FINISH_LABELS[finishMethod]}</b></span>
                <span><small>最終所有率</small><b>{finalOwnership.toFixed(1)}%</b></span>
                <span><small>OVERKILL</small><b>{winner === 'player' ? `+${overkill.toFixed(1)}%` : '---'}</b></span>
                <span><small>自社競り値</small><b>{formatCurrency(totalPlayerInvested)}</b></span>
                <span><small>{isTraining ? '木人耐久資本' : '競合競り値'}</small><b>{formatCurrency(enemyInvested)}</b></span>
                <span><small>戦中再利用</small><b>{formatCurrency(battleCashRecovered)}</b></span>
                <span><small>{isTraining ? '一時離脱' : isHighEndRaid ? '記録戦中の一時離脱' : '人脈離脱'}</small><b>{rebelled.length}件</b></span>
              </div>
              {winner === 'player' && (
                <p className="overkill-rating">{getOverkillRating(overkill)}</p>
              )}
            </details>
          </article>
          )}
        </div>
      )}
    </div>
  );
};

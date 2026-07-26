import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Building2,
  CheckCircle2,
  CircleHelp,
  HandCoins,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Swords,
  TimerReset,
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
  calculateRebellionProbability,
  formatCurrency,
} from '../utils/formatter';
import { soundFx } from '../utils/audio';
import { calculateAllianceSupport, isPublicPatronage } from '../utils/alliance';
import {
  FANKIT_ART,
  getFankitCommerceIcon,
  getFankitJobArt,
  getFankitTrainingDummyArt,
} from '../data/fankitAssets';
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
  BATTLE_CINEMATIC_TIMING,
  canConfirmBattleResult,
  canShowShortNotice,
  getBattleCinematicLayer,
  getCapitalVisualBundleCountForAmount,
  getCapitalVisualStage,
  getVictoryConfettiParticleCount,
  RESULT_CONFIRM_ARM_DELAY_MS,
  shouldInertBattleFooter,
} from '../utils/battlePresentation';
import { getTrainingDummyDefinition } from '../utils/trainingDummy';
import {
  advanceBattleWind,
  BATTLE_WIND_COOLDOWN_SECONDS,
  createBattleWindState,
  shouldAdvanceBattleWind,
} from '../utils/battleWind';
import { StrengthComparison } from './StrengthComparison';
import {
  applyTrainingGaugeSpeed,
  BATTLE_GAUGE_SPEED_FACTOR,
  calculateBattleVictoryReward,
  calculateEraWindCost,
  calculateEnemyBudget,
  calculateOwnershipFromGauge,
  calculateLimitBreakAmount,
  calculateLimitBreakChargeGain,
  calculateLimitBreakOwnershipAfterDefense,
  calculateLimitBreakOwnershipPush,
  consumeLimitBreakCharge,
  ENEMY_BALANCE_FACTOR,
  ENEMY_INITIAL_COMMITMENT_RATIO,
  getChargedLimitBreakTier,
  getEnemyDifficultyLevel,
  getEraWindGaugePushPerSecond,
  getLimitBreakChargeCapacity,
  getLimitBreakTier,
  LIMIT_BREAK_CHARGE_GAIN_MULTIPLIER,
  LIMIT_BREAK_CHARGE_PER_BAR,
  LIMIT_BREAK_MULTIPLIERS,
  LIMIT_BREAK_OWNERSHIP_CAPS,
  holdGaugeForManualShortFinish,
  holdTrainingGaugeAboveDefeat,
  resolveLivingDeadOutcome,
  TACTICAL_SKILL_BALANCE,
  type LimitBreakTier,
  type LivingDeadPhase,
} from '../utils/gameBalance';
export { ENEMY_BALANCE_FACTOR, LIMIT_BREAK_MULTIPLIERS };
import gilChipPlayer from '../assets/battle/gil-chip-player.png';
import defenseChipEnemy from '../assets/battle/defense-chip-enemy.png';
import gilMedallionPlayer from '../assets/battle/gil-medallion-player.png';
import defenseMedallionEnemy from '../assets/battle/defense-medallion-enemy.png';
import '../battle-buyout.css';
import '../battle-balance.css';
import '../battle-clarity.css';
import '../battle-enemy-budget.css';
import '../battle-command-refine.css';
import '../battle-final-wind.css';
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
  alliance: AllianceState;
  activeSynergies: GroupSynergy[];
  selectedBattleSynergy: GroupSynergy | null;
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
  isTraining?: boolean;
  onAddFunds?: (amount: number) => void;
  onResetFunds?: () => void;
  onTimeScaleChange?: (scale: number) => void;
  onBattleEnd: (result: BattleResult) => void;
  onClose: () => void;
}

type Panel = 'capital' | 'funds' | 'skills';
type BattleMotion = 'idle' | 'player' | 'enemy' | 'rebel';
type LogCategory = 'system' | 'player' | 'enemy' | 'funds' | 'skill' | 'result';
type BattleAnnouncement = 'start' | 'limit' | 'final';
type BattleConditionKind = 'player' | 'enemy' | 'cross' | 'calm' | 'synergy' | 'burst';
type DefeatReason = 'CAPITAL_COLLAPSE' | 'WALKING_DEAD_FAILED';

interface BattleConditionAnnouncement {
  kind: BattleConditionKind;
  kicker: string;
  title: string;
  detail: string;
}

const MarqueeText: React.FC<{
  text: string;
  className?: string;
  delayMs?: number;
}> = ({ text, className = '', delayMs = 0 }) => {
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
};

interface DecisiveBlow {
  winner: 'player' | 'opponent';
  impacted: boolean;
}

const isRivalOnlySkill = (skill: TacticalSkill) =>
  skill.effectType === 'INDEPENDENCE_SABOTAGE' ||
  skill.effectType === 'DEMORALIZE';

const getQuickSkillSummary = (
  skill: TacticalSkill,
  isTraining = false
) => {
  if (isTraining && isRivalOnlySkill(skill)) return '木人では対象なし';
  switch (skill.effectType) {
    case 'COOLDOWN_REDUCTION':
      return '命令回復 約1.8倍・10秒';
    case 'NEMAWASHI':
      return '全支援元の独立危険度を半減';
    case 'INDEPENDENCE_SABOTAGE':
      return '防衛中断70%・9秒';
    case 'DEMORALIZE':
      return '競合待機 ×1.6・9秒';
    case 'CAPITAL_BOOST':
      return '相場30%を即時支援';
    case 'LIVING_DEAD':
      return '致死回避 → 30%復帰';
    case 'SYNERGY_PUSH':
      return '押込速度 ×1.5・7秒';
    case 'ERA_WIND':
      return '自社向きの時流・12秒';
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
}

const FINISH_LABELS: Record<FinishMethod, string> = {
  LIMIT_BREAK_1: 'LIMIT BREAK I',
  LIMIT_BREAK_2: 'LIMIT BREAK II',
  LIMIT_BREAK_3: 'LIMIT BREAK III',
  FINAL_PUSH: 'FINAL PUSH',
  CAPITAL_PRESSURE: 'CAPITAL PRESSURE',
  NORMAL: 'NORMAL BUYOUT',
};

const getOverkillRating = (overkill: number) => {
  if (overkill < 5) return '精密交渉';
  if (overkill < 20) return '決定的優勢';
  if (overkill < 50) return '圧倒的買収';
  return '過剰制圧';
};

export const INVESTMENT_LEVELS = [
  { level: 1, ratio: 0.02, label: '小口' },
  { level: 2, ratio: 0.05, label: '堅実' },
  { level: 3, ratio: 0.1, label: '強気' },
  { level: 4, ratio: 0.2, label: '大口' },
  { level: 5, ratio: 0.35, label: '全力' },
];

export const getInvestmentCost = (marketPrice: number, level: number) => {
  const config = INVESTMENT_LEVELS.find((item) => item.level === level) || INVESTMENT_LEVELS[0];
  return Math.max(10, Math.round(marketPrice * config.ratio));
};

const riskPresentation = (risk: number) => {
  if (risk <= 0) return { label: '忠誠', className: 'risk-black' };
  if (risk < 30) return { label: '安定', className: 'risk-blue' };
  if (risk < 60) return { label: '警戒', className: 'risk-yellow' };
  return { label: '独立寸前', className: 'risk-red' };
};

const GilTower: React.FC<{
  amount: number;
  reserveAmount?: number;
  marketPrice: number;
  side: 'player' | 'enemy';
  motion: BattleMotion;
}> = ({ amount, reserveAmount = 0, marketPrice, side, motion }) => {
  const committedCapital = Math.max(0, amount);
  const visualStage = getCapitalVisualStage(committedCapital);
  const committedStage = visualStage;
  const bundleCount = getCapitalVisualBundleCountForAmount(committedCapital);
  const committedBundleCount = bundleCount;
  const chipAsset = side === 'player' ? gilChipPlayer : defenseChipEnemy;
  const medallionAsset = side === 'player' ? gilMedallionPlayer : defenseMedallionEnemy;
  const capitalRatio = committedCapital / Math.max(marketPrice, 1);

  return (
    <div
      className={`gil-tower gil-tower--${side} gil-tower--stage-${visualStage} ${motion === side ? 'gil-tower--impact' : ''}`}
      data-capital-stage={visualStage}
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
        {bundleCount === 0 && (
          <span className="gil-tower__empty" aria-hidden="true"><i /></span>
        )}
        {Array.from({ length: bundleCount }).map((_, index) => (
          <img
            key={`${side}-${index}`}
            src={index === 0 ? medallionAsset : chipAsset}
            alt=""
            aria-hidden="true"
            className={`${index === 0 ? 'gil-chip-image gil-chip-image--medallion' : 'gil-chip-image gil-chip-image--stack'}${motion === side && index === Math.max(0, committedBundleCount - 1) ? ' gil-chip-image--falling' : ''}`}
            style={{
              '--chip-index': index,
              '--chip-count': bundleCount,
              '--chip-angle': `${((index * 7 + (side === 'player' ? 3 : 9)) % 15) - 7}deg`,
            } as React.CSSProperties}
          />
        ))}
        {visualStage >= 7 && (
          <span className="gil-tower__overflow" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, index) => (
              <i
                key={index}
                style={{
                  '--overflow-x': `${8 + ((index * 19) % 84)}%`,
                  animationDelay: `${-(index * 0.23)}s`,
                } as React.CSSProperties}
              />
            ))}
          </span>
        )}
      </div>
      <strong>{formatCurrency(amount)}</strong>
      <small>{amount > 0 ? `投入資金・段階${committedStage}` : reserveAmount > 0 ? '未投入資金を待機中' : '資金未投入'}</small>
    </div>
  );
};

export const BattleModal: React.FC<BattleModalProps> = ({
  targetProperty,
  companyName,
  totalFunds,
  ownedProperties,
  equippedSkills,
  alliance,
  activeSynergies,
  selectedBattleSynergy,
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
  isTraining = false,
  onTimeScaleChange,
  onBattleEnd,
  onClose,
}) => {
  const brokerageFee = isTraining
    ? 0
    : Math.round(targetProperty.marketPrice * 0.03);
  const influenceBonus = industryInfluence.playerBonus + regionalInfluence.playerBonus + tradeNetworkBonus;
  const isHighEndRaid = isSavage || isUltimate;
  const isProtectedBattle = isHighEndRaid || isTraining;
  const enemyDifficultyLevel = getEnemyDifficultyLevel(
    targetProperty,
    isTutorial,
    isSavage,
    isUltimate
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
          }),
    [
      industryInfluence,
      isSavage,
      isTutorial,
      isTraining,
      isUltimate,
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
    (next: number | ((current: number) => number)) => {
      const resolved = typeof next === 'function' ? next(gaugeRef.current) : next;
      gaugeRef.current = resolved;
      setGauge(resolved);
      return resolved;
    },
    []
  );
  const [gaugeSpeed, setGaugeSpeed] = useState(0);
  const [companyInvested, setCompanyInvested] = useState(0);
  const [demandInvested, setDemandInvested] = useState(0);
  const [enemyInvested, setEnemyInvested] = useState(initialEnemyCommitment);
  const [enemyReserve, setEnemyReserve] = useState(enemyBudget - initialEnemyCommitment);
  const enemyReserveRef = useRef(enemyBudget - initialEnemyCommitment);
  const initialBattleCashRef = useRef(Math.max(0, totalFunds - brokerageFee));
  const [cash, setCash] = useState(initialBattleCashRef.current);
  const battleCashRecoveryPerSecond = Math.max(1, Math.round(targetProperty.marketPrice * 0.003));
  const battleCashRecoveryCap = Math.round(targetProperty.marketPrice * 0.15);
  const [battleCashRecovered, setBattleCashRecovered] = useState(0);
  const battleCashRecoveredRef = useRef(0);
  const recoveryCarryRef = useRef(0);
  const [limitImpactActive, setLimitImpactActive] = useState(false);
  const [battleSubs, setBattleSubs] = useState<Property[]>(ownedProperties);
  const [subContributions, setSubContributions] = useState<Record<string, number>>({});
  const [subRequestCounts, setSubRequestCounts] = useState<Record<string, number>>({});
  const [rebelled, setRebelled] = useState<Property[]>([]);
  const [allianceUsed, setAllianceUsed] = useState(false);
  const [activeLimitBreakTier, setActiveLimitBreakTier] = useState<LimitBreakTier>(0);
  const [panel, setPanel] = useState<Panel>('capital');
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [commandProgress, setCommandProgress] = useState(100);
  const [fastHorseRemaining, setFastHorseRemaining] = useState(0);
  const [enemySlowedRemaining, setEnemySlowedRemaining] = useState(0);
  const [enemyDisruptionRemaining, setEnemyDisruptionRemaining] = useState(0);
  const [pushMultiplierRemaining, setPushMultiplierRemaining] = useState(0);
  const [eraWindRemaining, setEraWindRemaining] = useState(0);
  const [eraWindUses, setEraWindUses] = useState(0);
  const [battleWindState, setBattleWindState] = useState(
    createBattleWindState
  );
  const [skillCooldowns, setSkillCooldowns] = useState<Record<string, number>>({});
  const [usedSkillIds, setUsedSkillIds] = useState<Set<string>>(() => new Set());
  const [livingDeadPhase, setLivingDeadPhase] = useState<LivingDeadPhase>('inactive');
  const [livingDeadRemaining, setLivingDeadRemaining] = useState(0);
  const [motion, setMotion] = useState<BattleMotion>('idle');
  const [motionSerial, setMotionSerial] = useState(0);
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
  const [openingSlowActive, setOpeningSlowActive] = useState(false);
  const [decisiveBlow, setDecisiveBlow] = useState<DecisiveBlow | null>(null);
  const [finalPushActive, setFinalPushActive] = useState(false);
  const [lastPlayerAction, setLastPlayerAction] = useState<PlayerBattleAction | null>(null);
  const [aiCycle, setAiCycle] = useState(0);
  const [finishTelegraphVisible, setFinishTelegraphVisible] = useState(false);
  const [resultConfirmArmed, setResultConfirmArmed] = useState(false);
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
  const shortShownRef = useRef(false);
  const announcementTimerRef = useRef<number | null>(null);
  const limitBreakTimerRef = useRef<number | null>(null);
  const shortTimerRef = useRef<number | null>(null);
  const shortDelayTimerRef = useRef<number | null>(null);
  const terminalActionTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const resultConfirmTimerRef = useRef<number | null>(null);
  const limitImpactTimerRef = useRef<number | null>(null);
  const conditionTimerRef = useRef<number | null>(null);
  const openingSlowTimerRef = useRef<number | null>(null);
  const decisiveImpactTimerRef = useRef<number | null>(null);
  const decisiveClearTimerRef = useRef<number | null>(null);
  const decisiveResolveTimerRef = useRef<number | null>(null);
  const livingDeadNoticeTimerRef = useRef<number | null>(null);
  const motionTimerRef = useRef<number | null>(null);
  const commandReadySoundArmedRef = useRef(false);
  const decisiveRef = useRef(false);
  const resultConfirmArmedRef = useRef(false);
  const resultConfirmedRef = useRef(false);
  const lastAnnouncedWindRef = useRef<WindCondition['type']>('CALM');
  const lastTelegraphedWindRef = useRef<WindCondition['type'] | null>(null);
  const livingDeadPhaseRef = useRef<LivingDeadPhase>('inactive');
  const livingDeadRemainingRef = useRef(0);
  const fundsDrawerRef = useRef<HTMLElement | null>(null);
  const skillsDrawerRef = useRef<HTMLElement | null>(null);
  const helpDialogRef = useRef<HTMLElement | null>(null);
  const logDialogRef = useRef<HTMLElement | null>(null);
  const phaseDialogRef = useRef<HTMLElement | null>(null);
  const rootDialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const initialFocusRef = useRef<HTMLElement | null>(null);

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
          : panel === 'skills'
            ? skillsDrawerRef.current
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
  }, [battlePhase, panel, requestClose, showHelp, showLog]);

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
    selectedBattleSynergyMembers.length ===
      selectedBattleSynergy.requiredPropertyIds.length;

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
  const commandReady = commandProgress >= 100;
  const selectedCost = getInvestmentCost(targetProperty.marketPrice, selectedLevel);
  const eraWindActive = eraWindRemaining > 0;
  const currentWind = eraWindActive
    ? WIND_CONDITIONS.CALM
    : WIND_CONDITIONS[battleWindState.windType];
  const windCountdown = Math.max(
    0,
    Math.ceil(
      eraWindActive
        ? eraWindRemaining / 1000
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
  const effectivePlayerInvested = totalPlayerInvested * currentWind.playerMultiplier;
  const effectiveEnemyInvested = enemyInvested * currentWind.enemyMultiplier;
  const effectiveCapitalGap = effectivePlayerInvested - effectiveEnemyInvested;
  const effectiveCapitalTotal = effectivePlayerInvested + effectiveEnemyInvested;
  const effectivePlayerShare = effectiveCapitalTotal > 0
    ? effectivePlayerInvested / effectiveCapitalTotal * 100
    : 50;
  const capitalPressurePosition = Math.max(4, Math.min(96, effectivePlayerShare));
  const playerCapitalProgress =
    totalPlayerInvested / Math.max(1, targetProperty.marketPrice) * 100;
  const enemyCapitalProgress =
    enemyInvested / Math.max(1, targetProperty.marketPrice) * 100;
  const playerCapitalVisualStage = getCapitalVisualStage(totalPlayerInvested);
  const enemyCapitalVisualStage = getCapitalVisualStage(enemyInvested);
  const capitalPressureLabel = effectivePlayerShare >= 58
    ? '自社優勢'
    : effectivePlayerShare <= 42
      ? isTraining ? '木人優勢' : '競合優勢'
      : isTraining ? '訓練資本拮抗' : '資本拮抗';
  const savageLayerMatch = isSavage
    ? targetProperty.name.match(/第([1-4])層/)
    : null;
  const savageLayer = isSavage ? Number(savageLayerMatch?.[1] ?? 1) : 0;
  const trainingDummyDefinition = isTraining
    ? getTrainingDummyDefinition(targetProperty.id)
    : null;
  const opponentCharacterArt = trainingDummyDefinition
    ? getFankitTrainingDummyArt(trainingDummyDefinition.level)
    : getFankitJobArt(
        `${targetProperty.id}-${targetProperty.community}-${targetProperty.industry}-${targetProperty.ownerName}`
      );
  const primarySkill = (
    isTraining
      ? equippedSkills.find((skill) => !isRivalOnlySkill(skill))
      : equippedSkills[0]
  ) ?? equippedSkills[0] ?? null;
  const additionalSkillCount = Math.max(0, equippedSkills.length - 1);
  const primarySkillCooldown = primarySkill
    ? skillCooldowns[primarySkill.id] || 0
    : 0;
  const primarySkillUsed = !!primarySkill?.oncePerBattle &&
    usedSkillIds.has(primarySkill.id);
  const primarySkillUnavailable =
    !!primarySkill && isTraining && isRivalOnlySkill(primarySkill);
  const nextEraWindCost = calculateEraWindCost(
    targetProperty.marketPrice,
    eraWindUses
  );
  const eraWindUseLimitReached =
    eraWindUses >= TACTICAL_SKILL_BALANCE.eraWind.maxUsesPerBattle;
  const primaryEraWindUnavailable =
    primarySkill?.effectType === 'ERA_WIND' &&
    (eraWindUseLimitReached || cash < nextEraWindCost);
  const ownershipRate = Math.abs(gaugeSpeed) / 2;
  const battleDirection = gaugeSpeed < -0.08 ? 'player' : gaugeSpeed > 0.08 ? 'enemy' : 'even';
  const enemyReserveCapacity = Math.max(1, enemyBudget - initialEnemyCommitment);
  const enemyReservePercent = enemyReserve <= 0 ? 0 : Math.min(99.9, (enemyReserve / enemyReserveCapacity) * 100);
  const enemyReserveState = isTraining
    ? 'healthy'
    : enemyReservePercent <= 0 ? 'short' : enemyReservePercent <= 10 ? 'critical'
      : enemyReservePercent <= 25 ? 'danger' : enemyReservePercent <= 50 ? 'warning' : 'healthy';
  const playerReserveCapacity = Math.max(1, initialBattleCashRef.current);
  const playerReservePercent = Math.max(0, Math.min(100, (cash / playerReserveCapacity) * 100));
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
  const liveActiveSynergies = activeSynergies.filter((synergy) =>
    synergy.requiredPropertyIds.every((propertyId) =>
      battleSubs.some((property) => property.id === propertyId)
    )
  );
  const hasActiveBattleSynergy =
    liveActiveSynergies.length > 0 ||
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
      (windEnabled &&
        (windTelegraphVisible || currentWind.type !== 'CALM'))
    );
  const eraWindPushPerSecond = getEraWindGaugePushPerSecond(
    Math.max(0, eraWindUses - 1)
  );
  const windTitle = eraWindActive
    ? '時代の風'
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
  const windDetail = eraWindActive
    ? `風が……来る！ 時流 +${eraWindPushPerSecond.toFixed(1)}pt/秒`
    : windTelegraphVisible
      ? `3秒後に${presentedWind.title}`
      : isBurstTime
        ? `風 × SYNERGY / 自社効果 ×${currentWind.playerMultiplier.toFixed(2)}`
        : currentWind.type === 'HEADWIND_PLAYER'
          ? `自社効果 ×${currentWind.playerMultiplier.toFixed(2)}`
          : windSide === 'player'
            ? `自社効果 ×${currentWind.playerMultiplier.toFixed(2)}`
            : windSide === 'enemy'
              ? `敵防衛 ×${currentWind.enemyMultiplier.toFixed(2)}`
              : currentWind.type === 'CROSSWIND'
                ? `双方 ×${currentWind.playerMultiplier.toFixed(2)} / 速度 ×${currentWind.speedMultiplier.toFixed(2)}`
                : '双方の資金効果 ×1.00';
  const windHudDetail = windDetail;
  const fastHorse = fastHorseRemaining > 0;
  const enemySlowed = enemySlowedRemaining > 0;
  const enemyDisruption = enemyDisruptionRemaining > 0
    ? TACTICAL_SKILL_BALANCE.disruption.interruptChance
    : 0;
  const pushMultiplier = pushMultiplierRemaining > 0
    ? TACTICAL_SKILL_BALANCE.battleLitany.pushMultiplier
    : 1;
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
  const alliancePublicPatronage = isPublicPatronage(alliance);
  const allianceSupport = alliance.active && !allianceUsed
    ? calculateAllianceSupport(targetProperty.marketPrice)
    : 0;
  const battleReadiness = calculateBattleReadiness({
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
  });
  const commandProgressPerTick = fastHorse
    ? TACTICAL_SKILL_BALANCE.fastAction.boostedCommandProgressPerTick
    : TACTICAL_SKILL_BALANCE.fastAction.baseCommandProgressPerTick;
  const isFinalPushWindow = !isTraining && enemyReserve <= 0;
  const presentationLocked =
    !!battleAnnouncement ||
    !!conditionAnnouncement;
  const decisiveLocked = !!decisiveBlow;
  const actionsLocked =
    !!winner ||
    battlePhase !== 'active' ||
    presentationLocked ||
    decisiveLocked ||
    showHelp ||
    showLog;
  const backgroundInert =
    panel !== 'capital' ||
    showHelp ||
    showLog ||
    battlePhase !== 'active' ||
    presentationLocked ||
    decisiveLocked;
  const footerInert = shouldInertBattleFooter(
    backgroundInert,
    !!winner,
    battlePhase
  );
  const isPaused = battlePhase !== 'active' || showHelp || showLog || presentationLocked;
  const tutorialAssistActive =
    !!isTutorial &&
    battlePhase === 'active' &&
    totalPlayerInvested < targetProperty.marketPrice * 0.45 &&
    !winner;
  const timeScale = decisiveBlow
    ? 0.16
    : isPaused
      ? 0
      : tutorialAssistActive
        ? 0.2
        : openingSlowActive
          ? 0.1
          : panel === 'capital'
            ? 1
            : 0.1;
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
    slowed: enemySlowed,
    cycle: aiCycle,
    difficultyLevel: enemyDifficultyLevel,
  }), [
    aiCycle, currentWind.type, effectiveCapitalGap, enemyOwnershipForAi, enemyReservePercent, enemySlowed,
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
    if (selectedCost <= cash || !maxAffordableConfig) return;
    setSelectedLevel(maxAffordableConfig.level);
    setStatusText(`残高に合わせて投資額を「${maxAffordableConfig.label}」へ自動調整`);
  }, [cash, maxAffordableConfig, selectedCost]);

  useEffect(() => {
    onTimeScaleChange?.(timeScale);
  }, [onTimeScaleChange, timeScale]);

  useEffect(() => {
    if (
      !windEnabled ||
      !shouldAdvanceBattleWind({
        battleActive: battlePhase === 'active',
        settled: !!winner || decisiveLocked,
        presentationLocked,
        eraWindActive,
      }) ||
      timeScale <= 0
    ) {
      return;
    }
    const timer = window.setInterval(() => {
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
    eraWindActive,
    presentationLocked,
    timeScale,
    windEnabled,
    windProgressionStage,
    winner,
  ]);

  useEffect(() => {
    if (!commandReady) {
      commandReadySoundArmedRef.current = true;
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
    onTimeScaleChange?.(1);
    if (announcementTimerRef.current) window.clearTimeout(announcementTimerRef.current);
    if (limitBreakTimerRef.current) window.clearTimeout(limitBreakTimerRef.current);
    if (shortTimerRef.current) window.clearTimeout(shortTimerRef.current);
    if (shortDelayTimerRef.current) window.clearTimeout(shortDelayTimerRef.current);
    if (terminalActionTimerRef.current) window.clearTimeout(terminalActionTimerRef.current);
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    if (resultConfirmTimerRef.current) window.clearTimeout(resultConfirmTimerRef.current);
    if (limitImpactTimerRef.current) window.clearTimeout(limitImpactTimerRef.current);
    if (conditionTimerRef.current) window.clearTimeout(conditionTimerRef.current);
    if (openingSlowTimerRef.current) window.clearTimeout(openingSlowTimerRef.current);
    if (decisiveImpactTimerRef.current) window.clearTimeout(decisiveImpactTimerRef.current);
    if (decisiveClearTimerRef.current) window.clearTimeout(decisiveClearTimerRef.current);
    if (decisiveResolveTimerRef.current) window.clearTimeout(decisiveResolveTimerRef.current);
    if (livingDeadNoticeTimerRef.current) window.clearTimeout(livingDeadNoticeTimerRef.current);
    if (motionTimerRef.current) window.clearTimeout(motionTimerRef.current);
    confetti.reset();
    soundFx.stopBattleCinematicAudio(80);
  }, [onTimeScaleChange]);

  useEffect(() => {
    setAiText(`${ENEMY_INTENT_LABELS[enemyDecision.intent]} / ${enemyDecision.reason}`);
  }, [enemyDecision.intent, enemyDecision.reason]);

  const addLog = (text: string, category: LogCategory = 'system') => {
    const entry = { id: `${Date.now()}-${Math.random()}`, category, text };
    setLogs((current) => [entry, ...current].slice(0, 100));
  };

  const showFloater = (
    text: string,
    side: FloatingGil['side'],
    tone: FloatingGil['tone'] = 'positive'
  ) => {
    const id = Date.now() + Math.random();
    setFloaters((current) => [
      ...current.slice(-2),
      { id, text, side, tone },
    ]);
    window.setTimeout(
      () => setFloaters((current) => current.filter((item) => item.id !== id)),
      1450
    );
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

  const chargeLimitBreak = (effectiveCapitalMovement: number) => {
    if (limitBreakChargeCapacity <= 0 || effectiveCapitalMovement <= 0) return 0;
    const gain = calculateLimitBreakChargeGain(
      effectiveCapitalMovement,
      targetProperty.marketPrice
    );
    onLimitBreakChargeChange((current) =>
      Math.min(limitBreakChargeCapacity, Math.max(0, current) + gain)
    );
    return gain;
  };

  const announceBattle = (announcement: BattleAnnouncement, duration = 2000) => {
    if (announcementTimerRef.current) window.clearTimeout(announcementTimerRef.current);
    setBattleAnnouncement(announcement);
    announcementTimerRef.current = window.setTimeout(() => setBattleAnnouncement(null), duration);
  };

  const announceCondition = (
    announcement: BattleConditionAnnouncement,
    duration = BATTLE_CINEMATIC_TIMING.conditionAnnouncementMs
  ) => {
    if (conditionTimerRef.current) window.clearTimeout(conditionTimerRef.current);
    setConditionAnnouncement(announcement);
    conditionTimerRef.current = window.setTimeout(() => setConditionAnnouncement(null), duration);
  };

  const announceCurrentWind = () => {
    if (!windEnabled) return false;
    if (currentWind.type === 'CALM') {
      const text = '静穏――風補正が終了し、双方の資金効果が基準値へ戻りました';
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
        kicker: 'TAILWIND × SYNERGY',
        title: 'BURST TIME',
        detail: `味方追い風と連携が共鳴 / 自社の出資効果 ×${currentWind.playerMultiplier.toFixed(2)}`,
      };
    } else if (currentWind.type === 'TAILWIND_PLAYER') {
      announcement = {
        kind: 'player',
        kicker: 'MARKET WIND / ALLY',
        title: '味方追い風',
        detail: `自社の出資・支援効果 ×${currentWind.playerMultiplier.toFixed(2)}`,
      };
    } else if (currentWind.type === 'HEADWIND_PLAYER') {
      announcement = {
        kind: 'enemy',
        kicker: 'WARNING / HEADWIND',
        title: '自社向かい風',
        detail: `自社の出資・支援効果 ×${currentWind.playerMultiplier.toFixed(2)}`,
      };
    } else if (currentWind.type === 'TAILWIND_ENEMY') {
      announcement = {
        kind: 'enemy',
        kicker: 'WARNING / RIVAL WIND',
        title: '敵方追い風',
        detail: `競合の防衛出資効果 ×${currentWind.enemyMultiplier.toFixed(2)}`,
      };
    } else if (currentWind.type === 'CROSSWIND') {
      announcement = {
        kind: 'cross',
        kicker: 'MARKET TURBULENCE',
        title: '乱旋風',
        detail: `双方の資金効果 ×${currentWind.playerMultiplier.toFixed(2)} / 所有率速度 ×${currentWind.speedMultiplier.toFixed(2)}`,
      };
    } else return false;
    announceCondition(announcement);
    const text = `${announcement.title}――${announcement.detail}`;
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
    if (announcement.kind === 'enemy') soundFx.playWarning();
    else soundFx.playSkillSpark();
    return true;
  };

  const announceSynergy = (name: string, detail: string) => {
    const title = isBurstTime ? 'BURST TIME' : 'SYNERGY発動';
    showFloater(`${title} / ${name}`, 'player', 'positive');
    setStatusText(
      isBurstTime
        ? `${name}と味方追い風が共鳴――${detail}`
        : `${name}――${detail}`
    );
  };

  const startBattle = () => {
    const openingLog = {
      id: `open-${Date.now()}`,
      category: 'system' as LogCategory,
      text: isTraining
        ? `${companyName}、${targetProperty.name}の訓練開始。木人は耐久資本${formatCurrency(initialEnemyCommitment)}を全配置しました。`
        : `${companyName}対${targetProperty.name}、討滅戦開始。競合は${formatCurrency(initialEnemyCommitment)}を先に積みました。`,
    };
    changeBattlePhase('active');
    if (isTraining) setCommandProgress(100);
    setOpeningSlowActive(true);
    setStatusText(
      isTraining
        ? '木人訓練開始――投入・支援元・スキルを自由に試してください'
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
    const text = `市場気配――風が……来る！ 3秒後に${nextWind.title}`;
    setStatusText(text);
    setLogs((current) => [
      {
        id: `wind-telegraph-${Date.now()}`,
        category: 'system' as const,
        text,
      },
      ...current,
    ].slice(0, 100));
    if (
      nextWind.type === 'TAILWIND_ENEMY' ||
      nextWind.type === 'HEADWIND_PLAYER'
    ) {
      soundFx.playWarning();
    } else {
      soundFx.playSkillSpark();
    }
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
      endedRef.current ||
      decisiveRef.current ||
      battlePhase !== 'active' ||
      presentationLocked
    ) {
      soundFx.playWarning();
      return false;
    }
    setCommandProgress(0);
    return true;
  };

  const finalizeBattle = (
    result: 'player' | 'opponent',
    method: FinishMethod = 'NORMAL',
    rawOwnership = ownership,
    resolvedDefeatReason: DefeatReason = 'CAPITAL_COLLAPSE'
  ) => {
    if (endedRef.current) return;
    endedRef.current = true;
    decisiveRef.current = false;
    setDecisiveBlow(null);
    setBattleAnnouncement(null);
    setConditionAnnouncement(null);
    setLimitImpactActive(false);
    setFinalPushActive(false);
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
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    finishTimerRef.current = window.setTimeout(
      () => setFinishTelegraphVisible(false),
      BATTLE_CINEMATIC_TIMING.finishNoticeMs
    );
    setStatusText(
      isTraining
        ? result === 'player'
          ? '木人耐久率0%――木人討滅成功！'
          : '商戦木人訓練を終了しました'
        : result === 'player'
          ? '所有率100%――買収成立！'
          : resolvedDefeatReason === 'WALKING_DEAD_FAILED'
            ? '蘇生猶予終了――所有率30％へ届かず買収失敗'
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
            ? `リビングデッドの蘇生猶予中に所有率30％へ戻せず、${companyName}は敗北しました。`
            : `${companyName}は競合に所有率を押し切られました。`,
      'result'
    );
    if (result === 'player') {
      soundFx.playVictory();
      confetti.reset();
      const reducedMotion = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)'
      ).matches ?? false;
      const particleCount = getVictoryConfettiParticleCount(
        window.innerWidth,
        reducedMotion
      );
      if (particleCount > 0) {
        confetti({
          particleCount,
          spread: window.innerWidth <= 640 ? 72 : 96,
          startVelocity: window.innerWidth <= 640 ? 26 : 34,
          ticks: window.innerWidth <= 640 ? 80 : 120,
          scalar: window.innerWidth <= 640 ? 0.78 : 0.92,
          origin: { y: 0.48 },
          disableForReducedMotion: true,
        });
      }
    } else {
      soundFx.playDefeat();
    }
  };

  const finishBattle = (
    result: 'player' | 'opponent',
    method: FinishMethod = 'NORMAL',
    rawOwnership = ownership,
    cinematic = true,
    resolvedDefeatReason: DefeatReason = 'CAPITAL_COLLAPSE'
  ) => {
    if (endedRef.current || decisiveRef.current) return;
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
    if (shortTimerRef.current) {
      window.clearTimeout(shortTimerRef.current);
      shortTimerRef.current = null;
    }
    if (shortDelayTimerRef.current) {
      window.clearTimeout(shortDelayTimerRef.current);
      shortDelayTimerRef.current = null;
    }
    if (terminalActionTimerRef.current) {
      window.clearTimeout(terminalActionTimerRef.current);
      terminalActionTimerRef.current = null;
    }
    if (limitImpactTimerRef.current) {
      window.clearTimeout(limitImpactTimerRef.current);
      limitImpactTimerRef.current = null;
    }
    setBattleAnnouncement(null);
    setConditionAnnouncement(null);
    setLimitImpactActive(false);
    setFinalPushActive(false);
    setFloaters([]);
    if (!cinematic) {
      finalizeBattle(result, method, rawOwnership, resolvedDefeatReason);
      return;
    }

    decisiveRef.current = true;
    changeBattlePhase('decisive');
    setGaugeSpeed(0);
    updateGauge(result === 'player' ? -99.2 : 99.2);
    setDecisiveBlow({ winner: result, impacted: false });
    setStatusText(
      isTraining
        ? result === 'player'
          ? '訓練決着――最後の資金が木人の耐久を削り切る！'
          : '訓練終了――木人の耐久資本に押し戻される！'
        : result === 'player'
          ? '決着の一撃――最後の資金が防衛線へ届く！'
          : resolvedDefeatReason === 'WALKING_DEAD_FAILED'
            ? '蘇生猶予終了――最後の防衛線が崩壊する！'
            : '決着の一撃――競合の大口防衛出資が直撃！'
    );
    playMotion(result === 'player' ? 'player' : 'enemy');
    soundFx.playDecisiveBlow(result);

    decisiveImpactTimerRef.current = window.setTimeout(() => {
      updateGauge(result === 'player' ? -100 : 100);
      setDecisiveBlow({ winner: result, impacted: true });
      soundFx.playCapitalImpact(result === 'player' ? 'player' : 'opponent', 1);
    }, BATTLE_CINEMATIC_TIMING.decisiveImpactMs);
    decisiveClearTimerRef.current = window.setTimeout(() => {
      setDecisiveBlow(null);
      setStatusText(
        result === 'player'
          ? '決着――競合の防衛線が崩れる'
          : '決着――自社の防衛線が崩れる'
      );
    }, BATTLE_CINEMATIC_TIMING.decisiveClearMs);
    decisiveResolveTimerRef.current = window.setTimeout(() => {
      decisiveRef.current = false;
      finalizeBattle(result, method, rawOwnership, resolvedDefeatReason);
    }, BATTLE_CINEMATIC_TIMING.decisiveResolveMs);
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
    setStatusText('WALKING DEAD――10秒以内に所有率30％まで押し戻してください');
    showFloater('WALKING DEAD / 1%', 'center', 'notice');
    playMotion('player');
    soundFx.playWarning();
    soundFx.playSkillSpark();
    addLog('リビングデッド発動。所有率1％で踏みとどまり、10秒の蘇生猶予へ移行。', 'skill');
    return true;
  };

  const showShortNotice = () => {
    if (
      isTraining ||
      shortShownRef.current ||
      !canShowShortNotice({
        battlePhase: battlePhaseRef.current,
        ended: endedRef.current,
        decisive: decisiveRef.current,
      })
    ) {
      return;
    }
    shortShownRef.current = true;
    setMotion('idle');
    setGaugeSpeed(0);
    setStatusText('SHORT――敵の防衛資金が枯渇。最後の一手で決着をつけてください');
    changeBattlePhase('short_notice');
    addLog('SHORT！ 競合の追加防衛資金が枯渇。', 'result');
    soundFx.playWarning();
    if (shortTimerRef.current) window.clearTimeout(shortTimerRef.current);
    shortTimerRef.current = window.setTimeout(() => {
      shortTimerRef.current = null;
      if (endedRef.current || decisiveRef.current) return;
      changeBattlePhase('active');
      setStatusText('敵は追加防衛不能。自社資金のFINAL PUSHかLIMIT BREAKで決着してください');
    }, BATTLE_CINEMATIC_TIMING.shortNoticeMs);
  };

  const commitEnemyFunds = (
    requested: number,
    reason: string,
    applyGaugeShock = true,
    scheduleShort = true,
    chargeLimit = true
  ) => {
    if (isTraining) {
      return { actual: 0, counterShock: 0 };
    }
    const actual = Math.max(0, Math.min(Math.round(requested), enemyReserveRef.current));
    if (actual <= 0) {
      setAiText('SHORT / 追加防衛不能');
      if (!isTraining && scheduleShort) showShortNotice();
      return { actual: 0, counterShock: 0 };
    }
    if (enemyDisruption > 0 && Math.random() < enemyDisruption) {
      const collapse = Math.min(
        enemyInvested,
        Math.round(targetProperty.marketPrice * TACTICAL_SKILL_BALANCE.disruption.collapseMarketRatio)
      );
      setEnemyInvested((value) => Math.max(0, value - collapse));
      if (chargeLimit) {
        chargeLimitBreak(collapse * currentWind.playerMultiplier);
      }
      setStatusText(`連環計が成功。敵の資金源から${formatCurrency(collapse)}が離脱`);
      showFloater(`離脱 -${formatCurrency(collapse)}`, 'enemy', 'negative');
      playMotion('rebel');
      addLog(`連環計により競合資金${formatCurrency(collapse)}が崩落。`, 'skill');
      return { actual: 0, counterShock: 0 };
    }
    const nextReserve = enemyReserveRef.current - actual;
    enemyReserveRef.current = nextReserve;
    setEnemyReserve(nextReserve);
    setEnemyInvested((value) => value + actual);
    if (chargeLimit) {
      chargeLimitBreak(actual * currentWind.enemyMultiplier);
    }
    const counterShock = Math.min(10, (1.5 + (actual / Math.max(targetProperty.marketPrice, 1)) * 18) * currentWind.enemyMultiplier);
    if (applyGaugeShock) {
      updateGauge((value) =>
        livingDeadPhaseRef.current === 'recovery'
          ? value + counterShock
          : Math.min(99, value + counterShock)
      );
    }
    setStatusText(`敵大規模防衛出資――${formatCurrency(actual)}を対抗投入`);
    setAiText(nextReserve > 0 ? '次の敵大規模防衛出資を詠唱中' : 'SHORT / 追加防衛不能');
    showFloater(`防衛 +${formatCurrency(actual)}`, 'enemy', 'negative');
    playMotion('enemy');
    soundFx.playCapitalImpact('opponent', actual / Math.max(targetProperty.marketPrice, 1));
    addLog(`${reason}として${formatCurrency(actual)}を投入。残予算${formatCurrency(nextReserve)}。`, 'enemy');
    if (!isTraining && nextReserve <= 0 && scheduleShort) {
      if (shortDelayTimerRef.current) {
        window.clearTimeout(shortDelayTimerRef.current);
      }
      shortDelayTimerRef.current = window.setTimeout(() => {
        shortDelayTimerRef.current = null;
        showShortNotice();
      }, BATTLE_CINEMATIC_TIMING.shortDelayMs);
    }
    return { actual, counterShock };
  };

  useEffect(() => {
    if (timeScale <= 0 || winner) return;
    const interval = window.setInterval(() => {
      const elapsed = 50 * timeScale;
      const commandProgressPerTick = fastHorse
        ? TACTICAL_SKILL_BALANCE.fastAction.boostedCommandProgressPerTick
        : TACTICAL_SKILL_BALANCE.fastAction.baseCommandProgressPerTick;
      const commandScale = tutorialAssistActive ? 1 : timeScale;
      setCommandProgress((value) => Math.min(100, value + commandProgressPerTick * commandScale));
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
      setEnemySlowedRemaining((value) => Math.max(0, value - elapsed));
      setEnemyDisruptionRemaining((value) => Math.max(0, value - elapsed));
      setPushMultiplierRemaining((value) => Math.max(0, value - elapsed));
      setEraWindRemaining((value) => Math.max(0, value - elapsed));
      if (livingDeadPhaseRef.current === 'waiting' || livingDeadPhaseRef.current === 'recovery') {
        const nextRemaining = Math.max(0, livingDeadRemainingRef.current - elapsed);
        livingDeadRemainingRef.current = nextRemaining;
        setLivingDeadRemaining(nextRemaining);
      }
    }, 50);
    return () => window.clearInterval(interval);
  }, [fastHorse, timeScale, tutorialAssistActive, winner]);

  useEffect(() => {
    if (winner) return;
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
      setStatusText('DEAD REBIRTH――所有率30％へ復帰。買収戦を続行します');
      showFloater('DEAD REBIRTH / SUCCESS', 'player', 'positive');
      soundFx.playFeatureUnlocked();
      addLog('蘇生成功。所有率30％以上へ戻し、リビングデッドを完遂。', 'result');
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
      addLog('蘇生猶予終了。所有率30％へ届かず、リビングデッド失敗。', 'result');
      finishBattle('opponent', 'NORMAL', ownership, true, 'WALKING_DEAD_FAILED');
    }
  }, [livingDeadPhase, livingDeadRemaining, normalizedOwnership, winner]);

  useEffect(() => {
    if (timeScale <= 0 || winner || battlePhase !== 'active') return;
    const interval = window.setInterval(() => {
      if (battleCashRecoveredRef.current >= battleCashRecoveryCap) return;
      const scaledGain = battleCashRecoveryPerSecond * 0.1 * timeScale + recoveryCarryRef.current;
      const wholeGil = Math.floor(scaledGain);
      recoveryCarryRef.current = scaledGain - wholeGil;
      if (wholeGil <= 0) return;
      const actual = Math.min(wholeGil, battleCashRecoveryCap - battleCashRecoveredRef.current);
      battleCashRecoveredRef.current += actual;
      setBattleCashRecovered(battleCashRecoveredRef.current);
      setCash((value) => value + actual);
    }, 100);
    return () => window.clearInterval(interval);
  }, [battleCashRecoveryCap, battleCashRecoveryPerSecond, battlePhase, timeScale, winner]);

  useEffect(() => {
    if (
      isTraining ||
      timeScale <= 0 ||
      winner ||
      battlePhase !== 'active' ||
      decisiveRef.current ||
      enemyReserveRef.current <= 0
    ) {
      return;
    }
    const step = (100 / (enemyDecision.waitMs / 100)) * timeScale;
    const interval = window.setInterval(() => {
      setAiProgress((value) => Math.min(100, value + step));
    }, 100);
    return () => window.clearInterval(interval);
  }, [battlePhase, enemyDecision.waitMs, isTraining, timeScale, winner]);

  useEffect(() => {
    if (isTraining) {
      resolvingAiActionRef.current = false;
      return;
    }
    if (aiProgress < 100) {
      resolvingAiActionRef.current = false;
      return;
    }
    if (
      timeScale <= 0 ||
      winner ||
      battlePhase !== 'active' ||
      decisiveRef.current
    ) {
      return;
    }
    if (resolvingAiActionRef.current) return;
    resolvingAiActionRef.current = true;

    if (!isTraining && enemyReserveRef.current <= 0) {
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
    setAiCycle((cycle) => cycle + 1);
    setLastPlayerAction(null);
    setAiProgress(0);
  }, [
    aiProgress,
    battlePhase,
    enemyDecision,
    isTraining,
    targetProperty.marketPrice,
    timeScale,
    winner,
  ]);

  useEffect(() => {
    lastTickRef.current = performance.now();
    if (timeScale <= 0 || winner) {
      setGaugeSpeed(0);
      return;
    }
    const tick = (now: number) => {
      if (decisiveRef.current) {
        setGaugeSpeed(0);
        lastTickRef.current = now;
        animationRef.current = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(0.1, (now - lastTickRef.current) / 1000) * timeScale;
      lastTickRef.current = now;
      const baseVelocity = calculateGaugeVelocity(
        totalPlayerInvested * currentWind.playerMultiplier,
        enemyInvested * currentWind.enemyMultiplier,
        targetProperty.marketPrice,
        pushMultiplier * (1 + influenceBonus)
      );
      const gapRatio = Math.abs(effectiveCapitalGap) / Math.max(targetProperty.marketPrice, 1);
      const leverage = 1 + Math.min(2.4, gapRatio * 3.2);
      const deadZone = gapRatio < 0.025 ? 0.32 : 1;
      const velocity = applyTrainingGaugeSpeed(
        baseVelocity *
          BATTLE_GAUGE_SPEED_FACTOR *
          leverage *
          deadZone *
          currentWind.speedMultiplier -
          (eraWindActive ? eraWindPushPerSecond : 0),
        isTraining
      );
      setGaugeSpeed(velocity);
      const next = gaugeRef.current + velocity * dt;
      const heldNext = isTraining
        ? next
        : holdGaugeForManualShortFinish(
            next,
            enemyReserveRef.current
          );
      const practiceHeldNext = holdTrainingGaugeAboveDefeat(heldNext, isTraining);
      if (practiceHeldNext !== next) {
        setGaugeSpeed(0);
        updateGauge(practiceHeldNext);
      } else if (next <= -100) {
        finishBattle('player', 'NORMAL', (100 - next) / 2);
      } else if (next >= 100) {
        if (triggerWalkingDead()) {
          updateGauge(livingDeadGaugeFloor);
        } else if (livingDeadPhaseRef.current === 'recovery') {
          updateGauge(next);
        } else {
          finishBattle('opponent', 'NORMAL', 0);
        }
      } else {
        updateGauge(next);
      }
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [currentWind.enemyMultiplier, currentWind.playerMultiplier, currentWind.speedMultiplier, effectiveCapitalGap, enemyInvested, eraWindActive, eraWindPushPerSecond, influenceBonus, isTraining, pushMultiplier, targetProperty.marketPrice, timeScale, totalPlayerInvested, updateGauge, winner]);

  const investCompanyFunds = () => {
    if (cash < selectedCost) {
      soundFx.playWarning();
      setStatusText(`自社資金不足。必要額は${formatCurrency(selectedCost)}`);
      return;
    }
    if (!consumeCommand()) return;
    setPanel('capital');
    const impact = Math.min(14, (1.2 + (selectedCost / Math.max(targetProperty.marketPrice, 1)) * 20) * currentWind.playerMultiplier);
    const rawGaugeAfter = gaugeRef.current - impact;
    setCash((value) => value - selectedCost);
    setCompanyInvested((value) => value + selectedCost);
    chargeLimitBreak(selectedCost * currentWind.playerMultiplier);
    updateGauge(Math.max(-99, rawGaugeAfter));
    setStatusText(`自社資金から${formatCurrency(selectedCost)}を積み増し`);
    showFloater(`+${formatCurrency(selectedCost)}`, 'player');
    playMotion('player');
    soundFx.playCapitalImpact('player', selectedLevel / 5);
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

    if (!isTraining && enemyReserveRef.current <= 0) {
      setFinalPushActive(true);
      changeBattlePhase('limit_charge');
      announceBattle('final', BATTLE_CINEMATIC_TIMING.finalAnnouncementMs);
      setGaugeSpeed(0);
      setStatusText(`FINAL PUSH――${formatCurrency(selectedCost)}で最後の防衛線を突破！`);
      showFloater(`FINAL +${formatCurrency(selectedCost)}`, 'player');
      soundFx.playFinalPush();
      const rawFinishOwnership = Math.max(
        (100 - rawGaugeAfter) / 2,
        100 + (selectedCost / Math.max(targetProperty.marketPrice, 1)) * 50
      );
      if (terminalActionTimerRef.current) {
        window.clearTimeout(terminalActionTimerRef.current);
      }
      terminalActionTimerRef.current = window.setTimeout(() => {
        terminalActionTimerRef.current = null;
        finishBattle('player', 'FINAL_PUSH', rawFinishOwnership);
      }, BATTLE_CINEMATIC_TIMING.finalDecisiveStartMs);
      return;
    }

    if (rawGaugeAfter <= -100) {
      finishBattle('player', 'NORMAL', (100 - rawGaugeAfter) / 2);
    }
  };

  const canConfirmInvestment =
    commandReady &&
    !!maxAffordableConfig &&
    cash >= selectedCost &&
    !actionsLocked;

  const cycleInvestmentLevel = (direction = 1) => {
    const affordableLevels = INVESTMENT_LEVELS.filter(
      (item) => getInvestmentCost(targetProperty.marketPrice, item.level) <= cash
    );
    if (affordableLevels.length === 0) {
      soundFx.playWarning();
      setStatusText('自社資金不足。商流回復か資金源からの支援を待ってください');
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
    const nextRisk = Math.min(100, property.loyaltyRisk + 18);
    const amount = Math.round(property.marketPrice * 0.45);
    const rejects = Math.random() < calculateRebellionProbability(nextRisk);
    setSubRequestCounts((current) => ({ ...current, [property.id]: (current[property.id] || 0) + 1 }));

    if (rejects) {
      const lost = subContributions[property.id] || 0;
      setBattleSubs((current) => current.filter((item) => item.id !== property.id));
      setDemandInvested((value) => Math.max(0, value - lost));
      chargeLimitBreak(lost * currentWind.enemyMultiplier);
      setRebelled((current) => [...current, { ...property, loyaltyRisk: 100 }]);
      setStatusText(`${property.name}が出資を拒否し独立！ ${formatCurrency(lost)}が崩落`);
      showFloater(`独立 -${formatCurrency(lost)}`, 'player', 'negative');
      playMotion('rebel');
      soundFx.playWarning();
      addLog(`${property.name}が資金要求を拒否して独立。過去の支援${formatCurrency(lost)}も失われた。`, 'funds');
      return;
    }

    setBattleSubs((current) => current.map((item) => item.id === property.id ? { ...item, loyaltyRisk: nextRisk } : item));
    setSubContributions((current) => ({ ...current, [property.id]: (current[property.id] || 0) + amount }));
    setDemandInvested((value) => value + amount);
    chargeLimitBreak(amount * currentWind.playerMultiplier);
    const impact = Math.min(6.5, (1 + (amount / Math.max(targetProperty.marketPrice, 1)) * 8) * currentWind.playerMultiplier);
    updateGauge((value) => Math.max(-99, value - impact));
    setStatusText(`${property.name}から${formatCurrency(amount)}を調達。独立危険度${nextRisk}%`);
    showFloater(`+${formatCurrency(amount)}`, 'player');
    playMotion('player');
    soundFx.playBigCash();
    addLog(`${property.name}へ第${(subRequestCounts[property.id] || 0) + 1}次資金要求。${formatCurrency(amount)}を調達、独立危険度${nextRisk}%。`, 'funds');
  };

  const demandFromAllies = () => {
    if (limitBreakTier === 0 || !consumeCommand()) return;
    setPanel('capital');
    setLastPlayerAction('LIMIT_BREAK');
    setActiveLimitBreakTier(limitBreakTier);
    onLimitBreakChargeChange(consumeLimitBreakCharge);
    changeBattlePhase('limit_charge');
    setGaugeSpeed(0);
    announceBattle('limit', BATTLE_CINEMATIC_TIMING.limitAnnouncementMs);
    soundFx.playLimitBreak();

    const leaving: Property[] = [];
    const survivors: Property[] = [];
    let lost = 0;
    battleSubs.forEach((member) => {
      const nextRisk = Math.min(100, member.loyaltyRisk + 12);
      if (Math.random() < calculateRebellionProbability(nextRisk)) {
        leaving.push({ ...member, loyaltyRisk: 100 });
        lost += subContributions[member.id] || 0;
      } else {
        survivors.push({ ...member, loyaltyRisk: nextRisk });
      }
    });

    const amount = calculateLimitBreakAmount(
      targetProperty.marketPrice,
      survivors,
      limitBreakTier
    );
    setStatusText(`LIMIT BREAK ${limitBreakTier}――自社と支援元${survivors.length}件の出資を集約中`);
    addLog(`LIMIT BREAK ${limitBreakTier}発動。自社と支援元${battleSubs.length}件が一斉出資へ参加。`, 'skill');

    limitBreakTimerRef.current = window.setTimeout(() => {
      limitBreakTimerRef.current = null;
      if (endedRef.current) return;
      // The fan-kit cue owns the charge-up. Fade it before the capital impact
      // so a cached cue or a late first decode cannot spill into the decisive
      // slow-motion and WIN presentation.
      soundFx.stopBattleCinematicAudio(160);
      setBattleSubs((current) => current
        .filter((item) => !leaving.some((leaver) => leaver.id === item.id))
        .map((item) => survivors.find((survivor) => survivor.id === item.id) || item));
      setSubRequestCounts((current) => {
        const next = { ...current };
        battleSubs.forEach((member) => {
          next[member.id] = (next[member.id] || 0) + 1;
        });
        return next;
      });
      setSubContributions((current) => {
        const next = { ...current };
        survivors.forEach((member) => {
          const support = Math.round(member.marketPrice * 0.28 * limitBreakMultiplier);
          next[member.id] = (next[member.id] || 0) + support;
        });
        leaving.forEach((member) => delete next[member.id]);
        return next;
      });
      if (leaving.length) setRebelled((current) => [...current, ...leaving]);
      setDemandInvested((value) => Math.max(0, value - lost) + amount);
      setLimitImpactActive(true);
      if (limitImpactTimerRef.current) window.clearTimeout(limitImpactTimerRef.current);
      limitImpactTimerRef.current = window.setTimeout(() => setLimitImpactActive(false), 1450);

      soundFx.playCapitalImpact('player', 1);
      soundFx.playBigCash();
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
            false
          )
        : { actual: 0, counterShock: 0 };
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
      const terminalLimitBreak = rawOwnershipAfter >= 100;
      const rawGaugeAfter = 100 - rawOwnershipAfter * 2;
      updateGauge(
        livingDeadPhaseRef.current === 'recovery'
          ? Math.max(-100, rawGaugeAfter)
          : Math.max(-100, Math.min(100, rawGaugeAfter))
      );
      const limitBreakResultText =
        `LIMIT BREAK ${limitBreakTier}！ 所有率+${ownershipPush.toFixed(1)}pt` +
        (defenseResult.actual > 0
          ? ` / 緊急防衛-${defenseOwnershipPushback.toFixed(1)}pt`
          : '');
      showFloater(`LB 所有率 +${ownershipPush.toFixed(1)}pt`, 'player');
      if (defenseResult.actual > 0) {
        showFloater(
          `緊急防衛 -${defenseOwnershipPushback.toFixed(1)}pt`,
          'enemy',
          'negative'
        );
      }
      addLog(limitBreakResultText, 'skill');
      playMotion(leaving.length ? 'rebel' : 'player');

      if (leaving.length) {
        setStatusText(`DEFECT！ ${leaving.map((member) => member.name).join('・')}が支援を撤回。残存投入${formatCurrency(amount)}`);
        addLog(`DEFECT！ ${leaving.map((member) => member.name).join('・')}が離反し、過去支援${formatCurrency(lost)}が崩落。`, 'funds');
      } else {
        setStatusText(limitBreakResultText);
      }

      if (terminalLimitBreak) {
        if (terminalActionTimerRef.current) {
          window.clearTimeout(terminalActionTimerRef.current);
        }
        terminalActionTimerRef.current = window.setTimeout(() => {
          terminalActionTimerRef.current = null;
          finishBattle(
            'player',
            `LIMIT_BREAK_${limitBreakTier}` as FinishMethod,
            rawOwnershipAfter
          );
        }, BATTLE_CINEMATIC_TIMING.limitTerminalImpactMs);
        return;
      }
      const reducedMotion = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)'
      ).matches ?? false;
      if (!reducedMotion) {
        confetti({
          particleCount: window.innerWidth <= 640 ? 30 : 72,
          spread: 78,
          startVelocity: window.innerWidth <= 640 ? 26 : 34,
          ticks: window.innerWidth <= 640 ? 72 : 100,
          scalar: window.innerWidth <= 640 ? 0.74 : 0.88,
          origin: { y: 0.62 },
          colors: ['#fef08a', '#f59e0b', '#34d399', '#ffffff'],
          disableForReducedMotion: true,
        });
      }
      changeBattlePhase('active');
      setBattleAnnouncement(null);
      setLastPlayerAction(null);
      setAiProgress(0);
      setAiCycle((cycle) => cycle + 1);
      if (!isTraining && enemyReserveRef.current <= 0) showShortNotice();
    }, BATTLE_CINEMATIC_TIMING.limitResolveMs);
  };

  const demandFromGroup = (
    name: string,
    members: Property[],
    groupMultiplier: number
  ) => {
    if (!consumeCommand()) return;
    setPanel('capital');
    setLastPlayerAction('SYNERGY');
    let amount = 0;
    let lost = 0;
    const leaving: Property[] = [];
    const survivors: Property[] = [];

    members.forEach((member) => {
      const nextRisk = Math.min(100, member.loyaltyRisk + 14);
      if (Math.random() < calculateRebellionProbability(nextRisk)) {
        leaving.push({ ...member, loyaltyRisk: 100 });
        lost += subContributions[member.id] || 0;
      } else {
        survivors.push({ ...member, loyaltyRisk: nextRisk });
        amount += Math.round(member.marketPrice * 0.34);
      }
    });
    amount = Math.round(amount * groupMultiplier);

    setBattleSubs((current) => current
      .filter((item) => !leaving.some((leaver) => leaver.id === item.id))
      .map((item) => survivors.find((survivor) => survivor.id === item.id) || item));
    if (leaving.length) setRebelled((current) => [...current, ...leaving]);
    setDemandInvested((value) => Math.max(0, value - lost) + amount);
    chargeLimitBreak(amount * currentWind.playerMultiplier);
    chargeLimitBreak(lost * currentWind.enemyMultiplier);
    setSubContributions((current) => {
      const next = { ...current };
      survivors.forEach((member) => {
        next[member.id] =
          (next[member.id] || 0) +
          Math.round(member.marketPrice * 0.34 * groupMultiplier);
      });
      leaving.forEach((member) => delete next[member.id]);
      return next;
    });
    const groupImpact = Math.min(12, (2 + (amount / Math.max(targetProperty.marketPrice, 1)) * 7) * currentWind.playerMultiplier);
    updateGauge((value) => Math.max(-99, value - groupImpact));
    playMotion(leaving.length ? 'rebel' : 'player');
    soundFx.playBigCash();
    announceSynergy(name, `${members.length}件連携 / +${formatCurrency(amount)}`);
    if (leaving.length) {
      setStatusText(`${name}が発動。しかし${leaving.length}件が独立し${formatCurrency(lost)}崩落`);
      addLog(`${name}から${formatCurrency(amount)}を調達したが、${leaving.map((item) => item.name).join('・')}が独立。`, 'funds');
    } else {
      setStatusText(`${name}発動！ ${formatCurrency(amount)}を一斉調達`);
      addLog(`${name}の支援元${members.length}件から${formatCurrency(amount)}を一斉調達。`, 'funds');
    }
  };

  const requestAlliance = () => {
    if (!alliance.active || allianceUsed || !consumeCommand()) return;
    setPanel('capital');
    setLastPlayerAction('ALLIANCE');
    const amount = calculateAllianceSupport(targetProperty.marketPrice);
    setDemandInvested((value) => value + amount);
    chargeLimitBreak(amount * currentWind.playerMultiplier);
    setAllianceUsed(true);
    setStatusText(alliancePublicPatronage
      ? `${alliance.allyName}へ通商支援を要請――後援支援 +${formatCurrency(amount)}相当`
      : `${alliance.allyName}から${formatCurrency(amount)}の協力支援`);
    showFloater(alliancePublicPatronage
      ? `後援支援 +${formatCurrency(amount)}`
      : `協力支援 +${formatCurrency(amount)}`, 'player');
    playMotion('player');
    soundFx.playBigCash();
    addLog(alliancePublicPatronage
      ? `${alliance.allyName}へ通商支援を要請。許認可・調達・輸送を含む${formatCurrency(amount)}相当の後援支援。`
      : `${alliance.allyName}へ協力支援を要請。${formatCurrency(amount)}を調達。`, 'funds');
  };

  const useSkill = (skill: TacticalSkill) => {
    if (skill.effectType === 'ERA_WIND') {
      if (eraWindUseLimitReached) {
        soundFx.playWarning();
        setStatusText('時代の風は1交渉につき最大3回までです');
        return;
      }
      if (cash < nextEraWindCost) {
        soundFx.playWarning();
        setStatusText(
          `時代の風に必要な運用資金は${formatCurrency(nextEraWindCost)}です`
        );
        return;
      }
    }
    if (
      (isTraining && isRivalOnlySkill(skill)) ||
      (skillCooldowns[skill.id] || 0) > 0 ||
      (skill.oncePerBattle && usedSkillIds.has(skill.id)) ||
      !consumeCommand()
    ) return;
    setPanel('capital');
    setSkillCooldowns((current) => ({ ...current, [skill.id]: skill.cooldownMs }));
    if (skill.oncePerBattle) {
      setUsedSkillIds((current) => new Set(current).add(skill.id));
    }
    const targetsRival =
      skill.effectType === 'INDEPENDENCE_SABOTAGE' ||
      skill.effectType === 'DEMORALIZE';
    showFloater(
      skill.name,
      targetsRival ? 'enemy' : 'player',
      targetsRival ? 'negative' : 'positive'
    );
    playMotion('player');
    soundFx.playSkillSpark();

    if (skill.effectType === 'COOLDOWN_REDUCTION') {
      setFastHorseRemaining(TACTICAL_SKILL_BALANCE.fastAction.durationMs);
      setStatusText('疾風怒濤の計――10秒間、行動準備ゲージの進行速度が約1.8倍');
    } else if (skill.effectType === 'NEMAWASHI') {
      setBattleSubs((current) => current.map((item) => ({
        ...item,
        loyaltyRisk: Math.floor(
          item.loyaltyRisk / TACTICAL_SKILL_BALANCE.moraleSupport.loyaltyRiskDivisor
        ),
      })));
      setStatusText('守りのサンバ――全支援元の独立危険度が半減');
    } else if (skill.effectType === 'INDEPENDENCE_SABOTAGE') {
      setEnemyDisruptionRemaining(TACTICAL_SKILL_BALANCE.disruption.durationMs);
      setStatusText('連環計――9秒間、競合の追加防衛を70%で中断');
    } else if (skill.effectType === 'DEMORALIZE') {
      setEnemySlowedRemaining(TACTICAL_SKILL_BALANCE.demoralize.durationMs);
      setStatusText('消沈――競合の指揮系統を乱し、命令待ち時間を延長');
    } else if (skill.effectType === 'CAPITAL_BOOST') {
      const amount = Math.round(
        targetProperty.marketPrice * TACTICAL_SKILL_BALANCE.capitalBoost.marketRatio
      );
      setDemandInvested((value) => value + amount);
      chargeLimitBreak(amount * currentWind.playerMultiplier);
      setStatusText(`意気衝天――無料支援資金${formatCurrency(amount)}を即時投入`);
      showFloater(`+${formatCurrency(amount)}`, 'player');
    } else if (skill.effectType === 'LIVING_DEAD') {
      updateLivingDeadState(
        'waiting',
        TACTICAL_SKILL_BALANCE.livingDead.waitingDurationMs
      );
      setStatusText('リビングデッド――10秒間、所有率0％への到達を待機');
      showFloater('LIVING DEAD / ARMED', 'player', 'notice');
    } else if (skill.effectType === 'SYNERGY_PUSH') {
      setPushMultiplierRemaining(TACTICAL_SKILL_BALANCE.battleLitany.durationMs);
      setStatusText('バトルリタニー――7秒間、所有率の押し込み速度が1.5倍');
    } else if (skill.effectType === 'ERA_WIND') {
      const nextUse = eraWindUses + 1;
      const pushPerSecond = getEraWindGaugePushPerSecond(eraWindUses);
      setCash((value) => Math.max(0, value - nextEraWindCost));
      setEraWindUses(nextUse);
      setEraWindRemaining(TACTICAL_SKILL_BALANCE.eraWind.durationMs);
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
      setStatusText(
        `時代の風――${formatCurrency(nextEraWindCost)}を運用し、12秒間 時流+${pushPerSecond.toFixed(1)}pt/秒`
      );
      showFloater(
        `風が……来る！ 時流+${pushPerSecond.toFixed(1)}`,
        'player',
        'positive'
      );
      announceCondition({
        kind: 'player',
        kicker: `ERA WIND / PHASE ${nextUse}`,
        title: '時代の風',
        detail: `敵資金を残したまま、自社側へ時流+${pushPerSecond.toFixed(1)}pt/秒`,
      }, BATTLE_CINEMATIC_TIMING.conditionAnnouncementMs);
    }
    addLog(`${skill.name}を使用。${skill.description}`, 'skill');
  };

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
        isUltimate ? 'ultimate' : isSavage ? 'savage' : 'normal',
        targetProperty.owner === 'player'
      );
  const resultLiquidationCashback = isProtectedBattle
    ? 0
    : Array.from(
        new Map(rebelled.map((property) => [property.id, property])).values()
      ).reduce((total, property) => total + property.marketPrice, 0);
  const resultFundsDelta = isTraining
    ? 0
    : resultVictoryReward +
      resultLiquidationCashback -
      brokerageFee -
      resultSettlementCost;

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
    resultConfirmedRef.current = true;
    resultConfirmArmedRef.current = false;
    setResultConfirmArmed(false);
    onBattleEnd({
      winner,
      targetProperty,
      companyFundsInvested: companyInvested,
      demandFundsInvested: demandInvested,
      brokerageFee,
      settlementCost: resultSettlementCost,
      battleCashDelta: 0,
      victoryReward: resultVictoryReward,
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
  };

  const resultAnalysis = isTraining
    ? winner === 'player'
      ? demandInvested > companyInvested
        ? `支援元・協力先の支援を組み合わせ、木人耐久資本を削り切ったでっす。訓練中の出資と離反は通常の事業・契約へ残らないでっす。`
        : `自社資金の投入順が安定していたでっす。同じLEVELへ何度でも挑み、有効なスキルやLIMIT BREAKも試せるでっす。`
      : rebelled.length > 0
        ? `${rebelled.length}件が訓練中に一時離脱したでっす。通常の事業・契約は保護されるので、支援の順番を変えて再挑戦するでっす。`
        : '木人の初期耐久資本を削り切れなかったでっす。費用も進行変化もないので、投入順を変えて再挑戦するでっす。'
    : winner === 'player'
      ? finishMethod.startsWith('LIMIT_BREAK')
        ? '勝因はカンパニー網の総動員でっす。LIMIT BREAKの全支援元一斉出資で、所有率を一気に押し切ったでっす。'
        : demandInvested > companyInvested
          ? `勝因は支援元・協力先からの支援でっす。合計${formatCurrency(demandInvested)}の支援が競り値を押し上げたでっす。`
          : finishMethod === 'FINAL_PUSH'
            ? `勝因は自社資金の決断でっす。SHORT後までギルを残し、${FINISH_LABELS[finishMethod]}で決着したでっす。`
            : `勝因は資金差の維持でっす。競合の防衛中も出資優位を保ち、${FINISH_LABELS[finishMethod]}で所有率を押し切ったでっす。`
      : defeatReason === 'WALKING_DEAD_FAILED'
        ? 'リビングデッドは発動したでっすが、10秒以内に所有率30％へ戻せなかったでっす。蘇生猶予では意気衝天や大口出資を温存しておくでっす。'
        : rebelled.length > 0
          ? isHighEndRaid
            ? `${rebelled.length}件が記録戦中に一時離脱し、支援の山が崩れたでっす。通常の事業・契約は保護されるので、資金要求の順番を組み直すでっす。`
            : `${rebelled.length}件の独立で資金の山が崩れたでっす。次は独立危険度の高い支援元へ要求する前に、危険度を抑えるスキルを使うでっす。`
          : '風と支援を反映した競り値で劣勢となり、所有率を押し戻されたでっす。';

  const briefingSynergies = [
    ...(battleSubs.length + 1 >= 4
? [`ライトパーティ：自社＋支援元${battleSubs.length}件・SYNERGY / 味方追い風でBURST TIME`]
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
            battleSynergyReady
              ? `${selectedBattleSynergyMembers.length}件で発動可能`
              : '必要な事業・契約が不足'
          }`,
        ]
      : []),
    ...(tradeNetworkBonus > 0 ? [`都市交易網：自社押込 +${Math.round(tradeNetworkBonus * 100)}%`] : []),
  ];
  const cinematicLayer = getBattleCinematicLayer({
    battlePhase,
    hasBattleAnnouncement: !!battleAnnouncement,
    hasConditionAnnouncement: !!conditionAnnouncement,
    hasDecisiveBlow: !!decisiveBlow,
    hasWinner: !!winner,
    finishTelegraphVisible,
  });

  return (
    <div
      ref={rootDialogRef}
      className={`buyout-screen buyout-screen--phase-${battlePhase} buyout-screen--living-${livingDeadPhase} ${isTraining ? 'buyout-screen--training' : ''} ${limitImpactActive ? 'buyout-screen--limit-impact' : ''} ${isBurstTime ? 'buyout-screen--burst' : ''} ${decisiveBlow ? `buyout-screen--decisive buyout-screen--decisive-${decisiveBlow.winner}` : ''}`}
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
      <img className="buyout-backdrop" src={FANKIT_ART.battleBackdrop} alt="" aria-hidden="true" />
      {limitImpactActive && <div className="limit-impact-field" aria-hidden="true"><i /><i /><i /><i /><i /></div>}

      {cinematicLayer === 'battle_announcement' && battleAnnouncement && (
        <div className={`battle-announcement battle-announcement--${battleAnnouncement}`} aria-live="assertive">
          <div>
            <small>{battleAnnouncement === 'start' ? isTraining ? 'TRAINING COMMENCED' : 'CONTENT COMMENCED' : battleAnnouncement === 'limit' ? `LIMIT BREAK ${activeLimitBreakTier || limitBreakTier}` : 'FINAL PUSH'}</small>
            <strong>{battleAnnouncement === 'start' ? isTraining ? `${targetProperty.name} 訓練開始` : `${targetProperty.name} 討滅戦` : battleAnnouncement === 'limit' ? '全支援元・資金総動員' : '最終買収攻勢'}</strong>
            <span>{battleAnnouncement === 'start' ? `START! / ${companyName}` : battleAnnouncement === 'limit' ? `${battleSubs.length + 1}件の支援を解放` : '最後の一手で買収成立へ'}</span>
          </div>
        </div>
      )}

      {cinematicLayer === 'condition_announcement' && conditionAnnouncement && (
        <div className={`battle-condition-announcement battle-condition-announcement--${conditionAnnouncement.kind}`} aria-live="assertive">
          <div className="battle-condition-announcement__wind" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <div>
            <small>{conditionAnnouncement.kicker}</small>
            <strong>{conditionAnnouncement.title}</strong>
            <span>{conditionAnnouncement.detail}</span>
          </div>
        </div>
      )}

      {livingDeadPhase !== 'inactive' && !decisiveBlow && !winner && (
        <div className={`battle-living-dead battle-living-dead--${livingDeadPhase}`} aria-live="assertive">
          <img src={FANKIT_ART.jobs[1]} alt="" aria-hidden="true" />
          <div>
            <small>{livingDeadPhase === 'waiting' ? 'DARK KNIGHT ACTION' : livingDeadPhase === 'recovery' ? 'RESURRECTION WINDOW' : 'LIVING DEAD RESULT'}</small>
            <strong>{livingDeadPhase === 'waiting' ? 'LIVING DEAD' : livingDeadPhase === 'recovery' ? 'WALKING DEAD' : livingDeadPhase === 'survived' ? 'DEAD REBIRTH' : 'WALKING DEAD FAILED'}</strong>
            <span>{livingDeadPhase === 'waiting'
              ? '致死待機中：所有率0％で1％に踏みとどまる'
              : livingDeadPhase === 'recovery'
                ? `蘇生猶予：所有率30％以上へ回復（現在 ${ownership.toFixed(1)}％）`
                : livingDeadPhase === 'survived'
                  ? '蘇生成功：通常の買収戦へ復帰'
                  : '蘇生失敗：所有率30％へ届かなかった'}</span>
            <i><u style={{ width: `${livingDeadProgress}%` }} /></i>
          </div>
          <b>{livingDeadDuration > 0 ? `${(livingDeadRemaining / 1000).toFixed(1)}秒` : livingDeadPhase === 'survived' ? '成功' : '失敗'}</b>
        </div>
      )}

      <header className="buyout-header" inert={backgroundInert}>
        <div>
          <span>{isTraining ? '商戦木人 訓練中' : isUltimate ? '絶商戦 攻略中' : isSavage ? '商戦 零式 攻略中' : '買収交渉中'}</span>
          <strong className="battle-title-ticker">
            <MarqueeText text={targetProperty.name} />
          </strong>
          <small>
            {battleContextLabel ?? `${targetProperty.community}・${targetProperty.industry}`}
            {battleRegionLabel ? `／${battleRegionLabel}` : ''}
          </small>
        </div>
        <div className="buyout-header__actions">
          <button type="button" onClick={() => setShowHelp(true)} aria-label={isTraining ? '木人訓練の遊び方' : '買収戦の遊び方'}><CircleHelp /></button>
          {battlePhase === 'briefing' && (
            <button type="button" onClick={requestClose} aria-label={isTraining ? '木人一覧へ戻る' : '買収戦を閉じる'}><X /></button>
          )}
        </div>
      </header>

      <main className="buyout-main">
        <section
          className={`battle-stage integrated-battlefield integrated-battlefield--push-${battleDirection} integrated-battlefield--motion-${motion} ${windVisible && eraWindActive ? `integrated-battlefield--era-wind integrated-battlefield--era-wind-${Math.min(3, eraWindUses)}` : ''} ${windVisible && windTelegraphVisible ? 'integrated-battlefield--wind-telegraph' : ''} ${decisiveBlow?.winner === 'player' ? 'integrated-battlefield--finisher-player' : decisiveBlow?.winner === 'opponent' ? 'integrated-battlefield--finisher-enemy' : ''} ${decisiveBlow?.impacted ? 'integrated-battlefield--finisher-impact' : ''} ${winner ? 'integrated-battlefield--settled' : ''} ownership-board--wind-${windSide} ${isSavage ? 'integrated-battlefield--savage' : ''} ${isUltimate ? 'integrated-battlefield--ultimate' : ''}`}
          aria-label="所有率、両陣営、投入資金、行動予兆の統合商戦フィールド"
          inert={backgroundInert}
          data-company-invested={companyInvested}
          style={{
            '--battle-frontline': `${ownership}%`,
            '--capital-pressure': `${capitalPressurePosition}%`,
            '--field-flow-duration': `${Math.max(.46, 1.9 - Math.min(1, ownershipRate / 4))}s`,
          } as React.CSSProperties}
        >
        <div className="battlefield-pressure-lane" aria-hidden="true">
          <i className="battlefield-pressure-lane__player" />
          <i className="battlefield-pressure-lane__enemy" />
          <span className="battlefield-pressure-lane__front"><i /><i /><i /></span>
        </div>
        {playerCapitalVisualStage >= 7 && (
          <span className="battlefield-capital-deluge battlefield-capital-deluge--player" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => (
              <i
                key={index}
                style={{
                  '--deluge-x': `${3 + ((index * 17) % 45)}%`,
                  '--deluge-size': `${0.18 + (index % 4) * 0.055}rem`,
                  animationDelay: `${-(index * 0.19)}s`,
                  animationDuration: `${1.35 + (index % 5) * 0.14}s`,
                } as React.CSSProperties}
              />
            ))}
          </span>
        )}
        {enemyCapitalVisualStage >= 7 && (
          <span className="battlefield-capital-deluge battlefield-capital-deluge--enemy" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => (
              <i
                key={index}
                style={{
                  '--deluge-x': `${52 + ((index * 17) % 45)}%`,
                  '--deluge-size': `${0.18 + (index % 4) * 0.055}rem`,
                  animationDelay: `${-(index * 0.21)}s`,
                  animationDuration: `${1.4 + (index % 5) * 0.13}s`,
                } as React.CSSProperties}
              />
            ))}
          </span>
        )}
        {(isTraining || isSavage || isUltimate) && (
          <div className={`battlefield-raid-marker ${isUltimate ? 'battlefield-raid-marker--ultimate' : ''}`}>
            {isTraining ? (
              <><b>商戦木人</b><span>追加防衛なし・セーブ無影響</span></>
            ) : isUltimate ? (
              <><b>絶商戦</b><span>最終高難度</span></>
            ) : (
              <>
                <b>零式 {savageLayer}/4層</b>
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
              aria-label={`${companyName} 所有率 ${ownership.toFixed(1)}%`}
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
              aria-label={`${targetProperty.name} 所有率 ${(100 - ownership).toFixed(1)}%`}
            >
              <MarqueeText text={targetProperty.name} delayMs={900} />
            </b>
          </div>
          <div className="ownership-duel">
            <div
              className={`ownership-track ownership-track--${battleDirection} wind-field--${windSide} ${finalPushActive ? 'ownership-track--final' : ''} ${motion !== 'idle' ? 'ownership-track--impact' : ''}`}
              aria-label={`${companyName}の所有率${ownership.toFixed(1)}%`}
              style={{ '--flow-duration': `${Math.max(.32, 1.4 - Math.min(1, ownershipRate / 4))}s` } as React.CSSProperties}
            >
              <div className="ownership-track__player" style={{ width: `${ownership}%` }} />
              {windVisible && (
                <>
                  <div className={`battle-wind-magic ${eraWindActive ? 'battle-wind-magic--era' : ''} ${windTelegraphVisible ? 'battle-wind-magic--telegraph' : ''}`} aria-hidden="true"><i /><i /><i /><i /></div>
                  <div key={`${battleWindState.phase}-${presentedWind.type}-${eraWindUses}`} className={`battle-wind-sigil battle-wind-sigil--${windSide} ${eraWindActive ? 'battle-wind-sigil--era' : ''} ${windTelegraphVisible ? 'battle-wind-sigil--telegraph' : ''}`}>
                    <Sparkles /><b>{windHudTitle}</b><span>{windHudDetail}</span>
                    <small>{windTelegraphVisible ? '到来まで' : eraWindActive ? '時流終了まで' : '静穏まで'} {windCountdown}秒</small>
                  </div>
                </>
              )}
              <div className="ownership-track__enemy-flow" style={{ left: `${ownership}%` }} />
              <div className="ownership-track__tension" style={{ left: `${ownership}%` }} />
              <div className="ownership-track__ticks">{Array.from({ length: 9 }).map((_, index) => <i key={index} />)}</div>
              <div className="ownership-track__marker" style={{ left: `${ownership}%` }}><i /><i /><i /></div>
            </div>
          </div>
          <p className={motion === 'rebel' ? 'status-rebel' : ''}>{statusText}</p>
        </section>

        <section className="capital-arena battlefield-capital">
          <div className={`capital-arena__side ${motion === 'player' ? 'is-acting' : motion === 'enemy' || motion === 'rebel' ? 'is-hit' : ''}`}>
            <div className="player-capital-stack">
              <div className="capital-visual-row">
                <GilTower amount={totalPlayerInvested} reserveAmount={cash} marketPrice={targetProperty.marketPrice} side="player" motion={motion} />
                <div className="ownership-fighter ownership-fighter--player">
                  <img
                    key={`player-${motionSerial}`}
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
                    {pushMultiplierRemaining > 0 && (
                      <span role="img" aria-label={`バトルリタニー 残り${Math.ceil(pushMultiplierRemaining / 1000)}秒`} title={`バトルリタニー 残り${Math.ceil(pushMultiplierRemaining / 1000)}秒`}>
                        <Sparkles /><b>{Math.ceil(pushMultiplierRemaining / 1000)}</b>
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
                <span>残量 {playerReservePercent.toFixed(1)}%・{playerReservePercent <= 0 ? '回復待ち' : playerReservePercent <= 10 ? '枯渇寸前' : '投入可能'}</span>
              </div>
            </div>
            <small className="capital-effective-detail">
              <span>積上げ {playerCapitalProgress.toFixed(0)}%　自社 {formatCurrency(companyInvested)} / 支援 {formatCurrency(demandInvested)}</span>
              {windVisible && <b>風反映後 {formatCurrency(effectivePlayerInvested)}相当（×{currentWind.playerMultiplier.toFixed(2)}）</b>}
            </small>
            <div className="capital-source-bar"><i style={{ width: `${totalPlayerInvested > 0 ? companyInvested / totalPlayerInvested * 100 : 0}%` }} /><span /></div>
          </div>
          <div className="capital-arena__center">
            <div className={`capital-clash capital-clash--${battleDirection}`}><i /><i /><i /></div>
            <b className="capital-vs">VS</b>
            <strong>{capitalPressureLabel}</strong>
            <small>投入比 {Math.round(effectivePlayerShare)}:{Math.round(100 - effectivePlayerShare)}</small>
            {!isTraining && enemyReserve <= 0 && <em>SHORT</em>}
          </div>
          <div className={`capital-arena__side ${motion === 'enemy' ? 'is-acting' : motion === 'player' ? 'is-hit' : ''}`}>
            <div className="enemy-capital-stack">
              <div className="capital-visual-row">
                <GilTower amount={enemyInvested} marketPrice={targetProperty.marketPrice} side="enemy" motion={motion} />
                <div className="ownership-fighter ownership-fighter--enemy">
                  <img
                    key={`enemy-${motionSerial}`}
                    className={`ownership-avatar ownership-avatar--enemy ${motion === 'enemy' ? 'avatar-act' : motion === 'player' ? 'avatar-hurt' : ''}`}
                    src={opponentCharacterArt}
                    alt={isTraining ? '商戦訓練用サボテンダー' : '競合代表'}
                  />
                  <div className="battle-status-rail battle-status-rail--enemy" aria-label={isTraining ? '商戦木人への継続効果' : '競合の継続効果'}>
                    {enemySlowedRemaining > 0 && (
                      <span role="img" aria-label={`消沈 残り${Math.ceil(enemySlowedRemaining / 1000)}秒`} title={`消沈 残り${Math.ceil(enemySlowedRemaining / 1000)}秒`}>
                        <TimerReset /><b>{Math.ceil(enemySlowedRemaining / 1000)}</b>
                      </span>
                    )}
                    {enemyDisruptionRemaining > 0 && (
                      <span role="img" aria-label={`連環計 残り${Math.ceil(enemyDisruptionRemaining / 1000)}秒`} title={`連環計 残り${Math.ceil(enemyDisruptionRemaining / 1000)}秒`}>
                        <ShieldAlert /><b>{Math.ceil(enemyDisruptionRemaining / 1000)}</b>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className={`enemy-budget-overlay enemy-budget-overlay--${enemyReserveState}`}>
                <small>{isTraining ? '木人追加防衛' : '追加防衛枠'}</small>
                <strong>{isTraining ? 'なし' : formatCurrency(enemyReserve)}</strong>
                <span>{isTraining ? '初期耐久資本を全配置済み' : `残量 ${enemyReservePercent.toFixed(1)}%・${enemyReserve <= 0 ? 'SHORT' : enemyReservePercent <= 10 ? '枯渇寸前' : '追加投入余力'}`}</span>
              </div>
            </div>
            <small className="capital-effective-detail">
              <span>{isTraining ? `木人耐久 ${enemyCapitalProgress.toFixed(0)}%　追加防衛なし` : `積上げ ${enemyCapitalProgress.toFixed(0)}%　追加防衛枠 ${formatCurrency(enemyReserve)}`}</span>
              {windVisible && <b>風反映後 {formatCurrency(effectiveEnemyInvested)}相当（×{currentWind.enemyMultiplier.toFixed(2)}）</b>}
            </small>
            <div className="enemy-reserve-bar"><i style={{ width: `${enemyReservePercent}%` }} /></div>
          </div>
        </section>
        <div className="battle-flying-texts" aria-live="polite" aria-atomic="false">
          {floaters.map((item, index) => (
            <i
              key={item.id}
              className={`gil-floater gil-floater--${item.side} gil-floater--${item.tone}`}
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
              className={`recast-meter recast-meter--enemy ${aiProgress >= 72 ? 'is-danger' : ''} ${enemyReserve <= 0 ? 'is-short' : ''}`}
              role="progressbar"
              aria-label="競合の次回行動予兆"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={enemyReserve <= 0 ? 0 : Math.round(aiProgress)}
              aria-valuetext={enemyReserve <= 0 ? 'SHORT・追加防衛不能' : `${aiText}・準備 ${Math.round(aiProgress)}%`}
              title={enemyReserve <= 0 ? 'SHORT・追加防衛不能' : aiText}
            >
              <i><u style={{ width: `${enemyReserve <= 0 ? 0 : aiProgress}%` }} /></i>
            </div>
          )}
        </section>
        </section>

        <section className="battle-action-strip" aria-label="LIMIT BREAK、SYNERGY、スキル、資金源" inert={backgroundInert}>
          {limitBreakCapacityTier > 0 && (
            <button
              type="button"
              className={`battle-action-strip__action battle-action-strip__action--lb ${limitBreakGaugeFull ? 'is-overflowing' : ''} ${limitBreakTier > 0 && commandReady ? 'is-ready' : 'is-waiting'}`}
              onClick={demandFromAllies}
              disabled={!commandReady || limitBreakTier === 0 || actionsLocked}
              aria-label={`LIMIT BREAK ${limitBreakTier > 0 ? `${limitBreakTier}発動可能` : '蓄積中'}。ゲージ${Math.floor(visibleLimitBreakCharge)}／${limitBreakChargeCapacity}。発動時は全消費`}
              title="発動すると蓄積したLBゲージをすべて消費します"
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
                  ? commandReady ? `最大+${limitBreakOwnershipCap}pt` : '準備中'
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
            </button>
          )}

          {selectedBattleSynergy && (
            <button
              type="button"
              className={`battle-action-strip__action battle-action-strip__action--synergy ${battleSynergyReady && commandReady ? 'is-ready' : 'is-waiting'}`}
              onClick={() => demandFromGroup(
                selectedBattleSynergy.name,
                selectedBattleSynergyMembers,
                selectedBattleSynergy.battleGroupMultiplier ?? 1.28
              )}
              disabled={!commandReady || !battleSynergyReady || actionsLocked}
              aria-label={`${selectedBattleSynergy.name}（SYNERGY）。${battleSynergyReady ? '選択中の事業連携を発動' : '必要な事業・契約が不足'}`}
              title={`${selectedBattleSynergy.name}：選択中の事業連携を発動`}
            >
              <img
                className="battle-action-strip__fankit-icon"
                src={getFankitCommerceIcon(selectedBattleSynergy.name)}
                alt=""
                aria-hidden="true"
              />
              <span>
                <b><MarqueeText text={selectedBattleSynergy.name} /></b>
                <small>SYNERGY</small>
              </span>
              <em>{!battleSynergyReady
                ? '連携崩壊'
                : commandReady
                  ? '発動可'
                  : '準備中'}</em>
            </button>
          )}

          {primarySkill && (
            <button
              type="button"
              className={`battle-action-strip__action battle-action-strip__action--skill ${primarySkill.effectType === 'LIVING_DEAD' ? 'is-living-dead' : ''} ${primarySkillUnavailable ? 'is-unavailable' : ''}`}
              onClick={() => useSkill(primarySkill)}
              disabled={primarySkillUnavailable || primaryEraWindUnavailable || !commandReady || primarySkillCooldown > 0 || primarySkillUsed || actionsLocked}
              title={`${primarySkill.name}：${getQuickSkillSummary(primarySkill, isTraining)}`}
            >
              {primarySkill.effectType === 'LIVING_DEAD' ? <ShieldAlert /> : <Zap />}
              <span>
                <b><MarqueeText text={primarySkill.name} /></b>
                <small>{getQuickSkillSummary(primarySkill, isTraining)}</small>
              </span>
              <em>{primarySkillUnavailable
                ? '対象なし'
                : primarySkill.effectType === 'ERA_WIND' && eraWindUseLimitReached
                  ? '3/3使用済み'
                  : primarySkill.effectType === 'ERA_WIND' && cash < nextEraWindCost
                    ? `${formatCurrency(nextEraWindCost)}必要`
                : primarySkillUsed
                ? '使用済み'
                : primarySkillCooldown > 0
                  ? '再使用待ち'
                  : commandReady
                    ? '発動可'
                    : '準備中'}</em>
            </button>
          )}

          {equippedSkills.length > 0 && (
            <button
              type="button"
              className={`battle-action-strip__action battle-action-strip__action--drawer ${panel === 'skills' ? 'active' : ''}`}
              onClick={() => setPanel('skills')}
            >
              <Swords />
              <span><b>スキル</b><small>{additionalSkillCount > 0 ? `ほか${additionalSkillCount}件` : '詳細'}</small></span>
            </button>
          )}

          <button
            type="button"
            className={`battle-action-strip__action battle-action-strip__action--drawer ${panel === 'funds' ? 'active' : ''}`}
            onClick={() => setPanel('funds')}
          >
            <Building2 />
            <span><b>資金源</b><small>支援元{battleSubs.length}件＋協力</small></span>
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
                className={`investment-execute-button ${canConfirmInvestment ? 'is-ready' : 'is-recharging'} ${isFinalPushWindow ? 'is-finisher' : ''}`}
                onClick={investCompanyFunds}
                disabled={!canConfirmInvestment}
                aria-label={`${isFinalPushWindow ? 'とどめ' : '投資実行'}。${selectedInvestmentConfig.label} ${formatCurrency(selectedCost)}を1回投入`}
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
                  <b>{isFinalPushWindow ? 'とどめ' : '投資実行'}</b>
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
            <button type="button" className="battle-drawer-backdrop" onClick={() => setPanel('capital')} aria-label="資金源を閉じる" />
            <section ref={fundsDrawerRef} className="battle-drawer" role="dialog" aria-modal="true" aria-label="資金源" tabIndex={-1}>
              <header>
                <span><Building2 /><b>資金源</b><small>戦術選択中 ×0.1</small></span>
                <button type="button" data-modal-close onClick={() => setPanel('capital')} aria-label="資金源を閉じる"><X /></button>
              </header>
              {windVisible && (
                <div className={`command-wind-context command-wind-context--${windSide}`}>
                  <span><Sparkles /><b>{windTitle}</b><em>{windDetail}</em></span>
                  <small>戦術選択中も風は×0.1で進行。静穏まで{windCountdown}秒。</small>
                </div>
              )}
              <div className="command-panel command-panel--funds">
              {limitBreakCapacityTier === 0 && (
              <button
                type="button"
                className="grand-allied-fund grand-allied-fund--limit"
                disabled
              >
                <Zap />
                <span>
                  <b>LIMIT BREAK 未解放</b>
                  <small>自社＋支援元が合計4枠でゲージ1本目を解放</small>
                </span>
                <strong>あと{Math.max(0, 4 - (battleSubs.length + 1))}件</strong>
              </button>
              )}

              {alliance.active && (
                <button type="button" className="alliance-fund" onClick={requestAlliance} disabled={!commandReady || allianceUsed || actionsLocked}>
                  <Users /><span>{alliancePublicPatronage ? '公的後援' : '協力協定'}：{alliance.allyName}</span><b>{allianceUsed ? '要請済み' : `+${formatCurrency(allianceSupport)}相当`}</b>
                </button>
              )}

              <div className="property-funds">
                {battleSubs.map((property) => {
                  const risk = riskPresentation(property.loyaltyRisk);
                  return (
                    <button type="button" key={property.id} onClick={() => demandFromProperty(property)} disabled={!commandReady || actionsLocked}>
                      <span><b>{property.name}</b><small>要求 {subRequestCounts[property.id] || 0}回</small></span>
                      <em className={risk.className}>{risk.label} {property.loyaltyRisk}%</em>
                      <strong>+{formatCurrency(property.marketPrice * 0.45)}</strong>
                    </button>
                  );
                })}
              </div>
              {battleSubs.length === 0 && <p className="empty-funds">資金を要求できる支援元がありません。</p>}
              </div>
            </section>
          </div>
        )}

        {panel === 'skills' && (
          <div className="battle-drawer-shell" role="presentation">
            <button type="button" className="battle-drawer-backdrop" onClick={() => setPanel('capital')} aria-label="スキル一覧を閉じる" />
            <section ref={skillsDrawerRef} className="battle-drawer battle-drawer--skills" role="dialog" aria-modal="true" aria-label="装備スキル" tabIndex={-1}>
              <header>
                <span><Swords /><b>装備スキル</b><small>選択中 ×0.1</small></span>
                <button type="button" data-modal-close onClick={() => setPanel('capital')} aria-label="スキル一覧を閉じる"><X /></button>
              </header>
              <div className="battle-drawer__skill-list">
                {equippedSkills.map((skill) => {
                  const cooldown = skillCooldowns[skill.id] || 0;
                  const used = !!skill.oncePerBattle && usedSkillIds.has(skill.id);
                  const unavailable =
                    isTraining && isRivalOnlySkill(skill);
                  const eraBlocked =
                    skill.effectType === 'ERA_WIND' &&
                    (eraWindUseLimitReached || cash < nextEraWindCost);
                  return (
                    <button
                      type="button"
                      key={`drawer-${skill.id}`}
                      className={`${skill.effectType === 'LIVING_DEAD' ? 'is-living-dead' : ''} ${unavailable ? 'is-unavailable' : ''}`}
                      onClick={() => useSkill(skill)}
                      disabled={unavailable || eraBlocked || !commandReady || cooldown > 0 || used || actionsLocked}
                    >
                      {skill.effectType === 'LIVING_DEAD' ? <ShieldAlert /> : <Zap />}
                      <span>
                        <b>{skill.name}</b>
                        <small>{unavailable ? '競合行動を対象とするため、追加行動のない木人では無効' : skill.description}</small>
                      </span>
                      <em>{unavailable
                        ? '対象なし'
                        : skill.effectType === 'ERA_WIND' && eraWindUseLimitReached
                          ? '3/3使用済み'
                          : skill.effectType === 'ERA_WIND' && cash < nextEraWindCost
                            ? `${formatCurrency(nextEraWindCost)}必要`
                        : used
                        ? '使用済み'
                        : cooldown > 0
                          ? '再使用待ち'
                          : commandReady
                            ? '発動可'
                            : '準備中'}</em>
                    </button>
                  );
                })}
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
                : defeatReason === 'WALKING_DEAD_FAILED' ? 'WALKING DEAD FAILED / 蘇生失敗' : 'CAPITAL COLLAPSE / 買収失敗'}</span>
            <button type="button" className="battle-next-button" onClick={openResultAnalysis} disabled={finishTelegraphVisible}>
              {finishTelegraphVisible ? '演出中' : '分析へ →'}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setShowLog(true)}><ScrollText />戦局ログ</button>
            <span title={logs[0]?.text}>{logs[0]?.text}</span>
            <button type="button" onClick={() => finishBattle('opponent', 'NORMAL', ownership, false)}>{isTraining ? '訓練を終了' : '撤退'}</button>
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
            <header><Swords /><strong>{isTraining ? 'TRAINING DUMMY DUTY' : isUltimate ? 'ULTIMATE TRADE DUTY' : isSavage ? 'SAVAGE TRADE RAID' : '買収交渉'}</strong></header>
            <div className="briefing-versus">
              <b className="company-name-full" title={companyName}>{companyName}</b>
              <span>VS</span>
              <b className="company-name-full" title={targetProperty.name}>{targetProperty.name}</b>
            </div>
            <StrengthComparison result={battleReadiness} isTraining={isTraining} />
            <dl className="briefing-facts">
              <div>
                <dt>{isTraining ? '訓練区分' : isHighEndRaid ? '競合連合・対象地域' : '対象都市・業界'}</dt>
                <dd>
                  {battleContextLabel ?? (isTraining ? '商戦訓練所・木人討滅戦' : `${targetProperty.community}・${targetProperty.industry}`)}
                  {battleRegionLabel ? <small>{battleRegionLabel}</small> : null}
                </dd>
              </div>
              <div><dt>{isTraining ? '木人耐久資本' : '現在相場'}</dt><dd>{formatCurrency(targetProperty.marketPrice)}</dd></div>
              <div><dt>{isTraining ? '参加費' : '仲介手数料'}</dt><dd>{formatCurrency(brokerageFee)}</dd></div>
              <div>
                <dt>{isTraining ? '初期防衛資本' : '競合想定予算'}</dt>
                <dd>
                  {formatCurrency(enemyBudget)}
                  <small>{isTraining ? `開幕 ${formatCurrency(enemyBudget)}／追加防衛 0 ギル` : `開幕 ${formatCurrency(battleReadiness.enemyOpeningCapital)}／追加防衛 ${formatCurrency(battleReadiness.enemyReserveCapital)}`}</small>
                </dd>
              </div>
              <div><dt>{isTraining ? '木人行動' : '競合戦術'}</dt><dd>{isTraining ? '追加防衛・敵AI行動なし' : `${isUltimate ? '絶商戦' : isSavage ? '零式レイド' : 'AI'} LEVEL ${enemyDifficultyLevel}`}</dd></div>
              <div><dt>{isTraining ? '訓練用出資の精算' : '自社直接出資の確定損'}</dt><dd>{isTraining ? 'なし（セーブ資金差引 0）' : '勝利35%／敗北・撤退75%'}</dd></div>
              <div><dt>LBゲージ</dt><dd>{limitBreakCapacityTier === 0 ? '未解放（自社＋支援元が合計4枠で解放）' : isTraining ? `${Math.floor(visibleLimitBreakCharge)}/${limitBreakChargeCapacity}（訓練専用・終了時に破棄）` : `${Math.floor(visibleLimitBreakCharge)}/${limitBreakChargeCapacity}（最大${limitBreakCapacityTier}本・次戦へ継承）`}</dd></div>
            </dl>
            <section className="briefing-section">
              <h3><Sparkles />今回の事業連携・戦闘連携</h3>
              {briefingSynergies.length > 0
                ? <ul>{briefingSynergies.map((effect) => <li key={effect}>{effect}</li>)}</ul>
                : <p>今回発動するSYNERGYはありません。</p>}
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
                <h3><Swords />{isTraining ? '商戦木人ルール' : isUltimate ? '絶商戦ルール' : '零式ルール'}</h3>
                <p>{isTraining ? '参加費・報酬・精算・清算はすべて0。通常事業・契約の保有状態、独立危険度、零式・絶の進行は変化せず、同じLEVELへ何度でも再挑戦できます。' : '通常編の地域・業界・交易網補正は無効。通常事業・契約の保有状態・収益・独立危険度は変化せず、失敗後も同じ戦いへ再挑戦できます。'}</p>
              </section>
            )}
            <section className="briefing-section">
              <h3><ShieldAlert />勝敗条件</h3>
              <p>{isTraining ? '木人は全耐久資本を開幕に配置します。所有率100％まで押し切ると訓練成功です。木人側に押されても自社1％で踏みとどまり、任意に訓練を終了できます。' : '未投入資金や追加防衛枠が残っていても、所有率0％になった側は敗北します。'}</p>
              {!isTraining && <p>競合がSHORTすると所有率99.5％で停止します。自社出資かLIMIT BREAKで決着してください。</p>}
              {equippedSkills.some((skill) => skill.effectType === 'LIVING_DEAD') && (
                <p className="briefing-living-dead">例外：リビングデッド待機中は1％で踏みとどまり、10秒以内に正規化所有率30％へ戻せば続行できます。</p>
              )}
            </section>
            <button type="button" className="dialog-close briefing-start" onClick={startBattle}>
              {isTraining
                ? '木人訓練を開始'
                : isUltimate
                ? `絶商戦を開始（${battleReadiness.symbol}${battleReadiness.label}）`
                : isSavage
                  ? `零式レイド開始（${battleReadiness.symbol}${battleReadiness.label}）`
                  : `この条件で討滅戦開始（${battleReadiness.symbol}${battleReadiness.label}）`}
            </button>
            <button type="button" className="dialog-close briefing-cancel" onClick={requestClose}>
              {isTraining ? '木人一覧へ戻る' : '今回は交渉を見送る'}
            </button>
          </article>
        </div>
      )}

      {!isTraining && cinematicLayer === 'short' && (
        <div className="battle-short-telegraph" aria-live="assertive">
          <i />
          <small>DEFENSE CAPITAL</small>
          <strong>SHORT</strong>
          <span>敵追加防衛資金 0%</span>
          <i />
        </div>
      )}

      {cinematicLayer === 'decisive' && decisiveBlow && (
        <div className={`battle-decisive-blow battle-decisive-blow--${decisiveBlow.winner} ${decisiveBlow.impacted ? 'battle-decisive-blow--impact' : ''}`} aria-live="assertive">
          <i />
          <small>{isTraining ? 'TRAINING CAPITAL IMPACT' : decisiveBlow.winner === 'player' ? 'FINAL CAPITAL IMPACT' : 'RIVAL CAPITAL IMPACT'}</small>
          <strong>DECISIVE BLOW</strong>
          <span>{isTraining ? decisiveBlow.winner === 'player' ? '最後の一手が木人耐久を削り切る' : '木人の初期耐久資本に押し戻される' : decisiveBlow.winner === 'player' ? '最後の一手が防衛線を貫く' : '大口防衛出資が所有率を押し潰す'}</span>
          <i />
        </div>
      )}

      {cinematicLayer === 'finish' && winner && finishTelegraphVisible && (
        <div className={`battle-finish-telegraph battle-finish-telegraph--${winner}`} aria-live="assertive">
          <i />
          <small>{isTraining ? winner === 'player' ? 'TRAINING COMPLETE' : 'TRAINING ENDED' : winner === 'player' ? 'DUTY COMPLETE' : 'DUTY FAILED'}</small>
          <strong>{isTraining ? winner === 'player' ? 'SUCCESS!' : 'END' : winner === 'player' ? 'WIN!' : 'LOSE'}</strong>
          <span>{isTraining
            ? winner === 'player' ? 'DUMMY BREAK' : 'TRAINING END'
            : winner === 'player'
              ? FINISH_LABELS[finishMethod]
              : defeatReason === 'WALKING_DEAD_FAILED' ? 'WALKING DEAD FAILED' : 'CAPITAL COLLAPSE'}</span>
          {winner === 'player' && overkill >= 0.5 && <em>OVERKILL +{overkill.toFixed(1)}%</em>}
          <i />
        </div>
      )}

      {showHelp && (
        <div className="buyout-overlay">
          <article ref={helpDialogRef} className="buyout-dialog" role="dialog" aria-modal="true" aria-label={isTraining ? '木人訓練の遊び方' : '買収戦の遊び方'} tabIndex={-1}>
            <header><CircleHelp /><strong>{isTraining ? '木人訓練の遊び方' : '買収戦の遊び方'}</strong><button type="button" data-modal-close onClick={() => setShowHelp(false)} aria-label="ヘルプを閉じる"><X /></button></header>
            <ol>
              <li><b>ギルを積む</b><span>左の投資レベルボタンで金額を5段階から選び、右の投資実行ボタンで1回投入します。支援元・SYNERGYの支援は上のアイコンから使います。</span></li>
              {isTraining && <li><b>木人訓練</b><span>参加費・報酬・精算・清算は0。木人は初期耐久資本を全配置し、追加防衛や敵AI行動を行いません。押されても自社1％で訓練を継続でき、その間も通常の毎秒収益とオフライン収益は商会資金へ加算されます。</span></li>}
              <li><b>戦術選択</b><span>資金源やスキルの選択中は、商戦と商流回復が通常の10%になります。</span></li>
              <li><b>商流回復</b><span>通常時は相場の0.3%/秒、1戦につき相場の15%まで、その戦闘内だけで再利用できる資金が戻ります。最終残高へ別途加算はされません。</span></li>
              <li><b>市場の風を読む</b><span>{isTraining ? '木人訓練では風は発生せず、自社・木人双方への補正もありません。' : 'グリダニアは風なし。進行後も開始から最低10秒は静穏です。その後は低頻度の市場気配、3秒の予兆を経て12～15秒だけ風が吹き、終了後は最低18秒の静穏を挟みます。'}</span></li>
              {!isTraining && <li><b>時代の風</b><span>クガネの交易網を揃えると解放。敵資金を消さず、12秒間だけ自社向きの時流を追加します。1交渉3回までで、使用ごとに必要資金が増えます。</span></li>}
              <li><b>LIMIT BREAK</b><span>攻防の資金衝突で通常比20％速く蓄積し、動員資金も20％増加。自社＋支援元が合計4/8/16枠で1/2/3本まで解放され、発動のたび全ゲージを0にします。同じ戦闘でも再蓄積すれば再発動できます。</span></li>
              <li><b>特殊アクション</b><span>商戦フィールド直下のアイコンからLB・選択中のSYNERGY・主要スキルを1タップで実行できます。未解放の枠は表示せず、全スキルと資金源はドロワーで開きます。</span></li>
              <li><b>効果通知</b><span>味方への良い効果は青く上昇し、競合への妨害や悪い効果は赤く下降します。詳しい履歴は戦局ログで後から確認できます。</span></li>
              <li><b>リビングデッド</b><span>10秒の待機中に所有率0％へ到達すると表示上1％で耐えます。攻防の内部値は進み続け、その後10秒以内に30％以上へ戻せなければ敗北。1交渉1回です。</span></li>
              <li><b>協力協定</b><span>外部協力先から一交渉1回の支援です。LBの参加件数や投入額には含みません。</span></li>
              <li><b>独立リスク</b><span>支援元へ繰り返し要求できますが、独立すると過去支援も崩れます。</span></li>
              {!isTraining && <li><b>SHORT</b><span>敵の追加防衛資金が0になった戦況通知。約3.2秒後に自動再開し、所有率99.5%で踏みとどまります。投資実行が「とどめ」に変わるので、FINAL PUSHかLIMIT BREAKで決着してください。</span></li>}
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
                  ? '木人討滅成功'
                  : '木人訓練終了'
                : winner === 'player'
                ? isUltimate
                  ? '絶商戦 踏破'
                  : isSavage
                    ? '零式 踏破'
                    : '買収成立'
                : defeatReason === 'WALKING_DEAD_FAILED'
                  ? '蘇生失敗'
                  : isHighEndRaid
                    ? '攻略失敗'
                    : '買収失敗'}</strong>
            </header>
            <h2>{targetProperty.name}</h2>
            <div className="tataru-analysis">
              <img src={FANKIT_ART.tataru.windUp} alt="タタル" />
               <p><b>{isTraining ? 'タタルの訓練分析' : `タタルの${winner === 'player' ? '勝因' : '敗因'}分析`}</b><span>「{resultAnalysis}」</span></p>
            </div>
            <div className="result-numbers">
              <span><small>FINISH</small><b>{isTraining ? winner === 'player' ? 'DUMMY BREAK' : 'TRAINING END' : winner === 'opponent' && defeatReason === 'WALKING_DEAD_FAILED' ? 'WALKING DEAD FAILED' : FINISH_LABELS[finishMethod]}</b></span>
              <span><small>最終所有率</small><b>{finalOwnership.toFixed(1)}%</b></span>
              <span><small>OVERKILL</small><b>{winner === 'player' ? `+${overkill.toFixed(1)}%` : '---'}</b></span>
              <span><small>自社競り値</small><b>{formatCurrency(totalPlayerInvested)}</b></span>
              <span><small>{isTraining ? '木人耐久資本' : '競合競り値'}</small><b>{formatCurrency(enemyInvested)}</b></span>
              <span><small>戦中再利用（残高加算なし）</small><b>{formatCurrency(battleCashRecovered)}</b></span>
              <span><small>{isTraining ? '訓練操作による資金差引' : '確定支出'}</small><b>{isTraining ? '+0' : formatCurrency(brokerageFee + resultSettlementCost)}</b></span>
              <span><small>{isTraining ? '訓練報酬' : '攻略報酬'}</small><b>+{formatCurrency(resultVictoryReward)}</b></span>
              {!isTraining && <span><small>商会資金差引</small><b>{resultFundsDelta >= 0 ? '+' : '-'}{formatCurrency(Math.abs(resultFundsDelta))}</b></span>}
              <span><small>{isTraining ? '訓練中の一時離脱' : isHighEndRaid ? '記録戦中の一時離脱' : '資金源離脱'}</small><b>{rebelled.length}件</b></span>
            </div>
            {winner === 'player' && <p className="overkill-rating">{getOverkillRating(overkill)}</p>}
            {rebelled.length > 0 && (
              <p className="rebel-summary">
                <ShieldAlert />
                {isProtectedBattle
                  ? `一時離脱（通常の事業・契約は保護）：${rebelled.map((item) => item.name).join('・')}`
                  : `独立：${rebelled.map((item) => item.name).join('・')}`}
              </p>
            )}
            {!isTraining && winner === 'player' && nextCommunity && <p className="next-community"><CheckCircle2 />次の都市「{nextCommunity}」への交易路が開きます。</p>}
            <button
              type="button"
              className="dialog-close result-confirm"
              onClick={confirmResult}
              disabled={!resultConfirmArmed}
              aria-describedby="battle-result-confirm-note"
            >
              {!resultConfirmArmed
                ? '結果を確認中…'
                : isTraining
                ? '訓練結果を保存せず木人一覧へ戻る'
                : winner === 'player'
                ? isHighEndRaid
                  ? '攻略結果を確定する'
                  : '買収結果を確定する'
                : '敗因を記録して戻る'}
            </button>
            <small id="battle-result-confirm-note" className="sr-only">
              このボタンを押すまで商戦結果は確定されず、画面も閉じません。
            </small>
          </article>
        </div>
      )}
    </div>
  );
};

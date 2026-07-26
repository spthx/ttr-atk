import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Building2,
  CheckCircle2,
  CircleHelp,
  Coins,
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
import { FANKIT_ART, getFankitJobArt } from '../data/fankitAssets';
import type {
  WindCondition,
  WindProgressionStage,
} from './WindIndicator';
import {
  decideEnemyAction,
  ENEMY_INTENT_LABELS,
  getEnemyBaseWaitMs,
  PlayerBattleAction,
} from '../utils/enemyAi';
import { calculateBattleReadiness } from '../utils/battleReadiness';
import { StrengthComparison } from './StrengthComparison';
import {
  BATTLE_GAUGE_SPEED_FACTOR,
  calculateBattleVictoryReward,
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
  getLimitBreakChargeCapacity,
  getLimitBreakTier,
  LIMIT_BREAK_CHARGE_GAIN_MULTIPLIER,
  LIMIT_BREAK_CHARGE_PER_BAR,
  LIMIT_BREAK_MULTIPLIERS,
  LIMIT_BREAK_OWNERSHIP_CAPS,
  holdGaugeForManualShortFinish,
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
  currentWind: WindCondition;
  windCountdown: number;
  windProgressionStage: WindProgressionStage;
  battleContextLabel?: string;
  battleRegionLabel?: string;
  nextCommunity?: string | null;
  isTutorial?: boolean;
  isSavage?: boolean;
  isUltimate?: boolean;
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

interface DecisiveBlow {
  winner: 'player' | 'opponent';
  impacted: boolean;
}

const getQuickSkillSummary = (skill: TacticalSkill) => {
  switch (skill.effectType) {
    case 'COOLDOWN_REDUCTION':
      return '命令回復 約1.8倍・10秒';
    case 'NEMAWASHI':
      return '全傘下の独立危険度を半減';
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
  marketPrice: number;
  side: 'player' | 'enemy';
  motion: BattleMotion;
}> = ({ amount, marketPrice, side, motion }) => {
  const capitalRatio = amount / Math.max(marketPrice, 1);
  const bundleCount = amount <= 0
    ? 0
    : capitalRatio < 0.06
      ? 1
      : capitalRatio < 0.16
        ? 2
        : capitalRatio < 0.32
          ? 3
          : capitalRatio < 0.62
            ? 4
            : 5;
  const chipAsset = side === 'player' ? gilChipPlayer : defenseChipEnemy;
  const medallionAsset = side === 'player' ? gilMedallionPlayer : defenseMedallionEnemy;

  return (
    <div className={`gil-tower gil-tower--${side} ${motion === side ? 'gil-tower--impact' : ''}`}>
      <div className="gil-tower__chips" aria-label={`${formatCurrency(amount)}を投入済み`}>
        {bundleCount === 0 && <span className="gil-tower__empty">NO CAPITAL</span>}
        {Array.from({ length: bundleCount }).map((_, index) => (
          <img
            key={`${side}-${index}`}
            src={index === 0 ? medallionAsset : chipAsset}
            alt=""
            aria-hidden="true"
            className={`${index === 0 ? 'gil-chip-image gil-chip-image--medallion' : 'gil-chip-image gil-chip-image--stack'}${motion === side && index === bundleCount - 1 ? ' gil-chip-image--falling' : ''}`}
            style={{
              '--chip-index': index,
              '--chip-count': bundleCount,
              '--chip-angle': `${((index * 7 + (side === 'player' ? 3 : 9)) % 15) - 7}deg`,
            } as React.CSSProperties}
          />
        ))}
        {capitalRatio >= 0.62 && <em>MAX STACK ×{Math.max(1, Math.round(capitalRatio * 10))}</em>}
      </div>
      <strong>{formatCurrency(amount)}</strong>
      <small>{bundleCount > 0 ? `資金束 ${bundleCount}山` : '資金未投入'}</small>
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
  currentWind,
  windCountdown,
  windProgressionStage,
  battleContextLabel,
  battleRegionLabel,
  nextCommunity = null,
  isTutorial = false,
  isSavage = false,
  isUltimate = false,
  onTimeScaleChange,
  onBattleEnd,
  onClose,
}) => {
  const brokerageFee = Math.round(targetProperty.marketPrice * 0.03);
  const influenceBonus = industryInfluence.playerBonus + regionalInfluence.playerBonus + tradeNetworkBonus;
  const isHighEndRaid = isSavage || isUltimate;
  const enemyDifficultyLevel = getEnemyDifficultyLevel(
    targetProperty,
    isTutorial,
    isSavage,
    isUltimate
  );

  const enemyBudget = useMemo(
    () =>
      calculateEnemyBudget({
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
      isUltimate,
      regionalInfluence,
      targetProperty,
    ]
  );

  const initialEnemyCommitment = Math.round(
    enemyBudget * ENEMY_INITIAL_COMMITMENT_RATIO
  );
  const [battlePhase, setBattlePhase] = useState<BattlePhase>('briefing');
  const [gauge, setGauge] = useState(0);
  const [gaugeSpeed, setGaugeSpeed] = useState(0);
  const [companyInvested, setCompanyInvested] = useState(0);
  const [demandInvested, setDemandInvested] = useState(0);
  const [enemyInvested, setEnemyInvested] = useState(initialEnemyCommitment);
  const [enemyReserve, setEnemyReserve] = useState(enemyBudget - initialEnemyCommitment);
  const enemyReserveRef = useRef(enemyBudget - initialEnemyCommitment);
  const [cash, setCash] = useState(Math.max(0, totalFunds - brokerageFee));
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
  const [skillCooldowns, setSkillCooldowns] = useState<Record<string, number>>({});
  const [usedSkillIds, setUsedSkillIds] = useState<Set<string>>(() => new Set());
  const [livingDeadPhase, setLivingDeadPhase] = useState<LivingDeadPhase>('inactive');
  const [livingDeadRemaining, setLivingDeadRemaining] = useState(0);
  const [motion, setMotion] = useState<BattleMotion>('idle');
  const [statusText, setStatusText] = useState('効果を確認して交渉を開始してください');
  const [aiText, setAiText] = useState('敵大規模防衛出資を準備中');
  const [aiProgress, setAiProgress] = useState(0);
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
  const [showLog, setShowLog] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [floaters, setFloaters] = useState<FloatingGil[]>([]);
  const [logs, setLogs] = useState<BattleLog[]>([
    { id: 'start', category: 'system', text: `${companyName}が${targetProperty.name}の買収準備へ入りました。` },
  ]);
  const endedRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const lastTickRef = useRef(performance.now());
  const shortShownRef = useRef(false);
  const announcementTimerRef = useRef<number | null>(null);
  const limitBreakTimerRef = useRef<number | null>(null);
  const shortTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const limitImpactTimerRef = useRef<number | null>(null);
  const conditionTimerRef = useRef<number | null>(null);
  const initialWindTimerRef = useRef<number | null>(null);
  const openingSlowTimerRef = useRef<number | null>(null);
  const decisiveImpactTimerRef = useRef<number | null>(null);
  const decisiveResolveTimerRef = useRef<number | null>(null);
  const livingDeadNoticeTimerRef = useRef<number | null>(null);
  const decisiveRef = useRef(false);
  const lastAnnouncedWindRef = useRef(currentWind.type);
  const livingDeadPhaseRef = useRef<LivingDeadPhase>('inactive');
  const livingDeadRemainingRef = useRef(0);
  const fundsDrawerRef = useRef<HTMLElement | null>(null);
  const skillsDrawerRef = useRef<HTMLElement | null>(null);
  const helpDialogRef = useRef<HTMLElement | null>(null);
  const logDialogRef = useRef<HTMLElement | null>(null);
  const phaseDialogRef = useRef<HTMLElement | null>(null);
  const rootDialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
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

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
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
      if (activeSurface === rootDialogRef.current) {
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
        else if (battlePhase === 'briefing') onCloseRef.current();
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
      previousFocus?.focus();
    };
  }, [battlePhase, panel, showHelp, showLog]);

  const updateLivingDeadState = (phase: LivingDeadPhase, remainingMs = 0) => {
    livingDeadPhaseRef.current = phase;
    livingDeadRemainingRef.current = remainingMs;
    setLivingDeadPhase(phase);
    setLivingDeadRemaining(remainingMs);
  };
  const livingDeadGaugeFloor =
    100 - TACTICAL_SKILL_BALANCE.livingDead.minimumOwnership * 2;
  const capGaugeAtLivingDeadFloor = (nextGauge: number) =>
    livingDeadPhaseRef.current === 'recovery'
      ? Math.min(livingDeadGaugeFloor, nextGauge)
      : nextGauge;

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
  const ownership = calculateOwnershipFromGauge(gauge);
  const commandReady = commandProgress >= 100;
  const selectedCost = getInvestmentCost(targetProperty.marketPrice, selectedLevel);
  const maxAffordableConfig = [...INVESTMENT_LEVELS].reverse()
    .find((item) => getInvestmentCost(targetProperty.marketPrice, item.level) <= cash);
  const capitalGap = totalPlayerInvested - enemyInvested;
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
  const capitalPressureLabel = effectivePlayerShare >= 58
    ? '自社優勢'
    : effectivePlayerShare <= 42
      ? '競合優勢'
      : '資本拮抗';
  const savageLayerMatch = isSavage
    ? targetProperty.name.match(/第([1-4])層/)
    : null;
  const savageLayer = isSavage ? Number(savageLayerMatch?.[1] ?? 1) : 0;
  const primarySkill = equippedSkills[0] ?? null;
  const additionalSkillCount = Math.max(0, equippedSkills.length - 1);
  const primarySkillCooldown = primarySkill
    ? skillCooldowns[primarySkill.id] || 0
    : 0;
  const primarySkillUsed = !!primarySkill?.oncePerBattle &&
    usedSkillIds.has(primarySkill.id);
  const ownershipRate = Math.abs(gaugeSpeed) / 2;
  const battleDirection = gaugeSpeed < -0.08 ? 'player' : gaugeSpeed > 0.08 ? 'enemy' : 'even';
  const enemyReserveCapacity = Math.max(1, enemyBudget - initialEnemyCommitment);
  const enemyReservePercent = enemyReserve <= 0 ? 0 : Math.min(99.9, (enemyReserve / enemyReserveCapacity) * 100);
  const enemyReserveState = enemyReservePercent <= 0 ? 'short' : enemyReservePercent <= 10 ? 'critical'
    : enemyReservePercent <= 25 ? 'danger' : enemyReservePercent <= 50 ? 'warning' : 'healthy';
  const playerReserveCapacity = Math.max(1, totalFunds - brokerageFee);
  const playerReservePercent = Math.max(0, Math.min(100, (cash / playerReserveCapacity) * 100));
  const playerReserveState = playerReservePercent <= 0 ? 'short' : playerReservePercent <= 10 ? 'critical'
    : playerReservePercent <= 25 ? 'danger' : playerReservePercent <= 50 ? 'warning' : 'healthy';
  const windEnabled = windProgressionStage > 0;
  const windSide = !windEnabled ? 'calm'
    : currentWind.type === 'TAILWIND_PLAYER' ? 'player'
      : currentWind.type === 'TAILWIND_ENEMY' || currentWind.type === 'HEADWIND_PLAYER' ? 'enemy'
        : currentWind.type === 'CROSSWIND' ? 'cross' : 'calm';
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
  const isBurstTime = windSide === 'player' && hasActiveBattleSynergy;
  const windTitle = !windEnabled ? '基礎商戦・風なし'
    : isBurstTime ? 'BURST TIME'
      : windSide === 'player' ? '味方追い風'
        : windSide === 'enemy' ? '敵方優勢の風'
          : windSide === 'cross' ? '乱旋風' : '静穏';
  const windDetail = !windEnabled ? '双方の資金効果 ×1.00'
    : isBurstTime ? `風 × SYNERGY / 自社効果 ×${currentWind.playerMultiplier.toFixed(2)}`
      : currentWind.type === 'HEADWIND_PLAYER' ? `自社効果 ×${currentWind.playerMultiplier.toFixed(2)}`
        : windSide === 'player' ? `自社効果 ×${currentWind.playerMultiplier.toFixed(2)}`
          : windSide === 'enemy' ? `敵防衛 ×${currentWind.enemyMultiplier.toFixed(2)}`
            : currentWind.type === 'CROSSWIND'
              ? `双方 ×${currentWind.playerMultiplier.toFixed(2)} / 速度 ×${currentWind.speedMultiplier.toFixed(2)}`
              : '双方の資金効果 ×1.00';
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
  const playerRecastSeconds = commandReady
    ? 0
    : Math.max(0, ((100 - commandProgress) / commandProgressPerTick) * 0.05);
  const presentationLocked = !!battleAnnouncement || !!conditionAnnouncement;
  const actionsLocked =
    !!winner ||
    battlePhase !== 'active' ||
    presentationLocked ||
    showHelp ||
    showLog;
  const backgroundInert =
    panel !== 'capital' ||
    showHelp ||
    showLog ||
    battlePhase !== 'active' ||
    presentationLocked;
  const isPaused = battlePhase !== 'active' || showHelp || showLog || presentationLocked;
  const timeScale = isPaused
    ? 0
    : decisiveBlow
      ? 0.16
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
  const enemyRecastSeconds = enemyReserve <= 0
    ? 0
    : Math.max(0, (enemyDecision.waitMs * (1 - aiProgress / 100)) / 1000);
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

  useEffect(() => () => {
    onTimeScaleChange?.(1);
    if (announcementTimerRef.current) window.clearTimeout(announcementTimerRef.current);
    if (limitBreakTimerRef.current) window.clearTimeout(limitBreakTimerRef.current);
    if (shortTimerRef.current) window.clearTimeout(shortTimerRef.current);
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    if (limitImpactTimerRef.current) window.clearTimeout(limitImpactTimerRef.current);
    if (conditionTimerRef.current) window.clearTimeout(conditionTimerRef.current);
    if (initialWindTimerRef.current) window.clearTimeout(initialWindTimerRef.current);
    if (openingSlowTimerRef.current) window.clearTimeout(openingSlowTimerRef.current);
    if (decisiveImpactTimerRef.current) window.clearTimeout(decisiveImpactTimerRef.current);
    if (decisiveResolveTimerRef.current) window.clearTimeout(decisiveResolveTimerRef.current);
    if (livingDeadNoticeTimerRef.current) window.clearTimeout(livingDeadNoticeTimerRef.current);
  }, [onTimeScaleChange]);

  useEffect(() => {
    setAiText(`${ENEMY_INTENT_LABELS[enemyDecision.intent]} / ${enemyDecision.reason}`);
  }, [enemyDecision.intent, enemyDecision.reason]);

  const addLog = (text: string, category: LogCategory = 'system') => {
    setLogs((current) => [{ id: `${Date.now()}-${Math.random()}`, category, text }, ...current].slice(0, 100));
  };

  const showFloater = (text: string, side: FloatingGil['side']) => {
    const id = Date.now() + Math.random();
    setFloaters((current) => [...current, { id, text, side }]);
    window.setTimeout(() => setFloaters((current) => current.filter((item) => item.id !== id)), 1150);
  };

  const playMotion = (next: BattleMotion) => {
    setMotion(next);
    window.setTimeout(() => setMotion('idle'), 620);
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

  const announceCondition = (announcement: BattleConditionAnnouncement, duration = 2500) => {
    if (conditionTimerRef.current) window.clearTimeout(conditionTimerRef.current);
    setConditionAnnouncement(announcement);
    conditionTimerRef.current = window.setTimeout(() => setConditionAnnouncement(null), duration);
  };

  const announceCurrentWind = () => {
    if (!windEnabled) return false;
    if (currentWind.type === 'CALM') {
      const text = '静穏――風補正が終了し、双方の資金効果が基準値へ戻りました';
      setStatusText(text);
      setLogs((current) => [
        { id: `wind-${Date.now()}`, category: 'system' as LogCategory, text },
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
    setStatusText(text);
    setLogs((current) => [
      { id: `wind-${Date.now()}`, category: 'system' as LogCategory, text },
      ...current,
    ].slice(0, 100));
    if (announcement.kind === 'enemy') soundFx.playWarning();
    else soundFx.playSkillSpark();
    return true;
  };

  const announceSynergy = (name: string, detail: string) => {
    announceCondition({
      kind: isBurstTime ? 'burst' : 'synergy',
      kicker: isBurstTime ? 'TAILWIND × SYNERGY' : 'PARTY COORDINATION',
      title: isBurstTime ? 'BURST TIME' : 'SYNERGY発動！',
      detail: isBurstTime ? `${name} × 味方追い風 / ${detail}` : `${name} / ${detail}`,
    });
  };

  const startBattle = () => {
    setBattlePhase('active');
    setOpeningSlowActive(true);
    setStatusText('競り値が拮抗。命令を選んでギルを積んでください');
    setLogs((current) => [
      { id: `open-${Date.now()}`, category: 'system', text: `${companyName}対${targetProperty.name}、討滅戦開始。競合は${formatCurrency(initialEnemyCommitment)}を先に積みました。` },
      ...current,
    ]);
    soundFx.playDutyStart();
    announceBattle('start', 3800);
    const announcesInitialWind =
      windEnabled && currentWind.type !== 'CALM';
    if (initialWindTimerRef.current) {
      window.clearTimeout(initialWindTimerRef.current);
    }
    if (announcesInitialWind) {
      initialWindTimerRef.current = window.setTimeout(
        announceCurrentWind,
        3900
      );
    }
    if (openingSlowTimerRef.current) window.clearTimeout(openingSlowTimerRef.current);
    openingSlowTimerRef.current = window.setTimeout(
      () => setOpeningSlowActive(false),
      announcesInitialWind ? 6500 : 3900
    );
  };

  useEffect(() => {
    if (
      battlePhase !== 'active' ||
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
    isBurstTime,
    windEnabled,
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
    const resolvedOwnership = Math.max(0, rawOwnership);
    const resolvedOverkill = result === 'player' ? Math.max(0, resolvedOwnership - 100) : 0;
    setWinner(result);
    setDefeatReason(resolvedDefeatReason);
    setFinishMethod(method);
    setFinalOwnership(resolvedOwnership);
    setOverkill(resolvedOverkill);
    setGauge(result === 'player' ? -100 : 100);
    setGaugeSpeed(0);
    setBattlePhase('finisher_notice');
    setFinishTelegraphVisible(true);
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    finishTimerRef.current = window.setTimeout(() => setFinishTelegraphVisible(false), 1450);
    setStatusText(result === 'player'
      ? '所有率100%――買収成立！'
      : resolvedDefeatReason === 'WALKING_DEAD_FAILED'
        ? '蘇生猶予終了――所有率30％へ届かず買収失敗'
        : '所有率0%――買収失敗');
    addLog(result === 'player'
      ? `${companyName}が${targetProperty.name}を${FINISH_LABELS[method]}で押し切りました。`
      : resolvedDefeatReason === 'WALKING_DEAD_FAILED'
        ? `リビングデッドの蘇生猶予中に所有率30％へ戻せず、${companyName}は敗北しました。`
        : `${companyName}は競合に所有率を押し切られました。`, 'result');
    if (result === 'player') {
      soundFx.playVictory();
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.48 } });
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
    if (!cinematic) {
      finalizeBattle(result, method, rawOwnership, resolvedDefeatReason);
      return;
    }

    decisiveRef.current = true;
    setGaugeSpeed(0);
    setGauge(result === 'player' ? -99.2 : 99.2);
    setDecisiveBlow({ winner: result, impacted: false });
    setStatusText(result === 'player'
      ? '決着の一撃――最後の資金が防衛線へ届く！'
      : resolvedDefeatReason === 'WALKING_DEAD_FAILED'
        ? '蘇生猶予終了――最後の防衛線が崩壊する！'
        : '決着の一撃――競合の大口防衛出資が直撃！');
    playMotion(result === 'player' ? 'player' : 'enemy');
    soundFx.playDecisiveBlow(result);

    decisiveImpactTimerRef.current = window.setTimeout(() => {
      setGauge(result === 'player' ? -100 : 100);
      setDecisiveBlow({ winner: result, impacted: true });
      soundFx.playCapitalImpact(result === 'player' ? 'player' : 'opponent', 1);
    }, 190);
    decisiveResolveTimerRef.current = window.setTimeout(() => {
      decisiveRef.current = false;
      finalizeBattle(result, method, rawOwnership, resolvedDefeatReason);
    }, 760);
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
    showFloater('WALKING DEAD / 1%', 'center');
    playMotion('player');
    soundFx.playWarning();
    soundFx.playSkillSpark();
    addLog('リビングデッド発動。所有率1％で踏みとどまり、10秒の蘇生猶予へ移行。', 'skill');
    return true;
  };

  const showShortNotice = () => {
    if (shortShownRef.current || endedRef.current) return;
    shortShownRef.current = true;
    setMotion('idle');
    setGaugeSpeed(0);
    setStatusText('SHORT――敵の防衛資金が枯渇。最後の一手で決着をつけてください');
    setBattlePhase('short_notice');
    addLog('SHORT！ 競合の追加防衛資金が枯渇。', 'result');
    soundFx.playWarning();
    if (shortTimerRef.current) window.clearTimeout(shortTimerRef.current);
    shortTimerRef.current = window.setTimeout(() => {
      if (endedRef.current) return;
      setBattlePhase('active');
      setStatusText('敵は追加防衛不能。自社資金のFINAL PUSHかLIMIT BREAKで決着してください');
    }, 3200);
  };

  const commitEnemyFunds = (
    requested: number,
    reason: string,
    applyGaugeShock = true,
    scheduleShort = true,
    chargeLimit = true
  ) => {
    const actual = Math.max(0, Math.min(Math.round(requested), enemyReserveRef.current));
    if (actual <= 0) {
      setAiText('SHORT / 追加防衛不能');
      if (scheduleShort) showShortNotice();
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
      showFloater(`離脱 -${formatCurrency(collapse)}`, 'enemy');
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
      setGauge((value) => capGaugeAtLivingDeadFloor(Math.min(99, value + counterShock)));
    }
    setStatusText(`敵大規模防衛出資――${formatCurrency(actual)}を対抗投入`);
    setAiText(nextReserve > 0 ? '次の敵大規模防衛出資を詠唱中' : 'SHORT / 追加防衛不能');
    showFloater(`+${formatCurrency(actual)}`, 'enemy');
    playMotion('enemy');
    soundFx.playCapitalImpact('opponent', actual / Math.max(targetProperty.marketPrice, 1));
    addLog(`${reason}として${formatCurrency(actual)}を投入。残予算${formatCurrency(nextReserve)}。`, 'enemy');
    if (nextReserve <= 0 && scheduleShort) {
      window.setTimeout(showShortNotice, 420);
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
      setCommandProgress((value) => Math.min(100, value + commandProgressPerTick * timeScale));
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
      if (livingDeadPhaseRef.current === 'waiting' || livingDeadPhaseRef.current === 'recovery') {
        const nextRemaining = Math.max(0, livingDeadRemainingRef.current - elapsed);
        livingDeadRemainingRef.current = nextRemaining;
        setLivingDeadRemaining(nextRemaining);
      }
    }, 50);
    return () => window.clearInterval(interval);
  }, [fastHorse, timeScale, winner]);

  useEffect(() => {
    if (winner) return;
    const outcome = resolveLivingDeadOutcome(
      livingDeadPhase,
      ownership,
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
      showFloater('DEAD REBIRTH / SUCCESS', 'center');
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
      showFloater('RESURRECTION FAILED', 'center');
      addLog('蘇生猶予終了。所有率30％へ届かず、リビングデッド失敗。', 'result');
      finishBattle('opponent', 'NORMAL', ownership, true, 'WALKING_DEAD_FAILED');
    }
  }, [livingDeadPhase, livingDeadRemaining, ownership, winner]);

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
    if (timeScale <= 0 || winner || decisiveRef.current || enemyReserveRef.current <= 0) return;
    const step = (100 / (enemyDecision.waitMs / 100)) * timeScale;
    const interval = window.setInterval(() => {
      setAiProgress((value) => {
        const next = value + step;
        if (next < 100) return next;
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
        return 0;
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [enemyDecision, targetProperty.marketPrice, timeScale, winner]);

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
      const velocity =
        baseVelocity *
        BATTLE_GAUGE_SPEED_FACTOR *
        leverage *
        deadZone *
        currentWind.speedMultiplier;
      setGaugeSpeed(velocity);
      setGauge((value) => {
        const next = value + velocity * dt;
        const heldNext = holdGaugeForManualShortFinish(
          next,
          enemyReserveRef.current
        );
        if (heldNext !== next) {
          setGaugeSpeed(0);
          return heldNext;
        }
        if (next <= -100) {
          finishBattle('player', 'NORMAL', (100 - next) / 2);
          return -99.2;
        }
        if (next >= 100) {
          if (triggerWalkingDead()) return livingDeadGaugeFloor;
          if (livingDeadPhaseRef.current === 'recovery') return livingDeadGaugeFloor;
          finishBattle('opponent', 'NORMAL', 0);
          return 99.2;
        }
        return capGaugeAtLivingDeadFloor(next);
      });
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [currentWind.enemyMultiplier, currentWind.playerMultiplier, currentWind.speedMultiplier, effectiveCapitalGap, enemyInvested, influenceBonus, pushMultiplier, targetProperty.marketPrice, timeScale, totalPlayerInvested, winner]);

  const investCompanyFunds = () => {
    if (cash < selectedCost) {
      soundFx.playWarning();
      setStatusText(`自社資金不足。必要額は${formatCurrency(selectedCost)}`);
      return;
    }
    if (!consumeCommand()) return;
    setPanel('capital');
    const impact = Math.min(14, (1.2 + (selectedCost / Math.max(targetProperty.marketPrice, 1)) * 20) * currentWind.playerMultiplier);
    const rawGaugeAfter = gauge - impact;
    setCash((value) => value - selectedCost);
    setCompanyInvested((value) => value + selectedCost);
    chargeLimitBreak(selectedCost * currentWind.playerMultiplier);
    setGauge(Math.max(-99, rawGaugeAfter));
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
    if (selectedLevel >= 4) setAiProgress((value) => Math.max(value, selectedLevel === 5 ? 82 : 70));

    if (enemyReserveRef.current <= 0) {
      setFinalPushActive(true);
      setBattlePhase('limit_charge');
      announceBattle('final', 1800);
      setGaugeSpeed(0);
      setStatusText(`FINAL PUSH――${formatCurrency(selectedCost)}で最後の防衛線を突破！`);
      showFloater(`FINAL +${formatCurrency(selectedCost)}`, 'player');
      soundFx.playFinalPush();
      const rawFinishOwnership = Math.max(
        (100 - rawGaugeAfter) / 2,
        100 + (selectedCost / Math.max(targetProperty.marketPrice, 1)) * 50
      );
      window.setTimeout(() => finishBattle('player', 'FINAL_PUSH', rawFinishOwnership), 1100);
      return;
    }

    if (rawGaugeAfter <= -100) {
      finishBattle('player', 'NORMAL', (100 - rawGaugeAfter) / 2);
    }
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
      showFloater(`独立 -${formatCurrency(lost)}`, 'center');
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
    setGauge((value) => Math.max(-99, value - impact));
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
    setBattlePhase('limit_charge');
    setGaugeSpeed(0);
    announceBattle('limit', 2300);
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
    setStatusText(`LIMIT BREAK ${limitBreakTier}――${survivors.length + 1}社の出資を集約中`);
    addLog(`LIMIT BREAK ${limitBreakTier}発動。自社と傘下${battleSubs.length}社が全社出資へ参加。`, 'skill');

    limitBreakTimerRef.current = window.setTimeout(() => {
      if (endedRef.current) return;
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

      confetti({ particleCount: 110, spread: 82, startVelocity: 38, origin: { y: 0.62 }, colors: ['#fef08a', '#f59e0b', '#34d399', '#ffffff'] });
      soundFx.playCapitalImpact('player', 1);
      soundFx.playBigCash();
      const emergencyDefense = Math.min(
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
        ownership,
        ownershipPush,
        defenseResult.counterShock
      );
      const rawGaugeAfter = 100 - rawOwnershipAfter * 2;
      setGauge(Math.max(-100, Math.min(100, rawGaugeAfter)));
      showFloater(`LIMIT BREAK +${formatCurrency(amount)}`, 'player');
      playMotion(leaving.length ? 'rebel' : 'player');

      if (leaving.length) {
        setStatusText(`DEFECT！ ${leaving.map((member) => member.name).join('・')}が支援を撤回。残存投入${formatCurrency(amount)}`);
        addLog(`DEFECT！ ${leaving.map((member) => member.name).join('・')}が離反し、過去支援${formatCurrency(lost)}が崩落。`, 'funds');
      } else {
        setStatusText(
          `LIMIT BREAK ${limitBreakTier}！ 所有率+${ownershipPush.toFixed(1)}pt` +
          (defenseResult.actual > 0
            ? ` / 緊急防衛-${defenseOwnershipPushback.toFixed(1)}pt`
            : '')
        );
      }

      if (rawOwnershipAfter >= 100) {
        finishBattle('player', `LIMIT_BREAK_${limitBreakTier}` as FinishMethod, rawOwnershipAfter);
        return;
      }
      setBattlePhase('active');
      setBattleAnnouncement(null);
      setLastPlayerAction(null);
      setAiProgress(0);
      setAiCycle((cycle) => cycle + 1);
      if (enemyReserveRef.current <= 0) showShortNotice();
    }, 1850);
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
    setGauge((value) => Math.max(-99, value - groupImpact));
    showFloater(`連携 +${formatCurrency(amount)}`, 'player');
    playMotion(leaving.length ? 'rebel' : 'player');
    soundFx.playBigCash();
    announceSynergy(name, `${members.length}社連携 / +${formatCurrency(amount)}`);
    if (leaving.length) {
      setStatusText(`${name}が発動。しかし${leaving.length}社が独立し${formatCurrency(lost)}崩落`);
      addLog(`${name}から${formatCurrency(amount)}を調達したが、${leaving.map((item) => item.name).join('・')}が独立。`, 'funds');
    } else {
      setStatusText(`${name}発動！ ${formatCurrency(amount)}を一斉調達`);
      addLog(`${name}の${members.length}社から${formatCurrency(amount)}を一斉調達。`, 'funds');
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
    announceSynergy(
      alliancePublicPatronage ? 'PUBLIC PATRONAGE' : 'ALLIANCE SUPPORT',
      `${alliance.allyName}から+${formatCurrency(amount)}相当`
    );
    addLog(alliancePublicPatronage
      ? `${alliance.allyName}へ通商支援を要請。許認可・調達・輸送を含む${formatCurrency(amount)}相当の後援支援。`
      : `${alliance.allyName}へ協力支援を要請。${formatCurrency(amount)}を調達。`, 'funds');
  };

  const useSkill = (skill: TacticalSkill) => {
    if (
      (skillCooldowns[skill.id] || 0) > 0 ||
      (skill.oncePerBattle && usedSkillIds.has(skill.id)) ||
      !consumeCommand()
    ) return;
    setPanel('capital');
    setSkillCooldowns((current) => ({ ...current, [skill.id]: skill.cooldownMs }));
    if (skill.oncePerBattle) {
      setUsedSkillIds((current) => new Set(current).add(skill.id));
    }
    showFloater(skill.name, 'center');
    playMotion('player');
    soundFx.playSkillSpark();

    if (skill.effectType === 'COOLDOWN_REDUCTION') {
      setFastHorseRemaining(TACTICAL_SKILL_BALANCE.fastAction.durationMs);
      setStatusText('神速魔――10秒間、命令ゲージの進行速度が約1.8倍');
    } else if (skill.effectType === 'NEMAWASHI') {
      setBattleSubs((current) => current.map((item) => ({
        ...item,
        loyaltyRisk: Math.floor(
          item.loyaltyRisk / TACTICAL_SKILL_BALANCE.moraleSupport.loyaltyRiskDivisor
        ),
      })));
      setStatusText('士気高揚の策――全傘下の独立危険度が半減');
    } else if (skill.effectType === 'INDEPENDENCE_SABOTAGE') {
      setEnemyDisruptionRemaining(TACTICAL_SKILL_BALANCE.disruption.durationMs);
      setStatusText('連環計――9秒間、競合の追加防衛を70%で中断');
    } else if (skill.effectType === 'DEMORALIZE') {
      setEnemySlowedRemaining(TACTICAL_SKILL_BALANCE.demoralize.durationMs);
      setStatusText('競合の指揮系統が混乱。敵の命令待ち時間が延長');
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
      showFloater('LIVING DEAD / ARMED', 'center');
    } else if (skill.effectType === 'SYNERGY_PUSH') {
      setPushMultiplierRemaining(TACTICAL_SKILL_BALANCE.battleLitany.durationMs);
      setStatusText('バトルリタニー――7秒間、所有率の押し込み速度が1.5倍');
    }
    announceCondition({
      kind: 'player',
      kicker:
        skill.effectType === 'INDEPENDENCE_SABOTAGE' ||
        skill.effectType === 'DEMORALIZE'
          ? 'TACTICAL DEBUFF / RIVAL'
          : 'TACTICAL BUFF / COMPANY',
      title: skill.name,
      detail: skill.description,
    });
    addLog(`${skill.name}を使用。${skill.description}`, 'skill');
  };

  const resultSettlementCost = Math.round(
    companyInvested * (winner === 'player' ? 0.35 : 0.75)
  );

  const confirmResult = () => {
    onBattleEnd({
      winner: winner || 'opponent',
      targetProperty,
      companyFundsInvested: companyInvested,
      demandFundsInvested: demandInvested,
      brokerageFee,
      settlementCost: resultSettlementCost,
      battleCashDelta: 0,
      victoryReward: calculateBattleVictoryReward(
        targetProperty.marketPrice,
        winner === 'player',
        isUltimate ? 'ultimate' : isSavage ? 'savage' : 'normal',
        targetProperty.owner === 'player'
      ),
      rebelledProperties: rebelled,
      finishMethod,
      finalOwnership,
      overkill,
    });
  };

  const resultAnalysis = winner === 'player'
    ? finishMethod.startsWith('LIMIT_BREAK')
      ? `勝因はカンパニー網の総動員でっす。LIMIT BREAKで${formatCurrency(demandInvested)}を集め、所有率を一気に押し切ったでっす。`
      : demandInvested > companyInvested
        ? `勝因はSYNERGYでっす。傘下から集めた${formatCurrency(demandInvested)}が競り値を押し上げたでっす。`
        : finishMethod === 'FINAL_PUSH'
          ? `勝因は自社資金の決断でっす。SHORT後までギルを残し、${FINISH_LABELS[finishMethod]}で決着したでっす。`
          : `勝因は資金差の維持でっす。競合の防衛中も出資優位を保ち、${FINISH_LABELS[finishMethod]}で所有率を押し切ったでっす。`
    : defeatReason === 'WALKING_DEAD_FAILED'
      ? 'リビングデッドは発動したでっすが、10秒以内に所有率30％へ戻せなかったでっす。蘇生猶予では意気衝天や大口出資を温存しておくでっす。'
      : rebelled.length > 0
        ? isHighEndRaid
          ? `${rebelled.length}社が記録戦中に一時離脱し、支援の山が崩れたでっす。通常傘下は保護されるので、資金要求の順番を組み直すでっす。`
          : `${rebelled.length}社の独立で資金の山が崩れたでっす。次は独立危険度の高い傘下へ要求する前に士気高揚の策を使うでっす。`
        : `競合の競り値を${formatCurrency(Math.max(0, -capitalGap))}下回り、所有率を押し戻されたでっす。`;

  const briefingSynergies = [
    ...(battleSubs.length + 1 >= 4
? [`ライトパーティ：${battleSubs.length + 1}社参加・SYNERGY / 味方追い風でBURST TIME`]
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
              ? `${selectedBattleSynergyMembers.length}社で発動可能`
              : '必要な傘下が不足'
          }`,
        ]
      : []),
    ...(tradeNetworkBonus > 0 ? [`都市交易網：自社押込 +${Math.round(tradeNetworkBonus * 100)}%`] : []),
  ];

  return (
    <div
      ref={rootDialogRef}
      className={`buyout-screen buyout-screen--phase-${battlePhase} buyout-screen--living-${livingDeadPhase} ${limitImpactActive ? 'buyout-screen--limit-impact' : ''} ${isBurstTime ? 'buyout-screen--burst' : ''} ${decisiveBlow ? `buyout-screen--decisive buyout-screen--decisive-${decisiveBlow.winner}` : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${targetProperty.name}との商戦`}
      tabIndex={-1}
      style={{ '--battle-time-scale': timeScale } as React.CSSProperties}
    >
      <img className="buyout-backdrop" src={FANKIT_ART.battleBackdrop} alt="" aria-hidden="true" />
      {limitImpactActive && <div className="limit-impact-field" aria-hidden="true"><i /><i /><i /><i /><i /></div>}

      {battleAnnouncement && (
        <div className={`battle-announcement battle-announcement--${battleAnnouncement}`} aria-live="assertive">
          <div>
            <small>{battleAnnouncement === 'start' ? 'CONTENT COMMENCED' : battleAnnouncement === 'limit' ? `LIMIT BREAK ${activeLimitBreakTier || limitBreakTier}` : 'FINAL PUSH'}</small>
            <strong>{battleAnnouncement === 'start' ? `${targetProperty.name} 討滅戦` : battleAnnouncement === 'limit' ? '全社資金・総動員' : '最終買収攻勢'}</strong>
            <span>{battleAnnouncement === 'start' ? `START! / ${companyName}` : battleAnnouncement === 'limit' ? `${battleSubs.length + 1}社のギルを解放` : '最後の一手で買収成立へ'}</span>
          </div>
        </div>
      )}

      {conditionAnnouncement && (
        <div className={`battle-condition-announcement battle-condition-announcement--${conditionAnnouncement.kind}`} aria-live="assertive">
          <div className="battle-condition-announcement__wind" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <div>
            <small>{conditionAnnouncement.kicker}</small>
            <strong>{conditionAnnouncement.title}</strong>
            <span>{conditionAnnouncement.detail}</span>
          </div>
        </div>
      )}

      {livingDeadPhase !== 'inactive' && (
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
          <span>{isUltimate ? '絶商戦 攻略中' : isSavage ? '商戦 零式 攻略中' : '買収交渉中'}</span>
          <strong title={targetProperty.name}>{targetProperty.name}</strong>
          <small>
            {battleContextLabel ?? `${targetProperty.community}・${targetProperty.industry}`}
            {battleRegionLabel ? `／${battleRegionLabel}` : ''}
          </small>
        </div>
        <div className="buyout-header__actions">
          <button type="button" onClick={() => setShowHelp(true)} aria-label="買収劇の遊び方"><CircleHelp /></button>
          {battlePhase === 'briefing' && (
            <button type="button" onClick={onClose} aria-label="買収劇を閉じる"><X /></button>
          )}
        </div>
      </header>

      <main className="buyout-main">
        <section
          className={`battle-stage integrated-battlefield ownership-board--wind-${windSide} ${isSavage ? 'integrated-battlefield--savage' : ''} ${isUltimate ? 'integrated-battlefield--ultimate' : ''}`}
          aria-label="所有率、両陣営、投入資金、行動予兆の統合商戦フィールド"
          inert={backgroundInert}
          style={{
            '--battle-frontline': `${ownership}%`,
            '--capital-pressure': `${capitalPressurePosition}%`,
          } as React.CSSProperties}
        >
        <div className="battlefield-pressure-lane" aria-hidden="true">
          <i className="battlefield-pressure-lane__player" />
          <i className="battlefield-pressure-lane__enemy" />
          <span className="battlefield-pressure-lane__front"><i /><i /><i /></span>
        </div>
        {(isSavage || isUltimate) && (
          <div className={`battlefield-raid-marker ${isUltimate ? 'battlefield-raid-marker--ultimate' : ''}`}>
            {isUltimate ? (
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
            <b className="company-name-compact" title={companyName}>{companyName} {ownership.toFixed(1)}%</b>
            <span className={gaugeSpeed < -0.02 ? 'push-player' : gaugeSpeed > 0.02 ? 'push-enemy' : ''}>
              {gaugeSpeed < -0.02 ? '▶ 買収推進中' : gaugeSpeed > 0.02 ? '◀ 競合防衛中' : '◆ 競り値拮抗'}
            </span>
            <b title={targetProperty.name}>{targetProperty.name} {(100 - ownership).toFixed(1)}%</b>
          </div>
          <div className="ownership-duel">
            <div className="ownership-fighter ownership-fighter--player">
              <img className={`ownership-avatar ownership-avatar--player ${motion === 'player' ? 'avatar-attack' : ''}`} src={FANKIT_ART.tataru.windUp} alt="タタル" />
            </div>
            <div
              className={`ownership-track ownership-track--${battleDirection} wind-field--${windSide} ${finalPushActive ? 'ownership-track--final' : ''} ${motion !== 'idle' ? 'ownership-track--impact' : ''}`}
              aria-label={`${companyName}の所有率${ownership.toFixed(1)}%`}
              style={{ '--flow-duration': `${Math.max(.32, 1.4 - Math.min(1, ownershipRate / 4))}s` } as React.CSSProperties}
            >
              <div className="ownership-track__player" style={{ width: `${ownership}%` }} />
              <div className="battle-wind-magic" aria-hidden="true"><i /><i /><i /><i /></div>
              <div key={currentWind.type} className={`battle-wind-sigil battle-wind-sigil--${windSide}`}>
                <Sparkles /><b>{windTitle}</b><span>{windDetail}</span>
                <small>
                  {!windEnabled
                    ? '進行後に解放'
                    : currentWind.type === 'CALM'
                      ? `次の風まで ${windCountdown}秒`
                      : `静穏まで ${windCountdown}秒`}
                </small>
              </div>
              <div className="ownership-track__enemy-flow" style={{ left: `${ownership}%` }} />
              <div className="ownership-track__tension" style={{ left: `${ownership}%` }} />
              <div className="ownership-track__ticks">{Array.from({ length: 9 }).map((_, index) => <i key={index} />)}</div>
              <div className="ownership-track__marker" style={{ left: `${ownership}%` }}><i /><i /><i /></div>
            </div>
            <div className="ownership-fighter ownership-fighter--enemy">
              <img className={`ownership-avatar ownership-avatar--enemy ${motion === 'enemy' ? 'avatar-hit' : ''}`} src={getFankitJobArt(targetProperty.industry)} alt="競合代表" />
            </div>
          </div>
          <p className={motion === 'rebel' ? 'status-rebel' : ''}>{statusText}</p>
        </section>

        <section className="capital-arena battlefield-capital">
          <div className="capital-arena__side">
            <div className="player-capital-stack">
              <GilTower amount={totalPlayerInvested} marketPrice={targetProperty.marketPrice} side="player" motion={motion} />
              <div className={`player-budget-overlay player-budget-overlay--${playerReserveState}`}>
                <small>未投入資金</small>
                <strong>{playerReservePercent.toFixed(1)}%</strong>
                <span>{playerReservePercent <= 0 ? '回復待ち' : playerReservePercent <= 10 ? '枯渇寸前・回復中' : '投入可能'}</span>
              </div>
            </div>
            <small className="capital-effective-detail">
              <span>積上げ {playerCapitalProgress.toFixed(0)}%　自社 {formatCurrency(companyInvested)} / 支援 {formatCurrency(demandInvested)}</span>
              <b>風反映後 {formatCurrency(effectivePlayerInvested)}相当（×{currentWind.playerMultiplier.toFixed(2)}）</b>
            </small>
            <div className="capital-source-bar"><i style={{ width: `${totalPlayerInvested > 0 ? companyInvested / totalPlayerInvested * 100 : 0}%` }} /><span /></div>
          </div>
          <div className="capital-arena__center">
            <div className={`capital-clash capital-clash--${battleDirection}`}><i /><i /><i /></div>
            <b className="capital-vs">VS</b>
            <strong>{capitalPressureLabel}</strong>
            <small>資本 {Math.round(effectivePlayerShare)}:{Math.round(100 - effectivePlayerShare)}</small>
            {enemyReserve <= 0 && <em>SHORT</em>}
          </div>
          <div className="capital-arena__side">
            <div className="enemy-capital-stack">
              <GilTower amount={enemyInvested} marketPrice={targetProperty.marketPrice} side="enemy" motion={motion} />
              <div className={`enemy-budget-overlay enemy-budget-overlay--${enemyReserveState}`}>
                <small>追加防衛枠</small>
                <strong>{enemyReservePercent.toFixed(1)}%</strong>
                <span>{enemyReserve <= 0 ? 'SHORT / 追加投入不能' : enemyReservePercent <= 10 ? '枯渇寸前' : '追加投入余力'}</span>
              </div>
            </div>
            <small className="capital-effective-detail">
              <span>積上げ {enemyCapitalProgress.toFixed(0)}%　追加防衛枠 {formatCurrency(enemyReserve)}</span>
              <b>風反映後 {formatCurrency(effectiveEnemyInvested)}相当（×{currentWind.enemyMultiplier.toFixed(2)}）</b>
            </small>
            <div className="enemy-reserve-bar"><i style={{ width: `${enemyReservePercent}%` }} /></div>
          </div>
          {floaters.map((item) => <i key={item.id} className={`gil-floater gil-floater--${item.side}`}>{item.text}</i>)}
        </section>

        <section className="active-time battlefield-timing">
          <div className="active-time__mode">
            <TimerReset />
            <span>{timeScale === 0
              ? '演出・画面表示中：停止'
              : timeScale === 0.1
                ? openingSlowActive ? '開始演出中 ×0.1' : '戦術選択中 ×0.1'
                : timeScale === 0.16 ? '決着スロー ×0.16' : '通常進行'}</span>
            <b className="battle-income-rate">商流 +{formatCurrency(Math.round(battleCashRecoveryPerSecond * timeScale))}/秒</b>
          </div>
          <div className="recast-lanes">
            <div className={`recast-lane recast-lane--player ${commandReady ? 'recast-lane--ready' : ''}`}>
              <span><b>自社コマンド</b><small>{fastHorse ? '神速魔で加速中' : commandReady ? '命令入力可能' : '次の命令を準備中'}</small></span>
              <strong>{commandReady ? '発動可' : `${playerRecastSeconds.toFixed(1)}秒`}</strong>
              <i><u style={{ width: `${commandProgress}%` }} /></i>
            </div>
            <div className={`recast-lane recast-lane--enemy ${aiProgress >= 72 ? 'recast-lane--danger' : ''}`} title={aiText}>
              <span><b>競合アクション</b><small>{enemyReserve <= 0 ? '追加防衛不能' : aiText}</small></span>
              <strong>{enemyReserve <= 0 ? 'SHORT' : `${enemyRecastSeconds.toFixed(1)}秒`}</strong>
              <i><u style={{ width: `${aiProgress}%` }} /></i>
            </div>
          </div>
        </section>
        </section>

        <section className="battle-action-strip" aria-label="LIMIT BREAK、SYNERGY、スキル、資金源" inert={backgroundInert}>
          <button
            type="button"
            className={`battle-action-strip__action battle-action-strip__action--lb ${limitBreakGaugeFull ? 'is-overflowing' : ''}`}
            onClick={demandFromAllies}
            disabled={!commandReady || limitBreakTier === 0 || actionsLocked}
            aria-label={limitBreakCapacityTier === 0
              ? `LIMIT BREAK 未解放。あと${Math.max(0, 4 - (battleSubs.length + 1))}社`
              : `LIMIT BREAK ${limitBreakTier > 0 ? `${limitBreakTier}発動可能` : '蓄積中'}。ゲージ${Math.floor(visibleLimitBreakCharge)}／${limitBreakChargeCapacity}。発動時は全消費`}
            title={limitBreakCapacityTier > 0
              ? '発動すると蓄積したLBゲージをすべて消費します'
              : '自社を含む4社でLIMIT BREAK Iを解放します'}
          >
            {limitBreakGaugeFull && (
              <span className="battle-action-strip__overflow" aria-hidden="true"><i /><i /><i /><i /></span>
            )}
            <Zap />
            <span>
              <b>{limitBreakCapacityTier === 0 ? 'LB 未解放' : limitBreakTier > 0 ? `LB ${limitBreakTier}` : 'LB 蓄積中'}</b>
              <small>{limitBreakCapacityTier === 0
                ? `あと${Math.max(0, 4 - (battleSubs.length + 1))}社`
                : limitBreakTier > 0
                  ? commandReady ? `最大+${limitBreakOwnershipCap}pt` : `共通 ${playerRecastSeconds.toFixed(1)}秒`
                  : `${Math.floor(visibleLimitBreakCharge)}/${limitBreakChargeCapacity}`}</small>
            </span>
            {limitBreakCapacityTier > 0 && (
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
            )}
          </button>

          <button
            type="button"
            className="battle-action-strip__action battle-action-strip__action--synergy"
            onClick={() => {
              if (!selectedBattleSynergy) return;
              demandFromGroup(
                selectedBattleSynergy.name,
                selectedBattleSynergyMembers,
                selectedBattleSynergy.battleGroupMultiplier ?? 1.28
              );
            }}
            disabled={!selectedBattleSynergy || !commandReady || !battleSynergyReady || actionsLocked}
            title={selectedBattleSynergy
              ? `${selectedBattleSynergy.name}：選択中の事業連携を発動`
              : '事業連携を覚えると、ここへ1枠だけ装備できます'}
          >
            <Sparkles />
            <span>
              <b>SYNERGY</b>
              <small>{selectedBattleSynergy?.name ?? '未装備'}</small>
            </span>
            <em>{!selectedBattleSynergy
              ? '進行で解放'
              : !battleSynergyReady
                ? '連携崩壊'
                : commandReady
                  ? '発動可'
                  : `共通 ${playerRecastSeconds.toFixed(1)}秒`}</em>
          </button>

          {primarySkill && (
            <button
              type="button"
              className={`battle-action-strip__action battle-action-strip__action--skill ${primarySkill.effectType === 'LIVING_DEAD' ? 'is-living-dead' : ''}`}
              onClick={() => useSkill(primarySkill)}
              disabled={!commandReady || primarySkillCooldown > 0 || primarySkillUsed || actionsLocked}
              title={`${primarySkill.name}：${getQuickSkillSummary(primarySkill)}`}
            >
              {primarySkill.effectType === 'LIVING_DEAD' ? <ShieldAlert /> : <Zap />}
              <span>
                <b>{primarySkill.name}</b>
                <small>{getQuickSkillSummary(primarySkill)}</small>
              </span>
              <em>{primarySkillUsed
                ? '使用済み'
                : primarySkillCooldown > 0
                  ? `${(primarySkillCooldown / 1000).toFixed(1)}秒`
                  : commandReady
                    ? '発動可'
                    : `共通 ${playerRecastSeconds.toFixed(1)}秒`}</em>
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
            <span><b>資金源</b><small>{battleSubs.length}社＋協力</small></span>
          </button>
        </section>

        <section className="command-deck command-deck--compact" inert={backgroundInert}>
          <div className="command-deck__summary">
            <span><Coins /><b>自社資金</b><small>可処分 {formatCurrency(cash)}</small></span>
            <span className={`command-deck__wind command-deck__wind--${windSide}`}>
              <Sparkles /><b>{windTitle}</b><small>{windDetail}</small>
            </span>
          </div>

            <div className="command-panel command-panel--capital">
              <div className="investment-levels">
                {INVESTMENT_LEVELS.map((item) => {
                  const cost = getInvestmentCost(targetProperty.marketPrice, item.level);
                  return (
                    <button
                      type="button"
                      key={item.level}
                      className={selectedLevel === item.level ? 'selected' : ''}
                      aria-pressed={selectedLevel === item.level}
                      onClick={() => setSelectedLevel(item.level)}
                      disabled={cost > cash}
                    >
                      <small>{item.label}</small><b>{formatCurrency(cost)}</b>
                    </button>
                  );
                })}
              </div>
              <button type="button" className="command-primary" onClick={investCompanyFunds} disabled={!commandReady || !maxAffordableConfig || cash < selectedCost || actionsLocked}>
                <HandCoins /><span>{!maxAffordableConfig ? '自己資金不足' : commandReady ? `${formatCurrency(selectedCost)}を積む` : '命令待ち…'}</span>
              </button>
              <p className={maxAffordableConfig && maxAffordableConfig.level < 5 ? 'investment-auto-note' : ''}>
                可処分資金 {formatCurrency(cash)}　／　{maxAffordableConfig && maxAffordableConfig.level < 5 ? `残高連動：最大「${maxAffordableConfig.label}」へ自動調整` : '資金差だけが所有率を動かします'}
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
              <div className={`command-wind-context command-wind-context--${windSide}`}>
                <span><Sparkles /><b>{windTitle}</b><em>{windDetail}</em></span>
                <small>
                  {!windEnabled
                    ? 'この章は風補正なし。まず資金源の選び方を覚えます。'
                    : `この画面では所有率・競合行動・リキャスト・風も×0.1進行。${
                        currentWind.type === 'CALM' ? '次の風' : '静穏'
                      }まで${windCountdown}秒。`}
                </small>
              </div>
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
                  <small>自社を含む4社でゲージ1本目を解放</small>
                </span>
                <strong>あと{Math.max(0, 4 - (battleSubs.length + 1))}社</strong>
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
              {battleSubs.length === 0 && <p className="empty-funds">資金を要求できる傘下がありません。</p>}
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
                  return (
                    <button
                      type="button"
                      key={`drawer-${skill.id}`}
                      className={skill.effectType === 'LIVING_DEAD' ? 'is-living-dead' : ''}
                      onClick={() => useSkill(skill)}
                      disabled={!commandReady || cooldown > 0 || used || actionsLocked}
                    >
                      {skill.effectType === 'LIVING_DEAD' ? <ShieldAlert /> : <Zap />}
                      <span><b>{skill.name}</b><small>{skill.description}</small></span>
                      <em>{used
                        ? '使用済み'
                        : cooldown > 0
                          ? `${(cooldown / 1000).toFixed(1)}秒`
                          : commandReady
                            ? '発動可'
                            : `共通 ${playerRecastSeconds.toFixed(1)}秒`}</em>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className={`buyout-footer ${winner ? 'buyout-footer--settled' : ''}`} inert={backgroundInert}>
        {winner ? (
          <>
            <span>{winner === 'player'
              ? `${FINISH_LABELS[finishMethod]} / 所有率 ${finalOwnership.toFixed(1)}%`
              : defeatReason === 'WALKING_DEAD_FAILED' ? 'WALKING DEAD FAILED / 蘇生失敗' : 'CAPITAL COLLAPSE / 買収失敗'}</span>
            <button type="button" className="battle-next-button" onClick={() => setBattlePhase('result')} disabled={finishTelegraphVisible}>
              {finishTelegraphVisible ? '演出中' : '分析へ →'}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setShowLog(true)}><ScrollText />戦局ログ</button>
            <span>{logs[0]?.text}</span>
            <button type="button" onClick={() => finishBattle('opponent', 'NORMAL', ownership, false)}>撤退</button>
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
            aria-label={`${targetProperty.name}との交渉準備`}
            tabIndex={-1}
          >
            <header><Swords /><strong>{isUltimate ? 'ULTIMATE TRADE DUTY' : isSavage ? 'SAVAGE TRADE RAID' : '買収交渉'}</strong></header>
            <div className="briefing-versus">
              <b className="company-name-full" title={companyName}>{companyName}</b>
              <span>VS</span>
              <b className="company-name-full" title={targetProperty.name}>{targetProperty.name}</b>
            </div>
            <StrengthComparison result={battleReadiness} />
            <dl className="briefing-facts">
              <div>
                <dt>{isHighEndRaid ? '競合連合・対象地域' : '対象都市・業界'}</dt>
                <dd>
                  {battleContextLabel ?? `${targetProperty.community}・${targetProperty.industry}`}
                  {battleRegionLabel ? <small>{battleRegionLabel}</small> : null}
                </dd>
              </div>
              <div><dt>現在相場</dt><dd>{formatCurrency(targetProperty.marketPrice)}</dd></div>
              <div><dt>仲介手数料</dt><dd>{formatCurrency(brokerageFee)}</dd></div>
              <div>
                <dt>競合想定予算</dt>
                <dd>
                  {formatCurrency(enemyBudget)}
                  <small>開幕 {formatCurrency(battleReadiness.enemyOpeningCapital)}／追加防衛 {formatCurrency(battleReadiness.enemyReserveCapital)}</small>
                </dd>
              </div>
              <div><dt>競合戦術</dt><dd>{isUltimate ? '絶商戦' : isSavage ? '零式レイド' : 'AI'} LEVEL {enemyDifficultyLevel}</dd></div>
              <div><dt>資金精算</dt><dd>勝利35%／敗北・撤退75%</dd></div>
              <div><dt>LBゲージ</dt><dd>{limitBreakCapacityTier === 0 ? '未解放（自社含む4社で解放）' : `${Math.floor(visibleLimitBreakCharge)}/${limitBreakChargeCapacity}（最大${limitBreakCapacityTier}本・次戦へ継承）`}</dd></div>
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
                  ? `公的後援：${alliance.allyName}／通商支援1回 +${formatCurrency(allianceSupport)}相当（所有・LB社数には不算入）`
                  : `協力協定：${alliance.allyName}／協力支援1回 +${formatCurrency(allianceSupport)}`
                : '今回利用できる外部協力・公的後援はありません。'}</p>
            </section>
            {isHighEndRaid && (
              <section className="briefing-section briefing-savage">
                <h3><Swords />{isUltimate ? '絶商戦ルール' : '零式ルール'}</h3>
                <p>通常編の地域・業界・交易網補正は無効。通常物件の所有権・収益・独立危険度は変化せず、失敗後も同じ戦いへ再挑戦できます。</p>
              </section>
            )}
            <section className="briefing-section">
              <h3><ShieldAlert />勝敗条件</h3>
              <p>未投入資金や追加防衛枠が残っていても、所有率0％になった側は敗北します。</p>
              <p>競合がSHORTすると所有率99.5％で停止します。自社出資かLIMIT BREAKで決着してください。</p>
              {equippedSkills.some((skill) => skill.effectType === 'LIVING_DEAD') && (
                <p className="briefing-living-dead">例外：リビングデッド待機中は1％で踏みとどまり、10秒以内に正規化所有率30％へ戻せば続行できます。</p>
              )}
            </section>
            <button type="button" className="dialog-close briefing-start" onClick={startBattle}>
              {isUltimate
                ? `絶商戦を開始（${battleReadiness.symbol}${battleReadiness.label}）`
                : isSavage
                  ? `零式レイド開始（${battleReadiness.symbol}${battleReadiness.label}）`
                  : `この条件で討滅戦開始（${battleReadiness.symbol}${battleReadiness.label}）`}
            </button>
            <button type="button" className="dialog-close briefing-cancel" onClick={onClose}>
              今回は交渉を見送る
            </button>
          </article>
        </div>
      )}

      {battlePhase === 'short_notice' && (
        <div className="battle-short-telegraph" aria-live="assertive">
          <i />
          <small>DEFENSE CAPITAL</small>
          <strong>SHORT</strong>
          <span>敵追加防衛資金 0%</span>
          <i />
        </div>
      )}

      {decisiveBlow && (
        <div className={`battle-decisive-blow battle-decisive-blow--${decisiveBlow.winner} ${decisiveBlow.impacted ? 'battle-decisive-blow--impact' : ''}`} aria-live="assertive">
          <i />
          <small>{decisiveBlow.winner === 'player' ? 'FINAL CAPITAL IMPACT' : 'RIVAL CAPITAL IMPACT'}</small>
          <strong>DECISIVE BLOW</strong>
          <span>{decisiveBlow.winner === 'player' ? '最後の一手が防衛線を貫く' : '大口防衛出資が所有率を押し潰す'}</span>
          <i />
        </div>
      )}

      {battlePhase === 'finisher_notice' && winner && finishTelegraphVisible && (        <div className={`battle-finish-telegraph battle-finish-telegraph--${winner}`} aria-live="assertive">
          <i />
          <small>{winner === 'player' ? 'DUTY COMPLETE' : 'DUTY FAILED'}</small>
          <strong>{winner === 'player' ? 'WIN!' : 'LOSE'}</strong>
          <span>{winner === 'player'
            ? FINISH_LABELS[finishMethod]
            : defeatReason === 'WALKING_DEAD_FAILED' ? 'WALKING DEAD FAILED' : 'CAPITAL COLLAPSE'}</span>
          {winner === 'player' && overkill >= 0.5 && <em>OVERKILL +{overkill.toFixed(1)}%</em>}
          <i />
        </div>
      )}

      {showHelp && (
        <div className="buyout-overlay">
          <article ref={helpDialogRef} className="buyout-dialog" role="dialog" aria-modal="true" aria-label="買収劇の遊び方" tabIndex={-1}>
            <header><CircleHelp /><strong>買収劇の遊び方</strong><button type="button" data-modal-close onClick={() => setShowHelp(false)} aria-label="ヘルプを閉じる"><X /></button></header>
            <ol>
              <li><b>ギルを積む</b><span>自社・傘下・SYNERGYから資金を集めます。</span></li>
              <li><b>戦術選択</b><span>資金源やスキルの選択中は、商戦と商流回復が通常の10%になります。</span></li>
              <li><b>商流回復</b><span>通常時は相場の0.3%/秒、1戦につき相場の15%まで可処分資金が戻ります。</span></li>
              <li><b>風を読む</b><span>グリダニアは風なし。進行後は静穏16秒の後に10秒だけ風が吹きます。青は自社強化、赤は競合強化または自社弱体です。</span></li>
              <li><b>LIMIT BREAK</b><span>攻防の資金衝突で通常比20％速く蓄積し、動員資金も20％増加。4/8/16社で1/2/3本まで解放され、発動のたび全ゲージを0にします。同じ戦闘でも再蓄積すれば再発動できます。</span></li>
              <li><b>特殊アクション</b><span>商戦フィールド直下の操作帯からLB・選択中のSYNERGY・主要スキルを1タップで実行できます。全スキルと資金源はドロワーで開き、実行後は通常速度へ戻ります。</span></li>
              <li><b>リビングデッド</b><span>10秒の待機中に所有率0％へ到達すると1％で耐えます。その後10秒以内に30％以上へ戻せなければ敗北。1交渉1回です。</span></li>
              <li><b>協力協定</b><span>外部協力先から一交渉1回の支援です。LBの社数や投入額には含みません。</span></li>
              <li><b>独立リスク</b><span>傘下へ繰り返し要求できますが、独立すると過去支援も崩れます。</span></li>
              <li><b>SHORT</b><span>敵の追加防衛資金が0になった戦況通知。約3.2秒後に自動再開し、所有率99.5%で踏みとどまります。自社資金のFINAL PUSHかLIMIT BREAKで決着してください。</span></li>
              <li><b>OVERKILL</b><span>所有率100%をどれだけ超えて押し切ったかを示す派手さの評価です。</span></li>
            </ol>
            <button type="button" className="dialog-close" onClick={() => setShowHelp(false)}>商談へ戻る</button>
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
            aria-label={`${targetProperty.name}の交渉結果`}
            tabIndex={-1}
          >
            <header>
              {winner === 'player' ? <Trophy /> : <XCircle />}
              <strong>{winner === 'player'
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
              <p><b>タタルの{winner === 'player' ? '勝因' : '敗因'}分析</b><span>「{resultAnalysis}」</span></p>
            </div>
            <div className="result-numbers">
              <span><small>FINISH</small><b>{winner === 'opponent' && defeatReason === 'WALKING_DEAD_FAILED' ? 'WALKING DEAD FAILED' : FINISH_LABELS[finishMethod]}</b></span>
              <span><small>最終所有率</small><b>{winner === 'player' ? `${finalOwnership.toFixed(1)}%` : `${ownership.toFixed(1)}%`}</b></span>
              <span><small>OVERKILL</small><b>{winner === 'player' ? `+${overkill.toFixed(1)}%` : '---'}</b></span>
              <span><small>自社競り値</small><b>{formatCurrency(totalPlayerInvested)}</b></span>
              <span><small>競合競り値</small><b>{formatCurrency(enemyInvested)}</b></span>
              <span><small>商流回復</small><b>+{formatCurrency(battleCashRecovered)}</b></span>
              <span><small>確定支出</small><b>{formatCurrency(brokerageFee + resultSettlementCost)}</b></span>
              <span><small>{isHighEndRaid ? '記録戦中の一時離脱' : '資金源離脱'}</small><b>{rebelled.length}社</b></span>
            </div>
            {winner === 'player' && <p className="overkill-rating">{getOverkillRating(overkill)}</p>}
            {rebelled.length > 0 && (
              <p className="rebel-summary">
                <ShieldAlert />
                {isHighEndRaid
                  ? `一時離脱（通常傘下は保護）：${rebelled.map((item) => item.name).join('・')}`
                  : `独立：${rebelled.map((item) => item.name).join('・')}`}
              </p>
            )}
            {winner === 'player' && nextCommunity && <p className="next-community"><CheckCircle2 />次の都市「{nextCommunity}」への交易路が開きます。</p>}
            <button type="button" className="dialog-close result-confirm" onClick={confirmResult}>
              {winner === 'player'
                ? isHighEndRaid
                  ? '攻略結果を確定する'
                  : '買収結果を確定する'
                : '敗因を記録して戻る'}
            </button>
          </article>
        </div>
      )}
    </div>
  );
};

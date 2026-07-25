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
import { FANKIT_ART, getFankitJobArt } from '../data/fankitAssets';
import { WindCondition } from './WindIndicator';
import {
  decideEnemyAction,
  ENEMY_INTENT_LABELS,
  PlayerBattleAction,
} from '../utils/enemyAi';
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

interface BattleModalProps {
  targetProperty: Property;
  companyName: string;
  totalFunds: number;
  ownedProperties: Property[];
  equippedSkills: TacticalSkill[];
  alliance: AllianceState;
  activeSynergies: GroupSynergy[];
  industryInfluence: { owned: number; total: number; label: string; playerBonus: number; enemyBudgetDiscount: number };
  regionalInfluence: { owned: number; total: number; label: string; playerBonus: number; enemyBudgetDiscount: number };
  tradeNetworkBonus: number;
  currentWind: WindCondition;
  windCountdown: number;
  nextCommunity?: string | null;
  isTutorial?: boolean;
  onAddFunds?: (amount: number) => void;
  onResetFunds?: () => void;
  onTimeScaleChange?: (scale: number) => void;
  onBattleEnd: (result: BattleResult) => void;
  onClose: () => void;
}

type Panel = 'capital' | 'funds' | 'tactics';
type BattleMotion = 'idle' | 'player' | 'enemy' | 'rebel';
type LogCategory = 'system' | 'player' | 'enemy' | 'funds' | 'skill' | 'result';
type BattleAnnouncement = 'start' | 'limit' | 'final';
type LimitBreakTier = 0 | 1 | 2 | 3;

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

export const LIMIT_BREAK_MULTIPLIERS = {
  1: 1,
  2: 1.15,
  3: 1.3,
} as const;

export const ENEMY_BALANCE_FACTOR = {
  tutorial: 1,
  normal: 1.2,
  cartelHQ: 1.3,
} as const;

const FINISH_LABELS: Record<FinishMethod, string> = {
  LIMIT_BREAK_1: 'LIMIT BREAK I',
  LIMIT_BREAK_2: 'LIMIT BREAK II',
  LIMIT_BREAK_3: 'LIMIT BREAK III',
  FINAL_PUSH: 'FINAL PUSH',
  CAPITAL_PRESSURE: 'CAPITAL PRESSURE',
  NORMAL: 'NORMAL BUYOUT',
};

const getLimitBreakTier = (companyCount: number): LimitBreakTier => {
  if (companyCount >= 16) return 3;
  if (companyCount >= 8) return 2;
  if (companyCount >= 4) return 1;
  return 0;
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

const GROUP_NAMES: Record<string, string> = {
  GRIDANIA_FOREST_ECONOMY: '黒衣森素材流通網',
  EORZEA_FOOD_ROUTE: 'エオルゼア食料交易網',
  ULDAH_LUXURY_MARKET: 'ウルダハ宝飾金融網',
  ISHGARD_DEFENSE_INDUSTRY: 'イシュガルド防衛産業',
  KUGANE_TRADE_GATEWAY: '東方交易中継網',
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
  industryInfluence,
  regionalInfluence,
  tradeNetworkBonus,
  currentWind,
  windCountdown,
  nextCommunity = null,
  isTutorial = false,
  onTimeScaleChange,
  onBattleEnd,
  onClose,
}) => {
  const brokerageFee = Math.round(targetProperty.marketPrice * 0.03);
  const influenceBonus = industryInfluence.playerBonus + regionalInfluence.playerBonus + tradeNetworkBonus;
  const enemyBudget = useMemo(() => {
    const price = targetProperty.marketPrice;
    const rankFactor = price >= 20_000_000 ? 1.05 : price >= 1_000_000 ? 0.82 : price >= 200_000 ? 0.68 : 0.54;
    const defenseDiscount = Math.min(0.3, industryInfluence.enemyBudgetDiscount + regionalInfluence.enemyBudgetDiscount);
    const baseBudget = price * (rankFactor + (targetProperty.isCartelHQ ? 0.3 : 0)) * (1 - defenseDiscount);
    const balanceFactor = isTutorial
      ? ENEMY_BALANCE_FACTOR.tutorial
      : targetProperty.isCartelHQ
        ? ENEMY_BALANCE_FACTOR.cartelHQ
        : ENEMY_BALANCE_FACTOR.normal;
    return Math.round(baseBudget * balanceFactor);
  }, [industryInfluence.enemyBudgetDiscount, isTutorial, regionalInfluence.enemyBudgetDiscount, targetProperty]);

  const initialEnemyCommitment = Math.round(enemyBudget * 0.5);
  const [battlePhase, setBattlePhase] = useState<BattlePhase>('briefing');
  const [gauge, setGauge] = useState(0);
  const [gaugeSpeed, setGaugeSpeed] = useState(0);
  const [companyInvested, setCompanyInvested] = useState(0);
  const [demandInvested, setDemandInvested] = useState(0);
  const [enemyInvested, setEnemyInvested] = useState(initialEnemyCommitment);
  const [enemyReserve, setEnemyReserve] = useState(enemyBudget - initialEnemyCommitment);
  const enemyReserveRef = useRef(enemyBudget - initialEnemyCommitment);
  const [cash, setCash] = useState(Math.max(0, totalFunds - brokerageFee));
  const [battleSubs, setBattleSubs] = useState<Property[]>(ownedProperties);
  const [subContributions, setSubContributions] = useState<Record<string, number>>({});
  const [subRequestCounts, setSubRequestCounts] = useState<Record<string, number>>({});
  const [rebelled, setRebelled] = useState<Property[]>([]);
  const [allianceUsed, setAllianceUsed] = useState(false);
  const [limitBreakUsed, setLimitBreakUsed] = useState(false);
  const [panel, setPanel] = useState<Panel>('capital');
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [commandProgress, setCommandProgress] = useState(100);
  const [fastHorseRemaining, setFastHorseRemaining] = useState(0);
  const [enemySlowedRemaining, setEnemySlowedRemaining] = useState(0);
  const [enemyDisruptionRemaining, setEnemyDisruptionRemaining] = useState(0);
  const [pushMultiplierRemaining, setPushMultiplierRemaining] = useState(0);
  const [skillCooldowns, setSkillCooldowns] = useState<Record<string, number>>({});
  const [motion, setMotion] = useState<BattleMotion>('idle');
  const [statusText, setStatusText] = useState('効果を確認して交渉を開始してください');
  const [aiText, setAiText] = useState('敵大規模防衛出資を準備中');
  const [aiProgress, setAiProgress] = useState(0);
  const [winner, setWinner] = useState<'player' | 'opponent' | null>(null);
  const [finishMethod, setFinishMethod] = useState<FinishMethod>('NORMAL');
  const [finalOwnership, setFinalOwnership] = useState(50);
  const [overkill, setOverkill] = useState(0);
  const [battleAnnouncement, setBattleAnnouncement] = useState<BattleAnnouncement | null>(null);
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

  const groups = useMemo(() => {
    const grouped = new Map<string, Property[]>();
    battleSubs.forEach((property) => {
      property.groupKeys.forEach((key) => {
        const list = grouped.get(key) || [];
        list.push(property);
        grouped.set(key, list);
      });
    });
    return Array.from(grouped.entries())
      .filter(([, members]) => members.length >= 2)
      .map(([key, members]) => ({ key, name: GROUP_NAMES[key] || key, members }));
  }, [battleSubs]);

  const totalPlayerInvested = companyInvested + demandInvested;
  const ownership = Math.max(0, Math.min(100, (100 - gauge) / 2));
  const commandReady = commandProgress >= 100;
  const selectedCost = getInvestmentCost(targetProperty.marketPrice, selectedLevel);
  const maxAffordableConfig = [...INVESTMENT_LEVELS].reverse()
    .find((item) => getInvestmentCost(targetProperty.marketPrice, item.level) <= cash);
  const capitalGap = totalPlayerInvested - enemyInvested;
  const effectivePlayerInvested = totalPlayerInvested * currentWind.playerMultiplier;
  const effectiveEnemyInvested = enemyInvested * currentWind.enemyMultiplier;
  const effectiveCapitalGap = effectivePlayerInvested - effectiveEnemyInvested;
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
  const windSide = currentWind.type === 'TAILWIND_PLAYER' ? 'player'
    : currentWind.type === 'TAILWIND_ENEMY' || currentWind.type === 'HEADWIND_PLAYER' ? 'enemy'
      : currentWind.type === 'CROSSWIND' ? 'cross' : 'calm';
  const windTitle = windSide === 'player' ? '自社資金効果上昇'
    : windSide === 'enemy' ? '敵大規模防衛出資'
      : windSide === 'cross' ? '乱旋風' : '静穏';
  const windDetail = windSide === 'player' ? `BURST ×${currentWind.playerMultiplier.toFixed(2)}`
    : windSide === 'enemy' ? `ONSLAUGHT ×${currentWind.enemyMultiplier.toFixed(2)}`
      : currentWind.directionLabel;
  const fastHorse = fastHorseRemaining > 0;
  const enemySlowed = enemySlowedRemaining > 0;
  const enemyDisruption = enemyDisruptionRemaining > 0 ? 0.7 : 0;
  const pushMultiplier = pushMultiplierRemaining > 0 ? 2 : 1;
  const limitBreakTier = getLimitBreakTier(battleSubs.length + 1);
  const limitBreakMultiplier = limitBreakTier > 0 ? LIMIT_BREAK_MULTIPLIERS[limitBreakTier] : 0;
  const limitBreakSelfSlot = Math.round(targetProperty.marketPrice * 0.24);
  const limitBreakSubsEstimate = battleSubs.reduce(
    (total, property) => total + Math.round(property.marketPrice * 0.24),
    0
  );
  const alliedMobilizationEstimate = Math.round((limitBreakSelfSlot + limitBreakSubsEstimate) * limitBreakMultiplier);
  const allianceSupport = alliance.active && !allianceUsed ? Math.round(targetProperty.marketPrice * 0.32) : 0;
  const isPaused = battlePhase !== 'active' || showHelp || showLog;
  const timeScale = isPaused ? 0 : panel === 'capital' ? 1 : 0.1;
  const enemyOwnershipForAi = Math.round((100 - ownership) / 5) * 5;
  const enemyDecision = useMemo(() => decideEnemyAction({
    enemyOwnership: enemyOwnershipForAi,
    enemyReservePercent,
    windType: currentWind.type,
    windRemainingSeconds: windCountdown,
    lastPlayerAction,
    capitalGap,
    marketPrice: targetProperty.marketPrice,
    isCartelHQ: !!targetProperty.isCartelHQ,
    isTutorial,
    slowed: enemySlowed,
    cycle: aiCycle,
  }), [
    aiCycle, capitalGap, currentWind.type, enemyOwnershipForAi, enemyReservePercent, enemySlowed,
    isTutorial, lastPlayerAction, targetProperty.isCartelHQ,
    targetProperty.marketPrice, windCountdown,
  ]);
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

  const announceBattle = (announcement: BattleAnnouncement, duration = 2000) => {
    if (announcementTimerRef.current) window.clearTimeout(announcementTimerRef.current);
    setBattleAnnouncement(announcement);
    announcementTimerRef.current = window.setTimeout(() => setBattleAnnouncement(null), duration);
  };

  const startBattle = () => {
    setBattlePhase('active');
    setStatusText('競り値が拮抗。命令を選んでギルを積んでください');
    setLogs((current) => [
      { id: `open-${Date.now()}`, category: 'system', text: `${companyName}対${targetProperty.name}、買収交渉開始。競合は${formatCurrency(initialEnemyCommitment)}を先に積みました。` },
      ...current,
    ]);
    soundFx.playSkillSpark();
    announceBattle('start', 1800);
  };

  useEffect(() => {
    if (battlePhase !== 'active' || currentWind.type === 'CALM') return;
    const text = windSide === 'player'
      ? `自社資金効果上昇――BURST ${currentWind.playerMultiplier.toFixed(2)}倍`
      : windSide === 'enemy'
        ? `敵大規模防衛出資――ONSLAUGHT ${currentWind.enemyMultiplier.toFixed(2)}倍`
        : `乱旋風――所有率速度${currentWind.speedMultiplier.toFixed(2)}倍`;
    setStatusText(text);
    setLogs((current) => [{ id: `wind-${Date.now()}`, category: 'system' as LogCategory, text }, ...current].slice(0, 100));
    soundFx.playSkillSpark();
  }, [battlePhase, currentWind.enemyMultiplier, currentWind.playerMultiplier, currentWind.speedMultiplier, currentWind.type, windSide]);

  const consumeCommand = () => {
    if (!commandReady || endedRef.current || battlePhase !== 'active') {
      soundFx.playWarning();
      return false;
    }
    setCommandProgress(0);
    return true;
  };

  const finishBattle = (
    result: 'player' | 'opponent',
    method: FinishMethod = 'NORMAL',
    rawOwnership = ownership
  ) => {
    if (endedRef.current) return;
    endedRef.current = true;
    const resolvedOwnership = Math.max(0, rawOwnership);
    const resolvedOverkill = result === 'player' ? Math.max(0, resolvedOwnership - 100) : 0;
    setWinner(result);
    setFinishMethod(method);
    setFinalOwnership(resolvedOwnership);
    setOverkill(resolvedOverkill);
    setGauge(result === 'player' ? -100 : 100);
    setGaugeSpeed(0);
    setBattlePhase('finisher_notice');
    setFinishTelegraphVisible(true);
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    finishTimerRef.current = window.setTimeout(() => setFinishTelegraphVisible(false), 1450);
    setStatusText(result === 'player' ? '所有率100%――買収成立！' : '所有率0%――買収失敗');
    addLog(result === 'player'
      ? `${companyName}が${targetProperty.name}を${FINISH_LABELS[method]}で押し切りました。`
      : `${companyName}は競合に所有率を押し切られました。`, 'result');
    if (result === 'player') {
      soundFx.playVictory();
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.48 } });
    } else {
      soundFx.playDefeat();
    }
  };

  const showShortNotice = () => {
    if (shortShownRef.current || endedRef.current) return;
    shortShownRef.current = true;
    setGaugeSpeed(0);
    setStatusText('SHORT――敵の防衛資金が枯渇。最後の一手で決着をつけてください');
    setBattlePhase('short_notice');
    addLog('SHORT！ 競合の追加防衛資金が枯渇。', 'result');
    soundFx.playWarning();
    if (shortTimerRef.current) window.clearTimeout(shortTimerRef.current);
    shortTimerRef.current = window.setTimeout(() => {
      if (endedRef.current) return;
      setBattlePhase('active');
      setStatusText('敵は追加防衛不能。自社資金のFINAL PUSHか継続圧力で決着できます');
    }, 1200);
  };

  const commitEnemyFunds = (requested: number, reason: string) => {
    const actual = Math.max(0, Math.min(Math.round(requested), enemyReserveRef.current));
    if (actual <= 0) {
      setAiText('SHORT / 追加防衛不能');
      showShortNotice();
      return;
    }
    if (enemyDisruption > 0 && Math.random() < enemyDisruption) {
      const collapse = Math.min(enemyInvested, Math.round(targetProperty.marketPrice * 0.12));
      setEnemyInvested((value) => Math.max(0, value - collapse));
      setStatusText(`物件独立工作が成功。敵の資金源から${formatCurrency(collapse)}が離脱`);
      showFloater(`離脱 -${formatCurrency(collapse)}`, 'enemy');
      playMotion('rebel');
      addLog(`物件独立工作により競合資金${formatCurrency(collapse)}が崩落。`, 'skill');
      return;
    }
    const nextReserve = enemyReserveRef.current - actual;
    enemyReserveRef.current = nextReserve;
    setEnemyReserve(nextReserve);
    setEnemyInvested((value) => value + actual);
    const counterShock = Math.min(7, 1.5 + (actual / Math.max(targetProperty.marketPrice, 1)) * 18);
    setGauge((value) => Math.min(99, value + counterShock));
    setStatusText(`敵大規模防衛出資――${formatCurrency(actual)}を対抗投入`);
    setAiText(nextReserve > 0 ? '次の敵大規模防衛出資を詠唱中' : 'SHORT / 追加防衛不能');
    showFloater(`+${formatCurrency(actual)}`, 'enemy');
    playMotion('enemy');
    soundFx.playCapitalImpact('opponent', actual / Math.max(targetProperty.marketPrice, 1));
    addLog(`${reason}として${formatCurrency(actual)}を投入。残予算${formatCurrency(nextReserve)}。`, 'enemy');
    if (nextReserve <= 0) window.setTimeout(showShortNotice, 420);
  };

  useEffect(() => {
    if (timeScale <= 0 || winner) return;
    const interval = window.setInterval(() => {
      const elapsed = 50 * timeScale;
      setCommandProgress((value) => Math.min(100, value + (fastHorse ? 5 : 2.8) * timeScale));
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
    }, 50);
    return () => window.clearInterval(interval);
  }, [fastHorse, timeScale, winner]);

  useEffect(() => {
    if (timeScale <= 0 || winner || enemyReserveRef.current <= 0) return;
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
      const velocity = baseVelocity * 8.5 * leverage * deadZone * currentWind.speedMultiplier;
      setGaugeSpeed(velocity);
      setGauge((value) => {
        const next = value + velocity * dt;
        if (next <= -100) {
          const method: FinishMethod = enemyReserveRef.current <= 0 ? 'CAPITAL_PRESSURE' : 'NORMAL';
          finishBattle('player', method, (100 - next) / 2);
          return -100;
        }
        if (next >= 100) {
          finishBattle('opponent', 'NORMAL', 0);
          return 100;
        }
        return next;
      });
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [currentWind.enemyMultiplier, currentWind.playerMultiplier, currentWind.speedMultiplier, effectiveCapitalGap, enemyInvested, influenceBonus, pushMultiplier, targetProperty.marketPrice, timeScale, totalPlayerInvested, winner]);

  const investCompanyFunds = () => {
    if (!consumeCommand()) return;
    if (cash < selectedCost) {
      setCommandProgress(100);
      soundFx.playWarning();
      setStatusText(`自社資金不足。必要額は${formatCurrency(selectedCost)}`);
      return;
    }
    const impact = Math.min(10, 1.2 + (selectedCost / Math.max(targetProperty.marketPrice, 1)) * 20);
    const rawGaugeAfter = gauge - impact;
    setCash((value) => value - selectedCost);
    setCompanyInvested((value) => value + selectedCost);
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
    setLastPlayerAction('FUNDS');
    const nextRisk = Math.min(100, property.loyaltyRisk + 18);
    const amount = Math.round(property.marketPrice * 0.45);
    const rejects = Math.random() < calculateRebellionProbability(nextRisk);
    setSubRequestCounts((current) => ({ ...current, [property.id]: (current[property.id] || 0) + 1 }));

    if (rejects) {
      const lost = subContributions[property.id] || 0;
      setBattleSubs((current) => current.filter((item) => item.id !== property.id));
      setDemandInvested((value) => Math.max(0, value - lost));
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
    const impact = Math.min(4.5, 1 + (amount / Math.max(targetProperty.marketPrice, 1)) * 8);
    setGauge((value) => Math.max(-99, value - impact));
    setStatusText(`${property.name}から${formatCurrency(amount)}を調達。独立危険度${nextRisk}%`);
    showFloater(`+${formatCurrency(amount)}`, 'player');
    playMotion('player');
    soundFx.playBigCash();
    addLog(`${property.name}へ第${(subRequestCounts[property.id] || 0) + 1}次資金要求。${formatCurrency(amount)}を調達、独立危険度${nextRisk}%。`, 'funds');
  };

  const demandFromAllies = () => {
    if (limitBreakTier === 0 || limitBreakUsed || !consumeCommand()) return;
    setLastPlayerAction('LIMIT_BREAK');
    setLimitBreakUsed(true);
    setBattlePhase('limit_charge');
    setGaugeSpeed(0);
    announceBattle('limit', 2300);
    soundFx.playFinalPush();

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

    const baseAmount = limitBreakSelfSlot + survivors.reduce(
      (total, member) => total + Math.round(member.marketPrice * 0.24),
      0
    );
    const amount = Math.round(baseAmount * limitBreakMultiplier);
    setStatusText(`LIMIT BREAK ${limitBreakTier}――${survivors.length + 1}社の出資を集約中`);
    addLog(`LIMIT BREAK ${limitBreakTier}発動。自社と傘下${battleSubs.length}社が全社出資へ参加。`, 'skill');

    limitBreakTimerRef.current = window.setTimeout(() => {
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
          const support = Math.round(member.marketPrice * 0.24 * limitBreakMultiplier);
          next[member.id] = (next[member.id] || 0) + support;
        });
        leaving.forEach((member) => delete next[member.id]);
        return next;
      });
      if (leaving.length) setRebelled((current) => [...current, ...leaving]);
      setDemandInvested((value) => Math.max(0, value - lost) + amount);
      const ownershipPush = (amount / Math.max(targetProperty.marketPrice, 1)) * 70;
      const rawOwnershipAfter = ownership + ownershipPush;
      const rawGaugeAfter = 100 - rawOwnershipAfter * 2;
      setGauge(Math.max(-100, Math.min(100, rawGaugeAfter)));
      showFloater(`LIMIT BREAK +${formatCurrency(amount)}`, 'player');
      playMotion(leaving.length ? 'rebel' : 'player');

      if (leaving.length) {
        setStatusText(`DEFECT！ ${leaving.map((member) => member.name).join('・')}が支援を撤回。残存投入${formatCurrency(amount)}`);
        addLog(`DEFECT！ ${leaving.map((member) => member.name).join('・')}が離反し、過去支援${formatCurrency(lost)}が崩落。`, 'funds');
      } else {
        setStatusText(`LIMIT BREAK ${limitBreakTier}！ ${formatCurrency(amount)}を一斉投入`);
      }

      if (rawOwnershipAfter >= 100) {
        finishBattle('player', `LIMIT_BREAK_${limitBreakTier}` as FinishMethod, rawOwnershipAfter);
        return;
      }
      setBattlePhase('active');
      setBattleAnnouncement(null);
      // A large LB forces an immediate emergency defense, so it can exhaust the remaining reserve.
      const emergencyDefense = Math.min(enemyReserveRef.current, Math.round(amount * 0.35));
      if (emergencyDefense > 0) {
        commitEnemyFunds(emergencyDefense, 'LIMIT BREAKへの緊急防衛');
      }
      setLastPlayerAction(null);
      setAiProgress(0);
      setAiCycle((cycle) => cycle + 1);
      if (enemyReserveRef.current <= 0) showShortNotice();
    }, 1850);
  };

  const demandFromGroup = (key: string, name: string, members: Property[]) => {
    if (!consumeCommand()) return;
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
    amount = Math.round(amount * 1.28);

    setBattleSubs((current) => current
      .filter((item) => !leaving.some((leaver) => leaver.id === item.id))
      .map((item) => survivors.find((survivor) => survivor.id === item.id) || item));
    if (leaving.length) setRebelled((current) => [...current, ...leaving]);
    setDemandInvested((value) => Math.max(0, value - lost) + amount);
    setSubContributions((current) => {
      const next = { ...current };
      survivors.forEach((member) => {
        next[member.id] = (next[member.id] || 0) + Math.round((member.marketPrice * 0.34 * 1.28));
      });
      leaving.forEach((member) => delete next[member.id]);
      return next;
    });
    const groupImpact = Math.min(9, 2 + (amount / Math.max(targetProperty.marketPrice, 1)) * 7);
    setGauge((value) => Math.max(-99, value - groupImpact));
    showFloater(`連携 +${formatCurrency(amount)}`, 'player');
    playMotion(leaving.length ? 'rebel' : 'player');
    soundFx.playBigCash();
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
    setLastPlayerAction('ALLIANCE');
    const amount = Math.round(targetProperty.marketPrice * 0.32);
    setDemandInvested((value) => value + amount);
    setAllianceUsed(true);
    setStatusText(`${alliance.allyName}から${formatCurrency(amount)}の援軍`);
    showFloater(`同盟 +${formatCurrency(amount)}`, 'player');
    playMotion('player');
    soundFx.playBigCash();
    addLog(`${alliance.allyName}へ同盟資金を要請。${formatCurrency(amount)}を調達。`, 'funds');
  };

  const useSkill = (skill: TacticalSkill) => {
    if ((skillCooldowns[skill.id] || 0) > 0 || !consumeCommand()) return;
    setSkillCooldowns((current) => ({ ...current, [skill.id]: skill.cooldownMs }));
    showFloater(skill.name, 'center');
    playMotion('player');
    soundFx.playSkillSpark();

    if (skill.effectType === 'COOLDOWN_REDUCTION') {
      setFastHorseRemaining(10_000);
      setStatusText('早馬発動――10秒間、タタルの命令待ち時間が半減');
    } else if (skill.effectType === 'NEMAWASHI') {
      setBattleSubs((current) => current.map((item) => ({ ...item, loyaltyRisk: Math.floor(item.loyaltyRisk / 2) })));
      setStatusText('ネマワシ成功――全傘下の独立危険度が半減');
    } else if (skill.effectType === 'INDEPENDENCE_SABOTAGE') {
      setEnemyDisruptionRemaining(9000);
      setStatusText('物件独立工作――9秒間、敵の資金源離脱を狙う');
    } else if (skill.effectType === 'DEMORALIZE') {
      setEnemySlowedRemaining(9000);
      setStatusText('競合の指揮系統が混乱。敵の命令待ち時間が延長');
    } else if (skill.effectType === 'CAPITAL_BOOST') {
      const amount = Math.round(targetProperty.marketPrice * 0.3);
      setDemandInvested((value) => value + amount);
      setStatusText(`商魂の即時調達で${formatCurrency(amount)}を追加`);
      showFloater(`+${formatCurrency(amount)}`, 'player');
    } else if (skill.effectType === 'SNS_BLITZ') {
      const amount = Math.min(enemyInvested, Math.round(targetProperty.marketPrice * 0.15));
      setEnemyInvested((value) => Math.max(0, value - amount));
      setStatusText(`評判工作で敵資金${formatCurrency(amount)}が離脱`);
    } else if (skill.effectType === 'SYNERGY_PUSH') {
      setPushMultiplierRemaining(7000);
      setStatusText('交易網総動員――7秒間、所有率の押し込み速度が倍増');
    }
    addLog(`${skill.name}を使用。${skill.description}`, 'skill');
  };

  const confirmResult = () => {
    const settlementCost = Math.round(companyInvested * (winner === 'player' ? 0.35 : 0.75));
    onBattleEnd({
      winner: winner || 'opponent',
      targetProperty,
      companyFundsInvested: companyInvested,
      demandFundsInvested: demandInvested,
      brokerageFee,
      settlementCost,
      battleCashDelta: 0,
      victoryReward: winner === 'player' ? Math.round(targetProperty.marketPrice * 0.05) : 0,
      rebelledProperties: rebelled,
      finishMethod,
      finalOwnership,
      overkill,
    });
  };

  const resultAnalysis = winner === 'player'
    ? finishMethod.startsWith('LIMIT_BREAK')
      ? `勝因は企業網の総動員でっす。LIMIT BREAKで${formatCurrency(demandInvested)}を集め、所有率を一気に押し切ったでっす。`
      : demandInvested > companyInvested
        ? `勝因はSYNERGYでっす。傘下から集めた${formatCurrency(demandInvested)}が競り値を押し上げたでっす。`
        : `勝因は自社資金の決断でっす。SHORT後までギルを残し、${FINISH_LABELS[finishMethod]}で決着したでっす。`
    : rebelled.length > 0
      ? `${rebelled.length}社の独立で資金の山が崩れたでっす。次は赤い資金源へ要求する前にネマワシを使うでっす。`
      : `競合の競り値を${formatCurrency(Math.max(0, -capitalGap))}下回り、所有率を押し戻されたでっす。`;

  const briefingSynergies = [
    ...(industryInfluence.playerBonus > 0 || industryInfluence.enemyBudgetDiscount > 0
      ? [`${targetProperty.industry} ${industryInfluence.label}：自社押込 +${Math.round(industryInfluence.playerBonus * 100)}% / 敵予算 -${Math.round(industryInfluence.enemyBudgetDiscount * 100)}%`]
      : []),
    ...(regionalInfluence.playerBonus > 0 || regionalInfluence.enemyBudgetDiscount > 0
      ? [`${targetProperty.community} ${regionalInfluence.label}：自社押込 +${Math.round(regionalInfluence.playerBonus * 100)}% / 敵予算 -${Math.round(regionalInfluence.enemyBudgetDiscount * 100)}%`]
      : []),
    ...activeSynergies.map((synergy) => `${synergy.name}：毎秒収益 ×${synergy.bonusYieldMultiplier.toFixed(2)}`),
    ...groups.map((group) => `${group.name}：${group.members.length}社のグループ資金要求を使用可能`),
    ...(tradeNetworkBonus > 0 ? [`都市交易網：自社押込 +${Math.round(tradeNetworkBonus * 100)}%`] : []),
  ];

  return (
    <div
      className={`buyout-screen buyout-screen--phase-${battlePhase}`}
      style={{ '--battle-time-scale': timeScale } as React.CSSProperties}
    >
      <img className="buyout-backdrop" src={FANKIT_ART.battleBackdrop} alt="" aria-hidden="true" />

      {battleAnnouncement && (
        <div className={`battle-announcement battle-announcement--${battleAnnouncement}`} aria-live="assertive">
          <div>
            <small>{battleAnnouncement === 'start' ? 'CONTENT COMMENCED' : battleAnnouncement === 'limit' ? `LIMIT BREAK ${limitBreakTier}` : 'FINAL PUSH'}</small>
            <strong>{battleAnnouncement === 'start' ? '買収戦開始' : battleAnnouncement === 'limit' ? '全社資金・総動員' : '最終買収攻勢'}</strong>
            <span>{battleAnnouncement === 'start' ? `${companyName} VS ${targetProperty.name}` : battleAnnouncement === 'limit' ? `${battleSubs.length + 1}社のギルを解放` : '最後の一手で買収成立へ'}</span>
          </div>
        </div>
      )}

      <header className="buyout-header">
        <div>
          <span>ACTIVE BUYOUT</span>
          <strong title={targetProperty.name}>{targetProperty.name}</strong>
          <small>{targetProperty.community}・{targetProperty.industry}</small>
        </div>
        <div className="buyout-header__actions">
          <button type="button" onClick={() => setShowHelp(true)} aria-label="買収劇の遊び方"><CircleHelp /></button>
          <button type="button" onClick={onClose} aria-label="買収劇を閉じる"><X /></button>
        </div>
      </header>

      <main className="buyout-main">
        <section className="ownership-board">
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
              <div className={`battle-wind-sigil battle-wind-sigil--${windSide}`}>
                <Sparkles /><b>{windTitle}</b><span>{windDetail}</span><small>{windCountdown}s</small>
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

        <section className="capital-arena">
          <div className="capital-arena__side">
            <span>{companyName}</span>
            <div className="player-capital-stack">
              <GilTower amount={totalPlayerInvested} marketPrice={targetProperty.marketPrice} side="player" motion={motion} />
              <div className={`player-budget-overlay player-budget-overlay--${playerReserveState}`}>
                <small>自社残り資金</small>
                <strong>{playerReservePercent.toFixed(1)}%</strong>
                <span>{playerReservePercent <= 0 ? 'EMPTY / 投入不能' : playerReservePercent <= 10 ? '枯渇寸前' : '投入可能'}</span>
              </div>
            </div>
            <small>自社 {formatCurrency(companyInvested)} / 支援 {formatCurrency(demandInvested)}</small>
            <div className="capital-source-bar"><i style={{ width: `${totalPlayerInvested > 0 ? companyInvested / totalPlayerInvested * 100 : 0}%` }} /><span /></div>
          </div>
          <div className="capital-arena__center">
            <div className={`capital-clash capital-clash--${battleDirection}`}><i /><i /><i /></div>
            <b className="capital-vs">VS</b>
            <strong>{effectiveCapitalGap >= 0 ? '自社優勢' : '競合優勢'}</strong>
            {enemyReserve <= 0 && <em>SHORT</em>}
          </div>
          <div className="capital-arena__side">
            <span>{targetProperty.name}</span>
            <div className="enemy-capital-stack">
              <GilTower amount={enemyInvested} marketPrice={targetProperty.marketPrice} side="enemy" motion={motion} />
              <div className={`enemy-budget-overlay enemy-budget-overlay--${enemyReserveState}`}>
                <small>追加防衛資金</small>
                <strong>{enemyReservePercent.toFixed(1)}%</strong>
                <span>{enemyReserve <= 0 ? 'SHORT / 追加投入不能' : enemyReservePercent <= 10 ? '枯渇寸前' : '追加投入余力'}</span>
              </div>
            </div>
            <small>残り防衛予算 {formatCurrency(enemyReserve)}</small>
            <div className="enemy-reserve-bar"><i style={{ width: `${enemyReservePercent}%` }} /></div>
          </div>
          {floaters.map((item) => <i key={item.id} className={`gil-floater gil-floater--${item.side}`}>{item.text}</i>)}
        </section>

        <section className="active-time">
          <div>
            <TimerReset />
            <span>{commandReady ? 'COMMAND READY' : fastHorse ? '早馬で命令伝達中' : '次の命令を伝達中'}</span>
            {timeScale === 0.1 && <em>TACTICAL MODE ×0.1</em>}
          </div>
          <div className="active-time__bar"><i style={{ width: `${commandProgress}%` }} /></div>
          <div className={`active-time__enemy ${aiProgress >= 72 ? 'active-time__enemy--danger' : ''}`}>
            <span>{enemyReserve <= 0 ? 'SHORT / 追加防衛不能' : aiText}</span>
            <i style={{ width: `${aiProgress}%` }} />
          </div>
        </section>

        <section className="command-deck">
          <nav>
            <button type="button" className={panel === 'capital' ? 'active' : ''} onClick={() => setPanel('capital')}><Coins />自社資金</button>
            <button type="button" className={panel === 'funds' ? 'active' : ''} onClick={() => setPanel('funds')}><Building2 />資金源</button>
            <button type="button" className={panel === 'tactics' ? 'active' : ''} onClick={() => setPanel('tactics')}><Zap />かけひき</button>
          </nav>

          {panel === 'capital' && (
            <div className="command-panel command-panel--capital">
              <div className="investment-levels">
                {INVESTMENT_LEVELS.map((item) => {
                  const cost = getInvestmentCost(targetProperty.marketPrice, item.level);
                  return (
                    <button type="button" key={item.level} className={selectedLevel === item.level ? 'selected' : ''} onClick={() => setSelectedLevel(item.level)} disabled={cost > cash}>
                      <small>{item.label}</small><b>{formatCurrency(cost)}</b>
                    </button>
                  );
                })}
              </div>
              <button type="button" className="command-primary" onClick={investCompanyFunds} disabled={!commandReady || !maxAffordableConfig || cash < selectedCost || !!winner || battlePhase !== 'active'}>
                <HandCoins /><span>{!maxAffordableConfig ? '自己資金不足' : commandReady ? `${formatCurrency(selectedCost)}を積む` : '命令待ち…'}</span>
              </button>
              <p className={maxAffordableConfig && maxAffordableConfig.level < 5 ? 'investment-auto-note' : ''}>
                可処分資金 {formatCurrency(cash)}　／　{maxAffordableConfig && maxAffordableConfig.level < 5 ? `残高連動：最大「${maxAffordableConfig.label}」へ自動調整` : '資金差だけが所有率を動かします'}
              </p>
            </div>
          )}

          {panel === 'funds' && (
            <div className="command-panel command-panel--funds">
              <button
                type="button"
                className="grand-allied-fund grand-allied-fund--limit"
                onClick={demandFromAllies}
                disabled={!commandReady || limitBreakTier === 0 || limitBreakUsed || !!winner || battlePhase !== 'active'}
              >
                <Zap />
                <span>
                  <b>{limitBreakTier > 0 ? `LIMIT BREAK ${limitBreakTier}` : 'LIMIT BREAK 未解放'}</b>
                  <small>{limitBreakUsed ? 'この交渉では使用済み' : limitBreakTier === 0 ? `あと${4 - (battleSubs.length + 1)}社で解放` : `自社＋傘下${battleSubs.length}社・一交渉一回・独立判定あり`}</small>
                </span>
                <strong>{limitBreakTier > 0 ? `約+${formatCurrency(alliedMobilizationEstimate)}` : '4社必要'}</strong>
              </button>

              {groups.length > 0 && (
                <div className="group-funds">
                  {groups.map((group) => (
                    <button type="button" key={group.key} onClick={() => demandFromGroup(group.key, group.name, group.members)} disabled={!commandReady || !!winner || battlePhase !== 'active'}>
                      <Sparkles /><span><b>SYNERGY：{group.name}</b><small>{group.members.length}社・グループ資金</small></span>
                    </button>
                  ))}
                </div>
              )}

              {alliance.active && (
                <button type="button" className="alliance-fund" onClick={requestAlliance} disabled={!commandReady || allianceUsed || !!winner || battlePhase !== 'active'}>
                  <Users /><span>ALLIANCE：{alliance.allyName}</span><b>{allianceUsed ? '要請済み' : `+${formatCurrency(allianceSupport)}`}</b>
                </button>
              )}

              <div className="property-funds">
                {battleSubs.map((property) => {
                  const risk = riskPresentation(property.loyaltyRisk);
                  return (
                    <button type="button" key={property.id} onClick={() => demandFromProperty(property)} disabled={!commandReady || !!winner || battlePhase !== 'active'}>
                      <span><b>{property.name}</b><small>要求 {subRequestCounts[property.id] || 0}回</small></span>
                      <em className={risk.className}>{risk.label} {property.loyaltyRisk}%</em>
                      <strong>+{formatCurrency(property.marketPrice * 0.45)}</strong>
                    </button>
                  );
                })}
              </div>
              {battleSubs.length === 0 && <p className="empty-funds">資金を要求できる傘下がありません。</p>}
            </div>
          )}

          {panel === 'tactics' && (
            <div className="command-panel command-panel--tactics">
              {equippedSkills.map((skill) => {
                const cooldown = skillCooldowns[skill.id] || 0;
                return (
                  <button type="button" key={skill.id} onClick={() => useSkill(skill)} disabled={!commandReady || cooldown > 0 || !!winner || battlePhase !== 'active'} title={skill.description}>
                    <Zap /><span><b>{skill.name}</b><small>{skill.description}</small></span><em>{cooldown > 0 ? `${(cooldown / 1000).toFixed(1)}秒` : 'READY'}</em>
                  </button>
                );
              })}
              {equippedSkills.length === 0 && <p className="empty-funds">装備中のかけひき技がありません。</p>}
            </div>
          )}
        </section>
      </main>

      <footer className={`buyout-footer ${winner ? 'buyout-footer--settled' : ''}`}>
        {winner ? (
          <>
            <span>{winner === 'player' ? `${FINISH_LABELS[finishMethod]} / 所有率 ${finalOwnership.toFixed(1)}%` : 'CAPITAL COLLAPSE / 買収失敗'}</span>
            <button type="button" className="battle-next-button" onClick={() => setBattlePhase('result')} disabled={finishTelegraphVisible}>
              {finishTelegraphVisible ? 'RESULT LOCKED' : 'NEXT →'}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setShowLog(true)}><ScrollText />戦局ログ</button>
            <span>{logs[0]?.text}</span>
            <button type="button" onClick={() => finishBattle('opponent', 'NORMAL', ownership)}>撤退</button>
          </>
        )}
      </footer>

      {battlePhase === 'briefing' && (
        <div className="buyout-overlay buyout-briefing-overlay">
          <article className="buyout-dialog buyout-briefing">
            <header><Swords /><strong>BUYOUT OPERATION</strong></header>
            <div className="briefing-versus">
              <b className="company-name-full" title={companyName}>{companyName}</b>
              <span>VS</span>
              <b className="company-name-full" title={targetProperty.name}>{targetProperty.name}</b>
            </div>
            <dl className="briefing-facts">
              <div><dt>対象都市・業界</dt><dd>{targetProperty.community}・{targetProperty.industry}</dd></div>
              <div><dt>現在相場</dt><dd>{formatCurrency(targetProperty.marketPrice)}</dd></div>
              <div><dt>仲介手数料</dt><dd>{formatCurrency(brokerageFee)}</dd></div>
            </dl>
            <section className="briefing-section">
              <h3><Sparkles />ACTIVE SYNERGY</h3>
              {briefingSynergies.length > 0
                ? <ul>{briefingSynergies.map((effect) => <li key={effect}>{effect}</li>)}</ul>
                : <p>今回発動するSYNERGYはありません。</p>}
            </section>
            <section className="briefing-section">
              <h3><Users />ACTIVE ALLIANCE</h3>
              <p>{alliance.active ? `${alliance.allyName}：一回限り +${formatCurrency(allianceSupport)}` : '今回利用できるALLIANCE支援はありません。'}</p>
            </section>
            <button type="button" className="dialog-close briefing-start" onClick={startBattle}>効果を確認して交渉開始</button>
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

      {battlePhase === 'finisher_notice' && winner && finishTelegraphVisible && (
        <div className={`battle-finish-telegraph battle-finish-telegraph--${winner}`} aria-live="assertive">
          <i />
          <small>{winner === 'player' ? 'BUYOUT OPERATION COMPLETE' : 'BUYOUT OPERATION FAILED'}</small>
          <strong>{winner === 'player' ? 'WIN!' : 'LOSE'}</strong>
          <span>{winner === 'player' ? FINISH_LABELS[finishMethod] : 'CAPITAL COLLAPSE'}</span>
          {winner === 'player' && overkill >= 0.5 && <em>OVERKILL +{overkill.toFixed(1)}%</em>}
          <i />
        </div>
      )}

      {showHelp && (
        <div className="buyout-overlay">
          <article className="buyout-dialog">
            <header><CircleHelp /><strong>買収劇の遊び方</strong><button type="button" onClick={() => setShowHelp(false)}><X /></button></header>
            <ol>
              <li><b>ギルを積む</b><span>自社・傘下・SYNERGYから資金を集めます。</span></li>
              <li><b>TACTICAL MODE</b><span>資金源・かけひき選択中は戦闘が0.1倍になります。</span></li>
              <li><b>風を読む</b><span>自社資金効果上昇は緑、敵大規模防衛出資は赤で表示します。</span></li>
              <li><b>LIMIT BREAK</b><span>自社を含む4社で解放。8社、16社で強化され、一交渉一回だけ使えます。</span></li>
              <li><b>ALLIANCE</b><span>外部同盟の一回支援です。LBの企業数や投入額には含みません。</span></li>
              <li><b>独立リスク</b><span>傘下へ繰り返し要求できますが、独立すると過去支援も崩れます。</span></li>
              <li><b>SHORT</b><span>敵の追加防衛資金が0になった戦況通知。約1.2秒後に自動再開し、FINAL PUSHか継続圧力で決着します。</span></li>
              <li><b>OVERKILL</b><span>所有率100%をどれだけ超えて押し切ったかを示す派手さの評価です。</span></li>
            </ol>
            <button type="button" className="dialog-close" onClick={() => setShowHelp(false)}>商談へ戻る</button>
          </article>
        </div>
      )}

      {showLog && (
        <div className="buyout-overlay">
          <article className="buyout-dialog buyout-log">
            <header><ScrollText /><strong>戦局ログ</strong><button type="button" onClick={() => setShowLog(false)}><X /></button></header>
            <div>{logs.map((entry) => <p key={entry.id} data-category={entry.category}>{entry.text}</p>)}</div>
            <button type="button" className="dialog-close" onClick={() => setShowLog(false)}>閉じる</button>
          </article>
        </div>
      )}

      {battlePhase === 'result' && winner && (
        <div className="buyout-overlay buyout-result-overlay">
          <article className={`buyout-dialog buyout-result buyout-result--${winner}`}>
            <header>
              {winner === 'player' ? <Trophy /> : <XCircle />}
              <strong>{winner === 'player' ? '買収成立' : '買収失敗'}</strong>
            </header>
            <h2>{targetProperty.name}</h2>
            <div className="tataru-analysis">
              <img src={FANKIT_ART.tataru.windUp} alt="タタル" />
              <p><b>タタルの{winner === 'player' ? '勝因' : '敗因'}分析</b><span>「{resultAnalysis}」</span></p>
            </div>
            <div className="result-numbers">
              <span><small>FINISH</small><b>{FINISH_LABELS[finishMethod]}</b></span>
              <span><small>最終所有率</small><b>{winner === 'player' ? `${finalOwnership.toFixed(1)}%` : `${ownership.toFixed(1)}%`}</b></span>
              <span><small>OVERKILL</small><b>{winner === 'player' ? `+${overkill.toFixed(1)}%` : '---'}</b></span>
              <span><small>自社競り値</small><b>{formatCurrency(totalPlayerInvested)}</b></span>
              <span><small>競合競り値</small><b>{formatCurrency(enemyInvested)}</b></span>
              <span><small>資金源離脱</small><b>{rebelled.length}社</b></span>
            </div>
            {winner === 'player' && <p className="overkill-rating">{getOverkillRating(overkill)}</p>}
            {rebelled.length > 0 && <p className="rebel-summary"><ShieldAlert />独立：{rebelled.map((item) => item.name).join('・')}</p>}
            {winner === 'player' && nextCommunity && <p className="next-community"><CheckCircle2 />次の都市「{nextCommunity}」への交易路が開きます。</p>}
            <button type="button" className="dialog-close result-confirm" onClick={confirmResult}>
              {winner === 'player' ? '買収結果を確定する' : '敗因を記録して戻る'}
            </button>
          </article>
        </div>
      )}
    </div>
  );
};

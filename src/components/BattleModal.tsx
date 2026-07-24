import React, { useState, useEffect, useRef } from 'react';
import { Property, TacticalSkill, AllianceState, MarketTrendType } from '../types';
import { WindIndicator, WIND_CONDITIONS, WindCondition, WindType } from './WindIndicator';
import {
  formatCurrency,
  calculateGaugeVelocity,
  calculateRebellionProbability,
} from '../utils/formatter';
import { soundFx } from '../utils/audio';
import confetti from 'canvas-confetti';
import {
  X,
  Swords,
  TrendingDown,
  TrendingUp,
  Zap,
  Users,
  CheckCircle2,
  XCircle,
  Coins,
  Sparkles,
  Flame,
  Building2,
  Crown,
  Activity,
  Eye,
  BarChart2,
  ShieldAlert,
  ScrollText,
  Trophy,
  CircleHelp,
} from 'lucide-react';
import { HELP_TEXT } from '../data/helpText';
import { FANKIT_ART, getFankitJobArt } from '../data/fankitAssets';

interface BattleModalProps {
  targetProperty: Property;
  totalFunds: number;
  ownedProperties: Property[];
  equippedSkills: TacticalSkill[];
  alliance: AllianceState;
  industryInfluence: { owned: number; total: number; label: string; playerBonus: number; enemyBudgetDiscount: number };
  regionalInfluence: { owned: number; total: number; label: string; playerBonus: number; enemyBudgetDiscount: number };
  tradeNetworkBonus: number;
  isTutorial?: boolean;
  onAddFunds?: (amount: number) => void;
  onResetFunds?: () => void;
  onBattleEnd: (result: {
    winner: 'player' | 'opponent';
    targetProperty: Property;
    companyFundsInvested: number;
    demandFundsInvested: number;
    brokerageFee: number;
    settlementCost: number;
    battleCashDelta: number;
    victoryReward: number;
    rebelledProperties: Property[];
  }) => void;
  onClose: () => void;
}

interface FloatingEffect {
  id: number;
  text: string;
  x: number;
  type: 'player' | 'opponent' | 'skill';
}

export interface LogEntry {
  id: string;
  timestamp: string;
  category: 'market' | 'enemy' | 'player' | 'skill' | 'subs' | 'result' | 'system';
  message: string;
}

export const INVESTMENT_LEVELS = [
  { level: 1, ratio: 0.01, label: '1%' },
  { level: 2, ratio: 0.025, label: '2.5%' },
  { level: 3, ratio: 0.05, label: '5%' },
  { level: 4, ratio: 0.08, label: '8%' },
  { level: 5, ratio: 0.12, label: '12%' },
  { level: 6, ratio: 0.18, label: '18%' },
  { level: 7, ratio: 0.25, label: '25%' },
  { level: 8, ratio: 0.35, label: '35%' },
  { level: 9, ratio: 0.48, label: '48%' },
  { level: 10, ratio: 0.60, label: '60%' },
];

export const getInvestmentCost = (marketPrice: number, level: number) => {
  const cfg = INVESTMENT_LEVELS.find((item) => item.level === level) || INVESTMENT_LEVELS[0];
  return Math.max(10, Math.round(marketPrice * cfg.ratio));
};

export const BattleModal: React.FC<BattleModalProps> = ({
  targetProperty,
  totalFunds,
  ownedProperties,
  equippedSkills,
  alliance,
  industryInfluence,
  regionalInfluence,
  tradeNetworkBonus,
  isTutorial = false,
  onBattleEnd,
  onClose,
}) => {
  const brokerageFee = Math.round(targetProperty.marketPrice * 0.03);

  // Battle State
  const [gauge, setGauge] = useState<number>(0); // G in [-100, 100]
  const [gaugeSpeed, setGaugeSpeed] = useState<number>(0); // dG/dt
  const [playerCompanyInvested, setPlayerCompanyInvested] = useState<number>(0);
  const [playerDemandInvested, setPlayerDemandInvested] = useState<number>(0);
  // 敵は交渉開始時に決まった防衛予算だけを使う。長期戦で無限に湧かない。
  const enemyBudget = React.useMemo(() => {
    const price = targetProperty.marketPrice;
    const rankFactor = price >= 20_000_000 ? 0.9 : price >= 1_000_000 ? 0.7 : price >= 200_000 ? 0.55 : 0.42;
    const defenseDiscount = Math.min(0.3, industryInfluence.enemyBudgetDiscount + regionalInfluence.enemyBudgetDiscount);
    return Math.round(price * (rankFactor + (targetProperty.isCartelHQ ? 0.2 : 0)) * (1 - defenseDiscount));
  }, [targetProperty, industryInfluence.enemyBudgetDiscount, regionalInfluence.enemyBudgetDiscount]);
  const initialEnemyCommitment = Math.round(enemyBudget * 0.38);
  const [opponentInvested, setOpponentInvested] = useState<number>(initialEnemyCommitment);
  const [opponentReserve, setOpponentReserve] = useState<number>(enemyBudget - initialEnemyCommitment);
  const [finishingPush, setFinishingPush] = useState<boolean>(false);
  const finishingPushRef = useRef(false);
  const enemyBudgetExhausted = opponentReserve <= 0;

  const [remainingPlayerCash, setRemainingPlayerCash] = useState<number>(
    totalFunds - brokerageFee
  );
  const [battleCashDelta, setBattleCashDelta] = useState(0);
  const [cashFlow, setCashFlow] = useState(0);
  const [marginCountdown, setMarginCountdown] = useState<number | null>(null);

  // Market sentiment moves the ownership line directly. There is no separate price chart.
  const [marketTrend, setMarketTrend] = useState<MarketTrendType>('STABLE');
  const [trendMultiplier, setTrendMultiplier] = useState<number>(1.0);
  const [ownershipEvent, setOwnershipEvent] = useState('小口売買で所有率が微動しています');
  const ownershipImpulseRef = useRef(0);
  const ownershipDriftRef = useRef(0);

  // Difficulty Level based on Property Rank / Market Price (1: Easy to 5: Boss)
  const aiDifficulty = React.useMemo(() => {
    if (isTutorial) return 1;
    const price = targetProperty.marketPrice;
    if (targetProperty.isCartelHQ || price >= 100_000_000) return 5;
    if (price >= 20_000_000) return 4;
    if (price >= 5_000_000) return 3;
    if (price >= 1_000_000) return 2;
    return 1;
  }, [targetProperty, isTutorial]);

  // Enemy AI Mind, Charge & Visual Progress Bar
  const [aiMindState, setAiMindState] = useState<'idle' | 'charging' | 'pushing'>('idle');
  const [aiChargeProgress, setAiChargeProgress] = useState<number>(0); // 0 to 100
  const [aiActionProgress, setAiActionProgress] = useState<number>(0); // 0 to 100% visible action bar
  const [aiThoughtText, setAiThoughtText] = useState<string>('💭 相場状況を観測中...');

  // Wind Direction & Momentum State
  const [currentWind, setCurrentWind] = useState<WindCondition>(WIND_CONDITIONS.TAILWIND_PLAYER);
  const [windCountdown, setWindCountdown] = useState<number>(8);

  // Skill states & cooldowns
  const [skillCooldowns, setSkillCooldowns] = useState<Record<string, number>>({});
  const [phiSkillMultiplier, setPhiSkillMultiplier] = useState<number>(1.0);
  const [isDemoralized, setIsDemoralized] = useState<boolean>(false);
  const [fastHorseActive, setFastHorseActive] = useState<boolean>(false);

  // Floating effects, chip animations & screen shake
  const [effects, setEffects] = useState<FloatingEffect[]>([]);
  const [shake, setShake] = useState<boolean>(false);
  const [pStackWobble, setPStackWobble] = useState<boolean>(false);
  const [eStackWobble, setEStackWobble] = useState<boolean>(false);

  const [isEnded, setIsEnded] = useState<boolean>(false);
  const [winner, setWinner] = useState<'player' | 'opponent' | null>(null);
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  const [spriteMotion, setSpriteMotion] = useState<'idle' | 'player-attack' | 'enemy-attack' | 'player-win' | 'enemy-win'>('idle');
  const spriteMotionTimerRef = useRef<number | null>(null);
  const resultDelayTimerRef = useRef<number | null>(null);
  const [rebelledList, setRebelledList] = useState<Property[]>([]);
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [logFilter, setLogFilter] = useState<string>('ALL');

  // Local copy of owned properties to track L_risk changes during battle demands
  const [battleSubs, setBattleSubs] = useState<Property[]>(ownedProperties);
  const [demandedSubIds, setDemandedSubIds] = useState<string[]>([]);
  const [allianceSupportUsed, setAllianceSupportUsed] = useState(false);
  const opponentReserveRef = useRef(opponentReserve);
  useEffect(() => { opponentReserveRef.current = opponentReserve; }, [opponentReserve]);
  useEffect(() => () => {
    if (spriteMotionTimerRef.current) window.clearTimeout(spriteMotionTimerRef.current);
    if (resultDelayTimerRef.current) window.clearTimeout(resultDelayTimerRef.current);
  }, []);

  const triggerSpriteMotion = (motion: 'player-attack' | 'enemy-attack' | 'player-win' | 'enemy-win') => {
    if (spriteMotionTimerRef.current) window.clearTimeout(spriteMotionTimerRef.current);
    setSpriteMotion(motion);
    if (motion === 'player-attack' || motion === 'enemy-attack') {
      spriteMotionTimerRef.current = window.setTimeout(() => setSpriteMotion('idle'), 520);
    }
  };

  const recordOwnershipImpulse = (delta: number, label: string) => {
    const bounded = Math.max(-12, Math.min(12, delta));
    ownershipImpulseRef.current = Math.max(-14, Math.min(14, ownershipImpulseRef.current + bounded));
    setOwnershipEvent(`${bounded >= 0 ? '▲ 自社所有率が急伸' : '▼ 自社所有率が急落'} — ${label}`);
    triggerSpriteMotion(bounded >= 0 ? 'player-attack' : 'enemy-attack');
    if (Math.abs(bounded) >= 2.5) soundFx.playMarketShock(bounded >= 0 ? 'rise' : 'drop', Math.abs(bounded) / 12);
  };

  const commitOpponentFunds = (requested: number, reason: string) => {
    const actual = Math.max(0, Math.min(Math.round(requested), opponentReserveRef.current));
    if (actual <= 0) {
      addLog(`🏳️ 【競合】防衛予算が尽き、追加の対抗資金を出せません。`, 'enemy');
      return 0;
    }
    opponentReserveRef.current -= actual;
    setOpponentReserve(opponentReserveRef.current);
    setOpponentInvested((prev) => prev + actual);
    triggerEStackWobble();
    soundFx.playCapitalImpact('opponent', actual / Math.max(targetProperty.marketPrice * 0.2, 1));
    recordOwnershipImpulse(-Math.min(10, 3 + (actual / Math.max(targetProperty.marketPrice, 1)) * 16), `競合が${formatCurrency(actual)}を対抗投入`);
    triggerEffect(`+${formatCurrency(actual)}`, 'opponent');
    addLog(`▶ 【競合】${reason} ${formatCurrency(actual)} 投入（残予算 ${formatCurrency(opponentReserveRef.current)}）`, 'enemy');
    if (opponentReserveRef.current <= 0) {
      soundFx.playWarning();
      addLog(`🚨 【防衛資金枯渇】競合はもう反撃資金を出せません。次の直接出資で最終押し込み可能！`, 'system');
    }
    return actual;
  };

  // Battle Event Logs (Persistent history log with categories)
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour12: false }),
      category: 'system',
      message: `▶ 【買収工作開始】対象物件: ${targetProperty.name} (相場: ${formatCurrency(targetProperty.marketPrice)}) / 仲介手数料 ${formatCurrency(brokerageFee)} 支払完了。市場動向の監視を開始！`,
    },
  ]);

  // Active Command Tab in SNES Menu & Thumb Modal Sheet
  const [activeTab, setActiveTab] = useState<'company' | 'skills' | 'subs' | 'auto'>('company');

  // Selected Investment Level for Scrollable Container
  const [selectedInvestLevel, setSelectedInvestLevel] = useState<number>(3);

  // Auto Investment Engine
  const [autoInvestActive, setAutoInvestActive] = useState<boolean>(false);
  const [autoInvestLevel, setAutoInvestLevel] = useState<number>(1);

  const triggerPStackWobble = () => {
    setPStackWobble(true);
    setTimeout(() => setPStackWobble(false), 350);
  };

  const triggerEStackWobble = () => {
    setEStackWobble(true);
    setTimeout(() => setEStackWobble(false), 350);
  };

  const addLog = (msg: string, category: 'market' | 'enemy' | 'player' | 'skill' | 'subs' | 'result' | 'system' = 'system') => {
    const timeStr = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    const newEntry: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: timeStr,
      category,
      message: msg,
    };
    setLogs((prev) => [newEntry, ...prev.slice(0, 99)]); // Keep up to 100 entries
  };

  // Auto-Investment Loop Effect
  useEffect(() => {
    if (!autoInvestActive || isEnded) return;

    const interval = setInterval(() => {
      const cost = getInvestmentCost(targetProperty.marketPrice, autoInvestLevel);
      if (remainingPlayerCash >= cost) {
        handleInvestCompany(autoInvestLevel);
      } else {
        setAutoInvestActive(false);
        addLog(`⚠️ 【自動買収停止】所持資金不足のため自動買収を停止しました。`);
      }
    }, 750);

    return () => clearInterval(interval);
  }, [autoInvestActive, autoInvestLevel, remainingPlayerCash, isEnded, targetProperty.marketPrice]);

  // Battle loop ref
  const animFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(performance.now());
  const aiNextTickRef = useRef<number>(performance.now() + 1000);
  const marketWaveTickRef = useRef<number>(performance.now() + 8000);

  const triggerEffect = (text: string, type: 'player' | 'opponent' | 'skill' = 'player') => {
    const id = Date.now() + Math.random();
    const x = type === 'player' ? 25 + Math.random() * 20 : type === 'opponent' ? 60 + Math.random() * 20 : 40;
    setEffects((prev) => [...prev, { id, text, x, type }]);
    setTimeout(() => {
      setEffects((prev) => prev.filter((e) => e.id !== id));
    }, 800);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 200);
  };

  // Property Rank
  const getRank = (price: number) => {
    if (price >= 1_000_000) return { rank: 'S格', color: 'border-amber-400 text-amber-300 bg-amber-950/80' };
    if (price >= 500_000) return { rank: 'A格', color: 'border-purple-400 text-purple-300 bg-purple-950/80' };
    if (price >= 200_000) return { rank: 'B格', color: 'border-cyan-400 text-cyan-300 bg-cyan-950/80' };
    if (price >= 50_000) return { rank: 'C格', color: 'border-emerald-400 text-emerald-300 bg-emerald-950/80' };
    return { rank: 'D格', color: 'border-slate-400 text-slate-300 bg-slate-900/80' };
  };

  const propertyRank = getRank(targetProperty.marketPrice);

  // Dynamic Market Wave Generator (FX Trends during battle)
  useEffect(() => {
    if (isEnded) return;

    const waveInterval = setInterval(() => {
      const trends: MarketTrendType[] = ['BULL', 'BEAR', 'VOLATILE', 'STABLE'];
      const nextTrend = trends[Math.floor(Math.random() * trends.length)];
      setMarketTrend(nextTrend);

      if (nextTrend === 'BULL') {
        setTrendMultiplier(1.15);
        recordOwnershipImpulse(5.5, '買い注文集中・自社出資効率15%上昇');
        addLog(`📈 【市場好転】買い気が優勢。自社出資の効きが15%上昇。`, 'market');
      } else if (nextTrend === 'BEAR') {
        setTrendMultiplier(0.85);
        recordOwnershipImpulse(-6.5, '信用不安・自社出資効率15%低下');
        addLog(`📉 【市場警戒】慎重ムード。出資効率が15%低下。`, 'market');
      } else if (nextTrend === 'VOLATILE') {
        setTrendMultiplier(1.25);
        recordOwnershipImpulse(Math.random() > 0.5 ? 8 : -8, '大口注文で相場が乱高下');
        addLog(`⚡ 【出来高増】値動きが活発化。攻防の進行がやや速まる。`, 'market');
      } else {
        setTrendMultiplier(1.0);
        addLog(`⚖️ 【市場推移】市場は安定した推移を見せています。`, 'market');
      }
    }, 10000);

    return () => clearInterval(waveInterval);
  }, [isEnded]);

  // Sub-second ownership tape: continuous micro movement, with visible shocks after capital commits.
  useEffect(() => {
    if (isEnded) return;
    const interval = setInterval(() => {
      const trendBias = marketTrend === 'BULL' ? 0.18 : marketTrend === 'BEAR' ? -0.18 : 0;
      const microNoise = (Math.random() - 0.5) * (marketTrend === 'VOLATILE' ? 1.8 : 0.75);
      const impulse = ownershipImpulseRef.current;
      const delta = trendBias + microNoise + impulse;
      ownershipImpulseRef.current *= 0.24;
      ownershipDriftRef.current = Math.max(-0.7, Math.min(0.7, -delta * 0.055));
      if (Math.abs(impulse) < 1 && Math.random() < 0.18) {
        setOwnershipEvent(
          marketTrend === 'STABLE'
            ? '小口売買で所有率が微動しています'
            : `${marketTrend === 'BULL' ? '買い優勢' : marketTrend === 'BEAR' ? '売り優勢' : '乱高下'}の地合いが所有率を揺らしています`
        );
      }
    }, 420);
    return () => clearInterval(interval);
  }, [isEnded, marketTrend]);

  // Wind Ticker Effect (Shifts wind direction and momentum periodically)
  useEffect(() => {
    if (isEnded) return;

    const timer = setInterval(() => {
      setWindCountdown((prev) => {
        if (prev <= 1) {
          const windTypes: WindType[] = [
            'TAILWIND_PLAYER',
            'HEADWIND_PLAYER',
            'TAILWIND_ENEMY',
            'CROSSWIND',
            'CALM',
          ];
          const nextType = windTypes[Math.floor(Math.random() * windTypes.length)];
          const nextWind = WIND_CONDITIONS[nextType];
          setCurrentWind(nextWind);
          soundFx.playCoin();
          addLog(`💨 【風向き急変】${nextWind.title}！ (${nextWind.directionLabel})`, 'market');
          triggerEffect(`💨 ${nextWind.title}`, 'skill');
          return 8; // Reset countdown to 8 seconds
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isEnded]);

  // Main Simulation Loop
  useEffect(() => {
    if (isEnded) return;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTickRef.current) / 1000, 0.1);
      lastTickRef.current = now;

      // Calculate total player invested with Wind Multipliers applied
      const totalPlayerInvested = playerCompanyInvested + playerDemandInvested;
      const effectivePlayerInvested = totalPlayerInvested * currentWind.playerMultiplier;
      const effectiveOpponentInvested = opponentInvested * currentWind.enemyMultiplier;

      // Calculate gauge displacement speed dG/dt with Market Trend & Wind Multipliers
      const capitalVelocity = calculateGaugeVelocity(
        effectivePlayerInvested,
        effectiveOpponentInvested,
        targetProperty.marketPrice,
        phiSkillMultiplier * trendMultiplier * currentWind.speedMultiplier * (1 + industryInfluence.playerBonus + regionalInfluence.playerBonus + tradeNetworkBonus)
      );
      const v = finishingPushRef.current ? -36 : capitalVelocity + ownershipDriftRef.current;

      setGaugeSpeed(v);

      // Update Gauge position
      setGauge((prev) => {
        const nextG = prev + v * dt * 3.5; // 判断と対抗の余地を残す速度

        // Victory Condition ($G \le -100$)
        if (nextG <= -100) {
          if (finishingPushRef.current) {
            handleFinish('player');
            return -100;
          }
          return -99;
        }
        // Defeat Condition ($G \ge +100$)
        if (nextG >= 100) {
          handleFinish('opponent');
          return 100;
        }
        return nextG;
      });

      // Opponent AI Mind & Action Tick
      if (!finishingPushRef.current && opponentReserveRef.current > 0 && now >= aiNextTickRef.current) {
        const baseInterval = 2600;
        const aiInterval = isDemoralized ? baseInterval * 1.5 : baseInterval;
        aiNextTickRef.current = now + aiInterval;

        const diff = totalPlayerInvested - opponentInvested;

        // Enemy AI Charge / Mind state logic
        if (gauge < -30 || diff > targetProperty.marketPrice * 0.3) {
          // Enemy feels pressured and prepares counter-charge
          setAiMindState('charging');
          setOwnershipEvent('⚠ 競合の大口対抗注文を検知。約定すると急落します');
          setAiChargeProgress((prev) => {
            const nextProgress = prev + 34;
            if (nextProgress >= 100) {
              // Trigger Heavy Counter Push
              const pushScale = 0.16 + Math.random() * 0.16;
              const aiPush = Math.round(targetProperty.marketPrice * pushScale);
              const actualPush = commitOpponentFunds(aiPush, '対抗資金');
              if (actualPush <= 0) return 0;
              soundFx.playGaugeTick(0.8);
              triggerEffect(`💥対抗! +${formatCurrency(actualPush)}`, 'opponent');
              triggerShake();
              setAiMindState('idle');
              return 0;
            }
            return nextProgress;
          });
        } else if (gauge > 20) {
          // Enemy is pushing advantage
          setAiMindState('pushing');
          const pushScale = 0.06 + Math.random() * 0.08;
          const aiPush = Math.round(targetProperty.marketPrice * pushScale);
          commitOpponentFunds(aiPush, '優勢時の追撃資金');
        } else {
          // Enemy is observing market (Idle gap for player attack)
          setAiMindState('idle');
          setAiChargeProgress((prev) => Math.max(0, prev - 10));
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    isEnded,
    playerCompanyInvested,
    playerDemandInvested,
    opponentInvested,
    targetProperty.marketPrice,
    phiSkillMultiplier,
    trendMultiplier,
    currentWind,
    industryInfluence.playerBonus,
    regionalInfluence.playerBonus,
    tradeNetworkBonus,
    isDemoralized,
    gauge,
    finishingPush,
  ]);

  // 交渉中も市場の細かな値動きと保有物件の収益で、可処分資金が少しずつ変わる。
  useEffect(() => {
    if (isEnded) return;
    const interval = setInterval(() => {
      const portfolioIncome = ownedProperties.reduce((sum, prop) => sum + prop.annualRevenue, 0);
      const marketNoise = Math.round(targetProperty.marketPrice * (Math.random() - 0.46) * 0.00022);
      const delta = Math.round(Math.max(-Math.max(2, portfolioIncome * 0.04), portfolioIncome * 0.08 + marketNoise));
      setRemainingPlayerCash((prev) => Math.max(0, prev + delta));
      setBattleCashDelta((prev) => prev + delta);
      setCashFlow(delta);
    }, 1000);
    return () => clearInterval(interval);
  }, [isEnded, ownedProperties, targetProperty.marketPrice]);

  // 追証を模した警戒状態。資金が尽きかけ、かつ押し込まれている時だけ点灯する。
  useEffect(() => {
    if (isEnded) return;
    const safetyLine = Math.max(250, targetProperty.marketPrice * 0.06);
    const atRisk = remainingPlayerCash < safetyLine && gauge > 25;
    if (!atRisk) {
      setMarginCountdown(null);
      return;
    }
    setMarginCountdown(8);
  }, [isEnded, remainingPlayerCash, gauge, targetProperty.marketPrice]);

  // Skill Cooldown Ticker
  useEffect(() => {
    if (isEnded) return;
    const interval = setInterval(() => {
      setSkillCooldowns((prev) => {
        const next = { ...prev };
        let updated = false;
        Object.keys(next).forEach((key) => {
          if (next[key] > 0) {
            next[key] = Math.max(0, next[key] - 200);
            updated = true;
          }
        });
        return updated ? next : prev;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isEnded]);

  // Command: Invest Company Funds (自社資金を出す)
  const handleInvestCompany = (multiplierLevel: number) => {
    if (isEnded || finishingPushRef.current) return;
    const amount = getInvestmentCost(targetProperty.marketPrice, multiplierLevel);

    if (remainingPlayerCash < amount) {
      soundFx.playWarning();
      addLog(`▶ 【エラー】自社資金不足！（必要: ${formatCurrency(amount)}）`, 'system');
      return;
    }

    // Mobile vibration feedback
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate(25);
      } catch (e) {
        // ignore
      }
    }

    setRemainingPlayerCash((prev) => prev - amount);
    setPlayerCompanyInvested((prev) => prev + amount);
    triggerPStackWobble();
    soundFx.playCapitalImpact('player', multiplierLevel / 10);
    recordOwnershipImpulse(Math.min(10, 2.5 + (amount / Math.max(targetProperty.marketPrice, 1)) * 18), `自社が${formatCurrency(amount)}を買い投入`);
    triggerEffect(`+${formatCurrency(amount)}`, 'player');
    if (multiplierLevel >= 5) triggerShake();
    const lvlCfg = INVESTMENT_LEVELS.find((i) => i.level === multiplierLevel) || INVESTMENT_LEVELS[0];
    addLog(`▶ 【自社出資】Lv${multiplierLevel}(${lvlCfg.label}) ${formatCurrency(amount)} 投入！`, 'player');

    if (opponentReserveRef.current <= 0) {
      finishingPushRef.current = true;
      setFinishingPush(true);
      setAutoInvestActive(false);
      triggerShake();
      soundFx.playFinalPush();
      triggerEffect('FINAL PUSH!', 'skill');
      addLog(`⚔️ 【最終押し込み】敵は防衛不能！ ${formatCurrency(amount)} を積み、WINまで一気に押し切ります！`, 'result');
    }
  };

  // Command: Demand Funds from Subsidiary (グループ会社要求)
  const handleDemandSubsidiary = (sub: Property) => {
    if (isEnded || demandedSubIds.includes(sub.id)) return;
    const amount = sub.marketPrice * 0.45;

    setBattleSubs((prev) =>
      prev.map((item) =>
        item.id === sub.id
          ? { ...item, loyaltyRisk: Math.min(100, item.loyaltyRisk + 25) }
          : item
      )
    );

    setPlayerDemandInvested((prev) => prev + amount);
    setDemandedSubIds((prev) => [...prev, sub.id]);
    triggerPStackWobble();
    soundFx.playBigCash();
    recordOwnershipImpulse(7.5, `支援資金${formatCurrency(amount)}が流入`);
    triggerEffect(`+${formatCurrency(amount)}`, 'player');
    triggerShake();
    addLog(`▶ 【グループ要求: ${sub.name}】支援資金 ${formatCurrency(amount)} を確保（危険度 +25 / この交渉では再要求不可）`, 'subs');
  };

  // Command: Demand Funds from All Subsidiaries (一括要求)
  const handleDemandAllSubsidiaries = () => {
    if (isEnded || battleSubs.length === 0) return;

    let totalAmount = 0;
    setBattleSubs((prev) =>
      prev.map((sub) => {
        if (demandedSubIds.includes(sub.id)) return sub;
        totalAmount += sub.marketPrice * 0.45;
        return { ...sub, loyaltyRisk: Math.min(100, sub.loyaltyRisk + 20) };
      })
    );

    if (totalAmount <= 0) return;
    setDemandedSubIds(battleSubs.map((sub) => sub.id));

    setPlayerDemandInvested((prev) => prev + totalAmount);
    triggerPStackWobble();
    soundFx.playBigCash();
    recordOwnershipImpulse(9, `全グループ資金${formatCurrency(totalAmount)}が流入`);
    triggerEffect(`+${formatCurrency(totalAmount)}`, 'player');
    triggerShake();
    addLog(`▶ 【全グループ一括要求】合計 ${formatCurrency(totalAmount)} を一挙投入！`, 'subs');
  };

  // Command: Alliance Fund Request (同盟資金)
  const handleAllianceRequest = () => {
    if (isEnded || !alliance.active || allianceSupportUsed) return;
    const amount = targetProperty.marketPrice * 0.35;

    setPlayerDemandInvested((prev) => prev + amount);
    setAllianceSupportUsed(true);
    triggerPStackWobble();
    soundFx.playBigCash();
    recordOwnershipImpulse(7.5, `支援資金${formatCurrency(amount)}が流入`);
    triggerEffect(`+${formatCurrency(amount)}`, 'player');
    triggerShake();
    addLog(`▶ 【同盟支援: ${alliance.allyName}】同盟資金 ${formatCurrency(amount)} 注入！`, 'subs');
  };

  // Command: Trigger Tactical Skill
  const handleUseSkill = (skill: TacticalSkill) => {
    if (isEnded || (skillCooldowns[skill.id] || 0) > 0) return;

    soundFx.playSkillSpark();
    triggerEffect(`✨${skill.name}`, 'skill');
    triggerShake();

    const effectiveCooldown = fastHorseActive ? skill.cooldownMs * 0.5 : skill.cooldownMs;

    setSkillCooldowns((prev) => ({
      ...prev,
      [skill.id]: effectiveCooldown,
    }));

    if (skill.effectType === 'COOLDOWN_REDUCTION') {
      setFastHorseActive(true);
      setTimeout(() => setFastHorseActive(false), 8000);
      addLog(`▶ 【技: 早馬】8秒間、スキル再使用時間を50%短縮！`, 'skill');
    } else if (skill.effectType === 'NEMAWASHI') {
      setBattleSubs((prev) =>
        prev.map((sub) => ({
          ...sub,
          loyaltyRisk: Math.max(0, sub.loyaltyRisk - 30),
        }))
      );
      addLog(`▶ 【技: ネマワシ】傘下物件の独立危険度 -30 減少！`, 'skill');
    } else if (skill.effectType === 'INDEPENDENCE_SABOTAGE') {
      const sabotageDrain = targetProperty.marketPrice * 0.3;
      setOpponentInvested((prev) => Math.max(0, prev - sabotageDrain));
      triggerEStackWobble();
      addLog(`▶ 【技: 物件独立工作】敵資本 -${formatCurrency(sabotageDrain)} 減少！`, 'skill');
    } else if (skill.effectType === 'DEMORALIZE') {
      setIsDemoralized(true);
      setTimeout(() => setIsDemoralized(false), 6000);
      addLog(`▶ 【技: 消沈】敵AIの行動間隔を1.5倍に延長！`, 'skill');
    } else if (skill.effectType === 'CAPITAL_BOOST') {
      const boostAmount = targetProperty.marketPrice * 0.3;
      setPlayerDemandInvested((prev) => prev + boostAmount);
      triggerPStackWobble();
      addLog(`▶ 【技: 資本即時投入】${formatCurrency(boostAmount)} を投入！`, 'skill');
    } else if (skill.effectType === 'SNS_BLITZ') {
      const impact = Math.min(opponentInvested, Math.round(targetProperty.marketPrice * 0.16));
      setOpponentInvested((prev) => Math.max(0, prev - impact));
      triggerEStackWobble();
      addLog(`▶ 【SNS工作】買収先の世論を動かし、競合の有効防衛資金を ${formatCurrency(impact)} 揺さぶった。7秒後に反論が来る…`, 'skill');
      setTimeout(() => {
        if (!isEnded) {
          const backlash = commitOpponentFunds(targetProperty.marketPrice * 0.18, 'SNS反論キャンペーン');
          if (backlash > 0) {
            triggerShake();
            addLog(`⚠️ 【SNS反動】競合が反論を拡散。敵の残予算から ${formatCurrency(backlash)} が防衛に回った！`, 'enemy');
          }
        }
      }, 7000);
    } else if (skill.effectType === 'SYNERGY_PUSH') {
      setPhiSkillMultiplier(2.0);
      setTimeout(() => setPhiSkillMultiplier(1.0), 6000);
      addLog(`▶ 【技: グループ総力戦】6秒間、ゲージ推移速度2.0倍！`, 'skill');
    }
  };

  const handleSurrender = () => {
    handleFinish('opponent');
  };

  const handleFinish = (resultWinner: 'player' | 'opponent') => {
    if (isEnded) return;
    setIsEnded(true);
    setWinner(resultWinner);
    setAutoInvestActive(false);
    setShowResultOverlay(false);
    triggerSpriteMotion(resultWinner === 'player' ? 'player-win' : 'enemy-win');
    resultDelayTimerRef.current = window.setTimeout(() => setShowResultOverlay(true), 1500);

    const rebelledProps: Property[] = [];
    battleSubs.forEach((sub) => {
      const prob = calculateRebellionProbability(sub.loyaltyRisk);
      if (sub.loyaltyRisk > 20 && Math.random() < prob) {
        rebelledProps.push(sub);
      }
    });
    setRebelledList(rebelledProps);

    if (resultWinner === 'player') {
      soundFx.playVictory();
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
      addLog(`🏆 【買収完全成功】物件『${targetProperty.name}』の買収工作に成功しました！`, 'result');
    } else {
      soundFx.playDefeat();
      addLog(`💀 【買収失敗】競合相手に押され撤退。直接出資の75%が撤退損として確定します。`, 'result');
    }

    if (rebelledProps.length > 0) {
      addLog(`⚠️ 【グループ独立離脱】過度な資金要求により、${rebelledProps.length}件の傘下物件が独立を図りました！`, 'result');
    }
  };

  const handleConfirmResult = () => {
    // 出資は勝利時にも一部を買収費用として消費し、敗北時は撤退損が大きい。
    // 画面の可処分残高と実際の精算が一致するよう、ここで確定する。
    const settlementCost = Math.round(playerCompanyInvested * (winner === 'player' ? 0.35 : 0.75));
    onBattleEnd({
      winner: winner || 'opponent',
      targetProperty,
      companyFundsInvested: playerCompanyInvested,
      demandFundsInvested: playerDemandInvested,
      brokerageFee,
      settlementCost,
      battleCashDelta,
      victoryReward: winner === 'player' ? Math.round(targetProperty.marketPrice * 0.05) : 0,
      rebelledProperties: rebelledList,
    });
  };

  const totalPlayerInvested = playerCompanyInvested + playerDemandInvested;
  const playerForce = (totalPlayerInvested * currentWind.playerMultiplier * trendMultiplier * (1 + industryInfluence.playerBonus + regionalInfluence.playerBonus + tradeNetworkBonus) / Math.max(targetProperty.marketPrice, 1)) * 100;
  const enemyForce = (opponentInvested * currentWind.enemyMultiplier / Math.max(targetProperty.marketPrice, 1)) * 100;
  const trendLabel = marketTrend === 'BULL' ? '強気・買い優勢' : marketTrend === 'BEAR' ? '弱気・売り優勢' : marketTrend === 'VOLATILE' ? '乱高下' : '小動き';

  const getAdvisorMessage = () => {
    if (isEnded) return '結果を整理して、商会の帳簿へ反映してくださいです。';
    if (finishingPush) return '⚔️ 最終押し込み中！ 自社所有率が100%へ届いた瞬間に買収成立ですっぺ！';
    if (enemyBudgetExhausted) return '🚨 敵は防衛不能！ 「直接出資」をもう一度押せば最終押し込み開始ですっぺ！';
    if (isTutorial) return '初回はLv1～3の少額出資から。自社所有率を右端100%まで進めるですっぺ！';
    if (aiMindState === 'charging') {
      return '⚠️ 相手が対抗資金を準備中ですっぺ！ 溜まり切る前に直接出資で畳みかけるです！';
    }
    if (marketTrend === 'BULL') {
      return '📈 市場は好転中。少額出資を重ねて有利を積み上げる好機です。';
    }
    if (aiMindState === 'idle') {
      return '🧘 相手は静観中です。いまのうちに出資を重ねて主導権を取るですっぺ。';
    }
    if (gauge > 15) {
      return '⚠️ 押し返されています！ 傘下への支援要請か連続出資で立て直すですっぺ！';
    }
    if (gaugeSpeed < -0.05) return `📈 自社圧力${playerForce.toFixed(1)}が敵${enemyForce.toFixed(1)}を上回り、WIN方向へ進行中です。`;
    if (gaugeSpeed > 0.05) return `📉 敵圧力${enemyForce.toFixed(1)}が自社${playerForce.toFixed(1)}を上回り、LOSE方向へ押されています。`;
    return '⚖️ 圧力差が小さく、小口注文で所有率が微動しています。次の大口投入が転機です。';
  };

  const selectedInvestmentConfig = INVESTMENT_LEVELS.find((item) => item.level === selectedInvestLevel) || INVESTMENT_LEVELS[2];
  const selectedInvestmentCost = getInvestmentCost(targetProperty.marketPrice, selectedInvestLevel);
  const canAffordSelectedInvestment = remainingPlayerCash >= selectedInvestmentCost;

  return (
    <div className="battle-screen-enter fixed inset-0 z-[100] bg-slate-950 flex flex-col h-[100dvh] max-h-[100dvh] w-full overflow-hidden font-sans select-none touch-manipulation">
      <img src={FANKIT_ART.battleBackdrop} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[1px]" />
      {/* Floating Effects Layer */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {effects.map((fx) => (
          <div
            key={fx.id}
            className={`absolute bottom-1/2 font-black text-xs sm:text-sm animate-coin-float drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${
              fx.type === 'player'
                ? 'text-yellow-300'
                : fx.type === 'opponent'
                ? 'text-rose-400'
                : 'text-cyan-300'
            }`}
            style={{ left: `${fx.x}%` }}
          >
            {fx.text}
          </div>
        ))}
      </div>

      {/* 1. SLEEK COMPACT HEADER */}
      <div className="relative z-10 bg-slate-900/95 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between shrink-0 h-10 shadow">
        <div className="flex items-center gap-1.5 min-w-0">
          <Crown className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-extrabold text-slate-100 text-sm truncate">
            {targetProperty.name}
          </span>
          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border shrink-0 ${propertyRank.color}`}>
            {propertyRank.rank}
          </span>
          <span className="hidden text-[9px] font-bold px-1.5 py-0.5 rounded border border-violet-500/30 sm:inline-flex bg-violet-950/70 text-violet-300 shrink-0">
            {targetProperty.community}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden text-right sm:block">
            <span className="text-[10px] text-slate-400 block leading-none">相場</span>
            <span className="text-xs text-amber-300 font-mono font-bold leading-none">
              {formatCurrency(targetProperty.marketPrice)}
            </span>
          </div>

          <button
            onClick={() => setShowHelpModal(true)}
            className="px-2 py-1 rounded-md bg-cyan-950/70 hover:bg-cyan-900 active:scale-95 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 shadow"
            title="買収交渉の目的・出資・支援・精算ルールを確認する"
          >
            <CircleHelp className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">操作</span>
          </button>

          <button
            onClick={() => setShowLogModal(true)}
            className="px-2 py-1 rounded-md bg-amber-950/80 hover:bg-amber-900 active:scale-95 border border-amber-500/50 text-amber-300 text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 shadow"
            title="市場の変化や敵・自社の過去ログを確認する"
          >
            <ScrollText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">戦局ログ ({logs.length})</span>
          </button>

          <button
            onClick={handleSurrender}
            disabled={isEnded}
            className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 active:bg-rose-950 border border-slate-700 text-slate-300 hover:text-rose-300 text-[11px] font-bold cursor-pointer transition-colors"
            title="撤退して今回の買収工作をあきらめる"
          >
            撤退
          </button>
        </div>
      </div>

      {/* 2. DYNAMIC MONEY STACK GRAPHIC & TUG-OF-WAR BATTLE METER */}
      <div className="battle-stage relative z-10 bg-slate-900/95 border-b border-slate-800 p-2.5 shrink-0 space-y-2 shadow-xl overflow-hidden">
        <div className="battle-influence-grid hidden grid-cols-1 gap-1.5 sm:grid sm:grid-cols-3">
          <div className="influence-ribbon relative overflow-hidden rounded-lg border border-indigo-500/40 bg-indigo-950/40 px-2.5 py-1.5 text-[10px] font-bold" title={HELP_TEXT.industryInfluence}>
            <img src={FANKIT_ART.commerceIcons[0]} alt="" aria-hidden="true" className="absolute -right-2 -top-3 h-12 w-12 opacity-20" />
            <span className="relative block text-indigo-200">業界：{industryInfluence.label} ({industryInfluence.owned}/{industryInfluence.total})</span>
            <span className="relative text-indigo-300">出資 +{Math.round(industryInfluence.playerBonus * 100)}%{industryInfluence.enemyBudgetDiscount > 0 && ' / 敵予算 -10%'}</span>
          </div>
          <div className="influence-ribbon relative overflow-hidden rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-2.5 py-1.5 text-[10px] font-bold" title={HELP_TEXT.regionalInfluence}>
            <img src={FANKIT_ART.commerceIcons[3]} alt="" aria-hidden="true" className="absolute -right-2 -top-3 h-12 w-12 opacity-20" />
            <span className="relative block text-emerald-200">地域：{regionalInfluence.label} ({regionalInfluence.owned}/{regionalInfluence.total})</span>
            <span className="relative text-emerald-300">出資 +{Math.round(regionalInfluence.playerBonus * 100)}%{regionalInfluence.enemyBudgetDiscount > 0 && ` / 敵予算 -${Math.round(regionalInfluence.enemyBudgetDiscount * 100)}%`}</span>
          </div>
          <div className="influence-ribbon relative overflow-hidden rounded-lg border border-amber-500/40 bg-amber-950/40 px-2.5 py-1.5 text-[10px] font-bold" title={HELP_TEXT.regionalInfluence}>
            <img src={FANKIT_ART.commerceIcons[1]} alt="" aria-hidden="true" className="absolute -right-2 -top-3 h-12 w-12 opacity-20" />
            <span className="relative block text-amber-200">都市交易網</span>
            <span className="relative text-amber-300">制覇都市補正 +{Math.round(tradeNetworkBonus * 100)}%</span>
          </div>
        </div>
        <div className="battle-mobile-influence flex items-center gap-2 overflow-x-auto rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-[9px] font-bold sm:hidden">
          <span className="whitespace-nowrap text-indigo-300">業界 +{Math.round(industryInfluence.playerBonus * 100)}%</span>
          <span className="whitespace-nowrap text-emerald-300">地域 +{Math.round(regionalInfluence.playerBonus * 100)}%</span>
          <span className="whitespace-nowrap text-amber-300">交易 +{Math.round(tradeNetworkBonus * 100)}%</span>
          <span className="ml-auto whitespace-nowrap text-slate-400">合計 +{Math.round((industryInfluence.playerBonus + regionalInfluence.playerBonus + tradeNetworkBonus) * 100)}%</span>
        </div>
        <section className={`battle-ownership-panel ownership-battle rounded-xl border p-3 ${finishingPush ? 'ownership-battle--finishing border-amber-300' : enemyBudgetExhausted ? 'border-emerald-400/70' : 'border-cyan-500/35'}`}>
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-black tracking-[.22em] text-cyan-300">LIVE OWNERSHIP</p>
              <p className="battle-ownership-help mt-0.5 text-[10px] text-slate-400">この一本が勝敗です。右端100%へ押し切れば買収成功。</p>
            </div>
            <span className={`rounded px-2 py-1 text-[9px] font-black ${enemyBudgetExhausted ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-500/10 text-rose-200'}`}>
              {enemyBudgetExhausted ? '敵防衛崩壊 — 次の直接出資で決着' : `敵残予算 ${formatCurrency(opponentReserve)}`}
            </span>
          </div>

          <div className="mb-1 flex items-baseline justify-between font-black">
            <span className="text-amber-300">自社所有率 <strong className="font-mono text-2xl">{Math.max(0, Math.round((100 - gauge) / 2))}%</strong></span>
            <span className="text-right text-rose-300"><strong className="font-mono text-2xl">{Math.max(0, Math.round((100 + gauge) / 2))}%</strong> 敵所有率</span>
          </div>

          <div className="ownership-track relative h-14 overflow-hidden rounded-lg border border-slate-600 bg-rose-950 shadow-inner">
            <div className="ownership-track__player absolute inset-y-0 left-0 bg-gradient-to-r from-amber-700 via-amber-400 to-yellow-200 transition-[width] duration-75" style={{ width: `${Math.max(0, Math.min(100, (100 - gauge) / 2))}%` }} />
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/35" />
            <div className="ownership-track__clash absolute inset-y-0 w-1 bg-white shadow-[0_0_18px_rgba(255,255,255,.95)] transition-[left] duration-75" style={{ left: `${Math.max(0, Math.min(100, (100 - gauge) / 2))}%` }} />
            <div className={`sprite-exchange sprite-exchange--${spriteMotion}`}>
              <img src={FANKIT_ART.jobs[0]} alt="自社側ジョブキャラクター" className="pixel-fighter pixel-fighter--player" />
              <span className="sprite-impact" aria-hidden="true">GIL!</span>
              <img src={FANKIT_ART.jobs[1]} alt="競合側ジョブキャラクター" className="pixel-fighter pixel-fighter--enemy" />
            </div>
            <span className="absolute left-2 top-1 text-[9px] font-black text-slate-950 drop-shadow-sm">自社 →</span>
            <span className="absolute right-2 top-1 text-[9px] font-black text-rose-100">← 競合</span>
            {isEnded && !showResultOverlay && (
              <div className="battle-result-beat absolute inset-x-1/2 top-1/2 z-30 w-48 -translate-x-1/2 -translate-y-1/2 rounded border border-white/50 bg-slate-950/90 px-2 py-1 text-center">
                <b className={winner === 'player' ? 'text-amber-300' : 'text-rose-300'}>{winner === 'player' ? '自社所有率 100% — 買収成立' : '自社所有率 0% — 買収失敗'}</b>
                <span className="block text-[8px] text-slate-300">決着状況を確認中…</span>
              </div>
            )}
          </div>

          <div className="battle-force-line mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <span className={`font-black ${gaugeSpeed < -0.05 ? 'text-amber-300' : gaugeSpeed > 0.05 ? 'text-rose-300' : 'text-slate-300'}`}>
              {gaugeSpeed < -0.05 ? '≫ 自社が押している' : gaugeSpeed > 0.05 ? '≪ 敵に押し返されている' : '＝ 所有率が拮抗'}
            </span>
            <span className="font-mono text-slate-400">圧力 自社 {playerForce.toFixed(1)} / 敵 {enemyForce.toFixed(1)} ・ {trendLabel}</span>
          </div>
          <p className="battle-ownership-event ownership-event mt-2 rounded-md border border-slate-700 bg-slate-950/80 px-2.5 py-1.5 text-[10px] font-bold text-cyan-100">{ownershipEvent}</p>
        </section>

        {/* REAL-TIME 3D MONEY & CHIP STACK ARENA (画面中央 カジノチップ積載対決グラフィック) */}
        <div className={`battle-fund-arena bg-[#050814] border border-amber-500/40 rounded-xl p-2.5 relative overflow-hidden shadow-2xl ${finishingPush ? 'final-push-arena' : ''}`}>
          <img src={FANKIT_ART.battleBackdrop} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.13] mix-blend-screen" />
          <div className="battle-fund-headline flex items-center justify-between text-[11px] font-bold mb-1.5 px-1 relative z-10">
            <div className="flex items-center gap-1 text-yellow-300 bg-slate-950/80 px-2 py-0.5 rounded-lg border border-amber-500/30">
              <Coins className="w-3.5 h-3.5 text-yellow-400 animate-bounce shrink-0" />
              <span className="text-slate-300">自社投入:</span>
              <span className="font-mono text-xs font-black text-amber-200">{formatCurrency(totalPlayerInvested)}</span>
            </div>

            <div className="text-[10px] text-amber-300 font-mono font-black bg-gradient-to-r from-amber-950 via-slate-950 to-amber-950 px-2.5 py-0.5 rounded-full border border-amber-500/50 shadow-md">
              💰 買収資金の攻防 💰
            </div>

            <div className="flex items-center gap-1 text-rose-400 bg-slate-950/80 px-2 py-0.5 rounded-lg border border-rose-500/30">
              <span className="text-slate-300">競合投入:</span>
              <span className="font-mono text-xs font-black text-rose-300">{formatCurrency(opponentInvested)}</span>
            </div>
          </div>
          <div className="battle-budget-line flex items-center justify-between gap-2 px-1 text-[10px] font-mono">
            <span className={enemyBudgetExhausted ? 'text-amber-200 font-black' : 'text-slate-400'}>
              敵防衛予算: <strong className={enemyBudgetExhausted ? 'text-amber-300' : 'text-rose-300'}>{formatCurrency(opponentReserve)}</strong> / {formatCurrency(enemyBudget)}
              {enemyBudgetExhausted ? ' — 防衛不能' : '（開始時に固定）'}
            </span>
            <span className={cashFlow >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
              市場損益: {cashFlow >= 0 ? '+' : ''}{formatCurrency(cashFlow)}/秒
            </span>
          </div>

          <div className="battle-steps grid grid-cols-3 gap-1 text-center text-[9px] font-bold">
            <span className="rounded border border-emerald-500/30 bg-emerald-950/40 px-1 py-1 text-emerald-300">① 防衛資金を削る</span>
            <span className={`rounded border px-1 py-1 ${enemyBudgetExhausted ? 'border-emerald-400 bg-emerald-950/50 text-emerald-200' : 'border-slate-700 bg-slate-950 text-slate-500'}`}>② 残高0＝防衛不能</span>
            <span className={`rounded border px-1 py-1 ${finishingPush ? 'animate-pulse border-amber-300 bg-amber-500/20 text-amber-200' : enemyBudgetExhausted ? 'border-amber-500 bg-amber-950/60 text-amber-300' : 'border-slate-700 bg-slate-950 text-slate-500'}`}>③ 直接出資で押し切る</span>
          </div>

          {/* CENTER STAGE WITH ABSOLUTE POSITIONED 3D CHIP TOWER STACKS */}
          <div className="battle-chip-stage relative h-24 w-full flex items-center justify-between px-4 overflow-hidden rounded-lg bg-gradient-to-b from-[#0b1022] to-[#03050d] border border-slate-800/80">
            {/* Background Grid & Light Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />
            <div className="absolute left-[31%] top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[25%] truncate text-2xl sm:text-4xl font-black font-mono text-amber-300/[0.16] pointer-events-none">
              {formatCurrency(totalPlayerInvested)}
            </div>
            <div className="absolute left-[69%] top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[25%] truncate text-2xl sm:text-4xl font-black font-mono text-rose-400/[0.16] pointer-events-none text-right">
              {formatCurrency(opponentInvested)}
            </div>

            {/* LEFT: PLAYER GOLD CHIP TOWER STACK (自社黄金チップ積載タワー - CSS絶対配置) */}
            <div className="relative w-28 h-full flex items-end justify-start z-10 pb-1">
              <img src={getFankitJobArt(targetProperty.industry)} alt="" aria-hidden="true" className="absolute -left-3 bottom-0 h-20 w-20 object-contain opacity-35 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
              {(() => {
                const pChipCount = Math.min(12, Math.max(1, Math.floor(totalPlayerInvested / ((targetProperty.marketPrice || 1000) * 0.08))));
                return (
                  <div className={`relative w-16 h-20 flex items-end justify-center transition-all duration-200 ${
                    pStackWobble ? 'scale-110 -rotate-3 -translate-y-1' : ''
                  }`}>
                    {Array.from({ length: pChipCount }).map((_, chipIdx) => (
                      <div
                        key={`player-chip-${chipIdx}`}
                        className={`gil-chip gil-chip--player absolute transition-all duration-300 ${
                          pStackWobble ? 'animate-bounce' : ''
                        }`}
                        style={{
                          bottom: `${chipIdx * 5}px`,
                          zIndex: chipIdx + 1,
                          transform: `translateX(${(chipIdx % 3 - 1) * 2}px) rotate(${(chipIdx % 2 ? 1 : -1) * 2}deg) scale(${1 - chipIdx * 0.015})`,
                        }}
                      >
                        <div className="gil-chip-face"><span>G</span></div>
                      </div>
                    ))}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black text-amber-300 bg-slate-950/90 px-1.5 py-0.2 rounded border border-amber-500/50 shadow whitespace-nowrap z-30">
                      {pChipCount}層積載
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* CENTER: 3D CLASH VS EMBLEM & CENTRAL CASH PILE */}
            <div className="relative flex flex-col items-center justify-center z-20">
              <div className="relative w-10 h-10 rounded-full bg-slate-950 border-2 border-amber-400/80 shadow-[0_0_15px_rgba(251,191,36,0.5)] flex items-center justify-center animate-pulse">
                <span className="text-xs font-black text-yellow-300 tracking-tighter">VS</span>
              </div>
              <span className="text-[8px] font-mono text-amber-200/80 mt-1 font-bold">
                {finishingPush ? '⚔ 最終押し込み中 ⚔' : gaugeSpeed < -0.1 ? '自社買収推進中 ➔' : gaugeSpeed > 0.1 ? '⬅ 競合防衛激化' : '買収攻防伯仲'}
              </span>
            </div>

            {/* RIGHT: OPPONENT DARK CHIP TOWER STACK (競合裏資金チップタワー - CSS絶対配置) */}
            <div className="relative w-28 h-full flex items-end justify-end z-10 pb-1">
              <img src={FANKIT_ART.jobs[1]} alt="" aria-hidden="true" className="absolute -right-3 bottom-0 h-20 w-20 object-contain opacity-30 grayscale drop-shadow-[0_0_10px_rgba(244,63,94,0.6)]" />
              {(() => {
                const eChipCount = Math.min(12, Math.max(1, Math.floor(opponentInvested / ((targetProperty.marketPrice || 1000) * 0.08))));
                return (
                  <div className={`relative w-16 h-20 flex items-end justify-center transition-all duration-200 ${
                    eStackWobble ? 'scale-110 rotate-3 -translate-y-1' : ''
                  }`}>
                    {Array.from({ length: eChipCount }).map((_, chipIdx) => (
                      <div
                        key={`opp-chip-${chipIdx}`}
                        className={`gil-chip gil-chip--enemy absolute transition-all duration-300 ${
                          eStackWobble ? 'animate-bounce' : ''
                        }`}
                        style={{
                          bottom: `${chipIdx * 5}px`,
                          zIndex: chipIdx + 1,
                          transform: `translateX(${(chipIdx % 3 - 1) * 2}px) rotate(${(chipIdx % 2 ? 1 : -1) * 2}deg) scale(${1 - chipIdx * 0.015})`,
                        }}
                      >
                        <div className="gil-chip-face"><span>G</span></div>
                      </div>
                    ))}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black text-rose-300 bg-slate-950/90 px-1.5 py-0.2 rounded border border-rose-500/50 shadow whitespace-nowrap z-30">
                      {eChipCount}層対抗
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Compact Wind Indicator */}
        <div className="battle-wind"><WindIndicator currentWind={currentWind} nextChangeSeconds={windCountdown} compact={true} /></div>
      </div>

      {/* 3. PRIME THUMB-OPTIMIZED COMMAND PANEL (BOTTOM SHEET STYLE) */}
      <div className="battle-command-panel relative z-10 min-h-0 flex-1 p-2 flex flex-col justify-between space-y-1.5 overflow-hidden bg-slate-950/95">
        {/* TOP ADVISOR & MARKET TACTICAL TICKER */}
        <div className="battle-advisor-strip bg-slate-900 border border-slate-800 rounded-lg p-2 flex items-center justify-between text-xs gap-2 shrink-0">
          <div className="flex items-center gap-1.5 shrink-0 font-bold" title={HELP_TEXT.marketTrend}>
            <BarChart2 className="w-4 h-4 text-cyan-400 shrink-0" />
            {marketTrend === 'BULL' && <span className="text-emerald-400">📈 強気(1.15x)</span>}
            {marketTrend === 'BEAR' && <span className="text-rose-400">📉 警戒(0.85x)</span>}
            {marketTrend === 'VOLATILE' && <span className="text-yellow-300">⚡ 出来高増(1.25x)</span>}
            {marketTrend === 'STABLE' && <span className="text-cyan-300">⚖️ 安定</span>}
          </div>

          <div className="flex items-center gap-1 text-slate-200 truncate font-bold text-[11px]">
            <span className="text-[9px] text-amber-300 border border-amber-500/30 bg-amber-950/60 rounded px-1.5 py-0.5 shrink-0">
              タタルの助言
            </span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
            <span className="truncate">{getAdvisorMessage()}</span>
          </div>
        </div>

        {marginCountdown !== null && (
          <div
            className="bg-rose-950/90 border border-rose-500 rounded-lg px-3 py-2 text-[11px] font-bold text-rose-100 flex items-center gap-2 animate-pulse"
            title={HELP_TEXT.disposableCash}
          >
            <ShieldAlert className="w-4 h-4 text-rose-300 shrink-0" />
            <span>追証警戒：可処分資金が安全ラインを下回っています。市場損益の回復を待つか、支援資金で立て直してください。</span>
          </div>
        )}

        {/* THUMB COMMAND TAB CONTENT SHEET */}
        <div className="battle-command-sheet rs3-window min-h-0 p-2.5 flex-1 flex flex-col justify-between space-y-2 overflow-y-auto border border-amber-500/30">
          {/* TAB 1: COMPANY DIRECT INVESTMENT (SCROLLABLE LEVEL CONTAINER) */}
          {activeTab === 'company' && (
            <div className="battle-company-panel space-y-2.5 flex-1 flex flex-col justify-between bg-slate-900/90 border border-amber-500/40 rounded-xl p-2.5 shadow-xl">
              {/* Header Info */}
              <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
                <span className="font-extrabold text-amber-300 flex items-center gap-1" title={HELP_TEXT.directInvestment}>
                  <Coins className="w-4 h-4 text-yellow-400 shrink-0" />
                  出資金レベル選択
                </span>
                <span className="text-[10px] text-amber-300/80 font-mono flex items-center gap-1 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                  <span>◀ 左右にスクロール ▶</span>
                </span>
              </div>

              {/* DEDICATED SCROLLABLE LEVEL CONTAINER (横スクロール専用コンテナ) */}
              <div className="relative">
                <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 scrollbar-thin scrollbar-thumb-amber-500/50 scrollbar-track-slate-950 snap-x">
                  {INVESTMENT_LEVELS.map((lvlCfg) => {
                    const cost = getInvestmentCost(targetProperty.marketPrice, lvlCfg.level);
                    const canAfford = remainingPlayerCash >= cost;
                    const isSelected = selectedInvestLevel === lvlCfg.level;

                    return (
                      <button
                        key={lvlCfg.level}
                        onClick={() => setSelectedInvestLevel(lvlCfg.level)}
                        onDoubleClick={() => {
                          setSelectedInvestLevel(lvlCfg.level);
                          if (canAfford && !isEnded) handleInvestCompany(lvlCfg.level);
                        }}
                        disabled={isEnded}
                        className={`snap-center shrink-0 min-w-[78px] py-2 px-2 rounded-lg text-xs font-black flex flex-col items-center justify-between transition-all duration-150 touch-manipulation select-none cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-b from-amber-400 via-yellow-400 to-amber-500 text-slate-950 border-2 border-yellow-200 shadow-[0_0_15px_rgba(251,191,36,0.7)] scale-105 z-10'
                            : canAfford
                            ? 'bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:border-amber-400/60'
                            : 'bg-slate-950 opacity-40 border border-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={isSelected ? 'text-slate-950 font-black text-xs' : 'text-amber-400 font-bold text-xs'}>
                            Lv{lvlCfg.level}
                          </span>
                          {isSelected && <span className="text-[8px] font-black bg-slate-950 text-amber-300 px-1 rounded">選択</span>}
                        </div>
                        <span className={`text-[10px] font-mono my-0.5 ${isSelected ? 'text-slate-900 font-black' : 'text-slate-300'}`}>
                          {lvlCfg.label}
                        </span>
                        <span className={`text-[9px] font-mono truncate max-w-full ${isSelected ? 'text-slate-950 font-black' : 'text-amber-300'}`}>
                          {formatCurrency(cost)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MAIN PROMINENT INVESTMENT ACTION BUTTON */}
              {(() => {
                const selectedCfg = INVESTMENT_LEVELS.find((i) => i.level === selectedInvestLevel) || INVESTMENT_LEVELS[2];
                const selectedCost = getInvestmentCost(targetProperty.marketPrice, selectedInvestLevel);
                const canAffordSelected = remainingPlayerCash >= selectedCost;

                return (
                  <div className="space-y-1">
                    <button
                      onClick={() => handleInvestCompany(selectedInvestLevel)}
                      disabled={!canAffordSelected || isEnded || finishingPush}
                      className={`w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 touch-manipulation select-none cursor-pointer ${
                        canAffordSelected && !isEnded && !finishingPush
                          ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 shadow-amber-500/30 border border-amber-200'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      <Coins className="w-4 h-4 shrink-0 text-slate-950" />
                      <span>
                        {finishingPush
                          ? '最終押し込み中… WIN到達を確認！'
                          : enemyBudgetExhausted
                          ? `【決着】${formatCurrency(selectedCost)} を積んで押し切る！`
                          : `【Lv${selectedInvestLevel} (${selectedCfg.label})】${formatCurrency(selectedCost)} を出資投入！`}
                      </span>
                    </button>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono px-1">
                      <span title={HELP_TEXT.disposableCash}>追加出資可能額: <strong className="text-emerald-400">{formatCurrency(remainingPlayerCash)}</strong></span>
                      <span>※ダブルタップで直接出資も可能</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 2: SPECIAL TACTICAL COMMAND SKILLS */}
          {activeTab === 'skills' && (
            <div className="space-y-2 flex-1 flex flex-col justify-between">
              <div className="text-xs font-black text-amber-300 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Zap className="w-4 h-4 text-amber-400" />
                  装填中の特殊かけひきコマンド
                </span>
                <span className="text-[10px] text-slate-400">タップで即時発動</span>
              </div>

              {equippedSkills.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-auto">
                  {equippedSkills.map((skill) => {
                    const cd = skillCooldowns[skill.id] || 0;
                    const isCd = cd > 0;

                    return (
                      <button
                        key={skill.id}
                        onClick={() => handleUseSkill(skill)}
                        disabled={isCd || isEnded}
                        title={skill.description}
                        aria-label={`${skill.name}: ${skill.description}`}
                        className={`rs3-button min-h-[52px] p-2 text-xs font-bold flex flex-col items-center justify-center touch-manipulation select-none ${
                          isCd ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95 border-amber-400/60'
                        }`}
                      >
                        <span className="text-yellow-300 font-black text-sm">{skill.name}</span>
                        <span className="text-[10px] text-slate-200 mt-0.5 font-mono">
                          {isCd ? `クールダウン: ${(cd / 1000).toFixed(1)}s` : '⚡ READY (発動可能)'}
                        </span>
                        <span className="text-[9px] text-slate-400 mt-1 leading-tight text-center line-clamp-2">
                          {skill.effectType === 'COOLDOWN_REDUCTION' && '他コマンドの再使用を短縮'}
                          {skill.effectType === 'NEMAWASHI' && '傘下の独立危険度を下げる'}
                          {skill.effectType === 'CAPITAL_BOOST' && '相場30%分を即時に追加'}
                          {skill.effectType === 'SNS_BLITZ' && '敵を揺さぶるが7秒後に反動'}
                          {skill.effectType === 'INDEPENDENCE_SABOTAGE' && '敵の有効防衛資金を削る'}
                          {skill.effectType === 'DEMORALIZE' && '敵の行動を遅らせる'}
                          {skill.effectType === 'SYNERGY_PUSH' && 'ゲージ進行を一時加速'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-slate-400 text-xs py-6">
                  装備されている特殊スキルがありません。「かけひき技」タブで習得・装備できます。
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SUBSIDIARIES & ALLIANCE CAPITAL DEMANDS */}
          {activeTab === 'subs' && (
            <div className="space-y-2 flex-1 flex flex-col justify-between">
              <div className="text-xs font-black text-cyan-300 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  <span title={HELP_TEXT.subsidiaryRequest}>傘下・同盟商会への支援要請</span>
                </span>
                <span className="text-[10px] text-amber-300 font-mono">グループ傘下: {battleSubs.length}社</span>
              </div>

              <div className="space-y-1.5 my-auto">
                {/* Demand ALL subsidiaries at once */}
                {battleSubs.length > 0 && (
                  <button
                    onClick={handleDemandAllSubsidiaries}
                    disabled={isEnded || demandedSubIds.length === battleSubs.length}
                    className="rs3-button-gold min-h-[46px] w-full py-2 px-3 text-xs font-black cursor-pointer active:scale-95 touch-manipulation flex items-center justify-between shadow-lg"
                  >
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-amber-200" />
                      傘下グループ全{battleSubs.length}社一括出資要求！
                    </span>
                    <span className="text-[10px] font-bold bg-amber-950 px-2 py-0.5 rounded text-amber-100 border border-amber-400/50">
                      {demandedSubIds.length === battleSubs.length ? '要求済み' : '一括要求'}
                    </span>
                  </button>
                )}

                {/* Alliance Request */}
                {alliance.active && (
                  <button
                    onClick={handleAllianceRequest}
                    disabled={isEnded || allianceSupportUsed}
                    className="rs3-button min-h-[42px] w-full py-1.5 px-3 text-xs font-bold text-indigo-200 cursor-pointer active:scale-95 touch-manipulation flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                      同盟商会「{alliance.allyName}」特別無償出資
                    </span>
                    <span className="text-yellow-300 font-mono font-bold text-xs shrink-0">
                      {allianceSupportUsed ? '支援済み' : `+${formatCurrency(targetProperty.marketPrice * 0.35)}`}
                    </span>
                  </button>
                )}

                {/* Individual Group Subsidiary Cards */}
                {battleSubs.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto pt-1">
                    {battleSubs.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => handleDemandSubsidiary(sub)}
                        disabled={isEnded || demandedSubIds.includes(sub.id)}
                        className={`rs3-button min-h-[38px] p-1.5 text-left cursor-pointer active:scale-95 touch-manipulation flex items-center justify-between ${demandedSubIds.includes(sub.id) ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <span className="text-[11px] font-bold text-white truncate">{sub.name}</span>
                        <span className="text-[10px] text-yellow-300 font-mono font-bold ml-1 shrink-0">
                          {demandedSubIds.includes(sub.id) ? '要求済み' : `+${formatCurrency(sub.marketPrice * 0.45)}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: AUTOMATIC INVESTMENT ENGINE (AUTO BUYOUT) */}
          {activeTab === 'auto' && (
            <div className="space-y-2 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-emerald-300 flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  自動出資・連続買収エンジン (Auto Invester)
                </span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                  autoInvestActive ? 'bg-emerald-950 text-emerald-300 border-emerald-500 animate-pulse' : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {autoInvestActive ? '● AUTO RUNNING' : 'OFF'}
                </span>
              </div>

              <div className="space-y-2 my-auto">
                <div className="text-xs text-slate-300 flex justify-between items-center">
                  <span>連打投入レベル選択:</span>
                  <span className="font-bold text-yellow-300 font-mono text-[11px]">
                    Lv{autoInvestLevel} (
                    {(INVESTMENT_LEVELS.find((i) => i.level === autoInvestLevel) || INVESTMENT_LEVELS[0]).label}出資
                    : {formatCurrency(getInvestmentCost(targetProperty.marketPrice, autoInvestLevel))})
                  </span>
                </div>

                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setAutoInvestLevel(lvl)}
                      className={`px-3 py-1.5 rounded text-xs font-bold font-mono transition-colors shrink-0 ${
                        autoInvestLevel === lvl
                          ? 'bg-amber-500 text-slate-950 font-black ring-2 ring-amber-300'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Lv{lvl}
                    </button>
                  ))}
                </div>

                {/* Big Auto Invest Toggle Button */}
                <button
                  onClick={() => setAutoInvestActive(!autoInvestActive)}
                  disabled={isEnded}
                  className={`w-full min-h-[50px] py-2 px-4 rounded-lg font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 ${
                    autoInvestActive
                      ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.6)] animate-pulse border-2 border-rose-300'
                      : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-lg hover:brightness-110 border-2 border-emerald-300'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  {autoInvestActive ? '【自動連打買収を停止する】' : '【自動連続出資をスタート！】'}
                </button>
              </div>
            </div>
          )}

          {/* 4 THUMB-FRIENDLY BOTTOM CONTROL TABS */}
          <div className="grid grid-cols-4 gap-1 pt-1 border-t border-slate-800 shrink-0">
            <button
              onClick={() => setActiveTab('company')}
              className={`py-2 px-1 rounded flex flex-col items-center justify-center transition-all touch-manipulation active:scale-95 ${
                activeTab === 'company'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/80 font-black'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Coins className="w-4 h-4 mb-0.5 text-yellow-400" />
              <span className="text-[10px] leading-none font-bold">自社出資</span>
            </button>

            <button
              onClick={() => setActiveTab('skills')}
              className={`py-2 px-1 rounded flex flex-col items-center justify-center transition-all touch-manipulation active:scale-95 ${
                activeTab === 'skills'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/80 font-black'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Zap className="w-4 h-4 mb-0.5 text-amber-400" />
              <span className="text-[10px] leading-none font-bold">かけひき</span>
            </button>

            <button
              onClick={() => setActiveTab('subs')}
              className={`py-2 px-1 rounded flex flex-col items-center justify-center transition-all touch-manipulation active:scale-95 ${
                activeTab === 'subs'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 font-black'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-4 h-4 mb-0.5 text-cyan-400" />
              <span className="text-[10px] leading-none font-bold">傘下要求</span>
            </button>

            <button
              onClick={() => setActiveTab('auto')}
              className={`py-2 px-1 rounded flex flex-col items-center justify-center transition-all touch-manipulation active:scale-95 relative ${
                activeTab === 'auto'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/80 font-black'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4 mb-0.5 text-emerald-400" />
              <span className="text-[10px] leading-none font-bold">自動買収</span>
              {autoInvestActive && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="battle-mobile-dock relative z-40 shrink-0 border-t border-amber-400/40 bg-slate-950/95 px-2 pt-1.5 sm:hidden">
        <div className="mb-1 flex gap-1">
          {[1, 3, 5, 7, 10].map((level) => {
            return (
              <button
                key={level}
                type="button"
                onClick={() => setSelectedInvestLevel(level)}
                aria-pressed={selectedInvestLevel === level}
                className={`min-h-7 flex-1 rounded border px-1 text-[9px] font-black ${selectedInvestLevel === level ? 'border-amber-200 bg-amber-400 text-slate-950' : 'border-slate-700 bg-slate-900 text-slate-300'}`}
              >
                Lv{level}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => handleInvestCompany(selectedInvestLevel)}
          disabled={!canAffordSelectedInvestment || isEnded || finishingPush}
          className={`min-h-12 w-full rounded-xl border px-3 text-sm font-black shadow-lg active:scale-[.98] ${canAffordSelectedInvestment && !isEnded && !finishingPush ? 'border-amber-100 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950' : 'border-slate-700 bg-slate-800 text-slate-500'}`}
        >
          {finishingPush
            ? '最終押し込み中…'
            : enemyBudgetExhausted
            ? `【決着】${formatCurrency(selectedInvestmentCost)}を積んで押し切る`
            : `【Lv${selectedInvestLevel}・${selectedInvestmentConfig.label}】${formatCurrency(selectedInvestmentCost)}を直接出資`}
        </button>
      </div>

      {/* 4. BOTTOM REALTIME TICKER / VICTORY BANNER (32px FIXED) */}
      <div
        onClick={() => setShowLogModal(true)}
        className="battle-bottom-ticker relative z-10 bg-slate-900 px-3 py-1 border-t border-slate-800 flex items-center justify-between shrink-0 h-9 shadow-inner cursor-pointer hover:bg-slate-850 transition-colors"
        title="タップして全戦局ログ一覧を開く"
      >
        {isEnded ? (
          <div
            className={`w-full text-center text-xs font-extrabold flex items-center justify-center gap-2 ${
              winner === 'player' ? 'text-yellow-300 rs3-gold-text' : 'text-rose-400'
            }`}
          >
            {winner === 'player' ? (
              <>
                <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" />
                【買収成功】タップで詳細ログ・決裁画面へ
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-rose-400" />
                【買収失敗】タップで詳細ログ・敗因分析へ
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1.5 text-[10px] text-amber-200 font-mono truncate w-full">
            <div className="flex items-center gap-1.5 truncate">
              <ScrollText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">
                {logs[0]?.message || '出資レベルを選択して市場介入を行ってください'}
              </span>
            </div>
            <span className="text-[9px] text-amber-400/90 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0 font-sans font-bold">
              ログ一覧 ➔
            </span>
          </div>
        )}
      </div>

      {/* BUYOUT OPERATION HELP */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-md">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border-2 border-cyan-500/50 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 p-3.5">
              <div className="flex items-center gap-2">
                <CircleHelp className="h-5 w-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-black text-cyan-200">買収交渉の操作ヘルプ</h3>
                  <p className="text-[10px] text-slate-500">困ったときだけ開く4項目</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="rounded-lg bg-slate-800 p-1.5 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                aria-label="操作ヘルプを閉じる"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 p-3 text-xs sm:grid-cols-2">
              <div className="rounded-xl border border-amber-500/25 bg-amber-950/15 p-3">
                <strong className="mb-1 block text-amber-300">1. 勝利条件</strong>
                <p className="leading-relaxed text-slate-300">まず敵の防衛予算を0にします。0は防衛不能の合図で、まだ勝利ではありません。次の直接出資で最終押し込みが始まり、自社所有率が100%へ届いた瞬間に勝利です。</p>
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-950/15 p-3">
                <strong className="mb-1 block text-amber-300">2. 直接出資</strong>
                <p className="leading-relaxed text-slate-300">{HELP_TEXT.directInvestment}</p>
              </div>
              <div className="rounded-xl border border-teal-500/25 bg-teal-950/15 p-3">
                <strong className="mb-1 block text-teal-300">3. 傘下・同盟支援</strong>
                <p className="leading-relaxed text-slate-300">傘下は各社1回で独立危険度が上昇。同盟も1交渉につき1回だけ使えます。</p>
              </div>
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/15 p-3">
                <strong className="mb-1 block text-cyan-300">4. 相場と風向き</strong>
                <p className="leading-relaxed text-slate-300">市場心理と風向きの倍率が出資効率を変えます。追い風・強気のときが出資の好機です。</p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-3.5 py-3">
              <span className="text-[10px] text-slate-500">仲介手数料3%は、勝敗や撤退にかかわらず戻りません。</span>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-black text-slate-950 transition-colors hover:bg-cyan-400"
              >
                操作へ戻る
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. STRATEGY LOG HISTORY MODAL (戦局・市場行動分析ログモーダル) */}
      {showLogModal && (
        <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl w-full max-w-2xl max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-950 p-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-amber-300 leading-tight">
                    戦局・市場行動分析ログ
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    全 {logs.length} 件の動向履歴（市場変化・敵行動・自社出資）
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowLogModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="bg-slate-950/60 px-3 py-2 border-b border-slate-800 flex items-center gap-1 overflow-x-auto scrollbar-none">
              {(
                [
                  { id: 'ALL', label: 'すべて' },
                  { id: 'market', label: '📈 市場推移' },
                  { id: 'enemy', label: '⚡ 競合行動' },
                  { id: 'player', label: '💰 自社出資' },
                  { id: 'skill', label: '✨ かけひき技' },
                  { id: 'subs', label: '🏢 傘下・同盟' },
                  { id: 'result', label: '🏆 勝敗・結末' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setLogFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                    logFilter === tab.id
                      ? 'bg-amber-500 text-slate-950 font-black shadow'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Log Entries Scroll Area */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2 bg-[#040714] font-mono text-xs">
              {(() => {
                const filteredLogs = logFilter === 'ALL'
                  ? logs
                  : logs.filter((l) => l.category === logFilter);

                if (filteredLogs.length === 0) {
                  return (
                    <div className="text-center text-slate-500 py-12 text-xs">
                      該当するカテゴリのログ履歴がありません。
                    </div>
                  );
                }

                return filteredLogs.map((entry) => {
                  let badgeBg = 'bg-slate-800 text-slate-300 border-slate-700';
                  let textColor = 'text-slate-200';

                  if (entry.category === 'market') {
                    badgeBg = 'bg-cyan-950 text-cyan-300 border-cyan-700';
                    textColor = 'text-cyan-200';
                  } else if (entry.category === 'enemy') {
                    badgeBg = 'bg-rose-950 text-rose-300 border-rose-700';
                    textColor = 'text-rose-200';
                  } else if (entry.category === 'player') {
                    badgeBg = 'bg-amber-950 text-amber-300 border-amber-700';
                    textColor = 'text-amber-200';
                  } else if (entry.category === 'skill') {
                    badgeBg = 'bg-purple-950 text-purple-300 border-purple-700';
                    textColor = 'text-purple-200';
                  } else if (entry.category === 'subs') {
                    badgeBg = 'bg-teal-950 text-teal-300 border-teal-700';
                    textColor = 'text-teal-200';
                  } else if (entry.category === 'result') {
                    badgeBg = 'bg-yellow-950 text-yellow-300 border-yellow-500';
                    textColor = 'text-yellow-100 font-bold';
                  }

                  return (
                    <div
                      key={entry.id}
                      className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 flex items-start gap-2 shadow-sm"
                    >
                      <span className="text-[10px] text-slate-500 shrink-0 mt-0.5 font-mono">
                        {entry.timestamp}
                      </span>
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border shrink-0 ${badgeBg}`}>
                        {entry.category.toUpperCase()}
                      </span>
                      <span className={`text-xs leading-relaxed break-words ${textColor}`}>
                        {entry.message}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div className="bg-slate-950 p-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                ログを確認して攻防戦略の分析・振り返りに活用してください
              </span>
              <button
                onClick={() => setShowLogModal(false)}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer transition-all shadow"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. POST-BATTLE RESULT & STRATEGY REVIEW OVERLAY (勝敗確定・戦略ログ確認モーダル) */}
      {showResultOverlay && (
        <div className="fixed inset-0 z-[110] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border-2 border-amber-500/80 rounded-2xl w-full max-w-2xl my-auto p-4 sm:p-6 space-y-4 shadow-2xl relative overflow-hidden">
            {/* Background Light Glow */}
            <div
              className={`absolute -top-24 -left-24 w-64 h-64 rounded-full blur-3xl pointer-events-none ${
                winner === 'player' ? 'bg-amber-500/20' : 'bg-rose-500/20'
              }`}
            />

            {/* Victory / Defeat Header */}
            <div className="text-center space-y-1 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 border border-amber-500/40 text-xs font-black">
                {winner === 'player' ? (
                  <span className="text-amber-300 flex items-center gap-1">
                    <Trophy className="w-4 h-4 text-yellow-400" /> 買収完遂・勝利！
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-rose-400" /> 買収失敗・撤退
                  </span>
                )}
              </div>

              <h2 className={`text-xl sm:text-2xl font-black ${
                winner === 'player' ? 'text-yellow-300 rs3-gold-text' : 'text-rose-400'
              }`}>
                {winner === 'player'
                  ? `物件『${targetProperty.name}』の買収工作成功！`
                  : `物件『${targetProperty.name}』の買収工作失敗`}
              </h2>

              <p className="text-xs text-slate-300">
                {winner === 'player'
                  ? '敵の防衛資金を枯らし、最後の直接出資で自社所有率100%まで押し切り、買収を成立させました。'
                  : '敵陣営の防衛資金に対抗しきれず撤退。直接出資の75%が撤退損として確定します。'}
              </p>
            </div>

            <section className={`relative z-10 rounded-xl border p-3 ${winner === 'player' ? 'border-emerald-400/35 bg-emerald-950/25' : 'border-rose-400/35 bg-rose-950/25'}`}>
              <div className="mb-2 flex items-center justify-between">
                <strong className={winner === 'player' ? 'text-emerald-300' : 'text-rose-300'}>{winner === 'player' ? 'なぜ勝った？' : 'なぜ負けた？'}</strong>
                <span className="text-[10px] text-slate-400">決着時の3要因</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
                <div className="rounded-lg bg-slate-950/75 p-2">
                  <span className="block text-[9px] text-slate-500">防衛余力</span>
                  <b className={opponentReserve <= 0 ? 'text-emerald-300' : 'text-rose-300'}>{opponentReserve <= 0 ? '敵資金を0にした' : `${formatCurrency(opponentReserve)}残した`}</b>
                </div>
                <div className="rounded-lg bg-slate-950/75 p-2">
                  <span className="block text-[9px] text-slate-500">投入資本差</span>
                  <b className={totalPlayerInvested >= opponentInvested ? 'text-emerald-300' : 'text-rose-300'}>{totalPlayerInvested >= opponentInvested ? '自社が' : '敵が'} {formatCurrency(Math.abs(totalPlayerInvested - opponentInvested))}上回った</b>
                </div>
                <div className="rounded-lg bg-slate-950/75 p-2">
                  <span className="block text-[9px] text-slate-500">決定打</span>
                  <b className="text-amber-300">{winner === 'player' ? '防衛不能後の直接出資' : gauge >= 100 ? '敵圧力がLOSE到達' : '撤退を選択'}</b>
                </div>
              </div>
              {winner === 'player' && playerDemandInvested > playerCompanyInvested && (
                <p className="mt-2 text-[10px] text-cyan-200">補足：自社資金よりグループ・同盟支援の比率が高く、支援資金が主な勝因でした。</p>
              )}
            </section>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">自社総投入額</span>
                <span className="text-sm font-black text-amber-300">
                  {formatCurrency(totalPlayerInvested)}
                </span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">競合対抗額</span>
                <span className="text-sm font-black text-rose-300">
                  {formatCurrency(opponentInvested)}
                </span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block" title={HELP_TEXT.confirmedCost}>今回の確定コスト</span>
                <span className="text-sm font-black text-rose-300">
                  {formatCurrency(brokerageFee + Math.round(playerCompanyInvested * (winner === 'player' ? 0.35 : 0.75)))}
                </span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">買収時の運転資金</span>
                <span className="text-sm font-black text-emerald-300">
                  +{formatCurrency(winner === 'player' ? Math.round(targetProperty.marketPrice * 0.05) : 0)}
                </span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">グループ離脱</span>
                <span className={`text-sm font-black ${rebelledList.length > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                  {rebelledList.length} 件
                </span>
              </div>
            </div>

            {/* Embedded Strategy Log Section (勝手も負けてもログ確認) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-amber-300">
                <span className="flex items-center gap-1.5">
                  <ScrollText className="w-4 h-4 text-amber-400" />
                  【戦略検証】今回の買収戦局・動向ログ一覧
                </span>
                <button
                  onClick={() => setShowLogModal(true)}
                  className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  詳細ログモーダルで開く ➔
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 font-mono text-xs pr-1">
                {logs.map((e) => (
                  <div key={e.id} className="bg-slate-900 p-2 rounded border border-slate-800/80 flex items-start gap-2">
                    <span className="text-[10px] text-slate-500 shrink-0">{e.timestamp}</span>
                    <span className="text-slate-200 text-xs leading-tight">{e.message}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => setShowLogModal(true)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5"
              >
                <ScrollText className="w-4 h-4 text-amber-400" />
                全ログ分析モーダルを開く
              </button>

              <button
                onClick={handleConfirmResult}
                className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 active:scale-95 text-slate-950 font-black text-sm cursor-pointer shadow-lg shadow-amber-500/20 border border-amber-200 transition-all text-center"
              >
                結果を確定して市場に戻る ➔
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

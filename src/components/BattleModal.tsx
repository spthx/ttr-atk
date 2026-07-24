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
import { AllianceState, Property, TacticalSkill } from '../types';
import {
  calculateGaugeVelocity,
  calculateRebellionProbability,
  formatCurrency,
} from '../utils/formatter';
import { soundFx } from '../utils/audio';
import { FANKIT_ART, getFankitJobArt } from '../data/fankitAssets';
import '../battle-buyout.css';

interface BattleModalProps {
  targetProperty: Property;
  totalFunds: number;
  ownedProperties: Property[];
  equippedSkills: TacticalSkill[];
  alliance: AllianceState;
  industryInfluence: { owned: number; total: number; label: string; playerBonus: number; enemyBudgetDiscount: number };
  regionalInfluence: { owned: number; total: number; label: string; playerBonus: number; enemyBudgetDiscount: number };
  tradeNetworkBonus: number;
  nextCommunity?: string | null;
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

type Panel = 'capital' | 'funds' | 'tactics';
type BattleMotion = 'idle' | 'player' | 'enemy' | 'rebel';
type LogCategory = 'system' | 'player' | 'enemy' | 'funds' | 'skill' | 'result';

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
  const rawCount = Math.max(0, Math.ceil((amount / Math.max(marketPrice, 1)) * 42));
  const visibleCount = Math.min(120, rawCount);
  const columns = Math.max(1, Math.min(6, Math.ceil(visibleCount / 20)));

  return (
    <div className={`gil-tower gil-tower--${side} ${motion === side ? 'gil-tower--impact' : ''}`}>
      <div className="gil-tower__coins" aria-label={`${formatCurrency(amount)}を投入済み`}>
        {Array.from({ length: visibleCount }).map((_, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          const offset = column - (columns - 1) / 2;
          return (
            <span
              key={`${side}-${index}`}
              className="gil-coin"
              style={{
                left: `calc(50% + ${offset * 14}px)`,
                bottom: `${row * 5}px`,
                zIndex: row + 1,
                rotate: `${(index % 3 - 1) * 3}deg`,
              }}
            >
              <b>G</b>
            </span>
          );
        })}
      </div>
      <strong>{formatCurrency(amount)}</strong>
      <small>{rawCount > 120 ? `資金札 ${rawCount}枚相当` : `資金札 ${rawCount}枚`}</small>
    </div>
  );
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
  nextCommunity = null,
  isTutorial = false,
  onBattleEnd,
  onClose,
}) => {
  const brokerageFee = Math.round(targetProperty.marketPrice * 0.03);
  const influenceBonus = industryInfluence.playerBonus + regionalInfluence.playerBonus + tradeNetworkBonus;
  const enemyBudget = useMemo(() => {
    const price = targetProperty.marketPrice;
    const rankFactor = price >= 20_000_000 ? 1.05 : price >= 1_000_000 ? 0.82 : price >= 200_000 ? 0.68 : 0.54;
    const defenseDiscount = Math.min(0.3, industryInfluence.enemyBudgetDiscount + regionalInfluence.enemyBudgetDiscount);
    return Math.round(price * (rankFactor + (targetProperty.isCartelHQ ? 0.3 : 0)) * (1 - defenseDiscount));
  }, [industryInfluence.enemyBudgetDiscount, regionalInfluence.enemyBudgetDiscount, targetProperty]);

  const initialEnemyCommitment = Math.round(enemyBudget * 0.42);
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
  const [panel, setPanel] = useState<Panel>('capital');
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [commandProgress, setCommandProgress] = useState(100);
  const [fastHorse, setFastHorse] = useState(false);
  const [enemySlowed, setEnemySlowed] = useState(false);
  const [enemyDisruption, setEnemyDisruption] = useState(0);
  const [pushMultiplier, setPushMultiplier] = useState(1);
  const [skillCooldowns, setSkillCooldowns] = useState<Record<string, number>>({});
  const [motion, setMotion] = useState<BattleMotion>('idle');
  const [statusText, setStatusText] = useState('競り値が拮抗。命令を選んでギルを積んでください');
  const [aiText, setAiText] = useState('競合は次の資金投入を検討中');
  const [aiProgress, setAiProgress] = useState(0);
  const [winner, setWinner] = useState<'player' | 'opponent' | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [floaters, setFloaters] = useState<FloatingGil[]>([]);
  const [logs, setLogs] = useState<BattleLog[]>([
    { id: 'start', category: 'system', text: `${targetProperty.name}の買収劇開始。競合は${formatCurrency(initialEnemyCommitment)}を先に積みました。` },
  ]);
  const endedRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const lastTickRef = useRef(performance.now());

  const totalPlayerInvested = companyInvested + demandInvested;
  const ownership = Math.max(0, Math.min(100, (100 - gauge) / 2));
  const commandReady = commandProgress >= 100;
  const selectedCost = getInvestmentCost(targetProperty.marketPrice, selectedLevel);
  const capitalGap = totalPlayerInvested - enemyInvested;

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

  const addLog = (text: string, category: LogCategory = 'system') => {
    setLogs((current) => [{ id: `${Date.now()}-${Math.random()}`, category, text }, ...current].slice(0, 100));
  };

  const showFloater = (text: string, side: FloatingGil['side']) => {
    const id = Date.now() + Math.random();
    setFloaters((current) => [...current, { id, text, side }]);
    window.setTimeout(() => setFloaters((current) => current.filter((item) => item.id !== id)), 950);
  };

  const playMotion = (next: BattleMotion) => {
    setMotion(next);
    window.setTimeout(() => setMotion('idle'), 520);
  };

  const consumeCommand = () => {
    if (!commandReady || endedRef.current) {
      soundFx.playWarning();
      return false;
    }
    setCommandProgress(0);
    return true;
  };

  const finishBattle = (result: 'player' | 'opponent') => {
    if (endedRef.current) return;
    endedRef.current = true;
    setWinner(result);
    setStatusText(result === 'player' ? '所有率100%――買収成立！' : '所有率0%――買収失敗');
    addLog(result === 'player' ? `${targetProperty.name}を押し切り、買収成立！` : '競合に押し切られ、買収失敗。', 'result');
    if (result === 'player') {
      soundFx.playVictory();
      confetti({ particleCount: 140, spread: 95, origin: { y: 0.48 } });
    } else {
      soundFx.playDefeat();
    }
    window.setTimeout(() => setShowResult(true), 1700);
  };

  const commitEnemyFunds = (requested: number, reason: string) => {
    const actual = Math.max(0, Math.min(Math.round(requested), enemyReserveRef.current));
    if (actual <= 0) {
      setAiText('防衛資金なし――反撃不能');
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
    enemyReserveRef.current -= actual;
    setEnemyReserve(enemyReserveRef.current);
    setEnemyInvested((value) => value + actual);
    setStatusText(`競合が${formatCurrency(actual)}を対抗投入`);
    setAiText(enemyReserveRef.current > 0 ? '対抗資金を再準備中' : '防衛資金なし――反撃不能');
    showFloater(`+${formatCurrency(actual)}`, 'enemy');
    playMotion('enemy');
    soundFx.playCapitalImpact('opponent', actual / Math.max(targetProperty.marketPrice, 1));
    addLog(`${reason}として${formatCurrency(actual)}を投入。残予算${formatCurrency(enemyReserveRef.current)}。`, 'enemy');
  };

  useEffect(() => {
    if (winner) return;
    const interval = window.setInterval(() => {
      setCommandProgress((value) => Math.min(100, value + (fastHorse ? 5 : 2.8)));
      setSkillCooldowns((current) => {
        let changed = false;
        const next = { ...current };
        Object.keys(next).forEach((key) => {
          if (next[key] > 0) {
            next[key] = Math.max(0, next[key] - 50);
            changed = true;
          }
        });
        return changed ? next : current;
      });
    }, 50);
    return () => window.clearInterval(interval);
  }, [fastHorse, winner]);

  useEffect(() => {
    if (winner) return;
    const duration = enemySlowed ? 4500 : isTutorial ? 3600 : targetProperty.isCartelHQ ? 2200 : 2900;
    const step = 100 / (duration / 100);
    const interval = window.setInterval(() => {
      setAiProgress((value) => {
        const next = value + step;
        if (next < 100) return next;
        const pressure = totalPlayerInvested - enemyInvested;
        const ratio = pressure > targetProperty.marketPrice * 0.25 ? 0.2 : pressure < 0 ? 0.08 : 0.13;
        commitEnemyFunds(targetProperty.marketPrice * ratio, pressure > 0 ? '競合の緊急防衛' : '競合の追撃');
        return 0;
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [enemyInvested, enemySlowed, isTutorial, targetProperty.isCartelHQ, targetProperty.marketPrice, totalPlayerInvested, winner, enemyDisruption]);

  useEffect(() => {
    if (winner) return;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      const velocity = calculateGaugeVelocity(
        totalPlayerInvested,
        enemyInvested,
        targetProperty.marketPrice,
        pushMultiplier * (1 + influenceBonus)
      );
      setGaugeSpeed(velocity);
      setGauge((value) => {
        const next = value + velocity * dt * 5.2;
        if (next <= -100) {
          finishBattle('player');
          return -100;
        }
        if (next >= 100) {
          finishBattle('opponent');
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
  }, [enemyInvested, influenceBonus, pushMultiplier, targetProperty.marketPrice, totalPlayerInvested, winner]);

  const investCompanyFunds = () => {
    if (!consumeCommand()) return;
    if (cash < selectedCost) {
      setCommandProgress(100);
      soundFx.playWarning();
      setStatusText(`自社資金不足。必要額は${formatCurrency(selectedCost)}`);
      return;
    }
    setCash((value) => value - selectedCost);
    setCompanyInvested((value) => value + selectedCost);
    setStatusText(`自社資金から${formatCurrency(selectedCost)}を積み増し`);
    showFloater(`+${formatCurrency(selectedCost)}`, 'player');
    playMotion('player');
    soundFx.playCapitalImpact('player', selectedLevel / 5);
    addLog(`自社資金${formatCurrency(selectedCost)}を直接投入。`, 'player');
  };

  const demandFromProperty = (property: Property) => {
    if (!consumeCommand()) return;
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
    setStatusText(`${property.name}から${formatCurrency(amount)}を調達。独立危険度${nextRisk}%`);
    showFloater(`+${formatCurrency(amount)}`, 'player');
    playMotion('player');
    soundFx.playBigCash();
    addLog(`${property.name}へ第${(subRequestCounts[property.id] || 0) + 1}次資金要求。${formatCurrency(amount)}を調達、独立危険度${nextRisk}%。`, 'funds');
  };

  const demandFromGroup = (key: string, name: string, members: Property[]) => {
    if (!consumeCommand()) return;
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
      setFastHorse(true);
      window.setTimeout(() => setFastHorse(false), 10_000);
      setStatusText('早馬発動――10秒間、タタルの命令待ち時間が半減');
    } else if (skill.effectType === 'NEMAWASHI') {
      setBattleSubs((current) => current.map((item) => ({ ...item, loyaltyRisk: Math.floor(item.loyaltyRisk / 2) })));
      setStatusText('ネマワシ成功――全傘下の独立危険度が半減');
    } else if (skill.effectType === 'INDEPENDENCE_SABOTAGE') {
      setEnemyDisruption(0.7);
      window.setTimeout(() => setEnemyDisruption(0), 9000);
      setStatusText('物件独立工作――9秒間、敵の資金源離脱を狙う');
    } else if (skill.effectType === 'DEMORALIZE') {
      setEnemySlowed(true);
      window.setTimeout(() => setEnemySlowed(false), 9000);
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
      setPushMultiplier(2);
      window.setTimeout(() => setPushMultiplier(1), 7000);
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
    });
  };

  const resultAnalysis = winner === 'player'
    ? demandInvested > companyInvested
      ? `勝因は交易網です。傘下・同盟から集めた${formatCurrency(demandInvested)}が競り値を押し上げ、最後まで優勢を維持しました。`
      : `勝因は自社資金の決断です。競合を${formatCurrency(Math.max(0, capitalGap))}上回るまでギルを積み、所有率100%まで押し切りました。`
    : rebelled.length > 0
      ? `${rebelled.length}社の独立で資金の山が崩れました。次は赤い資金源へ要求する前にネマワシを使うべきです。`
      : `競合の競り値を${formatCurrency(Math.max(0, -capitalGap))}下回ったため、所有率を押し戻されました。`;

  return (
    <div className="buyout-screen">
      <img className="buyout-backdrop" src={FANKIT_ART.battleBackdrop} alt="" aria-hidden="true" />
      <header className="buyout-header">
        <div>
          <span>ACTIVE BUYOUT</span>
          <strong>{targetProperty.name}</strong>
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
            <b>タタル商会 {ownership.toFixed(1)}%</b>
            <span className={gaugeSpeed < -0.02 ? 'push-player' : gaugeSpeed > 0.02 ? 'push-enemy' : ''}>
              {gaugeSpeed < -0.02 ? '▶ ギル差で買収推進中' : gaugeSpeed > 0.02 ? '◀ 競合が押し返し中' : '◆ 競り値拮抗'}
            </span>
            <b>競合 {(100 - ownership).toFixed(1)}%</b>
          </div>
          <div className="ownership-track" aria-label={`自社所有率${ownership.toFixed(1)}%`}>
            <div className="ownership-track__player" style={{ width: `${ownership}%` }} />
            <div className="ownership-track__marker" style={{ left: `${ownership}%` }} />
            <img className={`ownership-avatar ownership-avatar--player ${motion === 'player' ? 'avatar-attack' : ''}`} src={FANKIT_ART.tataru.windUp} alt="タタル" />
            <img className={`ownership-avatar ownership-avatar--enemy ${motion === 'enemy' ? 'avatar-hit' : ''}`} src={getFankitJobArt(targetProperty.industry)} alt="競合代表" />
          </div>
          <p className={motion === 'rebel' ? 'status-rebel' : ''}>{statusText}</p>
        </section>

        <section className="capital-arena">
          <div className="capital-arena__side">
            <span>自社の競り値</span>
            <GilTower amount={totalPlayerInvested} marketPrice={targetProperty.marketPrice} side="player" motion={motion} />
            <small>自社 {formatCurrency(companyInvested)} / 支援 {formatCurrency(demandInvested)}</small>
          </div>
          <div className="capital-arena__center">
            <Swords />
            <strong>{capitalGap >= 0 ? '自社優勢' : '競合優勢'}</strong>
            <b>{formatCurrency(Math.abs(capitalGap))}差</b>
            {enemyReserve <= 0 && <em>敵の追加予算なし</em>}
          </div>
          <div className="capital-arena__side">
            <span>競合の競り値</span>
            <GilTower amount={enemyInvested} marketPrice={targetProperty.marketPrice} side="enemy" motion={motion} />
            <small>残り防衛予算 {formatCurrency(enemyReserve)}</small>
          </div>
          {floaters.map((item) => <i key={item.id} className={`gil-floater gil-floater--${item.side}`}>{item.text}</i>)}
        </section>

        <section className="active-time">
          <div>
            <TimerReset />
            <span>{commandReady ? 'COMMAND READY' : fastHorse ? '早馬で命令伝達中' : '次の命令を伝達中'}</span>
          </div>
          <div className="active-time__bar"><i style={{ width: `${commandProgress}%` }} /></div>
          <div className="active-time__enemy">
            <span>{aiText}</span>
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
                    <button type="button" key={item.level} className={selectedLevel === item.level ? 'selected' : ''} onClick={() => setSelectedLevel(item.level)}>
                      <small>{item.label}</small><b>{formatCurrency(cost)}</b>
                    </button>
                  );
                })}
              </div>
              <button type="button" className="command-primary" onClick={investCompanyFunds} disabled={!commandReady || cash < selectedCost || !!winner}>
                <HandCoins /><span>{commandReady ? `${formatCurrency(selectedCost)}を積む` : '命令待ち…'}</span>
              </button>
              <p>可処分資金 {formatCurrency(cash)}　／　資金差だけが所有率を動かします</p>
            </div>
          )}

          {panel === 'funds' && (
            <div className="command-panel command-panel--funds">
              {groups.length > 0 && (
                <div className="group-funds">
                  {groups.map((group) => (
                    <button type="button" key={group.key} onClick={() => demandFromGroup(group.key, group.name, group.members)} disabled={!commandReady || !!winner}>
                      <Sparkles /><span><b>{group.name}</b><small>{group.members.length}社・大口資金</small></span>
                    </button>
                  ))}
                </div>
              )}
              {alliance.active && (
                <button type="button" className="alliance-fund" onClick={requestAlliance} disabled={!commandReady || allianceUsed || !!winner}>
                  <Users /><span>{alliance.allyName}</span><b>{allianceUsed ? '要請済み' : `+${formatCurrency(targetProperty.marketPrice * 0.32)}`}</b>
                </button>
              )}
              <div className="property-funds">
                {battleSubs.map((property) => {
                  const risk = riskPresentation(property.loyaltyRisk);
                  return (
                    <button type="button" key={property.id} onClick={() => demandFromProperty(property)} disabled={!commandReady || !!winner}>
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
                  <button type="button" key={skill.id} onClick={() => useSkill(skill)} disabled={!commandReady || cooldown > 0 || !!winner} title={skill.description}>
                    <Zap /><span><b>{skill.name}</b><small>{skill.description}</small></span><em>{cooldown > 0 ? `${(cooldown / 1000).toFixed(1)}秒` : 'READY'}</em>
                  </button>
                );
              })}
              {equippedSkills.length === 0 && <p className="empty-funds">装備中のかけひき技がありません。</p>}
            </div>
          )}
        </section>
      </main>

      <footer className="buyout-footer">
        <button type="button" onClick={() => setShowLog(true)}><ScrollText />戦局ログ</button>
        <span>{logs[0]?.text}</span>
        <button type="button" onClick={() => finishBattle('opponent')}>撤退</button>
      </footer>

      {showHelp && (
        <div className="buyout-overlay">
          <article className="buyout-dialog">
            <header><CircleHelp /><strong>買収劇の遊び方</strong><button type="button" onClick={() => setShowHelp(false)}><X /></button></header>
            <ol>
              <li><b>ギルを積む</b><span>自社・傘下・交易グループから資金を集めます。</span></li>
              <li><b>競り値差を見る</b><span>自社の累積ギルが多いほど、所有率が連続して自社側へ進みます。</span></li>
              <li><b>命令を待つ</b><span>一手ごとに命令待ち時間があります。その間にも競合は反撃します。</span></li>
              <li><b>独立リスクを選ぶ</b><span>同じ傘下へ何度でも要求できますが、危険度が上がり、独立すると過去の資金も崩れます。</span></li>
              <li><b>端まで押し切る</b><span>敵予算0では決着しません。所有率100%を実際に確認して買収成立です。</span></li>
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

      {showResult && winner && (
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
              <span><small>自社競り値</small><b>{formatCurrency(totalPlayerInvested)}</b></span>
              <span><small>競合競り値</small><b>{formatCurrency(enemyInvested)}</b></span>
              <span><small>資金源離脱</small><b>{rebelled.length}社</b></span>
            </div>
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

import React, { useState, useEffect, useMemo } from 'react';
import {
  Property,
  TacticalSkill,
  GroupSynergy,
  Cartel,
  AllianceState,
  GameLog,
  CommunityType,
} from './types';
import {
  INITIAL_PROPERTIES,
  INITIAL_SKILLS,
  INITIAL_GROUP_SYNERGIES,
  INITIAL_CARTELS,
} from './data/initialData';
import { formatCurrency } from './utils/formatter';
import { soundFx } from './utils/audio';

import { Header } from './components/Header';
import { MarketView } from './components/MarketView';
import { PortfolioView } from './components/PortfolioView';
import { SkillsSynergyView } from './components/SkillsSynergyView';
import { CartelAllianceView } from './components/CartelAllianceView';
import { BattleModal } from './components/BattleModal';
import { TatarAdvisor } from './components/TatarAdvisor';
import { LaunchIntro } from './components/LaunchIntro';
import { FANKIT_ART } from './data/fankitAssets';
import { COMMUNITY_CAMPAIGN_ORDER, GAME_WORLD, TRADE_COMMUNITIES } from './data/worldData';
import { Bell, MapPinned } from 'lucide-react';

export default function App() {
  // --- Game Core State ---
  const [totalFunds, setTotalFunds] = useState<number>(50_000); // Initial 50k capital for smooth gameplay
  const [properties, setProperties] = useState<Property[]>(INITIAL_PROPERTIES);
  const [skills, setSkills] = useState<TacticalSkill[]>(INITIAL_SKILLS);
  const [equippedSkillIds, setEquippedSkillIds] = useState<string[]>([
    'skill_fast_horse',
    'skill_nemawashi',
    'skill_capital_boost',
    'skill_sns_blitz',
  ]);
  const [groupSynergies, setGroupSynergies] =
    useState<GroupSynergy[]>(INITIAL_GROUP_SYNERGIES);
  const [cartels, setCartels] = useState<Cartel[]>(INITIAL_CARTELS);
  const [alliance, setAlliance] = useState<AllianceState>({
    allyId: '',
    allyName: '',
    active: false,
  });

  // UI States
  const [activeTab, setActiveTab] = useState<'market' | 'portfolio' | 'skills' | 'cartels'>('market');
  const [activeBattleProperty, setActiveBattleProperty] = useState<Property | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [companyName, setCompanyName] = useState<string>(GAME_WORLD.companyName);
  const [showLaunchIntro, setShowLaunchIntro] = useState(true);
  const [unlockNotice, setUnlockNotice] = useState<CommunityType | null>(null);

  useEffect(() => {
    const savedName = window.localStorage.getItem('tataru-company-name');
    if (savedName) setCompanyName(savedName);
  }, []);

  const completeLaunchIntro = () => {
    const normalizedName = companyName.trim() || GAME_WORLD.companyName;
    setCompanyName(normalizedName);
    window.localStorage.setItem('tataru-company-name', normalizedName);
    soundFx.playBigCash();
    setShowLaunchIntro(false);
  };

  const addGameLog = (
    message: string,
    type: 'info' | 'success' | 'warning' | 'danger' = 'info'
  ) => {
    const newLog: GameLog = {
      id: Math.random().toString(),
      timestamp: new Date().toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      message,
      type,
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 19)]);
  };

  // Compute Owned Properties & Synergy Multipliers
  const ownedProperties = useMemo(() => {
    return properties.filter((p) => p.owner === 'player');
  }, [properties]);

  const ownedPropertyIds = useMemo(() => {
    return new Set(ownedProperties.map((p) => p.id));
  }, [ownedProperties]);

  const communityProgress = useMemo(() => {
    return TRADE_COMMUNITIES.map((community) => {
      const communityProperties = properties.filter(
        (property) => property.community === community.id
      );
      const owned = communityProperties.filter(
        (property) => property.owner === 'player'
      ).length;

      return {
        ...community,
        owned,
        total: communityProperties.length,
        conquered:
          communityProperties.length > 0 && owned === communityProperties.length,
      };
    });
  }, [properties]);

  const conqueredCommunityCount = communityProgress.filter(
    (community) => community.conquered
  ).length;

  const unlockedCommunityIds = useMemo(() => {
    const unlocked = new Set<CommunityType>();
    COMMUNITY_CAMPAIGN_ORDER.forEach((communityId, index) => {
      const priorCitiesConquered = COMMUNITY_CAMPAIGN_ORDER
        .slice(0, index)
        .every((priorId) => communityProgress.find((city) => city.id === priorId)?.conquered);
      if (index === 0 || priorCitiesConquered) unlocked.add(communityId);
    });
    return unlocked;
  }, [communityProgress]);

  useEffect(() => {
    if (!unlockNotice) return;
    const timer = window.setTimeout(() => setUnlockNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [unlockNotice]);

  // 業界掌握の第一段階。保有数に応じて、同業界の買収を少し有利にする。
  const industryInfluence = useMemo(() => {
    const result: Record<string, { owned: number; total: number; label: string; playerBonus: number; enemyBudgetDiscount: number }> = {};
    properties.forEach((property) => {
      const current = result[property.industry] || { owned: 0, total: 0, label: '未進出', playerBonus: 0, enemyBudgetDiscount: 0 };
      current.total += 1;
      if (property.owner === 'player') current.owned += 1;
      result[property.industry] = current;
    });
    Object.values(result).forEach((entry) => {
      const ratio = entry.owned / entry.total;
      if (entry.owned >= 2 && ratio < 0.4) entry.label = '顔が利く';
      if (entry.owned >= 3 || ratio >= 0.4) {
        entry.label = '影響力';
        entry.playerBonus = 0.05;
      }
      if (ratio > 0.5) {
        entry.label = '業界掌握';
        entry.playerBonus = 0.1;
        entry.enemyBudgetDiscount = 0.1;
      }
    });
    return result;
  }, [properties]);

  // Active Synergies Count & Bonus Multiplier
  const { activeSynergiesCount, bonusMultiplier } = useMemo(() => {
    let count = 0;
    let mult = 1.0;

    groupSynergies.forEach((syn) => {
      const allOwned = syn.requiredPropertyIds.every((id) =>
        ownedPropertyIds.has(id)
      );
      if (allOwned) {
        count++;
        mult *= syn.bonusYieldMultiplier;
      }
    });

    return { activeSynergiesCount: count, bonusMultiplier: mult };
  }, [groupSynergies, ownedPropertyIds]);

  // Total Passive Revenue Yield per second (I_net)
  const passiveRevenue = useMemo(() => {
    const base = ownedProperties.reduce((sum, p) => sum + p.annualRevenue, 0);
    return Math.round(base * bonusMultiplier);
  }, [ownedProperties, bonusMultiplier]);

  // IDLE CASH HARVEST ENGINE (1 Second Ticker)
  useEffect(() => {
    const timer = setInterval(() => {
      if (passiveRevenue > 0) {
        setTotalFunds((prev) => prev + passiveRevenue);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [passiveRevenue]);

  // Handlers
  const handleStartBuyout = (property: Property) => {
    if (!unlockedCommunityIds.has(property.community)) {
      soundFx.playWarning();
      addGameLog(`【航路未開通】${property.community}へ進むには、手前の都市を制覇してください。`, 'warning');
      setActiveTab('market');
      return;
    }
    soundFx.playCoin();
    setActiveBattleProperty(property);
  };

  // Battle Resolution Handler
  const handleBattleEnd = ({
    winner,
    targetProperty,
    companyFundsInvested,
    demandFundsInvested,
    brokerageFee,
    settlementCost,
    battleCashDelta,
    victoryReward,
    rebelledProperties,
  }: {
    winner: 'player' | 'opponent';
    targetProperty: Property;
    companyFundsInvested: number;
    demandFundsInvested: number;
    brokerageFee: number;
    settlementCost: number;
    battleCashDelta: number;
    victoryReward: number;
    rebelledProperties: Property[];
  }) => {
    // 仲介手数料に加え、直接出資の一部が買収費用・撤退損として確定する。
    setTotalFunds((prev) => Math.max(0, prev - brokerageFee - settlementCost + battleCashDelta + (winner === 'player' ? victoryReward : 0)));

    if (winner === 'player') {
      const conquersCity = properties
        .filter((property) => property.community === targetProperty.community)
        .every((property) => property.owner === 'player' || property.id === targetProperty.id);
      const campaignIndex = COMMUNITY_CAMPAIGN_ORDER.indexOf(targetProperty.community);
      const nextCommunity = COMMUNITY_CAMPAIGN_ORDER[campaignIndex + 1];
      if (conquersCity && nextCommunity) setUnlockNotice(nextCommunity);

      // Transfer target property ownership to player
      setProperties((prev) =>
        prev.map((p) =>
          p.id === targetProperty.id
            ? { ...p, owner: 'player', ownerName: companyName, loyaltyRisk: 0 }
            : p
        )
      );

      addGameLog(
        `【買収成功】${targetProperty.name} を買収し、自社の保有物件に加えました！（手数料 ${formatCurrency(
          brokerageFee + settlementCost
        )} 消費、運転資金 ${formatCurrency(victoryReward)} を獲得）`,
        'success'
      );

      // Check if this property belonged to an enemy alliance - breaks alliance if attacked
      if (
        alliance.active &&
        targetProperty.ownerName.includes(alliance.allyName)
      ) {
        setAlliance({ allyId: '', allyName: '', active: false });
        addGameLog(
          `【同盟破棄】同盟企業の所有物件を攻めたため、${alliance.allyName} との同盟が永久破棄されました！`,
          'danger'
        );
      }
    } else {
      addGameLog(
        `【買収敗北】${targetProperty.name} の買収に失敗しました。（手数料 ${formatCurrency(
          brokerageFee + settlementCost
        )} 消費、直接出資の精算 ${formatCurrency(settlementCost)}）`,
        'warning'
      );
    }

    // 2. Handle Rebellion & Strategic Bankruptcy Liquidation Cashback
    if (rebelledProperties.length > 0) {
      let totalCashback = 0;

      const rebelIds = new Set(rebelledProperties.map((r) => r.id));

      setProperties((prev) =>
        prev.map((p) => {
          if (rebelIds.has(p.id)) {
            totalCashback += p.marketPrice;
            return {
              ...p,
              owner: 'independent',
              ownerName: '独立物件',
              loyaltyRisk: 0,
            };
          }
          return p;
        })
      );

      // Add forced liquidation cashback to player funds!
      setTotalFunds((prev) => prev + totalCashback);

      rebelledProperties.forEach((rebel) => {
        addGameLog(
          `【独立発生 & 強制清算】${rebel.name} の不満が高まり独立離脱しました！現在評価価値 ${formatCurrency(
            rebel.marketPrice
          )} が即座に自社へ一括返金されました。`,
          'warning'
        );
      });
    }

    setActiveBattleProperty(null);
  };

  // Reduce Loyalty Risk (Nemawashi) for single property
  const handleReduceLoyaltyRisk = (
    propertyId: string,
    amount: number,
    cost: number
  ) => {
    setTotalFunds((prev) => prev - cost);
    setProperties((prev) =>
      prev.map((p) =>
        p.id === propertyId
          ? { ...p, loyaltyRisk: Math.max(0, p.loyaltyRisk - amount) }
          : p
      )
    );
    addGameLog(
      `【ネマワシ完了】物件の独立危険度を -${amount} 減算しました（コスト ${formatCurrency(
        cost
      )}）`,
      'info'
    );
  };

  // Global Nemawashi
  const handleGlobalNemawashi = () => {
    const totalAssetVal = ownedProperties.reduce(
      (sum, p) => sum + p.marketPrice,
      0
    );
    const cost = Math.round(totalAssetVal * 0.02);

    if (totalFunds < cost) return;

    setTotalFunds((prev) => prev - cost);
    setProperties((prev) =>
      prev.map((p) =>
        p.owner === 'player'
          ? { ...p, loyaltyRisk: Math.max(0, p.loyaltyRisk - 30) }
          : p
      )
    );

    addGameLog(
      `【全傘下一括ネマワシ】全所有物件の独立危険度を -30 一括減算しました（費用 ${formatCurrency(
        cost
      )}）`,
      'info'
    );
  };

  // Toggle skill equip
  const handleToggleEquipSkill = (skillId: string) => {
    setEquippedSkillIds((prev) => {
      if (prev.includes(skillId)) {
        return prev.filter((id) => id !== skillId);
      } else {
        if (prev.length >= 8) return prev;
        return [...prev, skillId];
      }
    });
  };

  // Alliance management
  const handleFormAlliance = (allyName: string) => {
    setAlliance({ allyId: 'garland_ironworks', allyName, active: true });
    addGameLog(`【アライアンス締結】${allyName} との同盟が成立しました！`, 'success');
  };

  const handleBreakAlliance = () => {
    setAlliance({ allyId: '', allyName: '', active: false });
    addGameLog(`【アライアンス破棄】同盟関係を解消しました。`, 'info');
  };

  // Debug / Test Fund Handlers
  const handleAddFunds = (amount: number = 100_000_000) => {
    setTotalFunds((prev) => prev + amount);
    addGameLog(`🧪 【テスト機能】資金に +${formatCurrency(amount)} を追加補充しました。`, 'info');
  };

  const handleResetFunds = () => {
    setTotalFunds(50_000);
    addGameLog(`🔄 【テスト機能】資金を初期値 50,000ギル にリセットしました。`, 'warning');
  };

  // Equipped skills object array
  const equippedSkills = useMemo(() => {
    return skills.filter((s) => equippedSkillIds.includes(s.id));
  }, [skills, equippedSkillIds]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 flex flex-col">
      {showLaunchIntro && (
        <LaunchIntro companyName={companyName} onCompanyNameChange={setCompanyName} onComplete={completeLaunchIntro} />
      )}

      {/* Header & Metric Navigation */}
      <Header
        companyName={companyName}
        totalFunds={totalFunds}
        passiveRevenue={passiveRevenue}
        ownedCount={ownedProperties.length}
        totalPropertyCount={properties.length}
        conqueredCommunityCount={conqueredCommunityCount}
        totalCommunityCount={TRADE_COMMUNITIES.length}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAllianceName={alliance.active ? alliance.allyName : null}
        activeSynergiesCount={activeSynergiesCount}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        onAddFunds={handleAddFunds}
        onResetFunds={handleResetFunds}
      />

      {/* Main View Area */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-3 pb-20 md:py-6 md:pb-6 flex-1 space-y-4 md:space-y-6">
        {activeTab !== 'market' && (
          <TatarAdvisor
            activeTab={activeTab}
            ownedCount={ownedProperties.length}
            conqueredCommunityCount={conqueredCommunityCount}
            totalCommunityCount={TRADE_COMMUNITIES.length}
          />
        )}

        {activeTab === 'market' && (
          <MarketView
            properties={properties}
            totalFunds={totalFunds}
            unlockedCommunityIds={unlockedCommunityIds}
            onStartBuyout={handleStartBuyout}
          />
        )}

        {activeTab === 'portfolio' && (
          <PortfolioView
            companyName={companyName}
            properties={properties}
            totalFunds={totalFunds}
            onReduceLoyaltyRisk={handleReduceLoyaltyRisk}
            onGlobalNemawashi={handleGlobalNemawashi}
          />
        )}

        {activeTab === 'skills' && (
          <SkillsSynergyView
            skills={skills}
            equippedSkillIds={equippedSkillIds}
            groupSynergies={groupSynergies}
            ownedProperties={ownedProperties}
            onToggleEquipSkill={handleToggleEquipSkill}
          />
        )}

        {activeTab === 'cartels' && (
          <CartelAllianceView
            companyName={companyName}
            cartels={cartels}
            properties={properties}
            alliance={alliance}
            onFormAlliance={handleFormAlliance}
            onBreakAlliance={handleBreakAlliance}
            onStartBuyout={handleStartBuyout}
          />
        )}

        {/* Global Game Notification Log Bar */}
        {logs.length > 0 && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Bell className="w-4 h-4 text-amber-400" />
              <span>システム運営アクティビティログ</span>
            </div>

            <div className="space-y-1.5 max-h-32 overflow-y-auto font-mono text-xs text-slate-300 scrollbar-thin pr-1">
              {logs.map((log) => {
                let badgeClass = 'text-slate-400';
                if (log.type === 'success') badgeClass = 'text-emerald-400 font-bold';
                if (log.type === 'warning') badgeClass = 'text-amber-400 font-bold';
                if (log.type === 'danger') badgeClass = 'text-rose-400 font-bold';

                return (
                  <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-[10px] text-slate-500 shrink-0">
                      [{log.timestamp}]
                    </span>
                    <span className={badgeClass}>{log.message}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {unlockNotice && (
        <button type="button" onClick={() => setUnlockNotice(null)} className="city-unlock fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/90 p-5 text-left">
          <span className="city-unlock__card relative block w-full max-w-xl overflow-hidden rounded-2xl border border-amber-300/60 bg-slate-900 p-7 shadow-2xl">
            <img src={FANKIT_ART.marketBackdrop} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-25" />
            <span className="relative z-10 block text-[10px] font-black tracking-[.3em] text-cyan-300">NEW TRADE ROUTE</span>
            <span className="relative z-10 mt-2 flex items-center gap-2 text-3xl font-black text-white"><MapPinned className="h-7 w-7 text-amber-300" /> {unlockNotice}</span>
            <span className="relative z-10 mt-3 block text-sm text-slate-200">前の都市を制覇し、新たな交易都市への航路が開通しました。</span>
            <span className="relative z-10 mt-5 inline-block rounded-lg bg-amber-400 px-4 py-2 text-xs font-black text-slate-950">都市マップへ進む</span>
          </span>
        </button>
      )}

      {/* Real-time Buyout Battle Modal */}
      {activeBattleProperty && (
        <BattleModal
          targetProperty={activeBattleProperty}
          totalFunds={totalFunds}
          ownedProperties={ownedProperties}
          equippedSkills={equippedSkills}
          alliance={alliance}
          industryInfluence={industryInfluence[activeBattleProperty.industry] || { owned: 0, total: 0, label: '未進出', playerBonus: 0, enemyBudgetDiscount: 0 }}
          isTutorial={ownedProperties.length === 0 && activeBattleProperty.id.startsWith('prop_starter_')}
          onAddFunds={handleAddFunds}
          onResetFunds={handleResetFunds}
          onBattleEnd={handleBattleEnd}
          onClose={() => {
            setActiveBattleProperty(null);
          }}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Property,
  TacticalSkill,
  GroupSynergy,
  Cartel,
  AllianceState,
  GameLog,
  CommunityType,
  BattleResult,
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
import { WIND_CONDITIONS, WindCondition, WindType } from './components/WindIndicator';
import { FANKIT_ART } from './data/fankitAssets';
import { COMMUNITY_CAMPAIGN_ORDER, GAME_WORLD, TRADE_COMMUNITIES } from './data/worldData';
import { Bell, MapPinned } from 'lucide-react';
import {
  calculateOfflineIncome,
  clearGameSave,
  loadGameSave,
  loadLegacyCompanyName,
  restoreProperties,
  saveGame,
} from './utils/saveData';
import {
  getCampaignProperties,
  isSkillUnlocked,
  PASSIVE_REVENUE_MULTIPLIER,
} from './utils/gameBalance';

export { PASSIVE_REVENUE_MULTIPLIER };

type FeatureUnlockId =
  | 'subsidiary_support'
  | 'light_party_limit_break'
  | 'guild_synergy'
  | 'full_party'
  | 'trade_alliance';

const FEATURE_UNLOCKS: Record<
  FeatureUnlockId,
  { kicker: string; title: string; dialogue: string; detail: string }
> = {
  subsidiary_support: {
    kicker: 'TRADE PARTY',
    title: '傘下カンパニー支援 解放',
    dialogue: '買収戦の「資金源」から、仲間になった会社へ一社ずつ支援を頼めるでっす。',
    detail: '支援は自動ではありません。毎回会社を選び、独立危険度と引き換えにギルを積みます。',
  },
  light_party_limit_break: {
    kicker: 'LIGHT PARTY',
    title: 'LIMIT BREAK I 解放',
    dialogue: '自社を含む4社がそろって、LBゲージ1本が解放でっす！ 攻防を重ねて満タンにするでっす。',
    detail: 'ゲージは資金投入と敵の防衛の大きさで蓄積。発動すると0に戻り、使わなかった分は次の買収戦へ持ち越せます。',
  },
  guild_synergy: {
    kicker: 'GUILD LINK',
    title: 'SYNERGY 解放',
    dialogue: '同じ商流で働く仲間がつながりましたな。これがギルド・シナジーでっす！',
    detail: '対象企業の組み合わせや地域・業界の影響力で、収益・押し込み・一斉支援が強化されます。',
  },
  full_party: {
    kicker: 'FULL PARTY',
    title: 'フルパーティ結成',
    dialogue: '自社を含む8社のフルパーティでっす。大口案件にも、仲間の役割を見て挑むでっす。',
    detail: '自社を含む8社でLBゲージ2本、16社で3本まで蓄積。ためた本数に応じてLB I～IIIへ強化されます。',
  },
  trade_alliance: {
    kicker: 'TRADE ALLIANCE',
    title: 'アライアンス航路 解放',
    dialogue: 'ウルダハでの実績が認められましたな。ここからは複数カンパニーが組む大規模案件でっす！',
    detail: '参加カンパニーを先に攻略して本部防衛資本を削る、段階式の買収戦と外部パーティ協定が開放されます。',
  },
};

export default function App() {
  const initialSaveRef = useRef<ReturnType<typeof loadGameSave> | undefined>(undefined);
  if (initialSaveRef.current === undefined) {
    initialSaveRef.current = loadGameSave();
  }
  const initialSave = initialSaveRef.current;

  // --- Game Core State ---
  const [totalFunds, setTotalFunds] = useState<number>(initialSave?.totalFunds ?? 50_000);
  const [limitBreakCharge, setLimitBreakCharge] = useState<number>(
    initialSave?.limitBreakCharge ?? 0
  );
  const [properties, setProperties] = useState<Property[]>(() => restoreProperties(initialSave));
  const [skills, setSkills] = useState<TacticalSkill[]>(INITIAL_SKILLS);
  const [equippedSkillIds, setEquippedSkillIds] = useState<string[]>(
    initialSave?.equippedSkillIds ?? ['skill_sns_blitz']
  );
  const [groupSynergies, setGroupSynergies] =
    useState<GroupSynergy[]>(INITIAL_GROUP_SYNERGIES);
  const [cartels, setCartels] = useState<Cartel[]>(INITIAL_CARTELS);
  const [alliance, setAlliance] = useState<AllianceState>(
    initialSave?.alliance ?? {
      allyId: '',
      allyName: '',
      active: false,
    }
  );

  // UI States
  const [activeTab, setActiveTab] = useState<'market' | 'portfolio' | 'skills' | 'cartels'>('market');
  const [activeBattleProperty, setActiveBattleProperty] = useState<Property | null>(null);
  const [battleTimeScale, setBattleTimeScale] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [companyName, setCompanyName] = useState<string>(
    initialSave?.companyName || loadLegacyCompanyName() || GAME_WORLD.companyName
  );
  const [showLaunchIntro, setShowLaunchIntro] = useState(!initialSave);
  const [offlineIncomeNotice, setOfflineIncomeNotice] = useState(0);
  const [unlockNotice, setUnlockNotice] = useState<CommunityType | null>(null);
  const [seenUnlockIds, setSeenUnlockIds] = useState<FeatureUnlockId[]>(
    () => (initialSave?.seenUnlockIds || []).filter(
      (id): id is FeatureUnlockId => Object.prototype.hasOwnProperty.call(FEATURE_UNLOCKS, id)
    )
  );
  const [featureUnlockNoticeId, setFeatureUnlockNoticeId] = useState<FeatureUnlockId | null>(null);
  const [marketNavigationRequest, setMarketNavigationRequest] = useState<{
    id: number;
    mode: 'map' | 'targets';
    community: CommunityType | 'ALL';
  } | null>(null);
  const [marketWind, setMarketWind] = useState<WindCondition>(WIND_CONDITIONS.TAILWIND_PLAYER);
  const [windCountdown, setWindCountdown] = useState(8);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const scale = activeBattleProperty ? battleTimeScale : 1;
      if (scale <= 0) return;
      setWindCountdown((current) => {
        const next = current - (0.25 * scale);
        if (next > 0) return next;
        const types: WindType[] = ['TAILWIND_PLAYER', 'HEADWIND_PLAYER', 'TAILWIND_ENEMY', 'CROSSWIND', 'CALM'];
        setMarketWind(WIND_CONDITIONS[types[Math.floor(Math.random() * types.length)]]);
        return 8;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [activeBattleProperty, battleTimeScale]);

  const completeLaunchIntro = () => {
    const normalizedName = companyName.trim() || GAME_WORLD.companyName;
    setCompanyName(normalizedName);
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
      const communityProperties = getCampaignProperties(properties, community.id);
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

  const tradeAllianceUnlocked = !!communityProgress.find(
    (community) => community.id === 'ウルダハ'
  )?.conquered;

  useEffect(() => {
    if (!tradeAllianceUnlocked && activeTab === 'cartels') setActiveTab('market');
  }, [activeTab, tradeAllianceUnlocked]);

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

  const regionalInfluence = useMemo(() => {
    const result: Record<string, { owned: number; total: number; label: string; playerBonus: number; enemyBudgetDiscount: number }> = {};
    communityProgress.forEach((community) => {
      const ratio = community.total > 0 ? community.owned / community.total : 0;
      const entry = { owned: community.owned, total: community.total, label: '未進出', playerBonus: 0, enemyBudgetDiscount: 0 };
      if (community.owned > 0) {
        entry.label = '足場を築いた';
        entry.playerBonus = 0.03;
      }
      if (ratio >= 0.5) {
        entry.label = '地域優勢';
        entry.playerBonus = 0.08;
        entry.enemyBudgetDiscount = 0.05;
      }
      if (community.conquered) {
        entry.label = '地域制覇';
        entry.playerBonus = 0.12;
        entry.enemyBudgetDiscount = 0.08;
      }
      result[community.id] = entry;
    });
    return result;
  }, [communityProgress]);

  const tradeNetworkBonus = Math.min(0.16, conqueredCommunityCount * 0.02);

  // Active Synergies Count & Bonus Multiplier
  const { activeGroupSynergies, activeSynergiesCount, bonusMultiplier } = useMemo(() => {
    const active = groupSynergies.filter((syn) =>
      syn.requiredPropertyIds.every((id) => ownedPropertyIds.has(id))
    );
    return {
      activeGroupSynergies: active,
      activeSynergiesCount: active.length,
      bonusMultiplier: active.reduce((multiplier, syn) => multiplier * syn.bonusYieldMultiplier, 1),
    };
  }, [groupSynergies, ownedPropertyIds]);

  const reachedFeatureUnlockIds = useMemo(() => {
    const reached: FeatureUnlockId[] = [];
    if (ownedProperties.length >= 1) reached.push('subsidiary_support');
    if (ownedProperties.length + 1 >= 4) reached.push('light_party_limit_break');
    if (activeSynergiesCount > 0) reached.push('guild_synergy');
    if (ownedProperties.length + 1 >= 8) reached.push('full_party');
    if (tradeAllianceUnlocked) reached.push('trade_alliance');
    return reached;
  }, [activeSynergiesCount, ownedProperties.length, tradeAllianceUnlocked]);

  useEffect(() => {
    if (
      showLaunchIntro ||
      activeBattleProperty ||
      unlockNotice ||
      featureUnlockNoticeId
    ) return;
    const nextUnlock = reachedFeatureUnlockIds.find((id) => !seenUnlockIds.includes(id));
    if (!nextUnlock) return;
    setFeatureUnlockNoticeId(nextUnlock);
    soundFx.playFeatureUnlocked();
  }, [
    activeBattleProperty,
    featureUnlockNoticeId,
    reachedFeatureUnlockIds,
    seenUnlockIds,
    showLaunchIntro,
    unlockNotice,
  ]);

  const acknowledgeFeatureUnlock = () => {
    if (!featureUnlockNoticeId) return;
    setSeenUnlockIds((current) =>
      current.includes(featureUnlockNoticeId) ? current : [...current, featureUnlockNoticeId]
    );
    setFeatureUnlockNoticeId(null);
    soundFx.playCoin();
  };

  const featureUnlockNotice = featureUnlockNoticeId
    ? FEATURE_UNLOCKS[featureUnlockNoticeId]
    : null;

  const unlockedSkillIds = useMemo(
    () =>
      new Set(
        skills
          .filter((skill) =>
            isSkillUnlocked({ skill, ownedProperties, totalFunds, activeSynergyCount: activeSynergiesCount })
          )
          .map((skill) => skill.id)
      ),
    [activeSynergiesCount, ownedProperties, skills, totalFunds]
  );

  // Total Passive Revenue Yield per second (I_net)
  const passiveRevenue = useMemo(() => {
    const base = ownedProperties.reduce((sum, p) => sum + p.annualRevenue, 0);
    return Math.round(base * bonusMultiplier * PASSIVE_REVENUE_MULTIPLIER);
  }, [ownedProperties, bonusMultiplier]);

  const offlineIncomeAppliedRef = useRef(false);
  useEffect(() => {
    if (offlineIncomeAppliedRef.current) return;
    offlineIncomeAppliedRef.current = true;
    if (!initialSave || passiveRevenue <= 0) return;
    const income = calculateOfflineIncome(passiveRevenue, initialSave.lastSavedAt);
    if (income <= 0) return;
    setTotalFunds((current) => current + income);
    setOfflineIncomeNotice(income);
    const timer = window.setTimeout(() => setOfflineIncomeNotice(0), 4600);
    return () => window.clearTimeout(timer);
  }, [initialSave, passiveRevenue]);

  // IDLE CASH HARVEST ENGINE (1 Second Ticker)
  useEffect(() => {
    const timer = setInterval(() => {
      if (passiveRevenue > 0) {
        setTotalFunds((prev) => prev + passiveRevenue);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [passiveRevenue]);

  useEffect(() => {
    if (showLaunchIntro) return;
    const timer = window.setTimeout(() => {
      saveGame({
        companyName: companyName.trim() || GAME_WORLD.companyName,
        totalFunds,
        properties,
        equippedSkillIds,
        alliance,
        seenUnlockIds,
        limitBreakCharge,
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [alliance, companyName, equippedSkillIds, limitBreakCharge, properties, seenUnlockIds, showLaunchIntro, totalFunds]);

  // Handlers
  const handleStartBuyout = (property: Property) => {
    if (!unlockedCommunityIds.has(property.community)) {
      soundFx.playWarning();
      addGameLog(`【航路未開通】${property.community}へ進むには、手前の都市を制覇してください。`, 'warning');
      setActiveTab('market');
      return;
    }
    soundFx.playCoin();
    setBattleTimeScale(0);
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
  }: BattleResult) => {
    // 仲介手数料に加え、直接出資の一部が買収費用・撤退損として確定する。
    setTotalFunds((prev) => Math.max(0, prev - brokerageFee - settlementCost + battleCashDelta + (winner === 'player' ? victoryReward : 0)));

    if (winner === 'player') {
      const conquersCity = getCampaignProperties(properties, targetProperty.community)
        .every((property) => property.owner === 'player' || property.id === targetProperty.id);
      const campaignIndex = COMMUNITY_CAMPAIGN_ORDER.indexOf(targetProperty.community);
      const nextCommunity = COMMUNITY_CAMPAIGN_ORDER[campaignIndex + 1];
      if (conquersCity && nextCommunity) {
        setUnlockNotice(nextCommunity);
        setMarketNavigationRequest((previous) => ({
          id: (previous?.id || 0) + 1,
          mode: 'map',
          community: nextCommunity,
        }));
      } else {
        setMarketNavigationRequest((previous) => ({
          id: (previous?.id || 0) + 1,
          mode: 'targets',
          community: targetProperty.community,
        }));
      }
      setActiveTab('market');

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

      // Attacking a trade-party partner permanently ends the cooperation pact.
      if (
        alliance.active &&
        targetProperty.ownerName.includes(alliance.allyName)
      ) {
        setAlliance({ allyId: '', allyName: '', active: false });
        addGameLog(
          `【パーティ協定解除】協定企業の所有物件を攻めたため、${alliance.allyName} との協定が永久解除されました！`,
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
      setMarketNavigationRequest((previous) => ({
        id: (previous?.id || 0) + 1,
        mode: 'targets',
        community: targetProperty.community,
      }));
      setActiveTab('market');
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
    setBattleTimeScale(1);
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
        if (!unlockedSkillIds.has(skillId) || prev.length >= 8) return prev;
        return [...prev, skillId];
      }
    });
  };

  // Trade-party cooperation management
  const handleFormAlliance = (allyName: string) => {
    setAlliance({ allyId: 'garland_ironworks', allyName, active: true });
    addGameLog(`【トレード・パーティ結成】${allyName} との協力協定が成立しました！`, 'success');
  };

  const handleBreakAlliance = () => {
    setAlliance({ allyId: '', allyName: '', active: false });
    addGameLog(`【パーティ解散】外部協力協定を解消しました。`, 'info');
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

  const handleNewGame = () => {
    const accepted = window.confirm(
      '保存済みの所持金・物件・装備スキル・パーティ協定を削除して、ニューゲームを始めますか？'
    );
    if (!accepted) return;
    clearGameSave();
    window.location.reload();
  };

  // Equipped skills object array
  const equippedSkills = useMemo(() => {
    return skills.filter((s) => equippedSkillIds.includes(s.id) && unlockedSkillIds.has(s.id));
  }, [skills, equippedSkillIds, unlockedSkillIds]);

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
        tradeAllianceUnlocked={tradeAllianceUnlocked}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        onAddFunds={handleAddFunds}
        onResetFunds={handleResetFunds}
        onNewGame={handleNewGame}
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
            currentWind={marketWind}
            windCountdown={windCountdown}
            navigationRequest={marketNavigationRequest}
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
            totalFunds={totalFunds}
            activeSynergyCount={activeSynergiesCount}
            onToggleEquipSkill={handleToggleEquipSkill}
          />
        )}

        {activeTab === 'cartels' && tradeAllianceUnlocked && (
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

        {/* Global activity stays closed until the player asks for it. */}
        {logs.length > 0 && (
          <details className="group rounded-xl border border-slate-800 bg-slate-900/80 shadow-lg">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-bold text-slate-300">
              <span className="flex items-center gap-2"><Bell className="h-4 w-4 text-amber-400" />システム運営ログ</span>
              <span className="text-[10px] text-slate-500 group-open:hidden">最新 {logs.length}件・タップして開く</span>
              <span className="hidden text-[10px] text-amber-300 group-open:inline">閉じる</span>
            </summary>
            <div className="max-h-40 space-y-1.5 overflow-y-auto border-t border-slate-800 px-4 py-3 font-mono text-xs text-slate-300 scrollbar-thin">
              {logs.map((log) => {
                let badgeClass = 'text-slate-400';
                if (log.type === 'success') badgeClass = 'text-emerald-400 font-bold';
                if (log.type === 'warning') badgeClass = 'text-amber-400 font-bold';
                if (log.type === 'danger') badgeClass = 'text-rose-400 font-bold';
                return (
                  <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                    <span className="shrink-0 text-[10px] text-slate-500">[{log.timestamp}]</span>
                    <span className={badgeClass}>{log.message}</span>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </main>

      <footer className="game-legal-notice">
        <span>本作は非公式ファンサイト／ファンゲームです。</span>
        <a href="https://jp.finalfantasyxiv.com/lodestone/special/fankit/" target="_blank" rel="noreferrer">FFXIV公式ファンキット</a>
        <a href="https://support.jp.square-enix.com/rule.php?id=5381&la=0&tag=authc" target="_blank" rel="noreferrer">著作物利用条件</a>
        <strong>© SQUARE ENIX</strong>
      </footer>

      {featureUnlockNotice && (
        <button
          type="button"
          onClick={acknowledgeFeatureUnlock}
          className="city-unlock fixed inset-0 z-[185] flex items-center justify-center bg-slate-950/92 p-4 text-left"
          aria-label={`${featureUnlockNotice.title}の説明を閉じる`}
        >
          <span className="city-unlock__card relative block w-full max-w-2xl overflow-hidden rounded-2xl border border-cyan-300/60 bg-slate-900 p-5 shadow-2xl sm:p-7">
            <img src={FANKIT_ART.marketBackdrop} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-20" />
            <span className="relative z-10 flex items-end gap-4">
              <img src={FANKIT_ART.tataru.dressUp} alt="タタル" className="h-28 w-24 shrink-0 object-contain object-bottom drop-shadow-[0_0_16px_rgba(103,232,249,.5)] sm:h-36 sm:w-32" />
              <span className="min-w-0 pb-1">
                <span className="block text-[10px] font-black tracking-[.28em] text-cyan-300">{featureUnlockNotice.kicker} UNLOCKED</span>
                <span className="mt-1 block text-xl font-black text-white sm:text-3xl">{featureUnlockNotice.title}</span>
                <span className="mt-3 block rounded-xl border border-cyan-200/25 bg-slate-950/75 p-3 text-sm font-bold leading-relaxed text-cyan-50">「{featureUnlockNotice.dialogue}」</span>
              </span>
            </span>
            <span className="relative z-10 mt-3 block text-xs leading-relaxed text-slate-300 sm:text-sm">{featureUnlockNotice.detail}</span>
            <span className="relative z-10 mt-4 inline-block rounded-lg bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">わかったでっす！</span>
          </span>
        </button>
      )}

      {unlockNotice && (
        <button type="button" onClick={() => setUnlockNotice(null)} className="city-unlock fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/90 p-4 text-left">
          <span className="city-unlock__card relative block w-full max-w-2xl overflow-hidden rounded-2xl border border-amber-300/60 bg-slate-900 p-5 shadow-2xl sm:p-7">
            <img src={FANKIT_ART.marketBackdrop} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-25" />
            <span className="relative z-10 flex items-end gap-4">
              <img src={FANKIT_ART.tataru.windUp} alt="タタル" className="h-28 w-24 shrink-0 object-contain object-bottom sm:h-36 sm:w-32" />
              <span className="min-w-0 pb-1">
                <span className="block text-[10px] font-black tracking-[.3em] text-cyan-300">NEW TRADE ROUTE</span>
                <span className="mt-1 flex items-center gap-2 text-2xl font-black text-white sm:text-3xl"><MapPinned className="h-7 w-7 shrink-0 text-amber-300" /> {unlockNotice}</span>
                <span className="mt-3 block rounded-xl border border-amber-200/25 bg-slate-950/75 p-3 text-sm font-bold leading-relaxed text-amber-50">「前の都市での商いが実を結び、新しい航路が開きましたな。次の市場へ進むでっす！」</span>
              </span>
            </span>
            <span className="relative z-10 mt-4 inline-block rounded-lg bg-amber-400 px-4 py-2 text-xs font-black text-slate-950">都市マップへ進む</span>
          </span>
        </button>
      )}

      {offlineIncomeNotice > 0 && (
        <div className="offline-income-toast" role="status">
          <small>OFFLINE INCOME</small>
          <strong>+{formatCurrency(offlineIncomeNotice)}</strong>
          <span>留守中の商いを回収しました</span>
        </div>
      )}

      {/* Real-time Buyout Battle Modal */}
      {activeBattleProperty && (
        <BattleModal
          targetProperty={activeBattleProperty}
          companyName={companyName}
          totalFunds={totalFunds}
          ownedProperties={ownedProperties}
          equippedSkills={equippedSkills}
          alliance={alliance}
          activeSynergies={activeGroupSynergies}
          industryInfluence={industryInfluence[activeBattleProperty.industry] || { owned: 0, total: 0, label: '未進出', playerBonus: 0, enemyBudgetDiscount: 0 }}
          regionalInfluence={regionalInfluence[activeBattleProperty.community] || { owned: 0, total: 0, label: '未進出', playerBonus: 0, enemyBudgetDiscount: 0 }}
          currentWind={marketWind}
          windCountdown={Math.max(0, Math.ceil(windCountdown))}
          tradeNetworkBonus={tradeNetworkBonus}
          limitBreakCharge={limitBreakCharge}
          onLimitBreakChargeChange={setLimitBreakCharge}
          onTimeScaleChange={setBattleTimeScale}
          nextCommunity={(() => {
            const wouldConquer = getCampaignProperties(properties, activeBattleProperty.community)
              .every((property) => property.owner === 'player' || property.id === activeBattleProperty.id);
            if (!wouldConquer) return null;
            const currentIndex = COMMUNITY_CAMPAIGN_ORDER.indexOf(activeBattleProperty.community);
            return COMMUNITY_CAMPAIGN_ORDER[currentIndex + 1] || null;
          })()}
          isTutorial={ownedProperties.length === 0 && activeBattleProperty.id.startsWith('prop_starter_')}
          onAddFunds={handleAddFunds}
          onResetFunds={handleResetFunds}
          onBattleEnd={handleBattleEnd}
          onClose={() => {
            setActiveBattleProperty(null);
            setBattleTimeScale(1);
          }}
        />
      )}
    </div>
  );
}

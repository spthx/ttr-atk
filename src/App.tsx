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
  AppTab,
  BattleMode,
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
import { EndingModal } from './components/EndingModal';
import { HighEndRaidView } from './components/HighEndRaidView';
import {
  getWindProgressionStage,
} from './components/WindIndicator';
import { FANKIT_ART } from './data/fankitAssets';
import { COMMUNITY_CAMPAIGN_ORDER, GAME_WORLD, TRADE_COMMUNITIES } from './data/worldData';
import { Bell, MapPinned } from 'lucide-react';
import {
  calculateOfflineIncome,
  clearGameSave,
  loadGameSave,
  loadLegacyCompanyName,
  normalizeSavedAbilityLoadout,
  restoreProperties,
  saveGame,
} from './utils/saveData';
import {
  MANUAL_ABILITY_SLOT_COUNT,
  type AbilityActivationMode,
} from './utils/abilityLoadout';
import {
  BATTLE_LOYALTY_BALANCE,
  calculateEnemyBudget,
  calculateTotalAssetValue,
  getBossAbilityTier,
  getCampaignProperties,
  getEnemyDifficultyLevel,
  getEnemySupportAutoProfile,
  getEnemySupportSkillProfile,
  INITIAL_PLAYER_FUNDS,
  isExtremeReacquisition,
  isNormalCityBoss,
  isSkillUnlocked,
  PASSIVE_REVENUE_MULTIPLIER,
  TACTICAL_SKILL_BALANCE,
} from './utils/gameBalance';
import {
  calculateAllianceSupport,
  isPublicPatronage,
  shouldBreakAllianceForTarget,
} from './utils/alliance';
import { getEnemyBaseWaitMs } from './utils/enemyAi';
import {
  calculateBattleReadiness,
  type BattleReadinessResult,
} from './utils/battleReadiness';
import {
  applyLoyaltySettlementPropertyUpdates,
  applyNormalBattlePropertyUpdates,
  calculateLiquidationCashback,
} from './utils/battleSettlement';
import {
  clearPendingBattleSession,
  isPendingBattleTargetAvailable,
  loadPendingBattleSession,
  persistPendingBattleSession,
  shouldRestorePendingBattleSession,
  type NormalBattleOrigin,
} from './utils/battleSession';
import {
  getUnlockedCommunityIds,
  hasCompletedCommunityNetwork,
  normalizeConqueredCommunityIds,
  wouldCompleteCommunityNetwork,
} from './utils/campaignProgress';
import {
  getNormalBattleNavigation,
} from './utils/progressionNavigation';
import {
  applySavageSynergyUpgrades,
  buildCruelProperty,
  buildUltimateProperty,
  buildSavageProperties,
  CRUEL_RAID_DEFINITION,
  getSavageRaidDefinition,
  getSavagePropertyYieldMultiplier,
  getUnlockedSavageRaidIds,
  normalizeSavageClearedRaidIds,
  SAVAGE_RAID_DEFINITIONS,
  ULTIMATE_RAID_DEFINITION,
} from './utils/savage';
import {
  getBattleOnlySynergyMultiplier,
  getGroupSynergySelectionPriority,
  getLatestProgressionBattleSynergy,
  GRAND_COMPANY_EORZEA_ID,
  isGroupSynergyUnlocked,
} from './utils/synergy';
import {
  getSkillUnlockExplanation,
  getSynergyUnlockExplanation,
  type UnlockExplanation,
} from './utils/unlockExplanation';
import { calculateCruelEntryRequirement } from './utils/cruelBattle';
import {
  findPhantomProperty,
  normalizePhantomWinStreak,
  pickRandomPhantomRaid,
} from './utils/phantomBattle';
import {
  buildKarmaProperty,
  KARMA_RAID_DEFINITION,
} from './utils/karmaBattle';

export { PASSIVE_REVENUE_MULTIPLIER };

const BATTLE_FRAME_RATE_STORAGE_KEY = 'ttr-battle-frame-rate';
const LEGACY_LIGHTWEIGHT_MODE_STORAGE_KEY = 'ttr-lightweight-mode';
type BattleFrameRate = 30 | 60;
const FIRST_SAVAGE_FIRST_LAYER_ID =
  SAVAGE_RAID_DEFINITIONS.find(
    (raid) => raid.series === 1 && raid.layer === 1
  )?.id ?? 'prop_starter_farm';
const FIRST_SAVAGE_FOURTH_LAYER_ID =
  SAVAGE_RAID_DEFINITIONS.find(
    (raid) => raid.series === 1 && raid.layer === 4
  )?.id ?? 'prop_abyss_heavy';
const INITIAL_FEINT_SKILL_ID =
  INITIAL_SKILLS.find((skill) => skill.effectType === 'FEINT')?.id ??
  'skill_sabotage';
const LIVING_DEAD_SKILL_ID =
  INITIAL_SKILLS.find((skill) => skill.effectType === 'LIVING_DEAD')?.id ??
  'skill_sns_blitz';

const ENEMY_MECHANIC_NAMES = {
  blackest_night: 'ブラックナイト',
  drain: 'ドレイン',
  drill: 'ドリル',
  divination: 'ディヴィネーション',
  rapid_assault: '疾風怒濤',
  limit_break_3: '敵LIMIT BREAK 3',
  capital_reversal: '資本反転',
  forced_liquidation: '強制清算',
  omnicapitalization: '星海資本の宣告',
  cruel_reckoning: '終極資本査定',
} as const;

type FeatureUnlockId =
  | 'market_wind'
  | 'rival_wind'
  | 'turbulent_wind'
  | 'subsidiary_support'
  | 'light_party_limit_break'
  | 'guild_synergy'
  | 'full_party'
  | 'trade_alliance'
  | 'opening_auto'
  | 'critical_auto';

const FEATURE_UNLOCKS: Record<
  FeatureUnlockId,
  { kicker: string; title: string; dialogue: string; detail: string }
> = {
  market_wind: {
    kicker: 'MARKET WIND',
    title: '市場の風 解放',
    dialogue: '基本の商戦を覚えたので、市場の潮目も読んでいくでっす！ まずは味方への追い風だけでっす。',
    detail: '風は常時ではありません。商戦開始から最低10秒は静穏で、その後も予兆を経て低頻度で発生します。青い追い風の間は自社の出資・支援が1.35倍です。',
  },
  rival_wind: {
    kicker: 'RIVAL WIND',
    title: '競合の追い風 解放',
    dialogue: 'リムサ・ロミンサの人脈開通後は、競合にも赤い追い風が届くでっす。赤い間は温存も立派な一手でっす！',
    detail: '競合追い風の7～9秒間は敵防衛が1.35倍。静穏へ戻ると補正は消え、全画面演出中は残り時間が減りません。',
  },
  turbulent_wind: {
    kicker: 'MARKET TURBULENCE',
    title: '向かい風・乱旋風 解放',
    dialogue: 'クガネの人脈開通で、向かい風と乱旋風も起きるでっす。倍率を見て、積むか待つか決めるでっす！',
    detail: '自社向かい風は自社効果0.72倍。乱旋風は双方1.12倍・所有率速度1.45倍。味方追い風とSYNERGYが重なるとBURST TIMEです。',
  },
  subsidiary_support: {
    kicker: 'TRADE PARTY',
    title: '保有事業・契約の人脈 解放',
    dialogue: '次の商戦は、まず自社で積んでから「人脈」を呼ぶでっす。仲間のコインが同じ山へ加わるでっす！',
    detail: '支援は自動ではありません。自社で数回積んだ後に人脈を選ぶと、取得した事業・契約先の資本が勝負を押し切ります。独立危険度との引き換えで、契約先そのものを所有・傘下化する意味ではありません。',
  },
  light_party_limit_break: {
    kicker: 'LIGHT PARTY',
    title: 'LIMIT BREAK I 解放',
    dialogue: '自社1枠と人脈3件がそろって、交易ライトパーティ結成でっす！ LBゲージ1本が解放されるでっす。',
    detail: '次の商戦で自社と人脈を積み、競合の反撃資金を削るとLB Iがたまります。最後はLBで全員のコインを一斉に積んで、気持ちよく決着できます。発動後は0に戻り、使わなかった分は次戦へ持ち越します。',
  },
  guild_synergy: {
    kicker: 'BUSINESS SYNERGY',
    title: '事業連携（SYNERGY）解放',
    dialogue: '必要な事業・契約がつながり、ひとつの商流になったでっす！',
    detail: '指定された事業・契約を揃えると毎秒収益が自動で強化されます。戦闘では選んだ1連携だけを使用し、地域・業界補正やLIMIT BREAKとは別に働きます。',
  },
  full_party: {
    kicker: 'FULL PARTY',
    title: 'フルパーティ結成',
    dialogue: '自社1枠と人脈7件の交易フルパーティでっす。大口案件にも、仲間の役割を見て挑むでっす。',
    detail: '自社＋人脈が合計8枠でLBゲージ2本、16枠で3本まで蓄積。ためた本数に応じてLB I～IIIへ強化されます。',
  },
  trade_alliance: {
    kicker: 'ENTERPRISE ALLIANCE',
    title: '外部協力・企業連合 解放',
    dialogue: 'クリスタリウムまで交易路を広げた実績で、企業連合との大商戦が開いたでっす！',
    detail: '段階式の企業連合戦、外部企業との協力協定、グランドカンパニーへの公的後援申請が解放されます。',
  },
  opening_auto: {
    kicker: 'OPENING ABILITY',
    title: '開幕アビリティ 解放',
    dialogue: '最初の零式1層を越えたので、開幕の段取りも組めるでっす！',
    detail: '装備中のアビリティ一つを開幕アビリティへ設定できます。設定したアビリティは手動選択から外れ、開始演出の後に一度だけ自動発動します。',
  },
  critical_auto: {
    kicker: 'CRITICAL ABILITY',
    title: 'リビングデッド／瀕死アビリティ 解放',
    dialogue: '最初の零式4層を越えた報酬で、瀕死の切り札を用意したでっす！',
    detail: 'リビングデッドを修得し、瀕死アビリティへ自動装備します。所有率が危険域へ入った時に一度だけ自動発動し、他の修得済みアビリティへ付け替えることもできます。',
  },
};

export default function App() {
  const initialSaveRef = useRef<ReturnType<typeof loadGameSave> | undefined>(undefined);
  if (initialSaveRef.current === undefined) {
    initialSaveRef.current = loadGameSave();
  }
  const initialSave = initialSaveRef.current;
  const pendingBattleSessionRef = useRef<
    ReturnType<typeof loadPendingBattleSession> | undefined
  >(undefined);
  if (pendingBattleSessionRef.current === undefined) {
    const loadedSession = loadPendingBattleSession();
    const normalPropertyIds = new Set(
      INITIAL_PROPERTIES.map((property) => property.id)
    );
    if (
      loadedSession &&
      !shouldRestorePendingBattleSession(
        loadedSession,
        initialSave?.lastSavedAt
      )
    ) {
      // The authoritative save was written after this battle began. This is
      // the atomic settlement window: the result is already committed, but an
      // interruption happened before the recovery marker could be removed.
      clearPendingBattleSession();
      pendingBattleSessionRef.current = null;
    } else if (
      loadedSession &&
      !isPendingBattleTargetAvailable(loadedSession, normalPropertyIds)
    ) {
      // A campaign update can retire a normal business while iOS still holds
      // its recovery marker. Discard only that transient battle; the real save
      // and permanent city-network record remain authoritative.
      clearPendingBattleSession();
      pendingBattleSessionRef.current = null;
    } else if (loadedSession?.mode === 'training') {
      // Training battles were removed. Discard only the transient legacy
      // session; the player's save, funds, LB, properties and unlocks remain.
      clearPendingBattleSession();
      pendingBattleSessionRef.current = null;
    } else {
      pendingBattleSessionRef.current = loadedSession;
    }
  }
  const pendingBattleSession = pendingBattleSessionRef.current;

  // --- Game Core State ---
  const [totalFunds, setTotalFunds] = useState<number>(
    initialSave?.totalFunds ?? INITIAL_PLAYER_FUNDS
  );
  const [limitBreakCharge, setLimitBreakCharge] = useState<number>(
    initialSave?.limitBreakCharge ?? 0
  );
  const [phantomBattleLimitBreakCharge, setPhantomBattleLimitBreakCharge] =
    useState<number>(initialSave?.limitBreakCharge ?? 0);
  const [karmaBattleLimitBreakCharge, setKarmaBattleLimitBreakCharge] =
    useState<number>(initialSave?.limitBreakCharge ?? 0);
  const [properties, setProperties] = useState<Property[]>(() => restoreProperties(initialSave));
  const [conqueredCommunityIds, setConqueredCommunityIds] = useState<
    CommunityType[]
  >(() =>
    normalizeConqueredCommunityIds({
      properties: restoreProperties(initialSave),
      savedCommunityIds: initialSave?.conqueredCommunityIds,
      seenUnlockIds: initialSave?.seenUnlockIds,
      normalEndingSeen: initialSave?.normalEndingSeen,
    })
  );
  const [skills, setSkills] = useState<TacticalSkill[]>(INITIAL_SKILLS);
  const initialAbilityLoadout = normalizeSavedAbilityLoadout({
    equippedSkillIds:
      initialSave?.equippedSkillIds ?? [INITIAL_FEINT_SKILL_ID],
    openingAutoSkillId: initialSave?.openingAutoSkillId,
    criticalAutoSkillId: initialSave?.criticalAutoSkillId,
    reserveSkillId: initialSave?.reserveSkillId,
  });
  const [equippedSkillIds, setEquippedSkillIds] = useState<string[]>(
    initialAbilityLoadout.equippedSkillIds
  );
  const [openingAutoSkillId, setOpeningAutoSkillId] = useState<string | null>(
    initialAbilityLoadout.openingAutoSkillId
  );
  const [criticalAutoSkillId, setCriticalAutoSkillId] = useState<string | null>(
    initialAbilityLoadout.criticalAutoSkillId
  );
  const [cartels, setCartels] = useState<Cartel[]>(INITIAL_CARTELS);
  const [alliance, setAlliance] = useState<AllianceState>(
    initialSave?.alliance ?? {
      allyId: '',
      allyName: '',
      active: false,
      allyKind: 'company',
      relationType: 'commercial_alliance',
    }
  );
  const normalizedInitialSavageClears = normalizeSavageClearedRaidIds(
    initialSave?.savageClearedPropertyIds ?? [],
    initialSave?.savageProgressVersion,
    initialSave?.savageEndingSeen === true ||
      initialSave?.ultimateCleared === true
  );
  const initialSavageComplete =
    normalizedInitialSavageClears.length === SAVAGE_RAID_DEFINITIONS.length;
  const initialUltimateCleared =
    initialSave?.ultimateCleared === true && initialSavageComplete;
  const initialCruelCleared =
    initialSave?.cruelCleared === true && initialUltimateCleared;
  const initialKarmaCleared =
    initialSave?.karmaCleared === true && initialCruelCleared;
  const [savageClearedPropertyIds, setSavageClearedPropertyIds] =
    useState<string[]>(normalizedInitialSavageClears);
  const [normalEndingSeen, setNormalEndingSeen] = useState(initialSave?.normalEndingSeen === true);
  const [savageEndingSeen, setSavageEndingSeen] = useState(
    initialSave?.savageEndingSeen === true && initialSavageComplete
  );
  const [ultimateCleared, setUltimateCleared] = useState(initialUltimateCleared);
  const [cruelCleared, setCruelCleared] = useState(initialCruelCleared);
  const [karmaCleared, setKarmaCleared] = useState(initialKarmaCleared);
  const [phantomWinStreak, setPhantomWinStreak] = useState(() =>
    initialCruelCleared
      ? normalizePhantomWinStreak(initialSave?.phantomWinStreak)
      : 0
  );
  const [phantomRaidId, setPhantomRaidId] = useState(() =>
    pendingBattleSession?.mode === 'phantom'
      ? pendingBattleSession.targetProperty.id
      : pickRandomPhantomRaid().id
  );
  const [trueEndingSeen, setTrueEndingSeen] = useState(
    initialSave?.trueEndingSeen === true && initialUltimateCleared
  );
  const [selectedBattleSynergyId, setSelectedBattleSynergyId] = useState<string | null>(
    initialSave?.selectedBattleSynergyId ?? null
  );
  const [grandCompanyEorzeaIntegrated, setGrandCompanyEorzeaIntegrated] =
    useState(
      initialSave?.grandCompanyEorzeaIntegrated === true ||
        restoreProperties(initialSave).every(
          (property) => property.owner === 'player'
        )
    );

  // UI States
  const [activeTab, setActiveTab] = useState<AppTab>(
    pendingBattleSession?.mode === 'savage' ||
      pendingBattleSession?.mode === 'ultimate' ||
      pendingBattleSession?.mode === 'cruel' ||
      pendingBattleSession?.mode === 'karma' ||
      pendingBattleSession?.mode === 'phantom'
      ? 'savage'
      : pendingBattleSession?.mode === 'normal' &&
          pendingBattleSession.normalOrigin === 'cartels'
        ? 'cartels'
        : 'market'
  );
  const [activeBattleProperty, setActiveBattleProperty] =
    useState<Property | null>(pendingBattleSession?.targetProperty ?? null);
  const [activeBattleMode, setActiveBattleMode] = useState<BattleMode>(
    pendingBattleSession?.mode ?? 'normal'
  );
  const [normalBattleOrigin, setNormalBattleOrigin] =
    useState<NormalBattleOrigin>(
      pendingBattleSession?.mode === 'normal'
        ? pendingBattleSession.normalOrigin ?? 'market'
        : 'market'
    );
  const showTrainingSelector = false;
  const [endingNotice, setEndingNotice] = useState<'normal' | 'savage' | 'true' | null>(null);
  const announcedEndingRef = useRef<'normal' | 'savage' | 'true' | null>(null);
  const [battleTimeScale, setBattleTimeScale] = useState(
    pendingBattleSession ? 0 : 1
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [battleFrameRate, setBattleFrameRate] = useState<BattleFrameRate>(() => {
    try {
      const stored = window.localStorage.getItem(
        BATTLE_FRAME_RATE_STORAGE_KEY
      );
      if (stored === '30' || stored === '60') {
        return Number(stored) as BattleFrameRate;
      }
      const legacySetting = window.localStorage.getItem(
        LEGACY_LIGHTWEIGHT_MODE_STORAGE_KEY
      );
      const migratedRate: BattleFrameRate =
        legacySetting === 'off' ? 60 : 30;
      window.localStorage.setItem(
        BATTLE_FRAME_RATE_STORAGE_KEY,
        String(migratedRate)
      );
      window.localStorage.removeItem(LEGACY_LIGHTWEIGHT_MODE_STORAGE_KEY);
      return migratedRate;
    } catch {
      return 30;
    }
  });
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [companyName, setCompanyName] = useState<string>(
    initialSave?.companyName || loadLegacyCompanyName() || GAME_WORLD.companyName
  );
  const [showLaunchIntro, setShowLaunchIntro] = useState(
    !initialSave && !pendingBattleSession
  );
  const [offlineIncomeNotice, setOfflineIncomeNotice] = useState(0);
  const [unlockNotice, setUnlockNotice] = useState<CommunityType | null>(null);
  const [seenUnlockIds, setSeenUnlockIds] = useState<string[]>(
    () => initialSave?.seenUnlockIds || []
  );
  const [featureUnlockNoticeId, setFeatureUnlockNoticeId] = useState<FeatureUnlockId | null>(null);
  const [unlockExplanationQueue, setUnlockExplanationQueue] = useState<
    UnlockExplanation[]
  >([]);
  const [marketNavigationRequest, setMarketNavigationRequest] = useState<{
    id: number;
    mode: 'map' | 'targets';
    community: CommunityType | 'ALL';
  } | null>(null);
  const [skillsStoryReturn, setSkillsStoryReturn] = useState<
    | { destination: 'market'; community: CommunityType }
    | { destination: 'savage' }
    | { destination: 'cartels' }
    | null
  >(null);
  const deferredBattleIncomeRef = useRef(0);
  const highEndViewRef = useRef<HTMLDivElement | null>(null);
  const highEndBattlePlaceholderHeightRef = useRef(0);

  useEffect(() => {
    const unlockAudio = () => soundFx.unlock();
    window.addEventListener('pointerdown', unlockAudio, { capture: true });
    window.addEventListener('keydown', unlockAudio, { capture: true });
    window.addEventListener('pageshow', unlockAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio, { capture: true });
      window.removeEventListener('keydown', unlockAudio, { capture: true });
      window.removeEventListener('pageshow', unlockAudio);
    };
  }, []);

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
    const conqueredIds = new Set(conqueredCommunityIds);
    return TRADE_COMMUNITIES.map((community) => {
      const communityProperties = getCampaignProperties(properties, community.id);
      const owned = communityProperties.filter(
        (property) => property.owner === 'player'
      ).length;
      const currentlyControlled =
        communityProperties.length > 0 && owned === communityProperties.length;

      return {
        ...community,
        owned,
        total: communityProperties.length,
        conquered: conqueredIds.has(community.id),
        currentlyControlled,
      };
    });
  }, [conqueredCommunityIds, properties]);

  const conqueredCommunityCount = communityProgress.filter(
    (community) => community.conquered
  ).length;
  const windProgressionStage = getWindProgressionStage(
    conqueredCommunityCount
  );

  const conqueredCommunityIdSet = useMemo(
    () => new Set(conqueredCommunityIds),
    [conqueredCommunityIds]
  );
  const unlockedCommunityIds = useMemo(
    () => getUnlockedCommunityIds(conqueredCommunityIdSet),
    [conqueredCommunityIdSet]
  );

  const tradeAllianceUnlocked = !!communityProgress.find(
    (community) => community.id === 'クリスタリウム'
  )?.conquered;
  const normalCampaignComplete =
    conqueredCommunityCount === COMMUNITY_CAMPAIGN_ORDER.length;
  const savageUnlocked = normalCampaignComplete || normalEndingSeen;
  const savageClearedSet = useMemo(
    () => new Set(savageClearedPropertyIds),
    [savageClearedPropertyIds]
  );
  const openingAutoUnlocked = savageClearedSet.has(
    FIRST_SAVAGE_FIRST_LAYER_ID
  );
  const criticalAutoUnlocked = savageClearedSet.has(
    FIRST_SAVAGE_FOURTH_LAYER_ID
  );
  const savageProperties = useMemo(
    () => buildSavageProperties(INITIAL_PROPERTIES, savageClearedSet, companyName),
    [companyName, savageClearedSet]
  );
  const savageTargetCount = savageProperties.length;
  const savageComplete =
    savageTargetCount > 0 && savageClearedSet.size === savageTargetCount;
  const savageUnlockedIds = useMemo(
    () => getUnlockedSavageRaidIds(savageClearedSet),
    [savageClearedSet]
  );
  const groupSynergies = useMemo(
    () =>
      applySavageSynergyUpgrades(
        INITIAL_GROUP_SYNERGIES,
        savageClearedSet
      ).map((synergy) =>
        synergy.id === GRAND_COMPANY_EORZEA_ID && synergy.battleEffect
          ? {
              ...synergy,
              battleEffect: {
                ...synergy.battleEffect,
                capitalPressureMultiplier: getBattleOnlySynergyMultiplier(
                  synergy,
                  grandCompanyEorzeaIntegrated
                ),
              },
            }
          : synergy
      ),
    [grandCompanyEorzeaIntegrated, savageClearedSet]
  );
  const ultimateUnlocked = savageComplete;
  const ultimateProperty = useMemo(
    () => buildUltimateProperty(ultimateCleared, companyName),
    [companyName, ultimateCleared]
  );
  const cruelUnlocked = ultimateCleared;
  const cruelProperty = useMemo(
    () => buildCruelProperty(cruelCleared, companyName),
    [companyName, cruelCleared]
  );
  const karmaUnlocked = cruelCleared;
  const karmaProperty = useMemo(
    () => buildKarmaProperty(karmaCleared, companyName),
    [companyName, karmaCleared]
  );
  const phantomUnlocked = cruelCleared;
  const phantomProperty = useMemo(
    () => findPhantomProperty(savageProperties, phantomRaidId),
    [phantomRaidId, savageProperties]
  );
  const savagePropertyRevenueMultipliers = useMemo(
    () =>
      new Map(
        INITIAL_PROPERTIES.map((property) => [
          property.id,
          getSavagePropertyYieldMultiplier(property.id, savageClearedSet),
        ])
      ),
    [savageClearedSet]
  );

  useEffect(() => {
    if (!tradeAllianceUnlocked && activeTab === 'cartels') setActiveTab('market');
    if (!savageUnlocked && activeTab === 'savage') setActiveTab('market');
  }, [activeTab, savageUnlocked, tradeAllianceUnlocked]);

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
      if (community.currentlyControlled) {
        entry.label = '地域人脈完成';
        entry.playerBonus = 0.12;
        entry.enemyBudgetDiscount = 0.08;
      }
      result[community.id] = entry;
    });
    return result;
  }, [communityProgress]);

  const tradeNetworkBonus = Math.min(0.16, conqueredCommunityCount * 0.02);
  const totalAssetValue = useMemo(
    () => calculateTotalAssetValue(totalFunds, ownedProperties),
    [ownedProperties, totalFunds]
  );

  // Active Synergies Count & Bonus Multiplier
  const { activeGroupSynergies, activeSynergiesCount, bonusMultiplier } = useMemo(() => {
    const active = groupSynergies.filter((syn) =>
      isGroupSynergyUnlocked({
        synergy: syn,
        ownedPropertyIds,
        conqueredCommunityIds: conqueredCommunityIdSet,
        savageClearedRaidIds: savageClearedSet,
      })
    );
    return {
      activeGroupSynergies: active,
      activeSynergiesCount: active.length,
      bonusMultiplier: active.reduce(
        (multiplier, syn) =>
          syn.battleOnly
            ? multiplier
            : multiplier * syn.bonusYieldMultiplier,
        1
      ),
    };
  }, [conqueredCommunityIdSet, groupSynergies, ownedPropertyIds, savageClearedSet]);

  const latestProgressionBattleSynergy =
    getLatestProgressionBattleSynergy(activeGroupSynergies);
  const selectableActiveGroupSynergies = activeGroupSynergies.filter(
    (synergy) =>
      !synergy.battleOnly ||
      synergy.id === latestProgressionBattleSynergy?.id
  );
  const selectedBattleSynergy =
    selectableActiveGroupSynergies.find(
      (synergy) => synergy.id === selectedBattleSynergyId
    ) ??
    latestProgressionBattleSynergy ??
    null;
  const previousActiveSynergyIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const activeIds = new Set(activeGroupSynergies.map((synergy) => synergy.id));
    const previousIds = previousActiveSynergyIdsRef.current;
    const newlyLearned = previousIds
      ? activeGroupSynergies.filter((synergy) => !previousIds.has(synergy.id))
      : [];
    const bestNewlyLearned = newlyLearned.reduce<GroupSynergy | null>(
      (best, synergy) =>
        !best ||
        getGroupSynergySelectionPriority(synergy) >
          getGroupSynergySelectionPriority(best)
          ? synergy
          : best,
      null
    );
    const selectedActiveSynergy = selectableActiveGroupSynergies.find(
      (synergy) => synergy.id === selectedBattleSynergyId
    );
    const shouldAutoEquipNew =
      !!bestNewlyLearned &&
      (
        !selectedActiveSynergy ||
        getGroupSynergySelectionPriority(bestNewlyLearned) >
          getGroupSynergySelectionPriority(selectedActiveSynergy)
      );

    setSelectedBattleSynergyId((current) => {
      const currentActiveSynergy = selectableActiveGroupSynergies.find(
        (synergy) => synergy.id === current
      );
      if (
        bestNewlyLearned &&
        (
          !currentActiveSynergy ||
          getGroupSynergySelectionPriority(bestNewlyLearned) >
            getGroupSynergySelectionPriority(currentActiveSynergy)
        )
      ) {
        return bestNewlyLearned.id;
      }
      // A saved progression synergy may still be unlocked but already
      // superseded. Normalize it to the currently selectable generation so
      // the setup screen and the battle resolve the same manual synergy.
      if (currentActiveSynergy) return current;
      return selectableActiveGroupSynergies.reduce<GroupSynergy | null>(
        (best, synergy) =>
          !best ||
          getGroupSynergySelectionPriority(synergy) >=
            getGroupSynergySelectionPriority(best)
            ? synergy
            : best,
        null
      )?.id ?? null;
    });

    if (previousIds && bestNewlyLearned && shouldAutoEquipNew) {
      addGameLog(
        `【戦闘連携更新】${bestNewlyLearned.name}を修得。バトル用SYNERGY 1枠へ自動装備しました。`,
        'success'
      );
    }
    if (previousIds && newlyLearned.length > 0) {
      setUnlockExplanationQueue((current) => {
        const queuedKeys = new Set(current.map((notice) => notice.key));
        const additions = newlyLearned
          .map(getSynergyUnlockExplanation)
          .filter(
            (notice) =>
              !seenUnlockIds.includes(notice.key) &&
              !queuedKeys.has(notice.key)
          );
        return additions.length > 0 ? [...current, ...additions] : current;
      });
    }
    previousActiveSynergyIdsRef.current = activeIds;
  }, [activeGroupSynergies, seenUnlockIds, selectedBattleSynergyId]);

  const reachedFeatureUnlockIds = useMemo(() => {
    const reached: FeatureUnlockId[] = [];
    if (ownedProperties.length >= 1) reached.push('subsidiary_support');
    if (windProgressionStage >= 1) reached.push('market_wind');
    if (ownedProperties.length + 1 >= 4) reached.push('light_party_limit_break');
    if (windProgressionStage >= 2) reached.push('rival_wind');
    if (windProgressionStage >= 3) reached.push('turbulent_wind');
    if (ownedProperties.length + 1 >= 8) reached.push('full_party');
    if (tradeAllianceUnlocked) reached.push('trade_alliance');
    if (openingAutoUnlocked) reached.push('opening_auto');
    if (criticalAutoUnlocked) reached.push('critical_auto');
    return reached;
  }, [
    criticalAutoUnlocked,
    openingAutoUnlocked,
    ownedProperties.length,
    totalAssetValue,
    tradeAllianceUnlocked,
    windProgressionStage,
  ]);

  useEffect(() => {
    if (!normalCampaignComplete && !savageComplete && !ultimateCleared) {
      announcedEndingRef.current = null;
    }
    if (
      showLaunchIntro ||
      showTrainingSelector ||
      activeBattleProperty ||
      unlockNotice ||
      featureUnlockNoticeId ||
      unlockExplanationQueue.length > 0
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
    showTrainingSelector,
    unlockNotice,
    unlockExplanationQueue.length,
  ]);

  const acknowledgeFeatureUnlock = () => {
    if (!featureUnlockNoticeId) return;
    const opensAbilitySetup =
      featureUnlockNoticeId === 'opening_auto' ||
      featureUnlockNoticeId === 'critical_auto';
    setSeenUnlockIds((current) => {
      const additions =
        featureUnlockNoticeId === 'critical_auto'
          ? [featureUnlockNoticeId, `skill:${LIVING_DEAD_SKILL_ID}`]
          : [featureUnlockNoticeId];
      return Array.from(new Set([...current, ...additions]));
    });
    setFeatureUnlockNoticeId(null);
    if (opensAbilitySetup) {
      if (featureUnlockNoticeId === 'critical_auto') {
        const nextEquippedSkillIds = equippedSkillIds.includes(
          LIVING_DEAD_SKILL_ID
        )
          ? equippedSkillIds
          : [...equippedSkillIds, LIVING_DEAD_SKILL_ID];
        const loadout = normalizeSavedAbilityLoadout({
          equippedSkillIds: nextEquippedSkillIds,
          openingAutoSkillId:
            openingAutoSkillId === LIVING_DEAD_SKILL_ID
              ? null
              : openingAutoSkillId,
          criticalAutoSkillId: LIVING_DEAD_SKILL_ID,
          reserveSkillId: null,
          validSkillIds: unlockedSkillIds,
        });
        setEquippedSkillIds(loadout.equippedSkillIds);
        setOpeningAutoSkillId(loadout.openingAutoSkillId);
        setCriticalAutoSkillId(loadout.criticalAutoSkillId);
      }
      setSkillsStoryReturn({ destination: 'savage' });
      setActiveTab('skills');
    }
    soundFx.playCoin();
  };

  const featureUnlockNotice = featureUnlockNoticeId
    ? FEATURE_UNLOCKS[featureUnlockNoticeId]
    : null;

  useEffect(() => {
    if (
      showLaunchIntro ||
      showTrainingSelector ||
      activeBattleProperty ||
      unlockNotice ||
      featureUnlockNoticeId ||
      unlockExplanationQueue.length > 0 ||
      endingNotice
    ) return;
    if (normalCampaignComplete && !normalEndingSeen) {
      if (announcedEndingRef.current === 'normal') return;
      announcedEndingRef.current = 'normal';
      setEndingNotice('normal');
      soundFx.playVictory();
      return;
    }
    if (savageComplete && !savageEndingSeen) {
      if (announcedEndingRef.current === 'savage') return;
      announcedEndingRef.current = 'savage';
      setEndingNotice('savage');
      soundFx.playVictory();
      return;
    }
    if (ultimateCleared && !trueEndingSeen) {
      if (announcedEndingRef.current === 'true') return;
      announcedEndingRef.current = 'true';
      setEndingNotice('true');
      soundFx.playVictory();
    }
  }, [
    activeBattleProperty, endingNotice, featureUnlockNoticeId, normalCampaignComplete,
    normalEndingSeen, savageComplete, savageEndingSeen, showLaunchIntro, showTrainingSelector,
    trueEndingSeen, ultimateCleared, unlockNotice, unlockExplanationQueue.length,
  ]);

  const acknowledgeEnding = () => {
    if (endingNotice === 'normal') {
      setNormalEndingSeen(true);
      setActiveTab('savage');
      addGameLog('【商戦 零式 解放】十都市の人脈をすべて開通。高難度交易レイドへの航路が開きました！', 'success');
    } else if (endingNotice === 'savage') {
      setSavageEndingSeen(true);
      setActiveTab('savage');
      addGameLog('【絶商戦 解放】商戦 零式3編・全12章を踏破。別枠の最終高難度交易戦への挑戦資格を得ました！', 'success');
    } else if (endingNotice === 'true') {
      setTrueEndingSeen(true);
      setActiveTab('savage');
      addGameLog('【真・全商戦制覇】絶商戦を踏破し、星海交易の最終記録を達成しました！', 'success');
    }
    setEndingNotice(null);
    soundFx.playFeatureUnlocked();
  };

  const unlockedSkillIds = useMemo(
    () =>
      new Set(
        skills
          .filter((skill) =>
            isSkillUnlocked({
              skill,
              ownedProperties,
              totalFunds,
              activeSynergyCount: activeSynergiesCount,
              conqueredCommunityIds: conqueredCommunityIdSet,
              savageClearedRaidIds: savageClearedSet,
            })
          )
          .map((skill) => skill.id)
      ),
    [
      activeSynergiesCount,
      conqueredCommunityIdSet,
      ownedProperties,
      savageClearedSet,
      skills,
      totalFunds,
    ]
  );
  const previousUnlockedSkillIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const previousIds = previousUnlockedSkillIdsRef.current;
    if (previousIds) {
      const newlyLearned = skills.filter(
        (skill) =>
          unlockedSkillIds.has(skill.id) &&
          !previousIds.has(skill.id) &&
          // Layer 4 presents Living Dead and the critical AUTO role as one
          // reward instead of stacking two consecutive unlock dialogs.
          !(
            criticalAutoUnlocked &&
            !seenUnlockIds.includes('critical_auto') &&
            skill.id === LIVING_DEAD_SKILL_ID
          )
      );
      if (newlyLearned.length > 0) {
        setUnlockExplanationQueue((current) => {
          const queuedKeys = new Set(current.map((notice) => notice.key));
          const additions = newlyLearned
            .map(getSkillUnlockExplanation)
            .filter(
              (notice) =>
                !seenUnlockIds.includes(notice.key) &&
                !queuedKeys.has(notice.key)
            );
          return additions.length > 0 ? [...current, ...additions] : current;
        });
      }
    }
    previousUnlockedSkillIdsRef.current = new Set(unlockedSkillIds);
  }, [criticalAutoUnlocked, seenUnlockIds, skills, unlockedSkillIds]);

  const unlockExplanationNotice = unlockExplanationQueue[0] ?? null;
  const unlockExplanationVisible =
    !!unlockExplanationNotice &&
    !showLaunchIntro &&
    !showTrainingSelector &&
    !activeBattleProperty &&
    !endingNotice &&
    !featureUnlockNoticeId &&
    !unlockNotice;
  const announcedUnlockExplanationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !unlockExplanationVisible ||
      !unlockExplanationNotice ||
      announcedUnlockExplanationKeyRef.current === unlockExplanationNotice.key
    ) {
      return;
    }
    announcedUnlockExplanationKeyRef.current = unlockExplanationNotice.key;
    soundFx.playFeatureUnlocked();
  }, [unlockExplanationNotice, unlockExplanationVisible]);

  const acknowledgeUnlockExplanation = () => {
    if (!unlockExplanationNotice) return;
    setSeenUnlockIds((current) =>
      current.includes(unlockExplanationNotice.key)
        ? current
        : [...current, unlockExplanationNotice.key]
    );
    setUnlockExplanationQueue((current) => current.slice(1));
    if (unlockExplanationQueue.length === 1) setActiveTab('skills');
    soundFx.playCoin();
  };

  const effectiveAbilityLoadout = useMemo(
    () =>
      normalizeSavedAbilityLoadout({
        equippedSkillIds,
        openingAutoSkillId: openingAutoUnlocked
          ? openingAutoSkillId
          : null,
        criticalAutoSkillId: criticalAutoUnlocked
          ? criticalAutoSkillId
          : null,
        reserveSkillId: null,
        validSkillIds: unlockedSkillIds,
      }),
    [
      criticalAutoSkillId,
      criticalAutoUnlocked,
      equippedSkillIds,
      openingAutoSkillId,
      openingAutoUnlocked,
      unlockedSkillIds,
    ]
  );

  useEffect(() => {
    if (
      effectiveAbilityLoadout.equippedSkillIds.join('|') !==
      equippedSkillIds.join('|')
    ) {
      setEquippedSkillIds(effectiveAbilityLoadout.equippedSkillIds);
    }
    if (
      effectiveAbilityLoadout.openingAutoSkillId !== openingAutoSkillId
    ) {
      setOpeningAutoSkillId(
        effectiveAbilityLoadout.openingAutoSkillId
      );
    }
    if (
      effectiveAbilityLoadout.criticalAutoSkillId !== criticalAutoSkillId
    ) {
      setCriticalAutoSkillId(
        effectiveAbilityLoadout.criticalAutoSkillId
      );
    }
  }, [
    criticalAutoSkillId,
    effectiveAbilityLoadout,
    equippedSkillIds,
    openingAutoSkillId,
  ]);

  // Total Passive Revenue Yield per second (I_net)
  const passiveRevenue = useMemo(() => {
    const base = ownedProperties.reduce(
      (sum, property) =>
        sum +
        property.annualRevenue *
          getSavagePropertyYieldMultiplier(property.id, savageClearedSet),
      0
    );
    return Math.round(base * bonusMultiplier * PASSIVE_REVENUE_MULTIPLIER);
  }, [bonusMultiplier, ownedProperties, savageClearedSet]);

  type SavePayload = Parameters<typeof saveGame>[0];
  const persistGameState = (overrides: Partial<SavePayload> = {}) => {
    return saveGame({
      companyName: companyName.trim() || GAME_WORLD.companyName,
      totalFunds,
      properties,
      equippedSkillIds,
      openingAutoSkillId: effectiveAbilityLoadout.openingAutoSkillId,
      criticalAutoSkillId: effectiveAbilityLoadout.criticalAutoSkillId,
      // Older saves may contain this field; persisting null completes the
      // migration to the five active slots without exposing a waiting slot.
      reserveSkillId: null,
      alliance,
      seenUnlockIds,
      limitBreakCharge,
      savageClearedPropertyIds,
      savageProgressVersion: 3,
      normalEndingSeen,
      conqueredCommunityIds,
      savageEndingSeen,
      ultimateCleared,
      cruelCleared,
      karmaCleared,
      phantomWinStreak,
      trueEndingSeen,
      selectedBattleSynergyId,
      grandCompanyEorzeaIntegrated,
      passiveIncomePaused: false,
      ...overrides,
    });
  };

  const offlineIncomeAppliedRef = useRef(false);
  useEffect(() => {
    if (offlineIncomeAppliedRef.current) return;
    offlineIncomeAppliedRef.current = true;
    if (!initialSave || passiveRevenue <= 0) return;
    const income = calculateOfflineIncome(
      passiveRevenue,
      initialSave.lastSavedAt
    );
    if (income <= 0) return;
    setTotalFunds((current) => current + income);
    setOfflineIncomeNotice(income);
  }, [initialSave, passiveRevenue]);

  useEffect(() => {
    if (offlineIncomeNotice <= 0) return;
    const timer = window.setTimeout(() => setOfflineIncomeNotice(0), 4600);
    return () => window.clearTimeout(timer);
  }, [offlineIncomeNotice]);

  // IDLE CASH HARVEST ENGINE (1 Second Ticker)
  useEffect(() => {
    const timer = setInterval(() => {
      if (passiveRevenue > 0) {
        if (activeBattleProperty) {
          // Do not rerender and synchronously rewrite the full save every
          // second behind an iPad battle. Income still accrues and is applied
          // as one state update when the modal closes.
          deferredBattleIncomeRef.current += passiveRevenue;
        } else {
          setTotalFunds((prev) => prev + passiveRevenue);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeBattleProperty, passiveRevenue]);

  useEffect(() => {
    if (activeBattleProperty || deferredBattleIncomeRef.current <= 0) return;
    const deferredIncome = deferredBattleIncomeRef.current;
    deferredBattleIncomeRef.current = 0;
    setTotalFunds((current) => current + deferredIncome);
  }, [activeBattleProperty]);

  useEffect(() => {
    if (showLaunchIntro || activeBattleProperty) return;
    const timer = window.setTimeout(() => {
      persistGameState();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    alliance,
    activeBattleProperty,
    activeBattleMode,
    companyName,
    criticalAutoSkillId,
    equippedSkillIds,
    limitBreakCharge,
    normalEndingSeen,
    openingAutoSkillId,
    conqueredCommunityIds,
    properties,
    savageClearedPropertyIds,
    savageEndingSeen,
    seenUnlockIds,
    selectedBattleSynergyId,
    grandCompanyEorzeaIntegrated,
    showLaunchIntro,
    totalFunds,
    trueEndingSeen,
    ultimateCleared,
    cruelCleared,
    karmaCleared,
    phantomWinStreak,
  ]);

  useEffect(() => {
    if (!activeBattleProperty) clearPendingBattleSession();
  }, [activeBattleProperty]);

  // Handlers
  const hasBattleBrokerageFunds = (property: Property) => {
    const brokerageFee = Math.round(property.marketPrice * 0.03);
    if (totalFunds >= brokerageFee) return true;
    soundFx.playWarning();
    addGameLog(
      `【資金不足】${property.name}との商戦には仲介手数料 ${formatCurrency(
        brokerageFee
      )} が必要です。`,
      'warning'
    );
    return false;
  };

  const handleStartBuyout = (
    property: Property,
    origin: NormalBattleOrigin = 'market'
  ) => {
    if (!unlockedCommunityIds.has(property.community)) {
      soundFx.playWarning();
      addGameLog(`【人脈未開通】${property.community}へ進むには、手前の都市で必要な人脈をそろえてください。`, 'warning');
      setActiveTab(origin);
      return;
    }
    if (!hasBattleBrokerageFunds(property)) return;
    soundFx.playCoin();
    setSkillsStoryReturn(null);
    persistGameState();
    persistPendingBattleSession('normal', property, { normalOrigin: origin });
    setNormalBattleOrigin(origin);
    setBattleTimeScale(0);
    setActiveBattleMode('normal');
    setActiveBattleProperty(property);
  };

  const handleStartSavageBuyout = (property: Property) => {
    if (!savageUnlocked || !savageUnlockedIds.has(property.id)) return;
    if (!hasBattleBrokerageFunds(property)) return;
    soundFx.playCoin();
    setSkillsStoryReturn(null);
    highEndBattlePlaceholderHeightRef.current =
      highEndViewRef.current?.getBoundingClientRect().height ?? 0;
    persistGameState();
    persistPendingBattleSession('savage', property);
    setBattleTimeScale(0);
    setActiveBattleMode('savage');
    setActiveBattleProperty(property);
  };

  const handleStartUltimateBuyout = (property: Property) => {
    if (!ultimateUnlocked) return;
    if (!hasBattleBrokerageFunds(property)) return;
    soundFx.playCoin();
    setSkillsStoryReturn(null);
    highEndBattlePlaceholderHeightRef.current =
      highEndViewRef.current?.getBoundingClientRect().height ?? 0;
    persistGameState();
    persistPendingBattleSession('ultimate', property);
    setBattleTimeScale(0);
    setActiveBattleMode('ultimate');
    setActiveBattleProperty(property);
  };

  const handleStartCruelBuyout = (property: Property) => {
    if (!cruelUnlocked) return;
    const entryRequirement = calculateCruelEntryRequirement(property.marketPrice);
    if (totalFunds < entryRequirement) {
      soundFx.playWarning();
      addGameLog(
        `【資金不足】${property.name}への挑戦には、参加手数料と自己資本署名の原資を合わせて ${formatCurrency(entryRequirement)} が必要です。`,
        'warning'
      );
      return;
    }
    soundFx.playWarning();
    setSkillsStoryReturn(null);
    highEndBattlePlaceholderHeightRef.current =
      highEndViewRef.current?.getBoundingClientRect().height ?? 0;
    persistGameState();
    persistPendingBattleSession('cruel', property);
    setBattleTimeScale(0);
    setActiveBattleMode('cruel');
    setActiveBattleProperty(property);
  };

  const handleStartKarmaBuyout = (property: Property) => {
    if (!karmaUnlocked || property.id !== KARMA_RAID_DEFINITION.id) return;
    soundFx.playWarning();
    setSkillsStoryReturn(null);
    highEndBattlePlaceholderHeightRef.current =
      highEndViewRef.current?.getBoundingClientRect().height ?? 0;
    // Karma is a record-only duty. LB gained or spent in the imitation ledger
    // is battle-local and discarded when the attempt closes.
    setKarmaBattleLimitBreakCharge(limitBreakCharge);
    persistGameState();
    persistPendingBattleSession('karma', property);
    setBattleTimeScale(0);
    setActiveBattleMode('karma');
    setActiveBattleProperty(property);
  };

  const handleStartPhantomBuyout = (property: Property) => {
    if (!phantomUnlocked || property.id !== phantomRaidId) return;
    soundFx.playWarning();
    setSkillsStoryReturn(null);
    highEndBattlePlaceholderHeightRef.current =
      highEndViewRef.current?.getBoundingClientRect().height ?? 0;
    // Phantom uses a battle-local copy. Any charge gained or spent during the
    // record attempt is discarded when it closes.
    setPhantomBattleLimitBreakCharge(limitBreakCharge);
    persistGameState();
    persistPendingBattleSession('phantom', property);
    setBattleTimeScale(0);
    setActiveBattleMode('phantom');
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
    celebrationGiftCost,
    celebrationGiftRate,
    rebelledProperties,
    survivingRiskUpdates,
  }: BattleResult) => {
    if (
      !activeBattleProperty ||
      targetProperty.id !== activeBattleProperty.id
    ) {
      return false;
    }
    if (activeBattleMode === 'karma') {
      const projectedKarmaCleared = karmaCleared || winner === 'player';
      const protectedTotalFunds = Math.max(
        0,
        totalFunds + deferredBattleIncomeRef.current
      );
      if (!persistGameState({
        totalFunds: protectedTotalFunds,
        properties,
        alliance,
        limitBreakCharge,
        savageClearedPropertyIds,
        ultimateCleared,
        cruelCleared,
        karmaCleared: projectedKarmaCleared,
        phantomWinStreak,
      })) {
        return false;
      }
      clearPendingBattleSession();
      deferredBattleIncomeRef.current = 0;
      setTotalFunds(protectedTotalFunds);
      setKarmaCleared(projectedKarmaCleared);
      setKarmaBattleLimitBreakCharge(limitBreakCharge);
      addGameLog(
        winner === 'player'
          ? `【業商戦踏破】${targetProperty.name}の四頁をすべて破りました。通常資金・所有権・人脈・LB・幻の連勝記録は変化しません。`
          : `【業商戦ワイプ】${targetProperty.name}のものまねを崩し切れませんでした。通常資金・所有権・人脈・LB・幻の連勝記録は保護されています。`,
        winner === 'player' ? 'success' : 'warning'
      );
      setSkillsStoryReturn(null);
      setActiveTab('savage');
      setActiveBattleProperty(null);
      setActiveBattleMode('normal');
      setBattleTimeScale(1);
      return true;
    }
    if (activeBattleMode === 'phantom') {
      const projectedPhantomWinStreak =
        winner === 'player'
          ? normalizePhantomWinStreak(phantomWinStreak + 1)
          : 0;
      // Phantom is a record-only duty. Even if the presenter accidentally
      // returns non-zero settlement values, the authoritative save accepts
      // only normal passive income earned while the battle was open.
      const protectedTotalFunds = Math.max(
        0,
        totalFunds + deferredBattleIncomeRef.current
      );
      if (!persistGameState({
        totalFunds: protectedTotalFunds,
        properties,
        alliance,
        limitBreakCharge,
        savageClearedPropertyIds,
        ultimateCleared,
        cruelCleared,
        karmaCleared,
        phantomWinStreak: projectedPhantomWinStreak,
      })) {
        return false;
      }
      clearPendingBattleSession();
      deferredBattleIncomeRef.current = 0;
      setTotalFunds(protectedTotalFunds);
      setPhantomWinStreak(projectedPhantomWinStreak);
      setPhantomBattleLimitBreakCharge(limitBreakCharge);
      setPhantomRaidId(pickRandomPhantomRaid().id);
      addGameLog(
        winner === 'player'
          ? `【幻・商戦 勝利】${targetProperty.name}を退け、${projectedPhantomWinStreak}連勝。通常資金・所有権・人脈・LBは変化しません。次の幻影を抽選しました。`
          : `【幻・商戦 連勝終了】${targetProperty.name}に敗れ、連勝記録は0へ戻りました。通常資金・所有権・人脈・LBは変化しません。次の幻影を抽選しました。`,
        winner === 'player' ? 'success' : 'warning'
      );
      setSkillsStoryReturn(null);
      setActiveTab('savage');
      setActiveBattleProperty(null);
      setActiveBattleMode('normal');
      setBattleTimeScale(1);
      return true;
    }
    const isNormalBattle = activeBattleMode === 'normal';
    const returnsToAlliance =
      isNormalBattle && normalBattleOrigin === 'cartels';
    const isExtremeReacquisitionBattle =
      isNormalBattle && isExtremeReacquisition(targetProperty);
    const settlesHighEndVictory =
      winner === 'player' &&
      victoryReward > 0 &&
      (activeBattleMode === 'savage' ||
        activeBattleMode === 'ultimate' ||
        activeBattleMode === 'cruel');
    const appliesPersistentLoyaltySettlement =
      isNormalBattle || settlesHighEndVictory;
    const projectedProperties = isNormalBattle
      ? applyNormalBattlePropertyUpdates({
          properties,
          winner,
          targetPropertyId: targetProperty.id,
          companyName,
          rebelledProperties,
          survivingRiskUpdates,
        })
      : settlesHighEndVictory
        ? applyLoyaltySettlementPropertyUpdates({
            properties,
            rebelledProperties,
            survivingRiskUpdates,
          })
      : properties;
    const liquidationCashback = appliesPersistentLoyaltySettlement
      ? calculateLiquidationCashback(rebelledProperties)
      : 0;
    // 仲介手数料に加え、直接出資の一部が買収費用・撤退損として確定する。
    const settledTotalFunds = Math.max(
      0,
      totalFunds +
        deferredBattleIncomeRef.current -
        brokerageFee -
        settlementCost +
        battleCashDelta +
        (winner === 'player' ? victoryReward : 0) +
        liquidationCashback -
        celebrationGiftCost
    );
    const currentlyConquersTargetCity =
      isNormalBattle &&
      winner === 'player' &&
      hasCompletedCommunityNetwork(
        projectedProperties,
        targetProperty.community
      );
    const newlyConquered =
      currentlyConquersTargetCity &&
      !conqueredCommunityIdSet.has(targetProperty.community);
    const projectedConqueredCommunityIds = newlyConquered
      ? COMMUNITY_CAMPAIGN_ORDER.filter(
          (communityId) =>
            conqueredCommunityIdSet.has(communityId) ||
            communityId === targetProperty.community
        )
      : conqueredCommunityIds;
    const breaksAlliance =
      isNormalBattle &&
      winner === 'player' &&
      shouldBreakAllianceForTarget(alliance, targetProperty);
    const projectedAlliance: AllianceState = breaksAlliance
      ? {
          allyId: '',
          allyName: '',
          active: false,
          allyKind: 'company',
          relationType: 'commercial_alliance',
        }
      : alliance;
    const projectedSavageClearedPropertyIds =
      activeBattleMode === 'savage' && winner === 'player'
        ? Array.from(new Set([...savageClearedPropertyIds, targetProperty.id]))
        : savageClearedPropertyIds;
    const projectedUltimateCleared =
      ultimateCleared ||
      (activeBattleMode === 'ultimate' && winner === 'player');
    const projectedCruelCleared =
      cruelCleared ||
      (activeBattleMode === 'cruel' && winner === 'player');
    const projectedGrandCompanyEorzeaIntegrated =
      grandCompanyEorzeaIntegrated ||
      projectedProperties.every((property) => property.owner === 'player');
    const normalBattleNavigation = isNormalBattle
      ? getNormalBattleNavigation({
          winner,
          targetCommunity: targetProperty.community,
          newlyConquered,
          isReacquisition: isExtremeReacquisitionBattle,
        })
      : null;
    const projectedOwnedProperties = projectedProperties.filter(
      (property) => property.owner === 'player'
    );
    const projectedOwnedPropertyIds = new Set(
      projectedOwnedProperties.map((property) => property.id)
    );
    const projectedConqueredCommunityIdSet = new Set(
      projectedConqueredCommunityIds
    );
    const projectedActiveSynergies = groupSynergies.filter((synergy) =>
      isGroupSynergyUnlocked({
        synergy,
        ownedPropertyIds: projectedOwnedPropertyIds,
        conqueredCommunityIds: projectedConqueredCommunityIdSet,
        savageClearedRaidIds: new Set(projectedSavageClearedPropertyIds),
      })
    );
    const currentActiveSynergyIds = new Set(
      activeGroupSynergies.map((synergy) => synergy.id)
    );
    const gainsAbilityExplanation =
      winner === 'player' &&
      (
        skills.some(
          (skill) =>
            !unlockedSkillIds.has(skill.id) &&
            !seenUnlockIds.includes(`skill:${skill.id}`) &&
            isSkillUnlocked({
              skill,
              ownedProperties: projectedOwnedProperties,
              totalFunds: settledTotalFunds,
              activeSynergyCount: projectedActiveSynergies.length,
              conqueredCommunityIds: projectedConqueredCommunityIdSet,
              savageClearedRaidIds: new Set(
                projectedSavageClearedPropertyIds
              ),
            })
        ) ||
        projectedActiveSynergies.some(
          (synergy) =>
            !currentActiveSynergyIds.has(synergy.id) &&
            !seenUnlockIds.includes(`synergy:${synergy.id}`)
        )
      );

    // Save the complete, deterministic result before mutating React state or
    // deleting the recovery marker. A denied Storage write leaves the result
    // button retryable instead of partially applying the settlement.
    if (!persistGameState({
      totalFunds: settledTotalFunds,
      properties: projectedProperties,
      alliance: projectedAlliance,
      conqueredCommunityIds: projectedConqueredCommunityIds,
      savageClearedPropertyIds: projectedSavageClearedPropertyIds,
      ultimateCleared: projectedUltimateCleared,
      cruelCleared: projectedCruelCleared,
      grandCompanyEorzeaIntegrated:
        projectedGrandCompanyEorzeaIntegrated,
    })) {
      return false;
    }
    clearPendingBattleSession();
    deferredBattleIncomeRef.current = 0;
    setTotalFunds(settledTotalFunds);
    if (
      projectedGrandCompanyEorzeaIntegrated &&
      !grandCompanyEorzeaIntegrated
    ) {
      setGrandCompanyEorzeaIntegrated(true);
      addGameLog(
        '【全企業統合】グランドカンパニー・エオルゼアの資本圧力が+0.07強化されました。',
        'success'
      );
    }
    if (newlyConquered) {
      setConqueredCommunityIds(projectedConqueredCommunityIds);
    }

    if (activeBattleMode === 'savage') {
      const firstClear =
        winner === 'player' &&
        !savageClearedPropertyIds.includes(targetProperty.id);

      if (winner === 'player') {
        setSavageClearedPropertyIds(projectedSavageClearedPropertyIds);
        const raid = getSavageRaidDefinition(targetProperty.id);
        const rewardNames = raid?.rewardSynergyIds
          .map((id) => INITIAL_GROUP_SYNERGIES.find((synergy) => synergy.id === id)?.name)
          .filter((name): name is string => !!name)
          .join('・');
        addGameLog(
          `【零式踏破】${targetProperty.name} を攻略しました！（手数料・精算 ${formatCurrency(
            brokerageFee + settlementCost
          )}、攻略報酬 ${formatCurrency(victoryReward)}）${
            firstClear && raid
              ? ` 通常編の地域事業${raid.memberPropertyIds.length}件を+10%強化。${
                  rewardNames
                    ? ` 事業連携「${rewardNames}」も1段階強化。`
                    : ''
                }`
              : ''
          }`,
          'success'
        );
      } else {
        addGameLog(
          `【零式ワイプ】${targetProperty.name} の攻略に失敗。通常事業・契約の保有状態と独立危険度は保護され、同じ層へ再挑戦できます。`,
          'warning'
        );
      }
      if (gainsAbilityExplanation) {
        setSkillsStoryReturn({ destination: 'savage' });
      }
      setActiveTab('savage');
    } else if (activeBattleMode === 'ultimate') {
      if (winner === 'player') {
        setUltimateCleared(true);
        addGameLog(
          `【絶商戦踏破】${targetProperty.name} を攻略しました。最終記録と称号を獲得しました！${
            victoryReward > 0
              ? ` 初回攻略報酬 ${formatCurrency(victoryReward)} の配分と人脈清算も確定しました。`
              : ' 再戦のため攻略報酬と人脈清算はありません。'
          }`,
          'success'
        );
      } else {
        addGameLog(
          `【絶商戦ワイプ】${targetProperty.name} の攻略に失敗。通常事業・契約は保護され、最初から再挑戦できます。`,
          'warning'
        );
      }
      if (gainsAbilityExplanation) {
        setSkillsStoryReturn({ destination: 'savage' });
      }
      setActiveTab('savage');
    } else if (activeBattleMode === 'cruel') {
      if (winner === 'player') {
        setCruelCleared(true);
        addGameLog(
          `【酷・商戦踏破】${targetProperty.name} を攻略しました。闇タタルとの最終記録と称号を獲得しました！${
            victoryReward > 0
              ? ` 初回攻略報酬 ${formatCurrency(victoryReward)} の配分と人脈清算も確定しました。`
              : ' 再戦のため攻略報酬と人脈清算はありません。'
          }`,
          'success'
        );
      } else {
        addGameLog(
          `【酷・商戦ワイプ】${targetProperty.name} の攻略に失敗。通常事業・人脈・独立危険度は保護され、最初から再挑戦できます。`,
          'warning'
        );
      }
      if (gainsAbilityExplanation) {
        setSkillsStoryReturn({ destination: 'savage' });
      }
      setActiveTab('savage');
    } else if (winner === 'player') {
      if (normalBattleNavigation?.unlockedCommunity) {
        setUnlockNotice(normalBattleNavigation.unlockedCommunity);
      }
      if (returnsToAlliance) {
        setSkillsStoryReturn(
          gainsAbilityExplanation ? { destination: 'cartels' } : null
        );
      } else if (normalBattleNavigation) {
        setMarketNavigationRequest((previous) => ({
          id: (previous?.id || 0) + 1,
          mode: normalBattleNavigation.mode,
          community: normalBattleNavigation.community,
        }));
        setSkillsStoryReturn(
          gainsAbilityExplanation
            ? {
                destination: 'market',
                community: normalBattleNavigation.community,
              }
            : null
        );
      }
      setActiveTab(returnsToAlliance ? 'cartels' : 'market');

      addGameLog(
        `【交渉成功】${targetProperty.name} を取得し、自社の保有事業・契約に加えました！（確定支出 ${formatCurrency(
          brokerageFee + settlementCost
        )}＝仲介手数料 ${formatCurrency(brokerageFee)}＋直接出資の精算 ${formatCurrency(
          settlementCost
        )}、運転資金 ${formatCurrency(victoryReward)} を獲得）`,
        'success'
      );

      // Commercial partners own properties; public Grand Company patrons never do.
      if (breaksAlliance) {
        setAlliance(projectedAlliance);
        addGameLog(
          `【協力協定 自動解除】協定企業の傘下事業へ交渉を仕掛けたため、${alliance.allyName} との協定を解除しました。`,
          'danger'
        );
      }
    } else {
      addGameLog(
        `【交渉敗北】${targetProperty.name} の取得交渉に失敗しました。（確定支出 ${formatCurrency(
          brokerageFee + settlementCost
        )}＝仲介手数料 ${formatCurrency(brokerageFee)}＋直接出資の精算 ${formatCurrency(
          settlementCost
        )}）`,
        'warning'
      );
      if (normalBattleNavigation && !returnsToAlliance) {
        setMarketNavigationRequest((previous) => ({
          id: (previous?.id || 0) + 1,
          mode: normalBattleNavigation.mode,
          community: normalBattleNavigation.community,
        }));
      }
      setSkillsStoryReturn(null);
      setActiveTab(returnsToAlliance ? 'cartels' : 'market');
    }

    if (appliesPersistentLoyaltySettlement) {
      setProperties(projectedProperties);
    }

    // 2. Handle Rebellion & Strategic Bankruptcy Liquidation Cashback
    if (
      appliesPersistentLoyaltySettlement &&
      rebelledProperties.length > 0
    ) {
      rebelledProperties.forEach((rebel) => {
        addGameLog(
          `【独立発生・強制清算】${rebel.name} の不満が高まり独立離脱しました。現在評価額 ${formatCurrency(
            rebel.marketPrice
          )} を強制清算金として自社資金へ入金しました。`,
          'warning'
        );
      });
    }
    if (
      appliesPersistentLoyaltySettlement &&
      winner === 'player' &&
      victoryReward > 0 &&
      rebelledProperties.length + survivingRiskUpdates.length > 0
    ) {
      const allocationLabel =
        celebrationGiftRate === 1
          ? '大盤振る舞い'
          : celebrationGiftRate === 0.5
            ? '五分の祝儀'
            : '利益独占';
      const allocationMessage =
        celebrationGiftRate === 1
          ? `勝利利益${formatCurrency(
              celebrationGiftCost
            )}を人脈全体へ均等に分配し、今回の離反を防いで独立危険度を${BATTLE_LOYALTY_BALANCE.lavishRiskRecovery}回復しました。`
          : celebrationGiftRate === 0.5
            ? `${formatCurrency(
                celebrationGiftCost
              )}（報酬の50%）を人脈全体へ均等に分配し、今回の離反確率を大きく抑えました。独立危険度は持ち越されます。`
            : '勝利利益を自社へ全額残しました。各人脈の独立危険度に応じて離反判定が行われました。';
      addGameLog(
        `【勝利利益・${allocationLabel}】${allocationMessage}`,
        celebrationGiftRate > 0 ? 'success' : 'info'
      );
    }

    setActiveBattleProperty(null);
    setActiveBattleMode('normal');
    setBattleTimeScale(1);
    return true;
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
      `【ネマワシ完了】保有事業・契約の独立危険度を -${amount} 減算しました（コスト ${formatCurrency(
        cost
      )}）`,
      'info'
    );
  };

  // Global Nemawashi
  const handleGlobalNemawashi = () => {
    const nemawashiTargets = ownedProperties.filter(
      (property) => property.loyaltyRisk > 0
    );
    const totalAssetVal = nemawashiTargets.reduce(
      (sum, p) => sum + p.marketPrice,
      0
    );
    const cost = Math.round(totalAssetVal * 0.02);

    if (nemawashiTargets.length === 0 || totalFunds < cost) return;

    setTotalFunds((prev) => prev - cost);
    setProperties((prev) =>
      prev.map((p) =>
        p.owner === 'player'
          ? { ...p, loyaltyRisk: Math.max(0, p.loyaltyRisk - 30) }
          : p
      )
    );

    addGameLog(
      `【全人脈一括ネマワシ】危険度が残る${nemawashiTargets.length}件の独立危険度を -30 一括減算しました（費用 ${formatCurrency(
        cost
      )}）`,
      'info'
    );
  };

  // Toggle skill equip
  const applyAbilityLoadoutState = (loadout: ReturnType<typeof normalizeSavedAbilityLoadout>) => {
    setEquippedSkillIds(loadout.equippedSkillIds);
    setOpeningAutoSkillId(loadout.openingAutoSkillId);
    setCriticalAutoSkillId(loadout.criticalAutoSkillId);
  };

  const availableAbilitySlotCount =
    MANUAL_ABILITY_SLOT_COUNT +
    (openingAutoUnlocked ? 1 : 0) +
    (criticalAutoUnlocked ? 1 : 0);

  const handleToggleEquipSkill = (skillId: string) => {
    if (equippedSkillIds.includes(skillId)) {
      applyAbilityLoadoutState(
        normalizeSavedAbilityLoadout({
          equippedSkillIds: equippedSkillIds.filter((id) => id !== skillId),
          openingAutoSkillId:
            openingAutoSkillId === skillId ? null : openingAutoSkillId,
          criticalAutoSkillId:
            criticalAutoSkillId === skillId ? null : criticalAutoSkillId,
          reserveSkillId: null,
          validSkillIds: unlockedSkillIds,
        })
      );
      return;
    }
    if (
      !unlockedSkillIds.has(skillId) ||
      equippedSkillIds.length >= availableAbilitySlotCount
    ) {
      return;
    }
    const current = normalizeSavedAbilityLoadout({
      equippedSkillIds,
      openingAutoSkillId,
      criticalAutoSkillId,
      reserveSkillId: null,
      validSkillIds: unlockedSkillIds,
    });
    if (current.manualSkillIds.length >= MANUAL_ABILITY_SLOT_COUNT) {
      return;
    }
    applyAbilityLoadoutState(
      normalizeSavedAbilityLoadout({
        equippedSkillIds: [...equippedSkillIds, skillId],
        openingAutoSkillId,
        criticalAutoSkillId,
        reserveSkillId: null,
        validSkillIds: unlockedSkillIds,
      })
    );
  };

  const handleSetSkillActivationMode = (
    skillId: string,
    mode: AbilityActivationMode
  ) => {
    if (
      !equippedSkillIds.includes(skillId) ||
      !unlockedSkillIds.has(skillId)
    ) {
      return;
    }
    const current = normalizeSavedAbilityLoadout({
      equippedSkillIds,
      openingAutoSkillId,
      criticalAutoSkillId,
      reserveSkillId: null,
      validSkillIds: unlockedSkillIds,
    });
    if (mode === 'manual') {
      const alreadyManual = current.manualSkillIds.includes(skillId);
      if (
        !alreadyManual &&
        current.manualSkillIds.length >= MANUAL_ABILITY_SLOT_COUNT
      ) {
        return;
      }
      applyAbilityLoadoutState(
        normalizeSavedAbilityLoadout({
          equippedSkillIds: [
            skillId,
            ...equippedSkillIds.filter((id) => id !== skillId),
          ],
          openingAutoSkillId:
            openingAutoSkillId === skillId ? null : openingAutoSkillId,
          criticalAutoSkillId:
            criticalAutoSkillId === skillId ? null : criticalAutoSkillId,
          reserveSkillId: null,
          validSkillIds: unlockedSkillIds,
        })
      );
      return;
    }
    if (mode === 'opening_auto') {
      if (!openingAutoUnlocked) return;
      applyAbilityLoadoutState(
        normalizeSavedAbilityLoadout({
          equippedSkillIds,
          openingAutoSkillId: skillId,
          criticalAutoSkillId:
            criticalAutoSkillId === skillId ? null : criticalAutoSkillId,
          reserveSkillId: null,
          validSkillIds: unlockedSkillIds,
        })
      );
      return;
    }
    if (mode === 'critical_auto') {
      if (!criticalAutoUnlocked) return;
      applyAbilityLoadoutState(
        normalizeSavedAbilityLoadout({
          equippedSkillIds,
          openingAutoSkillId:
            openingAutoSkillId === skillId ? null : openingAutoSkillId,
          criticalAutoSkillId: skillId,
          reserveSkillId: null,
          validSkillIds: unlockedSkillIds,
        })
      );
    }
  };

  // Trade-party cooperation management
  const handleFormAlliance = (nextAlliance: Omit<AllianceState, 'active'>) => {
    const formedAlliance: AllianceState = { ...nextAlliance, active: true };
    setAlliance(formedAlliance);
    addGameLog(
      isPublicPatronage(formedAlliance)
        ? `【公的後援】${formedAlliance.allyName}から通商・調達の後援を受けました！`
        : `【協力協定成立】${formedAlliance.allyName}との協力協定が成立しました！`,
      'success'
    );
  };

  const handleBreakAlliance = () => {
    const wasPublicPatronage = isPublicPatronage(alliance);
    const allyName = alliance.allyName;
    setAlliance({
      allyId: '',
      allyName: '',
      active: false,
      allyKind: 'company',
      relationType: 'commercial_alliance',
    });
    addGameLog(
      wasPublicPatronage
        ? `【後援返上】${allyName}への公的後援を返上しました。`
        : '【協力協定解除】外部協力先との協定を解除しました。',
      'info'
    );
  };

  const handleNewGame = () => {
    const accepted = window.confirm(
      '保存済みの所持金・保有事業／契約・装備アビリティ・外部協力／公的後援を削除して、ニューゲームを始めますか？'
    );
    if (!accepted) return;
    clearGameSave();
    window.location.reload();
  };

  // Equipped skills object array
  const equippedSkills = useMemo(() => {
    const skillById = new Map(skills.map((skill) => [skill.id, skill]));
    return equippedSkillIds
      .map((skillId) => skillById.get(skillId))
      .filter(
        (skill): skill is TacticalSkill =>
          !!skill && unlockedSkillIds.has(skill.id)
      );
  }, [skills, equippedSkillIds, unlockedSkillIds]);
  const battleEquippedSkills = equippedSkills;
  const availableSkills = useMemo(
    () => skills.filter((skill) => unlockedSkillIds.has(skill.id)),
    [skills, unlockedSkillIds]
  );

  const getBattleReadinessForTarget = (
    targetProperty: Property,
    mode: BattleMode = 'normal'
  ): BattleReadinessResult => {
    const isHighEndRaid =
      mode === 'savage' ||
      mode === 'ultimate' ||
      mode === 'cruel' ||
      mode === 'karma' ||
      mode === 'phantom';
    const usesSavageMechanics = mode === 'savage' || mode === 'phantom';
    const usesUltimateBasePower =
      mode === 'ultimate' || mode === 'phantom';
    const isTraining = mode === 'training';
    const isExtreme =
      mode === 'normal' && isExtremeReacquisition(targetProperty);
    const isTargetCityBoss =
      mode === 'normal' &&
      isNormalCityBoss(properties, targetProperty);
    const ignoresCampaignInfluence = isHighEndRaid || isTraining;
    const isTutorial =
      mode === 'normal' &&
      ownedProperties.length === 0 &&
      targetProperty.community === 'グリダニア' &&
      targetProperty.countsTowardCityConquest !== false;
    const targetIndustryInfluence = ignoresCampaignInfluence
      ? { playerBonus: 0, enemyBudgetDiscount: 0 }
      : industryInfluence[targetProperty.industry] ?? {
          playerBonus: 0,
          enemyBudgetDiscount: 0,
        };
    const targetRegionalInfluence = ignoresCampaignInfluence
      ? { playerBonus: 0, enemyBudgetDiscount: 0 }
      : regionalInfluence[targetProperty.community] ?? {
          playerBonus: 0,
          enemyBudgetDiscount: 0,
        };
    const enemyBudget = isTraining
      ? Math.max(1, Math.round(targetProperty.marketPrice))
      : calculateEnemyBudget({
          targetProperty,
          industryInfluence: targetIndustryInfluence,
          regionalInfluence: targetRegionalInfluence,
          isTutorial,
          isSavage: mode === 'savage',
          isUltimate: usesUltimateBasePower,
          isCruel: mode === 'cruel',
          isKarma: mode === 'karma',
          isCityBoss: isTargetCityBoss,
        });
    const enemyDifficultyLevel = getEnemyDifficultyLevel(
      targetProperty,
      isTutorial,
      mode === 'savage',
      usesUltimateBasePower,
      isTargetCityBoss,
      mode === 'cruel',
      mode === 'karma'
    );
    const bossAbilityTier = getBossAbilityTier({
      targetProperty,
      isCityBoss: isTargetCityBoss,
      isSavage: usesSavageMechanics,
      isUltimate: mode === 'ultimate',
      isCruel: mode === 'cruel',
      isKarma: mode === 'karma',
    });
    const enemySupportProfile = getEnemySupportSkillProfile({
      targetProperty,
      isCityBoss: isTargetCityBoss,
      isSavage: usesSavageMechanics,
      isUltimate: mode === 'ultimate',
      isCruel: mode === 'cruel',
      isKarma: mode === 'karma',
    });
    const enemyAutoProfile = getEnemySupportAutoProfile({
      targetProperty,
      isCityBoss: isTargetCityBoss,
      isSavage: usesSavageMechanics,
      isUltimate: mode === 'ultimate',
      isCruel: mode === 'cruel',
      isKarma: mode === 'karma',
    });
    const normalGuardLabel =
      bossAbilityTier === 'invincible'
        ? 'インビンシブル5秒→有限パッセ6秒'
        : bossAbilityTier === 'enhanced_cover'
          ? 'パッセ'
          : bossAbilityTier === 'cover'
            ? 'かばう'
            : bossAbilityTier === 'boss'
              ? '都市ボス固有の防衛判断'
              : null;
    const normalEnemyActions = enemySupportProfile.map(
      (skillId) => ENEMY_MECHANIC_NAMES[skillId]
    );
    const autoActionNames = [enemyAutoProfile.opening, enemyAutoProfile.critical]
      .filter((skillId): skillId is NonNullable<typeof skillId> => !!skillId)
      .map((skillId) => ENEMY_MECHANIC_NAMES[skillId]);
    const normalMechanicParts = Array.from(
      new Set([
        ...(normalGuardLabel ? [normalGuardLabel] : []),
        ...normalEnemyActions,
        ...autoActionNames,
      ])
    );
    const normalMechanicWarning =
      mode === 'normal' && normalMechanicParts.length > 0
        ? `固有ギミック：${normalMechanicParts.join('・')}。資金総額だけでなく、構えと防御時間を見て投入してください。`
        : undefined;
    const normalMechanicSeverity =
      mode === 'normal' && normalMechanicParts.length > 0
        ? targetProperty.isCartelHQ || bossAbilityTier === 'invincible'
          ? 'severe' as const
          : 'warning' as const
        : undefined;
    const brokerageFee = isTraining || mode === 'phantom' || mode === 'karma'
      ? 0
      : Math.round(targetProperty.marketPrice * 0.03);

    return calculateBattleReadiness({
      targetMarketPrice: targetProperty.marketPrice,
      availableCash: Math.max(0, totalFunds - brokerageFee),
      subsidiaries: ownedProperties,
      selectedBattleSynergy,
      limitBreakCharge,
      allianceSupport: alliance.active
        ? calculateAllianceSupport(targetProperty.marketPrice)
        : 0,
      hasCapitalBoost: battleEquippedSkills.some(
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
      playerPushBonus: ignoresCampaignInfluence
        ? 0
        : targetIndustryInfluence.playerBonus +
          targetRegionalInfluence.playerBonus +
          tradeNetworkBonus,
      battleMode: isExtreme ? 'extreme' : mode,
      mechanicWarning: normalMechanicWarning,
      mechanicSeverity: normalMechanicSeverity,
    });
  };

  const returnFromAbilitySetup = () => {
    if (!skillsStoryReturn) return;
    if (skillsStoryReturn.destination === 'savage') {
      setActiveTab('savage');
    } else if (skillsStoryReturn.destination === 'cartels') {
      setActiveTab('cartels');
    } else {
      setActiveTab('market');
      setMarketNavigationRequest((previous) => ({
        id: (previous?.id || 0) + 1,
        mode: 'targets',
        community: skillsStoryReturn.community,
      }));
    }
    setSkillsStoryReturn(null);
    soundFx.playCoin();
  };

  return (
    <div className="game-app-shell min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 flex flex-col">
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
        setActiveTab={(tab) => {
          if (activeTab === 'skills' && tab !== 'skills') {
            setSkillsStoryReturn(null);
          }
          setActiveTab(tab);
        }}
        marketReturnAttention={
          activeTab === 'skills' &&
          skillsStoryReturn?.destination === 'market'
        }
        onOpenMap={() => {
          const returnCommunity =
            skillsStoryReturn?.destination === 'market'
              ? skillsStoryReturn.community
              : null;
          setActiveTab('market');
          setMarketNavigationRequest((previous) => ({
            id: (previous?.id || 0) + 1,
            mode: returnCommunity ? 'targets' : 'map',
            community: returnCommunity ?? 'ALL',
          }));
          setSkillsStoryReturn(null);
        }}
        activeAllianceName={alliance.active ? alliance.allyName : null}
        activeSynergiesCount={activeSynergiesCount}
        tradeAllianceUnlocked={tradeAllianceUnlocked}
        savageUnlocked={savageUnlocked}
        savageClearedCount={savageClearedSet.size}
        savageTargetCount={savageTargetCount}
        ultimateUnlocked={ultimateUnlocked}
        ultimateCleared={ultimateCleared}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        onNewGame={handleNewGame}
      />

      {/* Main View Area */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-3 pb-20 md:py-6 md:pb-6 flex-1 space-y-4 md:space-y-6">
        {activeTab !== 'market' && activeTab !== 'cartels' && (
          <TatarAdvisor
            activeTab={activeTab}
            ownedCount={ownedProperties.length}
            conqueredCommunityCount={conqueredCommunityCount}
            totalCommunityCount={TRADE_COMMUNITIES.length}
            savageClearedCount={savageClearedSet.size}
            savageTargetCount={savageTargetCount}
            ultimateUnlocked={ultimateUnlocked}
            ultimateCleared={ultimateCleared}
          />
        )}

        {activeTab === 'market' && (
          <MarketView
            properties={properties}
            totalFunds={totalFunds}
            unlockedCommunityIds={unlockedCommunityIds}
            conqueredCommunityIds={conqueredCommunityIdSet}
            navigationRequest={marketNavigationRequest}
            getStrengthComparison={(property) =>
              getBattleReadinessForTarget(property, 'normal')
            }
            onStartBuyout={handleStartBuyout}
          />
        )}

        {activeTab === 'savage' && savageUnlocked && (
          activeBattleProperty &&
          (activeBattleMode === 'savage' ||
            activeBattleMode === 'ultimate' ||
            activeBattleMode === 'cruel' ||
            activeBattleMode === 'karma' ||
            activeBattleMode === 'phantom') ? (
            <div
              aria-hidden="true"
              style={{
                height: highEndBattlePlaceholderHeightRef.current
                  ? `${highEndBattlePlaceholderHeightRef.current}px`
                  : undefined,
              }}
            />
          ) : (
            <div ref={highEndViewRef}>
              <HighEndRaidView
                savageProperties={savageProperties}
                properties={properties}
                cartels={cartels}
                savageClearedIds={savageClearedSet}
                savageUnlockedIds={savageUnlockedIds}
                groupSynergies={groupSynergies}
                totalFunds={totalFunds}
                limitBreakCharge={limitBreakCharge}
                ultimateProperty={ultimateProperty}
                ultimateUnlocked={ultimateUnlocked}
                ultimateCleared={ultimateCleared}
                cruelProperty={cruelProperty}
                cruelUnlocked={cruelUnlocked}
                cruelCleared={cruelCleared}
                karmaProperty={karmaProperty}
                karmaUnlocked={karmaUnlocked}
                karmaCleared={karmaCleared}
                phantomProperty={phantomProperty}
                phantomUnlocked={phantomUnlocked}
                phantomWinStreak={phantomWinStreak}
                getStrengthComparison={getBattleReadinessForTarget}
                onStartSavage={handleStartSavageBuyout}
                onStartUltimate={handleStartUltimateBuyout}
                onStartCruel={handleStartCruelBuyout}
                onStartKarma={handleStartKarmaBuyout}
                onStartPhantom={handleStartPhantomBuyout}
                onReplayEnding={() => {
                  setEndingNotice('true');
                  soundFx.playVictory();
                }}
                onOpenCartels={() => setActiveTab('cartels')}
              />
            </div>
          )
        )}

        {activeTab === 'portfolio' && (
          <PortfolioView
            companyName={companyName}
            properties={properties}
            totalFunds={totalFunds}
            propertyRevenueMultipliers={savagePropertyRevenueMultipliers}
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
            conqueredCommunityIds={conqueredCommunityIdSet}
            totalFunds={totalFunds}
            activeSynergyCount={activeSynergiesCount}
            openingAutoUnlocked={openingAutoUnlocked}
            criticalAutoUnlocked={criticalAutoUnlocked}
            openingAutoSkillId={
              effectiveAbilityLoadout.openingAutoSkillId
            }
            criticalAutoSkillId={
              effectiveAbilityLoadout.criticalAutoSkillId
            }
            savageClearedRaidIds={savageClearedSet}
            selectedBattleSynergyId={selectedBattleSynergyId}
            storyReturnLabel={
              skillsStoryReturn?.destination === 'savage'
                ? '零式の攻略一覧へ戻る'
                : skillsStoryReturn?.destination === 'cartels'
                  ? '企業連合攻略へ戻る'
                : skillsStoryReturn?.destination === 'market'
                  ? `${skillsStoryReturn.community}の交渉先へ戻る`
                  : undefined
            }
            onReturnToStory={
              skillsStoryReturn ? returnFromAbilitySetup : undefined
            }
            onToggleEquipSkill={handleToggleEquipSkill}
            onSetSkillActivationMode={handleSetSkillActivationMode}
            onSelectBattleSynergy={setSelectedBattleSynergyId}
          />
        )}

        {activeTab === 'cartels' && tradeAllianceUnlocked && (
          <CartelAllianceView
            companyName={companyName}
            cartels={cartels}
            properties={properties}
            alliance={alliance}
            getStrengthComparison={(property) =>
              getBattleReadinessForTarget(property, 'normal')
            }
            onFormAlliance={handleFormAlliance}
            onBreakAlliance={handleBreakAlliance}
            onStartBuyout={(property) =>
              handleStartBuyout(property, 'cartels')
            }
          />
        )}

        <section className="rounded-xl border border-cyan-400/25 bg-gradient-to-r from-slate-950 via-cyan-950/25 to-slate-950 px-4 py-3 shadow-lg">
          <div>
            <span className="block text-xs font-black tracking-[.08em] text-cyan-50">
              動作フレームレート
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
              演出・背景・コイン量は共通。30fpsは発熱を抑え、60fpsは商戦ゲージを滑らかにします。
            </span>
          </div>
          <div
            className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-slate-700/80 bg-slate-950/85 p-1"
            role="group"
            aria-label="動作フレームレート"
          >
            {([30, 60] as const).map((frameRate) => {
              const selected = battleFrameRate === frameRate;
              return (
                <button
                  key={frameRate}
                  type="button"
                  className={`min-h-11 rounded-md px-3 py-1.5 text-center transition-colors ${
                    selected
                      ? 'border border-cyan-300/65 bg-cyan-300 text-slate-950 shadow-[0_0_16px_rgba(103,232,249,.2)]'
                      : 'border border-transparent bg-slate-900 text-slate-400'
                  }`}
                  aria-pressed={selected}
                  onClick={() => {
                    setBattleFrameRate(frameRate);
                    try {
                      window.localStorage.setItem(
                        BATTLE_FRAME_RATE_STORAGE_KEY,
                        String(frameRate)
                      );
                    } catch {
                      // The preference remains valid for this session.
                    }
                  }}
                >
                  <strong className="block text-sm font-black">
                    {frameRate} FPS
                  </strong>
                  <small className="block text-[10px] font-bold">
                    {frameRate === 30 ? '省電力' : 'なめらか'}
                  </small>
                </button>
              );
            })}
          </div>
        </section>

        {/* Global activity stays closed until the player asks for it. */}
        {logs.length > 0 && (
          <details className="group rounded-xl border border-slate-800 bg-slate-900/80 shadow-lg">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-bold text-slate-300">
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
        <span>本作は非公式ファンサイト／ファンゲームです。 <span lang="en">Unofficial fan site/game.</span></span>
        <a href="https://jp.finalfantasyxiv.com/lodestone/special/fankit/" target="_blank" rel="noreferrer">FFXIV公式ファンキット</a>
        <a href="https://support.jp.square-enix.com/rule.php?id=5381&la=0&tag=authc" target="_blank" rel="noreferrer">著作物利用条件</a>
        <a href="https://support.na.square-enix.com/rule.php?id=5382&la=1&tag=authc" target="_blank" rel="noreferrer" lang="en">Materials Usage License</a>
        <strong>© SQUARE ENIX</strong>
        <span lang="en">FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.</span>
      </footer>

      {endingNotice && (
        <EndingModal ending={endingNotice} companyName={companyName} onContinue={acknowledgeEnding} />
      )}

      {unlockExplanationVisible && unlockExplanationNotice && (
        <button
          type="button"
          onClick={acknowledgeUnlockExplanation}
          className="city-unlock fixed inset-0 z-[188] flex items-center justify-center bg-slate-950/92 p-4 text-left"
          aria-label={`${unlockExplanationNotice.title}の説明を確認する`}
        >
          <span
            className={`city-unlock__card relative block w-full max-w-2xl overflow-hidden rounded-2xl border bg-slate-900 p-5 shadow-2xl sm:p-7 ${
              unlockExplanationNotice.kind === 'synergy'
                ? 'border-violet-300/70'
                : 'border-amber-300/70'
            }`}
          >
            <img
              src={FANKIT_ART.marketBackdrop}
              alt=""
              aria-hidden="true"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover opacity-20"
            />
            <span className="relative z-10 flex items-end gap-4">
              <img
                src={FANKIT_ART.tataru.dressUp}
                alt="タタル"
                className="h-28 w-24 shrink-0 object-contain object-bottom drop-shadow-[0_0_16px_rgba(251,191,36,.45)] sm:h-36 sm:w-32"
              />
              <span className="min-w-0 pb-1">
                <span
                  className={`block text-[10px] font-black tracking-[.28em] ${
                    unlockExplanationNotice.kind === 'synergy'
                      ? 'text-violet-300'
                      : 'text-amber-300'
                  }`}
                >
                  {unlockExplanationNotice.kicker} UNLOCKED
                </span>
                <span className="mt-1 block text-xl font-black text-white sm:text-3xl">
                  {unlockExplanationNotice.title}
                </span>
                <span className="mt-3 block rounded-xl border border-white/15 bg-slate-950/80 p-3 text-sm font-bold leading-relaxed text-slate-50">
                  「{unlockExplanationNotice.dialogue}」
                </span>
              </span>
            </span>
            <span className="relative z-10 mt-3 block text-xs font-semibold leading-relaxed text-slate-200 sm:text-sm">
              {unlockExplanationNotice.detail}
            </span>
            <span className="relative z-10 mt-3 block rounded-lg border border-cyan-200/20 bg-cyan-950/45 px-3 py-2 text-xs font-bold leading-relaxed text-cyan-50 sm:text-sm">
              使い方：{unlockExplanationNotice.operation}
            </span>
            <span
              className={`relative z-10 mt-4 inline-block rounded-lg px-4 py-2 text-xs font-black text-slate-950 ${
                unlockExplanationNotice.kind === 'synergy'
                  ? 'bg-violet-300'
                  : 'bg-amber-300'
              }`}
            >
              {unlockExplanationQueue.length > 1
                ? '次の解放を見る'
                : 'アビリティを確認'}
            </span>
          </span>
        </button>
      )}

      {featureUnlockNotice && (
        <button
          type="button"
          onClick={acknowledgeFeatureUnlock}
          className="city-unlock fixed inset-0 z-[185] flex items-center justify-center bg-slate-950/92 p-4 text-left"
          aria-label={`${featureUnlockNotice.title}の説明を閉じる`}
        >
          <span className="city-unlock__card relative block w-full max-w-2xl overflow-hidden rounded-2xl border border-cyan-300/60 bg-slate-900 p-5 shadow-2xl sm:p-7">
            <img src={FANKIT_ART.marketBackdrop} alt="" aria-hidden="true" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-20" />
            <span className="relative z-10 flex items-end gap-4">
              <img src={FANKIT_ART.tataru.dressUp} alt="タタル" className="h-28 w-24 shrink-0 object-contain object-bottom drop-shadow-[0_0_16px_rgba(103,232,249,.5)] sm:h-36 sm:w-32" />
              <span className="min-w-0 pb-1">
                <span className="block text-[10px] font-black tracking-[.28em] text-cyan-300">{featureUnlockNotice.kicker} UNLOCKED</span>
                <span className="mt-1 block text-xl font-black text-white sm:text-3xl">{featureUnlockNotice.title}</span>
                <span className="mt-3 block rounded-xl border border-cyan-200/25 bg-slate-950/75 p-3 text-sm font-bold leading-relaxed text-cyan-50">「{featureUnlockNotice.dialogue}」</span>
              </span>
            </span>
            <span className="relative z-10 mt-3 block text-xs leading-relaxed text-slate-300 sm:text-sm">{featureUnlockNotice.detail}</span>
            <span className="relative z-10 mt-4 inline-block rounded-lg bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">わかった！</span>
          </span>
        </button>
      )}

      {unlockNotice && (
        <button type="button" onClick={() => setUnlockNotice(null)} className="city-unlock fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/90 p-4 text-left">
          <span className="city-unlock__card relative block w-full max-w-2xl overflow-hidden rounded-2xl border border-amber-300/60 bg-slate-900 p-5 shadow-2xl sm:p-7">
            <img src={FANKIT_ART.marketBackdrop} alt="" aria-hidden="true" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-25" />
            <span className="relative z-10 flex items-end gap-4">
              <img src={FANKIT_ART.tataru.windUp} alt="タタル" className="h-28 w-24 shrink-0 object-contain object-bottom sm:h-36 sm:w-32" />
              <span className="min-w-0 pb-1">
                <span className="block text-[10px] font-black tracking-[.3em] text-cyan-300">NEW TRADE ROUTE</span>
                <span className="mt-1 flex items-center gap-2 text-2xl font-black text-white sm:text-3xl"><MapPinned className="h-7 w-7 shrink-0 text-amber-300" /> {unlockNotice}</span>
                <span className="mt-3 block rounded-xl border border-amber-200/25 bg-slate-950/75 p-3 text-sm font-bold leading-relaxed text-amber-50">「この都市の人脈がつながったでっす。新しい交易路から、次の市場へ進むでっす！」</span>
              </span>
            </span>
            <span className="relative z-10 mt-4 inline-block rounded-lg bg-amber-400 px-4 py-2 text-xs font-black text-slate-950">
              {normalBattleOrigin === 'cartels'
                ? '企業連合攻略へ戻る'
                : '次の都市の交渉先へ'}
            </span>
          </span>
        </button>
      )}

      {offlineIncomeNotice > 0 && !activeBattleProperty && (
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
          equippedSkills={battleEquippedSkills}
          availableSkills={availableSkills}
          openingAutoSkillId={
            effectiveAbilityLoadout.openingAutoSkillId
          }
          criticalAutoSkillId={
            effectiveAbilityLoadout.criticalAutoSkillId
          }
          alliance={alliance}
          activeSynergies={activeGroupSynergies}
          selectedBattleSynergy={selectedBattleSynergy}
          industryInfluence={activeBattleMode !== 'normal' ? { owned: 0, total: 0, label: activeBattleMode === 'training' ? '木人訓練では無効' : '高難度記録戦では無効', playerBonus: 0, enemyBudgetDiscount: 0 } : industryInfluence[activeBattleProperty.industry] || { owned: 0, total: 0, label: '未進出', playerBonus: 0, enemyBudgetDiscount: 0 }}
          regionalInfluence={activeBattleMode !== 'normal' ? { owned: 0, total: 0, label: activeBattleMode === 'training' ? '木人訓練では無効' : '高難度記録戦では無効', playerBonus: 0, enemyBudgetDiscount: 0 } : regionalInfluence[activeBattleProperty.community] || { owned: 0, total: 0, label: '未進出', playerBonus: 0, enemyBudgetDiscount: 0 }}
          windProgressionStage={activeBattleMode === 'training' ? 0 : windProgressionStage}
          battleContextLabel={
            activeBattleMode === 'savage'
              ? getSavageRaidDefinition(activeBattleProperty.id)?.coalitionName
              : activeBattleMode === 'phantom'
                ? getSavageRaidDefinition(activeBattleProperty.id)?.coalitionName
              : activeBattleMode === 'ultimate'
                ? ULTIMATE_RAID_DEFINITION.coalitionName
              : activeBattleMode === 'cruel'
                  ? CRUEL_RAID_DEFINITION.coalitionName
                : activeBattleMode === 'karma'
                  ? KARMA_RAID_DEFINITION.coalitionName
                : activeBattleMode === 'training'
                  ? '商戦訓練所'
                  : undefined
          }
          battleRegionLabel={
            activeBattleMode === 'savage'
              ? getSavageRaidDefinition(activeBattleProperty.id)?.communities.join('・')
              : activeBattleMode === 'phantom'
                ? `幻・商戦／${getSavageRaidDefinition(activeBattleProperty.id)?.communities.join('・') ?? '零式再現層'}`
              : activeBattleMode === 'ultimate'
                ? `全${ULTIMATE_RAID_DEFINITION.communities.length}地域`
                : activeBattleMode === 'cruel'
                  ? '絶商戦踏破後・単独記録戦'
                : activeBattleMode === 'karma'
                  ? '酷商戦踏破後・値札のない記録戦'
                : activeBattleMode === 'training'
                  ? 'グリダニア訓練区画'
                  : undefined
          }
          tradeNetworkBonus={activeBattleMode !== 'normal' ? 0 : tradeNetworkBonus}
          limitBreakCharge={
            activeBattleMode === 'phantom'
              ? phantomBattleLimitBreakCharge
              : activeBattleMode === 'karma'
                ? karmaBattleLimitBreakCharge
              : limitBreakCharge
          }
          onLimitBreakChargeChange={
            activeBattleMode === 'phantom'
              ? setPhantomBattleLimitBreakCharge
              : activeBattleMode === 'karma'
                ? setKarmaBattleLimitBreakCharge
              : setLimitBreakCharge
          }
          onTimeScaleChange={setBattleTimeScale}
          battleFrameRate={battleFrameRate}
          nextCommunity={(() => {
            if (activeBattleMode !== 'normal') return null;
            if (
              isExtremeReacquisition(activeBattleProperty) ||
              conqueredCommunityIdSet.has(activeBattleProperty.community)
            ) {
              return null;
            }
            const wouldConquer = wouldCompleteCommunityNetwork(
              properties,
              activeBattleProperty.community,
              activeBattleProperty.id
            );
            if (!wouldConquer) return null;
            const currentIndex = COMMUNITY_CAMPAIGN_ORDER.indexOf(activeBattleProperty.community);
            return COMMUNITY_CAMPAIGN_ORDER[currentIndex + 1] || null;
          })()}
          isTutorial={
            activeBattleMode === 'normal' &&
            ownedProperties.length === 0 &&
            activeBattleProperty.community === 'グリダニア' &&
            activeBattleProperty.countsTowardCityConquest !== false
          }
          isSavage={activeBattleMode === 'savage'}
          isUltimate={activeBattleMode === 'ultimate'}
          isCruel={activeBattleMode === 'cruel'}
          isKarma={activeBattleMode === 'karma'}
          isPhantom={activeBattleMode === 'phantom'}
          isTraining={false}
          isCityBoss={
            activeBattleMode === 'normal' &&
            isNormalCityBoss(properties, activeBattleProperty)
          }
          returnToAlliance={
            activeBattleMode === 'normal' &&
            normalBattleOrigin === 'cartels'
          }
          onBattleEnd={handleBattleEnd}
          onClose={() => {
            if (deferredBattleIncomeRef.current > 0) {
              const settledBattleFunds =
                totalFunds + deferredBattleIncomeRef.current;
              if (!persistGameState({ totalFunds: settledBattleFunds })) {
                return;
              }
              deferredBattleIncomeRef.current = 0;
              setTotalFunds(settledBattleFunds);
            }
            clearPendingBattleSession();
            setActiveBattleProperty(null);
            setActiveBattleMode('normal');
            setBattleTimeScale(1);
          }}
        />
      )}
    </div>
  );
}

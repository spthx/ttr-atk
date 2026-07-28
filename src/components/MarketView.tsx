import React, { useState, useMemo, useEffect } from 'react';
import { Property, IndustryType, CommunityType } from '../types';
import { COMMUNITY_CAMPAIGN_ORDER, TRADE_COMMUNITIES } from '../data/worldData';
import { formatCurrency, formatNumber } from '../utils/formatter';
import { soundFx } from '../utils/audio';
import { ArrowRight, ShieldAlert, CheckCircle2, Crown, MapPinned, ListFilter, CircleHelp, ChevronRight, LockKeyhole, Dumbbell, Gauge, WalletCards } from 'lucide-react';
import { BeginnerGuide } from './BeginnerGuide';
import { HelpTip } from './HelpTip';
import { StrengthComparison } from './StrengthComparison';
import { HELP_TEXT } from '../data/helpText';
import { FANKIT_ART, getFankitJobArt } from '../data/fankitAssets';
import type { BattleReadinessResult } from '../utils/battleReadiness';
import {
  countsTowardCityConquest,
  getCampaignProperties,
  isNormalCityBoss,
} from '../utils/gameBalance';
import '../market-strength.css';

interface MarketViewProps {
  properties: Property[];
  totalFunds: number;
  unlockedCommunityIds: Set<CommunityType>;
  conqueredCommunityIds: ReadonlySet<CommunityType>;
  navigationRequest?: { id: number; mode: 'map' | 'targets'; community: CommunityType | 'ALL' } | null;
  campaignMode?: 'normal' | 'savage';
  getStrengthComparison: (property: Property) => BattleReadinessResult;
  onStartBuyout: (property: Property) => void;
  onOpenTraining?: () => void;
}

const getPropertyPresentation = (description: string) => {
  const prefixes = [
    ['【公式名称を用いたゲーム向けアレンジ】', '公式名アレンジ'],
    ['【本作独自のIF連盟】', '創作IF'],
    ['【ゲーム向け創作】', '創作'],
    ['【系列組織】', '系列'],
    ['【アライアンス本部】', '企業連合本部'],
    ['【初心者おすすめ】', ''],
  ] as const;
  const tags: string[] = [];
  let text = description;
  let matched = true;
  while (matched) {
    matched = false;
    for (const [prefix, tag] of prefixes) {
      if (!text.startsWith(prefix)) continue;
      text = text.slice(prefix.length);
      if (tag) tags.push(tag);
      matched = true;
      break;
    }
  }
  return { text: text.trim(), tags };
};

const READINESS_PRESENTATION = {
  advantage: { label: '余力あり' },
  even: { label: '接戦' },
  challenge: { label: '要工夫' },
  danger: { label: '準備不足' },
} as const;

const READINESS_PRIORITY: Record<BattleReadinessResult['grade'], number> = {
  advantage: 3,
  even: 2,
  challenge: 1,
  danger: 0,
};

export const MarketView: React.FC<MarketViewProps> = ({
  properties,
  totalFunds,
  unlockedCommunityIds,
  conqueredCommunityIds,
  navigationRequest,
  campaignMode = 'normal',
  getStrengthComparison,
  onStartBuyout,
  onOpenTraining,
}) => {
  const hasStartedCampaign = campaignMode === 'savage' || properties.some((property) => property.owner === 'player');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('ALL');
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityType | 'ALL'>(hasStartedCampaign ? 'ALL' : 'グリダニア');
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'map' | 'targets'>(hasStartedCampaign ? 'map' : 'targets');
  const [showGuide, setShowGuide] = useState(false);
  const [showOwnedProperties, setShowOwnedProperties] = useState(false);

  useEffect(() => {
    if (!navigationRequest) return;
    setSelectedCommunity(navigationRequest.community);
    setSelectedIndustry('ALL');
    setSelectedOwnerFilter('ALL');
    setShowOwnedProperties(false);
    setViewMode(navigationRequest.mode);
  }, [navigationRequest]);

  const industries: IndustryType[] = [
    '馬・畜産',
    '飲食・酒類',
    '木材・農園',
    '鉱工業・武器',
    '情報・警備',
    '娯楽・商業',
  ];

  const communityProgress = useMemo(
    () =>
      COMMUNITY_CAMPAIGN_ORDER.map((communityId) => TRADE_COMMUNITIES.find((community) => community.id === communityId)!).map((community) => {
        const targets = getCampaignProperties(properties, community.id);
        const owned = targets.filter((property) => property.owner === 'player').length;
        return {
          ...community,
          owned,
          total: targets.length,
          currentlyControlled:
            targets.length > 0 && owned === targets.length,
          conquered:
            campaignMode === 'savage'
              ? targets.length > 0 && owned === targets.length
              : conqueredCommunityIds.has(community.id),
        };
      }),
    [campaignMode, conqueredCommunityIds, properties]
  );

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      const matchesIndustry =
        selectedIndustry === 'ALL' || p.industry === selectedIndustry;

      const matchesCommunity =
        selectedCommunity === 'ALL' || p.community === selectedCommunity;

      const matchesUnlocked = unlockedCommunityIds.has(p.community);

      const matchesOwner =
        selectedOwnerFilter === 'ALL' ||
        (selectedOwnerFilter === 'INDEPENDENT' && p.owner === 'independent') ||
        (selectedOwnerFilter === 'CARTEL' && (p.owner === 'dofor' || p.owner === 'abyss')) ||
        (selectedOwnerFilter === 'PLAYER' && p.owner === 'player');

      return matchesUnlocked && matchesIndustry && matchesCommunity && matchesOwner;
    });
  }, [properties, selectedIndustry, selectedCommunity, selectedOwnerFilter, unlockedCommunityIds]);

  const ownedFilteredCount = filteredProperties.filter((property) => property.owner === 'player').length;
  const showOwnedCards = showOwnedProperties || selectedOwnerFilter === 'PLAYER';
  const visibleProperties = filteredProperties.filter((property) => showOwnedCards || property.owner !== 'player');
  const activeTargetCount = filteredProperties.length - ownedFilteredCount;
  const ownedProperties = properties.filter((property) => property.owner === 'player');
  const readinessSource =
    viewMode === 'targets'
      ? filteredProperties
      : properties.filter((property) =>
          unlockedCommunityIds.has(property.community)
        );
  const accessibleReadiness = readinessSource
    .filter(
      (property) =>
        property.owner !== 'player'
    )
    .map((property) => getStrengthComparison(property));
  const readinessCounts = accessibleReadiness.reduce(
    (counts, result) => {
      counts[result.grade] += 1;
      return counts;
    },
    { advantage: 0, even: 0, challenge: 0, danger: 0 }
  );
  const companyStrengthSummary = (
    <section
      className="market-readiness-overview"
      aria-label={`${viewMode === 'targets' ? '表示中' : '挑戦可能'}の相手。余力あり${readinessCounts.advantage}件、接戦${readinessCounts.even}件、要工夫${readinessCounts.challenge}件、準備不足${readinessCounts.danger}件`}
    >
      <header>
        <span><Gauge />{viewMode === 'targets' ? '表示中の挑戦目安' : '挑戦可能な相手'}</span>
        <small>自社動員と競合防衛を比較</small>
      </header>
      <dl className="market-readiness-overview__grades">
        {(Object.keys(READINESS_PRESENTATION) as BattleReadinessResult['grade'][]).map((grade) => (
          <div key={grade} data-grade={grade}>
            <dt>{READINESS_PRESENTATION[grade].label}</dt>
            <dd>{readinessCounts[grade]}<small>件</small></dd>
          </div>
        ))}
      </dl>
      <footer>
        <span><WalletCards />自社資金 <b>{formatCurrency(totalFunds)}</b></span>
        <span>支援元 <b>{ownedProperties.length}件</b></span>
        <small>勝率ではなく、商戦へ持ち込める資本の準備目安です。</small>
      </footer>
    </section>
  );

  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const resetFilters = () => {
    setSelectedIndustry('ALL');
    setSelectedCommunity('ALL');
    setSelectedOwnerFilter('ALL');
  };

  const handleBuyoutClick = (prop: Property, activePrice: number, fee: number, canAffordFee: boolean) => {
    if (!canAffordFee) {
      soundFx.playWarning();
      setNoticeMessage(
        `【所持金不足】${prop.name} の仲介手数料 ${formatCurrency(fee)} が不足しています。（現在の所持金: ${formatCurrency(totalFunds)}）`
      );
      setTimeout(() => setNoticeMessage(null), 4000);
      return;
    }

    setNoticeMessage(null);
    soundFx.playCoin();
    onStartBuyout({
      ...prop,
      marketPrice: activePrice,
    });
  };


  if (viewMode === 'map') {
    return (
      <div className="market-screen-enter space-y-3 font-sans">
        <section className="relative flex min-h-44 flex-col overflow-hidden rounded-2xl border border-amber-400/40 shadow-2xl sm:min-h-36">
          <img src={campaignMode === 'savage' ? FANKIT_ART.battleBackdrop : FANKIT_ART.marketBackdrop} alt="FFXIVファンキットによる交易世界の背景" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/25" />
          <div className="relative z-10 flex min-h-0 max-w-2xl flex-1 flex-col justify-center px-5 pb-2 pt-5 sm:min-h-36 sm:py-5">
            <p className={`text-[10px] font-black tracking-[0.28em] ${campaignMode === 'savage' ? 'text-rose-300' : 'text-amber-300'}`}>{campaignMode === 'savage' ? 'SAVAGE TRADE RAID' : 'GRAND TRADE CAMPAIGN'}</p>
            <h2 className="mt-1 text-2xl font-black text-white drop-shadow-lg">{campaignMode === 'savage' ? '挑戦する零式商戦を選ぶ' : '次に攻める都市を選ぶ'}</h2>
            <p className="mt-1 text-xs text-slate-200">{campaignMode === 'savage' ? '各都市の通常商戦を再構成した3編×1～4層、全12章の高難度交易レイドです。' : '都市を選ぶと、交渉できる事業・契約だけを表示します。'}</p>
          </div>
          <div className="relative z-20 flex items-center justify-end gap-2 px-5 pb-4 sm:absolute sm:bottom-3 sm:right-3 sm:p-0">
            {campaignMode === 'normal' && onOpenTraining && (
              <button type="button" onClick={onOpenTraining} className="flex min-h-11 items-center gap-1 rounded-lg border border-amber-400/40 bg-slate-950/85 px-3 py-2 text-xs font-black text-amber-200">
                <Dumbbell className="h-4 w-4" /> 木人練習
              </button>
            )}
            <button type="button" aria-expanded={showGuide} onClick={() => setShowGuide((open) => !open)} className="flex min-h-11 items-center gap-1 rounded-lg border border-cyan-400/30 bg-slate-950/80 px-3 py-2 text-xs font-bold text-cyan-200">
              <CircleHelp className="h-3.5 w-3.5" /> 遊び方
            </button>
          </div>
        </section>

        {showGuide && <BeginnerGuide defaultOpen />}

        {companyStrengthSummary}

        <section className="rounded-2xl border border-cyan-500/20 bg-slate-900/85 p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-black text-cyan-100"><MapPinned className="h-4 w-4 text-cyan-400" /> {campaignMode === 'savage' ? '商戦 零式レイドマップ' : '都市戦略マップ'}</h3>
              <p className="mt-0.5 text-[10px] text-slate-500">{campaignMode === 'savage' ? '踏破都市' : '制覇数'} {communityProgress.filter((city) => city.conquered).length}/{communityProgress.length}</p>
            </div>
            <button type="button" onClick={() => { setSelectedCommunity('ALL'); setViewMode('targets'); }} className="flex min-h-11 items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-300">
              {campaignMode === 'savage' ? '全層から探す' : '全対象から探す'} <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {communityProgress.map((community, index) => {
              const unlocked = unlockedCommunityIds.has(community.id);
              const prerequisite = COMMUNITY_CAMPAIGN_ORDER[index - 1];
              const remainingTargets = getCampaignProperties(
                properties,
                community.id
              ).filter((property) => property.owner !== 'player');
              const easiestTarget = unlocked
                ? remainingTargets
                    .map((property) => {
                      return {
                        property,
                        result: getStrengthComparison(property),
                      };
                    })
                    .sort(
                      (left, right) =>
                        READINESS_PRIORITY[right.result.grade] -
                          READINESS_PRIORITY[left.result.grade] ||
                        right.result.assessmentRatio -
                          left.result.assessmentRatio
                    )[0] ?? null
                : null;
              return (
              <button
                key={community.id}
                type="button"
                disabled={!unlocked}
                onClick={() => { setSelectedCommunity(community.id); setViewMode('targets'); }}
                className={`campaign-city-card group relative min-h-28 overflow-hidden rounded-xl border p-3 text-left transition-all ${unlocked ? 'active:scale-95' : 'cursor-not-allowed opacity-55'} ${community.conquered ? 'border-emerald-400/50 bg-emerald-950/45' : unlocked ? 'border-cyan-500/35 bg-slate-950 hover:border-cyan-300/70' : 'border-slate-800 bg-slate-950/80'}`}
                data-grade={easiestTarget?.result.grade}
                style={{ animationDelay: `${index * 28}ms` }}
              >
                <img src={getFankitJobArt(community.id)} alt="" aria-hidden="true" className="absolute -bottom-5 -right-4 h-24 w-24 object-contain opacity-20 transition-transform group-hover:scale-110" />
                <span className="relative z-10 flex items-center gap-1 text-xs font-black text-slate-100">{!unlocked && <LockKeyhole className="h-3 w-3 text-slate-500" />}{community.id}</span>
                <span className="relative z-10 mt-1 block text-[11px] text-cyan-300">{community.marketCharacter}</span>
                <span className={`relative z-10 mt-2 inline-block rounded px-1.5 py-0.5 text-[11px] font-black ${community.conquered ? 'bg-emerald-400/20 text-emerald-200' : 'bg-slate-800 text-slate-300'}`}>
                  {community.conquered
                    ? campaignMode === 'savage'
                      ? '零式踏破済み'
                      : community.currentlyControlled
                        ? '制覇済み'
                        : `制覇済み・現在 ${community.owned}/${community.total}`
                    : unlocked
                      ? `${community.owned}/${community.total} ${campaignMode === 'savage' ? '層踏破' : '取得'}`
                      : `${prerequisite}制覇で解放`}
                </span>
                {!community.currentlyControlled && easiestTarget && (
                  <span className="campaign-city-card__readiness">
                    <small>次の相手</small>
                    <b>{READINESS_PRESENTATION[easiestTarget.result.grade].label}</b>
                    <em aria-label={`自社${formatCurrency(easiestTarget.result.playerExpectedCapital)}、競合${formatCurrency(easiestTarget.result.enemyBudget)}`}>
                      <span><small>自社</small><b>{formatNumber(easiestTarget.result.playerExpectedCapital)}</b></span>
                      <span><small>競合</small><b>{formatNumber(easiestTarget.result.enemyBudget)}</b></span>
                    </em>
                  </span>
                )}
              </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className="market-screen-enter space-y-3 font-sans">
      {campaignMode === 'normal' && <BeginnerGuide defaultOpen={!hasStartedCampaign} />}
      <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-500/20 bg-slate-900/90 p-3">
        <div>
          <button type="button" onClick={() => setViewMode('map')} className="mb-1 flex min-h-11 items-center gap-1 text-xs font-bold text-cyan-300 hover:text-cyan-200">
            <MapPinned className="h-3.5 w-3.5" /> 都市マップへ戻る
          </button>
          <h2 className="flex items-center gap-1 text-base font-black text-white">
            {selectedCommunity === 'ALL' ? '全都市の交渉対象' : `${selectedCommunity}の交渉対象`}
            <HelpTip
              term="世界観バッジ"
              description="「創作」は本作独自、「公式名アレンジ」はFFXIV公式名を用いたゲーム向けIF、「創作IF」は公式に存在しない本作独自の連盟・関係を示します。"
            />
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 text-xs text-slate-400"><ListFilter className="h-4 w-4 text-amber-400" />交渉対象 {activeTargetCount}件</span>
          {campaignMode === 'normal' && onOpenTraining && (
            <button type="button" onClick={onOpenTraining} className="flex min-h-11 items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-950/25 px-3 py-2 text-xs font-black text-amber-200">
              <Dumbbell className="h-4 w-4" /> 木人練習
            </button>
          )}
        </div>
      </section>

      {companyStrengthSummary}

      {/* Insufficient Funds Warning Banner */}
      {noticeMessage && (
        <div className="bg-rose-950/90 border border-rose-500 text-rose-200 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between shadow-lg animate-bounce">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{noticeMessage}</span>
          </div>
          <button
            onClick={() => setNoticeMessage(null)}
            aria-label="資金不足の案内を閉じる"
            className="inline-flex h-11 w-11 items-center justify-center text-rose-400 hover:text-white font-black text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
        {/* Category Filters */}
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
          <select
            aria-label="都市で絞り込む"
            title="表示する都市を選びます"
            value={selectedCommunity}
            onChange={(e) => setSelectedCommunity(e.target.value as CommunityType | 'ALL')}
            className="min-h-11 bg-slate-950 border border-violet-500/40 rounded-lg px-2.5 py-1.5 text-xs text-violet-200 focus:outline-none focus:border-violet-400"
          >
            <option value="ALL">全都市</option>
            {TRADE_COMMUNITIES.filter((community) => unlockedCommunityIds.has(community.id)).map((community) => (
              <option key={community.id} value={community.id}>
                {community.id}
              </option>
            ))}
          </select>

          <select
            aria-label="産業で絞り込む"
            title="表示する産業を選びます"
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="min-h-11 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">全産業</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>

          <select
            aria-label="所有者で絞り込む"
            title="独立事業、競合企業連合、自社保有で絞り込みます"
            value={selectedOwnerFilter}
            onChange={(e) => setSelectedOwnerFilter(e.target.value)}
            className="min-h-11 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">全所属</option>
            <option value="INDEPENDENT">独立（未所属）</option>
            <option value="CARTEL">企業連合（競合）</option>
            <option value="PLAYER">自社保有</option>
          </select>
        </div>
      </div>

      {ownedFilteredCount > 0 && (
        <button
          type="button"
          onClick={() => setShowOwnedProperties((open) => !open)}
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-2.5 text-left text-xs font-bold text-emerald-200"
        >
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" />取得済み事業・契約 {ownedFilteredCount}件</span>
          <span className="text-[10px] text-emerald-300">{showOwnedCards ? '畳む ▲' : '開く ▼'}</span>
        </button>
      )}

      {/* Property Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleProperties.map((prop) => {
          const isPlayerOwned = prop.owner === 'player';
          const activePrice = prop.marketPrice;
          const fee = Math.round(activePrice * 0.03);
          const canAffordFee = totalFunds >= fee;
          const strengthComparison = isPlayerOwned
            ? null
            : getStrengthComparison({
                ...prop,
                marketPrice: activePrice,
              });
          const propertyPresentation = getPropertyPresentation(prop.description);
          const isBoss =
            campaignMode === 'savage' ||
            isNormalCityBoss(properties, prop);

          // Owner badge styles
          let ownerBadgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
          if (prop.owner === 'player') {
            ownerBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
          } else if (prop.owner === 'dofor') {
            ownerBadgeColor = 'bg-red-500/20 text-red-300 border-red-500/40';
          } else if (prop.owner === 'abyss') {
            ownerBadgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
          } else if (prop.owner === 'independent') {
            ownerBadgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
          }

          return (
            <div
              key={prop.id}
              className={`trade-target-card ${
                isPlayerOwned ? 'trade-target-card--owned' : ''
              } ${prop.isCartelHQ ? 'trade-target-card--hq' : ''}`}
              data-grade={strengthComparison?.grade}
            >
              <img
                src={getFankitJobArt(`${prop.id}-${prop.community}-${prop.industry}`)}
                alt=""
                aria-hidden="true"
                className="trade-target-card__art"
              />
              <div className="trade-target-card__content">
                <div className="trade-target-card__eyebrow">
                  <span>{prop.community} ・ {prop.industry}</span>
                  <span
                    className={`trade-target-card__owner ${ownerBadgeColor}`}
                  >
                    {prop.ownerName}
                  </span>
                </div>

                <h3 className="trade-target-card__title">
                  <span>{prop.name}</span>
                  {isBoss && (
                    <span
                      className="trade-target-card__badge trade-target-card__badge--boss"
                      aria-label={campaignMode === 'savage' ? '零式ボス' : '都市ボス'}
                      title={campaignMode === 'savage' ? '零式ボス' : '都市ボス'}
                    >
                      <Crown aria-hidden="true" />
                      BOSS
                    </span>
                  )}
                  {prop.id.startsWith('prop_starter_') && !isPlayerOwned && (
                    <span className="trade-target-card__badge trade-target-card__badge--starter">
                      初心者向け
                    </span>
                  )}
                  {prop.isCartelHQ && (
                    <span className="trade-target-card__badge trade-target-card__badge--hq">
                      企業連合本部
                    </span>
                  )}
                  {!countsTowardCityConquest(prop) && (
                    <span className="trade-target-card__badge trade-target-card__badge--optional">
                      任意の企業連合戦
                    </span>
                  )}
                </h3>

                {strengthComparison && (
                  <StrengthComparison result={strengthComparison} compact summaryOnly />
                )}

                <div className="trade-target-card__action">
                  {isPlayerOwned ? (
                    <div className="trade-target-card__owned-state">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {campaignMode === 'savage' ? '零式踏破済み' : '自社保有中'}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuyoutClick(prop, activePrice, fee, canAffordFee)}
                      title={HELP_TEXT.brokerageFee}
                      className={`trade-target-card__challenge ${
                        canAffordFee
                          ? 'trade-target-card__challenge--ready'
                          : 'trade-target-card__challenge--blocked'
                      }`}
                    >
                      {canAffordFee ? (
                        <>
                          <span className="trade-target-card__challenge-copy">
                            <b>{campaignMode === 'savage' ? '零式へ挑戦' : '商戦へ挑戦'}</b>
                            <small>開始手数料 {formatCurrency(fee)}</small>
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-4 h-4 text-rose-400" />
                          <span>手数料不足 (要 {formatCurrency(fee)})</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <details className="trade-target-card__details">
                  <summary>
                    <span>事業・世界観を見る</span>
                    <span className="trade-target-card__details-open">開く ▼</span>
                    <span className="trade-target-card__details-close">畳む ▲</span>
                  </summary>
                  <div>
                    {propertyPresentation.tags.length > 0 && (
                      <p className="trade-target-card__tags">
                        {propertyPresentation.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </p>
                    )}
                    <p>{propertyPresentation.text}</p>
                    {!isPlayerOwned && <small>基準となる交渉規模：{formatCurrency(activePrice)}</small>}
                  </div>
                </details>
              </div>
            </div>
          );
        })}
      </div>

      {filteredProperties.length === 0 && (
        <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-sm">条件に一致する交渉対象が見つかりませんでした。</p>
          <p className="mt-1 text-xs text-slate-500">都市・産業・所属の絞り込み条件を減らしてみてください。</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 min-h-11 rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-4 py-2 text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-900/50"
          >
            絞り込みをリセット
          </button>
        </div>
      )}

    </div>
  );
};

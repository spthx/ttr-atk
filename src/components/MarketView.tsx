import React, { useState, useMemo, useEffect } from 'react';
import { Property, IndustryType, CommunityType } from '../types';
import { TRADE_COMMUNITIES } from '../data/worldData';
import { formatCurrency } from '../utils/formatter';
import { soundFx } from '../utils/audio';
import { Search, ArrowRight, ShieldAlert, CheckCircle2, TrendingUp, TrendingDown, Newspaper } from 'lucide-react';
import { WindIndicator, WIND_CONDITIONS, WindCondition, WindType } from './WindIndicator';
import { BeginnerGuide } from './BeginnerGuide';
import { HelpTip } from './HelpTip';
import { HELP_TEXT } from '../data/helpText';
import { FANKIT_ART, getFankitJobArt } from '../data/fankitAssets';

interface MarketViewProps {
  properties: Property[];
  totalFunds: number;
  onStartBuyout: (property: Property) => void;
}

export const MarketView: React.FC<MarketViewProps> = ({
  properties,
  totalFunds,
  onStartBuyout,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('ALL');
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityType | 'ALL'>('ALL');
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>('ALL');

  // Real-time market fluctuation state for FX-like observation
  const [marketRates, setMarketRates] = useState<Record<string, { price: number; change: number }>>({});
  const [latestNews, setLatestNews] = useState<string>(
    '【市場速報】各都市の取引所が開始。全産業で売買が活発になっています！'
  );

  const newsItems = [
    '【市場ニュース】中央銀行の金利政策により、不動産・農業株に買気集中！',
    '【底値気配】一部の独立物件で一時的な価格下落！安値買いの仕込みチャンス！',
    '【企業連合動向】東アルデナード商会圏が交渉資金を積み増した模様。',
    '【産業トピックス】馬・畜産業で需要が急増。毎秒収益への期待が高まる。',
    '【市場気配】全体的に押し目買いが優勢。買収工作の絶好のタイミング！',
  ];

  // Market Wind & Momentum State
  const [marketWind, setMarketWind] = useState<WindCondition>(WIND_CONDITIONS.TAILWIND_PLAYER);
  const [windCountdown, setWindCountdown] = useState<number>(8);

  useEffect(() => {
    const timer = setInterval(() => {
      setWindCountdown((prev) => {
        if (prev <= 1) {
          const types: WindType[] = ['TAILWIND_PLAYER', 'HEADWIND_PLAYER', 'TAILWIND_ENEMY', 'CROSSWIND', 'CALM'];
          const nextType = types[Math.floor(Math.random() * types.length)];
          setMarketWind(WIND_CONDITIONS[nextType]);
          return 8;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fluctuate property prices periodically
  useEffect(() => {
    // Initial rates
    const initial: Record<string, { price: number; change: number }> = {};
    properties.forEach((p) => {
      const change = (Math.random() * 20 - 10); // -10% to +10%
      initial[p.id] = {
        price: Math.max(1000, Math.round(p.marketPrice * (1 + change / 100))),
        change: Math.round(change * 10) / 10,
      };
    });
    setMarketRates(initial);

    const interval = setInterval(() => {
      setMarketRates((prev) => {
        const next = { ...prev };
        const targetProp = properties[Math.floor(Math.random() * properties.length)];
        if (targetProp) {
          const delta = (Math.random() * 8 - 4); // -4% to +4% shift
          const currentChange = Math.max(-15, Math.min(25, (next[targetProp.id]?.change || 0) + delta));
          next[targetProp.id] = {
            price: Math.max(1000, Math.round(targetProp.marketPrice * (1 + currentChange / 100))),
            change: Math.round(currentChange * 10) / 10,
          };
        }
        return next;
      });

      if (Math.random() < 0.4) {
        setLatestNews(newsItems[Math.floor(Math.random() * newsItems.length)]);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [properties]);

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
      TRADE_COMMUNITIES.map((community) => {
        const targets = properties.filter((property) => property.community === community.id);
        const owned = targets.filter((property) => property.owner === 'player').length;
        return {
          ...community,
          owned,
          total: targets.length,
          conquered: targets.length > 0 && owned === targets.length,
        };
      }),
    [properties]
  );

  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.community.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesIndustry =
        selectedIndustry === 'ALL' || p.industry === selectedIndustry;

      const matchesCommunity =
        selectedCommunity === 'ALL' || p.community === selectedCommunity;

      const matchesOwner =
        selectedOwnerFilter === 'ALL' ||
        (selectedOwnerFilter === 'INDEPENDENT' && p.owner === 'independent') ||
        (selectedOwnerFilter === 'CARTEL' && (p.owner === 'dofor' || p.owner === 'abyss')) ||
        (selectedOwnerFilter === 'PLAYER' && p.owner === 'player');

      return matchesSearch && matchesIndustry && matchesCommunity && matchesOwner;
    });
  }, [properties, searchTerm, selectedIndustry, selectedCommunity, selectedOwnerFilter]);

  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedIndustry('ALL');
    setSelectedCommunity('ALL');
    setSelectedOwnerFilter('ALL');
  };

  const handleBuyoutClick = (prop: Property, activePrice: number, fee: number, canAffordFee: boolean) => {
    if (!canAffordFee) {
      soundFx.playWarning();
      setNoticeMessage(
        `【所持金不足】${prop.name} の買収仲介手数料 ${formatCurrency(fee)} が不足しています。（現在の所持金: ${formatCurrency(totalFunds)}）`
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

  return (
    <div className="space-y-3 font-sans">
      <BeginnerGuide />
      <section className="relative min-h-28 overflow-hidden rounded-xl border border-amber-400/40 shadow-2xl">
        <img
          src={FANKIT_ART.marketBackdrop}
          alt="FFXIVファンキットによる交易世界の背景"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/20" />
        <div className="relative z-10 flex min-h-28 max-w-2xl flex-col justify-center px-5 py-4">
          <p className="text-[10px] font-black tracking-[0.28em] text-amber-300">EORZEA GRAND MARKET</p>
          <h2 className="mt-1 text-xl font-black text-white drop-shadow-lg sm:text-2xl">全都市を、ギルの力で商圏に。</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-200 drop-shadow">
            相場を読み、防衛予算を枯らし、最後の直接出資で押し切る。タタル商会の交易戦線です。
          </p>
        </div>
        <div className="absolute bottom-2 right-3 z-10 rounded border border-white/20 bg-slate-950/65 px-2 py-1 text-[8px] text-slate-300 backdrop-blur-sm">
          FFXIVファンキット素材使用
        </div>
      </section>

      {/* Insufficient Funds Warning Banner */}
      {noticeMessage && (
        <div className="bg-rose-950/90 border border-rose-500 text-rose-200 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between shadow-lg animate-bounce">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{noticeMessage}</span>
          </div>
          <button
            onClick={() => setNoticeMessage(null)}
            className="text-rose-400 hover:text-white font-black text-sm px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Streamlined Market Ticker & Wind */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 shadow flex items-center gap-2 flex-1">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[11px] shrink-0">
            <Newspaper className="w-3.5 h-3.5 text-amber-400" />
            <span>速報</span>
          </div>
          <div className="text-xs text-slate-200 font-mono truncate flex-1">
            {latestNews}
          </div>
        </div>

        <div className="shrink-0">
          <WindIndicator currentWind={marketWind} nextChangeSeconds={windCountdown} compact />
        </div>
      </div>

      {/* City Conquest Progress */}
      <section className="rounded-xl border border-violet-500/20 bg-slate-900/80 p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1 text-xs font-black text-violet-200">
            都市商圏の制覇状況
            <HelpTip term="都市制覇" description={HELP_TEXT.cityConquest} />
          </h2>
          <span className="text-[10px] text-slate-400">都市内の全物件取得で制覇</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-violet-500/40">
          {communityProgress.map((community) => {
            const isSelected = selectedCommunity === community.id;
            return (
              <button
                key={community.id}
                type="button"
                onClick={() => setSelectedCommunity(isSelected ? 'ALL' : community.id)}
                className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                  community.conquered
                    ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-300'
                    : isSelected
                    ? 'border-violet-400 bg-violet-950/70 text-violet-200'
                    : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-violet-500/50'
                }`}
                title={`${community.region}／${community.marketCharacter}。${HELP_TEXT.cityConquest}`}
              >
                <span className="block text-[10px] font-bold">{community.id}</span>
                <span className="block text-[9px] font-mono opacity-80">
                  {community.owned}/{community.total} {community.conquered ? '制覇' : '取得'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            aria-label="物件を検索"
            title="物件名、所有者名、都市名、説明文から検索します"
            placeholder="物件名・所有者・キーワード検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/70 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
          <select
            aria-label="都市で絞り込む"
            title="表示する都市を選びます"
            value={selectedCommunity}
            onChange={(e) => setSelectedCommunity(e.target.value as CommunityType | 'ALL')}
            className="bg-slate-950 border border-violet-500/40 rounded-lg px-2.5 py-1.5 text-xs text-violet-200 focus:outline-none focus:border-violet-400"
          >
            <option value="ALL">全都市</option>
            {TRADE_COMMUNITIES.map((community) => (
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
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
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
            title="独立物件、企業連合、自社所有で絞り込みます"
            value={selectedOwnerFilter}
            onChange={(e) => setSelectedOwnerFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">全所有者</option>
            <option value="INDEPENDENT">独立（未所属）</option>
            <option value="CARTEL">企業連合</option>
            <option value="PLAYER">自社所有</option>
          </select>
        </div>
      </div>

      {/* Property Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProperties.map((prop) => {
          const isPlayerOwned = prop.owner === 'player';
          const rateInfo = marketRates[prop.id] || { price: prop.marketPrice, change: 0 };
          const activePrice = rateInfo.price;
          const fee = Math.round(activePrice * 0.03);
          const canAffordFee = totalFunds >= fee;

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
              className={`relative overflow-hidden bg-slate-900 border rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:border-slate-600 shadow-md ${
                isPlayerOwned
                  ? 'border-emerald-500/30 bg-emerald-950/10'
                  : prop.isCartelHQ
                  ? 'border-red-500/40 bg-red-950/10'
                  : 'border-slate-800'
              }`}
            >
              <img
                src={getFankitJobArt(`${prop.community}-${prop.industry}`)}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -right-8 -top-7 h-36 w-36 object-contain opacity-[0.14] saturate-150"
              />
              <div className="relative z-10">
                {/* Community, Industry & Owner Badges */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-violet-950/70 text-violet-300 border border-violet-500/30 truncate">
                      {prop.community}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-amber-400/90 border border-slate-700 truncate">
                      {prop.industry}
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${ownerBadgeColor}`}
                  >
                    {prop.ownerName}
                  </span>
                </div>

                {/* Property Name */}
                <h3 className="text-base font-bold text-slate-100 flex items-center justify-between gap-2">
                  <span>{prop.name}</span>
                  {prop.id.startsWith('prop_starter_') && !isPlayerOwned && (
                    <span className="shrink-0 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-black text-cyan-300 ring-1 ring-cyan-500/30">
                      初心者向け
                    </span>
                  )}
                  {prop.isCartelHQ && (
                    <span className="text-[10px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded uppercase">
                      企業連合本部
                    </span>
                  )}
                </h3>

                {/* Description */}
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {prop.description}
                </p>

                {/* Real-time FX Market Financial Metrics */}
                <div className="mt-3.5 p-2.5 rounded-lg bg-slate-950/90 border border-slate-800/90 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-slate-400 font-semibold">
                      現在相場価格
                      <HelpTip term="現在相場価格" description={HELP_TEXT.marketPrice} />
                    </span>
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="text-amber-300 text-sm">{formatCurrency(activePrice)}</span>
                      {rateInfo.change < 0 ? (
                        <span className="text-[11px] text-emerald-400 font-bold flex items-center bg-emerald-950/60 px-1 rounded border border-emerald-500/30">
                          <TrendingDown className="w-3 h-3 mr-0.5" />
                          {rateInfo.change}% (底値)
                        </span>
                      ) : (
                        <span className="text-[11px] text-rose-400 font-bold flex items-center bg-rose-950/60 px-1 rounded border border-rose-500/30">
                          <TrendingUp className="w-3 h-3 mr-0.5" />
                          +{rateInfo.change}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-slate-400">
                      仲介手数料（相場の3%）
                      <HelpTip term="仲介手数料" description={HELP_TEXT.brokerageFee} />
                    </span>
                    <span className="font-semibold text-rose-300">{formatCurrency(fee)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-1.5">
                    <span className="flex items-center gap-1 text-slate-400">
                      毎秒収益
                      <HelpTip term="毎秒収益" description={HELP_TEXT.passiveRevenue} />
                    </span>
                    <span className="font-bold text-emerald-400">+{formatCurrency(prop.annualRevenue)}/s</span>
                  </div>
                </div>
              </div>

              {/* Action Area */}
              <div className="mt-4 pt-2">
                {isPlayerOwned ? (
                  <div className="w-full py-2 px-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    自社所有中（毎秒収益を受取中）
                  </div>
                ) : (
                  <button
                    onClick={() => handleBuyoutClick(prop, activePrice, fee, canAffordFee)}
                    title={HELP_TEXT.brokerageFee}
                    className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 active:brightness-90 touch-manipulation select-none cursor-pointer ${
                      canAffordFee
                        ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/20 border border-amber-400/50'
                        : 'bg-slate-800 hover:bg-slate-750 text-rose-300/90 border border-slate-700/80 hover:border-rose-500/50'
                    }`}
                  >
                    {canAffordFee ? (
                      <>
                        <span>買収工作を開始 (手数料 {formatCurrency(fee)})</span>
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
            </div>
          );
        })}
      </div>

      {filteredProperties.length === 0 && (
        <div className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-sm">条件に一致する物件が見つかりませんでした。</p>
          <p className="mt-1 text-xs text-slate-500">検索語や都市・産業・所有者の条件を減らしてみてください。</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-4 py-2 text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-900/50"
          >
            絞り込みをリセット
          </button>
        </div>
      )}

      <footer className="pb-2 text-center text-[9px] leading-relaxed text-slate-500">
        本作は非公式・非営利の私用ファンゲームです。FFXIVファンキット素材を使用しています。© SQUARE ENIX
      </footer>    </div>
  );
};

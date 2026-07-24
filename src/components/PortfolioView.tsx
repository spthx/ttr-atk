import React from 'react';
import { Property } from '../types';
import { HelpTip } from './HelpTip';
import { HELP_TEXT } from '../data/helpText';
import {
  formatCurrency,
  getLoyaltyRiskStatus,
  calculateRebellionProbability,
} from '../utils/formatter';
import { soundFx } from '../utils/audio';
import {
  Building2,
  RefreshCw,
  Info,
  ShieldCheck,
} from 'lucide-react';

interface PortfolioViewProps {
  companyName: string;
  properties: Property[];
  totalFunds: number;
  onReduceLoyaltyRisk: (propertyId: string, amount: number, cost: number) => void;
  onGlobalNemawashi: () => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  companyName,
  properties,
  totalFunds,
  onReduceLoyaltyRisk,
  onGlobalNemawashi,
}) => {
  const ownedProperties = properties.filter((p) => p.owner === 'player');

  const totalAssetValue = ownedProperties.reduce((sum, p) => sum + p.marketPrice, 0);
  const totalRevenue = ownedProperties.reduce((sum, p) => sum + p.annualRevenue, 0);
  const avgLoyaltyRisk =
    ownedProperties.length > 0
      ? Math.round(
          ownedProperties.reduce((sum, p) => sum + p.loyaltyRisk, 0) /
            ownedProperties.length
        )
      : 0;

  const globalNemawashiCost = Math.round(totalAssetValue * 0.02);

  const handleSingleNemawashi = (prop: Property) => {
    const cost = Math.round(prop.marketPrice * 0.02);
    if (totalFunds < cost) return;
    soundFx.playCoin();
    onReduceLoyaltyRisk(prop.id, 30, cost);
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              {companyName}の保有物件・独立危険度
              <HelpTip term="独立危険度" description={HELP_TEXT.independenceRisk} />
            </h2>
          </div>

          {/* Global Nemawashi Action */}
          {ownedProperties.length > 0 && (
            <button
              onClick={onGlobalNemawashi}
              disabled={totalFunds < globalNemawashiCost}
              title={HELP_TEXT.nemawashi}
              className={`px-4 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 shadow-md transition-all shrink-0 ${
                totalFunds >= globalNemawashiCost
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <RefreshCw className="w-4 h-4 text-indigo-300" />
              全傘下一括ネマワシ（費用 {formatCurrency(globalNemawashiCost)}）
            </button>
          )}
        </div>

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400">所有物件数 & 総資産評価</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-black text-amber-400">{ownedProperties.length} 件</span>
              <span className="text-xs text-slate-400">({formatCurrency(totalAssetValue)})</span>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              合計毎秒収益
              <HelpTip term="毎秒収益" description={HELP_TEXT.passiveRevenue} />
            </span>
            <div className="text-lg font-black text-emerald-400 mt-1">
              +{formatCurrency(totalRevenue)}/秒
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              平均独立危険度
              <HelpTip term="独立危険度" description={HELP_TEXT.independenceRisk} align="right" />
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-lg font-black ${
                  avgLoyaltyRisk >= 80
                    ? 'text-rose-400'
                    : avgLoyaltyRisk >= 40
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {avgLoyaltyRisk} / 100
              </span>
              <span className="text-[10px] text-slate-500">
                ({getLoyaltyRiskStatus(avgLoyaltyRisk).label})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Independence settlement note */}
      <div className="flex items-start gap-3 rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 text-xs text-indigo-200">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" />
        <div className="space-y-1">
          <strong className="flex items-center gap-1 font-bold text-indigo-300">
            独立した物件の精算
            <HelpTip term="独立時の精算" description="独立した物件は失いますが、その時点の評価額は商会資金へ戻ります。" />
          </strong>
          <p className="leading-relaxed text-indigo-200/80">
            独立した物件は保有一覧から外れ、現在評価額が商会資金へ戻ります。以後の毎秒収益と支援元は失うため、まずはネマワシで予防するのが安全です。
          </p>
          <details className="pt-1 text-[11px] text-indigo-300/75">
            <summary className="cursor-pointer font-semibold">上級者向け：清算を利用する場合</summary>
            <p className="mt-1 leading-relaxed">支援金を受けた後に独立精算を資金繰りへ利用できますが、収益とシナジーが崩れるため高リスクです。</p>
          </details>
        </div>
      </div>

      {/* Owned Properties List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          保有物件一覧（{ownedProperties.length}件）
        </h3>

        {ownedProperties.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-xl">
            <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm font-medium">現在所有している物件はありません。</p>
            <p className="text-xs text-slate-500 mt-1">「市場・物件」画面から最初の物件を買収しましょう。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ownedProperties.map((prop) => {
              const status = getLoyaltyRiskStatus(prop.loyaltyRisk);
              const rebellionProb = (calculateRebellionProbability(prop.loyaltyRisk) * 100).toFixed(1);
              const singleCost = Math.round(prop.marketPrice * 0.02);

              return (
                <div
                  key={prop.id}
                  className={`bg-slate-900 border rounded-xl p-4 space-y-3 shadow-md ${status.borderColor}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-violet-300 bg-violet-950/70 px-2 py-0.5 rounded border border-violet-500/30">
                          {prop.community}
                        </span>
                        <span className="text-[10px] font-semibold text-amber-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {prop.industry}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-100 mt-1">{prop.name}</h4>
                    </div>

                    <span
                      className={`text-xs px-2.5 py-1 rounded-md border font-bold ${status.bgColor} ${status.textColor} ${status.borderColor}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  {/* Financials */}
                  <div className="flex items-center justify-between text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">現在評価価値</span>
                      <span className="font-bold text-amber-400">{formatCurrency(prop.marketPrice)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px]">毎秒収益</span>
                      <span className="font-bold text-emerald-400">+{formatCurrency(prop.annualRevenue)}/s</span>
                    </div>
                  </div>

                  {/* Loyalty Risk Meter */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-1 text-slate-400">
                        独立危険度
                        <HelpTip term="独立危険度" description={HELP_TEXT.independenceRisk} />
                      </span>
                      <span className={`font-bold ${status.textColor}`}>
                        {prop.loyaltyRisk} / 100 (離脱確率 {rebellionProb}%)
                      </span>
                    </div>

                    <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          prop.loyaltyRisk >= 80
                            ? 'bg-rose-500'
                            : prop.loyaltyRisk >= 40
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(prop.loyaltyRisk, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-[11px] text-slate-400">
                      ネマワシ費用: <strong className="text-slate-200">{formatCurrency(singleCost)}</strong>
                    </span>

                    <button
                      onClick={() => handleSingleNemawashi(prop)}
                      disabled={totalFunds < singleCost || prop.loyaltyRisk === 0}
                      title={HELP_TEXT.nemawashi}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                        prop.loyaltyRisk === 0
                          ? 'bg-slate-800 text-slate-500 cursor-default'
                          : totalFunds >= singleCost
                          ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      ネマワシ（危険度 -30）
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

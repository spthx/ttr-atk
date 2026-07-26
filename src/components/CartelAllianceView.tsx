import React from 'react';
import { Cartel, Property, AllianceState } from '../types';
import { formatCurrency } from '../utils/formatter';
import { soundFx } from '../utils/audio';
import {
  ShieldCheck,
  ArrowDown,
  Lock,
  Unlock,
  CheckCircle2,
  Swords,
  Users,
} from 'lucide-react';
import { HelpTip } from './HelpTip';
import { HELP_TEXT } from '../data/helpText';
import { ALLIANCE_CANDIDATES } from '../data/allianceData';
import { isPublicPatronage } from '../utils/alliance';

interface CartelAllianceViewProps {
  companyName: string;
  cartels: Cartel[];
  properties: Property[];
  alliance: AllianceState;
  onFormAlliance: (alliance: Omit<AllianceState, 'active'>) => void;
  onBreakAlliance: () => void;
  onStartBuyout: (property: Property) => void;
}

export const CartelAllianceView: React.FC<CartelAllianceViewProps> = ({
  companyName,
  cartels,
  properties,
  alliance,
  onFormAlliance,
  onBreakAlliance,
  onStartBuyout,
}) => {
  const propertyMap = new Map<string, Property>(properties.map((p) => [p.id, p]));
  const publicPatronageActive = isPublicPatronage(alliance);
  const activeCandidate = ALLIANCE_CANDIDATES.find((candidate) => candidate.allyId === alliance.allyId);

  return (
    <div className="space-y-8">
      {/* 1. External cooperation / public patronage. Grand Companies are never properties. */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              ALLIANCE（外部協力・公的後援）
              <HelpTip term="ALLIANCE" description={HELP_TEXT.alliance} />
            </h2>

            {alliance.active && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-indigo-950/80 border border-indigo-500/40 px-3 py-1.5 rounded-lg text-indigo-300 text-xs font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  {publicPatronageActive ? '公的後援' : '協力協定'}：{alliance.allyName}
                </div>
                <button onClick={onBreakAlliance} className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all cursor-pointer">
                  {publicPatronageActive ? '後援を返上' : '協定解除'}
                </button>
              </div>
            )}
          </div>

          {!alliance.active && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {ALLIANCE_CANDIDATES.map((candidate) => {
                const isGrandCompany = candidate.allyKind === 'grand_company';
                return (
                  <button key={candidate.allyId} type="button" onClick={() => { soundFx.playCoin(); onFormAlliance(candidate); }} className={`min-h-28 p-3 rounded-lg border text-left transition-all cursor-pointer active:scale-[.99] ${isGrandCompany ? 'bg-violet-950/20 border-violet-500/35 hover:border-violet-400/70' : 'bg-indigo-950/20 border-indigo-500/35 hover:border-indigo-400/70'}`}>
                    <span className={`text-[10px] font-black tracking-wider ${isGrandCompany ? 'text-violet-300' : 'text-indigo-300'}`}>
                      {isGrandCompany ? '公的後援' : '協力協定'}
                    </span>
                    <b className="mt-1 block text-sm text-slate-100">{candidate.allyName}</b>
                    <small className="mt-1.5 block text-[11px] leading-relaxed text-slate-400">{candidate.summary}</small>
                    <strong className={`mt-2 block text-xs ${isGrandCompany ? 'text-violet-300' : 'text-indigo-300'}`}>
                      {isGrandCompany ? `${candidate.allyName}へ後援を申請` : `${candidate.allyName}と協定を結ぶ`}
                    </strong>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {alliance.active && publicPatronageActive ? (
          <>
            <p className="rounded-lg border border-violet-500/30 bg-violet-950/20 p-3 text-xs leading-relaxed text-violet-200">
              グランドカンパニーは都市国家の公的組織です。買収・所有・傘下化はできず、許認可・調達・輸送などの後援を受けます。
            </p>
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="flex items-start gap-2"><span className="text-violet-400 font-bold">1. 通商・調達の後援:</span><span>{activeCandidate?.summary || `${alliance.allyName}から公的後援を受けます。`}</span></div>
              <div className="flex items-start gap-2"><span className="text-violet-400 font-bold">2. 支援要請:</span><span>一交渉1回、許認可・調達・輸送を含む相場32%相当の支援価値を受けます。LBには含まれません。</span></div>
              <div className="flex items-start gap-2"><span className="text-slate-400 font-bold">3. 任意返上:</span><span>後援はいつでも返上できます。通常物件への買収で自動解除されません。</span></div>
            </div>
          </>
        ) : alliance.active ? (
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
            <div className="flex items-start gap-2"><span className="text-indigo-400 font-bold">1. 不可侵契約:</span><span>協力企業から{companyName}への対抗買収が一切仕掛けられなくなります。</span></div>
            <div className="flex items-start gap-2"><span className="text-indigo-400 font-bold">2. 協力支援要請:</span><span>買収交渉ごとに1回、対象相場の32%相当を要請できます。LBには含まれません。</span></div>
            <div className="flex items-start gap-2"><span className="text-rose-400 font-bold">3. 破棄条件:</span><span>協力企業の傘下へ買収を仕掛けると、協定は永久解除されます。</span></div>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-slate-400">
            同時に有効にできる協力先は1つです。企業との協力協定か、三都市いずれかのグランドカンパニーによる公的後援を選べます。
          </p>
        )}
      </div>

      {/* 2. Enterprise Alliances & Staged Negotiation */}
      <div className="space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Swords className="w-5 h-5 text-rose-400" />
            トレード・アライアンス攻略
            <HelpTip term="本部防衛資本" description={HELP_TEXT.defenseCapital} />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            参加組織と提携するほど、本部防衛資本が低下します。
          </p>
        </div>

        <div className="space-y-6">
          {cartels.map((cartel) => {
            const hqProp = propertyMap.get(cartel.hqPropertyId);
            const subProps = cartel.subsidiaryIds
              .map((id) => propertyMap.get(id))
              .filter(Boolean) as Property[];

            const ownedSubsCount = subProps.filter((p) => p.owner === 'player').length;
            const totalSubsCount = subProps.length;
            const allSubsDefeated = ownedSubsCount === totalSubsCount;

            // Calculate current HQ Defense Buffer
            const currentDefense = allSubsDefeated
              ? 50_000_000 // Weakened HQ defense!
              : Math.round(
                  cartel.maxDefenseCapital *
                    ((totalSubsCount - ownedSubsCount + 1) / (totalSubsCount + 1))
                );

            const isHqOwned = hqProp?.owner === 'player';

            return (
              <div
                key={cartel.id}
                className={`bg-slate-900 border rounded-xl p-5 space-y-5 shadow-xl ${
                  isHqOwned
                    ? 'border-emerald-500/40 bg-emerald-950/10'
                    : allSubsDefeated
                    ? 'border-amber-500/50 bg-amber-950/10'
                    : 'border-slate-800'
                }`}
              >
                {/* Cartel Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        TRADE ALLIANCE
                      </span>
                      <h3 className="text-lg font-bold text-slate-100">{cartel.name}</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{cartel.description}</p>
                  </div>

                  {/* Defense Buffer Bar */}
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs min-w-[240px]">
                    <div className="flex justify-between font-bold mb-1">
                      <span className="flex items-center gap-1 text-slate-400">
                        本部防衛資本
                        <HelpTip term="本部防衛資本" description={HELP_TEXT.defenseCapital} align="right" />
                      </span>
                      <span
                        className={
                          allSubsDefeated ? 'text-amber-400 animate-pulse' : 'text-rose-400'
                        }
                      >
                        {formatCurrency(currentDefense)}
                      </span>
                    </div>

                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          allSubsDefeated ? 'bg-amber-400' : 'bg-rose-500'
                        }`}
                        style={{
                          width: `${Math.max(
                            5,
                            (currentDefense / cartel.maxDefenseCapital) * 100
                          )}%`,
                        }}
                      />
                    </div>

                    <span className="text-[10px] text-slate-500 mt-1 block text-right">
                      子会社残: {totalSubsCount - ownedSubsCount} / {totalSubsCount} 件
                    </span>
                  </div>
                </div>

                {/* List of participating properties */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <ArrowDown className="w-4 h-4 text-amber-400" />
                    【ステップ1】参加組織・供給網との個別交渉
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {subProps.map((sub) => {
                      const isOwnedByPlayer = sub.owner === 'player';
                      const fee = Math.round(sub.marketPrice * 0.03);

                      return (
                        <div
                          key={sub.id}
                          className={`p-3 rounded-lg border flex flex-col justify-between ${
                            isOwnedByPlayer
                              ? 'bg-emerald-950/20 border-emerald-500/30'
                              : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 text-[11px]">
                              <span className="font-semibold text-slate-300">{sub.name}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  isOwnedByPlayer
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {isOwnedByPlayer ? '提携成立' : '参加中'}
                              </span>
                            </div>

                            <div className="mt-2 text-xs space-y-0.5 text-slate-400">
                              <div>相場: <strong className="text-amber-400">{formatCurrency(sub.marketPrice)}</strong></div>
                              <div>手数料: <span className="text-rose-400/90">{formatCurrency(fee)}</span></div>
                            </div>
                          </div>

                          <div className="mt-3">
                            {isOwnedByPlayer ? (
                              <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                提携成立（本部防衛資本が低下）
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  soundFx.playCoin();
                                  onStartBuyout(sub);
                                }}
                                className="w-full py-1.5 px-2 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all active:scale-95 touch-manipulation cursor-pointer"
                              >
                                参加交渉を開始
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* HQ Target (ステップ2: 完全吸収) */}
                {hqProp && (
                  <div className="pt-2">
                    <div
                      className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                        isHqOwned
                          ? 'bg-emerald-950/30 border-emerald-500/40'
                          : allSubsDefeated
                          ? 'bg-amber-950/20 border-amber-500/50'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                            allSubsDefeated ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {allSubsDefeated ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                        </div>

                        <div>
                          <div className="text-xs text-slate-400 font-semibold">
                            【最終ステップ】アライアンス本部との交渉
                          </div>
                          <h4 className="text-base font-bold text-slate-100">{hqProp.name}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {allSubsDefeated
                              ? '参加組織すべてとの提携が成立し、本部防衛資本が最低まで低下しました。'
                              : '残る参加組織と先に提携すると、本部防衛資本をさらに減らせます。'}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {isHqOwned ? (
                          <div className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-xs flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            アライアンス攻略完了
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              soundFx.playCoin();
                              onStartBuyout({ ...hqProp, marketPrice: currentDefense });
                            }}
                            className={`px-4 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all active:scale-95 touch-manipulation cursor-pointer ${
                              allSubsDefeated
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 cursor-pointer shadow-lg shadow-amber-500/20'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer'
                            }`}
                          >
                            <span>本部との最終交渉</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Cartel, Property, AllianceState } from '../types';
import { soundFx } from '../utils/audio';
import {
  ShieldCheck,
  ArrowDown,
  Unlock,
  CheckCircle2,
  Swords,
  Users,
} from 'lucide-react';
import { HelpTip } from './HelpTip';
import { HELP_TEXT } from '../data/helpText';
import { ALLIANCE_CANDIDATES } from '../data/allianceData';
import { isPublicPatronage } from '../utils/alliance';
import type { BattleReadinessResult } from '../utils/battleReadiness';
import { StrengthComparison } from './StrengthComparison';
import { calculateCartelHeadquartersDefense } from '../utils/cartel';

interface CartelAllianceViewProps {
  companyName: string;
  cartels: Cartel[];
  properties: Property[];
  alliance: AllianceState;
  getStrengthComparison: (property: Property) => BattleReadinessResult;
  onFormAlliance: (alliance: Omit<AllianceState, 'active'>) => void;
  onBreakAlliance: () => void;
  onStartBuyout: (property: Property) => void;
}

export const CartelAllianceView: React.FC<CartelAllianceViewProps> = ({
  companyName,
  cartels,
  properties,
  alliance,
  getStrengthComparison,
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
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              味方の外部協力
              <HelpTip term="味方の外部協力" description={HELP_TEXT.alliance} />
            </h2>

            {alliance.active && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-indigo-950/80 border border-indigo-500/40 px-3 py-1.5 rounded-lg text-indigo-300 text-xs font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  {publicPatronageActive ? '公的後援' : '協力協定'}：{alliance.allyName}
                </div>
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
                    <small className="mt-1.5 block text-[11px] leading-relaxed text-slate-300">
                      毎戦1回の大口支援・手元資金の消費なし・離反なし
                    </small>
                    <strong className={`mt-2 block text-xs ${isGrandCompany ? 'text-violet-300' : 'text-indigo-300'}`}>
                      {isGrandCompany ? `${candidate.allyName}へ後援を申請` : `${candidate.allyName}と協定を結ぶ`}
                    </strong>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <section className="rounded-lg border border-indigo-500/30 bg-indigo-950/20 px-3 py-2.5 text-xs text-indigo-100">
          <b className="block text-sm">
            {alliance.active
              ? `外部協力：${alliance.allyName}`
              : '協力先を一つ選ぶと、味方の動員力に外部協力が加わります'}
          </b>
          <span className="mt-1 block leading-relaxed text-slate-300">
            毎戦1回・手元資金の消費なし・離反なし
          </span>
        </section>
        <details className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 text-xs text-slate-400">
          <summary className="min-h-11 cursor-pointer content-center font-bold text-slate-300">協力内容を確認・変更</summary>
          <p className="pb-3 leading-relaxed">
            外部協力は対象相場の75%相当を各戦闘で1回だけ要請できます。人脈の連続使用回数、LIMIT BREAK、恒常収益には加わりません。
            保有する人脈は複数回呼べる一方、連続要請で支援が弱まり、勝利後に離反する可能性があります。
            {publicPatronageActive ? ' 公的後援先は買収・所有できません。' : ''}
            {activeCandidate?.summary ? ` ${activeCandidate.summary}` : ''}
            {alliance.active ? ` 協定を解除・返上すると別の協力先を選べます。${companyName}の保有事業にはなりません。` : ''}
          </p>
          {alliance.active && (
            <button
              type="button"
              onClick={onBreakAlliance}
              className="mb-3 min-h-11 w-full rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-500/25"
            >
              {publicPatronageActive ? '現在の後援を返上' : '現在の協定を解除'}
            </button>
          )}
        </details>
      </div>

      {/* 2. Enterprise Alliances & Staged Negotiation */}
      <div className="space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Swords className="w-5 h-5 text-rose-400" />
            攻略対象：競合企業連合
            <HelpTip term="本部防衛資本" description={HELP_TEXT.defenseCapital} />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            参加企業を味方にする → 本部の守りが下がる → 本部へ挑戦。戦力の足し算は各相手の「今回の動員力」で確認できます。
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
            const currentDefense = calculateCartelHeadquartersDefense(
              cartel,
              ownedSubsCount,
              totalSubsCount
            );
            const defensePercent = Math.round(
              (currentDefense / Math.max(1, cartel.maxDefenseCapital)) * 100
            );

            const isHqOwned = hqProp?.owner === 'player';
            const hqBattleProperty = hqProp
              ? { ...hqProp, marketPrice: currentDefense }
              : null;
            const hqStrengthComparison =
              hqBattleProperty && !isHqOwned
                ? getStrengthComparison(hqBattleProperty)
                : null;

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
                        RIVAL ALLIANCE
                      </span>
                      <h3 className="text-lg font-bold text-slate-100">{cartel.name}</h3>
                      {cartel.id === 'cartel_abyss' && (
                        <span
                          className="shrink-0 rounded border border-cyan-500/30 bg-cyan-950/40 px-1.5 py-0.5 text-[11px] font-bold text-cyan-200"
                          title="FFXIV公式には存在しない、本作独自のIF企業連合です"
                        >
                          創作IF
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{cartel.description}</p>
                  </div>

                  {/* Qualitative headquarters progress; exact combat math appears in the readiness equation. */}
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs min-w-[220px]">
                    <div className="flex justify-between font-bold mb-1">
                      <span className="flex items-center gap-1 text-slate-400">
                        本部の守り
                        <HelpTip term="本部防衛資本" description={HELP_TEXT.defenseCapital} align="right" />
                      </span>
                      <span
                        className={
                          allSubsDefeated ? 'text-amber-400' : 'text-rose-400'
                        }
                      >
                        最大時の{defensePercent}%
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
                            defensePercent
                          )}%`,
                        }}
                      />
                    </div>

                    <span className="text-[10px] text-slate-400 mt-1 block text-right">
                      味方になった参加企業 {ownedSubsCount} / {totalSubsCount}
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
                      const strengthComparison = isOwnedByPlayer
                        ? null
                        : getStrengthComparison(sub);

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

                            <p className="mt-2 text-[11px] leading-relaxed text-emerald-200/80">
                              勝利後：この企業が人脈に加わり、本部の防衛力が下がる
                            </p>
                          </div>

                          {strengthComparison && (
                            <div className="mt-3">
                              <StrengthComparison result={strengthComparison} compact summaryOnly />
                            </div>
                          )}

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
                                className="min-h-11 w-full py-1.5 px-2 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all active:scale-95 touch-manipulation cursor-pointer"
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
                          {allSubsDefeated ? <Unlock className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                        </div>

                        <div>
                          <div className="text-xs text-slate-400 font-semibold">
                            【最終ステップ】企業連合本部との交渉
                          </div>
                          <h4 className="text-base font-bold text-slate-100">{hqProp.name}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {allSubsDefeated
                              ? '参加組織すべてとの提携が成立し、本部防衛資本が最低まで低下しました。'
                              : '今すぐ挑戦もできますが、残る参加組織と先に提携すると本部防衛資本をさらに減らせます。'}
                          </p>
                        </div>
                      </div>

                      {hqStrengthComparison && (
                        <div className="w-full min-w-0 sm:max-w-sm">
                          <StrengthComparison result={hqStrengthComparison} compact summaryOnly />
                        </div>
                      )}

                      <div className="shrink-0 text-right">
                        {isHqOwned ? (
                          <div className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-xs flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            企業連合攻略完了
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              soundFx.playCoin();
                              onStartBuyout(hqBattleProperty ?? hqProp);
                            }}
                            title={allSubsDefeated ? '弱体化した企業連合本部へ挑戦します' : '早期挑戦できます。参加組織との提携で防衛資本を下げられます'}
                            className={`min-h-11 px-4 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all active:scale-95 touch-manipulation cursor-pointer ${
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

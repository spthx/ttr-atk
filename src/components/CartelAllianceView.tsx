import React from 'react';
import { Cartel, Property, AllianceState } from '../types';
import { soundFx } from '../utils/audio';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ShieldCheck,
  Swords,
  Users,
} from 'lucide-react';
import { HelpTip } from './HelpTip';
import { HELP_TEXT } from '../data/helpText';
import { ALLIANCE_CANDIDATES } from '../data/allianceData';
import { isPublicPatronage } from '../utils/alliance';
import type { BattleReadinessResult } from '../utils/battleReadiness';
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

const READINESS_LABEL: Record<BattleReadinessResult['grade'], string> = {
  advantage: '余力あり',
  even: '接戦',
  challenge: '要工夫',
  danger: '準備不足',
};

const READINESS_COLOR: Record<BattleReadinessResult['grade'], string> = {
  advantage: 'text-emerald-300',
  even: 'text-cyan-300',
  challenge: 'text-amber-300',
  danger: 'text-rose-300',
};

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
  const propertyMap = new Map<string, Property>(properties.map((property) => [property.id, property]));
  const publicPatronageActive = isPublicPatronage(alliance);
  const activeCandidate = ALLIANCE_CANDIDATES.find((candidate) => candidate.allyId === alliance.allyId);

  const startNegotiation = (property: Property) => {
    soundFx.playCoin();
    onStartBuyout(property);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-indigo-500/25 bg-slate-900 p-3 shadow-md sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-black text-slate-100">
            <Users className="h-5 w-5 text-indigo-400" />
            味方の外部協力
            <HelpTip term="味方の外部協力" description={HELP_TEXT.alliance} />
          </h2>
          {alliance.active && (
            <span className="flex items-center gap-1.5 rounded-full border border-indigo-400/40 bg-indigo-950/80 px-3 py-1.5 text-xs font-black text-indigo-200">
              <ShieldCheck className="h-4 w-4" />{alliance.allyName}
            </span>
          )}
        </div>

        {!alliance.active ? (
          <>
          <p className="mt-3 text-xs font-bold text-indigo-100">
            性能差なし。好きな勢力を1つ選べます。
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-4">
            {ALLIANCE_CANDIDATES.map((candidate) => {
              const isGrandCompany = candidate.allyKind === 'grand_company';
              return (
                <button
                  key={candidate.allyId}
                  type="button"
                  onClick={() => { soundFx.playCoin(); onFormAlliance(candidate); }}
                  className={`min-h-20 rounded-lg border p-2.5 text-left transition active:scale-[.98] ${isGrandCompany ? 'border-violet-500/35 bg-violet-950/20 hover:border-violet-300' : 'border-indigo-500/35 bg-indigo-950/20 hover:border-indigo-300'}`}
                >
                  <small className={`block text-[10px] font-black ${isGrandCompany ? 'text-violet-300' : 'text-indigo-300'}`}>{isGrandCompany ? '公的後援' : '協力協定'}</small>
                  <b className="mt-1 block text-xs text-slate-100 sm:text-sm">{candidate.allyName}</b>
                  <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-400">選ぶ <ArrowRight className="h-3 w-3" /></span>
                </button>
              );
            })}
          </div>
          </>
        ) : (
          <p className="mt-3 rounded-lg border border-indigo-500/20 bg-indigo-950/20 px-3 py-2 text-xs font-bold text-indigo-100">
            各商戦で1回、相場75%相当を無料支援
          </p>
        )}

        <details className="group mt-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 text-xs text-slate-400">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-bold text-slate-300 marker:content-none">
            協力の詳しい効果・変更
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-slate-800 pb-3 pt-2 leading-relaxed">
            <p>手元資金の消費・離反なし。人脈の連続使用回数、LIMIT BREAK、恒常収益には加わりません。{publicPatronageActive ? '公的後援先は買収・所有できません。' : ''}{activeCandidate?.summary ? ` ${activeCandidate.summary}` : ''}</p>
            {alliance.active && (
              <button type="button" onClick={onBreakAlliance} className="mt-3 min-h-11 w-full rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 font-bold text-rose-300">
                {publicPatronageActive ? '現在の後援を返上' : '現在の協定を解除'}
              </button>
            )}
            <small className="mt-2 block text-slate-500">協力先は{companyName}の保有事業にはなりません。</small>
          </div>
        </details>
      </section>

      <section className="rounded-xl border border-rose-500/20 bg-slate-900 p-3 shadow-lg sm:p-4">
        <h2 className="flex items-center gap-2 text-base font-black text-slate-100">
          <Swords className="h-5 w-5 text-rose-400" />競合企業連合
          <HelpTip term="本部防衛資本" description={HELP_TEXT.defenseCapital} />
        </h2>
        <p className="mt-1 text-xs text-slate-400">光っている相手から交渉。参加企業を味方にすると、本部の守りが下がります。</p>
      </section>

      <div className="grid gap-3 xl:grid-cols-2">
        {cartels.map((cartel) => {
          const hqProperty = propertyMap.get(cartel.hqPropertyId);
          const subsidiaryProperties = cartel.subsidiaryIds
            .map((id) => propertyMap.get(id))
            .filter(Boolean) as Property[];
          const ownedSubsCount = subsidiaryProperties.filter((property) => property.owner === 'player').length;
          const nextSubsidiary = subsidiaryProperties.find((property) => property.owner !== 'player');
          const allSubsDefeated = ownedSubsCount === subsidiaryProperties.length;
          const hqOwned = hqProperty?.owner === 'player';
          const currentDefense = calculateCartelHeadquartersDefense(cartel, ownedSubsCount, subsidiaryProperties.length);
          const defensePercent = Math.round((currentDefense / Math.max(1, cartel.maxDefenseCapital)) * 100);
          const hqBattleProperty = hqProperty ? { ...hqProperty, marketPrice: currentDefense } : null;
          const primaryTarget = nextSubsidiary ?? (hqOwned ? null : hqBattleProperty);
          const primaryReadiness = primaryTarget ? getStrengthComparison(primaryTarget) : null;

          return (
            <article key={cartel.id} className={`rounded-xl border p-4 shadow-xl ${hqOwned ? 'border-emerald-500/40 bg-emerald-950/15' : allSubsDefeated ? 'border-amber-400/50 bg-amber-950/10' : 'border-slate-800 bg-slate-900'}`}>
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <small className="text-[10px] font-black tracking-widest text-rose-300">RIVAL ALLIANCE</small>
                  <h3 className="truncate text-base font-black text-slate-100">{cartel.name}</h3>
                </div>
                <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-black ${hqOwned ? 'bg-emerald-500/20 text-emerald-300' : allSubsDefeated ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/15 text-rose-300'}`}>
                  {hqOwned ? '攻略完了' : `本部防衛 ${defensePercent}%`}
                </span>
              </header>

              <div className="mt-3 flex items-center gap-1.5" aria-label={`参加企業との提携 ${ownedSubsCount}/${subsidiaryProperties.length}`}>
                {subsidiaryProperties.map((property) => (
                  <span key={property.id} title={property.name} className={`h-3 flex-1 rounded-full border ${property.owner === 'player' ? 'border-emerald-300 bg-emerald-400' : 'border-slate-600 bg-slate-800'}`} />
                ))}
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-500" />
                <ShieldCheck className={`h-6 w-6 shrink-0 ${hqOwned ? 'text-emerald-400' : allSubsDefeated ? 'text-amber-300' : 'text-rose-400'}`} />
              </div>
              <p className="mt-1 flex justify-between gap-2 text-[11px] font-bold text-slate-400">
                <span>参加企業 {ownedSubsCount}/{subsidiaryProperties.length}</span>
                <span>{allSubsDefeated ? '本部弱体化 完了' : `全${subsidiaryProperties.length}社提携で本部弱体化`}</span>
              </p>

              {primaryTarget && primaryReadiness ? (
                <div className="mt-3 rounded-lg border border-cyan-500/20 bg-slate-950/65 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <small className="block text-[10px] font-black text-slate-500">次の交渉</small>
                      <b className="block truncate text-sm text-slate-100">{primaryTarget.name}</b>
                    </span>
                    <b className={`shrink-0 text-xs ${READINESS_COLOR[primaryReadiness.grade]}`}>{READINESS_LABEL[primaryReadiness.grade]}</b>
                  </div>
                  <button type="button" onClick={() => startNegotiation(primaryTarget)} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-amber-300/60 bg-gradient-to-r from-amber-600 to-amber-300 px-3 py-2 text-xs font-black text-slate-950 shadow-lg shadow-amber-500/10 active:scale-[.98]">
                    {nextSubsidiary ? 'この参加企業と交渉' : '弱体化した本部へ挑戦'} <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/30 text-xs font-black text-emerald-300"><CheckCircle2 className="h-4 w-4" />企業連合攻略完了</p>
              )}

              <details className="group mt-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 text-xs">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-bold text-slate-300 marker:content-none">
                  全ルートを見る
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="grid gap-2 border-t border-slate-800 py-3">
                  {subsidiaryProperties.map((property) => {
                    const owned = property.owner === 'player';
                    const readiness = owned ? null : getStrengthComparison(property);
                    return (
                      <div key={property.id} className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2">
                        <span className="min-w-0 truncate text-slate-300">{property.name}</span>
                        {owned ? <b className="shrink-0 text-emerald-400">提携済み</b> : (
                          <button type="button" onClick={() => startNegotiation(property)} className="shrink-0 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-1.5 font-bold text-amber-300">{readiness ? READINESS_LABEL[readiness.grade] : '交渉'}</button>
                        )}
                      </div>
                    );
                  })}
                  {hqBattleProperty && (
                    <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-rose-500/25 bg-rose-950/15 px-2.5 py-2">
                      <span className="min-w-0 truncate font-bold text-slate-200">本部：{hqBattleProperty.name}</span>
                      {hqOwned ? <b className="shrink-0 text-emerald-400">攻略済み</b> : (
                        <button type="button" onClick={() => startNegotiation(hqBattleProperty)} className="shrink-0 rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-1.5 font-bold text-rose-300">本部へ</button>
                      )}
                    </div>
                  )}
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </div>
  );
};

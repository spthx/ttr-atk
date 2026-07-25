import React from 'react';
import { Building2, ClipboardList, MessageSquareText } from 'lucide-react';
import { GAME_WORLD } from '../data/worldData';
import type { AppTab } from '../types';

interface TatarAdvisorProps {
  activeTab: AppTab;
  ownedCount: number;
  conqueredCommunityCount: number;
  totalCommunityCount: number;
}

const getAdvice = ({
  activeTab,
  ownedCount,
  conqueredCommunityCount,
  totalCommunityCount,
}: TatarAdvisorProps) => {
  if (activeTab === 'savage') {
    return '商戦 零式は通常商圏の所有権を奪う戦いではありません。層ごとの資金チェックと敵の詠唱を覚えて、何度でも挑むでっす！';
  }

  if (conqueredCommunityCount === totalCommunityCount && totalCommunityCount > 0) {
    return '全都市の商圏を押さえたでっす！ 零式レイドで交易網の限界へ挑むでっす！';
  }

  if (ownedCount === 0) {
    return 'まずは手の届く物件を選んで、仲介手数料と残り資金を確認するでっす。';
  }

  if (activeTab === 'market') {
    return '都市ごとの物件数と相場を比べて、制覇までの残りが少ない市場から狙うでっす。';
  }
  if (activeTab === 'portfolio') {
    return '傘下の独立危険度を点検するでっす。支援を求めすぎた会社には根回しが必要でっす。';
  }
  if (activeTab === 'skills') {
    return '物件の組み合わせで使える手が増えるでっす。次の買収先に合う技を選ぶでっす。';
  }
  return '本部へ挑む前に参加カンパニーを切り崩して、外部協力や公的後援と資金余力を整えるでっす。';
};

export const TatarAdvisor: React.FC<TatarAdvisorProps> = (props) => (
  <section className="rounded-xl border border-amber-500/35 bg-gradient-to-r from-amber-950/45 via-slate-900 to-slate-900 p-3 shadow-lg">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-300/60 bg-amber-500 text-lg font-black text-slate-950 shadow">
          タ
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-amber-300">{GAME_WORLD.advisorName}</span>
            <span className="rounded border border-amber-500/30 bg-amber-950/80 px-2 py-0.5 text-[10px] font-bold text-amber-200">
              {GAME_WORLD.advisorRole}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-300">
              <ClipboardList className="h-3 w-3" />
              報告者：あなた（{GAME_WORLD.playerRole}）
            </span>
          </div>
          <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-slate-200">
            <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>「{getAdvice(props)}」</span>
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/75 px-3 py-2 text-[11px]">
        <Building2 className="h-4 w-4 text-cyan-400" />
        <div>
          <span className="block text-slate-500">都市制覇</span>
          <strong className="font-mono text-cyan-300">
            {props.conqueredCommunityCount}/{props.totalCommunityCount}
          </strong>
        </div>
      </div>
    </div>
  </section>
);
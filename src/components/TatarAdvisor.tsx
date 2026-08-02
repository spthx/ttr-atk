import React from 'react';
import { Building2, ClipboardList, MessageSquareText } from 'lucide-react';
import { GAME_WORLD } from '../data/worldData';
import { FANKIT_ART } from '../data/fankitAssets';
import type { AppTab } from '../types';

interface TatarAdvisorProps {
  activeTab: AppTab;
  ownedCount: number;
  conqueredCommunityCount: number;
  totalCommunityCount: number;
  savageClearedCount: number;
  savageTargetCount: number;
  ultimateUnlocked: boolean;
  ultimateCleared: boolean;
}

const getAdvice = ({
  activeTab,
  ownedCount,
  conqueredCommunityCount,
  totalCommunityCount,
  savageClearedCount,
  savageTargetCount,
  ultimateUnlocked,
  ultimateCleared,
}: TatarAdvisorProps) => {
  if (activeTab === 'savage') {
    if (ultimateCleared) {
      return '商戦 零式3編・全12章と絶商戦、すべて踏破でっす！ 記録戦には何度でも再挑戦できるので、自分らしい商いの回し方を磨くでっす。';
    }
    if (ultimateUnlocked) {
      return '商戦 零式3編・全12章を踏破したでっす！ 次は別枠の単独最終戦「絶商戦」で、積み上げた全システムを使い切るでっす。';
    }
    return `商戦 零式は3編×4層を順に挑む全12章の記録戦でっす。現在${savageClearedCount}/${savageTargetCount}章、競合アクションの予兆を覚えて次へ進むでっす！`;
  }

  if (conqueredCommunityCount === totalCommunityCount && totalCommunityCount > 0) {
    return '十都市の人脈がすべてつながったでっす！ 零式レイドで交易網の限界へ挑むでっす！';
  }

  if (ownedCount === 0) {
    return 'まずは手の届く交渉対象を選んで、仲介手数料と残り資金を確認するでっす。';
  }

  if (activeTab === 'market') {
    return '都市ごとの人脈数と相場を比べて、必要な人脈をそろえながら次の交易路を開くでっす。';
  }
  if (activeTab === 'portfolio') {
    return '人脈の独立危険度を点検するでっす。支援を求めすぎた相手にはネマワシが必要でっす。';
  }
  if (activeTab === 'skills') {
    return '事業・契約の組み合わせで使えるアビリティが増えるでっす。次の交渉に合う一手を選ぶでっす。';
  }
  return '本部へ挑む前に参加カンパニーを切り崩して、外部協力や公的後援と資金余力を整えるでっす。';
};

export const TatarAdvisor: React.FC<TatarAdvisorProps> = (props) => (
  <section className="rounded-xl border border-amber-500/35 bg-gradient-to-r from-amber-950/45 via-slate-900 to-slate-900 p-3 shadow-lg">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-end justify-center overflow-hidden rounded-xl border border-amber-300/60 bg-gradient-to-b from-amber-100/15 to-amber-950/60 shadow">
          <img
            src={FANKIT_ART.tataru.windUp}
            alt="タタル"
            className="h-13 w-13 object-contain object-bottom"
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-amber-300">{GAME_WORLD.advisorName}</span>
            <span className="rounded border border-amber-500/30 bg-amber-950/80 px-2 py-0.5 text-xs font-bold text-amber-200">
              {GAME_WORLD.advisorRole}
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-cyan-300">
              <ClipboardList className="h-3 w-3" />
              担当：あなた（{GAME_WORLD.playerRole}）
            </span>
          </div>
          <p className="mt-1 flex items-start gap-1.5 text-sm leading-relaxed text-slate-200">
            <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>「{getAdvice(props)}」</span>
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/75 px-3 py-2 text-xs">
        <Building2 className="h-4 w-4 text-cyan-400" />
        <div>
          <span className="block text-slate-500">人脈開通</span>
          <strong className="font-mono text-cyan-300">
            {props.conqueredCommunityCount}/{props.totalCommunityCount}
          </strong>
        </div>
      </div>
    </div>
  </section>
);

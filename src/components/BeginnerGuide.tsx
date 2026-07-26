import React, { useState } from 'react';
import { BookOpenCheck, Building2, Coins, TrendingUp } from 'lucide-react';
import { HelpTip } from './HelpTip';
import { HELP_TEXT } from '../data/helpText';

interface BeginnerGuideProps {
  defaultOpen?: boolean;
}

export const BeginnerGuide: React.FC<BeginnerGuideProps> = ({
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group rounded-xl border border-cyan-500/25 bg-cyan-950/10 text-xs text-slate-200"
    >
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 font-bold text-cyan-200 marker:content-none">
      <span className="flex items-center gap-2">
        <BookOpenCheck className="h-4 w-4 text-cyan-400" />
        はじめての方へ：最初の買収まで
      </span>
      <span className="text-xs font-normal text-slate-500 group-open:hidden">開く</span>
      <span className="hidden text-xs font-normal text-slate-500 group-open:inline">閉じる</span>
    </summary>

    <div className="border-t border-cyan-500/20 px-3 pb-3 pt-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-950/75 p-2.5">
          <div className="mb-1 flex items-center gap-1.5 font-black text-amber-300">
            <Building2 className="h-3.5 w-3.5" /> 1. 安い交渉対象を選ぶ
          </div>
          <p className="leading-relaxed text-slate-400">「初心者向け」か、挑戦前の戦力比較が「◎余力あり」「＝接戦」の対象から開始。交渉時に相場の3%を支払います。</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/75 p-2.5">
          <div className="mb-1 flex items-center gap-1.5 font-black text-amber-300">
            <Coins className="h-3.5 w-3.5" /> 2. 少額出資で右へ押す
          </div>
          <p className="leading-relaxed text-slate-400">グリダニアでは風が吹きません。「投資レベル」で小口～全力の金額を選び、「投資実行」で1回投入します。</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/75 p-2.5">
          <div className="mb-1 flex items-center gap-1.5 font-black text-emerald-300">
            <TrendingUp className="h-3.5 w-3.5" /> 3. 収益を次の元手にする
          </div>
          <p className="leading-relaxed text-slate-400">取得した事業・契約から毎秒収益が入り、次の交渉とネマワシへ使えます。</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-950/60 px-2.5 py-2 text-xs text-slate-400">
        <span className="font-bold text-slate-300">よく使う用語：</span>
        <span className="flex items-center gap-1">仲介手数料 <HelpTip term="仲介手数料" description={HELP_TEXT.brokerageFee} /></span>
        <span className="flex items-center gap-1">直接出資 <HelpTip term="直接出資" description={HELP_TEXT.directInvestment} /></span>
        <span className="flex items-center gap-1">独立危険度 <HelpTip term="独立危険度" description={HELP_TEXT.independenceRisk} align="right" /></span>
        <span className="ml-auto text-xs text-cyan-400/80">「？」はマウスオーバー／タップで説明</span>
      </div>
    </div>
    </details>
  );
};

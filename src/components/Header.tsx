import React from 'react';
import { formatCurrency } from '../utils/formatter';
import { soundFx } from '../utils/audio';
import { Volume2, VolumeX, Building2, TrendingUp, ShieldCheck, Zap, MapPin, RotateCcw, Swords } from 'lucide-react';
import { HELP_TEXT } from '../data/helpText';
import type { AppTab } from '../types';

interface HeaderProps {
  companyName: string;
  totalFunds: number;
  passiveRevenue: number;
  ownedCount: number;
  totalPropertyCount: number;
  conqueredCommunityCount: number;
  totalCommunityCount: number;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  activeAllianceName: string | null;
  activeSynergiesCount: number;
  tradeAllianceUnlocked: boolean;
  savageUnlocked: boolean;
  savageClearedCount: number;
  savageTargetCount: number;
  ultimateUnlocked: boolean;
  ultimateCleared: boolean;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  onAddFunds?: (amount: number) => void;
  onResetFunds?: () => void;
  onNewGame: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  companyName,
  totalFunds,
  passiveRevenue,
  ownedCount,
  totalPropertyCount,
  conqueredCommunityCount,
  totalCommunityCount,
  activeTab,
  setActiveTab,
  activeAllianceName,
  activeSynergiesCount,
  tradeAllianceUnlocked,
  savageUnlocked,
  savageClearedCount,
  savageTargetCount,
  ultimateUnlocked,
  ultimateCleared,
  soundEnabled,
  setSoundEnabled,
  onAddFunds,
  onResetFunds,
  onNewGame,
}) => {
  const showDebugControls =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debug');

  const toggleSound = () => {
    soundFx.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
    if (!soundEnabled) {
      soundFx.playCoin();
    }
  };

  return (
    <header
      className="sticky z-30 border-b border-slate-800 bg-slate-900 text-slate-100 shadow-xl"
      style={{ top: 'var(--game-safe-top)' }}
    >
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-3 py-2 sm:px-6 flex items-center justify-between gap-2">
        <div
          className="w-8 h-8 shrink-0 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-md text-sm"
          aria-label="タタルの大繁盛商店"
        >
          G
        </div>

        {/* Metrics Bar */}
        <div className="flex items-center gap-2 text-xs">
          {/* Total Capital */}
          <div
            className="bg-slate-950 border border-amber-500/40 rounded-lg px-2.5 py-1 flex items-center gap-1.5 shadow-inner"
            title={`現在使える${companyName}の現金。買収手数料、直接出資、ネマワシに使います。`}
          >
            <span className="text-[10px] text-amber-300 font-semibold hidden sm:inline">資金</span>
            <span className="text-sm font-black text-amber-400 font-mono">
              {formatCurrency(totalFunds)}
            </span>
          </div>

          {/* Test controls are available only with ?debug in the URL. */}
          {showDebugControls && (
            <div className="flex items-center gap-1">
              {onAddFunds && (
              <button
                onClick={() => onAddFunds(100_000_000)}
                className="px-2 py-1 rounded bg-amber-950 hover:bg-amber-900 border border-amber-500/50 text-amber-300 text-[10px] font-extrabold cursor-pointer transition-all active:scale-95 shadow"
                title="テスト用：資金に +1億ギル補充"
              >
                🧪 +1億
              </button>
            )}
            {onResetFunds && (
              <button
                onClick={onResetFunds}
                className="px-1.5 py-1 rounded bg-slate-800 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-500/60 text-slate-300 hover:text-rose-300 text-[10px] font-bold cursor-pointer transition-all active:scale-95"
                title="テスト用：資金を初期値（5万ギル）にリセット"
              >
                🔄 リセット
              </button>
              )}
            </div>
          )}

          {/* Passive Yield */}
          <div
            className="bg-slate-950 border border-emerald-500/30 rounded-lg px-2 py-1 flex items-center gap-1"
            title={HELP_TEXT.passiveRevenue}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-emerald-400 font-mono">
              +{formatCurrency(passiveRevenue)}/秒
            </span>
          </div>

          {/* Owned Count */}
          <div
            className="bg-slate-950 border border-slate-700/60 rounded-lg px-2 py-1 flex items-center gap-1 hidden sm:flex"
            title={`${companyName}が保有している事業・契約数／市場に存在する全交渉対象数`}
          >
            <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-xs font-bold text-cyan-300 font-mono">
              {ownedCount}/{totalPropertyCount}
            </span>
          </div>

          {/* City Conquest */}
          <div className="bg-slate-950 border border-violet-500/30 rounded-lg px-2 py-1 items-center gap-1 hidden sm:flex" title={HELP_TEXT.cityConquest}>
            <MapPin className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="text-xs font-bold text-violet-300 font-mono">
              {conqueredCommunityCount}/{totalCommunityCount}
            </span>
          </div>

          {/* Audio Toggle */}
          <button
            onClick={toggleSound}
            type="button"
            aria-label={soundEnabled ? '効果音をオフにする' : '効果音をオンにする'}
            aria-pressed={soundEnabled}
            className="ml-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white cursor-pointer"
            title={soundEnabled ? '効果音OFF' : '効果音ON'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
          <button
            onClick={onNewGame}
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 transition-colors hover:border-rose-500/60 hover:bg-rose-950 hover:text-rose-300 cursor-pointer"
            title="セーブデータを削除してニューゲーム"
            aria-label="セーブデータを削除してニューゲーム"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop Main Tab Navigation */}
      <div className="hidden md:flex max-w-7xl mx-auto px-4 sm:px-6 space-x-1 border-t border-slate-800/80 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('market')}
          className={`py-2 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'market'
              ? 'border-amber-400 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Building2 className="w-4 h-4" />
          交易市場
        </button>

        <button
          onClick={() => setActiveTab('portfolio')}
          className={`py-2 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'portfolio'
              ? 'border-amber-400 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span title={`${companyName}の保有事業・契約`}>
            保有事業・契約 ({ownedCount})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('skills')}
          className={`py-2 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'skills'
              ? 'border-amber-400 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Zap className="w-4 h-4" />
          スキル・事業連携
        </button>

        {tradeAllianceUnlocked && (
          <button
            onClick={() => setActiveTab('cartels')}
            className={`py-2 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'cartels'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            企業連合・協力
          </button>
        )}

        {savageUnlocked && (
          <button
            onClick={() => setActiveTab('savage')}
            className={`py-2 px-3 text-xs sm:text-sm font-black border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'savage'
                ? 'border-rose-400 text-rose-300 bg-rose-500/10'
                : 'border-transparent text-rose-300/75 hover:text-rose-200 hover:bg-rose-950/30'
            }`}
          >
            <Swords className="w-4 h-4" />
            {ultimateUnlocked ? '零式・絶' : '商戦 零式'}
            <span className="rounded bg-rose-950 px-1.5 py-0.5 text-[9px]">
              {savageClearedCount}/{savageTargetCount}
              {ultimateUnlocked ? ultimateCleared ? ' 絶✓' : ' 絶OPEN' : ''}
            </span>
          </button>
        )}
      </div>

      {/* Mobile Sticky Bottom Command Navigation Bar */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 grid ${savageUnlocked ? 'grid-cols-5' : tradeAllianceUnlocked ? 'grid-cols-4' : 'grid-cols-3'} h-14 px-1 shadow-2xl touch-manipulation select-none pb-safe`}>
        <button
          onClick={() => setActiveTab('market')}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            activeTab === 'market' ? 'text-amber-400 font-extrabold' : 'text-slate-400'
          }`}
        >
          <Building2 className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-none">市場</span>
        </button>

        <button
          onClick={() => setActiveTab('portfolio')}
          className={`flex flex-col items-center justify-center py-1 transition-colors relative ${
            activeTab === 'portfolio' ? 'text-amber-400 font-extrabold' : 'text-slate-400'
          }`}
        >
          <TrendingUp className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-none">保有事業</span>
          {ownedCount > 0 && (
            <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] flex items-center justify-center">
              {ownedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('skills')}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            activeTab === 'skills' ? 'text-amber-400 font-extrabold' : 'text-slate-400'
          }`}
        >
          <Zap className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-none">スキル</span>
        </button>

        {tradeAllianceUnlocked && (
          <button
            onClick={() => setActiveTab('cartels')}
            className={`flex flex-col items-center justify-center py-1 transition-colors ${
              activeTab === 'cartels' ? 'text-amber-400 font-extrabold' : 'text-slate-400'
            }`}
          >
            <ShieldCheck className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] leading-none">連合・協力</span>
          </button>
        )}

        {savageUnlocked && (
          <button
            onClick={() => setActiveTab('savage')}
            className={`relative flex flex-col items-center justify-center py-1 transition-colors ${
              activeTab === 'savage' ? 'text-rose-300 font-extrabold' : 'text-rose-300/70'
            }`}
          >
            <Swords className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] leading-none">{ultimateUnlocked ? '零式・絶' : '零式'}</span>
            <span className="absolute right-1 top-1 rounded bg-rose-950 px-1 text-[8px] text-rose-200">
              {ultimateUnlocked ? ultimateCleared ? '絶✓' : '絶' : `${savageClearedCount}/${savageTargetCount}`}
            </span>
          </button>
        )}
      </nav>
    </header>
  );
};

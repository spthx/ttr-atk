import React from 'react';
import { Compass, Wind } from 'lucide-react';

export type WindType = 'TAILWIND_PLAYER' | 'HEADWIND_PLAYER' | 'TAILWIND_ENEMY' | 'CROSSWIND' | 'CALM';
export type WindProgressionStage = 0 | 1 | 2 | 3;

export interface WindCondition {
  type: WindType;
  title: string;
  directionLabel: string;
  arrowDirection: 'left' | 'right' | 'down' | 'up' | 'spin';
  playerMultiplier: number;
  enemyMultiplier: number;
  speedMultiplier: number;
  strengthStars: number; // 1 to 5
  description: string;
  colorClass: string;
  bgGradient: string;
}

export const WIND_CONDITIONS: Record<WindType, WindCondition> = {
  TAILWIND_PLAYER: {
    type: 'TAILWIND_PLAYER',
    title: '【自社追い風】商機到来',
    directionLabel: '東風 (自社買収推力 +35%)',
    arrowDirection: 'left', // Pushing left towards victory
    playerMultiplier: 1.35,
    enemyMultiplier: 1.0,
    speedMultiplier: 1.0,
    strengthStars: 5,
    description: '自社の交信・交渉力が好調。出資の押し出し力が35%上昇。いま積むほど大きく所有率を奪えます。',
    colorClass: 'text-emerald-300 border-emerald-500/50',
    bgGradient: 'from-emerald-950/80 to-teal-950/80',
  },
  HEADWIND_PLAYER: {
    type: 'HEADWIND_PLAYER',
    title: '【自社向かい風】買収難航',
    directionLabel: '西風 (自社交渉力 -28%)',
    arrowDirection: 'right', // Pushing right towards enemy
    playerMultiplier: 0.72,
    enemyMultiplier: 1.0,
    speedMultiplier: 1.0,
    strengthStars: 2,
    description: '買収先の旧経営陣が抵抗中。出資の押し出し効果が28%低下。資金温存か作戦による打開が有効です。',
    colorClass: 'text-rose-300 border-rose-500/50',
    bgGradient: 'from-rose-950/80 to-amber-950/80',
  },
  TAILWIND_ENEMY: {
    type: 'TAILWIND_ENEMY',
    title: '【競合追い風】防衛強化',
    directionLabel: '北風（競合防衛力 +35%）',
    arrowDirection: 'right',
    playerMultiplier: 1.0,
    enemyMultiplier: 1.35,
    speedMultiplier: 1.0,
    strengthStars: 4,
    description: '競合に後援が到着。相手の防衛出資の効きが35%上昇。敵の攻勢が所有率へ明確に響きます。',
    colorClass: 'text-amber-300 border-amber-500/50',
    bgGradient: 'from-amber-950/80 to-orange-950/80',
  },
  CROSSWIND: {
    type: 'CROSSWIND',
    title: '【乱旋風】値動きが活発',
    directionLabel: '旋風（双方1.12倍・速度1.45倍）',
    arrowDirection: 'spin',
    playerMultiplier: 1.12,
    enemyMultiplier: 1.12,
    speedMultiplier: 1.45,
    strengthStars: 5,
    description: '相場が活発化。双方の出資効果が12%上昇し、所有率の移動速度も45%加速する決戦状態。',
    colorClass: 'text-yellow-300 border-yellow-500/50',
    bgGradient: 'from-yellow-950/80 to-[#1e1700]',
  },
  CALM: {
    type: 'CALM',
    title: '【静穏の風】安定気配',
    directionLabel: '南風 (平穏・基準値)',
    arrowDirection: 'up',
    playerMultiplier: 1.0,
    enemyMultiplier: 1.0,
    speedMultiplier: 1.0,
    strengthStars: 3,
    description: '市場の風向きは穏やか。標準的な資本力とアビリティによる順当な駆け引きが展開中。',
    colorClass: 'text-cyan-300 border-cyan-500/50',
    bgGradient: 'from-cyan-950/80 to-slate-950/80',
  },
};

export const WIND_ACTIVE_SECONDS = 10;
export const WIND_CALM_SECONDS = 16;

export const getWindProgressionStage = (
  connectedCommunityCount: number
): WindProgressionStage => {
  if (connectedCommunityCount < 1) return 0;
  if (connectedCommunityCount < 2) return 1;
  if (connectedCommunityCount < 3) return 2;
  return 3;
};

export const getWindPool = (
  stage: WindProgressionStage
): WindType[] => {
  if (stage === 1) return ['TAILWIND_PLAYER'];
  if (stage === 2) {
    return ['TAILWIND_PLAYER', 'TAILWIND_PLAYER', 'TAILWIND_ENEMY'];
  }
  if (stage === 3) {
    return [
      'TAILWIND_PLAYER',
      'TAILWIND_PLAYER',
      'TAILWIND_ENEMY',
      'HEADWIND_PLAYER',
      'CROSSWIND',
    ];
  }
  return [];
};

export const getWindStageLabel = (stage: WindProgressionStage) => {
  if (stage === 1) return '入門：味方追い風';
  if (stage === 2) return '応用：競合追い風';
  if (stage === 3) return '全風種 解放済み';
  return '未解放';
};

interface WindIndicatorProps {
  currentWind: WindCondition;
  nextChangeSeconds: number;
  progressionStage?: WindProgressionStage;
  compact?: boolean;
}

export const WindIndicator: React.FC<WindIndicatorProps> = ({
  currentWind,
  nextChangeSeconds,
  progressionStage = 3,
  compact = false,
}) => {
  if (progressionStage === 0) {
    return (
      <div
        className="rs3-window flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-xs shadow"
        title="グリダニアの基礎商戦では風補正は発生しません。進行後にタタルが説明します。"
      >
        <span className="flex items-center gap-1.5 font-extrabold text-slate-200">
          <Compass className="h-4 w-4 shrink-0 text-cyan-400" />
          市場の風：未解放
        </span>
        <small className="text-right text-[10px] font-bold text-slate-400">
          補正なし・基本操作を練習
        </small>
      </div>
    );
  }

  const countdownLabel =
    currentWind.type === 'CALM' ? '次の風まで' : '静穏まで';

  if (compact) {
    return (
      <div
        className={`rs3-window border rounded-lg px-2.5 py-1.5 bg-gradient-to-r ${currentWind.bgGradient} ${currentWind.colorClass} shadow flex items-center justify-between text-xs transition-all duration-300`}
        title={`${currentWind.description} ${countdownLabel}${nextChangeSeconds}秒。${getWindStageLabel(progressionStage)}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Compass className="w-4 h-4 text-amber-400 shrink-0 animate-spin-slow" />
          <span className="font-extrabold truncate text-xs">{currentWind.title}</span>
          <span className="text-xs text-slate-300 hidden sm:inline">({currentWind.directionLabel})</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
          {currentWind.playerMultiplier > 1.0 && (
            <span className="bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/50 font-bold">
              交渉力{currentWind.playerMultiplier}x
            </span>
          )}
          {currentWind.playerMultiplier < 1.0 && (
            <span className="bg-rose-950 text-rose-300 px-1.5 py-0.2 rounded border border-rose-500/50 font-bold">
              交渉力{currentWind.playerMultiplier}x
            </span>
          )}
          {currentWind.enemyMultiplier > 1.0 && (
            <span className="bg-amber-950 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/50 font-bold">
              敵防衛{currentWind.enemyMultiplier}x
            </span>
          )}
          {currentWind.speedMultiplier > 1.0 && (
            <span className="bg-yellow-950 text-yellow-300 px-1.5 py-0.2 rounded border border-yellow-500/50 font-bold">
              暴風{currentWind.speedMultiplier}x
            </span>
          )}
          <span className="text-xs text-amber-300 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700 font-bold">
            {countdownLabel} {nextChangeSeconds}秒
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rs3-window border rounded-lg p-2 bg-gradient-to-r ${currentWind.bgGradient} ${currentWind.colorClass} shadow-md transition-all duration-300 text-xs`}
      title={`${currentWind.description} ${countdownLabel}${nextChangeSeconds}秒。${getWindStageLabel(progressionStage)}`}
    >
      <div className="flex items-center justify-between">
        {/* Left: Wind Direction & Icon */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="relative p-1.5 rounded-full bg-slate-900/90 border border-slate-700 shadow shrink-0">
            <Compass className="w-4 h-4 text-amber-400 animate-spin-slow" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1 truncate">
              <span className="font-extrabold text-xs tracking-wide truncate">
                {currentWind.title}
              </span>
              <span className="text-[9px] text-yellow-300 font-mono shrink-0">
                {'★'.repeat(currentWind.strengthStars)}
              </span>
            </div>

            <div className="text-[10px] font-bold opacity-90 flex items-center gap-1 truncate">
              <Wind className="w-3 h-3 shrink-0" />
              <span className="truncate">{currentWind.directionLabel}</span>
            </div>
          </div>
        </div>

        {/* Right: Multiplier Badge & Change Timer */}
        <div className="text-right shrink-0 ml-1">
          <div className="text-[9px] font-bold text-slate-300 flex items-center justify-end gap-1">
            <span>{countdownLabel}</span>
            <span className="font-mono text-amber-300 font-bold text-[10px] bg-slate-900/80 px-1 py-0.2 rounded border border-slate-700">
              {nextChangeSeconds}秒
            </span>
          </div>

          <div className="text-[10px] font-extrabold mt-0.5">
            {currentWind.playerMultiplier > 1.0 && (
              <span className="bg-emerald-900/90 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-400/50">
                交渉力{currentWind.playerMultiplier}倍
              </span>
            )}
            {currentWind.playerMultiplier < 1.0 && (
              <span className="bg-rose-900/90 text-rose-300 px-1.5 py-0.2 rounded border border-rose-400/50">
                交渉力{currentWind.playerMultiplier}倍
              </span>
            )}
            {currentWind.enemyMultiplier > 1.0 && (
              <span className="bg-amber-900/90 text-amber-300 px-1.5 py-0.2 rounded border border-amber-400/50">
                敵防衛{currentWind.enemyMultiplier}倍
              </span>
            )}
            {currentWind.speedMultiplier > 1.0 && (
              <span className="bg-yellow-900/90 text-yellow-300 px-1.5 py-0.2 rounded border border-yellow-400/50">
                暴風{currentWind.speedMultiplier}倍
              </span>
            )}
            {currentWind.playerMultiplier === 1.0 &&
              currentWind.enemyMultiplier === 1.0 &&
              currentWind.speedMultiplier === 1.0 && (
                <span className="bg-cyan-900/90 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-400/50">
                  標準
                </span>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

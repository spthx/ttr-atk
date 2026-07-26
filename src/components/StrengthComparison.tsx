import React from 'react';
import { Gauge, ShieldAlert, Sparkles } from 'lucide-react';
import { formatCurrency } from '../utils/formatter';
import type { BattleReadinessResult } from '../utils/battleReadiness';
import '../strength-comparison.css';

interface StrengthComparisonProps {
  result: BattleReadinessResult;
  compact?: boolean;
}

export const StrengthComparison: React.FC<StrengthComparisonProps> = ({
  result,
  compact = false,
}) => {
  const maximum = Math.max(
    result.playerExpectedCapital,
    result.enemyBudget,
    1
  );
  const playerWidth = Math.max(
    3,
    (result.playerExpectedCapital / maximum) * 100
  );
  const enemyWidth = Math.max(3, (result.enemyBudget / maximum) * 100);

  return (
    <section
      className={`strength-comparison strength-comparison--${result.grade} ${
        compact ? 'strength-comparison--compact' : ''
      }`}
      aria-label={`風なし動員比較。自社見込${formatCurrency(
        result.playerExpectedCapital
      )}、競合予算${formatCurrency(result.enemyBudget)}、${result.label}`}
    >
      <header>
        <span><Gauge />風なし動員比較</span>
        <strong>{result.symbol} {result.label}</strong>
      </header>
      <div className="strength-comparison__values">
        <span>
          <small>自社・動員見込</small>
          <b>{formatCurrency(result.playerExpectedCapital)}</b>
        </span>
        <i>VS</i>
        <span>
          <small>競合・総防衛予算</small>
          <b>{formatCurrency(result.enemyBudget)}</b>
        </span>
      </div>
      <div className="strength-comparison__bars" aria-hidden="true">
        <i><u style={{ width: `${playerWidth}%` }} /></i>
        <i><u style={{ width: `${enemyWidth}%` }} /></i>
      </div>
      <div className="strength-comparison__meta">
        <span>実効資本比 {result.ratioPercent}%</span>
        <span>AI Lv{result.enemyDifficultyLevel}・基準反応 約{result.enemyBaseReactionSeconds.toFixed(1)}秒</span>
        {result.playerPushBonus > 0 && (
          <span title="資本額と等級には加算しません">
            <Sparkles />押込 +{Math.round(result.playerPushBonus * 100)}%（資本外）
          </span>
        )}
        {!result.directInvestmentAvailable && (
          <span className="strength-comparison__risk">
            <ShieldAlert />直接出資不可（小口 {formatCurrency(result.minimumInvestment)}）
          </span>
        )}
        {result.cumulativeSupportFailureProbability > 0 && (
          <span className={result.supportVolatile ? 'strength-comparison__risk' : ''}>
            <ShieldAlert />
            {result.supportRoute === '傘下一巡' ? '一巡離反' : '支援離反'}{' '}
            {Math.round(result.cumulativeSupportFailureProbability * 100)}%
          </span>
        )}
        {result.supportRoute === '傘下一巡' &&
          result.expectedEnemyResponsesDuringSupport >= 1 && (
            <span className="strength-comparison__risk">
              <ShieldAlert />一巡中に競合 約{result.expectedEnemyResponsesDuringSupport.toFixed(1)}回
            </span>
          )}
      </div>
      <div className="strength-comparison__components" aria-label="動員見込みの内訳">
        <small>採用内訳</small>
        {compact ? (
          <span className="strength-comparison__components-summary">
            {result.capitalComponents.map((component) => component.label).join('・')}
          </span>
        ) : (
          <span>
            {result.capitalComponents.map((component) => (
              <em key={component.key}>
                {component.label} {formatCurrency(component.amount)}
              </em>
            ))}
          </span>
        )}
      </div>
      {!compact && (
        <>
          <p>{result.advice}</p>
          <small className="strength-comparison__note">
            風は未算入。傘下支援は各社の離反確率を割り引き、少なくとも1社が
            離反する確率は 1−Π(1−p) で算出。現金＋最良の支援
            （{result.supportRoute}）＋一交渉1回の協力・スキルで比較しています。
            押し込み補正は速度効果のため資本比と等級を逆転させません。
          </small>
        </>
      )}
    </section>
  );
};

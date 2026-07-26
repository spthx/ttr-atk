import React from 'react';
import { Gauge, ShieldAlert, Sparkles } from 'lucide-react';
import { formatCurrency } from '../utils/formatter';
import type { BattleReadinessResult } from '../utils/battleReadiness';
import '../strength-comparison.css';

interface StrengthComparisonProps {
  result: BattleReadinessResult;
  compact?: boolean;
  isTraining?: boolean;
}

export const StrengthComparison: React.FC<StrengthComparisonProps> = ({
  result,
  compact = false,
  isTraining = false,
}) => {
  const trainingPresentation = {
    advantage: {
      label: '余力あり',
      advice: '現在の動員見込みなら、基本の投入操作を試しながら討滅を狙えます。',
    },
    even: {
      label: '挑戦圏',
      advice: '投入順と支援元の使い分けを試すのに適した固定耐久です。',
    },
    challenge: {
      label: '要工夫',
      advice: '支援元、有効なスキル、LIMIT BREAKを組み合わせて耐久を削りましょう。',
    },
    danger: {
      label: '準備不足',
      advice: '現在の動員見込みでは高耐久です。交易網を広げてから再挑戦しましょう。',
    },
  }[result.grade];
  const comparisonTitle = isTraining ? '固定耐久比較' : '風なし動員比較';
  const comparisonLabel = isTraining
    ? trainingPresentation.label
    : result.label;
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
      aria-label={`${comparisonTitle}。自社見込${formatCurrency(
        result.playerExpectedCapital
      )}、${isTraining ? '木人耐久' : '競合予算'}${formatCurrency(result.enemyBudget)}、${comparisonLabel}`}
    >
      <header>
        <span><Gauge />{comparisonTitle}</span>
        <strong>{result.symbol} {comparisonLabel}</strong>
      </header>
      <div className="strength-comparison__values">
        <span>
          <small>自社・動員見込</small>
          <b>{formatCurrency(result.playerExpectedCapital)}</b>
        </span>
        <i>VS</i>
        <span>
          <small>{isTraining ? '木人・耐久資本' : '競合・総防衛予算'}</small>
          <b>{formatCurrency(result.enemyBudget)}</b>
        </span>
      </div>
      <div className="strength-comparison__bars" aria-hidden="true">
        <i><u style={{ width: `${playerWidth}%` }} /></i>
        <i><u style={{ width: `${enemyWidth}%` }} /></i>
      </div>
      <div className="strength-comparison__meta">
        <span>実効資本比 {result.ratioPercent}%</span>
        <span>{isTraining
          ? '木人は追加行動なし'
          : `AI Lv${result.enemyDifficultyLevel}・基準反応 約${result.enemyBaseReactionSeconds.toFixed(1)}秒`}</span>
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
            {result.supportRoute === '支援元一巡' ? '一巡離反' : '支援離反'}{' '}
            {Math.round(result.cumulativeSupportFailureProbability * 100)}%
          </span>
        )}
        {!isTraining && result.supportRoute === '支援元一巡' &&
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
          <p>{isTraining ? trainingPresentation.advice : result.advice}</p>
          <small className="strength-comparison__note">
            {isTraining
              ? '追加行動なしの固定耐久です。訓練中の出資・離反・LB増減は保存されません。'
              : `現金＋離反リスクを織り込んだ最良の支援（${result.supportRoute}）＋一交渉1回の協力・スキルで比較。風と押し込み速度は等級に含みません。`}
          </small>
        </>
      )}
    </section>
  );
};

import React from 'react';
import { Gauge, ShieldAlert } from 'lucide-react';
import { formatCurrency } from '../utils/formatter';
import {
  buildMobilizationPointBreakdown,
  type BattleReadinessResult,
} from '../utils/battleReadiness';
import '../strength-comparison.css';

interface StrengthComparisonProps {
  result: BattleReadinessResult;
  compact?: boolean;
  isTraining?: boolean;
  summaryOnly?: boolean;
}

export const StrengthComparison: React.FC<StrengthComparisonProps> = ({
  result,
  compact = false,
  isTraining = false,
  summaryOnly = false,
}) => {
  const trainingPresentation = {
    advantage: {
      label: '余力あり',
      advice: '現在の動員見込みなら、基本の投入操作を試しながら訓練成功を狙えます。',
    },
    even: {
      label: '挑戦圏',
      advice: '投入順と人脈の使い分けを試すのに適した固定耐久です。',
    },
    challenge: {
      label: '要工夫',
      advice: '人脈、有効なアビリティ、LIMIT BREAKを組み合わせて耐久を削りましょう。',
    },
    danger: {
      label: '準備不足',
      advice: '現在の動員見込みでは高耐久です。交易網を広げてから再挑戦しましょう。',
    },
  }[result.grade];
  const comparisonTitle = isTraining ? '固定耐久比較' : '挑戦前の戦力比較';
  const comparisonLabel = isTraining
    ? trainingPresentation.label
    : result.label;
  const mobilizationBreakdown = buildMobilizationPointBreakdown(
    result.capitalComponents,
    result.enemyBudget
  ).filter((component) => component.points > 0);
  const mobilizationPoints = mobilizationBreakdown.reduce(
    (total, component) => total + component.points,
    0
  );
  const enemyPace =
    result.enemyBaseReactionSeconds >= 3.2
      ? '緩やか'
      : result.enemyBaseReactionSeconds >= 2.45
        ? '標準'
        : result.enemyBaseReactionSeconds >= 1.9
          ? '速い'
          : '苛烈';
  const equationLabel = mobilizationBreakdown.length > 0
    ? `${mobilizationBreakdown
        .map((component) => `${component.label}${component.points}`)
        .join('足す')}、合計${mobilizationPoints}`
    : '動員力0';

  return (
    <section
      className={`strength-comparison strength-comparison--${result.grade} ${
        compact ? 'strength-comparison--compact' : ''
      } ${summaryOnly ? 'strength-comparison--summary' : ''}`}
      aria-label={`${comparisonTitle}。${equationLabel}。${
        isTraining ? '固定耐久' : '競合防衛力'
      }100。${comparisonLabel}。相手の手数は${enemyPace}`}
    >
      <header>
        <span><Gauge />{isTraining ? '訓練の動員力' : '今回の動員力'}</span>
        <strong>{result.symbol} {comparisonLabel}</strong>
      </header>
      <div className="strength-comparison__values">
        <span>
          <small>{isTraining ? '動員力' : '味方の動員力'}</small>
          <b>{mobilizationPoints}</b>
        </span>
        <i>対</i>
        <span>
          <small>{isTraining ? '固定耐久' : '競合の防衛力'}</small>
          <b>100</b>
        </span>
      </div>
      <div
        className="strength-comparison__equation"
        aria-label={`動員力の内訳。${equationLabel}`}
      >
        {mobilizationBreakdown.map((component, index) => (
          <React.Fragment key={component.key}>
            {index > 0 && <i aria-hidden="true">＋</i>}
            <span>
              <small>{component.label}</small>
              <b>{component.points}</b>
            </span>
          </React.Fragment>
        ))}
        <i aria-hidden="true">＝</i>
        <strong>{mobilizationPoints}</strong>
      </div>
      <div className="strength-comparison__verdict">
        <span>相手の手数：{enemyPace}</span>
      </div>
      {result.playerPushBonus > 0 && (
        <div className="strength-comparison__assumptions">
          <span>事業・交易網の後押しあり（動員力の合計外）</span>
        </div>
      )}
      {(
        !result.directInvestmentAvailable || result.supportVolatile || result.mechanicCheckRequired
      ) && (
        <div className="strength-comparison__meta strength-comparison__meta--critical">
          {!result.directInvestmentAvailable && (
            <span className="strength-comparison__risk">
              <ShieldAlert />小口出資不可
            </span>
          )}
          {result.supportVolatile && (
            <span className="strength-comparison__risk">
              <ShieldAlert />勝利後の離脱 {Math.round(result.cumulativeSupportFailureProbability * 100)}%
            </span>
          )}
          {result.mechanicCheckRequired && result.mechanicWarning && (
            <span className="strength-comparison__risk">
              <ShieldAlert />{result.mechanicWarning}
            </span>
          )}
        </div>
      )}
      {result.sequentialSupportGradeCapped && (
        <div className="strength-comparison__meta strength-comparison__meta--critical">
          <span className="strength-comparison__risk">
            <ShieldAlert />人脈だけでは競合の手数に押されます。資金・アビリティ・LBも組み合わせてください。
          </span>
        </div>
      )}
      {!compact && (
        <>
          <p>{isTraining ? trainingPresentation.advice : result.advice}</p>
          <details className="strength-comparison__details">
            <summary>実際のギル額と計算条件</summary>
            <div>
              {result.capitalComponents.map((component, index) => (
                <React.Fragment key={component.key}>
                  {index > 0 && <i aria-hidden="true">＋</i>}
                  <span>{component.label} {formatCurrency(component.amount)}</span>
                </React.Fragment>
              ))}
              <i aria-hidden="true">＝</i>
              <strong>{formatCurrency(result.playerExpectedCapital)}</strong>
              <small>{isTraining ? '固定耐久' : '競合防衛予算'} {formatCurrency(result.enemyBudget)}</small>
            </div>
            <p>
              {isTraining
                ? '追加行動なしの固定耐久です。訓練中の出資・離反・LB増減は保存されません。'
                : `人脈・SYNERGY・LIMIT BREAKのうち最良の経路（${result.supportRoute}）を一つ採用し、外部協力と資金アビリティを別枠で加えています。`}
            </p>
          </details>
        </>
      )}
    </section>
  );
};

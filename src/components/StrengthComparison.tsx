import React from 'react';
import { Gauge, ShieldAlert, Sparkles } from 'lucide-react';
import { formatCurrency } from '../utils/formatter';
import type { BattleReadinessResult } from '../utils/battleReadiness';
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
      advice: '投入順と支援元の使い分けを試すのに適した固定耐久です。',
    },
    challenge: {
      label: '要工夫',
      advice: '支援元、有効なアビリティ、LIMIT BREAKを組み合わせて耐久を削りましょう。',
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
  const capitalTotal = Math.max(
    1,
    result.playerExpectedCapital + result.enemyBudget
  );
  const playerShare = Math.max(
    6,
    Math.min(94, (result.playerExpectedCapital / capitalTotal) * 100)
  );
  const enemyShare = 100 - playerShare;
  const capitalRatio = Math.max(result.ratio, 0.01);
  const balanceLabel =
    capitalRatio >= 1.08
      ? `戦力換算は自社が約${capitalRatio.toFixed(1)}倍`
      : capitalRatio <= 0.92
        ? `戦力換算は競合が約${(1 / capitalRatio).toFixed(1)}倍`
        : '戦力換算はほぼ互角';
  const enemyPace =
    result.enemyBaseReactionSeconds >= 3.2
      ? '緩やか'
      : result.enemyBaseReactionSeconds >= 2.45
        ? '標準'
        : result.enemyBaseReactionSeconds >= 1.9
          ? '速い'
          : '苛烈';
  const nonCashAssumptions = result.capitalComponents
    .filter((component) => component.key !== 'cash' && component.amount > 0)
    .map((component) =>
      component.label.replace('（蓄積分を全消費）', '')
    );
  const supportLabel =
    nonCashAssumptions.length > 0
      ? nonCashAssumptions.join('＋')
      : '自社資金中心';

  return (
    <section
      className={`strength-comparison strength-comparison--${result.grade} ${
        compact ? 'strength-comparison--compact' : ''
      } ${summaryOnly ? 'strength-comparison--summary' : ''}`}
      aria-label={`${comparisonTitle}。自社見込${formatCurrency(
        result.playerExpectedCapital
      )}、${isTraining ? '木人耐久' : '競合予算'}${formatCurrency(result.enemyBudget)}、${comparisonLabel}`}
    >
      <header>
        <span><Gauge />{isTraining ? '訓練戦力' : '挑戦前の戦力比較'}</span>
        <strong>{result.symbol} {comparisonLabel}</strong>
      </header>
      <div className="strength-comparison__values">
        <span>
          <small>自社・戦力換算</small>
          <b>{formatCurrency(result.playerExpectedCapital)}</b>
        </span>
        <i>VS</i>
        <span>
          <small>{isTraining ? '木人・固定耐久' : '競合・防衛力'}</small>
          <b>{formatCurrency(result.enemyBudget)}</b>
        </span>
      </div>
      <div className="strength-comparison__duel-bar" aria-hidden="true">
        <i className="strength-comparison__duel-bar-player" style={{ width: `${playerShare}%` }} />
        <i className="strength-comparison__duel-bar-enemy" style={{ width: `${enemyShare}%` }} />
        <b style={{ left: `${playerShare}%` }} />
      </div>
      <div className="strength-comparison__verdict">
        <span>{balanceLabel}</span>
        <span>競合の手数：{enemyPace}</span>
      </div>
      {summaryOnly && (nonCashAssumptions.length > 0 || result.playerPushBonus > 0) && (
        <div className="strength-comparison__assumptions">
          {nonCashAssumptions.length > 0 && <span>前提：{supportLabel}</span>}
          {result.playerPushBonus > 0 && (
            <span>商戦補正・押込 +{Math.round(result.playerPushBonus * 100)}%</span>
          )}
        </div>
      )}
      {!summaryOnly && (
        <>
          <div className="strength-comparison__meta">
            <span>判定用戦力比 {Math.floor(result.assessmentRatio * 100)}%</span>
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
                {result.supportRoute === '支援元一巡' ? '勝利後の一巡離脱' : '勝利後の離脱'}{' '}
                {Math.round(result.cumulativeSupportFailureProbability * 100)}%
              </span>
            )}
          </div>
          {result.mechanicCheckRequired && result.mechanicWarning && (
            <div className="strength-comparison__meta strength-comparison__meta--critical">
              <span className="strength-comparison__risk">
                <ShieldAlert />{result.mechanicWarning}
              </span>
            </div>
          )}
          <div className="strength-comparison__components" aria-label="戦力換算の内訳">
            <small>戦力換算内訳</small>
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
        </>
      )}
      {summaryOnly && (!result.directInvestmentAvailable || result.supportVolatile) && (
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
        </div>
      )}
      {result.sequentialSupportGradeCapped && (
        <div className="strength-comparison__meta strength-comparison__meta--critical">
          <span className="strength-comparison__risk">
            <ShieldAlert />支援中に競合が約{result.expectedEnemyResponsesDuringSupport.toFixed(1)}回動くため、判定は接戦
          </span>
        </div>
      )}
      {!compact && (
        <>
          <p>{isTraining ? trainingPresentation.advice : result.advice}</p>
          <small className="strength-comparison__note">
            {isTraining
              ? '追加行動なしの固定耐久です。訓練中の出資・離反・LB増減は保存されません。'
              : `現金＋最良の支援（${result.supportRoute}）＋1争奪戦につき1回の協力・資金アビリティ・選択中の手動SYNERGYを戦力換算。風と通常の押し込み速度は等級に含みません。`}
          </small>
        </>
      )}
    </section>
  );
};

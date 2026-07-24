import React from 'react';

export interface MarketCandle {
  id: number;
  open: number;
  close: number;
  high: number;
  low: number;
  cause: string;
  shock: boolean;
}

interface BattleMarketChartProps {
  candles: MarketCandle[];
  latestEvent: string;
  gaugeSpeed: number;
  playerForce: number;
  enemyForce: number;
  trendLabel: string;
}

export const BattleMarketChart: React.FC<BattleMarketChartProps> = ({
  candles,
  latestEvent,
  gaugeSpeed,
  playerForce,
  enemyForce,
  trendLabel,
}) => {
  const values = candles.flatMap((candle) => [candle.high, candle.low]);
  const min = Math.min(...values, 95);
  const max = Math.max(...values, 105);
  const range = Math.max(1, max - min);
  const latest = candles[candles.length - 1];
  const first = candles[0];
  const sessionChange = latest && first ? latest.close - first.open : 0;

  return (
    <section className="market-chart" aria-label="買収気配指数のリアルタイムチャート">
      <div className="market-chart__header">
        <div>
          <span className="market-chart__eyebrow">LIVE / BUYOUT INDEX</span>
          <strong>{latest?.close.toFixed(1) ?? '100.0'}</strong>
          <span className={sessionChange >= 0 ? 'chart-up' : 'chart-down'}>
            {sessionChange >= 0 ? '+' : ''}{sessionChange.toFixed(1)}
          </span>
        </div>
        <span className="market-chart__trend">{trendLabel}</span>
      </div>

      <div className="market-chart__plot">
        <div className="market-chart__grid" />
        {candles.map((candle) => {
          const rising = candle.close >= candle.open;
          const bodyTop = ((max - Math.max(candle.open, candle.close)) / range) * 100;
          const bodyHeight = Math.max(5, (Math.abs(candle.close - candle.open) / range) * 100);
          const wickTop = ((max - candle.high) / range) * 100;
          const wickHeight = Math.max(4, ((candle.high - candle.low) / range) * 100);
          return (
            <div
              key={candle.id}
              className={`market-candle ${rising ? 'market-candle--up' : 'market-candle--down'} ${candle.shock ? 'market-candle--shock' : ''}`}
              title={`${candle.cause} / ${candle.open.toFixed(1)} → ${candle.close.toFixed(1)}`}
            >
              <i style={{ top: `${wickTop}%`, height: `${wickHeight}%` }} />
              <b style={{ top: `${bodyTop}%`, height: `${bodyHeight}%` }} />
            </div>
          );
        })}
      </div>

      <div className="market-chart__event">
        <span className="market-chart__pulse" />
        <span>{latestEvent}</span>
      </div>

      <div className="market-chart__forces">
        <span>自社圧力 <strong>{playerForce.toFixed(1)}</strong></span>
        <span className={gaugeSpeed <= 0 ? 'chart-up' : 'chart-down'}>
          {gaugeSpeed <= 0 ? `右へ +${Math.abs(gaugeSpeed * 3.5).toFixed(2)}/秒` : `左へ -${Math.abs(gaugeSpeed * 3.5).toFixed(2)}/秒`}
        </span>
        <span>敵圧力 <strong>{enemyForce.toFixed(1)}</strong></span>
      </div>
    </section>
  );
};

import React from 'react';
import { Crown, Sparkles, Swords, Trophy } from 'lucide-react';
import { FANKIT_ART } from '../data/fankitAssets';

interface EndingModalProps {
  ending: 'normal' | 'true';
  companyName: string;
  onContinue: () => void;
}

export const EndingModal: React.FC<EndingModalProps> = ({
  ending,
  companyName,
  onContinue,
}) => {
  const trueEnding = ending === 'true';
  return (
    <div className={`ending-modal ending-modal--${ending}`} role="dialog" aria-modal="true" aria-labelledby="ending-title">
      <img
        src={trueEnding ? FANKIT_ART.battleBackdrop : FANKIT_ART.marketBackdrop}
        alt=""
        aria-hidden="true"
        className="ending-modal__backdrop"
      />
      <div className="ending-modal__shade" />
      <article className="ending-card">
        <header className="ending-card__header">
          {trueEnding ? <Crown /> : <Trophy />}
          <span>{trueEnding ? 'TRUE ENDING' : 'GRAND MARKET COMPLETE'}</span>
          {trueEnding ? <Crown /> : <Trophy />}
        </header>

        <div className={`ending-party-art ending-party-art--${ending}`} aria-label="ファンキットのジョブアートとタタルが全制覇を祝う集合ビジュアル">
          <div className="ending-party-art__jobs" aria-hidden="true">
            {FANKIT_ART.jobs.map((src, index) => (
              <img key={src} src={src} alt="" style={{ '--party-offset': `${Math.abs(index - 5.5) * 2}px` } as React.CSSProperties} />
            ))}
          </div>
          <div className="ending-party-art__tataru-glow" />
          <img
            src={trueEnding ? FANKIT_ART.tataru.dressUp : FANKIT_ART.tataru.windUp}
            alt="タタル"
            className="ending-party-art__tataru"
          />
          <Sparkles className="ending-party-art__sparkle ending-party-art__sparkle--left" />
          <Sparkles className="ending-party-art__sparkle ending-party-art__sparkle--right" />
        </div>

        <div className="ending-card__copy">
          <small>{trueEnding ? 'ALL SAVAGE TRADE RAIDS CLEARED' : 'TEN CITIES UNITED BY TRADE'}</small>
          <h1 id="ending-title">
            {trueEnding ? '真・全商戦制覇！' : 'エオルゼア交易網 全制覇！'}
          </h1>
          <p>
            {trueEnding
              ? `${companyName}は、全都市の商戦 零式を踏破しました。仲間と積み上げた一手一手こそ、どんな大口資本にも負けない最大の財産でっす！`
              : `${companyName}の航路が十都市を結びました。けれど、完成した交易網には腕利きだけが挑める高難度の取引記録が残っているようでっす。`}
          </p>
        </div>

        {!trueEnding && (
          <section className="ending-card__unlock">
            <Swords />
            <span><b>「商戦 零式」タブ解放</b>通常制覇時の仲間・スキル・LBを持ち込み、各都市1～4層へ挑戦できます。</span>
          </section>
        )}

        <button type="button" onClick={onContinue} className="ending-card__continue">
          {trueEnding ? 'みんなと祝って、商いをつづける' : '商戦 零式へ進む'}
        </button>
        <footer>FFXIV公式ファンキット素材使用 © SQUARE ENIX</footer>
      </article>
    </div>
  );
};

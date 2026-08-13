import React, { useEffect, useRef } from 'react';
import { Crown, Sparkles, Swords, Trophy } from 'lucide-react';
import { FANKIT_ART } from '../data/fankitAssets';

interface EndingModalProps {
  ending: 'normal' | 'savage' | 'true';
  companyName: string;
  onContinue: () => void;
}

export const EndingModal: React.FC<EndingModalProps> = ({
  ending,
  companyName,
  onContinue,
}) => {
  const trueEnding = ending === 'true';
  const savageEnding = ending === 'savage';
  const finalRoute = savageEnding || trueEnding;
  const modalRef = useRef<HTMLDivElement | null>(null);
  const continueButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(
      () => continueButtonRef.current?.focus(),
      0
    );
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) {
        event.preventDefault();
        modalRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', trapFocus);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
    <div
      ref={modalRef}
      className={`ending-modal ending-modal--${ending}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ending-title"
      tabIndex={-1}
    >
      <img
        src={finalRoute ? FANKIT_ART.battleBackdrop : FANKIT_ART.marketBackdrop}
        alt=""
        aria-hidden="true"
        decoding="async"
        className="ending-modal__backdrop"
      />
      <div className="ending-modal__shade" />
      <article className="ending-card">
        <header className="ending-card__header">
          {trueEnding ? <Crown /> : savageEnding ? <Swords /> : <Trophy />}
          <span>{trueEnding ? 'ULTIMATE COMPLETE' : savageEnding ? 'SAVAGE TIER COMPLETE' : 'GRAND MARKET COMPLETE'}</span>
          {trueEnding ? <Crown /> : savageEnding ? <Swords /> : <Trophy />}
        </header>

        <div className={`ending-party-art ending-party-art--${ending}`} aria-label="ファンキットのジョブアートとタタルが全制覇を祝う集合ビジュアル">
          <div className="ending-party-art__jobs" aria-hidden="true">
            {FANKIT_ART.jobs.map((src, index) => (
              <img key={src} src={src} alt="" style={{ '--party-offset': `${Math.abs(index - 5.5) * 2}px` } as React.CSSProperties} />
            ))}
          </div>
          <div className="ending-party-art__tataru-glow" />
          <img
            src={finalRoute ? FANKIT_ART.tataru.dressUp : FANKIT_ART.tataru.windUp}
            alt="タタル"
            className="ending-party-art__tataru"
          />
          <Sparkles className="ending-party-art__sparkle ending-party-art__sparkle--left" />
          <Sparkles className="ending-party-art__sparkle ending-party-art__sparkle--right" />
        </div>

        <div className="ending-card__copy">
          <small>{trueEnding ? 'ULTIMATE TRADE DUTY CLEARED' : savageEnding ? 'TWELVE SAVAGE CHAPTERS CLEARED' : 'TEN CITIES UNITED BY TRADE'}</small>
          <h1 id="ending-title">
            {trueEnding ? '真・全商戦制覇！' : savageEnding ? '商戦 零式3編・全12章 踏破！' : '十都市人脈 全開通！'}
          </h1>
          <p>
            {trueEnding
              ? `${companyName}は、単独の最終高難度「絶商戦」を踏破しました。仲間と積み上げた一手一手こそ、どんな大口資本にも負けない最大の財産でっす！`
              : savageEnding
                ? `${companyName}は、3編・全12章の商戦 零式をすべて踏破したでっす！ 仲間と読み切った攻防を、次の大商戦へつなげるでっす。`
                : `${companyName}の交易路が十都市を結びました。けれど、完成した交易網には腕利きだけが挑める高難度の取引記録が残っているようでっす。`}
          </p>
        </div>

        {!trueEnding && (
          <section className="ending-card__unlock">
            <Swords />
            <span>
              <b>{savageEnding ? '「絶商戦」挑戦資格 解放' : '「商戦 零式」タブ解放'}</b>
              {savageEnding
                ? '3編・全12章踏破で解放された、別枠の単独最終高難度交易戦へ挑戦できます。'
                : '通常編で結んだ人脈・アビリティ・LBを持ち込み、本作独自の3編×1～4層へ挑戦できます。'}
            </span>
          </section>
        )}

        <button ref={continueButtonRef} type="button" onClick={onContinue} className="ending-card__continue">
          {trueEnding ? 'みんなと祝って、商いをつづける' : savageEnding ? '絶商戦を確認する' : '商戦 零式へ進む'}
        </button>
        <footer>FFXIV公式ファンキット素材使用 © SQUARE ENIX</footer>
      </article>
    </div>
  );
};

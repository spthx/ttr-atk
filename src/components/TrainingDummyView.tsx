import React, { useEffect, useRef } from 'react';
import {
  Building2,
  Lock,
  RotateCcw,
  ShieldCheck,
  Swords,
  X,
} from 'lucide-react';
import type { Property } from '../types';
import { FANKIT_ART } from '../data/fankitAssets';
import type { BattleReadinessResult } from '../utils/battleReadiness';
import { formatCurrency } from '../utils/formatter';
import {
  buildTrainingDummyProperty,
  isTrainingDummyUnlocked,
  TRAINING_DUMMY_DEFINITIONS,
} from '../utils/trainingDummy';
import { StrengthComparison } from './StrengthComparison';

export interface TrainingDummyViewProps {
  conqueredCommunityCount: number;
  totalFunds: number;
  getStrengthComparison: (property: Property) => BattleReadinessResult;
  onStart: (property: Property) => void;
  onClose: () => void;
}

export const TrainingDummyView: React.FC<TrainingDummyViewProps> = ({
  conqueredCommunityCount,
  totalFunds,
  getStrengthComparison,
  onStart,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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
      () => closeButtonRef.current?.focus(),
      0
    );
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
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

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[175] overflow-y-auto bg-slate-950/92 p-3 backdrop-blur-sm sm:p-6"
      style={{
        paddingTop: 'max(.75rem, var(--game-safe-top))',
        paddingRight: 'max(.75rem, var(--game-safe-right))',
        paddingBottom: 'max(.75rem, var(--game-safe-bottom))',
        paddingLeft: 'max(.75rem, var(--game-safe-left))',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-dummy-title"
        aria-describedby="training-dummy-description"
        tabIndex={-1}
        className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-cyan-300/45 bg-slate-900 shadow-2xl"
      >
        <header className="relative overflow-hidden border-b border-cyan-400/25 px-4 py-5 sm:px-6">
          <img
            src={FANKIT_ART.battleBackdrop}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-cyan-950/55" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <small className="font-black tracking-[0.28em] text-cyan-300">
                TRAINING DUMMY DUTY
              </small>
              <h2
                id="training-dummy-title"
                className="mt-1 flex items-center gap-2 text-2xl font-black text-white sm:text-3xl"
              >
                <Swords className="h-7 w-7 text-amber-300" />
                商戦木人討滅戦
              </h2>
              <p
                id="training-dummy-description"
                className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-200"
              >
                現在の資金・支援元・装備で、LEVEL別の木人へ何度でも挑戦できます。
                木人は開幕の耐久資本から追加防衛を行いません。
                訓練中も通常の毎秒収益とオフライン収益は商会資金へ加算されます。
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="商戦木人討滅戦を閉じる"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-600 bg-slate-950/80 text-slate-300 transition-colors hover:border-cyan-300 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="space-y-4 p-4 sm:p-6">
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-950/30 p-2.5 sm:p-3">
              <small className="block text-[10px] font-black tracking-widest text-emerald-300">
                ENTRY FEE
              </small>
              <strong className="mt-1 block text-sm text-emerald-100">
                参加費 0 ギル
              </strong>
            </div>
            <div className="rounded-xl border border-cyan-400/30 bg-cyan-950/30 p-2.5 sm:p-3">
              <small className="block text-[10px] font-black tracking-widest text-cyan-300">
                RETRY
              </small>
              <strong className="mt-1 flex items-center gap-1.5 text-sm text-cyan-100">
                <RotateCcw className="h-4 w-4" />
                同じLEVELへ何度でも
              </strong>
            </div>
            <div className="rounded-xl border border-violet-400/30 bg-violet-950/30 p-2.5 sm:p-3">
              <small className="block text-[10px] font-black tracking-widest text-violet-300">
                RULE
              </small>
              <strong className="mt-1 flex items-center gap-1.5 text-sm text-violet-100">
                <ShieldCheck className="h-4 w-4" />
                追加防衛なし
              </strong>
            </div>
            <div className="rounded-xl border border-amber-400/30 bg-amber-950/30 p-2.5 sm:p-3">
              <small className="block text-[10px] font-black tracking-widest text-amber-300">
                CURRENT FUNDS
              </small>
              <strong className="mt-1 flex items-center gap-1.5 text-sm text-amber-100">
                <Building2 className="h-4 w-4" />
                {formatCurrency(totalFunds)}
              </strong>
            </div>
          </section>

          <p className="rounded-xl border border-rose-400/25 bg-rose-950/25 px-4 py-3 text-xs font-bold leading-relaxed text-rose-100">
            訓練中の勝敗・出資・離反・LIMIT BREAKの増減はセーブデータへ反映されません。
            通常商戦、商戦 零式、絶商戦の進行や決算にも影響しません。
          </p>

          <section
            className="grid gap-3 lg:grid-cols-2"
            aria-label="商戦木人のLEVEL選択"
          >
            {TRAINING_DUMMY_DEFINITIONS.map((definition) => {
              const property = buildTrainingDummyProperty(definition);
              const unlocked = isTrainingDummyUnlocked(
                definition,
                conqueredCommunityCount
              );
              const remainingCommunities = Math.max(
                0,
                definition.requiredConqueredCommunityCount -
                  conqueredCommunityCount
              );
              const strengthComparison = getStrengthComparison(property);

              return (
                <article
                  key={definition.id}
                  className={`rounded-2xl border p-4 ${
                    unlocked
                      ? 'border-cyan-400/35 bg-slate-950/75'
                      : 'border-slate-700 bg-slate-950/45'
                  }`}
                >
                  <header className="flex items-start justify-between gap-3">
                    <div>
                      <small className="font-black tracking-[0.2em] text-cyan-300">
                        木人 LEVEL {definition.level}
                      </small>
                      <h3 className="mt-1 text-xl font-black text-white">
                        {definition.name}
                      </h3>
                    </div>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-black ${
                        unlocked
                          ? 'bg-emerald-400/15 text-emerald-200'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {unlocked ? (
                        '挑戦可能'
                      ) : (
                        <span className="flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          未解放
                        </span>
                      )}
                    </span>
                  </header>

                  <dl className="my-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-900 p-2.5">
                      <dt className="text-slate-500">木人耐久資本</dt>
                      <dd className="mt-0.5 font-black text-amber-300">
                        {formatCurrency(definition.marketPrice)}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-900 p-2.5">
                      <dt className="text-slate-500">解放条件</dt>
                      <dd className="mt-0.5 font-black text-slate-200">
                        {definition.requiredConqueredCommunityCount === 0
                          ? '最初から解放'
                          : `都市制覇 ${definition.requiredConqueredCommunityCount}`}
                      </dd>
                    </div>
                  </dl>

                  <p className="mb-3 min-h-10 text-xs leading-relaxed text-slate-400">
                    {definition.description}
                  </p>

                  <button
                    type="button"
                    disabled={!unlocked}
                    onClick={() => onStart(property)}
                    className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-colors ${
                      unlocked
                        ? 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
                        : 'cursor-not-allowed border border-slate-700 bg-slate-800 text-slate-500'
                    }`}
                  >
                    {unlocked ? (
                      <>
                        <Swords className="h-4 w-4" />
                        LEVEL {definition.level}へ挑戦
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4" />
                        あと{remainingCommunities}都市制覇で解放
                      </>
                    )}
                  </button>

                  <div className="mt-3">
                    <StrengthComparison result={strengthComparison} compact isTraining />
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
};

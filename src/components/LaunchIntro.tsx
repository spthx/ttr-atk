import React, { useState } from 'react';
import { ArrowRight, Building2, Coins, MapPinned, PencilLine, ShieldCheck } from 'lucide-react';
import { FANKIT_ART } from '../data/fankitAssets';
import { soundFx } from '../utils/audio';

interface LaunchIntroProps {
  companyName: string;
  onCompanyNameChange: (name: string) => void;
  onComplete: () => void;
}

const INTRO_STEPS = [
  {
    eyebrow: 'FANTASY TRADE CAMPAIGN',
    title: 'タタルの大繁盛店',
    body: 'ギルを積み、風を読み、各都市の企業を買収。エオルゼアから新大陸まで交易路を広げます。',
    icon: MapPinned,
  },
  {
    eyebrow: 'MONEY BUYOUT BATTLE',
    title: 'ギルを積み、魂を奪え。',
    body: '自社と傘下企業のギルを積み、競合の防衛資金と所有率を押し切れば買収成立です。',
    icon: Coins,
  },
  {
    eyebrow: 'FOUND YOUR COMPANY',
    title: 'カンパニーを旗揚げする',
    body: 'この名前が保有物件、買収結果、都市制覇の記録に表示されます。',
    icon: Building2,
  },
] as const;

export const LaunchIntro: React.FC<LaunchIntroProps> = ({
  companyName,
  onCompanyNameChange,
  onComplete,
}) => {
  const [step, setStep] = useState(0);
  const current = INTRO_STEPS[step];
  const StepIcon = current.icon;

  const next = () => {
    soundFx.playCoin();
    if (step < INTRO_STEPS.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    onCompanyNameChange(companyName.trim() || 'タタルの大繁盛商店');
    onComplete();
  };

  return (
    <div className="launch-intro fixed inset-0 z-[200] overflow-y-auto overscroll-contain bg-slate-950 text-white">
      <img
        src={step === 0 ? FANKIT_ART.titleHero : step === 2 ? FANKIT_ART.launchWallpaperMobile : FANKIT_ART.battleBackdrop}
        alt=""
        aria-hidden="true"
        className={`fixed inset-0 h-[100dvh] w-full object-cover ${step === 2 ? 'object-[62%_center]' : 'object-center'}`}
      />
      <div className="fixed inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/35" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(251,191,36,.18),transparent_40%)]" />
      <div className="launch-intro__content relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl flex-col justify-between px-5 py-5 sm:px-10 sm:py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-black tracking-[.28em] text-amber-300">
            <ShieldCheck className="h-4 w-4" /> タタルの大繁盛店
          </div>
          <span className="text-[9px] text-slate-400">UNOFFICIAL FAN GAME</span>
        </header>

        <main key={step} className="launch-intro__panel max-w-2xl">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-500/15 text-amber-300 shadow-[0_0_30px_rgba(251,191,36,.2)]">
            <StepIcon className="h-6 w-6" />
          </div>
          <p className="text-[10px] font-black tracking-[.3em] text-cyan-300">{current.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-white drop-shadow-2xl sm:text-5xl">{current.title}</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-200 sm:text-base">{current.body}</p>

          {step === 2 && (
            <label className="launch-intro__name-field mt-5 block max-w-lg">
              <span className="mb-2 flex items-center gap-1.5 text-xs font-black text-amber-200">
                <PencilLine className="h-4 w-4" /> カンパニー名
              </span>
              <input
                value={companyName}
                onChange={(event) => onCompanyNameChange(event.target.value.slice(0, 24))}
                onFocus={(event) => {
                  const input = event.currentTarget;
                  window.setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 180);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') next();
                }}
                className="w-full rounded-xl border border-amber-400/50 bg-slate-950/85 px-4 py-3 text-lg font-black text-amber-100 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-400/20"
                placeholder="タタルの大繁盛商店"
                inputMode="text"
                enterKeyHint="done"
                autoFocus
              />
              <span className="mt-1 block text-right text-[9px] text-slate-500">{companyName.length}/24</span>
            </label>
          )}
        </main>

        <footer className="flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex gap-1.5">
              {INTRO_STEPS.map((_, index) => (
                <span key={index} className={`h-1 rounded-full transition-all ${index === step ? 'w-10 bg-amber-300' : 'w-5 bg-slate-700'}`} />
              ))}
            </div>
            <p className="launch-intro__copyright text-[8px] text-slate-400"><a href="https://jp.finalfantasyxiv.com/lodestone/special/fankit/" target="_blank" rel="noreferrer">FFXIVファンキット</a>使用の非公式ファンサイト<br /><span>© SQUARE ENIX</span></p>
          </div>
          <button
            type="button"
            onClick={next}
            className="flex items-center gap-2 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-3 text-xs font-black text-slate-950 shadow-[0_0_25px_rgba(251,191,36,.28)] transition active:scale-95"
          >
            {step === INTRO_STEPS.length - 1 ? 'この名で開店する' : '次へ'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </footer>
      </div>
    </div>
  );
};

import { FANKIT_AUDIO } from '../data/fankitAssets';

/**
 * Retro-Modern Web Audio API Synthesizer
 * Generates arcade-style sound effects for the financial simulation game.
 */

class SoundEffects {
  private ctx: AudioContext | null = null;
  private mediaCache = new Map<string, HTMLAudioElement>();
  public enabled: boolean = true;

  private playFankitAudio(url: string, volume: number, fallback: () => void) {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return false;
    try {
      let audio = this.mediaCache.get(url);
      if (!audio) {
        audio = new Audio(url);
        audio.preload = 'auto';
        this.mediaCache.set(url, audio);
      }
      audio.pause();
      audio.currentTime = 0;
      audio.volume = volume;
      const playback = audio.play();
      playback?.catch(fallback);
      return true;
    } catch {
      return false;
    }
  }

  private initCtx() {
    try {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      // Ignore audio context errors gracefully
    }
  }

  // Coin / Investment Chime
  playCoin() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.08); // E6

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Audio fallback
    }
  }

  // Short two-tone cue used only when the shared command gauge becomes ready.
  playCommandReady() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      [659.25, 987.77].forEach((frequency, index) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + index * 0.065;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.11, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.15);
      });
    } catch {
      // Audio fallback
    }
  }

  // Massive Cash / Demand Investment Sound
  playBigCash() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.04);

        gain.gain.setValueAtTime(0.2, now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + i * 0.04);
        osc.stop(now + i * 0.04 + 0.25);
      });
    } catch {
      // Audio fallback
    }
  }

  // Gauge Shift Tick
  playGaugeTick(pitch: number = 1.0) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(220 * pitch, now);

      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch {
      // Audio fallback
    }
  }

  // Tactical Skill Spark (Flash / Chime)
  playSkillSpark() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.3);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // Audio fallback
    }
  }

  // Layered coin-and-capital impact for the tug-of-war arena.
  playCapitalImpact(side: 'player' | 'opponent', intensity: number = 0.5) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const power = Math.max(0.25, Math.min(1, intensity));
      const panValue = side === 'player' ? -0.55 : 0.55;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.42 * power, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.setValueAtTime(panValue, now);
        master.connect(panner);
        panner.connect(ctx.destination);
      } else {
        master.connect(ctx.destination);
      }

      const thud = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(side === 'player' ? 128 : 112, now);
      thud.frequency.exponentialRampToValueAtTime(42, now + 0.22);
      thudGain.gain.setValueAtTime(0.8, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      thud.connect(thudGain);
      thudGain.connect(master);
      thud.start(now);
      thud.stop(now + 0.25);

      [620, 910, 1370].forEach((frequency, index) => {
        const coin = ctx.createOscillator();
        const coinGain = ctx.createGain();
        coin.type = index === 1 ? 'square' : 'triangle';
        coin.frequency.setValueAtTime(frequency * (side === 'player' ? 1.05 : 0.92), now + index * 0.018);
        coinGain.gain.setValueAtTime(0.18 / (index + 1), now + index * 0.018);
        coinGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12 + index * 0.025);
        coin.connect(coinGain);
        coinGain.connect(master);
        coin.start(now + index * 0.018);
        coin.stop(now + 0.16 + index * 0.025);
      });
    } catch {
      // Audio fallback
    }
  }

  playMarketShock(direction: 'rise' | 'drop', intensity: number = 0.5) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();
      const power = Math.max(0.25, Math.min(1, intensity));
      osc.type = direction === 'rise' ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(direction === 'rise' ? 260 : 680, now);
      osc.frequency.exponentialRampToValueAtTime(direction === 'rise' ? 1040 : 92, now + 0.28);
      gain.gain.setValueAtTime(0.16 * power, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.33);
    } catch {
      // Audio fallback
    }
  }
  // Official fan-kit sound first; the synth remains a resilient autoplay/file fallback.
  playDutyStart() {
    if (!this.enabled) return;
    if (!this.playFankitAudio(FANKIT_AUDIO.dutyStart, 0.62, () => this.playDutyStartSynth())) {
      this.playDutyStartSynth();
    }
  }

  playFeatureUnlocked() {
    if (!this.enabled) return;
    if (!this.playFankitAudio(FANKIT_AUDIO.featureUnlocked, 0.58, () => this.playSkillSpark())) {
      this.playSkillSpark();
    }
  }

  playLimitBreak() {
    if (!this.enabled) return;
    if (!this.playFankitAudio(FANKIT_AUDIO.limitBreak, 0.7, () => this.playFinalPush())) {
      this.playFinalPush();
    }
  }

  private playDutyStartSynth() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      [164.81, 246.94, 329.63, 493.88].forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = index < 2 ? 'square' : 'triangle';
        osc.frequency.setValueAtTime(frequency, now + index * 0.055);
        osc.frequency.exponentialRampToValueAtTime(frequency * 1.22, now + 0.3 + index * 0.04);
        gain.gain.setValueAtTime(0.001, now + index * 0.055);
        gain.gain.linearRampToValueAtTime(index < 2 ? 0.1 : 0.075, now + 0.035 + index * 0.055);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42 + index * 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + index * 0.055);
        osc.stop(now + 0.46 + index * 0.05);
      });
    } catch {
      // Audio fallback
    }
  }

  // Heavy last-hit cue for the brief decisive slowdown.
  playDecisiveBlow(side: 'player' | 'opponent') {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.34, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
      master.connect(ctx.destination);

      const impact = ctx.createOscillator();
      const impactGain = ctx.createGain();
      impact.type = side === 'player' ? 'triangle' : 'sawtooth';
      impact.frequency.setValueAtTime(side === 'player' ? 148 : 118, now);
      impact.frequency.exponentialRampToValueAtTime(34, now + 0.42);
      impactGain.gain.setValueAtTime(0.95, now);
      impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      impact.connect(impactGain);
      impactGain.connect(master);
      impact.start(now);
      impact.stop(now + 0.5);

      [440, 660, 990].forEach((frequency, index) => {
        const flash = ctx.createOscillator();
        const flashGain = ctx.createGain();
        flash.type = 'square';
        flash.frequency.setValueAtTime(frequency * (side === 'player' ? 1 : 0.72), now + index * 0.018);
        flashGain.gain.setValueAtTime(0.13 / (index + 1), now + index * 0.018);
        flashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09 + index * 0.025);
        flash.connect(flashGain);
        flashGain.connect(master);
        flash.start(now + index * 0.018);
        flash.stop(now + 0.12 + index * 0.025);
      });
    } catch {
      // Audio fallback
    }
  }

  // Rising, original fantasy-game cue played while the final capital push is visible.
  playFinalPush() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      [196, 246.94, 293.66, 392].forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = index % 2 === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(frequency, now + index * 0.08);
        osc.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + 0.62);
        gain.gain.setValueAtTime(0.001, now + index * 0.08);
        gain.gain.linearRampToValueAtTime(0.11, now + 0.25 + index * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + index * 0.08);
        osc.stop(now + 0.74);
      });
      this.playCapitalImpact('player', 1);
    } catch {
      // Audio fallback
    }
  }
  playVictory() {
    if (!this.enabled) return;
    if (!this.playFankitAudio(FANKIT_AUDIO.victory, 0.64, () => this.playVictorySynth())) {
      this.playVictorySynth();
    }
  }

  // Original high-fantasy fallback fanfare (not based on an existing game melody).
  private playVictorySynth() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const melody = [392, 493.88, 587.33, 783.99, 659.25, 783.99, 987.77];
      const starts = [0, 0.12, 0.24, 0.38, 0.58, 0.72, 0.9];

      melody.forEach((frequency, index) => {
        ['sawtooth', 'triangle'].forEach((wave, voice) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = wave as OscillatorType;
          osc.frequency.setValueAtTime(frequency * (voice === 0 ? 1 : 2), now + starts[index]);
          const duration = index === melody.length - 1 ? 1.25 : 0.22;
          gain.gain.setValueAtTime(0.001, now + starts[index]);
          gain.gain.linearRampToValueAtTime(voice === 0 ? 0.13 : 0.045, now + starts[index] + 0.025);
          gain.gain.exponentialRampToValueAtTime(0.001, now + starts[index] + duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + starts[index]);
          osc.stop(now + starts[index] + duration);
        });
      });

      [392, 493.88, 587.33, 783.99].forEach((frequency) => {
        const choir = ctx.createOscillator();
        const choirGain = ctx.createGain();
        choir.type = 'sine';
        choir.frequency.setValueAtTime(frequency, now + 0.9);
        choirGain.gain.setValueAtTime(0.001, now + 0.9);
        choirGain.gain.linearRampToValueAtTime(0.08, now + 1.05);
        choirGain.gain.exponentialRampToValueAtTime(0.001, now + 2.25);
        choir.connect(choirGain);
        choirGain.connect(ctx.destination);
        choir.start(now + 0.9);
        choir.stop(now + 2.3);
      });
    } catch {
      // Audio fallback
    }
  }

  playDefeat() {
    if (!this.enabled) return;
    if (!this.playFankitAudio(FANKIT_AUDIO.defeat, 0.64, () => this.playDefeatSynth())) {
      this.playDefeatSynth();
    }
  }

  // Defeat / loss fallback synth.
  private playDefeatSynth() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const notes = [400, 350, 300, 220];

      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.2, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.2);
      });
    } catch {
      // Audio fallback
    }
  }

  // Warning / Rebellion Alert
  playWarning() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(440, now + 0.1);
      osc.frequency.setValueAtTime(880, now + 0.2);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // Audio fallback
    }
  }
}

export const soundFx = new SoundEffects();

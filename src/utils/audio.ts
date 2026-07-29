import { FANKIT_AUDIO } from '../data/fankitAssets';

/**
 * Retro-Modern Web Audio API Synthesizer
 * Generates arcade-style sound effects for the financial simulation game.
 */

class SoundEffects {
  private ctx: AudioContext | null = null;
  private bufferCache = new Map<string, Promise<AudioBuffer>>();
  private cinematicAudioGeneration = 0;
  private cinematicSource: AudioBufferSourceNode | null = null;
  private cinematicGain: GainNode | null = null;
  private limitImpactTimer: number | null = null;
  public enabled: boolean = true;

  private stopCinematicAudio(fadeMs = 0) {
    this.cinematicAudioGeneration += 1;
    const source = this.cinematicSource;
    const gain = this.cinematicGain;
    this.cinematicSource = null;
    this.cinematicGain = null;
    if (!source) return;

    try {
      const ctx = this.ctx;
      if (ctx && gain && fadeMs > 0) {
        const now = ctx.currentTime;
        const fadeSeconds = fadeMs / 1000;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
        gain.gain.linearRampToValueAtTime(0.0001, now + fadeSeconds);
        source.stop(now + fadeSeconds + 0.02);
      } else {
        source.stop();
      }
    } catch {
      // A source that has already ended needs no further cleanup.
    }
  }

  stopBattleCinematicAudio(fadeMs = 160) {
    if (this.limitImpactTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.limitImpactTimer);
      this.limitImpactTimer = null;
    }
    this.stopCinematicAudio(fadeMs);
  }

  /**
   * Resume Web Audio synchronously inside a real pointer/key gesture.
   * iOS may move a context to its non-standard `interrupted` state after an
   * app switch; recreate it instead of scheduling silent oscillators.
   */
  unlock() {
    if (!this.enabled || typeof window === 'undefined') return;
    const state = this.ctx?.state as string | undefined;
    if (state === 'closed' || state === 'interrupted') {
      this.stopCinematicAudio();
      this.ctx = null;
      this.bufferCache.clear();
    }
    const ctx = this.initCtx();
    if (ctx?.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
  }

  private playFankitAudio(
    url: string,
    volume: number,
    fallback: () => void,
    channel: 'effect' | 'cinematic' = 'effect'
  ) {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;
    try {
      const ctx = this.initCtx();
      if (!ctx) return false;
      if (channel === 'cinematic') this.stopCinematicAudio(80);
      const generation = this.cinematicAudioGeneration;
      let pendingBuffer = this.bufferCache.get(url);
      if (!pendingBuffer) {
        pendingBuffer = fetch(url)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`audio fetch failed: ${response.status}`);
            }
            return response.arrayBuffer();
          })
          .then((data) => ctx.decodeAudioData(data.slice(0)));
        this.bufferCache.set(url, pendingBuffer);
      }
      void pendingBuffer
        .then(async (buffer) => {
          if (
            !this.enabled ||
            (channel === 'cinematic' && generation !== this.cinematicAudioGeneration)
          ) {
            return;
          }
          if (ctx.state === 'suspended') await ctx.resume();
          if (
            !this.enabled ||
            (channel === 'cinematic' && generation !== this.cinematicAudioGeneration)
          ) {
            return;
          }
          const source = ctx.createBufferSource();
          const gain = ctx.createGain();
          source.buffer = buffer;
          gain.gain.setValueAtTime(volume, ctx.currentTime);
          source.connect(gain);
          gain.connect(ctx.destination);
          if (channel === 'cinematic') {
            this.cinematicSource = source;
            this.cinematicGain = gain;
            source.onended = () => {
              if (this.cinematicSource === source) {
                this.cinematicSource = null;
                this.cinematicGain = null;
              }
            };
          }
          source.start();
        })
        .catch(() => {
          this.bufferCache.delete(url);
          if (
            channel !== 'cinematic' ||
            generation === this.cinematicAudioGeneration
          ) {
            fallback();
          }
        });
      return true;
    } catch {
      return false;
    }
  }

  private initCtx(): AudioContext | null {
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
    return this.ctx;
  }

  // Coin / Investment Chime
  playCoin() {
    if (!this.enabled) return;
    let osc: OscillatorNode | null = null;
    let gain: GainNode | null = null;
    const disconnect = () => {
      try {
        osc?.disconnect();
        gain?.disconnect();
      } catch {
        // An interrupted iOS audio context may already be disconnected.
      }
    };
    try {
      this.initCtx();
      if (!this.ctx) return;

      osc = this.ctx.createOscillator();
      gain = this.ctx.createGain();

      osc.type = 'sine';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.08); // E6

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.onended = disconnect;

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      disconnect();
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

  // Low rhythmic pressure cue while capital is actively pushing the front.
  playBattlePulse(side: 'player' | 'opponent', intensity: number = 0.5) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const power = Math.max(0.2, Math.min(1, intensity));
      const panValue = side === 'player' ? -0.42 : 0.42;
      const gain = ctx.createGain();
      const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
      gain.gain.setValueAtTime(0.045 * power, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      if (panner) {
        panner.pan.setValueAtTime(panValue, now);
        gain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        gain.connect(ctx.destination);
      }

      const throb = ctx.createOscillator();
      throb.type = 'triangle';
      throb.frequency.setValueAtTime(side === 'player' ? 132 : 112, now);
      throb.frequency.exponentialRampToValueAtTime(side === 'player' ? 82 : 68, now + 0.16);
      throb.connect(gain);
      throb.start(now);
      throb.stop(now + 0.19);

      const coin = ctx.createOscillator();
      const coinGain = ctx.createGain();
      coin.type = 'square';
      coin.frequency.setValueAtTime(side === 'player' ? 720 : 520, now + 0.025);
      coinGain.gain.setValueAtTime(0.012 * power, now + 0.025);
      coinGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      coin.connect(coinGain);
      coinGain.connect(gain);
      coin.start(now + 0.025);
      coin.stop(now + 0.1);
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

  /**
   * First beat of a tactical action. This is intentionally short: the
   * nameplate gets its own audible "ready" cue before movement begins.
   */
  playSkillCast(effectType: string) {
    if (!this.enabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const hostile =
        effectType === 'INDEPENDENCE_SABOTAGE';
      const wind = effectType === 'ERA_WIND' || effectType === 'COOLDOWN_REDUCTION';
      const notes = hostile
        ? [220, 164.81]
        : wind
          ? [392, 587.33, 880]
          : [329.63, 493.88, 659.25];
      notes.forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + index * 0.045;
        osc.type = hostile ? 'sawtooth' : index === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(frequency, start);
        osc.frequency.exponentialRampToValueAtTime(
          frequency * (hostile ? 0.72 : 1.22),
          start + 0.2
        );
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(wind ? 0.08 : 0.065, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch {
      // Audio fallback
    }
  }

  /**
   * Second beat: a stereo draw/whip that reads as the actor stepping forward.
   * Noise is generated inside the existing WebAudio context so iOS does not
   * have to start a competing media player.
   */
  playSkillWhoosh(effectType: string) {
    if (!this.enabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const duration = effectType === 'ERA_WIND' ? 0.42 : 0.26;
      const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let index = 0; index < frameCount; index += 1) {
        const envelope = Math.sin(Math.PI * index / frameCount);
        channel[index] = (Math.random() * 2 - 1) * envelope;
      }
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const panner = typeof ctx.createStereoPanner === 'function'
        ? ctx.createStereoPanner()
        : null;
      source.buffer = buffer;
      filter.type = effectType === 'COVER' ? 'lowpass' : 'bandpass';
      filter.frequency.setValueAtTime(
        effectType === 'ERA_WIND' ? 1_400 : 2_600,
        now
      );
      filter.frequency.exponentialRampToValueAtTime(
        effectType === 'ERA_WIND' ? 4_800 : 720,
        now + duration
      );
      filter.Q.setValueAtTime(0.7, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(
        effectType === 'ERA_WIND' ? 0.2 : 0.14,
        now + duration * 0.35
      );
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      if (panner) {
        panner.pan.setValueAtTime(-0.65, now);
        panner.pan.linearRampToValueAtTime(0.55, now + duration);
        gain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        gain.connect(ctx.destination);
      }
      source.start(now);
      source.stop(now + duration);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Third beat: one resolved impact. Buffs get a bright seal, hostile actions
   * get a lower cut, and capital actions keep the familiar coin weight.
   */
  playSkillImpact(
    effectType: string,
    side: 'player' | 'opponent' = 'player'
  ) {
    if (!this.enabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const hostile =
        effectType === 'INDEPENDENCE_SABOTAGE';
      const wind = effectType === 'ERA_WIND' || effectType === 'COOLDOWN_REDUCTION';
      const master = ctx.createGain();
      master.gain.setValueAtTime(wind ? 0.2 : 0.24, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      master.connect(ctx.destination);

      [hostile ? 196 : 523.25, hostile ? 98 : wind ? 1046.5 : 783.99]
        .forEach((frequency, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + index * 0.045;
          osc.type = hostile ? 'sawtooth' : index === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(frequency, start);
          osc.frequency.exponentialRampToValueAtTime(
            frequency * (hostile ? 0.44 : 1.34),
            start + 0.3
          );
          gain.gain.setValueAtTime(index === 0 ? 0.75 : 0.42, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.34);
          osc.connect(gain);
          gain.connect(master);
          osc.start(start);
          osc.stop(start + 0.36);
        });

      if (effectType === 'CAPITAL_BOOST') {
        this.playCapitalImpact(side, 0.82);
      }
    } catch {
      // Audio fallback
    }
  }

  /**
   * LB impact is separated from the shared fan-kit charging cue. The same
   * bounded voices become one, two or three cuts so higher tiers sound
   * stronger without loading or decoding another asset.
   */
  playLimitBreakImpact(tier: number = 1) {
    if (!this.enabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const resolvedTier = Math.max(1, Math.min(3, Math.floor(tier)));
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.56 + resolvedTier * 0.055, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
      master.connect(ctx.destination);

      // A short metallic draw makes the following transients read as a blade,
      // rather than another electronic gauge cue.
      const draw = ctx.createOscillator();
      const drawGain = ctx.createGain();
      draw.type = 'triangle';
      draw.frequency.setValueAtTime(340, now);
      draw.frequency.exponentialRampToValueAtTime(2_600, now + 0.105);
      drawGain.gain.setValueAtTime(0.001, now);
      drawGain.gain.linearRampToValueAtTime(0.07, now + 0.025);
      drawGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      draw.connect(drawGain);
      drawGain.connect(master);
      draw.start(now);
      draw.stop(now + 0.15);

      const slashDelays = [0.1, 0.225, 0.36].slice(0, resolvedTier);
      slashDelays.forEach((delay, index) => {
        const start = now + delay;
        const duration = 0.105;
        const noiseBuffer = ctx.createBuffer(
          1,
          Math.ceil(ctx.sampleRate * duration),
          ctx.sampleRate
        );
        const samples = noiseBuffer.getChannelData(0);
        for (let sample = 0; sample < samples.length; sample += 1) {
          const progress = sample / samples.length;
          samples[sample] =
            (Math.random() * 2 - 1) * Math.pow(1 - progress, 2.4);
        }

        const slash = ctx.createBufferSource();
        const slashFilter = ctx.createBiquadFilter();
        const slashGain = ctx.createGain();
        slash.buffer = noiseBuffer;
        slashFilter.type = 'bandpass';
        slashFilter.frequency.setValueAtTime(2_900 - index * 380, start);
        slashFilter.Q.setValueAtTime(0.72, start);
        slashGain.gain.setValueAtTime(0.001, start);
        slashGain.gain.linearRampToValueAtTime(0.22, start + 0.006);
        slashGain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        slash.connect(slashFilter);
        slashFilter.connect(slashGain);
        slashGain.connect(master);
        slash.start(start);

        const blade = ctx.createOscillator();
        const bladeGain = ctx.createGain();
        blade.type = index === 1 ? 'sine' : 'triangle';
        blade.frequency.setValueAtTime(3_200 - index * 420, start);
        blade.frequency.exponentialRampToValueAtTime(
          540 + index * 90,
          start + 0.09
        );
        bladeGain.gain.setValueAtTime(0.001, start);
        bladeGain.gain.linearRampToValueAtTime(0.1, start + 0.004);
        bladeGain.gain.exponentialRampToValueAtTime(0.001, start + 0.115);
        blade.connect(bladeGain);
        bladeGain.connect(master);
        blade.start(start);
        blade.stop(start + 0.12);
      });
      if (this.limitImpactTimer !== null) {
        window.clearTimeout(this.limitImpactTimer);
      }
      const finalSlashDelay = slashDelays.at(-1) ?? 0.1;
      this.limitImpactTimer = window.setTimeout(() => {
        this.limitImpactTimer = null;
        this.playCapitalImpact(
          'player',
          resolvedTier === 1 ? 0.55 : resolvedTier === 2 ? 0.78 : 1
        );
      }, Math.round((finalSlashDelay + 0.11) * 1_000));
    } catch {
      const resolvedTier = Math.max(1, Math.min(3, Math.floor(tier)));
      this.playCapitalImpact(
        'player',
        resolvedTier === 1 ? 0.55 : resolvedTier === 2 ? 0.78 : 1
      );
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
      const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.setValueAtTime(panValue, now);
        master.connect(panner);
        panner.connect(ctx.destination);
      } else {
        master.connect(ctx.destination);
      }

      const impactCount =
        power >= 0.72 ? 4 : power >= 0.48 ? 3 : power >= 0.32 ? 2 : 1;
      const impactOffsets = [0, 0.14, 0.31, 0.52] as const;
      const finalImpactAt = now + impactOffsets[impactCount - 1];
      const tailDuration = 0.54 + power * 0.22;
      const outputEnd = finalImpactAt + tailDuration;
      master.gain.setValueAtTime(0.28 * power, now);
      master.gain.setValueAtTime(0.28 * power, finalImpactAt + 0.035);
      master.gain.exponentialRampToValueAtTime(0.001, outputEnd);

      let activeVoices = 0;
      let schedulingFinished = false;
      let outputDisconnected = false;
      const disconnectNode = (node: AudioNode) => {
        try {
          node.disconnect();
        } catch {
          // The node may already be disconnected by an interrupted context.
        }
      };
      const releaseOutput = () => {
        if (
          outputDisconnected ||
          !schedulingFinished ||
          activeVoices > 0
        ) {
          return;
        }
        outputDisconnected = true;
        disconnectNode(master);
        if (panner) disconnectNode(panner);
      };
      const scheduleImpactVoice = (
        type: OscillatorType,
        start: number,
        duration: number,
        startFrequency: number,
        endFrequency: number,
        volume: number
      ) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        let cleaned = false;
        const cleanup = () => {
          if (cleaned) return;
          cleaned = true;
          disconnectNode(oscillator);
          disconnectNode(gain);
          activeVoices = Math.max(0, activeVoices - 1);
          releaseOutput();
        };

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(startFrequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(
          endFrequency,
          start + duration
        );
        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.onended = cleanup;
        activeVoices += 1;
        try {
          oscillator.start(start);
          oscillator.stop(start + duration + 0.015);
        } catch (error) {
          try {
            oscillator.stop();
          } catch {
            // A voice that failed before starting has nothing left to stop.
          }
          cleanup();
          throw error;
        }
      };

      try {
        const metallicFrequencies = side === 'player'
          ? [1_520, 1_260, 1_690, 1_080]
          : [1_310, 1_090, 1_460, 940];
        for (let index = 0; index < impactCount; index += 1) {
          const start = now + impactOffsets[index];
          scheduleImpactVoice(
            index % 2 === 0 ? 'triangle' : 'sine',
            start,
            0.08 + (index % 2) * 0.025,
            metallicFrequencies[index],
            520 + index * 35,
            0.52 - index * 0.045
          );
        }

        scheduleImpactVoice(
          'sine',
          finalImpactAt + 0.018,
          tailDuration,
          side === 'player' ? 76 : 66,
          27,
          0.72 + power * 0.08
        );
      } finally {
        schedulingFinished = true;
        releaseOutput();
      }
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
    if (!this.playFankitAudio(
      FANKIT_AUDIO.dutyStart,
      0.54,
      () => this.playDutyStartSynth(),
      'cinematic'
    )) {
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
    if (!this.playFankitAudio(
      FANKIT_AUDIO.limitBreak,
      0.62,
      () => this.playFinalPush(),
      'cinematic'
    )) {
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
      master.gain.setValueAtTime(0.2, now + 0.58);
      master.gain.exponentialRampToValueAtTime(0.001, now + 1.28);
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

      [0.38, 0.76].forEach((delay, index) => {
        const suspense = ctx.createOscillator();
        const suspenseGain = ctx.createGain();
        suspense.type = 'triangle';
        suspense.frequency.setValueAtTime(
          (side === 'player' ? 220 : 174) * (index === 0 ? 1 : 0.72),
          now + delay
        );
        suspense.frequency.exponentialRampToValueAtTime(58, now + delay + 0.28);
        suspenseGain.gain.setValueAtTime(0.12, now + delay);
        suspenseGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.3);
        suspense.connect(suspenseGain);
        suspenseGain.connect(master);
        suspense.start(now + delay);
        suspense.stop(now + delay + 0.32);
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
    } catch {
      // Audio fallback
    }
  }
  playVictory() {
    if (!this.enabled) return;
    if (!this.playFankitAudio(
      FANKIT_AUDIO.victory,
      0.62,
      () => this.playVictorySynth(),
      'cinematic'
    )) {
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
    if (!this.playFankitAudio(
      FANKIT_AUDIO.defeat,
      0.58,
      () => this.playDefeatSynth(),
      'cinematic'
    )) {
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

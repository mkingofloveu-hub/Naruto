import { ElementType } from './types';

class ShinobiAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private volume = 0.7;
  private musicEnabled = true;
  private sfxEnabled = true;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicMode: 'title' | 'battle' | 'none' = 'none';

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (
      !this.ctx &&
      typeof navigator !== 'undefined' &&
      'userActivation' in navigator &&
      !(navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
        .userActivation?.hasBeenActive
    ) {
      return null;
    }
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicEnabled ? 0.24 : 0;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxEnabled ? 0.75 : 0;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public configure(opts: {
    volume: number;
    musicEnabled: boolean;
    sfxEnabled: boolean;
  }): void {
    this.volume = Math.max(0, Math.min(1, opts.volume));
    this.musicEnabled = opts.musicEnabled;
    this.sfxEnabled = opts.sfxEnabled;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.04);
    }
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(
        this.musicEnabled ? 0.24 : 0,
        this.ctx.currentTime,
        0.04,
      );
    }
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(
        this.sfxEnabled ? 0.75 : 0,
        this.ctx.currentTime,
        0.04,
      );
    }
  }

  public startMusic(mode: 'title' | 'battle'): void {
    if (this.musicMode === mode && this.musicTimer !== null) return;
    this.stopMusic();
    this.musicMode = mode;
    this.musicStep = 0;

    const intervalMs = mode === 'battle' ? 165 : 280;
    this.musicTimer = window.setInterval(() => {
      if (!this.musicEnabled) return;
      const ctx = this.ctx;
      if (!ctx || ctx.state !== 'running' || !this.musicGain) return;
      this.tickMusicStep(ctx, this.musicGain, mode, this.musicStep++);
    }, intervalMs);
  }

  public stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicMode = 'none';
  }

  private tickMusicStep(
    ctx: AudioContext,
    dest: AudioNode,
    mode: 'title' | 'battle',
    step: number,
  ): void {
    const now = ctx.currentTime;
    // Japanese Hirajoshi / Yo pentatonic minor frequencies (A minor flavor)
    const scale = [220, 246.94, 261.63, 329.63, 349.23, 440, 493.88, 523.25, 659.25];

    if (mode === 'battle') {
      // Driving Taiko drum pattern
      if (step % 4 === 0 || step % 8 === 6) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(step % 8 === 0 ? 115 : 88, now);
        osc.frequency.exponentialRampToValueAtTime(36, now + 0.14);
        g.gain.setValueAtTime(0.45, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(g).connect(dest);
        osc.start(now);
        osc.stop(now + 0.17);
      }
      // Shamisen plucked ostinato
      const pattern = [0, 3, 4, 3, 5, 4, 2, 1, 0, 5, 7, 5, 4, 3, 2, 1];
      const noteFreq = scale[pattern[step % pattern.length]];
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(noteFreq, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1900, now);
      filter.frequency.exponentialRampToValueAtTime(420, now + 0.13);
      g.gain.setValueAtTime(0.16, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(filter).connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.15);

      // High flute / koto accent on bar accents
      if (step % 16 === 0 || step % 16 === 10) {
        const lead = ctx.createOscillator();
        const lg = ctx.createGain();
        lead.type = 'triangle';
        lead.frequency.setValueAtTime(scale[(step % 16 === 0 ? 7 : 8)] * 1.0, now);
        lg.gain.setValueAtTime(0.12, now);
        lg.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        lead.connect(lg).connect(dest);
        lead.start(now);
        lead.stop(now + 0.45);
      }
    } else {
      // Atmospheric Title flute + deep shamisen drone
      if (step % 8 === 0) {
        const bass = ctx.createOscillator();
        const bg = ctx.createGain();
        bass.type = 'triangle';
        bass.frequency.setValueAtTime(110, now);
        bg.gain.setValueAtTime(0.24, now);
        bg.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        bass.connect(bg).connect(dest);
        bass.start(now);
        bass.stop(now + 0.92);
      }
      if (step % 2 === 0) {
        const titlePattern = [5, 3, 2, 4, 5, 7, 6, 4];
        const freq = scale[titlePattern[(step / 2) % titlePattern.length]];
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(0.14, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
        osc.connect(g).connect(dest);
        osc.start(now);
        osc.stop(now + 0.38);
      }
    }
  }

  private pitchJitter(): number {
    return 0.92 + Math.random() * 0.16;
  }

  public playHit(heavy = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const jitter = this.pitchJitter();

    // Punch thud
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = heavy ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime((heavy ? 185 : 230) * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 38 : 65, now + (heavy ? 0.18 : 0.09));
    g.gain.setValueAtTime(heavy ? 0.55 : 0.35, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.2 : 0.1));
    osc.connect(g).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (heavy ? 0.21 : 0.11));

    // White noise snap
    this.playNoiseBurst(heavy ? 0.12 : 0.05, heavy ? 1200 : 2200, heavy ? 0.35 : 0.2);
  }

  public playSwing(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    this.playNoiseBurst(0.07, 1600 * this.pitchJitter(), 0.14);
  }

  public playKunai(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1450 * this.pitchJitter(), now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.09);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playBlock(parry = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(parry ? 1120 : 540, now);
    osc.frequency.exponentialRampToValueAtTime(parry ? 1680 : 280, now + (parry ? 0.18 : 0.08));
    g.gain.setValueAtTime(parry ? 0.32 : 0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (parry ? 0.2 : 0.09));
    osc.connect(g).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (parry ? 0.21 : 0.1));
  }

  public playDash(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    this.playNoiseBurst(0.11, 900 * this.pitchJitter(), 0.22);
  }

  public playChakraTick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.linearRampToValueAtTime(520, now + 0.11);
    g.gain.setValueAtTime(0.1, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playJutsu(element: ElementType, ultimate = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const baseMap: Record<ElementType, number> = {
      lightning: 780,
      fire: 220,
      wind: 520,
      water: 340,
      earth: 140,
      chakra: 440,
      taijutsu: 300,
      sand: 260,
      paper: 620,
      wood: 190,
    };
    const freq = baseMap[element] ?? 440;

    // Hand-sign chime
    const chime = ctx.createOscillator();
    const cg = ctx.createGain();
    chime.type = 'triangle';
    chime.frequency.setValueAtTime(880, now);
    chime.frequency.setValueAtTime(1174, now + 0.06);
    cg.gain.setValueAtTime(0.22, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    chime.connect(cg).connect(this.sfxGain);
    chime.start(now);
    chime.stop(now + 0.23);

    // Elemental surge
    const surge = ctx.createOscillator();
    const sg = ctx.createGain();
    surge.type = element === 'lightning' ? 'sawtooth' : 'sine';
    surge.frequency.setValueAtTime(freq, now + 0.05);
    surge.frequency.exponentialRampToValueAtTime(
      ultimate ? freq * 2.1 : freq * 0.65,
      now + (ultimate ? 0.65 : 0.32),
    );
    sg.gain.setValueAtTime(ultimate ? 0.45 : 0.3, now + 0.05);
    sg.gain.exponentialRampToValueAtTime(0.001, now + (ultimate ? 0.7 : 0.35));
    surge.connect(sg).connect(this.sfxGain);
    surge.start(now + 0.05);
    surge.stop(now + (ultimate ? 0.72 : 0.36));

    if (ultimate) {
      this.playExplosion(true);
    }
  }

  public playExplosion(large = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(large ? 130 : 160, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + (large ? 0.6 : 0.35));
    g.gain.setValueAtTime(large ? 0.65 : 0.42, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (large ? 0.65 : 0.38));
    osc.connect(g).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (large ? 0.66 : 0.4));
    this.playNoiseBurst(large ? 0.5 : 0.25, 700, large ? 0.45 : 0.28);
  }

  public playBossIntro(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    [130.81, 196.0, 261.63].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      osc.connect(g).connect(this.sfxGain!);
      osc.start(now);
      osc.stop(now + 1.15);
    });
  }

  public playOutcome(victory: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled) return;
    const now = ctx.currentTime;
    const notes = victory ? [440, 523.25, 659.25, 880] : [392, 349.23, 311.13, 261.63];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.13;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.26, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(g).connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.48);
    });
  }

  private playNoiseBurst(duration: number, cutoffHz: number, gainPeak: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain) return;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoffHz;

    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(gainPeak, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter).connect(g).connect(this.sfxGain);
    source.start(now);
  }
}

export const audioEngine = new ShinobiAudioEngine();

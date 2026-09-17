/**
 * WebAudio-synthesized SFX + optional speechSynthesis announcer.
 * Nothing makes sound until the first user input (autoplay policy);
 * M toggles mute.
 */

export type Sfx = 'hit' | 'heavy' | 'block' | 'whiff' | 'backfire' | 'shatter' | 'move' | 'confirm' | 'back' | 'ko' | 'splat';

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  /** Called from the first input handler. */
  unlock(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.01);
    if (this.muted && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, f0: number, f1 = f0, delay = 0, q = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuf) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  play(sfx: Sfx): void {
    if (!this.ctx || this.muted) return;
    switch (sfx) {
      case 'hit':
        this.noise(0.08, 0.5, 'lowpass', 2400, 600);
        this.tone('square', 220, 90, 0.07, 0.18);
        break;
      case 'heavy':
        this.tone('sine', 160, 38, 0.28, 0.9);
        this.noise(0.18, 0.7, 'lowpass', 1800, 200);
        this.tone('square', 110, 50, 0.12, 0.2);
        break;
      case 'block':
        this.tone('square', 1250, 1100, 0.09, 0.12);
        this.tone('triangle', 1880, 1700, 0.14, 0.12, 0.01);
        this.noise(0.05, 0.3, 'highpass', 3000);
        break;
      case 'whiff':
        this.noise(0.22, 0.35, 'bandpass', 300, 2600, 0, 2.5);
        break;
      case 'backfire':
        this.tone('sawtooth', 420, 70, 0.4, 0.2);
        this.noise(0.12, 0.4, 'lowpass', 900, 150, 0.25);
        break;
      case 'shatter':
        this.noise(0.5, 0.5, 'highpass', 4000, 2000);
        for (let i = 0; i < 9; i++) this.tone('triangle', 1800 + Math.random() * 3000, 1500 + Math.random() * 1500, 0.08 + Math.random() * 0.2, 0.08, i * 0.025);
        this.tone('sine', 90, 30, 0.4, 0.6);
        break;
      case 'splat':
        this.noise(0.1, 0.25, 'lowpass', 600, 200);
        break;
      case 'ko':
        this.tone('sine', 120, 30, 0.7, 0.9);
        this.noise(0.4, 0.5, 'lowpass', 800, 60);
        break;
      case 'move':
        this.tone('square', 660, 640, 0.04, 0.08);
        break;
      case 'confirm':
        this.tone('square', 660, 660, 0.06, 0.1);
        this.tone('square', 990, 990, 0.1, 0.1, 0.06);
        break;
      case 'back':
        this.tone('square', 440, 300, 0.08, 0.08);
        break;
    }
  }

  /** Original announcer callouts, spoken by the browser voice if available. */
  announce(line: string): void {
    if (!this.ctx || this.muted || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(line);
      u.pitch = 0.4;
      u.rate = 0.85;
      u.volume = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      /* voice is optional */
    }
  }
}

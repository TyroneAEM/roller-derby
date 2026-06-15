// Web Audio API sound engine — all sounds synthesised, no files needed

class AudioEngine {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  /** Call from first user gesture to unlock audio on iOS/Android */
  unlock() { this.getCtx(); }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = 'sine',
    vol = 0.3,
    delay = 0,
    freqEnd?: number
  ) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    const t0 = ctx.currentTime + delay;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.start(t0);
    osc.stop(t0 + dur + 0.01);
  }

  private noise(dur: number, freqLow: number, freqHigh: number, vol = 0.35, delay = 0) {
    const ctx = this.getCtx();
    const size = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + delay;
    filter.frequency.setValueAtTime(freqLow, t0);
    filter.frequency.exponentialRampToValueAtTime(freqHigh, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start(t0); src.stop(t0 + dur + 0.01);
  }

  /** Single point scored */
  score() {
    this.tone(523, 0.08, 'sine', 0.28);
    this.tone(784, 0.12, 'sine', 0.28, 0.07);
  }

  /** Grand slam — single bright chime, same volume as score */
  grandSlam() {
    this.tone(880, 0.14, 'sine', 0.28);
  }

  /** Turbo whoosh */
  turbo() {
    this.noise(0.35, 180, 2400, 0.4);
    this.tone(220, 0.35, 'sawtooth', 0.12, 0, 880);
  }

  /** Blocker collision thud */
  hit() {
    this.tone(90, 0.12, 'sine', 0.55);
    this.tone(55, 0.18, 'sine', 0.35, 0.04);
    this.noise(0.1, 100, 300, 0.3);
  }

  /** Power-up collect chime */
  powerUp() {
    [392, 523, 659, 880].forEach((f, i) => this.tone(f, 0.14, 'sine', 0.22, i * 0.065));
  }

  /** Speed power-up specific */
  speedBoost() {
    this.noise(0.2, 400, 1600, 0.3);
    this.tone(440, 0.2, 'sawtooth', 0.12, 0, 1760);
  }

  /** Jam start whistle */
  whistle() {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.linearRampToValueAtTime(1600, t + 0.15);
    osc.frequency.linearRampToValueAtTime(1500, t + 0.3);
    osc.frequency.linearRampToValueAtTime(1700, t + 0.45);
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.start(t); osc.stop(t + 0.6);
  }

  /** Countdown beep */
  beep(final = false) {
    this.tone(final ? 880 : 440, final ? 0.28 : 0.10, 'sine', 0.3);
  }

  /** Crowd cheer */
  crowd() {
    for (let i = 0; i < 4; i++) {
      this.noise(0.5, 300 + i * 80, 600 + i * 100, 0.12, i * 0.08);
    }
  }

  /** Jammer shove/push attack */
  push() {
    this.tone(120, 0.08, 'sawtooth', 0.5);
    this.tone(200, 0.12, 'sine', 0.3, 0.04);
    this.noise(0.15, 150, 600, 0.35);
    this.tone(440, 0.06, 'square', 0.15, 0.06, 220);
  }

  /** Shield absorbed hit */
  shieldBlock() {
    this.tone(880, 0.05, 'sine', 0.4);
    this.tone(660, 0.12, 'sine', 0.3, 0.05);
    this.noise(0.1, 1000, 3000, 0.2);
  }
}

export const audio = new AudioEngine();

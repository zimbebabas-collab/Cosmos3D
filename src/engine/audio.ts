/**
 * 100% procedural Web Audio API soundscape for ASTRUM.
 * Synthesizes deep cosmic ambient harmonic drone (pitch-modulated by black hole gravity),
 * hyper-warp transit sweeps, orbital scanner chimes, and crisp UI micro-feedback.
 */
export class SpaceAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneOscA: OscillatorNode | null = null;
  private droneOscB: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private muted = false;
  private initialized = false;

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.22;
      master.connect(ctx.destination);
      this.masterGain = master;

      // Deep harmonic orbital drone (55 Hz A1 + 82.4 Hz E2 filtered gently)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 180;
      filter.Q.value = 1.4;
      filter.connect(master);
      this.droneFilter = filter;

      const droneGain = ctx.createGain();
      droneGain.gain.value = 0.26;
      droneGain.connect(filter);

      const oscA = ctx.createOscillator();
      oscA.type = 'sine';
      oscA.frequency.value = 55;
      oscA.connect(droneGain);
      oscA.start();
      this.droneOscA = oscA;

      const oscB = ctx.createOscillator();
      oscB.type = 'triangle';
      oscB.frequency.value = 82.41;
      const gainB = ctx.createGain();
      gainB.gain.value = 0.32;
      oscB.connect(gainB);
      gainB.connect(droneGain);
      oscB.start();
      this.droneOscB = oscB;

      this.initialized = true;
    } catch {
      // Headless or restricted audio contexts silently degrade
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.22, this.ctx.currentTime, 0.08);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Modulates ambient space drone smoothly when approaching Gargantua's gravity well
   * or entering galactic scale.
   */
  public updateAtmosphere(gravityDilation: number, isGalactic: boolean): void {
    if (!this.ctx || !this.droneOscA || !this.droneOscB || !this.droneFilter) return;
    const now = this.ctx.currentTime;
    const redshift = Math.max(0.58, 1.0 / Math.sqrt(Math.max(1.0, gravityDilation)));
    const baseFreq = isGalactic ? 65.41 : 55.0 * redshift;
    this.droneOscA.frequency.setTargetAtTime(baseFreq, now, 0.35);
    this.droneOscB.frequency.setTargetAtTime(baseFreq * 1.498, now, 0.35);
    this.droneFilter.frequency.setTargetAtTime(
      isGalactic ? 260 : gravityDilation > 1.2 ? 130 : 185,
      now,
      0.35,
    );
  }

  /**
   * Relativistic hyper-warp jump swoosh + arrival harmonic.
   */
  public playWarpJump(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.38);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.95);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(240, now);
    filter.frequency.exponentialRampToValueAtTime(1400, now + 0.38);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.95);
    filter.Q.value = 2.2;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.05);
  }

  /**
   * Crisp futuristic harmonic telemetry sweep when scanning a celestial body.
   */
  public playScanSuccess(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 - E5 - G5 - C6 crystalline arpeggio
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const start = now + idx * 0.065;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  }

  public playUiTick(): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.045);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public dispose(): void {
    try {
      this.droneOscA?.stop();
      this.droneOscB?.stop();
      void this.ctx?.close();
    } catch {
      // ignore cleanup errors
    }
    this.ctx = null;
    this.initialized = false;
  }
}

class SoundFXManager {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private ensureCtx(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  public playJump(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.14);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playTongue(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(310, now + 0.12);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playFly(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [587, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.045);
      gain.gain.setValueAtTime(0.11, now + i * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.12);
    });
  }

  public playSplash(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.25);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.27);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.27);
  }
}

export const soundFX = new SoundFXManager();

class LudoAudioManager {
  private ctx: AudioContext | null = null;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Helper to create synthetic white noise for captures/explosions
  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 0.4; // 0.4 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  playRoll() {
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Realistic dice cup shake: rapid sequence of filtered clicks
      for (let i = 0; i < 8; i++) {
        const time = now + i * 0.08 + Math.random() * 0.02;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120 + Math.random() * 40, time);
        
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(300, time);
        filter.Q.setValueAtTime(3, time);

        gain.gain.setValueAtTime(0.12, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.06);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + 0.07);
      }
    } catch (e) {
      console.warn('Audio playRoll failed:', e);
    }
  }

  playMove() {
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Premium wooden piece tap sound: base sine wave + resonant transient click
      const osc = this.ctx.createOscillator();
      const clickOsc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Main tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);

      // Wooden click transient
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(800, now);
      clickOsc.frequency.exponentialRampToValueAtTime(100, now + 0.03);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

      osc.connect(filter);
      clickOsc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      clickOsc.start(now);
      osc.stop(now + 0.15);
      clickOsc.stop(now + 0.04);
    } catch (e) {
      console.warn('Audio playMove failed:', e);
    }
  }

  playCapture() {
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // White noise explosion burst
      const noiseBuffer = this.createNoiseBuffer();
      if (noiseBuffer) {
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = noiseBuffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.linearRampToValueAtTime(100, now + 0.35);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);

        noiseNode.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noiseNode.start(now);
        noiseNode.stop(now + 0.4);
      }

      // Descending sub-bass thud
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(150, now);
      subOsc.frequency.linearRampToValueAtTime(40, now + 0.3);

      subGain.gain.setValueAtTime(0.3, now);
      subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.3);
    } catch (e) {
      console.warn('Audio playCapture failed:', e);
    }
  }

  playDeploy() {
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {
      console.warn('Audio playDeploy failed:', e);
    }
  }

  playHome() {
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Bright sparkly pentatonic arpeggio (C major: C5, E5, G5, C6)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const time = now + idx * 0.08;
        const osc = this.ctx!.createOscillator();
        const subOsc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(freq / 2, time);

        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.005, time + 0.25);

        osc.connect(gain);
        subOsc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(time);
        subOsc.start(time);
        osc.stop(time + 0.26);
        subOsc.stop(time + 0.26);
      });
    } catch (e) {
      console.warn('Audio playHome failed:', e);
    }
  }

  playVictory() {
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Festive major scale fanfare sequence
      const notes = [
        { f: 523.25, d: 0.15 }, // C5
        { f: 587.33, d: 0.15 }, // D5
        { f: 659.25, d: 0.15 }, // E5
        { f: 783.99, d: 0.25 }, // G5
        { f: 880.00, d: 0.15 }, // A5
        { f: 1046.50, d: 0.6 }  // C6
      ];

      let elapsed = 0;
      notes.forEach((note) => {
        const time = now + elapsed;
        const osc = this.ctx!.createOscillator();
        const sub = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.f, time);
        
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(note.f / 2, time);

        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + note.d);

        osc.connect(gain);
        sub.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(time);
        sub.start(time);
        osc.stop(time + note.d + 0.05);
        sub.stop(time + note.d + 0.05);

        elapsed += note.d * 0.8;
      });
    } catch (e) {
      console.warn('Audio playVictory failed:', e);
    }
  }
}

export const ludoAudio = new LudoAudioManager();
export default ludoAudio;

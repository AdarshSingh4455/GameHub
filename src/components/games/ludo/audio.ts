class LudoAudioManager {
  private ctx: AudioContext | null = null;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    // Resume context if suspended (common browser security constraint)
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playRoll() {
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Simulate a roll: a sequence of short low-pitch clicks/thuds
      for (let i = 0; i < 6; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100 - i * 10, now + i * 0.1);

        gain.gain.setValueAtTime(0.15, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.08);
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

      // Simulate a step: short upward pop
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      console.warn('Audio playMove failed:', e);
    }
  }

  playCapture() {
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Simulate a capture: dramatic crash/explosion sound
      const osc = this.ctx.createOscillator();
      const noiseGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.4);

      noiseGain.gain.setValueAtTime(0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      console.warn('Audio playCapture failed:', e);
    }
  }

  playHome() {
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Playful upward arpeggio when token gets inside center
      const notes = [440, 554, 659, 880]; // A major arpeggio
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.25, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.2);
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

      // Celebratory fan-fare chords when a player wins
      const chords = [
        [261.63, 329.63, 392.00], // C major
        [349.23, 440.00, 523.25], // F major
        [392.00, 493.88, 587.33], // G major
        [523.25, 659.25, 783.99]  // C5 major
      ];

      chords.forEach((freqs, chordIdx) => {
        const startTime = now + chordIdx * 0.3;
        freqs.forEach((freq) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.15, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.45);

          osc.connect(gain);
          gain.connect(this.ctx!.destination);
          osc.start(startTime);
          osc.stop(startTime + 0.45);
        });
      });
    } catch (e) {
      console.warn('Audio playVictory failed:', e);
    }
  }
}

export const ludoAudio = new LudoAudioManager();
export default ludoAudio;

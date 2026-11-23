export type SoundEffectId =
  | 'card-flip'
  | 'card-draw'
  | 'chat-pop'
  | 'match'
  | 'win'
  | 'ludo-roll'
  | 'ludo-move'
  | 'ludo-capture'
  | 'ludo-home'
  | 'ludo-six'
  | 'click';

class SoundEffectsManager {
  private muted = false;
  private ctx: AudioContext | null = null;
  private listeners = new Set<(muted: boolean) => void>();

  constructor() {
    try {
      if (typeof window !== 'undefined') {
        this.muted = window.localStorage.getItem('cr_sound_muted') === '1';
      }
    } catch {
      this.muted = false;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(next: boolean): void {
    this.muted = next;
    try {
      window.localStorage.setItem('cr_sound_muted', next ? '1' : '0');
    } catch {
      // Ignore storage error
    }
    this.listeners.forEach((fn) => fn(this.muted));
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  subscribe(fn: (muted: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        this.ctx = new Ctx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  play(effect: SoundEffectId): void {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const playTone = (freq: number, dur: number, delay = 0, type: OscillatorType = 'sine', gainVal = 0.06) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + delay);
        gain.gain.setValueAtTime(gainVal, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + dur);
      };

      switch (effect) {
        case 'win':
          playTone(523.25, 0.14, 0, 'triangle', 0.08);
          playTone(659.25, 0.14, 0.11, 'triangle', 0.08);
          playTone(783.99, 0.25, 0.22, 'triangle', 0.09);
          break;
        case 'ludo-capture':
          playTone(440, 0.09, 0, 'sawtooth', 0.06);
          playTone(220, 0.16, 0.08, 'sawtooth', 0.06);
          break;
        case 'ludo-home':
          playTone(587.33, 0.12, 0, 'sine', 0.07);
          playTone(880, 0.2, 0.1, 'sine', 0.08);
          break;
        case 'ludo-six':
          playTone(660, 0.1, 0, 'triangle', 0.06);
          playTone(880, 0.14, 0.08, 'triangle', 0.06);
          break;
        case 'ludo-roll':
          playTone(320, 0.06, 0, 'square', 0.03);
          playTone(420, 0.06, 0.06, 'square', 0.03);
          break;
        case 'ludo-move':
        case 'card-flip':
          playTone(460, 0.07, 0, 'sine', 0.05);
          break;
        case 'chat-pop':
          playTone(620, 0.06, 0, 'sine', 0.04);
          break;
        case 'match':
          playTone(520, 0.1, 0, 'triangle', 0.06);
          playTone(740, 0.14, 0.09, 'triangle', 0.06);
          break;
        default:
          playTone(500, 0.05, 0, 'sine', 0.04);
      }
    } catch {
      // Ignore WebAudio restriction errors
    }
  }
}

export const soundFx = new SoundEffectsManager();

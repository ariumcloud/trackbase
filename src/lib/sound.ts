// Utilitário de áudio robusto para tocar o som de venda (cash-machine.mp3)
// Especialmente otimizado para iOS Safari / PWA com desbloqueio de AudioContext

class SoundPlayer {
  private audioCtx: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private fallbackAudio: HTMLAudioElement | null = null;
  private isUnlocked = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        this.fallbackAudio = new Audio("/cash-machine.mp3");
        this.fallbackAudio.preload = "auto";
      } catch {
        // Ignora
      }

      const unlock = () => {
        this.unlockAudio();
        window.removeEventListener("touchstart", unlock);
        window.removeEventListener("touchend", unlock);
        window.removeEventListener("click", unlock);
      };

      window.addEventListener("touchstart", unlock, { passive: true });
      window.addEventListener("touchend", unlock, { passive: true });
      window.addEventListener("click", unlock, { passive: true });
    }
  }

  public async unlockAudio() {
    if (this.isUnlocked) return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioContextClass && !this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx && this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      if (this.audioCtx) {
        const buffer = this.audioCtx.createBuffer(1, 1, 22050);
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioCtx.destination);
        source.start(0);
      }

      if (this.audioCtx && !this.audioBuffer) {
        const res = await fetch("/cash-machine.mp3");
        const arrayBuffer = await res.arrayBuffer();
        this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      }

      this.isUnlocked = true;
    } catch {
      // Ignora erro
    }
  }

  public async play() {
    // 1. Tenta Web Audio API (volume mais alto e melhor compatibilidade iOS)
    try {
      if (!this.audioCtx) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }

      if (this.audioCtx) {
        if (this.audioCtx.state === "suspended") {
          await this.audioCtx.resume();
        }

        if (!this.audioBuffer) {
          const res = await fetch("/cash-machine.mp3");
          const arrayBuffer = await res.arrayBuffer();
          this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
        }

        if (this.audioBuffer) {
          const source = this.audioCtx.createBufferSource();
          source.buffer = this.audioBuffer;
          source.connect(this.audioCtx.destination);
          source.start(0);
          return;
        }
      }
    } catch (err) {
      console.warn("Web Audio API falhou, usando HTML5 fallback:", err);
    }

    // 2. Fallback HTML5 Audio
    try {
      if (!this.fallbackAudio) {
        this.fallbackAudio = new Audio("/cash-machine.mp3");
      }
      this.fallbackAudio.currentTime = 0;
      this.fallbackAudio.volume = 1.0;
      await this.fallbackAudio.play();
    } catch (err) {
      console.error("HTML5 Audio play falhou:", err);
    }
  }
}

export const soundPlayer = new SoundPlayer();

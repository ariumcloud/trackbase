// Utilitário de áudio robusto para tocar o som de venda (cash-machine.mp3)
// Especialmente otimizado para iOS Safari / PWA / Android com desbloqueio contínuo e sintetizador fallback

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
      };

      window.addEventListener("touchstart", unlock, { passive: true });
      window.addEventListener("touchend", unlock, { passive: true });
      window.addEventListener("click", unlock, { passive: true });
    }
  }

  public async unlockAudio() {
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

      // Toca um buffer silencioso para satisfazer a política de mídia do iOS Safari
      if (this.audioCtx) {
        const buffer = this.audioCtx.createBuffer(1, 1, 22050);
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioCtx.destination);
        source.start(0);
      }

      // Prime também o elemento de áudio HTML5 para permitir reprodução assíncrona
      if (this.fallbackAudio && !this.isUnlocked) {
        this.fallbackAudio.volume = 0.01;
        this.fallbackAudio.play().then(() => {
          if (this.fallbackAudio) {
            this.fallbackAudio.pause();
            this.fallbackAudio.currentTime = 0;
            this.fallbackAudio.volume = 1.0;
          }
        }).catch(() => {});
      }

      // Baixa e decodifica o arquivo de som antecipadamente
      if (this.audioCtx && !this.audioBuffer) {
        fetch("/cash-machine.mp3")
          .then((res) => res.arrayBuffer())
          .then((ab) => this.audioCtx?.decodeAudioData(ab))
          .then((decoded) => {
            if (decoded) this.audioBuffer = decoded;
          })
          .catch(() => {});
      }

      this.isUnlocked = true;
    } catch {
      // Ignora erro
    }
  }

  /**
   * Sintetiza o som de caixa registradora / moedas via Web Audio API
   * Funciona 100% offline, com zero latência e sem depender do download do mp3.
   */
  private playSynthesizedChime(ctx: AudioContext) {
    try {
      const now = ctx.currentTime;
      const notes = [
        { freq: 987.77, start: now, dur: 0.12 },       // B5
        { freq: 1318.51, start: now + 0.07, dur: 0.38 }, // E6
        { freq: 1975.53, start: now + 0.14, dur: 0.45 }, // B6 (brilho metálico)
      ];

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + dur);
      });
    } catch {
      // Fallback falhou
    }
  }

  public async play() {
    await this.unlockAudio();

    // 1. Tenta reproduzir o buffer mp3 decodificado via Web Audio API
    try {
      if (this.audioCtx) {
        if (this.audioCtx.state === "suspended") {
          await this.audioCtx.resume();
        }

        if (this.audioBuffer) {
          const source = this.audioCtx.createBufferSource();
          source.buffer = this.audioBuffer;
          source.connect(this.audioCtx.destination);
          source.start(0);
          return;
        } else {
          // Se o mp3 ainda não carregou, usa o sintetizador de alta fidelidade
          this.playSynthesizedChime(this.audioCtx);
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

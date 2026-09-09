// Utilitário de áudio de alta fidelidade para o som da máquina registradora (cash-machine.mp3)
// Projetado especificamente para tocar sem falhas no iOS Safari, PWA e Android

class SoundPlayer {
  private audioCtx: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private isDecoding = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        this.audioElement = new Audio("/cash-machine.mp3");
        this.audioElement.preload = "auto";
      } catch {
        // Ignora em SSR
      }

      const onInteraction = () => {
        this.unlockAudio();
      };

      window.addEventListener("touchstart", onInteraction, { passive: true, once: true });
      window.addEventListener("click", onInteraction, { passive: true, once: true });
      
      // Pré-carrega o áudio imediatamente
      this.loadAudioBuffer();
    }
  }

  private async loadAudioBuffer() {
    if (typeof window === "undefined" || this.audioBuffer || this.isDecoding) return;
    this.isDecoding = true;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtx) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }

      const response = await fetch("/cash-machine.mp3");
      const arrayBuffer = await response.arrayBuffer();

      // Compatibilidade cruzada com Safari e navegadores legados (suporta Promise e callback)
      await new Promise<void>((resolve) => {
        if (!this.audioCtx) return resolve();
        this.audioCtx.decodeAudioData(
          arrayBuffer,
          (decoded) => {
            this.audioBuffer = decoded;
            resolve();
          },
          (err) => {
            console.warn("Erro ao decodificar cash-machine.mp3 via Web Audio:", err);
            resolve(); // Não rejeita para permitir fallback
          }
        );
      });
    } catch (e) {
      console.warn("Falha ao carregar buffer de áudio:", e);
    } finally {
      this.isDecoding = false;
    }
  }

  public async unlockAudio() {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioCtx && !this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }

      if (this.audioCtx && this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      // Toca um buffer silencioso para autorizar a saída de áudio no iOS Safari
      if (this.audioCtx) {
        const buffer = this.audioCtx.createBuffer(1, 1, 22050);
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioCtx.destination);
        source.start(0);
      }

      // Assegura que o elemento HTML5 Audio também está pronto para tocar
      if (this.audioElement) {
        this.audioElement.load();
      }

      if (!this.audioBuffer) {
        this.loadAudioBuffer();
      }
    } catch {
      // Ignora erro de desbloqueio silencioso
    }
  }

  public async play() {
    // Tenta desbloquear caso ainda não tenha sido desbloqueado
    await this.unlockAudio();

    // 1. Tenta reprodução via Web Audio API (som nativo decodificado na memória)
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
        }
      }
    } catch (err) {
      console.warn("Web Audio API play error, tentando HTML5 Audio fallback:", err);
    }

    // 2. Fallback via elemento HTML5 Audio com o som real da máquina registradora
    try {
      if (!this.audioElement) {
        this.audioElement = new Audio("/cash-machine.mp3");
      }
      this.audioElement.currentTime = 0;
      this.audioElement.volume = 1.0;
      await this.audioElement.play();
    } catch (err) {
      console.error("Erro ao reproduzir áudio da máquina registradora:", err);
      // Fallback secundário: tenta elemento do DOM caso exista
      if (typeof document !== "undefined") {
        const domAudio = document.getElementById("cash-machine-player") as HTMLAudioElement | null;
        if (domAudio) {
          domAudio.currentTime = 0;
          domAudio.volume = 1.0;
          domAudio.play().catch(() => {});
        }
      }
    }
  }
}

export const soundPlayer = new SoundPlayer();


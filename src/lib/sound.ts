export type SoundResult = {
  status: "started" | "blocked" | "hidden" | "duplicate" | "busy" | "expired";
  backend?: "web-audio" | "html-audio";
};

export type PushSoundRequest = { id: string; deadline: number };

/**
 * Owns both playback backends. A push never calls unlockAudio: a push callback
 * is not a user gesture on iOS. The fallback is sequential, so one push cannot
 * create two audible players.
 */
export class SoundPlayer {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private element: HTMLAudioElement | null = null;
  private loading: Promise<void> | null = null;
  private busy = false;
  private seen = new Set<string>();

  constructor() {
    if (typeof window === "undefined") return;
    try {
      this.element = new Audio("/cash-machine.mp3");
      this.element.preload = "auto";
    } catch {}

    const onUserGesture = () => {
      void this.unlockAudio();
    };

    window.addEventListener("touchstart", onUserGesture, { passive: true });
    window.addEventListener("touchend", onUserGesture, { passive: true });
    window.addEventListener("click", onUserGesture, { passive: true });
    void this.preload();
  }

  private async preload() {
    if (this.buffer || typeof window === "undefined") return;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      try {
        const Context =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Context) return;
        this.context ??= new Context();

        const response = await fetch("/cash-machine.mp3");
        if (!response.ok) return;
        const arrayBuffer = await response.arrayBuffer();

        // Dual callback/promise compatibility for iOS Safari WebKit
        const decoded = await new Promise<AudioBuffer>((resolve, reject) => {
          if (!this.context) return reject(new Error("No context"));
          this.context.decodeAudioData(
            arrayBuffer,
            (buf) => resolve(buf),
            (err) => reject(err)
          );
        });

        this.buffer = decoded;
      } catch (e) {
        console.warn("Audio decode warning:", e);
      }
    })().finally(() => {
      this.loading = null;
    });

    return this.loading;
  }

  /**
   * Universal iOS Safari unlock: must play a 1-sample silent buffer inside a user gesture.
   */
  public async unlockAudio() {
    try {
      const Context =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      this.context ??= new Context();

      if (this.context.state === "suspended") {
        await this.context.resume().catch(() => {});
      }

      // Silent buffer start unlocks iOS Safari Web Audio hardware pipeline
      const buffer = this.context.createBuffer(1, 1, 22050);
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      source.start(0);

      void this.preload();

      if (this.element) {
        this.element.load();
      }
      if (typeof document !== "undefined") {
        const dom = document.getElementById("cash-machine-player") as HTMLAudioElement | null;
        if (dom) dom.load();
      }
    } catch {
      // ignore
    }
  }

  public async play(request?: PushSoundRequest): Promise<SoundResult> {
    if (typeof document === "undefined" || document.visibilityState !== "visible") return { status: "hidden" };
    if (request && this.seen.has(request.id)) return { status: "duplicate" };
    if (request) {
      this.seen.add(request.id);
      if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!);
    } else {
      void this.unlockAudio();
    }

    try {
      if (!this.buffer) {
        await this.preload();
      }

      if (this.context) {
        if (this.context.state === "suspended") {
          await this.context.resume().catch(() => {});
        }

        if (this.buffer) {
          const context = this.context;
          const source = context.createBufferSource();
          source.buffer = this.buffer;
          source.connect(context.destination);
          source.start(0);
          source.onended = () => {
            try {
              source.disconnect();
            } catch {}
          };
          return { status: "started", backend: "web-audio" };
        }
      }

      // Fallback HTML5 audio
      if (this.element) {
        try {
          this.element.currentTime = 0;
          this.element.volume = 1;
          await this.element.play();
          return { status: "started", backend: "html-audio" };
        } catch (e) {
          console.warn("HTML5 audio element failed, trying DOM element:", e);
        }
      }

      if (typeof document !== "undefined") {
        const dom = document.getElementById("cash-machine-player") as HTMLAudioElement | null;
        if (dom) {
          try {
            dom.currentTime = 0;
            dom.volume = 1;
            await dom.play();
            return { status: "started", backend: "html-audio" };
          } catch (e) {
            console.warn("DOM audio element failed:", e);
          }
        }
      }

      return { status: "blocked" };
    } catch (err) {
      console.warn("Sound play error:", err);
      return { status: "blocked" };
    }
  }
}

export const soundPlayer = new SoundPlayer();

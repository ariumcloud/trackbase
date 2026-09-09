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
    this.element = new Audio("/cash-machine.mp3");
    this.element.preload = "auto";
    window.addEventListener("click", () => { void this.unlockAudio(); }, { passive: true });
    window.addEventListener("touchend", () => { void this.unlockAudio(); }, { passive: true });
    void this.preload();
  }

  private async preload() {
    if (this.loading || this.buffer || typeof window === "undefined") return this.loading;
    this.loading = (async () => {
      try {
        const Context = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Context) return;
        this.context ??= new Context();
        const response = await fetch("/cash-machine.mp3");
        if (!response.ok) return;
        this.buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      } catch { /* HTMLAudio remains available if decoding fails. */ }
    })().finally(() => { this.loading = null; });
    return this.loading;
  }

  /** Call only from a real pointer/touch/keyboard interaction. */
  public async unlockAudio() {
    void this.preload();
    if (this.context && this.context.state !== "running" && this.context.state !== "closed") {
      void this.context.resume().catch(() => {});
    }
  }

  public async play(request?: PushSoundRequest): Promise<SoundResult> {
    if (typeof document === "undefined" || document.visibilityState !== "visible") return { status: "hidden" };
    if (request && this.seen.has(request.id)) return { status: "duplicate" };
    if (request && Date.now() >= request.deadline) return { status: "expired" };
    if (request) {
      this.seen.add(request.id);
      if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!);
    } else {
      void this.unlockAudio();
    }
    if (this.busy) return { status: "busy" };
    this.busy = true;
    const deadline = Math.min(request?.deadline ?? Infinity, Date.now() + 650);
    const allowed = () => document.visibilityState === "visible" && Date.now() < deadline;
    let stop: () => void = () => {};
    const hidden = () => { if (document.visibilityState !== "visible") stop(); };
    document.addEventListener("visibilitychange", hidden);
    try {
      await this.preload();

      if (this.context) {
        if (this.context.state === "suspended") {
          await this.context.resume().catch(() => {});
        }

        if (this.context.state === "running" && this.buffer && allowed()) {
          const context = this.context;
          const source = context.createBufferSource();
          stop = () => { try { source.stop(); } catch {} source.disconnect(); };
          try {
            source.buffer = this.buffer;
            source.connect(context.destination);
            source.start(0);
            source.onended = () => source.disconnect();
            return { status: "started", backend: "web-audio" };
          } catch {
            stop();
          }
        }
      }
      if (!allowed()) return { status: document.visibilityState === "visible" ? "expired" : "hidden" };
      const audio = this.element ??= new Audio("/cash-machine.mp3");
      stop = () => audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const started = await Promise.race([
          audio.play().then(() => true),
          new Promise<false>(resolve => { timer = setTimeout(() => { audio.pause(); resolve(false); }, Math.max(0, deadline - Date.now())); }),
        ]);
        if (started && allowed() && !audio.paused) return { status: "started", backend: "html-audio" };
      } catch { /* autoplay rejection is reported to the worker */ }
      finally { clearTimeout(timer); }
      stop();
      return { status: "blocked" };
    } finally {
      document.removeEventListener("visibilitychange", hidden);
      this.busy = false;
    }
  }
}

export const soundPlayer = new SoundPlayer();

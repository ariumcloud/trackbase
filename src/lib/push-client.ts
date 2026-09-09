import { soundPlayer } from "./sound";

export const PUSH_VERSION = "push-audio-20260909-2";

export function pushDebugEnabled() {
  try { return localStorage.getItem("trackbase:push-debug") === "1"; } catch { return false; }
}

export async function handlePushSound(event: MessageEvent, _workspaceId?: string) {
  const message = event.data;
  if (message?.type !== "TRACKBASE_PUSH_SOUND") return null;
  const port = event.ports[0];
  if (!port || message.version !== PUSH_VERSION || typeof message.id !== "string" || !Number.isFinite(message.deadline)) return null;
  const trace = (stage: string, details: Record<string, unknown> = {}) => {
    if (message.debug || pushDebugEnabled()) console.info("[Trackbase push]", {
      stage, id: message.id, version: PUSH_VERSION, visibility: document.visibilityState, ...details,
    });
  };
  trace("message-received");
  try {
    const result = await soundPlayer.play({ id: message.id, deadline: message.deadline });
    trace(result.status === "started" ? "audio-started" : "audio-blocked", result);
    port.postMessage({ id: message.id, version: PUSH_VERSION, ...result });
    return result;
  } catch {
    trace("audio-blocked", { status: "error" });
    port.postMessage({ id: message.id, version: PUSH_VERSION, status: "blocked" });
    return null;
  } finally {
    port.close();
  }
}

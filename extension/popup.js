/* global chrome */
const el = (id) => document.getElementById(id);
async function send(message) {
  const r = await chrome.runtime.sendMessage(message);
  if (r.error) throw new Error(r.error);
  return r.data;
}
async function load() {
  const s = await send({ action: "status" });
  el("origin").value = s.origin;
  el("challenge").value = s.pending?.challenge || "";
  el("workspace").replaceChildren();
  for (const w of s.workspaces) {
    const option = document.createElement("option");
    option.value = w.id;
    option.textContent = `${w.name} — até ${new Date(w.expires_at).toLocaleString()}`;
    el("workspace").append(option);
  }
  if (!s.workspaces.length) {
    const option = document.createElement("option");
    option.textContent = "Sem autorização";
    option.value = "";
    el("workspace").append(option);
  }
  el("workspace").value = s.selected || "";
}
async function run(action) {
  el("message").textContent = "Aguarde…";
  document.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    await action();
    await load();
    el("message").textContent = "Concluído.";
  } catch (e) {
    el("message").textContent = e.message;
  } finally {
    document.querySelectorAll("button").forEach((b) => (b.disabled = false));
  }
}
el("start").onclick = () => {
  let origin;
  try {
    origin = new URL(el("origin").value).origin;
  } catch {
    el("message").textContent = "Endereço inválido.";
    return;
  }
  // Permission request runs directly within the user's gesture.
  const url = new URL(origin);
  const permission = chrome.permissions.request({
    origins: [`${url.protocol}//${url.hostname}/*`],
  });
  void run(async () => {
    if (!(await permission)) throw new Error("Permissão não concedida.");
    await send({ action: "start", origin });
  });
};
el("complete").onclick = () => void run(() => send({ action: "complete" }));
el("disconnect").onclick = () => void run(() => send({ action: "disconnect" }));
el("workspace").onchange = () =>
  void run(() => send({ action: "select", workspace: el("workspace").value }));
load().catch((e) => (el("message").textContent = e.message));

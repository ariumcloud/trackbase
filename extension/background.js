/* global chrome */
// Credentials stay in trusted extension contexts and disappear when Chrome closes.
chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
const hex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const hash = async (value) =>
  hex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  );
function originOf(value) {
  const u = new URL(value);
  const local =
    u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname);
  const trackbase =
    u.protocol === "https:" &&
    (u.hostname === "trackbase.com.br" ||
      u.hostname.endsWith(".trackbase.com.br"));
  if (u.username || u.password || (!local && !trackbase))
    throw new Error(
      "Use o domínio Trackbase ou localhost para desenvolvimento.",
    );
  return u.origin;
}
async function request(origin, path, method, body, token) {
  const r = await fetch(`${origin}/api/mining/${path}`, {
    method,
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "O Trackbase não respondeu.");
  return data;
}
async function handle(message, sender) {
  if (sender.id !== chrome.runtime.id)
    throw new Error("Origem não autorizada.");
  const popup = sender.url === chrome.runtime.getURL("popup.html");
  const meta = /^https:\/\/(www\.)?facebook\.com\/ads\/library\//.test(
    sender.url || "",
  );
  if (!popup && !meta) throw new Error("Página não autorizada.");
  let state = await chrome.storage.session.get([
    "pending",
    "grants",
    "selected",
    "origin",
  ]);
  let grants = state.grants || {};

  // Se a sessão foi limpa pelo fechamento do navegador, recupera a autorização persistida
  if ((!state.grants || Object.keys(state.grants).length === 0) && chrome.storage?.local) {
    const local = await chrome.storage.local.get(["grants", "selected", "origin", "pending"]);
    if (local.grants && Object.keys(local.grants).length > 0) {
      grants = local.grants;
      state.grants = grants;
      state.selected = local.selected || state.selected || Object.keys(grants)[0];
      state.origin = local.origin || state.origin || "https://trackbase.com.br";
      await chrome.storage.session.set({
        grants: state.grants,
        selected: state.selected,
        origin: state.origin,
      });
    }
    if (!state.pending && local.pending) {
      state.pending = local.pending;
      await chrome.storage.session.set({ pending: state.pending });
    }
  }

  if (message.action === "status" && popup) {
    return {
      origin: state.origin || "https://trackbase.com.br",
      selected: state.selected,
      pending: state.pending ? { challenge: state.pending.challenge } : null,
      workspaces: Object.entries(grants).map(([id, g]) => ({
        id,
        name: g.name || id,
        expires_at: g.expires_at,
      })),
    };
  }
  if (message.action === "start" && popup) {
    const origin = originOf(message.origin);
    const url = new URL(origin);
    if (
      !(await chrome.permissions.contains({
        origins: [`${url.protocol}//${url.hostname}/*`],
      }))
    )
      throw new Error("Autorize o domínio do Trackbase.");
    const verifier = random(),
      challenge = await hash(verifier);
    // Changing deployment clears authorizations so no credential crosses origins.
    const newGrants = state.origin === origin ? grants : {};
    const newSelected = state.origin === origin ? state.selected || "" : "";
    await chrome.storage.session.set({
      origin,
      pending: { verifier, challenge },
      grants: newGrants,
      selected: newSelected,
    });
    if (chrome.storage?.local) {
      await chrome.storage.local.set({
        origin,
        pending: { verifier, challenge },
        grants: newGrants,
        selected: newSelected,
      });
    }
    await chrome.tabs.create({
      url: `${origin}/painel?tab=mineracao#extension=${challenge}`,
    });
    return { challenge };
  }
  if (message.action === "complete" && popup) {
    if (!state.pending || !state.origin)
      throw new Error("Inicie o vínculo primeiro.");
    const g = await request(state.origin, "extension", "PUT", {
      verifier: state.pending.verifier,
    });
    grants[g.workspace_id] = {
      token: g.token,
      expires_at: g.expires_at,
      name: g.workspace_name,
    };
    await chrome.storage.session.set({ grants, selected: g.workspace_id });
    await chrome.storage.session.remove("pending");
    if (chrome.storage?.local) {
      await chrome.storage.local.set({
        grants,
        selected: g.workspace_id,
        origin: state.origin,
      });
      await chrome.storage.local.remove("pending");
    }
    return { ok: true };
  }
  if (message.action === "select" && popup) {
    if (!grants[message.workspace]) throw new Error("Workspace não vinculado.");
    await chrome.storage.session.set({ selected: message.workspace });
    if (chrome.storage?.local) {
      await chrome.storage.local.set({ selected: message.workspace });
    }
    return { ok: true };
  }
  if (message.action === "disconnect" && popup) {
    await chrome.storage.session.clear();
    if (chrome.storage?.local) {
      await chrome.storage.local.clear();
    }
    return { ok: true };
  }
  if (message.action === "capture" && meta) {
    const grant = grants[state.selected];
    if (!state.origin || !grant)
      throw new Error("Abra a extensão e vincule um workspace.");
    if (Date.parse(grant.expires_at) <= Date.now())
      throw new Error("Autorização expirada. Vincule novamente.");
    const value = await request(
      state.origin,
      "offers",
      "POST",
      {
        workspace: state.selected,
        capture: message.capture,
        snapshot: message.snapshot === true,
      },
      grant.token,
    );
    return { ok: true, duplicate: value.duplicate, workspace: state.selected };
  }
  throw new Error("Ação não autorizada.");
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  handle(message, sender)
    .then((data) => respond({ data }))
    .catch((error) =>
      respond({
        error: error instanceof Error ? error.message : "Falha na extensão.",
      }),
    );
  return true;
});

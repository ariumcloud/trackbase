/* global chrome */
const el = (id) => document.getElementById(id);

async function send(message) {
  const r = await chrome.runtime.sendMessage(message);
  if (r.error) throw new Error(r.error);
  return r.data;
}

function setMessage(text, type) {
  const msg = el("message");
  const container = el("message-container");
  if (!msg) return;
  msg.textContent = text || "";
  if (!container) return;
  container.classList.remove("is-loading", "is-success", "is-error", "visible");
  if (text) {
    container.classList.add("visible");
    if (type) container.classList.add(`is-${type}`);
  }
}

function updateVisualStatus(state) {
  const card = el("status-card");
  const badge = el("status-badge");
  const expiry = el("expiry");
  if (!card || !badge || !expiry) return;

  card.classList.remove(
    "status-connected",
    "status-pending",
    "status-expired",
    "status-disconnected",
  );

  const hasPending = Boolean(state.pending?.challenge);
  const selectedWorkspace = state.workspaces.find((w) => w.id === state.selected);

  if (selectedWorkspace) {
    const expiresAt = Date.parse(selectedWorkspace.expires_at);
    const now = Date.now();
    if (expiresAt <= now) {
      card.classList.add("status-expired");
      badge.textContent = "Autorização expirada";
      expiry.textContent = `Expirou em ${new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Inicie um novo vínculo.`;
    } else {
      card.classList.add("status-connected");
      badge.textContent = `Conectado: ${selectedWorkspace.name}`;
      const daysLeft = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.max(1, Math.round((expiresAt - now) / (1000 * 60 * 60)));
      const timeStr = daysLeft > 1 ? `${daysLeft} dias restantes` : `~${hoursLeft}h restantes`;
      expiry.textContent = `Válido até ${new Date(expiresAt).toLocaleDateString([], { day: "2-digit", month: "2-digit" })} (${timeStr})`;
    }
  } else if (hasPending) {
    card.classList.add("status-pending");
    badge.textContent = "Código gerado — autorize no painel";
    expiry.textContent = "Aprove no painel e o vínculo será concluído.";
  } else if (state.workspaces.length > 0) {
    card.classList.add("status-pending");
    badge.textContent = "Selecione um workspace de destino";
    expiry.textContent = "Escolha o workspace ativo no seletor abaixo.";
  } else {
    card.classList.add("status-disconnected");
    badge.textContent = "Sem autorização";
    expiry.textContent = "Nenhum workspace conectado neste navegador.";
  }
}

async function load() {
  let s = await send({ action: "status" });

  // Se houver desafio pendente e ainda sem workspace ativo, tenta auto-concluir
  // caso o usuário já tenha clicado em "Autorizar extensão" no painel
  if (s.pending?.challenge && (!s.workspaces?.length || !s.selected)) {
    try {
      await send({ action: "complete" });
      s = await send({ action: "status" });
    } catch {
      // Ainda pendente de autorização no painel
    }
  }

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
  updateVisualStatus(s);
}

async function run(action) {
  setMessage("Aguarde…", "loading");
  document.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    await action();
    await load();
    setMessage("Concluído com sucesso.", "success");
  } catch (e) {
    setMessage(e.message, "error");
  } finally {
    document.querySelectorAll("button").forEach((b) => (b.disabled = false));
  }
}

el("start").onclick = () => {
  let origin;
  try {
    origin = new URL(el("origin").value).origin;
  } catch {
    setMessage("Endereço inválido.", "error");
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

// Copiar código de autorização para o clipboard
const btnCopy = el("btn-copy-challenge");
if (btnCopy) {
  btnCopy.onclick = async () => {
    const code = el("challenge").value.trim();
    if (!code) {
      setMessage("Inicie o vínculo primeiro para gerar um código.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      btnCopy.classList.add("copied");
      const copyText = el("copy-text");
      if (copyText) copyText.textContent = "Copiado!";
      setTimeout(() => {
        btnCopy.classList.remove("copied");
        if (copyText) copyText.textContent = "Copiar";
      }, 2000);
    } catch {
      el("challenge").select();
      setMessage("Selecione e copie o código com Ctrl+C.", "loading");
    }
  };
}

// Navegação do Tutorial ("Como usar")
const btnOpenGuide = el("btn-open-guide");
const btnCloseGuide = el("btn-close-guide");
const mainView = el("main-view");
const guideView = el("guide-view");

if (btnOpenGuide && btnCloseGuide && mainView && guideView) {
  btnOpenGuide.onclick = () => {
    mainView.hidden = true;
    guideView.hidden = false;
  };
  btnCloseGuide.onclick = () => {
    guideView.hidden = true;
    mainView.hidden = false;
  };
}

load().catch((e) => setMessage(e.message, "error"));


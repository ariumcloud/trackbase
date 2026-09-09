/* global chrome, TrackbaseParser */
(function () {
  let timer;
  function scan() {
    for (const card of TrackbaseParser.cards(document)) {
      const id = TrackbaseParser.idFromText(card.innerText || "");
      const existing = card.querySelector("[data-trackbase-controls]");
      if (existing?.dataset.adId === id) continue;
      existing?.remove(); // Only replaces the extension's own controls when Meta recycles a card.
      const controls = document.createElement("div");
      controls.dataset.trackbaseControls = "true";
      controls.dataset.adId = id || "";
      const status = document.createElement("span");
      status.setAttribute("role", "status");
      for (const [label, snapshot] of [
        ["Salvar no Trackbase", false],
        ["Registrar verificação", true],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          button.disabled = true;
          status.textContent = "Salvando…";
          try {
            const capture = TrackbaseParser.capture(card);
            const result = await chrome.runtime.sendMessage({
              action: "capture",
              capture,
              snapshot,
            });
            if (result.error) throw new Error(result.error);
            status.textContent = snapshot
              ? "Verificação registrada."
              : result.data.duplicate
                ? "Anúncio já salvo neste workspace."
                : "Salvo no workspace selecionado.";
          } catch (e) {
            status.textContent =
              e.message || "Falha ao salvar. Reabra a extensão.";
          } finally {
            button.disabled = false;
          }
        });
        controls.append(button);
      }
      controls.append(status);
      card.append(controls);
    }
  }
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 350);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  scan();
})();

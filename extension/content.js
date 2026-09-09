/* global chrome, TrackbaseParser */
(function () {
  let timer;

  function obterDadosSSR(adArchiveId) {
    if (!adArchiveId || typeof document.querySelectorAll !== "function") return null;
    try {
      const marcador = `"ad_archive_id":"${adArchiveId}"`;
      const scripts = document.querySelectorAll('script[type="application/json"][data-sjs], script[type="application/json"]');
      for (const script of scripts) {
        const texto = script.textContent || "";
        const idx = texto.indexOf(marcador);
        if (idx === -1) continue;
        const inicio = texto.lastIndexOf('{"ad_archive_id"', idx + marcador.length);
        if (inicio === -1) continue;
        let fim = texto.indexOf('{"ad_archive_id"', inicio + marcador.length);
        if (fim === -1) fim = Math.min(texto.length, inicio + 15000);
        const trecho = texto.slice(inicio, fim);

        const extrairStr = (chave) => {
          const m = trecho.match(new RegExp(`"${chave}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
          if (!m) return null;
          try { return JSON.parse(`"${m[1]}"`); } catch { return m[1]; }
        };
        const extrairNum = (chave) => {
          // Aceita tanto número cru (123) quanto string numérica ("123") no JSON
          const m = trecho.match(new RegExp(`"${chave}"\\s*:\\s*"?(\\d+)"?`));
          return m ? m[1] : null;
        };

        const startDate = extrairNum("start_date");

        return {
          page_id: extrairNum("page_id") || extrairStr("page_id"),
          page_name: extrairStr("page_name"),
          video_hd_url: extrairStr("video_hd_url"),
          video_sd_url: extrairStr("video_sd_url"),
          collation_count: extrairNum("collation_count") ? Number(extrairNum("collation_count")) : null,
          start_date: startDate ? Number(startDate) : null,
        };
      }
    } catch {
      /* Fallback para DOM se o SSR não estiver disponível */
    }
    return null;
  }

  function calcularDiasAtivo(card, ssr) {
    if (ssr?.start_date) {
      const diff = Math.max(1, Math.floor((Date.now() - ssr.start_date * 1000) / 86400000));
      return diff;
    }
    const texto = card.innerText || "";
    if (typeof TrackbaseParser?.startDate === "function") {
      const dataStr = TrackbaseParser.startDate(texto);
      if (dataStr) {
        const diff = Math.max(1, Math.floor((Date.now() - Date.parse(dataStr)) / 86400000));
        return diff;
      }
    }
    const matchDias = texto.match(/(\d+)\s*(?:dias|DIAS|days)/i);
    if (matchDias) return parseInt(matchDias[1], 10);
    return null;
  }

  function montarSinais(card, id, container) {
    const ssr = obterDadosSSR(id);
    const dias = calcularDiasAtivo(card, ssr);

    const chipDias = document.createElement("span");
    let chipClass = "trackbase-chip trackbase-chip-normal";
    if (dias !== null) {
      if (dias >= 30) {
        chipClass = "trackbase-chip trackbase-chip-fire";
        chipDias.textContent = `🔥 ${dias} dias ativo • Validado`;
        chipDias.title = "Anúncio veiculando há mais de 30 dias — forte indicativo de ROI positivo e escala.";
      } else if (dias >= 7) {
        chipClass = "trackbase-chip trackbase-chip-scale";
        chipDias.textContent = `⚡ ${dias} dias ativo • Em escala`;
        chipDias.title = "Anúncio veiculando há mais de 1 semana.";
      } else {
        chipClass = "trackbase-chip trackbase-chip-normal";
        chipDias.textContent = `⏱ ${dias} ${dias === 1 ? "dia" : "dias"} ativo`;
      }
    } else {
      chipClass = "trackbase-chip trackbase-chip-normal";
      chipDias.textContent = "⏱ Ativo";
    }
    chipDias.className = chipClass;
    container.append(chipDias);

    // Chip de Quantidade (Collation Count)
    const count = ssr?.collation_count || Number((card.innerText || "").match(/(\d+)\s+an[uú]ncios?\s+usam\s+esse\s+criativo/i)?.[1]) || 0;
    if (count > 1) {
      const chipQtd = document.createElement("span");
      chipQtd.className = "trackbase-chip trackbase-chip-count";
      chipQtd.textContent = `📣 ${count} anúncios usam este criativo`;
      chipQtd.title = "Variações ativas compartilhando o mesmo criativo e texto.";
      container.append(chipQtd);
    }

    // Chip de Formato (Vídeo ou Imagem)
    const isVideo = typeof card.querySelector === "function" && Boolean(card.querySelector("video"));
    const chipFmt = document.createElement("span");
    chipFmt.className = "trackbase-chip trackbase-chip-format";
    chipFmt.textContent = isVideo ? "🎬 Vídeo" : "🖼 Imagem";
    container.append(chipFmt);
  }

  function baixarMidiaDoCard(card, id, status) {
    const ssr = obterDadosSSR(id);
    let mediaUrl = ssr?.video_hd_url || ssr?.video_sd_url;
    let isVideo = Boolean(mediaUrl);

    if (!mediaUrl && typeof card.querySelector === "function") {
      const video = card.querySelector("video");
      if (video) {
        mediaUrl = video.currentSrc || video.src || video.querySelector("source")?.src;
        if (mediaUrl) isVideo = true;
      }
    }

    if (!mediaUrl && typeof card.querySelectorAll === "function") {
      const imgs = [...card.querySelectorAll("img")].filter(
        (img) => (img.naturalWidth > 150 || img.getBoundingClientRect().width > 150) &&
          !img.src.includes("avatar") &&
          !img.src.includes("rsrc.php")
      );
      if (imgs.length) {
        mediaUrl = imgs[0].currentSrc || imgs[0].src;
        isVideo = false;
      }
    }

    if (!mediaUrl) {
      status.textContent = "Nenhuma mídia encontrada para download neste card.";
      return;
    }

    const ext = isVideo ? "mp4" : (mediaUrl.includes(".png") ? "png" : "jpg");
    const filename = `trackbase-ad-${id || Date.now()}.${ext}`;

    try {
      const a = document.createElement("a");
      a.href = mediaUrl;
      a.download = filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      status.textContent = "Download do criativo iniciado!";
    } catch {
      window.open(mediaUrl, "_blank");
      status.textContent = "Abrindo mídia em nova aba para salvar…";
    }
  }

  function montarUrlPaginaAnunciante(pageId) {
    return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=${pageId}`;
  }

  async function obterPageIdReal(urlAnuncio) {
    try {
      if (!urlAnuncio || !/[?&]id=\d+/.test(urlAnuncio)) return null;
      const resposta = await fetch(urlAnuncio, { credentials: "include" });
      const html = await resposta.text();
      const padroes = [
        /"page_id"\s*:\s*"?(\d+)"?/,
        /view_all_page_id=(\d+)/,
        /page_id=(\d+)/,
      ];
      for (const regex of padroes) {
        const encontrado = html.match(regex);
        if (encontrado) return encontrado[1];
      }
      return null;
    } catch {
      return null;
    }
  }

  function abrirPaginaDoAnunciante(card, id) {
    const ssr = obterDadosSSR(id);
    const pageId = ssr?.page_id;

    // 1. Se page_id numérico confiável já veio do SSR, abre diretamente
    if (pageId && /^\d+$/.test(String(pageId))) {
      window.open(montarUrlPaginaAnunciante(pageId), "_blank", "noopener,noreferrer");
      return;
    }

    // 2. Se o próprio card tem link com view_all_page_id ou page_id no DOM
    if (typeof card.querySelectorAll === "function") {
      const links = card.querySelectorAll('a[href*="view_all_page_id="], a[href*="page_id="]');
      for (const a of links) {
        try {
          const u = new URL(a.href);
          const candidate = u.searchParams.get("view_all_page_id") || u.searchParams.get("page_id");
          if (candidate && /^\d+$/.test(candidate)) {
            window.open(montarUrlPaginaAnunciante(candidate), "_blank", "noopener,noreferrer");
            return;
          }
        } catch { /* skip */ }
      }
    }

    // 3. Fallback idêntico ao Jeen:
    // Abre a aba de imediato para manter a permissão de clique do usuário
    // e atualiza a URL assim que confirmar o page_id real via snapshot do anúncio
    const janela = window.open("about:blank", "_blank");
    const linkDetalhes = typeof card.querySelector === "function"
      ? card.querySelector('a[href*="/ads/library/?id="], a[href*="snapshot"]')
      : null;
    const urlAnuncio = linkDetalhes?.href || (id ? `https://www.facebook.com/ads/library/?id=${id}` : window.location.href);

    obterPageIdReal(urlAnuncio).then((idReal) => {
      if (!janela || janela.closed) return;
      if (idReal) {
        janela.location.href = montarUrlPaginaAnunciante(idReal);
      } else {
        const termo = ssr?.page_name || card.querySelector('h2, h3, a[role="link"]')?.innerText?.trim() || "";
        if (termo) {
          janela.location.href = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=keyword_unordered&q=${encodeURIComponent(termo)}`;
        } else {
          janela.location.href = "https://www.facebook.com/ads/library/";
        }
      }
    });
  }

  async function enviarMensagem(mensagem) {
    if (
      typeof chrome === "undefined" ||
      !chrome?.runtime ||
      typeof chrome.runtime.sendMessage !== "function"
    ) {
      throw new Error("Extensão atualizada. Dê F5 nesta página para reconectar.");
    }
    try {
      return await chrome.runtime.sendMessage(mensagem);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || "");
      if (
        msg.includes("Extension context invalidated") ||
        msg.includes("context invalidated") ||
        msg.includes("Cannot read properties of undefined")
      ) {
        throw new Error("Extensão atualizada. Dê F5 nesta página para reconectar.");
      }
      throw err;
    }
  }

  function scan() {
    for (const card of TrackbaseParser.cards(document)) {
      const id = TrackbaseParser.idFromText(card.innerText || "");
      const existing = card.querySelector("[data-trackbase-controls]");
      if (existing?.dataset.adId === id) continue;
      existing?.remove(); // Only replaces the extension's own controls when Meta recycles a card.

      const controls = document.createElement("div");
      controls.dataset.trackbaseControls = "true";
      controls.dataset.adId = id || "";

      // child 0: Salvar no Trackbase (Roxo)
      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.textContent = "⚡ Salvar no Trackbase";
      saveBtn.className = "trackbase-btn-save";

      // child 1: Registrar verificação (Verde)
      const verifyBtn = document.createElement("button");
      verifyBtn.type = "button";
      verifyBtn.textContent = "Registrar verificação";
      verifyBtn.className = "trackbase-btn-verify";

      // child 2: status
      const status = document.createElement("span");
      status.setAttribute("role", "status");
      status.className = "trackbase-status";

      // child 3: Baixar criativo
      const downloadBtn = document.createElement("button");
      downloadBtn.type = "button";
      downloadBtn.textContent = "⬇️ Baixar criativo";
      downloadBtn.className = "trackbase-btn-secondary";
      downloadBtn.title = "Baixar vídeo ou imagem original deste anúncio";
      downloadBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        baixarMidiaDoCard(card, id, status);
      });

      // child 4: Ver anunciante
      const advertiserBtn = document.createElement("button");
      advertiserBtn.type = "button";
      advertiserBtn.textContent = "🔍 Ver anunciante";
      advertiserBtn.className = "trackbase-btn-secondary";
      advertiserBtn.title = "Ver todos os anúncios ativos deste anunciante na Meta Ads Library";
      advertiserBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        abrirPaginaDoAnunciante(card, id);
      });

      // child 5: Container de Sinais (Dias ativo, formato, quantidade)
      const signalsContainer = document.createElement("div");
      signalsContainer.className = "trackbase-ad-signals";
      montarSinais(card, id, signalsContainer);

      saveBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        saveBtn.disabled = true;
        status.textContent = "Salvando no Trackbase…";
        try {
          const capture = TrackbaseParser.capture(card);
          const ssr = obterDadosSSR(id);
          if (!capture.page_id && ssr?.page_id) {
            capture.page_id = String(ssr.page_id);
          }
          if (ssr?.page_name && (!capture.advertiser || capture.advertiser === "Anunciante Ad Library")) {
            capture.advertiser = ssr.page_name;
          }
          const result = await enviarMensagem({
            action: "capture",
            capture,
            snapshot: false,
          });
          if (result?.error) throw new Error(result.error);
          status.textContent = result?.data?.duplicate
            ? "Anúncio já salvo neste workspace."
            : "Salvo no workspace selecionado.";
        } catch (e) {
          status.textContent = e.message || "Falha ao salvar. Reabra a extensão.";
        } finally {
          saveBtn.disabled = false;
        }
      });

      verifyBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        verifyBtn.disabled = true;
        status.textContent = "Registrando verificação…";
        try {
          const capture = TrackbaseParser.capture(card);
          const ssr = obterDadosSSR(id);
          if (!capture.page_id && ssr?.page_id) {
            capture.page_id = String(ssr.page_id);
          }
          if (ssr?.page_name && (!capture.advertiser || capture.advertiser === "Anunciante Ad Library")) {
            capture.advertiser = ssr.page_name;
          }
          const result = await enviarMensagem({
            action: "capture",
            capture,
            snapshot: true,
          });
          if (result?.error) throw new Error(result.error);
          status.textContent = "Verificação registrada com sucesso.";
        } catch (e) {
          status.textContent = e.message || "Falha ao registrar verificação.";
        } finally {
          verifyBtn.disabled = false;
        }
      });

      controls.append(saveBtn);
      controls.append(verifyBtn);
      controls.append(status);
      controls.append(downloadBtn);
      controls.append(advertiserBtn);
      controls.append(signalsContainer);

      card.append(controls);
    }
  }

  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 350);
  });
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
  scan();
})();

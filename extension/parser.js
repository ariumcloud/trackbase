// Isolated DOM adapter. No GraphQL, embedded scripts, cookies, or hidden page state.
(function (root) {
  const selectors = {
    actions: 'a,button,div[role="button"]',
    links: "a[href]",
    text: '[dir="auto"]',
    headline: 'h2,h3,[role="heading"]',
    video: "video",
    images: "img",
  };
  const visible = (el) =>
    Boolean(el?.getClientRects().length) &&
    getComputedStyle(el).visibility !== "hidden";
  const idFromText = (text) =>
    (text.match(
      /(?:Library ID|ID da biblioteca|Identifica(?:ç|c)[aã]o da biblioteca)\s*:?\s*(\d{5,40})/i,
    ) || [])[1] || null;
  function safeUrl(value) {
    try {
      const u = new URL(value);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        /^(localhost|.*\.local|.*\.internal|\[.*\]|[\d.]+)$/.test(u.hostname)
      )
        return null;
      return u.href;
    } catch {
      return null;
    }
  }
  function destination(value) {
    try {
      const u = new URL(value);
      if (["l.facebook.com", "lm.facebook.com"].includes(u.hostname))
        return safeUrl(u.searchParams.get("u"));
      if (u.hostname === "facebook.com" || u.hostname.endsWith(".facebook.com"))
        return null;
      return safeUrl(value);
    } catch {
      return null;
    }
  }
  function startDate(text) {
    const m = text.match(
      /(?:Started running on|Veicula(?:ç|c)[aã]o iniciada em|Come(?:ç|c)ou a veicular em)\s+(\d{1,2})\s+(?:de\s+)?([a-zç.]+)\s+(?:de\s+)?(\d{4})/i,
    );
    const months = [
      "jan",
      "fev|feb",
      "mar",
      "abr|apr",
      "mai|may",
      "jun",
      "jul",
      "ago|aug",
      "set|sep",
      "out|oct",
      "nov",
      "dez|dec",
    ];
    if (!m) return null;
    const month = months.findIndex((v) =>
      new RegExp(`^(${v})`, "i").test(m[2]),
    );
    if (month < 0) return null;
    const value = `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value &&
      value <= new Date().toISOString().slice(0, 10)
      ? value
      : null;
  }
  function cardFor(anchor) {
    let node = anchor.parentElement,
      fallback = null;
    for (
      let depth = 0;
      node && depth < 12;
      depth++, node = node.parentElement
    ) {
      if (["BODY", "HTML"].includes(node.tagName)) break;
      const text = node.innerText || "";
      const ids = [
        ...text.matchAll(
          /(?:Library ID|ID da biblioteca|Identifica(?:ç|c)[aã]o da biblioteca)\s*:?\s*(\d{5,40})/gi,
        ),
      ];
      if (ids.length > 1) break;
      if (ids.length === 1) {
        fallback ||= node;
        const page = [...node.querySelectorAll(selectors.links)].find((a) => {
          try {
            const u = new URL(a.href);
            return (
              visible(a) &&
              /^(www\.)?facebook\.com$/.test(u.hostname) &&
              !u.pathname.startsWith("/ads/") &&
              Boolean(a.innerText?.trim())
            );
          } catch {
            return false;
          }
        });
        if (page) return node;
      }
    }
    return fallback;
  }
  function cards(document) {
    const found = new Set();
    for (const a of document.querySelectorAll(selectors.actions)) {
      if (
        !visible(a) ||
        !/^(See ad details|See summary|Ver detalhes do anúncio|Ver resumo)$/i.test(
          a.innerText?.trim() || "",
        )
      )
        continue;
      const card = cardFor(a);
      if (card) found.add(card);
    }
    return [...found];
  }
  function capture(card) {
    const text = card.innerText || "";
    const links = [...card.querySelectorAll(selectors.links)].filter(visible);
    let library_id = idFromText(text);
    for (const a of links) {
      try {
        const u = new URL(a.href);
        if (
          /^(www\.)?facebook\.com$/.test(u.hostname) &&
          u.pathname.startsWith("/ads/library") &&
          /^\d{5,40}$/.test(u.searchParams.get("id") || "")
        )
          library_id ||= u.searchParams.get("id");
      } catch {
        /* Missing link */
      }
    }
    if (!library_id)
      throw new Error(
        "Anúncio sem ID suficiente. Abra os detalhes e tente novamente.",
      );
    const page = links.find((a) => {
      try {
        const u = new URL(a.href);
        return (
          /^(www\.)?facebook\.com$/.test(u.hostname) &&
          !u.pathname.startsWith("/ads/") &&
          Boolean(a.innerText?.trim())
        );
      } catch {
        return false;
      }
    });
    const advertiser = page?.innerText?.trim().slice(0, 300);
    if (!advertiser)
      throw new Error("Anunciante não identificado. Abra os detalhes.");
    let page_id = null;
    if (page) {
      const u = new URL(page.href);
      const candidate =
        u.searchParams.get("id") || u.pathname.match(/\/(\d+)\/?$/)?.[1];
      if (/^\d{1,40}$/.test(candidate || "")) page_id = candidate;
    }
    const media = [];
    for (const video of card.querySelectorAll(selectors.video))
      if (visible(video)) {
        const url = safeUrl(video.currentSrc || video.src);
        if (url) media.push({ url, type: "video", temporary: true });
      }
    if (!media.length)
      for (const img of card.querySelectorAll(selectors.images))
        if (
          visible(img) &&
          img.getBoundingClientRect().width >= 150 &&
          img.getBoundingClientRect().height >= 100
        ) {
          const url = safeUrl(img.currentSrc || img.src);
          if (url) media.push({ url, type: "image", temporary: true });
        }
    const chunks = [...card.querySelectorAll(selectors.text)]
      .filter(
        (el) =>
          visible(el) &&
          !el.closest("[data-trackbase-controls]") &&
          !el.querySelector(selectors.text),
      )
      .map((el) => el.innerText?.trim() || "")
      .filter(
        (t) =>
          t &&
          t !== advertiser &&
          !/^(Library ID|ID da biblioteca|Active$|Ativo$|Inactive$|Inativo$|See ad|Ver detalhes|Plataformas|Platforms|Started running|Veiculação iniciada)/i.test(
            t,
          ),
      );
    const start_date = startDate(text);
    const days_active =
      start_date && /(?:^|\n)(?:Active|Ativo)\s*(?:\n|$)/i.test(text)
        ? Math.max(
            0,
            Math.floor((Date.now() - Date.parse(start_date)) / 86400000),
          )
        : null;
    const platforms = [
      "Facebook",
      "Instagram",
      "Messenger",
      "Audience Network",
      "Threads",
    ].filter((p) =>
      [...card.querySelectorAll("[aria-label],img[alt]")].some(
        (el) =>
          visible(el) &&
          [el.getAttribute("aria-label"), el.getAttribute("alt")].includes(p),
      ),
    );
    const headline =
      [...card.querySelectorAll(selectors.headline)]
        .find(visible)
        ?.innerText?.trim()
        .slice(0, 1000) || "";
    return {
      library_id,
      advertiser,
      page_name: advertiser,
      page_id,
      copy: chunks.join("\n").slice(0, 16000),
      headline,
      landing_url: links.map((a) => destination(a.href)).find(Boolean) || null,
      media: media.slice(0, 20),
      format: /dynamic creative|criativo dinâmico/i.test(text)
        ? "dynamic"
        : /carousel|carrossel/i.test(text)
          ? "carousel"
          : media.some((m) => m.type === "video") ||
              [...card.querySelectorAll(selectors.video)].some(visible)
            ? "video"
            : media.length
              ? "image"
              : "unknown",
      platforms,
      start_date,
      days_active,
      activity: /(?:^|\n)(?:Inactive|Inativo)\s*(?:\n|$)/i.test(text)
        ? "inactive"
        : /(?:^|\n)(?:Active|Ativo)\s*(?:\n|$)/i.test(text)
          ? "active"
          : "unknown",
      related_count:
        Number(text.match(/(\d+)\s+(?:ads use|anúncios usam)/i)?.[1]) || null,
    };
  }
  root.TrackbaseParser = {
    selectors,
    cards,
    capture,
    idFromText,
    safeUrl,
    destination,
    startDate,
  };
})(globalThis);

# Regra de checkout por URL

O IC do tracker é validado pela URL real do destino. A oferta fornece `checkout_url`; o servidor publica somente essas regras e continua validando o evento antes de gravar. O tracker não usa texto do botão como evidência de checkout.

Uma regra sem esquema recebe HTTPS. Host é comparado exatamente (ou por subdomínio somente quando a regra já o declara), com protocolo seguro, porta e caminho. Uma barra final permite subcaminhos do mesmo caminho. Parâmetros de atribuição como UTM, `fbclid`, `sck` e `xcod` são ignorados na comparação; parâmetros de negócio configurados permanecem obrigatórios.

O fluxo universal consulta todas as ofertas ativas. Uma única compatibilidade resolve a oferta; zero ou múltiplas compatibilidades falham de forma segura. Chaves públicas ligadas a uma oferta não podem trocar de oferta por payload do navegador.

`cta_view` continua sendo visibilidade. `cta_click` registra interação sem destino de checkout. Formulários e `window.open` só viram IC após a URL ser compatível. Popups bloqueados não são contados; `noopener`/`noreferrer` são tratados como exceção porque navegadores podem retornar `null` mesmo abrindo a aba.

Para configurar: abra a oferta, preencha o domínio/caminho real que aparece no checkout (por exemplo `https://pay.wiapy.com/`), salve, publique a landing com a chave pública e teste um clique. O painel deve mostrar o evento com a oferta correta. O backend continua sendo a fonte de validação, então um payload fraudulento não cria IC.

/* ==========================================================================
   Duck Dodgers — protótipo de loja
   Organização: dados -> utilidades -> estado -> toast -> overlays ->
   cabeçalho/vídeo/busca -> marquee -> catálogo -> produto -> sacola ->
   checkout -> formulário -> revelação -> rotas -> boot.

   Decisões que corrigem bugs do protótipo anterior:
   - Todo dinheiro é inteiro em centavos. Nada de somar floats e ver
     "R$ 118,99999" ou parcela que não fecha o total.
   - A sacola é indexada por chave "id:tamanho", não por posição no array
     (remover um item deslocava os índices dos botões +/- restantes).
   - O carrinho vindo do localStorage é validado: id inexistente, tamanho
     inválido ou qty NaN eram capazes de derrubar a página no primeiro render.
   - Frete grátis usa a MESMA base do cálculo real (subtotal já com cupom),
     então a barra nunca diz "liberado" e cobra R$ 24,90 na linha seguinte.
   - Sacola e checkout têm foco preso, foco devolvido, rolagem travada e
     `inert` no resto da página.
   - Tema único e claro: não há alternância nem leitura de preferência do
     sistema, então nada de `data-theme` nem de bloco de tokens escuros.
   - O vídeo do hero é decorativo e mudo; com `prefers-reduced-motion`
     ligado no sistema ele nem chega a tocar, ficando só o poster.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     1. Dados
     ------------------------------------------------------------------------ */
  var VIEWS = ["front", "q34", "side", "q34b", "back"];
  var VIEW_LABEL = {
    front: "de frente",
    q34: "em três quartos",
    side: "de perfil",
    q34b: "em três quartos de costas",
    back: "de costas"
  };

  var SIZES = {
    mini: { nome: "Mini", detalhe: "65 mm", peso: "~68 g" },
    grande: { nome: "Grande", detalhe: "100 mm", peso: "~210 g" }
  };

  var CATEGORIAS = [
    { id: "all", nome: "Todos" },
    { id: "tatico", nome: "Tático" },
    { id: "faroeste", nome: "Faroeste" },
    { id: "disfarce", nome: "Disfarce" }
  ];

  /* preços em centavos; `de` = preço antigo, null quando não há desconto */
  var PRODUTOS = [
    {
      id: "cyber",
      nome: "Cyber Duck",
      cat: "tatico",
      catNome: "Tático",
      tagline: "Visor fumê, mochila de dados e uma paciência curta.",
      tag: "Mais vendido",
      rank: 3,
      desc: "O pato que entrou no turno da noite e nunca mais saiu. Armadura em placas chanfradas, headset com almofada circular e duas antenas que sobem retas — tudo modelado em bloco cheio, sem peça colada depois.",
      cores: [["Amarelo", "#FDC024"], ["Cinza escuro", "#4A4A4C"], ["Laranja", "#F0591B"], ["Preto", "#161616"]],
      precos: { mini: 11900, grande: 18900 },
      de: { mini: 13900, grande: null },
      specs: {
        "Altura (mini)": "65 mm",
        "Altura (grande)": "100 mm",
        "Peso": "71 g",
        "Tempo de impressão": "9 h 40 min",
        "Trocas de cor": "412",
        "Altura de camada": "0,12 mm",
        "Material": "PLA Basic"
      }
    },
    {
      id: "sheriff",
      nome: "Sheriff Duck",
      cat: "faroeste",
      catNome: "Faroeste",
      tagline: "Chapéu, estrela e um coldre que nunca foi usado.",
      tag: "Novo",
      rank: 2,
      desc: "Distintivo de cinco pontas em relevo, bandana com nó real modelado e cinturão com fivela vazada. O chapéu tem aba levemente curvada para imprimir sem suporte — o truque que segura a peça de pé.",
      cores: [["Amarelo", "#FDC024"], ["Marrom", "#7A5033"], ["Laranja", "#F0591B"], ["Vermelho", "#C4342B"]],
      precos: { mini: 10900, grande: 17900 },
      de: { mini: null, grande: null },
      specs: {
        "Altura (mini)": "65 mm",
        "Altura (grande)": "100 mm",
        "Peso": "68 g",
        "Tempo de impressão": "8 h 55 min",
        "Trocas de cor": "388",
        "Altura de camada": "0,12 mm",
        "Material": "PLA Basic"
      }
    },
    {
      id: "agent",
      nome: "Agent Duck",
      cat: "disfarce",
      catNome: "Disfarce",
      tagline: "Terno preto, maleta fechada, zero perguntas.",
      tag: "",
      rank: 1,
      desc: "Lapela com vinco, gravata em duas camadas e maleta com alça separada do corpo. É o mais limpo de imprimir da coleção: quatro cores, nenhuma ponte acima de 3 mm e base larga que dispensa brim.",
      cores: [["Amarelo", "#FDC024"], ["Branco", "#F2F2F0"], ["Laranja", "#F0591B"], ["Preto", "#161616"]],
      precos: { mini: 9900, grande: 16900 },
      de: { mini: 12900, grande: null },
      specs: {
        "Altura (mini)": "65 mm",
        "Altura (grande)": "100 mm",
        "Peso": "66 g",
        "Tempo de impressão": "8 h 20 min",
        "Trocas de cor": "356",
        "Altura de camada": "0,12 mm",
        "Material": "PLA Basic"
      }
    }
  ];

  PRODUTOS.forEach(function (p) { p.tag = ""; p.de = {mini: null, grande: null}; });
  var FRETE_CENTS = 2490;
  var FRETE_GRATIS_CENTS = 25000;
  var PIX_OFF = 0.05;
  var MAX_QTY = 20;
  var CUPONS = { PATO10: 0.10, PRIMEIRA15: 0.15 };
  var STORAGE = { cart: "dd_cart_v2" };

  /* ------------------------------------------------------------------------
     2. Utilidades
     ------------------------------------------------------------------------ */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  /* dinheiro sempre em centavos -> string pt-BR */
  function brl(cents) {
    return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function produtoPorId(id) {
    for (var i = 0; i < PRODUTOS.length; i++) { if (PRODUTOS[i].id === id) return PRODUTOS[i]; }
    return null;
  }

  function imgSrc(id, view) { return "img/" + id + "_" + view + ".webp"; }

  function lineKey(id, size) { return id + ":" + size; }

  function readStorage(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStorage(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* modo privado */ }
  }

  /* ------------------------------------------------------------------------
     3. Estado
     ------------------------------------------------------------------------ */
  var state = {
    cart: [],          /* [{ id, size, qty }] */
    cupom: null,
    filtro: "all",
    ordem: "rel",
    busca: "", priceLimit: 0, favoritesOnly: false
  };

  /* Sanitiza o que veio do localStorage. Sem isto, um id removido do catálogo
     fazia `produtoPorId(...).precos` estourar antes da página aparecer. */
  function carregarCarrinho() {
    var bruto;
    try { bruto = JSON.parse(readStorage(STORAGE.cart) || "[]"); } catch (e) { return []; }
    if (!Array.isArray(bruto)) return [];

    var mapa = {};
    var limpo = [];
    bruto.slice(0, 50).forEach(function (l) {
      if (!l || typeof l !== "object") return;
      if (!produtoPorId(l.id) || !SIZES[l.size]) return;
      var qty = clamp(parseInt(l.qty, 10) || 1, 1, MAX_QTY);
      var k = lineKey(l.id, l.size);
      if (mapa[k]) { mapa[k].qty = clamp(mapa[k].qty + qty, 1, MAX_QTY); return; }
      mapa[k] = { id: l.id, size: l.size, qty: qty };
      limpo.push(mapa[k]);
    });
    return limpo;
  }

  function salvarCarrinho() { writeStorage(STORAGE.cart, JSON.stringify(state.cart)); }

  function acharLinha(id, size) {
    for (var i = 0; i < state.cart.length; i++) {
      if (state.cart[i].id === id && state.cart[i].size === size) return state.cart[i];
    }
    return null;
  }

  /* Uma única função decide todos os valores. Antes, a barra de frete grátis
     usava o subtotal cru e o cálculo do frete usava o subtotal com cupom —
     a sacola dizia "frete grátis liberado" e cobrava R$ 24,90 logo abaixo. */
  function calcularTotais(pagamento) {
    var subtotal = state.cart.reduce(function (soma, l) {
      return soma + produtoPorId(l.id).precos[l.size] * l.qty;
    }, 0);

    var taxa = state.cupom ? CUPONS[state.cupom] : 0;
    var descontoCupom = Math.round(subtotal * taxa);
    var mercadoria = subtotal - descontoCupom;

    var descontoPix = pagamento === "pix" ? Math.round(mercadoria * PIX_OFF) : 0;
    var freteGratis = mercadoria >= FRETE_GRATIS_CENTS;
    var frete = freteGratis ? 0 : FRETE_CENTS;

    return {
      subtotal: subtotal,
      descontoCupom: descontoCupom,
      descontoPix: descontoPix,
      mercadoria: mercadoria,
      frete: frete,
      freteGratis: freteGratis,
      faltaParaFrete: Math.max(0, FRETE_GRATIS_CENTS - mercadoria),
      progresso: clamp(Math.round(mercadoria / FRETE_GRATIS_CENTS * 100), 0, 100),
      total: mercadoria - descontoPix + frete,
      itens: state.cart.reduce(function (s, l) { return s + l.qty; }, 0)
    };
  }

  /* ------------------------------------------------------------------------
     4. Toast
     ------------------------------------------------------------------------ */
  var toastEl = $("#toast");
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-open");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toastEl.classList.remove("is-open"); }, 3000);
  }

  /* ------------------------------------------------------------------------
     5. Overlays: foco preso, foco devolvido, rolagem travada
     ------------------------------------------------------------------------ */
  var appRoot = $("#appRoot");
  var viewHome = $("#viewHome");
  var viewProduct = $("#viewProduct");
  var pilha = [];
  var FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

  function focaveis(el) {
    return $$(FOCUSABLE, el).filter(function (n) {
      return n.offsetWidth > 0 || n.offsetHeight > 0 || n === document.activeElement;
    });
  }

  function abrirOverlay(el, fechar, focoInicial) {
    if (pilha.some(function (o) { return o.el === el; })) return;
    pilha.push({ el: el, fechar: fechar, devolver: document.activeElement });
    document.body.classList.add("is-locked");
    appRoot.setAttribute("inert", "");
    el.removeAttribute("aria-hidden");
    window.setTimeout(function () {
      var alvo = focoInicial || focaveis(el)[0];
      if (alvo) alvo.focus();
    }, 60);
  }

  function fecharOverlay(el) {
    var i = -1;
    pilha.forEach(function (o, idx) { if (o.el === el) i = idx; });
    if (i === -1) return;
    var o = pilha.splice(i, 1)[0];
    if (!pilha.length) {
      document.body.classList.remove("is-locked");
      appRoot.removeAttribute("inert");
    }
    el.setAttribute("aria-hidden", "true");
    if (o.devolver && document.contains(o.devolver)) o.devolver.focus();
  }

  document.addEventListener("keydown", function (e) {
    if (!pilha.length) return;
    var topo = pilha[pilha.length - 1];

    /* Escape fecha só o overlay do topo — antes, uma tecla fechava sacola
       e checkout ao mesmo tempo. */
    if (e.key === "Escape") { e.preventDefault(); topo.fechar(); return; }

    if (e.key !== "Tab") return;
    var lista = focaveis(topo.el);
    if (!lista.length) { e.preventDefault(); return; }
    var primeiro = lista[0];
    var ultimo = lista[lista.length - 1];

    if (e.shiftKey && (document.activeElement === primeiro || !topo.el.contains(document.activeElement))) {
      e.preventDefault(); ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault(); primeiro.focus();
    }
  });

  /* ------------------------------------------------------------------------
     6. Cabeçalho flutuante, vídeo do hero, menu móvel e busca
     ------------------------------------------------------------------------ */
  var header = $("#header");
  var menu = $("#mobileMenu");
  var menuBtn = $("#burger");
  var heroVideo = $("#heroVideo");
  var mqReduzido = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* O cabecalho so vira solido quando o hero sai de baixo dele. Enquanto o
     video estiver atras, ele fica transparente — dai o menu "flutuando". */
  function sincronizarHeader() {
    var hero = viewHome.hidden ? null : $(".hero");
    /* Sem hero atras (pagina de produto), o cabecalho e sempre solido: o
       estado transparente usa texto claro, que sumiria no fundo claro. */
    var solido = hero
      ? hero.getBoundingClientRect().bottom <= header.offsetHeight + 4
      : true;
    header.classList.toggle("is-stuck", solido);
  }

  window.addEventListener("scroll", sincronizarHeader, { passive: true });
  window.addEventListener("resize", sincronizarHeader, { passive: true });

  /* Video do hero: decorativo, mudo e em loop, sem controles.
     Quem pediu menos movimento no sistema recebe so o poster. Nao basta
     chamar pause() na carga: o autoplay ainda nem comecou, entao o pause
     nao pega nada e o video sobe assim que os dados chegam. O jeito
     confiavel e barrar todo play enquanto a preferencia estiver ligada. */
  if (heroVideo && mqReduzido.matches) {
    heroVideo.autoplay = false;
    heroVideo.removeAttribute("autoplay");
    heroVideo.addEventListener("play", function () { heroVideo.pause(); });
    heroVideo.pause();
  }

  /* Menu movel. O `hidden` some antes de animar; sem forcar um reflow entre
     as duas coisas o navegador junta tudo num quadro so e a transicao nao
     chega a rodar. */
  function abrirMenu() {
    menu.hidden = false;
    void menu.offsetHeight;
    menu.classList.add("is-open");
    menuBtn.setAttribute("aria-expanded", "true");
    abrirOverlay(menu, fecharMenu);
  }

  function fecharMenu() {
    menu.classList.remove("is-open");
    menuBtn.setAttribute("aria-expanded", "false");
    fecharOverlay(menu);
    window.setTimeout(function () {
      if (!menu.classList.contains("is-open")) menu.hidden = true;
    }, 260);
  }

  menuBtn.addEventListener("click", abrirMenu);
  $("#closeMenu").addEventListener("click", fecharMenu);
  menu.addEventListener("click", function (e) {
    if (e.target.closest("a")) fecharMenu();
  });

  /* A busca existia so no desktop: abaixo de 960 px o campo era escondido e
     nao havia nenhum outro caminho para ela. Agora ha um campo no menu movel
     e os dois ficam sincronizados. */
  var buscaTimer;
  function ligarBusca(input) {
    input.addEventListener("input", function () {
      var valor = this.value;
      $$(".js-search").forEach(function (outro) {
        if (outro !== input) outro.value = valor;
      });
      window.clearTimeout(buscaTimer);
      buscaTimer = window.setTimeout(function () {
        state.busca = valor;
        renderGrid();
        if (rotaAtual() === "produto") location.hash = "#colecao";
      }, 180);
    });
  }
  $$(".js-search").forEach(ligarBusca);

  /* ------------------------------------------------------------------------
     7. Marquee
     ------------------------------------------------------------------------ */
  (function () {
    var itens = [
      "Frete grátis acima de R$ 250",
      "Impresso sob demanda em São Paulo",
      "4 cores reais no filamento",
      "Reimpressão garantida por 30 dias",
      "Embalagem sem plástico",
      "Pix com 5% de desconto"
    ];
    var grupo = '<span class="marquee__group">' +
      itens.map(function (i) { return "<span>" + esc(i) + " &bull;</span>"; }).join("") +
      "</span>";
    /* o grupo é duplicado para o loop de -50% ficar contínuo; o conjunto todo
       é aria-hidden para o leitor de tela não ler a lista duas vezes */
    $("#marquee").innerHTML = grupo + grupo;
  }());

  /* ------------------------------------------------------------------------
     8. Catálogo
     ------------------------------------------------------------------------ */
  var gridEl = $("#grid");
  var countEl = $("#resultCount");

  function savedIds(key) {
    try { var ids = JSON.parse(readStorage(key) || "[]"); return Array.isArray(ids) ? ids.filter(function(id, i) { return typeof id === "string" && produtoPorId(id) && ids.indexOf(id) === i; }).slice(0, 20) : []; } catch(e) { return []; }
  }
  var favorites = savedIds("dd_favorites_v1");
  var recent = savedIds("dd_recent_v1");
  function favoriteHTML(p) { return '<button type="button" class="favorite-btn" data-favorite="' + p.id + '" aria-pressed="' + (favorites.indexOf(p.id) !== -1) + '" aria-label="Favoritar ' + esc(p.nome) + '">♡</button>'; }
  function renderRecent() { $("#recentSection").hidden = !recent.length; $("#recentGrid").innerHTML = recent.map(produtoPorId).map(cardHTML).join(""); }
  function cardHTML(p) {
    var swatches = p.cores.map(function (c) {
      return '<i style="background:' + esc(c[1]) + '"></i>';
    }).join("");

    return '<li class="card">' +
      '<div class="card__media">' + favoriteHTML(p) +
        (p.tag ? '<span class="card__tag">' + esc(p.tag) + "</span>" : "") +
        '<img src="' + imgSrc(p.id, "front") + '" alt="' + esc(p.nome) + ', visto de frente" width="860" height="860" loading="lazy" decoding="async">' +
        '<span class="swatches" aria-hidden="true">' + swatches + "</span>" +
      "</div>" +
      '<div class="card__body">' +
        '<h3><a class="card__link" href="#/p/' + esc(p.id) + '">' + esc(p.nome) + "</a></h3>" +
        '<p class="card__sub">' + esc(p.tagline) + "</p>" +
        '<div class="card__foot">' +
          '<span class="price"><small>A partir de</small>' + brl(p.precos.mini) + "<small>tamanho mini &middot; 65 mm</small></span>" +
          '<a class="card__add" href="#/p/' + esc(p.id) + '">Escolher tamanho<span class="sr-only"> de ' + esc(p.nome) + '</span></a>' +
        "</div>" +
      "</div></li>";
  }

  function renderGrid() {
    $("#favoriteCount").textContent = favorites.length;
    var termo = state.busca.trim().toLowerCase();

    var lista = PRODUTOS.filter(function (p) {
      var passaFiltro = state.filtro === "all" || p.cat === state.filtro;
      var alvo = (p.nome + " " + p.tagline + " " + p.catNome + " " + p.desc).toLowerCase();
      return passaFiltro && (!state.priceLimit || p.precos.mini <= state.priceLimit) && (!state.favoritesOnly || favorites.indexOf(p.id) !== -1) && (!termo || alvo.indexOf(termo) > -1);
    });

    lista.sort(function (a, b) {
      if (state.ordem === "asc") return a.precos.mini - b.precos.mini;
      if (state.ordem === "desc") return b.precos.mini - a.precos.mini;
      if (state.ordem === "az") return a.nome.localeCompare(b.nome, "pt-BR");
      return b.rank - a.rank;
    });

    if (lista.length) {
      gridEl.innerHTML = lista.map(cardHTML).join("");
      countEl.textContent = lista.length === 1 ? "1 pato encontrado" : lista.length + " patos encontrados";
    } else {
      gridEl.innerHTML = '<li class="empty"><p>Nenhum pato com esse perfil.</p>' +
        '<button type="button" class="btn btn--ghost" id="clearFilters">Limpar busca e filtros</button></li>';
      countEl.textContent = "Nenhum pato encontrado";
    }
    observarReveal();
  }

  /* Os chips são um grupo de rádio de verdade: um só selecionado, setas do
     teclado navegam e só o ativo fica na ordem de tabulação. */
  var filtrosEl = $("#filters");
  filtrosEl.innerHTML = CATEGORIAS.map(function (c, i) {
    return '<button type="button" role="radio" class="chip" data-filter="' + esc(c.id) + '"' +
      ' aria-checked="' + (i === 0) + '" tabindex="' + (i === 0 ? "0" : "-1") + '">' + esc(c.nome) + "</button>";
  }).join("");

  function selecionarFiltro(btn) {
    state.filtro = btn.dataset.filter;
    $$(".chip", filtrosEl).forEach(function (c) {
      var ativo = c === btn;
      c.setAttribute("aria-checked", String(ativo));
      c.tabIndex = ativo ? 0 : -1;
    });
    btn.focus();
    renderGrid();
  }

  filtrosEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".chip");
    if (btn) selecionarFiltro(btn);
  });

  filtrosEl.addEventListener("keydown", function (e) {
    var passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!passo) return;
    e.preventDefault();
    var chips = $$(".chip", filtrosEl);
    var atual = chips.indexOf(document.activeElement);
    selecionarFiltro(chips[(atual + passo + chips.length) % chips.length]);
  });

  $("#sort").addEventListener("change", function () { state.ordem = this.value; renderGrid(); });

  gridEl.addEventListener("click", function (e) {
    if (e.target.closest("#clearFilters")) {
      resetCatalog();
      state.busca = "";
      $$(".js-search").forEach(function (i) { i.value = ""; });
      selecionarFiltro($(".chip", filtrosEl));
    }
  });


  function resetCatalog() {
    state.priceLimit = 0; state.favoritesOnly = false; state.busca = ""; state.ordem = "rel";
    $("#priceLimit").value = "0"; $("#sort").value = "rel"; $("#favoritesOnly").setAttribute("aria-pressed", "false");
    $$(".js-search").forEach(function(n) { n.value = ""; }); selecionarFiltro($(".chip", filtrosEl));
  }
  $("#priceLimit").addEventListener("change", function() { state.priceLimit = Number(this.value); renderGrid(); });
  $("#favoritesOnly").addEventListener("click", function() { state.favoritesOnly = !state.favoritesOnly; this.setAttribute("aria-pressed", String(state.favoritesOnly)); renderGrid(); });
  $("#resetCatalog").addEventListener("click", resetCatalog);
  $("#clearRecent").addEventListener("click", function() { recent = []; writeStorage("dd_recent_v1", "[]"); renderRecent(); $("#ajuda h2").setAttribute("tabindex", "-1"); $("#ajuda h2").focus(); });
  document.addEventListener("click", function(e) {
    var btn = e.target.closest("[data-favorite]"); if (!btn) return;
    var id = btn.dataset.favorite; var at = favorites.indexOf(id);
    if (at === -1) favorites.push(id); else favorites.splice(at, 1);
    writeStorage("dd_favorites_v1", JSON.stringify(favorites));
    $$("[data-favorite]").forEach(function(n) { n.setAttribute("aria-pressed", String(favorites.indexOf(n.dataset.favorite) !== -1)); });
    $("#favoriteCount").textContent = favorites.length;
    if (state.favoritesOnly) { renderGrid(); if (!document.contains(btn)) $("#favoritesOnly").focus(); }
    toast(at === -1 ? "Salvo nos seus favoritos" : "Removido dos favoritos");
  });

  /* Um único ouvinte para todo botão "Adicionar" da página. */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-add]");
    if (btn) adicionar(btn.dataset.add, "mini", 1);
  });

  /* ------------------------------------------------------------------------
     9. Página de produto
     O protótipo anterior recriava o HTML inteiro a cada clique em tamanho,
     quantidade ou miniatura: a imagem piscava e o foco do teclado sumia.
     Agora o HTML é montado uma vez por produto e depois só é atualizado.
     ------------------------------------------------------------------------ */
  var pdpEl = $("#pdp");
  var pdp = { id: null, view: "front", size: "mini", qty: 1, refs: null };

  function montarPDP(p) {
    var thumbs = VIEWS.map(function (v, i) {
      return '<button type="button" role="radio" class="thumb" data-view="' + v + '"' +
        ' aria-checked="' + (i === 0) + '" tabindex="' + (i === 0 ? "0" : "-1") + '">' +
        '<img src="' + imgSrc(p.id, v) + '" alt="' + esc(p.nome) + " " + esc(VIEW_LABEL[v]) +
        '" width="860" height="860" loading="lazy" decoding="async"></button>';
    }).join("");

    var specs = Object.keys(p.specs).filter(function(k) { return ["Tempo de impressão", "Trocas de cor", "Altura de camada", "Peso"].indexOf(k) === -1; }).map(function (k) {
      return "<dt>" + esc(k) + "</dt><dd>" + esc(p.specs[k]) + "</dd>";
    }).join("");

    var cores = p.cores.map(function (c) {
      return '<li><i style="background:' + esc(c[1]) + '" aria-hidden="true"></i>' + esc(c[0]) + "</li>";
    }).join("");

    var tamanhos = Object.keys(SIZES).map(function (k, i) {
      return '<button type="button" role="radio" class="size" data-size="' + k + '"' +
        ' aria-checked="' + (i === 0) + '" tabindex="' + (i === 0 ? "0" : "-1") + '">' +
        "<b>" + esc(SIZES[k].nome) + "</b><span>" + esc(SIZES[k].detalhe + " · " + SIZES[k].peso) + "</span></button>";
    }).join("");

    var check = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m5 13 4.5 4.5L19 7"/></svg>';

    pdpEl.innerHTML =
      '<a class="back-link" href="#colecao">&larr; Voltar para a coleção</a>' +
      '<div class="pdp">' +
        "<div>" +
          '<div class="gallery__main"><img id="pdpMain" src="' + imgSrc(p.id, "front") + '" alt="' + esc(p.nome) +
            ' ' + esc(VIEW_LABEL.front) + '" width="860" height="860" decoding="async"></div>' +
          '<div class="gallery__thumbs" id="pdpThumbs" role="radiogroup" aria-label="Ângulos da foto">' + thumbs + "</div>" +
        "</div>" +
        "<div>" +
          '<p class="eyebrow">Coleção 01 &middot; ' + esc(p.catNome) + "</p>" +
          "<h1>" + esc(p.nome) + "</h1>" +
          '<p class="pdp__lede">' + esc(p.desc) + "</p>" +
          '<p class="pdp__price" id="pdpPrice"></p>' +
          '<p class="pdp__parcel" id="pdpParcel"></p>' +

          '<h2 class="opt-label" id="lblSize">Tamanho</h2>' +
          '<div class="sizes" id="pdpSizes" role="radiogroup" aria-labelledby="lblSize">' + tamanhos + "</div>" +

          '<h2 class="opt-label" id="lblQty">Quantidade</h2>' +
          '<div class="buy-row">' +
            '<div class="qty">' +
              '<button type="button" id="qtyMinus" aria-label="Diminuir quantidade">&minus;</button>' +
              '<output id="qtyVal" aria-labelledby="lblQty">1</output>' +
              '<button type="button" id="qtyPlus" aria-label="Aumentar quantidade">+</button>' +
            "</div>" +
            '<button type="button" class="btn btn--accent" id="pdpAdd"></button>' +
          "</div>" +

          '<ul class="perks">' +
            "<li>" + check + "Escolha entre dois tamanhos</li>" +
            "<li>" + check + "Confira os detalhes e cuidados abaixo</li>" +
            "<li>" + check + "Compra de demonstração, sem cobrança</li>" +
          "</ul>" +

          '<section class="specs"><h2>Detalhes da peça</h2><dl>' + specs + "</dl></section>" +
          '<h2 class="opt-label">Cores no filamento</h2><ul class="colors">' + cores + "</ul>" +
        "</div>" +
      "</div>";

    pdpEl.insertAdjacentHTML("beforeend", '<div class="product-extras">' + favoriteHTML(p) + '<a class="text-action" href="#sizeGuide">Guia de tamanhos</a><a class="text-action" href="#entrega">Entrega e cuidados</a></div><section class="section"><p class="eyebrow">Turno da Noite</p><h2>Complete a turma</h2><ul class="grid related-grid">' + PRODUTOS.filter(function(other) { return other.id !== p.id; }).map(cardHTML).join("") + '</ul></section>');
    pdp.refs = {
      main: $("#pdpMain"),
      thumbs: $("#pdpThumbs"),
      sizes: $("#pdpSizes"),
      preco: $("#pdpPrice"),
      parcela: $("#pdpParcel"),
      qtyVal: $("#qtyVal"),
      qtyMinus: $("#qtyMinus"),
      qtyPlus: $("#qtyPlus"),
      add: $("#pdpAdd")
    };

    ligarRadiogroup(pdp.refs.thumbs, ".thumb", function (btn) {
      pdp.view = btn.dataset.view;
      atualizarPDP(p);
    });

    ligarRadiogroup(pdp.refs.sizes, ".size", function (btn) {
      pdp.size = btn.dataset.size;
      atualizarPDP(p);
    });

    pdp.refs.qtyMinus.addEventListener("click", function () { mudarQty(p, -1); });
    pdp.refs.qtyPlus.addEventListener("click", function () { mudarQty(p, 1); });
    pdp.refs.add.addEventListener("click", function () { adicionar(p.id, pdp.size, pdp.qty); });
  }

  /* comportamento de radiogroup compartilhado por miniaturas e tamanhos */
  function ligarRadiogroup(container, seletor, onSelect) {
    function selecionar(btn) {
      $$(seletor, container).forEach(function (n) {
        var ativo = n === btn;
        n.setAttribute("aria-checked", String(ativo));
        n.tabIndex = ativo ? 0 : -1;
      });
      btn.focus();
      onSelect(btn);
    }
    container.addEventListener("click", function (e) {
      var btn = e.target.closest(seletor);
      if (btn) selecionar(btn);
    });
    container.addEventListener("keydown", function (e) {
      var passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!passo) return;
      e.preventDefault();
      var nos = $$(seletor, container);
      var atual = nos.indexOf(document.activeElement);
      selecionar(nos[(atual + passo + nos.length) % nos.length]);
    });
  }

  function mudarQty(p, delta) {
    pdp.qty = clamp(pdp.qty + delta, 1, MAX_QTY);
    atualizarPDP(p);
  }

  function atualizarPDP(p) {
    var r = pdp.refs;
    var preco = p.precos[pdp.size];
    var de = p.de[pdp.size];

    r.main.src = imgSrc(p.id, pdp.view);
    r.main.alt = p.nome + " " + VIEW_LABEL[pdp.view];

    var precoHTML = "<b>" + brl(preco) + "</b>";
    if (de && de > preco) {
      precoHTML += "<s>" + brl(de) + '</s><span class="off">&minus;' +
        Math.round((1 - preco / de) * 100) + "%</span>";
    }
    r.preco.innerHTML = precoHTML;

    /* parcela arredondada para cima: 3 x 39,67 cobre 119,00 sem faltar centavo */
    r.parcela.textContent = "em até 3x de " + brl(Math.ceil(preco / 3)) +
      " sem juros · " + brl(Math.round(preco * (1 - PIX_OFF))) + " no Pix";

    r.qtyVal.textContent = String(pdp.qty);
    r.qtyMinus.disabled = pdp.qty <= 1;
    r.qtyPlus.disabled = pdp.qty >= MAX_QTY;

    r.add.textContent = "Adicionar à sacola · " + brl(preco * pdp.qty);
  }

  function renderPDP(id) {
    var p = produtoPorId(id);
    if (!p) { location.hash = "#/"; return; }
    if (pdp.id !== id) {
      pdp.id = id; pdp.view = "front"; pdp.size = "mini"; pdp.qty = 1;
      montarPDP(p);
      recent = [id].concat(recent.filter(function(other) { return other !== id; })).slice(0, 3);
      writeStorage("dd_recent_v1", JSON.stringify(recent)); renderRecent();
    }
    atualizarPDP(p);
    document.title = p.nome + " — Duck Dodgers";
  }

  /* ------------------------------------------------------------------------
     10. Sacola
     ------------------------------------------------------------------------ */
  var drawer = $("#drawer");
  var listaEl = $("#cartList");
  var shipEl = $("#shipBar");
  var footEl = $("#drawerFoot");
  var countBadge = $("#cartCount");
  var liveEl = $("#cartLive");

  function adicionar(id, size, qty) {
    var p = produtoPorId(id);
    if (!p || !SIZES[size]) return;

    var linha = acharLinha(id, size);
    if (linha) linha.qty = clamp(linha.qty + qty, 1, MAX_QTY);
    else state.cart.push({ id: id, size: size, qty: clamp(qty, 1, MAX_QTY) });

    salvarCarrinho();
    renderCart();
    abrirSacola();
    toast(p.nome + " (" + SIZES[size].nome + ") foi para a sacola");
  }

  function mudarLinha(id, size, delta) {
    var linha = acharLinha(id, size);
    if (!linha) return;
    linha.qty = clamp(linha.qty + delta, 1, MAX_QTY);
    salvarCarrinho();
    renderCart();
  }

  function removerLinha(id, size) {
    state.cart = state.cart.filter(function (l) { return !(l.id === id && l.size === size); });
    salvarCarrinho();
    renderCart();
    toast("Item removido da sacola");
  }

  function renderCart() {
    var t = calcularTotais();

    countBadge.textContent = String(t.itens);
    countBadge.hidden = t.itens === 0;
    $("#cartBtn").setAttribute("aria-label", t.itens
      ? "Abrir sacola, " + t.itens + (t.itens === 1 ? " item" : " itens")
      : "Abrir sacola, vazia");
    liveEl.textContent = t.itens ? t.itens + (t.itens === 1 ? " item na sacola" : " itens na sacola") : "";

    if (!state.cart.length) {
      listaEl.innerHTML = '<li class="cart-empty">' +
        '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
        '<path d="M6 7h12l1.2 12.2a1.5 1.5 0 0 1-1.5 1.8H6.3a1.5 1.5 0 0 1-1.5-1.8Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg>' +
        "<p>Sua sacola está vazia.</p>" +
        '<a class="btn btn--ghost" href="#colecao" data-close-cart>Ver a coleção</a></li>';
      shipEl.innerHTML = "<p>Frete grátis a partir de " + brl(FRETE_GRATIS_CENTS) + ".</p>" +
        '<div class="ship-bar__track"><i style="width:0%"></i></div>';
      footEl.innerHTML = '<button type="button" class="btn btn--accent btn--block" disabled>Finalizar compra</button>';
      return;
    }

    listaEl.innerHTML = state.cart.map(function (l) {
      var p = produtoPorId(l.id);
      var nomeItem = p.nome + " tamanho " + SIZES[l.size].nome;
      return '<li class="line">' +
        '<span class="line__media"><img src="' + imgSrc(p.id, "front") + '" alt="" width="860" height="860" loading="lazy"></span>' +
        "<div><b>" + esc(p.nome) + "</b>" +
        '<span class="line__meta">' + esc(SIZES[l.size].nome + " · " + SIZES[l.size].detalhe) + "</span>" +
        '<span class="line__qty">' +
          '<button type="button" data-step="-1" data-id="' + esc(l.id) + '" data-size="' + esc(l.size) + '"' +
            ' aria-label="Diminuir ' + esc(nomeItem) + '"' + (l.qty <= 1 ? " disabled" : "") + ">&minus;</button>" +
          "<output>" + l.qty + "</output>" +
          '<button type="button" data-step="1" data-id="' + esc(l.id) + '" data-size="' + esc(l.size) + '"' +
            ' aria-label="Aumentar ' + esc(nomeItem) + '"' + (l.qty >= MAX_QTY ? " disabled" : "") + ">+</button>" +
        "</span></div>" +
        '<div class="line__right"><div class="line__price">' + brl(p.precos[l.size] * l.qty) + "</div>" +
        '<button type="button" class="line__rm" data-remove data-id="' + esc(l.id) + '" data-size="' + esc(l.size) + '"' +
          ' aria-label="Remover ' + esc(nomeItem) + ' da sacola">remover</button></div>' +
        "</li>";
    }).join("");

    shipEl.innerHTML = "<p>" + (t.faltaParaFrete > 0
      ? "Faltam <b>" + brl(t.faltaParaFrete) + "</b> para o frete grátis."
      : "<b>Frete grátis liberado.</b>") + "</p>" +
      '<div class="ship-bar__track"><i style="width:' + t.progresso + '%"></i></div>';

    /* o valor digitado no cupom é preservado ao re-renderizar */
    var digitado = $("#cupomInput") ? $("#cupomInput").value : (state.cupom || "");
    footEl.innerHTML =
      '<div class="coupon">' +
        '<label class="sr-only" for="cupomInput">Código do cupom</label>' +
        '<input id="cupomInput" value="' + esc(digitado) + '" placeholder="Cupom (ex.: PATO10)" autocomplete="off">' +
        '<button type="button" id="cupomBtn">Aplicar</button>' +
      "</div>" +
      '<div class="totals">' +
        '<div class="t-muted"><span>Subtotal</span><span class="mono">' + brl(t.subtotal) + "</span></div>" +
        (t.descontoCupom
          ? '<div class="t-off"><span>Cupom ' + esc(state.cupom) + '</span><span class="mono">&minus;' + brl(t.descontoCupom) + "</span></div>"
          : "") +
        '<div class="t-muted"><span>Frete</span><span class="mono">' + (t.frete ? brl(t.frete) : "grátis") + "</span></div>" +
        '<div class="t-total"><span>Total</span><span class="mono">' + brl(t.total) + "</span></div>" +
      "</div>" +
      '<button type="button" class="btn btn--accent btn--block" id="checkoutBtn">Finalizar compra</button>';
  }

  /* Ações por id+tamanho, não por índice: remover a primeira linha antes
     deslocava os índices e o "+" da linha seguinte mexia no item errado. */
  listaEl.addEventListener("click", function (e) {
    var passo = e.target.closest("[data-step]");
    if (passo) { mudarLinha(passo.dataset.id, passo.dataset.size, parseInt(passo.dataset.step, 10)); return; }
    var rm = e.target.closest("[data-remove]");
    if (rm) { removerLinha(rm.dataset.id, rm.dataset.size); return; }
    if (e.target.closest("[data-close-cart]")) fecharSacola();
  });

  footEl.addEventListener("click", function (e) {
    if (e.target.closest("#cupomBtn")) {
      var codigo = ($("#cupomInput").value || "").trim().toUpperCase();
      if (CUPONS[codigo]) {
        state.cupom = codigo;
        renderCart();
        toast("Cupom " + codigo + " aplicado.");
      } else {
        state.cupom = null;
        renderCart();
        toast(codigo ? "Cupom inválido. Tente PATO10." : "Digite um cupom.");
      }
      return;
    }
    if (e.target.closest("#checkoutBtn")) abrirCheckout();
  });

  function abrirSacola() {
    drawer.classList.add("is-open");
    $("#scrim").classList.add("is-open");
    abrirOverlay(drawer, fecharSacola, $("#closeCart"));
  }
  function fecharSacola() {
    drawer.classList.remove("is-open");
    $("#scrim").classList.remove("is-open");
    fecharOverlay(drawer);
  }
  $("#cartBtn").addEventListener("click", abrirSacola);
  $("#closeCart").addEventListener("click", fecharSacola);
  $("#scrim").addEventListener("click", fecharSacola);

  /* ------------------------------------------------------------------------
     11. Checkout
     ------------------------------------------------------------------------ */
  var checkout = { etapa: 1, pagamento: "pix", el: null, pedido: "" };

  var PAGAMENTOS = [
    { id: "pix", marca: "PIX", nome: "Pix", nota: "5% de desconto · aprovação na hora" },
    { id: "card", marca: "CRD", nome: "Cartão de crédito", nota: "em até 3x sem juros" },
    { id: "boleto", marca: "BOL", nome: "Boleto bancário", nota: "vence em 3 dias úteis" }
  ];

  function abrirCheckout() {
    if (!state.cart.length) return;
    fecharSacola();
    checkout.etapa = 1;
    checkout.pedido = "DD-" + String(Date.now()).slice(-4) + "-" + String(Math.floor(Math.random() * 900) + 100);

    checkout.el = document.createElement("div");
    checkout.el.className = "modal";
    checkout.el.setAttribute("role", "dialog");
    checkout.el.setAttribute("aria-modal", "true");
    checkout.el.setAttribute("aria-labelledby", "coTitle");
    checkout.el.innerHTML = '<div class="modal__scrim" data-close></div><div class="modal__card" id="coCard"></div>';
    document.body.appendChild(checkout.el);

    checkout.el.addEventListener("click", aoClicarCheckout);
    checkout.el.addEventListener("keydown", aoTeclarCheckout);
    desenharCheckout();
    abrirOverlay(checkout.el, fecharCheckout);
  }

  function fecharCheckout() {
    if (!checkout.el) return;
    var el = checkout.el;
    checkout.el = null;
    fecharOverlay(el);
    el.remove();
    document.title = "Duck Dodgers — patos colecionáveis com personalidade";
  }

  function aoTeclarCheckout(e) {
    var passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!passo || !e.target.closest("[data-pay]")) return;
    e.preventDefault();
    var opcoes = $$("[data-pay]", checkout.el);
    var atual = opcoes.indexOf(document.activeElement);
    var alvo = opcoes[(atual + passo + opcoes.length) % opcoes.length];
    checkout.pagamento = alvo.dataset.pay;
    desenharCheckout();
    var novo = $('[data-pay="' + checkout.pagamento + '"]', checkout.el);
    if (novo) novo.focus();
  }

  function aoClicarCheckout(e) {
    if (e.target.closest("[data-close]")) { fecharCheckout(); return; }

    var pag = e.target.closest("[data-pay]");
    if (pag) {
      checkout.pagamento = pag.dataset.pay;
      desenharCheckout();
      var novo = $('[data-pay="' + checkout.pagamento + '"]', checkout.el);
      if (novo) novo.focus();
      return;
    }

    if (e.target.closest("[data-next]")) {
      if (checkout.etapa === 1 && !validarEntrega()) return;
      checkout.etapa += 1;
      if (checkout.etapa === 4) {
        /* pedido "fechado": esvazia a sacola antes de desenhar a confirmação */
        state.cart = [];
        state.cupom = null;
        salvarCarrinho();
        renderCart();
      }
      desenharCheckout();
      var card = $("#coCard", checkout.el);
      var foco = $("[data-autofocus]", card) || focaveis(card)[0];
      if (foco) foco.focus();
    }
  }

  /* O checkout antigo avançava sem olhar para os campos — e vinha com um
     nome real pré-preenchido. Agora são placeholders e há validação. */
  function validarEntrega() {
    var campos = [
      { el: $("#coNome"), teste: function (v) { return v.trim().length >= 3; }, erro: "Informe seu nome completo." },
      { el: $("#coCep"), teste: function (v) { return /^\d{5}-?\d{3}$/.test(v.trim()); }, erro: "CEP no formato 00000-000." },
      { el: $("#coNum"), teste: function (v) { return v.trim().length > 0; }, erro: "Informe o número." },
      { el: $("#coEnd"), teste: function (v) { return v.trim().length >= 5; }, erro: "Informe o endereço." }
    ];

    var primeiroErro = null;
    campos.forEach(function (c) {
      var ok = c.teste(c.el.value);
      var alvoErro = $("#" + c.el.id + "Err");
      c.el.setAttribute("aria-invalid", String(!ok));
      alvoErro.textContent = ok ? "" : c.erro;
      if (!ok && !primeiroErro) primeiroErro = c.el;
    });

    if (primeiroErro) { primeiroErro.focus(); return false; }
    return true;
  }

  function campo(id, label, extra) {
    return '<div class="field">' +
      '<label for="' + id + '">' + esc(label) + "</label>" +
      '<input id="' + id + '" ' + (extra || "") + ' aria-describedby="' + id + 'Err">' +
      '<span class="field-error" id="' + id + 'Err" role="alert"></span></div>';
  }

  function desenharCheckout() {
    var t = calcularTotais(checkout.pagamento);
    var etapa = checkout.etapa;

    var passos = ["Entrega", "Pagamento", "Revisão"].map(function (nome, i) {
      var n = i + 1;
      var classe = n < etapa ? ' class="is-done"' : "";
      var atual = n === etapa ? ' aria-current="step"' : "";
      return "<li" + classe + atual + ">" + (n < 10 ? "0" : "") + n + " " + nome + "</li>" +
        (n < 3 ? "<li aria-hidden=\"true\">/</li>" : "");
    }).join("");

    var cabecalho =
      '<div class="modal__head"><h2 id="coTitle">' +
        (etapa === 4 ? "Pedido confirmado" : "Finalizar compra") + "</h2>" +
        '<button type="button" class="icon-btn" data-close aria-label="Fechar checkout">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
        "</button></div>" +
      (etapa < 4 ? '<ol class="stepper">' + passos + "</ol>" : "");

    var corpo = "";

    if (etapa === 1) {
      corpo = '<div class="modal__body">' +
        campo("coNome", "Nome completo", 'autocomplete="name" placeholder="Como está no documento" data-autofocus') +
        '<div class="field-pair">' +
          campo("coCep", "CEP", 'class="mono" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000"') +
          campo("coNum", "Número", 'class="mono" inputmode="numeric" autocomplete="address-line2" placeholder="123"') +
        "</div>" +
        campo("coEnd", "Endereço", 'autocomplete="street-address" placeholder="Rua, bairro, cidade/UF"') +
        '<p class="fine-print">Entrega estimada: <b>3 a 5 dias úteis</b> após a impressão do lote.</p>' +
        '<button type="button" class="btn btn--accent btn--block" data-next>Continuar para pagamento</button></div>';

    } else if (etapa === 2) {
      corpo = '<div class="modal__body">' +
        '<div class="pay-opts" id="payOpts" role="radiogroup" aria-label="Forma de pagamento">' +
        PAGAMENTOS.map(function (o) {
          var ativo = checkout.pagamento === o.id;
          return '<button type="button" role="radio" class="pay" data-pay="' + o.id + '"' +
            ' aria-checked="' + ativo + '" tabindex="' + (ativo ? "0" : "-1") + '"' +
            (ativo ? " data-autofocus" : "") + ">" +
            '<span class="pay__mark" aria-hidden="true">' + o.marca + "</span>" +
            "<span><b>" + esc(o.nome) + "</b><small>" + esc(o.nota) + "</small></span></button>";
        }).join("") +
        "</div>" +
        '<button type="button" class="btn btn--accent btn--block" style="margin-top:24px" data-next>Revisar pedido</button></div>';

    } else if (etapa === 3) {
      var linhas = state.cart.map(function (l) {
        var p = produtoPorId(l.id);
        return '<div class="review-line"><span>' + l.qty + "&times; " + esc(p.nome) +
          ' <span style="color:var(--ink-3)">' + esc(SIZES[l.size].nome) + "</span></span>" +
          "<span>" + brl(p.precos[l.size] * l.qty) + "</span></div>";
      }).join("");

      corpo = '<div class="modal__body">' + linhas +
        (t.descontoCupom
          ? '<div class="review-line review-line--ok"><span>Cupom ' + esc(state.cupom) + "</span><span>&minus;" + brl(t.descontoCupom) + "</span></div>"
          : "") +
        (t.descontoPix
          ? '<div class="review-line review-line--ok"><span>Desconto Pix (5%)</span><span>&minus;' + brl(t.descontoPix) + "</span></div>"
          : "") +
        '<div class="review-line review-line--soft"><span>Frete</span><span>' + (t.frete ? brl(t.frete) : "grátis") + "</span></div>" +
        '<div class="review-total"><span>Total</span><span class="mono">' + brl(t.total) + "</span></div>" +
        '<p class="fine-print">Protótipo: nada será cobrado e nenhum pedido entra em produção.</p>' +
        '<button type="button" class="btn btn--accent btn--block" data-next data-autofocus>Confirmar pedido</button></div>';

    } else {
      corpo = '<div class="modal__body"><div class="done">' +
        '<div class="done__check"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m5 13 4.5 4.5L19 7"/></svg></div>' +
        "<h3>Pedido simulado com sucesso</h3>" +
        "<p>Numa loja de verdade, o pato entraria na fila de impressão agora.</p>" +
        '<div class="order-no">' + esc(checkout.pedido) + "</div>" +
        '<p class="fine-print">Pedido de teste — nenhuma cobrança foi feita.</p>' +
        '<button type="button" class="btn btn--primary btn--block" data-close data-autofocus>Voltar para a loja</button>' +
        "</div></div>";
    }

    $("#coCard", checkout.el).innerHTML = cabecalho + corpo;
  }

  /* ------------------------------------------------------------------------
     12. Formulário de orçamento
     ------------------------------------------------------------------------ */
  var brief = $("#briefForm");
  brief.addEventListener("submit", function (e) {
    e.preventDefault();
    var input = $("#briefEmail");
    var erro = $("#briefEmailErr");
    var valor = input.value.trim();

    if (!valor || !input.checkValidity()) {
      input.setAttribute("aria-invalid", "true");
      erro.textContent = valor ? "E-mail inválido. Confira o endereço." : "Informe seu e-mail.";
      input.focus();
      return;
    }

    input.setAttribute("aria-invalid", "false");
    erro.textContent = "";

    var ok = document.createElement("p");
    ok.className = "form-ok";
    ok.setAttribute("role", "status");
    ok.textContent = "Recebido. Respondemos em " + valor + " com faixa de preço e prazo. (protótipo — nada foi enviado)";
    brief.replaceWith(ok);
    ok.setAttribute("tabindex", "-1");
    ok.focus();
  });

  /* ------------------------------------------------------------------------
     13. Revelação no scroll
     ------------------------------------------------------------------------ */
  var observer = null;
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add("is-in");
        observer.unobserve(entrada.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  }

  function observarReveal() {
    if (!observer) return;
    $$(".reveal:not(.is-in)").forEach(function (el) { observer.observe(el); });
  }

  /* ------------------------------------------------------------------------
     14. Rotas
     ------------------------------------------------------------------------ */

  function rotaAtual() {
    return location.hash.indexOf("#/p/") === 0 ? "produto" : "home";
  }

  function route() {
    var hash = location.hash;

    if (rotaAtual() === "produto") {
      var id = hash.slice(4);
      if (!produtoPorId(id)) { location.replace("#/"); return; }
      viewHome.hidden = true;
      viewProduct.hidden = false;
      renderPDP(id);
      window.scrollTo(0, 0);
      sincronizarHeader();
      return;
    }

    viewHome.hidden = false;
    viewProduct.hidden = true;
    pdp.id = null;
    document.title = "Duck Dodgers — patos colecionáveis impressos em 3D";

    if (hash && hash !== "#/" && hash.length > 1) {
      var alvo = document.getElementById(hash.slice(1));
      if (alvo) { if (alvo.tagName === "DETAILS") alvo.open = true; alvo.scrollIntoView({ block: "start" }); }
    }
    observarReveal();
    sincronizarHeader();
  }

  window.addEventListener("hashchange", route);

  /* ------------------------------------------------------------------------
     15. Boot
     ------------------------------------------------------------------------ */
  document.documentElement.classList.add("js-ready");
  renderRecent();
  state.cart = carregarCarrinho();
  salvarCarrinho(); /* grava a versao ja saneada, para o lixo nao ficar preso */
  renderGrid();
  renderCart();
  route();
  observarReveal();
  sincronizarHeader();
}());

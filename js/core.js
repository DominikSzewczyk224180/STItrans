/* =========================================================
   STItrans — wspólny kod wszystkich podstron
   narzędzia, języki (PL w HTML, EN/DE w js/i18n.js), rysunki SVG,
   menu, przełącznik języka, wejścia nagłówków i akapitów
   Strona główna: js/main.js, pozostałe podstrony: js/site.js
   ========================================================= */
window.STI = (() => {
  'use strict';
  // katalog główny serwisu (działa na stronie głównej i w podfolderze /blog/)
  const BASE = new URL('..', document.currentScript.src).href;

  const root = document.documentElement;
  const body = document.body;
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (RM) root.classList.add('rm');

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  // wygładzanie: animacje „doganiają” przewijanie zamiast skakać
  const damp = (cur, target, lambda, dt) => (RM ? target : lerp(cur, target, 1 - Math.exp(-lambda * dt)));
  const pageTop = el => el.getBoundingClientRect().top + window.scrollY;
  const lerpRect = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });
  const DEG = 180 / Math.PI;


  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };
  const P = {
    rect(x, y, w, h, r = 0) {
      if (!r) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      r = Math.min(r, w / 2, h / 2);
      return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
    },
    circle: (cx, cy, r) => `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`,
    line: (x1, y1, x2, y2) => `M${x1} ${y1}L${x2} ${y2}`
  };
  let uidN = 0;
  const uid = p => `${p}${++uidN}`;

  // Krój szeryfowy. Domyślnie Noto Serif Display; do porównania z właścicielką
  // wystarczy dopisać do adresu ?font=playfair, ?font=source albo ?font=bodoni
  const FONT_ALTS = {
    playfair: { q: 'Playfair+Display:ital,wght@0,400..700;1,400..700', fam: '"Playfair Display"', w: 460, wd: 540, wh: 430, vs: 'normal' },
    source: { q: 'Source+Serif+4:ital,opsz,wght@0,8..60,300..700;1,8..60,300..700', fam: '"Source Serif 4"', w: 470, wd: 560, wh: 420, vs: '"opsz" 60' },
    bodoni: { q: 'Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700', fam: '"Bodoni Moda"', w: 420, wd: 500, wh: 400, vs: '"opsz" 30' }
  };
  const altFont = FONT_ALTS[new URLSearchParams(location.search).get('font')];
  if (altFont) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${altFont.q}&display=swap`;
    document.head.appendChild(l);
    root.style.setProperty('--serif', `${altFont.fam},"Times New Roman",serif`);
    root.style.setProperty('--serif-w', String(altFont.w));
    root.style.setProperty('--serif-w-dark', String(altFont.wd));
    root.style.setProperty('--serif-w-hero', String(altFont.wh));
    root.style.setProperty('--serif-vs', altFont.vs);
  }

  // ---------- Języki: polski jest w HTML, angielski i niemiecki w js/i18n.js ----------
  const I18N = window.STI_I18N || {};
  const LANGS = ['pl', 'en', 'de'];
  // teksty, które po polsku powstają w JS albo mają klucz zamiast treści
  const PL_T = {
    'step.offer': 'Oferta',
    'form.step': 'Krok {n} z {total}: {name}',
    'form.done': '{name}Twoje zapytanie {from} → {to} ({cargo}) jest już u nas. Odezwiemy się najszybciej, jak to możliwe.'
  };
  const norm = s => s.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  // polska typografia: jednoliterowe „w”, „z”, „i”, „o”, „a”, „u” nie zostają na końcu wiersza
  const orphanize = s => s.replace(/(^|[\s„(])([aiouwzAIOUWZ]) /g, '$1$2\u00A0');
  const storedLang = (() => { try { return localStorage.getItem('sti-lang'); } catch (e) { return null; } })();
  const urlLang = new URLSearchParams(location.search).get('lang');
  let LANG = LANGS.includes(urlLang) ? urlLang : (LANGS.includes(storedLang) ? storedLang : 'pl');
  const has = key => LANG !== 'pl' && Array.isArray(I18N[key]);
  const tr = key => (has(key) ? I18N[key][LANG === 'en' ? 0 : 1] : (PL_T[key] || key));
  const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
  const i18nHooks = [];   // odświeżają teksty tworzone w JS (mapa, etykiety, pasek kierunków, formularz)

  // Zapamiętujemy polskie teksty z HTML (węzły tekstowe i atrybuty), żeby móc wracać do PL
  const i18nNodes = [];
  {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode: n => {
        const p = n.parentElement;
        if (!p || p.closest('script,style,svg,[data-split],#statementText,[data-count],[data-lang-block],[data-no-i18n]')) return NodeFilter.FILTER_REJECT;
        return /[A-Za-zÀ-ž]/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) {
      const n = walker.currentNode, v = n.nodeValue;
      const ctx = n.parentElement.closest('[data-i18n]');
      i18nNodes.push({
        n, pl: v, key: ctx ? ctx.dataset.i18n : norm(v),
        lead: v.match(/^\s*/)[0], trail: v.match(/\s*$/)[0],
        en: !!n.parentElement.closest('[lang="en"]')
      });
    }
  }
  const i18nAttrs = [];
  $$('[placeholder],[aria-label]').forEach(el => ['placeholder', 'aria-label'].forEach(a => {
    const v = el.getAttribute(a);
    if (v && /[A-Za-zÀ-ž]/.test(v)) i18nAttrs.push({ el, a, pl: v });
  }));
  const metaDesc = document.querySelector('meta[name="description"]');
  const PL_TITLE = document.title, PL_DESC = metaDesc ? metaDesc.content : '';

  function applyTexts() {
    i18nNodes.forEach(o => {
      if (LANG === 'pl') { o.n.nodeValue = o.en ? o.pl : orphanize(o.pl); return; }
      o.n.nodeValue = has(o.key) ? o.lead + tr(o.key) + o.trail : o.pl;
    });
    i18nAttrs.forEach(o => o.el.setAttribute(o.a, has(norm(o.pl)) ? tr(norm(o.pl)) : o.pl));
    document.title = has(PL_TITLE) ? tr(PL_TITLE) : PL_TITLE;
    if (metaDesc) metaDesc.content = has(PL_DESC) ? tr(PL_DESC) : PL_DESC;
    root.lang = LANG;
    $$('[data-lang]').forEach(a => a.setAttribute('aria-current', String(a.dataset.lang === LANG)));
    $$('[data-lang-block]').forEach(el => { el.hidden = el.dataset.langBlock !== LANG; });
    syncLinks();
  }

  // Linki do innych podstron niosą wybrany język (?lang=en), żeby po przejściu nie wracał polski
  function withLang(href) {
    const hi = href.indexOf('#');
    let base = hi >= 0 ? href.slice(0, hi) : href;
    const hash = hi >= 0 ? href.slice(hi) : '';
    base = base.replace(/([?&])lang=[a-z]{2}(&|$)/, (m, a, b) => (b ? a : '')).replace(/[?&]$/, '');
    if (LANG !== 'pl') base += (base.includes('?') ? '&' : '?') + 'lang=' + LANG;
    return base + hash;
  }
  function syncLinks() {
    $$('a[href]').forEach(a => {
      const h = a.getAttribute('href');
      if (a.hasAttribute('data-lang') || /^(https?:|mailto:|tel:|#)/i.test(h) || !/\.html([?#]|$)/.test(h)) return;
      a.setAttribute('href', withLang(h));
    });
  }
  applyTexts();

  // Tekst elementu w bieżącym języku (z polskim oryginałem zapamiętanym w data-src)
  function srcText(el) {
    if (el.dataset.src == null) el.dataset.src = el.textContent.trim();
    const src = el.dataset.src;
    if (has(norm(src))) return tr(norm(src));
    return LANG === 'pl' && !el.closest('[lang="en"]') ? orphanize(src) : src;
  }

  // Grubość linii rysunków w px, niezależnie od skali SVG
  const strokeTargets = [];
  const registerStroke = (svg, px) => strokeTargets.push({ svg, px });
  function updateStrokes() {
    strokeTargets.forEach(({ svg, px }) => {
      const vb = svg.viewBox.baseVal;
      const w = svg.getBoundingClientRect().width;
      if (w && vb && vb.width) svg.style.setProperty('--sw', (px * vb.width / w).toFixed(2));
    });
  }

  /* =====================================================
     2. Rysunki SVG
     ===================================================== */
  const LOGO = BASE + 'assets/logo-lockup.png';
  const LOGO_W = BASE + 'assets/logo-lockup-white.png';
  const easeIn = t => t * t * t;
  const WHEEL_R = 52;
  const WHEEL_Y = 348;

  function glassGradient(svg) {
    const defs = svgEl('defs', {}, svg);
    const id = uid('glass');
    const lg = svgEl('linearGradient', { id, x1: '0', y1: '0', x2: '1', y2: '1' }, defs);
    svgEl('stop', { offset: '0', 'stop-color': '#C9CCF0' }, lg);
    svgEl('stop', { offset: '1', 'stop-color': '#F1F2FB' }, lg);
    return `url(#${id})`;
  }

  // Ciągnik siodłowy z naczepą 13,6 m, widok z boku. 1 jednostka = 1 cm, ziemia na y = 400.
  function buildTruck(svg, opt) {
    const o = Object.assign({ tractor: true, trailer: true, pallets: 'none', dims: false, logo: true, ground: false, logoSrc: LOGO }, opt || {});
    const out = { wheels: [], pallets: [], dims: [], ground: null, straps: null, move: null, gps: null };
    const glass = glassGradient(svg);
    if (o.ground) out.ground = svgEl('path', { d: P.line(-3000, 400, 4800, 400), class: 'tk-ground', pathLength: '1' }, svg);

    const g = out.move = svgEl('g', { class: 'tk-move' }, svg);
    const p = (d, cls, parent = g) => svgEl('path', { d, class: cls }, parent);

    if (o.tractor) {
      p(P.rect(1096, 296, 548, 20, 3), 'tk-fill');             // rama ciągnika
      p(P.rect(1262, 304, 160, 52, 16), 'tk-fill');            // zbiornik paliwa
    }
    [...(o.trailer ? [330, 461, 592] : []), ...(o.tractor ? [1180, 1545] : [])].forEach(cx => {
      const wg = svgEl('g', { class: 'tk-wheel' }, g);
      p(P.circle(cx, WHEEL_Y, WHEEL_R), 'tk-tyre', wg);
      p(P.circle(cx, WHEEL_Y, 31), 'tk-rim', wg);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        p(P.circle(+(cx + Math.cos(a) * 20).toFixed(1), +(WHEEL_Y + Math.sin(a) * 20).toFixed(1), 3.4), 'tk-bolt', wg);
      }
      p(P.circle(cx, WHEEL_Y, 9), 'tk-hub', wg);
      out.wheels.push({ g: wg, cx, cy: WHEEL_Y });
    });
    if (o.tractor) p('M1112 336Q1112 286 1180 286Q1248 286 1248 336', 'tk-line');   // błotnik ciągnika

    if (o.trailer) {
    // naczepa
    p(P.rect(264, 290, 396, 8, 2), 'tk-fill');                 // błotnik osi
    p(P.rect(0, 0, 1360, 292, 8), 'tk-fill');                  // skrzynia
    out.straps = svgEl('g', { class: 'tk-straps' }, g);
    for (let x = 56; x < 1340; x += 64) p(P.line(x, 24, x, 258), 'tk-line tk-soft', out.straps);
    p(P.line(14, 16, 1346, 16), 'tk-line tk-soft');
    p(P.rect(0, 262, 1360, 30, 3), 'tk-fill');                 // rama boczna
    p(P.rect(0, 0, 14, 262, 4), 'tk-fill');                    // tył
    p(P.rect(1346, 0, 14, 262, 4), 'tk-fill');                 // ściana czołowa
    p(P.line(946, 292, 946, 368), 'tk-line');                  // podpory naczepy
    p(P.line(960, 292, 960, 368), 'tk-line');
    p(P.rect(934, 368, 38, 8, 2), 'tk-fill');
    p(P.line(690, 318, 900, 318), 'tk-line');                  // osłona boczna
    p(P.line(690, 336, 900, 336), 'tk-line');
    p(P.line(730, 292, 730, 336), 'tk-line');
    p(P.line(870, 292, 870, 336), 'tk-line');
    p(P.line(40, 292, 40, 322), 'tk-line');                    // zderzak tylny
    p(P.rect(14, 322, 58, 14, 2), 'tk-fill');
    p(P.rect(2, 294, 26, 14, 3), 'tk-accent');                 // lampa
    if (o.logo) svgEl('image', { href: o.logoSrc, x: '530', y: '30', width: '300', height: '70' }, g);
    }

    if (o.trailer && o.pallets !== 'none') {
      const mixed = o.pallets === 'mixed';
      const H = mixed ? [134, 134, 110, 0, 96, 122, 122, 0, 134, 88, 0] : Array(11).fill(134);
      const C = mixed
        ? ['#AEB3E8', '#AEB3E8', '#AEB3E8', '', '#C9CCF0', '#C9CCF0', '#C9CCF0', '', '#E3E4F2', '#E3E4F2', '']
        : Array(11).fill('#E3E4F2');
      let n = 0;
      H.forEach((h, i) => {
        if (!h) return;
        const x = 20 + i * 120;
        const pg = svgEl('g', { class: 'tk-pallet', style: `--pi:${n++};--pfill:${C[i]}` }, g);
        p(P.rect(x, 246, 116, 16, 2), 'tk-pbase', pg);
        [x + 6, x + 51, x + 96].forEach(bx => p(P.rect(bx, 250, 14, 10, 1), 'tk-pfoot', pg));
        p(P.rect(x + 3, 246 - h, 110, h, 4), 'tk-pbox', pg);
        p(P.line(x + 3, Math.round(246 - h * 0.62), x + 113, Math.round(246 - h * 0.62)), 'tk-pwrap', pg);
        p(P.line(x + 3, Math.round(246 - h * 0.3), x + 113, Math.round(246 - h * 0.3)), 'tk-pwrap', pg);
        out.pallets.push(pg);
      });
    }

    if (o.tractor) {
      p(P.rect(1424, 96, 12, 204, 4), 'tk-fill');              // czerpnia powietrza
      p('M1440 300L1440 72L1598 72Q1640 72 1645 112L1654 296L1654 330Q1654 342 1642 342L1609 342A64 64 0 0 0 1481 342L1481 300Z', 'tk-fill');
      p('M1448 72L1448 8Q1448 0 1458 1L1498 6Q1556 22 1594 64L1598 72Z', 'tk-fill');   // owiewka dachowa
      p(P.line(1627, 86, 1636, 290), 'tk-line tk-soft');
      p(P.rect(1468, 104, 124, 170, 10), 'tk-line');           // drzwi
      svgEl('path', { d: P.rect(1478, 114, 104, 74, 6), class: 'tk-glass', fill: glass }, g);
      p(P.rect(1572, 202, 14, 5, 2), 'tk-tyre');               // klamka
      p(P.line(1448, 306, 1474, 306), 'tk-line');              // stopnie
      p(P.line(1448, 326, 1474, 326), 'tk-line');
      p(P.line(1652, 138, 1674, 132), 'tk-line');              // lusterko
      p(P.rect(1672, 98, 14, 72, 5), 'tk-fill');
      p(P.rect(1645, 300, 10, 16, 3), 'tk-accent');            // reflektor
      out.gps = svgEl('g', { class: 'tk-gps' }, g);
      p(P.line(1476, 3, 1476, -16), 'tk-line', out.gps);
      p(P.circle(1476, -21, 5.5), 'tk-accent', out.gps);
    }

    if (o.dims && o.trailer) {
      const dg = svgEl('g', { class: 'tk-dims' }, svg);
      [
        'M0 -12V-70M1360 -12V-70M0 -50H1360M-9 -41L9 -59M1351 -41L1369 -59',      // naczepa
        'M0 412V474M1654 352V474M0 458H1654M-9 467L9 449M1645 467L1663 449',       // zestaw
        'M1506 0H1772M1700 400H1772M1752 0V400M1743 9L1761 -9M1743 409L1761 391'   // wysokość
      ].forEach(d => out.dims.push(svgEl('path', { d, class: 'tk-dim', pathLength: '1' }, dg)));
    }
    return out;
  }

  // Bus do ekspresu, widok z boku; ziemia na y = 310
  function buildVan(svg, opt) {
    const o = Object.assign({ logoSrc: LOGO }, opt || {});
    const out = { wheels: [], move: null, speed: [] };
    const glass = glassGradient(svg);
    svgEl('path', { d: P.line(-420, 310, 900, 310), class: 'tk-line tk-soft' }, svg);
    [[-210, 92, -50], [-230, 160, -70], [-170, 228, -50]].forEach(([x1, y, x2]) =>
      out.speed.push(svgEl('path', { d: P.line(x1, y, x2, y), class: 'tk-speed', pathLength: '1' }, svg)));
    const g = out.move = svgEl('g', { class: 'tk-move' }, svg);
    const p = (d, cls, parent = g) => svgEl('path', { d, class: cls }, parent);
    [118, 488].forEach(cx => {
      const wg = svgEl('g', {}, g);
      p(P.circle(cx, 268, 42), 'tk-tyre', wg);
      p(P.circle(cx, 268, 25), 'tk-rim', wg);
      p(P.circle(cx, 268, 7), 'tk-hub', wg);
      out.wheels.push({ g: wg, cx, cy: 268 });
    });
    p('M14 252L14 46Q14 28 32 28L420 28Q446 28 462 46L540 150Q552 166 572 172L590 177Q606 182 606 200L606 252Q606 262 596 262L536 262A48 48 0 0 0 440 262L166 262A48 48 0 0 0 70 262L26 262Q14 262 14 252Z', 'tk-fill');
    p(P.rect(250, 42, 170, 210, 6), 'tk-line tk-soft');        // drzwi przesuwne
    p(P.line(430, 34, 430, 262), 'tk-line');
    svgEl('path', { d: 'M442 50L458 50Q465 50 469 56L526 140L442 140Z', class: 'tk-glass', fill: glass }, g);
    p(P.rect(452, 160, 14, 5, 2), 'tk-tyre');
    p(P.line(522, 124, 566, 118), 'tk-line');                  // lusterko
    p(P.rect(562, 92, 10, 40, 4), 'tk-fill');
    p(P.rect(596, 196, 10, 18, 3), 'tk-accent');
    p(P.rect(14, 190, 8, 34, 2), 'tk-accent');
    svgEl('image', { href: o.logoSrc, x: '40', y: '64', width: '190', height: '44' }, g);
    return out;
  }

  // Okładki bloga: plan załadunku z góry, kręgi stali w rzucie ukośnym, stoper
  function buildLoadPlan(svg) {
    const g = svgEl('g', {}, svg);
    const X0 = 104, W = 446, H = 84, COLS = 11, ROWS = 3, cw = W / COLS, chh = H / ROWS;
    const LTL = { A: [], B: [], C: [] };
    for (let r = 0; r < ROWS; r++) { for (let c = 0; c < 3; c++) LTL.A.push(r * COLS + c); LTL.C.push(r * COLS + 8); }
    [4, 5, 15, 16].forEach(i => LTL.B.push(i));
    const colorOf = i => (LTL.A.includes(i) ? '#A9AEF0' : LTL.B.includes(i) ? '#C9CCF0' : LTL.C.includes(i) ? '#E3E4F2' : null);
    [['FTL', 92, true], ['LTL', 236, false]].forEach(([label, y, full]) => {
      svgEl('path', { d: P.rect(X0 - 8, y - 8, W + 16, H + 16, 8), class: 'cv-trailer' }, g);
      svgEl('path', { d: P.rect(X0 + W + 18, y + 6, 50, H - 12, 12), class: 'cv-trailer' }, g);      // ciągnik z góry
      svgEl('path', { d: P.line(X0 + W + 58, y + 14, X0 + W + 58, y + H - 14), class: 'cv-ring' }, g);
      const t = svgEl('text', { x: X0 - 34, y: y + H / 2 + 2, 'text-anchor': 'end', class: 'cv-label' }, g); t.textContent = label;
      let filled = 0;
      for (let i = 0; i < COLS * ROWS; i++) {
        const c = i % COLS, r = Math.floor(i / COLS);
        const col = full ? '#A9AEF0' : colorOf(i);
        if (col) filled++;
        svgEl('path', {
          d: P.rect(+(X0 + c * cw + 3).toFixed(1), +(y + r * chh + 3).toFixed(1), +(cw - 6).toFixed(1), +(chh - 6).toFixed(1), 3),
          class: 'cv-cell' + (col ? '' : ' cv-cell--empty'), style: `--ci:${i + (full ? 0 : 12)};${col ? `fill:${col}` : ''}`
        }, g);
      }
      const s = svgEl('text', { x: X0 - 34, y: y + H / 2 + 24, 'text-anchor': 'end', class: 'cv-sub' }, g); s.textContent = `${filled}/33`;
    });
  }
  function buildCoils(svg) {
    const defs = svgEl('defs', {}, svg);
    const g = svgEl('g', {}, svg);
    const D = [58, -34], len = Math.hypot(D[0], D[1]), n = [-D[1] / len, D[0] / len];
    const FLOOR = 322, R = 80;
    svgEl('path', { d: `M0 ${FLOOR}H640`, class: 'cv-floor' }, g);
    [150, 322, 494].forEach(cx => {
      const cy = FLOOR - R, id = uid('coil');
      const P1 = [cx + n[0] * R, cy + n[1] * R], P2 = [cx - n[0] * R, cy - n[1] * R];
      const lg = svgEl('linearGradient', { id: id + 'b', gradientUnits: 'userSpaceOnUse', x1: P2[0], y1: P2[1], x2: P1[0], y2: P1[1] }, defs);
      [['0', '#6F75CF'], ['.28', '#DADCF8'], ['.55', '#555BB4'], ['1', '#191B4A']].forEach(([o, c]) => svgEl('stop', { offset: o, 'stop-color': c }, lg));
      const rg = svgEl('radialGradient', { id: id + 'f', cx: '42%', cy: '38%', r: '70%' }, defs);
      [['0', '#6B71CC'], ['.6', '#3B4096'], ['1', '#23276A']].forEach(([o, c]) => svgEl('stop', { offset: o, 'stop-color': c }, rg));
      const cp = svgEl('clipPath', { id: id + 'c' }, defs);
      svgEl('circle', { cx, cy, r: 27 }, cp);
      svgEl('ellipse', { cx: cx + D[0] / 2, cy: FLOOR + 2, rx: R * 1.2, ry: 10, class: 'cv-shadow' }, g);
      svgEl('circle', { cx: cx + D[0], cy: cy + D[1], r: R, fill: `url(#${id}b)`, class: 'cv-edge' }, g);
      svgEl('path', { d: `M${P1[0].toFixed(1)} ${P1[1].toFixed(1)}l${D[0]} ${D[1]}L${(P2[0] + D[0]).toFixed(1)} ${(P2[1] + D[1]).toFixed(1)}L${P2[0].toFixed(1)} ${P2[1].toFixed(1)}Z`, fill: `url(#${id}b)` }, g);
      svgEl('path', { d: `M${P1[0].toFixed(1)} ${P1[1].toFixed(1)}l${D[0]} ${D[1]}M${P2[0].toFixed(1)} ${P2[1].toFixed(1)}l${D[0]} ${D[1]}`, class: 'cv-edge' }, g);
      svgEl('circle', { cx, cy, r: R, fill: `url(#${id}f)`, class: 'cv-edge' }, g);
      for (let r = R - 8; r > 32; r -= 6.5) svgEl('circle', { cx, cy, r: r.toFixed(1), class: 'cv-coilring' }, g);
      svgEl('circle', { cx, cy, r: 27, class: 'cv-eye' }, g);                                      // oko kręgu
      svgEl('circle', { cx: cx + D[0] * 0.42, cy: cy + D[1] * 0.42, r: 27, class: 'cv-eye-far', 'clip-path': `url(#${id}c)` }, g);
      svgEl('circle', { cx, cy, r: 27, class: 'cv-edge cv-nofill' }, g);
      [-20, 160].forEach(a => {                                                                     // opaski
        const t = a * Math.PI / 180;
        svgEl('path', { d: P.line(+(cx + Math.cos(t) * 27).toFixed(1), +(cy + Math.sin(t) * 27).toFixed(1), +(cx + Math.cos(t) * R).toFixed(1), +(cy + Math.sin(t) * R).toFixed(1)), class: 'cv-strap' }, g);
      });
      svgEl('path', { d: `M${cx - R * 0.78} ${FLOOR}L${cx - R * 0.5} ${FLOOR - 26}H${cx - R * 0.22}L${cx - R * 0.12} ${FLOOR}Z`, class: 'cv-wedge' }, g);   // kliny
      svgEl('path', { d: `M${cx + R * 0.12} ${FLOOR}L${cx + R * 0.22} ${FLOOR - 26}H${cx + R * 0.5}L${cx + R * 0.78} ${FLOOR}Z`, class: 'cv-wedge' }, g);
    });
  }
  function buildStopwatch(svg) {
    const g = svgEl('g', {}, svg);
    const cx = 320, cy = 218, R = 132;
    svgEl('path', { d: P.rect(cx - 16, cy - R - 32, 32, 14, 4), class: 'cv-fill' }, g);
    svgEl('path', { d: P.rect(cx - 7, cy - R - 18, 14, 18, 2), class: 'cv-fill' }, g);
    svgEl('path', { d: P.rect(-10, -8, 20, 16, 4), class: 'cv-fill', transform: `translate(${(cx + Math.cos(-Math.PI / 4) * (R + 12)).toFixed(1)} ${(cy + Math.sin(-Math.PI / 4) * (R + 12)).toFixed(1)}) rotate(45)` }, g);
    svgEl('circle', { cx, cy, r: R, class: 'cv-dial' }, g);
    svgEl('circle', { cx, cy, r: R - 12, class: 'cv-ring' }, g);
    for (let i = 0; i < 60; i++) {
      const a = i / 60 * Math.PI * 2 - Math.PI / 2, long = i % 5 === 0, r1 = R - 22, r2 = r1 - (long ? 16 : 7);
      svgEl('path', { d: P.line(+(cx + Math.cos(a) * r1).toFixed(1), +(cy + Math.sin(a) * r1).toFixed(1), +(cx + Math.cos(a) * r2).toFixed(1), +(cy + Math.sin(a) * r2).toFixed(1)), class: long ? 'cv-tick cv-tick--long' : 'cv-tick' }, g);
    }
    const ar = R - 52, end = 250 * Math.PI / 180;     // łuk czasu: od godziny 12 zgodnie ze wskazówkami
    const ex = cx + Math.sin(end) * ar, ey = cy - Math.cos(end) * ar;
    svgEl('path', { d: `M${cx} ${cy - ar}A${ar} ${ar} 0 1 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`, class: 'cv-arc', pathLength: '1' }, g);
    const t = svgEl('text', { x: cx, y: cy - 22, 'text-anchor': 'middle', class: 'cv-text' }, g); t.textContent = '24 h';
    const hand = svgEl('g', { class: 'cv-hand' }, g);
    svgEl('path', { d: P.line(cx, cy + 18, cx, cy - R + 40), class: 'cv-handline' }, hand);
    svgEl('circle', { cx, cy, r: 7, class: 'cv-hub' }, g);
  }

  // Mapa Europy: rzutowanie LAEA (10°E, 52°N) jak w js/europe.js, dane Natural Earth (domena publiczna)
  const EU = window.STI_EUROPE || null;
  const HOME = 'POL';
  const SERVED = new Set(['CZE', 'SVK', 'DEU', 'NLD', 'BEL', 'LUX', 'FRA', 'ITA', 'DNK']);   // kierunki ze stitrans.pl/kariera
  const RAD = Math.PI / 180;
  const geo = (lat, lon) => {
    if (!EU) return [(lon + 1) * 0.6494 * 36, (55 - lat) * 36];   // zapas, gdyby nie wczytał się europe.js
    const f = lat * RAD, l = lon * RAD, f0 = EU.lat0 * RAD, l0 = EU.lon0 * RAD;
    const k = Math.sqrt(2 / (1 + Math.sin(f0) * Math.sin(f) + Math.cos(f0) * Math.cos(f) * Math.cos(l - l0)));
    const x = k * Math.cos(f) * Math.sin(l - l0);
    const y = k * (Math.cos(f0) * Math.sin(f) - Math.sin(f0) * Math.cos(f) * Math.cos(l - l0));
    return [EU.tx + x * EU.s, EU.ty - y * EU.s];
  };
  const CITY = {
    Rybnik: [50.10, 18.55], Berlin: [52.52, 13.40], Monachium: [48.14, 11.58], Hamburg: [53.55, 9.99],
    Mediolan: [45.46, 9.19], Bruksela: [50.85, 4.35], Amsterdam: [52.37, 4.90], Lyon: [45.76, 4.84],
    'Paryż': [48.86, 2.35], Frankfurt: [50.11, 8.68], Rotterdam: [51.92, 4.48], Zurych: [47.37, 8.54], Kolonia: [50.94, 6.96],
    Praga: [50.08, 14.43], 'Bratysława': [48.15, 17.11], Kolding: [55.49, 9.47], Antwerpia: [51.22, 4.40]
  };
  function arcPath(a, b, bend) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    if (ny > 0) { nx = -nx; ny = -ny; }            // łuk zawsze wygięty ku północy
    const cx = (a[0] + b[0]) / 2 + nx * len * bend, cy = (a[1] + b[1]) / 2 + ny * len * bend;
    return `M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  }
  const XLINK = 'http://www.w3.org/1999/xlink';
  function buildMap(box, opt) {
    const o = Object.assign({ routes: [], labels: {}, origin: 'Rybnik', bend: 0.16, r: 4.2, movers: false }, opt);
    const svg = box.querySelector('svg');
    const out = { svg, routes: [], dots: new Map(), labels: new Map() };
    if (EU) {   // podkład: ląd, granice, siatka; krawędzie gasną maską
      const base = svgEl('svg', { class: 'map__base', viewBox: `0 0 ${EU.w} ${EU.h}`, 'aria-hidden': 'true' });
      box.insertBefore(base, svg);
      svgEl('path', { d: EU.grid, class: 'map__grid' }, base);
      EU.land.forEach(([id, d]) => svgEl('path', { d, class: 'map__land' + (id === HOME ? ' is-home' : SERVED.has(id) ? ' is-served' : '') }, base));
    }
    const firstIdx = new Map();
    const movers = [];
    o.routes.forEach(([from, to], i) => {
      const id = uid('route');
      const path = svgEl('path', { id, d: arcPath(geo(...CITY[from]), geo(...CITY[to]), o.bend), class: 'route', pathLength: '1', style: `--ri:${i}` }, svg);
      const r = { path, to, mover: null };
      if (o.movers) {   // ciężarówka jako świecący punkt jadący po trasie
        const g = svgEl('g', { class: 'map__mover', style: `--ri:${i}` });
        const inner = svgEl('g', { opacity: '0' }, g);
        svgEl('circle', { r: '6', class: 'map__halo' }, inner);
        svgEl('circle', { r: '2.5', class: 'map__truck' }, inner);
        const begin = (0.3 + i * 0.55).toFixed(2) + 's';
        svgEl('set', { attributeName: 'opacity', to: '1', begin, fill: 'freeze' }, inner);
        const am = svgEl('animateMotion', { dur: (5.5 + (i % 4) * 1.4).toFixed(1) + 's', begin, repeatCount: 'indefinite' }, inner);
        const mp = svgEl('mpath', { href: '#' + id }, am);
        mp.setAttributeNS(XLINK, 'xlink:href', '#' + id);
        r.mover = g;
        movers.push(g);
      }
      out.routes.push(r);
      if (!firstIdx.has(to)) firstIdx.set(to, i);
    });
    movers.forEach(g => svg.appendChild(g));
    firstIdx.forEach((i, name) => {
      if (name === o.origin) return;
      const [x, y] = geo(...CITY[name]);
      out.dots.set(name, svgEl('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: String(o.r), class: 'dest', style: `--ri:${i}` }, svg));
    });
    const [ox, oy] = geo(...CITY[o.origin]);
    svgEl('circle', { cx: ox.toFixed(1), cy: oy.toFixed(1), r: '7', class: 'origin-ring' }, svg);
    svgEl('circle', { cx: ox.toFixed(1), cy: oy.toFixed(1), r: '7', class: 'origin' }, svg);
    Object.entries(o.labels).forEach(([name, side]) => {
      const [x, y] = geo(...CITY[name]);
      const l = document.createElement('span');
      l.className = 'map__label' + (side === 'l' ? ' map__label--left' : '') + (name === o.origin ? ' map__label--origin' : '');
      l.textContent = tr(name);
      l.style.left = (x / 520 * 100).toFixed(2) + '%';
      l.style.top = (y / 400 * 100).toFixed(2) + '%';
      l.style.setProperty('--ri', String(firstIdx.has(name) ? firstIdx.get(name) : 0));
      box.appendChild(l);
      out.labels.set(name, l);
    });
    if (svg.pauseAnimations) svg.pauseAnimations();   // ruch włączamy dopiero, gdy mapa jest widoczna
    registerStroke(svg, o.sw || 2);
    i18nHooks.push(() => out.labels.forEach((l, name) => { l.textContent = tr(name); }));
    return out;
  }
  const setPlaying = (m, on) => {
    if (!m.svg.pauseAnimations || m.playing === on || RM) return;
    m.playing = on;
    if (on) m.svg.unpauseAnimations(); else m.svg.pauseAnimations();
  };


  /* ---------- przełącznik języka ---------- */
  function setLang(lang) {
    if (!LANGS.includes(lang) || lang === LANG) return;
    LANG = lang;
    applyTexts();
    i18nHooks.forEach(fn => fn());
    try { localStorage.setItem('sti-lang', lang); } catch (e) { /* tryb prywatny */ }
    try {
      const u = new URL(location.href);
      if (lang === 'pl') u.searchParams.delete('lang'); else u.searchParams.set('lang', lang);
      history.replaceState(null, '', u);
    } catch (e) { /* file:// w starszych przeglądarkach */ }
  }

  /* ---------- menu mobilne ---------- */
  const api = { lenis: null };
  const menuEl = $('#menu'), menuBtn = $('#menuBtn'), menuClose = $('#menuClose');
  function setMenu(open) {
    if (!menuEl) return;
    menuEl.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    body.classList.toggle('menu-open', open);
    if (api.lenis) { if (open) api.lenis.stop(); else api.lenis.start(); }
    (open ? menuClose : menuBtn).focus({ preventScroll: true });
  }
  if (menuEl) {
    menuBtn.addEventListener('click', () => setMenu(true));
    menuClose.addEventListener('click', () => setMenu(false));
    menuEl.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuEl.classList.contains('is-open')) setMenu(false); });
  }
  $$('a[href="#"]').forEach(a => a.addEventListener('click', e => e.preventDefault()));
  $$('[data-lang]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    setLang(a.dataset.lang);
    if (menuEl && menuEl.classList.contains('is-open')) setMenu(false);
  }));

  /* ---------- wejścia: nagłówki słowo po słowie, akapity z mgły ---------- */
  const splitEls = $$('[data-split]');
  function splitWords(el) {
    const words = srcText(el).split(/[ \t\n\r]+/);   // twarda spacja (&nbsp;) trzyma słowa razem
    el.textContent = '';
    words.forEach((w, i) => {
      const o = document.createElement('span');
      o.className = 'w';
      const n = document.createElement('span');
      n.className = 'w__in';
      n.style.setProperty('--wi', String(i));
      n.textContent = w;
      o.appendChild(n);
      el.appendChild(o);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }
  splitEls.forEach(splitWords);
  i18nHooks.push(() => splitEls.forEach(splitWords));
  const revealIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    revealIO.unobserve(e.target);
  }), { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  $$('[data-split],[data-reveal],.card').forEach(el => revealIO.observe(el));

  return Object.assign(api, {
    BASE, root, body, RM, $, $$, clamp, lerp, easeOut, easeInOut, easeIn, damp, pageTop, lerpRect, DEG,
    NS, svgEl, P, uid, I18N, LANGS, PL_T, norm, orphanize, has, tr, fill, i18nHooks, srcText, applyTexts, setLang,
    lang: () => LANG, registerStroke, updateStrokes, LOGO, LOGO_W, WHEEL_R, WHEEL_Y,
    buildTruck, buildVan, buildLoadPlan, buildCoils, buildStopwatch, EU, geo, CITY, buildMap, setPlaying,
    setMenu, splitWords, revealIO
  });
})();

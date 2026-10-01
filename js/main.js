/* =========================================================
   STItrans — demo strony głównej (czysty JS, bez bibliotek)
   1. Narzędzia
   2. Rysunki SVG: ciężarówka, bus, mapa tras
   3. Hero: scena drogi, okno → pełny ekran → trzy akty → karta
   4. Sekcje: O nas, Flota, Oferta, Proces, przejście w noc
   5. Formularz, menu, kierunki
   6. Pętla animacji, pomiary, preloader, start
   ========================================================= */
(() => {
  'use strict';

  /* =====================================================
     1. Narzędzia
     ===================================================== */
  const root = document.documentElement;
  const body = document.body;
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (RM) root.classList.add('rm');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);

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

  let vw = window.innerWidth;
  let vh = window.innerHeight;
  const header = $('#header');
  let headerH = header.offsetHeight;

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

  // Polska typografia: jednoliterowe „w”, „z”, „i”, „o”, „a”, „u” nie zostają na końcu wiersza
  function fixOrphans(scope) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement && n.parentElement.closest('[lang="en"],script,style,svg,textarea')
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const v = n.nodeValue.replace(/(^|[\s„(])([aiouwzAIOUWZ]) /g, '$1$2\u00A0');
      if (v !== n.nodeValue) n.nodeValue = v;
    });
  }
  fixOrphans(body);

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
  const LOGO = 'assets/logo-lockup.png';
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
    const o = Object.assign({ tractor: true, pallets: 'none', dims: false, logo: true, ground: false }, opt || {});
    const out = { wheels: [], pallets: [], dims: [], ground: null, straps: null, move: null, gps: null };
    const glass = glassGradient(svg);
    if (o.ground) out.ground = svgEl('path', { d: P.line(-3000, 400, 4800, 400), class: 'tk-ground', pathLength: '1' }, svg);

    const g = out.move = svgEl('g', { class: 'tk-move' }, svg);
    const p = (d, cls, parent = g) => svgEl('path', { d, class: cls }, parent);

    if (o.tractor) {
      p(P.rect(1096, 296, 548, 20, 3), 'tk-fill');             // rama ciągnika
      p(P.rect(1262, 304, 160, 52, 16), 'tk-fill');            // zbiornik paliwa
    }
    (o.tractor ? [330, 461, 592, 1180, 1545] : [330, 461, 592]).forEach(cx => {
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
    if (o.logo) svgEl('image', { href: LOGO, x: '530', y: '30', width: '300', height: '70' }, g);

    if (o.pallets !== 'none') {
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

    if (o.dims) {
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
  function buildVan(svg) {
    const out = { wheels: [], move: null };
    const glass = glassGradient(svg);
    svgEl('path', { d: P.line(-420, 310, 900, 310), class: 'tk-line tk-soft' }, svg);
    [[-210, 92, -50], [-230, 160, -70], [-170, 228, -50]].forEach(([x1, y, x2]) =>
      svgEl('path', { d: P.line(x1, y, x2, y), class: 'tk-speed', pathLength: '1' }, svg));
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
    svgEl('image', { href: LOGO, x: '40', y: '64', width: '190', height: '44' }, g);
    return out;
  }

  // Mapa Europy: rzutowanie LAEA (10°E, 52°N) jak w js/europe.js, dane Natural Earth (domena publiczna)
  const EU = window.STI_EUROPE || null;
  const HOME = 'POL';
  const SERVED = new Set(['DEU', 'NLD', 'BEL', 'FRA', 'LUX', 'AUT', 'CHE', 'ITA', 'ESP', 'DNK']);   // jak lista kierunków, do potwierdzenia
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
    'Paryż': [48.86, 2.35], Frankfurt: [50.11, 8.68], Rotterdam: [51.92, 4.48], Zurych: [47.37, 8.54], Kolonia: [50.94, 6.96]
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
      l.textContent = name;
      l.style.left = (x / 520 * 100).toFixed(2) + '%';
      l.style.top = (y / 400 * 100).toFixed(2) + '%';
      l.style.setProperty('--ri', String(firstIdx.has(name) ? firstIdx.get(name) : 0));
      box.appendChild(l);
      out.labels.set(name, l);
    });
    if (svg.pauseAnimations) svg.pauseAnimations();   // ruch włączamy dopiero, gdy mapa jest widoczna
    return out;
  }
  const setPlaying = (m, on) => {
    if (!m.svg.pauseAnimations || m.playing === on || RM) return;
    m.playing = on;
    if (on) m.svg.unpauseAnimations(); else m.svg.pauseAnimations();
  };

  /* =====================================================
     3. Hero
     ===================================================== */
  const hero = $('#hero');
  const stage = $('#stage');
  const copy = $('#heroCopy');
  const media = $('#media');
  const inner = $('#mediaInner');
  const slotInline = $('#slotInline');
  const slotBlock = $('#slotBlock');
  const acts = $$('.act');
  const bars = $$('.acts__bars i');
  const toggle = $('#motionToggle');
  const toggleLabel = toggle.querySelector('.label');
  const video = $('#heroVideo');
  const source = video.querySelector('source');

  let paused = RM;
  let heroVisible = true;

  // Wideo (assets/hero.mp4) albo animacja zastępcza
  let videoReady = false;
  let videoSettled = false;
  const settle = () => { videoSettled = true; };
  function onVideoReady() {
    if (videoReady) return;
    videoReady = true;
    settle();
    media.classList.add('has-video');
    stopRoad();
    if (!paused && heroVisible) video.play().catch(() => {});
  }
  video.addEventListener('loadeddata', onVideoReady);
  source.addEventListener('error', settle);
  video.addEventListener('error', settle);

  // Autostrada nocą: smugi świateł, ciężarówki z lampami obrysowymi, nad ranem świt
  const canvas = $('#road');
  const ctx = canvas.getContext('2d');
  const HORIZON = 0.56, CAM_H = 3.2, LIGHT_H = 0.7, MARKER_H = 2.85, Z_FAR = 170;
  const LANES = [{ X: -5.4, dir: -1 }, { X: -1.8, dir: -1 }, { X: 1.8, dir: 1 }, { X: 5.4, dir: 1 }];
  const PAL = {
    night: { sky: ['#121433', '#2A2E70', '#8B90DD'], ground: ['#4A4FA0', '#22255A', '#15173B', '#0B0C22'], road: ['rgba(70,74,150,.55)', 'rgba(24,26,66,.92)'], glow: 'rgba(222,224,255,.5)', haze: 'rgba(176,182,244,.32)', lights: 1 },
    dawn: { sky: ['#2B2F72', '#8A8FD8', '#F2DCE6'], ground: ['#A19ED4', '#4F5296', '#2C2E6C', '#17183F'], road: ['rgba(160,160,220,.5)', 'rgba(40,42,96,.9)'], glow: 'rgba(255,238,240,.62)', haze: 'rgba(255,228,236,.42)', lights: 0.3 }
  };
  let cw = 0, ch = 0, dpr = 1, F = 1, VX = 0, VY = 0, zMin = 1, bgNight = null, bgDawn = null;
  let cars = [], roadRunning = false, roadRaf = 0, roadLast = 0, dawn = 0, drawnDawn = -1;
  const proj = (X, z, h = 0) => [VX + X * F / z, VY + (CAM_H - h) * F / z];

  function spawn(c, initial) {
    const toward = c.lane.dir < 0;
    c.truck = Math.random() < (Math.abs(c.lane.X) > 3 ? 0.5 : 0.15);   // ciężarówki głównie na prawych pasach
    c.speed = (c.truck ? 18 : (toward ? 25 : 22)) + Math.random() * 7;
    c.tail = 9 + Math.random() * 10;
    const r = Math.random();
    c.col = toward ? (r < 0.14 ? '255,206,150' : '255,246,232') : (r < 0.3 ? '214,218,255' : '160,168,255');
    if (initial) c.z = zMin + Math.random() * (Z_FAR - zMin);
    else c.z = toward ? Z_FAR + Math.random() * 40 : zMin * 0.8;
  }
  function initCars() {
    cars = [];
    LANES.forEach(lane => { for (let i = 0; i < 9; i++) { const c = { lane }; spawn(c, true); cars.push(c); } });
  }
  function roadLine(g, X, z1, z2) {
    const a = proj(X, z1), b = proj(X, z2);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  function buildBg(pal) {
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const W = cw, H = ch, hy = VY;
    let gr = g.createLinearGradient(0, 0, 0, hy);
    gr.addColorStop(0, pal.sky[0]); gr.addColorStop(0.6, pal.sky[1]); gr.addColorStop(1, pal.sky[2]);
    g.fillStyle = gr; g.fillRect(0, 0, W, hy + 1);
    gr = g.createLinearGradient(0, hy, 0, H);
    gr.addColorStop(0, pal.ground[0]); gr.addColorStop(0.12, pal.ground[1]); gr.addColorStop(0.4, pal.ground[2]); gr.addColorStop(1, pal.ground[3]);
    g.fillStyle = gr; g.fillRect(0, hy, W, H - hy);
    // nawierzchnia
    const zN = 0.9, a = proj(-8, Z_FAR * 3), b = proj(8, Z_FAR * 3), q = proj(8, zN), d = proj(-8, zN);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(q[0], q[1]); g.lineTo(d[0], d[1]); g.closePath();
    gr = g.createLinearGradient(0, hy, 0, H);
    gr.addColorStop(0, pal.road[0]); gr.addColorStop(1, pal.road[1]);
    g.fillStyle = gr; g.fill();
    // linie
    g.strokeStyle = 'rgba(220,224,255,.18)'; g.lineWidth = 1;
    [-7.2, 7.2, -0.22, 0.22].forEach(X => roadLine(g, X, Z_FAR * 3, zN));
    [-3.6, 3.6].forEach(X => {
      for (let z = 1.2; z < Z_FAR; z += 12) {
        g.lineWidth = clamp(0.12 * F / z, 0.4, 6);
        g.globalAlpha = clamp(1.1 - z / Z_FAR) * 0.9;
        roadLine(g, X, z, z + 4);
      }
    });
    g.globalAlpha = 1;
    // poświata i mgiełka nad horyzontem
    const rg = g.createRadialGradient(VX, hy, 0, VX, hy, Math.max(W, H) * 0.6);
    rg.addColorStop(0, pal.glow); rg.addColorStop(0.25, 'rgba(160,166,240,.18)'); rg.addColorStop(1, 'rgba(84,92,188,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    const hz = g.createLinearGradient(0, hy - H * 0.07, 0, hy + H * 0.06);
    hz.addColorStop(0, 'rgba(150,156,230,0)'); hz.addColorStop(0.55, pal.haze); hz.addColorStop(1, 'rgba(40,44,100,0)');
    g.fillStyle = hz; g.fillRect(0, hy - H * 0.07, W, H * 0.13);
    // światła w oddali
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 180; i++) {
      const x = rnd() * W, dy = Math.pow(rnd(), 2.2) * H * 0.035, r = 0.5 + rnd() * 1.1;
      const warm = rnd() < 0.6, al = (warm ? 0.25 + rnd() * 0.5 : 0.2 + rnd() * 0.4) * pal.lights;
      g.fillStyle = warm ? `rgba(255,236,210,${al})` : `rgba(190,196,255,${al})`;
      g.beginPath(); g.arc(x, hy - dy, r, 0, Math.PI * 2); g.fill();
    }
    // winieta
    const vg = g.createRadialGradient(VX, H * 0.55, Math.min(W, H) * 0.3, VX, H * 0.55, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(6,7,24,.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return c;
  }
  function streak(X, z1, z2, h, col, alpha, wMul) {
    const p1 = proj(X, z1, h), p2 = proj(X, z2, h);
    const lw = clamp(0.085 * F / z1, 0.45, 3.4) * wMul;
    const gr = ctx.createLinearGradient(p1[0], p1[1], p2[0], p2[1]);
    gr.addColorStop(0, `rgba(${col},${alpha})`);
    gr.addColorStop(0.35, `rgba(${col},${0.55 * alpha})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    ctx.strokeStyle = gr;
    for (const [a, m] of [[0.06, 7], [0.2, 2.4], [1, 1]]) {   // miękka poświata + rdzeń
      ctx.globalAlpha = a; ctx.lineWidth = lw * m;
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    }
  }
  function drawRoad(dt) {
    if (!bgNight) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(bgNight, 0, 0);
    if (dawn > 0.002) { ctx.globalAlpha = dawn; ctx.drawImage(bgDawn, 0, 0); ctx.globalAlpha = 1; }
    drawnDawn = dawn;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const dim = 1 - dawn * 0.45;
    for (const c of cars) {
      if (dt) {
        c.z += c.lane.dir * c.speed * dt;
        if (c.lane.dir < 0 && c.z < zMin * 0.8) spawn(c, false);
        if (c.lane.dir > 0 && c.z > Z_FAR + 30) spawn(c, false);
      }
      const zh = Math.max(c.z, 0.6);
      const zt = Math.max(c.z - c.lane.dir * c.tail, 0.6);
      const fog = clamp(1.1 - zh / Z_FAR) * dim;
      if (fog <= 0) continue;
      for (const s of [-0.8, 0.8]) streak(c.lane.X + s, zh, zt, LIGHT_H, c.col, fog, 1);
      if (c.truck) for (const s of [-1.1, 1.1]) streak(c.lane.X + s, zh, zt, MARKER_H, '255,186,104', fog * 0.85, 0.6);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  function sizeRoad(force) {
    const r = stage.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (!force && bgNight && w === cw && Math.abs(h - ch) < 80) return;   // pasek adresu na telefonie
    cw = w; ch = h;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    F = ch * 0.9; VX = cw * 0.5; VY = ch * HORIZON;
    zMin = (CAM_H - LIGHT_H) * F / (ch - VY);
    bgNight = buildBg(PAL.night);
    bgDawn = buildBg(PAL.dawn);
    if (!cars.length) initCars();
    drawRoad(0);
  }
  function roadLoop(t) {
    if (!roadRunning) return;
    const dt = roadLast ? Math.min(0.05, (t - roadLast) / 1000) : 0;
    roadLast = t;
    drawRoad(dt);
    roadRaf = requestAnimationFrame(roadLoop);
  }
  function startRoad() {
    if (roadRunning || videoReady || paused || !heroVisible) return;
    roadRunning = true; roadLast = 0;
    roadRaf = requestAnimationFrame(roadLoop);
  }
  function stopRoad() { roadRunning = false; cancelAnimationFrame(roadRaf); }

  new IntersectionObserver(([e]) => {
    heroVisible = e.isIntersecting;
    if (heroVisible) startRoad(); else stopRoad();
    if (videoReady) { if (heroVisible && !paused) video.play().catch(() => {}); else video.pause(); }
  }).observe(hero);

  function setPaused(v) {
    paused = v;
    toggle.setAttribute('aria-pressed', String(paused));
    toggleLabel.textContent = paused ? 'Wznów ruch' : 'Zatrzymaj ruch';
    if (videoReady) { if (paused) video.pause(); else video.play().catch(() => {}); }
    else if (paused) stopRoad(); else startRoad();
  }
  toggle.addEventListener('click', () => setPaused(!paused));
  if (RM) setPaused(true);

  // Akty: rodzaje transportu, mapa tras, przykładowy kurs
  const specRows = $$('#spec li');
  const heroMap = buildMap($('#heroMap'), {
    routes: ['Berlin', 'Monachium', 'Hamburg', 'Mediolan', 'Bruksela', 'Amsterdam', 'Lyon', 'Paryż'].map(c => ['Rybnik', c]),
    labels: { Rybnik: 'r', Berlin: 'r', Monachium: 'r', Hamburg: 'r', Mediolan: 'r', Bruksela: 'l', Amsterdam: 'l', Lyon: 'l', 'Paryż': 'l' },
    r: 4.6, movers: true
  });
  const track = $('#track');
  const digits = $$('#trackTime .d');
  const DEP = 21 * 60 + 30, ARR = 24 * 60 + 5 * 60 + 48;     // 21:30 → 05:48
  let lastMin = -1;
  const actUpdate = [
    t => specRows.forEach((li, j) => li.style.setProperty('--r', easeOut(clamp((t - 0.04 - j * 0.12) / 0.24)).toFixed(3))),
    t => heroMap.routes.forEach((r, i) => {
      const s = clamp((t - 0.04 - i * 0.06) / 0.28);
      r.path.style.strokeDashoffset = (1 - easeInOut(s)).toFixed(4);
      const d = clamp((s - 0.85) / 0.15).toFixed(3);
      const dot = heroMap.dots.get(r.to), lab = heroMap.labels.get(r.to);
      if (dot) dot.style.opacity = d;
      if (lab) lab.style.opacity = d;
      if (r.mover) r.mover.style.opacity = d;
    }),
    t => {
      const k = clamp(t / 0.62), e = easeInOut(k);
      track.style.setProperty('--k', e.toFixed(4));
      const m = Math.round(lerp(DEP, ARR, e)) % 1440;
      if (m !== lastMin) {
        lastMin = m;
        const hh = String(Math.floor(m / 60)).padStart(2, '0'), mm = String(m % 60).padStart(2, '0');
        digits[0].textContent = hh[0]; digits[1].textContent = hh[1];
        digits[2].textContent = mm[0]; digits[3].textContent = mm[1];
      }
      track.classList.toggle('is-done', k >= 1);
    }
  ];

  // Oś czasu hero (postęp 0–1 w obrębie przypiętej sceny)
  const P_EXPAND = 0.25, P_EXIT = 0.93;
  const ACTS = [[0.26, 0.48], [0.48, 0.70], [0.70, P_EXIT]];
  const FADE = 0.03;
  let slotR = { x: 0, y: 0, w: 0, h: 0 }, slotRad = 0, SW = 1, SH = 1;
  let heroTop = 0, heroH = 1, padPx = 20;
  let introT = 0, introRunning = false, introStart = 0;
  const heroS = { cur: 0, target: 0 };

  const activeSlot = () => (getComputedStyle(slotBlock).display !== 'none' ? slotBlock : slotInline);
  const heroTitle = $('.hero__title');
  const titleLines = $$('.hero__title .line');
  function fitTitle() {
    heroTitle.style.fontSize = '100px';
    let widest = 0;
    titleLines.forEach(l => {
      widest = Math.max(widest, l.firstElementChild.offsetWidth + (parseFloat(getComputedStyle(l).paddingLeft) || 0));
    });
    const availW = copy.clientWidth - 2 * padPx;
    const sh = stage.clientHeight;
    const block = getComputedStyle(slotBlock).display !== 'none';
    const hCap = block ? sh * 0.38 / 2.85 : (sh - 250) / 2.9;
    const fs = Math.max(34, Math.min(availW / Math.max(1, widest) * 98, hCap, 240));
    heroTitle.style.fontSize = fs.toFixed(1) + 'px';
  }
  function measureSlot() {
    const sr = stage.getBoundingClientRect();
    const el = activeSlot();
    const r = el.getBoundingClientRect();
    SW = sr.width || 1; SH = sr.height || 1;
    slotR = { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
    slotRad = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, r.height / 2);
  }

  function renderHero(p) {
    const pe = clamp(p / P_EXPAND), E = easeInOut(pe);
    const px = RM ? 0 : easeInOut(clamp((p - P_EXIT) / (1 - P_EXIT)));
    const full = { x: 0, y: 0, w: SW, h: SH };
    let R0 = slotR;
    if (introT < 1) {   // okno otwiera się w haśle po preloaderze
      const e = easeOut(introT), w = slotR.w * e, h = Math.min(slotR.h, w);
      R0 = { x: slotR.x + (slotR.w - w) / 2, y: slotR.y + (slotR.h - h) / 2, w, h };
    }
    let R, rad;
    if (RM) {
      R = full; rad = 0;
      media.style.opacity = pe > 0.05 ? '1' : '0';
    } else {
      R = lerpRect(R0, full, E);
      rad = lerp(Math.min(slotRad, R0.h / 2), 0, E);
      const k = Math.max(R.w / SW, R.h / SH, 0.0001);
      const tx = R.x + R.w / 2 - SW / 2, ty = R.y + R.h / 2 - SH / 2;
      inner.style.transform = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${k.toFixed(5)})`;
      if (px > 0) {     // wyjście: pełny ekran zwija się w kartę i odjeżdża w górę
        const T = { x: padPx, y: headerH + 8, w: SW - 2 * padPx, h: SH - headerH - 8 - padPx };
        R = lerpRect(R, T, px);
        rad = lerp(rad, 28, px);
      }
    }
    const clip = `inset(${R.y.toFixed(2)}px ${(SW - R.x - R.w).toFixed(2)}px ${(SH - R.y - R.h).toFixed(2)}px ${R.x.toFixed(2)}px round ${rad.toFixed(2)}px)`;
    media.style.clipPath = clip;
    media.style.webkitClipPath = clip;

    copy.style.opacity = (1 - clamp(pe * 1.7)).toFixed(3);
    copy.style.visibility = pe >= 0.6 ? 'hidden' : 'visible';
    stage.style.setProperty('--shade', (clamp((pe - 0.3) / 0.6) * (1 - px * 0.5)).toFixed(3));

    const barsOn = clamp((p - (ACTS[0][0] - 0.02)) / 0.03) * (1 - clamp((p - P_EXIT + 0.03) / 0.03));
    stage.style.setProperty('--bars', barsOn.toFixed(3));
    toggle.style.visibility = barsOn > 0.01 ? 'visible' : 'hidden';

    ACTS.forEach(([a, b], i) => {
      const fi = clamp((p - a) / FADE), fo = clamp((b - p) / FADE);
      const op = Math.min(fi, fo);
      const el = acts[i];
      el.style.opacity = op.toFixed(3);
      el.style.visibility = op > 0.001 ? 'visible' : 'hidden';
      el.style.setProperty('--in', (RM ? 1 : easeOut(fi)).toFixed(3));
      const t = clamp((p - a) / (b - a));
      bars[i].style.setProperty('--f', t.toFixed(3));
      actUpdate[i](RM ? (op > 0 ? 1 : 0) : t);
      if (i === 1) setPlaying(heroMap, op > 0.01);
    });

    // świt w trzecim akcie, razem z zegarem 05:48
    dawn = easeInOut(clamp((p - 0.7) / 0.17)) * 0.9;
    if (!roadRunning && !videoReady && Math.abs(dawn - drawnDawn) > 0.01) drawRoad(0);
  }

  let contactTop = 0;
  function headerState(y, p) {
    const inHero = heroTop + heroH - y > headerH;
    const pe = clamp(p / P_EXPAND), px = clamp((p - P_EXIT) / (1 - P_EXIT));
    const overMedia = inHero && pe > 0.8 && px < 0.5;
    const overNight = body.classList.contains('theme-dark') && contactTop - y <= headerH;
    header.classList.toggle('is-dark', overMedia || overNight);
    header.classList.toggle('is-solid', !inHero);
  }

  /* =====================================================
     4. Sekcje
     ===================================================== */
  // O nas: słowa zapalają się w miarę przewijania
  const stSec = $('#o-nas');
  const stText = $('#statementText');
  const stFoot = $('#statementFoot');
  const stStage = $('.statement__stage');
  const stWords = [];
  {
    const words = stText.textContent.trim().split(/[ \t\n\r]+/);
    stText.textContent = '';
    words.forEach((w, i) => {
      const s = document.createElement('span');
      s.className = 'sw';
      s.textContent = w;
      stText.appendChild(s);
      stWords.push(s);
      if (i < words.length - 1) stText.appendChild(document.createTextNode(' '));
    });
  }
  let stTop = 0, stH = 1, stFilled = -1;
  function renderStatement(y) {
    const start = stTop - vh * 0.35;
    const p = clamp((y - start) / Math.max(1, stH - vh + vh * 0.35));
    const n = RM ? stWords.length : Math.round(clamp((p - 0.04) / 0.6) * stWords.length);
    if (n !== stFilled) {
      stWords.forEach((w, i) => w.classList.toggle('on', i < n));
      stFilled = n;
    }
    stFoot.style.setProperty('--foot', (RM ? 1 : easeOut(clamp((p - 0.66) / 0.18))).toFixed(3));
    if (!RM) stStage.style.setProperty('--wm', ((0.5 - p) * 90).toFixed(1) + 'px');
  }

  // Flota: zestaw wjeżdża, palety się ładują, rysują się wymiary
  const fleetSec = $('#dlaczego-my');
  const fleetBox = $('#fleetDrawing');
  const fleetSvg = $('#fleetTruck');
  const fleet = buildTruck(fleetSvg, { pallets: 'full', dims: true, ground: true });
  registerStroke(fleetSvg, 1.3);
  const statP = $('#statPallets'), statT = $('#statTons'), statV = $('#statVol');
  const fleetLabel = (txt, x, y, mod) => {
    const l = document.createElement('span');
    l.className = 'tk-label' + (mod ? ` tk-label--${mod}` : '');
    l.textContent = txt;
    l.style.left = ((x + 40) / 1860 * 100).toFixed(2) + '%';
    l.style.top = ((y + 110) / 610 * 100).toFixed(2) + '%';
    fleetBox.appendChild(l);
    return l;
  };
  const dimLabels = [fleetLabel('Naczepa 13,6 m', 680, -50), fleetLabel('Zestaw 16,5 m', 827, 458), fleetLabel('4 m', 1752, 200, 'side')];
  const gpsLabel = fleetLabel('GPS 24/7', 1476, -21, 'gps');
  const fleetS = { cur: 0, target: 0 };
  let fleetTop = 0, fleetH = 1, fleetStartX = -2600;

  function renderFleet(p) {
    fleet.ground.style.strokeDashoffset = (RM ? 0 : 1 - easeOut(clamp(p / 0.1))).toFixed(4);
    const d = clamp((p - 0.04) / 0.34);
    const x = RM ? 0 : lerp(fleetStartX, 0, easeOut(d));
    fleet.move.setAttribute('transform', `translate(${x.toFixed(1)} 0)`);
    const ang = (x / WHEEL_R) * DEG;
    fleet.wheels.forEach(w => w.g.setAttribute('transform', `rotate(${ang.toFixed(1)} ${w.cx} ${w.cy})`));
    const pl = RM ? 1 : clamp((p - 0.42) / 0.26);
    let landed = 0;
    fleet.pallets.forEach((pg, i) => {
      const t = clamp(pl * fleet.pallets.length - i);
      if (t >= 1) landed++;
      pg.style.opacity = t.toFixed(3);
      pg.style.transform = `translate(0px,${((1 - easeOut(t)) * -90).toFixed(1)}px)`;
    });
    fleet.straps.style.opacity = (1 - clamp(pl * 3) * 0.8).toFixed(3);
    statP.textContent = String(landed * 3);
    statT.textContent = String(Math.round(24 * pl));
    statV.textContent = String(Math.round(90 * pl));
    const dm = RM ? 1 : clamp((p - 0.68) / 0.2);
    fleet.dims.forEach((el, i) => {
      const t = clamp(dm * 1.6 - i * 0.3);
      el.style.strokeDashoffset = (1 - easeInOut(t)).toFixed(4);
      dimLabels[i].style.opacity = clamp((t - 0.7) / 0.3).toFixed(3);
    });
    const gp = clamp((dm - 0.5) / 0.3);
    fleet.gps.style.opacity = gp.toFixed(3);
    gpsLabel.style.opacity = gp.toFixed(3);
  }

  // Oferta: karty układają się w stos, poprzednia lekko się cofa
  const servSec = $('#oferta');
  const cards = $$('.card');
  let servTop = 0, servH = 1;
  function renderServices() {
    const tops = cards.map(c => c.getBoundingClientRect().top);
    for (let i = 0; i < cards.length - 1; i++) {
      const stickTop = headerH + 16 + (i + 1) * 18;
      const k = RM ? 0 : clamp((vh - tops[i + 1]) / Math.max(1, vh - stickTop));
      cards[i].style.setProperty('--k', k.toFixed(3));
    }
  }
  $$('[data-art]').forEach(el => {
    const kind = el.dataset.art;
    if (kind === 'ftl') { buildTruck(el, { pallets: 'full', ground: true }); registerStroke(el, 1.2); }
    if (kind === 'ltl') { buildTruck(el, { tractor: false, pallets: 'mixed', ground: true }); registerStroke(el, 1.2); }
    if (kind === 'van') { buildVan(el); registerStroke(el, 1.2); }
    if (kind === 'net') {
      const netMap = buildMap(el, {
        routes: [['Rybnik', 'Berlin'], ['Rybnik', 'Monachium'], ['Rybnik', 'Frankfurt'], ['Berlin', 'Hamburg'], ['Hamburg', 'Amsterdam'],
          ['Amsterdam', 'Rotterdam'], ['Rotterdam', 'Bruksela'], ['Frankfurt', 'Kolonia'], ['Kolonia', 'Bruksela'], ['Bruksela', 'Paryż'],
          ['Frankfurt', 'Zurych'], ['Monachium', 'Zurych'], ['Paryż', 'Lyon'], ['Lyon', 'Mediolan'], ['Zurych', 'Mediolan']],
        labels: { Rybnik: 'r', Berlin: 'r', Hamburg: 'r', Amsterdam: 'l', 'Paryż': 'l', Lyon: 'l', Mediolan: 'r', Monachium: 'r', Frankfurt: 'r' },
        bend: 0.1, r: 4, movers: true
      });
      new IntersectionObserver(([e]) => setPlaying(netMap, e.isIntersecting)).observe(el);
    }
  });

  // Proces: droga przesuwa się w poziomie, ciężarówka „przejeżdża” przez kroki
  const procSec = $('#jak-dzialamy');
  const procTrack = $('#processTrack');
  const procRoad = $('.process__road');
  const procTruckBox = $('#processTruck');
  const procSvg = procTruckBox.querySelector('svg');
  const procTruck = buildTruck(procSvg, { pallets: 'none' });
  registerStroke(procSvg, 1.1);
  const steps = $$('.step');
  const procS = { cur: 0, target: 0 };
  let procTop = 0, procH = 1, trackW = 1, stepX = [], truckFront = 0, wheelPx = 10;
  function renderProcess(p) {
    if (RM) { steps.forEach(s => s.classList.add('is-active')); return; }
    const tx = -Math.max(0, trackW - vw) * p;
    procTrack.style.transform = `translate3d(${tx.toFixed(1)}px,0,0)`;
    const ang = (-tx / wheelPx) * DEG;
    procTruck.wheels.forEach(w => w.g.setAttribute('transform', `rotate(${ang.toFixed(1)} ${w.cx} ${w.cy})`));
    steps.forEach((st, i) => st.classList.toggle('is-active', stepX[i] + tx < truckFront));
  }

  // Przejście w noc przy formularzu
  const contactSec = $('#wycena');
  function renderTheme(y) {
    body.classList.toggle('theme-dark', contactTop - y < vh * 0.62);
  }

  // Wejścia nagłówków i akapitów
  $$('[data-split]').forEach(el => {
    const words = el.textContent.trim().split(/[ \t\n\r]+/);   // twarda spacja (&nbsp;) trzyma słowa razem
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
  });
  const revealIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    revealIO.unobserve(e.target);
  }), { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  $$('[data-split],[data-reveal],.card').forEach(el => revealIO.observe(el));

  /* =====================================================
     5. Formularz, menu, kierunki
     ===================================================== */
  const form = $('#quoteForm');
  const formDone = $('#formDone');
  form.addEventListener('input', e => {
    const f = e.target.closest('.field');
    if (f && e.target.value && e.target.value.trim()) { f.classList.remove('is-invalid'); e.target.removeAttribute('aria-invalid'); }
    if (e.target.name === 'consent' && e.target.checked) form.classList.remove('consent-invalid');
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    let firstBad = null;
    $$('.field input[required]', form).forEach(inp => {
      const bad = !inp.value.trim();
      inp.closest('.field').classList.toggle('is-invalid', bad);
      if (bad) { inp.setAttribute('aria-invalid', 'true'); firstBad = firstBad || inp; }
      else inp.removeAttribute('aria-invalid');
    });
    const consent = form.elements.consent;
    form.classList.toggle('consent-invalid', !consent.checked);
    if (!consent.checked) firstBad = firstBad || consent;
    if (firstBad) { firstBad.focus(); return; }
    form.hidden = true;
    formDone.hidden = false;
    formDone.focus();
    measure();
    kick();
  });
  // „Zapytaj o transport FTL” od razu zaznacza rodzaj transportu w formularzu
  $$('[data-cargo]').forEach(a => a.addEventListener('click', () => {
    const r = form.querySelector(`input[name="cargo"][value="${a.dataset.cargo}"]`);
    if (r) r.checked = true;
  }));

  const menu = $('#menu'), menuBtn = $('#menuBtn'), menuClose = $('#menuClose');
  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    body.classList.toggle('menu-open', open);
    if (lenis) { if (open) lenis.stop(); else lenis.start(); }
    (open ? menuClose : menuBtn).focus({ preventScroll: true });
  }
  menuBtn.addEventListener('click', () => setMenu(true));
  menuClose.addEventListener('click', () => setMenu(false));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false); });
  $$('a[href="#"]').forEach(a => a.addEventListener('click', e => e.preventDefault()));

  // Lista krajów do potwierdzenia z właścicielką
  const PLACES = ['Polska', 'Niemcy', 'Holandia', 'Belgia', 'Francja', 'Luksemburg', 'Austria', 'Szwajcaria', 'Włochy', 'Hiszpania', 'Dania'];
  $('#placesText').textContent = 'Kierunki: ' + PLACES.join(', ') + '.';
  const mTrack = $('#marqueeTrack');
  for (let n = 0; n < 2; n++) {
    const g = document.createElement('div');
    g.className = 'marquee__group';
    PLACES.forEach(name => {
      const s = document.createElement('span'); s.className = 'marquee__item'; s.textContent = name;
      const d = document.createElement('i'); d.className = 'marquee__sep';
      g.append(s, d);
    });
    mTrack.appendChild(g);
  }

  /* =====================================================
     6. Pętla animacji, pomiary, preloader, start
     ===================================================== */
  // Lenis wygładza przewijanie kółkiem i gładzikiem; na dotyku zostaje natywne przewijanie
  let lenis = null;
  if (!RM && typeof window.Lenis === 'function') {
    lenis = new window.Lenis({ autoRaf: true, lerp: 0.085, wheelMultiplier: 0.9, anchors: true });
    lenis.stop();
  }
  const DK = lenis ? 2.4 : 1;   // gdy działa Lenis, własne wygładzanie animacji jest lżejsze

  // Nagłówek chowa się przy przewijaniu w dół i wraca przy przewijaniu w górę (poza hero)
  let lastY = window.scrollY, headerHidden = false;
  function headerAutoHide(y) {
    const inHero = heroTop + heroH - y > headerH;
    let hide = headerHidden;
    if (inHero || menu.classList.contains('is-open') || y < 10) hide = false;
    else if (y - lastY > 4) hide = true;
    else if (y - lastY < -4) hide = false;
    if (hide !== headerHidden) { header.classList.toggle('is-hidden', hide); headerHidden = hide; }
    lastY = y;
  }
  const near = (top, h, y) => y + vh * 1.4 > top && y - vh * 0.4 < top + h;
  function follow(s, target, lambda, dt) {
    s.target = target;
    s.cur = damp(s.cur, target, lambda, dt);
    if (Math.abs(s.cur - s.target) < 0.0004) { s.cur = s.target; return false; }
    return true;
  }
  let loopOn = false, lastT = 0;
  function kick() {
    if (loopOn) return;
    loopOn = true;
    lastT = performance.now();
    requestAnimationFrame(tick);
  }
  function tick(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
    lastT = now;
    const y = window.scrollY;
    let busy = false;

    if (introRunning) {
      introT = clamp((now - introStart) / 1000);
      measureSlot();
      if (now > introStart + 1500) { introRunning = false; introT = 1; measureSlot(); }
      busy = true;
    }
    busy = follow(heroS, clamp((y - heroTop) / Math.max(1, heroH - vh)), 9 * DK, dt) || busy;
    if (near(heroTop, heroH, y)) renderHero(heroS.cur);
    headerState(y, heroS.cur);
    headerAutoHide(y);

    if (near(stTop, stH, y)) renderStatement(y);

    busy = follow(fleetS, clamp((y - fleetTop) / Math.max(1, fleetH - vh)), 7 * DK, dt) || busy;
    if (near(fleetTop, fleetH, y)) renderFleet(fleetS.cur);

    if (near(servTop, servH, y)) renderServices();

    busy = follow(procS, clamp((y - procTop) / Math.max(1, procH - vh)), 8 * DK, dt) || busy;
    if (near(procTop, procH, y)) renderProcess(procS.cur);

    renderTheme(y);

    if (busy) requestAnimationFrame(tick);
    else loopOn = false;
  }

  function measure() {
    vw = window.innerWidth; vh = window.innerHeight;
    headerH = header.offsetHeight;
    heroTop = pageTop(hero); heroH = hero.offsetHeight;
    padPx = parseFloat(getComputedStyle(copy).paddingLeft) || 20;
    fitTitle();
    measureSlot();
    stTop = pageTop(stSec); stH = stSec.offsetHeight;
    fleetTop = pageTop(fleetSec); fleetH = fleetSec.offsetHeight;
    const fb = fleetSvg.getBoundingClientRect();
    const sc = fb.width / 1860 || 1;
    fleetStartX = -(fb.left / sc) - 1800;
    servTop = pageTop(servSec); servH = servSec.offsetHeight;
    procTop = pageTop(procSec); procH = procSec.offsetHeight;
    trackW = procTrack.scrollWidth;
    stepX = steps.map(s => s.offsetLeft);
    truckFront = procTruckBox.offsetLeft + procTruckBox.offsetWidth * 0.95;
    wheelPx = WHEEL_R * ((procSvg.getBoundingClientRect().width || 300) / 1740);
    const roadTop = procRoad.offsetTop;
    steps.forEach(s => s.style.setProperty('--drop', Math.max(0, roadTop - (s.offsetTop + s.offsetHeight)) + 'px'));
    contactTop = pageTop(contactSec);
    updateStrokes();
  }

  window.addEventListener('scroll', kick, { passive: true });
  let resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { sizeRoad(false); measure(); kick(); }, 120);
  });

  // Preloader: znak „STI” wypełnia się, czekamy na fonty i wideo (z limitem)
  const loader = $('#loader');
  const countEl = $('#loaderCount');
  const t0 = performance.now();
  const MIN = RM ? 250 : 1700, MAX = 5000;
  let fontsDone = false, shown = 0, finished = false;
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
    .then(() => { fontsDone = true; if (finished) { measure(); kick(); } }, () => { fontsDone = true; });
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { if (finished) { measure(); kick(); } });

  function loaderStep(now) {
    const el = now - t0;
    const ready = (fontsDone && (videoSettled || el > 2600)) || el > MAX;   // wolne wideo nie blokuje strony
    const timeP = clamp(el / MIN);
    const target = ready ? timeP : Math.min(timeP, 0.86);
    shown += (target - shown) * (RM ? 1 : 0.1);
    if (Math.abs(target - shown) < 0.003) shown = target;
    loader.style.setProperty('--p', shown.toFixed(4));
    countEl.textContent = String(Math.round(shown * 100));
    if (ready && shown >= 1) finishLoader();
    else requestAnimationFrame(loaderStep);
  }
  function finishLoader() {
    if (finished) return;
    finished = true;
    sizeRoad(true);
    measure();
    loader.classList.add('is-done');
    body.classList.remove('is-loading');
    body.classList.add('is-ready');
    if (lenis) lenis.start();
    if (RM) introT = 1;
    else { introStart = performance.now() + 620; introRunning = true; }
    const target = location.hash && document.getElementById(location.hash.slice(1));
    if (target) { if (lenis) lenis.scrollTo(target, { immediate: true }); else window.scrollTo(0, pageTop(target)); }
    kick();
    startRoad();
    setTimeout(() => { loader.remove(); measure(); kick(); }, 1300);
  }

  // Start
  sizeRoad(true);
  measure();
  renderHero(0);
  renderFleet(0);
  renderProcess(0);
  if (video.readyState >= 2) onVideoReady();
  else if (video.networkState === 3 || video.error) settle();
  requestAnimationFrame(loaderStep);
})();

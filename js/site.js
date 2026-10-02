/* =========================================================
   STItrans — podstrony: blog, artykuły, dokumenty
   Wspólny kod (języki, rysunki, menu) jest w js/core.js
   1. Nagłówek i płynne przewijanie
   2. Okładki
   3. Kalkulator FTL / LTL
   4. Branże (zakładki)
   5. „Czy to ekspres?” i oś czasu zlecenia
   ========================================================= */
(() => {
  'use strict';
  const S = window.STI;
  const { $, $$, body, RM, clamp, tr, PL_T, i18nHooks, registerStroke, updateStrokes, svgEl, P, buildLoadPlan, buildCoils, buildStopwatch } = S;

  /* ---------- 1. Nagłówek i płynne przewijanie ---------- */
  const header = $('#header');
  const menu = $('#menu');
  const darkZones = $$('[data-header="dark"]');
  let lenis = null;
  if (!RM && typeof window.Lenis === 'function') {
    lenis = new window.Lenis({ autoRaf: true, lerp: 0.085, wheelMultiplier: 0.9, anchors: true });
    S.lenis = lenis;
  }
  let lastY = window.scrollY, hidden = false, ticking = false;
  function onScroll() {
    const y = window.scrollY, hh = header.offsetHeight;
    // ciemny nagłówek nad ciemnymi sekcjami (okładka artykułu, pas z wyceną, stopka)
    const overDark = darkZones.some(el => { const r = el.getBoundingClientRect(); return r.top <= hh / 2 && r.bottom >= hh / 2; });
    header.classList.toggle('is-dark', overDark);
    header.classList.toggle('is-solid', y > 8);
    header.classList.toggle('is-scrolled', y > 40);
    S.renderLogo(y);
    // chowa się przy przewijaniu w dół, wraca przy przewijaniu w górę
    let hide = hidden;
    if (y < 80 || (menu && menu.classList.contains('is-open'))) hide = false;
    else if (y - lastY > 4) hide = true;
    else if (y - lastY < -4) hide = false;
    if (hide !== hidden) { header.classList.toggle('is-hidden', hide); hidden = hide; }
    lastY = y;
    renderTimelines();
    ticking = false;
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  let resizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { updateStrokes(); onScroll(); }, 120); });
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', updateStrokes);
  body.classList.add('is-ready');

  /* ---------- 2. Okładki (te same rysunki co na stronie głównej) ---------- */
  $$('[data-cover]').forEach(svg => {
    const kind = svg.dataset.cover;
    if (kind === 'plan') buildLoadPlan(svg);
    if (kind === 'coils') buildCoils(svg);
    if (kind === 'watch') buildStopwatch(svg);
    registerStroke(svg, 1.2);
  });

  /* ---------- 3. Kalkulator FTL / LTL ---------- */
  Object.assign(PL_T, {
    'calc.ltl': 'Płacisz tylko za miejsca, które zajmujesz. Przy kilku paletach to zwykle najkorzystniejsza opcja.',
    'calc.both': 'W tym przedziale o cenie decydują trasa, waga i termin. Wycenimy LTL i FTL, żebyś mógł porównać.',
    'calc.ftl': 'Przy takiej liczbie palet cała naczepa zwykle wychodzi korzystniej, a towar jedzie bez przeładunków.',
    'calc.exp': 'Mały, pilny albo delikatny ładunek najlepiej wysłać dedykowanym pojazdem, bez przeładunków po drodze.',
    'calc.ftl.urgent': 'Duży ładunek z krytycznym terminem jedzie najbezpieczniej jako pełna naczepa, prosto do odbiorcy.',
    'check.0': 'Prawdopodobnie wystarczy transport standardowy.',
    'check.0.why': 'Jeśli termin ma zapas, FTL albo LTL wyjdzie taniej.',
    'check.2': 'Warto rozważyć ekspres.',
    'check.2.why': 'Wycenimy ekspres i transport standardowy, żebyś mógł porównać koszt z ryzykiem opóźnienia.',
    'check.4': 'To zadanie dla ekspresu.',
    'check.4.why': 'Dedykowany pojazd, bez przeładunków i z monitoringiem przez całą drogę.'
  });
  // link do formularza wyceny na stronie głównej z uzupełnionymi danymi
  const quoteHref = params => {
    const q = new URLSearchParams(params);
    if (S.lang() !== 'pl') q.set('lang', S.lang());
    return `../index.html?${q.toString()}#wycena`;
  };

  const calc = $('#calc');
  if (calc) {
    const range = $('#calcPallets'), out = $('#calcOut'), urgent = $('#calcUrgent'), pct = $('#calcPct');
    const verdict = $('#calcVerdict'), why = $('#calcWhy'), cta = $('#calcCta'), svg = $('.calc__svg', calc);
    const X0 = 36, Y0 = 34, W = 506, H = 132, cw = W / 11, chh = H / 3, cells = [];
    svgEl('path', { d: P.rect(X0 - 10, Y0 - 10, W + 20, H + 20, 10), class: 'cv-trailer' }, svg);
    svgEl('path', { d: P.rect(X0 + W + 22, Y0 + 12, 56, H - 24, 14), class: 'cv-trailer' }, svg);   // ciągnik z góry
    svgEl('path', { d: P.line(X0 + W + 66, Y0 + 22, X0 + W + 66, Y0 + H - 22), class: 'calc__ink' }, svg);
    // palety ładowane od tyłu naczepy, rząd po rzędzie
    for (let c = 0; c < 11; c++) {
      for (let r = 0; r < 3; r++) {
        cells.push(svgEl('path', { d: P.rect(+(X0 + c * cw + 3).toFixed(1), +(Y0 + r * chh + 3).toFixed(1), +(cw - 6).toFixed(1), +(chh - 6).toFixed(1), 3), class: 'calc__cell' }, svg));
      }
    }
    registerStroke(svg, 1.2);
    function render() {
      const n = +range.value, u = urgent.checked;
      out.textContent = String(n);
      pct.textContent = String(Math.round(n / 33 * 100));
      range.setAttribute('aria-valuetext', `${n} / 33`);
      cells.forEach((el, i) => el.classList.toggle('is-on', i < n));
      let mode, title, text;
      if (u) {
        if (n <= 10) { mode = 'Ekspres'; title = 'Transport ekspresowy'; text = 'calc.exp'; }
        else { mode = 'FTL'; title = 'Transport całopojazdowy (FTL)'; text = 'calc.ftl.urgent'; }
      } else if (n <= 10) { mode = 'LTL'; title = 'Transport częściowy (LTL)'; text = 'calc.ltl'; }
      else if (n <= 17) { mode = 'Nie wiem'; title = 'Wycenimy oba warianty'; text = 'calc.both'; }
      else { mode = 'FTL'; title = 'Transport całopojazdowy (FTL)'; text = 'calc.ftl'; }
      verdict.textContent = tr(title);
      why.textContent = tr(text);
      calc.dataset.mode = mode;
      cta.setAttribute('href', quoteHref({ cargo: mode, palety: n }));
    }
    range.addEventListener('input', render);
    urgent.addEventListener('change', render);
    i18nHooks.push(render);
    render();
  }

  /* ---------- 4. Branże: zakładki z obsługą strzałek ---------- */
  $$('.tabs').forEach(box => {
    const tabs = $$('[role="tab"]', box), panels = $$('[role="tabpanel"]', box);
    function select(i, focus) {
      tabs.forEach((b, j) => {
        const on = j === i;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
      updateStrokes();
    }
    tabs.forEach((b, i) => {
      b.addEventListener('click', () => select(i));
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        select((i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length, true);
      });
    });
    select(0);
  });

  /* ---------- 5. „Czy to ekspres?” i oś czasu zlecenia ---------- */
  const check = $('#check');
  if (check) {
    const boxes = $$('input[type="checkbox"]', check);
    const verdict = $('#checkVerdict'), why = $('#checkWhy'), cta = $('#checkCta');
    function render() {
      const n = boxes.filter(b => b.checked).length;
      const key = n <= 1 ? 'check.0' : n === 2 ? 'check.2' : 'check.4';
      verdict.textContent = tr(key);
      why.textContent = tr(key + '.why');
      check.style.setProperty('--n', String(n / boxes.length));
      cta.setAttribute('href', quoteHref({ cargo: n >= 2 ? 'Ekspres' : 'Nie wiem' }));
    }
    boxes.forEach(b => b.addEventListener('change', render));
    i18nHooks.push(render);
    render();
  }
  const timelines = $$('.timeline');
  function renderTimelines() {
    const line = window.innerHeight * 0.62;
    timelines.forEach(tl => {
      if (tl.offsetParent === null) return;            // oś w ukrytym języku
      const r = tl.getBoundingClientRect();
      tl.style.setProperty('--tp', clamp((line - r.top) / Math.max(1, r.height)).toFixed(3));
      $$('.timeline__step', tl).forEach(st => st.classList.toggle('is-on', st.getBoundingClientRect().top < line));
    });
  }
  i18nHooks.push(() => { updateStrokes(); onScroll(); });
  onScroll();
})();

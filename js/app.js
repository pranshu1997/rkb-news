import { TABS, textOf, visible, groupByDay, dayLabel, parseWatch, pruneDismissed, ago, isStale, shareText, fmtDate } from './logic.js';

export const APP_VERSION = 'rkb-v2'; // bump with CACHE in sw.js; tests/logic.test.mjs checks they match

// ── Phone storage (no login, no server: each phone keeps its own) ──
const KEY = { news: 'rkb.news', lang: 'rkb.lang', dismissed: 'rkb.dismissed', saved: 'rkb.saved', watch: 'rkb.watch', size: 'rkb.size', theme: 'rkb.theme', tab: 'rkb.tab' };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full: next tap still works in memory */ } };

const S = {
  news: load(KEY.news, { updated: null, items: [] }),
  lang: load(KEY.lang, 'en'),
  dismissed: pruneDismissed(load(KEY.dismissed, {})),
  saved: load(KEY.saved, {}),   // id -> full item, so saved stories outlive the 7-day cleanup
  watch: load(KEY.watch, []),
  tab: load(KEY.tab, 'politics'),
};
keep(KEY.dismissed, S.dismissed);
document.documentElement.dataset.size = load(KEY.size, 'normal');

const L = {
  en: { updated: 'Updated', never: 'Not updated yet', refresh: 'Refresh', saved: 'Saved', settings: 'Settings', read: 'Read more',
    listen: 'Listen', stop: 'Stop', share: 'Share on WhatsApp', save: 'Save', unsave: 'Remove from saved', dismiss: 'Dismiss',
    removed: 'Removed', clear: 'Clear', clearDay: 'Clear this day', removedN: n => `Removed ${n} stories`, undo: 'Undo', also: 'Also in', watch: 'Watchlist', pay: 'Subscribers only', reserve: 'Reserve',
    auction: 'Auction', empty: 'All read. New news comes at 6 am and 6 pm.', noSaved: 'Nothing saved yet. Tap the bookmark on a story to keep it.',
    stale: h => `News last came ${h} hours ago. Pull down to refresh.`, offline: 'Offline. Showing the last news.', newest: 'This is the newest news',
    failed: 'Could not refresh. Showing the last news.', close: 'Close', size: 'Text size', sizes: ['Normal', 'Large', 'Larger'],
    theme: 'Appearance', themes: ['Auto', 'Light', 'Dark'], watchHelp: 'One name per line: clients, companies, people. Stories that name them come first.',
    watchSaved: 'Watchlist saved', restore: n => `Show ${n} removed stories again`, restored: 'Removed stories are back', stories: n => `${n} stories` },
  hi: { updated: 'अपडेट', never: 'अभी अपडेट नहीं हुआ', refresh: 'ताज़ा करें', saved: 'सहेजी गई', settings: 'सेटिंग', read: 'पूरा पढ़ें',
    listen: 'सुनें', stop: 'रोकें', share: 'WhatsApp पर भेजें', save: 'सहेजें', unsave: 'सहेजी से हटाएँ', dismiss: 'हटाएँ',
    removed: 'हटा दी', clear: 'हटाएँ', clearDay: 'इस दिन की खबरें हटाएँ', removedN: n => `${n} खबरें हटा दीं`, undo: 'वापस लाएँ', also: 'यह भी', watch: 'वॉचलिस्ट', pay: 'सिर्फ़ सदस्य', reserve: 'आरक्षित मूल्य',
    auction: 'नीलामी', empty: 'सब पढ़ लिया। नई खबरें सुबह 6 और शाम 6 बजे आती हैं।', noSaved: 'अभी कुछ नहीं सहेजा। खबर पर बुकमार्क दबाएँ।',
    stale: h => `खबरें ${h} घंटे पहले आई थीं। ताज़ा करने के लिए नीचे खींचें।`, offline: 'इंटरनेट नहीं है। पिछली खबरें दिख रही हैं।', newest: 'यही सबसे नई खबरें हैं',
    failed: 'ताज़ा नहीं हो सका। पिछली खबरें दिख रही हैं।', close: 'बंद करें', size: 'अक्षर का आकार', sizes: ['सामान्य', 'बड़ा', 'और बड़ा'],
    theme: 'रंग', themes: ['ऑटो', 'हल्का', 'गहरा'], watchHelp: 'हर लाइन में एक नाम: क्लाइंट, कंपनी, व्यक्ति। इनकी खबरें सबसे ऊपर आएँगी।',
    watchSaved: 'वॉचलिस्ट सहेजी गई', restore: n => `हटाई गई ${n} खबरें फिर दिखाएँ`, restored: 'हटाई गई खबरें वापस आ गईं', stories: n => `${n} खबरें` },
};
const t = () => L[S.lang];

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  politics: svg('<path d="M3 21h18M5 21V10M9.5 21V10M14.5 21V10M19 21V10M2 10l10-6 10 6z"/>'),
  business: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>'),
  market: svg('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>'),
  legal: svg('<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>'),
  auctions: svg('<path d="M14 4l6 6M11 7l6 6M12.5 5.5l-4 4M18.5 11.5l-4 4M10 12l-7 7M3 21h10"/>'),
  results: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 17v-3M12 17v-6M16 17v-4"/>'),
  refresh: svg('<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>'),
  saved: svg('<path d="M6 3h12v18l-6-4-6 4z"/>'),
  savedOn: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  listen: svg('<path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>'),
  stop: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  share: svg('<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.5A8.4 8.4 0 1 1 21 11.5z"/>'),
  close: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  out: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
};
const safeUrl = u => (/^https?:\/\//i.test(u ?? '') ? u : '#'); // feed text decides the link; never a javascript: URL
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const $ = s => document.querySelector(s);

// ── Rendering ─────────────────────────────────────────────────────
const root = $('#app');
root.innerHTML = `
  <header class="top">
    <div class="acts">
      <button class="icon" data-act="refresh">${ICON.refresh}</button>
      ${window.RKB ? '' : '<div class="seg" role="group" aria-label="Language"><button data-lang="en">EN</button><button data-lang="hi" lang="hi">हि</button></div>'}
      <button class="icon" data-act="saved">${ICON.saved}</button>
      ${window.RKB ? '' : `<button class="icon" data-act="settings">${ICON.settings}</button>`}
    </div>
  </header>
  <div class="large-title"><h1 data-title></h1><p class="sub"><span data-count></span><span data-stamp></span></p></div>
  <div class="banner" data-stale hidden></div>
  <section data-list></section>
  <nav class="tabs">${TABS.map(x => `<button data-tab="${x.id}">${ICON[x.id]}<span></span></button>`).join('')}</nav>`;

function storyHTML(it, { inSaved = false } = {}) {
  const x = textOf(it, S.lang);
  const facts = it.tab === 'results' ? esc(it.key_numbers ?? '')
    : it.tab === 'auctions' ? [it.city, it.reserve && `${t().reserve} ${it.reserve}`, it.auction_date && `${t().auction} ${fmtDate(it.auction_date, S.lang)}`].filter(Boolean).map(f => `<span>${esc(f)}</span>`).join(' · ')
    : '';
  const saved = it.id in S.saved;
  return `<article class="story" data-id="${esc(it.id)}" lang="${x.lang}">
    <div class="meta"><span>${esc(it.source)} · ${esc(ago(it.time, S.lang))}</span>
      ${it.watch ? `<span class="tag watch">${t().watch}: ${esc(it.watch)}</span>` : ''}
      ${it.paywall ? `<span class="tag pay">${t().pay}</span>` : ''}</div>
    <h2>${esc(x.title)}</h2>
    ${facts ? `<p class="facts">${facts}</p>` : ''}
    ${x.summary ? `<p class="sum">${esc(x.summary)}</p>` : ''}
    ${it.also?.length ? `<p class="also">${t().also} ${esc(it.also.join(', '))}</p>` : ''}
    <div class="row">
      <a class="btn link read" href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener">${t().read}</a>
      <div class="acts">
        <button class="icon" data-act="listen" aria-label="${t().listen}">${ICON.listen}</button>
        <button class="icon" data-act="share" aria-label="${t().share}">${ICON.share}</button>
        <button class="icon" data-act="save" aria-label="${saved ? t().unsave : t().save}" aria-pressed="${saved}">${saved ? ICON.savedOn : ICON.saved}</button>
        ${inSaved ? '' : `<button class="icon" data-act="dismiss" aria-label="${t().dismiss}">${ICON.close}</button>`}
      </div>
    </div>
  </article>`;
}

let shown = [], dayGroups = [];
function render() {
  const tab = TABS.find(x => x.id === S.tab) ?? TABS[0];
  document.documentElement.lang = S.lang;
  $('[data-title]').textContent = tab[S.lang];
  const groups = dayGroups = groupByDay(visible(S.news.items, tab.id, S.dismissed, S.watch));
  shown = groups.flatMap(g => g.items);
  $('[data-count]').textContent = shown.length ? t().stories(shown.length) : '';
  $('[data-list]').innerHTML = shown.length
    ? groups.map(g => `<section class="day" data-day="${g.day}"><header class="day-head"><h3>${dayLabel(g.day, S.lang)}</h3><button class="link" data-act="clear-day" aria-label="${t().clearDay}">${t().clear}</button></header><div class="list">${g.items.map(i => storyHTML(i)).join('')}</div></section>`).join('')
    : `<p class="empty">${t().empty}</p>`;
  const u = S.news.updated;
  $('[data-stamp]').textContent = u ? `${t().updated} ${new Date(u).toLocaleString(S.lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : t().never;
  const stale = $('[data-stale]');
  stale.hidden = !(u && isStale(u));
  if (!stale.hidden) stale.textContent = t().stale(Math.round((Date.now() - Date.parse(u)) / 36e5));
  document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === S.lang));
  document.querySelectorAll('.tabs button').forEach(b => {
    const x = TABS.find(y => y.id === b.dataset.tab);
    b.classList.toggle('on', x.id === tab.id);
    b.querySelector('span').textContent = x[S.lang];
  });
  for (const [act, key] of [['refresh', 'refresh'], ['saved', 'saved'], ['settings', 'settings']]) {
    const b = root.querySelector(`.top [data-act=${act}]`);
    if (!b) continue; // no Settings button inside RKB
    b.setAttribute('aria-label', t()[key]);
    b.title = t()[key];
  }
}

// ── Toast with Undo ──────────────────────────────────────────────
let toastTimer;
function toast(msg, undo) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button>${t().undo}</button>` : ''}`;
  if (undo) el.querySelector('button').onclick = () => { hideToast(); undo(); };
  el.className = 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, undo ? 5000 : 2500);
}
function hideToast() { clearTimeout(toastTimer); $('#toast').className = ''; }

// ── Actions ──────────────────────────────────────────────────────
const byId = id => shown.find(i => i.id === id) ?? S.news.items.find(i => i.id === id) ?? S.saved[id];

function dismiss(id, el) {
  S.dismissed[id] = Date.now();
  keep(KEY.dismissed, S.dismissed);
  const done = () => render();
  if (el && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.classList.add('gone');
    setTimeout(done, 200);
  } else done();
  toast(t().removed, () => { delete S.dismissed[id]; keep(KEY.dismissed, S.dismissed); render(); });
}

function clearDay(day) {
  const ids = dayGroups.find(g => g.day === day).items.map(i => i.id);
  const now = Date.now();
  ids.forEach(id => { S.dismissed[id] = now; });
  keep(KEY.dismissed, S.dismissed);
  render();
  toast(t().removedN(ids.length), () => { ids.forEach(id => delete S.dismissed[id]); keep(KEY.dismissed, S.dismissed); render(); });
}

function toggleSave(id) {
  if (id in S.saved) delete S.saved[id];
  else { const { watch, ...it } = byId(id); S.saved[id] = it; }
  keep(KEY.saved, S.saved);
}

let speaking = null;
function listen(id, btn) {
  speechSynthesis.cancel();
  document.querySelectorAll('[data-act=listen]').forEach(b => { b.innerHTML = ICON.listen; b.setAttribute('aria-label', t().listen); });
  if (speaking === id) return (speaking = null);
  const x = textOf(byId(id), S.lang);
  const u = new SpeechSynthesisUtterance(`${x.title}. ${x.summary ?? ''}`);
  u.lang = x.lang === 'hi' ? 'hi-IN' : 'en-IN';
  u.rate = 0.9;
  u.onend = u.onerror = () => { if (speaking === id) { speaking = null; btn.innerHTML = ICON.listen; } };
  speaking = id;
  btn.innerHTML = ICON.stop;
  btn.setAttribute('aria-label', t().stop);
  speechSynthesis.speak(u);
}

function share(id) {
  // wa.me opens the WhatsApp app on both phones; one tap to the contact list.
  open(`https://wa.me/?text=${encodeURIComponent(shareText(byId(id), S.lang))}`, '_blank', 'noopener');
}

document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const story = b.closest('.story');
  const id = story?.dataset.id;
  if (b.dataset.tab) {
    S.tab = b.dataset.tab; keep(KEY.tab, S.tab); speechSynthesis.cancel(); speaking = null; render(); scrollTo(0, 0);
  } else if (b.dataset.lang) {
    S.lang = b.dataset.lang; keep(KEY.lang, S.lang); speechSynthesis.cancel(); speaking = null; render();
  } else if (b.dataset.act === 'clear-day') clearDay(b.closest('.day').dataset.day);
  else if (b.dataset.act === 'dismiss') dismiss(id, story);
  else if (b.dataset.act === 'save') {
    toggleSave(id);
    const on = id in S.saved;
    b.innerHTML = on ? ICON.savedOn : ICON.saved;
    b.setAttribute('aria-pressed', on);
    b.setAttribute('aria-label', on ? t().unsave : t().save);
    if (b.closest('dialog')) openSaved();
  } else if (b.dataset.act === 'listen') listen(id, b);
  else if (b.dataset.act === 'share') share(id);
  else if (b.dataset.act === 'refresh') refresh(b);
  else if (b.dataset.act === 'saved') openSaved();
  else if (b.dataset.act === 'settings') openSettings();
});

// Swipe left to dismiss. touch-action: pan-y keeps vertical scrolling native.
let drag = null;
document.addEventListener('pointerdown', e => {
  const s = e.target.closest('[data-list] .story');
  if (!s || e.target.closest('button, a') || e.pointerType === 'mouse') return;
  drag = { s, x: e.clientX, y: e.clientY, dx: 0 };
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  drag.dx = Math.min(0, e.clientX - drag.x);
  if (Math.abs(e.clientY - drag.y) > 24 && Math.abs(drag.dx) < 24) return (drag.s.style.transform = '', drag = null);
  drag.s.classList.add('dragging');
  drag.s.style.transform = `translateX(${drag.dx}px)`;
});
const endDrag = () => {
  if (!drag) return;
  const { s, dx } = drag;
  drag = null;
  s.classList.remove('dragging');
  s.style.transform = '';
  if (dx < -Math.min(140, s.offsetWidth * 0.35)) dismiss(s.dataset.id, s);
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// ── Sheets ───────────────────────────────────────────────────────
function sheet(title, body) {
  document.querySelector('dialog.sheet')?.remove();
  const d = document.createElement('dialog');
  d.className = 'sheet';
  d.innerHTML = `<div class="grab"></div><header><h2>${esc(title)}</h2><button class="link" data-close>${t().close}</button></header><div class="body">${body}</div>`;
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
  d.addEventListener('close', () => { d.remove(); render(); });
  document.body.append(d);
  d.showModal();
  return d;
}

function openSaved() {
  const items = Object.values(S.saved).sort((a, b) => (a.time < b.time ? 1 : -1));
  const body = items.length ? `<div class="list">${items.map(i => storyHTML(i, { inSaved: true })).join('')}</div>` : `<p class="empty">${t().noSaved}</p>`;
  const open = document.querySelector('dialog.sheet[data-kind=saved]');
  if (open) return (open.querySelector('.body').innerHTML = body);
  sheet(t().saved, body).dataset.kind = 'saved';
}

// Inside RKB the shell owns language, text size and appearance; the gear's panel gets the rest.
if (window.RKB) window.RKB.mountSettings = slot => {
  const n = Object.keys(S.dismissed).filter(id => S.news.items.some(i => i.id === id)).length;
  slot.innerHTML = `<label class="field"><span>${t().watch}</span><textarea data-watch rows="5" placeholder="Tata Steel&#10;Jaiprakash Associates">${esc(S.watch.join('\n'))}</textarea><small>${t().watchHelp}</small></label>
    ${n ? `<button class="link" data-restore>${t().restore(n)}</button>` : ''}<p class="version">RKB News ${APP_VERSION}</p>`;
  slot.querySelector('[data-watch]').addEventListener('change', e => { S.watch = parseWatch(e.target.value); keep(KEY.watch, S.watch); toast(t().watchSaved); });
  slot.querySelector('[data-restore]')?.addEventListener('click', e => { S.dismissed = {}; keep(KEY.dismissed, S.dismissed); e.target.remove(); toast(t().restored); render(); });
};

function openSettings() {
  const size = document.documentElement.dataset.size, theme = load(KEY.theme, 'system');
  const n = Object.keys(S.dismissed).filter(id => S.news.items.some(i => i.id === id)).length;
  const d = sheet(t().settings, `
    <div class="field"><span>${t().size}</span><div class="seg" data-pick="size">${['normal', 'large', 'larger'].map((v, i) => `<button data-v="${v}" aria-pressed="${v === size}">${t().sizes[i]}</button>`).join('')}</div></div>
    <div class="field"><span>${t().theme}</span><div class="seg" data-pick="theme">${['system', 'light', 'dark'].map((v, i) => `<button data-v="${v}" aria-pressed="${v === theme}">${t().themes[i]}</button>`).join('')}</div></div>
    <label class="field"><span>${t().watch}</span><textarea data-watch rows="5" placeholder="Tata Steel&#10;Jaiprakash Associates">${esc(S.watch.join('\n'))}</textarea><small>${t().watchHelp}</small></label>
    ${n ? `<button class="link" data-restore>${t().restore(n)}</button>` : ''}
    <p class="version">RKB News ${APP_VERSION}</p>`);
  d.addEventListener('click', e => {
    const b = e.target.closest('[data-pick] button');
    if (b) {
      const kind = b.parentElement.dataset.pick;
      b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      if (kind === 'size') { document.documentElement.dataset.size = b.dataset.v; keep(KEY.size, b.dataset.v); }
      else { document.documentElement.dataset.theme = b.dataset.v; keep(KEY.theme, b.dataset.v); }
    }
    if (e.target.closest('[data-restore]')) {
      S.dismissed = {}; keep(KEY.dismissed, S.dismissed); e.target.closest('[data-restore]').remove(); toast(t().restored);
    }
  });
  d.querySelector('[data-watch]').addEventListener('change', e => {
    S.watch = parseWatch(e.target.value); keep(KEY.watch, S.watch); toast(t().watchSaved);
  });
}

// ── Data: paint the phone's copy first, then ask the network ─────
async function fetchNews() {
  const r = await fetch(`data/news.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(r.status);
  const doc = await r.json();
  if (!Array.isArray(doc?.items)) throw new Error('bad news.json');
  const fresh = doc.updated !== S.news.updated;
  S.news = { updated: doc.updated, items: doc.items };
  keep(KEY.news, S.news);
  return fresh;
}

let refreshing = null;
async function refresh(btn) {
  if (refreshing) return refreshing;
  btn?.classList.add('spin');
  refreshing = (async () => {
    try {
      navigator.serviceWorker?.getRegistration().then(r => r?.update()).catch(() => {});
      const fresh = await fetchNews();
      render();
      if (btn) toast(fresh ? t().updated : t().newest);
    } catch {
      toast(navigator.onLine ? t().failed : t().offline);
    } finally {
      btn?.classList.remove('spin');
      refreshing = null;
    }
  })();
  return refreshing;
}

// Pull down to refresh (Pulse js/app.js): home-screen apps have no browser refresh.
const ptr = Object.assign(document.createElement('div'), { id: 'ptr', innerHTML: ICON.refresh });
document.body.append(ptr);
let pullStart = null;
addEventListener('touchstart', e => { pullStart = scrollY <= 0 && !document.querySelector('dialog[open]') ? e.touches[0].clientY : null; }, { passive: true });
addEventListener('touchmove', e => {
  if (pullStart == null) return;
  const d = Math.max(0, Math.min(120, e.touches[0].clientY - pullStart));
  ptr.style.opacity = Math.min(1, d / 50);
  ptr.style.transform = `translateY(${d - 70}px) rotate(${d * 3}deg)`;
}, { passive: true });
addEventListener('touchend', async e => {
  if (pullStart == null) return;
  const pulled = e.changedTouches[0].clientY - pullStart > 80;
  pullStart = null;
  if (!pulled) return (ptr.style.transform = '', ptr.style.opacity = '');
  ptr.style.transform = 'translateY(0)';
  ptr.style.opacity = 1;
  ptr.classList.add('spin');
  await refresh();
  ptr.classList.remove('spin');
  ptr.style.transform = '';
  ptr.style.opacity = '';
});

const net = $('#net');
const showNet = () => { net.hidden = navigator.onLine; net.textContent = t().offline; };
addEventListener('online', () => { showNet(); refresh(); });
addEventListener('offline', showNet);
// Coming back to the app after hours: fetch the new batch without a pull.
document.addEventListener('visibilitychange', () => { if (!document.hidden && isStale(S.news.updated, Date.now() + 3 * 36e5)) refresh(); });

if ('serviceWorker' in navigator) {
  // A new version takes over at once (sw.js skipWaiting); reload so the page runs it. Not on the first visit.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  if (!window.RKB) navigator.serviceWorker.register('sw.js'); // inside RKB the shell's worker serves every app
}

render();
showNet();
refresh();
window.__ready = true;
if (window.RKB) window.RKB.signOut = async () => true; // News has no login

// Pure functions: no DOM, no storage. tests/logic.test.mjs runs them in node.

export const TABS = [
  { id: 'politics', en: 'Politics', hi: 'राजनीति' },
  { id: 'business', en: 'Business', hi: 'व्यापार' },
  { id: 'market', en: 'Market', hi: 'शेयर बाज़ार' },
  { id: 'legal', en: 'Legal', hi: 'कानून' },
  { id: 'auctions', en: 'Auctions', hi: 'नीलामी' },
  { id: 'results', en: 'Results', hi: 'नतीजे' },
];

// Hindi falls back to English per item: a batch the free model missed still shows, in English.
export function textOf(item, lang) {
  const hi = lang === 'hi' && item.title_hi;
  return { title: hi ? item.title_hi : item.title, summary: hi ? item.summary_hi : item.summary, lang: hi ? 'hi' : 'en' };
}

const norm = s => ` ${String(s ?? '').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ' ')} `;

// Whole-word match on names Papa or Pranshu typed ("Tata Steel" must not match "Tata Steelworks").
export function watchHit(item, names) {
  const hay = norm(`${item.title} ${item.summary} ${item.text} ${item.title_hi ?? ''}`);
  return names.find(n => norm(n).trim() && hay.includes(norm(n))) ?? null;
}

export function parseWatch(text) {
  return [...new Set(String(text ?? '').split(/[\n,]/).map(s => s.trim()).filter(s => s.length >= 2))];
}

// One tab's list: dismissed items gone, watchlist hits first, then newest first.
export function visible(items, tab, dismissed, names) {
  return items
    .filter(i => i.tab === tab && !(i.id in dismissed))
    .map(i => ({ ...i, watch: watchHit(i, names) }))
    .sort((a, b) => (!!b.watch - !!a.watch) || (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
}

// Client shows today + the 2 days before (IST). The job's KEEP_DAYS (7) is separate.
export const SHOW_DAYS = 3;
const IST_MS = 330 * 6e4;
export const istDay = ms => new Date(ms + IST_MS).toISOString().slice(0, 10);

// Items (already in display order) grouped by IST day, newest day first; older than SHOW_DAYS dropped.
// Order inside a day is kept, so watchlist hits stay first. Future-stamped items count as today.
// An auction notice is never cut by SHOW_DAYS while its auction date (dd-mm-yyyy, as the job keeps it) is today or later.
const auctionOpen = (i, today) => {
  const m = /^(\d\d)-(\d\d)-(\d{4})$/.exec(String(i.auction_date ?? '').trim());
  return i.tab === 'auctions' && !!m && `${m[3]}-${m[2]}-${m[1]}` >= today;
};
export function groupByDay(items, now = Date.now()) {
  const today = istDay(now), oldest = istDay(now - (SHOW_DAYS - 1) * 864e5), groups = new Map();
  for (const i of items) {
    const d = [istDay(Date.parse(i.time)), today].sort()[0];
    if (d < oldest && !auctionOpen(i, today)) continue;
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d).push(i);
  }
  return [...groups].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, list]) => ({ day, items: list }));
}

export function dayLabel(day, lang, now = Date.now()) {
  const hi = lang === 'hi';
  if (day === istDay(now)) return hi ? 'आज' : 'Today';
  if (day === istDay(now - 864e5)) return hi ? 'कल' : 'Yesterday';
  const d = new Date(`${day}T00:00:00Z`);
  const f = d.toLocaleDateString(hi ? 'hi-IN' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return hi ? f : f.replace(',', '');
}

// Dismissed ids are kept 8 days (items live 7), so the store never grows past one week of taps.
export function pruneDismissed(dismissed, now = Date.now()) {
  const cut = now - 8 * 864e5;
  return Object.fromEntries(Object.entries(dismissed).filter(([, t]) => t > cut));
}

export function ago(iso, lang, now = Date.now()) {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 6e4));
  const hi = lang === 'hi';
  if (m < 60) return hi ? `${Math.max(1, m)} मिनट पहले` : `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return hi ? `${h} घंटे पहले` : `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? (hi ? 'कल' : 'Yesterday') : hi ? `${d} दिन पहले` : `${d} days ago`;
}

// The job runs every 12 hours; 15 means one run was missed.
export const STALE_HOURS = 15;
export const isStale = (updated, now = Date.now()) => !updated || now - Date.parse(updated) > STALE_HOURS * 36e5;

// IBBI writes 12-11-2026; Papa reads "12 Nov 2026" with no day/month doubt. Other text passes through.
export function fmtDate(s, lang) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(s ?? '').trim());
  if (!m) return s ?? '';
  return new Date(Date.UTC(+m[3], m[2] - 1, +m[1])).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function shareText(item, lang) {
  const t = textOf(item, lang);
  return `${t.title}\n\n${t.summary ? t.summary + '\n\n' : ''}${item.url}`;
}

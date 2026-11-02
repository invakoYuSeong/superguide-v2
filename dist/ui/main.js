// App shell: hash router, navigation, shared sheet/palette/toast.
import { parseRoute, formatRoute } from '../core/route.js';
import { lang, L, addEnglish } from '../core/i18n.js';
import { $, $$, icon, render, html } from './dom.js';
import { initAnalytics } from './analytics.js';

const VIEW_MODULES = {
  warbonds: () => import('./views/warbonds.js'),
  arsenal: () => import('./views/arsenal.js'),
  gear: () => import('./views/gear.js'),
  enemy: () => import('./views/enemy.js'),
  demolition: () => import('./views/demolition.js'),
  factions: () => import('./views/factions.js'),
};
const TITLES = {
  warbonds: L('전쟁 채권', 'Warbonds'),
  arsenal: L('스트라타젬', 'Stratagems'), gear: L('장비', 'Gear'), enemy: L('적 대응', 'Enemies'),
  demolition: L('철거', 'Demolition'), factions: L('팩션 추천', 'Faction picks'),
};
const SITE = L('HD2 필드 가이드', 'HD2 Field Guide');

const root = $('#view');
const loaded = new Map();
let current = { view: null, module: null, route: null };
const track = initAnalytics();

// --- Language ----------------------------------------------------------------------
// index.html already chose the language. In English the static page text comes
// from data-en* attributes and the data text from the dictionary, which must be
// loaded before the first view renders.
const LANG_KEY = 'hd2-lang';
if (lang === 'en') {
  for (const node of $$('[data-en]')) node.innerHTML = node.dataset.en;
  const attributes = { enLabel: 'aria-label', enTitle: 'title', enPlaceholder: 'placeholder', enContent: 'content', enHref: 'href', enLang: 'lang' };
  for (const [key, name] of Object.entries(attributes)) for (const node of $$(`[data-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}]`)) node.setAttribute(name, node.dataset[key]);
  // Keep ?lang=en in the address so a copied link opens in English too.
  const url = new URL(location.href);
  if (url.searchParams.get('lang') !== 'en') { url.searchParams.set('lang', 'en'); history.replaceState(null, '', url); }
  try { addEnglish(Object.entries((await import('../i18n/en.js')).english)); } catch (error) { console.error(error); }
  document.documentElement.setAttribute('data-i18n-ready', '');
}
function switchLanguage() {
  const next = lang === 'en' ? 'ko' : 'en';
  try { localStorage.setItem(LANG_KEY, next); } catch {}
  const url = new URL(location.href);
  // The address always changes (?lang=en is added or removed), so this reloads
  // the page in the other language on the same screen.
  if (next === 'en') url.searchParams.set('lang', 'en'); else url.searchParams.delete('lang');
  location.assign(url);
}

for (const slot of $$('[data-icon]')) slot.outerHTML = icon(slot.dataset.icon, slot.closest('.tabbar') ? 22 : 18).toString();

// --- Sheet (side panel on desktop, bottom sheet on phones) ---------------------
const sheet = $('#sheet');
let onSheetClose = null;
export function openSheet(content, { wide = false, onClose = null, label = '' } = {}) {
  render($('#sheet-body'), content);
  sheet.classList.toggle('wide', wide);
  sheet.classList.remove('split');
  if (label) sheet.setAttribute('aria-label', label);
  onSheetClose = onClose;
  if (!sheet.open) sheet.showModal();
  $('#sheet-body').scrollTop = 0;
}
export const closeSheet = () => sheet.open && sheet.close();
sheet.addEventListener('close', () => { const done = onSheetClose; onSheetClose = null; done?.(); });
sheet.addEventListener('click', event => {
  if (event.target === sheet || event.target.closest('[data-close]')) sheet.close();
});

// --- Toast -----------------------------------------------------------------------
let toastTimer;
export function toast(message) {
  const box = $('#toast');
  box.textContent = message; box.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { box.hidden = true; }, 3200);
}

// --- Routing ---------------------------------------------------------------------
export const ctx = {
  /** Push a new history entry (Back returns here). */
  go(route) { location.hash = formatRoute(route); },
  /** Update the URL for the current state without a new history entry or re-render. */
  replace(route) {
    const hash = formatRoute(route);
    // Keep navigation metadata when a view replaces filters or an open item.
    if (hash !== location.hash) history.replaceState(history.state, '', hash);
    current.route = parseRoute(hash);
  },
  get route() { return current.route; },
  openSheet, closeSheet, toast,
};

async function handle() {
  const route = parseRoute(location.hash);
  // Empty and old-site hashes (#combat …) become canonical routes.
  if (!location.hash || /^#(catalog|combat|demolition|factions)$/.test(location.hash)) history.replaceState(null, '', formatRoute(route));
  document.body.dataset.view = route.view;
  for (const link of $$('[data-tab]')) {
    if (link.dataset.tab === route.view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  document.title = `${TITLES[route.view]} — ${SITE}`;

  let module = loaded.get(route.view);
  if (!module) {
    root.setAttribute('aria-busy', 'true');
    try { module = await VIEW_MODULES[route.view](); } catch (error) {
      root.removeAttribute('aria-busy');
      render(root, html`<div class="empty"><h2>${L('화면을 불러오지 못했습니다', 'This screen could not be loaded')}</h2><p>${L('연결을 확인한 뒤 새로 고침해 주세요.', 'Check your connection and reload the page.')}</p></div>`);
      throw error;
    }
    loaded.set(route.view, module);
    root.removeAttribute('aria-busy');
  }
  if (parseRoute(location.hash).view !== route.view) return; // a newer navigation won
  const switched = current.view !== route.view;
  current = { view: route.view, module, route };
  if (switched) {
    onSheetClose = null; // the leaving view's close handler must not navigate
    closeSheet();
    // A fresh container per visit, so a view's listeners never pile up.
    const container = document.createElement('div');
    root.replaceChildren(container);
    module.mount(container, ctx);
    window.scrollTo({ top: 0 });
    track(route.view);
  }
  module.update(route);
}
window.addEventListener('hashchange', () => handle().catch(console.error));
handle().catch(console.error);

// Warm the next view when a visitor points at its tab.
for (const link of $$('[data-tab]')) {
  for (const type of ['pointerenter', 'focus', 'touchstart']) {
    link.addEventListener(type, () => VIEW_MODULES[link.dataset.tab]?.().catch(() => {}), { once: true, passive: true });
  }
}

// --- Theme -----------------------------------------------------------------------
// Follows the system until the header toggle picks one; the choice is remembered
// in this browser only (index.html applies it before the stylesheet paints).
const THEME_KEY = 'hd2-theme';
const THEME_COLORS = { dark: '#101211', light: '#f4f5f6' };
const systemTheme = () => (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
const currentTheme = () => document.documentElement.dataset.theme || systemTheme();
function showTheme() {
  const theme = currentTheme();
  const button = $('[data-action="theme"]');
  const label = theme === 'dark' ? L('라이트 모드로 전환', 'Switch to light mode') : L('다크 모드로 전환', 'Switch to dark mode');
  button?.setAttribute('aria-label', label);
  button?.setAttribute('title', label);
  for (const meta of $$('meta[name="theme-color"]')) meta.content = document.documentElement.dataset.theme ? THEME_COLORS[theme] : meta.media.includes('light') ? THEME_COLORS.light : THEME_COLORS.dark;
}
function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch {}
  showTheme();
}
showTheme();
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', showTheme);

// --- Global actions -------------------------------------------------------------
document.addEventListener('click', event => {
  // The skip link must move focus, not change the routed hash.
  if (event.target.closest('.skip')) { event.preventDefault(); root.focus(); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'palette') openPalette();
  if (action === 'method') import('./views/method.js').then(module => module.openMethod(ctx));
  if (action === 'theme') toggleTheme();
  if (action === 'lang') switchLanguage();
});
document.addEventListener('keydown', event => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if ((event.key === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !typing && !document.querySelector('dialog[open]'))) {
    event.preventDefault(); openPalette();
  }
});

// Browsers with the WebMCP API get the same catalogue filter the old site offered agents.
if (document.modelContext?.registerTool) import('./agent-tool.js').then(module => module.registerCatalogTool(ctx)).catch(console.warn);

let palette;
async function openPalette() {
  palette ||= import('./palette.js').then(module => module.createPalette(ctx));
  try { (await palette).open(); } catch (error) {
    palette = null;
    toast(L('검색을 불러오지 못했습니다. 연결을 확인해 주세요.', 'Search could not be loaded. Check your connection.'));
    throw error;
  }
}

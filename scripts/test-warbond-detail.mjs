// Embedded warbond details: URL validation, shared renderers, list order and
// navigation/scroll preservation. No browser or third-party DOM is required.
import assert from 'node:assert/strict';
import { warbonds } from '../dist/data/warbonds.js';
import { parseRoute, formatRoute } from '../dist/core/route.js';
import { setLang } from '../dist/core/i18n.js';
import { escape } from '../dist/ui/dom.js';
import { listContent, resolveWarbondItem, itemRoute, itemDetailContent, mount, update } from '../dist/ui/views/warbonds.js';
import { weaponDetail } from '../dist/ui/views/gear.js';
import { stratagemDetail } from '../dist/ui/views/arsenal.js';

let checks = 0;
const ok = (value, message) => { assert(value, message); checks++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const hash = '#/warbonds/scope-of-authority?t=premium&item=gear%2Fsightliner';
const route = parseRoute(hash);
eq(route.query.item, 'gear/sightliner', 'item query decodes once');
eq(formatRoute(route), hash, 'shared item URL round trips');
eq(parseRoute(formatRoute(itemRoute(route, 'arsenal/nova'))).query.item, 'arsenal/nova', 'switch to stratagem keeps the warbond route');
eq(formatRoute(itemRoute(route, '')), '#/warbonds/scope-of-authority?t=premium', 'closing item retains the tier and warbond');
for (const value of ['', 'enemy/charger', 'gear/missing', 'gear/sightliner/extra', 'gear%2Fsightliner', 'gear/liberator', 'arsenal/', '<script>']) {
  eq(resolveWarbondItem('scope-of-authority', value), null, `invalid/unrelated item ignored: ${value}`);
}
eq(resolveWarbondItem('missing', 'gear/sightliner'), null, 'unknown warbond cannot embed items');

// Every actual link (primary, secondary, throwable, support weapon, stratagem)
// renders its existing data, uses a unique title and keeps a full-page escape.
for (const bond of warbonds) for (const item of bond.pages.flatMap(p => p.items).filter(i => i.ref)) {
  const value = `${item.ref.view}/${item.ref.id}`;
  const ref = resolveWarbondItem(bond.id, value);
  ok(ref, `${bond.id}/${value}: valid reference`);
  const content = String(await itemDetailContent(bond.id, value));
  ok(content.includes('id="wb-item-title"') && content.includes('class="detail-grid"'), `${value}: existing detail stats rendered`);
  ok(content.includes(`href="#/${value}"`) && content.includes('전체 페이지로 열기'), `${value}: full-page link`);
  ok(!content.includes('id="sheet-title"') && !content.includes('data-close') && !content.includes('data-compare'), `${value}: no duplicate title or unrelated sheet actions`);
  ok(content.includes(escape(ref.target.en || ref.target.name)), `${value}: expected weapon/stratagem is shown`);
}
for (const [value, renderer] of [['gear/sightliner', weaponDetail], ['arsenal/nova', stratagemDetail]]) {
  const ref = resolveWarbondItem('scope-of-authority', value);
  const content = String(renderer(ref.target));
  ok(content.includes('id="sheet-title"') && content.includes('data-close'), `${value}: ordinary full-page detail still has its original header`);
}
const modeHtml = String(await itemDetailContent('control-group', 'arsenal/epoch', 'charged'));
ok(modeHtml.includes('data-variant="charged" aria-pressed="true"'), 'embedded stratagem selects URL mode');
ok(modeHtml.includes('href="#/arsenal/epoch?m=charged"'), 'full-page link preserves mode');
setLang('en');
const en = String(await itemDetailContent('scope-of-authority', 'gear/sightliner'));
ok(en.includes('Open full page') && en.includes('Back') && en.includes('Close item details'), 'new toolbar strings have English');
ok(!/[가-힣]/.test(en.split('<div class="sheet-content">')[0]), 'new English toolbar contains no Korean text');
setLang('ko');

const grid = String(listContent());
const ids = [...grid.matchAll(/data-open="([^"]+)"/g)].map(m => m[1]);
eq(ids.length, warbonds.length, 'one card per warbond');
eq((grid.match(/class="grid wb-grid"/g) || []).length, 1, 'one continuous grid');
ok(!grid.includes('wb-tier') && !grid.includes('<section') && !grid.includes('<h2'), 'no tier groups or titles');
const original = new Map(warbonds.map((w, index) => [w.id, index]));
const byId = new Map(warbonds.map(w => [w.id, w]));
for (let i = 1; i < ids.length; i++) {
  const a = byId.get(ids[i - 1]), b = byId.get(ids[i]);
  ok(a.date <= b.date, 'oldest release first');
  if (a.date === b.date) ok(original.get(a.id) < original.get(b.id), 'same-day releases keep existing order');
}
for (const tier of ['standard', 'premium', 'legendary']) {
  eq([...String(listContent(tier)).matchAll(/data-open="([^"]+)"/g)].map(m => m[1]), ids.filter(id => byId.get(id).tier === tier), `${tier} chip filters the same ordered grid`);
}

// Small DOM/history doubles exercise the real view lifecycle and click handlers.
// ctx.go intentionally defers update, like the browser's hashchange event.
const savedDocument = globalThis.document, savedHistory = globalThis.history;
const node = () => ({ innerHTML: '', scrollTop: 0, hidden: false, attributes: {}, listeners: {},
  setAttribute(key, value) { this.attributes[key] = value; },
  removeAttribute(key) { delete this.attributes[key]; },
  addEventListener(type, listener) { this.listeners[type] = listener; },
  focus() { this.focused = true; },
  getClientRects() { return [1]; },
});
const root = node(), list = node(), sheet = node();
let pane = node(), bondPane = node(), closeHandler, entries = [], cursor = 0, pending = false;
const classes = new Set();
sheet.classList = { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } };
root.querySelector = selector => selector === '#wb-list' ? list : null;
root.querySelectorAll = () => [];
const links = ['gear/sightliner', 'arsenal/nova'].map(value => ({ ...node(), dataset: { wbItem: value },
  closest(selector) { return selector === '.wb-workspace' || selector === '[data-wb-item]' ? this : null; },
}));
sheet.querySelector = selector => ({ '.wb-item-pane': pane, '.wb-bond-pane': bondPane }[selector] || null);
sheet.querySelectorAll = selector => selector === '[data-wb-item]' ? links : [];
globalThis.document = { querySelector: selector => selector === '#sheet' ? sheet : null };
const context = {
  route: parseRoute('#/warbonds'),
  go(route) { entries.splice(cursor + 1); entries.push({ hash: formatRoute(route), state: null }); cursor++; pending = true; },
  replace(route) { entries[cursor].hash = formatRoute(route); this.route = parseRoute(entries[cursor].hash); },
  openSheet(content, options) { sheet.innerHTML = String(content); sheet.open = true; classes.clear(); pane = node(); bondPane = node(); closeHandler = options.onClose; },
  closeSheet() { if (!sheet.open) return; sheet.open = false; closeHandler?.(); },
};
const flush = () => { pending = false; context.route = parseRoute(entries[cursor].hash); update(context.route); };
globalThis.history = {
  get state() { return entries[cursor].state; },
  replaceState(value) { entries[cursor].state = value; },
  back() { this.go(-1); },
  go(delta) { cursor += delta; assert(cursor >= 0 && cursor < entries.length); flush(); },
};
const visit = hash => { entries = [{ hash, state: null }]; cursor = 0; context.route = parseRoute(hash); mount(root, context); update(context.route); };
const click = (target, extra = {}) => {
  const event = { target, button: 0, preventDefault() { this.prevented = true; }, ...extra };
  sheet.listeners.click(event);
  if (pending) flush();
  return event;
};
const closeItem = { closest: selector => ['.wb-workspace', '[data-wb-item-close]'].includes(selector) ? closeItem : null };
try {
  visit('#/warbonds?t=premium');
  const card = { dataset: { open: 'scope-of-authority' }, closest() { return this; } };
  root.listeners.click({ target: card }); flush();
  ok(sheet.innerHTML.includes('wb-bond-pane') && sheet.innerHTML.includes('data-wb-item="gear/sightliner"'), 'warbond sheet has embedded item links');
  const preserved = bondPane; bondPane.scrollTop = 480;
  click(links[0]);
  eq(context.route.query.item, 'gear/sightliner', 'item click stays on warbonds');
  ok(classes.has('split') && !pane.hidden, 'item pane is visible within the dialog');
  click(links[1]);
  eq(entries.length, 3, 'switching item replaces the history entry');
  eq(context.route.query.item, 'arsenal/nova', 'second item replaces first');
  eq(bondPane, preserved, 'warbond DOM retained while item changes');
  eq(bondPane.scrollTop, 480, 'page list scroll position retained');
  history.back();
  ok(!context.route.query.item && pane.hidden && !classes.has('split'), 'browser Back closes item first');
  eq(bondPane.scrollTop, 480, 'Back preserves page list scroll position');
  history.go(1); click(closeItem);
  ok(!context.route.query.item && pane.hidden, 'close control after Forward returns to the page list');
  click(links[0]);
  context.closeSheet();
  eq(entries[cursor].hash, '#/warbonds?t=premium', 'closing warbond closes both and returns to filtered grid');
  ok(!sheet.open, 'both panes are closed');

  visit(hash);
  eq(entries.length, 1, 'deep link opens without adding history');
  const modified = click(links[1], { ctrlKey: true });
  ok(!modified.prevented && context.route.query.item === 'gear/sightliner', 'modified clicks keep native link behavior');
  const cancel = { preventDefault() { this.prevented = true; } };
  sheet.listeners.cancel(cancel);
  ok(cancel.prevented && !context.route.query.item && sheet.open, 'Escape on direct item link returns to warbond without leaving site');
  eq(entries.length, 1, 'closing direct item link replaces URL');
  context.closeSheet();
  eq(entries[cursor].hash, '#/warbonds?t=premium', 'closing direct warbond link returns to grid without unrelated history traversal');
  visit('#/warbonds/scope-of-authority');
  bondPane.scrollTop = 720;
  click(links[0]);
  // Model display:none returning zero in a narrow browser.
  bondPane.getClientRects = () => [];
  bondPane.scrollTop = 0;
  click(links[1]);
  click(closeItem);
  eq(bondPane.scrollTop, 720, 'narrow page-list scroll restored even if hiding it reported zero');
  context.closeSheet();
  // Allow pending lazy detail renders to settle before restoring globals.
  await new Promise(resolve => setImmediate(resolve));
} finally {
  if (savedDocument === undefined) delete globalThis.document; else globalThis.document = savedDocument;
  if (savedHistory === undefined) delete globalThis.history; else globalThis.history = savedHistory;
}
console.log(`PASS warbond detail: ${checks} checks (shared details, routes, grid order, history and scroll).`);

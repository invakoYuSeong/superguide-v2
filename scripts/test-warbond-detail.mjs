// Embedded warbond details: URL validation, shared renderers, list order and
// navigation/scroll preservation. No browser or third-party DOM is required.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { warbonds } from '../dist/data/warbonds.js';
import { armors } from '../dist/data/armor.js';
import { parseRoute, formatRoute } from '../dist/core/route.js';
import { setLang } from '../dist/core/i18n.js';
import { escape } from '../dist/ui/dom.js';
import { listContent, resolveWarbondItem, itemRoute, itemDetailContent, mount, update } from '../dist/ui/views/warbonds.js';
import { weaponDetail } from '../dist/ui/views/gear.js';
import { stratagemDetail } from '../dist/ui/views/arsenal.js';
import { personalProfiles } from '../dist/data/personal-profiles.js';
import { weaponById } from '../dist/ui/gear-shared.js';

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
  ok(/<button class="button ghost wb-item-back" type="button" data-wb-item-close>[\s\S]*?뒤로<\/button>/.test(content), `${value}: narrow-screen Back button keeps its close action`);
  ok(/<button class="icon-button" type="button" data-wb-item-close aria-label="항목 상세 닫기">/.test(content), `${value}: accessible X button stays separate from responsive Back button`);
  ok(!content.includes('id="sheet-title"') && !content.includes('data-close') && !content.includes('data-compare'), `${value}: no duplicate title or unrelated sheet actions`);
  ok(content.includes(escape(ref.target.en || ref.target.name)), `${value}: expected weapon/stratagem is shown`);
}
// Armor tiles have no ref; they open the matching set from the armor list, and the
// full-page link goes to the armor tab marked at that set.
let armorLinks = 0;
for (const armor of armors.filter(a => a.source.kind === 'warbond')) {
  const value = `armor/${armor.id}`;
  const ref = resolveWarbondItem(armor.source.warbondId, value);
  ok(ref?.target === armor, `${value}: armor set opens from its warbond`);
  const content = String(await itemDetailContent(armor.source.warbondId, value));
  ok(content.includes('id="wb-item-title"') && content.includes('class="detail-grid"') && content.includes(escape(armor.name)), `${value}: armor detail rendered`);
  ok(content.includes(`href="#/gear?tab=armor&a=${armor.id}"`) && content.includes('전체 페이지로 열기'), `${value}: full page is the armor tab at that set`);
  ok(content.includes('data-wb-item-close') && !content.includes('id="sheet-title"'), `${value}: shares the item-pane toolbar`);
  armorLinks++;
}
eq(armorLinks, 64, 'every warbond armor set opens in the item pane');
eq(resolveWarbondItem('helldivers-mobilize', 'armor/ac-2-obedient'), null, 'armor from another warbond is ignored');
eq(resolveWarbondItem('castellans-creed', 'armor/tg-8-sharpshooter')?.id, 'tg-8-sharpshooter', 'tile names ending in " Armor" still match');
eq(parseRoute('#/gear?tab=armor&a=tg-8-sharpshooter').query.a, 'tg-8-sharpshooter', 'armor focus survives the route');

for (const [value, renderer] of [['gear/sightliner', weaponDetail], ['arsenal/nova', stratagemDetail]]) {
  const ref = resolveWarbondItem('scope-of-authority', value);
  const content = String(renderer(ref.target));
  ok(content.includes('id="sheet-title"') && content.includes('data-close'), `${value}: ordinary full-page detail still has its original header`);
}
const css = await readFile(new URL('../dist/ui/app.css', import.meta.url), 'utf8');
// Browser-free layout contracts. Actual panel rectangles, scrollbar counts and
// window.scrollY across open/close still need browser measurements.
const rule = (source, selector) => [...source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .find(([, selectors]) => selectors.trim() === selector)?.[2] || '';
const desktopCss = css.match(/@media\s*\(min-width:\s*760px\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
ok(/display:\s*none/.test(rule(desktopCss, '.wb-item-toolbar .wb-item-back')), 'wide-screen Back button uses two classes to outrank .button and hide from display and keyboard focus at 760px');
ok(/overflow:\s*hidden/.test(rule(css, 'html:has(dialog:modal), html:has(dialog:modal) body')), 'all modal dialogs lock page scrolling, including the palette; closing the last modal releases the CSS lock');
ok(/overflow:\s*hidden/.test(rule(css, '.sheet')), 'the dialog itself never owns a scrollbar');
ok(/width:\s*min\(var\(--sheet-width\),\s*100%\)/.test(rule(css, '.sheet')) && /max-width:\s*100%/.test(rule(css, '.sheet')), 'ordinary and wide sheets fit the available viewport width even with a page scrollbar');
ok(/--sheet-width:\s*980px/.test(rule(css, '.sheet.wide')), 'wide warbond sheet keeps its 980px maximum width');
ok(/overflow-y:\s*auto/.test(rule(css, '.sheet-body')), 'ordinary sheets retain their inner scroller');
ok(/overflow:\s*hidden/.test(rule(css, '.sheet-body:has(> .wb-workspace)')), 'warbond workspace disables the redundant sheet-body scroller');
ok(/overflow-y:\s*auto/.test(rule(css, '.wb-bond-pane, .wb-item-pane')), 'each warbond panel owns its vertical scroller');
ok(/grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(rule(css, '.wb-workspace')), 'warbond board occupies the full sheet width');
ok(!/\.sheet[^{}]*\.split[^{}]*\{[^{}]*(?:width\s*:|grid-template-columns\s*:)/.test(css), 'opening an item never changes the sheet width or workspace columns');
ok(!/\.sheet\.split\s+\.wb-(?:hero|info|tile)/.test(css), 'opening an item does not compact the unchanged warbond board');
const desktopPane = rule(desktopCss, '.wb-item-pane');
ok(/position:\s*fixed/.test(desktopPane) && /top:\s*0/.test(desktopPane) && /bottom:\s*0/.test(desktopPane), 'desktop item pane escapes dialog clipping and spans the viewport height');
ok(/--wb-item-width:\s*clamp\(360px,\s*calc\(100vw - var\(--sheet-width\)\),\s*560px\)/.test(desktopPane) && /width:\s*var\(--wb-item-width\)/.test(desktopPane), 'desktop item pane prefers the free space left of the sheet, clamped between 360px and 560px');
ok(/right:\s*min\(var\(--sheet-width\),\s*calc\(100vw - var\(--wb-item-width\)\)\)/.test(desktopPane), 'item pane sits immediately left of the sheet and overlaps it when needed to stay on-screen');
ok(/z-index:\s*3/.test(desktopPane) && /border-left:/.test(desktopPane) && /box-shadow:/.test(desktopPane) && /background:\s*var\(--bg-raise\)/.test(rule(css, '.wb-item-pane')), 'item pane paints above the board with the sheet background, its own left border and shadow');
ok(/animation:\s*none/.test(rule(desktopCss, '.sheet[open].split')), 'direct item links and early clicks remove the animated transform that would contain the fixed pane');
const phoneCss = css.slice(css.indexOf('@media (max-width: 820px)'));
ok(/--sheet-width:\s*100vw/.test(rule(phoneCss, '.sheet, .sheet.wide')) && /height:\s*92dvh/.test(rule(phoneCss, '.sheet, .sheet.wide')), 'bottom sheets keep their full width and 92dvh height');
ok(/@media\s*\(min-width:\s*760px\)\s*\{\s*\.wb-item-pane\s*\{[^}]*top:\s*8dvh/.test(phoneCss), '760–820px item overlay starts at the bottom sheet top instead of covering the full viewport');
const narrowCss = css.match(/@media\s*\(max-width:\s*759px\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
ok(/display:\s*none/.test(rule(narrowCss, '.sheet.split .wb-bond-pane')) && !/position:\s*fixed/.test(rule(css, '.wb-item-pane')), 'below 760px item details still replace the board within the sheet');
for (const language of ['ko', 'en']) {
  setLang(language);
  const ref = resolveWarbondItem('scope-of-authority', 'gear/sightliner');
  for (const content of [String(weaponDetail(ref.target)), String(await itemDetailContent('scope-of-authority', 'gear/sightliner'))]) {
    const sources = content.match(/<div class="sources">([\s\S]*?)<\/div>/)?.[1];
    ok(sources?.includes(language === 'en' ? 'Checked' : '자료 확인') && /\d{4}-\d{2}-\d{2}/.test(sources) && sources.includes(escape(ref.target.source)), `${language}: ordinary and embedded gear sources keep the checked date and wiki link`);
    ok(!/한국어 이름|나무위키|Korean name|Namuwiki/i.test(sources), `${language}: gear sources omit Korean-name attribution`);
  }
}
setLang('ko');
const modeHtml = String(await itemDetailContent('control-group', 'arsenal/epoch', 'charged'));
ok(modeHtml.includes('data-variant="charged" aria-pressed="true"'), 'embedded stratagem selects URL mode');
ok(modeHtml.includes('href="#/arsenal/epoch?m=charged"'), 'full-page link preserves mode');
// Weapons with selectable firing modes get the same mode tabs as stratagems.
const multiMode = Object.entries(personalProfiles).filter(([, profile]) => profile.modes.length > 1);
eq(multiMode.length, 9, 'nine weapons have selectable firing modes');
for (const [id, profile] of multiMode) {
  const content = String(weaponDetail(weaponById.get(id)));
  eq([...content.matchAll(/data-variant="([^"]+)"/g)].map(m => m[1]), profile.modes.map(m => m.id), `${id}: one tab per firing mode`);
  eq((content.match(/data-variant-panel="/g) || []).length, profile.modes.length, `${id}: one panel per firing mode`);
  ok(content.includes(`data-variant="${profile.modes[0].id}" aria-pressed="true"`), `${id}: first mode selected by default`);
}
ok(!String(weaponDetail(weaponById.get('liberator'))).includes('data-variant'), 'single-mode weapon has no mode tabs');
ok(String(weaponDetail(weaponById.get('eruptor'))).includes('gear-modes'), 'single-mode weapon keeps its component table');
// One panel's text, so a check cannot pass on another mode's numbers.
const panel = (content, id) => content.split(`data-variant-panel="${id}"`)[1]?.split('data-variant-panel=')[0] ?? '';
const tabNames = id => [...String(weaponDetail(weaponById.get(id))).matchAll(/data-variant="[^"]+" aria-pressed="\w+">([^<]+)/g)].map(m => m[1]);
eq(tabNames('double-freedom'), ['기본 사격', '일제 사격'], 'Double Freedom mode names');
eq(tabNames('bushwhacker'), ['기본 사격', '일제 사격'], 'Bushwhacker mode names');
eq(tabNames('variable'), ['기본 사격', '일제 사격', '전탄 발사'], 'Variable mode names');
for (const id of ['missile-pistol', 'warrant']) eq(tabNames(id), ['비유도', '유도 사격'], `${id} mode names`);
for (const [id] of multiMode) ok(!String(weaponDetail(weaponById.get(id))).includes('gear-modes'), `${id}: mode tabs replace the component table`);
const doubleFreedom = String(weaponDetail(weaponById.get('double-freedom'), { variant: 'all-barrels' }));
ok(doubleFreedom.includes('data-variant="all-barrels" aria-pressed="true"') && doubleFreedom.includes('data-variant-panel="standard" hidden'), 'weapon detail selects the given mode');
ok(/한 번에 발사[\s\S]*2<small>발[\s\S]*모두 맞으면 1,680/.test(panel(doubleFreedom, 'all-barrels')), 'volley: 2 shells of 12 pellets × 70');
const stoker = String(weaponDetail(weaponById.get('stoker')));
ok(!panel(stoker, 'standard').includes('화상 피해') && panel(stoker, 'standard').includes('AP 2'), 'Stoker main barrel: no burn damage, AP 2');
const flamer = panel(stoker, 'underbarrel');
ok(flamer.includes('화상 피해') && flamer.includes('AP 4') && /연료[\s\S]*50/.test(flamer) && /재장전[\s\S]*2.3/.test(flamer) && flamer.includes('6.1초'), 'Stoker flamethrower: burn, AP 4, fuel 50, 2.3 s reload, spray time');
ok(!flamer.includes('130'), 'Stoker flamethrower does not borrow the main barrel damage');
const arbitrator = panel(String(weaponDetail(weaponById.get('arbitrator'))), 'underbarrel');
ok(/예비탄[\s\S]*20/.test(arbitrator) && /연사[\s\S]*80/.test(arbitrator) && !arbitrator.includes('1,200') && !arbitrator.includes('예비 탄창'), 'Arbitrator underbarrel: its own spare rounds and fire rate, not the main gun\'s');
const oneTwo = panel(String(weaponDetail(weaponById.get('one-two'))), 'underbarrel');
ok(/예비탄[\s\S]*5/.test(oneTwo) && /재장전[\s\S]*2.5/.test(oneTwo) && !oneTwo.includes('연사'), 'One-Two underbarrel: 5 spare rounds, 2.5 s reload, no fire rate for a one-round magazine');
const total = panel(String(weaponDetail(weaponById.get('variable'))), 'total');
ok(/한 번에 발사[\s\S]*49[\s\S]*4,165/.test(total) && total.includes('22발') && !total.includes('계산하지 않습니다'), 'Variable total: up to 49 rounds, 4,165 with a full magazine, self-damage warning');
for (const id of ['missile-pistol', 'warrant']) {
  const guided = panel(String(weaponDetail(weaponById.get(id))), 'guided');
  ok(guided.includes('직격 피해') && guided.includes('목표를 고정해야만 발사됩니다') && guided.includes('몸 중앙') && !guided.includes('계산하지 않습니다'), `${id}: guided fire has numbers and how lock-on works`);
}
const embeddedWeapon = String(await itemDetailContent('ironclad-democracy', 'gear/arbitrator', 'underbarrel'));
ok(embeddedWeapon.includes('data-variant="underbarrel" aria-pressed="true"'), 'embedded weapon selects URL mode');
ok(embeddedWeapon.includes('href="#/gear/arbitrator?m=underbarrel"'), 'full-page link preserves weapon mode');
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

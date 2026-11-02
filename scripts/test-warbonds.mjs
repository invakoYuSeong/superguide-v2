// Warbond guide: wikitext parsing (infobox, acquisitions template, collapsed table),
// cross-checks that leave disagreeing values unconfirmed, the 26 Korean names,
// links into weapon/stratagem views, and that the generated data is current.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateSvg, MAX_SVG_BYTES } from './svg-safety.mjs';
import { parseWarbondPage, parseCurrency, parseDate, findTemplates, templateParams, parseTableRows, layoutProblems, BOARD, UNCONFIRMED } from './warbond-parse.mjs';
import { generate, buildWarbonds, warbondId, baseTitle, RENAMED, pickLatest } from './build-warbonds.mjs';
import { warbonds, warbondTiers, warbondBoard, warbondDiscrepancies, warbondLinks, latestWarbondId } from '../dist/data/warbonds.js';
import { warbondImages } from '../dist/data/warbond-images.js';
import { warbondItemImages, warbondItemImagesMissing } from '../dist/data/warbond-item-images.js';
import { wikiIcons } from '../dist/data/wiki-icons.js';
import { warbondBannerImages } from '../dist/data/warbond-banner-images.js';
import { personalWeapons } from '../dist/data/personal-weapons.js';
import { stratagemById } from '../dist/core/catalog.js';
import { parseRoute } from '../dist/core/route.js';

let checks = 0;
const ok = (value, message) => { assert(value, message); checks++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const root = new URL('../', import.meta.url);

// --- Small parsers ------------------------------------------------------------------------
eq(parseCurrency('{{Currency|SC|1,000}}'), { amount: 1000, unit: 'SC', raw: '{{Currency|SC|1,000}}' }, 'SC with comma');
eq(parseCurrency('{{Currency|Medals|1,200}}').amount, 1200, 'medals with comma');
eq(parseCurrency('{{Currency|SC|1500}}').amount, 1500, 'SC without comma');
eq(parseCurrency(' 145').amount, 145, 'plain number');
ok(parseCurrency('Free').amount === 0 && parseCurrency('Free').free, 'Free is 0 SC');
ok(parseCurrency('None').amount === null && parseCurrency('None').none, 'None is explicit');
ok(parseCurrency('Unknown').amount === null && !parseCurrency('Unknown').none, 'unreadable stays null');
eq(['March 14th, 2024', 'August 08, 2024', 'October 31, 2024', 'September 22nd, 2026', 'May 1st, 2025', '2024-03-14'].map(parseDate),
  ['2024-03-14', '2024-08-08', '2024-10-31', '2026-09-22', '2025-05-01', '2024-03-14'], 'dates normalize to ISO');
ok(parseDate('Soon') === null && parseDate('') === null, 'unknown dates stay null');
const nested = templateParams(findTemplates('x {{Infobox Warbond\n|cost={{Currency|SC|1,000}}\n|title=[[A|B]] C\n}} y', /Infobox[ _]Warbond/)[0].body);
eq(nested.named, { cost: '{{Currency|SC|1,000}}', title: '[[A|B]] C' }, 'nested templates and links do not split params');

// --- A synthetic warbond page ---------------------------------------------------------------
const item = (n, name, cost, image = `${name} ${n}.png`, link = name) => ` |${n}_col = ${n}\n |${n}_row = 1\n |${n}_cost = ${cost}\n |${n}_image = ${image}\n |${n}_link = ${link}\n |${n}_name = ${name}\n`;
const row = (name, type, cost, image = 'x.png', link = name) => `|-\n|[[File:${image}|51px|link=${link}]]||[[${link}|${name}]]||[[${type}]]||{{Currency|${cost === 1 ? 'Medal' : 'Medals'}|${cost}|notext}}\n`;
const page = (n, unlock, items, rows) => `===Page ${n}===\n{{Acquisitions Page\n |mode = premium-warbond\n${unlock == null ? '' : ` |spent_to_unlock = ${unlock}\n`}${items}}}\n<div class="mw-collapsible mw-collapsed">\n{|class="wikitable sortable"\n!Icon!!Item!!Type!!Cost\n${rows}|}\n</div>\n\n`;
const sample = `{{Infobox Warbond
|title=Test Bond
|date=March 14th, 2024
|cost={{Currency|SC|1,000}}
|credit-claim={{Currency|SC|150}}
|all-pages={{Currency|Medals|40}}
|all-items={{Currency|Medals|48}}
}}
==Contents==
${page(1, null,
    item(1, 'AR-1 Gun', 10, 'Gun.png') + item(2, 'Plate', 5, 'Plate Helmet.png') + item(3, 'Plate', 7, 'Plate Armor.png') + item(4, 'Super Credits', 1),
    row('AR-1 Gun', 'Assault Rifle', 10, 'Gun.png') + row('Plate', 'Helmet', 6, 'Plate Helmet.png') + row('Plate', 'Medium Armor', 7, 'Plate Armor.png') + '|-\n|[[File:Super Credit.png|51px|link=Super Credits]]||100 [[Super Credits]]||[[Currency]]||{{Currency|Medal|1|notext}}\n')}${page(2, 'Unknown',
    item(1, 'Boost A', 11) + item(2, 'Banner', 3) + item(3, 'Super Credits', 2),
    row('Boost B', 'Booster', 11) + row('Banker', 'Cape', 3) + '|-\n|[[File:Super Credit.png|51px|link=Super Credits]]||50 [[Super Credits]]||[[Currency]]||{{Currency|Medals|2|notext}}\n')}${page(3, 40,
    item(1, 'Boost B', 9),
    row('Boost A', 'Booster', 9))}==Media==
`;
const parsed = parseWarbondPage(sample, 'Test Bond Premium Warbond');
eq([parsed.tier, parsed.date, parsed.price, parsed.creditClaim, parsed.allPages, parsed.totalCost], ['premium', '2024-03-14', 1000, 150, 40, 48], 'infobox fields');
eq(parsed.pages.map(p => [p.number, p.unlock, p.unlockStatus]), [[1, 0, 'confirmed'], [2, null, UNCONFIRMED], [3, 40, 'confirmed']], 'page unlock thresholds');
const p1 = parsed.pages[0].items;
eq(p1.map(i => [i.name, i.type, i.cost, i.costStatus]), [['AR-1 Gun', 'Assault Rifle', 10, 'confirmed'], ['Plate', 'Helmet', null, UNCONFIRMED], ['Plate', 'Medium Armor', 7, 'confirmed'], ['Super Credits', 'Currency', 1, 'confirmed']], 'template items pair with table rows by image; a cost mismatch is unconfirmed');
eq([p1[1].templateCost, p1[1].tableCost], [5, 6], 'both disputed costs are kept');
const p2 = parsed.pages[1].items;
ok(p2[0].pageStatus === UNCONFIRMED && p2[0].tablePage === 3 && p2[0].cost === null, 'an item the table puts on another page is unconfirmed');
ok(parsed.pages[2].items[0].pageStatus === UNCONFIRMED, 'and so is its counterpart');
ok(p2[1].nameStatus === UNCONFIRMED && p2[1].tableName === 'Banker' && p2[1].cost === 3, 'a spelling difference is reported but the agreed cost stays');
eq(p2[2].superCredits, 50, 'Super Credits amount comes from the table');
eq(parsed.discrepancies.map(d => [d.page, d.code]).sort(), [[1, 'cost-differs'], [2, 'name-differs'], [2, 'page-differs'], [2, 'unlock-missing'], [3, 'page-differs']].sort(), 'discrepancy list');
eq(parsed.totals, { infobox: 48, template: 48, table: 49 }, 'totals: template matches the infobox, table sum kept for reference');
// Totals that do not add up are unconfirmed rather than trusted.
const badTotal = parseWarbondPage(sample.replace('Medals|48', 'Medals|60').replace('SC|150', 'SC|300').replace('Medals|40}}', 'Medals|50}}'), 'Bad Premium Warbond');
ok(badTotal.totalCost === null && badTotal.totalStatus === UNCONFIRMED, 'all-items mismatch is unconfirmed');
ok(badTotal.creditClaim === null && badTotal.creditClaimStatus === UNCONFIRMED, 'credit-claim mismatch is unconfirmed');
ok(badTotal.allPages === null && badTotal.pages[2].unlock === null, 'all-pages vs last page unlock mismatch is unconfirmed');
eq(badTotal.discrepancies.filter(d => ['all-items-differs', 'credit-claim-differs', 'unlock-vs-all-pages'].includes(d.code)).length, 3, 'each total mismatch is reported');
ok(parseWarbondPage(sample.replace('|cost={{Currency|SC|1,000}}', '|type = Standard\n|cost=Free'), 'Helldivers Mobilize Warbond').tier === 'standard', 'type=Standard → standard tier, Free price');
eq(parseTableRows('{|class="wikitable"\n!h\n|-\n|[[File:a.png|link=]]||Still Standing||[[Title]]||{{Currency|Medals|20|notext}}\n|}').map(r => [r.name, r.type, r.cost, r.link]), [['Still Standing', 'Title', 20, null]], 'plain-text table rows');

// --- Page board layout (col/row/colspan/rowspan from the Acquisitions Page template) -------------
eq(p1.map(i => [i.col, i.row, i.colspan, i.rowspan, i.image]), [[1, 1, 1, 1, 'Gun.png'], [2, 1, 1, 1, 'Plate Helmet.png'], [3, 1, 1, 1, 'Plate Armor.png'], [4, 1, 1, 1, 'Super Credits 4.png']], 'layout fields are parsed; a missing span means 1');
const spanned = parseWarbondPage(sample.replace(' |1_col = 1\n', ' |1_col = 1\n |1_colspan = 2\n |1_rowspan = 3\n'), 'Span Premium Warbond');
eq([spanned.pages[0].items[0].colspan, spanned.pages[0].items[0].rowspan], [2, 3], 'explicit spans are parsed');
const cell = (col, row, colspan = 1, rowspan = 1) => ({ name: `${col},${row}`, col, row, colspan, rowspan });
const full = [cell(1, 1, 2, 3), cell(3, 1, 3, 2), cell(3, 3), cell(4, 3, 2, 1)];
eq(layoutProblems(full), [], 'a board filled exactly once has no problems');
eq(BOARD, { cols: 5, rows: 3 }, 'the board is 5 columns × 3 rows');
ok(layoutProblems([...full, cell(5, 3)]).some(p => /overlaps/.test(p)), 'overlap is reported');
ok(layoutProblems([cell(1, 1, 2, 3), cell(3, 1, 3, 2), cell(3, 3), cell(4, 3, 3, 1)]).some(p => /outside/.test(p)), 'a tile past the edge is reported');
ok(layoutProblems(full.slice(0, 3)).some(p => /empty/.test(p)), 'an empty cell is reported');
ok(layoutProblems([{ ...cell(1, 1), col: null }]).some(p => /missing/.test(p)), 'a missing position is reported');

// --- The real snapshot ------------------------------------------------------------------------
const snapshot = JSON.parse(await readFile(new URL('db/source/wiki_warbonds.json', root), 'utf8'));
const korean = JSON.parse(await readFile(new URL('db/source/warbond_korean_names.json', root), 'utf8'));
const koreanKeys = Object.keys(korean);
ok(Object.values(korean).every(name => typeof name === 'string' && name.trim()), 'the Korean name file holds only names (no notes or metadata)');
eq(Object.keys(snapshot.pages).length, 26, 'snapshot holds the 26 warbond pages');
eq(koreanKeys.length, 26, 'all 26 Korean warbond names are in the repo');
// User-specified: keeps the game's official mistranslation as-is, including the "(오역)" marker.
eq(korean['Exo Experts'], '외계 전문가(오역)', 'Exo Experts Korean name in db/source is exact');
eq(warbonds.find(w => w.id === 'exo-experts').name, '외계 전문가(오역)', 'Exo Experts Korean name in the generated data is exact');
const { english } = await import('../dist/i18n/en.js');
eq(english['외계 전문가(오역)'], 'Exo Experts', 'Exo Experts has English in the dictionary');
ok(!Object.hasOwn(english, '외계 전문가'), 'the old Exo Experts name is gone from the dictionary');
eq(warbonds.length, 26, '26 warbonds generated');
for (const warbond of warbonds) {
  const title = Object.keys(snapshot.pages).find(t => warbondId(t) === warbond.id);
  ok(title && korean[baseTitle(title)] === warbond.name, `${warbond.id}: Korean name from the provided list`);
  ok(Number.isInteger(snapshot.pages[title].revision) && /^\d{4}-\d\d-\d\dT/.test(snapshot.pages[title].revisionTimestamp) && warbond.revision === snapshot.pages[title].revision, `${warbond.id}: revision recorded`);
  ok(/^\d{4}-\d\d-\d\d$/.test(warbond.date), `${warbond.id}: ISO date`);
  ok(warbondTiers.some(tier => tier.id === warbond.tier), `${warbond.id}: tier`);
  ok(Number.isInteger(warbond.price) && warbond.price >= 0, `${warbond.id}: price`);
  // Totals cross-check: an infobox total is shown only when the template costs add up to it.
  const parsedPage = parseWarbondPage(snapshot.pages[title].wikitext, title);
  ok(warbond.totalStatus === UNCONFIRMED || parsedPage.totals.template === warbond.totalCost, `${warbond.id}: medal total matches the template sum`);
  for (const p of warbond.pages) {
    for (const i of p.items) {
      ok(i.costStatus === 'confirmed' ? Number.isInteger(i.cost) && i.cost > 0 : i.cost === null && i.costStatus === UNCONFIRMED, `${warbond.id} p${p.number} ${i.name}: cost is a number or 미확인`);
      if (i.ref) ok(i.ref.view === 'gear' ? personalWeapons.some(w => w.id === i.ref.id) : stratagemById.has(i.ref.id), `${warbond.id}: ${i.name} links to an existing entry`);
    }
    ok(p.costStatus === 'confirmed' ? p.cost === p.items.reduce((s, i) => s + i.cost, 0) : p.cost === null, `${warbond.id} p${p.number}: page total`);
    ok(p.unlockStatus === 'confirmed' ? Number.isInteger(p.unlock) : p.unlock === null, `${warbond.id} p${p.number}: unlock is a number or 미확인`);
  }
}
eq(['standard', 'premium', 'legendary'].map(tier => warbonds.filter(w => w.tier === tier).length), [1, 22, 3], 'tier counts');
// Every page board: all 15 cells covered once, nothing outside, and the same items as the template.
eq(warbondBoard, BOARD, 'generated board size');
eq([warbonds.reduce((n, w) => n + w.pages.length, 0), warbonds.reduce((n, w) => n + w.itemCount, 0)], [85, 603], '85 pages and 603 items');
for (const warbond of warbonds) {
  const title = Object.keys(snapshot.pages).find(t => warbondId(t) === warbond.id);
  const sections = snapshot.pages[title].wikitext.split(/^===\s*Page\s+\d+\s*===\s*$/m).slice(1);
  eq(warbond.pages.map(p => p.items.length), sections.map(s => new Set([...s.split(/\n==[^=]/)[0].matchAll(/\|\s*(\d+)_name\s*=/g)].map(m => m[1])).size), `${warbond.id}: items per page match the template`);
  eq(warbond.itemCount, warbond.pages.reduce((n, p) => n + p.items.length, 0), `${warbond.id}: item count`);
  for (const p of warbond.pages) {
    eq(layoutProblems(p.items), [], `${warbond.id} p${p.number}: tiles fill the ${BOARD.cols}×${BOARD.rows} board exactly`);
    eq(p.layoutStatus, 'confirmed', `${warbond.id} p${p.number}: layout confirmed`);
    eq(p.items.reduce((n, i) => n + i.colspan * i.rowspan, 0), BOARD.cols * BOARD.rows, `${warbond.id} p${p.number}: tile areas add up to 15`);
    ok(p.items.every(i => typeof i.image === 'string' && i.image), `${warbond.id} p${p.number}: every tile names its wiki image`);
  }
}
// Every unconfirmed value in the data is explained by a discrepancy record, and vice versa.
const unconfirmedKeys = new Set(warbonds.flatMap(w => [
  ...w.pages.flatMap(p => p.items.filter(i => i.costStatus !== 'confirmed' || i.nameStatus).map(i => `${w.id}:${p.number}:item`)),
  ...w.pages.filter(p => p.unlockStatus !== 'confirmed').map(p => `${w.id}:${p.number}:unlock`),
  ...(w.totalStatus !== 'confirmed' ? [`${w.id}:-:all-items`] : []),
]));
const recordKeys = new Set(warbondDiscrepancies.map(d => `${d.warbondId}:${d.page ?? '-'}:${d.item ? 'item' : d.field}`));
eq([...unconfirmedKeys].filter(key => !recordKeys.has(key)), [], 'every 미확인 has a discrepancy record');
eq([...recordKeys].filter(key => !unconfirmedKeys.has(key) && !key.endsWith('credit-claim')), [], 'every discrepancy shows up as 미확인');
// Links into the existing weapon/stratagem views.
eq([warbondLinks.weapons, warbondLinks.stratagems, warbondLinks.unmatched.length], [92, 31, 0], 'weapon/stratagem link counts');
ok(warbondLinks.matchedWithoutCode.every(m => personalWeapons.some(w => w.id === m.id) || stratagemById.has(m.id)), 'fallback matches point at real entries');
// LAS-16 Trident (Siege Breakers p1) is the site's LAS-13 Trident: an explicit rename, backed by the weapon page.
const trident = warbonds.find(w => w.id === 'siege-breakers').pages[0].items.find(i => i.name === 'LAS-16 Trident');
eq([trident?.ref, trident?.cost], [{ view: 'gear', id: 'trident' }, 35], 'LAS-16 Trident links to the Trident at 35 medals');
eq(RENAMED['LAS-16 Trident'], 'LAS-13 Trident', 'Trident rename is explicit');
ok(!warbondLinks.matchedWithoutCode.some(m => m.name === 'LAS-16 Trident'), 'Trident does not rely on the loose fallback');
const tridentPage = JSON.parse(await readFile(new URL('db/source/wiki_pages.json', root), 'utf8')).pages['LAS-13 Trident'].wikitext;
ok(/\|\s*source\s*=\s*\[\[Siege Breakers Premium Warbond#Page 1/.test(tridentPage) && /Siege Breakers Premium Warbond\]\] for \{\{Currency\|Medals\|35\}\}/.test(tridentPage), 'LAS-13 Trident page: Siege Breakers page 1, 35 medals');
ok(tridentPage.includes('Changed name from "LAS-16 Trident"'), 'LAS-13 Trident page records the rename from LAS-16 Trident');
for (const ref of warbonds.flatMap(w => w.pages.flatMap(p => p.items.map(i => i.ref).filter(Boolean)))) ok(parseRoute(`#/${ref.view}/${ref.id}`).id === ref.id, `link route ${ref.view}/${ref.id}`);
// Cover images.
for (const warbond of warbonds) {
  const image = warbondImages[warbond.id];
  ok(image && image.width <= 240, `${warbond.id}: small cover`);
  await access(new URL(`dist/${image.src.slice(2)}`, root)); checks++;
}
// Generated output is current, deterministic, LF only, and independent of snapshot key order.
const first = await generate(), second = await generate();
const onDisk = await readFile(new URL('dist/data/warbonds.js', root), 'utf8');
ok(first.text === second.text, 'build is deterministic');
ok(first.text === onDisk, 'dist/data/warbonds.js is up to date (run node scripts/build-warbonds.mjs)');
ok(!onDisk.includes('\r'), 'LF line endings');
const reversed = { ...snapshot, pages: Object.fromEntries(Object.entries(snapshot.pages).reverse()) };
eq(buildWarbonds(reversed, korean).warbonds.map(w => w.id), warbonds.map(w => w.id), 'snapshot order does not matter');
assert.throws(() => buildWarbonds(snapshot, { ...korean, 'Cutting Edge': '' }), /No Korean name/); checks++;
assert.throws(() => buildWarbonds(snapshot, { ...korean, 'Made Up': '가짜' }), /without a warbond page/); checks++;
ok(parseRoute('').view === 'warbonds', 'warbonds is the main page');

// --- "Latest release" banner -----------------------------------------------------------------
const maxDate = warbonds.map(w => w.date).sort().at(-1);
const newest = warbonds.filter(w => w.date === maxDate).map(w => w.en).sort()[0];
eq(latestWarbondId, warbonds.find(w => w.en === newest).id, 'banner picks the warbond with the newest release date');
eq(latestWarbondId, pickLatest(warbonds), 'generated latestWarbondId matches pickLatest');
// Tie-break: same date → English title in code-unit order; input order never matters; undated never wins.
const tie = [{ id: 'b', en: 'Bravo', date: '2026-05-01' }, { id: 'a', en: 'Alpha', date: '2026-05-01' }, { id: 'c', en: 'Charlie', date: '2026-04-01' }, { id: 'x', en: 'Aardvark', date: null }];
for (const order of [tie, [...tie].reverse(), [tie[2], tie[0], tie[3], tie[1]]]) eq(pickLatest(order), 'a', 'tie-break by English title regardless of order');
eq(pickLatest([{ id: 'x', en: 'X', date: null }]), null, 'no dated warbond → no banner');
eq(pickLatest(warbonds.toReversed()), latestWarbondId, 'real data: order does not change the pick');
// Large banner cover: only for the latest warbond, wide enough for the full-width strip and within budget; the 26 small covers are unchanged.
const banner = warbondBannerImages[latestWarbondId];
ok(banner, `no large banner cover for ${latestWarbondId}: run python scripts/tools/fetch-warbond-covers.py --latest-large (the page falls back to the small cover meanwhile)`);
for (const [id, image] of Object.entries(warbondBannerImages)) {
  const bytes = await readFile(new URL(`dist/${image.src.slice(2)}`, root));
  ok(image.src === `./assets/warbonds/${id}-large.webp` && image.width >= 1200 && image.width <= 1600 && image.width > warbondImages[id].width, `${id}: large cover path and size (wide enough for the full-width strip)`);
  ok(bytes.length <= 120000, `${id}: large cover is ${bytes.length} bytes (≤ 120,000)`);
  eq(createHash('sha256').update(bytes).digest('hex'), image.sha256, `${id}: large cover file matches its record`);
}
for (const [id, image] of Object.entries(warbondImages)) {
  eq(createHash('sha256').update(await readFile(new URL(`dist/${image.src.slice(2)}`, root))).digest('hex'), image.sha256, `${id}: small cover unchanged`);
}
const { latestBanner } = await import('../dist/ui/views/warbonds.js');
const { escape } = await import('../dist/ui/dom.js');
const bannerHtml = String(latestBanner());
ok(bannerHtml.includes(`src="${banner.src}"`) && !bannerHtml.includes('is-small'), 'banner uses the large cover');
const ctas = [...bannerHtml.matchAll(/<button class="button primary wb-latest-cta"[^>]*data-open="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)];
ok(ctas.length === 1 && ctas[0][1] === latestWarbondId && ctas[0][2].includes('페이지별 목록 보기'), 'one "view pages" button opens the same detail route as the cards');
ok([...bannerHtml.matchAll(/data-open="([^"]+)"/g)].every(m => m[1] === latestWarbondId), 'every clickable part of the banner opens the latest warbond');
ok(!/<dl|<dt|wb-latest-facts|출시일|가격|전체 메달|스트라타젬/.test(bannerHtml), 'banner has no stat cells (release date, price, medals, counts)');
const latest = warbonds.find(w => w.id === latestWarbondId);
ok(bannerHtml.includes('최신 출시 채권') && bannerHtml.includes(`>${escape(latest.name)}</h2>`) && bannerHtml.includes(`>${escape(latest.en)}</p>`), 'banner shows its label, the Korean name and the English name');

// --- Item images on the board (scripts/tools/fetch-warbond-item-images.py) -------------------------
const svg = body => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 128">${body}</svg>`);
eq(validateSvg(svg('<path fill="white" d="M0 0h10v10z"/>')), { width: 256, height: 128 }, 'SVG dimensions fall back to viewBox');
eq(validateSvg(svg('<defs><path id="p" d="M0 0h10"/></defs><use href="#p" style="fill:url(#p)"/>'), { width: 512, height: 256 }),
  { width: 512, height: 256 }, 'SVG accepts internal references and API dimensions');
eq(validateSvg(Buffer.from('<?xml version="1.0" encoding="UTF-8"?><svg width="20px" height="10"/>')),
  { width: 20, height: 10 }, 'SVG accepts XML declaration and intrinsic dimensions');
for (const body of [
  '<script>alert(1)</script>', '<g onload="alert(1)"/>', '<g ONCLICK="alert(1)"/>',
  '<foreignObject/>', '<animate attributeName="href" to="https://example.com"/>',
  '<use href="https://example.com/a.svg#p"/>', '<use href="other.svg#p"/>',
  '<use xlink:href="//example.com/a.svg" xmlns:xlink="http://www.w3.org/1999/xlink"/>',
  '<use href="data:image/svg+xml,test"/>', '<use href="&#104;ttps://example.com"/>',
  '<path style="fill:url(https://example.com)"/>', '<path fill="url(other.svg#p)"/>',
  '<path fill="u\\72l(other.svg#p)"/>', '<path fill="u/**/rl(other.svg#p)"/>',
  '<style>path { fill:url(//example.com); }</style>', '<style>@import "other.css";</style>',
  '<style>path { fill:u\\72l(other.svg); }</style>', '<style>path { fill:u<!-- -->rl(other.svg); }</style>',
  '<style>path { background-image:image-set("other.png" 1x); }</style>',
  '<g xml:base="https://example.com"/>', '<path style="fill:&#117;rl(other.svg)"/>',
  '<g>', '<g></path>', '<g fill="white" fill="red"/>', '<g>&undefined;</g>',
  '<!DOCTYPE svg>', '<?other processing?>', '<![CDATA[test]]>',
]) {
  assert.throws(() => validateSvg(svg(body)), /Unsafe or invalid SVG/, `reject unsafe/malformed SVG: ${body}`); checks++;
}
assert.throws(() => validateSvg(Buffer.from('<!DOCTYPE svg [<!ENTITY x "test">]><svg/>')), /Unsafe or invalid SVG/); checks++;
assert.throws(() => validateSvg(Buffer.alloc(MAX_SVG_BYTES + 1)), /size exceeds/); checks++;
const { readdir } = await import('node:fs/promises');
const usedImages = new Set(warbonds.flatMap(w => w.pages.flatMap(p => p.items.map(i => i.image))));
const itemDir = new URL('dist/assets/warbond-items/', root);
const onDiskImages = new Set(await readdir(itemDir));
// Wiki redirects can map multiple filenames to the same proven shared SVG.
eq(new Set(warbondItemImagesMissing).size, warbondItemImagesMissing.length, 'no duplicate missing image entries');
ok(warbondItemImagesMissing.every(file => usedImages.has(file) && !Object.hasOwn(warbondItemImages, file)), 'missing list contains only used, unmapped images');
let imageBytes = 0;
for (const [file, image] of Object.entries(warbondItemImages)) {
  ok(usedImages.has(file), `item image ${file} is used by a tile (re-run the fetch script after a data refresh)`);
  ok(/^\.\/assets\/(?:warbond-items\/[a-z0-9-]+\.(?:webp|svg)|stratagems\/[a-z0-9-]+\.svg)$/.test(image.src), `${file}: local WebP/SVG path`);
  const bytes = await readFile(new URL(`dist/${image.src.slice(2)}`, root));
  eq(createHash('sha256').update(bytes).digest('hex'), image.sha256, `${file}: file matches its record`);
  ok([image.width, image.height, ...image.box].every(n => Number.isFinite(n) && n > 0), `${file}: positive intrinsic dimensions and tile box`);
  if (image.src.endsWith('.svg')) {
    eq(validateSvg(bytes, image), { width: image.width, height: image.height }, `${file}: passive XML SVG within 50 KB`);
    eq(createHash('sha1').update(bytes).digest('hex'), image.sha1, `${file}: original SVG matches wiki SHA-1`);
    if (image.src.startsWith('./assets/stratagems/')) {
      const icon = Object.values(wikiIcons).find(icon => icon.title === (image.wikiTitle || file));
      ok(icon && icon.src === image.src && icon.sha256 === image.sha256, `${file}: shared SVG has the same recorded wiki filename and SHA-256`);
      eq(decodeURIComponent(new URL(icon.source).pathname), `/wiki/File:${icon.title.replaceAll(' ', '_')}`, `${file}: shared wiki source confirms identity`);
    }
  } else {
    ok(image.width <= image.box[0] && image.height <= image.box[1], `${file}: raster no larger than its largest tile box`);
    ok(bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP', `${file}: WebP bytes`);
  }
  const source = new URL(image.source);
  eq(source.origin, 'https://helldivers.wiki.gg', `${file}: wiki image source`);
  eq(decodeURIComponent(source.pathname), `/wiki/File:${file.replaceAll(' ', '_')}`, `${file}: attribution points to the template image`);
}
for (const file of usedImages) ok(Object.hasOwn(warbondItemImages, file) !== warbondItemImagesMissing.includes(file), `${file}: either mapped or listed as missing (run python scripts/tools/fetch-warbond-item-images.py)`);
const dedicatedSources = new Set(Object.values(warbondItemImages).map(image => image.src).filter(src => src.startsWith('./assets/warbond-items/')));
eq(new Set([...onDiskImages].map(name => `./assets/warbond-items/${name}`)), dedicatedSources, 'every file in warbond-items is referenced and every dedicated mapping file exists');
for (const src of dedicatedSources) imageBytes += (await readFile(new URL(`dist/${src.slice(2)}`, root))).length;
ok(imageBytes <= 4_000_000, `item images total ${imageBytes} bytes (budget 4,000,000)`);
const mappingText = await readFile(new URL('dist/data/warbond-item-images.js', root), 'utf8');
ok(!mappingText.includes('\r'), 'item image mapping uses LF');
ok(mappingText.includes('CC BY-NC-SA 4.0') && mappingText.includes('Trimmed, resized, WebP') && mappingText.includes('SVGs: original bytes'), 'image license, raster modifications and original SVG reuse are recorded');

// --- Board rendering: CSS grid spans, links, unconfirmed markers, English -------------------------
const { pageBlock, tile } = await import('../dist/ui/views/warbonds.js');
const { setLang, addEnglish } = await import('../dist/core/i18n.js');
const tilesOf = text => [...text.matchAll(/<li class="wb-tile"([^>]*)>([\s\S]*?)<\/li>/g)];
// Exercise SVG rendering before the network refresh fills the real SVG mapping.
const svgFixture = '__SVG rendering fixture__';
try {
  for (const [kind, src] of [['title', './assets/warbond-items/rookie-title-icon.svg'], ['stratagem', './assets/stratagems/apex-stratagem-icon.svg']]) {
    warbondItemImages[svgFixture] = { src, width: 512, height: 512 };
    const text = String(tile({ name: 'SVG', image: svgFixture, kind, cost: 20, costStatus: 'confirmed', col: 1, row: 1, colspan: 1, rowspan: 1 }, warbonds[0].id));
    ok(text.includes(`<img class="wb-tile-img" src="${src}"`) && text.includes('width="512" height="512"') && !text.includes('data-no-image'), `${kind}: shared/dedicated SVG renders as an image even when intrinsic size exceeds the tile`);
  }
} finally {
  delete warbondItemImages[svgFixture];
}
for (const warbond of warbonds) for (const p of warbond.pages) {
  const text = String(pageBlock(p, warbond));
  const tiles = tilesOf(text);
  eq(tiles.length, p.items.length, `${warbond.id} p${p.number}: one tile per item`);
  ok(text.includes(`<ul class="wb-board " data-tier="${warbond.tier}"`) && text.includes(`>PAGE_${p.number}<`), `${warbond.id} p${p.number}: board and PAGE_ header`);
  p.items.forEach((item, index) => {
    const [, attrs, body] = tiles[index];
    ok(attrs.includes(`style="grid-column: ${item.col} / span ${item.colspan}; grid-row: ${item.row} / span ${item.rowspan}"`), `${warbond.id} p${p.number} ${item.name}: placed with grid spans`);
    const image = warbondItemImages[item.image];
    ok(image ? body.includes(`src="${image.src}"`) : !body.includes('<img') && attrs.includes('data-no-image'), `${warbond.id} p${p.number} ${item.name}: image or name-only tile`);
    ok(item.ref ? body.includes(`data-wb-item="${item.ref.view}/${item.ref.id}"`) : !body.includes('data-wb-item'), `${warbond.id} p${p.number} ${item.name}: detail link only for site entries`);
    if (!item.ref && !['super-credits', 'title'].includes(item.kind)) ok(body.includes('href="https://helldivers.wiki.gg/wiki/'), `${warbond.id} p${p.number} ${item.name}: wiki link kept`);
    const unsure = item.costStatus !== 'confirmed' || item.nameStatus || item.pageStatus;
    ok(unsure ? body.includes(`>${UNCONFIRMED}</span>`) && attrs.includes('data-unsure') : !body.includes(UNCONFIRMED), `${warbond.id} p${p.number} ${item.name}: 미확인 marker on the tile when the wiki disagrees`);
    ok(item.cost != null ? body.includes(`<span>${item.cost.toLocaleString('ko-KR')}</span>`) : true, `${warbond.id} p${p.number} ${item.name}: price shown`);
  });
  ok(p.number === 1 ? text.includes('처음부터 해금') : p.unlock == null || text.includes(`메달 <b>${p.unlock.toLocaleString('ko-KR')}</b>개 사용 시 해금`), `${warbond.id} p${p.number}: unlock text`);
}
ok(warbonds.flatMap(w => w.pages.flatMap(p => p.items)).filter(i => i.costStatus !== 'confirmed' || i.nameStatus || i.pageStatus).length > 0, 'the real data has unconfirmed tiles to show');
addEnglish(Object.entries(english));
setLang('en');
const sampleBond = warbonds.find(w => w.id === 'democratic-detonation');
const enBoard = String(pageBlock(sampleBond.pages[1], sampleBond));
ok(enBoard.includes('Unlocks after spending <b>') && enBoard.includes('>PAGE_2<') && enBoard.includes('>Page 2<') && enBoard.includes('medals</span>'), 'English board header and price text');
ok(String(pageBlock(sampleBond.pages[0], sampleBond)).includes('Unlocked from the start'), 'English page 1 text');
const unsureBond = warbonds.find(w => w.pages.some(p => p.items.some(i => i.costStatus !== 'confirmed')));
const unsureEn = String(pageBlock(unsureBond.pages.find(p => p.items.some(i => i.costStatus !== 'confirmed')), unsureBond));
ok(unsureEn.includes('>Unconfirmed</span>') && unsureEn.includes('Cost unconfirmed: template'), 'English unconfirmed marker and note');
ok(!/[가-힣]/.test(enBoard.replace(/<[^>]*>/g, ' ')), 'English board text has no Korean');
for (const warbond of warbonds) for (const p of warbond.pages) {
  const text = String(pageBlock(p, warbond));
  ok(!/[가-힣]/.test(text.replace(/<[^>]*>/g, ' ')), `${warbond.id} p${p.number}: all English tile names, kinds, weights and markers`);
}
setLang('ko');
const fallback = String(pageBlock({ ...sampleBond.pages[0], layoutStatus: UNCONFIRMED }, sampleBond));
ok(fallback.includes('is-unplaced') && fallback.includes('배치 미확인') && !fallback.includes('grid-column:'), 'an invalid future layout has a visible fallback without unsafe spans');
const css = await readFile(new URL('dist/ui/app.css', root), 'utf8');
ok(/\.wb-board\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--wb-cols, 5\)/.test(css) && /@container \(max-width: 520px\)/.test(css), 'board CSS: 5-column grid with a narrow (container) layout');
ok(/\.wb-board\[data-tier="premium"\], \.wb-board\[data-tier="legendary"\]\s*\{[^}]*--tile-hatch: #71f1fb/.test(css), 'premium and legendary share the teal hatch until more in-game evidence is available');
ok(/\.wb-tile-img\s*\{[^}]*object-fit:\s*contain/.test(css), 'raster and SVG tiles preserve their aspect ratio');
ok(/\.wb-tile\[data-kind="title"\] \.wb-tile-img\s*\{[^}]*brightness\(0\) invert\(1\) drop-shadow/.test(css), 'title glyphs stay white with a dark shadow on black and teal tiles');

// CSS/markup contract: SC rewards have no detail link, so their amount must stay
// visible on touch screens. Keep the compact treatment inside the narrow query.
const narrowBoardCss = css.match(/@container \(max-width: 520px\) \{([\s\S]*?)\n\}/)?.[1];
ok(narrowBoardCss, 'narrow board CSS exists for the SC visibility contract');
const hiddenNameSelectors = [...narrowBoardCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(([, selector, rules]) => selector.includes('.wb-tile-name') && /clip:\s*rect\(/.test(rules))
  .flatMap(([, selector]) => selector.split(',').filter(part => part.includes('.wb-tile-name')).map(part => part.trim()));
eq(hiddenNameSelectors, ['.wb-tile:not([data-kind="super-credits"]) .wb-tile-name'], 'narrow name-hiding rule explicitly excludes SC tiles');
ok(/\.wb-tile\[data-kind="super-credits"\] \.wb-tile-name\s*\{[^}]*inset:\s*auto 3px 2px var\(--pad-l\);[^}]*font-size:\s*11px;[^}]*white-space:\s*nowrap;/.test(narrowBoardCss), 'SC amount uses a compact single line inside a 1×1 tile');
ok(/\.wb-tile\[data-kind="super-credits"\] \.wb-tile-img\s*\{[^}]*height:\s*calc\(100% - 32px\)/.test(narrowBoardCss), 'narrow SC image leaves room below it for the amount');
for (const language of ['ko', 'en']) {
  setLang(language);
  for (const amount of [50, 100]) {
    const reward = warbonds.flatMap(w => w.pages.flatMap(p => p.items))
      .find(i => i.kind === 'super-credits' && i.superCredits === amount && i.colspan === 1 && i.rowspan === 1);
    ok(reward, `${language}: real ${amount} SC reward on a 1×1 tile`);
    const text = String(tile(reward, warbonds[0].id));
    ok(text.includes('data-kind="super-credits"') && text.includes('<div class="wb-tile-body"') && text.includes('<img class="wb-tile-img"'), `${language}: ${amount} SC uses the visible-name exception on an image tile without a detail link`);
    ok(text.includes(`<span class="wb-tile-name"><b>${amount} SC</b></span>`), `${language}: ${amount} SC is in the name element excluded from narrow hiding`);
  }
}
setLang('ko');

console.log(`PASS warbonds: ${checks} checks (${warbonds.length} warbonds, ${warbondDiscrepancies.length} wiki discrepancies left 미확인, ${warbondLinks.weapons} weapon + ${warbondLinks.stratagems} stratagem links).`);

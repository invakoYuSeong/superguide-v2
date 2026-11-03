// Downloads the armor sources into db/source/:
//   wiki_armor.json  ← Helldivers Wiki: every page in Category:Light/Medium/Heavy Armor (body armor)
//                      and Category:Armor Passives (wikitext + revision)
//   namu_armor.json  ← Namu Wiki "HELLDIVERS 2/방어구" and its 경량/일반/중량 subpages, headings only
//                      (Korean passive names and armor names, the same as the in-game Korean text)
// Parsing happens offline in scripts/armor-parse.mjs (used by build-armor.mjs and the tests).
// Usage: node scripts/fetch-armor.mjs
// wiki.gg rejects browser (Mozilla) User-Agents, so a plain tool UA is sent.
import { writeFile } from 'node:fs/promises';
import { compactKoreanPage } from './fetch-weapons-source.mjs';
import { parseArmorPage, parsePassivePage } from './armor-parse.mjs';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const WEIGHTS = { light: 'Category:Light Armor', medium: 'Category:Medium Armor', heavy: 'Category:Heavy Armor' };
const PASSIVES = 'Category:Armor Passives';
const NAMU = ['HELLDIVERS 2/방어구', 'HELLDIVERS 2/방어구/경량', 'HELLDIVERS 2/방어구/일반', 'HELLDIVERS 2/방어구/중량'];
const wait = ms => new Promise(done => setTimeout(done, ms));

const get = async params => {
  const res = await fetch(`${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(params).slice(0, 120)}`);
  const body = await res.json();
  if (body.error) throw new Error(`${body.error.code}: ${body.error.info}`);
  return body;
};
async function members(category) {
  const titles = [];
  let cont = {};
  do {
    const r = await get({ action: 'query', list: 'categorymembers', cmtitle: category, cmnamespace: '0', cmlimit: '500', ...cont });
    titles.push(...r.query.categorymembers.map(page => page.title));
    cont = r.continue || null;
  } while (cont);
  return titles.sort();
}

const retrievedAt = new Date().toISOString().slice(0, 10);
async function pages(titles) {
  const out = {};
  for (let start = 0; start < titles.length; start += 50) {
    await wait(250);
    const r = await get({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', titles: titles.slice(start, start + 50).join('|') });
    for (const page of r.query.pages) {
      const rev = page.revisions?.[0];
      if (!rev) throw new Error(`No revision for ${page.title}`);
      out[page.title] = {
        source: `https://helldivers.wiki.gg/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_')).replace(/%2F/g, '/')}`,
        pageid: page.pageid, revision: rev.revid, revisionTimestamp: rev.timestamp, retrievedAt,
        wikitext: rev.slots.main.content,
      };
    }
  }
  const missing = titles.filter(title => !out[title]);
  if (missing.length) throw new Error(`Missing pages: ${missing.join(', ')}`);
  return Object.fromEntries(titles.map(title => [title, out[title]]));
}

// --- Helldivers Wiki ------------------------------------------------------------------
const categories = {};
for (const [weight, category] of Object.entries(WEIGHTS)) categories[weight] = await members(category);
const armorTitles = [...new Set(Object.values(categories).flat())].sort();
const armors = await pages(armorTitles);
const passiveTitles = await members(PASSIVES);
const allPassives = await pages(passiveTitles);
// The category also holds the "Armor Passives" overview page; only pages with the
// passive infobox are individual passives.
const isPassive = title => /\{\{\s*Infobox[ _]Armor[ _]Passive/i.test(allPassives[title].wikitext);
const passives = Object.fromEntries(passiveTitles.filter(isPassive).map(title => [title, allPassives[title]]));
const skipped = Object.fromEntries(passiveTitles.filter(title => !isPassive(title)).map(title => [title, { revision: allPassives[title].revision, reason: 'no Infobox Armor Passive (overview page)' }]));

await writeFile(new URL('../db/source/wiki_armor.json', import.meta.url), JSON.stringify({
  source: 'https://helldivers.wiki.gg/wiki/Category:Armor',
  license: 'CC BY-NC-SA 4.0',
  retrievedAt,
  categories,
  skipped,
  armors,
  passives,
}, null, 1) + '\n');

// --- Namu Wiki (Korean names) ---------------------------------------------------------
const namuPages = [];
for (const title of NAMU) {
  await wait(500);
  const source = 'https://namu.wiki/w/' + title.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(source, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  const html = await response.text();
  namuPages.push(compactKoreanPage({ source, status: response.status, modifiedAt: null, retrievedAt, html }));
}
const badNamu = namuPages.filter(page => page.status !== 200 || !page.headings.length);
if (badNamu.length) throw new Error(`Namu Wiki pages without headings: ${badNamu.map(page => `${page.source} (${page.status})`).join(', ')}`);
await writeFile(new URL('../db/source/namu_armor.json', import.meta.url), JSON.stringify({ source: namuPages[0].source, retrievedAt, pages: namuPages }, null, 1) + '\n');

for (const [title, page] of Object.entries(armors)) {
  const armor = parseArmorPage(page.wikitext, title);
  console.log(`${title} r${page.revision}: ${armor.weight} ${armor.armorRating}/${armor.speed}/${armor.staminaRegen} · ${armor.passive} · ${armor.source.raw}`);
}
for (const [title, page] of Object.entries(passives)) console.log(`${title} r${page.revision}: ${parsePassivePage(page.wikitext, title).effects.length} effect lines`);
console.log(`Wrote db/source/wiki_armor.json (${armorTitles.length} armors, ${Object.keys(passives).length} passives; skipped ${Object.keys(skipped).join(', ') || 'none'}) and db/source/namu_armor.json (${namuPages.map(page => page.headings.length).join('/')} headings; retrieved ${retrievedAt}).`);

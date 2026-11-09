// Downloads the Korean names of warbond cosmetics and boosters into db/source/namu_warbond_items.json.
//   HELLDIVERS 2/부스터 <- each booster's Korean name with its English name under it
//   HELLDIVERS 2/치장   <- §2.6 titles as "Korean(English)"
//   HELLDIVERS 2/스토어 <- every warbond page board: Korean name, kind and medal cost of each tile.
//                        The 치장 page lists emotes, cards, capes and patterns in Korean only, so
//                        these boards are what ties a Korean name to a tile (same warbond, page,
//                        kind and cost) in scripts/build-warbonds.mjs.
// Only the parsed names are saved, so the build stays offline.
// Usage: node scripts/fetch-namu-warbond-items.mjs
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeHtml } from './fetch-weapons-source.mjs';

const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const PAGES = { boosters: 'HELLDIVERS 2/부스터', cosmetics: 'HELLDIVERS 2/치장', store: 'HELLDIVERS 2/스토어' };
// Image alt prefixes on the store boards ('HD2 <kind> <name>') -> site tile kind.
export const BOARD_KINDS = { '부스터': 'booster', '감정표현': 'emote', '승리포즈': 'victory-pose', '플레이어 카드': 'player-card', '망토': 'cape', '칭호': 'title', '패턴': 'pattern' };

const plain = value => decodeHtml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const footnotes = text => text.replace(/(?:\s*\[\d+\])+$/, '').trim();
// Section headings (<h2>–<h6>) with their text and where their content starts.
const headings = html => [...html.matchAll(/<h([2-6]) class="wiki-heading"[^>]*>([\s\S]*?)<\/h\1>/g)]
  .map(m => ({ index: m.index, end: m.index + m[0].length, title: footnotes(plain(m[2]).replace(/^[\d.]+\s*/, '').replace(/\s*\[편집\]$/, '')) }));
const sections = html => headings(html).map((h, i, all) => ({ title: h.title, html: html.slice(h.end, all[i + 1]?.index ?? html.length) }));

/** Booster page: <strong>Korean</strong> ... <br><sub>English</sub> in each booster's box. */
export function parseBoosters(html) {
  return [...html.matchAll(/<strong[^>]*>([^<]+)<\/strong>(?:<\/span>)*<br[^>]*><sub[^>]*>([^<]+)<\/sub>/g)]
    .map(m => ({ name: decodeHtml(m[1]).trim(), en: decodeHtml(m[2]).trim() }));
}

/** 치장 page §칭호: one "Korean(English)" line per title (footnote marks dropped). */
export function parseTitles(html) {
  const section = sections(html).find(s => s.title === '칭호');
  if (!section) return [];
  const lines = decodeHtml(section.html.replace(/<br[^>]*>|<\/(?:div|td|p)>/gi, '\n').replace(/<[^>]*>/g, '')).split('\n');
  return lines.map(line => footnotes(line.trim()).match(/^(.*[가-힣].*?)\s*\(([A-Za-z0-9][^()가-힣]*)\)$/))
    .filter(Boolean).map(m => ({ name: m[1].trim(), en: m[2].trim() }));
}

/** Store page: each warbond section's collapsed "페이지 _N" boards, one entry per cosmetic or booster tile. */
export function parseBoards(html) {
  const boards = [];
  for (const section of sections(html)) {
    const pages = [];
    for (const part of section.html.split(/<details class='wiki-folding'[^>]*>/).slice(1)) {
      const number = Number(plain(part.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ?? '').match(/^\[?\s*페이지 _(\d+)/)?.[1]);
      if (!number) continue;
      const items = [];
      for (const cell of part.split(/<td\b/).slice(1).map(text => text.split('</td>')[0])) {
        const cost = cell.match(/alt='HD2 메달 아이콘'[^>]*><\/span><\/span><\/a>\s*([\d,]+)/)?.[1];
        const alt = [...cell.matchAll(/alt='HD2 ([^']*)'/g)].map(m => m[1]).find(text => text !== '메달 아이콘');
        const label = alt && Object.keys(BOARD_KINDS).find(kind => alt.startsWith(`${kind} `));
        const name = plain(cell.split(/<br[^>]*>/).at(-1));
        if (cost && label && name) items.push({ kind: label, name, cost: Number(cost.replace(/,/g, '')) });
      }
      pages.push({ number, items });
    }
    if (pages.length) boards.push({ warbond: section.title, pages });
  }
  return boards;
}

async function main() {
  const retrievedAt = new Date().toISOString().slice(0, 10);
  const pages = [], html = {};
  for (const [key, title] of Object.entries(PAGES)) {
    const source = 'https://namu.wiki/w/' + title.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(source, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    html[key] = await response.text();
    const modifiedAt = html[key].match(/최근 수정 시각:\s*<time datetime="([^"]+)"/)?.[1] ?? null;
    if (response.status !== 200 || !modifiedAt) throw new Error(`${source}: status ${response.status}${modifiedAt ? '' : ', no article (blocked?)'}`);
    pages.push({ title, source, status: response.status, modifiedAt });
    await new Promise(done => setTimeout(done, 1000));
  }
  const boosters = parseBoosters(html.boosters), titles = parseTitles(html.cosmetics), boards = parseBoards(html.store);
  if (!boosters.length || !titles.length || !boards.length) throw new Error(`Nothing parsed: ${boosters.length} boosters, ${titles.length} titles, ${boards.length} boards`);
  // One line per name record.
  const text = JSON.stringify({ source: pages[0].source, license: 'CC BY-NC-SA 2.0 KR', retrievedAt, pages, boosters, titles, boards }, null, 1)
    .replace(/\{\n\s*([^{}[\]]*?)\n\s*\}/g, (_, body) => `{${body.replace(/\n\s*/g, ' ')}}`);
  await writeFile(new URL('../db/source/namu_warbond_items.json', import.meta.url), text + '\n');
  console.log(`Wrote db/source/namu_warbond_items.json: ${boosters.length} boosters, ${titles.length} titles, ${boards.length} warbond boards (${boards.reduce((n, b) => n + b.pages.reduce((m, p) => m + p.items.length, 0), 0)} tiles); retrieved ${retrievedAt}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

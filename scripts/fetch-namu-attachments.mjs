// Downloads the Korean attachment names of the primary weapons into db/source/namu_attachments.json.
//   HELLDIVERS 2/무기/주 무기 <- each weapon section's '무기 커스터마이징' table: per slot, every
//                              attachment's Korean name and unlock ('기본' or level + cost).
// The page has no English attachment names, so scripts/build-attachments.mjs ties a Korean name
// to a wiki attachment by weapon, slot, unlock level and cost. Only the parsed rows are saved,
// so the build stays offline.
// Usage: node scripts/fetch-namu-attachments.mjs
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeHtml } from './fetch-weapons-source.mjs';

const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const TITLE = 'HELLDIVERS 2/무기/주 무기';
// Slot header rows of the table -> site slot ids (scripts/build-attachments.mjs SLOTS).
export const NAMU_SLOTS = { '광학 장비': 'optics', '총열 하부': 'underbarrel', '총구': 'muzzle', '탄창': 'magazine' };

const plain = value => decodeHtml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const footnotes = text => text.replace(/(?:\s*\[\d+\])+$/, '').trim();
const headings = html => [...html.matchAll(/<h([2-6]) class="wiki-heading"[^>]*>([\s\S]*?)<\/h\1>/g)]
  .map(m => ({ index: m.index, end: m.index + m[0].length, title: footnotes(plain(m[2]).replace(/^[\d.]+\s*/, '').replace(/\s*\[편집\]$/, '')) }));
const number = text => Number(text.replaceAll(',', ''));

/**
 * One entry per weapon section with a customization table: { title, code, name, rows }.
 * A row is { slot, name, default: true } for '기본' or { slot, name, level, cost } (cost null for '?').
 * Two table layouts are read: name | 기본 / name | cost | 레벨 N, and image | name | 기본 or Lv.N cost | effects.
 * Rows that look like an attachment but fit neither are returned in `unparsed`.
 */
export function parseAttachmentTables(html) {
  const weapons = [], unparsed = [];
  const heads = headings(html);
  heads.forEach((head, i) => {
    const body = html.slice(head.end, heads[i + 1]?.index ?? html.length);
    const start = body.indexOf('커스터마이징</strong>');
    if (start < 0) return;
    const end = body.indexOf('패턴 정보', start);
    const code = head.title.match(/^[A-Za-z0-9/-]+/)?.[0];
    const rows = [];
    let slot = null;
    for (const tr of body.slice(start, end < 0 ? undefined : end).split(/<tr\b/).slice(1)) {
      const cells = tr.split(/<td\b/).slice(1).map(cell => footnotes(plain(`<td${cell.split('</td>')[0]}`)));
      if (cells.length === 1 && NAMU_SLOTS[cells[0]]) { slot = NAMU_SLOTS[cells[0]]; continue; }
      let row = null;
      if (cells.length === 2 && cells[0] && cells[1] === '기본') row = { name: cells[0], default: true };
      else if (cells.length === 3 && cells[0] && /^레벨 \d+$/.test(cells[2]) && /^([\d,]+|\?)$/.test(cells[1])) row = { name: cells[0], level: Number(cells[2].slice(3)), cost: cells[1] === '?' ? null : number(cells[1]) };
      else if (cells.length === 4 && cells[1] && cells[2] === '기본') row = { name: cells[1], default: true };
      else if (cells.length === 4 && cells[1] && /^Lv\.\d+ ([\d,]+|\?)$/.test(cells[2])) {
        const [level, cost] = cells[2].slice(3).split(' ');
        row = { name: cells[1], level: Number(level), cost: cost === '?' ? null : number(cost) };
      } else if (cells.some(cell => /^(기본|레벨 \d+|Lv\.\d+.*)$/.test(cell))) unparsed.push({ weapon: head.title, cells });
      if (!row) continue;
      if (!slot) { unparsed.push({ weapon: head.title, cells, issue: 'no slot header before the row' }); continue; }
      rows.push({ slot, ...row });
    }
    weapons.push({ title: head.title, code, name: head.title.slice(code?.length ?? 0).trim(), rows });
  });
  return { weapons, unparsed };
}

async function main() {
  const retrievedAt = new Date().toISOString().slice(0, 10);
  const source = 'https://namu.wiki/w/' + TITLE.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(source, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  const html = await response.text();
  const modifiedAt = html.match(/최근 수정 시각:\s*<time datetime="([^"]+)"/)?.[1] ?? null;
  if (response.status !== 200 || !modifiedAt) throw new Error(`${source}: status ${response.status}${modifiedAt ? '' : ', no article (blocked?)'}`);
  const { weapons, unparsed } = parseAttachmentTables(html);
  const rows = weapons.reduce((sum, weapon) => sum + weapon.rows.length, 0);
  if (!rows) throw new Error('Nothing parsed: no attachment rows');
  // One line per row record.
  const text = JSON.stringify({ source, title: TITLE, license: 'CC BY-NC-SA 2.0 KR', retrievedAt, modifiedAt, weapons, unparsed }, null, 1)
    .replace(/\{\n\s*([^{}[\]]*?)\n\s*\}/g, (_, body) => `{${body.replace(/\n\s*/g, ' ')}}`)
    .replace(/\[\n\s*([^{}[\]]*?)\n\s*\]/g, (_, body) => `[${body.replace(/\n\s*/g, ' ')}]`);
  await writeFile(new URL('../db/source/namu_attachments.json', import.meta.url), text + '\n');
  console.log(`Wrote db/source/namu_attachments.json: ${weapons.length} weapon tables (${weapons.filter(w => w.rows.length).length} with rows), ${rows} attachment rows, ${unparsed.length} unparsed rows; page modified ${modifiedAt}, retrieved ${retrievedAt}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

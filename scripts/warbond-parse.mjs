// Offline parser for Helldivers Wiki warbond pages (local wikitext only, no network).
// Reads {{Infobox Warbond}} and, under each ===Page N===, the {{Acquisitions Page}}
// template plus the collapsed wikitable that lists the same items. Costs come from
// the template; the table is the cross-check. A value the two sources disagree on is
// returned as null with status '미확인' and a discrepancy record — never guessed.
export const UNCONFIRMED = '미확인';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** Every {{Name ...}} template in text (balanced braces). nameRe matches the template name. */
export function findTemplates(text, nameRe) {
  const found = [];
  const opener = new RegExp(`\\{\\{\\s*(?:${nameRe.source})\\s*(?=[|}\\n])`, 'gi');
  for (const match of text.matchAll(opener)) {
    let depth = 0, i = match.index;
    for (; i < text.length - 1; i++) {
      if (text[i] === '{' && text[i + 1] === '{') { depth++; i++; }
      else if (text[i] === '}' && text[i + 1] === '}') { depth--; i++; if (!depth) break; }
    }
    if (depth) throw new Error(`Unbalanced template at ${match.index}`);
    found.push({ start: match.index, end: i + 1, body: text.slice(match.index + 2, i - 1) });
  }
  return found;
}

/** Splits a template body on top-level pipes into { named: {key: value}, positional: [] }. */
export function templateParams(body) {
  const pieces = [];
  let depth = 0, current = '';
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; current += two; i++; continue; }
    if ((two === '}}' || two === ']]') && depth) { depth--; current += two; i++; continue; }
    if (body[i] === '|' && !depth) { pieces.push(current); current = ''; continue; }
    current += body[i];
  }
  pieces.push(current);
  const named = {}, positional = [];
  for (const piece of pieces.slice(1)) {
    const eq = piece.indexOf('=');
    const key = eq > 0 ? piece.slice(0, eq).trim() : '';
    if (key && /^[\w\- ]+$/.test(key)) named[key] = piece.slice(eq + 1).trim();
    else positional.push(piece.trim());
  }
  return { name: pieces[0].trim(), named, positional };
}

/** '{{Currency|SC|1,000}}' → {amount:1000, unit:'SC'}; '145' → 145; 'Free' → 0; 'None' → none. */
export function parseCurrency(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { amount: null, unit: null, raw: text };
  if (/^free$/i.test(text)) return { amount: 0, unit: 'SC', raw: text, free: true };
  if (/^none$/i.test(text)) return { amount: null, unit: null, raw: text, none: true };
  const template = text.match(/^\{\{\s*Currency\s*\|\s*([^|}]+?)\s*\|\s*([\d,]+)\s*(?:\|[^}]*)?\}\}$/i);
  if (template) {
    const unit = /^(SC|Super Credits?)$/i.test(template[1]) ? 'SC' : /^Medals?$/i.test(template[1]) ? 'Medals' : template[1];
    return { amount: Number(template[2].replaceAll(',', '')), unit, raw: text };
  }
  if (/^[\d,]+$/.test(text)) return { amount: Number(text.replaceAll(',', '')), unit: null, raw: text };
  return { amount: null, unit: null, raw: text };
}

/** 'March 14th, 2024' | 'August 08, 2024' | '2024-03-14' → '2024-03-14'; anything else → null. */
export function parseDate(raw) {
  const text = String(raw ?? '').replace(/<ref[\s\S]*?(?:<\/ref>|\/>)/g, '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return text;
  const m = text.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS.findIndex(name => name.startsWith(m[1].toLowerCase()) && m[1].length >= 3);
  const day = Number(m[2]);
  if (month < 0 || day < 1 || day > 31) return null;
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Wiki markup → plain text: [[a|b]] → b, [[a]] → a, '' quotes and templates removed. */
export function plainText(raw) {
  return String(raw ?? '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(prev[j] + 1, next[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = next;
  }
  return prev[b.length];
}

const firstLink = raw => String(raw ?? '').match(/\[\[([^|\]#]*)(?:#[^|\]]*)?(?:\|[^\]]*)?\]\]/)?.[1]?.trim() || null;
export const normalizeName = text => String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const stem = file => normalizeName(String(file ?? '').replace(/\.(png|svg|jpe?g|webp|gif)$/i, ''));

/** Rows of the collapsed "Icon / Item / Type / Cost" wikitable(s) in a page section. */
export function parseTableRows(section) {
  const rows = [];
  for (const table of section.matchAll(/\{\|[^\n]*wikitable[\s\S]*?\n\|\}/g)) {
    for (const block of table[0].split(/\n\|-[^\n]*/).slice(1)) {
      const line = block.replace(/\n\|\}$/, '').trim();
      if (!line.startsWith('|') || line.startsWith('|}')) continue;
      const cells = line.slice(1).split('||').map(cell => cell.trim());
      if (cells.length < 4) continue;
      const icon = cells[0].match(/\[\[File:([^|\]]+)([^\]]*)\]\]/);
      const iconLink = icon?.[2].match(/\|\s*link=([^|\]]*)/)?.[1].trim() || null;
      const cost = cells[3].match(/\{\{\s*Currency\s*\|\s*Medals?\s*\|\s*([\d,]+)/i);
      rows.push({
        image: icon?.[1].trim() || null,
        iconLink,
        link: firstLink(cells[1]) || iconLink,
        name: plainText(cells[1]),
        type: plainText(cells[2]) || null,
        cost: cost ? Number(cost[1].replaceAll(',', '')) : null,
        rawCost: cells[3],
      });
    }
  }
  return rows;
}

/** Pairs each template item with one table row: same image, then same link/name (cost breaks ties). */
export function matchItems(items, rows, { typos = false, pairs = new Map() } = {}) {
  // pairs: item index -> row index (pass earlier pairs to continue matching the leftovers)
  const usedRows = new Set(pairs.values());
  const take = (i, r) => { pairs.set(i, r); usedRows.add(r); };
  const free = () => items.map((_, i) => i).filter(i => !pairs.has(i));
  const freeRows = () => rows.map((_, r) => r).filter(r => !usedRows.has(r));
  // 1) identical image file, when unique on both sides
  for (const i of free()) {
    const hits = freeRows().filter(r => rows[r].image && stem(rows[r].image) === stem(items[i].image));
    if (hits.length === 1 && items.filter(item => stem(item.image) === stem(items[i].image)).length === 1) take(i, hits[0]);
  }
  // 2) same link or name; repeat while progress is made (costs only break ties)
  const ids = item => new Set([item.link, item.name].filter(Boolean).map(normalizeName));
  const rowIds = row => new Set([row.link, row.iconLink, row.name].filter(Boolean).map(normalizeName));
  const loose = (item, row) => {
    const a = normalizeName(item.name), b = normalizeName(row.name);
    return a && b && (a.startsWith(b) || b.startsWith(a));
  };
  // A one- or two-letter spelling difference, only with the same cost (reported as a name discrepancy).
  const typo = (item, row) => item.cost === row.cost && Math.min(...[...ids(item)].map(a => Math.min(...[...rowIds(row)].map(b => editDistance(a, b))))) <= 2;
  for (const rule of typos ? [typo] : [(item, row) => [...ids(item)].some(id => rowIds(row).has(id)), loose]) {
    for (let progress = true; progress;) {
      progress = false;
      for (const i of free()) {
        const hits = freeRows().filter(r => rule(items[i], rows[r]));
        const sameCost = hits.filter(r => rows[r].cost === items[i].cost);
        const pick = hits.length === 1 ? hits[0] : sameCost.length === 1 ? sameCost[0] : null;
        if (pick != null) { take(i, pick); progress = true; }
      }
    }
  }
  return { pairs, unmatchedItems: free(), unmatchedRows: freeRows() };
}

// The in-game page board: 5 columns × 3 rows, every cell covered by exactly one tile.
export const BOARD = { cols: 5, rows: 3 };

/** Problems with a page's tile layout (empty list = every cell filled once, nothing outside the board). */
export function layoutProblems(items, { cols, rows } = BOARD) {
  const problems = [];
  const owner = new Map();
  for (const item of items) {
    const { col, row, colspan, rowspan } = item;
    const label = item.name ?? `slot ${item.slot}`;
    if (![col, row, colspan, rowspan].every(n => Number.isInteger(n) && n > 0)) { problems.push(`${label}: position or size missing`); continue; }
    if (col + colspan - 1 > cols || row + rowspan - 1 > rows) problems.push(`${label}: outside the ${cols}×${rows} board`);
    for (let r = row; r < row + rowspan; r++) for (let c = col; c < col + colspan; c++) {
      if (owner.has(`${r}:${c}`)) problems.push(`${label}: overlaps ${owner.get(`${r}:${c}`)} at row ${r}, column ${c}`);
      owner.set(`${r}:${c}`, label);
    }
  }
  for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) if (!owner.has(`${r}:${c}`)) problems.push(`row ${r}, column ${c} is empty`);
  return problems;
}

/** Parses one warbond page's wikitext. Never throws on content problems; reports them. */
export function parseWarbondPage(wikitext, title) {
  const discrepancies = [];
  const flag = (record) => discrepancies.push({ warbond: title, ...record });
  const infobox = findTemplates(wikitext, /Infobox[ _]Warbond/)[0];
  if (!infobox) throw new Error(`${title}: no Infobox Warbond`);
  const info = templateParams(infobox.body).named;
  const price = parseCurrency(info.cost);
  const creditClaim = parseCurrency(info['credit-claim']);
  const allPages = parseCurrency(info['all-pages']);
  const allItems = parseCurrency(info['all-items']);
  const type = (info.type || '').trim().toLowerCase();
  const tier = ['standard', 'premium', 'legendary'].includes(type) ? type
    : /Legendary Warbond$/.test(title) ? 'legendary' : /Premium Warbond$/.test(title) ? 'premium' : price.free ? 'standard' : null;
  if (!tier) flag({ page: null, item: null, field: 'tier', template: info.type ?? null, table: null, code: 'tier-unknown', reason: '등급을 확인하지 못했습니다.' });
  const date = parseDate(info.date);
  if (!date) flag({ page: null, item: null, field: 'date', template: info.date ?? null, table: null, code: 'date-unreadable', reason: '출시일을 해석하지 못했습니다.' });

  const headings = [...wikitext.matchAll(/^===\s*Page\s+(\d+)\s*===\s*$/gm)];
  const pages = headings.map((heading, index) => {
    const from = heading.index + heading[0].length;
    const next = wikitext.slice(from).search(/^==[^=]|^===\s*Page\s+\d+/m);
    const section = wikitext.slice(from, next < 0 ? undefined : from + next);
    const number = Number(heading[1]);
    const template = findTemplates(section, /Acquisitions[ _]Page/)[0];
    const params = template ? templateParams(template.body).named : {};
    const indexes = [...new Set(Object.keys(params).map(key => key.match(/^(\d+)_/)?.[1]).filter(Boolean))].map(Number).sort((a, b) => a - b);
    const items = indexes.map(n => {
      const cost = params[`${n}_cost`];
      return {
        slot: n,
        name: plainText(params[`${n}_name`]) || null,
        link: (params[`${n}_link`] || '').trim() || null,
        image: (params[`${n}_image`] || '').trim() || null,
        row: Number(params[`${n}_row`]) || null,
        col: Number(params[`${n}_col`]) || null,
        // Tile size on the 5×3 page board; the template omits a span of 1 on some pages.
        colspan: params[`${n}_colspan`] == null || params[`${n}_colspan`] === '' ? 1 : Number(params[`${n}_colspan`]) || null,
        rowspan: params[`${n}_rowspan`] == null || params[`${n}_rowspan`] === '' ? 1 : Number(params[`${n}_rowspan`]) || null,
        cost: /^\d[\d,]*$/.test(cost || '') ? Number(cost.replaceAll(',', '')) : null,
        rawCost: cost ?? null,
      };
    });
    const rawUnlock = params.spent_to_unlock;
    const unlockValue = /^\d[\d,]*$/.test((rawUnlock || '').trim()) ? Number(rawUnlock.replaceAll(',', '')) : null;
    const rows = parseTableRows(section);
    return { number, index, template: Boolean(template), items, rows, rawUnlock: rawUnlock ?? null, unlockValue };
  });

  // Pair template items with table rows page by page; leftovers are tried across pages,
  // because the two sources sometimes put the same item on different pages.
  const firstPass = pages.map(page => ({ page, ...matchItems(page.items, page.rows) }));
  const strayRows = firstPass.flatMap(({ page, unmatchedRows }) => unmatchedRows.map(r => ({ page: page.number, index: r, row: page.rows[r], used: false })));
  const elsewhere = new Map(); // `${page}:${itemIndex}` -> stray row on another page
  for (const { page, unmatchedItems } of firstPass) for (const i of unmatchedItems) {
    const id = [page.items[i].link, page.items[i].name].filter(Boolean).map(normalizeName);
    const hits = strayRows.filter(stray => !stray.used && stray.page !== page.number && [stray.row.link, stray.row.name].some(name => id.includes(normalizeName(name))));
    if (hits.length === 1) { hits[0].used = true; elsewhere.set(`${page.number}:${i}`, hits[0]); }
  }
  // Last, a spelling-difference pass on what is still unpaired within each page.
  const matched = firstPass.map(({ page, pairs }) => {
    const taken = new Set(strayRows.filter(stray => stray.used && stray.page === page.number).map(stray => stray.index));
    const rows = page.rows.map((row, r) => (taken.has(r) ? { ...row, name: null, link: null, iconLink: null, image: null, cost: NaN } : row));
    const items = page.items.map((item, i) => (elsewhere.has(`${page.number}:${i}`) ? { ...item, name: null, link: null, image: null, cost: NaN } : item));
    const second = matchItems(items, rows, { typos: true, pairs: new Map(pairs) });
    for (const stray of strayRows) if (stray.page === page.number && !stray.used && [...second.pairs.values()].includes(stray.index)) stray.used = true;
    return { page, pairs: second.pairs };
  });
  for (const stray of strayRows.filter(stray => !stray.used)) flag({ page: stray.page, item: stray.row.name, field: 'item', template: null, table: stray.row.cost, code: 'table-only', reason: '표에는 있지만 템플릿에 없는 항목입니다.' });

  const outPages = matched.map(({ page, pairs }) => {
    const where = { page: page.number };
    if (!page.template) flag({ ...where, item: null, field: 'template', template: null, table: page.rows.length, code: 'template-missing', reason: 'Acquisitions Page 템플릿이 없습니다.' });
    const items = page.items.map((item, i) => {
      const row = pairs.has(i) ? page.rows[pairs.get(i)] : null;
      const moved = elsewhere.get(`${page.number}:${i}`);
      const label = `${item.name}${(row || moved?.row)?.type ? ` (${(row || moved.row).type})` : ''}`;
      let cost = item.cost, costStatus = 'confirmed', pageStatus = 'confirmed', nameStatus = 'confirmed', tableName = null;
      if (item.cost == null) {
        cost = null; costStatus = UNCONFIRMED;
        flag({ ...where, item: label, field: 'cost', template: item.rawCost, table: row?.cost ?? null, code: 'cost-unreadable', reason: '템플릿 비용을 숫자로 읽지 못했습니다.' });
      } else if (moved) {
        cost = null; costStatus = UNCONFIRMED; pageStatus = UNCONFIRMED;
        flag({ ...where, item: label, field: 'page', template: { page: page.number, cost: item.cost }, table: { page: moved.page, cost: moved.row.cost }, code: 'page-differs', reason: '템플릿과 표가 이 항목을 서로 다른 페이지(와 비용)에 두었습니다.' });
      } else if (!row) {
        cost = null; costStatus = UNCONFIRMED;
        flag({ ...where, item: label, field: 'cost', template: item.cost, table: null, code: 'cost-unmatched', reason: '표에서 같은 항목을 찾지 못해 비용을 대조하지 못했습니다.' });
      } else if (row.cost !== item.cost) {
        cost = null; costStatus = UNCONFIRMED;
        flag({ ...where, item: label, field: 'cost', template: item.cost, table: row.cost, code: 'cost-differs', reason: '템플릿과 표의 비용이 다릅니다.' });
      }
      const mine = [item.link, item.name].map(normalizeName).filter(Boolean);
      const theirs = [row?.link, row?.name, row?.iconLink].map(normalizeName).filter(Boolean);
      // Same name when one is a prefix of the other ('X Helmet' vs 'X') or every word of the
      // template name appears in the table name ('Dog Breath' vs '“Guard Dog” Dog Breath').
      const words = text => new Set(String(text ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
      const subset = [item.name, item.link].some(name => words(name).size && [...words(name)].every(word => words(row?.name).has(word)));
      if (row && !subset && !mine.some(a => theirs.some(b => a.startsWith(b) || b.startsWith(a)))) {
        nameStatus = UNCONFIRMED; tableName = row.name;
        flag({ ...where, item: label, field: 'name', template: item.name, table: row.name, code: 'name-differs', reason: '템플릿과 표의 이름 표기가 다릅니다.' });
      }
      const amount = Number((row || moved?.row)?.name.match(/^([\d,]+)\s+Super Credits?$/i)?.[1].replaceAll(',', ''));
      return {
        slot: item.slot, name: item.name, link: item.link || row?.link || null, type: (row || moved?.row)?.type ?? null,
        row: item.row, col: item.col, colspan: item.colspan, rowspan: item.rowspan, image: item.image,
        cost, costStatus, templateCost: item.cost, tableCost: row?.cost ?? moved?.row.cost ?? null,
        ...(pageStatus !== 'confirmed' ? { pageStatus, tablePage: moved.page } : {}),
        ...(nameStatus !== 'confirmed' ? { nameStatus, tableName } : {}),
        ...(Number.isFinite(amount) ? { superCredits: amount } : {}),
      };
    }).sort((a, b) => (a.row ?? 99) - (b.row ?? 99) || (a.col ?? 99) - (b.col ?? 99) || a.slot - b.slot);
    return { number: page.number, rawUnlock: page.rawUnlock, unlockValue: page.unlockValue, items };
  });

  // Medals that must be spent in this warbond to open each page (spent_to_unlock).
  // Page 1 is open from the start. The infobox all-pages is the threshold of the last page.
  const last = outPages.at(-1);
  let allPagesStatus = allPages.amount == null ? UNCONFIRMED : 'confirmed';
  for (const page of outPages) {
    page.unlock = page.number === 1 ? 0 : page.unlockValue;
    page.unlockSource = page.number === 1 ? 'start' : page.unlockValue == null ? null : 'template';
  }
  if (last && last.number > 1 && allPages.amount != null) {
    if (last.unlockValue == null) { last.unlock = allPages.amount; last.unlockSource = 'infobox'; }
    else if (last.unlockValue !== allPages.amount) {
      const sum = outPages.reduce((total, page) => total + (page.unlockValue ?? 0), 0);
      flag({ page: last.number, item: null, field: 'unlock', template: last.unlockValue, infobox: allPages.amount, code: 'unlock-vs-all-pages', reason: `마지막 페이지 해금 메달(spent_to_unlock)과 인포박스 all-pages가 다릅니다.${sum === allPages.amount ? ' all-pages는 각 페이지 해금 값의 합과 같습니다.' : ''}` });
      last.unlock = null; last.unlockSource = null; allPagesStatus = UNCONFIRMED;
    }
  }
  for (const page of outPages) {
    page.unlockStatus = page.unlock == null ? UNCONFIRMED : 'confirmed';
    if (page.unlock == null && page.unlockValue == null) flag({ page: page.number, item: null, field: 'unlock', template: page.rawUnlock, code: 'unlock-missing', reason: '이 페이지를 여는 데 필요한 메달 수가 위키에 없습니다.' });
  }
  for (let i = 1; i < outPages.length; i++) {
    const [a, b] = [outPages[i - 1].unlock, outPages[i].unlock];
    if (a != null && b != null && b < a) flag({ page: outPages[i].number, item: null, field: 'unlock', template: b, code: 'unlock-order', reason: `해금 메달이 앞 페이지(${a})보다 작습니다.` });
  }

  // Totals: template sum vs infobox all-items (the table sum is kept for reference);
  // Super Credits rewards in the table vs infobox credit-claim.
  const templateSum = pages.reduce((sum, page) => sum + page.items.reduce((s, item) => s + (item.cost ?? 0), 0), 0);
  const tableSum = pages.reduce((sum, page) => sum + page.rows.reduce((s, row) => s + (row.cost ?? 0), 0), 0);
  const totals = { infobox: allItems.amount, template: templateSum, table: tableSum };
  let totalCost = allItems.amount, totalStatus = 'confirmed';
  if (allItems.amount == null) {
    totalCost = null; totalStatus = UNCONFIRMED;
    flag({ page: null, item: null, field: 'all-items', template: templateSum, code: 'all-items-missing', reason: '인포박스에 전체 메달 합계가 없습니다.' });
  } else if (allItems.amount !== templateSum) {
    totalCost = null; totalStatus = UNCONFIRMED;
    flag({ page: null, item: null, field: 'all-items', template: templateSum, infobox: allItems.amount, code: 'all-items-differs', reason: '템플릿 비용 합계와 인포박스 all-items가 다릅니다.' });
  }
  const credits = outPages.flatMap(page => page.items).filter(item => normalizeName(item.link || item.name) === 'supercredits');
  const creditSum = credits.every(item => item.superCredits) ? credits.reduce((sum, item) => sum + item.superCredits, 0) : null;
  let creditStatus = creditClaim.amount == null && !creditClaim.none ? UNCONFIRMED : 'confirmed';
  if (creditClaim.amount != null && creditSum !== creditClaim.amount) {
    creditStatus = UNCONFIRMED;
    flag({ page: null, item: null, field: 'credit-claim', table: creditSum, infobox: creditClaim.amount, code: 'credit-claim-differs', reason: '표의 슈퍼 크레딧 보상 합계와 인포박스 credit-claim이 다릅니다.' });
  }
  if (creditClaim.none && credits.length) {
    creditStatus = UNCONFIRMED;
    flag({ page: null, item: null, field: 'credit-claim', table: creditSum, infobox: 'None', code: 'credit-claim-none', reason: '인포박스에는 슈퍼 크레딧이 없다고 되어 있지만 슈퍼 크레딧 항목이 있습니다.' });
  }

  return {
    title,
    name: plainText(info.title) || title,
    image: (info.image || '').trim() || null,
    tier,
    rawType: info.type ?? null,
    date,
    rawDate: info.date ?? null,
    price: price.amount,
    rawPrice: info.cost ?? null,
    creditClaim: creditStatus !== 'confirmed' ? null : creditClaim.none ? 0 : creditClaim.amount,
    creditClaimStatus: creditStatus,
    rawCreditClaim: info['credit-claim'] ?? null,
    allPages: allPagesStatus === 'confirmed' ? allPages.amount : null,
    allPagesStatus,
    rawAllPages: info['all-pages'] ?? null,
    allItems: allItems.amount,
    totalCost,
    totalStatus,
    totals,
    pages: outPages.map(({ rawUnlock, unlockValue, ...page }) => page),
    discrepancies,
  };
}

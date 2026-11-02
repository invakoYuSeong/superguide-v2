// Warbond guide: one release-ordered grid, with a warbond sheet and an optional
// item detail alongside it (or in its place on narrow screens).
//   #/warbonds[/<warbond>]?t=<tier>&item=<gear|arsenal>/<id>&m=<mode>
import { warbonds, warbondTiers, warbondsCheckedAt, warbondsSource, warbondDiscrepancies, latestWarbondId } from '../../data/warbonds.js';
import { warbondImages } from '../../data/warbond-images.js';
import { warbondBannerImages } from '../../data/warbond-banner-images.js';
import { personalWeapons } from '../../data/personal-weapons.js';
import { formatRoute } from '../../core/route.js';
import { stratagemById } from '../../core/catalog.js';
import { html, render, $, $$, badge, external, icon } from '../dom.js';
import { L, T, lang, locale, plural } from '../../core/i18n.js';

let root, ctx;
const state = { tier: '', detail: null, item: null, mode: '', bondScroll: 0 };
let itemRender = 0, sheetListener = false;
const byId = new Map(warbonds.map(item => [item.id, item]));
const weaponById = new Map(personalWeapons.map(item => [item.id, item]));
const UNCONFIRMED = '미확인';

const count = value => value.toLocaleString(locale());
const tierName = id => warbondTiers.find(tier => tier.id === id)?.name || id;
const wikiUrl = title => `https://helldivers.wiki.gg/wiki/${encodeURIComponent(title.replaceAll(' ', '_')).replace(/%2F/g, '/')}`;
const unconfirmed = (title = '') => html`<span class="badge unknown" ${title ? html`title="${title}"` : ''}>${UNCONFIRMED}</span>`;
const sc = value => value === 0 ? L('무료', 'Free') : html`${count(value)}<small> SC</small>`;
const medals = value => html`${count(value)}<small>${L(' 메달', ' medals')}</small>`;

const KIND = {
  primary: L('주무기', 'Primary'), secondary: L('보조무기', 'Secondary'), throwable: L('투척', 'Throwable'), weapon: L('무기', 'Weapon'),
  stratagem: L('스트라타젬', 'Stratagem'), booster: L('부스터', 'Booster'), helmet: L('헬멧', 'Helmet'), armor: L('아머', 'Armor'),
  cape: L('망토', 'Cape'), 'player-card': L('플레이어 카드', 'Player card'), pattern: L('패턴', 'Pattern'), emote: L('감정 표현', 'Emote'),
  'victory-pose': L('승리 포즈', 'Victory pose'), title: L('칭호', 'Title'), 'super-credits': L('슈퍼 크레딧', 'Super Credits'), other: L('기타', 'Other'),
};
const WEIGHT = { light: L('경량', 'Light'), medium: L('중간', 'Medium'), heavy: L('중량', 'Heavy') };
const KIND_ORDER = Object.keys(KIND);
const kindLabel = item => item.kind === 'armor' && WEIGHT[item.weight] ? `${KIND.armor} · ${WEIGHT[item.weight]}` : KIND[item.kind] || KIND.other;

// What each wiki discrepancy code means, for the per-warbond notes.
function discrepancyText(d) {
  const v = value => value == null ? '—' : typeof value === 'object' ? L(`${value.page}페이지 · ${value.cost}메달`, `page ${value.page} · ${value.cost} medals`) : String(value);
  const item = d.item ? `${d.item}: ` : '';
  const page = d.page ? L(`${d.page}페이지 `, `Page ${d.page} `) : '';
  switch (d.code) {
    case 'cost-differs': return L(`${page}${item}획득 템플릿은 ${v(d.template)}메달, 접힌 표는 ${v(d.table)}메달로 서로 달라 비용을 미확인으로 둡니다.`, `${page}${item}the acquisitions template says ${v(d.template)} medals but the collapsed table says ${v(d.table)}, so the cost is left unconfirmed.`);
    case 'page-differs': return L(`${item}템플릿은 ${v(d.template)}, 표는 ${v(d.table)}로 페이지와 비용이 서로 달라 미확인으로 둡니다.`, `${item}the template puts it on ${v(d.template)}, the table on ${v(d.table)}, so its page and cost are left unconfirmed.`);
    case 'name-differs': return L(`${page}${item}템플릿과 표의 이름 표기가 다릅니다(표: ${v(d.table)}).`, `${page}${item}the template and the table spell the name differently (table: ${v(d.table)}).`);
    case 'unlock-missing': return L(`${page}해금에 필요한 메달 수가 위키에 없습니다(미확인).`, `${page}the wiki does not give the medals needed to unlock it (unconfirmed).`);
    case 'unlock-vs-all-pages': return L(`${page}해금 메달이 템플릿은 ${v(d.template)}, 인포박스(모든 페이지 해금)는 ${v(d.infobox)}로 달라 미확인으로 둡니다.`, `${page}unlock medals: the template says ${v(d.template)}, the infobox (all pages) says ${v(d.infobox)}, so both are left unconfirmed.`);
    case 'all-items-differs': return L(`항목 비용 합계 ${v(d.template)}와 인포박스 합계 ${v(d.infobox)}가 다릅니다.`, `The item costs add up to ${v(d.template)} but the infobox total is ${v(d.infobox)}.`);
    case 'credit-claim-differs': case 'credit-claim-none': return L(`슈퍼 크레딧 보상 합계(${v(d.table)})와 인포박스 값(${v(d.infobox)})이 다릅니다.`, `Super Credits rewards add up to ${v(d.table)} but the infobox says ${v(d.infobox)}.`);
    default: return L(`${page}${item}위키 자료가 서로 맞지 않습니다 (${d.code}).`, `${page}${item}the wiki sources disagree (${d.code}).`);
  }
}

// --- List -------------------------------------------------------------------------------
function cover(warbond, className = 'wb-cover') {
  const image = warbondImages[warbond.id];
  return image ? html`<img class="${className}" src="${image.src}" alt="" width="${image.width}" height="${image.height}" loading="lazy" decoding="async">` : html`<span class="${className}"></span>`;
}

function card(warbond) {
  const unsure = warbondDiscrepancies.some(d => d.warbondId === warbond.id);
  return html`<article class="card wb-card" data-tier="${warbond.tier}"><button class="card-open" type="button" data-open="${warbond.id}">
    ${cover(warbond)}
    <div><h3>${warbond.name}</h3>${lang === 'en' ? '' : html`<div class="en">${warbond.en}</div>`}</div>
    <dl class="wb-facts">
      <div><dt>${L('출시', 'Released')}</dt><dd>${warbond.date || UNCONFIRMED}</dd></div>
      <div><dt>${L('가격', 'Price')}</dt><dd>${sc(warbond.price)}</dd></div>
      <div><dt>${L('전체 메달', 'All items')}</dt><dd>${warbond.totalCost != null ? medals(warbond.totalCost) : UNCONFIRMED}</dd></div>
    </dl>
    <div class="chips">${badge(L(`${warbond.pages.length}페이지 · ${warbond.itemCount}개`, `${warbond.pages.length} pages · ${warbond.itemCount} items`), 'outline')}
      ${warbond.counts.weapons ? badge(L(`무기 ${warbond.counts.weapons}`, `${warbond.counts.weapons} ${plural(warbond.counts.weapons, 'weapon')}`), 'accent') : ''}
      ${warbond.counts.stratagems ? badge(L(`스트라타젬 ${warbond.counts.stratagems}`, `${warbond.counts.stratagems} ${plural(warbond.counts.stratagems, 'stratagem')}`), 'accent') : ''}
      ${unsure ? badge(L('일부 미확인', 'Some unconfirmed'), 'unknown') : ''}</div>
  </button></article>`;
}

// "Latest release" banner. latestWarbondId is chosen by the build (newest release date,
// ties by English title — scripts/build-warbonds.mjs pickLatest), so it follows data refreshes.
// Layout: the cover as a full-width strip (cropped top/bottom), then one row with the name on
// the left and the "view pages" button on the right. The 1600 px large cover exists only for the
// latest warbond; without it the 240 px small cover is shown at its own size (never upscaled).
export function latestBanner() {
  const warbond = warbonds.find(item => item.id === latestWarbondId);
  if (!warbond) return '';
  const large = warbondBannerImages[warbond.id];
  const image = large || warbondImages[warbond.id];
  return html`<section class="wb-latest" aria-labelledby="wb-latest-title">
    ${image ? html`<button class="wb-latest-image" type="button" data-open="${warbond.id}" tabindex="-1" aria-hidden="true"><img class="wb-latest-cover ${large ? '' : 'is-small'}" src="${image.src}" alt="" width="${image.width}" height="${image.height}" decoding="async"></button>` : ''}
    <div class="wb-latest-row">
      <div class="wb-latest-name"><div class="eyebrow">${L('최신 출시 채권', 'Latest warbond')}</div>
        <h2 id="wb-latest-title">${warbond.name}</h2>${lang === 'en' ? '' : html`<p class="en">${warbond.en}</p>`}</div>
      <button class="button primary wb-latest-cta" type="button" data-open="${warbond.id}">${L('페이지별 목록 보기', 'View pages')} ${icon('arrow', 16)}</button>
    </div>
  </section>`;
}

// Array.sort is stable: releases on the same date keep their existing order.
export function listContent(tier = '') {
  const items = warbonds.filter(item => !tier || item.tier === tier)
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  return html`<div class="grid wb-grid">${items.map(card)}</div>`;
}

function renderList() {
  render($('#wb-list', root), listContent(state.tier));
  for (const chip of $$('[data-tier-filter]', root)) chip.setAttribute('aria-pressed', String(chip.dataset.tierFilter === state.tier));
}

// Only real links belonging to this warbond may be embedded. Ignore malformed,
// unknown and unrelated item parameters without breaking the warbond itself.
export function resolveWarbondItem(warbondId, value) {
  if (typeof value !== 'string') return null;
  const [view, id, extra] = value.split('/');
  if (extra != null || !id || !['gear', 'arsenal'].includes(view)) return null;
  const ref = byId.get(warbondId)?.pages.flatMap(page => page.items)
    .find(item => item.ref?.view === view && item.ref.id === id)?.ref;
  const target = view === 'gear' ? weaponById.get(id) : stratagemById.get(id);
  return ref && target ? { view, id, target } : null;
}

export function itemRoute(route, item, mode = '') {
  return { view: 'warbonds', id: route.id, query: { ...route.query, item, m: mode } };
}

// --- Detail sheet -----------------------------------------------------------------------
function itemRow(item, warbondId) {
  const target = item.ref?.view === 'gear' ? weaponById.get(item.ref.id) : item.ref?.view === 'arsenal' ? stratagemById.get(item.ref.id) : null;
  // Official English directly (not via the dictionary: a Korean name can be shared, e.g. 스토커).
  const shownName = target ? L(target.name || target.en, target.en || target.name) : item.kind === 'super-credits' && item.superCredits ? `${count(item.superCredits)} SC` : item.name;
  const sub = target && lang !== 'en' && target.name ? target.en : '';
  const name = target
    ? html`<a class="wb-link" data-wb-item="${item.ref.view}/${item.ref.id}" href="${formatRoute({ view: 'warbonds', id: warbondId, query: { t: state.tier, item: `${item.ref.view}/${item.ref.id}` } })}"><b>${shownName}</b>${sub ? html`<small>${sub}</small>` : ''}</a>`
    : html`<span><b>${shownName}</b></span>`;
  const notes = [];
  if (item.pageStatus) notes.push(L(`표에는 ${item.tablePage}페이지`, `table: page ${item.tablePage}`));
  if (item.nameStatus) notes.push(L(`표 이름: ${item.tableName}`, `table name: ${item.tableName}`));
  const costTitle = item.costStatus === 'confirmed' ? '' : L(`템플릿 ${item.templateCost ?? '—'} · 표 ${item.tableCost ?? '—'}`, `template ${item.templateCost ?? '—'} · table ${item.tableCost ?? '—'}`);
  return html`<li class="wb-item" data-kind="${item.kind}">
    <span class="wb-kind">${kindLabel(item)}</span>
    <span class="wb-name">${name}${item.nameStatus ? unconfirmed(L('이름 표기 미확인', 'Name spelling unconfirmed')) : ''}${notes.length ? html`<small class="faint">${notes.join(' · ')}</small>` : ''}
      ${!target && item.kind !== 'super-credits' && item.kind !== 'title' ? external(wikiUrl(item.link || item.name), L('위키', 'Wiki')) : ''}</span>
    <span class="wb-cost">${item.cost != null ? medals(item.cost) : html`${unconfirmed(costTitle)}<small class="faint">${costTitle}</small>`}</span>
  </li>`;
}

function pageBlock(page, warbondId) {
  const items = [...page.items].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  const unlock = page.number === 1 ? L('처음부터 열림', 'Open from the start')
    : page.unlock != null ? L(html`이 전쟁 채권에서 메달 <b>${count(page.unlock)}</b>개 사용 시 열림`, html`Opens after spending <b>${count(page.unlock)}</b> medals in this warbond`)
      : html`${L('해금 조건', 'Unlock')} ${unconfirmed()}`;
  return html`<section class="block wb-page"><div class="wb-page-head"><h3>${L(`${page.number}페이지`, `Page ${page.number}`)}</h3>
      <span class="faint">${unlock}</span>
      <span class="wb-page-total">${page.cost != null ? html`${L('합계', 'Total')} ${medals(page.cost)}` : html`${L('합계', 'Total')} ${unconfirmed()}`}</span></div>
    <ul class="wb-items">${items.map(item => itemRow(item, warbondId))}</ul></section>`;
}

function detailContent(warbond) {
  const notes = warbondDiscrepancies.filter(d => d.warbondId === warbond.id);
  const image = warbondImages[warbond.id];
  const fact = (label, value, caption = '') => html`<div><dt>${label}</dt><dd class="${typeof value === 'string' ? 'dim' : ''}">${value}</dd>${caption ? html`<div class="caption">${caption}</div>` : ''}</div>`;
  return html`<div class="sheet-top"><span>${tierName(warbond.tier)} · ${L('전쟁 채권', 'Warbond')}</span><button class="icon-button" type="button" data-close aria-label="${L('닫기', 'Close')}">${icon('close', 18)}</button></div>
  <div class="sheet-content">
    <div class="wb-hero">${cover(warbond, 'wb-hero-cover')}<div><h2 id="sheet-title">${warbond.name}</h2>${lang === 'en' ? '' : html`<p>${warbond.en}</p>`}
      <div class="chips" style="margin-top:6px">${badge(tierName(warbond.tier), 'outline')}${badge(L(`${warbond.pages.length}페이지 · ${warbond.itemCount}개`, `${warbond.pages.length} pages · ${warbond.itemCount} items`))}</div></div></div>
    <dl class="detail-grid">
      ${fact(L('출시일', 'Release date'), warbond.date || UNCONFIRMED)}
      ${fact(L('가격', 'Price'), sc(warbond.price))}
      ${fact(L('모든 항목 구매', 'Every item'), warbond.totalCost != null ? medals(warbond.totalCost) : UNCONFIRMED, L('위키 인포박스 합계 (항목 비용 합과 대조)', 'Wiki infobox total (checked against the item costs)'))}
      ${fact(L('모든 페이지 해금', 'Unlock every page'), warbond.allPages != null ? medals(warbond.allPages) : UNCONFIRMED, L('이 전쟁 채권에서 사용한 메달 누계', 'Medals spent in this warbond'))}
      ${fact(L('슈퍼 크레딧 회수', 'Super Credits inside'), warbond.creditClaim == null ? UNCONFIRMED : warbond.creditClaim === 0 ? L('없음', 'None') : sc(warbond.creditClaim), L('항목으로 얻는 슈퍼 크레딧 합계', 'Super Credits you can claim as items'))}
      ${fact(L('무기 · 스트라타젬', 'Weapons · stratagems'), html`${count(warbond.counts.weapons)}<small> · </small>${count(warbond.counts.stratagems)}`, L('누르면 이 창에서 상세 보기', 'Tap one to view its details here'))}
    </dl>
    ${warbond.pages.map(page => pageBlock(page, warbond.id))}
    ${notes.length ? html`<div class="callout warn"><h3>${L('위키 자료 불일치', 'Wiki sources disagree')}</h3><ul class="notes">${notes.map(d => html`<li>${discrepancyText(d)}</li>`)}</ul></div>` : ''}
    <div class="sources">
      <span>${L('위키 확인', 'Checked')} ${warbondsCheckedAt} · revision ${warbond.revision} (${String(warbond.revisionTimestamp).slice(0, 10)})</span>
      ${external(warbond.source, L('위키 항목', 'Wiki page'))}
      ${image ? external(image.source, L('표지 원본', 'Cover source')) : ''}
    </div>
    <p class="faint" style="font-size:12.5px">${L('방어구·외형 항목의 이름은 위키의 영문 표기를 그대로 씁니다. 메달 비용은 위키의 획득 템플릿 값이며, 같은 문서의 접힌 표와 다르면 ‘미확인’으로 둡니다. 실시간 패치와 연동되지 않습니다.', 'Armor and cosmetic names are the wiki’s English names. Medal costs are the wiki’s acquisitions template values; where the collapsed table on the same page disagrees, the value is left unconfirmed. Not linked to live patches.')}</p>
  </div>`;
}

function listRoute() { return { view: 'warbonds', query: { ...ctx.route.query, t: state.tier, item: '', m: '' } }; }
function syncUrl() { ctx.replace({ ...listRoute(), id: state.detail }); }

// Mark only navigation created here. A copied URL must never send the visitor
// back to an unrelated site when they use one of the close controls.
function pushRoute(route, navigation) {
  ctx.go(route);
  history.replaceState({ ...history.state, warbondNavigation: navigation }, '');
}
function replaceRoute(route) { ctx.replace(route); update(route); }

function closeItem() {
  const route = itemRoute(ctx.route, '');
  if (history.state?.warbondNavigation?.itemParent === formatRoute(route)) history.back();
  else replaceRoute(route);
}

function closeWarbond() {
  const list = listRoute();
  const navigation = history.state?.warbondNavigation;
  if (navigation?.list === formatRoute(list) && navigation.depth > 0) history.go(-navigation.depth);
  else replaceRoute(list);
}

function openDetail(id) {
  const warbond = byId.get(id);
  if (!warbond) return;
  ctx.openSheet(html`<div class="wb-workspace">
    <section class="wb-item-pane" tabindex="-1" aria-label="${L('항목 상세', 'Item details')}" hidden></section>
    <section class="wb-bond-pane" aria-labelledby="sheet-title">${detailContent(warbond)}</section>
  </div>`, {
    wide: true,
    label: `${T(warbond.name)} ${L('상세', 'details')}`,
    onClose: () => { if (state.detail === id) closeWarbond(); },
  });
}

// Reuse the full-page detail renderers, with a local toolbar and a unique title.
// They are imported only after an item is opened, keeping the grid lightweight.
export async function itemDetailContent(warbondId, value, mode = '') {
  const ref = resolveWarbondItem(warbondId, value);
  if (!ref) return '';
  const header = html`<div class="sheet-top wb-item-toolbar">
    <button class="button ghost" type="button" data-wb-item-close>${icon('back', 16)} ${L('뒤로', 'Back')}</button>
    <a class="wb-full-page" href="${formatRoute({ view: ref.view, id: ref.id, query: { m: mode } })}">${L('전체 페이지로 열기', 'Open full page')} ${icon('expand', 14)}</a>
    <button class="icon-button" type="button" data-wb-item-close aria-label="${L('항목 상세 닫기', 'Close item details')}">${icon('close', 18)}</button>
  </div>`;
  const options = { header, titleId: 'wb-item-title', variant: mode, compare: false };
  if (ref.view === 'gear') {
    const { weaponDetail } = await import('./gear.js');
    return weaponDetail(ref.target, options);
  }
  const [{ stratagemDetail }, { demolitionProfiles }] = await Promise.all([
    import('./arsenal.js'), import('../../data/demolition-data.js'),
  ]);
  return stratagemDetail(ref.target, { ...options, demolition: Object.hasOwn(demolitionProfiles, ref.id) });
}

async function showItem(value, mode) {
  const version = ++itemRender;
  const sheet = $('#sheet'), pane = $('.wb-item-pane', sheet), bondPane = $('.wb-bond-pane', sheet);
  if (!pane) return;
  const previous = state.item;
  // Snapshot before the narrow layout hides the page list. Do not overwrite
  // it with the zero some browsers report while that pane is display:none.
  if (bondPane.getClientRects().length) state.bondScroll = bondPane.scrollTop;
  state.item = value; state.mode = mode;
  sheet.classList.toggle('split', !!value);
  pane.hidden = !value;
  for (const link of $$('[data-wb-item]', sheet)) {
    if (link.dataset.wbItem === value) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
  if (!value) {
    bondPane.scrollTop = state.bondScroll;
    render(pane, '');
    if (previous) $$('[data-wb-item]', sheet).find(link => link.dataset.wbItem === previous)?.focus({ preventScroll: true });
    return;
  }
  pane.scrollTop = 0;
  render(pane, html`<p class="sheet-content" role="status">${L('상세 불러오는 중…', 'Loading details…')}</p>`);
  pane.focus({ preventScroll: true });
  try {
    const content = await itemDetailContent(state.detail, value, mode);
    if (version !== itemRender || ctx.route.view !== 'warbonds' || !sheet.open) return;
    render(pane, content);
  } catch (error) {
    if (version !== itemRender || ctx.route.view !== 'warbonds' || !sheet.open) return;
    render(pane, html`<div class="sheet-content"><p>${L('상세를 불러오지 못했습니다.', 'Details could not be loaded.')}</p>
      <button class="button" type="button" data-wb-item-close>${L('뒤로', 'Back')}</button></div>`);
    console.error(error);
  }
}

function onSheetClick(event) {
  if (ctx.route.view !== 'warbonds' || !event.target.closest('.wb-workspace')) return;
  if (event.target.closest('[data-wb-item-close]')) { closeItem(); return; }
  const link = event.target.closest('[data-wb-item]');
  if (link && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    const route = itemRoute(ctx.route, link.dataset.wbItem);
    if (state.item) replaceRoute(route); // another item replaces the current one
    else {
      const navigation = history.state?.warbondNavigation;
      const list = formatRoute(listRoute());
      pushRoute(route, {
        itemParent: formatRoute(itemRoute(ctx.route, '')),
        ...(navigation?.list === list ? { list, depth: navigation.depth + 1 } : {}),
      });
    }
  }
  const variant = event.target.closest('[data-variant]');
  if (variant && state.item) {
    state.mode = variant.dataset.variant;
    for (const button of $$('[data-variant]', $('#sheet'))) button.setAttribute('aria-pressed', String(button === variant));
    for (const panel of $$('[data-variant-panel]', $('#sheet'))) panel.hidden = panel.dataset.variantPanel !== state.mode;
    ctx.replace(itemRoute(ctx.route, state.item, state.mode));
    const fullPage = $('.wb-full-page', $('#sheet'));
    const ref = resolveWarbondItem(state.detail, state.item);
    fullPage.href = formatRoute({ view: ref.view, id: ref.id, query: { m: state.mode } });
  }
}

// --- View lifecycle -------------------------------------------------------------------
export function mount(container, context) {
  root = container; ctx = context;
  state.detail = null; state.item = null; state.mode = ''; state.bondScroll = 0; ++itemRender;
  const items = warbonds.reduce((sum, item) => sum + item.itemCount, 0);
  render(root, html`<div class="page-head"><div><div class="eyebrow">Warbonds</div><h1>${L('전쟁 채권', 'Warbonds')}</h1>
      <p>${L(`전쟁 채권 ${warbonds.length}종의 출시일·가격과 페이지별 메달 비용, 들어 있는 무기와 스트라타젬(${items}개 항목). 카드를 누르면 페이지별 목록이 열립니다.`, `Release date, price and per-page medal costs of all ${warbonds.length} warbonds, with the weapons and stratagems inside (${items} items). Open a card for the page-by-page list.`)}</p></div></div>
    ${latestBanner()}
    <div class="chips" role="group" aria-label="${L('등급', 'Tier')}" style="margin-bottom:18px">
      <button class="chip" type="button" data-tier-filter="" aria-pressed="true">${L('전체', 'All')} <span class="count">${warbonds.length}</span></button>
      ${warbondTiers.map(tier => html`<button class="chip" type="button" data-tier-filter="${tier.id}" aria-pressed="false">${tier.name} <span class="count">${warbonds.filter(item => item.tier === tier.id).length}</span></button>`)}
    </div>
    <div id="wb-list"></div>
    <p class="sources wb-credit">${L('자료', 'Data')}: ${external(warbondsSource.site, 'Helldivers Wiki')} <span>(helldivers.wiki.gg) ${L('기여자들', 'contributors')}, ${external(lang === 'en' ? warbondsSource.licenseUrl : `${warbondsSource.licenseUrl}deed.ko`, warbondsSource.license)}</span>
      <span>${L(`위키 확인 ${warbondsCheckedAt} · 표지는 webp 변환·축소`, `Checked on the wiki ${warbondsCheckedAt} · covers converted to WebP and resized`)}</span></p>`);
  root.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.tierFilter != null) { state.tier = state.tier === target.dataset.tierFilter ? '' : target.dataset.tierFilter; renderList(); syncUrl(); }
    else if (target.dataset.open) {
      const list = listRoute();
      pushRoute({ ...list, id: target.dataset.open }, { list: formatRoute(list), depth: 1 });
    }
  });
  if (!sheetListener) {
    sheetListener = true;
    $('#sheet').addEventListener('click', onSheetClick);
    $('#sheet').addEventListener('cancel', event => {
      if (ctx.route.view === 'warbonds' && state.item) { event.preventDefault(); closeItem(); }
    });
  }
}

export function update(route) {
  state.tier = warbondTiers.some(tier => tier.id === route.query.t) ? route.query.t : '';
  renderList();
  const id = byId.has(route.id) ? route.id : null;
  if (id && id !== state.detail) { state.detail = id; state.item = null; state.mode = ''; state.bondScroll = 0; ++itemRender; openDetail(id); }
  else if (!id && state.detail) { state.detail = null; state.item = null; ++itemRender; ctx.closeSheet(); }
  if (!id) return;
  const ref = resolveWarbondItem(id, route.query.item);
  const value = ref ? `${ref.view}/${ref.id}` : null;
  const mode = ref?.view === 'arsenal' && ref.target.variants?.some(v => v.id === route.query.m) ? route.query.m : '';
  if (value !== state.item || mode !== state.mode) showItem(value, mode);
}

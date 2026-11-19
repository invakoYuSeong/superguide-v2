// Superstore: the Store tab's second page. The wiki's store pages as 3x2 boards with Super Credit
// prices, each page themed on a warbond (or the War Horses set).
//   #/superstore
import { superstorePages, superstoreBoard, superstoreTotal, superstoreSource } from '../../data/superstore.js';
import { warbonds } from '../../data/warbonds.js';
import { warbondItemImages } from '../../data/warbond-item-images.js';
import { currencyIcons } from '../../data/currency-icons.js';
import { personalWeapons } from '../../data/personal-weapons.js';
import { html, render, external } from '../dom.js';
import { L, lang, locale } from '../../core/i18n.js';
import { formatRoute } from '../../core/route.js';
import { storeTabs } from '../store-tabs.js';

const count = value => value.toLocaleString(locale());
const warbondById = new Map(warbonds.map(warbond => [warbond.id, warbond]));
const weaponById = new Map(personalWeapons.map(weapon => [weapon.id, weapon]));
const wikiUrl = title => `https://helldivers.wiki.gg/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
const KIND = {
  armor: ['아머', 'Armor'], helmet: ['헬멧', 'Helmet'], cape: ['망토', 'Cape'], 'player-card': ['플레이어 카드', 'Player card'],
  emote: ['감정 표현', 'Emote'], weapon: ['무기', 'Weapon'],
};
const WEAPON_KIND = { primary: ['주무기', 'Primary'], secondary: ['보조무기', 'Secondary'], throwable: ['투척', 'Throwable'] };
const SC = html`<img class="wb-medal" src="${currencyIcons['super-credit'].src}" alt="" aria-hidden="true">`;

// Weapons and armor open the site's own entry; capes, cards and emotes link to the wiki.
function tile(item) {
  const weapon = item.ref?.view === 'gear' ? weaponById.get(item.ref.id) : null;
  const kind = weapon ? L(...(WEAPON_KIND[weapon.category] ?? KIND.weapon)) : L(...KIND[item.kind]);
  const ko = weapon ? weapon.name : item.ko;
  const en = weapon ? weapon.en : item.set ?? item.name.replace(/\s*\((Cape|Player ?Card|Emote)\)$/i, '');
  const name = ko ? L(ko, en) : en;
  const sub = lang === 'en' || !ko ? '' : en;
  const image = item.image ? warbondItemImages[item.image] : null;
  const href = weapon ? formatRoute({ view: 'gear', id: weapon.id })
    : item.ref?.view === 'armor' ? formatRoute({ view: 'gear', query: { tab: 'armor', d: item.ref.id } }) : null;
  const body = html`<span class="wb-tile-cost">${SC}<span>${count(item.cost)}</span><span class="sr-only"> SC</span></span>
    <span class="wb-tile-kind">${kind}</span>
    ${image ? html`<img class="wb-tile-img" src="${image.src}" alt="" width="${image.width}" height="${image.height}" loading="lazy" decoding="async">` : ''}
    <span class="wb-tile-name"><b>${name}</b>${sub ? html`<small>${sub}</small>` : ''}</span>`;
  const title = [name, sub, kind].filter(Boolean).join('\n');
  const inner = href ? html`<a class="wb-tile-body" href="${href}" title="${title}">${body}</a>`
    : html`<a class="wb-tile-body" href="${wikiUrl(item.link || item.name)}" target="_blank" rel="noopener noreferrer" title="${title}\n${L('위키에서 보기 ↗', 'View on the wiki ↗')}">${body}</a>`;
  return html`<li class="wb-tile" data-kind="${item.kind}" data-span="${item.colspan}x${item.rowspan}" style="grid-column: ${item.col} / span ${item.colspan}; grid-row: ${item.row} / span ${item.rowspan}" ${image ? '' : 'data-no-image'}>${inner}</li>`;
}

function pageBlock(page) {
  const warbond = warbondById.get(page.warbondId);
  const theme = warbond ? html`<a href="${formatRoute({ view: 'warbonds', id: warbond.id })}">${L(warbond.name, warbond.en)}</a>` : L('워 호스 세트', 'War Horses set');
  return html`<section class="block wb-page ss-page" aria-labelledby="ss-page-${page.number}"><div class="wb-page-head">
      <h3 id="ss-page-${page.number}"><span aria-hidden="true">PAGE_${page.number}</span><span class="sr-only">${L(`${page.number}페이지`, `Page ${page.number}`)}</span></h3>
      <span class="faint">${theme}</span>
      <span class="wb-page-total">${L('합계', 'Total')} ${count(page.total)}<small> SC</small></span></div>
    <ul class="wb-board" data-tier="premium" style="--wb-cols: ${superstoreBoard.cols}; --wb-rows: ${superstoreBoard.rows}">${page.items.map(tile)}</ul></section>`;
}

export function mount(container) {
  const items = superstorePages.reduce((sum, page) => sum + page.items.length, 0);
  render(container, html`<div class="page-head"><div><div class="eyebrow">Store</div><h1 class="sr-only">${L('슈퍼 스토어', 'Superstore')}</h1>${storeTabs('superstore')}
      <p>${L(`슈퍼 크레딧으로 사는 아머·무기·꾸미기 항목 ${items}개를 위키의 상점 페이지 ${superstorePages.length}쪽 그대로 정리했습니다. 전쟁 채권에서는 얻을 수 없으며, 모든 항목을 상시 판매합니다.`,
        `The ${items} armor, weapon and cosmetic items bought with Super Credits, laid out as the wiki's ${superstorePages.length} store pages. They cannot be earned from warbonds, and every item is always on sale.`)}</p></div>
      <dl class="tally">
        <div><dt>Pages</dt><dd>${superstorePages.length}</dd></div>
        <div><dt>Items</dt><dd>${items}</dd></div>
        <div title="${L('모든 항목 가격의 합', 'Every item price added up')}"><dt>Super Credits</dt><dd><img class="tally-icon" src="${currencyIcons['super-credit'].src}" alt="">${count(superstoreTotal.sum)}</dd></div>
      </dl></div>
    <div class="ss-pages">${superstorePages.map(pageBlock)}</div>
    <p class="sources wb-credit">${L('자료', 'Data')}: ${external(superstoreSource.page, 'Helldivers Wiki · Superstore')} <span>${L(`위키 확인 ${superstoreSource.checkedAt}. 실시간 패치와 연동되지 않습니다.`, `Checked on the wiki ${superstoreSource.checkedAt}. Not linked to live patches.`)}</span></p>`);
}

export function update() {}

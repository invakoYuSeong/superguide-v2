// Armor tab of the gear view: body armor grouped by passive.
//   #/gear?tab=armor&w=<light|medium|heavy>&p=<passive,passive>&a=<armor>&q=<text>   (p: show these passives; a: scroll to and mark one set; q: search all sets)
// Loaded on demand by gear.js and by the warbond item pane (armorDetail).
import { armors, armorPassives, armorWeights, armorCheckedAt } from '../../data/armor.js';
import { armorImages } from '../../data/armor-images.js';
import { warbonds } from '../../data/warbonds.js';
import { num } from '../../core/explain.js';
import { search, personalNames, collabKeywords } from '../../core/search.js';
import { html, render, $, $$, badge, external, icon } from '../dom.js';
import { L, lang } from '../../core/i18n.js';

export const WEIGHT_IDS = armorWeights.map(weight => weight.id);
export const armorById = id => armors.find(armor => armor.id === id) ?? null;
const weightName = id => armorWeights.find(weight => weight.id === id)?.name ?? id;
const warbondById = new Map(warbonds.map(warbond => [warbond.id, warbond]));
const unconfirmed = () => html`<span class="dim">${L('미확인', 'Unconfirmed')}</span>`;

// What the Scout passive's shorter detection range means in metres: the wiki Stealth page
// (revision 142153) gives a Trooper spotting a standing Helldiver at 50 m by day and 40 m at night.
const STEALTH_PAGE = 'https://helldivers.wiki.gg/wiki/Stealth';
const DETECTION = { day: 50, night: 40 };
function passiveNote(passive) {
  if (passive.id !== 'scout') return '';
  const cut = Number(/by (\d+)%/.exec(passive.effects.map(effect => effect.en).join(' '))?.[1]);
  if (!cut) return '';
  const day = num(Math.round(DETECTION.day * (100 - cut)) / 100), night = num(Math.round(DETECTION.night * (100 - cut)) / 100);
  return html`<p class="passive-note">${L(`예: 트루퍼는 서 있는 헬다이버를 낮에 약 ${DETECTION.day}m, 밤에 약 ${DETECTION.night}m에서 알아챕니다. 정찰 패시브를 입으면 이 거리가 약 ${day}m, ${night}m로 줄어듭니다. 웅크리거나 엎드리면 더 가까이 가도 들키지 않습니다.`,
    `Example: a Trooper spots a standing Helldiver at about ${DETECTION.day} m by day and ${DETECTION.night} m at night. With the Scout passive that drops to about ${day} m and ${night} m. Crouching or lying prone lets you get closer still.`)} ${external(STEALTH_PAGE, L('위키 Stealth', 'Wiki Stealth'))}</p>`;
}

function picture(file, cls, alt = '') {
  const image = armorImages[file];
  return image ? html`<img class="${cls}" src="${image.src}" alt="${alt}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async">` : '';
}

function cost(armor) {
  if (armor.costStatus === 'exclusive') return L('한정 지급', 'Exclusive');
  if (!armor.cost) return null;
  const amount = num(armor.cost.amount);
  return armor.cost.unit === 'Medals' ? L(`${amount} 메달`, `${amount} medals`) : armor.cost.unit === 'SC' ? `${amount} SC` : `$${amount}`;
}

function source(armor) {
  const s = armor.source, price = cost(armor);
  if (s.kind === 'warbond') {
    const warbond = warbondById.get(s.warbondId);
    return html`<a href="#/warbonds/${s.warbondId}?item=armor%2F${armor.id}">${warbond.name}</a>${s.page ? L(` · ${s.page}페이지`, ` · page ${s.page}`) : ''}${price ? ` · ${price}` : ''}`;
  }
  return html`${s.name}${price ? ` · ${price}` : ''}`;
}

// The set opened from a warbond (#/gear?tab=armor&a=<id>); marked until the list is re-rendered.
let focus = '';

const stat = (label, value) => html`<div><dt>${label}</dt><dd>${value != null ? num(value) : unconfirmed()}</dd></div>`;

function armorCard(armor) {
  return html`<li class="armor-item" id="armor-item-${armor.id}" data-weight="${armor.weight}" data-armor-open="${armor.id}" tabindex="0" role="button" aria-label="${armor.name} ${L('자세히 보기', 'details')}" ${armor.id === focus ? 'data-focus' : ''}>
    <span class="armor-art">${picture(armor.image, '', '') || html`<span class="faint">${armor.code || ''}</span>`}</span>
    <div class="armor-body">
      <div class="armor-title"><h4>${armor.name}</h4>${badge(weightName(armor.weight), `outline weight-${armor.weight}`)}</div>
      ${lang === 'en' || armor.name === armor.en ? '' : html`<p class="en">${armor.en}</p>`}
      <dl class="stat-row armor-stats">${stat(L('장갑', 'Armor'), armor.armorRating)}${stat(L('속도', 'Speed'), armor.speed)}${stat(L('스태미나 회복', 'Stamina regen'), armor.staminaRegen)}</dl>
      <p class="armor-source">${source(armor)}</p>
    </div>
  </li>`;
}

function passiveSection(passive, list) {
  return html`<section class="armor-passive" id="armor-${passive.id}" aria-labelledby="armor-${passive.id}-title">
    <header class="armor-passive-head">
      <span class="armor-passive-icon">${picture(passive.icon, '')}</span>
      <div><h3 id="armor-${passive.id}-title" tabindex="-1">${passive.name}</h3>${lang === 'en' || passive.name === passive.en ? '' : html`<p class="en">${passive.en}</p>`}</div>
      <span class="armor-passive-count">${L(`${list.length}종`, `${list.length} ${list.length === 1 ? 'set' : 'sets'}`)}</span>
    </header>
    <ul class="armor-effects">${passive.effects.map(effect => html`<li>${effect.name}</li>`)}</ul>${passiveNote(passive)}
    <ul class="armor-list">${list.map(armorCard)}</ul>
  </section>`;
}

/** One armor set in the warbond item pane, in the same shape as the weapon and stratagem details. */
export function armorDetail(armor, { header = null, titleId = 'sheet-title', inGear = false } = {}) {
  const passive = armorPassives.find(item => item.id === armor.passive);
  const row = (label, value, caption = '') => html`<div><dt>${label}</dt><dd class="${value == null ? 'dim' : ''}">${value != null ? num(value) : unconfirmed()}</dd>${caption ? html`<div class="caption">${caption}</div>` : ''}</div>`;
  return html`${header}
  <div class="sheet-content">
    <div class="armor-detail-art">${picture(armor.image, '', '') || html`<span class="faint">${armor.code || ''}</span>`}</div>
    <div class="detail-id"><div><h2 id="${titleId}">${armor.name}</h2>${lang === 'en' || armor.name === armor.en ? '' : html`<p>${armor.en}</p>`}
      <div class="chips" style="margin-top:6px">${badge(weightName(armor.weight), `outline weight-${armor.weight}`)}${passive ? badge(passive.name, 'accent') : ''}</div></div></div>
    <dl class="detail-grid">
      ${row(L('장갑 등급', 'Armor rating'), armor.armorRating, L('높을수록 덜 다칩니다', 'Higher means less damage taken'))}
      ${row(L('속도', 'Speed'), armor.speed)}
      ${row(L('스태미나 회복', 'Stamina regen'), armor.staminaRegen)}
      <div><dt>${L('얻는 곳', 'Where to get it')}</dt><dd class="dim">${source(armor)}</dd></div>
    </dl>
    ${passive ? html`<section class="block"><h3>${L('패시브', 'Passive')} · ${passive.name}</h3><ul class="armor-effects">${passive.effects.map(effect => html`<li>${effect.name}</li>`)}</ul>${passiveNote(passive)}</section>` : ''}
    ${inGear ? '' : html`<div class="links"><a class="button primary" href="#/gear?tab=armor&a=${armor.id}">${L('같은 패시브 방어구 보기', 'Armor with the same passive')}</a></div>`}
    <div class="sources">
      <span>${L('자료 확인', 'Checked')} ${armorCheckedAt}</span>
      ${external(armor.wiki, L('위키 항목', 'Wiki page'))}
      ${armorImages[armor.image] ? external(`https://helldivers.wiki.gg/wiki/File:${encodeURIComponent(armor.image.replaceAll(' ', '_'))}`, L('이미지 원본', 'Image source')) : ''}
    </div>
  </div>`;
}

const passiveById = new Map(armorPassives.map(passive => [passive.id, passive]));
const searchFields = armor => ({ names: personalNames(armor), text: [passiveById.get(armor.passive)?.name, passiveById.get(armor.passive)?.en, warbondById.get(armor.source.warbondId)?.name, ...collabKeywords(armor.source.warbondId)].filter(Boolean) });

/** Renders the armor tab into panel. state.weight and state.passive (comma list) filter ('' = all); state.focus marks one set.
 *  state.q searches every set (as the gear browser searches every group), still grouped by passive. */
export function renderArmor(panel, { state, onChange, onOpen = null }) {
  focus = state.focus || '';
  // The search box is drawn once and kept, so typing does not lose focus when the list below redraws.
  if (!$('#armor-q', panel)) {
    render(panel, html`<div class="arsenal-tools armor-tools">
        <div class="row"><label class="field">${icon('search', 18)}<span class="sr-only">${L('방어구 검색', 'Search armor')}</span><input class="input" id="armor-q" type="search" placeholder="${L('이름·코드·패시브 검색 — 초성도 됩니다 (예: ㅈㅅ, B-01)', 'Search by name, code or passive (e.g. Tactical, B-01)')}" autocomplete="off"></label></div>
        <div id="armor-filters" class="arsenal-tools" style="margin:0"></div>
      </div>
      <div id="armor-results"></div>`);
    $('#armor-q', panel).addEventListener('input', event => { state.q = event.target.value; state.focus = ''; onChange(); });
  }
  const input = $('#armor-q', panel);
  if (input.value !== (state.q || '')) input.value = state.q || '';
  const q = (state.q || '').trim();
  const shown = armors.filter(armor => !state.weight || armor.weight === state.weight);
  const groups = armorPassives.map(passive => [passive, shown.filter(armor => armor.passive === passive.id)]).filter(([, list]) => list.length);
  // Several passives can be picked; one with no set in the chosen weight is let go.
  const picked = (state.passive || '').split(',').filter(id => groups.some(([passive]) => passive.id === id));
  state.passive = picked.join(',');
  const found = q ? search(armors, q, searchFields) : null;
  const visible = found ? armorPassives.map(passive => [passive, found.filter(armor => armor.passive === passive.id)]).filter(([, list]) => list.length)
    : picked.length ? groups.filter(([passive]) => picked.includes(passive.id)) : groups;
  // Weight buttons count within the picked passives (as the passive chips count within the weight);
  // one with nothing to show is dimmed, and picking it lets the passives it lacks go (above).
  const withPassive = armor => !picked.length || picked.includes(armor.passive);
  const countOf = id => armors.filter(armor => (!id || armor.weight === id) && withPassive(armor)).length;
  const setCount = visible.reduce((sum, [, list]) => sum + list.length, 0);
  render($('#armor-filters', panel), html`<div class="segmented" role="group" aria-label="${L('무게', 'Weight')}">
        <button type="button" data-weight="" aria-pressed="${!q && !state.weight}">${L('전체', 'All')} <span class="count">${countOf('')}</span></button>
        ${armorWeights.map(weight => html`<button type="button" class="${countOf(weight.id) ? '' : 'is-empty'}" data-weight="${weight.id}" aria-pressed="${!q && state.weight === weight.id}"><span class="dot"></span>${weight.name} <span class="count">${countOf(weight.id)}</span></button>`)}
      </div>
      ${q ? '' : html`<div class="chips armor-passive-filter" role="group" aria-label="${L('패시브', 'Passive')}"><button class="chip" type="button" data-passive="" aria-pressed="${!picked.length}">${L('전체', 'All')} <span class="count">${shown.length}</span></button>${groups.map(([passive, list]) => html`<button class="chip" type="button" data-passive="${passive.id}" aria-pressed="${picked.includes(passive.id)}">${picture(passive.icon, 'chip-passive-icon')}${passive.name} <span class="count">${list.length}</span></button>`)}</div>`}`);
  render($('#armor-results', panel), html`<div class="arsenal-meta"><span role="status">${q ? L(html`방어구 <b>${setCount}</b>종 표시 · 모든 방어구에서 검색`, html`Showing <b>${setCount}</b> armor sets · searching all armor`) : L(html`패시브 <b>${visible.length}</b>종 · 방어구 <b>${setCount}</b>종`, html`<b>${visible.length}</b> passives · <b>${setCount}</b> armor sets`)}</span><span>${L(`자료 확인 ${armorCheckedAt}`, `Checked ${armorCheckedAt}`)}</span></div>
    ${visible.length ? html`<div class="armor-passives">${visible.map(([passive, list]) => passiveSection(passive, list))}</div>` : html`<div class="empty"><h3>${L('맞는 방어구가 없습니다', 'No matching armor')}</h3><p>${L('검색어를 줄이거나 바꿔 보세요.', 'Try a shorter or different search.')}</p></div>`}`);
  const marked = focus && $(`#armor-item-${focus}`, panel);
  if (marked) requestAnimationFrame(() => marked.scrollIntoView({ block: 'center' }));
  // Picking a weight or passive leaves the search, as picking a group does in the gear browser.
  const leaveSearch = () => { state.q = ''; input.value = ''; };
  for (const button of $$('button[data-weight]', panel)) button.addEventListener('click', () => { state.weight = button.dataset.weight; state.focus = ''; leaveSearch(); onChange(); });
  // A set opens its details in the side sheet (click, Enter or Space).
  if (onOpen) for (const item of $$('[data-armor-open]', panel)) {
    item.addEventListener('click', event => { if (!event.target.closest('a')) onOpen(item.dataset.armorOpen); });
    item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(item.dataset.armorOpen); } });
  }
  // Passive chips add or remove that passive from the filter; All shows every passive.
  for (const button of $$('button[data-passive]', panel)) button.addEventListener('click', () => {
    const id = button.dataset.passive;
    state.passive = id ? (picked.includes(id) ? picked.filter(item => item !== id) : [...picked, id]).join(',') : '';
    state.focus = ''; onChange();
  });
}

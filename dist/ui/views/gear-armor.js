// Armor tab of the gear view: body armor grouped by passive.
//   #/gear?tab=armor&w=<light|medium|heavy>&a=<armor>   (a: scroll to and mark one set)
// Loaded on demand by gear.js and by the warbond item pane (armorDetail).
import { armors, armorPassives, armorWeights, armorCheckedAt } from '../../data/armor.js';
import { armorImages } from '../../data/armor-images.js';
import { warbonds } from '../../data/warbonds.js';
import { num } from '../../core/explain.js';
import { html, render, $, $$, badge, external } from '../dom.js';
import { L, lang } from '../../core/i18n.js';

export const WEIGHT_IDS = armorWeights.map(weight => weight.id);
const weightName = id => armorWeights.find(weight => weight.id === id)?.name ?? id;
const warbondById = new Map(warbonds.map(warbond => [warbond.id, warbond]));
const unconfirmed = () => html`<span class="dim">${L('미확인', 'Unconfirmed')}</span>`;

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
  return html`<li class="armor-item" id="armor-item-${armor.id}" data-weight="${armor.weight}" ${armor.id === focus ? 'data-focus' : ''}>
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
    <ul class="armor-effects">${passive.effects.map(effect => html`<li>${effect.name}</li>`)}</ul>
    <ul class="armor-list">${list.map(armorCard)}</ul>
  </section>`;
}

/** One armor set in the warbond item pane, in the same shape as the weapon and stratagem details. */
export function armorDetail(armor, { header = null, titleId = 'sheet-title' } = {}) {
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
    ${passive ? html`<section class="block"><h3>${L('패시브', 'Passive')} · ${passive.name}</h3><ul class="armor-effects">${passive.effects.map(effect => html`<li>${effect.name}</li>`)}</ul></section>` : ''}
    <div class="links"><a class="button primary" href="#/gear?tab=armor&a=${armor.id}">${L('같은 패시브 방어구 보기', 'Armor with the same passive')}</a></div>
    <div class="sources">
      <span>${L('자료 확인', 'Checked')} ${armorCheckedAt}</span>
      ${external(armor.wiki, L('위키 항목', 'Wiki page'))}
      ${armorImages[armor.image] ? external(`https://helldivers.wiki.gg/wiki/File:${encodeURIComponent(armor.image.replaceAll(' ', '_'))}`, L('이미지 원본', 'Image source')) : ''}
    </div>
  </div>`;
}

/** Renders the armor tab into panel. state.weight filters by weight ('' = all); state.focus marks one set. */
export function renderArmor(panel, { state, onChange }) {
  focus = state.focus || '';
  const shown = armors.filter(armor => !state.weight || armor.weight === state.weight);
  const groups = armorPassives.map(passive => [passive, shown.filter(armor => armor.passive === passive.id)]).filter(([, list]) => list.length);
  const countOf = id => armors.filter(armor => armor.weight === id).length;
  render(panel, html`<div class="arsenal-tools armor-tools">
      <div class="segmented" role="group" aria-label="${L('무게', 'Weight')}">
        <button type="button" data-weight="" aria-pressed="${!state.weight}">${L('전체', 'All')} <span class="count">${armors.length}</span></button>
        ${armorWeights.map(weight => html`<button type="button" data-weight="${weight.id}" aria-pressed="${state.weight === weight.id}">${weight.name} <span class="count">${countOf(weight.id)}</span></button>`)}
      </div>
      <nav class="chips armor-jump" aria-label="${L('패시브로 이동', 'Jump to a passive')}">${groups.map(([passive, list]) => html`<button class="chip" type="button" data-jump="${passive.id}">${passive.name} <span class="count">${list.length}</span></button>`)}</nav>
    </div>
    <div class="arsenal-meta"><span role="status">${L(html`패시브 <b>${groups.length}</b>종 · 방어구 <b>${shown.length}</b>종`, html`<b>${groups.length}</b> passives · <b>${shown.length}</b> armor sets`)}</span><span>${L(`자료 확인 ${armorCheckedAt}`, `Checked ${armorCheckedAt}`)}</span></div>
    <div class="armor-passives">${groups.map(([passive, list]) => passiveSection(passive, list))}</div>`);
  const marked = focus && $(`#armor-item-${focus}`, panel);
  if (marked) requestAnimationFrame(() => marked.scrollIntoView({ block: 'center' }));
  for (const button of $$('[data-weight]', panel)) button.addEventListener('click', () => { state.weight = button.dataset.weight; state.focus = ''; onChange(); });
  for (const button of $$('[data-jump]', panel)) button.addEventListener('click', () => {
    const target = $(`#armor-${button.dataset.jump}`, panel);
    target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    target?.querySelector('h3')?.focus?.({ preventScroll: true });
  });
}

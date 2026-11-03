// Armor tab of the gear view: body armor grouped by passive.
//   #/gear?tab=armor&w=<light|medium|heavy>
// Loaded on demand by gear.js; the images module is fetched with it.
import { armors, armorPassives, armorWeights, armorCheckedAt } from '../../data/armor.js';
import { armorImages } from '../../data/armor-images.js';
import { warbonds } from '../../data/warbonds.js';
import { num } from '../../core/explain.js';
import { html, render, $, $$, badge } from '../dom.js';
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
    return html`<a href="#/warbonds/${s.warbondId}">${warbond.name}</a>${s.page ? L(` · ${s.page}페이지`, ` · page ${s.page}`) : ''}${price ? ` · ${price}` : ''}`;
  }
  return html`${s.name}${price ? ` · ${price}` : ''}`;
}

const stat = (label, value) => html`<div><dt>${label}</dt><dd>${value != null ? num(value) : unconfirmed()}</dd></div>`;

function armorCard(armor) {
  return html`<li class="armor-item" data-weight="${armor.weight}">
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

/** Renders the armor tab into panel. state.weight filters by weight ('' = all). */
export function renderArmor(panel, { state, onChange }) {
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
  for (const button of $$('[data-weight]', panel)) button.addEventListener('click', () => { state.weight = button.dataset.weight; onChange(); });
  for (const button of $$('[data-jump]', panel)) button.addEventListener('click', () => {
    const target = $(`#armor-${button.dataset.jump}`, panel);
    target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    target?.querySelector('h3')?.focus?.({ preventScroll: true });
  });
}

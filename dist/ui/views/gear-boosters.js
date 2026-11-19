// Boosters tab of the gear view.
//   #/gear?tab=boosters&b=<booster>   (b: scroll to and mark one booster)
// Loaded on demand by gear.js.
import { boosters, boostersCheckedAt } from '../../data/boosters.js';
import { warbonds } from '../../data/warbonds.js';
import { html, render, $, external } from '../dom.js';
import { L, lang } from '../../core/i18n.js';

const warbondById = new Map(warbonds.map(warbond => [warbond.id, warbond]));

function boosterCard(booster, focus) {
  const warbond = warbondById.get(booster.warbondId);
  const description = lang === 'en' ? booster.descriptionEn : booster.description;
  const detail = lang === 'en' ? booster.detailEn : booster.detail;
  return html`<li class="booster-item" id="booster-${booster.id}" ${booster.id === focus ? 'data-focus' : ''}>
    <span class="booster-icon"><img src="${booster.icon.src}" alt="" width="56" height="56" loading="lazy" decoding="async"></span>
    <div class="booster-body">
      <h3>${booster.name}</h3>
      ${lang === 'en' || booster.name === booster.en ? '' : html`<p class="en">${booster.en}</p>`}
      ${description ? html`<p class="booster-desc">${description}</p>` : ''}
      ${detail ? html`<p class="booster-detail">${detail}</p>` : ''}
      <p class="armor-source"><a href="#/warbonds/${booster.warbondId}">${warbond.name}</a>${booster.page ? L(` · ${booster.page}페이지`, ` · page ${booster.page}`) : ''}${booster.cost ? L(` · ${booster.cost} 메달`, ` · ${booster.cost} medals`) : ''}
        ${external(booster.wiki, L('위키', 'Wiki'))}</p>
    </div>
  </li>`;
}

/** Renders the boosters tab into panel. state.focus marks one booster. */
export function renderBoosters(panel, { state }) {
  const focus = boosters.some(item => item.id === state.focus) ? state.focus : '';
  render(panel, html`<div class="arsenal-meta"><span role="status">${L(html`부스터 <b>${boosters.length}</b>종 · 분대 전원에게 적용`, html`<b>${boosters.length}</b> boosters · each applies to the whole squad`)}</span><span>${L(`자료 확인 ${boostersCheckedAt}`, `Checked ${boostersCheckedAt}`)}</span></div>
    <ul class="booster-list">${boosters.map(booster => boosterCard(booster, focus))}</ul>
    <p class="faint" style="font-size:12.5px;margin-top:12px">${L('아이콘은 Helldivers Wiki 기여자들의 원본(CC BY-NC-SA 4.0)입니다.', 'Icons are the originals by Helldivers Wiki contributors (CC BY-NC-SA 4.0).')}</p>`);
  const marked = focus && $(`#booster-${focus}`, panel);
  if (marked) requestAnimationFrame(() => marked.scrollIntoView({ block: 'center' }));
}

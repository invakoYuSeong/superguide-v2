// Ship module tab of the gear view: the six ship sections and their five upgrades each.
//   #/gear?tab=modules&u=<module>   (u: scroll to and mark one upgrade)
// Loaded on demand by gear.js.
import { shipModuleSections, shipModuleTotal, shipModuleUpgradesSource } from '../../data/ship-module-upgrades.js';
import { html, render, $, external } from '../dom.js';
import { L, lang, locale } from '../../core/i18n.js';

const count = value => value.toLocaleString(locale());
// The game's names for the currencies (Common/Rare/Super Sample, Requisition Slips).
const CURRENCIES = [['common', L('일반 샘플', 'Common Samples')], ['rare', L('희귀 샘플', 'Rare Samples')], ['super', L('슈퍼 샘플', 'Super Samples')], ['requisition', L('요청 신청서', 'Requisition Slips')]];
const costLine = cost => CURRENCIES.filter(([key]) => cost[key]).map(([key, name]) => html`<span data-currency="${key}">${name} <b>${count(cost[key])}</b></span>`);
const sectionCost = section => Object.fromEntries(CURRENCIES.map(([key]) => [key, section.modules.reduce((sum, module) => sum + module.cost[key], 0)]));

function moduleItem(module, focus) {
  return html`<li class="module-item" id="module-${module.id}" ${module.id === focus ? 'data-focus' : ''}>
    <span class="module-tier" aria-label="${L(`${module.tier}단계`, `Tier ${module.tier}`)}">${module.tier}</span>
    <div class="info-body">
      <h4>${L(module.name, module.en)}</h4>${lang === 'en' || module.name === module.en ? '' : html`<p class="en">${module.en}</p>`}
      <p class="info-desc">${lang === 'en' ? module.effectEn : module.effect}</p>
      <p class="module-cost">${costLine(module.cost)}</p>
      ${module.stratagemModule ? html`<p class="module-applied"><a href="#/arsenal">${L('스트라타젬 도감의 재사용 시간에 반영', 'Applied to cooldowns in the stratagem catalogue')}</a></p>` : ''}
    </div>
  </li>`;
}

function sectionBlock(section, focus) {
  return html`<section class="armor-passive module-section" id="ship-${section.id}" aria-labelledby="ship-${section.id}-title">
    <header class="armor-passive-head">
      <span class="armor-passive-icon"><img src="${section.icon.src}" alt="" width="36" height="36" loading="lazy" decoding="async"></span>
      <div><h3 id="ship-${section.id}-title">${L(section.name, section.en)}</h3>${lang === 'en' || section.name === section.en ? '' : html`<p class="en">${section.en}</p>`}</div>
    </header>
    <p class="module-cost module-section-cost">${L('부서 전체', 'Whole section')}: ${costLine(sectionCost(section))}</p>
    <ol class="module-list">${section.modules.map(module => moduleItem(module, focus))}</ol>
  </section>`;
}

/** Renders the ship module tab into panel. state.focus marks one upgrade. */
export function renderModules(panel, { state }) {
  const modules = shipModuleSections.flatMap(section => section.modules);
  const focus = modules.some(module => module.id === state.focus) ? state.focus : '';
  render(panel, html`<div class="arsenal-meta"><span role="status">${L(html`부서 <b>${shipModuleSections.length}</b>곳, 모듈 <b>${modules.length}</b>개`, html`<b>${shipModuleSections.length}</b> sections, <b>${modules.length}</b> upgrades`)}</span><span>${external(shipModuleUpgradesSource.page, L(`위키 Ship Modules 문서 (판 ${shipModuleUpgradesSource.revision})`, `Wiki Ship Modules page (revision ${shipModuleUpgradesSource.revision})`))}</span></div>
    <p class="lede-note module-total">${L('모든 모듈을 올리는 비용', 'Cost of every upgrade')}: ${costLine(shipModuleTotal)}</p>
    <div class="armor-passives">${shipModuleSections.map(section => sectionBlock(section, focus))}</div>
    <p class="faint" style="font-size:12.5px;margin-top:12px">${L('모듈 이름과 효과 문장은 게임 안 한국어, 비용은 Helldivers Wiki 표입니다. 아이콘은 Helldivers Wiki 기여자들의 원본(CC BY-NC-SA 4.0)입니다.', 'Names and effect text are the game\'s own; costs come from the Helldivers Wiki table. Icons are the originals by Helldivers Wiki contributors (CC BY-NC-SA 4.0).')}</p>`);
  const marked = focus && $(`#module-${focus}`, panel);
  if (marked) requestAnimationFrame(() => marked.scrollIntoView({ block: 'center' }));
}

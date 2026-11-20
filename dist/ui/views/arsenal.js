// Stratagem catalogue: filter, sort, detail sheet and side-by-side comparison.
import { stratagems, stratagemById, categories, categoryOf, apBands, apBandOf, withVariant, variantOf, CHECKED_AT } from '../../core/catalog.js';
import { search, stratagemFields } from '../../core/search.js';
import { num, strongest } from '../../core/explain.js';
import { shieldRecovery } from '../../core/defense.js';
import { wikiIcons } from '../../data/wiki-icons.js';
import { html, raw, render, $, $$, icon, keycaps, badge, external } from '../dom.js';
import { blastFigure } from '../blast.js';
import { warbondChip } from '../warbond-chip.js';
import { L, T, lang } from '../../core/i18n.js';
import { timingOf, modulesOn, setModulesOn } from '../../core/modules.js';
import { shipModulesSource } from '../../data/ship-modules.js';
import { stratagemEffects } from '../../data/planet-stratagem-effects.js';
import { stratagemStats } from '../../data/stratagem-stats.js';

const SORTS = [
  { id: '', name: L('기본 순서', 'Default order') },
  { id: 'direct', name: L('직격 피해 순', 'Direct damage'), value: item => item.direct },
  { id: 'splash', name: L('폭발 피해 순', 'Blast damage'), value: item => item.splash },
  { id: 'ap', name: L('관통력 순', 'Penetration'), value: item => item.ap },
  { id: 'reach', name: L('사거리·반경 순', 'Range / radius'), value: item => item.range ?? item.radius },
];
const MAX_COMPARE = 3;

let root, ctx;
// In-game permit (menu colour) from each stratagem's wiki page (stratagem-stats.js).
const PERMITS = [
  { id: 'offensive', name: L('공격', 'Offensive'), color: '#e0533f' }, { id: 'defensive', name: L('방어', 'Defensive'), color: '#5fae4f' },
  { id: 'supply', name: L('지원', 'Supply'), color: '#3f8fd8' }, { id: 'mission', name: L('임무', 'Mission'), color: '#e6b627' },
];
const permitOf = item => stratagemStats[item.id]?.permit;
// AP bands offered as filters ("unverified AP" is not one).
const AP_FILTERS = apBands.filter(band => band.id !== 'unknown');
const state = { c: '', ap: '', p: '', q: '', sort: '', mod: true, compare: new Set(), detail: null, variant: '', pushedDetail: false };

const subtitle = item => lang === 'en' ? (item.code && !item.en.startsWith(item.code) ? item.code : '') : item.en;
export const iconOf = item => html`<img class="strat-icon" src="${wikiIcons[item.id]?.src}" alt="" width="44" height="44" loading="lazy" decoding="async">`;

// --- Stats ---------------------------------------------------------------------
function stats(item) {
  const dps = item.damageKind === 'dps';
  const none = item.utility;
  const value = (number, text, zero) => text ? { text } : none ? { text: '—', dim: true } : number == null ? { text: L('미확인', 'Unverified'), dim: true } : number === 0 && zero ? { text: zero, dim: true } : { text: num(number), unit: dps && zero == null ? '/s' : '' };
  const reach = item.range != null ? { text: num(item.range), unit: 'm', label: L('사거리', 'Range'), caption: item.rangeType }
    : item.radius != null ? { text: num(item.radius), unit: 'm', label: L('반경', 'Radius'), caption: item.innerRadius != null ? L(`중심 ${num(item.innerRadius)}m · 외곽 ${num(item.radius)}m`, `Inner ${num(item.innerRadius)}m · outer ${num(item.radius)}m`) : L('폭발 외곽 반경', 'Outer blast radius') }
    : { text: item.rangeLabel || L('미확인', 'Unverified'), dim: !item.rangeLabel || item.rangeLabel === '미확인', label: L('범위', 'Area'), caption: item.rangeNoteShort };
  return [
    { label: dps ? L('지속 피해', 'Damage/s') : L('직격', 'Direct'), caption: item.directNoteShort || (none ? L('지원 장비', 'Utility gear') : dps ? L('초당', 'Per second') : item.unit), ...value(item.direct, item.directText) },
    { label: L('폭발', 'Blast'), caption: item.splashNoteShort || (item.splash > 0 ? L('중심부 최대', 'Max at center') : ''), ...value(item.splash, item.splashText, L('없음', 'None')) },
    { label: L('관통', 'Penetration'), caption: item.apNoteShort || (item.ap != null ? apBandOf(item).name + (item.splashAp != null && item.splashAp !== item.ap ? L(` · 폭발 AP ${item.splashAp}`, ` · blast AP ${item.splashAp}`) : '') : ''),
      ...(item.ap != null ? { text: `AP ${item.ap}${item.splashAp != null && item.splashAp !== item.ap ? `/${item.splashAp}` : ''}` } : { text: none ? '—' : L('미확인', 'Unverified'), dim: true }) },
    { caption: reach.caption, ...reach },
  ];
}

// Card cells are narrow: an unverified value shows as "?" there in English.
const cellText = stat => lang === 'en' && stat.dim && stat.text === 'Unverified' ? '?' : stat.text;
const statRow = item => html`<dl class="stat-row">${stats(item).map(stat => html`<div><dt>${stat.label}</dt><dd class="${stat.dim ? 'dim' : ''}" title="${stat.dim ? stat.text : ''}">${cellText(stat)}${stat.unit ? html`<small>${stat.unit}</small>` : ''}</dd></div>`)}</dl>`;

// One-line numbers for a mode, used on cards and in the comparison table.
function variantBrief(item, variant) {
  const v = withVariant(item, variant);
  const parts = [`${L('직격', 'Direct')} ${T(v.directText) || num(v.direct)}`];
  if (v.splashText) parts.push(T(v.splashText));
  else if (v.splash > 0) parts.push(`${L('폭발', 'Blast')} ${num(v.splash)}`);
  parts.push(`AP ${v.ap}${v.splashAp != null && v.splashAp !== v.ap ? `/${v.splashAp}` : ''}`);
  if (v.radius != null) parts.push(`${L('외곽', 'outer')} ${num(v.radius)}m`);
  return parts.join(' · ');
}

// Cards show the other modes under the main numbers; long shell lists collapse to names.
function cardModes(item) {
  const variants = item.variants || [];
  if (variants.length < 2) return '';
  const rest = variants.slice(1);
  if (rest.length > 2) return html`<span class="card-modes" data-kind="${item.variantKind || 'modes'}"><span><b>${L(`${variants.length}종`, `${variants.length} modes`)}</b> ${variants.map(v => T(v.tab || v.name)).join(' · ')}</span></span>`;
  return html`<span class="card-modes" data-kind="${item.variantKind || 'modes'}">${rest.map(v => html`<span><b>${v.tab || v.name}</b> ${variantBrief(item, v)}</span>`)}</span>`;
}

// Cooldown in seconds at the right end of the stratagem code row, following the ship module choice.
// Cooldowns show whole seconds (user decision 2026-11-19); call-in and rearm keep their decimals.
const seconds = value => `${num(Math.round(value))}${L('초', 's')}`;
function cardCooldown(item) {
  const cooldown = timingOf(item)?.cooldown;
  if (cooldown == null) return '';
  const label = modulesOn() ? L('재사용 대기 · 함선 모듈 적용', 'Cooldown with ship modules') : L('재사용 대기 · 함선 모듈 미적용', 'Cooldown without ship modules');
  return html`<span class="card-cooldown" title="${label}" aria-label="${label} ${seconds(cooldown)}">${seconds(cooldown)}</span>`;
}

function card(item) {
  const selected = state.compare.has(item.id);
  return html`<article class="card ${selected ? 'selected' : ''}" style="--cat:${categoryOf(item.category).color}" data-id="${item.id}">
    <button class="card-open" type="button" data-open="${item.id}" aria-label="${item.name} ${L('자세히 보기', 'details')}">
      <div class="card-head">${iconOf(item)}<div><h3>${item.name}</h3><p class="en">${subtitle(item)}</p></div></div>
      <div class="card-keys">${item.input ? keycaps(item.input) : html`<span>${categoryOf(item.category).name}</span>`}${cardCooldown(item)}</div>
      <p class="summary">${item.summary}</p>
      ${statRow(item)}
      ${cardModes(item)}
    </button>
    <button class="compare-toggle" type="button" data-compare="${item.id}" aria-pressed="${selected}" aria-label="${item.name} ${selected ? L('비교에 담김', 'added to compare') : L('비교에 담기', 'add to compare')}" title="${L('비교에 담기', 'Add to compare')}">${icon(selected ? 'check' : 'plus', 16)}</button>
  </article>`;
}

// --- Filtering -------------------------------------------------------------------
function visibleItems() {
  const band = AP_FILTERS.find(item => item.id === state.ap);
  let items = stratagems.filter(item => (!state.c || item.category === state.c) && (!band || band.test(item)) && (!state.p || permitOf(item) === state.p));
  items = search(items, state.q, stratagemFields);
  const sort = SORTS.find(item => item.id === state.sort);
  if (sort?.value) items = [...items].sort((a, b) => (sort.value(b) ?? -1) - (sort.value(a) ?? -1));
  return items;
}

function syncUrl() {
  ctx.replace({ view: 'arsenal', id: state.detail, query: { c: state.c, ap: state.ap, p: state.p, q: state.q, sort: state.sort, mod: state.mod ? '' : 'off', m: state.detail ? state.variant : '' } });
}

function renderList() {
  const items = visibleItems();
  // Category and type chips count within each other's choice; a chip with nothing to show is dimmed
  // (picking it lets the other choice go).
  const inCategory = (item, id = state.c) => !id || item.category === id;
  const inPermit = (item, id = state.p) => !id || permitOf(item) === id;
  const total = stratagems.filter(item => inCategory(item) && inPermit(item)).length;
  for (const chip of $$('[data-cat]', root)) {
    const n = stratagems.filter(item => inCategory(item, chip.dataset.cat) && inPermit(item)).length;
    chip.querySelector('.count').textContent = n;
    chip.classList.toggle('is-empty', !n);
  }
  for (const chip of $$('[data-permit]', root)) {
    const n = stratagems.filter(item => inPermit(item, chip.dataset.permit) && inCategory(item)).length;
    if (chip.dataset.permit) chip.querySelector('.count').textContent = n;
    chip.classList.toggle('is-empty', !n);
  }
  $('#arsenal-count').innerHTML = html`<span>${L(html`<b>${items.length}</b>개 표시 · 전체 ${total}개`, html`Showing <b>${items.length}</b> of ${total}`)}</span>`.toString();
  render($('#arsenal-grid'), items.length ? items.map(card) : html`<div class="empty" style="grid-column:1/-1"><h3>${L('맞는 스트라타젬이 없습니다', 'No matching stratagems')}</h3><p>${L('검색어를 줄이거나 필터를 해제해 보세요.', 'Try a shorter search or clear the filters.')}</p><button class="button" type="button" data-reset>${L('필터 초기화', 'Reset filters')}</button></div>`);
  for (const chip of $$('[data-cat]', root)) chip.setAttribute('aria-pressed', String(chip.dataset.cat === state.c));
  for (const chip of $$('[data-ap]', root)) chip.setAttribute('aria-pressed', String(chip.dataset.ap === state.ap));
  for (const chip of $$('[data-permit]', root)) chip.setAttribute('aria-pressed', String(chip.dataset.permit === state.p));
  for (const chip of $$('[data-mod]', root)) chip.setAttribute('aria-pressed', String((chip.dataset.mod === 'on') === state.mod));
  $('[data-reset-inline]', root).hidden = !state.c && !state.ap && !state.p && !state.q && !state.sort;
  renderTray();
}

function renderTray() {
  const tray = $('#arsenal-tray');
  const items = [...state.compare].map(id => stratagemById.get(id));
  tray.hidden = !items.length;
  if (!items.length) return;
  render(tray, html`<span class="names">${icon('compare', 18)} ${items.map(item => T(item.name)).join(' · ')}</span>
    <span class="faint num">${items.length}/${MAX_COMPARE}</span>
    <button class="button small" type="button" data-compare-clear>${L('비우기', 'Clear')}</button>
    <button class="button small primary" type="button" data-compare-open ${items.length < 2 ? html`disabled title="${L('2개 이상 담으면 비교할 수 있습니다', 'Add 2 or more to compare')}"` : ''}>${L('비교하기', 'Compare')}</button>`);
}

// --- Detail sheet ------------------------------------------------------------------
function defenseBlock(item) {
  const d = item.defense;
  if (!d) return '';
  const rows = [];
  const add = (label, value, unit = '', caption = '') => rows.push({ label, value, unit, caption });
  const s = L('초', 's');
  if (d.type === 'energy') {
    const shield = d.shield || {};
    add(L('보호막 용량', 'Shield capacity'), num(shield.capacity), '', L('장치 체력과 별개', 'Separate from device health'));
    add(L('재생 속도', 'Regeneration'), num(shield.regeneration), L('/초', '/s'));
    add(L('피격 후 재생 대기', 'Regen delay after a hit'), shield.hitDelay <= 0.01 ? L('즉시', 'Instant') : num(shield.hitDelay), shield.hitDelay <= 0.01 ? '' : s, L('일부만 깎였을 때', 'When only partly depleted'));
    if (shield.regeneratesAfterDepletion === false) add(L('완전히 깨진 뒤', 'Once fully broken'), L('재생 안 됨', 'No regen'), '', L('장비 수명 안에 복구되지 않음', 'Does not recover within its lifetime'));
    else {
      add(L('완전히 깨진 뒤 대기', 'Delay once fully broken'), num(shield.depletedDelay), s);
      const full = shieldRecovery(d, 0);
      add(L('0 → 가득 회복', '0 → full recovery'), full ? num(full.total) : L('미확인', 'Unverified'), full ? s : '', full ? L(`대기 ${num(full.delay)}초 + 재생 ${num(full.filling)}초`, `${num(full.delay)}s delay + ${num(full.filling)}s regen`) : '');
    }
    add(L(`${d.bodyLabel || '장치 본체'} 체력`, `${T(d.bodyLabel) || 'Device body'} health`), d.body?.hp != null ? num(d.body.hp) : L('미확인', 'Unverified'), '', d.body?.armor != null ? L(`장갑 ${d.body.armor}`, `Armor ${d.body.armor}`) : '');
    if (d.lifetime != null) add(L('지속시간', 'Duration'), d.lifetime === 'unlimited' ? L('제한 없음', 'Unlimited') : num(d.lifetime), d.lifetime === 'unlimited' ? '' : s);
    if (shield.radius != null) add(L('보호 반경', 'Shield radius'), num(shield.radius), 'm', shield.coverage || '');
    else if (shield.coverage) add(L('보호 방향', 'Coverage'), shield.coverage);
  } else {
    add(L('본체 체력', 'Body health'), num(d.body?.hp), '', L(`장갑 ${d.body?.armor ?? '?'} · 내구도 ${d.body?.durability ?? '?'}%`, `Armor ${d.body?.armor ?? '?'} · durability ${d.body?.durability ?? '?'}%`));
    if (d.replacement === 'new-call') add(L('파괴되면', 'When destroyed'), L('재호출', 'Call in again'), '', L('수리되지 않음', 'Cannot be repaired'));
  }
  return html`<section class="block"><h3>${L('방어 성능', 'Defense')}</h3>
    <dl class="detail-grid">${rows.map(row => html`<div><dt>${row.label}</dt><dd class="${/\d/.test(row.value) ? '' : 'dim'}">${row.value}${row.unit ? html`<small>${row.unit}</small>` : ''}</dd>${row.caption ? html`<div class="caption">${row.caption}</div>` : ''}</div>`)}</dl>
    ${d.notes?.length ? html`<ul class="notes" style="margin-top:10px">${d.notes.map(note => html`<li>${note}</li>`)}</ul>` : ''}
  </section>`;
}

// Measured spread of sub-munitions: big numbers first, then the conditions behind them.
function spreadBlock(item) {
  const s = item.spread;
  if (!s) return '';
  return html`<section class="block"><h3>${s.title}</h3>
    <dl class="detail-grid">${s.rows.map(row => html`<div><dt>${row.label}</dt><dd>${row.value}<small>${L(row.unit, row.unit === '개' ? '' : row.unit)}</small></dd><div class="caption">${row.caption}</div></div>`)}</dl>
    <ul class="notes" style="margin-top:10px">${s.notes.map(note => html`<li>${note}</li>`)}</ul>
    <p class="faint" style="font-size:12.5px;margin-top:8px">${s.source}</p>
  </section>`;
}

// Durable damage, magazine and spare ammo from the datamine (see data-support.js).
function ammoCells(item) {
  const cell = (label, text, unit, caption) => html`<div><dt>${label}</dt><dd>${text}${unit ? html`<small>${unit}</small>` : ''}</dd>${caption ? html`<div class="caption">${caption}</div>` : ''}</div>`;
  const spare = L('최대 보유', 'Maximum carried');
  return [
    item.durable != null ? cell(L('내구 피해', 'Durable damage'), num(item.durable), item.damageKind === 'dps' ? '/s' : '', L('단단한 부위에 들어가는 피해', 'Damage against durable parts')) : '',
    item.magazine != null ? cell(item.fuel ? L('연료', 'Fuel') : L('탄창', 'Magazine'), num(item.magazine), item.fuel ? '' : L('발', ''),
      item.magazineWiki != null ? L(`게임 데이터 기준 · 위키 표기 ${num(item.magazineWiki)}`, `Game data · wiki says ${num(item.magazineWiki)}`) : '') : '',
    item.spareMags != null ? cell(item.fuel ? L('예비 연료통', 'Spare tanks') : L('예비 탄창', 'Spare magazines'), num(item.spareMags), L('개', ''), spare) : '',
    item.spareRounds != null ? cell(L('예비탄', 'Spare rounds'), num(item.spareRounds), L('발', ''), spare) : '',
  ];
}

// Fire rate from the wiki infobox, or the rates the player picks between.
function rateCell(item) {
  if (item.rpmModes?.length > 1) return html`<div><dt>${L('연사 모드', 'Fire rate modes')}</dt><dd>${item.rpmModes.map(num).join(' / ')}</dd><div class="caption">${L('분당 발수 · 골라서 사용', 'Rounds per minute · pick one')}</div></div>`;
  if (item.rpm == null) return '';
  return html`<div><dt>${L('연사', 'Fire rate')}</dt><dd>${num(item.rpm)}</dd><div class="caption">${L('분당 발수', 'Rounds per minute')}</div></div>`;
}
// Modes picked on the weapon that change how it fires or detonates (Airburst cluster/flak,
// W.A.S.P. burst/artillery). Each mode lists its own facts; the damage stats stay below.
function firingModesBlock(item) {
  const modes = item.firingModes;
  if (!modes?.length) return '';
  const unit = value => value === '발' || value === '개' ? L(value, '') : value;
  return html`<div class="firing-modes" data-fire-modes>
    <div class="variant-tabs"><h3>${L('모드', 'Mode')}</h3><div class="segmented" role="group" aria-label="${L('모드 선택', 'Mode')}">${modes.map((m, i) => html`<button type="button" data-fire-mode="${m.id}" aria-pressed="${String(!i)}">${m.name}</button>`)}</div></div>
    ${modes.map((m, i) => html`<div class="variant-panel" data-fire-mode-panel="${m.id}" ${i ? raw('hidden') : ''}>
      <dl class="detail-grid">${m.rows.map(row => html`<div><dt>${row.label}</dt><dd class="${/\d/.test(row.value) ? '' : 'dim'}">${row.value}${row.unit ? html`<small>${unit(row.unit)}</small>` : ''}</dd>${row.caption ? html`<div class="caption">${row.caption}</div>` : ''}</div>`)}</dl>
      ${m.note ? html`<p class="variant-note">${m.note}</p>` : ''}
    </div>`)}
    ${item.firingModesNote ? html`<p class="variant-note">${item.firingModesNote}</p>` : ''}
  </div>`;
}
// The buttons switch only their own block, in the arsenal sheet or an embedded warbond pane.
globalThis.document?.addEventListener('click', event => {
  const pick = event.target.closest?.('[data-fire-mode]');
  const group = pick?.closest('[data-fire-modes]');
  if (!group) return;
  for (const button of $$('[data-fire-mode]', group)) button.setAttribute('aria-pressed', String(button === pick));
  for (const panel of $$('[data-fire-mode-panel]', group)) panel.hidden = panel.dataset.fireModePanel !== pick.dataset.fireMode;
});

// Planet conditions, modifiers and events that change this stratagem, applied to the value shown above.
const EFFECT_KIND = { condition: L('환경 조건', 'Environment'), gloom: L('글룸', 'Gloom'), modifier: L('작전 제한 조건', 'Operation modifier'), event: L('이벤트 효과', 'Event effect') };
function planetLines(t) {
  const s = L('초', 's');
  const pct = factor => Math.round((factor - 1) * 100);
  const lines = stratagemEffects.filter(effect => !effect.types || effect.types.includes(t.type)).flatMap(effect => {
    const label = `${T(effect.name)} (${EFFECT_KIND[effect.kind]})`;
    if (effect.disable) return [L(`${label}: 스트라타젬이 간헐적으로 막힘`, `${label}: stratagems are disabled at times`)];
    if (effect.cooldownUp && t.cooldown != null) return [L(`${label}: 재사용 대기 증가(수치 미확인)`, `${label}: longer cooldown (amount unverified)`)];
    const rows = [];
    if (effect.cooldown && t.cooldown != null) rows.push(L(`${label}: 재사용 대기 +${pct(effect.cooldown)}% → ${num(Math.round(t.cooldown * effect.cooldown))}${s}`, `${label}: cooldown +${pct(effect.cooldown)}% → ${num(Math.round(t.cooldown * effect.cooldown))}${s}`));
    if (effect.callIn && t.callIn != null) rows.push(L(`${label}: 호출 시간 +${pct(effect.callIn)}% → ${num(Math.round(t.callIn * effect.callIn * 100) / 100)}${s}`, `${label}: call-in +${pct(effect.callIn)}% → ${num(Math.round(t.callIn * effect.callIn * 100) / 100)}${s}`));
    if (effect.rearm && t.rearm != null) rows.push(L(`${label}: 재무장 +${pct(effect.rearm)}% → ${num(Math.round(t.rearm * effect.rearm * 100) / 100)}${s}`, `${label}: rearm +${pct(effect.rearm)}% → ${num(Math.round(t.rearm * effect.rearm * 100) / 100)}${s}`));
    return rows;
  });
  if (!lines.length) return '';
  // Folded by default (user decision 2026-11-19).
  return html`<details class="planet-effects"><summary>${L('행성 조건에 따른 변화', 'Changes under planet conditions')}</summary><ul class="notes">${lines.map(line => html`<li>${line}</li>`)}</ul>
    <p class="faint" style="font-size:12.5px">${L('위에 표시된 값에 비율을 곱한 값입니다.', 'The rate applied to the value shown above.')} <a href="#/planets?tab=modifiers">${L('작전 제한 조건 보기', 'See operation modifiers')}</a></p></details>`;
}

// Cooldown, call-in time, uses and Eagle rearm, with the ship modules that change them.
function timingBlock(item) {
  const t = timingOf(item);
  if (!t || (t.cooldown == null && t.rearm == null && t.callIn == null)) return '';
  const on = modulesOn();
  const s = L('초', 's');
  const caption = (value, base, unit = true) => !on ? L('함선 모듈 미적용', 'Without ship modules')
    : value !== base ? (unit ? L(`기본 ${num(base)}초`, `Base ${num(base)}s`) : L(`기본 ${num(base)}회`, `Base ${num(base)}`))
    : L('함선 모듈 영향 없음', 'No ship module changes it');
  const cell = (label, value, unit, text) => html`<div><dt>${label}</dt><dd>${value}${unit ? html`<small>${unit}</small>` : ''}</dd>${text ? html`<div class="caption">${text}</div>` : ''}</div>`;
  const pct = factor => Math.round((1 - factor) * 100);
  const effect = module => module.cooldown ? L(`재사용 -${pct(module.cooldown)}%`, `cooldown -${pct(module.cooldown)}%`)
    : module.rearm ? L(`재무장 -${pct(module.rearm)}%`, `rearm -${pct(module.rearm)}%`)
    : module.uses ? L(`사용 +${module.uses}회`, `+${module.uses} use`) : L('호출 시간 단축', 'faster call-in');
  return html`<section class="block"><h3>${L('재사용 대기와 호출', 'Cooldown and call-in')}</h3>
    <dl class="detail-grid">
      ${t.cooldown != null ? cell(L('재사용 대기', 'Cooldown'), num(Math.round(t.cooldown)), s, caption(t.cooldown, t.cooldownBase)) : ''}
      ${t.rearm != null ? cell(L('재무장 시간', 'Rearm time'), num(t.rearm), s, caption(t.rearm, t.rearmBase)) : ''}
      ${typeof t.uses === 'number' ? cell(t.rearm != null ? L('재무장당 사용', 'Uses per rearm') : L('사용 횟수', 'Uses'), num(t.uses), L('회', ''), caption(t.uses, t.usesBase, false)) : ''}
      ${t.callIn != null ? cell(L('호출 시간', 'Call-in time'), num(t.callIn), s, caption(t.callIn, t.callInBase)) : ''}
    </dl>
    ${planetLines(t)}
    <div class="sources">${external(item.source, L('위키 수치', 'Wiki stats'))}${external(shipModulesSource.page, L('함선 모듈', 'Ship Modules'))}</div>
    ${on && t.modules.length ? html`<p class="faint" style="font-size:12.5px;margin-top:8px">${L('함선 모듈(모두 최고 단계)', 'Ship modules (all fully upgraded)')}: ${t.modules.map(module => `${lang === 'en' ? module.en : module.name} (${effect(module)})`).join(' · ')}</p>` : ''}
  </section>`;
}

// Special effects: demolition, stagger and push force of each attack from the wiki attack
// datamine (stratagem-stats.js `forces`); demolition-data.js where the datamine has no record.
const FORCE_KIND = { direct: L('직격', 'Direct'), beam: L('광선', 'Beam'), arc: L('전격', 'Arc'), spray: L('분사', 'Spray'), blast: L('폭발', 'Blast'), fragment: L('파편', 'Fragment'), overcharge: L('과충전 폭발', 'Overcharge blast') };
export const FORCE_NOTE = L('저지력은 적의 동작을 끊는 힘(적마다 기준값이 다름), 넉백은 밀어내는 힘입니다. 철거력은 한 번의 명중이나 폭발이 시설의 필요 철거력 이상이어야 하며, 여러 번 맞혀도 합산되지 않습니다.',
  'Stagger force interrupts an enemy (each enemy has its own threshold); push force knocks it back. Demolition force must reach a structure\'s threshold in a single hit or blast; hits do not add up.');
const DIRECT_KINDS = ['direct', 'beam', 'arc', 'spray'];
function fallbackRows(profile, value) {
  const top = key => profile.modes.map(mode => mode[key]).filter(force => force != null)
    .reduce((best, force) => best == null || (typeof force === 'number' ? force : force.max) > (typeof best === 'number' ? best : best.max) ? force : best, null);
  const rows = [['direct', L('직격', 'Direct')], ['explosion', L('폭발', 'Blast')]].map(([key, label]) => [label, top(key)]).filter(([, force]) => force != null)
    .map(([label, force]) => ({ label, text: html`<span class="force-line"><b>${L('철거력', 'Demolition')}</b> ${value(force)}</span>` }));
  return rows.length ? rows : [{ label: L('철거력', 'Demolition'), text: html`<span class="force-line dim">${L('확인 중', 'Unverified')}</span>` }];
}
function specialBlock(item, profile) {
  const forces = stratagemStats[item.id]?.forces ?? [];
  if (!profile?.modes?.length && !forces.length) return '';
  const value = force => force == null ? '?' : typeof force === 'number' ? num(force) : `${num(force.min)}~${num(force.max)}`;
  // Where the demolition data keeps a range (sources disagree), show that range instead of the datamine number.
  const range = kind => profile?.modes?.map(mode => kind === 'blast' ? mode.explosion : mode.direct).find(force => force && typeof force === 'object');
  const line = (demo, stun, push) => html`<span class="force-line"><b>${L('철거력', 'Demolition')}</b> ${demo} · <b>${L('저지력', 'Stagger')}</b> ${stun ?? '?'} · <b>${L('넉백', 'Push')}</b> ${push ?? '?'}</span>`;
  // Only the strongest direct hit and the strongest blast (user decision 2026-11-19): highest
  // demolition, then stagger, then push. Fragments are left out.
  const parts = forces.flatMap(group => group.parts);
  // The overcharge blast (Railgun, Epoch) is the weapon blowing up, not a shot: its own row with a warning.
  const chosen = [strongest(parts.filter(part => DIRECT_KINDS.includes(part.kind))), strongest(parts.filter(part => part.kind === 'blast')), strongest(parts.filter(part => part.kind === 'overcharge'))].filter(Boolean);
  const rows = forces.length
    ? (chosen.length ? chosen : parts.slice(0, 1)).map(part => ({
      label: FORCE_KIND[part.kind],
      text: html`${line(range(part.kind) ? value(range(part.kind)) : value(part.demo), part.stun, part.push)}${part.kind === 'overcharge' ? html`<span class="force-note">${L('탄이 아니라 과충전하면 무기가 터지는 폭발입니다. 사용자도 죽습니다.', 'Not a shot: the weapon blows up when overcharged, killing the user too.')}</span>` : ''}`,
    }))
    // No attack records in the datamine: the highest direct and blast demolition force of the demolition data.
    : fallbackRows(profile, value);
  return html`<section class="block"><h3>${L('특수 효과', 'Special effects')}</h3>
    <dl class="detail-grid">${rows.map(row => html`<div><dt>${row.label}</dt><dd class="force-lines">${row.text}</dd></div>`)}</dl>
    <p class="faint" style="font-size:12.5px;margin-top:8px">${FORCE_NOTE}</p>
  </section>`;
}

// The detail grid adds a support weapon's ergonomics (weapon handling, datamine) to the card stats.
const detailStats = item => {
  const { ergonomics, sway } = stratagemStats[item.id] ?? {};
  return [...stats(item),
    ...(ergonomics == null ? [] : [{ label: L('인체공학성', 'Ergonomics'), text: num(ergonomics), caption: L('높을수록 조준이 빨리 따라옴', 'Higher = the aim follows faster') }]),
    // Sway only where it differs from the standard 100% (user decision 2026-11-19).
    ...(sway == null || sway === 1 ? [] : [{ label: L('흔들림', 'Sway'), text: num(Math.round(sway * 100)), unit: '%', caption: L('표준 100% · 낮을수록 덜 흔들림', 'Standard 100% · lower sways less') }])];
};
const statGrid = item => html`<dl class="detail-grid">${detailStats(item).map(stat => html`<div><dt>${stat.label}</dt><dd class="${stat.dim ? 'dim' : ''}">${stat.text}${stat.unit ? html`<small>${stat.unit}</small>` : ''}</dd>${stat.caption ? html`<div class="caption">${stat.caption}</div>` : ''}</div>`)}
  ${ammoCells(item)}
  ${rateCell(item)}</dl>`;

export function stratagemDetail(item, { demolition = false, force = null, header = null, titleId = 'sheet-title', variant = state.variant, compare = true } = {}) {
  const cat = categoryOf(item.category);
  const variants = item.variants?.length > 1 ? item.variants : null;
  const current = variantOf(item, variant);
  const combat = item.category === 'support';
  const notes = [item.rangeNote, item.notes, ...(item.modes || [])].filter(Boolean);
  const inCompare = state.compare.has(item.id);
  return html`${header ?? html`<div class="sheet-top"><span>${cat.name} · ${L('상세', 'Details')}</span><button class="icon-button" type="button" data-close aria-label="${L('닫기', 'Close')}">${icon('close', 18)}</button></div>`}
  <div class="sheet-content">
    <div class="detail-id"><img class="strat-icon large" src="${wikiIcons[item.id]?.src}" alt="" width="64" height="64">
      <div><h2 id="${titleId}">${item.name}</h2><p>${subtitle(item)}</p>
      <div class="chips" style="margin-top:6px">${badge(cat.name, 'outline')}${warbondChip('arsenal', item.id)}${item.ap != null ? badge(`AP ${item.ap} · ${apBandOf(item).name}`, 'accent') : ''}${item.tags.map(tag => badge(tag))}${stratagemStats[item.id]?.oneHanded ? badge(L('한손', 'One-handed')) : ''}</div></div></div>
    ${item.input ? html`<div class="block"><h3>${L('호출 코드', 'Stratagem code')}</h3>${keycaps(item.input, 'large')}</div>` : ''}
    <p style="font-size:16px">${item.summary}</p>
    ${firingModesBlock(item)}
    ${variants ? html`<div class="variant-tabs"><h3>${item.variantLabel || L('모드별 수치', 'Stats by mode')}</h3><div class="segmented" role="group" aria-label="${item.variantLabel || L('모드 선택', 'Mode')}">${variants.map(v => html`<button type="button" data-variant="${v.id}" aria-pressed="${String(v === current)}">${v.tab || v.name}</button>`)}</div></div>
      ${variants.map(v => html`<div class="variant-panel" data-variant-panel="${v.id}" ${v === current ? '' : raw('hidden')}>${statGrid(withVariant(item, v))}${blastFigure(withVariant(item, v))}${v.note ? html`<p class="variant-note">${v.note}</p>` : ''}</div>`)}`
      : html`${statGrid(item)}${blastFigure(item)}`}
    ${specialBlock(item, force)}
    ${spreadBlock(item)}
    ${timingBlock(item)}
    <section class="block"><h3>${L('이렇게 쓰세요', 'How to use it')}</h3><p>${item.usage}</p></section>
    ${item.warning ? html`<div class="callout warn"><h3>${L('주의', 'Watch out')}</h3><p>${item.warning}</p></div>` : ''}
    ${defenseBlock(item)}
    ${notes.length ? html`<section class="block"><h3>${L('수치 기준', 'About the numbers')}</h3><ul class="notes">${notes.map(note => html`<li>${note}</li>`)}</ul></section>` : ''}
    <div class="links">
      ${combat ? html`<a class="button primary" href="#/enemy?w=${item.id}">${icon('enemy', 18)} ${L('적 대응 계산', 'Shots to kill')}</a>` : ''}
      ${demolition ? html`<a class="button" href="#/demolition?w=${item.id}">${icon('demolition', 18)} ${L('철거 가능 시설', 'What it can demolish')}</a>` : ''}
      ${compare ? html`<button class="button ghost" type="button" data-compare="${item.id}" aria-pressed="${inCompare}">${icon(inCompare ? 'check' : 'plus', 18)} ${inCompare ? L('비교에 담김', 'Added to compare') : L('비교에 담기', 'Add to compare')}</button>` : ''}
    </div>
    <div class="sources">
      <span>${L('자료 확인', 'Checked')} ${item.defense?.checkedAt || CHECKED_AT}${item.patch ? L(` · 위키 갱신 패치 ${item.patch}`, ` · wiki updated for patch ${item.patch}`) : ''}</span>
      ${external(item.source, L('위키 항목', 'Wiki page'))}
      ${wikiIcons[item.id] ? external(wikiIcons[item.id].source, L('아이콘 원본', 'Icon source')) : ''}
      ${item.extraSource ? external(item.extraSource, L('추가 수치 근거', 'Extra source')) : ''}
    </div>
    <p class="faint" style="font-size:12.5px">${L('피해 수치는 함선 모듈·행성 효과를 뺀 기본값입니다. 실제 피해는 맞은 부위의 장갑·내구도와 거리, 각도에 따라 달라집니다.', 'Damage figures are base values without ship modules or planetary effects. Real damage depends on the armor and durability of the part you hit, range and angle.')}</p>
  </div>`;
}

let demolitionProfiles = null;
function openDetail(id) {
  const item = stratagemById.get(id);
  if (!item) return;
  const show = () => ctx.openSheet(stratagemDetail(item, { demolition: Boolean(demolitionProfiles?.[id]), force: demolitionProfiles?.[id] }), {
    label: `${T(item.name)} ${L('상세', 'details')}`,
    onClose: () => {
      if (state.detail !== id) return;
      state.detail = null; state.variant = '';
      if (state.pushedDetail) { state.pushedDetail = false; history.back(); } else syncUrl();
    },
  });
  show();
  // Demolition data is large; learn which stratagems have it only when needed.
  if (!demolitionProfiles) import('../../data/demolition-data.js').then(module => {
    demolitionProfiles = module.demolitionProfiles;
    if (state.detail === id && demolitionProfiles[id]) show();
  });
}

// --- Comparison ---------------------------------------------------------------------
function openCompare() {
  const items = [...state.compare].map(id => stratagemById.get(id));
  if (items.length < 2) return;
  const best = (pick) => { const values = items.map(pick).filter(Number.isFinite); return values.length > 1 ? Math.max(...values) : null; };
  const numericRow = (label, index, pick) => {
    const top = best(pick);
    return html`<tr><th scope="row">${label}</th>${items.map(item => { const stat = stats(item)[index]; return html`<td class="${top != null && pick(item) === top ? 'best' : ''}">${stat.text}${stat.unit || ''}${stat.caption ? html`<small>${stat.caption}</small>` : ''}</td>`; })}</tr>`;
  };
  const textRow = (label, pick) => html`<tr><th scope="row">${label}</th>${items.map(item => html`<td>${pick(item) || html`<span class="faint">—</span>`}</td>`)}</tr>`;
  ctx.openSheet(html`<div class="sheet-top"><span>${L('나란히 비교', 'Side by side')}</span><button class="icon-button" type="button" data-close aria-label="${L('닫기', 'Close')}">${icon('close', 18)}</button></div>
  <div class="sheet-content">
    <h2 id="sheet-title" style="font-size:22px">${items.map(item => T(item.name)).join(' vs ')}</h2>
    <div class="compare-scroll" role="region" aria-label="${L('비교표', 'Comparison table')}" tabindex="0"><table class="compare-table">
      <thead><tr><th></th>${items.map(item => html`<th scope="col"><div style="display:flex;gap:10px;align-items:center">${iconOf(item)}<div>${item.name}<small class="faint" style="display:block;font-weight:500;font-size:12px">${categoryOf(item.category).name}</small></div></div></th>`)}</tr></thead>
      <tbody>
        ${numericRow(items[0].damageKind === 'dps' ? L('직격 / 지속', 'Direct / per second') : L('직격', 'Direct'), 0, item => item.direct)}
        ${numericRow(L('폭발', 'Blast'), 1, item => item.splash)}
        ${numericRow(L('관통', 'Penetration'), 2, item => item.ap)}
        ${numericRow(L('사거리·반경', 'Range / radius'), 3, item => item.range ?? item.radius)}
        ${items.some(item => item.variants) ? textRow(L('모드별', 'Modes'), item => item.variants ? html`<ul class="compare-modes">${item.variants.map(v => html`<li><b>${v.name}</b> ${variantBrief(item, v)}</li>`)}</ul>` : '') : ''}
        ${textRow(L('호출 코드', 'Stratagem code'), item => item.input ? keycaps(item.input) : '')}
        ${items.some(item => item.defense) ? textRow(L('방어', 'Defense'), item => item.defense?.type === 'energy' ? L(`보호막 ${num(item.defense.shield?.capacity)} · 재생 ${num(item.defense.shield?.regeneration)}/초`, `Shield ${num(item.defense.shield?.capacity)} · regen ${num(item.defense.shield?.regeneration)}/s`) : item.defense ? L(`본체 체력 ${num(item.defense.body?.hp)} · 장갑 ${item.defense.body?.armor}`, `Body health ${num(item.defense.body?.hp)} · armor ${item.defense.body?.armor}`) : '') : ''}
        ${textRow(L('용도', 'Role'), item => item.tags.map(T).join(' · '))}
        ${textRow(L('사용법', 'How to use'), item => item.usage)}
        ${textRow(L('주의', 'Watch out'), item => item.warning)}
      </tbody>
    </table></div>
    <p class="faint" style="font-size:12.5px">${L('노란 값이 가장 높은 수치입니다. 사거리와 폭발 반경, 한 발 피해와 초당 피해는 단위가 다르니 아래 설명을 함께 보세요.', 'Yellow marks the highest value. Range and blast radius, and per-shot and per-second damage, use different units, so read the notes too.')}</p>
  </div>`, { wide: true, label: L('스트라타젬 비교', 'Stratagem comparison') });
}

function toggleCompare(id) {
  if (state.compare.has(id)) state.compare.delete(id);
  else if (state.compare.size >= MAX_COMPARE) { ctx.toast(L(`비교는 최대 ${MAX_COMPARE}개까지입니다. 하나를 빼 주세요.`, `You can compare up to ${MAX_COMPARE}. Remove one first.`)); return; }
  else state.compare.add(id);
  renderList();
  if (state.detail === id) openDetail(id);
}

// --- View lifecycle -------------------------------------------------------------------
export function mount(container, context) {
  root = container; ctx = context;
  // A fresh visit has no open detail; leaving through a link skips the close handler that clears it.
  state.detail = null; state.variant = ''; state.pushedDetail = false;
  const count = id => stratagems.filter(item => item.category === id).length;
  render(root, html`<div class="page-head"><div><div class="eyebrow">Stratagem Arsenal</div><h1>${L('스트라타젬 도감', 'Stratagems')}</h1><p>${L(`${stratagems.length}종의 피해·관통·범위와 사용법. 카드를 누르면 자세한 기준이 열립니다.`, `Damage, penetration, reach and how to use all ${stratagems.length} stratagems. Open a card for the details behind the numbers.`)}</p></div></div>
  <div class="arsenal-tools">
    <div class="row">
      <label class="field">${icon('search', 18)}<span class="sr-only">${L('스트라타젬 검색', 'Search stratagems')}</span><input class="input" id="arsenal-q" type="search" placeholder="${L('이름·코드·용도 검색 — 순서를 섞어도 됩니다 (예: 도밀타)', 'Search by name, code or role')}" autocomplete="off"></label>
      <label><span class="sr-only">${L('정렬', 'Sort')}</span><select class="select" id="arsenal-sort">${SORTS.map(sort => html`<option value="${sort.id}">${sort.name}</option>`)}</select></label>
    </div>
    <div class="chip-row">
      <div class="chips" role="group" aria-label="${L('종류', 'Category')}"><button class="chip" type="button" data-cat="">${L('전체', 'All')} <span class="count">${stratagems.length}</span></button>${categories.map(cat => html`<button class="chip" type="button" data-cat="${cat.id}" style="--dot:${cat.color}"><span class="dot"></span>${cat.name} <span class="count">${count(cat.id)}</span></button>`)}</div>
      <div class="chips" role="group" aria-label="${L('함선 모듈', 'Ship modules')}"><button class="chip" type="button" data-mod="on">${L('함선 모듈 적용', 'Ship modules on')}</button><button class="chip" type="button" data-mod="off">${L('미적용', 'Off')}</button></div>
    </div>
    <div class="chip-row">
      <div class="chips" role="group" aria-label="${L('관통력', 'Penetration')}"><button class="chip" type="button" data-ap="">${L('모든 관통력', 'Any penetration')}</button>${AP_FILTERS.map(band => html`<button class="chip" type="button" data-ap="${band.id}">${band.name} <span class="count">${band.label}</span></button>`)}</div>
      <div class="chips" role="group" aria-label="${L('스트라타젬 구분', 'Stratagem type')}"><button class="chip" type="button" data-permit="">${L('전체', 'All')}</button>${PERMITS.map(permit => html`<button class="chip" type="button" data-permit="${permit.id}" style="--dot:${permit.color}"><span class="dot"></span>${permit.name} <span class="count">${stratagems.filter(item => permitOf(item) === permit.id).length}</span></button>`)}</div>
    </div>
  </div>
  <div class="arsenal-meta"><span id="arsenal-count" role="status"></span><button class="link" type="button" data-reset data-reset-inline>${L('필터 초기화', 'Reset filters')}</button></div>
  <div id="arsenal-grid" class="grid"></div>
  <div id="arsenal-tray" class="tray" hidden></div>`);

  const input = $('#arsenal-q', root);
  input.addEventListener('input', () => { state.q = input.value; renderList(); syncUrl(); });
  $('#arsenal-sort', root).addEventListener('change', event => { state.sort = event.target.value; renderList(); syncUrl(); });
  root.addEventListener('click', event => {
    const target = event.target.closest('button, a');
    if (!target) return;
    if (target.dataset.cat != null) {
      state.c = state.c === target.dataset.cat ? '' : target.dataset.cat;
      // A type that has nothing in the new category is let go.
      if (state.p && !stratagems.some(item => item.category === state.c && permitOf(item) === state.p) && state.c) state.p = '';
      renderList(); syncUrl();
    }
    else if (target.dataset.ap != null) { state.ap = state.ap === target.dataset.ap ? '' : target.dataset.ap; renderList(); syncUrl(); }
    else if (target.dataset.permit != null) {
      state.p = state.p === target.dataset.permit ? '' : target.dataset.permit;
      if (state.c && state.p && !stratagems.some(item => item.category === state.c && permitOf(item) === state.p)) state.c = '';
      renderList(); syncUrl();
    }
    else if (target.dataset.mod) { state.mod = target.dataset.mod === 'on'; setModulesOn(state.mod); renderList(); syncUrl(); }
    else if (target.dataset.open) { state.pushedDetail = true; ctx.go({ view: 'arsenal', id: target.dataset.open, query: { ...ctx.route.query, m: '' } }); }
    else if (target.dataset.compare) toggleCompare(target.dataset.compare);
    else if (target.hasAttribute('data-compare-clear')) { state.compare.clear(); renderList(); }
    else if (target.hasAttribute('data-compare-open')) openCompare();
    else if (target.hasAttribute('data-reset')) { Object.assign(state, { c: '', ap: '', p: '', q: '', sort: '' }); input.value = ''; $('#arsenal-sort', root).value = ''; renderList(); syncUrl(); }
  });
  // Buttons inside the sheet live outside `root`; register that listener once.
  if (!sheetListener) {
    sheetListener = event => {
      if (document.body.dataset.view !== 'arsenal') return;
      const target = event.target.closest('[data-compare]');
      if (target) toggleCompare(target.dataset.compare);
      const pick = event.target.closest('[data-variant]');
      if (pick) selectVariant(pick.dataset.variant);
    };
    $('#sheet').addEventListener('click', sheetListener);
  }
}
let sheetListener = null;

function selectVariant(id) {
  state.variant = id;
  const sheet = $('#sheet');
  for (const button of $$('[data-variant]', sheet)) button.setAttribute('aria-pressed', String(button.dataset.variant === id));
  for (const panel of $$('[data-variant-panel]', sheet)) panel.hidden = panel.dataset.variantPanel !== id;
  syncUrl();
}

export function update(route) {
  const q = route.query;
  Object.assign(state, {
    c: categories.some(cat => cat.id === q.c) ? q.c : '',
    ap: AP_FILTERS.some(band => band.id === q.ap) ? q.ap : '',
    p: PERMITS.some(permit => permit.id === q.p) ? q.p : '',
    q: q.q || '', sort: SORTS.some(sort => sort.id === q.sort) ? q.sort : '',
    mod: q.mod !== 'off',
  });
  // A category and type that cannot meet (from a link) drop the type, as a click would.
  if (state.c && state.p && !stratagems.some(item => item.category === state.c && permitOf(item) === state.p)) { state.p = ''; syncUrl(); }
  setModulesOn(state.mod);
  $('#arsenal-q', root).value = state.q;
  $('#arsenal-sort', root).value = state.sort;
  renderList();
  const id = stratagemById.has(route.id) ? route.id : null;
  if (id && id !== state.detail) { state.detail = id; state.variant = stratagemById.get(id).variants?.some(v => v.id === q.m) ? q.m : ''; openDetail(id); }
  else if (!id && state.detail) { state.detail = null; state.variant = ''; state.pushedDetail = false; ctx.closeSheet(); }
}

// Demolition: look up by structure (what destroys it?) or by stratagem (what can it destroy?).
import { structures, demolitionProfiles, demolitionCheckedAt, demolitionSource, structureDamageSource } from '../../data/demolition-data.js';
import { pickerStructureImages } from '../../data/selector-images.js';
import { wikiIcons } from '../../data/wiki-icons.js';
import { stratagems, stratagemById, categories, categoryOf } from '../../core/catalog.js';
import { solveDemolition, structureOverview, forceRange } from '../../core/demolition.js';
import { search, stratagemFields } from '../../core/search.js';
import { num, unitText } from '../../core/explain.js';
import { L, T } from '../../core/i18n.js';
import { html, raw, render, $, $$, icon, badge, external } from '../dom.js';

const MAX_FORCE = 60;
const structureById = new Map(structures.map(item => [item.id, item]));
const armed = stratagems.filter(item => demolitionProfiles[item.id]);
const confirmedCount = Object.values(demolitionProfiles).filter(profile => profile.modes.some(mode => !mode.forceUnknown)).length;

let root, ctx;
const state = { by: 'structure', structure: null, weapon: null, mode: null, shieldCleared: false, jammerDisabled: false, q: '' };

// --- Text -----------------------------------------------------------------------------
const OUTCOME = {
  demolish: { label: L('철거 가능', 'Demolishes'), tone: 'kill' },
  health: { label: L('체력 파괴', 'Via health'), tone: 'health' },
  conditional: { label: L('조건부', 'Conditional'), tone: 'conditional' },
  blocked: { label: L('불가', 'Cannot'), tone: 'blocked' },
  unknown: { label: L('자료 미확인', 'Unverified'), tone: 'unknown' },
};
const REASON = {
  'no-data': L('이 공격의 철거 수치와 시설 피해가 아직 확인되지 않았습니다. 파괴할 수 없다는 뜻은 아닙니다.', 'Its demolition force and structure damage are not verified yet. That does not mean it cannot destroy it.'),
  'force-unknown': L('철거력이 미확인이거나 자료끼리 엇갈려 판정하지 않았습니다.', 'Demolition force is unverified or sources disagree, so no verdict.'),
  'threshold-unknown': L('이 시설에 필요한 철거력이 확인되지 않아 판정하지 않았습니다.', 'The demolition force this structure needs is unverified, so no verdict.'),
  'health-unknown': L('철거력은 부족합니다. 체력으로 부술 수 있는 시설이지만 이 공격의 피해가 확인되지 않았습니다.', 'Not enough demolition force. The structure can be destroyed through its health, but this attack\'s damage is unverified.'),
  'blocked-armor': L('철거력이 모자라고, 시설 장갑을 뚫는 피해도 없습니다.', 'Not enough demolition force, and no damage that gets through the structure\'s armor.'),
  'blocked-force': L('철거력이 기준에 못 미칩니다. 여러 발의 철거력은 합쳐지지 않습니다.', 'Demolition force falls short. Force from several hits does not add up.'),
};
const forceText = (value, unknown) => {
  if (unknown) return L('미확인', 'Unverified');
  const force = forceRange(value);
  return !force ? L('없음', 'None') : force.min === force.max ? String(force.min) : L(`${force.min}–${force.max} (자료 불일치)`, `${force.min}–${force.max} (sources disagree)`);
};
// A structure's threshold can be unverified (null); it is shown, never read as 0.
const thresholdText = threshold => threshold == null ? L('미확인', 'Unverified') : String(threshold);
const conditionText = (condition, profile) => ({
  opening: () => L(`${condition.route.name}에 폭발을 넣어야 합니다.`, `The explosion has to go into the ${T(condition.route.name)}.`),
  aim: () => profile.note || L('실제 명중·기폭 조건을 확인하세요.', 'Check the actual hit and detonation conditions.'),
  shield: () => L('워프 함선의 보호막을 먼저 벗겨야 합니다. 보호막 제거에 드는 공격은 제외합니다.', 'The Warp Ship\'s shield has to come down first. Attacks spent on the shield are not counted.'),
  jammer: () => L('교란기를 끈 뒤에만 호출할 수 있습니다.', 'Can only be called in once the jammer is off.'),
  'anti-air': () => L('대공 거치포가 서 있으면 150 m 안에서 이글을 호출할 수 없습니다.', 'Eagles cannot be called in within 150 m while the Anti-Air Emplacement stands.'),
})[condition.kind]();

function howText(result) {
  if (result.method === 'health') {
    const openings = result.routes.filter(row => row.verdict === 'pass' && row.route.opening).map(row => row.route.name);
    return L(`${num(result.hits)}${result.unit}로 체력 파괴${openings.length ? ` · 또는 ${openings.join('·')}에 폭발 1${result.unit}` : ''}`,
      `Destroyed through health in ${num(result.hits)}${unitText(result.unit, result.hits)}${openings.length ? ` · or one explosive ${unitText(result.unit, 1).trim()} into the ${openings.map(T).join(' / ')}` : ''}`);
  }
  if (result.method === 'force') return L(`${result.route.name}에 ${result.via === 'explosion' ? '폭발' : '직접 명중'} 1${result.unit}로 철거`, `One ${result.via === 'explosion' ? 'explosion' : 'direct hit'} on the ${T(result.route.name)} demolishes it`);
  return REASON[result.reason] || '';
}

const weaponIcon = (id, size = 36) => html`<img class="strat-icon" style="width:${size}px;height:${size}px" src="${wikiIcons[id]?.src}" alt="" loading="lazy">`;
const structureImage = (structure, size = 44) => {
  const image = pickerStructureImages[structure.id];
  return image?.src ? html`<img src="${image.src}" alt="" width="${size}" height="${size}" loading="lazy" style="width:${size}px;height:${size}px;object-fit:contain">` : '';
};

// --- Pieces ---------------------------------------------------------------------------------
function forceScale(structure) {
  return html`<div class="force-scale">${structure.routes.map(route => html`<div class="force-row">
    <span>${route.name}${route.explosiveOnly ? html` <span class="faint">· ${L('내부 폭발만', 'explosions inside only')}</span>` : ''}</span>
    <span class="force-bar" role="img" aria-label="${route.threshold == null ? L('필요한 철거력 미확인', 'Demolition force needed is unverified') : L(`철거력 ${route.threshold} 필요`, `Needs demolition force ${route.threshold}`)}"><i style="width:${(route.threshold ?? 0) / MAX_FORCE * 100}%"></i></span>
    <b class="num">${thresholdText(route.threshold)}</b></div>`)}</div>`;
}

function conditionToggles(needShield, needJammer) {
  if (!needShield && !needJammer) return '';
  return html`<div style="display:grid;gap:8px">
    ${needShield ? html`<label class="toggle"><input type="checkbox" data-opt="shieldCleared" ${state.shieldCleared ? raw('checked') : ''}><div><b>${L('워프 함선 보호막을 이미 벗겼다고 가정', 'Assume the Warp Ship shield is already down')}</b><span>${L('켜지 않으면 보호막을 통과하지 못하는 공격은 ‘조건부’로 표시합니다.', 'If off, attacks that cannot get through the shield are marked “Conditional”.')}</span></div></label>` : ''}
    ${needJammer ? html`<label class="toggle"><input type="checkbox" data-opt="jammerDisabled" ${state.jammerDisabled ? raw('checked') : ''}><div><b>${L('교란기를 이미 껐다고 가정', 'Assume the jammer is already off')}</b><span>${L('교란기가 켜져 있으면 궤도·이글 같은 호출 공격은 쓸 수 없습니다.', 'While the jammer is on, called-in attacks such as Orbitals and Eagles cannot be used.')}</span></div></label>` : ''}
  </div>`;
}

function structurePanel(structure) {
  const h = structure.health;
  return html`<section class="panel" style="padding:18px;display:grid;gap:14px" data-faction="${structure.faction}">
    <div style="display:flex;gap:14px;align-items:center">${structureImage(structure, 56)}<div><span class="faction-tag">${structure.faction}</span><h2 style="font-size:22px;font-weight:800">${structure.name}</h2></div></div>
    <p class="muted">${structure.tip}</p>
    <div><div class="note" style="margin-bottom:6px;font-weight:650;color:var(--text)">${L('필요한 철거력', 'Demolition force needed')} <span class="faint" style="font-weight:500">· ${L('한 번의 명중·폭발 기준, 합산 안 됨', 'per single hit or explosion; does not add up')}</span></div>${forceScale(structure)}</div>
    ${h ? html`<p class="note">${L(html`체력으로도 부술 수 있습니다: <b style="color:var(--text)">체력 ${num(h.hp)}</b> · 장갑 ${h.armor} · 내구도 ${h.durability}%${h.exdr < 0 ? ` · 폭발 피해 ×${num(1 - h.exdr / 100)}` : ''}`, html`It can also be destroyed through health: <b style="color:var(--text)">health ${num(h.hp)}</b> · armor ${h.armor} · durability ${h.durability}%${h.exdr < 0 ? ` · explosion damage ×${num(1 - h.exdr / 100)}` : ''}`)}</p>` : ''}
    ${structure.note ? html`<p class="note">${structure.note}</p>` : ''}
    <p class="sources">${external(structure.source, L('시설 철거 조건', 'Demolition requirements'))}${structure.healthSource ? external(structure.healthSource, L('시설 체력', 'Structure health')) : ''}</p>
  </section>`;
}

function structureResults(structure) {
  const overview = structureOverview(structure, stratagems, demolitionProfiles, state);
  const groups = [
    ['demolish', L('바로 철거', 'Demolishes outright'), L('한 번의 명중이나 폭발로 무너뜨립니다.', 'One hit or explosion brings it down.')],
    ['health', L('체력으로 파괴', 'Destroys through health'), L('여러 번 맞혀 체력을 깎아 부숩니다.', 'Wears its health down over several hits.')],
    ['conditional', L('조건부', 'Conditional'), L('아래 조건을 충족해야 합니다.', 'Only if the condition below is met.')],
  ].map(([outcome, title, hint]) => ({ outcome, title, hint, entries: overview.entries.filter(entry => entry.outcome === outcome) })).filter(group => group.entries.length);
  const needJammer = structure.condition === 'jammer' && overview.entries.some(entry => entry.profile.requiresCallIn);
  return html`
    ${conditionToggles(structure.condition === 'shield', needJammer)}
    <div class="verdict" data-tone="${overview.possible ? 'kill' : ''}"><span class="label">${structure.name} × ${L('모든 스트라타젬', 'every stratagem')}</span>
      <h3>${overview.entries.length ? L(html`<span class="big">${overview.possible}</span>종 바로 가능 · 조건부 ${overview.conditional}종`, html`<span class="big">${overview.possible}</span> work outright · ${overview.conditional} conditional`) : L('파괴할 수 있는 스트라타젬이 아직 확인되지 않았습니다', 'No stratagem is verified to destroy it yet')}</h3>
      <p>${L(`철거 자료가 없는 ${overview.unknown}종(보급·이동 장비 포함)은 목록에서 뺐습니다. 파괴할 수 없다는 뜻은 아닙니다.`, `${overview.unknown} stratagems without demolition data (supply and mobility gear included) are left off the list. That does not mean they cannot destroy it.`)}</p></div>
    <div class="result-groups">${groups.map(group => html`<section class="result-group"><h3>${badge(OUTCOME[group.outcome].label, OUTCOME[group.outcome].tone)} ${group.title} <span class="faint" style="font-weight:500;font-size:13px">${group.entries.length}${L('종', '')} · ${group.hint}</span></h3>
      <div class="result-list">${group.entries.map(entry => html`<a class="panel result-item" style="text-decoration:none" href="#/demolition?w=${entry.weapon.id}&m=${entry.attacks[0].mode.id}">
        <header>${weaponIcon(entry.weapon.id)}<div><b>${entry.weapon.name}</b><small>${categoryOf(entry.weapon.category).name}</small></div></header>
        <ul class="mode-lines">${entry.attacks.map(({ mode, result }) => html`<li>${entry.profile.modes.length > 1 || mode.name !== '기본 공격' ? html`<b>${mode.name}</b>` : ''}<span class="how">${howText(result)}</span>
          ${result.conditions.map(condition => html`<span style="color:var(--bleed)">· ${conditionText(condition, entry.profile)}</span>`)}</li>`)}</ul>
      </a>`)}</div></section>`)}</div>`;
}

function weaponPicker() {
  const list = search(armed, state.q, stratagemFields);
  return html`<div style="display:grid;gap:10px">
    <label class="field">${icon('search', 16)}<span class="sr-only">${L('스트라타젬 검색', 'Search stratagems')}</span><input class="input" id="demo-q" type="search" placeholder="${L('스트라타젬 검색 (예: 500, 지옥폭탄)', 'Search stratagems (e.g. 500, Hellbomb)')}" value="${state.q}" autocomplete="off"></label>
    <div class="tile-grid" id="demo-weapons">${list.map(item => html`<button class="tile" type="button" data-weapon="${item.id}" aria-current="${item.id === state.weapon}">${weaponIcon(item.id, 40)}<span><b>${item.name}</b><small class="faint">${categoryOf(item.category).name}</small></span></button>`)}</div>
  </div>`;
}

function weaponResults(weapon) {
  const profile = demolitionProfiles[weapon.id];
  const mode = profile.modes.find(item => item.id === state.mode) || profile.modes[0];
  const rows = structures.map(structure => solveDemolition(structure, profile, mode, state));
  const order = { demolish: 0, health: 0, conditional: 1, unknown: 2, blocked: 3 };
  const sorted = rows.map((row, index) => ({ row, index })).sort((a, b) => order[a.row.outcome] - order[b.row.outcome] || a.index - b.index).map(item => item.row);
  const shown = sorted.filter(row => row.outcome !== 'blocked');
  const blocked = sorted.filter(row => row.outcome === 'blocked');
  const possible = rows.filter(row => ['demolish', 'health'].includes(row.outcome)).length;
  const conditional = rows.filter(row => row.outcome === 'conditional').length;
  const notes = [profile.note, mode.note].filter(Boolean);
  return html`<section class="panel" style="padding:16px;display:grid;gap:12px">
      <div class="matchup-head">${weaponIcon(weapon.id, 44)}<div><h2>${weapon.name}</h2><a class="ext" href="#/arsenal/${weapon.id}">${L('도감에서 보기', 'Open in Stratagems')}</a></div>
        ${profile.modes.length > 1 ? html`<div class="segmented" role="group" aria-label="${L('탄종·공격', 'Shell / attack')}">${profile.modes.map(item => html`<button type="button" data-mode-pick="${item.id}" aria-pressed="${item.id === mode.id}">${item.name}</button>`)}</div>` : ''}</div>
      <div class="stat-chips">
        <div class="stat-chip"><span>${L(`${mode.directLabel || '직격'} 철거력`, `${T(mode.directLabel) || 'Direct'} demolition force`)}</span><b>${forceText(mode.direct, mode.forceUnknown)}</b></div>
        <div class="stat-chip"><span>${L('폭발 철거력 · 중심부', 'Blast demolition force · center')}</span><b>${forceText(mode.explosion, mode.forceUnknown)}</b></div>
        ${mode.damage ? html`<div class="stat-chip"><span>${L('시설 피해 (체력 계산용)', 'Structure damage (for health)')}</span><b>${num(mode.damage.standard)}</b><small>${L('폭발', 'Blast')} ${num(mode.damage.explosion)} · AP ${mode.damage.ap}/${mode.damage.explosionAp}</small></div>` : ''}
      </div>
      ${notes.length || mode.shieldBypass || mode.damage?.falloff ? html`<ul class="notes">${notes.map(note => html`<li>${note}</li>`)}${mode.shieldBypass ? html`<li>${L('워프 함선: 본체에 닿으면 보호막을 벗기기 전에도 부술 수 있는 공격입니다.', 'Warp Ship: if it reaches the hull, this attack can destroy it even before the shield is down.')}</li>` : ''}${mode.damage?.falloff ? html`<li>${L('체력 계산은 거리 감쇠 전 최대 피해 기준입니다.', 'Health math uses full damage before falloff.')}</li>` : ''}</ul>` : ''}
    </section>
    ${conditionToggles(shown.some(row => row.structure.condition === 'shield'), profile.requiresCallIn && shown.some(row => row.structure.condition === 'jammer'))}
    <div class="verdict" data-tone="${possible ? 'kill' : ''}"><span class="label">${weapon.name} · ${mode.name} × ${L(`시설 ${structures.length}종`, `${structures.length} structures`)}</span>
      <h3>${L(html`<span class="big">${possible}</span>곳 바로 가능 · 조건부 ${conditional}곳`, html`<span class="big">${possible}</span> right away · ${conditional} conditional`)}</h3><p>${L(`자료 미확인 ${rows.filter(row => row.outcome === 'unknown').length}곳, 불가 ${blocked.length}곳.`, `${rows.filter(row => row.outcome === 'unknown').length} unverified, ${blocked.length} not possible.`)}</p></div>
    <div class="result-list">${shown.map(row => resultCard(row, profile, mode))}</div>
    ${blocked.length ? html`<details class="disclosure"><summary>${L(`이 공격으로 부술 수 없는 시설 ${blocked.length}곳`, `${blocked.length} structures it cannot destroy`)}</summary><div class="result-list">${blocked.map(row => resultCard(row, profile, mode))}</div></details>` : ''}
    <p class="sources">${external(demolitionSource, L('철거력·시설 기준', 'Demolition force and structures'))}${external(profile.source || weapon.source, L('공격 수치', 'Attack stats'))}${external(structureDamageSource, L('시설 피해 규칙', 'Structure damage rules'))}${profile.damageSource ? external(profile.damageSource, L('탄종 피해', 'Shell damage')) : ''}${profile.conflictingSource ? external(profile.conflictingSource, L('엇갈리는 종합표', 'Conflicting summary table')) : ''}<span>${L('자료 확인', 'Checked')} ${demolitionCheckedAt}</span></p>`;
}

function resultCard(row, profile, mode) {
  const s = row.structure;
  const o = OUTCOME[row.outcome];
  const verdictWord = { pass: L('충족', 'enough'), short: L('미달', 'short'), unknown: L('판정 보류', 'no verdict') };
  return html`<article class="panel result-item" data-faction="${s.faction}">
    <header>${structureImage(s, 36)}<div><b>${s.name}</b><small class="faction-tag">${s.faction}</small></div>${badge(o.label, o.tone)}</header>
    <p class="how">${howText(row)}</p>
    ${row.conditions.map(condition => html`<p style="color:var(--bleed)">· ${conditionText(condition, profile)}</p>`)}
    <details class="disclosure"><summary>${L('판정 근거', 'Why')}</summary><div>
      <ul class="notes">${row.routes.map(result => html`<li>${result.route.name}: ${L('철거력', 'demolition force')} ${thresholdText(result.route.threshold)}${result.route.explosiveOnly ? L(' (내부 폭발)', ' (explosion inside)') : ''} — ${result.parts.filter(part => part.verdict !== 'n/a').map(part => `${part.kind === 'direct' ? L('직접', 'direct') : L('폭발', 'blast')} ${forceText(mode[part.kind], mode.forceUnknown)} ${verdictWord[part.verdict]}`).join(' / ')}</li>`)}</ul>
      ${row.health ? html`<p class="note">${L('체력 계산', 'Health math')}: ${L('직격', 'direct')} ${num(row.health.direct)} + ${L('폭발', 'blast')} ${num(row.health.explosion)} = ${num(row.health.total)}${row.health.hits ? L(` → ${num(s.health.hp)} ÷ ${num(row.health.total)} = ${num(row.health.hits)}${row.unit} (올림)`, ` → ${num(s.health.hp)} ÷ ${num(row.health.total)} = ${num(row.health.hits)}${unitText(row.unit, row.health.hits)} (rounded up)`) : L(' → 피해 없음', ' → no damage')}</p>` : s.health ? html`<p class="note">${L('체력 계산: 이 공격의 시설 피해가 확인되지 않았습니다.', 'Health math: this attack\'s structure damage is unverified.')}</p>` : ''}
      <p class="note">${s.tip}</p>
    </div></details>
  </article>`;
}

// --- Render -----------------------------------------------------------------------------------
function renderView() {
  for (const button of $$('[data-by]', root)) button.setAttribute('aria-pressed', String(button.dataset.by === state.by));
  const body = $('#demo-body', root);
  if (state.by === 'structure') {
    const structure = structureById.get(state.structure);
    const factions = [...new Set(structures.map(item => item.faction))];
    render(body, html`<div style="display:grid;gap:14px">
      ${factions.map(faction => html`<div><div class="picker-group" data-faction="${faction}" style="padding:0 0 6px">${faction}</div><div class="tile-grid">${structures.filter(item => item.faction === faction).map(item => html`<button class="tile" type="button" data-structure="${item.id}" aria-current="${item.id === state.structure}">${structureImage(item)}<span><b>${item.name}</b><small class="faint">${L('철거력', 'Force')} ${item.routes.map(route => thresholdText(route.threshold)).join(' / ')}${item.health ? L(' · 체력', ' · health') : ''}</small></span></button>`)}</div></div>`)}
      <div id="demo-result" style="display:grid;gap:14px;margin-top:10px">${structure ? html`${structurePanel(structure)}${structureResults(structure)}` : html`<div class="empty"><h3>${L('시설을 골라 주세요', 'Pick a structure')}</h3><p>${L('무엇으로 부술 수 있는지, 어디를 맞혀야 하는지 알려 드립니다.', 'See what destroys it and where to hit it.')}</p></div>`}</div>
    </div>`);
  } else {
    const weapon = stratagemById.get(state.weapon);
    render(body, html`<div style="display:grid;gap:14px">${weaponPicker()}<div id="demo-result" style="display:grid;gap:14px;margin-top:10px">${weapon ? weaponResults(weapon) : html`<div class="empty"><h3>${L('스트라타젬을 골라 주세요', 'Pick a stratagem')}</h3><p>${L(`시설 ${structures.length}곳 각각에 대해 철거 가능 여부와 방법을 보여 드립니다.`, `See whether and how it destroys each of the ${structures.length} structures.`)}</p></div>`}</div></div>`);
    const input = $('#demo-q', root);
    input.addEventListener('input', () => {
      state.q = input.value;
      render($('#demo-weapons', root), search(armed, state.q, stratagemFields).map(item => html`<button class="tile" type="button" data-weapon="${item.id}" aria-current="${item.id === state.weapon}">${weaponIcon(item.id, 40)}<span><b>${item.name}</b><small class="faint">${categoryOf(item.category).name}</small></span></button>`));
    });
  }
}

function syncUrl(push = false) {
  const query = state.by === 'structure' ? { s: state.structure, by: state.structure ? null : 'structure' } : { w: state.weapon, m: state.weapon ? state.mode : null, by: state.weapon ? null : 'weapon' };
  if (state.shieldCleared) query.shield = '1';
  if (state.jammerDisabled) query.jammer = '0';
  (push ? ctx.go : ctx.replace)({ view: 'demolition', query });
}
const scrollToResult = () => requestAnimationFrame(() => $('#demo-result', root)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

export function mount(container, context) {
  root = container; ctx = context;
  render(root, html`<div class="page-head"><div><div class="eyebrow">Demolition</div><h1>${L('철거', 'Demolition')}</h1><p>${L('시설마다 필요한 ‘철거력’이 있고, 한 번의 명중·폭발이 그 값을 넘어야 무너집니다. 일부 시설은 체력을 깎아서도 부술 수 있습니다.', 'Every structure needs a certain demolition force, and a single hit or explosion has to reach it. Some structures can also be destroyed by wearing down their health.')}</p></div>
    <span class="badge outline">${L(`시설 ${structures.length}곳 · 철거력 확인 ${confirmedCount}종`, `${structures.length} structures · ${confirmedCount} stratagems with verified force`)}</span></div>
  <div class="segmented" role="group" aria-label="${L('찾는 방법', 'Look up by')}" style="margin-bottom:16px"><button type="button" data-by="structure">${icon('demolition', 16)} ${L('시설로 찾기', 'By structure')}</button><button type="button" data-by="weapon">${icon('arsenal', 16)} ${L('스트라타젬으로 찾기', 'By stratagem')}</button></div>
  <div id="demo-body"></div>`);
  root.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.by) { state.by = target.dataset.by; renderView(); syncUrl(); }
    else if (target.dataset.structure) { state.structure = target.dataset.structure; renderView(); syncUrl(); scrollToResult(); }
    else if (target.dataset.weapon) { state.weapon = target.dataset.weapon; state.mode = null; renderView(); syncUrl(); scrollToResult(); }
    else if (target.dataset.modePick) { state.mode = target.dataset.modePick; renderView(); syncUrl(); }
  });
  root.addEventListener('change', event => {
    const option = event.target.dataset.opt;
    if (option) { state[option] = event.target.checked; renderView(); syncUrl(); }
  });
}

export function update(route) {
  const q = route.query;
  const weapon = demolitionProfiles[q.w] && stratagemById.has(q.w) ? q.w : null;
  const structure = structureById.has(q.s) ? q.s : null;
  Object.assign(state, {
    by: weapon ? 'weapon' : structure ? 'structure' : q.by === 'weapon' ? 'weapon' : 'structure',
    structure: structure || state.structure,
    weapon: weapon || state.weapon,
    mode: weapon && demolitionProfiles[weapon].modes.some(mode => mode.id === q.m) ? q.m : weapon === state.weapon ? state.mode : null,
    shieldCleared: q.shield === '1', jammerDisabled: q.jammer === '0',
  });
  // A stratagem link from the catalogue without demolition data explains itself.
  if (q.w && !weapon && stratagemById.has(q.w)) ctx.toast(L(`${stratagemById.get(q.w).name}의 철거 자료는 아직 없습니다.`, `No demolition data for ${T(stratagemById.get(q.w).name)} yet.`));
  renderView();
}

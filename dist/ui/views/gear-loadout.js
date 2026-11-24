// Loadout check inside the gear tab: pick a primary, secondary, throwable and
// four stratagems, choose a faction, and see which key enemies the loadout
// answers (and with what), which it does not, and what could fill the gap.
import { personalWeapons } from '../../data/personal-weapons.js';
import { weaponImages } from '../../data/weapon-images.js';
import { wikiIcons } from '../../data/wiki-icons.js';
import { pickerEnemyImages } from '../../data/selector-images.js';
import { SIZE_NAMES } from '../../core/enemy-size.js';
import { stratagems, stratagemById, categories, categoryOf } from '../../core/catalog.js';
import { search, stratagemFields, personalNames, collabKeywords } from '../../core/search.js';
import { warbondSources } from '../../data/warbond-sources.js';
import { num, outcomeOf, unitText } from '../../core/explain.js';
import { L, T, lang } from '../../core/i18n.js';
import { html, raw, render, $, $$, icon, badge } from '../dom.js';
import { weaponById, displayName, typeName, orderTypes } from '../gear-shared.js';

const SLOTS = [
  { key: 'p', label: L('주무기', 'Primary'), group: 'primary' },
  { key: 's', label: L('보조무기', 'Secondary'), group: 'secondary' },
  { key: 'g', label: L('투척', 'Throwable'), group: 'throwable' },
  ...[0, 1, 2, 3].map(index => ({ key: `st${index}`, label: `${L('스트라타젬', 'Stratagem')} ${index + 1}`, stratagem: index })),
];

let core = null; // dist/core/loadout.js, loaded with the panel
let env = null;  // { ctx, loadout, onChange }
let panelEl = null;

const itemOf = id => weaponById.get(id) || stratagemById.get(id) || null;
const nameOf = id => { const item = itemOf(id); return item ? (weaponById.has(id) ? displayName(item) : item.name) : id; };
const slotValue = slot => slot.stratagem != null ? env.loadout.st[slot.stratagem] : env.loadout[slot.key];

export function thumb(id, size = 40) {
  const image = weaponImages[id];
  if (image) return html`<span class="lo-thumb" style="width:${size}px;height:${size}px"><img src="${image.src}" alt="" loading="lazy" decoding="async"></span>`;
  const iconSrc = wikiIcons[id]?.src;
  return iconSrc ? html`<img class="strat-icon" src="${iconSrc}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px" loading="lazy">` : html`<span class="lo-thumb empty" style="width:${size}px;height:${size}px">${icon('plus', 16)}</span>`;
}

function slotTile(slot) {
  const id = slotValue(slot);
  const item = id && itemOf(id);
  const support = item && stratagemById.has(id) && item.category === 'support';
  return html`<div class="lo-slot ${item ? 'filled' : ''}" data-slot-kind="${slot.stratagem != null ? 'stratagem' : slot.group}">
    <button type="button" class="lo-slot-pick" data-slot="${slot.key}" aria-label="${slot.label} ${item ? L(`${nameOf(id)} 바꾸기`, `change ${T(nameOf(id))}`) : L('고르기', 'choose')}">
      ${thumb(id, 44)}
      <span class="lo-slot-text"><small>${slot.label}</small><b>${item ? nameOf(id) : L('비어 있음', 'Empty')}</b>
        ${item && stratagemById.has(id) && !support ? html`<em>${L('계산 대상 아님', 'Not calculated')}</em>` : ''}</span>
    </button>
    ${item ? html`<button type="button" class="icon-button lo-clear" data-clear="${slot.key}" aria-label="${slot.label} ${L('비우기', 'clear')}">${icon('close', 14)}</button>` : ''}
  </div>`;
}

// --- Slot picker sheet -------------------------------------------------------------
// Candidates grouped by kind: weapon subtypes (data order) or stratagem categories.
const weaponFields = w => ({ names: personalNames(w), text: [typeName(w.type)], keywords: collabKeywords(warbondSources[`gear/${w.id}`]?.id) });
function pickerGroups(slot) {
  if (slot.stratagem != null) {
    const taken = new Set(env.loadout.st.filter((id, index) => id && index !== slot.stratagem));
    // Mission and shared stratagems (reinforce, resupply, objectives) are not loadout picks.
    const list = stratagems.filter(item => item.category !== 'mission' && !taken.has(item.id));
    return categories.map(cat => ({ id: cat.id, name: cat.name, color: cat.color, fields: item => ({ ...stratagemFields(item), keywords: collabKeywords(warbondSources[`arsenal/${item.id}`]?.id) }), items: list.filter(item => item.category === cat.id) }))
      .filter(group => group.items.length);
  }
  const list = personalWeapons.filter(w => w.category === slot.group);
  return orderTypes(new Set(list.map(w => w.type))).map(type => ({ id: type, name: typeName(type), fields: weaponFields, items: list.filter(w => w.type === type) }));
}

const picker = { kind: '' }; // chosen kind chip, reset each time the sheet opens

function choiceButton(slot, item) {
  const personal = weaponById.has(item.id);
  const sub = lang === 'en' ? (personal ? typeName(item.type) : item.category === 'support' ? 'Shots to kill available' : '') : personal ? item.en : `${item.en}${item.category === 'support' ? ' · 적 대응 계산' : ''}`;
  return html`<button type="button" class="picker-item lo-choice" data-choose="${item.id}" aria-current="${slotValue(slot) === item.id}">${thumb(item.id, 36)}<span>${personal ? displayName(item) : item.name}<small>${sub}</small></span></button>`;
}

function pickerList(slot, q) {
  // A search looks through every kind; otherwise the chosen chip narrows the list.
  let groups = pickerGroups(slot);
  if (q) groups = groups.map(group => ({ ...group, items: search(group.items, q, group.fields) })).filter(group => group.items.length);
  else if (picker.kind) groups = groups.filter(group => group.id === picker.kind);
  if (!groups.length) return html`<p class="empty" style="padding:24px 8px">${L('찾는 항목이 없습니다.', 'Nothing found.')}</p>`;
  return groups.map(group => html`<section class="lo-choice-group" style="${group.color ? `--fc:${group.color}` : ''}"><div class="picker-group">${group.name} · ${group.items.length}</div>${group.items.map(item => choiceButton(slot, item))}</section>`);
}

function kindChips(slot) {
  const groups = pickerGroups(slot);
  return html`<button type="button" class="chip" data-kind="" aria-pressed="${!picker.kind}">${L('전체', 'All')}</button>${groups.map(group => html`<button type="button" class="chip" data-kind="${group.id}" aria-pressed="${picker.kind === group.id}" style="${group.color ? `--dot:${group.color}` : ''}">${group.color ? html`<span class="dot"></span>` : ''}${group.name} <span class="count">${group.items.length}</span></button>`)}`;
}

function openPicker(slot) {
  const { ctx } = env;
  picker.kind = '';
  ctx.openSheet(html`<div class="sheet-top"><span>${L(`${slot.label} 고르기`, `Choose: ${slot.label}`)}</span><button class="icon-button" type="button" data-close aria-label="${L('닫기', 'Close')}">${icon('close', 18)}</button></div>
    <div class="sheet-content lo-picker">
      <h2 id="sheet-title" style="font-size:20px">${slot.label}</h2>
      ${slot.stratagem != null ? html`<p class="muted">${L('지원 무기 스트라타젬만 적 대응 계산에 들어갑니다. 나머지는 로드아웃에 담기만 합니다.', 'Only support weapon stratagems are included in the shots-to-kill check; the rest are just part of the loadout.')}</p>` : ''}
      <label class="field">${icon('search', 16)}<span class="sr-only">${L('검색', 'Search')}</span><input class="input" id="lo-q" type="search" placeholder="${L('이름·코드 검색 — 초성도 됩니다', 'Search by name or code')}" autocomplete="off"></label>
      <div class="chips lo-kinds" id="lo-kinds" role="group" aria-label="${L('종류', 'Kind')}">${kindChips(slot)}</div>
      <div class="lo-choices" id="lo-choices">${pickerList(slot, '')}</div>
    </div>`, { label: L(`${slot.label} 고르기`, `Choose: ${slot.label}`) });
  const sheet = $('#sheet');
  const input = $('#lo-q', sheet);
  const refresh = () => {
    render($('#lo-choices', sheet), pickerList(slot, input.value));
    $('#lo-kinds', sheet).hidden = Boolean(input.value);
    for (const chip of $$('[data-kind]', sheet)) chip.setAttribute('aria-pressed', String(chip.dataset.kind === picker.kind));
  };
  input.addEventListener('input', refresh);
  $('#lo-kinds', sheet).addEventListener('click', event => {
    const chip = event.target.closest('[data-kind]');
    if (!chip) return;
    picker.kind = chip.dataset.kind;
    refresh();
  });
  $('#lo-choices', sheet).addEventListener('click', event => {
    const choice = event.target.closest('[data-choose]');
    if (!choice) return;
    setSlot(slot, choice.dataset.choose);
    ctx.closeSheet();
  });
  setTimeout(() => input.focus({ preventScroll: true }), 50);
}

function setSlot(slot, id) {
  if (slot.stratagem != null) env.loadout.st[slot.stratagem] = id;
  else env.loadout[slot.key] = id;
  env.onChange();
}

// --- Coverage ----------------------------------------------------------------------
const hitsText = (answer) => answer?.hits != null ? L(`${num(answer.hits)}${answer.unit || '발'}${answer.lowerBound ? '+' : ''}`, `${num(answer.hits)}${answer.lowerBound ? '+' : ''}${unitText(answer.unit, answer.hits)}`) : '';
const ASSUMED_NOUN = L({ pellets: '펠릿', arcs: '전격', bomblets: '자탄', shrapnel: '파편' }, { pellets: 'pellets', arcs: 'arcs', bomblets: 'bomblets', shrapnel: 'fragments' });
const magsText = answer => answer?.magazinesNeeded > 1 ? L(`탄창 ${num(answer.magazinesNeeded)}개`, `${num(answer.magazinesNeeded)} magazines`) : '';

function assumedNote(answer) {
  if (answer.fragmentsExcluded) return L(' · 파편 제외', ' · no shrapnel');
  if (answer.defaultAssumed) {
    const noun = ASSUMED_NOUN[answer.defaultAssumed.kind], pct = answer.defaultAssumed.pct ?? Math.round(answer.defaultAssumed.count / answer.defaultAssumed.max * 100);
    return L(` · ${noun || '명중'} ${pct}% 가정`, ` · ${pct}% ${noun || 'hits'} assumed`);
  }
  return answer.allPelletsAssumed ? L(' · 펠릿 전부 명중', ' · all pellets hit') : answer.assumption ? L(' · 명중 수 가정', ' · assumed hits') : '';
}

function answerLine(answer) {
  if (!answer) return html`<span class="faint">—</span>`;
  const outcome = answer.outcome ? outcomeOf({ outcome: answer.outcome, target: { resultLabel: answer.resultLabel } }) : null;
  return html`<span class="lo-answer">${thumb(answer.weaponId, 28)}<span><b>${nameOf(answer.weaponId)}</b>${answer.modeName ? html` <small>${answer.modeName}</small>` : ''}<br>
    <small>${answer.partName || ''}${answer.hits != null ? ` · ${hitsText(answer)}` : ''}${magsText(answer) ? ` · ${magsText(answer)}` : ''}${assumedNote(answer)}</small></span>${outcome ? badge(outcome.label, outcome.tone) : ''}${answer.conditional ? badge(L('조건부', 'Conditional'), 'conditional') : ''}</span>`;
}

function coverageSection(result, faction) {
  const rows = result.rows || [];
  const gaps = rows.filter(row => row.status !== 'route');
  // Large enemies the loadout cannot finish in one hit come right after the gaps.
  const heavy = rows.filter(row => row.status === 'route' && row.isLarge && !row.oneShot);
  const covered = rows.filter(row => row.status === 'route' && !heavy.includes(row));
  return html`<div class="lo-summary">
      <div class="lo-score"><b>${covered.length + heavy.length}</b><span>/ ${rows.length} ${L('대응', 'covered')}</span></div>
      <p>${L(html`${faction.name} 주요 적 ${rows.length}종 중 <b>${covered.length + heavy.length}종</b>은 현재 로드아웃으로 확인된 처치 경로가 있습니다.${gaps.length ? html` <b style="color:var(--blocked)">${gaps.length}종</b>은 현재 계산 범위에서 처치 경로가 없습니다.` : ' 공백이 없습니다.'}${heavy.length ? html` 대형 적 <b style="color:var(--bleed)">${heavy.length}종</b>은 한 발에 처치하지 못합니다.` : ''}`,
        html`This loadout has a verified kill route for <b>${covered.length + heavy.length}</b> of ${rows.length} key ${faction.name} enemies.${gaps.length ? html` <b style="color:var(--blocked)">${gaps.length}</b> have no kill route within what the calculator covers.` : ' No gaps.'}${heavy.length ? html` <b style="color:var(--bleed)">${heavy.length}</b> large ${heavy.length === 1 ? 'enemy is' : 'enemies are'} not one-shot.` : ''}`)}</p>
    </div>
    ${gaps.length ? html`<div class="section-title"><h2>${L('대응 공백', 'Gaps')}</h2><p>${L('로드아웃 안의 계산 가능한 무기로는 확인된 처치 경로가 없는 적입니다.', 'Enemies no calculated weapon in the loadout has a verified kill route for.')}</p></div>
      <div class="lo-rows">${gaps.map(row => gapCard(row))}</div>` : ''}
    ${heavy.length ? html`<div class="section-title"><h2>${L('대형 적 · 한 발에 처치 불가', 'Large enemies · no one-shot')}</h2><p>${L('처치는 되지만 여러 발이 필요한 대형·초대형 적입니다. 한 발에 처치하는 장비가 있으면 훨씬 안전합니다.', 'Large and massive enemies you can kill, but only with several shots. Something that one-shots them is much safer.')}</p></div>
      <div class="lo-rows">${heavy.map(row => html`<article class="panel lo-row heavy">${enemyHead(row)}<div class="lo-row-body">${answerLine(row.best)}${alsoLine(row)}</div></article>`)}</div>` : ''}
    <div class="section-title"><h2>${L('적별 대응', 'By enemy')}</h2><p>${L('각 적을 가장 적은 횟수로 처치하는 로드아웃 속 무기입니다. 연사력·재장전·조준 난도는 반영하지 않습니다.', 'The weapon in your loadout that kills each enemy in the fewest shots. Fire rate, reloads and aiming difficulty are not included.')}</p></div>
    <div class="lo-rows">${covered.map(row => coveredCard(row))}</div>
    ${result.notComputable?.length ? html`<p class="faint" style="font-size:13px;margin-top:12px">${L('계산하지 않은 로드아웃 항목:', 'Loadout items not calculated:')} ${result.notComputable.map(item => `${T(nameOf(item.id))}${item.reason ? ` (${T(item.reason)})` : ''}`).join(' · ')}</p>` : ''}`;
}

function enemyHead(row) {
  const image = pickerEnemyImages[row.enemyId]?.src;
  const size = row.isLarge ? html`<em class="size-tag" data-size="${row.size}">${SIZE_NAMES[row.size]}</em>` : '';
  return html`<a class="lo-enemy" href="#/enemy/${row.enemyId}" title="${L('적 대응에서 자세히 보기', 'Open in Enemies')}">${image ? html`<img src="${image}" alt="" loading="lazy" decoding="async">` : html`<span></span>`}<b>${row.enemyName}</b>${size}</a>`;
}

// Other loadout slots that also answer this enemy, so a rifle that handles
// small enemies shows up even when a stratagem needs fewer hits.
function alsoLine(row) {
  const others = (row.perSlot || []).map(entry => entry.best)
    .filter(answer => answer?.status === 'route' && answer.weaponId !== row.best?.weaponId)
    .sort((a, b) => a.hits - b.hits);
  if (!others.length) return '';
  return html`<div class="lo-also"><small>${L('그 밖에', 'Also')}</small>${others.map(answer => html`<span class="lo-also-item">${thumb(answer.weaponId, 18)}${nameOf(answer.weaponId)} <b>${answer.partName} ${hitsText(answer)}</b></span>`)}</div>`;
}

function coveredCard(row) {
  const single = row.isLarge && row.oneShot;
  return html`<article class="panel lo-row ${single ? 'one-shot' : ''}">${enemyHead(row)}<div class="lo-row-body">${single ? html`<span class="one-shot-badge">${L('한 발 처치', 'One-shot')}</span>` : ''}${answerLine(row.best)}${alsoLine(row)}</div></article>`;
}

// Suggestions arrive per slot; a stratagem appears once, aimed at the first
// empty stratagem slot (or the first slot when all four are taken).
function fixGroups(row) {
  const emptyIndex = env.loadout.st.findIndex(id => !id);
  const seen = new Set();
  const groups = new Map();
  for (const fix of row.fixes || []) {
    if (seen.has(fix.weaponId)) continue;
    seen.add(fix.weaponId);
    const stratagem = /^st\d$/.test(fix.slot);
    const slot = stratagem ? `st${emptyIndex >= 0 ? emptyIndex : 0}` : fix.slot;
    const title = stratagem ? (emptyIndex >= 0 ? L('스트라타젬 추가', 'Add a stratagem') : L('스트라타젬 1 교체', 'Replace stratagem 1')) : L(`${SLOTS.find(item => item.key === fix.slot)?.label || ''} 교체`, `Replace ${(SLOTS.find(item => item.key === fix.slot)?.label || '').toLowerCase()}`);
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title).push({ ...fix, slot });
  }
  return [...groups];
}

function gapCard(row) {
  const groups = fixGroups(row);
  return html`<article class="panel lo-row gap">${enemyHead(row)}
    <div class="lo-gap-body"><span class="badge blocked">${L('처치 경로 없음', 'No kill route')}</span>
      ${groups.length ? html`<div class="lo-fixes"><small>${L('이렇게 바꾸면 대응 — 누르면 로드아웃에 반영됩니다', 'These swaps would cover it — tap one to apply it')}</small>${groups.map(([title, fixes]) => html`<div class="lo-fix-group"><span>${title}</span>${fixes.map(fix => html`<button type="button" class="chip lo-fix" data-fix-slot="${fix.slot}" data-fix-id="${fix.weaponId}">${thumb(fix.weaponId, 20)} ${nameOf(fix.weaponId)} <span class="count">${fix.partName ? `${T(fix.partName)} ` : ''}${hitsText(fix)}</span></button>`)}</div>`)}</div>`
        : html`<small class="faint">${L('같은 칸에서 바꿔 끼워 해결되는 후보가 없습니다.', 'No swap in the same slot fixes this.')}</small>`}
    </div></article>`;
}

// --- Render ------------------------------------------------------------------------
export async function renderLoadout(panel, options) {
  env = options; panelEl = panel;
  if (!core) core = await import('../../core/loadout.js');
  const factions = core.loadoutFactions;
  if (!factions.some(f => f.id === env.loadout.f)) env.loadout.f = factions[0].id;
  const faction = factions.find(f => f.id === env.loadout.f);
  const anyPicked = ['p', 's', 'g'].some(key => env.loadout[key]) || env.loadout.st.some(Boolean);
  const result = anyPicked ? core.loadoutView(env.loadout, faction.id, { shieldCleared: env.loadout.shield !== false }) : null;
  render(panel, html`
    <section class="panel lo-builder">
      <div class="lo-slots">${SLOTS.map(slotTile)}</div>
      <div class="lo-actions">
        <div class="segmented" role="group" aria-label="${L('팩션', 'Faction')}">${factions.map(f => html`<button type="button" data-lo-faction="${f.id}" aria-pressed="${f.id === faction.id}" data-side="${f.id}">${f.name}</button>`)}</div>
        <label class="check lo-shield"><input type="checkbox" data-lo-shield ${env.loadout.shield !== false ? raw('checked') : ''}> ${L('방패·보호막을 피한 상태로 계산', 'Assume shields are out of the way')}</label>
        <span style="flex:1"></span>
        <button type="button" class="button small" data-lo-share ${anyPicked ? '' : 'disabled'}>${icon('arrow', 16)} ${L('로드아웃 링크 복사', 'Copy loadout link')}</button>
        <button type="button" class="button small ghost" data-lo-reset ${anyPicked ? '' : 'disabled'}>${L('비우기', 'Clear')}</button>
      </div>
    </section>
    ${result ? coverageSection(result, faction) : html`<div class="empty lo-empty"><h3>${L('장비를 골라 로드아웃을 짜 보세요', 'Build a loadout')}</h3><p>${L(html`칸을 눌러 무기와 스트라타젬을 담으면, ${faction.name} 주요 적마다 어떤 장비로 몇 번 만에 처치할 수 있는지와 대응 공백을 보여 줍니다.`, html`Tap a slot to add weapons and stratagems. You will see what kills each key ${faction.name} enemy in how many shots, and where the gaps are.`)}</p></div>`}
    <p class="faint" style="font-size:12.5px;margin-top:14px">${L('서로 다른 무기를 섞어 쓰는 연계는 계산하지 않습니다. "처치 경로 없음"은 현재 계산 범위의 결과이며, 실제로 처치할 수 없다는 뜻은 아닙니다.', 'Combos that mix different weapons are not calculated. "No kill route" reflects what the calculator covers, not that the enemy cannot be killed.')}</p>`);
  bind(panel);
}

function bind(panel) {
  if (panel.dataset.bound) return;
  panel.dataset.bound = '1';
  panel.addEventListener('change', event => {
    if (!event.target.matches('[data-lo-shield]') || !env) return;
    env.loadout.shield = event.target.checked;
    env.onChange();
  });
  panel.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target || !env) return;
    const slot = SLOTS.find(item => item.key === (target.dataset.slot || target.dataset.clear || target.dataset.fixSlot));
    if (target.dataset.slot) openPicker(slot);
    else if (target.dataset.clear) setSlot(slot, '');
    else if (target.dataset.fixSlot) setSlot(slot, target.dataset.fixId);
    else if (target.dataset.loFaction) { env.loadout.f = target.dataset.loFaction; env.onChange(); }
    else if (target.hasAttribute('data-lo-reset')) { Object.assign(env.loadout, { p: '', s: '', g: '', st: ['', '', '', ''] }); env.onChange(); }
    else if (target.hasAttribute('data-lo-share')) {
      navigator.clipboard?.writeText(location.href).then(() => env.ctx.toast(L('로드아웃 링크를 복사했습니다.', 'Loadout link copied.')), () => env.ctx.toast(L('주소창의 링크를 복사해 공유하세요.', 'Copy the link from the address bar to share it.')));
    }
  });
}

// Enemy-first combat view: pick an enemy, see every weapon of a group (support,
// primary, secondary, throwable) ranked by its quickest verified route, then open
// any weapon for part-by-part detail.
import { enemies, weaponProfiles, unsupportedWeapons, combatCheckedAt, damageSource } from '../../data/combat-data.js';
import { personalProfiles, personalUnsupported } from '../../core/personal-combat.js';
import { personalWeapons } from '../../data/personal-weapons.js';
import { weaponImages } from '../../data/weapon-images.js';
import { pickerEnemyImages } from '../../data/selector-images.js';
import { combatImages } from '../../data/combat-images.js';
import { wikiIcons } from '../../data/wiki-icons.js';
import { stratagems, stratagemById } from '../../core/catalog.js';
import { solveMatchup, withHitAssumption, spearCannotLock, partPool, isFatal, FATAL } from '../../core/combat.js';
import { compareAttacks } from '../../core/compare.js';
import { enemySize, isLargeEnemy, SIZE_NAMES } from '../../core/enemy-size.js';
import { solveAccumulation, noFatalPart } from '../../core/accumulate.js';
import { wikiReference } from '../../core/factions.js';
import { search } from '../../core/search.js';
import { num, pct, unitOf, outcomeOf, countText, attackStats, assumptionText, aimText, routeNotes, assumptionSummary, assumptionTag, deliveryOf, josa, stageName } from '../../core/explain.js';
import { html, raw, render, $, $$, icon, badge, external } from '../dom.js';
import { L, T, lang } from '../../core/i18n.js';
import { displayName } from '../gear-shared.js';

const FACTIONS = ['테르미니드', '오토마톤', '일루미닛'];
const DEFAULT_ENEMY = 'charger';
const supportWeapons = stratagems.filter(item => item.category === 'support' && (weaponProfiles[item.id] || unsupportedWeapons[item.id]));
const GROUPS = [
  { id: 'support', name: L('지원 무기', 'Support'), link: id => `#/arsenal/${id}`, linkLabel: L('도감에서 보기', 'Open in Stratagems') },
  { id: 'primary', name: L('주무기', 'Primary'), link: id => `#/gear/${id}`, linkLabel: L('장비에서 보기', 'Open in Gear') },
  { id: 'secondary', name: L('보조무기', 'Secondary'), link: id => `#/gear/${id}`, linkLabel: L('장비에서 보기', 'Open in Gear') },
  { id: 'throwable', name: L('투척', 'Throwable'), link: id => `#/gear/${id}`, linkLabel: L('장비에서 보기', 'Open in Gear') },
];
const personalEntry = w => ({ id: w.id, name: displayName(w), code: w.code, source: w.source, group: w.category });
const weaponsOf = {
  support: supportWeapons.map(item => ({ ...item, group: 'support' })),
  ...Object.fromEntries(['primary', 'secondary', 'throwable'].map(group => [group, personalWeapons.filter(w => w.category === group && (personalProfiles[w.id] || personalUnsupported[w.id])).map(personalEntry)])),
};
const weaponById = new Map(Object.values(weaponsOf).flat().map(weapon => [weapon.id, weapon]));
const profileOf = id => weaponProfiles[id] || personalProfiles[id];
const unsupportedOf = id => unsupportedWeapons[id] || personalUnsupported[id];
const groupOf = id => GROUPS.find(group => group.id === id);
// Large and massive enemies call out weapons that finish them in a single hit.
const oneShot = entry => entry.status === 'route' && entry.best?.hits === 1 && isFatal(entry.best) && !entry.best.lowerBound;
// Enemies without a fatal part die from damage piled onto the main body across
// several parts; such routes come from solveAccumulation (parts one after another).
const stepName = step => L(step.partName.replace(/ 한 ?(개|쪽)$/, ''), T(step.partName).replace(/^One /, ''));
const stepsLabel = acc => acc.steps.map(step => L(`${stepName(step)} ${step.instances}개`, `${stepName(step)} ×${step.instances}`)).join(' → ');
const accumulatedBest = acc => ({ hits: acc.hits, outcome: acc.outcome, target: { name: stepsLabel(acc) }, stages: [], notes: [], accumulated: acc });
const sizeTag = enemy => { const size = enemySize(enemy); return size === 'large' || size === 'massive' ? html`<em class="size-tag" data-size="${size}">${SIZE_NAMES[size]}</em>` : ''; };
const enemyById = new Map(enemies.map(enemy => [enemy.id, enemy]));

let root, ctx;
const MAX_COMPARE = 3;
const compare = { picks: [], part: '' }; // [{ weaponId, modeId }] kept across enemies
// Only the hit count starts blank; primary-hit options fall back to each mode's
// own defaults (e.g. W.A.S.P. counts sub-missile hits, not the parent blast).
const DEFAULT_ASSUME = { hitCount: '' };
const state = { enemy: DEFAULT_ENEMY, group: 'support', weapon: null, mode: null, shield: true, faction: '', q: '', assume: { ...DEFAULT_ASSUME }, pickerOpen: false };
// Until the player picks a count, modes with a conservative default use it.
// Every multi-hit attack shows a hit-rate slider. Aimed hits (pellets, arcs)
// start at 100 %, scattering bomblets and fragments at 20 %; the data's own
// default wins when present.
const HIT_KINDS = {
  pellets: { noun: L('펠릿', 'pellets'), unit: L('개', ''), per: L('한 발에', 'per shot'), pct: 100, why: L('기본은 펠릿이 모두 맞는다고 계산합니다. 거리가 멀거나 조준이 어긋나면 일부만 맞으니, 명중률을 낮춰 다시 볼 수 있습니다.', 'By default every pellet hits. At range or with a stray aim only some land, so lower the hit rate to see the difference.') },
  arcs: { noun: L('전격', 'arcs'), unit: L('회', ''), per: L('한 발에', 'per shot'), pct: 100, why: L('기본은 전격이 모두 이 적에게 닿는다고 계산합니다(위키 피해 수치와 같은 기준). 주변 적에게 튀면 일부만 맞습니다.', 'By default every arc reaches this enemy (the same basis as the wiki damage numbers). Arcs that jump to nearby enemies mean fewer hits.') },
  bomblets: { noun: L('자탄', 'bomblets'), unit: L('개', ''), per: L('한 발에', 'per shot'), pct: 20, why: L('자탄은 넓게 흩어져 한 부위에 다 맞는 일이 드물어 기본은 20%로 계산합니다. 0%는 주탄만 계산합니다.', 'Bomblets scatter widely and rarely all hit one part, so the default is 20%. 0% counts the main projectile only.') },
  shrapnel: { noun: L('파편', 'fragments'), unit: L('개', ''), per: L('폭발 1회에', 'per explosion'), pct: 20, why: L('파편은 사방으로 흩어져 기본은 20%로 계산합니다. 0%로 두면 파편을 빼고 직격·폭발만 계산합니다.', 'Fragments fly in every direction, so the default is 20%. At 0% only the impact and explosion are counted.') },
};
const hitCount = (c, pct) => pct <= 0 && c.min === 0 ? 0 : Math.max(c.min, Math.round(c.max * pct / 100));
// The slider shows the 10 % step that yields this count, preferring the data's
// default percentage (7 sub-missiles at 20 % is 1, which is also what 10 % gives).
const hitPct = (c, count) => {
  const n = Number(count), low = c.min === 0 ? 0 : 10;
  const pctDefault = c.defaultPct ?? HIT_KINDS[c.kind]?.pct;
  if (pctDefault != null && hitCount(c, pctDefault) === n) return pctDefault;
  const steps = Array.from({ length: (100 - low) / 10 + 1 }, (_, i) => low + i * 10).filter(pct => hitCount(c, pct) === n);
  return steps.length ? steps[0] : Math.min(100, Math.max(low, Math.round(n / c.max * 10) * 10));
};
const defaultCount = mode => {
  const c = mode?.hitCondition;
  if (!c) return null;
  return c.default ?? (HIT_KINDS[c.kind] ? hitCount(c, HIT_KINDS[c.kind].pct) : null);
};
const effectiveAssume = mode => state.assume.hitCount === '' && defaultCount(mode) != null
  ? { ...state.assume, hitCount: String(defaultCount(mode)) } : state.assume;
const defaultLabel = mode => {
  const c = mode?.hitCondition, kind = HIT_KINDS[c?.kind];
  if (!kind) return L('기본 명중 수 가정', 'Default hit assumption');
  const pct = hitPct(c, defaultCount(mode));
  return pct === 100 ? L(`${kind.noun} 전부 명중 가정`, `All ${kind.noun} hit (assumed)`) : pct === 0 ? L(`${kind.noun} 제외`, `No ${kind.noun}`) : L(`${kind.noun} ${pct}% 명중 가정`, `${pct}% of ${kind.noun} hit (assumed)`);
};
// Short note for answers built on an assumed hit count (comparison table).
const assumedText = answer => {
  if (answer.fragmentsExcluded) return L(' · 파편 제외', ' · no shrapnel');
  if (answer.defaultAssumed) {
    const noun = HIT_KINDS[answer.defaultAssumed.kind]?.noun, pct = answer.defaultAssumed.pct ?? Math.round(answer.defaultAssumed.count / answer.defaultAssumed.max * 100);
    return L(` · ${noun || '명중'} ${pct}% 가정`, ` · ${pct}% ${noun || 'hits'} assumed`);
  }
  return answer.allPelletsAssumed ? L(' · 펠릿 전부 명중', ' · all pellets hit') : answer.assumption ? L(' · 명중 수 가정', ' · assumed hits') : '';
};
const countLine = (c, count) => { const kind = HIT_KINDS[c.kind]; return L(`${kind.per} ${kind.noun} ${c.max}${kind.unit} 중 ${count}${kind.unit}가 이 부위에 명중`, `${count} of ${c.max} ${kind.noun} ${kind.per} hit this part`); };


const PRIMARY_HITS = [['blast', L('주탄 폭발만', 'Main projectile explosion only')], ['direct', L('주탄 직격 + 폭발', 'Main projectile impact + explosion')], ['none', L('주탄 피해 없음', 'No main projectile damage')]];

// --- Ranking ----------------------------------------------------------------------
const rankCache = new Map();
function rankWeapons(enemy, shieldCleared, group = state.group) {
  const key = `${enemy.id}|${shieldCleared}|${group}`;
  if (rankCache.has(key)) return rankCache.get(key);
  const entries = weaponsOf[group].map((weapon, order) => {
    const profile = profileOf(weapon.id);
    if (!profile) return { weapon, order, status: 'unsupported', reason: unsupportedOf(weapon.id) };
    const tries = profile.modes.map(mode => {
      if (mode.unsupported) return { mode, status: 'unsupported', reason: mode.unsupported };
      // A conservative default (e.g. no fragments) still ranks; others wait for a choice.
      const fallback = defaultCount(mode);
      if (mode.hitCondition && fallback == null) return { mode, status: 'assume' };
      const solved = fallback == null ? mode : withHitAssumption(mode, { ...DEFAULT_ASSUME, hitCount: String(fallback) });
      const { best, rows } = solveMatchup(enemy, solved, { shieldCleared });
      if (!best && noFatalPart(enemy)) {
        const acc = solveAccumulation(enemy, solved, { shieldCleared });
        if (acc) return { mode, status: 'route', best: accumulatedBest(acc), rows, defaulted: fallback != null };
      }
      return { mode, status: best ? 'route' : 'none', best, rows, defaulted: fallback != null };
    });
    const routes = tries.filter(item => item.status === 'route').sort((a, b) => a.best.hits - b.best.hits || Number(a.best.outcome !== 'kill') - Number(b.best.outcome !== 'kill'));
    const pick = routes[0] || tries.find(item => item.status === 'assume') || tries.find(item => item.status === 'none') || tries[0];
    return { weapon, order, profile, ...pick, spear: spearCannotLock(enemy, pick.mode), reference: wikiReference(enemy, weapon.id, pick.mode) };
  });
  const tier = entry => ({ route: 0, assume: 1, none: 2, unsupported: 3 })[entry.status];
  entries.sort((a, b) => tier(a) - tier(b) || (a.status === 'route' ? a.best.hits - b.best.hits || Number(a.best.outcome !== 'kill') - Number(b.best.outcome !== 'kill') : 0) || a.order - b.order);
  rankCache.set(key, entries);
  return entries;
}

// --- Pieces -------------------------------------------------------------------------
const portrait = (enemy, cls = '', eager = false) => {
  const image = pickerEnemyImages[enemy.id];
  return image?.src ? html`<img class="${cls}" src="${image.src}" alt="" loading="${eager ? 'eager' : 'lazy'}" decoding="async">` : html`<span class="${cls}"></span>`;
};
const weaponIcon = (id, size = 34) => weaponImages[id]
  ? html`<span class="w-thumb" style="width:${size}px;height:${size}px"><img src="${weaponImages[id].src}" alt="" loading="lazy" decoding="async"></span>`
  : html`<img class="strat-icon" style="width:${size}px;height:${size}px" src="${wikiIcons[id]?.src}" alt="" width="${size}" height="${size}" loading="lazy">`;

function renderPicker() {
  const q = state.q;
  let list = enemies.filter(enemy => !state.faction || enemy.faction === state.faction);
  if (q) list = search(list, q, enemy => ({ names: [enemy.name, T(enemy.name), enemy.id.replaceAll('-', ' ')], text: [enemy.faction, T(enemy.faction)] }));
  const groups = q ? [[L('검색 결과', 'Results'), list]] : FACTIONS.map(faction => [faction, list.filter(enemy => enemy.faction === faction)]).filter(([, items]) => items.length);
  render($('#enemy-list', root), groups.length && list.length ? groups.map(([name, items]) => html`
    <div class="picker-group" data-faction="${name}">${name} · ${items.length}</div>
    ${items.map(enemy => html`<button class="picker-item" type="button" data-enemy="${enemy.id}" aria-current="${enemy.id === state.enemy}">${portrait(enemy)}<span>${enemy.name}${sizeTag(enemy)}${enemy.id.startsWith('voteless-') ? html`<small>${L('체형별 수치 · 공통 이미지', 'Stats per build · shared image')}</small>` : ''}</span></button>`)}`)
    : html`<p class="empty" style="padding:24px 8px">${L('찾는 적이 없습니다.', 'No enemy found.')}</p>`);
  for (const button of $$('[data-faction-filter]', root)) button.setAttribute('aria-pressed', String(button.dataset.factionFilter === state.faction));
  $('.picker', root).classList.toggle('collapsed', !state.pickerOpen);
  $('#picker-current', root).textContent = T(enemyById.get(state.enemy).name);
}

function hero(enemy) {
  const m = enemy.main;
  const vitals = [
    [L('본체 체력', 'Main health'), num(m.hp)], [L('본체 장갑', 'Main armor'), m.armor], [L('내구도', 'Durability'), pct(m.durability)], [L('폭발 저항', 'Explosive resistance'), pct(m.exdr)],
    ...(m.constitution ? [[L('출혈 여유', 'Bleed-out health'), num(m.constitution)]] : []),
  ];
  return html`<section class="panel enemy-hero" data-faction="${enemy.faction}">
    ${portrait(enemy, '', true)}
    <div><span class="faction-tag">${enemy.faction}</span>${sizeTag(enemy)}<h1>${enemy.name}</h1>
      <div class="vitals">${vitals.map(([label, value]) => html`<span>${label}<b>${value}</b></span>`)}</div>
      <p class="note">${enemy.note}</p>
      <p class="sources">${external(enemy.source, L('위키 항목', 'Wiki page'))}</p>
    </div>
  </section>
  ${enemy.shield ? html`<label class="toggle" style="margin-top:12px"><input type="checkbox" data-shield ${state.shield ? raw('checked') : ''}>
    <div><b>${icon('shield', 16)} ${enemy.shield.label || (enemy.shield.kind === 'energy' ? L('보호막을 제거한 상태로 계산', 'Calculate with the shield down') : L('방패를 피해 부위에 닿는 상태로 계산', 'Calculate hits that get past the shield'))}</b>
    <span>${enemy.shield.kind === 'energy' ? L('보호막', 'Shield') : L('방패', 'Shield')} ${enemy.shield.infiniteHealth ? L('파괴 불가', 'indestructible') : L(`체력 ${num(enemy.shield.hp)}`, `health ${num(enemy.shield.hp)}`)}${Number.isFinite(enemy.shield.armor) ? L(` · 장갑 ${enemy.shield.armor}`, ` · armor ${enemy.shield.armor}`) : ''}. ${enemy.shield.note} ${L('제거·우회에 드는 공격은 횟수에 포함하지 않습니다.', 'Attacks spent removing or getting around it are not counted.')}</span></div></label>` : ''}`;
}

// The quickest kill that needs a prerequisite first (e.g. the Impaler's face
// exposed). It never counts as the verified route, but players should see it.
const conditionalBest = entry => (entry.rows || []).filter(row => row.conditional && FATAL.includes(row.outcome) && row.hits != null)
  .sort((a, b) => a.hits - b.hits)[0] || null;
const conditionalText = (row, mode) => L(`${row.target.prerequisite}: ${row.target.name} ${num(row.hits)}${unitOf(mode, row.hits).unit}`,
  `${T(row.target.prerequisite)}: ${T(row.target.name)} ${num(row.hits)}${unitOf(mode, row.hits).unit}`);

function rankRow(entry, selected, large = false, noFatal = false) {
  const { weapon, status } = entry;
  const single = large && oneShot(entry);
  const unit = unitOf(entry.mode, entry.best?.hits).unit;
  const multi = entry.profile?.modes.length > 1;
  const conditional = conditionalBest(entry);
  let part = '', hits = html`<span class="hits dim">—</span>`, tag = '';
  if (status === 'route') {
    const outcome = outcomeOf(entry.best);
    const aside = entry.reference ? L(`위키 전술: ${entry.reference.target} ${entry.reference.hits}${unit}`, `Wiki tactic: ${T(entry.reference.target)} ${entry.reference.hits}${unitOf(entry.mode, entry.reference.hits).unit}`)
      : entry.spear ? L('직접 락온 불가 · 참고값', 'No direct lock-on · reference only')
      : entry.best.accumulated ? L('누적 처치 · 덩어리를 차례로 터뜨림', 'Cumulative kill · pop the lumps in turn')
      : conditional && conditional.hits < entry.best.hits ? conditionalText(conditional, entry.mode)
      : entry.defaulted ? defaultLabel(entry.mode) : assumptionTag(entry.mode);
    part = html`<span>${entry.best.target.name}</span>${aside ? html`<small>${aside}</small>` : ''}`;
    hits = html`<span class="hits">${num(entry.best.hits)}<small>${unit}${entry.best.lowerBound ? '+' : ''}</small></span>`;
    tag = badge(outcome.label, outcome.tone);
  } else if (status === 'assume') {
    part = html`<span class="faint">${L('명중 수 가정 필요', 'Pick a hit assumption')}</span>`; tag = badge(L('가정 선택', 'Assumption'), 'unknown');
  } else if (status === 'none' && conditional) {
    part = html`<span>${conditional.target.name}</span><small>${L(`${conditional.target.prerequisite}에만`, `Only ${T(conditional.target.prerequisite).replace(/^./, c => c.toLowerCase())}`)}</small>`;
    hits = html`<span class="hits">${num(conditional.hits)}<small>${unitOf(entry.mode, conditional.hits).unit}</small></span>`;
    tag = badge(L('선행 조건', 'Prerequisite'), 'conditional');
  } else if (status === 'none') {
    const blocked = entry.rows.every(row => ['blocked', 'shield'].includes(row.outcome) || row.hits != null);
    const pierces = entry.rows.some(row => row.hits != null);
    if (noFatal && pierces) { part = html`<span class="faint">${L('치명 부위 없음 · 여러 부위에 피해를 쌓아야 함', 'No fatal part · damage has to build up over several parts')}</span>`; tag = badge(L('누적 필요', 'Cumulative'), 'conditional'); }
    else { part = html`<span class="faint">${blocked ? L('확인된 처치 경로 없음', 'No verified kill route') : L('일부 부위 자료 미확인', 'Some part data unverified')}</span>`; tag = badge(blocked ? L('처치 경로 없음', 'No kill route') : L('계산 보류', 'Not calculated'), blocked ? 'blocked' : 'unknown'); }
  } else {
    part = html`<span class="faint">${L('정밀 계산 미지원', 'Not supported yet')}</span>`; tag = badge(L('미지원', 'Unsupported'), 'unknown');
  }
  if (single) hits = html`<span class="hits one-shot-hits" title="${L('한 발 처치', 'One-shot kill')}">1<small>${unitOf(entry.mode, 1).unit}</small></span>`;
  return html`<button class="rank-row ${single ? 'one-shot' : ''}" type="button" data-weapon="${weapon.id}" data-mode="${entry.mode?.id || ''}" aria-current="${selected}" aria-expanded="${selected}">
    ${weaponIcon(weapon.id)}
    <span class="w"><b>${weapon.name}</b><small>${multi || entry.mode?.id !== 'standard' ? entry.mode?.name || '' : lang === 'en' && T(weapon.name).startsWith(weapon.code) ? '' : weapon.code || ''}</small></span>
    <span class="part">${part}</span>${hits}${tag}
  </button>`;
}

// The selected weapon's part-by-part calculation opens right under its row.
function ranking(enemy, entries, selectedId, detail) {
  const main = entries.filter(entry => entry.status === 'route' || entry.status === 'assume');
  const rest = entries.filter(entry => !main.includes(entry));
  const large = isLargeEnemy(enemy);
  const noFatal = noFatalPart(enemy);
  const singles = large ? entries.filter(oneShot).length : 0;
  const row = entry => entry.weapon.id === selectedId
    ? html`${rankRow(entry, true, large, noFatal)}<div class="rank-detail">${detail}</div>`
    : rankRow(entry, false, large, noFatal);
  return html`<div class="section-title"><h2>${L('무기별 최소 횟수', 'Fewest shots by weapon')}</h2><p>${L(`${groupOf(state.group).name} ${entries.length}종 · 가장 빠른 확인된 경로 기준. 연사력·재장전·조준 난도는 반영하지 않습니다. 무기를 누르면 바로 아래에 부위별 계산이 열립니다.`, `${entries.length} ${groupOf(state.group).name.toLowerCase()} weapons · ranked by their quickest verified route. Fire rate, reloads and aiming difficulty are not included. Tap a weapon to open its part-by-part calculation right below.`)}</p></div>
  ${large ? html`<div class="one-shot-note ${singles ? '' : 'none'}">${L(singles ? html`<b>${SIZE_NAMES[enemySize(enemy)]} 적</b> · ${groupOf(state.group).name} 중 <b>${singles}종</b>이 한 발에 처치합니다. 강조된 줄을 먼저 보세요.` : html`<b>${SIZE_NAMES[enemySize(enemy)]} 적</b> · ${groupOf(state.group).name} 중 한 발에 처치하는 무기가 없습니다. 여러 발이 필요하니 주의하세요.`,
    singles ? html`<b>${SIZE_NAMES[enemySize(enemy)]} enemy</b> · <b>${singles}</b> ${groupOf(state.group).name.toLowerCase()} ${singles === 1 ? 'weapon kills' : 'weapons kill'} it in one shot. Check the highlighted rows first.` : html`<b>${SIZE_NAMES[enemySize(enemy)]} enemy</b> · no ${groupOf(state.group).name.toLowerCase()} weapon kills it in one shot. Expect to need several.`)}</div>` : ''}
  <div class="segmented group-tabs" role="group" aria-label="${L('무기 분류', 'Weapon group')}">${GROUPS.map(group => html`<button type="button" data-group-pick="${group.id}" aria-pressed="${group.id === state.group}">${group.name} <span class="count">${weaponsOf[group.id].length}</span></button>`)}</div>
  <div class="panel ranking">
    <div class="rank-head" aria-hidden="true"><span></span><span>${L('무기', 'Weapon')}</span><span>${L('노릴 부위', 'Aim for')}</span><span>${L('횟수', 'Shots')}</span><span>${L('결과', 'Result')}</span></div>
    ${main.map(row)}
    ${rest.length ? html`<details class="rank-more" ${rest.some(entry => entry.weapon.id === selectedId) ? raw('open') : ''}><summary>${L(`처치 경로가 없거나 계산하지 않은 무기 ${rest.length}종`, `${rest.length} weapons with no kill route or not calculated`)}</summary>${rest.map(row)}</details>` : ''}
  </div>`;
}

// --- Matchup detail -----------------------------------------------------------------------
function photoButton(enemy, target) {
  const photo = combatImages[enemy.id]?.[target.id]?.find(item => item.stage === 'initial');
  if (!photo) return html`<span class="part-photo" style="cursor:default;display:grid;place-items:center;font-size:11.5px;color:var(--text-3);text-align:center">${L(html`부위 사진<br>없음`, html`No part<br>photo`)}</span>`;
  const tw = photo.thumbnailWidth || 320, th = photo.thumbnailHeight || 213;
  const [x, y, w, h] = photo.thumbnailCrop || [0, 0, tw, th];
  const style = `width:${tw / w * 100}%;height:${th / h * 100}%;left:${-x / w * 100}%;top:${-y / h * 100}%`;
  return html`<button class="part-photo" type="button" data-photo="${target.id}" style="aspect-ratio:${w}/${h}" aria-label="${L(`${enemy.name} ${target.name} 위치 사진 크게 보기`, `Enlarge ${T(enemy.name)} ${T(target.name)} photo`)}">
    <img src="${photo.thumbnail}" alt="" width="${tw}" height="${th}" loading="lazy" decoding="async" style="${style}"><span class="zoom">${icon('expand', 14)}</span></button>`;
}

function stageLines(row, enemy, mode) {
  const main = row.target.main || enemy.main;
  return row.stages.map((stage, index) => {
    const part = stage.part;
    const events = stage.events || [];
    const lines = events.map(event => {
      const d = event.damage;
      const who = event.name ? html`<b>${event.name}${event.times > 1 ? ` ×${event.times}` : ''}</b> ` : '';
      const blasts = d.blasts.map(blast => blast.excluded ? html`<br><span class="faint">${blast.name}: ${L('장치는 폭발 면역 → 0', 'device is immune to explosions → 0')}</span>`
        : html`<br><span>${blast.name}: AP ${num(blast.effectiveAp)} → ${blast.redirected ? L('본체', 'main') : L('부위', 'part')} ${L('장갑', 'armor')} ${num(blast.armor)}, ${L('폭발 저항', 'explosive resistance')} ${pct(blast.exdr)} → <code>${num(blast.redirected ? blast.toMain : blast.toPart)}</code>${blast.redirected ? L(' (본체로)', ' (to main)') : ''}</span>`);
      return html`<div>${who}${deliveryOf(event.attack).hit} <code>${num(d.direct)}</code> · ${L('부위 폭발', 'part explosion')} <code>${num(d.explosion)}</code>${d.mainExplosion ? html` · ${L('본체 폭발', 'main explosion')} <code>${num(d.mainExplosion)}</code>` : ''}${blasts}</div>`;
    });
    const transfer = part.partOnly ? L('독립 장치 — 본체 전달 없음', 'Separate device — nothing passes to main') : `${L('본체 전달', 'To main')} ${num(part.toMain)}%${part.overflowCap == null ? L(' · 상한 미확인', ' · cap unverified') : part.overflowCap ? L(` · 누적 상한 ${num(partPool(part) + (part.constitution || 0) + (part.transferExtraHealth || 0))}`, ` · total cap ${num(partPool(part) + (part.constitution || 0) + (part.transferExtraHealth || 0))}`) : L(' · 상한 없음', ' · no cap')}`;
    const beam = Number.isFinite(stage.contactSeconds) ? html`<div>${L('광선 접촉 약', 'Beam contact about')} <code>${num(stage.contactSeconds)}${L('초', 's')}</code> · ${L('부위 누적', 'part total')} <code>${num(stage.partTotal)}</code> · ${L('본체 전달', 'to main')} <code>${num(stage.mainTotal)}</code></div>` : '';
    const header = html`<b>${stageName(stage)}</b> — ${L('체력', 'health')} ${num(partPool(stage.part))}, ${L('장갑', 'armor')} ${num(stage.part.armor)}, ${L('내구도', 'durability')} ${pct(stage.part.durability)}${row.stages.length > 1 && !Number.isFinite(stage.contactSeconds) ? html` → <b>${num(stage.hits)}${unitOf(mode, stage.hits).unit}</b>` : ''}`;
    return html`<li>${header}${lines}${beam}<div class="faint">${transfer}${index === 0 ? L(` · 본체 체력 ${num(main.hp)}`, ` · main health ${num(main.hp)}`) : ''}</div></li>`;
  });
}

function partCard(row, enemy, mode, isBest) {
  const target = row.target;
  const outcome = outcomeOf(row);
  const count = countText(row, mode);
  const notes = routeNotes(row, mode);
  const next = target.next;
  const stat = (label, value, nextValue) => html`<div><dt>${label}</dt><dd>${value}${nextValue != null && nextValue !== value ? html` <span class="faint">→ ${nextValue}</span>` : ''}</dd></div>`;
  return html`<article class="panel part-card" ${isBest ? raw('data-best') : ''}>
    <div class="part-top">
      <div><h3>${target.name} ${badge(outcome.label, outcome.tone)}${isBest ? badge(L('최단', 'Fastest'), 'accent') : ''}${row.conditional ? badge(L('선행 조건', 'Prerequisite'), 'conditional') : ''}</h3>
        <div class="part-count ${count ? '' : 'none'}">${count ? html`<b>${num(row.hits)}${row.lowerBound ? L('', '+') : ''}</b><span>${unitOf(mode, row.hits).unit}${row.lowerBound ? L(' 이상 · 재생 제외', ' · regen not included') : ''}${target.prerequisite ? L(` · ${target.prerequisite} 후`, ` · after: ${T(target.prerequisite)}`) : ''}</span>` : html`<b>${row.outcome === 'blocked' ? L('관통 불가', 'No penetration') : row.outcome === 'shield' ? L('보호막부터', 'Shield first') : L('계산 보류', 'Not calculated')}</b>`}</div></div>
      ${photoButton(enemy, target)}
    </div>
    <dl class="part-stats">
      ${stat(L('체력', 'Health'), target.hp == null ? L('미확인', 'Unverified') : num(partPool(target)) + (target.mainOnly ? L(' (본체)', ' (main)') : ''), next ? num(partPool(next)) : null)}
      ${stat(L('장갑', 'Armor'), num(target.armor), next ? num(next.armor) : null)}
      ${stat(L('내구도', 'Durability'), pct(target.durability), next ? pct(next.durability) : null)}
      ${stat(L('폭발 저항', 'Explosive resistance'), pct(target.exdr))}
    </dl>
    <div class="aim">${aimText(row, mode).map((line, index) => html`<p>${index === 0 ? '' : '· '}${line}</p>`)}</div>
    ${notes.length ? html`<ul class="notes">${notes.map(note => html`<li>${note}</li>`)}</ul>` : ''}
    ${row.stages.length ? html`<details class="disclosure"><summary>${L(`${unitOf(mode).one} 피해 계산 과정`, `Damage math for ${unitOf(mode).one}`)}</summary><div class="calc"><ol>${stageLines(row, enemy, mode)}</ol></div></details>` : ''}
  </article>`;
}

function wikiReferenceBlock(reference, unit) {
  if (!reference) return '';
  const x = reference.explanation;
  return html`<div class="callout info wiki-ref"><h3>${L(`위키 전술: ${reference.target} 명중 시 ${num(reference.hits)}${unit} ${outcomeOf({ outcome: reference.outcome, target: {} }).label}`, `Wiki tactic: ${num(reference.hits)}${unit} on ${T(reference.target)} · ${outcomeOf({ outcome: reference.outcome, target: {} }).label}`)}</h3>
    <p>${reference.note}</p>
    ${x ? html`<details class="disclosure" style="margin-top:8px"><summary>${L('왜 가능한가 — 여러 부위 동시 피격 가정', 'Why it works — assumes several parts are hit at once')}</summary><div>
      <p>${x.intro}</p><ul class="notes">${x.attacks.map(item => html`<li>${item}</li>`)}</ul>
      <table><thead><tr><th>${L('피격 부위', 'Part hit')}</th><th>${L('전달 계산', 'Transfer')}</th><th>${L('본체 피해', 'Main damage')}</th></tr></thead><tbody>${x.rows.map(item => html`<tr><td>${item.part}</td><td>${item.formula}</td><td>${num(item.mainDamage)}</td></tr>`)}</tbody>
      <tfoot><tr><th colspan="2">${L('가정 합계 (실측 아님)', 'Assumed total (not measured)')}</th><td>${num(x.total)}</td></tr></tfoot></table>
      <ul class="notes">${x.notes.map(item => html`<li>${item}</li>`)}</ul>
      <p class="sources">${x.sources.map(source => external(source.url, source.label))}</p></div></details>` : ''}
    <p class="sources" style="margin-top:6px">${external(reference.source, L('위키 전술 설명', 'Wiki tactic'))} · ${L('확인', 'checked')} ${reference.checkedAt}</p>
  </div>`;
}

function hitRateControls(mode, c) {
  const kind = HIT_KINDS[c.kind];
  const count = Number(effectiveAssume(mode).hitCount);
  // Keep the percentage the player picked; several steps can round to one count.
  const pct = state.assume.pct != null && hitCount(c, state.assume.pct) === count ? state.assume.pct : hitPct(c, count);
  const low = c.min === 0 ? 0 : 10;
  return html`<div class="assumptions pellet-range">
    <label for="hit-pct">${L('명중률', 'Hit rate')} <b data-pct-label>${pct}%</b> <span class="faint" data-pct-count>${countLine(c, count)}</span></label>
    <input id="hit-pct" type="range" min="${low}" max="100" step="10" value="${pct}" data-assume-pct data-kind="${c.kind}" data-min="${c.min}" data-max="${c.max}" aria-valuetext="${L(`${pct}%, ${kind.noun} ${count}${kind.unit}`, `${pct}%, ${count} ${kind.noun}`)}">
    <div class="range-scale" aria-hidden="true"><span>${low}%</span><span>50%</span><span>100%</span></div>
    ${c.kind === 'bomblets' ? html`<div class="bomblet-extra"><label>${L('주탄', 'Main projectile')}
      <select class="select" data-assume="primaryHit">${PRIMARY_HITS.map(([value, name]) => html`<option value="${value}" ${(state.assume.primaryHit ?? mode.hitCondition.defaultPrimaryHit ?? 'blast') === value ? raw('selected') : ''}>${name}</option>`)}</select></label>
      <label class="check"><input type="checkbox" data-assume="bombletDirect" ${(state.assume.bombletDirect ?? mode.hitCondition.defaultBombletDirect ?? false) ? raw('checked') : ''} ${count > 0 ? '' : raw('disabled')}> ${L('자탄 직격도 포함', 'Include bomblet impacts')}</label></div>` : ''}
    <p>${kind.why} ${assumptionSummary(withHitAssumption(mode, effectiveAssume(mode)))}</p>
  </div>`;
}

function assumptionControls(mode) {
  const c = mode.hitCondition;
  if (!c) return '';
  if (HIT_KINDS[c.kind]) return hitRateControls(mode, c);
  const unit = L(c.kind === 'arcs' ? '회' : '개', '');
  const label = L({ arcs: '한 발당 이 부위 전격 명중 수', bomblets: '한 발당 이 부위 자탄 명중 수', pellets: '한 발당 이 부위 펠릿 명중 수', shrapnel: '폭발 1회당 이 부위 파편 명중 수' }[c.kind] || '이 부위 명중 수',
    { arcs: 'Arcs per shot hitting this part', bomblets: 'Bomblets per shot hitting this part', pellets: 'Pellets per shot hitting this part', shrapnel: 'Fragments per explosion hitting this part' }[c.kind] || 'Hits on this part');
  const options = Array.from({ length: c.max - c.min + 1 }, (_, i) => c.min + i);
  return html`<div class="assumptions">
    <label>${label}
      <select class="select" data-assume="hitCount"><option value="">${L('선택하세요', 'Choose')}</option>${options.map(n => html`<option value="${n}" ${String(n) === String(effectiveAssume(mode).hitCount) ? raw('selected') : ''}>${n}${unit}</option>`)}</select></label>
    ${c.kind === 'bomblets' ? html`<label>${L('주탄', 'Main projectile')}
      <select class="select" data-assume="primaryHit">${PRIMARY_HITS.map(([value, name]) => html`<option value="${value}" ${state.assume.primaryHit === value ? raw('selected') : ''}>${name}</option>`)}</select></label>
      <label class="check"><input type="checkbox" data-assume="bombletDirect" ${state.assume.bombletDirect ? raw('checked') : ''} ${Number(state.assume.hitCount) > 0 ? '' : raw('disabled')}> ${L('자탄 직격도 포함', 'Include bomblet impacts')}</label>` : ''}
    <p>${L('실제 명중 수는 확인된 자료가 없어 직접 고르는 가정입니다.', 'There is no verified data on the real number of hits, so this is your own assumption.')}${c.default != null && state.assume.hitCount === '' ? L(` 고르기 전에는 ${c.default}${unit}로 계산합니다.`, ` Until you choose, ${c.default} is used.`) : ''} ${assumptionSummary(withHitAssumption(mode, effectiveAssume(mode)))}</p>
  </div>`;
}

function verdict(enemy, weapon, mode, matchup, reference) {
  const unitFor = count => unitOf(mode, count).unit;
  const label = html`<span class="label">${enemy.name} × ${weapon.name}${mode ? html` · ${mode.name}` : ''}</span>`;
  if (!mode || mode.unsupported) {
    return html`<div class="verdict">${label}<h3>${L(`이 ${mode ? '모드' : '무기'}는 정밀 계산을 지원하지 않습니다`, `This ${mode ? 'mode' : 'weapon'} is not supported by the calculator`)}</h3><p>${mode?.unsupported || unsupportedOf(weapon.id) || L('이 무기의 부위별 피해 조건을 아직 검증하지 않았습니다.', 'Its per-part damage has not been verified yet.')} ${L('처치할 수 없다는 뜻은 아닙니다.', 'That does not mean it cannot kill.')}</p></div>`;
  }
  if (mode.hitCondition && !mode.assumption) return html`<div class="verdict">${label}<h3>${L('명중 수 가정을 먼저 고르세요', 'Pick a hit assumption first')}</h3><p>${assumptionText(mode)}</p></div>`;
  const spear = spearCannotLock(enemy, mode);
  const best = matchup.best;
  if (best) {
    const outcome = outcomeOf(best);
    return html`<div class="verdict" data-tone="${outcome.tone}">${label}
      <h3><span class="big">${num(best.hits)}${L('', best.lowerBound ? '+' : '')}${unitFor(best.hits)}</span>${best.lowerBound ? L(' 이상', '') : ''} · ${best.target.name} · ${outcome.label}</h3>
      <p>${best.stages.length > 1 ? best.stages.map(stage => Number.isFinite(stage.contactSeconds) ? stageName(stage) : `${stageName(stage)} ${num(stage.hits)}${unitFor(stage.hits)}`).join(' → ') + ' · ' : ''}${best.target.tip}</p>
      ${spear ? html`<p style="color:var(--bleed)">${L('스피어는 이 적에게 직접 락온할 수 없습니다. 다른 표적으로 쏜 미사일이 이 부위에 맞았을 때의 참고값입니다.', 'The Spear cannot lock on to this enemy directly. This is a reference value for when a missile fired at another target hits this part.')}</p>` : ''}
      ${best.lowerBound ? html`<p>${best.notes[0]}</p>` : ''}
    </div>`;
  }
  const allShield = matchup.rows.every(row => row.outcome === 'shield');
  if (allShield) return html`<div class="verdict">${label}<h3>${L('보호막(방패)을 먼저 처리해야 합니다', 'Deal with the shield first')}</h3><p>${enemy.shield.note} ${L('위의 체크를 켜면 제거한 뒤의 횟수를 보여 줍니다.', 'Tick the box above to see the count once it is out of the way.')}</p></div>`;
  const pending = matchup.rows.some(row => row.outcome === 'unknown');
  const acc = !pending && noFatalPart(enemy) ? solveAccumulation(enemy, mode, { shieldCleared: state.shield }) : null;
  if (acc) {
    return html`<div class="verdict" data-tone="kill">${label}
      <h3><span class="big">${num(acc.hits)}${unitFor(acc.hits)}</span> · ${L('누적 처치', 'Cumulative kill')}</h3>
      <p>${L(`치명 부위가 없어 여러 부위에 피해를 쌓아 본체 체력 ${num(enemy.main.hp)}을 깎는 경로입니다. 부위를 하나씩 부수며 이 순서로 맞히세요.`, `With no fatal part, damage has to build up over several parts to wear down its ${num(enemy.main.hp)} main health. Break the parts one at a time in this order.`)}</p>
      <ol class="acc-steps">${acc.steps.map(step => html`<li><b>${L(`${stepName(step)} ${step.instances}개`, `${stepName(step)} ×${step.instances}`)}</b> · ${L(`하나당 ${num(step.hitsPerInstance)}${unitFor(step.hitsPerInstance)}`, `${num(step.hitsPerInstance)}${unitFor(step.hitsPerInstance)} each`)} → ${num(step.hits)}${unitFor(step.hits)} <span class="faint">(${L('본체', 'main')} ${num(step.mainDamage)})</span></li>`)}</ol>
      <p class="faint">${L('폭발이 여러 부위에 동시에 닿는 피해는 빼고 계산한 보수적인 값입니다. 실제로는 더 적게 들 수 있습니다.', 'A conservative value that leaves out explosions hitting several parts at once. In practice it can take fewer.')}</p></div>`;
  }
  if (!pending && noFatalPart(enemy) && matchup.rows.some(row => row.hits != null)) {
    return html`<div class="verdict">${label}<h3>${L('치명 부위가 없어 여러 부위에 피해를 쌓아야 합니다', 'No fatal part: damage has to build up over several parts')}</h3>
      <p>${L(`${josa(enemy.name, ['은', '는'])} 한 부위를 부숴도 죽지 않고, 여러 부위를 통해 본체 체력 ${num(enemy.main.hp)}을 모두 깎아야 처치됩니다. 한 부위만 계속 맞히는 계산으로는 경로가 나오지 않을 뿐, 처치할 수 없다는 뜻은 아닙니다. 아래에서 부위별 파괴 횟수와 본체 전달 비율을 확인하세요.`, `The ${T(enemy.name)} does not die from breaking one part; its ${num(enemy.main.hp)} main health has to be worn down through several parts. Hitting a single part just gives no route here — it does not mean it cannot be killed. Check the break counts and % to main for each part below.`)}</p></div>`;
  }
  return html`<div class="verdict">${label}<h3>${pending ? L('일부 부위는 자료가 없어 계산을 보류했습니다', 'Some parts lack data, so they were not calculated') : reference ? L('단일 부위로는 처치 경로가 없습니다', 'No kill route through a single part') : L('확인된 부위에서 바로 처치하는 경로가 없습니다', 'No direct kill route through a verified part')}</h3>
    <p>${matchup.rows.some(row => row.conditional && row.outcome === 'kill') ? L('아래에서 선행 조건이 붙은 경로를 확인하세요.', 'See the routes with prerequisites below.') : L('아래에서 관통 가능한 부위와 부위 파괴 결과를 확인하세요.', 'See which parts it can penetrate and break below.')} ${L('이 결과만으로 처치 불가능하다고 단정하지는 않습니다.', 'This alone does not mean it cannot be killed.')}</p></div>`;
}

function matchupSection(enemy, entries) {
  const weapon = weaponById.get(state.weapon) || entries[0].weapon;
  const profile = profileOf(weapon.id);
  const group = groupOf(weapon.group);
  // An explicit mode wins; otherwise show the weapon's best-ranked mode.
  const rawMode = profile?.modes.find(mode => mode.id === state.mode) || entries.find(entry => entry.weapon.id === weapon.id)?.mode || profile?.modes[0];
  const mode = withHitAssumption(rawMode, effectiveAssume(rawMode));
  const matchup = solveMatchup(enemy, mode, { shieldCleared: state.shield });
  const reference = wikiReference(enemy, weapon.id, mode);
  const stats = attackStats(mode);
  const notes = [mode?.falloff && L('거리 감쇠가 있어 표시 횟수는 근거리 최대 피해 기준입니다.', 'Damage falls off with range; counts use full close-range damage.'), mode?.note, profile?.note].filter(Boolean);
  return html`<section class="matchup" id="matchup">
    <div class="section-title" style="margin-bottom:0"><h2>${L('부위별 계산', 'Part by part')}</h2><p>${assumptionText(mode)}</p></div>
    <div class="panel" style="padding:16px;display:grid;gap:12px">
      <div class="matchup-head">${weaponIcon(weapon.id, 44)}<div><h2>${weapon.name}</h2><a class="ext" href="${group.link(weapon.id)}">${group.linkLabel}</a></div>
        ${compareToggle(weapon, rawMode)}
        ${profile?.modes.length > 1 ? html`<div class="segmented" role="group" aria-label="${profile.modes.some(item => item.beam) ? L('거리', 'Range') : L('발사 모드', 'Firing mode')}">${profile.modes.map(item => html`<button type="button" data-mode-pick="${item.id}" aria-pressed="${item.id === rawMode?.id}">${item.name}</button>`)}</div>` : ''}</div>
      ${stats.length ? html`<div class="stat-chips">${stats.map(stat => html`<div class="stat-chip"><span>${stat.label}</span><b>${stat.value}</b>${stat.note ? html`<small>${stat.note}</small>` : ''}</div>`)}</div>` : ''}
      ${notes.length ? html`<ul class="notes">${notes.map(note => html`<li>${note}</li>`)}</ul>` : ''}
    </div>
    ${mode ? assumptionControls(mode) : ''}
    ${verdict(enemy, weapon, mode, matchup, reference)}
    ${wikiReferenceBlock(reference, unitOf(mode, reference?.hits).unit)}
    ${mode && !mode.unsupported ? html`<div class="parts">${matchup.rows.map(row => partCard(row, enemy, mode, row === matchup.best))}</div>` : ''}
    <p class="sources">${external(enemy.source, L('적 부위 수치', 'Enemy part stats'))} ${external(profile?.source || weapon.source, L('무기 수치', 'Weapon stats'))} ${profile?.extraSource ? external(profile.extraSource, L('광선 세부 수치', 'Beam details')) : ''} ${external(damageSource, L('피해 계산 규칙', 'Damage rules'))}
      <span>${L(`적 자료 ${enemy.checkedAt || combatCheckedAt} · 무기 자료 ${profile?.checkedAt || combatCheckedAt} 확인`, `Enemy data checked ${enemy.checkedAt || combatCheckedAt} · weapon data ${profile?.checkedAt || combatCheckedAt}`)}</span></p>
  </section>`;
}

// --- Comparison: the same enemy (and optionally the same part) for up to three weapons ---
const pickKey = pick => `${pick.weaponId}:${pick.modeId || ''}`;
const isPicked = (weaponId, modeId) => compare.picks.some(pick => pick.weaponId === weaponId && (pick.modeId || '') === (modeId || ''));
function compareToggle(weapon, mode) {
  const picked = isPicked(weapon.id, mode?.id);
  return html`<button type="button" class="button small ${picked ? 'primary' : 'ghost'} compare-add" data-compare-add="${weapon.id}" data-compare-mode="${mode?.id || ''}" aria-pressed="${picked}">${icon(picked ? 'check' : 'compare', 16)} ${picked ? L('비교에 담김', 'Added to compare') : L('비교에 담기', 'Add to compare')}</button>`;
}

function togglePick(weaponId, modeId) {
  const index = compare.picks.findIndex(pick => pick.weaponId === weaponId && (pick.modeId || '') === (modeId || ''));
  if (index >= 0) compare.picks.splice(index, 1);
  else if (compare.picks.length >= MAX_COMPARE) { ctx.toast(L(`비교는 최대 ${MAX_COMPARE}개까지입니다. 하나를 빼 주세요.`, `You can compare up to ${MAX_COMPARE}. Remove one first.`)); return; }
  else compare.picks.push({ weaponId, modeId: modeId || undefined });
  renderMain();
}

function renderTray() {
  const tray = $('#enemy-tray', root);
  if (!tray) return;
  tray.hidden = !compare.picks.length;
  if (!compare.picks.length) return;
  const label = pick => { const weapon = weaponById.get(pick.weaponId); const mode = profileOf(pick.weaponId)?.modes.find(item => item.id === pick.modeId); return `${T(weapon?.name) || pick.weaponId}${mode && profileOf(pick.weaponId).modes.length > 1 ? ` · ${T(mode.name)}` : ''}`; };
  render(tray, html`<span class="names">${icon('compare', 18)} ${compare.picks.map(label).join(' · ')}</span>
    <span class="faint num">${compare.picks.length}/${MAX_COMPARE}</span>
    <button class="button small" type="button" data-compare-clear>${L('비우기', 'Clear')}</button>
    <button class="button small primary" type="button" data-compare-open ${compare.picks.length < 2 ? html`disabled title="${L('2개 이상 담으면 비교할 수 있습니다', 'Add 2 or more to compare')}"` : ''}>${L(`${enemyById.get(state.enemy).name} 기준 비교`, `Compare vs ${T(enemyById.get(state.enemy).name)}`)}</button>`);
}

// Assumed counts: the current weapon keeps the player's choice; others use their default.
function compareAssumptions() {
  return Object.fromEntries(compare.picks.map(pick => {
    const mode = profileOf(pick.weaponId)?.modes.find(item => item.id === pick.modeId) || profileOf(pick.weaponId)?.modes[0];
    const own = pick.weaponId === state.weapon && state.assume.hitCount !== '';
    const fallback = defaultCount(mode);
    return [pickKey({ ...pick, modeId: pick.modeId || mode?.id }), own ? state.assume : fallback != null ? { ...DEFAULT_ASSUME, hitCount: String(fallback) } : DEFAULT_ASSUME];
  }));
}

function compareContent() {
  const enemy = enemyById.get(state.enemy);
  const result = compareAttacks(enemy, compare.picks, { partId: compare.part || undefined, shieldCleared: state.shield, assume: compareAssumptions() });
  const routes = result.entries.filter(entry => entry.status === 'route' && entry.hits != null);
  const fewest = routes.length > 1 ? Math.min(...routes.map(entry => entry.hits)) : null;
  const partName = entry => entry.part?.name || entry.route?.target?.name || entry.best?.target?.name || '';
  const unit = entry => unitOf(profileOf(entry.weaponId)?.modes.find(item => item.id === entry.modeId), entry.hits).unit;
  const cell = entry => {
    if (entry.status === 'route') {
      const outcome = outcomeOf({ outcome: entry.outcome, target: {} });
      return html`<td class="${entry.hits === fewest ? 'best' : ''}"><b class="compare-hits">${num(entry.hits)}${unit(entry)}${entry.lowerBound ? '+' : ''}</b> ${badge(outcome.label, outcome.tone)}<small>${T(partName(entry))}${entry.conditional ? L(' · 선행 조건', ' · prerequisite') : ''}${assumedText(entry)}</small></td>`;
    }
    const label = { assume: L('명중 수 가정 필요', 'Needs a hit assumption'), none: L('처치 경로 없음', 'No kill route'), unsupported: L('계산 미지원', 'Not supported') }[entry.status] || L('계산 보류', 'Not calculated');
    return html`<td><span class="faint">${label}</span>${entry.reason ? html`<small>${entry.reason}</small>` : ''}</td>`;
  };
  return html`<div class="sheet-top"><span>${L('같은 적 기준 비교', 'Compare against one enemy')}</span><button class="icon-button" type="button" data-close aria-label="${L('닫기', 'Close')}">${icon('close', 18)}</button></div>
  <div class="sheet-content">
    <h2 id="sheet-title" style="font-size:22px">${enemy.name} · ${L(`무기 ${result.entries.length}개 비교`, `${result.entries.length} weapons compared`)}</h2>
    <div class="segmented" role="group" aria-label="${L('비교할 부위', 'Part to compare')}"><button type="button" data-compare-part="" aria-pressed="${!compare.part}">${L('각자 가장 빠른 부위', 'Each one\'s fastest part')}</button>${result.parts.map(part => html`<button type="button" data-compare-part="${part.id}" aria-pressed="${compare.part === part.id}">${part.name}</button>`)}</div>
    <div class="compare-scroll" role="region" aria-label="${L('비교표', 'Comparison table')}" tabindex="0"><table class="compare-table enemy-compare">
      <thead><tr><th></th>${result.entries.map(entry => html`<th scope="col"><div class="compare-weapon">${weaponIcon(entry.weaponId, 36)}<div>${entry.weaponLabel}<small>${entry.modeLabel}</small></div></div></th>`)}</tr></thead>
      <tbody>
        <tr><th scope="row">${compare.part ? L('이 부위 횟수', 'Shots on this part') : L('최소 횟수', 'Fewest shots')}</th>${result.entries.map(cell)}</tr>
        <tr><th scope="row">${L('필요 탄창', 'Magazines needed')}</th>${result.entries.map(entry => html`<td>${entry.magazinesNeeded != null ? html`${L(`${num(entry.magazinesNeeded)}개`, num(entry.magazinesNeeded))}${profileOf(entry.weaponId)?.modes.find(item => item.id === entry.modeId)?.magazine ? html`<small>${L(`탄창 ${num(profileOf(entry.weaponId).modes.find(item => item.id === entry.modeId).magazine)}발 기준`, `${num(profileOf(entry.weaponId).modes.find(item => item.id === entry.modeId).magazine)}-round magazine`)}</small>` : ''}` : html`<span class="faint">—</span>`}</td>`)}</tr>
      </tbody>
    </table></div>
    <p class="faint" style="font-size:12.5px">${L('노란 값이 가장 적은 횟수입니다. 연사력·재장전·조준 난도는 반영하지 않으므로 처치 속도 순위가 아닙니다.', 'Yellow marks the fewest shots. Fire rate, reloads and aiming difficulty are not included, so this is not a time-to-kill ranking.')} ${state.shield && enemy.shield ? L('방패·보호막을 피한 상태 기준입니다.', 'Assumes the shield is out of the way.') : ''} ${L('명중 수를 골라야 하는 무기는 부위별 계산에서 가정을 고른 뒤 다시 비교하세요.', 'For weapons that need a hit assumption, pick one in the part-by-part calculation and compare again.')}</p>
  </div>`;
}

function openCompare() {
  if (compare.picks.length < 2) return;
  ctx.openSheet(compareContent(), { wide: true, label: L('같은 적 기준 무기 비교', 'Weapon comparison against one enemy') });
}
let sheetListener = null;

function renderMain({ scrollToMatchup = false } = {}) {
  const enemy = enemyById.get(state.enemy);
  const entries = rankWeapons(enemy, state.shield);
  const selected = weaponsOf[state.group].some(weapon => weapon.id === state.weapon) ? state.weapon : null;
  render($('#enemy-main', root), html`${hero(enemy)}${ranking(enemy, entries, selected, selected ? matchupSection(enemy, entries) : '')}`);
  renderTray();
  renderPicker();
  if (scrollToMatchup) $('.rank-row[aria-expanded="true"]', root)?.scrollIntoView({ block: 'start' });
}

function syncUrl() {
  ctx.replace({ view: 'enemy', id: state.enemy, query: { g: state.group === 'support' ? null : state.group, w: state.weapon, m: state.weapon ? state.mode : null, shield: state.shield ? null : '0' } });
}

function openPhotos(targetId) {
  const enemy = enemyById.get(state.enemy);
  const target = enemy.parts.find(part => part.id === targetId);
  const photos = combatImages[enemy.id]?.[targetId] || [];
  ctx.openSheet(html`<div class="sheet-top"><span>${L('부위 위치', 'Part location')}</span><button class="icon-button" type="button" data-close aria-label="${L('닫기', 'Close')}">${icon('close', 18)}</button></div>
    <div class="sheet-content image-viewer"><h2 id="sheet-title" style="font-size:20px">${enemy.name} · ${target.name}</h2><p class="muted">${target.tip}${enemy.id === 'harvester' ? L(' 좌우는 적의 몸 기준입니다.', ' Left and right are from the enemy\'s point of view.') : ''}</p>
    ${photos.map(photo => { const caption = photo.caption || (target.next ? (photo.stage === 'initial' ? L('① 장갑이 남아 있는 상태', '① With the armor still on') : L('② 장갑을 벗긴 뒤 드러난 부위', '② Exposed once the armor is off')) : target.name);
      return html`<figure><figcaption>${caption}</figcaption><img src="${photo.src}" alt="${L(`${enemy.name} ${caption} — 색칠된 영역이 조준 부위`, `${T(enemy.name)} ${T(caption)} — the colored area is where to aim`)}" width="${photo.width}" height="${photo.height}" decoding="async"><span class="sources">${external(photo.source, L('위키 원본 이미지', 'Original wiki image'))}</span></figure>`; })}</div>`, { label: `${T(enemy.name)} ${T(target.name)} ${L('사진', 'photos')}` });
}

// --- Lifecycle ----------------------------------------------------------------------------------
let arrived = false;
export function mount(container, context) {
  root = container; ctx = context; arrived = true;
  const families = new Set(enemies.map(enemy => enemy.family || enemy.id)).size;
  render(root, html`<div class="page-head"><div><div class="eyebrow">Target Analysis</div><h1>${L('적 대응', 'Enemies')}</h1><p>${L('적을 고르면 지원 무기·주무기·보조무기·투척을 필요 횟수 순으로 비교합니다. 무기를 누르면 부위별 계산이 열립니다.', 'Pick an enemy to rank support, primary, secondary and throwable weapons by shots to kill. Tap a weapon to open the part-by-part math.')}</p></div>
    <span class="badge outline">${L(`적 ${families}종 · 계산 무기 ${Object.keys(weaponProfiles).length + Object.keys(personalProfiles).length}종`, `${families} enemies · ${Object.keys(weaponProfiles).length + Object.keys(personalProfiles).length} weapons calculated`)}</span></div>
  <div class="enemy-layout">
    <aside class="panel picker" aria-label="${L('적 선택', 'Choose an enemy')}">
      <div class="picker-head">
        <button class="button picker-toggle" type="button" data-picker-toggle aria-expanded="false">${icon('enemy', 18)} <span id="picker-current"></span><span class="faint" style="margin-left:auto">${L('적 바꾸기', 'Change enemy')}</span></button>
        <label class="field">${icon('search', 16)}<span class="sr-only">${L('적 검색', 'Search enemies')}</span><input class="input" id="enemy-q" type="search" placeholder="${L('적 이름 검색', 'Search enemies')}" autocomplete="off" style="height:38px"></label>
        <div class="segmented" role="group" aria-label="${L('진영', 'Faction')}"><button type="button" data-faction-filter="">${L('전체', 'All')}</button>${FACTIONS.map(faction => html`<button type="button" data-faction-filter="${faction}">${faction}</button>`)}</div>
      </div>
      <div class="picker-list" id="enemy-list"></div>
    </aside>
    <div id="enemy-main"></div>
  </div>
  <div id="enemy-tray" class="tray" hidden></div>`);

  listenToSheet();
  const input = $('#enemy-q', root);
  input.addEventListener('input', () => { state.q = input.value; renderPicker(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { const first = $('[data-enemy]', root); if (first) first.click(); }
  });
  root.addEventListener('change', event => {
    const target = event.target;
    if (target.matches('[data-shield]')) { state.shield = target.checked; renderMain(); syncUrl(); }
    if (target.matches('[data-assume-pct]')) {
      state.assume.hitCount = String(hitCount({ min: Number(target.dataset.min), max: Number(target.dataset.max) }, Number(target.value)));
      state.assume.pct = Number(target.value);
      renderMain();
      $('[data-assume-pct]', root)?.focus({ preventScroll: true });
    }
    if (target.dataset.assume) {
      const key = target.dataset.assume;
      state.assume[key] = target.type === 'checkbox' ? target.checked : target.value;
      if (key === 'hitCount' && !(Number(target.value) > 0)) state.assume.bombletDirect = false;
      renderMain();
    }
  });
  root.addEventListener('input', event => {
    const range = event.target.closest('[data-assume-pct]');
    if (!range) return;
    const c = { kind: range.dataset.kind, min: Number(range.dataset.min), max: Number(range.dataset.max) };
    $('[data-pct-label]', root).textContent = `${range.value}%`;
    $('[data-pct-count]', root).textContent = countLine(c, hitCount(c, Number(range.value)));
  });
  root.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.enemy) {
      state.pickerOpen = false;
      ctx.go({ view: 'enemy', id: target.dataset.enemy, query: { g: state.group === 'support' ? null : state.group, w: state.weapon, m: state.weapon ? state.mode : null, shield: state.shield ? null : '0' } });
    } else if (target.dataset.groupPick) {
      state.group = target.dataset.groupPick;
      if (weaponById.get(state.weapon)?.group !== state.group) { state.weapon = null; state.mode = null; resetAssumption(); }
      renderMain(); syncUrl();
    } else if (target.dataset.factionFilter != null) { state.faction = target.dataset.factionFilter; renderPicker(); }
    else if (target.hasAttribute('data-picker-toggle')) { state.pickerOpen = !state.pickerOpen; target.setAttribute('aria-expanded', String(state.pickerOpen)); renderPicker(); if (state.pickerOpen) input.focus(); }
    else if (target.dataset.weapon && target.dataset.weapon === state.weapon) {
      // A second tap on the open row folds it away.
      state.weapon = null; state.mode = null; resetAssumption();
      renderMain(); syncUrl();
    } else if (target.dataset.weapon) {
      if (state.weapon !== target.dataset.weapon) resetAssumption();
      state.weapon = target.dataset.weapon; state.mode = target.dataset.mode || null;
      renderMain({ scrollToMatchup: true }); syncUrl();
    } else if (target.dataset.modePick) {
      state.weapon ||= selectedWeaponId(); state.mode = target.dataset.modePick; resetAssumption(); renderMain(); syncUrl();
    } else if (target.dataset.photo) openPhotos(target.dataset.photo);
    else if (target.dataset.compareAdd) togglePick(target.dataset.compareAdd, target.dataset.compareMode);
    else if (target.hasAttribute('data-compare-clear')) { compare.picks = []; compare.part = ''; renderMain(); }
    else if (target.hasAttribute('data-compare-open')) { compare.part = ''; openCompare(); }
  });
}
const resetAssumption = () => { state.assume = { ...DEFAULT_ASSUME }; };
function listenToSheet() {
  if (sheetListener) return;
  sheetListener = event => {
    if (document.body.dataset.view !== 'enemy') return;
    const pick = event.target.closest('[data-compare-part]');
    if (!pick) return;
    compare.part = pick.dataset.comparePart;
    ctx.openSheet(compareContent(), { wide: true, label: L('같은 적 기준 무기 비교', 'Weapon comparison against one enemy') });
  };
  $('#sheet').addEventListener('click', sheetListener);
}
const selectedWeaponId = () => rankWeapons(enemyById.get(state.enemy), state.shield)[0].weapon.id;

export function update(route) {
  const enemy = enemyById.has(route.id) ? route.id : state.enemy || DEFAULT_ENEMY;
  const weapon = weaponById.has(route.query.w) ? route.query.w : null;
  const modes = profileOf(weapon)?.modes || [];
  // A linked weapon decides its group; otherwise the query (or support) does.
  state.group = weapon ? weaponById.get(weapon).group : GROUPS.some(group => group.id === route.query.g) ? route.query.g : 'support';
  if (weapon !== state.weapon) resetAssumption();
  const switched = state.shown && enemy !== state.enemy;
  // Arriving from a link (gear or stratagem detail) with a weapon: jump to its calculation.
  const linked = weapon && (arrived || weapon !== state.weapon);
  arrived = false;
  Object.assign(state, {
    enemy, weapon, shown: true,
    mode: modes.some(mode => mode.id === route.query.m) ? route.query.m : weapon ? state.weapon === weapon ? state.mode : null : null,
    shield: route.query.shield !== '0',
  });
  renderMain();
  if (route.id !== enemy) syncUrl();
  // After picking another enemy, bring its summary into view.
  const main = $('#enemy-main', root);
  if (linked) showMatchup();
  else if (switched && main.getBoundingClientRect().top < 0) main.scrollIntoView({ block: 'start' });
}

// Scroll the selected weapon's row (with its calculation below) into view and flash it once.
function showMatchup() {
  const section = $('#matchup', root);
  if (!section) return;
  ($('.rank-row[aria-expanded="true"]', root) || section).scrollIntoView({ block: 'start' });
  section.classList.add('flash');
  section.addEventListener('animationend', () => section.classList.remove('flash'), { once: true });
}


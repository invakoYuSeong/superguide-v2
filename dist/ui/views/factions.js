// Faction loadout guide: editorial picks per sub-faction unit, each backed by
// the combat engine's count for the editor's aim point.
import { factionGuides, factionSides, factionCheckedAt } from '../../data/faction-data.js';
import { enemies, combatCheckedAt } from '../../data/combat-data.js';
import { pickerEnemyImages } from '../../data/selector-images.js';
import { wikiIcons } from '../../data/wiki-icons.js';
import { stratagemById } from '../../core/catalog.js';
import { recommend, findEnemy } from '../../core/factions.js';
import { num, unitOf, outcomeOf, countText, aimText, routeNotes, josa, stageName } from '../../core/explain.js';
import { html, render, $, $$, badge, external } from '../dom.js';
import { L, T, lang } from '../../core/i18n.js';

let root, ctx;
const state = { guide: factionGuides[0].id };

const weaponIcon = id => html`<img class="strat-icon" style="width:34px;height:34px" src="${wikiIcons[id]?.src}" alt="" loading="lazy">`;

function routeBlock(pick) {
  const { route, mode, approach } = pick;
  const unitFor = count => unitOf(mode, count).unit;
  if (approach) {
    return html`<div class="callout"><h3>${approach.title} · ${countText(route, mode)} → ${L('제트팩 파괴로 처치', 'kill by destroying the jetpack')}</h3><p>${approach.tip}</p></div>
      <p class="note">${approach.condition}</p>
      <p class="faint" style="font-size:12.5px">${L(`제트팩 체력 ${num(route.target.hp)} · 장갑 ${num(route.target.armor)}. 관통·폭발 저항을 적용한 한 발의 폭발 피해 ${num(route.stages[0].damage.explosion)}${Number.isFinite(mode.innerRadius) ? ` (폭발 중심 ${num(mode.innerRadius)}m 안)` : ''}.`, `Jetpack health ${num(route.target.hp)} · armor ${num(route.target.armor)}. Explosion damage per shot after penetration and explosive resistance: ${num(route.stages[0].damage.explosion)}${Number.isFinite(mode.innerRadius) ? ` (within ${num(mode.innerRadius)}m of the blast center)` : ''}.`)} ${external(approach.source, L('위키 전술', 'Wiki tactic'))}</p>`;
  }
  // A blast that only reaches the main body through an immune part is a single-judgement estimate.
  const redirected = route.via === 'main' && route.target.exdr === 100 && route.stages.every(stage => stage.damage.direct === 0 && stage.damage.explosion === 0);
  const outcome = outcomeOf(route);
  return html`<div><p class="how" style="font-weight:700">${redirected ? L('본체 폭발 피해 · 단일 판정 가정', 'Main explosion damage · assumes one check per blast') : route.target.name} — ${countText(route, mode)} ${outcome.label}</p>
    ${redirected ? html`<p>${L(`‘${route.target.name}’는 폭발 피해를 받지 않아, 폭발이 닿을 때마다 본체에 한 번 들어가는 피해만 반복한 값입니다. 이 부위를 노리는 게 가장 좋다는 뜻은 아닙니다.`, `The ${T(route.target.name)} takes no explosion damage, so this repeats only the damage that reaches main health once per blast. It does not mean this is the best part to aim for.`)}</p>` : aimText(route, mode).map(line => html`<p>${line}</p>`)}
    ${route.stages.length > 1 ? html`<p class="faint">${route.stages.map(stage => Number.isFinite(stage.contactSeconds) ? stageName(stage) : `${stageName(stage)} ${num(stage.hits)}${unitFor(stage.hits)}`).join(' → ')} ${route.target.copies > 1 ? '' : L('(장갑 제거 포함)', '(armor removal included)')}</p>` : ''}
    ${routeNotes(route, mode).length ? html`<ul class="notes" style="margin-top:6px">${routeNotes(route, mode).map(note => html`<li>${note}</li>`)}</ul>` : ''}</div>`;
}

function pickRow(unit, choice, index) {
  const pick = recommend(unit, choice);
  const weapon = stratagemById.get(pick.weaponId);
  if (pick.adviceOnly) {
    return html`<details class="pick"><summary><span class="rank-num">${index + 1}</span>${weaponIcon(weapon.id)}
      <span><b>${weapon.name}</b><small>${pick.pick.label}</small></span>
      <span class="pick-result">${badge(L('전술 안내', 'Tactic'), 'accent')}<small class="faint">${L('횟수 미표시', 'No count shown')}</small></span></summary>
      <div class="pick-body"><p class="how">${pick.pick.note}</p><p class="note">${pick.pick.limitation}</p>
        <p class="sources">${external(pick.pick.source, L('적 특성·전술', 'Enemy traits and tactics'))}${external(weapon.source, L('장비', 'Weapon'))}<span>${L('확인', 'Checked')} ${factionCheckedAt}</span></p></div></details>`;
  }
  const { route, mode, reference, tactic, enemy, alternatives, profile } = pick;
  const unitWord = unitOf(mode, route?.hits).unit;
  const outcome = route ? outcomeOf(route) : null;
  const shield = enemy.shield?.partial ? L('조종사 보호막과 기체를 구분하세요. 아래 기체 부위는 보호막 밖 경로입니다.', 'Tell the pilot\'s shield apart from the machine. The machine parts below are routes outside the shield.')
    : enemy.shield ? L(`${enemy.shield.kind === 'energy' ? '보호막을' : '방패를'} 제거·우회한 상태 기준입니다. 그 공격은 횟수에 넣지 않습니다.`, `Assumes the shield has been removed or bypassed; those attacks are not counted.`) : '';
  const advice = tactic || (reference ? { title: L(`${reference.target} 명중 시 ${num(reference.hits)}${unitWord} ${outcomeOf({ outcome: reference.outcome, target: {} }).label} (위키 전술)`, `${num(reference.hits)}${unitOf(mode, reference.hits).unit} on ${T(reference.target)} · ${outcomeOf({ outcome: reference.outcome, target: {} }).label} (wiki tactic)`), body: reference.note, source: reference.source } : null);
  return html`<details class="pick"><summary><span class="rank-num">${index + 1}</span>${weaponIcon(weapon.id)}
    <span><b>${weapon.name}</b><small>${profile.modes.length > 1 ? html`${mode.name} · ` : ''}${pick.pick?.label || ''}</small></span>
    <span class="pick-result">${route ? html`<b>${num(route.hits)}<small style="display:inline;font-size:12px;color:var(--text-3)">${unitWord}${route.lowerBound ? '+' : ''}</small></b><small>${badge(outcome.label, outcome.tone)}</small>` : badge(mode.unsupported ? L('계산 미지원', 'Not supported') : L('계산 보류', 'Not calculated'), 'unknown')}</span></summary>
    <div class="pick-body">
      ${pick.pick?.note ? html`<p class="how">${pick.pick.note}</p>` : ''}
      ${shield ? html`<p class="note" style="color:var(--bleed)">${shield}</p>` : ''}
      ${advice ? html`<div class="callout info"><h3>${advice.title}</h3><p>${advice.body} ${external(advice.source, L('출처', 'Source'))}</p></div>` : ''}
      ${route ? (advice ? html`<details class="disclosure"><summary>${L('단일 부위 계산 보기', 'Single-part calculation')}</summary><div>${routeBlock(pick)}</div></details>` : routeBlock(pick)) : html`<p>${mode.unsupported || L('확인된 처치 경로가 없어 계산을 보류했습니다.', 'No verified kill route, so it was not calculated.')}</p>`}
      ${!advice && alternatives.length ? html`<details class="disclosure"><summary>${L(`다른 조준 위치 ${alternatives.length}곳`, `${alternatives.length} other aim ${alternatives.length === 1 ? 'point' : 'points'}`)}</summary><div>${alternatives.map(other => routeBlock({ ...pick, route: other, approach: null }))}</div></details>` : ''}
      <div class="links"><a class="button small" href="#/enemy/${enemy.id}?w=${weapon.id}&m=${mode.id}">${L('적 대응에서 자세히 →', 'Full details in Enemies →')}</a></div>
      ${pick.approach ? html`<p class="faint" style="font-size:12.5px">${L('적 대응 화면은 선택 부위에 직접 맞히는 기준이라, 위의 정면 폭발 계산(제트팩 직격 제외)과 다를 수 있습니다.', 'The Enemies screen counts direct hits on the chosen part, so it can differ from the frontal-blast math above (which leaves out direct hits on the jetpack).')}</p>` : ''}
      <p class="sources">${external(profile.source, L('무기 수치', 'Weapon stats'))}${external(enemy.source, L('적 수치', 'Enemy stats'))}<span>${L('확인', 'Checked')} ${profile.checkedAt || combatCheckedAt}</span></p>
    </div></details>`;
}

function unitCard(unit) {
  const enemy = findEnemy(unit.enemy);
  const base = enemies.find(item => item.id === unit.base);
  const photo = pickerEnemyImages[enemy.id];
  return html`<article class="panel unit">
    <header class="unit-head">${photo?.src ? html`<img src="${photo.src}" alt="" loading="lazy">` : html`<span></span>`}
      <div><h3>${unit.name || enemy.name}</h3>${base ? html`<span class="base">${L(`일반 ${josa(base.name, ['과', '와'])} 비교`, `Compared with the regular ${T(base.name)}`)}</span>` : ''}<p>${unit.change}</p>
      <p class="sources" style="margin-top:6px">${external(enemy.source, L('유닛 자료', 'Unit data'))}${enemies.some(item => item.id === enemy.id) ? html`<a class="ext" href="#/enemy/${enemy.id}">${L('모든 무기 비교', 'Compare every weapon')}</a>` : ''}</p></div>
    </header>
    <div>${unit.weapons.map((choice, index) => pickRow(unit, choice, index))}</div>
  </article>`;
}

function renderView() {
  const guide = factionGuides.find(item => item.id === state.guide);
  const side = factionSides.find(item => item.id === guide.side);
  render($('#faction-body', root), html`
    <div class="faction-sides" role="group" aria-label="${L('진영', 'Faction')}">${factionSides.map(item => html`<button class="faction-side" type="button" data-side="${item.id}" aria-pressed="${item.id === side.id}"><img src="${item.icon}" alt="">${item.name}</button>`)}</div>
    <div class="chips" role="group" aria-label="${L('세력', 'Enemy force')}">${factionGuides.filter(item => item.side === side.id).map(item => html`<button class="chip" type="button" data-guide="${item.id}" aria-pressed="${item.id === guide.id}">${item.name}</button>`)}</div>
    <section class="panel guide-intro" data-side="${side.id}">${lang === 'en' ? '' : html`<span class="en">${guide.en}</span>`}<h2>${guide.name}</h2><p>${guide.intro}</p>
      ${guide.coverage ? html`<p class="note">${guide.coverage}</p>` : ''}
      <p class="sources">${external(guide.source, L('세력 구성 출처', 'Force roster source'))}<span>${L(`확인 ${factionCheckedAt} · 주요 유닛 ${guide.units.length}종`, `Checked ${factionCheckedAt} · ${guide.units.length} key units`)}</span></p></section>
    <div class="units">${guide.units.map(unitCard)}</div>`);
}

export function mount(container, context) {
  root = container; ctx = context;
  render(root, html`<div class="page-head"><div><div class="eyebrow">Loadout Brief</div><h1>${L('팩션 추천', 'Faction picks')}</h1><p>${L('세력별 주요 유닛과, 조준이 쉽고 다루기 편한 순서로 고른 지원 무기입니다. 가장 적은 탄수 순위가 아닙니다.', 'Key units of each enemy force, with support weapons picked in order of how easy they are to aim and handle — not a fewest-shots ranking.')}</p></div></div>
    <div id="faction-body"></div>
    <p class="faint" style="font-size:12.5px;margin-top:20px">${L('조준 난도·폭발 활용·충전과 재장전 부담을 고려한 입문자용 추천입니다. 고난이도 기준이며 실시간 패치와 연동되지 않습니다.', 'Beginner-friendly picks that weigh aiming difficulty, use of explosions, and charge and reload burden. Based on high difficulties and not linked to live patches.')}</p>`);
  root.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.side) ctx.go({ view: 'factions', id: factionGuides.find(item => item.side === target.dataset.side).id });
    else if (target.dataset.guide) ctx.go({ view: 'factions', id: target.dataset.guide });
  });
}

export function update(route) {
  state.guide = factionGuides.some(item => item.id === route.id) ? route.id : state.guide;
  renderView();
  $$('[aria-pressed="true"]', root)[0]?.blur();
}

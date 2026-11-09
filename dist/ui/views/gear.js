// Gear: browse primaries, secondaries and throwables with their numbers, and
// check a loadout against a faction's key enemies.
//   #/gear[/<weapon>]?cat=<group>&type=<type>&q=<text>&sort=<key>
//   #/gear?tab=loadout&p=<primary>&s=<secondary>&g=<throwable>&st=<a,b,c,d>&f=<faction>
//   #/gear?tab=armor&w=<light|medium|heavy>&a=<armor>   (body armor grouped by passive, gear-armor.js)
import { personalWeapons, personalWeaponsCheckedAt } from '../../data/personal-weapons.js';
import { personalProfiles } from '../../data/personal-profiles.js';
import { weaponImages } from '../../data/weapon-images.js';
import { attachmentParts, weaponAttachments } from '../../data/weapon-attachments.js';
import { apBandOf } from '../../core/catalog.js';
import { search, personalNames } from '../../core/search.js';
import { num } from '../../core/explain.js';
import { html, raw, render, $, $$, icon, badge, external } from '../dom.js';
import { blastFigure } from '../blast.js';
import { GROUPS, groupOf, typeName, weaponById, displayName, orderTypes } from '../gear-shared.js';
import { L, T, lang } from '../../core/i18n.js';

const ELEMENTS = { fire: L('화상', 'Fire'), gas: L('가스', 'Gas'), arc: L('전기', 'Arc'), electric: L('전기', 'Arc') };
const SORTS = [
  { id: '', name: L('기본 순서', 'Default order') },
  { id: 'damage', name: L('피해 순', 'Damage'), value: w => w.direct != null ? w.direct * (w.pellets || 1) : w.splash },
  { id: 'ap', name: L('관통력 순', 'Penetration'), value: w => w.ap ?? w.splashAp },
  { id: 'magazine', name: L('탄창 순', 'Magazine'), value: w => w.magazine ?? w.throwableCapacity },
  { id: 'rpm', name: L('연사 순', 'Fire rate'), value: w => w.rpm },
];

let root, ctx;
const state = { tab: 'browse', cat: 'primary', type: '', q: '', sort: '', detail: null, pushedDetail: false };

// --- Pieces ------------------------------------------------------------------------
export function weaponArt(w, cls = 'gear-art') {
  const image = weaponImages[w.id];
  return html`<span class="${cls}" data-group="${w.category}">${image ? html`<img src="${image.src}" alt="" width="${image.width}" height="${image.height}" loading="lazy" decoding="async">` : html`<span class="faint">${w.code || ''}</span>`}</span>`;
}

const dim = text => ({ text, dim: true });
const value = (number, unit = '') => number == null ? dim(L('미확인', 'Unverified')) : { text: num(number), unit };
const apOf = w => w.ap ?? w.splashAp;
const apText = w => {
  const ap = apOf(w);
  if (ap == null) return null;
  return w.ap != null && w.splashAp != null && w.splashAp !== w.ap ? `AP ${w.ap}/${w.splashAp}` : `AP ${ap}`;
};
// How a throwable goes off: timer, impact, proximity or a choice of timers.
export const fuseText = w => w.fuseType === 'impact' ? L('충격식', 'Impact') : w.fuseType === 'proximity' ? L('근접 감지', 'Proximity') : w.fuseType === 'selectable' && w.fuseOptions?.length ? L(`${w.fuseOptions.map(num).join('/')}초 선택`, `${w.fuseOptions.map(num).join('/')}s selectable`) : w.fuse != null ? `${num(w.fuse)}${L('초', 's')}` : null;
const isUtility = w => w.direct == null && w.splash == null && w.dot?.perSecond == null;

// Four headline numbers, chosen for what matters on that kind of item.
export function gearStats(w) {
  const damage = w.direct != null && w.damageKind === 'dps'
    ? { label: L('지속 피해', 'Damage/s'), text: num(w.direct), unit: '/s', caption: L('광선 초당', 'Beam per second') }
    : w.direct != null
    ? { label: L('피해', 'Damage'), text: w.pellets > 1 ? `${num(w.direct)}×${w.pellets}` : num(w.direct), caption: w.pellets > 1 ? L(`펠릿 ${w.pellets}개`, `${w.pellets} pellets`) : w.splash ? L(`+ 폭발 ${num(w.splash)}`, `+ ${num(w.splash)} blast`) : L('한 발', 'Per shot') }
    : w.splash != null ? { label: L('폭발', 'Blast'), text: num(w.splash), caption: w.shrapnelCount ? L(`+ 파편 ${w.shrapnelCount}개`, `+ ${w.shrapnelCount} fragments`) : L('중심부 최대', 'Max at center') }
    : w.dot?.perSecond != null ? { label: L('지속 피해', 'Damage/s'), text: num(w.dot.perSecond), unit: '/s', caption: ELEMENTS[w.dot.element] || '' }
    : { label: L('피해', 'Damage'), ...dim(isUtility(w) ? L('없음', 'None') : L('미확인', 'Unverified')), caption: isUtility(w) ? L('지원용', 'Utility') : '' };
  const ap = apText(w);
  const pen = { label: L('관통', 'Penetration'), ...(ap ? { text: ap } : dim(isUtility(w) ? '—' : L('미확인', 'Unverified'))), caption: ap ? apBandOf({ ap: apOf(w) })?.name : '' };
  if (w.category === 'throwable') {
    return [damage, pen,
      w.radius != null ? { label: L('반경', 'Radius'), text: num(w.radius), unit: 'm', caption: w.innerRadius != null ? L(`중심 ${num(w.innerRadius)}m`, `Inner ${num(w.innerRadius)}m`) : '' } : { label: L('반경', 'Radius'), ...dim('—') },
      { label: L('소지', 'Carried'), ...value(w.throwableCapacity, L('개', '')), caption: fuseText(w) ? L(`신관 ${fuseText(w)}`, `Fuse: ${fuseText(w)}`) : '' }];
  }
  const ammo = w.heatCapacity?.seconds != null ? { label: L('과열까지', 'Until overheat'), text: num(w.heatCapacity.seconds), unit: L('초', 's'), caption: w.heatCapacity.shots ? L(`약 ${w.heatCapacity.shots}발`, `About ${w.heatCapacity.shots} shots`) : L('무한 탄약', 'Unlimited ammo') }
    : w.swingsPerMinute != null ? { label: L('휘두르기', 'Swings'), text: num(w.swingsPerMinute), unit: L('/분', '/min'), caption: L('근접', 'Melee') }
    : { label: L('탄창', 'Magazine'), ...value(w.magazine), caption: w.spareMags != null ? L(`예비 ${w.spareMags}개`, `${w.spareMags} spare`) : w.spareRounds != null ? L(`예비탄 ${w.spareRounds}`, `${w.spareRounds} spare rounds`) : '' };
  const rate = w.rpmModes?.length > 1 ? { label: L('연사', 'Fire rate'), text: w.rpmModes.map(num).join('/'), caption: L('분당 · 모드별', 'RPM · by mode') }
    : w.rpm != null ? { label: L('연사', 'Fire rate'), text: num(w.rpm), caption: L('분당 발수', 'Rounds per minute') }
    : w.reload != null ? { label: L('재장전', 'Reload'), text: num(w.reload), unit: L('초', 's') } : { label: L('연사', 'Fire rate'), ...dim('—') };
  return [damage, pen, ammo, rate];
}

const statRow = w => html`<dl class="stat-row">${gearStats(w).map(stat => html`<div><dt>${stat.label}</dt><dd class="${stat.dim ? 'dim' : ''}" title="${stat.dim ? stat.text : ''}">${lang === 'en' && stat.dim && stat.text === 'Unverified' ? '?' : stat.text}${stat.unit ? html`<small>${stat.unit}</small>` : ''}</dd></div>`)}</dl>`;

export function traits(w) {
  const list = [];
  if (w.dot?.element) list.push(badge(ELEMENTS[w.dot.element] || w.dot.element, 'bleed'));
  if (w.category !== 'throwable' && w.splash > 0) list.push(badge(L('폭발', 'Explosive')));
  if (w.heatCapacity?.raw) list.push(badge(L('과열식', 'Heat-based')));
  if (w.pellets > 1) list.push(badge(L('산탄', 'Pellets')));
  // Selectable firing modes only: variants are damage components (an impact
  // and its delayed explosion), not modes the player switches between.
  const modes = personalProfiles[w.id]?.modes.length ?? 0;
  if (modes > 1) list.push(badge(L(`모드 ${modes}`, `${modes} modes`)));
  return list;
}

function card(w) {
  return html`<article class="card gear-card" style="--cat:${groupOf(w.category).color}" data-id="${w.id}">
    <button class="card-open" type="button" data-open="${w.id}" aria-label="${displayName(w)} ${L('자세히 보기', 'details')}">
      ${weaponArt(w)}
      <div class="gear-title"><h3>${displayName(w)}</h3><p class="en">${lang === 'en' ? '' : w.en}</p></div>
      <div class="chips gear-traits">${badge(typeName(w.type), 'outline')}${traits(w)}</div>
      ${statRow(w)}
    </button>
  </article>`;
}

// --- Browse ------------------------------------------------------------------------
const typesOf = cat => orderTypes(new Set(personalWeapons.filter(w => w.category === cat).map(w => w.type)));
const fields = w => ({ names: personalNames(w), text: [typeName(w.type), groupOf(w.category).name] });

function visibleItems() {
  // A search looks across every group, so "세열" finds the grenade from the rifle list.
  let items = state.q ? personalWeapons : personalWeapons.filter(w => w.category === state.cat && (!state.type || w.type === state.type));
  items = search(items, state.q, fields);
  const sort = SORTS.find(item => item.id === state.sort);
  if (sort?.value) items = [...items].sort((a, b) => (sort.value(b) ?? -1) - (sort.value(a) ?? -1));
  return items;
}

function syncUrl() {
  const query = state.tab === 'loadout' ? { tab: 'loadout', ...loadoutQuery() } : state.tab === 'armor' ? { tab: 'armor', w: armor.weight, a: armor.focus } : { cat: state.cat === 'primary' ? '' : state.cat, type: state.type, q: state.q, sort: state.sort };
  ctx.replace({ view: 'gear', id: state.detail, query });
}

function renderBrowse() {
  const items = visibleItems();
  for (const button of $$('[data-cat]', root)) button.setAttribute('aria-pressed', String(!state.q && button.dataset.cat === state.cat));
  const types = typesOf(state.cat);
  render($('#gear-types', root), types.length > 1 ? html`<button class="chip" type="button" data-type="" aria-pressed="${!state.type}">${L('전체', 'All')}</button>${types.map(type => html`<button class="chip" type="button" data-type="${type}" aria-pressed="${state.type === type}">${typeName(type)} <span class="count">${personalWeapons.filter(w => w.category === state.cat && w.type === type).length}</span></button>`)}` : '');
  $('#gear-types', root).hidden = Boolean(state.q) || types.length < 2;
  const total = personalWeapons.filter(w => w.category === state.cat).length;
  $('#gear-count', root).innerHTML = html`<span>${L(html`<b>${items.length}</b>개 표시${state.q ? ' · 모든 분류에서 검색' : ` · ${groupOf(state.cat).name} ${total}개`}`, html`Showing <b>${items.length}</b>${state.q ? ' · searching every group' : ` of ${total} ${groupOf(state.cat).name.toLowerCase()}`}`)}</span>`.toString();
  render($('#gear-grid', root), items.length ? items.map(card) : html`<div class="empty" style="grid-column:1/-1"><h3>${L('맞는 장비가 없습니다', 'No matching gear')}</h3><p>${L('검색어를 줄이거나 분류를 바꿔 보세요.', 'Try a shorter search or another group.')}</p></div>`);
}

// --- Detail sheet ------------------------------------------------------------------
function detailRows(w) {
  const rows = [];
  // Numbers show at full strength; words (a fuse type, raw wiki text) are dimmed.
  const add = (label, text, unit = '', caption = '') => text != null && rows.push({ label, text, unit, caption, dim: !/\d/.test(String(text)) });
  const s = L('초', 's'), perSecond = L('/초', '/s');
  if (w.direct != null && w.damageKind === 'dps') add(L('광선 피해', 'Beam damage'), num(w.direct), perSecond, L('비추고 있는 동안', 'While the beam is on target'));
  else if (w.direct != null) add(w.pellets > 1 ? L('펠릿당 피해', 'Damage per pellet') : L('직격 피해', 'Direct damage'), num(w.direct), '', w.pellets > 1 ? L(`${w.pellets}발 모두 맞으면 ${num(w.direct * w.pellets)}`, `${num(w.direct * w.pellets)} if all ${w.pellets} hit`) : L('장갑에 막히지 않을 때', 'When armor does not stop it'));
  if (w.durable != null) add(L('내구 피해', 'Durable damage'), num(w.durable), '', L('단단한 부위에 들어가는 피해', 'Damage against durable parts'));
  if (apOf(w) != null) add(L('관통력', 'Penetration'), apText(w), '', apBandOf({ ap: apOf(w) })?.name);
  if (w.splash != null) add(L('폭발 피해', 'Blast damage'), num(w.splash), '', w.splashAp != null ? L(`폭발 AP ${w.splashAp}`, `Blast AP ${w.splashAp}`) : '');
  if (w.shrapnelCount) add(L('파편', 'Fragments'), num(w.shrapnelCount), L('개', ''), L('폭발 1회당 · 다 맞지는 않음', 'Per explosion · not all of them hit'));
  if (w.dot?.perSecond != null) add(L(`${ELEMENTS[w.dot.element] || '지속'} 피해`, `${ELEMENTS[w.dot.element] || 'Over-time'} damage`), num(w.dot.perSecond), perSecond, w.dot.duration != null ? L(`${num(w.dot.duration)}초 동안`, `For ${num(w.dot.duration)}s`) : L('불이 붙어 있는 동안', 'While it burns'));
  if (w.magazine != null) add(L('탄창', 'Magazine'), num(w.magazine), L('발', ''));
  if (w.spareMags != null) add(L('예비 탄창', 'Spare magazines'), num(w.spareMags), L('개', ''), L('최대 보유', 'Maximum carried'));
  if (w.spareRounds != null) add(L('예비탄', 'Spare rounds'), num(w.spareRounds), L('발', ''), L('한 발씩 장전', 'Loaded one at a time'));
  if (w.heatCapacity?.raw) add(L('과열까지', 'Until overheat'), w.heatCapacity.seconds != null ? num(w.heatCapacity.seconds) : w.heatCapacity.raw, w.heatCapacity.seconds != null ? s : '', w.heatCapacity.shots ? L(`약 ${w.heatCapacity.shots}발 · 방열판 교체로 재장전`, `About ${w.heatCapacity.shots} shots · reload by swapping the heatsink`) : L('방열판 교체로 재장전', 'Reload by swapping the heatsink'));
  if (w.rpmModes?.length > 1) add(L('연사 모드', 'Fire rate modes'), w.rpmModes.map(num).join(' / '), '', L('분당 발수', 'Rounds per minute'));
  else if (w.rpm != null) add(L('연사', 'Fire rate'), num(w.rpm), '', L('분당 발수', 'Rounds per minute'));
  if (w.swingsPerMinute != null) add(L('휘두르기', 'Swings'), num(w.swingsPerMinute), L('/분', '/min'));
  if (w.reload != null) add(L('재장전', 'Reload'), num(w.reload), s, w.reloadTactical != null ? L(`탄이 남았을 때 ${num(w.reloadTactical)}초`, `${num(w.reloadTactical)}s with rounds left`) : L('탄창을 비웠을 때', 'From empty'));
  if (w.throwableCapacity != null) add(L('소지 수', 'Carried'), num(w.throwableCapacity), L('개', ''), w.throwableStart != null ? L(`출격 시 ${w.throwableStart}개`, `${w.throwableStart} at deployment`) : '');
  if (w.fuse != null) add(L('신관', 'Fuse'), num(w.fuse), s, L('던진 뒤 폭발까지', 'From throw to detonation'));
  else if (fuseText(w)) add(L('신관', 'Fuse'), fuseText(w), '', { impact: L('닿는 순간 폭발', 'Explodes on contact'), proximity: L('적이 가까이 오면 폭발', 'Explodes when an enemy comes close'), selectable: L('던지기 전에 시간 선택', 'Pick the timer before throwing') }[w.fuseType] || '');
  if (w.radius != null) add(L('폭발 반경', 'Blast radius'), num(w.radius), 'm', w.innerRadius != null ? L(`중심 ${num(w.innerRadius)}m까지 최대 피해`, `Full damage within ${num(w.innerRadius)}m`) : L('외곽', 'Outer'));
  return rows;
}

// Player-facing names for data-mined attack components.
const variantLabel = v => v.displayName || (v.id === 'shrapnel' ? L('파편 (1개당)', 'Fragment (each)') : /^explosion-/.test(v.id) ? L('폭발', 'Explosion') : /^projectile-/.test(v.id) ? L('탄체', 'Projectile') : /^charge-stage-/.test(v.id) ? v.name.split(' · ')[0] : v.name);

function variantTable(w) {
  const variants = w.variants || [];
  if (variants.length < 2) return '';
  return html`<section class="block gear-block"><h3>${L('모드·구성 요소별 수치', 'Stats by mode and component')}</h3>
    <div class="compare-scroll" role="region" aria-label="${L('모드별 수치', 'Stats by mode')}" tabindex="0"><table class="compare-table gear-modes">
      <thead><tr><th scope="col">${L('구분', 'Part')}</th><th scope="col">${L('직격', 'Direct')}</th><th scope="col">${L('관통', 'Penetration')}</th><th scope="col">${L('폭발', 'Blast')}</th><th scope="col">${L('반경', 'Radius')}</th></tr></thead>
      <tbody>${variants.map(v => html`<tr><th scope="row">${variantLabel(v)}</th>
        <td>${v.direct != null ? html`${num(v.direct)}${v.pellets > 1 ? html`<small>×${v.pellets}</small>` : ''}` : html`<span class="faint">—</span>`}</td>
        <td>${v.ap != null ? `AP ${v.ap}` : v.splashAp != null ? `AP ${v.splashAp}` : html`<span class="faint">—</span>`}</td>
        <td>${v.splash != null ? num(v.splash) : html`<span class="faint">—</span>`}</td>
        <td>${v.radius != null ? `${num(v.radius)}m` : html`<span class="faint">—</span>`}</td></tr>`)}</tbody>
    </table></div></section>`;
}

// Customization (primary weapons): every attachment per slot with its unlock level,
// cost and stat changes, from the wiki's attachments table (weapon-attachments.js).
const slotName = slot => ({ optics: L('광학 장비', 'Optics'), underbarrel: L('총열 하부', 'Underbarrel'), muzzle: L('총구', 'Muzzle'), magazine: L('탄창', 'Magazine') })[slot];
const signed = n => n > 0 ? `+${num(n)}` : num(n);
// "+25%" / "-20%" are changes from the base weapon; "= 75" sets the value outright.
const change = v => v.startsWith('=') ? L(`${v.slice(1).trim()}로 고정`, `set to ${v.slice(1).trim()}`) : v;
const DEG = '\u00b0C'; // degree sign
const EFFECTS = [
  ['ergonomics', () => L('인체공학성', 'Ergonomics'), signed],
  ['zoom', () => L('조준 거리', 'Zoom'), v => v.map(n => `${num(n)}m`).join(' / ')],
  ['sway', () => L('흔들림', 'Sway'), change],
  ['fireRate', () => L('연사', 'Fire rate'), v => L(`분당 ${num(v)}발`, `${num(v)} RPM`)],
  ['verticalRecoil', () => L('수직 반동', 'Vertical recoil'), change],
  ['horizontalRecoil', () => L('수평 반동', 'Horizontal recoil'), change],
  ['verticalSpread', () => L('수직 확산', 'Vertical spread'), change],
  ['horizontalSpread', () => L('수평 확산', 'Horizontal spread'), change],
  ['magCapacity', () => L('탄창 용량', 'Capacity'), v => L(`${num(v)}발`, `${num(v)} rounds`)],
  ['overheat', () => L('과열 온도', 'Overheats at'), v => `${num(v)}${DEG}`],
  ['cooldown', () => L('냉각 속도', 'Cooldown'), v => L(`초당 ${num(v)}${DEG}`, `${num(v)}${DEG}/s`)],
  ['heatPerShot', () => L('발당 열', 'Heat per shot'), v => `${num(v)}${DEG}`],
  ['startMags', () => L('출격 시 탄창', 'Starting magazines'), v => L(`${num(v)}개`, num(v))],
  ['maxMags', () => L('최대 탄창', 'Max magazines'), v => L(`${num(v)}개`, num(v))],
  ['reload', () => L('재장전', 'Reload'), v => L(`${num(v)}초`, `${num(v)}s`)],
  ['reloadTactical', () => L('탄이 남았을 때 재장전', 'Reload with rounds left'), v => L(`${num(v)}초`, `${num(v)}s`)],
  ['function', () => L('기능', 'Function'), v => v.map(f => f === 'laser' ? L('레이저 조준', 'Laser') : L('조명', 'Flashlight')).join(' + ')],
];
export const attachmentEffects = effects => EFFECTS.filter(([key]) => effects[key] != null).map(([key, label, text]) => ({ key, label: label(), text: text(effects[key]) }));

export function attachmentTable(w) {
  const list = w.category === 'primary' ? weaponAttachments[w.id] : null;
  if (!list?.length) return '';
  const unconfirmed = html`<span class="dim">${L('미확인', 'Unverified')}</span>`;
  const slots = [...new Set(list.map(item => attachmentParts[item.part].slot))];
  const row = item => {
    const part = attachmentParts[item.part];
    const effects = part.effects ? attachmentEffects(part.effects) : null;
    return html`<tr><th scope="row">${part.none ? L('장착 안 함', part.name) : part.name}</th>
      <td>${item.level != null ? L(`레벨 ${item.level}`, `Level ${item.level}`) : unconfirmed}</td>
      <td>${item.builtIn ? L('기본 장착', 'Built in') : item.cost != null ? num(item.cost) : unconfirmed}</td>
      <td>${effects == null ? unconfirmed : effects.length ? html`<ul class="attach-effects">${effects.map(e => html`<li>${e.label} <b>${e.text}</b></li>`)}</ul>` : html`<span class="faint">${L('변화 없음', 'No change')}</span>`}</td></tr>`;
  };
  return html`<section class="block gear-block gear-attach-block"><h3>${L('커스터마이징', 'Customization')}</h3>
    <div class="compare-scroll" role="region" aria-label="${L('부착물', 'Attachments')}" tabindex="0"><table class="compare-table gear-modes gear-attach">
      <thead><tr><th scope="col">${L('부착물', 'Attachment')}</th><th scope="col">${L('해금', 'Unlock')}</th><th scope="col">${L('비용', 'Cost')}</th><th scope="col">${L('변동 수치', 'Stat changes')}</th></tr></thead>
      ${slots.map(slot => html`<tbody><tr class="attach-slot"><th scope="rowgroup" colspan="4">${slotName(slot)}</th></tr>${list.filter(item => attachmentParts[item.part].slot === slot).map(row)}</tbody>`)}
    </table></div>
    <p class="faint attach-note">${L('+/-와 %는 기본 상태 대비 변화, 탄창 용량과 탄창 수, 재장전 시간은 장착했을 때의 값입니다. 해금은 무기 레벨, 비용은 요청 신청서 기준입니다. 부착물 이름은 영어 표기입니다.', 'Signed numbers and percentages are changes from the base weapon; capacity, magazine counts and reload times are the values with the attachment fitted. Unlock is the weapon level; cost is in Requisition Slips.')} ${external(`${w.source}#Attachments`, L('위키 부착물 표', 'Wiki attachments table'))}</p>
  </section>`;
}

export function weaponDetail(w, { header = null, titleId = 'sheet-title' } = {}) {
  const group = groupOf(w.category);
  const conflicts = w.infoboxConflicts || [];
  const image = weaponImages[w.id];
  return html`${header ?? html`<div class="sheet-top"><span>${group.name} · ${L('상세', 'Details')}</span><button class="icon-button" type="button" data-close aria-label="${L('닫기', 'Close')}">${icon('close', 18)}</button></div>`}
  <div class="sheet-content">
    ${weaponArt(w, 'gear-art large')}
    <div class="detail-id gear-id"><div><h2 id="${titleId}">${displayName(w)}</h2><p>${lang === 'en' ? '' : w.en}</p>
      <div class="chips" style="margin-top:6px">${badge(group.name, 'outline')}${badge(typeName(w.type))}${apOf(w) != null ? badge(`${apText(w)} · ${apBandOf({ ap: apOf(w) })?.name}`, 'accent') : ''}${traits(w)}</div></div></div>
    <dl class="detail-grid">${detailRows(w).map(row => html`<div><dt>${row.label}</dt><dd class="${row.dim ? 'dim' : ''}">${row.text}${row.unit ? html`<small>${row.unit}</small>` : ''}</dd>${row.caption ? html`<div class="caption">${row.caption}</div>` : ''}</div>`)}</dl>
    ${blastFigure(w)}
    ${variantTable(w)}
    ${attachmentTable(w)}
    ${conflicts.length ? html`<div class="callout warn"><h3>${L('위키 페이지 표시값과 다름', 'Differs from the wiki page')}</h3><p>${conflicts.map(c => L(`${c.label || c.field}: 데이터 ${Array.isArray(c.db) ? c.db.join('~') : c.db} / 페이지 ${c.raw ?? c.infobox}`, `${T(c.label) || c.field}: data ${Array.isArray(c.db) ? c.db.join('~') : c.db} / page ${c.raw ?? c.infobox}`)).join(' · ')}. ${L('더 최신인 게임 데이터 값을 표시합니다.', 'The newer game data value is shown.')}</p></div>` : ''}
    ${w.playerNotes?.length ? html`<section class="block"><h3>${L('알아 둘 점', 'Good to know')}</h3><ul class="notes">${w.playerNotes.map(note => html`<li>${note}</li>`)}</ul></section>` : ''}
    <div class="links">
      ${w.category !== 'throwable' || w.splash != null ? html`<a class="button primary" href="#/enemy?w=${w.id}">${icon('enemy', 18)} ${L('적 대응 계산', 'Shots to kill')}</a>` : ''}
      <a class="button" href="${raw(loadoutHref({ [slotOf(w)]: w.id }))}">${icon('gear', 18)} ${L('로드아웃에 넣기', 'Add to loadout')}</a>
    </div>
    <div class="sources">
      <span>${L('자료 확인', 'Checked')} ${personalWeaponsCheckedAt}</span>
      ${external(w.source, L('위키 항목', 'Wiki page'))}
      ${image ? external(image.source, L('이미지 원본', 'Image source')) : ''}
    </div>
    <p class="faint" style="font-size:12.5px">${L('기본 상태(부착물·함선 강화 제외) 기준입니다. 실제 피해는 맞은 부위의 장갑·내구도와 거리, 각도에 따라 달라집니다.', 'Base values without attachments or ship modules. Real damage depends on the armor and durability of the part you hit, range and angle.')}</p>
  </div>`;
}

function openDetail(id) {
  const w = weaponById.get(id);
  if (!w) return;
  ctx.openSheet(weaponDetail(w), {
    label: `${T(displayName(w))} ${L('상세', 'details')}`,
    onClose: () => {
      if (state.detail !== id) return;
      state.detail = null;
      if (state.pushedDetail) { state.pushedDetail = false; history.back(); } else syncUrl();
    },
  });
}

// --- Loadout -----------------------------------------------------------------------
const SLOT_OF = { primary: 'p', secondary: 's', throwable: 'g' };
const slotOf = w => SLOT_OF[w.category];
const loadout = { p: '', s: '', g: '', st: ['', '', '', ''], f: '', shield: true };
function loadoutQuery() { return { p: loadout.p, s: loadout.s, g: loadout.g, st: loadout.st.some(Boolean) ? loadout.st.join(',') : '', f: loadout.f, sh: loadout.shield ? '' : '0' }; }
function loadoutHref(patch) {
  const query = new URLSearchParams(Object.entries({ tab: 'loadout', ...loadoutQuery(), ...patch }).filter(([, v]) => v));
  return `#/gear?${query}`;
}

let loadoutUi = null;
async function renderLoadout() {
  const panel = $('#gear-loadout', root);
  if (!loadoutUi) {
    render(panel, html`<p class="faint" style="padding:24px 0">${L('로드아웃 점검 도구를 불러오는 중…', 'Loading the loadout check…')}</p>`);
    loadoutUi = import('./gear-loadout.js');
  }
  const module = await loadoutUi;
  if (state.tab !== 'loadout') return;
  module.renderLoadout(panel, { ctx, loadout, onChange: () => { syncUrl(); renderLoadout(); } });
}

// --- Armor -------------------------------------------------------------------------
const armor = { weight: '', focus: '' };
const ARMOR_WEIGHTS = ['light', 'medium', 'heavy'];
let armorUi = null;
async function renderArmor() {
  const panel = $('#gear-armor', root);
  if (!armorUi) {
    render(panel, html`<p class="faint" style="padding:24px 0">${L('방어구 목록을 불러오는 중…', 'Loading the armor list…')}</p>`);
    armorUi = import('./gear-armor.js');
  }
  const module = await armorUi;
  if (state.tab !== 'armor') return;
  module.renderArmor(panel, { state: armor, onChange: () => { syncUrl(); renderArmor(); } });
}

// --- View lifecycle -------------------------------------------------------------------
const LEDES = {
  browse: '',
  loadout: L('무기와 스트라타젬을 담고 팩션을 고르면, 주요 적마다 무엇으로 몇 번 만에 처치하는지와 대응 공백을 보여 줍니다.', 'Fill in your weapons and stratagems and pick a faction to see what kills each key enemy in how many shots — and where your loadout has gaps.'),
  armor: L('몸통 방어구를 패시브별로 묶었습니다. 장갑 등급이 높을수록 덜 다치는 대신 속도와 스태미나 회복이 낮아집니다.', 'Body armor grouped by passive. A higher armor rating means less damage taken, at the cost of speed and stamina regen.'),
};
function showTab() {
  for (const button of $$('[data-tab-pick]', root)) button.setAttribute('aria-pressed', String(button.dataset.tabPick === state.tab));
  $('#gear-lede', root).textContent = LEDES[state.tab];
  $('#gear-browse', root).hidden = state.tab !== 'browse';
  $('#gear-loadout', root).hidden = state.tab !== 'loadout';
  $('#gear-armor', root).hidden = state.tab !== 'armor';
  if (state.tab === 'browse') renderBrowse();
  else if (state.tab === 'armor') renderArmor().catch(error => { console.error(error); ctx.toast(L('방어구 목록을 불러오지 못했습니다.', 'The armor list could not be loaded.')); });
  else renderLoadout().catch(error => { console.error(error); ctx.toast(L('로드아웃 점검 도구를 불러오지 못했습니다.', 'The loadout check could not be loaded.')); });
}

export function mount(container, context) {
  root = container; ctx = context;
  const count = id => personalWeapons.filter(w => w.category === id).length;
  LEDES.browse = L(`주무기 ${count('primary')}종 · 보조무기 ${count('secondary')}종 · 투척 ${count('throwable')}종의 수치. 카드를 누르면 자세한 기준이 열립니다.`, `Stats for ${count('primary')} primaries, ${count('secondary')} secondaries and ${count('throwable')} throwables. Open a card for the details behind the numbers.`);
  render(root, html`<div class="page-head gear-head"><div><div class="eyebrow">Armory</div>
    <h1 class="sr-only">${L('장비', 'Gear')}</h1>
    <div class="gear-tabs" role="group" aria-label="${L('장비 보기', 'Gear views')}"><button type="button" data-tab-pick="browse">${L('장비 둘러보기', 'Browse gear')}</button><button type="button" data-tab-pick="loadout">${L('로드아웃 점검', 'Loadout check')}</button><button type="button" data-tab-pick="armor">${L('방어구', 'Armor')}</button></div>
    <p id="gear-lede"></p></div></div>
  <div id="gear-browse">
    <div class="arsenal-tools">
      <div class="row">
        <label class="field">${icon('search', 18)}<span class="sr-only">${L('장비 검색', 'Search gear')}</span><input class="input" id="gear-q" type="search" placeholder="${L('이름·코드 검색 — 초성도 됩니다 (예: ㄹㅂㄹㅇㅌ, AR-23)', 'Search by name or code (e.g. Liberator, AR-23)')}" autocomplete="off"></label>
        <label><span class="sr-only">${L('정렬', 'Sort')}</span><select class="select" id="gear-sort">${SORTS.map(sort => html`<option value="${sort.id}">${sort.name}</option>`)}</select></label>
      </div>
      <div class="segmented gear-groups" role="group" aria-label="${L('분류', 'Group')}">${GROUPS.map(group => html`<button type="button" data-cat="${group.id}" style="--dot:${group.color}"><span class="dot"></span>${group.name} <span class="count">${count(group.id)}</span></button>`)}</div>
      <div class="chips" id="gear-types" role="group" aria-label="${L('세부 종류', 'Type')}"></div>
    </div>
    <div class="arsenal-meta"><span id="gear-count" role="status"></span></div>
    <div id="gear-grid" class="grid gear-grid"></div>
  </div>
  <div id="gear-loadout" hidden></div>
  <div id="gear-armor" hidden></div>`);

  const input = $('#gear-q', root);
  input.addEventListener('input', () => { state.q = input.value; renderBrowse(); syncUrl(); });
  $('#gear-sort', root).addEventListener('change', event => { state.sort = event.target.value; renderBrowse(); syncUrl(); });
  root.addEventListener('click', event => {
    const target = event.target.closest('button, a');
    if (!target) return;
    if (target.dataset.tabPick) { state.tab = target.dataset.tabPick; showTab(); syncUrl(); }
    else if (target.dataset.cat) { state.cat = target.dataset.cat; state.type = ''; state.q = ''; input.value = ''; renderBrowse(); syncUrl(); }
    else if (target.dataset.type != null) { state.type = state.type === target.dataset.type ? '' : target.dataset.type; renderBrowse(); syncUrl(); }
    else if (target.dataset.open) { state.pushedDetail = true; ctx.go({ view: 'gear', id: target.dataset.open, query: ctx.route.query }); }
  });
}

export function update(route) {
  const q = route.query;
  state.tab = q.tab === 'loadout' || q.tab === 'armor' ? q.tab : 'browse';
  if (state.tab === 'armor') Object.assign(armor, { weight: ARMOR_WEIGHTS.includes(q.w) ? q.w : '', focus: q.a || '' });
  else if (state.tab === 'browse') {
    Object.assign(state, {
      cat: GROUPS.some(group => group.id === q.cat) ? q.cat : 'primary',
      q: q.q || '', sort: SORTS.some(sort => sort.id === q.sort) ? q.sort : '',
    });
    state.type = typesOf(state.cat).includes(q.type) ? q.type : '';
    $('#gear-q', root).value = state.q;
    $('#gear-sort', root).value = state.sort;
  } else {
    const valid = (id, cat) => weaponById.get(id)?.category === cat ? id : '';
    Object.assign(loadout, { p: valid(q.p, 'primary'), s: valid(q.s, 'secondary'), g: valid(q.g, 'throwable'), f: q.f || '', shield: q.sh !== '0' });
    loadout.st = [...String(q.st || '').split(',').slice(0, 4), '', '', '', ''].slice(0, 4);
  }
  showTab();
  const id = weaponById.has(route.id) ? route.id : null;
  if (id && id !== state.detail) { state.detail = id; openDetail(id); }
  else if (!id && state.detail) { state.detail = null; state.pushedDetail = false; ctx.closeSheet(); }
}

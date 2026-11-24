// Shared lookups for the gear tab and its loadout check (kept apart so the two
// view modules never import each other).
import { personalWeapons } from '../data/personal-weapons.js';
import { weaponRecoil } from '../data/weapon-recoil.js';
import { L } from '../core/i18n.js';

export const GROUPS = [
  { id: 'primary', name: L('주무기', 'Primary'), color: 'var(--g-primary)' },
  { id: 'secondary', name: L('보조무기', 'Secondary'), color: 'var(--g-secondary)' },
  { id: 'throwable', name: L('투척', 'Throwable'), color: 'var(--g-throwable)' },
];
export const groupOf = id => GROUPS.find(group => group.id === id);
const TYPE_NAMES = L({
  'assault-rifles': '돌격소총', 'marksman-rifles': '지정사수소총', 'sniper-rifles': '저격소총', shotguns: '산탄총', 'submachine-guns': '기관단총',
  'energy-based': '에너지', explosives: '폭발형', special: '특수', pistols: '권총', melee: '근접', standard: '표준',
}, {
  'assault-rifles': 'Assault rifles', 'marksman-rifles': 'Marksman rifles', 'sniper-rifles': 'Sniper rifles', shotguns: 'Shotguns', 'submachine-guns': 'SMGs',
  'energy-based': 'Energy', explosives: 'Explosive', special: 'Special', pistols: 'Pistols', melee: 'Melee', standard: 'Standard',
});
// Subtypes in the order players think of them, used by chips and grouped lists.
const TYPE_ORDER = ['assault-rifles', 'marksman-rifles', 'sniper-rifles', 'submachine-guns', 'shotguns', 'explosives', 'energy-based', 'pistols', 'melee', 'standard', 'special'];
export const orderTypes = types => [...types].sort((a, b) => (TYPE_ORDER.indexOf(a) + 1 || 99) - (TYPE_ORDER.indexOf(b) + 1 || 99));
export const typeName = type => TYPE_NAMES[type] || type || L('기타', 'Other');
export const weaponById = new Map(personalWeapons.map(weapon => [weapon.id, weapon]));
// Use the weapon's own English name: Korean names can also name an enemy
// (e.g. 스토커 is both the Stoker weapon and the Stalker enemy).
export const displayName = w => L(w.name || w.en, w.en || w.name);

// Base recoil cells for a gear or support weapon detail (weapon-recoil.js, key 'gear/<id>' or 'arsenal/<id>'):
// how far the weapon kicks and how far the view climbs, horizontal / vertical, before stance and attachments.
// Launchers whose round flies on its own motor show the same small kick (2.5 / 10) as melee weapons; the
// source does not say why, so the note says it is our reading (user request 2026-11-24).
const SELF_PROPELLED = new Set(['arsenal/commando', 'arsenal/expendable-at', 'arsenal/expendable-napalm', 'arsenal/leveller', 'arsenal/spear', 'arsenal/wasp']);

export function recoilStats(key) {
  const recoil = weaponRecoil[key];
  if (!recoil) return [];
  const rocket = SELF_PROPELLED.has(key) ? L(' · 로켓이 스스로 날아가 반동이 거의 없는 것으로 보임', ' · the rocket flies on its own motor, so there is little kick (our reading)') : '';
  const pair = ([h, v]) => `${h} / ${v}`;
  const limit = recoil.limit ? L(` · 위로 ${recoil.limit[0]}도부터 세로 반동 줄어듦`, ` · vertical kick eases off from ${recoil.limit[0]} degrees up`) : '';
  return [
    { label: L('무기 반동', 'Weapon kick'), text: pair(recoil.drift), caption: L('가로 / 세로 · 무기가 튀는 정도', 'Horizontal / vertical · how far the weapon kicks') + rocket },
    { label: L('화면 반동', 'View climb'), text: pair(recoil.climb), caption: L('가로 / 세로 · 화면이 올라가는 정도', 'Horizontal / vertical · how far the view climbs') + limit },
  ];
}

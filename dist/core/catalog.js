// The stratagem catalogue: every entry from the data files, in category order,
// with the few fields the data leaves implicit filled in.
import { support } from '../data/data-support.js';
import { orbitals, eagles } from '../data/data-offense.js';
import { backpacks, defense, vehicles } from '../data/data-equipment.js';
import { missions } from '../data/data-mission.js';
import { L } from './i18n.js';

export const CHECKED_AT = '2026-09-16';

export const categories = [
  { id: 'support', name: L('지원 무기', 'Support Weapons'), hint: L('직접 들고 싸우는 세 번째 무기', 'The third weapon you carry into the fight'), color: 'var(--c-support)' },
  { id: 'orbital', name: L('궤도 지원', 'Orbitals'), hint: L('구축함이 내려보내는 포격', 'Strikes from your Super Destroyer'), color: 'var(--c-orbital)' },
  { id: 'eagle', name: L('이글', 'Eagles'), hint: L('짧은 간격의 근접 항공 지원', 'Close air support on short cooldowns'), color: 'var(--c-eagle)' },
  { id: 'defense', name: L('방어 설비', 'Defensive'), hint: L('센트리·설치 무기·보호막', 'Sentries, emplacements, shields'), color: 'var(--c-defense)' },
  { id: 'backpack', name: L('배낭', 'Backpacks'), hint: L('생존·기동·보급', 'Survival, mobility, supply'), color: 'var(--c-backpack)' },
  { id: 'vehicle', name: L('차량·엑소슈트', 'Vehicles & Exosuits'), hint: L('타고 싸우는 장비', 'Gear you ride into battle'), color: 'var(--c-vehicle)' },
  { id: 'mission', name: L('임무·공용', 'Mission & Common'), hint: L('보급과 임무 목표', 'Resupply and objectives'), color: 'var(--c-mission)' },
];
export const categoryOf = id => categories.find(item => item.id === id);

const wiki = title => `https://helldivers.wiki.gg/wiki/${title.replaceAll(' ', '_')}`;
const groups = { support, orbital: orbitals, eagle: eagles, defense, backpack: backpacks, vehicle: vehicles, mission: missions };

export const stratagems = Object.entries(groups).flatMap(([category, items]) => items.map(item => ({
  category,
  direct: null, splash: null, ap: null, range: null, radius: null,
  source: wiki(item.en),
  ...item,
})));
export const stratagemById = new Map(stratagems.map(item => [item.id, item]));

// Weapons with switchable ammunition or armaments list each mode's numbers in
// `variants`; a variant replaces every per-shot stat so nothing leaks between modes.
const VARIANT_STATS = ['direct', 'directText', 'directNoteShort', 'durable', 'splash', 'splashText', 'splashNoteShort', 'ap', 'apNoteShort', 'splashAp', 'radius', 'innerRadius', 'unit'];
export const withVariant = (item, variant) => variant
  ? { ...item, ...Object.fromEntries(VARIANT_STATS.map(key => [key, variant[key] ?? (key === 'radius' || key === 'innerRadius' ? null : undefined)])) }
  : item;
export const variantOf = (item, id) => item.variants?.find(variant => variant.id === id) || item.variants?.[0] || null;

// Armor penetration bands used for filtering and labels.
export const apBands = [
  { id: 'tank', name: L('대전차', 'Anti-tank'), test: item => item.ap >= 5, label: 'AP 5+' },
  { id: 'heavy', name: L('중장갑', 'Heavy armor'), test: item => item.ap === 4, label: 'AP 4' },
  { id: 'medium', name: L('일반 장갑', 'Medium armor'), test: item => item.ap === 3, label: 'AP 3' },
  { id: 'light', name: L('경장갑', 'Light armor'), test: item => item.ap != null && item.ap <= 2, label: 'AP ≤2' },
  { id: 'utility', name: L('지원용', 'Utility'), test: item => Boolean(item.utility), label: L('피해 없음', 'No damage') },
  { id: 'unknown', name: L('미확인', 'Unverified'), test: item => item.ap == null && !item.utility, label: 'AP ?' },
];
export const apBandOf = item => apBands.find(band => band.test(item));

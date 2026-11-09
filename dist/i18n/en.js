// The English dictionary: Korean data text → English, loaded only by the
// English edition (ui/main.js). Official names come straight from the data's
// own English fields; everything else is in one file per data area under en/.
// A Korean string edited in dist/data needs its English updated here too —
// `npm run check` lists any string that has no English.
import { stratagems } from '../core/catalog.js';
import { personalWeapons } from '../data/personal-weapons.js';
import { factionGuides } from '../data/faction-data.js';
import { warbonds } from '../data/warbonds.js';
import { armors, armorPassives } from '../data/armor.js';
import stratagemText from './en/stratagems.js';
import enemyText from './en/enemies.js';
import gearText from './en/gear.js';
import demolitionText from './en/demolition.js';
import factionText from './en/factions.js';
import warbondText from './en/warbonds.js';
import armorText from './en/armor.js';

// Armor: set and passive names, the wiki's own effect lines and the acquisition names.
const armorNames = [...armors, ...armorPassives, ...armorPassives.flatMap(passive => passive.effects), ...armors.map(armor => armor.source)];
// Warbond tiles: Korean cosmetic and booster names (`ko`) with the wiki's English name. Listed first so
// a Korean name shared with something else keeps that meaning (자유의 종복 is a warbond and a title);
// the board itself shows these names with L(), not through the dictionary.
const warbondTileNames = warbonds.flatMap(warbond => warbond.pages.flatMap(page => page.items)).filter(item => item.ko).map(item => ({ name: item.ko, en: item.name }));
export const officialNames = [...warbondTileNames, ...stratagems, ...personalWeapons, ...factionGuides, ...warbonds, ...armorNames].filter(item => item.name && item.en).map(item => [item.name, item.en]);
export const areas = { stratagems: stratagemText, enemies: enemyText, gear: gearText, demolition: demolitionText, factions: factionText, warbonds: warbondText, armor: armorText };
export const english = Object.assign(Object.fromEntries(officialNames), ...Object.values(areas));

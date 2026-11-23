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
import { attachmentParts } from '../data/weapon-attachments.js';
import { shipModules } from '../data/ship-modules.js';
import { boosters } from '../data/boosters.js';
import { structureObjectives } from '../data/structure-objectives.js';
import { conditions, gloomLevels, specialEffects, operationModifiers, eventEffects, biomes as planetBiomes, statusEffects, hazards } from '../data/planets.js';
import { enemyPages, difficultyNames } from '../data/enemy-pages.js';
import { superstorePages } from '../data/superstore.js';
import { shipModuleSections } from '../data/ship-module-upgrades.js';
import { enemyWeapons } from '../data/enemy-weapons.js';
import { vehicleDurability } from '../data/vehicle-durability.js';
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
// Boosters: the game's Korean name and description, and the detail line, each with its English.
const boosterText = boosters.flatMap(item => [item, { name: item.description, en: item.descriptionEn }, { name: item.detail, en: item.detailEn }]);
// Missions per demolition structure: the game's Korean and English objective names.
const titleCase = text => text === text.toUpperCase() ? text.toLowerCase().replace(/(^|[\s:(-])([a-z])/g, (_, gap, letter) => gap + letter.toUpperCase()) : text;
const objectiveNames = Object.values(structureObjectives).flat().map(item => ({ name: item.name, en: titleCase(item.en) }));
// Planet tab: the game's Korean names and descriptions, biome descriptions and status effect lines, each with its English.
const planetText = [...conditions, ...gloomLevels, ...specialEffects, ...operationModifiers, ...eventEffects].flatMap(item => [item, { name: item.description, en: item.descriptionEn }])
  .concat(specialEffects.flatMap(item => item.detail.map((line, i) => ({ name: line, en: item.detailEn[i] }))))
  .concat([...conditions, ...operationModifiers].flatMap(item => [...(item.detail ?? []).map((line, i) => ({ name: line, en: item.detailEn[i] })), ...(item.tips ?? []).map((line, i) => ({ name: line, en: item.tipsEn[i] }))]))
  .concat(planetBiomes.filter(biome => biome.archetypeName).map(biome => ({ name: biome.archetypeName, en: biome.archetype })), planetBiomes)
  .concat(planetBiomes.filter(biome => biome.description).map(biome => ({ name: biome.description, en: biome.descriptionEn })), planetBiomes.flatMap(biome => biome.planets))
  .concat(statusEffects.filter(item => item.name), statusEffects.flatMap(item => item.detail.map((line, i) => ({ name: line, en: item.detailEn[i] }))))
  .concat(hazards, hazards.flatMap(item => item.detail.map((line, i) => ({ name: line, en: item.detailEn[i] }))));
// Enemy view: the summarized wiki Spawning, Behavior and Tactics lines and the field tips, each with its English,
// and the game's difficulty names.
const enemyLore = Object.values(enemyPages).flatMap(item => [...item.spawning.map((line, i) => ({ name: line, en: item.spawningEn[i] })), ...item.behavior.map((line, i) => ({ name: line, en: item.behaviorEn[i] })), ...(item.tactics ?? []).map((line, i) => ({ name: line, en: item.tacticsEn[i] })), ...(item.tips ?? []).map((line, i) => ({ name: line, en: item.tipsEn[i] }))]).concat(difficultyNames);
// Superstore tiles: the game's Korean cosmetic names and the armor set names, with the wiki's English.
const superstoreNames = superstorePages.flatMap(page => page.items).filter(item => item.ko).map(item => ({ name: item.ko, en: item.base }));
// Weapon attachments: Korean names (`ko`) with the wiki's English name; the customization table shows them with L() too.
const attachmentNames = Object.values(attachmentParts).filter(part => part.ko).map(part => ({ name: part.ko, en: part.name }));
// Ship module tab: the game's Korean section and upgrade names and effect text, with the game's English.
const shipModuleText = shipModuleSections.flatMap(section => [section, ...section.modules.flatMap(module => [module, { name: module.effect, en: module.effectEn }])]);
// Enemy attacks: the site's Korean names with the wiki loadout box titles.
const enemyAttackNames = Object.values(enemyWeapons).flatMap(item => item.attacks).map(attack => ({ name: attack.name, en: attack.en }));
// Vehicle parts: the site's Korean part names with the wiki's English.
const vehicleParts = Object.values(vehicleDurability).flatMap(item => item.parts).map(part => ({ name: part.name, en: part.en }));
export const officialNames = [...warbondTileNames, ...attachmentNames, ...stratagems, ...personalWeapons, ...factionGuides, ...warbonds, ...armorNames, ...shipModules, ...boosterText, ...objectiveNames, ...planetText, ...enemyLore, ...superstoreNames, ...shipModuleText, ...enemyAttackNames, ...vehicleParts].filter(item => item.name && item.en).map(item => [item.name, item.en]);
export const areas = { stratagems: stratagemText, enemies: enemyText, gear: gearText, demolition: demolitionText, factions: factionText, warbonds: warbondText, armor: armorText };
export const english = Object.assign(Object.fromEntries(officialNames), ...Object.values(areas));

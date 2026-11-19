// Planet tab: names and descriptions are the game's Korean, the numbers come from the
// wiki, condition icons are the checked original SVGs, every wiki biome is listed with
// the game's planets, and the stratagem effects match their descriptions.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as planets from '../dist/data/planets.js';
import { stratagemEffects } from '../dist/data/planet-stratagem-effects.js';
import { validateSvg } from './svg-safety.mjs';
import { biomeImages } from '../dist/data/biome-images.js';
import { cleanGameText, slug } from './planet-parse.mjs';

const read = async name => JSON.parse(await readFile(new URL(`../db/source/${name}`, import.meta.url), 'utf8'));
const text = await read('planet_korean.json');
const wiki = await read('wiki_planets.json');
const game = await read('game_names_ko.json');
const gamePlanets = await read('game_planets_ko.json');
let checks = 0;
const ok = (condition, message) => { assert(condition, message); checks++; };

ok(planets.planetsGameBuild === game.build && gamePlanets.build === game.build, 'planets.js, game_names_ko.json and game_planets_ko.json share one game build (run build-planets)');
const groups = [['conditions', planets.conditions], ['gloom', planets.gloomLevels], ['modifiers', planets.operationModifiers], ['events', planets.eventEffects]];
for (const [group, list] of groups) {
  ok(list.length === text[group].length, `${group}: planets.js is stale (run build-planets)`);
  text[group].forEach((source, index) => {
    const item = list[index];
    ok(item.id === source.id && item.name === game.strings.planets[source.name], `${source.id}: name is not the game's Korean`);
    ok(item.description === cleanGameText(game.strings.planets[source.description], source.values), `${source.id}: description is not the game's Korean`);
    ok(!/#V_|<i|\\n/.test(item.description + item.descriptionEn), `${source.id}: game markup left in the text`);
    // Placeholder values come from the wiki Effects page, next to the entry's name or page.
    for (const value of Object.values(source.values || {})) {
      const name = source.page === 'Effects' ? cleanGameText(source.name, {}, true) : source.page;
      const near = wiki.effects.text.split(name).slice(1).some(after => after.slice(0, 400).includes(value));
      ok(near, `${source.id}: ${value} is not next to it on the wiki Effects page`);
    }
  });
}
// Exostorm classes and Heavy SEAF Presence: game text, and every number in the detail lines on the wiki page.
ok(planets.specialEffects.length === text.special.length, 'specialEffects is stale (run build-planets)');
text.special.forEach((source, index) => {
  const item = planets.specialEffects[index], page = wiki.specialPages[source.page];
  ok(item.id === source.id && item.name === game.strings.planets[source.name] && item.description === cleanGameText(game.strings.planets[source.description]), `${source.id}: not the game's Korean (run build-game-names and build-planets)`);
  ok(page, `${source.id}: wiki page ${source.page} not downloaded (run fetch-planet-pages)`);
  ok(item.detail.length === item.detailEn.length, `${source.id}: detail needs Korean and English line by line`);
  for (const number of item.detail.concat(item.detailEn).join(' ').match(/\d+(?:\.\d+)?/g) || []) ok(page.text.includes(number), `${source.id}: ${number} is not on the wiki page ${source.page}`);
});
// Environmental conditions: listed in the wiki module, with their original icons (as is any special
// effect with a wiki icon, e.g. Heavy SEAF Presence).
for (const item of [...planets.conditions, ...planets.specialEffects.filter(effect => effect.icon)]) {
  if (planets.conditions.includes(item)) ok(wiki.environmentModule.text.includes(`["${item.en.toLowerCase()}"]`), `${item.id}: not in Module:Environmental Conditions`);
  const bytes = await readFile(new URL(`../dist/${item.icon.src.slice(2)}`, import.meta.url));
  ok(createHash('sha256').update(bytes).digest('hex') === item.icon.sha256, `${item.id}: icon changed`);
  validateSvg(bytes, { name: item.icon.src }); checks++;
}
// Operation modifiers: one from difficulty 5, two from 8 (the planet tab says so).
ok(/single Modifier will appear on \{\{Difficulty\|5\}\}, increasing to two at \{\{Difficulty\|8\}\}/.test(wiki.effects.text), 'the wiki no longer says one modifier from difficulty 5, two from 8');

// Biomes: every wiki biome page, with the game's planets for its internal name.
ok(planets.biomes.length === Object.keys(wiki.biomes).length, 'every wiki biome is listed');
for (const biome of planets.biomes) {
  const page = wiki.biomes[biome.en];
  ok(page && page.revision === biome.revision && biome.id === slug(biome.en), `${biome.en}: stale (run build-planets)`);
  ok(biome.name === text.biomeNames[biome.en] && biome.archetypeName === (text.archetypeNames[biome.archetype] ?? null), `${biome.en}: Korean name or archetype is stale (run build-planets)`);
  ok(biome.planets.length === gamePlanets.planets.filter(planet => planet.biome === biome.internal).length, `${biome.en}: planet list does not match the game data`);
  for (const id of biome.conditions) ok(planets.conditions.some(item => item.id === id), `${biome.en}: unknown condition ${id}`);
}
// Biome thumbnails: small WebP files, unchanged since fetch-biome-images.py (Volcanic Jungle uses a
// picture from its page gallery: its infobox picture redirects to the Deadlands one).
for (const [id, image] of Object.entries(biomeImages)) {
  ok(planets.biomes.some(biome => biome.id === id), `biome-images.js: unknown biome ${id}`);
  const bytes = await readFile(new URL(`../dist/${image.src.slice(2)}`, import.meta.url));
  ok(bytes.length <= 24_000 && createHash('sha256').update(bytes).digest('hex') === image.sha256, `${id}: thumbnail changed or over 24 KB (run scripts/tools/fetch-biome-images.py)`);
}
ok(planets.biomes.every(biome => biomeImages[biome.id]), 'every biome has a thumbnail');
const listed = new Set(planets.biomes.map(biome => biome.internal));
const unlisted = [...new Set(gamePlanets.planets.map(planet => planet.biome))].filter(biome => biome !== '?' && !listed.has(biome));
ok(!unlisted.length, `game biomes with planets but no wiki biome page: ${unlisted.join(', ')}`);

// Status effects: every number in the detail lines is on the wiki Status Effects page.
for (const item of planets.statusEffects) {
  const source = text.status.find(entry => entry.id === item.id);
  ok(source.name ? item.name === game.strings.status[source.name] : item.name === source.ko && Boolean(source.ko), `${item.id}: name is not the game's Korean or the site's translation`);
  ok(item.detail.length === item.detailEn.length, `${item.id}: detail needs Korean and English line by line`);
  ok(wiki.statusEffects.text.includes(`== ${item.en} ==`), `${item.id}: no "${item.en}" section on the wiki Status Effects page`);
  for (const number of item.detail.concat(item.detailEn).join(' ').match(/\d+(?:\.\d+)?/g) || []) ok(wiki.statusEffects.text.includes(number), `${item.id}: ${number} is not on the wiki Status Effects page`);
}

// Stratagem effects: the factor is the percentage in the entry's own description.
ok(JSON.stringify(stratagemEffects.map(effect => effect.id)) === JSON.stringify([...text.conditions, ...text.gloom, ...text.modifiers, ...text.events].filter(item => item.stratagem).map(item => item.id)), 'planet-stratagem-effects.js is stale (run build-planets)');
for (const effect of stratagemEffects) {
  const item = groups.flatMap(([, list]) => list).find(entry => entry.id === effect.id);
  for (const key of ['cooldown', 'callIn', 'rearm']) if (effect[key]) ok(item.descriptionEn.includes(`${Math.round((effect[key] - 1) * 100)}%`), `${effect.id}: ${key} x${effect[key]} does not match "${item.descriptionEn}"`);
}
// Planet names link only to wiki pages that exist (Category:Planets in wiki_planets.json).
{
  const pages = new Set(wiki.planetPages);
  const linked = planets.biomes.flatMap(biome => biome.planets).filter(planet => planet.wiki);
  ok(linked.every(planet => pages.has(planet.wiki)) && linked.length > 250, 'every linked planet has a wiki page, and most planets are linked');
}
console.log(`PASS planets: ${checks} checks (${planets.conditions.length} conditions, ${planets.gloomLevels.length} Gloom levels, ${planets.operationModifiers.length} modifiers, ${planets.eventEffects.length} events, ${planets.biomes.length} biomes, ${planets.statusEffects.length} status effects, game build ${game.build}).`);

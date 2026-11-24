// Builds dist/data/planets.js for the planet tab: environmental conditions, Gloom
// levels, operation modifiers, event effects, biomes with their planets, and status
// effects. Sources: db/source/planet_korean.json, wiki_planets.json, game_names_ko.json,
// game_planets_ko.json and galaxy_planets.json. Do not edit the output.
// Usage: node scripts/build-planets.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { cleanGameText, slug } from './planet-parse.mjs';

const read = async name => JSON.parse(await readFile(new URL(`../db/source/${name}`, import.meta.url), 'utf8'));
const text = await read('planet_korean.json');
const wiki = await read('wiki_planets.json');
const game = await read('game_names_ko.json');
const gamePlanets = await read('game_planets_ko.json');
// Planets on the galaxy map (fetch-galaxy-planets.mjs), less those that can no longer be played
// (excludedPlanets: Super Earth, black holes, destroyed planets). The game's name table also holds names
// that are not on the map, and lists Meridia twice; each map planet is listed once.
const galaxy = await read('galaxy_planets.json');
const excluded = new Set(text.excludedPlanets.map(planet => planet.name));
const unknownExcluded = [...excluded].filter(name => !galaxy.planets.some(planet => planet.name === name));
if (unknownExcluded.length) throw new Error(`excludedPlanets not on the galaxy map: ${unknownExcluded.join(', ')}`);
const playable = galaxy.planets.filter(planet => !excluded.has(planet.name)).map(planet => planet.name);
const playableSet = new Set(playable);
const gameByName = new Map(gamePlanets.planets.map(planet => [planet.en, planet]));
const notInGame = playable.filter(name => !gameByName.has(name));
if (notInGame.length) throw new Error(`galaxy map planets missing from game_planets_ko.json: ${notInGame.join(', ')}`);
if (gamePlanets.build !== game.build) throw new Error('game_planets_ko.json and game_names_ko.json come from different game builds');
// Game planet name (upper case) -> its wiki page title, matched without case or accents.
const pageKey = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const planetPage = new Map((wiki.planetPages ?? []).map(title => [pageKey(title), title]));
const wikiUrl = page => `https://helldivers.wiki.gg/wiki/${page.replaceAll(' ', '_')}`;
const ko = key => {
  const value = game.strings.planets[key];
  if (!value) throw new Error(`no game Korean for "${key}" (run scripts/build-game-names.mjs)`);
  return value;
};

// Which biomes list each condition (the wiki biome pages; conditions belong to planets, so this is typical, not fixed).
const biomesWith = page => Object.entries(wiki.biomes).filter(([, biome]) => biome.conditions.includes(page)).map(([title]) => slug(title));
const entry = (item, extra = {}) => ({
  id: item.id, name: ko(item.name), en: ['Effects', 'The Gloom', 'Hive World', 'Exostorm', 'Democracy Space Station'].includes(item.page) ? cleanGameText(item.name, {}, true) : item.page,
  description: cleanGameText(ko(item.description), item.values), descriptionEn: cleanGameText(item.description, item.values),
  wiki: wikiUrl(item.page), ...extra,
});

// The wiki's original icon of an entry, when fetch-planet-pages stored one for its id.
const iconOf = id => wiki.icons[id] ? { src: `./assets/conditions/${wiki.icons[id].file}`, source: wiki.icons[id].source, sha256: wiki.icons[id].sha256 } : null;
// Detail lines summarize the condition's or modifier's own wiki page (and its datamine attack record);
// tips are player experience the wiki lacks, shown apart as field tips.
const detailOf = item => ({
  ...(item.detail && { detail: item.detail.ko, detailEn: item.detail.en, revision: (wiki.conditionPages?.[item.page] ?? wiki.modifierPages?.[item.page])?.revision ?? null }),
  ...(item.tips && { tips: item.tips.ko, tipsEn: item.tips.en }),
});
const conditions = text.conditions.map(item => entry(item, {
  icon: iconOf(item.id),
  biomes: biomesWith(item.page),
  ...detailOf(item),
}));
const gloom = text.gloom.map(item => entry(item));
// Exostorm classes, Heavy SEAF Presence and the Democracy Space Station: game name and description, plus the wiki page's facts.
const special = text.special.map(item => entry(item, { detail: item.detail.ko, detailEn: item.detail.en, ...(iconOf(item.id) && { icon: iconOf(item.id) }) }));
const modifiers = text.modifiers.map(item => entry(item, { faction: item.faction || null, where: item.where || null, ...detailOf(item) }));
// Environmental hazards (mines, barbed wire, lava, plants): the game's name where it has one, else the site's,
// with lines summarizing each wiki page and the biomes it names (by title or by archetype).
const biomeIds = new Set(Object.keys(wiki.biomes).map(slug));
const hazards = (text.hazards ?? []).map(item => {
  const named = [...(item.biomes ?? []), ...Object.entries(wiki.biomes).filter(([, biome]) => (item.archetypes ?? []).includes(biome.archetype)).map(([title]) => title)];
  for (const title of named) if (!biomeIds.has(slug(title))) throw new Error(`${item.id}: biome ${title} is not a wiki biome`);
  return {
    id: item.id, name: item.name ? ko(item.name) : item.ko, en: item.en, detail: item.detail.ko, detailEn: item.detail.en,
    biomes: [...new Set(named.map(slug))], wiki: wikiUrl(item.page), revision: wiki.hazardPages?.[item.page]?.revision ?? null,
  };
});
const events = text.events.map(item => entry(item));
// Other event effect kinds: game effect sentences without a name of their own (the site names the kind);
// the amount changes per event, so placeholders read N (or the kind's own words, e.g. "a given" stratagem).
const eventLine = (line, values) => cleanGameText(line.replaceAll('#AMOUNT', 'N'), { V_ONE: 'N', V_TWO: 'N', ...values });
const eventKinds = (text.eventKinds ?? []).map(kind => ({
  id: kind.id, name: kind.ko, en: kind.en,
  lines: kind.lines.map(line => eventLine(ko(line), kind.values?.ko)), linesEn: kind.lines.map(line => eventLine(line, kind.values?.en)),
}));

const biomes = Object.entries(wiki.biomes).map(([title, biome]) => {
  const internal = text.biomeInternal[title] ?? biome.internal;
  const description = gamePlanets.biomes[internal] ?? null;
  const name = text.biomeNames[title];
  if (!name) throw new Error(`${title}: add its Korean name to biomeNames in db/source/planet_korean.json`);
  return {
    id: slug(title), name, en: title, archetype: biome.archetype, archetypeName: text.archetypeNames[biome.archetype] ?? null, internal,
    description: description?.ko ?? null, descriptionEn: description?.en ?? null,
    conditions: biome.conditions.map(page => text.conditions.find(item => item.page === page)?.id).filter(Boolean),
    planets: [...gameByName.values()].filter(planet => planet.biome === internal && playableSet.has(planet.en)).map(({ ko: name, en }) => ({ name, en, ...(planetPage.has(pageKey(en)) && { wiki: planetPage.get(pageKey(en)) }) })).sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    wiki: wikiUrl(title), revision: biome.revision,
  };
});

const status = text.status.map(item => ({
  id: item.id, name: item.name ? game.strings.status[item.name] : item.ko, en: item.en,
  detail: item.detail.ko, detailEn: item.detail.en, wiki: `${wikiUrl('Status Effects')}#${item.en.replaceAll(' ', '_')}`,
}));

// How conditions, modifiers and events change stratagem timings (shown in the stratagem details).
const stratagemEffects = [...text.conditions.map(item => ['condition', item]), ...text.gloom.map(item => ['gloom', item]), ...text.modifiers.map(item => ['modifier', item]), ...text.events.map(item => ['event', item])]
  .filter(([, item]) => item.stratagem).map(([kind, item]) => ({ id: item.id, kind, name: ko(item.name), ...item.stratagem }));

const out = `// Generated by scripts/build-planets.mjs. Do not edit.
// Names and descriptions are the game's Korean (game build ${game.build}); status effect
// lines summarize the wiki Status Effects page. Condition icons are the wiki's original SVGs.
export const planetsCheckedAt = ${JSON.stringify(wiki.retrievedAt)};
export const planetsGameBuild = ${JSON.stringify(game.build)};
// Planets that can be played on the galaxy map (${galaxy.source}, ${galaxy.retrievedAt}), less excludedPlanets.
export const playablePlanetCount = ${playable.length};
export const conditions = ${JSON.stringify(conditions, null, 1)};
export const gloomLevels = ${JSON.stringify(gloom, null, 1)};
export const specialEffects = ${JSON.stringify(special, null, 1)};
export const operationModifiers = ${JSON.stringify(modifiers, null, 1)};
export const eventEffects = ${JSON.stringify(events, null, 1)};
export const eventKinds = ${JSON.stringify(eventKinds, null, 1)};
export const hazards = ${JSON.stringify(hazards, null, 1)};
export const biomes = ${JSON.stringify(biomes)};
export const statusEffects = ${JSON.stringify(status, null, 1)};
`;
await writeFile(new URL('../dist/data/planets.js', import.meta.url), out);
// Kept apart so the stratagem list does not load the whole planet tab.
await writeFile(new URL('../dist/data/planet-stratagem-effects.js', import.meta.url), `// Generated by scripts/build-planets.mjs. Do not edit.
// Planet conditions, modifiers and events that change stratagem timings: factors apply to
// the value shown (with or without ship modules); types limit them to a wiki stratagem_type.
export const stratagemEffects = ${JSON.stringify(stratagemEffects, null, 1)};
`);
const unlisted = playable.filter(name => !biomes.some(biome => biome.planets.some(planet => planet.en === name)));
if (unlisted.length) console.log(`Playable planets in no biome list (game biome unknown): ${unlisted.join(', ')}`);
console.log(`${playable.length} playable planets (${galaxy.planets.length} on the map, ${excluded.size} excluded); ${conditions.length} conditions, ${gloom.length} Gloom levels, ${modifiers.length} modifiers, ${events.length} events, ${biomes.length} biomes (${biomes.reduce((sum, biome) => sum + biome.planets.length, 0)} planets), ${status.length} status effects`);

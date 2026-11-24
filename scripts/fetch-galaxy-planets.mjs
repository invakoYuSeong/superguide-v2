// Downloads the planets on the galaxy map (community API api.helldivers2.dev /api/v1/planets, the war's own
// planet list) into db/source/galaxy_planets.json: index, name and the API's biome name. The game's planet name
// table (game_planets_ko.json) also holds names that are not on the map, so the planet tab lists only these.
// Planets that can no longer be played (Super Earth, black holes, destroyed ones) are left out by
// excludedPlanets in db/source/planet_korean.json, not here.
// Usage: node scripts/fetch-galaxy-planets.mjs  ->  node scripts/build-planets.mjs
import { writeFile } from 'node:fs/promises';

const URL_ = 'https://api.helldivers2.dev/api/v1/planets';
// The API asks clients to name themselves; a generic name, no personal contact.
const res = await fetch(URL_, { headers: { 'X-Super-Client': 'hd2-fan-guide-data', 'X-Super-Contact': 'none' }, signal: AbortSignal.timeout(60000) });
if (!res.ok) throw new Error(`${res.status} ${URL_}`);
const planets = (await res.json()).map(planet => ({ index: planet.index, name: planet.name, biome: planet.biome?.name ?? null })).sort((a, b) => a.index - b.index);
if (planets.length < 200) throw new Error(`Only ${planets.length} planets: the API answer looks wrong`);
const out = { source: URL_, retrievedAt: new Date().toISOString().slice(0, 10), planets: [] };
const json = JSON.stringify(out, null, 1).replace('"planets": []', `"planets": [\n${planets.map(planet => `  ${JSON.stringify(planet)}`).join(',\n')}\n ]`);
await writeFile(new URL('../db/source/galaxy_planets.json', import.meta.url), json + '\n');
console.log(`${URL_}: ${planets.length} planets on the galaxy map`);

// Global search across stratagems, gear, armor, boosters, ship modules, enemies, structures, faction guides,
// warbonds and their items, the superstore, planet conditions, modifiers, biomes, planets and status effects.
import { stratagems, categoryOf } from '../core/catalog.js';
import { search, stratagemFields, personalNames, collabKeywords } from '../core/search.js';
import { html, render, $ } from './dom.js';
import { L, T, lang } from '../core/i18n.js';

const LIMIT = 8;

export async function createPalette(ctx) {
  const [{ enemies }, { structures }, { factionGuides, factionSides }, { pickerEnemyImages, pickerStructureImages }, { wikiIcons }, { personalWeapons }, { weaponImages }, { displayName }, { warbonds, warbondTiers }, { warbondImages }, { armors, armorPassives, armorWeights }, { armorImages }, { boosters }, { shipModuleSections }] = await Promise.all([
    import('../data/combat-data.js'), import('../data/demolition-data.js'), import('../data/faction-data.js'),
    import('../data/selector-images.js'), import('../data/wiki-icons.js'),
    import('../data/personal-weapons.js'), import('../data/weapon-images.js'), import('./gear-shared.js'),
    import('../data/warbonds.js'), import('../data/warbond-images.js'),
    import('../data/armor.js'), import('../data/armor-images.js'), import('../data/boosters.js'), import('../data/ship-module-upgrades.js'),
  ]);
  const [planetData, { biomeImages }, { hazardImages }, { superstorePages }, { warbondItemImages }] = await Promise.all([
    import('../data/planets.js'), import('../data/biome-images.js'), import('../data/hazard-images.js'), import('../data/superstore.js'), import('../data/warbond-item-images.js'),
  ]);
  const tierName = id => T(warbondTiers.find(tier => tier.id === id)?.name || id);
  const GEAR_GROUP = L({ primary: '주무기', secondary: '보조무기', throwable: '투척' }, { primary: 'Primary', secondary: 'Secondary', throwable: 'Throwable' });
  // In English the subtitle skips the English name, which is already the title.
  const withEn = (text, en) => lang === 'en' ? text : `${text} · ${en}`;
  // Tile kinds as the warbond and superstore boards name them.
  const KIND = { booster: ['부스터', 'Booster'], helmet: ['헬멧', 'Helmet'], armor: ['아머', 'Armor'], cape: ['망토', 'Cape'], 'player-card': ['플레이어 카드', 'Player card'], pattern: ['패턴', 'Pattern'],
    emote: ['감정 표현', 'Emote'], 'victory-pose': ['승리 포즈', 'Victory pose'], title: ['칭호', 'Title'], stratagem: ['스트라타젬', 'Stratagem'], weapon: ['무기', 'Weapon'] };
  const kindName = kind => L(...(KIND[kind] ?? ['기타', 'Other']));
  const { conditions, gloomLevels, specialEffects, operationModifiers, eventEffects, hazards, statusEffects, biomes } = planetData;
  const PLANET_TABS = [
    ['conditions', L('환경 조건', 'Environment'), [conditions, hazards, gloomLevels, specialEffects]],
    ['modifiers', L('작전 제한 조건', 'Operation modifiers'), [operationModifiers, eventEffects]],
    ['biomes', L('생물군계', 'Biomes'), [biomes]],
    ['status', L('상태 이상', 'Status effects'), [statusEffects]],
  ];
  const groups = [
    { id: 'stratagems', name: L('스트라타젬', 'Stratagems'), items: stratagems.map(item => ({ fields: stratagemFields(item), label: T(item.name), sub: withEn(categoryOf(item.category).name, item.en), image: wikiIcons[item.id]?.src, route: { view: 'arsenal', id: item.id } })) },
    { id: 'gear', name: L('장비', 'Gear'), items: personalWeapons.map(item => ({ fields: { names: personalNames(item), text: [GEAR_GROUP[item.category]] }, label: displayName(item), sub: withEn(GEAR_GROUP[item.category], item.en), image: weaponImages[item.id]?.src, route: { view: 'gear', id: item.id } })) },
    // Armor passives: the armor tab showing that passive's sets (#/gear?tab=armor&p=<passive>).
    { id: 'passives', name: L('방어구 패시브', 'Armor passives'), items: armorPassives.map(item => {
      const count = armors.filter(armor => armor.passive === item.id).length;
      return { fields: { names: [item.name, item.en], text: item.effects.flatMap(effect => [effect.name, effect.en]) }, label: T(item.name), sub: withEn(L(`방어구 패시브 · ${count}종`, `Armor passive · ${count} ${count === 1 ? 'set' : 'sets'}`), item.en), image: armorImages[item.icon]?.src, route: { view: 'gear', query: { tab: 'armor', p: item.id } } };
    }) },
    { id: 'armor', name: L('방어구', 'Armor'), items: armors.map(item => {
      const passive = armorPassives.find(entry => entry.id === item.passive);
      const weight = armorWeights.find(entry => entry.id === item.weight);
      return { fields: { names: [item.name, item.en, item.code].filter(Boolean), text: [passive?.name, passive?.en, weight?.name] }, label: T(item.name), sub: withEn(`${T(weight?.name ?? '')} · ${T(passive?.name ?? '')}`, item.en), image: armorImages[item.image]?.src, route: { view: 'gear', query: { tab: 'armor', a: item.id } } };
    }) },
    { id: 'boosters', name: L('부스터', 'Boosters'), items: boosters.map(item => ({ fields: { names: [item.name, item.en], text: [item.description, item.descriptionEn, item.detail].filter(Boolean) }, label: T(item.name), sub: withEn(L('부스터', 'Booster'), item.en), image: item.icon.src, route: { view: 'gear', query: { tab: 'boosters', b: item.id } } })) },
    { id: 'modules', name: L('함선 모듈', 'Ship modules'), items: shipModuleSections.flatMap(section => section.modules.map(item => ({ fields: { names: [item.name, item.en], text: [section.name, section.en, item.effect, item.effectEn] }, label: L(item.name, item.en), sub: withEn(L(`${section.name} ${item.tier}단계`, `${section.en}, tier ${item.tier}`), item.en), image: section.icon?.src, route: { view: 'gear', query: { tab: 'modules', u: item.id } } }))) },
    { id: 'enemies', name: L('적', 'Enemies'), items: enemies.map(item => ({ fields: { names: [item.name, T(item.name), item.id.replaceAll('-', ' ')], text: [item.faction, T(item.faction)] }, label: T(item.name), sub: `${T(item.faction)} · ${L('무기별 탄수 비교', 'shots to kill by weapon')}`, image: pickerEnemyImages[item.id]?.src, route: { view: 'enemy', id: item.id } })) },
    { id: 'structures', name: L('시설', 'Structures'), items: structures.map(item => ({ fields: { names: [item.name, T(item.name)], text: [item.faction, T(item.faction), item.tip, T(item.tip)] }, label: T(item.name), sub: `${T(item.faction)} · ${L('철거 방법', 'how to demolish')}`, image: pickerStructureImages[item.id]?.src, route: { view: 'demolition', query: { s: item.id } } })) },
    { id: 'factions', name: L('팩션', 'Factions'), items: factionGuides.map(item => ({ fields: { names: [item.name, item.en], text: [item.intro, T(item.intro)] }, label: T(item.name), sub: `${T(factionSides.find(side => side.id === item.side).name)} · ${L('추천 장비', 'recommended loadout')}`, image: factionSides.find(side => side.id === item.side).icon, route: { view: 'factions', id: item.id } })) },
    { id: 'warbonds', name: L('전쟁 채권', 'Warbonds'), items: warbonds.map(item => ({ fields: { names: [item.name, item.en, ...collabKeywords(item.id)], text: [tierName(item.tier)], keywords: collabKeywords(item.id) }, label: T(item.name), sub: withEn(`${tierName(item.tier)} · ${item.date}`, item.en), image: warbondImages[item.id]?.src, route: { view: 'warbonds', id: item.id } })) },
    // Warbond tiles that have no page of their own elsewhere (cosmetics, helmets, boosters...): open their
    // warbond and mark the tile (f=<page>-<n>, the n-th tile of that page).
    { id: 'warbond-items', name: L('전쟁 채권 항목', 'Warbond items'), items: warbonds.flatMap(bond => bond.pages.flatMap(page => page.items
      .map((item, i) => [item, `${page.number}-${i + 1}`]).filter(([item]) => !item.ref && item.kind !== 'super-credits')
      .map(([item, cell]) => ({ fields: { names: [item.ko, item.name].filter(Boolean), text: [kindName(item.kind), bond.name, bond.en] }, label: item.ko ? L(item.ko, item.name) : item.name,
        sub: `${kindName(item.kind)} · ${T(bond.name)}`, image: warbondItemImages[item.image]?.src, route: { view: 'warbonds', id: bond.id, query: { f: cell } } })))) },
    // Superstore cosmetics (its weapons and armor are found under Gear and Armor), tile marked the same way.
    { id: 'superstore', name: L('슈퍼 스토어', 'Superstore'), items: superstorePages.flatMap(page => page.items
      .map((item, i) => [item, `${page.number}-${i + 1}`]).filter(([item]) => !item.ref && item.kind !== 'weapon')
      .map(([item, cell]) => ({ fields: { names: [item.ko, item.base, item.name].filter(Boolean), text: [kindName(item.kind)] }, label: item.ko ? L(item.ko, item.base) : item.base,
        sub: `${kindName(item.kind)} · ${item.cost} SC`, image: warbondItemImages[item.image]?.src, route: { view: 'superstore', query: { f: cell } } }))) },
    // Planet tab cards: open the tab and mark the card (b=).
    { id: 'planet-info', name: L('행성 정보', 'Planet info'), items: PLANET_TABS.flatMap(([tab, tabName, lists]) => lists.flat().map(item => ({
      fields: { names: [item.name, item.en].filter(Boolean), text: [tabName, item.description, item.descriptionEn, ...(item.detail ?? [])].filter(Boolean) },
      label: T(item.name), sub: withEn(tabName, item.en), image: item.icon?.src ?? hazardImages[item.id]?.src ?? biomeImages[item.id]?.src, route: { view: 'planets', query: { tab, b: item.id } } }))) },
    // Planets by name: open their biome.
    { id: 'planet-names', name: L('행성', 'Planets'), items: planetData.biomes.flatMap(biome => biome.planets.map(planet => ({
      fields: { names: [planet.name, planet.en], text: [biome.name, biome.en] }, label: L(planet.name, planet.en), sub: L(`생물군계 · ${biome.name}`, `Biome · ${biome.en}`),
      image: biomeImages[biome.id]?.src, route: { view: 'planets', query: { tab: 'biomes', b: biome.id } } }))) },
  ];

  const dialog = $('#palette');
  const input = $('#palette-input');
  const list = $('#palette-results');
  let results = [];
  let active = 0;

  function run() {
    const query = input.value.trim();
    const shown = groups.map(group => ({ name: group.name, items: query ? search(group.items, query, item => item.fields).slice(0, LIMIT) : group.id === 'enemies' || group.id === 'stratagems' ? group.items.slice(0, 4) : [] }))
      .filter(group => group.items.length);
    results = shown.flatMap(group => group.items);
    active = 0;
    let index = -1;
    render(list, results.length ? shown.map(group => html`<li class="group" role="presentation">${query ? group.name : `${group.name} · ${L('예시', 'examples')}`}</li>${group.items.map(item => { index++; return html`<li role="option" id="pal-${index}" data-index="${index}" aria-selected="${index === active}">
      ${item.image ? html`<img class="thumb" src="${item.image}" alt="" loading="lazy">` : html`<span class="thumb"></span>`}<span class="label"><b>${item.label}</b><span>${item.sub}</span></span></li>`; })}`)
      : html`<li class="none">${L(`‘${query}’ 검색 결과가 없습니다.`, `No results for “${query}”.`)}</li>`);
    input.setAttribute('aria-activedescendant', results.length ? 'pal-0' : '');
  }
  function move(step) {
    if (!results.length) return;
    active = (active + step + results.length) % results.length;
    for (const option of list.querySelectorAll('[role="option"]')) option.setAttribute('aria-selected', String(Number(option.dataset.index) === active));
    list.querySelector(`#pal-${active}`)?.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', `pal-${active}`);
  }
  function choose(index) {
    const item = results[index];
    if (!item) return;
    dialog.close();
    ctx.go(item.route);
  }

  input.addEventListener('input', run);
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    else if (event.key === 'Enter') { event.preventDefault(); choose(active); }
    // A search input would swallow the first Esc to clear itself; close right away.
    else if (event.key === 'Escape') { event.preventDefault(); dialog.close(); }
  });
  list.addEventListener('click', event => {
    const option = event.target.closest('[role="option"]');
    if (option) choose(Number(option.dataset.index));
  });
  list.addEventListener('pointermove', event => {
    const option = event.target.closest('[role="option"]');
    if (option && Number(option.dataset.index) !== active) move(Number(option.dataset.index) - active);
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

  return {
    open() {
      input.value = '';
      run();
      dialog.showModal();
      input.focus();
    },
  };
}

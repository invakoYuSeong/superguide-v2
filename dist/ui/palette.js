// Global search across stratagems, gear, armor, boosters, enemies, structures, faction guides and warbonds.
import { stratagems, categoryOf } from '../core/catalog.js';
import { search, stratagemFields, personalNames } from '../core/search.js';
import { html, render, $ } from './dom.js';
import { L, T, lang } from '../core/i18n.js';

const LIMIT = 8;

export async function createPalette(ctx) {
  const [{ enemies }, { structures }, { factionGuides, factionSides }, { pickerEnemyImages, pickerStructureImages }, { wikiIcons }, { personalWeapons }, { weaponImages }, { displayName }, { warbonds, warbondTiers }, { warbondImages }, { armors, armorPassives, armorWeights }, { armorImages }, { boosters }] = await Promise.all([
    import('../data/combat-data.js'), import('../data/demolition-data.js'), import('../data/faction-data.js'),
    import('../data/selector-images.js'), import('../data/wiki-icons.js'),
    import('../data/personal-weapons.js'), import('../data/weapon-images.js'), import('./gear-shared.js'),
    import('../data/warbonds.js'), import('../data/warbond-images.js'),
    import('../data/armor.js'), import('../data/armor-images.js'), import('../data/boosters.js'),
  ]);
  const tierName = id => T(warbondTiers.find(tier => tier.id === id)?.name || id);
  const GEAR_GROUP = L({ primary: '주무기', secondary: '보조무기', throwable: '투척' }, { primary: 'Primary', secondary: 'Secondary', throwable: 'Throwable' });
  // In English the subtitle skips the English name, which is already the title.
  const withEn = (text, en) => lang === 'en' ? text : `${text} · ${en}`;
  const groups = [
    { id: 'stratagems', name: L('스트라타젬', 'Stratagems'), items: stratagems.map(item => ({ fields: stratagemFields(item), label: T(item.name), sub: withEn(categoryOf(item.category).name, item.en), image: wikiIcons[item.id]?.src, route: { view: 'arsenal', id: item.id } })) },
    { id: 'gear', name: L('장비', 'Gear'), items: personalWeapons.map(item => ({ fields: { names: personalNames(item), text: [GEAR_GROUP[item.category]] }, label: displayName(item), sub: withEn(GEAR_GROUP[item.category], item.en), image: weaponImages[item.id]?.src, route: { view: 'gear', id: item.id } })) },
    { id: 'armor', name: L('방어구', 'Armor'), items: armors.map(item => {
      const passive = armorPassives.find(entry => entry.id === item.passive);
      const weight = armorWeights.find(entry => entry.id === item.weight);
      return { fields: { names: [item.name, item.en, item.code].filter(Boolean), text: [passive?.name, passive?.en, weight?.name] }, label: T(item.name), sub: withEn(`${T(weight?.name ?? '')} · ${T(passive?.name ?? '')}`, item.en), image: armorImages[item.image]?.src, route: { view: 'gear', query: { tab: 'armor', a: item.id } } };
    }) },
    { id: 'boosters', name: L('부스터', 'Boosters'), items: boosters.map(item => ({ fields: { names: [item.name, item.en], text: [item.description, item.descriptionEn, item.detail].filter(Boolean) }, label: T(item.name), sub: withEn(L('부스터', 'Booster'), item.en), image: item.icon.src, route: { view: 'gear', query: { tab: 'boosters', b: item.id } } })) },
    { id: 'enemies', name: L('적', 'Enemies'), items: enemies.map(item => ({ fields: { names: [item.name, T(item.name), item.id.replaceAll('-', ' ')], text: [item.faction, T(item.faction)] }, label: T(item.name), sub: `${T(item.faction)} · ${L('무기별 탄수 비교', 'shots to kill by weapon')}`, image: pickerEnemyImages[item.id]?.src, route: { view: 'enemy', id: item.id } })) },
    { id: 'structures', name: L('시설', 'Structures'), items: structures.map(item => ({ fields: { names: [item.name, T(item.name)], text: [item.faction, T(item.faction), item.tip, T(item.tip)] }, label: T(item.name), sub: `${T(item.faction)} · ${L('철거 방법', 'how to demolish')}`, image: pickerStructureImages[item.id]?.src, route: { view: 'demolition', query: { s: item.id } } })) },
    { id: 'factions', name: L('팩션', 'Factions'), items: factionGuides.map(item => ({ fields: { names: [item.name, item.en], text: [item.intro, T(item.intro)] }, label: T(item.name), sub: `${T(factionSides.find(side => side.id === item.side).name)} · ${L('추천 장비', 'recommended loadout')}`, image: factionSides.find(side => side.id === item.side).icon, route: { view: 'factions', id: item.id } })) },
    { id: 'warbonds', name: L('전쟁 채권', 'Warbonds'), items: warbonds.map(item => ({ fields: { names: [item.name, item.en], text: [tierName(item.tier)] }, label: T(item.name), sub: withEn(`${tierName(item.tier)} · ${item.date}`, item.en), image: warbondImages[item.id]?.src, route: { view: 'warbonds', id: item.id } })) },
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

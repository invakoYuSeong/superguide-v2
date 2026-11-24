// Planet tab: environmental conditions, operation modifiers, biomes and status effects.
//   #/planets?tab=<conditions|modifiers|biomes|time|status>&b=<id>   (b: scroll to and mark one card of that tab, e.g. a biome)
import { conditions, gloomLevels, specialEffects, operationModifiers, eventEffects, eventKinds, biomes, statusEffects, hazards, planetsCheckedAt } from '../../data/planets.js';
import { planetTimeScales, planetTimeMeasuredAt } from '../../data/planet-time.js';
import { biomeImages } from '../../data/biome-images.js';
import { hazardImages } from '../../data/hazard-images.js';
import { html, render, $, $$, badge, external, icon } from '../dom.js';
import { L, T, lang } from '../../core/i18n.js';

const TABS = [
  { id: 'conditions', name: L('환경 조건', 'Environment'), icon: 'tab-conditions' },
  { id: 'modifiers', name: L('작전 제한 조건', 'Operation modifiers'), icon: 'tab-modifiers' },
  { id: 'biomes', name: L('생물군계', 'Biomes'), icon: 'tab-biomes' },
  { id: 'time', name: L('시간 배율', 'Clock speed'), icon: 'tab-time' },
  { id: 'status', name: L('상태 이상', 'Status effects'), icon: 'tab-status' },
];
const FACTIONS = [
  { id: null, name: L('공통', 'Any faction') },
  { id: 'terminid', name: L('테르미니드', 'Terminids') },
  { id: 'automaton', name: L('오토마톤', 'Automatons') },
  { id: 'illuminate', name: L('일루미닛', 'Illuminate') },
];
const state = { tab: 'conditions', biome: '', timeSort: 'asc' }; // timeSort: rotation period order on the clock speed tab
let root, ctx;

const conditionById = new Map(conditions.map(item => [item.id, item]));
const biomeById = new Map(biomes.map(item => [item.id, item]));
// Every card id the b= parameter can mark (ids are unique across the planet data).
const focusIds = new Set([conditions, gloomLevels, specialEffects, operationModifiers, eventEffects, eventKinds, hazards, statusEffects, biomes].flat().map(item => item.id));
const text = (ko, en) => lang === 'en' ? en : ko;
const enLine = item => lang === 'en' || !item.name || item.name === item.en ? '' : html`<p class="en">${item.en}</p>`;
const title = item => item.name ? (lang === 'en' ? item.en : item.name) : item.en;

// Site-drawn line icons where the wiki has none (dom.js ICONS).
const ICON_OF = {
  'complex-stratagem-plotting': 'mod-callin', 'orbital-fluctuations': 'mod-cooldown', 'poor-intel': 'mod-intel', 'civilians-and-seaf': 'mod-civilians',
  'atmospheric-spores': 'mod-spores', 'roving-shriekers': 'mod-shriekers', 'gunship-patrols': 'mod-gunships', 'leviathan-blockade': 'mod-leviathan',
  'orbital-fluctuations-event': 'mod-cooldown', 'medical-supply-strain': 'ev-stims', 'pilot-shortage': 'ev-extraction', 'slower-eagle-rearm': 'ev-eagle',
  'light-gloom-cover': 'gloom', 'moderate-gloom-blanket': 'gloom', 'heavy-gloom-shroud': 'gloom', 'gloom-source': 'gloom',
};
// Environmental hazards show a square photo from their wiki page (hazard-images.js) in the icon slot.
const effectIcon = item => hazardImages[item.id] ? html`<span class="info-icon photo"><img src="${hazardImages[item.id].src}" alt="" width="64" height="64" loading="lazy" decoding="async"></span>`
  : item.icon ? html`<span class="info-icon"><img src="${item.icon.src}" alt="" width="56" height="56" loading="lazy" decoding="async"></span>`
  : ICON_OF[item.id] ? html`<span class="info-icon drawn" aria-hidden="true">${icon(ICON_OF[item.id], 30)}</span>` : html`<span class="info-icon" aria-hidden="true"></span>`;

function effectCard(item) {
  return html`<li class="info-item" id="planet-${item.id}" ${item.id === state.biome ? 'data-focus' : ''}>
    ${effectIcon(item)}
    <div class="info-body">
      <h3>${title(item)}</h3>${enLine(item)}
      ${item.description ? html`<p class="info-desc">${text(item.description, item.descriptionEn)}</p>` : ''}
      ${item.where === 'metropolis' ? html`<p class="info-detail">${L('도시(메트로폴리스) 지역에서만 나옵니다.', 'Only in Metropolis areas.')}</p>` : ''}
      ${(lang === 'en' ? item.detailEn : item.detail)?.map(line => html`<p class="info-detail">${line}</p>`) ?? ''}
      ${item.tips ? html`<p class="info-tips-label">${L('실전 팁', 'Field tips')}</p>${(lang === 'en' ? item.tipsEn : item.tips).map(line => html`<p class="info-detail">${line}</p>`)}` : ''}
      ${item.biomes?.length ? html`<p class="armor-source">${L('나오는 생물군계', 'Biomes')}: ${item.biomes.map((id, i) => html`${i ? ' · ' : ''}<a href="#/planets?tab=biomes&b=${id}">${biomeById.get(id) ? title(biomeById.get(id)) : id}</a>`)}</p>` : ''}
      <p class="armor-source">${external(item.wiki, L('위키', 'Wiki'))}</p>
    </div>
  </li>`;
}

function conditionsTab() {
  return html`<p class="lede-note">${L('행성마다 붙는 날씨·지형 효과입니다. 같은 생물군계라도 행성에 따라 다를 수 있습니다. 폭풍·지진·유성처럼 잠깐씩 일어났다 멎는 효과는 임무를 시작하고 최소 5분이 지나야 처음 일어나고, 끝난 뒤에는 5분마다 다시 일어납니다.', 'Weather and terrain effects attached to each planet. Planets of the same biome can differ. Effects that come and go, such as storms, tremors and meteors, first strike at least 5 minutes into the mission and return every 5 minutes after each one ends.')}</p>
    <ul class="info-list">${conditions.map(effectCard)}</ul>
    <h2 class="planet-sub">${L('환경 위험 요소', 'Environmental hazards')}</h2>
    <p class="lede-note">${L('지형에 놓인 지뢰, 식물, 용암 같은 위험 요소입니다. 생물군계나 그 지역을 차지한 적에 따라 나옵니다.', 'Mines, plants, lava and other hazards in the terrain. Which ones appear depends on the biome or the enemy holding the area.')}</p>
    <ul class="info-list">${hazards.map(effectCard)}</ul>
    <h2 class="planet-sub">${L('글룸', 'The Gloom')}</h2>
    <p class="lede-note">${L('글룸에 덮인 행성의 물류 효과입니다. 단계가 높을수록 탈출이 늦어지고 이글 재무장이 느려집니다.', 'Logistics effects on planets covered by the Gloom. Higher levels slow extraction and Eagle rearm more.')}</p>
    <ul class="info-list">${gloomLevels.map(effectCard)}</ul>
    <h2 class="planet-sub">${L('엑소스톰', 'Exostorms')}</h2>
    <p class="lede-note">${L('일루미닛 세력 행성에서만 생기는 폭풍입니다. 시간이 지날수록 1단계에서 3단계로 강해집니다.', 'Storms that only rise on Illuminate planets, growing from class 1 to class 3 over time.')}</p>
    <ul class="info-list">${specialEffects.filter(item => item.id.startsWith('exostorm')).map(effectCard)}</ul>
    <h2 class="planet-sub">SEAF</h2>
    <p class="lede-note">${L('슈퍼 지구 세력의 지원 효과로, 어느 세력의 행성에서든 붙을 수 있습니다.', 'A Super Earth support effect that can appear on a planet of any faction.')}</p>
    <ul class="info-list">${specialEffects.filter(item => item.id === 'heavy-seaf-presence').map(effectCard)}</ul>
    <h2 class="planet-sub">${L('민주주의 우주 정거장', 'Democracy Space Station')}</h2>
    <p class="lede-note">${L('헬다이버들이 투표로 옮기는 슈퍼 지구의 우주 정거장입니다. 정거장이 머무는 행성에는 기본 효과 2개가 늘 붙고, 기부로 충전한 전술 행동이 24시간 동안 켜집니다.', 'A Super Earth space station the Helldivers move by vote. The planet it orbits always gets its two base effects, plus a Tactical Action charged by donations for 24 hours.')}</p>
    <ul class="info-list">${specialEffects.filter(item => item.id.startsWith('dss')).map(effectCard)}</ul>`;
}

function modifiersTab() {
  return html`<p class="lede-note">${L('난이도 5부터 1개, 난이도 8부터 2개가 붙는 전장의 방해 요소입니다. 방어 캠페인 행성에는 붙지 않습니다.', 'Battlefield obstacles: one from difficulty 5, two from difficulty 8. Planets under a Defense Campaign have none.')}</p>
    ${FACTIONS.map(faction => {
      const list = operationModifiers.filter(item => item.faction === faction.id);
      return list.length ? html`<h2 class="planet-sub">${faction.name}</h2><ul class="info-list">${list.map(effectCard)}</ul>` : '';
    })}
    <h2 class="planet-sub">${L('이벤트 효과', 'Event effects')}</h2>
    <p class="lede-note">${L('행사나 주요 명령 기간에 행성 전체에 붙는 효과입니다. 모든 난이도에 적용됩니다.', 'Effects added to planets during events or Major Orders, on every difficulty.')}</p>
    <ul class="info-list">${eventEffects.map(effectCard)}</ul>
    <h2 class="planet-sub">${L('그 밖의 이벤트 효과', 'Other event effects')}</h2>
    <p class="lede-note">${L('게임 파일에 들어 있는 이벤트 효과 문장입니다. 행사나 주요 명령에 따라 붙고, 이름과 수치(N)는 그때마다 다릅니다.', 'Event effect sentences found in the game files. They come with events or Major Orders, and the name and amount (N) change each time.')}</p>
    <ul class="info-list">${eventKinds.map(kind => html`<li class="info-item plain" id="planet-${kind.id}" ${kind.id === state.biome ? 'data-focus' : ''}>
      <div class="info-body">
        <h3>${lang === 'en' ? kind.en : kind.name}</h3>
        ${(lang === 'en' ? kind.linesEn : kind.lines).map(line => html`<p class="info-detail">${line}</p>`)}
      </div>
    </li>`)}</ul>`;
}

function biomeCard(biome) {
  const image = biomeImages[biome.id];
  return html`<li class="info-item biome-item" id="biome-${biome.id}" ${biome.id === state.biome ? 'data-focus' : ''}>
    ${image ? html`<img class="biome-thumb" src="${image.src}" alt="" width="${image.width}" height="${image.height}" loading="lazy" decoding="async">` : ''}
    <div class="info-body" style="grid-column:1/-1">
      <div class="armor-title"><h3>${title(biome)}</h3>${biome.archetype ? badge(lang === 'en' ? biome.archetype : biome.archetypeName ?? biome.archetype, 'outline') : ''}</div>${enLine(biome)}
      ${biome.description ? html`<p class="info-desc">${text(biome.description, biome.descriptionEn)}</p>` : ''}
      <p class="armor-source">${L('대표 환경 조건', 'Typical conditions')}: ${biome.conditions.length ? biome.conditions.map((id, i) => html`${i ? ' · ' : ''}${T(conditionById.get(id).name)}`) : L('없음', 'None')}</p>
      ${biome.planets.length ? html`<details class="biome-planets"><summary>${L(`행성 ${biome.planets.length}개`, `${biome.planets.length} ${biome.planets.length === 1 ? 'planet' : 'planets'}`)}</summary><p>${biome.planets.map((planet, i) => html`${i ? ' · ' : ''}${planetLink(planet)}`)}</p></details>` : ''}
      <p class="armor-source">${external(biome.wiki, L('위키', 'Wiki'))}</p>
    </div>
  </li>`;
}

function biomesTab() {
  return html`<p class="lede-note">${L('행성의 지형과 기후를 정하는 생물군계입니다. 행성 목록은 게임 데이터 기준입니다.', 'The biome sets a planet\'s terrain and climate. Planet lists follow the game data.')}</p>
    <ul class="info-list biome-list">${biomes.map(biomeCard)}</ul>`;
}

// A planet with a wiki page links to it (many game planets have none).
const planetLink = planet => {
  const name = lang === 'en' ? planet.en : planet.name;
  return planet.wiki ? html`<a href="https://helldivers.wiki.gg/wiki/${encodeURIComponent(planet.wiki.replaceAll(' ', '_'))}" target="_blank" rel="noopener noreferrer">${name}<span aria-hidden="true"> ↗</span></a>` : name;
};

// Clock speed (planet-time.js, measured in game): names and biomes come from the biome planet lists.
const biomeOfPlanet = new Map(biomes.flatMap(biome => biome.planets.map(planet => [planet.en, { planet, biome }])));
const duration = minutes => {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? L(`${h}시간${m ? ` ${m}분` : ''}`, `${h} h${m ? ` ${m} min` : ''}`) : L(`${m}분`, `${m} min`);
};

function timeTab() {
  return html`<p class="lede-note">${L('행성마다 현지 시각이 흐르는 속도가 다릅니다. 낮은 06시~18시, 밤은 18시~06시로 동일하며, 은하 지도의 시각 옆 해·달 아이콘이 이때 바뀝니다.',
      'Each planet\'s local clock runs at its own speed. Day runs 06:00-18:00 and night 18:00-06:00 on every planet; the sun and moon icon beside the galaxy map clock switches at those hours.')}</p>
    <div class="compare-scroll" role="region" aria-label="${L('행성별 시간 배율', 'Clock speed by planet')}" tabindex="0"><table class="compare-table time-table">
      <thead><tr><th scope="col">${L('행성', 'Planet')}</th><th scope="col">${L('생물군계', 'Biome')}</th><th scope="col">${L('배율', 'Rate')}</th><th scope="col" aria-sort="${state.timeSort === 'asc' ? 'ascending' : 'descending'}"><button type="button" class="th-sort" data-time-sort data-dir="${state.timeSort}">${L('자전주기', 'Rotation period')}</button></th></tr></thead>
      <tbody>${[...planetTimeScales].sort((a, b) => (Math.abs(b.rate) - Math.abs(a.rate)) * (state.timeSort === 'asc' ? 1 : -1)).map(item => {
        const { planet, biome } = biomeOfPlanet.get(item.en) ?? {};
        const day = Math.round(1440 / Math.abs(item.rate));
        return html`<tr ${item.rate < 0 ? 'data-reverse' : ''}><th scope="row">${planet ? planetLink(planet) : item.en}${planet && lang !== 'en' && planet.name !== planet.en ? html`<small>${planet.en}</small>` : ''}</th>
          <td>${biome ? html`<a href="#/planets?tab=biomes&b=${biome.id}">${title(biome)}</a>` : '-'}</td>
          <td><b>${L(`${item.rate}배`, `${item.rate}x`)}</b>${item.rate < 0 ? html`<small>${L('거꾸로 흐름', 'runs backwards')}</small>` : ''}</td>
          <td>${duration(day)}</td></tr>`;
      })}</tbody>
    </table></div>`;
}

function statusTab() {
  return html`<p class="lede-note">${L('헬다이버와 적에게 걸리는 상태 이상입니다.', 'Status effects that hit Helldivers and enemies.')}</p>
    <ul class="info-list">${statusEffects.map(item => html`<li class="info-item" id="planet-${item.id}" ${item.id === state.biome ? 'data-focus' : ''}>
      <span class="info-icon drawn" aria-hidden="true">${icon(`status-${item.id}`, 30)}</span>
      <div class="info-body">
        <h3>${title(item)}</h3>${enLine(item)}
        ${(lang === 'en' ? item.detailEn : item.detail).map(line => html`<p class="info-detail">${line}</p>`)}
        <p class="armor-source">${external(item.wiki, L('위키', 'Wiki'))}</p>
      </div>
    </li>`)}</ul>`;
}

const BODIES = { conditions: conditionsTab, modifiers: modifiersTab, biomes: biomesTab, time: timeTab, status: statusTab };

function renderTab() {
  for (const button of $$('[data-planet-tab]', root)) button.setAttribute('aria-pressed', String(button.dataset.planetTab === state.tab));
  $('.planet-checked', root).textContent = state.tab === 'time' ? L(`실측 ${planetTimeMeasuredAt}`, `Measured ${planetTimeMeasuredAt}`) : L(`자료 확인 ${planetsCheckedAt}`, `Checked ${planetsCheckedAt}`);
  render($('#planet-body', root), BODIES[state.tab]());
  const marked = state.biome && ($(`#biome-${state.biome}`, root) || $(`#planet-${state.biome}`, root));
  if (marked) requestAnimationFrame(() => marked.scrollIntoView({ block: 'center' }));
}

const syncUrl = () => ctx.replace({ view: 'planets', query: { tab: state.tab === 'conditions' ? '' : state.tab, b: state.biome } });

export function mount(container, context) {
  root = container; ctx = context;
  render(root, html`<div class="page-head"><div><div class="eyebrow">Planets</div><h1>${L('행성', 'Planets')}</h1>
    <p>${L('출격할 행성의 환경 조건, 작전 제한 조건, 생물군계, 시간 배율, 상태 이상을 정리했습니다.', 'Environmental conditions, operation modifiers, biomes, clock speeds and status effects of the planets you drop on.')}</p></div></div>
    <div class="planet-head"><div class="segmented planet-tabs" role="group" aria-label="${L('행성 정보', 'Planet info')}">${TABS.map(tab => html`<button type="button" data-planet-tab="${tab.id}">${icon(tab.icon, 16)} ${tab.name}</button>`)}</div>
      <span class="planet-checked">${L(`자료 확인 ${planetsCheckedAt}`, `Checked ${planetsCheckedAt}`)}</span></div>
    <div id="planet-body"></div>`);
  root.addEventListener('click', event => {
    if (event.target.closest('[data-time-sort]')) {
      state.timeSort = state.timeSort === 'asc' ? 'desc' : 'asc';
      render($('#planet-body', root), timeTab());
      $('[data-time-sort]', root).focus();
      return;
    }
    const button = event.target.closest('[data-planet-tab]');
    if (!button) return;
    state.tab = button.dataset.planetTab; state.biome = '';
    renderTab(); syncUrl();
  });
}

export function update(route) {
  const q = route.query;
  state.tab = TABS.some(tab => tab.id === q.tab) ? q.tab : 'conditions';
  state.biome = focusIds.has(q.b) ? q.b : '';
  renderTab();
}

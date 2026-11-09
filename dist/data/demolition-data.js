import { weaponProfiles } from './combat-data.js';

export const demolitionCheckedAt = '2026-09-16';
export const demolitionSource = 'https://helldivers.wiki.gg/wiki/Demolition';
export const structureDamageSource = 'https://helldivers.wiki.gg/wiki/Damage';
const wiki = page => `https://helldivers.wiki.gg/wiki/${page}`;
const route = (id, name, threshold, explosiveOnly = false, extra = {}) => ({ id, name, threshold, explosiveOnly, ...extra });
const health = (hp, armor, durability = 100, exdr = 0) => ({ hp, armor, durability, exdr });
const building = (id, name, faction, routes, tip, extra = {}) => ({ id, name, faction, routes, tip, source: demolitionSource, ...extra });

// Demolition thresholds and health are separate destruction paths. An absent
// health record means no reviewed health path; it does not create an HP pool.
// A null threshold means the wiki gives none: the route stays unverified.
// thresholdSource 'user' marks a threshold the user set where the wiki gives none.
// Structures with `page` and `revision` (added 2026-11-09) cite that wiki page in
// db/source/wiki_structures.json; thresholds named in the Demolition summary
// table (db/source/wiki_names.json, revision 141088) are taken from it.
export const structures = [
  building('container', '화물 컨테이너', '공용 시설', [route('shell', '컨테이너 본체', 20)], '잠긴 화물 컨테이너에 공격을 맞히세요. 두 명이 버튼을 눌러 여는 벙커와는 다릅니다.', { source: wiki('Points_of_Interest') }),
  building('broadcast', '불법 방송탑', '공용 시설', [route('tower', '방송탑', 30)], '안테나가 달린 방송탑 본체를 노리세요.'),
  building('research', '불법 연구소', '공용 시설', [route('building', '목표 연구 시설', 50)], '임무에서 지정한 연구 시설 가까이에 폭발 중심을 맞추세요.'),
  building('bug-hole', '벌레굴', '테르미니드', [route('outer', '굴 외곽', 40), route('inner', '굴 안쪽', 20, true, { opening: true })], '철거력이 낮은 폭발물은 굴 안쪽으로 넣어야 합니다. 굴 앞 지면에서 터지는 것과 구분하세요.'),
  building('titan-hole', '바일 타이탄 벌레굴', '테르미니드', [route('outer', '대형 굴 본체', 40)], '일반 벌레굴보다 큰 특수 굴입니다. 일반 굴의 내부 철거력 20 조건을 적용하지 않습니다.'),
  building('spore-spewer', '포자 스퓨어', '테르미니드', [route('growth', '스퓨어 본체', 50)], '줄기 위의 포자 스퓨어 본체를 맞히세요. 철거력 외에 체력 소진으로도 파괴할 수 있습니다.', { health: health(2500, 2), healthSource: structureDamageSource }),
  building('shrieker-nest', '슈리커 둥지', '테르미니드', [route('tower', '둥지 기둥 한 개', 60)], '기둥 한 개 기준입니다. 낮은 철거력의 무기도 체력에 피해를 주면 파괴할 수 있습니다.', { health: health(2500, 2), healthSource: structureDamageSource }),
  building('stalker-lair', '스토커 둥지', '테르미니드', [route('outer', '굴 외곽', 40), route('inner', '굴 안쪽', 20, true, { opening: true })], '둥지 주변의 굴 1~2개를 일반 벌레굴처럼 하나씩 부숴야 합니다. 철거력 20 폭발물은 굴 안쪽으로 넣고, 철거력 40 이상이면 굴 외곽에 맞혀도 됩니다.', { source: wiki('Stalker_Lair'), page: 'Stalker Lair', revision: 141235 }),
  building('infested-tower', '인스페티드 타워', '테르미니드', [route('tower', '타워 본체', 50)], '메가시티의 감염된 고층 건물입니다. 임무에서 주는 지옥폭탄을 가까이에서 터뜨리거나 철거력 50 공격으로 철거하세요. 장갑이 약해 지속 사격으로 체력을 깎아도 부서집니다. 건물 위쪽이 넓어 지옥폭탄 포드가 걸릴 수 있습니다.', { health: health(15000, 2), healthSource: wiki('Cleanse_Infested_District'), page: 'Cleanse Infested District', revision: 137839 }),
  building('spore-lung', '스포어 렁', '테르미니드', [route('lung', '스포어 렁 본체', 50)], '하이브 지하 깊은 곳의 임무 목표입니다. 임무에서 주는 휴대용 지옥폭탄을 옆에서 터뜨리거나, 체력을 깎아 부수세요.', { health: health(5000, 2), source: wiki('Destroy_Spore_Lung'), healthSource: wiki('Destroy_Spore_Lung'), page: 'Destroy Spore Lung', revision: 141656 }),
  building('fabricator', '오토마톤 제조소', '오토마톤', [route('outer', '외벽·지붕', 40), route('vent', '환풍구 안쪽', 20, true, { opening: true })], '환풍구 안에 폭발을 넣거나, 충분한 철거력으로 외벽을 맞히세요. 대전차 무기는 체력을 소진시킬 수도 있습니다.', { health: health(1500, 5), source: wiki('Bot_Fabricator'), healthSource: wiki('Bot_Fabricator') }),
  building('bulk-fabricator', '대형 제조소', '오토마톤', [route('outer', '외벽', 50), route('vent', '상단 환풍구 안쪽', 20, true, { opening: true })], '일반 제조소보다 높은 외벽 철거력이 필요합니다. 위쪽의 두 환풍구는 폭발을 안으로 넣는 경로입니다.', { health: health(4000, 5), healthSource: structureDamageSource }),
  building('detector', '탐지탑', '오토마톤', [route('tower', '탐지탑 본체', 50)], '탑 본체가 폭발 중심부에 들어오도록 하세요. 철거력 50 공격이 있으면 지옥폭탄 없이도 철거할 수 있습니다.', { source: wiki('Detector_Tower') }),
  building('jammer', '스트라타젬 교란기', '오토마톤', [route('tower', '교란기 본체', 50)], '궤도·이글 등 호출 공격은 교란기를 비활성화한 조건으로 계산합니다. 이미 들고 온 장비의 공격은 구분합니다.', { source: wiki('Stratagem_Jammer'), condition: 'jammer' }),
  building('gunship-facility', '건쉽 제조소', '오토마톤', [route('building', '제조소 본체', 60)], '지옥폭탄의 최대 철거력이 적용되는 중심 17 m 안에 시설을 넣어야 합니다.', { source: wiki('Gunship_Facility') }),
  building('orbital-cannon', '궤도포', '오토마톤', [route('cannon', '목표 궤도포', 60)], '철거력 60 공격의 중심부가 목표 시설에 닿아야 합니다.'),
  building('fuel-reserve', '연료 저장고', '오토마톤', [route('storage', '목표 저장 시설', 60)], '임무에서 지정한 저장 시설 기준입니다. 주변의 작은 폭발 드럼통과는 다릅니다.'),
  building('bio-processor', '바이오 프로세서', '오토마톤', [route('processor', '프로세서 본체', 40)], '장갑이 거의 없어 대부분의 무기로 체력을 깎을 수 있습니다. 철거력 40 공격(이글 공중타격, C4 팩 등)이면 한 번에 무너집니다. 가까이 가면 지옥폭탄도 호출할 수 있습니다.', { health: health(5000, 1, 0), healthSource: wiki('Enemy_Bio-Processors'), page: 'Enemy Bio-Processors', revision: 142048 }),
  building('megafactory-gate', '메가팩토리 게이트', '오토마톤', [route('gate', '게이트', 40)], '메가팩토리 외벽의 닫힌 출입문입니다. 철거력 40 공격으로 철거하세요. 내구도가 800%라 내구 피해 비율이 87.5% 이하인 공격은 체력에 피해를 주지 못합니다. 오토마톤이 다가오면 열리기도 합니다.', { health: health(6000, 4, 800), healthSource: wiki('Automaton_Megafactory#Gates'), page: 'Automaton Megafactory', revision: 136681 }),
  building('terrorist-memorial', '조각상', '오토마톤', [route('statue', '조각상 한 개', 30)], '메가팩토리 안의 오토마톤·사이보그 기념 조각상입니다. 하나씩 철거력 30 공격으로 부수세요. 폭발형 지원 무기와 대부분의 수류탄으로 충분합니다.', { source: wiki('Erase_Terrorist_Memorials'), page: 'Erase Terrorist Memorials', revision: 134868 }),
  // The wiki gives no threshold for the tower; 10 is the user's own value
  // (2026-11-09), marked thresholdSource 'user' and checked in test-structures.mjs.
  building('transmission-network', '전송 네트워크', '오토마톤', [route('tower', '전송탑', 10, false, { thresholdSource: 'user' })], '송신기 판은 소총 사격으로도 하나씩 부술 수 있습니다. 탑 전체는 폭발형 철거력 공격(예: 퀘이사 캐넌)으로 무너뜨릴 수 있고, 이때 송신기도 함께 부서집니다.', { source: wiki('Destroy_Transmission_Network'), page: 'Destroy Transmission Network', revision: 142145, note: '위키에 탑의 필요 철거력이 없어, 철거력 10은 위키 수치가 아니라 이 사이트가 정한 값입니다. 송신기 판의 체력은 위키에 없어 계산하지 않습니다.' }),
  building('cooling-tower', '냉각 탑', '오토마톤', [route('tower', '냉각 탑 본체', 50)], '사이보그 생산 시설 임무의 하위 목표입니다. 지옥폭탄 외에도 철거력 50 공격(휴대용 지옥폭탄, 이글 500kg 폭탄, 궤도 포격 등)으로 부술 수 있습니다. 위키는 궤도 가스·EMS·연막 타격은 탄체를 직접 맞혀야 한다고 적고 있습니다.', { source: wiki('Halt_Cyborg_Production'), page: 'Halt Cyborg Production', revision: 130623 }),
  building('warp-ship', '착륙한 워프 함선', '일루미닛', [route('hull', '함선 외벽', 50, false, { nonExplosiveUncertain: true }), route('door', '열린 출입구 안쪽', 20, true, { opening: true })], '보호막을 제거하고 열린 출입구 안에 폭발을 넣는 것이 기본 경로입니다. 본체 폭발 피해는 2.5배입니다.', { health: health(5000, 5, 100, -150), source: wiki('Grounded_Warp_Ship'), healthSource: wiki('Grounded_Warp_Ship'), condition: 'shield', note: '외벽의 비폭발 공격 허용 여부는 위키 표끼리 다릅니다. 직접 파괴 사례가 확인된 궤도 지원 외에는 해당 경로를 확정하지 않습니다.' }),
  building('lightning-spire', '번개 첨탑', '일루미닛', [route('spire', '첨탑 본체', 20)], '전격을 방출하는 첨탑 본체를 공격하세요. 체력에 피해를 주는 경로도 있습니다.', { health: health(200, 2, 80), healthSource: structureDamageSource }),
  building('disruptor-psu', '인지 교란기 전원 장치', '일루미닛', [route('power', '전원 장치 한 개', 30)], '주변 전원 장치 한 개 기준입니다. 시설 전체의 임무 완료 조건과 구분하세요.', { health: health(180, 0), healthSource: structureDamageSource }),
  building('monolith', '모노리스', '일루미닛', [route('monolith', '모노리스 본체', 60)], '지옥폭탄이나 SEAF 소형 핵탄두의 중심부로 철거하세요.', { source: wiki('Monolith') }),
  building('gazer', '게이저', '일루미닛', [route('gazer', '게이저 본체', 20)], '철거력 20 이상 공격(대물소총, 레이저 캐넌 등)이면 한 번에 부서집니다. 눈은 장갑 1이라 어떤 무기로도 피해를 줄 수 있지만, 눈 주변은 장갑 5입니다.', { health: health(700, 1, 0), healthSource: wiki('Gazer'), page: 'Gazer', revision: 141677, note: '체력 계산은 눈(체력 700, 장갑 1) 기준입니다. 눈을 정면에서 맞히는 조건입니다.' }),
  building('gazer-spire', '게이저 스파이어', '일루미닛', [route('spire', '스파이어 본체', 60)], '철거력 60이 필요해 휴대용 지옥폭탄, 지옥폭탄, SEAF 소형 핵탄두로만 파괴할 수 있습니다. 솔로 사일로는 철거력이 모자랍니다. 주변의 워프 게이트는 따로 부숴야 적이 그만 나옵니다.', { page: 'Gazer Spire', revision: 138883 }),
];

const damage = (standard, durable, ap, explosion = 0, explosionAp = 0) => ({ standard, durable, ap, explosion, explosionAp });
const combatDamage = (id, modeId) => weaponProfiles[id]?.modes.find(mode => mode.id === modeId && !mode.unsupported);
const mode = (id, name, direct, explosion, extra = {}) => ({ id, name, direct, explosion, ...extra });
const profile = (modes, extra = {}) => ({ source: demolitionSource, modes, ...extra });
const shot = (direct, explosion, extra = {}) => [mode('standard', '기본 공격', direct, explosion, extra)];
const callIn = (modes, extra = {}) => profile(modes, { requiresCallIn: true, ...extra });
const indirect = '공격이 시설에 실제로 닿는 조건입니다. 자동 조준·유도·살포 위치로 인해 원하는 부위를 직접 선택하지 못할 수 있습니다.';
const automatic = '자동 포탑은 시설을 표적으로 직접 지정할 수 없습니다. 아래 결과는 탄이나 폭발이 시설에 실제로 닿는 경우입니다.';

export const demolitionProfiles = {
  'autocannon': profile([
    mode('aphet', '철갑고폭예광탄(APHET)', 30, 30, { damage: combatDamage('autocannon', 'aphet') }),
    mode('flak', '대공포탄 모드', 20, 20, { note: '근접 신관이 입구 앞에서 터지면 내부 철거에 실패할 수 있습니다. 파편 피해의 탄수 계산은 보류합니다.' }),
  ], { source: wiki('AC-8_Autocannon') }),
  'recoilless': profile([
    mode('heat', '대전차 고폭탄(HEAT)', 30, 30, { damage: combatDamage('recoilless', 'heat') }),
    mode('he', '고폭탄(HE)', 30, 30, { damage: combatDamage('recoilless', 'he') }),
  ], { source: wiki('Recoilless') }),
  'expendable-at': profile(shot(30, 30, { damage: combatDamage('expendable-at', 'standard') })),
  'quasar': profile(shot(30, 30, { damage: combatDamage('quasar', 'standard') })),
  'commando': profile(shot(30, 30, { damage: combatDamage('commando', 'standard') })),
  'anti-materiel': profile(shot(20, null, { damage: combatDamage('anti-materiel', 'standard') })),
  // Not yet in the wiki Demolition summary (revision 138005); the force is the
  // datamine's demo value, which matches that summary for the Anti-Materiel Rifle (20).
  'apex': profile(shot(30, null, { damage: combatDamage('apex', 'standard') }), { source: wiki('Module:Decodedata-Attacks/weapons_data.json'), note: '철거력 30은 위키 데이터마이닝 값입니다(패치 1.007.202에서 15→30). 위키 철거 문서의 종합표에는 아직 이 무기가 없습니다.' }),
  'nova': profile(shot(17, null, { damage: combatDamage('nova', 'standard') }), { source: wiki('Module:Decodedata-Attacks/weapons_data.json'), note: '철거력 17은 위키 데이터마이닝 값입니다. 위키 철거 문서의 종합표에는 아직 이 무기가 없습니다.' }),
  'spear': profile(shot(40, 30, { damage: damage(4000, 4000, 7, 200, 3) }), { source: wiki('FAF-14_Spear'), conditionalAim: true, note: indirect }),
  'laser-cannon': profile(shot(20, null, { directLabel: '광선', note: '광선이 실제로 닿아야 합니다. 지속 피해는 발 단위로 계산하지 않습니다.' })),
  'arc-thrower': profile(shot(20, null, { directLabel: '전격' }), { conditionalAim: true, note: indirect }),
  'meltagun': profile(shot(30, null, { directLabel: '광선' })),
  'grenade-launcher': profile(shot(null, 30)),
  'belt-fed-gl': profile(shot(null, 30)),
  'c4-pack': profile(shot(null, 40, { name: '장약 1개 폭발', unit: '개', damage: damage(0, 0, 0, 2000, 7), shieldBypass: true, note: '본체가 폭발 중심 3 m 안에 있는 조건입니다. 워프 함선은 보호막이 있어도 장약 한 개로 체력을 소진할 수 있습니다.' }), { source: wiki('B/MD_C4_Pack') }),
  'breaching-hammer': profile([
    mode('melee', '일반 타격', 30, null, { directLabel: '타격' }),
    mode('charge', '폭발 장약 사용', 30, 30, { directLabel: '타격' }),
  ]),
  'leveller': profile(shot(40, 40)),
  'wasp': profile(shot(30, 30), { conditionalAim: true, note: indirect }),
  'solo-silo': profile(shot(null, 40, { name: '미사일 폭발', note: '여러 폭발의 철거력 40을 합산하지 않습니다.' })),
  // Wiki Demolition summary (revision 138005), Other Stratagems: TD-110 Maelstrom,
  // Missile Explosion, force 40, explosive. The table has no row for its Gatling guns.
  'maelstrom': profile(shot(null, 40, { name: '미사일 폭발' })),
  'speargun': profile(shot(30, 30)),
  'de-escalator': profile(shot(20, null, { directLabel: '전격' }), { conditionalAim: true, note: indirect }),
  'epoch': profile([
    mode('standard', '일반 발사', 10, 10, { damage: damage(400, 200, 4, 500, 4), note: '피해: 직격 400 / 내구 200 / 폭발 500. 직격·폭발 관통 4.' }),
    mode('charged', '완전 충전 발사', 10, 30, { damage: damage(800, 400, 5, 800, 5), note: '피해: 직격 800 / 내구 400 / 폭발 800. 직격·폭발 관통 5. 벌레굴 내부와 제조소 환풍구는 폭발이 안쪽에 들어가야 철거력으로 파괴됩니다.' }),
  ], { source: wiki('PLAS-45_Epoch'), damageSource: wiki('PLAS-45_Epoch#Detailed_Weapon_Statistics'), note: '과충전 자폭은 발사 모드와 피해 계산에서 제외합니다.' }),
  'orbital-precision': callIn(shot(50, 50, { name: '포탄 1발', damage: damage(4000, 4000, 8, 1500, 6), shieldBypass: true }), { source: wiki('Orbital_Precision_Strike') }),
  'orbital-120': callIn(shot(50, 50, { name: '포탄 1발', damage: damage(3500, 3500, 7, 1200, 5), shieldBypass: true, note: '한 번의 호출 전체가 아닌, 시설에 명중한 포탄 한 발 기준입니다.' })),
  'orbital-380': callIn(shot(50, 50, { name: '포탄 1발', damage: damage(4000, 4000, 8, 1500, 6), shieldBypass: true, note: '폭격 범위 안에 있어도 포탄이 빗나가면 파괴되지 않습니다.' })),
  'orbital-walking': callIn(shot(50, 50, { name: '포탄 1발', damage: damage(4000, 4000, 8, 1500, 6), shieldBypass: true })),
  'orbital-gatling': callIn(shot(30, 30, { name: '포탄 1발' })),
  'orbital-napalm': callIn(shot(30, 30, { name: '포탄 1발', note: '남는 불길의 지속 피해는 이 철거력 판정에 합산하지 않습니다.' })),
  'orbital-laser': callIn(shot(50, null, { name: '시설에 닿은 광선', directLabel: '광선', shieldBypass: true }), { conditionalAim: true, note: '레이저가 시설을 실제로 훑는 조건입니다. 원하는 시설을 직접 조준할 수 없고 지속 피해의 탄수는 계산하지 않습니다.' }),
  'orbital-railcannon': callIn(shot(50, 50, { shieldBypass: true }), { conditionalAim: true, note: '레일캐넌은 자동으로 표적을 고릅니다. 수치 충족이 해당 시설을 자동 조준한다는 뜻은 아닙니다.' }),
  'orbital-gas': callIn(shot(50, 50, { name: '탄체·초기 효과', shieldBypass: true, note: '탄체 또는 초기 효과 중심부 기준입니다. 가스 지속 피해의 철거력은 0이며, 구름 전체가 철거력 50인 것은 아닙니다.' }), { source: wiki('Orbital_gas') }),
  'orbital-ems': callIn(shot(50, 30, { name: '탄체·초기 효과', note: '탄체 직격과 초기 효과를 구분합니다. 전기장에 오래 머문다고 철거력이 누적되지는 않습니다.' })),
  'orbital-smoke': callIn(shot(50, null, { name: '연막탄 탄체 직격', note: '연막이 아니라 떨어지는 탄체를 직접 맞혀야 합니다.' })),
  'eagle-airstrike': callIn(shot(40, 40, { name: '폭탄 1발' })),
  'eagle-strafing': callIn(shot(30, 30, { name: '기총탄 1발' })),
  'eagle-cluster': callIn(shot(40, 30, { name: '탄체·집속 폭발' }), { conditionalAim: true, note: '탄체의 직접 충돌과 공중에서 퍼지는 폭발을 구분해야 합니다. 표기 직격 수치만으로 일반적인 건물 철거를 보장하지 않습니다.' }),
  'eagle-napalm': callIn(shot(40, 30, { name: '폭탄 1발', note: '화염의 지속 피해는 합산하지 않습니다.' })),
  'eagle-rockets': callIn(shot(40, 30, { name: '로켓 1발' }), { conditionalAim: true, note: indirect }),
  'eagle-smoke': callIn(shot(40, null, { name: '연막탄 탄체 직격', note: '연막에는 철거력이 없습니다. 탄체를 시설에 직접 맞히는 조건입니다.' })),
  'eagle-500kg': callIn(shot({ min: 40, max: 50 }, 50, { name: '폭탄 1개 · 주 폭발', shieldBypass: true, damage: damage(2000, 2000, 7, 1500, 6), note: '직격은 종합표 40, 개별 통계 50으로 엇갈립니다. 주 폭발 50은 일치합니다. 체력 계산은 추가 착탄 폭발 100을 제외한 보수적인 값입니다.' }), { source: wiki('Eagle_500Kg_Bomb'), conflictingSource: demolitionSource }),
  'hmg-emplacement': profile(shot(20, null)),
  'at-emplacement': profile(shot(30, 30)),
  'grenadier-battlement': profile(shot(null, 30)),
  'autocannon-sentry': profile(shot(30, 30), { conditionalAim: true, note: automatic }),
  'rocket-sentry': profile(shot(30, 30), { conditionalAim: true, note: automatic }),
  'mortar-sentry': profile(shot(null, 30), { conditionalAim: true, note: automatic }),
  'ems-mortar': profile(shot(null, 30, { note: '착탄 효과의 철거력입니다. 기절 효과를 피해량으로 계산하지 않습니다.' }), { conditionalAim: true, note: automatic }),
  'tesla-tower': profile(shot(20, null, { directLabel: '전격' }), { conditionalAim: true, note: automatic }),
  'at-mines': profile(shot(null, 40), { conditionalAim: true, note: '시설 가까이에서 지뢰가 실제로 기폭해야 합니다. 배치만으로 철거하지 않습니다.' }),
  'personnel-mines': profile(shot(null, 30), { conditionalAim: true, note: '시설 가까이에서 지뢰가 실제로 기폭해야 합니다.' }),
  'incendiary-mines': profile(shot(null, 30), { conditionalAim: true, note: '시설 가까이에서 지뢰가 실제로 기폭해야 합니다. 잔불은 제외합니다.' }),
  'gas-mines': profile(shot(null, 30), { conditionalAim: true, note: '시설 가까이에서 지뢰가 실제로 기폭해야 합니다. 가스 지속 피해는 제외합니다.' }),
  'portable-hellbomb': profile(shot(null, 60, { name: '지옥폭탄 폭발', note: '시설이 중심 17 m 안에 들어오는 조건입니다. 이미 휴대한 폭탄의 기폭은 스트라타젬 호출과 다릅니다.' }), { source: wiki('Portable_Hellbomb') }),
  'hellbomb': callIn(shot(null, 60, { name: '지옥폭탄 폭발', note: '시설이 중심 17 m 안에 들어오는 조건입니다. 호출이 허용되는 임무 구역에서 장전해야 합니다.' }), { source: wiki('Portable_Hellbomb') }),
  'seaf-artillery': callIn([
    mode('he', '고폭탄', 50, 50, { shieldBypass: true }),
    mode('high-yield', '고위력탄', 50, 50, { shieldBypass: true }),
    mode('mini-nuke', '소형 핵탄두', 50, 60, { shieldBypass: true }),
    mode('napalm', '네이팜탄', 50, 30, { warpHullDirect: true }),
    mode('ems', '정전기장탄', 50, 30, { warpHullDirect: true }),
    mode('smoke', '연막탄 · 탄체 직격', 50, null, { warpHullDirect: true }),
  ], { note: '실제로 장전되어 다음에 발사될 탄종을 고르세요. 여기서 고른다고 게임의 발사 순서가 바뀌지는 않습니다.' }),
};

for (const id of ['orbital-120', 'orbital-380', 'orbital-walking']) demolitionProfiles[id].damageSource = wiki('Damage_Comparison');

// Keep reviewed HP attacks useful even where their demolition value is not yet
// confirmed. Unknown force must never be treated as zero or "cannot destroy".
for (const [id, entry] of Object.entries(weaponProfiles)) {
  if (demolitionProfiles[id] || entry.combatOnly) continue;
  demolitionProfiles[id] = profile(entry.modes.filter(item => !item.unsupported).map(item => mode(item.id, item.name, null, null, { damage: item, forceUnknown: true })), { source: entry.source, note: '이 무기의 탄환 철거력은 확인 중입니다. 확인된 피해 수치로 체력 파괴 경로만 계산합니다. 과충전 자폭·장비 파괴 폭발은 제외합니다.' });
}

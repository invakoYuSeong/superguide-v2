import { weaponProfiles } from './combat-data.js';
import { stratagemAttackDamage } from './stratagem-attacks.js';
import { stratagemStats } from './stratagem-stats.js';

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
  building('bug-hole', '벌레굴', '테르미니드', [route('outer', '굴 외곽', 40), route('inner', '굴 안쪽', 20, true, { opening: true })], '철거력이 낮은 폭발물은 굴 안쪽으로 넣어야 합니다. 굴 앞 지면에서 터지는 것과 구분하세요.', { tactics: ['연막·기절 수류탄과 투척 나이프는 철거력이 모자라 굴을 닫지 못합니다.', '유탄 발사기나 유탄 권총으로 굴 안에 유탄을 쏘아 넣어도 닫힙니다. 이럽터, 오토캐넌, 익스플로딩 크로스보우, 무반동포도 굴 안에 쏘면 닫을 수 있습니다.', '보급이나 지원 무기 헬포드가 굴 위에 떨어져도 닫힙니다. 다만 그 헬포드에 든 보급품이나 무기를 못 쓰게 될 수 있습니다.'], tacticsRef: { page: 'Bug Hole', revision: 141543 }, tips: ['뭉쳐 있는 굴은 이글 500kg 폭탄이나 이글 공중타격으로 한 번에 부수고, 떨어진 굴은 이럽터, 익스플로딩 크로스보우, 작살총, 유탄 발사기, 오토캐넌으로 멀리서 저격하세요.', '굴을 가장 잘 닫는 지원 무기는 오토캐넌, 작살총, 유탄 발사기입니다. 오토캐넌은 대공 모드로도 닫히지만 굴에서 적이 나오면 밖에서 터질 수 있어 멀리서는 APHET 모드가 편합니다.', '중급 둥지는 한가운데에 이글 500kg 폭탄을 떨구면 한 발로 끝나기도 합니다. 둥지를 지키는 차저나 바일 타이탄까지 함께 잡히기도 합니다.', '헬포드는 판정이 넓어 굴 앞에 대충 불러도 굴이 닫힙니다.'] }),
  building('titan-hole', '타이탄 벌레굴', '테르미니드', [route('outer', '대형 굴 본체', 40)], '일반 벌레굴보다 큰 특수 굴입니다. 일반 굴의 내부 철거력 20 조건을 적용하지 않습니다.', { tips: ['기가 수류탄과 멜타마인으로도 부술 수 있지만 세열 수류탄과 유탄 발사기로는 부서지지 않습니다. 급하면 굴 앞에 헬포드를 부르세요.', '입구가 주황색이고 뿔이 큰 굴로, 상급 이상 둥지에만 있습니다.'] }),
  building('stalker-lair', '스토커 둥지', '테르미니드', [route('outer', '굴 외곽', 40), route('inner', '굴 안쪽', 20, true, { opening: true })], '둥지 주변의 굴 1~2개를 일반 벌레굴처럼 하나씩 부숴야 합니다. 철거력 20 폭발물은 굴 안쪽으로 넣고, 철거력 40 이상이면 굴 외곽에 맞혀도 됩니다.', { source: wiki('Stalker_Lair'), page: 'Stalker Lair', revision: 141235, tactics: ['스토커는 둥지 150m 안에서 헬다이버가 발견되었을 때만 나옵니다. 근처에서 스토커를 발견했다면 최우선으로 스토커 둥지를 찾아서 부수는 것이 좋습니다.'], tacticsRef: { page: 'Stalker Lair', revision: 141235 } }),
  building('spore-spewer', '포자 스퓨어', '테르미니드', [route('growth', '스퓨어 본체', 50)], '줄기 위의 포자 스퓨어 본체를 맞히세요. 철거력 외에 체력 소진으로도 파괴할 수 있습니다.', { health: health(2500, 2), healthSource: structureDamageSource, tactics: ['궤도 정밀 타격, 이글 기총소사, 이글 500kg 폭탄, 이글 공중타격, 궤도 레일캐넌 타격은 한 번에 부숩니다.', '내구도가 100%라 주무기로는 오래 걸립니다. 무반동포와 스피어는 1발, 이럽터와 오토캐넌 대공 모드는 3~4발이면 됩니다.'], tacticsRef: { page: 'Spore Spewer', revision: 136869 }, tips: ['포자 안개로 주변 시야를 가립니다. 멀리서 무반동포 한 발이나 오토캐넌 대공 모드로 부수는 것이 편하고, 이럽터나 익스플로딩 크로스보우로도 충분합니다.'] }),
  building('shrieker-nest', '슈리커 둥지', '테르미니드', [route('tower', '둥지 기둥 한 개', 60)], '기둥 한 개 기준입니다. 낮은 철거력의 무기도 체력에 피해를 주면 파괴할 수 있습니다.', { health: health(2500, 2), healthSource: structureDamageSource, tactics: ['슈리커는 둥지 150m 안에서 헬다이버가 발견되었을 때만 나옵니다. 그 밖에서 스피어, 무반동포, 오토캐넌 대공 모드로 부수는 것이 안전합니다.', '지옥폭탄을 부를 때는 위를 확인하세요. 버섯 모양 꼭대기에 포드가 걸릴 수 있습니다.'], tacticsRef: { page: 'Shrieker Nest', revision: 135292 }, tips: ['이글 500kg 폭탄의 폭발 피해(1,500)만으로는 기둥(체력 2,500)이 부서지지 않습니다. 이럽터, 익스플로딩 크로스보우, 무반동포, 오토캐넌으로 체력을 깎으세요.'] }),
  building('infested-tower', '인스페티드 타워', '테르미니드', [route('tower', '타워 본체', 50)], '메가시티의 감염된 고층 건물입니다. 임무에서 주는 지옥폭탄을 가까이에서 터뜨리거나 철거력 50 공격으로 철거하세요. 장갑이 약해 지속 사격으로 체력을 깎아도 부서집니다.', { health: health(15000, 2), healthSource: wiki('Cleanse_Infested_District'), page: 'Cleanse Infested District', revision: 137839, tactics: ['지옥폭탄을 부를 때는 위를 확인하세요. 돌출부에 포드가 걸릴 수 있습니다.'], tacticsRef: { page: 'Cleanse Infested District', revision: 137839 } }),
  building('spore-lung', '스포어 렁', '테르미니드', [route('lung', '스포어 렁 본체', 50)], '하이브 지하 깊은 곳의 임무 목표입니다. 임무에서 주는 휴대용 지옥폭탄을 옆에서 터뜨리거나, 체력을 깎아 부수세요.', { health: health(5000, 2), source: wiki('Destroy_Spore_Lung'), healthSource: wiki('Destroy_Spore_Lung'), page: 'Destroy Spore Lung', revision: 141656 }),
  building('fabricator', '오토마톤 제조소', '오토마톤', [route('outer', '외벽·지붕', 40), route('vent', '환풍구 안쪽', 20, true, { opening: true })], '환풍구 안에 폭발을 넣거나, 충분한 철거력으로 외벽을 맞히세요. 대전차 무기는 체력을 소진시킬 수도 있습니다.', { health: health(1500, 5), source: wiki('Bot_Fabricator'), healthSource: wiki('Bot_Fabricator'), tactics: ['외벽을 노릴 때는 지붕 쪽을 맞히세요. 주변 잔해와 낮은 벽이 폭발을 자주 막습니다.', '얼티메이텀 직격, 다이너마이트, 헬포드는 맞는 즉시 제조소를 부숩니다.', '퀘이사 캐넌은 1발, 노바는 3발로 보이는 곳 어디서나 부술 수 있어 이동하면서 보급 부담 없이 정리하기 좋습니다.', '스피어나 이글 기총소사처럼 관통 5 공격을 여러 번 맞혀 체력을 깎아도 부서집니다.', '부서질 때 크게 폭발해 가까이 있는 헬다이버와 적이 날아가거나 죽습니다.'], tacticsRef: { page: 'Automaton Fabricator', revision: 141667 }, tips: ['이글 기총소사로 체력을 깎는 것이 가장 편합니다. 던진 방향으로 길게 쏘므로 가까이 가지 않아도 되지만, 방향을 잘못 던지면 빗나갑니다. 게임에는 중장갑 관통으로 표시되지만 장갑 5인 제조소의 체력도 깎습니다.', '이글 110mm 로켓 포드는 알아서 제조소를 노립니다.', '대전차 드론 하나로도 부서집니다.'] }),
  building('bulk-fabricator', '대형 제조소', '오토마톤', [route('outer', '외벽', 50), route('vent', '상단 환풍구 안쪽', 20, true, { opening: true })], '일반 제조소보다 높은 외벽 철거력이 필요합니다. 위쪽의 두 환풍구는 폭발을 안으로 넣는 경로입니다.', { health: health(4000, 5), healthSource: structureDamageSource, tactics: ['이럽터는 환풍구에 1발이면 부숩니다.', '체력으로 부술 때는 스피어 1발, 무반동포·일회성 대전차·퀘이사 캐넌 2발, 노바 7발이 필요합니다.', '표면이 넓어 이글 기총소사의 탄이 대부분 맞으면 쉽게 부서집니다.', '캐넌 포탑, 어나이얼레이터 탱크, 팩토리 스트라이더의 포격을 유도해 부술 수도 있습니다.'], tacticsRef: { page: 'Bulk Fabricator', revision: 141010 }, tips: ['환풍구가 잘 보여 멀리서 오토캐넌, 이럽터, 미사일 권총(비유도 모드)으로 저격하기 쉽습니다.', '대전차 드론 하나로는 한 번에 부서지지 않습니다.'] }),
  building('detector', '탐지 탑', '오토마톤', [route('tower', '탐지 탑 본체', 50)], '탑 본체가 폭발 중심부에 들어오도록 하세요. 철거력 50 공격이 있으면 지옥폭탄 없이도 철거할 수 있습니다.', { source: wiki('Detector_Tower'), tactics: ['붉은 시야(150m)에 걸리면 경보가 울리고, 헬다이버가 보이지 않을 때까지 드롭십을 계속 부릅니다. 드롭십은 마지막으로 발견된 위치에 적을 내립니다.', '시야가 위에서 비스듬히 내려오므로 탑 바로 옆에 붙으면 발견되지 않습니다.', '지옥폭탄은 폭발 범위가 넓어 발견될 위험이 적은 먼 곳에 불러도 철거할 수 있습니다.', '요새 안의 탐지 탑은 지옥폭탄을 부를 수 없고, 요새를 정리하는 데 꼭 부수지 않아도 됩니다.', '캐넌 포탑의 포격을 유도해 부술 수도 있습니다.'], tacticsRef: { page: 'Detector Tower', revision: 142051 }, tips: ['소리에 아주 예민합니다. 평소에는 시야를 천천히 돌리지만 스트라타젬을 부르는 소리나 교전 소리가 나면 그쪽으로 빠르게 돌아봅니다. 빛이 지나간 뒤 등 뒤로 다가가세요.', '증원 표시가 떠도 드롭십이 나타나기 전에 탑을 부수면 증원이 취소됩니다. 증원 대기 시간이 따로 있어 보이는 동안 계속 부르므로, 교란기나 건십 시설이 함께 있으면 특히 위험합니다.', '임무용 지옥폭탄은 탑에 핑을 찍고 35m 안에서 부르면 탑 아래에 두어도 부서집니다.', '궤도 레이저는 탑보다 적을 먼저 노려 드롭십이 오면 자주 실패합니다. 궤도 가스 타격, 궤도 연막 타격과 SEAF 야포의 정전기장·네이팜·연막 포탄은 탑에 직접 맞아야 합니다. 메가시티에서는 궤도 정밀 타격을 추천하지 않습니다.'] }),
  building('jammer', '스트라타젬 교란기', '오토마톤', [route('tower', '교란기 본체', 50)], '궤도·이글 등 호출 공격은 교란기를 비활성화한 조건으로 계산합니다. 이미 들고 온 장비의 공격은 구분합니다.', { source: wiki('Stratagem_Jammer'), condition: 'jammer', tactics: ['150m 안에서는 SEAF 야포를 뺀 모든 스트라타젬을 부를 수 없습니다. 이 안에 던진 스트라타젬은 발동하지 않고 재사용 대기에도 들어가지 않습니다.', '기본 절차는 아래쪽 단말기로 교란기를 끈 뒤 지옥폭탄이나 철거력 50 스트라타젬으로 부수는 것입니다.', '휴대용 지옥폭탄과 SEAF 야포의 소형 핵탄두·고성능 폭탄은 교란기를 끄지 않아도 부술 수 있습니다.', '교란기 두 개가 서로 150m 안에 있으면 두 단말기를 모두 끄거나, 휴대용 지옥폭탄으로 하나를 먼저 부수세요.', '캐넌 포탑, 어나이얼레이터 탱크, 팩토리 스트라이더, 복스 엔진의 포격을 교란기 쪽으로 유도해 부술 수 있습니다.'], tacticsRef: { page: 'Stratagem Jammer', revision: 142148 }, tips: ['교란기가 보이면 150m 안으로 바로 들어가지 마세요. 그 밖에서 제조소부터 부수고, 150m 안에 한 번도 들어가지 않았다면 들어가도 지키는 적이 없습니다.', '지도에서 교란기에 커서를 대거나 핑을 찍으면 거리가 나옵니다.', 'SEAF 야포는 교란기에 막히지 않아 바로 옆에 불러도 됩니다. 맵의 야포에 포탄 5발을 넣으면 생기니, 있으면 아껴 두었다가 교란기에 쓰세요.', '휴대용 지옥폭탄은 150m 밖에서 불러 메고 들어가 교란기 밑에 내려놓기만 해도 됩니다. 켜면 10초 뒤 반드시 터지니 내려놓고 피하세요.', 'M-104 소각형 고속 정찰 차량을 밖에서 불러 몰고 와 교란기 옆에서 터뜨려도 부서집니다. 화염방사기 연료가 남아 있어야 철거력 50으로 터집니다.'] }),
  building('gunship-facility', '건십 시설', '오토마톤', [route('building', '제조소 본체', 60)], '지옥폭탄의 최대 철거력이 적용되는 중심 17 m 안에 시설을 넣어야 합니다.', { source: wiki('Gunship_Facility'), tactics: ['150m 안에 헬다이버가 있는 동안 탑마다 60초에 최대 2대씩, 탑당 최대 4대까지 건십을 만듭니다.', '이글과 궤도 스트라타젬으로는 피해를 줄 수 없습니다. 지옥폭탄, 휴대용 지옥폭탄, SEAF 야포의 소형 핵탄두만 통합니다.', '시설 두 개가 모두 17m 안에 들어오게 자리를 잡으면 지옥폭탄 하나로 둘 다 부술 수 있습니다.'], tacticsRef: { page: 'Gunship Facility', revision: 142050 }, tips: ['두 개짜리 기지는 두 시설 사이의 갈색 폐기물 더미 위나 위쪽 환풍구 근처에서 지옥폭탄을 부르면 둘 다 부술 수 있습니다. 환풍구 쪽은 신호기가 튕겨 나갈 때가 있습니다.'] }),
  building('orbital-cannon', '궤도 캐넌', '오토마톤', [route('cannon', '목표 궤도 캐넌', 60)], '철거력 60 공격의 중심부가 목표 시설에 닿아야 합니다.'),
  building('fuel-reserve', '연료 저장고', '오토마톤', [route('storage', '목표 저장 시설', 60)], '임무에서 지정한 저장 시설 기준입니다. 주변의 작은 폭발 드럼통과는 다릅니다.'),
  building('bio-processor', '바이오 프로세서', '오토마톤', [route('processor', '프로세서 본체', 40)], '장갑이 거의 없어 대부분의 무기로 체력을 깎을 수 있습니다. 철거력 40 공격(이글 공중타격, C4 팩 등)이면 한 번에 무너집니다. 가까이 가면 지옥폭탄도 호출할 수 있습니다.', { health: health(5000, 1, 0), healthSource: wiki('Enemy_Bio-Processors'), page: 'Enemy Bio-Processors', revision: 142048 }),
  building('megafactory-gate', '메가팩토리 게이트', '오토마톤', [route('gate', '게이트', 40)], '메가팩토리 외벽의 닫힌 출입문입니다. 철거력 40 공격으로 철거하세요. 내구도가 800%라 내구 피해 비율이 87.5% 이하인 공격은 체력에 피해를 주지 못합니다. 오토마톤이 다가오면 열리기도 합니다.', { health: health(6000, 4, 800), healthSource: wiki('Automaton_Megafactory#Gates'), page: 'Automaton Megafactory', revision: 136681 }),
  building('terrorist-memorial', '테러리스트 기념물', '오토마톤', [route('statue', '테러리스트 기념물 한 개', 30)], '메가팩토리 안의 오토마톤·사이보그 기념 조각상입니다. 하나씩 철거력 30 공격으로 부수세요. 폭발형 지원 무기와 대부분의 수류탄으로 충분합니다.', { source: wiki('Erase_Terrorist_Memorials'), page: 'Erase Terrorist Memorials', revision: 134868 }),
  // The wiki gives no threshold for the tower; 10 is the user's own value
  // (2026-11-09), marked thresholdSource 'user' and checked in test-structures.mjs.
  building('transmission-network', '전송 네트워크', '오토마톤', [route('tower', '전송탑', 10, true, { thresholdSource: 'user' })], '송신기 판은 소총 사격으로도 하나씩 부술 수 있습니다. 탑 전체는 폭발형 철거력 공격(예: 퀘이사 캐넌)으로 무너뜨릴 수 있고, 이때 송신기도 함께 부서집니다.', { source: wiki('Destroy_Transmission_Network'), page: 'Destroy Transmission Network', revision: 142145, note: '위키에 탑의 필요 철거력이 없어, 철거력 10은 위키 수치가 아니라 이 사이트가 정한 값입니다. 송신기 판의 체력은 위키에 없어 계산하지 않습니다.' }),
  building('cooling-tower', '냉각 탑', '오토마톤', [route('tower', '냉각 탑 본체', 50)], '사이보그 생산 시설 임무의 하위 목표입니다. 지옥폭탄 외에도 철거력 50 공격(휴대용 지옥폭탄, 이글 500kg 폭탄, 궤도 포격 등)으로 부술 수 있습니다. 위키는 궤도 가스·EMS·연막 타격은 탄체를 직접 맞혀야 한다고 적고 있습니다.', { source: wiki('Halt_Cyborg_Production'), page: 'Halt Cyborg Production', revision: 130623 }),
  building('warp-ship', '착륙한 워프 함선', '일루미닛', [route('hull', '함선 외벽', 50, false, { nonExplosiveUncertain: true }), route('door', '열린 출입구 안쪽', 20, true, { opening: true })], '보호막을 제거하고 열린 출입구 안에 폭발을 넣는 것이 기본 경로입니다. 본체 폭발 피해는 2.5배입니다.', { health: health(5000, 5, 100, -150), source: wiki('Grounded_Warp_Ship'), healthSource: wiki('Grounded_Warp_Ship'), condition: 'shield', note: '외벽의 비폭발 공격 허용 여부는 위키 표끼리 다릅니다. 직접 파괴 사례가 확인된 궤도 지원 외에는 해당 경로를 확정하지 않습니다.', tactics: ['방어막은 총으로 쏘아 깨뜨릴 수 있고, 깨진 뒤 15초가 지나면 다시 생깁니다. 폭발물이 안에 있는 동안 방어막이 돌아오면 철거가 막힙니다.', '방어막은 가득 차 있으면 파란색이고, 깎일수록 떨리면서 보라색으로 바뀝니다.', '방어막이 있어도 궤도 가스 타격, 궤도 레이저, 궤도 정밀 타격, 궤도 레일캐넌 타격, 이글 500kg 폭탄은 부술 수 있습니다. 출입구 앞 경사로에 던지면 확실합니다.', '테르밋 하나, C4 팩 한 개, 얼티메이텀 한 발은 방어막이 있어도 어디에 맞든 부숩니다.'], tacticsRef: { page: 'Grounded Warp Ship', revision: 142053 }, tips: ['방어막 위에 붙은 테르밋은 방어막이 깨지면 떨어질 수 있습니다. 브리처도 테르밋을 쏘는 무기라 마찬가지입니다.', '지지대(다리)는 멜타건 2발이면 됩니다. 멜타마인은 다리 옆에 놓고 쏴서 터뜨리세요.'] }),
  building('warp-gate', '워프 게이트웨이', '일루미닛', [route('outer', '게이트 외부', 40), route('gateway', '열린 중앙 구멍 안쪽', 20, true, { opening: true })], '중앙 구멍이 열려 일루미닛이 나올 때 수류탄 등 폭발을 안에 넣으면 철거력 20으로 부서집니다. 바깥에서는 철거력 40 공격이나, 장갑 5를 뚫는 공격으로 체력 1,500을 깎아 부술 수 있습니다. 부서진 뒤 몇 초 후 크게 폭발해 헬다이버가 넘어지니 바로 피하세요.', { health: health(1500, 5, 100, 0), source: wiki('Warp_Gateway'), healthSource: wiki('Warp_Gateway'), page: 'Warp Gateway', revision: 135409, tips: ['테르밋과 브리처는 붙이기만 하면 되어 구멍이 열릴 때까지 기다리지 않아도 됩니다. 이글 기총소사로 체력을 깎아도 되고, 멜타마인은 던진 뒤 쏴서 터뜨리세요.'] }),
  building('lightning-spire', '번개 첨탑', '일루미닛', [route('spire', '첨탑 본체', 20)], '전격을 방출하는 첨탑 본체를 공격하세요. 체력에 피해를 주는 경로도 있습니다.', { health: health(200, 2, 80), healthSource: structureDamageSource }),
  building('gazer', '게이저', '일루미닛', [route('gazer', '게이저 본체', 20)], '철거력 20 이상 공격(대물소총, 레이저 캐넌 등)이면 한 번에 부서집니다. 눈은 장갑 1이라 어떤 무기로도 피해를 줄 수 있지만, 눈 주변은 장갑 5입니다.', { health: health(700, 1, 0), healthSource: wiki('Gazer'), page: 'Gazer', revision: 141677, note: '체력 계산은 눈(체력 700, 장갑 1) 기준입니다. 눈을 정면에서 맞히는 조건입니다.' }),
  building('disruptor-psu', '인지 분열기 전원 장치', '일루미닛', [route('power', '전원 장치 한 개', 30)], '주변 전원 장치 한 개 기준입니다. 시설 전체의 임무 완료 조건과 구분하세요.', { health: health(180, 0), healthSource: structureDamageSource, tactics: ['인지 분열기 200m 안에서는 모든 스트라타젬의 이름이 가려지고 호출 코드가 다른 코드로 바뀝니다. 바뀐 코드는 화살표 하나하나가 무작위로 섞이는 것이 아니라 다른 스트라타젬의 코드 등 정해진 목록에서 나옵니다.', '인지 분열기 본체는 지원 무기나 스트라타젬으로 부술 수 없습니다. 궤도 네이팜 폭격, 궤도 120mm·380mm 고폭 폭격 같은 궤도 포격을 던지면 전원 장치를 쉽게 부술 수 있습니다.'], tacticsRef: { page: 'Cognitive Disruptor', revision: 129789 }, tips: ['인지 분열기 본체가 아니라 근처의 전원 장치 4개를 찾아 부수면 꺼집니다. 장갑이 없어 주무기로 쏘면 충분합니다.'] }),
  building('monolith', '모노리스', '일루미닛', [route('monolith', '모노리스 본체', 60)], '지옥폭탄이나 SEAF 소형 핵탄두의 중심부로 철거하세요.', { source: wiki('Monolith') }),
  building('gazer-spire', '게이저 스파이어', '일루미닛', [route('spire', '스파이어 본체', 60)], '철거력 60이 필요해 휴대용 지옥폭탄, 지옥폭탄, SEAF 소형 핵탄두로만 파괴할 수 있습니다. 솔로 사일로는 철거력이 모자랍니다. 주변의 워프 게이트웨이는 따로 부숴야 적이 그만 나옵니다.', { page: 'Gazer Spire', revision: 138883 }),
];

const damage = (standard, durable, ap, explosion = 0, explosionAp = 0) => ({ standard, durable, ap, explosion, explosionAp });
const combatDamage = (id, modeId) => weaponProfiles[id]?.modes.find(mode => mode.id === modeId && !mode.unsupported);
// A combat mode made of several explosions (the Solo Silo's impact and main blast) as one structure hit with its
// largest explosion; the blasts' demolition force still never adds up.
const largestBlast = (id, modeId) => {
  const found = combatDamage(id, modeId);
  const blast = (found?.explosions ?? []).reduce((best, item) => !best || item.standard > best.standard ? item : best, null);
  return blast ? { ...found, explosion: blast.standard, explosionAp: blast.ap, explosionDurable: blast.durable ?? blast.standard } : found;
};
const mode = (id, name, direct, explosion, extra = {}) => ({ id, name, direct, explosion, ...extra });
const profile = (modes, extra = {}) => ({ source: demolitionSource, modes, ...extra });
const shot = (direct, explosion, extra = {}) => [mode('standard', '기본 공격', direct, explosion, extra)];
const callIn = (modes, extra = {}) => profile(modes, { requiresCallIn: true, ...extra });
const indirect = '공격이 시설에 실제로 닿는 조건입니다. 자동 조준·유도·살포 위치로 인해 원하는 부위를 직접 선택하지 못할 수 있습니다.';
const automatic = '자동 포탑은 시설을 표적으로 직접 지정할 수 없습니다. 아래 결과는 탄이나 폭발이 시설에 실제로 닿는 경우입니다.';


// Profiles read from the attack datamine (stratagem-stats.js `forces`): one mode with the strongest hit (direct, beam,
// arc or spray) and the strongest blast, plus a vehicle's death explosion as its own mode. Options: label (what the
// hit is called), damage (combat-data.js mode id for the health path), callIn (Eagles and orbitals need a call-in),
// automatic (sentries and drones pick their own targets), many (several weapons: the strongest of them), noDirect (an
// airburst shell never hits directly), note.
const HIT_KINDS = ['direct', 'beam', 'arc', 'spray'];
const strongestDemo = (parts, kinds) => parts.filter(part => kinds.includes(part.kind) && part.demo != null).reduce((best, part) => Math.max(best ?? 0, part.demo), null);
// Ids given a profile this way, so checks can tell them from the wiki summary's stratagems.
export const datamineProfileIds = [];
function datamineProfiles(options) {
  datamineProfileIds.push(...Object.keys(options));
  return Object.fromEntries(Object.entries(options).map(([id, opt]) => {
    const parts = (stratagemStats[id]?.forces ?? []).flatMap(group => group.parts);
    const direct = opt.noDirect ? null : strongestDemo(parts, HIT_KINDS);
    const blast = strongestDemo(parts, ['blast']);
    const wreck = parts.find(part => part.kind === 'wreck');
    const notes = [opt.note, opt.many && '여러 무기 중 철거력이 가장 큰 공격 기준입니다.'].filter(Boolean).join(' ');
    const modes = [mode('standard', '기본 공격', direct || null, blast || null, {
      ...(opt.label && { directLabel: opt.label }), ...(opt.damage && { damage: combatDamage(id, opt.damage) }), ...(notes && { note: notes }) })];
    if (wreck) modes.push(mode('wreck', '연료 탱크 폭발', null, wreck.demo, { selfDestruct: true, damage: damage(0, 0, 0, wreck.damage, wreck.ap),
      note: '차량이 파괴될 때의 폭발입니다(이글 500kg 폭탄과 같은 크기). 화염방사기 연료가 다 떨어진 뒤에는 일반 차량 폭발로 바뀌고, 타고 있던 헬다이버는 죽습니다.' }));
    const extra = { source: wiki('Module:Decodedata-Attacks/stratagems_data.json'), ...(opt.automatic && { conditionalAim: true, note: automatic }) };
    return [id, opt.callIn ? callIn(modes, extra) : profile(modes, extra)];
  }));
}

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
  'arc-thrower': profile(shot(20, null, { directLabel: '전격', damage: combatDamage('arc-thrower', 'first-target') }), { conditionalAim: true, note: indirect }),
  'meltagun': profile(shot(30, null, { directLabel: '광선', damage: combatDamage('meltagun', 'near') })),
  'grenade-launcher': profile(shot(null, 30, { damage: combatDamage('grenade-launcher', 'standard') })),
  'belt-fed-gl': profile(shot(null, 30, { damage: combatDamage('belt-fed-gl', 'standard') })),
  'c4-pack': profile(shot(null, 40, { name: '장약 폭발', unit: '개', damage: damage(0, 0, 0, 2000, 7), shieldBypass: true, note: '본체가 폭발 중심 3 m 안에 있는 조건입니다. 워프 함선은 보호막이 있어도 장약 한 개로 체력을 소진할 수 있습니다.' }), { source: wiki('B/MD_C4_Pack') }),
  'breaching-hammer': profile([
    mode('melee', '일반 타격', 30, null, { directLabel: '타격', damage: combatDamage('breaching-hammer', 'melee') }),
    mode('charge', '폭발 장약 사용', 30, 30, { directLabel: '타격', damage: combatDamage('breaching-hammer', 'explosive') }),
  // Known in play not to close bug holes, even from inside (user decision 2026-11-20).
  ], { notOn: ['bug-hole'] }),
  // The Leveller and the Solo Silo destroy a Grounded Warp Ship in one hit whatever its shield (user's play experience
  // 2026-11-23; the wiki is silent).
  'leveller': profile(shot(40, 40, { damage: combatDamage('leveller', 'standard'), shieldBypass: true })),
  'wasp': profile(shot(30, 30), { conditionalAim: true, note: indirect }),
  'solo-silo': profile(shot(null, 40, { name: '미사일 폭발', note: '여러 폭발의 철거력 40을 합산하지 않습니다.', damage: largestBlast('solo-silo', 'standard'), shieldBypass: true })),
  // Wiki Demolition summary (revision 138005), Other Stratagems: TD-110 Maelstrom,
  // Missile Explosion, force 40, explosive. The table has no row for its Gatling guns.
  'maelstrom': profile(shot(null, 40, { name: '미사일 폭발' })),
  'speargun': profile(shot(30, 30, { damage: combatDamage('speargun', 'direct') })),
  'de-escalator': profile(shot(20, null, { directLabel: '전격' }), { conditionalAim: true, note: indirect }),
  'epoch': profile([
    mode('standard', '일반 발사', 10, 10, { damage: damage(400, 200, 4, 500, 4), note: '피해: 직격 400 / 내구 200 / 폭발 500. 직격·폭발 관통 4.' }),
    mode('charged', '완전 충전 발사', 10, 30, { damage: damage(800, 400, 5, 800, 5), note: '피해: 직격 800 / 내구 400 / 폭발 800. 직격·폭발 관통 5. 벌레굴 내부와 제조소 환풍구는 폭발이 안쪽에 들어가야 철거력으로 파괴됩니다.' }),
  ], { source: wiki('PLAS-45_Epoch'), damageSource: wiki('PLAS-45_Epoch#Detailed_Weapon_Statistics'), note: '과충전 자폭은 발사 모드와 피해 계산에서 제외합니다.' }),
  'orbital-precision': callIn(shot(50, 50, { name: '포탄', damage: damage(4000, 4000, 8, 1500, 6), shieldBypass: true }), { source: wiki('Orbital_Precision_Strike') }),
  'orbital-120': callIn(shot(50, 50, { name: '포탄', damage: damage(3500, 3500, 7, 1200, 5), shieldBypass: true, note: '한 번의 호출 전체가 아닌, 시설에 명중한 포탄 한 발 기준입니다.' })),
  'orbital-380': callIn(shot(50, 50, { name: '포탄', damage: damage(4000, 4000, 8, 1500, 6), shieldBypass: true, note: '폭격 범위 안에 있어도 포탄이 빗나가면 파괴되지 않습니다.' })),
  'orbital-walking': callIn(shot(50, 50, { name: '포탄', damage: damage(4000, 4000, 8, 1500, 6), shieldBypass: true })),
  'orbital-gatling': callIn(shot(30, 30, { name: '포탄' })),
  'orbital-napalm': callIn(shot(30, 30, { name: '포탄', note: '남는 불길의 지속 피해는 이 철거력 판정에 합산하지 않습니다.' })),
  'orbital-laser': callIn(shot(50, null, { name: '시설에 닿은 광선', directLabel: '광선', shieldBypass: true }), { conditionalAim: true, note: '레이저가 시설을 실제로 훑는 조건입니다. 원하는 시설을 직접 조준할 수 없고 지속 피해의 탄수는 계산하지 않습니다.' }),
  'orbital-railcannon': callIn(shot(50, 50, { shieldBypass: true }), { conditionalAim: true, note: '레일캐넌은 자동으로 표적을 고릅니다. 수치 충족이 해당 시설을 자동 조준한다는 뜻은 아닙니다.' }),
  'orbital-gas': callIn(shot(50, 50, { name: '탄체·초기 효과', shieldBypass: true, note: '탄체 또는 초기 효과 중심부 기준입니다. 가스 지속 피해의 철거력은 0이며, 구름 전체가 철거력 50인 것은 아닙니다.' }), { source: wiki('Orbital_gas') }),
  'orbital-ems': callIn(shot(50, 30, { name: '탄체·초기 효과', note: '탄체 직격과 초기 효과를 구분합니다. 전기장에 오래 머문다고 철거력이 누적되지는 않습니다.' })),
  'orbital-smoke': callIn(shot(50, null, { name: '연막탄 탄체 직격', note: '연막이 아니라 떨어지는 탄체를 직접 맞혀야 합니다.' })),
  'eagle-airstrike': callIn(shot(40, 40, { name: '폭탄' })),
  'eagle-strafing': callIn(shot(30, 30, { name: '기총탄' })),
  'eagle-cluster': callIn(shot(40, 30, { name: '탄체·집속 폭발' }), { conditionalAim: true, note: '탄체의 직접 충돌과 공중에서 퍼지는 폭발을 구분해야 합니다. 표기 직격 수치만으로 일반적인 건물 철거를 보장하지 않습니다.' }),
  'eagle-napalm': callIn(shot(40, 30, { name: '폭탄', note: '화염의 지속 피해는 합산하지 않습니다.' })),
  'eagle-rockets': callIn(shot(40, 30, { name: '로켓' }), { conditionalAim: true, note: indirect }),
  'eagle-smoke': callIn(shot(40, null, { name: '연막탄 탄체 직격', note: '연막에는 철거력이 없습니다. 탄체를 시설에 직접 맞히는 조건입니다.' })),
  'eagle-500kg': callIn(shot({ min: 40, max: 50 }, 50, { name: '폭탄 · 주 폭발', shieldBypass: true, damage: damage(2000, 2000, 7, 1500, 6), note: '직격은 종합표 40, 개별 통계 50으로 엇갈립니다. 주 폭발 50은 일치합니다. 체력 계산은 추가 착탄 폭발 100을 제외한 보수적인 값입니다.' }), { source: wiki('Eagle_500Kg_Bomb'), conflictingSource: demolitionSource }),
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
  // The Hellbombs destroy a Grounded Warp Ship whatever its shield (user's play experience 2026-11-23; the wiki is silent).
  'portable-hellbomb': profile(shot(null, 60, { name: '지옥폭탄 폭발', shieldBypass: true, note: '시설이 중심 17 m 안에 들어오는 조건입니다. 이미 휴대한 폭탄의 기폭은 스트라타젬 호출과 다릅니다.' }), { source: wiki('Portable_Hellbomb') }),
  'hellbomb': callIn(shot(null, 60, { name: '지옥폭탄 폭발', shieldBypass: true, note: '시설이 중심 17 m 안에 들어오는 조건입니다. 호출이 허용되는 임무 구역에서 장전해야 합니다.' }), { source: wiki('Portable_Hellbomb') }),
  'seaf-artillery': callIn([
    mode('he', '고폭탄', 50, 50, { shieldBypass: true }),
    mode('high-yield', '고위력탄', 50, 50, { shieldBypass: true }),
    mode('mini-nuke', '소형 핵탄두', 50, 60, { shieldBypass: true }),
    mode('napalm', '네이팜탄', 50, 30, { warpHullDirect: true }),
    mode('ems', '정전기장탄', 50, 30, { warpHullDirect: true }),
    mode('smoke', '연막탄 · 탄체 직격', 50, null, { warpHullDirect: true }),
  ], { note: '실제로 장전되어 다음에 발사될 탄종을 고르세요. 여기서 고른다고 게임의 발사 순서가 바뀌지는 않습니다.' }),
  // Not in the wiki Demolition summary: the force is the attack datamine's demo value (stratagem-stats.js `forces`,
  // the strongest hit and the strongest blast; fragments left out), 2026-11-23.
  ...datamineProfiles({
    flamethrower: { label: '분사' }, sterilizer: { label: '분사' }, cremator: { label: '분사' }, 'defoliation-tool': {}, 'one-true-flag': { damage: 'melee' },
    'airburst-launcher': { damage: 'flak', note: '집속 모드의 로켓은 공중에서 갈라져 직격하지 않습니다.' }, 'expendable-napalm': { damage: 'standard' },
    'orbital-airburst': { callIn: true, noDirect: true, note: '공중에서 터지는 포탄이라 직격은 사실상 일어나지 않습니다. 폭발이 시설에 닿아야 합니다.' },
    'eagle-gas': { callIn: true },
    'machine-gun-sentry': { automatic: true }, 'gatling-sentry': { automatic: true }, 'gas-mortar': { automatic: true }, 'flame-sentry': { automatic: true, label: '분사' }, 'laser-sentry': { automatic: true, label: '광선' },
    'guard-dog': { automatic: true }, rover: { automatic: true, label: '광선' }, k9: { automatic: true }, 'hot-dog': { automatic: true }, 'dog-breath': { automatic: true, label: '분사' },
    patriot: { many: true }, emancipator: { many: true }, lumberer: { many: true }, breakthrough: { many: true }, 'gunner-frv': { many: true }, 'supply-frv': { many: true }, bastion: { many: true },
    'incinerator-frv': { many: true, label: '분사' },
  }),
};

// Health path for stratagems: damage per shot from the wiki attack datamine (dist/data/stratagem-attacks.js,
// scripts/build-stratagem-attacks.mjs) on the modes that only had demolition force.
for (const [id, modes] of Object.entries(stratagemAttackDamage)) {
  for (const [modeId, damage] of Object.entries(modes)) {
    const target = demolitionProfiles[id]?.modes.find(item => item.id === modeId);
    if (target && !target.damage) target.damage = damage;
  }
}

for (const id of ['orbital-120', 'orbital-380', 'orbital-walking']) demolitionProfiles[id].damageSource = wiki('Damage_Comparison');

// Keep reviewed HP attacks useful even where their demolition value is not yet
// confirmed. Unknown force must never be treated as zero or "cannot destroy".
for (const [id, entry] of Object.entries(weaponProfiles)) {
  if (demolitionProfiles[id] || entry.combatOnly) continue;
  demolitionProfiles[id] = profile(entry.modes.filter(item => !item.unsupported).map(item => mode(item.id, item.name, null, null, { damage: item, forceUnknown: true })), { source: entry.source, note: '이 무기의 탄환 철거력은 확인 중입니다. 확인된 피해 수치로 체력 파괴 경로만 계산합니다. 과충전 자폭·장비 파괴 폭발은 제외합니다.' });
}

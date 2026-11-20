# 인수인계 (현재 상황판)

> 작업을 마친 AI가 **덮어써서** 최신으로 유지합니다. 쌓아 두는 일지가 아닙니다. 규칙은 [AGENTS.md](AGENTS.md)를 보세요.

- 마지막 갱신: 2026-11-20, Claude Code 담당
- 기준: master `51eb532`(2026-11-19 배포됨). 그 뒤 `work/wiki-features`에 로컬 커밋이 쌓여 있음(아직 배포 안 함, 아래 '로컬 작업').
- 진행 중인 작업: 없음.

## 지금 상태

- **로컬 작업(2026-11-20, 배포 전)**
  - **장비 칩**: 슈퍼 스토어 무기 8종(사이·스위퍼·연막·더블 프리덤·마체테·워런트·전투 손도끼·스턴 배턴)에 '슈퍼 스토어' 칩(누르면 `#/superstore`), 나이트에 '슈퍼 시민 에디션' 칩(위키 MP-98 Knight 입수 절). `dist/ui/warbond-chip.js`.
  - **함선 모듈 탭**(장비 → 부스터 오른쪽, `#/gear?tab=modules&u=<모듈>`, 전체 검색에도 30개): 6개 부서 × 5단계 30개, 비용(일반·희귀·슈퍼 샘플, 요청 신청서)과 합계(3,830 / 2,920 / 305 / 335,000 = 위키 Total 행). 이름·효과는 게임 문장(위키 효과 문장과 #VALUE를 맞춰 자동 대응, `scripts/ship-module-parse.mjs`), 비용은 기존 원본 `wiki_stratagem_stats.json`의 Ship Modules rev 134806. 스트라타젬 도감이 쓰는 12개 모듈은 '재사용 시간에 반영' 링크. 부서 아이콘 6개는 위키 SVG(`fetch-ship-module-icons` → `wiki_ship_module_icons.json`). 일반·희귀·슈퍼 샘플과 요청 신청서 아이콘은 위키 Currency 틀의 그림(`fetch-currency-icons`에 추가, `dist/assets/icons/`). `build-game-names` → `build-ship-module-upgrades` → `test-ship-module-upgrades`. 게임 문장을 못 찾은 이름·효과(위키 문장이 바뀐 경우)는 위키 영어로 표시, 아이콘이 없는 부서는 아이콘 없이, 비용 합이 위키 Total 행과 다르면 합을 표시하고 모두 '확인할 것'으로만 알림(빌드·검사·`build-game-names` 모두 멈추지 않음, 2026-11-19 결정과 같은 방식).
  - **적 공격표 '공격 패턴'**(적 대응 화면, 등장·행동 아래, 기본 접힘이고 한 번 펼치면 다른 적으로 가도 펼친 채 유지): 각 적 위키 문서의 Weapons Loadout 상자(86종, 247개)를 새 원본 `db/source/wiki_enemy_weapons.json`(`fetch-enemy-weapons`, 기존 `wiki_enemy_pages.json`은 그대로)으로 받고, 공격 이름 151종은 사이트 번역(`db/source/enemy_weapon_korean.json`, 기존 행동 요약과 같은 용어). '쓰러질 때까지 맞는 횟수(몸통 기준)'의 경량·일반·중량(장갑 50·100·150) 칸은 **어림값**(체력 125 ÷ (피해 × 방어구 배율), 위키 Template:Armor Ratings rev 136845)이고 폭발이 없는 단일 직격(탄도·근접·베기 등)만 계산. 폭발·화염·산성·여러 줄 피해는 숫자만, 관통은 위키에 공식이 없어 계산에서 뺌(사용자에게 보고, 2026-11-20). `build-enemy-weapons` → `test-enemy-weapons`. 번역이 없는 새 공격 이름은 영어로 표시하고 빌드·검사는 멈추지 않음('확인할 것'으로만 알림, 2026-11-19 결정과 같은 방식). 좁은 화면 넘침 때문에 `.enemy-layout` 모바일 열을 `minmax(0, 1fr)`로. 600px 이하에서는 표를 화면 폭에 맞춤('장갑 N' 보조 글씨 숨김).
  - **장비 근접 공격**: 주·보조무기 상세에 '근접 공격 75(관통 2)' 또는 '총검 공격 165(관통 3)'. 위키 datamine `Module:Decodedata-Attacks/new gear.json` rev 134811(`fetch-melee` → `wiki_melee.json` → `build-melee` → `dist/data/melee.js`), 총검 무기는 문서에 Melee_Bayonet 틀이 있는 3종(어멘드먼트·컨스티튜션·스위퍼). **한손 무기**: 위키 인포박스 One Handed 특성(35종)을 '한손' 칩으로, 장비 둘러보기에 '한손 무기만' 필터(`h=1`, 분류 안 무기가 모두 한손이면 숨김: 보조무기 26종은 전부 한손이라 주무기에만 나옴, 사용자 요청 2026-11-20). 세부 종류 칩과 한손 칩 숫자는 서로의 선택에 맞춰 바뀌고 0개 칩은 흐리게(누르면 반대쪽 선택이 풀림, 스트라타젬 필터와 같은 방식). 방어구 탭의 무게 버튼 숫자도 고른 패시브에 맞춰 바뀜(사용자 요청 2026-11-20). 스트라타젬 상세에도 위키 인포박스 traits의 One Handed면 '한손' 칩(`stratagem-stats.js`의 `oneHanded`, 지금은 CQC-1 원 트루 플래그 1종. 위키 Combat 문서는 C4 배낭도 한손이라 하지만 C4 인포박스에는 없어 넣지 않음). `personal-display.mjs` TRAIT_TAGS, `build-weapons`로 재생성(traitTags만 바뀜). `test-melee`.
  - **계산 방식 5~10번 추가**: 출혈, 과관통, 거리 감쇠, 폭발 세 구간(엎드리면 바깥 반경 90% 감소), 지속 피해·화염 배율, 헬다이버가 받는 피해(배율은 `enemy-weapons.js`의 `helldiverArmor`에서 읽음). 위키 Damage rev 142577, Combat rev 142474.
  - **정찰 패시브 예시**: 방어구 탭·상세에 '트루퍼가 낮 50m·밤 40m → 정찰 35m·28m'(위키 Stealth rev 142153, 30%는 패시브 효과 문장에서 읽음). 나무위키 시야 표(40/30m)는 영문 위키와 달라 쓰지 않음.
  - **행성 > 환경 조건에 '민주주의 우주 정거장'**(SEAF 아래): 정거장(4시간마다 투표, 24시간당 기부 한도 일반 샘플 75·요청 신청서 50,000·희귀 샘플 50, 전술 행동은 한 번에 하나), 기본 효과 2개(작전 지원, 엑소슈트 비축분 -35%), 전술 행동 3개(이글 폭풍·궤도 봉쇄·대형 포탄 보급, 목표량·24시간·재사용 대기). 이름·설명은 게임 문장, 요약 줄은 위키 Democracy Space Station rev 142559와 Template:DSS Action rev 139090(숫자는 `test-planets`가 둘에서 확인). 이글 봉쇄(슈퍼 지구 전투 한정, 종료)는 뺌. **행성 폭격은 보류**: 위키 틀은 '2025년 1월 대형 포탄 보급으로 대체'라 하지만 같은 문서 변경 이력에 1.006.003 패치에서 'DSS 궤도 폭격'으로 재등장, 나무위키는 2026년 재등장과 바뀐 수치를 적음. 지금 기부형 전술 행동인지·비용·재사용 대기를 확인하지 못해 카드와 '안 쓰임' 문구 모두 넣지 않음(사용자 결정 2026-11-20: 일단 빼 둠). 다른 행성 자료는 다시 받지 않고 `wiki_planets.json`에 이 문서·틀·아이콘 4개만 추가(`fetch-planet-pages`에도 넣어 둠). `planet_korean.json`의 `special`에 `dss-*` 6개.
  - 검사: `npm run check` 21종 통과, `node scripts/check-weapons.mjs` 통과, 1440·360px 화면 확인(콘솔 오류 없음).

- **위키·게임 자료 기능 묶음(2026-11-19, 배포됨)**
  - **한국어 이름 규칙 변경**(AGENTS.md): 게임 안 자료로 확인한 최신 표기가 우선, 나무위키는 보조, 게임에도 없으면 알맞게 번역. 게임 공식 문장표(음성 대사·300자 넘는 글 제외, 10,306줄, 게임 빌드 26568081)가 `db/source/game_strings_ko.tsv`에 있고, `node scripts/build-game-names.mjs`가 사이트가 쓰는 문장만 `db/source/game_names_ko.json`에 뽑습니다. 게임 업데이트 뒤 문장표 갱신은 원본 표가 있는 PC에서 `scripts/tools/import-game-strings.mjs <tsv> --planets <행성.json>`(행성 이름·생물군계 설명은 `db/source/game_planets_ko.json`).
  - **게임 이름으로 바꾼 36개**(`db/source/game_name_targets.json`, `test-game-names.mjs`): 포격 FRV·화물 컨테이너·휴대용 통신 릴레이·증원 포드·지진 탐지기·전술용 비디오 카메라·로버·핫도그·K-9·독 브레스, 퍼니셔 플라스마·핫샷 마크맨 라이플, O-3 자유로운 영혼·O-44 조종사와의 유대감·운동 에너지 변위 완화·충격 방지 패드, 강화 버전·산소공급기, 차저 베히모스·어설트 레이더·머로더·MG 레이더·데버스테이터(로켓·거대·제트 여단)·바라저 탱크·벙커 포탑·옵트루더·버레이시터, 건십 시설·워프 게이트웨이·탐지 탑·궤도 캐넌·테러리스트 기념물·인지 분열기 전원 장치. 무기·방어구 빌드(`build-weapons`·`build-armor`)는 이 표의 게임 이름을 나무위키보다 먼저 씁니다. 스트라타젬 옛 이름은 검색 별칭으로 남김.
  - **함선 모듈**: 스트라타젬 도감에 '함선 모듈 적용/미적용'(기본 적용, `?mod=off`), 카드마다 재사용 시간. 기본값은 각 위키 문서 Stratagem Stats Table(`fetch-stratagem-stats` → `build-stratagem-stats`, `dist/data/stratagem-stats.js`), 모듈 비율은 Ship Modules rev 134806(`dist/data/ship-modules.js`, 계산 `dist/core/modules.js`). 비율은 곱하고 '사기 증강' 5%도 넣음(위키 문서 대부분은 5%를 빼고 적음). 불릿 스톰 위키값 66.5초는 확인한 차이로 `test-stratagem-stats.mjs`에 기록.
  - **부스터 탭**(장비 → 방어구 오른쪽, `#/gear?tab=boosters&b=`): 20종, 게임 이름·설명 + 위키 효과 요약(숫자는 위키 본문과 대조), 아이콘 SVG. `fetch-boosters` → `build-game-names` → `build-boosters`.
  - **행성 탭**(`#/planets?tab=conditions|modifiers|biomes|status`): 환경 조건 12종(아이콘)·글룸 4단계, 작전 제한 조건 8종(난이도 5부터 1개·8부터 2개)·이벤트 효과 4종, 생물군계 28종(행성 379개, 이름·분류는 사이트 번역), 상태 이상 7종(위키 Status Effects 요약). 스트라타젬 상세에 '행성 조건에 따른 변화'(표시값 × 비율, 기본 접힘, 함선 모듈 문구는 그 블록 맨 아래). `fetch-planet-pages` → `build-planets`(`dist/data/planets.js`, `planet-stratagem-effects.js`). 하단 탭이 7칸이 됨.
  - **임무 연결**: 철거 화면에서 시설을 부수는 주요·전술 목표와 난이도(10에 없는 임무는 흐리게), 21개 시설·28개 임무(`db/source/structure_objectives.json`, `fetch-objectives` → `build-structure-objectives`).
  - **특수 효과**(스트라타젬·장비 상세, 기본 수치표 바로 아래): 철거력, 저지력(stun), 넉백(push). 직격 중 가장 센 것과 폭발 중 가장 센 것만 한 줄씩(철거력 · 저지력 · 넉백, 철거력 → 저지력 → 넉백 순으로 비교, 파편 제외, 사용자 결정 2026-11-19). 스트라타젬은 datamine 공격 기록(`db/source/stratagems_data.json` + `weapons_data.json`, `stratagem-stats.js`의 `forces`)이고, 철거 데이터가 범위로 둔 값(500kg 직격 40~50)은 범위로 표시, 공격 기록이 없으면 철거 데이터의 철거력만. 장비는 `db/weapons.js`의 기록별 값(`personal-weapons.js`에 demolition·stun·push 추가). 공격 기록이 없는 배낭·보호막·임무 장비와 datamine에 없는 테슬라 탑·거치포·지옥폭탄은 저지력·넉백 없음.
  - **2026-11-19 추가**: 행성 환경 조건에 '엑소스톰'(일루미닛 행성만, 1~3단계)·'SEAF'(슈퍼 지구, 모든 행성) 구역, 작전 제한 조건·이벤트·글룸은 사이트에서 그린 선 아이콘(`dom.js` ICONS, 위키에 아이콘 없음). 엑소스톰(1~3단계 공통 `Destroy Exospire Mission Icon.svg`)·SEAF(`Heavy SEAF Presence Icon.svg`)는 위키 그림(`fetch-planet-pages`의 `EXTRA_ICONS`, 사용자 선택). 생물군계 썸네일 28장(`python scripts/tools/fetch-biome-images.py`, 320×180 WebP 합계 120KB, 화산 정글은 인포박스 그림이 죽음의 땅 그림으로 넘겨져 있어 문서 갤러리의 Regnus 풍경을 씀), 생물군계 카드는 한 줄 4개(작은 그림이 흐려 보이지 않게, 사용자 결정). 방어구 탭에서 카드를 누르면 상세 창(`#/gear?tab=armor&d=<id>`, 큰 그림). 레일건·에포크의 과충전 폭발은 별도 줄과 경고. 채권 보드의 치장품·부스터 247칸 모두 게임 이름 우선(`build-game-names`가 `strings.warbondItems`를 만들고 `build-warbonds`가 나무위키보다 먼저 씀, 패턴은 그림 파일 이름으로 매칭).
  - **기타**: 전체 검색에 방어구·부스터, 채권 항목 상세는 1340px 미만에서 보드 자리에 열림(겹침 해결), README·계산 방식의 자료 날짜를 '9월 16일 처음 확인, 11월 8일 다시 대조'로.
  - **적 대응 보강(2026-11-19)**: 몬스터마다 화염 저항(위키 인포박스 fire_mult를 폭발 저항처럼 퍼센트로, ×0.8 = 20%, ×1.5 = -50%)·경직치(stagger_req), 소속 '테르미니드·커스틱 변종', '등장'·'행동' 요약(위키 Spawning·Behavior 절을 쉬운 한국어·영어로, 문서 revision을 기록하지만 어긋나도 검사는 통과). 파이프라인 `node scripts/fetch-enemy-pages.mjs`(`db/source/wiki_enemy_pages.json`) → 요약 `db/source/enemy_behavior_korean.json`(손으로 씀) → `node scripts/build-enemy-pages.mjs`(`dist/data/enemy-pages.js`) → `test-enemy-pages.mjs`(숫자가 한·영 양쪽에 같은지, revision이 같은지). 위키 값이 없는 화염 저항 15종·경직치 19종은 '미확인'. 적 무기 이름은 게임 문장표에 없고 나무위키는 바로 읽을 수 없어 사이트가 번역(Fusion = 융합, Plasma = 플라스마, 무기마다 한 이름). 용어는 사이트 표기(벌레굴·무권자·제조소·제트팩).
  - **팩션·행성 화면(2026-11-19)**: 팩션 추천 하위 팩션 12개에 위키 아이콘(`node scripts/fetch-subfaction-icons.mjs`, `dist/assets/subfactions/`), 진영 아이콘과 같은 색(테르미니드 #ffb901·오토마톤 #ff6161·일루미닛 #cd8aea). 상태 이상 7종에 사이트에서 그린 아이콘. 생물군계의 행성 이름은 위키 문서가 있는 278개만 링크(`wiki_planets.json`의 `planetPages` = Category:Planets, 대소문자·악센트 무시로 매칭). 생물군계 분류 이름에서 '형'을 뺌(사막·원시·극지 등).
  - **스토어 개편(2026-11-19)**: 상단 탭 '전쟁 채권'이 '스토어'가 되고 하위 페이지 '전쟁 채권'(`#/warbonds`, 메인 화면 그대로)·'슈퍼 스토어'(`#/superstore`, `route.js`의 `TAB_OF`로 스토어 탭에 묶임). 슈퍼 스토어는 위키 Superstore 문서의 27쪽 3×2 보드(118개, 20,755 SC = 위키 총액). 파이프라인 `node scripts/fetch-superstore.mjs`(`db/source/wiki_superstore.json`) → `node scripts/build-game-names.mjs`(망토·카드·감정 표현 게임 이름 `superstoreItems`) → `node scripts/build-superstore.mjs`(`dist/data/superstore.js`) → 그림은 `fetch-warbond-item-images.py`가 채권과 함께 받음 → `test-superstore.mjs`. 17쪽 접힌 표의 I-44 Salamander 헬멧 75는 오타(보드·개별 문서 rev 139519·위키 총액이 125). 위키 총액 표(손으로 갱신)·쪽별 표 합계가 다르거나, 새 꾸미기에 게임 한국어 이름이 아직 없거나(영어로 표시), 그림을 아직 받지 않아도(이름만 표시) `test-superstore`는 실패하지 않고 PASS 줄에 '확인할 것'으로 알림(사용자 결정 2026-11-19, 배포를 막지 않기 위해). 들어 있는 한국어 이름이 게임 이름과 다르면 실패. 문서 형식('== Stock ==' 탭)이 바뀌면 `build-superstore`가 이유를 적고 멈춤. 모든 항목 상시 판매(로테이션 없음, 사용자 확인). 채권 상단에 SUPER CREDITS 26,500·MEDALS 19,928 합계, 메달·슈퍼 크레딧 아이콘은 위키 그림(`node scripts/fetch-currency-icons.mjs`).
  - **스트라타젬 도감 필터(2026-11-19)**: 종류 줄 오른쪽에 함선 모듈 칩, 관통력 줄의 '미확인 AP' 대신 구분 칩 '전체·공격·방어·지원·임무'(`?p=`). 구분은 위키 인포박스 permit_type(없으면 임무), SOS 신호기·전술용 비디오 카메라는 사용자 결정으로 임무(`PERMIT_OVERRIDES`, `stratagem-stats-parse.mjs`). 종류·구분 칩 숫자는 서로의 선택에 맞춰 바뀌고 0개 칩은 흐리게, 누르면 반대쪽 선택이 풀림.
  - **방어구 탭(2026-11-19)**: 패시브 칩은 여러 줄로 줄바꿈, 누르면 스크롤 대신 필터, 여러 개 동시 선택(`#/gear?tab=armor&p=a,b`, '전체'는 모두 해제). 무게 색(경량 파랑·일반 초록·중량 주황빨강, `--w-light/medium/heavy`)을 필터 점·카드 위 띠·무게 표시에.
  - **인체공학성·흔들림(2026-11-19)**: 흔들림은 datamine `sway` 배율(1 = 100%)이며 100%가 아닌 6종만 표시(사용자 결정: 노바 28%, 사이트라이너·StA-11 70%, 도미네이터·이럽터·딜리전스 CS 80%). 스트라타젬·장비 상세 스펙 칸에 datamine `ergonomics`(지원 무기 34종 `stratagem-stats.js`, 주·보조무기 `personal-weapons.js`). 중기관총은 datamine 값 0 그대로(위키 문서 값과 다를 수 있음).
  - **탭 아이콘(2026-11-19)**: 스트라타젬은 위키 `File:Stratagem Icon.svg`, 장비는 `File:Primary Weapon Currency Icon.svg`(둘 다 Dogo314, CC BY-NC-SA 4.0)를 글자색으로(`dom.js` ICONS `arsenal`·`gear`). 나무위키 그림은 이용 조건 미확인이라 쓰지 않음(사용자 선택).
  - **기타(2026-11-19)**: 커스터마이징 표는 좁은 창에서 해금·비용 칸이 행 전체 높이(세로줄이 끝까지), 채권 상세 아래 '한국어 이름을 확인하지 못한…' 안내 문구 삭제(사용자 요청).
  - 검사: `npm run check` 18종 통과, `node scripts/check-weapons.mjs` 통과. 1280·1440·360px 화면 확인(콘솔 오류 없음).

- **PR #9 병합(2026-11-10, 배포됨)**: 무기 모드 탭, 주 무기 부착물 표, 지원 무기 연사·탄창, 스트라타젬 호출 코드, 채권 칩, 철거 시설 추가, 오토마톤 방어 시설 4종을 적 대응으로 이동, 커스틱·녹셔스 세력 안내. 이후 작은 수정 2개(영어 테마 버튼 설명, 세력 안내별 확인 날짜) 배포.
- **새 적 2종·M-104(2026-11-08, 배포됨)**: 녹셔스 스캐빈저·녹셔스 스퓨어(부위 수치는 스캐빈저·커스틱 스퓨어 것을 옮김), M-104 소각형 고속 정찰 차량.
- **위키 재대조(2026-11-08, 배포됨)**: 모든 원본 재대조. LAS-16 Sickle 열 용량 8.4초(106발), 커스틱 4종 페이지 이름 변경 반영, `fetch-enemy-anatomy`가 넘겨주기를 따라감. datamine 판 142136.
- **방어구 페이지·채권 ↔ 방어구 연결(2026-11-03, 배포됨)**: 장비 화면의 방어구 탭(113종, 패시브 32종). 파이프라인 `fetch-armor` → `build-armor` → `python scripts/tools/fetch-armor-images.py` → `npm run check`. BFM-77 Reformer는 인포박스대로 일반 표시(`armorDiscrepancies`).
- **게임 스타일 적용(배포됨)**: 올리브 블랙·노란색·경고 줄무늬·잘린 모서리, Barlow Condensed + Pretendard. 거절된 개편 브랜치 `auto/2026-11-03-hallmark-redesign`은 병합하지 않음(삭제 여부 사용자 결정 대기).
- **채권 화면**: 5×3 보드(26개 채권·603개 항목), 이미지는 위키 원본에서 표시 크기 2배 이상(용량 한도: 항목 폴더 12,500,000B, 파일당 140,000B, 배너 350,000B, SVG 50,000B). 1340px 이상에서는 항목 상세가 채권 패널 왼쪽에 별도 패널(360~560px)로 열림.
- **PR 검사 워크플로 없음**: `check.yml`은 지움(2026-11-03). `deploy-pages.yml`이 `npm run check` 후 배포합니다. `check-weapons.mjs`는 PC에서 직접 돌립니다.

## 남은 일 (각각 사용자 승인 후 진행)

- **실제 기기 확인**: 스토어·슈퍼 스토어(휴대폰에서 3×2 보드 글자 크기), 휴대폰 하단 탭 7칸(360px에서 글자 넘침 없음은 헤드리스로 확인), 행성·부스터 탭, 게임 스타일·방어구 탭, 5×3 보드.
- **전술 재장전 미확인 32종**: 리버레이터·브레이커·세네터 등 주·보조무기 32종은 위키 인포박스에 `tac_reload_time`이 없음(2026-11-19 현재 판 확인, datamine에도 재장전 시간 없음). 출처 없이 채우지 않고 '탄창을 비웠을 때' 값만 표시. 위키에 올라오면 `fetch-weapons-source` → `build-weapons`로 자동 반영.
- **중기관총 인체공학성 0**: datamine 값 그대로 표시 중. 위키 MG-206 문서 값과 대조해 다르면 사용자에게 물어보기.
- **녹셔스 적 재확인**: 위키 문서가 작성 중(WIP). 고유 수치가 올라오면 `fetch-enemy-anatomy` → `npm run check`가 판번호 차이로 알려 줍니다.
- **전송 네트워크 철거력 10**: 위키에 값 없음, 사용자가 받아들인 값(`thresholdSource: 'user'`).
- 부착물 Flashlight·Focus Lens·Triple Lens는 영어 표시 중. 게임 이름(조명·초점 렌즈·삼중 렌즈)이 문장표에 있으니 바꿀지 사용자 결정 전.
- StA-52 예비 탄창: datamine 7, 위키 6(rev 140347). 위키가 7로 바뀌면 다시 받고 `scripts/weapon-infobox.mjs`의 기록된 불일치를 지웁니다.
- 전쟁 채권 '미확인' 12건은 모두 페이지 해금 메달 수입니다(2쪽 'Unknown' 9건, 마지막 쪽 해금이 인포박스와 다른 3건: 철갑의 민주주의·공성 파괴자·존재하지 않는 부대). 위키·나무위키·게임 문장표 어디에도 값이 없어 그대로 둠. 항목 비용 불일치는 2026-11-19에 항목 개별 문서로 판정(`node scripts/fetch-warbond-item-pages.mjs` → `build-warbonds`, `scripts/warbond-resolve.mjs`): TG-8 헬멧 30, SS-33 방어구 45·헬멧 30, CPG-48 헬멧 35, 무결의 문장 카드 6, 초과 EAT 할당 2쪽 55, 통합 화재 진압기 3쪽 65. CPG-48 헬멧·무결의 문장 카드는 나무위키 총 메달 수(888)가 보드 틀 값(30·7) 합과 맞아, 개별 문서 값(35·6)과 다름에 유의.
- **[사용자가 정한 차후 작업] 채권 페이지를 게임 안 전쟁 채권 화면과 똑같이 맞추기**: 사용자가 시작하라고 할 때 진행.
- 적 무기 이름(융합 돌격포·대형 융합 연발포·빛의 창 등)은 사이트 자체 번역. 사용자가 다른 이름을 원하면 `db/source/enemy_behavior_korean.json`에서 바꾸고 `build-enemy-pages` → `npm run check`.
- 넣지 않은 것: Eagle Fly By·Orbital Confetti 등 피해 없는 스트라타젬, 적 크기 분류의 Civilian·Helldiver·SEAF Soldier·GATER·Illuminate Overship, LAS-44 Nova의 Anti-Tank 태그.
- 전쟁 채권 SVG 18개·이미지 목록 3개가 줄바꿈 차이로만 '변경'으로 보일 수 있음(내용 변경 없음, 커밋하지 않음).
- **Codex 위임 중단(2026-11-03)**: 사용자가 다시 지시할 때까지 Codex에 일을 맡기지 않음.

## 사용자가 이미 정한 것 (다시 묻지 않기)

- 한국어 이름은 게임 안 자료가 우선, 게임에 없으면 알맞게 번역(2026-11-19). 게임 문장표는 음성 대사·긴 글을 빼고 저장소에 둠.
- 게시는 수정마다 하지 않고, 로컬에서 충분히 테스트한 뒤 사용자가 게시하자고 할 때 한 번에 master에 올림(2026-11-19).
- 함선 모듈: 기본 '적용', 비율은 곱하고 모든 모듈 최고 단계 기준. 재사용 대기는 정수 초로 반올림해 표시(호출·재무장 시간은 소수 그대로)(2026-11-19).
- 상태 이상 안내는 행성 탭 안에. 행성 탭은 팩션 추천 오른쪽, 부스터는 장비 탭의 방어구 오른쪽(2026-11-19).
- 채권 항목 상세는 왼쪽 자리가 360px 미만(1340px 미만 화면)이면 보드 자리에 열림(2026-11-19).
- 병렬 하위 작업 결과는 그 일을 맡긴 AI에게 보고하고, HANDOFF.md도 맡긴 AI가 통합할 때 한 번 갱신한다(2026-11-03).
- Elevated Overseer 몸통은 공식 패치 노트 값 450(`anatomyOfficial`). Voteless Heavy 팔 피해 상한 변경은 유지.
- AI 기능은 사이트에 넣지 않음. 팩션별 장비 평가 기능은 보류(사용자가 꺼내기 전에는 제안하지 않음).
- 사이트 메인 화면은 전쟁 채권 페이지(스토어 탭의 첫 하위 페이지). 스트라타젬 구분에서 SOS 신호기·전술용 비디오 카메라는 '임무'(2026-11-19). 슈퍼 스토어는 상시 판매(로테이션 문구 없음). Exo Experts 한국어 이름은 게임 공식 번역 그대로 '외계 전문가'('(오역)' 표시는 빼기로 함, 2026-11-20). 화면에 출처·제공자 표기(예: 한국어 이름: 나무위키)를 넣지 않음.
- 넓은 화면의 항목 상세는 닫기(X)만, 좁은 화면은 뒤로 버튼.
- 채권 목록은 한 개의 연속 그리드(출시일 오름차순), 종류 칩은 필터. 채권 상세 보상은 게임과 같은 5×3 타일, 정보는 상자·구분선 없이 나열(`4e03e42`). 최신 채권 배너는 화면 폭 띠 + 이름 줄과 버튼만(`b5c8770`).
- 사이트 디자인은 헬다이버즈 게임 스타일. 일반적인 미니멀 테마로 바꾸지 않음. 디자인을 바꿀 때는 git 기록의 과거 레이아웃 결정을 먼저 확인하고 되돌리지 않음.
- 위키의 '양쪽 모두 파괴 시 처치'는 계산에 반영(2026-11-03).
- 방어구 페이지는 장비 화면 안의 탭, 방어구 그림은 113종 모두.
- PR #9 전체 수용(2026-11-10): 전송 네트워크 철거력 10, 칭호 배지 원래 색, 오토마톤 방어 시설 4종을 적 대응으로 이동, 커스틱·녹셔스 세력 안내.

## 다음 AI에게

- 적 문서 갱신: 요약(`enemy_behavior_korean.json`)이 없거나 옛 위키 판으로 쓰인 적, 화염 배율·경직치가 숫자가 아닌 적('미확인'으로 표시)이 있어도 빌드·검사는 멈추지 않습니다(사용자 결정 2026-11-19, 배포를 막지 않기 위해). `build-enemy-pages`가 그런 적을 목록으로 보여 주고 `test-enemy-pages`는 PASS 줄에 개수만 적습니다. 여유 있을 때 Spawning·Behavior를 읽고 요약과 revision을 고친 뒤 다시 빌드하세요.
- 위키 데이터 갱신: revision 먼저 확인(MediaWiki API `api.php?action=query&prop=revisions`) → `scripts/fetch-*` → `build-*` → `npm run check`. 새 부스터·환경 조건·임무·이름 변경은 `db/source/*_korean.json`, `structure_objectives.json`, `game_name_targets.json`에 게임 영어 원문으로 적고 `node scripts/build-game-names.mjs` → 해당 `build-*`. 문장표에 없는 영어면 빌드가 멈춥니다(게임 원문과 글자 그대로 맞춰야 함).
- wiki.gg는 curl 기본 User-Agent로 받으세요(브라우저 User-Agent는 차단). 짧은 시간에 많이 요청하면 429를 줍니다.
- 전쟁 채권 갱신: `node scripts/fetch-warbonds.mjs` → `node scripts/fetch-warbond-item-pages.mjs` → `node scripts/build-warbonds.mjs` → `npm run check`. 새 채권은 `db/source/warbond_korean_names.json`에 한국어 이름이 없으면 빌드가 실패하니 사용자에게 이름을 받으세요.
- 슈퍼 스토어 갱신: `node scripts/fetch-superstore.mjs` → `node scripts/build-game-names.mjs` → `node scripts/build-superstore.mjs` → 아래 채권 그림 다운로더(슈퍼 스토어 그림도 받음) → `npm run check`. 저장소 안 `.py`를 Edit 도구로 고치면 포맷 훅이 파일 전체를 다시 정렬하니, Python 스크립트로 필요한 줄만 바꾸세요.
- 전쟁 채권 이미지 갱신(채권 빌드 후): `python3 scripts/tools/fetch-warbond-covers.py` → `... --latest-large` → `python3 scripts/tools/fetch-warbond-item-images.py` → `python3 scripts/tools/test-warbond-item-images.py` → `npm run check` → `node scripts/check-weapons.mjs`. 다운로더는 Node.js, curl, Pillow(WebP)가 필요합니다. SVG 안전 검사는 `scripts/svg-safety.mjs`.
- `scripts/tools/fetch-weapon-images.py`는 모든 이미지를 다시 인코딩합니다. 새 이미지·원본이 바뀐 이미지만 커밋하세요.

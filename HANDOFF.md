# 인수인계 (현재 상황판)

> 작업을 마친 AI가 **덮어써서** 최신으로 유지합니다. 쌓아 두는 일지가 아닙니다. 규칙은 [AGENTS.md](AGENTS.md)를 보세요.

- 마지막 갱신: 2026-11-19, Claude Code 담당
- 기준: 브랜치 `work/wiki-features` (master `cac2f64` 위 로컬 커밋, **미게시**)
- 진행 중인 작업: 없음. 사용자가 게시하자고 할 때 master에 올립니다.

## 지금 상태

- **위키·게임 자료 기능 묶음(2026-11-19, 로컬 커밋·미게시)**
  - **한국어 이름 규칙 변경**(AGENTS.md): 게임 안 자료로 확인한 최신 표기가 우선, 나무위키는 보조, 게임에도 없으면 알맞게 번역. 게임 공식 문장표(음성 대사·300자 넘는 글 제외, 10,306줄, 게임 빌드 26568081)가 `db/source/game_strings_ko.tsv`에 있고, `node scripts/build-game-names.mjs`가 사이트가 쓰는 문장만 `db/source/game_names_ko.json`에 뽑습니다. 게임 업데이트 뒤 문장표 갱신은 원본 표가 있는 PC에서 `scripts/tools/import-game-strings.mjs <tsv> --planets <행성.json>`(행성 이름·생물군계 설명은 `db/source/game_planets_ko.json`).
  - **게임 이름으로 바꾼 36개**(`db/source/game_name_targets.json`, `test-game-names.mjs`): 포격 FRV·화물 컨테이너·휴대용 통신 릴레이·증원 포드·지진 탐지기·전술용 비디오 카메라·로버·핫도그·K-9·독 브레스, 퍼니셔 플라스마·핫샷 마크맨 라이플, O-3 자유로운 영혼·O-44 조종사와의 유대감·운동 에너지 변위 완화·충격 방지 패드, 강화 버전·산소공급기, 차저 베히모스·어설트 레이더·머로더·MG 레이더·데버스테이터(로켓·거대·제트 여단)·바라저 탱크·벙커 포탑·옵트루더·버레이시터, 건십 시설·워프 게이트웨이·탐지 탑·궤도 캐넌·테러리스트 기념물·인지 분열기 전원 장치. 무기·방어구 빌드(`build-weapons`·`build-armor`)는 이 표의 게임 이름을 나무위키보다 먼저 씁니다. 스트라타젬 옛 이름은 검색 별칭으로 남김.
  - **함선 모듈**: 스트라타젬 도감에 '함선 모듈 적용/미적용'(기본 적용, `?mod=off`), 카드마다 재사용 시간. 기본값은 각 위키 문서 Stratagem Stats Table(`fetch-stratagem-stats` → `build-stratagem-stats`, `dist/data/stratagem-stats.js`), 모듈 비율은 Ship Modules rev 134806(`dist/data/ship-modules.js`, 계산 `dist/core/modules.js`). 비율은 곱하고 '사기 증강' 5%도 넣음(위키 문서 대부분은 5%를 빼고 적음). 불릿 스톰 위키값 66.5초는 확인한 차이로 `test-stratagem-stats.mjs`에 기록.
  - **부스터 탭**(장비 → 방어구 오른쪽, `#/gear?tab=boosters&b=`): 20종, 게임 이름·설명 + 위키 효과 요약(숫자는 위키 본문과 대조), 아이콘 SVG. `fetch-boosters` → `build-game-names` → `build-boosters`.
  - **행성 탭**(`#/planets?tab=conditions|modifiers|biomes|status`): 환경 조건 12종(아이콘)·글룸 4단계, 작전 제한 조건 8종(난이도 5부터 1개·8부터 2개)·이벤트 효과 4종, 생물군계 28종(행성 379개, 이름·분류는 사이트 번역), 상태 이상 7종(위키 Status Effects 요약). 스트라타젬 상세에 '행성 조건에 따른 변화'(표시값 × 비율, 기본 접힘, 함선 모듈 문구는 그 블록 맨 아래). `fetch-planet-pages` → `build-planets`(`dist/data/planets.js`, `planet-stratagem-effects.js`). 하단 탭이 7칸이 됨.
  - **임무 연결**: 철거 화면에서 시설을 부수는 주요·전술 목표와 난이도(10에 없는 임무는 흐리게), 21개 시설·28개 임무(`db/source/structure_objectives.json`, `fetch-objectives` → `build-structure-objectives`).
  - **특수 효과**(스트라타젬·장비 상세, 기본 수치표 바로 아래): 철거력, 저지력(stun), 넉백(push). 공격마다 한 줄(철거력 · 저지력 · 넉백). 스트라타젬은 datamine 공격 기록(`db/source/stratagems_data.json` + `weapons_data.json`, `stratagem-stats.js`의 `forces`)이고, 철거 데이터가 범위로 둔 값(500kg 직격 40~50)은 범위로 표시, 공격 기록이 없으면 철거 데이터의 철거력만. 장비는 `db/weapons.js`의 기록별 값(`personal-weapons.js`에 demolition·stun·push 추가). 공격 기록이 없는 배낭·보호막·임무 장비와 datamine에 없는 테슬라 탑·거치포·지옥폭탄은 저지력·넉백 없음.
  - **기타**: 전체 검색에 방어구·부스터, 채권 항목 상세는 1340px 미만에서 보드 자리에 열림(겹침 해결), README·계산 방식의 자료 날짜를 '9월 16일 처음 확인, 11월 8일 다시 대조'로.
  - 검사: `npm run check` 16종 통과, `node scripts/check-weapons.mjs` 통과. 1280·1440·360px 화면 확인(콘솔 오류 없음).

- **PR #9 병합(2026-11-10, 배포됨)**: 무기 모드 탭, 주 무기 부착물 표, 지원 무기 연사·탄창, 스트라타젬 호출 코드, 채권 칩, 철거 시설 추가, 오토마톤 방어 시설 4종을 적 대응으로 이동, 커스틱·녹셔스 세력 안내. 이후 작은 수정 2개(영어 테마 버튼 설명, 세력 안내별 확인 날짜) 배포.
- **새 적 2종·M-104(2026-11-08, 배포됨)**: 녹셔스 스캐빈저·녹셔스 스퓨어(부위 수치는 스캐빈저·커스틱 스퓨어 것을 옮김), M-104 소각형 고속 정찰 차량.
- **위키 재대조(2026-11-08, 배포됨)**: 모든 원본 재대조. LAS-16 Sickle 열 용량 8.4초(106발), 커스틱 4종 페이지 이름 변경 반영, `fetch-enemy-anatomy`가 넘겨주기를 따라감. datamine 판 142136.
- **방어구 페이지·채권 ↔ 방어구 연결(2026-11-03, 배포됨)**: 장비 화면의 방어구 탭(113종, 패시브 32종). 파이프라인 `fetch-armor` → `build-armor` → `python scripts/tools/fetch-armor-images.py` → `npm run check`. BFM-77 Reformer는 인포박스대로 일반 표시(`armorDiscrepancies`).
- **게임 스타일 적용(배포됨)**: 올리브 블랙·노란색·경고 줄무늬·잘린 모서리, Barlow Condensed + Pretendard. 거절된 개편 브랜치 `auto/2026-11-03-hallmark-redesign`은 병합하지 않음(삭제 여부 사용자 결정 대기).
- **채권 화면**: 5×3 보드(26개 채권·603개 항목), 이미지는 위키 원본에서 표시 크기 2배 이상(용량 한도: 항목 폴더 12,500,000B, 파일당 140,000B, 배너 350,000B, SVG 50,000B). 1340px 이상에서는 항목 상세가 채권 패널 왼쪽에 별도 패널(360~560px)로 열림.
- **PR 검사 워크플로 없음**: `check.yml`은 지움(2026-11-03). `deploy-pages.yml`이 `npm run check` 후 배포합니다. `check-weapons.mjs`는 PC에서 직접 돌립니다.

## 남은 일 (각각 사용자 승인 후 진행)

- **게시**: `work/wiki-features`를 사용자가 게시하자고 할 때 master에 올립니다(push = 배포).
- **실제 기기 확인**: 휴대폰 하단 탭 7칸(360px에서 글자 넘침 없음은 헤드리스로 확인), 행성·부스터 탭, 게임 스타일·방어구 탭, 5×3 보드.
- **녹셔스 적 재확인**: 위키 문서가 작성 중(WIP). 고유 수치가 올라오면 `fetch-enemy-anatomy` → `npm run check`가 판번호 차이로 알려 줍니다.
- **전송 네트워크 철거력 10**: 위키에 값 없음, 사용자가 받아들인 값(`thresholdSource: 'user'`).
- 부착물 Flashlight·Focus Lens·Triple Lens는 영어 표시 중. 게임 이름(조명·초점 렌즈·삼중 렌즈)이 문장표에 있으니 바꿀지 사용자 결정 전.
- 채권 보드의 O-3 Free Spirit 헬멧 타일은 영어 이름(방어구 타일은 게임 이름으로 열림).
- StA-52 예비 탄창: datamine 7, 위키 6(rev 140347). 위키가 7로 바뀌면 다시 받고 `scripts/weapon-infobox.mjs`의 기록된 불일치를 지웁니다.
- 전쟁 채권 위키 불일치 '미확인' 21건(`warbondDiscrepancies`).
- **[사용자가 정한 차후 작업] 채권 페이지를 게임 안 전쟁 채권 화면과 똑같이 맞추기**: 사용자가 시작하라고 할 때 진행.
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
- 사이트 메인 화면은 전쟁 채권 페이지. Exo Experts 한국어 이름은 '외계 전문가(오역)'. 화면에 출처·제공자 표기(예: 한국어 이름: 나무위키)를 넣지 않음.
- 넓은 화면의 항목 상세는 닫기(X)만, 좁은 화면은 뒤로 버튼.
- 채권 목록은 한 개의 연속 그리드(출시일 오름차순), 종류 칩은 필터. 채권 상세 보상은 게임과 같은 5×3 타일, 정보는 상자·구분선 없이 나열(`4e03e42`). 최신 채권 배너는 화면 폭 띠 + 이름 줄과 버튼만(`b5c8770`).
- 사이트 디자인은 헬다이버즈 게임 스타일. 일반적인 미니멀 테마로 바꾸지 않음. 디자인을 바꿀 때는 git 기록의 과거 레이아웃 결정을 먼저 확인하고 되돌리지 않음.
- 위키의 '양쪽 모두 파괴 시 처치'는 계산에 반영(2026-11-03).
- 방어구 페이지는 장비 화면 안의 탭, 방어구 그림은 113종 모두.
- PR #9 전체 수용(2026-11-10): 전송 네트워크 철거력 10, 칭호 배지 원래 색, 오토마톤 방어 시설 4종을 적 대응으로 이동, 커스틱·녹셔스 세력 안내.

## 다음 AI에게

- 위키 데이터 갱신: revision 먼저 확인(MediaWiki API `api.php?action=query&prop=revisions`) → `scripts/fetch-*` → `build-*` → `npm run check`. 새 부스터·환경 조건·임무·이름 변경은 `db/source/*_korean.json`, `structure_objectives.json`, `game_name_targets.json`에 게임 영어 원문으로 적고 `node scripts/build-game-names.mjs` → 해당 `build-*`. 문장표에 없는 영어면 빌드가 멈춥니다(게임 원문과 글자 그대로 맞춰야 함).
- wiki.gg는 curl 기본 User-Agent로 받으세요(브라우저 User-Agent는 차단). 짧은 시간에 많이 요청하면 429를 줍니다.
- 전쟁 채권 갱신: `node scripts/fetch-warbonds.mjs` → `node scripts/build-warbonds.mjs` → `npm run check`. 새 채권은 `db/source/warbond_korean_names.json`에 한국어 이름이 없으면 빌드가 실패하니 사용자에게 이름을 받으세요.
- 전쟁 채권 이미지 갱신(채권 빌드 후): `python3 scripts/tools/fetch-warbond-covers.py` → `... --latest-large` → `python3 scripts/tools/fetch-warbond-item-images.py` → `python3 scripts/tools/test-warbond-item-images.py` → `npm run check` → `node scripts/check-weapons.mjs`. 다운로더는 Node.js, curl, Pillow(WebP)가 필요합니다. SVG 안전 검사는 `scripts/svg-safety.mjs`.
- `scripts/tools/fetch-weapon-images.py`는 모든 이미지를 다시 인코딩합니다. 새 이미지·원본이 바뀐 이미지만 커밋하세요.

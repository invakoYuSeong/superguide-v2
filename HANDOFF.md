# 인수인계 (현재 상황판)

> 작업을 마친 AI가 **덮어써서** 최신으로 유지합니다. 쌓아 두는 일지가 아닙니다. 규칙은 [AGENTS.md](AGENTS.md)를 보세요.

- 마지막 갱신: 2026-11-02, Codex 담당
- 기준 커밋: `6b3cffd` (브랜치 `auto/2026-11-02-warbond-item-detail`, PR #4)
- 진행 중인 작업: 없음 (PR #4 검토 대기)

## 최근에 끝난 일

- 전쟁 채권 항목 상세의 ‘뒤로’ 버튼은 1100px 이상에서 숨겨 키보드 초점에서도 제외했습니다. 좁은 화면의 ‘뒤로’, 닫기(X), ‘전체 페이지로 열기’는 유지하며 관련 검사를 추가했습니다.
- 무기 상세의 ‘한국어 이름: 나무위키’ 출처 표시를 제거했습니다. 다른 상세 화면에는 같은 표시가 없었고, 삭제할 번역 키도 없었습니다. 위키 링크·자료 확인 날짜와 데이터의 이름 보정 설명은 유지했습니다.
- 전쟁 채권의 무기·스트라타젬 링크를 누르면 기존 상세 렌더러를 재사용해 같은 창에 표시합니다. 1100px 이상은 왼쪽 상세·오른쪽 채권을 각각 스크롤하며, 좁은 화면은 상세로 전환하고 ‘뒤로’로 페이지별 목록과 스크롤을 복원합니다. 전체 페이지 링크도 제공합니다.
- `?item=gear%2F무기ID` / `?item=arsenal%2F항목ID`와 `m`(모드)으로 상세를 공유합니다. 첫 항목은 방문 기록을 추가하고 다른 항목은 교체하므로 브라우저 뒤로 가기는 항목부터 닫습니다. 채권을 닫으면 둘 다 닫히며, 직접 연 링크는 이전 외부 페이지로 보내지 않고 채권 목록으로 돌아옵니다.
- 채권 목록을 출시일 오름차순의 연속 그리드로 바꾸고 종류 칩은 필터로 유지했습니다. 새 UI는 `L(한국어, 영어)`로 번역하며, 상세·주소·정렬·뒤로 가기·스크롤 검사를 `npm run check`에 추가했습니다.
- 기존 채권 데이터·표지·최신 채권 배너 작업: [PR #3](https://github.com/modocracy/superguide-v2/pull/3), master 반영 완료.

## 남은 일 (각각 사용자 승인 후 진행)

- StA-52 예비 탄창: datamine은 7, 위키 인포박스는 아직 6입니다(revision 140347 기준). 위키가 7로 바뀌면 `db/source`를 다시 받고 `scripts/weapon-infobox.mjs`의 기록된 불일치 항목을 지웁니다.
- Caustic Strain 팩션 안내 추가: 위키 하위 팩션 Caustic Strain(revision 140771)에는 Bile Spitter·Bile Warrior·Bile Spewer·Spore Charger가 속하고, 부위 데이터는 저장소에 이미 있습니다. `factionGuides`에 항목 1개, 유닛 4종의 한국어 설명, `faction-loadouts.js` 무기 추천, 영어 사전이 필요합니다. 위키 전술 정보가 아직 비어 있어서("Missing information") 무기 추천 근거가 부족합니다. 사용자가 추천 방향을 정해 주면 진행합니다.
- 반영하지 않은 것: Eagle Fly By / Orbital Confetti(피해 없음), LAS-44 Nova의 Anti-Tank 태그.
- 전쟁 채권 위키 불일치 '미확인' 21건(전체 목록은 PR #3 설명과 `warbondDiscrepancies`): 비용 차이 Scope of Authority 2·Entrenched Division 2·Castellan's Creed 1, 이름 표기 Boundary Banner/Banker 2, Ironclad Democracy 부스터 2종의 페이지 뒤바뀜 2, 마지막 페이지 해금 ≠ all-pages 3(Ironclad·Redacted·Siege Breakers), 2페이지 해금 메달 없음 9. 위키가 고쳐지면 다시 받아 빌드합니다.
- 휴대폰 하단 탭 6칸과 전쟁 채권 화면 배치, 이번 항목 상세 전환(뒤로·스크롤 복원)은 실제 기기에서 확인이 필요합니다. 헤드리스 Chrome 360·1280px 화면 캡처로는 겹침·가로 넘침이 없음을 확인했습니다.
- 다른 페이지도 채권 페이지와 같은 레이아웃으로 맞추기 (이번 PR 범위 밖).

## 사용자가 이미 정한 것 (다시 묻지 않기)

- Elevated Overseer 몸통은 위키 표(400)가 아니라 공식 패치 노트 값(450)을 씁니다(`anatomyOfficial`).
- Voteless Heavy 팔 피해 상한 변경은 반영한 상태로 유지합니다.
- TypeSafe Jev 같은 AI 기능은 사이트에 넣지 않습니다. 데이터·번역 대량 검사에만 씁니다.
- 팩션별 장비 평가 기능은 보류 중입니다. 사용자가 다시 꺼내기 전에는 제안하지 않습니다.
- 사이트 메인 화면은 전쟁 채권 페이지입니다.
- Exo Experts의 한국어 이름은 '외계 전문가(오역)'입니다(게임 공식 오역을 그대로 보여 줌).
- 한국어 전쟁 채권 이름은 게임 내 표기와 같으므로 출처를 표기하지 않습니다.
- 넓은 화면의 항목 상세는 닫기(X) 버튼만 보여 준다(뒤로 버튼 없음, 좁은 화면은 뒤로 유지)
- 한국어 이름 출처(예: 한국어 이름: 나무위키) 같은 출처·제공자 표기는 화면에 넣지 않는다
- 다음 목표는 다른 페이지도 채권 페이지와 동일한 레이아웃으로 맞추기.
- 전쟁 채권 목록은 기본/프리미엄/전설 구역으로 나누지 않고 한 개의 연속된 그리드로 빈칸 없이 채운다.
- 목록은 출시일 오름차순(오래된 것 먼저)으로 정렬한다. 같은 날짜는 기존 순서를 유지한다.
- 위쪽 종류 칩(전체/기본/프리미엄/전설)은 필터로 유지한다.

## 다음 AI에게

- 위키 데이터를 갱신할 때는 위키 revision을 먼저 확인하고, `scripts/fetch-*` → `build-*` → `npm run check` 순서로 진행하세요.
- 전쟁 채권 갱신: `node scripts/fetch-warbonds.mjs` → `node scripts/build-warbonds.mjs` → `npm run check`. 새 전쟁 채권이 생기면 `db/source/warbond_korean_names.json`에 한국어 이름이 없어서 빌드가 실패하니, 사용자에게 이름을 받아 넣으세요.
- wiki.gg는 curl 기본 User-Agent로 받으세요. 브라우저(Mozilla) User-Agent를 쓰면 차단 페이지가 옵니다. revision 확인에는 MediaWiki API(`api.php?action=query&prop=revisions`)가 편합니다.
- `scripts/tools/fetch-weapon-images.py`는 모든 이미지를 다시 인코딩합니다. 바뀌지 않은 이미지까지 바이트가 달라지니 새 이미지·원본이 바뀐 이미지만 커밋하세요. 이미지 하나만 필요하면 그 무기만 같은 방식으로 처리하는 편이 안전합니다.

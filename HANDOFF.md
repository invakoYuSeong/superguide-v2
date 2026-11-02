# 인수인계 (현재 상황판)

> 작업을 마친 AI가 **덮어써서** 최신으로 유지합니다. 쌓아 두는 일지가 아닙니다. 규칙은 [AGENTS.md](AGENTS.md)를 보세요.

- 마지막 갱신: 2026-11-02, Codex 담당 (Claude Code 작업 인계)
- 기준 커밋: `2984a9f` (브랜치 `auto/2026-11-02-warbond-ingame-grid`, PR pending)
- 진행 중인 작업: 없음 (PR 검토 대기)

## 최근에 끝난 일

- 전쟁 채권 상세의 페이지별 목록을 게임과 같은 5×3 보드로 바꿨습니다. `scripts/warbond-parse.mjs` → `scripts/build-warbonds.mjs`에서 위치·크기·이미지명을 생성하며, 26개 채권·85페이지·603개 항목의 배치·이미지명·템플릿 가격이 별도 참고 자료와 일치합니다. 모든 페이지가 15칸을 겹침 없이 채웁니다. 기존 항목 수(페이지당 4~9개), 내부 상세·위키 링크, 미확인 표시를 유지합니다.
- 기본 채권은 검정, 프리미엄·전설은 청록 사선 배경입니다. PAGE_N·해금 메달·이미지·메달 가격을 표시하며, 좁은 보드는 글자를 줄이고 이미지·가격을 남깁니다. 전설의 실제 게임 색상은 아직 미확인입니다.
- `scripts/tools/fetch-warbond-item-images.py`와 `dist/data/warbond-item-images.js`를 추가했습니다. 비트맵은 투명 여백 제거·축소한 WebP로 저장하며 기존 파일은 해시·크기 검증 후 재변환 없이 유지합니다. SVG는 `wiki-icons.js`의 위키 파일명·출처·SHA-256 및 API의 실제 파일명(리디렉션 포함)·원본 SHA-1이 일치하면 기존 `dist/assets/stratagems/` 파일을 연결합니다. 재사용할 파일이 없으면 안전성을 통과한 원본 SVG를 `dist/assets/warbond-items/`에 저장합니다. 현재 이미지 511종 모두 연결(누락 0): 새 WebP 463개 + 칭호 SVG 18개 = 481개 파일·3,635,632바이트(약 3.6MB), 스트라타젬 SVG 30개는 기존 파일 재사용. 출처는 Helldivers Wiki 파일(CC BY-NC-SA 4.0). 다운로드 실패 항목은 이름만 표시합니다.
- `scripts/svg-safety.mjs`로 다운로더와 Node 전용 검사에 같은 SVG 안전 규칙을 적용합니다. XML 구조·용량(파일당 50,000바이트)·이미지 크기를 검사하고 스크립트·이벤트 속성·foreignObject·외부 참조·DTD/entity·위험한 CSS를 거부합니다. 다운로더는 Python 표준 XML 파서로도 확인합니다. 모든 매핑 파일의 존재·해시와 항목 폴더의 미사용 파일을 검사합니다. SVG는 API 또는 viewBox의 원본 크기를 기록하며 타일에는 비율을 유지해 맞춥니다. 칭호 그림은 흰색과 검정 그림자로 검정·청록 배경에 표시합니다.
- 검사: `npm run check`(전쟁 채권 10,170개·상세 939개 포함)와 `node scripts/check-weapons.mjs` 통과. 다운로더 오프라인 테스트는 `python3 scripts/tools/test-warbond-item-images.py`입니다.
- 기존 목록·항목 상세·뒤로 가기·주소·스크롤 복원: [PR #4](https://github.com/modocracy/superguide-v2/pull/4), master 반영 완료. 기존 채권 데이터·표지·최신 채권 배너: [PR #3](https://github.com/modocracy/superguide-v2/pull/3), master 반영 완료.

## 남은 일 (각각 사용자 승인 후 진행)

- StA-52 예비 탄창: datamine은 7, 위키 인포박스는 아직 6입니다(revision 140347 기준). 위키가 7로 바뀌면 `db/source`를 다시 받고 `scripts/weapon-infobox.mjs`의 기록된 불일치 항목을 지웁니다.
- Caustic Strain 팩션 안내 추가: 위키 하위 팩션 Caustic Strain(revision 140771)에는 Bile Spitter·Bile Warrior·Bile Spewer·Spore Charger가 속하고, 부위 데이터는 저장소에 이미 있습니다. `factionGuides`에 항목 1개, 유닛 4종의 한국어 설명, `faction-loadouts.js` 무기 추천, 영어 사전이 필요합니다. 위키 전술 정보가 아직 비어 있어서("Missing information") 무기 추천 근거가 부족합니다. 사용자가 추천 방향을 정해 주면 진행합니다.
- 반영하지 않은 것: Eagle Fly By / Orbital Confetti(피해 없음), LAS-44 Nova의 Anti-Tank 태그.
- 전쟁 채권 위키 불일치 '미확인' 21건(전체 목록은 PR #3 설명과 `warbondDiscrepancies`): 비용 차이 Scope of Authority 2·Entrenched Division 2·Castellan's Creed 1, 이름 표기 Boundary Banner/Banker 2, Ironclad Democracy 부스터 2종의 페이지 뒤바뀜 2, 마지막 페이지 해금 ≠ all-pages 3(Ironclad·Redacted·Siege Breakers), 2페이지 해금 메달 없음 9. 위키가 고쳐지면 다시 받아 빌드합니다.
- 휴대폰 하단 탭 6칸과 전쟁 채권 화면 배치, 항목 상세 전환(뒤로·스크롤 복원), 새 5×3 보드의 360px 가독성·미확인 표시·가로 넘침은 실제 기기에서 확인이 필요합니다. 이전 목록·상세 전환은 헤드리스 Chrome 360·1280px 캡처로 겹침·가로 넘침이 없음을 확인했으며, 새 5×3 보드도 헤드리스 Chrome 1280·360px 캡처로 가로 넘침·깨진 이미지가 없음을 확인했습니다.
- 방어구 페이지 추가(패시브별 정리).

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
- 전쟁 채권 목록은 기본/프리미엄/전설 구역으로 나누지 않고 한 개의 연속된 그리드로 빈칸 없이 채운다.
- 목록은 출시일 오름차순(오래된 것 먼저)으로 정렬한다. 같은 날짜는 기존 순서를 유지한다.
- 위쪽 종류 칩(전체/기본/프리미엄/전설)은 필터로 유지한다.
- 채권 상세의 페이지별 보상은 게임과 같은 5×3 타일 배치로 보여 준다.

## 다음 AI에게

- 위키 데이터를 갱신할 때는 위키 revision을 먼저 확인하고, `scripts/fetch-*` → `build-*` → `npm run check` 순서로 진행하세요.
- 전쟁 채권 갱신: `node scripts/fetch-warbonds.mjs` → `node scripts/build-warbonds.mjs` → `npm run check`. 새 전쟁 채권이 생기면 `db/source/warbond_korean_names.json`에 한국어 이름이 없어서 빌드가 실패하니, 사용자에게 이름을 받아 넣으세요.
- 항목 이미지 갱신: 채권 빌드 후 `python3 scripts/tools/fetch-warbond-item-images.py` 실행(Node.js, curl, Pillow의 WebP 지원 필요; SVG 변환기·새 의존성 불필요). 템플릿의 이미지명으로 MediaWiki imageinfo·iiurlwidth를 조회하며 리디렉션도 따라갑니다. SVG의 thumburl이 원본 SVG인 경우도 지원합니다. 원본 sha1·타일 크기·파일 해시가 같은 비트맵은 재인코딩하지 않습니다. `--force`는 비트맵 재인코딩·SVG 재확인, `--reuse-local`은 공유 SVG를 포함한 기존 매핑을 네트워크 없이 검증하고 다시 생성합니다(누락 파일을 새로 채우지는 않습니다). 누락 항목은 일반 실행 시 재시도합니다. 이후 `npm run check`와 `node scripts/check-weapons.mjs`를 실행하세요. 새 항목 이미지 폴더의 합계 예산은 검사 기준 4,000,000바이트이며 공유 파일은 중복 계산하지 않습니다.
- wiki.gg는 curl 기본 User-Agent로 받으세요. 브라우저(Mozilla) User-Agent를 쓰면 차단 페이지가 옵니다. revision 확인에는 MediaWiki API(`api.php?action=query&prop=revisions`)가 편합니다.
- `scripts/tools/fetch-weapon-images.py`는 모든 이미지를 다시 인코딩합니다. 바뀌지 않은 이미지까지 바이트가 달라지니 새 이미지·원본이 바뀐 이미지만 커밋하세요. 이미지 하나만 필요하면 그 무기만 같은 방식으로 처리하는 편이 안전합니다.

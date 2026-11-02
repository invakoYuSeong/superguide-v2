# 인수인계 (현재 상황판)

> 작업을 마친 AI가 **덮어써서** 최신으로 유지합니다. 쌓아 두는 일지가 아닙니다. 규칙은 [AGENTS.md](AGENTS.md)를 보세요.

- 마지막 갱신: 2026-11-02, Claude Code 담당
- 기준 커밋: `a7a1d26` (master, PR #6 병합). 이 갱신과 PR 검사 워크플로는 브랜치 `auto/2026-11-02-pr-check-handoff`에 있음(검토 후 master 반영)
- 진행 중인 작업: 없음

## 지금 상태

- **PR 검사 워크플로**: `.github/workflows/check.yml`이 master 대상 PR과 수동 실행(workflow_dispatch)에서 `npm run check`와 `node scripts/check-weapons.mjs`를 돌립니다(권한 `contents: read`만, Node 24). 배포용 `deploy-pages.yml`은 그대로입니다.
- **채권 상세 화면**([PR #6](https://github.com/modocracy/superguide-v2/pull/6), 병합 `a7a1d26`): 대화상자가 열린 동안 페이지 스크롤을 잠가 스크롤바가 1개만 보입니다. 항목을 눌러도 채권 패널의 위치·폭이 그대로입니다. 760px 이상에서는 항목 상세가 채권 패널 왼쪽 빈 공간에 별도 패널(폭 360~560px)로 열리고, 760px 미만에서는 보드 자리를 대신하며 뒤로 버튼을 씁니다.
- **이미지 고해상도**(`b220992`, master 반영): 전쟁 채권 이미지를 위키 원본에서 표시 크기의 2배 이상으로 받습니다(원본보다 키우지 않음). 표지 720×360, 최신 배너 2048×1024(WebP 품질 72, 배너만 `srcset` 720w/2048w), 항목 이미지 `CELL=360`. 용량 한도: 항목 폴더 합계 12,500,000바이트, 항목 파일당 140,000바이트, 배너 350,000바이트, SVG 파일당 50,000바이트.
- **5×3 보드**([PR #5](https://github.com/modocracy/superguide-v2/pull/5)): 26개 채권·85페이지·603개 항목, 이미지 511종 모두 연결(누락 0). 출처는 Helldivers Wiki(CC BY-NC-SA 4.0). 전설 채권의 실제 게임 색상은 미확인.

## 남은 일 (각각 사용자 승인 후 진행)

- **[사용자가 정한 차후 작업] 채권 페이지를 게임 안 전쟁 채권 화면과 똑같이 맞추기**: 채권·페이지마다 다른 보상 타일의 위치·모양·크기를 게임과 일치시키는 작업입니다. 다른 페이지를 채권 레이아웃으로 바꾸는 것이 아닙니다. 사용자가 시작하라고 할 때 진행합니다.
- **[사용자가 정한 차후 작업] 방어구 페이지 추가**: 패시브별로 묶어 보여 줍니다. 사용자가 시작하라고 할 때 진행합니다.
- 확인 필요: 채권 패널 왼쪽 빈 공간이 360px보다 좁으면(화면 폭 약 1340px 미만) 항목 상세가 채권 패널 왼쪽 일부를 덮습니다. 이대로 둘지 결정이 필요합니다.
- 실제 기기 확인 필요: 휴대폰 하단 탭 6칸, 360px에서 5×3 보드 가독성·가로 넘침, 항목 상세 전환(뒤로·스크롤 복원). 헤드리스 Chrome 360·1280px 캡처로는 문제가 없었습니다.
- StA-52 예비 탄창: datamine 7, 위키 인포박스 6(revision 140347). 위키가 7로 바뀌면 `db/source`를 다시 받고 `scripts/weapon-infobox.mjs`의 기록된 불일치를 지웁니다.
- Caustic Strain 팩션 안내(위키 revision 140771, 유닛 4종 부위 데이터는 있음): 위키 전술 정보가 비어 있어 무기 추천 근거가 부족합니다. 사용자가 추천 방향을 정하면 진행합니다.
- 전쟁 채권 위키 불일치 '미확인' 21건(`warbondDiscrepancies`, PR #3 설명): 위키가 고쳐지면 다시 받아 빌드합니다.
- 반영하지 않은 것: Eagle Fly By / Orbital Confetti(피해 없음), LAS-44 Nova의 Anti-Tank 태그.

## 사용자가 이미 정한 것 (다시 묻지 않기)

- Elevated Overseer 몸통은 공식 패치 노트 값 450(`anatomyOfficial`). Voteless Heavy 팔 피해 상한 변경은 유지.
- AI 기능(TypeSafe Jev 등)은 사이트에 넣지 않음. 데이터·번역 대량 검사에만 사용.
- 팩션별 장비 평가 기능은 보류. 사용자가 다시 꺼내기 전에는 제안하지 않음.
- 사이트 메인 화면은 전쟁 채권 페이지.
- Exo Experts 한국어 이름은 '외계 전문가(오역)'. 한국어 전쟁 채권 이름은 게임 표기이므로 출처 표기 없음. 화면에 출처·제공자 표기(예: 한국어 이름: 나무위키)를 넣지 않음.
- 넓은 화면의 항목 상세는 닫기(X)만, 좁은 화면은 뒤로 버튼.
- 채권 목록: 구역 구분 없이 한 개의 연속 그리드, 출시일 오름차순(같은 날짜는 기존 순서), 위쪽 종류 칩(전체/기본/프리미엄/전설)은 필터로 유지.
- 채권 상세의 페이지별 보상은 게임과 같은 5×3 타일 배치.
- 전쟁 채권 이미지는 위키 원본에서 표시 크기의 2배 이상(원본보다 키우지 않음).

## 다음 AI에게

- 위키 데이터 갱신: revision 먼저 확인(MediaWiki API `api.php?action=query&prop=revisions`) → `scripts/fetch-*` → `build-*` → `npm run check`.
- wiki.gg는 curl 기본 User-Agent로 받으세요. 브라우저(Mozilla) User-Agent는 차단 페이지가 옵니다.
- 전쟁 채권 갱신: `node scripts/fetch-warbonds.mjs` → `node scripts/build-warbonds.mjs` → `npm run check`. 새 채권은 `db/source/warbond_korean_names.json`에 한국어 이름이 없으면 빌드가 실패하니 사용자에게 이름을 받으세요.
- 전쟁 채권 이미지 갱신(채권 빌드 후): `python3 scripts/tools/fetch-warbond-covers.py` → `... --latest-large` → `python3 scripts/tools/fetch-warbond-item-images.py` → `python3 scripts/tools/test-warbond-item-images.py` → `npm run check` → `node scripts/check-weapons.mjs`. 카드·상세 표지·타일은 `loading="lazy"`, `srcset`은 배너에만.
- 항목 이미지 다운로더는 Node.js, curl, Pillow(WebP)가 필요합니다. 원본 sha1·타일 크기·파일 해시가 같으면 재인코딩하지 않고, 쓰지 않는 `warbond-items` 파일은 지웁니다. `--force`는 전부 재인코딩·SVG 재확인, `--reuse-local`은 네트워크 없이 기존 매핑 검증(누락은 채우지 않음). SVG 안전 검사는 `scripts/svg-safety.mjs`.
- `scripts/tools/fetch-weapon-images.py`는 모든 이미지를 다시 인코딩합니다. 새 이미지·원본이 바뀐 이미지만 커밋하세요.

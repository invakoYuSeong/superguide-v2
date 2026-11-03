# AI 작업 규칙 (모든 AI 공통)

이 파일은 이 저장소에서 일하는 모든 AI(Claude, Codex, Grok 등)가 따르는 고정 규칙입니다.
**작업을 시작하기 전에 이 파일과 [HANDOFF.md](HANDOFF.md)를 먼저 읽으세요.**

## 프로젝트 한눈에 보기

- 헬다이버즈 2 비공식 한국어 팬 가이드 사이트(영어 지원)입니다. 자세한 소개는 [README.md](README.md)를 보세요.
- 저장소: `modocracy/superguide-v2` (기본 브랜치 `master`)
- 사이트: https://modocracy.github.io/superguide-v2/
- **`master`에 push하면 GitHub Actions가 검사 후 바로 실제 사이트에 배포합니다.** 그래서 push는 곧 공개입니다.
- 빌드 도구·의존성 없이 Node.js(20 이상)만으로 돌아가는 정적 사이트입니다.

## 폴더 구조

| 경로 | 내용 |
| --- | --- |
| `dist/` | 배포되는 사이트 전체. `index.html`, `ui/`(화면), `core/`(계산 엔진), `data/`(데이터), `i18n/en/`(영어 사전), `assets/`(이미지) |
| `db/` | 무기 원본 DB. `db/source/*.json`은 위키에서 받아 둔 원본, `db/weapons.js`는 생성 결과. API 계약은 [db/README.md](db/README.md) |
| `scripts/` | 위키 수집(`fetch-*`), 생성(`build-*`), 검사(`test-*`, `check*.mjs`) 스크립트 |
| `server.mjs` | 로컬 미리보기 서버 (http://127.0.0.1:4173) |

## 명령

- 전체 검사: `npm run check` (Windows PowerShell에서는 `npm.cmd run check`)
- 무기 DB 검사: `node scripts/check-weapons.mjs`
- 무기 데이터 재생성: `node scripts/build-weapons.mjs`
- 로컬 미리보기: `npm start`

**코드나 데이터를 바꿨으면 반드시 `npm run check`를 통과시킨 뒤에 끝내세요.**

## 데이터 원칙

- 수치는 [Helldivers Wiki](https://helldivers.wiki.gg/)와 위키 datamine을 따릅니다. 출처 없이 숫자를 손으로 고치지 않습니다. 검사가 실패합니다.
- 확인되지 않은 값은 0으로 채우지 않고 '미확인'·'계산 보류'로 둡니다.
- 생성 파일(`db/weapons.js`, `dist/data/personal-weapons.js`, `dist/data/personal-profiles.js`, `dist/data/enemy-sizes.js`)은 직접 고치지 말고 생성 스크립트로 다시 만드세요. 이 파일들은 줄바꿈이 LF여야 합니다.
- 데이터의 한국어 문구를 바꾸면 `dist/i18n/en/` 사전의 영어도 함께 고쳐야 합니다. `npm run check`가 빠진 영어를 알려 줍니다.
- 한국어 무기 이름은 나무위키 표기를 따릅니다.
- 사용자는 최고 난이도(10) 기준만 신경 씁니다.

## 작업 규칙

- 사용자에게는 **한국어로**, 개발 지식이 없는 사람도 이해하게 쉽게 설명합니다.
- 사용자 판단이 틀려 보이면 그냥 따르지 말고 이유를 들어 의견을 말한 뒤, 최종 결정은 사용자에게 맡깁니다.
- 커밋: 검사가 통과하고 변경 범위가 깨끗할 때만 관련 변경을 **로컬 커밋**합니다. 검사 실패나 엉뚱한 변경이 섞였으면 커밋하지 않습니다.
- 커밋 메시지는 기존 기록처럼 영어 명령문으로 씁니다. 예: `Add the TD-110 Maelstrom vehicle`
- **push는 사용자가 명시적으로 요청할 때만** 합니다(push = 사이트 배포).
- 이 저장소만 작업 범위입니다. 같은 `modocracy` 조직의 다른 저장소, 특히 모드 매니저(`modocracy/modocracy`)는 사용자가 정확히 지목하지 않는 한 절대 건드리지 않습니다.
- 비밀번호·API 키·환경 파일은 열거나 저장소에 넣지 않습니다.
- 대량 삭제·이동, `reset --hard`, 강제 push 같은 되돌리기 어려운 명령은 사용자 요청 없이 하지 않습니다.
- AI의 임시 메모·스크래치 파일은 커밋하지 말고 `.git/info/exclude`에 등록합니다.

## AI끼리 이어서 일하는 방법

1. **한 브랜치·worktree에는 한 AI만 작업합니다.** 두 AI가 같은 파일을 동시에 고치면 충돌합니다. 서로 다른 worktree(각자 별도 브랜치)라면 여러 AI가 병렬로 작업해도 됩니다. 같은 파일을 동시에 고치지 않도록 작업을 맡기는 AI가 작업을 나눕니다.
   병렬 하위 작업 중인 AI는 `HANDOFF.md`를 고치지 않고 결과(목표·바꾼 파일·상태·실패 원인·남은 일)를 맡긴 AI에게 보고하며, `HANDOFF.md`는 통합할 때 맡긴 AI가 한 번 갱신합니다.
2. 시작할 때: 이 파일 → `HANDOFF.md` → `git status`, `git log --oneline -10` 순서로 확인합니다. 커밋되지 않은 변경이 있으면 누가 왜 남긴 것인지 먼저 사용자에게 묻습니다.
3. 끝낼 때: `HANDOFF.md`를 **덮어써서** 최신 상태로 고치고, 작업 변경과 함께 커밋합니다.
4. `HANDOFF.md`는 일지가 아니라 현황판입니다. 지난 내용은 지우고 지금 상황만 짧게 남깁니다. "무엇을 바꿨는지"의 자세한 기록은 git 커밋 메시지에 씁니다.
5. 이 파일(규칙)을 바꿔야 할 것 같으면 혼자 바꾸지 말고 사용자에게 먼저 묻습니다.
6. `.codex-progress.md`는 Codex 개인 작업 로그(git 제외)입니다. 소통 창구로 쓰지 않습니다.

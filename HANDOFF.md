# 인수인계 (현재 상황판)

- 마지막 갱신은 2026-11-23, Antigravity 담당.
- 작업 브랜치는 `fix/fullscreen-details`, PR 대상은 GitHub `master`다. 기준은 PR #12가 반영된 `master`(`8c28ae7`).

## 끝난 일

- PR #12 이후 교차 검증에서 발견된 상세 화면·탄도 그래프 오류 5건을 수정했다.
  - 충돌하는 스트라타젬 필터가 공유 주소의 항목 ID와 `full=1`을 지우던 문제 수정([arsenal.js](dist/ui/views/arsenal.js))
  - 열린 전체 화면에서 함선 모듈 설정(`mod=off`) 변경 시 수치가 바로 다시 계산되도록 수정([item-detail.js](dist/ui/item-detail.js))
  - 뒤로 가기 시 이전 기록의 탄종(`?m=`)을 현재 탄종으로 덮어쓰던 문제 수정([item-detail.js](dist/ui/item-detail.js))
  - 수명이 짧은 탄의 탄도 그래프가 홀수 끝점에서 1m 일찍 잘리던 문제 수정 및 회귀 검사 추가([ballistics-view.js](dist/ui/ballistics-view.js), [test-ballistics.mjs](scripts/test-ballistics.mjs))
  - 전체 화면의 `×` 닫기 버튼이 패널 축소 대신 상세 닫기로 동작하도록 분리(Esc는 패널 복귀 유지, [main.js](dist/ui/main.js))
- 저장소 검사 24종, 무기 DB 107개 검증, 헤드리스 크롬에서 5건의 실제 동작 재현·수정을 확인했다.

## 남은 일

- 수정 브랜치 PR 검토·병합 후 자동 배포 결과를 확인한다.

## 사용자가 정한 것

- GitHub 기본 브랜치 `master`는 PR을 통해 반영하며 필수 승인 수는 0명으로 둔다.
- 전체 화면 전환과 복귀는 사용자가 표시한 상세 본문 영역에 둔다.

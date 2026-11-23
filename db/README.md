# Helldivers 2 무기 사양 DB

주무기 55종·보조무기 25종·투척물 23종, 총 103종의 독립 ES 모듈입니다.
`weapons.js`는 `scripts/build-weapons.mjs`가 로컬 JSON만 읽어 생성합니다.
`weapons`와 `weaponsSource`를 export합니다. 같은 생성기가 배포용 `dist/data/`의 개인 무기 표시 데이터와 전투 프로필도 생성하며, 브라우저는 `db/` 원본을 가져오지 않습니다.

## 개인 무기 전투·비교·편성 API (단계 1–3)

생성 명령은 `node scripts/build-weapons.mjs`입니다. 아래 세 파일은 로컬 원본만으로 생성되고 LF·생성 헤더를 유지합니다. `--stdout <경로>`로 파일을 쓰지 않고 해당 출력만 재생성할 수 있습니다. 경로 생략 시 기존처럼 `db/weapons.js`를 출력합니다. `npm run check`의 `test-personal.mjs`가 세 출력 모두를 두 번 바이트 비교합니다.

- `db/weapons.js`: 기존 전체 사양과 원본 연결을 보존합니다. 기존 출력 바이트는 바꾸지 않았습니다.
- `dist/data/personal-weapons.js`: `personalWeaponsCheckedAt`, `personalWeaponsSource`, `personalWeapons`. 표시용 103종이며 공격 트리·충전 원문은 제외합니다. `image`는 인포박스 파일명이며 `{{PAGENAME}}`만 실제 위키 제목으로 치환합니다. `sourceRevision`은 페이지 revision입니다. 개별 사양과 variant의 null은 원본 공백 그대로입니다.
- `dist/data/personal-profiles.js`: 생성된 `personalProfiles`, `personalUnsupported`. 공개 진입점 `dist/core/personal-combat.js`에서 재수출하며 `personalGroups = [{id:'primary',name:'주무기'}, {id:'secondary',name:'보조무기'}, {id:'throwable',name:'투척물'}]`도 제공합니다.

### 플레이어 표시 필드

`personalWeapons`의 각 항목은 추가로 다음 필드를 제공합니다. **UI 설명에는 `playerNotes`, 변형 제목에는 `variant.displayName`을 사용하세요.** 기존 `notes`와 variant `name`은 개발자 검증·원본 추적용으로 보존하며 화면에 그대로 출력하지 않습니다.

- `playerNotes: string[]`: 필요한 플레이어 설명만 담은 짧은 한국어 문장입니다. 수치 충돌, 충돌/근접/시간 선택 신관, 파편·산탄 명중, 분사·빔·충전 한계, 하부 무기 전환을 안내합니다. 평범한 무기는 빈 배열입니다. 재장전 필드명·원본 연결·분류 보정 같은 개발자 메모는 전달하지 않습니다.
- `fuseType: 'timed'|'impact'|'proximity'|'selectable'|'none'|null`: 투척물 인포박스의 명시된 표현만 해석합니다. `N/A`는 none, 미제공/해석 불가는 null입니다. 총기류는 null입니다. Shield의 `0s`는 timed/0이며 none으로 바꾸지 않습니다.
- `fuseOptions: number[]`: selectable일 때 선택 가능한 초 단위 값입니다. Dynamite는 `[5,15,60]`이며 단일 `fuse`는 여전히 null입니다. 다른 종류는 빈 배열이며 timed 시간은 기존 `fuse`를 사용합니다. 범위나 모호한 복수값의 양 끝을 선택 시간으로 추정하지 않습니다.
- `variants[].displayName: string`: '기본 사격', '파편', '폭발', '하부 유탄 발사기', '기절탄' 등의 표시명입니다. 원본 탄체와 선택 모드의 연결을 확인하지 못한 경우 '탄체 피해 1'처럼 중립적인 이름을 사용합니다. 이를 독립적인 선택 모드라는 뜻으로 해석하지 마세요. 선택 가능한 계산 모드는 `personalProfiles[id].modes`입니다.

전투 프로필은 `{source, sourceRevision, note, checkedAt, modes}`이며 기존 `solveMatchup`에 그대로 전달합니다. 모드는 `{id,name,standard,durable,ap,explosion,explosionDurable,explosionAp,innerRadius,radius,delivery,unit,magazine,ammoPerShot}` 또는 `{id,name,unsupported}`입니다. 숫자를 확인하지 못한 모드를 정상 피해로 추정하지 않습니다. 원본에 충돌 폭발 연결 자체가 없는 탄체만 엔진상 폭발 0으로 표현하며, 폭발 연결은 있지만 수치가 없으면 미지원입니다.

지원 86종에는 명중 수 조건이 필요한 무기도 포함됩니다. 미지원 17종은 다음과 같습니다.

| 이유 | 무기 ID |
| --- | --- |
| 분사 빈도·접촉 시간 미확인 | torcher, crisper |
| 빔 노출 시간·발 단위 미확인 | trident, scythe, dagger |
| 충전별 최종 내구·관통·배율 미확인 | purifier, accelerator-rifle, loyalist |
| 열 단계 전환·탄체 연결 미확인 | double-edge-sickle |
| 피해 없는 지원 장비 또는 공격 레코드 없음 | stim-pistol, urchin, stun, smoke, smokescreen, shield |
| 전격 반복·부위 명중 수 미확인 | arc |
| damage 항목의 투척 연결·타격 단위 미확인 | throwing-knife |

모든 피해는 동일 부위에 최대 피해가 닿는 이론값이며 AP는 ap1을 사용합니다. 거리·입사각·도탄·접근 가능성·시간·DoT·상태이상·여러 부위 동시 피해는 계산하지 않습니다. 근접은 엔진이 일반 타격을 표현할 수 있어 6종을 지원하되, 높은 부위/비행 적에게 실제 접근 가능한지는 보장하지 않습니다. Thermite 등은 확인된 폭발만, Breacher는 직격과 붙은 뒤 같은 부위에서 터지는 지연 폭발(2,000·AP7)을, Pyrotech/Melta Mine는 주폭발만 계산하며 제외 성분은 모드 note에 명시합니다.

명중 수 조건은 `hitCondition.kind`의 pellets(산탄), arcs(전격), bomblets(자탄), shrapnel(파편)으로 구분합니다. 모두 `defaultPct`(설정한 기본 백분율)와 `default = Math.max(min, Math.round(max * defaultPct / 100))`를 제공합니다. **산탄·전격은 100%, 자탄·파편은 20%**입니다. Blitzer는 5/5, De-Escalator는 10/10, Airburst의 flak/cluster는 각각 5/25, Eruptor는 6/30, Frag와 Lure Mine는 7/35, Pineapple은 4/18입니다. 산탄 전탄 기본값은 하부 산탄총, Halt의 두 탄종, 여러 총열 동시 사격과 Variable 일제 사격에도 적용됩니다. 이는 제품의 기본 가정이며 관측한 실제 명중률이 아닙니다.

UI는 `withHitAssumption(mode,{hitCount:mode.hitCondition.default})`로 기본값을 적용할 수 있습니다. 10–100% 슬라이더의 선택도 같은 반올림 규칙으로 정수 hitCount를 전달하며 명시한 수가 기본값보다 우선합니다. 엔진의 raw 모드에는 자동으로 이벤트를 넣지 않으며 기존 호출 규칙을 유지합니다. 파편 0개를 명시하면 파편 피해만 제외하고, 양수면 그 수의 파편을 별도 피해 이벤트로 더합니다. 파편은 선택 모드가 아닙니다. 주탄 직격 여부는 투척 폭발·오토캐넌 대공포탄의 근접 기폭은 false, Eruptor 탄체는 true이며 `primaryHit`/`bombletDirect` 선택은 자탄 모드에서만 사용합니다. 자탄의 기본 전달 조건은 주탄 폭발 포함·직격 제외, 자탄 폭발 포함·직격 제외이며, 아래의 W.A.S.P.처럼 모드별 기본값을 명시할 수 있습니다. 기본 명중 수 적용 시 명시한 전달 조건은 보존합니다. 같은 발의 남은 이벤트가 파괴된 장갑 뒤로 통과하는지는 기존 엔진처럼 보류합니다.

`dist/core/explain.js`의 `assumptionSummary(withHitAssumption(mode,{hitCount}))`는 전탄이면 '펠릿 11개가 모두 이 부위에 명중 (전탄 명중 가정)', 부분 명중이면 '펠릿 11개 중 6개 명중 (약 55%)'로 표시합니다. 전격·자탄·파편도 개수와 비율을 표시하고 설정 기본값과 같으면 '(기본 가정)'을 붙입니다. 예: '전격 5회 모두 이 부위에 명중 (기본 가정)', '파편 35개 중 7개(20%)가 이 부위에 명중 (기본 가정) + 주폭발'. 비율은 정수 명중 수 / 최대 개수이며, Pineapple 4/18은 약 22%로 표시하되 기본 슬라이더 값 `defaultPct`는 20입니다. Eruptor는 주탄 직격도 표시하고, 파편 0개는 피해 제외를 명시합니다. 미적용/잘못된 명중 수는 종류별 선택 안내를 표시합니다. `assumptionTag`는 산탄 전탄이면 '전탄 명중 가정', 그 외 기본값이면 '파편 20% 기본 가정' 같은 태그를 반환합니다. Variable 일제 사격에는 `hitCondition.projectileName='탄환'`이 있어 산탄 펠릿으로 부르지 않습니다.

개인 투척물 모드는 표시용 `unitLabel`을 추가 제공합니다. 수류탄은 '수류탄', 두 지뢰는 '지뢰', Dynamite는 '다이너마이트'입니다. `unitOf(mode)`는 `{unit:'개',noun:'수류탄 개수',one:'수류탄 1개'}`, `countText({hits:2},mode)`는 '수류탄 2개'를 반환합니다. 기존 C4의 장약 단위와 기존 지원 무기의 숫자/단위 표시는 유지합니다. 이 표시 필드는 계산에는 영향을 주지 않습니다.

Arbitrator/One-Two/Stoker는 하부 무기가 별도 `underbarrel` 모드이며 Stoker 분사는 모드 미지원입니다. Halt는 독립 8발 탄창의 `flechette`/`stun`입니다. Bushwhacker/Double Freedom의 `all-barrels`는 각각 3/2발, Variable `volley`는 7발 소비를 명시하고 명중 수를 가정합니다. Variable `total`은 잔탄 수 미확인으로 모드 미지원입니다. Warrant/Missile Pistol은 `unguided`를 계산하며 유도 착탄 제한이 미검증인 `guided`는 미지원입니다. 피해가 같은 자동·반자동·점사는 기본 모드에서 탄체 1발 단위로 계산하며 UI 표시용 `fireModes`는 원본을 유지합니다.

### 오토캐넌 대공포탄·W.A.S.P. 명중 가정

두 지원 무기는 `db/source/weapons_data.json` revision 136739(수집일 2026-09-27)의 연결을 검증해 `combat-data.js`에 반영합니다. 브라우저에서 DB JSON을 읽지 않으며 `scripts/test-personal.mjs`가 매번 주탄→폭발→파편/하위 탄→폭발의 수치와 연결을 원본에 대조합니다. 프로필 또는 모드에 `source`, `sourceRevision`, `checkedAt`, `sourceRecords`를 보존합니다.

- `weaponProfiles.autocannon.modes`의 기존 `flak`: `AC-8_P1` 직격 150/150·AP2, `AC-8_P1_IE` 폭발 190/190·AP3·중심 2m/외곽 7m, `AC-8_P2` 파편 110/35·AP3×30개입니다. 파편에는 연결된 폭발이 없습니다. `hitCondition={kind:'shrapnel',min:0,max:30,default:6,defaultPct:20}`이며 **근접 기폭 계산은 주탄 직격을 제외하고 주폭발과 파편만 반영**합니다. 직격 원본 수치는 보존하되 `delivery:'explosive'`, `directKind:'none'`으로 계산·표시에서 제외합니다. APHET 모드는 변경하지 않습니다.
- `weaponProfiles.wasp.modes[0]`의 ID는 **`submunitions`**입니다. `StA-X3_P1` 주탄 20/2·AP0, 주폭발 `StA-X3_P1_IE` 600/600·AP3·중심 3m/외곽 5m, 하위 미사일 `StA-X3_P` 200/200·AP6×7개, 각 하위 폭발 `StA-X3_P_IE` 600/600·AP3·중심 2.5m/외곽 5m입니다. 분산 각도 25도는 `coneAngle`로 보존하며 명중률로 환산하지 않습니다. `hitCondition={kind:'bomblets',min:0,max:7,default:1,defaultPct:20,defaultPrimaryHit:'none',defaultBombletDirect:true}`입니다. 20%를 반올림한 1/7이므로 실제 개수 비율은 약 14%입니다.
- W.A.S.P. 기본 계산은 **하위 미사일 1개의 직격+폭발**, 주탄 피해 제외입니다. 주탄의 근접 기폭 거리 12m가 피해 반경 5m보다 커 주탄 폭발이 같은 부위에 닿는다고 기본 가정하지 않습니다. `primaryHit`을 명시하면 주탄 포함 조건을 선택할 수 있습니다. `hits`는 주탄 발사 횟수이고 탄창 소모량은 확인하지 않아 `magazine`/`magazinesNeeded`는 null입니다.
- W.A.S.P.는 전체 미지원 목록에서 제거하고 모드별로 구분합니다. `submunitions`는 명중을 가정한 피해 계산이며 실제 유도 가능 대상을 보장하지 않습니다. `guided`는 한국어 이유를 가진 미지원 모드입니다. 확인되지 않은 유도 대상 목록에 Spear의 제한을 재사용하거나 특정 게임 내 사격 모드/탄약 소비량을 추정하지 않습니다.

**프런트엔드 연결:** `withHitAssumption`은 인수가 생략된 경우 `hitCondition.defaultPrimaryHit ?? 'blast'`, `hitCondition.defaultBombletDirect ?? false`를 사용합니다. 비교·편성도 동일합니다. 따라서 UI의 모드별 초기 상태도 이 값을 읽거나 해당 옵션을 생략해야 합니다. 공통 `'blast'/false`를 명시하면 실제 사용자 선택으로 취급되어 W.A.S.P.의 기본값을 덮어씁니다. 숫자 기본값 자체는 기존처럼 호출자가 적용합니다. Airburst 등 기존 모드는 전달 기본값이 바뀌지 않습니다. 비교 캐시는 생략된 모드별 기본값과 명시적 반대값을 구분합니다.

**Legacy 검증 범위:** 현재 golden에서 오토캐넌 flak은 수치가 없는 미지원 모드였고, W.A.S.P. 전투 프로필은 존재하지 않았습니다. golden 파일은 수정하지 않습니다. `test-parity.mjs`는 추가 명중 조건에 0개를 적용하고 flak의 당시 미지원 상태를 명시적으로 재현하며, 모든 해당 golden 행이 실제 미지원 상태인지 검사하여 수치 결과를 우회하지 못하게 합니다. W.A.S.P.가 golden에 없다는 것도 검사합니다. 새 flak은 파편 0개일 때의 순수 폭발 계산을 84개 적×보호막 2조건에서 별도로 대조합니다. 새 모드의 원본 수치, 기본 경로, 명중 수 및 전달 조건 변경은 개인 무기 테스트에 추가하여 비교·편성·뷰까지 검사합니다.

### 비교: `dist/core/compare.js`

- `resolveAttack(weaponId) → {weapon, kind, profile, unsupported}`. kind는 `personal`/`support`, 알 수 없는 ID는 null입니다. 비지원 무기 스트라타젬도 보존하되 profile=null과 한국어 이유를 제공합니다.
- `compareAttacks(enemy, [{weaponId,modeId}], {partId,shieldCleared,assume}) → {entries,parts}`. modeId 생략은 첫 모드, 잘못된 ID는 미지원입니다. parts는 공통 `{id,name,conditional}` 목록입니다.
- entries에는 `weaponId,modeId,weaponLabel,modeLabel,weapon,kind,profile,mode,status,reason,route,best,rows,hits,outcome,part,conditional,assumption,lowerBound,shieldCleared,shieldAssumed,verified,magazinesNeeded,defaulted,defaultAssumed,fragmentsExcluded,allPelletsAssumed` 등이 있습니다. status는 `route`/`assume`/`none`/`unsupported`입니다. 특정 부위의 파괴 경로도 route로 반환하지만 `verified`는 지원하는 기본 조건 아래 선행 조건 없는 치명 경로에서만 true입니다. **모든 hitCondition의 설정 기본 명중 수는 유효한 경로로 인정하고 가정을 표시합니다.** 파편 0개를 명시한 경우도 피해 성분을 제외한 보수적 계산이므로 치명 경로가 있으면 route/verified=true입니다. 이외의 명시적 명중 수는 기존처럼 assume/verified=false이며 결과 횟수는 반환합니다. 재생을 무시한 하한값도 verified=false입니다. verified는 가정한 수가 실제로 맞는다는 보장이 아닙니다.
- 비교·편성·교체 추천은 명중 수가 미제공/null/빈 문자열이면 default를 적용합니다. 음수·범위 초과 등 잘못된 명시값은 기본값으로 바꾸지 않고 보류합니다. `defaulted`는 기본값을 자동 적용했을 때만 true입니다. `defaultAssumed`는 유효하게 적용된 수가 설정 기본값과 같을 때 `{kind,count,max,pct}`이며, pct는 반올림 전 설정 `defaultPct`입니다. 직접 기본값과 같은 수를 고른 경우도 동일한 객체와 경로 인정 규칙을 쓰되 defaulted=false입니다. 그 외에는 defaultAssumed=null입니다. `fragmentsExcluded`는 파편 0개를 **명시적으로** 선택한 유효 계산에만 true, 호환 필드 `allPelletsAssumed`는 유효한 pellets 전탄 명중에만 true입니다. assumption 객체의 존재만으로 미검증 결과라고 판단하지 말고 verified 및 가정 플래그를 함께 사용하세요. 명중 수 외 주탄/자탄 직격 조건은 기존 assumption 객체에 보존되며 defaultAssumed는 이 조건을 대체하지 않습니다.
- `assume`는 기존 명중 조건 객체 또는 `{'weaponId:modeId': 조건객체}`입니다. 방패/보호막은 기본적으로 미해제이며 명시적인 `shieldCleared:true`는 prerequisite를 별도 `shieldAssumed`로 표시합니다. Spear가 락온하지 못하는 적은 계산 미지원입니다.
- hits는 펠릿 수가 아닌 발사 횟수입니다. `magazinesNeeded = ceil(hits / floor(magazine / ammoPerShot))`; 산탄 한 발은 탄약 한 발, 다중 총열은 명시된 탄약 소비량을 사용합니다. 열 무기·투척물·지원 무기의 미제공 탄창은 null이며 추정하지 않습니다. 첫 탄창을 포함한 필요 탄창 수이며 재장전 횟수와 다릅니다.
- 적 객체/프로필 모드별 WeakMap과 최대 64가지 조건 캐시를 사용하고 반환 경로를 복제하여 호출자 변경이 캐시를 오염시키지 않게 합니다.

### 편성: `dist/core/loadout.js`

- 편성 정규형은 `{primary,secondary,throwable,stratagems:[id,id,id,id],faction}`입니다. 빈 칸은 `''`입니다. UI 축약형 `{p,s,g,st,f}`도 입력 가능합니다.
- `encodeLoadout(loadout) → string`: `?` 없는 URL query. `decodeLoadout(query) → 정규형`: query 문자열, 전체 `#/gear?...`, URLSearchParams, route.query 객체를 허용합니다. 잘못된 슬롯 분류·알 수 없는 ID·중복 스트라타젬·5번째 이후 칸을 버리며 빈 칸 위치를 보존합니다. 진영 생략/오류는 terminid입니다.
- `loadoutFactions = [{id,name,enemyIds}]`: 기존 factionSides의 한국어 이름, 기본 경/중/중장갑·공중 위협 8종, 기존 각 변종 가이드의 마지막 유닛(대개 상위 위협)을 중복 제거해 선택합니다. 테르미니드 11종, 오토마톤 11종, 일루미닛 10종입니다. 출현 확률·난이도별 구성의 추정이 아닌 점검 목록입니다.
- `loadoutCoverage(loadout,factionId,options) → {faction,rows,gaps,notComputable}`. row는 `{enemyId,enemyName,enemy,best,status,perSlot,reason}`이고 status는 route/gap입니다. best는 비교 결과에 `{slot,slotIndex,weaponId,modeId,partId,partName,modeName,unit}`를 더합니다. perSlot의 각 항목은 `{slot,slotIndex,weaponId,best,modes}`입니다. gaps는 검증된 치명 경로가 없는 row 목록, notComputable은 `{slot,slotIndex,weaponId,id,reason}` 목록입니다. 서로 다른 무기를 합산하지 않습니다. 단일 부위로 처치할 수 없으면 아래의 명시적 개수 기반 순차 누적 경로를 사용합니다.
- `suggestFixes(loadout,factionId,options) → [{enemyId,enemyName,replacements}]`. 공백마다 같은 종류의 각 슬롯 위치에 최대 `options.limit`개(기본 3, 최대 20; `maxPerSlot` 별칭)의 교체안을 줍니다. 스트라타젬은 지원 무기만 추천합니다. 각 후보는 비교 결과 + slot/slotIndex/replaces이며 hits, 경로 단계 등 조건의 단순성, 즉사 여부, 안정적인 ID 순으로 정렬합니다. 같은 횟수·단계 수라면 명중 수 기본 가정이 있는 경로는 그런 가정이 없는 경로 뒤에 둡니다. 이미 편성한 스트라타젬은 중복 추천하지 않습니다. 설정 기본값 외의 명중 수 가정(명시적 파편 0개 제외), 조건부, 재생 하한값은 추천으로 공백을 메우지 않습니다. 모든 설정 기본값 및 명시적 파편 0개 제외 경로는 편성 및 추천에 포함합니다.
- `loadoutView(loadout,factionId,options)`는 프런트엔드 연결용 추가 API입니다. coverage row에 fixes를 붙이고 교체 슬롯 키만 p/s/g/st0..st3으로 바꿉니다.

편성 UI에서 사용하는 정확한 반환 구조는 아래와 같습니다. 빈 슬롯은 perSlot에 없고, 알려진 미지원 장비는 perSlot과 notComputable에 모두 있습니다. 일부 모드만 미지원인 장비는 notComputable에 넣지 않고 `perSlot[].modes`에 모드별 이유를 남깁니다. `row.best`는 검증된 대응만 반환하며, `perSlot[].best`는 검증 경로가 없으면 설명용 가정/보류/미지원 결과일 수 있습니다.

```ts
type Slot = 'primary' | 'secondary' | 'throwable' | 'stratagems';
type Position = { slot: Slot; slotIndex: null | 0 | 1 | 2 | 3; weaponId: string };
// slotIndex: 개인 무기는 null, 스트라타젬은 0부터 시작하는 칸 번호.
type Answer = Position & {
  weapon: object | null; kind: 'personal' | 'support' | null;
  profile: object | null; unsupported: string | null;
  mode: object | null; modeId: string | null;
  weaponLabel: string; modeLabel: string | null; modeName: string | null;
  status: 'route' | 'assume' | 'none' | 'unsupported';
  reason: string | null; reasonCode?: string | null;
  route: CombatRoute | null; best: CombatRoute | null; rows: CombatRoute[];
  hits: number | null; outcome: string | null; part: object | null;
  partId: string | null; partName: string | null; resultLabel: string | null;
  unit: string; conditional: boolean; lowerBound: boolean;
  assumption: { count: number; primaryHit: string; bombletDirect: boolean } | null;
  shieldCleared: boolean; shieldAssumed: boolean; verified: boolean; oneShot: boolean;
  defaulted: boolean; fragmentsExcluded: boolean; allPelletsAssumed: boolean;
  defaultAssumed: {kind: 'pellets'|'arcs'|'bomblets'|'shrapnel'; count: number; max: number; pct: number} | null;
  accumulated: boolean; steps: AccumulationStep[]; summary: string | null;
  magazinesNeeded: number | null;
};
// CombatRoute는 solveMatchup의 원본 부위 경로:
// {target, stages, hits, outcome, conditional, notes, via?, reason?, detail?, lowerBound?}.
type CoverageRow = {
  enemyId: string; enemyName: string; enemy: object;
  size: 'small' | 'medium' | 'large' | 'massive' | null;
  isLarge: boolean; oneShot: boolean;
  best: Answer | null; status: 'route' | 'gap'; reason: string | null;
  perSlot: (Position & { best: Answer; modes: Answer[] })[];
};
type Coverage = {
  faction: {id: string; name: string; enemyIds: string[]} | null;
  rows: CoverageRow[];
  gaps: CoverageRow[]; // ID 목록이 아닌 공백 row 목록
  notComputable: (Position & {id: string; reason: string})[];
  reason?: string; // 알 수 없는 진영이면 rows/gaps=[] 및 reason 제공
};
// loadoutCoverage(loadout, factionId?, options?) => Coverage
// suggestFixes(loadout, factionId?, options?) => 다음 배열:
type Fixes = {
  enemyId: string; enemyName: string;
  replacements: (Answer & {replaces: string | null})[];
}[];
```

`options`는 `{partId?, shieldCleared?, assume?, limit?, maxPerSlot?, prioritizeLarge?}`입니다. `limit`는 공백 하나의 각 슬롯 위치별 상한이므로 기본 3개일 때 전체 replacements는 최대 21개입니다. 교체 시 개인 무기는 `loadout[fix.slot] = fix.weaponId`, 스트라타젬은 `loadout.stratagems[fix.slotIndex] = fix.weaponId`를 적용합니다. modeId는 추천의 계산 근거이며 편성 URL에는 무기 ID만 저장합니다. 원본 coverage에는 fixes가 없으므로 UI가 `enemyId`로 합치거나 `loadoutView` 어댑터를 사용할 수 있습니다. 어댑터의 `rows[].fixes`만 슬롯 키가 p/s/g/st0..st3이며, `gaps` 및 `perSlot`은 정규 슬롯명을 유지합니다.

비교의 모든 `entries`와 편성의 모든 `Answer`(슬롯별 모드·교체 추천 포함)는 `oneShot: boolean`을 제공합니다. 정확한 조건은 `verified && hits === 1`입니다. 발·개·회 등 단위와 무관하며, 엔진이 치명 경로로 인정하는 출혈·격추도 포함하므로 즉사만 뜻하지는 않습니다. 한 번의 비치명 부위 파괴, 미지원·미선택 가정·재생 하한 결과는 false입니다. 승인된 전탄 명중 기본값은 포함하되 `allPelletsAssumed`를 함께 표시해야 하며, 보호막 해제 가정도 기존 `shieldAssumed`에 남습니다. CoverageRow의 `oneShot`은 `best?.oneShot ?? false`입니다.

`loadoutCoverage`와 `loadoutView`의 `options.prioritizeLarge === true`는 **대형/초대형이면서 oneShot=false인 행**을 먼저 둡니다. 대응 무기가 없는 gap도 이 우선 그룹에 포함합니다. 우선 그룹 내부와 나머지 그룹 내부는 각각 기존 가이드 순서를 유지하며, 크기 등급이나 타격 수로 추가 정렬하지 않습니다. 생략/false면 전체 기존 순서를 그대로 유지합니다. `gaps`와 `suggestFixes`도 해당 행 순서를 따릅니다. 가이드 원본 배열은 변경하지 않습니다.

`dist/core/route.js`는 gear 뷰와 경로 주석을 추가하고 기존 hash 변환을 유지합니다. 검사에는 수계산(Liberator/헌터 머리, Senator/데버스테이터 머리, Frag/헌터 본체 폭발), 산탄 가정, 탄창 경계, 원본 대응, URL 왕복·잘못된 입력, 편성 공백, 추천 재적용·결정성, 생성물 최신성 및 기존 legacy parity가 포함됩니다.

## 여러 부위의 순차 누적 경로

`dist/core/accumulate.js`의 `solveAccumulation(enemy, mode, options?)`는 기존 `solveMatchup`의 결과를 바꾸지 않는 추가 계산입니다. 해당 무기 모드에 단일 부위 치명 경로가 있으면 항상 null입니다. 반환값은 다음 구조 또는 null입니다.

```ts
type AccumulationStep = {
  partId: string; partName: string;
  instances: number;       // 실제로 사격한 해당 부위 개수. 마지막은 미파괴 상태일 수 있음
  hitsPerInstance: number; // 이 step 안의 각 부위에 쏜 횟수
  hits: number;           // instances * hitsPerInstance
  mainDamage: number;     // 이 step의 본체 전달 피해 합계. 마지막 공격의 초과 피해 포함
};
type Accumulation = {
  hits: number; outcome: 'kill' | 'bleed';
  steps: AccumulationStep[]; accumulated: true;
  summary: string; notes: string[];
};
```

`noFatalPart(enemy)`도 export합니다. 부위 및 노출 후 부위에 kill/bleed/down 효과나 mainOnly가 하나도 없는지를 보는 구조적 검사이며, 무기별 관통 여부를 계산하지 않습니다. 빈/잘못된 적은 false입니다. true여도 본체로 충분한 피해를 전달하는 단일 부위 경로가 있을 수 있습니다. `ACCUMULATION_SUMMARY`는 '덩어리를 하나씩 터뜨리며 본체를 깎는 누적 경로입니다.'라는 플레이어용 한국어 상수입니다.

현재 개수를 추가한 적은 Fleshmob뿐입니다. `combat-data.js`가 기존 검토 원본 `combat-enemies-expanded.js`의 sourcePart 괄호 숫자를 읽어 `parts[].count`로 보존합니다. revision 135182의 Head Chunks (6), Stomach Chunks (2), Arms (4), Legs (2)를 사용하며 원본이나 기존 부위 피해 수치는 수정하지 않습니다. count가 없는 부위를 한 개로 추정하지 않습니다.

계산은 `hitDamage`의 장갑·내구·폭발 규칙과 기존 엔진의 전달 반올림을 사용합니다. 부위 하나를 파괴할 때까지의 **평균 발당 본체 전달 피해**가 큰 종류부터 공격하고, 동률이면 원본 부위 순서를 유지합니다. 체력·전달 상한은 매 부위마다 새로 시작합니다. `overflowCap`이 true면 기존 엔진처럼 부위 체력과 명시된 추가 체력의 합으로 전달량을 제한하며, false면 파괴하는 공격의 초과 전달 피해도 유지합니다. 본체로 우회하는 폭발은 한 번만 더하고 전달 상한 밖에 둡니다. 파괴 시 명시된 추가 본체 피해도 한 번만 반영합니다.

한 번의 공격은 한 부위에만 적용합니다. 부위가 파괴되면 같은 발의 남은 펠릿·파편은 버리며 다음 발부터 다른 부위를 노립니다. 폭발의 여러 부위 동시 피해는 포함하지 않습니다. 본체 체력이 소진되는 즉시 멈추며, 마지막 부위에 필요한 횟수가 다르면 별도 step으로 반환합니다. 같은 종류·같은 발수의 연속 부위들은 하나의 step으로 묶습니다. 이 선택 방식은 검증 가능한 순차 경로이며 모든 순열 중 최저 발수라는 보장은 없습니다.

지원 대상은 count와 전달 규칙이 확인된 독립적인 break 부위입니다. 개수·체력·전달량 미확인, 전달 상한 미확인, 선행 조건, 노출 단계, 별도 본체/장치 등은 제외합니다. 빔·재생 적은 누적을 지원하지 않습니다. 적용 가능한 부위를 모두 사용해도 본체를 소진하지 못하거나 총 20,000회를 넘으면 null입니다. null은 처치 불가능이라는 뜻이 아닙니다. `options`는 기존 피해 함수의 `shieldCleared`, `directHit`, `excludeMainExplosion`, `blastDistance`를 받습니다. `partId`가 있으면 순차 누적을 하지 않습니다. 명중 수 조건이 있는 mode는 직접 호출 전에 `withHitAssumption`으로 적용해야 하며, 이 함수 자체가 기본값을 선택하지는 않습니다.

`compareAttacks`는 기존 최적 단일 부위 경로가 없을 때만 누적 결과를 캐시하고 선택합니다. `partId` 선택은 항상 기존 단일 부위 결과를 유지합니다. 모든 비교 Answer에 `accumulated`(기본 false), `steps`(기본 []), `summary`(기본 null)를 추가합니다. 누적 경로의 `route`/`best`에는 위 Accumulation에 `{target:{id:'accumulation',name:'여러 부위 순차 타격'}, stages:[], via:'main', conditional:false}`를 더합니다. 이 target은 실제 해부 부위가 아니며 공통 `parts` 목록이나 선택 가능한 partId로 추가하지 않습니다. 기존 `rows`는 단일 부위 결과만 보존합니다. **누적 설명은 `steps`/`summary`/`route.notes`를 사용하고 빈 stages를 단일 부위 계산처럼 표시하지 마세요.**

편성·편성 뷰·교체 추천의 Answer도 같은 필드를 그대로 전달합니다. 검증된 누적 경로가 있으면 gap을 해소하고, 기존 가정 판정과 `oneShot = verified && hits === 1`을 유지합니다. 같은 발수에서는 여러 부위를 옮겨 조준하는 복잡도를 순위에 반영합니다. 산탄 전탄 명중 등의 기존 가정 플래그는 누적에서도 계속 표시해야 합니다. 수계산 검증값은 Fleshmob의 오토캐넌 APHET **9발/본체 피해 5013**, 기관총 **54발/5058**이며, 두 경우 모두 기존 단일 부위 엔진은 처치 경로 없음입니다.

## 적 크기 분류 API

`node scripts/build-enemy-sizes.mjs`는 제공된 `db/source/wiki_enemy_sizes.json`만 읽어 `dist/data/enemy-sizes.js`를 생성합니다. `--stdout`은 파일을 쓰지 않고 같은 모듈을 출력합니다. 생성 헤더와 LF를 유지하며 시각·네트워크에 의존하지 않습니다. 수집기 `scripts/fetch-enemy-sizes.mjs`는 별도이며 오프라인 빌드나 검사에서는 실행하지 않습니다.

전투 데이터 각 적의 `source` URL에서 위키 페이지 제목을 추출하고 URL 인코딩 및 밑줄만 해제한 뒤, Small/Medium/Large/Massive Enemies 분류의 제목과 정확히 대조합니다. 이름·체형으로 추정하거나 별칭을 보정하지 않으며 중복 분류 제목은 빌드 오류입니다. 현재 전투 항목은 **84개, 서로 다른 출처 페이지는 82개**입니다. 이 중 **81개 항목(79개 페이지)**을 연결하고, `obtruder`, `veracitor`, `gatekeeper` 3개는 분류에 없어 null과 한국어 이유를 기록합니다. Bile Titan은 massive, Hulk Scorcher는 large입니다.

생성 모듈의 export:

- `enemySizesCheckedAt`: 스냅샷의 retrievedAt.
- `enemySizesSource`: `{source, file, categories}`. categories는 크기 키와 위키 분류명 대응입니다.
- `enemySizes`: 모든 전투 적 ID를 키로 하는 `{[id]: 'small'|'medium'|'large'|'massive'|null}`.
- `enemySizeEvidence`: `{[id]: {title,source,category,pageid,revision}}`. 미분류도 title/source를 보존하고 category/pageid/revision은 null입니다.
- `unmappedEnemySizes`: 미분류 ID별 한국어 이유. 분류에 없다는 것은 크기 미확인이며 소형이라는 뜻이 아닙니다.

브라우저 공개 진입점 `dist/core/enemy-size.js`는 `enemySize(enemyOrId)`와 `isLargeEnemy(enemyOrId)`, `SIZE_NAMES = {small:'소형',medium:'중형',large:'대형',massive:'초대형'}`를 제공합니다. 인수는 적 ID 문자열 또는 id를 가진 적 객체입니다. 미분류/알 수 없는 입력은 각각 null/false이며, isLargeEnemy는 large 또는 massive일 때만 true입니다. `enemySizesCheckedAt`, `enemySizesSource`, `unmappedEnemySizes`도 재수출합니다. 편성 행의 `size`, `isLarge`는 이 함수를 사용합니다.

이미 `scripts/check.mjs`에 연결된 `scripts/test-personal.mjs`가 모든 적의 분류 또는 명시적 미분류, 원본 제목·분류·revision 대응, 중복 거부, 입력 순서 무관성, 생성 파일 LF 및 두 번의 바이트 동일성을 검사합니다. 한 번 공격의 판정과 편성 우선 순서도 여기서 검증합니다.

## 출처와 재생성

- `source/weapons_data.json`: [위키 공격 모듈](https://helldivers.wiki.gg/wiki/Module:Decodedata-Attacks/weapons_data.json), revision **136739**, 수정 시각 **2026-09-25T22:34:05Z**, 수집일 **2026-09-27**.
- `source/wiki_categories.json`: [위키 무기 분류](https://helldivers.wiki.gg/wiki/Category:Weapons), 수집일 **2026-09-27**. 분류 전체의 단일 revision은 없으며 각 멤버의 revision을 `sourceRevision`으로 보존합니다.
- `source/wiki_pages.json`: 같은 로스터 103종의 MediaWiki 원문 스냅샷. `pages[영문 제목]`에 `source`, `revision`, `revisionTimestamp`, `retrievedAt`, `wikitext`를 보존합니다. 수집기는 지정 User-Agent로 Node fetch를 사용하고, 요청 사이 250ms를 기다리며 최대 50개 제목씩 순차 조회합니다. 실패하면 기존 원문을 보존하고 `attemptedAt`/`error`를 기록합니다. 이전 원문도 없으면 원문·리비전·수집일은 null입니다. 수집 실패를 성공으로 간주하지 않으며 명령은 종료 코드 1을 반환합니다.
- `source/korean_names.json`: [나무위키 무기 문서](https://namu.wiki/w/HELLDIVERS%202/%EB%AC%B4%EA%B8%B0)와 주 무기·보조·투척 하위 문서의 압축된 제목 증거입니다. 각 페이지에는 `source`, `status`, `modifiedAt`, `retrievedAt`, `headings`만 저장합니다. HTML이나 중복 이름 사전은 저장하지 않습니다. `fetch-weapons-source.mjs`의 `extractHeadings`/`compactKoreanPage`를 미래 수집과 기존 HTML의 일회성 로컬 변환에 동일하게 사용했습니다. HTML 태그 제거·엔티티 해독·숫자 절 번호와 `[편집]` 접미사 제거 후 h2–h6 절 제목을 순서대로 보존합니다. 수정 시각이 미제공이면 null입니다.
- 한국어 이름은 빌드 시 제목 증거에서 제식 번호를 대소문자·공백 무시로 연결합니다. 번호 직후 공백이 없는 한글도 지원하며 이름의 영문·숫자·문장부호를 허용합니다. 이름 끝의 숫자 각주 표지만 제거하고 원래 제목은 `nameSource.evidence`에 보존합니다. 로스터 번호 중복·제목 중복은 동일한 이름이어도 거부하고, 모든 미연결 로스터와 미사용 제목(분류 제목 포함)을 검증 stdout에 보고합니다. 위키 제목으로 연결하지 못하면 확인된 `dataKey`의 제식 번호도 대조합니다. CQC-73은 데이터 키 `CQC-72 ENTRENCHMENT TOOL`을 통해 `CQC-72 참호 도구`와 연결하며 `nameSource.matchedCode`와 한국어 notes에 보정 근거를 남깁니다. 나무위키는 이름에만 사용하고 모든 사양은 Helldivers 위키 원문에서 가져옵니다.
- 로스터는 Primary Weapons / Secondary Weapons / Throwables만 사용합니다. 하위 분류의 다른 무기를 추가하지 않습니다.

출처를 새로 수집할 때의 순서(첫 명령은 네트워크 사용이 허용된 환경에서만 실행):

```sh
node scripts/fetch-weapons-source.mjs db/source
node scripts/build-weapons.mjs
```

현재 스냅샷을 사용하는 오프라인 재생성·검증:

```sh
node scripts/build-weapons.mjs
node scripts/check-weapons.mjs
node scripts/build-enemy-sizes.mjs
npm run check
```

생성기에는 네트워크 호출이나 현재 시각 의존성이 없습니다. 검증기는 로스터·출처 연결·숫자 범위·변형 누락을 확인하고, 생성기를 두 번 `--stdout`으로 실행해 기존 파일과 바이트 단위로 비교합니다. 검증은 `weapons.js`를 다시 쓰지 않으며, 원본이 바뀌었는데 재생성하지 않았으면 실패합니다.

`scripts/weapon-infobox.mjs`는 로컬 원문만 처리하는 공통 파서입니다. 검증기는 103개 인포박스의 탄창·투척물 수량, 발사 속도, 예비 탄창·낱발, 모든 Damage/Armor 템플릿 수치, 반경과 새 지속 피해·열 용량 필드를 매번 대조합니다. 직격·폭발·변형·펠릿 합계, 연결된 하부 무기의 탄창도 비교 집합에 포함합니다. 피해 범위의 명시된 양 끝은 비교하지만 이를 충전 단계로 배정하지 않습니다. 반경은 innerRadius/radius와 대조하고 Shield의 방어막 반경은 원본 shieldradius와 비교합니다.

모든 수치 불일치를 무기·필드·DB 값·인포박스 원문으로 출력하며, 해당 무기의 `infoboxConflicts`에 정확히 기록되지 않은 불일치가 있으면 실패합니다. 승인 목록은 공통 모듈의 `reviewedConflicts`에 명시되어 있어 재빌드만으로 새 충돌이 자동 승인되지 않습니다. 값이나 원문이 바뀌면 기존 승인과 일치하지 않으므로 다시 검토해야 합니다. 더 이상 존재하지 않는 충돌 기록도 검사합니다. Trident의 6빔 × 60 = 360, Halt의 8 × 2 = 16, Blitzer의 전격 5개 × 50 = 250은 표현 차이이며 충돌로 보고하지 않습니다. Blitzer는 페이지 본문에도 전격 수가 명시되어 notes에 설명합니다. 피해 링크가 없는 Stim Pistol·Smoke·Shield의 피해 0 및 관통 -1 센티널도 충돌로 취급하지 않습니다.

## 필드와 해석

- `id`: 영문 제목에서 제식 번호를 뺀 kebab-case. 충돌 시 번호를 붙입니다. `code`는 위키 제목의 번호, `en`은 제목 그대로입니다. `name`은 출처로 확인된 한국어 이름 또는 `null`이며, 비어 있지 않은 이름에는 `nameSource`가 필요합니다. `category`는 primary/secondary/throwable입니다. `type`은 인포박스 `weapon_type`의 kebab-case를 우선하며, 없을 때만 하위 분류를 사용합니다(예: Explosives → explosives). 분류와 다르면 notes에 양쪽 값을 기록합니다. `Weapon`, `Infobox_Weapon`, `Infobox Weapon`, `Infobox Throwable` 템플릿과 필드 주변 공백을 처리합니다.
- `fieldSources`는 type/fuse/reload/reloadTactical 및 dot/heatCapacity/swingsPerMinute/rpmModes의 파일·항목·원문 필드를 가리킵니다. 인포박스로 보충한 rpm/spareRounds에도 출처를 기록하고, 데이터마이닝 값이 있으면 이를 유지하며 해당 보충 출처는 null입니다. 인포박스 출처에는 페이지 리비전·URL·수집일도 포함됩니다. 기존 `sourceRevision`은 분류 수집 시의 리비전이며, 인포박스 리비전과 구분합니다.
- `infoboxConflicts`: 검토한 실제 수치 충돌의 `{ field, db, infobox, raw }` 배열입니다. 충돌이 없으면 빈 배열이며 비교 집합인 db는 배열일 수 있습니다. 최신 데이터마이닝(revision 136739)을 우선하여 기존 값을 유지하고, 인포박스 값과 페이지 revision을 한국어 notes에 기록합니다. `infoboxRaw`는 비교 대상 7개 필드 전체의 원문을 보존하며 해석 불가능한 텍스트도 버리지 않습니다.
- `dot`: `{ element, perSecond, duration, raw }`. 모든 페이지 damage 필드의 화염·가스 등 DPS 또는 `/s`·`per second` 표기를 읽습니다. 지속시간은 명시된 경우에만 초 단위로 저장합니다. Laser/Beam의 연속 직격 DPS는 별도 DoT로 중복 저장하지 않습니다. DoT가 없으면 객체의 모든 필드가 null이며, 해석 불가능하면 raw를 보존하고 해당 숫자는 null입니다. 원문 이상의 총 피해·지속시간을 계산하지 않습니다.
- `heatCapacity`: 최상위 `{ seconds, shots, raw }`이며 magazine 안에 넣지 않습니다. heat 방식 무기의 capacity에서 `4s (53)` 등의 명시된 초·발수를 읽고 `Fires Indefinitely` 주석도 raw에 보존합니다. Talon의 단위 없는 `7`은 초/발수가 확정되지 않으므로 두 숫자를 null로 남깁니다. 해당 용량이 없으면 모든 필드가 null입니다.
- `swingsPerMinute`: 근접 무기의 단위 없는 숫자 fire_rate를 분당 타격 수로 저장합니다. 없거나 해석 불가능하면 null입니다. `rpmModes`: 여러 발사 속도가 명시된 경우의 배열로, VG-70은 `[300, 550, 750]`, Tenderizer는 `[600, 850]`입니다. 대표 rpm은 데이터마이닝 값을 유지합니다. 모드가 없으면 빈 배열입니다.
- `source`/`sourceRevision`은 무기 위키 페이지, `dataKey`는 데이터마이닝 무기 키입니다. 대문자화 후 영숫자 외 문자를 제거해 연결합니다.
- 기본 수치는 첫 level 1 공격(없으면 첫 공격)을 사용합니다. `direct`/`durable`은 연결된 damage의 `dmg`/`dmg2`이며 펠릿당 값입니다. `pellets`를 곱하거나 여러 총열의 명중을 합산하지 않습니다.
- `ap`는 직격 damage의 **ap1**입니다. 단일 관통 필드를 쓰는 기존 catalog와 연결하기 위한 대표 원본값이며, ap2~ap4의 각도 조건은 이 스냅샷에 설명이 없어 추정하지 않습니다. 값이 다르면 `apAll`에 `[ap1, ap2, ap3, ap4]`를 보존합니다. 모두 같거나 레코드가 없으면 `null`입니다.
- `splash`/`splashDurable`/`splashAp`는 `explode_on_impact_id → explosion.damage_id → damage`의 dmg/dmg2/ap1입니다. `splashApAll`도 같은 규칙입니다. 폭발 자체가 공격이면 직격 필드는 `null`, 폭발 필드만 채웁니다. `innerRadius`=r1, `radius`=r2이며 단위는 m입니다. r3를 피해 반경으로 대체하지 않습니다.
- `shrapnelCount`는 폭발이 흩뿌리는 파편 수(explosion의 shrapnel_count)입니다. 파편 1개의 피해는 id가 `shrapnel`인 variant에 있으며, 원본 탄체 키(예: AC-8_P2)는 이름 괄호에 남깁니다. 실제로 맞는 파편 수는 거리·각도에 따라 달라 합산하지 않습니다.
- `demolition`/`stun`/`push`는 직격 레코드의 demo/stun/push, 폭발만 있으면 그 폭발 레코드의 값입니다. `splashDemolition`/`splashStun`/`splashPush`는 폭발 레코드의 demo/stun/push입니다(직격과 따로, 폭발이 없으면 null). `element`는 element_name(`none`은 null), `statuses`는 해당 damage의 원본 배열입니다. `splashElement`/`splashStatuses`는 폭발 효과를 별도로 보존합니다. 공격 목록의 status 연결과 지속 피해는 자동 합산하지 않습니다.
- `record`는 탄체(projectile) 공격의 원본 탄체 키(예: AR-23_P)이고, 탄체가 아니면 null입니다. 거리 감쇠·낙차 계산은 이 키로 `dist/data/ballistics.js`(`node scripts/build-ballistics.mjs`가 같은 스냅샷의 projectile 108개에서 생성: 탄속·구경·질량·항력계수·중력 배율·수명·펠릿 수·ap1~ap4)를 찾습니다. 전투 프로필 모드도 탄체 직격이면 같은 `record`를 갖고(파편·자탄 모드는 없음), 지원 무기 모드는 `dist/data/support-records.js`의 연결을 `combat-data.js`가 붙입니다(`test-support.mjs`가 대조). 엔진은 `solveMatchup`·`compareAttacks`의 `distance`(m) 옵션이 있을 때만 위키 Damage 공식 `1 - 0.75 x (1 - e^(-2Dx))`, `D = 0.0004712389 x 구경^2 x 항력계수 / 질량`을 탄의 직격 피해에 곱합니다. 폭발 피해에는 적용하지 않으며, 기본 0m는 기존 결과와 같습니다.
- `delivery`는 원본 공격 type입니다. Melee 분류의 damage 직접 참조만 melee로 표현합니다. `unit`과 `damageKind`를 함께 읽으세요. beam_fire_rate=60인 연속 빔(Scythe/Dagger)은 초당 값(`dps`)으로 해석합니다. Trident는 펄스 빔 원본값을 보존하고 시간 단위를 확정하지 않아 damageKind=null입니다. 분사는 입자 1개, 전격은 1회, 근접은 타격 1회입니다. 빔 노출 시간·입자 빈도·연쇄 대상은 계산하지 않습니다.
- `magazine`=cap(약실 capplus 미합산), `spareMags`=mags를 **원본 예비 탄창 보유 한도**로 해석합니다. 시작량 magstart와 다르며 장전 탄창을 더하거나 빼지 않습니다. heat 방식에서는 교체 방열판 수의 원본 값입니다. 낱발 rounds는 `spareRounds`, 원본 탄약 방식은 `roundType`으로 보존합니다.
- `rpm`, `ergonomics`, `sway`, `fireModes`는 원본 rpm/ergonomics/sway/fire_modes입니다(`sway`는 조준 흔들림 배율, 1이 표준). fireModes의 `none`도 원본 센티널로 보존합니다. `beamFireRate`/`beams`/`barrels`는 원본 동명 수치이며 rpm이나 pellets로 치환하지 않습니다. `throwableCapacity`/`throwableStart`는 max/start입니다. `fuse`는 신관 시간이 없으면 null이며 projectile lifetime/explosion_delay로 대체하지 않습니다.
- `attacks`는 type/name/parent/level 전체를 원문 보존합니다. `variants`는 복수 공격·부품·충전 단계마다 전체 피해 필드를 갖습니다. 충돌 폭발은 해당 탄체의 splash에 포함하고 중복 변형으로 만들지 않습니다. 별도 폭발·파편·전격은 별도 변형입니다. level은 연결 깊이이며 모든 변형이 전환 가능한 사격 모드라는 뜻은 아닙니다. 하부 부착 무기는 변형으로 전개하고 `linkedAttacks`에 원본 공격 목록을 남깁니다.
- `charge`에는 원본 단계·배율을 보존합니다. 충전 변형은 연결 가능한 탄체의 **원본** 피해만 제공하고, DEFAULT 참조는 null입니다. 배율을 어느 피해에 언제 적용하는지, 이미 반영됐는지 확인할 근거가 없어 곱하지 않습니다. `chargeTime`은 원본 charge_time입니다. 이 변형을 최종 유효 충전 피해로 간주하지 마세요.
- `fuse`: 투척물 인포박스 `fuse`의 명시된 초 단위 숫자입니다. Impact 같은 비시간식 값, 범위·복수 값, 누락은 null이며 원문을 notes에 남깁니다. 숫자 0이 명시되면 그대로 보존합니다.
- `reload`: 명시된 초 단위 `reload_time`을 우선하고, 해석 가능한 값이 없으면 `rounds_reload_full_time`(낱발식 전체 장전), 다음으로 `tac_reload_time`을 사용합니다. 대체 출처는 notes/fieldSources에 명시합니다. `reloadTactical`은 `tac_reload_time`만 사용하며 낱발 첫 삽입 시간으로 대체하지 않습니다. 현재 원문의 복합 무기는 주 총열 표기인 8mm(One-Two)/12mm(Stoker) 값을 대표값으로 사용합니다. Eruptor의 `2.75s`는 전술 장전이며 `1.4s (Just Rechambering)`은 별개입니다.
- `reloadDetails`: 모든 비어 있지 않은 reload 관련 필드의 원문과 구성별 초·라벨을 보존합니다. One-Two의 40mm 2.5초, Stoker의 화염방사기 2.3초, 낱발 최초/후속 삽입 시간도 버리지 않습니다. 범위 끝점·단위 없는 수치·알 수 없는 템플릿은 추정하지 않습니다. GL-15의 `reload_time=2.67`에는 단위가 없어 원문으로 보존하고, 초가 명시된 `rounds_reload_full_time=2.75s`를 reload에 사용합니다. 필드가 없거나 해석 불가한 null은 notes에 이유를 기록합니다.
- `wiki-uncharged`/`wiki-charged` variants는 인포박스 `damage`에 비충전/충전 상태와 bolt/direct 또는 explosion/explosive 성분이 명시된 수치를 각각 `direct`/`splash`로 기록합니다. 출처 필드·원문 증거를 함께 저장하며 내구 피해·관통력 등 미제공 수치는 null입니다. 기존 `charge-stage-*`, `charge`, 원본 공격 변형은 그대로 보존합니다. 해석할 수 없는 표기는 한국어 notes에 공백으로 보고하며 배율 계산으로 보충하지 않습니다.

## 알려진 공백

미제공 수치는 모두 `null`이며 실제 원본 0만 0으로 보존합니다. 폭발 연결 부재의 null은 확인된 피해 0과 다릅니다. 빈 배열은 제공된 항목이 없다는 뜻입니다.

**2026-09-27 실제 로컬 원문 검증:** 103/103 페이지 원문과 HTTP 200인 나무위키 4개 문서를 오프라인으로 처리했습니다. type 103/103, 단일 신관 12/23, 한국어 이름 102/103, reload 73/103, reloadTactical 41/103입니다. 원문의 본문 증거·누락 여부를 재검토할 수 있도록 wiki_pages.json 전체 원문은 유지했습니다. 공격 데이터와 분류 스냅샷은 변경하지 않았습니다. 합성 회귀 예제는 DB 데이터로 사용하지 않습니다.

추가 필드가 채워진 무기는 dot 12종(Scythe·Dagger의 Fire DPS 포함), heatCapacity 원문 7종(숫자 해석 6종), swingsPerMinute 4종, rpmModes 2종입니다. 빈 데이터마이닝 rpm 2종은 Blitzer 45와 Trident 300, spareRounds 3종은 Ultimatum 1, Missile Pistol 3, Breacher 2로 보충했습니다. Trident의 beamFireRate 원본값은 별도로 유지합니다.

전체 103종에서 확인된 수치 충돌은 아래 3종·3건이며 추가 충돌은 없습니다.

| 무기 | 필드 | 유지한 DB 값 | 인포박스 값 |
| --- | --- | --- | --- |
| PLAS-39 Accelerator Rifle | spareMags | 12 (mags; magstart=8) | 8 |
| P-92 Warrant | spareMags | 7 (mags; magstart=4) | 8 |
| G-123 Thermite | radius | innerRadius=1.5 / radius=2.5 | 2 m |

- 신관 null 11종: G-13/G-16/G-48/G-50/G-60/G-8/G-89는 `Impact`, G/40-K/TM-1은 `Proximity`, K-2는 `N/A`, TED-63은 선택 가능한 `5s / 15s / 60s`라 단일 값을 선택하지 않습니다. G/SH-39는 실제 인포박스가 `0s`이므로 0을 보존합니다.
- 이름 미연결: 2026-10-22 수집부터 없습니다. AR-32 Pacifier는 나무위키에 제목이 없던 동안 `build-weapons.mjs`의 `manualKoreanNames`에 사이트 관리자가 정한 이름을 두었고, 나무위키에 같은 이름 `AR-32 퍼시파이어`가 생겨 비웠습니다. 다시 미연결 무기가 생기면 이 목록에 이름과 이유를 넣으며, `nameSource`에 `manual: true`가 기록되고 나무위키 제목이 생기면 그쪽이 우선합니다. CQC-73 Entrenchment Tool은 데이터 키의 제식 번호로 연결했습니다. 검증 stdout에는 미연결 무기 제목 외에 로스터에 대응하지 않는 모든 일반 절 제목도 출력합니다.
- reload null 30종은 투척물 23종, 근접 6종(CQC-2/5/19/30/42/73), ARC-12 Blitzer입니다. 해당 인포박스에 재장전 시간 필드가 없습니다. 전술 장전 값이 없는 무기는 reload에서 역산하지 않습니다.
- Purifier는 비충전 direct/splash=100/75, 충전=200/300입니다. Accelerator Rifle은 `Ballistic|250`, `Explosion|100` 단일 표기만 있고, Loyalist는 `Ballistic|75-150`, `Explosion|75-225` 범위만 있습니다. 둘 다 비충전/충전별 수치를 명시하지 않으므로 해당 wiki 변형은 생성하지 않고 원문을 notes에 남깁니다. 검증기는 이 기록된 부재를 허용하되, Purifier의 실제 4개 값은 별도로 회귀 검증합니다.

- CQC-73 Entrenchment Tool은 원본 **CQC-72 ENTRENCHMENT TOOL**로 명시적으로 연결하며 불일치를 notes에 기록합니다.
- G/SH-39 Shield는 공격 목록이 비어 있습니다. P-11 Stim Pistol, G-3 Smoke, G-89 Smokescreen은 damage_id가 비어 있어 피해를 알 수 없습니다. 연막 반경은 원본에서 보존합니다.
- 하위 분류가 없던 6종도 인포박스로 채웁니다: CB-9/GL-15/R-36은 `explosives`, JAR-5/VG-70/FLAM-66은 `special`입니다. Torcher의 실제 원문은 `weapon_type=Special`이며 하드코딩하지 않습니다. Melee 분류의 7개 중 로스터에 속하는 것은 6개입니다.
- PLAS-101 Purifier, PLAS-15 Loyalist, PLAS-39 Accelerator Rifle의 충전 배율 적용 규칙은 미확인입니다. 특히 PLAS-39의 DEFAULT는 탄체 테이블 키가 아닙니다.
- G/40-K Melta Mine의 FLAMEWALL, K-2 Throwing Knife의 damage 직접 참조는 시간 단위를 확정하지 않습니다. 상태 지속시간·파편 명중 수·총 피해·거리 감쇠 등도 추정하지 않습니다.

필드 이름은 기존 support/catalog와 맞췄지만 전투 계산기에 바로 투입할 어댑터는 아닙니다. combat-data의 `standard`/`explosion`/`explosionDurable`로 변환하고 단위·복수 공격 조건을 정한 뒤 연결해야 합니다. 현재 DB의 null을 피해 0으로 취급하면 안 됩니다.

## 적 부위 재확인 (위키 Anatomy)

초기 적 데이터 일부는 대표 부위만 담고 있습니다. 위키 부위 표와 다시 대조한 적은 `anatomyRevision`(대조한 위키 revision)과 `anatomyCheckedAt`을 가지며, 모든 부위에 위키 행 이름 `sourcePart`를 붙입니다. 2026-10-22 기준 전투 적 84종 전체가 위키 부위 표의 모든 행과 일치합니다(패치 1.007.200 뒤 다시 받아, 크레센트 오버시어 배낭 추가·제트 여단 커미사르 장갑 1·로켓 레이더 왼팔/오른팔 분리·워 스트라이더 융합포 폭발 저항 60%를 반영).

- 위키 페이지에 탭이 여러 개면(예: 스카우트 스트라이더의 Pilot, 팩토리 스트라이더의 Armor Broken) 두 번째 탭부터 행 이름을 `탭: 부위`로 씁니다.
- 본체 행이 `Main`이 아니면(전차의 `Hull Main`) 적에 `anatomyMain`을, 자체 체력 풀을 가진 부위(포탑, 조종사)에는 그 풀의 행 `sourceMain`을 적습니다.
- 같은 수치의 행을 한 부위로 합쳐 보여 주면 `anatomyMerged: {위키 행 이름: 부위 id}`, 부위로 표현하지 않는 행(보호막 토글로 다루는 보호막 등)은 `anatomyOmitted: {위키 행 이름: 영문 사유}`로 명시합니다.
- 기존 수치를 위키에 맞게 고치면 바꾸기 전 값을 `anatomyLegacy: {'부위.필드': 옛 값}`(예: `'main.armor': 3`)에 남깁니다. `test-parity.mjs`는 옛 값으로 되돌린 적에게 legacy 결과를 그대로 재현해 엔진을 계속 검증하고, 새 값은 `test-anatomy.mjs`가 위키와 대조합니다.
- 한 적의 여러 탭이 같은 행을 다른 각도로 보여 주면(하이브 로드) `anatomyTables: [0]`처럼 대조할 탭만 지정합니다. `anatomyLegacy`의 `null`은 그 필드가 옛 데이터에 없었다는 뜻입니다.
- 위키 값이 난이도별로 다르면(예: `130 [Default] / 160 at 난이도 4`) 적 설명의 기준대로 가장 높은 난이도 값을 씁니다.

- `node scripts/fetch-enemy-anatomy.mjs`: 모든 전투 적 페이지의 Anatomy 표를 `source/wiki_anatomy.json`에 저장합니다(네트워크 필요).
- `node scripts/fetch-anatomy-photos.mjs`: 재확인한 적 중 사진이 없는 부위의 위키 사진을 받아 webp로 변환하고 `dist/data/combat-images-revised.js`와 `scripts/anatomy-webp.json`에 기록합니다(네트워크, Python Pillow 필요).
- `scripts/test-anatomy.mjs`(`npm run check`에 포함): 재확인한 적마다 스냅샷 revision 일치, 모든 위키 행의 반영 여부, 체력·장갑·내구도·폭발 저항·본체 전달률·전달 상한·치명 여부·추가 체력을 대조합니다.

새 부위는 기존 부위 뒤에 덧붙입니다. `test-parity.mjs`는 기존 부위의 결과가 legacy와 같은지 계속 확인하고, 새 부위는 기존 최단 경로보다 빠를 때만 최단 경로가 될 수 있습니다.

## 지원 무기 수치 대조 (위키 데이터마이닝)

지원 무기 수치는 손으로 적은 두 곳에 있습니다. 계산 엔진이 쓰는 `dist/data/combat-data.js`의 `weaponProfiles`와 스트라타젬 표가 보여 주는 `dist/data/data-support.js`입니다. `scripts/test-support.mjs`(`npm run check`에 포함)가 두 곳을 `source/weapons_data.json`과 대조합니다.

- 엔진 모드와 표의 행마다 어떤 데이터마이닝 기록(탄체·폭발·빔·전격·분사·근접 피해, 자탄)에 해당하는지 검사 파일에 명시합니다. 짝이 없는 새 모드나 행이 생기면 검사가 실패합니다.
- 직격·내구 피해, 관통, 폭발 피해·관통, 최대 피해 반경(r1)·바깥 반경(r2)을 비교합니다. 충전 사격은 무기의 충전 배율(`damage_mod`)의 마지막 값을 곱합니다(레일건 2.5배, 에포크 2배).
- 일부러 다른 값은 `reviewed`에 사이트 값·데이터마이닝 값·이유를 함께 적습니다. 예: 유탄 발사기 직격 0(위키 본문 기준, 원본 기록 20), 디폴리에이션 툴 관통 5(접촉 0.5초 뒤 3에서 5로 상승). 값이 바뀌거나 차이가 사라지면 다시 검토하도록 실패합니다.
- 데이터마이닝에 없는 것은 `notCompared`에 이유를 적습니다. 솔로 사일로(스냅샷에 없음), 멜타건 15m 감쇠(위키 본문 값), 화염방사기·크레메이터 표의 DPS(원본은 입자 1개 기준) 등입니다. 궤도·이글 스트라타젬은 이 스냅샷에 없어 대조하지 않습니다.

## 전쟁 채권 (위키 Category:Warbonds)

사이트 첫 화면(`#/warbonds`)의 데이터입니다. 무기 DB와 별개이며 브라우저는 `db/`를 읽지 않습니다.

- `source/wiki_warbonds.json`: `node scripts/fetch-warbonds.mjs`가 [Category:Warbonds](https://helldivers.wiki.gg/wiki/Category:Warbonds)의 문서를 MediaWiki API로 받은 스냅샷입니다(네트워크 필요, 기본 도구 User-Agent). `pages[영문 제목]`에 `source`, `pageid`, `revision`, `revisionTimestamp`, `retrievedAt`, `wikitext`를 보존합니다. 분류에 함께 들어 있는 개요 문서 `Warbonds`는 인포박스가 없어 `skipped`에만 기록합니다.
- `source/warbond_korean_names.json`: 전쟁 채권 26종의 한국어 이름(게임 내 표기). 이름만 담고 다른 항목은 두지 않습니다. 키는 문서 제목에서 ` Premium Warbond`/` Legendary Warbond`/` Warbond`를 뺀 이름입니다. 이름이 빠지거나 남으면 빌드가 실패합니다.
- `node scripts/build-warbonds.mjs [--stdout]`: 위 두 파일만 읽어 `dist/data/warbonds.js`를 생성합니다(LF, 네트워크·시각 의존 없음). 공통 파서는 `scripts/warbond-parse.mjs`입니다.
- `python scripts/tools/fetch-warbond-covers.py`: 인포박스 표지를 240px WebP로 받아 `dist/assets/warbonds/`와 `dist/data/warbond-images.js`를 씁니다(네트워크, Pillow 필요). `--latest-large`는 작은 표지는 건드리지 않고 `latestWarbondId`(출시일이 가장 늦은 채권, 같은 날이면 영문 제목 순) 하나만 최대 1600px·120KB 이하로 받아 `<id>-large.webp`와 `dist/data/warbond-banner-images.js`를 씁니다. 원본보다 키우지 않습니다. 첫 화면의 '최신 출시 채권' 배너가 쓰며, 없으면 작은 표지로 대신합니다.

해석 규칙:

- 인포박스 `{{Infobox Warbond}}`: 등급(`type`, 없으면 제목의 Premium/Legendary), 출시일(ISO `YYYY-MM-DD`), 가격 SC(`Free`=0), `credit-claim`(`None`=0), `all-pages`, `all-items`.
- `===Page N===` 아래 `{{Acquisitions Page}}`의 `N_name/N_link/N_image/N_cost`와 `spent_to_unlock`이 기준값입니다. 같은 절의 접힌 표(Icon/Item/Type/Cost)와 항목을 이미지 → 링크·이름 → 다른 페이지 → 철자 차이 순으로 짝지어 종류(Type)를 얻고 비용을 대조합니다.
- 템플릿과 표가 다르면 그 값을 추정하지 않고 `null` + `'미확인'`으로 두고 `warbondDiscrepancies`에 `{warbondId, page, item, field, code, template, table|infobox}`를 남깁니다. 항목 비용 합계 ≠ `all-items`, 마지막 페이지 해금 ≠ `all-pages`, 표의 슈퍼 크레딧 합계 ≠ `credit-claim`도 같은 방식입니다. 해금 값이 없거나 `Unknown`인 페이지도 미확인입니다(1페이지는 처음부터 열림).
- 무기·스트라타젬은 영문 이름(제식 번호 포함)으로 `personal-weapons.js`·`catalog.js`와 연결해 `ref: {view, id}`를 둡니다. 위키 전쟁 채권 문서에 남은 옛 이름은 `build-warbonds.mjs`의 `RENAMED`에 근거와 함께 명시합니다(LAS-16 Trident → LAS-13 Trident: 무기 문서 revision 140438의 출처가 Siege Breakers 1페이지·35메달이고, 1.006.003 변경 기록에 'LAS-16 Trident'에서 이름을 바꿨다고 적혀 있음). 그래도 일치하지 않으면 제식 번호와 따옴표 별칭을 뺀 이름이 사이트에서 하나뿐일 때만 연결하고 `warbondLinks.matchedWithoutCode`에 기록합니다. 방어구·외형 등 다른 항목 이름은 위키 영문 그대로 둡니다.

`scripts/test-warbonds.mjs`(`npm run check`에 포함)가 파서 단위 검사, 합계 대조, 26종 한국어 이름, 연결 대상 존재, 미확인 값과 불일치 기록의 1:1 대응, 생성 파일 최신성·결정성·LF를 확인합니다.

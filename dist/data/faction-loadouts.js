// Ordered editorial choices: practical aim/access first, not lowest hit count.
const pick = (weapon, target, label, note) => ({ weapon, targets: [target], label, note });
const sporeFire = (weapon, label, note, extra = '') => ({
  ...pick(weapon, null, label, note), adviceOnly: true,
  source: 'https://helldivers.wiki.gg/wiki/Spore_Burst_Warrior#Tactical_Information',
  limitation: `포자 억제 조건은 사망 시 불타는 상태인 것입니다. 점화되지 않았거나 불이 꺼진 뒤 죽으면 이 조건이 성립하지 않습니다. 화염 노출·표적 선택에 따라 달라 고정 처치 탄수나 시간을 표시하지 않습니다.${extra}`,
});
const tank = [
  pick('recoilless', 'head', '대전차 화력 · 정지 재장전', '머리를 한 번씩 확실히 노립니다. 충전 없이 발사하지만 탄약 배낭이 필요하고 재장전할 때 멈춰야 합니다.'),
  pick('quasar', 'head', '탄약 보급 불필요 · 충전 대기', '탄약을 아끼기 좋지만 충전 중 표적을 따라가야 하고, 다음 발까지 냉각을 기다려야 합니다.'),
  pick('commando', 'head', '연속 발사 · 유도 조준', '여러 발로 보완할 수 있습니다. 미사일 유도와 남은 탄 수를 관리하고, 소진하면 새 무기를 호출하세요.'),
];
const jetHulk = [
  pick('grenade-launcher', 'jetpack', '정면 폭발 · 눈 정밀 조준 불필요', '정면 상부에서 폭발시켜 제트팩을 범위에 넣습니다. 유탄의 낙차와 근접 폭발에 주의하세요.'),
  pick('epoch:charged', 'jetpack', '정면 폭발 · 완전 충전 필요', '제트팩에 충전탄의 폭발을 닿게 합니다. 충전 완료 후 놓는 타이밍이 필요하며 지나치게 충전하면 자폭합니다.'),
  pick('autocannon', 'jetpack', '직격 대안 · 제트팩이 보일 때', '옆·뒤에서 제트팩이 보일 때 직접 맞힙니다. 위 두 무기의 정면 폭발 계산과 다르며 탄약 배낭·정지 재장전 부담이 있습니다.'),
];
const shieldDev = [
  pick('grenade-launcher', 'torso', '범위 폭발 · 방패 우회 필요', '방패가 비켜난 순간이나 측면에서 몸통에 폭발을 넣습니다. 방패 정면 명중만으로 같은 탄수를 보장하지 않습니다.'),
  pick('autocannon', 'stomach', '측면 허리 · 정지 재장전', '작은 얼굴 대신 방패 밖으로 드러난 허리를 직접 맞힙니다. 측면 접근과 탄약 배낭이 필요합니다.'),
  pick('machine-gun', 'stomach', '연사 보정 · 방패 밖 허리', '노출된 허리에 연사하며 조준을 보정합니다. 방패를 우회해야 하며 재장전 중에는 멈춥니다.'),
];
const harvester = [
  pick('heavy-machine-gun', 'joint', '관절 연사 · 반동 관리', '보호막을 걷어낸 뒤 가로 다리 연결부에 연사합니다. 탄착을 보며 수정할 수 있지만 반동과 정지 재장전을 관리하세요.'),
  pick('recoilless', 'joint', '관절 한 발 화력 · 정지 재장전', '보호막 제거 후 가로 연결부에 집중합니다. 눈을 노리는 방식이 아니며 빗맞히면 재장전 부담이 큽니다.'),
  pick('autocannon', 'joint', '관절 반복 사격 · 배낭 필요', '보호막 제거 뒤 같은 가로 관절을 계속 맞힙니다. 여러 다리에 피해를 나누지 말고 재장전할 엄폐를 확보하세요.'),
];
const lightBot = [
  pick('stalwart', 'torso', '몸통 연사 · 이동 재장전', '작은 머리보다 넓은 몸통에 연사하세요. 점프·화염 보병과 거리를 벌리며 재장전할 수 있고, 파괴된 팩의 폭발에는 접근하지 마세요.'),
  pick('machine-gun', 'torso', '몸통 연사 · 정지 재장전', '가슴 중앙을 직접 맞히세요. 다른 적도 함께 상대하기 좋지만 재장전할 때 멈추므로 엄폐를 확보하세요.'),
];
const smallSpore = page => [
  { ...sporeFire('flamethrower', '우선 추천 · 포자 방출 억제', '접근하는 적을 직접 점화하고 불타는 상태로 죽여 포자 방출을 막으세요. 화염 사거리와 아군 위치를 확인하세요.'), source: `https://helldivers.wiki.gg/wiki/${page}#Tactical_Information` },
  { ...sporeFire('cremator', '직접 점화 · 연료 배낭 필요', '화염으로 무리를 태워 사망 시 포자 방출 억제를 노립니다. 연료 배낭이 필요하며 지면 화염과 아군 오사를 피하세요.'), source: `https://helldivers.wiki.gg/wiki/${page}#Tactical_Information` },
  pick('stalwart', 'body', '비화염 대안 · 이동 재장전', '몸통을 따라가며 연사하고 포자 폭발 범위 밖을 유지하세요. 이 무기의 비화염 처치만으로는 포자 방출을 막지 못합니다.'),
];
export const factionLoadouts = {
  'spore-burst-scavenger': smallSpore('Spore_Burst_Scavenger'),
  'spore-burst-hunter': smallSpore('Spore_Burst_Hunter'),
  'assault-raider': lightBot,
  'jet-brigade-commissar': lightBot,
  'jet-brigade-trooper': lightBot,
  'jet-brigade-mg-raider': lightBot,
  'pyro-trooper': lightBot,
  'incendiary-rocket-raider': lightBot,
  'obtruder': [
    pick('stalwart', 'body', '비행체 몸통 연사 · 이동 재장전', '움직이는 비행체의 넓은 몸체를 따라가며 연사하세요. 작은 눈 정밀 조준보다 맞히기 쉽고 이동 재장전으로 포위를 벗어날 수 있습니다.'),
    pick('autocannon:flak', null, '대공포탄 모드 · 군집 대응', '모여 있는 드론에 근접 신관과 파편을 활용하세요. 탄약 배낭과 정지 재장전이 필요하며 가까이 붙은 적에게 쏘면 폭발에 휘말릴 수 있습니다.'),
  ],
  'predator-hunter': [
    pick('stalwart', 'body', '이동 재장전 · 몸통 연사', '은신이 풀리거나 도약 후 착지했을 때 드러난 몸통을 따라가며 연사하세요. 이동 재장전으로 거리를 유지하되 담즙 공격도 피하세요.'),
    pick('machine-gun', 'body', '몸통 연사 · 정지 재장전', '작은 머리 대신 몸통에 연사합니다. 재장전할 때 멈추므로 측면에서 접근하는 개체를 확인하세요.'),
  ],
  'predator-stalker': [
    pick('machine-gun', 'body-armor', '몸통 연사 · 정지 재장전', '빠르게 접근하는 넓은 몸통에 연사합니다. 머리보다 탄은 더 들지만 작은 머리를 계속 따라갈 필요가 적습니다.'),
    pick('stalwart', 'underbelly', '이동 재장전 · 얇은 복부 조준', '움직이며 재장전할 수 있어 추격에 대응하기 좋습니다. 위쪽 외피보다 장갑이 낮은 아래 복부를 노려야 합니다.'),
    pick('autocannon', 'body-armor', '몸통 직접 타격 · 거리 확보', '작은 머리 대신 몸통을 맞힙니다. 근접 폭발을 피할 거리와 정지 재장전할 틈이 필요합니다.'),
  ],
  'spore-burst-warrior': [
    { ...pick('flamethrower', null, '우선 추천 · 포자 방출 억제', '불타는 상태로 죽도록 점화해 포자 방출을 막으세요. 단순히 한 번 불을 붙였다는 이유로 보장되는 것은 아니며, 죽는 시점까지 불타는 상태여야 합니다. 화염 사거리 안으로 접근해야 하고 아군·지면 화염에 주의하세요.'), adviceOnly: true, source: 'https://helldivers.wiki.gg/wiki/Spore_Burst_Warrior#Tactical_Information', limitation: '화염 직격·지면 화염·화상 노출 시간에 따라 달라 고정 처치 탄수나 시간을 표시하지 않습니다. 가스 혼란만으로 같은 포자 억제 효과가 난다고 가정하지 않습니다.' },
    sporeFire('cremator', '직접 점화 · 연료 배낭 필요', '화염방사기처럼 접근하는 적을 직접 태워 포자 방출 억제를 노립니다. 연료 배낭을 사용하므로 다른 배낭과 함께 들 수 없고, 지형에 막히거나 가까이서 되튀는 불길에 주의하세요.'),
    pick('machine-gun', 'head', '비화염 대안 · 머리 제거 후 출혈', '화염 장비를 쓰지 않는다면 머리를 제거한 뒤 거리를 벌려 출혈로 죽게 하는 방법이 있습니다. 출혈 중에도 공격하므로 접근하지 마세요. 추가 사격으로 먼저 죽이는 경우까지 포자 억제를 보장하지 않습니다.'),
  ],
  'spore-burst-bile-titan': tank,
  'rupture-warrior': [
    pick('grenade-launcher', 'head', '잠복 대응 폭발 · 지상 기준 탄수', '폭발로 잠복 해제를 유도하고 드러난 적을 공격합니다. 아래 탄수는 지상 명중 기준이며 잠복 해제에 쓴 탄은 제외합니다.'),
    pick('machine-gun', 'head', '장갑 관통 연사 · 정지 재장전', '드러난 장갑 머리에 연사합니다. 스털워트로 같은 머리 관통을 기대하면 안 되며 출혈 중에도 거리를 유지하세요.'),
    pick('autocannon', 'head', '장갑 머리 직격 · 배낭 필요', '드러난 머리를 직접 맞힙니다. 정지 재장전 중 다른 개체가 접근하지 않게 엄폐를 확보하세요.'),
  ],
  'rupture-spewer': [
    pick('grenade-launcher', 'butt', '큰 복부 폭발 · 드러날 때 공격', '작은 입 대신 부푼 복부를 폭발 범위에 넣습니다. 잠복 중 탄수가 아니라 지상에 드러난 복부 기준입니다.'),
    pick('autocannon', 'butt', '큰 복부 직격 · 정지 재장전', '보이는 큰 복부에 직격과 폭발을 넣습니다. 머리 최소 탄수보다 넓은 표적을 택한 대응입니다.'),
    pick('epoch:charged', 'butt', '복부 폭발 · 충전 타이밍 필요', '드러난 복부에 완전 충전탄을 맞힙니다. 충전 중 재잠복할 수 있고 과충전 자폭에 주의해야 합니다.'),
  ],
  'rupture-charger': tank,
  'jet-brigade-devastator': [
    pick('grenade-launcher', 'torso', '몸통 폭발 · 도약 착지 후', '작은 얼굴보다 몸통 주변을 폭발시킵니다. 도약 중에는 빗맞히기 쉬우므로 착지할 때 노리세요.'),
    pick('autocannon', 'torso', '몸통 직접 타격 · 배낭 필요', '정면 가슴에 직접 맞힙니다. 제트팩 파괴만으로 처치된다고 가정하지 않습니다.'),
    pick('machine-gun', 'stomach', '허리 연사 · 탄착 보정', '머리보다 넓은 노출 허리를 따라가며 쏩니다. 정지 재장전할 공간이 필요합니다.'),
  ],
  'jet-brigade-hulk-bruiser': jetHulk,
  'jet-brigade-hulk-scorcher': jetHulk,
  'conflagration-devastator': shieldDev,
  'incendiary-mg-devastator': shieldDev,
  'hulk-firebomber': [
    pick('recoilless', 'head', '대전차 화력 · 재장전 엄폐 필요', '충전 없이 대전차탄을 쏩니다. 아래는 등록된 눈 직격 경로의 계산이며 얼굴 어디든 같은 판정이라는 뜻은 아닙니다.'),
    pick('quasar', 'head', '탄약 보급 불필요 · 충전 중 조준', '대전차 화력을 쓰되 충전과 냉각을 기다려야 합니다. 아래 수치는 눈 직격 기준입니다.'),
    pick('autocannon', 'heatsink', '넓은 후방 방열판 · 뒤로 돌아야 함', '정면 눈 조준이 어렵다면 뒤쪽 방열판을 노립니다. 후방 접근이 필요하고 파괴 뒤에도 출혈 시간이 남을 수 있습니다.'),
  ],
  'radical': [
    pick('machine-gun', 'torso', '몸통 연사 · 정지 재장전', '빠르게 접근하는 적의 가슴에 연사합니다. 머리 최소 탄수보다 탄착 보정이 쉬운 넓은 부위를 택했습니다.'),
    pick('grenade-launcher', 'torso', '몸통 주변 폭발 · 거리 확보', '몸통 주변에서 폭발시키되 가까이 접근한 적에게는 근접 폭발을 피하세요.'),
    pick('autocannon', 'torso', '몸통 직접 타격 · 배낭 필요', '넓은 가슴에 맞히고 후속 사격합니다. 재장전 중 접근당하지 않도록 거리를 확보하세요.'),
  ],
  'agitator': [
    pick('grenade-launcher', 'pelvis-left-leg', '하체 폭발 · 투구 정밀 조준 불필요', '골반·적 기준 왼다리 쪽에 폭발을 넣습니다. 오른다리와 공유 체력·전달률이 달라 같은 탄수로 보지 않습니다.'),
    pick('autocannon', 'pelvis-left-leg', '하체 직접 타격 · 배낭 필요', '투구를 따라가기보다 골반·왼다리 공유 부위를 직접 맞힙니다. 다른 팔·다리에 피해를 나누지 마세요.'),
    pick('machine-gun', 'torso-armor', '가슴 연사 · 외피 제거 포함', '넓은 흉부에 연사해 외피를 벗긴 뒤 계속 공격합니다. 머리 경로보다 탄이 많이 들며 정지 재장전이 필요합니다.'),
  ],
  'wretch': [
    pick('machine-gun', 'leg', '다리 연사 · 머리 조준 불필요', '같은 다리에 집중해 본체 피해를 누적합니다. 머리·팔 하나 파괴를 처치로 혼동하지 마세요.'),
    pick('autocannon', 'leg', '다리 직격 · 근접 폭발 주의', '드러난 다리를 직접 맞힙니다. 빠르게 접근하므로 폭발을 사용할 거리를 남겨두세요.'),
    pick('heavy-machine-gun', 'leg', '다리 연사 · 반동·재장전 부담', '다리에 연사하며 보정할 수 있지만 기관총보다 반동과 재장전 부담이 큰 선택입니다.'),
  ],
  'crusher': [
    pick('autocannon', 'helmet', '헬멧 제거 후 머리 · 배낭 필요', '재생하는 몸통 대신 헬멧을 벗기고 노출 머리를 맞힙니다. 아무 곳이나 폭발시키는 방식은 아닙니다.'),
    pick('heavy-machine-gun', 'helmet', '헬멧 집중 연사 · 반동 관리', '헬멧부터 노출 머리까지 같은 위치에 연사합니다. 반동을 제어하고 몸통으로 빗나가지 않게 하세요.'),
    pick('epoch:charged', 'helmet', '헬멧 직격 · 충전 연습 필요', '완전 충전탄으로 헬멧을 제거하고 후속 공격합니다. 폭발만 믿고 몸통을 쏘지 말고 과충전을 피하세요.'),
  ],
  'voteless-heavy': [
    pick('stalwart', 'head', '이동 재장전 · 무리 대응', '접근하는 무리를 연사로 처리하며 이동 재장전합니다. 아래 머리 탄수는 한 개체 기준이지 무리 전체 처치 수가 아닙니다.'),
    pick('grenade-launcher', 'head', '밀집한 무리 폭발 · 근접 주의', '모여 있는 무권자에 폭발을 넣습니다. 바로 앞까지 접근한 적에게는 자폭 위험 때문에 거리를 확보하세요.'),
    pick('machine-gun', 'head', '다른 중형 적도 겸용 · 정지 재장전', '무권자와 장갑 있는 보병을 함께 상대할 때 고릅니다. 스털워트와 달리 재장전 시 멈춥니다.'),
  ],
  'fleshmob': [
    pick('grenade-launcher', 'arm', '범위 폭발 · 여러 부위 활용', '큰 덩치에 폭발을 활용하는 위키 전술 추천입니다. 한 부위 이론값과 실전 전술 안내는 아래에서 구분합니다.'),
    pick('autocannon:flak', 'head-chunk', '대공포탄 폭발·파편 · 배낭 필요', '작은 약점 한 점보다 폭발·파편을 활용합니다. 명중 파편 수를 고정하지 않으며 정지 재장전 부담이 있습니다.'),
  ],
  'harvester': harvester,
  'veracitor': [
    pick('recoilless', 'chassis', '보호막 밖 기체 · 정지 재장전', '조종사 대신 보호막 밖 중앙 기체를 직접 맞힙니다. 탄약 배낭과 재장전할 엄폐가 필요합니다.'),
    pick('quasar', 'chassis', '보호막 밖 기체 · 충전 필요', '중앙 기체를 향해 충전합니다. 근접 돌진 중에는 충전 시간을 확보하기 어려울 수 있습니다.'),
    pick('autocannon', 'hip', '노출 관절 반복 타격 · 배낭 필요', '조종사 보호막을 제거하는 대신 드러난 고관절에 반복 사격합니다. 더 단단한 뒤쪽 관절과 구분하세요.'),
  ],
  'gatekeeper': [
    pick('recoilless', 'chassis', '정면 기체 · 정지 재장전', '뒤로 돌지 않고 보호막 밖 기체 중앙을 직접 노립니다. 다음 적을 위해 재장전할 엄폐를 확보하세요.'),
    pick('quasar', 'chassis', '정면 기체 · 충전 대기', '기체 중앙에 대전차 화력을 넣습니다. 충전 중 적의 포격을 피할 공간이 필요합니다.'),
    pick('autocannon', 'rear-weakspot', '후방 약점 · 접근 조건 있음', '정면 장갑보다 약한 등 뒤를 노립니다. 이미 측후면을 잡았을 때의 대안으로, 후방 접근 부담이 있습니다.'),
  ],
  'overseer': [
    pick('grenade-launcher', 'chest-armor', '몸통 폭발 · 방패 우회', '작은 투구 대신 흉부에 폭발을 넣습니다. 방패가 사선을 막으면 측면이나 방패를 내리는 순간을 노리세요.'),
    pick('machine-gun', 'chest-armor', '가슴 연사 · 외피 제거 포함', '흉부 외피를 벗긴 뒤 같은 위치에 연사합니다. 머리보다 탄이 더 들지만 넓은 부위를 쓸 수 있습니다.'),
    pick('autocannon', 'chest-armor', '가슴 직격·폭발 · 배낭 필요', '방패를 우회해 가슴을 직접 맞힙니다. 재장전과 근접 폭발에 주의하세요.'),
  ],
  'elevated-overseer': [
    pick('machine-gun', 'chest-armor', '비행 몸통 연사 · 탄착 보정', '움직이는 작은 머리 대신 몸통을 따라가며 연사합니다. 가슴 외피 제거를 포함한 경로입니다.'),
    pick('autocannon', 'jetpack', '옆·뒤 제트팩 · 보일 때 직격', '제트팩이 보이면 직접 맞힙니다. 제트 헐크처럼 정면 폭발만으로 제트팩 명중을 가정하지 않습니다.'),
    pick('heavy-machine-gun', 'chest-armor', '몸통 연사 · 반동 관리', '넓은 몸통에 연사하지만 비행 표적을 따라가며 반동을 제어해야 합니다. 정지 재장전도 필요합니다.'),
  ],
  'vox-engine': [
    pick('leveller', 'sarcophagus', '중앙부 넓은 폭발 · 일회성', '몸통 중앙에 꽂아 여러 부위를 폭발 범위에 넣는 전술입니다. 한 발 처치 조건과 단일 부위 계산을 구분하세요.'),
    pick('solo-silo', 'sarcophagus', '중앙부 복합 폭발 · 거리 확보', '중앙부에서 두 폭발이 주변 부위에 닿도록 노립니다. 작은 충돌 폭발까지 닿아야 하며 근접 사용을 피하세요.'),
    pick('recoilless', 'sarcophagus', '반복 대전차 사격 · 엄폐 필요', '일회성 장비가 없을 때 정면 석관에 대전차탄을 반복 명중시킵니다. 탄약·정지 재장전 부담이 있습니다.'),
  ],
  // Caustic Strain (wiki Caustic_Strain rev 142183, Tactical Information): they burst in bile when they die, so the
  // picks keep distance; the wiki suggests long-range options for the Caustic Spewer and guided ones in the Charger's fog.
  'bile-spitter': [
    pick('stalwart', 'body', '거리 유지 · 이동 재장전', '죽을 때 터지는 담즙에 닿지 않도록 거리를 두고 몸통에 연사합니다. 뒤로 물러나며 재장전할 수 있습니다.'),
    pick('machine-gun', 'body', '거리 유지 · 정지 재장전', '멀리서 몸통을 맞혀 터지는 담즙을 피합니다. 재장전할 때 멈추므로 엄폐를 확보하세요.'),
  ],
  'bile-warrior': [
    pick('autocannon', 'head', '원거리 머리 한 발 · 정지 재장전', '다가오기 전에 머리를 맞혀 처치합니다. 죽을 때 담즙이 터지므로 가까이 붙기 전에 끝내세요.'),
    pick('anti-materiel', 'head', '원거리 정밀 사격', '먼 거리에서 머리를 한 발씩 맞힙니다. 빠르게 다가오는 여러 마리에는 연사 무기가 낫습니다.'),
    pick('machine-gun', 'head', '머리 연사 · 거리 유지', '머리에 연사해 처치합니다. 죽을 때 터지는 담즙에 대비해 거리를 유지하세요.'),
  ],
  'bile-spewer-armored': [
    pick('anti-materiel', 'head', '원거리 머리 · 박격 공격 대응', '멀리서 담즙을 박격포처럼 쏘는 커스틱 스퓨어에는 위키가 대물 저격총 같은 원거리 무기를 권합니다. 먼 거리에서 머리를 맞히세요.'),
    pick('autocannon', 'butt', '큰 복부 직격 · 정지 재장전', '크게 드러난 복부를 직접 맞힙니다. 탄약 배낭이 필요하고 재장전할 때 멈춥니다.'),
    pick('grenade-launcher', 'butt', '복부 폭발 · 낙차 주의', '복부에 유탄을 터뜨립니다. 먼 거리에서는 낙차를 보정해야 합니다.'),
  ],
  'spore-charger': [
    pick('spear', 'head', '유도 대전차 · 포자 구름 속 표적', '포자 구름으로 시야가 가려질 때 위키가 스피어 같은 유도 무기를 권합니다. 고정한 뒤 머리를 노리세요.'),
    pick('recoilless', 'head', '대전차 화력 · 정지 재장전', '구름 밖으로 드러난 머리를 한 발씩 노립니다. 탄약 배낭이 필요하고 재장전할 때 멈춥니다.'),
    pick('quasar', 'head', '탄약 보급 불필요 · 충전 대기', '탄약을 아끼기 좋지만 충전 중 표적을 따라가야 합니다. 구름 속에서는 표적을 놓치기 쉽습니다.'),
  ],
  // Noxious Strain: its wiki page has no tactics yet. The official announcement (Steam, 2026-11-03, cited by the wiki
  // page) suggests shotguns, flamethrowers and grenades against the scavenger and the unarmored belly of the spewer.
  'noxious-scavenger': [
    { ...pick('flamethrower', null, '공식 공지 추천 · 근거리 화염', '공식 공지가 녹셔스 스캐빈저에 화염방사기를 권합니다. 물리기 전에 몰려오는 무리를 태우세요.'), adviceOnly: true,
      source: 'https://store.steampowered.com/news/app/553850/view/708913061799398450',
      limitation: '화염 피해는 불길에 닿은 시간에 따라 달라 처치 탄수를 계산하지 않습니다. 공식 공지는 산탄총과 수류탄도 함께 권합니다.' },
    pick('stalwart', 'body', '몸통 연사 · 이동 재장전', '무리를 넓게 쓸어내며 물러납니다. 물리면 독이 쌓이므로 거리를 유지하세요.'),
    pick('machine-gun', 'body', '몸통 연사 · 정지 재장전', '다가오기 전에 몸통에 연사합니다. 재장전할 때 멈추므로 엄폐를 확보하세요.'),
  ],
  'noxious-spewer': [
    pick('grenade-launcher', 'butt', '장갑 없는 복부 · 폭발', '공식 공지는 중장갑 머리 대신 장갑 없는 복부를 노리라고 합니다. 복부가 터지면 주변을 묶는 거미줄이 퍼지므로 거리를 두세요.'),
    pick('autocannon', 'butt', '장갑 없는 복부 · 직격', '복부를 직접 맞혀 터뜨립니다. 거미줄 폭발 범위 밖에서 쏘세요.'),
  ],
};

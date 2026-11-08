import { expandedEnemies } from './combat-enemies-expanded.js';
import { additionalEnemies } from './combat-enemies-additional.js';
// Reviewed Wiki Anatomy and Detailed Weapon Statistics tables, 2026-09-16.
// Original entries were checked through the search index; expanded anatomy
// entries use the Wiki revision API, with sourceRevision retained below.
// Percentages below use 0–100. Unknown mechanics are not replaced with zero.
export const combatCheckedAt = '2026-09-16';
export const damageSource = 'https://helldivers.wiki.gg/wiki/Damage';
const wiki = page => `https://helldivers.wiki.gg/wiki/${page}`;
const main = (hp, armor, durability, exdr, constitution = 0) => ({ hp, armor, durability, exdr, constitution });
const part = (id, name, hp, armor, durability, exdr, toMain, overflowCap, effect, tip, extra = {}) => ({ id, name, hp, armor, durability, exdr, toMain, overflowCap, effect, tip, ...extra });
const legFlesh = () => part('leg-flesh', '노출된 다리 살점', 800, 2, 70, 25, 50, false, 'kill', '장갑을 벗긴 같은 다리에 계속 맞히세요.', { sourcePart: 'Leg Flesh (4)' });
// Charger-family parts added from the wiki anatomy tables (checked 2026-09-28).
const chargerExtras = ({ mainHp, torsoHp, legHp, legDurability }) => [
  part('torso-armor', '몸통 장갑 → 내부 살점', torsoHp, 4, 85, 25, 100, false, 'armor', '몸통 측면의 같은 장갑판을 벗긴 뒤 드러난 살점을 맞히세요.', {
    sourcePart: 'Torso Armor (2)',
    next: part('inner-flesh', '노출된 몸통 살점', mainHp, 1, 30, 100, 300, true, 'kill', '몸통 장갑을 제거한 같은 위치입니다. 본체 체력 공유 부위이며 직격 피해가 본체에 300% 전달됩니다.', { mainOnly: true, sourcePart: 'Inner Flesh' }),
  }),
  part('underside', '아래쪽 복부', mainHp, 2, 100, 100, 100, true, 'kill', '몸 아래쪽 배를 맞히세요. 장갑 2이며 본체 체력을 공유합니다. 폭발 피해는 본체 장갑으로 따로 계산합니다.', { mainOnly: true, sourcePart: 'Underside' }),
  part('rear-armor', '후방 장갑판', 2200, 4, 75, 100, 75, false, 'kill', '후방 복부 위의 단단한 장갑판을 직접 맞히는 계산입니다. 아래 복부와 장갑·내구·저항이 다릅니다.', { sourcePart: 'Rear Armor Plates' }),
  part('claw', '앞발 한쪽', 500, 4, 70, 100, 70, false, 'break', '머리 앞의 큰 집게발 하나입니다. 부숴도 죽지 않지만 피해의 70%가 본체로 전달됩니다.', { sourcePart: 'Claws (2)' }),
  part('rear-leg', '뒷다리 장갑 → 살점', legHp, 4, legDurability, 25, 50, false, 'armor', '뒷다리 하나의 장갑을 벗긴 뒤 같은 위치의 살점을 계속 맞히세요. 장갑을 벗긴 탄의 초과 피해는 살점에 합산하지 않습니다.', { sourcePart: 'Rear Leg Armor (2)', next: legFlesh() }),
];
const hunter = (id, name, hp, limbHp) => ({
  id, name, faction: '테르미니드', source: wiki('Hunter'), sourceRevision: 135080, family: 'hunter',
  main: main(hp, 0, 0, 0),
  note: '난이도 4 이상 기준입니다. 머리 체력은 40이며, 한쪽 다리 파괴와 처치를 구분합니다.',
  // Every part matches Wiki Anatomy revision 136565 at difficulty 4+ (checked
  // 2026-09-28). The wing was added then.
  anatomyRevision: 136565, anatomyCheckedAt: '2026-09-28',
  parts: [
    part('head', '머리', 40, 0, 0, 100, 100, true, 'kill', '도약하기 전이나 착지한 순간 작은 머리를 맞히세요.', { sourcePart: 'Head' }),
    part('claw', '앞발 한쪽', limbHp, 0, 0, 100, 40, false, 'break', '몸 앞의 길게 뻗은 앞발 한쪽입니다. 앞발 하나를 부쉈다고 즉사하는 부위는 아닙니다.', { sourcePart: 'Claws (2)' }),
    part('leg', '다리 한쪽', limbHp, 0, 0, 100, 50, false, 'break', '같은 다리를 맞혀 움직임과 도약을 방해하세요. 다른 다리에 나눠 맞힌 피해는 합치지 않습니다.', { sourcePart: 'Legs (4)' }),
    part('wing', '날개 한쪽', 20, 0, 0, 100, 30, false, 'break', '등의 날개 한쪽입니다. 날개 파괴는 치명 부위 파괴가 아닙니다.', { sourcePart: 'Wings (2)' }),
  ],
});
const warrior = (id, name, hp, headHp, limbHp) => ({
  id, name, faction: '테르미니드', source: wiki('Warrior'), sourceRevision: 135082, family: 'warrior',
  main: main(hp, 1, 20, 0),
  note: '난이도 4 이상 기준입니다. 머리를 잃어도 잠시 돌진·공격할 수 있어, 머리 파괴는 출혈 시작과 즉사를 나눠 표시합니다.',
  // Every part matches Wiki Anatomy revision 136532 at difficulty 4+ (checked 2026-09-28).
  anatomyRevision: 141593, anatomyCheckedAt: '2026-11-08',
  parts: [
    part('head', '머리', headHp, 1, 20, 100, 100, false, 'bleed', '정면 머리를 노리세요. 머리가 떨어진 뒤에도 다가올 수 있으니 거리를 두세요.', { constitution: 200, sourcePart: 'Head' }),
    part('claw', '앞발 한쪽', limbHp, 1, 0, 100, 40, false, 'break', '몸 앞의 집게 모양 앞발 하나를 노리는 조건입니다.', { sourcePart: 'Claws (2)' }),
    part('leg', '다리 한쪽', limbHp, 1, 0, 100, 40, false, 'break', '다리 하나를 끊어 이동을 방해할 수 있습니다. 절단 자체는 즉사 조건이 아닙니다.', { sourcePart: 'Legs (4)' }),
  ],
});
// Spewer parts match Wiki Anatomy (first checked 2026-09-28, when the spinal
// plates and legs were added). `anatomy` carries each page's revision and,
// when re-checked later, its own anatomyCheckedAt.
const spewer = (id, name, page, armor, note, revision, family = id, anatomy = {}) => ({
  id, name, faction: '테르미니드', source: wiki(page), sourceRevision: revision, family,
  main: main(750, armor, 50, 0), note, anatomyCheckedAt: '2026-09-28', ...anatomy,
  parts: [
    part('head', '머리', 300, armor, 0, 100, 100, true, 'kill', '앞쪽 머리 외피를 노리세요. 머리와 아래의 입은 장갑 수치가 다릅니다.', { sourcePart: 'Head' }),
    part('mouth', '입', 250, 0, 0, 100, 100, true, 'kill', '정면 아래쪽 입 자체를 직접 맞히세요. 위쪽 머리 장갑에 맞은 탄과 구분합니다.', { sourcePart: 'Mouth' }),
    part('butt', '후방 복부', 750, 0, 100, 0, 60, true, 'kill', '옆이나 뒤에서 부푼 복부를 쏘세요. 장갑은 없지만 내구도가 100%라 내구 피해가 중요합니다.', { sourcePart: 'Butt' }),
    part('spinal-plates', '등 척추판', 500, 2, 80, 0, 20, true, 'kill', '등을 따라 난 척추판을 맞히세요. 파괴하면 죽지만 본체 전달은 20%뿐입니다.', { sourcePart: 'Spinal Plates' }),
    part('front-leg', '앞다리 한쪽', 200, 2, 0, 100, 50, false, 'break', '몸 앞쪽 다리 하나입니다. 부숴도 죽지 않습니다.', { sourcePart: 'Front Legs (2)' }),
    part('rear-leg', '뒷다리 한쪽', 250, 2, 30, 100, 50, false, 'break', '몸 뒤쪽 다리 하나입니다. 부숴도 죽지 않습니다.', { sourcePart: 'Rear Legs (2)' }),
  ],
});
// Each build is one tab (table) of the wiki Voteless page, revision 135187
// (checked 2026-09-28). The upper arm was added then. Since revision 140055 the
// Heavy tab caps the forearm's damage to main and not the upper arm's.
const voteless = (id, name, hp, headHp, forearmHp, upperArmHp, table, caps = { forearm: false, upperArm: true }) => ({
  id, name, faction: '일루미닛', source: wiki('Voteless'), sourceRevision: 135187, family: 'voteless',
  anatomyRevision: 141977, anatomyCheckedAt: '2026-11-08', anatomyTable: table, anatomyTables: [table],
  main: main(hp, 0, 0, 0, 100),
  note: '체형별 체력이 다릅니다. 머리는 치명 부위입니다. 다리를 잃고도 기어올 수 있어 다리 파괴는 즉사로 취급하지 않습니다. 본체 체력 소진 후의 출혈도 반영합니다.',
  parts: [
    part('head', '머리', headHp, 1, 0, 100, 100, true, 'kill', '몸통보다 체력이 낮은 머리를 직접 맞히세요.', { sourcePart: 'Head' }),
    part('forearm', '아래팔 한쪽', forearmHp, 0, 0, 100, 30, caps.forearm, 'break', '팔꿈치 아래의 팔 한쪽을 노리는 계산입니다. 팔 하나가 떨어져도 살아 있을 수 있습니다.', { sourcePart: 'Forearms (2)' }),
    part('leg', '다리', 80, 0, 0, 100, 30, true, 'break', '다리를 끊어 쓰러뜨려도 기어와 공격할 수 있습니다. 확실히 끝내려면 머리를 노리세요.', { sourcePart: 'Legs' }),
    part('upper-arm', '위팔 한쪽', upperArmHp, 0, 0, 100, 40, caps.upperArm, 'break', '팔꿈치 위의 팔 한쪽입니다. 떨어져도 바로 죽지 않지만 피해의 40%가 본체로 들어갑니다.', { constitution: 1000, sourcePart: 'Upper Arms (2)' }),
  ],
});

const originalEnemies = [
  {
    id: 'charger', name: '차저', faction: '테르미니드', source: wiki('Charger'),
    main: main(2400, 4, 100, 25, 750),
    note: '머리 파괴는 즉사, 후방 복부 파괴는 출혈을 유발합니다. 다리는 장갑과 살점을 따로 계산합니다.',
    // Every part matches Wiki Anatomy revision 137700 (checked 2026-10-22).
    // Parts after the first three were added then.
    anatomyRevision: 141505, anatomyCheckedAt: '2026-11-08',
    parts: [
      part('head', '머리', 1200, 4, 75, 25, 70, false, 'kill', '정면 머리 중앙을 노리세요. 등 장갑에 빗맞으면 다른 부위입니다.', { sourcePart: 'Head' }),
      part('butt', '후방 복부', 950, 0, 80, 25, 150, false, 'bleed', '돌진을 피한 뒤 뒤쪽의 드러난 복부를 쏘세요. 파괴 후에도 바로 죽지 않을 수 있습니다.', { sourcePart: 'Butt' }),
      part('front-leg', '앞다리 장갑 → 살점', 800, 4, 70, 25, 60, false, 'armor', '한쪽 앞다리에 집중하세요. 장갑을 벗긴 탄의 초과 피해는 살점으로 넘어가지 않습니다.', { sourcePart: 'Front Leg Armor (2)', next: legFlesh() }),
      ...chargerExtras({ mainHp: 2400, torsoHp: 800, legHp: 800, legDurability: 70 }),
    ],
  },
  {
    id: 'behemoth', name: '베히모스 차저', faction: '테르미니드', source: wiki('Charger_Behemoth'),
    main: main(3000, 4, 100, 25, 1000),
    note: '일반 차저보다 머리와 앞다리 장갑이 튼튼합니다. 같은 부위에 연속으로 맞히는 조건입니다.',
    // Every part matches Wiki Anatomy revision 137702 (checked 2026-10-22).
    // Parts after the first three were added then.
    anatomyRevision: 141504, anatomyCheckedAt: '2026-11-08',
    parts: [
      part('head', '머리', 1600, 4, 100, 25, 70, false, 'kill', '정면 머리를 노리세요. 일반 차저의 탄수를 그대로 적용하지 마세요.', { sourcePart: 'Head' }),
      part('butt', '후방 복부', 950, 0, 100, 25, 50, false, 'bleed', '뒤쪽 복부를 부수면 출혈이 시작됩니다. 장갑은 없지만 내구도가 높습니다.', { sourcePart: 'Butt' }),
      part('front-leg', '앞다리 장갑 → 살점', 1000, 4, 80, 25, 60, false, 'armor', '장갑 제거 후 같은 다리의 살점을 공격하세요.', { sourcePart: 'Front Leg Armor (2)', next: legFlesh() }),
      ...chargerExtras({ mainHp: 3000, torsoHp: 1000, legHp: 1000, legDurability: 80 }),
    ],
  },
  {
    id: 'bile-titan', name: '바일 타이탄', faction: '테르미니드', source: wiki('Bile_Titan'),
    main: main(6500, 4, 100, 50),
    note: '담즙낭을 부수는 것과 처치는 다릅니다. 노출된 복부의 탄수에는 외피를 제거하는 공격이 포함되지 않습니다.',
    // Every part matches Wiki Anatomy revision 138514 (checked 2026-10-22,
    // compared by scripts/test-anatomy.mjs). Parts after the first three
    // were added on 2026-09-28, so legacy results keep their order.
    anatomyRevision: 141861, anatomyCheckedAt: '2026-11-08',
    // Both bile sacs have the same numbers and are shown as one part.
    anatomyMerged: { 'Lower Sac': 'sac' },
    parts: [
      part('head', '머리', 1500, 4, 95, 50, 100, false, 'kill', '정면 머리를 정확히 맞히세요. 목이나 몸통에 맞은 탄은 이 계산에 포함되지 않습니다.', { sourcePart: 'Head' }),
      part('sac', '담즙낭 한 개', 750, 0, 100, 50, 100, true, 'break', '아래쪽의 부푼 담즙낭입니다. 이 부위 하나의 파괴만으로 즉사하지 않습니다.', { sourcePart: 'Upper Sac' }),
      part('underside', '노출된 복부', 4000, 2, 80, 0, 60, false, 'kill', '외피가 파괴되어 드러난 복부를 계속 공격하는 조건입니다.', { prerequisite: '복부 외피 제거 후', isolated: true, sourcePart: 'Underside' }),
      part('torso-armor', '몸통 장갑 → 내부 살점', 1500, 4, 100, 50, 100, false, 'armor', '옆구리의 몸통 장갑판 하나를 벗긴 뒤 같은 자리의 속살을 계속 공격하세요.', {
        sourcePart: 'Torso Armor (2)',
        next: part('inner-flesh', '노출된 몸통 살점', 6500, 0, 70, 50, 100, true, 'kill', '장갑을 벗긴 몸통 속살입니다. 장갑 0·내구 70%이며 본체 체력을 공유합니다.', { mainOnly: true, sourcePart: 'Inner Flesh' }),
      }),
      part('butt-armor', '후방 복부 장갑', 3500, 4, 100, 50, 100, true, 'kill', '뒤로 돌아가 꼬리 쪽의 단단한 복부 장갑을 맞히세요. 담즙낭과 다른 치명 부위입니다.', { sourcePart: 'Butt Armor' }),
      part('claw', '앞발 한쪽', 1000, 4, 0, 50, 100, false, 'break', '머리 앞의 집게 모양 앞발 하나입니다. 부숴도 죽지 않지만 피해가 모두 본체로 전달됩니다.', { sourcePart: 'Claws (2)' }),
      part('front-left-leg', '왼앞다리 장갑 → 살점', 1000, 4, 100, 50, 100, false, 'armor', '적 기준 왼앞다리의 장갑판 하나를 벗긴 뒤 같은 자리의 살점을 계속 공격하세요.', {
        sourcePart: 'Leg Armor (12)',
        next: part('front-left-leg-flesh', '노출된 왼앞다리 살점', 2000, 4, 100, 50, 100, false, 'kill', '체력 2,000과 줄지 않는 추가 체력 1,500을 모두 소진하면 죽습니다. 그 전에 본체 체력이 바닥나도 죽습니다.', { staticConstitution: 1500, sourcePart: 'Front Left Leg Flesh' }),
      }),
      part('leg', '다리 장갑 → 살점', 1000, 4, 100, 50, 100, false, 'armor', '왼앞다리를 뺀 나머지 다리 하나의 장갑판을 벗긴 뒤 같은 자리의 살점을 계속 공격하세요.', {
        sourcePart: 'Leg Armor (12)',
        next: part('leg-flesh', '노출된 나머지 다리 살점', 2000, 4, 100, 50, 100, false, 'kill', '체력 2,000과 줄지 않는 추가 체력 2,000을 모두 소진하면 죽습니다. 그 전에 본체 체력이 바닥나도 죽습니다.', { staticConstitution: 2000, sourcePart: 'Leg Flesh (3)' }),
      }),
    ],
  },
  {
    id: 'hulk', name: '헐크 스코처', faction: '오토마톤', source: wiki('Hulk_Scorcher'),
    main: main(1800, 4, 60, 0),
    note: '화염방사기형 헐크 기준입니다. 눈은 폭발 피해를 받지 않으며, 후방 방열판 파괴 후에도 잠시 생존할 수 있습니다.',
    // Every part matches Wiki Anatomy revision 139406 (checked 2026-10-22).
    // Parts after the first two were added then.
    anatomyRevision: 141866, anatomyCheckedAt: '2026-11-08',
    parts: [
      part('head', '정면의 붉은 눈', 250, 4, 25, 100, 100, true, 'kill', '작은 붉은 눈에 직접 맞혀야 합니다. 주변 얼굴 장갑에 맞는 것과 다릅니다.', { sourcePart: 'Head' }),
      part('heatsink', '후방 방열판', 900, 1, 60, 0, 60, true, 'bleed', '뒤쪽 주황색 방열판을 쏘세요. 파괴 후 남은 추가 체력이 감소하며 죽습니다.', { constitution: 650, sourcePart: 'Heatsink' }),
      part('arm', '팔 한쪽', 500, 4, 70, 100, 80, false, 'break', '화염방사기나 무기를 든 팔 하나입니다. 부숴도 죽지 않지만 초과 피해까지 80%가 본체로 들어갑니다.', { sourcePart: 'Arms (2)' }),
      part('leg', '다리 한쪽', 500, 4, 80, 100, 80, false, 'break', '다리 하나를 부수면 쓰러뜨릴 수 있지만 죽지는 않습니다. 체력 500과 줄지 않는 추가 체력 500을 모두 소진해야 합니다.', { staticConstitution: 500, sourcePart: 'Legs (2)' }),
    ],
  },
  {
    id: 'devastator', name: '데바스테이터 · 기본형', faction: '오토마톤', source: wiki('Devastator'),
    main: main(750, 2, 0, 0), note: '머리와 복부가 흉부보다 얇습니다. 로켓형·중장갑형의 장비와 방패는 포함하지 않습니다.',
    // Every part matches Wiki Anatomy revision 138977 (checked 2026-10-22).
    // Parts after the legacy ones were added then.
    anatomyRevision: 138977, anatomyCheckedAt: '2026-10-22',
    parts: [
      part('head', '머리', 110, 1, 0, 100, 100, true, 'kill', '흉부 위로 드러난 작은 얼굴을 노리세요.', { sourcePart: 'Head' }),
      part('stomach', '복부', 350, 1, 0, 100, 100, true, 'kill', '가슴 장갑 아래 허리의 노출 부위를 노리세요.', { sourcePart: 'Stomach' }),
      part('torso', '흉부 장갑', 425, 3, 30, 100, 100, true, 'kill', '넓어서 맞히기 쉽지만 머리·복부보다 높은 관통이 필요합니다.', { sourcePart: 'Torso' }),
      part('shoulder', '어깨 한쪽', 150, 2, 0, 100, 25, true, 'break', '팔이 붙은 어깨 장갑 하나입니다. 부숴도 죽지 않습니다.', { sourcePart: 'Shoulders (2)' }),
      part('arm', '팔 한쪽', 260, 1, 0, 100, 50, false, 'break', '무기를 든 팔 하나입니다. 부숴도 죽지 않습니다.', { sourcePart: 'Arms (2)' }),
      part('pelvis', '골반부', 500, 2, 0, 100, 75, true, 'kill', '허리 아래 골반을 맞히세요. 파괴하면 죽습니다.', { sourcePart: 'Pelvis' }),
      part('leg', '다리 한쪽', 500, 2, 30, 100, 60, true, 'kill', '다리 하나를 계속 맞히세요. 파괴하면 죽습니다.', { sourcePart: 'Legs (2)' }),
    ],
  },
  {
    id: 'berserker', name: '버서커', faction: '오토마톤', source: wiki('Berserker'),
    main: main(750, 0, 0, 0), note: '작은 머리나 허리의 복부를 노리세요. 각 부위의 체력은 서로 별개입니다.',
    // Every part matches Wiki Anatomy revision 138975 (checked 2026-10-22).
    // Parts after the legacy ones were added then.
    anatomyRevision: 138975, anatomyCheckedAt: '2026-10-22',
    parts: [
      part('head', '머리', 110, 1, 0, 100, 100, true, 'kill', '접근하는 적의 작은 머리를 직접 맞히세요.', { sourcePart: 'Head' }),
      part('stomach', '복부', 350, 1, 0, 100, 100, true, 'kill', '움직이는 머리를 맞히기 어렵다면 복부를 노리세요.', { sourcePart: 'Stomach' }),
      part('chest', '흉부', 425, 2, 40, 100, 100, true, 'kill', '가슴은 내구도가 있어 표기 피해보다 적게 들어갑니다.', { sourcePart: 'Chest' }),
      part('pelvis', '골반부', 600, 1, 0, 100, 65, true, 'kill', '허리 아래 골반을 맞히세요. 파괴하면 죽습니다.', { sourcePart: 'Pelvis' }),
      part('shoulder', '어깨 한쪽', 180, 0, 0, 100, 0, true, 'break', '어깨 부분입니다. 부숴도 죽지 않고 본체에 피해가 가지 않습니다.', { sourcePart: 'Shoulder (2)' }),
      part('arm', '팔 한쪽', 260, 1, 30, 100, 50, true, 'break', '톱날이 달린 팔 하나입니다. 부숴도 죽지 않습니다.', { sourcePart: 'Arm (2)' }),
      part('leg', '다리 한쪽', 750, 1, 30, 100, 0, true, 'kill', '다리 하나를 계속 맞히세요. 파괴하면 죽지만 본체에는 피해가 가지 않습니다.', { sourcePart: 'Leg (2)' }),
    ],
  },
  {
    id: 'overseer', name: '오버시어 · 지상형', faction: '일루미닛', source: wiki('Overseer'),
    main: main(600, 0, 0, 0),
    shield: { hp: 1500, armor: 2, label: '방패를 피해서 공격할 수 있음', note: '팔의 방패를 우회해 해당 부위를 직접 맞히는 조건입니다. 방패에 맞는 탄수는 포함하지 않습니다.' },
    note: '흉부는 장갑을 먼저 벗겨야 합니다. 방패가 사선을 가리고 있다면 아래의 직격 계산을 그대로 적용할 수 없습니다.',
    // Every part matches Wiki Anatomy revision 140056 (checked 2026-10-31).
    // Parts after the legacy ones were added on 2026-09-28.
    anatomyRevision: 140056, anatomyCheckedAt: '2026-10-31',
    anatomyOmitted: { Shield: 'The arm shield is the shield toggle (hits that get past it), not a part' },
    parts: [
      part('head', '머리·투구', 150, 3, 0, 100, 100, true, 'kill', '장갑 관통이 충분하면 투구를 쏘세요.', { sourcePart: 'Head' }),
      part('chest-armor', '흉부 장갑 → 몸통', 150, 2, 0, 100, 20, false, 'armor', '흉부 장갑을 벗긴 뒤 같은 위치의 몸통을 쏘세요.', { sourcePart: 'Chest Armor',
        next: part('torso', '노출된 몸통', 600, 1, 0, 100, 100, true, 'kill', '벗겨진 장갑 아래 몸통입니다.', { sourcePart: 'Torso' }),
      }),
      part('crotch-armor', '사타구니 장갑 → 몸통', 200, 2, 0, 100, 20, false, 'armor', '하복부 장갑을 벗긴 다음 같은 몸통을 공격하세요.', { sourcePart: 'Crotch Armor', next: part('torso', '노출된 몸통', 600, 1, 0, 100, 100, true, 'kill', '벗겨진 하복부 안쪽입니다.', { sourcePart: 'Torso' }) }),
      part('limb-armor', '팔다리 장갑 한 개', 100, 2, 0, 100, 20, false, 'break', '팔다리를 덮은 장갑판 하나입니다. 부숴도 죽지 않습니다.', { sourcePart: 'Limb Armor (8)' }),
      part('right-arm', '오른팔', 300, 1, 0, 100, 50, true, 'kill', '무기를 든 오른팔입니다. 파괴하면 죽습니다.', { sourcePart: 'Right Arm' }),
      part('left-arm', '왼팔', 300, 1, 0, 100, 50, true, 'break', '왼팔입니다. 부숴도 죽지 않지만 피해의 절반이 본체로 전달됩니다.', { sourcePart: 'Left Arm' }),
      part('leg', '다리 한쪽', 600, 0, 0, 100, 70, true, 'break', '다리 하나입니다. 본체 체력을 공유하며, 피해의 70%가 본체로 들어갑니다.', { mainOnly: true, sourcePart: 'Legs (2)' }),
    ],
  },
  {
    id: 'harvester', name: '하베스터', faction: '일루미닛', source: wiki('Harvester'),
    main: main(3000, 4, 70, 0),
    shield: { hp: 1500, armor: 0, label: '보호막이 이미 제거된 상태', note: '보호막은 강한 한 발도 흡수하고 다시 생성될 수 있습니다. 보호막 제거에 쓴 탄수는 아래 계산에서 제외합니다.' },
    note: '다리와 몸통을 잇는 가로 관절이 치명 부위입니다. 눈은 파괴해도 생존하며 빔 공격이 강해질 수 있습니다.',
    // Every part matches Wiki Anatomy revision 140061 (checked 2026-10-31),
    // the Intact and Armor Broken tabs. Parts after the first four were added on 2026-09-28.
    anatomyRevision: 140061, anatomyCheckedAt: '2026-10-31',
    anatomyMerged: { 'Armor Broken: Damaged Chassis': 'chassis' },
    anatomyOmitted: { Shield: 'The energy shield is the shield toggle (cleared before counting), not a part' },
    parts: [
      part('joint', '오른쪽·중앙 고관절 한 곳', 1000, 3, 70, 100, 60, true, 'kill', '몸통 바로 아래, 다리가 시작되는 가로 연결부 한 곳에 집중하세요.', { sourcePart: 'Right & Middle Hip Joints (2)' }),
      part('left-joint', '왼쪽 고관절', 1000, 3, 70, 100, 45, true, 'kill', '왼쪽 연결부도 파괴하면 죽습니다. 본체로 전달되는 피해 비율은 다릅니다.', { sourcePart: 'Left Hip Joint' }),
      part('eye', '눈', 350, 2, 0, 100, 120, false, 'break', '눈 파괴 자체는 즉사가 아닙니다. 강한 탄의 초과 피해로 본체 체력을 소진하면 처치할 수 있습니다.', { sourcePart: 'Eye' }),
      part('generator', '보호막 생성기 한 개', 350, 3, 0, 100, 10, true, 'break', '눈 위아래의 돌출 부위를 하나 파괴하면 보호막 재생을 막을 수 있습니다.', { sourcePart: 'Shield Generators (3)' }),
      part('chassis', '몸통', 2000, 4, 75, 0, 100, true, 'kill', '다리 위의 둥근 몸통 본체를 맞히세요. 파괴하면 죽습니다.', { sourcePart: 'Chassis' }),
      part('carapace', '등갑 → 내부', 800, 4, 75, 100, 100, false, 'armor', '몸통 위 등갑 한 장을 벗긴 뒤 드러난 내부를 계속 맞히세요.', {
        sourcePart: 'Carapace (2)',
        next: part('internals', '노출된 몸통 내부', 800, 2, 50, 0, 100, true, 'kill', '등갑을 벗겨 드러난 내부입니다. 파괴하면 죽습니다.', { sourcePart: 'Armor Broken: Internals (2)' }),
      }),
      part('carapace-weakspot', '등갑 약점 한 곳', 500, 1, 80, 100, 100, false, 'break', '등갑의 얇은 약점입니다. 부숴도 죽지 않지만 초과 피해까지 모두 본체로 전달됩니다.', { sourcePart: 'Carapace Weakspots (2)' }),
      part('left-upper-thigh', '왼쪽 윗다리 장갑 → 내부', 600, 4, 75, 100, 30, true, 'armor', '왼쪽 다리 위쪽 장갑을 벗긴 뒤 드러난 내부를 계속 맞히세요.', {
        sourcePart: 'Left Upper Thigh Armor',
        next: part('left-upper-leg-internals', '노출된 윗다리 내부', 1000, 3, 25, 100, 45, true, 'kill', '장갑을 벗겨 드러난 윗다리 내부입니다. 파괴하면 죽습니다.', { sourcePart: 'Armor Broken: Right & Left Upper Leg Internals (3)' }),
      }),
      part('upper-thigh', '오른쪽·가운데 윗다리 장갑 → 내부', 900, 4, 75, 100, 30, true, 'armor', '오른쪽이나 가운데 다리 위쪽 장갑을 벗긴 뒤 드러난 내부를 계속 맞히세요. 가운데 다리는 본체 전달률이 더 높습니다.', {
        sourcePart: 'Right & Middle Upper Thigh Armor (2)',
        next: part('upper-leg-internals', '노출된 윗다리 내부', 1000, 3, 25, 100, 45, true, 'kill', '장갑을 벗겨 드러난 윗다리 내부입니다. 파괴하면 죽습니다.', { sourcePart: 'Armor Broken: Right & Left Upper Leg Internals (3)' }),
      }),
      part('middle-upper-leg-internals', '노출된 가운데 윗다리 내부', 1000, 3, 25, 100, 60, true, 'kill', '가운데 다리 위쪽 장갑이 벗겨진 뒤 드러난 내부입니다. 파괴하면 죽습니다.', { prerequisite: '가운데 윗다리 장갑 제거 후', sourcePart: 'Armor Broken: Middle Upper Leg Internals' }),
      part('lower-thigh', '아랫다리 장갑 → 내부', 900, 4, 75, 100, 30, true, 'armor', '다리 아래쪽 장갑 한 장을 벗긴 뒤 드러난 내부를 계속 맞히세요.', {
        sourcePart: 'Lower Thigh Armor (3)',
        next: part('lower-leg-internals', '노출된 아랫다리 내부', 1000, 3, 25, 100, 60, true, 'kill', '장갑을 벗겨 드러난 아랫다리 내부입니다. 파괴하면 죽습니다.', { sourcePart: 'Armor Broken: Lower Leg Internals (3)' }),
      }),
      part('shin-armor', '정강이 장갑 한 개', 900, 4, 75, 100, 30, true, 'break', '다리 정강이의 장갑판 하나입니다. 부숴도 죽지 않습니다.', { sourcePart: 'Shin armor (3)' }),
      part('left-foot-armor', '왼발 장갑', 900, 4, 0, 100, 30, true, 'break', '왼쪽 다리 끝의 발 장갑입니다. 부숴도 죽지 않습니다.', { sourcePart: 'Left Foot Armor' }),
      part('foot-armor', '오른발·가운데 발 장갑 한 개', 900, 4, 75, 100, 30, true, 'break', '오른쪽이나 가운데 다리 끝의 발 장갑입니다. 부숴도 죽지 않습니다.', { sourcePart: 'Right & Middle Foot Armor (2)' }),
      part('leg-internals', '노출된 다리 내부', 1000, 3, 25, 100, 60, true, 'kill', '장갑 사이로 드러난 다리 내부를 맞히세요. 파괴하면 죽습니다.', { sourcePart: 'Exposed Leg Internals' }),
    ],
  },
  hunter('hunter-hardened', '헌터', 160, 60),
  {
    id: 'predator-hunter', name: '프레데터 헌터', faction: '테르미니드', family: 'predator-hunter',
    source: wiki('Predator_Hunter'), sourceRevision: 135098, checkedAt: '2026-09-17',
    // Every part matches Wiki Anatomy revision 139037 (checked 2026-10-22).
    anatomyRevision: 141544, anatomyCheckedAt: '2026-11-08',
    main: main(175, 0, 0, 0),
    note: '은신·담즙 발사·측면 도약을 사용하는 변종입니다. 본체 체력 175는 일반 고난이도 헌터 160과 다릅니다. 머리는 치명 부위이며 앞발·다리·날개 하나의 파괴는 처치가 아닙니다.',
    parts: [
      part('body', '본체', 175, 0, 0, 0, 100, true, 'kill', '몸통 중앙에 집중하세요. 개별 부위 파괴 대신 본체 체력을 소진하는 경로입니다.', { mainOnly: true, sourcePart: 'Main' }),
      part('head', '머리', 40, 0, 0, 100, 100, true, 'kill', '은신이 풀리거나 착지한 순간 작은 머리를 직접 맞히세요.', { sourcePart: 'Head' }),
      part('claw', '앞발 한쪽', 60, 0, 0, 100, 40, false, 'break', '길게 뻗은 앞발 한쪽입니다. 한쪽 파괴는 처치와 다릅니다.', { sourcePart: 'Claws (2)' }),
      part('leg', '다리 한쪽', 60, 0, 0, 100, 50, false, 'break', '같은 다리를 맞혀 이동과 도약을 방해하세요. 한 다리 파괴만으로 죽지 않습니다.', { sourcePart: 'Legs (4)' }),
      part('wing', '날개 한쪽', 20, 0, 0, 100, 30, false, 'break', '등의 날개 한쪽입니다. 날개 파괴는 치명 부위 파괴가 아닙니다.', { sourcePart: 'Wings (2)' }),
    ],
  },
  warrior('warrior-hardened', '워리어', 325, 150, 100),
  {
    id: 'hive-guard', name: '하이브 가드', faction: '테르미니드', source: wiki('Hive_Guard'), sourceRevision: 135085,
    // Every part matches Wiki Anatomy revision 141215 (checked 2026-11-03).
    // Additional anatomy parts were first reviewed on 2026-10-22.
    anatomyRevision: 141215, anatomyCheckedAt: '2026-11-03',
    main: main(500, 2, 30, 0),
    note: '머리 장갑은 3, 노출된 사지는 1입니다. 머리 파괴 후에도 출혈 중 공격할 수 있습니다. 사지 한쪽의 파괴를 처치와 구분합니다.',
    parts: [
      part('head', '머리 장갑', 250, 3, 35, 100, 75, false, 'bleed', '정면의 넓은 머리 장갑을 뚫으려면 AP 3 이상이 필요합니다.', { constitution: 200, sourcePart: 'Head' }),
      part('claw', '앞발 한쪽', 100, 1, 0, 100, 25, false, 'break', '머리 아래의 노출된 앞발을 맞히세요. 장갑판에 빗맞으면 관통 조건이 달라집니다.', { sourcePart: 'Claws (2)' }),
      part('claw-both', '앞발 양쪽', 100, 1, 0, 100, 25, false, 'kill', '양쪽 앞발을 모두 부수면 처치됩니다(위키 2026-11-02 기준). 한쪽을 부순 뒤 다른 쪽을 새로 조준하는 횟수입니다.', { sourcePart: 'Claws (2)', copies: 2 }),
      part('rear-leg', '뒷다리 한쪽', 125, 1, 0, 100, 35, false, 'break', '옆이나 뒤에서 장갑으로 가리지 않은 뒷다리를 노리세요.', { sourcePart: 'Rear Legs (2)' }),
      part('front-tarsal-plate', '앞다리 족판 한쪽', 125, 3, 0, 100, 45, false, 'break', '앞다리 앞을 덮은 두꺼운 족판입니다. 장갑 3이며 부숴도 죽지 않습니다.', { sourcePart: 'Frontal Tarsal Plate Armor (2)' }),
      part('front-leg', '앞다리 한쪽', 125, 1, 0, 100, 45, false, 'break', '족판에 가리지 않은 앞다리 부분입니다. 부숴도 죽지 않습니다.', { sourcePart: 'Front Legs (2)' }),
    ],
  },
  {
    id: 'brood-commander', name: '브루드 커맨더', faction: '테르미니드', source: wiki('Brood_Commander'), sourceRevision: 135088,
    main: main(800, 2, 60, 0),
    note: '기본 브루드 커맨더 기준이며 알파 커맨더와 다릅니다. 머리를 잃어도 출혈이 끝나기 전까지 돌진할 수 있습니다.',
    // Every part matches Wiki Anatomy revision 141213 (checked 2026-11-03).
    anatomyRevision: 141213, anatomyCheckedAt: '2026-11-03',
    parts: [
      part('head', '머리', 200, 2, 60, 100, 50, false, 'bleed', '머리가 떨어져도 즉시 멈추지 않습니다. 출혈이 끝날 때까지 접근을 피하세요.', { constitution: 300, sourcePart: 'Head' }),
      part('claw', '앞발 한쪽', 200, 2, 50, 100, 50, false, 'break', '몸 앞의 큰 앞발 하나에 집중하는 계산입니다.', { sourcePart: 'Claws (2)' }),
      part('claw-both', '앞발 양쪽', 200, 2, 50, 100, 50, false, 'kill', '양쪽 앞발을 모두 부수면 처치됩니다(위키 2026-11-02 기준). 한쪽을 부순 뒤 다른 쪽을 새로 조준하는 횟수입니다.', { sourcePart: 'Claws (2)', copies: 2 }),
      part('leg', '다리 한쪽', 170, 1, 40, 100, 60, false, 'break', '장갑이 얇은 옆 다리를 노려 이동과 돌진 속도를 낮추세요.', { sourcePart: 'Legs (4)' }),
    ],
  },
  // The wiki table gives armor 2 for the main body and head, also at the
  // reviewed revision 135087; the earlier 3 came from a difficulty 6+ remark.
  spewer('bile-spewer-armored', '바일 스퓨어', 'Caustic_Spewer', 2, '너싱 스퓨어의 무장 변종으로, 위키 부위 표 기준 본체·머리 장갑은 2입니다. 입과 후방 복부에는 장갑이 없습니다.', 135087, 'bile-spewer',
    { anatomyRevision: 141791, anatomyCheckedAt: '2026-11-08', anatomyLegacy: { 'main.armor': 3, 'head.armor': 3 } }),
  spewer('nursing-spewer', '너싱 스퓨어', 'Nursing_Spewer', 2, '노란 복부의 너싱 스퓨어 기준입니다.', 135086, 'nursing-spewer', { anatomyRevision: 141638 }),
  {
    id: 'stalker', name: '스토커', faction: '테르미니드', source: wiki('Stalker'), sourceRevision: 135091,
    main: main(800, 1, 50, 0),
    note: '작은 머리의 체력이 낮습니다. 아래 탄수는 회복할 틈 없이 같은 부위를 연속으로 맞히는 조건이며, 도주 중 체력 회복은 포함하지 않습니다.',
    // Every part matches Wiki Anatomy revision 136802 (checked 2026-09-28).
    // Parts after the first three were added then.
    anatomyRevision: 136802, anatomyCheckedAt: '2026-09-28',
    parts: [
      part('head', '머리', 175, 1, 0, 100, 100, true, 'kill', '위장 상태에서도 몸 중앙 앞쪽의 작은 머리를 노리세요.', { sourcePart: 'Head' }),
      part('body-armor', '몸통 외피', 800, 2, 50, 100, 100, true, 'break', '넓은 몸통 외피입니다. 이 부위는 본체 체력을 공유하며, 머리보다 많은 피해가 필요합니다.', { sourcePart: 'Body Armor' }),
      part('underbelly', '아래쪽 복부', 800, 1, 50, 100, 100, true, 'kill', '몸 아래쪽의 얇은 복부를 직접 맞히세요. 위쪽 외피와 장갑 수치가 다릅니다.', { sourcePart: 'Underbelly' }),
      part('claw', '앞발 한쪽', 800, 1, 50, 100, 100, true, 'break', '몸 앞의 앞발 하나입니다. 본체 체력을 공유해 피해가 모두 본체로 들어갑니다.', { mainOnly: true, sourcePart: 'Claws (2)' }),
      part('leg', '다리 한쪽', 800, 1, 50, 100, 100, true, 'break', '다리 하나를 맞히는 조건입니다. 본체 체력을 공유해 피해가 모두 본체로 들어갑니다.', { mainOnly: true, sourcePart: 'Legs (4)' }),
      part('wing', '날개', 125, 0, 50, 100, 30, true, 'break', '등의 날개입니다. 체력 125로 따로 부서지며 본체에는 30%만 전달됩니다.', { sourcePart: 'Wings' }),
    ],
  },
  {
    id: 'impaler', name: '임페일러', faction: '테르미니드', source: wiki('Impaler'), sourceRevision: 135095,
    main: main(4000, 4, 100, 0),
    note: '촉수를 땅에 박으면 머리가 드러납니다. 얼굴 노출과 다리 장갑 제거를 구분하며, 촉수 하나의 파괴와 본체 처치도 구분합니다.',
    // Every part matches Wiki Anatomy revision 136861 (checked 2026-09-28,
    // compared by scripts/test-anatomy.mjs). Parts after the first three
    // were added then, so legacy results keep their order.
    anatomyRevision: 136861, anatomyCheckedAt: '2026-09-28',
    parts: [
      part('head', '노출된 머리', 1250, 1, 75, 0, 150, false, 'kill', '촉수를 땅에 박았을 때 드러나는 얼굴을 맞히세요. 평소 앞을 덮는 촉수 장갑과 다른 부위입니다.', { prerequisite: '얼굴 노출 중', prerequisiteNote: '촉수를 땅에 박아 얼굴이 드러난 동안의 탄수입니다. 얼굴이 가려져 있으면 이 결과를 적용하지 않습니다.', sourcePart: 'Head' }),
      part('leg-armor', '다리 장갑 → 살점', 1000, 4, 70, 0, 50, false, 'armor', '다리 하나의 장갑을 벗긴 뒤 같은 위치의 살점을 맞히세요.', { sourcePart: 'Leg Armor (4)', next: part('leg-flesh', '노출된 다리 살점', 1000, 0, 70, 0, 50, false, 'kill', '장갑을 벗긴 바로 그 다리입니다.', { sourcePart: 'Leg Flesh (4)' }) }),
      part('tentacle', '촉수 살점 한 개', 500, 1, 70, 0, 50, false, 'break', '사진에서 색으로 표시한 촉수 살점 한 가닥을 맞히는 조건입니다. 딱딱한 바깥 장갑과 구분하세요.', { sourcePart: 'Tentacle Flesh (3)' }),
      part('tentacle-armor', '촉수 장갑 한 개', 4000, 4, 75, 0, 100, true, 'break', '얼굴 앞을 덮는 딱딱한 촉수 장갑입니다. 부서지지 않고 본체 체력을 공유하며, 피해가 모두 본체로 전달됩니다.', { mainOnly: true, sourcePart: 'Tentacle Armor (3)' }),
      part('crest-armor', '볏 장갑', 1000, 4, 80, 0, 75, true, 'break', '머리 위의 볏 모양 장갑입니다. 부숴도 죽지 않으며, 본체로 전달되는 피해는 이 부위 체력까지입니다.', { sourcePart: 'Crest Armor' }),
      part('torso-armor', '몸통 장갑 → 내부 살점', 1000, 4, 75, 0, 75, true, 'armor', '옆이나 뒤에서 몸통 장갑판 하나를 벗긴 뒤 같은 자리의 속살을 계속 공격하세요.', {
        sourcePart: 'Torso Armor (2)',
        next: part('inner-flesh', '노출된 몸통 살점', 4000, 0, 90, 100, 150, true, 'kill', '장갑을 벗긴 몸통 속살입니다. 본체 체력을 공유하고 피해의 150%가 본체로 들어갑니다. 폭발 피해는 본체 장갑으로 따로 계산합니다.', { mainOnly: true, sourcePart: 'Inner Flesh' }),
      }),
      part('underside', '아래쪽 복부', 4000, 2, 100, 100, 150, true, 'kill', '몸 아래쪽을 맞히세요. 장갑 2로 얇고 본체 체력을 공유하며, 피해의 150%가 본체로 들어갑니다.', { mainOnly: true, sourcePart: 'Underside' }),
      part('rear-armor', '후방 장갑판', 1000, 4, 75, 0, 75, true, 'break', '몸 뒤쪽의 장갑판입니다. 부숴도 죽지 않으며, 본체로 전달되는 피해는 이 부위 체력까지입니다.', { sourcePart: 'Rear Armor Plates' }),
      part('butt', '후방 복부', 1100, 1, 85, 0, 140, false, 'break', '뒤쪽 끝의 장갑이 얇은 부위입니다. 부숴도 죽지 않지만, 한 발의 초과 피해까지 140%로 본체에 들어갑니다.', { sourcePart: 'Butt' }),
    ],
  },
  {
    id: 'shrieker', name: '슈리커', faction: '테르미니드', source: wiki('Shrieker'), sourceRevision: 135081,
    // Every part matches Wiki Anatomy revision 136531 (checked 2026-09-28).
    // The limbs were added then.
    anatomyRevision: 136531, anatomyCheckedAt: '2026-09-28',
    main: main(80, 0, 0, 0),
    note: '머리 또는 날개 한쪽을 파괴하면 추락합니다. 날개는 체력은 낮지만 내구도가 100%입니다. 떨어지는 사체도 피하세요.',
    parts: [
      part('head', '머리', 30, 0, 0, 100, 100, true, 'kill', '날개 사이의 작은 머리를 노리세요.', { sourcePart: 'Head' }),
      part('wing', '날개 한쪽', 20, 0, 100, 100, 30, true, 'kill', '좌우 중 한쪽 날개에 직접 맞히세요. 날개의 내구 피해 기준으로 계산합니다.', { sourcePart: 'Wings (2)' }),
      part('limbs', '다리', 30, 0, 0, 100, 40, false, 'break', '몸 아래의 다리입니다. 부숴도 추락하지 않습니다.', { sourcePart: 'Limbs' }),
    ],
  },
  {
    id: 'rocket-devastator', name: '로켓 데바스테이터', faction: '오토마톤', source: wiki('Rocket_Devastator'), sourceRevision: 135121,
    main: main(750, 2, 0, 0),
    note: '머리·복부는 치명 부위입니다. 어깨 로켓 포드 파괴는 무장 제거이며 즉사와 다릅니다.',
    // Every part matches Wiki Anatomy revision 138979 (checked 2026-10-22).
    // Parts after the legacy ones were added then.
    anatomyRevision: 138979, anatomyCheckedAt: '2026-10-22',
    parts: [
      part('head', '머리', 110, 1, 0, 100, 100, true, 'kill', '어깨 로켓 포드 사이의 작은 얼굴을 직접 맞히세요.', { sourcePart: 'Head' }),
      part('stomach', '복부', 350, 1, 0, 100, 100, true, 'kill', '가슴 장갑 아래의 얇은 허리를 노리세요.', { sourcePart: 'Stomach' }),
      part('rocket-pod', '로켓 포드', 300, 1, 100, 100, 30, true, 'break', '어깨 위 로켓 발사 장치입니다. 발사 장치를 부숴도 적은 살아 있을 수 있습니다.', { sourcePart: 'Rocket Pods' }),
      part('torso', '흉부 장갑', 425, 3, 30, 100, 100, true, 'kill', '넓어서 맞히기 쉽지만 머리·복부보다 높은 관통이 필요합니다.', { sourcePart: 'Torso' }),
      part('shoulder', '어깨 한쪽', 150, 2, 0, 100, 25, true, 'break', '팔이 붙은 어깨 장갑 하나입니다. 부숴도 죽지 않습니다.', { sourcePart: 'Shoulders (2)' }),
      part('arm', '팔 한쪽', 260, 1, 0, 100, 50, false, 'break', '무기를 든 팔 하나입니다. 부숴도 죽지 않습니다.', { sourcePart: 'Arms (2)' }),
      part('pelvis', '골반부', 500, 1, 0, 100, 75, true, 'kill', '허리 아래 골반을 맞히세요. 파괴하면 죽습니다.', { sourcePart: 'Pelvis' }),
      part('leg', '다리 한쪽', 500, 2, 30, 100, 60, true, 'kill', '다리 하나를 계속 맞히세요. 파괴하면 죽습니다.', { sourcePart: 'Legs (2)' }),
      part('rockets', '로켓', 200, 0, 0, 100, 100, true, 'break', '로켓 포드에 실린 로켓입니다. 부숴도 죽지 않지만 피해가 모두 본체로 전달됩니다.', { sourcePart: 'Rockets' }),
    ],
  },
  {
    id: 'heavy-devastator', name: '헤비 데바스테이터', faction: '오토마톤', source: wiki('Heavy_Devastator'), sourceRevision: 135122,
    main: main(750, 2, 0, 0),
    shield: { hp: 800, armor: 4, label: '방패에 가리지 않은 부위를 조준', note: '방패를 피해서 머리·복부·배낭에 직접 맞히는 조건입니다. 방패 파괴 탄수와 방패를 통한 폭발은 포함하지 않습니다.' },
    note: '방패 자체에 맞은 탄은 아래 부위의 직격 피해가 아닙니다. 작은 얼굴이나 측면·후방에서 드러나는 배낭을 노리세요.',
    // Every part matches Wiki Anatomy revision 139373 (checked 2026-10-22).
    // Parts after the legacy ones were added then.
    anatomyRevision: 139373, anatomyCheckedAt: '2026-10-22',
    anatomyOmitted: { Shield: 'The arm shield is the shield toggle (hits that get past it), not a part' },
    parts: [
      part('head', '머리', 110, 1, 0, 100, 100, true, 'kill', '방패 위로 노출된 작은 얼굴을 맞히세요.', { sourcePart: 'Head' }),
      part('stomach', '복부', 350, 1, 0, 100, 100, true, 'kill', '방패가 내려가거나 옆으로 돌아 복부가 실제로 보이는 때만 적용합니다.', { sourcePart: 'Stomach' }),
      part('backpack', '배낭', 600, 2, 0, 100, 40, true, 'kill', '뒤나 옆에서 커다란 배낭을 맞히세요. 배낭 파괴는 치명 판정입니다.', { sourcePart: 'Backpack' }),
      part('torso', '흉부 장갑', 425, 3, 30, 100, 100, true, 'kill', '넓어서 맞히기 쉽지만 머리·복부보다 높은 관통이 필요합니다.', { sourcePart: 'Torso' }),
      part('shoulder', '어깨 한쪽', 150, 2, 0, 100, 25, true, 'break', '팔이 붙은 어깨 장갑 하나입니다. 부숴도 죽지 않습니다.', { sourcePart: 'Shoulders (2)' }),
      part('arm', '팔 한쪽', 260, 1, 0, 100, 50, false, 'break', '무기를 든 팔 하나입니다. 부숴도 죽지 않습니다.', { sourcePart: 'Arms (2)' }),
      part('pelvis', '골반부', 500, 2, 0, 100, 75, true, 'kill', '허리 아래 골반을 맞히세요. 파괴하면 죽습니다.', { sourcePart: 'Pelvis' }),
      part('leg', '다리 한쪽', 500, 2, 30, 100, 60, true, 'kill', '다리 하나를 계속 맞히세요. 파괴하면 죽습니다.', { sourcePart: 'Legs (2)' }),
    ],
  },
  {
    id: 'scout-strider', name: '스카우트 스트라이더', faction: '오토마톤', source: wiki('Scout_Strider'), sourceRevision: 135123,
    main: main(500, 4, 0, 0),
    note: '후방이 열린 기본형입니다. 조종사와 보행 기체는 별도 체력이며, 조종사 머리 계산에는 조종사 체력 125를 적용합니다.',
    // Every part matches Wiki Anatomy revision 139387 (checked 2026-10-22),
    // the strider tab and the Pilot tab. Parts after the first three were added then.
    anatomyRevision: 139387, anatomyCheckedAt: '2026-10-22',
    anatomyOmitted: { Pilot: 'The pilot health pool is the Pilot tab, whose parts are modelled one by one' },
    parts: [
      part('pilot-head', '노출된 조종사 머리', 40, 0, 0, 100, 100, true, 'kill', '뒤로 돌아가거나 높은 곳에서 드러난 조종사의 머리를 직접 맞히세요. 사진은 같은 조종사 모델의 머리 위치입니다.', { main: { ...main(125, 0, 0, 50), name: '조종사' }, sourcePart: 'Pilot: Head', sourceMain: 'Pilot: Main' }),
      part('waist', '허리 연결부', 300, 3, 0, 100, 100, true, 'kill', '정면 장갑판 아래, 두 다리 위의 연결부를 맞히세요.', { sourcePart: 'Waist' }),
      part('leg', '다리 한쪽', 400, 2, 75, 0, 50, true, 'kill', '다리 하나를 계속 맞혀 보행 기체를 무너뜨리세요. 양쪽에 피해를 나누지 않는 조건입니다.', { sourcePart: 'Legs (2)' }),
      part('front-plate', '정면 장갑판', 350, 4, 40, 0, 0, false, 'kill', '조종석 앞을 가린 큰 장갑판입니다. 체력이 따로 있고, 파괴하면 기체가 쓰러집니다.', { sourcePart: 'Front Plate' }),
      part('hmg', '중기관총', 300, 4, 100, 0, 0, false, 'kill', '조종석 아래의 중기관총입니다. 체력이 따로 있고, 파괴하면 기체가 쓰러집니다.', { sourcePart: 'HMG' }),
      part('turret-system', '포탑 연결부', 300, 3, 0, 100, 100, true, 'kill', '조종석과 하부 보행 장치 사이의 회전 연결부를 맞히세요.', { sourcePart: 'Turret System' }),
      part('pilot-torso', '노출된 조종사 몸통', 100, 0, 0, 100, 100, true, 'kill', '뒤로 돌아가거나 높은 곳에서 드러난 조종사의 몸통을 맞히세요.', { main: { ...main(125, 0, 0, 50), name: '조종사' }, sourcePart: 'Pilot: Torso', sourceMain: 'Pilot: Main' }),
      part('pilot-arm', '노출된 조종사 팔', 65, 0, 0, 100, 50, false, 'break', '조종사의 팔 하나입니다. 부숴도 죽지 않지만 피해의 절반이 조종사 체력으로 들어갑니다.', { main: { ...main(125, 0, 0, 50), name: '조종사' }, sourcePart: 'Pilot: Arms (2)', sourceMain: 'Pilot: Main' }),
      part('pilot-leg', '노출된 조종사 다리', 90, 0, 0, 100, 65, true, 'kill', '조종사의 다리 하나입니다. 파괴하면 조종사가 죽습니다.', { main: { ...main(125, 0, 0, 50), name: '조종사' }, sourcePart: 'Pilot: Legs (2)', sourceMain: 'Pilot: Main' }),
    ],
  },
  {
    id: 'reinforced-strider', name: '강화 스카우트 스트라이더', faction: '오토마톤', source: wiki('Reinforced_Scout_Strider'), sourceRevision: 135124,
    main: main(500, 4, 0, 0),
    note: '조종석이 막힌 강화형입니다. 위키에 로켓 유폭의 즉사 판정 오류가 기재되어 있어 로켓은 탄수 계산에서 제외합니다.',
    // Every part matches Wiki Anatomy revision 139395 (checked 2026-10-22).
    // Parts after the first three were added then.
    anatomyRevision: 139395, anatomyCheckedAt: '2026-10-22',
    anatomyOmitted: { 'Rockets (4)': 'The wiki notes a bug in the rocket detonation instant kill, so rockets are not counted' },
    parts: [
      part('turret-system', '포탑 연결부', 300, 3, 0, 100, 100, true, 'kill', '조종석과 하부 보행 장치 사이의 회전 연결부를 맞히세요.', { sourcePart: 'Turret System' }),
      part('waist', '허리', 300, 3, 0, 100, 100, true, 'kill', '큰 정면 장갑판 아래의 허리를 노리세요. AP 3 이상으로 관통합니다.', { sourcePart: 'Waist' }),
      part('leg', '다리 한쪽', 400, 2, 75, 0, 50, true, 'kill', '같은 다리 하나를 집중 공격하세요. 장갑은 2지만 내구도가 높습니다.', { sourcePart: 'Legs (2)' }),
      part('faceplate', '정면 장갑판', 400, 4, 40, 0, 0, false, 'kill', '막힌 조종석 앞의 큰 장갑판입니다. 체력이 따로 있고, 파괴하면 기체가 쓰러집니다.', { sourcePart: 'Faceplate' }),
      part('hmg', '중기관총', 300, 4, 100, 0, 0, false, 'kill', '조종석 아래의 중기관총입니다. 체력이 따로 있고, 파괴하면 기체가 쓰러집니다.', { sourcePart: 'HMG' }),
      part('rocket-rail', '로켓 레일 한쪽', 200, 2, 0, 80, 0, false, 'break', '양옆의 로켓 발사대 하나입니다. 부숴도 기체는 살아 있고 본체에 피해가 가지 않습니다.', { sourcePart: 'Rocket Rails (2)' }),
    ],
  },
  {
    id: 'gunship', name: '건십', faction: '오토마톤', source: wiki('Gunship'), sourceRevision: 135132,
    main: main(950, 3, 0, 0),
    note: '추진기 하나를 파괴하면 격추합니다. 앞뒤 추진기는 체력이 같지만 내구도가 다릅니다. 동체와 여러 추진기에 나눠 맞힌 경우는 계산하지 않습니다.',
    // Every part matches Wiki Anatomy revision 139881 (checked 2026-10-22).
    anatomyRevision: 139881, anatomyCheckedAt: '2026-10-22',
    parts: [
      part('front-thruster', '앞 추진기 한 개', 400, 3, 85, 0, 0, true, 'kill', '동체 앞쪽 추진기 한 개에 집중하세요. 다른 추진기에 맞힌 피해는 합산하지 않습니다.', { sourcePart: 'Front Thrusters (2)' }),
      part('rear-thruster', '뒤 추진기 한 개', 400, 3, 80, 0, 0, true, 'kill', '뒤쪽 추진기는 내구도가 조금 낮습니다. 사진에서 표시한 추진기 하나를 계속 맞히세요.', { sourcePart: 'Rear Thrusters (2)' }),
      part('fuselage', '동체', 950, 3, 100, 100, 100, true, 'kill', '가운데 큰 기체 몸통입니다. 내구도 100%를 적용하며 폭발은 관통 조건에 따라 본체로 전달합니다.', { sourcePart: 'Fuselage' }),
    ],
  },
  {
    id: 'annihilator-tank', name: '어나이얼레이터 탱크', faction: '오토마톤', source: wiki('Annihilator_Tank'), sourceRevision: 135129,
    main: main(4000, 5, 100, 0),
    note: '포탑 체력 2,100과 차체 체력 4,000을 따로 계산합니다. 포탑 뒤의 방열판과 차체 뒤의 엔진실도 서로 다른 부위입니다.',
    // Every part matches Wiki Anatomy revision 139864 (checked 2026-10-22).
    // Parts after the first four were added then.
    anatomyRevision: 139864, anatomyCheckedAt: '2026-10-22', anatomyMain: 'Hull Main',
    parts: [
      part('turret-front', '포탑 정면', 2100, 5, 100, 100, 100, true, 'kill', '위쪽 포탑의 정면 장갑을 맞히는 조건입니다. 아래 차체의 체력과 합산하지 않습니다.', { main: { ...main(2100, 5, 100, 0), name: '포탑' }, sourcePart: 'Turret Front', sourceMain: 'Turret Main' }),
      part('heatsink', '포탑 후방 방열판', 750, 3, 100, 0, 200, true, 'kill', '위쪽 포탑 뒤의 빛나는 방열판을 노리세요. 차체 아래쪽 엔진실보다 장갑이 얇습니다.', { main: { ...main(2100, 5, 100, 0), name: '포탑' }, sourcePart: 'Turret Heatsink', sourceMain: 'Turret Main' }),
      part('hull-front', '차체 정면', 4000, 5, 100, 35, 100, false, 'kill', '궤도 사이의 아래쪽 차체 정면입니다. 포탑보다 본체 체력이 많습니다.', { sourcePart: 'Hull Front' }),
      part('engine', '차체 후방 엔진실', 1500, 4, 100, 50, 150, false, 'kill', '뒤로 돌아가 차체 뒤의 엔진실을 맞히세요. 위쪽 포탑 방열판과 구분합니다.', { sourcePart: 'Engine Bay' }),
      part('hull-side', '차체 측면', 4000, 5, 100, 35, 100, false, 'kill', '궤도가 아닌 차체 측면 장갑을 노리세요.', { mainOnly: true, sourcePart: 'Hull Sides (2)' }),
      part('track', '궤도 한쪽', 750, 3, 80, 100, 100, false, 'break', '한쪽 궤도를 끊어 이동을 막을 수 있습니다. 궤도 파괴 자체는 즉사 조건이 아닙니다.', { sourcePart: 'Tracks (2)' }),
    ],
  },
  voteless('voteless-light', '무권자 · 경량형', 100, 40, 50, 50, 0),
  voteless('voteless-medium', '무권자 · 중간형', 130, 50, 50, 65, 1),
  { ...voteless('voteless-heavy', '무권자 · 중량형', 160, 60, 65, 80, 2, { forearm: true, upperArm: false }),
    anatomyLegacy: { 'forearm.overflowCap': false, 'upper-arm.overflowCap': true } },
  {
    id: 'watcher', name: '와처', faction: '일루미닛', source: wiki('Watcher'), sourceRevision: 135178,
    main: main(600, 0, 0, 0),
    note: '몸통이 치명 부위입니다. 눈이나 지느러미 하나를 파괴하는 것만으로는 죽지 않으며, 추가 피해가 본체를 소진한 경우에만 처치로 표시합니다.',
    // Every part matches Wiki Anatomy revision 140766 (checked 2026-10-31).
    // Parts after the legacy ones were added on 2026-10-22.
    anatomyRevision: 140766, anatomyCheckedAt: '2026-10-31',
    // The wiki raised the upper fin's armor from 0 after the reviewed revision.
    anatomyLegacy: { 'upper-fin.armor': 0 },
    parts: [
      part('body', '몸통', 400, 2, 0, 100, 100, true, 'kill', '눈 주변의 둥근 기체 몸통을 노리세요. 중앙을 안정적으로 맞히는 것이 중요합니다.', { sourcePart: 'Body' }),
      part('eye', '눈', 300, 0, 0, 100, 100, true, 'break', '앞쪽 눈입니다. 눈의 장갑은 없지만 눈 파괴 자체는 즉사가 아닙니다.', { sourcePart: 'Eye' }),
      part('upper-fin', '위쪽 지느러미', 200, 2, 0, 100, 100, true, 'break', '몸 위로 돌출된 지느러미 하나입니다. 이 부위만 부수고 사격을 멈추면 살아 있을 수 있습니다.', { sourcePart: 'Upper Fin' }),
      part('lower-fin', '아래쪽 지느러미', 200, 2, 0, 100, 100, true, 'break', '몸 아래로 돌출된 지느러미 하나입니다. 부숴도 죽지 않지만 피해가 모두 본체로 전달됩니다.', { sourcePart: 'Lower Fin' }),
      part('side-fin', '옆 지느러미 한쪽', 150, 0, 0, 100, 100, true, 'break', '몸 옆의 작은 지느러미 하나입니다. 부숴도 죽지 않지만 피해가 모두 본체로 전달됩니다.', { sourcePart: 'Side Fins (2)' }),
    ],
  },
  {
    id: 'elevated-overseer', name: '고위 오버시어 · 비행형', faction: '일루미닛', source: wiki('Elevated_Overseer'), sourceRevision: 135189,
    main: main(450, 0, 0, 0),
    note: '비행형은 지상형과 체력·머리 장갑이 다릅니다. 제트팩 파괴는 즉사이며, 흉부는 장갑을 벗긴 뒤 몸통에 후속탄을 맞힙니다.',
    // Every part matches Wiki Anatomy revision 140086 (checked 2026-10-31),
    // except the torso health below. Parts after the legacy ones were added on 2026-09-28.
    anatomyRevision: 140086, anatomyCheckedAt: '2026-10-31',
    // The official patch notes 4.1.0 (2025-10-23) cut the torso from 600 to 450
    // and the arms from 300 to 250, and no later patch note changes them. The
    // wiki table went back to 600/300 on 2026-03-04; revision 140086 restored the
    // arms to 250 but gives the torso 400, so the site follows the patch notes there.
    anatomyOfficial: {
      'torso.hp': { wiki: 400, source: 'Patch 4.1.0 (2025-10-23): torso health decreased from 600 to 450' },
    },
    anatomyLegacy: { 'chest-armor.next.hp': 600, 'crotch-armor.next.hp': 600, 'right-arm.hp': 300, 'left-arm.hp': 300 },
    parts: [
      part('head', '머리·투구', 200, 2, 0, 100, 100, true, 'kill', '날아다니는 적의 작은 투구를 직접 맞히세요. 지상형보다 머리 장갑이 낮습니다.', { sourcePart: 'Head' }),
      part('jetpack', '등의 제트팩', 300, 2, 0, 100, 50, true, 'kill', '옆이나 뒤에서 등에 달린 제트팩을 노리세요. 파괴 때 주변에 폭발 피해를 줄 수 있습니다.', { sourcePart: 'Jetpack' }),
      part('chest-armor', '흉부 장갑 → 몸통', 150, 2, 0, 100, 20, false, 'armor', '흉부 장갑을 벗긴 뒤 같은 위치를 계속 맞히세요. 본체 체력 450에 전달된 피해도 함께 계산합니다.', { sourcePart: 'Chest Armor', next: part('torso', '노출된 몸통', 450, 1, 0, 100, 100, true, 'kill', '공식 패치 노트 4.1.0 기준 몸통 체력은 450으로, 본체 체력 450과 같습니다. 위키 부위 표의 값 대신 패치 노트 값을 씁니다.', { sourcePart: 'Torso' }) }),
      part('crotch-armor', '사타구니 장갑 → 몸통', 200, 2, 0, 100, 20, false, 'armor', '하복부 장갑을 벗긴 다음 같은 몸통을 공격하세요.', { sourcePart: 'Crotch Armor', next: part('torso', '노출된 몸통', 450, 1, 0, 100, 100, true, 'kill', '벗겨진 하복부 안쪽입니다.', { sourcePart: 'Torso' }) }),
      part('limb-armor', '팔다리 장갑 한 개', 100, 2, 0, 100, 20, false, 'break', '팔다리를 덮은 장갑판 하나입니다. 부숴도 죽지 않습니다.', { sourcePart: 'Limb Armor' }),
      part('right-arm', '오른팔', 250, 1, 0, 100, 50, true, 'kill', '무기를 든 오른팔입니다. 파괴하면 죽습니다.', { sourcePart: 'Right Arm' }),
      part('left-arm', '왼팔', 250, 1, 0, 100, 50, true, 'break', '왼팔입니다. 부숴도 죽지 않지만 피해의 절반이 본체로 전달됩니다.', { sourcePart: 'Left Arm' }),
      part('leg', '다리 한쪽', 450, 0, 0, 100, 70, true, 'break', '다리 하나입니다. 본체 체력을 공유하며, 피해의 70%가 본체로 들어갑니다.', { mainOnly: true, sourcePart: 'Legs (2)' }),
    ],
  },
];

// Faction order, with related base units and variants adjacent.
const enemyOrder = ["scavenger","spore-burst-scavenger","bile-spitter","pouncer","hunter-hardened","predator-hunter","spore-burst-hunter","warrior-hardened","alpha-warrior","bile-warrior","rupture-warrior","spore-burst-warrior","hive-guard","brood-commander","alpha-commander","nursing-spewer","bile-spewer-armored","rupture-spewer","stalker","predator-stalker","charger","behemoth","spore-charger","rupture-charger","impaler","shrieker","dragonroach","bile-titan","spore-burst-bile-titan","hive-lord","trooper","jet-brigade-trooper","pyro-trooper","brawler","commissar","jet-brigade-commissar","rocket-raider","incendiary-rocket-raider","assault-raider","marauder","mg-raider","jet-brigade-mg-raider","berserker","radical","agitator","devastator","rocket-devastator","heavy-devastator","conflagration-devastator","incendiary-mg-devastator","jet-brigade-devastator","scout-strider","reinforced-strider","hulk","hulk-bruiser","hulk-obliterator","hulk-firebomber","jet-brigade-hulk-scorcher","jet-brigade-hulk-bruiser","annihilator-tank","shredder-tank","barrager-tank","gunship","dropship","war-strider","factory-strider","vox-engine","voteless-light","voteless-medium","voteless-heavy","wretch","overseer","elevated-overseer","crescent-overseer","watcher","obtruder","fleshmob","crusher","harvester","veracitor","gatekeeper","stingray","warp-ship","leviathan"];
const factionOrder = ['테르미니드', '오토마톤', '일루미닛'];
const enemyRank = new Map(enemyOrder.map((id, index) => [id, index]));
// Explicit instance counts in the reviewed Fleshmob anatomy (revision 135182).
// Keep the imported source data and all legacy single-part inputs unchanged.
const countedEnemies = [...originalEnemies, ...expandedEnemies, ...additionalEnemies].map(enemy => enemy.id !== 'fleshmob' ? enemy : {
  ...enemy, parts: enemy.parts.map(part => {
    const count = part.sourcePart?.match(/\((\d+)\)$/)?.[1];
    return count ? { ...part, count: Number(count) } : part;
  }),
});
export const enemies = countedEnemies.sort((a, b) =>
  factionOrder.indexOf(a.faction) - factionOrder.indexOf(b.faction)
  || (enemyRank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (enemyRank.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  || a.name.localeCompare(b.name, 'ko'));

export const enemyTypeCount = new Set(enemies.map(enemy => enemy.family || enemy.id)).size;

const shot = (id, name, standard, durable, ap, explosion = 0, explosionAp = 0, extra = {}) => ({ id, name, standard, durable, ap, explosion, explosionAp, ...extra });
const profile = (page, modes, note = '') => ({ source: wiki(page), modes, note });
const reviewedExplosive = (page, modes, note) => ({ ...profile(page, modes.map(mode => ({ ...mode, reviewedExplosive: true })), note), checkedAt: '2026-09-16', combatOnly: true });
const reviewedImpact = (page, modes, note) => ({ ...profile(page, modes.map(mode => ({ ...mode, conditionalImpact: true })), note), checkedAt: '2026-09-16', combatOnly: true });
export const weaponProfiles = {
  'meltagun': {
    ...reviewedImpact('40-K_Meltagun', [
      ...[
        ['near', '근거리 · 최대 피해', 2600],
        ['max-range', '15m · 최대 사거리', 1560],
      ].map(([id, name, dps]) => shot(id, name, Math.round(dps * 1.4), Math.round(dps * 1.4), 7, 0, 0, {
        delivery: 'beam', range: 15,
        beam: { duration: 1.4, standardPerSecond: dps, durablePerSecond: dps },
      })),
    ], '한 발은 약 1.4초 동안 이어지는 광선입니다. 사거리 끝 15m에서는 피해가 40% 감소합니다. 중간 거리의 감쇠 곡선은 자료 미확인으로 계산하지 않습니다. 폭발·화상 피해는 없으며, 충전·재장전 시간은 탄수 계산과 별개입니다.'),
    sourceRevision: 134789, damageRevision: 134890,
    extraSource: wiki('Module:Decodedata-Attacks/weapons_data.json'),
  },
  'arc-thrower': reviewedImpact('ARC-3_Arc_Thrower', [
    shot('first-target', '첫 표적 · 전격 명중', 250, 100, 7, 0, 0, { delivery: 'arc', range: 55 }),
  ], '첫 표적의 표시 부위에 전격이 계속 명중하는 조건입니다. 특정 부위를 자유롭게 조준할 수 있는 무기는 아닙니다. 연쇄 대상의 피해 감소와 다른 적의 피해는 제외합니다.'),
  'spear': reviewedImpact('FAF-14_Spear', [
    shot('impact', '유도 미사일 · 착탄 부위 기준', 4000, 4000, 7, 200, 3, { delivery: 'guided', explosionDurable: 200, innerRadius: 1.5, radius: 3 }),
  ], '락온한 표적을 향한 미사일이 표시 부위에 직접 착탄하는 조건입니다. 유도 궤적과 실제 착탄 부위는 보장하지 않으며, 여러 부위 동시 폭발 피해는 제외합니다.'),
  'one-true-flag': reviewedImpact('CQC-1_One_True_Flag', [
    shot('melee', '일반 찌르기', 200, 100, 3, 0, 0, { unit: '회', delivery: 'flag' }),
  ], '깃발 날이 해당 부위에 먼저 닿는 일반 찌르기 기준입니다. 깃발 설치 동작과 방어구의 근접 피해 증가 효과는 제외합니다.'),
  'speargun': reviewedImpact('S-11_Speargun', [
    shot('direct', '직격 기준 · 가스 피해 제외', 650, 275, 5, 0, 0, { delivery: 'harpoon', falloff: true }),
  ], '작살의 직격 피해만 계산합니다. 가스 영역 피해와 가스 지속 피해는 모두 제외하며, 포함하지 않은 피해까지 반영한 실제 최소 탄수는 아닙니다.'),
  'de-escalator': reviewedImpact('GL-52_De-Escalator', [
    shot('arc', '전격 · 명중 수 조건', 100, 70, 4, 0, 0, { delivery: 'arc', range: 10, hitCondition: { kind: 'arcs', min: 1, max: 10, default: 10, defaultPct: 100 } }),
  ], '전격 1회는 일반 피해 100 / 내구 피해 70 / AP 4입니다. 한 유탄에서 전격 10개가 발생하지만, 특정 부위에 들어가는 개수는 자료 미확인입니다. 유탄 자체 직격은 위키 세부 표 20/2와 변경 기록 0/0이 충돌하여 제외합니다. 전격에 폭발 저항을 적용하지 않습니다.'),
  'airburst-launcher': reviewedImpact('RL-77_Airburst_Rocket_Launcher', [
    ...[
      ['flak', '대공포탄 모드', '근접 신관으로 공중에서 터질 수 있습니다. 직접 맞히지 않은 주탄의 직격 피해는 포함하지 마세요.'],
      ['cluster', '집속탄 모드', '주탄은 충돌 또는 짧은 시간 경과 후 터지며, 자탄은 분산 후 충돌 시 폭발합니다.'],
    ].map(([id, name, note]) => shot(id, name, 350, 350, 3, 150, 3, {
      delivery: 'cluster', explosionDurable: 150, innerRadius: 3, radius: 5, note,
      hitCondition: { kind: 'bomblets', min: 0, max: 25, default: 5, defaultPct: 20 },
      bomblet: { standard: 150, durable: 150, ap: 3, explosion: 500, explosionDurable: 500, explosionAp: 3, innerRadius: 4, radius: 6 },
    })),
  ], '주탄과 자탄의 직격·폭발을 따로 계산합니다. 자탄은 25개 발생하지만 같은 부위에 모두 맞는다고 자동 합산하지 않습니다. 선택한 폭발이 모두 해당 부위에 최대 피해를 주는 가정이며, 여러 부위 동시 피해는 제외합니다.'),
  'grenade-launcher': reviewedExplosive('GL-21_Grenade_Launcher', [
    shot('standard', '기본 사격', 0, 0, 4, 400, 3, { explosionDurable: 400, innerRadius: 3.5, radius: 7.5 }),
  ], '직격 피해 0은 위키의 정상값입니다. 안전 신관이 작동할 만큼 거리를 확보하고, 유탄이 튕긴 위치가 아닌 실제 폭발 위치를 기준으로 조준하세요.'),
  'belt-fed-gl': reviewedExplosive('GL-28_Belt-Fed_Grenade_Launcher', [
    shot('standard', '기본 사격', 0, 0, 4, 150, 4, { explosionDurable: 150, innerRadius: 2, radius: 4 }),
  ], '직격 피해 0은 위키의 정상값입니다. 유탄이 정상적으로 기폭해 선택한 부위에 최대 폭발 피해가 닿는 조건입니다.'),
  'breaching-hammer': reviewedExplosive('CQC-20_Breaching_Hammer', [
    shot('melee', '일반 타격 · 폭약 없음', 300, 150, 3, 0, 0, { unit: '회', delivery: 'melee', note: '폭약 없이 망치로 직접 타격합니다. 방어구의 근접 피해 증가 효과는 적용하지 않습니다.' }),
    shot('explosive', '폭약 사용 · 타격과 기폭', 300, 150, 3, 2200, 6, { explosionDurable: 2200, innerRadius: 0.5, radius: 3, unit: '회', delivery: 'melee', note: '폭약 한 개를 장착한 타격 1회 기준입니다. 직접 타격과 폭발이 같은 부위에 들어오는 조건이며, 매번 폭약을 다시 장착해야 합니다.' }),
  ], '망치가 실제로 닿는 위치에서 정면 타격하는 조건입니다. 휘두를 때 처음 접촉한 부위만 타격하며, 높은 부위나 비행 중인 적에게 접근할 수 있는지는 계산하지 않습니다.'),
  'leveller': reviewedExplosive('EAT-411_Leveller', [
    shot('standard', '기본 사격', 1000, 1000, 6, 2500, 6, { explosionDurable: 2500, innerRadius: 10, radius: 25, falloff: true }),
  ], '선택한 부위에 탄체가 직접 명중하고 같은 부위에 최대 폭발 피해가 닿는 조건입니다.'),
  'epoch': reviewedExplosive('PLAS-45_Epoch', [
    shot('standard', '일반 발사', 400, 200, 4, 500, 4, { explosionDurable: 500, innerRadius: 2.3, radius: 3, falloff: true }),
    shot('charged', '완전 충전 발사', 800, 400, 5, 800, 5, { explosionDurable: 800, innerRadius: 3, radius: 4, falloff: true }),
  ], '일반 발사와 완전 충전의 직격·내구 피해, 관통, 폭발 반경을 각각 적용합니다. 과충전 자폭은 정상 발사 모드에서 제외합니다.'),
  'expendable-napalm': reviewedExplosive('EAT-700_Expendable_Napalm', [
    shot('standard', '주탄 기준·자탄과 화염 제외', 500, 500, 3, 250, 6, { explosionDurable: 250, innerRadius: 1.6, radius: 8, explosionName: '주폭발' }),
  ], '주탄 기준·자탄과 화염 제외. 주탄 직격과 주폭발만 계산합니다. 자탄 한 개의 폭발은 일반·내구 피해 각각 50 / AP 3이지만, 명중 수와 화염의 실제 피해 지속시간은 자료 미확인입니다. 제외한 피해까지 포함한 실제 최소 탄수는 아닙니다.'),
  'solo-silo': reviewedExplosive('MS-11_Solo_Silo', [
    shot('standard', '미사일 1발 · 충돌 폭발과 주폭발', 0, 0, 0, 0, 0, {
      directKind: 'none',
      explosions: [
        { id: 'impact', name: '충돌 폭발', standard: 1500, durable: 1500, ap: 9, innerRadius: 3, radius: 6 },
        { id: 'main', name: '주폭발', standard: 2500, durable: 2500, ap: 7, innerRadius: 10, radius: 25 },
      ],
    }),
  ], '충돌 피해도 폭발입니다. 두 폭발의 관통·반경·폭발 저항을 각각 적용한 뒤 같은 부위에 들어오는 피해만 더합니다. 두 폭발 모두 최대 피해 반경 안에 들어오는 조건이며, 같은 탄의 후속 폭발이 제거된 장갑 안쪽에 추가로 닿는 효과는 자료 미확인으로 제외합니다.'),
  'c4-pack': {
    ...profile('B/MD_C4_Pack', [shot('charge', '장약 한 개 기폭', 0, 0, 0, 2000, 7, { explosionDurable: 2000, innerRadius: 3, radius: 7, unit: '개', delivery: 'adhesive' })], '장약 한 개씩 같은 부위에 최대 폭발 피해가 들어가는 조건입니다. 부착 위치에 따른 여러 부위의 동시 피해, 가림과 실제 부착 성공 여부는 검증하지 않았으므로 실제 최소 처치 개수와 다를 수 있습니다.'),
    sourceRevision: 133871, checkedAt: '2026-09-16',
  },
  'autocannon': profile('AC-8_Autocannon', [
    shot('aphet', '철갑고폭예광탄(APHET)', 325, 260, 4, 150, 3, { falloff: true }),
    shot('flak', '대공포탄 모드', 150, 150, 2, 190, 3, {
      source: wiki('Module:Decodedata-Attacks/weapons_data.json'), sourceRevision: 142136, checkedAt: '2026-11-08',
      sourceRecords: { projectile: 'AC-8_P1', explosion: 'AC-8_P1_IE', fragment: 'AC-8_P2' },
      delivery: 'explosive', directKind: 'none', explosionDurable: 190, innerRadius: 2, radius: 7,
      hitCondition: { kind: 'shrapnel', min: 0, max: 30, default: 6, defaultPct: 20 },
      bomblet: { standard: 110, durable: 35, ap: 3, explosion: 0, explosionAp: 0 },
      note: '근접 기폭한 주폭발과 파편 피해를 계산하며, 주탄 직격은 제외합니다. 기본은 파편 30개 중 6개가 같은 부위에 맞는 가정입니다. 명중률을 바꿀 수 있으며, 0개를 고르면 파편 피해를 제외합니다. 폭발 중심부가 해당 부위에 닿는 조건이며, 여러 부위 동시 피해는 합치지 않습니다.',
    }),
  ]),
  'wasp': {
    source: wiki('Module:Decodedata-Attacks/weapons_data.json'), sourceRevision: 142136, checkedAt: '2026-11-08',
    sourceRecords: { weapon: 'STA-X3 W.A.S.P. LAUNCHER', projectile: 'StA-X3_P1', explosion: 'StA-X3_P1_IE', bomblet: 'StA-X3_P', bombletExplosion: 'StA-X3_P_IE' },
    note: '분산탄 한 발에서 나온 작은 미사일이 같은 부위에 맞는다고 가정한 피해 계산입니다. 실제 유도 가능 대상이나 명중 부위를 보장하지 않습니다. 탄창 소모량과 여러 부위 동시 피해는 계산하지 않습니다.',
    modes: [
      shot('submunitions', '분산탄 · 명중 가정', 20, 2, 0, 600, 3, {
        delivery: 'cluster', unit: '발', magazine: null, explosionDurable: 600, innerRadius: 3, radius: 5, coneAngle: 25,
        hitCondition: { kind: 'bomblets', min: 0, max: 7, default: 1, defaultPct: 20,
          defaultPrimaryHit: 'none', defaultBombletDirect: true },
        bomblet: { standard: 200, durable: 200, ap: 6, explosion: 600, explosionDurable: 600, explosionAp: 3, innerRadius: 2.5, radius: 5 },
        note: '기본은 작은 미사일 7개 중 1개의 직격과 폭발이 같은 부위에 맞는 가정입니다. 20%를 반올림한 개수이며, 실제 명중 비율은 약 14%에 해당합니다. 주탄은 12m 근접 기폭이고 피해 반경은 5m이므로 주탄 피해는 기본에서 제외합니다. 주탄 폭발이 실제로 닿는 경우에만 포함하세요. 분산 각도 25도만으로 명중률이나 명중 부위를 알 수는 없습니다.',
      }),
      { id: 'guided', name: '유도 사격 조건', unsupported: '어떤 적을 유도할 수 있고 어느 부위에 맞는지 확인되지 않아 실제 유도 사격의 처치 횟수는 계산하지 않습니다.' },
    ],
  },
  'anti-materiel': profile('Anti-Material_Rifle', [shot('standard', '기본 사격', 450, 225, 4, 0, 0, { falloff: true })], '헐크 눈은 근거리 이론값으로 1발이어도, 거리 감쇠가 생기면 2발 이상 필요할 수 있습니다.'),
  'apex': profile('AMW-20_Apex', [shot('standard', '기본 사격', 1550, 930, 5, 0, 0, { falloff: true })], '엎드리거나 앉아서 쏘는 한 발 기준입니다. 근거리 최대 피해로 계산하며, 거리 감쇠가 생기면 더 필요할 수 있습니다.'),
  'machine-gun': profile('MG-43_Machine_Gun', [shot('standard', '기본 사격', 90, 23, 3, 0, 0, { falloff: true })]),
  'stalwart': profile('M-105_Stalwart', [shot('standard', '기본 사격', 90, 22, 2, 0, 0, { falloff: true })]),
  'heavy-machine-gun': profile('MG-206_Heavy_Machine_Gun', [shot('standard', '기본 사격', 150, 35, 4, 0, 0, { falloff: true })]),
  'maxigun': profile('M-1000_Maxigun', [shot('standard', '기본 사격', 80, 18, 3, 0, 0, { falloff: true })]),
  'bullet-storm': profile('MGX-42', [shot('standard', '기본 사격', 100, 25, 2, 0, 0, { falloff: true })]),
  'expendable-at': profile('EAT-17_Expendable_Anti-Tank', [shot('standard', '대전차탄', 2000, 2000, 6, 150, 3)]),
  'quasar': profile('LAS-99_Quasar_Cannon', [shot('standard', '충전 사격', 2000, 2000, 6, 150, 3)]),
  'nova': profile('LAS-44_Nova', [shot('standard', '충전 사격', 880, 880, 5, 0, 0)], '약 1.6초 충전한 뒤 나가는 한 발 기준입니다. 위키에 따르면 거리에 따른 피해 감소가 없습니다.'),
  'commando': profile('MLS-4X_Commando', [shot('standard', '미사일 1발', 1100, 1100, 6, 150, 3)], '유도한 미사일이 선택한 부위에 직접 명중하는 조건입니다.'),
  'recoilless': profile('Recoilless', [
    shot('heat', '대전차 고폭탄(HEAT)', 3200, 3200, 6, 150, 3),
    shot('he', '고폭탄(HE)', 750, 750, 5, 800, 4),
  ]),
  'railgun': profile('Railgun', [
    shot('safe', '안전 모드 · 기본 충전', 600, 225, 5, 0, 0, { falloff: true }),
    shot('unsafe-max', '불안전 모드 · 최대 피해 충전', 1500, 562, 5, 0, 0, { falloff: true }),
  ], '최대 충전의 내구 피해는 위키 세부 표의 562를 사용합니다. 충전이 덜 되면 피해가 줄며, 과충전 자폭은 탄의 폭발 피해에 포함하지 않습니다.'),
};

export const unsupportedWeapons = {
  'flamethrower': '불길의 접촉 시간과 화상 지속 피해가 필요해 탄수로 환산하지 않습니다.',
  'cremator': '불길의 접촉 시간과 화상 지속 피해가 필요해 탄수로 환산하지 않습니다.',
  'laser-cannon': '광선의 접촉 시간과 화상을 따로 계산해야 하므로 발 단위 계산을 지원하지 않습니다.',
  'sterilizer': '가스의 지속 시간과 대상별 피해 조건이 필요합니다.',
};

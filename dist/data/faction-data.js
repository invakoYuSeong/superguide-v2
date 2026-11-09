import { factionLoadouts } from './faction-loadouts.js';
// Curated composition and tactics; combat numbers always come from combat-data.
export const factionCheckedAt = '2026-09-17';
export const factionGuideEnemies = {
  'predator-hunter': { id: 'predator-hunter', name: '프레데터 헌터', source: 'https://helldivers.wiki.gg/wiki/Predator_Hunter' },
};
export const factionSides = [
  { id: 'terminid', name: '테르미니드', icon: './assets/pickers/faction-terminid.svg' },
  { id: 'automaton', name: '오토마톤', icon: './assets/pickers/faction-automaton.svg' },
  { id: 'illuminate', name: '일루미닛', icon: './assets/pickers/faction-illuminate.svg' },
];
const wiki = name => `https://helldivers.wiki.gg/wiki/${name}`;
const unit = (enemy, change, targets = ['head'], base = null) => ({ enemy, change, weapons: factionLoadouts[enemy].map(item => item.weapon), targets, base });
export const factionApproaches = Object.fromEntries(['jet-brigade-hulk-bruiser', 'jet-brigade-hulk-scorcher'].flatMap(enemy =>
  ['grenade-launcher', 'epoch:charged'].map(choice => [`${enemy}:${choice}`, {
    target: 'jetpack', directHit: false,
    title: '정면 상부에 착탄 → 뒤쪽 제트팩에 폭발',
    tip: '작은 붉은 눈을 정확히 맞힐 필요 없이 머리·상체 위쪽에서 폭발시켜 뒤쪽 제트팩을 폭발 범위에 넣으세요. 제트팩이 파괴되면 헐크도 처치됩니다.',
    condition: '제트팩에 최대 폭발 피해가 닿는 조건입니다. 정면 어디에 맞혀도 같은 결과가 나오는 것은 아니며, 착탄 위치·거리 감쇠·폭발 경로에 따라 더 필요할 수 있습니다. 제트팩 직격 피해와 다른 부위 피해는 합산하지 않습니다.',
    source: wiki('Jet_Brigade_Hulk_Scorcher#Tactical_Information'),
  }])
));
// Weapon-specific aim choices take precedence over the unit's general shortlist.
export const factionAimTargets = {
  'rupture-spewer:grenade-launcher': ['butt', 'spinal-plates'],
};
export const factionTactics = {
  'obtruder:autocannon:flak': {
    title: '대공포탄 모드로 비행 드론 무리 대응',
    body: '위키가 효과적인 대응으로 제시합니다. 파편 명중 수·사망 시 연쇄 폭발에 따라 결과가 달라 고정 처치 탄수를 표시하지 않습니다.',
    source: wiki('Obtruder#Tactical_Information'),
  },
  'fleshmob:grenade-launcher': {
    title: '유탄 발사기 4발 처치 안내 · 위키 전술 기준',
    body: '여러 부위가 폭발에 맞는 실전 대응 안내입니다. 위키는 정확한 명중 위치·겹쳐 맞는 부위 수를 제시하지 않으므로, 어느 부위든 4발 처치를 보장하거나 단일 부위 계산으로 검증된 값으로 표시하지 않습니다.',
    source: wiki('Fleshmob#Tactical_Information'),
  },
  'fleshmob:autocannon:flak': {
    title: '대공포탄 모드로 폭발·파편 피해 활용',
    body: '위키가 효과적인 대응 무기로 제시한 모드입니다. 근접 신관·파편의 명중 수와 여러 부위 동시 피해가 달라 고정 처치 탄수는 계산하지 않습니다.',
    source: wiki('Fleshmob#Tactical_Information'),
  },
};
export const factionGuides = [
  { id: 'predator', side: 'terminid', name: '프레데터 변종', en: 'Predator Strain', source: wiki('Predator_Strain'),
    intro: '기습과 추격에 대비하세요. 접근하는 변종의 몸통에 연사하거나 큰 표적에 직접 화력을 넣는 대응을 고릅니다.',
    coverage: '헌터와 스토커 두 변종을 모두 안내합니다. 각 변종의 전용 부위 수치와 적 대응 계산으로 연결됩니다.',
    units: [unit('predator-hunter', '은신·담즙 발사·측면 도약을 사용하는 변종입니다. 본체 체력은 175로 일반 고난이도 헌터 160보다 높습니다. 머리 체력 40·장갑 0, 앞발·다리 체력 60은 일반 고난이도형과 같습니다. 화염 피해 배율은 0.7배입니다.', [], 'hunter-hardened'), unit('predator-stalker', '본체 체력 650으로 일반 스토커 800보다 낮고 머리 체력 175·장갑 1은 같습니다. 은신·혀 공격·피격 후 후퇴 없이 추격하며 둥지 외 순찰·증원에서도 등장합니다.', ['head'], 'stalker')] },
  { id: 'spore-burst', side: 'terminid', name: '스포어 버스트 변종', en: 'Spore Burst Strain', source: wiki('Spore_Burst_Strain'),
    intro: '사망 시 포자 폭발과 주변 적의 가속에 대비해 거리를 두세요. 대형 변종은 일반형의 탄수를 그대로 쓰면 안 됩니다.',
    coverage: '스캐빈저·헌터·워리어·바일 타이탄 네 변종을 모두 안내합니다. 화염 대응은 사망 시 불타는 상태를 유지하는 조건입니다.',
    units: [unit('spore-burst-scavenger', '사망 시 포자를 방출하는 스캐빈저입니다. 부위 체력은 일반형과 같지만 불타는 상태에서 처치하면 포자 방출을 막을 수 있습니다.', ['body'], 'scavenger'), unit('spore-burst-hunter', '본체 체력은 일반 고난이도 헌터와 같은 160이지만 본체 내구도 35%·다리 내구도 25%가 적용됩니다. 불타는 상태에서 죽으면 포자를 방출하지 않습니다.', ['body'], 'hunter-hardened'), unit('spore-burst-warrior', '불타는 상태에서 죽으면 포자를 방출하지 않아 화염 대응을 우선합니다. 머리 파괴 후 출혈로 죽는 경우에도 포자를 방출하지 않습니다. 머리를 잃은 뒤에도 공격할 수 있으므로 추가 사격보다 거리를 벌려 출혈을 기다리는 방법이 있습니다.', ['head'], 'warrior-hardened'), unit('spore-burst-bile-titan', '일반형보다 머리 체력이 높습니다. 포자낭 파괴를 처치로 혼동하지 마세요.', ['head'], 'bile-titan')] },
  { id: 'rupture', side: 'terminid', name: '럽처 변종', en: 'Rupture Strain', source: wiki('Rupture_Strain'),
    intro: '잠복 중이 아닌 지상으로 드러난 순간을 노리세요. 머리와 정면 장갑의 관통 조건이 중요합니다.',
    units: [unit('rupture-warrior', '머리 장갑 3. 머리를 부순 뒤에도 출혈 중 공격하므로 거리를 유지하세요.', ['head'], 'warrior-hardened'), unit('rupture-spewer', '잠복·재출현하며 담즙을 뿜습니다. 머리 외피와 장갑 없는 입의 조건이 다릅니다.', ['head', 'butt', 'mouth'], 'bile-spewer-armored'), unit('rupture-charger', '머리 장갑 5로 일반 차저보다 높습니다. 지상에 드러난 머리를 대전차 무기로 노리세요.', ['head'], 'charger')] },
  // Caustic: wiki Caustic_Strain rev 142183 (Tactical Information). Noxious: the wiki page has no tactics yet, so the
  // official announcement it cites (Steam, 2026-11-03) and the wiki Status Effects page (rev 142045) for the poison.
  { id: 'caustic', side: 'terminid', name: '커스틱 변종', en: 'Caustic Strain', source: wiki('Caustic_Strain'),
    intro: '죽을 때 담즙이 터지므로 거리를 두고 처치하세요. 커스틱 스퓨어의 원거리 박격 공격과 커스틱 차저가 만드는 포자 구름에 대비합니다.',
    coverage: '커스틱 스피터·워리어·스퓨어·차저 네 유닛을 모두 안내합니다. 근접 무기와 엑소슈트·전차는 이 변종에 불리합니다.',
    units: [unit('bile-spitter', '죽을 때 담즙이 터지는 소형 변종입니다. 엑소슈트와 전차에 1.5배 피해를 주므로 차량으로 밟고 지나가지 마세요.', ['body']),
      unit('bile-warrior', '죽을 때 담즙이 터지는 워리어 변종입니다. 엑소슈트와 전차에 3배 피해를 줍니다. 가까이 붙기 전에 머리를 노리세요.', ['head']),
      unit('bile-spewer-armored', '테르미니드 중 유일하게 멀리서 박격포처럼 담즙을 쏩니다. 원거리 무기로 먼저 처치하세요.', ['head', 'butt']),
      unit('spore-charger', '포자 구름으로 주변 시야를 가리며, 고난이도에서는 벌레 증원과 함께 구름이 나타납니다. 유도 무기나 궤도 레일캐논·이글 110mm 로켓 포드 같은 표적 지정 스트라타젬이 유용합니다.', ['head'])] },
  { id: 'noxious', side: 'terminid', name: '녹셔스 변종', en: 'Noxious Strain', source: wiki('Noxious_Strain'),
    intro: '물리면 독이 쌓여 6초 동안 피해를 받고, 3중첩부터는 질주할 수 없습니다. 공식 공지는 스캐빈저에 산탄총·화염방사기·수류탄을, 스퓨어에 장갑 없는 복부 공격을 권합니다.',
    coverage: '녹셔스 스캐빈저와 스퓨어 두 유닛을 안내합니다. 위키 전술 정보가 아직 비어 있어 공식 공지를 기준으로 합니다.',
    units: [unit('noxious-scavenger', '물 때마다 독이 1중첩 쌓입니다. 현재 위키의 부위 수치는 일반 스캐빈저와 같습니다.', ['body']),
      unit('noxious-spewer', '물 때마다 독이 2중첩 쌓입니다. 복부가 터지면 주변을 묶는 거미줄 폭발이 일어납니다. 최소 난이도 5부터 등장합니다.', ['butt'])] },
  { id: 'jet-brigade', side: 'automaton', name: '제트 여단', en: 'Jet Brigade', source: wiki('Jet_Brigade'),
    intro: '점프팩으로 거리를 좁힙니다. 헐크는 점프팩 파괴가 처치로 이어지지만, 데바스테이터는 같은 조건이 아닙니다.',
    coverage: '점프팩 보병 4종과 데바스테이터·헐크 3종을 모두 안내합니다. 소형 보병의 팩 폭발 피해를 중장갑 변종에 그대로 적용하지 않습니다.',
    units: [unit('assault-raider', '점프팩으로 접근하는 근접 보병입니다. 착지할 때 몸통을 쏘고 뒤로 거리를 벌려 팩 폭발을 피하세요.', ['torso']), unit('jet-brigade-trooper', '기본 트루퍼에 점프팩을 더한 사격 보병입니다. 넓은 몸통 사격을 우선하며, 시체의 팩도 폭발할 수 있습니다.', ['torso'], 'trooper'), unit('jet-brigade-commissar', '증원을 부르는 점프팩 보병입니다. 일반 커미사르의 장갑 1과 달리 머리·몸통·사지 장갑은 0입니다.', ['torso'], 'commissar'), unit('jet-brigade-mg-raider', '제트팩으로 접근한 뒤 기관총을 연사합니다. 일반 기관총 레이더의 전원 팩과 다른 장비이며, 몸통을 직접 맞히는 대응을 우선합니다.', ['torso'], 'mg-raider'), unit('jet-brigade-devastator', '점프팩을 부숴도 살아남을 수 있습니다. 몸통 폭발이나 노출된 허리 공격으로 본체를 처치하세요.', ['head'], 'devastator'), unit('jet-brigade-hulk-bruiser', '정면 상부의 폭발로 뒤쪽 제트팩을 터뜨리는 대응을 먼저 추천합니다. 눈 정밀 사격보다 조준 부담이 적고, 제트팩 파괴는 즉시 처치로 이어집니다.', ['jetpack', 'head'], 'hulk-bruiser'), unit('jet-brigade-hulk-scorcher', '도약하는 화염방사형입니다. 거리를 두고 정면 상부를 폭발시켜 제트팩을 노리세요. 눈 대신 제트팩 폭발 대응을 우선합니다.', ['jetpack', 'head'], 'hulk')] },
  { id: 'incineration', side: 'automaton', name: '소각 군단', en: 'Incineration Corps', source: wiki('Incineration_Corps'),
    intro: '화염·소이 무장을 사용하는 주요 변종입니다. 같은 색상의 일반 유닛까지 체력 보정을 적용하지는 않습니다.',
    coverage: '파이로 트루퍼·소이 로켓 레이더·데바스테이터 2종·헐크 파이어봄버를 안내합니다.',
    units: [unit('pyro-trooper', '화염방사기로 접근을 압박합니다. 연료통과 착용자 체력은 별도이므로 확인된 몸통 처치를 우선 추천합니다.', ['torso'], 'trooper'), unit('incendiary-rocket-raider', '소이 로켓을 발사합니다. 머리·몸통·사지의 장갑과 체력은 기본 로켓 레이더와 같으며 화염 공격에 대비해 거리를 두세요.', ['torso'], 'rocket-raider'), unit('conflagration-devastator', '소이 산탄총과 방패를 사용합니다. 방패 위로 드러난 머리를 노리거나 측면에서 허리를 공격하세요. 일반 헤비 데바스테이터의 배낭 약점은 없습니다.', ['head', 'stomach'], 'devastator'), unit('incendiary-mg-devastator', '소이 기관총과 방패로 압박합니다. 방패 정면을 계속 쏘기보다 위로 드러난 머리를 직접 맞히세요.', ['head'], 'heavy-devastator'), unit('hulk-firebomber', '소이 유탄과 화염방사기를 사용합니다. 정면에서는 작은 붉은 눈을 직접 맞히세요. 후방 방열판 파괴는 즉사와 다른 출혈 경로입니다.', ['head'], 'hulk-bruiser')] },
  { id: 'cyborgs', side: 'automaton', name: '사이보그 군단', en: 'Cyborg Legion', source: wiki('Cyborg_Legion'),
    intro: '래디컬·애지테이터가 스트라이더 계열을 대체하고, 고난이도에는 복스 엔진이 등장합니다. 보병 정밀 대응과 대형 표적용 화력을 함께 준비하세요.',
    units: [unit('radical', '빠르게 접근하는 전용 보병입니다. 넓은 가슴에 연사하거나 몸통 주변에 폭발을 넣으세요.'), unit('agitator', '주변 병력을 지휘하는 전용 보병입니다. 골반·왼다리에 화력을 넣거나 가슴 외피를 벗겨 공격할 수 있습니다. 투구 제거 후 머리 공격은 별도 경로입니다.', ['helmet', 'torso-armor']), unit('vox-engine', '팩토리 스트라이더를 대체하는 대형 병기입니다. 넓은 폭발의 위키 처치 안내와 단일 부위 계산을 구분합니다.', ['sarcophagus'])] },
  { id: 'vote-snatchers', side: 'illuminate', name: '보트 스내처', en: 'Vote Snatchers', source: wiki('Vote_Snatchers'),
    intro: '렛치와 크러셔가 주요 일루미닛 병력을 대체합니다. 무권자·플레시몹도 함께 등장하므로 근접 압박에 대비하세요.',
    units: [unit('wretch', '머리 파괴만으로 즉사하지 않습니다. 본체로 피해가 전달되는 다리 경로를 비교합니다.', ['leg']), unit('crusher', '장갑 4 헬멧을 제거한 뒤 머리를 공격합니다. 몸통·다리의 재생을 제외한 수치는 별도 조건입니다.', ['helmet'])] },
  { id: 'mindless', side: 'illuminate', name: '무분별한 대중', en: 'Mindless Masses', source: wiki('Mindless_Masses'),
    intro: '무권자·플레시몹의 비중이 커지는 편성입니다. 다수 대응용 무기와 고난이도 하베스터 대응 수단을 나눠 준비하세요.',
    coverage: '무권자는 중량형을 대표로 표시합니다. 팩션 버프가 아니라 체형별 수치이며, 전체 계산기에서 다른 체형도 선택할 수 있습니다.',
    units: [unit('voteless-heavy', '몰려오는 무권자는 기관총으로 머리를 노리거나 유탄으로 무리를 처리하세요. 아래 탄수는 중량형 한 마리 기준이며 범위 내 처치 수는 아닙니다.'), unit('fleshmob', '치명 부위가 없어 큰 피해를 본체에 누적해야 합니다. 머리 덩어리는 피해의 150%를 본체로 전달하며, 폭발·파편 무기로 여러 부위를 타격하는 대응이 효과적입니다. 덩어리 하나의 파괴는 처치가 아닙니다.', []), unit('harvester', '고난이도에서는 여전히 등장합니다. 보호막을 걷어낸 뒤 몸통 아래의 가로 다리 연결부를 노리세요. 눈 파괴만으로는 죽지 않습니다.', ['joint'])] },
  { id: 'appropriators', side: 'illuminate', name: '적임자', en: 'Appropriators', source: wiki('Appropriators'),
    intro: '무권자·플레시몹이 없는 편성입니다. 조종형 병기의 연결부와 보호막 밖 약점을 노릴 무기를 준비하세요.',
    coverage: '오브트루더·베라시터·게이트키퍼 세 전용 유닛을 모두 안내합니다.',
    units: [unit('obtruder', '무리지어 플라스마를 발사하는 와처 변종입니다. 증원을 부르지 않으며 본체 체력은 400으로 일반 와처 600보다 낮고, 몸체 장갑도 1로 일반 와처의 2보다 낮습니다. 작은 눈 대신 몸체 연사나 대공포탄으로 대응하세요.', ['body'], 'watcher'), unit('veracitor', '조종사 보호막과 기체를 구분하세요. 기체 연결부는 조종사 보호막 밖의 처치 경로입니다.', ['chassis', 'hip']), unit('gatekeeper', '베라시터보다 기체 중앙 장갑이 두껍습니다. 대전차 화력 또는 후방 약점을 비교하세요.', ['chassis', 'rear-weakspot'], 'veracitor')] },
  { id: 'invasion', side: 'illuminate', name: '침공 함대', en: 'Invasion Fleet', source: 'https://helldiverscompanion.com/',
    intro: '일반 일루미닛 혼성 편성의 주요 위협입니다. 보병과 보호막을 가진 대형 병기의 대응 무기를 함께 확인하세요.',
    coverage: '주요 대표 유닛이며 전체 출현 목록은 아닙니다. 이 편성에만 적용되는 체력 보정은 가정하지 않습니다.',
    units: [unit('overseer', '방패를 우회해 넓은 흉부를 공격하세요. 가슴 외피 제거와 후속 공격을 포함한 대응을 표시합니다.'), unit('elevated-overseer', '움직이는 몸통에 연사하거나, 옆·뒤에서 보이는 제트팩을 직접 노리세요.'), unit('harvester', '보호막 제거 후 다리가 시작되는 가로 연결부를 노리세요.', ['joint'])] },
];

// Recommended stratagems per faction for the faction picks screen: an editorial list taken from a
// community newbie guide (checked 2026-11-17), added at the user's request (2026-11-20).
// Each pick lists one item or alternatives ("A or B"): a stratagem id, or { gear: id } for a
// primary, secondary or throwable. `best` marks the guide's top pick; `tags` say what it covers.
export const factionStratagemsCheckedAt = '2026-11-17';
export const factionStratagems = {
  terminid: {
    picks: [
      { items: ['eagle-500kg'], best: true, tags: ['굴 파괴', '물량 처리', '대형 적'], note: '다재다능해 가장 많이 추천됩니다. 함선 모듈을 열기 전에는 재무장 전에 한 번뿐이라 이글 공중타격도 좋습니다.' },
      { items: ['orbital-napalm'], tags: ['물량 처리', '적 증원'], note: '대규모 무리와 적 증원을 정리합니다. 굴은 닫지 못하며, 굴이나 아군이 지나갈 길에는 깔지 마세요.' },
      { items: ['machine-gun-sentry', 'flame-sentry'], tags: ['어그로 분산'], note: '적의 주의를 끌어 주고 순찰대를 정리합니다.' },
      { items: ['recoilless', 'apex'], tags: ['대형 적'], note: '차저 같은 대형 버그를 맡습니다. 난이도 8 이상부터 자주 씁니다. 무반동포는 타이탄, 차저를 머리 1발에 처치하고, 에이펙스는 2발에 처치합니다.' },
      { items: ['eagle-airstrike'], tags: ['굴 파괴', '물량 처리'], note: '폭탄을 일렬로 떨어뜨려 벌레굴을 닫고 무리를 정리합니다. 굴 밖에 맞혀도 닫힐 만큼 철거력이 충분합니다.' },
      { items: ['gas-mines'], tags: ['물량 처리'], note: '몰려오는 무리가 지나는 길에 깔아 둡니다.' },
      { items: [{ gear: 'eruptor' }, { gear: 'exploding-crossbow' }, { gear: 'evictor' }], tags: ['굴 파괴', '물량 처리'], note: '주무기로 벌레굴을 닫을 수 있는 폭발형 무기입니다. 굴 안에 쏴 넣어 터뜨리면 닫히고, 이럽터는 관통 4라 장갑이 두꺼운 적에게도 통합니다.' },
      { items: ['autocannon', 'grenade-launcher', 'speargun'], tags: ['굴 파괴', '물량 처리'], note: '셋 다 굴을 잘 닫습니다. 오토캐넌은 대전차 역할도 조금 되고, 작살총은 가스 효과가 있어서 소규모 길목 차단도 가능합니다.' },
    ],
  },
  automaton: {
    picks: [
      { items: ['eagle-strafing'], best: true, tags: ['중형 적', '물량 처리', '오브젝트'], note: '중형 적, 무리, 제조소를 이것 하나로 처리합니다.' },
      { items: ['autocannon'], tags: ['중형 적'], note: '데버스테이터 같은 중형 봇을 처리합니다.' },
      { items: ['recoilless', 'quasar'], tags: ['대형 적'], note: '워 스트라이더 같은 대형 봇을 처리합니다. 퀘이사 캐넌은 탄약 보급 없이 쓸 수 있고, 제조소도 보이는 곳 어디서나 한 발에 부숩니다.' },
      { items: ['nova'], tags: ['중형 적', '오브젝트'], note: '탄약 걱정 없이 충전해 쏘는 저격 화기입니다. 제조소를 보이는 곳 어디서나 3발에 부수고, 가만히 서 있는 워 스트라이더의 눈은 한 발입니다.' },
      { items: ['at-emplacement'], tags: ['대형 적'], note: '자리를 잡고 탱크와 워 스트라이더 같은 대형 봇을 연달아 처리합니다.' },
      { items: [{ gear: 'anti-tank-seeker' }], tags: ['대형 적'], note: '던지면 적을 따라가 터지는 관통 5 투척 무기로, 대형 봇을 압박합니다.' },
      { items: [{ gear: 'missile-pistol' }, { gear: 'bolt-pistol' }], tags: ['대형 적'], note: '보조무기로 장갑이 두꺼운 봇을 맡습니다. 미사일 권총은 관통 5, 볼트 피스톨은 관통 4입니다.' },
      { items: ['rocket-sentry'], tags: ['대형 적'], note: '대전차 무기가 부족할 때 무난하게 중장갑 적을 압박합니다.' },
      { items: ['orbital-120'], tags: ['적 증원'], note: '증원으로 내리는 봇을 한 번에 정리합니다.' },
      { items: ['orbital-laser'], tags: ['오브젝트'], note: '제조소와 보조 목표를 철거하기 좋습니다.' },
      { items: ['portable-hellbomb'], tags: ['오브젝트'], note: '교란기 밑에 내려놓기만 해도 교란기를 끄지 않고 부술 수 있고, 건십 시설처럼 철거력 60이 필요한 목표도 부숩니다.' },
    ],
  },
  illuminate: {
    picks: [
      { items: ['autocannon'], best: true, tags: ['물량 처리', '중형 적', '대형 적'], note: '잘 쓰면 모든 적을 상대할 수 있습니다. 진정한 위용이나 이상적인 체형 패시브가 없으면 다루기가 조금 불편합니다.' },
      { items: ['machine-gun-sentry', 'gatling-sentry'], tags: ['물량 처리'], note: '몰려오는 보병을 정리합니다.' },
      { items: ['stalwart', 'machine-gun'], tags: ['물량 처리'], note: '연사로 보병 무리를 정리합니다.' },
      { items: ['guard-dog', 'eagle-rockets'], tags: ['물량 처리', '대형 적'], note: '가드 독은 잡몹을, 이글 110mm 로켓 포드는 하베스터를 맡습니다.' },
      { items: [{ gear: 'breacher' }, { gear: 'thermite' }], tags: ['워프 함선 철거'], note: '어디를 맞혀도 1발로 워프 함선(게이트웨이)을 부숩니다.' },
    ],
    note: '나무가 적은 맵이면 W.A.S.P. 발사기도 좋습니다.',
  },
};

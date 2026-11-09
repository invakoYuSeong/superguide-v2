// Player-facing projection. Technical provenance stays in the original notes;
// never turn missing/ambiguous source text into a gameplay fact.
export function fuseDetails(raw, category) {
  if (category !== 'throwable') return { fuseType: null, fuseOptions: [] };
  const text = String(raw ?? '').trim();
  if (/^impact$/i.test(text)) return { fuseType: 'impact', fuseOptions: [] };
  if (/^proximity$/i.test(text)) return { fuseType: 'proximity', fuseOptions: [] };
  if (/^(?:n\/a|none)$/i.test(text)) return { fuseType: 'none', fuseOptions: [] };
  const seconds = value => {
    const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(?:s|sec(?:onds?)?)\.?$/i);
    return match && Number.isFinite(Number(match[1])) ? Number(match[1]) : null;
  };
  if (seconds(text) !== null) return { fuseType: 'timed', fuseOptions: [] };
  const choices = text.split('/');
  if (choices.length > 1 && choices.every(value => seconds(value) !== null)) {
    return { fuseType: 'selectable', fuseOptions: [...new Set(choices.map(seconds))] };
  }
  return { fuseType: null, fuseOptions: [] };
}

export function variantDisplayName(weapon, variant, index) {
  if (variant.id.startsWith('shrapnel')) return '파편';
  if (variant.id === 'wiki-uncharged') return '비충전 사격';
  if (variant.id === 'wiki-charged') return '충전 사격';
  if (variant.id.startsWith('charge-stage-')) return `충전 단계 ${variant.id.slice('charge-stage-'.length)} · 최종 피해 미확인`;
  if (variant.attack?.parent?.startsWith('Underbarrel_')) return ({
    arbitrator: '하부 산탄총', 'one-two': '하부 유탄 발사기', stoker: '하부 화염방사기',
  })[weapon.id] || '하부 부착 무기';
  if (weapon.id === 'halt') return variant.id === 'projectile-sg-20-p1' ? '기절탄' : '플레셰트탄';
  if (variant.delivery === 'explosion') return weapon.id === 'breacher' ? '지연 폭발' : '폭발';
  if (variant.delivery === 'spray') return '화염 분사';
  if (variant.delivery === 'arc') return '전격';
  if (variant.delivery === 'damage' && weapon.id === 'melta-mine') return '화염벽';
  if (weapon.id === 'double-edge-sickle') return `열 상태별 탄체 ${index + 1}`;
  // Multiple projectile keys do not identify which selectable state they use.
  // Preserve a neutral ordinal instead of inventing guided/charge mappings.
  if (weapon.variants.filter(v => v.delivery === 'projectile' && !v.id.startsWith('charge-stage-') && !v.id.startsWith('shrapnel') && !v.attack?.parent?.startsWith('Underbarrel_')).length > 1) return `탄체 피해 ${index + 1}`;
  return '기본 사격';
}

// What a firing-mode panel on the gear page shows beyond the calculator profile
// (personal-profiles.mjs), keyed by mode id. Numbers come from the datamine or
// the infobox. Notes taken from wiki prose are shown only while their key
// numbers and words are still on the page; otherwise the note is left out with
// a warning, so a wiki rewording never stops the build or leaves a stale note.
const DAMAGE_FIELDS = ['direct', 'durable', 'ap', 'splash', 'splashDurable', 'splashAp', 'radius', 'innerRadius'];
export function modeDetails(weapon, data, wikitext, warn = message => console.warn(`warning: ${message}`)) {
  const damageOf = stats => Object.fromEntries(DAMAGE_FIELDS.map(key => [key, stats[key] ?? null]));
  // A note whose key tokens are all somewhere on the page, else nothing.
  const note = (text, ...tokens) => {
    const missing = tokens.filter(token => !token.test(wikitext));
    if (!missing.length) return [text];
    warn(`${weapon.id}: note left out, wiki text no longer has ${missing.join(' ')}`);
    return [];
  };
  const details = {};
  for (const linked of weapon.linkedAttacks) {
    const record = data.weapons[linked.dataKey];
    if (!record) throw new Error(`${weapon.id}: missing underbarrel record ${linked.dataKey}`);
    // The infobox lists the main barrel first, then the underbarrel ("2.8s (12mm)<br> 2.3s (Flamethrower)").
    const second = field => {
      const values = weapon.reloadDetails?.find(detail => detail.field === field)?.values ?? [];
      return values.length === 2 && values[1].label ? values[1].seconds : null;
    };
    const spray = weapon.variants.find(v => v.attack?.parent === linked.dataKey && v.delivery === 'spray');
    details.underbarrel = {
      magazine: record.cap ?? null,
      spareRounds: record.roundtype === 'rounds' ? record.rounds ?? null : null,
      // With one round per reload a fire rate says nothing about the attachment.
      rpm: record.cap > 1 ? record.rpm ?? null : null,
      reload: second('reload_time'), reloadTactical: second('tac_reload_time'),
    };
    if (spray) {
      // The wiki's whole-weapon fire damage belongs to the flamethrower while the main rounds carry no element.
      const ownsFire = !weapon.element && spray.element === weapon.dot?.element;
      if (!ownsFire) warn(`${weapon.id}: fire damage left out, it no longer clearly belongs to the flamethrower`);
      Object.assign(details.underbarrel, { ap: spray.ap, dot: ownsFire ? weapon.dot : null, fuel: true,
        modeNotes: note('사거리는 약 20m(1인칭 측정)이고, 연료를 가득 채우면 약 6.1초 동안 계속 분사합니다.', /\b20\s?m\b/i, /\b6\.1\s?s/i) });
    }
  }
  if (['missile-pistol', 'warrant'].includes(weapon.id)) {
    // The datamine has two projectile records without saying which one is guided;
    // the guided panel reuses the numbers only while both are the same.
    const shots = weapon.variants.filter(v => v.delivery === 'projectile');
    const same = shots.length === 2 && shots.every(v => JSON.stringify(damageOf(v)) === JSON.stringify(damageOf(weapon)));
    if (!same) warn(`${weapon.id}: guided damage left out, the two projectile records differ`);
    const notes = weapon.id === 'missile-pistol' ? [
      ...note('목표를 고정해야만 발사됩니다. 중형·대형·초대형 적을 최대 100m 거리에서 1초 동안 조준하면 고정됩니다.', /massive/i, /\b100\s?m\b/i, /\bone second\b|\b1\s?s(?:ec(?:ond)?)?\b/i),
      ...note('미사일은 고정한 적을 따라 날아가고, 닿지 못하면 스스로 폭발합니다.', /self-detonat/i),
    ] : [
      ...note('목표를 고정해야만 발사됩니다. 소형·중형·대형 적을 최대 60m 거리에서 약 0.5초 만에 고정하며, 초대형 적은 고정할 수 없습니다.', /massive/i, /\b60\s?(?:m\b|meters)/i, /half a second|\b0\.5\s?s/i),
      ...note('탄이 고정한 적을 향해 휘어 날아가며, 휘는 각도는 약 40도까지입니다.', /\b40\s?(?:\u00b0|degrees)/i),
    ];
    const modeNotes = [...(same ? ['피해는 비유도 사격과 같습니다.'] : []), ...notes,
      ...note('유도 사격은 약점이 아니라 몸 중앙을 노립니다. 약점을 노리려면 비유도로 쏘세요.', /center mass/i)];
    if (same || modeNotes.length) details.guided = { ...(same ? damageOf(weapon) : {}), modeNotes };
  }
  if (weapon.id === 'variable') {
    if (/all remaining (?:ammunition|ammo|rounds)/i.test(wikitext)) details.total = { ...damageOf(weapon), ammoAll: true,
      modeNotes: note('엎드리지 않은 채 22발보다 많이 한꺼번에 쏘면 오른팔에 15 피해를 입고 넘어집니다.', /\b15 damage/i, /\b22 rounds/i, /right arm/i) };
    else warn(`${weapon.id}: Total mode left out, the wiki no longer says it fires all remaining ammunition`);
  }
  return Object.keys(details).length ? { modeDetails: details } : {};
}

// Choices picked before throwing that only the wiki prose names (Caltrops spread).
// A reworded page leaves it out with a build warning instead of failing the build.
export function throwChoices(weapon, wikitext, warn = message => console.warn(`warning: ${message}`)) {
  if (weapon.id !== 'caltrops') return {};
  if (/narrow spread/i.test(wikitext) && /wide spread/i.test(wikitext)) return { spreadModes: ['narrow', 'wide'] };
  warn(`${weapon.id}: spread modes left out, wiki text no longer names narrow and wide spread`);
  return {};
}

// Wiki infobox traits shown as badges on the gear page, in this order.
const TRAIT_TAGS = { incendiary: 'fire', guided: 'guided', arc: 'arc', stun: 'stun' };

export function playerDetails(weapon, box) {
  const fuse = fuseDetails(box.fuse, weapon.category);
  const playerNotes = [];
  for (const conflict of weapon.infoboxConflicts) {
    if (conflict.field === 'spareMags') playerNotes.push(`안내 페이지에는 예비 탄창이 ${conflict.infobox}개로 적혀 있으나, 최신 게임 수치인 ${conflict.db}개를 표시합니다.`);
    if (conflict.field === 'radius' && Array.isArray(conflict.db)) playerNotes.push(`안내 페이지의 폭발 반경 ${conflict.infobox}m와 달리, 최대 피해 반경 ${conflict.db[0]}m와 바깥 경계 ${conflict.db[1]}m를 표시합니다.`);
  }
  if (fuse.fuseType === 'impact') playerNotes.push('충돌 시 작동합니다.');
  if (fuse.fuseType === 'proximity') playerNotes.push('가까운 대상을 감지하면 작동합니다.');
  if (fuse.fuseType === 'selectable') playerNotes.push(`작동 시간을 ${fuse.fuseOptions.map(value => `${value}초`).join('·')} 중에서 고를 수 있습니다.`);
  if (weapon.category === 'throwable' && fuse.fuseType === null) playerNotes.push('신관 작동 방식은 아직 확인하지 못했습니다.');
  if (weapon.shrapnelCount > 0) playerNotes.push('기본은 파편의 20%를 반올림한 개수가 같은 부위에 맞는다고 가정합니다. 명중률을 바꿔 다시 계산할 수 있으며, 파편 0개를 고르면 파편 피해는 제외합니다.');
  if (weapon.pellets > 1) playerNotes.push('표시 피해는 펠릿 한 개 기준입니다. 기본 계산은 펠릿이 모두 맞는다고 가정하며, 명중률을 낮춰 다시 계산할 수 있습니다.');
  if (weapon.id === 'blitzer') playerNotes.push('표시 피해는 전격 한 줄기 기준입니다. 기본은 다섯 줄기가 같은 부위에 모두 맞는다고 가정하며, 명중률을 낮춰 다시 계산할 수 있습니다. 실제로 모두 맞는다는 보장은 없습니다.');
  if ([weapon, ...weapon.variants].some(attack => attack.delivery === 'spray')) playerNotes.push('화염 분사는 불길에 닿은 시간에 따라 피해가 달라져 정확한 처치 탄수를 계산하지 않습니다.');
  if (weapon.delivery === 'beam') playerNotes.push(weapon.damageKind === 'dps'
    ? '표시 피해는 빔이 1초 동안 닿는 기준입니다. 한 발의 피해나 처치 탄수로 환산하지 않습니다.'
    : '빔의 피해가 적용되는 시간이 확인되지 않아 처치 탄수로 환산하지 않습니다.');
  if (weapon.charge) playerNotes.push('충전별 최종 피해가 모두 확인되지 않았습니다. 아래 피해를 확정된 충전 사격 피해로 보거나 더하지 마세요.');
  if (weapon.id === 'double-edge-sickle') playerNotes.push('열에 따라 피해가 달라집니다. 열 상태가 바뀌는 조건을 확인하지 못해 처치 탄수는 계산하지 않습니다.');
  if (weapon.dot?.raw) playerNotes.push('불붙거나 가스에 노출된 뒤 이어지는 지속 피해는 처치 탄수에 더하지 않습니다.');
  if (weapon.linkedAttacks.length) playerNotes.push(({
    arbitrator: '주 총열과 하부 산탄총을 전환해 사용합니다. 두 공격의 피해는 합산하지 않습니다.',
    'one-two': '주 총열과 하부 유탄 발사기를 전환해 사용합니다. 탄약과 처치 탄수는 따로 계산합니다.',
    stoker: '주 총열과 하부 화염방사기를 전환해 사용합니다. 화염방사 모드의 처치 탄수는 계산하지 않습니다.',
  })[weapon.id] || '하부 부착 무기로 전환할 수 있습니다. 두 공격의 피해는 합산하지 않습니다.');
  if (weapon.id === 'halt') playerNotes.push('플레셰트탄과 기절탄은 각각 8발씩 별도 탄창에 담습니다.');
  if (weapon.id === 'breacher') playerNotes.push('사격 모드는 하나입니다. 처치 탄수는 직격과 붙은 뒤의 지연 폭발을 함께 반영하며, 지속 피해는 포함하지 않습니다.');
  if (['pyrotech', 'melta-mine'].includes(weapon.id)) playerNotes.push('처치 탄수는 첫 폭발만 반영합니다. 남은 불길의 지속 피해는 포함하지 않습니다.');
  if (weapon.variants.some(v => v.delivery === 'projectile' && !v.id.startsWith('shrapnel')) && ['missile-pistol', 'warrant'].includes(weapon.id)) playerNotes.push('유도와 비유도를 전환할 수 있습니다. 처치 탄수는 비유도 사격 기준입니다.');
  // Effect badges straight from the wiki infobox trait list ("Incendiary {{*}} Guided ...").
  const traits = String(box.weapon_traits ?? box.throwable_traits ?? '').split('{{*}}').map(trait => trait.trim().toLowerCase());
  const traitTags = Object.entries(TRAIT_TAGS).filter(([wiki]) => traits.includes(wiki)).map(([, tag]) => tag);
  return { ...fuse, playerNotes, traitTags };
}

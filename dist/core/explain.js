// Turns engine results into short text (Korean, or English in the English
// edition). No numbers are computed here beyond formatting; everything shown
// comes from the engines or the data.
import { explosionsOf, partPool } from './combat.js';
import { L, T, lang, locale, plural } from './i18n.js';

export const num = value => Number.isFinite(value) ? value.toLocaleString(locale(), { maximumFractionDigits: 2 }) : L('미확인', 'Unverified');
export const pct = value => Number.isFinite(value) ? `${num(value)}%` : L('미확인', 'Unverified');
export const stageName = stage => stage.copy ? `${T(stage.part.name)} (${L(`${stage.copy}번째`, `copy ${stage.copy}`)})` : T(stage.part.name);

// --- Units -------------------------------------------------------------------

// English words for the counted things (data keeps Korean labels as keys).
const EN_UNIT_LABEL = { 수류탄: ['grenade', 'grenades'], 지뢰: ['mine', 'mines'], 다이너마이트: ['stick', 'sticks'] };
const EN_PROJECTILE = { 펠릿: ['pellet', 'pellets'], 탄환: ['bullet', 'bullets'] };
const enWords = mode => {
  if (mode?.unit === '개' && mode.unitLabel) return EN_UNIT_LABEL[mode.unitLabel] || ['item', 'items'];
  if (mode?.unit === '개' && mode.delivery === 'explosive') return ['throw', 'throws'];
  if (mode?.unit === '개') return ['charge', 'charges'];
  if (mode?.unit === '회') return ['hit', 'hits'];
  return ['shot', 'shots'];
};
const projectile = (mode, count = 2) => {
  const name = mode?.hitCondition?.projectileName || '펠릿';
  if (lang !== 'en') return name;
  const [one, many] = EN_PROJECTILE[name] || [T(name), T(name)];
  return count === 1 ? one : many;
};

/** Unit wording for a mode. English needs the count for "1 shot" / "3 shots"; the
 * unit then carries its own leading space so `${num(n)}${unit}` reads either way. */
export function unitOf(mode, count = 2) {
  if (lang === 'en') {
    const [one, many] = enWords(mode);
    const word = count === 1 ? one : many;
    const noun = { shot: 'Shots', grenade: 'Grenades', mine: 'Mines', stick: 'Sticks', throw: 'Throws', charge: 'Charges', hit: 'Hits' }[one] || 'Count';
    return { unit: ` ${word}`, noun, one: `1 ${one}`, word };
  }
  if (mode?.unit === '개' && mode.unitLabel) return { unit: '개', noun: `${mode.unitLabel} 개수`, one: `${mode.unitLabel} 1개` };
  if (mode?.unit === '개' && mode.delivery === 'explosive') return { unit: '개', noun: '투척물 개수', one: '투척물 1개' };
  if (mode?.unit === '개') return { unit: '개', noun: '장약 수', one: '장약 1개' };
  if (mode?.unit === '회') return { unit: '회', noun: '타격 수', one: '타격 1회' };
  return { unit: '발', noun: '탄수', one: '1발' };
}

/** Unit word for a plain Korean unit ('발', '개', '회') coming from engine results. */
export const unitText = (unit, count = 2) => lang === 'en' ? unitOf({ unit: unit || '발' }, count).unit : unit || '발';

// --- Outcomes ----------------------------------------------------------------

export const OUTCOME = {
  kill: { label: L('처치', 'Kill'), tone: 'kill' },
  bleed: { label: L('출혈 유발', 'Bleeds out'), tone: 'bleed' },
  down: { label: L('추락', 'Downed'), tone: 'kill' },
  break: { label: L('부위 파괴', 'Part destroyed'), tone: 'break' },
  armor: { label: L('장갑 제거', 'Armor stripped'), tone: 'break' },
  blocked: { label: L('관통 불가', 'No penetration'), tone: 'blocked' },
  shield: { label: L('보호막 먼저', 'Shield first'), tone: 'unknown' },
  unknown: { label: L('계산 보류', 'Not calculated'), tone: 'unknown' },
};
export const outcomeOf = (row) => row.outcome === 'break' && row.target.resultLabel
  ? { label: row.target.resultLabel, tone: 'break' } : OUTCOME[row.outcome];

/** "3발", "2개 이상" … A floor is marked when the count ignores regeneration. */
export function countText(row, mode) {
  if (row.hits == null) return null;
  if (lang === 'en') return `${num(row.hits)}${row.lowerBound ? '+' : ''}${unitOf(mode, row.hits).unit}`;
  const label = mode?.unit === '개' && mode.unitLabel ? `${mode.unitLabel} ` : '';
  return `${label}${num(row.hits)}${unitOf(mode).unit}${row.lowerBound ? ' 이상' : ''}`;
}

// --- Reasons -----------------------------------------------------------------

const REASONS = {
  'cap-unknown': L('본체로 넘어가는 피해의 상한이 확인되지 않았고, 상한 유무에 따라 결과가 달라 계산하지 않았습니다.', 'The cap on damage passed to main health is unverified, and the result depends on it, so this was not calculated.'),
  'assumption-needed': L('한 발에서 이 부위에 몇 개가 맞는지 골라야 계산됩니다. 실제 명중 수는 확인된 자료가 없습니다.', 'Pick how many hit this part per shot to calculate. There is no verified data on the real number of hits.'),
  'data-missing': L('이 부위에 필요한 피해·관통·반경 중 일부가 확인되지 않아 최종 횟수는 계산하지 않았습니다.', 'Some of the damage, penetration or radius values for this part are unverified, so the final count was not calculated.'),
  'assumption-data-missing': L('선택한 명중 가정에 필요한 피해 수치가 확인되지 않았습니다.', 'The damage values needed for the chosen hit assumption are unverified.'),
  'no-damage': L('관통하지 못해 이 부위와 본체 모두 피해가 없습니다.', 'It cannot penetrate, so neither this part nor main health takes damage.'),
  'no-damage-after-armor': L('장갑은 벗길 수 있지만 드러난 부위에는 피해가 들어가지 않습니다.', 'It can strip the armor but does no damage to what is underneath.'),
  'no-damage-assumed': L('선택한 명중 가정에서는 피해가 들어가지 않습니다.', 'The chosen hit assumption deals no damage.'),
  'leftover-events': L('장갑이 깨진 뒤 같은 발의 남은 전격·자탄이 안쪽에 닿는지 확인되지 않아 계산하지 않았습니다.', 'It is unverified whether the rest of the same shot (arcs, bomblets) reaches the inside once the armor breaks, so this was not calculated.'),
  'too-many-hits': L('필요 횟수가 계산 범위를 넘습니다.', 'The count needed is beyond the calculation range.'),
  'beam-data-missing': L('광선 피해·지속시간 또는 부위 수치가 확인되지 않았습니다.', 'Beam damage, duration or part values are unverified.'),
  'beam-blocked': L('광선이 이 부위 장갑을 관통하지 못합니다.', 'The beam cannot penetrate this part\'s armor.'),
};
export const reasonText = row => ['unsupported', 'shield', 'part-unknown'].includes(row.reason)
  ? row.detail || L('정밀 피해 자료가 아직 확인되지 않았습니다.', 'Detailed damage data has not been verified yet.') : REASONS[row.reason] || '';

// --- Attack description --------------------------------------------------------

export function deliveryOf(mode) {
  if (mode?.hitCondition?.kind === 'pellets') return { hit: L(`${projectile(mode)} 1개`, `1 ${projectile(mode, 1)}`), verb: L('명중', 'Hit') };
  if (mode?.delivery === 'explosive') return { hit: L('폭발', 'Explosion'), verb: L('기폭', 'Detonation') };
  if (mode?.beam) return { hit: L('광선', 'Beam'), verb: L('광선 유지', 'Beam held') };
  if (mode?.delivery === 'arc') return { hit: L('전격', 'Arc'), verb: L('전격 명중', 'Arc hit') };
  if (mode?.delivery === 'guided') return { hit: L('착탄', 'Impact'), verb: L('착탄', 'Impact') };
  if (mode?.delivery === 'flag' || mode?.delivery === 'melee') return { hit: L('타격', 'Strike'), verb: L('타격', 'Strike') };
  if (mode?.delivery === 'adhesive') return { hit: L('부착 폭발', 'Stuck explosion'), verb: L('부착', 'Stick') };
  return { hit: L('직격', 'Direct hit'), verb: L('명중', 'Hit') };
}

/** Stat chips for an attack mode: [{ label, value, note? }]. */
export function attackStats(mode) {
  if (!mode || mode.unsupported) return [];
  const durable = value => L(`내구 ${value}`, `Durable ${value}`);
  const radii = (inner, outer) => L(`중심 ${num(inner)}m / 외곽 ${num(outer)}m`, `inner ${num(inner)}m / outer ${num(outer)}m`);
  if (mode.beam) return [
    { label: L('초당 피해', 'Damage per second'), value: `${num(mode.beam.standardPerSecond)}`, note: `${durable(num(mode.beam.durablePerSecond))}${L('/초', '/s')}` },
    { label: L('1발 지속', 'One shot lasts'), value: `${num(mode.beam.duration)}${L('초', 's')}`, note: L(`최대 ${num(mode.standard)}`, `Max ${num(mode.standard)}`) },
    { label: L('관통', 'Penetration'), value: `AP ${mode.ap}` },
  ];
  const stats = [];
  if (mode.directKind !== 'none' && !(mode.standard === 0 && mode.durable === 0)) {
    stats.push({ label: deliveryOf(mode).hit, value: num(mode.standard), note: `${durable(num(mode.durable))} · AP ${mode.ap}` });
  }
  for (const blast of explosionsOf(mode)) {
    stats.push({ label: blast.name || L('폭발', 'Explosion'), value: num(blast.durable ?? blast.standard), note: `AP ${num(blast.ap)}${Number.isFinite(blast.innerRadius) ? ` · ${radii(blast.innerRadius, blast.radius)}` : ''}` });
  }
  if (mode.bomblet) {
    const b = mode.bomblet;
    const plusBlast = value => L(` + 폭발 ${value}`, ` + explosion ${value}`);
    if (mode.hitCondition?.kind === 'shrapnel') {
      stats.push({ label: L('파편 1개', '1 fragment'), value: `${num(b.standard)}${b.explosion > 0 ? plusBlast(num(b.explosion)) : ''}`,
        note: `${durable(num(b.durable))} · AP ${num(b.ap)}${b.explosion > 0 ? L(` · 폭발 AP ${num(b.explosionAp)}`, ` · explosion AP ${num(b.explosionAp)}`) : ''}` });
    } else stats.push({ label: L('자탄 1개', '1 bomblet'), value: `${num(b.standard)}${plusBlast(num(b.explosion))}`, note: `AP ${b.ap}/${b.explosionAp} · ${radii(b.innerRadius, b.radius)}` });
  }
  return stats;
}

/** One-line statement of what the count assumes for this kind of attack. */
export function assumptionText(mode) {
  const c = mode?.hitCondition;
  if (c?.kind === 'pellets') return L(`기본은 ${projectile(mode)}이 모두 같은 부위에 맞는다고 계산합니다. 명중률을 낮춰 다시 계산할 수 있습니다.`,
    `By default all ${projectile(mode)} hit the same part. You can lower the hit rate to recalculate.`);
  if (c?.kind === 'shrapnel') return L(`기본은 파편의 ${c.defaultPct}%를 반올림한 개수가 같은 부위에 ${mode.delivery === 'explosive' ? '주폭발' : '주탄 직격·폭발'}과 함께 맞는 가정입니다. 명중률을 바꿀 수 있으며, 파편 0개를 고르면 파편 피해는 제외합니다.`,
    `By default ${c.defaultPct}% of the fragments (rounded) hit the same part along with the ${mode.delivery === 'explosive' ? 'main explosion' : 'main projectile\'s impact and explosion'}. You can change the hit rate; 0 fragments leaves shrapnel damage out.`);
  if (c?.kind === 'arcs') return L('기본은 전격이 모두 같은 부위에 맞는다고 가정합니다. 명중률을 낮춰 다시 계산할 수 있으며, 실제로 모두 맞는다는 보장은 없습니다.',
    'By default every arc hits the same part. You can lower the hit rate to recalculate; there is no guarantee they all land.');
  if (c?.kind === 'bomblets') return L(`기본은 자탄의 ${c.defaultPct}%를 반올림한 개수의 ${c.defaultBombletDirect ? '직격과 폭발' : '폭발'}이 같은 부위에 맞는 가정입니다.${c.defaultPrimaryHit === 'none' ? ' 주탄 피해는 기본에서 제외합니다.' : ''} 명중률과 주탄·자탄의 직격 여부를 바꿔 다시 계산할 수 있습니다. 여러 부위 동시 피해는 더하지 않습니다.`,
    `By default ${c.defaultPct}% of the bomblets (rounded) hit the same part with their ${c.defaultBombletDirect ? 'impact and explosion' : 'explosion'}.${c.defaultPrimaryHit === 'none' ? ' The main projectile\'s damage is left out by default.' : ''} You can change the hit rate and whether the main projectile and bomblets hit directly. Damage to several parts at once is not added.`);
  if (mode?.delivery === 'explosive') return L('기폭 시 같은 부위에 최대 폭발 피해가 닿는 조건입니다. 여러 부위에 동시에 들어가는 피해는 더하지 않습니다.',
    'Assumes the part takes full explosion damage on each detonation. Damage to several parts at once is not added.');
  if (mode?.beam) return L('같은 부위에 광선을 계속 유지하는 조건. 한 발은 약 1.4초 분량으로 환산합니다.',
    'Assumes the beam stays on the same part. One shot counts as about 1.4 seconds of beam.');
  if (c) return L('선택한 명중 수가 모두 해당 부위에 최대 피해로 들어가는 가정. 여러 부위 동시 피해는 더하지 않습니다.',
    'Assumes every chosen hit lands on the part at full damage. Damage to several parts at once is not added.');
  if (mode?.delivery === 'adhesive') return L('장약 하나하나가 해당 부위에 최대 폭발 피해를 주는 조건. 여러 부위 동시 피해는 더하지 않습니다.',
    'Assumes each charge deals full explosion damage to the part. Damage to several parts at once is not added.');
  if (mode?.delivery === 'melee' || mode?.delivery === 'flag') return L('같은 부위를 정면에서 계속 타격하는 조건. 방어구의 근접 피해 보너스는 제외합니다.',
    'Assumes repeated strikes on the same part from the front. Armor melee bonuses are left out.');
  if (mode?.delivery === 'guided') return L('미사일이 해당 부위에 직접 착탄하는 조건. 유도 궤적이 이 부위를 보장하지는 않습니다.',
    'Assumes the missile impacts this part directly. The guided path does not guarantee it.');
  if (mode?.delivery === 'arc') return L('전격이 해당 부위에 계속 닿는 조건. 전격은 부위를 골라 조준할 수 없습니다.',
    'Assumes the arc keeps hitting this part. Arcs cannot be aimed at a specific part.');
  if (explosionsOf(mode || {}).length) return L('같은 부위에 직격과 최대 폭발 피해가 함께 들어가는 조건. 여러 부위 동시 피해는 더하지 않습니다.',
    'Assumes the part takes the direct hit plus full explosion damage. Damage to several parts at once is not added.');
  return L('같은 부위를 최대 피해로 계속 맞히는 조건. 거리·각도·빗맞음에 따라 실전에서는 더 필요합니다.',
    'Assumes every shot hits the same part at full damage. Range, angle and misses mean you will need more in a real fight.');
}

// --- Route notes ---------------------------------------------------------------

/** Aim hint for a route: the data's tip plus the attack-specific condition. */
export function aimText(row, mode) {
  const target = row.target;
  const lines = [target.tip];
  if (target.copies > 1) lines.push(L('한쪽을 부순 사격에서 남은 피해(산탄·파편 등)는 다른 쪽에 넘기지 않고 계산합니다.', 'Damage left in the shot that destroys one copy does not carry over to the other.'));
  if (mode?.hitCondition) lines.push(assumptionSummary(mode));
  const radius = explosionsOf(mode || {}).map(blast => blast.innerRadius).filter(Number.isFinite);
  if (mode?.delivery === 'adhesive' && radius.length) lines.push(L(`기폭 시 이 부위가 폭발 중심 ${num(Math.min(...radius))}m 안에 들어오게 붙이세요.`, `Stick it so this part is within ${num(Math.min(...radius))}m of the blast center when it goes off.`));
  else if (radius.length && (!mode?.hitCondition || mode.hitCondition.kind === 'shrapnel')) lines.push(L(`이 부위가 폭발 중심 ${num(Math.min(...radius))}m 안에 들어와야 최대 피해입니다.`, `This part must be within ${num(Math.min(...radius))}m of the blast center for full damage.`));
  if (target.exdr === 100 && radius.length) {
    lines.push(target.partOnly ? L('이 장치는 폭발에 면역이라 폭발 피해는 장치 파괴에 더하지 않습니다.', 'This device is immune to explosions, so explosion damage does not count toward destroying it.')
      : L('이 부위는 폭발에 면역이라 폭발 피해는 본체 장갑·저항으로 따로 계산합니다.', 'This part is immune to explosions, so explosion damage is calculated separately against the main body\'s armor and resistance.'));
  }
  if (target.next && row.stages.length > 1 && mode?.beam) lines.push(L(`같은 자리에 광선을 계속 비추면 장갑이 타서 없어진 뒤 ${josa(target.next.name, ['으로', '로'])} 이어서 닿습니다.`,
    `Keep the beam on the same spot: once the armor burns away, it carries on into ${T(target.next.name)}.`));
  else if (target.next && row.stages.length > 1) lines.push(L(`장갑이 깨지면 다음 ${mode?.unitLabel || unitOf(mode).unit}부터 ${josa(target.next.name, ['을', '를'])} 노리세요. 초과 피해는 넘어가지 않습니다.`,
    `Once the armor breaks, aim the following ${unitOf(mode).word} at ${T(target.next.name)}. Excess damage does not carry over.`));
  return lines.filter(Boolean);
}

export function routeNotes(row, mode) {
  const { noun } = unitOf(mode);
  const target = row.target;
  const notes = [];
  if (row.reason && row.hits == null) {
    const multi = ['pellets', 'shrapnel'].includes(mode?.hitCondition?.kind);
    notes.push(multi && row.reason === 'assumption-needed' ? assumptionSummary(mode)
      : multi && row.reason === 'leftover-events' ? L('장갑이 깨진 뒤 같은 발의 남은 탄체·펠릿·파편이 안쪽에 닿는지 확인되지 않아 처치 횟수를 계산하지 않습니다.', 'It is unverified whether the rest of the same shot (projectiles, pellets, fragments) reaches the inside once the armor breaks, so the kill count is not calculated.') : reasonText(row));
  }
  notes.push(...row.notes);
  if (target.followupNote) notes.push(target.followupNote);
  if (target.destroyMainDamage) notes.push(L(`부위가 파괴되면 본체에 ${num(target.destroyMainDamage)} 피해가 한 번 더 들어갑니다.`, `Destroying the part deals another ${num(target.destroyMainDamage)} damage to main health.`));
  for (const part of [target, target.next].filter(Boolean)) {
    if (part.staticConstitution) notes.push(L(`${part.name} 체력은 기본 ${num(part.hp)}에 줄지 않는 추가 체력 ${num(part.staticConstitution)}을 더한 ${num(partPool(part))}입니다.`,
      `${T(part.name)} health is ${num(partPool(part))}: the base ${num(part.hp)} plus ${num(part.staticConstitution)} extra health that never goes down.`));
  }
  if (target.main) notes.push(L(`${target.main.name} 체력 ${num(target.main.hp)} 기준으로, 다른 체력 풀과 따로 계산합니다.`, `Based on ${T(target.main.name)} health ${num(target.main.hp)}, calculated apart from other health pools.`));
  if (row.outcome === 'bleed') notes.push(L('본체 체력이 바닥나 출혈이 시작됩니다. 완전히 쓰러지기까지 잠시 공격할 수 있습니다.', 'Main health runs out and it starts to bleed out. It can keep attacking for a moment before it goes down.'));
  if (row.outcome === 'break' || row.outcome === 'armor') notes.push(L(`이 ${noun}는 처치가 아닌 부위 파괴까지입니다.`, `This count destroys the part; it is not a kill.`));
  if (row.outcome === 'down') notes.push(L('수송선이 추락하는 횟수입니다. 탑승 병력 처치는 보장하지 않습니다.', 'This is the count to bring the ship down. It does not guarantee killing the troops aboard.'));
  if (row.via === 'main' && row.hits != null) notes.push(L('이 부위를 통해 본체 체력을 모두 깎는 경로입니다.', 'This route depletes main health through this part.'));
  if (row.conditional) notes.push(target.prerequisiteNote || L(`선행 조건(${target.prerequisite})을 먼저 충족한 뒤의 ${noun}입니다. 선행 공격은 포함하지 않습니다.`, `Count after the prerequisite (${T(target.prerequisite)}) is met. The attacks needed for it are not included.`));
  if (mode?.explosions && target.next) notes.push(L('한 발의 두 폭발이 장갑과 안쪽에 차례로 들어가는 효과는 확인되지 않아 제외했습니다.', 'Whether a shot\'s two explosions hit the armor and then the inside in turn is unverified, so that effect is left out.'));
  return notes;
}

// --- Hit assumption controls ----------------------------------------------------

export function assumptionSummary(mode) {
  if (!mode?.hitCondition) return '';
  if (!mode.assumption) {
    if (mode.hitCondition.kind === 'pellets') return L(`한 발에서 이 부위에 맞는 ${projectile(mode)} 수를 고르세요.`, `Pick how many ${projectile(mode)} per shot hit this part.`);
    if (mode.hitCondition.kind === 'shrapnel') return L('폭발 1회에서 이 부위에 맞는 파편 수를 고르세요. 0개는 파편 피해를 제외합니다.', 'Pick how many fragments per explosion hit this part. 0 leaves shrapnel damage out.');
    return L('한 발에서 이 부위에 맞는 개수를 고르세요.', 'Pick how many per shot hit this part.');
  }
  const { count, primaryHit, bombletDirect } = mode.assumption;
  if (mode.hitCondition.kind === 'pellets') {
    const { max } = mode.hitCondition;
    return count === max ? L(`${projectile(mode)} ${max}개가 모두 이 부위에 명중 (전탄 명중 가정)`, `All ${max} ${projectile(mode, max)} hit this part (all-hit assumption)`)
      : L(`${projectile(mode)} ${max}개 중 ${count}개 명중 (약 ${Math.round(count / max * 100)}%)`, `${count} of ${max} ${projectile(mode, max)} hit (about ${Math.round(count / max * 100)}%)`);
  }
  const { max } = mode.hitCondition;
  const ratio = count / max * 100;
  const percent = `${Number.isInteger(ratio) ? '' : L('약 ', '~')}${Math.round(ratio)}%`;
  const tag = count === mode.hitCondition.default ? L(' (기본 가정)', ' (default assumption)') : L(' (명중 수 가정)', ' (assumed hits)');
  if (mode.hitCondition.kind === 'shrapnel') {
    const primary = mode.delivery === 'explosive' ? L('주폭발', 'main explosion') : L('주탄 직격 + 폭발', 'main projectile impact + explosion');
    return count === 0 ? L(`폭발 1회당 파편 0개가 이 부위에 명중 + ${primary} (파편 피해 제외)`, `0 fragments per explosion hit this part + ${primary} (shrapnel left out)`)
      : L(`파편 ${max}개 중 ${count}개(${percent})가 이 부위에 명중${tag} + ${primary}`, `${count} of ${max} fragments (${percent}) hit this part${tag} + ${primary}`);
  }
  if (mode.hitCondition.kind === 'arcs') return (count === max ? L(`전격 ${max}회 모두 이 부위에 명중`, `All ${max} arcs hit this part`)
    : L(`전격 ${max}회 중 ${count}회(${percent})가 이 부위에 명중`, `${count} of ${max} arcs (${percent}) hit this part`)) + tag;
  const primary = { none: L('주탄 피해 제외', 'No main projectile damage'), blast: L('주탄 폭발만', 'Main projectile explosion only'), direct: L('주탄 직격 + 폭발', 'Main projectile impact + explosion') }[primaryHit];
  return L(`${primary} · 자탄 ${max}개 중 ${count}개(${percent}) ${bombletDirect && count > 0 ? '직격 + 폭발' : '폭발'}이 이 부위에 명중${tag}`,
    `${primary} · ${count} of ${max} bomblets (${percent}) hit this part with ${bombletDirect && count > 0 ? 'impact + explosion' : 'explosion'}${tag}`);
}

// Korean particle after a word: 와/과, 을/를, 은/는 depending on a final consonant.
export function josa(word, [withFinal, withoutFinal]) {
  const code = String(word).trim().slice(-1).charCodeAt(0) - 0xac00;
  const final = code >= 0 && code < 11172 ? code % 28 !== 0 : false;
  return `${word}${final ? withFinal : withoutFinal}`;
}

/** Short tag for counts that rest on an assumption rather than plain aiming. */
export function assumptionTag(mode) {
  const c = mode?.hitCondition;
  const chosen = mode?.assumption ? L('가정', 'assumed') : L('선택 필요', 'pick one');
  if (c?.kind === 'pellets') return mode.assumption?.count === c.max
    ? L('전탄 명중 가정', 'All-hit assumption') : L(`${projectile(mode)} 명중 수 ${chosen}`, `${projectile(mode)} hits: ${chosen}`);
  if (c?.kind === 'shrapnel') return mode.assumption?.count === 0
    ? L(`파편 제외 · ${mode.delivery === 'explosive' ? '폭발만' : '직격·폭발만'}`, `No shrapnel · ${mode.delivery === 'explosive' ? 'explosion only' : 'impact and explosion only'}`)
    : mode.assumption && mode.assumption.count === c.default ? L(`파편 ${c.defaultPct}% 기본 가정`, `Default ${c.defaultPct}% fragments`) : L(`파편 명중 수 ${chosen}`, `Fragment hits: ${chosen}`);
  if (['arcs', 'bomblets'].includes(c?.kind)) {
    const name = c.kind === 'arcs' ? L('전격', 'arcs') : L('자탄', 'bomblets');
    return mode.assumption && mode.assumption.count === c.default ? L(`${name} ${c.defaultPct}% 기본 가정`, `Default ${c.defaultPct}% ${name}`)
      : L(`${name} 명중 수 ${chosen}`, `Hits (${name}): ${chosen}`);
  }
  if (!mode?.conditionalImpact) return '';
  if (mode.beam) return L('광선 유지 가정', 'Assumes beam held');
  if (mode.delivery === 'arc') return L('전격 명중 가정 · 부위 조준 불가', 'Assumes arc hits · cannot aim at parts');
  if (mode.delivery === 'guided') return L('착탄 부위 가정 · 유도 궤적 비보장', 'Assumed impact point · guided path not guaranteed');
  if (mode.delivery === 'harpoon') return L('직격만 계산 · 가스 피해 제외', 'Impact only · gas damage left out');
  if (mode.delivery === 'flag') return L('찌르기 명중 가정', 'Assumes stab hits');
  return L('명중 조건 가정', 'Assumed hit condition');
}

export { plural };

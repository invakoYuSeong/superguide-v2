import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchKoreanNames } from './fetch-weapons-source.mjs';
import { infoboxExtras, infoboxDisagreements, reviewedConflicts } from './weapon-infobox.mjs';
import { buildPersonalProfiles } from './personal-profiles.mjs';
import { playerDetails, variantDisplayName, modeDetails, throwChoices } from './personal-display.mjs';

const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const source = await read('db/source/weapons_data.json');
const categoriesSource = await read('db/source/wiki_categories.json');
const pagesSource = await read('db/source/wiki_pages.json');
const koreanSource = await read('db/source/korean_names.json');
const data = source.data;
// The datamine sometimes renames a weapon's attack reference without renaming the
// record it points to (revision 139350: P-34 BREACHER refers to "P-34_BREACHER_E",
// the record is still "P-34 BREACHER_E"). Link such a reference to the one record whose
// name differs only by spaces and underscores; the attack list itself is kept as is.
export function repairReferences(snapshot) {
  const loose = name => name.replace(/[\s_]+/g, '_').toUpperCase();
  const repairs = [];
  for (const [weaponKey, weapon] of Object.entries(snapshot.weapons)) {
    for (const attack of weapon.attacks ?? []) {
      const table = snapshot[attack.type];
      if (!table || attack.type === 'weapons' || table[attack.name]) continue;
      const matches = Object.keys(table).filter(key => loose(key) === loose(attack.name));
      if (matches.length !== 1) continue;
      table[attack.name] = table[matches[0]];
      repairs.push({ weapon: weaponKey, type: attack.type, reference: attack.name, record: matches[0] });
    }
  }
  return repairs;
}
export const referenceRepairs = repairReferences(data);
const categories = categoriesSource.categories;
const roster = { 'Primary Weapons': 'primary', 'Secondary Weapons': 'secondary', Throwables: 'throwable' };
const subtypeNames = ['Assault Rifles', 'Marksman Rifles', 'Shotguns', 'Submachine Guns', 'Energy-Based', 'Pistols', 'Melee', 'Special Secondaries', 'Standard Throwables', 'Special Throwables'];
const normalize = value => value.toUpperCase().replace(/[^A-Z0-9]/g, '');
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const keys = new Map(Object.keys(data.weapons).map(key => [normalize(key), key]));
const aliases = { 'CQC-73 Entrenchment Tool': 'CQC-72 ENTRENCHMENT TOOL' };
// Korean names for weapons the Namu Wiki snapshot has no heading for, chosen by the site owner.
// Entry shape: { 'CODE': { name: '이름', reason: '...' } }. Empty since Namu Wiki added AR-32 퍼시파이어 (2026-10-22).
export const manualKoreanNames = {};
const titles = Object.keys(roster).flatMap(key => categories[key].map(p => p.title));
export const koreanMatches = matchKoreanNames(koreanSource.pages, titles);
const dataTitles = titles.map(title => aliases[title] ?? keys.get(normalize(title)) ?? title);
const dataNames = matchKoreanNames(koreanSource.pages, dataTitles);
for (const [index, title] of titles.entries()) {
  const code = title.match(/^(\S*\d\S*)\s/)?.[1];
  const dataCode = dataTitles[index].match(/^(\S*\d\S*)\s/)?.[1];
  if (!koreanMatches.names[code] && normalize(code ?? '') !== normalize(dataCode ?? '') && dataNames.names[dataCode]) {
    koreanMatches.names[code] = { ...dataNames.names[dataCode], matchedCode: dataCode };
    koreanMatches.unmatchedRoster = koreanMatches.unmatchedRoster.filter(w => w.title !== title);
    koreanMatches.unmappedHeadings = koreanMatches.unmappedHeadings.filter(h => h.source !== dataNames.names[dataCode].source || h.heading !== dataNames.names[dataCode].evidence);
  }
}
const apAll = damage => {
  if (!damage) return null;
  const values = [1, 2, 3, 4].map(index => number(damage[`ap${index}`]));
  return new Set(values).size > 1 ? values : null;
};
const element = damage => damage?.element_name && damage.element_name !== 'none' ? damage.element_name : null;

// Split only at the outer infobox level: nested templates and piped links are values.
export function parseInfobox(wikitext) {
  if (!wikitext) return {};
  const text = wikitext.replace(/<!--[\s\S]*?-->/g, '');
  const start = text.search(/\{\{\s*(?:Infobox[ _]+(?:Weapon|Throwable)|Weapon|Throwable)\s*(?=[|\n])/i);
  if (start < 0) return {};
  let braces = 1, links = 0, part = '', parts = [];
  for (let i = start + 2; i < text.length; i++) {
    const pair = text.slice(i, i + 2);
    if (pair === '{{') { braces++; part += pair; i++; }
    else if (pair === '}}') {
      if (--braces === 0) { parts.push(part); break; }
      part += pair; i++;
    } else if (pair === '[[') { links++; part += pair; i++; }
    else if (pair === ']]') { links--; part += pair; i++; }
    else if (text[i] === '|' && braces === 1 && links === 0) { parts.push(part); part = ''; }
    else part += text[i];
  }
  if (braces !== 0) throw new Error('Unclosed infobox');
  return Object.fromEntries(parts.slice(1).flatMap(part => {
    const equal = part.indexOf('=');
    return equal < 0 ? [] : [[part.slice(0, equal).trim().toLowerCase(), part.slice(equal + 1).trim()]];
  }));
}
export const plainWiki = value => (value ?? '').replace(/<ref\b[^>]*\/>|<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2').replace(/'''?/g, '').replace(/&nbsp;|&#160;/g, ' ').trim();
export function seconds(value) {
  const match = plainWiki(value).match(/^(\d+(?:\.\d+)?)\s*(?:s|sec(?:onds?)?)\.?$/i);
  return match ? number(Number(match[1])) : null;
}
export function reloadTimes(box) {
  const details = Object.entries(box).filter(([field, value]) => /reload/.test(field) && value).map(([field, raw]) => ({
    field, raw, values: plainWiki(raw).split(/<br\s*\/?\s*>/i).map(text => {
      const match = text.trim().match(/^(\d+(?:\.\d+)?)\s*(?:s|sec(?:onds?)?)\.?\s*(?:\(([^)]+)\))?$/i);
      return { seconds: match ? Number(match[1]) : null, label: match?.[2] ?? null, text: text.trim() };
    }),
  }));
  const select = field => {
    const values = details.find(item => item.field === field)?.values ?? [];
    if (values.length === 1 && values[0].seconds !== null) return { value: values[0].seconds, field, label: values[0].label };
    // The observed 8mm/12mm labels identify the main barrel; preserve the other
    // barrels and the separately labelled rechamber operation in details.
    if (values.some(v => v.seconds === null || v.label !== null && !/^(?:8mm|12mm|40mm|Flamethrower|Just Rechambering)$/i.test(v.label))) return null;
    const main = values.filter(v => /^(?:8|12)mm$/i.test(v.label ?? '') || v.label === null);
    return main.length === 1 ? { value: main[0].seconds, field, label: main[0].label } : null;
  };
  return { reload: ['reload_time', 'rounds_reload_full_time', 'tac_reload_time'].map(select).find(Boolean) ?? null,
    tactical: select('tac_reload_time'), details };
}
// No multiplication: accept only explicitly labelled component values.
export function chargeDamage(value) {
  const result = new Map();
  let state = null;
  for (const raw of (value ?? '').split(/<br\s*\/?\s*>|\n|;/gi)) {
    const line = plainWiki(raw).replace(/\{\{\s*Damage\s*\|\s*([^|}]+)\s*\|\s*([^|}]+)(?:\|[^}]*)?\}\}/gi,
      (_, component, amount) => `${amount} ${/ballistic/i.test(component) ? 'direct' : component.trim()}`)
      .replace(/<[^>]*>/g, '').trim();
    // Do not choose an endpoint or misread thousands as separate damage values.
    if (/\d\s*[-–/,]\s*\d/.test(line)) continue;
    const prefix = line.split(/\d/)[0];
    const label = prefix.match(/\b(uncharged|fully charged|charged)\b/i)?.[1]?.toLowerCase();
    if (label) state = label === 'uncharged' ? 'uncharged' : 'charged';
    for (const match of line.matchAll(/(\d+(?:\.\d+)?)([^\d]*)/g)) {
      const labels = [...match[2].matchAll(/\b(uncharged|fully charged|charged)\b/gi)];
      if (labels.length > 1) continue;
      if (labels.length) state = labels[0][1].toLowerCase() === 'uncharged' ? 'uncharged' : 'charged';
      const components = [...new Set([...match[2].matchAll(/\b(bolt|direct|explosion|explosive)\b/gi)].map(m => /bolt|direct/i.test(m[1]) ? 'direct' : 'splash'))];
      if (!state || components.length !== 1) continue;
      const entry = result.get(state) ?? { state, direct: null, splash: null, evidence: [] };
      const field = components[0];
      const damage = number(Number(match[1]));
      if (entry[field] !== null && entry[field] !== damage) throw new Error(`Conflicting infobox charge damage: ${state}/${field}`);
      entry[field] = damage;
      if (!entry.evidence.includes(raw.trim())) entry.evidence.push(raw.trim());
      result.set(state, entry);
    }
  }
  return ['uncharged', 'charged'].flatMap(state => result.has(state) ? [result.get(state)] : []);
}

function stats(attack, weapon, type) {
  const delivery = attack?.type === 'damage' && type === 'melee' ? 'melee' : attack?.type ?? null;
  const node = data[attack?.type]?.[attack?.name];
  const directDamage = attack?.type === 'explosion' ? null : attack?.type === 'damage' ? node : data.damage[node?.damage_id];
  const explosion = attack?.type === 'explosion' ? node : data.explosion[node?.explode_on_impact_id];
  const splashDamage = data.damage[explosion?.damage_id];
  const effectDamage = directDamage ?? splashDamage;
  const continuousBeam = delivery === 'beam' && weapon.beam_fire_rate === 60;
  return {
    direct: number(directDamage?.dmg), durable: number(directDamage?.dmg2), ap: number(directDamage?.ap1), apAll: apAll(directDamage),
    splash: number(splashDamage?.dmg), splashDurable: number(splashDamage?.dmg2), splashAp: number(splashDamage?.ap1), splashApAll: apAll(splashDamage),
    radius: number(explosion?.r2), innerRadius: number(explosion?.r1), pellets: number(node?.pellets),
    shrapnelCount: number(explosion?.shrapnel_count),
    demolition: number(effectDamage?.demo), stun: number(effectDamage?.stun), push: number(effectDamage?.push),
    delivery, element: element(effectDamage), statuses: effectDamage?.statuses ?? [],
    splashElement: element(splashDamage), splashStatuses: splashDamage?.statuses ?? [],
    damageKind: continuousBeam ? 'dps' : delivery === 'beam' || delivery === 'damage' && type !== 'melee' ? null : attack ? 'per-hit' : null,
    unit: continuousBeam ? '빔 1초' : ({ projectile: '탄체·펠릿 1개', spray: '분사 입자 1개', arc: '전격 1회', explosion: '폭발 1회', melee: '타격 1회', beam: '빔 원본 피해값', damage: '피해 항목 1회·시간 단위 미확인' }[delivery] ?? null),
  };
}

function expand(attacks, owner, seen = new Set()) {
  return attacks.flatMap(attack => {
    if (attack.type !== 'weapons') return [{ attack, owner }];
    if (seen.has(attack.name)) throw new Error(`Cyclic weapon reference: ${attack.name}`);
    const nested = data.weapons[attack.name];
    if (!nested) return [{ attack, owner }];
    return expand(nested.attacks ?? [], nested, new Set([...seen, attack.name]));
  });
}

const usedIds = new Set();
const weapons = Object.entries(roster).flatMap(([categoryName, category]) =>
  [...categories[categoryName]].sort((a, b) => a.title < b.title ? -1 : a.title > b.title ? 1 : 0).map(member => {
    const dataKey = aliases[member.title] ?? keys.get(normalize(member.title)) ?? null;
    const weapon = data.weapons[dataKey] ?? {};
    const codeMatch = member.title.match(/^(\S*\d\S*)\s+(.+)$/);
    const code = codeMatch?.[1] ?? null;
    const baseId = slug(codeMatch?.[2] ?? member.title);
    let id = baseId;
    if (usedIds.has(id)) id = `${baseId}-${slug(code ?? category)}`;
    if (usedIds.has(id)) throw new Error(`Duplicate id: ${id}`);
    usedIds.add(id);
    const types = subtypeNames.filter(name => categories[name].some(item => item.title === member.title));
    if (types.length > 1) throw new Error(`Ambiguous subtype: ${member.title}`);
    const page = pagesSource.pages[member.title];
    if (!page) throw new Error(`Missing page source: ${member.title}`);
    const infobox = parseInfobox(page.wikitext);
    const infoboxType = plainWiki(infobox.weapon_type);
    const type = infoboxType ? slug(infoboxType) : types.length ? slug(types[0]) : null;
    const extras = infoboxExtras(infobox, { type, roundType: weapon.roundtype });
    const pageRef = field => ({ file: 'db/source/wiki_pages.json', title: member.title, field: `infobox.${field}`, revision: page.revision, source: page.source, retrievedAt: page.retrievedAt });
    const fuse = category === 'throwable' ? seconds(infobox.fuse) : null;
    const reloading = reloadTimes(infobox);
    const reloadField = reloading.reload?.field ?? 'reload_time';
    const reload = reloading.reload?.value ?? null;
    const reloadTactical = reloading.tactical?.value ?? null;
    const korean = koreanMatches.names[code];
    const manualName = korean ? null : manualKoreanNames[code];
    const name = korean?.name ?? manualName?.name ?? null;
    const attacks = weapon.attacks ?? [];
    const primaryAttack = attacks.find(attack => attack.level === 1) ?? attacks[0];
    const notes = [];
    for (const repair of referenceRepairs.filter(item => item.weapon === dataKey)) notes.push(`원본 참조 보정: 공격 참조 ${repair.reference}에 해당하는 기록이 없어, 띄어쓰기·밑줄만 다른 기록 ${repair.record}에 연결했습니다.`);
    if (korean?.matchedCode) notes.push(`한국어 이름 보정: 위키 제목 ${code}와 데이터 키 ${dataKey}의 제식 번호를 함께 대조하여 나무위키 ${korean.evidence}에 연결했습니다.`);
    if (extras.heatCapacity.raw && extras.heatCapacity.seconds === null) notes.push(`열 용량 단위 미확인: capacity=${extras.heatCapacity.raw}. 초·발수를 추정하지 않고 raw에 보존합니다.`);
    if (code === 'ARC-12' && /five arcs with damage of 50/.test(page.wikitext)) notes.push('인포박스 전격 피해 250은 본문에 명시된 50 피해 전격 5개의 합계입니다. DB는 전격당 피해를 유지합니다.');
    if (page.error) notes.push(`위키 페이지 수집 실패: ${page.error}. ${page.wikitext ? '이전 원문을 사용합니다.' : '인포박스 값은 미확인입니다.'}`);
    if (types.length && infoboxType && slug(types[0]) !== type) notes.push(`유형 불일치: 분류=${slug(types[0])}, 인포박스 weapon_type=${infoboxType}. 인포박스 값을 우선합니다.`);
    if (!types.length && infoboxType) notes.push(`하위 분류가 없어 위키 인포박스 weapon_type=${infoboxType}을 사용했습니다.`);
    if (category === 'throwable' && fuse === null) notes.push(`신관 시간 미확인 또는 비시간식: 인포박스 fuse=${infobox.fuse || '(필드 또는 원문 없음)'}. 숫자를 추정하지 않습니다.`);
    if (reload === null) notes.push(`재장전 시간 미확인: 인포박스 ${reloadField}=${infobox[reloadField] || '(필드 또는 원문 없음)'}.`);
    if (reloadTactical === null) notes.push(`전술 재장전 시간 미확인: 인포박스 tac_reload_time=${infobox.tac_reload_time || '(필드 없음 또는 비어 있음)'}. 낱발 첫 삽입 시간은 전체 전술 재장전 시간으로 대체하지 않습니다.`);
    if (reloading.reload && reloadField !== 'reload_time') notes.push(`재장전 출처: reload_time=${infobox.reload_time || '(필드 없음)'}. 명시된 초 단위 ${reloadField}=${infobox[reloadField]}를 사용합니다.`);
    for (const field of ['reload_time', 'tac_reload_time']) {
      const detail = reloading.details.find(item => item.field === field);
      const selection = field === 'tac_reload_time' ? reloading.tactical : reloading.reload?.field === field ? reloading.reload : null;
      if (detail && (detail.values.length > 1 || detail.values.some(v => v.label || v.seconds === null))) notes.push(`재장전 세부 표기: ${field}=${detail.raw}. ${selection ? `대표값=${selection.value}s${selection.label ? ` (${selection.label})` : ''}; 그 외 구성별 수치는 reloadDetails에 보존합니다.` : '단위 또는 단일 대표값이 명확하지 않아 이 필드의 수치를 선택하지 않습니다. 원문은 reloadDetails에 보존합니다.'}`);
    }
    if (name === null) notes.push('한국어 이름은 db/source/korean_names.json에서 제식 번호와 연결된 출처를 확인하지 못해 null입니다.');
    if (!dataKey) notes.push('데이터마이닝 무기 항목이 없어 수치는 미확인입니다.');
    if (aliases[member.title]) notes.push('위키 제목은 CQC-73이나 데이터 키는 CQC-72 ENTRENCHMENT TOOL입니다. 명시적 별칭으로 연결했습니다.');
    if (!type) notes.push('제공된 하위 분류에 속하지 않아 type은 null입니다.');
    if (!attacks.length) notes.push('원본 공격 목록이 비어 있어 피해 수치는 null입니다. 방어 기능을 피해로 환산하지 않습니다.');
    const expanded = expand(attacks, weapon);
    const impactExplosions = new Set(expanded.map(({ attack }) => data[attack.type]?.[attack.name]?.explode_on_impact_id).filter(Boolean));
    const modes = expanded.filter(({ attack }) => attack.type !== 'status' && !(attack.type === 'explosion' && impactExplosions.has(attack.name)));
    const variants = [];
    const variantIds = new Set();
    const addVariant = (attack, owner, extra = {}) => {
      // Fragments thrown by an explosion reuse another weapon's projectile key (e.g. AC-8_P2), so label them by role.
      const burst = attack.type === 'projectile' ? data.explosion[attack.parent] : null;
      if (burst?.shrapnel === attack.name) extra = { name: `파편 · 폭발 1회당 ${burst.shrapnel_count}개 (${attack.name})`, unit: '파편 1개', ...extra };
      const base = burst?.shrapnel === attack.name ? 'shrapnel' : slug(`${attack.type}-${attack.name}`);
      let variantId = base;
      for (let index = 2; variantIds.has(variantId); index++) variantId = `${base}-${index}`;
      variantIds.add(variantId);
      variants.push({ id: variantId, name: attack.name, ...stats(attack, owner, type), attack: { ...attack }, ...extra });
    };
    if (modes.length > 1 || weapon.charge) {
      for (const { attack, owner } of modes) addVariant(attack, owner);
      notes.push('variants는 원본 공격·부가 피해별 수치입니다. 하위 level은 충전 단계가 아닌 연결 깊이이며, 동시 명중이나 선택 가능한 모드라고 단정하지 않습니다.');
    }
    if (weapon.charge) {
      for (const [index, stage] of (weapon.charge.charge ?? []).entries()) {
        const attack = attacks.find(item => item.type === 'projectile' && item.name === stage.proj);
        addVariant(attack ?? { type: 'projectile', name: stage.proj }, weapon, {
          id: `charge-stage-${index + 1}`, name: `충전 단계 ${index + 1} · ${stage.proj}`,
          chargeTime: number(stage.charge_time),
          notes: [attack ? '연결된 탄체 원본값입니다. 충전 배율의 적용 범위·중복 적용 여부는 미확인입니다.' : '충전 단계의 탄체 키를 해석할 수 없어 피해 수치는 null입니다.'],
        });
      }
      notes.push('charge의 단계·배율을 원문 보존했습니다. DEFAULT 연결과 배율 적용 규칙이 없어 유효 충전 피해를 추정하지 않습니다.');
    }
    const wikiCharge = chargeDamage(infobox.damage);
    for (const entry of wikiCharge) variants.push({
      id: `wiki-${entry.state}`, name: entry.state === 'uncharged' ? '비충전 · 위키 인포박스' : '충전 · 위키 인포박스',
      ...stats(null, {}, null), direct: entry.direct, splash: entry.splash,
      damageKind: 'per-hit', unit: '인포박스에 명시된 탄체·폭발 1회', attack: null,
      chargeState: entry.state, source: pageRef('damage'), evidence: entry.evidence,
      notes: ['위키 페이지 인포박스 damage에 명시된 값입니다. 원본 충전 단계에 배율을 곱하지 않았으며, 내구 피해·관통력은 추정하지 않습니다.'],
    });
    if ((weapon.charge || /\bcharged\b/i.test(infobox.damage ?? '')) && wikiCharge.length !== 2) notes.push(`인포박스 충전 피해 공백: damage=${infobox.damage || '(필드 또는 원문 없음)'}. 상태별 수치가 명시되지 않았습니다. 단일 값이나 범위의 양 끝을 비충전/충전 피해로 배정하거나 배율로 추정하지 않습니다.`);
    if (attacks.some(attack => attack.type === 'weapons')) notes.push('하부 부착 무기는 variants로 전개하고 원본 연결은 attacks 및 linkedAttacks에 보존했습니다.');
    if (expanded.some(({ attack }) => attack.type === 'spray')) notes.push('분사는 입자당 원본 피해입니다. 초당 입자 명중 수와 화상 지속 피해는 합산하지 않습니다.');
    if (expanded.some(({ attack }) => attack.type === 'beam')) notes.push(weapon.beam_fire_rate === 60 ? '연속 빔 피해를 초당 값으로 해석했습니다. 노출 시간·화상 피해는 합산하지 않습니다.' : '펄스 빔의 원본 피해입니다. beam_fire_rate·beams는 초당 피해로 환산하지 않고 별도 보존했습니다.');
    if (expanded.some(({ attack }) => attack.type === 'arc')) notes.push('전격 1회 기준입니다. 다중 방출·연쇄 대상의 피해를 합산하지 않습니다.');
    if (expanded.some(({ attack }) => attack.type === 'damage') && type !== 'melee') notes.push('damage 직접 참조는 원본 피해만 보존하며 시간 단위·반복 횟수는 미확인입니다.');
    const unresolved = expanded.filter(({ attack }) => attack.type !== 'status' && !data[attack.type]?.[attack.name]);
    if (unresolved.length) notes.push(`공격 참조 미확인: ${unresolved.map(({ attack }) => `${attack.type}/${attack.name}`).join(', ')}.`);
    const missingDamage = expanded.filter(({ attack }) => {
      const node = data[attack.type]?.[attack.name];
      return node && attack.type !== 'damage' && !data.damage[node.damage_id];
    });
    if (missingDamage.length) notes.push(`피해 레코드 연결이 비어 있거나 누락되었습니다: ${missingDamage.map(({ attack }) => attack.name).join(', ')}. 피해를 0으로 추정하지 않습니다.`);
    if (expanded.some(({ attack }) => data.explosion[attack.parent]?.shrapnel === attack.name)) notes.push('파편 variant는 파편 1개의 피해입니다. 폭발 1회당 개수는 shrapnelCount이며, 실제로 맞는 파편 수는 거리·각도에 따라 달라 합산하지 않습니다.');
    if (weapon.roundtype === 'rounds') notes.push('낱발 예비탄은 spareRounds에 보존하며 spareMags로 환산하지 않습니다.');
    const result = {
      id, category, type, en: member.title, code, name,
      nameSource: name === null ? null : korean ? { file: 'db/source/korean_names.json', code, ...korean } : { file: 'scripts/build-weapons.mjs', code, manual: true, reason: manualName.reason },
      fieldSources: { type: infoboxType ? pageRef('weapon_type') : types.length ? { file: 'db/source/wiki_categories.json', category: types[0] } : null, fuse: fuse === null ? null : pageRef('fuse'), reload: reload === null ? null : pageRef(reloadField), reloadTactical: reloadTactical === null ? null : pageRef('tac_reload_time'),
        dot: extras.dot.raw === null ? null : pageRef('damage'), heatCapacity: extras.heatCapacity.raw === null ? null : pageRef('capacity'),
        swingsPerMinute: extras.swingsPerMinute === null ? null : pageRef('fire_rate'), rpmModes: extras.rpmModes.length ? pageRef('fire_rate') : null,
        rpm: weapon.rpm == null && extras.rpm !== null ? pageRef('fire_rate') : null,
        spareRounds: weapon.rounds == null && extras.spareRounds !== null ? pageRef('spare_rounds') : null },
      source: `https://helldivers.wiki.gg/wiki/${encodeURIComponent(member.title.replaceAll(' ', '_'))}`,
      sourceRevision: number(member.revision), dataKey,
      ...stats(primaryAttack, weapon, type),
      magazine: number(weapon.cap), spareMags: number(weapon.mags), rpm: number(weapon.rpm) ?? extras.rpm,
      dot: extras.dot, heatCapacity: extras.heatCapacity, swingsPerMinute: extras.swingsPerMinute, rpmModes: extras.rpmModes,
      infoboxRaw: Object.fromEntries(['damage', 'penetration', 'capacity', 'fire_rate', 'spare_mags', 'spare_rounds', 'radius'].map(field => [field, infobox[field] ?? null])),
      fireModes: weapon.fire_modes ?? [], ergonomics: number(weapon.ergonomics), charge: weapon.charge ?? null,
      fuse, reload, reloadTactical, roundType: weapon.roundtype ?? null, spareRounds: number(weapon.rounds) ?? extras.spareRounds,
      reloadDetails: reloading.details,
      beamFireRate: number(weapon.beam_fire_rate), beams: number(weapon.beams), barrels: number(weapon.barrels),
      throwableCapacity: number(weapon.max), throwableStart: number(weapon.start),
      attacks, linkedAttacks: attacks.filter(attack => attack.type === 'weapons').map(attack => ({ dataKey: attack.name, attacks: data.weapons[attack.name]?.attacks ?? [] })),
      notes, variants,
    };
    result.infoboxConflicts = infoboxDisagreements(result, infobox, data).filter(conflict => (reviewedConflicts[member.title] ?? []).some(known => JSON.stringify(known) === JSON.stringify(conflict)));
    for (const conflict of result.infoboxConflicts) notes.push(`인포박스 수치 불일치: ${conflict.field} DB=${JSON.stringify(conflict.db)}, 인포박스=${JSON.stringify(conflict.infobox)} (원문: ${conflict.raw}; 페이지 revision ${page.revision}). 최신 데이터마이닝 값을 유지합니다.`);
    return result;
  }));

const weaponsSource = {
  pages: 'db/source/wiki_pages.json', pagesAttemptedAt: pagesSource.attemptedAt,
  koreanNames: 'db/source/korean_names.json', koreanNamesRetrievedAt: koreanSource.retrievedAt,
  attacks: source.source, attacksRevision: source.revision, attacksRevisionTimestamp: source.revisionTimestamp,
  categories: categoriesSource.source, retrievedAt: source.retrievedAt.slice(0, 10), categoriesRetrievedAt: categoriesSource.retrievedAt.slice(0, 10),
};

// Compact leaf objects/arrays, expanded weapon and variant blocks; no locale or clock dependency.
function literal(value, depth = 0) {
  if (value === null) return 'null';
  if (typeof value === 'string') return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\r', '\\r').replaceAll('\n', '\\n').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')}'`;
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    if (value.every(item => item === null || typeof item !== 'object')) return `[${value.map(item => literal(item)).join(', ')}]`;
    return `[\n${value.map(item => `${'  '.repeat(depth + 1)}${literal(item, depth + 1)}`).join(',\n')},\n${'  '.repeat(depth)}]`;
  }
  const entries = Object.entries(value);
  const key = name => /^[A-Za-z_$][\w$]*$/.test(name) ? name : literal(name);
  if (entries.length <= 5 && entries.every(([, item]) => item === null || typeof item !== 'object')) return `{ ${entries.map(([name, item]) => `${key(name)}: ${literal(item)}`).join(', ')} }`;
  return `{\n${entries.map(([name, item]) => `${'  '.repeat(depth + 1)}${key(name)}: ${literal(item, depth + 1)},`).join('\n')}\n${'  '.repeat(depth)}}`;
}

const output = `// Generated by scripts/build-weapons.mjs from local db/source files. Do not edit by hand.\nexport const weaponsSource = ${literal(weaponsSource)};\n\nexport const weapons = ${literal(weapons)};\n`;
const pick = (value, fields) => Object.fromEntries(fields.map(key => [key, value[key] ?? null]));
const perHitFields = 'direct durable ap apAll splash splashDurable splashAp splashApAll radius innerRadius pellets shrapnelCount delivery unit damageKind element statuses splashElement splashStatuses'.split(' ');
const displayFields = 'id category type en name code source magazine spareMags spareRounds rpm rpmModes reload reloadTactical fireModes dot heatCapacity swingsPerMinute fuse throwableCapacity notes infoboxConflicts'.split(' ');
// Extra search words players use for a weapon. Not a name from any source.
const searchAliases = { 'exploding-crossbow': ['석궁'] };
const personalWeapons = weapons.map(weapon => ({
  ...pick(weapon, displayFields), ...(searchAliases[weapon.id] ? { aliases: searchAliases[weapon.id] } : {}), ...pick(weapon, perHitFields),
  ...playerDetails(weapon, parseInfobox(pagesSource.pages[weapon.en].wikitext)),
  ...modeDetails(weapon, data, pagesSource.pages[weapon.en].wikitext),
  ...throwChoices(weapon, pagesSource.pages[weapon.en].wikitext),
  image: parseInfobox(pagesSource.pages[weapon.en].wikitext).image?.replace(/\{\{\s*PAGENAME\s*\}\}/gi, weapon.en) || null,
  sourceRevision: pagesSource.pages[weapon.en].revision,
  variants: weapon.variants.map((variant, index) => ({ ...pick(variant, ['id', 'name', ...perHitFields]), displayName: variantDisplayName(weapon, variant, index) })),
}));
const generated = '// Generated by scripts/build-weapons.mjs from local db/source files. Do not edit by hand.\n';
const checkedAt = weaponsSource.retrievedAt;
const profiles = buildPersonalProfiles(weapons, data, pagesSource.pages, checkedAt);
const outputs = {
  'db/weapons.js': output,
  'dist/data/personal-weapons.js': `${generated}export const personalWeaponsCheckedAt = ${literal(checkedAt)};\nexport const personalWeaponsSource = ${literal(weaponsSource)};\nexport const personalWeapons = ${literal(personalWeapons)};\n`,
  'dist/data/personal-profiles.js': `${generated}export const personalProfiles = ${literal(profiles.personalProfiles)};\nexport const personalUnsupported = ${literal(profiles.personalUnsupported)};\n`,
};
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
if (process.argv.includes('--stdout')) {
  const target = process.argv[process.argv.indexOf('--stdout') + 1] || 'db/weapons.js';
  if (!Object.hasOwn(outputs, target)) throw new Error(`Unknown generated output: ${target}`);
  // No process.exit here: on Linux, stdout to a pipe is asynchronous and
  // exiting early truncates large outputs. Let the process end naturally.
  process.stdout.write(outputs[target]);
} else {
for (const [path, content] of Object.entries(outputs)) await writeFile(new URL(path, root), content, 'utf8');
console.log(`Generated ${Object.keys(outputs).join(', ')} (local sources only).`);
console.log(`Weapons: ${weapons.length} (primary: ${weapons.filter(w => w.category === 'primary').length}, secondary: ${weapons.filter(w => w.category === 'secondary').length}, throwable: ${weapons.filter(w => w.category === 'throwable').length})`);
console.log(`Attack revision: ${weaponsSource.attacksRevision}; retrieved: ${weaponsSource.retrievedAt}`);
}
}

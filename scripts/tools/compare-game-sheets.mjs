// Compares the site's current data (taken from wiki pages) with the game data sheets in
// db/source/game_sheets/ (import them first with scripts/tools/import-game-sheets.mjs) and writes
// db/source/game_sheets/diff.md: every value where the game differs from the site, grouped by screen.
// It changes nothing in the site. Use the report to decide which values to switch to the game's.
// Compared: stratagem input codes and cooldowns, armor weight and passive, passive effect values,
// weapon magazines, enemy main health/armor/durable and per-zone health/armor/durable/share to main.
// Usage: node scripts/tools/compare-game-sheets.mjs
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const sheet = async name => JSON.parse(await readFile(new URL(`db/source/game_sheets/${name}`, root), 'utf8'));
const site = async name => import(new URL(`dist/data/${name}`, root));
const [armorSheet, stratSheet, weaponSheet, enemySheet] = await Promise.all(['armor.json', 'stratagems.json', 'weapons.json', 'enemies.json'].map(sheet));
const lines = [`# 게임 데이터 시트와 사이트 값 비교`, '', `게임 빌드 ${armorSheet.game_build}. \`node scripts/tools/compare-game-sheets.mjs\` 가 만듦(사이트는 바꾸지 않음).`, ''];
const summary = [];
const low = s => String(s ?? '').trim().toLowerCase();
const pct = x => (x == null ? null : Math.round(x * 100));

// --- 스트라타젬: 호출 코드, 재사용 대기
const ARROW = { up: '↑', right: '→', down: '↓', left: '←' };
const gameStrat = new Map();
for (const s of stratSheet.스트라타젬) if (s.en) (gameStrat.get(low(s.en)) ?? gameStrat.set(low(s.en), []).get(low(s.en))).push(s);
const { stratagemStats } = await site('stratagem-stats.js');
const siteStrats = [];
for (const f of ['data-offense.js', 'data-support.js', 'data-equipment.js', 'data-mission.js']) {
  for (const list of Object.values(await site(f))) if (Array.isArray(list)) siteStrats.push(...list.filter(x => x && x.input && x.en));
}
const stratRows = [];
let stratSame = 0, stratMissing = 0;
for (const s of siteStrats) {
  // 사이트 en 은 'AC-8 Autocannon' 꼴, 게임 en 은 'Autocannon' 꼴일 수 있어 둘 다 봄
  const cands = gameStrat.get(low(s.en)) ?? gameStrat.get(low(s.en).replace(/^[a-z0-9/-]+ /, '')) ?? [];
  if (!cands.length) { stratMissing++; continue; }
  const cd = stratagemStats[s.id]?.cooldown ?? s.cooldown ?? null;
  const good = cands.find(g => g.코드_en.map(a => ARROW[a]).join('') === s.input && (cd == null || Math.abs(g.재사용_대기_초 - cd) < 0.5));
  if (good) { stratSame++; continue; }
  const g = cands[0];
  stratRows.push(`| ${s.name} (${s.en}) | ${s.input} / ${cd ?? '-'}초 | ${cands.map(c => `${c.코드_en.map(a => ARROW[a]).join('')} / ${c.재사용_대기_초}초`).join(', ')} |`);
}
lines.push('## 스트라타젬 (호출 코드 / 재사용 대기)', '', `같음 ${stratSame}, 다름 ${stratRows.length}, 게임 이름과 짝 없음 ${stratMissing}`, '');
if (stratRows.length) lines.push('| 사이트 | 사이트 값 | 게임 값 |', '|---|---|---|', ...stratRows, '');
summary.push(`스트라타젬 같음 ${stratSame} 다름 ${stratRows.length}`);

// --- 방어구: 무게, 패시브 / 패시브 효과
const { armors, armorPassives } = await site('armor.js');
const WEIGHT = { light: '경량', medium: '중간', heavy: '중량' };
const gameArmor = new Map(armorSheet.방어구.filter(a => a.종류 === '몸통' && a.대표).map(a => [low(a.en), a]));
const passiveEn = new Map(armorPassives.map(p => [p.id, p.en]));
const armorRows = [];
let armorSame = 0, armorMissing = 0;
for (const a of armors) {
  const g = gameArmor.get(low(a.en));
  if (!g) { armorMissing++; continue; }
  const want = [WEIGHT[a.weight], low(passiveEn.get(a.passive))];
  const got = [g.무게, low(g.패시브_en)];
  if (want[0] === got[0] && want[1] === got[1]) { armorSame++; continue; }
  armorRows.push(`| ${a.name} (${a.en}) | ${want[0]} / ${passiveEn.get(a.passive) ?? '-'} | ${got[0]} / ${g.패시브_en || '-'} |`);
}
lines.push('## 방어구 (무게 / 패시브)', '', `같음 ${armorSame}, 다름 ${armorRows.length}, 게임 이름과 짝 없음 ${armorMissing}`, '');
if (armorRows.length) lines.push('| 사이트 | 사이트 값 | 게임 값 |', '|---|---|---|', ...armorRows, '');
summary.push(`방어구 같음 ${armorSame} 다름 ${armorRows.length}`);
const gamePassive = new Map(armorSheet.패시브.map(p => [low(p.en), p]));
const passiveRows = [];
for (const p of armorPassives) {
  const g = gamePassive.get(low(p.en));
  if (!g) { passiveRows.push(`| ${p.name} (${p.en}) | 게임에 같은 이름 없음 | |`); continue; }
  const siteText = p.effects.map(e => e.name).join(' / ');
  const gameText = g.효과.map(e => e.ko).join(' / ');
  if (siteText !== gameText) passiveRows.push(`| ${p.name} | ${siteText} | ${gameText} |`);
}
lines.push('## 패시브 효과 (사이트 문장 / 게임 문장, 게임은 #BONUS 에 게임 수치를 넣은 것)', '', `다름 ${passiveRows.length} / ${armorPassives.length}`, '');
if (passiveRows.length) lines.push('| 패시브 | 사이트 | 게임 |', '|---|---|---|', ...passiveRows, '');
summary.push(`패시브 문장 다름 ${passiveRows.length}/${armorPassives.length}`);

// --- 무기: 탄창
const { personalWeapons } = await site('personal-weapons.js');
const { support } = await site('data-support.js');
const gameWeapon = new Map();
for (const w of weaponSheet.무기) {
  if (!w.경로.startsWith('content/fac_helldivers/')) continue;
  const full = low(w.en.toUpperCase().startsWith(w.코드.toUpperCase()) ? w.en : `${w.코드} ${w.en}`);
  if (!gameWeapon.has(full)) gameWeapon.set(full, w);
}
const weaponRows = [];
let weaponSame = 0, weaponMissing = 0, weaponNoMag = 0;
for (const w of [...personalWeapons, ...support]) {
  const g = gameWeapon.get(low(w.en));
  if (!g) { weaponMissing++; continue; }
  if (g.탄창 == null) { weaponNoMag++; continue; } // 탄 단위 장전, 열 방식 등(README '미확인')
  const same = g.탄창 === w.magazine && (w.spareMags == null || g.최대_탄창_수 === w.spareMags + 1 || g.최대_탄창_수 === w.spareMags);
  if (same) { weaponSame++; continue; }
  weaponRows.push(`| ${w.name} (${w.en}) | 탄창 ${w.magazine ?? '-'}, 예비 ${w.spareMags ?? '-'} | 탄창 ${g.탄창}, 시작 ${g.시작_탄창_수}, 최대 ${g.최대_탄창_수} (기본 부착물: ${g.기본_부착물.join(', ') || '-'}) |`);
}
lines.push('## 무기 탄창', '', `같음 ${weaponSame}, 다름 ${weaponRows.length}, 게임 이름과 짝 없음 ${weaponMissing}, 게임 탄창 칸 미확인 ${weaponNoMag}`, '', '게임의 `최대_탄창_수` 는 들고 있을 수 있는 탄창 수(장전된 탄창 포함으로 보임). 사이트 `spareMags` 와 1 차이는 같음으로 셈.', '');
if (weaponRows.length) lines.push('| 사이트 | 사이트 값 | 게임 값 |', '|---|---|---|', ...weaponRows, '');
summary.push(`무기 탄창 같음 ${weaponSame} 다름 ${weaponRows.length}`);

// --- 적: 본체, 부위
const enemyModules = await Promise.all(['combat-data.js', 'combat-enemies-expanded.js', 'combat-enemies-additional.js'].map(site));
const siteEnemies = [];
for (const m of enemyModules) for (const v of Object.values(m)) if (Array.isArray(v) && v[0]?.main && v[0]?.parts) siteEnemies.push(...v);
const gameEnemy = new Map();
for (const e of enemySheet.적) (gameEnemy.get(e.ko) ?? gameEnemy.set(e.ko, []).get(e.ko)).push(e);
const enemyRows = [], partRows = [];
let enemySame = 0, enemyMissing = 0, partSame = 0, partAll = 0;
for (const s of siteEnemies) {
  const cands = gameEnemy.get(s.name);
  if (!cands) { enemyMissing++; continue; }
  const m = s.main;
  const g = cands.find(e => e.체력 === m.hp && e.기본_부위.장갑 === m.armor && pct(e.기본_부위.내구) === m.durability);
  if (g) enemySame++;
  else enemyRows.push(`| ${s.name} | ${m.hp} / ${m.armor} / ${m.durability}% | ${cands.map(e => `${e.체력} / ${e.기본_부위.장갑} / ${pct(e.기본_부위.내구)}%`).join(', ')} |`);
  const ref = g ?? cands[0];
  for (const p of s.parts) {
    if (p.copies) continue; // '양쪽' 같은 합산 행은 같은 부위의 다른 표시
    partAll++;
    const zs = ref.부위.filter(z => z.체력 === p.hp && z.장갑 === p.armor && pct(z.내구) === p.durability);
    if (!zs.length) { partRows.push(`| ${s.name} | ${p.name} | ${p.hp} / ${p.armor} / ${p.durability}% / 전달 ${p.toMain}% | (체력, 장갑, 내구가 같은 부위 없음) |`); continue; }
    if (zs.some(z => pct(z.본체_전달) === p.toMain)) { partSame++; continue; }
    partRows.push(`| ${s.name} | ${p.name} | ${p.hp} / ${p.armor} / ${p.durability}% / 전달 ${p.toMain}% | 전달 ${[...new Set(zs.map(z => pct(z.본체_전달)))].join(' 또는 ')}% (${zs.map(z => z.이름).join(', ')}) |`);
  }
}
lines.push('## 적 본체 (체력 / 장갑 / 내구)', '', `같음 ${enemySame}, 다름 ${enemyRows.length}, 게임 이름과 짝 없음 ${enemyMissing}(변종 등 게임 백과사전 이름이 다른 것)`, '');
if (enemyRows.length) lines.push('| 적 | 사이트 | 게임 |', '|---|---|---|', ...enemyRows, '');
lines.push('## 적 부위 (체력 / 장갑 / 내구 / 본체 전달)', '', `같음 ${partSame} / ${partAll}. 게임 부위 이름은 해시로만 풀린 것이 많아 값으로 짝을 지음`, '');
if (partRows.length) lines.push('| 적 | 부위 | 사이트 | 게임 |', '|---|---|---|---|', ...partRows, '');
summary.push(`적 본체 같음 ${enemySame} 다름 ${enemyRows.length}, 부위 같음 ${partSame}/${partAll}`);

await writeFile(new URL('db/source/game_sheets/diff.md', root), lines.join('\n') + '\n');
console.log(summary.join('\n') + '\n-> db/source/game_sheets/diff.md');

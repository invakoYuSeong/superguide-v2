// "Detailed stats" block of the gear and stratagem detail sheets: the datamine flight values of a
// weapon's projectiles, how much damage is left with range and how far the shot drops
// (dist/core/ballistics.js). Charts follow the site's single-series style: one axis each, a
// crosshair readout on hover, and the same numbers in the table under them.
import { html } from './dom.js';
import { L } from '../core/i18n.js';
import { num } from '../core/explain.js';
import { projectileBallistics } from '../data/ballistics.js';
import { dragOf, falloffAt, distanceAt, trajectory } from '../core/ballistics.js';

const MAX = 200;
const MARKS = [25, 50, 100, 150, 200];
const W = 320, H = 150, PAD = { l: 52, r: 26, t: 14, b: 30 };
const round = (value, step) => Math.round(value / step) * step;

// One line over 0-200 m. `top`/`bottom` are the values at the top and bottom of the plot.
function chart(title, points, { top, bottom, ticks, label }) {
  const px = x => PAD.l + (x / MAX) * (W - PAD.l - PAD.r);
  const py = y => PAD.t + ((top - y) / (top - bottom)) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`).join('');
  const data = points.filter(p => p.x % 2 === 0).map(p => `${p.x},${+p.y.toFixed(3)}`).join(';');
  return html`<figure class="ballistic-chart"><figcaption>${title}</figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}" data-points="${data}" data-label="${label}" data-top="${top}" data-bottom="${bottom}">
      ${ticks.map(t => html`<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${py(t.value)}" y2="${py(t.value)}" class="grid"/><text x="${PAD.l - 7}" y="${py(t.value) + 5}" text-anchor="end">${t.text}</text>`)}
      ${[0, 50, 100, 150, 200].map(x => html`<text x="${px(x)}" y="${H - 5}" text-anchor="middle">${x}m</text>`)}
      <path d="${path}" class="line"/>
      <g class="hover" visibility="hidden"><line class="cross" y1="${PAD.t}" y2="${H - PAD.b}"/><circle r="4"/><text class="readout"/></g>
    </svg></figure>`;
}

// A rocket-propelled shot keeps its speed: no drag in the damage and drop math (its datamine drag
// is still listed).
function recordBlock(label, record, propelled) {
  const b = propelled ? { ...record, drag: 0 } : record;
  const drag = dragOf(b);
  const { points, endX } = trajectory(b, MAX);
  const at = x => points.find(p => p.x === x);
  const cell = (name, value, unit, caption) => html`<div><dt>${name}</dt><dd>${value}${unit ? html`<small>${unit}</small>` : ''}</dd>${caption ? html`<div class="caption">${caption}</div>` : ''}</div>`;
  const ap = b.ap?.some(v => v != null) ? `AP ${b.ap.map(v => num(v)).join(' / ')}` : '—';
  const d75 = distanceAt(b, 0.75), d50 = distanceAt(b, 0.5);
  const fmtDistance = x => (x == null ? '—' : x >= 1000 ? `${num(round(x / 1000, 0.1))}km` : `${num(round(x, 1))}m`);
  const damage = points.map(p => ({ x: p.x, y: falloffAt(b, p.x) * 100 }));
  const drop = points.map(p => ({ x: p.x, y: p.drop }));
  const maxDrop = Math.max(0.1, ...drop.map(p => p.y));
  const dropTop = maxDrop < 1 ? Math.ceil(maxDrop * 10) / 10 : maxDrop < 10 ? Math.ceil(maxDrop) : Math.ceil(maxDrop / 5) * 5;
  const dropText = y => (dropTop < 2 ? `${num(Math.round(y * 100))}cm` : `${num(round(y, 0.1))}m`);
  return html`<div class="ballistic">
    ${label ? html`<h4>${label}</h4>` : ''}
    <dl class="detail-grid">
      ${cell(L('탄속', 'Muzzle velocity'), num(b.velocity), 'm/s')}
      ${cell(L('질량', 'Mass'), num(b.mass), 'g')}
      ${cell(L('구경', 'Caliber'), num(b.caliber), 'mm')}
      ${cell(L('항력계수', 'Drag coefficient'), num(record.drag), '', propelled ? L('로켓 추진으로 속도가 유지되어 계산에서 뺌', 'Left out: rocket propulsion keeps its speed') : L('클수록 빨리 느려짐', 'Higher slows it sooner'))}
      ${cell(L('중력 배율', 'Gravity multiplier'), num(b.gravity), '×', b.gravity ? L('클수록 많이 떨어짐', 'Higher drops more') : L('떨어지지 않고 곧게 날아감', 'Flies straight, no drop'))}
      ${cell(L('탄 수명', 'Lifetime'), b.lifetime ? num(b.lifetime) : L('제한 없음', 'No limit'), b.lifetime ? L('초', 's') : '', endX != null ? L(`약 ${num(Math.round(endX))}m에서 사라짐`, `Gone at about ${num(Math.round(endX))} m`) : '')}
      ${cell(L('각도별 관통', 'Penetration by angle'), ap, '', L('25° 미만 · 26~60° · 61~80° · 81~90°', 'Under 25° · 26-60° · 61-80° · 81-90°'))}
      ${cell(L('피해 75% · 50% 거리', 'Damage at 75% · 50%'), drag ? `${fmtDistance(d75)} · ${fmtDistance(d50)}` : L('줄지 않음', 'No falloff'), '', drag ? L('위키 공식(중력 무시)', 'Wiki formula (no gravity)') : propelled ? L('로켓 추진이라 거리로 줄지 않음', 'Rocket-propelled, so no falloff') : L('항력이 없어 거리로 줄지 않음', 'No drag, so no falloff'))}
    </dl>
    <div class="ballistic-charts">
      ${chart(L('거리별 탄 피해', 'Shot damage by distance'), damage, { top: 100, bottom: 25, label: '%', ticks: [100, 75, 50, 25].map(v => ({ value: v, text: `${v}%` })) })}
      ${chart(L('낙차', 'Drop'), drop, { top: 0, bottom: dropTop, label: dropTop < 2 ? 'cm' : 'm', ticks: [0, dropTop / 2, dropTop].map(v => ({ value: v, text: dropText(v) })) })}
    </div>
    <div class="compare-scroll" role="region" aria-label="${L('거리별 값', 'Values by distance')}" tabindex="0"><table class="compare-table ballistic-table">
      <thead><tr><th scope="col">${L('거리', 'Distance')}</th><th scope="col">${L('탄 피해', 'Shot damage')}</th><th scope="col">${L('낙차', 'Drop')}</th><th scope="col">${L('도달 시간', 'Flight time')}</th><th scope="col">${L('탄속', 'Speed')}</th></tr></thead>
      <tbody>${MARKS.map(x => { const p = at(x); return html`<tr><th scope="row">${x}m</th>
        <td>${Math.round(falloffAt(b, x) * 100)}%</td>
        <td>${p ? dropText(p.drop) : '—'}</td>
        <td>${p ? `${num(round(p.time, 0.01))}${L('초', 's')}` : '—'}</td>
        <td>${p ? `${num(Math.round(p.speed))}m/s` : '—'}</td></tr>`; })}</tbody>
    </table></div>
  </div>`;
}

// entries: [{ label, record }] in display order; repeated records are shown once.
// recoil: the weapon's recoil cells [{ label, text, unit, caption }] (user request 2026-11-24: recoil sits here,
// not in the key stats), shown first; they alone are enough to show the block.
export function ballisticsBlock(entries, recoil = []) {
  const seen = new Set();
  const list = entries.filter(e => e.record && projectileBallistics[e.record]?.velocity > 0 && !seen.has(e.record) && seen.add(e.record));
  if (!list.length && !recoil.length) return '';
  if (list.length) wireBallisticCharts();
  const recoilCell = c => html`<div><dt>${c.label}</dt><dd>${c.text}${c.unit ? html`<small>${c.unit}</small>` : ''}</dd>${c.caption ? html`<div class="caption">${c.caption}</div>` : ''}</div>`;
  // Folded by default (user decision 2026-11-23), like the customization table.
  return html`<details class="block disclosure ballistic-block"><summary><h3>${L('세부 수치', 'Detailed stats')}</h3></summary>
    ${recoil.length ? html`<div class="ballistic"><h4>${L('반동', 'Recoil')}</h4><dl class="detail-grid">${recoil.map(recoilCell)}</dl></div>` : ''}
    ${list.map(e => recordBlock(list.length > 1 || recoil.length ? e.label : '', projectileBallistics[e.record], e.propelled))}
    ${list.length ? html`<p class="faint" style="font-size:12.5px">${L('탄 피해는 중력과 궤적은 반영하지 않습니다. 낙차는 중력 9.82m/s²(helldiversotl.com이 게임 코드에서 확인한 값)에 중력 배율을 곱하고, 항력을 함께 넣어 수평으로 쐈을 때를 계산한 값입니다.', 'Shot damage leaves out gravity and the flight path. Drop uses gravity of 9.82 m/s² (the value helldiversotl.com checked in the game code) times the gravity multiplier, with drag, for a level shot.')}</p>` : ''}
  </details>`;
}

// Crosshair readout: the nearest sampled point to the pointer.
let wired = false;
export function wireBallisticCharts() {
  if (wired || typeof document === 'undefined') return;
  wired = true;
  const hide = svg => svg.querySelector('.hover')?.setAttribute('visibility', 'hidden');
  document.addEventListener('pointermove', event => {
    const svg = event.target.closest?.('.ballistic-chart svg');
    for (const other of document.querySelectorAll('.ballistic-chart svg')) if (other !== svg) hide(other);
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const vx = ((event.clientX - box.left) / box.width) * W;
    const x = Math.max(0, Math.min(MAX, ((vx - PAD.l) / (W - PAD.l - PAD.r)) * MAX));
    const points = svg.dataset.points.split(';').map(pair => pair.split(',').map(Number));
    const [px, py] = points.reduce((best, p) => (Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best), points[0]);
    const top = Number(svg.dataset.top), bottom = Number(svg.dataset.bottom), unit = svg.dataset.label;
    const sx = PAD.l + (px / MAX) * (W - PAD.l - PAD.r), sy = PAD.t + ((top - py) / (top - bottom)) * (H - PAD.t - PAD.b);
    const g = svg.querySelector('.hover');
    g.setAttribute('visibility', 'visible');
    g.querySelector('.cross').setAttribute('x1', sx); g.querySelector('.cross').setAttribute('x2', sx);
    g.querySelector('circle').setAttribute('cx', sx); g.querySelector('circle').setAttribute('cy', sy);
    const text = g.querySelector('.readout');
    const value = unit === '%' ? `${Math.round(py)}%` : unit === 'cm' ? `${Math.round(py * 100)}cm` : `${(Math.round(py * 10) / 10)}m`;
    text.textContent = `${px}m · ${value}`;
    const right = sx > W / 2;
    text.setAttribute('x', right ? sx - 6 : sx + 6); text.setAttribute('y', PAD.t + 15);
    text.setAttribute('text-anchor', right ? 'end' : 'start');
  });
}

// "Detailed stats" block of the gear and stratagem detail sheets: the datamine flight values of a
// weapon's projectiles, how much damage is left with range and how far the shot drops
// (dist/core/ballistics.js). Charts follow the site's single-series style: one axis each, a
// crosshair readout on hover, and the same numbers in the table under them.
import { html } from './dom.js';
import { detailDisclosure } from './item-detail.js';
import { L } from '../core/i18n.js';
import { num } from '../core/explain.js';
import { projectileBallistics } from '../data/ballistics.js';
import { dragOf, falloffAt, distanceAt, trajectory } from '../core/ballistics.js';

const MAX = 200;
const MARKS = [25, 50, 100, 150, 200];
const W = 320, H = 150, PAD = { l: 52, r: 26, t: 14, b: 30 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;
const round = (value, step) => Math.round(value / step) * step;

// Cache computed projectile curves so switching panel <-> fullscreen never re-integrates trajectories.
const FLIGHT_CACHE = new Map();
function computeFlight(recordId, propelled) {
  const key = propelled ? `${recordId}|p` : recordId;
  let cached = FLIGHT_CACHE.get(key);
  if (cached) return cached;
  const record = projectileBallistics[recordId];
  const b = propelled ? { ...record, drag: 0 } : record;
  const drag = dragOf(b);
  const { points, endX } = trajectory(b, MAX);
  const at = x => (points[x]?.x === x ? points[x] : points.find(p => p.x === x));
  const damage = [];
  const drop = [];
  let maxDrop = 0.1;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.drop > maxDrop) maxDrop = p.drop;
    if (p.x % 2 === 0 || i === points.length - 1) {
      damage.push({ x: p.x, y: falloffAt(b, p.x) * 100 });
      drop.push({ x: p.x, y: p.drop });
    }
  }
  const dropTop = maxDrop < 1 ? Math.ceil(maxDrop * 10) / 10 : maxDrop < 10 ? Math.ceil(maxDrop) : Math.ceil(maxDrop / 5) * 5;
  const markFalloff = MARKS.map(x => Math.round(falloffAt(b, x) * 100));
  cached = { record, b, drag, at, endX, damage, drop, dropTop, markFalloff };
  FLIGHT_CACHE.set(key, cached);
  return cached;
}

// One line over 0-200 m. `top`/`bottom` are the values at the top and bottom of the plot.
function chart(title, points, { top, bottom, ticks, label }) {
  const px = x => PAD.l + (x / MAX) * PLOT_W;
  const py = y => PAD.t + ((top - y) / (top - bottom)) * PLOT_H;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`).join('');
  const data = points.map(p => `${p.x},${+p.y.toFixed(3)}`).join(';');
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
// extra: cells appended at the end of the record's grid (the weapon's recoil, below the projectile numbers).
function recordBlock(label, recordId, propelled, extra = '') {
  const { record, b, drag, at, endX, damage, drop, dropTop, markFalloff } = computeFlight(recordId, propelled);
  const cell = (name, value, unit, caption) => html`<div><dt>${name}</dt><dd>${value}${unit ? html`<small>${unit}</small>` : ''}</dd>${caption ? html`<div class="caption">${caption}</div>` : ''}</div>`;
  const ap = b.ap?.some(v => v != null) ? `AP ${b.ap.map(v => num(v)).join(' / ')}` : '—';
  const d75 = distanceAt(b, 0.75), d50 = distanceAt(b, 0.5);
  const fmtDistance = x => (x == null ? '—' : x >= 1000 ? `${num(round(x / 1000, 0.1))}km` : `${num(round(x, 1))}m`);
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
      ${extra}
    </dl>
    <div class="ballistic-charts">
      ${chart(L('거리별 탄 피해', 'Shot damage by distance'), damage, { top: 100, bottom: 25, label: '%', ticks: [100, 75, 50, 25].map(v => ({ value: v, text: `${v}%` })) })}
      ${chart(L('낙차', 'Drop'), drop, { top: 0, bottom: dropTop, label: dropTop < 2 ? 'cm' : 'm', ticks: [0, dropTop / 2, dropTop].map(v => ({ value: v, text: dropText(v) })) })}
    </div>
    <div class="compare-scroll" role="region" aria-label="${L('거리별 값', 'Values by distance')}" tabindex="0"><table class="compare-table ballistic-table">
      <thead><tr><th scope="col">${L('거리', 'Distance')}</th><th scope="col">${L('탄 피해', 'Shot damage')}</th><th scope="col">${L('낙차', 'Drop')}</th><th scope="col">${L('도달 시간', 'Flight time')}</th><th scope="col">${L('탄속', 'Speed')}</th></tr></thead>
      <tbody>${MARKS.map((x, idx) => { const p = at(x); return html`<tr><th scope="row">${x}m</th>
        <td>${markFalloff[idx]}%</td>
        <td>${p ? dropText(p.drop) : '—'}</td>
        <td>${p ? `${num(round(p.time, 0.01))}${L('초', 's')}` : '—'}</td>
        <td>${p ? `${num(Math.round(p.speed))}m/s` : '—'}</td></tr>`; })}</tbody>
    </table></div>
  </div>`;
}

// entries: [{ label, record }] in display order; repeated records are shown once.
// recoil: the weapon's recoil cells [{ label, text, unit, caption }] (user request 2026-11-24: recoil sits here,
// not in the key stats). No sub-headings (user request 2026-11-24): with one projectile its recoil cells end the same
// grid; with several, each keeps its name and the recoil cells follow in a grid of their own; they alone are
// enough to show the block.
export function ballisticsBlock(entries, expanded = false, recoil = []) {
  const seen = new Set();
  const list = entries.filter(e => e.record && projectileBallistics[e.record]?.velocity > 0 && !seen.has(e.record) && seen.add(e.record));
  if (!list.length && !recoil.length) return '';
  if (list.length) wireBallisticCharts();
  const recoilCell = c => html`<div><dt>${c.label}</dt><dd>${c.text}${c.unit ? html`<small>${c.unit}</small>` : ''}</dd>${c.caption ? html`<div class="caption">${c.caption}</div>` : ''}</div>`;
  const content = html`${list.map(e => recordBlock(list.length > 1 ? e.label : '', e.record, e.propelled, list.length === 1 ? recoil.map(recoilCell) : ''))}
    ${recoil.length && list.length !== 1 ? html`<div class="ballistic"><dl class="detail-grid">${recoil.map(recoilCell)}</dl></div>` : ''}
    ${list.length ? html`<p class="faint" style="font-size:12.5px">${L('탄 피해는 중력과 궤적은 반영하지 않습니다. 낙차는 중력 9.82m/s²(helldiversotl.com이 게임 코드에서 확인한 값)에 중력 배율을 곱하고, 항력을 함께 넣어 수평으로 쐈을 때를 계산한 값입니다.', 'Shot damage leaves out gravity and the flight path. Drop uses gravity of 9.82 m/s² (the value helldiversotl.com checked in the game code) times the gravity multiplier, with drag, for a level shot.')}</p>` : ''}
  `;
  return detailDisclosure(L('세부 수치', 'Detailed stats'), content, { className: 'ballistic-block', expanded });
}

// Crosshair readout: cache parsed coordinates + DOM nodes per SVG and avoid global querySelectorAll on pointermove.
let wired = false;
let activeSvg = null;
const SVG_META = new WeakMap();
function svgMeta(svg) {
  let meta = SVG_META.get(svg);
  if (meta) return meta;
  const g = svg.querySelector('.hover');
  const pairs = svg.dataset.points.split(';');
  const points = new Array(pairs.length);
  for (let i = 0; i < pairs.length; i++) {
    const comma = pairs[i].indexOf(',');
    points[i] = [Number(pairs[i].slice(0, comma)), Number(pairs[i].slice(comma + 1))];
  }
  meta = {
    points,
    top: Number(svg.dataset.top),
    bottom: Number(svg.dataset.bottom),
    unit: svg.dataset.label,
    g,
    cross: g.querySelector('.cross'),
    circle: g.querySelector('circle'),
    text: g.querySelector('.readout'),
  };
  SVG_META.set(svg, meta);
  return meta;
}

export function wireBallisticCharts() {
  if (wired || typeof document === 'undefined') return;
  wired = true;
  const hide = svg => SVG_META.get(svg)?.g?.setAttribute('visibility', 'hidden');
  document.addEventListener('pointermove', event => {
    const svg = event.target.closest?.('.ballistic-chart svg') ?? null;
    if (activeSvg && activeSvg !== svg) hide(activeSvg);
    activeSvg = svg;
    if (!svg) return;
    const { points, top, bottom, unit, g, cross, circle, text } = svgMeta(svg);
    if (!points.length) return;
    const box = svg.getBoundingClientRect();
    const vx = ((event.clientX - box.left) / box.width) * W;
    const x = Math.max(0, Math.min(MAX, ((vx - PAD.l) / PLOT_W) * MAX));
    const idx = Math.min(points.length - 1, Math.max(0, Math.round(x / 2)));
    const pt = points[idx]?.[0] === Math.round(x / 2) * 2
      ? points[idx]
      : points.reduce((best, p) => (Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best), points[0]);
    const [px, py] = pt;
    const sx = PAD.l + (px / MAX) * PLOT_W;
    const sy = PAD.t + ((top - py) / (top - bottom)) * PLOT_H;
    g.setAttribute('visibility', 'visible');
    cross.setAttribute('x1', sx); cross.setAttribute('x2', sx);
    circle.setAttribute('cx', sx); circle.setAttribute('cy', sy);
    text.textContent = `${px}m · ${unit === '%' ? `${Math.round(py)}%` : unit === 'cm' ? `${Math.round(py * 100)}cm` : `${Math.round(py * 10) / 10}m`}`;
    const right = sx > W / 2;
    text.setAttribute('x', right ? sx - 6 : sx + 6);
    text.setAttribute('y', PAD.t + 15);
    text.setAttribute('text-anchor', right ? 'end' : 'start');
  });
}

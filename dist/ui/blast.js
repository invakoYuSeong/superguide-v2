// Blast radius figure shared by the stratagem and gear detail sheets.
import { num } from '../core/explain.js';
import { html } from './dom.js';
import { L } from '../core/i18n.js';

// An enemy behind the circles at the same scale, so the radius reads against something known: a Charger for
// small blasts, a Bile Titan for the rest (user decision 2026-11-20).
// Spans are side to side across the legs, from the leg-tip bones of the game models (Helldivers 2 01.007.202,
// via hd2armorinspector.com, measured 2026-11-20); pictures are the wiki's Enemy Icons cropped to the body (480 px wide).
const SCALE_ENEMIES = [
  { upTo: 6, name: L('차저', 'Charger'), span: 4.7, src: './assets/blast/charger.webp', ratio: 372 / 480 },
  { upTo: Infinity, name: L('바일 타이탄', 'Bile Titan'), span: 12, src: './assets/blast/bile-titan.webp', ratio: 375 / 480 },
];

export function blastFigure(item) {
  if (item.radius == null || item.innerRadius == null) return '';
  const outer = 56, inner = Math.max(8, outer * item.innerRadius / item.radius);
  const ref = SCALE_ENEMIES.find(enemy => item.radius <= enemy.upTo);
  const refW = ref.span * outer / item.radius, refH = refW * ref.ratio;
  return html`<div class="blast">
    <svg width="176" height="176" viewBox="0 0 132 132" role="img" aria-label="${L(`폭발 반경: 중심 ${item.innerRadius}m, 외곽 ${item.radius}m`, `Blast radius: inner ${item.innerRadius}m, outer ${item.radius}m`)}">
      <circle cx="66" cy="66" r="${outer}" fill="var(--accent-soft)" stroke="var(--accent)" stroke-opacity=".45" stroke-dasharray="3 4"/>
      <image class="blast-ref" href="${ref.src}" x="${66 - refW / 2}" y="${66 - refH / 2}" width="${refW}" height="${refH}" preserveAspectRatio="none"/>
      <circle cx="66" cy="66" r="${inner}" fill="var(--accent)" fill-opacity=".35" stroke="var(--accent)"/>
      <path d="M66 66H${66 - outer}M66 66H${66 + inner}" stroke="var(--text)" stroke-width="1.2"/>
      <circle cx="66" cy="66" r="2.5" fill="var(--text)"/>
      <g class="blast-label" aria-hidden="true">
        <text x="62" y="59" text-anchor="end">${L('외곽', 'Outer')} ${num(item.radius)}m</text>
        <text x="70" y="80">${L('중심', 'Inner')} ${num(item.innerRadius)}m</text>
      </g>
    </svg>
    <p>${L(html`<b style="color:var(--text)">중심 ${num(item.innerRadius)}m</b> 안쪽은 최대 피해입니다.<br>바깥으로 갈수록 줄어들어 <b style="color:var(--text)">${num(item.radius)}m</b>에서 사라지고, 관통력도 1 낮아집니다(최소 2).<br><span class="faint">충격파·함선 강화 효과는 제외한 반경입니다.</span><br><span class="faint">비교 대상은 '${ref.name}'(다리 폭 약 ${num(ref.span)}m)이며, 원과 같은 축척으로 뒤에 그렸습니다.</span>`,
      html`Full damage within <b style="color:var(--text)">${num(item.innerRadius)}m</b> of the center.<br>It falls off further out and is gone at <b style="color:var(--text)">${num(item.radius)}m</b>; penetration also drops by 1 (to a minimum of 2).<br><span class="faint">Radii without shockwaves or ship modules.</span><br><span class="faint">For comparison, a ${ref.name} (legs about ${num(ref.span)} m across) is drawn behind to the same scale.</span>`)}</p>
  </div>`;
}

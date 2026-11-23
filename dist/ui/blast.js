// Blast radius figure shared by the stratagem and gear detail sheets.
import { num } from '../core/explain.js';
import { html } from './dom.js';
import { L } from '../core/i18n.js';

// An enemy behind the circles at the same scale, so the radius reads against something known: a Trooper for
// the smallest blasts, where a Charger would outgrow the circle (user decision 2026-11-23), a Charger for small
// blasts, a Bile Titan for the rest (user decision 2026-11-20).
// Sizes are from the surface of the game models in their rest pose (Helldivers 2 01.007.202, via
// hd2armorinspector.com), rounded; the wiki and the developer give no sizes. Spans are side to side across the
// legs (measured 2026-11-20: Charger 5.1 m, Bile Titan 12.9 m); the Trooper is sized by its height (2.05 m,
// measured 2026-11-23), since its rest pose spreads the arms. Pictures are the wiki's Enemy Icons cropped to
// the body (480 px on the long side).
const SCALE_ENEMIES = [
  { upTo: 3, name: L('트루퍼', 'Trooper'), height: 2, src: './assets/blast/trooper.webp', ratio: 480 / 322 },
  { upTo: 6, name: L('차저', 'Charger'), span: 5, src: './assets/blast/charger.webp', ratio: 372 / 480 },
  { upTo: Infinity, name: L('바일 타이탄', 'Bile Titan'), span: 13, src: './assets/blast/bile-titan.webp', ratio: 375 / 480 },
];

export function blastFigure(item) {
  if (item.radius == null || item.innerRadius == null) return '';
  // The inner circle is to scale, like the enemy behind it; the floor only keeps a tiny one visible (none is
  // that small today: the smallest is 1 m of 10 m).
  const outer = 56, inner = Math.max(3, outer * item.innerRadius / item.radius);
  const ref = SCALE_ENEMIES.find(enemy => item.radius <= enemy.upTo);
  const refW = ref.span ? ref.span * outer / item.radius : ref.height * outer / item.radius / ref.ratio, refH = refW * ref.ratio;
  const refSize = ref.span ? L(`다리 폭 약 ${num(ref.span)}m`, `legs about ${num(ref.span)} m across`) : L(`키 약 ${num(ref.height)}m`, `about ${num(ref.height)} m tall`);
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
    <p>${L(html`<b style="color:var(--text)">중심 ${num(item.innerRadius)}m</b> 안쪽은 최대 피해입니다.<br>바깥으로 갈수록 줄어들어 <b style="color:var(--text)">${num(item.radius)}m</b>에서 사라지고, 관통력도 1 낮아집니다(최소 2).<br><span class="faint">충격파·함선 강화 효과는 제외한 반경입니다.</span><br><span class="faint">비교 대상은 '${ref.name}'(${refSize})이며, 원과 같은 축척으로 뒤에 그렸습니다.</span>`,
      html`Full damage within <b style="color:var(--text)">${num(item.innerRadius)}m</b> of the center.<br>It falls off further out and is gone at <b style="color:var(--text)">${num(item.radius)}m</b>; penetration also drops by 1 (to a minimum of 2).<br><span class="faint">Radii without shockwaves or ship modules.</span><br><span class="faint">For comparison, a ${ref.name} (${refSize}) is drawn behind to the same scale.</span>`)}</p>
  </div>`;
}

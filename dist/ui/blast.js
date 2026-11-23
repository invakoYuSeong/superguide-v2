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

// Stat card caption under the full-damage radius.
export const blastCaption = item => item.innerRadius >= item.radius ? L('경계까지 최대 피해', 'Full damage to the edge')
  : L(`최대 피해 · ${num(item.radius)}m까지 감소`, `Full damage · fades out by ${num(item.radius)}m`);

let figureCount = 0;

export function blastFigure(item) {
  if (item.radius == null || item.innerRadius == null) return '';
  // The falloff ring fades from the inner circle to nothing at the outer edge, as the damage does (linear,
  // core/combat.js blastAt), so the full-damage core reads as the range that counts (user decision 2026-11-23).
  const fade = `blast-fade-${++figureCount}`;
  const flat = item.innerRadius >= item.radius, half = (item.innerRadius + item.radius) / 2;
  const b = text => html`<b style="color:var(--text)">${text}</b>`;
  // The inner circle is to scale, like the enemy behind it; the floor only keeps a tiny one visible (none is
  // that small today: the smallest is 1 m of 10 m).
  const outer = 56, inner = Math.max(3, outer * item.innerRadius / item.radius);
  const ref = SCALE_ENEMIES.find(enemy => item.radius <= enemy.upTo);
  const refW = ref.span ? ref.span * outer / item.radius : ref.height * outer / item.radius / ref.ratio, refH = refW * ref.ratio;
  const refSize = ref.span ? L(`다리 폭 약 ${num(ref.span)}m`, `legs about ${num(ref.span)} m across`) : L(`키 약 ${num(ref.height)}m`, `about ${num(ref.height)} m tall`);
  return html`<div class="blast">
    <svg width="220" height="220" viewBox="0 0 132 132" role="img" aria-label="${L(`폭발 반경: 중심 ${item.innerRadius}m, 외곽 ${item.radius}m`, `Blast radius: inner ${item.innerRadius}m, outer ${item.radius}m`)}">
      <defs><radialGradient id="${fade}" gradientUnits="userSpaceOnUse" cx="66" cy="66" r="${outer}">
        <stop offset="${inner / outer}" style="stop-color:var(--accent);stop-opacity:.3"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/>
      </radialGradient></defs>
      <circle cx="66" cy="66" r="${outer}" fill="url(#${fade})" stroke="var(--accent)" stroke-opacity=".45" stroke-dasharray="3 4"/>
      <image class="blast-ref" href="${ref.src}" x="${66 - refW / 2}" y="${66 - refH / 2}" width="${refW}" height="${refH}" preserveAspectRatio="none"/>
      <circle cx="66" cy="66" r="${inner}" fill="var(--accent)" fill-opacity=".35" stroke="var(--accent)"/>
      <path d="M66 66H${66 - outer}" stroke="var(--text-3)" stroke-width="1.2" stroke-dasharray="3 3"/>
      <path d="M66 66H${66 + inner}" stroke="var(--accent-text)" stroke-width="1.6"/>
      <circle cx="66" cy="66" r="2.5" fill="var(--text)"/>
      <g class="blast-label" aria-hidden="true">
        <text class="blast-outer" x="62" y="59" text-anchor="end">${L('외곽', 'Outer')} ${num(item.radius)}m</text>
        <text class="blast-inner" x="70" y="80">${L('중심', 'Inner')} ${num(item.innerRadius)}m</text>
      </g>
    </svg>
    <p>${L(html`${flat
        ? html`반경 ${b(`${num(item.radius)}m`)} 안은 어디서나 최대 피해이고, 바깥은 피해가 없습니다.<br>나와 아군도 이 안에서는 다칠 수 있습니다.`
        : html`${b(`중심 ${num(item.innerRadius)}m`)}까지가 최대 피해가 들어가는 실제 효과 범위입니다.<br>바깥은 피해가 줄어 ${b(`${num(half)}m`)}에서 절반, ${b(`${num(item.radius)}m`)}에서 사라지고, 관통력도 1 낮아집니다(최소 2). 그래서 바깥 구간은 주로 장갑이 없거나 약한 적에게만 의미가 있습니다.<br>다만 나와 아군은 ${num(item.radius)}m 안에서 다칠 수 있습니다.`}<br><span class="faint">충격파·함선 강화 효과는 제외한 반경입니다.</span><br><span class="faint">비교 대상은 '${ref.name}'(${refSize})이며, 원과 같은 축척으로 뒤에 그렸습니다.</span>`,
      html`${flat
        ? html`Full damage anywhere within ${b(`${num(item.radius)}m`)}, none beyond it.<br>You and your teammates can get hurt inside it too.`
        : html`Full damage reaches ${b(`${num(item.innerRadius)}m`)} from the center: this is the range that really counts.<br>Further out the damage falls off, half at ${b(`${num(half)}m`)} and gone at ${b(`${num(item.radius)}m`)}, and penetration drops by 1 (to a minimum of 2), so that ring mostly matters against unarmored or lightly armored enemies.<br>You and your teammates can still get hurt within ${num(item.radius)}m.`}<br><span class="faint">Radii without shockwaves or ship modules.</span><br><span class="faint">For comparison, a ${ref.name} (${refSize}) is drawn behind to the same scale.</span>`)}</p>
  </div>`;
}

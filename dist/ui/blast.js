// Blast radius figure shared by the stratagem and gear detail sheets.
import { num } from '../core/explain.js';
import { html } from './dom.js';
import { L } from '../core/i18n.js';
import { apBandOf } from '../core/catalog.js';

// An enemy behind the circles at the same scale, so the radius reads against something known: a Trooper for
// the smallest blasts, where a Charger would outgrow the circle (user decision 2026-11-23), a Charger for small
// blasts, a Bile Titan for the rest (user decision 2026-11-20) and a Dragonroach for the biggest, where a Bile
// Titan would look small (user decision 2026-11-23; it stops at 20 m because its wings outgrow the circle there).
// Sizes are from the surface of the game models in their rest pose (Helldivers 2 01.007.202, via
// hd2armorinspector.com), rounded; the wiki and the developer give no sizes. Spans are side to side across the
// legs (measured 2026-11-20: Charger 5.1 m, Bile Titan 12.9 m); the Trooper is sized by its height (2.05 m,
// measured 2026-11-23), since its rest pose spreads the arms. The Dragonroach goes by its wingspan (41.5 m,
// measured 2026-11-23); its icon sees the spread wings at an angle, so it is rougher still. Pictures are the
// wiki's Enemy Icons cropped to the body (480 px on the long side). `center` puts the body, not the middle of the
// picture, on the blast centre where the two differ (the Dragonroach's left wing reaches much further).
const SCALE_ENEMIES = [
  { upTo: 3, name: L('트루퍼', 'Trooper'), height: 2, src: './assets/blast/trooper.webp', ratio: 480 / 322 },
  { upTo: 6, name: L('차저', 'Charger'), span: 5, src: './assets/blast/charger.webp', ratio: 372 / 480 },
  { upTo: 20, name: L('바일 타이탄', 'Bile Titan'), span: 13, src: './assets/blast/bile-titan.webp', ratio: 375 / 480 },
  { upTo: Infinity, name: L('드래곤로치', 'Dragonroach'), span: 42, wings: true, src: './assets/blast/dragonroach.webp', ratio: 142 / 480, center: [295 / 480, 85 / 142] },
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
  // Falloff penetration as core/combat.js blastAt has it (one less, never below 2), named by armor class, since
  // big blasts still go through medium or heavy armor out there.
  const fallAp = item.splashAp != null ? Math.max(2, item.splashAp - 1) : null;
  const fallBand = fallAp != null ? apBandOf({ ap: fallAp }).name : '';
  const fallKo = fallAp == null ? '관통력도 1 낮아짐' : fallAp === item.splashAp ? `관통력은 그대로 AP ${fallAp}(${fallBand})` : `관통력은 AP ${fallAp}(${fallBand}, 1 낮음)`;
  const fallEn = fallAp == null ? 'with 1 less penetration' : fallAp === item.splashAp ? `still at AP ${fallAp} (${fallBand})` : `at AP ${fallAp} (${fallBand}) instead of ${item.splashAp}`;
  const b = text => html`<b style="color:var(--text)">${text}</b>`;
  // The inner circle is to scale, like the enemy behind it; the floor only keeps a tiny one visible (none is
  // that small today: the smallest is 1 m of 10 m).
  const outer = 63, inner = Math.max(3, outer * item.innerRadius / item.radius);
  const ref = SCALE_ENEMIES.find(enemy => item.radius <= enemy.upTo);
  const refW = ref.span ? ref.span * outer / item.radius : ref.height * outer / item.radius / ref.ratio, refH = refW * ref.ratio;
  const [cx, cy] = ref.center || [0.5, 0.5];
  const refSize = ref.wings ? L(`날개 폭 약 ${num(ref.span)}m`, `wings about ${num(ref.span)} m across`) : ref.span ? L(`다리 폭 약 ${num(ref.span)}m`, `legs about ${num(ref.span)} m across`) : L(`키 약 ${num(ref.height)}m`, `about ${num(ref.height)} m tall`);
  return html`<section class="block"><h3>${L('폭발 반경', 'Blast radius')}</h3><div class="blast">
    <svg width="220" height="220" viewBox="0 0 132 132" role="img" aria-label="${L(`폭발 반경: 중심 ${item.innerRadius}m, 외곽 ${item.radius}m`, `Blast radius: inner ${item.innerRadius}m, outer ${item.radius}m`)}">
      <defs><radialGradient id="${fade}" gradientUnits="userSpaceOnUse" cx="66" cy="66" r="${outer}">
        <stop offset="${inner / outer}" style="stop-color:var(--accent);stop-opacity:.3"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/>
      </radialGradient></defs>
      <circle cx="66" cy="66" r="${outer}" fill="url(#${fade})" stroke="var(--accent)" stroke-opacity=".45" stroke-dasharray="3 4"/>
      <circle cx="66" cy="66" r="${inner}" fill="var(--accent)" fill-opacity=".35"/>
      <image class="blast-ref" href="${ref.src}" x="${66 - refW * cx}" y="${66 - refH * cy}" width="${refW}" height="${refH}" preserveAspectRatio="none"/>
      <circle cx="66" cy="66" r="${inner}" fill="none" stroke="var(--accent)"/>
      <path d="M66 66H${66 + outer}" stroke="var(--text-3)" stroke-width="1.2" stroke-dasharray="3 3"/>
      <path d="M66 66H${66 - inner}" stroke="var(--accent-text)" stroke-width="1.6"/>
      <circle cx="66" cy="66" r="2.5" fill="var(--text)"/>
      <g class="blast-label" aria-hidden="true">
        <text class="blast-inner" x="62" y="59" text-anchor="end">${L('중심', 'Inner')} ${num(item.innerRadius)}m</text>
        <text class="blast-outer" x="70" y="80">${L('외곽', 'Outer')} ${num(item.radius)}m</text>
      </g>
    </svg>
    <p>${L(html`${flat
        ? html`${b(`${num(item.radius)}m`)} 안 어디서나 최대 피해, 바깥은 피해 없음.`
        : html`${b(`중심 ${num(item.innerRadius)}m`)}까지 최대 피해(실제 효과 범위).<br>바깥은 ${b(`${num(item.radius)}m`)}까지 줄어들고(${b(`${num(half)}m`)}에서 절반) ${fallKo}.`}<br><span class="faint">충격파·함선 강화 제외. 뒤 그림은 같은 축척의 ${ref.name}(${refSize}).</span>`,
      html`${flat
        ? html`Full damage anywhere within ${b(`${num(item.radius)}m`)}, none beyond.`
        : html`Full damage within ${b(`${num(item.innerRadius)}m`)}: the range that counts.<br>It fades out by ${b(`${num(item.radius)}m`)} (half at ${b(`${num(half)}m`)}), ${fallEn}.`}<br><span class="faint">No shockwaves or ship modules. Behind: a ${ref.name} (${refSize}), same scale.</span>`)}</p>
  </div></section>`;
}

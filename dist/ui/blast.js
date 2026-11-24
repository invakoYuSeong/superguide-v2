// Blast radius figure shared by the stratagem and gear detail sheets.
import { num } from '../core/explain.js';
import { html } from './dom.js';
import { L } from '../core/i18n.js';
import { apBandOf } from '../core/catalog.js';
import { blastFalloff, WIDE_BLASTS } from '../core/combat.js';

// An enemy behind the circles at the same scale, so the radius reads against something known, each kept to
// roughly seven to ten tenths of the circle where a clean picture allows: a Rocket Devastator up to 2 m, a Hulk
// Obliterator up to 2.5 m (a Trooper was there first), a Charger up to 4 m, a Gatekeeper up to 5.5 m (wider than a
// 4 m circle), an Annihilator Tank up to 7 m, a Bile Titan up to 9 m, a Stingray up to 13 m and a grounded
// Illuminate Warp Ship beyond (user decisions 2026-11-20 and 2026-11-23). Tried and dropped for the biggest: a
// Dragonroach (wings 41.5 m, too thin to make out), and a Vox Engine or a Harvester (too small).
// Sizes are from the surface of the game models in their rest pose (Helldivers 2 01.007.202, via
// hd2armorinspector.com, measured 2026-11-20 and 2026-11-23), rounded; the wiki and the developer give no sizes.
// The Charger and the Bile Titan go by leg span (5.1 m, 12.9 m); the Rocket Devastator, the Hulk Obliterator and
// the Gatekeeper by height (2.83 m, 3.87 m, 7.5 m), since their poses spread the arms or legs; the Annihilator
// Tank, the Stingray and the Warp Ship by length (10.2 m, 17.3 m, 34.2 m; 7.2 m, 14.7 m and 24.2 m wide), which
// their near-side views show across. Pictures are the wiki's Enemy Icons (the Warp Ship's is its 'Grounded Warp
// Ship Icon Render', the Gatekeeper's its 'Gatekeeper clear') cropped to the body (480 px on the long side).
const SCALE_ENEMIES = [
  { upTo: 2, name: L('로켓 데버스테이터', 'Rocket Devastator'), height: 2.8, src: './assets/blast/rocket-devastator.webp', ratio: 480 / 413 },
  { upTo: 2.5, name: L('헐크 오블리터레이터', 'Hulk Obliterator'), height: 3.9, src: './assets/blast/hulk-obliterator.webp', ratio: 480 / 404 },
  { upTo: 4, name: L('차저', 'Charger'), span: 5, src: './assets/blast/charger.webp', ratio: 372 / 480 },
  { upTo: 5.5, name: L('게이트키퍼', 'Gatekeeper'), height: 7.5, src: './assets/blast/gatekeeper.webp', ratio: 407 / 480 },
  { upTo: 7, name: L('어나이얼레이터 탱크', 'Annihilator Tank'), span: 10, lengthwise: true, src: './assets/blast/annihilator-tank.webp', ratio: 204 / 480 },
  { upTo: 9, name: L('바일 타이탄', 'Bile Titan'), span: 13, src: './assets/blast/bile-titan.webp', ratio: 375 / 480 },
  { upTo: 13, name: L('스팅레이', 'Stingray'), span: 17, lengthwise: true, src: './assets/blast/stingray.webp', ratio: 292 / 480 },
  { upTo: Infinity, name: L('착륙한 워프 함선', 'grounded Warp Ship'), span: 34, lengthwise: true, src: './assets/blast/warp-ship.webp', ratio: 201 / 480 },
];

// Stat card caption under the full-damage radius.
export const blastCaption = item => item.innerRadius >= item.radius ? L('경계까지 최대 피해', 'Full damage to the edge')
  : L(`최대 피해 · ${num(item.radius)}m까지 감소`, `Full damage · fades out by ${num(item.radius)}m`);

let figureCount = 0;

export function blastFigure(item) {
  if (item.radius == null || item.innerRadius == null) return '';
  // The falloff ring fades from the inner circle to nothing at the outer edge along the damage curve
  // (core/combat.js blastFalloff), so the full-damage core reads as the range that counts (user decision 2026-11-23).
  // Half damage: x = 1/4 of the band on the standard curve (1 - sqrt x), x = sqrt(1/2) on the wide one (1 - x^2).
  const fade = `blast-fade-${++figureCount}`;
  const wide = WIDE_BLASTS.has(item.id);
  const flat = item.innerRadius >= item.radius;
  const half = Math.round((item.innerRadius + (item.radius - item.innerRadius) * (wide ? Math.SQRT1_2 : 0.25)) * 10) / 10;
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
  const refSize = ref.lengthwise ? L(`길이 약 ${num(ref.span)}m`, `about ${num(ref.span)} m long`) : ref.span ? L(`다리 폭 약 ${num(ref.span)}m`, `legs about ${num(ref.span)} m across`) : L(`키 약 ${num(ref.height)}m`, `about ${num(ref.height)} m tall`);
  return html`<section class="block"><h3>${L('폭발 반경', 'Blast radius')}</h3><div class="blast">
    <svg width="220" height="220" viewBox="0 0 132 132" role="img" aria-label="${L(`폭발 반경: 중심 ${item.innerRadius}m, 외곽 ${item.radius}m`, `Blast radius: inner ${item.innerRadius}m, outer ${item.radius}m`)}">
      <defs><radialGradient id="${fade}" gradientUnits="userSpaceOnUse" cx="66" cy="66" r="${outer}">
        ${[0, 0.25, 0.5, 0.75, 1].map(x => html`<stop offset="${(inner + (outer - inner) * x) / outer}" style="stop-color:var(--accent);stop-opacity:${Math.round(0.3 * blastFalloff(x, wide) * 1000) / 1000}"/>`)}
      </radialGradient></defs>
      <circle cx="66" cy="66" r="${outer}" fill="url(#${fade})" stroke="var(--accent)" stroke-opacity=".45" stroke-dasharray="3 4"/>
      <circle cx="66" cy="66" r="${inner}" fill="var(--accent)" fill-opacity=".35"/>
      <image class="blast-ref" href="${ref.src}" x="${66 - refW / 2}" y="${66 - refH / 2}" width="${refW}" height="${refH}" preserveAspectRatio="none"/>
      <circle cx="66" cy="66" r="${inner}" fill="none" stroke="var(--accent)"/>
      <path d="M66 66H${66 + outer}" stroke="var(--text-3)" stroke-width="1.2" stroke-dasharray="3 3"/>
      <path d="M66 66H${66 - inner}" stroke="var(--accent-text)" stroke-width="1.6"/>
      <circle cx="66" cy="66" r="2.5" fill="var(--text)"/>
      <g class="blast-label" aria-hidden="true">
        <text class="blast-inner" x="62" y="59" text-anchor="end">${L('중심', 'Inner')} ${num(item.innerRadius)}m</text>
        <text class="blast-outer" x="${66 + outer - 2}" y="80" text-anchor="end">${L('외곽', 'Outer')} ${num(item.radius)}m</text>
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

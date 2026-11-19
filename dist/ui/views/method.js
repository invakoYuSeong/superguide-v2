// "How the numbers work" sheet, with a worked example computed live by the engine.
import { enemies, weaponProfiles, damageSource } from '../../data/combat-data.js';
import { hitDamage, solveRoute, armorFactor } from '../../core/combat.js';
import { num } from '../../core/explain.js';
import { L } from '../../core/i18n.js';
import { html, icon, external } from '../dom.js';

function workedExample() {
  const enemy = enemies.find(item => item.id === 'charger');
  const part = enemy.parts.find(item => item.id === 'head');
  const mode = weaponProfiles.autocannon.modes.find(item => item.id === 'aphet');
  const d = part.durability;
  const blended = Math.floor(mode.standard * (1 - d / 100) + mode.durable * d / 100 + 1e-9);
  const factor = armorFactor(mode.ap, part.armor);
  const damage = hitDamage(mode, part, enemy.main);
  const route = solveRoute(enemy, part, mode);
  const compare = mode.ap === part.armor ? '=' : mode.ap > part.armor ? '>' : '<';
  return html`<div class="formula">${L(html`
    <p><b>예시: 오토캐넌(APHET) → 차저 머리</b> · 머리 체력 ${num(part.hp)}, 장갑 ${part.armor}, 내구도 ${d}%</p>
    <div class="step"><i>1</i><span>일반 ${mode.standard} · 내구 ${mode.durable} → 내구도 ${d}% 비율로 섞기</span><b>${num(blended)}</b></div>
    <div class="step"><i>2</i><span>관통 AP ${mode.ap} ${compare} 장갑 ${part.armor} → ×${factor}</span><b>${num(damage.direct)}</b></div>
    <div class="step"><i>3</i><span>폭발 ${mode.explosion} · AP ${mode.explosionAp} &lt; 장갑 ${part.armor} → 관통 못 함</span><b>${num(damage.explosion)}</b></div>
    <div class="step"><i>4</i><span>체력 ${num(part.hp)} ÷ 한 발 ${num(damage.direct + damage.explosion)} → 올림</span><b>${num(route.hits)}발 처치</b></div>`, html`
    <p><b>Example: Autocannon (APHET) → Charger head</b> · head health ${num(part.hp)}, armor ${part.armor}, durability ${d}%</p>
    <div class="step"><i>1</i><span>Standard ${mode.standard} · durable ${mode.durable} → blended by ${d}% durability</span><b>${num(blended)}</b></div>
    <div class="step"><i>2</i><span>Penetration AP ${mode.ap} ${compare} armor ${part.armor} → ×${factor}</span><b>${num(damage.direct)}</b></div>
    <div class="step"><i>3</i><span>Explosion ${mode.explosion} · AP ${mode.explosionAp} &lt; armor ${part.armor} → no penetration</span><b>${num(damage.explosion)}</b></div>
    <div class="step"><i>4</i><span>Health ${num(part.hp)} ÷ ${num(damage.direct + damage.explosion)} per shot → round up</span><b>${num(route.hits)}-shot kill</b></div>`)}
  </div>`;
}

const korean = () => html`
    <h2 id="sheet-title" style="font-size:24px">숫자는 이렇게 나옵니다</h2>
    <section><h3>1. 관통(AP)과 장갑</h3><p>공격의 관통이 맞은 부위의 장갑보다 낮으면 피해가 없고, 같으면 65%, 높으면 100%가 들어갑니다. 폭발은 폭발 자체의 관통으로 따로 판정합니다.</p></section>
    <section><h3>2. 내구도</h3><p>부위마다 ‘내구도’ 비율이 있습니다. 내구도가 높을수록 무기의 일반 피해 대신 ‘내구 피해’가 적용됩니다. 기관총처럼 내구 피해가 낮은 무기가 큰 적에게 약한 이유입니다.</p></section>
    <section><h3>3. 본체로 넘어가는 피해</h3><p>부위를 맞히면 그 피해의 일정 비율이 본체 체력으로도 넘어갑니다. 머리처럼 부서지면 즉사하는 부위도 있고, 다리처럼 부서져도 살아 있는 부위도 있어서, 부위를 부수거나 본체 체력을 모두 깎은 순간을 각각 계산합니다.</p></section>
    <section><h3>4. 폭발</h3><p>폭발은 중심 반경 안에서 최대 피해이고, 바깥으로 갈수록 줄어듭니다. 부위의 ‘폭발 저항’만큼 깎이며, 폭발에 면역인 부위는 그 폭발을 본체 기준으로 판정합니다.</p></section>
    ${workedExample()}
    <section><h3>표시 횟수가 뜻하는 것</h3><ul>
      <li>최대 피해로 <b>같은 부위</b>를 계속 맞혔을 때의 <b>최소 횟수(이론값)</b>입니다. 거리 감쇠·빗맞음·각도 때문에 실전에서는 더 필요할 수 있습니다.</li>
      <li>‘출혈 유발’은 본체 체력이 바닥나 곧 쓰러지지만, 잠시 더 움직이거나 공격할 수 있다는 뜻입니다.</li>
      <li>‘계산 보류’와 ‘미확인’은 자료가 없다는 뜻이지, 처치할 수 없다는 뜻이 아닙니다. 모르는 값을 0으로 채우지 않습니다.</li>
      <li>재생하는 적은 재생을 뺀 값이라 ‘이상’으로 표시합니다.</li>
    </ul></section>
    <section><h3>철거력</h3><p>시설마다 필요한 철거력이 있고, <b>한 번의</b> 명중이나 폭발이 그 값 이상이어야 무너집니다. 약한 공격 여러 번을 합쳐도 넘지 못합니다. 일부 시설은 이와 별개로 체력을 깎아서 부술 수 있습니다.</p></section>
    <section><h3>자료 출처</h3><p>모든 수치는 Helldivers Wiki의 부위·무기 표에서 2026년 9월 16일에 처음 확인하고 11월 8일에 다시 대조했습니다. 함선 강화, 행성 효과, 방어구 효과는 제외한 기본값이며 게임 패치와 실시간으로 연동되지 않습니다.</p>
      <p>아이콘과 부위 이미지는 Helldivers Wiki 기여자들의 작업으로, <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ko" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a> 조건에 따라 webp로 변환하고 크기를 줄여 사용합니다. 각 부위 사진 아래 링크에서 원본 파일과 원작자를 확인할 수 있습니다.</p>
      <p class="sources" style="margin-top:8px">${external(damageSource, '피해 계산 규칙')}${external('https://helldivers.wiki.gg/wiki/Demolition', '철거력')}${external('https://helldivers.wiki.gg/wiki/Stratagems', '스트라타젬 목록')}</p></section>`;

const english = () => html`
    <h2 id="sheet-title" style="font-size:24px">Where the numbers come from</h2>
    <section><h3>1. Armor penetration (AP) and armor</h3><p>If an attack's AP is below the armor of the part it hits, it does no damage; equal AP deals 65%, higher AP deals 100%. Explosions are checked separately against their own AP.</p></section>
    <section><h3>2. Durability</h3><p>Every part has a durability percentage. The higher it is, the more the weapon's durable damage applies instead of its standard damage. That is why weapons with low durable damage, like the Machine Gun, struggle against big enemies.</p></section>
    <section><h3>3. Damage passed to main health</h3><p>Hitting a part also passes a share of the damage to the enemy's main health. Some parts, like the head, kill when destroyed; others, like legs, do not. So the calculator tracks both the moment a part breaks and the moment main health runs out.</p></section>
    <section><h3>4. Explosions</h3><p>Explosions deal full damage inside the inner radius and less further out. Each part's explosive resistance reduces them, and for parts immune to explosions the blast is checked against the main body instead.</p></section>
    ${workedExample()}
    <section><h3>What the counts mean</h3><ul>
      <li>The <b>minimum (theoretical) count</b> when every shot hits <b>the same part</b> at full damage. Falloff, misses and angles mean you may need more in a real fight.</li>
      <li>“Bleeds out” means main health is gone and it is about to drop, but it can still move or attack for a moment.</li>
      <li>“Not calculated” and “Unverified” mean the data is missing — not that the enemy cannot be killed. Unknown values are never filled in as 0.</li>
      <li>For enemies that regenerate, counts leave regeneration out and are shown as a minimum (“+”).</li>
    </ul></section>
    <section><h3>Demolition force</h3><p>Every structure needs a certain demolition force, and <b>a single</b> hit or explosion has to meet it. Several weaker hits do not add up. Some structures can also be destroyed separately by wearing down their health.</p></section>
    <section><h3>Sources</h3><p>All numbers were first checked against the part and weapon tables on the Helldivers Wiki on September 16, 2026, and re-checked on November 8. They are base values without ship modules, planetary effects or armor passives, and are not linked to live game patches.</p>
      <p>Icons and part images are the work of Helldivers Wiki contributors, used under <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a> and converted to WebP and resized. The link under each part photo leads to the original file and its author.</p>
      <p class="sources" style="margin-top:8px">${external(damageSource, 'Damage rules')}${external('https://helldivers.wiki.gg/wiki/Demolition', 'Demolition force')}${external('https://helldivers.wiki.gg/wiki/Stratagems', 'Stratagem list')}</p></section>`;

export function openMethod(ctx) {
  ctx.openSheet(html`<div class="sheet-top"><span>${L('계산 방식', 'How the numbers work')}</span><button class="icon-button" type="button" data-close aria-label="${L('닫기', 'Close')}">${icon('close', 18)}</button></div>
  <div class="sheet-content method">${L(korean, english)()}
  </div>`, { label: L('계산 방식', 'How the numbers work') });
}

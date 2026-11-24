// "How the numbers work" sheet, with a worked example computed live by the engine.
import { enemies, weaponProfiles, damageSource } from '../../data/combat-data.js';
import { hitDamage, solveRoute, armorFactor } from '../../core/combat.js';
import { num } from '../../core/explain.js';
import { L } from '../../core/i18n.js';
import { helldiverArmor } from '../../data/enemy-weapons.js';
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

// Armor rating factors from the wiki armor table (enemy-weapons.js, Template:Armor Ratings).
const RATING_ROWS = [50, 70, 79, 100, 125, 150, 200];
const ratingList = () => RATING_ROWS.filter(rating => helldiverArmor.factors[rating] != null).map(rating => `${rating}: x${helldiverArmor.factors[rating]}`).join(', ');
const COMBAT_PAGE = 'https://helldivers.wiki.gg/wiki/Combat';
// helldiversotl.com research pages (read 2026-11-24): rules it found in the game code (7.1.0) that the wiki lacks or states differently.
const OTL = page => `https://helldiversotl.com/research/${page}`;

// Wiki Damage page (revision 142577) and Combat page (revision 142474): rules the counts here leave out.
const moreKorean = () => html`
    <section><h3>5. 출혈</h3><p>본체 체력이 바닥나면 적은 '쓰러진' 상태가 되고, 남은 '출혈 여유' 체력이 초마다 줄어 죽습니다. 예를 들어 차저는 출혈 여유 750이 초당 100씩 줄어듭니다. 팩토리 스트라이더 다리처럼 줄지 않는 부위는 그만큼 체력이 더 있는 셈입니다(다리 1,500 + 2,000).</p></section>
    <section><h3>6. 과관통</h3><p>관통이 장갑보다 충분히 높으면 탄이 부위나 적을 뚫고 다음 대상까지 맞힙니다. 뚫을 때 내는 관통은 장갑 값에 내구도 몫(내구도 25% 미만 1, 75% 미만 2, 그 이상 3)을 더한 만큼이고, 내기 전과 낸 뒤 모두 관통이 장갑보다 높아야 계속 날아갑니다. 그래서 장갑 0은 관통 2·3·4 이상, 장갑 1은 관통 4·5·6 이상이 있어야 뚫습니다(내구도 순). 한 적의 여러 부위를 지나도 가장 큰 값 한 번만 내고, 뚫으면서 느려진 탄은 다음 대상에게 피해가 줄 수 있습니다. 예: 스톨워트(관통 2)는 무권자 몸통(장갑 0, 내구도 0%)을 뚫고 관통 1로 다음 적을 맞힙니다.</p></section>
    <section><h3>7. 거리에 따른 감쇠</h3><p>탄은 날아가며 느려지고, 느려진 만큼 피해가 줄어듭니다(피해 배율 = 0.25 + 0.75 x (맞을 때 속도 / 처음 속도)<sup>2</sup>). 도미네이터처럼 로켓 추진탄이나 스피어, 워런트 같은 유도탄은 줄지 않습니다. 위키는 이를 거리로 바꾼 어림 공식(피해 배율 = 1 - 0.75 x (1 - e<sup>-2Dx</sup>), D = 0.0004712389 x 구경<sup>2</sup> x 항력계수 / 질량)을 싣고 있고, 중력과 궤적은 무시합니다. helldiversotl.com이 게임 코드에서 확인한 식도 같고, 관통은 거리와 상관없이 그대로입니다. 쏘는 사람이 앞으로 달리면 그 속도가 탄에 더해져 100%를 조금 넘을 수도 있습니다. 적 대응 화면에서 사격 거리를 고르면 이 공식으로 탄의 직격 피해를 줄여 다시 계산합니다(기본 0m는 감쇠 없음). 폭발 피해는 거리로 줄지 않습니다.</p></section>
    <section><h3>8. 폭발의 세 구간</h3><ul>
      <li><b>안쪽 반경</b>: 피해 100%, 관통 그대로. 장애물 너머까지 닿습니다.</li>
      <li><b>바깥 반경</b>: 중심 반경을 벗어나자마자 피해가 빠르게 줄어 바깥 구간의 1/4 지점에서 절반, 외곽에서 0%가 됩니다(1 - x의 제곱근, x는 바깥 구간에서 간 비율). 이글 500kg은 반대로 오래 버티다 끝에서 줄어 약 71% 지점에서 절반입니다(1 - x<sup>2</sup>). 관통은 1 낮아지고(최소 2), 철거력도 피해와 같은 비율로 줄어듭니다. 경직은 줄지 않고, 밀어내는 힘은 75% 이상 남습니다.</li>
      <li><b>충격파</b>: 피해 없이 경직만 줍니다.</li>
      <li>엎드려 있거나 날아가는 중이면 바깥 반경의 폭발 피해를 90% 덜 받습니다.</li>
    </ul></section>
    <section><h3>9. 지속 피해와 화염 배율</h3><p>화염, 가스, 산성 같은 지속 피해는 본체 체력에만 들어가고, 관통이 본체 장갑과 같으면 65%만 들어갑니다. 적마다 화염 배율이 있어(워리어 0.8배, 차저 1.5배, 바일 타이탄 1.7배) 적 화면의 '화염 저항'으로 표시합니다. 예: 화염 초당 100 x 차저 1.5 x 65% = 초당 97. 한 번에 들어가는 지속 피해의 소수점은 버리지 않고 모았다가 1이 되면 더합니다(6.25씩이면 6, 6, 6, 7).</p></section>
    <section><h3>10. 헬다이버가 받는 피해</h3><p>헬다이버 체력은 ${helldiverArmor.health}입니다. 머리는 ${helldiverArmor.head}배, 몸통은 ${helldiverArmor.chest}배, 팔다리는 ${Math.round(helldiverArmor.arm * 100) / 100}배로 맞습니다. 방어구 장갑 등급에 따라 받는 피해가 달라집니다(${ratingList()}). 장갑 등급 50~150에서는 1.5 - 장갑 등급 / 200배입니다. 장갑 등급 100 미만의 추가 피해 배율은 머리에는 붙지 않습니다(머리는 100 이하에서 1배). 강화 패시브는 폭발 피해를 ${helldiverArmor.fortified}배로, 생명력 증진 부스터는 받는 피해를 ${helldiverArmor.vitality}배로 줄입니다. 적 화면의 '공격 패턴' 표는 이 배율로 몸통 기준 횟수를 어림합니다.</p></section>
    <section><h3>11. 반동과 흔들림</h3><p>자세에 따라 반동(무기가 튀는 정도와 화면이 올라가는 정도)에 배율이 붙습니다. 조준경으로 볼 때 서서 0.9배(움직이면 1.1배), 앉아서 0.6배(0.9배), 엎드려 0.4배이고, 3인칭은 서서 1배(1.5배), 앉아서 0.6배(1배), 엎드려 0.4배입니다. 조준 중 흔들림은 조준경 기준 서서 0.75배(움직이면 3배), 앉아서 0.5배(2배), 엎드려 0.1배이고, 엎드리면 움직여도 늘지 않습니다. 이미 한쪽으로 약 0.57도 넘게 튄 상태에서는 반대쪽 반동이 1/16로 줄고, 충전·과열하는 무기는 반동이 최대 2배까지 커집니다. 장비 상세의 '흔들림'은 여기에 곱하는 무기별 배율입니다.</p></section>`;

const korean = () => html`
    <h2 id="sheet-title" style="font-size:24px">숫자는 이렇게 나옵니다</h2>
    <section><h3>1. 관통(AP)과 장갑</h3><p>공격의 관통이 맞은 부위의 장갑보다 낮으면 피해가 없고, 같으면 65%, 높으면 100%가 들어갑니다. 폭발은 폭발 자체의 관통으로 따로 판정합니다. 배율을 곱한 뒤 소수점 아래는 버립니다(예: 2 x 65% = 1.3, 3 x 65% = 1.95 모두 1).</p></section>
    <section><h3>2. 내구도</h3><p>부위마다 ‘내구도’ 비율이 있습니다. 내구도가 높을수록 무기의 일반 피해 대신 ‘내구 피해’가 적용됩니다. 기관총처럼 내구 피해가 낮은 무기가 큰 적에게 약한 이유입니다.</p></section>
    <section><h3>3. 본체로 넘어가는 피해</h3><p>부위를 맞히면 그 피해의 일정 비율이 본체 체력으로도 넘어갑니다. 머리처럼 부서지면 즉사하는 부위도 있고, 다리처럼 부서져도 살아 있는 부위도 있어서, 부위를 부수거나 본체 체력을 모두 깎은 순간을 각각 계산합니다.</p></section>
    <section><h3>4. 폭발</h3><p>폭발은 중심 반경 안에서 최대 피해이고, 바깥으로 갈수록 줄어듭니다. 부위의 ‘폭발 저항’만큼 깎이고, 깎인 몫은 본체의 장갑을 통과하면 본체 체력으로 들어갑니다(위키에는 없는 hd2armorinspector.com의 방식을 따름). 폭발에 면역인 부위는 그 폭발을 본체 기준으로 판정합니다.</p></section>
    ${workedExample()}
    <section><h3>표시 횟수가 뜻하는 것</h3><ul>
      <li>최대 피해로 <b>같은 부위</b>를 계속 맞혔을 때의 <b>최소 횟수(이론값)</b>입니다. 거리 감쇠·빗맞음·각도 때문에 실전에서는 더 필요할 수 있습니다.</li>
      <li>‘출혈 유발’은 본체 체력이 바닥나 곧 쓰러지지만, 잠시 더 움직이거나 공격할 수 있다는 뜻입니다.</li>
      <li>‘계산 보류’와 ‘미확인’은 자료가 없다는 뜻이지, 처치할 수 없다는 뜻이 아닙니다. 모르는 값을 0으로 채우지 않습니다.</li>
      <li>재생하는 적은 재생을 뺀 값이라 ‘이상’으로 표시합니다.</li>
    </ul></section>
    ${moreKorean()}
    <section><h3>철거력</h3><p>시설마다 필요한 철거력이 있고, <b>한 번의</b> 명중이나 폭발이 그 값 이상이어야 무너집니다. 약한 공격 여러 번을 합쳐도 넘지 못합니다. 일부 시설은 이와 별개로 체력을 깎아서 부술 수 있습니다.</p></section>
    <section><h3>자료 출처</h3><p>모든 수치는 Helldivers Wiki의 부위·무기 표에서 2026년 9월 16일에 처음 확인하고 11월 8일에 다시 대조했습니다. 함선 강화, 행성 효과, 방어구 효과는 제외한 기본값이며 게임 패치와 실시간으로 연동되지 않습니다.</p>
      <p>아이콘과 부위 이미지는 Helldivers Wiki 기여자들의 작업으로, <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ko" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0<span aria-hidden="true"> ↗</span></a> 조건에 따라 webp로 변환하고 크기를 줄여 사용합니다. 각 부위 사진 아래 링크에서 원본 파일과 원작자를 확인할 수 있습니다.</p>
      <p class="sources" style="margin-top:8px">${external(damageSource, '피해 계산 규칙')}${external(COMBAT_PAGE, '전투 규칙')}${external(helldiverArmor.source.page, '방어구 배율표')}${external('https://helldivers.wiki.gg/wiki/Demolition', '철거력')}${external('https://helldivers.wiki.gg/wiki/Stratagems', '스트라타젬 목록')}${external(OTL('explosion-falloff'), '폭발 감쇠(helldiversotl)')}${external(OTL('damage-resolution'), '피해 판정(helldiversotl)')}${external(OTL('recoil'), '반동(helldiversotl)')}</p></section>`;

const moreEnglish = () => html`
    <section><h3>5. Bleeding out</h3><p>When main health runs out the enemy is downed, and its remaining bleed-out health drains every second until it dies. A Charger, for example, has 750 bleed-out health draining at 100 per second. Parts that never drain, like a Factory Strider's legs, simply have that much more health (1,500 leg + 2,000).</p></section>
    <section><h3>6. Overpenetration</h3><p>With enough AP over the armor, a projectile passes through a part or an enemy and hits the next one. A pass costs the armor value plus a durability share (1 under 25% durable, 2 under 75%, 3 above), and the AP must beat the armor both before and after paying it. So armor 0 takes AP 2, 3 or 4 and armor 1 takes AP 4, 5 or 6 to pass, by durability. Passing several parts of one enemy charges only the largest cost, and a round slowed by the pass can deal less to the next target. Example: the Stalwart (AP 2) goes through a Voteless torso (armor 0, 0% durable) and hits the next enemy at AP 1.</p></section>
    <section><h3>7. Damage falloff</h3><p>Projectiles slow down in flight and deal less damage as they do (damage factor = 0.25 + 0.75 x (impact speed / initial speed)<sup>2</sup>). Rocket-propelled rounds like the Dominator's and guided ones like the Spear and Warrant do not fall off. The wiki turns this into an approximate formula by distance (damage factor = 1 - 0.75 x (1 - e<sup>-2Dx</sup>), D = 0.0004712389 x caliber<sup>2</sup> x drag coefficient / mass) that ignores gravity and the flight path. helldiversotl.com found the same formula in the game code, and AP stays the same at any range. Running forward adds your speed to the round, so it can deal a little over 100%. Pick a shooting distance on the enemy page to recount a shot's direct damage with it (the default 0 m has no falloff). Explosion damage does not fall off with range.</p></section>
    <section><h3>8. The three blast zones</h3><ul>
      <li><b>Inner radius</b>: 100% damage at full AP. It reaches past obstacles.</li>
      <li><b>Outer radius</b>: damage drops fast once past the inner radius, to half a quarter of the way out and 0% at the edge (1 - square root of x, x being how far through the band). The Eagle 500kg holds on longer and is at half about 71% of the way out (1 - x<sup>2</sup>). AP is 1 lower (minimum 2), and demolition force falls off with the damage. Stagger does not fall off, and push keeps at least 75%.</li>
      <li><b>Shockwave</b>: stagger only, no damage.</li>
      <li>Lying prone or ragdolling cuts outer-radius blast damage by 90%.</li>
    </ul></section>
    <section><h3>9. Damage over time and fire multipliers</h3><p>Fire, gas, acid and other damage over time hits main health only, and deals 65% when its AP equals the main armor. Each enemy has a fire multiplier (Warrior x0.8, Charger x1.5, Bile Titan x1.7), shown as fire resistance on the enemy view. Example: fire at 100 per second x 1.5 for a Charger x 65% = 97 per second. The fractions of each damage-over-time tick are kept and added once they reach 1 (6.25 a tick lands as 6, 6, 6, 7).</p></section>
    <section><h3>10. Damage Helldivers take</h3><p>A Helldiver has ${helldiverArmor.health} health. Head hits take x${helldiverArmor.head}, torso x${helldiverArmor.chest}, limbs x${Math.round(helldiverArmor.arm * 100) / 100}. The armor rating changes the damage taken (${ratingList()}; from 50 to 150 it is 1.5 - rating / 200); the extra damage of ratings under 100 does not apply to the head (x1 at 100 or less). The Fortified passive cuts blast damage to x${helldiverArmor.fortified}, and the Vitality Enhancement booster cuts damage taken to x${helldiverArmor.vitality}. The enemy view's Attacks table uses these factors for its rough torso-hit counts.</p></section>
    <section><h3>11. Recoil and sway</h3><p>Your stance scales recoil (how far the weapon kicks and the view climbs). Through the scope it is x0.9 standing (x1.1 moving), x0.6 crouched (x0.9) and x0.4 prone; in third person x1 standing (x1.5), x0.6 crouched (x1) and x0.4 prone. Aiming sway through the scope is x0.75 standing (x3 moving), x0.5 crouched (x2) and x0.1 prone, where moving adds nothing. Once the weapon has kicked more than about 0.57 degrees to one side, a kick the other way is cut to 1/16, and charging or heating weapons can recoil up to twice as hard. The Sway figure in gear details is the weapon's own multiplier on top of this.</p></section>`;

const english = () => html`
    <h2 id="sheet-title" style="font-size:24px">Where the numbers come from</h2>
    <section><h3>1. Armor penetration (AP) and armor</h3><p>If an attack's AP is below the armor of the part it hits, it does no damage; equal AP deals 65%, higher AP deals 100%. Explosions are checked separately against their own AP. Fractions are dropped after the factor is applied (2 x 65% = 1.3 and 3 x 65% = 1.95 both become 1).</p></section>
    <section><h3>2. Durability</h3><p>Every part has a durability percentage. The higher it is, the more the weapon's durable damage applies instead of its standard damage. That is why weapons with low durable damage, like the Machine Gun, struggle against big enemies.</p></section>
    <section><h3>3. Damage passed to main health</h3><p>Hitting a part also passes a share of the damage to the enemy's main health. Some parts, like the head, kill when destroyed; others, like legs, do not. So the calculator tracks both the moment a part breaks and the moment main health runs out.</p></section>
    <section><h3>4. Explosions</h3><p>Explosions deal full damage inside the inner radius and less further out. Each part's explosive resistance reduces them, and the share it blocks goes to the main body's health if it gets through the main body's armor (following hd2armorinspector.com; the wiki does not cover this). For parts immune to explosions the blast is checked against the main body instead.</p></section>
    ${workedExample()}
    <section><h3>What the counts mean</h3><ul>
      <li>The <b>minimum (theoretical) count</b> when every shot hits <b>the same part</b> at full damage. Falloff, misses and angles mean you may need more in a real fight.</li>
      <li>“Bleeds out” means main health is gone and it is about to drop, but it can still move or attack for a moment.</li>
      <li>“Not calculated” and “Unverified” mean the data is missing — not that the enemy cannot be killed. Unknown values are never filled in as 0.</li>
      <li>For enemies that regenerate, counts leave regeneration out and are shown as a minimum (“+”).</li>
    </ul></section>
    ${moreEnglish()}
    <section><h3>Demolition force</h3><p>Every structure needs a certain demolition force, and <b>a single</b> hit or explosion has to meet it. Several weaker hits do not add up. Some structures can also be destroyed separately by wearing down their health.</p></section>
    <section><h3>Sources</h3><p>All numbers were first checked against the part and weapon tables on the Helldivers Wiki on September 16, 2026, and re-checked on November 8. They are base values without ship modules, planetary effects or armor passives, and are not linked to live game patches.</p>
      <p>Icons and part images are the work of Helldivers Wiki contributors, used under <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0<span aria-hidden="true"> ↗</span></a> and converted to WebP and resized. The link under each part photo leads to the original file and its author.</p>
      <p class="sources" style="margin-top:8px">${external(damageSource, 'Damage rules')}${external(COMBAT_PAGE, 'Combat rules')}${external(helldiverArmor.source.page, 'Armor rating table')}${external('https://helldivers.wiki.gg/wiki/Demolition', 'Demolition force')}${external('https://helldivers.wiki.gg/wiki/Stratagems', 'Stratagem list')}${external(OTL('explosion-falloff'), 'Explosion falloff (helldiversotl)')}${external(OTL('damage-resolution'), 'Damage resolution (helldiversotl)')}${external(OTL('recoil'), 'Recoil (helldiversotl)')}</p></section>`;

export function openMethod(ctx) {
  ctx.openSheet(html`<div class="sheet-top"><span>${L('계산 방식', 'How the numbers work')}</span><button class="icon-button" type="button" data-close aria-label="${L('닫기', 'Close')}">${icon('close', 18)}</button></div>
  <div class="sheet-content method">${L(korean, english)()}
  </div>`, { label: L('계산 방식', 'How the numbers work') });
}

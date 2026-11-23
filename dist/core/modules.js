// Stratagem cooldown, call-in time, uses and Eagle rearm, with or without ship
// modules (every module fully upgraded). Base values come from each wiki page
// (data/stratagem-stats.js), module rates from data/ship-modules.js.
import { shipModules } from '../data/ship-modules.js';
import { stratagemStats } from '../data/stratagem-stats.js';

// The stratagem list toggles this; details opened elsewhere follow the same choice.
let enabled = true;
export const modulesOn = () => enabled;
export const setModulesOn = on => { enabled = Boolean(on); };

const applies = (module, id, type) => module.all || module.types?.includes(type) || module.ids?.includes(id);
const round = value => Math.round(value * 1000) / 1000;

export function timingOf(item, on = enabled) {
  const base = stratagemStats[item.id];
  if (!base) return null;
  const modules = shipModules.filter(module => applies(module, item.id, base.type));
  const product = key => modules.filter(module => module[key]).reduce((factor, module) => factor * module[key], 1);
  const cooldown = base.cooldown > 0 ? base.cooldown : null;
  const rearm = base.rearm > 0 ? base.rearm : null;
  const extraUses = modules.reduce((sum, module) => sum + (module.uses || 0), 0);
  return {
    type: base.type,
    cooldownBase: cooldown,
    cooldown: cooldown != null && on ? round(cooldown * product('cooldown')) : cooldown,
    rearmBase: rearm,
    rearm: rearm != null && on ? round(rearm * product('rearm')) : rearm,
    callInBase: base.callIn,
    callIn: on && base.callInModules != null ? base.callInModules : base.callIn,
    usesBase: base.uses,
    uses: on && typeof base.uses === 'number' ? base.uses + extraUses : base.uses,
    // Modules that change something shown for this stratagem.
    modules: modules.filter(module => (module.cooldown && cooldown != null) || (module.rearm && rearm != null)
      || (module.uses && typeof base.uses === 'number') || (module.callIn && base.callInModules != null)
      || (module.ammo && base.sentry?.ammo != null) || (module.health && base.body?.health != null && !base.body.drone)),
    revision: base.revision,
  };
}

// A sentry's ammo and main health with or without the ship modules (Shock Absorption Gel, Advanced
// Construction). The module values are the wiki page's own (sentry_ammo_upgraded, sentry_health_upgraded):
// the Rocket Sentry's 32 -> 40 shows the ammo module filling only its first pod. Without a page value the
// module rate is applied and rounded up, as the wiki rounds 22.5 to 23.
export function sentryLoadOf(item, on = enabled) {
  const base = stratagemStats[item.id];
  if (!base || base.type !== 'Sentry') return null;
  const rate = key => shipModules.find(module => module[key] && applies(module, item.id, base.type))?.[key] ?? 1;
  const gun = base.sentry ?? {};
  const ammoModules = gun.ammo == null ? null : gun.ammoModules ?? Math.ceil(gun.ammo * rate('ammo'));
  const health = base.body?.health ?? null;
  const healthModules = health == null ? null : gun.healthModules ?? Math.ceil(health * rate('health'));
  return {
    ammoBase: gun.ammo ?? null, ammo: on ? ammoModules : gun.ammo ?? null, ammoModules, ammoFromPage: gun.ammoModules != null,
    healthBase: health, health: on ? healthModules : health, healthModules,
  };
}

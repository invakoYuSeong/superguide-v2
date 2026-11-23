// Ship module upgrades that change stratagem cooldowns, call-in times and Eagle
// rearms (Helldivers Wiki "Ship Modules", revision 134806). With "함선 모듈 적용"
// on, every module counts as fully upgraded. Reductions multiply: the wiki's own
// Orbital Airburst (90 -> 76.95 s) and APEX (480 -> 410 s) pages apply Morale
// Augmentation on top of the type reduction that way. Korean names are the game's.
// `types` are the wiki infobox `stratagem_type` values; `ids` name single stratagems.
export const shipModulesSource = { page: 'https://helldivers.wiki.gg/wiki/Ship_Modules', revision: 134806 };

export const shipModules = [
  { id: 'streamlined-request', name: '요청 과정 간소화', en: 'Streamlined Request Process', types: ['Support Weapon'], cooldown: 0.9, text: "Decreases '''Support Weapon''' stratagem cooldown by '''10%'''." },
  { id: 'hand-carts', name: '손수레', en: 'Hand Carts', types: ['Backpack'], cooldown: 0.9, text: "Decreases cooldown for all '''Backpack''' stratagems by '''10%'''." },
  { id: 'zero-g-breech', name: '무중력 후미 장전', en: 'Zero-G Breech Loading', types: ['Orbital'], cooldown: 0.9, text: "'''Orbital''' stratagem cooldown time reduced by '''10%'''." },
  { id: 'liquid-cockpit', name: '액체 환기형 조종석', en: 'Liquid-Ventilated Cockpit', types: ['Eagle'], cooldown: 0.5, text: "'''Eagle''' stratagem cooldown time reduced by '''50%'''." },
  { id: 'synthetic-supplementation', name: '합성 보충제', en: 'Synthetic Supplementation', types: ['Sentry', 'Emplacement'], ids: ['resupply'], cooldown: 0.9, text: "Reduces cooldown time for '''Sentry, Emplacement, and Resupply''' stratagems by '''10%'''." },
  { id: 'morale-augmentation', name: '사기 증강', en: 'Morale Augmentation', all: true, cooldown: 0.95, text: "Reduces cooldown time for '''all Stratagems''' by '''5%'''." },
  { id: 'pit-crew', name: '피트 대원 위험수당', en: 'Pit Crew Hazard Pay', types: ['Eagle'], ids: ['eagle-rearm'], rearm: 0.8, text: "Reduces '''Eagle''' Rearm time by '''20%'''." },
  { id: 'expanded-weapons-bay', name: '무기 베이 확장', en: 'Expanded Weapons Bay', types: ['Eagle'], uses: 1, text: "Increases number of '''Eagle''' stratagem uses per '''Rearm''' by 1." },
  // Sentry ammo and health: the module values come from each page's sentry_ammo_upgraded and
  // sentry_health_upgraded (stratagem-stats.js `sentry`); the rate is used only where a page has none.
  { id: 'shock-absorption-gel', name: '충격 흡수 젤', en: 'Shock Absorption Gel', types: ['Sentry'], ammo: 1.5, text: "Increases ammo for all '''Sentry''' stratagems by '''50%'''." },
  { id: 'advanced-construction', name: '고도화된 구조', en: 'Advanced Construction', types: ['Sentry'], health: 1.5, text: "Increases health of '''Sentry''' stratagems by '''50%'''." },
  // Call-in times with these modules come from each page's `call_time_upgraded`.
  { id: 'targeting-software', name: '표적화 소프트웨어 업그레이드', en: 'Targeting Software Upgrade', types: ['Orbital'], callIn: true, text: "'''1-second''' reduction in call-in time for all '''Orbital''' Stratagems." },
  { id: 'streamlined-launch', name: '발사 과정 간소화', en: 'Streamlined Launch Process', types: ['Support Weapon'], callIn: true, text: "All '''Support Weapon''' stratagems launch immediately once called in, reducing overall deployment time." },
  { id: 'dynamic-tracking', name: '동적 추적', en: 'Dynamic Tracking', types: ['Sentry'], callIn: true, text: "All '''Sentry''' stratagems launch immediately once called in, reducing overall deployment time." },
  { id: 'rapid-launch', name: '신속 발사 시스템', en: 'Rapid Launch System', types: ['Emplacement'], callIn: true, text: "All '''Emplacement''' stratagems launch immediately once called in, reducing overall deployment time." },
];

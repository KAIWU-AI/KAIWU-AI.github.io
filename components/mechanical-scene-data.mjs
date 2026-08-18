export const GEAR_MODULE_SCALE = 0.076;
export const PLANETARY_GEAR_TEETH = Object.freeze({
  sun: 18,
  planet: 12,
  ring: 42,
});
export const PLANETARY_CENTER_DISTANCE =
  GEAR_MODULE_SCALE * (PLANETARY_GEAR_TEETH.sun + PLANETARY_GEAR_TEETH.planet) / 2;
export const PLANETARY_PHASE_OFFSETS = Object.freeze([0, 0, 0]);
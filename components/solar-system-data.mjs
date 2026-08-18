// Source facts: NASA Solar System Exploration.
// https://science.nasa.gov/solar-system/planets/
// https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/
// Radii and orbital values are physical reference data; the rendered scene uses
// explicit non-linear mappings so all eight planets remain visible on screen.

export const SUN_VISUAL_RADIUS = 0.82;
export const SOLAR_SCALE_NOTE =
  "可视化示意 · 尺寸、间距、轨道形状、初始相位与时间均经压缩；非实时星历 · Visualized size, spacing, orbital shape, phase and time; not an ephemeris";
export const SOLAR_CAMERA_NARROW = Object.freeze([0, 22, 28]);

export const SOLAR_SYSTEM_BODIES = Object.freeze([
  Object.freeze({
    name: "Mercury",
    nameZh: "水星",
    radiusKm: 2439.7,
    orbitAu: 0.387,
    orbitalDays: 87.97,
    eccentricity: 0.2056,
    inclinationDeg: 7.0,
    axialTiltDeg: 0.034,
    phase: 0.34,
    color: 0xa9a39b,
  }),
  Object.freeze({
    name: "Venus",
    nameZh: "金星",
    radiusKm: 6051.8,
    orbitAu: 0.723,
    orbitalDays: 224.7,
    eccentricity: 0.0068,
    inclinationDeg: 3.39,
    axialTiltDeg: 177.4,
    phase: 1.46,
    color: 0xd8a86e,
  }),
  Object.freeze({
    name: "Earth",
    nameZh: "地球",
    radiusKm: 6371.0,
    orbitAu: 1.0,
    orbitalDays: 365.25,
    eccentricity: 0.0167,
    inclinationDeg: 0.0,
    axialTiltDeg: 23.44,
    phase: 2.23,
    color: 0x3f82c9,
  }),
  Object.freeze({
    name: "Mars",
    nameZh: "火星",
    radiusKm: 3389.5,
    orbitAu: 1.524,
    orbitalDays: 686.98,
    eccentricity: 0.0934,
    inclinationDeg: 1.85,
    axialTiltDeg: 25.19,
    phase: 3.12,
    color: 0xb75538,
  }),
  Object.freeze({
    name: "Jupiter",
    nameZh: "木星",
    radiusKm: 69911,
    orbitAu: 5.203,
    orbitalDays: 4332.59,
    eccentricity: 0.0489,
    inclinationDeg: 1.3,
    axialTiltDeg: 3.13,
    phase: 0.92,
    color: 0xc9a27f,
  }),
  Object.freeze({
    name: "Saturn",
    nameZh: "土星",
    radiusKm: 58232,
    orbitAu: 9.537,
    orbitalDays: 10759.22,
    eccentricity: 0.0565,
    inclinationDeg: 2.49,
    axialTiltDeg: 26.73,
    phase: 4.42,
    color: 0xd6bd83,
  }),
  Object.freeze({
    name: "Uranus",
    nameZh: "天王星",
    radiusKm: 25362,
    orbitAu: 19.191,
    orbitalDays: 30688.5,
    eccentricity: 0.0472,
    inclinationDeg: 0.77,
    axialTiltDeg: 97.77,
    phase: 5.21,
    color: 0x8bd8df,
  }),
  Object.freeze({
    name: "Neptune",
    nameZh: "海王星",
    radiusKm: 24622,
    orbitAu: 30.07,
    orbitalDays: 60182,
    eccentricity: 0.0086,
    inclinationDeg: 1.77,
    axialTiltDeg: 28.32,
    phase: 2.82,
    color: 0x365bb5,
  }),
]);

export function visualPlanetRadius(radiusKm) {
  return 0.055 + 0.11 * Math.pow(Number(radiusKm) / 6371, 0.42);
}

export function axialTiltRadians(body) {
  return (body.axialTiltDeg * Math.PI) / 180;
}

export function visualOrbitRadius(orbitAu) {
  return 1.35 + 1.08 * Math.log1p(Number(orbitAu) * 1.8);
}

export function positionOnVisualOrbit(body, angle) {
  const radius = visualOrbitRadius(body.orbitAu);
  const inclination = (body.inclinationDeg * Math.PI) / 180;
  const localZ = Math.sin(angle) * radius * (1 - body.eccentricity * 0.42);
  return Object.freeze({
    x: Math.cos(angle) * radius,
    y: -localZ * Math.sin(inclination),
    z: localZ * Math.cos(inclination),
  });
}

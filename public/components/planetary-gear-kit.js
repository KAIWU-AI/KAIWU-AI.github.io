/*
 * Procedural visual planetary gearbox for Three.js teaching/explainer video.
 * Educational geometry: tooth proportions are visual, not manufacturing involutes.
 */
(function attachPlanetaryGearKit(global) {
  "use strict";
  function validate(config) {
    const sun = Number(config.sunTeeth || 18);
    const planet = Number(config.planetTeeth || 12);
    const ring = Number(config.ringTeeth || 42);
    const planetCount = Number(config.planetCount || 3);
    const errors = [];
    if (ring !== sun + 2 * planet) errors.push(`ringTeeth must equal sunTeeth + 2 × planetTeeth (${sun + 2 * planet})`);
    if (!Number.isInteger(planetCount) || planetCount < 2) errors.push("planetCount must be an integer >= 2");
    if ((sun + ring) % planetCount !== 0) errors.push("Equal planet spacing may not preserve tooth phase: (sunTeeth + ringTeeth) must be divisible by planetCount");
    return { valid: errors.length === 0, errors, ratioFixedRing: 1 + ring / sun, carrierSpeedForSun1: sun / (sun + ring), planetRelativeSpinForSun1: -(sun / planet) * (1 - sun / (sun + ring)) };
  }

  function gearGeometry(THREE, teeth, outerRadius, rootRadius, depth, toothHalfWidth) {
    const shape = new THREE.Shape();
    const points = [];
    const steps = teeth * 4;
    for (let i = 0; i < steps; i++) {
      const phase = i % 4;
      const radius = phase === 1 || phase === 2 ? outerRadius : rootRadius;
      const angle = i / steps * Math.PI * 2;
      points.push(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
    }
    shape.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => shape.lineTo(point.x, point.y));
    shape.closePath();
    shape.holes.push(new THREE.Path().absarc(0, 0, toothHalfWidth, 0, Math.PI * 2, false));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, bevelSize: depth * 0.12, bevelThickness: depth * 0.10, curveSegments: 64 });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  }

  function create(THREE, options = {}) {
    if (!THREE) throw new Error("PlanetaryGearKit.create requires the THREE namespace");
    const config = { sunTeeth: 18, planetTeeth: 12, ringTeeth: 42, planetCount: 3, ...options };
    const report = validate(config);
    if (!report.valid) throw new Error(report.errors.join("; "));
    const group = new THREE.Group();
    const sunMaterial = options.sunMaterial || new THREE.MeshStandardMaterial({ color: 0xff7738, metalness: 0.72, roughness: 0.24, emissive: 0x5a1707, emissiveIntensity: 0.12 });
    const planetMaterial = options.planetMaterial || new THREE.MeshStandardMaterial({ color: 0x8fe8ff, metalness: 0.78, roughness: 0.22 });
    const ringMaterial = options.ringMaterial || new THREE.MeshStandardMaterial({ color: 0x13728f, metalness: 0.84, roughness: 0.24 });
    const carrierMaterial = options.carrierMaterial || new THREE.MeshStandardMaterial({ color: 0x65c9e8, metalness: 0.80, roughness: 0.20, emissive: 0x0b4253, emissiveIntensity: 0.28 });
    const moduleScale = Number(options.moduleScale || 0.075);
    const sunOuter = config.sunTeeth * moduleScale;
    const planetOuter = config.planetTeeth * moduleScale;
    const depth = Number(options.depth || 0.38);
    const centerDistance = (config.sunTeeth + config.planetTeeth) * moduleScale;
    const ringInner = (config.ringTeeth - 2) * moduleScale;
    const ringOuter = ringInner + Number(options.ringWall || 0.62);

    const sun = new THREE.Mesh(gearGeometry(THREE, config.sunTeeth, sunOuter, sunOuter * 0.80, depth, sunOuter * 0.18), sunMaterial);
    group.add(sun);
    const carrier = new THREE.Group();
    group.add(carrier);
    const planets = [];
    for (let index = 0; index < config.planetCount; index++) {
      const angle = index / config.planetCount * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(angle) * centerDistance, Math.sin(angle) * centerDistance, 0.12);
      const gear = new THREE.Mesh(gearGeometry(THREE, config.planetTeeth, planetOuter, planetOuter * 0.80, depth, planetOuter * 0.20), planetMaterial);
      pivot.add(gear);
      carrier.add(pivot);
      planets.push(pivot);
    }
    const ring = new THREE.Group();
    const ringShape = new THREE.Shape();
    ringShape.absarc(0, 0, ringOuter, 0, Math.PI * 2, false);
    ringShape.holes.push(new THREE.Path().absarc(0, 0, ringInner, 0, Math.PI * 2, true));
    const ringBody = new THREE.ExtrudeGeometry(ringShape, { depth, bevelEnabled: true, bevelSegments: 2, bevelSize: depth * 0.10, bevelThickness: depth * 0.08, curveSegments: 96 });
    ringBody.translate(0, 0, -depth / 2);
    ring.add(new THREE.Mesh(ringBody, ringMaterial));
    const toothGeometry = new THREE.BoxGeometry(moduleScale * 3.2, moduleScale * 4.4, depth * 0.82);
    for (let index = 0; index < config.ringTeeth; index++) {
      const angle = index / config.ringTeeth * Math.PI * 2;
      const tooth = new THREE.Mesh(toothGeometry, ringMaterial);
      tooth.position.set(Math.cos(angle) * ringInner, Math.sin(angle) * ringInner, 0);
      tooth.rotation.z = angle;
      ring.add(tooth);
    }
    group.add(ring);

    function renderFixedRingAt(time, sunRadiansPerSecond = 1) {
      const sunAngle = Number(time || 0) * sunRadiansPerSecond;
      const carrierAngle = sunAngle * report.carrierSpeedForSun1;
      sun.rotation.z = sunAngle;
      carrier.rotation.z = carrierAngle;
      planets.forEach((planet, index) => { planet.rotation.z = sunAngle * report.planetRelativeSpinForSun1 + index * 0.06; });
      ring.rotation.z = 0;
    }
    return Object.freeze({ group, sun, planets, ring, carrier, config: Object.freeze(config), kinematics: Object.freeze(report), renderFixedRingAt });
  }
  global.PlanetaryGearKit = Object.freeze({ create, validate, gearGeometry });
})(window);

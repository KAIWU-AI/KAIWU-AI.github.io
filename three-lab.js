import * as THREE from "./vendor/three.module.min.js";
import {
  SOLAR_SYSTEM_BODIES,
  SUN_VISUAL_RADIUS,
  SOLAR_CAMERA_NARROW,
  axialTiltRadians,
  positionOnVisualOrbit,
  visualOrbitRadius,
  visualPlanetRadius,
} from "./components/solar-system-data.mjs";
import {
  GEAR_MODULE_SCALE,
  PLANETARY_GEAR_TEETH,
  PLANETARY_CENTER_DISTANCE,
  PLANETARY_PHASE_OFFSETS,
} from "./components/mechanical-scene-data.mjs";

const viewports = [...document.querySelectorAll("[data-three-view]")];
if (viewports.length !== 3) {
  throw new Error("AgentV 3D lab requires solar, gearbox, and joint viewports.");
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function fract(value) {
  return value - Math.floor(value);
}

function deterministic(index, salt = 0) {
  return fract(Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453);
}

function disposeMaterial(material) {
  for (const key of [
    "map",
    "alphaMap",
    "aoMap",
    "bumpMap",
    "emissiveMap",
    "envMap",
    "metalnessMap",
    "normalMap",
    "roughnessMap",
  ]) {
    material[key]?.dispose?.();
  }
  material.dispose();
}

function disposeObject(root) {
  root.traverse((object) => {
    object.geometry?.dispose?.();
    if (object.material) {
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach(disposeMaterial);
    }
  });
}

function createStars(count, radiusMin, radiusMax, size, opacity) {
  const positions = [];
  const colors = [];
  const cool = new THREE.Color(0x99dbff);
  const warm = new THREE.Color(0xffd8b0);
  for (let index = 0; index < count; index += 1) {
    const radius = radiusMin + deterministic(index, 1) * (radiusMax - radiusMin);
    const azimuth = deterministic(index, 2) * Math.PI * 2;
    const elevation = Math.asin(deterministic(index, 3) * 2 - 1);
    positions.push(
      Math.cos(azimuth) * Math.cos(elevation) * radius,
      Math.sin(elevation) * radius,
      Math.sin(azimuth) * Math.cos(elevation) * radius,
    );
    const color = cool.clone().lerp(warm, deterministic(index, 4));
    colors.push(color.r, color.g, color.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size,
      transparent: true,
      opacity,
      sizeAttenuation: true,
      vertexColors: true,
      depthWrite: false,
    }),
  );
}

function createGlowTexture() {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 256;
  textureCanvas.height = 256;
  const context = textureCanvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,244,190,0.96)");
  gradient.addColorStop(0.2, "rgba(255,167,68,0.58)");
  gradient.addColorStop(0.55, "rgba(255,87,24,0.16)");
  gradient.addColorStop(1, "rgba(255,65,10,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPlanetTexture(body, index, renderer) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 384;
  textureCanvas.height = 192;
  const context = textureCanvas.getContext("2d");
  const base = new THREE.Color(body.color);
  const top = base.clone().offsetHSL(0.01, 0.04, 0.12).getStyle();
  const bottom = base.clone().offsetHSL(-0.01, -0.02, -0.13).getStyle();
  const gradient = context.createLinearGradient(0, 0, 0, textureCanvas.height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(0.5, base.getStyle());
  gradient.addColorStop(1, bottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, textureCanvas.width, textureCanvas.height);

  if (["Jupiter", "Saturn", "Uranus", "Neptune", "Venus"].includes(body.name)) {
    const bands = body.name === "Jupiter" ? 20 : 13;
    for (let band = 0; band < bands; band += 1) {
      const y = (band / bands) * textureCanvas.height;
      const light = deterministic(band, index + 10) * 0.18 - 0.09;
      context.fillStyle = base.clone().offsetHSL(0, 0.03, light).getStyle();
      context.globalAlpha = body.name === "Uranus" ? 0.22 : 0.5;
      context.fillRect(0, y, textureCanvas.width, textureCanvas.height / bands * 0.58);
    }
    context.globalAlpha = 1;
  }

  if (body.name === "Earth") {
    context.fillStyle = "rgba(58,113,76,0.92)";
    context.beginPath();
    context.moveTo(25, 70);
    context.bezierCurveTo(60, 40, 88, 57, 104, 92);
    context.bezierCurveTo(120, 126, 83, 150, 55, 128);
    context.bezierCurveTo(36, 112, 14, 105, 25, 70);
    context.fill();
    context.beginPath();
    context.moveTo(175, 45);
    context.bezierCurveTo(220, 28, 270, 58, 260, 91);
    context.bezierCurveTo(250, 120, 302, 127, 330, 103);
    context.bezierCurveTo(310, 153, 218, 158, 190, 112);
    context.closePath();
    context.fill();
    context.strokeStyle = "rgba(255,255,255,0.52)";
    context.lineWidth = 5;
    for (let cloud = 0; cloud < 6; cloud += 1) {
      const y = 24 + cloud * 28;
      context.beginPath();
      context.moveTo((cloud * 63) % 170, y);
      context.bezierCurveTo(120, y - 9, 240, y + 13, 384, y - 4);
      context.stroke();
    }
  } else {
    const spotCount = body.name === "Jupiter" ? 18 : 34;
    for (let spot = 0; spot < spotCount; spot += 1) {
      const x = deterministic(spot, index + 21) * textureCanvas.width;
      const y = deterministic(spot, index + 31) * textureCanvas.height;
      const width = 4 + deterministic(spot, index + 41) * 30;
      context.fillStyle = base.clone().offsetHSL(
        deterministic(spot, 9) * 0.04 - 0.02,
        0,
        deterministic(spot, 10) * 0.22 - 0.14,
      ).getStyle();
      context.globalAlpha = 0.2 + deterministic(spot, 11) * 0.28;
      context.beginPath();
      context.ellipse(x, y, width, width * 0.42, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  if (body.name === "Jupiter") {
    context.fillStyle = "rgba(154,63,42,0.72)";
    context.beginPath();
    context.ellipse(292, 118, 26, 12, -0.08, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

function createOrbit(body) {
  const points = [];
  for (let index = 0; index < 192; index += 1) {
    const angle = (index / 192) * Math.PI * 2;
    const position = positionOnVisualOrbit(body, angle);
    points.push(new THREE.Vector3(position.x, position.y, position.z));
  }
  const line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color: 0x5a91a8,
      transparent: true,
      opacity: 0.19,
      depthWrite: false,
    }),
  );
  return line;
}

function createAtmosphere(radius, color, opacity) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.045, 36, 24),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
}

function buildSolarSystem(renderer) {
  const root = new THREE.Group();
  const orbiters = [];

  const sunTexture = createPlanetTexture(
    { name: "Sun", color: 0xffa83d },
    99,
    renderer,
  );
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_VISUAL_RADIUS, 72, 48),
    new THREE.MeshStandardMaterial({
      map: sunTexture,
      emissive: 0xff7a22,
      emissiveMap: sunTexture,
      emissiveIntensity: 1.55,
      roughness: 0.82,
      metalness: 0,
    }),
  );
  root.add(sun);

  const sunGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture(),
      color: 0xff8a2a,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sunGlow.scale.set(3.7, 3.7, 1);
  root.add(sunGlow);

  const sunLight = new THREE.PointLight(0xffba73, 68, 30, 1.4);
  root.add(sunLight);

  SOLAR_SYSTEM_BODIES.forEach((body, index) => {
    const orbitRadius = visualOrbitRadius(body.orbitAu);
    const planetRadius = visualPlanetRadius(body.radiusKm);
    root.add(createOrbit(body));

    const planetGroup = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(planetRadius, 48, 32),
      new THREE.MeshStandardMaterial({
        map: createPlanetTexture(body, index, renderer),
        color: 0xffffff,
        roughness: body.name === "Earth" ? 0.58 : 0.74,
        metalness: 0,
      }),
    );
    mesh.rotation.z = THREE.MathUtils.degToRad(body.axialTiltDeg);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    planetGroup.add(mesh);

    if (body.name === "Earth") {
      planetGroup.add(createAtmosphere(planetRadius, 0x75cfff, 0.18));
      const moonPivot = new THREE.Group();
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 24, 16),
        new THREE.MeshStandardMaterial({ color: 0xa9adb3, roughness: 0.96 }),
      );
      moon.position.x = planetRadius + 0.18;
      moonPivot.add(moon);
      planetGroup.add(moonPivot);
      planetGroup.userData.moonPivot = moonPivot;
    }

    if (["Venus", "Jupiter", "Saturn", "Uranus", "Neptune"].includes(body.name)) {
      const atmosphereColor = {
        Venus: 0xffc979,
        Jupiter: 0xd9b28b,
        Saturn: 0xe3ca91,
        Uranus: 0x9ee9ee,
        Neptune: 0x557ee7,
      }[body.name];
      planetGroup.add(createAtmosphere(planetRadius, atmosphereColor, body.name === "Venus" ? 0.13 : 0.08));
    }

    if (body.name === "Saturn" || body.name === "Uranus") {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(
          planetRadius * (body.name === "Saturn" ? 1.3 : 1.45),
          planetRadius * (body.name === "Saturn" ? 2.15 : 1.82),
          128,
        ),
        new THREE.MeshStandardMaterial({
          color: body.name === "Saturn" ? 0xc7af79 : 0x8fbfc2,
          transparent: true,
          opacity: body.name === "Saturn" ? 0.68 : 0.24,
          side: THREE.DoubleSide,
          roughness: 0.88,
          depthWrite: false,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      const ringAssembly = new THREE.Group();
      ringAssembly.rotation.z = axialTiltRadians(body);
      ringAssembly.add(ring);
      planetGroup.add(ringAssembly);
    }

    root.add(planetGroup);
    orbiters.push({
      body,
      group: planetGroup,
      mesh,
      orbitRadius,
      speed: 0.105 * Math.pow(365.25 / body.orbitalDays, 0.38),
    });
  });

  const asteroidGeometry = new THREE.IcosahedronGeometry(0.018, 0);
  const asteroidMaterial = new THREE.MeshStandardMaterial({
    color: 0x807a73,
    roughness: 0.95,
    metalness: 0.04,
  });
  const asteroidBelt = new THREE.InstancedMesh(asteroidGeometry, asteroidMaterial, 260);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let index = 0; index < 260; index += 1) {
    const angle = deterministic(index, 51) * Math.PI * 2;
    const radius = 3.12 + (deterministic(index, 52) - 0.5) * 0.38;
    position.set(
      Math.cos(angle) * radius,
      (deterministic(index, 53) - 0.5) * 0.12,
      Math.sin(angle) * radius,
    );
    quaternion.setFromEuler(
      new THREE.Euler(
        deterministic(index, 54) * Math.PI,
        deterministic(index, 55) * Math.PI,
        deterministic(index, 56) * Math.PI,
      ),
    );
    const size = 0.45 + deterministic(index, 57) * 1.25;
    scale.setScalar(size);
    matrix.compose(position, quaternion, scale);
    asteroidBelt.setMatrixAt(index, matrix);
  }
  asteroidBelt.instanceMatrix.needsUpdate = true;
  root.add(asteroidBelt);

  return {
    root,
    cameraWide: new THREE.Vector3(0, 6.3, 11.8),
    cameraNarrow: new THREE.Vector3(...SOLAR_CAMERA_NARROW),
    cameraCard: new THREE.Vector3(0, 13, 18),
    target: new THREE.Vector3(0, 0, 0),
    diagnostics: {
      bodyCount: SOLAR_SYSTEM_BODIES.length,
      maxOrbit: visualOrbitRadius(SOLAR_SYSTEM_BODIES.at(-1).orbitAu),
      scale: "non-linear-visualized",
    },
    update(time) {
      sun.rotation.y = time * 0.055;
      sunGlow.material.opacity = 0.72 + Math.sin(time * 1.15) * 0.06;
      asteroidBelt.rotation.y = time * 0.012;
      orbiters.forEach((orbiter, index) => {
        const angle = orbiter.body.phase + time * orbiter.speed;
        const position = positionOnVisualOrbit(orbiter.body, angle);
        orbiter.group.position.set(position.x, position.y, position.z);
        orbiter.mesh.rotation.y = time * (0.15 + index * 0.018);
        orbiter.group.userData.moonPivot &&
          (orbiter.group.userData.moonPivot.rotation.y = time * 0.72);
      });
    },
  };
}

function metallicMaterial(color, roughness = 0.22, emissive = 0x000000) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.86,
    roughness,
    clearcoat: 0.4,
    clearcoatRoughness: 0.24,
    emissive,
    emissiveIntensity: emissive ? 0.22 : 0,
  });
}

function buildPlanetaryGearbox() {
  if (!window.PlanetaryGearKit) {
    throw new Error("Validated PlanetaryGearKit failed to load.");
  }
  const root = new THREE.Group();
  const kit = window.PlanetaryGearKit.create(THREE, {
    sunTeeth: PLANETARY_GEAR_TEETH.sun,
    planetTeeth: PLANETARY_GEAR_TEETH.planet,
    ringTeeth: PLANETARY_GEAR_TEETH.ring,
    moduleScale: GEAR_MODULE_SCALE,
    centerDistance: PLANETARY_CENTER_DISTANCE,
    planetPhaseOffsets: PLANETARY_PHASE_OFFSETS,
    depth: 0.46,
    ringWall: 0.62,
    sunMaterial: metallicMaterial(0xff7b3a, 0.2, 0x4a1204),
    planetMaterial: metallicMaterial(0x75ddf7, 0.19, 0x052d39),
    ringMaterial: metallicMaterial(0x2f7692, 0.24, 0x051a24),
    carrierMaterial: metallicMaterial(0x78cce2, 0.2, 0x07313e),
  });
  root.add(kit.group);

  const centerDistance = (kit.config.sunTeeth + kit.config.planetTeeth) * 0.076;
  const carrierMaterial = metallicMaterial(0x6ebbd1, 0.24, 0x062a36);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.26, 48), carrierMaterial);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = -0.36;
  kit.carrier.add(hub);
  const carrierRing = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.12, 18, 96), carrierMaterial);
  carrierRing.position.z = -0.28;
  kit.carrier.add(carrierRing);
  for (let index = 0; index < kit.config.planetCount; index += 1) {
    const angle = (index / kit.config.planetCount) * Math.PI * 2;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(centerDistance, 0.22, 0.16),
      carrierMaterial,
    );
    arm.position.set(
      Math.cos(angle) * centerDistance * 0.5,
      Math.sin(angle) * centerDistance * 0.5,
      -0.3,
    );
    arm.rotation.z = angle;
    arm.castShadow = true;
    kit.carrier.add(arm);
    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.9, 28),
      metallicMaterial(0xc7d5da, 0.16),
    );
    axle.rotation.x = Math.PI / 2;
    axle.position.set(
      Math.cos(angle) * centerDistance,
      Math.sin(angle) * centerDistance,
      -0.08,
    );
    kit.carrier.add(axle);
  }

  const casing = new THREE.Mesh(
    new THREE.CylinderGeometry(3.92, 3.92, 0.8, 128, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: 0x3b7890,
      metalness: 0.36,
      roughness: 0.18,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      clearcoat: 0.5,
    }),
  );
  casing.rotation.x = Math.PI / 2;
  casing.position.z = -0.06;
  root.add(casing);

  const backPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(3.92, 3.92, 0.14, 128),
    new THREE.MeshStandardMaterial({
      color: 0x101a22,
      metalness: 0.58,
      roughness: 0.42,
    }),
  );
  backPlate.rotation.x = Math.PI / 2;
  backPlate.position.z = -0.57;
  backPlate.receiveShadow = true;
  root.add(backPlate);

  const shaftMaterial = metallicMaterial(0xd5e6eb, 0.14);
  const inputShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.8, 40), shaftMaterial);
  inputShaft.rotation.x = Math.PI / 2;
  inputShaft.position.z = 1.02;
  kit.sun.add(inputShaft);
  const outputShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 1.5, 40), shaftMaterial);
  outputShaft.rotation.x = Math.PI / 2;
  outputShaft.position.z = -1.0;
  kit.carrier.add(outputShaft);

  for (const z of [-0.72, 0.61]) {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.09, 16, 56),
      metallicMaterial(0x5a6670, 0.2),
    );
    bearing.position.z = z;
    root.add(bearing);
  }

  root.rotation.x = -0.16;
  return {
    root,
    cameraWide: new THREE.Vector3(1.8, 5.5, 13.8),
    cameraNarrow: new THREE.Vector3(1.2, 7.8, 16.2),
    cameraCard: new THREE.Vector3(1.2, 6.4, 13.8),
    target: new THREE.Vector3(0, 0, -0.05),
    diagnostics: {
      sunTeeth: kit.config.sunTeeth,
      planetTeeth: kit.config.planetTeeth,
      ringTeeth: kit.config.ringTeeth,
      ratioFixedRing: kit.kinematics.ratioFixedRing,
      source: "three.planetary-gear-kit",
    },
    update(time) {
      kit.renderFixedRingAt(time, 0.58);
    },
  };
}

function buildUniversalJoint() {
  if (!window.UniversalJointKit) {
    throw new Error("Validated UniversalJointKit failed to load.");
  }
  const root = new THREE.Group();
  const kit = window.UniversalJointKit.create(THREE, {
    shaftLength: 4.2,
    yokeSpan: 1.35,
  });
  for (const material of Object.values(kit.materials)) {
    if ("metalness" in material) material.metalness = Math.max(material.metalness, 0.72);
    if ("roughness" in material) material.roughness = Math.min(material.roughness, 0.24);
  }
  kit.crossCenter.geometry.scale(0.78, 0.78, 0.78);
  kit.materials.cup.color.set(0x587481);
  kit.materials.cup.emissive.set(0x07161d);
  kit.materials.cup.emissiveIntensity = 0.22;
  kit.materials.accent.color.set(0x385867);
  root.add(kit.group);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(7.8, 96),
    new THREE.MeshStandardMaterial({
      color: 0x070b11,
      metalness: 0.3,
      roughness: 0.86,
      transparent: true,
      opacity: 0.86,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.28;
  floor.receiveShadow = true;
  root.add(floor);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.3, 0.025, 10, 128),
    new THREE.MeshBasicMaterial({
      color: 0x72dfff,
      transparent: true,
      opacity: 0.18,
    }),
  );
  halo.rotation.y = Math.PI / 2;
  root.add(halo);

  const beta = THREE.MathUtils.degToRad(25);
  const operatingAnglePoints = [];
  for (let index = 0; index <= 48; index += 1) {
    const angle = (beta * index) / 48;
    operatingAnglePoints.push(
      new THREE.Vector3(Math.cos(angle) * 1.78, 0.38, Math.sin(angle) * 1.78),
    );
  }
  const operatingAngleArc = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(operatingAnglePoints),
    new THREE.LineBasicMaterial({
      color: 0xffd070,
      transparent: true,
      opacity: 0.88,
      depthTest: false,
    }),
  );
  operatingAngleArc.renderOrder = 4;
  root.add(operatingAngleArc);
  root.scale.setScalar(1.08);
  let lastState = kit.setState({ inputAngle: 0, beta, showAngle: 1 });
  root.rotation.set(0, 0, 0);
  return {
    root,
    cameraWide: new THREE.Vector3(0, 9.4, 8.6),
    cameraNarrow: new THREE.Vector3(0, 20, 20),
    cameraCard: new THREE.Vector3(0, 10.8, 10.2),
    target: new THREE.Vector3(0, 0, 0),
    diagnostics: {
      betaDeg: 25,
      source: "three.universal-joint-kit",
      get speedRatio() {
        return lastState.speedRatio;
      },
    },
    update(time) {
      lastState = kit.setState({
        inputAngle: time * 0.62,
        beta,
        explode: 0,
        macroHighlight: (Math.sin(time * 0.85) + 1) * 0.18,
        showAngle: 1,
      });
      halo.rotation.z = time * 0.08;
    },
  };
}

const builders = {
  solar: buildSolarSystem,
  gearbox: buildPlanetaryGearbox,
  joint: buildUniversalJoint,
};

const runtimeState = {
  elapsed: 0,
  lastTime: performance.now(),
  frame: 0,
};
const views = [];

function addSceneEnvironment(scene, modelRoot) {
  scene.fog = new THREE.FogExp2(0x02040a, 0.016);
  scene.add(modelRoot);
  scene.add(createStars(460, 20, 68, 0.055, 0.78));
  scene.add(createStars(80, 14, 42, 0.105, 0.46));

  const ambient = new THREE.HemisphereLight(0xb7d9ef, 0x120c18, 0.95);
  scene.add(ambient);
  const keyLight = new THREE.DirectionalLight(0xf5fbff, 3.4);
  keyLight.position.set(6, 9, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(768, 768);
  scene.add(keyLight);
  const purpleRim = new THREE.PointLight(0x9a35b1, 19, 28, 2);
  purpleRim.position.set(-6, 3, -4);
  scene.add(purpleRim);
  const cyanRim = new THREE.PointLight(0x78ddff, 15, 24, 2);
  cyanRim.position.set(6, -1, 5);
  scene.add(cyanRim);
}

function scheduleAnimation() {
  if (
    runtimeState.frame ||
    document.hidden ||
    reducedMotion.matches ||
    !views.some((view) => view.visible && !view.error)
  ) return;
  runtimeState.frame = window.requestAnimationFrame(animate);
}

function stopAnimation() {
  if (!runtimeState.frame) return;
  window.cancelAnimationFrame(runtimeState.frame);
  runtimeState.frame = 0;
}

function animate(time) {
  runtimeState.frame = 0;
  if (document.hidden || reducedMotion.matches) return;
  const delta = Math.min((time - runtimeState.lastTime) / 1000, 0.05);
  runtimeState.lastTime = time;
  runtimeState.elapsed += delta;
  for (const view of views) {
    if (!view.visible || view.error) continue;
    view.model.update(runtimeState.elapsed);
    view.render();
  }
  scheduleAnimation();
}

function createView(viewport) {
  const name = viewport.dataset.threeView;
  const builder = builders[name];
  const canvas = viewport.querySelector("[data-three-canvas]");
  const resetButton = viewport.querySelector("[data-reset-view]");
  if (!builder || !canvas) {
    throw new Error(`AgentV ${name || "unknown"} viewport markup is incomplete.`);
  }

  const state = {
    visible: false,
    error: false,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    startYaw: 0,
    startPitch: 0,
  };
  const pointer = { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 };
  const modelRoot = new THREE.Group();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 160);
  const cameraTarget = new THREE.Vector3();
  let renderer;
  let model;

  const showFallback = (message, error) => {
    state.error = true;
    viewport.classList.add("has-error");
    canvas.setAttribute("aria-hidden", "true");
    console.error(message, error);
  };

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    const compactDevice = window.matchMedia("(max-width: 640px)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compactDevice ? 1 : 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    addSceneEnvironment(scene, modelRoot);
    model = builder(renderer);
    modelRoot.add(model.root);
    camera.position.copy(model.cameraCard || model.cameraWide);
    cameraTarget.copy(model.target);
    camera.lookAt(cameraTarget);
    model.update(0);
  } catch (error) {
    showFallback(`AgentV could not initialize the ${name} view.`, error);
    renderer?.dispose?.();
    return { name, viewport, canvas, state, pointer, renderer, model, visible: false, error: true, render() {} };
  }

  const render = () => {
    if (state.error) return;
    pointer.yaw += (pointer.targetYaw - pointer.yaw) * 0.075;
    pointer.pitch += (pointer.targetPitch - pointer.pitch) * 0.075;
    modelRoot.rotation.y = pointer.yaw;
    modelRoot.rotation.x = pointer.pitch;
    renderer.render(scene, camera);
  };

  const resize = () => {
    if (state.error) return;
    const width = Math.max(viewport.clientWidth, 1);
    const height = Math.max(viewport.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camera.position.copy(model.cameraCard || model.cameraWide);
    camera.lookAt(cameraTarget);
    render();
  };

  const safeResize = () => {
    try {
      resize();
    } catch (error) {
      showFallback(`AgentV could not resize the ${name} view.`, error);
    }
  };

  const resetView = () => {
    pointer.targetYaw = 0;
    pointer.targetPitch = 0;
    if (reducedMotion.matches) {
      pointer.yaw = 0;
      pointer.pitch = 0;
      render();
    }
  };

  resetButton?.addEventListener("click", resetView);
  resetButton?.addEventListener("pointerdown", (event) => event.stopPropagation());
  viewport.addEventListener("dblclick", resetView);
  viewport.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.24 : 0.12;
    if (event.key === "Home") {
      event.preventDefault();
      resetView();
      return;
    }
    if (event.key === "ArrowLeft") pointer.targetYaw -= step;
    else if (event.key === "ArrowRight") pointer.targetYaw += step;
    else if (event.key === "ArrowUp") {
      pointer.targetPitch = THREE.MathUtils.clamp(pointer.targetPitch - step, -0.52, 0.52);
    } else if (event.key === "ArrowDown") {
      pointer.targetPitch = THREE.MathUtils.clamp(pointer.targetPitch + step, -0.52, 0.52);
    } else return;
    event.preventDefault();
    if (reducedMotion.matches) {
      pointer.yaw = pointer.targetYaw;
      pointer.pitch = pointer.targetPitch;
      render();
    }
  });

  viewport.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    state.dragStartX = event.clientX;
    state.dragStartY = event.clientY;
    state.startYaw = pointer.targetYaw;
    state.startPitch = pointer.targetPitch;
    viewport.setPointerCapture?.(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    pointer.targetYaw = state.startYaw + (event.clientX - state.dragStartX) * 0.0045;
    pointer.targetPitch = THREE.MathUtils.clamp(
      state.startPitch + (event.clientY - state.dragStartY) * 0.0035,
      -0.52,
      0.52,
    );
    if (reducedMotion.matches) {
      pointer.yaw = pointer.targetYaw;
      pointer.pitch = pointer.targetPitch;
      render();
    }
  });
  const endDrag = (event) => {
    state.dragging = false;
    viewport.releasePointerCapture?.(event.pointerId);
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    showFallback(`AgentV ${name} view lost its WebGL context.`, event);
  });

  const view = {
    name,
    viewport,
    canvas,
    state,
    pointer,
    renderer,
    model,
    get visible() { return state.visible; },
    get error() { return state.error; },
    render,
    resize: safeResize,
    resetView,
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        state.visible = entry.isIntersecting;
        if (state.visible) {
          runtimeState.lastTime = performance.now();
          render();
          scheduleAnimation();
        } else if (!views.some((item) => item.visible && !item.error)) {
          stopAnimation();
        }
      },
      { rootMargin: "160px 0px", threshold: 0.02 },
    );
    observer.observe(viewport);
  } else {
    state.visible = true;
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(safeResize).observe(viewport);
  } else {
    window.addEventListener("resize", safeResize, { passive: true });
  }

  safeResize();
  render();
  return view;
}

for (const viewport of viewports) {
  views.push(createView(viewport));
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAnimation();
  } else {
    runtimeState.lastTime = performance.now();
    for (const view of views) view.render();
    scheduleAnimation();
  }
});

reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) stopAnimation();
  for (const view of views) {
    if (view.error) continue;
    view.model.update(runtimeState.elapsed);
    view.render();
  }
  scheduleAnimation();
});

window.__agentVThreeLab = Object.freeze({
  resetView(name) {
    const view = views.find((item) => item.name === name);
    view?.resetView();
  },
  getDiagnostics() {
    return {
      layout: "responsive-grid",
      viewCount: views.length,
      elapsed: runtimeState.elapsed,
      reducedMotion: reducedMotion.matches,
      animationFrameScheduled: Boolean(runtimeState.frame),
      scenes: Object.fromEntries(
        views.map((view) => [
          view.name,
          {
            visible: view.visible,
            error: view.error,
            view: {
              yaw: view.pointer.yaw,
              pitch: view.pointer.pitch,
              targetYaw: view.pointer.targetYaw,
              targetPitch: view.pointer.targetPitch,
            },
            renderer: view.renderer?.capabilities.isWebGL2 ? "webgl2" : "webgl1",
            renderStats: view.renderer ? {
              calls: view.renderer.info.render.calls,
              triangles: view.renderer.info.render.triangles,
              lines: view.renderer.info.render.lines,
              points: view.renderer.info.render.points,
              geometries: view.renderer.info.memory.geometries,
              textures: view.renderer.info.memory.textures,
            } : null,
            model: view.model?.diagnostics || null,
          },
        ]),
      ),
    };
  },
});

runtimeState.lastTime = performance.now();
scheduleAnimation();

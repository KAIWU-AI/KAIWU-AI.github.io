import * as THREE from "./vendor/three.module.min.js";

const viewport = document.querySelector("[data-three-lab]");
const canvas = document.querySelector("#agentv-three-canvas");
const sceneTitle = document.querySelector("#lab-scene-title");
const sceneDescription = document.querySelector("#lab-scene-description");
const sceneTabs = [...document.querySelectorAll("[data-scene]")];

if (!viewport || !canvas || !sceneTitle || !sceneDescription) {
  throw new Error("AgentV 3D lab markup is incomplete.");
}

const sceneCopy = {
  solar: {
    title: "太阳系课堂 / Solar System",
    description:
      "观察行星轨道、尺度层级与空间关系，让宇宙知识从平面图示走向立体课堂。",
  },
  gearbox: {
    title: "行星齿轮箱 / Planetary Gearbox",
    description:
      "拆解太阳轮、行星轮与齿圈的协同运动，直观看见机械传动与速比关系。",
  },
  joint: {
    title: "万向节机构 / Universal Joint",
    description:
      "观察交叉轴如何在夹角变化中传递旋转，理解机械连接与运动约束。",
  },
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const modelRoot = new THREE.Group();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);
const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
const animationState = {
  activeScene: "solar",
  elapsed: 0,
  lastTime: 0,
  frame: 0,
  visible: false,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  startTargetX: 0,
  startTargetY: 0,
};

let renderer;
let activeModel;

try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
} catch (error) {
  viewport.classList.add("has-error");
  console.error("AgentV 3D lab could not initialize WebGL.", error);
}

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.fog = new THREE.FogExp2(0x03050a, 0.025);
  scene.add(modelRoot);

  const ambient = new THREE.HemisphereLight(0xcce8ff, 0x16051d, 1.35);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(5, 8, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);

  const purpleRim = new THREE.PointLight(0x9a35b1, 22, 24, 2);
  purpleRim.position.set(-5, 3, -2);
  scene.add(purpleRim);

  const cyanRim = new THREE.PointLight(0x78ddff, 15, 20, 2);
  cyanRim.position.set(5, -2, 4);
  scene.add(cyanRim);

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = [];
  for (let index = 0; index < 420; index += 1) {
    const radius = 18 + Math.random() * 38;
    const angle = Math.random() * Math.PI * 2;
    const elevation = (Math.random() - 0.5) * Math.PI;
    starPositions.push(
      Math.cos(angle) * Math.cos(elevation) * radius,
      Math.sin(elevation) * radius,
      Math.sin(angle) * Math.cos(elevation) * radius,
    );
  }
  starGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starPositions, 3),
  );
  const labStars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0xb48ac0,
      size: 0.065,
      transparent: true,
      opacity: 0.72,
      sizeAttenuation: true,
    }),
  );
  scene.add(labStars);

  function disposeObject(root) {
    root.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }

  function clearModel() {
    if (!activeModel) {
      return;
    }
    modelRoot.remove(activeModel.root);
    disposeObject(activeModel.root);
    activeModel = null;
  }

  function createOrbit(radius, color = 0x44616f, opacity = 0.38) {
    const points = [];
    for (let index = 0; index <= 128; index += 1) {
      const angle = (index / 128) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius,
        ),
      );
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    );
  }

  function buildSolarSystem() {
    const root = new THREE.Group();
    root.rotation.x = -0.12;
    const orbiters = [];

    const sunMaterial = new THREE.MeshStandardMaterial({
      color: 0xffc45b,
      emissive: 0xff6a18,
      emissiveIntensity: 3.5,
      roughness: 0.68,
    });
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.82, 64, 64),
      sunMaterial,
    );
    root.add(sun);

    const sunGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 40, 40),
      new THREE.MeshBasicMaterial({
        color: 0xff8b35,
        transparent: true,
        opacity: 0.09,
        side: THREE.BackSide,
      }),
    );
    root.add(sunGlow);

    const sunLight = new THREE.PointLight(0xffb45d, 46, 22, 1.55);
    root.add(sunLight);

    const planets = [
      { radius: 1.45, size: 0.13, color: 0x9b8b7a, speed: 1.45 },
      { radius: 2.05, size: 0.21, color: 0xd7a66f, speed: 1.08 },
      { radius: 2.75, size: 0.24, color: 0x3c83c8, speed: 0.84, earth: true },
      { radius: 3.42, size: 0.18, color: 0xc95f3d, speed: 0.67 },
      { radius: 4.38, size: 0.49, color: 0xc9a47e, speed: 0.42 },
      { radius: 5.55, size: 0.42, color: 0xd5be8f, speed: 0.31, rings: true },
    ];

    planets.forEach((planet, index) => {
      root.add(createOrbit(planet.radius));
      const pivot = new THREE.Group();
      const phase = index * 1.17;
      pivot.rotation.y = phase;

      const material = new THREE.MeshStandardMaterial({
        color: planet.color,
        roughness: planet.earth ? 0.55 : 0.78,
        metalness: 0.03,
      });
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(planet.size, 40, 40),
        material,
      );
      mesh.position.x = planet.radius;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);

      if (planet.earth) {
        const atmosphere = new THREE.Mesh(
          new THREE.SphereGeometry(planet.size * 1.08, 40, 40),
          new THREE.MeshBasicMaterial({
            color: 0x87dfff,
            transparent: true,
            opacity: 0.12,
            side: THREE.BackSide,
          }),
        );
        atmosphere.position.copy(mesh.position);
        pivot.add(atmosphere);

        const moonPivot = new THREE.Group();
        moonPivot.position.copy(mesh.position);
        const moon = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 20, 20),
          new THREE.MeshStandardMaterial({ color: 0xb9bcc4, roughness: 1 }),
        );
        moon.position.x = 0.42;
        moonPivot.add(moon);
        pivot.add(moonPivot);
        orbiters.push({
          pivot: moonPivot,
          speed: 2.5,
          mesh: moon,
          phase: 0,
        });
      }

      if (planet.rings) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(planet.size * 1.25, planet.size * 2.05, 96),
          new THREE.MeshStandardMaterial({
            color: 0xbca779,
            transparent: true,
            opacity: 0.72,
            side: THREE.DoubleSide,
            roughness: 0.8,
          }),
        );
        ring.position.copy(mesh.position);
        ring.rotation.x = Math.PI / 2.45;
        pivot.add(ring);
      }

      root.add(pivot);
      orbiters.push({ pivot, speed: planet.speed, mesh, phase });
    });

    camera.position.set(0, 6.8, 10.8);
    camera.lookAt(0, 0, 0);

    return {
      root,
      update(time) {
        sun.rotation.y = time * 0.08;
        sunGlow.scale.setScalar(1 + Math.sin(time * 1.4) * 0.03);
        orbiters.forEach((orbiter, index) => {
          orbiter.pivot.rotation.y =
            orbiter.phase + time * 0.1 * orbiter.speed;
          orbiter.mesh.rotation.y = time * (0.16 + index * 0.025);
        });
      },
    };
  }

  function createGear(teeth, rootRadius, toothDepth, thickness, color) {
    const shape = new THREE.Shape();
    const segments = teeth * 4;
    for (let index = 0; index <= segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      const toothPhase = index % 4;
      const radius =
        toothPhase === 1 || toothPhase === 2
          ? rootRadius + toothDepth
          : rootRadius;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }

    const hole = new THREE.Path();
    hole.absarc(0, 0, rootRadius * 0.28, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      curveSegments: 8,
    });
    geometry.center();

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.86,
        roughness: 0.27,
        clearcoat: 0.35,
        clearcoatRoughness: 0.25,
      }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function buildPlanetaryGearbox() {
    const root = new THREE.Group();
    root.rotation.x = -0.35;
    const carrier = new THREE.Group();
    root.add(carrier);

    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(4.35, 4.35, 0.16, 96),
      new THREE.MeshPhysicalMaterial({
        color: 0x1b2430,
        metalness: 0.72,
        roughness: 0.32,
        transparent: true,
        opacity: 0.58,
      }),
    );
    plate.rotation.x = Math.PI / 2;
    plate.position.z = -0.38;
    plate.receiveShadow = true;
    root.add(plate);

    const sun = createGear(18, 0.94, 0.2, 0.52, 0x8ee7ff);
    root.add(sun);

    const planets = [];
    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * Math.PI * 2;
      const gear = createGear(14, 0.72, 0.18, 0.46, 0xb16ac0);
      gear.position.set(Math.cos(angle) * 2.15, Math.sin(angle) * 2.15, 0);
      carrier.add(gear);
      planets.push(gear);

      const axle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 0.82, 24),
        new THREE.MeshStandardMaterial({
          color: 0xdde8ef,
          metalness: 0.9,
          roughness: 0.2,
        }),
      );
      axle.rotation.x = Math.PI / 2;
      axle.position.copy(gear.position);
      carrier.add(axle);
    }

    const ring = new THREE.Group();
    const ringBody = new THREE.Mesh(
      new THREE.TorusGeometry(3.55, 0.34, 20, 120),
      new THREE.MeshPhysicalMaterial({
        color: 0x71567b,
        metalness: 0.82,
        roughness: 0.3,
        clearcoat: 0.25,
      }),
    );
    ring.add(ringBody);

    for (let index = 0; index < 42; index += 1) {
      const angle = (index / 42) * Math.PI * 2;
      const tooth = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.42, 0.5),
        new THREE.MeshStandardMaterial({
          color: 0x9674a0,
          metalness: 0.82,
          roughness: 0.28,
        }),
      );
      tooth.position.set(Math.cos(angle) * 3.2, Math.sin(angle) * 3.2, 0);
      tooth.rotation.z = angle;
      tooth.castShadow = true;
      ring.add(tooth);
    }
    root.add(ring);

    const centerShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 1.3, 32),
      new THREE.MeshStandardMaterial({
        color: 0xe6f6ff,
        metalness: 0.95,
        roughness: 0.18,
      }),
    );
    centerShaft.rotation.x = Math.PI / 2;
    root.add(centerShaft);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(7, 96),
      new THREE.MeshStandardMaterial({
        color: 0x090d14,
        roughness: 1,
        transparent: true,
        opacity: 0.82,
      }),
    );
    floor.position.z = -0.58;
    floor.receiveShadow = true;
    root.add(floor);

    camera.position.set(0, 4.8, 10.8);
    camera.lookAt(0, 0, 0);

    return {
      root,
      update(time) {
        sun.rotation.z = time * 0.66;
        carrier.rotation.z = -time * 0.16;
        planets.forEach((gear) => {
          gear.rotation.z = -time * 0.94;
        });
        ring.rotation.z = time * 0.04;
      },
    };
  }

  function metallicMaterial(color) {
    return new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.9,
      roughness: 0.23,
      clearcoat: 0.35,
      clearcoatRoughness: 0.22,
    });
  }

  function createYoke(color) {
    const yoke = new THREE.Group();
    const material = metallicMaterial(color);
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 2.3, 0.55),
      material,
    );
    bridge.castShadow = true;
    yoke.add(bridge);

    for (const direction of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.42, 0.55),
        material,
      );
      arm.position.set(0.52, direction * 0.94, 0);
      arm.castShadow = true;
      yoke.add(arm);
    }
    return yoke;
  }

  function buildUniversalJoint() {
    const root = new THREE.Group();
    root.rotation.set(-0.2, -0.35, 0);

    const input = new THREE.Group();
    const inputShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 4.6, 40),
      metallicMaterial(0x8ee7ff),
    );
    inputShaft.rotation.z = Math.PI / 2;
    inputShaft.position.x = -3.35;
    inputShaft.castShadow = true;
    input.add(inputShaft);
    const inputYoke = createYoke(0x79cce8);
    inputYoke.position.x = -0.9;
    input.add(inputYoke);
    root.add(input);

    const outputPivot = new THREE.Group();
    outputPivot.rotation.y = -0.48;
    const outputShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 4.6, 40),
      metallicMaterial(0xa75dbc),
    );
    outputShaft.rotation.z = Math.PI / 2;
    outputShaft.position.x = 3.35;
    outputShaft.castShadow = true;
    outputPivot.add(outputShaft);
    const outputYoke = createYoke(0xa75dbc);
    outputYoke.position.x = 0.9;
    outputYoke.rotation.x = Math.PI / 2;
    outputPivot.add(outputYoke);
    root.add(outputPivot);

    const cross = new THREE.Group();
    const crossMaterial = metallicMaterial(0xe3d3e8);
    const horizontalPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 2.35, 32),
      crossMaterial,
    );
    horizontalPin.rotation.z = Math.PI / 2;
    horizontalPin.castShadow = true;
    cross.add(horizontalPin);

    const verticalPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 2.35, 32),
      crossMaterial,
    );
    verticalPin.castShadow = true;
    cross.add(verticalPin);

    const hub = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 40, 40),
      metallicMaterial(0xf2ebf5),
    );
    hub.castShadow = true;
    cross.add(hub);
    root.add(cross);

    const support = new THREE.Mesh(
      new THREE.CylinderGeometry(4.9, 4.9, 0.18, 96),
      new THREE.MeshStandardMaterial({
        color: 0x101620,
        metalness: 0.45,
        roughness: 0.65,
        transparent: true,
        opacity: 0.72,
      }),
    );
    support.rotation.x = Math.PI / 2;
    support.position.y = -2.3;
    support.receiveShadow = true;
    root.add(support);

    camera.position.set(0, 3.8, 11.8);
    camera.lookAt(0, 0, 0);

    return {
      root,
      update(time) {
        input.rotation.x = time * 0.58;
        outputPivot.rotation.x = time * 0.53;
        cross.rotation.x = time * 0.55;
        cross.rotation.y = Math.sin(time * 0.55) * 0.22;
      },
    };
  }

  const builders = {
    solar: buildSolarSystem,
    gearbox: buildPlanetaryGearbox,
    joint: buildUniversalJoint,
  };

  function setScene(name) {
    const builder = builders[name];
    const copy = sceneCopy[name];
    if (!builder || !copy) {
      return;
    }

    clearModel();
    animationState.activeScene = name;
    animationState.elapsed = 0;
    pointer.targetX = 0;
    pointer.targetY = 0;
    activeModel = builder();
    modelRoot.add(activeModel.root);
    sceneTitle.textContent = copy.title;
    sceneDescription.textContent = copy.description;

    sceneTabs.forEach((tab) => {
      const selected = tab.dataset.scene === name;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-pressed", String(selected));
    });

    render();
  }

  function resize() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  }

  function render() {
    if (!activeModel) {
      return;
    }
    activeModel.root.rotation.y +=
      (pointer.targetX - activeModel.root.rotation.y) * 0.045;
    activeModel.root.rotation.x +=
      (pointer.targetY - activeModel.root.rotation.x) * 0.045;
    renderer.render(scene, camera);
  }

  function animate(time) {
    animationState.frame = window.requestAnimationFrame(animate);
    if (!animationState.visible || document.hidden) {
      animationState.lastTime = time;
      return;
    }

    const delta = Math.min((time - animationState.lastTime) / 1000, 0.05);
    animationState.lastTime = time;
    if (!reducedMotion.matches) {
      animationState.elapsed += delta;
      activeModel?.update(animationState.elapsed);
    }
    render();
  }

  sceneTabs.forEach((tab) => {
    tab.addEventListener("click", () => setScene(tab.dataset.scene));
  });

  viewport.addEventListener("pointerdown", (event) => {
    animationState.dragging = true;
    animationState.dragStartX = event.clientX;
    animationState.dragStartY = event.clientY;
    animationState.startTargetX = pointer.targetX;
    animationState.startTargetY = pointer.targetY;
    viewport.setPointerCapture?.(event.pointerId);
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!animationState.dragging) {
      return;
    }
    pointer.targetX =
      animationState.startTargetX +
      (event.clientX - animationState.dragStartX) * 0.005;
    pointer.targetY = THREE.MathUtils.clamp(
      animationState.startTargetY +
        (event.clientY - animationState.dragStartY) * 0.0035,
      -0.8,
      0.8,
    );
  });

  const endDrag = (event) => {
    animationState.dragging = false;
    viewport.releasePointerCapture?.(event.pointerId);
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);

  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      animationState.visible = entry.isIntersecting;
      if (entry.isIntersecting) {
        animationState.lastTime = performance.now();
        render();
      }
    },
    { rootMargin: "120px 0px", threshold: 0.02 },
  );
  visibilityObserver.observe(viewport);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewport);
  reducedMotion.addEventListener("change", render);

  setScene("solar");
  resize();
  animationState.frame = window.requestAnimationFrame(animate);
}

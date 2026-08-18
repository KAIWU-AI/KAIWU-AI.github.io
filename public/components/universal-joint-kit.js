/* Procedural, seek-safe universal-joint teaching kit. Educational geometry, not manufacturing CAD. */
(function attachUniversalJointKit(global) {
  "use strict";
  const TAU = Math.PI * 2;
  const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

  function validate(config = {}) {
    const shaftLength = Number(config.shaftLength ?? 3.4);
    const yokeSpan = Number(config.yokeSpan ?? 1.24);
    if (!(shaftLength > 1)) throw new Error("UniversalJointKit shaftLength must be > 1");
    if (!(yokeSpan > 0.7)) throw new Error("UniversalJointKit yokeSpan must be > 0.7");
    return Object.freeze({ shaftLength, yokeSpan });
  }

  function orientFromY(THREE, object, direction) {
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  }

  function orientFromX(THREE, object, direction) {
    object.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.clone().normalize());
  }

  function continuousOutputAngle(alpha, beta) {
    const wrapped = Math.atan2(Math.sin(alpha) * Math.cos(beta), Math.cos(alpha));
    const turns = Math.round((alpha - wrapped) / TAU);
    return wrapped + turns * TAU;
  }

  function speedRatio(alpha, beta) {
    return Math.cos(beta) / (1 - Math.sin(beta) ** 2 * Math.sin(alpha) ** 2);
  }

  function makeYoke(THREE, material, accentMaterial, config) {
    const group = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.72, 48), material);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.10, 16, 64), accentMaterial);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.30, config.shaftLength, 40), material);
    const armGeometry = new THREE.BoxGeometry(1.08, 0.25, 0.32, 2, 1, 1);
    const arms = [new THREE.Mesh(armGeometry, material), new THREE.Mesh(armGeometry, material)];
    const earGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.34, 40);
    const ears = [new THREE.Mesh(earGeometry, accentMaterial), new THREE.Mesh(earGeometry, accentMaterial)];
    group.add(hub, collar, shaft, ...arms, ...ears);
    return { group, hub, collar, shaft, arms, ears };
  }

  function updateYoke(THREE, yoke, axis, trunnion, side, explode, span) {
    const sign = side < 0 ? -1 : 1;
    const shift = axis.clone().multiplyScalar(sign * explode * 0.65);
    const hubCenter = axis.clone().multiplyScalar(sign * 0.94).add(shift);
    yoke.hub.position.copy(hubCenter);
    orientFromY(THREE, yoke.hub, axis);
    yoke.collar.position.copy(hubCenter.clone().add(axis.clone().multiplyScalar(-sign * 0.31)));
    yoke.collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize());
    yoke.shaft.position.copy(axis.clone().multiplyScalar(sign * 2.48).add(shift));
    orientFromY(THREE, yoke.shaft, axis);
    for (let i = 0; i < 2; i += 1) {
      const s = i === 0 ? -1 : 1;
      yoke.arms[i].position.copy(axis.clone().multiplyScalar(sign * 0.49).add(trunnion.clone().multiplyScalar(s * span / 2)).add(shift));
      orientFromX(THREE, yoke.arms[i], axis);
      yoke.ears[i].position.copy(trunnion.clone().multiplyScalar(s * (span / 2 + 0.02)).add(shift));
      orientFromY(THREE, yoke.ears[i], trunnion);
    }
  }

  function create(THREE, rawConfig = {}) {
    if (!THREE) throw new Error("UniversalJointKit requires THREE");
    const config = validate(rawConfig);
    const group = new THREE.Group();
    group.name = "universal-joint-kit";
    const materials = {
      input: new THREE.MeshStandardMaterial({ color: 0xff8b43, emissive: 0x5b1c00, emissiveIntensity: 0.42, roughness: 0.28, metalness: 0.62 }),
      output: new THREE.MeshStandardMaterial({ color: 0x49d5ff, emissive: 0x063c50, emissiveIntensity: 0.52, roughness: 0.22, metalness: 0.62 }),
      cross: new THREE.MeshStandardMaterial({ color: 0xb6a1ff, emissive: 0x201050, emissiveIntensity: 0.42, roughness: 0.24, metalness: 0.58 }),
      cup: new THREE.MeshStandardMaterial({ color: 0x274958, roughness: 0.30, metalness: 0.76 }),
      accent: new THREE.MeshStandardMaterial({ color: 0x274958, roughness: 0.30, metalness: 0.76 }),
      ghost: new THREE.MeshBasicMaterial({ color: 0x4ecdf1, transparent: true, opacity: 0.16, wireframe: true }),
      inputLine: new THREE.LineBasicMaterial({ color: 0xff9b59, transparent: true, opacity: 0.86 }),
      outputLine: new THREE.LineBasicMaterial({ color: 0x69dcff, transparent: true, opacity: 0.62 }),
    };
    const inputYoke = makeYoke(THREE, materials.input, materials.accent, config);
    const outputYoke = makeYoke(THREE, materials.output, materials.accent, config);
    group.add(inputYoke.group, outputYoke.group);
    const crossCenter = new THREE.Mesh(new THREE.SphereGeometry(0.34, 40, 24), materials.cross);
    const crossA = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.55, 32), materials.cross);
    const crossB = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.55, 32), materials.cross);
    group.add(crossCenter, crossA, crossB);
    const cups = Array.from({ length: 4 }, () => new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.42, 40), materials.cup));
    group.add(...cups);
    const inputAxisLine = new THREE.Line(new THREE.BufferGeometry(), materials.inputLine);
    const outputAxisLine = new THREE.Line(new THREE.BufferGeometry(), materials.outputLine);
    const angleArc = new THREE.Line(new THREE.BufferGeometry(), materials.outputLine);
    inputAxisLine.geometry.setFromPoints([new THREE.Vector3(-4.5, 0, 0), new THREE.Vector3(0, 0, 0)]);
    group.add(inputAxisLine, outputAxisLine, angleArc);
    const referenceRing = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.015, 8, 96), materials.ghost);
    referenceRing.rotation.y = Math.PI / 2;
    group.add(referenceRing);
    const anchors = { inputYoke: new THREE.Object3D(), outputYoke: new THREE.Object3D(), journalCross: crossCenter, bearingCup: cups[0], inputShaft: inputYoke.shaft, outputShaft: outputYoke.shaft };
    group.add(anchors.inputYoke, anchors.outputYoke);

    function setState(state = {}) {
      const inputAngle = Number(state.inputAngle || 0);
      const beta = Math.max(0, Math.min(Math.PI / 3, Number(state.beta || 0)));
      const explode = clamp01(state.explode || 0);
      const macroHighlight = clamp01(state.macroHighlight || 0);
      const axis1 = new THREE.Vector3(1, 0, 0);
      const axis2 = new THREE.Vector3(Math.cos(beta), 0, Math.sin(beta));
      const u = new THREE.Vector3(0, Math.cos(inputAngle), Math.sin(inputAngle)).normalize();
      const v = new THREE.Vector3().crossVectors(axis2, u).normalize();
      updateYoke(THREE, inputYoke, axis1, u, -1, explode, config.yokeSpan);
      updateYoke(THREE, outputYoke, axis2, v, 1, explode, config.yokeSpan);
      crossA.position.set(0, 0, 0); crossB.position.set(0, 0, 0);
      orientFromY(THREE, crossA, u); orientFromY(THREE, crossB, v);
      crossCenter.scale.setScalar(1 + 0.07 * macroHighlight);
      const cupAxes = [u, u.clone().multiplyScalar(-1), v, v.clone().multiplyScalar(-1)];
      cups.forEach((cup, index) => {
        const along = index < 2 ? u : v;
        cup.position.copy(cupAxes[index].clone().multiplyScalar(0.76 + explode * (0.86 + index * 0.08)));
        orientFromY(THREE, cup, along);
        cup.material = macroHighlight > 0.01 && index === 0 ? materials.cross : materials.cup;
        cup.scale.setScalar(macroHighlight > 0.01 && index === 0 ? 1.12 : 1);
        if (index % 2 === 1) cup.rotateX(Math.PI);
      });
      outputAxisLine.geometry.setFromPoints([new THREE.Vector3(0, 0, 0), axis2.clone().multiplyScalar(4.5)]);
      const arc = [];
      for (let i = 0; i <= 32; i += 1) {
        const a = beta * i / 32;
        arc.push(new THREE.Vector3(Math.cos(a) * 1.45, 0, Math.sin(a) * 1.45));
      }
      angleArc.geometry.setFromPoints(arc);
      angleArc.material.opacity = Number(state.showAngle || 0) > 0.5 ? 0.92 : 0.35;
      referenceRing.material.opacity = 0.10 + macroHighlight * 0.20;
      anchors.inputYoke.position.copy(axis1.clone().multiplyScalar(-0.8));
      anchors.outputYoke.position.copy(axis2.clone().multiplyScalar(0.8));
      return Object.freeze({ inputAngle, outputAngle: continuousOutputAngle(inputAngle, beta), beta, speedRatio: speedRatio(inputAngle, beta), axis1, axis2, u, v, explode });
    }

    setState({ inputAngle: 0, beta: 0 });
    return Object.freeze({ group, inputYoke, outputYoke, crossCenter, crossA, crossB, cups, anchors, materials, inputAxisLine, outputAxisLine, angleArc, referenceRing, setState, config });
  }

  global.UniversalJointKit = Object.freeze({ validate, create, continuousOutputAngle, speedRatio });
})(window);

(() => {
  "use strict";

  const host = document.querySelector(".stars");
  if (!host) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.className = "starfield-canvas";
  host.appendChild(canvas);

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const palette = [
    [102, 8, 116],
    [102, 8, 116],
    [139, 52, 153],
    [174, 92, 189],
    [218, 164, 229],
    [248, 230, 252],
  ];
  const depthNear = 0.16;
  const depthFar = 1.25;
  const focalBase = { x: 0.72, y: 0.24 };
  const initializedAt = performance.now();

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let focalX = 0;
  let focalY = 0;
  let targetOffsetX = 0;
  let targetOffsetY = 0;
  let offsetX = 0;
  let offsetY = 0;
  let particles = [];
  let animationFrame = 0;
  let previousTime = 0;
  let resizeTimer = 0;
  let firstPaintAt = 0;

  const random = (minimum, maximum) =>
    Math.random() * (maximum - minimum) + minimum;

  const particleCount = () => {
    const areaScale = Math.min((width * height) / 7600, 180);
    return Math.max(96, Math.round(areaScale));
  };

  const createParticle = (atFarDepth = true) => ({
    x: random(-0.92, 0.92),
    y: random(-0.72, 0.72),
    z: atFarDepth ? random(0.9, depthFar) : random(depthNear, depthFar),
    size: random(0.45, 1.25),
    speed: random(0.95, 1.65),
    color: palette[Math.floor(Math.random() * palette.length)],
  });

  const project = (particle) => {
    const scale = Math.min(width, height) * 0.69;
    return {
      x: focalX + offsetX + (particle.x / particle.z) * scale,
      y: focalY + offsetY + (particle.y / particle.z) * scale,
    };
  };

  const resize = () => {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    focalX = width * focalBase.x;
    focalY = height * focalBase.y;

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    particles = Array.from({ length: particleCount() }, () =>
      createParticle(false),
    );
  };

  const paintParticle = (particle, previous, current) => {
    const proximity = 1 - (particle.z - depthNear) / (depthFar - depthNear);
    const alpha = 0.2 + proximity * 0.67;
    const [red, green, blue] = particle.color;
    const movementX = current.x - previous.x;
    const movementY = current.y - previous.y;
    const movementLength = Math.hypot(movementX, movementY);
    const radialX = current.x - focalX - offsetX;
    const radialY = current.y - focalY - offsetY;
    const radialLength = Math.max(Math.hypot(radialX, radialY), 1);
    const directionX =
      movementLength > 0.02 ? movementX / movementLength : radialX / radialLength;
    const directionY =
      movementLength > 0.02 ? movementY / movementLength : radialY / radialLength;
    const trailLength = 7 + proximity * 48 + particle.speed * 4;
    const tailX = current.x - directionX * trailLength;
    const tailY = current.y - directionY * trailLength;
    const trailGradient = context.createLinearGradient(
      tailX,
      tailY,
      current.x,
      current.y,
    );
    trailGradient.addColorStop(0, `rgba(${red}, ${green}, ${blue}, 0)`);
    trailGradient.addColorStop(
      0.42,
      `rgba(${red}, ${green}, ${blue}, ${alpha * 0.24})`,
    );
    trailGradient.addColorStop(
      1,
      `rgba(${red}, ${green}, ${blue}, ${alpha})`,
    );

    context.save();
    context.shadowColor = `rgba(${red}, ${green}, ${blue}, ${alpha * 0.8})`;
    context.shadowBlur = 3 + proximity * 8;
    context.strokeStyle = trailGradient;
    context.lineWidth = particle.size * (0.75 + proximity * 1.25);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(tailX, tailY);
    context.lineTo(current.x, current.y);
    context.stroke();

    context.shadowBlur = 5 + proximity * 11;
    context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${Math.min(alpha + 0.2, 1)})`;
    context.beginPath();
    context.arc(
      current.x,
      current.y,
      particle.size * (0.65 + proximity * 0.9),
      0,
      Math.PI * 2,
    );
    context.fill();
    context.restore();
  };

  const drawStaticField = () => {
    context.clearRect(0, 0, width, height);
    for (const particle of particles) {
      const point = project(particle);
      paintParticle(particle, point, point);
    }
    if (!firstPaintAt) firstPaintAt = performance.now();
  };

  const animate = (time) => {
    animationFrame = window.requestAnimationFrame(animate);
    if (!previousTime) {
      previousTime = time;
    }

    const elapsed = Math.min(time - previousTime, 40);
    previousTime = time;
    offsetX += (targetOffsetX - offsetX) * 0.025;
    offsetY += (targetOffsetY - offsetY) * 0.025;
    context.clearRect(0, 0, width, height);

    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      const previous = project(particle);

      particle.z -= elapsed * 0.00013 * particle.speed;
      const turn = elapsed * 0.0000028;
      const oldX = particle.x;
      particle.x = oldX * Math.cos(turn) - particle.y * Math.sin(turn);
      particle.y = oldX * Math.sin(turn) + particle.y * Math.cos(turn);

      const current = project(particle);
      const outside =
        current.x < -40 ||
        current.x > width + 40 ||
        current.y < -40 ||
        current.y > height + 40;

      if (particle.z <= depthNear || outside) {
        particles[index] = createParticle();
        continue;
      }

      paintParticle(particle, previous, current);
    }
  };

  const stop = () => {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  };

  const start = () => {
    stop();
    previousTime = 0;
    drawStaticField();
    if (reducedMotion.matches) {
      return;
    } else {
      animationFrame = window.requestAnimationFrame(animate);
    }
  };

  window.addEventListener(
    "pointermove",
    (event) => {
      targetOffsetX = (event.clientX / width - 0.5) * 18;
      targetOffsetY = (event.clientY / height - 0.5) * 12;
    },
    { passive: true },
  );

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resize();
      start();
    }, 160);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });

  reducedMotion.addEventListener("change", start);
  resize();
  start();
  window.__agentVStarfield = Object.freeze({
    getDiagnostics() {
      return {
        particleCount: particles.length,
        firstPaintMs: firstPaintAt - initializedAt,
        animationFrameScheduled: Boolean(animationFrame),
        reducedMotion: reducedMotion.matches,
      };
    },
  });
})();

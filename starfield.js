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
    [142, 231, 255],
    [142, 231, 255],
    [198, 225, 255],
    [255, 255, 255],
    [108, 156, 255],
  ];
  const depthNear = 0.16;
  const depthFar = 1.25;
  const focalBase = { x: 0.72, y: 0.24 };

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

  const random = (minimum, maximum) =>
    Math.random() * (maximum - minimum) + minimum;

  const particleCount = () => {
    const areaScale = Math.min((width * height) / 13000, 96);
    return Math.max(48, Math.round(areaScale));
  };

  const createParticle = (atFarDepth = true) => ({
    x: random(-0.92, 0.92),
    y: random(-0.72, 0.72),
    z: atFarDepth ? random(0.9, depthFar) : random(depthNear, depthFar),
    size: random(0.45, 1.25),
    speed: random(0.72, 1.18),
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
    const alpha = 0.08 + proximity * 0.48;
    const [red, green, blue] = particle.color;

    context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    context.lineWidth = particle.size * (0.45 + proximity * 0.65);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(current.x, current.y);
    context.stroke();

    context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${Math.min(alpha + 0.16, 0.72)})`;
    context.beginPath();
    context.arc(
      current.x,
      current.y,
      particle.size * (0.4 + proximity * 0.7),
      0,
      Math.PI * 2,
    );
    context.fill();
  };

  const drawStaticField = () => {
    context.clearRect(0, 0, width, height);
    for (const particle of particles) {
      const point = project(particle);
      paintParticle(particle, point, point);
    }
  };

  const animate = (time) => {
    animationFrame = window.requestAnimationFrame(animate);
    if (!previousTime) {
      previousTime = time;
      return;
    }

    const elapsed = Math.min(time - previousTime, 40);
    previousTime = time;
    offsetX += (targetOffsetX - offsetX) * 0.025;
    offsetY += (targetOffsetY - offsetY) * 0.025;
    context.clearRect(0, 0, width, height);

    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      const previous = project(particle);

      particle.z -= elapsed * 0.000055 * particle.speed;
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
    if (reducedMotion.matches) {
      drawStaticField();
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
})();

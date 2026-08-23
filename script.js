const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
const year = document.querySelector("#current-year");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (year) {
  year.textContent = new Date().getFullYear().toString();
}

if (navToggle && navLinks) {
  const closeMenu = () => {
    navToggle.setAttribute("aria-expanded", "false");
    navLinks.classList.remove("is-open");
  };

  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    navLinks.classList.toggle("is-open", !isOpen);
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
      navToggle.focus();
    }
  });
}

const revealTargets = document.querySelectorAll(
  ".workflow-visual, .statement-copy, .section-heading, .direction-card, .project-panel, .cta",
);

const scrollVideos = document.querySelectorAll("[data-scroll-video]");

scrollVideos.forEach((video) => {
  const card = video.closest("[data-scroll-video-card]");
  if (!card) {
    return;
  }

  video.muted = true;
  video.defaultMuted = true;

  const startAt = Number.parseFloat(video.dataset.startAt || "0");
  const seekToStart = () => {
    if (Number.isFinite(startAt) && video.duration > startAt) {
      video.currentTime = startAt;
    }
  };

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    seekToStart();
  } else {
    video.addEventListener("loadedmetadata", seekToStart, { once: true });
  }

  if (reducedMotion.matches) {
    video.pause();
    card.classList.add("is-video-active");
    return;
  }

  const playVideo = () => {
    card.classList.add("is-video-active");
    video.play().catch(() => {
      // Muted autoplay can still be blocked by browser policy; the poster remains visible.
    });
  };

  if (!("IntersectionObserver" in window)) {
    video.pause();
    card.classList.add("is-video-active");
    return;
  }

  const videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          playVideo();
          return;
        }

        video.pause();
        card.classList.remove("is-video-active");
      });
    },
    { threshold: 0.35 },
  );

  videoObserver.observe(card);
});

if (reducedMotion.matches || !("IntersectionObserver" in window)) {
  revealTargets.forEach((target) => target.classList.add("is-visible"));
} else {
  document.documentElement.classList.add("motion-ready");
  revealTargets.forEach((target) => target.classList.add("reveal-item"));

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.12,
    },
  );

  revealTargets.forEach((target) => revealObserver.observe(target));
}

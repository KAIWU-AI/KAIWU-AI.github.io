(() => {
  "use strict";

  const lab = document.querySelector("#lab");
  if (!lab) return;

  let state = "waiting";
  let modulePromise = null;

  const setState = (nextState) => {
    state = nextState;
    lab.dataset.threeLabState = nextState;
  };

  const showFallback = (error) => {
    setState("error");
    document.querySelectorAll("[data-three-view]").forEach((viewport) => {
      viewport.classList.add("has-error");
    });
    console.error("MindMotion 3D lab module failed to load.", error);
  };

  const loadLab = () => {
    if (modulePromise) return modulePromise;
    setState("loading");
    modulePromise = import("./three-lab.js")
      .then((module) => {
        setState("ready");
        return module;
      })
      .catch((error) => {
        showFallback(error);
        throw error;
      });
    return modulePromise;
  };

  setState("waiting");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(lab);
        loadLab().catch(() => {});
      },
      { rootMargin: "0px", threshold: 0.01 },
    );
    observer.observe(lab);
  } else {
    const schedule = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 1));
    schedule(() => loadLab().catch(() => {}), { timeout: 2000 });
  }

  window.__mindMotionThreeLabLoader = Object.freeze({
    load: loadLab,
    getDiagnostics() {
      return { state, requested: Boolean(modulePromise) };
    },
  });
})();

(function () {
  'use strict';
  var state = window.__kaiwuArchifyBridge;
  var id = document.documentElement.getAttribute('data-archify-id');
  var ready = false;
  var suspended = false;

  function nativeApi() {
    var api = window.Archify;
    if (!state || state.failed || !state.nativeComplete || !api) return null;
    if (!api.motionGovernor || typeof api.motionGovernor.setMode !== 'function') return null;
    if (!api.guidedViews || !Number.isInteger(api.guidedViews.count)) return null;
    if (api.guidedViews.count > 0 && ['pause', 'clearPreview', 'settleHandoff', 'isPlaying'].some(function (name) {
      return typeof api.guidedViews[name] !== 'function';
    })) return null;
    if (!api.routeProbe || typeof api.routeProbe.pauseJourney !== 'function') return null;
    if (!api.view || typeof api.view.reset !== 'function' || !api.theme || typeof api.theme.toggle !== 'function') return null;
    return api;
  }

  function stop(reason) {
    var api = nativeApi();
    if (!api) return false;
    api.motionGovernor.setMode('still', { persist: false });
    if (api.guidedViews.count > 0) {
      api.guidedViews.pause();
      api.guidedViews.clearPreview();
      api.guidedViews.settleHandoff(reason);
    }
    api.routeProbe.pauseJourney({ preserveElapsed: true, reason: reason });
    return true;
  }

  function diagramMeasured() {
    var svg = document.querySelector('.diagram-container svg');
    if (!svg || !svg.viewBox || !svg.viewBox.baseVal) return false;
    try {
      var viewBox = svg.viewBox.baseVal;
      var geometry = svg.getBBox();
      var bounds = svg.getBoundingClientRect();
      return [viewBox.width, viewBox.height, geometry.width, geometry.height, bounds.width, bounds.height]
        .every(function (value) { return Number.isFinite(value) && value > 0; });
    } catch (_) { return false; }
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent || !event.data || event.data.type !== 'archify:suspend' || event.data.id !== id) return;
    suspended = true;
    stop('parent');
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop('hidden');
  });
  window.addEventListener('beforeprint', function () { stop('print'); });
  var media = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionChanged = function () { if (media.matches) stop('reduced-motion'); };
  if (media.addEventListener) media.addEventListener('change', motionChanged);
  else if (media.addListener) media.addListener(motionChanged);

  window.addEventListener('load', function () {
    // Offscreen iframes may never advance animation frames. A task boundary
    // drains startup work; synchronous SVG measurements force real layout.
    setTimeout(function () {
      queueMicrotask(function () {
        if (ready || !stop(suspended ? 'parent' : 'initial') || !diagramMeasured() || !nativeApi()) return;
        ready = true;
        window.parent.postMessage({ type: 'archify:ready', id: id }, '*');
      });
    }, 0);
  }, { once: true });
})();

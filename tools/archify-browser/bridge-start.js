(function () {
  'use strict';
  var state = { failed: false, nativeComplete: false };
  window.__kaiwuArchifyBridge = state;
  window.addEventListener('error', function () { state.failed = true; }, true);
  window.addEventListener('unhandledrejection', function () { state.failed = true; });
})();

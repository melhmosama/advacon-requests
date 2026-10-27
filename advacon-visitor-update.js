(function () {
  'use strict';
  if (window.AdvaconVisitorUpdate) return;

  var meta = document.querySelector('meta[name="advacon-release"]');
  var current = meta && String(meta.content || '').trim();
  var validVersion = function (value) {
    return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
  };
  if (!validVersion(current)) return;

  var MIN_CHECK_MS = 30000;
  var POLL_MS = 300000;
  var STORAGE_KEY = 'advacon.visitor.release.attempts.v1';
  var BANNER_ID = 'advacon-visitor-update-notice';
  var lastCheck = -Infinity;
  var inFlight = null;
  var pendingVersion = null;
  var verifiedAt = 0;
  var reloading = false;
  var lastVehicleRefresh = -Infinity;

  function context() {
    try {
      var read = window.AdvaconVisitorUpdateContext;
      return typeof read === 'function' ? read() || {} : {};
    } catch (_) {
      return {};
    }
  }

  function visible() {
    return document.visibilityState !== 'hidden';
  }

  function safe(value) {
    return value.isVisitor === true && value.hasDraft === false &&
      value.busy === false && value.canReload === true && visible();
  }

  function hideNotice() {
    var notice = document.getElementById(BANNER_ID);
    if (notice) notice.remove();
  }

  function showNotice(value, manual) {
    if (value.isVisitor !== true || !document.body) {
      hideNotice();
      return;
    }
    var notice = document.getElementById(BANNER_ID);
    if (!notice) {
      notice = document.createElement('div');
      notice.id = BANNER_ID;
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      notice.style.cssText = 'box-sizing:border-box;max-width:760px;margin:8px auto;padding:10px 14px;' +
        'background:#edf4fb;color:#15406e;border:1px solid #cbdced;border-radius:9px;' +
        'font:13px/1.6 Tahoma,Arial,sans-serif;text-align:center;overflow-wrap:anywhere;';
      document.body.insertBefore(notice, document.body.firstChild);
    }
    var arabic = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
    notice.dir = arabic ? 'rtl' : 'ltr';
    notice.textContent = manual
      ? (arabic ? 'تحديث متاح. يمكنك تحديث الصفحة بعد إنهاء الطلب.'
        : 'An update is available. You can refresh the page after finishing the request.')
      : (arabic ? 'تحديث متاح، سيُطبّق بعد إنهاء الطلب. يمكنك إكمال بياناتك ومرفقاتك كالمعتاد.'
        : 'An update is available and will be applied after you finish the request. You can continue entering details and attachments.');
  }

  function reserveReload(version) {
    try {
      // Store release identifiers only. Never persist request details, identity or files.
      var raw = window.sessionStorage.getItem(STORAGE_KEY);
      var attempts = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(attempts)) return false;
      var key = current + '>' + version;
      if (attempts.indexOf(key) !== -1 || attempts.length >= 8) return false;
      attempts.push(key);
      var encoded = JSON.stringify(attempts);
      window.sessionStorage.setItem(STORAGE_KEY, encoded);
      return window.sessionStorage.getItem(STORAGE_KEY) === encoded;
    } catch (_) {
      // Without a persistent attempt marker, an old cached page could reload forever.
      return false;
    }
  }

  function reconcile() {
    var value = context();
    if (!pendingVersion || value.isVisitor !== true) {
      hideNotice();
      return;
    }
    showNotice(value);
    if (reloading || !safe(value)) return;
    // A request may stay open for hours. Reconfirm the deployment before refreshing it.
    if (Date.now() - verifiedAt >= MIN_CHECK_MS) return;
    if (!safe(context())) return;
    if (!reserveReload(pendingVersion)) {
      showNotice(context(), true);
      return;
    }
    // Re-read after storage access; no async work may separate this guard from reload().
    if (!safe(context())) return;
    reloading = true;
    window.location.reload();
  }

  function check() {
    if (inFlight) return inFlight;
    if (reloading || !visible() || context().isVisitor !== true ||
        Date.now() - lastCheck < MIN_CHECK_MS) return Promise.resolve();
    lastCheck = Date.now();
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timeout = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
    inFlight = Promise.resolve().then(function () {
      return fetch('/advacon-release.json', {
        cache: 'no-store', credentials: 'omit',
        headers: { Accept: 'application/json' },
        signal: controller ? controller.signal : undefined
      });
    }).then(function (response) {
      if (!response.ok) throw new Error('release_unavailable');
      return response.json();
    }).then(function (release) {
      if (!release || !validVersion(release.version)) return;
      verifiedAt = Date.now();
      pendingVersion = release.version === current ? null : release.version;
      reconcile();
    }).catch(function () {
      // Offline/temporary failures leave the form and its attachments untouched.
    }).finally(function () {
      if (timeout !== null) clearTimeout(timeout);
      inFlight = null;
    });
    return inFlight;
  }

  function contextChanged() {
    reconcile();
    return check();
  }

  function resume(event) {
    contextChanged();
    var vehicle = window.AdvaconVehicleRequests;
    var value = context();
    if (reloading || !visible() || value.isVisitor !== true || value.busy === true ||
        Date.now() - lastVehicleRefresh < 15000 ||
        !vehicle || typeof vehicle.refreshPublic !== 'function') return;
    lastVehicleRefresh = Date.now();
    try {
      // This API updates vehicle choices in place and preserves the active form/files.
      Promise.resolve(vehicle.refreshPublic({ reason: event.type })).catch(function () {});
    } catch (_) {}
  }

  window.AdvaconVisitorUpdate = Object.freeze({ check: check, contextChanged: contextChanged });
  window.addEventListener('pageshow', resume);
  window.addEventListener('focus', resume);
  window.addEventListener('online', resume);
  document.addEventListener('visibilitychange', resume);
  setInterval(check, POLL_MS);
  setTimeout(check, 1500);
}());

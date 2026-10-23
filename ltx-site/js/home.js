/* LTX home — seam-safe click-driven video state machine (ES5 syntax).
 * base → forward(branch) → selected(branch) → reverse(branch) → base
 * One playback lock, one token per transition, one visible <video> at a time.
 */
(function () {
  'use strict';

  var FIRST_FRAME_TIMEOUT = 12000;
  var GUARD_DEFAULT = 0.08;
  var GUARD_SCENE_REVERSE = 0.18;

  var BRANCHES = {
    scene:    { label: 'Scene',    n: 2 },
    light:    { label: 'Lighting', n: 3 },
    colorway: { label: 'Clothing', n: 1 },
    fullLook: { label: 'Cast',     n: 4 }
  };
  var ORDER = ['scene', 'light', 'colorway', 'fullLook'];

  var stage = document.getElementById('stage');
  var ctrl = document.getElementById('controller');
  var statusEl = document.getElementById('status');
  var noticeEl = document.getElementById('notice');
  var noticeText = document.getElementById('noticeText');
  var retryBtn = document.getElementById('retry');
  var capsuleEl = ctrl.querySelector('.capsule');
  var buttons = {};
  var i;
  for (i = 0; i < ORDER.length; i++) {
    buttons[ORDER[i]] = ctrl.querySelector('[data-branch="' + ORDER[i] + '"]');
  }
  var allMedia = Array.prototype.slice.call(document.querySelectorAll('.media'));
  var mobileMQ = window.matchMedia ? window.matchMedia('(max-width: 700px)') : { matches: false };

  /* refs, not render state */
  var S = {
    scene: 'base',        // 'base' | 'scene' | 'light' | 'colorway' | 'fullLook'
    playback: 'loading',  // loading | ready | starting | playing | error
    direction: 'forward',
    lock: false,
    token: 0,
    visible: null,
    pending: null,
    raf: 0,
    cleanups: [],
    timers: [],
    hadFocus: false,
    retry: null,
    hovered: 0,
    focused: 0
  };

  function clip(key, dir) {
    return document.getElementById('v' + BRANCHES[key].n + (dir === 'reverse' ? 'r' : ''));
  }
  function ready(el) { return el.readyState >= 2; }
  function pairReady(key) { return ready(clip(key, 'forward')) && ready(clip(key, 'reverse')); }
  function say(msg) { statusEl.textContent = ''; setTimeout(function () { statusEl.textContent = msg; }, 30); }
  function setPlayback(p) { S.playback = p; stage.setAttribute('data-playback', p); }
  function listen(el, type, fn) {
    el.addEventListener(type, fn);
    S.cleanups.push(function () { el.removeEventListener(type, fn); });
  }
  function later(fn, ms, tok) {
    var id = setTimeout(function () { if (tok === S.token) fn(); }, ms);
    S.timers.push(id);
    return id;
  }
  function cleanupAll() {
    var k;
    for (k = 0; k < S.cleanups.length; k++) { try { S.cleanups[k](); } catch (e) {} }
    S.cleanups = [];
    for (k = 0; k < S.timers.length; k++) { clearTimeout(S.timers[k]); }
    S.timers = [];
    if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
    if (S.pending) { S.pending.teardown(); }
  }

  /* ───────── readiness ───────── */
  function refreshReady() {
    var k, key, ok;
    if (!S.visible && ready(clip('colorway', 'forward'))) {
      var base = clip('colorway', 'forward');
      try { base.currentTime = 0; } catch (e) {}
      base.classList.add('on');
      S.visible = base;
    }
    var all = true;
    for (k = 0; k < ORDER.length; k++) {
      key = ORDER[k];
      ok = pairReady(key);
      buttons[key].setAttribute('data-ready', ok ? '1' : '0');
      if (!ok) { all = false; }
    }
    syncButtons();
    if (all && S.playback === 'loading') {
      setPlayback('ready');
      say('Scene ready. Choose Scene, Lighting, Clothing or Cast.');
    }
  }
  allMedia.forEach(function (el) {
    el.addEventListener('loadeddata', refreshReady);
    el.addEventListener('canplay', refreshReady);
    el.addEventListener('error', function () { mediaError(el); });
  });
  setPlayback('loading');
  say('Loading scene');
  refreshReady();

  function mediaError(el) {
    if (S.lock) { return; }
    S.retry = { reload: true };
    showNotice('A clip could not be loaded.');
    say('A clip could not be loaded. Retry is available.');
  }

  /* Some mobile browsers ignore preload; prime clips on the first gesture. */
  function prime() {
    document.removeEventListener('pointerdown', prime, true);
    document.removeEventListener('keydown', prime, true);
    allMedia.forEach(function (el) {
      if (el.readyState < 2 && el.networkState === 1) {
        try {
          var p = el.play();
          if (p && p.then) {
            p.then(function () { if (el !== S.visible && !S.lock) { el.pause(); el.currentTime = 0; } }, function () {});
          }
        } catch (e) {}
      }
    });
  }
  document.addEventListener('pointerdown', prime, true);
  document.addEventListener('keydown', prime, true);

  /* ───────── controller semantics ───────── */
  function syncButtons() {
    var k, key, b, sel;
    for (k = 0; k < ORDER.length; k++) {
      key = ORDER[k];
      b = buttons[key];
      if (S.lock) {
        b.disabled = true;
      } else if (S.scene === 'base') {
        b.disabled = !pairReady(key);
        b.removeAttribute('aria-hidden');
        b.setAttribute('tabindex', '0');
      } else {
        sel = (S.scene === key);
        b.disabled = !sel;
        if (sel) { b.removeAttribute('aria-hidden'); b.setAttribute('tabindex', '0'); }
        else { b.setAttribute('aria-hidden', 'true'); b.setAttribute('tabindex', '-1'); }
      }
    }
  }

  function setLabel(key, text) { buttons[key].querySelector('.t').textContent = text; }

  function setPos(n) { ctrl.setAttribute('data-pos', String(n)); }
  function updatePos() {
    if (ctrl.classList.contains('collapsed')) { return; }
    setPos(S.hovered || S.focused || 0);
  }

  ORDER.forEach(function (key) {
    var b = buttons[key];
    var idx = parseInt(b.getAttribute('data-index'), 10);
    b.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'touch' || b.disabled) { return; }
      S.hovered = idx; updatePos();
    });
    b.addEventListener('pointerleave', function () { if (S.hovered === idx) { S.hovered = 0; updatePos(); } });
    b.addEventListener('focus', function () {
      var vis = true;
      try { vis = b.matches(':focus-visible'); } catch (e) {}
      if (vis) { S.focused = idx; updatePos(); }
    });
    b.addEventListener('blur', function () { if (S.focused === idx) { S.focused = 0; updatePos(); } });
    b.addEventListener('click', function () {
      if (S.lock) { return; }
      if (S.scene === 'base') { run(key, 'forward'); }
      else if (S.scene === key) { run(key, 'reverse'); }
    });
  });
  ctrl.addEventListener('pointerleave', function () { S.hovered = 0; updatePos(); });
  ctrl.addEventListener('pointermove', function (e) {
    var r = ctrl.getBoundingClientRect();
    if (!r.width || !r.height) { return; }
    ctrl.style.setProperty('--glass-x', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
    ctrl.style.setProperty('--glass-y', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
  });

  /* ───────── UI choreography (class-driven) ───────── */
  function uiBase() {
    var k, key, b;
    ctrl.classList.remove('collapsed', 'selected', 'restoring', 'bigmove');
    for (k = 0; k < ORDER.length; k++) {
      key = ORDER[k]; b = buttons[key];
      b.classList.remove('chosen', 'fading', 'reset-label');
      b.style.removeProperty('--tx'); b.style.removeProperty('--ty');
      setLabel(key, BRANCHES[key].label);
    }
    S.hovered = 0;
    setPos(S.focused || 0);
  }

  function uiForwardStart(key) {
    var b = buttons[key];
    var cr = ctrl.getBoundingClientRect();
    var br = b.getBoundingClientRect();
    var cx = cr.left + cr.width / 2;
    var cy = mobileMQ.matches ? cr.top + window.innerHeight * 0.04 : cr.top + 35; /* capsule top -1 + 72/2 */
    b.style.setProperty('--tx', (cx - (br.left + br.width / 2)).toFixed(1) + 'px');
    b.style.setProperty('--ty', (cy - (br.top + br.height / 2)).toFixed(1) + 'px');
    S.hovered = 0;
    ctrl.classList.add('bigmove');
    b.classList.add('chosen');
    ctrl.classList.add('collapsed'); /* same recalc: capsule collapse + rear fade (CSS delay waits) */
  }

  function uiSelected(key) {
    var b = buttons[key];
    ctrl.classList.remove('restoring');
    ctrl.classList.add('bigmove', 'collapsed', 'selected');
    b.classList.remove('fading');
    b.classList.add('chosen', 'reset-label');
    setLabel(key, 'Reset');
  }

  function uiReverseStart(key, tok) {
    var b = buttons[key];
    ctrl.classList.add('restoring');
    b.classList.add('fading');
    b.classList.remove('chosen');
    ctrl.classList.remove('collapsed', 'selected'); /* bar opens now, in parallel with the clip */
    later(function () {
      b.classList.remove('reset-label');
      setLabel(key, BRANCHES[key].label);
      b.classList.remove('fading');
    }, 320, tok);
  }

  /* ───────── notice ───────── */
  function showNotice(msg) { noticeText.textContent = msg; noticeEl.hidden = false; }
  function hideNotice() { noticeEl.hidden = true; }
  retryBtn.addEventListener('click', function () {
    var r = S.retry;
    hideNotice();
    if (!r) { return; }
    if (r.reload) {
      S.retry = null;
      allMedia.forEach(function (el) { if (el.error || el.readyState < 2) { try { el.load(); } catch (e) {} } });
      return;
    }
    S.retry = null;
    run(r.key, r.dir);
  });

  /* ───────── seam-safe player ───────── */
  function show(t) {
    var prev = S.visible;
    t.classList.add('on');
    if (prev && prev !== t) { prev.classList.remove('on'); }
    S.visible = t;
  }

  function prepare(t, tok) {
    return new Promise(function (resolve, reject) {
      t.pause();
      if (t.currentTime > 0.001) {
        var to = setTimeout(function () { t.removeEventListener('seeked', onSeek); reject(new Error('seek timeout')); }, 5000);
        var onSeek = function () { clearTimeout(to); t.removeEventListener('seeked', onSeek); resolve(); };
        t.addEventListener('seeked', onSeek);
        try { t.currentTime = 0; } catch (e) { clearTimeout(to); reject(e); }
      } else {
        resolve();
      }
    }).then(function () { if (tok !== S.token) { throw new Error('stale'); } });
  }

  function startAndWait(t, tok) {
    return new Promise(function (resolve, reject) {
      var p = {
        el: t, done: false, suspended: false, resumeCb: null,
        remaining: FIRST_FRAME_TIMEOUT, timer: null, startedAt: 0, rvfc: null, extra: []
      };
      S.pending = p;

      p.arm = function () {
        if (p.done || document.hidden) { return; }
        p.startedAt = Date.now();
        p.timer = setTimeout(function () {
          if (p.done || tok !== S.token) { return; }
          p.teardown();
          reject(new Error('first-frame timeout')); /* a timeout is never success */
        }, p.remaining);
      };
      p.disarm = function () {
        if (p.timer) {
          clearTimeout(p.timer); p.timer = null;
          p.remaining = Math.max(500, p.remaining - (Date.now() - p.startedAt));
        }
      };
      p.teardown = function () {
        var k;
        p.done = true;
        p.disarm();
        if (p.rvfc !== null && t.cancelVideoFrameCallback) { try { t.cancelVideoFrameCallback(p.rvfc); } catch (e) {} }
        for (k = 0; k < p.extra.length; k++) { try { p.extra[k](); } catch (e2) {} }
        p.extra = [];
        if (S.pending === p) { S.pending = null; }
      };

      var framePromise = new Promise(function (res) {
        function ok() { if (!p.done && tok === S.token) { res(); } }
        if (typeof t.requestVideoFrameCallback === 'function') {
          var cb = function (now, meta) {
            if (p.done || tok !== S.token) { return; }
            /* a stale endpoint frame carries a large mediaTime → keep waiting */
            if (meta.mediaTime <= 0.5 && t.readyState >= 2) { ok(); }
            else { p.rvfc = t.requestVideoFrameCallback(cb); }
          };
          p.rvfc = t.requestVideoFrameCallback(cb);
        } else {
          var armed = false;
          var check = function () {
            if (armed || p.done || tok !== S.token) { return; }
            if (!t.paused && t.readyState >= 2 && t.currentTime <= 0.5) {
              armed = true;
              requestAnimationFrame(function () { requestAnimationFrame(function () { armed = false; ok(); }); });
            }
          };
          t.addEventListener('playing', check);
          t.addEventListener('timeupdate', check);
          p.extra.push(function () { t.removeEventListener('playing', check); t.removeEventListener('timeupdate', check); });
        }
      });

      function attemptPlay() {
        return new Promise(function (res, rej) {
          var pr;
          try { pr = t.play(); } catch (e) { rej(e); return; }
          if (pr && pr.then) {
            pr.then(res, function (err) {
              if (err && err.name === 'AbortError' && p.suspended) {
                p.resumeCb = function () { attemptPlay().then(res, rej); };
              } else { rej(err); }
            });
          } else { res(); }
        });
      }
      p.resume = function () {
        if (p.resumeCb) { var f = p.resumeCb; p.resumeCb = null; f(); }
        else if (t.paused) { try { var r = t.play(); if (r && r.catch) { r.catch(function () {}); } } catch (e) {} }
      };

      var playPromise = attemptPlay(); /* callback registered BEFORE play() above settles */
      p.arm();
      Promise.all([playPromise, framePromise]).then(function () {
        if (p.done || tok !== S.token) { return; }
        p.teardown();
        resolve();
      }, function (err) {
        if (p.done) { return; }
        p.teardown();
        reject(err);
      });
    });
  }

  /* background tabs freeze frame callbacks: pause the deadline, rewind, replay on return */
  document.addEventListener('visibilitychange', function () {
    var p = S.pending;
    if (!p || p.done) { return; }
    if (document.hidden) {
      p.suspended = true; p.disarm();
      try { p.el.pause(); if (p.el.currentTime > 0.001) { p.el.currentTime = 0; } } catch (e) {}
    } else {
      p.suspended = false; p.arm(); p.resume();
    }
  });

  function monitor(t, key, dir, tok) {
    var guard = (key === 'scene' && dir === 'reverse') ? GUARD_SCENE_REVERSE : GUARD_DEFAULT;
    var dur = t.duration;
    var titleAt = Math.min(dur * 0.12, 0.9);
    var titleDone = (dir !== 'forward');
    var finished = false;
    var lastT = -1, lastMove = Date.now();

    function check() {
      if (finished || tok !== S.token) { return; }
      var ct = t.currentTime;
      if (!titleDone && ct >= titleAt) { titleDone = true; stage.classList.add('title-hidden'); }
      if (ct >= dur - guard || t.ended) { finish(); return true; }
      if (ct !== lastT) { lastT = ct; lastMove = Date.now(); }
      else if (!document.hidden && Date.now() - lastMove > 10000) { fail(tok, new Error('playback stalled')); return true; }
      return false;
    }
    function finish() {
      if (finished || tok !== S.token) { return; }
      finished = true;
      try { t.pause(); } catch (e) {}
      commit(key, dir, tok);
    }
    function tick() {
      S.raf = 0;
      if (finished || tok !== S.token) { return; }
      if (!check()) { S.raf = requestAnimationFrame(tick); }
    }
    listen(t, 'ended', finish);
    listen(t, 'timeupdate', function () { check(); });
    S.raf = requestAnimationFrame(tick);
  }

  function run(key, dir) {
    /* acquire the lock synchronously, before any async work */
    if (S.lock) { return; }
    if (dir === 'forward' && S.scene !== 'base') { return; }
    if (dir === 'reverse' && S.scene !== key) { return; }
    if (!pairReady(key)) { return; }
    S.lock = true;
    var tok = ++S.token;
    S.direction = dir;
    S.key = key;
    S.hadFocus = (document.activeElement === buttons[key]); /* capture BEFORE disabling */
    hideNotice();
    syncButtons();
    setPlayback('starting');

    var target = clip(key, dir);
    if (dir === 'forward') { uiForwardStart(key); say(BRANCHES[key].label + ': playing'); }
    else { uiReverseStart(key, tok); say('Resetting'); }

    prepare(target, tok)
      .then(function () { return startAndWait(target, tok); })
      .then(function () {
        if (tok !== S.token) { return; }
        show(target); /* atomic swap — never a crossfade */
        setPlayback('playing');
        monitor(target, key, dir, tok);
      })
      .catch(function (err) {
        if (err && err.message === 'stale') { return; }
        fail(tok, err, key, dir);
      });
  }

  function commit(key, dir, tok) {
    if (tok !== S.token) { return; }
    cleanupAll();
    S.lock = false;
    setPlayback('ready');
    if (dir === 'forward') {
      S.scene = key;
      uiSelected(key);
      say(BRANCHES[key].label + ' selected. Press Reset to return.');
    } else {
      S.scene = 'base';
      uiBase();
      stage.classList.remove('title-hidden');
      say('Back to the base scene.');
    }
    syncButtons();
    if (S.hadFocus) { try { buttons[key].focus({ preventScroll: true }); } catch (e) {} }
    S.hadFocus = false;
    setTimeout(rewindHidden, 350);
  }

  function fail(tok, err, key, dir) {
    if (tok !== S.token) { return; }
    key = key || S.key; dir = dir || S.direction;
    cleanupAll();
    S.token++;
    var t = clip(key, dir);
    try { t.pause(); } catch (e) {}
    S.lock = false;
    setPlayback('error');
    /* keep the last valid frame; put the controller back where it was */
    if (dir === 'forward') { uiBase(); stage.classList.remove('title-hidden'); }
    else { uiSelected(key); }
    syncButtons();
    if (S.hadFocus) { try { buttons[key].focus({ preventScroll: true }); } catch (e2) {} }
    S.retry = { key: key, dir: dir };
    showNotice(BRANCHES[key].label + ' transition did not complete.');
    say(BRANCHES[key].label + ' transition did not complete. Retry is available.');
    if (window.console) { console.warn('[LTX]', err); }
  }

  function rewindHidden() {
    if (S.lock) { return; }
    allMedia.forEach(function (el) {
      if (el !== S.visible && el.paused && el.currentTime > 0.001) { try { el.currentTime = 0; } catch (e) {} }
    });
  }
})();

/* LTX inner pages — shared motion system.
 * Owners: Lenis = scrolling · GSAP/ScrollTrigger = choreography · Three.js (scene3d.js) = rendering.
 */
(function () {
  'use strict';

  var CONFIG = { contactEmail: 'hello@example.com' }; /* ← set your real inbox (used by contact.html) */
  window.LTX = window.LTX || {};
  window.LTX.config = CONFIG;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gsap = window.gsap, ST = window.ScrollTrigger;
  var html = document.documentElement;
  var curtain = document.getElementById('curtain');
  var nav = document.getElementById('nav');
  var progress = document.getElementById('progress');

  if (!gsap || !ST) { html.classList.remove('js'); return; }
  gsap.registerPlugin(ST);

  /* ── smooth scroll (Lenis → ScrollTrigger) ── */
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  window.LTX.lenis = lenis;

  /* ── page transition curtain ── */
  var bar = curtain ? curtain.querySelector('.curtain-bar i') : null;
  var entered = false;

  function enter() {
    if (entered) { return; }
    entered = true;
    if (!curtain) { return window.LTX.onEnter && window.LTX.onEnter(); }
    gsap.timeline({ onComplete: function () { curtain.style.display = 'none'; } })
      .to(bar, { scaleX: 1, duration: 0.01 }, 0)
      .to(curtain.querySelector('svg'), { opacity: 0, y: -10, duration: 0.4, ease: 'power2.in' }, 0.05)
      .to(curtain.querySelector('.curtain-bar'), { opacity: 0, duration: 0.3 }, 0.05)
      .to(curtain, { yPercent: -100, duration: 1.05, ease: 'expo.inOut' }, 0.25)
      .add(function () { if (window.LTX.onEnter) { window.LTX.onEnter(); } }, 0.55);
  }

  function boot() {
    if (!curtain) { enter(); return; }
    var t0 = Date.now();
    gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 0.85, duration: 1.1, ease: 'power2.out' });
    var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    var loaded = new Promise(function (res) {
      if (document.readyState === 'complete') { res(); } else { window.addEventListener('load', res); }
    });
    var cap = new Promise(function (res) { setTimeout(res, 3500); }); /* never hold the page hostage */
    Promise.race([Promise.all([fontsReady, loaded]), cap]).then(function () {
      var wait = Math.max(0, 700 - (Date.now() - t0));
      setTimeout(enter, wait);
    });
  }
  boot();
  window.addEventListener('pageshow', function (e) {
    if (e.persisted && curtain) { curtain.style.display = 'none'; entered = true; }
  });

  function leave(href) {
    if (!curtain || reduce) { window.location.href = href; return; }
    curtain.style.display = 'flex';
    gsap.set(curtain, { yPercent: 100 });
    gsap.set(curtain.querySelector('svg'), { opacity: 0.9, y: 0 });
    gsap.set(curtain.querySelector('.curtain-bar'), { opacity: 0 });
    gsap.to(curtain, { yPercent: 0, duration: 0.8, ease: 'expo.inOut', onComplete: function () { window.location.href = href; } });
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { return; }
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!a || a.target === '_blank' || a.hasAttribute('download')) { return; }
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|https?:)/i.test(href)) { return; }
    e.preventDefault();
    if (document.documentElement.classList.contains('menu-open')) { toggleMenu(false); }
    leave(a.href);
  });

  /* ── menu ── */
  var menuBtn = document.getElementById('menuBtn');
  var menu = document.getElementById('menu');
  function toggleMenu(open) {
    if (typeof open !== 'boolean') { open = !html.classList.contains('menu-open'); }
    html.classList.toggle('menu-open', open);
    if (menuBtn) { menuBtn.setAttribute('aria-expanded', String(open)); }
    if (menu) { menu.setAttribute('aria-hidden', String(!open)); }
    if (lenis) { open ? lenis.stop() : lenis.start(); }
    else { document.body.style.overflow = open ? 'hidden' : ''; }
  }
  if (menuBtn) { menuBtn.addEventListener('click', function () { toggleMenu(); }); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { toggleMenu(false); } });

  /* ── nav: hide on scroll down, solid after hero ── */
  var lastY = 0;
  function onScroll(y) {
    if (nav) {
      nav.classList.toggle('is-solid', y > 40);
      if (y > lastY + 6 && y > 300) { nav.classList.add('is-hidden'); }
      else if (y < lastY - 6 || y < 200) { nav.classList.remove('is-hidden'); }
    }
    lastY = y;
    if (progress) {
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      progress.style.transform = 'scaleX(' + Math.min(1, y / max).toFixed(4) + ')';
    }
  }
  if (lenis) { lenis.on('scroll', function (e) { onScroll(e.scroll); }); }
  else { window.addEventListener('scroll', function () { onScroll(window.pageYOffset); }, { passive: true }); }

  /* ── split text → masked word reveal ── */
  function split(el) {
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', text);
    el.innerHTML = '';
    text.split(' ').forEach(function (word, i, arr) {
      var w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
      var wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = word;
      w.appendChild(wi); el.appendChild(w);
      if (i < arr.length - 1) { el.appendChild(document.createTextNode(' ')); }
    });
    return el.querySelectorAll('.wi');
  }
  function revealText(root) {
    var nodes = (root || document).querySelectorAll('[data-split]');
    Array.prototype.forEach.call(nodes, function (el) {
      var words = split(el);
      if (reduce) { return; }
      gsap.set(words, { yPercent: 118, rotate: 4 });
      var run = function () { gsap.to(words, { yPercent: 0, rotate: 0, duration: 1.15, ease: 'expo.out', stagger: 0.055 }); };
      if (el.hasAttribute('data-split-onload')) { window.LTX.queueEnter(run); }
      else { ST.create({ trigger: el, start: 'top 88%', once: true, onEnter: run }); }
    });
  }
  var enterQueue = [];
  window.LTX.queueEnter = function (fn) { enterQueue.push(fn); };
  window.LTX.onEnter = function () { enterQueue.forEach(function (fn) { fn(); }); enterQueue = []; window.LTX.entered = true; };
  revealText();

  /* ── generic reveals ── */
  Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (el) {
    if (reduce) { return; }
    var delay = parseFloat(el.getAttribute('data-delay') || '0');
    var run = function () { gsap.to(el, { opacity: 1, y: 0, duration: 1.1, delay: delay, ease: 'expo.out' }); };
    if (el.hasAttribute('data-onload')) { window.LTX.queueEnter(run); }
    else { ST.create({ trigger: el, start: 'top 90%', once: true, onEnter: run }); }
  });

  /* ── magnetic buttons + glass highlight (fine pointers only) ── */
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine && !reduce) {
    Array.prototype.forEach.call(document.querySelectorAll('.btn'), function (b) {
      var xTo = gsap.quickTo(b, 'x', { duration: 0.6, ease: 'power3' });
      var yTo = gsap.quickTo(b, 'y', { duration: 0.6, ease: 'power3' });
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.22);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
      });
      b.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.glass-card'), function (c) {
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty('--gx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
      c.style.setProperty('--gy', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
    });
  });

  /* anchor links use Lenis when present */
  Array.prototype.forEach.call(document.querySelectorAll('a[href^="#"]'), function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      var target = id.length > 1 ? document.querySelector(id) : null;
      if (!target) { return; }
      e.preventDefault();
      if (lenis) { lenis.scrollTo(target, { offset: -60, duration: 1.4 }); }
      else { target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); }
    });
  });

  window.addEventListener('load', function () { ST.refresh(); });
})();

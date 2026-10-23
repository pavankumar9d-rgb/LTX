/* Models page: ping-pong capability clips, scroll-scrubbed statement, 3D tilt. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gsap = window.gsap, ST = window.ScrollTrigger;

  /* ── ping-pong players: forward clip → reverse clip → forward … (two persistent <video>s each) ── */
  function makeVideo(src) {
    var v = document.createElement('video');
    v.muted = true; v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.preload = 'none'; v.src = src; v.className = 'pp-v';
    return v;
  }
  Array.prototype.forEach.call(document.querySelectorAll('.pp'), function (el) {
    var f = makeVideo(el.getAttribute('data-fwd')), r = makeVideo(el.getAttribute('data-rev'));
    el.appendChild(f); el.appendChild(r);
    var cur = f, other = r, running = false, timer = 0, token = 0;
    f.classList.add('on');

    function swapTo(next, prev, tok) {
      next.preload = 'auto';
      try { next.currentTime = 0; } catch (e) {}
      var p = next.play();
      var show = function () {
        if (tok !== token) { return; }
        next.classList.add('on'); prev.classList.remove('on');
        cur = next; other = prev;
      };
      var onEnd = function () {
        next.removeEventListener('ended', onEnd);
        if (tok !== token) { return; }
        timer = setTimeout(function () { if (running && tok === token) { swapTo(prev, next, tok); } }, 450);
      };
      next.addEventListener('ended', onEnd);
      if (next.requestVideoFrameCallback) { next.requestVideoFrameCallback(function () { show(); }); }
      else { next.addEventListener('playing', function once() { next.removeEventListener('playing', once); show(); }); }
      if (p && p.catch) { p.catch(function () { /* autoplay blocked or aborted — stay on the held frame */ }); }
    }
    function start() { if (running) { return; } running = true; token++; swapTo(cur, other, token); }
    function stop() { running = false; token++; clearTimeout(timer); f.pause(); r.pause(); }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { if (!reduce) { start(); } else { f.preload = 'auto'; f.load(); } } else { stop(); }
        });
      }, { threshold: 0.35 }).observe(el);
    } else if (!reduce) { start(); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) { stop(); } });
  });

  if (!gsap || !ST) { return; }

  /* ── scroll-scrubbed statement: words light up ── */
  var s = document.querySelector('[data-scrub]');
  if (s) {
    var words = s.textContent.replace(/\s+/g, ' ').trim().split(' ');
    s.setAttribute('aria-label', words.join(' '));
    s.innerHTML = words.map(function (w) { return '<span class="sw" aria-hidden="true">' + w + '</span>'; }).join(' ');
    var spans = s.querySelectorAll('.sw');
    if (!reduce) {
      gsap.set(spans, { opacity: 0.16 });
      gsap.to(spans, { opacity: 1, ease: 'none', stagger: 0.5,
        scrollTrigger: { trigger: s, start: 'top 80%', end: 'bottom 45%', scrub: 0.6 } });
    }
  }

  /* ── pointer tilt on media frames ── */
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine && !reduce) {
    Array.prototype.forEach.call(document.querySelectorAll('.cap-media'), function (m) {
      var rx = gsap.quickTo(m, 'rotationX', { duration: 0.8, ease: 'power3' });
      var ry = gsap.quickTo(m, 'rotationY', { duration: 0.8, ease: 'power3' });
      gsap.set(m, { transformPerspective: 1100 });
      m.addEventListener('pointermove', function (e) {
        var b = m.getBoundingClientRect();
        ry(((e.clientX - b.left) / b.width - 0.5) * 8);
        rx(-((e.clientY - b.top) / b.height - 0.5) * 8);
      });
      m.addEventListener('pointerleave', function () { rx(0); ry(0); });
    });
    /* parallax drift on the media inside the frame */
    Array.prototype.forEach.call(document.querySelectorAll('.cap'), function (c) {
      gsap.fromTo(c.querySelector('.pp'), { yPercent: -5 }, { yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: c, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }
})();

/* Pricing: billing toggle with animated thumb + number tween. */
(function () {
  'use strict';
  var gsap = window.gsap;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wrap = document.getElementById('billing');
  if (!wrap) { return; }
  var btns = Array.prototype.slice.call(wrap.querySelectorAll('button'));
  var thumb = wrap.querySelector('.thumb');
  var prices = Array.prototype.slice.call(document.querySelectorAll('[data-price]'));

  function place(btn) {
    thumb.style.width = btn.offsetWidth + 'px';
    thumb.style.transform = 'translateX(' + (btn.offsetLeft - 5) + 'px)';
  }
  function setPeriod(p, instant) {
    btns.forEach(function (b) {
      var on = b.getAttribute('data-period') === p;
      b.setAttribute('aria-pressed', String(on));
      if (on) { place(b); }
    });
    prices.forEach(function (el) {
      var to = parseFloat(el.getAttribute('data-' + p));
      var from = parseFloat(el.textContent) || 0;
      if (instant || reduce || !gsap || from === to) { el.textContent = Math.round(to); return; }
      var o = { v: from };
      gsap.to(o, { v: to, duration: 0.9, ease: 'expo.out', onUpdate: function () { el.textContent = Math.round(o.v); } });
    });
  }
  btns.forEach(function (b) { b.addEventListener('click', function () { setPeriod(b.getAttribute('data-period')); }); });
  window.addEventListener('resize', function () {
    var on = wrap.querySelector('[aria-pressed="true"]'); if (on) { place(on); }
  });
  var init = function () { setPeriod('monthly', true); };
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(init); } else { init(); }
  init();
})();

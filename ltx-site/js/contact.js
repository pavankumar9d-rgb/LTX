/* Contact: client-side validation + mailto hand-off (no backend required). */
(function () {
  'use strict';
  var cfg = (window.LTX && window.LTX.config) || { contactEmail: 'hello@example.com' };
  var form = document.getElementById('contactForm');
  var ok = document.getElementById('formOk');
  var mail = document.getElementById('mailLink');
  if (mail) { mail.href = 'mailto:' + cfg.contactEmail; mail.textContent = cfg.contactEmail; }
  if (!form) { return; }

  function err(id, msg) {
    var f = document.getElementById(id.replace('e-', ''));
    document.getElementById(id).textContent = msg || '';
    if (f) { if (msg) { f.setAttribute('aria-invalid', 'true'); } else { f.removeAttribute('aria-invalid'); } }
    return !msg;
  }
  function validate() {
    var v = {
      name: form.name.value.trim(), email: form.email.value.trim(), message: form.message.value.trim()
    };
    var a = err('e-name', v.name ? '' : 'Please tell us your name.');
    var b = err('e-email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) ? '' : 'Enter a valid email address.');
    var c = err('e-message', v.message.length > 9 ? '' : 'A few words more, please.');
    return a && b && c;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) { var bad = form.querySelector('[aria-invalid="true"]'); if (bad) { bad.focus(); } return; }
    var body = 'Name: ' + form.name.value + '\nEmail: ' + form.email.value + '\nCompany: ' + form.company.value +
      '\nTopic: ' + form.topic.value + '\n\n' + form.message.value;
    var href = 'mailto:' + cfg.contactEmail + '?subject=' + encodeURIComponent('[' + form.topic.value + '] ' + form.name.value) + '&body=' + encodeURIComponent(body);
    form.style.display = 'none'; ok.classList.add('on');
    window.location.href = href;
  });
  ['name', 'email', 'message'].forEach(function (k) {
    form[k].addEventListener('input', function () { if (form[k].getAttribute('aria-invalid')) { validate(); } });
  });
  document.getElementById('again').addEventListener('click', function () {
    form.reset(); form.style.display = ''; ok.classList.remove('on');
  });
})();

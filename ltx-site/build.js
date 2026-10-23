/* Tiny static-site assembler (dev-only; the output is plain HTML, nothing runs at deploy time).
 *   node build.js
 * Reads src/*.html, swaps {{PARTIALS}} and writes the finished pages next to index.html.
 */
var fs = require('fs');
var path = require('path');

var LOGO = '<svg viewBox="0 0 75 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
  '<path fill="#fff" d="M0 0h6.4v25.8H21V32H0z"/>' +
  '<path fill="#fff" d="M23.5 0H47v6.2h-8.6V32H32V6.2h-8.5z"/>' +
  '<path fill="#fff" d="M49.6 0h7.6l4.6 9.4L66.4 0H74l-8.4 15.6L74.6 32H67l-5.2-10.6L56.6 32H49l9-16.4z"/></svg>';

var PAGES = [
  { file: 'experience.html', label: 'Experience' },
  { file: 'models.html',     label: 'Models' },
  { file: 'pricing.html',    label: 'Pricing' },
  { file: 'contact.html',    label: 'Contact' }
];

function nav(current) {
  var links = PAGES.map(function (p) {
    return '<a href="' + p.file + '"' + (p.file === current ? ' aria-current="page"' : '') + '>' + p.label + '</a>';
  }).join('');
  var menu = ['<a href="index.html">Home</a>'].concat(PAGES.map(function (p) {
    return '<a href="' + p.file + '">' + p.label + '</a>';
  })).join('');
  return '<header class="nav" id="nav">' +
    '<a class="logo" href="index.html" aria-label="LTX home" data-transition>' + LOGO + '</a>' +
    '<nav class="nav-links" aria-label="Primary">' + links + '</nav>' +
    '<div class="nav-right"><a class="try" href="https://app.ltx.io/" target="_blank" rel="noopener noreferrer">Try now</a>' +
    '<button class="menu-btn" id="menuBtn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="menu"><span></span><span></span></button></div>' +
    '</header>' +
    '<div class="menu" id="menu" aria-hidden="true">' + menu + '</div>';
}

var FOOTER = '<footer class="footer"><div class="wrap">' +
  '<div class="footer-grid">' +
  '<div><p class="cta-line">Build with the world model.</p><a class="btn" href="https://app.ltx.io/" target="_blank" rel="noopener noreferrer">Try now <span class="arr">→</span></a></div>' +
  '<div><h3>Explore</h3><ul><li><a href="index.html">Home</a></li><li><a href="experience.html">Experience</a></li><li><a href="models.html">Models</a></li><li><a href="pricing.html">Pricing</a></li></ul></div>' +
  '<div><h3>Company</h3><ul><li><a href="contact.html">Contact</a></li><li><a href="https://app.ltx.io/" target="_blank" rel="noopener noreferrer">Launch app</a></li></ul></div>' +
  '</div>' +
  '<div class="footer-mark" aria-hidden="true">' + LOGO.replace('viewBox="0 0 75 32"', 'viewBox="0 0 75 32" preserveAspectRatio="xMidYMid meet"') + '</div>' +
  '<div class="footer-bottom"><span>© 2026 LTX. All rights reserved.</span><span>LTX-2.5 — Smarter. Faster.</span></div>' +
  '</div></footer>';

var CURTAIN = '<div class="curtain" id="curtain" aria-hidden="true">' + LOGO + '<div class="curtain-bar"><i></i></div></div>' +
  '<div class="scroll-progress" id="progress" aria-hidden="true"></div>';

var HEAD = '<meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
  '<meta name="theme-color" content="#04101a">' +
  '<script>document.documentElement.className+=" js"</script>' +
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">' +
  '<link rel="stylesheet" href="css/site.css">';

var SCRIPTS_CORE = '<script src="vendor/gsap.min.js"></script><script src="vendor/ScrollTrigger.min.js"></script>' +
  '<script src="vendor/lenis.min.js"></script><script src="js/site.js"></script>';

PAGES.forEach(function (p) {
  var src = fs.readFileSync(path.join(__dirname, 'src', p.file), 'utf8');
  var out = src
    .replace('{{HEAD}}', HEAD)
    .replace('{{CURTAIN}}', CURTAIN)
    .replace('{{NAV}}', nav(p.file))
    .replace('{{FOOTER}}', FOOTER)
    .replace('{{SCRIPTS_CORE}}', SCRIPTS_CORE);
  fs.writeFileSync(path.join(__dirname, p.file), out);
  console.log('built', p.file, out.length + ' bytes');
});

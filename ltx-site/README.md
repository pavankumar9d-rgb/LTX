# LTX site

Static site — no build needed to run. Open `index.html`, or deploy the folder to any static host.

| Page | File | Notes |
|---|---|---|
| Home | `index.html` + `css/home.css` + `js/home.js` | Cinematic state controller. 8 remote R2 clips, seam-safe player. |
| Experience | `experience.html` + `js/scene3d.js` | Three.js scroll-driven 3D world (procedural, no model downloads). |
| Models | `models.html` + `js/models.js` | Ping-pong capability clips, scrubbed statement, tilt. |
| Pricing | `pricing.html` + `js/pricing.js` | **Placeholder plans/prices — replace before launch.** |
| Contact | `contact.html` + `js/contact.js` | Opens the visitor's email app (no backend). Set `contactEmail` in `js/site.js`. |

Inner pages are generated from `src/*.html` + shared nav/footer in `build.js`. After editing `src/` or `build.js`, run `node build.js`.

To do before launch
- Replace the placeholder LTX wordmark paths (index.html, build.js) with the official SVG.
- Set the real contact email (`js/site.js` → `CONFIG.contactEmail`), or wire the form to a service (Formspree, etc.).
- Replace pricing copy/figures.

Libraries (vendored in `vendor/`): three r160, GSAP 3.12.5 + ScrollTrigger, Lenis 1.1.13. Font: Manrope (Google Fonts).

/* LTX Experience — the 3D "world model".
 * Scroll position (Lenis) → chapter float → keyframed state → shader uniforms / camera / object.
 * Procedural only: no model files, no textures — nothing heavy to download.
 */
(function () {
  'use strict';
  var canvas = document.getElementById('gl');
  if (!canvas || !window.THREE) { document.body.classList.add('no-webgl'); return; }
  var THREE = window.THREE;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = window.innerWidth < 900;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !small, alpha: false, powerPreference: 'high-performance' });
  } catch (err) { document.body.classList.add('no-webgl'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.setClearColor(0x030b12, 1);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
  camera.position.set(0, 0, 6.6);

  var NOISE = [
    'vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}',
    'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}',
    'float snoise(vec3 v){',
    ' const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);',
    ' vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);',
    ' vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);',
    ' vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;',
    ' i=mod(i,289.0);',
    ' vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));',
    ' float n_=1.0/7.0; vec3 ns=n_*D.wyz-D.xzx;',
    ' vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);',
    ' vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);',
    ' vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);',
    ' vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));',
    ' vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
    ' vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);',
    ' vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
    ' p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;',
    ' vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;',
    ' return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));',
    '}'
  ].join('\n');

  var U = {
    time: { value: 0 }, amp: { value: 0.16 }, box: { value: 0 }, hue: { value: 0 }
  };

  /* ── background glow ── */
  var bgMat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { uHue: U.hue, uPos: { value: new THREE.Vector2(0.7, 0.5) }, uAspect: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.999,1.0); }',
    fragmentShader: [
      'varying vec2 vUv; uniform float uHue; uniform vec2 uPos; uniform float uAspect;',
      'void main(){',
      ' vec2 d=(vUv-uPos)*vec2(uAspect,1.0);',
      ' float g=exp(-dot(d,d)*3.2);',
      ' vec3 cyan=vec3(0.10,0.42,0.58); vec3 pink=vec3(0.52,0.26,0.38);',
      ' vec3 glow=mix(cyan,pink,smoothstep(0.55,1.0,uHue));',
      ' vec3 base=mix(vec3(0.012,0.043,0.07),vec3(0.02,0.07,0.11),vUv.y);',
      ' gl_FragColor=vec4(base+glow*g*0.55,1.0);',
      '}'
    ].join('\n')
  });
  var bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false; bg.renderOrder = -10;
  scene.add(bg);

  /* ── the world: displaced, morphing icosphere with derivative-normal faceting ── */
  var worldMat = new THREE.ShaderMaterial({
    extensions: { derivatives: true },
    uniforms: U,
    vertexShader: [
      'uniform float time; uniform float amp; uniform float box;',
      'varying vec3 vView; varying vec3 vLocal; varying float vN;',
      NOISE,
      'void main(){',
      ' vec3 d=normalize(position);',
      ' vec3 bx=d/max(max(abs(d.x),abs(d.y)),abs(d.z))*0.84;',
      ' vec3 b=mix(d,bx,box);',
      ' float n=snoise(b*1.55+vec3(0.0,time*0.16,time*0.05));',
      ' float n2=snoise(b*4.2-vec3(time*0.09));',
      ' float disp=n*amp+n2*amp*0.22;',
      ' vec3 p=b*(1.0+disp);',
      ' vLocal=p; vN=n;',
      ' vec4 mv=modelViewMatrix*vec4(p,1.0);',
      ' vView=mv.xyz;',
      ' gl_Position=projectionMatrix*mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float hue; uniform float time;',
      'varying vec3 vView; varying vec3 vLocal; varying float vN;',
      'void main(){',
      ' vec3 n=normalize(cross(dFdx(vView),dFdy(vView)));',
      ' vec3 v=normalize(-vView);',
      ' float fr=pow(1.0-max(dot(n,v),0.0),2.4);',
      ' vec3 L=normalize(vec3(0.45,0.8,0.6));',
      ' float df=max(dot(n,L),0.0);',
      ' vec3 cyan=vec3(0.50,0.89,1.0); vec3 pink=vec3(1.0,0.84,0.90);',
      ' vec3 rim=mix(cyan,pink,smoothstep(0.35,1.0,hue));',
      ' vec3 core=mix(vec3(0.015,0.075,0.12),vec3(0.07,0.04,0.09),smoothstep(0.55,1.0,hue));',
      ' vec3 q=vLocal*5.0; vec3 w=fwidth(q);',
      ' vec3 gq=abs(fract(q-0.5)-0.5)/max(w,vec3(0.0001));',
      ' float gl=1.0-clamp(min(min(gq.x,gq.y),gq.z),0.0,1.0);',
      ' vec3 col=core*(0.35+0.9*df);',
      ' col+=rim*fr*1.15;',
      ' col+=rim*gl*(0.16+0.5*fr);',
      ' col+=mix(pink,cyan,0.5+0.5*vN)*0.05*df;',
      ' gl_FragColor=vec4(col,1.0);',
      '}'
    ].join('\n')
  });
  var worldGeo = new THREE.IcosahedronGeometry(1, small ? 14 : 22);
  var world = new THREE.Mesh(worldGeo, worldMat);

  /* orbit rings */
  var ringMat = new THREE.MeshBasicMaterial({ color: 0xbfeeff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  var ring1 = new THREE.Mesh(new THREE.RingGeometry(1.62, 1.625, 160), ringMat);
  var ring2 = new THREE.Mesh(new THREE.RingGeometry(2.05, 2.054, 160), ringMat);
  ring1.rotation.x = 1.15; ring2.rotation.set(0.5, 0.6, 0);

  var obj = new THREE.Group();
  obj.add(world); obj.add(ring1); obj.add(ring2);
  scene.add(obj);

  /* ── particle field ── */
  var COUNT = small ? 1800 : 5200;
  var pos = new Float32Array(COUNT * 3), rnd = new Float32Array(COUNT);
  for (var i = 0; i < COUNT; i++) {
    var r = 2.4 + Math.pow(Math.random(), 0.7) * 11;
    var th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th) * 1.25;
    pos[i * 3 + 1] = r * Math.cos(ph) * 0.8;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 1.5;
    rnd[i] = Math.random();
  }
  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
  var pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: U.time, hue: U.hue, uPx: { value: renderer.getPixelRatio() }, uSpread: { value: 1 } },
    vertexShader: [
      'attribute float aRand; uniform float time; uniform float uPx; uniform float uSpread;',
      'varying float vR; varying float vA;',
      'void main(){',
      ' vec3 p=position*uSpread;',
      ' p.y+=sin(time*0.2+aRand*40.0)*0.18; p.x+=cos(time*0.15+aRand*31.0)*0.18;',
      ' vec4 mv=modelViewMatrix*vec4(p,1.0);',
      ' gl_Position=projectionMatrix*mv;',
      ' gl_PointSize=(1.2+aRand*3.2)*uPx*(7.5/max(-mv.z,0.5));',
      ' vR=aRand; vA=0.22+0.78*aRand;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float hue; varying float vR; varying float vA;',
      'void main(){',
      ' float d=length(gl_PointCoord-0.5);',
      ' float a=smoothstep(0.5,0.0,d); a*=a;',
      ' vec3 c=mix(vec3(0.78,0.94,1.0),mix(vec3(0.5,0.89,1.0),vec3(1.0,0.84,0.9),smoothstep(0.35,1.0,hue)),vR);',
      ' gl_FragColor=vec4(c,a*vA);',
      '}'
    ].join('\n')
  });
  var points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);

  /* ── architectural floor grid ── */
  var floorMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, extensions: { derivatives: true },
    uniforms: { flow: { value: 0 }, hue: U.hue },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: [
      'uniform float flow; uniform float hue; varying vec3 vW;',
      'void main(){',
      ' vec2 c=vec2(vW.x*0.55, vW.z*0.55+flow);',
      ' vec2 g=abs(fract(c-0.5)-0.5)/max(fwidth(c),vec2(0.0001));',
      ' float l=1.0-clamp(min(g.x,g.y),0.0,1.0);',
      ' float fade=smoothstep(24.0,1.5,length(vW.xz));',
      ' vec3 col=mix(vec3(0.5,0.89,1.0),vec3(1.0,0.84,0.9),smoothstep(0.5,1.0,hue));',
      ' gl_FragColor=vec4(col,l*fade*0.34);',
      '}'
    ].join('\n')
  });
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2.5;
  scene.add(floor);

  /* ── keyframes, one per chapter (desktop x is a fraction of half the visible width) ── */
  var K = [
    { x: 0.46,  y: 0.02, s: 1.15, box: 0.0, amp: 0.16, hue: 0.0,  spread: 1.0,  rot: 0.0 },
    { x: 0.52,  y: 0.0,  s: 1.28, box: 0.0, amp: 0.42, hue: 0.12, spread: 0.9,  rot: 1.2 },
    { x: -0.52, y: 0.0,  s: 1.10, box: 1.0, amp: 0.05, hue: 0.0,  spread: 1.25, rot: 2.4 },
    { x: 0.52,  y: 0.0,  s: 1.22, box: 0.35, amp: 0.27, hue: 0.45, spread: 0.85, rot: 3.6 },
    { x: -0.5,  y: 0.0,  s: 1.34, box: 0.0, amp: 0.22, hue: 1.0,  spread: 1.1,  rot: 4.8 },
    { x: 0.0,   y: 0.0,  s: 0.95, box: 0.0, amp: 0.13, hue: 0.2,  spread: 1.6,  rot: 6.0 }
  ];
  var KEYS = ['x', 'y', 's', 'box', 'amp', 'hue', 'spread', 'rot'];
  var cur = {}, tgt = {};
  KEYS.forEach(function (k) { cur[k] = K[0][k]; tgt[k] = K[0][k]; });

  /* ── layout + scroll measurement ── */
  var chapters = Array.prototype.slice.call(document.querySelectorAll('.chapter'));
  var tops = [], heights = [], mainBottom = 1e9;
  function measure() {
    var sy = window.pageYOffset;
    tops = chapters.map(function (c) { return c.getBoundingClientRect().top + sy; });
    heights = chapters.map(function (c) { return c.offsetHeight; });
    var main = document.getElementById('scroll');
    mainBottom = main ? main.getBoundingClientRect().bottom + sy : 1e9;
  }
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    small = w < 900;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    bgMat.uniforms.uAspect.value = w / h;
    pMat.uniforms.uPx.value = renderer.getPixelRatio();
    measure();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('load', function () { setTimeout(measure, 100); });
  if (window.ScrollTrigger) { window.ScrollTrigger.addEventListener('refresh', measure); }
  resize();

  function smooth(t) { return t * t * (3 - 2 * t); }
  function scrollY() { return window.LTX && window.LTX.lenis ? window.LTX.lenis.scroll : window.pageYOffset; }

  var chapterFloat = 0, activeIdx = 0;
  function computeTargets() {
    var y = scrollY(), vh = window.innerHeight, yc = y + vh * 0.5;
    var i = 0, k;
    for (k = 0; k < tops.length; k++) { if (yc >= tops[k]) { i = k; } }
    var f = i + Math.min(1, Math.max(0, (yc - tops[i]) / Math.max(1, heights[i])));
    chapterFloat = f;
    activeIdx = Math.round(f - 0.0001 > i + 0.999 ? i : i);
    var t = Math.min(K.length - 1, Math.max(0, f - 0.5));
    var a = Math.floor(t), b = Math.min(K.length - 1, a + 1), u = smooth(t - a);
    KEYS.forEach(function (key) { tgt[key] = K[a][key] + (K[b][key] - K[a][key]) * u; });
  }

  /* ── pointer parallax ── */
  var px = 0, py = 0, tx = 0, ty = 0;
  window.addEventListener('pointermove', function (e) {
    tx = (e.clientX / window.innerWidth) * 2 - 1;
    ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* ── chapter rail ── */
  var rail = document.getElementById('rail');
  var railLinks = [];
  if (rail) {
    chapters.forEach(function (c, idx) {
      c.id = c.id || ('chapter-' + idx);
      var a = document.createElement('a');
      a.href = '#' + c.id; a.setAttribute('aria-label', c.getAttribute('data-name') || ('Chapter ' + idx));
      a.innerHTML = '<span>' + (c.getAttribute('data-name') || '') + '</span><i></i>';
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var l = window.LTX && window.LTX.lenis;
        if (l) { l.scrollTo(c, { duration: 1.6 }); } else { c.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); }
      });
      rail.appendChild(a); railLinks.push(a);
    });
  }
  var hudA = document.getElementById('hudA'), hudB = document.getElementById('hudB'), hudC = document.getElementById('hudC');
  var lastActive = -1, frame = 0;

  /* ── loop ── */
  var clock = new THREE.Clock();
  var hw, hh;
  function render() {
    requestAnimationFrame(render);
    var dt = Math.min(clock.getDelta(), 0.05);
    var y = scrollY();
    if (y > mainBottom) { return; } /* footer fully covers the canvas */
    computeTargets();
    var e = reduce ? 1 : 1 - Math.exp(-dt * 3.4);
    KEYS.forEach(function (k) { cur[k] += (tgt[k] - cur[k]) * e; });
    if (!reduce) { U.time.value += dt; }
    px += (tx - px) * (reduce ? 1 : 0.05); py += (ty - py) * (reduce ? 1 : 0.05);

    var dist = camera.position.z;
    hh = Math.tan((camera.fov * Math.PI / 180) / 2) * dist;
    hw = hh * camera.aspect;
    var sc = cur.s * (small ? 0.72 : 1);
    var ox = small ? 0 : cur.x * hw;
    var oy = small ? hh * 0.34 : cur.y * hh;
    obj.position.set(ox, oy, 0);
    obj.scale.setScalar(sc);
    world.rotation.y = U.time.value * 0.07 + cur.rot * 0.55 + px * 0.35;
    world.rotation.x = Math.sin(U.time.value * 0.08) * 0.15 + py * 0.2;
    ring1.rotation.z = U.time.value * 0.12; ring2.rotation.z = -U.time.value * 0.08;
    ringMat.opacity = 0.12 + 0.2 * (1 - cur.box);

    U.amp.value = cur.amp; U.box.value = cur.box; U.hue.value = Math.min(1, Math.max(0, cur.hue));
    pMat.uniforms.uSpread.value = cur.spread;
    points.rotation.y = U.time.value * 0.015 + cur.rot * 0.12;
    floorMat.uniforms.flow.value = y * 0.0016 + U.time.value * 0.04;
    bgMat.uniforms.uPos.value.set(0.5 + (small ? 0 : cur.x * 0.3), small ? 0.68 : 0.5);

    camera.position.x = px * 0.45; camera.position.y = -py * 0.3;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);

    /* DOM readouts at low frequency */
    frame++;
    var idx = Math.min(chapters.length - 1, Math.max(0, Math.floor(chapterFloat)));
    if (idx !== lastActive) {
      lastActive = idx;
      railLinks.forEach(function (a, k) { a.classList.toggle('on', k === idx); });
      if (hudC) { hudC.textContent = 'CH ' + (idx < 10 ? '0' : '') + idx; }
    }
    if (frame % 6 === 0 && hudA) {
      hudA.textContent = 'MORPH ' + cur.box.toFixed(2);
      hudB.textContent = 'FIELD ' + cur.amp.toFixed(2);
    }
  }
  render();

  document.addEventListener('visibilitychange', function () { if (!document.hidden) { clock.getDelta(); } });
})();

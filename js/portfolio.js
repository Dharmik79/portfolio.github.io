'use strict';

/* ── Utils ─────────────────────────────── */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* ══════════════════════════════════════════════════════════
   THREE.JS  CINEMATIC 3D UNIVERSE  — PULSE EDITION
   Rose / Cyan / Lime color scheme
   Scroll-driven camera · Aurora mesh · Particle network
══════════════════════════════════════════════════════════ */
(function init3D() {
  if (typeof THREE === 'undefined') return;
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;

  /* ─── Renderer ─── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  const clock  = new THREE.Clock();

  /* ─── Glow Sprite Factory ─── */
  function sprite(r, g, b, a = 1) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0,    `rgba(${r},${g},${b},${a})`);
    grd.addColorStop(0.35, `rgba(${r},${g},${b},${a * 0.65})`);
    grd.addColorStop(1,    `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  const SPR_ROSE  = sprite(255, 85, 133);   // rose
  const SPR_CYAN  = sprite(0, 200, 255);    // cyan
  const SPR_WHITE = sprite(240, 235, 255);  // off-white

  /* ═══════════════════════════════════════════════════
     1. STAR FIELD  (6 000 particles — rose/cyan/white)
  ═══════════════════════════════════════════════════ */
  {
    const N = 6000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i*3]   = (Math.random() - .5) * 200;
      pos[i*3+1] = (Math.random() - .5) * 300;
      pos[i*3+2] = (Math.random() - .5) * 150;
      const r = Math.random();
      if (r < .55)      { col[i*3]=1.0; col[i*3+1]=.32; col[i*3+2]=.52; }  // rose
      else if (r < .80) { col[i*3]=.90; col[i*3+1]=.90; col[i*3+2]=1.0; }  // white-blue
      else              { col[i*3]=0.0; col[i*3+1]=.78; col[i*3+2]=1.0; }  // cyan
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: .12, map: SPR_WHITE, vertexColors: true,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    })));
  }

  /* ═══════════════════════════════════════════════════
     2. SPIRAL GALAXY  (10 000 particles — rose/cyan)
  ═══════════════════════════════════════════════════ */
  let galaxy;
  {
    const N = 10000, ARMS = 3, R = 32;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    function gauss() {
      let u = 0, v = 0;
      while (!u) u = Math.random();
      while (!v) v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    for (let i = 0; i < N; i++) {
      const arm  = i % ARMS;
      const t    = Math.random();
      const r    = t * R + 0.5;
      const spin = r * 0.38;
      const ang  = (arm / ARMS) * Math.PI * 2 + spin + (Math.random() - .5) * .55;
      pos[i*3]   = Math.cos(ang) * r + gauss() * 0.5;
      pos[i*3+1] = gauss() * 0.4;
      pos[i*3+2] = Math.sin(ang) * r + gauss() * 0.5;
      const tr = r / R;
      // Gradient: rose inner → cyan outer
      col[i*3]   = 1.0  - tr * 0.95;
      col[i*3+1] = .32  + tr * 0.46;
      col[i*3+2] = .52  + tr * 0.48;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    galaxy = new THREE.Points(geo, new THREE.PointsMaterial({
      size: .055, map: SPR_ROSE, vertexColors: true,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: .70,
    }));
    galaxy.position.y = -120;
    galaxy.rotation.x = Math.PI * .22;
    scene.add(galaxy);
  }

  /* ═══════════════════════════════════════════════════
     3. HOLOGRAPHIC SPHERE  (Rose GLSL shader)
  ═══════════════════════════════════════════════════ */
  let holoMesh, holoU;
  {
    holoU = {
      uTime:      { value: 0 },
      uColorEdge: { value: new THREE.Color(0xFF2060) },  // rose
      uColorCore: { value: new THREE.Color(0x030308) },  // void black
    };
    holoMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.0, 80, 80),
      new THREE.ShaderMaterial({
        uniforms: holoU,
        vertexShader: /* glsl */`
          uniform float uTime;
          varying vec3  vNormal;
          varying vec3  vWorldPos;
          varying vec2  vUv;
          void main(){
            vNormal   = normalize(normalMatrix * normal);
            vUv       = uv;
            vec3 p    = position;
            float d   = sin(p.x*6.0+uTime*1.5)*cos(p.y*5.5+uTime*1.1)*cos(p.z*5.0)*0.065;
            p        += normal*d;
            vec4 wp   = modelMatrix*vec4(p,1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
          }
        `,
        fragmentShader: /* glsl */`
          uniform float uTime;
          uniform vec3  uColorEdge;
          uniform vec3  uColorCore;
          varying vec3  vNormal;
          varying vec3  vWorldPos;
          varying vec2  vUv;
          void main(){
            vec3 view  = normalize(cameraPosition - vWorldPos);
            float fres = pow(1.0 - abs(dot(vNormal, view)), 2.6);
            float scan = step(0.46, fract(vUv.y*55.0 - uTime*1.1))*0.20;
            float gx   = step(0.93, fract(vUv.x*22.0));
            float gy   = step(0.93, fract(vUv.y*22.0));
            float grid = clamp(gx+gy,0.0,1.0)*0.18;
            float pls  = 0.5+0.5*sin(uTime*1.5+vUv.y*7.0);
            vec3 col   = mix(uColorCore, uColorEdge, fres*pls*1.5+scan+grid);
            float alp  = fres*0.82+scan*0.9+grid*0.75+0.04;
            gl_FragColor = vec4(col, clamp(alp, 0.0, 1.0));
          }
        `,
        transparent: true,
        blending:    THREE.AdditiveBlending,
        depthWrite:  false,
        side:        THREE.FrontSide,
      })
    );
    holoMesh.position.set(1.8, 0, 0);
    scene.add(holoMesh);
  }

  /* ═══════════════════════════════════════════════════
     4. ORBITAL RINGS + TRAVELING PARTICLES (rose/cyan)
  ═══════════════════════════════════════════════════ */
  const orbitalParticles = [];
  {
    const RING_CFG = [
      { r: 2.8, tX: Math.PI*.38,  tZ: 0,           nPts: 8,  spd:  1.1, col: 0xFF2060 },
      { r: 3.4, tX: -Math.PI*.22, tZ: Math.PI*.18,  nPts: 6,  spd: -0.7, col: 0x00CCFF },
      { r: 4.0, tX: Math.PI*.12,  tZ: Math.PI*.44,  nPts: 10, spd:  0.5, col: 0xFF5585 },
    ];
    const GROUP = new THREE.Group();
    GROUP.position.set(1.8, 0, 0);
    scene.add(GROUP);

    RING_CFG.forEach(cfg => {
      const pts = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * cfg.r, 0, Math.sin(a) * cfg.r));
      }
      const ring = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: cfg.col, transparent: true, opacity: .13, blending: THREE.AdditiveBlending })
      );
      ring.rotation.x = cfg.tX; ring.rotation.z = cfg.tZ;
      GROUP.add(ring);

      for (let i = 0; i < cfg.nPts; i++) {
        const ptMesh = new THREE.Mesh(
          new THREE.SphereGeometry(.06, 6, 6),
          new THREE.MeshBasicMaterial({ color: cfg.col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })
        );
        ptMesh.userData = { angle: (i / cfg.nPts) * Math.PI * 2, r: cfg.r, spd: cfg.spd, tX: cfg.tX, tZ: cfg.tZ };
        scene.add(ptMesh);
        orbitalParticles.push(ptMesh);
      }
    });

    function updateOrbital(t) {
      orbitalParticles.forEach(pt => {
        const d = pt.userData;
        d.angle += d.spd * .012;
        const lx = Math.cos(d.angle) * d.r;
        const lz = Math.sin(d.angle) * d.r;
        const cX = Math.cos(d.tX), sX = Math.sin(d.tX);
        const cZ = Math.cos(d.tZ), sZ = Math.sin(d.tZ);
        const y1 = -lz * sX, z1 = lz * cX;
        const x2 = lx * cZ - y1 * sZ, y2 = lx * sZ + y1 * cZ;
        pt.position.set(x2 + 1.8, y2, z1);
      });
    }
    window.__updateOrbital = updateOrbital;
  }

  /* ═══════════════════════════════════════════════════
     5. NEBULA CLOUD  (rose-tinted)
  ═══════════════════════════════════════════════════ */
  {
    const N = 1800;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const th  = Math.random() * Math.PI * 2;
      const r   = 2.2 + Math.random() * 2.0;
      pos[i*3]   = Math.sin(phi)*Math.cos(th)*r + 1.8;
      pos[i*3+1] = Math.sin(phi)*Math.sin(th)*r;
      pos[i*3+2] = Math.cos(phi)*r;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: .065, map: SPR_ROSE, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, opacity: .45,
    })));
  }

  /* ═══════════════════════════════════════════════════
     6. WARP SPEED LINES  (velocity-driven)
  ═══════════════════════════════════════════════════ */
  let warpLines, warpPos, warpAngles;
  {
    const N = 350;
    warpAngles = Array.from({ length: N }, () => ({
      theta: Math.random() * Math.PI * 2,
      phi: Math.acos(Math.random() * 2 - 1),
    }));
    warpPos = new Float32Array(N * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(warpPos, 3));
    warpLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: 0xFF4488, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending,
    }));
    scene.add(warpLines);
  }

  /* ═══════════════════════════════════════════════════
     7. FLOATING CRYSTALS  (rose/cyan emissive)
  ═══════════════════════════════════════════════════ */
  const crystals = [];
  {
    const CFGS = [
      { y:   -2, x: -4.2, z:-2.0, s:.55, sp:.28 },
      { y:  -18, x:  4.5, z:-1.8, s:.42, sp:.35 },
      { y:  -35, x: -3.8, z:-2.2, s:.60, sp:.22 },
      { y:  -55, x:  4.0, z:-1.5, s:.38, sp:.40 },
      { y:  -75, x: -4.5, z:-2.0, s:.50, sp:.18 },
      { y:  -95, x:  3.8, z:-1.8, s:.45, sp:.30 },
      { y: -115, x: -4.0, z:-2.2, s:.48, sp:.25 },
      { y: -135, x:  4.2, z:-1.6, s:.52, sp:.38 },
      { y: -155, x: -3.5, z:-2.0, s:.40, sp:.32 },
      { y: -175, x:  4.0, z:-1.8, s:.55, sp:.22 },
      { y: -200, x: -4.2, z:-2.2, s:.44, sp:.35 },
      { y: -225, x:  3.8, z:-1.5, s:.50, sp:.28 },
    ];
    CFGS.forEach((c, i) => {
      const geo  = i % 3 === 0
        ? new THREE.OctahedronGeometry(c.s, 0)
        : i % 3 === 1
          ? new THREE.IcosahedronGeometry(c.s, 1)
          : new THREE.TetrahedronGeometry(c.s, 0);
      // Alternate rose / cyan emissive
      const emColor = i % 2 === 0 ? 0xFF2060 : 0x00CCFF;
      const edColor = i % 2 === 0 ? 0xFF5585 : 0x40D8FF;
      const mat = new THREE.MeshStandardMaterial({
        color: 0x030308, emissive: emColor, emissiveIntensity: .45,
        metalness: .95, roughness: .05, transparent: true, opacity: .85,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(c.x, c.y, c.z);
      mesh.userData = { baseY: c.y, sp: c.sp, phase: i * .55 };
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: edColor, transparent: true, opacity: .50, blending: THREE.AdditiveBlending })
      );
      mesh.add(edges);
      scene.add(mesh);
      crystals.push(mesh);
    });
  }

  /* ═══════════════════════════════════════════════════
     8. DNA DOUBLE HELIX  (About section  Y ≈ –40)
  ═══════════════════════════════════════════════════ */
  let dnaGroup;
  {
    dnaGroup = new THREE.Group();
    dnaGroup.position.set(3.0, -40, 0);
    const TURNS = 5, PPT = 28, N = TURNS * PPT;
    const R = 1.1, H = 9;

    [0, Math.PI].forEach((offset, s) => {
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const a = t * TURNS * Math.PI * 2 + offset;
        pts.push(new THREE.Vector3(Math.cos(a) * R, (t - .5) * H, Math.sin(a) * R));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const mat   = new THREE.MeshBasicMaterial({
        color: s === 0 ? 0xFF2060 : 0x00CCFF,
        blending: THREE.AdditiveBlending, transparent: true, opacity: .85,
      });
      dnaGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, N * 3, .055, 8, false), mat));
    });

    for (let i = 1; i < N; i += 2) {
      const t = i / N, a = t * TURNS * Math.PI * 2, y = (t - .5) * H;
      const rungGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R),
        new THREE.Vector3(Math.cos(a + Math.PI) * R, y, Math.sin(a + Math.PI) * R),
      ]);
      dnaGroup.add(new THREE.Line(rungGeo, new THREE.LineBasicMaterial({
        color: 0xFF5585, blending: THREE.AdditiveBlending, transparent: true, opacity: .28,
      })));
    }
    scene.add(dnaGroup);
  }

  /* ═══════════════════════════════════════════════════
     9. WAVE PARTICLE GRID  (Skills section  Y ≈ –80)
  ═══════════════════════════════════════════════════ */
  let waveGrid, waveGX, waveGZ;
  {
    const W = 55, H = 55, SP = .28;
    const N = W * H;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    waveGX = new Float32Array(N);
    waveGZ = new Float32Array(N);
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < H; z++) {
        const i = x * H + z;
        waveGX[i]  = (x - W / 2) * SP;
        waveGZ[i]  = (z - H / 2) * SP;
        pos[i*3]   = waveGX[i];
        pos[i*3+1] = 0;
        pos[i*3+2] = waveGZ[i];
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    waveGrid = new THREE.Points(geo, new THREE.PointsMaterial({
      size: .065, map: SPR_CYAN, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, opacity: .72,
    }));
    waveGrid.position.set(0, -80, -1);
    scene.add(waveGrid);
  }

  /* ═══════════════════════════════════════════════════
     10. PROJECT SCREENS  (Projects section  Y ≈ –160)
  ═══════════════════════════════════════════════════ */
  const screens = [];
  {
    const titles = ['EBF — Network of Trust', 'Urban Odyssey', 'SettleOut', 'EQ Dashboard', 'NFT Indexer'];
    const xs     = [-5.5, -2.5, 0, 2.5, 5.5];
    titles.forEach((title, i) => {
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 320;
      const ctx = cv.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, 320);
      g.addColorStop(0, '#0F0520'); g.addColorStop(1, '#1A0A30');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 320);
      ctx.fillStyle = '#FF2060'; ctx.fillRect(0, 0, 512, 3);
      [[30,'#FF5F57'],[52,'#FEBC2E'],[74,'#28C840']].forEach(([x, c]) => {
        ctx.beginPath(); ctx.arc(x, 18, 5, 0, Math.PI*2);
        ctx.fillStyle = c; ctx.fill();
      });
      ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = '#FFB3C6';
      ctx.fillText(title, 18, 58);
      for (let yy = 78; yy < 295; yy += 24) {
        ctx.fillStyle = 'rgba(255,32,96,0.07)';
        ctx.fillRect(18, yy, 280 + Math.random() * 180, 11);
      }
      const tex = new THREE.CanvasTexture(cv);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: .85, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2.2), mat);
      mesh.position.set(xs[i], -160, -1);
      mesh.rotation.y = (i - 2) * .22;
      mesh.userData = { baseY: -160, phase: i * 1.2, sp: .18 + i * .03 };
      const bMat = new THREE.MeshBasicMaterial({ color: 0xFF2060, wireframe: true, transparent: true, opacity: .15, blending: THREE.AdditiveBlending });
      mesh.add(new THREE.Mesh(new THREE.PlaneGeometry(3.55, 2.25), bMat));
      scene.add(mesh);
      screens.push(mesh);
    });
  }

  /* ═══════════════════════════════════════════════════
     11. CONTACT PARTICLE VORTEX  (Contact  Y ≈ –240)
  ═══════════════════════════════════════════════════ */
  let vortexAttr, vortexHomeX, vortexHomeY, vortexHomeZ;
  {
    const N = 900;
    const vortexGeo = new THREE.BufferGeometry();
    const pos  = new Float32Array(N * 3);
    vortexHomeX = new Float32Array(N);
    vortexHomeY = new Float32Array(N);
    vortexHomeZ = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const phi   = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r     = 4 + Math.random() * 3;
      vortexHomeX[i] = Math.sin(phi)*Math.cos(theta)*r;
      vortexHomeY[i] = Math.sin(phi)*Math.sin(theta)*r;
      vortexHomeZ[i] = Math.cos(phi)*r;
      pos[i*3]   = vortexHomeX[i];
      pos[i*3+1] = vortexHomeY[i];
      pos[i*3+2] = vortexHomeZ[i];
    }
    vortexGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    vortexAttr = vortexGeo.attributes.position;
    const vMesh = new THREE.Points(vortexGeo, new THREE.PointsMaterial({
      size: .10, map: SPR_ROSE, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    vMesh.position.set(0, -240, 0);
    scene.add(vMesh);
  }

  /* ═══════════════════════════════════════════════════
     12. LIGHTS
  ═══════════════════════════════════════════════════ */
  scene.add(new THREE.AmbientLight(0x030308, 0.5));
  const tLight1 = new THREE.PointLight(0xFF2060, 6, 25);
  const tLight2 = new THREE.PointLight(0x00CCFF, 4, 22);
  scene.add(tLight1, tLight2);
  // Zone accent lights
  const zL1 = new THREE.PointLight(0xFF2060, 3, 18); zL1.position.set(0, -40, 4);  scene.add(zL1);
  const zL2 = new THREE.PointLight(0x00CCFF, 3, 18); zL2.position.set(0, -80, 4);  scene.add(zL2);
  const zL3 = new THREE.PointLight(0xFF5585, 3, 18); zL3.position.set(0,-160, 4);  scene.add(zL3);
  const zL4 = new THREE.PointLight(0xFF2060, 5, 22); zL4.position.set(0,-240, 4);  scene.add(zL4);

  /* ═══════════════════════════════════════════════════
     SCROLL-DRIVEN CAMERA SPLINE
  ═══════════════════════════════════════════════════ */
  const CAM_SPLINE = new THREE.CatmullRomCurve3([
    new THREE.Vector3( 0,    0,  8),
    new THREE.Vector3( 1.2, -20,  7),
    new THREE.Vector3(-0.8, -40,  7),
    new THREE.Vector3( 0.5, -80,  7),
    new THREE.Vector3(-0.5,-120,  7),
    new THREE.Vector3( 0,  -160,  9),
    new THREE.Vector3(-0.5,-200,  7),
    new THREE.Vector3( 0,  -240,  6),
  ]);
  const LOOK_SPLINE = new THREE.CatmullRomCurve3([
    new THREE.Vector3( 1.8,   0,  0),
    new THREE.Vector3( 0,   -20,  0),
    new THREE.Vector3( 3,   -40,  0),
    new THREE.Vector3( 0,   -80,  0),
    new THREE.Vector3( 0,  -120,  0),
    new THREE.Vector3( 0,  -160,  0),
    new THREE.Vector3( 0,  -200,  0),
    new THREE.Vector3( 0,  -240,  0),
  ]);

  /* ═══════════════════════════════════════════════════
     13. COMETS — fast particles with glowing trails
  ═══════════════════════════════════════════════════ */
  const COMETS = [];
  {
    function mkComet(idx) {
      const color = idx % 2 === 0 ? 0xFF2060 : 0x00CCFF;
      const TAIL  = 16;
      const tBuf  = new Float32Array(TAIL * 3);
      const tGeo  = new THREE.BufferGeometry();
      tGeo.setAttribute('position', new THREE.BufferAttribute(tBuf, 3));
      tGeo.setDrawRange(0, 0);
      scene.add(new THREE.Line(tGeo, new THREE.LineBasicMaterial({
        color, transparent: true, opacity: .55, blending: THREE.AdditiveBlending,
      })));
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(.075, 6, 6),
        new THREE.MeshBasicMaterial({ color, blending: THREE.AdditiveBlending, transparent: true }),
      );
      scene.add(head);
      const ang = Math.random() * Math.PI * 2;
      return {
        head, tGeo, tBuf, TAIL, hist: [],
        pos: new THREE.Vector3((Math.random() - .5) * 40, (Math.random() - .5) * 40, (Math.random() - .5) * 6),
        dir: new THREE.Vector3(Math.cos(ang), Math.sin(ang) * .65, 0).normalize(),
        spd: .08 + Math.random() * .10,
      };
    }
    for (let i = 0; i < 7; i++) COMETS.push(mkComet(i));
  }

  /* ═══════════════════════════════════════════════════
     14. CONSTELLATION LINES — breathing star-connect
  ═══════════════════════════════════════════════════ */
  const CONST_LINES = [];
  {
    for (let i = 0; i < 30; i++) {
      const x1  = (Math.random() - .5) * 80;
      const y1  = (Math.random() - .5) * 120;
      const z1  = (Math.random() - .5) * 12;
      const len = 3 + Math.random() * 10;
      const ang = Math.random() * Math.PI * 2;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x1, y1, z1),
        new THREE.Vector3(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len * .5, z1),
      ]);
      const mat = new THREE.LineBasicMaterial({
        color: i % 3 === 2 ? 0x40D8FF : 0xFF5585,
        transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      });
      scene.add(new THREE.Line(geo, mat));
      CONST_LINES.push({ mat, ph: Math.random() * Math.PI * 2, fr: .2 + Math.random() * .35 });
    }
  }

  /* ═══════════════════════════════════════════════════
     15. BLACK HOLE LENSING RING  (Contact  Y ≈ -240)
  ═══════════════════════════════════════════════════ */
  let bhRingMesh;
  const BH_N = 300;
  const bhBuf = new Float32Array(BH_N * 3);
  const bhGeo = new THREE.BufferGeometry();
  {
    const ringPts = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * 2.8, Math.sin(a) * 2.8 * .28, 0));
    }
    bhRingMesh = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ringPts),
      new THREE.LineBasicMaterial({ color: 0xFF2060, transparent: true, opacity: .6, blending: THREE.AdditiveBlending })
    );
    bhRingMesh.position.set(0, -240, -1);
    scene.add(bhRingMesh);
    bhGeo.setAttribute('position', new THREE.BufferAttribute(bhBuf, 3));
    const bhMesh = new THREE.Points(bhGeo, new THREE.PointsMaterial({
      size: .065, map: SPR_ROSE, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: .8,
    }));
    bhMesh.position.set(0, -240, -1);
    scene.add(bhMesh);
  }

  /* ═══════════════════════════════════════════════════
     16. MORPHING ICOSAHEDRON  (Skills  Y ≈ -80)
  ═══════════════════════════════════════════════════ */
  let morphMesh, morphU;
  {
    morphU = { uTime: { value: 0 } };
    morphMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.2, 4),
      new THREE.ShaderMaterial({
        uniforms: morphU,
        vertexShader: `
          uniform float uTime;
          varying vec3 vN;
          void main() {
            vN = normalize(normalMatrix * normal);
            vec3 p = position;
            p += normal * (sin(p.x*4.0+uTime)*sin(p.y*4.0+uTime*1.3)*sin(p.z*4.0+uTime*.9)*0.2);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vN;
          uniform float uTime;
          void main() {
            float fres = pow(1.0 - abs(dot(vN, normalize(vec3(0.0,0.0,1.0)))), 2.0);
            vec3 col = mix(vec3(0.0,0.78,1.0), vec3(1.0,0.13,0.38), fres);
            gl_FragColor = vec4(col, fres * .65 + .04);
          }
        `,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    morphMesh.position.set(-3.8, -80, -1);
    scene.add(morphMesh);
  }

  /* ═══════════════════════════════════════════════════
     17. AUDIO-REACTIVE BARS RING  (hero sphere)
  ═══════════════════════════════════════════════════ */
  const audioBars = [];
  {
    const N_BARS = 48, RING_R = 5.5;
    for (let i = 0; i < N_BARS; i++) {
      const ang = (i / N_BARS) * Math.PI * 2;
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(.07, .3, .07),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xFF2060 : 0x00CCFF,
          transparent: true, opacity: .65, blending: THREE.AdditiveBlending,
        })
      );
      bar.position.set(Math.cos(ang) * RING_R + 1.8, 0, Math.sin(ang) * RING_R);
      bar.rotation.z = -ang;
      bar.userData = { phase: i * .13 };
      scene.add(bar);
      audioBars.push(bar);
    }
  }

  /* ═══════════════════════════════════════════════════
     18. SECTION TRANSITION BURST
  ═══════════════════════════════════════════════════ */
  let burstActive = false, burstT = 0;
  const BURST_N = 120;
  const burstPosBuf = new Float32Array(BURST_N * 3);
  const burstOriginV = new THREE.Vector3();
  const burstVelArr  = [];
  let burstGeo3D, burstMat3D;
  {
    burstGeo3D = new THREE.BufferGeometry();
    burstGeo3D.setAttribute('position', new THREE.BufferAttribute(burstPosBuf, 3));
    burstGeo3D.setDrawRange(0, 0);
    burstMat3D = new THREE.PointsMaterial({
      size: .22, map: SPR_ROSE, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(burstGeo3D, burstMat3D));
    for (let i = 0; i < BURST_N; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const th  = Math.random() * Math.PI * 2;
      burstVelArr.push(new THREE.Vector3(
        Math.sin(phi) * Math.cos(th) * (.6 + Math.random()),
        Math.sin(phi) * Math.sin(th) * (.6 + Math.random()),
        Math.cos(phi) * (.3 + Math.random() * .5)
      ));
    }
    window.__burst3D = function(camY) {
      burstOriginV.set(0, camY, 4);
      for (let i = 0; i < BURST_N; i++) {
        burstPosBuf[i*3]=0; burstPosBuf[i*3+1]=camY; burstPosBuf[i*3+2]=4;
      }
      burstGeo3D.setDrawRange(0, BURST_N);
      burstGeo3D.attributes.position.needsUpdate = true;
      burstMat3D.opacity = .9;
      burstActive = true; burstT = 0;
    };
  }

  /* ── Mouse + Scroll State ── */
  let mX = 0, mY = 0;
  let camT = 0, targetCamT = 0;
  let scrollVel = 0, lastScrollY = 0;
  let frameCount = 0;

  document.addEventListener('mousemove', e => {
    mX = (e.clientX / window.innerWidth  - .5) * 1.2;
    mY = (e.clientY / window.innerHeight - .5) * .7;
  });
  window.addEventListener('scroll', () => {
    const maxS = document.body.scrollHeight - window.innerHeight;
    targetCamT = maxS > 0 ? window.scrollY / maxS : 0;
    scrollVel  = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
  }, { passive: true });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ═══════════════════════════════════════════════════
     ANIMATION LOOP
  ═══════════════════════════════════════════════════ */
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    frameCount++;

    /* Camera spline */
    camT += (targetCamT - camT) * .038;
    const ct = THREE.MathUtils.clamp(camT, 0, .9999);
    const camPos  = CAM_SPLINE.getPoint(ct);
    const lookPos = LOOK_SPLINE.getPoint(ct);
    camera.position.lerp(
      camPos.clone().add(new THREE.Vector3(mX * .55, -mY * .38, 0)),
      .052
    );
    camera.lookAt(lookPos);

    /* Traveling lights follow camera */
    tLight1.position.set(camera.position.x + 2.5, camera.position.y + 1.5, camera.position.z + 3);
    tLight2.position.set(camera.position.x - 3,   camera.position.y - 2,   camera.position.z + 2);
    tLight1.intensity = 5 + Math.sin(t * 1.3) * 2;

    /* Galaxy slow rotate */
    galaxy.rotation.y = t * .006;

    /* Holographic sphere */
    holoU.uTime.value = t;
    holoMesh.rotation.y = t * .12;
    holoMesh.rotation.z = t * .06;

    /* Orbital particles */
    window.__updateOrbital(t);

    /* DNA helix spin */
    dnaGroup.rotation.y = t * .22;

    /* Wave grid (every 2nd frame for perf) */
    if (frameCount % 2 === 0) {
      const wAttr = waveGrid.geometry.attributes.position;
      const W = 55, H = 55;
      for (let i = 0; i < W * H; i++) {
        wAttr.array[i*3+1] = Math.sin(waveGX[i]*2.8 + t*2.0) * Math.cos(waveGZ[i]*2.8 + t*1.5) * .55;
      }
      wAttr.needsUpdate = true;
    }

    /* Floating crystals */
    crystals.forEach(c => {
      c.rotation.x += .006 * c.userData.sp * 2.8;
      c.rotation.y += .009 * c.userData.sp * 2.8;
      c.position.y  = c.userData.baseY + Math.sin(t * c.userData.sp + c.userData.phase) * .38;
    });

    /* Project screens float */
    screens.forEach((s, i) => {
      s.position.y = s.userData.baseY + Math.sin(t * s.userData.sp + s.userData.phase) * .22;
      s.rotation.y = (i - 2) * .22 + Math.sin(t * .28) * .04;
    });

    /* Contact vortex converge */
    const conv = THREE.MathUtils.smoothstep(camT, .82, .98);
    if (conv > 0 || camT > .8) {
      for (let i = 0; i < 900; i++) {
        const spiral = i * .04 + t * .6;
        vortexAttr.array[i*3]   = vortexHomeX[i] * (1 - conv) + Math.cos(spiral) * conv * .5;
        vortexAttr.array[i*3+1] = vortexHomeY[i] * (1 - conv);
        vortexAttr.array[i*3+2] = vortexHomeZ[i] * (1 - conv) + Math.sin(spiral) * conv * .5;
      }
      vortexAttr.needsUpdate = true;
    }

    /* Warp speed lines (velocity-driven) */
    scrollVel *= .82;
    const warpOpacity = Math.min(Math.abs(scrollVel) * .012, .55);
    warpLines.material.opacity = warpOpacity;
    if (warpOpacity > .02) {
      for (let i = 0; i < 350; i++) {
        const { theta, phi } = warpAngles[i];
        const life  = (t * .5 + i * .003) % 1.0;
        const near  = life * .4;
        const far   = near + .5 + life * 3;
        const sx = Math.sin(phi)*Math.cos(theta), sy = Math.cos(phi), sz = Math.sin(phi)*Math.sin(theta);
        warpPos[i*6]   = camera.position.x + sx * near;
        warpPos[i*6+1] = camera.position.y + sy * near;
        warpPos[i*6+2] = camera.position.z + sz * near - 3;
        warpPos[i*6+3] = camera.position.x + sx * far;
        warpPos[i*6+4] = camera.position.y + sy * far;
        warpPos[i*6+5] = camera.position.z + sz * far - 3;
      }
      warpLines.geometry.attributes.position.needsUpdate = true;
    }

    /* Comets */
    COMETS.forEach(c => {
      c.pos.addScaledVector(c.dir, c.spd);
      c.head.position.copy(c.pos);
      c.hist.unshift(c.pos.clone());
      if (c.hist.length > c.TAIL) c.hist.pop();
      if (c.pos.length() > 58) {
        const a = Math.random() * Math.PI * 2;
        c.pos.set((Math.random() - .5) * 30, (Math.random() - .5) * 30, (Math.random() - .5) * 5);
        c.dir.set(Math.cos(a), Math.sin(a) * .65, 0).normalize();
        c.hist = [];
      }
      const n = c.hist.length;
      for (let j = 0; j < n; j++) {
        c.tBuf[j*3] = c.hist[j].x; c.tBuf[j*3+1] = c.hist[j].y; c.tBuf[j*3+2] = c.hist[j].z;
      }
      c.tGeo.setDrawRange(0, n);
      c.tGeo.attributes.position.needsUpdate = true;
    });

    /* Constellation breathe */
    CONST_LINES.forEach(c => { c.mat.opacity = (.5 + .5 * Math.sin(t * c.fr + c.ph)) * .13; });

    /* Black hole lensing */
    bhRingMesh.rotation.z = t * .22;
    for (let i = 0; i < BH_N; i++) {
      const ang = (i / BH_N) * Math.PI * 2 + t * .85;
      const r   = 2.5 - ((t * .08 + i * .01) % 2.5);
      bhBuf[i*3]   = Math.cos(ang) * r;
      bhBuf[i*3+1] = Math.sin(ang) * r * .28;
      bhBuf[i*3+2] = 0;
    }
    bhGeo.attributes.position.needsUpdate = true;

    /* Morphing icosahedron */
    morphU.uTime.value = t;
    morphMesh.rotation.y = t * .16;
    morphMesh.rotation.x = t * .09;

    /* Audio bars */
    audioBars.forEach(b => {
      const h = .3 + .9 * Math.abs(Math.sin(t * 3.8 + b.userData.phase));
      b.scale.y = h / .3;
      b.material.opacity = .3 + h * .5;
    });

    /* Section burst */
    if (burstActive) {
      burstT += .04;
      for (let i = 0; i < BURST_N; i++) {
        burstPosBuf[i*3]   = burstOriginV.x + burstVelArr[i].x * burstT;
        burstPosBuf[i*3+1] = burstOriginV.y + burstVelArr[i].y * burstT;
        burstPosBuf[i*3+2] = burstOriginV.z + burstVelArr[i].z * burstT;
      }
      burstGeo3D.attributes.position.needsUpdate = true;
      burstMat3D.opacity = Math.max(0, .9 - burstT * .72);
      if (burstT > 1.25) { burstActive = false; burstGeo3D.setDrawRange(0, 0); }
    }

    renderer.render(scene, camera);
  }
  animate();

  /* ── Theme observer — update 3D colors ── */
  new MutationObserver(() => {
    const light = document.documentElement.dataset.theme === 'light';
    const cEdge = light ? new THREE.Color(0xE0004E) : new THREE.Color(0xFF2060);
    const cCore = light ? new THREE.Color(0xF5F5FF) : new THREE.Color(0x030308);
    holoU.uColorEdge.value.copy(cEdge);
    holoU.uColorCore.value.copy(cCore);
    tLight1.color.copy(cEdge);
    crystals.forEach((c, i) => {
      const emColor = i % 2 === 0 ? cEdge : new THREE.Color(0x00CCFF);
      c.material.emissive.copy(emColor);
    });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();

/* ══════════════════════════════════════════
   LOADER
══════════════════════════════════════════ */
(function () {
  const loader = document.getElementById('loader');
  const fill   = document.getElementById('loaderFill');
  const pct    = document.getElementById('loaderPct');
  if (!loader || !fill) return;
  let w = 0;
  const iv = setInterval(() => {
    w += Math.random() * 14;
    if (w >= 90) { clearInterval(iv); w = 90; }
    fill.style.width = w + '%';
    if (pct) pct.textContent = Math.floor(w) + '%';
  }, 80);
  window.addEventListener('load', () => {
    clearInterval(iv);
    fill.style.width = '100%';
    if (pct) pct.textContent = '100%';
    setTimeout(() => loader.classList.add('done'), 500);
  });
})();

/* ══════════════════════════════════════════
   CUSTOM CURSOR
══════════════════════════════════════════ */
(function () {
  const dot  = document.getElementById('cDot');
  const ring = document.getElementById('cRing');
  if (!dot || !ring) return;
  let mx=0, my=0, rx=0, ry=0;
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx+'px'; dot.style.top = my+'px';
  });
  (function raf() {
    rx += (mx-rx)*.09; ry += (my-ry)*.09;
    ring.style.left = rx+'px'; ring.style.top = ry+'px';
    requestAnimationFrame(raf);
  })();
  $$('a,button,[data-tilt],.bfl-btn').forEach(el => {
    el.addEventListener('mouseenter', () => { dot.classList.add('grow'); ring.classList.add('grow'); });
    el.addEventListener('mouseleave', () => { dot.classList.remove('grow'); ring.classList.remove('grow'); });
  });
})();

/* ══════════════════════════════════════════
   READ PROGRESS BAR
══════════════════════════════════════════ */
(function () {
  const bar = document.getElementById('readBar');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const p = window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100;
    bar.style.width = Math.min(p, 100) + '%';
  }, { passive: true });
})();

/* ══════════════════════════════════════════
   HEADER — sticky + active nav
══════════════════════════════════════════ */
(function () {
  const hdr   = document.getElementById('header');
  const links = $$('.nav-link');
  if (!hdr) return;
  window.addEventListener('scroll', () => {
    hdr.classList.toggle('stuck', window.scrollY > 60);
  }, { passive: true });
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(l => l.classList.remove('active'));
      const a = $(`.nav-link[href="#${e.target.id}"]`);
      if (a) a.classList.add('active');
    });
  }, { threshold: .28 });
  $$('section[id]').forEach(s => io.observe(s));
})();

/* ══════════════════════════════════════════
   MOBILE NAV
══════════════════════════════════════════ */
(function () {
  const ham   = document.getElementById('ham');
  const nav   = document.getElementById('mobNav');
  const close = document.getElementById('mobClose');
  if (!ham || !nav) return;
  const open = () => { nav.classList.add('open'); ham.classList.add('open'); document.body.style.overflow='hidden'; };
  const shut = () => { nav.classList.remove('open'); ham.classList.remove('open'); document.body.style.overflow=''; };
  ham.addEventListener('click', () => nav.classList.contains('open') ? shut() : open());
  if (close) close.addEventListener('click', shut);
  $$('.mob-a, .mob-resume').forEach(l => l.addEventListener('click', shut));
})();

/* ══════════════════════════════════════════
   SMOOTH SCROLL
══════════════════════════════════════════ */
$$('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = $(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

/* ══════════════════════════════════════════
   SCROLL REVEAL  [data-reveal]
══════════════════════════════════════════ */
(function () {
  const items = $$('[data-reveal]');
  if (!items.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const d = parseInt(e.target.dataset.delay || '0');
      setTimeout(() => e.target.classList.add('in'), d);
      io.unobserve(e.target);
    });
  }, { threshold: .08, rootMargin: '0px 0px -50px 0px' });
  items.forEach(el => io.observe(el));
})();

/* ══════════════════════════════════════════
   COUNTERS
══════════════════════════════════════════ */
(function () {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, end = parseInt(el.dataset.to);
      let n = 0;
      const iv = setInterval(() => {
        n = Math.min(n + end / 60, end);
        el.textContent = Math.floor(n);
        if (n >= end) clearInterval(iv);
      }, 18);
      io.unobserve(el);
    });
  }, { threshold: .6 });
  $$('.ctr-v1').forEach(el => io.observe(el)); // replaced by odometer below
})();

/* ══════════════════════════════════════════
   3D CARD TILT  [data-tilt]  + SHINE
══════════════════════════════════════════ */
(function () {
  $$('[data-tilt]').forEach(card => {
    const max = parseFloat(card.dataset.tilt) || 14;

    const shine = document.createElement('div');
    shine.className = 'card-shine';
    card.appendChild(shine);

    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - .5;
      const y = (e.clientY - r.top)  / r.height - .5;
      card.style.transform = `perspective(700px) rotateX(${-y*max}deg) rotateY(${x*max}deg) translateZ(8px)`;
      shine.style.setProperty('--sx', ((e.clientX - r.left) / r.width  * 100).toFixed(1) + '%');
      shine.style.setProperty('--sy', ((e.clientY - r.top)  / r.height * 100).toFixed(1) + '%');
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(700px) rotateX(0) rotateY(0) translateZ(0)';
    });
  });
})();

/* ══════════════════════════════════════════
   MAGNETIC BUTTONS
══════════════════════════════════════════ */
$$('.btn-primary,.btn-ghost,.btn-resume,.bfl-btn').forEach(btn => {
  btn.addEventListener('mousemove', e => {
    const r  = btn.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width/2) * .18;
    const dy = (e.clientY - r.top  - r.height/2) * .18;
    btn.style.transform = `translate(${dx}px,${dy}px)`;
  });
  btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
});

/* ══════════════════════════════════════════
   MOUSE SPOTLIGHT
══════════════════════════════════════════ */
(function () {
  const el = document.getElementById('spotlight');
  if (!el) return;
  document.addEventListener('mousemove', e => {
    el.style.setProperty('--mx', e.clientX + 'px');
    el.style.setProperty('--my', e.clientY + 'px');
  });
})();

/* ══════════════════════════════════════════
   SIDE DOT NAVIGATION
══════════════════════════════════════════ */
(function () {
  const dots = $$('.sn-dot');
  if (!dots.length) return;
  const sections = ['hero','about','skills','experience','projects','achievements','contact']
    .map(id => document.getElementById(id)).filter(Boolean);

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      dots.forEach(d => d.classList.remove('active'));
      const dot = $(`.sn-dot[href="#${e.target.id}"]`);
      if (dot) dot.classList.add('active');
    });
  }, { threshold: .35 });
  sections.forEach(s => io.observe(s));

  dots.forEach(d => {
    d.addEventListener('click', e => {
      e.preventDefault();
      const t = $(d.getAttribute('href'));
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();

/* ══════════════════════════════════════════
   HERO ROLE TYPEWRITER
══════════════════════════════════════════ */
(function () {
  const el = document.getElementById('roleText');
  if (!el) return;
  const ROLES = [
    'Full-Stack Engineer',
    'Blockchain Developer',
    'React & Node.js Dev',
    'Open-Source Builder',
    'UI / 3D Enthusiast',
  ];
  let ri = 0, ci = 0, deleting = false;
  const SPEED_TYPE = 55, SPEED_DEL = 30, PAUSE = 1900;

  function tick() {
    const role = ROLES[ri];
    if (!deleting) {
      el.textContent = role.slice(0, ++ci);
      if (ci === role.length) { deleting = true; setTimeout(tick, PAUSE); return; }
    } else {
      el.textContent = role.slice(0, --ci);
      if (ci === 0) { deleting = false; ri = (ri + 1) % ROLES.length; }
    }
    setTimeout(tick, deleting ? SPEED_DEL : SPEED_TYPE);
  }
  setTimeout(tick, 1000);
})();

/* ══════════════════════════════════════════
   HERO MOUSE PARALLAX LAYERS
══════════════════════════════════════════ */
(function () {
  const hero = document.getElementById('hero');
  if (!hero) return;
  const LAYERS = [
    { sel: '.hero-badge',   depth: 0.014 },
    { sel: '.hero-name',    depth: 0.040 },
    { sel: '.hero-sub',     depth: 0.026 },
    { sel: '.hero-desc',    depth: 0.016 },
    { sel: '.hero-cta',     depth: 0.022 },
    { sel: '.hero-socials', depth: 0.010 },
    { sel: '.hero-metrics', depth: -0.04 },
  ].map(l => ({ el: hero.querySelector(l.sel), depth: l.depth }))
   .filter(l => l.el);

  let tX = 0, tY = 0;
  const cX = new Float32Array(LAYERS.length);
  const cY = new Float32Array(LAYERS.length);

  document.addEventListener('mousemove', e => {
    tX = e.clientX - window.innerWidth  / 2;
    tY = e.clientY - window.innerHeight / 2;
  });

  setTimeout(() => {
    LAYERS.forEach(l => { l.el.style.transition = 'none'; });
    (function raf() {
      requestAnimationFrame(raf);
      const hs = hero.getBoundingClientRect();
      if (hs.bottom < 0 || hs.top > window.innerHeight) return;
      LAYERS.forEach((l, i) => {
        cX[i] += (tX * l.depth - cX[i]) * 0.07;
        cY[i] += (tY * l.depth - cY[i]) * 0.07;
        l.el.style.transform = `translate3d(${cX[i].toFixed(2)}px,${cY[i].toFixed(2)}px,0)`;
      });
    })();
  }, 2200);
})();

/* ══════════════════════════════════════════
   CLICK PARTICLE BURST
══════════════════════════════════════════ */
(function () {
  const COLORS = ['#FF2060', '#00CCFF', '#FF5585', '#C8FF00', '#40D8FF', '#FFB3C6'];
  document.addEventListener('click', e => {
    if (e.target.closest('a,button,input,textarea,select')) return;
    for (let i = 0; i < 10; i++) {
      const p = document.createElement('div');
      p.className = 'click-burst';
      const angle = (i / 10) * Math.PI * 2 + (Math.random() - .5) * .6;
      const dist  = 30 + Math.random() * 50;
      p.style.cssText =
        `left:${e.clientX}px;top:${e.clientY}px;` +
        `background:${COLORS[i % COLORS.length]};` +
        `--dx:${(Math.cos(angle) * dist).toFixed(1)}px;` +
        `--dy:${(Math.sin(angle) * dist).toFixed(1)}px;` +
        `animation-delay:${(i * 18)}ms`;
      document.body.appendChild(p);
      p.addEventListener('animationend', () => p.remove(), { once: true });
    }
  });
})();

/* ══════════════════════════════════════════
   THEME TOGGLE
══════════════════════════════════════════ */
(function () {
  const btn  = document.getElementById('themeToggle');
  const root = document.documentElement;
  if (!btn) return;
  const saved = localStorage.getItem('portfolio-theme') || 'dark';
  if (saved === 'light') root.setAttribute('data-theme', 'light');
  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    if (next === 'dark') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', 'light');
    localStorage.setItem('portfolio-theme', next);
  });
})();

/* ══════════════════════════════════════════
   SKILL TAG HOVER STAGGER
══════════════════════════════════════════ */
(function () {
  $$('.sg-tags span').forEach((tag, i) => {
    tag.style.transitionDelay = (i % 6) * 0.04 + 's';
  });
})();

/* ══════════════════════════════════════════
   TEXT SCRAMBLE — hero name on load
══════════════════════════════════════════ */
(function () {
  const el = document.querySelector('.hero-name');
  if (!el) return;
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@$%&*?!';
  // Wrap each line in a span to preserve the <br>
  const lines = el.innerText.split('\n').filter(l => l.trim());
  el.innerHTML = lines.map(l => `<span class="hn-s">${l}</span>`).join('<br>');
  const spans = [...el.querySelectorAll('.hn-s')];
  let frame = 0;
  const FRAMES = 26;
  function scramble() {
    spans.forEach(sp => {
      const orig = sp.dataset.orig || (sp.dataset.orig = sp.textContent);
      sp.textContent = orig.split('').map((ch, i) => {
        if (frame > FRAMES * (i / orig.length)) return ch;
        return ch === '.' ? ch : CHARS[Math.floor(Math.random() * CHARS.length)];
      }).join('');
    });
    if (frame++ < FRAMES) requestAnimationFrame(scramble);
    else spans.forEach(sp => { sp.textContent = sp.dataset.orig; });
  }
  setTimeout(scramble, 900);
})();

/* ══════════════════════════════════════════
   CURSOR TRAIL PARTICLES
══════════════════════════════════════════ */
(function () {
  if (window.matchMedia('(max-width:768px)').matches) return;
  const COLORS = ['#FF2060','#00CCFF','#FF5585','#C8FF00','#40D8FF'];
  let last = 0;
  document.addEventListener('mousemove', e => {
    const now = Date.now();
    if (now - last < 38) return;
    last = now;
    const p = document.createElement('div');
    p.className = 'cur-trail';
    p.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;` +
      `background:${COLORS[Math.floor(Math.random() * COLORS.length)]};` +
      `animation-duration:${(.45 + Math.random() * .25).toFixed(2)}s`;
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove(), { once: true });
  });
})();

/* ══════════════════════════════════════════
   SECTION HEADING CHAR SPLIT
══════════════════════════════════════════ */
(function () {
  $$('.sec-title').forEach(el => {
    const text = el.textContent;
    el.innerHTML = [...text].map((ch, i) =>
      ch === ' '
        ? '<span style="display:inline-block;width:.28em"> </span>'
        : `<span class="s-char" style="transition-delay:${(0.03 + i * 0.038).toFixed(3)}s">${ch}</span>`
    ).join('');
  });
})();

/* ══════════════════════════════════════════
   SKILL TAG CASCADE FLIP
══════════════════════════════════════════ */
(function () {
  const EASE = 'cubic-bezier(.22,1,.36,1)';
  $$('.sk-tags').forEach(row => {
    const tags = $$('span', row);
    tags.forEach((tag, i) => {
      tag.style.opacity = '0';
      tag.style.transform = 'perspective(400px) rotateX(-80deg) translateY(8px)';
      tag.style.transition = `opacity .45s ${EASE} ${(i * .055).toFixed(3)}s, transform .45s ${EASE} ${(i * .055).toFixed(3)}s`;
    });
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        tags.forEach(tag => {
          tag.style.opacity = '';
          tag.style.transform = '';
        });
        io.unobserve(e.target);
      });
    }, { threshold: .18 });
    io.observe(row);
  });
})();

/* ══════════════════════════════════════════
   TIMELINE SPINE DRAW-IN
══════════════════════════════════════════ */
(function () {
  const spine = document.querySelector('.tl-spine');
  const tl    = document.querySelector('.tl');
  if (!spine || !tl) return;
  spine.style.clipPath = 'inset(0 0 100% 0)';
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      spine.style.clipPath = 'inset(0 0 0% 0)';
      io.unobserve(e.target);
    });
  }, { threshold: .04 });
  io.observe(tl);
})();

/* ══════════════════════════════════════════
   BENTO CARD FLIP ENTRANCE
══════════════════════════════════════════ */
(function () {
  const EASE  = 'cubic-bezier(.22,1,.36,1)';
  const feat  = document.querySelector('.bento-feat');
  const cards = $$('.bc');

  function prep(el, delay) {
    el.style.opacity   = '0';
    el.style.transform = 'perspective(700px) rotateX(22deg) translateY(30px)';
    el.style.transition = `opacity .65s ${EASE} ${delay.toFixed(2)}s, transform .65s ${EASE} ${delay.toFixed(2)}s`;
  }
  function reveal(el) {
    el.style.opacity   = '1';
    el.style.transform = 'none';
    setTimeout(() => {
      el.style.opacity = el.style.transform = el.style.transition = '';
    }, 720);
  }

  if (feat) prep(feat, 0);
  cards.forEach((c, i) => prep(c, i * .1));

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      reveal(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: .08 });

  if (feat) io.observe(feat);
  cards.forEach(c => io.observe(c));
})();

/* ══════════════════════════════════════════
   MAGNETIC BENTO CARDS
══════════════════════════════════════════ */
(function () {
  $$('.bc, .bento-feat').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r  = card.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width  / 2) * .035;
      const dy = (e.clientY - r.top  - r.height / 2) * .035;
      card.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
})();

/* ══════════════════════════════════════════
   PAGE REVEAL WIPE
══════════════════════════════════════════ */
(function () {
  const wipe = document.getElementById('pageWipe');
  if (wipe) setTimeout(() => wipe.remove(), 1100);
})();

/* ══════════════════════════════════════════
   FILM GRAIN CANVAS
══════════════════════════════════════════ */
(function () {
  const cv = document.getElementById('filmGrain');
  if (!cv) return;
  const W = 256, H = 256;
  cv.width = W; cv.height = H;
  cv.style.cssText = 'width:100%;height:100%;position:fixed;inset:0;pointer-events:none;z-index:9999;opacity:.034;mix-blend-mode:overlay;';
  const ctx = cv.getContext('2d');
  function grain() {
    const img = ctx.createImageData(W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255 | 0;
      img.data[i] = img.data[i+1] = img.data[i+2] = v; img.data[i+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    requestAnimationFrame(grain);
  }
  grain();
})();

/* ══════════════════════════════════════════
   HERO GLITCH EFFECT
══════════════════════════════════════════ */
(function () {
  const el = document.querySelector('.hero-name');
  if (!el) return;
  function glitch() {
    el.classList.add('hero-glitch');
    setTimeout(() => el.classList.remove('hero-glitch'), 420);
    setTimeout(glitch, 5000 + Math.random() * 4000);
  }
  setTimeout(glitch, 3500);
})();

/* ══════════════════════════════════════════
   BLUR-TO-SHARP REVEAL
══════════════════════════════════════════ */
(function () {
  $$('.about-body p, .ct-sub, .bf-desc, .bc-body p').forEach(el => {
    el.classList.add('blur-reveal');
  });
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      setTimeout(() => e.target.classList.add('in'), 100);
      io.unobserve(e.target);
    });
  }, { threshold: .15 });
  $$('.blur-reveal').forEach(el => io.observe(el));
})();

/* ══════════════════════════════════════════
   ABOUT QUOTE TYPEWRITER
══════════════════════════════════════════ */
(function () {
  const el = document.querySelector('.about-quote');
  if (!el) return;
  const full = el.innerText.replace(/\n/g, ' ');
  el.textContent = '';
  let done = false;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting || done) return;
      done = true;
      let i = 0;
      function type() {
        el.textContent = '"' + full.replace(/^"/, '').replace(/"$/, '').slice(0, i) + (i < full.replace(/^"/, '').replace(/"$/, '').length ? '|' : '"');
        if (i++ <= full.length) setTimeout(type, 38);
      }
      type();
      io.unobserve(e.target);
    });
  }, { threshold: .5 });
  io.observe(el);
})();

/* ══════════════════════════════════════════
   BUTTON RIPPLE
══════════════════════════════════════════ */
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-primary,.btn-ghost,.btn-resume,.bfl-btn');
  if (!btn) return;
  const r   = btn.getBoundingClientRect();
  const sz  = Math.max(r.width, r.height);
  const rpl = document.createElement('span');
  rpl.className = 'btn-ripple';
  rpl.style.cssText = `width:${sz}px;height:${sz}px;left:${e.clientX-r.left-sz/2}px;top:${e.clientY-r.top-sz/2}px`;
  btn.appendChild(rpl);
  rpl.addEventListener('animationend', () => rpl.remove(), { once: true });
});

/* ══════════════════════════════════════════
   TIMELINE DOT PULSE
══════════════════════════════════════════ */
(function () {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const dot = e.target.querySelector('.tl-dot');
      if (dot) { dot.classList.add('dot-active'); }
      io.unobserve(e.target);
    });
  }, { threshold: .5 });
  $$('.tl-entry').forEach(el => io.observe(el));
})();

/* ══════════════════════════════════════════
   ACHIEVEMENT CARD FLIP
══════════════════════════════════════════ */
(function () {
  const BACK_TEXT = {
    'EthDenver Finalist':     'Impact & Public Goods track · EthDenver 2024',
    'Runner-Up — ETHGlobal':  'Best ZK Usage for Privacy · ETHGlobal 2024',
    'Winner — Agtech Hackathon': '1st place · 24-hour startup sprint · Jun 2023',
    'Winner — TheKey Incubator': '1st place · 48-hour startup · SettleOut · Mar 2023',
    'Mitacs Scholarship':     'Graduate research scholarship · U of Regina 2022',
    'MongoDB Associate Developer': 'Certified · mongodb.com',
    'Data Science Specialization': 'IBM · Coursera · 9-course series',
    'Front-End Web UI — Bootstrap 4': 'Coursera certified',
    'Applied Plotting in Python': 'Coursera · University of Michigan',
  };
  $$('.win-item, .cert-item').forEach(item => {
    const title = item.querySelector('strong');
    const key   = title ? title.textContent.trim() : '';
    const back  = BACK_TEXT[key] || key;
    const inner = document.createElement('div');
    inner.className = 'ach-flip-inner';
    const front = document.createElement('div');
    front.className = 'ach-front';
    while (item.firstChild) front.appendChild(item.firstChild);
    const backDiv = document.createElement('div');
    backDiv.className = 'ach-back';
    backDiv.textContent = back;
    inner.appendChild(front);
    inner.appendChild(backDiv);
    item.appendChild(inner);
  });
})();

/* ══════════════════════════════════════════
   MOUSE PROXIMITY GLOW
══════════════════════════════════════════ */
(function () {
  if (window.matchMedia('(max-width:768px)').matches) return;
  const targets = $$('.tl-card, .bento-feat, .bc, .win-item, .cert-item');
  document.addEventListener('mousemove', e => {
    targets.forEach(el => {
      const r  = el.getBoundingClientRect();
      const cx = r.left + r.width  / 2;
      const cy = r.top  + r.height / 2;
      const d  = Math.hypot(e.clientX - cx, e.clientY - cy);
      const glow = Math.max(0, 1 - d / 220);
      el.style.boxShadow = glow > .05
        ? `0 0 ${(glow * 28).toFixed(0)}px rgba(255,32,96,${(glow * .22).toFixed(3)})`
        : '';
    });
  });
})();

/* ══════════════════════════════════════════
   SECTION SCROLL GRADIENT SHIFT
══════════════════════════════════════════ */
(function () {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;opacity:0;transition:background 1s,opacity .5s';
  document.body.prepend(overlay);
  const COLORS = ['rgba(255,32,96,.04)','rgba(0,204,255,.04)','rgba(200,255,0,.03)',
                  'rgba(255,85,133,.04)','rgba(255,32,96,.04)','rgba(0,204,255,.04)','rgba(255,32,96,.04)'];
  let lastIdx = -1;
  window.addEventListener('scroll', () => {
    const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight);
    const idx = Math.min(Math.floor(pct * 7), 6);
    if (idx !== lastIdx) {
      lastIdx = idx;
      overlay.style.background = COLORS[idx];
      overlay.style.opacity = '1';
      if (typeof window.__burst3D === 'function') {
        const Y3D = [-0, -20, -40, -80, -120, -160, -240][idx] || 0;
        window.__burst3D(Y3D);
      }
    }
  }, { passive: true });
})();

/* ══════════════════════════════════════════
   ODOMETER COUNTER  (slot-machine style)
══════════════════════════════════════════ */
(function () {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el  = e.target;
      const end = parseInt(el.dataset.to);
      let frame = 0;
      const FRAMES = 38;
      function tick() {
        if (frame < FRAMES * .65) {
          el.textContent = Math.floor(Math.random() * 99);
        } else {
          const p = (frame - FRAMES * .65) / (FRAMES * .35);
          el.textContent = Math.round(end * Math.min(p, 1));
        }
        if (frame++ < FRAMES) requestAnimationFrame(tick);
        else el.textContent = end;
      }
      tick();
      io.unobserve(el);
    });
  }, { threshold: .6 });
  $$('.ctr').forEach(el => io.observe(el));
})();

/* ══════════════════════════════════════════
   SIDE NAV DOT TRAIL
══════════════════════════════════════════ */
(function () {
  let activeDot = null;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const next = document.querySelector(`.sn-dot[href="#${e.target.id}"]`);
      if (next && activeDot && next !== activeDot) {
        const rA = activeDot.getBoundingClientRect();
        const rB = next.getBoundingClientRect();
        const steps = 6;
        for (let i = 0; i < steps; i++) {
          const t  = document.createElement('div');
          t.className = 'sn-trail';
          const p = i / steps;
          t.style.cssText = `left:${(rA.left + (rB.left - rA.left) * p + 2).toFixed(0)}px;` +
            `top:${(rA.top + (rB.top - rA.top) * p + 2).toFixed(0)}px;` +
            `animation-delay:${(i * .04).toFixed(2)}s`;
          document.body.appendChild(t);
          t.addEventListener('animationend', () => t.remove(), { once: true });
        }
      }
      activeDot = next;
    });
  }, { threshold: .35 });
  $$('section[id]').forEach(s => io.observe(s));
})();

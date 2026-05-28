/* ──────────────────────────────────────────────────────────────
   desktop.js v2 — Cinematic 3D-Studio + Desktop-OS
   Top-Tier-Design-Pass: ACES Tone-Mapping, RectAreaLights,
   Curved Monitor, Bias-Light, Wall-LEDs, Ambient Hum
   ────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from './vendor/three/RectAreaLightUniformsLib.js';

RectAreaLightUniformsLib.init();

/* ════════════════════════════════════════════════════════════
   1. SOUND-SYSTEM
   ════════════════════════════════════════════════════════════ */
class Sounds {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.ambient = null;
  }
  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.45;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.linearRampToValueAtTime(m ? 0 : 0.45, this.ctx.currentTime + 0.4);
  }
  /* Ambient: sehr leiser Raum-Hum (Bass-Sinus + gefiltertes Rauschen) */
  startAmbient() {
    if (!this.ctx) return;
    // Bass-Hum
    const o = this.ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = 58;
    const og = this.ctx.createGain(); og.gain.value = 0.06;
    o.connect(og).connect(this.master);
    o.start();
    // Wind / Hauch (gefiltertes Rauschen)
    const bufSize = 2 * this.ctx.sampleRate;
    const noise = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = this.ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 220; filt.Q.value = 0.6;
    const ng = this.ctx.createGain(); ng.gain.value = 0.035;
    src.connect(filt).connect(ng).connect(this.master);
    src.start();
    this.ambient = { o, src, og, ng };
  }
  tone({ freq = 600, dur = 0.12, type = 'sine', vol = 0.25, attack = 0.008, release = null }) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (release ?? dur));
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  glide({ from, to, dur = 0.3, type = 'sine', vol = 0.25 }) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  click()        { this.tone({ freq: 2200, dur: 0.045, type: 'triangle', vol: 0.13, attack: 0.001, release: 0.045 }); }
  hover()        { this.tone({ freq: 1400, dur: 0.04, type: 'sine', vol: 0.06 }); }
  iconSelect()   { this.tone({ freq: 880,  dur: 0.08, type: 'sine', vol: 0.13 }); }
  monitorWake()  {
    // Sanfter Power-Glide
    this.glide({ from: 180, to: 880, dur: 0.55, type: 'sine', vol: 0.18 });
    setTimeout(() => this.tone({ freq: 1320, dur: 0.18, type: 'sine', vol: 0.14 }), 580);
  }
  windowOpen()   {
    this.glide({ from: 520, to: 880, dur: 0.22, type: 'sine', vol: 0.18 });
  }
  windowClose()  {
    this.glide({ from: 660, to: 280, dur: 0.18, type: 'sine', vol: 0.16 });
  }
  boot() {
    // sanfter Dur-Akkord
    [392, 523, 659, 784].forEach((f, i) => {
      setTimeout(() => this.tone({ freq: f, dur: 0.42, type: 'sine', vol: 0.16, release: 0.5 }), i * 110);
    });
  }
}
const sounds = new Sounds();

/* ════════════════════════════════════════════════════════════
   2. 3D STUDIO
   ════════════════════════════════════════════════════════════ */
class Studio3D {
  constructor(canvas) {
    this.canvas = canvas;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setClearColor(0x05060a, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Scene & Fog
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x06060c, 0.055);

    // Camera
    const ar = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(38, ar, 0.05, 60);
    this.cameraIdle = new THREE.Vector3(0, 1.62, 4.4);
    this.camera.position.copy(this.cameraIdle);
    this.camera.lookAt(0, 1.35, 0);

    // Helpers
    this.mouse = new THREE.Vector2(0, 0);
    this.mouseTarget = new THREE.Vector2(0, 0);
    this.raycaster = new THREE.Raycaster();
    this.zooming = false;
    this.t = 0;

    // Build
    this.buildRoom();
    this.buildDesk();
    this.buildPC();
    this.buildPeripherals();
    this.buildWallArt();
    this.buildLights();
    this.buildParticles();

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('pointermove', e => this.onPointerMove(e));
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }
  onPointerMove(e) {
    this.mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouseTarget.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  /* ── Raum ─────────────────────────────────────────────────── */
  buildRoom() {
    const room = new THREE.Group();

    // Boden — dunkles Holz/Beton-Look mit leichter Reflektion
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({
        color: 0x14101a,
        roughness: 0.55,
        metalness: 0.15,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    room.add(floor);

    // Rückwand — dunkel mit subtilem Gradient
    const backMat = new THREE.MeshStandardMaterial({
      color: 0x1a1426,
      roughness: 0.95,
      metalness: 0.0,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), backMat);
    back.position.set(0, 3.2, -3);
    back.receiveShadow = true;
    room.add(back);

    // Seitenwände
    const sideMat = new THREE.MeshStandardMaterial({
      color: 0x141022,
      roughness: 0.95,
    });
    const left = new THREE.Mesh(new THREE.PlaneGeometry(8, 7), sideMat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-5.5, 3.2, 0);
    left.receiveShadow = true;
    room.add(left);

    const right = left.clone();
    right.rotation.y = -Math.PI / 2;
    right.position.set(5.5, 3.2, 0);
    room.add(right);

    // Decke
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 8),
      new THREE.MeshStandardMaterial({ color: 0x0a0612, roughness: 1 })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 6.7, 0);
    room.add(ceil);

    // ── Fenster mit Nachtstadt-Skyline ───────────────────────
    const skylineCanvas = this.makeSkylineCanvas();
    const skyTex = new THREE.CanvasTexture(skylineCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const windowFrame = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 1.9),
      new THREE.MeshBasicMaterial({ map: skyTex })
    );
    windowFrame.position.set(-3.5, 3.8, -2.97);
    room.add(windowFrame);
    this.skylineCanvas = skylineCanvas;
    this.skyTex = skyTex;

    // Fensterrahmen (dünner schwarzer Rand)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.35, metalness: 0.6 });
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.05, 0.06), frameMat);
    frameTop.position.set(-3.5, 4.78, -2.95);
    room.add(frameTop);
    const frameBot = frameTop.clone(); frameBot.position.set(-3.5, 2.82, -2.95); room.add(frameBot);
    const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.0, 0.06), frameMat);
    frameLeft.position.set(-5.32, 3.8, -2.95); room.add(frameLeft);
    const frameRight = frameLeft.clone(); frameRight.position.set(-1.68, 3.8, -2.95); room.add(frameRight);
    // Mittelkreuz
    const frameCross = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.03, 0.06), frameMat);
    frameCross.position.set(-3.5, 3.8, -2.94); room.add(frameCross);
    const frameCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.0, 0.06), frameMat);
    frameCrossV.position.set(-3.5, 3.8, -2.94); room.add(frameCrossV);

    this.scene.add(room);
  }

  makeSkylineCanvas() {
    const c = document.createElement('canvas');
    c.width = 720; c.height = 380;
    const g = c.getContext('2d');
    // Nachthimmel: tiefblau → schwarz
    const grd = g.createLinearGradient(0, 0, 0, c.height);
    grd.addColorStop(0, '#0a1430');
    grd.addColorStop(0.55, '#1a0e2e');
    grd.addColorStop(1, '#050208');
    g.fillStyle = grd;
    g.fillRect(0, 0, c.width, c.height);
    // Sterne
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * c.width;
      const y = Math.random() * c.height * 0.55;
      const r = Math.random() * 1.2;
      g.globalAlpha = 0.3 + Math.random() * 0.7;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // Skyline-Silhouette
    g.fillStyle = '#000';
    const bx = [];
    let x = 0;
    while (x < c.width) {
      const w = 20 + Math.random() * 60;
      const h = 40 + Math.random() * 130;
      bx.push({ x, w, h });
      g.fillRect(x, c.height - h, w, h);
      x += w;
    }
    // Fenster-Lichter in Gebäuden (kleine warme Punkte)
    for (const b of bx) {
      const rows = Math.floor(b.h / 14);
      const cols = Math.floor(b.w / 8);
      for (let r = 0; r < rows; r++) {
        for (let cc = 0; cc < cols; cc++) {
          if (Math.random() < 0.32) {
            const lx = b.x + 2 + cc * 8;
            const ly = c.height - b.h + 2 + r * 14;
            // warmes Gelb mit leichtem Glow
            g.fillStyle = Math.random() < 0.85 ? '#ffd882' : '#3affe6';
            g.fillRect(lx, ly, 3, 4);
          }
        }
      }
    }
    return c;
  }

  /* ── Schreibtisch (mattschwarz + Front-LED-Streifen gelb) ─ */
  buildDesk() {
    const desk = new THREE.Group();

    // Top — mattschwarzes Glas (mit Reflektion der Neon-Beleuchtung)
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x0c0a18,
      roughness: 0.22,
      metalness: 0.72,
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 1.7), topMat);
    top.position.set(0, 1.0, 0);
    top.castShadow = true;
    top.receiveShadow = true;
    desk.add(top);

    // Front-LED-Streifen (neon gelb, leuchtet zum Boden)
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xf6ff3a });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(4.05, 0.04), stripMat);
    strip.rotation.x = Math.PI / 2;
    strip.position.set(0, 0.96, 0.85);
    desk.add(strip);

    // Beine — schlank, mattschwarz
    const legMat = new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.4, metalness: 0.7 });
    const legGeo = new THREE.BoxGeometry(0.06, 1.0, 0.06);
    [[-1.95, 0.5, -0.7], [1.95, 0.5, -0.7], [-1.95, 0.5, 0.7], [1.95, 0.5, 0.7]].forEach(p => {
      const l = new THREE.Mesh(legGeo, legMat);
      l.position.set(...p);
      l.castShadow = true;
      desk.add(l);
    });

    this.scene.add(desk);
  }

  /* ── PC: Ultrawide-Monitor, Tower mit Glas-Side ──────────── */
  buildPC() {
    const pc = new THREE.Group();

    // ── Ultrawide Flat Monitor — Bezel als sehr dünne Box ──
    const monW = 2.4;   // ultrawide
    const monH = 1.0;
    const monD = 0.06;
    const monY = 1.85;
    const monZ = -0.55;

    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x05060a,
      roughness: 0.35,
      metalness: 0.7,
    });
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(monW, monH, monD), bezelMat);
    bezel.position.set(0, monY, monZ);
    bezel.castShadow = true;
    pc.add(bezel);

    // ── Screen — leuchtend ──────────────────────────────────
    const scrCanvas = this.makeScreenCanvas();
    const scrTex = new THREE.CanvasTexture(scrCanvas);
    scrTex.colorSpace = THREE.SRGBColorSpace;
    this.screenMaterial = new THREE.MeshBasicMaterial({ map: scrTex });
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(monW - 0.04, monH - 0.04),
      this.screenMaterial
    );
    screen.position.set(0, monY, monZ + monD / 2 + 0.002);
    pc.add(screen);
    this.screen = screen;

    // RectAreaLight VOR dem Monitor → leuchtet Tisch + Gesicht
    const screenLight = new THREE.RectAreaLight(0x7080ff, 12, monW - 0.1, monH - 0.1);
    screenLight.position.set(0, monY, monZ + monD / 2 + 0.01);
    screenLight.lookAt(0, monY - 0.4, monZ + 2);
    pc.add(screenLight);
    this.screenLight = screenLight;

    // Ergänzender PointLight für den Tisch unter dem Monitor
    const screenPoint = new THREE.PointLight(0x7090ff, 1.4, 3.2, 1.6);
    screenPoint.position.set(0, 1.65, monZ + 0.4);
    pc.add(screenPoint);
    this.screenPoint = screenPoint;

    // ── Bias-Light HINTER dem Monitor (LED-Strip → Wand) ────
    const biasMat = new THREE.MeshBasicMaterial({ color: 0xa050ff });
    const bias = new THREE.Mesh(new THREE.PlaneGeometry(monW - 0.2, 0.06), biasMat);
    bias.position.set(0, monY + monH / 2 + 0.1, monZ - 0.05);
    pc.add(bias);
    const biasLight = new THREE.PointLight(0xa050ff, 2.4, 4.5, 1.5);
    biasLight.position.set(0, monY + 0.4, monZ - 0.6);
    pc.add(biasLight);
    this.biasLight = biasLight;

    // Power-LED unten am Bezel
    const led = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x3affc8 })
    );
    led.position.set(0, monY - monH / 2 + 0.04, monZ + monD / 2 + 0.001);
    pc.add(led);

    // Monitor-Stand: dünner Arm
    const armMat = new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.4, metalness: 0.7 });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.06), armMat);
    arm.position.set(0, 1.22, monZ);
    arm.castShadow = true;
    pc.add(arm);
    // Stand-Sockel
    const standBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 0.025, 24),
      armMat
    );
    standBase.position.set(0, 1.04, monZ);
    standBase.castShadow = true;
    pc.add(standBase);

    // Hot-Zone für Raycaster
    const hot = new THREE.Mesh(
      new THREE.PlaneGeometry(monW + 0.1, monH + 0.1),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hot.position.set(0, monY, monZ + monD / 2 + 0.03);
    pc.add(hot);
    this.monitorHotZone = hot;

    // ── Tower-PC (mit Glas-Panel & sichtbaren RGB-Lüftern) ──
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x06070c, roughness: 0.35, metalness: 0.6 });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.78, 0.46), towerMat);
    tower.position.set(2.2, 0.4, 0.1);
    tower.castShadow = true;
    pc.add(tower);
    // Glas-Panel
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x000510,
      roughness: 0.05,
      metalness: 0.0,
      transmission: 0.4,
      transparent: true,
      opacity: 0.55,
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.7), glassMat);
    glass.position.set(2.2, 0.4, 0.34);
    pc.add(glass);
    // RGB-Lüfter dahinter (3 kleine emissive Discs)
    for (let i = 0; i < 3; i++) {
      const color = [0xa050ff, 0x3affe6, 0xff3aa0][i];
      const fan = new THREE.Mesh(
        new THREE.CircleGeometry(0.09, 24),
        new THREE.MeshBasicMaterial({ color })
      );
      fan.position.set(2.2, 0.7 - i * 0.22, 0.25);
      pc.add(fan);
      const fanLight = new THREE.PointLight(color, 0.7, 1.2, 2);
      fanLight.position.set(2.2, 0.7 - i * 0.22, 0.4);
      pc.add(fanLight);
    }
    // Power-LED am Tower vorne
    const towerLed = new THREE.Mesh(
      new THREE.PlaneGeometry(0.03, 0.015),
      new THREE.MeshBasicMaterial({ color: 0x3affe6 })
    );
    towerLed.position.set(2.05, 0.74, 0.341);
    pc.add(towerLed);

    this.scene.add(pc);
  }

  makeScreenCanvas() {
    const c = document.createElement('canvas');
    c.width = 540; c.height = 220;   // 21:9-ish
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, c.width, c.height);
    grd.addColorStop(0,    '#1a2880');
    grd.addColorStop(0.5,  '#3c2a8c');
    grd.addColorStop(1,    '#1a0e30');
    g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);

    // Soft glow blob
    const rg = g.createRadialGradient(270, 110, 20, 270, 110, 220);
    rg.addColorStop(0, 'rgba(168, 120, 255, 0.55)');
    rg.addColorStop(1, 'rgba(168, 120, 255, 0)');
    g.fillStyle = rg; g.fillRect(0, 0, c.width, c.height);

    // Brand
    g.font = 'bold 46px "JetBrains Mono", monospace';
    g.fillStyle = 'rgba(246, 255, 58, 0.96)';
    g.textAlign = 'center';
    g.fillText('TIM·ULRICH', 270, 118);
    g.font = '13px "JetBrains Mono", monospace';
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText('• klick mich · der PC fährt hoch •', 270, 150);

    // Subtile Grid-Linien
    g.strokeStyle = 'rgba(255,255,255,0.07)';
    g.lineWidth = 1;
    for (let x = 0; x < c.width; x += 32) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke();
    }
    for (let y = 0; y < c.height; y += 32) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke();
    }
    // Scanlines (sehr subtil)
    g.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 0; y < c.height; y += 3) g.fillRect(0, y, c.width, 1);
    return c;
  }

  /* ── Peripherie: Tastatur, Maus, Speaker, Headphones … ─── */
  buildPeripherals() {
    const matDark = new THREE.MeshStandardMaterial({ color: 0x06070c, roughness: 0.4, metalness: 0.5 });
    const matAccent = new THREE.MeshStandardMaterial({ color: 0x18141e, roughness: 0.6, metalness: 0.3 });

    // ── Tastatur ─────────────────────────────────────────────
    const kb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.34), matAccent);
    kb.position.set(0, 1.06, 0.3);
    kb.castShadow = true;
    this.scene.add(kb);
    // Tasten-Oberfläche (heller Streifen)
    const keysSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x0c0d12, roughness: 0.75 })
    );
    keysSurface.rotation.x = -Math.PI / 2;
    keysSurface.position.set(0, 1.082, 0.3);
    this.scene.add(keysSurface);
    // RGB-Underglow (heller emissive Streifen unter der Tastatur)
    const kbGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.12, 0.36),
      new THREE.MeshBasicMaterial({ color: 0xa050ff, transparent: true, opacity: 0.55 })
    );
    kbGlow.rotation.x = -Math.PI / 2;
    kbGlow.position.set(0, 1.045, 0.3);
    this.scene.add(kbGlow);
    const kbLight = new THREE.PointLight(0xa050ff, 0.5, 1.0, 2);
    kbLight.position.set(0, 1.1, 0.3);
    this.scene.add(kbLight);

    // ── Maus (klar erkennbar, mit Glow) ──────────────────────
    const mouseBase = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 16, 12),
      matDark
    );
    mouseBase.scale.set(1, 0.45, 1.5);
    mouseBase.position.set(0.78, 1.085, 0.4);
    mouseBase.castShadow = true;
    this.scene.add(mouseBase);
    // Maus-Scroll-Wheel (dunkler Ring)
    const wheel = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.028, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.5 })
    );
    wheel.position.set(0.78, 1.118, 0.36);
    this.scene.add(wheel);
    // Maus-Underglow
    const mouseGlow = new THREE.Mesh(
      new THREE.CircleGeometry(0.12, 24),
      new THREE.MeshBasicMaterial({ color: 0x3affe6, transparent: true, opacity: 0.5 })
    );
    mouseGlow.rotation.x = -Math.PI / 2;
    mouseGlow.position.set(0.78, 1.045, 0.4);
    this.scene.add(mouseGlow);

    // Mauspad
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x09080d, roughness: 0.92 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0.78, 1.044, 0.4);
    this.scene.add(pad);
    // Pad-Edge-Glow (cyan)
    const padEdge = new THREE.Mesh(
      new THREE.RingGeometry(0.245, 0.27, 32),
      new THREE.MeshBasicMaterial({ color: 0x3affe6, transparent: true, opacity: 0.5 })
    );
    padEdge.rotation.x = -Math.PI / 2;
    padEdge.position.set(0.78, 1.0445, 0.4);
    padEdge.scale.set(1, 0.72, 1);
    this.scene.add(padEdge);

    // ── Speaker (links und rechts vom Monitor) ──────────────
    const spkMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.6, metalness: 0.3 });
    const speakerLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.16), spkMat);
    speakerLeft.position.set(-1.4, 1.22, -0.3);
    speakerLeft.castShadow = true;
    this.scene.add(speakerLeft);
    // Membran (Kreis)
    const memMat = new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.85 });
    const memL = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24), memMat);
    memL.position.set(-1.4 + 0.071, 1.22, -0.3);
    memL.rotation.y = Math.PI / 2;
    this.scene.add(memL);
    const speakerRight = speakerLeft.clone(); speakerRight.position.set(1.4, 1.22, -0.3); this.scene.add(speakerRight);
    const memR = memL.clone(); memR.position.set(1.4 - 0.071, 1.22, -0.3); memR.rotation.y = -Math.PI / 2; this.scene.add(memR);
    // LED-Punkte
    [-1.4, 1.4].forEach(x => {
      const led = new THREE.Mesh(
        new THREE.PlaneGeometry(0.02, 0.01),
        new THREE.MeshBasicMaterial({ color: 0x3affe6 })
      );
      led.position.set(x, 1.07, -0.215);
      led.rotation.x = -Math.PI / 2;
      this.scene.add(led);
    });

    // ── Headphones auf Stand (links) ─────────────────────────
    const standMat = new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.4, metalness: 0.6 });
    const hpPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 12), standMat);
    hpPole.position.set(-1.85, 1.2, 0.5);
    this.scene.add(hpPole);
    const hpBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.02, 24), standMat);
    hpBase.position.set(-1.85, 1.05, 0.5);
    this.scene.add(hpBase);
    // Headphone-Bügel
    const hpBow = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.014, 8, 24, Math.PI * 1.1),
      new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.4, metalness: 0.4 })
    );
    hpBow.rotation.z = Math.PI;
    hpBow.position.set(-1.85, 1.42, 0.5);
    this.scene.add(hpBow);
    // Headphone Earcups
    [-0.11, 0.11].forEach(off => {
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.05, 18),
        new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.5 })
      );
      cup.rotation.z = Math.PI / 2;
      cup.position.set(-1.85 + off, 1.3, 0.5);
      this.scene.add(cup);
    });

    // ── Becher (Kaffee, mit dezenter LED-Akzent-Ring) ───────
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.06, 0.14, 18),
      new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.45, metalness: 0.3 })
    );
    mug.position.set(-1.05, 1.11, 0.55);
    mug.castShadow = true;
    this.scene.add(mug);
    const mugHandle = new THREE.Mesh(
      new THREE.TorusGeometry(0.04, 0.01, 8, 16, Math.PI),
      mug.material.clone()
    );
    mugHandle.position.set(-1.13, 1.11, 0.55);
    mugHandle.rotation.y = Math.PI / 2;
    this.scene.add(mugHandle);
    // „Kaffee"-Oberfläche
    const coffee = new THREE.Mesh(
      new THREE.CircleGeometry(0.062, 24),
      new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.5 })
    );
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.set(-1.05, 1.18, 0.55);
    this.scene.add(coffee);

    // ── Notepad + Stift ──────────────────────────────────────
    const notepad = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.012, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.85 })
    );
    notepad.position.set(-0.85, 1.05, 0.55);
    notepad.rotation.y = 0.18;
    notepad.castShadow = true;
    this.scene.add(notepad);
    // Linien auf dem Notepad (zarte Andeutung)
    const noteLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.001),
      new THREE.MeshBasicMaterial({ color: 0xa0a8b8 })
    );
    for (let i = 0; i < 5; i++) {
      const l = noteLine.clone();
      l.rotation.x = -Math.PI / 2;
      const pos = new THREE.Vector3(-0.85, 1.057, 0.42 + i * 0.06);
      pos.applyAxisAngle(new THREE.Vector3(0,1,0), 0.18 - 0);
      // simple inplace
      l.position.set(-0.85 + (0.06 * i * 0.18 / 5), 1.057, 0.42 + i * 0.06);
      this.scene.add(l);
    }
    // Stift
    const pen = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.4 })
    );
    pen.position.set(-0.7, 1.062, 0.55);
    pen.rotation.z = Math.PI / 2;
    pen.rotation.y = 0.4;
    this.scene.add(pen);
    // Stift-Spitze (Akzent-Farbe)
    const penTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.008, 0.03, 8),
      new THREE.MeshStandardMaterial({ color: 0xa050ff, emissive: 0xa050ff, emissiveIntensity: 0.3 })
    );
    penTip.position.copy(pen.position);
    penTip.position.x += 0.1;
    penTip.rotation.copy(pen.rotation);
    this.scene.add(penTip);

    // ── Smartphone — Bildschirm leuchtet leicht ─────────────
    const phone = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.01, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.3, metalness: 0.7 })
    );
    phone.position.set(1.1, 1.05, 0.55);
    phone.rotation.y = -0.1;
    phone.castShadow = true;
    this.scene.add(phone);
    const phoneScr = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.28),
      new THREE.MeshBasicMaterial({ color: 0x1a1a3a })
    );
    phoneScr.rotation.x = -Math.PI / 2;
    phoneScr.position.set(1.1, 1.061, 0.55);
    phoneScr.rotation.y = -0.1; // rotate axis around y
    // korrekt rotieren:
    phoneScr.rotation.set(-Math.PI / 2, 0, 0);
    phoneScr.position.set(1.1, 1.061, 0.55);
    this.scene.add(phoneScr);

    // ── Pflanze (Top-Pflanze, etwas detaillierter) ──────────
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.08, 0.16, 16),
      new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.85 })
    );
    pot.position.set(1.85, 1.12, 0.5);
    pot.castShadow = true;
    this.scene.add(pot);
    // Blätter (mehrere kleine Spheres)
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7048, roughness: 0.7, emissive: 0x0a2010, emissiveIntensity: 0.2 });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const r = 0.12 + Math.random() * 0.05;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07 + Math.random() * 0.03, 10, 8), leafMat);
      leaf.scale.set(1, 1.5, 0.7);
      leaf.position.set(
        1.85 + Math.cos(ang) * r * 0.6,
        1.32 + Math.random() * 0.1,
        0.5 + Math.sin(ang) * r * 0.6
      );
      this.scene.add(leaf);
    }

    // ── Tisch-Tablet/Buch (klein, vorne mittig-rechts) ─────
    // ausgelassen — Tisch sollte nicht überladen sein
  }

  /* ── Wandkunst: LED-Strips, Neon-Sign, Poster ──────────── */
  buildWallArt() {
    // ── Vertikale LED-Strips an der Rückwand (lila) ──────────
    const stripPositions = [-2.3, -1.7, 1.7, 2.3];
    stripPositions.forEach((x, idx) => {
      const c = idx % 2 === 0 ? 0xa050ff : 0xc870ff;
      const stripMat = new THREE.MeshBasicMaterial({ color: c });
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 4.5), stripMat);
      strip.position.set(x, 3.3, -2.97);
      this.scene.add(strip);
      // Lichtquelle für den Strip (PointLight)
      const stripLight = new THREE.PointLight(c, 1.0, 3.5, 2);
      stripLight.position.set(x, 3.3, -2.5);
      this.scene.add(stripLight);
    });

    // ── Rechte Seitenwand: Cyan LED Strip horizontal ────────
    const sideStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, 3.5),
      new THREE.MeshBasicMaterial({ color: 0x3affe6 })
    );
    sideStrip.rotation.y = -Math.PI / 2;
    sideStrip.position.set(5.47, 3.3, 0.5);
    sideStrip.rotation.z = Math.PI / 2;
    this.scene.add(sideStrip);
    const sideLight = new THREE.PointLight(0x3affe6, 0.9, 3.5, 2);
    sideLight.position.set(4.7, 3.3, 0.5);
    this.scene.add(sideLight);

    // ── Neon-Sign rechts oben („T·U") ───────────────────────
    // Schwebt rechts oben in pink, wirkt wie Neon-Schild
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256; signCanvas.height = 128;
    const sg = signCanvas.getContext('2d');
    sg.fillStyle = '#0a0612'; sg.fillRect(0, 0, 256, 128);
    sg.font = 'bold 80px "JetBrains Mono", monospace';
    sg.textAlign = 'center';
    sg.fillStyle = '#ff3aa0';
    sg.shadowColor = '#ff3aa0';
    sg.shadowBlur = 22;
    sg.fillText('T·U', 128, 92);
    const signTex = new THREE.CanvasTexture(signCanvas);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.5),
      new THREE.MeshBasicMaterial({ map: signTex, transparent: true })
    );
    sign.position.set(3.7, 4.4, -2.96);
    this.scene.add(sign);
    const signGlow = new THREE.PointLight(0xff3aa0, 1.6, 3.5, 2);
    signGlow.position.set(3.7, 4.4, -2.5);
    this.scene.add(signGlow);

    // ── Gerahmtes Poster (mittig zwischen den LED-Strips) ──
    const posterCanvas = document.createElement('canvas');
    posterCanvas.width = 320; posterCanvas.height = 460;
    const pg = posterCanvas.getContext('2d');
    // Hintergrund: Cream
    pg.fillStyle = '#f7f1e3'; pg.fillRect(0, 0, 320, 460);
    pg.fillStyle = '#1a1410';
    pg.font = 'bold 56px "Fraunces", serif';
    pg.textAlign = 'center';
    pg.fillText('STAY', 160, 130);
    pg.fillStyle = '#c8421b';
    pg.font = 'italic 56px "Fraunces", serif';
    pg.fillText('CURIOUS', 160, 200);
    pg.fillStyle = '#1a1410';
    pg.fillRect(60, 240, 200, 2);
    pg.font = '14px "JetBrains Mono", monospace';
    pg.fillText('TIM · ULRICH · 2026', 160, 280);
    pg.font = 'bold 26px "Fraunces", serif';
    pg.fillStyle = '#c8421b';
    pg.fillText('Webdesign', 160, 360);
    pg.fillStyle = '#1a1410';
    pg.fillText('aus Duisburg-Serm', 160, 395);
    const posterTex = new THREE.CanvasTexture(posterCanvas);
    posterTex.colorSpace = THREE.SRGBColorSpace;
    const poster = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 1.0),
      new THREE.MeshBasicMaterial({ map: posterTex })
    );
    poster.position.set(0, 4.0, -2.96);
    this.scene.add(poster);
    // Rahmen
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.3, metalness: 0.7 });
    const frameThickness = 0.025;
    const fTop = new THREE.Mesh(new THREE.BoxGeometry(0.75, frameThickness, 0.04), frameMat);
    fTop.position.set(0, 4.51, -2.94); this.scene.add(fTop);
    const fBot = fTop.clone(); fBot.position.set(0, 3.49, -2.94); this.scene.add(fBot);
    const fL = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, 1.04, 0.04), frameMat);
    fL.position.set(-0.36, 4.0, -2.94); this.scene.add(fL);
    const fR = fL.clone(); fR.position.set(0.36, 4.0, -2.94); this.scene.add(fR);
  }

  /* ── Beleuchtung ──────────────────────────────────────── */
  buildLights() {
    // Hemisphere — etwas heller, damit Materialien atmen können
    const hemi = new THREE.HemisphereLight(0x6a5cb0, 0x0a0820, 0.4);
    this.scene.add(hemi);

    // Hauptlicht: gedämpft, von oben rechts
    const key = new THREE.DirectionalLight(0xc8b8ff, 0.6);
    key.position.set(2.5, 6, 2.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0002;
    key.shadow.camera.left = -5; key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;   key.shadow.camera.bottom = -5;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 18;
    this.scene.add(key);

    // Fenster-Glow (kühles Blau)
    const winLight = new THREE.PointLight(0x4a7bff, 2.0, 8, 1.4);
    winLight.position.set(-3.2, 3.6, -1.8);
    this.scene.add(winLight);

    // Tisch-Spot von oben — fokussiert, das ist der Hauptlicht-Punkt am Setup
    const deskSpot = new THREE.SpotLight(0xfff0c8, 1.6, 6, Math.PI * 0.3, 0.55, 1.3);
    deskSpot.position.set(0, 5.6, 0.6);
    deskSpot.target.position.set(0, 1.06, 0.3);
    deskSpot.castShadow = true;
    deskSpot.shadow.mapSize.set(1024, 1024);
    this.scene.add(deskSpot);
    this.scene.add(deskSpot.target);

    // Desk-Underglow (gelb, subtil)
    const deskGlow = new THREE.PointLight(0xf6ff3a, 0.9, 3.0, 2);
    deskGlow.position.set(0, 0.78, 0.85);
    this.scene.add(deskGlow);
    const deskGlow2 = new THREE.PointLight(0xf6ff3a, 0.5, 2.4, 2);
    deskGlow2.position.set(-1.8, 0.78, 0.85);
    this.scene.add(deskGlow2);
    const deskGlow3 = new THREE.PointLight(0xf6ff3a, 0.5, 2.4, 2);
    deskGlow3.position.set(1.8, 0.78, 0.85);
    this.scene.add(deskGlow3);

    // Subtile Fill-Lichter um die Szene zu balancieren
    const fillLeft = new THREE.PointLight(0xa050ff, 0.5, 4, 2);
    fillLeft.position.set(-2.2, 2.4, 1.2);
    this.scene.add(fillLeft);
    const fillRight = new THREE.PointLight(0x3affe6, 0.4, 4, 2);
    fillRight.position.set(2.2, 2.4, 1.5);
    this.scene.add(fillRight);
  }

  /* ── Subtile Staubpartikel ────────────────────────────── */
  buildParticles() {
    const count = 80;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 5;
      pos[i * 3 + 1] = Math.random() * 3 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.018,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  /* ── Klick-Hittest ─────────────────────────────────────── */
  testMonitorClick(clientX, clientY) {
    if (!this.monitorHotZone) return false;
    const x = (clientX / window.innerWidth) * 2 - 1;
    const y = -(clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera({ x, y }, this.camera);
    const hits = this.raycaster.intersectObject(this.monitorHotZone);
    return hits.length > 0;
  }

  /* ── Kamera-Animation: Monitor-Approach ────────────────── */
  async zoomIntoMonitor() {
    if (this.zooming) return;
    this.zooming = true;

    const start = this.camera.position.clone();
    const startLook = new THREE.Vector3(0, 1.35, 0);
    const end = new THREE.Vector3(0, 1.93, -0.05);
    const endLook = new THREE.Vector3(0, 1.93, -1.5);

    const dur = 1400;
    const t0 = performance.now();
    return new Promise(resolve => {
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        // smooth ease-in-out cubic
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        this.camera.position.lerpVectors(start, end, e);
        const look = startLook.clone().lerp(endLook, e);
        this.camera.lookAt(look);
        if (this.screenLight) this.screenLight.intensity = 5.5 + e * 4;
        if (this.biasLight)  this.biasLight.intensity   = 2.2 + e * 1.5;
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }
  async zoomOut() {
    const start = this.camera.position.clone();
    const startLook = new THREE.Vector3(0, 1.93, -1.5);
    const end = this.cameraIdle.clone();
    const endLook = new THREE.Vector3(0, 1.35, 0);
    const dur = 1000;
    const t0 = performance.now();
    return new Promise(resolve => {
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        this.camera.position.lerpVectors(start, end, e);
        const look = startLook.clone().lerp(endLook, e);
        this.camera.lookAt(look);
        if (this.screenLight) this.screenLight.intensity = 9.5 - e * 4;
        if (this.biasLight)   this.biasLight.intensity   = 3.7 - e * 1.5;
        if (t < 1) requestAnimationFrame(step);
        else { this.zooming = false; resolve(); }
      };
      requestAnimationFrame(step);
    });
  }

  /* ── Animations-Loop ──────────────────────────────────── */
  loop() {
    this.t += 0.012;
    // Sehr sanftes Mouse-Easing
    this.mouse.x += (this.mouseTarget.x - this.mouse.x) * 0.04;
    this.mouse.y += (this.mouseTarget.y - this.mouse.y) * 0.04;

    if (!this.zooming) {
      // Ruhige Atem-Bewegung
      const bob  = Math.sin(this.t * 0.4) * 0.018;
      const sway = Math.sin(this.t * 0.28) * 0.024;
      this.camera.position.x = this.cameraIdle.x + sway + this.mouse.x * 0.16;
      this.camera.position.y = this.cameraIdle.y + bob  + this.mouse.y * 0.08;
      this.camera.lookAt(0, 1.35, this.mouse.x * -0.15);
    }

    // Partikel sanft schweben
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position;
      const arr = positions.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += 0.0008 * (Math.sin(this.t + i) + 1);
        if (arr[i + 1] > 3.8) arr[i + 1] = 0.4;
      }
      positions.needsUpdate = true;
    }

    // Subtile Pulsation der Bias-Light + Screen-Light
    if (this.biasLight && !this.zooming) {
      this.biasLight.intensity = 2.4 + Math.sin(this.t * 0.6) * 0.3;
    }
    if (this.screenLight && !this.zooming) {
      this.screenLight.intensity = 10 + Math.sin(this.t * 0.8) * 0.6;
    }
    if (this.screenPoint && !this.zooming) {
      this.screenPoint.intensity = 1.3 + Math.sin(this.t * 0.8) * 0.15;
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.loop());
  }
}

/* ════════════════════════════════════════════════════════════
   3. DESKTOP-OS
   ════════════════════════════════════════════════════════════ */
class DesktopOS {
  constructor(root) {
    this.root = root;
    this.desktopEl = document.getElementById('os-desktop');
    this.windowsEl = document.getElementById('os-windows');
    this.taskbarEl = document.getElementById('os-taskbar-mid');
    this.bootEl    = document.getElementById('os-boot');
    this.bootLogEl = document.getElementById('os-boot-log');

    this.openWindows = new Map();
    this.zCounter = 100;
    this.selected = null;

    // Nur zwei Apps — Angebote oben, Beispiele unten
    this.apps = [
      {
        id: 'angebote', label: 'Angebote.app', icon: '◉', cls: 'app-yellow',
        src: 'admin/angebote.html?embed=1', w: 1100, h: 720,
        sub: 'Pakete · Preise',
      },
      {
        id: 'beispiele', label: 'Beispiel-Sites.app', icon: '◈', cls: 'app-purple',
        src: 'admin/beispielsites.html?embed=1', w: 1100, h: 720,
        sub: 'Portfolio',
      },
    ];

    this.renderIcons();
    this.bindGlobal();
    this.startClock();
  }

  renderIcons() {
    this.desktopEl.innerHTML = this.apps.map(app => `
      <div class="os-icon" data-id="${app.id}">
        <div class="os-icon-img ${app.cls}">${app.icon}</div>
        <div class="os-icon-text">
          <span class="os-icon-label">${app.label}</span>
          <span class="os-icon-sub">${app.sub || ''}</span>
        </div>
      </div>
    `).join('');

    this.desktopEl.querySelectorAll('.os-icon').forEach(el => {
      el.addEventListener('mouseenter', () => sounds.hover());
      el.addEventListener('click', e => { e.stopPropagation(); this.selectIcon(el.dataset.id); });
      el.addEventListener('dblclick', e => { e.stopPropagation(); this.openApp(el.dataset.id); });
    });
  }

  bindGlobal() {
    this.desktopEl.addEventListener('click', () => this.selectIcon(null));
    document.getElementById('os-exit').addEventListener('click', () => {
      sounds.click();
      if (this.onExit) this.onExit();
    });
    document.addEventListener('keydown', e => {
      if (!this.root.classList.contains('is-open')) return;
      if (e.key === 'Escape') {
        sounds.click();
        if (this.onExit) this.onExit();
      }
    });
  }

  selectIcon(id) {
    if (this.selected) {
      const prev = this.desktopEl.querySelector(`.os-icon[data-id="${this.selected}"]`);
      if (prev) prev.classList.remove('selected');
    }
    this.selected = id;
    if (id) {
      sounds.iconSelect();
      const el = this.desktopEl.querySelector(`.os-icon[data-id="${id}"]`);
      if (el) el.classList.add('selected');
    }
  }

  openApp(id) {
    const app = this.apps.find(a => a.id === id);
    if (!app) return;
    sounds.windowOpen();

    if (this.openWindows.has(id)) {
      const w = this.openWindows.get(id);
      w.classList.remove('minimized');
      this.focusWindow(id);
      return;
    }

    const win = document.createElement('div');
    win.className = 'os-window focused';
    const cw = Math.max(320, Math.min(app.w, window.innerWidth - 80));
    const ch = Math.max(240, Math.min(app.h, window.innerHeight - 140));
    const offset = this.openWindows.size * 28;
    win.style.width  = cw + 'px';
    win.style.height = ch + 'px';
    win.style.left = Math.max(20, (window.innerWidth - cw) / 2 + offset) + 'px';
    win.style.top  = Math.max(60, (window.innerHeight - ch) / 2 - 30 + offset) + 'px';
    win.style.zIndex = ++this.zCounter;

    win.innerHTML = `
      <div class="os-window-bar">
        <div class="os-window-traffic">
          <span class="tc-close"  title="Schließen"></span>
          <span class="tc-min"    title="Minimieren"></span>
          <span class="tc-max"    title="Maximieren"></span>
        </div>
        <div class="os-window-title">${app.label}</div>
        <div style="width:54px"></div>
      </div>
      <div class="os-window-body">
        <iframe src="${app.src}" title="${app.label}" loading="lazy"></iframe>
      </div>
      <div class="os-window-resize"></div>
    `;
    this.windowsEl.appendChild(win);
    this.openWindows.set(id, win);
    this.focusWindow(id);
    this.makeDraggable(win);
    this.makeResizable(win);

    win.querySelector('.tc-close').addEventListener('click', e => { e.stopPropagation(); this.closeApp(id); });
    win.querySelector('.tc-min').addEventListener('click', e => { e.stopPropagation(); this.minimizeApp(id); });
    win.querySelector('.tc-max').addEventListener('click', e => { e.stopPropagation(); this.maximizeApp(id); });
    win.addEventListener('mousedown', () => this.focusWindow(id));

    this.renderTaskbar();
  }

  makeDraggable(win) {
    const bar = win.querySelector('.os-window-bar');
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    const onDown = (e) => {
      if (e.target.closest('.os-window-traffic')) return;
      dragging = true;
      const p = (e.touches?.[0] || e);
      sx = p.clientX; sy = p.clientY;
      const r = win.getBoundingClientRect();
      ox = r.left; oy = r.top;
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const p = (e.touches?.[0] || e);
      const nx = Math.max(0, Math.min(window.innerWidth - 100, ox + (p.clientX - sx)));
      const ny = Math.max(40, Math.min(window.innerHeight - 80, oy + (p.clientY - sy)));
      win.style.left = nx + 'px';
      win.style.top  = ny + 'px';
    };
    const onUp = () => { dragging = false; };
    bar.addEventListener('mousedown', onDown);
    bar.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
  }
  makeResizable(win) {
    const handle = win.querySelector('.os-window-resize');
    let sx = 0, sy = 0, sw = 0, sh = 0, resizing = false;
    const onDown = (e) => {
      resizing = true;
      const p = (e.touches?.[0] || e);
      sx = p.clientX; sy = p.clientY;
      const r = win.getBoundingClientRect();
      sw = r.width; sh = r.height;
      e.preventDefault(); e.stopPropagation();
    };
    const onMove = (e) => {
      if (!resizing) return;
      const p = (e.touches?.[0] || e);
      const nw = Math.max(320, sw + (p.clientX - sx));
      const nh = Math.max(240, sh + (p.clientY - sy));
      win.style.width = nw + 'px';
      win.style.height = nh + 'px';
    };
    const onUp = () => { resizing = false; };
    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
  }

  focusWindow(id) {
    this.openWindows.forEach((w, k) => {
      w.classList.toggle('focused', k === id);
      if (k === id) w.style.zIndex = ++this.zCounter;
    });
    this.taskbarEl.querySelectorAll('.os-task').forEach(t => {
      t.classList.toggle('active', t.dataset.id === id);
    });
  }
  closeApp(id) {
    const w = this.openWindows.get(id);
    if (!w) return;
    sounds.windowClose();
    w.classList.add('closing');
    setTimeout(() => {
      w.remove();
      this.openWindows.delete(id);
      this.renderTaskbar();
    }, 200);
  }
  minimizeApp(id) {
    const w = this.openWindows.get(id);
    if (!w) return;
    sounds.click();
    w.classList.add('minimized');
  }
  maximizeApp(id) {
    const w = this.openWindows.get(id);
    if (!w) return;
    sounds.click();
    const isMax = w.dataset.max === '1';
    if (isMax) {
      w.style.left = w.dataset.preLeft;
      w.style.top  = w.dataset.preTop;
      w.style.width = w.dataset.preW;
      w.style.height = w.dataset.preH;
      w.dataset.max = '0';
    } else {
      w.dataset.preLeft = w.style.left;
      w.dataset.preTop  = w.style.top;
      w.dataset.preW    = w.style.width;
      w.dataset.preH    = w.style.height;
      w.style.left = '12px';
      w.style.top  = '52px';
      w.style.width  = (window.innerWidth - 24) + 'px';
      w.style.height = (window.innerHeight - 96) + 'px';
      w.dataset.max = '1';
    }
  }

  renderTaskbar() {
    const html = [...this.openWindows.entries()].map(([id, w]) => {
      const app = this.apps.find(a => a.id === id);
      return `<div class="os-task ${w.classList.contains('focused') ? 'active' : ''}" data-id="${id}">
        <span class="os-task-icon">${app?.icon || '·'}</span>
        ${app?.label || id}
      </div>`;
    }).join('');
    this.taskbarEl.innerHTML = html;
    this.taskbarEl.querySelectorAll('.os-task').forEach(t => {
      t.addEventListener('click', () => {
        const id = t.dataset.id;
        const w = this.openWindows.get(id);
        if (!w) return;
        if (w.classList.contains('minimized')) {
          w.classList.remove('minimized');
        } else if (w.classList.contains('focused')) {
          w.classList.add('minimized');
        }
        this.focusWindow(id);
      });
    });
  }

  startClock() {
    const el = document.getElementById('os-clock');
    if (!el) return;
    const upd = () => {
      const d = new Date();
      el.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    };
    upd();
    setInterval(upd, 30000);
  }

  async show() {
    this.root.classList.add('is-open', 'is-entering');
    setTimeout(() => this.root.classList.remove('is-entering'), 800);
    await this.runBoot();
  }
  hide() {
    this.root.classList.remove('is-open');
    this.openWindows.forEach(w => w.remove());
    this.openWindows.clear();
    this.renderTaskbar();
    this.bootEl.classList.remove('gone');
    this.bootLogEl.innerHTML = '';
  }
  async runBoot() {
    const lines = [
      { t: 'BIOS check ............', d: 90  },
      { t: 'Memory 32 GB · DDR5 ...', d: 80,  ok: true },
      { t: 'GPU init  RTX-4090 ....', d: 100, ok: true },
      { t: 'Loading Tim-Ulrich-OS .', d: 130, ok: true },
      { t: 'Mounting workspace ...', d: 100, ok: true },
      { t: 'Ready.',                  d: 200 },
    ];
    sounds.boot();
    for (const ln of lines) {
      await new Promise(r => setTimeout(r, ln.d));
      const div = document.createElement('div');
      div.className = 'line';
      div.innerHTML = ln.t + (ln.ok ? ' <span class="ok">[ OK ]</span>' : '');
      this.bootLogEl.appendChild(div);
    }
    await new Promise(r => setTimeout(r, 380));
    this.bootEl.classList.add('gone');
  }
}

/* ════════════════════════════════════════════════════════════
   4. CONTROLLER
   ════════════════════════════════════════════════════════════ */
const canvas = document.getElementById('scene');
const studio = new Studio3D(canvas);
const os = new DesktopOS(document.getElementById('os'));
const sceneWrap = document.getElementById('scene-wrap');
const hint = document.getElementById('scene-hint');
const powerFlash = document.getElementById('power-flash');
const loader = document.getElementById('loader');

let hoveringMonitor = false;
studio.loop();
setTimeout(() => loader.classList.add('gone'), 500);

const soundBtn = document.getElementById('sound-toggle');
soundBtn.addEventListener('click', () => {
  sounds.ensure();
  const m = !sounds.muted;
  sounds.setMuted(m);
  soundBtn.classList.toggle('muted', m);
  soundBtn.textContent = m ? '🔇' : '🔊';
  if (!m) sounds.click();
});

window.addEventListener('pointermove', e => {
  if (studio.zooming) return;
  const hit = studio.testMonitorClick(e.clientX, e.clientY);
  if (hit && !hoveringMonitor) {
    hoveringMonitor = true;
    canvas.style.cursor = 'pointer';
    sounds.hover();
  } else if (!hit && hoveringMonitor) {
    hoveringMonitor = false;
    canvas.style.cursor = 'default';
  }
});

canvas.addEventListener('click', async (e) => {
  sounds.ensure();
  if (studio.zooming) return;
  const hit = studio.testMonitorClick(e.clientX, e.clientY);
  if (!hit) { sounds.hover(); return; }
  sounds.click();
  sounds.monitorWake();
  hint.style.opacity = '0';

  await studio.zoomIntoMonitor();
  powerFlash.classList.add('show');
  setTimeout(() => powerFlash.classList.remove('show'), 240);
  setTimeout(async () => {
    sceneWrap.classList.add('fading');
    await os.show();
  }, 120);
});

os.onExit = async () => {
  os.hide();
  sceneWrap.classList.remove('fading');
  hint.style.opacity = '';
  await studio.zoomOut();
};

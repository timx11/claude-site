/* ─────────────────────────────────────────────────────────
   desktop.js — 3D-Studio + OS
   ───────────────────────────────────────────────────────── */
import * as THREE from 'three';

/* ════════════════════════════════════════════════════════
   1. SOUND-SYSTEM (Web Audio API, synthetisierte Sounds)
   ════════════════════════════════════════════════════════ */
class Sounds {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.gain = null;
  }
  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.4;
    this.gain.connect(this.ctx.destination);
  }
  setMuted(m) {
    this.muted = m;
    if (this.gain) this.gain.gain.value = m ? 0 : 0.4;
  }
  beep({ freq = 600, dur = 0.05, type = 'square', vol = 0.4, attack = 0.005, decay = null }) {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + (decay ?? dur));
    o.connect(g).connect(this.gain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  sweep({ from, to, dur = 0.18, type = 'sine', vol = 0.3 }) {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.gain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  click()       { this.beep({ freq: 1800, dur: 0.04, type: 'square', vol: 0.18, attack: 0.001 }); }
  hover()       { this.beep({ freq: 1200, dur: 0.03, type: 'sine',   vol: 0.08 }); }
  iconSelect()  { this.beep({ freq: 880,  dur: 0.05, type: 'triangle', vol: 0.15 }); }
  monitorWake() { this.sweep({ from: 200, to: 1400, dur: 0.5, type: 'sawtooth', vol: 0.18 }); }
  windowOpen()  { this.sweep({ from: 400, to: 1200, dur: 0.18, type: 'triangle', vol: 0.25 }); }
  windowClose() { this.sweep({ from: 1000, to: 200, dur: 0.16, type: 'triangle', vol: 0.22 }); }
  boot()        {
    this.beep({ freq: 392, dur: 0.12, type: 'sine', vol: 0.3 });
    setTimeout(() => this.beep({ freq: 523, dur: 0.12, type: 'sine', vol: 0.3 }), 120);
    setTimeout(() => this.beep({ freq: 659, dur: 0.18, type: 'sine', vol: 0.3 }), 240);
  }
  err() { this.beep({ freq: 150, dur: 0.18, type: 'sawtooth', vol: 0.2 }); }
}

const sounds = new Sounds();

/* ════════════════════════════════════════════════════════
   2. 3D-STUDIO (Three.js)
   ════════════════════════════════════════════════════════ */
class Studio3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0a0712, 6, 18);

    const ar = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(42, ar, 0.05, 100);
    this.cameraIdle = { x: 0, y: 1.6, z: 4.3 };
    this.camera.position.set(this.cameraIdle.x, this.cameraIdle.y, this.cameraIdle.z);
    this.camera.lookAt(0, 1.2, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setClearColor(0x0a0712, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.mouse = new THREE.Vector2(0, 0);
    this.mouseTarget = new THREE.Vector2(0, 0);
    this.raycaster = new THREE.Raycaster();

    this.zooming = false;
    this.t = 0;
    this.screenMaterial = null;
    this.monitorHotZone = null;

    this.buildRoom();
    this.buildDesk();
    this.buildPC();
    this.buildPeripherals();
    this.buildLights();

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
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

  // ── Raum ─────────────────────────────────────────────────
  buildRoom() {
    const room = new THREE.Group();

    // Boden (dunkel, leicht reflektierend in Optik)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x110d1a, roughness: 0.6, metalness: 0.15 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    room.add(floor);

    // Rückwand
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a1228, roughness: 0.9 })
    );
    back.position.set(0, 3, -3);
    back.receiveShadow = true;
    room.add(back);

    // Linke Wand
    const left = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 6),
      new THREE.MeshStandardMaterial({ color: 0x140e22, roughness: 0.9 })
    );
    left.rotation.y = Math.PI / 2;
    left.position.set(-5, 3, 0);
    left.receiveShadow = true;
    room.add(left);

    // Rechte Wand
    const right = left.clone();
    right.rotation.y = -Math.PI / 2;
    right.position.set(5, 3, 0);
    room.add(right);

    // Decke (dunkel)
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 8),
      new THREE.MeshStandardMaterial({ color: 0x0a0712, roughness: 1 })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 6, 0);
    room.add(ceil);

    // Fenster-Glow an der Rückwand (Stilelement)
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 1.6),
      new THREE.MeshBasicMaterial({ color: 0x3a6bff, transparent: true, opacity: 0.6 })
    );
    win.position.set(-3, 3.6, -2.99);
    room.add(win);

    // Window-Glow Punktlicht
    const winGlow = new THREE.PointLight(0x3a6bff, 1.8, 6, 1.6);
    winGlow.position.set(-3, 3.4, -2.5);
    room.add(winGlow);

    // Subtiles Neon-Schild rechts oben (Akzent)
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff3ad6, transparent: true, opacity: 0.55 })
    );
    sign.position.set(3.6, 4.2, -2.95);
    room.add(sign);
    const signGlow = new THREE.PointLight(0xff3ad6, 1.0, 4, 2);
    signGlow.position.set(3.6, 4, -2.6);
    room.add(signGlow);

    this.scene.add(room);
  }

  // ── Schreibtisch (NEON-GELB) ─────────────────────────────
  buildDesk() {
    const desk = new THREE.Group();

    // Tischplatte — leuchtet neon-gelb
    const topMat = new THREE.MeshStandardMaterial({
      color: 0xf0ff3a,
      emissive: 0xf0ff3a,
      emissiveIntensity: 0.55,
      roughness: 0.45,
      metalness: 0.05,
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.08, 1.6), topMat);
    top.position.set(0, 1.0, 0);
    top.castShadow = true;
    top.receiveShadow = true;
    desk.add(top);

    // Beine — dunkel, mattes Metall
    const legMat = new THREE.MeshStandardMaterial({ color: 0x0d0a18, roughness: 0.6, metalness: 0.4 });
    const legGeo = new THREE.BoxGeometry(0.08, 1.0, 0.08);
    [[-1.75, 0.5, -0.65], [1.75, 0.5, -0.65], [-1.75, 0.5, 0.65], [1.75, 0.5, 0.65]].forEach(p => {
      const l = new THREE.Mesh(legGeo, legMat);
      l.position.set(...p);
      l.castShadow = true;
      desk.add(l);
    });

    // Neon-Streifen unter der Platte (leuchtet runter)
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf0ff3a, transparent: true, opacity: 0.9 });
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 0.04), stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0.955, 0.78);
    desk.add(stripe);

    // Punktlicht UNTER dem Tisch (gelber Glow zum Boden)
    const deskGlow = new THREE.PointLight(0xf0ff3a, 1.4, 3.5, 2);
    deskGlow.position.set(0, 0.7, 0.6);
    desk.add(deskGlow);

    this.scene.add(desk);
  }

  // ── PC: Monitor, Standfuß, Tower ─────────────────────────
  buildPC() {
    const pc = new THREE.Group();

    // Monitor-Gehäuse (mattschwarz)
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0d,
      roughness: 0.32,
      metalness: 0.4,
    });
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.78, 1.06, 0.08), bezelMat);
    bezel.position.set(0, 1.85, -0.55);
    bezel.castShadow = true;
    pc.add(bezel);

    // Screen (vorne) — leuchtet leicht (im Idle bläulich)
    const scrCanvas = this.makeScreenCanvas();
    const scrTex = new THREE.CanvasTexture(scrCanvas);
    scrTex.colorSpace = THREE.SRGBColorSpace;
    this.screenMaterial = new THREE.MeshBasicMaterial({ map: scrTex });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 0.9), this.screenMaterial);
    screen.position.set(0, 1.85, -0.5);
    pc.add(screen);
    this.screen = screen;
    this.screenTex = scrTex;

    // Monitor-LED (kleine Power-LED unten am Bezel)
    const led = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 0.025),
      new THREE.MeshBasicMaterial({ color: 0x3affe6 })
    );
    led.position.set(0.78, 1.27, -0.49);
    pc.add(led);
    const ledLight = new THREE.PointLight(0x3affe6, 0.3, 0.6, 2);
    ledLight.position.set(0.78, 1.27, -0.4);
    pc.add(ledLight);

    // Standfuß (Hals)
    const neck = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.32, 0.08),
      bezelMat
    );
    neck.position.set(0, 1.18, -0.55);
    neck.castShadow = true;
    pc.add(neck);

    // Standfuß (Sockel)
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.32, 0.04, 24),
      bezelMat
    );
    base.position.set(0, 1.045, -0.55);
    base.castShadow = true;
    pc.add(base);

    // Hot-Zone für Raycaster (etwas größer als der Screen)
    const hot = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 0.98),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hot.position.set(0, 1.85, -0.48);
    hot.name = 'monitor-hot';
    pc.add(hot);
    this.monitorHotZone = hot;

    // Tower-PC unter dem Tisch (links)
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.78, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.4, metalness: 0.35 })
    );
    tower.position.set(-1.5, 0.45, 0.3);
    tower.castShadow = true;
    pc.add(tower);

    // Tower-Status-LED (lila)
    const towerLed = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xa23bff })
    );
    towerLed.position.set(-1.5, 0.7, 0.512);
    pc.add(towerLed);

    this.scene.add(pc);
  }

  makeScreenCanvas() {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 180;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(160, 90, 10, 160, 90, 200);
    grd.addColorStop(0, '#3a6bff');
    grd.addColorStop(1, '#0a0712');
    g.fillStyle = grd;
    g.fillRect(0, 0, c.width, c.height);
    // Brand
    g.font = 'bold 36px "JetBrains Mono", monospace';
    g.fillStyle = 'rgba(240, 255, 58, 0.95)';
    g.textAlign = 'center';
    g.fillText('TU', 160, 95);
    g.font = '10px "JetBrains Mono", monospace';
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText('PRESS ANY KEY', 160, 130);
    // Scanlines
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < c.height; y += 3) g.fillRect(0, y, c.width, 1);
    return c;
  }

  // ── Peripherie ────────────────────────────────────────────
  buildPeripherals() {
    const matDark = new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.6, metalness: 0.2 });

    // Tastatur
    const kb = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.32), matDark);
    kb.position.set(0, 1.06, 0.3);
    kb.castShadow = true;
    this.scene.add(kb);

    // Tasten-Glow (RGB-Streifen)
    const kbGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.27),
      new THREE.MeshBasicMaterial({ color: 0x3a6bff, transparent: true, opacity: 0.35 })
    );
    kbGlow.rotation.x = -Math.PI / 2;
    kbGlow.position.set(0, 1.082, 0.3);
    this.scene.add(kbGlow);

    // Maus
    const mouse = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.06, 0.06, 4, 8),
      matDark
    );
    mouse.position.set(0.65, 1.085, 0.4);
    mouse.rotation.x = Math.PI / 2;
    mouse.castShadow = true;
    this.scene.add(mouse);

    // Mauspad (mit Glow-Edge)
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x1a1228, roughness: 0.85 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0.65, 1.045, 0.4);
    this.scene.add(pad);

    // Becher (Kaffee/Tee — gelber Akzent)
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.06, 0.16, 16),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.6 })
    );
    mug.position.set(-1.3, 1.12, 0.45);
    mug.castShadow = true;
    this.scene.add(mug);

    // Pflanze (simple)
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.08, 0.15, 12),
      new THREE.MeshStandardMaterial({ color: 0x4d3f33, roughness: 0.9 })
    );
    pot.position.set(1.45, 1.115, 0.5);
    pot.castShadow = true;
    this.scene.add(pot);
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a6b3f, roughness: 0.8, emissive: 0x1a3f2a, emissiveIntensity: 0.3 })
    );
    leaves.scale.set(1, 1.2, 1);
    leaves.position.set(1.45, 1.32, 0.5);
    this.scene.add(leaves);

    // Headphones-Bügel-Andeutung (kleiner Bogen) — links neben Tower
    const headBow = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.012, 8, 24, Math.PI),
      matDark
    );
    headBow.rotation.z = Math.PI;
    headBow.position.set(-1.5, 1.32, 0.3);
    this.scene.add(headBow);
  }

  // ── Licht ─────────────────────────────────────────────────
  buildLights() {
    // Ambient sehr dunkel (Raum ist düster)
    this.scene.add(new THREE.AmbientLight(0x12101a, 1.0));

    // Hauptlicht — leicht von oben/rechts (warm-violett)
    const key = new THREE.DirectionalLight(0xa090ff, 0.6);
    key.position.set(2, 4, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5; key.shadow.camera.right = 5;
    key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
    this.scene.add(key);

    // Blaues Akzent-Licht von links
    const blue = new THREE.PointLight(0x3a6bff, 2.2, 8, 1.5);
    blue.position.set(-2.2, 2.5, 1.2);
    this.scene.add(blue);

    // Lila Akzent-Licht von rechts
    const purple = new THREE.PointLight(0xa23bff, 2.4, 8, 1.5);
    purple.position.set(2.2, 2.5, 1.2);
    this.scene.add(purple);

    // Schreibtisch-Glow (gelb) — schon im Desk, aber zusätzlich von oben
    const deskTop = new THREE.PointLight(0xf0ff3a, 0.6, 3.5, 2);
    deskTop.position.set(0, 1.6, 0.2);
    this.scene.add(deskTop);

    // Monitor-Glow (kommt vom Screen-Material) — softer Punktlicht
    const monGlow = new THREE.PointLight(0x3a6bff, 0.5, 2.2, 2);
    monGlow.position.set(0, 1.85, -0.2);
    this.scene.add(monGlow);
    this.monGlow = monGlow;
  }

  // ── Klick-Hittest auf Monitor ────────────────────────────
  testMonitorClick(clientX, clientY) {
    if (!this.monitorHotZone) return false;
    const x = (clientX / window.innerWidth) * 2 - 1;
    const y = -(clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera({ x, y }, this.camera);
    const hits = this.raycaster.intersectObject(this.monitorHotZone);
    return hits.length > 0;
  }

  // ── Kamera-Zoom zum Monitor ──────────────────────────────
  async zoomIntoMonitor() {
    if (this.zooming) return;
    this.zooming = true;

    const start = this.camera.position.clone();
    const startLook = new THREE.Vector3(0, 1.2, 0);
    const end = new THREE.Vector3(0, 1.85, 0.05);   // direkt vor den Monitor
    const endLook = new THREE.Vector3(0, 1.85, -0.5);

    const dur = 1100;
    const t0 = performance.now();
    return new Promise(resolve => {
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // smooth in-out
        this.camera.position.lerpVectors(start, end, e);
        const look = startLook.clone().lerp(endLook, e);
        this.camera.lookAt(look);
        // Monitor-Glow boosten beim Reinzoomen
        if (this.monGlow) this.monGlow.intensity = 0.5 + e * 2.5;
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  // Zurück zum Idle-Standpunkt
  async zoomOut() {
    const start = this.camera.position.clone();
    const startLook = new THREE.Vector3(0, 1.85, -0.5);
    const end = new THREE.Vector3(this.cameraIdle.x, this.cameraIdle.y, this.cameraIdle.z);
    const endLook = new THREE.Vector3(0, 1.2, 0);
    const dur = 800;
    const t0 = performance.now();
    return new Promise(resolve => {
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        this.camera.position.lerpVectors(start, end, e);
        const look = startLook.clone().lerp(endLook, e);
        this.camera.lookAt(look);
        if (this.monGlow) this.monGlow.intensity = 3.0 - e * 2.5;
        if (t < 1) requestAnimationFrame(step);
        else { this.zooming = false; resolve(); }
      };
      requestAnimationFrame(step);
    });
  }

  // ── Animations-Loop ──────────────────────────────────────
  loop() {
    this.t += 0.013;
    // Sanftes Mouse-Easing
    this.mouse.x += (this.mouseTarget.x - this.mouse.x) * 0.06;
    this.mouse.y += (this.mouseTarget.y - this.mouse.y) * 0.06;

    if (!this.zooming) {
      // Subtile Idle-Bewegung der Kamera (atmet)
      const bob = Math.sin(this.t * 0.7) * 0.04;
      const sway = Math.sin(this.t * 0.5) * 0.05;
      this.camera.position.x = this.cameraIdle.x + sway + this.mouse.x * 0.25;
      this.camera.position.y = this.cameraIdle.y + bob + this.mouse.y * 0.12;
      this.camera.lookAt(0, 1.2, 0);
    }

    // Power-LED am Monitor blinkt (subtil)
    if (this.screenMaterial && this.screenMaterial.map) {
      // alle 30 Frames: leichte Helligkeits-Schwankung simulieren (nur Glow-Punktlicht)
      if (this.monGlow && !this.zooming) {
        this.monGlow.intensity = 0.45 + Math.sin(this.t * 2) * 0.08;
      }
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.loop());
  }
}

/* ════════════════════════════════════════════════════════
   3. DESKTOP-OS (2D-Overlay, Icons, Fenster)
   ════════════════════════════════════════════════════════ */
class DesktopOS {
  constructor(root) {
    this.root = root;
    this.desktopEl = document.getElementById('os-desktop');
    this.windowsEl = document.getElementById('os-windows');
    this.taskbarEl = document.getElementById('os-taskbar-mid');
    this.bootEl    = document.getElementById('os-boot');
    this.bootLogEl = document.getElementById('os-boot-log');

    this.openWindows = new Map(); // id → element
    this.zCounter = 100;
    this.selected = null;

    this.apps = [
      { id: 'cockpit',    label: 'Cockpit.app',     icon: '◎', cls: 'app-purple', src: 'admin/cockpit.html?embed=1',    w: 1050, h: 640 },
      { id: 'mapscout',   label: 'Map-Scout.app',   icon: '◉', cls: 'app-orange', src: 'admin/mapscout.html?embed=1',   w: 1050, h: 720 },
      { id: 'pitchsheet', label: 'Pitch-Sheet.app', icon: '▤', cls: 'app-yellow', src: 'admin/pitchsheet.html?embed=1', w: 1100, h: 720 },
      { id: 'wishes',     label: 'Wunsch-Form.app', icon: '✦', cls: 'app-pink',   src: 'admin/wishes.html?embed=1',     w: 640,  h: 760 },
      { id: 'outreach',   label: 'Outreach.app',    icon: '✉', cls: 'app-cyan',   src: 'admin/outreach.html?embed=1',   w: 1100, h: 700 },
      { id: 'readme',     label: 'ReadMe.txt',      icon: '📄', cls: 'app-file',   inline: 'readme', w: 540, h: 420 },
      { id: 'notes',      label: 'Notizen.txt',     icon: '🗒', cls: 'app-file',   inline: 'notes',  w: 520, h: 420 },
    ];

    this.renderIcons();
    this.bindGlobal();
    this.startClock();
  }

  renderIcons() {
    this.desktopEl.innerHTML = this.apps.map(app => `
      <div class="os-icon" data-id="${app.id}">
        <div class="os-icon-img ${app.cls}">${app.icon}</div>
        <div class="os-icon-label">${app.label}</div>
      </div>
    `).join('');

    this.desktopEl.querySelectorAll('.os-icon').forEach(el => {
      el.addEventListener('mouseenter', () => sounds.hover());
      el.addEventListener('click', e => {
        e.stopPropagation();
        this.selectIcon(el.dataset.id);
      });
      el.addEventListener('dblclick', e => {
        e.stopPropagation();
        this.openApp(el.dataset.id);
      });
    });
  }

  bindGlobal() {
    // Klick irgendwo auf Desktop → Selektion aufheben
    this.desktopEl.addEventListener('click', () => this.selectIcon(null));

    document.getElementById('os-exit').addEventListener('click', () => {
      sounds.click();
      if (this.onExit) this.onExit();
    });

    // ESC = Exit
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

    // bereits offen? in den Vordergrund
    if (this.openWindows.has(id)) {
      const w = this.openWindows.get(id);
      w.classList.remove('minimized');
      this.focusWindow(id);
      return;
    }

    const win = document.createElement('div');
    win.className = 'os-window focused';
    win.style.width  = app.w + 'px';
    win.style.height = app.h + 'px';
    // zentriert, leicht versetzt
    const offset = (this.openWindows.size * 24);
    const cw = Math.max(280, Math.min(app.w, window.innerWidth  - 80));
    const ch = Math.max(200, Math.min(app.h, window.innerHeight - 140));
    win.style.width  = cw + 'px';
    win.style.height = ch + 'px';
    win.style.left = Math.max(20, (window.innerWidth  - cw) / 2 + offset) + 'px';
    win.style.top  = Math.max(60, (window.innerHeight - ch) / 2 - 30 + offset) + 'px';
    win.style.zIndex = ++this.zCounter;

    const body = app.inline
      ? `<div class="os-window-content">${this.inlineContent(app.inline)}</div>`
      : `<iframe src="${app.src}" title="${app.label}" loading="lazy"></iframe>`;

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
      <div class="os-window-body">${body}</div>
      <div class="os-window-resize"></div>
    `;

    this.windowsEl.appendChild(win);
    this.openWindows.set(id, win);
    this.focusWindow(id);

    // Drag
    this.makeDraggable(win);
    // Resize
    this.makeResizable(win);

    // Traffic-Lights
    win.querySelector('.tc-close').addEventListener('click', e => { e.stopPropagation(); this.closeApp(id); });
    win.querySelector('.tc-min').addEventListener('click', e => { e.stopPropagation(); this.minimizeApp(id); });
    win.querySelector('.tc-max').addEventListener('click', e => { e.stopPropagation(); this.maximizeApp(id); });

    // Klick aufs Fenster fokussiert
    win.addEventListener('mousedown', () => this.focusWindow(id));

    // Taskbar-Eintrag
    this.renderTaskbar();
  }

  inlineContent(kind) {
    if (kind === 'readme') return `
      <h2>ReadMe.txt</h2>
      <p>Willkommen im <strong>Tim-Ulrich-Studio</strong>. Das ist mein
         3D-Arbeitsplatz, in den Du Dich gerade reingeklickt hast.</p>
      <p>Auf dem Desktop findest Du die Module, mit denen ich arbeite:
         <strong>Cockpit</strong> (Übersicht aller Leads),
         <strong>Map-Scout</strong> (Maps-Screenshot → KI-Audit),
         <strong>Pitch-Sheet</strong> (druckbares Verkaufsblatt),
         <strong>Wunsch-Form</strong> (Kundenwünsche erfassen),
         <strong>Outreach</strong> (Cold-Mail-CRM).</p>
      <p style="color: #f0ff3a;">→ Doppelklick auf ein Icon öffnet das Modul.</p>
      <p>ESC oder das ⏻-Symbol oben rechts beendet das OS und bringt
         Dich zurück ins Studio.</p>
    `;
    if (kind === 'notes') return `
      <h2>Notizen.txt</h2>
      <p>— Vor jedem Termin: Cockpit checken</p>
      <p>— Map-Scout vorbereiten mit Screenshot</p>
      <p>— Pitch-Sheet drucken (A4, randlos)</p>
      <p>— Beim Kunden: QR scannen lassen → Wunsch-Form füllt sich</p>
      <p>— Danach: Build-Plan generieren</p>
      <p style="color: #a23bff;">TODO: Telefon-Bot für nachts testen</p>
    `;
    return '';
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
      const nx = Math.max(0, Math.min(window.innerWidth  - 100, ox + (p.clientX - sx)));
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
      const nh = Math.max(200, sh + (p.clientY - sy));
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
    }, 180);
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
      w.style.width  = (window.innerWidth  - 24) + 'px';
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
          // schon fokussiert → minimieren
          w.classList.add('minimized');
        }
        this.focusWindow(id);
      });
    });
  }

  startClock() {
    const el = document.getElementById('os-clock');
    const upd = () => {
      const d = new Date();
      el.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    };
    upd();
    setInterval(upd, 30 * 1000);
  }

  async show() {
    this.root.classList.add('is-open', 'is-entering');
    setTimeout(() => this.root.classList.remove('is-entering'), 700);
    await this.runBoot();
  }

  hide() {
    this.root.classList.remove('is-open');
    // Alle Fenster schließen
    this.openWindows.forEach((w, id) => w.remove());
    this.openWindows.clear();
    this.renderTaskbar();
    // Boot-Screen wieder bereit für nächstes Mal
    this.bootEl.classList.remove('gone');
    this.bootLogEl.innerHTML = '';
  }

  async runBoot() {
    const lines = [
      { t: 'BIOS check ............', d: 100 },
      { t: 'Memory 16384 MB .......', d: 80,  ok: true },
      { t: 'GPU init  RTX-NEON ...', d: 90,  ok: true },
      { t: 'Loading Tim-Ulrich-OS .', d: 120, ok: true },
      { t: 'Mounting desktop .....', d: 100, ok: true },
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
    await new Promise(r => setTimeout(r, 350));
    this.bootEl.classList.add('gone');
  }
}

/* ════════════════════════════════════════════════════════
   4. CONTROLLER (verbindet 3D, OS, Sounds)
   ════════════════════════════════════════════════════════ */
const canvas = document.getElementById('scene');
const studio = new Studio3D(canvas);
const os = new DesktopOS(document.getElementById('os'));
const sceneWrap = document.getElementById('scene-wrap');
const hint = document.getElementById('scene-hint');
const powerFlash = document.getElementById('power-flash');
const loader = document.getElementById('loader');

let hoveringMonitor = false;

// Render-Loop starten
studio.loop();

// Loader weg
setTimeout(() => loader.classList.add('gone'), 400);

// Sound-Toggle
const soundBtn = document.getElementById('sound-toggle');
soundBtn.addEventListener('click', () => {
  const m = !sounds.muted;
  sounds.setMuted(m);
  soundBtn.classList.toggle('muted', m);
  soundBtn.textContent = m ? '🔇' : '🔊';
  if (!m) sounds.click();
});

// Mouse-Hover über Monitor
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

// Klick auf Monitor → ins OS
canvas.addEventListener('click', async (e) => {
  sounds.ensure(); // Audio-Context entsperren (User-Gesture)
  if (studio.zooming) return;
  const hit = studio.testMonitorClick(e.clientX, e.clientY);
  if (!hit) {
    sounds.hover();
    return;
  }
  sounds.click();
  sounds.monitorWake();
  hint.style.opacity = '0';

  await studio.zoomIntoMonitor();

  // Power-Flash
  powerFlash.classList.add('show');
  setTimeout(() => powerFlash.classList.remove('show'), 200);

  // Szene ausblenden, OS einblenden
  setTimeout(async () => {
    sceneWrap.classList.add('fading');
    await os.show();
  }, 100);
});

// OS-Exit → zurück in die Szene
os.onExit = async () => {
  os.hide();
  sceneWrap.classList.remove('fading');
  hint.style.opacity = '';
  await studio.zoomOut();
};

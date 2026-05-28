/* ──────────────────────────────────────────────────────────────
   desktop.js v3 — Studio mit Sorgfalt
   Pro-Sounds (Reverb, Multi-Osc, ADSR), heller Raum,
   moderne LED-Wand, Wandregal, Studio-Mic, mehr Tisch-Details
   ────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from './vendor/three/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';

RectAreaLightUniformsLib.init();

/* ════════════════════════════════════════════════════════════
   1. PRO-SOUND-SYSTEM (Reverb + Multi-Osc + ADSR)
   ════════════════════════════════════════════════════════════ */
class Sounds {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.reverbBus = null;
    this.dryGain = null;
    this.wetGain = null;
  }

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    // Master
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);

    // Reverb-Bus (Convolver mit synth. Impulsantwort)
    this.reverbBus = this.ctx.createConvolver();
    this.reverbBus.buffer = this._makeImpulse(2.4, 2.5);
    this.wetGain = this.ctx.createGain();
    this.wetGain.gain.value = 0.32;
    this.reverbBus.connect(this.wetGain).connect(this.master);

    this._startAmbient();
  }

  /* Synthetisierte Impulsantwort für angenehmen Raum-Hall */
  _makeImpulse(duration, decay) {
    const len = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        // Frühe Reflexionen + exponentieller Abfall
        const t = i / len;
        const noise = (Math.random() * 2 - 1);
        data[i] = noise * Math.pow(1 - t, decay) * 0.6;
      }
    }
    return buf;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(m ? 0 : 0.5, this.ctx.currentTime + 0.4);
    }
  }

  /* Ambient: sehr leiser Raum-Hum + Brown Noise */
  _startAmbient() {
    // Bass-Hum (zwei leichte Detuning für Wärme)
    [55, 55.5, 110].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.value = i === 2 ? 0.018 : 0.035;
      o.connect(g).connect(this.master);
      o.start();
    });
    // Brown noise (warmes Rauschen)
    const bufSize = 4 * this.ctx.sampleRate;
    const noise = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 380; filt.Q.value = 0.7;
    const ng = this.ctx.createGain(); ng.gain.value = 0.06;
    src.connect(filt).connect(ng).connect(this.master);
    src.start();
  }

  /* Eine Stimme mit ADSR + optionaler Reverb-Beimischung */
  _voice({ freq, type = 'sine', detune = 0, attack = 0.01, decay = 0.0, sustainLevel = 0, release = 0.2, peak = 0.3, wet = 0.2, filter = null, filterCutoff = 8000 }) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    if (decay > 0) g.gain.linearRampToValueAtTime(peak * sustainLevel, t + attack + decay);
    g.gain.linearRampToValueAtTime(0.0001, t + attack + decay + release);

    let last = o;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = filter; f.frequency.value = filterCutoff; f.Q.value = 0.8;
      o.connect(f); last = f;
    }
    last.connect(g);

    // Dry + Wet
    const dry = this.ctx.createGain();
    dry.gain.value = 1 - wet;
    g.connect(dry).connect(this.master);
    if (wet > 0 && this.reverbBus) {
      const w = this.ctx.createGain();
      w.gain.value = wet;
      g.connect(w).connect(this.reverbBus);
    }

    o.start(t);
    o.stop(t + attack + decay + release + 0.05);
  }

  /* Glissando-Stimme (z.B. Power-On Sweep) */
  _glide({ from, to, type = 'sine', attack = 0.02, dur = 0.4, release = 0.2, peak = 0.25, wet = 0.35 }) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + release);
    o.connect(g);
    const dry = this.ctx.createGain(); dry.gain.value = 1 - wet;
    g.connect(dry).connect(this.master);
    if (this.reverbBus) {
      const w = this.ctx.createGain(); w.gain.value = wet;
      g.connect(w).connect(this.reverbBus);
    }
    o.start(t);
    o.stop(t + dur + release + 0.05);
  }

  /* ── Pleasant UI Sounds ──────────────────────────────────── */
  click() {
    // Soft mechanical click: zwei sehr kurze Sine-Pulse mit leichtem Detune
    this._voice({ freq: 1800, type: 'sine', attack: 0.001, release: 0.04, peak: 0.16, wet: 0.18, filter: 'highpass', filterCutoff: 600 });
    this._voice({ freq: 2400, type: 'sine', detune: 10, attack: 0.001, release: 0.03, peak: 0.10, wet: 0.18 });
  }
  hover() {
    // Sehr dezenter Tick (kaum hörbar)
    this._voice({ freq: 1400, type: 'sine', attack: 0.001, release: 0.05, peak: 0.06, wet: 0.15 });
  }
  iconSelect() {
    // Bell-like Anschlag
    this._voice({ freq: 880,  type: 'sine', attack: 0.003, release: 0.4,  peak: 0.18, wet: 0.42 });
    this._voice({ freq: 1760, type: 'sine', attack: 0.003, release: 0.25, peak: 0.05, wet: 0.4 });
  }
  monitorWake() {
    // Pleasant "Power-On" Glide + warmer Pad
    this._glide({ from: 220, to: 880, type: 'sine', attack: 0.05, dur: 0.55, release: 0.4, peak: 0.18, wet: 0.5 });
    setTimeout(() => {
      this._voice({ freq: 880,  type: 'sine', attack: 0.01, release: 0.6, peak: 0.14, wet: 0.55 });
      this._voice({ freq: 1320, type: 'sine', attack: 0.02, release: 0.6, peak: 0.06, wet: 0.55 });
    }, 480);
  }
  windowOpen() {
    // Aufsteigender perfekter Quint-Sprung mit Reverb
    this._voice({ freq: 523.25, type: 'sine', attack: 0.005, release: 0.32, peak: 0.18, wet: 0.45 });
    setTimeout(() => {
      this._voice({ freq: 783.99, type: 'sine', attack: 0.005, release: 0.4, peak: 0.16, wet: 0.45 });
    }, 60);
  }
  windowClose() {
    // Absteigender Sprung
    this._voice({ freq: 659.25, type: 'sine', attack: 0.005, release: 0.25, peak: 0.16, wet: 0.4 });
    setTimeout(() => {
      this._voice({ freq: 392.00, type: 'sine', attack: 0.005, release: 0.35, peak: 0.16, wet: 0.4 });
    }, 50);
  }
  boot() {
    // Cmaj9-Akkord mit detuned Voices (Dampf-Pad-Style)
    const notes = [261.63, 329.63, 392.00, 587.33];  // C-E-G-D
    notes.forEach((freq, i) => {
      setTimeout(() => {
        // 3 detuned Voices pro Note für Fülle
        [-7, 0, 7].forEach(d => {
          this._voice({
            freq, type: 'sine', detune: d,
            attack: 0.25, decay: 0.3, sustainLevel: 0.6, release: 1.4,
            peak: 0.10, wet: 0.55,
            filter: 'lowpass', filterCutoff: 3500,
          });
        });
      }, i * 140);
    });
  }
}
const sounds = new Sounds();

/* ════════════════════════════════════════════════════════════
   2. STUDIO 3D — heller, detailreicher, professionell
   ════════════════════════════════════════════════════════════ */
class Studio3D {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setClearColor(0x06060c, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.8;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0814, 0.03);

    // PMREM-Environment für realistische Reflexionen
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(this.renderer), 0.04).texture;

    const ar = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(38, ar, 0.05, 60);
    this.cameraIdle = new THREE.Vector3(0, 1.62, 4.4);
    this.camera.position.copy(this.cameraIdle);
    this.camera.lookAt(0, 1.4, 0);

    this.mouse = new THREE.Vector2(0, 0);
    this.mouseTarget = new THREE.Vector2(0, 0);
    this.raycaster = new THREE.Raycaster();
    this.zooming = false;
    this.t = 0;

    this.buildRoom();
    this.buildDesk();
    this.buildPC();
    this.buildPeripherals();
    this.buildDeskLamp();
    this.buildWallArt();
    this.buildShelf();
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

  /* ── Raum ─────────────────────────────────────────────── */
  buildRoom() {
    const room = new THREE.Group();

    // Boden — dunkles Concrete-Look mit leichter Spec-Highlight
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({
        color: 0x1e1828,
        roughness: 0.55,
        metalness: 0.2,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    room.add(floor);

    // Rückwand — mattschwarz (nicht zu dunkel), leicht warm
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 7),
      new THREE.MeshStandardMaterial({
        color: 0x1a1525,
        roughness: 0.92,
        metalness: 0.05,
      })
    );
    back.position.set(0, 3.2, -3);
    back.receiveShadow = true;
    room.add(back);

    // Seitenwände
    const sideMat = new THREE.MeshStandardMaterial({
      color: 0x18142a,
      roughness: 0.92,
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
      new THREE.MeshStandardMaterial({ color: 0x12101e, roughness: 1 })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 6.7, 0);
    room.add(ceil);

    // Fenster mit Nachtstadt-Skyline (etwas brighter, mehr Lights)
    const skyTex = new THREE.CanvasTexture(this.makeSkylineCanvas());
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 1.9),
      new THREE.MeshBasicMaterial({ map: skyTex })
    );
    win.position.set(-4.0, 3.6, -2.97);
    room.add(win);

    // Fensterrahmen
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x06060a, roughness: 0.4, metalness: 0.7 });
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.06, 0.07), frameMat);
    frameTop.position.set(-4.0, 4.58, -2.94);
    room.add(frameTop);
    const frameBot = frameTop.clone(); frameBot.position.set(-4.0, 2.62, -2.94); room.add(frameBot);
    const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 0.07), frameMat);
    frameLeft.position.set(-5.83, 3.6, -2.94); room.add(frameLeft);
    const frameRight = frameLeft.clone(); frameRight.position.set(-2.17, 3.6, -2.94); room.add(frameRight);
    // Sprossen
    const fcH = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.035, 0.07), frameMat);
    fcH.position.set(-4.0, 3.6, -2.93); room.add(fcH);
    const fcV = new THREE.Mesh(new THREE.BoxGeometry(0.035, 2.0, 0.07), frameMat);
    fcV.position.set(-4.0, 3.6, -2.93); room.add(fcV);

    this.scene.add(room);
  }

  makeSkylineCanvas() {
    const c = document.createElement('canvas');
    c.width = 720; c.height = 380;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, c.height);
    grd.addColorStop(0, '#0e1a4a');
    grd.addColorStop(0.5, '#220e44');
    grd.addColorStop(1, '#080308');
    g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
    // Sterne
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 130; i++) {
      const x = Math.random() * c.width;
      const y = Math.random() * c.height * 0.6;
      const r = Math.random() * 1.4;
      g.globalAlpha = 0.3 + Math.random() * 0.7;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // Skyline
    g.fillStyle = '#000';
    const bx = [];
    let x = 0;
    while (x < c.width) {
      const w = 18 + Math.random() * 50;
      const h = 50 + Math.random() * 150;
      bx.push({ x, w, h });
      g.fillRect(x, c.height - h, w, h);
      x += w;
    }
    // Fensterlichter
    for (const b of bx) {
      const rows = Math.floor(b.h / 12);
      const cols = Math.floor(b.w / 7);
      for (let r = 0; r < rows; r++) {
        for (let cc = 0; cc < cols; cc++) {
          if (Math.random() < 0.42) {
            const lx = b.x + 2 + cc * 7;
            const ly = c.height - b.h + 2 + r * 12;
            const k = Math.random();
            g.fillStyle = k < 0.7 ? '#ffd882' : (k < 0.9 ? '#3affe6' : '#a050ff');
            g.fillRect(lx, ly, 2.5, 3.5);
          }
        }
      }
    }
    // Subtle "Reflexionen" am Boden (vor der Skyline)
    const refGrd = g.createLinearGradient(0, c.height - 30, 0, c.height);
    refGrd.addColorStop(0, 'rgba(255, 216, 130, 0)');
    refGrd.addColorStop(1, 'rgba(255, 216, 130, 0.04)');
    g.fillStyle = refGrd; g.fillRect(0, c.height - 30, c.width, 30);
    return c;
  }

  /* ── Tisch (mattschwarz, leichte Reflexion, Front-LED) ── */
  buildDesk() {
    const desk = new THREE.Group();

    const topMat = new THREE.MeshStandardMaterial({
      color: 0x0d0c18,
      roughness: 0.22,
      metalness: 0.85,
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.08, 1.8), topMat);
    top.position.set(0, 1.0, 0);
    top.castShadow = true;
    top.receiveShadow = true;
    desk.add(top);

    // Front-LED (neon-gelb)
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xf6ff3a })
    );
    strip.rotation.x = Math.PI / 2;
    strip.position.set(0, 0.96, 0.91);
    desk.add(strip);

    // Beine
    const legMat = new THREE.MeshStandardMaterial({ color: 0x06060a, roughness: 0.35, metalness: 0.8 });
    const legGeo = new THREE.BoxGeometry(0.06, 1.0, 0.06);
    [[-2.05, 0.5, -0.78], [2.05, 0.5, -0.78], [-2.05, 0.5, 0.78], [2.05, 0.5, 0.78]].forEach(p => {
      const l = new THREE.Mesh(legGeo, legMat);
      l.position.set(...p);
      l.castShadow = true;
      desk.add(l);
    });

    this.scene.add(desk);
  }

  /* ── PC: Monitor + Tower mit RGB-Lüftern ───────────────── */
  buildPC() {
    const pc = new THREE.Group();

    // Ultrawide Monitor
    const monW = 2.4, monH = 1.0, monD = 0.06, monY = 1.85, monZ = -0.6;

    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x05060c, roughness: 0.3, metalness: 0.85,
    });
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(monW, monH, monD), bezelMat);
    bezel.position.set(0, monY, monZ);
    bezel.castShadow = true;
    pc.add(bezel);

    // Screen
    this.screenCanvas = this.makeScreenCanvas();
    const scrTex = new THREE.CanvasTexture(this.screenCanvas);
    scrTex.colorSpace = THREE.SRGBColorSpace;
    this.screenMaterial = new THREE.MeshBasicMaterial({ map: scrTex });
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(monW - 0.05, monH - 0.05),
      this.screenMaterial
    );
    screen.position.set(0, monY, monZ + monD / 2 + 0.002);
    pc.add(screen);
    this.screen = screen;

    // RectAreaLight als Bildschirm-Glow nach vorne
    const screenLight = new THREE.RectAreaLight(0x88a0ff, 14, monW - 0.1, monH - 0.1);
    screenLight.position.set(0, monY, monZ + monD / 2 + 0.01);
    screenLight.lookAt(0, monY - 0.4, monZ + 2);
    pc.add(screenLight);
    this.screenLight = screenLight;

    // Webcam OBEN am Monitor (Premium-Look)
    const webcam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16),
      new THREE.MeshStandardMaterial({ color: 0x06060c, roughness: 0.3, metalness: 0.7 })
    );
    webcam.rotation.z = Math.PI / 2;
    webcam.position.set(0, monY + monH / 2 + 0.05, monZ + 0.02);
    pc.add(webcam);
    // Webcam-Linse
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.025, 24),
      new THREE.MeshStandardMaterial({ color: 0x0a0a1a, roughness: 0.1, metalness: 0.95 })
    );
    lens.position.set(0, monY + monH / 2 + 0.05, monZ + 0.045);
    pc.add(lens);
    // Webcam-LED (cyan)
    const webcamLed = new THREE.Mesh(
      new THREE.PlaneGeometry(0.012, 0.008),
      new THREE.MeshBasicMaterial({ color: 0x3affe6 })
    );
    webcamLed.position.set(0.06, monY + monH / 2 + 0.05, monZ + 0.045);
    pc.add(webcamLed);

    // Bias-Light hinter Monitor → Wand
    const bias = new THREE.Mesh(
      new THREE.PlaneGeometry(monW - 0.2, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xa050ff })
    );
    bias.position.set(0, monY + monH / 2 + 0.12, monZ - 0.05);
    pc.add(bias);
    const biasLight = new THREE.PointLight(0xa050ff, 2.6, 5, 1.5);
    biasLight.position.set(0, monY + 0.4, monZ - 0.7);
    pc.add(biasLight);
    this.biasLight = biasLight;

    // Power-LED unten am Bezel
    const led = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x3affc8 })
    );
    led.position.set(0, monY - monH / 2 + 0.04, monZ + monD / 2 + 0.001);
    pc.add(led);

    // Stand (Arm + Sockel)
    const armMat = new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.3, metalness: 0.85 });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.06), armMat);
    arm.position.set(0, 1.22, monZ);
    arm.castShadow = true;
    pc.add(arm);
    const standBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 0.025, 32),
      armMat
    );
    standBase.position.set(0, 1.04, monZ);
    standBase.castShadow = true;
    pc.add(standBase);

    // Hot-Zone für Raycaster (großzügig, damit Klick zuverlässig greift)
    const hot = new THREE.Mesh(
      new THREE.PlaneGeometry(monW + 0.5, monH + 0.4),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hot.position.set(0, monY, monZ + monD / 2 + 0.05);
    pc.add(hot);
    this.monitorHotZone = hot;

    // ── Tower-PC (rechts auf dem Boden, Glas-Side, RGB-Lüfter) ──
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x07080e, roughness: 0.3, metalness: 0.7 });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.9, 0.5), towerMat);
    tower.position.set(2.5, 0.45, 0.1);
    tower.castShadow = true;
    pc.add(tower);

    // Glas-Panel vorne
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x000510,
      roughness: 0.04, metalness: 0.0,
      transmission: 0.5,
      transparent: true, opacity: 0.5,
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.8), glassMat);
    glass.position.set(2.5, 0.45, 0.37);
    pc.add(glass);

    // 3 RGB-Lüfter (Discs + PointLights)
    const fanColors = [0xa050ff, 0x3affe6, 0xff5db4];
    for (let i = 0; i < 3; i++) {
      const fanRing = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.1, 32),
        new THREE.MeshBasicMaterial({ color: fanColors[i], side: THREE.DoubleSide })
      );
      fanRing.position.set(2.5, 0.78 - i * 0.27, 0.27);
      pc.add(fanRing);
      const fanCenter = new THREE.Mesh(
        new THREE.CircleGeometry(0.075, 24),
        new THREE.MeshStandardMaterial({ color: 0x06060c, roughness: 0.4 })
      );
      fanCenter.position.set(2.5, 0.78 - i * 0.27, 0.272);
      pc.add(fanCenter);
      // Blade-Andeutung (3 Linien)
      for (let b = 0; b < 4; b++) {
        const blade = new THREE.Mesh(
          new THREE.PlaneGeometry(0.13, 0.012),
          new THREE.MeshStandardMaterial({ color: 0x18141e, roughness: 0.5 })
        );
        blade.position.set(2.5, 0.78 - i * 0.27, 0.273);
        blade.rotation.z = (Math.PI / 4) * b + i * 0.15;
        pc.add(blade);
      }
      const fanLight = new THREE.PointLight(fanColors[i], 0.9, 1.4, 2);
      fanLight.position.set(2.5, 0.78 - i * 0.27, 0.45);
      pc.add(fanLight);
    }
    // Power-LED Tower
    const towerLed = new THREE.Mesh(
      new THREE.PlaneGeometry(0.03, 0.015),
      new THREE.MeshBasicMaterial({ color: 0x3affe6 })
    );
    towerLed.position.set(2.32, 0.86, 0.351);
    pc.add(towerLed);

    this.scene.add(pc);
  }

  makeScreenCanvas() {
    const c = document.createElement('canvas');
    c.width = 600; c.height = 250;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, c.width, c.height);
    grd.addColorStop(0,   '#1f3aa0');
    grd.addColorStop(0.5, '#4632a8');
    grd.addColorStop(1,   '#280f50');
    g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);

    const rg = g.createRadialGradient(300, 125, 25, 300, 125, 280);
    rg.addColorStop(0, 'rgba(190, 150, 255, 0.55)');
    rg.addColorStop(1, 'rgba(190, 150, 255, 0)');
    g.fillStyle = rg; g.fillRect(0, 0, c.width, c.height);

    // Grid
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 1;
    for (let x = 0; x < c.width; x += 30) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
    for (let y = 0; y < c.height; y += 30) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }

    // Brand
    g.font = 'bold 50px "JetBrains Mono", monospace';
    g.fillStyle = 'rgba(246, 255, 58, 0.96)';
    g.textAlign = 'center';
    g.fillText('TIM·ULRICH', 300, 135);
    g.font = '14px "JetBrains Mono", monospace';
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText('• click to enter •', 300, 170);

    return c;
  }

  /* ── Peripherie: detailliertere Tastatur, Maus, Speaker,
       Mic, Stifte, Bücher, Headphones, Pflanze, Phone, Tablet ── */
  buildPeripherals() {
    const matBlack = new THREE.MeshStandardMaterial({ color: 0x06070c, roughness: 0.35, metalness: 0.6 });
    const matSoft  = new THREE.MeshStandardMaterial({ color: 0x18141e, roughness: 0.6, metalness: 0.3 });

    // ── MECHANICAL KEYBOARD mit visuellen Keycaps ───────────
    const kbBaseMat = new THREE.MeshStandardMaterial({ color: 0x06070c, roughness: 0.45, metalness: 0.4 });
    const kbBase = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 0.36), kbBaseMat);
    kbBase.position.set(0, 1.06, 0.3);
    kbBase.castShadow = true;
    this.scene.add(kbBase);

    // Keycaps via Canvas-Texture
    const kcCanvas = document.createElement('canvas');
    kcCanvas.width = 920; kcCanvas.height = 280;
    const kg = kcCanvas.getContext('2d');
    kg.fillStyle = '#0d0e16'; kg.fillRect(0, 0, kcCanvas.width, kcCanvas.height);
    // Tasten zeichnen (5 Reihen)
    const rows = 5, cols = 16;
    const padX = 8, padY = 8;
    const keyW = (kcCanvas.width - padX * 2 - (cols - 1) * 4) / cols;
    const keyH = (kcCanvas.height - padY * 2 - (rows - 1) * 4) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = padX + c * (keyW + 4);
        const y = padY + r * (keyH + 4);
        // Keycap-Hintergrund
        kg.fillStyle = '#1c1a2a';
        kg.beginPath();
        kg.roundRect(x, y, keyW, keyH, 6);
        kg.fill();
        // Subtle highlight
        const grd = kg.createLinearGradient(x, y, x, y + keyH);
        grd.addColorStop(0, 'rgba(255,255,255,0.05)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        kg.fillStyle = grd;
        kg.fill();
      }
    }
    const kbTex = new THREE.CanvasTexture(kcCanvas);
    kbTex.colorSpace = THREE.SRGBColorSpace;
    const kbSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.32),
      new THREE.MeshStandardMaterial({ map: kbTex, roughness: 0.55, metalness: 0.2 })
    );
    kbSurface.rotation.x = -Math.PI / 2;
    kbSurface.position.set(0, 1.0825, 0.3);
    this.scene.add(kbSurface);
    // RGB-Underglow
    const kbGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xa050ff, transparent: true, opacity: 0.6 })
    );
    kbGlow.rotation.x = -Math.PI / 2;
    kbGlow.position.set(0, 1.044, 0.3);
    this.scene.add(kbGlow);
    const kbLight = new THREE.PointLight(0xa050ff, 0.7, 1.2, 2);
    kbLight.position.set(0, 1.1, 0.3);
    this.scene.add(kbLight);

    // ── MAUS (Gaming-Style) ────────────────────────────────
    const mouseBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 18, 14),
      matBlack
    );
    mouseBody.scale.set(1, 0.5, 1.55);
    mouseBody.position.set(0.85, 1.085, 0.42);
    mouseBody.castShadow = true;
    this.scene.add(mouseBody);
    // DPI-Buttons (klein, oben)
    const dpi = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.008, 0.018),
      new THREE.MeshStandardMaterial({ color: 0x12101a, roughness: 0.5 })
    );
    dpi.position.set(0.85, 1.122, 0.42);
    this.scene.add(dpi);
    // Scroll-Wheel
    const wheel = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.022, 0.025),
      new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.3 })
    );
    wheel.position.set(0.85, 1.122, 0.385);
    this.scene.add(wheel);
    // Underglow
    const mouseUnder = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 24),
      new THREE.MeshBasicMaterial({ color: 0x3affe6, transparent: true, opacity: 0.55 })
    );
    mouseUnder.rotation.x = -Math.PI / 2;
    mouseUnder.position.set(0.85, 1.046, 0.42);
    this.scene.add(mouseUnder);

    // Mauspad mit Rand-Glow
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x0a0810, roughness: 0.95 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0.85, 1.044, 0.42);
    this.scene.add(pad);
    // Pad-Edge (Glow)
    const padEdgeC = document.createElement('canvas');
    padEdgeC.width = 280; padEdgeC.height = 200;
    const peg = padEdgeC.getContext('2d');
    peg.strokeStyle = '#3affe6';
    peg.lineWidth = 8;
    peg.shadowColor = '#3affe6';
    peg.shadowBlur = 12;
    peg.strokeRect(8, 8, 264, 184);
    const padEdgeTex = new THREE.CanvasTexture(padEdgeC);
    padEdgeTex.colorSpace = THREE.SRGBColorSpace;
    const padEdgeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.58, 0.42),
      new THREE.MeshBasicMaterial({ map: padEdgeTex, transparent: true })
    );
    padEdgeMesh.rotation.x = -Math.PI / 2;
    padEdgeMesh.position.set(0.85, 1.0445, 0.42);
    this.scene.add(padEdgeMesh);

    // ── STUDIO SPEAKER (links und rechts, mit Woofer-Cones) ─
    const buildSpeaker = (x) => {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.17, 0.36, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x07070d, roughness: 0.55, metalness: 0.35 })
      );
      body.position.set(x, 1.24, -0.4);
      body.castShadow = true;
      this.scene.add(body);
      // Woofer (großer Kreis)
      const woofer = new THREE.Mesh(
        new THREE.CircleGeometry(0.062, 32),
        new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 0.85 })
      );
      woofer.position.set(x + Math.sign(x) * 0.001, 1.18, -0.31);
      this.scene.add(woofer);
      const wooferCenter = new THREE.Mesh(
        new THREE.CircleGeometry(0.018, 16),
        new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.4 })
      );
      wooferCenter.position.set(x + Math.sign(x) * 0.001, 1.18, -0.305);
      this.scene.add(wooferCenter);
      // Tweeter (kleiner oben)
      const tweeter = new THREE.Mesh(
        new THREE.CircleGeometry(0.025, 20),
        new THREE.MeshStandardMaterial({ color: 0x06060c, roughness: 0.7 })
      );
      tweeter.position.set(x + Math.sign(x) * 0.001, 1.32, -0.31);
      this.scene.add(tweeter);
      // Brand-LED (subtil)
      const sLed = new THREE.Mesh(
        new THREE.PlaneGeometry(0.01, 0.006),
        new THREE.MeshBasicMaterial({ color: 0x3affe6 })
      );
      sLed.position.set(x + Math.sign(x) * 0.001, 1.075, -0.31);
      this.scene.add(sLed);
    };
    buildSpeaker(-1.55);
    buildSpeaker(1.55);

    // ── STUDIO-MIKROFON auf Boom-Arm (Streamer-Look) ───────
    // Boom-Arm
    const boomMat = new THREE.MeshStandardMaterial({ color: 0x06070c, roughness: 0.35, metalness: 0.8 });
    const boomBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 0.06, 16), boomMat
    );
    boomBase.position.set(-1.95, 1.07, 0.6);
    this.scene.add(boomBase);
    const armSeg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.38, 12), boomMat);
    armSeg1.position.set(-1.95, 1.27, 0.6);
    this.scene.add(armSeg1);
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), boomMat);
    joint.position.set(-1.95, 1.46, 0.6);
    this.scene.add(joint);
    const armSeg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 12), boomMat);
    armSeg2.rotation.z = Math.PI / 4;
    armSeg2.position.set(-1.8, 1.62, 0.6);
    this.scene.add(armSeg2);
    // Mikrofon-Korpus
    const micBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.045, 0.18, 24),
      new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.35, metalness: 0.7 })
    );
    micBody.rotation.z = Math.PI / 2;
    micBody.position.set(-1.55, 1.78, 0.6);
    this.scene.add(micBody);
    // Mic-Gitter (helleres Mesh)
    const micMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: 0x1a1828, roughness: 0.4, metalness: 0.85 })
    );
    micMesh.rotation.z = Math.PI / 2;
    micMesh.position.set(-1.48, 1.78, 0.6);
    this.scene.add(micMesh);
    // Mic-LED
    const micLed = new THREE.Mesh(
      new THREE.PlaneGeometry(0.012, 0.006),
      new THREE.MeshBasicMaterial({ color: 0xff5db4 })
    );
    micLed.position.set(-1.62, 1.81, 0.6);
    micLed.rotation.y = Math.PI / 2;
    this.scene.add(micLed);

    // ── HEADPHONES auf Stand (links neben Mic-Base) ────────
    const standMat = new THREE.MeshStandardMaterial({ color: 0x06060a, roughness: 0.3, metalness: 0.8 });
    const hpPole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 12), standMat);
    hpPole.position.set(-1.25, 1.22, 0.55);
    this.scene.add(hpPole);
    const hpBase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.022, 24), standMat);
    hpBase.position.set(-1.25, 1.05, 0.55);
    hpBase.receiveShadow = true;
    this.scene.add(hpBase);
    // Bügel
    const hpBow = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.018, 12, 32, Math.PI * 1.05),
      new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.4, metalness: 0.4 })
    );
    hpBow.rotation.z = Math.PI;
    hpBow.position.set(-1.25, 1.46, 0.55);
    this.scene.add(hpBow);
    // Earcups
    [-0.11, 0.11].forEach(off => {
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.062, 0.062, 0.05, 24),
        new THREE.MeshStandardMaterial({ color: 0x0c0c16, roughness: 0.55 })
      );
      cup.rotation.z = Math.PI / 2;
      cup.position.set(-1.25 + off, 1.34, 0.55);
      this.scene.add(cup);
      // Cup-Ring (LED)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.05, 0.062, 24),
        new THREE.MeshBasicMaterial({ color: 0xa050ff, side: THREE.DoubleSide })
      );
      ring.rotation.y = Math.PI / 2;
      ring.position.set(-1.25 + off + Math.sign(off) * 0.026, 1.34, 0.55);
      this.scene.add(ring);
    });

    // ── PEN HOLDER (Becher mit Stiften) ─────────────────────
    const penHolder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.055, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.4, metalness: 0.3 })
    );
    penHolder.position.set(-0.85, 1.12, 0.65);
    penHolder.castShadow = true;
    this.scene.add(penHolder);
    // Stifte (5 verschiedene)
    const pens = [
      { color: 0x06060c, off: [0, 0], len: 0.22 },
      { color: 0xc8421b, off: [0.02, 0.015], len: 0.20 },
      { color: 0x3affe6, off: [-0.02, 0.005], len: 0.18 },
      { color: 0xa050ff, off: [0.015, -0.02], len: 0.21 },
      { color: 0xf0e8b8, off: [-0.005, -0.018], len: 0.16 },
    ];
    pens.forEach(p => {
      const pen = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, p.len, 8),
        new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.4, metalness: 0.3 })
      );
      pen.position.set(-0.85 + p.off[0], 1.18 + p.len / 2 - 0.07, 0.65 + p.off[1]);
      // Leicht schief
      pen.rotation.x = (Math.random() - 0.5) * 0.1;
      pen.rotation.z = (Math.random() - 0.5) * 0.08;
      this.scene.add(pen);
      // Spitze
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.006, 0.018, 8),
        new THREE.MeshStandardMaterial({ color: p.color === 0xf0e8b8 ? 0x0a0a14 : 0xf6f4e8, roughness: 0.4 })
      );
      tip.position.copy(pen.position);
      tip.position.y += p.len / 2;
      tip.rotation.copy(pen.rotation);
      this.scene.add(tip);
    });

    // ── NOTEPAD + offenes Buch ──────────────────────────────
    const notepad = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.018, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xece6d8, roughness: 0.85 })
    );
    notepad.position.set(-0.55, 1.06, 0.6);
    notepad.rotation.y = 0.22;
    notepad.castShadow = true;
    this.scene.add(notepad);
    // Linien auf Notepad
    for (let i = 0; i < 6; i++) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(0.24, 0.0012),
        new THREE.MeshBasicMaterial({ color: 0xc0bcaa })
      );
      line.rotation.x = -Math.PI / 2;
      line.rotation.z = 0.22;
      line.position.set(-0.55 + i * 0.011, 1.07, 0.46 + i * 0.052);
      this.scene.add(line);
    }
    // Bindung oben (Spirale-Andeutung)
    for (let i = 0; i < 9; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.008, 0.0025, 6, 12),
        new THREE.MeshStandardMaterial({ color: 0x4a4a55, roughness: 0.3, metalness: 0.8 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = 0.22;
      ring.position.set(-0.69 + i * 0.027, 1.072, 0.43 + i * 0.006);
      this.scene.add(ring);
    }

    // ── BÜCHER-STAPEL (rechts hinten) ───────────────────────
    const bookColors = [0x3a2848, 0x1a3a48, 0x603018];
    bookColors.forEach((c, i) => {
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.038, 0.3),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })
      );
      book.position.set(1.95, 1.063 + i * 0.041, 0.55);
      book.rotation.y = -0.15 + i * 0.05;
      book.castShadow = true;
      this.scene.add(book);
      // Buch-Spine (Gold-Streifen)
      const spine = new THREE.Mesh(
        new THREE.PlaneGeometry(0.21, 0.005),
        new THREE.MeshBasicMaterial({ color: 0xc8a04a })
      );
      spine.rotation.x = -Math.PI / 2;
      spine.position.set(1.95, 1.083 + i * 0.041, 0.55);
      spine.rotation.z = -0.15 + i * 0.05;
      this.scene.add(spine);
    });

    // ── COFFEE MUG mit Henkel ──────────────────────────────
    const mugMat = new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.4, metalness: 0.2 });
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.13, 24), mugMat);
    mug.position.set(1.05, 1.115, 0.6);
    mug.castShadow = true;
    this.scene.add(mug);
    const mugHandle = new THREE.Mesh(
      new THREE.TorusGeometry(0.04, 0.012, 10, 18, Math.PI),
      mugMat
    );
    mugHandle.position.set(1.15, 1.115, 0.6);
    mugHandle.rotation.y = Math.PI / 2;
    this.scene.add(mugHandle);
    // Kaffee-Surface
    const coffee = new THREE.Mesh(
      new THREE.CircleGeometry(0.065, 24),
      new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.5 })
    );
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.set(1.05, 1.179, 0.6);
    this.scene.add(coffee);

    // ── SMARTPHONE liegt auf dem Tisch ──────────────────────
    const phone = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.012, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x06060c, roughness: 0.25, metalness: 0.85 })
    );
    phone.position.set(1.4, 1.05, 0.65);
    phone.rotation.y = -0.18;
    phone.castShadow = true;
    this.scene.add(phone);
    // Phone-Screen
    const phoneScr = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.29),
      new THREE.MeshBasicMaterial({ color: 0x121430 })
    );
    phoneScr.rotation.x = -Math.PI / 2;
    phoneScr.rotation.z = -0.18;
    phoneScr.position.set(1.4, 1.062, 0.65);
    this.scene.add(phoneScr);
    // Camera-Bump
    const phoneCam = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.005, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.4 })
    );
    phoneCam.position.set(1.42, 1.054, 0.78);
    phoneCam.rotation.y = -0.18;
    this.scene.add(phoneCam);

    // ── KLEINE PFLANZE auf dem Tisch (rechts) ──────────────
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.055, 0.1, 18),
      new THREE.MeshStandardMaterial({ color: 0x1c1418, roughness: 0.9 })
    );
    pot.position.set(1.95, 1.095, 0.0);
    pot.castShadow = true;
    this.scene.add(pot);
    // Erde
    const soil = new THREE.Mesh(
      new THREE.CircleGeometry(0.064, 16),
      new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 1 })
    );
    soil.rotation.x = -Math.PI / 2;
    soil.position.set(1.95, 1.146, 0.0);
    this.scene.add(soil);
    // Sukkulent-Blätter (organisch geschichtet)
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x4a8a5e,
      roughness: 0.6,
      emissive: 0x1a4a2e,
      emissiveIntensity: 0.18,
    });
    for (let layer = 0; layer < 3; layer++) {
      const n = 6 + layer * 2;
      const r = 0.05 - layer * 0.012;
      const h = 1.16 + layer * 0.025;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + layer * 0.3;
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.018, 10, 8),
          leafMat
        );
        leaf.scale.set(0.7, 1.6, 0.45);
        leaf.position.set(
          1.95 + Math.cos(a) * r,
          h,
          Math.sin(a) * r
        );
        leaf.rotation.y = a;
        leaf.rotation.z = Math.PI / 4;
        this.scene.add(leaf);
      }
    }
  }

  /* ── Cleaner Red-Glow-Stick (statt der filigranen Lampe) ── */
  buildDeskLamp() {
    const lamp = new THREE.Group();

    // Position: links hinten am Tisch, hinter dem Speaker
    const baseX = -2.0;
    const baseY = 1.04;
    const baseZ = -0.2;
    const red = 0xff2a3a;

    // 1. Fußplatte — schwarze Disc, sitzt sauber auf dem Tisch
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.085, 0.025, 32),
      new THREE.MeshStandardMaterial({ color: 0x06060c, roughness: 0.3, metalness: 0.8 })
    );
    base.position.set(baseX, baseY + 0.012, baseZ);
    base.castShadow = true;
    lamp.add(base);

    // 2. Glow-Säule — schlanker leuchtender Zylinder, dominiert die Form
    const tubeH = 0.46;
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, tubeH, 28),
      new THREE.MeshBasicMaterial({ color: red })
    );
    tube.position.set(baseX, baseY + 0.025 + tubeH / 2, baseZ);
    lamp.add(tube);

    // 3. Top-Cap — kleine schwarze Disc oben, sauberes Finish
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.012, 24),
      new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.3, metalness: 0.8 })
    );
    cap.position.set(baseX, baseY + 0.025 + tubeH + 0.006, baseZ);
    lamp.add(cap);

    // 4. Rotes Punktlicht — strahlt vom Mittelpunkt der Säule aus
    const glow = new THREE.PointLight(red, 1.8, 2.4, 1.6);
    glow.position.set(baseX, baseY + 0.025 + tubeH / 2, baseZ);
    lamp.add(glow);

    // 5. Roter Licht-Pool auf dem Tisch direkt um den Fuß (Reflexion)
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(0.26, 32),
      new THREE.MeshBasicMaterial({ color: red, transparent: true, opacity: 0.15 })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(baseX, baseY + 0.046, baseZ);
    lamp.add(pool);

    this.scene.add(lamp);
    this.deskLamp = lamp;
    this.deskLampBulb = glow;
  }

  /* ── WAND-DESIGN: cleaner, mit Lücken ─────────────────── */
  buildWallArt() {
    // ── 2 dezente vertikale LED-Bars (weit außen, klare Lücke
    //    zu Regal und Monitor) ────────────────────────────────
    const tallBars = [
      { x: -4.0, color: 0xb060ff },
      { x:  4.0, color: 0xb060ff },
    ];
    tallBars.forEach(b => {
      // 3 Segmente mit Lücken — modern "broken strip"-Look
      const segments = [
        { yc: 1.6, h: 1.2 },
        { yc: 3.2, h: 0.8 },
        { yc: 4.6, h: 1.0 },
      ];
      segments.forEach(s => {
        const bar = new THREE.Mesh(
          new THREE.PlaneGeometry(0.05, s.h),
          new THREE.MeshBasicMaterial({ color: b.color })
        );
        bar.position.set(b.x, s.yc, -2.96);
        this.scene.add(bar);
      });
      // Ein Sammel-Licht pro Bar
      const light = new THREE.PointLight(b.color, 1.4, 4.5, 1.6);
      light.position.set(b.x, 3.0, -2.3);
      this.scene.add(light);
    });

    // ── Backlit "T·U" Logo, eleganter und kleiner ──────────
    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = 520; logoCanvas.height = 240;
    const lg = logoCanvas.getContext('2d');
    lg.fillStyle = 'rgba(8, 4, 16, 0)'; lg.fillRect(0, 0, 520, 240);
    // Heller Outer-Glow als Layer-Effekt
    lg.font = 'bold 110px "Fraunces", serif';
    lg.fillStyle = '#fff0a8';
    lg.shadowColor = '#ffb060';
    lg.shadowBlur = 38;
    lg.textAlign = 'center';
    lg.fillText('T·U', 260, 160);
    // Doppelt für stärkeren Glow
    lg.shadowBlur = 16;
    lg.fillText('T·U', 260, 160);
    const logoTex = new THREE.CanvasTexture(logoCanvas);
    logoTex.colorSpace = THREE.SRGBColorSpace;
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.5),
      new THREE.MeshBasicMaterial({ map: logoTex, transparent: true })
    );
    logo.position.set(0, 4.5, -2.96);
    this.scene.add(logo);
    const logoLight = new THREE.PointLight(0xffb060, 0.8, 3.2, 2);
    logoLight.position.set(0, 4.5, -2.4);
    this.scene.add(logoLight);

    // ── 2 dezente Akzent-Panels symmetrisch links/rechts vom Logo
    //    (mit klarem Abstand zueinander und zum Logo) ────────
    const panelColor = 0x8848d8;
    const panels = [
      { x: -2.1, y: 4.5, w: 0.7, h: 0.5 },
      { x:  2.1, y: 4.5, w: 0.7, h: 0.5 },
    ];
    panels.forEach(p => {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(p.w, p.h),
        new THREE.MeshBasicMaterial({ color: panelColor, transparent: true, opacity: 0.78 })
      );
      panel.position.set(p.x, p.y, -2.96);
      this.scene.add(panel);
      // Dünner schwarzer Rahmen drumherum
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x02020a, roughness: 0.35, metalness: 0.75 });
      [
        { ox: 0, oy: p.h / 2 + 0.013, w: p.w + 0.026, h: 0.018 },
        { ox: 0, oy: -p.h / 2 - 0.013, w: p.w + 0.026, h: 0.018 },
        { ox: -p.w / 2 - 0.013, oy: 0, w: 0.018, h: p.h + 0.018 },
        { ox:  p.w / 2 + 0.013, oy: 0, w: 0.018, h: p.h + 0.018 },
      ].forEach(s => {
        const f = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, 0.022), frameMat);
        f.position.set(p.x + s.ox, p.y + s.oy, -2.948);
        this.scene.add(f);
      });
      const pl = new THREE.PointLight(panelColor, 0.65, 2.6, 1.8);
      pl.position.set(p.x, p.y, -2.35);
      this.scene.add(pl);
    });

    // ── Cyan-LED Strip rechte Seitenwand (horizontal, dezent) ──
    const sideStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, 2.4),
      new THREE.MeshBasicMaterial({ color: 0x3affe6 })
    );
    sideStrip.rotation.y = -Math.PI / 2;
    sideStrip.rotation.z = Math.PI / 2;
    sideStrip.position.set(5.47, 4.5, -0.5);
    this.scene.add(sideStrip);
    const sideLight = new THREE.PointLight(0x3affe6, 0.7, 3.5, 2);
    sideLight.position.set(4.9, 4.5, -0.5);
    this.scene.add(sideLight);
  }

  /* ── Wandregal mit Items (kompakter, klar abgegrenzt) ──── */
  buildShelf() {
    // Schwebendes Regal — kompakter (1.7 statt 2.2), zentriert
    // bei x=2.9 sodass es zwischen Monitor (Ende x=1.2) und
    // rechtem LED-Bar (x=4.0) klar Platz hat
    const shelfX = 2.9;
    const shelfW = 1.4;
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x06060a, roughness: 0.35, metalness: 0.7 });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(shelfW, 0.045, 0.3), shelfMat);
    shelf.position.set(shelfX, 2.3, -2.83);
    shelf.castShadow = true;
    this.scene.add(shelf);
    // Halterungen
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.28), shelfMat);
    support.position.set(shelfX - shelfW / 2 + 0.06, 2.4, -2.85);
    this.scene.add(support);
    const support2 = support.clone();
    support2.position.set(shelfX + shelfW / 2 - 0.06, 2.4, -2.85);
    this.scene.add(support2);

    // Under-Shelf LED-Glow (cyan)
    const ledStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(shelfW - 0.15, 0.025),
      new THREE.MeshBasicMaterial({ color: 0x3affe6 })
    );
    ledStrip.position.set(shelfX, 2.276, -2.7);
    this.scene.add(ledStrip);
    const ledLight = new THREE.PointLight(0x3affe6, 1.0, 2.4, 1.6);
    ledLight.position.set(shelfX, 2.2, -2.5);
    this.scene.add(ledLight);

    // ── Items auf dem Regal ──
    // 3 stehende Bücher (links)
    const stoodBookColors = [0x4a2858, 0x1a3a58, 0x4a1820];
    stoodBookColors.forEach((c, i) => {
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.28, 0.2),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })
      );
      book.position.set(shelfX - shelfW / 2 + 0.18 + i * 0.06, 2.46, -2.84);
      book.castShadow = true;
      this.scene.add(book);
    });

    // Hängende Pothos-Pflanze (rechts)
    const potShelf = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.06, 0.09, 16),
      new THREE.MeshStandardMaterial({ color: 0x14101a, roughness: 0.85 })
    );
    potShelf.position.set(shelfX + shelfW / 2 - 0.18, 2.37, -2.83);
    this.scene.add(potShelf);
    const hangMat = new THREE.MeshStandardMaterial({ color: 0x4a8a5e, roughness: 0.6 });
    for (let i = 0; i < 6; i++) {
      const len = 0.25 + Math.random() * 0.25;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, len, 6),
        hangMat
      );
      const ang = (i / 6) * Math.PI * 2;
      const px = shelfX + shelfW / 2 - 0.18 + Math.cos(ang) * 0.04;
      const pz = -2.83 + Math.sin(ang) * 0.04;
      stem.position.set(px, 2.41 - len / 2, pz);
      stem.rotation.x = Math.sin(ang) * 0.2;
      stem.rotation.z = Math.cos(ang) * 0.2;
      this.scene.add(stem);
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 8, 8),
        hangMat
      );
      leaf.scale.set(1, 1.8, 0.5);
      leaf.position.set(
        shelfX + shelfW / 2 - 0.18 + Math.cos(ang) * 0.08,
        2.41 - len,
        -2.83 + Math.sin(ang) * 0.07
      );
      this.scene.add(leaf);
    }

    // Mittiges gerahmtes Foto (Sonnenuntergang-Print, dezent)
    const photoCanvas = document.createElement('canvas');
    photoCanvas.width = 200; photoCanvas.height = 260;
    const pg = photoCanvas.getContext('2d');
    const gradient = pg.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, '#3a1860');
    gradient.addColorStop(0.45, '#a050ff');
    gradient.addColorStop(0.75, '#ff8050');
    gradient.addColorStop(1, '#2a0610');
    pg.fillStyle = gradient; pg.fillRect(0, 0, 200, 260);
    // Berge
    pg.fillStyle = 'rgba(0,0,0,0.7)';
    pg.beginPath();
    pg.moveTo(0, 210); pg.lineTo(40, 160); pg.lineTo(85, 195);
    pg.lineTo(130, 145); pg.lineTo(200, 200); pg.lineTo(200, 260); pg.lineTo(0, 260);
    pg.closePath(); pg.fill();
    // Sonne
    pg.fillStyle = 'rgba(255, 220, 160, 0.85)';
    pg.beginPath(); pg.arc(135, 170, 22, 0, Math.PI * 2); pg.fill();
    const photoTex = new THREE.CanvasTexture(photoCanvas);
    photoTex.colorSpace = THREE.SRGBColorSpace;
    const photo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.27),
      new THREE.MeshBasicMaterial({ map: photoTex })
    );
    photo.position.set(shelfX, 2.55, -2.825);
    this.scene.add(photo);
    const photoFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.225, 0.295, 0.012),
      new THREE.MeshStandardMaterial({ color: 0x06060a, roughness: 0.3, metalness: 0.7 })
    );
    photoFrame.position.set(shelfX, 2.55, -2.835);
    this.scene.add(photoFrame);
  }

  /* ── Beleuchtung (deutlich heller) ─────────────────────── */
  buildLights() {
    // Hemisphere für indirekte Grundhelligkeit
    const hemi = new THREE.HemisphereLight(0x9080cc, 0x101020, 0.55);
    this.scene.add(hemi);

    // Hauptlicht von oben (warm weiß-violett)
    const key = new THREE.DirectionalLight(0xe8d8ff, 1.1);
    key.position.set(2, 6, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0002;
    key.shadow.camera.left = -6; key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;   key.shadow.camera.bottom = -6;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 20;
    this.scene.add(key);

    // Fenster-Glow
    const winLight = new THREE.PointLight(0x4a7bff, 2.4, 9, 1.4);
    winLight.position.set(-3.5, 3.6, -1.9);
    this.scene.add(winLight);

    // Tisch-Spot (warmes weißes Schreibtisch-Licht)
    const deskSpot = new THREE.SpotLight(0xfff0cc, 1.8, 6, Math.PI * 0.32, 0.5, 1.2);
    deskSpot.position.set(0.5, 5.8, 1.0);
    deskSpot.target.position.set(0.3, 1.06, 0.4);
    deskSpot.castShadow = true;
    deskSpot.shadow.mapSize.set(1024, 1024);
    this.scene.add(deskSpot);
    this.scene.add(deskSpot.target);

    // Desk-Underglow (gelb)
    const deskGlow = new THREE.PointLight(0xf6ff3a, 1.0, 3.2, 2);
    deskGlow.position.set(0, 0.8, 0.92);
    this.scene.add(deskGlow);
    [-1.8, 1.8].forEach(x => {
      const g = new THREE.PointLight(0xf6ff3a, 0.55, 2.6, 2);
      g.position.set(x, 0.8, 0.92);
      this.scene.add(g);
    });

    // Fill-Lichter — atmosphärisch
    const fillL = new THREE.PointLight(0xa050ff, 0.6, 5, 2);
    fillL.position.set(-2.5, 2.6, 1.6);
    this.scene.add(fillL);
    const fillR = new THREE.PointLight(0x3affe6, 0.5, 5, 2);
    fillR.position.set(2.5, 2.6, 1.6);
    this.scene.add(fillR);

    // Mic-Boom-Highlight
    const micLight = new THREE.PointLight(0xc890ff, 0.4, 1.8, 2);
    micLight.position.set(-1.55, 1.85, 0.9);
    this.scene.add(micLight);
  }

  buildParticles() {
    const count = 100;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 6;
      pos[i * 3 + 1] = Math.random() * 3.5 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xddd8ff,
      size: 0.014,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  testMonitorClick(clientX, clientY) {
    if (!this.monitorHotZone) return false;
    const x = (clientX / window.innerWidth) * 2 - 1;
    const y = -(clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera({ x, y }, this.camera);
    const hits = this.raycaster.intersectObject(this.monitorHotZone);
    return hits.length > 0;
  }

  async zoomIntoMonitor() {
    if (this.zooming) return;
    this.zooming = true;
    const start = this.camera.position.clone();
    const startLook = new THREE.Vector3(0, 1.4, 0);
    const end = new THREE.Vector3(0, 1.85, -0.05);
    const endLook = new THREE.Vector3(0, 1.85, -1.5);
    const dur = 1500;
    const t0 = performance.now();
    return new Promise(resolve => {
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        this.camera.position.lerpVectors(start, end, e);
        const look = startLook.clone().lerp(endLook, e);
        this.camera.lookAt(look);
        if (this.screenLight) this.screenLight.intensity = 14 + e * 6;
        if (this.biasLight)  this.biasLight.intensity   = 2.6 + e * 1.8;
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }
  async zoomOut() {
    const start = this.camera.position.clone();
    const startLook = new THREE.Vector3(0, 1.85, -1.5);
    const end = this.cameraIdle.clone();
    const endLook = new THREE.Vector3(0, 1.4, 0);
    const dur = 1100;
    const t0 = performance.now();
    return new Promise(resolve => {
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        this.camera.position.lerpVectors(start, end, e);
        const look = startLook.clone().lerp(endLook, e);
        this.camera.lookAt(look);
        if (this.screenLight) this.screenLight.intensity = 20 - e * 6;
        if (this.biasLight)  this.biasLight.intensity   = 4.4 - e * 1.8;
        if (t < 1) requestAnimationFrame(step);
        else { this.zooming = false; resolve(); }
      };
      requestAnimationFrame(step);
    });
  }

  loop() {
    this.t += 0.011;
    this.mouse.x += (this.mouseTarget.x - this.mouse.x) * 0.035;
    this.mouse.y += (this.mouseTarget.y - this.mouse.y) * 0.035;

    if (!this.zooming) {
      const bob  = Math.sin(this.t * 0.35) * 0.014;
      const sway = Math.sin(this.t * 0.24) * 0.02;
      this.camera.position.x = this.cameraIdle.x + sway + this.mouse.x * 0.14;
      this.camera.position.y = this.cameraIdle.y + bob  + this.mouse.y * 0.07;
      this.camera.lookAt(0, 1.4, this.mouse.x * -0.12);
    }

    if (this.particles) {
      const positions = this.particles.geometry.attributes.position;
      const arr = positions.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += 0.0006 * (Math.sin(this.t + i) + 1);
        if (arr[i + 1] > 4) arr[i + 1] = 0.4;
      }
      positions.needsUpdate = true;
    }

    if (this.biasLight && !this.zooming) {
      this.biasLight.intensity = 2.6 + Math.sin(this.t * 0.5) * 0.28;
    }
    if (this.screenLight && !this.zooming) {
      this.screenLight.intensity = 14 + Math.sin(this.t * 0.7) * 0.6;
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
        <button class="os-window-close-big" title="Zurück zum Desktop">✕</button>
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
    win.querySelector('.os-window-close-big').addEventListener('click', e => { e.stopPropagation(); this.closeApp(id); });
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

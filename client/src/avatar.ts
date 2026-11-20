/**
 * HANDSPEAK — the signing robot ("the voice & the hands").
 *
 * Fully procedural Three.js robot: torso, head with an expressive face screen,
 * two arms, and hands with articulated fingers (3 joints × 4 fingers + thumb).
 * Signs are played from the pose dictionary (poses.ts) and word-sign tracks
 * (signs.ts) with exponential-smoothing coarticulation between poses.
 *
 * No external 3D assets — every mesh is built in code, so the repo is
 * self-contained and the robot is fully controllable.
 */
import * as THREE from 'three';
import { ALPHABET, REST, ILY, type HandPose } from './poses';
import { WORD_SIGNS, type WordKeyframe } from './signs';

const BODY = new THREE.MeshStandardMaterial({ color: 0x334152, roughness: 0.38, metalness: 0.55 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x18212e, roughness: 0.6, metalness: 0.3 });
const GLOW = new THREE.MeshStandardMaterial({ color: 0x35e0ff, emissive: 0x35e0ff, emissiveIntensity: 1.1, roughness: 0.3 });
const GLOW_SOFT = new THREE.MeshStandardMaterial({ color: 0x1f6f80, emissive: 0x35e0ff, emissiveIntensity: 0.35, roughness: 0.4 });

const FINGER_X = [-0.18, -0.06, 0.06, 0.18];
const FINGER_LEN: [number, number, number][] = [
  [0.24, 0.17, 0.13], [0.27, 0.18, 0.13], [0.24, 0.16, 0.12], [0.18, 0.12, 0.1],
];
const SPREAD_DIR = [1, 0.35, -0.35, -1];

export interface HandRig {
  group: THREE.Group;
  apply: (p: HandPose) => void;
}

/** Build one articulated hand. Palm faces +Z, fingers point +Y, thumb at -X. */
export function createHand(): HandRig {
  const group = new THREE.Group(); // wrist frame — wrist rotations applied here
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.14), BODY);
  palm.position.y = 0.22;
  group.add(palm);

  const fingerJoints: THREE.Group[][] = [];
  for (let f = 0; f < 4; f++) {
    const chain: THREE.Group[] = [];
    let parent: THREE.Group = group;
    let y = 0.5;
    for (let j = 0; j < 3; j++) {
      const joint = new THREE.Group();
      joint.position.set(j === 0 ? FINGER_X[f] : 0, j === 0 ? y : FINGER_LEN[f][j - 1], 0);
      const len = FINGER_LEN[f][j];
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.1, len, 0.1), j === 2 ? DARK : BODY);
      seg.position.y = len / 2;
      joint.add(seg);
      if (j === 2) {
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), GLOW);
        tip.position.y = len;
        joint.add(tip);
      }
      parent.add(joint);
      parent = joint;
      chain.push(joint);
      y = 0;
    }
    fingerJoints.push(chain);
  }

  // thumb: CMC → MCP → IP, on the -X side (right hand, palm to viewer)
  const cmc = new THREE.Group();
  cmc.position.set(-0.27, 0.02, 0.03);
  const thumbLens = [0.26, 0.2];
  const thumbJoints: THREE.Group[] = [cmc];
  let tParent: THREE.Group = cmc;
  for (let j = 0; j < 2; j++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.11, thumbLens[j], 0.11), BODY);
    seg.position.y = thumbLens[j] / 2;
    tParent.add(seg);
    if (j === 0) {
      const next = new THREE.Group();
      next.position.y = thumbLens[0];
      tParent.add(next);
      tParent = next;
      thumbJoints.push(next);
    } else {
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), GLOW);
      tip.position.y = thumbLens[1];
      tParent.add(tip);
    }
  }
  group.add(cmc);

  const apply = (p: HandPose) => {
    group.rotation.set(p.wrist.pitch, p.wrist.yaw, p.wrist.roll);
    for (let f = 0; f < 4; f++) {
      const fp = p.fingers[f];
      const [mcp, pip, dip] = fingerJoints[f];
      mcp.rotation.x = fp.curl[0];
      mcp.rotation.z = (fp.spread ?? 0) * SPREAD_DIR[f] + (fp.cross ?? 0);
      pip.rotation.x = fp.curl[1];
      dip.rotation.x = fp.curl[2];
    }
    const t = p.thumb;
    cmc.rotation.z = 0.55 + t.out * 0.85 - t.across * 1.15;
    cmc.rotation.x = 0.15 + t.across * 0.5;
    cmc.rotation.y = -t.across * 0.35;
    thumbJoints[1].rotation.x = t.curl * 1.1;
  };
  apply(REST);
  return { group, apply };
}

// ---------- pose interpolation ----------
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
export function lerpPose(a: HandPose, b: HandPose, t: number): HandPose {
  return {
    wrist: { pitch: lerp(a.wrist.pitch, b.wrist.pitch, t), yaw: lerp(a.wrist.yaw, b.wrist.yaw, t), roll: lerp(a.wrist.roll, b.wrist.roll, t) },
    fingers: a.fingers.map((f, i) => ({
      curl: [lerp(f.curl[0], b.fingers[i].curl[0], t), lerp(f.curl[1], b.fingers[i].curl[1], t), lerp(f.curl[2], b.fingers[i].curl[2], t)] as [number, number, number],
      spread: lerp(f.spread ?? 0, b.fingers[i].spread ?? 0, t),
      cross: lerp(f.cross ?? 0, b.fingers[i].cross ?? 0, t),
    })) as HandPose['fingers'],
    thumb: { curl: lerp(a.thumb.curl, b.thumb.curl, t), across: lerp(a.thumb.across, b.thumb.across, t), out: lerp(a.thumb.out, b.thumb.out, t) },
  };
}

interface Step { pose: HandPose; pos: [number, number, number]; hold: number }

export interface AvatarEvents {
  onLetter?: (letter: string) => void;
  onWord?: (word: string) => void;
  onDone?: () => void;
}

export class Avatar {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private rightHand: HandRig;
  private leftHand: HandRig;
  private rightWristFrame = new THREE.Group(); // signing-space anchor
  private head: THREE.Mesh;
  private faceCtx: CanvasRenderingContext2D;
  private faceTex: THREE.CanvasTexture;
  private torso: THREE.Group;

  private cur: HandPose = REST;
  private target: HandPose = REST;
  private curPos = new THREE.Vector3();
  private targetPos = new THREE.Vector3();
  private queue: Step[] = [];
  private stepTimer = 0;
  private playing = false;
  private events: AvatarEvents = {};
  private faceLetter = '';
  private blinkT = 0;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.fog = new THREE.Fog(0x070d17, 6.5, 12);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    this.camera.position.set(0.3, 1.5, 3.7);
    this.camera.lookAt(0.05, 1.18, 0);

    this.scene.add(new THREE.AmbientLight(0x8899bb, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(2.5, 4, 3.5);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x35e0ff, 14, 12);
    rim.position.set(-3, 2.2, -1.5);
    this.scene.add(rim);
    const warm = new THREE.PointLight(0xff9a5c, 6, 10);
    warm.position.set(2.8, 0.6, 1.8);
    this.scene.add(warm);
    const amberRim = new THREE.DirectionalLight(0xffb454, 1.0);
    amberRim.position.set(-2.2, 2.6, -3);
    this.scene.add(amberRim);

    const grid = new THREE.GridHelper(14, 28, 0x1d3a4a, 0x12202c);
    grid.position.y = 0;
    this.scene.add(grid);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshStandardMaterial({ color: 0x0a1120, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    this.scene.add(floor);
    // lit dais — the interpreter stands on a broadcast pedestal
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, 0.16, 48), new THREE.MeshStandardMaterial({ color: 0x182a44, roughness: 0.5, metalness: 0.4 }));
    dais.position.y = 0.08;
    this.scene.add(dais);
    const daisTop = new THREE.Mesh(new THREE.CircleGeometry(1.05, 48), new THREE.MeshStandardMaterial({ color: 0x1d3350, roughness: 0.45, metalness: 0.4 }));
    daisTop.rotation.x = -Math.PI / 2;
    daisTop.position.y = 0.161;
    this.scene.add(daisTop);
    const daisRim = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.022, 10, 64), new THREE.MeshStandardMaterial({ color: 0xffb454, emissive: 0xffb454, emissiveIntensity: 1.25 }));
    daisRim.rotation.x = Math.PI / 2;
    daisRim.position.y = 0.165;
    this.scene.add(daisRim);
    // soft light pool under the dais
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 256;
    const gc = glowCanvas.getContext('2d')!;
    const grad = gc.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,180,84,0.30)');
    grad.addColorStop(0.55, 'rgba(255,180,84,0.10)');
    grad.addColorStop(1, 'rgba(255,180,84,0)');
    gc.fillStyle = grad;
    gc.fillRect(0, 0, 256, 256);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowCanvas), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.02;
    this.scene.add(pool);

    // ----- robot body -----
    this.torso = new THREE.Group();
    this.scene.add(this.torso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.25, 0.62), BODY);
    chest.position.y = 1.0;
    this.torso.add(chest);
    const chestStrip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.02), GLOW);
    chestStrip.position.set(0, 1.28, 0.32);
    this.torso.add(chestStrip);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 24), GLOW_SOFT);
    core.rotation.x = Math.PI / 2;
    core.position.set(0, 0.95, 0.32);
    this.torso.add(core);
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.5), DARK);
    hips.position.y = 0.28;
    this.torso.add(hips);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.3, 16), DARK);
    neck.position.y = 1.74;
    this.torso.add(neck);

    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.66, 0.7), BODY);
    this.head.position.y = 2.04;
    this.torso.add(this.head);
    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = 256; faceCanvas.height = 200;
    this.faceCtx = faceCanvas.getContext('2d')!;
    this.faceTex = new THREE.CanvasTexture(faceCanvas);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.52), new THREE.MeshBasicMaterial({ map: this.faceTex }));
    face.position.set(0, 2.04, 0.356);
    this.torso.add(face);
    const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), GLOW_SOFT);
    earL.rotation.z = Math.PI / 2;
    earL.position.set(-0.45, 2.04, 0);
    this.torso.add(earL);
    const earR = earL.clone(); earR.position.x = 0.45; this.torso.add(earR);

    // ----- arms -----
    const mkArm = (side: 1 | -1, shoulderRot: [number, number, number], elbowRot: number) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.78 * side, 1.5, 0);
      shoulder.rotation.set(...shoulderRot);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), DARK);
      shoulder.add(ball);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), BODY);
      upper.position.y = -0.3;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.58;
      elbow.rotation.x = elbowRot;
      shoulder.add(elbow);
      const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), GLOW_SOFT);
      elbow.add(elbowBall);
      const fore = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.13), BODY);
      fore.position.y = -0.27;
      elbow.add(fore);
      const wristFrame = new THREE.Group();
      wristFrame.position.y = -0.55;
      const wristBall = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), GLOW_SOFT);
      wristFrame.add(wristBall);
      elbow.add(wristFrame);
      this.torso.add(shoulder);
      return wristFrame;
    };
    // right arm raised into signing space (in front of chest/face)
    const rightWrist = mkArm(1, [-1.05, 0, -0.35], -1.15);
    // left arm relaxed
    const leftWrist = mkArm(-1, [0.12, 0, 0.18], -0.25);

    this.rightHand = createHand();
    this.rightHand.group.rotation.x = Math.PI; // hand fingers point up out of the wrist frame
    this.rightWristFrame.add(this.rightHand.group);
    rightWrist.add(this.rightWristFrame);
    this.leftHand = createHand();
    this.leftHand.group.rotation.x = Math.PI;
    this.leftHand.group.scale.x = -1; // mirror for left hand
    leftWrist.add(this.leftHand.group);
    this.leftHand.apply(REST);

    this.resize();
    this.drawFace();
    this.loop();
  }

  setEvents(e: AvatarEvents) { this.events = e; }

  resize() {
    const w = this.canvas.clientWidth || 300;
    const h = this.canvas.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private drawFace() {
    const c = this.faceCtx;
    c.fillStyle = '#0b1118';
    c.fillRect(0, 0, 256, 200);
    const blink = this.blinkT > 0 ? Math.max(0.12, 1 - this.blinkT * 8) : 1;
    c.fillStyle = '#35e0ff';
    const eh = 22 * blink;
    c.beginPath(); c.roundRect(58, 62 - eh / 2, 40, eh, 8); c.fill();
    c.beginPath(); c.roundRect(158, 62 - eh / 2, 40, eh, 8); c.fill();
    if (this.faceLetter) {
      c.font = 'bold 84px Consolas, monospace';
      c.textAlign = 'center';
      c.fillText(this.faceLetter, 128, 172);
    } else {
      c.fillStyle = '#1f6f80';
      c.beginPath(); c.roundRect(104, 138, 48, 8, 4); c.fill();
    }
    this.faceTex.needsUpdate = true;
  }

  /** Queue a letter sequence (fingerspelling). */
  signLetters(letters: string[], onLetter?: (l: string) => void) {
    for (const raw of letters) {
      const l = raw.toUpperCase();
      const pose = ALPHABET[l];
      if (!pose) continue;
      if (l === 'J') {
        this.queue.push(
          { pose, pos: [0, 0.1, 0], hold: 160 },
          { pose, pos: [0, -0.22, 0.05], hold: 130 },
          { pose, pos: [-0.16, -0.3, 0.05], hold: 130 },
          { pose, pos: [-0.22, -0.12, 0.05], hold: 160 },
        );
      } else if (l === 'Z') {
        this.queue.push(
          { pose, pos: [-0.18, 0.12, 0.05], hold: 140 },
          { pose, pos: [0.18, 0.12, 0.05], hold: 140 },
          { pose, pos: [-0.18, -0.2, 0.05], hold: 150 },
          { pose, pos: [0.18, -0.2, 0.05], hold: 160 },
        );
      } else {
        this.queue.push({ pose, pos: [0, 0, 0], hold: 330 });
      }
      if (onLetter) {
        const idx = this.queue.length - 1;
        const orig = this.queue[idx];
        this.queue[idx] = { ...orig, hold: orig.hold };
        // letter callback fired when step starts (handled in tick via marker)
        (this.queue[idx] as Step & { letter?: string }).letter = l;
      }
    }
    this.queue.push({ pose: REST, pos: [0, 0, 0], hold: 260 });
    this.playing = true;
    this.stepTimer = 0;
  }

  /** Play a whole-word sign if known; returns false if not in dictionary. */
  playWord(word: string): boolean {
    const track = WORD_SIGNS[word.toUpperCase()];
    if (!track) return false;
    for (const kf of track) {
      this.queue.push({ pose: kf.pose, pos: kf.pos, hold: kf.hold });
    }
    this.queue.push({ pose: REST, pos: [0, 0, 0], hold: 260 });
    this.playing = true;
    this.stepTimer = 0;
    return true;
  }

  /** Sign any text: known words as whole signs, everything else fingerspelled. */
  signText(text: string, ev: AvatarEvents = {}) {
    this.events = ev;
    this.queue = [];
    const words = text.toUpperCase().replace(/[^A-Z \-]/g, '').split(/\s+/).filter(Boolean);
    for (const w of words) {
      if (WORD_SIGNS[w]) {
        const track = WORD_SIGNS[w];
        const first = this.queue.length;
        for (const kf of track) this.queue.push({ pose: kf.pose, pos: kf.pos, hold: kf.hold });
        (this.queue[first] as Step & { word?: string }).word = w;
      } else {
        const first = this.queue.length;
        this.signLetters(w.split(''));
        this.queue.pop(); // remove trailing REST between words
        (this.queue[first] as Step & { word?: string }).word = w;
      }
      this.queue.push({ pose: REST, pos: [0, 0, 0], hold: 420 });
    }
    this.playing = true;
    this.stepTimer = 0;
  }

  get busy() { return this.playing || this.queue.length > 0; }

  stop() { this.queue = []; this.playing = false; this.target = REST; this.targetPos.set(0, 0, 0); this.faceLetter = ''; }

  private tick(dt: number) {
    // advance sequence
    if (this.playing) {
      this.stepTimer += dt * 1000;
      const step = this.queue[0] as (Step & { letter?: string; word?: string }) | undefined;
      if (step && this.stepTimer >= step.hold) {
        this.queue.shift();
        this.stepTimer = 0;
        const next = this.queue[0] as (Step & { letter?: string; word?: string }) | undefined;
        if (next) {
          this.target = next.pose;
          this.targetPos.set(...next.pos);
          if (next.letter) { this.faceLetter = next.letter; this.events.onLetter?.(next.letter); }
          if (next.word) { this.faceLetter = ''; this.events.onWord?.(next.word); }
        } else {
          this.playing = false;
          this.target = REST;
          this.targetPos.set(0, 0, 0);
          this.faceLetter = '';
          this.events.onDone?.();
        }
      } else if (step && this.stepTimer < dt * 1000 + 1) {
        this.target = step.pose;
        this.targetPos.set(...step.pos);
        if (step.letter) { this.faceLetter = step.letter; this.events.onLetter?.(step.letter); }
        if (step.word) { this.faceLetter = ''; this.events.onWord?.(step.word); }
      }
    }
    // coarticulation: exponential smoothing toward target
    const k = 1 - Math.exp(-dt / 0.075);
    this.cur = lerpPose(this.cur, this.target, k);
    this.curPos.lerp(this.targetPos, k);
    this.rightHand.apply(this.cur);
    this.rightWristFrame.position.copy(this.curPos);

    // idle life
    const t = this.clock.elapsedTime;
    this.torso.position.y = 0.05 + Math.sin(t * 1.4) * 0.02;
    this.torso.rotation.y = Math.sin(t * 0.5) * 0.03;
    this.head.rotation.z = Math.sin(t * 0.9) * 0.02;
    this.blinkT -= dt;
    if (this.blinkT < -3.2) this.blinkT = 0.14;
    this.drawFace();
  }

  private loop = () => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.tick(dt);
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  dispose() { this.disposed = true; cancelAnimationFrame(this.raf); this.renderer.dispose(); }
}

export { ILY };

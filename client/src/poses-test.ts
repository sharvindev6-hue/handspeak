/** Contact sheet: render all 26 alphabet poses in one grid for visual QA. */
import * as THREE from 'three';
import { createHand } from './avatar';
import { ALPHABET, LETTERS } from './poses';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const COLS = 13, SX = 1.35, SY = 1.75;
const W = COLS * SX, H = 2 * SY;
canvas.width = 1560; canvas.height = Math.round(1560 * H / W);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(canvas.width, canvas.height, false);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e14);
const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 50);
cam.position.set(0, 0, 10);
cam.lookAt(0, 0, 0);
scene.add(new THREE.AmbientLight(0xaabbcc, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(2, 3, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0x35e0ff, 0.7);
rim.position.set(-3, -1, 4);
scene.add(rim);

const labels = document.getElementById('labels')!;
LETTERS.forEach((l, i) => {
  const col = i % COLS, row = Math.floor(i / COLS);
  const hand = createHand();
  hand.apply(ALPHABET[l]);
  hand.group.position.set(col * SX - W / 2 + SX / 2, H / 2 - row * SY - SY / 2 + 0.15, 0);
  scene.add(hand.group);
  const div = document.createElement('div');
  div.textContent = l;
  div.style.gridColumn = String(col + 1);
  div.style.gridRow = String(row + 1);
  labels.appendChild(div);
});
renderer.render(scene, cam);

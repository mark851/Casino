import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type CameraPresetKey = 'default' | 'overhead' | 'dramatic';

export interface StudioRigOptions {
  backgroundHex: number;
  fogHex: number;
  fogDensity: number;
  fov: number;
  minAspect: number;
  shadowBounds: number;
  initialCamera: [number, number, number];
  initialTarget: [number, number, number];
  minDistance: number;
  maxDistance: number;
  roomTheme: 'chess' | 'drafts' | 'ludo' | 'matatu';
  antiGlareBoard?: boolean;
}

export interface StudioRig {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  isSoftwareGl: boolean;
  trackGeometry: <T extends THREE.BufferGeometry>(g: T) => T;
  trackMaterial: <T extends THREE.Material>(m: T) => T;
  trackTexture: <T extends THREE.Texture>(t: T) => T;
  dispose: () => void;
}

export function fitCameraFovForAspect(
  camera: THREE.PerspectiveCamera,
  baseFov: number,
  width: number,
  height: number,
  minAspect: number
): void {
  const aspect = Math.max(0.5, width / Math.max(1, height));
  camera.aspect = aspect;
  if (aspect < minAspect) {
    const scale = minAspect / aspect;
    camera.fov = Math.min(72, baseFov * Math.pow(scale, 0.55));
  } else {
    camera.fov = baseFov;
  }
  camera.updateProjectionMatrix();
}

export function scheduleSoftwareGlFrame(
  _renderer: THREE.WebGLRenderer,
  done: () => void,
  onTimerId: (id: number) => void
): void {
  const tid = window.setTimeout(done, 32);
  onTimerId(tid);
}

export function createStudioRig(container: HTMLElement, opts: StudioRigOptions): StudioRig {
  const width = Math.max(320, container.clientWidth);
  const height = Math.max(260, container.clientHeight);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.antiGlareBoard ? 0.96 : 1.08;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const gl = renderer.getContext();
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const rendererStr = debugInfo
    ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '')
    : '';
  const isSoftwareGl = /swiftshader|llvmpipe|software/i.test(rendererStr);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.backgroundHex);
  scene.fog = new THREE.FogExp2(opts.fogHex, opts.fogDensity);

  const camera = new THREE.PerspectiveCamera(opts.fov, width / height, 0.1, 100);
  camera.position.set(...opts.initialCamera);
  fitCameraFovForAspect(camera, opts.fov, width, height, opts.minAspect);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...opts.initialTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = opts.minDistance;
  controls.maxDistance = opts.maxDistance;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minPolarAngle = 0.08;
  controls.update();

  // Studio Three-Point Lighting
  const hemi = new THREE.HemisphereLight(0xfff4d6, 0x061b10, opts.antiGlareBoard ? 0.9 : 0.72);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff5dc, opts.antiGlareBoard ? 1.35 : 1.75);
  keyLight.position.set(6, 13, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 32;
  const b = opts.shadowBounds;
  keyLight.shadow.camera.left = -b;
  keyLight.shadow.camera.right = b;
  keyLight.shadow.camera.top = b;
  keyLight.shadow.camera.bottom = -b;
  keyLight.shadow.bias = -0.0008;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x49c98a, 0.55);
  rimLight.position.set(-8, 7, -7);
  scene.add(rimLight);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeometry = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMaterial = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTexture = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  const dispose = () => {
    controls.dispose();
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    renderer.dispose();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
  };

  return {
    scene,
    camera,
    renderer,
    controls,
    isSoftwareGl,
    trackGeometry,
    trackMaterial,
    trackTexture,
    dispose,
  };
}

export function buildLuxuryRoomEnvironment(
  rig: StudioRig,
  opts: {
    theme: 'chess' | 'drafts' | 'ludo' | 'matatu';
    tableBottomY: number;
    floorY: number;
    pedestalScale?: number;
  }
) {
  const { scene, trackGeometry, trackMaterial } = rig;
  const scale = opts.pedestalScale ?? 1;

  const floorMat = trackMaterial(
    new THREE.MeshStandardMaterial({
      color: 0x050e09,
      roughness: 0.85,
      metalness: 0.1,
    })
  );
  const floor = new THREE.Mesh(trackGeometry(new THREE.CircleGeometry(28, 48)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = opts.floorY;
  floor.receiveShadow = true;
  scene.add(floor);

  const pedHeight = Math.max(0.2, opts.tableBottomY - opts.floorY);
  const pedMat = trackMaterial(
    new THREE.MeshStandardMaterial({
      color: 0x1e0e06,
      roughness: 0.45,
      metalness: 0.2,
    })
  );
  const pedestal = new THREE.Mesh(
    trackGeometry(new THREE.CylinderGeometry(1.4 * scale, 2.2 * scale, pedHeight, 32)),
    pedMat
  );
  pedestal.position.y = opts.floorY + pedHeight / 2;
  pedestal.receiveShadow = true;
  scene.add(pedestal);

  const ringMat = trackMaterial(
    new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.3,
      metalness: 0.85,
    })
  );
  const baseRing = new THREE.Mesh(
    trackGeometry(new THREE.TorusGeometry(2.22 * scale, 0.05, 12, 48)),
    ringMat
  );
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = opts.floorY + 0.04;
  scene.add(baseRing);

  return {
    updateBackgroundGameplay: (_elapsed: number, _dt: number) => {
      // Subtle ambient floor stability without distracting motion
    },
  };
}

export function createMahoganyTexture(
  maxAnisotropy: number,
  lightHex = '#4a2210',
  darkHex = '#1f0b04'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, lightHex);
  grad.addColorStop(0.5, darkHex);
  grad.addColorStop(1, lightHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < 512; y += 6) {
    ctx.lineWidth = 1 + (y % 3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + ((y % 7) - 3), 340, y - ((y % 5) - 2), 512, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

export function createMarbleStoneTexture(
  maxAnisotropy: number,
  baseHex = '#ebe1ca',
  veinHex = '#a79572',
  highlightHex = '#f7f1e2'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, baseHex);
  grad.addColorStop(0.5, highlightHex);
  grad.addColorStop(1, baseHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = veinHex;
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 14; i += 1) {
    ctx.lineWidth = 1 + (i % 3);
    ctx.beginPath();
    ctx.moveTo((i * 41) % 512, 0);
    ctx.bezierCurveTo(120 + i * 17, 170, 360 - i * 11, 340, (i * 79) % 512, 512);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

export function createFeltTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 360);
  grad.addColorStop(0, '#0f6a3c');
  grad.addColorStop(0.6, '#084726');
  grad.addColorStop(1, '#042a16');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  for (let i = 0; i < 1800; i += 1) {
    const x = (i * 73) % 512;
    const y = (i * 137) % 512;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

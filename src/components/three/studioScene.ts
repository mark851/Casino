import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
  toneMappingExposure?: number;
  hemiIntensity?: number;
  keyIntensity?: number;
  rimIntensity?: number;
  environmentIntensity?: number;
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

function detectSoftwareGl(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
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
  renderer: THREE.WebGLRenderer,
  done: () => void,
  onTimerId: (id: number) => void
): void {
  try {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          onTimerId(window.setTimeout(poll, 6));
        } else {
          if (sync) gl.deleteSync(sync);
          onTimerId(window.setTimeout(done, 80));
        }
      };
      onTimerId(window.setTimeout(poll, 6));
      return;
    }
  } catch {
    // Fallback below
  }
  onTimerId(window.setTimeout(done, 80));
}

export function createStudioRig(container: HTMLElement, opts: StudioRigOptions): StudioRig {
  const width = Math.max(320, container.clientWidth);
  const height = Math.max(260, container.clientHeight);
  const isSoftwareGl = detectSoftwareGl();

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = opts.antiGlareBoard ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.toneMappingExposure ?? (opts.antiGlareBoard ? 0.96 : 1.1);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.backgroundHex);
  if (opts.fogDensity > 0) {
    scene.fog = new THREE.FogExp2(opts.fogHex, opts.fogDensity);
  }

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envRenderTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRenderTarget.texture;
  scene.environmentIntensity = opts.environmentIntensity ?? (opts.antiGlareBoard ? 0.15 : 1);
  pmremGenerator.dispose();

  const camera = new THREE.PerspectiveCamera(opts.fov, width / height, 0.1, 100);
  camera.position.set(...opts.initialCamera);
  fitCameraFovForAspect(camera, opts.fov, width, height, opts.minAspect);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...opts.initialTarget);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.08;
  controls.minDistance = opts.minDistance;
  controls.maxDistance = opts.maxDistance;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minPolarAngle = 0.08;
  controls.update();

  // Studio Three-Point Lighting
  const hemiGround = opts.roomTheme === 'matatu' ? 0xc28340 : 0x082616;
  const hemi = new THREE.HemisphereLight(
    0xfffaf0,
    hemiGround,
    opts.hemiIntensity ?? (opts.antiGlareBoard ? 0.88 : 0.78)
  );
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(
    0xfffaf0,
    opts.keyIntensity ?? (opts.antiGlareBoard ? 0.65 : 1.8)
  );
  keyLight.position.set(2.5, 14, 3.5);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.set(isSoftwareGl ? 1024 : 2048, isSoftwareGl ? 1024 : 2048);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 32;
  const b = opts.shadowBounds;
  keyLight.shadow.camera.left = -b;
  keyLight.shadow.camera.right = b;
  keyLight.shadow.camera.top = b;
  keyLight.shadow.camera.bottom = -b;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const rimColor = opts.roomTheme === 'matatu' ? 0xfff5e4 : 0x6ae6a8;
  const rimLight = new THREE.DirectionalLight(rimColor, opts.rimIntensity ?? 0.6);
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
    envRenderTarget.dispose();
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
      roughness: 0.25,
      metalness: 0.9,
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
      // Stable luxury arena lighting
    },
  };
}

export function createMahoganyTexture(
  maxAnisotropy: number,
  lightHex = '#4a2210',
  darkHex = '#1f0b04'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
  grad.addColorStop(0, lightHex);
  grad.addColorStop(0.5, darkHex);
  grad.addColorStop(1, lightHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = 'rgba(0,0,0,0.24)';
  for (let y = 0; y < 1024; y += 8) {
    ctx.lineWidth = 1.5 + (y % 3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(340, y + ((y % 13) - 6), 680, y - ((y % 11) - 5), 1024, y);
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
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(512, 512, 32, 512, 512, 720);
  grad.addColorStop(0, '#127a46');
  grad.addColorStop(0.6, '#084b29');
  grad.addColorStop(1, '#042a16');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Crisp woven baize micro-grain
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let i = 0; i < 5200; i += 1) {
    const x = (i * 73) % 1024;
    const y = (i * 137) % 1024;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.035)';
  for (let i = 0; i < 3600; i += 1) {
    const x = (i * 109 + 17) % 1024;
    const y = (i * 193 + 29) % 1024;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

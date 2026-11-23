import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getTokenBoardCoord } from '../../shared/ludoEngine';
import {
  buildLuxuryRoomEnvironment,
  createMahoganyTexture,
  createStudioRig,
  fitCameraFovForAspect,
  scheduleSoftwareGlFrame,
  type CameraPresetKey,
} from './studioScene';
import { FullscreenToggleButton } from '../FullscreenToggleButton';
import { COLOR_BADGE_URLS } from '../ClubBadges';
import proBgLudo from '../../assets/images/pro_bg_ludo_1794922550828.jpg';
import type { LudoColor, SanitizedLudoState } from '../../shared/types';

interface ThreeLudoBoardProps {
  ludoState: SanitizedLudoState;
  viewerColor: LudoColor;
  canRoll: boolean;
  canMove: boolean;
  isRolling: boolean;
  displayedDiceValue: number | null;
  onRoll: () => void;
  onMoveToken: (tokenIndex: number) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const BOARD_SPAN = 9.0;
const CELL_SIZE = BOARD_SPAN / 15;
const _vCamPos = new THREE.Vector3();
const _vTarget = new THREE.Vector3();

function gridToWorld(row: number, col: number): [number, number] {
  const x = (col - 7) * CELL_SIZE;
  const z = (row - 7) * CELL_SIZE;
  return [x, z];
}

const COLOR_HEX: Record<LudoColor, number> = {
  green: 0x0c8f2b,
  yellow: 0xd49b0a,
  red: 0xc91a1a,
  blue: 0x066da8,
};

const CLUB_NAME: Record<LudoColor, string> = {
  green: 'LIVERPOOL',
  yellow: 'ARSENAL',
  red: 'MAN UTD',
  blue: 'CHELSEA',
};

function drawStarIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  fill: string,
  stroke: string
) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawDirectionArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angleRad: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angleRad);
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.65, -size * 0.65);
  ctx.lineTo(-size * 0.35, 0);
  ctx.lineTo(-size * 0.65, size * 0.65);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function createLudoBoardTexture(
  maxAnisotropy: number,
  onBadgesLoaded?: () => void
): THREE.CanvasTexture {
  const S = 2048;
  const cell = S / 15;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  // Matte parchment-stone base (eliminates white glare & maximizes grid readability)
  ctx.fillStyle = '#bcb3a0';
  ctx.fillRect(0, 0, S, S);

  // Safe star cells from ludoEngine SAFE_RING_INDICES (indices 8, 21, 34, 47)
  const isStarTile = (r: number, c: number) =>
    (r === 2 && c === 6) ||
    (r === 6 && c === 12) ||
    (r === 12 && c === 8) ||
    (r === 8 && c === 2);

  // Draw 15x15 track grid cells with razor-sharp dark borders
  ctx.strokeStyle = '#0a0f18';
  ctx.lineWidth = 7;
  for (let r = 0; r < 15; r += 1) {
    for (let c = 0; c < 15; c += 1) {
      const inYard = (r < 6 || r > 8) && (c < 6 || c > 8);
      const inCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8;
      if (inYard || inCenter) continue;

      let fill = '#cbc3b2';
      // Colored start entry tiles
      if (r === 6 && c === 1) fill = '#0f6b2d';
      else if (r === 1 && c === 8) fill = '#a87605';
      else if (r === 13 && c === 6) fill = '#9c1414';
      else if (r === 8 && c === 13) fill = '#054f7a';
      // Colored Home Stretch Lanes
      else if (r === 7 && c >= 1 && c <= 5) fill = '#137d36';
      else if (c === 7 && r >= 1 && r <= 5) fill = '#c48e0a';
      else if (c === 7 && r >= 9 && r <= 13) fill = '#bf2121';
      else if (r === 7 && c >= 9 && c <= 13) fill = '#0869a1';
      else if (isStarTile(r, c)) fill = '#b3a483';

      const x0 = c * cell;
      const y0 = r * cell;
      ctx.fillStyle = fill;
      ctx.fillRect(x0, y0, cell, cell);
      ctx.strokeRect(x0, y0, cell, cell);

      const tcx = x0 + cell / 2;
      const tcy = y0 + cell / 2;

      if (isStarTile(r, c)) {
        drawStarIcon(ctx, tcx, tcy, cell * 0.35, cell * 0.16, '#c9981a', '#4a3204');
      } else if (r === 6 && c === 1) {
        drawDirectionArrow(ctx, tcx, tcy, 0, cell * 0.28, '#e8e4d8');
      } else if (r === 1 && c === 8) {
        drawDirectionArrow(ctx, tcx, tcy, Math.PI / 2, cell * 0.28, '#111827');
      } else if (r === 8 && c === 13) {
        drawDirectionArrow(ctx, tcx, tcy, Math.PI, cell * 0.28, '#e8e4d8');
      } else if (r === 13 && c === 6) {
        drawDirectionArrow(ctx, tcx, tcy, -Math.PI / 2, cell * 0.28, '#e8e4d8');
      } else if (r === 7 && c === 0) {
        drawDirectionArrow(ctx, tcx, tcy, 0, cell * 0.25, '#0f6b2d');
      } else if (r === 0 && c === 7) {
        drawDirectionArrow(ctx, tcx, tcy, Math.PI / 2, cell * 0.25, '#9c6e04');
      } else if (r === 7 && c === 14) {
        drawDirectionArrow(ctx, tcx, tcy, Math.PI, cell * 0.25, '#054f7a');
      } else if (r === 14 && c === 7) {
        drawDirectionArrow(ctx, tcx, tcy, -Math.PI / 2, cell * 0.25, '#9c1414');
      }
    }
  }

  const drawBadgeImage = (
    img: HTMLImageElement,
    cx: number,
    cy: number,
    boxSize: number
  ) => {
    const nw = img.naturalWidth || 100;
    const nh = img.naturalHeight || 100;
    const scale = Math.min(boxSize / nw, boxSize / nh);
    const dw = nw * scale;
    const dh = nh * scale;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  };

  // Draw 4 Club Yards (6x6 blocks) with Official Club Badges in Banner & Central Yard Medallion
  const drawYard = (
    color: LudoColor,
    r0: number,
    c0: number,
    bg: string,
    border: string,
    clubLabel: string,
    tokens: Array<[number, number]>,
    badgeImg?: HTMLImageElement | null
  ) => {
    const x = c0 * cell;
    const y = r0 * cell;
    const w = 6 * cell;

    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, w);
    ctx.strokeStyle = '#0a0f18';
    ctx.lineWidth = 9;
    ctx.strokeRect(x, y, w, w);

    // Inner glare-free stone-ivory yard card
    const pad = cell * 0.72;
    ctx.fillStyle = '#d0c8b7';
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, w - pad * 2, w - pad * 2, 36);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 8;
    ctx.stroke();

    // Large subtle official club crest watermark across the yard card
    if (badgeImg) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      drawBadgeImage(badgeImg, x + w / 2, y + w / 2, cell * 3.6);
      ctx.restore();
    }

    // Club name banner plate with enlarged official Club Badge
    const bannerX = x + w * 0.1;
    const bannerY = y + pad * 0.08;
    const bannerW = w * 0.8;
    const bannerH = pad * 0.82;
    ctx.fillStyle = '#0a100c';
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 16);
    ctx.fill();
    ctx.strokeStyle = '#c99e28';
    ctx.lineWidth = 4;
    ctx.stroke();

    const miniR = bannerH * 0.44;
    const miniCx = bannerX + miniR + 10;
    const miniCy = bannerY + bannerH / 2;
    ctx.beginPath();
    ctx.arc(miniCx, miniCy, miniR, 0, Math.PI * 2);
    ctx.fillStyle = '#e2dccf';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#c99e28';
    ctx.stroke();

    if (badgeImg) {
      drawBadgeImage(badgeImg, miniCx, miniCy, miniR * 1.85);
    }

    ctx.fillStyle = '#ebd070';
    ctx.font = 'bold 35px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clubLabel, bannerX + miniR * 0.85 + bannerW / 2, bannerY + bannerH / 2);

    // 4 Token seats aligned cleanly to grid centers
    for (const [tr, tc] of tokens) {
      const cx = (tc + 0.5) * cell;
      const cy = (tr + 0.5) * cell;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.54, 0, Math.PI * 2);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#b88917';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#c4bcab';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#292524';
      ctx.stroke();
    }

    // Large Central Club Badge Medallion centered cleanly between the 4 pawns
    const medX = (c0 + 2.5) * cell;
    const medY = (r0 + 2.5) * cell;
    ctx.beginPath();
    ctx.arc(medX, medY, cell * 0.84, 0, Math.PI * 2);
    ctx.fillStyle = '#e3ddd0';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#b88917';
    ctx.stroke();

    if (badgeImg) {
      drawBadgeImage(badgeImg, medX, medY, cell * 1.54);
    }
  };

  const yardSpecs: Array<{
    color: LudoColor;
    r0: number;
    c0: number;
    bg: string;
    border: string;
    label: string;
    tokens: Array<[number, number]>;
  }> = [
    {
      color: 'green',
      r0: 0,
      c0: 0,
      bg: '#0d682b',
      border: '#053d18',
      label: CLUB_NAME.green,
      tokens: [
        [1, 1],
        [1, 3],
        [3, 1],
        [3, 3],
      ],
    },
    {
      color: 'yellow',
      r0: 0,
      c0: 9,
      bg: '#b88206',
      border: '#634202',
      label: CLUB_NAME.yellow,
      tokens: [
        [1, 10],
        [1, 12],
        [3, 10],
        [3, 12],
      ],
    },
    {
      color: 'red',
      r0: 9,
      c0: 0,
      bg: '#ad1818',
      border: '#690f0f',
      label: CLUB_NAME.red,
      tokens: [
        [10, 1],
        [10, 3],
        [12, 1],
        [12, 3],
      ],
    },
    {
      color: 'blue',
      r0: 9,
      c0: 9,
      bg: '#065887',
      border: '#063754',
      label: CLUB_NAME.blue,
      tokens: [
        [10, 10],
        [10, 12],
        [12, 10],
        [12, 12],
      ],
    },
  ];

  const renderAllYards = (loadedImgs?: Partial<Record<LudoColor, HTMLImageElement>>) => {
    for (const spec of yardSpecs) {
      drawYard(
        spec.color,
        spec.r0,
        spec.c0,
        spec.bg,
        spec.border,
        spec.label,
        spec.tokens,
        loadedImgs?.[spec.color] ?? null
      );
    }
  };

  renderAllYards();

  // Center 3x3 Home Crown Triangles
  const cx0 = 6 * cell;
  const cy0 = 6 * cell;
  const cw = 3 * cell;
  const mx = cx0 + cw / 2;
  const my = cy0 + cw / 2;

  const drawTri = (p1: [number, number], p2: [number, number], color: string) => {
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#0a0f18';
    ctx.lineWidth = 7;
    ctx.stroke();
  };

  drawTri([cx0, cy0], [cx0 + cw, cy0], '#c48e0a'); // Top Yellow
  drawTri([cx0 + cw, cy0], [cx0 + cw, cy0 + cw], '#0869a1'); // Right Blue
  drawTri([cx0 + cw, cy0 + cw], [cx0, cy0 + cw], '#bf2121'); // Bottom Red
  drawTri([cx0, cy0 + cw], [cx0, cy0], '#137d36'); // Left Green

  // Center Golden Crown Disk
  ctx.beginPath();
  ctx.arc(mx, my, cell * 0.56, 0, Math.PI * 2);
  ctx.fillStyle = '#061c11';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#d4af37';
  ctx.stroke();

  ctx.fillStyle = '#e8c252';
  ctx.font = 'bold 42px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HOME', mx, my);

  // Crisp outer perimeter border around the entire 15x15 board
  ctx.strokeStyle = '#0a0f18';
  ctx.lineWidth = 12;
  ctx.strokeRect(0, 0, S, S);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy || 1;

  // Load the official club SVG crests cleanly onto the 3D board texture
  const badgeImgs: Partial<Record<LudoColor, HTMLImageElement>> = {};
  (Object.entries(COLOR_BADGE_URLS) as Array<[LudoColor, string]>).forEach(([color, url]) => {
    const img = new Image();
    img.onload = () => {
      badgeImgs[color] = img;
      renderAllYards(badgeImgs);
      ctx.strokeStyle = '#0a0f18';
      ctx.lineWidth = 12;
      ctx.strokeRect(0, 0, S, S);
      tex.needsUpdate = true;
      onBadgesLoaded?.();
    };
    img.src = url;
  });

  return tex;
}

function buildLudoPawnGroup(
  color: LudoColor,
  isLegal: boolean,
  pawnMat: THREE.Material,
  goldMat: THREE.Material,
  ringMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T
): THREE.Group {
  const group = new THREE.Group();

  // Turned 3D conical pawn silhouette via LatheGeometry (32 radial segments)
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.21, 0),
    new THREE.Vector2(0.21, 0.06),
    new THREE.Vector2(0.15, 0.11),
    new THREE.Vector2(0.08, 0.34),
    new THREE.Vector2(0.125, 0.42),
    new THREE.Vector2(0.0, 0.46),
  ];
  const body = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(pts, 32)), pawnMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Spherical Pawn Finial Head
  const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.135, 24, 20)), pawnMat);
  head.position.y = 0.50;
  head.castShadow = true;
  group.add(head);

  // Gold Waist Collar Ring
  const collar = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.115, 0.015, 10, 28)), goldMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.38;
  group.add(collar);

  // Legal Move Ground Halo
  if (isLegal) {
    const halo = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.25, 0.028, 12, 32)), ringMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.03;
    group.add(halo);
  }

  group.userData = { color };
  return group;
}

function buildPhysicalDieGroup(
  ivoryMat: THREE.Material,
  pipMat: THREE.Material,
  goldMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T
): THREE.Group {
  const group = new THREE.Group();
  const s = 0.48;
  const half = s / 2;

  // Precision beveled RoundedBoxGeometry casino die
  const cube = new THREE.Mesh(trackGeo(new RoundedBoxGeometry(s, s, s, 4, 0.065)), ivoryMat);
  cube.castShadow = true;
  cube.receiveShadow = true;
  group.add(cube);

  const pipGeo = trackGeo(new THREE.SphereGeometry(0.042, 16, 12));
  const addPips = (
    normal: [number, number, number],
    uVec: [number, number, number],
    vVec: [number, number, number],
    coords: Array<[number, number]>,
    useGold = false
  ) => {
    for (const [u, v] of coords) {
      const pip = new THREE.Mesh(pipGeo, useGold ? goldMat : pipMat);
      const offset = 0.128;
      pip.position.set(
        normal[0] * half + uVec[0] * u * offset + vVec[0] * v * offset,
        normal[1] * half + uVec[1] * u * offset + vVec[1] * v * offset,
        normal[2] * half + uVec[2] * u * offset + vVec[2] * v * offset
      );
      group.add(pip);
    }
  };

  // Top (+Y) = 1 (gold royal pip)
  addPips([0, 1, 0], [1, 0, 0], [0, 0, 1], [[0, 0]], true);
  // Bottom (-Y) = 6
  addPips([0, -1, 0], [1, 0, 0], [0, 0, 1], [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ]);
  // Front (+Z) = 2
  addPips([0, 0, 1], [1, 0, 0], [0, 1, 0], [
    [-1, 1],
    [1, -1],
  ]);
  // Back (-Z) = 5
  addPips([0, 0, -1], [1, 0, 0], [0, 1, 0], [
    [-1, -1],
    [-1, 1],
    [0, 0],
    [1, -1],
    [1, 1],
  ]);
  // Right (+X) = 3
  addPips([1, 0, 0], [0, 0, 1], [0, 1, 0], [
    [-1, 1],
    [0, 0],
    [1, -1],
  ]);
  // Left (-X) = 4
  addPips([-1, 0, 0], [0, 0, 1], [0, 1, 0], [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]);

  return group;
}

const DIE_ROTATION_FOR_FACE: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
  5: [Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0],
};

export const ThreeLudoBoard: React.FC<ThreeLudoBoardProps> = ({
  ludoState,
  viewerColor,
  canRoll,
  canMove,
  isRolling,
  displayedDiceValue,
  onRoll,
  onMoveToken,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onRollRef = useRef(onRoll);
  onRollRef.current = onRoll;
  const onMoveTokenRef = useRef(onMoveToken);
  onMoveTokenRef.current = onMoveToken;

  const [cameraPreset, setCameraPreset] = useState<CameraPresetKey>('default');
  const [webglError, setWebglError] = useState(false);

  const sceneSyncRef = useRef<(() => void) | null>(null);
  const camTransitionRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: new THREE.Vector3(0, 10.2, 8.8),
    target: new THREE.Vector3(0, 0.1, 0),
  });

  const latestPropsRef = useRef({
    ludoState,
    viewerColor,
    canRoll,
    canMove,
    isRolling,
    displayedDiceValue,
  });
  latestPropsRef.current = {
    ludoState,
    viewerColor,
    canRoll,
    canMove,
    isRolling,
    displayedDiceValue,
  };

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    let rig: ReturnType<typeof createStudioRig>;
    try {
      rig = createStudioRig(el, {
        backgroundHex: 0x05110a,
        fogHex: 0x05110a,
        fogDensity: 0.004,
        fov: 42,
        minAspect: 1.12,
        shadowBounds: 8.5,
        initialCamera: [0, 10.2, 8.8],
        initialTarget: [0, 0.1, 0],
        minDistance: 5.5,
        maxDistance: 21,
        roomTheme: 'ludo',
        antiGlareBoard: true,
      });
    } catch {
      setWebglError(true);
      return;
    }

    const { scene, camera, renderer, controls, isSoftwareGl, trackGeometry, trackMaterial, trackTexture } = rig;
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    // Grounded 3D Studio Plinth & Contact Shadow
    const bgRoom = buildLuxuryRoomEnvironment(rig, {
      theme: 'ludo',
      tableBottomY: -0.42,
      floorY: -1.85,
      pedestalScale: 1.12,
    });

    let effectDisposed = false;
    const mahoganyTex = trackTexture(createMahoganyTexture(maxAniso, '#44200f', '#1d0b04'));
    const boardTex = trackTexture(
      createLudoBoardTexture(maxAniso, () => {
        if (!effectDisposed) requestRender();
      })
    );

    const cabinetMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        map: mahoganyTex,
        roughness: 0.28,
        metalness: 0.08,
        clearcoat: 0.55,
      })
    );
    // Crisp matte non-glare tournament board surface (no clearcoat/light reflection washout)
    const boardTopMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        map: boardTex,
        roughness: 1.0,
        metalness: 0,
        envMapIntensity: 0.04,
      })
    );
    const goldMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({ color: 0xc9a332, roughness: 0.32, metalness: 0.82, clearcoat: 0.2 })
    );
    const ringMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xffd76a,
        emissive: 0xaa7808,
        emissiveIntensity: 0.42,
        roughness: 0.34,
      })
    );
    const ivoryDieMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xd2cab8,
        roughness: 0.58,
        metalness: 0,
        envMapIntensity: 0.12,
      })
    );
    const pipMat = trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.5 })
    );

    const pawnMats: Record<LudoColor, THREE.Material> = {
      green: trackMaterial(
        new THREE.MeshPhysicalMaterial({
          color: COLOR_HEX.green,
          roughness: 0.44,
          clearcoat: 0.14,
          envMapIntensity: 0.18,
        })
      ),
      yellow: trackMaterial(
        new THREE.MeshPhysicalMaterial({
          color: COLOR_HEX.yellow,
          roughness: 0.44,
          clearcoat: 0.14,
          envMapIntensity: 0.18,
        })
      ),
      red: trackMaterial(
        new THREE.MeshPhysicalMaterial({
          color: COLOR_HEX.red,
          roughness: 0.44,
          clearcoat: 0.14,
          envMapIntensity: 0.18,
        })
      ),
      blue: trackMaterial(
        new THREE.MeshPhysicalMaterial({
          color: COLOR_HEX.blue,
          roughness: 0.44,
          clearcoat: 0.14,
          envMapIntensity: 0.18,
        })
      ),
    };

    const cabinet = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(9.8, 0.42, 9.8)), cabinetMat);
    cabinet.position.y = -0.21;
    cabinet.castShadow = true;
    cabinet.receiveShadow = true;
    scene.add(cabinet);

    const cornerBracketGeo = trackGeometry(new THREE.BoxGeometry(0.46, 0.44, 0.46));
    for (const [cx, cz] of [
      [-4.72, -4.72],
      [4.72, -4.72],
      [-4.72, 4.72],
      [4.72, 4.72],
    ]) {
      const bracket = new THREE.Mesh(cornerBracketGeo, goldMat);
      bracket.position.set(cx, -0.21, cz);
      bracket.castShadow = true;
      scene.add(bracket);
    }

    const brassTrim = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(9.18, 0.04, 9.18)), goldMat);
    brassTrim.position.y = 0.005;
    scene.add(brassTrim);

    const boardMesh = new THREE.Mesh(
      trackGeometry(new THREE.BoxGeometry(BOARD_SPAN, 0.04, BOARD_SPAN)),
      boardTopMat
    );
    boardMesh.position.y = 0.025;
    boardMesh.receiveShadow = true;
    scene.add(boardMesh);

    // Physical Brass-Rimmed Velvet 3D Dice Tray & Beveled Die perched inside center crown
    const diceTray = new THREE.Mesh(
      trackGeometry(new THREE.CylinderGeometry(0.44, 0.48, 0.06, 32)),
      trackMaterial(new THREE.MeshStandardMaterial({ color: 0x06341d, roughness: 0.82 }))
    );
    diceTray.position.set(0, 0.055, 0);
    diceTray.receiveShadow = true;
    scene.add(diceTray);

    const diceTrayRim = new THREE.Mesh(
      trackGeometry(new THREE.TorusGeometry(0.45, 0.026, 12, 32)),
      goldMat
    );
    diceTrayRim.rotation.x = Math.PI / 2;
    diceTrayRim.position.set(0, 0.085, 0);
    scene.add(diceTrayRim);

    const dieGroup = buildPhysicalDieGroup(ivoryDieMat, pipMat, goldMat, trackGeometry);
    dieGroup.position.set(0, 0.33, 0);
    dieGroup.traverse((c) => {
      c.userData = { isDie: true };
    });
    scene.add(dieGroup);

    const pawnsGroup = new THREE.Group();
    scene.add(pawnsGroup);

    const blockadeHaloGeo = trackGeometry(new THREE.TorusGeometry(0.28, 0.022, 10, 28));
    const legalPawnAnimTargets: THREE.Group[] = [];

    const syncLudo = () => {
      const { ludoState: ls, viewerColor: vColor, canMove: allowMove } = latestPropsRef.current;

      pawnsGroup.clear();
      legalPawnAnimTargets.length = 0;

      const cellGroups = new Map<
        string,
        Array<{ color: LudoColor; tokenIndex: number; row: number; col: number; progress: number }>
      >();
      for (const color of ls.activeColors) {
        const tokens = ls.tokensByColor[color] || [];
        tokens.forEach((prog, idx) => {
          const coord = getTokenBoardCoord(color, idx, prog);
          const key = `${coord.row}-${coord.col}`;
          const list = cellGroups.get(key) || [];
          list.push({ color, tokenIndex: idx, row: coord.row, col: coord.col, progress: prog });
          cellGroups.set(key, list);
        });
      }

      const stackOffsets = [
        [-0.16, -0.16],
        [0.16, -0.16],
        [-0.16, 0.16],
        [0.16, 0.16],
      ];

      cellGroups.forEach((list) => {
        const stacked = list.length > 1;
        const [bx, bz] = gridToWorld(list[0].row, list[0].col);

        const colorCounts: Partial<Record<LudoColor, number>> = {};
        for (const tok of list) {
          if (tok.progress >= 0 && tok.progress <= 50) {
            colorCounts[tok.color] = (colorCounts[tok.color] || 0) + 1;
          }
        }
        if (Object.values(colorCounts).some((count) => (count ?? 0) >= 2)) {
          const blockadeRing = new THREE.Mesh(blockadeHaloGeo, goldMat);
          blockadeRing.rotation.x = Math.PI / 2;
          blockadeRing.position.set(bx, 0.056, bz);
          pawnsGroup.add(blockadeRing);
        }

        list.forEach((tok, idx) => {
          const off = stacked ? stackOffsets[idx % stackOffsets.length] : [0, 0];
          const isLegal = Boolean(
            allowMove &&
              tok.color === vColor &&
              ls.turnColor === vColor &&
              ls.legalTokenIndices.includes(tok.tokenIndex)
          );
          const pGroup = buildLudoPawnGroup(
            tok.color,
            isLegal,
            pawnMats[tok.color],
            goldMat,
            ringMat,
            trackGeometry
          );
          pGroup.position.set(bx + off[0], 0.048, bz + off[1]);
          if (stacked) pGroup.scale.setScalar(0.84);
          pGroup.traverse((child) => {
            child.userData = { color: tok.color, tokenIndex: tok.tokenIndex, isLegal };
          });
          pawnsGroup.add(pGroup);
          if (isLegal) {
            legalPawnAnimTargets.push(pGroup);
          }
        });
      });

      requestRender();
    };

    sceneSyncRef.current = syncLudo;

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    const clock = new THREE.Clock();

    const stopControlAnim = () => {
      camTransitionRef.current.active = false;
    };
    controls.addEventListener('start', stopControlAnim);
    controls.addEventListener('change', () => requestRender());

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const dt = Math.min(0.05, clock.getDelta() || 0.016);
        const elapsed = clock.elapsedTime;
        let needsAnother = false;

        bgRoom.updateBackgroundGameplay(elapsed, dt);

        const { isRolling: rollingNow, displayedDiceValue: faceVal } = latestPropsRef.current;

        if (rollingNow) {
          dieGroup.rotation.x += dt * 15.5;
          dieGroup.rotation.y += dt * 19.0;
          dieGroup.rotation.z += dt * 11.2;
          dieGroup.position.y = 0.56 + Math.abs(Math.sin(elapsed * 14)) * 0.42;
          needsAnother = true;
        } else {
          const targetRot = DIE_ROTATION_FOR_FACE[faceVal ?? 6] || [0, 0, 0];
          const alpha = 1 - Math.exp(-12 * dt);
          dieGroup.rotation.x = THREE.MathUtils.lerp(dieGroup.rotation.x, targetRot[0], alpha);
          dieGroup.rotation.y = THREE.MathUtils.lerp(dieGroup.rotation.y, targetRot[1], alpha);
          dieGroup.rotation.z = THREE.MathUtils.lerp(dieGroup.rotation.z, targetRot[2], alpha);
          dieGroup.position.y = THREE.MathUtils.lerp(dieGroup.position.y, 0.33, alpha);
          if (
            Math.abs(dieGroup.rotation.x - targetRot[0]) > 0.01 ||
            Math.abs(dieGroup.rotation.y - targetRot[1]) > 0.01 ||
            Math.abs(dieGroup.rotation.z - targetRot[2]) > 0.01
          ) {
            needsAnother = true;
          }
        }

        if (legalPawnAnimTargets.length > 0 && !isSoftwareGl) {
          for (let i = 0; i < legalPawnAnimTargets.length; i += 1) {
            legalPawnAnimTargets[i].position.y = 0.05 + Math.abs(Math.sin(elapsed * 4.5 + i)) * 0.14;
          }
          needsAnother = true;
        }

        if (camTransitionRef.current.active) {
          _vCamPos.copy(camTransitionRef.current.pos);
          _vTarget.copy(camTransitionRef.current.target);
          const alpha = 1 - Math.exp(-8 * dt);
          camera.position.lerp(_vCamPos, alpha);
          controls.target.lerp(_vTarget, alpha);
          if (
            camera.position.distanceToSquared(_vCamPos) < 0.002 &&
            controls.target.distanceToSquared(_vTarget) < 0.002
          ) {
            camera.position.copy(_vCamPos);
            controls.target.copy(_vTarget);
            camTransitionRef.current.active = false;
          } else {
            needsAnother = true;
          }
        }

        if (controls.update()) {
          needsAnother = true;
        }

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || needsAnother) requestRender();
        };
        if (isSoftwareGl) {
          scheduleSoftwareGlFrame(renderer, done, (tid) => {
            frameId = tid;
          });
        } else {
          done();
        }
      });
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (ev: PointerEvent) => {
      downX = ev.clientX;
      downY = ev.clientY;
    };

    const onPointerUp = (ev: PointerEvent) => {
      const dist = Math.hypot(ev.clientX - downX, ev.clientY - downY);
      if (dist > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects([dieGroup, ...pawnsGroup.children], true);
      for (const h of hits) {
        const data = h.object.userData as {
          isDie?: boolean;
          tokenIndex?: number;
          isLegal?: boolean;
        };
        if (data.isDie && latestPropsRef.current.canRoll) {
          onRollRef.current();
          break;
        }
        if (typeof data.tokenIndex === 'number' && data.isLegal) {
          onMoveTokenRef.current(data.tokenIndex);
          break;
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const ro = new ResizeObserver(() => {
      const w = Math.max(320, el.clientWidth);
      const h = Math.max(260, el.clientHeight);
      fitCameraFovForAspect(camera, 42, w, h, 1.12);
      renderer.setSize(w, h, false);
      requestRender();
    });
    ro.observe(el);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    syncLudo();

    return () => {
      effectDisposed = true;
      ro.disconnect();
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.removeEventListener('start', stopControlAnim);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      sceneSyncRef.current = null;
      rig.dispose();
    };
  }, []);

  useEffect(() => {
    sceneSyncRef.current?.();
  }, [ludoState, viewerColor, canRoll, canMove, isRolling, displayedDiceValue]);

  useEffect(() => {
    if (cameraPreset === 'overhead') {
      camTransitionRef.current.pos.set(0, 13.6, 1.5);
    } else if (cameraPreset === 'dramatic') {
      camTransitionRef.current.pos.set(5.4, 5.6, 8.6);
    } else {
      camTransitionRef.current.pos.set(0, 10.2, 8.8);
    }
    camTransitionRef.current.target.set(0, 0.1, 0);
    camTransitionRef.current.active = true;
    sceneSyncRef.current?.();
  }, [cameraPreset]);

  if (webglError) {
    return (
      <div className="w-full aspect-square max-w-[580px] rounded-xl border border-[#D4AF37]/40 bg-[#07150e] flex items-center justify-center p-6 text-center text-xs text-neutral-300">
        3D WebGL context unavailable on this device. Enable hardware acceleration to inspect the 3D Ludo table.
      </div>
    );
  }

  return (
    <div className="w-full space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <span className="text-[11px] font-medium text-neutral-300">
          3D Football Clubs Ludo · Click 3D Die to roll, click highlighted 3D Pawns to move, drag to orbit
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0C120E] border border-white/10 rounded-lg p-0.5">
            {(
              [
                ['default', '3D Angle'],
                ['overhead', 'Top View'],
                ['dramatic', 'Low Angle'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCameraPreset(key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  cameraPreset === key
                    ? 'bg-[#0D4A2E] text-[#FFD76A]'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {onToggleFullscreen && (
            <FullscreenToggleButton
              isFullscreen={isFullscreen}
              onToggle={onToggleFullscreen}
            />
          )}
        </div>
      </div>

      <div
        className={`relative w-full overflow-hidden rounded-[22px] border-2 border-[#D4AF37]/60 bg-[#05110A] shadow-[0_28px_56px_rgba(0,0,0,0.88)] ${
          isFullscreen ? 'h-[calc(100dvh-170px)] min-h-[540px]' : 'h-[480px] sm:h-[580px] lg:h-[620px]'
        }`}
      >
        <img
          src={proBgLudo}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center brightness-[0.58] contrast-110"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[#020805]/55"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(4,12,8,0.18)_25%,rgba(2,8,5,0.86)_100%)]"
        />
        <div ref={mountRef} className="relative z-10 h-full w-full" />
      </div>
    </div>
  );
};

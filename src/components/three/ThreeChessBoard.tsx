import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  buildLuxuryRoomEnvironment,
  createMahoganyTexture,
  createMarbleStoneTexture,
  createStudioRig,
  fitCameraFovForAspect,
  scheduleSoftwareGlFrame,
  type CameraPresetKey,
} from './studioScene';
import { FullscreenToggleButton } from '../FullscreenToggleButton';
import proBgChess from '../../assets/images/pro_bg_chess_1794922550558.jpg';
import type { ChessColor, ChessLegalMoveTarget, ChessPiece, ChessPieceType } from '../../shared/types';

interface ThreeChessBoardProps {
  board: (ChessPiece | null)[][];
  orientBlack: boolean;
  selected: { row: number; col: number } | null;
  legalTargets: ChessLegalMoveTarget[];
  lastMove?: {
    from: { row: number; col: number };
    to: { row: number; col: number };
  } | null;
  inCheckColor: ChessColor | null;
  isYourTurn: boolean;
  gameStatus: 'waiting' | 'in_progress' | 'completed';
  onSquareClick: (row: number, col: number) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const SQUARE_SIZE = 1.0;
const _vTarget = new THREE.Vector3();
const _vCamPos = new THREE.Vector3();

function squareToWorld(row: number, col: number): [number, number] {
  return [(col - 3.5) * SQUARE_SIZE, (row - 3.5) * SQUARE_SIZE];
}

function buildStauntonPieceGroup(
  type: ChessPieceType,
  color: ChessColor,
  whiteMat: THREE.Material,
  blackMat: THREE.Material,
  feltMat: THREE.Material,
  brassMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T
): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = color === 'w' ? whiteMat : blackMat;

  // 1. Green baize felt foot pad
  const feltFoot = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.35, 0.36, 0.03, 32)),
    feltMat
  );
  feltFoot.position.y = 0.015;
  group.add(feltFoot);

  // 2. Turned Lathe pedestal + waist profile (36 radial segments for Full HD curve clarity)
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.03),
    new THREE.Vector2(0.36, 0.03),
    new THREE.Vector2(0.36, 0.11),
    new THREE.Vector2(0.28, 0.17),
    new THREE.Vector2(0.30, 0.21),
    new THREE.Vector2(0.18, 0.28),
  ];

  const colHeight =
    type === 'p' ? 0.56 : type === 'r' ? 0.66 : type === 'n' ? 0.64 : type === 'b' ? 0.78 : type === 'q' ? 0.92 : 1.02;

  pts.push(
    new THREE.Vector2(type === 'p' ? 0.13 : 0.145, colHeight * 0.74),
    new THREE.Vector2(type === 'p' ? 0.19 : 0.22, colHeight * 0.80),
    new THREE.Vector2(type === 'p' ? 0.14 : 0.16, colHeight * 0.86),
    new THREE.Vector2(0.0, colHeight * 0.88)
  );

  const latheMesh = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(pts, 36)), bodyMat);
  latheMesh.castShadow = true;
  latheMesh.receiveShadow = true;
  group.add(latheMesh);

  // 3. Brass weight collar accent ring
  const collar = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.195, 0.016, 12, 32)),
    brassMat
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = colHeight * 0.80;
  group.add(collar);

  // 4. Distinctive Staunton Crown per piece rank
  if (type === 'p') {
    const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.175, 28, 22)), bodyMat);
    head.position.y = 0.64;
    head.castShadow = true;
    group.add(head);
  } else if (type === 'r') {
    const turret = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.24, 0.20, 0.20, 28)),
      bodyMat
    );
    turret.position.y = 0.70;
    turret.castShadow = true;
    group.add(turret);

    for (let i = 0; i < 4; i += 1) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const merlon = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.11, 0.09, 0.09)),
        bodyMat
      );
      merlon.position.set(Math.cos(angle) * 0.16, 0.84, Math.sin(angle) * 0.16);
      merlon.rotation.y = -angle;
      merlon.castShadow = true;
      group.add(merlon);
    }
  } else if (type === 'b') {
    const mitre = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.18, 28, 22)), bodyMat);
    mitre.scale.set(0.85, 1.35, 0.85);
    mitre.position.y = 0.84;
    mitre.castShadow = true;
    group.add(mitre);

    const finial = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.058, 20, 16)), brassMat);
    finial.position.y = 1.11;
    finial.castShadow = true;
    group.add(finial);
  } else if (type === 'n') {
    const horseShape = new THREE.Shape();
    horseShape.moveTo(-0.14, 0);
    horseShape.lineTo(0.16, 0);
    horseShape.quadraticCurveTo(0.20, 0.24, 0.09, 0.42);
    horseShape.lineTo(0.21, 0.34);
    horseShape.lineTo(0.24, 0.43);
    horseShape.lineTo(0.06, 0.56);
    horseShape.lineTo(0.02, 0.65);
    horseShape.lineTo(-0.04, 0.56);
    horseShape.quadraticCurveTo(-0.20, 0.42, -0.18, 0.12);
    horseShape.closePath();

    const horseGeo = trackGeo(
      new THREE.ExtrudeGeometry(horseShape, {
        depth: 0.16,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.028,
        bevelSegments: 4,
      })
    );
    horseGeo.center();
    const horse = new THREE.Mesh(horseGeo, bodyMat);
    horse.position.y = 0.72;
    horse.rotation.y = color === 'w' ? Math.PI / 2 : -Math.PI / 2;
    horse.castShadow = true;
    group.add(horse);
  } else if (type === 'q') {
    const cup = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.25, 0.16, 0.20, 28)),
      bodyMat
    );
    cup.position.y = 0.92;
    cup.castShadow = true;
    group.add(cup);

    for (let i = 0; i < 6; i += 1) {
      const angle = (i * Math.PI * 2) / 6;
      const point = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.042, 16, 14)), brassMat);
      point.position.set(Math.cos(angle) * 0.21, 1.04, Math.sin(angle) * 0.21);
      group.add(point);
    }

    const orb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 24, 20)), bodyMat);
    orb.position.y = 1.06;
    orb.castShadow = true;
    group.add(orb);
  } else if (type === 'k') {
    const crown = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.24, 0.17, 0.22, 28)),
      bodyMat
    );
    crown.position.y = 1.02;
    crown.castShadow = true;
    group.add(crown);

    const crossV = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.24, 0.06)), brassMat);
    crossV.position.y = 1.24;
    crossV.castShadow = true;
    group.add(crossV);

    const crossH = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.055, 0.06)), brassMat);
    crossH.position.y = 1.27;
    crossH.castShadow = true;
    group.add(crossH);
  }

  return group;
}

function createCoordinateRimTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const S = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, '#361a0d');
  grad.addColorStop(0.5, '#210e05');
  grad.addColorStop(1, '#361a0d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  // Double engraved brass frame lines
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 8;
  ctx.strokeRect(104, 104, S - 208, S - 208);

  ctx.strokeStyle = 'rgba(255, 215, 106, 0.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, S - 48, S - 48);

  const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 48px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 8; i += 1) {
    const p = 241.4 + i * 223.58;
    ctx.fillText(files[i], p, S - 58);
    ctx.fillText(files[i], p, 60);
    const rank = String(8 - i);
    ctx.fillText(rank, 56, p);
    ctx.fillText(rank, S - 56, p);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

export const ThreeChessBoard: React.FC<ThreeChessBoardProps> = ({
  board,
  orientBlack,
  selected,
  legalTargets,
  lastMove,
  inCheckColor,
  isYourTurn,
  gameStatus,
  onSquareClick,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onSquareClickRef = useRef(onSquareClick);
  onSquareClickRef.current = onSquareClick;

  const [cameraPreset, setCameraPreset] = useState<CameraPresetKey>('default');
  const [webglError, setWebglError] = useState(false);

  const sceneSyncRef = useRef<(() => void) | null>(null);
  const camTransitionRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: new THREE.Vector3(0, 8.8, 8.6),
    target: new THREE.Vector3(0, 0.15, 0),
  });
  const latestPropsRef = useRef({
    board,
    orientBlack,
    selected,
    legalTargets,
    lastMove,
    inCheckColor,
    isYourTurn,
    gameStatus,
  });
  latestPropsRef.current = {
    board,
    orientBlack,
    selected,
    legalTargets,
    lastMove,
    inCheckColor,
    isYourTurn,
    gameStatus,
  };

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    let rig: ReturnType<typeof createStudioRig>;
    try {
      rig = createStudioRig(el, {
        backgroundHex: 0x07130d,
        fogHex: 0x07130d,
        fogDensity: 0.004,
        fov: 40,
        minAspect: 1.12,
        shadowBounds: 7.5,
        initialCamera: [0, 8.8, orientBlack ? -8.6 : 8.6],
        initialTarget: [0, 0.15, 0],
        minDistance: 5.5,
        maxDistance: 20,
        roomTheme: 'chess',
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
      theme: 'chess',
      tableBottomY: -0.44,
      floorY: -1.85,
      pedestalScale: 1.05,
    });

    // HD Procedural Stone & Mahogany Textures
    const mahoganyTex = trackTexture(createMahoganyTexture(maxAniso, '#452010', '#210c04'));
    const rimTex = trackTexture(createCoordinateRimTexture(maxAniso));
    const ivoryMarbleTex = trackTexture(
      createMarbleStoneTexture(maxAniso, '#ebe1ca', '#a79572', '#f7f1e2')
    );
    const emeraldMarbleTex = trackTexture(
      createMarbleStoneTexture(maxAniso, '#0b4a2e', '#2f8258', '#14623e')
    );

    const cabinetMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        map: mahoganyTex,
        roughness: 0.28,
        metalness: 0.08,
        clearcoat: 0.55,
      })
    );
    const rimTopMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        map: rimTex,
        roughness: 0.3,
        metalness: 0.14,
      })
    );
    const brassMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        color: 0xd4af37,
        roughness: 0.2,
        metalness: 0.9,
        clearcoat: 0.5,
      })
    );
    const lightSqMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        map: ivoryMarbleTex,
        roughness: 0.24,
        metalness: 0.04,
        clearcoat: 0.52,
        clearcoatRoughness: 0.16,
      })
    );
    const darkSqMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        map: emeraldMarbleTex,
        roughness: 0.26,
        metalness: 0.06,
        clearcoat: 0.52,
        clearcoatRoughness: 0.18,
      })
    );
    const selectedSqMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xe5be42,
        emissive: 0x705409,
        emissiveIntensity: 0.45,
        roughness: 0.28,
      })
    );
    const lastLightSqMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        map: ivoryMarbleTex,
        color: 0xf4e89a,
        roughness: 0.26,
        clearcoat: 0.45,
      })
    );
    const lastDarkSqMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        map: emeraldMarbleTex,
        color: 0x2ca368,
        roughness: 0.28,
        clearcoat: 0.45,
      })
    );
    const checkSqMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xc82828,
        emissive: 0x801010,
        emissiveIntensity: 0.55,
        roughness: 0.32,
      })
    );

    const whitePieceMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        color: 0xf7eed8,
        roughness: 0.2,
        metalness: 0.04,
        clearcoat: 0.65,
        clearcoatRoughness: 0.16,
      })
    );
    const blackPieceMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        color: 0x1c1816,
        roughness: 0.22,
        metalness: 0.14,
        clearcoat: 0.72,
        clearcoatRoughness: 0.15,
      })
    );
    const feltPadMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x094726,
        roughness: 0.92,
        metalness: 0,
      })
    );

    // Mahogany Cabinet Base, Brass Corner Brackets & Engraved Coordinate Rim
    const cabinetBase = new THREE.Mesh(
      trackGeometry(new THREE.BoxGeometry(9.2, 0.44, 9.2)),
      cabinetMat
    );
    cabinetBase.position.y = -0.22;
    cabinetBase.castShadow = true;
    cabinetBase.receiveShadow = true;
    scene.add(cabinetBase);

    const cornerBracketGeo = trackGeometry(new THREE.BoxGeometry(0.46, 0.46, 0.46));
    for (const [cx, cz] of [
      [-4.42, -4.42],
      [4.42, -4.42],
      [-4.42, 4.42],
      [4.42, 4.42],
    ]) {
      const bracket = new THREE.Mesh(cornerBracketGeo, brassMat);
      bracket.position.set(cx, -0.22, cz);
      bracket.castShadow = true;
      scene.add(bracket);
    }

    const rimTop = new THREE.Mesh(
      trackGeometry(new THREE.PlaneGeometry(9.16, 9.16)),
      rimTopMat
    );
    rimTop.rotation.x = -Math.PI / 2;
    rimTop.position.y = 0.002;
    rimTop.receiveShadow = true;
    scene.add(rimTop);

    // 8x8 Interactive Board Squares
    const squareMeshes: THREE.Mesh[][] = [];
    const squareGeo = trackGeometry(new THREE.BoxGeometry(SQUARE_SIZE * 0.996, 0.04, SQUARE_SIZE * 0.996));
    const clickables: THREE.Object3D[] = [];

    for (let r = 0; r < 8; r += 1) {
      const rowArr: THREE.Mesh[] = [];
      for (let c = 0; c < 8; c += 1) {
        const isLight = (r + c) % 2 === 0;
        const sq = new THREE.Mesh(squareGeo, isLight ? lightSqMat : darkSqMat);
        const [wx, wz] = squareToWorld(r, c);
        sq.position.set(wx, 0.02, wz);
        sq.receiveShadow = true;
        sq.userData = { row: r, col: c };
        scene.add(sq);
        clickables.push(sq);
        rowArr.push(sq);
      }
      squareMeshes.push(rowArr);
    }

    // Legal Target Markers Group
    const markersGroup = new THREE.Group();
    scene.add(markersGroup);
    const moveDiscGeo = trackGeometry(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 24));
    const captureRingGeo = trackGeometry(new THREE.TorusGeometry(0.38, 0.042, 14, 32));
    const moveDiscMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x9ce800,
        emissive: 0x3b6600,
        emissiveIntensity: 0.6,
        roughness: 0.25,
      })
    );
    const captureRingMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xffd76a,
        emissive: 0x9a6d0a,
        emissiveIntensity: 0.7,
        roughness: 0.2,
      })
    );

    // Pieces Group
    const piecesGroup = new THREE.Group();
    scene.add(piecesGroup);
    const activePieceMeshes: Array<{
      group: THREE.Group;
      targetX: number;
      targetZ: number;
      targetY: number;
    }> = [];

    const syncBoard = () => {
      const {
        board: b,
        selected: sel,
        legalTargets: targets,
        lastMove: lm,
        inCheckColor: chk,
      } = latestPropsRef.current;

      for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < 8; c += 1) {
          const sq = squareMeshes[r][c];
          const isLight = (r + c) % 2 === 0;
          const piece = b[r][c];
          const isSel = sel?.row === r && sel?.col === c;
          const isLastFrom = lm?.from.row === r && lm?.from.col === c;
          const isLastTo = lm?.to.row === r && lm?.to.col === c;
          const isCheckedKing = piece?.type === 'k' && piece.color === chk;

          if (isSel) sq.material = selectedSqMat;
          else if (isCheckedKing) sq.material = checkSqMat;
          else if (isLastFrom || isLastTo) sq.material = isLight ? lastLightSqMat : lastDarkSqMat;
          else sq.material = isLight ? lightSqMat : darkSqMat;
        }
      }

      markersGroup.clear();
      for (const t of targets) {
        const [wx, wz] = squareToWorld(t.toRow, t.toCol);
        const targetOccupied = Boolean(b[t.toRow]?.[t.toCol]);
        if (targetOccupied) {
          const ring = new THREE.Mesh(captureRingGeo, captureRingMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(wx, 0.065, wz);
          ring.userData = { row: t.toRow, col: t.toCol };
          markersGroup.add(ring);
        } else {
          const disc = new THREE.Mesh(moveDiscGeo, moveDiscMat);
          disc.position.set(wx, 0.06, wz);
          disc.userData = { row: t.toRow, col: t.toCol };
          markersGroup.add(disc);
        }
      }

      piecesGroup.clear();
      activePieceMeshes.length = 0;
      for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < 8; c += 1) {
          const piece = b[r][c];
          if (!piece) continue;
          const pGroup = buildStauntonPieceGroup(
            piece.type,
            piece.color,
            whitePieceMat,
            blackPieceMat,
            feltPadMat,
            brassMat,
            trackGeometry
          );
          const [wx, wz] = squareToWorld(r, c);
          const isSel = sel?.row === r && sel?.col === c;
          const targetY = isSel ? 0.22 : 0.04;
          pGroup.position.set(wx, targetY, wz);
          pGroup.traverse((child) => {
            child.userData = { row: r, col: c };
          });
          piecesGroup.add(pGroup);
          activePieceMeshes.push({ group: pGroup, targetX: wx, targetZ: wz, targetY });
        }
      }

      requestRender();
    };

    sceneSyncRef.current = syncBoard;

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

      const hits = raycaster.intersectObjects([...piecesGroup.children, ...markersGroup.children, ...clickables], true);
      for (const h of hits) {
        const { row, col } = h.object.userData as { row?: number; col?: number };
        if (typeof row === 'number' && typeof col === 'number') {
          onSquareClickRef.current(row, col);
          break;
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const ro = new ResizeObserver(() => {
      const w = Math.max(320, el.clientWidth);
      const h = Math.max(260, el.clientHeight);
      fitCameraFovForAspect(camera, 40, w, h, 1.12);
      renderer.setSize(w, h, false);
      requestRender();
    });
    ro.observe(el);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    syncBoard();

    return () => {
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
  }, [board, selected, legalTargets, lastMove, inCheckColor, isYourTurn, gameStatus]);

  useEffect(() => {
    const sideSign = orientBlack ? -1 : 1;
    if (cameraPreset === 'overhead') {
      camTransitionRef.current.pos.set(0, 12.6, sideSign * 1.4);
    } else if (cameraPreset === 'dramatic') {
      camTransitionRef.current.pos.set(sideSign * 5.2, 5.2, sideSign * 8.4);
    } else {
      camTransitionRef.current.pos.set(0, 8.8, sideSign * 8.6);
    }
    camTransitionRef.current.target.set(0, 0.15, 0);
    camTransitionRef.current.active = true;
    sceneSyncRef.current?.();
  }, [orientBlack, cameraPreset]);

  if (webglError) {
    return (
      <div className="w-full aspect-square max-w-[560px] rounded-xl border border-[#D4AF37]/40 bg-[#07150e] flex items-center justify-center p-6 text-center text-xs text-neutral-300">
        3D WebGL context unavailable on this device. Switch to standard browser hardware acceleration to inspect the 3D chessboard.
      </div>
    );
  }

  return (
    <div className="w-full space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <span className="text-[11px] font-medium text-neutral-300">
          3D Staunton Board · Drag to orbit, scroll to zoom, click piece &amp; square
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
        className={`relative w-full overflow-hidden rounded-xl border-2 border-[#D4AF37]/60 bg-[#07130D] shadow-[0_24px_48px_rgba(0,0,0,0.85)] ${
          isFullscreen ? 'h-[calc(100dvh-170px)] min-h-[540px]' : 'h-[480px] sm:h-[580px] lg:h-[620px]'
        }`}
      >
        <img
          src={proBgChess}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(5,9,7,0.58)_100%)]"
        />
        <div ref={mountRef} className="relative z-10 h-full w-full" />
      </div>
    </div>
  );
};

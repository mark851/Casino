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
import proBgDrafts from '../../assets/images/pro_bg_drafts_1794922550631.jpg';
import type { DraftsLegalMoveTarget, DraftsPiece } from '../../shared/types';

interface ThreeDraftsBoardProps {
  board: (DraftsPiece | null)[][];
  orientBlack: boolean;
  activeSelection: { row: number; col: number } | null;
  legalTargets: DraftsLegalMoveTarget[];
  lastMove?: {
    from: { row: number; col: number };
    to: { row: number; col: number };
  } | null;
  viewerColor: 'red' | 'black';
  isYourTurn: boolean;
  gameStatus: 'waiting' | 'in_progress' | 'completed';
  legalMovesBySquare: Record<string, DraftsLegalMoveTarget[]>;
  onSquareClick: (row: number, col: number) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const SQUARE_SIZE = 1.0;
const _vCamPos = new THREE.Vector3();
const _vTarget = new THREE.Vector3();

function squareToWorld(row: number, col: number): [number, number] {
  return [(col - 3.5) * SQUARE_SIZE, (row - 3.5) * SQUARE_SIZE];
}

function createDraftsRimTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const S = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, '#3a1a0d');
  grad.addColorStop(0.5, '#1d0b04');
  grad.addColorStop(1, '#3a1a0d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 8;
  ctx.strokeRect(102, 102, S - 204, S - 204);

  ctx.strokeStyle = 'rgba(255, 215, 106, 0.42)';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, S - 48, S - 48);

  const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 46px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 8; i += 1) {
    const p = 241.4 + i * 223.58;
    ctx.fillText(files[i], p, S - 56);
    ctx.fillText(files[i], p, 58);
    const rank = String(8 - i);
    ctx.fillText(rank, 54, p);
    ctx.fillText(rank, S - 54, p);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function createCheckerCrestTexture(
  maxAnisotropy: number,
  baseHex: string,
  ringHex: string
): THREE.CanvasTexture {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S * 0.5);
  grad.addColorStop(0, baseHex);
  grad.addColorStop(1, '#09090b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  ctx.strokeStyle = ringHex;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.24, 0, Math.PI * 2);
  ctx.stroke();

  // Center 5-point star medallion
  ctx.fillStyle = ringHex;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? S * 0.16 : S * 0.068;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const px = S / 2 + Math.cos(angle) * rad;
    const py = S / 2 + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function buildCheckerPieceGroup(
  color: 'red' | 'black',
  isKing: boolean,
  canSelect: boolean,
  redMat: THREE.Material,
  blackMat: THREE.Material,
  redCrestMat: THREE.Material,
  blackCrestMat: THREE.Material,
  brassMat: THREE.Material,
  limeMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T
): THREE.Group {
  const group = new THREE.Group();
  const discMat = color === 'red' ? redMat : blackMat;
  const crestMat = color === 'red' ? redCrestMat : blackCrestMat;

  const stackLayers = isKing ? 2 : 1;
  for (let i = 0; i < stackLayers; i += 1) {
    const baseY = i * 0.21;
    // Turned grooved checker puck via LatheGeometry (36 segments)
    const pts = [
      new THREE.Vector2(0.0, baseY),
      new THREE.Vector2(0.36, baseY),
      new THREE.Vector2(0.38, baseY + 0.04),
      new THREE.Vector2(0.38, baseY + 0.16),
      new THREE.Vector2(0.34, baseY + 0.20),
      new THREE.Vector2(0.24, baseY + 0.20),
      new THREE.Vector2(0.21, baseY + 0.175),
      new THREE.Vector2(0.11, baseY + 0.175),
      new THREE.Vector2(0.09, baseY + 0.195),
      new THREE.Vector2(0.0, baseY + 0.195),
    ];
    const disc = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(pts, 36)), discMat);
    disc.castShadow = true;
    disc.receiveShadow = true;
    group.add(disc);

    // Top engraved star inlay plate
    const crestPlate = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(0.22, 32)),
      crestMat
    );
    crestPlate.rotation.x = -Math.PI / 2;
    crestPlate.position.y = baseY + 0.202;
    group.add(crestPlate);

    // Metallic rim accent ring
    const trim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.30, 0.015, 10, 32)), brassMat);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = baseY + 0.195;
    group.add(trim);
  }

  // Flying King Golden Crown Emblem
  if (isKing) {
    const crownBaseY = 0.41;
    const crownRing = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.20, 0.14, 0.13, 24)),
      brassMat
    );
    crownRing.position.y = crownBaseY + 0.065;
    crownRing.castShadow = true;
    group.add(crownRing);

    for (let i = 0; i < 6; i += 1) {
      const a = (i * Math.PI * 2) / 6;
      const orb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.036, 14, 12)), brassMat);
      orb.position.set(Math.cos(a) * 0.165, crownBaseY + 0.15, Math.sin(a) * 0.165);
      group.add(orb);
    }

    const finialGem = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.06, 16, 14)),
      discMat
    );
    finialGem.position.y = crownBaseY + 0.14;
    group.add(finialGem);
  }

  if (canSelect) {
    const halo = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.41, 0.025, 10, 32)), limeMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.025;
    group.add(halo);
  }

  return group;
}

export const ThreeDraftsBoard: React.FC<ThreeDraftsBoardProps> = ({
  board,
  orientBlack,
  activeSelection,
  legalTargets,
  lastMove,
  viewerColor,
  isYourTurn,
  gameStatus,
  legalMovesBySquare,
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
    pos: new THREE.Vector3(0, 8.6, 8.4),
    target: new THREE.Vector3(0, 0.1, 0),
  });

  const latestPropsRef = useRef({
    board,
    orientBlack,
    activeSelection,
    legalTargets,
    lastMove,
    viewerColor,
    isYourTurn,
    gameStatus,
    legalMovesBySquare,
  });
  latestPropsRef.current = {
    board,
    orientBlack,
    activeSelection,
    legalTargets,
    lastMove,
    viewerColor,
    isYourTurn,
    gameStatus,
    legalMovesBySquare,
  };

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    let rig: ReturnType<typeof createStudioRig>;
    try {
      rig = createStudioRig(el, {
        backgroundHex: 0x0b0a08,
        fogHex: 0x0b0a08,
        fogDensity: 0.004,
        fov: 40,
        minAspect: 1.12,
        shadowBounds: 7.5,
        initialCamera: [0, 8.6, orientBlack ? -8.4 : 8.4],
        initialTarget: [0, 0.1, 0],
        minDistance: 5.5,
        maxDistance: 20,
        roomTheme: 'drafts',
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
      theme: 'drafts',
      tableBottomY: -0.42,
      floorY: -1.85,
      pedestalScale: 1.05,
    });

    const walnutTex = trackTexture(createMahoganyTexture(maxAniso, '#44200f', '#1c0c04'));
    const rimTex = trackTexture(createDraftsRimTexture(maxAniso));
    const creamMarbleTex = trackTexture(
      createMarbleStoneTexture(maxAniso, '#e2ceb0', '#a98e68', '#f3e5ce')
    );
    const greenMarbleTex = trackTexture(
      createMarbleStoneTexture(maxAniso, '#093e25', '#2c7952', '#105434')
    );
    const redCrestTex = trackTexture(createCheckerCrestTexture(maxAniso, '#d92626', '#ffd76a'));
    const blackCrestTex = trackTexture(createCheckerCrestTexture(maxAniso, '#1f2937', '#d4af37'));

    const cabinetMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        map: walnutTex,
        roughness: 0.28,
        metalness: 0.08,
        clearcoat: 0.55,
      })
    );
    const rimTopMat = trackMaterial(
      new THREE.MeshStandardMaterial({ map: rimTex, roughness: 0.3, metalness: 0.14 })
    );
    const brassMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({ color: 0xd4af37, roughness: 0.2, metalness: 0.9, clearcoat: 0.5 })
    );
    const lightSqMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        map: creamMarbleTex,
        roughness: 0.26,
        metalness: 0.04,
        clearcoat: 0.45,
      })
    );
    const darkSqMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        map: greenMarbleTex,
        roughness: 0.28,
        metalness: 0.06,
        clearcoat: 0.48,
      })
    );
    const selectedSqMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xc2931e,
        emissive: 0x6b4b08,
        emissiveIntensity: 0.45,
        roughness: 0.28,
      })
    );
    const lastDarkSqMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        map: greenMarbleTex,
        color: 0x26925e,
        roughness: 0.28,
        clearcoat: 0.45,
      })
    );
    const redCheckerMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        color: 0xd92626,
        roughness: 0.2,
        metalness: 0.08,
        clearcoat: 0.78,
      })
    );
    const blackCheckerMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        color: 0x191d24,
        roughness: 0.22,
        metalness: 0.16,
        clearcoat: 0.72,
      })
    );
    const redCrestMat = trackMaterial(
      new THREE.MeshStandardMaterial({ map: redCrestTex, roughness: 0.25 })
    );
    const blackCrestMat = trackMaterial(
      new THREE.MeshStandardMaterial({ map: blackCrestTex, roughness: 0.25 })
    );
    const limeMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x9ce800,
        emissive: 0x4b7700,
        emissiveIntensity: 0.65,
        roughness: 0.25,
      })
    );
    const captureGoldMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xffd76a,
        emissive: 0x8f6608,
        emissiveIntensity: 0.7,
        roughness: 0.2,
      })
    );

    const cabinet = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(9.04, 0.42, 9.04)), cabinetMat);
    cabinet.position.y = -0.21;
    cabinet.castShadow = true;
    cabinet.receiveShadow = true;
    scene.add(cabinet);

    const cornerBracketGeo = trackGeometry(new THREE.BoxGeometry(0.44, 0.44, 0.44));
    for (const [cx, cz] of [
      [-4.34, -4.34],
      [4.34, -4.34],
      [-4.34, 4.34],
      [4.34, 4.34],
    ]) {
      const bracket = new THREE.Mesh(cornerBracketGeo, brassMat);
      bracket.position.set(cx, -0.21, cz);
      bracket.castShadow = true;
      scene.add(bracket);
    }

    const rimTop = new THREE.Mesh(trackGeometry(new THREE.PlaneGeometry(9.0, 9.0)), rimTopMat);
    rimTop.rotation.x = -Math.PI / 2;
    rimTop.position.y = 0.002;
    rimTop.receiveShadow = true;
    scene.add(rimTop);

    // Brass inlay border around the 8x8 grid
    const inlay = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(8.16, 0.02, 8.16)), brassMat);
    inlay.position.y = 0.006;
    scene.add(inlay);

    const squareMeshes: THREE.Mesh[][] = [];
    const squareGeo = trackGeometry(new THREE.BoxGeometry(SQUARE_SIZE * 0.996, 0.04, SQUARE_SIZE * 0.996));
    const clickables: THREE.Object3D[] = [];

    for (let r = 0; r < 8; r += 1) {
      const rowArr: THREE.Mesh[] = [];
      for (let c = 0; c < 8; c += 1) {
        const isDark = (r + c) % 2 === 1;
        const sq = new THREE.Mesh(squareGeo, isDark ? darkSqMat : lightSqMat);
        const [wx, wz] = squareToWorld(r, c);
        sq.position.set(wx, 0.022, wz);
        sq.receiveShadow = true;
        sq.userData = { row: r, col: c };
        scene.add(sq);
        clickables.push(sq);
        rowArr.push(sq);
      }
      squareMeshes.push(rowArr);
    }

    const markersGroup = new THREE.Group();
    scene.add(markersGroup);
    const moveDiscGeo = trackGeometry(new THREE.CylinderGeometry(0.17, 0.19, 0.03, 24));
    const piecesGroup = new THREE.Group();
    scene.add(piecesGroup);

    const syncBoard = () => {
      const {
        board: b,
        activeSelection: sel,
        legalTargets: targets,
        lastMove: lm,
        viewerColor: vColor,
        isYourTurn: yourTurn,
        gameStatus: gStatus,
        legalMovesBySquare: legalMap,
      } = latestPropsRef.current;

      for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < 8; c += 1) {
          const sq = squareMeshes[r][c];
          const isDark = (r + c) % 2 === 1;
          const isSel = sel?.row === r && sel?.col === c;
          const isLast =
            (lm?.from.row === r && lm?.from.col === c) || (lm?.to.row === r && lm?.to.col === c);
          if (isSel) sq.material = selectedSqMat;
          else if (isLast && isDark) sq.material = lastDarkSqMat;
          else sq.material = isDark ? darkSqMat : lightSqMat;
        }
      }

      markersGroup.clear();
      for (const t of targets) {
        const [wx, wz] = squareToWorld(t.toRow, t.toCol);
        const disc = new THREE.Mesh(moveDiscGeo, t.isCapture ? captureGoldMat : limeMat);
        disc.position.set(wx, 0.06, wz);
        disc.userData = { row: t.toRow, col: t.toCol };
        markersGroup.add(disc);
      }

      piecesGroup.clear();
      for (let r = 0; r < 8; r += 1) {
        for (let c = 0; c < 8; c += 1) {
          const piece = b[r][c];
          if (!piece) continue;
          const canSelect = Boolean(
            yourTurn &&
              gStatus === 'in_progress' &&
              piece.color === vColor &&
              legalMap[`${r},${c}`]?.length
          );
          const pGroup = buildCheckerPieceGroup(
            piece.color,
            piece.king,
            canSelect,
            redCheckerMat,
            blackCheckerMat,
            redCrestMat,
            blackCrestMat,
            brassMat,
            limeMat,
            trackGeometry
          );
          const [wx, wz] = squareToWorld(r, c);
          const isSel = sel?.row === r && sel?.col === c;
          pGroup.position.set(wx, isSel ? 0.18 : 0.042, wz);
          pGroup.traverse((child) => {
            child.userData = { row: r, col: c };
          });
          piecesGroup.add(pGroup);
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
  }, [board, activeSelection, legalTargets, lastMove, isYourTurn, gameStatus, legalMovesBySquare]);

  useEffect(() => {
    const sideSign = orientBlack ? -1 : 1;
    if (cameraPreset === 'overhead') {
      camTransitionRef.current.pos.set(0, 12.6, sideSign * 1.3);
    } else if (cameraPreset === 'dramatic') {
      camTransitionRef.current.pos.set(sideSign * 5.0, 5.2, sideSign * 8.2);
    } else {
      camTransitionRef.current.pos.set(0, 8.6, sideSign * 8.4);
    }
    camTransitionRef.current.target.set(0, 0.1, 0);
    camTransitionRef.current.active = true;
    sceneSyncRef.current?.();
  }, [orientBlack, cameraPreset]);

  if (webglError) {
    return (
      <div className="w-full aspect-square max-w-[560px] rounded-xl border border-[#D4AF37]/40 bg-[#0d110e] flex items-center justify-center p-6 text-center text-xs text-neutral-300">
        3D WebGL context unavailable on this device. Enable hardware acceleration to display the 3D checkerboard.
      </div>
    );
  }

  return (
    <div className="w-full space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <span className="text-[11px] font-medium text-neutral-300">
          3D Uganda Drafts · Drag to orbit, scroll to zoom, click checker &amp; dark square
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
        className={`relative w-full overflow-hidden rounded-xl border-2 border-[#D4AF37]/60 bg-[#0B0A08] shadow-[0_24px_48px_rgba(0,0,0,0.85)] ${
          isFullscreen ? 'h-[calc(100dvh-170px)] min-h-[540px]' : 'h-[480px] sm:h-[580px] lg:h-[620px]'
        }`}
      >
        <img
          src={proBgDrafts}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(8,7,5,0.58)_100%)]"
        />
        <div ref={mountRef} className="relative z-10 h-full w-full" />
      </div>
    </div>
  );
};

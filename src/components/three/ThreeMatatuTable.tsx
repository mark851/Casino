import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SUIT_LABELS, SUIT_SYMBOLS } from '../../shared/matatuRules';
import {
  buildLuxuryRoomEnvironment,
  createFeltTexture,
  createMahoganyTexture,
  createStudioRig,
  fitCameraFovForAspect,
  scheduleSoftwareGlFrame,
  type CameraPresetKey,
} from './studioScene';
import { FullscreenToggleButton } from '../FullscreenToggleButton';
import proBgMatatu from '../../assets/images/pro_bg_matatu_1794922549602.jpg';
import type { PlayingCard as PlayingCardType, SanitizedGameState } from '../../shared/types';

interface ThreeMatatuTableProps {
  gameState: SanitizedGameState;
  viewerUid: string;
  isYourTurn: boolean;
  playableCardIds: Set<string>;
  onCardClick: (card: PlayingCardType) => void;
  onDrawCard: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const _vCamPos = new THREE.Vector3();
const _vTarget = new THREE.Vector3();

function createCardFaceTexture(
  card: PlayingCardType,
  maxAnisotropy: number,
  playableHighlight: boolean
): THREE.CanvasTexture {
  const w = 768;
  const h = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const ink = isRed ? '#c81e1e' : '#111827';
  const sym = SUIT_SYMBOLS[card.suit];

  // Crisp Linen Paper Card Base
  const paperGrad = ctx.createLinearGradient(0, 0, w, h);
  paperGrad.addColorStop(0, '#fffdf7');
  paperGrad.addColorStop(0.5, '#fbf6e8');
  paperGrad.addColorStop(1, '#f4ecd8');
  ctx.fillStyle = paperGrad;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 46);
  ctx.fill();

  // Fine linen cross-hatch paper texture
  ctx.strokeStyle = 'rgba(0,0,0,0.022)';
  ctx.lineWidth = 2;
  for (let i = 0; i < w; i += 14) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, h);
    ctx.stroke();
  }

  ctx.lineWidth = playableHighlight ? 22 : 10;
  ctx.strokeStyle = playableHighlight ? '#ffd76a' : '#d6cab0';
  ctx.strokeRect(18, 18, w - 36, h - 36);

  // Subtle Inner Frame
  ctx.lineWidth = 3;
  ctx.strokeStyle = playableHighlight ? 'rgba(212,175,55,0.65)' : 'rgba(180,164,132,0.45)';
  ctx.strokeRect(42, 42, w - 84, h - 84);

  // Corner Rank & Suit (Top Left)
  ctx.fillStyle = ink;
  ctx.font = 'bold 116px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(card.rank, 92, 54);
  ctx.font = 'bold 96px Georgia, serif';
  ctx.fillText(sym, 92, 174);

  // Center emblem
  ctx.font = card.rank === 'A' ? 'bold 340px Georgia, serif' : 'bold 280px Georgia, serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(sym, w / 2, h / 2 + 16);

  if (card.rank === 'A') {
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 16, 200, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') {
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 8;
    ctx.strokeRect(148, 224, w - 296, h - 448);
    ctx.strokeStyle = 'rgba(212,175,55,0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(166, 242, w - 332, h - 484);

    ctx.fillStyle = '#8b6310';
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText(card.rank === 'K' ? 'KING' : card.rank === 'Q' ? 'QUEEN' : 'JACK', w / 2, 294);
  }

  // Inverted Bottom Corner
  ctx.save();
  ctx.translate(w - 92, h - 54);
  ctx.rotate(Math.PI);
  ctx.fillStyle = ink;
  ctx.font = 'bold 116px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(card.rank, 0, 0);
  ctx.font = 'bold 96px Georgia, serif';
  ctx.fillText(sym, 0, 120);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function createCardBackTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 768;
  const h = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#073b22';
  ctx.fillRect(0, 0, w, h);

  // Diagonal guilloche gold lattice
  ctx.strokeStyle = 'rgba(255, 215, 106, 0.14)';
  ctx.lineWidth = 3;
  for (let i = -h; i < w + h; i += 36) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + h, h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i + h, 0);
    ctx.lineTo(i, h);
    ctx.stroke();
  }

  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 18;
  ctx.strokeRect(36, 36, w - 72, h - 72);

  ctx.strokeStyle = 'rgba(255,215,106,0.5)';
  ctx.lineWidth = 6;
  ctx.strokeRect(68, 68, w - 136, h - 136);

  // Center Gold Diamond Medallion
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.moveTo(w / 2, h / 2 - 150);
  ctx.lineTo(w / 2 + 120, h / 2);
  ctx.lineTo(w / 2, h / 2 + 150);
  ctx.lineTo(w / 2 - 120, h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#fff3b0';
  ctx.stroke();

  ctx.fillStyle = '#073b22';
  ctx.font = 'bold 68px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('256', w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function createTableFeltCrestTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const S = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(S / 2, S / 2, 80, S / 2, S / 2, S / 2);
  grad.addColorStop(0, '#0f6e40');
  grad.addColorStop(0.62, '#063d23');
  grad.addColorStop(1, '#021b0f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  // Double gold inner table oval track lines
  ctx.strokeStyle = 'rgba(255,215,106,0.48)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(S / 2, S / 2, 800, 640, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,215,106,0.24)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(S / 2, S / 2, 760, 600, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Center table medallion ring
  ctx.strokeStyle = 'rgba(255,215,106,0.22)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 230, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,215,106,0.62)';
  ctx.font = 'bold 76px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('UGANDAN MATATU', S / 2, 285);

  ctx.font = 'bold 48px Georgia, serif';
  ctx.fillStyle = 'rgba(255,215,106,0.5)';
  ctx.fillText('CASINO ROYALE · 256', S / 2, S - 265);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function createCasinoChipTexture(
  maxAnisotropy: number,
  bodyColor: string,
  stripeColor: string,
  label: string
): THREE.CanvasTexture {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bodyColor;
  ctx.fillRect(0, 0, S, S);

  // Outer dashed stripes
  ctx.strokeStyle = stripeColor;
  ctx.lineWidth = 42;
  ctx.setLineDash([48, 36]);
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.43, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Center emblem circle
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = '#fdf8ea';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#d4af37';
  ctx.stroke();

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 62px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, S / 2, S / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function buildMatatuBusMini(
  yellowMat: THREE.Material,
  greenMat: THREE.Material,
  glassMat: THREE.Material,
  wheelMat: THREE.Material,
  brassMat: THREE.Material,
  headlightMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T
): THREE.Group {
  const bus = new THREE.Group();

  const body = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(1.24, 0.46, 0.58, 4, 0.05)),
    yellowMat
  );
  body.position.y = 0.31;
  body.castShadow = true;
  bus.add(body);

  const stripe = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(1.26, 0.10, 0.60, 2, 0.02)),
    greenMat
  );
  stripe.position.y = 0.23;
  bus.add(stripe);

  const cabinWindow = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(1.02, 0.16, 0.60, 2, 0.02)),
    glassMat
  );
  cabinWindow.position.set(0.03, 0.41, 0);
  bus.add(cabinWindow);

  // Roof carrier rail
  const roofRack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.82, 0.035, 0.44)), brassMat);
  roofRack.position.set(-0.06, 0.55, 0);
  bus.add(roofRack);

  // Front & rear bumpers
  const bumperGeo = trackGeo(new RoundedBoxGeometry(0.08, 0.07, 0.60, 2, 0.02));
  const frontBumper = new THREE.Mesh(bumperGeo, brassMat);
  frontBumper.position.set(0.62, 0.14, 0);
  bus.add(frontBumper);
  const rearBumper = new THREE.Mesh(bumperGeo, brassMat);
  rearBumper.position.set(-0.62, 0.14, 0);
  bus.add(rearBumper);

  // Dual glowing headlights
  const lampGeo = trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 14));
  lampGeo.rotateZ(Math.PI / 2);
  for (const lz of [-0.18, 0.18]) {
    const lamp = new THREE.Mesh(lampGeo, headlightMat);
    lamp.position.set(0.62, 0.25, lz);
    bus.add(lamp);
  }

  // Tires + Brass Hubcaps
  const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.115, 0.115, 0.09, 20));
  wheelGeo.rotateX(Math.PI / 2);
  const hubGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.098, 16));
  hubGeo.rotateX(Math.PI / 2);
  for (const [wx, wz] of [
    [-0.38, 0.29],
    [-0.38, -0.29],
    [0.38, 0.29],
    [0.38, -0.29],
  ]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.115, wz);
    w.castShadow = true;
    bus.add(w);

    const hub = new THREE.Mesh(hubGeo, brassMat);
    hub.position.set(wx, 0.115, wz);
    bus.add(hub);
  }

  return bus;
}

export const ThreeMatatuTable: React.FC<ThreeMatatuTableProps> = ({
  gameState,
  viewerUid,
  isYourTurn,
  playableCardIds,
  onCardClick,
  onDrawCard,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onCardClickRef = useRef(onCardClick);
  onCardClickRef.current = onCardClick;
  const onDrawCardRef = useRef(onDrawCard);
  onDrawCardRef.current = onDrawCard;

  const [cameraPreset, setCameraPreset] = useState<CameraPresetKey>('default');
  const [webglError, setWebglError] = useState(false);

  const sceneSyncRef = useRef<(() => void) | null>(null);
  const camTransitionRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: new THREE.Vector3(0, 8.2, 9.6),
    target: new THREE.Vector3(0, 0.25, 0.2),
  });

  const latestPropsRef = useRef({
    gameState,
    viewerUid,
    isYourTurn,
    playableCardIds,
  });
  latestPropsRef.current = {
    gameState,
    viewerUid,
    isYourTurn,
    playableCardIds,
  };

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    let rig: ReturnType<typeof createStudioRig>;
    try {
      rig = createStudioRig(el, {
        backgroundHex: 0x04120b,
        fogHex: 0x04120b,
        fogDensity: 0.004,
        fov: 42,
        minAspect: 1.42,
        shadowBounds: 9,
        initialCamera: [0, 8.2, 9.6],
        initialTarget: [0, 0.25, 0.2],
        minDistance: 4.5,
        maxDistance: 22,
        roomTheme: 'matatu',
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

    // Build Grounded 3D Studio Plinth & Contact Shadow
    const bgRoom = buildLuxuryRoomEnvironment(rig, {
      theme: 'matatu',
      tableBottomY: -0.5,
      floorY: -1.95,
      pedestalScale: 1.25,
    });

    const mahoganyTex = trackTexture(createMahoganyTexture(maxAniso, '#421e0d', '#1b0903'));
    const feltTex = trackTexture(createFeltTexture(maxAniso));
    const crestTex = trackTexture(createTableFeltCrestTexture(maxAniso));
    const cardBackTex = trackTexture(createCardBackTexture(maxAniso));
    const greenChipTex = trackTexture(createCasinoChipTexture(maxAniso, '#0b6e39', '#ffffff', '500'));
    const goldChipTex = trackTexture(createCasinoChipTexture(maxAniso, '#c89b24', '#1f2937', '1K'));

    const mahoganyMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        map: mahoganyTex,
        roughness: 0.28,
        metalness: 0.08,
        clearcoat: 0.55,
        clearcoatRoughness: 0.18,
      })
    );
    const leatherRailMat = trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x171210, roughness: 0.42, metalness: 0.08 })
    );
    const brassMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({ color: 0xd4af37, roughness: 0.2, metalness: 0.9, clearcoat: 0.5 })
    );
    const feltMat = trackMaterial(
      new THREE.MeshStandardMaterial({ map: crestTex, bumpMap: feltTex, bumpScale: 0.015, roughness: 0.86 })
    );
    const cardBackMat = trackMaterial(
      new THREE.MeshStandardMaterial({ map: cardBackTex, roughness: 0.3 })
    );
    const cardEdgeMat = trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0xe7decb, roughness: 0.42 })
    );

    const busYellowMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({ color: 0xfacc15, roughness: 0.22, clearcoat: 0.65 })
    );
    const busGreenMat = trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x0e6e3b, roughness: 0.38 })
    );
    const glassMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({ color: 0x1e293b, roughness: 0.1, metalness: 0.35, clearcoat: 0.95 })
    );
    const wheelMat = trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 })
    );
    const headlightMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xfff8dc,
        emissive: 0xffe484,
        emissiveIntensity: 1.5,
      })
    );

    const chipGreenMat = trackMaterial(
      new THREE.MeshStandardMaterial({ map: greenChipTex, roughness: 0.28 })
    );
    const chipGoldMat = trackMaterial(
      new THREE.MeshStandardMaterial({ map: goldChipTex, roughness: 0.22, metalness: 0.4 })
    );

    // Octagonal Mahogany Casino Table Base + Padded Leather Rail + Emerald Felt Surface
    const tableBase = new THREE.Mesh(
      trackGeometry(new THREE.CylinderGeometry(5.9, 6.2, 0.52, 8)),
      mahoganyMat
    );
    tableBase.scale.set(1.18, 1, 0.86);
    tableBase.position.y = -0.25;
    tableBase.castShadow = true;
    tableBase.receiveShadow = true;
    scene.add(tableBase);

    const paddedRail = new THREE.Mesh(
      trackGeometry(new THREE.TorusGeometry(5.55, 0.34, 18, 8)),
      leatherRailMat
    );
    paddedRail.rotation.x = Math.PI / 2;
    paddedRail.rotation.z = Math.PI / 8;
    paddedRail.scale.set(1.18, 0.86, 1);
    paddedRail.position.y = 0.08;
    paddedRail.castShadow = true;
    scene.add(paddedRail);

    const goldInlay = new THREE.Mesh(
      trackGeometry(new THREE.TorusGeometry(5.12, 0.055, 12, 8)),
      brassMat
    );
    goldInlay.rotation.x = Math.PI / 2;
    goldInlay.rotation.z = Math.PI / 8;
    goldInlay.scale.set(1.18, 0.86, 1);
    goldInlay.position.y = 0.05;
    scene.add(goldInlay);

    const feltSurface = new THREE.Mesh(
      trackGeometry(new THREE.CylinderGeometry(5.18, 5.18, 0.06, 8)),
      feltMat
    );
    feltSurface.rotation.y = Math.PI / 8;
    feltSurface.scale.set(1.18, 1, 0.86);
    feltSurface.position.y = 0.01;
    feltSurface.receiveShadow = true;
    scene.add(feltSurface);

    // 3D Matatu 256 Bus sitting on right table edge (flips with gameState.direction)
    const matatuBus = buildMatatuBusMini(
      busYellowMat,
      busGreenMat,
      glassMat,
      wheelMat,
      brassMat,
      headlightMat,
      trackGeometry
    );
    matatuBus.position.set(3.45, 0.04, -0.35);
    scene.add(matatuBus);

    // Brass Dealer Medallion Puck
    const dealerPuck = new THREE.Mesh(
      trackGeometry(new THREE.CylinderGeometry(0.32, 0.34, 0.08, 24)),
      brassMat
    );
    dealerPuck.position.set(-2.55, 0.08, 0.65);
    dealerPuck.castShadow = true;
    scene.add(dealerPuck);

    // 3D Poker Chip Stacks beside Pot
    const chipsGroup = new THREE.Group();
    chipsGroup.position.set(-3.35, 0.04, -0.5);
    const chipGeo = trackGeometry(new THREE.CylinderGeometry(0.28, 0.28, 0.065, 28));
    for (let i = 0; i < 6; i += 1) {
      const c = new THREE.Mesh(chipGeo, i % 2 === 0 ? chipGreenMat : chipGoldMat);
      c.position.y = 0.033 + i * 0.068;
      c.castShadow = true;
      chipsGroup.add(c);
    }
    for (let i = 0; i < 4; i += 1) {
      const c = new THREE.Mesh(chipGeo, i % 2 === 0 ? chipGoldMat : chipGreenMat);
      c.position.set(0.62, 0.033 + i * 0.068, 0.24);
      c.castShadow = true;
      chipsGroup.add(c);
    }
    scene.add(chipsGroup);

    // Card Geometry shared across deck/discard/hands
    const cardGeo = trackGeometry(new THREE.BoxGeometry(1.18, 0.026, 1.68));
    const cardFaceCache = new Map<string, THREE.MeshStandardMaterial>();

    const getCardFaceMaterial = (card: PlayingCardType, highlight: boolean) => {
      const key = `${card.rank}_${card.suit}_${highlight ? 'hi' : 'std'}`;
      let mat = cardFaceCache.get(key);
      if (!mat) {
        const tex = trackTexture(createCardFaceTexture(card, maxAniso, highlight));
        mat = trackMaterial(
          new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.28,
            emissive: highlight ? new THREE.Color(0x4a3a08) : new THREE.Color(0x000000),
            emissiveIntensity: highlight ? 0.32 : 0,
          })
        );
        cardFaceCache.set(key, mat);
      }
      return mat;
    };

    const dynamicCardsGroup = new THREE.Group();
    scene.add(dynamicCardsGroup);
    const clickableObjects: THREE.Object3D[] = [];

    const syncTable = () => {
      const { gameState: gs, viewerUid: uid, isYourTurn: yourTurn, playableCardIds: playableIds } =
        latestPropsRef.current;

      dynamicCardsGroup.clear();
      clickableObjects.length = 0;

      // Orient Matatu 256 Bus based on play direction
      matatuBus.rotation.y = gs.direction === -1 ? Math.PI : 0;

      // 1. 3D Draw Deck Stack (Left Center)
      const deckCards = Math.max(1, Math.min(10, Math.ceil((gs.deckCount || 52) / 4)));
      for (let i = 0; i < deckCards; i += 1) {
        const m = new THREE.Mesh(cardGeo, [
          cardEdgeMat,
          cardEdgeMat,
          cardBackMat,
          cardEdgeMat,
          cardEdgeMat,
          cardEdgeMat,
        ]);
        m.position.set(-1.15, 0.055 + i * 0.028, -0.15);
        m.rotation.y = 0.06;
        m.castShadow = true;
        m.userData = { action: gs.status === 'waiting' ? 'noop' : 'draw' };
        dynamicCardsGroup.add(m);
        if (i === deckCards - 1 && gs.status !== 'waiting') clickableObjects.push(m);
      }

      if (gs.status === 'waiting') {
        const showcaseCards: PlayingCardType[] = [
          { id: 'royale_as', rank: 'A', suit: 'spades' },
          { id: 'royale_kh', rank: 'K', suit: 'hearts' },
          { id: 'royale_qc', rank: 'Q', suit: 'clubs' },
          { id: 'royale_jd', rank: 'J', suit: 'diamonds' },
        ];
        showcaseCards.forEach((card, idx) => {
          const offsetX = (idx - 1.5) * 0.85 + 0.55;
          const faceMat = getCardFaceMaterial(card, true);
          const mesh = new THREE.Mesh(cardGeo, [
            cardEdgeMat,
            cardEdgeMat,
            faceMat,
            cardBackMat,
            cardEdgeMat,
            cardEdgeMat,
          ]);
          mesh.position.set(offsetX, 0.72, 1.35 + idx * 0.01);
          mesh.rotation.x = 0.72;
          mesh.rotation.z = -(idx - 1.5) * 0.12;
          mesh.castShadow = true;
          dynamicCardsGroup.add(mesh);
        });
      } else {
        // 2. 3D Discard Pile (Center)
        if (gs.discardCount > 1) {
          const under = new THREE.Mesh(cardGeo, cardEdgeMat);
          under.position.set(0.85, 0.055, -0.15);
          under.rotation.y = -0.18;
          under.castShadow = true;
          dynamicCardsGroup.add(under);
        }
        if (gs.topDiscard) {
          const topMat = getCardFaceMaterial(gs.topDiscard, false);
          const topCard = new THREE.Mesh(cardGeo, [
            cardEdgeMat,
            cardEdgeMat,
            topMat,
            cardBackMat,
            cardEdgeMat,
            cardEdgeMat,
          ]);
          topCard.position.set(0.9, 0.09, -0.15);
          topCard.rotation.y = 0.05;
          topCard.castShadow = true;
          dynamicCardsGroup.add(topCard);
        }

        // 3. 3D Opponent Fanned Hand across top edge
        const opponent = gs.seats.find((s) => s.uid !== uid);
        const oppCount = Math.min(10, Math.max(0, opponent?.cardCount || 0));
        for (let i = 0; i < oppCount; i += 1) {
          const spread = (i - (oppCount - 1) / 2) * 0.42;
          const c = new THREE.Mesh(cardGeo, [
            cardEdgeMat,
            cardEdgeMat,
            cardBackMat,
            cardBackMat,
            cardEdgeMat,
            cardEdgeMat,
          ]);
          c.position.set(spread, 0.55, -2.85 - Math.abs(spread) * 0.05);
          c.rotation.x = Math.PI / 2 - 0.35;
          c.rotation.z = -spread * 0.08;
          c.castShadow = true;
          dynamicCardsGroup.add(c);
        }

        // 4. 3D Player Hand along front edge facing viewer
        const hand = gs.yourHand || [];
        const n = hand.length;
        const step = n > 7 ? 0.62 : 0.85;
        hand.forEach((card, idx) => {
          const playable = yourTurn && playableIds.has(card.id);
          const offsetX = (idx - (n - 1) / 2) * step;
          const faceMat = getCardFaceMaterial(card, playable);
          const mesh = new THREE.Mesh(cardGeo, [
            cardEdgeMat,
            cardEdgeMat,
            faceMat,
            cardBackMat,
            cardEdgeMat,
            cardEdgeMat,
          ]);
          mesh.position.set(
            offsetX,
            playable ? 0.92 : 0.72,
            2.65 + idx * 0.006
          );
          mesh.rotation.x = 0.88;
          mesh.rotation.z = -offsetX * 0.04;
          mesh.castShadow = true;
          mesh.userData = { action: 'play', card, playable };
          dynamicCardsGroup.add(mesh);
          clickableObjects.push(mesh);
        });
      }

      requestRender();
    };

    sceneSyncRef.current = syncTable;

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

      const hits = raycaster.intersectObjects(clickableObjects, false);
      if (hits.length > 0) {
        const data = hits[0].object.userData as {
          action?: string;
          card?: PlayingCardType;
          playable?: boolean;
        };
        if (data.action === 'draw' && latestPropsRef.current.isYourTurn) {
          onDrawCardRef.current();
        } else if (data.action === 'play' && data.card && data.playable) {
          onCardClickRef.current(data.card);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const ro = new ResizeObserver(() => {
      const w = Math.max(320, el.clientWidth);
      const h = Math.max(260, el.clientHeight);
      fitCameraFovForAspect(camera, 42, w, h, 1.42);
      renderer.setSize(w, h, false);
      requestRender();
    });
    ro.observe(el);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    syncTable();

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
  }, [gameState, viewerUid, isYourTurn, playableCardIds]);

  useEffect(() => {
    if (cameraPreset === 'overhead') {
      camTransitionRef.current.pos.set(0, 12.2, 2.2);
      camTransitionRef.current.target.set(0, 0.2, 0.2);
    } else if (cameraPreset === 'dramatic') {
      camTransitionRef.current.pos.set(4.5, 5.1, 8.8);
      camTransitionRef.current.target.set(0, 0.25, 0.2);
    } else {
      camTransitionRef.current.pos.set(0, 8.2, 9.6);
      camTransitionRef.current.target.set(0, 0.25, 0.2);
    }
    camTransitionRef.current.active = true;
    sceneSyncRef.current?.();
  }, [cameraPreset]);

  const activeSuitSymbol = SUIT_SYMBOLS[gameState.activeSuit];
  const activeSuitLabel = SUIT_LABELS[gameState.activeSuit];
  const isRedSuit = gameState.activeSuit === 'hearts' || gameState.activeSuit === 'diamonds';

  if (webglError) {
    return (
      <div className="w-full h-[360px] rounded-xl border border-[#D4AF37]/40 bg-[#052315] flex items-center justify-center p-6 text-center text-xs text-neutral-300">
        3D WebGL context unavailable on this device. Use the card hand bar below to play.
      </div>
    );
  }

  return (
    <div className="w-full space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-200">
          <span>
            Active Suit:{' '}
            <strong className={isRedSuit ? 'text-red-400' : 'text-[#FFD76A]'}>
              {activeSuitSymbol} {activeSuitLabel}
            </strong>
          </span>
          <span className="text-neutral-500">·</span>
          <span>Click 3D Deck to draw or click highlighted 3D Cards to play · Drag to orbit</span>
        </div>

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
        className={`relative w-full overflow-hidden rounded-[20px] border-2 border-[#C99B27]/80 bg-[#04120B] shadow-[0_28px_60px_rgba(0,0,0,0.9)] ${
          isFullscreen ? 'h-[calc(100dvh-225px)] min-h-[500px]' : 'h-[480px] sm:h-[580px] lg:h-[620px]'
        }`}
      >
        <img
          src={proBgMatatu}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(3,10,6,0.56)_100%)]"
        />
        <div ref={mountRef} className="relative z-10 h-full w-full" />
      </div>
    </div>
  );
};

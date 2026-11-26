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
import type { CardDeckVariant } from '../PlayingCard';
import proBgMatatu from '../../assets/images/pro_bg_matatu_1794922549602.jpg';
import type { PlayingCard as PlayingCardType, SanitizedGameState, Suit } from '../../shared/types';

interface ThreeMatatuTableProps {
  gameState: SanitizedGameState;
  viewerUid: string;
  isYourTurn: boolean;
  playableCardIds: Set<string>;
  variant?: CardDeckVariant;
  onCardClick: (card: PlayingCardType) => void;
  onDrawCard: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const _vCamPos = new THREE.Vector3();
const _vTarget = new THREE.Vector3();

interface CanvasPipCoord {
  x: number;
  y: number;
  invert?: boolean;
}

// Normalized coordinates inside inner card field (0..1 x, 0..1 y)
const CANVAS_PIP_LAYOUTS: Record<string, CanvasPipCoord[]> = {
  '2': [
    { x: 0.5, y: 0.21 },
    { x: 0.5, y: 0.79, invert: true },
  ],
  '3': [
    { x: 0.5, y: 0.19 },
    { x: 0.5, y: 0.5 },
    { x: 0.5, y: 0.81, invert: true },
  ],
  '4': [
    { x: 0.31, y: 0.21 },
    { x: 0.69, y: 0.21 },
    { x: 0.31, y: 0.79, invert: true },
    { x: 0.69, y: 0.79, invert: true },
  ],
  '5': [
    { x: 0.31, y: 0.21 },
    { x: 0.69, y: 0.21 },
    { x: 0.5, y: 0.5 },
    { x: 0.31, y: 0.79, invert: true },
    { x: 0.69, y: 0.79, invert: true },
  ],
  '6': [
    { x: 0.31, y: 0.2 },
    { x: 0.69, y: 0.2 },
    { x: 0.31, y: 0.5 },
    { x: 0.69, y: 0.5 },
    { x: 0.31, y: 0.8, invert: true },
    { x: 0.69, y: 0.8, invert: true },
  ],
  '7': [
    { x: 0.31, y: 0.2 },
    { x: 0.69, y: 0.2 },
    { x: 0.5, y: 0.35 },
    { x: 0.31, y: 0.5 },
    { x: 0.69, y: 0.5 },
    { x: 0.31, y: 0.8, invert: true },
    { x: 0.69, y: 0.8, invert: true },
  ],
  '8': [
    { x: 0.31, y: 0.2 },
    { x: 0.69, y: 0.2 },
    { x: 0.5, y: 0.35 },
    { x: 0.31, y: 0.5 },
    { x: 0.69, y: 0.5 },
    { x: 0.5, y: 0.65, invert: true },
    { x: 0.31, y: 0.8, invert: true },
    { x: 0.69, y: 0.8, invert: true },
  ],
  '9': [
    { x: 0.31, y: 0.17 },
    { x: 0.69, y: 0.17 },
    { x: 0.31, y: 0.39 },
    { x: 0.69, y: 0.39 },
    { x: 0.5, y: 0.5 },
    { x: 0.31, y: 0.61, invert: true },
    { x: 0.69, y: 0.61, invert: true },
    { x: 0.31, y: 0.83, invert: true },
    { x: 0.69, y: 0.83, invert: true },
  ],
  '10': [
    { x: 0.31, y: 0.17 },
    { x: 0.69, y: 0.17 },
    { x: 0.5, y: 0.28 },
    { x: 0.31, y: 0.39 },
    { x: 0.69, y: 0.39 },
    { x: 0.31, y: 0.61, invert: true },
    { x: 0.69, y: 0.61, invert: true },
    { x: 0.5, y: 0.72, invert: true },
    { x: 0.31, y: 0.83, invert: true },
    { x: 0.69, y: 0.83, invert: true },
  ],
};

function traceSuitShape(ctx: CanvasRenderingContext2D, suit: Suit, size: number) {
  const s = size / 10;
  ctx.beginPath();
  if (suit === 'spades') {
    ctx.moveTo(0, -8.8 * s);
    ctx.bezierCurveTo(-3.8 * s, -4.4 * s, -7.8 * s, -1.3 * s, -7.8 * s, 2.4 * s);
    ctx.bezierCurveTo(-7.8 * s, 5.2 * s, -5.5 * s, 6.8 * s, -3.1 * s, 6.8 * s);
    ctx.bezierCurveTo(-1.7 * s, 6.8 * s, -0.7 * s, 6.1 * s, -0.3 * s, 5.2 * s);
    ctx.lineTo(-2.3 * s, 8.8 * s);
    ctx.lineTo(2.3 * s, 8.8 * s);
    ctx.lineTo(0.3 * s, 5.2 * s);
    ctx.bezierCurveTo(0.7 * s, 6.1 * s, 1.7 * s, 6.8 * s, 3.1 * s, 6.8 * s);
    ctx.bezierCurveTo(5.5 * s, 6.8 * s, 7.8 * s, 5.2 * s, 7.8 * s, 2.4 * s);
    ctx.bezierCurveTo(7.8 * s, -1.3 * s, 3.8 * s, -4.4 * s, 0, -8.8 * s);
  } else if (suit === 'hearts') {
    ctx.moveTo(0, 8.2 * s);
    ctx.bezierCurveTo(-0.4 * s, 7.8 * s, -8.2 * s, 2.2 * s, -8.2 * s, -2.6 * s);
    ctx.bezierCurveTo(-8.2 * s, -5.8 * s, -5.6 * s, -8.0 * s, -2.7 * s, -8.0 * s);
    ctx.bezierCurveTo(-1.1 * s, -8.0 * s, -0.2 * s, -7.0 * s, 0, -5.6 * s);
    ctx.bezierCurveTo(0.2 * s, -7.0 * s, 1.1 * s, -8.0 * s, 2.7 * s, -8.0 * s);
    ctx.bezierCurveTo(5.6 * s, -8.0 * s, 8.2 * s, -5.8 * s, 8.2 * s, -2.6 * s);
    ctx.bezierCurveTo(8.2 * s, 2.2 * s, 0.4 * s, 7.8 * s, 0, 8.2 * s);
  } else if (suit === 'diamonds') {
    ctx.moveTo(0, -9.0 * s);
    ctx.lineTo(6.9 * s, 0);
    ctx.lineTo(0, 9.0 * s);
    ctx.lineTo(-6.9 * s, 0);
  } else {
    ctx.moveTo(0, -8.5 * s);
    ctx.bezierCurveTo(-2.3 * s, -8.5 * s, -4.0 * s, -6.7 * s, -4.0 * s, -4.5 * s);
    ctx.bezierCurveTo(-4.0 * s, -3.2 * s, -3.4 * s, -2.1 * s, -2.4 * s, -1.4 * s);
    ctx.bezierCurveTo(-4.8 * s, -1.7 * s, -7.6 * s, -0.2 * s, -7.6 * s, 2.5 * s);
    ctx.bezierCurveTo(-7.6 * s, 4.9 * s, -5.6 * s, 6.6 * s, -3.3 * s, 6.6 * s);
    ctx.bezierCurveTo(-1.8 * s, 6.6 * s, -0.7 * s, 5.7 * s, -0.3 * s, 4.6 * s);
    ctx.lineTo(-2.1 * s, 8.6 * s);
    ctx.lineTo(2.1 * s, 8.6 * s);
    ctx.lineTo(0.3 * s, 4.6 * s);
    ctx.bezierCurveTo(0.7 * s, 5.7 * s, 1.8 * s, 6.6 * s, 3.3 * s, 6.6 * s);
    ctx.bezierCurveTo(5.6 * s, 6.6 * s, 7.6 * s, 4.9 * s, 7.6 * s, 2.5 * s);
    ctx.bezierCurveTo(7.6 * s, -0.2 * s, 4.8 * s, -1.7 * s, 2.4 * s, -1.4 * s);
    ctx.bezierCurveTo(3.4 * s, -2.1 * s, 4.0 * s, -3.2 * s, 4.0 * s, -4.5 * s);
    ctx.bezierCurveTo(4.0 * s, -6.7 * s, 2.3 * s, -8.5 * s, 0, -8.5 * s);
  }
  ctx.closePath();
}

function drawSuitVector(
  ctx: CanvasRenderingContext2D,
  suit: Suit,
  x: number,
  y: number,
  size: number,
  options: {
    fill: string | CanvasGradient;
    stroke?: string;
    lineWidth?: number;
    invert?: boolean;
    facetRuby?: boolean;
  }
) {
  ctx.save();
  ctx.translate(x, y);
  if (options.invert) ctx.rotate(Math.PI);
  traceSuitShape(ctx, suit, size);
  ctx.fillStyle = options.fill;
  ctx.fill();
  if (options.facetRuby && suit === 'diamonds') {
    const s = size / 10;
    ctx.beginPath();
    ctx.moveTo(0, -8.6 * s);
    ctx.lineTo(3.3 * s, 0);
    ctx.lineTo(0, 8.6 * s);
    ctx.lineTo(-3.3 * s, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(254, 202, 202, 0.28)';
    ctx.fill();
  }
  if (options.stroke && options.lineWidth) {
    traceSuitShape(ctx, suit, size);
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = options.lineWidth;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

function drawRoyalCrown(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  const crownGrad = ctx.createLinearGradient(-45, -35, 45, 25);
  crownGrad.addColorStop(0, '#FFF6BE');
  crownGrad.addColorStop(0.5, '#FFD76A');
  crownGrad.addColorStop(1, '#B48218');
  ctx.fillStyle = crownGrad;
  ctx.strokeStyle = '#735109';
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-42, 20);
  ctx.lineTo(-34, -22);
  ctx.lineTo(-15, -2);
  ctx.lineTo(0, -34);
  ctx.lineTo(15, -2);
  ctx.lineTo(34, -22);
  ctx.lineTo(42, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#B91C1C';
  ctx.beginPath();
  ctx.arc(0, 9, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.arc(-20, 9, 4.2, 0, Math.PI * 2);
  ctx.arc(20, 9, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCourtHalfIllustration(
  ctx: CanvasRenderingContext2D,
  rank: 'J' | 'Q' | 'K',
  suit: Suit,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  mirrored: boolean,
  isBlitzObsidian: boolean
) {
  const isRed = suit === 'hearts' || suit === 'diamonds';
  const robePrimary =
    rank === 'K'
      ? isRed
        ? '#9E1B1E'
        : '#172554'
      : rank === 'Q'
      ? isRed
        ? '#881337'
        : '#0F172A'
      : isRed
      ? '#991B1B'
      : '#1E3A8A';
  const robeSecondary = rank === 'K' ? '#D97706' : rank === 'Q' ? '#B91C1C' : '#047857';
  const foilGold = '#D4AF37';

  ctx.save();
  ctx.beginPath();
  ctx.rect(boxX, boxY, boxW, boxH / 2);
  ctx.clip();

  if (mirrored) {
    ctx.translate(boxX + boxW / 2, boxY + boxH / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-(boxX + boxW / 2), -(boxY + boxH / 2));
  }

  const cx = boxX + boxW / 2;
  const halfBottom = boxY + boxH / 2;
  const u = boxW / 44;

  // Tapestry Backdrop
  ctx.fillStyle = isBlitzObsidian ? '#101C16' : '#FCF3DB';
  ctx.fillRect(boxX, boxY, boxW, boxH / 2);
  ctx.fillStyle = isBlitzObsidian ? 'rgba(255,215,106,0.06)' : 'rgba(180,130,30,0.08)';
  ctx.beginPath();
  ctx.arc(cx, boxY + 18 * u, 16 * u, 0, Math.PI * 2);
  ctx.fill();

  // Royal Robe & Shoulders
  ctx.fillStyle = robePrimary;
  ctx.strokeStyle = foilGold;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(boxX + 1.5 * u, halfBottom);
  ctx.bezierCurveTo(boxX + 3 * u, halfBottom - 13 * u, boxX + 14 * u, halfBottom - 14 * u, cx, halfBottom - 13.5 * u);
  ctx.bezierCurveTo(boxX + 30 * u, halfBottom - 14 * u, boxX + 41 * u, halfBottom - 13 * u, boxX + 42.5 * u, halfBottom);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Ermine Collar
  ctx.fillStyle = '#FFFDF5';
  ctx.strokeStyle = foilGold;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx - 11 * u, halfBottom - 11.2 * u);
  ctx.quadraticCurveTo(cx, halfBottom - 8.2 * u, cx + 11 * u, halfBottom - 11.2 * u);
  ctx.lineTo(cx + 8.5 * u, halfBottom - 6 * u);
  ctx.quadraticCurveTo(cx, halfBottom - 4.5 * u, cx - 8.5 * u, halfBottom - 6 * u);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Ermine spots + Golden Tunic Sash
  ctx.fillStyle = '#1F2937';
  for (const sx of [-6.5, 0, 6.5]) {
    ctx.beginPath();
    ctx.arc(cx + sx * u, halfBottom - 8.2 * u, 0.75 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = robeSecondary;
  ctx.beginPath();
  ctx.moveTo(cx - 7.5 * u, halfBottom);
  ctx.lineTo(cx - 5.2 * u, halfBottom - 6.5 * u);
  ctx.lineTo(cx, halfBottom - 2 * u);
  ctx.lineTo(cx + 5.2 * u, halfBottom - 6.5 * u);
  ctx.lineTo(cx + 7.5 * u, halfBottom);
  ctx.closePath();
  ctx.fill();

  // Sceptre / Royal Staff
  ctx.strokeStyle = foilGold;
  ctx.lineWidth = 4.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(boxX + 7.2 * u, boxY + 9.5 * u);
  ctx.lineTo(boxX + 5.6 * u, halfBottom - 0.5 * u);
  ctx.stroke();
  ctx.fillStyle = '#FFE27A';
  ctx.strokeStyle = '#78530A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(boxX + 7.2 * u, boxY + 8.5 * u, 2.2 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hair Locks
  ctx.fillStyle = rank === 'Q' ? '#451A03' : rank === 'K' ? '#78350F' : '#292524';
  ctx.beginPath();
  ctx.arc(cx, boxY + 18.5 * u, 7.6 * u, Math.PI, 0);
  ctx.lineTo(cx + 7.8 * u, boxY + 25.5 * u);
  ctx.lineTo(cx - 7.8 * u, boxY + 25.5 * u);
  ctx.closePath();
  ctx.fill();

  // Head & Facial Features
  ctx.fillStyle = '#F2C794';
  ctx.strokeStyle = '#7A4E24';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(cx, boxY + 20.5 * u, 5.4 * u, 6.0 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Eyes & Brows
  ctx.fillStyle = '#1F2937';
  ctx.beginPath();
  ctx.arc(cx - 2.0 * u, boxY + 19.6 * u, 0.72 * u, 0, Math.PI * 2);
  ctx.arc(cx + 2.0 * u, boxY + 19.6 * u, 0.72 * u, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#451A03';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 3.3 * u, boxY + 18 * u);
  ctx.quadraticCurveTo(cx - 2 * u, boxY + 17.3 * u, cx - 0.9 * u, boxY + 18 * u);
  ctx.moveTo(cx + 0.9 * u, boxY + 18 * u);
  ctx.quadraticCurveTo(cx + 2 * u, boxY + 17.3 * u, cx + 3.3 * u, boxY + 18 * u);
  ctx.stroke();

  if (rank === 'K') {
    ctx.fillStyle = '#5C2D0C';
    ctx.beginPath();
    ctx.moveTo(cx - 4.9 * u, boxY + 22.2 * u);
    ctx.bezierCurveTo(cx - 4.4 * u, boxY + 26.8 * u, cx - 2 * u, boxY + 28 * u, cx, boxY + 28.2 * u);
    ctx.bezierCurveTo(cx + 2 * u, boxY + 28 * u, cx + 4.4 * u, boxY + 26.8 * u, cx + 4.9 * u, boxY + 22.2 * u);
    ctx.quadraticCurveTo(cx, boxY + 23.6 * u, cx - 4.9 * u, boxY + 22.2 * u);
    ctx.fill();
  } else if (rank === 'Q') {
    ctx.strokeStyle = '#B91C1C';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(cx - 1.6 * u, boxY + 23.8 * u);
    ctx.quadraticCurveTo(cx, boxY + 24.8 * u, cx + 1.6 * u, boxY + 23.8 * u);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#3B1A06';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx - 2.3 * u, boxY + 23.2 * u);
    ctx.quadraticCurveTo(cx, boxY + 22.4 * u, cx + 2.3 * u, boxY + 23.2 * u);
    ctx.stroke();
  }

  // Crown / Tiara / Cap
  if (rank === 'K' || rank === 'Q') {
    drawRoyalCrown(ctx, cx, boxY + 11.8 * u, 0.21 * u);
  } else {
    ctx.fillStyle = robePrimary;
    ctx.strokeStyle = foilGold;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(cx - 8.5 * u, boxY + 15.2 * u);
    ctx.quadraticCurveTo(cx, boxY + 6 * u, cx + 8.5 * u, boxY + 15.2 * u);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#FFD76A';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(cx - 8.5 * u, boxY + 14.5 * u);
    ctx.lineTo(cx + 8.5 * u, boxY + 14.5 * u);
    ctx.stroke();
  }

  // Corner suit pip inside frame
  drawSuitVector(ctx, suit, boxX + boxW - 5.5 * u, boxY + 6.5 * u, 5.2 * u, {
    fill: isRed ? '#B91C1C' : isBlitzObsidian ? '#FFD76A' : '#111827',
  });

  ctx.restore();
}

function createCardFaceTexture(
  card: PlayingCardType,
  maxAnisotropy: number,
  playableHighlight: boolean,
  variant: CardDeckVariant
): THREE.CanvasTexture {
  const w = 1024;
  const h = 1440;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const isBlitz = variant === 'blitz';
  const isBlitzObsidian = isBlitz && !isRed;
  const foilGold = isBlitz ? '#E6B840' : '#D4AF37';
  const ink = isRed ? '#C81E1E' : isBlitzObsidian ? '#FFD86B' : '#0F172A';
  const pipFill = isRed ? (isBlitz ? '#D01920' : '#B91C1C') : isBlitzObsidian ? '#0C140F' : '#111827';

  // Card Stock Base
  const paperGrad = ctx.createLinearGradient(0, 0, w, h);
  if (isBlitzObsidian) {
    paperGrad.addColorStop(0, '#16241C');
    paperGrad.addColorStop(0.5, '#0B120E');
    paperGrad.addColorStop(1, '#040806');
  } else if (isBlitz) {
    paperGrad.addColorStop(0, '#FFFDF7');
    paperGrad.addColorStop(0.55, '#FAF2DC');
    paperGrad.addColorStop(1, '#EEDFB8');
  } else {
    paperGrad.addColorStop(0, '#FFFDF9');
    paperGrad.addColorStop(0.5, '#FBF5E6');
    paperGrad.addColorStop(1, '#F2E9D2');
  }
  ctx.fillStyle = paperGrad;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 56);
  ctx.fill();

  // Subtle linen grain
  ctx.strokeStyle = isBlitzObsidian ? 'rgba(255,215,106,0.03)' : 'rgba(0,0,0,0.02)';
  ctx.lineWidth = 2;
  for (let i = 0; i < w; i += 18) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, h);
    ctx.stroke();
  }

  // Outer Highlight / Gold Rim
  ctx.lineWidth = playableHighlight ? 28 : isBlitz ? 18 : 12;
  ctx.strokeStyle = playableHighlight ? '#9CE800' : isBlitz ? foilGold : '#D5C8AA';
  ctx.strokeRect(24, 24, w - 48, h - 48);

  // Inner Hairline Frame
  ctx.lineWidth = 4;
  ctx.strokeStyle = playableHighlight
    ? 'rgba(156,232,0,0.7)'
    : isBlitz
    ? 'rgba(230,184,64,0.68)'
    : 'rgba(180,156,100,0.48)';
  ctx.strokeRect(56, 56, w - 112, h - 112);

  // Corner Rank & Vector Suit (Top-Left) — Larger high-contrast HD casino typography
  ctx.fillStyle = ink;
  ctx.font = 'bold 168px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(card.rank, 122, 66);
  drawSuitVector(ctx, card.suit, 122, 278, 56, {
    fill: isRed ? '#C81E1E' : isBlitzObsidian ? '#FFD86B' : '#0F172A',
  });

  // Inverted Bottom-Right Corner
  ctx.save();
  ctx.translate(w - 122, h - 66);
  ctx.rotate(Math.PI);
  ctx.fillStyle = ink;
  ctx.font = 'bold 168px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(card.rank, 0, 0);
  drawSuitVector(ctx, card.suit, 0, 212, 56, {
    fill: isRed ? '#C81E1E' : isBlitzObsidian ? '#FFD86B' : '#0F172A',
  });
  ctx.restore();

  // Card Center Art
  if (card.rank === 'A') {
    const cx = w / 2;
    const cy = h / 2 + 12;
    if (card.suit === 'spades') {
      ctx.strokeStyle = foilGold;
      ctx.lineWidth = 8;
      ctx.setLineDash([16, 12]);
      ctx.beginPath();
      ctx.arc(cx, cy, 246, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = isBlitz ? '#0E1913' : '#FAF2D8';
      ctx.strokeStyle = foilGold;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(cx, cy, 210, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      drawRoyalCrown(ctx, cx, cy - 262, 1.48);

      drawSuitVector(ctx, 'spades', cx, cy + 6, 200, {
        fill: '#080C0A',
        stroke: '#F6CF5E',
        lineWidth: 10,
      });

      // Inner Gold Filigree Scrollwork
      ctx.strokeStyle = '#FFE074';
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 104);
      ctx.bezierCurveTo(cx - 42, cy - 52, cx - 64, cy - 12, cx - 32, cy + 32);
      ctx.bezierCurveTo(cx - 12, cy + 52, cx, cy + 32, cx, cy + 16);
      ctx.bezierCurveTo(cx, cy + 32, cx + 12, cy + 52, cx + 32, cy + 32);
      ctx.bezierCurveTo(cx + 64, cy - 12, cx + 42, cy - 52, cx, cy - 104);
      ctx.stroke();

      ctx.fillStyle = isBlitz ? '#FFD76A' : '#7A5A0F';
      ctx.font = 'bold 44px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isBlitz ? 'MATATU BLITZ' : 'CASINO ROYALE', cx, cy + 286);
    } else {
      ctx.fillStyle = isBlitzObsidian ? '#0D1712' : '#FAF3DF';
      ctx.strokeStyle = foilGold;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(cx, cy, 210, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      drawSuitVector(ctx, card.suit, cx, cy, 192, {
        fill: pipFill,
        stroke: isBlitz ? foilGold : undefined,
        lineWidth: isBlitz ? 8 : 0,
        facetRuby: isBlitz && isRed,
      });
    }
  } else if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') {
    const boxX = 192;
    const boxY = 186;
    const boxW = w - 384;
    const boxH = h - 372;

    drawCourtHalfIllustration(ctx, card.rank, card.suit, boxX, boxY, boxW, boxH, false, isBlitzObsidian);
    drawCourtHalfIllustration(ctx, card.rank, card.suit, boxX, boxY, boxW, boxH, true, isBlitzObsidian);

    // Center dividing sash + diamond seal
    ctx.strokeStyle = foilGold;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(boxX, h / 2);
    ctx.lineTo(boxX + boxW, h / 2);
    ctx.stroke();

    ctx.fillStyle = '#FFD76A';
    ctx.strokeStyle = '#735109';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2 - 38);
    ctx.lineTo(w / 2 + 38, h / 2);
    ctx.lineTo(w / 2, h / 2 + 38);
    ctx.lineTo(w / 2 - 38, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ornate Gold Court Frame
    ctx.strokeStyle = foilGold;
    ctx.lineWidth = 11;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = 'rgba(212,175,55,0.5)';
    ctx.lineWidth = 4.5;
    ctx.strokeRect(boxX - 18, boxY - 18, boxW + 36, boxH + 36);
  } else {
    // 2–10 Real Pip Matrix
    const fieldX = 188;
    const fieldY = 166;
    const fieldW = w - 376;
    const fieldH = h - 332;
    const coords = CANVAS_PIP_LAYOUTS[card.rank] || [{ x: 0.5, y: 0.5 }];
    const pipSize =
      card.rank === '9' || card.rank === '10' ? 74 : card.rank === '7' || card.rank === '8' ? 84 : 102;

    if (isBlitz) {
      if (isRed) {
        ctx.save();
        ctx.strokeStyle = 'rgba(212,175,55,0.58)';
        ctx.lineWidth = 4.5;
        ctx.setLineDash([12, 10]);
        ctx.beginPath();
        ctx.arc(w / 2, h / 2 + 40, 128, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        // Blitz electric gold starburst behind black suit pips
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.fillStyle = 'rgba(255, 224, 114, 0.9)';
        ctx.beginPath();
        ctx.moveTo(0, -108);
        ctx.lineTo(19, -20);
        ctx.lineTo(108, 0);
        ctx.lineTo(19, 20);
        ctx.lineTo(0, 108);
        ctx.lineTo(-19, 20);
        ctx.lineTo(-108, 0);
        ctx.lineTo(-19, -20);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    for (const p of coords) {
      drawSuitVector(ctx, card.suit, fieldX + p.x * fieldW, fieldY + p.y * fieldH, pipSize, {
        fill: pipFill,
        stroke: isBlitz ? (isRed ? '#D99B26' : '#F3CA52') : undefined,
        lineWidth: isBlitz ? (isRed ? 5.5 : 8.5) : 0,
        invert: p.invert,
        facetRuby: isBlitz && isRed,
      });
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function createCardBackTexture(maxAnisotropy: number, variant: CardDeckVariant): THREE.CanvasTexture {
  const w = 1024;
  const h = 1440;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const isBlitz = variant === 'blitz';

  ctx.fillStyle = isBlitz ? '#06100B' : '#073b22';
  ctx.fillRect(0, 0, w, h);

  // Fine gold diamond guilloche lattice
  ctx.strokeStyle = isBlitz ? 'rgba(255, 215, 106, 0.20)' : 'rgba(255, 215, 106, 0.14)';
  ctx.lineWidth = 3;
  for (let i = -h; i < w + h; i += 44) {
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
  ctx.lineWidth = 22;
  ctx.strokeRect(46, 46, w - 92, h - 92);

  ctx.strokeStyle = isBlitz ? 'rgba(156,232,0,0.52)' : 'rgba(255,215,106,0.52)';
  ctx.lineWidth = 7;
  ctx.strokeRect(86, 86, w - 172, h - 172);

  // Center Gold Diamond Medallion
  ctx.fillStyle = isBlitz ? '#0C1711' : '#d4af37';
  ctx.beginPath();
  ctx.moveTo(w / 2, h / 2 - 205);
  ctx.lineTo(w / 2 + 160, h / 2);
  ctx.lineTo(w / 2, h / 2 + 205);
  ctx.lineTo(w / 2 - 160, h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#fff3b0';
  ctx.stroke();

  if (isBlitz) {
    // Blitz lightning bolt + 256
    ctx.fillStyle = '#FFD76A';
    ctx.beginPath();
    ctx.moveTo(w / 2 + 30, h / 2 - 110);
    ctx.lineTo(w / 2 - 58, h / 2 + 12);
    ctx.lineTo(w / 2 + 8, h / 2 + 12);
    ctx.lineTo(w / 2 - 30, h / 2 + 110);
    ctx.lineTo(w / 2 + 58, h / 2 - 12);
    ctx.lineTo(w / 2 - 8, h / 2 - 12);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#073b22';
    ctx.font = 'bold 88px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('256', w / 2, h / 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function createTableFeltCrestTexture(
  maxAnisotropy: number,
  variant: CardDeckVariant
): THREE.CanvasTexture {
  const S = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const isBlitz = variant === 'blitz';

  const grad = ctx.createRadialGradient(S / 2, S / 2, 90, S / 2, S / 2, S / 2);
  if (isBlitz) {
    grad.addColorStop(0, '#0C6138');
    grad.addColorStop(0.55, '#05331E');
    grad.addColorStop(1, '#02120A');
  } else {
    grad.addColorStop(0, '#117A46');
    grad.addColorStop(0.58, '#074528');
    grad.addColorStop(1, '#021B0F');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  // Subtle woven diamond damask pattern across the entire HD casino baize
  ctx.strokeStyle = isBlitz ? 'rgba(255,215,106,0.045)' : 'rgba(255,255,255,0.032)';
  ctx.lineWidth = 2;
  const step = 64;
  for (let y = 0; y < S; y += step) {
    for (let x = 0; x < S; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + step / 2, y + 6);
      ctx.lineTo(x + step - 6, y + step / 2);
      ctx.lineTo(x + step / 2, y + step - 6);
      ctx.lineTo(x + 6, y + step / 2);
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Double gold inner table oval track lines
  ctx.strokeStyle = isBlitz ? 'rgba(255,215,106,0.62)' : 'rgba(255,215,106,0.52)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.ellipse(S / 2, S / 2, 810, 650, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = isBlitz ? 'rgba(156,232,0,0.34)' : 'rgba(255,215,106,0.26)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(S / 2, S / 2, 768, 608, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Center table medallion ring + Spade watermark
  ctx.strokeStyle = isBlitz ? 'rgba(255,215,106,0.34)' : 'rgba(255,215,106,0.26)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 236, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.16;
  drawSuitVector(ctx, 'spades', S / 2, S / 2, 130, { fill: '#FFD76A' });
  ctx.restore();

  // Ugandan Flag Accent Bar above title
  const stripeW = 280;
  const stripeH = 6;
  const flagColors = ['#111111', '#FCDC04', '#D90000'];
  flagColors.forEach((c, idx) => {
    ctx.fillStyle = c;
    ctx.fillRect(S / 2 - stripeW / 2, 214 + idx * stripeH, stripeW, stripeH);
  });

  ctx.fillStyle = 'rgba(255,222,120,0.78)';
  ctx.font = 'bold 80px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isBlitz ? 'MATATU BLITZ' : 'UGANDAN MATATU', S / 2, 294);

  ctx.font = 'bold 50px Georgia, serif';
  ctx.fillStyle = isBlitz ? 'rgba(156,232,0,0.68)' : 'rgba(255,215,106,0.58)';
  ctx.fillText(isBlitz ? 'TURBO HIGH-ROLLER · 256' : 'CASINO ROYALE · 256', S / 2, S - 260);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function createCasinoChipTexture(
  maxAnisotropy: number,
  bodyColor: string,
  stripeColor: string,
  topLabel: string
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
  ctx.lineWidth = 44;
  ctx.setLineDash([48, 34]);
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.43, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Gold edge ring
  ctx.strokeStyle = '#FFD76A';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.33, 0, Math.PI * 2);
  ctx.stroke();

  // Center white inlay disc + Ugandan Flag Band matching the Matatu Royale icon chips
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = '#FDF8EA';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#D4AF37';
  ctx.stroke();

  // Ugandan Flag mini band inside bottom half of chip crest
  ctx.save();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.22, 0, Math.PI * 2);
  ctx.clip();
  const bandY = S / 2 + 24;
  ['#111111', '#FCDC04', '#D90000'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(S * 0.25, bandY + i * 11, S * 0.5, 11);
  });
  ctx.restore();

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 46px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(topLabel, S / 2, S / 2 - 14);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function buildLatestRangeRoverSport(
  brassMat: THREE.Material,
  glassMat: THREE.Material,
  wheelMat: THREE.Material,
  headlightMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): THREE.Group {
  const suv = new THREE.Group();

  // Signature 2025/2026 Range Rover Sport L461 SV Materials
  const bodySilverMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xd8dee6, // Hakuba Silver Pearl Metallic
      roughness: 0.18,
      metalness: 0.58,
      clearcoat: 0.96,
      clearcoatRoughness: 0.08,
    })
  );
  const obsidianRoofMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0b0e14, // Gloss Black Contrast Floating Roof & Trim
      roughness: 0.14,
      metalness: 0.45,
      clearcoat: 0.98,
    })
  );
  const graphiteGrilleMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1c222b, roughness: 0.42, metalness: 0.65 })
  );
  const copperSvMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xc87d4b, // Range Rover SV Satin Burnished Copper accents
      roughness: 0.25,
      metalness: 0.85,
      clearcoat: 0.5,
    })
  );
  const alloyMat = trackMat(
    new THREE.MeshPhysicalMaterial({ color: 0xe5e7eb, roughness: 0.14, metalness: 0.94, clearcoat: 0.6 })
  );
  const bremboRedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.3 })
  );
  const tailLedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.6 })
  );
  const plateMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
  );

  // 1. Sleek L461 Lower Body & Clamshell Hood Silhouette (ExtrudeGeometry)
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-0.82, 0.15);
  bodyShape.lineTo(0.84, 0.15);
  bodyShape.lineTo(0.88, 0.28);
  bodyShape.lineTo(0.84, 0.39); // Crisp Range Rover vertical nose
  bodyShape.lineTo(0.41, 0.43); // Long sculpted clamshell bonnet
  bodyShape.lineTo(0.16, 0.61); // Sleek raked A-pillar slope
  bodyShape.lineTo(-0.56, 0.59); // Gentle L461 fastback roofline slope
  bodyShape.lineTo(-0.84, 0.42); // Sporty angled tailgate
  bodyShape.lineTo(-0.86, 0.24);
  bodyShape.closePath();

  const mainShellGeo = trackGeo(
    new THREE.ExtrudeGeometry(bodyShape, {
      depth: 0.72,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.025,
      bevelSegments: 4,
    })
  );
  mainShellGeo.translate(0, 0, -0.36);
  const mainShell = new THREE.Mesh(mainShellGeo, bodySilverMat);
  mainShell.castShadow = true;
  mainShell.receiveShadow = true;
  suv.add(mainShell);

  // 2. Gloss Black Contrast Floating Roof Cap + Panoramic Sunroof Glass
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-0.58, 0.575);
  roofShape.lineTo(0.18, 0.595);
  roofShape.lineTo(0.13, 0.64);
  roofShape.lineTo(-0.56, 0.625);
  roofShape.lineTo(-0.67, 0.575);
  roofShape.closePath();

  const roofGeo = trackGeo(
    new THREE.ExtrudeGeometry(roofShape, {
      depth: 0.64,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 3,
    })
  );
  roofGeo.translate(0, 0, -0.32);
  const roofCap = new THREE.Mesh(roofGeo, obsidianRoofMat);
  roofCap.castShadow = true;
  suv.add(roofCap);

  // Tinted Panoramic Sunroof Glass Panel
  const panoRoof = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.56, 0.02, 0.46, 2, 0.008)),
    glassMat
  );
  panoRoof.position.set(-0.22, 0.64, 0);
  panoRoof.rotation.z = -0.025;
  suv.add(panoRoof);

  // Roof-edge Twin Gloss Black Spoiler Lip + Shark-Fin Antenna
  const spoiler = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.14, 0.035, 0.60, 2, 0.01)),
    obsidianRoofMat
  );
  spoiler.position.set(-0.63, 0.595, 0);
  spoiler.rotation.z = 0.16;
  suv.add(spoiler);

  const sharkFin = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.09, 0.045, 0.03, 2, 0.008)),
    obsidianRoofMat
  );
  sharkFin.position.set(-0.46, 0.655, 0);
  suv.add(sharkFin);

  // 3. Flush Wrap-Around Dark Greenhouse Glass + Gloss Black Pillars (Floating Roof Signature)
  const frontWindshield = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.035, 0.29, 0.62, 2, 0.01)),
    glassMat
  );
  frontWindshield.position.set(0.30, 0.525, 0);
  frontWindshield.rotation.z = 0.86;
  suv.add(frontWindshield);

  const sideGreenhouse = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.84, 0.165, 0.71, 2, 0.015)),
    glassMat
  );
  sideGreenhouse.position.set(-0.23, 0.505, 0);
  suv.add(sideGreenhouse);

  // Gloss Black B/C/D Window Pillars
  for (const px of [0.06, -0.25, -0.56]) {
    const pillar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.055, 0.17, 0.725)),
      obsidianRoofMat
    );
    pillar.position.set(px, 0.505, 0);
    suv.add(pillar);
  }

  // Rear Raked Tailgate Glass
  const rearGlass = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.035, 0.21, 0.58, 2, 0.01)),
    glassMat
  );
  rearGlass.position.set(-0.725, 0.505, 0);
  rearGlass.rotation.z = -0.78;
  suv.add(rearGlass);

  // 4. Lower Gloss Black Rocker Skirts & Flared Wheel Arch Fenders
  const lowerSill = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(1.66, 0.075, 0.78, 3, 0.015)),
    obsidianRoofMat
  );
  lowerSill.position.set(0.01, 0.16, 0);
  suv.add(lowerSill);

  // Side SV Satin-Copper Fender Gill Vents & Flush Deployable Door Handles
  for (const sz of [-0.398, 0.398]) {
    const fenderVent = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.11, 0.042, 0.015, 2, 0.005)),
      copperSvMat
    );
    fenderVent.position.set(0.36, 0.365, sz);
    suv.add(fenderVent);

    for (const hx of [0.09, -0.22]) {
      const handle = new THREE.Mesh(
        trackGeo(new RoundedBoxGeometry(0.075, 0.018, 0.014, 2, 0.004)),
        obsidianRoofMat
      );
      handle.position.set(hx, 0.385, sz);
      suv.add(handle);
    }
  }

  // Sculpted Clamshell Hood Louvre Vents + Front Grille + Digital LED Headlights
  for (const vz of [-0.18, 0.18]) {
    const hoodVent = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.11, 0.012, 0.065, 2, 0.004)),
      copperSvMat
    );
    hoodVent.position.set(0.56, 0.435, vz);
    suv.add(hoodVent);
  }

  // Flush L461 Upper Satin Graphite Grille + Silver Frame
  const grilleBezel = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.032, 0.095, 0.42, 2, 0.01)),
    obsidianRoofMat
  );
  grilleBezel.position.set(0.875, 0.335, 0);
  suv.add(grilleBezel);

  const grilleMesh = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.036, 0.075, 0.38, 2, 0.006)),
    graphiteGrilleMat
  );
  grilleMesh.position.set(0.878, 0.335, 0);
  suv.add(grilleMesh);

  // Ultra-Slim Signature L461 Digital LED Headlights
  const drlGeo = trackGeo(new RoundedBoxGeometry(0.04, 0.036, 0.14, 2, 0.008));
  for (const lz of [-0.285, 0.285]) {
    const headlight = new THREE.Mesh(drlGeo, headlightMat);
    headlight.position.set(0.875, 0.34, lz);
    suv.add(headlight);
  }

  // Aggressive L461 Lower Triple-Blade Bumper Intakes + Front Splitter + Plate
  const lowerIntake = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.04, 0.075, 0.64, 2, 0.01)),
    obsidianRoofMat
  );
  lowerIntake.position.set(0.885, 0.215, 0);
  suv.add(lowerIntake);

  for (const bz of [-0.26, 0.26]) {
    const blade = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.045, 0.018, 0.14)),
      copperSvMat
    );
    blade.position.set(0.892, 0.215, bz);
    suv.add(blade);
  }

  const frontPlate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 0.046, 0.18)), plateMat);
  frontPlate.position.set(0.905, 0.23, 0);
  suv.add(frontPlate);

  // Signature Rear Gloss-Black Tailgate Finisher Bar + Slim Twin Horizontal LED Tail Lights + Quad Exhausts
  const rearFinisher = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.035, 0.055, 0.68, 2, 0.01)),
    obsidianRoofMat
  );
  rearFinisher.position.set(-0.862, 0.365, 0);
  suv.add(rearFinisher);

  const tailLampGeo = trackGeo(new RoundedBoxGeometry(0.042, 0.028, 0.17, 2, 0.006));
  for (const tz of [-0.255, 0.255]) {
    const tailLed = new THREE.Mesh(tailLampGeo, tailLedMat);
    tailLed.position.set(-0.866, 0.365, tz);
    suv.add(tailLed);
  }

  const rearDiffuser = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.05, 0.07, 0.66, 2, 0.01)),
    obsidianRoofMat
  );
  rearDiffuser.position.set(-0.86, 0.17, 0);
  suv.add(rearDiffuser);

  const exhaustGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 14));
  exhaustGeo.rotateZ(Math.PI / 2);
  for (const ez of [-0.26, -0.20, 0.20, 0.26]) {
    const tip = new THREE.Mesh(exhaustGeo, alloyMat);
    tip.position.set(-0.885, 0.155, ez);
    suv.add(tip);
  }

  // Gloss Black Aerodynamic Side Mirrors
  const mirrorArmGeo = trackGeo(new RoundedBoxGeometry(0.06, 0.055, 0.085, 2, 0.015));
  for (const mz of [-0.425, 0.425]) {
    const mirror = new THREE.Mesh(mirrorArmGeo, obsidianRoofMat);
    mirror.position.set(0.27, 0.45, mz);
    suv.add(mirror);
  }

  // 23-Inch Forged SV Multi-Spoke Alloy Wheels + Crimson Brembo Brake Calipers
  const wheelRadius = 0.168;
  const tireGeo = trackGeo(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.125, 28));
  tireGeo.rotateX(Math.PI / 2);
  const rimOuterGeo = trackGeo(new THREE.CylinderGeometry(0.118, 0.118, 0.132, 24));
  rimOuterGeo.rotateX(Math.PI / 2);
  const spokeBarGeo = trackGeo(new THREE.BoxGeometry(0.215, 0.022, 0.136));
  const hubCapGeo = trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 0.14, 16));
  hubCapGeo.rotateX(Math.PI / 2);
  const caliperGeo = trackGeo(new THREE.BoxGeometry(0.065, 0.075, 0.12));

  for (const [wx, wz] of [
    [-0.51, 0.375],
    [-0.51, -0.375],
    [0.52, 0.375],
    [0.52, -0.375],
  ]) {
    const tire = new THREE.Mesh(tireGeo, wheelMat);
    tire.position.set(wx, wheelRadius, wz);
    tire.castShadow = true;
    suv.add(tire);

    const innerRim = new THREE.Mesh(rimOuterGeo, obsidianRoofMat);
    innerRim.position.set(wx, wheelRadius, wz);
    suv.add(innerRim);

    // 5-Spoke Forged SV Diamond-Cut Star Pattern
    for (let s = 0; s < 5; s += 1) {
      const spoke = new THREE.Mesh(spokeBarGeo, alloyMat);
      spoke.position.set(wx, wheelRadius, wz);
      spoke.rotation.z = (s * Math.PI) / 5;
      suv.add(spoke);
    }

    const hub = new THREE.Mesh(hubCapGeo, brassMat);
    hub.position.set(wx, wheelRadius, wz);
    suv.add(hub);

    const caliper = new THREE.Mesh(caliperGeo, bremboRedMat);
    caliper.position.set(wx - 0.045, wheelRadius + 0.03, wz * 0.96);
    suv.add(caliper);
  }

  suv.scale.setScalar(1.24);
  return suv;
}

export const ThreeMatatuTable: React.FC<ThreeMatatuTableProps> = ({
  gameState,
  viewerUid,
  isYourTurn,
  playableCardIds,
  variant = 'royale',
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
    pos: new THREE.Vector3(0, 6.2, 7.6),
    target: new THREE.Vector3(0, 0.28, 0.15),
  });

  const latestPropsRef = useRef({
    gameState,
    viewerUid,
    isYourTurn,
    playableCardIds,
    variant,
  });
  latestPropsRef.current = {
    gameState,
    viewerUid,
    isYourTurn,
    playableCardIds,
    variant,
  };

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    let rig: ReturnType<typeof createStudioRig>;
    try {
      rig = createStudioRig(el, {
        backgroundHex: variant === 'blitz' ? 0x030e08 : 0x04120b,
        fogHex: variant === 'blitz' ? 0x030e08 : 0x04120b,
        fogDensity: 0.0038,
        fov: 38,
        minAspect: 1.42,
        shadowBounds: 9,
        initialCamera: [0, 6.2, 7.6],
        initialTarget: [0, 0.28, 0.15],
        minDistance: 4.0,
        maxDistance: 21,
        roomTheme: 'matatu',
        toneMappingExposure: 1.04,
        hemiIntensity: 0.72,
        keyIntensity: 1.52,
        rimIntensity: 0.55,
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

    const bgRoom = buildLuxuryRoomEnvironment(rig, {
      theme: 'matatu',
      tableBottomY: -0.5,
      floorY: -1.95,
      pedestalScale: 1.25,
    });

    // Balanced Casino Studio Lighting (Reduced Board Light + Clean Card Contrast)
    const tableSpot = new THREE.SpotLight(0xfff7df, 24, 26, Math.PI / 3, 0.78, 1.25);
    tableSpot.position.set(0, 9.6, 0.5);
    tableSpot.target.position.set(0, 0, 0);
    scene.add(tableSpot);
    scene.add(tableSpot.target);

    const frontCardFill = new THREE.DirectionalLight(0xffffff, 0.72);
    frontCardFill.position.set(0, 4.8, 8.8);
    scene.add(frontCardFill);

    const carSpot = new THREE.SpotLight(0xfff8e6, 18, 16, Math.PI / 4.2, 0.65, 1.2);
    carSpot.position.set(4.8, 4.0, 3.4);
    carSpot.target.position.set(3.48, 0.4, -0.28);
    scene.add(carSpot);
    scene.add(carSpot.target);

    const mahoganyTex = trackTexture(createMahoganyTexture(maxAniso, '#421e0d', '#1b0903'));
    const feltTex = trackTexture(createFeltTexture(maxAniso));
    const crestTex = trackTexture(createTableFeltCrestTexture(maxAniso, variant));
    const cardBackTex = trackTexture(createCardBackTexture(maxAniso, variant));
    const greenChipTex = trackTexture(createCasinoChipTexture(maxAniso, '#0b6e39', '#ffffff', 'MATATU'));
    const goldChipTex = trackTexture(createCasinoChipTexture(maxAniso, '#c89b24', '#1f2937', 'MATATU'));

    const mahoganyMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({
        map: mahoganyTex,
        roughness: 0.26,
        metalness: 0.08,
        clearcoat: 0.62,
        clearcoatRoughness: 0.16,
      })
    );
    const leatherRailMat = trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x171210, roughness: 0.42, metalness: 0.08 })
    );
    const brassMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({ color: 0xd4af37, roughness: 0.18, metalness: 0.92, clearcoat: 0.55 })
    );
    const feltMat = trackMaterial(
      new THREE.MeshStandardMaterial({ map: crestTex, bumpMap: feltTex, bumpScale: 0.016, roughness: 0.85 })
    );
    const cardBackMat = trackMaterial(
      new THREE.MeshStandardMaterial({ map: cardBackTex, roughness: 0.28 })
    );
    const cardEdgeMat = trackMaterial(
      new THREE.MeshStandardMaterial({ color: variant === 'blitz' ? 0xd4af37 : 0xe7decb, roughness: 0.36 })
    );

    const glassMat = trackMaterial(
      new THREE.MeshPhysicalMaterial({ color: 0x0f172a, roughness: 0.08, metalness: 0.35, clearcoat: 0.96 })
    );
    const wheelMat = trackMaterial(
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.72 })
    );
    const headlightMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xfff8dc,
        emissive: 0xffe484,
        emissiveIntensity: 1.65,
      })
    );

    const chipGreenMat = trackMaterial(
      new THREE.MeshStandardMaterial({ map: greenChipTex, roughness: 0.26 })
    );
    const chipGoldMat = trackMaterial(
      new THREE.MeshStandardMaterial({ map: goldChipTex, roughness: 0.22, metalness: 0.42 })
    );

    // Octagonal Mahogany Casino Table Base + Padded Leather Rail + Emerald Damask Felt Surface
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
      trackGeometry(new THREE.TorusGeometry(5.12, 0.058, 12, 8)),
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

    // Brushed Brass Turntable Pad + Latest 2025/2026 Range Rover Sport L461
    const carPad = new THREE.Mesh(
      trackGeometry(new THREE.CylinderGeometry(1.24, 1.32, 0.04, 36)),
      brassMat
    );
    carPad.position.set(3.48, 0.045, -0.28);
    carPad.receiveShadow = true;
    scene.add(carPad);

    const rangeRoverSport = buildLatestRangeRoverSport(
      brassMat,
      glassMat,
      wheelMat,
      headlightMat,
      trackGeometry,
      trackMaterial
    );
    rangeRoverSport.position.set(3.48, 0.065, -0.28);
    scene.add(rangeRoverSport);

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
    const chipGeo = trackGeometry(new THREE.CylinderGeometry(0.30, 0.30, 0.068, 32));
    for (let i = 0; i < 6; i += 1) {
      const c = new THREE.Mesh(chipGeo, i % 2 === 0 ? chipGreenMat : chipGoldMat);
      c.position.y = 0.034 + i * 0.07;
      c.castShadow = true;
      chipsGroup.add(c);
    }
    for (let i = 0; i < 4; i += 1) {
      const c = new THREE.Mesh(chipGeo, i % 2 === 0 ? chipGoldMat : chipGreenMat);
      c.position.set(0.65, 0.034 + i * 0.07, 0.24);
      c.castShadow = true;
      chipsGroup.add(c);
    }
    scene.add(chipsGroup);

    // Larger Anti-Glare 3D Card Geometry for Maximum Artwork Clarity
    const cardGeo = trackGeometry(new THREE.BoxGeometry(1.32, 0.028, 1.85));
    const cardFaceCache = new Map<string, THREE.MeshStandardMaterial>();

    const getCardFaceMaterial = (card: PlayingCardType, highlight: boolean) => {
      const key = `${variant}_${card.rank}_${card.suit}_${highlight ? 'hi' : 'std'}`;
      let mat = cardFaceCache.get(key);
      if (!mat) {
        const tex = trackTexture(createCardFaceTexture(card, maxAniso, highlight, variant));
        mat = trackMaterial(
          new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.54,
            metalness: 0.0,
            emissive: highlight ? new THREE.Color(0x283a04) : new THREE.Color(0x000000),
            emissiveIntensity: highlight ? 0.24 : 0,
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

      // Orient Latest Range Rover Sport cleanly at 3/4 hero angle showing headlights, clamshell hood & floating black roof
      rangeRoverSport.rotation.y = gs.direction === -1 ? Math.PI - 0.58 : -0.58;

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
        m.position.set(-1.18, 0.055 + i * 0.028, -0.15);
        m.rotation.y = 0.06;
        m.castShadow = true;
        m.userData = { action: gs.status === 'waiting' ? 'noop' : 'draw' };
        dynamicCardsGroup.add(m);
        if (i === deckCards - 1 && gs.status !== 'waiting') clickableObjects.push(m);
      }

      if (gs.status === 'waiting') {
        const showcaseCards: PlayingCardType[] =
          variant === 'blitz'
            ? [
                { id: 'blitz_2s', rank: '2', suit: 'spades' },
                { id: 'blitz_7d', rank: '7', suit: 'diamonds' },
                { id: 'blitz_ks', rank: 'K', suit: 'spades' },
                { id: 'blitz_qh', rank: 'Q', suit: 'hearts' },
              ]
            : [
                { id: 'royale_as', rank: 'A', suit: 'spades' },
                { id: 'royale_kh', rank: 'K', suit: 'hearts' },
                { id: 'royale_qc', rank: 'Q', suit: 'clubs' },
                { id: 'royale_jd', rank: 'J', suit: 'diamonds' },
              ];
        showcaseCards.forEach((card, idx) => {
          const offsetX = (idx - 1.5) * 0.96 + 0.42;
          const faceMat = getCardFaceMaterial(card, false);
          const mesh = new THREE.Mesh(cardGeo, [
            cardEdgeMat,
            cardEdgeMat,
            faceMat,
            cardBackMat,
            cardEdgeMat,
            cardEdgeMat,
          ]);
          mesh.position.set(offsetX, 0.86, 1.38 + idx * 0.012);
          mesh.rotation.x = 0.88;
          mesh.rotation.z = -(idx - 1.5) * 0.11;
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
          topCard.rotation.y = 0.04;
          topCard.castShadow = true;
          dynamicCardsGroup.add(topCard);
        }

        // 3. 3D Opponent Fanned Hand across top edge
        const opponent = gs.seats.find((s) => s.uid !== uid);
        const oppCount = Math.min(10, Math.max(0, opponent?.cardCount || 0));
        for (let i = 0; i < oppCount; i += 1) {
          const spread = (i - (oppCount - 1) / 2) * 0.44;
          const c = new THREE.Mesh(cardGeo, [
            cardEdgeMat,
            cardEdgeMat,
            cardBackMat,
            cardBackMat,
            cardEdgeMat,
            cardEdgeMat,
          ]);
          c.position.set(spread, 0.56, -2.85 - Math.abs(spread) * 0.05);
          c.rotation.x = Math.PI / 2 - 0.35;
          c.rotation.z = -spread * 0.08;
          c.castShadow = true;
          dynamicCardsGroup.add(c);
        }

        // 4. 3D Player Hand along front edge facing viewer upright for crisp reading
        const hand = gs.yourHand || [];
        const n = hand.length;
        const step = n > 7 ? 0.68 : 0.94;
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
          mesh.position.set(offsetX, playable ? 1.02 : 0.84, 2.45 + idx * 0.01);
          mesh.rotation.x = 0.98;
          mesh.rotation.z = -offsetX * 0.035;
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
      fitCameraFovForAspect(camera, 38, w, h, 1.42);
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
  }, [variant]);

  useEffect(() => {
    sceneSyncRef.current?.();
  }, [gameState, viewerUid, isYourTurn, playableCardIds]);

  useEffect(() => {
    if (cameraPreset === 'overhead') {
      camTransitionRef.current.pos.set(0, 10.6, 2.0);
      camTransitionRef.current.target.set(0, 0.2, 0.15);
    } else if (cameraPreset === 'dramatic') {
      camTransitionRef.current.pos.set(4.1, 4.3, 7.6);
      camTransitionRef.current.target.set(0, 0.32, 0.15);
    } else {
      camTransitionRef.current.pos.set(0, 6.2, 7.6);
      camTransitionRef.current.target.set(0, 0.28, 0.15);
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
                ['default', 'HD View'],
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
        className={`relative w-full overflow-hidden rounded-[20px] border-2 ${
          variant === 'blitz' ? 'border-[#FFD76A]/85' : 'border-[#C99B27]/80'
        } bg-[#04120B] shadow-[0_28px_60px_rgba(0,0,0,0.9)] ${
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

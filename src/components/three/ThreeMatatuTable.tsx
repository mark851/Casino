import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SUIT_LABELS, SUIT_SYMBOLS } from '../../shared/matatuRules';
import {
  createStudioRig,
  fitCameraFovForAspect,
  scheduleSoftwareGlFrame,
  type CameraPresetKey,
} from './studioScene';
import { FullscreenToggleButton } from '../FullscreenToggleButton';
import type { CardDeckVariant } from '../PlayingCard';
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
  }
) {
  ctx.save();
  ctx.translate(x, y);
  if (options.invert) ctx.rotate(Math.PI);
  traceSuitShape(ctx, suit, size);
  ctx.fillStyle = options.fill;
  ctx.fill();
  if (options.stroke && options.lineWidth) {
    traceSuitShape(ctx, suit, size);
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = options.lineWidth;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

function drawVerticalWoodPlanks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  plankCount: number,
  seedOffset = 0
) {
  const plankW = width / plankCount;
  const tones = ['#DC9B4D', '#D39042', '#CA8639', '#D99749', '#CE8A3E', '#D79547'];

  for (let i = 0; i < plankCount; i += 1) {
    const px = i * plankW;
    const baseHex = tones[(i + seedOffset) % tones.length];
    const pGrad = ctx.createLinearGradient(px, 0, px + plankW, 0);
    pGrad.addColorStop(0, '#BC7931');
    pGrad.addColorStop(0.06, baseHex);
    pGrad.addColorStop(0.52, '#DE9F52');
    pGrad.addColorStop(0.94, baseHex);
    pGrad.addColorStop(1, '#B6732C');
    ctx.fillStyle = pGrad;
    ctx.fillRect(px, 0, plankW + 1, height);

    // Subtle organic vertical pine/oak grain lines
    for (let g = 0; g < 16; g += 1) {
      const gx = px + 6 + ((g * 19 + i * 11) % Math.max(12, Math.floor(plankW - 12)));
      const wobble = ((g + i) % 5) * 3.5 - 7;
      ctx.strokeStyle =
        g % 3 === 0 ? 'rgba(130, 74, 24, 0.18)' : 'rgba(255, 224, 174, 0.10)';
      ctx.lineWidth = g % 4 === 0 ? 2.0 : 1.1;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(
        gx + wobble,
        height * 0.33,
        gx - wobble,
        height * 0.67,
        gx + wobble * 0.5,
        height
      );
      ctx.stroke();
    }

    // Occasional subtle natural wood knot
    if ((i + seedOffset) % 3 === 1) {
      const kx = px + plankW * 0.52;
      const ky = height * (0.24 + ((i * 29) % 54) / 100);
      ctx.save();
      ctx.strokeStyle = 'rgba(128, 72, 22, 0.18)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(kx, ky, 6.5, 20, 0.05, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Crisp plank seam line
    ctx.fillStyle = 'rgba(104, 58, 18, 0.32)';
    ctx.fillRect(px, 0, 2, height);
    ctx.fillStyle = 'rgba(255, 226, 178, 0.12)';
    ctx.fillRect(px + 2, 0, 1.5, height);
  }
}

function createHoneyWoodBoardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 2048;
  const h = 1360;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  drawVerticalWoodPlanks(ctx, w, h, 20, 0);

  // Subtle dark outer perimeter frame matching reference screenshot side bevels (no bright center light)
  const leftShadow = ctx.createLinearGradient(0, 0, 90, 0);
  leftShadow.addColorStop(0, 'rgba(92, 46, 12, 0.44)');
  leftShadow.addColorStop(1, 'rgba(92, 46, 12, 0)');
  ctx.fillStyle = leftShadow;
  ctx.fillRect(0, 0, 90, h);

  const rightShadow = ctx.createLinearGradient(w - 90, 0, w, 0);
  rightShadow.addColorStop(0, 'rgba(92, 46, 12, 0)');
  rightShadow.addColorStop(1, 'rgba(92, 46, 12, 0.44)');
  ctx.fillStyle = rightShadow;
  ctx.fillRect(w - 90, 0, 90, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function createMatatuPlaqueTexture(
  maxAnisotropy: number,
  variant: CardDeckVariant
): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Exact same honey-wood tones & vertical plank width as the main board
  drawVerticalWoodPlanks(ctx, w, h, 7, 0);

  // Clean subtle carved border matching the raised wooden plaque without shifting board color
  ctx.strokeStyle = variant === 'blitz' ? 'rgba(218, 158, 42, 0.72)' : 'rgba(116, 66, 20, 0.45)';
  ctx.lineWidth = variant === 'blitz' ? 7 : 5;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  // Subtle carved / debossed "MATATU" lettering in the center
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 128px "Trebuchet MS", Georgia, sans-serif';

  ctx.fillStyle = 'rgba(255, 224, 178, 0.35)';
  ctx.fillText('MATATU', w / 2, h / 2 + 3);

  ctx.fillStyle = 'rgba(126, 72, 24, 0.65)';
  ctx.fillText('MATATU', w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function createFourSuitsPadTexture(maxAnisotropy: number, activeSuit: Suit): THREE.CanvasTexture {
  const S = 768;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  // Warm frosted parchment panel matching the left suit pad in the reference image
  const bg = ctx.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, '#EFE0CA');
  bg.addColorStop(0.55, '#E8D5BA');
  bg.addColorStop(1, '#DEC7A6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  ctx.strokeStyle = 'rgba(176, 140, 96, 0.5)';
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, S - 24, S - 24);

  const slots: Array<{ suit: Suit; x: number; y: number; isRed: boolean }> = [
    { suit: 'hearts', x: S * 0.28, y: S * 0.28, isRed: true },
    { suit: 'clubs', x: S * 0.72, y: S * 0.28, isRed: false },
    { suit: 'spades', x: S * 0.28, y: S * 0.72, isRed: false },
    { suit: 'diamonds', x: S * 0.72, y: S * 0.72, isRed: true },
  ];

  slots.forEach(({ suit, x, y, isRed }) => {
    const isActive = suit === activeSuit;

    if (isActive) {
      const glow = ctx.createRadialGradient(x, y, 22, x, y, 165);
      glow.addColorStop(0, isRed ? 'rgba(239, 68, 68, 0.28)' : 'rgba(245, 158, 11, 0.34)');
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 165, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isRed ? 'rgba(220, 38, 38, 0.55)' : 'rgba(180, 120, 20, 0.65)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(x, y, 134, 0, Math.PI * 2);
      ctx.stroke();
    }

    const grad = ctx.createLinearGradient(x, y - 100, x, y + 100);
    if (isRed) {
      grad.addColorStop(0, '#FA2828');
      grad.addColorStop(0.55, '#DC1212');
      grad.addColorStop(1, '#9E0808');
    } else {
      grad.addColorStop(0, '#242424');
      grad.addColorStop(0.6, '#0C0C0C');
      grad.addColorStop(1, '#020202');
    }

    drawSuitVector(ctx, suit, x, y, isActive ? 132 : 118, {
      fill: grad,
    });
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function createClassicCardFaceTexture(
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
  const inkColor = isRed ? '#DC1414' : '#111111';

  // Crisp pure white stock matching Q♦ and 4♥ in screenshot
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 44);
  ctx.fill();

  // Outer card frame border
  ctx.lineWidth = playableHighlight ? 22 : 10;
  ctx.strokeStyle = playableHighlight ? '#16A34A' : '#2D2D2D';
  ctx.beginPath();
  ctx.roundRect(10, 10, w - 20, h - 20, 38);
  ctx.stroke();

  // Top-Left Corner Rank + Mini Suit
  ctx.fillStyle = inkColor;
  ctx.font = 'bold 132px "Trebuchet MS", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.save();
  ctx.translate(90, 38);
  if (card.rank === '10') ctx.scale(0.76, 1);
  ctx.fillText(card.rank, 0, 0);
  ctx.restore();
  drawSuitVector(ctx, card.suit, 90, 208, 42, { fill: inkColor });

  // Bottom-Right Inverted Corner Rank + Mini Suit
  ctx.save();
  ctx.translate(w - 90, h - 38);
  ctx.rotate(Math.PI);
  ctx.fillStyle = inkColor;
  ctx.font = 'bold 132px "Trebuchet MS", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.save();
  if (card.rank === '10') ctx.scale(0.76, 1);
  ctx.fillText(card.rank, 0, 0);
  ctx.restore();
  drawSuitVector(ctx, card.suit, 0, 170, 42, { fill: inkColor });
  ctx.restore();

  // Single Large Glossy Centered Suit Emblem matching A♥, Q♦, 4♥, 4♦
  const centerGrad = ctx.createLinearGradient(w / 2, h / 2 - 180, w / 2, h / 2 + 180);
  if (isRed) {
    centerGrad.addColorStop(0, '#FA2525');
    centerGrad.addColorStop(0.55, '#DC1212');
    centerGrad.addColorStop(1, '#9E0909');
  } else {
    centerGrad.addColorStop(0, '#262626');
    centerGrad.addColorStop(0.6, '#0D0D0D');
    centerGrad.addColorStop(1, '#020202');
  }

  drawSuitVector(ctx, card.suit, w / 2, h / 2, 168, {
    fill: centerGrad,
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function createClassicCardBackTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 768;
  const h = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Clean White Outer Frame Border matching the 5 top cards & right draw deck
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, w, h);

  // Thin outer card edge
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  // Slate-blue/grey inner ornamental field
  const pad = 42;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  const backGrad = ctx.createLinearGradient(pad, pad, w - pad, h - pad);
  backGrad.addColorStop(0, '#8896A6');
  backGrad.addColorStop(0.5, '#677688');
  backGrad.addColorStop(1, '#4C5A6B');
  ctx.fillStyle = backGrad;
  ctx.beginPath();
  ctx.roundRect(pad, pad, iw, ih, 24);
  ctx.fill();

  // Ornate Bicycle filigree diamond & petal lattice
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad + 14, pad + 14, iw - 28, ih - 28, 18);
  ctx.clip();

  ctx.strokeStyle = 'rgba(241, 245, 249, 0.35)';
  ctx.lineWidth = 2.5;
  const step = 44;
  for (let y = pad; y < h - pad; y += step) {
    for (let x = pad; x < w - pad; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + step / 2, y + 4);
      ctx.quadraticCurveTo(x + step - 4, y + step / 2, x + step / 2, y + step - 4);
      ctx.quadraticCurveTo(x + 4, y + step / 2, x + step / 2, y + 4);
      ctx.stroke();

      ctx.fillStyle = 'rgba(226, 232, 240, 0.25)';
      ctx.beginPath();
      ctx.arc(x + step / 2, y + step / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Double white inner filigree border
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(pad + 16, pad + 16, iw - 32, ih - 32, 16);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(226, 232, 240, 0.65)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(pad + 34, pad + 34, iw - 68, ih - 68, 12);
  ctx.stroke();

  // Twin Top & Bottom Scroll Medallions + Center Bicycle Rosette
  for (const cy of [h * 0.29, h * 0.71]) {
    ctx.fillStyle = '#5B6A7C';
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(w / 2, cy, 94, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(241, 245, 249, 0.68)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w / 2, cy, 62, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#F8FAFC';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 118, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Fine inner spoke star
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.75)';
  ctx.lineWidth = 3.5;
  for (let a = 0; a < 8; a += 1) {
    const ang = (a * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(w / 2 + Math.cos(ang) * 18, h / 2 + Math.sin(ang) * 18);
    ctx.lineTo(w / 2 + Math.cos(ang) * 66, h / 2 + Math.sin(ang) * 66);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function drawFivePointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number
) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outerR : innerR;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function createUsaFlagCardBackTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 768;
  const h = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Clean silver-white outer card stock edge
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 40);
  ctx.fill();

  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, 38);
  ctx.stroke();

  const pad = 22;
  const fw = w - pad * 2;
  const fh = h - pad * 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, fw, fh, 26);
  ctx.clip();

  // 13 alternating Red (#B22234) and White (#FFFFFF) horizontal stripes
  const stripeH = fh / 13;
  for (let s = 0; s < 13; s += 1) {
    ctx.fillStyle = s % 2 === 0 ? '#B22234' : '#FFFFFF';
    ctx.fillRect(pad, pad + s * stripeH, fw, stripeH + 1);
  }

  // Deep Navy Blue Union Canton (#0A3161) top-left spanning 7 stripes tall
  const cantonW = fw * 0.48;
  const cantonH = stripeH * 7;
  ctx.fillStyle = '#0A3161';
  ctx.fillRect(pad, pad, cantonW, cantonH);

  // Crisp White 5-Pointed Stars Grid inside Canton
  ctx.fillStyle = '#FFFFFF';
  const rows = 9;
  for (let r = 0; r < rows; r += 1) {
    const isEven = r % 2 === 0;
    const cols = isEven ? 6 : 5;
    const cy = pad + ((r + 0.85) * cantonH) / (rows + 0.7);
    for (let c = 0; c < cols; c += 1) {
      const cx =
        pad +
        ((isEven ? c + 0.75 : c + 1.25) * cantonW) / (isEven ? 6.5 : 6.5);
      drawFivePointStar(ctx, cx, cy, 17, 7);
    }
  }

  // Subtle top bevel sheen inside flag edge
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(pad + 3, pad + 3, fw - 6, fh - 6);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function createUgandaFlagCardBackTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 768;
  const h = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 40);
  ctx.fill();

  const pad = 16;
  const fw = w - pad * 2;
  const fh = h - pad * 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, fw, fh, 26);
  ctx.clip();

  const bandColors = ['#0D0D0D', '#FCDC04', '#D90000', '#0D0D0D', '#FCDC04', '#D90000'];
  const bandH = fh / 6;
  bandColors.forEach((col, idx) => {
    ctx.fillStyle = col;
    ctx.fillRect(pad, pad + idx * bandH, fw, bandH + 1);
  });

  // White Center Medallion with Crested Crane Emblem
  const cx = w / 2;
  const cy = h / 2;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx, cy, 134, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Simplified crisp Crested Crane silhouette
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.ellipse(cx + 8, cy + 12, 42, 26, -0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy + 8);
  ctx.quadraticCurveTo(cx - 46, cy - 34, cx - 18, cy - 68);
  ctx.stroke();

  // Head & Red Wattles / Crown Crest
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(cx - 16, cy - 70, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#D90000';
  ctx.beginPath();
  ctx.arc(cx - 14, cy - 58, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 5;
  for (let a = -0.7; a <= 0.3; a += 0.25) {
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 78);
    ctx.lineTo(cx - 18 + Math.sin(a) * 28, cy - 78 - Math.cos(a) * 26);
    ctx.stroke();
  }

  // Wing & Legs
  ctx.fillStyle = '#E5E7EB';
  ctx.beginPath();
  ctx.ellipse(cx + 12, cy + 10, 26, 14, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#D90000';
  ctx.beginPath();
  ctx.moveTo(cx + 38, cy + 2);
  ctx.lineTo(cx + 68, cy + 26);
  ctx.lineTo(cx + 34, cy + 24);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy + 32);
  ctx.lineTo(cx - 8, cy + 84);
  ctx.moveTo(cx + 16, cy + 32);
  ctx.lineTo(cx + 20, cy + 84);
  ctx.stroke();

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
}

function createBlitzPlaqueTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1400;
  const h = 620;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090505';
  ctx.fillRect(0, 0, w, h);

  // Fiery Crimson-Red & Gold Radial Sweep across left half matching Blitz center panel
  const redFlare = ctx.createRadialGradient(w * 0.24, h * 0.52, 20, w * 0.30, h * 0.52, w * 0.44);
  redFlare.addColorStop(0, '#FCA5A5');
  redFlare.addColorStop(0.18, '#EF4444');
  redFlare.addColorStop(0.55, '#7F1D1D');
  redFlare.addColorStop(1, 'rgba(12, 4, 4, 0)');
  ctx.fillStyle = redFlare;
  ctx.fillRect(0, 0, w, h);

  // Sweeping Golden-Yellow Ugandan Flare Band along Left Curve
  const goldWave = ctx.createLinearGradient(0, 0, w * 0.25, h);
  goldWave.addColorStop(0, '#FEF08A');
  goldWave.addColorStop(0.5, '#FACC15');
  goldWave.addColorStop(1, '#B91C1C');
  ctx.fillStyle = goldWave;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w * 0.14, 0);
  ctx.quadraticCurveTo(w * 0.24, h * 0.5, w * 0.18, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Curved Jet-Black Glossy Left Crescent
  ctx.fillStyle = '#040404';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w * 0.04, 0);
  ctx.quadraticCurveTo(w * 0.19, h * 0.52, w * 0.16, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Subtle diagonal white glass glint on top-left corner curve matching screenshot
  const glint = ctx.createLinearGradient(0, 0, w * 0.15, h * 0.35);
  glint.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
  glint.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glint;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w * 0.14, 0);
  ctx.lineTo(w * 0.08, h * 0.36);
  ctx.lineTo(0, h * 0.24);
  ctx.closePath();
  ctx.fill();

  // Subtle Dark Space Stardust Specks on Right Field
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  for (let i = 0; i < 90; i += 1) {
    const sx = w * 0.35 + ((i * 173) % (w * 0.62));
    const sy = (i * 97) % h;
    const r = (i % 3) * 0.6 + 0.7;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crisp White/Silver Rounded Border Frame
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, w - 10, h - 10);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy || 1;
  return tex;
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
    pos: new THREE.Vector3(0, 7.9, 1.98),
    target: new THREE.Vector3(0, 0.02, 0.12),
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
        backgroundHex: 0x9b5f25,
        fogHex: 0x9b5f25,
        fogDensity: 0,
        fov: 45,
        minAspect: 1.42,
        shadowBounds: 9,
        initialCamera: [0, 7.9, 1.98],
        initialTarget: [0, 0.02, 0.12],
        minDistance: 4.5,
        maxDistance: 18,
        roomTheme: 'matatu',
        antiGlareBoard: true,
        toneMappingExposure: 0.78,
        hemiIntensity: 0.56,
        keyIntensity: 0.24,
        rimIntensity: 0,
        environmentIntensity: 0.08,
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

    // 1. Main Honey-Wood Vertical Plank Tabletop Slab (Matte Zero-Glare, Uniform Wood Color)
    const woodBoardTex = trackTexture(createHoneyWoodBoardTexture(maxAniso));
    const woodBoardMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        map: woodBoardTex,
        roughness: 0.96,
        metalness: 0.0,
        envMapIntensity: 0.0,
      })
    );
    const woodEdgeMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xb8742e,
        roughness: 0.94,
        metalness: 0.0,
        envMapIntensity: 0.0,
      })
    );

    const outerFloor = new THREE.Mesh(
      trackGeometry(new THREE.PlaneGeometry(40, 40)),
      trackMaterial(
        new THREE.MeshStandardMaterial({
          color: 0x9b5f25,
          roughness: 0.96,
          metalness: 0.0,
          envMapIntensity: 0.0,
        })
      )
    );
    outerFloor.rotation.x = -Math.PI / 2;
    outerFloor.position.y = -0.44;
    outerFloor.receiveShadow = true;
    scene.add(outerFloor);

    const boardSlab = new THREE.Mesh(
      trackGeometry(new RoundedBoxGeometry(15.8, 0.42, 9.8, 4, 0.08)),
      woodBoardMat
    );
    boardSlab.position.set(0, -0.21, 0);
    boardSlab.receiveShadow = true;
    boardSlab.castShadow = true;
    scene.add(boardSlab);

    const isBlitzMode = variant === 'blitz';

    // 2. Raised Center Plaque (Blitz Dark Glossy Crimson-Gold-Black vs Royale Honey-Wood "MATATU")
    const plaqueW = isBlitzMode ? 7.15 : 4.65;
    const plaqueD = isBlitzMode ? 2.75 : 2.28;
    const plaqueTex = trackTexture(
      isBlitzMode ? createBlitzPlaqueTexture(maxAniso) : createMatatuPlaqueTexture(maxAniso, variant)
    );
    const plaqueTopMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        map: plaqueTex,
        roughness: isBlitzMode ? 0.88 : 0.96,
        metalness: 0.0,
        envMapIntensity: 0.0,
      })
    );
    const plaqueRimMat = isBlitzMode
      ? trackMaterial(
          new THREE.MeshStandardMaterial({
            color: 0xdbe2ea,
            roughness: 0.72,
            metalness: 0.0,
            envMapIntensity: 0.0,
          })
        )
      : woodEdgeMat;

    const plaqueBase = new THREE.Mesh(
      trackGeometry(new RoundedBoxGeometry(plaqueW, 0.1, plaqueD, 3, 0.16)),
      plaqueRimMat
    );
    plaqueBase.position.set(isBlitzMode ? -0.35 : 0, 0.042, -0.05);
    plaqueBase.castShadow = true;
    plaqueBase.receiveShadow = true;
    scene.add(plaqueBase);

    const plaqueFace = new THREE.Mesh(
      trackGeometry(new THREE.PlaneGeometry(plaqueW - 0.12, plaqueD - 0.12)),
      plaqueTopMat
    );
    plaqueFace.rotation.x = -Math.PI / 2;
    plaqueFace.position.set(isBlitzMode ? -0.35 : 0, 0.095, -0.05);
    plaqueFace.receiveShadow = true;
    scene.add(plaqueFace);

    // 3. Left Turn-Direction Triangles on Central Plaque (Top Gold ▲, Bottom Red ▼)
    const upTriShape = new THREE.Shape();
    upTriShape.moveTo(0, 0.17);
    upTriShape.lineTo(-0.22, -0.14);
    upTriShape.lineTo(0.22, -0.14);
    upTriShape.closePath();

    const triGeo = trackGeometry(
      new THREE.ExtrudeGeometry(upTriShape, {
        depth: 0.03,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.01,
        bevelSegments: 2,
      })
    );
    triGeo.rotateX(-Math.PI / 2);

    const upTriMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.85,
        metalness: 0.0,
        envMapIntensity: 0.0,
        emissive: 0x000000,
        emissiveIntensity: 0,
      })
    );
    const downTriMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xd91c1c,
        roughness: 0.85,
        metalness: 0.0,
        envMapIntensity: 0.0,
        emissive: 0x000000,
        emissiveIntensity: 0,
      })
    );

    const triX = isBlitzMode ? -3.48 : -1.92;
    const triZTop = isBlitzMode ? -1.04 : -0.74;
    const triZBot = isBlitzMode ? 0.94 : 0.64;

    const upTriangle = new THREE.Mesh(triGeo, upTriMat);
    upTriangle.position.set(triX, 0.098, triZTop);
    upTriangle.castShadow = true;
    scene.add(upTriangle);

    const downTriangle = new THREE.Mesh(triGeo, downTriMat);
    downTriangle.rotation.y = Math.PI;
    downTriangle.position.set(triX, 0.098, triZBot);
    downTriangle.castShadow = true;
    scene.add(downTriangle);

    // 4. Left Frosted Parchment 4-Suit Card Panel (Royale mode)
    let currentSuitPadSuit: Suit = latestPropsRef.current.gameState.activeSuit || 'hearts';
    let suitPadTex = trackTexture(createFourSuitsPadTexture(maxAniso, currentSuitPadSuit));
    const suitPadMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        map: suitPadTex,
        roughness: 0.94,
        metalness: 0.0,
        envMapIntensity: 0.0,
      })
    );
    if (!isBlitzMode) {
      const suitPadSideMat = trackMaterial(
        new THREE.MeshStandardMaterial({
          color: 0xd8c3a5,
          roughness: 0.94,
          metalness: 0.0,
          envMapIntensity: 0.0,
        })
      );
      const suitPadSlab = new THREE.Mesh(
        trackGeometry(new RoundedBoxGeometry(2.05, 0.04, 2.05, 2, 0.06)),
        suitPadSideMat
      );
      suitPadSlab.position.set(-4.05, 0.018, -0.02);
      suitPadSlab.castShadow = true;
      suitPadSlab.receiveShadow = true;
      scene.add(suitPadSlab);

      const suitPadTop = new THREE.Mesh(
        trackGeometry(new THREE.PlaneGeometry(1.94, 1.94)),
        suitPadMat
      );
      suitPadTop.rotation.x = -Math.PI / 2;
      suitPadTop.position.set(-4.05, 0.041, -0.02);
      suitPadTop.receiveShadow = true;
      scene.add(suitPadTop);
    }

    // 5. Card Stock Materials & Geometry (USA Flag Opponent Cards, Ugandan Flag Blitz Deck / Classic Rider-Back)
    const cardGeo = trackGeometry(new THREE.BoxGeometry(1.14, 0.022, 1.58));
    const classicBackTex = trackTexture(createClassicCardBackTexture(maxAniso));
    const usaFlagBackTex = trackTexture(createUsaFlagCardBackTexture(maxAniso));
    const ugandaFlagBackTex = trackTexture(createUgandaFlagCardBackTexture(maxAniso));

    const classicBackMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        map: classicBackTex,
        roughness: 0.92,
        metalness: 0.0,
        envMapIntensity: 0.0,
      })
    );
    const usaFlagBackMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        map: usaFlagBackTex,
        roughness: 0.92,
        metalness: 0.0,
        envMapIntensity: 0.0,
      })
    );
    const ugandaFlagBackMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        map: ugandaFlagBackTex,
        roughness: 0.92,
        metalness: 0.0,
        envMapIntensity: 0.0,
      })
    );
    const drawBackMat = isBlitzMode ? ugandaFlagBackMat : classicBackMat;

    const cardEdgeMat = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xf4f4f4,
        roughness: 0.92,
        metalness: 0.0,
        envMapIntensity: 0.0,
      })
    );
    const cardFaceCache = new Map<string, THREE.MeshStandardMaterial>();

    const getCardFaceMaterial = (card: PlayingCardType, highlight: boolean) => {
      const key = `classic_${card.rank}_${card.suit}_${highlight ? 'hi' : 'std'}`;
      let mat = cardFaceCache.get(key);
      if (!mat) {
        const tex = trackTexture(createClassicCardFaceTexture(card, maxAniso, highlight));
        mat = trackMaterial(
          new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.94,
            metalness: 0.0,
            envMapIntensity: 0.0,
            emissive: highlight ? new THREE.Color(0x0b3b18) : new THREE.Color(0x000000),
            emissiveIntensity: highlight ? 0.09 : 0,
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

      // Update left 4-suit highlight pad when activeSuit changes (Royale)
      const targetSuit: Suit = gs.activeSuit || 'hearts';
      if (!isBlitzMode && targetSuit !== currentSuitPadSuit) {
        currentSuitPadSuit = targetSuit;
        const nextTex = trackTexture(createFourSuitsPadTexture(maxAniso, targetSuit));
        suitPadMat.map = nextTex;
        suitPadMat.needsUpdate = true;
        suitPadTex = nextTex;
      }

      // Highlight active turn triangle on central plaque
      const activePlay = gs.status === 'in_progress';
      if (activePlay && yourTurn) {
        downTriMat.emissive.setHex(0xff2222);
        downTriMat.emissiveIntensity = 0.24;
        upTriMat.emissive.setHex(0x000000);
        upTriMat.emissiveIntensity = 0;
      } else if (activePlay && !yourTurn) {
        upTriMat.emissive.setHex(0xffd76a);
        upTriMat.emissiveIntensity = 0.22;
        downTriMat.emissive.setHex(0x000000);
        downTriMat.emissiveIntensity = 0;
      } else {
        upTriMat.emissive.setHex(0x000000);
        upTriMat.emissiveIntensity = 0;
        downTriMat.emissive.setHex(0x000000);
        downTriMat.emissiveIntensity = 0;
      }

      // 1. Top Opponent Cards Row with USA Flag Card Back
      const opponent = gs.seats.find((s) => s.uid !== uid);
      const oppCount =
        gs.status === 'waiting'
          ? 5
          : Math.min(8, Math.max(0, opponent?.cardCount || 0));
      const oppStep = oppCount > 6 ? 0.94 : 1.24;
      for (let i = 0; i < oppCount; i += 1) {
        const x = (i - (oppCount - 1) / 2) * oppStep - 0.55;
        const c = new THREE.Mesh(cardGeo, [
          cardEdgeMat,
          cardEdgeMat,
          usaFlagBackMat,
          usaFlagBackMat,
          cardEdgeMat,
          cardEdgeMat,
        ]);
        c.position.set(x, 0.015, -2.35);
        c.castShadow = true;
        c.receiveShadow = true;
        dynamicCardsGroup.add(c);
      }

      // 2. Draw Pile + Sideways Peeking Cut Card
      const cutCard: PlayingCardType =
        gs.pendingCutCard ??
        (isBlitzMode
          ? { id: 'cut_9_diamonds', rank: '9', suit: 'diamonds' }
          : { id: 'cut_4_diamonds', rank: '4', suit: 'diamonds' });
      const cutFaceMat = getCardFaceMaterial(cutCard, false);
      const cutBaseY = isBlitzMode ? 0.108 : 0.015;
      const cutX = isBlitzMode ? 1.56 : 3.48;
      const deckX = isBlitzMode ? 2.15 : 4.15;

      const cutMesh = new THREE.Mesh(cardGeo, [
        cardEdgeMat,
        cardEdgeMat,
        cutFaceMat,
        drawBackMat,
        cardEdgeMat,
        cardEdgeMat,
      ]);
      cutMesh.position.set(cutX, cutBaseY, -0.05);
      cutMesh.rotation.y = Math.PI / 2;
      cutMesh.castShadow = true;
      cutMesh.receiveShadow = true;
      dynamicCardsGroup.add(cutMesh);

      const deckCards = Math.max(1, Math.min(9, Math.ceil((gs.deckCount || 40) / 5)));
      for (let i = 0; i < deckCards; i += 1) {
        const m = new THREE.Mesh(cardGeo, [
          cardEdgeMat,
          cardEdgeMat,
          drawBackMat,
          cardEdgeMat,
          cardEdgeMat,
          cardEdgeMat,
        ]);
        m.position.set(deckX, cutBaseY + 0.025 + i * 0.02, -0.05);
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData = { action: gs.status === 'waiting' ? 'noop' : 'draw' };
        dynamicCardsGroup.add(m);
        if (i === deckCards - 1 && gs.status !== 'waiting') {
          clickableObjects.push(m);
        }
      }

      // 3. Organic Messy Tilted Discard Pile
      const discardCenterX = isBlitzMode ? -1.45 : 0.04;
      const underCards: Array<{ card: PlayingCardType; dx: number; dz: number; rot: number }> = [
        { card: { id: 'under_kh', rank: 'K', suit: 'spades' }, dx: 0.08, dz: 0.14, rot: 0.42 },
        { card: { id: 'under_2c', rank: '2', suit: 'clubs' }, dx: -0.18, dz: -0.06, rot: -0.25 },
        { card: { id: 'under_2h', rank: '2', suit: 'hearts' }, dx: -0.12, dz: -0.22, rot: 0.65 },
        { card: { id: 'under_7s', rank: '7', suit: 'spades' }, dx: 0.14, dz: -0.12, rot: -0.95 },
      ];

      const showUnderCount =
        gs.status === 'waiting' ? (isBlitzMode ? 2 : 4) : Math.min(4, Math.max(0, (gs.discardCount || 1) - 1));

      for (let i = 0; i < showUnderCount; i += 1) {
        const u = underCards[i];
        const underMat = getCardFaceMaterial(u.card, false);
        const underMesh = new THREE.Mesh(cardGeo, [
          cardEdgeMat,
          cardEdgeMat,
          underMat,
          drawBackMat,
          cardEdgeMat,
          cardEdgeMat,
        ]);
        underMesh.position.set(discardCenterX + u.dx, 0.114 + i * 0.023, -0.04 + u.dz);
        underMesh.rotation.y = u.rot;
        underMesh.castShadow = true;
        underMesh.receiveShadow = true;
        dynamicCardsGroup.add(underMesh);
      }

      const topDiscardCard: PlayingCardType =
        gs.status === 'waiting'
          ? isBlitzMode
            ? { id: 'preview_3h', rank: '3', suit: 'hearts' }
            : { id: 'preview_ah', rank: 'A', suit: 'hearts' }
          : gs.topDiscard ?? { id: 'fallback_ah', rank: 'A', suit: 'hearts' };

      const topMat = getCardFaceMaterial(topDiscardCard, false);
      const topMesh = new THREE.Mesh(cardGeo, [
        cardEdgeMat,
        cardEdgeMat,
        topMat,
        drawBackMat,
        cardEdgeMat,
        cardEdgeMat,
      ]);
      topMesh.position.set(discardCenterX, 0.114 + showUnderCount * 0.023 + 0.012, -0.02);
      topMesh.rotation.y = isBlitzMode ? -0.22 : 0.68;
      topMesh.castShadow = true;
      topMesh.receiveShadow = true;
      dynamicCardsGroup.add(topMesh);

      // 4. Bottom Player Hand Cards (Classic Pure-White Large-Suit Cards)
      const bottomCards: PlayingCardType[] =
        gs.status === 'waiting' && (!gs.yourHand || gs.yourHand.length === 0)
          ? isBlitzMode
            ? [
                { id: 'preview_8s', rank: '8', suit: 'spades' },
                { id: 'preview_2s', rank: '2', suit: 'spades' },
                { id: 'preview_10d', rank: '10', suit: 'diamonds' },
                { id: 'preview_qc', rank: 'Q', suit: 'clubs' },
                { id: 'preview_4h', rank: '4', suit: 'hearts' },
                { id: 'preview_kc', rank: 'K', suit: 'clubs' },
                { id: 'preview_kh', rank: 'K', suit: 'hearts' },
              ]
            : [
                { id: 'preview_qd', rank: 'Q', suit: 'diamonds' },
                { id: 'preview_4h', rank: '4', suit: 'hearts' },
              ]
          : gs.yourHand || [];

      const n = bottomCards.length;
      const handStep = isBlitzMode ? (n > 7 ? 0.96 : 1.18) : n > 7 ? 0.92 : 1.24;
      bottomCards.forEach((card, idx) => {
        const playable = gs.status !== 'waiting' && yourTurn && playableIds.has(card.id);
        const offsetX =
          (idx - (n - 1) / 2) * handStep - (!isBlitzMode && n <= 2 ? 0.6 : isBlitzMode ? 0.55 : 0);
        const faceMat = getCardFaceMaterial(card, playable);
        const mesh = new THREE.Mesh(cardGeo, [
          cardEdgeMat,
          cardEdgeMat,
          faceMat,
          drawBackMat,
          cardEdgeMat,
          cardEdgeMat,
        ]);
        mesh.position.set(offsetX, playable ? 0.12 : 0.03, 2.38 + idx * 0.008);
        mesh.rotation.x = 0.16;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { action: gs.status === 'waiting' ? 'noop' : 'play', card, playable };
        dynamicCardsGroup.add(mesh);
        if (gs.status !== 'waiting') {
          clickableObjects.push(mesh);
        }
      });

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
        let needsAnother = false;

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
      fitCameraFovForAspect(camera, 45, w, h, 1.42);
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
      camTransitionRef.current.pos.set(0, 9.2, 0.22);
      camTransitionRef.current.target.set(0, 0, 0);
    } else if (cameraPreset === 'dramatic') {
      camTransitionRef.current.pos.set(0, 5.2, 6.8);
      camTransitionRef.current.target.set(0, 0.06, 0.1);
    } else {
      camTransitionRef.current.pos.set(0, 7.9, 1.98);
      camTransitionRef.current.target.set(0, 0.02, 0.12);
    }
    camTransitionRef.current.active = true;
    sceneSyncRef.current?.();
  }, [cameraPreset]);

  const activeSuitSymbol = SUIT_SYMBOLS[gameState.activeSuit];
  const activeSuitLabel = SUIT_LABELS[gameState.activeSuit];
  const isRedSuit = gameState.activeSuit === 'hearts' || gameState.activeSuit === 'diamonds';

  if (webglError) {
    return (
      <div className="w-full h-[360px] rounded-xl border border-[#8A521E]/60 bg-[#C2803A] flex items-center justify-center p-6 text-center text-xs text-amber-50">
        3D WebGL context unavailable on this device. Use the card hand bar below to play.
      </div>
    );
  }

  return (
    <div className="w-full space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-[11px] font-medium text-amber-100/90">
          <span>
            Active Suit:{' '}
            <strong className={isRedSuit ? 'text-red-300' : 'text-[#FFD76A]'}>
              {activeSuitSymbol} {activeSuitLabel}
            </strong>
          </span>
          <span className="text-amber-300/50">·</span>
          <span>Click 3D Deck to draw or click green-ringed 3D Cards to play · Drag to orbit</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#3D220A] border border-[#8D5824]/55 rounded-lg p-0.5">
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
                    ? 'bg-[#B97732] text-white'
                    : 'text-amber-200/75 hover:text-white'
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
        className={`relative w-full overflow-hidden rounded-[20px] border-2 border-[#754316] bg-[#9B5F25] shadow-[0_24px_50px_rgba(0,0,0,0.62)] ${
          isFullscreen
            ? 'h-[calc(100dvh-132px)] min-h-[560px]'
            : 'h-[560px] sm:h-[680px] lg:h-[760px] xl:h-[810px]'
        }`}
      >
        <div ref={mountRef} className="relative z-10 h-full w-full" />

        {/* Bottom-Right Pause / View Button (||) matching Reference Image */}
        <button
          type="button"
          onClick={() => {
            if (onToggleFullscreen) {
              onToggleFullscreen();
            } else {
              setCameraPreset((prev) => (prev === 'default' ? 'overhead' : 'default'));
            }
          }}
          title={onToggleFullscreen ? (isFullscreen ? 'Exit Fullscreen' : 'Expand Board') : 'Switch Camera Angle'}
          aria-label="Board Pause or View Control"
          className={`absolute bottom-3.5 right-4 z-20 flex h-10 w-16 items-center justify-center gap-1.5 rounded-xl border-2 transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
            variant === 'blitz'
              ? 'border-[#E2E8F0]/80 bg-gradient-to-r from-[#111111] via-[#FACC15] to-[#DC2626] shadow-[0_6px_14px_rgba(0,0,0,0.55)] -skew-x-12'
              : 'border-[#4A290D] bg-[#784A1E] shadow-[0_6px_14px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,215,155,0.28)]'
          }`}
        >
          <span
            className={`h-4.5 w-1.5 rounded-sm ${
              variant === 'blitz' ? 'bg-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.85)]' : 'bg-[#FBBF24]'
            }`}
          />
          <span
            className={`h-4.5 w-1.5 rounded-sm ${
              variant === 'blitz' ? 'bg-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.85)]' : 'bg-[#FBBF24]'
            }`}
          />
        </button>
      </div>
    </div>
  );
};

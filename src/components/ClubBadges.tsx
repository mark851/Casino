import React from 'react';
import liverpoolBadgeUrl from '../assets/badges/liverpool.svg';
import arsenalBadgeUrl from '../assets/badges/arsenal.svg';
import manUtdBadgeUrl from '../assets/badges/man_utd.svg';
import chelseaBadgeUrl from '../assets/badges/chelsea.svg';
import type { LudoColor } from '../shared/types';

export type ClubId = 'chelsea' | 'man_utd' | 'arsenal' | 'liverpool';

export interface ClubBadgeMeta {
  id: ClubId;
  name: string;
  shortName: string;
  defaultColor: LudoColor;
  primaryHex: string;
  accentHex: string;
  badgeUrl: string;
}

export const CLUB_BADGE_URLS: Record<ClubId, string> = {
  liverpool: liverpoolBadgeUrl,
  arsenal: arsenalBadgeUrl,
  man_utd: manUtdBadgeUrl,
  chelsea: chelseaBadgeUrl,
};

export const COLOR_BADGE_URLS: Record<LudoColor, string> = {
  green: liverpoolBadgeUrl,
  yellow: arsenalBadgeUrl,
  red: manUtdBadgeUrl,
  blue: chelseaBadgeUrl,
};

export const CLUB_BADGES: Record<ClubId, ClubBadgeMeta> = {
  liverpool: {
    id: 'liverpool',
    name: 'Liverpool',
    shortName: 'LIV',
    defaultColor: 'green',
    primaryHex: '#C8102E',
    accentHex: '#00B2A9',
    badgeUrl: liverpoolBadgeUrl,
  },
  arsenal: {
    id: 'arsenal',
    name: 'Arsenal',
    shortName: 'ARS',
    defaultColor: 'yellow',
    primaryHex: '#EF0107',
    accentHex: '#C5A059',
    badgeUrl: arsenalBadgeUrl,
  },
  man_utd: {
    id: 'man_utd',
    name: 'Manchester United',
    shortName: 'MUN',
    defaultColor: 'red',
    primaryHex: '#DA291C',
    accentHex: '#FBE122',
    badgeUrl: manUtdBadgeUrl,
  },
  chelsea: {
    id: 'chelsea',
    name: 'Chelsea',
    shortName: 'CHE',
    defaultColor: 'blue',
    primaryHex: '#034694',
    accentHex: '#DBA111',
    badgeUrl: chelseaBadgeUrl,
  },
};

export const ALL_CLUB_IDS: ClubId[] = ['liverpool', 'arsenal', 'man_utd', 'chelsea'];

export const DEFAULT_CLUB_BY_COLOR: Record<LudoColor, ClubId> = {
  green: 'liverpool',
  yellow: 'arsenal',
  red: 'man_utd',
  blue: 'chelsea',
};

interface ClubBadgeProps {
  clubId: ClubId;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ClubBadgeProps['size']>, string> = {
  xs: 'h-5 w-5',
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
  xl: 'h-14 w-14',
  full: 'h-full w-full',
};

export const ClubBadge: React.FC<ClubBadgeProps> = ({
  clubId,
  size = 'md',
  className = '',
}) => {
  const sizeClass = SIZE_CLASSES[size];
  const meta = CLUB_BADGES[clubId];

  return (
    <img
      src={meta.badgeUrl}
      alt={`${meta.name} club badge`}
      draggable={false}
      className={`${sizeClass} shrink-0 object-contain select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)] ${className}`}
    />
  );
};

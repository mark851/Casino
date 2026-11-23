import React from 'react';
import { LudoMaster } from './LudoMaster';
import type { SanitizedLudoState, SanitizedSeatState } from '../shared/types';

interface LudoTableViewProps {
  ludoState: SanitizedLudoState;
  seats: SanitizedSeatState[];
  viewerUid: string;
  isYourTurn: boolean;
  gameStatus: 'waiting' | 'in_progress' | 'completed';
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onRoll: () => void;
  onMoveToken: (tokenIndex: number) => void;
  onResign: () => void;
}

export const LudoTableView: React.FC<LudoTableViewProps> = ({
  ludoState,
  seats,
  viewerUid,
  isYourTurn,
  gameStatus,
  isFullscreen = false,
  onToggleFullscreen,
  onRoll,
  onMoveToken,
  onResign,
}) => {
  return (
    <LudoMaster
      ludoState={ludoState}
      seats={seats}
      viewerUid={viewerUid}
      isYourTurn={isYourTurn}
      gameStatus={gameStatus}
      isFullscreen={isFullscreen}
      onToggleFullscreen={onToggleFullscreen}
      onRoll={onRoll}
      onMoveToken={onMoveToken}
      onResign={onResign}
    />
  );
};

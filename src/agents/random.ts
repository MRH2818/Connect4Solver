import { Agent } from './types';
import { getLegalMoves } from './utils';

export const randomAgent: Agent = {
  id: 'random',
  async chooseMove(snapshot, context) {
    if (context?.signal?.aborted) return null;
    const moves = getLegalMoves(snapshot);
    if (moves.length === 0) return null;
    return moves[Math.floor(Math.random() * moves.length)];
  }
};

/** @module Interface chess:engine/engine@0.1.0 **/
export type BoardState = import('./chess-types-types.js').BoardState;
export type Move = import('./chess-types-types.js').Move;
export type GameResult = import('./chess-types-types.js').GameResult;
export type Color = import('./chess-types-types.js').Color;
export type Piece = import('./chess-types-types.js').Piece;
export type Square = import('./chess-types-types.js').Square;
export type EngineError = import('./chess-types-types.js').EngineError;
export type MoveHistoryEntry = import('./chess-types-types.js').MoveHistoryEntry;

export class Game {
  constructor()
  static fromFen(fen: string): Game;
  getFen(): string;
  getBoardState(): BoardState;
  getLegalMoves(): Array<Move>;
  makeMove(uci: Move): void;
  getGameResult(): GameResult;
  isCheck(): boolean;
  getTurn(): Color;
  getPieceAt(sq: Square): Piece | undefined;
  getMoveHistory(): Array<MoveHistoryEntry>;
  reset(): void;
}

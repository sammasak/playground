/** @module Interface chess:types/types@0.1.0 **/
/**
 * # Variants
 * 
 * ## `"pawn"`
 * 
 * ## `"knight"`
 * 
 * ## `"bishop"`
 * 
 * ## `"rook"`
 * 
 * ## `"queen"`
 * 
 * ## `"king"`
 */
export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
/**
 * # Variants
 * 
 * ## `"white"`
 * 
 * ## `"black"`
 */
export type Color = 'white' | 'black';
export interface Piece {
  pieceType: PieceType,
  color: Color,
}
export interface Castling {
  whiteKingside: boolean,
  whiteQueenside: boolean,
  blackKingside: boolean,
  blackQueenside: boolean,
}
export type Square = number;
export type Move = string;
export interface MoveHistoryEntry {
  uciMove: Move,
  resultingFen: string,
}
export interface BoardState {
  squares: Array<Piece | undefined>,
  turn: Color,
  castlingRights: Castling,
  enPassant?: Square,
  halfmoveClock: number,
  fullmoveNumber: number,
  moveHistory: Array<MoveHistoryEntry>,
}
/**
 * # Variants
 * 
 * ## `"in-progress"`
 * 
 * ## `"checkmate"`
 * 
 * ## `"stalemate"`
 * 
 * ## `"draw"`
 */
export type GameResult = 'in-progress' | 'checkmate' | 'stalemate' | 'draw';
/**
 * # Variants
 * 
 * ## `"invalid-fen"`
 * 
 * ## `"illegal-move"`
 * 
 * ## `"game-over"`
 */
export type EngineError = 'invalid-fen' | 'illegal-move' | 'game-over';

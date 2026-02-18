/** @module Interface chess:bot/host@0.1.0 **/
export function getBoard(): BoardState;
export function getLegalMoves(): Array<Move>;
export function log(message: string): void;
export type BoardState = import('./chess-types-types.js').BoardState;
export type Move = import('./chess-types-types.js').Move;

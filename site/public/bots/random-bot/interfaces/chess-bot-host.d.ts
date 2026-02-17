/** @module Interface chess:bot/host@0.1.0 **/
export function getBoard(): BoardState;
export function getLegalMoves(): Array<Move>;
export function log(message: string): void;
export type BoardState = import('./chess-bot-types.js').BoardState;
export type Move = import('./chess-bot-types.js').Move;

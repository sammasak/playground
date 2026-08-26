/** @module Interface chess:bot/host@0.1.0 **/
export function getLegalMoves(): Array<Move>;
export function getFen(): string;
export function log(message: string): void;
export type Move = import('./chess-types-types.js').Move;

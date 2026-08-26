/** @module Interface chess:bot/bot@0.1.0 **/
export function getName(): string;
export function getDescription(): string;
export function getPreferredColor(): Color | undefined;
export function onGameStart(): void;
export function selectMove(): Move;
export function suggestMove(): Move;
export type Move = import('./chess-types-types.js').Move;
export type Color = import('./chess-types-types.js').Color;

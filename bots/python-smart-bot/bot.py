# Smart Bot — Python implementation of the chess:bot WIT interface.
# Same strategy as the Rust smart-bot: captures, center control, development.
#
# Build with componentize-py:
#   componentize-py -d ../../wit/chess-bot -w chess-bot componentize bot -o python_smart_bot.wasm

from __future__ import annotations

import chess.bot.host as host
from chess.types.types import BoardState, Color, Piece, PieceType

PIECE_VALUES: dict[PieceType, int] = {
    PieceType.QUEEN: 9,
    PieceType.ROOK: 5,
    PieceType.BISHOP: 3,
    PieceType.KNIGHT: 3,
    PieceType.PAWN: 1,
    PieceType.KING: 0,
}

# Board index: rank * 8 + file, where a1=0, h8=63
CENTER = {27, 28, 35, 36}  # d4, e4, d5, e5
EXTENDED_CENTER = {r * 8 + f for r in range(2, 6) for f in range(2, 6)}


def parse_uci(uci: str) -> tuple[int, int] | None:
    if len(uci) < 4:
        return None
    from_file = ord(uci[0]) - ord('a')
    from_rank = int(uci[1]) - 1
    to_file = ord(uci[2]) - ord('a')
    to_rank = int(uci[3]) - 1
    if not (0 <= from_file < 8 and 0 <= from_rank < 8
            and 0 <= to_file < 8 and 0 <= to_rank < 8):
        return None
    return (from_rank * 8 + from_file, to_rank * 8 + to_file)


def score_move(uci: str, board: BoardState) -> int:
    """Weighted heuristic: captures, promotions, center control, development."""
    parsed = parse_uci(uci)
    if parsed is None:
        return 0
    from_idx, to_idx = parsed
    score = 0

    target: Piece | None = board.squares[to_idx]
    if target is not None:
        score += 100 + PIECE_VALUES.get(target.piece_type, 0) * 10

    if len(uci) > 4:
        promo = uci[4]
        if promo == 'q':
            score += 90
        elif promo == 'r':
            score += 50
        elif promo in ('b', 'n'):
            score += 30

    if to_idx in CENTER:
        score += 15
    elif to_idx in EXTENDED_CENTER:
        score += 5

    if board.fullmove_number < 10:
        from_piece: Piece | None = board.squares[from_idx]
        if from_piece is not None and from_piece.piece_type != PieceType.PAWN:
            score += 8

    return score


class Bot:
    def get_name(self) -> str:
        return "Smart Bot (Python)"

    def get_description(self) -> str:
        return "Prefers captures and center control. Written in Python."

    def get_preferred_color(self) -> Color | None:
        return None

    def on_game_start(self) -> None:
        host.log("Smart Bot (Python): Ready to play!")

    def select_move(self) -> str:
        moves: list[str] = host.get_legal_moves()
        if not moves:
            host.log("Smart Bot (Python): No legal moves!")
            return ""

        board: BoardState = host.get_board()

        scored = [(score_move(m, board), m) for m in moves]
        best_score = max(s for s, _ in scored)
        tied = [m for s, m in scored if s == best_score]

        idx = (board.fullmove_number + board.halfmove_clock) % len(tied)
        selected = tied[idx]

        host.log(f"Smart Bot (Python): {selected} (score {best_score})")
        return selected

    def suggest_move(self) -> str:
        """Uses the same logic as select_move; override to differentiate."""
        return self.select_move()

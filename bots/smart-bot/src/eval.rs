//! Static position evaluation.
//!
//! Combines Michniewski material values with piece-square tables, returned from
//! the **side-to-move's** perspective (negamax convention). A positive score
//! means the side to move is better off.

use chess_engine::{Board, Color, PieceType, Square};

use crate::pst;

/// Material value of a piece type in centipawns.
///
/// The king is given a very large value so that material counting treats its
/// presence as decisive; genuine mate detection is handled by the search, not
/// here.
#[must_use]
pub const fn material_value(pt: PieceType) -> i32 {
    match pt {
        PieceType::Pawn => 100,
        PieceType::Knight => 320,
        PieceType::Bishop => 330,
        PieceType::Rook => 500,
        PieceType::Queen => 900,
        PieceType::King => 20_000,
    }
}

/// Piece-square-table bonus for a `White` piece of `pt` on `index`.
///
/// Black pieces must be looked up with a vertically-mirrored index; see
/// [`piece_square_bonus`].
const fn white_pst_bonus(pt: PieceType, index: usize) -> i32 {
    match pt {
        PieceType::Pawn => pst::PAWN[index],
        PieceType::Knight => pst::KNIGHT[index],
        PieceType::Bishop => pst::BISHOP[index],
        PieceType::Rook => pst::ROOK[index],
        PieceType::Queen => pst::QUEEN[index],
        PieceType::King => pst::KING_MIDDLEGAME[index],
    }
}

/// Piece-square-table bonus for `pt` of `color` on square `index`, oriented so
/// that a piece advancing toward the enemy is rewarded for either colour.
#[must_use]
pub const fn piece_square_bonus(pt: PieceType, color: Color, index: usize) -> i32 {
    match color {
        Color::White => white_pst_bonus(pt, index),
        Color::Black => white_pst_bonus(pt, pst::mirror(index)),
    }
}

/// Evaluates `board` from the side-to-move's perspective, in centipawns.
///
/// The score is `White_total - Black_total` (material + PST) negated when Black
/// is to move, so a positive result always favours whoever is on the move.
#[must_use]
pub fn evaluate(board: &Board) -> i32 {
    let mut white = 0;
    let mut black = 0;

    for i in 0..64u8 {
        let sq = Square::from_index(i);
        if let Some(piece) = board.piece_at(sq) {
            let index = sq.index();
            let pt = piece.piece_type();
            let contribution = material_value(pt) + piece_square_bonus(pt, piece.color(), index);
            match piece.color() {
                Color::White => white += contribution,
                Color::Black => black += contribution,
            }
        }
    }

    let diff = white - black;
    match board.side_to_move() {
        Color::White => diff,
        Color::Black => -diff,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn start_position_is_symmetric() {
        let board = Board::new();
        assert_eq!(evaluate(&board), 0);
    }

    #[test]
    fn up_a_queen_is_large_positive_for_that_side() {
        // White has an extra queen; White to move.
        let board = Board::from_fen("rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
            .expect("valid fen");
        let score = evaluate(&board);
        assert!(
            score > 800,
            "expected White up ~a queen to score > 800, got {score}"
        );
    }

    #[test]
    fn up_a_queen_favours_black_when_black_to_move() {
        // Black has an extra queen (White's queen removed); Black to move.
        let board = Board::from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR b KQkq - 0 1")
            .expect("valid fen");
        let score = evaluate(&board);
        assert!(
            score > 800,
            "expected side-to-move (Black) up a queen to score > 800, got {score}"
        );
    }

    #[test]
    fn central_knight_beats_rim_knight() {
        // White knight on e4 (central), everything else just kings.
        let central = Board::from_fen("4k3/8/8/8/4N3/8/8/4K3 w - - 0 1").expect("valid fen");
        // White knight on a1 (corner/rim).
        let rim = Board::from_fen("4k3/8/8/8/8/8/8/N3K3 w - - 0 1").expect("valid fen");
        assert!(
            evaluate(&central) > evaluate(&rim),
            "central knight ({}) should outscore rim knight ({})",
            evaluate(&central),
            evaluate(&rim)
        );
    }

    #[test]
    fn black_pst_is_mirrored() {
        // A Black knight on d5 (Black's central outpost) should score the same
        // bonus a White knight on d4 gets — proving the mirror is correct.
        let d5 = Square::new(3, 4).index(); // d5
        let d4 = Square::new(3, 3).index(); // d4
        assert_eq!(
            piece_square_bonus(PieceType::Knight, Color::Black, d5),
            piece_square_bonus(PieceType::Knight, Color::White, d4)
        );
    }
}

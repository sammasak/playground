//! Move ordering via MVV-LVA (Most Valuable Victim − Least Valuable Aggressor).
//!
//! Ordering captures before quiet moves — and, among captures, grabbing the
//! most valuable victim with the least valuable attacker first — sharpens
//! alpha-beta pruning and directly expresses the bot's "prefers captures"
//! persona.

use chess_engine::{Board, Move, MoveKind, Piece, PieceType};

use crate::eval::material_value;

/// Ordering score for a single move. Higher is searched first.
///
/// Captures (and en passant) get a large base bonus plus
/// `victim_value * 8 - attacker_value`, so a pawn taking a queen ranks above a
/// queen taking a pawn. Promotions get a bonus scaled by the promoted piece.
/// Quiet moves score `0`.
#[must_use]
fn move_score(board: &Board, mv: Move) -> i32 {
    const CAPTURE_BASE: i32 = 1_000_000;
    const PROMO_BASE: i32 = 500_000;

    let mut score = 0;

    // Victim: the piece on the destination square, or a pawn for en passant.
    let victim = match mv.kind() {
        MoveKind::EnPassant => Some(PieceType::Pawn),
        _ => board.piece_at(mv.to()).map(Piece::piece_type),
    };

    if let Some(victim) = victim {
        let attacker = board
            .piece_at(mv.from())
            .map_or(0, |p| material_value(p.piece_type()));
        score += CAPTURE_BASE + material_value(victim) * 8 - attacker;
    }

    if let Some(promoted) = mv.promotion_piece() {
        score += PROMO_BASE + material_value(promoted);
    }

    score
}

/// Sorts `moves` in place, best (most promising) first, per MVV-LVA.
pub fn order_moves(board: &Board, moves: &mut [Move]) {
    // Sort descending by score; stable so equal-scored moves keep generation
    // order, which keeps the whole search deterministic.
    moves.sort_by_key(|&mv| std::cmp::Reverse(move_score(board, mv)));
}

#[cfg(test)]
mod tests {
    use super::*;
    use chess_engine::Board;

    #[test]
    fn captures_come_before_quiets() {
        // White rook on a1, Black rook on a8 (capturable up the empty a-file),
        // plus a pawn on d2 that can push quietly.
        let board = Board::from_fen("r3k3/8/8/8/8/8/3P4/R3K3 w Q - 0 1").expect("valid fen");
        let mut moves = board.generate_legal_moves();
        order_moves(&board, &mut moves);

        // Find the first capture and the first quiet; capture index must be smaller.
        let first_capture = moves
            .iter()
            .position(|m| board.piece_at(m.to()).is_some())
            .expect("there is a capture (Rxa8)");
        let first_quiet = moves
            .iter()
            .position(|m| board.piece_at(m.to()).is_none())
            .expect("there is a quiet move");
        assert!(
            first_capture < first_quiet,
            "captures should be ordered before quiets"
        );
    }

    #[test]
    fn most_valuable_victim_first() {
        // White pawn on d5 can take a queen on c6 or e6 (PxQ), and a knight also
        // attacks... simpler: white pawn d5, black queen on e6, black pawn on c6.
        // Pawn takes queen (PxQ) must be ordered before pawn takes pawn (PxP).
        let board = Board::from_fen("4k3/8/2p1q3/3P4/8/8/8/4K3 w - - 0 1").expect("valid fen");
        let mut moves = board.generate_legal_moves();
        order_moves(&board, &mut moves);

        // The very first move should be the capture of the queen on e6.
        let first = moves[0];
        let victim = board.piece_at(first.to()).map(Piece::piece_type);
        assert_eq!(
            victim,
            Some(PieceType::Queen),
            "highest-value victim (queen) should be captured first, got {first:?}"
        );
    }

    #[test]
    fn pxq_before_qxp() {
        // Both a pawn and a queen can capture an enemy piece; the pawn's capture
        // of the more valuable victim should rank above the queen capturing a pawn.
        // White queen on a1, white pawn on d5; black queen on e6, black pawn on b2.
        let board = Board::from_fen("4k3/8/4q3/3P4/8/8/1p6/Q3K3 w - - 0 1").expect("valid fen");
        let mut moves = board.generate_legal_moves();
        order_moves(&board, &mut moves);

        // First move is PxQ (pawn d5 x queen e6). QxP would be lower.
        let first = moves[0];
        assert_eq!(
            board.piece_at(first.to()).map(Piece::piece_type),
            Some(PieceType::Queen),
            "PxQ should be ordered before QxP"
        );
        assert_eq!(
            board.piece_at(first.from()).map(Piece::piece_type),
            Some(PieceType::Pawn),
            "the queen should be captured by the pawn (least valuable aggressor)"
        );
    }
}

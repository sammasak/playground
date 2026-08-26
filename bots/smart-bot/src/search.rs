//! Negamax search with alpha-beta pruning, quiescence at the leaves,
//! MVV-LVA move ordering, and iterative deepening bounded by a maximum depth
//! and a node budget.
//!
//! The public entry point is [`best_move`]. All scores are centipawns from the
//! side-to-move's perspective (negamax convention).

use std::collections::BTreeSet;

use chess_engine::{Board, Move, MoveKind};

use crate::eval::evaluate;
use crate::ordering::order_moves;

/// Hard cap on iterative-deepening depth (plies).
pub const MAX_DEPTH: u32 = 5;

/// Approximate node budget across the whole `best_move` call. Once exceeded the
/// current depth iteration is abandoned and the best move from the last fully
/// completed depth is returned.
pub const MAX_NODES: u64 = 200_000;

/// Root penalty (centipawns) applied to a move that re-enters an
/// already-seen position. Small enough never to override real material, but
/// enough to break ties and avoid needless shuffling/repetition.
pub const REPETITION_PENALTY: i32 = 40;

/// Score assigned to a checkmate, adjusted by ply so that faster mates are
/// preferred. Chosen well above any realistic material swing but below `i32`
/// extremes so ply adjustment can't overflow.
const MATE_SCORE: i32 = 1_000_000;

/// A stable position key: the FEN with the halfmove and fullmove counters
/// stripped, i.e. piece placement + side to move + castling + en passant.
///
/// Two positions with the same key are the same for repetition purposes.
#[must_use]
pub fn position_key(board: &Board) -> String {
    let fen = board.to_fen();
    // Keep the first four space-separated fields.
    fen.split(' ').take(4).collect::<Vec<_>>().join(" ")
}

/// Mutable search state threaded through the recursion.
struct Searcher<'a> {
    nodes: u64,
    /// Set once the node budget is exhausted; unwinds the current iteration.
    aborted: bool,
    seen: &'a BTreeSet<String>,
}

impl Searcher<'_> {
    /// Quiescence search: at a leaf, keep exploring only captures and
    /// promotions so the static eval is never taken mid-trade.
    fn quiescence(&mut self, board: &Board, mut alpha: i32, beta: i32) -> i32 {
        self.nodes += 1;
        if self.nodes >= MAX_NODES {
            self.aborted = true;
            return 0;
        }

        let mut moves = board.generate_legal_moves();

        // In check you cannot "stand pat" — passing is illegal, so an evasion is
        // mandatory. Search every legal reply (not just tactical ones); if there
        // are none it is checkmate at the horizon and scores as a loss.
        if board.is_in_check(board.side_to_move()) {
            if moves.is_empty() {
                return -MATE_SCORE;
            }
        } else {
            let stand_pat = evaluate(board);
            if stand_pat >= beta {
                return beta;
            }
            if stand_pat > alpha {
                alpha = stand_pat;
            }
            moves.retain(|&mv| is_tactical(board, mv));
        }
        order_moves(board, &mut moves);

        for mv in moves {
            let mut child = board.clone();
            if !child.make_move(mv) {
                continue;
            }
            let score = -self.quiescence(&child, -beta, -alpha);
            if self.aborted {
                return 0;
            }
            if score >= beta {
                return beta;
            }
            if score > alpha {
                alpha = score;
            }
        }

        alpha
    }

    /// Negamax with alpha-beta. `depth` is remaining plies; `ply` is distance
    /// from the root (used to prefer faster mates).
    fn negamax(&mut self, board: &Board, depth: u32, ply: u32, mut alpha: i32, beta: i32) -> i32 {
        self.nodes += 1;
        if self.nodes >= MAX_NODES {
            self.aborted = true;
            return 0;
        }

        let mut moves = board.generate_legal_moves();

        // Terminal detection from the move list avoids a second, redundant
        // legal-move generation (which `Board::game_state` would do).
        if moves.is_empty() {
            return if board.is_in_check(board.side_to_move()) {
                // Checkmated: worst possible, and sooner mates are worse for us.
                -MATE_SCORE + ply.cast_signed()
            } else {
                0 // stalemate
            };
        }

        if depth == 0 {
            return self.quiescence(board, alpha, beta);
        }

        order_moves(board, &mut moves);

        // Sentinel below any real score; the move list is non-empty here (the
        // terminal check above returned early), so the first legal move always
        // overwrites it.
        let mut best = -MATE_SCORE - 1;
        for mv in moves {
            let mut child = board.clone();
            if !child.make_move(mv) {
                continue;
            }
            let score = -self.negamax(&child, depth - 1, ply + 1, -beta, -alpha);
            if self.aborted {
                return 0;
            }
            if score > best {
                best = score;
            }
            if score > alpha {
                alpha = score;
            }
            if alpha >= beta {
                break;
            }
        }

        best
    }
}

/// True for moves that quiescence should keep exploring: captures (a piece on
/// the destination square), en passant, and promotions.
fn is_tactical(board: &Board, mv: Move) -> bool {
    matches!(mv.kind(), MoveKind::EnPassant | MoveKind::Promotion(_))
        || board.piece_at(mv.to()).is_some()
}

/// Chooses the best move for the side to move on `board`, or `None` if there
/// are no legal moves (checkmate or stalemate).
///
/// Runs iterative deepening from depth 1 up to [`MAX_DEPTH`], stopping early if
/// the [`MAX_NODES`] budget is hit, and always returns the best move from the
/// last fully-completed depth. Moves that re-enter a position in
/// `seen_positions` receive a small [`REPETITION_PENALTY`] at the root so the
/// bot avoids needless repetition without ever passing up real material.
#[must_use]
pub fn best_move(board: &Board, seen_positions: &BTreeSet<String>) -> Option<Move> {
    let mut root_moves = board.generate_legal_moves();
    if root_moves.is_empty() {
        return None;
    }
    order_moves(board, &mut root_moves);

    // Best move found across all *completed* iterations.
    let mut best_move = root_moves[0];

    for depth in 1..=MAX_DEPTH {
        let mut searcher = Searcher {
            nodes: 0,
            aborted: false,
            seen: seen_positions,
        };

        let mut alpha = -MATE_SCORE - 1;
        let beta = MATE_SCORE + 1;
        let mut iteration_best = root_moves[0];
        let mut iteration_best_score = i32::MIN;

        for &mv in &root_moves {
            let mut child = board.clone();
            if !child.make_move(mv) {
                continue;
            }

            let raw = -searcher.negamax(&child, depth - 1, 1, -beta, -alpha);

            if searcher.aborted {
                break;
            }

            // Repetition penalty at the root only: nudge away from repeats, but
            // only in balanced positions (never decline a win or a saving draw).
            let repeats = searcher.seen.contains(&position_key(&child));
            let score = repetition_adjusted_score(raw, repeats);

            if score > iteration_best_score {
                iteration_best_score = score;
                iteration_best = mv;
            }
            if score > alpha {
                alpha = score;
            }
        }

        if searcher.aborted {
            // Iteration incomplete: keep the previous depth's result.
            break;
        }

        best_move = iteration_best;

        // Order the next iteration's root with the best move first for stronger
        // pruning and stable, deterministic tie-breaking.
        if let Some(pos) = root_moves.iter().position(|&m| m == best_move) {
            root_moves.swap(0, pos);
        }
    }

    Some(best_move)
}

/// Score margin (centipawns) beyond which a position is "decided" — a genuine
/// material or mate advantage for one side. The repetition nudge only applies
/// inside this balanced band.
const DECIDED_MARGIN: i32 = 200;

/// Adjusts a root move's raw negamax score for repetition.
///
/// A move that re-enters an already-seen position is nudged away from by
/// [`REPETITION_PENALTY`], but *only* when the position is roughly balanced
/// (`|raw| < DECIDED_MARGIN`). When we are clearly winning we never decline a
/// repeat that preserves the win, and — just as importantly — when we are
/// clearly losing we never decline a repeat that salvages a draw.
const fn repetition_adjusted_score(raw: i32, repeats: bool) -> i32 {
    if repeats && raw > -DECIDED_MARGIN && raw < DECIDED_MARGIN {
        raw - REPETITION_PENALTY
    } else {
        raw
    }
}

/// Test-only hook to exercise the private quiescence search directly.
#[cfg(test)]
fn quiescence_score(board: &Board) -> i32 {
    let seen = BTreeSet::new();
    let mut searcher = Searcher { nodes: 0, aborted: false, seen: &seen };
    searcher.quiescence(board, -MATE_SCORE - 1, MATE_SCORE + 1)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chess_engine::{Board, GameState};

    fn no_history() -> BTreeSet<String> {
        BTreeSet::new()
    }

    #[test]
    fn position_key_strips_counters() {
        let board = Board::new();
        assert_eq!(
            position_key(&board),
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
        );
    }

    #[test]
    fn captures_free_queen() {
        // Black queen on d5 hangs; White rook on d1 can take it up the file.
        let board = Board::from_fen("4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1").expect("valid fen");
        let mv = best_move(&board, &no_history()).expect("a move exists");
        assert_eq!(
            board.piece_at(mv.to()).map(chess_engine::Piece::piece_type),
            Some(chess_engine::PieceType::Queen),
            "should capture the hanging queen, played {}",
            mv.to_uci()
        );
    }

    #[test]
    fn finds_mate_in_one() {
        // Back-rank mate: White rook a1 -> a8 is mate. Black king h8, pawns
        // f7/g7/h7 box it in; White king g1.
        let mut board =
            Board::from_fen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1").expect("valid fen");
        let mv = best_move(&board, &no_history()).expect("a move exists");
        assert!(board.make_move(mv), "move must be legal");
        assert_eq!(
            board.game_state(),
            GameState::Checkmate,
            "expected mate, played {}",
            mv.to_uci()
        );
    }

    #[test]
    fn does_not_hang_the_queen() {
        // White queen on d1. If it goes to d5 it is captured by the pawn on c6
        // or e6... construct: White Qd1, Black pawns c6,e6 and king e8; White
        // king e1. Qd5 loses the queen to ...cxd5 / ...exd5. A safe developing
        // move (e.g. Qd4, unattacked) must be preferred.
        let board =
            Board::from_fen("4k3/8/2p1p3/8/8/8/8/3QK3 w - - 0 1").expect("valid fen");
        let mv = best_move(&board, &no_history()).expect("a move exists");
        // The queen must not step onto d5 where it hangs.
        assert_ne!(mv.to_uci(), "d1d5", "bot hung its queen on d5");
        // The chosen move must be legal.
        assert!(board.generate_legal_moves().contains(&mv));
    }

    #[test]
    fn no_move_at_checkmate() {
        // Fool's mate final position: Black has delivered mate, White to move,
        // no legal moves.
        let board = Board::from_fen(
            "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
        )
        .expect("valid fen");
        assert_eq!(board.game_state(), GameState::Checkmate);
        assert!(best_move(&board, &no_history()).is_none());
    }

    #[test]
    fn no_move_at_stalemate() {
        // Verified stalemate: Black king a8; White queen b6 covers a7/b7/b8;
        // White king a1. Black is not in check but has no legal move.
        let board = Board::from_fen("k7/8/1Q6/8/8/8/8/K7 b - - 0 1").expect("valid fen");
        assert_eq!(
            board.game_state(),
            GameState::Stalemate,
            "test fixture must actually be a stalemate"
        );
        assert!(best_move(&board, &no_history()).is_none());
    }

    #[test]
    fn promotes_to_a_queen() {
        // A lone White pawn one step from queening; the winning move is to
        // promote, and a queen is the most valuable choice.
        let board = Board::from_fen("4k3/P7/8/8/8/8/8/4K3 w - - 0 1").expect("valid fen");
        let mv = best_move(&board, &no_history()).expect("a move exists");
        assert_eq!(
            mv.promotion_piece(),
            Some(chess_engine::PieceType::Queen),
            "should promote to a queen, played {}",
            mv.to_uci()
        );
    }

    #[test]
    fn does_not_make_a_losing_capture() {
        // The rook on d1 can grab the pawn on d5, but it is defended twice
        // (c6, e6): RxP?? loses the rook for a pawn. Quiescence must see the
        // recapture, so the bot must not play d1d5.
        let board =
            Board::from_fen("4k3/8/2p1p3/3p4/8/8/8/3RK3 w - - 0 1").expect("valid fen");
        let mv = best_move(&board, &no_history()).expect("a move exists");
        assert_ne!(mv.to_uci(), "d1d5", "bot walked into losing a rook for a pawn");
    }

    #[test]
    fn quiescence_scores_mate_at_the_horizon_as_mate() {
        // Fool's mate: White is checkmated with roughly equal material, so a
        // naive stand-pat would read the position as near-even. Quiescence must
        // recognise the side to move is in check with no escape and score it as
        // a loss, not the static material balance.
        let board = Board::from_fen(
            "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
        )
        .expect("valid fen");
        assert_eq!(board.game_state(), GameState::Checkmate);
        assert_eq!(
            quiescence_score(&board),
            -MATE_SCORE,
            "in-check mate at the quiescence horizon must score as a loss"
        );
    }

    #[test]
    fn repetition_penalises_only_balanced_repeats() {
        // Balanced position: a repeat is nudged; a non-repeat is untouched.
        assert!(repetition_adjusted_score(10, true) < 10);
        assert_eq!(repetition_adjusted_score(10, false), 10);
        // A clear win must never be declined to avoid a repeat.
        assert_eq!(repetition_adjusted_score(900, true), 900);
        // A clear loss must never be declined either — a repeat may be a
        // saving draw, which we must be willing to take.
        assert_eq!(repetition_adjusted_score(-900, true), -900);
    }

    #[test]
    fn returned_move_is_always_legal() {
        let board = Board::new();
        let mv = best_move(&board, &no_history()).expect("a move exists");
        assert!(board.generate_legal_moves().contains(&mv));
    }

    #[test]
    fn is_deterministic() {
        let board = Board::new();
        let history = no_history();
        let first = best_move(&board, &history).expect("a move");
        for _ in 0..5 {
            assert_eq!(best_move(&board, &history), Some(first));
        }
    }

    #[test]
    fn avoids_repetition_when_equal() {
        // A position with two symmetric-ish quiet options of roughly equal value;
        // if one re-enters a seen position and the other does not, prefer the new
        // one. We build it by seeding `seen` with the position that a specific
        // move would create, then asserting the bot does not play that move when
        // an equal alternative exists.
        // White king e1, Black king e8, White rook on a1. Rook can shuffle a1-b1
        // etc. Seed the position after Ra1-a2.
        let board = Board::from_fen("4k3/8/8/8/8/8/8/R3K3 w - - 0 1").expect("valid fen");
        let mut after_a2 = board.clone();
        let a1a2 = Move::from_uci("a1a2").expect("uci");
        assert!(after_a2.make_move(a1a2));

        let mut seen = BTreeSet::new();
        seen.insert(position_key(&after_a2));

        let mv = best_move(&board, &seen).expect("a move");
        assert_ne!(
            mv.to_uci(),
            "a1a2",
            "should avoid re-entering the seen position when equal alternatives exist"
        );
    }

    #[test]
    fn takes_material_even_if_it_repeats() {
        // A winning capture must be played even if its resulting position is in
        // `seen`. Black queen hangs on d5; seed the post-capture position.
        let board = Board::from_fen("4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1").expect("valid fen");
        let capture = Move::from_uci("d1d5").expect("uci");
        let mut after = board.clone();
        assert!(after.make_move(capture));

        let mut seen = BTreeSet::new();
        seen.insert(position_key(&after));

        let mv = best_move(&board, &seen).expect("a move");
        assert_eq!(
            mv.to_uci(),
            "d1d5",
            "must still grab the free queen despite the repetition penalty"
        );
    }
}

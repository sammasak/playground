//! A bitboard-based chess engine compiled to WebAssembly.
//!
//! # Architecture
//!
//! - [`types`] — Domain types: [`Square`](types::Square), [`Piece`](types::Piece),
//!   [`Move`](types::Move), [`CastlingRights`](types::CastlingRights), etc.
//! - [`board`] — All game logic: move generation, legality, application, game state.
//! - [`wasm`] — WASM Component Model bindings via `wit_bindgen`.
//!
//! The engine uses precomputed attack tables (knight, king, pawn, and ray attacks)
//! initialized lazily via `OnceLock`. Move generation produces pseudo-legal moves,
//! then filters for legality by testing each move against king safety.

pub mod board;
pub mod types;
#[cfg(target_arch = "wasm32")]
pub mod wasm;

pub use board::Board;
pub use types::{CastlingRights, Color, GameState, Move, MoveKind, Piece, PieceType, Square};

#[cfg(test)]
mod tests {
    use crate::board::Board;
    use crate::types::{Color, GameState, Move, PieceType, Square};

    #[test]
    fn new_game_board_state() {
        let board = Board::new();
        assert_eq!(board.side_to_move(), Color::White);
        assert!(board.castling().white_kingside());
    }

    #[test]
    fn make_move_and_history() {
        let mut board = Board::new();
        assert!(board.make_move(Move::from_uci("e2e4").unwrap()));
        assert!(!board.make_move(Move::from_uci("e2e4").unwrap()));
    }

    #[test]
    fn from_fen_invalid() {
        assert!(Board::from_fen("invalid").is_none());
    }

    #[test]
    fn get_legal_moves() {
        let board = Board::new();
        assert!(board.generate_legal_moves().iter().map(Move::to_uci).any(|m| m == "e2e4"));
    }

    #[test]
    fn get_piece_at_valid() {
        let board = Board::new();
        let piece = board.piece_at(Square::from_index(4)); // e1
        assert!(piece.is_some());
        let p = piece.unwrap();
        assert_eq!(p.piece_type(), PieceType::King);
        assert_eq!(p.color(), Color::White);
    }

    #[test]
    fn get_piece_at_empty() {
        let board = Board::new();
        assert!(board.piece_at(Square::from_index(28)).is_none()); // e4
    }

    #[test]
    fn reset_clears_state() {
        let mut board = Board::new();
        board.make_move(Move::from_uci("e2e4").unwrap());
        let fresh = Board::new();
        assert_eq!(fresh.to_fen(), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    }

    #[test]
    fn game_state_in_progress() {
        let board = Board::new();
        assert_eq!(board.game_state(), GameState::InProgress);
        assert!(!board.is_in_check(Color::White));
    }

    #[test]
    fn no_moves_after_checkmate() {
        let board = Board::from_fen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3").unwrap();
        assert_eq!(board.game_state(), GameState::Checkmate);
        assert!(board.generate_legal_moves().is_empty());
    }

    #[test]
    fn make_move_fails_after_checkmate() {
        let mut board = Board::from_fen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3").unwrap();
        assert_eq!(board.game_state(), GameState::Checkmate);
        assert!(!board.make_move(Move::from_uci("a2a3").unwrap()));
        assert!(!board.make_move(Move::from_uci("e2e4").unwrap()));
    }

    #[test]
    fn scholars_mate() {
        let mut board = Board::new();
        assert!(board.make_move(Move::from_uci("e2e4").unwrap()));
        assert!(board.make_move(Move::from_uci("e7e5").unwrap()));
        assert!(board.make_move(Move::from_uci("d1h5").unwrap()));
        assert!(board.make_move(Move::from_uci("b8c6").unwrap()));
        assert!(board.make_move(Move::from_uci("f1c4").unwrap()));
        assert!(board.make_move(Move::from_uci("g8f6").unwrap()));
        assert!(board.make_move(Move::from_uci("h5f7").unwrap()));
        assert_eq!(board.game_state(), GameState::Checkmate);
    }

    #[test]
    fn invalid_uci_doesnt_corrupt() {
        let mut board = Board::new();
        let fen_before = board.to_fen();
        assert!(!board.make_move(Move::from_uci("e2e5").unwrap()));
        assert!(!board.make_move(Move::from_uci("e7e5").unwrap()));
        assert_eq!(board.to_fen(), fen_before);
    }

    #[test]
    fn reset_after_game_over() {
        let board = Board::from_fen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3").unwrap();
        assert_eq!(board.game_state(), GameState::Checkmate);
        let mut fresh = Board::new();
        assert_eq!(fresh.game_state(), GameState::InProgress);
        assert_eq!(fresh.to_fen(), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
        assert!(fresh.make_move(Move::from_uci("e2e4").unwrap()));
    }
}

//! WASM Component Model bindings — maps the WIT `chess:engine` resource to [`crate::board::Board`].
//!
//! Uses `wit_bindgen::generate!` to implement the `game` resource defined in
//! `wit/chess-engine/engine.wit`. All game logic lives in [`crate::board::Board`];
//! this module only handles type conversion between Rust and WIT types.

#[allow(clippy::all)]
mod bindings {
    wit_bindgen::generate!({
        path: "../wit/chess-engine",
        world: "chess-engine",
        generate_all,
    });
}

use bindings::exports::chess::engine::engine::{
    self as wit, Guest, GuestGame,
};
use bindings::chess::types::types as wit_types;

use std::cell::RefCell;

use crate::board::Board;
use crate::types::{
    CastlingRights, Color, GameState, Move, Piece, PieceType, Square,
};

struct EngineComponent;

impl Guest for EngineComponent {
    type Game = GameResource;
}

pub struct GameResource {
    inner: RefCell<GameInner>,
}

struct GameInner {
    board: Board,
    history: Vec<(String, String)>, // (uci_move, resulting_fen)
}

impl GuestGame for GameResource {
    fn new() -> Self {
        Self {
            inner: RefCell::new(GameInner {
                board: Board::new(),
                history: Vec::new(),
            }),
        }
    }

    fn from_fen(fen: String) -> Result<wit::Game, wit_types::EngineError> {
        match Board::from_fen(&fen) {
            Some(board) => Ok(wit::Game::new(Self {
                inner: RefCell::new(GameInner {
                    board,
                    history: Vec::new(),
                }),
            })),
            None => Err(wit_types::EngineError::InvalidFen),
        }
    }

    fn get_fen(&self) -> String {
        self.inner.borrow().board.to_fen()
    }

    fn get_board_state(&self) -> wit_types::BoardState {
        let inner = self.inner.borrow();
        let squares: Vec<Option<wit_types::Piece>> = (0..64)
            .map(|i| inner.board.piece_at(Square::from_index(i)).map(piece_to_wit))
            .collect();

        wit_types::BoardState {
            squares,
            turn: color_to_wit(inner.board.side_to_move()),
            castling_rights: castling_to_wit(inner.board.castling()),
            en_passant: inner.board.en_passant().map(Square::raw),
            halfmove_clock: inner.board.halfmove_clock(),
            fullmove_number: inner.board.fullmove_number(),
            move_history: history_to_wit(&inner.history),
        }
    }

    fn get_legal_moves(&self) -> Vec<String> {
        self.inner
            .borrow()
            .board
            .generate_legal_moves()
            .iter()
            .map(Move::to_uci)
            .collect()
    }

    fn make_move(&self, uci: String) -> Result<(), wit_types::EngineError> {
        let mut inner = self.inner.borrow_mut();

        let state = inner.board.game_state();
        if state != GameState::InProgress {
            return Err(wit_types::EngineError::GameOver);
        }

        let Some(mv) = Move::from_uci(&uci) else {
            return Err(wit_types::EngineError::IllegalMove);
        };

        if inner.board.make_move(mv) {
            let fen = inner.board.to_fen();
            inner.history.push((uci, fen));
            Ok(())
        } else {
            Err(wit_types::EngineError::IllegalMove)
        }
    }

    fn get_game_result(&self) -> wit_types::GameResult {
        match self.inner.borrow().board.game_state() {
            GameState::InProgress => wit_types::GameResult::InProgress,
            GameState::Checkmate => wit_types::GameResult::Checkmate,
            GameState::Stalemate => wit_types::GameResult::Stalemate,
            GameState::Draw => wit_types::GameResult::Draw,
        }
    }

    fn is_check(&self) -> bool {
        let inner = self.inner.borrow();
        inner.board.is_in_check(inner.board.side_to_move())
    }

    fn get_turn(&self) -> wit_types::Color {
        color_to_wit(self.inner.borrow().board.side_to_move())
    }

    fn get_piece_at(&self, sq: u8) -> Option<wit_types::Piece> {
        if sq >= 64 {
            return None;
        }
        self.inner
            .borrow()
            .board
            .piece_at(Square::from_index(sq))
            .map(piece_to_wit)
    }

    fn get_move_history(&self) -> Vec<wit_types::MoveHistoryEntry> {
        history_to_wit(&self.inner.borrow().history)
    }

    fn reset(&self) {
        let mut inner = self.inner.borrow_mut();
        inner.board = Board::new();
        inner.history.clear();
    }
}

fn history_to_wit(history: &[(String, String)]) -> Vec<wit_types::MoveHistoryEntry> {
    history
        .iter()
        .map(|(uci, fen)| wit_types::MoveHistoryEntry {
            uci_move: uci.clone(),
            resulting_fen: fen.clone(),
        })
        .collect()
}

// --- Type conversion helpers ---

fn piece_to_wit(p: Piece) -> wit_types::Piece {
    wit_types::Piece {
        piece_type: piece_type_to_wit(p.piece_type()),
        color: color_to_wit(p.color()),
    }
}

fn piece_type_to_wit(pt: PieceType) -> wit_types::PieceType {
    match pt {
        PieceType::Pawn => wit_types::PieceType::Pawn,
        PieceType::Knight => wit_types::PieceType::Knight,
        PieceType::Bishop => wit_types::PieceType::Bishop,
        PieceType::Rook => wit_types::PieceType::Rook,
        PieceType::Queen => wit_types::PieceType::Queen,
        PieceType::King => wit_types::PieceType::King,
    }
}

fn color_to_wit(c: Color) -> wit_types::Color {
    match c {
        Color::White => wit_types::Color::White,
        Color::Black => wit_types::Color::Black,
    }
}

fn castling_to_wit(c: CastlingRights) -> wit_types::Castling {
    wit_types::Castling {
        white_kingside: c.white_kingside(),
        white_queenside: c.white_queenside(),
        black_kingside: c.black_kingside(),
        black_queenside: c.black_queenside(),
    }
}

bindings::export!(EngineComponent with_types_in bindings);

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

//! Piece-square tables from Michniewski's "Simplified Evaluation Function"
//! (<https://www.chessprogramming.org/Simplified_Evaluation_Function>).
//!
//! Each table is a `[i32; 64]` centipawn bonus indexed by
//! [`Square::index`](chess_engine::Square::index) — i.e. index `0` is `a1`,
//! index `7` is `h1`, index `56` is `a8`, index `63` is `h8`. Rank 1 (the
//! White back rank) comes first.
//!
//! All tables are written from **White's** point of view. To evaluate a Black
//! piece, mirror the square vertically with [`mirror`] before indexing, which
//! flips the rank while keeping the file (a Black knight on the "7th rank from
//! Black's side" gets the same bonus a White knight would on its own 7th rank).

/// Mirrors a square index vertically (flips rank, keeps file).
///
/// Used to look a Black piece up in a White-POV table: `table[mirror(idx)]`.
#[must_use]
pub const fn mirror(index: usize) -> usize {
    index ^ 56
}

/// Pawn table: rewards central advance, discourages sitting on the back ranks.
#[rustfmt::skip]
pub const PAWN: [i32; 64] = [
    // rank 1 (a1..h1)
      0,   0,   0,   0,   0,   0,   0,   0,
      5,  10,  10, -20, -20,  10,  10,   5,
      5,  -5, -10,   0,   0, -10,  -5,   5,
      0,   0,   0,  20,  20,   0,   0,   0,
      5,   5,  10,  25,  25,  10,   5,   5,
     10,  10,  20,  30,  30,  20,  10,  10,
     50,  50,  50,  50,  50,  50,  50,  50,
    // rank 8
      0,   0,   0,   0,   0,   0,   0,   0,
];

/// Knight table: strongly rewards central squares ("a knight on the rim is dim").
#[rustfmt::skip]
pub const KNIGHT: [i32; 64] = [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20,   0,   5,   5,   0, -20, -40,
    -30,   5,  10,  15,  15,  10,   5, -30,
    -30,   0,  15,  20,  20,  15,   0, -30,
    -30,   5,  15,  20,  20,  15,   5, -30,
    -30,   0,  10,  15,  15,  10,   0, -30,
    -40, -20,   0,   0,   0,   0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
];

/// Bishop table: rewards long diagonals and discourages back-rank corners.
#[rustfmt::skip]
pub const BISHOP: [i32; 64] = [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10,   5,   0,   0,   0,   0,   5, -10,
    -10,  10,  10,  10,  10,  10,  10, -10,
    -10,   0,  10,  10,  10,  10,   0, -10,
    -10,   5,   5,  10,  10,   5,   5, -10,
    -10,   0,   5,  10,  10,   5,   0, -10,
    -10,   0,   0,   0,   0,   0,   0, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
];

/// Rook table: rewards the 7th rank and central files, penalises the flanks.
#[rustfmt::skip]
pub const ROOK: [i32; 64] = [
      0,   0,   0,   5,   5,   0,   0,   0,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
      5,  10,  10,  10,  10,  10,  10,   5,
      0,   0,   0,   0,   0,   0,   0,   0,
];

/// Queen table: mild centralisation preference.
#[rustfmt::skip]
pub const QUEEN: [i32; 64] = [
    -20, -10, -10,  -5,  -5, -10, -10, -20,
    -10,   0,   5,   0,   0,   0,   0, -10,
    -10,   5,   5,   5,   5,   5,   0, -10,
      0,   0,   5,   5,   5,   5,   0,  -5,
     -5,   0,   5,   5,   5,   5,   0,  -5,
    -10,   0,   5,   5,   5,   5,   0, -10,
    -10,   0,   0,   0,   0,   0,   0, -10,
    -20, -10, -10,  -5,  -5, -10, -10, -20,
];

/// King table for the middlegame: rewards castled safety, penalises the centre.
#[rustfmt::skip]
pub const KING_MIDDLEGAME: [i32; 64] = [
     20,  30,  10,   0,   0,  10,  30,  20,
     20,  20,   0,   0,   0,   0,  20,  20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
];

//! Domain types for the chess engine.
//!
//! Every type here models a chess concept with strong compile-time guarantees:
//! [`Square`] enforces `0..64`, [`MoveKind`] is mutually exclusive by construction,
//! and [`CastlingRights`] is a compact bitfield with a safe public API.

use std::fmt;

// ---------------------------------------------------------------------------
// Square — a valid board index in 0..64, encoding file + rank as rank*8+file.
// ---------------------------------------------------------------------------

/// A square on the chess board, stored as `rank * 8 + file` in `0..64`.
///
/// The invariant `index < 64` is enforced by every constructor:
/// - [`Square::new`] and [`Square::from_index`] panic on out-of-range input.
/// - [`Square::from_algebraic`] returns `None` for invalid strings.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub struct Square(u8);

impl Square {
    /// Creates a square from file (0=a … 7=h) and rank (0=1 … 7=8).
    ///
    /// # Panics
    ///
    /// Panics if `file >= 8` or `rank >= 8`.
    #[must_use]
    pub const fn new(file: u8, rank: u8) -> Self {
        assert!(file < 8, "file must be 0..8");
        assert!(rank < 8, "rank must be 0..8");
        Self(rank * 8 + file)
    }

    /// Creates a square from a raw index in `0..64`.
    ///
    /// # Panics
    ///
    /// Panics if `i >= 64`.
    #[must_use]
    pub const fn from_index(i: u8) -> Self {
        assert!(i < 64, "square index must be 0..64");
        Self(i)
    }

    /// Returns the array index (`0..64`).
    #[inline]
    #[must_use]
    pub const fn index(self) -> usize {
        self.0 as usize
    }

    /// Returns the rank (`0..8`, where 0 = rank 1).
    #[inline]
    #[must_use]
    pub const fn rank(self) -> u8 {
        self.0 / 8
    }

    /// Returns the file (`0..8`, where 0 = file a).
    #[inline]
    #[must_use]
    pub const fn file(self) -> u8 {
        self.0 % 8
    }

    /// Returns the raw `u8` value (same as `index` but typed as `u8`).
    #[inline]
    #[must_use]
    pub const fn raw(self) -> u8 {
        self.0
    }

    /// Parses algebraic notation like `"e4"`. Returns `None` if the string is
    /// not exactly two characters or contains invalid file/rank.
    #[must_use]
    pub fn from_algebraic(s: &str) -> Option<Self> {
        let bytes = s.as_bytes();
        if bytes.len() != 2 {
            return None;
        }
        let file = bytes[0].wrapping_sub(b'a');
        let rank = bytes[1].wrapping_sub(b'1');
        if file < 8 && rank < 8 {
            Some(Self::new(file, rank))
        } else {
            None
        }
    }

    /// Returns a bitboard with only this square set.
    #[must_use]
    pub const fn bitboard(self) -> u64 {
        1u64 << self.0
    }
}

impl fmt::Display for Square {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{}{}",
            (b'a' + self.file()) as char,
            (b'1' + self.rank()) as char,
        )
    }
}

// ---------------------------------------------------------------------------
// PieceType, Color, Piece
// ---------------------------------------------------------------------------

/// One of the six chess piece types.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum PieceType {
    Pawn = 0,
    Knight = 1,
    Bishop = 2,
    Rook = 3,
    Queen = 4,
    King = 5,
}

impl PieceType {
    /// All six piece types, ordered by value (pawn first, king last).
    pub const ALL: [Self; 6] = [
        Self::Pawn,
        Self::Knight,
        Self::Bishop,
        Self::Rook,
        Self::Queen,
        Self::King,
    ];

    /// The four piece types a pawn may promote to.
    pub const PROMOTABLE: [Self; 4] = [Self::Queen, Self::Rook, Self::Bishop, Self::Knight];

    /// Returns the UCI promotion character (`q`, `r`, `b`, `n`).
    ///
    /// # Panics
    ///
    /// Panics if called on `Pawn` or `King` (not promotion targets).
    #[must_use]
    pub fn to_uci_char(self) -> char {
        match self {
            Self::Queen => 'q',
            Self::Rook => 'r',
            Self::Bishop => 'b',
            Self::Knight => 'n',
            Self::Pawn | Self::King => unreachable!("not a promotion piece"),
        }
    }

    /// Parses a UCI promotion character. Case-insensitive.
    #[must_use]
    pub const fn from_uci_char(c: u8) -> Option<Self> {
        match c {
            b'q' | b'Q' => Some(Self::Queen),
            b'r' | b'R' => Some(Self::Rook),
            b'b' | b'B' => Some(Self::Bishop),
            b'n' | b'N' => Some(Self::Knight),
            _ => None,
        }
    }
}

impl fmt::Display for PieceType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Pawn => "pawn",
            Self::Knight => "knight",
            Self::Bishop => "bishop",
            Self::Rook => "rook",
            Self::Queen => "queen",
            Self::King => "king",
        })
    }
}

/// Side to move: White or Black.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum Color {
    White = 0,
    Black = 1,
}

impl Color {
    /// Returns the other color.
    #[inline]
    #[must_use]
    pub const fn opposite(self) -> Self {
        match self {
            Self::White => Self::Black,
            Self::Black => Self::White,
        }
    }

    /// Returns `0` for White, `1` for Black — suitable for array indexing.
    #[inline]
    #[must_use]
    pub const fn index(self) -> usize {
        self as usize
    }
}

impl fmt::Display for Color {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::White => "white",
            Self::Black => "black",
        })
    }
}

/// A piece on the board (type + color).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Piece {
    piece_type: PieceType,
    color: Color,
}

impl Piece {
    /// Creates a new piece.
    #[must_use]
    pub const fn new(piece_type: PieceType, color: Color) -> Self {
        Self { piece_type, color }
    }

    /// Returns the piece type.
    #[inline]
    #[must_use]
    pub const fn piece_type(self) -> PieceType {
        self.piece_type
    }

    /// Returns the piece color.
    #[inline]
    #[must_use]
    pub const fn color(self) -> Color {
        self.color
    }

    /// Converts to a FEN character (uppercase = White, lowercase = Black).
    #[must_use]
    pub const fn to_fen_char(self) -> char {
        let base = match self.piece_type {
            PieceType::Pawn => 'p',
            PieceType::Knight => 'n',
            PieceType::Bishop => 'b',
            PieceType::Rook => 'r',
            PieceType::Queen => 'q',
            PieceType::King => 'k',
        };
        match self.color {
            Color::White => base.to_ascii_uppercase(),
            Color::Black => base,
        }
    }

    /// Parses a FEN piece character. Returns `None` for invalid input.
    #[must_use]
    pub const fn from_fen_char(c: char) -> Option<Self> {
        let color = if c.is_ascii_uppercase() {
            Color::White
        } else {
            Color::Black
        };
        let piece_type = match c.to_ascii_lowercase() {
            'p' => PieceType::Pawn,
            'n' => PieceType::Knight,
            'b' => PieceType::Bishop,
            'r' => PieceType::Rook,
            'q' => PieceType::Queen,
            'k' => PieceType::King,
            _ => return None,
        };
        Some(Self { piece_type, color })
    }
}

// ---------------------------------------------------------------------------
// Move — from/to with a kind that enforces mutual exclusivity.
//
// `MoveKind` makes it impossible to have conflicting flags: a move is exactly
// one of Normal, Castle, EnPassant, or Promotion(piece).
// ---------------------------------------------------------------------------

/// Classifies a move — mutually exclusive by construction.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MoveKind {
    /// A regular move or capture.
    Normal,
    /// A castling move (king moves two squares toward a rook).
    Castle,
    /// An en-passant capture.
    EnPassant,
    /// A pawn promotion to the given piece type.
    Promotion(PieceType),
}

/// A chess move: source square, destination square, and classification.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Move {
    from: Square,
    to: Square,
    kind: MoveKind,
}

impl Move {
    /// A standard (non-special) move.
    #[must_use]
    pub const fn normal(from: Square, to: Square) -> Self {
        Self { from, to, kind: MoveKind::Normal }
    }

    /// A pawn promotion move.
    #[must_use]
    pub const fn promotion(from: Square, to: Square, piece: PieceType) -> Self {
        Self { from, to, kind: MoveKind::Promotion(piece) }
    }

    /// A castling move (king's from/to squares).
    #[must_use]
    pub const fn castle(from: Square, to: Square) -> Self {
        Self { from, to, kind: MoveKind::Castle }
    }

    /// An en-passant capture.
    #[must_use]
    pub const fn en_passant(from: Square, to: Square) -> Self {
        Self { from, to, kind: MoveKind::EnPassant }
    }

    /// Returns the source square.
    #[inline]
    #[must_use]
    pub const fn from(self) -> Square {
        self.from
    }

    /// Returns the destination square.
    #[inline]
    #[must_use]
    pub const fn to(self) -> Square {
        self.to
    }

    /// Returns the move classification.
    #[inline]
    #[must_use]
    pub const fn kind(self) -> MoveKind {
        self.kind
    }

    /// Returns the promotion piece, if this is a promotion move.
    #[must_use]
    pub const fn promotion_piece(&self) -> Option<PieceType> {
        match self.kind {
            MoveKind::Promotion(pt) => Some(pt),
            _ => None,
        }
    }

    /// Formats as a UCI string (e.g. `"e2e4"`, `"e7e8q"`).
    #[must_use]
    pub fn to_uci(&self) -> String {
        let mut s = format!("{}{}", self.from, self.to);
        if let MoveKind::Promotion(pt) = self.kind {
            s.push(pt.to_uci_char());
        }
        s
    }

    /// Parses a UCI move string (exactly 4 or 5 characters, e.g. `"e2e4"`, `"e7e8q"`).
    ///
    /// The returned `MoveKind` is `Normal` for non-promotions; the board's
    /// legal move generator determines the true kind (castle, en passant, etc.)
    /// during [`crate::board::Board::make_move`].
    #[must_use]
    pub fn from_uci(uci: &str) -> Option<Self> {
        if uci.len() < 4 || uci.len() > 5 {
            return None;
        }
        let bytes = uci.as_bytes();
        let from_file = bytes[0].wrapping_sub(b'a');
        let from_rank = bytes[1].wrapping_sub(b'1');
        let to_file = bytes[2].wrapping_sub(b'a');
        let to_rank = bytes[3].wrapping_sub(b'1');

        if from_file > 7 || from_rank > 7 || to_file > 7 || to_rank > 7 {
            return None;
        }

        let from = Square::new(from_file, from_rank);
        let to = Square::new(to_file, to_rank);

        let kind = if uci.len() > 4 {
            match PieceType::from_uci_char(bytes[4]) {
                Some(pt) => MoveKind::Promotion(pt),
                None => return None,
            }
        } else {
            MoveKind::Normal
        };

        Some(Self { from, to, kind })
    }
}

impl fmt::Display for Move {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}{}", self.from, self.to)?;
        if let MoveKind::Promotion(pt) = self.kind {
            write!(f, "{}", pt.to_uci_char())?;
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// CastlingRights — stored as a `u8` bitfield for compact, branchless updates.
// ---------------------------------------------------------------------------

/// Tracks which castling moves remain legal.
///
/// Internally stored as a `u8` bitfield. Serializes to the four named booleans
/// expected by the JavaScript frontend.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct CastlingRights(pub(crate) u8);

impl CastlingRights {
    pub(crate) const WK: u8 = 0b0001;
    pub(crate) const WQ: u8 = 0b0010;
    pub(crate) const BK: u8 = 0b0100;
    pub(crate) const BQ: u8 = 0b1000;

    /// No castling rights for either side.
    pub const NONE: Self = Self(0);
    /// All four castling rights present.
    pub const ALL: Self = Self(Self::WK | Self::WQ | Self::BK | Self::BQ);

    /// Can white castle kingside?
    #[inline]
    #[must_use]
    pub const fn white_kingside(self) -> bool { self.0 & Self::WK != 0 }
    /// Can white castle queenside?
    #[inline]
    #[must_use]
    pub const fn white_queenside(self) -> bool { self.0 & Self::WQ != 0 }
    /// Can black castle kingside?
    #[inline]
    #[must_use]
    pub const fn black_kingside(self) -> bool { self.0 & Self::BK != 0 }
    /// Can black castle queenside?
    #[inline]
    #[must_use]
    pub const fn black_queenside(self) -> bool { self.0 & Self::BQ != 0 }

    /// Clears a right by its bit mask.
    #[inline]
    pub const fn clear(&mut self, mask: u8) { self.0 &= !mask; }

    /// Bit mask for the right that involves the given square (rook corners + king squares).
    /// Returns 0 if the square is irrelevant to castling.
    #[inline]
    #[must_use]
    pub const fn mask_for_square(sq: u8) -> u8 {
        match sq {
            0 => Self::WQ,
            4 => Self::WK | Self::WQ,
            7 => Self::WK,
            56 => Self::BQ,
            60 => Self::BK | Self::BQ,
            63 => Self::BK,
            _ => 0,
        }
    }
}

impl Default for CastlingRights {
    fn default() -> Self {
        Self::ALL
    }
}

/// Outcome of a game (or "still playing").
///
/// Note: threefold repetition is not currently detected — the engine only
/// tracks insufficient material, stalemate, checkmate, and the fifty-move rule.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum GameState {
    /// The game is still in progress.
    InProgress,
    /// The side to move is in checkmate.
    Checkmate,
    /// The side to move has no legal moves but is not in check.
    Stalemate,
    /// Draw by insufficient material or the fifty-move rule.
    Draw,
}

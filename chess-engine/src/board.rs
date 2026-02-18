//! All chess game logic: precomputed attack tables, move generation,
//! legality filtering, move application, and game-state evaluation.
//!
//! The public entry point is [`Board`], which owns the position and exposes
//! [`generate_legal_moves`](Board::generate_legal_moves),
//! [`make_move`](Board::make_move), and [`game_state`](Board::game_state).

use crate::types::{
    CastlingRights, Color, GameState, Move, MoveKind, Piece, PieceType, Square,
};
use std::sync::OnceLock;

// ---------------------------------------------------------------------------
// Precomputed attack tables (initialized once, shared across the engine).
//
// Direction indices for rays:
//   0=N (+8), 1=NE (+9), 2=E (+1), 3=SE (-7),
//   4=S (-8), 5=SW (-9), 6=W (-1), 7=NW (+7)
//
// Diagonals = {1, 3, 5, 7}  Straights = {0, 2, 4, 6}
// ---------------------------------------------------------------------------

struct AttackTables {
    knight: [u64; 64],
    king: [u64; 64],
    pawn: [[u64; 64]; 2],
    rays: [[u64; 8]; 64],
}

static TABLES: OnceLock<AttackTables> = OnceLock::new();

fn tables() -> &'static AttackTables {
    TABLES.get_or_init(AttackTables::new)
}

impl AttackTables {
    fn new() -> Self {
        let mut t = Self {
            knight: [0; 64],
            king: [0; 64],
            pawn: [[0; 64]; 2],
            rays: [[0; 8]; 64],
        };
        for i in 0..64u8 {
            let sq = Square::from_index(i);
            // Safe: rank/file are 0..8, always fit in i8.
            #[allow(clippy::cast_possible_wrap)]
            let r = sq.rank() as i8;
            #[allow(clippy::cast_possible_wrap)]
            let f = sq.file() as i8;

            t.knight[sq.index()] = Self::leaper(r, f, &[
                (-2, -1), (-2, 1), (-1, -2), (-1, 2),
                (1, -2), (1, 2), (2, -1), (2, 1),
            ]);
            t.king[sq.index()] = Self::leaper(r, f, &[
                (-1, -1), (-1, 0), (-1, 1), (0, -1),
                (0, 1), (1, -1), (1, 0), (1, 1),
            ]);

            // Pawn attacks (index 0 = white pawn attacks, 1 = black pawn attacks)
            for &(color_idx, dir) in &[(0i8, 1i8), (1, -1)] {
                let nr = r + dir;
                let mut attacks = 0u64;
                if (0..8).contains(&nr) {
                    if f > 0 {
                        #[allow(clippy::cast_sign_loss)]
                        {
                            attacks |= Square::new((f - 1) as u8, nr as u8).bitboard();
                        }
                    }
                    if f < 7 {
                        #[allow(clippy::cast_sign_loss)]
                        {
                            attacks |= Square::new((f + 1) as u8, nr as u8).bitboard();
                        }
                    }
                }
                #[allow(clippy::cast_sign_loss)]
                {
                    t.pawn[color_idx as usize][sq.index()] = attacks;
                }
            }

            // Ray attacks (8 directions)
            #[allow(clippy::items_after_statements)]
            const DIRS: [(i8, i8); 8] = [
                (1, 0), (1, 1), (0, 1), (-1, 1),
                (-1, 0), (-1, -1), (0, -1), (1, -1),
            ];
            for (d, &(dr, df)) in DIRS.iter().enumerate() {
                let (mut cr, mut cf) = (r + dr, f + df);
                while (0..8).contains(&cr) && (0..8).contains(&cf) {
                    #[allow(clippy::cast_sign_loss)]
                    {
                        t.rays[sq.index()][d] |= Square::new(cf as u8, cr as u8).bitboard();
                    }
                    cr += dr;
                    cf += df;
                }
            }
        }
        t
    }

    fn leaper(rank: i8, file: i8, offsets: &[(i8, i8)]) -> u64 {
        let mut bb = 0u64;
        for &(dr, df) in offsets {
            let (nr, nf) = (rank + dr, file + df);
            if (0..8).contains(&nr) && (0..8).contains(&nf) {
                #[allow(clippy::cast_sign_loss)]
                {
                    bb |= Square::new(nf as u8, nr as u8).bitboard();
                }
            }
        }
        bb
    }
}

/// Extracts the lowest set bit index from a bitboard as a `u8`.
///
/// # Safety (logical)
///
/// The caller must ensure `bb != 0`; `trailing_zeros` on zero returns 64
/// which would violate `Square`'s invariant.
#[allow(clippy::cast_possible_truncation)]
#[inline]
fn lsb_index(bb: u64) -> u8 {
    debug_assert!(bb != 0, "lsb_index called with empty bitboard");
    bb.trailing_zeros() as u8
}

/// Returns the nearest blocker along a ray direction.
///
/// Directions whose square index *increases* along the ray (N, NE, E, NW)
/// use `trailing_zeros`; those that *decrease* (SE, S, SW, W) use `leading_zeros`.
#[allow(clippy::cast_possible_truncation)]
#[inline]
fn nearest_blocker(blockers: u64, dir: usize) -> u8 {
    debug_assert!(blockers != 0, "nearest_blocker called with empty bitboard");
    if matches!(dir, 0 | 1 | 2 | 7) {
        lsb_index(blockers)
    } else {
        (63 - blockers.leading_zeros()) as u8
    }
}

// ---------------------------------------------------------------------------
// Castling path masks — the squares between king and rook that must be empty.
// ---------------------------------------------------------------------------

/// f1 + g1 (white kingside path).
const WK_PATH: u64 = 0x60;
/// b1 + c1 + d1 (white queenside path).
const WQ_PATH: u64 = 0x0E;
/// f8 + g8 (black kingside path).
const BK_PATH: u64 = 0x6000_0000_0000_0000;
/// b8 + c8 + d8 (black queenside path).
const BQ_PATH: u64 = 0x0E00_0000_0000_0000;

// Named squares for castling.
const E1: Square = Square::new(4, 0);
const G1: Square = Square::new(6, 0);
const C1: Square = Square::new(2, 0);
const F1: Square = Square::new(5, 0);
const D1: Square = Square::new(3, 0);
const E8: Square = Square::new(4, 7);
const G8: Square = Square::new(6, 7);
const C8: Square = Square::new(2, 7);
const F8: Square = Square::new(5, 7);
const D8: Square = Square::new(3, 7);

/// Castling configuration for one side (king or queenside).
struct CastlingConfig {
    rights_check: fn(CastlingRights) -> bool,
    path_mask: u64,
    king_from: Square,
    king_to: Square,
    transit: Square,
    attacker: Color,
}

const CASTLING_CONFIGS: [CastlingConfig; 4] = [
    // White kingside
    CastlingConfig {
        rights_check: CastlingRights::white_kingside,
        path_mask: WK_PATH,
        king_from: E1,
        king_to: G1,
        transit: F1,
        attacker: Color::Black,
    },
    // White queenside
    CastlingConfig {
        rights_check: CastlingRights::white_queenside,
        path_mask: WQ_PATH,
        king_from: E1,
        king_to: C1,
        transit: D1,
        attacker: Color::Black,
    },
    // Black kingside
    CastlingConfig {
        rights_check: CastlingRights::black_kingside,
        path_mask: BK_PATH,
        king_from: E8,
        king_to: G8,
        transit: F8,
        attacker: Color::White,
    },
    // Black queenside
    CastlingConfig {
        rights_check: CastlingRights::black_queenside,
        path_mask: BQ_PATH,
        king_from: E8,
        king_to: C8,
        transit: D8,
        attacker: Color::White,
    },
];

// ---------------------------------------------------------------------------
// Board — bitboard-based chess position.
// ---------------------------------------------------------------------------

/// A complete chess position using bitboard representation.
///
/// Tracks piece placement, side to move, castling rights, en passant,
/// and the halfmove/fullmove counters. All move generation and
/// legality checking is done here.
#[derive(Clone)]
pub struct Board {
    // Custom Debug impl below prints FEN for readability.
    pieces: [[u64; 6]; 2],
    occupancy: [u64; 2],
    all: u64,
    side_to_move: Color,
    castling: CastlingRights,
    en_passant: Option<Square>,
    halfmove_clock: u16,
    fullmove_number: u16,
}

impl Default for Board {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Debug for Board {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Board(\"{}\")", self.to_fen())
    }
}

impl Board {
    /// Creates the standard starting position.
    ///
    /// # Panics
    ///
    /// Panics if the built-in starting FEN is invalid (should never happen).
    #[must_use]
    pub fn new() -> Self {
        Self::from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1").unwrap()
    }

    /// Parses a position from [FEN](https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation).
    ///
    /// Returns `None` if the FEN is malformed or the position is invalid
    /// (e.g. missing kings, invalid side-to-move).
    #[must_use]
    pub fn from_fen(fen: &str) -> Option<Self> {
        let parts: Vec<&str> = fen.split_whitespace().collect();
        if parts.len() < 4 {
            return None;
        }

        let mut board = Self {
            pieces: [[0; 6]; 2],
            occupancy: [0; 2],
            all: 0,
            side_to_move: Color::White,
            castling: CastlingRights::NONE,
            en_passant: None,
            halfmove_clock: 0,
            fullmove_number: 1,
        };

        // Piece placement
        let mut rank = 7u8;
        let mut file = 0u8;
        for c in parts[0].chars() {
            match c {
                '/' => {
                    if file > 8 {
                        return None;
                    }
                    rank = rank.checked_sub(1)?;
                    file = 0;
                }
                '1'..='8' => {
                    file += c as u8 - b'0';
                    if file > 8 {
                        return None;
                    }
                }
                _ => {
                    if file >= 8 || rank >= 8 {
                        return None;
                    }
                    let piece = Piece::from_fen_char(c)?;
                    let sq = Square::new(file, rank);
                    let bb = sq.bitboard();
                    board.pieces[piece.color().index()][piece.piece_type() as usize] |= bb;
                    board.occupancy[piece.color().index()] |= bb;
                    file += 1;
                }
            }
        }
        board.all = board.occupancy[0] | board.occupancy[1];

        // Validate: each side must have exactly one king
        let wk = board.pieces[Color::White.index()][PieceType::King as usize].count_ones();
        let bk = board.pieces[Color::Black.index()][PieceType::King as usize].count_ones();
        if wk != 1 || bk != 1 {
            return None;
        }

        // Side to move
        board.side_to_move = match parts[1] {
            "w" => Color::White,
            "b" => Color::Black,
            _ => return None,
        };

        // Castling
        let mut rights = CastlingRights::NONE;
        for c in parts[2].chars() {
            match c {
                'K' => rights = CastlingRights(rights.0 | CastlingRights::WK),
                'Q' => rights = CastlingRights(rights.0 | CastlingRights::WQ),
                'k' => rights = CastlingRights(rights.0 | CastlingRights::BK),
                'q' => rights = CastlingRights(rights.0 | CastlingRights::BQ),
                _ => {}
            }
        }
        board.castling = rights;

        // En passant — must be on rank 3 (index 2) or rank 6 (index 5)
        if parts[3] != "-" {
            let ep = Square::from_algebraic(parts[3])?;
            if ep.rank() != 2 && ep.rank() != 5 {
                return None;
            }
            board.en_passant = Some(ep);
        }

        // Clocks — reject non-numeric values
        if parts.len() > 4 {
            board.halfmove_clock = parts[4].parse().ok()?;
        }
        if parts.len() > 5 {
            board.fullmove_number = parts[5].parse().ok()?;
        }

        Some(board)
    }

    /// Serializes the position to FEN.
    #[must_use]
    pub fn to_fen(&self) -> String {
        use std::fmt::Write;
        let mut fen = String::with_capacity(80);

        // Piece placement
        for rank in (0..8).rev() {
            let mut empty = 0u8;
            for file in 0..8u8 {
                if let Some(piece) = self.piece_at(Square::new(file, rank)) {
                    if empty > 0 {
                        fen.push((b'0' + empty) as char);
                        empty = 0;
                    }
                    fen.push(piece.to_fen_char());
                } else {
                    empty += 1;
                }
            }
            if empty > 0 {
                fen.push((b'0' + empty) as char);
            }
            if rank > 0 {
                fen.push('/');
            }
        }

        // Side to move
        fen.push(' ');
        fen.push(match self.side_to_move {
            Color::White => 'w',
            Color::Black => 'b',
        });

        // Castling
        fen.push(' ');
        let before = fen.len();
        if self.castling.white_kingside() { fen.push('K'); }
        if self.castling.white_queenside() { fen.push('Q'); }
        if self.castling.black_kingside() { fen.push('k'); }
        if self.castling.black_queenside() { fen.push('q'); }
        if fen.len() == before { fen.push('-'); }

        // En passant
        fen.push(' ');
        match self.en_passant {
            Some(sq) => write!(fen, "{sq}").unwrap(),
            None => fen.push('-'),
        }

        // Clocks
        write!(fen, " {} {}", self.halfmove_clock, self.fullmove_number).unwrap();
        fen
    }

    // -----------------------------------------------------------------------
    // Read-only accessors (Board fields are private)
    // -----------------------------------------------------------------------

    /// Returns the piece on the given square, if any.
    #[must_use]
    pub fn piece_at(&self, sq: Square) -> Option<Piece> {
        let bb = sq.bitboard();
        for color in [Color::White, Color::Black] {
            if self.occupancy[color.index()] & bb != 0 {
                for &pt in &PieceType::ALL {
                    if self.pieces[color.index()][pt as usize] & bb != 0 {
                        return Some(Piece::new(pt, color));
                    }
                }
            }
        }
        None
    }

    /// Whose turn it is.
    #[inline]
    #[must_use]
    pub const fn side_to_move(&self) -> Color { self.side_to_move }

    /// Current castling rights.
    #[inline]
    #[must_use]
    pub const fn castling(&self) -> CastlingRights { self.castling }

    /// Current en-passant target square, if any.
    #[inline]
    #[must_use]
    pub const fn en_passant(&self) -> Option<Square> { self.en_passant }

    /// Number of half-moves since the last capture or pawn advance.
    #[inline]
    #[must_use]
    pub const fn halfmove_clock(&self) -> u16 { self.halfmove_clock }

    /// Current full-move number (starts at 1, incremented after Black's move).
    #[inline]
    #[must_use]
    pub const fn fullmove_number(&self) -> u16 { self.fullmove_number }

    fn king_square(&self, color: Color) -> Square {
        let bb = self.pieces[color.index()][PieceType::King as usize];
        debug_assert!(bb != 0, "no king found for {color}");
        Square::from_index(lsb_index(bb))
    }

    fn piece_type_at(&self, sq: Square, color: Color) -> Option<PieceType> {
        let bb = sq.bitboard();
        PieceType::ALL
            .iter()
            .copied()
            .find(|&pt| self.pieces[color.index()][pt as usize] & bb != 0)
    }

    // -----------------------------------------------------------------------
    // Attack detection
    // -----------------------------------------------------------------------

    fn is_attacked(&self, sq: Square, by: Color) -> bool {
        let t = tables();
        let them = by.index();
        let idx = sq.index();

        // Knight
        if t.knight[idx] & self.pieces[them][PieceType::Knight as usize] != 0 {
            return true;
        }
        // King
        if t.king[idx] & self.pieces[them][PieceType::King as usize] != 0 {
            return true;
        }
        // Pawns — we check the attacked-by side using the *defender's* pawn perspective
        let defender = by.opposite().index();
        if t.pawn[defender][idx] & self.pieces[them][PieceType::Pawn as usize] != 0 {
            return true;
        }

        let bishops = self.pieces[them][PieceType::Bishop as usize];
        let rooks = self.pieces[them][PieceType::Rook as usize];
        let queens = self.pieces[them][PieceType::Queen as usize];

        // Diagonals (bishop + queen)
        for dir in [1, 3, 5, 7] {
            if self.ray_hits(idx, dir, bishops | queens) {
                return true;
            }
        }
        // Straights (rook + queen)
        for dir in [0, 2, 4, 6] {
            if self.ray_hits(idx, dir, rooks | queens) {
                return true;
            }
        }
        false
    }

    fn ray_hits(&self, sq_idx: usize, dir: usize, targets: u64) -> bool {
        let ray = tables().rays[sq_idx][dir];
        let blockers = ray & self.all;
        if blockers != 0 {
            (1u64 << nearest_blocker(blockers, dir)) & targets != 0
        } else {
            false
        }
    }

    /// Returns `true` if the given side's king is in check.
    #[must_use]
    pub fn is_in_check(&self, color: Color) -> bool {
        self.is_attacked(self.king_square(color), color.opposite())
    }

    // -----------------------------------------------------------------------
    // Move generation
    // -----------------------------------------------------------------------

    /// Returns all legal moves in the current position.
    #[must_use]
    pub fn generate_legal_moves(&self) -> Vec<Move> {
        self.generate_pseudo_legal()
            .into_iter()
            .filter(|m| {
                let mut b = self.clone();
                b.apply_unchecked(*m);
                !b.is_in_check(self.side_to_move)
            })
            .collect()
    }

    fn generate_pseudo_legal(&self) -> Vec<Move> {
        let mut moves = Vec::with_capacity(256);
        let us = self.side_to_move.index();
        let them = self.side_to_move.opposite().index();
        let t = tables();

        // Pawns
        let pawns = self.pieces[us][PieceType::Pawn as usize];
        let (push, start_rank, promo_rank): (i8, u8, u8) =
            if self.side_to_move == Color::White { (8, 1, 7) } else { (-8, 6, 0) };

        let mut bb = pawns;
        while bb != 0 {
            let from = Square::from_index(lsb_index(bb));
            bb &= bb - 1;

            #[allow(clippy::cast_sign_loss, clippy::cast_possible_truncation)]
            let to = Square::from_index((i16::from(from.raw()) + i16::from(push)) as u8);

            // Single push
            if self.all & to.bitboard() == 0 {
                if to.rank() == promo_rank {
                    for &pt in &PieceType::PROMOTABLE {
                        moves.push(Move::promotion(from, to, pt));
                    }
                } else {
                    moves.push(Move::normal(from, to));
                    // Double push
                    if from.rank() == start_rank {
                        #[allow(clippy::cast_sign_loss, clippy::cast_possible_truncation)]
                        let double = Square::from_index(
                            (i16::from(to.raw()) + i16::from(push)) as u8,
                        );
                        if self.all & double.bitboard() == 0 {
                            moves.push(Move::normal(from, double));
                        }
                    }
                }
            }

            // Captures
            let attacks = t.pawn[us][from.index()];
            let mut caps = attacks & self.occupancy[them];
            while caps != 0 {
                let cap_to = Square::from_index(lsb_index(caps));
                caps &= caps - 1;
                if cap_to.rank() == promo_rank {
                    for &pt in &PieceType::PROMOTABLE {
                        moves.push(Move::promotion(from, cap_to, pt));
                    }
                } else {
                    moves.push(Move::normal(from, cap_to));
                }
            }

            // En passant
            if let Some(ep) = self.en_passant {
                if attacks & ep.bitboard() != 0 {
                    moves.push(Move::en_passant(from, ep));
                }
            }
        }

        // Knights
        self.gen_leaper(&mut moves, PieceType::Knight, us, &t.knight);

        // King
        self.gen_leaper(&mut moves, PieceType::King, us, &t.king);

        // Castling
        self.gen_castling(&mut moves);

        // Sliding pieces (bishop, rook, queen)
        for &(pt, dirs) in &[
            (PieceType::Bishop, &[1, 3, 5, 7][..]),
            (PieceType::Rook, &[0, 2, 4, 6][..]),
            (PieceType::Queen, &[0, 1, 2, 3, 4, 5, 6, 7][..]),
        ] {
            let mut bb = self.pieces[us][pt as usize];
            while bb != 0 {
                let from = Square::from_index(lsb_index(bb));
                bb &= bb - 1;
                for &dir in dirs {
                    let ray = t.rays[from.index()][dir];
                    let blockers = ray & self.all;
                    let attacks = if blockers == 0 {
                        ray
                    } else {
                        let bsq = nearest_blocker(blockers, dir);
                        ray ^ t.rays[usize::from(bsq)][dir]
                    };
                    let mut targets = attacks & !self.occupancy[us];
                    while targets != 0 {
                        let to = Square::from_index(lsb_index(targets));
                        targets &= targets - 1;
                        moves.push(Move::normal(from, to));
                    }
                }
            }
        }

        moves
    }

    fn gen_leaper(&self, moves: &mut Vec<Move>, pt: PieceType, us: usize, table: &[u64; 64]) {
        let mut bb = self.pieces[us][pt as usize];
        while bb != 0 {
            let from = Square::from_index(lsb_index(bb));
            bb &= bb - 1;
            let mut targets = table[from.index()] & !self.occupancy[us];
            while targets != 0 {
                let to = Square::from_index(lsb_index(targets));
                targets &= targets - 1;
                moves.push(Move::normal(from, to));
            }
        }
    }

    fn gen_castling(&self, moves: &mut Vec<Move>) {
        let in_check = self.is_in_check(self.side_to_move);
        if in_check {
            return;
        }

        let is_white = self.side_to_move == Color::White;
        let configs = if is_white { &CASTLING_CONFIGS[0..2] } else { &CASTLING_CONFIGS[2..4] };

        for cfg in configs {
            if (cfg.rights_check)(self.castling)
                && self.all & cfg.path_mask == 0
                && !self.is_attacked(cfg.transit, cfg.attacker)
                && !self.is_attacked(cfg.king_to, cfg.attacker)
            {
                moves.push(Move::castle(cfg.king_from, cfg.king_to));
            }
        }
    }

    // -----------------------------------------------------------------------
    // Move application
    // -----------------------------------------------------------------------

    /// Validates and applies a move. Returns `true` if the move was legal.
    ///
    /// The move is matched by from/to/promotion against the legal move list,
    /// which resolves the correct `MoveKind` (castle, en passant, etc.) even
    /// if the input was parsed from UCI with `MoveKind::Normal`.
    pub fn make_move(&mut self, mv: Move) -> bool {
        let legal = self.generate_legal_moves();
        legal.iter().find(|m| {
            m.from() == mv.from() && m.to() == mv.to() && m.promotion_piece() == mv.promotion_piece()
        }).is_some_and(|lm| {
            self.apply_unchecked(*lm);
            true
        })
    }

    /// Applies a move without legality checking.
    ///
    /// # Correctness
    ///
    /// The caller must pass a move produced by [`generate_pseudo_legal`](Self::generate_pseudo_legal)
    /// or [`generate_legal_moves`](Self::generate_legal_moves). Passing an arbitrary move
    /// will silently corrupt the board state.
    pub(crate) fn apply_unchecked(&mut self, mv: Move) {
        let us = self.side_to_move.index();
        let them = self.side_to_move.opposite().index();
        let from_bb = mv.from().bitboard();
        let to_bb = mv.to().bitboard();

        // Identify moving piece
        let moving = self
            .piece_type_at(mv.from(), self.side_to_move)
            .expect("apply_unchecked called with no piece at from-square");

        // Detect capture BEFORE modifying the board (fixes halfmove clock bug)
        let is_capture = self.occupancy[them] & to_bb != 0
            || matches!(mv.kind(), MoveKind::EnPassant);

        // Remove from source
        self.pieces[us][moving as usize] ^= from_bb;
        self.occupancy[us] ^= from_bb;

        // Handle capture at destination
        if self.occupancy[them] & to_bb != 0 {
            if let Some(captured) = self.piece_type_at(mv.to(), self.side_to_move.opposite()) {
                self.pieces[them][captured as usize] ^= to_bb;
            }
            self.occupancy[them] ^= to_bb;
        }

        // En passant capture — remove the pawn on the file of the destination
        if mv.kind() == MoveKind::EnPassant {
            let cap_sq = if self.side_to_move == Color::White {
                Square::from_index(mv.to().raw() - 8)
            } else {
                Square::from_index(mv.to().raw() + 8)
            };
            let cap_bb = cap_sq.bitboard();
            self.pieces[them][PieceType::Pawn as usize] ^= cap_bb;
            self.occupancy[them] ^= cap_bb;
        }

        // Place piece at destination (with promotion if applicable)
        let placed = match mv.kind() {
            MoveKind::Promotion(pt) => pt,
            _ => moving,
        };
        self.pieces[us][placed as usize] |= to_bb;
        self.occupancy[us] |= to_bb;

        // Rook movement for castling
        if mv.kind() == MoveKind::Castle {
            let (rf, rt) = match mv.to().raw() {
                6 => (7u8, 5u8),   // white kingside: h1 → f1
                2 => (0, 3),       // white queenside: a1 → d1
                62 => (63, 61),    // black kingside: h8 → f8
                58 => (56, 59),    // black queenside: a8 → d8
                _ => unreachable!("invalid castling destination"),
            };
            let rook_move = Square::from_index(rf).bitboard()
                | Square::from_index(rt).bitboard();
            self.pieces[us][PieceType::Rook as usize] ^= rook_move;
            self.occupancy[us] ^= rook_move;
        }

        // En passant square
        self.en_passant = None;
        if moving == PieceType::Pawn {
            let (fr, tr) = (mv.from().rank(), mv.to().rank());
            if (fr == 1 && tr == 3) || (fr == 6 && tr == 4) {
                self.en_passant =
                    Some(Square::from_index(u8::midpoint(mv.from().raw(), mv.to().raw())));
            }
        }

        // Update castling rights via branchless bitmask clearing
        for sq in [mv.from().raw(), mv.to().raw()] {
            self.castling.clear(CastlingRights::mask_for_square(sq));
        }

        // Update combined occupancy
        self.all = self.occupancy[0] | self.occupancy[1];

        // Halfmove clock (uses pre-computed is_capture — correct even after board mutation)
        self.halfmove_clock = if moving == PieceType::Pawn || is_capture {
            0
        } else {
            self.halfmove_clock + 1
        };

        // Side to move & fullmove
        self.side_to_move = self.side_to_move.opposite();
        if self.side_to_move == Color::White {
            self.fullmove_number = self.fullmove_number.saturating_add(1);
        }
    }

    // -----------------------------------------------------------------------
    // Game state
    // -----------------------------------------------------------------------

    /// Determines the current game state (in progress, checkmate, stalemate, or draw).
    #[must_use]
    pub fn game_state(&self) -> GameState {
        if self.generate_legal_moves().is_empty() {
            return if self.is_in_check(self.side_to_move) {
                GameState::Checkmate
            } else {
                GameState::Stalemate
            };
        }

        // Insufficient material (K vs K, K+B vs K, K+N vs K)
        let total = self.all.count_ones();
        if total <= 3 {
            let minors = (self.pieces[0][PieceType::Knight as usize]
                | self.pieces[1][PieceType::Knight as usize]
                | self.pieces[0][PieceType::Bishop as usize]
                | self.pieces[1][PieceType::Bishop as usize])
                .count_ones();
            let heavy = (self.pieces[0][PieceType::Pawn as usize]
                | self.pieces[1][PieceType::Pawn as usize]
                | self.pieces[0][PieceType::Rook as usize]
                | self.pieces[1][PieceType::Rook as usize]
                | self.pieces[0][PieceType::Queen as usize]
                | self.pieces[1][PieceType::Queen as usize])
                .count_ones();
            if heavy == 0 && minors <= 1 {
                return GameState::Draw;
            }
        }

        // Fifty-move rule
        if self.halfmove_clock >= 100 {
            return GameState::Draw;
        }

        GameState::InProgress
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // ======================== Basic ========================

    #[test]
    fn starting_position_fen() {
        let b = Board::new();
        assert_eq!(b.to_fen(), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    }

    #[test]
    fn debug_shows_fen() {
        let b = Board::new();
        let dbg = format!("{b:?}");
        assert!(dbg.starts_with("Board(\"rnbqkbnr"));
    }

    #[test]
    fn twenty_opening_moves() {
        assert_eq!(Board::new().generate_legal_moves().len(), 20);
    }

    #[test]
    fn make_move_switches_turn() {
        let mut b = Board::new();
        assert!(b.make_move(Move::from_uci("e2e4").unwrap()));
        assert_eq!(b.side_to_move(), Color::Black);
    }

    // ======================== FEN ========================

    #[test]
    fn fen_round_trip() {
        for fen in [
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
            "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
            "8/8/8/8/8/8/8/4K2k w - - 0 1",
        ] {
            assert_eq!(Board::from_fen(fen).unwrap().to_fen(), fen, "failed: {fen}");
        }
    }

    #[test]
    fn invalid_fen() {
        assert!(Board::from_fen("invalid").is_none());
        assert!(Board::from_fen("").is_none());
        assert!(Board::from_fen("8/8/8/8/8/8/8/8").is_none());
    }

    #[test]
    fn fen_rejects_missing_king() {
        // No kings at all
        assert!(Board::from_fen("8/8/8/8/8/8/8/8 w - - 0 1").is_none());
        // Only white king
        assert!(Board::from_fen("8/8/8/8/8/8/8/4K3 w - - 0 1").is_none());
        // Two white kings
        assert!(Board::from_fen("8/8/8/8/8/8/4K3/4K2k w - - 0 1").is_none());
    }

    #[test]
    fn fen_rejects_invalid_side_to_move() {
        assert!(Board::from_fen("4k3/8/8/8/8/8/8/4K3 x - - 0 1").is_none());
        assert!(Board::from_fen("4k3/8/8/8/8/8/8/4K3 W - - 0 1").is_none());
    }

    #[test]
    fn fen_rejects_malformed_clocks() {
        // Non-numeric halfmove clock
        assert!(Board::from_fen("4k3/8/8/8/8/8/8/4K3 w - - abc 1").is_none());
        // Non-numeric fullmove number
        assert!(Board::from_fen("4k3/8/8/8/8/8/8/4K3 w - - 0 xyz").is_none());
    }

    #[test]
    fn fen_rejects_invalid_en_passant() {
        // En passant on rank 4 (index 3) — only ranks 3 and 6 are valid
        assert!(Board::from_fen("4k3/8/8/8/8/8/8/4K3 w - e4 0 1").is_none());
        // Valid en passant on rank 3
        assert!(Board::from_fen("4k3/8/8/8/4P3/8/8/4K3 w - e3 0 1").is_some());
        // Valid en passant on rank 6
        assert!(Board::from_fen("4k3/8/8/8/8/8/8/4K3 b - e6 0 1").is_some());
    }

    #[test]
    fn fen_rejects_rank_overflow() {
        // Too many pieces on rank 8
        assert!(Board::from_fen("rnbqkbnrr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1").is_none());
    }

    // ======================== Castling ========================

    #[test]
    fn white_kingside_castling() {
        let b = Board::from_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1").unwrap();
        assert!(b.generate_legal_moves().iter().any(|m| m.from().raw() == 4 && m.to().raw() == 6 && matches!(m.kind(), MoveKind::Castle)));
    }

    #[test]
    fn white_queenside_castling() {
        let b = Board::from_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1").unwrap();
        assert!(b.generate_legal_moves().iter().any(|m| m.from().raw() == 4 && m.to().raw() == 2 && matches!(m.kind(), MoveKind::Castle)));
    }

    #[test]
    fn black_kingside_castling() {
        let b = Board::from_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b KQkq - 0 1").unwrap();
        assert!(b.generate_legal_moves().iter().any(|m| m.from().raw() == 60 && m.to().raw() == 62 && matches!(m.kind(), MoveKind::Castle)));
    }

    #[test]
    fn black_queenside_castling() {
        let b = Board::from_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b KQkq - 0 1").unwrap();
        assert!(b.generate_legal_moves().iter().any(|m| m.from().raw() == 60 && m.to().raw() == 58 && matches!(m.kind(), MoveKind::Castle)));
    }

    #[test]
    fn no_castling_through_check() {
        let b = Board::from_fen("4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1").unwrap();
        assert!(!b.generate_legal_moves().iter().any(|m| m.from().raw() == 4 && m.to().raw() == 6 && matches!(m.kind(), MoveKind::Castle)));
    }

    #[test]
    fn no_castling_when_in_check() {
        let b = Board::from_fen("r3k2r/pppppppp/8/8/4r3/8/PPPP1PPP/R3K2R w KQkq - 0 1").unwrap();
        assert!(!b.generate_legal_moves().iter().any(|m| matches!(m.kind(), MoveKind::Castle)));
    }

    #[test]
    fn castling_moves_rook() {
        let mut b = Board::from_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1").unwrap();
        b.apply_unchecked(Move::castle(Square::from_index(4), Square::from_index(6)));
        // Rook should be on f1 (index 5), not h1 (index 7)
        assert!(b.piece_at(Square::from_index(5)).is_some_and(|p| p.piece_type() == PieceType::Rook));
        assert!(b.piece_at(Square::from_index(7)).is_none());
    }

    // ======================== En passant ========================

    #[test]
    fn en_passant_available() {
        let b = Board::from_fen("rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 1").unwrap();
        let ep = b.generate_legal_moves().iter().find(|m| matches!(m.kind(), MoveKind::EnPassant)).copied();
        assert!(ep.is_some());
        let m = ep.unwrap();
        assert_eq!(m.from(), Square::new(4, 4));
        assert_eq!(m.to(), Square::new(3, 5));
    }

    #[test]
    fn en_passant_removes_pawn() {
        let mut b = Board::from_fen("rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 1").unwrap();
        b.make_move(Move::en_passant(Square::new(4, 4), Square::new(3, 5)));
        assert!(b.piece_at(Square::new(3, 4)).is_none(), "captured pawn removed");
        let p = b.piece_at(Square::new(3, 5)).unwrap();
        assert_eq!(p.piece_type(), PieceType::Pawn);
        assert_eq!(p.color(), Color::White);
    }

    #[test]
    fn black_en_passant() {
        // Black pawn on d4, white plays e2-e4, black captures en passant
        let mut b = Board::from_fen("rnbqkbnr/ppp1pppp/8/8/3p4/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1").unwrap();
        assert!(b.make_move(Move::from_uci("e2e4").unwrap()));
        let ep = b.generate_legal_moves().iter().find(|m| matches!(m.kind(), MoveKind::EnPassant)).copied();
        assert!(ep.is_some(), "black should have an en passant capture");
        let m = ep.unwrap();
        assert_eq!(m.from(), Square::new(3, 3)); // d4
        assert_eq!(m.to(), Square::new(4, 2));   // e3
    }

    // ======================== Check & Checkmate ========================

    #[test]
    fn check_detection() {
        let b = Board::from_fen("4k3/8/8/8/8/8/4q3/4K3 w - - 0 1").unwrap();
        assert!(b.is_in_check(Color::White));
    }

    #[test]
    fn no_check_at_start() {
        let b = Board::new();
        assert!(!b.is_in_check(Color::White));
        assert!(!b.is_in_check(Color::Black));
    }

    #[test]
    fn fools_mate() {
        let b = Board::from_fen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3").unwrap();
        assert_eq!(b.game_state(), GameState::Checkmate);
    }

    #[test]
    fn back_rank_mate() {
        let b = Board::from_fen("3R2k1/5ppp/8/8/8/8/8/6K1 b - - 0 1").unwrap();
        assert_eq!(b.game_state(), GameState::Checkmate);
    }

    // ======================== Stalemate ========================

    #[test]
    fn stalemate_basic() {
        let b = Board::from_fen("k7/2Q5/1K6/8/8/8/8/8 b - - 0 1").unwrap();
        assert_eq!(b.game_state(), GameState::Stalemate);
    }

    #[test]
    fn stalemate_corner() {
        let b = Board::from_fen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").unwrap();
        assert_eq!(b.game_state(), GameState::Stalemate);
    }

    // ======================== Draw ========================

    #[test]
    fn draw_kk() {
        let b = Board::from_fen("8/8/8/8/8/8/4k3/4K3 w - - 0 1").unwrap();
        assert_eq!(b.game_state(), GameState::Draw);
    }

    #[test]
    fn draw_kbk() {
        let b = Board::from_fen("8/8/8/8/8/8/4k3/4KB2 w - - 0 1").unwrap();
        assert_eq!(b.game_state(), GameState::Draw);
    }

    #[test]
    fn draw_knk() {
        let b = Board::from_fen("8/8/8/8/8/8/4k3/4KN2 w - - 0 1").unwrap();
        assert_eq!(b.game_state(), GameState::Draw);
    }

    #[test]
    fn fifty_move_rule() {
        let b = Board::from_fen("4k3/8/8/8/8/8/8/4K3 w - - 100 50").unwrap();
        assert_eq!(b.game_state(), GameState::Draw);
    }

    // ======================== Promotion ========================

    #[test]
    fn promotion_four_options() {
        // Black king on a8, not blocking the e-file promotion square.
        let b = Board::from_fen("k7/4P3/8/8/8/8/8/4K3 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        let promo_count = moves.iter().filter(|m| m.promotion_piece().is_some()).count();
        assert_eq!(promo_count, 4);
    }

    #[test]
    fn promotion_with_capture() {
        // White pawn on e7 can capture-promote to d8 (black rook). King on a8 not blocking.
        let b = Board::from_fen("k2r4/4P3/8/8/8/8/8/4K3 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        let cap_promo_count = moves.iter()
            .filter(|m| m.promotion_piece().is_some() && m.to() == Square::new(3, 7))
            .count();
        assert_eq!(cap_promo_count, 4);
    }

    #[test]
    fn black_promotion() {
        // Black pawn on e2 promotes to e1. Black king on a8, white king on h8.
        let b = Board::from_fen("k6K/8/8/8/8/8/4p3/8 b - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        let promos: Vec<_> = moves.iter().filter(|m| m.promotion_piece().is_some()).collect();
        assert_eq!(promos.len(), 4, "black should have 4 promotion options");
        assert!(promos.iter().all(|m| m.to().rank() == 0), "black promotes to rank 1");
    }

    // ======================== UCI ========================

    #[test]
    fn uci_parsing() {
        let m = Move::from_uci("e2e4").unwrap();
        assert_eq!(m.from(), Square::new(4, 1));
        assert_eq!(m.to(), Square::new(4, 3));
        assert!(m.promotion_piece().is_none());

        let m = Move::from_uci("e7e8q").unwrap();
        assert_eq!(m.promotion_piece(), Some(PieceType::Queen));
    }

    #[test]
    fn invalid_uci() {
        assert!(Move::from_uci("").is_none());
        assert!(Move::from_uci("e2").is_none());
        assert!(Move::from_uci("z9z9").is_none());
        // Trailing garbage after promotion char is rejected
        assert!(Move::from_uci("e7e8qX").is_none());
        // Trailing garbage after normal move is rejected
        assert!(Move::from_uci("e2e4extra").is_none());
    }

    #[test]
    fn illegal_move_rejected() {
        let mut b = Board::new();
        assert!(!b.make_move(Move::from_uci("e7e5").unwrap())); // wrong color
        assert!(!b.make_move(Move::from_uci("e2e5").unwrap())); // too far
    }

    #[test]
    fn move_display() {
        assert_eq!(Move::from_uci("e2e4").unwrap().to_string(), "e2e4");
        assert_eq!(Move::from_uci("e7e8q").unwrap().to_string(), "e7e8q");
    }

    // ======================== Square::from_algebraic ========================

    #[test]
    fn algebraic_edge_cases() {
        assert!(Square::from_algebraic("").is_none());
        assert!(Square::from_algebraic("a").is_none());
        assert!(Square::from_algebraic("a0").is_none());
        assert!(Square::from_algebraic("a9").is_none());
        assert!(Square::from_algebraic("i1").is_none());
        // Trailing characters are rejected (strict 2-char parse)
        assert!(Square::from_algebraic("e4x").is_none());
        assert_eq!(Square::from_algebraic("a1"), Some(Square::new(0, 0)));
        assert_eq!(Square::from_algebraic("h8"), Some(Square::new(7, 7)));
    }

    // ======================== Pin ========================

    #[test]
    fn pinned_piece_cant_move() {
        let b = Board::from_fen("4k3/8/8/b7/8/2N5/8/4K3 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        assert!(!moves.iter().any(|m| m.from() == Square::new(2, 2)));
    }

    // ======================== Halfmove clock (BUG FIX) ========================

    #[test]
    fn capture_resets_halfmove_clock() {
        let mut b = Board::from_fen("4k3/8/8/8/8/8/4p3/4K3 w - - 10 1").unwrap();
        // King captures pawn on e2 -> halfmove should reset
        assert!(b.make_move(Move::from_uci("e1e2").unwrap()));
        assert_eq!(b.halfmove_clock(), 0, "capture must reset halfmove clock");
    }

    #[test]
    fn quiet_move_increments_halfmove_clock() {
        let mut b = Board::from_fen("4k3/8/8/8/8/8/8/4K3 w - - 5 1").unwrap();
        assert!(b.make_move(Move::from_uci("e1d1").unwrap()));
        assert_eq!(b.halfmove_clock(), 6);
    }

    // ======================== Perft ========================

    fn perft(board: &Board, depth: u32) -> u64 {
        if depth == 0 {
            return 1;
        }
        let moves = board.generate_legal_moves();
        if depth == 1 {
            return moves.len() as u64;
        }
        moves.iter().map(|m| {
            let mut b = board.clone();
            b.apply_unchecked(*m);
            perft(&b, depth - 1)
        }).sum()
    }

    #[test]
    fn perft_depth_1() {
        assert_eq!(perft(&Board::new(), 1), 20);
    }

    #[test]
    fn perft_depth_2() {
        assert_eq!(perft(&Board::new(), 2), 400);
    }

    #[test]
    fn perft_depth_3() {
        assert_eq!(perft(&Board::new(), 3), 8_902);
    }

    #[test]
    fn perft_depth_4() {
        assert_eq!(perft(&Board::new(), 4), 197_281);
    }

    /// Depth 5 takes longer — run with `cargo test -- --ignored`.
    #[test]
    #[ignore = "slow: run with cargo test -- --ignored"]
    fn perft_depth_5() {
        assert_eq!(perft(&Board::new(), 5), 4_865_609);
    }

    // Kiwipete: the standard stress-test position for castling, en passant,
    // and promotion interactions.
    const KIWIPETE: &str = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";

    #[test]
    fn kiwipete_perft_1() {
        assert_eq!(perft(&Board::from_fen(KIWIPETE).unwrap(), 1), 48);
    }

    #[test]
    fn kiwipete_perft_2() {
        assert_eq!(perft(&Board::from_fen(KIWIPETE).unwrap(), 2), 2_039);
    }

    #[test]
    fn kiwipete_perft_3() {
        assert_eq!(perft(&Board::from_fen(KIWIPETE).unwrap(), 3), 97_862);
    }

    // CPW Position 3: endgame with en passant interactions
    const CPW_POS3: &str = "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1";

    #[test]
    fn cpw_pos3_perft_1() {
        assert_eq!(perft(&Board::from_fen(CPW_POS3).unwrap(), 1), 14);
    }

    #[test]
    fn cpw_pos3_perft_2() {
        assert_eq!(perft(&Board::from_fen(CPW_POS3).unwrap(), 2), 191);
    }

    #[test]
    fn cpw_pos3_perft_3() {
        assert_eq!(perft(&Board::from_fen(CPW_POS3).unwrap(), 3), 2_812);
    }

    // ======================== King Can't Move to Attacked Squares (1a) ========================

    #[test]
    fn king_cant_move_into_rook_attack() {
        // Rook on a2 attacks the entire 2nd rank — king e1 can't go to d2/e2/f2
        let b = Board::from_fen("4k3/8/8/8/8/8/r7/4K3 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        let king_moves: Vec<_> = moves.iter().filter(|m| m.from() == Square::new(4, 0)).collect();
        // King should only be able to go to d1, f1 (rank 1 squares not attacked by rook)
        for m in &king_moves {
            assert_ne!(m.to().rank(), 1, "king must not move to rank 2 (attacked by rook): {m}");
        }
    }

    #[test]
    fn king_cant_move_into_bishop_attack() {
        // Bishop on f3 attacks diagonals — e2 (SW diagonal) and g2 (SE diagonal)
        // King e1 can't go to e2 (attacked by bishop f3)
        let b = Board::from_fen("4k3/8/8/8/8/5b2/8/4K3 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        let king_moves: Vec<_> = moves.iter().filter(|m| m.from() == Square::new(4, 0)).collect();
        // e2 is attacked by bishop f3 (SW diagonal)
        let forbidden = [Square::new(4, 1)]; // e2
        for m in &king_moves {
            assert!(!forbidden.contains(&m.to()), "king must not move to bishop-attacked square: {m}");
        }
    }

    #[test]
    fn king_cant_move_into_pawn_attack() {
        // Black pawn on e3 attacks d2 and f2 — king e1 can't go there
        let b = Board::from_fen("4k3/8/8/8/8/4p3/8/4K3 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        let king_moves: Vec<_> = moves.iter().filter(|m| m.from() == Square::new(4, 0)).collect();
        let forbidden = [Square::new(3, 1), Square::new(5, 1)]; // d2, f2
        for m in &king_moves {
            assert!(!forbidden.contains(&m.to()), "king must not move to pawn-attacked square: {m}");
        }
    }

    #[test]
    fn king_cant_move_adjacent_to_enemy_king() {
        // Black king on d3 — white king e1 can't go to d2 or e2 (adjacent to d3)
        let b = Board::from_fen("8/8/8/8/8/3k4/8/4K3 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        let king_moves: Vec<_> = moves.iter().filter(|m| m.from() == Square::new(4, 0)).collect();
        let forbidden = [Square::new(3, 1), Square::new(4, 1)]; // d2, e2
        for m in &king_moves {
            assert!(!forbidden.contains(&m.to()), "king must not move adjacent to enemy king: {m}");
        }
    }

    // ======================== King Capture Into Check (1b) ========================

    #[test]
    fn king_cant_capture_defended_piece() {
        // Bishop c3 defends pawn d2 — king e1 can't capture d2
        let b = Board::from_fen("4k3/8/8/8/8/2b5/3p4/4K3 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        assert!(
            !moves.iter().any(|m| m.from() == Square::new(4, 0) && m.to() == Square::new(3, 1)),
            "king must not capture defended pawn on d2"
        );
    }

    #[test]
    fn king_can_capture_undefended_piece() {
        // Pawn on d2 is undefended — king e1 CAN capture it
        let b = Board::from_fen("4k3/8/8/8/8/8/3p4/4K3 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        assert!(
            moves.iter().any(|m| m.from() == Square::new(4, 0) && m.to() == Square::new(3, 1)),
            "king should be able to capture undefended pawn on d2"
        );
    }

    #[test]
    fn king_cant_capture_piece_defended_by_knight() {
        // Knight c4 defends d2 — king e1 can't capture d2
        let b = Board::from_fen("4k3/8/8/8/2n5/8/3p4/4K3 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        assert!(
            !moves.iter().any(|m| m.from() == Square::new(4, 0) && m.to() == Square::new(3, 1)),
            "king must not capture pawn defended by knight"
        );
    }

    // ======================== King Can't Retreat Along Check Ray (1c) ========================

    #[test]
    fn king_cant_retreat_along_check_ray() {
        // King d1 in check from rook d8 — can't retreat to d2 (still on d-file ray)
        let b = Board::from_fen("3rk3/8/8/8/8/8/8/3K4 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        let king_moves: Vec<_> = moves.iter().filter(|m| m.from() == Square::new(3, 0)).collect();
        // d2 (3,1) is still on the d-file, attacked by rook
        for m in &king_moves {
            assert_ne!(m.to(), Square::new(3, 1), "king must not retreat along the check ray to d2");
        }
    }

    // ======================== En Passant Discovered Check (1d) ========================

    #[test]
    fn en_passant_discovered_check_illegal() {
        // Black king a4, white pawn d4, black pawn e4 (just double-pushed), rook h4.
        // EP capture e4xd3 removes black pawn from rank 4, exposing king a4 to rook h4.
        let b = Board::from_fen("8/8/8/8/k2Pp2R/8/8/4K3 b - d3 0 1").unwrap();
        let moves = b.generate_legal_moves();
        assert!(
            !moves.iter().any(|m| matches!(m.kind(), MoveKind::EnPassant)),
            "en passant must be illegal when it exposes own king to rook"
        );
    }

    #[test]
    fn en_passant_legal_when_no_pin() {
        // Same position but no rook — EP should be legal
        let b = Board::from_fen("8/8/8/8/k2Pp3/8/8/4K3 b - d3 0 1").unwrap();
        let moves = b.generate_legal_moves();
        assert!(
            moves.iter().any(|m| matches!(m.kind(), MoveKind::EnPassant)),
            "en passant should be legal when no pin exists"
        );
    }

    // ======================== Double Check (1e) ========================

    #[test]
    fn double_check_only_king_can_move() {
        // King d8 in double check from knight e6 and bishop g5
        let b = Board::from_fen("3k4/8/4N3/6B1/8/8/8/4K3 b - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        // In double check only king moves are legal
        assert!(moves.iter().all(|m| m.from() == Square::new(3, 7)), "only king moves should be legal in double check");
        assert!(!moves.is_empty(), "king should have at least one escape");
    }

    #[test]
    fn double_check_blocks_dont_work() {
        // Same double check + black pawn d7 that could theoretically block — still can't
        let b = Board::from_fen("3k4/3p4/4N3/6B1/8/8/8/4K3 b - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        assert!(
            !moves.iter().any(|m| m.from() == Square::new(3, 6)),
            "pawn can't resolve double check"
        );
    }

    // ======================== Pin Directions (1f) ========================

    #[test]
    fn pinned_piece_rank() {
        // Knight d1 pinned by rook a1 along rank 1 to king e1
        let b = Board::from_fen("4k3/8/8/8/8/8/8/r2NK3 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        assert!(
            !moves.iter().any(|m| m.from() == Square::new(3, 0)),
            "knight pinned along rank can't move"
        );
    }

    #[test]
    fn pinned_piece_file() {
        // Knight e2 pinned by rook e7 along e-file to king e1
        let b = Board::from_fen("4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        assert!(
            !moves.iter().any(|m| m.from() == Square::new(4, 1)),
            "knight pinned along file can't move"
        );
    }

    #[test]
    fn pinned_rook_can_move_along_pin() {
        // Rook e3 pinned on e-file by black rook e8, but can slide along e-file
        let b = Board::from_fen("4r2k/8/8/8/8/4R3/8/4K3 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        let rook_moves: Vec<_> = moves.iter().filter(|m| m.from() == Square::new(4, 2)).collect();
        assert!(!rook_moves.is_empty(), "rook pinned on file should still move along that file");
        // All rook moves should stay on the e-file
        for m in &rook_moves {
            assert_eq!(m.to().file(), 4, "pinned rook can only move along pin line (e-file)");
        }
    }

    #[test]
    fn pinned_bishop_can_move_along_pin() {
        // Bishop b2 pinned on a1-d4 diagonal by queen d4, can move to c3 or capture d4
        let b = Board::from_fen("4k3/8/8/8/3q4/8/1B6/K7 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        let bishop_moves: Vec<_> = moves.iter().filter(|m| m.from() == Square::new(1, 1)).collect();
        assert!(!bishop_moves.is_empty(), "bishop pinned on diagonal should move along that diagonal");
        // c3 and d4 are on the pin diagonal
        let valid_targets = [Square::new(2, 2), Square::new(3, 3)];
        for m in &bishop_moves {
            assert!(valid_targets.contains(&m.to()), "pinned bishop must stay on diagonal: {m}");
        }
    }

    // ======================== Discovered Attack (1g) ========================

    #[test]
    fn discovered_check_is_legal() {
        // Knight e4 on e-file with rook e1 behind it — moving knight discovers check
        let b = Board::from_fen("4k3/8/8/8/4N3/8/8/4R2K w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        assert!(
            moves.iter().any(|m| m.from() == Square::new(4, 3)),
            "knight should be able to move, discovering check from rook"
        );
    }

    #[test]
    fn cannot_expose_own_king_via_discovery() {
        // Knight e5 pinned by rook e7 to king e1 — can't move
        let b = Board::from_fen("4k3/4r3/8/4N3/8/8/8/4K3 w - - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        assert!(
            !moves.iter().any(|m| m.from() == Square::new(4, 4)),
            "knight pinned to own king can't move"
        );
    }

    // ======================== Castling Destination Attack (1h) ========================

    #[test]
    fn no_castling_into_check_kingside() {
        // Black rook on g8 attacks g1 — white kingside castle blocked
        let b = Board::from_fen("4k1r1/8/8/8/8/8/8/R3K2R w KQ - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        assert!(
            !moves.iter()
                .any(|m| m.from().raw() == 4 && m.to().raw() == 6 && matches!(m.kind(), MoveKind::Castle)),
            "can't castle kingside when g1 is attacked"
        );
    }

    #[test]
    fn no_castling_into_check_queenside() {
        // Black rook on c8 attacks c1 — white queenside castle blocked
        let b = Board::from_fen("2r1k3/8/8/8/8/8/8/R3K2R w KQ - 0 1").unwrap();
        let moves = b.generate_legal_moves();
        assert!(
            !moves.iter()
                .any(|m| m.from().raw() == 4 && m.to().raw() == 2 && matches!(m.kind(), MoveKind::Castle)),
            "can't castle queenside when c1 is attacked"
        );
    }

    // ======================== Game State Integrity (1i) ========================

    #[test]
    fn make_move_fails_after_checkmate() {
        // Fool's mate position — white is checkmated
        let mut b = Board::from_fen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3").unwrap();
        assert_eq!(b.game_state(), GameState::Checkmate);
        // Any move attempt should fail
        assert!(!b.make_move(Move::from_uci("a2a3").unwrap()));
        assert!(!b.make_move(Move::from_uci("e2e4").unwrap()));
    }

    #[test]
    fn make_move_fails_after_stalemate() {
        let mut b = Board::from_fen("k7/2Q5/1K6/8/8/8/8/8 b - - 0 1").unwrap();
        assert_eq!(b.game_state(), GameState::Stalemate);
        assert!(!b.make_move(Move::from_uci("a8a7").unwrap()));
        assert!(!b.make_move(Move::from_uci("a8b8").unwrap()));
    }

    #[test]
    fn kings_survive_scholars_mate() {
        // Play through Scholar's mate and verify both kings exist at every step
        let mut b = Board::new();
        let moves = ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"];
        for uci in &moves {
            // Before each move, both kings must exist
            assert!(b.piece_at(Square::from_algebraic("e1").unwrap())
                .is_some_and(|p| p.piece_type() == PieceType::King && p.color() == Color::White)
                || (0..64).any(|i| b.piece_at(Square::from_index(i))
                    .is_some_and(|p| p.piece_type() == PieceType::King && p.color() == Color::White)),
                "white king missing before {uci}");
            assert!((0..64).any(|i| b.piece_at(Square::from_index(i))
                .is_some_and(|p| p.piece_type() == PieceType::King && p.color() == Color::Black)),
                "black king missing before {uci}");
            assert!(b.make_move(Move::from_uci(uci).unwrap()), "move {uci} should be legal");
        }
        assert_eq!(b.game_state(), GameState::Checkmate);
        // After checkmate, both kings still exist
        assert!((0..64).any(|i| b.piece_at(Square::from_index(i))
            .is_some_and(|p| p.piece_type() == PieceType::King && p.color() == Color::White)),
            "white king missing after checkmate");
        assert!((0..64).any(|i| b.piece_at(Square::from_index(i))
            .is_some_and(|p| p.piece_type() == PieceType::King && p.color() == Color::Black)),
            "black king missing after checkmate");
    }

    // ======================== Additional PERFT Positions (1j) ========================

    // Position 4: promotion-heavy with castling and en passant
    const CPW_POS4: &str = "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1";

    #[test]
    fn cpw_pos4_perft_1() {
        assert_eq!(perft(&Board::from_fen(CPW_POS4).unwrap(), 1), 6);
    }

    #[test]
    fn cpw_pos4_perft_2() {
        assert_eq!(perft(&Board::from_fen(CPW_POS4).unwrap(), 2), 264);
    }

    #[test]
    fn cpw_pos4_perft_3() {
        assert_eq!(perft(&Board::from_fen(CPW_POS4).unwrap(), 3), 9_467);
    }

    // Position 5: promotion and en passant edge cases
    const CPW_POS5: &str = "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8";

    #[test]
    fn cpw_pos5_perft_1() {
        assert_eq!(perft(&Board::from_fen(CPW_POS5).unwrap(), 1), 44);
    }

    #[test]
    fn cpw_pos5_perft_2() {
        assert_eq!(perft(&Board::from_fen(CPW_POS5).unwrap(), 2), 1_486);
    }

    #[test]
    fn cpw_pos5_perft_3() {
        assert_eq!(perft(&Board::from_fen(CPW_POS5).unwrap(), 3), 62_379);
    }

    // Position 6: mirrored position, many tactical possibilities
    const CPW_POS6: &str = "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10";

    #[test]
    fn cpw_pos6_perft_1() {
        assert_eq!(perft(&Board::from_fen(CPW_POS6).unwrap(), 1), 46);
    }

    #[test]
    fn cpw_pos6_perft_2() {
        assert_eq!(perft(&Board::from_fen(CPW_POS6).unwrap(), 2), 2_079);
    }

    #[test]
    fn cpw_pos6_perft_3() {
        assert_eq!(perft(&Board::from_fen(CPW_POS6).unwrap(), 3), 89_890);
    }
}

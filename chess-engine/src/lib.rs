use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[cfg(feature = "console_error_panic_hook")]
pub fn set_panic_hook() {
    console_error_panic_hook::set_once();
}

// Bitboard type for efficient board representation
type Bitboard = u64;

// Square indices (0 = a1, 63 = h8)
const fn square(file: u8, rank: u8) -> u8 {
    rank * 8 + file
}

const fn rank_of(sq: u8) -> u8 {
    sq / 8
}

const fn file_of(sq: u8) -> u8 {
    sq % 8
}

// Piece types
#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[repr(u8)]
pub enum PieceType {
    Pawn = 0,
    Knight = 1,
    Bishop = 2,
    Rook = 3,
    Queen = 4,
    King = 5,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[repr(u8)]
pub enum Color {
    White = 0,
    Black = 1,
}

impl Color {
    fn opposite(self) -> Color {
        match self {
            Color::White => Color::Black,
            Color::Black => Color::White,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
pub struct Piece {
    pub piece_type: PieceType,
    pub color: Color,
}

// Move representation (16 bits: from 6 bits, to 6 bits, flags 4 bits)
#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
pub struct Move {
    pub from: u8,
    pub to: u8,
    pub promotion: Option<PieceType>,
    pub is_castling: bool,
    pub is_en_passant: bool,
}

impl Move {
    pub fn new(from: u8, to: u8) -> Self {
        Move {
            from,
            to,
            promotion: None,
            is_castling: false,
            is_en_passant: false,
        }
    }

    pub fn with_promotion(from: u8, to: u8, promotion: PieceType) -> Self {
        Move {
            from,
            to,
            promotion: Some(promotion),
            is_castling: false,
            is_en_passant: false,
        }
    }

    pub fn castling(from: u8, to: u8) -> Self {
        Move {
            from,
            to,
            promotion: None,
            is_castling: true,
            is_en_passant: false,
        }
    }

    pub fn en_passant(from: u8, to: u8) -> Self {
        Move {
            from,
            to,
            promotion: None,
            is_castling: false,
            is_en_passant: true,
        }
    }

    pub fn to_uci(&self) -> String {
        let from_file = (b'a' + file_of(self.from)) as char;
        let from_rank = (b'1' + rank_of(self.from)) as char;
        let to_file = (b'a' + file_of(self.to)) as char;
        let to_rank = (b'1' + rank_of(self.to)) as char;

        let mut uci = format!("{}{}{}{}", from_file, from_rank, to_file, to_rank);

        if let Some(promo) = self.promotion {
            let promo_char = match promo {
                PieceType::Queen => 'q',
                PieceType::Rook => 'r',
                PieceType::Bishop => 'b',
                PieceType::Knight => 'n',
                _ => 'q',
            };
            uci.push(promo_char);
        }

        uci
    }

    pub fn from_uci(uci: &str) -> Option<Move> {
        if uci.len() < 4 {
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

        let from = square(from_file, from_rank);
        let to = square(to_file, to_rank);

        let promotion = if uci.len() > 4 {
            match bytes[4] {
                b'q' | b'Q' => Some(PieceType::Queen),
                b'r' | b'R' => Some(PieceType::Rook),
                b'b' | b'B' => Some(PieceType::Bishop),
                b'n' | b'N' => Some(PieceType::Knight),
                _ => None,
            }
        } else {
            None
        };

        Some(Move {
            from,
            to,
            promotion,
            is_castling: false,
            is_en_passant: false,
        })
    }
}

// Castling rights
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct CastlingRights {
    pub white_kingside: bool,
    pub white_queenside: bool,
    pub black_kingside: bool,
    pub black_queenside: bool,
}

impl Default for CastlingRights {
    fn default() -> Self {
        CastlingRights {
            white_kingside: true,
            white_queenside: true,
            black_kingside: true,
            black_queenside: true,
        }
    }
}

// Game state
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum GameState {
    InProgress,
    Checkmate,
    Stalemate,
    Draw,
}

// Chess board using bitboards
#[derive(Clone)]
pub struct Board {
    // Piece bitboards [color][piece_type]
    pieces: [[Bitboard; 6]; 2],
    // Combined occupancy
    occupancy: [Bitboard; 2],
    all_occupancy: Bitboard,
    // Game state
    side_to_move: Color,
    castling: CastlingRights,
    en_passant: Option<u8>,
    halfmove_clock: u16,
    fullmove_number: u16,
}

// Precomputed attack tables
struct AttackTables {
    knight_attacks: [Bitboard; 64],
    king_attacks: [Bitboard; 64],
    pawn_attacks: [[Bitboard; 64]; 2],
    ray_attacks: [[Bitboard; 8]; 64], // 8 directions per square
}

use std::sync::OnceLock;

static ATTACK_TABLES: OnceLock<AttackTables> = OnceLock::new();

fn get_attack_tables() -> &'static AttackTables {
    ATTACK_TABLES.get_or_init(AttackTables::new)
}

impl AttackTables {
    fn new() -> Self {
        let mut tables = AttackTables {
            knight_attacks: [0; 64],
            king_attacks: [0; 64],
            pawn_attacks: [[0; 64]; 2],
            ray_attacks: [[0; 8]; 64],
        };

        for sq in 0..64u8 {
            tables.knight_attacks[sq as usize] = Self::compute_knight_attacks(sq);
            tables.king_attacks[sq as usize] = Self::compute_king_attacks(sq);
            tables.pawn_attacks[0][sq as usize] = Self::compute_pawn_attacks(sq, Color::White);
            tables.pawn_attacks[1][sq as usize] = Self::compute_pawn_attacks(sq, Color::Black);
            tables.ray_attacks[sq as usize] = Self::compute_ray_attacks(sq);
        }

        tables
    }

    fn compute_knight_attacks(sq: u8) -> Bitboard {
        let mut attacks = 0u64;
        let rank = rank_of(sq) as i8;
        let file = file_of(sq) as i8;

        let offsets: [(i8, i8); 8] = [
            (-2, -1), (-2, 1), (-1, -2), (-1, 2),
            (1, -2), (1, 2), (2, -1), (2, 1),
        ];

        for (dr, df) in offsets {
            let nr = rank + dr;
            let nf = file + df;
            if (0..8).contains(&nr) && (0..8).contains(&nf) {
                attacks |= 1u64 << square(nf as u8, nr as u8);
            }
        }
        attacks
    }

    fn compute_king_attacks(sq: u8) -> Bitboard {
        let mut attacks = 0u64;
        let rank = rank_of(sq) as i8;
        let file = file_of(sq) as i8;

        for dr in -1..=1 {
            for df in -1..=1 {
                if dr == 0 && df == 0 {
                    continue;
                }
                let nr = rank + dr;
                let nf = file + df;
                if (0..8).contains(&nr) && (0..8).contains(&nf) {
                    attacks |= 1u64 << square(nf as u8, nr as u8);
                }
            }
        }
        attacks
    }

    fn compute_pawn_attacks(sq: u8, color: Color) -> Bitboard {
        let mut attacks = 0u64;
        let rank = rank_of(sq) as i8;
        let file = file_of(sq) as i8;

        let dir = if color == Color::White { 1 } else { -1 };
        let nr = rank + dir;

        if (0..8).contains(&nr) {
            if file > 0 {
                attacks |= 1u64 << square((file - 1) as u8, nr as u8);
            }
            if file < 7 {
                attacks |= 1u64 << square((file + 1) as u8, nr as u8);
            }
        }
        attacks
    }

    fn compute_ray_attacks(sq: u8) -> [Bitboard; 8] {
        let mut rays = [0u64; 8];
        let rank = rank_of(sq) as i8;
        let file = file_of(sq) as i8;

        // Directions: N, NE, E, SE, S, SW, W, NW
        let directions: [(i8, i8); 8] = [
            (1, 0), (1, 1), (0, 1), (-1, 1),
            (-1, 0), (-1, -1), (0, -1), (1, -1),
        ];

        for (dir_idx, (dr, df)) in directions.iter().enumerate() {
            let mut r = rank + dr;
            let mut f = file + df;
            while (0..8).contains(&r) && (0..8).contains(&f) {
                rays[dir_idx] |= 1u64 << square(f as u8, r as u8);
                r += dr;
                f += df;
            }
        }
        rays
    }
}

impl Default for Board {
    fn default() -> Self {
        Self::new()
    }
}

impl Board {
    pub fn new() -> Self {
        Self::from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1").unwrap()
    }

    pub fn from_fen(fen: &str) -> Option<Self> {
        let parts: Vec<&str> = fen.split_whitespace().collect();
        if parts.len() < 4 {
            return None;
        }

        let mut board = Board {
            pieces: [[0; 6]; 2],
            occupancy: [0; 2],
            all_occupancy: 0,
            side_to_move: Color::White,
            castling: CastlingRights {
                white_kingside: false,
                white_queenside: false,
                black_kingside: false,
                black_queenside: false,
            },
            en_passant: None,
            halfmove_clock: 0,
            fullmove_number: 1,
        };

        // Parse piece placement
        let mut rank = 7u8;
        let mut file = 0u8;
        for c in parts[0].chars() {
            match c {
                '/' => {
                    rank = rank.wrapping_sub(1);
                    file = 0;
                }
                '1'..='8' => {
                    file += c as u8 - b'0';
                }
                _ => {
                    let (piece_type, color) = match c {
                        'P' => (PieceType::Pawn, Color::White),
                        'N' => (PieceType::Knight, Color::White),
                        'B' => (PieceType::Bishop, Color::White),
                        'R' => (PieceType::Rook, Color::White),
                        'Q' => (PieceType::Queen, Color::White),
                        'K' => (PieceType::King, Color::White),
                        'p' => (PieceType::Pawn, Color::Black),
                        'n' => (PieceType::Knight, Color::Black),
                        'b' => (PieceType::Bishop, Color::Black),
                        'r' => (PieceType::Rook, Color::Black),
                        'q' => (PieceType::Queen, Color::Black),
                        'k' => (PieceType::King, Color::Black),
                        _ => return None,
                    };
                    let sq = square(file, rank);
                    let bb = 1u64 << sq;
                    board.pieces[color as usize][piece_type as usize] |= bb;
                    board.occupancy[color as usize] |= bb;
                    file += 1;
                }
            }
        }

        board.all_occupancy = board.occupancy[0] | board.occupancy[1];

        // Parse side to move
        board.side_to_move = if parts[1] == "w" {
            Color::White
        } else {
            Color::Black
        };

        // Parse castling rights
        for c in parts[2].chars() {
            match c {
                'K' => board.castling.white_kingside = true,
                'Q' => board.castling.white_queenside = true,
                'k' => board.castling.black_kingside = true,
                'q' => board.castling.black_queenside = true,
                '-' => {}
                _ => {}
            }
        }

        // Parse en passant
        if parts[3] != "-" && parts[3].len() >= 2 {
            let ep_file = parts[3].as_bytes()[0].wrapping_sub(b'a');
            let ep_rank = parts[3].as_bytes()[1].wrapping_sub(b'1');
            if ep_file < 8 && ep_rank < 8 {
                board.en_passant = Some(square(ep_file, ep_rank));
            }
        }

        // Parse halfmove clock and fullmove number
        if parts.len() > 4 {
            board.halfmove_clock = parts[4].parse().unwrap_or(0);
        }
        if parts.len() > 5 {
            board.fullmove_number = parts[5].parse().unwrap_or(1);
        }

        Some(board)
    }

    pub fn to_fen(&self) -> String {
        let mut fen = String::new();

        // Piece placement
        for rank in (0..8).rev() {
            let mut empty = 0;
            for file in 0..8 {
                let sq = square(file, rank);

                if let Some(piece) = self.piece_at(sq) {
                    if empty > 0 {
                        fen.push_str(&empty.to_string());
                        empty = 0;
                    }
                    let c = match (piece.piece_type, piece.color) {
                        (PieceType::Pawn, Color::White) => 'P',
                        (PieceType::Knight, Color::White) => 'N',
                        (PieceType::Bishop, Color::White) => 'B',
                        (PieceType::Rook, Color::White) => 'R',
                        (PieceType::Queen, Color::White) => 'Q',
                        (PieceType::King, Color::White) => 'K',
                        (PieceType::Pawn, Color::Black) => 'p',
                        (PieceType::Knight, Color::Black) => 'n',
                        (PieceType::Bishop, Color::Black) => 'b',
                        (PieceType::Rook, Color::Black) => 'r',
                        (PieceType::Queen, Color::Black) => 'q',
                        (PieceType::King, Color::Black) => 'k',
                    };
                    fen.push(c);
                } else {
                    empty += 1;
                }
            }
            if empty > 0 {
                fen.push_str(&empty.to_string());
            }
            if rank > 0 {
                fen.push('/');
            }
        }

        // Side to move
        fen.push(' ');
        fen.push(if self.side_to_move == Color::White {
            'w'
        } else {
            'b'
        });

        // Castling rights
        fen.push(' ');
        let mut castling = String::new();
        if self.castling.white_kingside {
            castling.push('K');
        }
        if self.castling.white_queenside {
            castling.push('Q');
        }
        if self.castling.black_kingside {
            castling.push('k');
        }
        if self.castling.black_queenside {
            castling.push('q');
        }
        if castling.is_empty() {
            castling.push('-');
        }
        fen.push_str(&castling);

        // En passant
        fen.push(' ');
        if let Some(ep) = self.en_passant {
            let file = (b'a' + file_of(ep)) as char;
            let rank = (b'1' + rank_of(ep)) as char;
            fen.push(file);
            fen.push(rank);
        } else {
            fen.push('-');
        }

        // Halfmove clock and fullmove number
        fen.push_str(&format!(" {} {}", self.halfmove_clock, self.fullmove_number));

        fen
    }

    pub fn piece_at(&self, sq: u8) -> Option<Piece> {
        let bb = 1u64 << sq;

        for color in [Color::White, Color::Black] {
            if self.occupancy[color as usize] & bb != 0 {
                for pt in [
                    PieceType::Pawn,
                    PieceType::Knight,
                    PieceType::Bishop,
                    PieceType::Rook,
                    PieceType::Queen,
                    PieceType::King,
                ] {
                    if self.pieces[color as usize][pt as usize] & bb != 0 {
                        return Some(Piece {
                            piece_type: pt,
                            color,
                        });
                    }
                }
            }
        }
        None
    }

    pub fn side_to_move(&self) -> Color {
        self.side_to_move
    }

    fn king_square(&self, color: Color) -> u8 {
        let king_bb = self.pieces[color as usize][PieceType::King as usize];
        king_bb.trailing_zeros() as u8
    }

    fn is_square_attacked(&self, sq: u8, by_color: Color) -> bool {
        let them = by_color as usize;

        // Knight attacks
        let knights = self.pieces[them][PieceType::Knight as usize];
        if get_attack_tables().knight_attacks[sq as usize] & knights != 0 {
            return true;
        }

        // King attacks
        let king = self.pieces[them][PieceType::King as usize];
        if get_attack_tables().king_attacks[sq as usize] & king != 0 {
            return true;
        }

        // Pawn attacks
        let pawns = self.pieces[them][PieceType::Pawn as usize];
        let pawn_dir = if by_color == Color::White { 1 } else { 0 };
        if get_attack_tables().pawn_attacks[1 - pawn_dir][sq as usize] & pawns != 0 {
            return true;
        }

        // Sliding piece attacks (bishop, rook, queen)
        let bishops = self.pieces[them][PieceType::Bishop as usize];
        let rooks = self.pieces[them][PieceType::Rook as usize];
        let queens = self.pieces[them][PieceType::Queen as usize];

        // Diagonal attacks (bishop + queen)
        for dir in [1, 3, 5, 7] {
            // NE, SE, SW, NW
            let ray = get_attack_tables().ray_attacks[sq as usize][dir];
            let blockers = ray & self.all_occupancy;
            if blockers != 0 {
                let blocker_sq = if dir < 4 {
                    blockers.trailing_zeros() as u8
                } else {
                    63 - blockers.leading_zeros() as u8
                };
                let blocker_bb = 1u64 << blocker_sq;
                if blocker_bb & (bishops | queens) != 0 {
                    return true;
                }
            }
        }

        // Straight attacks (rook + queen)
        for dir in [0, 2, 4, 6] {
            // N, E, S, W
            let ray = get_attack_tables().ray_attacks[sq as usize][dir];
            let blockers = ray & self.all_occupancy;
            if blockers != 0 {
                let blocker_sq = if dir < 4 {
                    blockers.trailing_zeros() as u8
                } else {
                    63 - blockers.leading_zeros() as u8
                };
                let blocker_bb = 1u64 << blocker_sq;
                if blocker_bb & (rooks | queens) != 0 {
                    return true;
                }
            }
        }

        false
    }

    pub fn is_in_check(&self, color: Color) -> bool {
        let king_sq = self.king_square(color);
        self.is_square_attacked(king_sq, color.opposite())
    }

    pub fn generate_legal_moves(&self) -> Vec<Move> {
        let pseudo_legal = self.generate_pseudo_legal_moves();
        pseudo_legal
            .into_iter()
            .filter(|m| {
                let mut board = self.clone();
                board.make_move_unchecked(*m);
                !board.is_in_check(self.side_to_move)
            })
            .collect()
    }

    fn generate_pseudo_legal_moves(&self) -> Vec<Move> {
        let mut moves = Vec::with_capacity(256);
        let us = self.side_to_move as usize;
        let them = 1 - us;

        // Pawn moves
        let pawns = self.pieces[us][PieceType::Pawn as usize];
        let (push_dir, start_rank, promo_rank): (i8, u8, u8) = if self.side_to_move == Color::White {
            (8, 1, 7)
        } else {
            (-8, 6, 0)
        };

        let mut pawn_bb = pawns;
        while pawn_bb != 0 {
            let from = pawn_bb.trailing_zeros() as u8;
            pawn_bb &= pawn_bb - 1;

            let from_rank = rank_of(from);
            let to = (from as i8 + push_dir) as u8;

            // Single push
            if self.all_occupancy & (1u64 << to) == 0 {
                if rank_of(to) == promo_rank {
                    for promo in [
                        PieceType::Queen,
                        PieceType::Rook,
                        PieceType::Bishop,
                        PieceType::Knight,
                    ] {
                        moves.push(Move::with_promotion(from, to, promo));
                    }
                } else {
                    moves.push(Move::new(from, to));

                    // Double push
                    if from_rank == start_rank {
                        let double_to = (to as i8 + push_dir) as u8;
                        if self.all_occupancy & (1u64 << double_to) == 0 {
                            moves.push(Move::new(from, double_to));
                        }
                    }
                }
            }

            // Captures
            let attacks = get_attack_tables().pawn_attacks[us][from as usize];
            let captures = attacks & self.occupancy[them];
            let mut cap_bb = captures;
            while cap_bb != 0 {
                let cap_to = cap_bb.trailing_zeros() as u8;
                cap_bb &= cap_bb - 1;

                if rank_of(cap_to) == promo_rank {
                    for promo in [
                        PieceType::Queen,
                        PieceType::Rook,
                        PieceType::Bishop,
                        PieceType::Knight,
                    ] {
                        moves.push(Move::with_promotion(from, cap_to, promo));
                    }
                } else {
                    moves.push(Move::new(from, cap_to));
                }
            }

            // En passant
            if let Some(ep_sq) = self.en_passant {
                if attacks & (1u64 << ep_sq) != 0 {
                    moves.push(Move::en_passant(from, ep_sq));
                }
            }
        }

        // Knight moves
        let knights = self.pieces[us][PieceType::Knight as usize];
        let mut knight_bb = knights;
        while knight_bb != 0 {
            let from = knight_bb.trailing_zeros() as u8;
            knight_bb &= knight_bb - 1;

            let attacks = get_attack_tables().knight_attacks[from as usize];
            let targets = attacks & !self.occupancy[us];
            let mut target_bb = targets;
            while target_bb != 0 {
                let to = target_bb.trailing_zeros() as u8;
                target_bb &= target_bb - 1;
                moves.push(Move::new(from, to));
            }
        }

        // King moves
        let king = self.pieces[us][PieceType::King as usize];
        let king_sq = king.trailing_zeros() as u8;
        let king_attacks = get_attack_tables().king_attacks[king_sq as usize];
        let king_targets = king_attacks & !self.occupancy[us];
        let mut king_target_bb = king_targets;
        while king_target_bb != 0 {
            let to = king_target_bb.trailing_zeros() as u8;
            king_target_bb &= king_target_bb - 1;
            moves.push(Move::new(king_sq, to));
        }

        // Castling
        if self.side_to_move == Color::White {
            // Kingside castling - e1, f1, g1 must be clear and not attacked
            if self.castling.white_kingside
                && !self.is_in_check(Color::White)
                && self.all_occupancy & 0x60 == 0
                && !self.is_square_attacked(5, Color::Black)
                && !self.is_square_attacked(6, Color::Black)
            {
                moves.push(Move::castling(4, 6));
            }
            // Queenside castling - b1, c1, d1 must be clear and c1, d1 not attacked
            if self.castling.white_queenside
                && !self.is_in_check(Color::White)
                && self.all_occupancy & 0x0E == 0
                && !self.is_square_attacked(2, Color::Black)
                && !self.is_square_attacked(3, Color::Black)
            {
                moves.push(Move::castling(4, 2));
            }
        } else {
            if self.castling.black_kingside
                && !self.is_in_check(Color::Black)
                && self.all_occupancy & 0x6000000000000000 == 0
                && !self.is_square_attacked(61, Color::White)
                && !self.is_square_attacked(62, Color::White)
            {
                moves.push(Move::castling(60, 62));
            }
            if self.castling.black_queenside
                && !self.is_in_check(Color::Black)
                && self.all_occupancy & 0x0E00000000000000 == 0
                && !self.is_square_attacked(58, Color::White)
                && !self.is_square_attacked(59, Color::White)
            {
                moves.push(Move::castling(60, 58));
            }
        }

        // Sliding pieces (bishop, rook, queen)
        for (pt, dirs) in [
            (PieceType::Bishop, &[1, 3, 5, 7][..]),
            (PieceType::Rook, &[0, 2, 4, 6][..]),
            (PieceType::Queen, &[0, 1, 2, 3, 4, 5, 6, 7][..]),
        ] {
            let mut piece_bb = self.pieces[us][pt as usize];
            while piece_bb != 0 {
                let from = piece_bb.trailing_zeros() as u8;
                piece_bb &= piece_bb - 1;

                for &dir in dirs {
                    let ray = get_attack_tables().ray_attacks[from as usize][dir];
                    let blockers = ray & self.all_occupancy;

                    let attacks = if blockers == 0 {
                        ray
                    } else {
                        let blocker_sq = if dir < 4 {
                            blockers.trailing_zeros() as u8
                        } else {
                            63 - blockers.leading_zeros() as u8
                        };
                        ray ^ get_attack_tables().ray_attacks[blocker_sq as usize][dir]
                    };

                    let targets = attacks & !self.occupancy[us];
                    let mut target_bb = targets;
                    while target_bb != 0 {
                        let to = target_bb.trailing_zeros() as u8;
                        target_bb &= target_bb - 1;
                        moves.push(Move::new(from, to));
                    }
                }
            }
        }

        moves
    }

    fn make_move_unchecked(&mut self, mv: Move) {
        let us = self.side_to_move as usize;
        let them = 1 - us;
        let from_bb = 1u64 << mv.from;
        let to_bb = 1u64 << mv.to;

        // Find the piece being moved
        let mut moving_piece = PieceType::Pawn;
        for pt in [
            PieceType::Pawn,
            PieceType::Knight,
            PieceType::Bishop,
            PieceType::Rook,
            PieceType::Queen,
            PieceType::King,
        ] {
            if self.pieces[us][pt as usize] & from_bb != 0 {
                moving_piece = pt;
                break;
            }
        }

        // Remove from source
        self.pieces[us][moving_piece as usize] ^= from_bb;
        self.occupancy[us] ^= from_bb;

        // Handle capture
        if self.occupancy[them] & to_bb != 0 {
            for pt in [
                PieceType::Pawn,
                PieceType::Knight,
                PieceType::Bishop,
                PieceType::Rook,
                PieceType::Queen,
            ] {
                if self.pieces[them][pt as usize] & to_bb != 0 {
                    self.pieces[them][pt as usize] ^= to_bb;
                    break;
                }
            }
            self.occupancy[them] ^= to_bb;
        }

        // Handle en passant capture
        if mv.is_en_passant {
            let captured_sq = if self.side_to_move == Color::White {
                mv.to - 8
            } else {
                mv.to + 8
            };
            let captured_bb = 1u64 << captured_sq;
            self.pieces[them][PieceType::Pawn as usize] ^= captured_bb;
            self.occupancy[them] ^= captured_bb;
        }

        // Place piece at destination (with promotion if applicable)
        let final_piece = mv.promotion.unwrap_or(moving_piece);
        self.pieces[us][final_piece as usize] |= to_bb;
        self.occupancy[us] |= to_bb;

        // Handle castling rook movement
        if mv.is_castling {
            let (rook_from, rook_to) = match mv.to {
                6 => (7, 5),   // White kingside
                2 => (0, 3),   // White queenside
                62 => (63, 61), // Black kingside
                58 => (56, 59), // Black queenside
                _ => (0, 0),
            };
            let rook_from_bb = 1u64 << rook_from;
            let rook_to_bb = 1u64 << rook_to;
            self.pieces[us][PieceType::Rook as usize] ^= rook_from_bb | rook_to_bb;
            self.occupancy[us] ^= rook_from_bb | rook_to_bb;
        }

        // Update en passant square
        self.en_passant = None;
        if moving_piece == PieceType::Pawn {
            let from_rank = rank_of(mv.from);
            let to_rank = rank_of(mv.to);
            if (from_rank == 1 && to_rank == 3) || (from_rank == 6 && to_rank == 4) {
                self.en_passant = Some((mv.from + mv.to) / 2);
            }
        }

        // Update castling rights
        match mv.from {
            0 => self.castling.white_queenside = false,
            4 => {
                self.castling.white_kingside = false;
                self.castling.white_queenside = false;
            }
            7 => self.castling.white_kingside = false,
            56 => self.castling.black_queenside = false,
            60 => {
                self.castling.black_kingside = false;
                self.castling.black_queenside = false;
            }
            63 => self.castling.black_kingside = false,
            _ => {}
        }
        match mv.to {
            0 => self.castling.white_queenside = false,
            7 => self.castling.white_kingside = false,
            56 => self.castling.black_queenside = false,
            63 => self.castling.black_kingside = false,
            _ => {}
        }

        // Update occupancy
        self.all_occupancy = self.occupancy[0] | self.occupancy[1];

        // Update side to move
        self.side_to_move = self.side_to_move.opposite();

        // Update halfmove clock
        if moving_piece == PieceType::Pawn || self.occupancy[them] & to_bb != 0 {
            self.halfmove_clock = 0;
        } else {
            self.halfmove_clock += 1;
        }

        // Update fullmove number
        if self.side_to_move == Color::White {
            self.fullmove_number += 1;
        }
    }

    pub fn make_move(&mut self, mv: Move) -> bool {
        let legal_moves = self.generate_legal_moves();
        let legal_move = legal_moves.iter().find(|m| {
            m.from == mv.from && m.to == mv.to && m.promotion == mv.promotion
        });

        if let Some(legal) = legal_move {
            self.make_move_unchecked(*legal);
            true
        } else {
            false
        }
    }

    pub fn game_state(&self) -> GameState {
        let legal_moves = self.generate_legal_moves();

        if legal_moves.is_empty() {
            if self.is_in_check(self.side_to_move) {
                return GameState::Checkmate;
            } else {
                return GameState::Stalemate;
            }
        }

        // Insufficient material
        let total_pieces = self.all_occupancy.count_ones();
        if total_pieces <= 3 {
            let knights = (self.pieces[0][PieceType::Knight as usize]
                | self.pieces[1][PieceType::Knight as usize])
                .count_ones();
            let bishops = (self.pieces[0][PieceType::Bishop as usize]
                | self.pieces[1][PieceType::Bishop as usize])
                .count_ones();
            let pawns = (self.pieces[0][PieceType::Pawn as usize]
                | self.pieces[1][PieceType::Pawn as usize])
                .count_ones();
            let rooks = (self.pieces[0][PieceType::Rook as usize]
                | self.pieces[1][PieceType::Rook as usize])
                .count_ones();
            let queens = (self.pieces[0][PieceType::Queen as usize]
                | self.pieces[1][PieceType::Queen as usize])
                .count_ones();

            if pawns == 0 && rooks == 0 && queens == 0 && knights + bishops <= 1 {
                return GameState::Draw;
            }
        }

        // 50-move rule
        if self.halfmove_clock >= 100 {
            return GameState::Draw;
        }

        GameState::InProgress
    }
}

// JSON-serializable structures for WASM interface
#[derive(Serialize, Deserialize)]
pub struct MoveJson {
    pub from: String,
    pub to: String,
    pub promotion: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct BoardJson {
    pub squares: Vec<Option<PieceJson>>,
    pub turn: String,
    pub castling: CastlingJson,
    pub en_passant: Option<String>,
    pub halfmove_clock: u16,
    pub fullmove_number: u16,
    pub move_history: Vec<MoveHistoryEntryJson>,
}

#[derive(Serialize, Deserialize)]
pub struct PieceJson {
    pub piece_type: String,
    pub color: String,
}

#[derive(Serialize, Deserialize)]
pub struct CastlingJson {
    pub white_kingside: bool,
    pub white_queenside: bool,
    pub black_kingside: bool,
    pub black_queenside: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MoveHistoryEntryJson {
    pub uci_move: String,
    pub resulting_fen: String,
}

// WASM bindings
#[wasm_bindgen]
pub struct ChessGame {
    board: Board,
    move_history: Vec<MoveHistoryEntryJson>,
}

// wasm_bindgen doesn't support Default trait implementations
#[allow(clippy::new_without_default)]
#[wasm_bindgen]
impl ChessGame {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ChessGame {
        #[cfg(feature = "console_error_panic_hook")]
        set_panic_hook();

        ChessGame {
            board: Board::new(),
            move_history: Vec::new(),
        }
    }

    #[wasm_bindgen]
    pub fn from_fen(fen: &str) -> Option<ChessGame> {
        Board::from_fen(fen).map(|board| ChessGame { board, move_history: Vec::new() })
    }

    #[wasm_bindgen]
    pub fn get_fen(&self) -> String {
        self.board.to_fen()
    }

    #[wasm_bindgen]
    pub fn get_legal_moves(&self) -> String {
        let moves: Vec<String> = self
            .board
            .generate_legal_moves()
            .iter()
            .map(|m| m.to_uci())
            .collect();
        serde_json::to_string(&moves).unwrap_or_else(|_| "[]".to_string())
    }

    #[wasm_bindgen]
    pub fn make_move(&mut self, uci: &str) -> bool {
        if let Some(mv) = Move::from_uci(uci) {
            if self.board.make_move(mv) {
                self.move_history.push(MoveHistoryEntryJson {
                    uci_move: uci.to_string(),
                    resulting_fen: self.board.to_fen(),
                });
                true
            } else {
                false
            }
        } else {
            false
        }
    }

    #[wasm_bindgen]
    pub fn get_board_state(&self) -> String {
        let mut squares = Vec::with_capacity(64);
        for sq in 0..64u8 {
            let piece = self.board.piece_at(sq).map(|p| PieceJson {
                piece_type: format!("{:?}", p.piece_type).to_lowercase(),
                color: format!("{:?}", p.color).to_lowercase(),
            });
            squares.push(piece);
        }

        let board_json = BoardJson {
            squares,
            turn: format!("{:?}", self.board.side_to_move()).to_lowercase(),
            castling: CastlingJson {
                white_kingside: self.board.castling.white_kingside,
                white_queenside: self.board.castling.white_queenside,
                black_kingside: self.board.castling.black_kingside,
                black_queenside: self.board.castling.black_queenside,
            },
            en_passant: self.board.en_passant.map(|sq| {
                let file = (b'a' + file_of(sq)) as char;
                let rank = (b'1' + rank_of(sq)) as char;
                format!("{}{}", file, rank)
            }),
            halfmove_clock: self.board.halfmove_clock,
            fullmove_number: self.board.fullmove_number,
            move_history: self.move_history.clone(),
        };

        serde_json::to_string(&board_json).unwrap_or_else(|_| "{}".to_string())
    }

    #[wasm_bindgen]
    pub fn get_game_state(&self) -> String {
        match self.board.game_state() {
            GameState::InProgress => "in_progress".to_string(),
            GameState::Checkmate => "checkmate".to_string(),
            GameState::Stalemate => "stalemate".to_string(),
            GameState::Draw => "draw".to_string(),
        }
    }

    #[wasm_bindgen]
    pub fn is_check(&self) -> bool {
        self.board.is_in_check(self.board.side_to_move())
    }

    #[wasm_bindgen]
    pub fn get_turn(&self) -> String {
        format!("{:?}", self.board.side_to_move()).to_lowercase()
    }

    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.board = Board::new();
        self.move_history.clear();
    }

    #[wasm_bindgen]
    pub fn get_move_history(&self) -> String {
        serde_json::to_string(&self.move_history).unwrap_or_else(|_| "[]".to_string())
    }

    #[wasm_bindgen]
    pub fn get_piece_at(&self, sq_str: &str) -> String {
        if sq_str.len() < 2 {
            return "null".to_string();
        }

        let bytes = sq_str.as_bytes();
        let file = bytes[0].wrapping_sub(b'a');
        let rank = bytes[1].wrapping_sub(b'1');

        if file > 7 || rank > 7 {
            return "null".to_string();
        }

        let sq = square(file, rank);
        match self.board.piece_at(sq) {
            Some(piece) => {
                let json = PieceJson {
                    piece_type: format!("{:?}", piece.piece_type).to_lowercase(),
                    color: format!("{:?}", piece.color).to_lowercase(),
                };
                serde_json::to_string(&json).unwrap_or_else(|_| "null".to_string())
            }
            None => "null".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ==================== Basic Tests ====================

    #[test]
    fn test_starting_position() {
        let board = Board::new();
        assert_eq!(
            board.to_fen(),
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        );
    }

    #[test]
    fn test_legal_moves_start() {
        let board = Board::new();
        let moves = board.generate_legal_moves();
        assert_eq!(moves.len(), 20); // 16 pawn moves + 4 knight moves
    }

    #[test]
    fn test_make_move() {
        let mut game = ChessGame::new();
        assert!(game.make_move("e2e4"));
        assert_eq!(game.get_turn(), "black");
    }

    // ==================== FEN Parsing Tests ====================

    #[test]
    fn test_fen_round_trip() {
        let fens = [
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
            "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
            "8/8/8/8/8/8/8/4K2k w - - 0 1",
        ];
        for fen in fens {
            let board = Board::from_fen(fen).expect("FEN should parse");
            assert_eq!(board.to_fen(), fen, "FEN round-trip failed for: {}", fen);
        }
    }

    #[test]
    fn test_invalid_fen() {
        assert!(Board::from_fen("invalid").is_none());
        assert!(Board::from_fen("").is_none());
        assert!(Board::from_fen("8/8/8/8/8/8/8/8").is_none()); // too few fields
    }

    // ==================== Castling Tests ====================

    #[test]
    fn test_white_kingside_castling() {
        // Position where white can castle kingside
        let board = Board::from_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1").unwrap();
        let moves = board.generate_legal_moves();
        let castling_move = moves.iter().find(|m| m.from == 4 && m.to == 6 && m.is_castling);
        assert!(castling_move.is_some(), "White kingside castling should be legal");
    }

    #[test]
    fn test_white_queenside_castling() {
        let board = Board::from_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1").unwrap();
        let moves = board.generate_legal_moves();
        let castling_move = moves.iter().find(|m| m.from == 4 && m.to == 2 && m.is_castling);
        assert!(castling_move.is_some(), "White queenside castling should be legal");
    }

    #[test]
    fn test_black_kingside_castling() {
        let board = Board::from_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b KQkq - 0 1").unwrap();
        let moves = board.generate_legal_moves();
        let castling_move = moves.iter().find(|m| m.from == 60 && m.to == 62 && m.is_castling);
        assert!(castling_move.is_some(), "Black kingside castling should be legal");
    }

    #[test]
    fn test_black_queenside_castling() {
        let board = Board::from_fen("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b KQkq - 0 1").unwrap();
        let moves = board.generate_legal_moves();
        let castling_move = moves.iter().find(|m| m.from == 60 && m.to == 58 && m.is_castling);
        assert!(castling_move.is_some(), "Black queenside castling should be legal");
    }

    #[test]
    fn test_no_castling_through_check() {
        // Rook on f8 attacks f1 - white cannot castle kingside
        let board = Board::from_fen("5r2/8/8/8/8/8/8/R3K2R w KQ - 0 1").unwrap();
        let moves = board.generate_legal_moves();
        let kingside_castle = moves.iter().find(|m| m.from == 4 && m.to == 6 && m.is_castling);
        assert!(kingside_castle.is_none(), "Cannot castle through check (f1 attacked)");
    }

    #[test]
    fn test_no_castling_when_in_check() {
        // White king is in check
        let board = Board::from_fen("r3k2r/pppppppp/8/8/4r3/8/PPPP1PPP/R3K2R w KQkq - 0 1").unwrap();
        let moves = board.generate_legal_moves();
        let any_castle = moves.iter().find(|m| m.is_castling);
        assert!(any_castle.is_none(), "Cannot castle when in check");
    }

    // ==================== En Passant Tests ====================

    #[test]
    fn test_en_passant_capture() {
        // White pawn on e5, black just played d7-d5
        let board = Board::from_fen("rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 1").unwrap();
        let moves = board.generate_legal_moves();
        let ep_capture = moves.iter().find(|m| m.is_en_passant);
        assert!(ep_capture.is_some(), "En passant capture should be available");
        let ep = ep_capture.unwrap();
        assert_eq!(ep.from, square(4, 4), "EP from e5");
        assert_eq!(ep.to, square(3, 5), "EP to d6");
    }

    #[test]
    fn test_en_passant_removes_pawn() {
        let mut board = Board::from_fen("rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 1").unwrap();
        let ep_move = Move::en_passant(square(4, 4), square(3, 5));
        board.make_move(ep_move);
        // d5 pawn should be gone
        assert!(board.piece_at(square(3, 4)).is_none(), "Captured pawn should be removed");
        // White pawn should be on d6
        let piece = board.piece_at(square(3, 5));
        assert!(piece.is_some());
        assert_eq!(piece.unwrap().piece_type, PieceType::Pawn);
        assert_eq!(piece.unwrap().color, Color::White);
    }

    // ==================== Check & Checkmate Tests ====================

    #[test]
    fn test_is_in_check() {
        // White king in check from black queen
        let board = Board::from_fen("4k3/8/8/8/8/8/4q3/4K3 w - - 0 1").unwrap();
        assert!(board.is_in_check(Color::White), "White should be in check");
    }

    #[test]
    fn test_not_in_check() {
        let board = Board::new();
        assert!(!board.is_in_check(Color::White), "White should not be in check at start");
        assert!(!board.is_in_check(Color::Black), "Black should not be in check at start");
    }

    #[test]
    fn test_checkmate_fools_mate() {
        // Fool's mate position
        let board = Board::from_fen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3").unwrap();
        assert_eq!(board.game_state(), GameState::Checkmate, "Should be checkmate");
    }

    #[test]
    fn test_checkmate_back_rank() {
        // Classic back rank mate: black king trapped by own pawns, white rook on 8th rank
        let board = Board::from_fen("3R2k1/5ppp/8/8/8/8/8/6K1 b - - 0 1").unwrap();
        assert_eq!(board.game_state(), GameState::Checkmate, "Should be back rank mate");
    }

    // ==================== Stalemate Tests ====================

    #[test]
    fn test_stalemate() {
        // Classic stalemate: black king has no moves but is not in check
        // White queen and king box in the black king
        let board = Board::from_fen("k7/2Q5/1K6/8/8/8/8/8 b - - 0 1").unwrap();
        assert_eq!(board.game_state(), GameState::Stalemate, "Should be stalemate");
    }

    #[test]
    fn test_stalemate_complex() {
        // Same pattern as test_stalemate but king in different corner
        let board = Board::from_fen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").unwrap();
        assert_eq!(board.game_state(), GameState::Stalemate, "Should be stalemate");
    }

    // ==================== Draw Tests ====================

    #[test]
    fn test_insufficient_material_kk() {
        // King vs King
        let board = Board::from_fen("8/8/8/8/8/8/4k3/4K3 w - - 0 1").unwrap();
        assert_eq!(board.game_state(), GameState::Draw, "K vs K should be draw");
    }

    #[test]
    fn test_insufficient_material_kbk() {
        // King + Bishop vs King
        let board = Board::from_fen("8/8/8/8/8/8/4k3/4KB2 w - - 0 1").unwrap();
        assert_eq!(board.game_state(), GameState::Draw, "K+B vs K should be draw");
    }

    #[test]
    fn test_insufficient_material_knk() {
        // King + Knight vs King
        let board = Board::from_fen("8/8/8/8/8/8/4k3/4KN2 w - - 0 1").unwrap();
        assert_eq!(board.game_state(), GameState::Draw, "K+N vs K should be draw");
    }

    // ==================== Promotion Tests ====================

    #[test]
    fn test_pawn_promotion_moves() {
        // White pawn on 7th rank
        let board = Board::from_fen("8/4P3/8/8/8/8/8/4K2k w - - 0 1").unwrap();
        let moves = board.generate_legal_moves();
        let promotions: Vec<_> = moves.iter().filter(|m| m.promotion.is_some()).collect();
        assert_eq!(promotions.len(), 4, "Should have 4 promotion options (Q, R, B, N)");
    }

    #[test]
    fn test_pawn_promotion_capture() {
        // White pawn can promote with capture
        let board = Board::from_fen("3r4/4P3/8/8/8/8/8/4K2k w - - 0 1").unwrap();
        let moves = board.generate_legal_moves();
        let capture_promotions: Vec<_> = moves.iter()
            .filter(|m| m.promotion.is_some() && m.to == square(3, 7))
            .collect();
        assert_eq!(capture_promotions.len(), 4, "Should have 4 capture-promotion options");
    }

    // ==================== Move Validation Tests ====================

    #[test]
    fn test_uci_move_parsing() {
        let m = Move::from_uci("e2e4").unwrap();
        assert_eq!(m.from, square(4, 1));
        assert_eq!(m.to, square(4, 3));
        assert!(m.promotion.is_none());

        let m = Move::from_uci("e7e8q").unwrap();
        assert_eq!(m.promotion, Some(PieceType::Queen));
    }

    #[test]
    fn test_invalid_uci_move() {
        assert!(Move::from_uci("").is_none());
        assert!(Move::from_uci("e2").is_none());
        assert!(Move::from_uci("z9z9").is_none());
    }

    #[test]
    fn test_illegal_move_rejected() {
        let mut game = ChessGame::new();
        // Try to move black piece when it's white's turn
        assert!(!game.make_move("e7e5"));
        // Try invalid move
        assert!(!game.make_move("e2e5")); // pawn can't move 3 squares
    }

    // ==================== Pin Tests ====================

    #[test]
    fn test_pinned_piece_cant_move() {
        // Knight on c3 is pinned by bishop on a5
        let board = Board::from_fen("4k3/8/8/b7/8/2N5/8/4K3 w - - 0 1").unwrap();
        let moves = board.generate_legal_moves();
        // The knight on c3 (square 18) should have no legal moves due to pin
        let knight_moves: Vec<_> = moves.iter().filter(|m| m.from == square(2, 2)).collect();
        assert!(knight_moves.is_empty(), "Pinned knight should have no legal moves");
    }

    // ==================== Game State Tests ====================

    #[test]
    fn test_game_in_progress() {
        let board = Board::new();
        assert_eq!(board.game_state(), GameState::InProgress);
    }

    #[test]
    fn test_fifty_move_rule() {
        // 50-move rule is when halfmove_clock >= 100
        let board = Board::from_fen("4k3/8/8/8/8/8/8/4K3 w - - 100 50").unwrap();
        assert_eq!(board.game_state(), GameState::Draw, "50-move rule should trigger draw");
    }
}

//! Integration tests that drive whole games: self-play progress (no shuffling
//! / no repetition) and a decisive result against a deterministic random mover.
//!
//! These exercise `smart_bot::search::best_move` end to end. They use only
//! `std` — the "random" opponent is a fixed-seed xorshift so results are
//! reproducible.

use std::collections::BTreeSet;

use chess_engine::{Board, Color, GameState, PieceType, Square};
use smart_bot::eval::material_value;
use smart_bot::search::{best_move, position_key};

/// A tiny deterministic PRNG (xorshift64) so the "random" opponent is
/// reproducible across runs — no external crates.
struct Xorshift(u64);

impl Xorshift {
    const fn new(seed: u64) -> Self {
        // Avoid the all-zero state, which xorshift cannot escape.
        Self(if seed == 0 { 0x9E37_79B9_7F4A_7C15 } else { seed })
    }

    const fn next_u64(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }

    /// Uniform-ish index in `0..len` (`len` must be non-empty).
    fn pick(&mut self, len: usize) -> usize {
        // `len` is a slice length, always well within `u64`; the modulo result
        // is `< len` so it round-trips back to `usize` without truncation.
        usize::try_from(self.next_u64() % len as u64).expect("modulo len fits in usize")
    }
}

/// Total material for `color` (used to adjudicate unfinished games).
fn material(board: &Board, color: Color) -> i32 {
    let mut total = 0;
    for i in 0..64u8 {
        let sq = Square::from_index(i);
        if let Some(p) = board.piece_at(sq) {
            if p.color() == color && p.piece_type() != PieceType::King {
                total += material_value(p.piece_type());
            }
        }
    }
    total
}

/// Outcome of a single game from White's perspective.
#[derive(Debug, PartialEq, Eq)]
enum Outcome {
    WhiteWin,
    BlackWin,
    Draw,
}

#[test]
fn self_play_never_repeats_a_position_and_develops() {
    let mut board = Board::new();
    let mut seen: BTreeSet<String> = BTreeSet::new();

    // A knight that never leaves its start square would be shuffling; track the
    // b1 knight's departure as a crude "development happened" proxy.
    let mut white_developed_a_piece = false;

    for _ply in 0..14 {
        let key = position_key(&board);
        assert!(
            seen.insert(key.clone()),
            "position repeated during self-play: {key}"
        );

        let Some(mv) = best_move(&board, &seen) else {
            break; // game over
        };

        // Detect a non-pawn, non-king piece leaving the back rank for White.
        if board.side_to_move() == Color::White {
            if let Some(p) = board.piece_at(mv.from()) {
                if matches!(
                    p.piece_type(),
                    PieceType::Knight | PieceType::Bishop | PieceType::Queen
                ) && mv.from().rank() == 0
                {
                    white_developed_a_piece = true;
                }
            }
        }

        assert!(board.make_move(mv), "self-play produced an illegal move");
    }

    assert!(
        white_developed_a_piece,
        "White never developed a minor/major piece in 14 plies — likely shuffling"
    );
}

/// Plays one game: `smart_is_white` decides which colour the smart bot has.
/// Capped at `max_plies`; if unfinished, adjudicated by material.
fn play_game(smart_is_white: bool, seed: u64, max_plies: u32) -> Outcome {
    let mut board = Board::new();
    let mut smart_seen: BTreeSet<String> = BTreeSet::new();
    let mut rng = Xorshift::new(seed);

    for _ in 0..max_plies {
        match board.game_state() {
            GameState::Checkmate => {
                // Side to move is mated: the *other* side won.
                return match board.side_to_move() {
                    Color::White => Outcome::BlackWin,
                    Color::Black => Outcome::WhiteWin,
                };
            }
            GameState::Stalemate | GameState::Draw => return Outcome::Draw,
            GameState::InProgress => {}
        }

        let smart_to_move = (board.side_to_move() == Color::White) == smart_is_white;

        let mv = if smart_to_move {
            let key = position_key(&board);
            smart_seen.insert(key);
            match best_move(&board, &smart_seen) {
                Some(m) => m,
                None => break,
            }
        } else {
            let legal = board.generate_legal_moves();
            if legal.is_empty() {
                break;
            }
            legal[rng.pick(legal.len())]
        };

        assert!(board.make_move(mv), "generated illegal move in play_game");

        // Early adjudication: once the smart bot is up by more than a rook the
        // outcome against a random mover is no longer in doubt. Ending here
        // keeps the suite fast without changing any verdict.
        let smart_color = if smart_is_white {
            Color::White
        } else {
            Color::Black
        };
        let smart_material = material(&board, smart_color);
        let random_material = material(&board, smart_color.opposite());
        if smart_material - random_material > 500 {
            return if smart_is_white {
                Outcome::WhiteWin
            } else {
                Outcome::BlackWin
            };
        }
    }

    // Unfinished: adjudicate by material.
    let w = material(&board, Color::White);
    let b = material(&board, Color::Black);
    match w.cmp(&b) {
        std::cmp::Ordering::Greater => Outcome::WhiteWin,
        std::cmp::Ordering::Less => Outcome::BlackWin,
        std::cmp::Ordering::Equal => Outcome::Draw,
    }
}

#[test]
fn beats_a_random_mover_decisively() {
    // 14 games alternating colours. 80 plies is ample for a decisive material
    // verdict against a random mover while keeping the suite fast.
    const GAMES: usize = 14;
    const MAX_PLIES: u32 = 80;

    let mut smart_wins = 0;
    let mut smart_losses = 0;

    for game in 0..GAMES {
        // Alternate the smart bot's colour game to game.
        let smart_is_white = game % 2 == 0;
        // Distinct, fixed seeds so games differ but stay reproducible.
        let seed = 0x1234_5678u64.wrapping_mul(game as u64 + 1) ^ 0xDEAD_BEEF;

        let outcome = play_game(smart_is_white, seed, MAX_PLIES);

        let smart_won = matches!(
            (smart_is_white, &outcome),
            (true, Outcome::WhiteWin) | (false, Outcome::BlackWin)
        );
        let smart_lost = matches!(
            (smart_is_white, &outcome),
            (true, Outcome::BlackWin) | (false, Outcome::WhiteWin)
        );

        if smart_won {
            smart_wins += 1;
        }
        if smart_lost {
            smart_losses += 1;
        }
    }

    assert_eq!(
        smart_losses, 0,
        "smart bot lost {smart_losses} game(s) to a random mover"
    );
    assert!(
        smart_wins >= 12,
        "smart bot only won {smart_wins}/{GAMES}; expected >= 12"
    );
}

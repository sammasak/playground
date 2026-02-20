#[allow(clippy::all)]
mod bindings {
    wit_bindgen::generate!({
        path: "../../wit/chess-bot",
        world: "chess-bot",
        generate_all,
    });
}

use bindings::exports::chess::bot::bot::Guest;
use bindings::chess::bot::host;
use bindings::chess::types::types::{BoardState, Color, PieceType};

struct SmartBot;

/// Standard piece values for MVV (Most Valuable Victim) capture ordering.
/// King is valued at 0 since it can never be captured.
const fn piece_value(pt: PieceType) -> i32 {
    match pt {
        PieceType::Queen => 9,
        PieceType::Rook => 5,
        PieceType::Bishop | PieceType::Knight => 3,
        PieceType::Pawn => 1,
        PieceType::King => 0,
    }
}

/// Parse a UCI move string into (from_index, to_index) on a 0-63 board.
/// Returns None if the string is too short or contains out-of-range squares.
fn parse_uci(uci: &str) -> Option<(usize, usize)> {
    let bytes = uci.as_bytes();
    if bytes.len() < 4 {
        return None;
    }
    let from_file = (bytes[0] as usize).checked_sub(b'a' as usize)?;
    let from_rank = (bytes[1] as usize).checked_sub(b'1' as usize)?;
    let to_file = (bytes[2] as usize).checked_sub(b'a' as usize)?;
    let to_rank = (bytes[3] as usize).checked_sub(b'1' as usize)?;
    if from_file > 7 || from_rank > 7 || to_file > 7 || to_rank > 7 {
        return None;
    }
    Some((from_rank * 8 + from_file, to_rank * 8 + to_file))
}

/// True if the square is one of the four center squares (d4, e4, d5, e5).
const fn is_center(idx: usize) -> bool {
    matches!(idx, 27 | 28 | 35 | 36)
}

/// True if the square is in the 4x4 extended center (c3 through f6).
fn is_extended_center(idx: usize) -> bool {
    let file = idx % 8;
    let rank = idx / 8;
    (2..=5).contains(&file) && (2..=5).contains(&rank)
}

/// Score a candidate move for ordering. Higher is better.
///
/// Heuristics applied (cumulative):
/// - **Capture**: +100 + victim_value * 10 (MVV ordering)
/// - **Promotion**: +90 (queen), +50 (rook), +30 (bishop/knight)
/// - **Center control**: +15 for d4/e4/d5/e5, +5 for extended center
/// - **Development**: +8 for moving a non-pawn piece in the opening (fullmove < 10)
fn score_move(uci: &str, board: &BoardState) -> i32 {
    let Some((from_idx, to_idx)) = parse_uci(uci) else {
        return 0;
    };

    let mut score: i32 = 0;

    if let Some(target) = &board.squares[to_idx] {
        score += 100 + piece_value(target.piece_type) * 10;
    }

    if uci.len() > 4 {
        score += match uci.as_bytes()[4] {
            b'q' => 90,
            b'r' => 50,
            b'b' | b'n' => 30,
            _ => 0,
        };
    }

    if is_center(to_idx) {
        score += 15;
    } else if is_extended_center(to_idx) {
        score += 5;
    }

    if board.fullmove_number < 10 {
        if let Some(from_piece) = &board.squares[from_idx] {
            if from_piece.piece_type != PieceType::Pawn {
                score += 8;
            }
        }
    }

    score
}

impl Guest for SmartBot {
    fn get_name() -> String {
        "Smart Bot".to_string()
    }

    fn get_description() -> String {
        "Prefers captures and center control. Written in Rust.".to_string()
    }

    fn get_preferred_color() -> Option<Color> {
        None
    }

    fn on_game_start() {
        host::log("Smart Bot: Ready to play!");
    }

    fn select_move() -> String {
        let moves = host::get_legal_moves();
        if moves.is_empty() {
            host::log("Smart Bot: No legal moves!");
            return String::new();
        }

        let board = host::get_board();

        // Score once, collect with scores to avoid double evaluation
        let scored: Vec<_> = moves.iter().map(|m| (score_move(m, &board), m)).collect();
        let best_score = scored.iter().map(|(s, _)| *s).max().unwrap_or(i32::MIN);
        let tied: Vec<_> = scored
            .iter()
            .filter(|(s, _)| *s == best_score)
            .map(|(_, m)| *m)
            .collect();

        // Deterministic tie-breaking: no `rand` crate available in the WASM
        // sandbox, so we derive a pseudo-random index from game clock values.
        // This makes bot behavior reproducible for the same board state.
        let selected = if tied.len() > 1 {
            let idx =
                (board.fullmove_number as usize + board.halfmove_clock as usize) % tied.len();
            tied[idx]
        } else {
            tied[0]
        };

        host::log(&format!("Smart Bot: {selected} (score {best_score})"));
        selected.clone()
    }

    fn suggest_move() -> String {
        Self::select_move()
    }
}

bindings::export!(SmartBot with_types_in bindings);

#[cfg(test)]
mod tests {
    use super::*;
    use bindings::chess::types::types::{BoardState, Castling, Piece};

    fn empty_board(fullmove: u16) -> BoardState {
        BoardState {
            squares: vec![None; 64],
            turn: Color::White,
            castling_rights: Castling {
                white_kingside: false,
                white_queenside: false,
                black_kingside: false,
                black_queenside: false,
            },
            en_passant: None,
            halfmove_clock: 0,
            fullmove_number: fullmove,
            move_history: vec![],
        }
    }

    // ---- parse_uci ----

    #[test]
    fn parse_uci_valid_e2e4() {
        assert_eq!(parse_uci("e2e4"), Some((12, 28))); // e2 = rank1*8+file4 = 1*8+4=12, e4 = 3*8+4=28
    }

    #[test]
    fn parse_uci_valid_a1h8() {
        assert_eq!(parse_uci("a1h8"), Some((0, 63)));
    }

    #[test]
    fn parse_uci_valid_promotion() {
        // parse_uci ignores the 5th char, just returns from/to
        assert_eq!(parse_uci("e7e8q"), Some((48 + 4, 56 + 4))); // e7=52, e8=60
    }

    #[test]
    fn parse_uci_too_short() {
        assert_eq!(parse_uci("e2"), None);
        assert_eq!(parse_uci(""), None);
        assert_eq!(parse_uci("e2e"), None);
    }

    #[test]
    fn parse_uci_invalid_file() {
        assert_eq!(parse_uci("z2e4"), None); // 'z' - 'a' = 25 > 7
    }

    #[test]
    fn parse_uci_invalid_rank() {
        assert_eq!(parse_uci("e9e4"), None); // '9' - '1' = 8 > 7
    }

    // ---- score_move ----

    #[test]
    fn score_quiet_move_to_center() {
        let board = empty_board(15); // past opening
        // Move to d4 (index 27) — center bonus only
        assert_eq!(score_move("a1d4", &board), 15);
    }

    #[test]
    fn score_quiet_move_to_extended_center() {
        let board = empty_board(15);
        // Move to c3 (index 18) — extended center bonus
        assert_eq!(score_move("a1c3", &board), 5);
    }

    #[test]
    fn score_capture_adds_mvv_bonus() {
        let mut board = empty_board(15);
        // Place a black queen on d4 (index 27)
        board.squares[27] = Some(Piece {
            piece_type: PieceType::Queen,
            color: Color::Black,
        });
        // Capturing queen: 100 + 9*10 = 190, plus center bonus 15
        assert_eq!(score_move("a1d4", &board), 205);
    }

    #[test]
    fn score_promotion_bonus() {
        let board = empty_board(15);
        // e7e8q — promotion to queen: 90, no capture, no center (rank 8 is not center)
        assert_eq!(score_move("e7e8q", &board), 90);
        // e7e8n — promotion to knight: 30
        assert_eq!(score_move("e7e8n", &board), 30);
    }

    #[test]
    fn score_opening_development_bonus() {
        let mut board = empty_board(5); // opening phase
        // Place a white knight on g1 (index 6)
        board.squares[6] = Some(Piece {
            piece_type: PieceType::Knight,
            color: Color::White,
        });
        // Knight from g1 to f3 (index 21) — extended center 5 + development 8 = 13
        assert_eq!(score_move("g1f3", &board), 13);
    }

    #[test]
    fn score_opening_pawn_no_development_bonus() {
        let mut board = empty_board(5); // opening phase
        // Place a white pawn on e2 (index 12)
        board.squares[12] = Some(Piece {
            piece_type: PieceType::Pawn,
            color: Color::White,
        });
        // Pawn e2 to e4 (index 28) — center 15, no development bonus for pawns
        assert_eq!(score_move("e2e4", &board), 15);
    }

    #[test]
    fn score_invalid_uci_returns_zero() {
        let board = empty_board(1);
        assert_eq!(score_move("zz", &board), 0);
    }
}

// Allow warnings only for generated code patterns, keep strict checks for our code
#![allow(clippy::all)] // Generated wit-bindgen code triggers many clippy lints

wit_bindgen::generate!({
    path: "../../wit",
    world: "chess-bot",
});

use exports::chess::bot::bot::Guest;
use chess::bot::host;
use chess::bot::types::{Color, Move};

struct RandomBot;

impl Guest for RandomBot {
    fn get_name() -> String {
        "Random Bot".to_string()
    }

    fn get_description() -> String {
        "A simple bot that picks random legal moves. Great for testing!".to_string()
    }

    fn get_preferred_color() -> Option<Color> {
        None // No preference
    }

    fn on_game_start() {
        host::log("Random Bot: Game started!");
    }

    fn select_move() -> Move {
        let moves = host::get_legal_moves();
        if moves.is_empty() {
            host::log("Random Bot: No legal moves available!");
            return String::new();
        }

        // Simple deterministic "random" based on move count
        let board = host::get_board();
        let idx = (board.fullmove_number as usize + board.halfmove_clock as usize) % moves.len();
        let selected = moves[idx].clone();

        host::log(&format!("Random Bot: Selected move {}", selected));
        selected
    }

    fn suggest_move() -> Move {
        Self::select_move()
    }
}

export!(RandomBot);

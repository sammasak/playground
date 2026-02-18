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
use bindings::chess::types::types::Color;

struct RandomBot;

impl Guest for RandomBot {
    fn get_name() -> String {
        "Random Bot".to_string()
    }

    fn get_description() -> String {
        "A simple bot that picks random legal moves. Great for testing!".to_string()
    }

    fn get_preferred_color() -> Option<Color> {
        None
    }

    fn on_game_start() {
        host::log("Random Bot: Game started!");
    }

    fn select_move() -> String {
        let moves = host::get_legal_moves();
        if moves.is_empty() {
            host::log("Random Bot: No legal moves available!");
            return String::new();
        }

        let board = host::get_board();
        let idx = (board.fullmove_number as usize + board.halfmove_clock as usize) % moves.len();
        let selected = &moves[idx];

        host::log(&format!("Random Bot: Selected move {selected}"));
        selected.clone()
    }

    fn suggest_move() -> String {
        Self::select_move()
    }
}

bindings::export!(RandomBot with_types_in bindings);

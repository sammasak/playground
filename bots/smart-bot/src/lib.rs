//! Smart Bot: a real search-based chess AI.
//!
//! All game-playing logic lives in native-testable pure modules
//! ([`eval`], [`ordering`], [`search`], [`pst`]) that operate on a
//! [`chess_engine::Board`]. This file is only the WASM Component Model glue: it
//! reads the current FEN from the host, drives the search, tracks position
//! history for repetition avoidance, and returns a UCI move string.

pub mod eval;
pub mod ordering;
pub mod pst;
pub mod search;

// The WIT bindings and host interface only exist inside the WASM component and
// cannot be exercised by native `cargo test`, so everything below is gated to
// the wasm build behind the `component` feature. Native tests link against the
// pure modules above; a plain wasm-bindgen consumer (e.g. the egui frontend)
// depends on this crate with `default-features = false` to skip the glue.
#[cfg(all(target_arch = "wasm32", feature = "component"))]
mod component {
    // reason: wit-bindgen macro output is generated code and not lint-clean.
    #[allow(clippy::all)]
    mod bindings {
        wit_bindgen::generate!({
            path: "../../wit/chess-bot",
            world: "chess-bot",
            generate_all,
        });
    }

    use std::cell::RefCell;
    use std::collections::BTreeSet;

    use chess_engine::Board;

    use crate::search;

    use bindings::chess::bot::host;
    use bindings::chess::types::types::Color;
    use bindings::exports::chess::bot::bot::Guest;

    struct SmartBot;

    thread_local! {
        /// Position keys seen so far this game, used to penalise repetition.
        /// The component is single-threaded, so a `thread_local` `RefCell` is a
        /// safe, simple store with interior mutability.
        static HISTORY: RefCell<BTreeSet<String>> = RefCell::new(BTreeSet::new());
    }

    /// Reads the host FEN, runs the search, and returns a UCI move string.
    ///
    /// Records the current position into the game history first (for repetition
    /// avoidance). Falls back to the first host-provided legal move if the FEN
    /// cannot be parsed or the search finds nothing, so it never panics.
    fn choose_move() -> String {
        let fen = host::get_fen();

        let Some(board) = Board::from_fen(&fen) else {
            host::log("Smart Bot: could not parse FEN, falling back.");
            return fallback_move();
        };

        // Record the current position before moving, so future turns can detect
        // a return to it.
        let key = search::position_key(&board);
        HISTORY.with(|h| h.borrow_mut().insert(key));

        let chosen = HISTORY.with(|h| search::best_move(&board, &h.borrow()));

        match chosen {
            Some(mv) => mv.to_uci(),
            None => fallback_move(),
        }
    }

    /// First legal move reported by the host, or the empty string if none.
    fn fallback_move() -> String {
        host::get_legal_moves().first().cloned().unwrap_or_default()
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
            HISTORY.with(|h| h.borrow_mut().clear());
            host::log("Smart Bot: Ready to play!");
        }

        fn select_move() -> String {
            choose_move()
        }

        fn suggest_move() -> String {
            choose_move()
        }
    }

    bindings::export!(SmartBot with_types_in bindings);
}

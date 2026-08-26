# Playground egui rewrite — design

Date: 2026-07-24

## Goal

Build an **egui/eframe** static-WASM alternative to the current Astro chess
playground, deployed alongside it at **`sammasak.github.io/playground/egui/`**
so both versions stay live for comparison.

## Why this is a clean win

The chess rules engine (`chess-engine`) and the search AI (`smart-bot`) are
already pure Rust crates with native `rlib` targets. An eframe app depends on
them **directly as path crates — no JS, no jco, no Component Model, no WIT host
shim**. The entire ~2.4k LOC of orchestration JS collapses into a single Rust
`update()` loop that calls the engine directly.

## Architecture

New crate: `playground/site-egui/` (eframe binary, target `wasm32-unknown-unknown`).

Dependencies (path):
- `chess-engine` with `default-features = false` (drops the `component` wasm glue,
  keeps `Board` + types).
- `smart-bot` with `default-features = false` (see required change below).

Reused engine API:
- `chess_engine::Board`: `new`, `from_fen`, `to_fen`, `piece_at(Square)`,
  `generate_legal_moves() -> Vec<Move>`, `make_move(Move) -> bool`,
  `is_in_check(Color)`, `game_state() -> GameState`.
- `smart_bot::search::{best_move(&Board, &BTreeSet<String>) -> Option<Move>, position_key(&Board) -> String}`.

UI (single `eframe::App`):
- 8×8 board drawn with `ui.allocate_rect` per square; Unicode piece glyphs.
- Click-to-select then click-to-move (and drag). Legal targets highlighted via
  `generate_legal_moves()` filtered by origin square.
- Side panel: new game, reset, side-to-move, game-state banner
  (check/checkmate/stalemate), move history (UCI).
- Opponent: human plays White, `smart-bot` negamax plays Black (toggle later).
  After the human move, call `best_move` synchronously (search is fast, <200k
  nodes) and apply it. `position_key` history tracked in a `BTreeSet<String>`
  for repetition avoidance, matching the current bot host behaviour.

Dropped from the Astro version (YAGNI for the alternative): uploaded-`.wasm`
bot plugins, Python/Monty bots, CodeMirror editor. The egui app is a focused
"play against the AI" board. Component-Model plugin support could return later
behind a worker if wanted.

### Required upstream change (small, safe)

`bots/smart-bot/src/lib.rs` currently gates its Component-Model glue on
`#[cfg(target_arch = "wasm32")]`, which would pull `wit-bindgen` host imports
into our plain wasm build. Change it to
`#[cfg(all(target_arch = "wasm32", feature = "component"))]` and add
`[features] default = ["component"]; component = []` to its `Cargo.toml`,
mirroring what `chess-engine` already does. Existing `cargo component build`
keeps working unchanged; our egui build opts out with `default-features = false`.

## Toolchain

NixOS: no Rust on PATH. New `site-egui/flake.nix` (or extend root) providing
`rust-bin.stable` with `wasm32-unknown-unknown`, `trunk`, `wasm-bindgen-cli`,
`binaryen` (wasm-opt). Build: `trunk build --release --public-url /playground/egui/`.
`index.html` uses the eframe canvas + loading-spinner template. Add `.nojekyll`.

## Deploy (coexist, one Pages source per repo)

GitHub Pages serves one source per repo, so the egui build must live inside the
same published tree as the Astro site. The existing `.github/workflows/deploy.yaml`
builds Astro into `site/dist/`. Add steps that also `trunk build` the egui app
and copy its `dist/` into `site/dist/egui/`, so the single Pages artifact serves:
- `sammasak.github.io/playground/` — existing Astro site (unchanged)
- `sammasak.github.io/playground/egui/` — new egui app

## Testing / verification

- Native `cargo test` still green for engine + smart-bot.
- `trunk build --release` produces `dist/` with `.wasm` + `.js` + `index.html`.
- Local `trunk serve` smoke test: board renders, a legal move applies, the bot
  replies, checkmate detected.
- Post-deploy: fetch the live `/playground/egui/` URL and confirm 200 + wasm loads.

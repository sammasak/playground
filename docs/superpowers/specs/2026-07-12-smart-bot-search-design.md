# Smart Bot: real search-based chess AI

**Date:** 2026-07-12
**Status:** Approved (core decisions confirmed with user)
**Target:** `bots/smart-bot` in the `playground` repo, deployed to https://sammasak.github.io/playground/

## Problem

The current `smart-bot` is a **one-ply greedy move scorer**. Because it only ranks the
immediately-available moves by a static heuristic, every quiet move tends to score the
same, so it shuffles a piece back and forth (e.g. `Nb1-c3-b1-c3`) and plays no real
strategy. Its persona — *"Prefers captures and center control"* — is right; the
implementation is not.

## Goal

Replace the one-ply scorer with a real, well-known chess search algorithm that actually
plays a coherent game, never oscillates, and still embodies the persona (captures +
center control). Passing bar: **10/10 code quality, tests that prove a working
implementation, and a rebuilt WASM component playable on the live site.**

## Algorithm (the "found online" part)

Standard game-tree search from the Chess Programming Wiki:

- **Negamax with alpha-beta pruning** — the canonical minimax formulation.
- **Quiescence search** at the leaves — extend capture/promotion lines only, so the
  evaluation is never taken in the middle of a trade (kills the horizon effect and makes
  "prefers captures" tactically sound).
- **MVV-LVA move ordering** (Most Valuable Victim − Least Valuable Aggressor) — captures
  searched first, which both sharpens alpha-beta pruning and expresses the capture bias.
- **Iterative deepening** with a **node-count budget** (see "Time budget" below).
- **Evaluation = Michniewski's Simplified Evaluation Function**
  (chessprogramming.org/Simplified_Evaluation_Function): material values
  `P=100, N=320, B=330, R=500, Q=900, K=20000` plus per-piece **piece-square tables**.
  The PSTs reward knights/bishops/pawns for occupying the center — this is precisely
  where "prefers center control" comes from, expressed as position rather than an ad-hoc
  `+15 for e4`.

### Why this ends the back-and-forth

Two independent mechanisms:

1. **The evaluation is positional.** Retreating a developed knight (`Nc3→Nb1`) strictly
   *lowers* its piece-square value, so a real eval never treats "advance" and "retreat"
   as equal the way the one-ply scorer did. Shuffling is simply a worse-scoring line.
2. **Repetition penalty (belt-and-suspenders).** The bot keeps a set of position keys it
   has already played into during the game (cleared in `on_game_start`, updated each
   turn). At the root, a move that lands on an already-seen position gets a small penalty
   so the bot won't repeat/draw when it has better options. The penalty is small enough
   that it never overrides a genuine tactical gain (a winning capture still wins).

## Search backend (confirmed decision)

The host interface only exposes the *current* position's legal moves, which is exactly
why the existing bot is stuck at one ply. To search deeper the bot needs its own move
generation, so it will **reuse the existing PERFT-verified `chess-engine` crate** as a
path dependency:

```toml
# bots/smart-bot/Cargo.toml
[dependencies]
chess-engine = { path = "../../chess-engine", default-features = false }
```

Flow each turn: `host::get_fen()` → `Board::from_fen()` → search → best `Move` →
`move.to_uci()` → return to host.

### Required change to `chess-engine` (feature gate)

`chess-engine/src/lib.rs` currently compiles its component-model module on *any* wasm
target:

```rust
#[cfg(target_arch = "wasm32")]
pub mod wasm;
```

The smart-bot also compiles to `wasm32`, so as written the engine's own component world
(`chess:engine`) would be pulled into the bot and collide with the bot's `chess:bot`
world. Fix: gate the module behind a Cargo **feature**, default-on so the engine's own
build is unchanged, and have the bot opt out.

```toml
# chess-engine/Cargo.toml
[features]
default = ["component"]
component = []
```

```rust
// chess-engine/src/lib.rs
#[cfg(all(target_arch = "wasm32", feature = "component"))]
pub mod wasm;
```

This is the minimal, correct change; the engine's existing `wasm-pack` build keeps the
default feature and behaves identically.

## Time budget (adaptation of the confirmed "iterative deepening + time cap")

The WASM component sandbox stubs the wall clock (the random bot avoids RNG/time for the
same reason), so a real millisecond deadline is unreliable in-browser. Instead the budget
is a **node count**: iterative deepening runs depth 1, 2, 3, … and stops when either a
max depth (`MAX_DEPTH = 5`) or a node budget (`MAX_NODES ≈ 200_000`) is reached, always
returning the best move from the last fully-searched depth. Same "as deep as the budget
allows" behavior, but **deterministic and testable** — a strict improvement for this
environment. The budget constants are tuned so a move returns well within a second on
typical positions.

## Module layout

Refactor `bots/smart-bot/src/` from one 281-line file into focused units:

| File | Responsibility |
|------|----------------|
| `lib.rs` | WIT bindings + `Guest` impl (thin glue); position-history tracking for repetition |
| `eval.rs` | Material values + piece-square tables; `evaluate(&Board) -> i32` (side-to-move POV) |
| `search.rs` | Negamax + alpha-beta + quiescence + iterative deepening + node budget |
| `ordering.rs` | MVV-LVA move ordering |
| `pst.rs` | The piece-square table constants (data only) |

Each unit is independently testable and small enough to reason about in one read.

## Testing (proves it works)

Unit + integration tests, all runnable with `cargo test` (native, no wasm needed):

1. **Eval** — start position is ~0; a side up a queen evaluates strongly in its favor;
   central knight scores higher than a rim knight ("knight on the rim is dim").
2. **Move ordering** — captures ordered before quiets; MVV-LVA orders `PxQ` before `QxP`.
3. **Search finds free material** — position with a hanging queen ⇒ bot captures it.
4. **Search finds mate-in-1** — bot plays the mate.
5. **Search avoids losing a piece** — bot does not hang material when a safe move exists.
6. **No back-and-forth** — from the opening, drive the bot several plies and assert it
   never repeats a prior position / never plays a null-progress shuffle.
7. **Repetition penalty** — given a seen position, an equal-value non-repeating move is
   preferred; but a winning capture is still chosen even if it repeats.
8. **Beats the random bot** — a scripted self-play harness: Smart Bot vs. a random mover
   over N games ⇒ Smart Bot wins (or is never worse) by a decisive margin. This is the
   headline "actually plays" proof.
9. **Determinism** — same position ⇒ same move every time.
10. **UCI round-trips** and edge cases (no legal moves ⇒ mate/stalemate handled).

Plus the existing site **Playwright E2E** (`site/tests/chess.spec.ts`) to confirm the bot
plays in the browser.

## Build & deploy pipeline (unchanged commands, run in `nix develop`)

1. `cargo test --manifest-path bots/smart-bot/Cargo.toml` — green + `clippy` clean
   (pedantic + nursery, as the crate already configures).
2. `cargo component build --manifest-path bots/smart-bot/Cargo.toml --release`
   → `bots/smart-bot/target/wasm32-wasip1/release/smart_bot.wasm`.
3. Transpile with **default (auto-instantiate) mode** — pre-built bots use static
   ES imports, *not* `--instantiation async` (that is only for runtime uploads).
   Every import must resolve to an existing local shim (files in `public/` are
   served unbundled, so bare npm specifiers would break in the browser). jco 1.16
   emits **flat** import names when an interface is mapped to a specific module,
   which is exactly what the shared `preview2-shim-*.js` files export:

   ```sh
   npx jco transpile <smart_bot.wasm> --name smart_bot_component \
     --map chess:bot/host=../bot-host.js \
     --map 'wasi:cli/*=../preview2-shim-cli.js' \
     --map 'wasi:io/*=../preview2-shim-io.js' \
     --map 'wasi:filesystem/*=../preview2-shim-filesystem.js' \
     --map 'wasi:clocks/*=../preview2-shim-cli.js' \
     -o site/public/bots/smart-bot
   ```

   The bot uses a `BTreeSet` (not `HashSet`) for position history specifically so
   the component does not import `wasi:random` — there is no random shim.
4. `cd site && npm run build` then Playwright E2E
   (`tests/smart-bot.spec.ts` plays a real browser game).
5. Commit the rebuilt artifacts (they are committed to the repo; CI only runs
   `npm run build`).

The persona strings (`get_name` = "Smart Bot", `get_description`) and the UI option are
unchanged, so no site wiring changes are needed — a drop-in replacement.

## Non-goals (YAGNI)

- No transposition table / Zobrist hashing / killer moves — not needed to clear the bar
  and would add complexity.
- No opening book or endgame tablebases.
- No change to the WIT interface, host shim, or bot-manager wiring.
- No new UI option — this upgrades the existing "Smart Bot (Rust)".

## Review / verification plan (the fan-out)

After implementation and a green local build:

- **Parallel review specialists** (orchestrated-review): correctness of search/eval,
  Rust idiom & clippy-cleanliness, test adequacy, and reuse/simplicity — one per
  dimension, aggregated.
- **Live verification**: build → transpile → `npm run build` → Playwright, and a browser
  check that "Smart Bot (Rust)" plays a sensible game on the running site.

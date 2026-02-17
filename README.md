# WASM Chess

A high-performance chess game powered by Rust and WebAssembly, featuring a plugin system for custom AI bots.

## Features

- **High-Performance Chess Engine**: Written in Rust using bitboard representation for optimal performance
- **WebAssembly**: Runs entirely in the browser with near-native speed
- **AI Bot System**: Extensible plugin architecture using WebAssembly Interface Types (WIT)
- **Python Bot Support**: Write bots in Python using the Monty runtime - no compilation needed
- **Multiple Play Modes**:
  - Human vs Human
  - Human vs Bot (auto-play or suggest mode)
  - Bot vs Bot matches with adjustable speed

## Architecture

```
playground/
├── chess-engine/     # Rust chess engine compiled to WASM
├── bots/            # WASM component bots (Rust)
│   └── random-bot/  # Example random move bot
├── wit/             # WebAssembly Interface Types definitions
└── site/            # Astro static site
    ├── src/
    │   └── components/
    │       └── ChessBoard.astro
    └── public/
        ├── wasm/    # Chess engine WASM
        ├── bots/    # Transpiled bot modules
        └── monty/   # Python runtime
```

## Chess Engine

The chess engine uses a bitboard-based representation for efficient move generation and game state management:

- **Bitboards**: 64-bit integers for each piece type/color combination
- **Precomputed Attack Tables**: Knight, king, and pawn attacks precomputed at startup
- **Sliding Piece Attacks**: Ray-based attack generation for bishops, rooks, and queens
- **Full Rule Support**: Castling, en passant, promotion, check/checkmate/stalemate detection

### Running Tests

```bash
cd chess-engine
cargo test
```

The engine includes 30 comprehensive tests covering:
- FEN parsing and round-trip
- All castling scenarios
- En passant captures
- Check, checkmate, and stalemate detection
- Insufficient material draws
- Pawn promotion
- Pin detection
- 50-move rule

## Bot Plugin System

Bots are implemented using the WebAssembly Component Model with WIT interfaces.

### WIT Interface

```wit
interface bot {
    get-name: func() -> string;
    get-description: func() -> string;
    get-preferred-color: func() -> option<color>;
    on-game-start: func();
    select-move: func() -> move;
    suggest-move: func() -> move;
}

interface host {
    get-board: func() -> board-state;
    get-legal-moves: func() -> list<move>;
    is-check: func() -> bool;
    get-game-result: func() -> game-result;
    get-fen: func() -> string;
    log: func(message: string);
}
```

### Creating a Rust Bot

```rust
wit_bindgen::generate!({
    path: "../../wit",
    world: "chess-bot",
});

use exports::chess::bot::bot::Guest;
use chess::bot::host;

struct MyBot;

impl Guest for MyBot {
    fn get_name() -> String {
        "My Bot".to_string()
    }

    fn select_move() -> String {
        let moves = host::get_legal_moves();
        // Your move selection logic here
        moves[0].clone()
    }

    // ... other methods
}

export!(MyBot);
```

Build with:
```bash
cargo component build --release
```

### Creating a Python Bot

Python bots run in the browser using the Monty runtime:

```python
# Available inputs:
#   legal_moves: list of UCI strings ["e2e4", "d2d4", ...]
#   board: dict with 'squares', 'turn', 'castling_rights', etc.
#   turn: "white" or "black"

import random

# Pick a random move
move = random.choice(legal_moves)

# Prefer captures
for m in legal_moves:
    to_file = ord(m[2]) - ord('a')
    to_rank = int(m[3]) - 1
    target_sq = to_rank * 8 + to_file
    if board['squares'][target_sq]:
        move = m
        break

move  # Return the selected move
```

## Development

### Prerequisites

- Rust (with wasm32-unknown-unknown target)
- wasm-pack
- cargo-component
- Node.js 18+
- jco (@bytecodealliance/jco)

### Building

```bash
# Build chess engine
cd chess-engine
wasm-pack build --target web --release

# Build bot
cd ../bots/random-bot
cargo component build --release

# Transpile bot to JS
npx @bytecodealliance/jco transpile \
  target/wasm32-wasip1/release/random_bot.wasm \
  -o ../../site/public/bots/random-bot \
  --map 'chess:bot/host=../../bot-host.js'

# Build site
cd ../../site
npm install
npm run build
```

### Running Locally

```bash
cd site
npm run dev
```

## Testing

### Rust Tests
```bash
cd chess-engine
cargo test
```

### Playwright E2E Tests
```bash
cd site
npx playwright test
```

## Tech Stack

- **Rust**: Chess engine and WASM bot compilation
- **WebAssembly**: High-performance browser execution
- **WIT**: WebAssembly Interface Types for bot plugins
- **Astro**: Static site generation
- **TypeScript**: Frontend logic
- **Monty**: Python runtime in WASM (from Pydantic)
- **Playwright**: End-to-end testing

## License

MIT

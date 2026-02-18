# UX/UI Anti-Pattern Fixes + Rust Strict Clippy — Implementation Plan

## Stream A: Rust Clippy Strictness (Independent — can run in parallel)

### A1. Add `[lints.clippy]` to all three Cargo.toml files
- `chess-engine/Cargo.toml`
- `bots/random-bot/Cargo.toml`
- `bots/smart-bot/Cargo.toml`
- Add: `pedantic = { level = "warn", priority = -1 }`, `nursery = { level = "warn", priority = -1 }`, `module_name_repetitions = "allow"`

### A2. Add `const` to 11 functions
- `board.rs`: `side_to_move`, `castling`, `en_passant`, `halfmove_clock`, `fullmove_number`
- `types.rs`: `PieceType::from_uci_char`, `Piece::to_fen_char`, `Piece::from_fen_char`, `Move::promotion_piece`, `CastlingRights::clear`
- `bots/smart-bot/src/lib.rs`: `piece_value`, `is_center`

### A3. Refactor `option_if_let_else` in `Board::make_move` (board.rs ~line 709)
- Replace if-let-else with `.map_or(false, |lm| { ... })`

### A4. Fix `uninlined_format_args` in test code (board.rs ~5 instances)
- Change `"{}", m` to `"{m}"`

### A5. Fix `needless_collect` in test code (~20 instances)
- Replace `.collect::<Vec<_>>()` + `.is_empty()` with `.any()` / `.next().is_none()`

---

## Stream B: UI/UX Critical Fixes

### B1. Font consistency — Layout.astro
- Add `font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;` to `body` in Layout.astro
- Add `font-family: inherit;` to global `button` rule in ChessBoard.astro

### B2. Game status contrast fix — ChessBoard.astro
- Change `#game-status` color from `#e74c3c` to white text with semi-transparent dark background pill
- Style: `color: #fff; background: rgba(0,0,0,0.6); padding: 2px 12px; border-radius: 12px; display: inline-block;`

### B3. Player dropdown labels — ChessBoard.astro
- Change `<span class="player-label">Black:</span>` to `<label for="black-player" class="player-label">Black:</label>`
- Same for white player

### B4. CSS Custom Properties (Design Tokens) — ChessBoard.astro
- Add `:root` block with color variables
- Replace all hardcoded colors with `var(--color-*)` references

### B5. Button hierarchy — ChessBoard.astro
- Primary (filled blue): "Start Bot Match", "Play it", "Apply to Bot"
- Secondary (outlined): "Undo", "Load White/Black", "Test Code"
- Destructive (red-tinted): "New Game"
- Ghost: "Pause", "Source" links

### B6. Add SVG icons to key buttons
- New Game: refresh icon
- Undo: undo-arrow icon
- Start Bot Match: play triangle
- Pause/Resume: pause bars / play triangle
- Test Code: play icon
- Apply to Bot: upload arrow
- Upload dropzone: cloud-upload icon

### B7. Bot Log container fix — ChessBoard.astro
- Give `#bot-log` and `#game-controls` a white card background matching `#move-history`

### B8. Move History max-height — ChessBoard.astro
- Increase `#moves-list` `max-height` from `70px` to `150px`
- Add empty state text: "No moves yet"

### B9. New Game confirmation — ChessBoard.astro JS
- Add `confirm()` dialog before `resetGame()` when `moveHistory.length > 0`

### B10. White player bar border visibility
- Change `.player-bar-white` `border-left` from `#f0d9b5` to `#c4a47a`

### B11. Consistent contextual containers
- Change `#suggested-move` from yellow (`#fff3cd`/`#ffc107`) to light blue (`#e8f4fd`/`#3498db`)
- Unify `#bot-vs-bot-controls` to match

### B12. Loading states for WASM init and bot loading
- Show "Loading engine..." skeleton during `initGame()`
- Show "Loading bot..." spinner during `loadBot()`

### B13. Keyboard accessibility for squares
- Add `role="button"`, `tabindex="0"`, `aria-label` to each square
- Add keydown handler for Enter/Space

### B14. Focus visible outlines
- Add `:focus-visible` styles for buttons, selects, inputs

### B15. Radio buttons styled as pill toggles
- Replace bare radio inputs with segmented control style

### B16. Rename `#python-error` to `#python-feedback`
- Update all CSS and JS references

### B17. Upload dropzone icon
- Add cloud-upload SVG icon above existing text

### B18. Promotion modal accessibility
- Add `role="button"`, `tabindex="0"`, `aria-label="Promote to Queen"` etc.

### B19. Spacing system
- Define `--space-1` through `--space-6` custom properties
- Normalize spacing values to use the scale

### B20. WIT Reference summary fix
- Remove inline `style="display: inline;"` on `<h4>`, style `summary` directly

### B21. Empty state for Bot Log
- Add placeholder: "Load a bot to see activity here"

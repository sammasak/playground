//! Chess playground UI in egui — feature parity with the original Astro app.
//!
//! Reuses the native `chess-engine` (`Board`, rules) and `smart-bot` negamax
//! search directly as Rust crates. Features that need a JS runtime — the Monty
//! Python bot editor, uploaded Component-Model `.wasm` bots (jco transpile), and
//! the on-device BitNet "bot banter" LLM — are driven through `glue.js` via
//! wasm-bindgen (`crate::glue`).
//!
//! Two side-panel tabs (Bot Interface / Python Editor), per-side player
//! dropdowns (Human / Random Bot (Rust) / Smart Bot (Rust) / Smart Bot (Python)
//! / Python Editor Bot / Upload Bot), auto vs suggest bot mode, bot-vs-bot
//! matches, click + drag + keyboard board movement, promotion picker, help
//! modal, new-game confirmation, unicode pieces, move history, bot log with
//! timestamps, example bot cards, uploaded-bot cards, and a personality chat.

use std::cell::RefCell;
use std::collections::BTreeSet;
use std::rc::Rc;

use chess_engine::{Board, Color, GameState, Move, MoveKind, Piece, PieceType, Square};
use eframe::egui;
use wasm_bindgen::prelude::*;

use crate::glue;

/// Default Python editor bot (mirrors `pythonExample` in string-constants.js).
const PYTHON_EXAMPLE: &str = r#"# Smart Bot — captures, center control, development.
# Host functions: get_board(), get_legal_moves(),
#   is_check(), get_fen(), log(msg)

# Material values for MVV-LVA ordering
PIECE_VALUES = {"queen": 9, "rook": 5, "bishop": 3, "knight": 3, "pawn": 1, "king": 0}

# Board index: rank * 8 + file, where a1=0, h8=63
CENTER = {27, 28, 35, 36}  # d4, e4, d5, e5
EXTENDED_CENTER = {r * 8 + f for r in range(2, 6) for f in range(2, 6)}

def parse_uci(uci):
    if len(uci) < 4:
        return None
    from_file = ord(uci[0]) - ord('a')
    from_rank = int(uci[1]) - 1
    to_file = ord(uci[2]) - ord('a')
    to_rank = int(uci[3]) - 1
    if not (0 <= from_file < 8 and 0 <= from_rank < 8
            and 0 <= to_file < 8 and 0 <= to_rank < 8):
        return None
    return (from_rank * 8 + from_file, to_rank * 8 + to_file)

def score_move(uci, board):
    parsed = parse_uci(uci)
    if parsed is None:
        return 0
    from_idx, to_idx = parsed
    score = 0

    target = board['squares'][to_idx]
    if target is not None:
        score += 100 + PIECE_VALUES.get(target['pieceType'], 0) * 10

    if len(uci) > 4:
        promo = uci[4]
        if promo == 'q':
            score += 90
        elif promo == 'r':
            score += 50
        elif promo in ('b', 'n'):
            score += 30

    if to_idx in CENTER:
        score += 15
    elif to_idx in EXTENDED_CENTER:
        score += 5

    if board['fullmove_number'] < 10:
        from_piece = board['squares'][from_idx]
        if from_piece is not None and from_piece['pieceType'] != 'pawn':
            score += 8

    return score

def get_name():
    return "Smart Bot (Python)"

def get_description():
    return "Prefers captures and center control."

def on_game_start():
    log("Smart Bot: Ready to play!")

def select_move():
    moves = get_legal_moves()
    if not moves:
        return ""

    board = get_board()
    scored = [(score_move(m, board), m) for m in moves]
    best_score = max(s for s, _ in scored)
    tied = [m for s, m in scored if s == best_score]

    idx = (board['fullmove_number'] + board['halfmove_clock']) % len(tied)
    selected = tied[idx]

    log("Smart Bot: " + selected + " (score " + str(best_score) + ")")
    return selected

def suggest_move():
    return select_move()"#;

/// Upload limits (mirrors upload-handler.js).
const MAX_FILE_SIZE: usize = 10 * 1024 * 1024;
const MAX_UPLOADED_BOTS: usize = 10;

const PERSONALITY_STORAGE_KEY: &str = "playground:personality";
const PERSONALITIES: &[(&str, &str)] = &[
    ("sassy", "Sassy"),
    ("aggressive", "Aggressive"),
    ("kind", "Kind"),
    ("nervous", "Nervous"),
    ("philosophical", "Philosophical"),
];

#[derive(Clone, PartialEq)]
enum Player {
    Human,
    RandomBot,
    SmartBot,
    /// Smart Bot (Python) — the built-in example run via Monty.
    SmartPython,
    /// Python Editor Bot — the user's editor code run via Monty.
    PythonEditor,
    /// An uploaded Component-Model bot, by glue id + display name.
    Uploaded(String, String),
}

impl Player {
    fn label(&self) -> String {
        match self {
            Player::Human => "Human".into(),
            Player::RandomBot => "Random Bot (Rust)".into(),
            Player::SmartBot => "Smart Bot (Rust)".into(),
            Player::SmartPython => "Smart Bot (Python)".into(),
            Player::PythonEditor => "Python Editor Bot".into(),
            Player::Uploaded(_, name) => format!("{name} (uploaded)"),
        }
    }
    fn is_bot(&self) -> bool {
        !matches!(self, Player::Human)
    }
    /// Bots run through the JS Monty/Component-Model runtime (async).
    fn is_js_bot(&self) -> bool {
        matches!(
            self,
            Player::SmartPython | Player::PythonEditor | Player::Uploaded(_, _)
        )
    }
}

#[derive(Clone, Copy, PartialEq)]
enum Mode {
    Auto,
    Suggest,
}

#[derive(Clone, Copy, PartialEq)]
enum Tab {
    Bot,
    Editor,
}

/// A chat message in the personality banter panel.
enum ChatEntry {
    /// A chat line. `persona` is the display label ("You" for the user, else the
    /// persona name for bot replies).
    Msg { persona: String, text: String },
    /// A neutral status line (warming-up / switched / mumble), not in character.
    Status(String),
    /// An ephemeral "<persona> is typing…" indicator, keyed by id.
    Typing { id: u64, persona: String },
}

/// An uploaded bot card.
struct UploadedBot {
    id: String,
    name: String,
    description: String,
}

/// Result of an async JS bot call, delivered back to the app on a later frame.
enum BotEvent {
    /// A move chosen by a JS bot for `side`, plus log lines.
    JsMove {
        side: Color,
        uci: String,
        logs: Vec<String>,
        error: Option<String>,
        suggest: bool,
    },
    /// An LLM reply for a specific typing indicator id. `capture` marks a
    /// capture-banter turn (no user line was shown, empty replies stay silent).
    LlmReply {
        id: u64,
        persona: String,
        text: String,
        capture: bool,
    },
    /// An uploaded bot finished transpiling.
    Uploaded {
        ok: bool,
        id: String,
        name: String,
        description: String,
        error: String,
    },
    /// A "Test Code" result from the editor.
    TestResult {
        ok: bool,
        value: String,
        error: String,
        legal: bool,
        /// First few legal UCI moves, shown when the returned move is illegal.
        examples: String,
    },
}

pub struct ChessApp {
    board: Board,
    turn: Color,
    moves: Vec<Move>,
    selected: Option<Square>,
    legal: Vec<Move>,
    seen: BTreeSet<String>,
    last_move: Option<(Square, Square)>,
    result: Option<GameState>,
    players: [Player; 2],
    modes: [Mode; 2],
    flipped: bool,
    logs: Vec<String>,
    suggested: Option<Move>,
    promote: Option<(Square, Square)>,
    match_running: bool,
    match_paused: bool,
    /// True once the running match has fired at least one move; the original
    /// `startBotMatch` plays the first move immediately and only delays the
    /// subsequent ones by `match-speed`.
    match_moved: bool,
    speed_ms: u32,
    next_move_at: Option<f64>,
    tab: Tab,
    /// Per-color Python source (editor bot may differ per side).
    python_code: [String; 2],
    /// The editor's current source.
    editor_code: String,
    editor_feedback: Option<(bool, String)>,
    /// True while an async JS bot call is in flight (avoids double-dispatch).
    js_bot_pending: bool,
    uploaded: Vec<UploadedBot>,
    /// Personality key for the banter chat.
    personality: String,
    chat: Vec<ChatEntry>,
    chat_input: String,
    /// Monotonic id source for per-message typing indicators.
    typing_seq: u64,
    /// Whether the editor is in fullscreen mode.
    editor_fullscreen: bool,
    /// Confirmation state for removing an uploaded bot: (id, name).
    confirm_remove: Option<(String, String)>,
    show_help: bool,
    confirm_new_game: bool,
    /// Keyboard focus square for accessible board nav.
    focus_sq: Square,
    /// Channel for async JS events back into the egui frame loop.
    events: Rc<RefCell<Vec<BotEvent>>>,
    egui_ctx: egui::Context,
}

impl ChessApp {
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        let board = Board::new();
        let legal = board.generate_legal_moves();
        let personality = load_personality();
        // Pre-warm the on-device LLM and seed the persona conversation.
        glue::llm_preload();
        glue::llm_reset(&personality);
        Self {
            board,
            turn: Color::White,
            moves: Vec::new(),
            selected: None,
            legal,
            seen: BTreeSet::new(),
            last_move: None,
            result: None,
            players: [Player::Human, Player::Human],
            modes: [Mode::Suggest, Mode::Suggest],
            flipped: false,
            logs: Vec::new(),
            suggested: None,
            promote: None,
            match_running: false,
            match_paused: false,
            match_moved: false,
            speed_ms: 500,
            next_move_at: None,
            tab: Tab::Bot,
            python_code: [PYTHON_EXAMPLE.to_owned(), PYTHON_EXAMPLE.to_owned()],
            editor_code: PYTHON_EXAMPLE.to_owned(),
            editor_feedback: None,
            js_bot_pending: false,
            uploaded: Vec::new(),
            personality,
            chat: Vec::new(),
            chat_input: String::new(),
            typing_seq: 0,
            editor_fullscreen: false,
            confirm_remove: None,
            show_help: false,
            confirm_new_game: false,
            focus_sq: Square::new(4, 1),
            events: Rc::new(RefCell::new(Vec::new())),
            egui_ctx: cc.egui_ctx.clone(),
        }
    }

    fn player(&self, c: Color) -> Player {
        self.players[c.index()].clone()
    }
    fn mode(&self, c: Color) -> Mode {
        self.modes[c.index()]
    }
    fn both_bots(&self) -> bool {
        self.player(Color::White).is_bot() && self.player(Color::Black).is_bot()
    }

    /// Whether the human may manually move for the side to move. Mirrors the
    /// original board-ui `handleSquareClick` / `handleDragStart`, which only
    /// block input when `bot && mode === 'auto'`. In Suggest mode the human can
    /// still click / drag to override the bot's suggestion and move themselves.
    fn manual_input_allowed(&self) -> bool {
        let side = self.turn;
        let player = self.player(side);
        !(player.is_bot() && matches!(self.mode(side), Mode::Auto))
    }

    fn log(&mut self, msg: impl Into<String>) {
        self.logs.push(format!("[{}] {}", now_hms(), msg.into()));
        if self.logs.len() > 200 {
            self.logs.remove(0);
        }
    }

    fn new_game(&mut self) {
        let board = Board::new();
        self.legal = board.generate_legal_moves();
        self.board = board;
        self.turn = Color::White;
        self.moves.clear();
        self.selected = None;
        self.seen.clear();
        self.last_move = None;
        self.result = None;
        self.suggested = None;
        self.promote = None;
        self.next_move_at = None;
        self.match_running = false;
        self.match_paused = false;
        self.match_moved = false;
        self.js_bot_pending = false;
        // Match the original resetGame: clear the bot log back to its empty state
        // and dismiss any lingering editor feedback.
        self.logs.clear();
        self.editor_feedback = None;
        self.chat.clear();
        glue::llm_reset(&self.personality);
        // The original only toasts "New game started" from inside the confirm
        // callback (i.e. when a game was in progress), and never logs it — so
        // the toast is fired by the confirm handler, not here.
    }

    fn rebuild(&mut self) {
        let mut board = Board::new();
        let mut turn = Color::White;
        let mut last = None;
        for &mv in &self.moves {
            board.make_move(mv);
            last = Some((mv.from(), mv.to()));
            turn = turn.opposite();
        }
        self.legal = board.generate_legal_moves();
        self.board = board;
        self.turn = turn;
        self.last_move = last;
        self.selected = None;
        self.suggested = None;
        self.promote = None;
        self.next_move_at = None;
        self.js_bot_pending = false;
        let state = self.board.game_state();
        self.result = (state != GameState::InProgress).then_some(state);
    }

    fn undo(&mut self) {
        if self.moves.pop().is_some() {
            self.end_match();
            self.rebuild();
            self.log("Move undone");
        }
        // The original's Undo button is disabled at empty history, so a fired
        // click always corresponds to a real undo; toast to match.
        glue::toast("Move undone", "info");
    }

    /// Applies a move, updating derived state; also fires capture banter.
    fn apply(&mut self, mv: Move) {
        let captured = self.board.piece_at(mv.to());
        let mover_piece = self.board.piece_at(mv.from());
        let mover_is_bot = self.player(self.turn).is_bot();
        let mover = self.turn;
        if !self.board.make_move(mv) {
            return;
        }
        self.moves.push(mv);
        self.last_move = Some((mv.from(), mv.to()));
        self.selected = None;
        self.suggested = None;
        self.promote = None;
        self.turn = self.turn.opposite();
        self.legal = self.board.generate_legal_moves();
        self.next_move_at = None;

        // Screen-reader move announcement (mirrors #move-announcer aria-live).
        let desc = describe_move(mv, mover, mover_piece, captured, &self.board, self.turn);
        glue::announce_move(&desc);

        // Capture banter: the LLM reacts to a just-happened capture.
        if let Some(victim) = captured {
            self.fire_capture_banter(victim.piece_type(), mover_is_bot, mover);
        }

        let state = self.board.game_state();
        if state != GameState::InProgress {
            self.result = Some(state);
        }
    }

    // --- native (Rust) bots --------------------------------------------------

    fn rust_bot_choice(&mut self, player: &Player) -> Option<Move> {
        match player {
            Player::SmartBot => {
                self.seen.insert(smart_bot::search::position_key(&self.board));
                smart_bot::search::best_move(&self.board, &self.seen)
            }
            Player::RandomBot => {
                if self.legal.is_empty() {
                    return None;
                }
                let idx = (js_sys::Math::random() * self.legal.len() as f64) as usize;
                Some(self.legal[idx.min(self.legal.len() - 1)])
            }
            _ => None,
        }
    }

    // --- JS (Monty / uploaded) bots -----------------------------------------

    /// Builds the JSON inputs snapshot for a JS bot call.
    fn snapshot_json(&self) -> String {
        let legal: Vec<String> = self.legal.iter().map(Move::to_uci).collect();
        let result = match self.board.game_state() {
            GameState::InProgress => "in-progress",
            GameState::Checkmate => "checkmate",
            GameState::Stalemate => "stalemate",
            GameState::Draw => "draw",
        };
        serde_json::json!({
            "fen": self.board.to_fen(),
            "legalMoves": legal,
            "isCheck": self.board.is_in_check(self.turn),
            "gameResult": result,
        })
        .to_string()
    }

    /// Dispatches an async JS bot move for `side`; the result arrives via events.
    fn dispatch_js_bot(&mut self, side: Color, suggest: bool) {
        if self.js_bot_pending {
            return;
        }
        let player = self.player(side);
        let snapshot = self.snapshot_json();
        let events = self.events.clone();
        let ctx = self.egui_ctx.clone();
        self.js_bot_pending = true;
        let method = if suggest { "suggest_move" } else { "select_move" };

        match player {
            Player::SmartPython | Player::PythonEditor => {
                let code = if matches!(player, Player::SmartPython) {
                    PYTHON_EXAMPLE.to_owned()
                } else {
                    self.python_code[side.index()].clone()
                };
                let promise = glue::python_run(&code, method, &snapshot);
                spawn_bot_result(promise, side, suggest, events, ctx);
            }
            Player::Uploaded(id, _) => {
                // Synchronous JS call (component instance is resident).
                let raw = glue::upload_call(&id, method, &snapshot);
                let (uci, logs, error) = parse_bot_result(&raw);
                self.events.borrow_mut().push(BotEvent::JsMove {
                    side,
                    uci,
                    logs,
                    error,
                    suggest,
                });
                self.egui_ctx.request_repaint();
            }
            _ => {
                self.js_bot_pending = false;
            }
        }
    }

    /// Fires a bot's `on_game_start` lifecycle hook (JS bots only), routing any
    /// log lines it emits into the bot log. Rust bots have no such hook.
    fn fire_on_game_start(&mut self, side: Color) {
        let player = self.player(side);
        if !player.is_js_bot() {
            return;
        }
        let snapshot = self.snapshot_json();
        let events = self.events.clone();
        let ctx = self.egui_ctx.clone();
        match player {
            Player::SmartPython | Player::PythonEditor => {
                let code = if matches!(player, Player::SmartPython) {
                    PYTHON_EXAMPLE.to_owned()
                } else {
                    self.python_code[side.index()].clone()
                };
                let promise = glue::python_run(&code, "on_game_start", &snapshot);
                wasm_bindgen_futures::spawn_local(async move {
                    if let Ok(v) = wasm_bindgen_futures::JsFuture::from(promise).await {
                        let raw = v.as_string().unwrap_or_default();
                        let (_uci, logs, _err) = parse_bot_result(&raw);
                        // Reuse JsMove purely to funnel the log lines back.
                        events.borrow_mut().push(BotEvent::JsMove {
                            side,
                            uci: String::new(),
                            logs,
                            error: None,
                            suggest: true,
                        });
                        ctx.request_repaint();
                    }
                });
            }
            Player::Uploaded(id, _) => {
                let raw = glue::upload_call(&id, "on_game_start", &snapshot);
                let (_uci, logs, _err) = parse_bot_result(&raw);
                let label = side_name(side);
                for l in logs {
                    self.log(format!("[{label}] {l}"));
                }
            }
            _ => {}
        }
    }

    fn targets_from(&self, from: Square) -> Vec<Move> {
        self.legal.iter().copied().filter(|m| m.from() == from).collect()
    }

    /// Attempts a from->to move for the human (handles promotion picker).
    fn try_human_move(&mut self, from: Square, to: Square) -> bool {
        let cands: Vec<Move> = self
            .legal
            .iter()
            .copied()
            .filter(|m| m.from() == from && m.to() == to)
            .collect();
        if cands.is_empty() {
            return false;
        }
        if cands.iter().any(|m| matches!(m.kind(), MoveKind::Promotion(_))) {
            self.promote = Some((from, to));
            return true;
        }
        self.apply(cands[0]);
        true
    }

    fn on_square_click(&mut self, sq: Square) {
        if self.result.is_some() || self.promote.is_some() {
            return;
        }
        // In Suggest mode a human can still move for a bot-controlled side; only
        // auto-play bots block manual input (mirrors board-ui handleSquareClick).
        if !self.manual_input_allowed() {
            return;
        }
        if let Some(from) = self.selected {
            if self.try_human_move(from, sq) {
                return;
            }
        }
        match self.board.piece_at(sq) {
            Some(p) if p.color() == self.turn && !self.targets_from(sq).is_empty() => {
                self.selected = Some(sq);
            }
            _ => self.selected = None,
        }
    }

    fn finish_promotion(&mut self, piece: PieceType) {
        if let Some((from, to)) = self.promote.take() {
            if let Some(mv) = self
                .legal
                .iter()
                .copied()
                .find(|m| m.from() == from && m.to() == to && m.promotion_piece() == Some(piece))
            {
                self.apply(mv);
            }
        }
    }

    // --- personality banter --------------------------------------------------

    /// Current persona display label (e.g. "Sassy").
    fn persona_label(&self) -> String {
        PERSONALITIES
            .iter()
            .find(|(k, _)| *k == self.personality)
            .map(|(_, l)| (*l).to_owned())
            .unwrap_or_else(|| "Sassy".to_owned())
    }

    fn fire_capture_banter(&mut self, victim: PieceType, by_bot: bool, _mover: Color) {
        // Mirrors announceCapture: if the model isn't ready, surface the neutral
        // warming-up status rather than faking an in-character line.
        if !glue::llm_ready() {
            return;
        }
        let piece = piece_name(victim);
        let text = if by_bot {
            format!("I just captured your {piece}!")
        } else {
            format!("You just captured my {piece}!")
        };
        self.send_chat_turn(text, false, true);
    }

    /// Appends a neutral status line to the chat transcript (not in character).
    fn add_chat_status(&mut self, text: impl Into<String>) {
        self.chat.push(ChatEntry::Status(text.into()));
    }

    /// Sends a turn to the LLM. `show_user` echoes the user's line; `capture`
    /// marks a capture-banter turn (empty replies stay silent).
    fn send_chat_turn(&mut self, text: String, show_user: bool, capture: bool) {
        let persona = self.persona_label();
        if show_user {
            self.chat.push(ChatEntry::Msg {
                persona: "You".into(),
                text: text.clone(),
            });
            // Not-ready path: echo a neutral warming-up status, don't dispatch.
            if !glue::llm_ready() {
                self.add_chat_status("🧠 Bot is warming up — ask again once it's ready.");
                return;
            }
        }
        self.typing_seq += 1;
        let id = self.typing_seq;
        self.chat.push(ChatEntry::Typing { id, persona: persona.clone() });
        let promise = glue::llm_send(&self.personality, &text);
        let events = self.events.clone();
        let ctx = self.egui_ctx.clone();
        spawn_llm_reply(promise, id, persona, capture, events, ctx);
    }

    // --- bot driving ---------------------------------------------------------

    /// Stops a running bot-vs-bot match, logging the terminal 'Bot match ended'
    /// line the original `stopBotMatch` always emits (game over / no move /
    /// invalid move). No-op if no match was running.
    fn end_match(&mut self) {
        if self.match_running {
            self.match_running = false;
            self.match_paused = false;
            self.match_moved = false;
            self.next_move_at = None;
            self.log("Bot match ended");
        }
    }

    fn drive_bots(&mut self, ctx: &egui::Context) {
        // A running match that reached game-over must log its terminal line.
        if self.result.is_some() {
            self.end_match();
            return;
        }
        if self.promote.is_some() || self.js_bot_pending {
            return;
        }
        let side = self.turn;
        let player = self.player(side);
        if !player.is_bot() {
            return;
        }
        let gated = self.both_bots() && (!self.match_running || self.match_paused);
        if gated {
            return;
        }

        let suggest = matches!(self.mode(side), Mode::Suggest) && !self.both_bots();

        if suggest {
            if self.suggested.is_none() {
                if player.is_js_bot() {
                    self.dispatch_js_bot(side, true);
                } else {
                    self.suggested = self.rust_bot_choice(&player);
                }
            }
            return;
        }

        // Auto-play (and both-bots matches): schedule then fire.
        let in_match = self.both_bots();
        // The original bot match plays its FIRST move immediately and delays only
        // subsequent moves by `match-speed`. Single-bot auto uses a fixed 300ms.
        let instant_first = in_match && !self.match_moved;
        let now = ctx.input(|i| i.time);
        let delay = if in_match { f64::from(self.speed_ms) / 1000.0 } else { 0.3 };

        let fire = if instant_first {
            true
        } else {
            match self.next_move_at {
                None => {
                    self.next_move_at = Some(now + delay);
                    ctx.request_repaint_after(std::time::Duration::from_millis(u64::from(
                        self.speed_ms.max(50),
                    )));
                    false
                }
                Some(at) if now >= at => true,
                Some(_) => {
                    ctx.request_repaint_after(std::time::Duration::from_millis(30));
                    false
                }
            }
        };

        if fire {
            if player.is_js_bot() {
                self.match_moved = true;
                self.dispatch_js_bot(side, false);
            } else if let Some(mv) = self.rust_bot_choice(&player) {
                self.match_moved = true;
                self.log(format!("{} {}: {}", side_name(side), player.label(), mv.to_uci()));
                self.apply(mv);
            } else if in_match {
                // Match bot returned no move: log and end the match (mirrors
                // playNextBotMove's 'No move from {side}' + stopBotMatch).
                self.log(format!("No move from {}", side_name(side).to_lowercase()));
                self.result = Some(self.board.game_state());
                self.end_match();
            } else {
                self.result = Some(self.board.game_state());
            }
        }
    }

    /// Drains async JS events into game state each frame.
    fn drain_events(&mut self) {
        let events: Vec<BotEvent> = self.events.borrow_mut().drain(..).collect();
        for ev in events {
            match ev {
                BotEvent::JsMove { side, uci, logs, error, suggest } => {
                    self.js_bot_pending = false;
                    let label = side_name(side);
                    for l in logs {
                        self.log(format!("[{label}] {l}"));
                    }
                    if let Some(e) = error {
                        self.log(format!("Error: {e}"));
                        continue;
                    }
                    // Ignore stale results (side already moved / game reset).
                    if side != self.turn || self.result.is_some() {
                        continue;
                    }
                    if let Some(mv) = self.legal.iter().copied().find(|m| m.to_uci() == uci) {
                        if suggest {
                            self.suggested = Some(mv);
                        } else {
                            self.match_moved = self.match_moved || self.match_running;
                            self.log(format!("{label}: {uci}"));
                            self.apply(mv);
                        }
                    } else if !uci.is_empty() {
                        self.log(format!("Invalid move from {label}: {uci}"));
                        // An invalid move during a match ends it (mirrors the
                        // original catch(moveErr) -> stopBotMatch path).
                        self.end_match();
                    } else if !suggest && self.match_running {
                        // A match bot that returned an empty move stops the match.
                        self.log(format!("No move from {}", side_name(side).to_lowercase()));
                        self.end_match();
                    }
                }
                BotEvent::LlmReply { id, persona, text, capture } => {
                    // Remove this request's typing indicator (if still present).
                    self.chat.retain(|e| !matches!(e, ChatEntry::Typing { id: tid, .. } if *tid == id));
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        self.chat.push(ChatEntry::Msg {
                            persona,
                            text: trimmed.to_owned(),
                        });
                    } else if !capture {
                        // Empty user-turn reply: neutral "mumbled" status.
                        self.add_chat_status("🤔 (the bot mumbled something unintelligible)");
                    }
                    // Capture-banter empty replies stay silent (no status line).
                }
                BotEvent::Uploaded { ok, id, name, description, error } => {
                    if ok {
                        self.uploaded.push(UploadedBot { id, name: name.clone(), description });
                        self.log(format!("Uploaded bot: {name}"));
                        glue::toast(&format!("{name} uploaded successfully!"), "success");
                    } else {
                        self.log(format!("Upload error: {error}"));
                        glue::toast(&error, "error");
                    }
                }
                BotEvent::TestResult { ok, value, error, legal, examples } => {
                    if !ok {
                        self.editor_feedback = Some((false, format!("Error: {error}")));
                        glue::toast(&error, "error");
                    } else if legal {
                        self.editor_feedback = Some((true, format!("Bot selected: {value}")));
                        glue::toast(&format!("Bot test passed: {value}"), "success");
                    } else {
                        self.editor_feedback = Some((
                            false,
                            format!("Warning: \"{value}\" is not a legal move. Legal moves: {examples}..."),
                        ));
                        glue::toast(&format!("Bot returned invalid move: {value}"), "warning");
                    }
                }
            }
        }
    }

    // --- editor actions ------------------------------------------------------

    fn editor_test(&mut self) {
        let code = self.editor_code.clone();
        let snapshot = self.snapshot_json();
        let legal_list: Vec<String> = self.legal.iter().map(Move::to_uci).collect();
        let legal: BTreeSet<String> = legal_list.iter().cloned().collect();
        // First 5 legal moves, shown when an illegal move is returned.
        let examples = legal_list.iter().take(5).cloned().collect::<Vec<_>>().join(", ");
        let promise = glue::python_run(&code, "select_move", &snapshot);
        let events = self.events.clone();
        let ctx = self.egui_ctx.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let ev = match wasm_bindgen_futures::JsFuture::from(promise).await {
                Ok(v) => {
                    let raw = v.as_string().unwrap_or_default();
                    let (uci, _logs, err) = parse_bot_result(&raw);
                    if let Some(e) = err {
                        BotEvent::TestResult { ok: false, value: String::new(), error: e, legal: false, examples }
                    } else {
                        let is_legal = legal.contains(&uci);
                        BotEvent::TestResult { ok: true, value: uci, error: String::new(), legal: is_legal, examples }
                    }
                }
                Err(e) => BotEvent::TestResult {
                    ok: false,
                    value: String::new(),
                    error: js_err(&e),
                    legal: false,
                    examples,
                },
            };
            events.borrow_mut().push(ev);
            ctx.request_repaint();
        });
    }

    fn editor_apply(&mut self) {
        let mut applied = false;
        for c in [Color::White, Color::Black] {
            if matches!(self.players[c.index()], Player::PythonEditor) {
                self.python_code[c.index()] = self.editor_code.clone();
                applied = true;
            }
        }
        if applied {
            self.log("Python bot code applied");
            glue::toast("Python bot code applied successfully!", "success");
        } else {
            self.log("No Python bot active — select \"Python Editor Bot\" from a player dropdown first");
            glue::toast("Select \"Python Editor Bot\" from a player dropdown first", "info");
        }
    }

    // --- upload --------------------------------------------------------------

    fn begin_upload(&mut self) {
        // Enforce the 10-uploaded-bot cap up front (mirrors upload-handler.js).
        if self.uploaded.len() >= MAX_UPLOADED_BOTS {
            let msg = format!(
                "Maximum {MAX_UPLOADED_BOTS} uploaded bots allowed. Remove a bot before uploading more."
            );
            self.log(format!("Upload error: {msg}"));
            glue::toast(&msg, "error");
            return;
        }
        let promise = glue::pick_wasm_file();
        let events = self.events.clone();
        let ctx = self.egui_ctx.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let picked = wasm_bindgen_futures::JsFuture::from(promise).await;
            let Ok(val) = picked else { return };
            if val.is_null() || val.is_undefined() {
                return;
            }
            let name = js_sys::Reflect::get(&val, &JsValue::from_str("name"))
                .ok()
                .and_then(|v| v.as_string())
                .unwrap_or_else(|| "bot.wasm".into());
            let bytes_val = js_sys::Reflect::get(&val, &JsValue::from_str("bytes")).unwrap();
            let bytes = js_sys::Uint8Array::new(&bytes_val).to_vec();
            // Empty / size validation (mirrors upload-handler.js).
            let err = if bytes.is_empty() {
                Some("File is empty. Please select a valid WASM file.".to_owned())
            } else if bytes.len() > MAX_FILE_SIZE {
                Some("File too large. Maximum size is 10MB.".to_owned())
            } else {
                None
            };
            if let Some(error) = err {
                events.borrow_mut().push(BotEvent::Uploaded {
                    ok: false,
                    id: String::new(),
                    name: String::new(),
                    description: String::new(),
                    error,
                });
                ctx.request_repaint();
                return;
            }
            let up = glue::upload_bot(&bytes, &name);
            let ev = match wasm_bindgen_futures::JsFuture::from(up).await {
                Ok(v) => {
                    let raw = v.as_string().unwrap_or_default();
                    parse_upload_result(&raw)
                }
                Err(e) => BotEvent::Uploaded {
                    ok: false,
                    id: String::new(),
                    name: String::new(),
                    description: String::new(),
                    error: js_err(&e),
                },
            };
            events.borrow_mut().push(ev);
            ctx.request_repaint();
        });
    }
}

impl eframe::App for ChessApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.drain_events();
        self.handle_keyboard(ctx);
        egui::SidePanel::right("side")
            .resizable(false)
            .min_width(300.0)
            .show(ctx, |ui| {
                egui::ScrollArea::vertical().show(ui, |ui| self.side_panel(ui));
            });
        egui::CentralPanel::default().show(ctx, |ui| self.board_ui(ui));
        // Mirror the current game status into the polite aria-live region.
        glue::announce_status(&self.status_line());
        self.promotion_modal(ctx);
        self.help_modal(ctx);
        self.confirm_modal(ctx);
        self.confirm_remove_modal(ctx);
        self.drive_bots(ctx);
        // Poll for LLM readiness / warming-up status changes, and animate any
        // in-flight typing indicators.
        let typing = self.chat.iter().any(|e| matches!(e, ChatEntry::Typing { .. }));
        if typing || !glue::llm_ready() {
            ctx.request_repaint_after(std::time::Duration::from_millis(400));
        }
    }
}

impl ChessApp {
    // --- keyboard board navigation & shortcuts ------------------------------

    fn handle_keyboard(&mut self, ctx: &egui::Context) {
        // Skip when a modal is open or a text field owns the keyboard.
        if self.promote.is_some()
            || self.show_help
            || self.confirm_new_game
            || self.confirm_remove.is_some()
        {
            return;
        }
        if ctx.wants_keyboard_input() {
            return;
        }
        ctx.input(|i| {
            let mut file = self.focus_sq.file() as i32;
            let mut rank = self.focus_sq.rank() as i32;
            // In flipped view, arrow directions invert.
            let dir = if self.flipped { -1 } else { 1 };
            let mut moved = false;
            for ev in &i.events {
                if let egui::Event::Key { key, pressed: true, .. } = ev {
                    match key {
                        egui::Key::ArrowLeft => { file -= dir; moved = true; }
                        egui::Key::ArrowRight => { file += dir; moved = true; }
                        egui::Key::ArrowUp => { rank += dir; moved = true; }
                        egui::Key::ArrowDown => { rank -= dir; moved = true; }
                        egui::Key::Escape => { self.selected = None; }
                        egui::Key::Enter | egui::Key::Space => {
                            let sq = self.focus_sq;
                            self.on_square_click(sq);
                        }
                        _ => {}
                    }
                }
            }
            if moved {
                self.focus_sq = Square::new(file.clamp(0, 7) as u8, rank.clamp(0, 7) as u8);
            }
        });
    }

    fn side_panel(&mut self, ui: &mut egui::Ui) {
        ui.add_space(6.0);
        ui.horizontal(|ui| {
            ui.heading("Chess · egui");
            if ui.button("⌨ Help").on_hover_text("Keyboard shortcuts").clicked() {
                self.show_help = true;
            }
        });
        ui.separator();

        // Tab bar.
        ui.horizontal(|ui| {
            if ui.selectable_label(self.tab == Tab::Bot, "Bot Interface").clicked() {
                self.tab = Tab::Bot;
            }
            if ui.selectable_label(self.tab == Tab::Editor, "Python Editor").clicked() {
                self.tab = Tab::Editor;
            }
        });
        ui.separator();

        match self.tab {
            Tab::Bot => self.bot_tab(ui),
            Tab::Editor => self.editor_tab(ui),
        }
    }

    fn status_line(&self) -> String {
        if let Some(state) = self.result {
            match state {
                GameState::Checkmate => {
                    if self.turn == Color::White {
                        "♔ Checkmate — Black wins".into()
                    } else {
                        "♔ Checkmate — White wins".into()
                    }
                }
                GameState::Stalemate => "⚖ Stalemate — draw".into(),
                GameState::Draw => "⚖ Draw".into(),
                GameState::InProgress => "In progress".into(),
            }
        } else if self.board.is_in_check(self.turn) {
            format!("⚠ {} to move — check!", side_name(self.turn))
        } else {
            let glyph = if self.turn == Color::White { '○' } else { '●' };
            format!("{glyph} {} to move", side_name(self.turn))
        }
    }

    fn bot_tab(&mut self, ui: &mut egui::Ui) {
        ui.label(egui::RichText::new(self.status_line()).strong());
        ui.separator();

        // Per-side player selectors + inline auto/suggest radios.
        for color in [Color::White, Color::Black] {
            let i = color.index();
            ui.horizontal(|ui| {
                ui.label(egui::RichText::new(side_name(color)).strong());
                let options = self.player_options();
                let mut selected = self.players[i].clone();
                egui::ComboBox::from_id_salt(("player", i))
                    .selected_text(selected.label())
                    .width(180.0)
                    .show_ui(ui, |ui| {
                        for p in &options {
                            ui.selectable_value(&mut selected, p.clone(), p.label());
                        }
                        // A pseudo "Upload Bot..." entry.
                        if ui.selectable_label(false, "Upload Bot…").clicked() {
                            self.begin_upload();
                        }
                    });
                if selected != self.players[i] {
                    self.on_player_change(color, selected);
                }
            });
            // Inline auto/suggest radio, shown only when a bot is chosen.
            if self.players[i].is_bot() {
                ui.horizontal(|ui| {
                    ui.add_space(12.0);
                    ui.radio_value(&mut self.modes[i], Mode::Auto, "Auto-play")
                        .on_hover_text("Bot plays moves automatically");
                    ui.radio_value(&mut self.modes[i], Mode::Suggest, "Suggest")
                        .on_hover_text("Bot suggests moves, you decide");
                });
            }
        }

        // Controls.
        ui.separator();
        ui.horizontal(|ui| {
            if ui.button("New game").clicked() {
                if self.moves.is_empty() {
                    self.new_game();
                } else {
                    self.confirm_new_game = true;
                }
            }
            // The original disables Undo when the move history is empty.
            if ui
                .add_enabled(!self.moves.is_empty(), egui::Button::new("Undo"))
                .clicked()
            {
                self.undo();
            }
            if ui.button(if self.flipped { "Unflip" } else { "Flip" }).clicked() {
                self.flipped = !self.flipped;
            }
        });

        // Bot-vs-bot match controls.
        if self.both_bots() {
            ui.separator();
            ui.label("Bot vs Bot match");
            ui.horizontal(|ui| {
                if !self.match_running {
                    if ui.button("Start match").clicked() {
                        self.match_running = true;
                        self.match_paused = false;
                        self.match_moved = false;
                        self.next_move_at = None;
                        // Original startBotMatch forces both sides to auto-play
                        // and fires each bot's onGameStart() hook.
                        self.modes = [Mode::Auto, Mode::Auto];
                        self.log("Bot match started!");
                        self.fire_on_game_start(Color::White);
                        self.fire_on_game_start(Color::Black);
                    }
                } else if ui.button(if self.match_paused { "Resume" } else { "Pause" }).clicked() {
                    self.match_paused = !self.match_paused;
                    self.next_move_at = None;
                    // Resuming plays the next move immediately (mirrors the
                    // original togglePauseMatch calling playNextBotMove()).
                    if !self.match_paused {
                        self.match_moved = false;
                    }
                    self.log(if self.match_paused { "Bot match paused" } else { "Bot match resumed" });
                }
            });
            ui.add(egui::Slider::new(&mut self.speed_ms, 100..=2000).text("ms / move"));
        }

        // Suggested move.
        if let Some(mv) = self.suggested {
            ui.separator();
            ui.horizontal(|ui| {
                ui.label(format!("Suggested: {}", mv.to_uci()));
                if ui.button("Play it").clicked() {
                    self.apply(mv);
                }
            });
        }

        // Example bot cards.
        ui.separator();
        ui.collapsing("Example bots", |ui| {
            self.bot_card(ui, "Random Bot (Rust)", "🦀", "Plays a random legal move.", Player::RandomBot,
                "https://github.com/lukraj3/playground");
            self.bot_card(ui, "Smart Bot (Rust)", "🦀", "Negamax search with captures & center control.", Player::SmartBot,
                "https://github.com/lukraj3/playground");
            self.bot_card(ui, "Smart Bot (Python)", "🐍", "Prefers captures and center control. Written in Python.", Player::SmartPython,
                "https://github.com/lukraj3/playground");
        });
        // Inline CTA to the Python editor (mirrors the original's link-button).
        if ui.button("Open Python Editor →").clicked() {
            self.tab = Tab::Editor;
        }

        // Uploaded bots section.
        if !self.uploaded.is_empty() {
            ui.separator();
            ui.label(egui::RichText::new("Uploaded bots").strong());
            let uploaded: Vec<(String, String, String)> = self
                .uploaded
                .iter()
                .map(|b| (b.id.clone(), b.name.clone(), b.description.clone()))
                .collect();
            let mut remove: Option<(String, String)> = None;
            for (id, name, desc) in uploaded {
                ui.group(|ui| {
                    ui.horizontal(|ui| {
                        ui.label("🧩");
                        ui.label(egui::RichText::new(&name).strong());
                    });
                    ui.label(egui::RichText::new(&desc).weak());
                    ui.horizontal(|ui| {
                        if ui.button("Load White").clicked() {
                            self.on_player_change(Color::White, Player::Uploaded(id.clone(), name.clone()));
                        }
                        if ui.button("Load Black").clicked() {
                            self.on_player_change(Color::Black, Player::Uploaded(id.clone(), name.clone()));
                        }
                        if ui.button("🗑 Remove").clicked() {
                            remove = Some((id.clone(), name.clone()));
                        }
                    });
                });
            }
            // Removal asks for confirmation first (mirrors handleRemoveBot).
            if let Some((id, name)) = remove {
                self.confirm_remove = Some((id, name));
            }
        }

        // Upload button + WIT spec link.
        ui.separator();
        ui.horizontal(|ui| {
            if ui.button("Browse Files… (upload .wasm bot)").clicked() {
                self.begin_upload();
            }
        });
        ui.hyperlink_to(
            "WIT chess-bot interface spec",
            "https://github.com/lukraj3/playground",
        );

        self.move_history(ui);
        self.bot_log(ui);
        self.chat_panel(ui);
    }

    fn player_options(&self) -> Vec<Player> {
        let mut opts = vec![
            Player::Human,
            Player::RandomBot,
            Player::SmartBot,
            Player::SmartPython,
            Player::PythonEditor,
        ];
        // Each uploaded bot is selectable from both player dropdowns (mirrors
        // bot-manager.setupBotUpload inserting an <option> in both selects).
        for b in &self.uploaded {
            opts.push(Player::Uploaded(b.id.clone(), b.name.clone()));
        }
        opts
    }

    fn bot_card(&mut self, ui: &mut egui::Ui, name: &str, icon: &str, desc: &str, p: Player, src: &str) {
        ui.group(|ui| {
            ui.horizontal(|ui| {
                ui.label(icon);
                ui.label(egui::RichText::new(name).strong());
            });
            ui.label(egui::RichText::new(desc).weak());
            ui.horizontal(|ui| {
                if ui.button("Load White").clicked() {
                    self.on_player_change(Color::White, p.clone());
                }
                if ui.button("Load Black").clicked() {
                    self.on_player_change(Color::Black, p.clone());
                }
                ui.hyperlink_to("Source", src);
            });
        });
    }

    fn on_player_change(&mut self, color: Color, player: Player) {
        let i = color.index();
        // Python editor bots default to switching to the editor tab.
        if matches!(player, Player::PythonEditor | Player::SmartPython) {
            self.tab = Tab::Editor;
        }
        // Loading Smart Bot (Python) replaces the editor buffer with the example
        // code (mirrors loadBot's setEditorCode(getInitialCode())).
        if matches!(player, Player::SmartPython) {
            self.editor_code = PYTHON_EXAMPLE.to_owned();
        }
        let is_bot = player.is_bot();
        let label = player.label();
        self.players[i] = player;
        self.suggested = None;
        self.next_move_at = None;
        if is_bot {
            self.log(format!("{}: {} loaded", side_name(color), label));
            glue::toast(&format!("{label} loaded as {}", side_name(color).to_lowercase()), "success");
            // JS bots run their on_game_start lifecycle hook on load (mirrors
            // createPythonBot / uploaded-bot onGameStart()).
            self.fire_on_game_start(color);
        }
        if !self.both_bots() {
            self.end_match();
        }
    }

    fn editor_tab(&mut self, ui: &mut egui::Ui) {
        // Fullscreen mode paints the editor over the whole viewport.
        if self.editor_fullscreen {
            self.editor_fullscreen_overlay(ui.ctx());
            // Escape exits fullscreen (mirrors the original's Esc handler).
            if ui.input(|i| i.key_pressed(egui::Key::Escape)) {
                self.editor_fullscreen = false;
            }
            return;
        }

        ui.horizontal(|ui| {
            ui.label(egui::RichText::new("Monty Python bot editor").strong());
            if ui
                .button("⛶")
                .on_hover_text("Toggle fullscreen (Esc to exit)")
                .clicked()
            {
                self.editor_fullscreen = true;
            }
        });
        ui.label(
            egui::RichText::new(
                "Host functions: get_board(), get_legal_moves(), is_check(), get_fen(), log(msg)",
            )
            .weak()
            .small(),
        );
        ui.horizontal(|ui| {
            if ui.button("Test Code (Ctrl+Enter)").clicked() {
                self.editor_test();
            }
            if ui.button("Apply to Bot (Ctrl+S)").clicked() {
                self.editor_apply();
            }
        });

        // Ctrl+S / Ctrl+Enter shortcuts (when not typing they still work via the
        // buttons; here we honour them while the editor has focus).
        let mods = ui.input(|i| i.modifiers);
        if mods.command || mods.ctrl {
            if ui.input(|i| i.key_pressed(egui::Key::S)) {
                self.editor_apply();
            }
            if ui.input(|i| i.key_pressed(egui::Key::Enter)) {
                self.editor_test();
            }
        }

        if let Some((ok, msg)) = &self.editor_feedback {
            let color = if *ok {
                egui::Color32::from_rgb(0x4c, 0xaf, 0x50)
            } else {
                egui::Color32::from_rgb(0xe5, 0x39, 0x35)
            };
            ui.colored_label(color, msg);
        }

        self.code_editor(ui, 20);

        ui.separator();
        self.bot_log(ui);
    }

    /// Fullscreen editor overlay: a centered window filling the viewport.
    fn editor_fullscreen_overlay(&mut self, ctx: &egui::Context) {
        egui::Window::new("Monty Python bot editor — fullscreen")
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .fixed_size(ctx.screen_rect().size() * 0.92)
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    if ui.button("Test Code (Ctrl+Enter)").clicked() {
                        self.editor_test();
                    }
                    if ui.button("Apply to Bot (Ctrl+S)").clicked() {
                        self.editor_apply();
                    }
                    if ui
                        .button("⛶ Exit fullscreen (Esc)")
                        .clicked()
                    {
                        self.editor_fullscreen = false;
                    }
                });
                let mods = ui.input(|i| i.modifiers);
                if mods.command || mods.ctrl {
                    if ui.input(|i| i.key_pressed(egui::Key::S)) {
                        self.editor_apply();
                    }
                    if ui.input(|i| i.key_pressed(egui::Key::Enter)) {
                        self.editor_test();
                    }
                }
                let rows = ((ctx.screen_rect().height() / 18.0) as usize).clamp(20, 60);
                self.code_editor(ui, rows);
            });
    }

    /// A syntax-highlighted Python code editor with a line-number gutter, active
    /// line highlight, and an 'Ln X, Col Y | N lines | M characters' status bar
    /// (mirrors the original CodeMirror editor in python-editor.js).
    fn code_editor(&mut self, ui: &mut egui::Ui, rows: usize) {
        let total_lines = self.editor_code.lines().count().max(1);
        let char_count = self.editor_code.chars().count();

        // Layouter: color Python keywords / strings / comments / numbers.
        let mut layouter = |ui: &egui::Ui, text: &str, wrap_width: f32| {
            let mut job = python_highlight(text, ui.visuals().dark_mode);
            job.wrap.max_width = wrap_width;
            ui.fonts(|f| f.layout_job(job))
        };

        let row_height = ui.text_style_height(&egui::TextStyle::Monospace);
        let gutter_w = format!("{total_lines}").len().max(2) as f32 * 9.0 + 8.0;

        let output = egui::ScrollArea::vertical()
            .id_salt("editor_scroll")
            .max_height(row_height * rows as f32)
            .show(ui, |ui| {
                ui.horizontal_top(|ui| {
                    // Line-number gutter.
                    let mut nums = String::new();
                    for n in 1..=total_lines {
                        nums.push_str(&format!("{n}\n"));
                    }
                    ui.add_sized(
                        [gutter_w, row_height * total_lines as f32],
                        egui::Label::new(
                            egui::RichText::new(nums)
                                .monospace()
                                .color(egui::Color32::from_gray(0x85)),
                        ),
                    );
                    egui::TextEdit::multiline(&mut self.editor_code)
                        .code_editor()
                        .desired_rows(rows)
                        .desired_width(f32::INFINITY)
                        .font(egui::TextStyle::Monospace)
                        .layouter(&mut layouter)
                        .show(ui)
                })
                .inner
            })
            .inner;

        // Cursor Ln/Col from the text-edit output.
        let (ln, col) = output
            .cursor_range
            .and_then(|r| {
                let idx = r.primary.ccursor.index;
                cursor_line_col(&self.editor_code, idx)
            })
            .unwrap_or((1, 1));

        ui.label(
            egui::RichText::new(format!(
                "Ln {ln}, Col {col} | {total_lines} lines | {char_count} characters"
            ))
            .weak()
            .small(),
        );
    }

    fn move_history(&mut self, ui: &mut egui::Ui) {
        ui.separator();
        ui.label("Moves:");
        egui::ScrollArea::vertical()
            .max_height(150.0)
            .stick_to_bottom(true)
            .id_salt("moves")
            .show(ui, |ui| {
                if self.moves.is_empty() {
                    ui.label(egui::RichText::new("♟ No moves recorded yet").strong());
                    ui.label(
                        egui::RichText::new("Select a piece to begin playing. White moves first!")
                            .weak()
                            .small(),
                    );
                }
                // Half-move numbered: "1. e2e4", "1... e7e5".
                for (ply, mv) in self.moves.iter().enumerate() {
                    let num = ply / 2 + 1;
                    let label = if ply % 2 == 0 {
                        format!("{num}. {}", mv.to_uci())
                    } else {
                        format!("{num}... {}", mv.to_uci())
                    };
                    ui.monospace(label);
                }
            });
    }

    fn bot_log(&mut self, ui: &mut egui::Ui) {
        ui.separator();
        ui.label("Log:");
        egui::ScrollArea::vertical()
            .max_height(130.0)
            .stick_to_bottom(true)
            .id_salt("log")
            .show(ui, |ui| {
                if self.logs.is_empty() {
                    ui.label(egui::RichText::new("🤖 No bot activity yet").strong());
                    ui.label(
                        egui::RichText::new("Select a bot from the dropdowns above to see logs")
                            .weak()
                            .small(),
                    );
                }
                for line in &self.logs {
                    ui.monospace(line);
                }
            });
    }

    fn chat_panel(&mut self, ui: &mut egui::Ui) {
        ui.separator();
        ui.horizontal(|ui| {
            ui.label(egui::RichText::new("💬 Bot banter").strong());
            let current = PERSONALITIES
                .iter()
                .find(|(k, _)| *k == self.personality)
                .map(|(_, l)| *l)
                .unwrap_or("Sassy");
            let mut chosen = self.personality.clone();
            egui::ComboBox::from_id_salt("persona")
                .selected_text(current)
                .show_ui(ui, |ui| {
                    for (key, label) in PERSONALITIES {
                        ui.selectable_value(&mut chosen, (*key).to_owned(), *label);
                    }
                });
            if chosen != self.personality {
                self.personality = chosen;
                save_personality(&self.personality);
                // Start a FRESH conversation but keep the transcript, appending a
                // neutral "— switched to <Label> —" status line (mirrors original).
                glue::llm_reset(&self.personality);
                let label = self.persona_label();
                self.add_chat_status(format!("— switched to {label} —"));
            }
        });

        // Warming-up / offline status (neutral, not in character).
        let status = glue::llm_status();
        if !status.is_empty() {
            ui.label(egui::RichText::new(format!("🧠 {status}")).weak().small());
        }

        // Animated ellipsis for typing indicators (0..=3 dots).
        let dots = {
            let t = ui.input(|i| i.time);
            ".".repeat(((t * 2.0) as usize % 4).max(0))
        };

        egui::ScrollArea::vertical()
            .max_height(140.0)
            .stick_to_bottom(true)
            .id_salt("chat")
            .show(ui, |ui| {
                if self.chat.is_empty() && status.is_empty() {
                    ui.label(egui::RichText::new("No banter yet").strong());
                    ui.label(
                        egui::RichText::new(
                            "Say something to the bot, or wait for it to react to a capture.",
                        )
                        .weak()
                        .small(),
                    );
                }
                for entry in &self.chat {
                    match entry {
                        ChatEntry::Msg { persona, text, .. } => {
                            ui.horizontal_wrapped(|ui| {
                                ui.label(egui::RichText::new(format!("{persona}:")).strong());
                                ui.label(text);
                            });
                        }
                        ChatEntry::Status(text) => {
                            ui.label(egui::RichText::new(text).weak().small());
                        }
                        ChatEntry::Typing { persona, .. } => {
                            ui.label(
                                egui::RichText::new(format!("{persona} is typing{dots}"))
                                    .weak()
                                    .italics(),
                            );
                        }
                    }
                }
            });

        ui.horizontal(|ui| {
            let resp = ui.add(
                egui::TextEdit::singleline(&mut self.chat_input)
                    .char_limit(80)
                    .hint_text("Message the bot (80 chars)…")
                    .desired_width(200.0),
            );
            let send = ui.button("Send").clicked()
                || (resp.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)));
            if send {
                let text = self.chat_input.trim().to_owned();
                if !text.is_empty() {
                    self.chat_input.clear();
                    self.send_chat_turn(text, true, false);
                }
            }
        });
    }

    fn board_ui(&mut self, ui: &mut egui::Ui) {
        let avail = ui.available_size();
        let board_px = (avail.x.min(avail.y) - 20.0).max(160.0);
        let sq = board_px / 8.0;
        let (rect, _) =
            ui.allocate_exact_size(egui::vec2(board_px + 18.0, board_px + 18.0), egui::Sense::hover());
        let painter = ui.painter_at(rect);
        let origin = egui::pos2(rect.min.x + 18.0, rect.min.y);

        let sel_targets: Vec<Square> = self
            .selected
            .map(|s| self.targets_from(s).iter().map(|m| m.to()).collect())
            .unwrap_or_default();
        let suggest_sqs: Vec<Square> =
            self.suggested.map(|m| vec![m.from(), m.to()]).unwrap_or_default();

        for row in 0u8..8 {
            for col in 0u8..8 {
                let (file, rank) = self.display_to_board(row, col);
                let square = Square::new(file, rank);
                let min = egui::pos2(origin.x + f32::from(col) * sq, origin.y + f32::from(row) * sq);
                let cell = egui::Rect::from_min_size(min, egui::vec2(sq, sq));

                // Square naming and palette mirror the original chess-board.css:
                // (file+rank)%2==0 => dark (brown #b58863), else light (cream #f0d9b5).
                let light = (file + rank) % 2 == 1;
                let mut fill = if light {
                    egui::Color32::from_rgb(0xF0, 0xD9, 0xB5)
                } else {
                    egui::Color32::from_rgb(0xB5, 0x88, 0x63)
                };
                // Last move — sky-blue rgba(135,206,235,0.5).
                if self.last_move.is_some_and(|(f, t)| f == square || t == square) {
                    fill = blend(fill, egui::Color32::from_rgb(0x87, 0xCE, 0xEB), 0.5);
                }
                // Suggested — blue #9dc3e6.
                if suggest_sqs.contains(&square) {
                    fill = blend(fill, egui::Color32::from_rgb(0x9D, 0xC3, 0xE6), 0.65);
                }
                // Selected — yellow rgba(255,235,59,0.6).
                if self.selected == Some(square) {
                    fill = blend(fill, egui::Color32::from_rgb(0xFF, 0xEB, 0x3B), 0.6);
                }
                // Check — red rgba(244,67,54,0.4).
                if self.board.is_in_check(self.turn)
                    && self
                        .board
                        .piece_at(square)
                        .is_some_and(|p| p.color() == self.turn && p.piece_type() == PieceType::King)
                {
                    fill = blend(fill, egui::Color32::from_rgb(0xF4, 0x43, 0x36), 0.4);
                }
                painter.rect_filled(cell, 0.0, fill);

                if let Some(piece) = self.board.piece_at(square) {
                    draw_piece(&painter, cell, piece);
                }
                if sel_targets.contains(&square) {
                    // Legal-capture squares (occupied) get a ring; empty legal
                    // targets get a centered dot (mirrors chess-board.css).
                    if self.board.piece_at(square).is_some() {
                        painter.circle_stroke(
                            cell.center(),
                            sq * 0.42,
                            egui::Stroke::new(sq * 0.09, egui::Color32::from_rgba_unmultiplied(0xDC, 0x35, 0x45, 90)),
                        );
                    } else {
                        painter.circle_filled(
                            cell.center(),
                            sq * 0.16,
                            egui::Color32::from_rgba_unmultiplied(60, 60, 60, 64),
                        );
                    }
                }
                // Keyboard focus ring.
                if self.focus_sq == square {
                    painter.rect_stroke(
                        cell.shrink(1.5),
                        0.0,
                        egui::Stroke::new(2.5_f32, egui::Color32::from_rgb(0x33, 0x99, 0xFF)),
                        egui::StrokeKind::Inside,
                    );
                }
            }
        }

        // Coordinate labels.
        let label_color = egui::Color32::from_gray(150);
        for i in 0u8..8 {
            let (_, rank) = self.display_to_board(i, 0);
            let file_at_col = self.display_to_board(0, i).0;
            let ry = origin.y + f32::from(i) * sq + sq / 2.0;
            painter.text(
                egui::pos2(rect.min.x + 9.0, ry),
                egui::Align2::CENTER_CENTER,
                (b'1' + rank) as char,
                egui::FontId::proportional(12.0),
                label_color,
            );
            let fx = origin.x + f32::from(i) * sq + sq / 2.0;
            painter.text(
                egui::pos2(fx, origin.y + board_px + 9.0),
                egui::Align2::CENTER_CENTER,
                (b'a' + file_at_col) as char,
                egui::FontId::proportional(12.0),
                label_color,
            );
        }

        // Pointer interaction: click + drag-and-drop.
        let resp = ui.interact(rect, ui.id().with("board"), egui::Sense::click_and_drag());
        // Capture only plain values so the closure doesn't borrow `self`.
        let flipped = self.flipped;
        let pos_to_sq = move |pos: egui::Pos2| -> Option<Square> {
            let col = ((pos.x - origin.x) / sq).floor() as i32;
            let row = ((pos.y - origin.y) / sq).floor() as i32;
            if (0..8).contains(&col) && (0..8).contains(&row) {
                let (file, rank) = if flipped {
                    (7 - col as u8, row as u8)
                } else {
                    (col as u8, 7 - row as u8)
                };
                Some(Square::new(file, rank))
            } else {
                None
            }
        };

        if resp.drag_started() {
            if let Some(pos) = resp.interact_pointer_pos() {
                if let Some(sq) = pos_to_sq(pos) {
                    if self.manual_input_allowed()
                        && self.board.piece_at(sq).is_some_and(|p| p.color() == self.turn)
                        && !self.targets_from(sq).is_empty()
                    {
                        self.selected = Some(sq);
                        self.focus_sq = sq;
                    }
                }
            }
        }
        if resp.drag_stopped() {
            if let (Some(from), Some(pos)) = (self.selected, resp.interact_pointer_pos()) {
                if let Some(to) = pos_to_sq(pos) {
                    if from != to && self.manual_input_allowed() {
                        self.try_human_move(from, to);
                    }
                }
            }
        }
        if resp.clicked() {
            if let Some(pos) = resp.interact_pointer_pos() {
                if let Some(sq) = pos_to_sq(pos) {
                    self.focus_sq = sq;
                    self.on_square_click(sq);
                }
            }
        }
    }

    fn display_to_board(&self, row: u8, col: u8) -> (u8, u8) {
        if self.flipped {
            (7 - col, row)
        } else {
            (col, 7 - row)
        }
    }

    fn promotion_modal(&mut self, ctx: &egui::Context) {
        if self.promote.is_none() {
            return;
        }
        // Escape aborts the promotion (matching the original's dismissable modal).
        if ctx.input(|i| i.key_pressed(egui::Key::Escape)) {
            self.promote = None;
            self.selected = None;
            return;
        }
        egui::Window::new("Promote pawn")
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    for (pt, label) in [
                        (PieceType::Queen, "Queen"),
                        (PieceType::Rook, "Rook"),
                        (PieceType::Bishop, "Bishop"),
                        (PieceType::Knight, "Knight"),
                    ] {
                        if ui.button(label).clicked() {
                            self.finish_promotion(pt);
                        }
                    }
                    // Cancel aborts the move (the original modal dismisses on
                    // backdrop click without moving).
                    if ui.button("Cancel").clicked() {
                        self.promote = None;
                        self.selected = None;
                    }
                });
            });
    }

    fn help_modal(&mut self, ctx: &egui::Context) {
        if !self.show_help {
            return;
        }
        let mut open = true;
        egui::Window::new("Keyboard shortcuts")
            .collapsible(false)
            .resizable(false)
            .open(&mut open)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ctx, |ui| {
                ui.label(egui::RichText::new("Board").strong());
                ui.label("Arrow keys — move focus between squares");
                ui.label("Enter / Space — select or move the focused square");
                ui.label("Escape — cancel selection");
                ui.separator();
                ui.label(egui::RichText::new("Tabs").strong());
                ui.label("Click a tab to switch Bot Interface / Python Editor");
                ui.separator();
                ui.label(egui::RichText::new("Python editor").strong());
                ui.label("Ctrl+Enter — test code");
                ui.label("Ctrl+S — apply to bot");
                ui.label("⛶ — toggle fullscreen (Esc to exit)");
                ui.separator();
                if ui.button("Close").clicked() {
                    self.show_help = false;
                }
            });
        if !open {
            self.show_help = false;
        }
        if ctx.input(|i| i.key_pressed(egui::Key::Escape)) {
            self.show_help = false;
        }
    }

    fn remove_uploaded(&mut self, id: &str) {
        glue::upload_remove(id);
        self.uploaded.retain(|b| b.id != id);
        // Reset any side using that bot.
        for c in [Color::White, Color::Black] {
            if matches!(&self.players[c.index()], Player::Uploaded(uid, _) if uid == id) {
                self.players[c.index()] = Player::Human;
            }
        }
    }

    fn confirm_remove_modal(&mut self, ctx: &egui::Context) {
        let Some((id, name)) = self.confirm_remove.clone() else {
            return;
        };
        egui::Window::new("Remove bot?")
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ctx, |ui| {
                ui.label(format!("Remove {name}?"));
                ui.horizontal(|ui| {
                    if ui.button("Cancel").clicked() {
                        self.confirm_remove = None;
                    }
                    if ui.button("Remove").clicked() {
                        self.confirm_remove = None;
                        self.remove_uploaded(&id);
                    }
                });
            });
        if ctx.input(|i| i.key_pressed(egui::Key::Escape)) {
            self.confirm_remove = None;
        }
    }

    fn confirm_modal(&mut self, ctx: &egui::Context) {
        if !self.confirm_new_game {
            return;
        }
        egui::Window::new("⚠ Start New Game?")
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ctx, |ui| {
                ui.label("Current game progress will be lost. Are you sure you want to continue?");
                ui.horizontal(|ui| {
                    if ui.button("Cancel").clicked() {
                        self.confirm_new_game = false;
                    }
                    if ui.button("Continue").clicked() {
                        self.confirm_new_game = false;
                        self.new_game();
                        glue::toast("New game started", "info");
                    }
                });
            });
        if ctx.input(|i| i.key_pressed(egui::Key::Escape)) {
            self.confirm_new_game = false;
        }
    }
}

// --- async plumbing -----------------------------------------------------------

/// Spawns a JS bot promise; pushes a `JsMove` event when it resolves.
fn spawn_bot_result(
    promise: js_sys::Promise,
    side: Color,
    suggest: bool,
    events: Rc<RefCell<Vec<BotEvent>>>,
    ctx: egui::Context,
) {
    wasm_bindgen_futures::spawn_local(async move {
        let ev = match wasm_bindgen_futures::JsFuture::from(promise).await {
            Ok(v) => {
                let raw = v.as_string().unwrap_or_default();
                let (uci, logs, error) = parse_bot_result(&raw);
                BotEvent::JsMove { side, uci, logs, error, suggest }
            }
            Err(e) => BotEvent::JsMove {
                side,
                uci: String::new(),
                logs: Vec::new(),
                error: Some(js_err(&e)),
                suggest,
            },
        };
        events.borrow_mut().push(ev);
        ctx.request_repaint();
    });
}

fn spawn_llm_reply(
    promise: js_sys::Promise,
    id: u64,
    persona: String,
    capture: bool,
    events: Rc<RefCell<Vec<BotEvent>>>,
    ctx: egui::Context,
) {
    wasm_bindgen_futures::spawn_local(async move {
        let text = match wasm_bindgen_futures::JsFuture::from(promise).await {
            Ok(v) => v.as_string().unwrap_or_default(),
            Err(_) => String::new(),
        };
        events.borrow_mut().push(BotEvent::LlmReply { id, persona, text, capture });
        ctx.request_repaint();
    });
}

/// Parses `{ ok, value, logs, error }` from a JS bot call.
fn parse_bot_result(raw: &str) -> (String, Vec<String>, Option<String>) {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(raw) else {
        return (String::new(), Vec::new(), Some("bad bot result".into()));
    };
    let logs: Vec<String> = v
        .get("logs")
        .and_then(|l| l.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(str::to_owned)).collect())
        .unwrap_or_default();
    if v.get("ok").and_then(serde_json::Value::as_bool) == Some(true) {
        let uci = v.get("value").and_then(|x| x.as_str()).unwrap_or("").to_owned();
        (uci, logs, None)
    } else {
        let err = v.get("error").and_then(|x| x.as_str()).unwrap_or("bot error").to_owned();
        (String::new(), logs, Some(err))
    }
}

fn parse_upload_result(raw: &str) -> BotEvent {
    let v: serde_json::Value = serde_json::from_str(raw).unwrap_or(serde_json::Value::Null);
    let ok = v.get("ok").and_then(serde_json::Value::as_bool) == Some(true);
    BotEvent::Uploaded {
        ok,
        id: v.get("id").and_then(|x| x.as_str()).unwrap_or("").to_owned(),
        name: v.get("name").and_then(|x| x.as_str()).unwrap_or("").to_owned(),
        description: v.get("description").and_then(|x| x.as_str()).unwrap_or("").to_owned(),
        error: v.get("error").and_then(|x| x.as_str()).unwrap_or("").to_owned(),
    }
}

fn js_err(e: &JsValue) -> String {
    e.as_string()
        .unwrap_or_else(|| String::from(js_sys::Error::from(e.clone()).message()))
}

// --- helpers ------------------------------------------------------------------

/// Python keywords colored in the editor (mirrors CodeMirror's lang-python).
const PY_KEYWORDS: &[&str] = &[
    "def", "return", "if", "elif", "else", "for", "while", "in", "not", "and", "or", "is", "None",
    "True", "False", "import", "from", "as", "class", "try", "except", "finally", "raise", "with",
    "lambda", "pass", "break", "continue", "global", "nonlocal", "yield", "assert", "del",
];

/// Converts a character index into 1-based (line, column).
fn cursor_line_col(text: &str, char_idx: usize) -> Option<(usize, usize)> {
    let mut line = 1;
    let mut col = 1;
    for c in text.chars().take(char_idx) {
        if c == '\n' {
            line += 1;
            col = 1;
        } else {
            col += 1;
        }
    }
    Some((line, col))
}

/// Builds a syntax-highlighted `LayoutJob` for Python source.
fn python_highlight(text: &str, dark: bool) -> egui::text::LayoutJob {
    use egui::text::{LayoutJob, TextFormat};

    let kw = egui::Color32::from_rgb(0x56, 0x9c, 0xd6);
    let string = egui::Color32::from_rgb(0xce, 0x91, 0x78);
    let comment = egui::Color32::from_rgb(0x6a, 0x99, 0x55);
    let number = egui::Color32::from_rgb(0xb5, 0xce, 0xa8);
    let plain = if dark {
        egui::Color32::from_rgb(0xd4, 0xd4, 0xd4)
    } else {
        egui::Color32::from_rgb(0x20, 0x20, 0x20)
    };
    let font = egui::FontId::monospace(14.0);
    let mut job = LayoutJob::default();
    let fmt = |c: egui::Color32| TextFormat { font_id: font.clone(), color: c, ..Default::default() };

    for line in text.split_inclusive('\n') {
        // Comment: everything from the first '#' to end of line (naive but close).
        if let Some(hash) = line.find('#') {
            emit_code(&mut job, &line[..hash], plain, string, number, kw, &font);
            job.append(&line[hash..], 0.0, fmt(comment));
        } else {
            emit_code(&mut job, line, plain, string, number, kw, &font);
        }
    }
    job
}

/// Tokenizes a comment-free code fragment, coloring strings, numbers, keywords.
fn emit_code(
    job: &mut egui::text::LayoutJob,
    frag: &str,
    plain: egui::Color32,
    string: egui::Color32,
    number: egui::Color32,
    kw: egui::Color32,
    font: &egui::FontId,
) {
    use egui::text::TextFormat;
    let fmt = |c: egui::Color32| TextFormat { font_id: font.clone(), color: c, ..Default::default() };
    let chars: Vec<char> = frag.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c == '"' || c == '\'' {
            // String literal up to the matching quote (no escape handling needed).
            let quote = c;
            let start = i;
            i += 1;
            while i < chars.len() && chars[i] != quote {
                i += 1;
            }
            if i < chars.len() {
                i += 1;
            }
            job.append(&chars[start..i].iter().collect::<String>(), 0.0, fmt(string));
        } else if c.is_ascii_digit() {
            let start = i;
            while i < chars.len() && (chars[i].is_ascii_alphanumeric() || chars[i] == '.') {
                i += 1;
            }
            job.append(&chars[start..i].iter().collect::<String>(), 0.0, fmt(number));
        } else if c.is_alphabetic() || c == '_' {
            let start = i;
            while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            let word: String = chars[start..i].iter().collect();
            let color = if PY_KEYWORDS.contains(&word.as_str()) { kw } else { plain };
            job.append(&word, 0.0, fmt(color));
        } else {
            job.append(&c.to_string(), 0.0, fmt(plain));
            i += 1;
        }
    }
}

fn side_name(c: Color) -> &'static str {
    match c {
        Color::White => "White",
        Color::Black => "Black",
    }
}

fn square_name(sq: Square) -> String {
    format!("{}{}", (b'a' + sq.file()) as char, sq.rank() + 1)
}

/// Builds a spoken move description, e.g. "White knight moves from b1 to c3,
/// captures black pawn. Check!" (mirrors #move-announcer in the original).
fn describe_move(
    mv: Move,
    mover: Color,
    mover_piece: Option<Piece>,
    captured: Option<Piece>,
    board_after: &Board,
    next_turn: Color,
) -> String {
    let piece = mover_piece.map(|p| piece_name(p.piece_type())).unwrap_or("piece");
    let mut text = format!(
        "{} {} moves from {} to {}",
        side_name(mover),
        piece,
        square_name(mv.from()),
        square_name(mv.to()),
    );
    if let Some(v) = captured {
        text.push_str(&format!(", captures {} {}", side_name(v.color()).to_lowercase(), piece_name(v.piece_type())));
    }
    if let MoveKind::Promotion(pt) = mv.kind() {
        text.push_str(&format!(", promotes to {}", piece_name(pt)));
    }
    text.push('.');
    match board_after.game_state() {
        GameState::Checkmate => text.push_str(" Checkmate!"),
        GameState::Stalemate => text.push_str(" Stalemate."),
        GameState::Draw => text.push_str(" Draw."),
        GameState::InProgress if board_after.is_in_check(next_turn) => text.push_str(" Check!"),
        GameState::InProgress => {}
    }
    text
}

fn piece_name(pt: PieceType) -> &'static str {
    match pt {
        PieceType::Pawn => "pawn",
        PieceType::Knight => "knight",
        PieceType::Bishop => "bishop",
        PieceType::Rook => "rook",
        PieceType::Queen => "queen",
        PieceType::King => "king",
    }
}

/// Localized-ish HH:MM:SS from the browser clock.
fn now_hms() -> String {
    let d = js_sys::Date::new_0();
    format!(
        "{:02}:{:02}:{:02}",
        d.get_hours(),
        d.get_minutes(),
        d.get_seconds()
    )
}

fn storage() -> Option<web_sys::Storage> {
    web_sys::window().and_then(|w| w.local_storage().ok().flatten())
}

fn load_personality() -> String {
    storage()
        .and_then(|s| s.get_item(PERSONALITY_STORAGE_KEY).ok().flatten())
        .filter(|k| PERSONALITIES.iter().any(|(key, _)| key == k))
        .unwrap_or_else(|| "sassy".to_owned())
}

fn save_personality(key: &str) {
    if let Some(s) = storage() {
        let _ = s.set_item(PERSONALITY_STORAGE_KEY, key);
    }
}

/// Draws a piece as a standard Unicode chess glyph.
fn draw_piece(painter: &egui::Painter, cell: egui::Rect, piece: Piece) {
    let glyph = match (piece.color(), piece.piece_type()) {
        (Color::White, PieceType::King) => '♔',
        (Color::White, PieceType::Queen) => '♕',
        (Color::White, PieceType::Rook) => '♖',
        (Color::White, PieceType::Bishop) => '♗',
        (Color::White, PieceType::Knight) => '♘',
        (Color::White, PieceType::Pawn) => '♙',
        (Color::Black, PieceType::King) => '♚',
        (Color::Black, PieceType::Queen) => '♛',
        (Color::Black, PieceType::Rook) => '♜',
        (Color::Black, PieceType::Bishop) => '♝',
        (Color::Black, PieceType::Knight) => '♞',
        (Color::Black, PieceType::Pawn) => '♟',
    };
    // A subtle outline for legibility on both square colors.
    let ink = match piece.color() {
        Color::White => egui::Color32::from_rgb(0xFA, 0xFA, 0xFA),
        Color::Black => egui::Color32::from_rgb(0x1A, 0x1A, 0x1A),
    };
    let outline = match piece.color() {
        Color::White => egui::Color32::from_rgb(0x30, 0x30, 0x30),
        Color::Black => egui::Color32::from_rgb(0xE0, 0xE0, 0xE0),
    };
    let font = egui::FontId::proportional(cell.width() * 0.72);
    for dx in [-1.0_f32, 1.0] {
        for dy in [-1.0_f32, 1.0] {
            painter.text(
                cell.center() + egui::vec2(dx, dy),
                egui::Align2::CENTER_CENTER,
                glyph,
                font.clone(),
                outline,
            );
        }
    }
    painter.text(cell.center(), egui::Align2::CENTER_CENTER, glyph, font, ink);
}

fn blend(a: egui::Color32, b: egui::Color32, t: f32) -> egui::Color32 {
    let lerp = |x: u8, y: u8| (f32::from(x) * (1.0 - t) + f32::from(y) * t) as u8;
    egui::Color32::from_rgb(lerp(a.r(), b.r()), lerp(a.g(), b.g()), lerp(a.b(), b.b()))
}

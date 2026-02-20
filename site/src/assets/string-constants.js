export const witCode = `// Shared types (chess:types@0.1.0)
package chess:types@0.1.0;

interface types {
    enum piece-type { pawn, knight, bishop, rook, queen, king }
    enum color { white, black }
    record piece { piece-type: piece-type, color: color }
    type square = u8;    // 0=a1, 63=h8
    type move = string;  // UCI format: "e2e4", "e7e8q"
    record move-history-entry { uci-move: move, resulting-fen: string }
    record castling {
        white-kingside: bool, white-queenside: bool,
        black-kingside: bool, black-queenside: bool,
    }
    record board-state {
        squares: list<option<piece>>, turn: color,
        castling-rights: castling, en-passant: option<square>,
        halfmove-clock: u16, fullmove-number: u16,
        move-history: list<move-history-entry>,
    }
    enum game-result { in-progress, checkmate, stalemate, draw }
    enum engine-error { invalid-fen, illegal-move, game-over }
}

// Bot plugin interface (chess:bot@0.1.0)
package chess:bot@0.1.0;

interface host {
    use chess:types/types@0.1.0.{board-state, move, game-result};
    get-board: func() -> board-state;
    get-legal-moves: func() -> list<move>;
    is-check: func() -> bool;
    get-game-result: func() -> game-result;
    get-fen: func() -> string;
    log: func(message: string);
}

interface bot {
    use chess:types/types@0.1.0.{move, color};
    get-name: func() -> string;
    get-description: func() -> string;
    get-preferred-color: func() -> option<color>;
    on-game-start: func();
    select-move: func() -> move;
    suggest-move: func() -> move;
}

world chess-bot {
    import host;
    export bot;
}`;

export const pythonExample = `# Smart Bot — captures, center control, development.
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
    return select_move()`;

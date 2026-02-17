// Bot Host Implementation
// This module provides the host interface that chess bots import

let currentGame = null;
let logCallback = console.log;

export function setGame(game) {
  currentGame = game;
}

export function setLogCallback(callback) {
  logCallback = callback;
}

// chess:bot/host interface implementation
export function getBoard() {
  if (!currentGame) {
    throw new Error("No game set");
  }

  const boardState = JSON.parse(currentGame.get_board_state());

  // Convert to WIT format
  return {
    squares: boardState.squares.map(sq => {
      if (!sq) return undefined;
      return {
        pieceType: sq.piece_type,
        color: sq.color,
      };
    }),
    turn: boardState.turn,
    castlingRights: {
      whiteKingside: boardState.castling.white_kingside,
      whiteQueenside: boardState.castling.white_queenside,
      blackKingside: boardState.castling.black_kingside,
      blackQueenside: boardState.castling.black_queenside,
    },
    enPassant: boardState.en_passant ? squareToIndex(boardState.en_passant) : undefined,
    halfmoveClock: boardState.halfmove_clock,
    fullmoveNumber: boardState.fullmove_number,
  };
}

export function getLegalMoves() {
  if (!currentGame) {
    throw new Error("No game set");
  }
  return JSON.parse(currentGame.get_legal_moves());
}

export function isCheck() {
  if (!currentGame) {
    throw new Error("No game set");
  }
  return currentGame.is_check();
}

export function getGameResult() {
  if (!currentGame) {
    throw new Error("No game set");
  }
  return currentGame.get_game_state();
}

export function getFen() {
  if (!currentGame) {
    throw new Error("No game set");
  }
  return currentGame.get_fen();
}

export function log(message) {
  logCallback(`[Bot] ${message}`);
}

// Helper function
function squareToIndex(sq) {
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1]) - 1;
  return rank * 8 + file;
}

// WASI stubs for the component model
export const environment = {
  getEnvironment() { return []; },
  getArguments() { return []; },
  initialCwd() { return undefined; }
};

export const exit = {
  exit(status) { }
};

export const stdin = {
  getStdin() { return undefined; }
};

export const stdout = {
  getStdout() {
    return {
      checkWrite() { return 0n; },
      write(data) { return 0n; },
      blockingFlush() { },
      blockingWriteAndFlush(data) { }
    };
  }
};

export const stderr = {
  getStderr() {
    return {
      checkWrite() { return 0n; },
      write(data) { console.error(new TextDecoder().decode(data)); return 0n; },
      blockingFlush() { },
      blockingWriteAndFlush(data) { console.error(new TextDecoder().decode(data)); }
    };
  }
};

export const wallClock = {
  now() { return { seconds: BigInt(Math.floor(Date.now() / 1000)), nanoseconds: 0 }; },
  resolution() { return { seconds: 0n, nanoseconds: 1000000 }; }
};

export const preopens = {
  getDirectories() { return []; }
};

export const types = {};

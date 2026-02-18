let currentGame = null;
let logCallback = console.log;

export function setGame(game) {
  currentGame = game;
}

export function setLogCallback(callback) {
  logCallback = callback;
}

function requireGame() {
  if (!currentGame) {
    throw new Error("No game set");
  }
  return currentGame;
}

export function getBoard() {
  return requireGame().getBoardState();
}

export function getLegalMoves() {
  return requireGame().getLegalMoves();
}

export function isCheck() {
  return requireGame().isCheck();
}

export function getGameResult() {
  return requireGame().getGameResult();
}

export function getFen() {
  return requireGame().getFen();
}

export function log(message) {
  logCallback(`[Bot] ${message}`);
}

// WASI stubs for the component model
export const environment = {
  getEnvironment() { return []; },
  getArguments() { return []; },
  initialCwd() { return undefined; }
};

export const exit = {
  exit(status) {
    console.warn(`Bot called exit with status: ${status.tag === 'err' ? status.val : 'ok'}`);
  }
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

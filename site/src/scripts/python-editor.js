// CodeMirror Python editor setup and Monty-based Python bot execution.

import { EditorView, basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

let editorView = null;

const PYTHON_INPUT_NAMES = ["_board", "_legal_moves", "_is_check", "_fen", "_seed"];
const PYTHON_SHIM = `
_log_messages = []

def get_board():
  return _board

def get_legal_moves():
  return _legal_moves

def is_check():
  return _is_check

def get_fen():
  return _fen

def log(msg):
  _log_messages.append(str(msg))

def _pseudo_random(n):
  return _seed % n if n > 0 else 0

`;

export function initEditor() {
  const editorContainer = document.getElementById('python-code-editor');
  editorView = new EditorView({
    doc: editorContainer.dataset.initialCode || '',
    extensions: [
      basicSetup,
      python(),
      oneDark,
      EditorView.lineWrapping,
    ],
    parent: editorContainer,
  });
  return editorView;
}

export function getEditorView() {
  return editorView;
}

export function getEditorCode() {
  return editorView.state.doc.toString();
}

export function setEditorCode(code) {
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: code }
  });
}

export function getInitialCode() {
  return document.getElementById('python-code-editor').dataset.initialCode || '';
}

function getPythonInputs(game) {
  const boardState = game.getBoardState();
  const legalMoves = game.getLegalMoves();
  return {
    _legal_moves: legalMoves,
    _board: {
      squares: boardState.squares,
      turn: boardState.turn,
      castling_rights: {
        white_kingside: boardState.castlingRights.whiteKingside,
        white_queenside: boardState.castlingRights.whiteQueenside,
        black_kingside: boardState.castlingRights.blackKingside,
        black_queenside: boardState.castlingRights.blackQueenside,
      },
      en_passant: boardState.enPassant,
      halfmove_clock: boardState.halfmoveClock,
      fullmove_number: boardState.fullmoveNumber,
      move_history: boardState.moveHistory || [],
    },
    _is_check: game.isCheck(),
    _fen: game.getFen(),
    _seed: Math.floor(Math.random() * 2147483647),
  };
}

export function executePythonBot(code, method, game, addLogEntry, MontyClass) {
  if (!MontyClass) {
    throw new Error('Python runtime not loaded');
  }
  const inputs = getPythonInputs(game);

  let tail;
  if (method === 'on_game_start') {
    tail = '\non_game_start()\n[None, _log_messages]';
  } else if (method === 'get_name') {
    tail = '\n[get_name(), []]';
  } else if (method === 'get_description') {
    tail = '\n[get_description(), []]';
  } else {
    tail = `\n_result = ${method}()\n[_result, _log_messages]`;
  }

  const fullCode = PYTHON_SHIM + code + tail;
  const m = MontyClass.withInputs(fullCode, JSON.stringify(PYTHON_INPUT_NAMES));
  const result = m.runWithInputs(JSON.stringify(inputs));
  const parsed = JSON.parse(result);

  const value = parsed[0];
  const logs = parsed[1] || [];

  const turn = game ? game.getTurn() : '?';
  const label = turn === 'white' ? 'White' : 'Black';
  for (const logMsg of logs) {
    addLogEntry(`[${label}] ${logMsg}`);
  }

  return value;
}

export function createPythonBot(code, color, name, description, deps) {
  const { game, pythonBotCode, addLogEntry, MontyClass } = deps;
  return {
    getName: () => name,
    getDescription: () => description,
    onGameStart: () => {
      try {
        const c = color || game.getTurn();
        const botCode = pythonBotCode[c] || code;
        executePythonBot(botCode, 'on_game_start', game, addLogEntry, MontyClass);
      } catch (e) { /* on_game_start is optional */ }
    },
    selectMove: () => {
      const c = color || game.getTurn();
      const botCode = pythonBotCode[c] || code;
      return executePythonBot(botCode, 'select_move', game, addLogEntry, MontyClass);
    },
    suggestMove: () => {
      const c = color || game.getTurn();
      const botCode = pythonBotCode[c] || code;
      return executePythonBot(botCode, 'suggest_move', game, addLogEntry, MontyClass);
    },
  };
}

export function setupPythonEditorButtons(deps) {
  const { state, addLogEntry, loadMonty, getMontyClass } = deps;

  document.getElementById('test-python').addEventListener('click', async () => {
    const errorDiv = document.getElementById('python-feedback');
    const code = getEditorCode();

    try {
      await loadMonty();
      const result = executePythonBot(code, 'select_move', state.game, addLogEntry, getMontyClass());
      const allLegalMoves = state.game.getLegalMoves();

      if (allLegalMoves.includes(result)) {
        errorDiv.className = 'result-success';
        errorDiv.style.display = 'block';
        errorDiv.textContent = `Bot selected: ${result}`;
      } else {
        errorDiv.className = 'result-error';
        errorDiv.style.display = 'block';
        errorDiv.textContent = `Warning: "${result}" is not a legal move. Legal moves: ${allLegalMoves.slice(0, 5).join(', ')}...`;
      }
    } catch (e) {
      errorDiv.className = 'result-error';
      errorDiv.style.display = 'block';
      errorDiv.textContent = `Error: ${(e.message || String(e))}`;
    }
  });

  document.getElementById('apply-python').addEventListener('click', async () => {
    const { loadBot } = deps;
    const whiteSelect = document.getElementById('white-player');
    const blackSelect = document.getElementById('black-player');

    if (whiteSelect.value === 'python-bot') {
      state.bots.white = await loadBot('python-bot', 'white');
      addLogEntry('White Python bot updated');
    }
    if (blackSelect.value === 'python-bot') {
      state.bots.black = await loadBot('python-bot', 'black');
      addLogEntry('Black Python bot updated');
    }

    if (whiteSelect.value !== 'python-bot' && blackSelect.value !== 'python-bot') {
      addLogEntry('No Python bot active — select "Python Editor Bot" from a player dropdown first');
    }
  });
}

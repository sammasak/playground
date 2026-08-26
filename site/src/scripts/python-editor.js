// CodeMirror Python editor setup and Monty-based Python bot execution.

import { EditorView, basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { indentWithTab } from '@codemirror/commands';
import { keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { toast } from './toast.js';

let editorView = null;
let isFullscreen = false;

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

// Custom theme with improved contrast
const customTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    height: '100%',
  },
  '.cm-scroller': {
    fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", "Consolas", monospace',
    lineHeight: '1.6',
  },
  '.cm-gutters': {
    backgroundColor: '#1e1e1e',
    borderRight: '1px solid #404040',
    color: '#858585',
    minWidth: '50px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    color: '#858585',
    padding: '0 8px 0 5px',
    fontSize: '13px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#2a2a2a',
    color: '#c6c6c6',
  },
  '.cm-activeLine': {
    backgroundColor: '#2a2a2a40',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: '#264f78 !important',
  },
  '.cm-focused .cm-selectionBackground, .cm-focused ::selection': {
    backgroundColor: '#264f78 !important',
  },
  '.cm-cursor': {
    borderLeftColor: '#ffffff',
    borderLeftWidth: '2px',
  },
}, { dark: true });

// Enhanced syntax highlighting with better contrast
const syntaxHighlighting = EditorView.theme({
  '.cm-content': {
    caretColor: '#ffffff',
  },
  '.cm-keyword': {
    color: '#569cd6',
    fontWeight: '600',
  },
  '.cm-string': {
    color: '#ce9178',
  },
  '.cm-comment': {
    color: '#6a9955',
    fontStyle: 'italic',
  },
  '.cm-number': {
    color: '#b5cea8',
  },
  '.cm-variableName': {
    color: '#9cdcfe',
  },
  '.cm-function': {
    color: '#dcdcaa',
  },
  '.cm-operator': {
    color: '#d4d4d4',
  },
  '.cm-bracket': {
    color: '#ffd700',
  },
}, { dark: true });

export function initEditor() {
  const editorContainer = document.getElementById('python-code-editor');

  // Create keyboard shortcuts
  const customKeymap = keymap.of([
    indentWithTab,
    {
      key: 'Mod-s',
      preventDefault: true,
      run: () => {
        document.getElementById('apply-python')?.click();
        return true;
      },
    },
    {
      key: 'Mod-Enter',
      preventDefault: true,
      run: () => {
        document.getElementById('test-python')?.click();
        return true;
      },
    },
  ]);

  editorView = new EditorView({
    doc: editorContainer.dataset.initialCode || '',
    extensions: [
      basicSetup,
      python(),
      oneDark,
      customTheme,
      syntaxHighlighting,
      EditorView.lineWrapping,
      customKeymap,
      EditorView.updateListener.of((update) => {
        if (update.docChanged || update.selectionSet) {
          updateStatusBar();
        }
      }),
    ],
    parent: editorContainer,
  });

  // Initialize status bar and fullscreen button
  setupEditorEnhancements();
  updateStatusBar();

  return editorView;
}

function setupEditorEnhancements() {
  const editorContainer = document.getElementById('python-code-editor');

  // Add fullscreen button
  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.id = 'editor-fullscreen-btn';
  fullscreenBtn.className = 'editor-fullscreen-btn';
  fullscreenBtn.title = 'Toggle fullscreen (Esc to exit)';
  fullscreenBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
  </svg>`;
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  editorContainer.appendChild(fullscreenBtn);

  // Add status bar
  const statusBar = document.createElement('div');
  statusBar.id = 'editor-status-bar';
  statusBar.className = 'editor-status-bar';
  editorContainer.appendChild(statusBar);

  // Listen for Escape key to exit fullscreen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreen) {
      toggleFullscreen();
    }
  });
}

function toggleFullscreen() {
  const editorContainer = document.getElementById('python-code-editor');
  const fullscreenBtn = document.getElementById('editor-fullscreen-btn');

  isFullscreen = !isFullscreen;

  if (isFullscreen) {
    editorContainer.classList.add('editor-fullscreen');
    fullscreenBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
    </svg>`;
    fullscreenBtn.title = 'Exit fullscreen (Esc)';
  } else {
    editorContainer.classList.remove('editor-fullscreen');
    fullscreenBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
    </svg>`;
    fullscreenBtn.title = 'Toggle fullscreen (Esc to exit)';
  }

  editorView.focus();
}

function updateStatusBar() {
  const statusBar = document.getElementById('editor-status-bar');
  if (!statusBar || !editorView) return;

  const doc = editorView.state.doc;
  const lineCount = doc.lines;
  const charCount = doc.length;

  // Get cursor position
  const selection = editorView.state.selection.main;
  const cursorLine = doc.lineAt(selection.head).number;
  const cursorCol = selection.head - doc.lineAt(selection.head).from + 1;

  statusBar.textContent = `Ln ${cursorLine}, Col ${cursorCol} | ${lineCount} lines | ${charCount} characters`;
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
  const shimLines = PYTHON_SHIM.split('\n').length;

  try {
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
  } catch (err) {
    // Extract line number from Python error if available
    const errorMsg = String(err);
    const lineMatch = errorMsg.match(/line (\d+)/);
    if (lineMatch) {
      const pythonLine = parseInt(lineMatch[1]);
      const userLine = pythonLine - shimLines + 1;
      if (userLine > 0) {
        throw new Error(`Python error at line ${userLine}: ${errorMsg.split(':').pop()?.trim() || errorMsg}`);
      }
    }
    throw err;
  }
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
        toast.success(`Bot test passed: ${result}`);
      } else {
        errorDiv.className = 'result-error';
        errorDiv.style.display = 'block';
        errorDiv.textContent = `Warning: "${result}" is not a legal move. Legal moves: ${allLegalMoves.slice(0, 5).join(', ')}...`;
        toast.warning(`Bot returned invalid move: ${result}`);
      }
    } catch (e) {
      const errorMsg = e.message || String(e);
      errorDiv.className = 'result-error';
      errorDiv.style.display = 'block';
      errorDiv.textContent = `Error: ${errorMsg}`;
      toast.error(errorMsg, 6000);
    }
  });

  document.getElementById('apply-python').addEventListener('click', async () => {
    const { loadBot } = deps;
    const whiteSelect = document.getElementById('white-player');
    const blackSelect = document.getElementById('black-player');

    let updated = false;

    if (whiteSelect.value === 'python-bot') {
      state.bots.white = await loadBot('python-bot', 'white');
      addLogEntry('White Python bot updated');
      updated = true;
    }
    if (blackSelect.value === 'python-bot') {
      state.bots.black = await loadBot('python-bot', 'black');
      addLogEntry('Black Python bot updated');
      updated = true;
    }

    if (updated) {
      toast.success('Python bot code applied successfully!');
    } else {
      addLogEntry('No Python bot active — select "Python Editor Bot" from a player dropdown first');
      toast.info('Select "Python Editor Bot" from a player dropdown first');
    }
  });
}

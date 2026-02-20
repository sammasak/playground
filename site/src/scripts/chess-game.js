// Entry point: imports modules, creates shared state, and wires everything together.

import { loadChessEngine, loadMonty, getMontyClass } from './engine.js';
import { initEditor, setupPythonEditorButtons } from './python-editor.js';
import * as boardUI from './board-ui.js';
import * as botManager from './bot-manager.js';
import * as uiControls from './ui-controls.js';

const base = document.getElementById('chess-container').dataset.base;

const state = {
  game: null,
  selectedSquare: null,
  legalMoves: [],
  moveHistory: [],
  lastMove: null,
  suggestedMove: null,
  bots: { white: null, black: null },
  botModes: { white: 'suggest', black: 'suggest' },
  matchTimer: null,
  matchPaused: false,
  autoBotTimeout: null,
  gameGeneration: 0,
  pythonBotCode: { white: null, black: null },
  customBots: new Map(),
  activeBlobUrls: new Set(),
};

function addLogEntry(message) {
  const logContent = document.getElementById('log-content');

  // Remove empty state if it exists
  const emptyState = logContent.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logContent.appendChild(entry);
  logContent.scrollTop = logContent.scrollHeight;
}

initEditor();

boardUI.init({
  state,
  addLogEntry,
  onMove: () => {
    boardUI.updateUI();
    botManager.checkBotTurn();
  },
});

botManager.init({
  state,
  base,
  addLogEntry,
  renderBoard: () => boardUI.renderBoard(),
  updateUI: () => boardUI.updateUI(),
  switchToTab: (tabId) => uiControls.switchToTab(tabId),
});

uiControls.init({
  state,
  addLogEntry,
  renderBoard: () => boardUI.renderBoard(),
  updateUI: () => boardUI.updateUI(),
  stopBotMatch: () => botManager.stopBotMatch(),
  checkBotTurn: () => botManager.checkBotTurn(),
  dismissPromotionModal: () => boardUI.dismissPromotionModal(),
  startBotMatch: () => botManager.startBotMatch(),
  togglePauseMatch: () => botManager.togglePauseMatch(),
});

setupPythonEditorButtons({
  state,
  addLogEntry,
  loadMonty: () => loadMonty(base, addLogEntry),
  getMontyClass,
  loadBot: (botId, color) => botManager.loadBot(botId, color),
});

botManager.setupPlayerDropdowns();
botManager.setupBotModeRadios();
botManager.setupBotUpload();
botManager.setupBotCards();

async function initGame() {
  const board = document.getElementById('chess-board');
  board.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const { Game } = await loadChessEngine(base);
    state.game = new Game();
    board.classList.add('fade-in');
    boardUI.renderBoard();
    boardUI.updateUI();
  } catch (e) {
    board.innerHTML = '<div class="loading-error">Failed to load chess engine. Please refresh.</div>';
    console.error(e);
  }
}

window.addEventListener('unload', () => {
  for (const url of state.activeBlobUrls) {
    URL.revokeObjectURL(url);
  }
});

initGame();

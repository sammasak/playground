// Entry point: imports modules, creates shared state, and wires everything together.

import { loadChessEngine, loadMonty, getMontyClass } from './engine.js';
import { initEditor, setupPythonEditorButtons } from './python-editor.js';
import * as boardUI from './board-ui.js';
import * as botManager from './bot-manager.js';
import * as uiControls from './ui-controls.js';
import { toast, createErrorBoundary } from './toast.js';

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
  toggleBoardFlip: () => boardUI.toggleBoardFlip(),
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
  board.innerHTML = `
    <div class="loading-spinner">
      <div class="loading-text">Loading chess engine...</div>
      <div class="loading-progress">
        <div class="loading-progress-bar indeterminate"></div>
      </div>
    </div>
  `;
  try {
    const { Game } = await loadChessEngine(base);
    state.game = new Game();
    board.classList.add('fade-in');
    boardUI.renderBoard();
    boardUI.updateUI();
  } catch (e) {
    board.innerHTML = `
      <div class="loading-error">
        <svg class="loading-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <div class="loading-error-message">Failed to load chess engine</div>
        <div class="loading-error-details">The WebAssembly chess engine could not be initialized. This may be due to a network error or browser compatibility issue.</div>
        <div class="loading-error-action">
          <button onclick="location.reload()" class="btn-primary">Retry</button>
        </div>
      </div>
    `;
    console.error(e);
    toast.error('Failed to load WASM chess engine. Please refresh the page.', 0);

    // Show connection status banner
    const banner = document.createElement('div');
    banner.className = 'connection-status show';
    banner.innerHTML = `
      <span class="connection-status-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      </span>
      WASM engine failed to load. Please refresh the page or check your connection.
    `;
    document.body.appendChild(banner);
  }
}

window.addEventListener('unload', () => {
  for (const url of state.activeBlobUrls) {
    URL.revokeObjectURL(url);
  }
});

// Initialize error boundary
createErrorBoundary();

initGame();

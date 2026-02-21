// Tab switching, game controls (undo/reset), match controls, and suggestion UI.

import { toast } from './toast.js';

let state = null;
let addLogEntry = null;
let renderBoard = null;
let updateUI = null;
let stopBotMatch = null;
let checkBotTurn = null;
let dismissPromotionModal = null;
let toggleBoardFlip = null;

export function init(deps) {
  state = deps.state;
  addLogEntry = deps.addLogEntry;
  renderBoard = deps.renderBoard;
  updateUI = deps.updateUI;
  stopBotMatch = deps.stopBotMatch;
  checkBotTurn = deps.checkBotTurn;
  dismissPromotionModal = deps.dismissPromotionModal;
  toggleBoardFlip = deps.toggleBoardFlip;

  setupTabs();
  setupGameButtons();
  setupMatchControls(deps);
  setupSuggestionButton();
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchToTab(tab.dataset.tab));
    // Keyboard navigation for tabs
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        switchToTab(tab.dataset.tab);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const tabs = Array.from(document.querySelectorAll('.tab'));
        const currentIndex = tabs.indexOf(tab);
        const nextIndex = e.key === 'ArrowRight'
          ? (currentIndex + 1) % tabs.length
          : (currentIndex - 1 + tabs.length) % tabs.length;
        tabs[nextIndex].focus();
        switchToTab(tabs[nextIndex].dataset.tab);
      }
    });
  });

  document.querySelectorAll('.tab-link').forEach(link => {
    link.addEventListener('click', () => switchToTab(link.dataset.tab));
  });
}

export function switchToTab(tabId) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(t => {
    const isActive = t.dataset.tab === tabId;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    t.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  // Update tab panels
  document.querySelectorAll('.tab-pane').forEach(p => {
    const isActive = p.id === tabId;
    p.classList.toggle('active', isActive);
    p.style.display = isActive ? 'block' : 'none';
  });

  // Focus the active panel for screen readers
  const pane = document.getElementById(tabId);
  if (pane) {
    pane.focus();
  }
}

function setupGameButtons() {
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (state.moveHistory.length > 0) {
      showConfirmationDialog(
        'Start New Game?',
        'Current game progress will be lost. Are you sure you want to continue?',
        () => {
          resetGame();
          toast.info('New game started');
        }
      );
    } else {
      resetGame();
    }
  });
  document.getElementById('undo-btn').addEventListener('click', () => {
    undoMove();
    if (state.moveHistory.length >= 0) {
      toast.info('Move undone');
    }
  });

  const flipBoardBtn = document.getElementById('flip-board-btn');
  if (flipBoardBtn) {
    flipBoardBtn.addEventListener('click', toggleBoardFlip);
  }

  // Keyboard help modal
  const keyboardHelpBtn = document.getElementById('keyboard-help-btn');
  const keyboardHelpModal = document.getElementById('keyboard-help-modal');
  const closeKeyboardHelp = document.getElementById('close-keyboard-help');
  const closeKeyboardHelpBtn = document.getElementById('close-keyboard-help-btn');

  function showKeyboardHelp() {
    keyboardHelpModal.style.display = 'flex';
    closeKeyboardHelp.focus();
  }

  function hideKeyboardHelp() {
    keyboardHelpModal.style.display = 'none';
    keyboardHelpBtn.focus();
  }

  keyboardHelpBtn.addEventListener('click', showKeyboardHelp);
  closeKeyboardHelp.addEventListener('click', hideKeyboardHelp);
  closeKeyboardHelpBtn.addEventListener('click', hideKeyboardHelp);

  // Close on backdrop click
  keyboardHelpModal.addEventListener('click', (e) => {
    if (e.target === keyboardHelpModal) {
      hideKeyboardHelp();
    }
  });

  // Close on Escape key
  keyboardHelpModal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      hideKeyboardHelp();
    }
  });

  // Trap focus within modal
  keyboardHelpModal.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const focusableElements = keyboardHelpModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  });
}

function setupMatchControls(deps) {
  const { startBotMatch, togglePauseMatch } = deps;
  document.getElementById('start-match').addEventListener('click', startBotMatch);
  document.getElementById('pause-match').addEventListener('click', togglePauseMatch);

  document.getElementById('match-speed').addEventListener('input', (e) => {
    document.getElementById('speed-label').textContent = `${e.target.value}ms`;
  });
}

function setupSuggestionButton() {
  document.getElementById('play-suggestion').addEventListener('click', () => {
    if (state.suggestedMove) {
      try {
        state.game.makeMove(state.suggestedMove);
        state.moveHistory.push(state.suggestedMove);
        state.lastMove = state.suggestedMove;
        state.selectedSquare = null;
        state.legalMoves = [];
        state.suggestedMove = null;
        renderBoard();
        updateUI();
        checkBotTurn();
      } catch (e) {
        addLogEntry(`Illegal move: ${state.suggestedMove}`);
      }
    }
  });
}

function undoMove() {
  if (state.moveHistory.length === 0) return;
  state.gameGeneration++;
  stopBotMatch();
  dismissPromotionModal();
  const movesToReplay = state.moveHistory.slice(0, -1);
  state.game.reset();
  state.moveHistory = [];
  state.lastMove = null;
  for (const move of movesToReplay) {
    state.game.makeMove(move);
    state.moveHistory.push(move);
    state.lastMove = move;
  }
  state.selectedSquare = null;
  state.legalMoves = [];
  state.suggestedMove = null;
  renderBoard();
  updateUI();
  document.getElementById('suggested-move').style.display = 'none';
}

function resetGame() {
  // Add this check at the very beginning
  if (!state.game) {
    console.warn('Game not initialized yet');
    return;
  }

  state.gameGeneration++;
  stopBotMatch();
  dismissPromotionModal();
  state.game.reset();
  state.selectedSquare = null;
  state.legalMoves = [];
  state.moveHistory = [];
  state.lastMove = null;
  state.suggestedMove = null;
  state.matchPaused = false;

  // Restore bot log empty state
  document.getElementById('log-content').innerHTML = `
    <div class="empty-state">
      <svg class="empty-state-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <defs>
          <linearGradient id="empty-state-bot-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6f42c1;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#3498db;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="url(#empty-state-bot-gradient)"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="url(#empty-state-bot-gradient)"></path>
        <circle cx="9" cy="16" r="1" fill="url(#empty-state-bot-gradient)"></circle>
        <circle cx="15" cy="16" r="1" fill="url(#empty-state-bot-gradient)"></circle>
      </svg>
      <p class="empty-state-title">No bot activity yet</p>
      <p class="empty-state-hint">Select a bot from the dropdowns above to see logs</p>
    </div>
  `;

  document.getElementById('python-feedback').style.display = 'none';
  document.getElementById('suggested-move').style.display = 'none';
  renderBoard();
  updateUI();
}

// Confirmation Dialog
function showConfirmationDialog(title, message, onConfirm) {
  const dialog = document.createElement('div');
  dialog.className = 'confirmation-dialog';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-labelledby', 'confirmation-title');
  dialog.setAttribute('aria-describedby', 'confirmation-message');

  dialog.innerHTML = `
    <div class="confirmation-content">
      <div class="confirmation-header">
        <svg class="confirmation-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <h3 id="confirmation-title" class="confirmation-title">${title}</h3>
      </div>
      <p id="confirmation-message" class="confirmation-message">${message}</p>
      <div class="confirmation-actions">
        <button class="confirmation-cancel" id="confirmation-cancel">Cancel</button>
        <button class="confirmation-confirm" id="confirmation-confirm">Continue</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const closeDialog = () => {
    dialog.classList.remove('show');
    setTimeout(() => dialog.remove(), 200);
  };

  const cancelBtn = dialog.querySelector('#confirmation-cancel');
  const confirmBtn = dialog.querySelector('#confirmation-confirm');

  cancelBtn.addEventListener('click', closeDialog);
  confirmBtn.addEventListener('click', () => {
    closeDialog();
    onConfirm();
  });

  // Close on backdrop click
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      closeDialog();
    }
  });

  // Close on Escape key
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDialog();
    }
  });

  // Show dialog
  requestAnimationFrame(() => {
    dialog.classList.add('show');
    confirmBtn.focus();
  });
}

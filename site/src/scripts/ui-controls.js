// Tab switching, game controls (undo/reset), match controls, and suggestion UI.

let state = null;
let addLogEntry = null;
let renderBoard = null;
let updateUI = null;
let stopBotMatch = null;
let checkBotTurn = null;
let dismissPromotionModal = null;

export function init(deps) {
  state = deps.state;
  addLogEntry = deps.addLogEntry;
  renderBoard = deps.renderBoard;
  updateUI = deps.updateUI;
  stopBotMatch = deps.stopBotMatch;
  checkBotTurn = deps.checkBotTurn;
  dismissPromotionModal = deps.dismissPromotionModal;

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
    if (state.moveHistory.length > 0 && !confirm('Start a new game? Current progress will be lost.')) return;
    resetGame();
  });
  document.getElementById('undo-btn').addEventListener('click', undoMove);
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
      <svg class="empty-state-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
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

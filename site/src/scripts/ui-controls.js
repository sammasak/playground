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
  });

  document.querySelectorAll('.tab-link').forEach(link => {
    link.addEventListener('click', () => switchToTab(link.dataset.tab));
  });
}

export function switchToTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });
  const tabBtn = document.querySelector(`.tab[data-tab="${tabId}"]`);
  if (tabBtn) tabBtn.classList.add('active');
  const pane = document.getElementById(tabId);
  if (pane) {
    pane.classList.add('active');
    pane.style.display = 'block';
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
  document.getElementById('log-content').innerHTML = '';
  document.getElementById('python-feedback').style.display = 'none';
  document.getElementById('suggested-move').style.display = 'none';
  renderBoard();
  updateUI();
}

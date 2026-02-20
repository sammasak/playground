// Board rendering, click handling, move highlighting, and promotion modal.

const PIECE_UNICODE = {
  white: { king: '\u2654', queen: '\u2655', rook: '\u2656', bishop: '\u2657', knight: '\u2658', pawn: '\u2659' },
  black: { king: '\u265A', queen: '\u265B', rook: '\u265C', bishop: '\u265D', knight: '\u265E', pawn: '\u265F' }
};

let state = null;
let addLogEntry = null;
let onMoveCallback = null;

function squareToIndex(sq) {
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1]) - 1;
  return rank * 8 + file;
}

function indexToSquare(idx) {
  const file = String.fromCharCode(97 + (idx % 8));
  const rank = Math.floor(idx / 8) + 1;
  return `${file}${rank}`;
}

export function init(deps) {
  state = deps.state;
  addLogEntry = deps.addLogEntry;
  onMoveCallback = deps.onMove;
}

export function renderBoard() {
  const board = document.getElementById('chess-board');
  board.innerHTML = '';

  const boardState = state.game.getBoardState();
  const isCheck = state.game.isCheck();
  const turn = state.game.getTurn();

  for (let rank = 7; rank >= 0; rank--) {
    for (let file = 0; file < 8; file++) {
      const idx = rank * 8 + file;
      const sq = indexToSquare(idx);
      const piece = boardState.squares[idx];

      const div = document.createElement('div');
      div.className = `square ${(file + rank) % 2 === 0 ? 'dark' : 'light'}`;
      div.dataset.square = sq;
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');

      const pieceName = piece ? `${piece.color} ${piece.pieceType}` : 'empty';
      div.setAttribute('aria-label', `${sq}, ${pieceName}`);

      if (piece) {
        div.textContent = PIECE_UNICODE[piece.color][piece.pieceType];
        if (piece.pieceType === 'king' && piece.color === turn && isCheck) {
          div.classList.add('check');
        }
      }

      if (state.selectedSquare === sq) div.classList.add('selected');

      const isLegalMove = state.legalMoves.some(m => m.slice(2, 4) === sq);
      if (isLegalMove) {
        div.classList.add(piece ? 'legal-capture' : 'legal-move');
      }

      if (state.lastMove && (sq === state.lastMove.slice(0, 2) || sq === state.lastMove.slice(2, 4))) {
        div.classList.add('last-move');
      }

      if (state.suggestedMove && (sq === state.suggestedMove.slice(0, 2) || sq === state.suggestedMove.slice(2, 4))) {
        div.classList.add('suggested');
      }

      div.addEventListener('click', () => handleSquareClick(sq));
      div.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSquareClick(sq);
        }
      });
      board.appendChild(div);
    }
  }
}

function handleSquareClick(sq) {
  const turn = state.game.getTurn();

  const bot = turn === 'white' ? state.bots.white : state.bots.black;
  const mode = turn === 'white' ? state.botModes.white : state.botModes.black;
  if (bot && mode === 'auto') return;

  const boardState = state.game.getBoardState();
  const idx = squareToIndex(sq);
  const piece = boardState.squares[idx];

  if (state.selectedSquare) {
    const moveUci = state.selectedSquare + sq;
    const isLegal = state.legalMoves.some(m => m.startsWith(moveUci));

    if (isLegal) {
      const fromIdx = squareToIndex(state.selectedSquare);
      const fromPiece = boardState.squares[fromIdx];
      const toRank = parseInt(sq[1]);

      if (fromPiece && fromPiece.pieceType === 'pawn' &&
          ((turn === 'white' && toRank === 8) || (turn === 'black' && toRank === 1))) {
        showPromotionModal(state.selectedSquare, sq);
        return;
      }

      makeMove(moveUci);
      return;
    }
  }

  if (piece && piece.color === turn && sq !== state.selectedSquare) {
    state.selectedSquare = sq;
    state.legalMoves = state.game.getLegalMoves().filter(m => m.startsWith(sq));
  } else {
    state.selectedSquare = null;
    state.legalMoves = [];
  }

  renderBoard();
}

export function dismissPromotionModal() {
  document.querySelector('.promotion-modal')?.remove();
}

function showPromotionModal(from, to) {
  dismissPromotionModal();
  const turn = state.game.getTurn();

  const modal = document.createElement('div');
  modal.className = 'promotion-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'Choose promotion piece');
  modal.innerHTML = `
    <div class="promotion-choices">
      <div class="promotion-choice" data-piece="q" role="button" tabindex="0" aria-label="Promote to Queen">${PIECE_UNICODE[turn].queen}</div>
      <div class="promotion-choice" data-piece="r" role="button" tabindex="0" aria-label="Promote to Rook">${PIECE_UNICODE[turn].rook}</div>
      <div class="promotion-choice" data-piece="b" role="button" tabindex="0" aria-label="Promote to Bishop">${PIECE_UNICODE[turn].bishop}</div>
      <div class="promotion-choice" data-piece="n" role="button" tabindex="0" aria-label="Promote to Knight">${PIECE_UNICODE[turn].knight}</div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) dismissPromotionModal();
  });

  modal.querySelectorAll('.promotion-choice').forEach(choice => {
    const handler = () => {
      makeMove(`${from}${to}${choice.dataset.piece}`);
      dismissPromotionModal();
    };
    choice.addEventListener('click', handler);
    choice.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });
  });

  requestAnimationFrame(() => {
    modal.querySelector('.promotion-choice')?.focus();
  });

  document.body.appendChild(modal);
}

function makeMove(uci) {
  try {
    state.game.makeMove(uci);
    state.moveHistory.push(uci);
    state.lastMove = uci;
    state.selectedSquare = null;
    state.legalMoves = [];
    state.suggestedMove = null;
    renderBoard();
    onMoveCallback();
  } catch (e) {
    addLogEntry(`Illegal move: ${uci}`);
  }
}

export function updateUI() {
  const turn = state.game.getTurn();
  const gameResult = state.game.getGameResult();
  const isCheck = state.game.isCheck();

  const turnIndicator = document.getElementById('turn-indicator');
  turnIndicator.textContent = `${turn === 'white' ? 'White' : 'Black'} to move`;

  const gameStatus = document.getElementById('game-status');
  gameStatus.classList.remove('game-over');
  if (gameResult === 'checkmate') {
    const winner = turn === 'white' ? 'Black' : 'White';
    gameStatus.textContent = `Checkmate! ${winner} wins!`;
    gameStatus.classList.add('game-over');
    turnIndicator.textContent = '';
  } else if (gameResult === 'stalemate') {
    gameStatus.textContent = 'Stalemate! Draw.';
    gameStatus.classList.add('game-over');
    turnIndicator.textContent = '';
  } else if (gameResult === 'draw') {
    gameStatus.textContent = 'Draw!';
    gameStatus.classList.add('game-over');
    turnIndicator.textContent = '';
  } else if (gameResult === 'in-progress' && isCheck) {
    gameStatus.textContent = 'Check!';
  } else {
    gameStatus.textContent = '';
  }

  const movesList = document.getElementById('moves-list');
  movesList.innerHTML = '';

  if (state.moveHistory.length === 0) {
    // Show empty state
    movesList.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <defs>
            <linearGradient id="empty-state-chess-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#6f42c1;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#3498db;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="url(#empty-state-chess-gradient)"></rect>
          <line x1="3" y1="7.5" x2="21" y2="7.5" stroke="url(#empty-state-chess-gradient)"></line>
          <line x1="3" y1="12" x2="21" y2="12" stroke="url(#empty-state-chess-gradient)"></line>
          <line x1="3" y1="16.5" x2="21" y2="16.5" stroke="url(#empty-state-chess-gradient)"></line>
          <line x1="7.5" y1="3" x2="7.5" y2="21" stroke="url(#empty-state-chess-gradient)"></line>
          <line x1="12" y1="3" x2="12" y2="21" stroke="url(#empty-state-chess-gradient)"></line>
          <line x1="16.5" y1="3" x2="16.5" y2="21" stroke="url(#empty-state-chess-gradient)"></line>
        </svg>
        <p class="empty-state-title">No moves recorded</p>
        <p class="empty-state-hint">Click on a piece to make your first move</p>
      </div>
    `;
  } else {
    state.moveHistory.forEach((move, i) => {
      const entry = document.createElement('span');
      entry.className = 'move-entry';
      entry.textContent = `${Math.floor(i / 2) + 1}${i % 2 === 0 ? '.' : '...'} ${move}`;
      movesList.appendChild(entry);
    });
  }

  document.getElementById('undo-btn').disabled = state.moveHistory.length === 0;
}

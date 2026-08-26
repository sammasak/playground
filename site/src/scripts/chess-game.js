// Entry point: imports modules, creates shared state, and wires everything together.

import { loadChessEngine, loadMonty, getMontyClass } from './engine.js';
import { initEditor, setupPythonEditorButtons } from './python-editor.js';
import * as boardUI from './board-ui.js';
import * as botManager from './bot-manager.js';
import * as uiControls from './ui-controls.js';
import { toast, createErrorBoundary } from './toast.js';
import {
  generateReply,
  preloadLLM,
  isLLMReady,
  getLLMStatusText,
  resetConversation,
} from './llm.js';
import {
  PERSONALITIES,
  DEFAULT_PERSONALITY,
  PERSONALITY_STORAGE_KEY,
} from './personalities.js';

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

// --- Personality chat ---

// The currently selected personality key. Restored from localStorage below.
let currentPersonality = DEFAULT_PERSONALITY;

/**
 * Return the currently selected personality key (a key of PERSONALITIES).
 */
function getPersonality() {
  return PERSONALITIES[currentPersonality] ? currentPersonality : DEFAULT_PERSONALITY;
}

/**
 * Append a message to the chat panel. Mirrors addLogEntry.
 * @param {string} text - the message.
 * @param {{personality?: string, role?: 'bot'|'user'}} [opts] - render options.
 *        role 'user' renders the human's line ("You"); 'bot' (default) renders
 *        the selected personality's line.
 */
function addChatMessage(text, opts = {}) {
  const chatContent = document.getElementById('chat-content');
  if (!chatContent || !text) return;

  const emptyState = chatContent.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const isUser = opts.role === 'user';
  const label = isUser
    ? 'You'
    : PERSONALITIES[PERSONALITIES[opts.personality] ? opts.personality : getPersonality()].label;

  const entry = document.createElement('div');
  entry.className = isUser ? 'chat-entry chat-user' : 'chat-entry';

  const persona = document.createElement('span');
  persona.className = 'chat-persona';
  persona.textContent = `${label}:`;

  const quip = document.createElement('span');
  quip.className = 'chat-quip';
  quip.textContent = text;

  entry.appendChild(persona);
  entry.appendChild(quip);
  chatContent.appendChild(entry);
  chatContent.scrollTop = chatContent.scrollHeight;
}

// --- LLM status line (neutral, NOT in character) --------------------------
// A subtle status line in the chat panel used only for warming-up / offline
// messages. It is NEVER an in-character quip. Deduped so we don't spam it.
let lastStatusShown = null;
function showLLMStatus() {
  try {
    const chat = document.getElementById('chat-content');
    if (!chat) return;
    const text = getLLMStatusText();
    let el = document.getElementById('llm-status');
    if (!text) {
      if (el) el.remove();
      lastStatusShown = null;
      return;
    }
    if (text === lastStatusShown && el) return;
    lastStatusShown = text;

    const emptyState = chat.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    if (!el) {
      el = document.createElement('div');
      el.id = 'llm-status';
      el.className = 'chat-status';
      chat.appendChild(el);
    }
    el.textContent = text;
    chat.scrollTop = chat.scrollHeight;
  } catch (e) {
    // Status UI is best-effort only.
  }
}

// Append a one-off neutral status line to the transcript (NOT in character).
// Used for warming-up / error notices that aren't LLM output.
function addChatStatus(text) {
  try {
    const chat = document.getElementById('chat-content');
    if (!chat || !text) return;
    const emptyState = chat.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    const el = document.createElement('div');
    el.className = 'chat-status';
    el.textContent = text;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
  } catch (e) {
    // best-effort
  }
}

// Poll the warming-up status until the model is ready (or offline), so the
// panel reflects download progress without any in-character faking.
let statusPoll = null;
function startStatusPolling() {
  if (statusPoll) return;
  showLLMStatus();
  statusPoll = setInterval(() => {
    showLLMStatus();
    if (isLLMReady() || getLLMStatusText() === null) {
      // Ready: clear the warming-up line so it doesn't linger.
      const el = document.getElementById('llm-status');
      if (el && isLLMReady()) el.remove();
      clearInterval(statusPoll);
      statusPoll = null;
    }
  }, 1500);
}

// --- Board context for the LLM --------------------------------------------
// Gather the last few moves (as UCI) and the current FEN from the game.
function getChatContext() {
  const ctx = { moves: [], fen: null };
  try {
    if (!state.game) return ctx;
    ctx.fen = state.game.getFen();
    const history = state.game.getMoveHistory() || [];
    ctx.moves = history.slice(-4).map((h) => h.uciMove || h.uci || '');
  } catch (e) {
    // Best-effort context only.
  }
  return ctx;
}

/**
 * Handle a capture event: generate a real LLM quip from board context and
 * render it. Fire-and-forget — never blocks the move/animation, never throws.
 * If the model isn't ready yet we SKIP the quip (showing the neutral warming-up
 * status once) rather than emit any canned phrase.
 * @param {{type: 'capture', attacker: object, victim: object, byBot: boolean}} event
 */
function announceCapture(event) {
  try {
    const personality = getPersonality();
    if (!isLLMReady()) {
      // Don't fake it — just surface the warming-up status.
      startStatusPolling();
      return;
    }
    const { moves, fen } = getChatContext();
    generateReply({ personality, moves, fen, capture: event })
      .then((quip) => {
        // A null/empty reply means the model isn't ready OR the reply was junk
        // that trimming suppressed. Either way, don't emit a canned phrase —
        // stay silent on the capture-banter path.
        if (quip) addChatMessage(quip, { personality });
      })
      .catch((err) => {
        console.warn('Quip generation failed:', err);
      });
  } catch (err) {
    console.warn('announceCapture failed:', err);
  }
}

// --- Chat input (user -> bot) ---------------------------------------------
// The input is NEVER disabled while a reply generates — the worker already
// serializes generations, so the user can keep typing / queue more messages.
// Each in-flight generation appends its own ephemeral "<persona> is typing…"
// line with a unique id so we can remove exactly the right one when it
// resolves (or errors). This replaces the old blocking send-button spinner.

let typingSeq = 0;

/**
 * Append an ephemeral "<label> is typing…" indicator and return its id.
 * The caller removes it via removeTypingIndicator(id) once the reply resolves.
 */
function addTypingIndicator(personality) {
  const chatContent = document.getElementById('chat-content');
  if (!chatContent) return null;

  const emptyState = chatContent.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const key = PERSONALITIES[personality] ? personality : getPersonality();
  const label = PERSONALITIES[key].label;

  const id = `chat-typing-${++typingSeq}`;
  const entry = document.createElement('div');
  entry.className = 'chat-entry chat-typing';
  entry.id = id;
  entry.setAttribute('aria-live', 'polite');

  const persona = document.createElement('span');
  persona.className = 'chat-persona';
  persona.textContent = `${label}:`;

  const quip = document.createElement('span');
  quip.className = 'chat-quip';
  // Static text + an animated ellipsis span (CSS drives the dots).
  quip.textContent = 'is typing';
  const dots = document.createElement('span');
  dots.className = 'chat-typing-dots';
  dots.setAttribute('aria-hidden', 'true');
  quip.appendChild(dots);

  entry.appendChild(persona);
  entry.appendChild(quip);
  chatContent.appendChild(entry);
  chatContent.scrollTop = chatContent.scrollHeight;
  return id;
}

/** Remove a previously added typing indicator by id (safe if already gone). */
function removeTypingIndicator(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

function handleChatSubmit() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const message = (input.value || '').trim();
  if (!message) return;

  const personality = getPersonality();

  // Render the user's line immediately and clear the input. The input stays
  // enabled so the user can keep typing / queue further messages.
  addChatMessage(message, { role: 'user' });
  input.value = '';

  // If the model isn't ready, surface the neutral warming-up status (NOT an
  // in-character line) and ask the user to retry — never fake a reply.
  if (!isLLMReady()) {
    startStatusPolling();
    addChatStatus('🧠 Bot is warming up — ask again once it\'s ready.');
    return;
  }

  // Non-blocking: show a typing indicator for THIS request, then generate.
  // The worker serializes generations, so multiple queued messages each get
  // their own typing line and resolve in order.
  const typingId = addTypingIndicator(personality);
  const { moves, fen } = getChatContext();
  generateReply({ personality, moves, fen, userMessage: message })
    .then((reply) => {
      removeTypingIndicator(typingId);
      if (reply) {
        addChatMessage(reply, { personality });
      } else {
        // Empty/null reply: the model wasn't ready OR the raw output was junk
        // that trimming suppressed. Show a subtle NEUTRAL status line — never a
        // hardcoded in-character phrase.
        addChatStatus('🤔 (the bot mumbled something unintelligible)');
      }
    })
    .catch((err) => {
      console.warn('Chat reply failed:', err);
      removeTypingIndicator(typingId);
      addChatStatus('🧠 The bot went quiet (generation error).');
    });
}

function setupChatInput() {
  const form = document.getElementById('chat-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleChatSubmit();
  });
}

function setupPersonalitySelector() {
  const select = document.getElementById('personality-select');
  if (!select) return;

  // Rebuild options from PERSONALITIES so the selector stays a single source
  // of truth even if the markup drifts.
  select.innerHTML = '';
  for (const [key, { label }] of Object.entries(PERSONALITIES)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = label;
    select.appendChild(opt);
  }

  // Restore persisted choice.
  let stored = null;
  try {
    stored = localStorage.getItem(PERSONALITY_STORAGE_KEY);
  } catch (e) {
    // localStorage may be unavailable (private mode); degrade gracefully.
  }
  currentPersonality = PERSONALITIES[stored] ? stored : DEFAULT_PERSONALITY;
  select.value = currentPersonality;

  select.addEventListener('change', (e) => {
    const value = e.target.value;
    currentPersonality = PERSONALITIES[value] ? value : DEFAULT_PERSONALITY;
    try {
      localStorage.setItem(PERSONALITY_STORAGE_KEY, currentPersonality);
    } catch (err) {
      // Ignore storage errors.
    }
    // Start a FRESH conversation with the new persona: the KV cache is reset so
    // the personality actually changes (prior turns are forgotten).
    try {
      resetConversation(currentPersonality);
      addChatStatus(`— switched to ${PERSONALITIES[currentPersonality].label} —`);
    } catch (err) {
      // Best-effort — never break the selector on an LLM hiccup.
    }
  });
}

initEditor();
setupPersonalitySelector();
setupChatInput();

// Seed the conversation with the restored personality so the very first message
// runs against the right persona (lazy: applied once the model is ready).
try {
  resetConversation(getPersonality());
} catch (e) {
  // Best-effort.
}

boardUI.init({
  state,
  addLogEntry,
  announceCapture,
  onMove: () => {
    boardUI.updateUI();
    botManager.checkBotTurn();
  },
});

botManager.init({
  state,
  base,
  addLogEntry,
  announceCapture,
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
  // On New Game / board reset, start a fresh conversation (fresh game context)
  // with the currently selected persona.
  resetConversation: () => {
    try {
      resetConversation(getPersonality());
    } catch (e) {
      // Best-effort — never break the reset flow on an LLM hiccup.
    }
  },
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
// OLD UPLOAD SYSTEM - REMOVED (conflicts with new upload-handler.js)
// botManager.setupBotUpload();
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

// Pre-warm the on-device LLM so quips arrive ASAP. Fully async and decoupled
// from gameplay — no-ops in force-mock mode (?llm=mock).
preloadLLM();

initGame();

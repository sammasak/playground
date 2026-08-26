// JS interop glue for the egui chess app.
//
// The egui/Rust core owns the game (native chess-engine). This module provides
// the three JS-runtime features the Rust core can't do natively, exposed on
// `window.__chessGlue` and called from Rust via wasm-bindgen:
//
//   1. Monty Python bot runtime  — run a user's Python bot (get_board/…/log).
//   2. Uploaded Component-Model .wasm bots — jco transpile + host shim.
//   3. On-device BitNet "bot banter" LLM — a Web-Worker chat session.
//
// Rust hands us plain data (FEN, legal-move list, is-check) so we never need a
// JS chess engine; the Monty `_board` object is derived from the FEN here.

const BASE = (() => {
  // Assets (monty/, bitnet/, bots/) live one level up from egui/.
  const p = window.location.pathname;
  const dir = p.endsWith('/') ? p : p.slice(0, p.lastIndexOf('/') + 1);
  // egui app is served from ".../egui/"; assets are the parent dir.
  return dir.replace(/egui\/?$/, '');
})();

// ---------------------------------------------------------------------------
// jco transpile is imported statically so esbuild bundles it into glue.js
// (dynamic import of a bare specifier would stay unresolved at runtime).
import { transpile } from '@bytecodealliance/jco/component';

// FEN -> Python board object (mirrors python-editor.js getPythonInputs()).
// ---------------------------------------------------------------------------
const PT = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

function fenToBoard(fen) {
  const [placement, turnField, castleField, epField, halfStr, fullStr] = fen.split(' ');
  const squares = new Array(64).fill(null);
  const ranks = placement.split('/'); // rank 8 first
  for (let r = 0; r < 8; r++) {
    const rankStr = ranks[r];
    let file = 0;
    for (const ch of rankStr) {
      if (/\d/.test(ch)) {
        file += parseInt(ch, 10);
      } else {
        const boardRank = 7 - r; // FEN top row is rank 8 (index 7)
        const idx = boardRank * 8 + file;
        const isWhite = ch === ch.toUpperCase();
        squares[idx] = { pieceType: PT[ch.toLowerCase()], color: isWhite ? 'white' : 'black' };
        file += 1;
      }
    }
  }
  let ep = null;
  if (epField && epField !== '-') {
    ep = (parseInt(epField[1], 10) - 1) * 8 + (epField.charCodeAt(0) - 97);
  }
  const has = (c) => (castleField || '').includes(c);
  return {
    squares,
    turn: turnField === 'w' ? 'white' : 'black',
    castling_rights: {
      white_kingside: has('K'),
      white_queenside: has('Q'),
      black_kingside: has('k'),
      black_queenside: has('q'),
    },
    en_passant: ep,
    halfmove_clock: parseInt(halfStr || '0', 10),
    fullmove_number: parseInt(fullStr || '1', 10),
    move_history: [],
  };
}

// ---------------------------------------------------------------------------
// 1. Monty Python runtime.
// ---------------------------------------------------------------------------
let montyLoaded = false;
let MontyClass = null;

const PYTHON_INPUT_NAMES = ['_board', '_legal_moves', '_is_check', '_fen', '_seed'];
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

async function loadMonty() {
  if (montyLoaded) return;
  const module = await import(`${BASE}monty/monty_wasm.js`);
  await module.default(`${BASE}monty/monty_wasm_bg.wasm`);
  MontyClass = module.Monty;
  montyLoaded = true;
}

// Run a Python bot method. `inputsJson` is a JSON string built in Rust:
//   { fen, legalMoves: [...], isCheck: bool }
// Returns a JSON string: { ok, value, logs: [...], error }.
async function pythonRun(code, method, inputsJson) {
  try {
    await loadMonty();
  } catch (e) {
    return JSON.stringify({ ok: false, error: `Python runtime failed to load: ${e}`, logs: [] });
  }
  let parsed;
  try {
    parsed = JSON.parse(inputsJson);
  } catch (e) {
    return JSON.stringify({ ok: false, error: 'bad inputs', logs: [] });
  }
  const inputs = {
    _legal_moves: parsed.legalMoves || [],
    _board: fenToBoard(parsed.fen),
    _is_check: !!parsed.isCheck,
    _fen: parsed.fen,
    _seed: Math.floor(Math.random() * 2147483647),
  };

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
    const out = JSON.parse(result);
    return JSON.stringify({ ok: true, value: out[0], logs: out[1] || [] });
  } catch (err) {
    const errorMsg = String(err);
    const lineMatch = errorMsg.match(/line (\d+)/);
    let friendly = errorMsg;
    if (lineMatch) {
      const userLine = parseInt(lineMatch[1], 10) - shimLines + 1;
      if (userLine > 0) friendly = `Python error at line ${userLine}: ${errorMsg.split(':').pop()?.trim() || errorMsg}`;
    }
    return JSON.stringify({ ok: false, error: friendly, logs: [] });
  }
}

// ---------------------------------------------------------------------------
// 2. Uploaded Component-Model .wasm bots (jco transpile + host shim).
// ---------------------------------------------------------------------------
// The Rust core keeps the current game; before every bot call it pushes a fresh
// snapshot here so the WIT host functions answer from the live position.
const uploadSnapshot = { fen: '', legalMoves: [], isCheck: false, gameResult: 'in-progress' };
const uploadLogs = [];
const uploadedBots = new Map(); // id -> { name, description, botExport }
let uploadSeq = 0;
const activeBlobUrls = new Set();

function makeHost() {
  return {
    getBoard: () => fenToBoard(uploadSnapshot.fen),
    getLegalMoves: () => uploadSnapshot.legalMoves.slice(),
    isCheck: () => !!uploadSnapshot.isCheck,
    getGameResult: () => uploadSnapshot.gameResult,
    getFen: () => uploadSnapshot.fen,
    log: (msg) => uploadLogs.push(String(msg)),
  };
}

// Transpile + instantiate an uploaded component. `bytes` is a Uint8Array.
// Returns { ok, id, name, description, error }.
async function uploadBot(bytes, filename) {
  try {
    if (bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
      throw new Error('Invalid file format. Please upload a valid .wasm component file.');
    }
    const name0 = (filename || 'bot').replace(/\.wasm$/, '');
    const { files } = await transpile(bytes, {
      name: name0.replace(/\s+/g, '-'),
      instantiation: { tag: 'async' },
      map: [['chess:bot/host', './bot-host.js']],
      noNodejsCompat: true,
      base64Cutoff: 0,
      tlaCompat: true,
    });

    let mainJsUrl = null;
    for (const [fn, content] of files) {
      const isJs = fn.endsWith('.js');
      const blob = new Blob([content], { type: isJs ? 'text/javascript' : 'application/wasm' });
      const url = URL.createObjectURL(blob);
      activeBlobUrls.add(url);
      if (isJs && !mainJsUrl) mainJsUrl = url;
    }
    if (!mainJsUrl) throw new Error('Transpilation produced no JS output');

    const mod = await import(/* @vite-ignore */ mainJsUrl);
    const wasmLookup = {};
    for (const [fn, content] of files) {
      if (fn.endsWith('.wasm')) wasmLookup['./' + fn] = content;
    }
    const getCoreModule = (path) => {
      const content = wasmLookup[path];
      if (content) return WebAssembly.compile(content);
      throw new Error(`WASM module not found: ${path}`);
    };
    const instance = await mod.instantiate(getCoreModule, { 'chess:bot/host': makeHost() });
    const botExport = instance.bot || instance['chess:bot/bot@0.1.0'];
    if (!botExport) throw new Error('Invalid bot component. Must implement chess:bot@0.1.0 interface');
    for (const m of ['getName', 'getDescription', 'selectMove', 'suggestMove', 'onGameStart']) {
      if (typeof botExport[m] !== 'function') throw new Error(`Invalid bot component. Missing required method: ${m}`);
    }
    const id = `custom-bot-${++uploadSeq}`;
    let name = name0;
    let description = 'Custom bot';
    try { name = botExport.getName() || name; } catch (e) {}
    try { description = botExport.getDescription() || description; } catch (e) {}
    uploadedBots.set(id, { name, description, botExport });
    return JSON.stringify({ ok: true, id, name, description });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message || String(err) });
  }
}

// Call an uploaded bot method with the current snapshot. Returns
// { ok, value, logs, error }.
function uploadCall(id, method, snapshotJson) {
  const rec = uploadedBots.get(id);
  if (!rec) return JSON.stringify({ ok: false, error: 'bot not found', logs: [] });
  try {
    const snap = JSON.parse(snapshotJson);
    uploadSnapshot.fen = snap.fen;
    uploadSnapshot.legalMoves = snap.legalMoves || [];
    uploadSnapshot.isCheck = !!snap.isCheck;
    uploadSnapshot.gameResult = snap.gameResult || 'in-progress';
    uploadLogs.length = 0;
    const value = rec.botExport[method]();
    return JSON.stringify({ ok: true, value, logs: uploadLogs.slice() });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message || String(err), logs: uploadLogs.slice() });
  }
}

function uploadRemove(id) {
  uploadedBots.delete(id);
}

// ---------------------------------------------------------------------------
// 3. On-device BitNet LLM "bot banter" (reuses the published llm-worker.js).
// ---------------------------------------------------------------------------
const PERSONALITIES = {
  sassy: 'You are a cocky, sassy chess trash-talker who taunts your opponent playfully.',
  aggressive: 'You are a ruthless, intimidating chess rival who talks big.',
  kind: 'You are a warm, encouraging chess buddy who chats kindly.',
  nervous: 'You are an anxious, rambling chess player who second-guesses everything.',
  philosophical: 'You are a dramatic chess philosopher musing on fate.',
};
const DEFAULT_PERSONALITY = 'sassy';
const MAX_TOKENS = 36;
const SAMPLING = { temperature: 0.5, topK: 40, topP: 0.9, repeatPenalty: 1.3 };
const MOCK_REPLY = '[mock reply]';

function forceMock() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('llm') === 'mock' || params.get('mock') === '1') return true;
  } catch (e) { return true; }
  return false;
}

function buildSystemPrompt(key) {
  const persona = PERSONALITIES[key] || PERSONALITIES[DEFAULT_PERSONALITY];
  return `${persona} You are chatting during a chess game. Reply with ONE short, ` +
    `in-character sentence of banter. Do not give real chess analysis or move lists.`;
}

const llm = {
  worker: null, ready: false, loadStarted: false, loadFailed: false,
  nextId: 1, pending: new Map(),
  activeSystem: null, pendingSystem: buildSystemPrompt(DEFAULT_PERSONALITY),
  status: null, loaded: 0, total: 0,
};

function llmUpdateStatus() {
  if (llm.ready || llm.loadFailed) { llm.status = null; return; }
  if (llm.total > 0 && llm.loaded > 0) {
    const mb = Math.round(llm.loaded / 1e6), tot = Math.round(llm.total / 1e6);
    if (llm.loaded >= llm.total) llm.status = 'Loading the bot’s brain into memory…';
    else llm.status = `Downloading the bot’s brain… ${mb}/${tot} MB (${Math.min(99, Math.floor(llm.loaded / llm.total * 100))}%)`;
  } else {
    llm.status = 'Bot is warming up…';
  }
}

function llmEnsureConversation() {
  if (!llm.ready || !llm.worker) return;
  if (llm.pendingSystem === llm.activeSystem) return;
  llm.worker.postMessage({ type: 'chat_reset', system: llm.pendingSystem });
  llm.activeSystem = llm.pendingSystem;
}

function llmEnsureWorker() {
  if (llm.worker || llm.loadStarted) return;
  llm.loadStarted = true;
  try {
    llm.worker = new Worker(`${BASE}bitnet/llm-worker.js`, { type: 'module' });
  } catch (e) { llm.loadFailed = true; llmUpdateStatus(); return; }
  llm.status = 'Bot is warming up…';
  llm.worker.onmessage = (e) => {
    const msg = e.data || {};
    if (msg.type === 'progress') {
      llm.loaded = msg.loaded || llm.loaded;
      if (!llm.total && msg.total) llm.total = msg.total;
      llmUpdateStatus();
    } else if (msg.type === 'ready') {
      llm.ready = true; llmUpdateStatus(); llmEnsureConversation();
    } else if (msg.type === 'result') {
      const p = llm.pending.get(msg.id);
      if (p) { llm.pending.delete(msg.id); p(msg.text || ''); }
    } else if (msg.type === 'error') {
      if (msg.id != null) { const p = llm.pending.get(msg.id); if (p) { llm.pending.delete(msg.id); p(''); } }
      else { llm.loadFailed = true; llmUpdateStatus(); }
    }
  };
  llm.worker.onerror = () => { llm.loadFailed = true; llmUpdateStatus(); };
  (async () => {
    try {
      const resp = await fetch(`${BASE}bitnet/model/manifest.json`);
      const data = await resp.json();
      const chunks = Array.isArray(data.chunks) ? data.chunks : [];
      if (typeof data.bytes === 'number') llm.total = data.bytes;
      if (chunks.length === 0) { llm.loadFailed = true; llmUpdateStatus(); return; }
      llm.worker.postMessage({
        type: 'load',
        modelUrls: chunks.map((c) => `${BASE}bitnet/model/${c}`),
        totalBytes: llm.total,
        sizes: Array.isArray(data.sizes) ? data.sizes : null,
        wasmBindingsUrl: `${BASE}bitnet/bitnet_wasm.js`,
        wasmUrl: `${BASE}bitnet/bitnet_wasm_bg.wasm`,
      });
    } catch (e) { llm.loadFailed = true; llmUpdateStatus(); }
  })();
}

function llmPreload() { if (!forceMock()) llmEnsureWorker(); }

function llmReset(personality) {
  const key = PERSONALITIES[personality] ? personality : DEFAULT_PERSONALITY;
  llm.pendingSystem = buildSystemPrompt(key);
  if (forceMock()) return;
  llmEnsureWorker();
  llmEnsureConversation();
}

function llmReady() { return forceMock() ? true : (llm.ready && !llm.loadFailed); }

function llmStatus() {
  if (forceMock()) return '';
  if (llm.loadFailed) return 'Bot is offline (model unavailable).';
  return llm.status || '';
}

// Send a user (or capture) turn. Returns a Promise<string> that resolves with
// the reply text ('' means suppressed / not ready).
function llmSend(personality, text) {
  if (forceMock()) return Promise.resolve(MOCK_REPLY);
  llmEnsureWorker();
  if (!llmReady()) return Promise.resolve('');
  const key = PERSONALITIES[personality] ? personality : DEFAULT_PERSONALITY;
  const want = buildSystemPrompt(key);
  if (want !== llm.activeSystem) llm.pendingSystem = want;
  llmEnsureConversation();
  return new Promise((resolve) => {
    const id = llm.nextId++;
    llm.pending.set(id, resolve);
    llm.worker.postMessage({
      type: 'chat_send', id, text, maxTokens: MAX_TOKENS,
      temperature: SAMPLING.temperature, topK: SAMPLING.topK, topP: SAMPLING.topP,
      repeatPenalty: SAMPLING.repeatPenalty, seed: Math.floor(Math.random() * 0x1fffffffffffff),
    });
  });
}

// ---------------------------------------------------------------------------
// Toasts (lightweight DOM overlay, since egui is a bare canvas).
// ---------------------------------------------------------------------------
let toastContainer = null;
function toast(message, type) {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(toastContainer);
  }
  const el = document.createElement('div');
  const colors = { success: '#2e7d32', error: '#c62828', warning: '#ef6c00', info: '#1565c0' };
  el.textContent = message;
  el.style.cssText = `background:${colors[type] || colors.info};color:#fff;padding:10px 14px;border-radius:6px;` +
    `font:500 14px system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.3);opacity:0;transition:opacity .2s;max-width:320px;`;
  toastContainer.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 4000);
}

// Trigger a hidden file picker for .wasm upload; resolves to {name, bytes} or null.
function pickWasmFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.wasm';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) { resolve(null); return; }
      const buf = await file.arrayBuffer();
      resolve({ name: file.name, bytes: new Uint8Array(buf) });
    });
    input.addEventListener('cancel', () => { input.remove(); resolve(null); });
    input.click();
  });
}

// ---------------------------------------------------------------------------
// Screen-reader live region. egui renders to a bare WebGL canvas with no DOM
// semantics, so we mirror board status / move descriptions into an off-screen
// aria-live region and label the canvas itself for assistive tech.
// ---------------------------------------------------------------------------
let announcer = null;
let statusRegion = null;
function ensureA11y() {
  const canvas = document.getElementById('the_canvas_id');
  if (canvas && !canvas.getAttribute('aria-label')) {
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'Chess playground. Use arrow keys to move focus between squares, Enter or Space to select or move.');
    canvas.setAttribute('tabindex', '0');
  }
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = 'move-announcer';
    announcer.setAttribute('aria-live', 'assertive');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';
    document.body.appendChild(announcer);
  }
  if (!statusRegion) {
    statusRegion = document.createElement('div');
    statusRegion.id = 'game-status';
    statusRegion.setAttribute('role', 'status');
    statusRegion.setAttribute('aria-live', 'polite');
    statusRegion.style.cssText = announcer.style.cssText;
    document.body.appendChild(statusRegion);
  }
}

// Announce a full move description (e.g. "White knight moves from ... Check!").
function announceMove(text) {
  ensureA11y();
  if (announcer && text) {
    // Clear then set so identical consecutive strings still fire.
    announcer.textContent = '';
    // eslint-disable-next-line no-unused-expressions
    announcer.offsetHeight;
    announcer.textContent = text;
  }
}

// Update the polite game-status region (turn / check / result).
function announceStatus(text) {
  ensureA11y();
  if (statusRegion && text && statusRegion.textContent !== text) {
    statusRegion.textContent = text;
  }
}

window.__chessGlue = {
  pythonRun,
  uploadBot, uploadCall, uploadRemove, pickWasmFile,
  llmPreload, llmReset, llmReady, llmStatus, llmSend,
  toast, announceMove, announceStatus,
};

// Bot loading (Rust WASM, Python, uploaded), bot match orchestration, and turn checking.

import { loadMonty, getMontyClass } from './engine.js';
import {
  executePythonBot, createPythonBot,
  getEditorCode, setEditorCode, getInitialCode,
} from './python-editor.js';
import { toast } from './toast.js';

let state = null;
let base = '';
let addLogEntry = null;
let renderBoard = null;
let updateUI = null;
let switchToTab = null;

export function init(deps) {
  state = deps.state;
  base = deps.base;
  addLogEntry = deps.addLogEntry;
  renderBoard = deps.renderBoard;
  updateUI = deps.updateUI;
  switchToTab = deps.switchToTab;
}

function addBotLogEntry(msg) {
  const turn = state.game ? state.game.getTurn() : '?';
  const label = turn === 'white' ? 'White' : 'Black';
  addLogEntry(`[${label}] ${msg}`);
}

export async function loadBot(botId, color = null) {
  if (botId === 'python-bot') {
    await loadMonty(base, addLogEntry);
    const code = getEditorCode();
    if (color) state.pythonBotCode[color] = code;

    const MontyClass = getMontyClass();
    let botName = 'Python Bot';
    let botDesc = 'Custom Python bot';
    try { botName = executePythonBot(code, 'get_name', state.game, addLogEntry, MontyClass) || botName; } catch (e) {
      if (!String(e).includes('not defined')) addLogEntry(`Warning: get_name() errored: ${e.message || String(e)}`);
    }
    try { botDesc = executePythonBot(code, 'get_description', state.game, addLogEntry, MontyClass) || botDesc; } catch (e) {
      if (!String(e).includes('not defined')) addLogEntry(`Warning: get_description() errored: ${e.message || String(e)}`);
    }

    return createPythonBot(code, color, botName, botDesc, {
      game: state.game, pythonBotCode: state.pythonBotCode, addLogEntry, MontyClass,
    });
  }
  if (botId === 'python-smart-bot') {
    await loadMonty(base, addLogEntry);
    const code = getInitialCode();
    setEditorCode(code);
    if (color) state.pythonBotCode[color] = code;

    const MontyClass = getMontyClass();
    return createPythonBot(code, color, 'Smart Bot (Python)', 'Prefers captures and center control. Written in Python.', {
      game: state.game, pythonBotCode: state.pythonBotCode, addLogEntry, MontyClass,
    });
  }
  if (botId === 'random-bot' || botId === 'smart-bot') {
    try {
      const botModule = botId === 'smart-bot'
        ? await import(`${base}bots/smart-bot/smart_bot_component.js`)
        : await import(`${base}bots/random-bot/random_bot_component.js`);
      const botHost = await import(`${base}bots/bot-host.js`);
      botHost.setGame(state.game);
      botHost.setLogCallback(addBotLogEntry);

      return {
        getName: () => botModule.bot.getName(),
        getDescription: () => botModule.bot.getDescription(),
        onGameStart: () => botModule.bot.onGameStart(),
        selectMove: () => botModule.bot.selectMove(),
        suggestMove: () => botModule.bot.suggestMove(),
      };
    } catch (e) {
      addLogEntry(`Error loading bot: ${e.message || String(e)}`);
      console.error(e);
      return null;
    }
  }
  if (state.customBots.has(botId)) {
    const custom = state.customBots.get(botId);
    custom.botHost.setGame(state.game);
    custom.botHost.setLogCallback(addBotLogEntry);
    const botExport = custom.instance;
    return {
      getName: () => botExport.getName(),
      getDescription: () => botExport.getDescription(),
      onGameStart: () => botExport.onGameStart(),
      selectMove: () => botExport.selectMove(),
      suggestMove: () => botExport.suggestMove(),
    };
  }
  return null;
}

// --- Bot Match ---

function updateBotVsBotUI() {
  const botVsBotControls = document.getElementById('bot-vs-bot-controls');
  if (state.bots.white && state.bots.black) {
    botVsBotControls.style.display = 'block';
  } else {
    botVsBotControls.style.display = 'none';
    stopBotMatch();
  }
}

export function startBotMatch() {
  if (!state.bots.white || !state.bots.black) return;

  state.botModes.white = 'auto';
  state.botModes.black = 'auto';

  state.bots.white.onGameStart?.();
  state.bots.black.onGameStart?.();

  addLogEntry('Bot match started!');
  document.getElementById('start-match').disabled = true;
  document.getElementById('pause-match').disabled = false;
  state.matchPaused = false;

  playNextBotMove();
}

function playNextBotMove() {
  if (state.matchPaused) return;

  const result = state.game.getGameResult();
  if (result !== 'in-progress') {
    stopBotMatch();
    return;
  }

  const turn = state.game.getTurn();
  const bot = turn === 'white' ? state.bots.white : state.bots.black;

  if (bot) {
    try {
      const move = bot.selectMove();
      if (move) {
        try {
          state.game.makeMove(move);
          state.moveHistory.push(move);
          state.lastMove = move;
          renderBoard();
          updateUI();

          const speed = parseInt(document.getElementById('match-speed').value);
          state.matchTimer = setTimeout(playNextBotMove, speed);
        } catch (moveErr) {
          addLogEntry(`Invalid move from ${turn}: ${move}`);
          stopBotMatch();
        }
      } else {
        addLogEntry(`No move from ${turn}`);
        stopBotMatch();
      }
    } catch (e) {
      addLogEntry(`Error: ${(e.message || String(e))}`);
      stopBotMatch();
    }
  }
}

export function togglePauseMatch() {
  state.matchPaused = !state.matchPaused;
  const pauseBtn = document.getElementById('pause-match');
  if (state.matchPaused) {
    pauseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="vertical-align: -2px; margin-right: 4px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>Resume';
  } else {
    pauseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="vertical-align: -2px; margin-right: 4px;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>Pause';
    playNextBotMove();
  }
}

export function stopBotMatch() {
  if (state.autoBotTimeout) {
    clearTimeout(state.autoBotTimeout);
    state.autoBotTimeout = null;
  }
  if (state.matchTimer) {
    clearTimeout(state.matchTimer);
    state.matchTimer = null;
    addLogEntry('Bot match ended');
  }
  document.getElementById('start-match').disabled = false;
  document.getElementById('pause-match').disabled = true;
}

export async function checkBotTurn() {
  const result = state.game.getGameResult();
  if (result !== 'in-progress') return;

  const turn = state.game.getTurn();
  const bot = turn === 'white' ? state.bots.white : state.bots.black;
  const mode = turn === 'white' ? state.botModes.white : state.botModes.black;

  const isBotMatch = state.bots.white && state.bots.black;
  if (bot && mode === 'auto' && !state.matchTimer && !isBotMatch) {
    if (state.autoBotTimeout) clearTimeout(state.autoBotTimeout);
    const gen = state.gameGeneration;
    state.autoBotTimeout = setTimeout(async () => {
      state.autoBotTimeout = null;
      if (gen !== state.gameGeneration) return;
      try {
        const move = bot.selectMove();
        if (gen !== state.gameGeneration) return;
        if (move) {
          try {
            state.game.makeMove(move);
            state.moveHistory.push(move);
            state.lastMove = move;
            state.suggestedMove = null;
            renderBoard();
            updateUI();
            checkBotTurn();
          } catch (moveErr) {
            addLogEntry(`Invalid move: ${move}`);
          }
        }
      } catch (e) {
        addLogEntry(`Error: ${(e.message || String(e))}`);
      }
    }, 300);
  } else if (bot && mode === 'suggest') {
    try {
      state.suggestedMove = bot.suggestMove();
      document.getElementById('suggested-move').style.display = 'block';
      document.getElementById('suggestion').textContent = state.suggestedMove;
      renderBoard();
    } catch (e) {
      addLogEntry(`Error getting suggestion: ${(e.message || String(e))}`);
    }
  } else {
    state.suggestedMove = null;
    document.getElementById('suggested-move').style.display = 'none';
  }
}

export function setupPlayerDropdowns() {
  for (const color of ['white', 'black']) {
    const select = document.getElementById(`${color}-player`);
    select.addEventListener('change', async (e) => {
      const value = e.target.value;
      const modeDiv = document.getElementById(`${color}-bot-mode`);

      if (value === 'upload') {
        document.getElementById('bot-upload').click();
        select.value = 'human';
        state.bots[color] = null;
        modeDiv.style.display = 'none';
        updateBotVsBotUI();
        return;
      }

      if (value === 'human') {
        state.bots[color] = null;
        modeDiv.style.display = 'none';
      } else {
        if (value === 'python-bot' || value === 'python-smart-bot') {
          switchToTab('editor-tab');
        }
        select.disabled = true;
        const origText = select.options[select.selectedIndex]?.text;

        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'bot-loading-indicator';
        loadingIndicator.textContent = 'Loading bot...';
        const playerBar = select.closest('.player-bar');
        playerBar.appendChild(loadingIndicator);

        try {
          state.bots[color] = await loadBot(value, color);
          modeDiv.style.display = 'block';
          if (state.bots[color]) {
            const botName = state.bots[color].getName();
            addLogEntry(`${color[0].toUpperCase() + color.slice(1)}: ${botName} loaded`);
            toast.success(`${botName} loaded as ${color}`);
          } else {
            toast.error(`Failed to load bot for ${color}`);
          }
        } catch (err) {
          console.error('Bot load error:', err);
          toast.error(`Failed to load bot: ${err.message || String(err)}`);
          select.value = 'human';
          state.bots[color] = null;
          modeDiv.style.display = 'none';
        } finally {
          select.disabled = false;
          if (select.options[select.selectedIndex] && origText) {
            select.options[select.selectedIndex].text = origText;
          }
          loadingIndicator.classList.add('fade-out');
          setTimeout(() => loadingIndicator.remove(), 300);
        }
      }

      updateBotVsBotUI();
      checkBotTurn();
    });
  }
}

export function setupBotModeRadios() {
  function updateRadioLabels(name) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
      radio.closest('label')?.classList.toggle('checked', radio.checked);
    });
  }

  for (const color of ['white', 'black']) {
    const name = `${color}-mode`;
    updateRadioLabels(name);
    document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
      radio.addEventListener('change', (e) => {
        state.botModes[color] = e.target.value;
        updateRadioLabels(name);
        checkBotTurn();
      });
    });
  }
}

export function setupBotUpload() {
  document.getElementById('bot-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    const statusDiv = document.getElementById('upload-status');
    statusDiv.className = '';
    statusDiv.innerHTML = `
      <div class="bot-loading-indicator">
        Processing WASM file...
      </div>
      <div class="loading-progress" style="margin-top: 8px; width: 100%;">
        <div class="loading-progress-bar indeterminate"></div>
      </div>
    `;
    statusDiv.style.display = 'block';

    addLogEntry(`Uploading bot: ${file.name}...`);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());

      if (bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
        throw new Error('Invalid file format. Please upload a valid .wasm component file.');
      }

      const { transpile } = await import(`@bytecodealliance/jco/component`);
      const { files } = await transpile(bytes, {
        name: file.name.replace(/\.wasm$/, ''),
        instantiation: { tag: 'async' },
        map: [
          ['chess:bot/host', './bot-host.js'],
        ],
        noNodejsCompat: true,
        base64Cutoff: 0,
        tlaCompat: true,
      });

      let mainJsUrl = null;
      for (const [filename, content] of files) {
        const isJs = filename.endsWith('.js');
        const blob = new Blob([content], { type: isJs ? 'text/javascript' : 'application/wasm' });
        const url = URL.createObjectURL(blob);
        state.activeBlobUrls.add(url);
        if (isJs && !mainJsUrl) {
          mainJsUrl = url;
        }
      }

      if (!mainJsUrl) {
        throw new Error('Transpilation produced no JS output');
      }

      const mod = await import(/* @vite-ignore */ mainJsUrl);
      const botHostModule = await import(`${base}bots/bot-host.js`);

      const wasmLookup = {};
      for (const [filename, content] of files) {
        if (filename.endsWith('.wasm')) {
          wasmLookup['./' + filename] = content;
        }
      }

      const getCoreModule = (path) => {
        const content = wasmLookup[path];
        if (content) return WebAssembly.compile(content);
        throw new Error(`WASM module not found: ${path}`);
      };

      const instance = await mod.instantiate(getCoreModule, {
        'chess:bot/host': {
          getBoard: () => botHostModule.getBoard(),
          getLegalMoves: () => botHostModule.getLegalMoves(),
          isCheck: () => botHostModule.isCheck(),
          getGameResult: () => botHostModule.getGameResult(),
          getFen: () => botHostModule.getFen(),
          log: (msg) => botHostModule.log(msg),
        },
      });

      const botExport = instance.bot || instance['chess:bot/bot@0.1.0'];
      if (!botExport || typeof botExport.getName !== 'function') {
        throw new Error('Invalid bot component. Must implement chess:bot@0.1.0 interface with getName(), selectMove(), etc.');
      }

      const botName = botExport.getName();
      addLogEntry(`Loaded custom bot: ${botName}`);

      const customBotId = `custom-${Date.now()}`;
      state.customBots.set(customBotId, {
        name: botName,
        instance: botExport,
        botHost: botHostModule,
      });

      for (const selectId of ['white-player', 'black-player']) {
        const sel = document.getElementById(selectId);
        const opt = document.createElement('option');
        opt.value = customBotId;
        opt.textContent = `${botName} (uploaded)`;
        const uploadOpt = sel.querySelector('option[value="upload"]');
        sel.insertBefore(opt, uploadOpt);
      }

      const statusDiv = document.getElementById('upload-status');
      statusDiv.className = 'success';
      statusDiv.textContent = `Successfully loaded ${botName}!`;
      toast.success(`${botName} uploaded successfully!`);
      setTimeout(() => {
        statusDiv.classList.add('fade-out');
        setTimeout(() => { statusDiv.style.display = 'none'; }, 300);
      }, 3000);
    } catch (err) {
      const errorMsg = err.message || String(err);
      addLogEntry(`Upload error: ${errorMsg}`);
      console.error('Bot upload error:', err);

      // Provide helpful error messages
      let userFriendlyMsg = errorMsg;
      if (errorMsg.includes('instantiate')) {
        userFriendlyMsg = 'Failed to instantiate WASM module. Ensure your bot implements the correct interface.';
      } else if (errorMsg.includes('import')) {
        userFriendlyMsg = 'Missing required imports. Your bot must use chess:bot/host@0.1.0.';
      }

      const statusDiv = document.getElementById('upload-status');
      statusDiv.className = 'error';
      statusDiv.textContent = `Error: ${userFriendlyMsg}`;
      statusDiv.style.display = 'block';
      toast.error(userFriendlyMsg, 6000);
    }
  });

  const dropzone = document.getElementById('upload-dropzone');
  const triggerUpload = () => {
    document.getElementById('bot-upload').click();
  };

  dropzone.addEventListener('click', triggerUpload);

  // Keyboard accessibility for upload dropzone
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerUpload();
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
      const input = document.getElementById('bot-upload');
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    }
  });
}

export function setupBotCards() {
  document.querySelectorAll('.bot-load-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const botId = btn.dataset.bot;
      const color = btn.dataset.color;
      const selectId = `${color}-player`;
      const sel = document.getElementById(selectId);
      sel.value = botId;
      sel.dispatchEvent(new Event('change'));
    });
  });
}

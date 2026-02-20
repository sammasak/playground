// Chess engine and Python runtime (Monty) WASM loading.

let montyLoaded = false;
let MontyClass = null;

export async function loadChessEngine(base) {
  const module = await import(`${base}engine/chess_engine_component.js`);
  return module.engine;
}

export async function loadMonty(base, addLogEntry) {
  if (montyLoaded) return;

  // Show loading overlay for WASM initialization
  const overlay = document.createElement('div');
  overlay.className = 'wasm-init-overlay';
  overlay.innerHTML = `
    <div class="wasm-init-content">
      <div class="wasm-init-spinner"></div>
      <div class="wasm-init-title">Loading Python Runtime</div>
      <div class="wasm-init-message">Initializing Monty WASM module...</div>
      <div class="wasm-init-progress">
        <div class="wasm-init-progress-bar indeterminate" style="width: 30%; animation: progress-indeterminate 1.5s ease-in-out infinite;"></div>
      </div>
      <div class="wasm-init-status">This may take a few seconds</div>
    </div>
  `;
  document.body.appendChild(overlay);

  try {
    const module = await import(`${base}monty/monty_wasm.js`);
    await module.default(`${base}monty/monty_wasm_bg.wasm`);
    MontyClass = module.Monty;
    montyLoaded = true;
    addLogEntry('Python runtime (Monty) loaded');

    // Remove overlay with fade out
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 300);
  } catch (e) {
    addLogEntry(`Failed to load Python runtime: ${(e.message || String(e))}`);
    console.error(e);

    // Show error in overlay
    overlay.querySelector('.wasm-init-content').innerHTML = `
      <svg class="loading-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <div class="loading-error-message">Failed to load Python runtime</div>
      <div class="loading-error-details">${e.message || 'An unexpected error occurred while loading the Monty WASM module.'}</div>
      <div class="loading-error-action">
        <button onclick="this.closest('.wasm-init-overlay').remove()" class="btn-primary">Dismiss</button>
      </div>
    `;

    setTimeout(() => {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 300);
    }, 5000);
  }
}

export function getMontyClass() {
  return MontyClass;
}

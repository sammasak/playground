// Chess engine and Python runtime (Monty) WASM loading.

let montyLoaded = false;
let MontyClass = null;

export async function loadChessEngine(base) {
  const module = await import(`${base}engine/chess_engine_component.js`);
  return module.engine;
}

export async function loadMonty(base, addLogEntry) {
  if (montyLoaded) return;
  try {
    const module = await import(`${base}monty/monty_wasm.js`);
    await module.default(`${base}monty/monty_wasm_bg.wasm`);
    MontyClass = module.Monty;
    montyLoaded = true;
    addLogEntry('Python runtime (Monty) loaded');
  } catch (e) {
    addLogEntry(`Failed to load Python runtime: ${(e.message || String(e))}`);
    console.error(e);
  }
}

export function getMontyClass() {
  return MontyClass;
}

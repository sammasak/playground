//! wasm-bindgen bindings to the JS interop glue (`glue.js`, exposed on
//! `window.__chessGlue`). These cover the three JS-runtime features the native
//! Rust core can't do itself — the Monty Python bot runtime, uploaded
//! Component-Model `.wasm` bots (jco transpile), and the on-device BitNet "bot
//! banter" LLM — plus DOM toasts and a `.wasm` file picker.

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    /// `__chessGlue.pythonRun(code, method, inputsJson) -> Promise<string>`.
    /// Resolves with a JSON string `{ ok, value, logs, error }`.
    #[wasm_bindgen(js_namespace = ["window", "__chessGlue"], js_name = pythonRun)]
    pub fn python_run(code: &str, method: &str, inputs_json: &str) -> js_sys::Promise;

    /// `__chessGlue.uploadBot(bytes, filename) -> Promise<string>` (jco transpile).
    #[wasm_bindgen(js_namespace = ["window", "__chessGlue"], js_name = uploadBot)]
    pub fn upload_bot(bytes: &[u8], filename: &str) -> js_sys::Promise;

    /// `__chessGlue.uploadCall(id, method, snapshotJson) -> string`.
    #[wasm_bindgen(js_namespace = ["window", "__chessGlue"], js_name = uploadCall)]
    pub fn upload_call(id: &str, method: &str, snapshot_json: &str) -> String;

    /// `__chessGlue.uploadRemove(id)`.
    #[wasm_bindgen(js_namespace = ["window", "__chessGlue"], js_name = uploadRemove)]
    pub fn upload_remove(id: &str);

    /// `__chessGlue.pickWasmFile() -> Promise<{name, bytes}|null>`.
    #[wasm_bindgen(js_namespace = ["window", "__chessGlue"], js_name = pickWasmFile)]
    pub fn pick_wasm_file() -> js_sys::Promise;

    /// `__chessGlue.llmPreload()`.
    #[wasm_bindgen(js_namespace = ["window", "__chessGlue"], js_name = llmPreload)]
    pub fn llm_preload();

    /// `__chessGlue.llmReset(personality)`.
    #[wasm_bindgen(js_namespace = ["window", "__chessGlue"], js_name = llmReset)]
    pub fn llm_reset(personality: &str);

    /// `__chessGlue.llmReady() -> bool`.
    #[wasm_bindgen(js_namespace = ["window", "__chessGlue"], js_name = llmReady)]
    pub fn llm_ready() -> bool;

    /// `__chessGlue.llmStatus() -> string`.
    #[wasm_bindgen(js_namespace = ["window", "__chessGlue"], js_name = llmStatus)]
    pub fn llm_status() -> String;

    /// `__chessGlue.llmSend(personality, text) -> Promise<string>`.
    #[wasm_bindgen(js_namespace = ["window", "__chessGlue"], js_name = llmSend)]
    pub fn llm_send(personality: &str, text: &str) -> js_sys::Promise;

    /// `__chessGlue.toast(message, type)`.
    #[wasm_bindgen(js_namespace = ["window", "__chessGlue"], js_name = toast)]
    pub fn toast(message: &str, kind: &str);

    /// `__chessGlue.announceMove(text)` — assertive aria-live move description.
    #[wasm_bindgen(js_namespace = ["window", "__chessGlue"], js_name = announceMove)]
    pub fn announce_move(text: &str);

    /// `__chessGlue.announceStatus(text)` — polite aria-live game status.
    #[wasm_bindgen(js_namespace = ["window", "__chessGlue"], js_name = announceStatus)]
    pub fn announce_status(text: &str);
}

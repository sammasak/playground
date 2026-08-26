// bitnet-wasm inference Web Worker (module worker).
//
// Runs the single-threaded, CPU-bound BitNet I2_S model completely off the main
// thread so the chess game never blocks. All model I/O is same-origin: chunks
// are fetched from URLs the main thread provides, concatenated into one
// Uint8Array, and handed to the wasm `BitnetModel` constructor.
//
// Protocol (main thread -> worker):
//   { type: 'load', modelUrls: string[], totalBytes: number, wasmUrl: string, wasmBindingsUrl: string }
//   { type: 'chat_reset', system: string }                 // start/restart a conversation
//   { type: 'chat_send', id: number|string, text: string, maxTokens: number,
//     temperature?, topK?, topP?, repeatPenalty?, seed? }  // one turn (sampling optional)
//   { type: 'generate', id: number|string, prompt: string, maxTokens: number } // legacy stateless
//
// Protocol (worker -> main thread):
//   { type: 'progress', loaded: number, total: number }   // during model fetch
//   { type: 'ready' }                                       // model instantiated
//   { type: 'reset_done' }                                  // chat_reset applied
//   { type: 'result', id, text }                            // a generation finished
//   { type: 'error', id?, message }                         // any failure
//
// STATEFUL CHAT SESSION: the model keeps a persistent KV cache across turns.
//   - `chat_reset(system)` prefills the system prompt once (cached).
//   - `chat_send(text, maxTokens)` feeds ONE new turn; all prior turns stay in
//     the cache so the bot remembers the conversation.
//
// Turns are serialized: only one `chat_send`/`generate` runs at a time; extra
// requests queue and are drained IN ORDER. Because the session is stateful,
// ordered execution is REQUIRED — a later turn must not run before an earlier
// one. `chat_reset` clears the pending queue so a stale turn from the previous
// conversation can never leak into the new one.

let model = null; // BitnetModel instance once ready
let loading = false; // guards against duplicate `load` messages
let ready = false;

// Each queued job is either a stateless generate ({ kind:'generate', prompt })
// or a stateful chat turn ({ kind:'chat', text }). Both carry { id, maxTokens }.
const genQueue = []; // pending jobs
let generating = false;

self.onmessage = async (e) => {
  const msg = e.data || {};
  try {
    if (msg.type === 'load') {
      await handleLoad(msg);
    } else if (msg.type === 'chat_reset') {
      // Reset the persistent conversation. Drop any queued turns from the old
      // conversation so a stale turn can't run against the new system prompt.
      genQueue.length = 0;
      if (ready && model) {
        model.chat_reset(String(msg.system || ''));
      }
      self.postMessage({ type: 'reset_done' });
    } else if (msg.type === 'chat_send') {
      genQueue.push({
        kind: 'chat',
        id: msg.id,
        text: msg.text,
        maxTokens: msg.maxTokens,
        // Optional per-turn sampling config. When present the drain worker
        // applies it via model.set_sampling(...) immediately before chat_send.
        temperature: msg.temperature,
        topK: msg.topK,
        topP: msg.topP,
        repeatPenalty: msg.repeatPenalty,
        seed: msg.seed,
      });
      drainQueue();
    } else if (msg.type === 'generate') {
      genQueue.push({ kind: 'generate', id: msg.id, prompt: msg.prompt, maxTokens: msg.maxTokens });
      drainQueue();
    }
  } catch (err) {
    postError(err, msg && msg.id);
  }
};

async function handleLoad(msg) {
  if (loading || ready) return; // idempotent
  loading = true;

  try {
    const modelUrls = Array.isArray(msg.modelUrls) ? msg.modelUrls : [];
    if (modelUrls.length === 0) {
      throw new Error('no model chunks provided (empty manifest)');
    }

    let bytes = await fetchAndConcat(modelUrls, msg.totalBytes, msg.sizes);

    // Import the wasm-bindgen glue and initialize the wasm module. `wasmUrl`
    // points at the .wasm binary; `wasmBindingsUrl` at the ES-module JS glue.
    const wasmModule = await import(msg.wasmBindingsUrl);
    await wasmModule.default(msg.wasmUrl);

    model = new wasmModule.BitnetModel(bytes);
    // Drop our reference to the ~880MB model bytes so the GC can reclaim them
    // promptly now that the wasm module owns the data.
    bytes = null;
    ready = true;
    loading = false;
    self.postMessage({ type: 'ready' });

    // A generate request may have arrived while we were loading.
    drainQueue();
  } catch (err) {
    loading = false;
    postError(err);
  }
}

// Number of chunks fetched concurrently. GitHub's CDN throttles per-connection,
// so several parallel streams download the model far faster than one-at-a-time.
// Bounded so the in-flight chunks (~CONCURRENCY * chunkSize) plus the
// preallocated output stay well under the tab's memory ceiling.
const FETCH_CONCURRENCY = 6;

// Fetch all chunk URLs IN PARALLEL and copy each straight into ONE preallocated
// output Uint8Array (the full GGUF file), at its correct offset.
//
// Memory: we preallocate the output once (from the manifest total) and only ever
// hold a few in-flight chunks at a time — never a second full copy — so we don't
// OOM the tab. Offsets come from the manifest `sizes` so parallel writes land in
// the right place; if sizes are absent we fall back to sequential in-order fetch.
async function fetchAndConcat(urls, knownTotal, sizes) {
  const haveSizes = Array.isArray(sizes) && sizes.length === urls.length;
  const total =
    knownTotal > 0 ? knownTotal : haveSizes ? sizes.reduce((a, b) => a + b, 0) : 0;

  // Without a known total or per-chunk sizes we can't place parallel writes,
  // so fall back to the safe sequential path.
  if (!haveSizes || total === 0) {
    return fetchSequential(urls, total);
  }

  const out = new Uint8Array(total);
  const offsets = [];
  let acc = 0;
  for (const s of sizes) {
    offsets.push(acc);
    acc += s;
  }

  let loaded = 0;
  let next = 0;
  const fetchWorker = async () => {
    while (next < urls.length) {
      const i = next++;
      const resp = await fetch(urls[i]);
      if (!resp.ok) {
        throw new Error(`failed to fetch ${urls[i]}: HTTP ${resp.status}`);
      }
      let chunk = new Uint8Array(await resp.arrayBuffer());
      out.set(chunk, offsets[i]);
      loaded += chunk.byteLength;
      chunk = null; // drop the chunk reference immediately
      self.postMessage({ type: 'progress', loaded, total });
    }
  };

  const lanes = Math.min(FETCH_CONCURRENCY, urls.length);
  await Promise.all(Array.from({ length: lanes }, fetchWorker));
  return out;
}

// Sequential fallback for when per-chunk sizes are unknown (parallel writes need
// offsets). Preallocates the output when the total is known.
async function fetchSequential(urls, knownTotal) {
  let out = knownTotal > 0 ? new Uint8Array(knownTotal) : null;
  let dynamic = out ? null : [];
  let offset = 0;
  let loaded = 0;

  for (const url of urls) {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`failed to fetch ${url}: HTTP ${resp.status}`);
    }
    let chunk = new Uint8Array(await resp.arrayBuffer());
    if (out) out.set(chunk, offset);
    else dynamic.push(chunk);
    offset += chunk.byteLength;
    loaded += chunk.byteLength;
    chunk = null;
    self.postMessage({ type: 'progress', loaded, total: knownTotal > 0 ? knownTotal : loaded });
  }

  if (out) return out;

  out = new Uint8Array(offset);
  let o = 0;
  for (let i = 0; i < dynamic.length; i++) {
    out.set(dynamic[i], o);
    o += dynamic[i].byteLength;
    dynamic[i] = null;
  }
  dynamic = null;
  return out;
}

function drainQueue() {
  if (generating || !ready || genQueue.length === 0) return;
  generating = true;

  const job = genQueue.shift();
  // Run synchronously (wasm generate/chat_send is blocking), then continue the
  // queue. We wrap in a microtask so `generating` is observable and errors
  // surface through postError rather than crashing the worker. Turns run in the
  // order they were enqueued — required for the stateful chat session.
  Promise.resolve()
    .then(() => {
      let text;
      if (job.kind === 'chat') {
        // Apply per-turn sampling config (temperature / top_k / top_p /
        // repeat_penalty / seed) right before generation, if provided and the
        // wasm build exposes set_sampling. Greedy is the default otherwise.
        if (
          job.temperature != null &&
          model.set_sampling &&
          typeof model.set_sampling === 'function'
        ) {
          model.set_sampling(
            job.temperature,
            job.topK,
            job.topP,
            job.repeatPenalty,
            BigInt(job.seed)
          );
        }
        text = model.chat_send(job.text, job.maxTokens);
      } else {
        text = model.generate(job.prompt, job.maxTokens);
      }
      self.postMessage({ type: 'result', id: job.id, text });
    })
    .catch((err) => {
      postError(err, job.id);
    })
    .finally(() => {
      generating = false;
      drainQueue();
    });
}

function postError(err, id) {
  const message = err && err.message ? err.message : String(err);
  self.postMessage({ type: 'error', id, message });
}

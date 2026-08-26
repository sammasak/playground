/* @ts-self-types="./bitnet_wasm.d.ts" */

/**
 * A loaded `BitNet` model bundled with its tokenizer, ready to generate text.
 *
 * Holds the owned [`Model`] (config + decoded weights) and the [`Tokenizer`]
 * built from the same GGUF metadata. Nothing borrows the original model bytes,
 * so JS is free to release them after construction.
 */
export class BitnetModel {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BitnetModelFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_bitnetmodel_free(ptr, 0);
    }
    /**
     * Start (or restart) a stateful multi-turn chat conversation.
     *
     * Allocates a fresh KV cache sized to the model's context length, clears any
     * prior session, and stores `system_prompt` to be folded into the first
     * user turn. Nothing is prefilled here — prefill happens lazily in the first
     * [`chat_send`](Self::chat_send) so the system text and turn-1 text share a
     * single `Human:` block, matching the model's chat template.
     *
     * Call this once per conversation. Subsequent [`chat_send`](Self::chat_send)
     * calls append to the same cache, so each new turn reuses all earlier turns'
     * cached attention instead of re-processing them.
     * @param {string} system_prompt
     */
    chat_reset(system_prompt) {
        const ptr0 = passStringToWasm0(system_prompt, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.bitnetmodel_chat_reset(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * Send one user turn and greedily generate the assistant's reply, keeping the
     * entire conversation in the persistent KV cache.
     *
     * The turn text follows the model's chat template:
     * - **first turn:** `<BOS>Human: {system_prompt} {user_text}\n\nBITNETAssistant: `
     * - **later turns:** `<EOS>Human: {user_text}\n\nBITNETAssistant: ` — the
     *   leading EOS closes the previous assistant reply, separating the turns.
     *
     * Only the tokens of *this* turn are fed through
     * [`Model::decode_token`](bitnet_model::Model::decode_token); everything from
     * prior turns is already in the cache. The reply is then generated greedily
     * (argmax), each generated token fed back into the cache so it becomes part
     * of the conversation memory. Generation stops on EOS, on `max_new_tokens`,
     * or when the anti-repetition guard trips.
     *
     * If no session exists yet (i.e. [`chat_reset`](Self::chat_reset) was never
     * called), one is created implicitly with an empty system prompt.
     *
     * # Errors
     * Returns a [`JsError`] if a decode step fails or the conversation exhausts
     * the cache's context capacity (the reply is truncated cleanly at that
     * point rather than panicking; only a genuine decode error surfaces here).
     * @param {string} user_text
     * @param {number} max_new_tokens
     * @returns {string}
     */
    chat_send(user_text, max_new_tokens) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(user_text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.bitnetmodel_chat_send(this.__wbg_ptr, ptr0, len0, max_new_tokens);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * Greedily generates up to `max_new_tokens` tokens from `prompt` and returns
     * the decoded continuation as text.
     *
     * Mirrors the native `run` subcommand: the prompt is encoded with a leading
     * BOS token, generation stops on the tokenizer's EOS id (or `max_new_tokens`),
     * and the generated ids are decoded lossily so that any partial multi-byte
     * sequence renders as the replacement character rather than erroring.
     *
     * This call is synchronous and CPU-bound; invoke it from a Web Worker.
     *
     * # Errors
     * Returns a [`JsError`] if generation or decoding fails (e.g. an empty
     * prompt or a context-length violation).
     * @param {string} prompt
     * @param {number} max_new_tokens
     * @returns {string}
     */
    generate(prompt, max_new_tokens) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(prompt, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.bitnetmodel_generate(this.__wbg_ptr, ptr0, len0, max_new_tokens);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * Like [`generate`](Self::generate), but invokes `on_token` with each token's
     * decoded text piece as it is produced, enabling incremental UI rendering.
     *
     * The callback receives a single JS string argument per generated token
     * (the piece decoded lossily on its own). It also returns the full decoded
     * text so callers that only want the final string can ignore the callback.
     *
     * This call is synchronous and CPU-bound; invoke it from a Web Worker.
     *
     * # Errors
     * Returns a [`JsError`] if generation fails, if the JS callback throws, or
     * if decoding the final text fails.
     * @param {string} prompt
     * @param {number} max_new_tokens
     * @param {Function} on_token
     * @returns {string}
     */
    generate_stream(prompt, max_new_tokens, on_token) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(prompt, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.bitnetmodel_generate_stream(this.__wbg_ptr, ptr0, len0, max_new_tokens, on_token);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * Parses a GGUF model from raw bytes and binds the model + tokenizer.
     *
     * `model_bytes` is the full contents of a `ggml-model-i2_s.gguf` file. It is
     * only read during this call — [`Model::from_gguf`] copies the weights into
     * owned buffers, so the caller may free the buffer once the constructor
     * returns.
     *
     * # Errors
     * Returns a [`JsError`] if the bytes are not a valid GGUF file, the weights
     * cannot be bound to the model layout, or the GGUF lacks the
     * `tokenizer.ggml.*` metadata needed to build a tokenizer.
     * @param {Uint8Array} model_bytes
     */
    constructor(model_bytes) {
        const ptr0 = passArray8ToWasm0(model_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.bitnetmodel_new(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        BitnetModelFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Configure text-generation sampling for subsequent [`chat_send`](Self::chat_send)
     * calls. Takes effect immediately and persists across `chat_reset`.
     *
     * - `temperature`: `0.0` => greedy/argmax (deterministic; `top_k`/`top_p`
     *   ignored). `>0` softmaxes `logits/temperature` and samples.
     * - `top_k`: `0` => disabled; else keep only the `k` highest-logit tokens.
     * - `top_p`: `1.0` => disabled; else nucleus sampling (smallest set whose
     *   cumulative probability `>= top_p`).
     * - `repeat_penalty`: `1.0` => disabled; else divides the logit of any token
     *   in the recent history by this factor before softmax.
     * - `seed`: seeds the deterministic PRNG so `(prompt, seed)` is reproducible.
     *   Pass a varying seed per turn from JS to get varied replies (the wasm
     *   sandbox has no system randomness, so Rust cannot vary it itself).
     *
     * The default (if never called) is greedy, so existing behaviour is
     * unchanged until this is invoked.
     * @param {number} temperature
     * @param {number} top_k
     * @param {number} top_p
     * @param {number} repeat_penalty
     * @param {bigint} seed
     */
    set_sampling(temperature, top_k, top_p, repeat_penalty, seed) {
        wasm.bitnetmodel_set_sampling(this.__wbg_ptr, temperature, top_k, top_p, repeat_penalty, seed);
    }
}
if (Symbol.dispose) BitnetModel.prototype[Symbol.dispose] = BitnetModel.prototype.free;

/**
 * Installs a panic hook that forwards Rust panics to the browser console with a
 * readable message and backtrace. Runs automatically when the module loads.
 */
export function start() {
    wasm.start();
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_92b29b0548f8b746: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg___wbindgen_string_get_b0ca35b86a603356: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_344f42d3211c4765: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_a6e5c5dce5018821: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_error_a6fa202b58aa1cd3: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_message_8326fb1d549bebc5: function(arg0) {
            const ret = arg0.message;
            return ret;
        },
        __wbg_new_227d7c05414eb861: function() {
            const ret = new Error();
            return ret;
        },
        __wbg_stack_3b0d974bbf31e44f: function(arg0, arg1) {
            const ret = arg1.stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./bitnet_wasm_bg.js": import0,
    };
}

const BitnetModelFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_bitnetmodel_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('bitnet_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };

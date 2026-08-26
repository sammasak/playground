// ../site/node_modules/@bytecodealliance/preview2-shim/lib/browser/io.js
var id = 0;
var symbolDispose = Symbol.dispose || Symbol.for("dispose");
var IoError = class Error2 {
  constructor(msg) {
    this.msg = msg;
  }
  toDebugString() {
    return this.msg;
  }
};
var InputStream = class {
  /**
   * @param {InputStreamHandler} handler
   */
  constructor(handler) {
    if (!handler) {
      console.trace("no handler");
    }
    this.id = ++id;
    this.handler = handler;
  }
  read(len) {
    if (this.handler.read) {
      return this.handler.read(len);
    }
    return this.handler.blockingRead.call(this, len);
  }
  blockingRead(len) {
    return this.handler.blockingRead.call(this, len);
  }
  skip(len) {
    if (this.handler.skip) {
      return this.handler.skip.call(this, len);
    }
    if (this.handler.read) {
      const bytes = this.handler.read.call(this, len);
      return BigInt(bytes.byteLength);
    }
    return this.blockingSkip.call(this, len);
  }
  blockingSkip(len) {
    if (this.handler.blockingSkip) {
      return this.handler.blockingSkip.call(this, len);
    }
    const bytes = this.handler.blockingRead.call(this, len);
    return BigInt(bytes.byteLength);
  }
  subscribe() {
    if (this.handler.subscribe) {
      return this.handler.subscribe();
    }
    return new Pollable();
  }
  [symbolDispose]() {
    if (this.handler.drop) {
      this.handler.drop.call(this);
    }
  }
};
var OutputStream = class {
  /**
   * @param {OutputStreamHandler} handler
   */
  constructor(handler) {
    if (!handler) {
      console.trace("no handler");
    }
    this.id = ++id;
    this.open = true;
    this.handler = handler;
  }
  checkWrite(len) {
    if (!this.open) {
      return 0n;
    }
    if (this.handler.checkWrite) {
      return this.handler.checkWrite.call(this, len);
    }
    return 1000000n;
  }
  write(buf) {
    this.handler.write.call(this, buf);
  }
  blockingWriteAndFlush(buf) {
    this.handler.write.call(this, buf);
  }
  flush() {
    if (this.handler.flush) {
      this.handler.flush.call(this);
    }
  }
  blockingFlush() {
    this.open = true;
  }
  writeZeroes(len) {
    this.write.call(this, new Uint8Array(Number(len)));
  }
  blockingWriteZeroes(len) {
    this.blockingWrite.call(this, new Uint8Array(Number(len)));
  }
  blockingWriteZeroesAndFlush(len) {
    this.blockingWriteAndFlush.call(this, new Uint8Array(Number(len)));
  }
  splice(src, len) {
    const spliceLen = Math.min(len, this.checkWrite.call(this));
    const bytes = src.read(spliceLen);
    this.write.call(this, bytes);
    return bytes.byteLength;
  }
  blockingSplice(_src, _len) {
    console.log(`[streams] Blocking splice ${this.id}`);
  }
  forward(_src) {
    console.log(`[streams] Forward ${this.id}`);
  }
  subscribe() {
    if (this.handler.subscribe) {
      return this.handler.subscribe();
    }
    return new Pollable();
  }
  [symbolDispose]() {
  }
};
var error = { Error: IoError };
var streams = { InputStream, OutputStream };
var Pollable = class {
  #ready = false;
  #promise = null;
  constructor(promise) {
    if (!promise) {
      this.#ready = true;
    } else {
      this.#promise = promise.then(
        () => {
          this.#ready = true;
        },
        () => {
          this.#ready = true;
        }
      );
    }
  }
  ready() {
    return this.#ready;
  }
  block() {
    if (this.#ready) {
      return Promise.resolve();
    }
    return this.#promise;
  }
  [symbolDispose]() {
    this.#promise = null;
  }
};

// ../site/node_modules/@bytecodealliance/preview2-shim/lib/browser/config.js
var _cwd = "/";
function _getCwd() {
  return _cwd;
}

// ../site/node_modules/@bytecodealliance/preview2-shim/lib/browser/environment.js
var _env = [];
var _args = [];
var _cwd2 = "/";
var environment = {
  getEnvironment() {
    return _env;
  },
  getArguments() {
    return _args;
  },
  initialCwd() {
    return _cwd2;
  }
};

// ../site/node_modules/@bytecodealliance/preview2-shim/lib/browser/cli.js
var { InputStream: InputStream2, OutputStream: OutputStream2 } = streams;
var symbolDispose2 = Symbol.dispose ?? Symbol.for("dispose");
var ComponentExit = class extends Error {
  constructor(code) {
    super(`Component exited ${code === 0 ? "successfully" : "with error"}`);
    this.exitError = true;
    this.code = code;
  }
};
var exit = {
  exit(status) {
    throw new ComponentExit(status.tag === "err" ? 1 : 0);
  },
  exitWithCode(code) {
    throw new ComponentExit(code);
  }
};
var stdinStream = new InputStream2({
  blockingRead(_len) {
  },
  subscribe() {
  },
  [symbolDispose2]() {
  }
});
var textDecoder = new TextDecoder();
var stdoutStream = new OutputStream2({
  write(contents) {
    if (contents[contents.length - 1] == 10) {
      contents = contents.subarray(0, contents.length - 1);
    }
    console.log(textDecoder.decode(contents));
  },
  blockingFlush() {
  },
  [symbolDispose2]() {
  }
});
var stderrStream = new OutputStream2({
  write(contents) {
    if (contents[contents.length - 1] == 10) {
      contents = contents.subarray(0, contents.length - 1);
    }
    console.error(textDecoder.decode(contents));
  },
  blockingFlush() {
  },
  [symbolDispose2]() {
  }
});
var stdin = {
  InputStream: InputStream2,
  getStdin() {
    return stdinStream;
  }
};
var stdout = {
  OutputStream: OutputStream2,
  getStdout() {
    return stdoutStream;
  }
};
var stderr = {
  OutputStream: OutputStream2,
  getStderr() {
    return stderrStream;
  }
};
var TerminalInput = class {
};
var TerminalOutput = class {
};
var terminalStdoutInstance = new TerminalOutput();
var terminalStderrInstance = new TerminalOutput();
var terminalStdinInstance = new TerminalInput();
var terminalInput = {
  TerminalInput
};
var terminalOutput = {
  TerminalOutput
};
var terminalStderr = {
  TerminalOutput,
  getTerminalStderr() {
    return terminalStderrInstance;
  }
};
var terminalStdin = {
  TerminalInput,
  getTerminalStdin() {
    return terminalStdinInstance;
  }
};
var terminalStdout = {
  TerminalOutput,
  getTerminalStdout() {
    return terminalStdoutInstance;
  }
};

// ../site/node_modules/@bytecodealliance/preview2-shim/lib/browser/filesystem.js
var { InputStream: InputStream3, OutputStream: OutputStream3 } = streams;
var _fileData = { dir: {} };
var timeZero = {
  seconds: BigInt(0),
  nanoseconds: 0
};
function getChildEntry(parentEntry, subpath, openFlags) {
  if (subpath === "." && _rootPreopen && descriptorGetEntry(_rootPreopen[0]) === parentEntry) {
    subpath = _getCwd();
    if (subpath.startsWith("/") && subpath !== "/") {
      subpath = subpath.slice(1);
    }
  }
  let entry = parentEntry;
  let segmentIdx;
  do {
    if (!entry || !entry.dir) {
      throw "not-directory";
    }
    segmentIdx = subpath.indexOf("/");
    const segment = segmentIdx === -1 ? subpath : subpath.slice(0, segmentIdx);
    if (segment === "..") {
      throw "no-entry";
    }
    if (segment === "." || segment === "") {
    } else if (!entry.dir[segment] && openFlags.create) {
      entry = entry.dir[segment] = openFlags.directory ? { dir: {} } : { source: new Uint8Array([]) };
    } else {
      entry = entry.dir[segment];
    }
    subpath = subpath.slice(segmentIdx + 1);
  } while (segmentIdx !== -1);
  if (!entry) {
    throw "no-entry";
  }
  return entry;
}
function getSource(fileEntry) {
  if (typeof fileEntry.source === "string") {
    fileEntry.source = new TextEncoder().encode(fileEntry.source);
  }
  return fileEntry.source;
}
var DirectoryEntryStream = class {
  constructor(entries) {
    this.idx = 0;
    this.entries = entries;
  }
  readDirectoryEntry() {
    if (this.idx === this.entries.length) {
      return null;
    }
    const [name, entry] = this.entries[this.idx];
    this.idx += 1;
    return {
      name,
      type: entry.dir ? "directory" : "regular-file"
    };
  }
};
var Descriptor = class _Descriptor {
  #stream;
  #entry;
  #mtime = 0;
  _getEntry(descriptor) {
    return descriptor.#entry;
  }
  constructor(entry, isStream) {
    if (isStream) {
      this.#stream = entry;
    } else {
      this.#entry = entry;
    }
  }
  readViaStream(_offset) {
    const source = getSource(this.#entry);
    let offset = Number(_offset);
    return new InputStream3({
      blockingRead(len) {
        if (offset === source.byteLength) {
          throw { tag: "closed" };
        }
        const bytes = source.slice(offset, offset + Number(len));
        offset += bytes.byteLength;
        return bytes;
      }
    });
  }
  writeViaStream(_offset) {
    const entry = this.#entry;
    let offset = Number(_offset);
    return new OutputStream3({
      write(buf) {
        const newSource = new Uint8Array(
          buf.byteLength + entry.source.byteLength
        );
        newSource.set(entry.source, 0);
        newSource.set(buf, offset);
        offset += buf.byteLength;
        entry.source = newSource;
        return buf.byteLength;
      }
    });
  }
  appendViaStream() {
    console.log(`[filesystem] APPEND STREAM`);
  }
  advise(descriptor, offset, length, advice) {
    console.log(`[filesystem] ADVISE`, descriptor, offset, length, advice);
  }
  syncData() {
    console.log(`[filesystem] SYNC DATA`);
  }
  getFlags() {
    console.log(`[filesystem] FLAGS FOR`);
  }
  getType() {
    if (this.#stream) {
      return "fifo";
    }
    if (this.#entry.dir) {
      return "directory";
    }
    if (this.#entry.source) {
      return "regular-file";
    }
    return "unknown";
  }
  setSize(size2) {
    console.log(`[filesystem] SET SIZE`, size2);
  }
  setTimes(dataAccessTimestamp, dataModificationTimestamp) {
    console.log(
      `[filesystem] SET TIMES`,
      dataAccessTimestamp,
      dataModificationTimestamp
    );
  }
  read(length, offset) {
    const source = getSource(this.#entry);
    return [
      source.slice(offset, offset + length),
      offset + length >= source.byteLength
    ];
  }
  write(buffer, offset) {
    if (offset !== 0) {
      throw "invalid-seek";
    }
    this.#entry.source = buffer;
    return buffer.byteLength;
  }
  readDirectory() {
    if (!this.#entry?.dir) {
      throw "bad-descriptor";
    }
    return new DirectoryEntryStream(
      Object.entries(this.#entry.dir).sort(([a], [b]) => a > b ? 1 : -1)
    );
  }
  sync() {
    console.log(`[filesystem] SYNC`);
  }
  createDirectoryAt(path) {
    const entry = getChildEntry(this.#entry, path, {
      create: true,
      directory: true
    });
    if (entry.source) {
      throw "exist";
    }
  }
  stat() {
    let type = "unknown", size2 = BigInt(0);
    if (this.#entry.source) {
      type = "regular-file";
      const source = getSource(this.#entry);
      size2 = BigInt(source.byteLength);
    } else if (this.#entry.dir) {
      type = "directory";
    }
    return {
      type,
      linkCount: BigInt(0),
      size: size2,
      dataAccessTimestamp: timeZero,
      dataModificationTimestamp: timeZero,
      statusChangeTimestamp: timeZero
    };
  }
  statAt(_pathFlags, path) {
    const entry = getChildEntry(this.#entry, path, {
      create: false,
      directory: false
    });
    let type = "unknown", size2 = BigInt(0);
    if (entry.source) {
      type = "regular-file";
      const source = getSource(entry);
      size2 = BigInt(source.byteLength);
    } else if (entry.dir) {
      type = "directory";
    }
    return {
      type,
      linkCount: BigInt(0),
      size: size2,
      dataAccessTimestamp: timeZero,
      dataModificationTimestamp: timeZero,
      statusChangeTimestamp: timeZero
    };
  }
  setTimesAt() {
    console.log(`[filesystem] SET TIMES AT`);
  }
  linkAt() {
    console.log(`[filesystem] LINK AT`);
  }
  openAt(_pathFlags, path, openFlags, _descriptorFlags, _modes) {
    const childEntry = getChildEntry(this.#entry, path, openFlags);
    return new _Descriptor(childEntry);
  }
  readlinkAt() {
    console.log(`[filesystem] READLINK AT`);
  }
  removeDirectoryAt() {
    console.log(`[filesystem] REMOVE DIR AT`);
  }
  renameAt() {
    console.log(`[filesystem] RENAME AT`);
  }
  symlinkAt() {
    console.log(`[filesystem] SYMLINK AT`);
  }
  unlinkFileAt() {
    console.log(`[filesystem] UNLINK FILE AT`);
  }
  isSameObject(other) {
    return other === this;
  }
  metadataHash() {
    let upper = BigInt(0);
    upper += BigInt(this.#mtime);
    return { upper, lower: BigInt(0) };
  }
  metadataHashAt(_pathFlags, _path) {
    let upper = BigInt(0);
    upper += BigInt(this.#mtime);
    return { upper, lower: BigInt(0) };
  }
};
var descriptorGetEntry = Descriptor.prototype._getEntry;
delete Descriptor.prototype._getEntry;
var _preopens = [[new Descriptor(_fileData), "/"]];
var _rootPreopen = _preopens[0];
var preopens = {
  getDirectories() {
    return _preopens;
  }
};
var types = {
  Descriptor,
  DirectoryEntryStream,
  filesystemErrorCode(err) {
    return convertFsError(err.payload);
  }
};
function convertFsError(e) {
  switch (e.code) {
    case "EACCES":
      return "access";
    case "EAGAIN":
    case "EWOULDBLOCK":
      return "would-block";
    case "EALREADY":
      return "already";
    case "EBADF":
      return "bad-descriptor";
    case "EBUSY":
      return "busy";
    case "EDEADLK":
      return "deadlock";
    case "EDQUOT":
      return "quota";
    case "EEXIST":
      return "exist";
    case "EFBIG":
      return "file-too-large";
    case "EILSEQ":
      return "illegal-byte-sequence";
    case "EINPROGRESS":
      return "in-progress";
    case "EINTR":
      return "interrupted";
    case "EINVAL":
      return "invalid";
    case "EIO":
      return "io";
    case "EISDIR":
      return "is-directory";
    case "ELOOP":
      return "loop";
    case "EMLINK":
      return "too-many-links";
    case "EMSGSIZE":
      return "message-size";
    case "ENAMETOOLONG":
      return "name-too-long";
    case "ENODEV":
      return "no-device";
    case "ENOENT":
      return "no-entry";
    case "ENOLCK":
      return "no-lock";
    case "ENOMEM":
      return "insufficient-memory";
    case "ENOSPC":
      return "insufficient-space";
    case "ENOTDIR":
    case "ERR_FS_EISDIR":
      return "not-directory";
    case "ENOTEMPTY":
      return "not-empty";
    case "ENOTRECOVERABLE":
      return "not-recoverable";
    case "ENOTSUP":
      return "unsupported";
    case "ENOTTY":
      return "no-tty";
    // windows gives this error for badly structured `//` reads
    // this seems like a slightly better error than unknown given
    // that it's a common footgun
    case -4094:
    case "ENXIO":
      return "no-such-device";
    case "EOVERFLOW":
      return "overflow";
    case "EPERM":
      return "not-permitted";
    case "EPIPE":
      return "pipe";
    case "EROFS":
      return "read-only";
    case "ESPIPE":
      return "invalid-seek";
    case "ETXTBSY":
      return "text-file-busy";
    case "EXDEV":
      return "cross-device";
    case "UNKNOWN":
      switch (e.errno) {
        case -4094:
          return "no-such-device";
        default:
          throw e;
      }
    default:
      throw e;
  }
}

// ../site/node_modules/@bytecodealliance/preview2-shim/lib/browser/random.js
var MAX_BYTES = 65536;
var insecureRandomValue1;
var insecureRandomValue2;
var random = {
  getRandomBytes(len) {
    const bytes = new Uint8Array(Number(len));
    if (len > MAX_BYTES) {
      for (var generated = 0; generated < len; generated += MAX_BYTES) {
        crypto.getRandomValues(
          bytes.subarray(generated, generated + MAX_BYTES)
        );
      }
    } else {
      crypto.getRandomValues(bytes);
    }
    return bytes;
  },
  getRandomU64() {
    return crypto.getRandomValues(new BigUint64Array(1))[0];
  },
  insecureRandom() {
    if (insecureRandomValue1 === void 0) {
      insecureRandomValue1 = random.getRandomU64();
      insecureRandomValue2 = random.getRandomU64();
    }
    return [insecureRandomValue1, insecureRandomValue2];
  }
};

// ../site/node_modules/@bytecodealliance/jco/obj/js-component-bindgen-component.js
var { getEnvironment } = environment;
getEnvironment._isHostProvided = true;
if (getEnvironment === void 0) {
  const err = new Error("unexpectedly undefined local import 'getEnvironment', was 'getEnvironment' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { exit: exit2 } = exit;
exit2._isHostProvided = true;
if (exit2 === void 0) {
  const err = new Error("unexpectedly undefined local import 'exit', was 'exit' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getStderr } = stderr;
getStderr._isHostProvided = true;
if (getStderr === void 0) {
  const err = new Error("unexpectedly undefined local import 'getStderr', was 'getStderr' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getStdin } = stdin;
getStdin._isHostProvided = true;
if (getStdin === void 0) {
  const err = new Error("unexpectedly undefined local import 'getStdin', was 'getStdin' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getStdout } = stdout;
getStdout._isHostProvided = true;
if (getStdout === void 0) {
  const err = new Error("unexpectedly undefined local import 'getStdout', was 'getStdout' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { TerminalInput: TerminalInput2 } = terminalInput;
TerminalInput2._isHostProvided = true;
if (TerminalInput2 === void 0) {
  const err = new Error("unexpectedly undefined local import 'TerminalInput', was 'TerminalInput' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { TerminalOutput: TerminalOutput2 } = terminalOutput;
TerminalOutput2._isHostProvided = true;
if (TerminalOutput2 === void 0) {
  const err = new Error("unexpectedly undefined local import 'TerminalOutput', was 'TerminalOutput' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getTerminalStderr } = terminalStderr;
getTerminalStderr._isHostProvided = true;
if (getTerminalStderr === void 0) {
  const err = new Error("unexpectedly undefined local import 'getTerminalStderr', was 'getTerminalStderr' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getTerminalStdin } = terminalStdin;
getTerminalStdin._isHostProvided = true;
if (getTerminalStdin === void 0) {
  const err = new Error("unexpectedly undefined local import 'getTerminalStdin', was 'getTerminalStdin' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getTerminalStdout } = terminalStdout;
getTerminalStdout._isHostProvided = true;
if (getTerminalStdout === void 0) {
  const err = new Error("unexpectedly undefined local import 'getTerminalStdout', was 'getTerminalStdout' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getDirectories } = preopens;
getDirectories._isHostProvided = true;
if (getDirectories === void 0) {
  const err = new Error("unexpectedly undefined local import 'getDirectories', was 'getDirectories' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var {
  Descriptor: Descriptor2,
  DirectoryEntryStream: DirectoryEntryStream2,
  filesystemErrorCode
} = types;
Descriptor2._isHostProvided = true;
if (Descriptor2 === void 0) {
  const err = new Error("unexpectedly undefined local import 'Descriptor', was 'Descriptor' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
DirectoryEntryStream2._isHostProvided = true;
if (DirectoryEntryStream2 === void 0) {
  const err = new Error("unexpectedly undefined local import 'DirectoryEntryStream', was 'DirectoryEntryStream' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
filesystemErrorCode._isHostProvided = true;
if (filesystemErrorCode === void 0) {
  const err = new Error("unexpectedly undefined local import 'filesystemErrorCode', was 'filesystemErrorCode' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { Error: Error$1 } = error;
Error$1._isHostProvided = true;
if (Error$1 === void 0) {
  const err = new Error("unexpectedly undefined local import 'Error$1', was 'Error' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var {
  InputStream: InputStream4,
  OutputStream: OutputStream4
} = streams;
InputStream4._isHostProvided = true;
if (InputStream4 === void 0) {
  const err = new Error("unexpectedly undefined local import 'InputStream', was 'InputStream' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
OutputStream4._isHostProvided = true;
if (OutputStream4 === void 0) {
  const err = new Error("unexpectedly undefined local import 'OutputStream', was 'OutputStream' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var { getRandomBytes } = random;
getRandomBytes._isHostProvided = true;
if (getRandomBytes === void 0) {
  const err = new Error("unexpectedly undefined local import 'getRandomBytes', was 'getRandomBytes' available at instantiation?");
  console.error("ERROR:", err.toString());
  throw err;
}
var _debugLog = (...args) => {
  if (!globalThis?.process?.env?.JCO_DEBUG) {
    return;
  }
  console.debug(...args);
};
var ASYNC_DETERMINISM = "random";
var GlobalComponentAsyncLowers = class _GlobalComponentAsyncLowers {
  static map = /* @__PURE__ */ new Map();
  constructor() {
    throw new Error("GlobalComponentAsyncLowers should not be constructed");
  }
  static define(args) {
    const { componentIdx, qualifiedImportFn, fn } = args;
    let inner = _GlobalComponentAsyncLowers.map.get(componentIdx);
    if (!inner) {
      inner = /* @__PURE__ */ new Map();
      _GlobalComponentAsyncLowers.map.set(componentIdx, inner);
    }
    inner.set(qualifiedImportFn, fn);
  }
  static lookup(componentIdx, qualifiedImportFn) {
    let inner = _GlobalComponentAsyncLowers.map.get(componentIdx);
    if (!inner) {
      inner = /* @__PURE__ */ new Map();
      _GlobalComponentAsyncLowers.map.set(componentIdx, inner);
    }
    const found = inner.get(qualifiedImportFn);
    if (found) {
      return found;
    }
    if (qualifiedImportFn.includes("[stream-write-") || qualifiedImportFn.includes("[stream-read-")) {
      return async (...args) => {
        const [originalFn, ...params2] = args;
        return await originalFn(...params2);
      };
    }
    return (...args) => {
      const [originalFn, ...params2] = args;
      return originalFn(...params2);
    };
  }
};
var GlobalComponentMemories = class _GlobalComponentMemories {
  static map = /* @__PURE__ */ new Map();
  constructor() {
    throw new Error("GlobalComponentMemories should not be constructed");
  }
  static save(args) {
    const { idx, componentIdx, memory: memory2 } = args;
    let inner = _GlobalComponentMemories.map.get(componentIdx);
    if (!inner) {
      inner = [];
      _GlobalComponentMemories.map.set(componentIdx, inner);
    }
    inner.push({ memory: memory2, idx });
  }
  static getMemoriesForComponentIdx(componentIdx) {
    const metas = _GlobalComponentMemories.map.get(componentIdx);
    return metas.map((meta) => meta.memory);
  }
  static getMemory(componentIdx, idx) {
    const metas = _GlobalComponentMemories.map.get(componentIdx);
    return metas.find((meta) => meta.idx === idx)?.memory;
  }
};
var RepTable = class {
  #data = [0, null];
  #target;
  constructor(args) {
    this.target = args?.target;
  }
  insert(val) {
    _debugLog("[RepTable#insert()] args", { val, target: this.target });
    const freeIdx = this.#data[0];
    if (freeIdx === 0) {
      this.#data.push(val);
      this.#data.push(null);
      return (this.#data.length >> 1) - 1;
    }
    this.#data[0] = this.#data[freeIdx << 1];
    const placementIdx = freeIdx << 1;
    this.#data[placementIdx] = val;
    this.#data[placementIdx + 1] = null;
    return freeIdx;
  }
  get(rep2) {
    _debugLog("[RepTable#get()] args", { rep: rep2, target: this.target });
    const baseIdx = rep2 << 1;
    const val = this.#data[baseIdx];
    return val;
  }
  contains(rep2) {
    _debugLog("[RepTable#contains()] args", { rep: rep2, target: this.target });
    const baseIdx = rep2 << 1;
    return !!this.#data[baseIdx];
  }
  remove(rep2) {
    _debugLog("[RepTable#remove()] args", { rep: rep2, target: this.target });
    if (this.#data.length === 2) {
      throw new Error("invalid");
    }
    const baseIdx = rep2 << 1;
    const val = this.#data[baseIdx];
    if (val === 0) {
      throw new Error("invalid resource rep (cannot be 0)");
    }
    this.#data[baseIdx] = this.#data[0];
    this.#data[0] = rep2;
    return val;
  }
  clear() {
    _debugLog("[RepTable#clear()] args", { rep, target: this.target });
    this.#data = [0, null];
  }
};
var _coinFlip = () => {
  return Math.random() > 0.5;
};
var ASYNC_FN_CTOR = (async () => {
}).constructor;
var ASYNC_CURRENT_TASK_IDS = [];
var ASYNC_CURRENT_COMPONENT_IDXS = [];
function promiseWithResolvers() {
  if (Promise.withResolvers) {
    return Promise.withResolvers();
  } else {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }
}
var dv = new DataView(new ArrayBuffer());
var dataView = (mem) => dv.buffer === mem.buffer ? dv : dv = new DataView(mem.buffer);
var toUint64 = (val) => BigInt.asUintN(64, BigInt(val));
function toUint32(val) {
  return val >>> 0;
}
var TEXT_DECODER_UTF8 = new TextDecoder();
var TEXT_ENCODER_UTF8 = new TextEncoder();
function _utf8AllocateAndEncode(s, realloc, memory2) {
  if (typeof s !== "string") {
    throw new TypeError("expected a string, received [" + typeof s + "]");
  }
  if (s.length === 0) {
    return { ptr: 1, len: 0 };
  }
  let buf = TEXT_ENCODER_UTF8.encode(s);
  let ptr = realloc(0, 0, 1, buf.length);
  new Uint8Array(memory2.buffer).set(buf, ptr);
  return { ptr, len: buf.length, codepoints: [...s].length };
}
var T_FLAG = 1 << 30;
function rscTableCreateOwn(table, rep2) {
  const free = table[0] & ~T_FLAG;
  if (free === 0) {
    table.push(0);
    table.push(rep2 | T_FLAG);
    return (table.length >> 1) - 1;
  }
  table[0] = table[free << 1];
  table[free << 1] = 0;
  table[(free << 1) + 1] = rep2 | T_FLAG;
  return free;
}
function rscTableRemove(table, handle) {
  const scope = table[handle << 1];
  const val = table[(handle << 1) + 1];
  const own = (val & T_FLAG) !== 0;
  const rep2 = val & ~T_FLAG;
  if (val === 0 || (scope & T_FLAG) !== 0) {
    throw new TypeError("Invalid handle");
  }
  table[handle << 1] = table[0] | T_FLAG;
  table[0] = handle | T_FLAG;
  return { rep: rep2, scope, own };
}
var curResourceBorrows = [];
function getCurrentTask(componentIdx) {
  if (componentIdx === void 0 || componentIdx === null) {
    throw new Error("missing/invalid component instance index [" + componentIdx + "] while getting current task");
  }
  const tasks = ASYNC_TASKS_BY_COMPONENT_IDX.get(componentIdx);
  if (tasks === void 0) {
    return void 0;
  }
  if (tasks.length === 0) {
    return void 0;
  }
  return tasks[tasks.length - 1];
}
function createNewCurrentTask(args) {
  _debugLog("[createNewCurrentTask()] args", args);
  const {
    componentIdx,
    isAsync,
    entryFnName,
    parentSubtaskID,
    callbackFnName,
    getCallbackFn,
    getParamsFn,
    stringEncoding,
    errHandling,
    getCalleeParamsFn,
    resultPtr,
    callingWasmExport
  } = args;
  if (componentIdx === void 0 || componentIdx === null) {
    throw new Error("missing/invalid component instance index while starting task");
  }
  const taskMetas = ASYNC_TASKS_BY_COMPONENT_IDX.get(componentIdx);
  const callbackFn = getCallbackFn ? getCallbackFn() : null;
  const newTask = new AsyncTask({
    componentIdx,
    isAsync,
    entryFnName,
    callbackFn,
    callbackFnName,
    stringEncoding,
    getCalleeParamsFn,
    resultPtr,
    errHandling
  });
  const newTaskID = newTask.id();
  const newTaskMeta = { id: newTaskID, componentIdx, task: newTask };
  ASYNC_CURRENT_TASK_IDS.push(newTaskID);
  ASYNC_CURRENT_COMPONENT_IDXS.push(componentIdx);
  if (!taskMetas) {
    ASYNC_TASKS_BY_COMPONENT_IDX.set(componentIdx, [newTaskMeta]);
  } else {
    taskMetas.push(newTaskMeta);
  }
  return [newTask, newTaskID];
}
function endCurrentTask(componentIdx, taskID) {
  componentIdx ??= ASYNC_CURRENT_COMPONENT_IDXS.at(-1);
  taskID ??= ASYNC_CURRENT_TASK_IDS.at(-1);
  _debugLog("[endCurrentTask()] args", { componentIdx, taskID });
  if (componentIdx === void 0 || componentIdx === null) {
    throw new Error("missing/invalid component instance index while ending current task");
  }
  const tasks = ASYNC_TASKS_BY_COMPONENT_IDX.get(componentIdx);
  if (!tasks || !Array.isArray(tasks)) {
    throw new Error("missing/invalid tasks for component instance while ending task");
  }
  if (tasks.length == 0) {
    throw new Error("no current task(s) for component instance while ending task");
  }
  if (taskID) {
    const last = tasks[tasks.length - 1];
    if (last.id !== taskID) {
      return;
    }
  }
  ASYNC_CURRENT_TASK_IDS.pop();
  ASYNC_CURRENT_COMPONENT_IDXS.pop();
  const taskMeta = tasks.pop();
  return taskMeta.task;
}
var ASYNC_TASKS_BY_COMPONENT_IDX = /* @__PURE__ */ new Map();
var AsyncTask = class _AsyncTask {
  static _ID = 0n;
  static State = {
    INITIAL: "initial",
    CANCELLED: "cancelled",
    CANCEL_PENDING: "cancel-pending",
    CANCEL_DELIVERED: "cancel-delivered",
    RESOLVED: "resolved"
  };
  static BlockResult = {
    CANCELLED: "block.cancelled",
    NOT_CANCELLED: "block.not-cancelled"
  };
  #id;
  #componentIdx;
  #state;
  #isAsync;
  #entryFnName = null;
  #subtasks = [];
  #onResolveHandlers = [];
  #completionPromise = null;
  #memoryIdx = null;
  #callbackFn = null;
  #callbackFnName = null;
  #postReturnFn = null;
  #getCalleeParamsFn = null;
  #stringEncoding = null;
  #parentSubtask = null;
  #needsExclusiveLock = false;
  #errHandling;
  #backpressurePromise;
  #backpressureWaiters = 0n;
  #returnLowerFns = null;
  cancelled = false;
  requested = false;
  alwaysTaskReturn = false;
  returnCalls = 0;
  storage = [0, 0];
  borrowedHandles = {};
  awaitableResume = null;
  awaitableCancel = null;
  constructor(opts) {
    this.#id = ++_AsyncTask._ID;
    if (opts?.componentIdx === void 0) {
      throw new TypeError("missing component id during task creation");
    }
    this.#componentIdx = opts.componentIdx;
    this.#state = _AsyncTask.State.INITIAL;
    this.#isAsync = opts?.isAsync ?? false;
    this.#entryFnName = opts.entryFnName;
    const {
      promise: completionPromise,
      resolve: resolveCompletionPromise,
      reject: rejectCompletionPromise
    } = promiseWithResolvers();
    this.#completionPromise = completionPromise;
    this.#onResolveHandlers.push((results) => {
      resolveCompletionPromise(results);
    });
    if (opts.callbackFn) {
      this.#callbackFn = opts.callbackFn;
    }
    if (opts.callbackFnName) {
      this.#callbackFnName = opts.callbackFnName;
    }
    if (opts.getCalleeParamsFn) {
      this.#getCalleeParamsFn = opts.getCalleeParamsFn;
    }
    if (opts.stringEncoding) {
      this.#stringEncoding = opts.stringEncoding;
    }
    if (opts.parentSubtask) {
      this.#parentSubtask = opts.parentSubtask;
    }
    this.#needsExclusiveLock = this.isSync() || !this.hasCallback();
    if (opts.errHandling) {
      this.#errHandling = opts.errHandling;
    }
  }
  taskState() {
    return this.#state;
  }
  id() {
    return this.#id;
  }
  componentIdx() {
    return this.#componentIdx;
  }
  isAsync() {
    return this.#isAsync;
  }
  entryFnName() {
    return this.#entryFnName;
  }
  completionPromise() {
    return this.#completionPromise;
  }
  isAsync() {
    return this.#isAsync;
  }
  isSync() {
    return !this.isAsync();
  }
  getErrHandling() {
    return this.#errHandling;
  }
  hasCallback() {
    return this.#callbackFn !== null;
  }
  setReturnMemoryIdx(idx) {
    this.#memoryIdx = idx;
  }
  getReturnMemoryIdx() {
    return this.#memoryIdx;
  }
  setReturnLowerFns(fns) {
    this.#returnLowerFns = fns;
  }
  getReturnLowerFns() {
    return this.#returnLowerFns;
  }
  setParentSubtask(subtask) {
    if (!subtask || !(subtask instanceof AsyncSubtask)) {
      return;
    }
    if (this.#parentSubtask) {
      throw new Error("parent subtask can only be set once");
    }
    this.#parentSubtask = subtask;
  }
  getParentSubtask() {
    return this.#parentSubtask;
  }
  // TODO(threads): this is very inefficient, we can pass along a root task,
  // and ideally do not need this once thread support is in place
  getRootTask() {
    let currentSubtask = this.getParentSubtask();
    let task = this;
    while (currentSubtask) {
      task = currentSubtask.getParentTask();
      currentSubtask = task.getParentSubtask();
    }
    return task;
  }
  setPostReturnFn(f) {
    if (!f) {
      return;
    }
    if (this.#postReturnFn) {
      throw new Error("postReturn fn can only be set once");
    }
    this.#postReturnFn = f;
  }
  setCallbackFn(f, name) {
    if (!f) {
      return;
    }
    if (this.#callbackFn) {
      throw new Error("callback fn can only be set once");
    }
    this.#callbackFn = f;
    this.#callbackFnName = name;
  }
  getCallbackFnName() {
    if (!this.#callbackFnName) {
      return void 0;
    }
    return this.#callbackFnName;
  }
  runCallbackFn(...args) {
    if (!this.#callbackFn) {
      throw new Error("on callback function has been set for task");
    }
    return this.#callbackFn.apply(null, args);
  }
  getCalleeParams() {
    if (!this.#getCalleeParamsFn) {
      throw new Error("missing/invalid getCalleeParamsFn");
    }
    return this.#getCalleeParamsFn();
  }
  mayEnter(task) {
    const cstate = getOrCreateAsyncState(this.#componentIdx);
    if (cstate.hasBackpressure()) {
      _debugLog("[AsyncTask#mayEnter()] disallowed due to backpressure", { taskID: this.#id });
      return false;
    }
    if (!cstate.callingSyncImport()) {
      _debugLog("[AsyncTask#mayEnter()] disallowed due to sync import call", { taskID: this.#id });
      return false;
    }
    const callingSyncExportWithSyncPending = cstate.callingSyncExport && !task.isAsync;
    if (!callingSyncExportWithSyncPending) {
      _debugLog("[AsyncTask#mayEnter()] disallowed due to sync export w/ sync pending", { taskID: this.#id });
      return false;
    }
    return true;
  }
  async enter() {
    _debugLog("[AsyncTask#enter()] args", { taskID: this.#id });
    const cstate = getOrCreateAsyncState(this.#componentIdx);
    if (this.isSync()) {
      return true;
    }
    if (cstate.hasBackpressure()) {
      cstate.addBackpressureWaiter();
      const result = await this.waitUntil({
        readyFn: () => !cstate.hasBackpressure(),
        cancellable: true
      });
      cstate.removeBackpressureWaiter();
      if (result === _AsyncTask.BlockResult.CANCELLED) {
        this.cancel();
        return false;
      }
    }
    if (this.needsExclusiveLock()) {
      cstate.exclusiveLock();
    }
    return true;
  }
  isRunning() {
    return this.#state !== _AsyncTask.State.RESOLVED;
  }
  async waitUntil(opts) {
    const { readyFn, waitableSetRep, cancellable } = opts;
    _debugLog("[AsyncTask#waitUntil()] args", { taskID: this.#id, waitableSetRep, cancellable });
    const state = getOrCreateAsyncState(this.#componentIdx);
    const wset = state.waitableSets.get(waitableSetRep);
    let event;
    wset.incrementNumWaiting();
    const keepGoing = await this.suspendUntil({
      readyFn: () => {
        const hasPendingEvent = wset.hasPendingEvent();
        return readyFn() && hasPendingEvent;
      },
      cancellable
    });
    if (keepGoing) {
      event = wset.getPendingEvent();
    } else {
      event = {
        code: ASYNC_EVENT_CODE.TASK_CANCELLED,
        index: 0,
        result: 0
      };
    }
    wset.decrementNumWaiting();
    return event;
  }
  async onBlock(awaitable) {
    _debugLog("[AsyncTask#onBlock()] args", { taskID: this.#id, awaitable });
    if (!(awaitable instanceof Awaitable)) {
      throw new Error("invalid awaitable during onBlock");
    }
    const { promise, resolve, reject } = promiseWithResolvers();
    this.awaitableResume = () => {
      _debugLog("[AsyncTask] resuming after onBlock", { taskID: this.#id });
      resolve();
    };
    this.awaitableCancel = (err) => {
      _debugLog("[AsyncTask] rejecting after onBlock", { taskID: this.#id, err });
      reject(err);
    };
    const state = getOrCreateAsyncState(this.#componentIdx);
    state.parkTaskOnAwaitable({ awaitable, task: this });
    try {
      await promise;
      return _AsyncTask.BlockResult.NOT_CANCELLED;
    } catch (err) {
      return _AsyncTask.BlockResult.CANCELLED;
    }
  }
  async asyncOnBlock(awaitable) {
    _debugLog("[AsyncTask#asyncOnBlock()] args", { taskID: this.#id, awaitable });
    if (!(awaitable instanceof Awaitable)) {
      throw new Error("invalid awaitable during onBlock");
    }
    throw new Error("AsyncTask#asyncOnBlock() not yet implemented");
  }
  async yieldUntil(opts) {
    const { readyFn, cancellable } = opts;
    _debugLog("[AsyncTask#yieldUntil()] args", { taskID: this.#id, cancellable });
    const keepGoing = await this.suspendUntil({ readyFn, cancellable });
    if (!keepGoing) {
      return {
        code: ASYNC_EVENT_CODE.TASK_CANCELLED,
        index: 0,
        result: 0
      };
    }
    return {
      code: ASYNC_EVENT_CODE.NONE,
      index: 0,
      result: 0
    };
  }
  async suspendUntil(opts) {
    const { cancellable, readyFn } = opts;
    _debugLog("[AsyncTask#suspendUntil()] args", { cancellable });
    const pendingCancelled = this.deliverPendingCancel({ cancellable });
    if (pendingCancelled) {
      return false;
    }
    const completed = await this.immediateSuspendUntil({ readyFn, cancellable });
    return completed;
  }
  // TODO(threads): equivalent to thread.suspend_until()
  async immediateSuspendUntil(opts) {
    const { cancellable, readyFn } = opts;
    _debugLog("[AsyncTask#immediateSuspendUntil()] args", { cancellable, readyFn });
    const ready = readyFn();
    if (ready && !ASYNC_DETERMINISM && _coinFlip()) {
      return true;
    }
    const cstate = getOrCreateAsyncState(this.#componentIdx);
    cstate.addPendingTask(this);
    const keepGoing = await this.immediateSuspend({ cancellable, readyFn });
    return keepGoing;
  }
  async immediateSuspend(opts) {
    const { cancellable, readyFn } = opts;
    _debugLog("[AsyncTask#immediateSuspend()] args", { cancellable, readyFn });
    const pendingCancelled = this.deliverPendingCancel({ cancellable });
    if (pendingCancelled) {
      return false;
    }
    const cstate = getOrCreateAsyncState(this.#componentIdx);
    setTimeout(() => cstate.tick(), 0);
    const taskWait = await cstate.suspendTask({ task: this, readyFn });
    const keepGoing = await taskWait;
    return keepGoing;
  }
  deliverPendingCancel(opts) {
    const { cancellable } = opts;
    _debugLog("[AsyncTask#deliverPendingCancel()] args", { cancellable });
    if (cancellable && this.#state === _AsyncTask.State.PENDING_CANCEL) {
      this.#state = Task.State.CANCEL_DELIVERED;
      return true;
    }
    return false;
  }
  isCancelled() {
    return this.cancelled;
  }
  cancel() {
    _debugLog("[AsyncTask#cancel()] args", {});
    if (!this.taskState() !== _AsyncTask.State.CANCEL_DELIVERED) {
      throw new Error(`(component [${this.#componentIdx}]) task [${this.#id}] invalid task state for cancellation`);
    }
    if (this.borrowedHandles.length > 0) {
      throw new Error("task still has borrow handles");
    }
    this.cancelled = true;
    this.onResolve(new Error("cancelled"));
    this.#state = _AsyncTask.State.RESOLVED;
  }
  onResolve(taskValue) {
    for (const f of this.#onResolveHandlers) {
      try {
        f(taskValue);
      } catch (err) {
        console.error("error during task resolve handler", err);
        throw err;
      }
    }
    if (this.#postReturnFn) {
      _debugLog("[AsyncTask#onResolve()] running post return ", {
        componentIdx: this.#componentIdx,
        taskID: this.#id
      });
      this.#postReturnFn();
    }
  }
  registerOnResolveHandler(f) {
    this.#onResolveHandlers.push(f);
  }
  resolve(results) {
    _debugLog("[AsyncTask#resolve()] args", {
      results,
      componentIdx: this.#componentIdx,
      taskID: this.#id
    });
    if (this.#state === _AsyncTask.State.RESOLVED) {
      throw new Error(`(component [${this.#componentIdx}]) task [${this.#id}]  is already resolved (did you forget to wait for an import?)`);
    }
    if (this.borrowedHandles.length > 0) {
      throw new Error("task still has borrow handles");
    }
    switch (results.length) {
      case 0:
        this.onResolve(void 0);
        break;
      case 1:
        this.onResolve(results[0]);
        break;
      default:
        throw new Error("unexpected number of results");
    }
    this.#state = _AsyncTask.State.RESOLVED;
  }
  exit() {
    _debugLog("[AsyncTask#exit()] args", {});
    if (this.#state !== _AsyncTask.State.RESOLVED) {
      _debugLog("[AsyncTask#exit()] task exited without resolution", {
        componentIdx: this.#componentIdx,
        taskID: this.#id,
        subtask: this.getParentSubtask(),
        subtaskID: this.getParentSubtask()?.id()
      });
      this.#state = _AsyncTask.State.RESOLVED;
    }
    if (this.borrowedHandles > 0) {
      throw new Error("task [${this.#id}] exited without clearing borrowed handles");
    }
    const state = getOrCreateAsyncState(this.#componentIdx);
    if (!state) {
      throw new Error("missing async state for component [" + this.#componentIdx + "]");
    }
    if (!this.#isAsync && !state.inSyncExportCall) {
      throw new Error("sync task must be run from components known to be in a sync export call");
    }
    state.inSyncExportCall = false;
    if (this.needsExclusiveLock() && !state.isExclusivelyLocked()) {
      throw new Error("task [" + this.#id + "] exit: component [" + this.#componentIdx + "] should have been exclusively locked");
    }
    state.exclusiveRelease();
  }
  needsExclusiveLock() {
    return this.#needsExclusiveLock;
  }
  createSubtask(args) {
    _debugLog("[AsyncTask#createSubtask()] args", args);
    const { componentIdx, childTask, callMetadata } = args;
    const newSubtask = new AsyncSubtask({
      componentIdx,
      childTask,
      parentTask: this,
      callMetadata
    });
    this.#subtasks.push(newSubtask);
    return newSubtask;
  }
  getLatestSubtask() {
    return this.#subtasks.at(-1);
  }
  currentSubtask() {
    _debugLog("[AsyncTask#currentSubtask()]");
    if (this.#subtasks.length === 0) {
      return void 0;
    }
    return this.#subtasks.at(-1);
  }
  endCurrentSubtask() {
    _debugLog("[AsyncTask#endCurrentSubtask()]");
    if (this.#subtasks.length === 0) {
      throw new Error("cannot end current subtask: no current subtask");
    }
    const subtask = this.#subtasks.pop();
    subtask.drop();
    return subtask;
  }
};
function _lowerImport(args, exportFn) {
  const params2 = [...arguments].slice(2);
  _debugLog("[_lowerImport()] args", { args, params: params2, exportFn });
  const {
    functionIdx,
    componentIdx,
    isAsync,
    paramLiftFns,
    resultLowerFns,
    metadata,
    memoryIdx,
    getMemoryFn,
    getReallocFn
  } = args;
  const parentTaskMeta = getCurrentTask(componentIdx);
  const parentTask = parentTaskMeta?.task;
  if (!parentTask) {
    throw new Error("missing parent task during lower of import");
  }
  const cstate = getOrCreateAsyncState(componentIdx);
  const subtask = parentTask.createSubtask({
    componentIdx,
    parentTask,
    callMetadata: {
      memoryIdx,
      memory: getMemoryFn(),
      realloc: getReallocFn(),
      resultPtr: params2[0]
    }
  });
  parentTask.setReturnMemoryIdx(memoryIdx);
  const rep2 = cstate.subtasks.insert(subtask);
  subtask.setRep(rep2);
  subtask.setOnProgressFn(() => {
    subtask.setPendingEventFn(() => {
      if (subtask.resolved()) {
        subtask.deliverResolve();
      }
      return {
        code: ASYNC_EVENT_CODE.SUBTASK,
        index: rep2,
        result: subtask.getStateNumber()
      };
    });
  });
  subtask.registerOnResolveHandler((res) => {
    _debugLog("[_lowerImport()] handling subtask result", { res, subtaskID: subtask.id() });
    const { memory: memory2, resultPtr, realloc } = subtask.getCallMetadata();
    if (resultLowerFns.length === 0) {
      return;
    }
    resultLowerFns[0]({ componentIdx, memory: memory2, realloc, vals: [res], storagePtr: resultPtr });
  });
  const subtaskState = subtask.getStateNumber();
  if (subtaskState < 0 || subtaskState > 2 ** 5) {
    throw new Error("invalid subtask state, out of valid range");
  }
  setTimeout(async () => {
    try {
      _debugLog("[_lowerImport()] calling lowered import", { exportFn, params: params2 });
      exportFn.apply(null, params2);
      const task = subtask.getChildTask();
      task.registerOnResolveHandler((res) => {
        _debugLog("[_lowerImport()] cascading subtask completion", {
          childTaskID: task.id(),
          subtaskID: subtask.id(),
          parentTaskID: parentTask.id()
        });
        subtask.onResolve(res);
        cstate.tick();
      });
    } catch (err) {
      console.error("post-lower import fn error:", err);
      throw err;
    }
  }, 100);
  return Number(subtask.waitableRep()) << 4 | subtaskState;
}
function _liftFlatU8(ctx) {
  _debugLog("[_liftFlatU8()] args", { ctx });
  let val;
  if (ctx.useDirectParams) {
    if (ctx.params.length === 0) {
      throw new Error("expected at least a single i32 argument");
    }
    val = ctx.params[0];
    ctx.params = ctx.params.slice(1);
    return [val, ctx];
  }
  if (ctx.storageLen !== void 0 && ctx.storageLen < ctx.storagePtr + 1) {
    throw new Error("not enough storage remaining for lift");
  }
  val = new DataView(ctx.memory.buffer).getUint8(ctx.storagePtr, true);
  ctx.storagePtr += 1;
  if (ctx.storageLen !== void 0) {
    ctx.storageLen -= 1;
  }
  return [val, ctx];
}
function _liftFlatU16(ctx) {
  _debugLog("[_liftFlatU16()] args", { ctx });
  let val;
  if (ctx.useDirectParams) {
    if (params.length === 0) {
      throw new Error("expected at least a single i32 argument");
    }
    val = ctx.params[0];
    ctx.params = ctx.params.slice(1);
    return [val, ctx];
  }
  if (ctx.storageLen !== void 0 && ctx.storageLen < ctx.storagePtr + 2) {
    throw new Error("not enough storage remaining for lift");
  }
  val = new DataView(ctx.memory.buffer).getUint16(ctx.storagePtr, true);
  ctx.storagePtr += 2;
  if (ctx.storageLen !== void 0) {
    ctx.storageLen -= 2;
  }
  return [val, ctx];
}
function _liftFlatU32(ctx) {
  _debugLog("[_liftFlatU32()] args", { ctx });
  let val;
  if (ctx.useDirectParams) {
    if (ctx.params.length === 0) {
      throw new Error("expected at least a single i34 argument");
    }
    val = ctx.params[0];
    ctx.params = ctx.params.slice(1);
    return [val, ctx];
  }
  if (ctx.storageLen !== void 0 && ctx.storageLen < ctx.storagePtr + 4) {
    throw new Error("not enough storage remaining for lift");
  }
  val = new DataView(ctx.memory.buffer).getUint32(ctx.storagePtr, true);
  ctx.storagePtr += 4;
  if (ctx.storageLen !== void 0) {
    ctx.storageLen -= 4;
  }
  return [val, ctx];
}
function _liftFlatU64(ctx) {
  _debugLog("[_liftFlatU64()] args", { ctx });
  let val;
  if (ctx.useDirectParams) {
    if (ctx.params.length === 0) {
      throw new Error("expected at least one single i64 argument");
    }
    if (typeof ctx.params[0] !== "bigint") {
      throw new Error("expected bigint");
    }
    val = ctx.params[0];
    ctx.params = ctx.params.slice(1);
    return [val, ctx];
  }
  if (ctx.storageLen !== void 0 && ctx.storageLen < ctx.storagePtr + 8) {
    throw new Error("not enough storage remaining for lift");
  }
  val = new DataView(ctx.memory.buffer).getUint64(ctx.storagePtr, true);
  ctx.storagePtr += 8;
  if (ctx.storageLen !== void 0) {
    ctx.storageLen -= 8;
  }
  return [val, ctx];
}
function _liftFlatStringUTF8(ctx) {
  _debugLog("[_liftFlatStringUTF8()] args", { ctx });
  let val;
  if (ctx.useDirectParams) {
    if (ctx.params.length < 2) {
      throw new Error("expected at least two u32 arguments");
    }
    const offset = ctx.params[0];
    if (!Number.isSafeInteger(offset)) {
      throw new Error("invalid offset");
    }
    const len = ctx.params[1];
    if (!Number.isSafeInteger(len)) {
      throw new Error("invalid len");
    }
    val = TEXT_DECODER_UTF8.decode(new DataView(ctx.memory.buffer, offset, len));
    ctx.params = ctx.params.slice(2);
    return [val, ctx];
  }
  const start = new DataView(ctx.memory.buffer).getUint32(ctx.storagePtr, params[0], true);
  const codeUnits = new DataView(memory.buffer).getUint32(ctx.storagePtr, params[0] + 4, true);
  val = TEXT_DECODER_UTF8.decode(new Uint8Array(ctx.memory.buffer, start, codeUnits));
  ctx.storagePtr += codeUnits;
  if (ctx.storageLen !== void 0) {
    ctx.storageLen -= codeUnits;
  }
  return [val, ctx];
}
function _liftFlatVariant(casesAndLiftFns) {
  return function _liftFlatVariantInner(ctx) {
    _debugLog("[_liftFlatVariant()] args", { ctx });
    const origUseParams = ctx.useDirectParams;
    let caseIdx;
    if (casesAndLiftFns.length < 256) {
      let discriminantByteLen2 = 1;
      const [idx, newCtx2] = _liftFlatU8(ctx);
      caseIdx = idx;
      ctx = newCtx2;
    } else if (casesAndLiftFns.length > 256 && discriminantByteLen < 65536) {
      discriminantByteLen = 2;
      const [idx, newCtx2] = _liftFlatU16(ctx);
      caseIdx = idx;
      ctx = newCtx2;
    } else if (casesAndLiftFns.length > 65536 && discriminantByteLen < 4294967296) {
      discriminantByteLen = 4;
      const [idx, newCtx2] = _liftFlatU32(ctx);
      caseIdx = idx;
      ctx = newCtx2;
    } else {
      throw new Error("unsupported number of cases [" + casesAndLIftFns.legnth + "]");
    }
    const [tag, liftFn, size32, alignment32] = casesAndLiftFns[caseIdx];
    let val;
    if (liftFn === null) {
      val = { tag };
      return [val, ctx];
    }
    const [newVal, newCtx] = liftFn(ctx);
    ctx = newCtx;
    val = { tag, val: newVal };
    return [val, ctx];
  };
}
function _liftFlatList(elemLiftFn, alignment32, knownLen) {
  function _liftFlatListInner(ctx) {
    _debugLog("[_liftFlatList()] args", { ctx });
    let metaPtr;
    let dataPtr;
    let len;
    if (ctx.useDirectParams) {
      if (knownLen) {
        dataPtr = _liftFlatU32(ctx);
      } else {
        metaPtr = _liftFlatU32(ctx);
      }
    } else {
      if (knownLen) {
        dataPtr = _liftFlatU32(ctx);
      } else {
        metaPtr = _liftFlatU32(ctx);
      }
    }
    if (metaPtr) {
      if (dataPtr !== void 0) {
        throw new Error("both meta and data pointers should not be set yet");
      }
      if (ctx.useDirectParams) {
        ctx.useDirectParams = false;
        ctx.storagePtr = metaPtr;
        ctx.storageLen = 8;
        dataPtr = _liftFlatU32(ctx);
        len = _liftFlatU32(ctx);
        ctx.useDirectParams = true;
        ctx.storagePtr = null;
        ctx.storageLen = null;
      } else {
        dataPtr = _liftFlatU32(ctx);
        len = _liftFlatU32(ctx);
      }
    }
    const val = [];
    for (var i = 0; i < len; i++) {
      ctx.storagePtr = Math.ceil(ctx.storagePtr / alignment32) * alignment32;
      const [res, nextCtx] = elemLiftFn(ctx);
      val.push(res);
      ctx = nextCtx;
    }
    return [val, ctx];
  }
}
function _liftFlatFlags(cases) {
  return function _liftFlatFlagsInner(ctx) {
    _debugLog("[_liftFlatFlags()] args", { ctx });
    throw new Error("flat lift for flags not yet implemented!");
  };
}
function _liftFlatResult(casesAndLiftFns) {
  return function _liftFlatResultInner(ctx) {
    _debugLog("[_liftFlatResult()] args", { ctx });
    return _liftFlatVariant(casesAndLiftFns)(ctx);
  };
}
function _liftFlatBorrow(componentTableIdx, size2, memory2, vals, storagePtr, storageLen) {
  _debugLog("[_liftFlatBorrow()] args", { size: size2, memory: memory2, vals, storagePtr, storageLen });
  throw new Error("flat lift for borrowed resources not yet implemented!");
}
function _lowerFlatU8(ctx) {
  _debugLog("[_lowerFlatU8()] args", ctx);
  const { memory: memory2, realloc, vals, storagePtr, storageLen } = ctx;
  if (vals.length !== 1) {
    throw new Error("unexpected number (" + vals.length + ") of core vals (expected 1)");
  }
  if (vals[0] > 255 || vals[0] < 0) {
    throw new Error("invalid value for core value representing u8");
  }
  if (!memory2) {
    throw new Error("missing memory for lower");
  }
  new DataView(memory2.buffer).setUint32(storagePtr, vals[0], true);
  return 1;
}
function _lowerFlatU16(memory2, vals, storagePtr, storageLen) {
  _debugLog("[_lowerFlatU16()] args", { memory: memory2, vals, storagePtr, storageLen });
  if (vals.length !== 1) {
    throw new Error("unexpected number (" + vals.length + ") of core vals (expected 1)");
  }
  if (vals[0] > 65535 || vals[0] < 0) {
    throw new Error("invalid value for core value representing u16");
  }
  new DataView(memory2.buffer).setUint16(storagePtr, vals[0], true);
  return 2;
}
function _lowerFlatU32(ctx) {
  _debugLog("[_lowerFlatU32()] args", { ctx });
  const { memory: memory2, realloc, vals, storagePtr, storageLen } = ctx;
  if (vals.length !== 1) {
    throw new Error("expected single value to lower, got (" + vals.length + ")");
  }
  if (vals[0] > 4294967295 || vals[0] < 0) {
    throw new Error("invalid value for core value representing u32");
  }
  const rem = ctx.storagePtr % 4;
  if (rem !== 0) {
    ctx.storagePtr += 4 - rem;
  }
  new DataView(memory2.buffer).setUint32(storagePtr, vals[0], true);
  return 4;
}
function _lowerFlatU64(memory2, vals, storagePtr, storageLen) {
  _debugLog("[_lowerFlatU64()] args", { memory: memory2, vals, storagePtr, storageLen });
  if (vals.length !== 1) {
    throw new Error("unexpected number of core vals");
  }
  if (vals[0] > 18446744073709551615n || vals[0] < 0n) {
    throw new Error("invalid value for core value representing u64");
  }
  new DataView(memory2.buffer).setBigUint64(storagePtr, vals[0], true);
  return 8;
}
function _lowerFlatRecord(fieldMetas) {
  return (size2, memory2, vals, storagePtr, storageLen) => {
    const params2 = [...arguments].slice(5);
    _debugLog("[_lowerFlatRecord()] args", {
      size: size2,
      memory: memory2,
      vals,
      storagePtr,
      storageLen,
      params: params2,
      fieldMetas
    });
    const [start] = vals;
    if (storageLen !== void 0 && size2 !== void 0 && size2 > storageLen) {
      throw new Error("not enough storage remaining for record flat lower");
    }
    const data = new Uint8Array(memory2.buffer, start, size2);
    new Uint8Array(memory2.buffer, storagePtr, size2).set(data);
    return data.byteLength;
  };
}
function _lowerFlatVariant(metadata, extra) {
  const { discriminantSizeBytes, lowerMetas } = metadata;
  return function _lowerFlatVariantInner(ctx) {
    _debugLog("[_lowerFlatVariant()] args", ctx);
    const { memory: memory2, realloc, vals, storageLen, componentIdx } = ctx;
    let storagePtr = ctx.storagePtr;
    const { tag, val } = vals[0];
    const variant = lowerMetas.find((vm) => vm.tag === tag);
    if (!variant) {
      throw new Error(`missing/invalid variant, no tag matches [${tag}] (options were ${variantMetas.map((vm) => vm.tag)})`);
    }
    if (!variant.discriminant) {
      throw new Error(`missing/invalid discriminant for variant [${variant}]`);
    }
    let bytesWritten;
    let discriminantLowerArgs = { memory: memory2, realloc, vals: [variant.discriminant], storagePtr, componentIdx };
    switch (discriminantSizeBytes) {
      case 1:
        bytesWritten = _lowerFlatU8(discriminantLowerArgs);
        break;
      case 2:
        bytesWritten = _lowerFlatU16(discriminantLowerArgs);
        break;
      case 4:
        bytesWritten = _lowerFlatU32(discriminantLowerArgs);
        break;
      default:
        throw new Error(`unexpected discriminant size bytes [${discriminantSizeBytes}]`);
    }
    if (bytesWritten !== discriminantSizeBytes) {
      throw new Error("unexpectedly wrote more bytes than discriminant");
    }
    storagePtr += bytesWritten;
    bytesWritten += variant.lowerFn({ memory: memory2, realloc, vals: [val], storagePtr, storageLen, componentIdx });
    return bytesWritten;
  };
}
function _lowerFlatList(args) {
  const { elemLowerFn } = args;
  if (!elemLowerFn) {
    throw new TypeError("missing/invalid element lower fn for list");
  }
  return function _lowerFlatListInner(ctx) {
    _debugLog("[_lowerFlatList()] args", { ctx });
    if (ctx.params.length < 2) {
      throw new Error("insufficient params left to lower list");
    }
    const storagePtr = ctx.params[0];
    const elemCount = ctx.params[1];
    ctx.params = ctx.params.slice(2);
    if (ctx.useDirectParams) {
      const list = ctx.vals[0];
      if (!list) {
        throw new Error("missing direct param value");
      }
      const elemLowerCtx = { storagePtr, memory: ctx.memory };
      for (let idx = 0; idx < list.length; idx++) {
        elemLowerCtx.vals = list.slice(idx, idx + 1);
        elemLowerCtx.storagePtr += elemLowerFn(elemLowerCtx);
      }
      const bytesLowered = elemLowerCtx.storagePtr - ctx.storagePtr;
      ctx.storagePtr = elemLowerCtx.storagePtr;
      return bytesLowered;
    }
    if (ctx.vals.length !== 2) {
      throw new Error("indirect parameter loading must have a pointer and length as vals");
    }
    let [valStartPtr, valLen] = ctx.vals;
    const totalSizeBytes = valLen * size;
    if (ctx.storageLen !== void 0 && totalSizeBytes > ctx.storageLen) {
      throw new Error("not enough storage remaining for list flat lower");
    }
    const data = new Uint8Array(memory.buffer, valStartPtr, totalSizeBytes);
    new Uint8Array(memory.buffer, storagePtr, totalSizeBytes).set(data);
    return totalSizeBytes;
  };
}
function _lowerFlatTuple(size2, memory2, vals, storagePtr, storageLen) {
  _debugLog("[_lowerFlatTuple()] args", { size: size2, memory: memory2, vals, storagePtr, storageLen });
  let [start, len] = vals;
  if (storageLen !== void 0 && len > storageLen) {
    throw new Error("not enough storage remaining for tuple flat lower");
  }
  const data = new Uint8Array(memory2.buffer, start, len);
  new Uint8Array(memory2.buffer, storagePtr, len).set(data);
  return data.byteLength;
}
function _lowerFlatEnum(size2, memory2, vals, storagePtr, storageLen) {
  _debugLog("[_lowerFlatEnum()] args", { size: size2, memory: memory2, vals, storagePtr, storageLen });
  let [start] = vals;
  if (storageLen !== void 0 && size2 !== void 0 && size2 > storageLen) {
    throw new Error("not enough storage remaining for enum flat lower");
  }
  const data = new Uint8Array(memory2.buffer, start, size2);
  new Uint8Array(memory2.buffer, storagePtr, size2).set(data);
  return data.byteLength;
}
function _lowerFlatOption(size2, memory2, vals, storagePtr, storageLen) {
  _debugLog("[_lowerFlatOption()] args", { size: size2, memory: memory2, vals, storagePtr, storageLen });
  let [start] = vals;
  if (storageLen !== void 0 && size2 !== void 0 && size2 > storageLen) {
    throw new Error("not enough storage remaining for option flat lower");
  }
  const data = new Uint8Array(memory2.buffer, start, size2);
  new Uint8Array(memory2.buffer, storagePtr, size2).set(data);
  return data.byteLength;
}
function _lowerFlatResult(lowerMetas) {
  const invalidTag = lowerMetas.find((t) => t.tag !== "ok" && t.tag !== "error");
  if (invalidTag) {
    throw new Error(`invalid variant tag [${invalidTag}] found for result`);
  }
  return function _lowerFlatResultInner() {
    _debugLog("[_lowerFlatResult()] args", { lowerMetas });
    let lowerFn = _lowerFlatVariant({ discriminantSizeBytes: 1, lowerMetas }, { forResult: true });
    return lowerFn.apply(null, arguments);
  };
}
function _lowerFlatOwn(size2, memory2, vals, storagePtr, storageLen) {
  _debugLog("[_lowerFlatOwn()] args", { size: size2, memory: memory2, vals, storagePtr, storageLen });
  throw new Error("flat lower for owned resources not yet implemented!");
}
var ASYNC_STATE = /* @__PURE__ */ new Map();
function getOrCreateAsyncState(componentIdx, init) {
  if (!ASYNC_STATE.has(componentIdx)) {
    const newState = new ComponentAsyncState({ componentIdx });
    ASYNC_STATE.set(componentIdx, newState);
  }
  return ASYNC_STATE.get(componentIdx);
}
var ComponentAsyncState = class _ComponentAsyncState {
  static EVENT_HANDLER_EVENTS = ["backpressure-change"];
  #componentIdx;
  #callingAsyncImport = false;
  #syncImportWait = promiseWithResolvers();
  #locked = false;
  #parkedTasks = /* @__PURE__ */ new Map();
  #suspendedTasksByTaskID = /* @__PURE__ */ new Map();
  #suspendedTaskIDs = [];
  #pendingTasks = [];
  #errored = null;
  #backpressure = 0;
  #backpressureWaiters = 0n;
  #handlerMap = /* @__PURE__ */ new Map();
  #nextHandlerID = 0n;
  mayLeave = true;
  #streams;
  waitableSets;
  waitables;
  subtasks;
  constructor(args) {
    this.#componentIdx = args.componentIdx;
    this.waitableSets = new RepTable({ target: `component [${this.#componentIdx}] waitable sets` });
    this.waitables = new RepTable({ target: `component [${this.#componentIdx}] waitables` });
    this.subtasks = new RepTable({ target: `component [${this.#componentIdx}] subtasks` });
    this.#streams = /* @__PURE__ */ new Map();
  }
  componentIdx() {
    return this.#componentIdx;
  }
  streams() {
    return this.#streams;
  }
  errored() {
    return this.#errored !== null;
  }
  setErrored(err) {
    _debugLog("[ComponentAsyncState#setErrored()] component errored", { err, componentIdx: this.#componentIdx });
    if (this.#errored) {
      return;
    }
    if (!err) {
      err = new Error("error elswehere (see other component instance error)");
      err.componentIdx = this.#componentIdx;
    }
    this.#errored = err;
  }
  callingSyncImport(val) {
    if (val === void 0) {
      return this.#callingAsyncImport;
    }
    if (typeof val !== "boolean") {
      throw new TypeError("invalid setting for async import");
    }
    const prev = this.#callingAsyncImport;
    this.#callingAsyncImport = val;
    if (prev === true && this.#callingAsyncImport === false) {
      this.#notifySyncImportEnd();
    }
  }
  #notifySyncImportEnd() {
    const existing = this.#syncImportWait;
    this.#syncImportWait = promiseWithResolvers();
    existing.resolve();
  }
  async waitForSyncImportCallEnd() {
    await this.#syncImportWait.promise;
  }
  setBackpressure(v) {
    this.#backpressure = v;
  }
  getBackpressure(v) {
    return this.#backpressure;
  }
  incrementBackpressure() {
    const newValue = this.getBackpressure() + 1;
    if (newValue > 2 ** 16) {
      throw new Error("invalid backpressure value, overflow");
    }
    this.setBackpressure(newValue);
  }
  decrementBackpressure() {
    this.setBackpressure(Math.max(0, this.getBackpressure() - 1));
  }
  hasBackpressure() {
    return this.#backpressure > 0;
  }
  waitForBackpressure() {
    let backpressureCleared = false;
    const cstate = this;
    cstate.addBackpressureWaiter();
    const handlerID = this.registerHandler({
      event: "backpressure-change",
      fn: (bp) => {
        if (bp === 0) {
          cstate.removeHandler(handlerID);
          backpressureCleared = true;
        }
      }
    });
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (backpressureCleared) {
          return;
        }
        clearInterval(interval);
        cstate.removeBackpressureWaiter();
        resolve(null);
      }, 0);
    });
  }
  registerHandler(args) {
    const { event, fn } = args;
    if (!event) {
      throw new Error("missing handler event");
    }
    if (!fn) {
      throw new Error("missing handler fn");
    }
    if (!_ComponentAsyncState.EVENT_HANDLER_EVENTS.includes(event)) {
      throw new Error(`unrecognized event handler [${event}]`);
    }
    const handlerID = this.#nextHandlerID++;
    let handlers = this.#handlerMap.get(event);
    if (!handlers) {
      handlers = [];
      this.#handlerMap.set(event, handlers);
    }
    handlers.push({ id: handlerID, fn, event });
    return handlerID;
  }
  removeHandler(args) {
    const { event, handlerID } = args;
    const registeredHandlers = this.#handlerMap.get(event);
    if (!registeredHandlers) {
      return;
    }
    const found = registeredHandlers.find((h) => h.id === handlerID);
    if (!found) {
      return;
    }
    this.#handlerMap.set(event, this.#handlerMap.get(event).filter((h) => h.id !== handlerID));
  }
  getBackpressureWaiters() {
    return this.#backpressureWaiters;
  }
  addBackpressureWaiter() {
    this.#backpressureWaiters++;
  }
  removeBackpressureWaiter() {
    this.#backpressureWaiters--;
    if (this.#backpressureWaiters < 0) {
      throw new Error("unexepctedly negative number of backpressure waiters");
    }
  }
  parkTaskOnAwaitable(args) {
    if (!args.awaitable) {
      throw new TypeError("missing awaitable when trying to park");
    }
    if (!args.task) {
      throw new TypeError("missing task when trying to park");
    }
    const { awaitable, task } = args;
    let taskList = this.#parkedTasks.get(awaitable.id());
    if (!taskList) {
      taskList = [];
      this.#parkedTasks.set(awaitable.id(), taskList);
    }
    taskList.push(task);
    this.wakeNextTaskForAwaitable(awaitable);
  }
  wakeNextTaskForAwaitable(awaitable) {
    if (!awaitable) {
      throw new TypeError("missing awaitable when waking next task");
    }
    const awaitableID = awaitable.id();
    const taskList = this.#parkedTasks.get(awaitableID);
    if (!taskList || taskList.length === 0) {
      _debugLog("[ComponentAsyncState] no tasks waiting for awaitable", { awaitableID: awaitable.id() });
      return;
    }
    let task = taskList.shift();
    if (!task) {
      throw new Error("no task in parked list despite previous check");
    }
    if (!task.awaitableResume) {
      throw new Error("task ready due to awaitable is missing resume", { taskID: task.id(), awaitableID });
    }
    task.awaitableResume();
  }
  // TODO: we might want to check for pre-locked status here
  exclusiveLock() {
    this.#locked = true;
  }
  exclusiveRelease() {
    _debugLog("[ComponentAsyncState#exclusiveRelease()] releasing", {
      locked: this.#locked,
      componentIdx: this.#componentIdx
    });
    this.#locked = false;
  }
  isExclusivelyLocked() {
    return this.#locked === true;
  }
  #getSuspendedTaskMeta(taskID) {
    return this.#suspendedTasksByTaskID.get(taskID);
  }
  #removeSuspendedTaskMeta(taskID) {
    _debugLog("[ComponentAsyncState#removeSuspendedTaskMeta()] removing suspended task", { taskID });
    const idx = this.#suspendedTaskIDs.findIndex((t) => t === taskID);
    const meta = this.#suspendedTasksByTaskID.get(taskID);
    this.#suspendedTaskIDs[idx] = null;
    this.#suspendedTasksByTaskID.delete(taskID);
    return meta;
  }
  #addSuspendedTaskMeta(meta) {
    if (!meta) {
      throw new Error("missing task meta");
    }
    const taskID = meta.taskID;
    this.#suspendedTasksByTaskID.set(taskID, meta);
    this.#suspendedTaskIDs.push(taskID);
    if (this.#suspendedTasksByTaskID.size < this.#suspendedTaskIDs.length - 10) {
      this.#suspendedTaskIDs = this.#suspendedTaskIDs.filter((t) => t !== null);
    }
  }
  suspendTask(args) {
    const { task, readyFn } = args;
    const taskID = task.id();
    _debugLog("[ComponentAsyncState#suspendTask()]", { taskID });
    if (this.#getSuspendedTaskMeta(taskID)) {
      throw new Error("task [" + taskID + "] already suspended");
    }
    const { promise, resolve } = Promise.withResolvers();
    this.#addSuspendedTaskMeta({
      task,
      taskID,
      readyFn,
      resume: () => {
        _debugLog("[ComponentAsyncState#suspendTask()] resuming suspended task", { taskID });
        resolve(!task.isCancelled());
      }
    });
    return promise;
  }
  resumeTaskByID(taskID) {
    const meta = this.#removeSuspendedTaskMeta(taskID);
    if (!meta) {
      return;
    }
    if (meta.taskID !== taskID) {
      throw new Error("task ID does not match");
    }
    meta.resume();
  }
  tick() {
    _debugLog("[ComponentAsyncState#tick()]", { suspendedTaskIDs: this.#suspendedTaskIDs });
    const resumableTasks = this.#suspendedTaskIDs.filter((t) => t !== null);
    for (const taskID of resumableTasks) {
      const meta = this.#suspendedTasksByTaskID.get(taskID);
      if (!meta || !meta.readyFn) {
        throw new Error(`missing/invalid task despite ID [${taskID}] being present`);
      }
      const isReady = meta.readyFn();
      if (!isReady) {
        continue;
      }
      this.resumeTaskByID(taskID);
    }
    return this.#suspendedTaskIDs.filter((t) => t !== null).length === 0;
  }
  addPendingTask(task) {
    this.#pendingTasks.push(task);
  }
  addStreamEnd(args) {
    _debugLog("[ComponentAsyncState#addStreamEnd()] args", args);
    const { tableIdx, streamEnd } = args;
    let tbl = this.#streams.get(tableIdx);
    if (!tbl) {
      tbl = new RepTable({ target: `component [${this.#componentIdx}] streams` });
      this.#streams.set(tableIdx, tbl);
    }
    const streamIdx = tbl.insert(streamEnd);
    return streamIdx;
  }
  createStream(args) {
    _debugLog("[ComponentAsyncState#createStream()] args", args);
    const { tableIdx, elemMeta } = args;
    if (tableIdx === void 0) {
      throw new Error("missing table idx while adding stream");
    }
    if (elemMeta === void 0) {
      throw new Error("missing element metadata while adding stream");
    }
    let tbl = this.#streams.get(tableIdx);
    if (!tbl) {
      tbl = new RepTable({ target: `component [${this.#componentIdx}] streams` });
      this.#streams.set(tableIdx, tbl);
    }
    const stream = new InternalStream({
      tableIdx,
      componentIdx: this.#componentIdx,
      elemMeta
    });
    const writeEndIdx = tbl.insert(stream.getWriteEnd());
    stream.setWriteEndIdx(writeEndIdx);
    const readEndIdx = tbl.insert(stream.getReadEnd());
    stream.setReadEndIdx(readEndIdx);
    const rep2 = STREAMS.insert(stream);
    stream.setRep(rep2);
    return { writeEndIdx, readEndIdx };
  }
  getStreamEnd(args) {
    _debugLog("[ComponentAsyncState#getStreamEnd()] args", args);
    const { tableIdx, streamIdx } = args;
    if (tableIdx === void 0) {
      throw new Error("missing table idx while retrieveing stream end");
    }
    if (streamIdx === void 0) {
      throw new Error("missing stream idx while retrieveing stream end");
    }
    const tbl = this.#streams.get(tableIdx);
    if (!tbl) {
      throw new Error(`missing stream table [${tableIdx}] in component [${this.#componentIdx}] while getting stream`);
    }
    const stream = tbl.get(streamIdx);
    return stream;
  }
  removeStreamEnd(args) {
    _debugLog("[ComponentAsyncState#removeStreamEnd()] args", args);
    const { tableIdx, streamIdx } = args;
    if (tableIdx === void 0) {
      throw new Error("missing table idx while removing stream end");
    }
    if (streamIdx === void 0) {
      throw new Error("missing stream idx while removing stream end");
    }
    const tbl = this.#streams.get(tableIdx);
    if (!tbl) {
      throw new Error(`missing stream table [${tableIdx}] in component [${this.#componentIdx}] while removing stream end`);
    }
    const stream = tbl.get(streamIdx);
    if (!stream) {
      throw new Error(`component [${this.#componentIdx}] missing stream [${streamIdx}]`);
    }
    const removed = tbl.remove(streamIdx);
    if (!removed) {
      throw new Error(`missing stream [${streamIdx}] (table [${tableIdx}]) in component [${this.#componentIdx}] while removing stream end`);
    }
    return stream;
  }
};
var base64Compile = (str) => WebAssembly.compile(typeof Buffer !== "undefined" ? Buffer.from(str, "base64") : Uint8Array.from(atob(str), (b) => b.charCodeAt(0)));
var isNode = typeof process !== "undefined" && process.versions && process.versions.node;
var _fs;
async function fetchCompile(url) {
  if (isNode) {
    _fs = _fs || await import("node:fs/promises");
    return WebAssembly.compile(await _fs.readFile(url));
  }
  return fetch(url).then(WebAssembly.compileStreaming);
}
var symbolCabiDispose = Symbol.for("cabiDispose");
var symbolRscHandle = Symbol("handle");
var symbolRscRep = Symbol.for("cabiRep");
var symbolDispose3 = Symbol.dispose || Symbol.for("dispose");
var handleTables = [];
var ComponentError = class extends Error {
  constructor(value) {
    const enumerable = typeof value !== "string";
    super(enumerable ? `${String(value)} (see error.payload)` : value);
    Object.defineProperty(this, "payload", { value, enumerable });
  }
};
function getErrorPayload(e) {
  if (e && hasOwnProperty.call(e, "payload")) return e.payload;
  if (e instanceof Error) throw e;
  return e;
}
function throwUninitialized() {
  throw new TypeError("Wasm uninitialized use `await $init` first");
}
var hasOwnProperty = Object.prototype.hasOwnProperty;
var instantiateCore = WebAssembly.instantiate;
var exports0;
var exports1;
var lowered_import_0_metadata = {
  qualifiedImportFn: "wasi:cli/stderr@0.2.3#get-stderr",
  moduleIdx: null
};
var handleTable2 = [T_FLAG, 0];
var captureTable2 = /* @__PURE__ */ new Map();
var captureCnt2 = 0;
handleTables[2] = handleTable2;
function trampoline5() {
  _debugLog('[iface="wasi:cli/stderr@0.2.3", function="get-stderr"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = getStderr?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "getStderr",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret = getStderr();
  endCurrentTask(0);
  if (!(ret instanceof OutputStream4)) {
    throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
  }
  var handle0 = ret[symbolRscHandle];
  if (!handle0) {
    const rep2 = ret[symbolRscRep] || ++captureCnt2;
    captureTable2.set(rep2, ret);
    handle0 = rscTableCreateOwn(handleTable2, rep2);
  }
  _debugLog('[iface="wasi:cli/stderr@0.2.3", function="get-stderr"][Instruction::Return]', {
    funcName: "get-stderr",
    paramCount: 1,
    async: false,
    postReturn: false
  });
  return handle0;
}
var lowered_import_1_metadata = {
  qualifiedImportFn: "wasi:cli/stdin@0.2.3#get-stdin",
  moduleIdx: null
};
var handleTable1 = [T_FLAG, 0];
var captureTable1 = /* @__PURE__ */ new Map();
var captureCnt1 = 0;
handleTables[1] = handleTable1;
function trampoline8() {
  _debugLog('[iface="wasi:cli/stdin@0.2.3", function="get-stdin"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = getStdin?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "getStdin",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret = getStdin();
  endCurrentTask(0);
  if (!(ret instanceof InputStream4)) {
    throw new TypeError('Resource error: Not a valid "InputStream" resource.');
  }
  var handle0 = ret[symbolRscHandle];
  if (!handle0) {
    const rep2 = ret[symbolRscRep] || ++captureCnt1;
    captureTable1.set(rep2, ret);
    handle0 = rscTableCreateOwn(handleTable1, rep2);
  }
  _debugLog('[iface="wasi:cli/stdin@0.2.3", function="get-stdin"][Instruction::Return]', {
    funcName: "get-stdin",
    paramCount: 1,
    async: false,
    postReturn: false
  });
  return handle0;
}
var lowered_import_2_metadata = {
  qualifiedImportFn: "wasi:cli/stdout@0.2.3#get-stdout",
  moduleIdx: null
};
function trampoline9() {
  _debugLog('[iface="wasi:cli/stdout@0.2.3", function="get-stdout"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = getStdout?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "getStdout",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret = getStdout();
  endCurrentTask(0);
  if (!(ret instanceof OutputStream4)) {
    throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
  }
  var handle0 = ret[symbolRscHandle];
  if (!handle0) {
    const rep2 = ret[symbolRscRep] || ++captureCnt2;
    captureTable2.set(rep2, ret);
    handle0 = rscTableCreateOwn(handleTable2, rep2);
  }
  _debugLog('[iface="wasi:cli/stdout@0.2.3", function="get-stdout"][Instruction::Return]', {
    funcName: "get-stdout",
    paramCount: 1,
    async: false,
    postReturn: false
  });
  return handle0;
}
var lowered_import_3_metadata = {
  qualifiedImportFn: "wasi:cli/exit@0.2.3#exit",
  moduleIdx: null
};
function trampoline10(arg0) {
  let variant0;
  switch (arg0) {
    case 0: {
      variant0 = {
        tag: "ok",
        val: void 0
      };
      break;
    }
    case 1: {
      variant0 = {
        tag: "err",
        val: void 0
      };
      break;
    }
    default: {
      throw new TypeError("invalid variant discriminant for expected");
    }
  }
  _debugLog('[iface="wasi:cli/exit@0.2.3", function="exit"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = exit2?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "exit",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  exit2(variant0);
  endCurrentTask(0);
  _debugLog('[iface="wasi:cli/exit@0.2.3", function="exit"][Instruction::Return]', {
    funcName: "exit",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var exports2;
var memory0;
var realloc0;
var lowered_import_4_metadata = {
  qualifiedImportFn: "wasi:cli/environment@0.2.3#get-environment",
  moduleIdx: null
};
function trampoline11(arg0) {
  _debugLog('[iface="wasi:cli/environment@0.2.3", function="get-environment"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = getEnvironment?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "getEnvironment",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret = getEnvironment();
  endCurrentTask(0);
  var vec3 = ret;
  var len3 = vec3.length;
  var result3 = realloc0(0, 0, 4, len3 * 16);
  for (let i = 0; i < vec3.length; i++) {
    const e = vec3[i];
    const base = result3 + i * 16;
    var [tuple0_0, tuple0_1] = e;
    var encodeRes = _utf8AllocateAndEncode(tuple0_0, realloc0, memory0);
    var ptr1 = encodeRes.ptr;
    var len1 = encodeRes.len;
    dataView(memory0).setUint32(base + 4, len1, true);
    dataView(memory0).setUint32(base + 0, ptr1, true);
    var encodeRes = _utf8AllocateAndEncode(tuple0_1, realloc0, memory0);
    var ptr2 = encodeRes.ptr;
    var len2 = encodeRes.len;
    dataView(memory0).setUint32(base + 12, len2, true);
    dataView(memory0).setUint32(base + 8, ptr2, true);
  }
  dataView(memory0).setUint32(arg0 + 4, len3, true);
  dataView(memory0).setUint32(arg0 + 0, result3, true);
  _debugLog('[iface="wasi:cli/environment@0.2.3", function="get-environment"][Instruction::Return]', {
    funcName: "get-environment",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_5_metadata = {
  qualifiedImportFn: "wasi:filesystem/types@0.2.3#[method]descriptor.get-type",
  moduleIdx: null
};
var handleTable6 = [T_FLAG, 0];
var captureTable6 = /* @__PURE__ */ new Map();
var captureCnt6 = 0;
handleTables[6] = handleTable6;
function trampoline12(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.get-type"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.getType?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "getType",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.getType() };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      var val3 = e;
      let enum3;
      switch (val3) {
        case "unknown": {
          enum3 = 0;
          break;
        }
        case "block-device": {
          enum3 = 1;
          break;
        }
        case "character-device": {
          enum3 = 2;
          break;
        }
        case "directory": {
          enum3 = 3;
          break;
        }
        case "fifo": {
          enum3 = 4;
          break;
        }
        case "symbolic-link": {
          enum3 = 5;
          break;
        }
        case "regular-file": {
          enum3 = 6;
          break;
        }
        case "socket": {
          enum3 = 7;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val3}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg1 + 1, enum3, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val4 = e;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 1, enum4, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.get-type"][Instruction::Return]', {
    funcName: "[method]descriptor.get-type",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_6_metadata = {
  qualifiedImportFn: "wasi:filesystem/types@0.2.3#[method]descriptor.metadata-hash",
  moduleIdx: null
};
function trampoline13(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.metadata-hash"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.metadataHash?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "metadataHash",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.metadataHash() };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      var { lower: v3_0, upper: v3_1 } = e;
      dataView(memory0).setBigInt64(arg1 + 8, toUint64(v3_0), true);
      dataView(memory0).setBigInt64(arg1 + 16, toUint64(v3_1), true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val4 = e;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 8, enum4, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.metadata-hash"][Instruction::Return]', {
    funcName: "[method]descriptor.metadata-hash",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_7_metadata = {
  qualifiedImportFn: "wasi:filesystem/types@0.2.3#filesystem-error-code",
  moduleIdx: null
};
var handleTable0 = [T_FLAG, 0];
var captureTable0 = /* @__PURE__ */ new Map();
var captureCnt0 = 0;
handleTables[0] = handleTable0;
function trampoline14(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable0[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable0.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Error$1.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="filesystem-error-code"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = filesystemErrorCode?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "filesystemErrorCode",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret = filesystemErrorCode(rsc0);
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant4 = ret;
  if (variant4 === null || variant4 === void 0) {
    dataView(memory0).setInt8(arg1 + 0, 0, true);
  } else {
    const e = variant4;
    dataView(memory0).setInt8(arg1 + 0, 1, true);
    var val3 = e;
    let enum3;
    switch (val3) {
      case "access": {
        enum3 = 0;
        break;
      }
      case "would-block": {
        enum3 = 1;
        break;
      }
      case "already": {
        enum3 = 2;
        break;
      }
      case "bad-descriptor": {
        enum3 = 3;
        break;
      }
      case "busy": {
        enum3 = 4;
        break;
      }
      case "deadlock": {
        enum3 = 5;
        break;
      }
      case "quota": {
        enum3 = 6;
        break;
      }
      case "exist": {
        enum3 = 7;
        break;
      }
      case "file-too-large": {
        enum3 = 8;
        break;
      }
      case "illegal-byte-sequence": {
        enum3 = 9;
        break;
      }
      case "in-progress": {
        enum3 = 10;
        break;
      }
      case "interrupted": {
        enum3 = 11;
        break;
      }
      case "invalid": {
        enum3 = 12;
        break;
      }
      case "io": {
        enum3 = 13;
        break;
      }
      case "is-directory": {
        enum3 = 14;
        break;
      }
      case "loop": {
        enum3 = 15;
        break;
      }
      case "too-many-links": {
        enum3 = 16;
        break;
      }
      case "message-size": {
        enum3 = 17;
        break;
      }
      case "name-too-long": {
        enum3 = 18;
        break;
      }
      case "no-device": {
        enum3 = 19;
        break;
      }
      case "no-entry": {
        enum3 = 20;
        break;
      }
      case "no-lock": {
        enum3 = 21;
        break;
      }
      case "insufficient-memory": {
        enum3 = 22;
        break;
      }
      case "insufficient-space": {
        enum3 = 23;
        break;
      }
      case "not-directory": {
        enum3 = 24;
        break;
      }
      case "not-empty": {
        enum3 = 25;
        break;
      }
      case "not-recoverable": {
        enum3 = 26;
        break;
      }
      case "unsupported": {
        enum3 = 27;
        break;
      }
      case "no-tty": {
        enum3 = 28;
        break;
      }
      case "no-such-device": {
        enum3 = 29;
        break;
      }
      case "overflow": {
        enum3 = 30;
        break;
      }
      case "not-permitted": {
        enum3 = 31;
        break;
      }
      case "pipe": {
        enum3 = 32;
        break;
      }
      case "read-only": {
        enum3 = 33;
        break;
      }
      case "invalid-seek": {
        enum3 = 34;
        break;
      }
      case "text-file-busy": {
        enum3 = 35;
        break;
      }
      case "cross-device": {
        enum3 = 36;
        break;
      }
      default: {
        if (e instanceof Error) {
          console.error(e);
        }
        throw new TypeError(`"${val3}" is not one of the cases of error-code`);
      }
    }
    dataView(memory0).setInt8(arg1 + 1, enum3, true);
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="filesystem-error-code"][Instruction::Return]', {
    funcName: "filesystem-error-code",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_8_metadata = {
  qualifiedImportFn: "wasi:filesystem/types@0.2.3#[method]descriptor.metadata-hash-at",
  moduleIdx: null
};
function trampoline15(arg0, arg1, arg2, arg3, arg4) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  if ((arg1 & 4294967294) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags3 = {
    symlinkFollow: Boolean(arg1 & 1)
  };
  var ptr4 = arg2;
  var len4 = arg3;
  var result4 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr4, len4));
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.metadata-hash-at"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.metadataHashAt?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "metadataHashAt",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.metadataHashAt(flags3, result4) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant7 = ret;
  switch (variant7.tag) {
    case "ok": {
      const e = variant7.val;
      dataView(memory0).setInt8(arg4 + 0, 0, true);
      var { lower: v5_0, upper: v5_1 } = e;
      dataView(memory0).setBigInt64(arg4 + 8, toUint64(v5_0), true);
      dataView(memory0).setBigInt64(arg4 + 16, toUint64(v5_1), true);
      break;
    }
    case "err": {
      const e = variant7.val;
      dataView(memory0).setInt8(arg4 + 0, 1, true);
      var val6 = e;
      let enum6;
      switch (val6) {
        case "access": {
          enum6 = 0;
          break;
        }
        case "would-block": {
          enum6 = 1;
          break;
        }
        case "already": {
          enum6 = 2;
          break;
        }
        case "bad-descriptor": {
          enum6 = 3;
          break;
        }
        case "busy": {
          enum6 = 4;
          break;
        }
        case "deadlock": {
          enum6 = 5;
          break;
        }
        case "quota": {
          enum6 = 6;
          break;
        }
        case "exist": {
          enum6 = 7;
          break;
        }
        case "file-too-large": {
          enum6 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum6 = 9;
          break;
        }
        case "in-progress": {
          enum6 = 10;
          break;
        }
        case "interrupted": {
          enum6 = 11;
          break;
        }
        case "invalid": {
          enum6 = 12;
          break;
        }
        case "io": {
          enum6 = 13;
          break;
        }
        case "is-directory": {
          enum6 = 14;
          break;
        }
        case "loop": {
          enum6 = 15;
          break;
        }
        case "too-many-links": {
          enum6 = 16;
          break;
        }
        case "message-size": {
          enum6 = 17;
          break;
        }
        case "name-too-long": {
          enum6 = 18;
          break;
        }
        case "no-device": {
          enum6 = 19;
          break;
        }
        case "no-entry": {
          enum6 = 20;
          break;
        }
        case "no-lock": {
          enum6 = 21;
          break;
        }
        case "insufficient-memory": {
          enum6 = 22;
          break;
        }
        case "insufficient-space": {
          enum6 = 23;
          break;
        }
        case "not-directory": {
          enum6 = 24;
          break;
        }
        case "not-empty": {
          enum6 = 25;
          break;
        }
        case "not-recoverable": {
          enum6 = 26;
          break;
        }
        case "unsupported": {
          enum6 = 27;
          break;
        }
        case "no-tty": {
          enum6 = 28;
          break;
        }
        case "no-such-device": {
          enum6 = 29;
          break;
        }
        case "overflow": {
          enum6 = 30;
          break;
        }
        case "not-permitted": {
          enum6 = 31;
          break;
        }
        case "pipe": {
          enum6 = 32;
          break;
        }
        case "read-only": {
          enum6 = 33;
          break;
        }
        case "invalid-seek": {
          enum6 = 34;
          break;
        }
        case "text-file-busy": {
          enum6 = 35;
          break;
        }
        case "cross-device": {
          enum6 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val6}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg4 + 8, enum6, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.metadata-hash-at"][Instruction::Return]', {
    funcName: "[method]descriptor.metadata-hash-at",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_9_metadata = {
  qualifiedImportFn: "wasi:filesystem/types@0.2.3#[method]descriptor.read-via-stream",
  moduleIdx: null
};
function trampoline16(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.read-via-stream"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.readViaStream?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "readViaStream",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.readViaStream(BigInt.asUintN(64, arg1)) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      if (!(e instanceof InputStream4)) {
        throw new TypeError('Resource error: Not a valid "InputStream" resource.');
      }
      var handle3 = e[symbolRscHandle];
      if (!handle3) {
        const rep3 = e[symbolRscRep] || ++captureCnt1;
        captureTable1.set(rep3, e);
        handle3 = rscTableCreateOwn(handleTable1, rep3);
      }
      dataView(memory0).setInt32(arg2 + 4, handle3, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var val4 = e;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg2 + 4, enum4, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.read-via-stream"][Instruction::Return]', {
    funcName: "[method]descriptor.read-via-stream",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_10_metadata = {
  qualifiedImportFn: "wasi:filesystem/types@0.2.3#[method]descriptor.write-via-stream",
  moduleIdx: null
};
function trampoline17(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.write-via-stream"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.writeViaStream?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "writeViaStream",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.writeViaStream(BigInt.asUintN(64, arg1)) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      if (!(e instanceof OutputStream4)) {
        throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
      }
      var handle3 = e[symbolRscHandle];
      if (!handle3) {
        const rep3 = e[symbolRscRep] || ++captureCnt2;
        captureTable2.set(rep3, e);
        handle3 = rscTableCreateOwn(handleTable2, rep3);
      }
      dataView(memory0).setInt32(arg2 + 4, handle3, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var val4 = e;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg2 + 4, enum4, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.write-via-stream"][Instruction::Return]', {
    funcName: "[method]descriptor.write-via-stream",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_11_metadata = {
  qualifiedImportFn: "wasi:filesystem/types@0.2.3#[method]descriptor.append-via-stream",
  moduleIdx: null
};
function trampoline18(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.append-via-stream"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.appendViaStream?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "appendViaStream",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.appendViaStream() };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      if (!(e instanceof OutputStream4)) {
        throw new TypeError('Resource error: Not a valid "OutputStream" resource.');
      }
      var handle3 = e[symbolRscHandle];
      if (!handle3) {
        const rep3 = e[symbolRscRep] || ++captureCnt2;
        captureTable2.set(rep3, e);
        handle3 = rscTableCreateOwn(handleTable2, rep3);
      }
      dataView(memory0).setInt32(arg1 + 4, handle3, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val4 = e;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 4, enum4, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.append-via-stream"][Instruction::Return]', {
    funcName: "[method]descriptor.append-via-stream",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_12_metadata = {
  qualifiedImportFn: "wasi:filesystem/types@0.2.3#[method]descriptor.read-directory",
  moduleIdx: null
};
var handleTable5 = [T_FLAG, 0];
var captureTable5 = /* @__PURE__ */ new Map();
var captureCnt5 = 0;
handleTables[5] = handleTable5;
function trampoline19(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.read-directory"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.readDirectory?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "readDirectory",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.readDirectory() };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      if (!(e instanceof DirectoryEntryStream2)) {
        throw new TypeError('Resource error: Not a valid "DirectoryEntryStream" resource.');
      }
      var handle3 = e[symbolRscHandle];
      if (!handle3) {
        const rep3 = e[symbolRscRep] || ++captureCnt5;
        captureTable5.set(rep3, e);
        handle3 = rscTableCreateOwn(handleTable5, rep3);
      }
      dataView(memory0).setInt32(arg1 + 4, handle3, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val4 = e;
      let enum4;
      switch (val4) {
        case "access": {
          enum4 = 0;
          break;
        }
        case "would-block": {
          enum4 = 1;
          break;
        }
        case "already": {
          enum4 = 2;
          break;
        }
        case "bad-descriptor": {
          enum4 = 3;
          break;
        }
        case "busy": {
          enum4 = 4;
          break;
        }
        case "deadlock": {
          enum4 = 5;
          break;
        }
        case "quota": {
          enum4 = 6;
          break;
        }
        case "exist": {
          enum4 = 7;
          break;
        }
        case "file-too-large": {
          enum4 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum4 = 9;
          break;
        }
        case "in-progress": {
          enum4 = 10;
          break;
        }
        case "interrupted": {
          enum4 = 11;
          break;
        }
        case "invalid": {
          enum4 = 12;
          break;
        }
        case "io": {
          enum4 = 13;
          break;
        }
        case "is-directory": {
          enum4 = 14;
          break;
        }
        case "loop": {
          enum4 = 15;
          break;
        }
        case "too-many-links": {
          enum4 = 16;
          break;
        }
        case "message-size": {
          enum4 = 17;
          break;
        }
        case "name-too-long": {
          enum4 = 18;
          break;
        }
        case "no-device": {
          enum4 = 19;
          break;
        }
        case "no-entry": {
          enum4 = 20;
          break;
        }
        case "no-lock": {
          enum4 = 21;
          break;
        }
        case "insufficient-memory": {
          enum4 = 22;
          break;
        }
        case "insufficient-space": {
          enum4 = 23;
          break;
        }
        case "not-directory": {
          enum4 = 24;
          break;
        }
        case "not-empty": {
          enum4 = 25;
          break;
        }
        case "not-recoverable": {
          enum4 = 26;
          break;
        }
        case "unsupported": {
          enum4 = 27;
          break;
        }
        case "no-tty": {
          enum4 = 28;
          break;
        }
        case "no-such-device": {
          enum4 = 29;
          break;
        }
        case "overflow": {
          enum4 = 30;
          break;
        }
        case "not-permitted": {
          enum4 = 31;
          break;
        }
        case "pipe": {
          enum4 = 32;
          break;
        }
        case "read-only": {
          enum4 = 33;
          break;
        }
        case "invalid-seek": {
          enum4 = 34;
          break;
        }
        case "text-file-busy": {
          enum4 = 35;
          break;
        }
        case "cross-device": {
          enum4 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val4}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 4, enum4, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.read-directory"][Instruction::Return]', {
    funcName: "[method]descriptor.read-directory",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_13_metadata = {
  qualifiedImportFn: "wasi:filesystem/types@0.2.3#[method]descriptor.stat",
  moduleIdx: null
};
function trampoline20(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.stat"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.stat?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "stat",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.stat() };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant12 = ret;
  switch (variant12.tag) {
    case "ok": {
      const e = variant12.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      var { type: v3_0, linkCount: v3_1, size: v3_2, dataAccessTimestamp: v3_3, dataModificationTimestamp: v3_4, statusChangeTimestamp: v3_5 } = e;
      var val4 = v3_0;
      let enum4;
      switch (val4) {
        case "unknown": {
          enum4 = 0;
          break;
        }
        case "block-device": {
          enum4 = 1;
          break;
        }
        case "character-device": {
          enum4 = 2;
          break;
        }
        case "directory": {
          enum4 = 3;
          break;
        }
        case "fifo": {
          enum4 = 4;
          break;
        }
        case "symbolic-link": {
          enum4 = 5;
          break;
        }
        case "regular-file": {
          enum4 = 6;
          break;
        }
        case "socket": {
          enum4 = 7;
          break;
        }
        default: {
          if (v3_0 instanceof Error) {
            console.error(v3_0);
          }
          throw new TypeError(`"${val4}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg1 + 8, enum4, true);
      dataView(memory0).setBigInt64(arg1 + 16, toUint64(v3_1), true);
      dataView(memory0).setBigInt64(arg1 + 24, toUint64(v3_2), true);
      var variant6 = v3_3;
      if (variant6 === null || variant6 === void 0) {
        dataView(memory0).setInt8(arg1 + 32, 0, true);
      } else {
        const e2 = variant6;
        dataView(memory0).setInt8(arg1 + 32, 1, true);
        var { seconds: v5_0, nanoseconds: v5_1 } = e2;
        dataView(memory0).setBigInt64(arg1 + 40, toUint64(v5_0), true);
        dataView(memory0).setInt32(arg1 + 48, toUint32(v5_1), true);
      }
      var variant8 = v3_4;
      if (variant8 === null || variant8 === void 0) {
        dataView(memory0).setInt8(arg1 + 56, 0, true);
      } else {
        const e2 = variant8;
        dataView(memory0).setInt8(arg1 + 56, 1, true);
        var { seconds: v7_0, nanoseconds: v7_1 } = e2;
        dataView(memory0).setBigInt64(arg1 + 64, toUint64(v7_0), true);
        dataView(memory0).setInt32(arg1 + 72, toUint32(v7_1), true);
      }
      var variant10 = v3_5;
      if (variant10 === null || variant10 === void 0) {
        dataView(memory0).setInt8(arg1 + 80, 0, true);
      } else {
        const e2 = variant10;
        dataView(memory0).setInt8(arg1 + 80, 1, true);
        var { seconds: v9_0, nanoseconds: v9_1 } = e2;
        dataView(memory0).setBigInt64(arg1 + 88, toUint64(v9_0), true);
        dataView(memory0).setInt32(arg1 + 96, toUint32(v9_1), true);
      }
      break;
    }
    case "err": {
      const e = variant12.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val11 = e;
      let enum11;
      switch (val11) {
        case "access": {
          enum11 = 0;
          break;
        }
        case "would-block": {
          enum11 = 1;
          break;
        }
        case "already": {
          enum11 = 2;
          break;
        }
        case "bad-descriptor": {
          enum11 = 3;
          break;
        }
        case "busy": {
          enum11 = 4;
          break;
        }
        case "deadlock": {
          enum11 = 5;
          break;
        }
        case "quota": {
          enum11 = 6;
          break;
        }
        case "exist": {
          enum11 = 7;
          break;
        }
        case "file-too-large": {
          enum11 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum11 = 9;
          break;
        }
        case "in-progress": {
          enum11 = 10;
          break;
        }
        case "interrupted": {
          enum11 = 11;
          break;
        }
        case "invalid": {
          enum11 = 12;
          break;
        }
        case "io": {
          enum11 = 13;
          break;
        }
        case "is-directory": {
          enum11 = 14;
          break;
        }
        case "loop": {
          enum11 = 15;
          break;
        }
        case "too-many-links": {
          enum11 = 16;
          break;
        }
        case "message-size": {
          enum11 = 17;
          break;
        }
        case "name-too-long": {
          enum11 = 18;
          break;
        }
        case "no-device": {
          enum11 = 19;
          break;
        }
        case "no-entry": {
          enum11 = 20;
          break;
        }
        case "no-lock": {
          enum11 = 21;
          break;
        }
        case "insufficient-memory": {
          enum11 = 22;
          break;
        }
        case "insufficient-space": {
          enum11 = 23;
          break;
        }
        case "not-directory": {
          enum11 = 24;
          break;
        }
        case "not-empty": {
          enum11 = 25;
          break;
        }
        case "not-recoverable": {
          enum11 = 26;
          break;
        }
        case "unsupported": {
          enum11 = 27;
          break;
        }
        case "no-tty": {
          enum11 = 28;
          break;
        }
        case "no-such-device": {
          enum11 = 29;
          break;
        }
        case "overflow": {
          enum11 = 30;
          break;
        }
        case "not-permitted": {
          enum11 = 31;
          break;
        }
        case "pipe": {
          enum11 = 32;
          break;
        }
        case "read-only": {
          enum11 = 33;
          break;
        }
        case "invalid-seek": {
          enum11 = 34;
          break;
        }
        case "text-file-busy": {
          enum11 = 35;
          break;
        }
        case "cross-device": {
          enum11 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val11}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 8, enum11, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.stat"][Instruction::Return]', {
    funcName: "[method]descriptor.stat",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_14_metadata = {
  qualifiedImportFn: "wasi:filesystem/types@0.2.3#[method]descriptor.stat-at",
  moduleIdx: null
};
function trampoline21(arg0, arg1, arg2, arg3, arg4) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  if ((arg1 & 4294967294) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags3 = {
    symlinkFollow: Boolean(arg1 & 1)
  };
  var ptr4 = arg2;
  var len4 = arg3;
  var result4 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr4, len4));
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.stat-at"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.statAt?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "statAt",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.statAt(flags3, result4) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant14 = ret;
  switch (variant14.tag) {
    case "ok": {
      const e = variant14.val;
      dataView(memory0).setInt8(arg4 + 0, 0, true);
      var { type: v5_0, linkCount: v5_1, size: v5_2, dataAccessTimestamp: v5_3, dataModificationTimestamp: v5_4, statusChangeTimestamp: v5_5 } = e;
      var val6 = v5_0;
      let enum6;
      switch (val6) {
        case "unknown": {
          enum6 = 0;
          break;
        }
        case "block-device": {
          enum6 = 1;
          break;
        }
        case "character-device": {
          enum6 = 2;
          break;
        }
        case "directory": {
          enum6 = 3;
          break;
        }
        case "fifo": {
          enum6 = 4;
          break;
        }
        case "symbolic-link": {
          enum6 = 5;
          break;
        }
        case "regular-file": {
          enum6 = 6;
          break;
        }
        case "socket": {
          enum6 = 7;
          break;
        }
        default: {
          if (v5_0 instanceof Error) {
            console.error(v5_0);
          }
          throw new TypeError(`"${val6}" is not one of the cases of descriptor-type`);
        }
      }
      dataView(memory0).setInt8(arg4 + 8, enum6, true);
      dataView(memory0).setBigInt64(arg4 + 16, toUint64(v5_1), true);
      dataView(memory0).setBigInt64(arg4 + 24, toUint64(v5_2), true);
      var variant8 = v5_3;
      if (variant8 === null || variant8 === void 0) {
        dataView(memory0).setInt8(arg4 + 32, 0, true);
      } else {
        const e2 = variant8;
        dataView(memory0).setInt8(arg4 + 32, 1, true);
        var { seconds: v7_0, nanoseconds: v7_1 } = e2;
        dataView(memory0).setBigInt64(arg4 + 40, toUint64(v7_0), true);
        dataView(memory0).setInt32(arg4 + 48, toUint32(v7_1), true);
      }
      var variant10 = v5_4;
      if (variant10 === null || variant10 === void 0) {
        dataView(memory0).setInt8(arg4 + 56, 0, true);
      } else {
        const e2 = variant10;
        dataView(memory0).setInt8(arg4 + 56, 1, true);
        var { seconds: v9_0, nanoseconds: v9_1 } = e2;
        dataView(memory0).setBigInt64(arg4 + 64, toUint64(v9_0), true);
        dataView(memory0).setInt32(arg4 + 72, toUint32(v9_1), true);
      }
      var variant12 = v5_5;
      if (variant12 === null || variant12 === void 0) {
        dataView(memory0).setInt8(arg4 + 80, 0, true);
      } else {
        const e2 = variant12;
        dataView(memory0).setInt8(arg4 + 80, 1, true);
        var { seconds: v11_0, nanoseconds: v11_1 } = e2;
        dataView(memory0).setBigInt64(arg4 + 88, toUint64(v11_0), true);
        dataView(memory0).setInt32(arg4 + 96, toUint32(v11_1), true);
      }
      break;
    }
    case "err": {
      const e = variant14.val;
      dataView(memory0).setInt8(arg4 + 0, 1, true);
      var val13 = e;
      let enum13;
      switch (val13) {
        case "access": {
          enum13 = 0;
          break;
        }
        case "would-block": {
          enum13 = 1;
          break;
        }
        case "already": {
          enum13 = 2;
          break;
        }
        case "bad-descriptor": {
          enum13 = 3;
          break;
        }
        case "busy": {
          enum13 = 4;
          break;
        }
        case "deadlock": {
          enum13 = 5;
          break;
        }
        case "quota": {
          enum13 = 6;
          break;
        }
        case "exist": {
          enum13 = 7;
          break;
        }
        case "file-too-large": {
          enum13 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum13 = 9;
          break;
        }
        case "in-progress": {
          enum13 = 10;
          break;
        }
        case "interrupted": {
          enum13 = 11;
          break;
        }
        case "invalid": {
          enum13 = 12;
          break;
        }
        case "io": {
          enum13 = 13;
          break;
        }
        case "is-directory": {
          enum13 = 14;
          break;
        }
        case "loop": {
          enum13 = 15;
          break;
        }
        case "too-many-links": {
          enum13 = 16;
          break;
        }
        case "message-size": {
          enum13 = 17;
          break;
        }
        case "name-too-long": {
          enum13 = 18;
          break;
        }
        case "no-device": {
          enum13 = 19;
          break;
        }
        case "no-entry": {
          enum13 = 20;
          break;
        }
        case "no-lock": {
          enum13 = 21;
          break;
        }
        case "insufficient-memory": {
          enum13 = 22;
          break;
        }
        case "insufficient-space": {
          enum13 = 23;
          break;
        }
        case "not-directory": {
          enum13 = 24;
          break;
        }
        case "not-empty": {
          enum13 = 25;
          break;
        }
        case "not-recoverable": {
          enum13 = 26;
          break;
        }
        case "unsupported": {
          enum13 = 27;
          break;
        }
        case "no-tty": {
          enum13 = 28;
          break;
        }
        case "no-such-device": {
          enum13 = 29;
          break;
        }
        case "overflow": {
          enum13 = 30;
          break;
        }
        case "not-permitted": {
          enum13 = 31;
          break;
        }
        case "pipe": {
          enum13 = 32;
          break;
        }
        case "read-only": {
          enum13 = 33;
          break;
        }
        case "invalid-seek": {
          enum13 = 34;
          break;
        }
        case "text-file-busy": {
          enum13 = 35;
          break;
        }
        case "cross-device": {
          enum13 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val13}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg4 + 8, enum13, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.stat-at"][Instruction::Return]', {
    funcName: "[method]descriptor.stat-at",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_15_metadata = {
  qualifiedImportFn: "wasi:filesystem/types@0.2.3#[method]descriptor.open-at",
  moduleIdx: null
};
function trampoline22(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
  var handle1 = arg0;
  var rep2 = handleTable6[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable6.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(Descriptor2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  if ((arg1 & 4294967294) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags3 = {
    symlinkFollow: Boolean(arg1 & 1)
  };
  var ptr4 = arg2;
  var len4 = arg3;
  var result4 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr4, len4));
  if ((arg4 & 4294967280) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags5 = {
    create: Boolean(arg4 & 1),
    directory: Boolean(arg4 & 2),
    exclusive: Boolean(arg4 & 4),
    truncate: Boolean(arg4 & 8)
  };
  if ((arg5 & 4294967232) !== 0) {
    throw new TypeError("flags have extraneous bits set");
  }
  var flags6 = {
    read: Boolean(arg5 & 1),
    write: Boolean(arg5 & 2),
    fileIntegritySync: Boolean(arg5 & 4),
    dataIntegritySync: Boolean(arg5 & 8),
    requestedWriteSync: Boolean(arg5 & 16),
    mutateDirectory: Boolean(arg5 & 32)
  };
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.open-at"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.openAt?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "openAt",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.openAt(flags3, result4, flags5, flags6) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant9 = ret;
  switch (variant9.tag) {
    case "ok": {
      const e = variant9.val;
      dataView(memory0).setInt8(arg6 + 0, 0, true);
      if (!(e instanceof Descriptor2)) {
        throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
      }
      var handle7 = e[symbolRscHandle];
      if (!handle7) {
        const rep3 = e[symbolRscRep] || ++captureCnt6;
        captureTable6.set(rep3, e);
        handle7 = rscTableCreateOwn(handleTable6, rep3);
      }
      dataView(memory0).setInt32(arg6 + 4, handle7, true);
      break;
    }
    case "err": {
      const e = variant9.val;
      dataView(memory0).setInt8(arg6 + 0, 1, true);
      var val8 = e;
      let enum8;
      switch (val8) {
        case "access": {
          enum8 = 0;
          break;
        }
        case "would-block": {
          enum8 = 1;
          break;
        }
        case "already": {
          enum8 = 2;
          break;
        }
        case "bad-descriptor": {
          enum8 = 3;
          break;
        }
        case "busy": {
          enum8 = 4;
          break;
        }
        case "deadlock": {
          enum8 = 5;
          break;
        }
        case "quota": {
          enum8 = 6;
          break;
        }
        case "exist": {
          enum8 = 7;
          break;
        }
        case "file-too-large": {
          enum8 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum8 = 9;
          break;
        }
        case "in-progress": {
          enum8 = 10;
          break;
        }
        case "interrupted": {
          enum8 = 11;
          break;
        }
        case "invalid": {
          enum8 = 12;
          break;
        }
        case "io": {
          enum8 = 13;
          break;
        }
        case "is-directory": {
          enum8 = 14;
          break;
        }
        case "loop": {
          enum8 = 15;
          break;
        }
        case "too-many-links": {
          enum8 = 16;
          break;
        }
        case "message-size": {
          enum8 = 17;
          break;
        }
        case "name-too-long": {
          enum8 = 18;
          break;
        }
        case "no-device": {
          enum8 = 19;
          break;
        }
        case "no-entry": {
          enum8 = 20;
          break;
        }
        case "no-lock": {
          enum8 = 21;
          break;
        }
        case "insufficient-memory": {
          enum8 = 22;
          break;
        }
        case "insufficient-space": {
          enum8 = 23;
          break;
        }
        case "not-directory": {
          enum8 = 24;
          break;
        }
        case "not-empty": {
          enum8 = 25;
          break;
        }
        case "not-recoverable": {
          enum8 = 26;
          break;
        }
        case "unsupported": {
          enum8 = 27;
          break;
        }
        case "no-tty": {
          enum8 = 28;
          break;
        }
        case "no-such-device": {
          enum8 = 29;
          break;
        }
        case "overflow": {
          enum8 = 30;
          break;
        }
        case "not-permitted": {
          enum8 = 31;
          break;
        }
        case "pipe": {
          enum8 = 32;
          break;
        }
        case "read-only": {
          enum8 = 33;
          break;
        }
        case "invalid-seek": {
          enum8 = 34;
          break;
        }
        case "text-file-busy": {
          enum8 = 35;
          break;
        }
        case "cross-device": {
          enum8 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val8}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg6 + 4, enum8, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]descriptor.open-at"][Instruction::Return]', {
    funcName: "[method]descriptor.open-at",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_16_metadata = {
  qualifiedImportFn: "wasi:filesystem/types@0.2.3#[method]directory-entry-stream.read-directory-entry",
  moduleIdx: null
};
function trampoline23(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable5[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable5.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(DirectoryEntryStream2.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]directory-entry-stream.read-directory-entry"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.readDirectoryEntry?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "readDirectoryEntry",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.readDirectoryEntry() };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant8 = ret;
  switch (variant8.tag) {
    case "ok": {
      const e = variant8.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      var variant6 = e;
      if (variant6 === null || variant6 === void 0) {
        dataView(memory0).setInt8(arg1 + 4, 0, true);
      } else {
        const e2 = variant6;
        dataView(memory0).setInt8(arg1 + 4, 1, true);
        var { type: v3_0, name: v3_1 } = e2;
        var val4 = v3_0;
        let enum4;
        switch (val4) {
          case "unknown": {
            enum4 = 0;
            break;
          }
          case "block-device": {
            enum4 = 1;
            break;
          }
          case "character-device": {
            enum4 = 2;
            break;
          }
          case "directory": {
            enum4 = 3;
            break;
          }
          case "fifo": {
            enum4 = 4;
            break;
          }
          case "symbolic-link": {
            enum4 = 5;
            break;
          }
          case "regular-file": {
            enum4 = 6;
            break;
          }
          case "socket": {
            enum4 = 7;
            break;
          }
          default: {
            if (v3_0 instanceof Error) {
              console.error(v3_0);
            }
            throw new TypeError(`"${val4}" is not one of the cases of descriptor-type`);
          }
        }
        dataView(memory0).setInt8(arg1 + 8, enum4, true);
        var encodeRes = _utf8AllocateAndEncode(v3_1, realloc0, memory0);
        var ptr5 = encodeRes.ptr;
        var len5 = encodeRes.len;
        dataView(memory0).setUint32(arg1 + 16, len5, true);
        dataView(memory0).setUint32(arg1 + 12, ptr5, true);
      }
      break;
    }
    case "err": {
      const e = variant8.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var val7 = e;
      let enum7;
      switch (val7) {
        case "access": {
          enum7 = 0;
          break;
        }
        case "would-block": {
          enum7 = 1;
          break;
        }
        case "already": {
          enum7 = 2;
          break;
        }
        case "bad-descriptor": {
          enum7 = 3;
          break;
        }
        case "busy": {
          enum7 = 4;
          break;
        }
        case "deadlock": {
          enum7 = 5;
          break;
        }
        case "quota": {
          enum7 = 6;
          break;
        }
        case "exist": {
          enum7 = 7;
          break;
        }
        case "file-too-large": {
          enum7 = 8;
          break;
        }
        case "illegal-byte-sequence": {
          enum7 = 9;
          break;
        }
        case "in-progress": {
          enum7 = 10;
          break;
        }
        case "interrupted": {
          enum7 = 11;
          break;
        }
        case "invalid": {
          enum7 = 12;
          break;
        }
        case "io": {
          enum7 = 13;
          break;
        }
        case "is-directory": {
          enum7 = 14;
          break;
        }
        case "loop": {
          enum7 = 15;
          break;
        }
        case "too-many-links": {
          enum7 = 16;
          break;
        }
        case "message-size": {
          enum7 = 17;
          break;
        }
        case "name-too-long": {
          enum7 = 18;
          break;
        }
        case "no-device": {
          enum7 = 19;
          break;
        }
        case "no-entry": {
          enum7 = 20;
          break;
        }
        case "no-lock": {
          enum7 = 21;
          break;
        }
        case "insufficient-memory": {
          enum7 = 22;
          break;
        }
        case "insufficient-space": {
          enum7 = 23;
          break;
        }
        case "not-directory": {
          enum7 = 24;
          break;
        }
        case "not-empty": {
          enum7 = 25;
          break;
        }
        case "not-recoverable": {
          enum7 = 26;
          break;
        }
        case "unsupported": {
          enum7 = 27;
          break;
        }
        case "no-tty": {
          enum7 = 28;
          break;
        }
        case "no-such-device": {
          enum7 = 29;
          break;
        }
        case "overflow": {
          enum7 = 30;
          break;
        }
        case "not-permitted": {
          enum7 = 31;
          break;
        }
        case "pipe": {
          enum7 = 32;
          break;
        }
        case "read-only": {
          enum7 = 33;
          break;
        }
        case "invalid-seek": {
          enum7 = 34;
          break;
        }
        case "text-file-busy": {
          enum7 = 35;
          break;
        }
        case "cross-device": {
          enum7 = 36;
          break;
        }
        default: {
          if (e instanceof Error) {
            console.error(e);
          }
          throw new TypeError(`"${val7}" is not one of the cases of error-code`);
        }
      }
      dataView(memory0).setInt8(arg1 + 4, enum7, true);
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:filesystem/types@0.2.3", function="[method]directory-entry-stream.read-directory-entry"][Instruction::Return]', {
    funcName: "[method]directory-entry-stream.read-directory-entry",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_17_metadata = {
  qualifiedImportFn: "wasi:io/streams@0.2.3#[method]input-stream.read",
  moduleIdx: null
};
function trampoline24(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rep2 = handleTable1[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable1.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(InputStream4.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]input-stream.read"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.read?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "read",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.read(BigInt.asUintN(64, arg1)) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant6 = ret;
  switch (variant6.tag) {
    case "ok": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      var val3 = e;
      var len3 = val3.byteLength;
      var ptr3 = realloc0(0, 0, 1, len3 * 1);
      let valData3;
      const valLenBytes3 = len3 * 1;
      if (Array.isArray(val3)) {
        let offset = 0;
        const dv3 = new DataView(memory0.buffer);
        for (const v of val3) {
          dv3.setUint8(ptr3 + offset, v, true);
          offset += 1;
        }
      } else {
        valData3 = new Uint8Array(val3.buffer || val3, val3.byteOffset, valLenBytes3);
        const out3 = new Uint8Array(memory0.buffer, ptr3, valLenBytes3);
        out3.set(valData3);
      }
      dataView(memory0).setUint32(arg2 + 8, len3, true);
      dataView(memory0).setUint32(arg2 + 4, ptr3, true);
      break;
    }
    case "err": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var variant5 = e;
      switch (variant5.tag) {
        case "last-operation-failed": {
          const e2 = variant5.val;
          dataView(memory0).setInt8(arg2 + 4, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle4 = e2[symbolRscHandle];
          if (!handle4) {
            const rep3 = e2[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep3, e2);
            handle4 = rscTableCreateOwn(handleTable0, rep3);
          }
          dataView(memory0).setInt32(arg2 + 8, handle4, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg2 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]input-stream.read"][Instruction::Return]', {
    funcName: "[method]input-stream.read",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_18_metadata = {
  qualifiedImportFn: "wasi:io/streams@0.2.3#[method]input-stream.blocking-read",
  moduleIdx: null
};
function trampoline25(arg0, arg1, arg2) {
  var handle1 = arg0;
  var rep2 = handleTable1[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable1.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(InputStream4.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]input-stream.blocking-read"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.blockingRead?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "blockingRead",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.blockingRead(BigInt.asUintN(64, arg1)) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant6 = ret;
  switch (variant6.tag) {
    case "ok": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg2 + 0, 0, true);
      var val3 = e;
      var len3 = val3.byteLength;
      var ptr3 = realloc0(0, 0, 1, len3 * 1);
      let valData3;
      const valLenBytes3 = len3 * 1;
      if (Array.isArray(val3)) {
        let offset = 0;
        const dv3 = new DataView(memory0.buffer);
        for (const v of val3) {
          dv3.setUint8(ptr3 + offset, v, true);
          offset += 1;
        }
      } else {
        valData3 = new Uint8Array(val3.buffer || val3, val3.byteOffset, valLenBytes3);
        const out3 = new Uint8Array(memory0.buffer, ptr3, valLenBytes3);
        out3.set(valData3);
      }
      dataView(memory0).setUint32(arg2 + 8, len3, true);
      dataView(memory0).setUint32(arg2 + 4, ptr3, true);
      break;
    }
    case "err": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg2 + 0, 1, true);
      var variant5 = e;
      switch (variant5.tag) {
        case "last-operation-failed": {
          const e2 = variant5.val;
          dataView(memory0).setInt8(arg2 + 4, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle4 = e2[symbolRscHandle];
          if (!handle4) {
            const rep3 = e2[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep3, e2);
            handle4 = rscTableCreateOwn(handleTable0, rep3);
          }
          dataView(memory0).setInt32(arg2 + 8, handle4, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg2 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]input-stream.blocking-read"][Instruction::Return]', {
    funcName: "[method]input-stream.blocking-read",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_19_metadata = {
  qualifiedImportFn: "wasi:io/streams@0.2.3#[method]output-stream.check-write",
  moduleIdx: null
};
function trampoline26(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable2[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable2.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(OutputStream4.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.check-write"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.checkWrite?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "checkWrite",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.checkWrite() };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      dataView(memory0).setBigInt64(arg1 + 8, toUint64(e), true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var variant4 = e;
      switch (variant4.tag) {
        case "last-operation-failed": {
          const e2 = variant4.val;
          dataView(memory0).setInt8(arg1 + 8, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle3 = e2[symbolRscHandle];
          if (!handle3) {
            const rep3 = e2[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep3, e2);
            handle3 = rscTableCreateOwn(handleTable0, rep3);
          }
          dataView(memory0).setInt32(arg1 + 12, handle3, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg1 + 8, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant4.tag)}\` (received \`${variant4}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.check-write"][Instruction::Return]', {
    funcName: "[method]output-stream.check-write",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_20_metadata = {
  qualifiedImportFn: "wasi:io/streams@0.2.3#[method]output-stream.write",
  moduleIdx: null
};
function trampoline27(arg0, arg1, arg2, arg3) {
  var handle1 = arg0;
  var rep2 = handleTable2[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable2.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(OutputStream4.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  var ptr3 = arg1;
  var len3 = arg2;
  var result3 = new Uint8Array(memory0.buffer.slice(ptr3, ptr3 + len3 * 1));
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.write"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.write?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "write",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.write(result3) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant6 = ret;
  switch (variant6.tag) {
    case "ok": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg3 + 0, 0, true);
      break;
    }
    case "err": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg3 + 0, 1, true);
      var variant5 = e;
      switch (variant5.tag) {
        case "last-operation-failed": {
          const e2 = variant5.val;
          dataView(memory0).setInt8(arg3 + 4, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle4 = e2[symbolRscHandle];
          if (!handle4) {
            const rep3 = e2[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep3, e2);
            handle4 = rscTableCreateOwn(handleTable0, rep3);
          }
          dataView(memory0).setInt32(arg3 + 8, handle4, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg3 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.write"][Instruction::Return]', {
    funcName: "[method]output-stream.write",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_21_metadata = {
  qualifiedImportFn: "wasi:io/streams@0.2.3#[method]output-stream.blocking-write-and-flush",
  moduleIdx: null
};
function trampoline28(arg0, arg1, arg2, arg3) {
  var handle1 = arg0;
  var rep2 = handleTable2[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable2.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(OutputStream4.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  var ptr3 = arg1;
  var len3 = arg2;
  var result3 = new Uint8Array(memory0.buffer.slice(ptr3, ptr3 + len3 * 1));
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.blocking-write-and-flush"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.blockingWriteAndFlush?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "blockingWriteAndFlush",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.blockingWriteAndFlush(result3) };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant6 = ret;
  switch (variant6.tag) {
    case "ok": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg3 + 0, 0, true);
      break;
    }
    case "err": {
      const e = variant6.val;
      dataView(memory0).setInt8(arg3 + 0, 1, true);
      var variant5 = e;
      switch (variant5.tag) {
        case "last-operation-failed": {
          const e2 = variant5.val;
          dataView(memory0).setInt8(arg3 + 4, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle4 = e2[symbolRscHandle];
          if (!handle4) {
            const rep3 = e2[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep3, e2);
            handle4 = rscTableCreateOwn(handleTable0, rep3);
          }
          dataView(memory0).setInt32(arg3 + 8, handle4, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg3 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.blocking-write-and-flush"][Instruction::Return]', {
    funcName: "[method]output-stream.blocking-write-and-flush",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_22_metadata = {
  qualifiedImportFn: "wasi:io/streams@0.2.3#[method]output-stream.blocking-flush",
  moduleIdx: null
};
function trampoline29(arg0, arg1) {
  var handle1 = arg0;
  var rep2 = handleTable2[(handle1 << 1) + 1] & ~T_FLAG;
  var rsc0 = captureTable2.get(rep2);
  if (!rsc0) {
    rsc0 = Object.create(OutputStream4.prototype);
    Object.defineProperty(rsc0, symbolRscHandle, { writable: true, value: handle1 });
    Object.defineProperty(rsc0, symbolRscRep, { writable: true, value: rep2 });
  }
  curResourceBorrows.push(rsc0);
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.blocking-flush"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = rsc0.blockingFlush?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "blockingFlush",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "result-catch-handler",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret;
  try {
    ret = { tag: "ok", val: rsc0.blockingFlush() };
  } catch (e) {
    ret = { tag: "err", val: getErrorPayload(e) };
  }
  for (const rsc of curResourceBorrows) {
    rsc[symbolRscHandle] = void 0;
  }
  curResourceBorrows = [];
  endCurrentTask(0);
  var variant5 = ret;
  switch (variant5.tag) {
    case "ok": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 0, true);
      break;
    }
    case "err": {
      const e = variant5.val;
      dataView(memory0).setInt8(arg1 + 0, 1, true);
      var variant4 = e;
      switch (variant4.tag) {
        case "last-operation-failed": {
          const e2 = variant4.val;
          dataView(memory0).setInt8(arg1 + 4, 0, true);
          if (!(e2 instanceof Error$1)) {
            throw new TypeError('Resource error: Not a valid "Error" resource.');
          }
          var handle3 = e2[symbolRscHandle];
          if (!handle3) {
            const rep3 = e2[symbolRscRep] || ++captureCnt0;
            captureTable0.set(rep3, e2);
            handle3 = rscTableCreateOwn(handleTable0, rep3);
          }
          dataView(memory0).setInt32(arg1 + 8, handle3, true);
          break;
        }
        case "closed": {
          dataView(memory0).setInt8(arg1 + 4, 1, true);
          break;
        }
        default: {
          throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant4.tag)}\` (received \`${variant4}\`) specified for \`StreamError\``);
        }
      }
      break;
    }
    default: {
      throw new TypeError("invalid variant specified for result");
    }
  }
  _debugLog('[iface="wasi:io/streams@0.2.3", function="[method]output-stream.blocking-flush"][Instruction::Return]', {
    funcName: "[method]output-stream.blocking-flush",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_23_metadata = {
  qualifiedImportFn: "wasi:random/random@0.2.3#get-random-bytes",
  moduleIdx: null
};
function trampoline30(arg0, arg1) {
  _debugLog('[iface="wasi:random/random@0.2.3", function="get-random-bytes"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = getRandomBytes?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "getRandomBytes",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret = getRandomBytes(BigInt.asUintN(64, arg0));
  endCurrentTask(0);
  var val0 = ret;
  var len0 = val0.byteLength;
  var ptr0 = realloc0(0, 0, 1, len0 * 1);
  let valData0;
  const valLenBytes0 = len0 * 1;
  if (Array.isArray(val0)) {
    let offset = 0;
    const dv0 = new DataView(memory0.buffer);
    for (const v of val0) {
      dv0.setUint8(ptr0 + offset, v, true);
      offset += 1;
    }
  } else {
    valData0 = new Uint8Array(val0.buffer || val0, val0.byteOffset, valLenBytes0);
    const out0 = new Uint8Array(memory0.buffer, ptr0, valLenBytes0);
    out0.set(valData0);
  }
  dataView(memory0).setUint32(arg1 + 4, len0, true);
  dataView(memory0).setUint32(arg1 + 0, ptr0, true);
  _debugLog('[iface="wasi:random/random@0.2.3", function="get-random-bytes"][Instruction::Return]', {
    funcName: "get-random-bytes",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_24_metadata = {
  qualifiedImportFn: "wasi:filesystem/preopens@0.2.3#get-directories",
  moduleIdx: null
};
function trampoline31(arg0) {
  _debugLog('[iface="wasi:filesystem/preopens@0.2.3", function="get-directories"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = getDirectories?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "getDirectories",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret = getDirectories();
  endCurrentTask(0);
  var vec3 = ret;
  var len3 = vec3.length;
  var result3 = realloc0(0, 0, 4, len3 * 12);
  for (let i = 0; i < vec3.length; i++) {
    const e = vec3[i];
    const base = result3 + i * 12;
    var [tuple0_0, tuple0_1] = e;
    if (!(tuple0_0 instanceof Descriptor2)) {
      throw new TypeError('Resource error: Not a valid "Descriptor" resource.');
    }
    var handle1 = tuple0_0[symbolRscHandle];
    if (!handle1) {
      const rep2 = tuple0_0[symbolRscRep] || ++captureCnt6;
      captureTable6.set(rep2, tuple0_0);
      handle1 = rscTableCreateOwn(handleTable6, rep2);
    }
    dataView(memory0).setInt32(base + 0, handle1, true);
    var encodeRes = _utf8AllocateAndEncode(tuple0_1, realloc0, memory0);
    var ptr2 = encodeRes.ptr;
    var len2 = encodeRes.len;
    dataView(memory0).setUint32(base + 8, len2, true);
    dataView(memory0).setUint32(base + 4, ptr2, true);
  }
  dataView(memory0).setUint32(arg0 + 4, len3, true);
  dataView(memory0).setUint32(arg0 + 0, result3, true);
  _debugLog('[iface="wasi:filesystem/preopens@0.2.3", function="get-directories"][Instruction::Return]', {
    funcName: "get-directories",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_25_metadata = {
  qualifiedImportFn: "wasi:cli/terminal-stdin@0.2.3#get-terminal-stdin",
  moduleIdx: null
};
var handleTable3 = [T_FLAG, 0];
var captureTable3 = /* @__PURE__ */ new Map();
var captureCnt3 = 0;
handleTables[3] = handleTable3;
function trampoline32(arg0) {
  _debugLog('[iface="wasi:cli/terminal-stdin@0.2.3", function="get-terminal-stdin"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = getTerminalStdin?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "getTerminalStdin",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret = getTerminalStdin();
  endCurrentTask(0);
  var variant1 = ret;
  if (variant1 === null || variant1 === void 0) {
    dataView(memory0).setInt8(arg0 + 0, 0, true);
  } else {
    const e = variant1;
    dataView(memory0).setInt8(arg0 + 0, 1, true);
    if (!(e instanceof TerminalInput2)) {
      throw new TypeError('Resource error: Not a valid "TerminalInput" resource.');
    }
    var handle0 = e[symbolRscHandle];
    if (!handle0) {
      const rep2 = e[symbolRscRep] || ++captureCnt3;
      captureTable3.set(rep2, e);
      handle0 = rscTableCreateOwn(handleTable3, rep2);
    }
    dataView(memory0).setInt32(arg0 + 4, handle0, true);
  }
  _debugLog('[iface="wasi:cli/terminal-stdin@0.2.3", function="get-terminal-stdin"][Instruction::Return]', {
    funcName: "get-terminal-stdin",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_26_metadata = {
  qualifiedImportFn: "wasi:cli/terminal-stdout@0.2.3#get-terminal-stdout",
  moduleIdx: null
};
var handleTable4 = [T_FLAG, 0];
var captureTable4 = /* @__PURE__ */ new Map();
var captureCnt4 = 0;
handleTables[4] = handleTable4;
function trampoline33(arg0) {
  _debugLog('[iface="wasi:cli/terminal-stdout@0.2.3", function="get-terminal-stdout"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = getTerminalStdout?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "getTerminalStdout",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret = getTerminalStdout();
  endCurrentTask(0);
  var variant1 = ret;
  if (variant1 === null || variant1 === void 0) {
    dataView(memory0).setInt8(arg0 + 0, 0, true);
  } else {
    const e = variant1;
    dataView(memory0).setInt8(arg0 + 0, 1, true);
    if (!(e instanceof TerminalOutput2)) {
      throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
    }
    var handle0 = e[symbolRscHandle];
    if (!handle0) {
      const rep2 = e[symbolRscRep] || ++captureCnt4;
      captureTable4.set(rep2, e);
      handle0 = rscTableCreateOwn(handleTable4, rep2);
    }
    dataView(memory0).setInt32(arg0 + 4, handle0, true);
  }
  _debugLog('[iface="wasi:cli/terminal-stdout@0.2.3", function="get-terminal-stdout"][Instruction::Return]', {
    funcName: "get-terminal-stdout",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var lowered_import_27_metadata = {
  qualifiedImportFn: "wasi:cli/terminal-stderr@0.2.3#get-terminal-stderr",
  moduleIdx: null
};
function trampoline34(arg0) {
  _debugLog('[iface="wasi:cli/terminal-stderr@0.2.3", function="get-terminal-stderr"] [Instruction::CallInterface] (sync, @ enter)');
  let hostProvided = false;
  hostProvided = getTerminalStderr?._isHostProvided;
  let parentTask;
  let task;
  let subtask;
  const createTask = () => {
    const results = createNewCurrentTask({
      componentIdx: 0,
      isAsync: false,
      entryFnName: "getTerminalStderr",
      getCallbackFn: () => null,
      callbackFnName: "null",
      errHandling: "none",
      callingWasmExport: false
    });
    task = results[0];
  };
  taskCreation: {
    parentTask = getCurrentTask(0)?.task;
    if (!parentTask) {
      createTask();
      break taskCreation;
    }
    createTask();
    const isHostAsyncImport = hostProvided && false;
    if (isHostAsyncImport) {
      subtask = parentTask.getLatestSubtask();
      if (!subtask) {
        throw new Error("Missing subtask for host import, has the import been lowered? (ensure asyncImports are set properly)");
      }
      subtask.setChildTask(task);
      task.setParentSubtask(subtask);
    }
  }
  let ret = getTerminalStderr();
  endCurrentTask(0);
  var variant1 = ret;
  if (variant1 === null || variant1 === void 0) {
    dataView(memory0).setInt8(arg0 + 0, 0, true);
  } else {
    const e = variant1;
    dataView(memory0).setInt8(arg0 + 0, 1, true);
    if (!(e instanceof TerminalOutput2)) {
      throw new TypeError('Resource error: Not a valid "TerminalOutput" resource.');
    }
    var handle0 = e[symbolRscHandle];
    if (!handle0) {
      const rep2 = e[symbolRscRep] || ++captureCnt4;
      captureTable4.set(rep2, e);
      handle0 = rscTableCreateOwn(handleTable4, rep2);
    }
    dataView(memory0).setInt32(arg0 + 4, handle0, true);
  }
  _debugLog('[iface="wasi:cli/terminal-stderr@0.2.3", function="get-terminal-stderr"][Instruction::Return]', {
    funcName: "get-terminal-stderr",
    paramCount: 0,
    async: false,
    postReturn: false
  });
}
var exports3;
var realloc1;
var postReturn0;
var postReturn1;
function trampoline0(handle) {
  const handleEntry = rscTableRemove(handleTable5, handle);
  if (handleEntry.own) {
    const rsc = captureTable5.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose3]) rsc[symbolDispose3]();
      captureTable5.delete(handleEntry.rep);
    } else if (DirectoryEntryStream2[symbolCabiDispose]) {
      DirectoryEntryStream2[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline1(handle) {
  const handleEntry = rscTableRemove(handleTable2, handle);
  if (handleEntry.own) {
    const rsc = captureTable2.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose3]) rsc[symbolDispose3]();
      captureTable2.delete(handleEntry.rep);
    } else if (OutputStream4[symbolCabiDispose]) {
      OutputStream4[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline2(handle) {
  const handleEntry = rscTableRemove(handleTable0, handle);
  if (handleEntry.own) {
    const rsc = captureTable0.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose3]) rsc[symbolDispose3]();
      captureTable0.delete(handleEntry.rep);
    } else if (Error$1[symbolCabiDispose]) {
      Error$1[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline3(handle) {
  const handleEntry = rscTableRemove(handleTable1, handle);
  if (handleEntry.own) {
    const rsc = captureTable1.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose3]) rsc[symbolDispose3]();
      captureTable1.delete(handleEntry.rep);
    } else if (InputStream4[symbolCabiDispose]) {
      InputStream4[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline4(handle) {
  const handleEntry = rscTableRemove(handleTable6, handle);
  if (handleEntry.own) {
    const rsc = captureTable6.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose3]) rsc[symbolDispose3]();
      captureTable6.delete(handleEntry.rep);
    } else if (Descriptor2[symbolCabiDispose]) {
      Descriptor2[symbolCabiDispose](handleEntry.rep);
    }
  }
}
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_0_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_0_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 5,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [],
      metadata: lowered_import_0_metadata,
      resultLowerFns: [_lowerFlatOwn.bind(null, 2)],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: null,
      getMemoryFn: () => null,
      getReallocFn: () => null
    }
  )
});
function trampoline6(handle) {
  const handleEntry = rscTableRemove(handleTable3, handle);
  if (handleEntry.own) {
    const rsc = captureTable3.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose3]) rsc[symbolDispose3]();
      captureTable3.delete(handleEntry.rep);
    } else if (TerminalInput2[symbolCabiDispose]) {
      TerminalInput2[symbolCabiDispose](handleEntry.rep);
    }
  }
}
function trampoline7(handle) {
  const handleEntry = rscTableRemove(handleTable4, handle);
  if (handleEntry.own) {
    const rsc = captureTable4.get(handleEntry.rep);
    if (rsc) {
      if (rsc[symbolDispose3]) rsc[symbolDispose3]();
      captureTable4.delete(handleEntry.rep);
    } else if (TerminalOutput2[symbolCabiDispose]) {
      TerminalOutput2[symbolCabiDispose](handleEntry.rep);
    }
  }
}
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_1_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_1_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 8,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [],
      metadata: lowered_import_1_metadata,
      resultLowerFns: [_lowerFlatOwn.bind(null, 1)],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: null,
      getMemoryFn: () => null,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_2_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_2_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 9,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [],
      metadata: lowered_import_2_metadata,
      resultLowerFns: [_lowerFlatOwn.bind(null, 2)],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: null,
      getMemoryFn: () => null,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_3_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_3_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 10,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatResult([["ok", null, null], ["error", null, null]])],
      metadata: lowered_import_3_metadata,
      resultLowerFns: [],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: null,
      getMemoryFn: () => null,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_4_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_4_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 11,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [],
      metadata: lowered_import_4_metadata,
      resultLowerFns: [_lowerFlatList({ elemLowerFn: _lowerFlatTuple.bind(null, 0), typeIdx: 0 })],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => realloc0
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_5_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_5_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 12,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
      metadata: lowered_import_5_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: _lowerFlatEnum.bind(null, 0), align32: 1 }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatEnum.bind(null, 1), align32: 1 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_6_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_6_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 13,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
      metadata: lowered_import_6_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: _lowerFlatRecord([{ field: "lower", lowerFn: _lowerFlatU64, align32: 8 }, { field: "upper", lowerFn: _lowerFlatU64, align32: 8 }]), align32: 8 }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatEnum.bind(null, 1), align32: 1 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_7_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_7_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 14,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 0)],
      metadata: lowered_import_7_metadata,
      resultLowerFns: [_lowerFlatOption.bind(null, 4)],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_8_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_8_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 15,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 6), _liftFlatFlags.bind(null, 0), _liftFlatStringUTF8],
      metadata: lowered_import_8_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: _lowerFlatRecord([{ field: "lower", lowerFn: _lowerFlatU64, align32: 8 }, { field: "upper", lowerFn: _lowerFlatU64, align32: 8 }]), align32: 8 }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatEnum.bind(null, 1), align32: 1 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_9_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_9_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 16,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 6), _liftFlatU64],
      metadata: lowered_import_9_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: _lowerFlatOwn.bind(null, 1), align32: 4 }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatEnum.bind(null, 1), align32: 1 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_10_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_10_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 17,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 6), _liftFlatU64],
      metadata: lowered_import_10_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: _lowerFlatOwn.bind(null, 2), align32: 4 }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatEnum.bind(null, 1), align32: 1 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_11_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_11_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 18,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
      metadata: lowered_import_11_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: _lowerFlatOwn.bind(null, 2), align32: 4 }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatEnum.bind(null, 1), align32: 1 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_12_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_12_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 19,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
      metadata: lowered_import_12_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: _lowerFlatOwn.bind(null, 5), align32: 4 }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatEnum.bind(null, 1), align32: 1 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_13_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_13_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 20,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 6)],
      metadata: lowered_import_13_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: _lowerFlatRecord([{ field: "type", lowerFn: _lowerFlatEnum.bind(null, 0), align32: 8 }, { field: "link-count", lowerFn: _lowerFlatU64, align32: 8 }, { field: "size", lowerFn: _lowerFlatU64, align32: 8 }, { field: "data-access-timestamp", lowerFn: _lowerFlatOption.bind(null, 2), align32: 8 }, { field: "data-modification-timestamp", lowerFn: _lowerFlatOption.bind(null, 2), align32: 8 }, { field: "status-change-timestamp", lowerFn: _lowerFlatOption.bind(null, 2), align32: 8 }]), align32: 8 }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatEnum.bind(null, 1), align32: 1 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_14_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_14_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 21,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 6), _liftFlatFlags.bind(null, 0), _liftFlatStringUTF8],
      metadata: lowered_import_14_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: _lowerFlatRecord([{ field: "type", lowerFn: _lowerFlatEnum.bind(null, 0), align32: 8 }, { field: "link-count", lowerFn: _lowerFlatU64, align32: 8 }, { field: "size", lowerFn: _lowerFlatU64, align32: 8 }, { field: "data-access-timestamp", lowerFn: _lowerFlatOption.bind(null, 2), align32: 8 }, { field: "data-modification-timestamp", lowerFn: _lowerFlatOption.bind(null, 2), align32: 8 }, { field: "status-change-timestamp", lowerFn: _lowerFlatOption.bind(null, 2), align32: 8 }]), align32: 8 }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatEnum.bind(null, 1), align32: 1 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_15_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_15_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 22,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 6), _liftFlatFlags.bind(null, 0), _liftFlatStringUTF8, _liftFlatFlags.bind(null, 1), _liftFlatFlags.bind(null, 2)],
      metadata: lowered_import_15_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: _lowerFlatOwn.bind(null, 6), align32: 4 }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatEnum.bind(null, 1), align32: 1 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_16_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_16_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 23,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 5)],
      metadata: lowered_import_16_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: _lowerFlatOption.bind(null, 3), align32: 4 }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatEnum.bind(null, 1), align32: 1 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => realloc0
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_17_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_17_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 24,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 1), _liftFlatU64],
      metadata: lowered_import_17_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: _lowerFlatList({ elemLowerFn: _lowerFlatU8, typeIdx: 1 }), align32: 4 }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatVariant({ discriminantSizeBytes: 1, lowerMetas: [{ discriminant: 0, tag: "last-operation-failed", lowerFn: _lowerFlatOwn.bind(null, 0), align32: 4 }, { discriminant: 1, tag: "closed", lowerFn: null, align32: null }] }), align32: 4 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => realloc0
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_18_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_18_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 25,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 1), _liftFlatU64],
      metadata: lowered_import_18_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: _lowerFlatList({ elemLowerFn: _lowerFlatU8, typeIdx: 1 }), align32: 4 }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatVariant({ discriminantSizeBytes: 1, lowerMetas: [{ discriminant: 0, tag: "last-operation-failed", lowerFn: _lowerFlatOwn.bind(null, 0), align32: 4 }, { discriminant: 1, tag: "closed", lowerFn: null, align32: null }] }), align32: 4 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => realloc0
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_19_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_19_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 26,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 2)],
      metadata: lowered_import_19_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: _lowerFlatU64, align32: 8 }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatVariant({ discriminantSizeBytes: 1, lowerMetas: [{ discriminant: 0, tag: "last-operation-failed", lowerFn: _lowerFlatOwn.bind(null, 0), align32: 4 }, { discriminant: 1, tag: "closed", lowerFn: null, align32: null }] }), align32: 4 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_20_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_20_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 27,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 2), _liftFlatList.bind(null, 1)],
      metadata: lowered_import_20_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: null, align32: null }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatVariant({ discriminantSizeBytes: 1, lowerMetas: [{ discriminant: 0, tag: "last-operation-failed", lowerFn: _lowerFlatOwn.bind(null, 0), align32: 4 }, { discriminant: 1, tag: "closed", lowerFn: null, align32: null }] }), align32: 4 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_21_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_21_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 28,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 2), _liftFlatList.bind(null, 1)],
      metadata: lowered_import_21_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: null, align32: null }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatVariant({ discriminantSizeBytes: 1, lowerMetas: [{ discriminant: 0, tag: "last-operation-failed", lowerFn: _lowerFlatOwn.bind(null, 0), align32: 4 }, { discriminant: 1, tag: "closed", lowerFn: null, align32: null }] }), align32: 4 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_22_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_22_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 29,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatBorrow.bind(null, 2)],
      metadata: lowered_import_22_metadata,
      resultLowerFns: [_lowerFlatResult([{ discriminant: 0, tag: "ok", lowerFn: null, align32: null }, { discriminant: 1, tag: "error", lowerFn: _lowerFlatVariant({ discriminantSizeBytes: 1, lowerMetas: [{ discriminant: 0, tag: "last-operation-failed", lowerFn: _lowerFlatOwn.bind(null, 0), align32: 4 }, { discriminant: 1, tag: "closed", lowerFn: null, align32: null }] }), align32: 4 }])],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_23_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_23_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 30,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [_liftFlatU64],
      metadata: lowered_import_23_metadata,
      resultLowerFns: [_lowerFlatList({ elemLowerFn: _lowerFlatU8, typeIdx: 1 })],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => realloc0
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_24_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_24_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 31,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [],
      metadata: lowered_import_24_metadata,
      resultLowerFns: [_lowerFlatList({ elemLowerFn: _lowerFlatTuple.bind(null, 29), typeIdx: 2 })],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => realloc0
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_25_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_25_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 32,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [],
      metadata: lowered_import_25_metadata,
      resultLowerFns: [_lowerFlatOption.bind(null, 0)],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_26_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_26_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 33,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [],
      metadata: lowered_import_26_metadata,
      resultLowerFns: [_lowerFlatOption.bind(null, 1)],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
GlobalComponentAsyncLowers.define({
  componentIdx: lowered_import_27_metadata.moduleIdx,
  qualifiedImportFn: lowered_import_27_metadata.qualifiedImportFn,
  fn: _lowerImport.bind(
    null,
    {
      trampolineIdx: 34,
      componentIdx: 0,
      isAsync: false,
      paramLiftFns: [],
      metadata: lowered_import_27_metadata,
      resultLowerFns: [_lowerFlatOption.bind(null, 1)],
      getCallbackFn: () => null,
      getPostReturnFn: () => null,
      isCancellable: false,
      memoryIdx: 0,
      getMemoryFn: () => memory0,
      getReallocFn: () => null
    }
  )
});
var exports1Generate;
function generate(arg0, arg1) {
  if (!_initialized) throwUninitialized();
  var ptr0 = realloc1(0, 0, 4, 84);
  var val1 = arg0;
  var len1 = val1.byteLength;
  var ptr1 = realloc1(0, 0, 1, len1 * 1);
  let valData1;
  const valLenBytes1 = len1 * 1;
  if (Array.isArray(val1)) {
    let offset = 0;
    const dv1 = new DataView(memory0.buffer);
    for (const v of val1) {
      dv1.setUint8(ptr1 + offset, v, true);
      offset += 1;
    }
  } else {
    valData1 = new Uint8Array(val1.buffer || val1, val1.byteOffset, valLenBytes1);
    const out1 = new Uint8Array(memory0.buffer, ptr1, valLenBytes1);
    out1.set(valData1);
  }
  dataView(memory0).setUint32(ptr0 + 4, len1, true);
  dataView(memory0).setUint32(ptr0 + 0, ptr1, true);
  var { name: v2_0, noTypescript: v2_1, instantiation: v2_2, importBindings: v2_3, map: v2_4, compat: v2_5, noNodejsCompat: v2_6, base64Cutoff: v2_7, tlaCompat: v2_8, validLiftingOptimization: v2_9, tracing: v2_10, noNamespacedExports: v2_11, guest: v2_12, multiMemory: v2_13, asyncMode: v2_14 } = arg1;
  var encodeRes = _utf8AllocateAndEncode(v2_0, realloc1, memory0);
  var ptr3 = encodeRes.ptr;
  var len3 = encodeRes.len;
  dataView(memory0).setUint32(ptr0 + 12, len3, true);
  dataView(memory0).setUint32(ptr0 + 8, ptr3, true);
  var variant4 = v2_1;
  if (variant4 === null || variant4 === void 0) {
    dataView(memory0).setInt8(ptr0 + 16, 0, true);
  } else {
    const e = variant4;
    dataView(memory0).setInt8(ptr0 + 16, 1, true);
    dataView(memory0).setInt8(ptr0 + 17, e ? 1 : 0, true);
  }
  var variant6 = v2_2;
  if (variant6 === null || variant6 === void 0) {
    dataView(memory0).setInt8(ptr0 + 18, 0, true);
  } else {
    const e = variant6;
    dataView(memory0).setInt8(ptr0 + 18, 1, true);
    var variant5 = e;
    switch (variant5.tag) {
      case "async": {
        dataView(memory0).setInt8(ptr0 + 19, 0, true);
        break;
      }
      case "sync": {
        dataView(memory0).setInt8(ptr0 + 19, 1, true);
        break;
      }
      default: {
        throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant5.tag)}\` (received \`${variant5}\`) specified for \`InstantiationMode\``);
      }
    }
  }
  var variant8 = v2_3;
  if (variant8 === null || variant8 === void 0) {
    dataView(memory0).setInt8(ptr0 + 20, 0, true);
  } else {
    const e = variant8;
    dataView(memory0).setInt8(ptr0 + 20, 1, true);
    var variant7 = e;
    switch (variant7.tag) {
      case "js": {
        dataView(memory0).setInt8(ptr0 + 21, 0, true);
        break;
      }
      case "hybrid": {
        dataView(memory0).setInt8(ptr0 + 21, 1, true);
        break;
      }
      case "optimized": {
        dataView(memory0).setInt8(ptr0 + 21, 2, true);
        break;
      }
      case "direct-optimized": {
        dataView(memory0).setInt8(ptr0 + 21, 3, true);
        break;
      }
      default: {
        throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant7.tag)}\` (received \`${variant7}\`) specified for \`BindingsMode\``);
      }
    }
  }
  var variant13 = v2_4;
  if (variant13 === null || variant13 === void 0) {
    dataView(memory0).setInt8(ptr0 + 24, 0, true);
  } else {
    const e = variant13;
    dataView(memory0).setInt8(ptr0 + 24, 1, true);
    var vec12 = e;
    var len12 = vec12.length;
    var result12 = realloc1(0, 0, 4, len12 * 16);
    for (let i = 0; i < vec12.length; i++) {
      const e2 = vec12[i];
      const base = result12 + i * 16;
      var [tuple9_0, tuple9_1] = e2;
      var encodeRes = _utf8AllocateAndEncode(tuple9_0, realloc1, memory0);
      var ptr10 = encodeRes.ptr;
      var len10 = encodeRes.len;
      dataView(memory0).setUint32(base + 4, len10, true);
      dataView(memory0).setUint32(base + 0, ptr10, true);
      var encodeRes = _utf8AllocateAndEncode(tuple9_1, realloc1, memory0);
      var ptr11 = encodeRes.ptr;
      var len11 = encodeRes.len;
      dataView(memory0).setUint32(base + 12, len11, true);
      dataView(memory0).setUint32(base + 8, ptr11, true);
    }
    dataView(memory0).setUint32(ptr0 + 32, len12, true);
    dataView(memory0).setUint32(ptr0 + 28, result12, true);
  }
  var variant14 = v2_5;
  if (variant14 === null || variant14 === void 0) {
    dataView(memory0).setInt8(ptr0 + 36, 0, true);
  } else {
    const e = variant14;
    dataView(memory0).setInt8(ptr0 + 36, 1, true);
    dataView(memory0).setInt8(ptr0 + 37, e ? 1 : 0, true);
  }
  var variant15 = v2_6;
  if (variant15 === null || variant15 === void 0) {
    dataView(memory0).setInt8(ptr0 + 38, 0, true);
  } else {
    const e = variant15;
    dataView(memory0).setInt8(ptr0 + 38, 1, true);
    dataView(memory0).setInt8(ptr0 + 39, e ? 1 : 0, true);
  }
  var variant16 = v2_7;
  if (variant16 === null || variant16 === void 0) {
    dataView(memory0).setInt8(ptr0 + 40, 0, true);
  } else {
    const e = variant16;
    dataView(memory0).setInt8(ptr0 + 40, 1, true);
    dataView(memory0).setInt32(ptr0 + 44, toUint32(e), true);
  }
  var variant17 = v2_8;
  if (variant17 === null || variant17 === void 0) {
    dataView(memory0).setInt8(ptr0 + 48, 0, true);
  } else {
    const e = variant17;
    dataView(memory0).setInt8(ptr0 + 48, 1, true);
    dataView(memory0).setInt8(ptr0 + 49, e ? 1 : 0, true);
  }
  var variant18 = v2_9;
  if (variant18 === null || variant18 === void 0) {
    dataView(memory0).setInt8(ptr0 + 50, 0, true);
  } else {
    const e = variant18;
    dataView(memory0).setInt8(ptr0 + 50, 1, true);
    dataView(memory0).setInt8(ptr0 + 51, e ? 1 : 0, true);
  }
  var variant19 = v2_10;
  if (variant19 === null || variant19 === void 0) {
    dataView(memory0).setInt8(ptr0 + 52, 0, true);
  } else {
    const e = variant19;
    dataView(memory0).setInt8(ptr0 + 52, 1, true);
    dataView(memory0).setInt8(ptr0 + 53, e ? 1 : 0, true);
  }
  var variant20 = v2_11;
  if (variant20 === null || variant20 === void 0) {
    dataView(memory0).setInt8(ptr0 + 54, 0, true);
  } else {
    const e = variant20;
    dataView(memory0).setInt8(ptr0 + 54, 1, true);
    dataView(memory0).setInt8(ptr0 + 55, e ? 1 : 0, true);
  }
  var variant21 = v2_12;
  if (variant21 === null || variant21 === void 0) {
    dataView(memory0).setInt8(ptr0 + 56, 0, true);
  } else {
    const e = variant21;
    dataView(memory0).setInt8(ptr0 + 56, 1, true);
    dataView(memory0).setInt8(ptr0 + 57, e ? 1 : 0, true);
  }
  var variant22 = v2_13;
  if (variant22 === null || variant22 === void 0) {
    dataView(memory0).setInt8(ptr0 + 58, 0, true);
  } else {
    const e = variant22;
    dataView(memory0).setInt8(ptr0 + 58, 1, true);
    dataView(memory0).setInt8(ptr0 + 59, e ? 1 : 0, true);
  }
  var variant29 = v2_14;
  if (variant29 === null || variant29 === void 0) {
    dataView(memory0).setInt8(ptr0 + 60, 0, true);
  } else {
    const e = variant29;
    dataView(memory0).setInt8(ptr0 + 60, 1, true);
    var variant28 = e;
    switch (variant28.tag) {
      case "sync": {
        dataView(memory0).setInt8(ptr0 + 64, 0, true);
        break;
      }
      case "jspi": {
        const e2 = variant28.val;
        dataView(memory0).setInt8(ptr0 + 64, 1, true);
        var { imports: v23_0, exports: v23_1 } = e2;
        var vec25 = v23_0;
        var len25 = vec25.length;
        var result25 = realloc1(0, 0, 4, len25 * 8);
        for (let i = 0; i < vec25.length; i++) {
          const e3 = vec25[i];
          const base = result25 + i * 8;
          var encodeRes = _utf8AllocateAndEncode(e3, realloc1, memory0);
          var ptr24 = encodeRes.ptr;
          var len24 = encodeRes.len;
          dataView(memory0).setUint32(base + 4, len24, true);
          dataView(memory0).setUint32(base + 0, ptr24, true);
        }
        dataView(memory0).setUint32(ptr0 + 72, len25, true);
        dataView(memory0).setUint32(ptr0 + 68, result25, true);
        var vec27 = v23_1;
        var len27 = vec27.length;
        var result27 = realloc1(0, 0, 4, len27 * 8);
        for (let i = 0; i < vec27.length; i++) {
          const e3 = vec27[i];
          const base = result27 + i * 8;
          var encodeRes = _utf8AllocateAndEncode(e3, realloc1, memory0);
          var ptr26 = encodeRes.ptr;
          var len26 = encodeRes.len;
          dataView(memory0).setUint32(base + 4, len26, true);
          dataView(memory0).setUint32(base + 0, ptr26, true);
        }
        dataView(memory0).setUint32(ptr0 + 80, len27, true);
        dataView(memory0).setUint32(ptr0 + 76, result27, true);
        break;
      }
      default: {
        throw new TypeError(`invalid variant tag value \`${JSON.stringify(variant28.tag)}\` (received \`${variant28}\`) specified for \`AsyncMode\``);
      }
    }
  }
  _debugLog('[iface="generate", function="generate"][Instruction::CallWasm] enter', {
    funcName: "generate",
    paramCount: 1,
    async: false,
    postReturn: true
  });
  const hostProvided = false;
  const [task, _wasm_call_currentTaskID] = createNewCurrentTask({
    componentIdx: 0,
    isAsync: false,
    entryFnName: "exports1Generate",
    getCallbackFn: () => null,
    callbackFnName: "null",
    errHandling: "throw-result-err",
    callingWasmExport: true
  });
  let ret = exports1Generate(ptr0);
  endCurrentTask(0);
  let variant39;
  switch (dataView(memory0).getUint8(ret + 0, true)) {
    case 0: {
      var len32 = dataView(memory0).getUint32(ret + 8, true);
      var base32 = dataView(memory0).getUint32(ret + 4, true);
      var result32 = [];
      for (let i = 0; i < len32; i++) {
        const base = base32 + i * 16;
        var ptr30 = dataView(memory0).getUint32(base + 0, true);
        var len30 = dataView(memory0).getUint32(base + 4, true);
        var result30 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr30, len30));
        var ptr31 = dataView(memory0).getUint32(base + 8, true);
        var len31 = dataView(memory0).getUint32(base + 12, true);
        var result31 = new Uint8Array(memory0.buffer.slice(ptr31, ptr31 + len31 * 1));
        result32.push([result30, result31]);
      }
      var len34 = dataView(memory0).getUint32(ret + 16, true);
      var base34 = dataView(memory0).getUint32(ret + 12, true);
      var result34 = [];
      for (let i = 0; i < len34; i++) {
        const base = base34 + i * 8;
        var ptr33 = dataView(memory0).getUint32(base + 0, true);
        var len33 = dataView(memory0).getUint32(base + 4, true);
        var result33 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr33, len33));
        result34.push(result33);
      }
      var len37 = dataView(memory0).getUint32(ret + 24, true);
      var base37 = dataView(memory0).getUint32(ret + 20, true);
      var result37 = [];
      for (let i = 0; i < len37; i++) {
        const base = base37 + i * 12;
        var ptr35 = dataView(memory0).getUint32(base + 0, true);
        var len35 = dataView(memory0).getUint32(base + 4, true);
        var result35 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr35, len35));
        let enum36;
        switch (dataView(memory0).getUint8(base + 8, true)) {
          case 0: {
            enum36 = "function";
            break;
          }
          case 1: {
            enum36 = "instance";
            break;
          }
          default: {
            throw new TypeError("invalid discriminant specified for ExportType");
          }
        }
        result37.push([result35, enum36]);
      }
      variant39 = {
        tag: "ok",
        val: {
          files: result32,
          imports: result34,
          exports: result37
        }
      };
      break;
    }
    case 1: {
      var ptr38 = dataView(memory0).getUint32(ret + 4, true);
      var len38 = dataView(memory0).getUint32(ret + 8, true);
      var result38 = TEXT_DECODER_UTF8.decode(new Uint8Array(memory0.buffer, ptr38, len38));
      variant39 = {
        tag: "err",
        val: result38
      };
      break;
    }
    default: {
      throw new TypeError("invalid variant discriminant for expected");
    }
  }
  _debugLog('[iface="generate", function="generate"][Instruction::Return]', {
    funcName: "generate",
    paramCount: 1,
    async: false,
    postReturn: true
  });
  const retCopy = variant39;
  let cstate = getOrCreateAsyncState(0);
  cstate.mayLeave = false;
  postReturn0(ret);
  cstate.mayLeave = true;
  if (typeof retCopy === "object" && retCopy.tag === "err") {
    throw new ComponentError(retCopy.val);
  }
  return retCopy.val;
}
var exports1GenerateTypes;
var _initialized = false;
var $init = (() => {
  let gen = (function* _initGenerator() {
    const module0 = fetchCompile(new URL("./js-component-bindgen-component.core.wasm", import.meta.url));
    const module1 = fetchCompile(new URL("./js-component-bindgen-component.core2.wasm", import.meta.url));
    const module2 = base64Compile("AGFzbQEAAAABZw5gAn9/AGABfwBgAn9/AX9gA39+fwBgBH9/f38Bf2AFf39/f38AYAR/f39/AGAFf39/fn8Bf2AFf39/f38Bf2AJf39/f39+fn9/AX9gAX8Bf2ADf39/AX9gB39/f39/f38AYAJ+fwADJiUHAgIIBAQJAgIKAgsBAQAAAAUDAwAAAAUMAAMDAAYGAA0BAQEBBAUBcAElJQe7ASYBMAAAATEAAQEyAAIBMwADATQABAE1AAUBNgAGATcABwE4AAgBOQAJAjEwAAoCMTEACwIxMgAMAjEzAA0CMTQADgIxNQAPAjE2ABACMTcAEQIxOAASAjE5ABMCMjAAFAIyMQAVAjIyABYCMjMAFwIyNAAYAjI1ABkCMjYAGgIyNwAbAjI4ABwCMjkAHQIzMAAeAjMxAB8CMzIAIAIzMwAhAjM0ACICMzUAIwIzNgAkCCRpbXBvcnRzAQAK+QMlEQAgACABIAIgAyAEQQARBwALCwAgACABQQERAgALCwAgACABQQIRAgALEQAgACABIAIgAyAEQQMRCAALDwAgACABIAIgA0EEEQQACw8AIAAgASACIANBBREEAAsZACAAIAEgAiADIAQgBSAGIAcgCEEGEQkACwsAIAAgAUEHEQIACwsAIAAgAUEIEQIACwkAIABBCREKAAsLACAAIAFBChECAAsNACAAIAEgAkELEQsACwkAIABBDBEBAAsJACAAQQ0RAQALCwAgACABQQ4RAAALCwAgACABQQ8RAAALCwAgACABQRARAAALEQAgACABIAIgAyAEQRERBQALDQAgACABIAJBEhEDAAsNACAAIAEgAkETEQMACwsAIAAgAUEUEQAACwsAIAAgAUEVEQAACwsAIAAgAUEWEQAACxEAIAAgASACIAMgBEEXEQUACxUAIAAgASACIAMgBCAFIAZBGBEMAAsLACAAIAFBGREAAAsNACAAIAEgAkEaEQMACw0AIAAgASACQRsRAwALCwAgACABQRwRAAALDwAgACABIAIgA0EdEQYACw8AIAAgASACIANBHhEGAAsLACAAIAFBHxEAAAsLACAAIAFBIBENAAsJACAAQSERAQALCQAgAEEiEQEACwkAIABBIxEBAAsJACAAQSQRAQALAC8JcHJvZHVjZXJzAQxwcm9jZXNzZWQtYnkBDXdpdC1jb21wb25lbnQHMC4yNDQuMA");
    const module3 = base64Compile("AGFzbQEAAAABZw5gAn9/AGABfwBgAn9/AX9gA39+fwBgBH9/f38Bf2AFf39/f38AYAR/f39/AGAFf39/fn8Bf2AFf39/f38Bf2AJf39/f39+fn9/AX9gAX8Bf2ADf39/AX9gB39/f39/f38AYAJ+fwAC5AEmAAEwAAcAATEAAgABMgACAAEzAAgAATQABAABNQAEAAE2AAkAATcAAgABOAACAAE5AAoAAjEwAAIAAjExAAsAAjEyAAEAAjEzAAEAAjE0AAAAAjE1AAAAAjE2AAAAAjE3AAUAAjE4AAMAAjE5AAMAAjIwAAAAAjIxAAAAAjIyAAAAAjIzAAUAAjI0AAwAAjI1AAAAAjI2AAMAAjI3AAMAAjI4AAAAAjI5AAYAAjMwAAYAAjMxAAAAAjMyAA0AAjMzAAEAAjM0AAEAAjM1AAEAAjM2AAEACCRpbXBvcnRzAXABJSUJKwEAQQALJQABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQALwlwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQENd2l0LWNvbXBvbmVudAcwLjI0NC4w");
    ({ exports: exports0 } = yield instantiateCore(yield module2));
    ({ exports: exports1 } = yield instantiateCore(yield module0, {
      wasi_snapshot_preview1: {
        environ_get: exports0["7"],
        environ_sizes_get: exports0["8"],
        fd_close: exports0["9"],
        fd_filestat_get: exports0["2"],
        fd_prestat_dir_name: exports0["11"],
        fd_prestat_get: exports0["10"],
        fd_read: exports0["4"],
        fd_readdir: exports0["0"],
        fd_write: exports0["5"],
        path_filestat_get: exports0["3"],
        path_open: exports0["6"],
        proc_exit: exports0["12"],
        random_get: exports0["1"]
      }
    }));
    ({ exports: exports2 } = yield instantiateCore(yield module1, {
      __main_module__: {
        cabi_realloc: exports1.cabi_realloc
      },
      env: {
        memory: exports1.memory
      },
      "wasi:cli/environment@0.2.3": {
        "get-environment": exports0["13"]
      },
      "wasi:cli/exit@0.2.3": {
        exit: trampoline10
      },
      "wasi:cli/stderr@0.2.3": {
        "get-stderr": trampoline5
      },
      "wasi:cli/stdin@0.2.3": {
        "get-stdin": trampoline8
      },
      "wasi:cli/stdout@0.2.3": {
        "get-stdout": trampoline9
      },
      "wasi:cli/terminal-input@0.2.3": {
        "[resource-drop]terminal-input": trampoline6
      },
      "wasi:cli/terminal-output@0.2.3": {
        "[resource-drop]terminal-output": trampoline7
      },
      "wasi:cli/terminal-stderr@0.2.3": {
        "get-terminal-stderr": exports0["36"]
      },
      "wasi:cli/terminal-stdin@0.2.3": {
        "get-terminal-stdin": exports0["34"]
      },
      "wasi:cli/terminal-stdout@0.2.3": {
        "get-terminal-stdout": exports0["35"]
      },
      "wasi:filesystem/preopens@0.2.3": {
        "get-directories": exports0["33"]
      },
      "wasi:filesystem/types@0.2.3": {
        "[method]descriptor.append-via-stream": exports0["20"],
        "[method]descriptor.get-type": exports0["14"],
        "[method]descriptor.metadata-hash": exports0["15"],
        "[method]descriptor.metadata-hash-at": exports0["17"],
        "[method]descriptor.open-at": exports0["24"],
        "[method]descriptor.read-directory": exports0["21"],
        "[method]descriptor.read-via-stream": exports0["18"],
        "[method]descriptor.stat": exports0["22"],
        "[method]descriptor.stat-at": exports0["23"],
        "[method]descriptor.write-via-stream": exports0["19"],
        "[method]directory-entry-stream.read-directory-entry": exports0["25"],
        "[resource-drop]descriptor": trampoline4,
        "[resource-drop]directory-entry-stream": trampoline0,
        "filesystem-error-code": exports0["16"]
      },
      "wasi:io/error@0.2.3": {
        "[resource-drop]error": trampoline2
      },
      "wasi:io/streams@0.2.3": {
        "[method]input-stream.blocking-read": exports0["27"],
        "[method]input-stream.read": exports0["26"],
        "[method]output-stream.blocking-flush": exports0["31"],
        "[method]output-stream.blocking-write-and-flush": exports0["30"],
        "[method]output-stream.check-write": exports0["28"],
        "[method]output-stream.write": exports0["29"],
        "[resource-drop]input-stream": trampoline3,
        "[resource-drop]output-stream": trampoline1
      },
      "wasi:random/random@0.2.3": {
        "get-random-bytes": exports0["32"]
      }
    }));
    memory0 = exports1.memory;
    GlobalComponentMemories.save({ idx: 0, componentIdx: 1, memory: memory0 });
    realloc0 = exports2.cabi_import_realloc;
    ({ exports: exports3 } = yield instantiateCore(yield module3, {
      "": {
        $imports: exports0.$imports,
        "0": exports2.fd_readdir,
        "1": exports2.random_get,
        "10": exports2.fd_prestat_get,
        "11": exports2.fd_prestat_dir_name,
        "12": exports2.proc_exit,
        "13": trampoline11,
        "14": trampoline12,
        "15": trampoline13,
        "16": trampoline14,
        "17": trampoline15,
        "18": trampoline16,
        "19": trampoline17,
        "2": exports2.fd_filestat_get,
        "20": trampoline18,
        "21": trampoline19,
        "22": trampoline20,
        "23": trampoline21,
        "24": trampoline22,
        "25": trampoline23,
        "26": trampoline24,
        "27": trampoline25,
        "28": trampoline26,
        "29": trampoline27,
        "3": exports2.path_filestat_get,
        "30": trampoline28,
        "31": trampoline29,
        "32": trampoline30,
        "33": trampoline31,
        "34": trampoline32,
        "35": trampoline33,
        "36": trampoline34,
        "4": exports2.fd_read,
        "5": exports2.fd_write,
        "6": exports2.path_open,
        "7": exports2.environ_get,
        "8": exports2.environ_sizes_get,
        "9": exports2.fd_close
      }
    }));
    realloc1 = exports1.cabi_realloc;
    postReturn0 = exports1.cabi_post_generate;
    postReturn1 = exports1["cabi_post_generate-types"];
    _initialized = true;
    exports1Generate = exports1.generate;
    exports1GenerateTypes = exports1["generate-types"];
  })();
  let promise, resolve, reject;
  function runNext(value) {
    try {
      let done;
      do {
        ({ value, done } = gen.next(value));
      } while (!(value instanceof Promise) && !done);
      if (done) {
        if (resolve) resolve(value);
        else return value;
      }
      if (!promise) promise = new Promise((_resolve, _reject) => (resolve = _resolve, reject = _reject));
      value.then(runNext, reject);
    } catch (e) {
      if (reject) reject(e);
      else throw e;
    }
  }
  const maybeSyncReturn = runNext(null);
  return promise || maybeSyncReturn;
})();

// ../site/node_modules/@bytecodealliance/jco/src/browser.js
async function generate2() {
  await $init;
  return generate.apply(this, arguments);
}

// glue.js
var BASE = (() => {
  const p = window.location.pathname;
  const dir = p.endsWith("/") ? p : p.slice(0, p.lastIndexOf("/") + 1);
  return dir.replace(/egui\/?$/, "");
})();
var PT = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
function fenToBoard(fen) {
  const [placement, turnField, castleField, epField, halfStr, fullStr] = fen.split(" ");
  const squares = new Array(64).fill(null);
  const ranks = placement.split("/");
  for (let r = 0; r < 8; r++) {
    const rankStr = ranks[r];
    let file = 0;
    for (const ch of rankStr) {
      if (/\d/.test(ch)) {
        file += parseInt(ch, 10);
      } else {
        const boardRank = 7 - r;
        const idx = boardRank * 8 + file;
        const isWhite = ch === ch.toUpperCase();
        squares[idx] = { pieceType: PT[ch.toLowerCase()], color: isWhite ? "white" : "black" };
        file += 1;
      }
    }
  }
  let ep = null;
  if (epField && epField !== "-") {
    ep = (parseInt(epField[1], 10) - 1) * 8 + (epField.charCodeAt(0) - 97);
  }
  const has = (c) => (castleField || "").includes(c);
  return {
    squares,
    turn: turnField === "w" ? "white" : "black",
    castling_rights: {
      white_kingside: has("K"),
      white_queenside: has("Q"),
      black_kingside: has("k"),
      black_queenside: has("q")
    },
    en_passant: ep,
    halfmove_clock: parseInt(halfStr || "0", 10),
    fullmove_number: parseInt(fullStr || "1", 10),
    move_history: []
  };
}
var montyLoaded = false;
var MontyClass = null;
var PYTHON_INPUT_NAMES = ["_board", "_legal_moves", "_is_check", "_fen", "_seed"];
var PYTHON_SHIM = `
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
    return JSON.stringify({ ok: false, error: "bad inputs", logs: [] });
  }
  const inputs = {
    _legal_moves: parsed.legalMoves || [],
    _board: fenToBoard(parsed.fen),
    _is_check: !!parsed.isCheck,
    _fen: parsed.fen,
    _seed: Math.floor(Math.random() * 2147483647)
  };
  let tail;
  if (method === "on_game_start") {
    tail = "\non_game_start()\n[None, _log_messages]";
  } else if (method === "get_name") {
    tail = "\n[get_name(), []]";
  } else if (method === "get_description") {
    tail = "\n[get_description(), []]";
  } else {
    tail = `
_result = ${method}()
[_result, _log_messages]`;
  }
  const fullCode = PYTHON_SHIM + code + tail;
  const shimLines = PYTHON_SHIM.split("\n").length;
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
      if (userLine > 0) friendly = `Python error at line ${userLine}: ${errorMsg.split(":").pop()?.trim() || errorMsg}`;
    }
    return JSON.stringify({ ok: false, error: friendly, logs: [] });
  }
}
var uploadSnapshot = { fen: "", legalMoves: [], isCheck: false, gameResult: "in-progress" };
var uploadLogs = [];
var uploadedBots = /* @__PURE__ */ new Map();
var uploadSeq = 0;
var activeBlobUrls = /* @__PURE__ */ new Set();
function makeHost() {
  return {
    getBoard: () => fenToBoard(uploadSnapshot.fen),
    getLegalMoves: () => uploadSnapshot.legalMoves.slice(),
    isCheck: () => !!uploadSnapshot.isCheck,
    getGameResult: () => uploadSnapshot.gameResult,
    getFen: () => uploadSnapshot.fen,
    log: (msg) => uploadLogs.push(String(msg))
  };
}
async function uploadBot(bytes, filename) {
  try {
    if (bytes[0] !== 0 || bytes[1] !== 97 || bytes[2] !== 115 || bytes[3] !== 109) {
      throw new Error("Invalid file format. Please upload a valid .wasm component file.");
    }
    const name0 = (filename || "bot").replace(/\.wasm$/, "");
    const { files } = await generate2(bytes, {
      name: name0.replace(/\s+/g, "-"),
      instantiation: { tag: "async" },
      map: [["chess:bot/host", "./bot-host.js"]],
      noNodejsCompat: true,
      base64Cutoff: 0,
      tlaCompat: true
    });
    let mainJsUrl = null;
    for (const [fn, content] of files) {
      const isJs = fn.endsWith(".js");
      const blob = new Blob([content], { type: isJs ? "text/javascript" : "application/wasm" });
      const url = URL.createObjectURL(blob);
      activeBlobUrls.add(url);
      if (isJs && !mainJsUrl) mainJsUrl = url;
    }
    if (!mainJsUrl) throw new Error("Transpilation produced no JS output");
    const mod = await import(
      /* @vite-ignore */
      mainJsUrl
    );
    const wasmLookup = {};
    for (const [fn, content] of files) {
      if (fn.endsWith(".wasm")) wasmLookup["./" + fn] = content;
    }
    const getCoreModule = (path) => {
      const content = wasmLookup[path];
      if (content) return WebAssembly.compile(content);
      throw new Error(`WASM module not found: ${path}`);
    };
    const instance = await mod.instantiate(getCoreModule, { "chess:bot/host": makeHost() });
    const botExport = instance.bot || instance["chess:bot/bot@0.1.0"];
    if (!botExport) throw new Error("Invalid bot component. Must implement chess:bot@0.1.0 interface");
    for (const m of ["getName", "getDescription", "selectMove", "suggestMove", "onGameStart"]) {
      if (typeof botExport[m] !== "function") throw new Error(`Invalid bot component. Missing required method: ${m}`);
    }
    const id2 = `custom-bot-${++uploadSeq}`;
    let name = name0;
    let description = "Custom bot";
    try {
      name = botExport.getName() || name;
    } catch (e) {
    }
    try {
      description = botExport.getDescription() || description;
    } catch (e) {
    }
    uploadedBots.set(id2, { name, description, botExport });
    return JSON.stringify({ ok: true, id: id2, name, description });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message || String(err) });
  }
}
function uploadCall(id2, method, snapshotJson) {
  const rec = uploadedBots.get(id2);
  if (!rec) return JSON.stringify({ ok: false, error: "bot not found", logs: [] });
  try {
    const snap = JSON.parse(snapshotJson);
    uploadSnapshot.fen = snap.fen;
    uploadSnapshot.legalMoves = snap.legalMoves || [];
    uploadSnapshot.isCheck = !!snap.isCheck;
    uploadSnapshot.gameResult = snap.gameResult || "in-progress";
    uploadLogs.length = 0;
    const value = rec.botExport[method]();
    return JSON.stringify({ ok: true, value, logs: uploadLogs.slice() });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message || String(err), logs: uploadLogs.slice() });
  }
}
function uploadRemove(id2) {
  uploadedBots.delete(id2);
}
var PERSONALITIES = {
  sassy: "You are a cocky, sassy chess trash-talker who taunts your opponent playfully.",
  aggressive: "You are a ruthless, intimidating chess rival who talks big.",
  kind: "You are a warm, encouraging chess buddy who chats kindly.",
  nervous: "You are an anxious, rambling chess player who second-guesses everything.",
  philosophical: "You are a dramatic chess philosopher musing on fate."
};
var DEFAULT_PERSONALITY = "sassy";
var MAX_TOKENS = 36;
var SAMPLING = { temperature: 0.5, topK: 40, topP: 0.9, repeatPenalty: 1.3 };
var MOCK_REPLY = "[mock reply]";
function forceMock() {
  try {
    const params2 = new URLSearchParams(window.location.search);
    if (params2.get("llm") === "mock" || params2.get("mock") === "1") return true;
  } catch (e) {
    return true;
  }
  return false;
}
function buildSystemPrompt(key) {
  const persona = PERSONALITIES[key] || PERSONALITIES[DEFAULT_PERSONALITY];
  return `${persona} You are chatting during a chess game. Reply with ONE short, in-character sentence of banter. Do not give real chess analysis or move lists.`;
}
var llm = {
  worker: null,
  ready: false,
  loadStarted: false,
  loadFailed: false,
  nextId: 1,
  pending: /* @__PURE__ */ new Map(),
  activeSystem: null,
  pendingSystem: buildSystemPrompt(DEFAULT_PERSONALITY),
  status: null,
  loaded: 0,
  total: 0
};
function llmUpdateStatus() {
  if (llm.ready || llm.loadFailed) {
    llm.status = null;
    return;
  }
  if (llm.total > 0 && llm.loaded > 0) {
    const mb = Math.round(llm.loaded / 1e6), tot = Math.round(llm.total / 1e6);
    if (llm.loaded >= llm.total) llm.status = "Loading the bot\u2019s brain into memory\u2026";
    else llm.status = `Downloading the bot\u2019s brain\u2026 ${mb}/${tot} MB (${Math.min(99, Math.floor(llm.loaded / llm.total * 100))}%)`;
  } else {
    llm.status = "Bot is warming up\u2026";
  }
}
function llmEnsureConversation() {
  if (!llm.ready || !llm.worker) return;
  if (llm.pendingSystem === llm.activeSystem) return;
  llm.worker.postMessage({ type: "chat_reset", system: llm.pendingSystem });
  llm.activeSystem = llm.pendingSystem;
}
function llmEnsureWorker() {
  if (llm.worker || llm.loadStarted) return;
  llm.loadStarted = true;
  try {
    llm.worker = new Worker(`${BASE}bitnet/llm-worker.js`, { type: "module" });
  } catch (e) {
    llm.loadFailed = true;
    llmUpdateStatus();
    return;
  }
  llm.status = "Bot is warming up\u2026";
  llm.worker.onmessage = (e) => {
    const msg = e.data || {};
    if (msg.type === "progress") {
      llm.loaded = msg.loaded || llm.loaded;
      if (!llm.total && msg.total) llm.total = msg.total;
      llmUpdateStatus();
    } else if (msg.type === "ready") {
      llm.ready = true;
      llmUpdateStatus();
      llmEnsureConversation();
    } else if (msg.type === "result") {
      const p = llm.pending.get(msg.id);
      if (p) {
        llm.pending.delete(msg.id);
        p(msg.text || "");
      }
    } else if (msg.type === "error") {
      if (msg.id != null) {
        const p = llm.pending.get(msg.id);
        if (p) {
          llm.pending.delete(msg.id);
          p("");
        }
      } else {
        llm.loadFailed = true;
        llmUpdateStatus();
      }
    }
  };
  llm.worker.onerror = () => {
    llm.loadFailed = true;
    llmUpdateStatus();
  };
  (async () => {
    try {
      const resp = await fetch(`${BASE}bitnet/model/manifest.json`);
      const data = await resp.json();
      const chunks = Array.isArray(data.chunks) ? data.chunks : [];
      if (typeof data.bytes === "number") llm.total = data.bytes;
      if (chunks.length === 0) {
        llm.loadFailed = true;
        llmUpdateStatus();
        return;
      }
      llm.worker.postMessage({
        type: "load",
        modelUrls: chunks.map((c) => `${BASE}bitnet/model/${c}`),
        totalBytes: llm.total,
        sizes: Array.isArray(data.sizes) ? data.sizes : null,
        wasmBindingsUrl: `${BASE}bitnet/bitnet_wasm.js`,
        wasmUrl: `${BASE}bitnet/bitnet_wasm_bg.wasm`
      });
    } catch (e) {
      llm.loadFailed = true;
      llmUpdateStatus();
    }
  })();
}
function llmPreload() {
  if (!forceMock()) llmEnsureWorker();
}
function llmReset(personality) {
  const key = PERSONALITIES[personality] ? personality : DEFAULT_PERSONALITY;
  llm.pendingSystem = buildSystemPrompt(key);
  if (forceMock()) return;
  llmEnsureWorker();
  llmEnsureConversation();
}
function llmReady() {
  return forceMock() ? true : llm.ready && !llm.loadFailed;
}
function llmStatus() {
  if (forceMock()) return "";
  if (llm.loadFailed) return "Bot is offline (model unavailable).";
  return llm.status || "";
}
function llmSend(personality, text) {
  if (forceMock()) return Promise.resolve(MOCK_REPLY);
  llmEnsureWorker();
  if (!llmReady()) return Promise.resolve("");
  const key = PERSONALITIES[personality] ? personality : DEFAULT_PERSONALITY;
  const want = buildSystemPrompt(key);
  if (want !== llm.activeSystem) llm.pendingSystem = want;
  llmEnsureConversation();
  return new Promise((resolve) => {
    const id2 = llm.nextId++;
    llm.pending.set(id2, resolve);
    llm.worker.postMessage({
      type: "chat_send",
      id: id2,
      text,
      maxTokens: MAX_TOKENS,
      temperature: SAMPLING.temperature,
      topK: SAMPLING.topK,
      topP: SAMPLING.topP,
      repeatPenalty: SAMPLING.repeatPenalty,
      seed: Math.floor(Math.random() * 9007199254740991)
    });
  });
}
var toastContainer = null;
function toast(message, type) {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.style.cssText = "position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;";
    document.body.appendChild(toastContainer);
  }
  const el = document.createElement("div");
  const colors = { success: "#2e7d32", error: "#c62828", warning: "#ef6c00", info: "#1565c0" };
  el.textContent = message;
  el.style.cssText = `background:${colors[type] || colors.info};color:#fff;padding:10px 14px;border-radius:6px;font:500 14px system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.3);opacity:0;transition:opacity .2s;max-width:320px;`;
  toastContainer.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "1";
  });
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 4e3);
}
function pickWasmFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".wasm";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      const buf = await file.arrayBuffer();
      resolve({ name: file.name, bytes: new Uint8Array(buf) });
    });
    input.addEventListener("cancel", () => {
      input.remove();
      resolve(null);
    });
    input.click();
  });
}
var announcer = null;
var statusRegion = null;
function ensureA11y() {
  const canvas = document.getElementById("the_canvas_id");
  if (canvas && !canvas.getAttribute("aria-label")) {
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-label", "Chess playground. Use arrow keys to move focus between squares, Enter or Space to select or move.");
    canvas.setAttribute("tabindex", "0");
  }
  if (!announcer) {
    announcer = document.createElement("div");
    announcer.id = "move-announcer";
    announcer.setAttribute("aria-live", "assertive");
    announcer.setAttribute("aria-atomic", "true");
    announcer.style.cssText = "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;";
    document.body.appendChild(announcer);
  }
  if (!statusRegion) {
    statusRegion = document.createElement("div");
    statusRegion.id = "game-status";
    statusRegion.setAttribute("role", "status");
    statusRegion.setAttribute("aria-live", "polite");
    statusRegion.style.cssText = announcer.style.cssText;
    document.body.appendChild(statusRegion);
  }
}
function announceMove(text) {
  ensureA11y();
  if (announcer && text) {
    announcer.textContent = "";
    announcer.offsetHeight;
    announcer.textContent = text;
  }
}
function announceStatus(text) {
  ensureA11y();
  if (statusRegion && text && statusRegion.textContent !== text) {
    statusRegion.textContent = text;
  }
}
window.__chessGlue = {
  pythonRun,
  uploadBot,
  uploadCall,
  uploadRemove,
  pickWasmFile,
  llmPreload,
  llmReset,
  llmReady,
  llmStatus,
  llmSend,
  toast,
  announceMove,
  announceStatus
};

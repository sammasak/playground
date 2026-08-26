// Browser stubs for WASI I/O
export class Error {
  constructor(msg) { this.message = msg || ''; }
  toDebugString() { return this.message; }
}

export class InputStream {
  read() { return new Uint8Array(0); }
  blockingRead() { return new Uint8Array(0); }
}

export class OutputStream {
  write() {}
  blockingFlush() {}
  checkWrite() { return 1024n; }
  blockingWriteAndFlush() {}
}

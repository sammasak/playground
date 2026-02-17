// Browser stubs for WASI filesystem
export class Descriptor {
  stat() { return { type: 'unknown', size: 0n }; }
  readDirectory() { return { readDirectoryEntry() { return null; } }; }
  writeViaStream() { return new OutputStream(); }
  appendViaStream() { return new OutputStream(); }
  getType() { return 'unknown'; }
}

class OutputStream {
  write() {}
  blockingFlush() {}
  checkWrite() { return 1024n; }
  blockingWriteAndFlush() {}
}

export function filesystemErrorCode() { return undefined; }
export function getDirectories() { return []; }

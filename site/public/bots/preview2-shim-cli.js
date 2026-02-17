// Browser stubs for WASI CLI
export function getEnvironment() { return []; }
export function exit(status) { console.log('WASI exit:', status); }
export function getStderr() { return { write() {}, blockingFlush() {}, checkWrite() { return 1024n; }, blockingWriteAndFlush() {} }; }
export function getStdin() { return { read() { return new Uint8Array(0); }, blockingRead() { return new Uint8Array(0); } }; }
export function getStdout() { return { write() {}, blockingFlush() {}, checkWrite() { return 1024n; }, blockingWriteAndFlush() {} }; }
export function now() { return { seconds: BigInt(Math.floor(Date.now() / 1000)), nanoseconds: (Date.now() % 1000) * 1000000 }; }
export function resolution() { return { seconds: 0n, nanoseconds: 1000000 }; }

// Bundled first (cfg.extraEntries) so it runs before anything else in
// _ds_bundle.js. next/link's client code reads process.env.__NEXT_* flags
// that Next's own build normally replaces at compile time; esbuild only
// replaces the literal "process.env.NODE_ENV" we define, leaving these bare
// references to throw ReferenceError in a real browser (no process global —
// claude.ai/design previews and headless render checks alike).
if (typeof globalThis.process === "undefined") {
  (globalThis as typeof globalThis & { process: { env: Record<string, string> } }).process = {
    env: {},
  };
}
export {};

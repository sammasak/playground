#!/usr/bin/env bash
# Build the egui chess app to a static ./dist/ (run inside `nix develop`).
# Uses wasm-bindgen-cli + wasm-opt directly (no Trunk) for NixOS reliability.
set -euo pipefail
cd "$(dirname "$0")"

OUT=dist
rm -rf "$OUT"
mkdir -p "$OUT"

cargo build --release --target wasm32-unknown-unknown

wasm-bindgen target/wasm32-unknown-unknown/release/site_egui.wasm \
  --out-dir "$OUT" --out-name app --target web --no-typescript

# rustc 1.97 emits post-MVP wasm features; wasm-opt must be told to accept them.
wasm-opt -Oz \
  --enable-bulk-memory --enable-sign-ext --enable-nontrapping-float-to-int \
  --enable-mutable-globals --enable-reference-types --enable-multivalue \
  "$OUT/app_bg.wasm" -o "$OUT/app_bg.wasm"

# Bundle the JS interop glue (Monty Python runtime, jco uploaded bots, LLM
# banter, toasts). esbuild resolves the bare `@bytecodealliance/jco/component`
# import against the sibling Astro site's node_modules and emits one ESM file.
ESBUILD=../site/node_modules/.bin/esbuild
if [ -x "$ESBUILD" ]; then
  # esbuild resolves node_modules by walking up from the entry file. Symlink the
  # sibling site's node_modules so the bare `@bytecodealliance/jco` import (and
  # its deps) resolve, then bundle everything into one ESM file.
  [ -e node_modules ] || ln -s ../site/node_modules node_modules
  # --conditions=browser selects jco's browser build; node builtins stay
  # external (they're only referenced on Node-only code paths never hit here).
  "$ESBUILD" glue.js --bundle --format=esm --platform=browser \
    --conditions=browser --external:node:* \
    --outfile="$OUT/glue.js" --log-level=warning
else
  echo "WARNING: esbuild not found at $ESBUILD — copying glue.js unbundled" >&2
  cp glue.js "$OUT/glue.js"
fi

# jco's transpile() loads its component-bindgen core wasm blobs at runtime,
# relative to glue.js — esbuild leaves them as runtime fetches, so copy them
# into the output or the upload-bot transpile step 404s.
JCO_OBJ=../site/node_modules/@bytecodealliance/jco/obj
for f in js-component-bindgen-component.core.wasm js-component-bindgen-component.core2.wasm; do
  cp "$JCO_OBJ/$f" "$OUT/$f"
done

cp index.html "$OUT/index.html"
touch "$OUT/.nojekyll"

# Publish into the Astro site's public/ dir so the existing build+deploy serves
# it at sammasak.github.io/playground/egui/ (Astro copies public/ verbatim).
PUB=../site/public/egui
rm -rf "$PUB"
mkdir -p "$PUB"
cp "$OUT"/app.js "$OUT"/app_bg.wasm "$OUT"/index.html "$OUT"/glue.js \
   "$OUT"/js-component-bindgen-component.core.wasm \
   "$OUT"/js-component-bindgen-component.core2.wasm "$PUB"/

echo "built -> $OUT and published -> $PUB ($(du -h "$OUT/app_bg.wasm" | cut -f1) wasm)"

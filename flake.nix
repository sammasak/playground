{
  description = "Chess playground — Rust WASM engine + component model bots + Astro site";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, rust-overlay, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };

        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          targets = [
            "wasm32-unknown-unknown"
            "wasm32-wasip1"
          ];
        };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            # Rust
            rustToolchain

            # WASM tooling
            pkgs.wasm-pack
            pkgs.wasm-tools
            pkgs.cargo-component

            # Node.js
            pkgs.nodejs_20

            # Useful utilities
            pkgs.pkg-config
            pkgs.openssl
          ];

          shellHook = ''
            echo "Chess playground dev shell"
            echo "  Rust:            $(rustc --version)"
            echo "  wasm-pack:       $(wasm-pack --version)"
            echo "  wasm-tools:      $(wasm-tools --version)"
            echo "  cargo-component: $(cargo-component --version)"
            echo "  Node.js:         $(node --version)"
            echo ""
            echo "WASM targets: wasm32-unknown-unknown, wasm32-wasip1"
          '';
        };
      }
    );
}

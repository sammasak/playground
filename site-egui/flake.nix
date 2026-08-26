{
  description = "egui chess playground — static WASM build toolchain";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            cargo
            rustc
            clippy
            rustfmt
            gcc              # `cc` linker for host build scripts / proc-macros
            lld              # wasm32-unknown-unknown linker (nixpkgs rustc ships none)
            wasm-bindgen-cli
            binaryen         # wasm-opt
          ];
          RUST_SRC_PATH = "${pkgs.rustPlatform.rustLibSrc}";
          shellHook = ''
            echo "egui wasm dev shell — rustc $(rustc --version), wasm-bindgen $(wasm-bindgen --version)"
          '';
        };
      });
}

# Playwright Troubleshooting on NixOS

## Issue

Playwright tests fail on NixOS with the following error:

```
error while loading shared libraries: libglib-2.0.so.0: cannot open shared object file: No such file or directory
```

This occurs because Playwright downloads pre-built browser binaries that are dynamically linked against system libraries. NixOS uses a unique filesystem layout that doesn't have libraries in standard locations like `/lib` or `/usr/lib`.

## Root Cause

Playwright's bundled Chromium/Firefox/WebKit binaries expect Linux system libraries to be in standard FHS (Filesystem Hierarchy Standard) locations:
- `/lib/x86_64-linux-gnu/`
- `/usr/lib/x86_64-linux-gnu/`

NixOS stores all packages in `/nix/store/` with unique hashes, breaking these assumptions.

## Solutions

### Option 1: Use nix-ld (Recommended)

Install `nix-ld` which provides a compatibility layer for running unpatched binaries:

```nix
# In your configuration.nix or flake
programs.nix-ld.enable = true;
programs.nix-ld.libraries = with pkgs; [
  glib
  nss
  nspr
  atk
  cups
  dbus
  expat
  libdrm
  libxkbcommon
  pango
  cairo
  alsa-lib
  at-spi2-atk
  at-spi2-core
  xorg.libX11
  xorg.libXcomposite
  xorg.libXdamage
  xorg.libXext
  xorg.libXfixes
  xorg.libXrandr
  xorg.libxcb
  mesa
];
```

### Option 2: Use a Nix Shell with FHS

Create a shell that provides an FHS-compatible environment:

```nix
# shell.nix
{ pkgs ? import <nixpkgs> {} }:

(pkgs.buildFHSUserEnv {
  name = "playwright-env";
  targetPkgs = pkgs: with pkgs; [
    nodejs
    glib
    nss
    nspr
    atk
    cups
    dbus
    expat
    libdrm
    libxkbcommon
    pango
    cairo
    alsa-lib
    at-spi2-atk
    at-spi2-core
    xorg.libX11
    xorg.libXcomposite
    xorg.libXdamage
    xorg.libXext
    xorg.libXfixes
    xorg.libXrandr
    xorg.libxcb
    mesa
  ];
  runScript = "bash";
}).env
```

Run with:
```bash
nix-shell shell.nix
npx playwright test
```

### Option 3: Use Playwright's Docker Container

Run Playwright tests inside a Docker container:

```bash
docker run --rm -it \
  -v $(pwd):/work \
  -w /work/site \
  mcr.microsoft.com/playwright:v1.51.0-noble \
  npx playwright test
```

Or add to your `playwright.config.ts`:

```typescript
export default defineConfig({
  // ... other config
  use: {
    // Use containerized browsers
    connectOptions: {
      wsEndpoint: 'ws://localhost:3000/playwright',
    },
  },
});
```

### Option 4: Use nixpkgs Playwright (Limited)

NixOS has a `playwright-driver` package, but it may not support all browser versions:

```nix
# In shell.nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.playwright-driver.browsers
  ];

  shellHook = ''
    export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
    export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
  '';
}
```

## Required System Libraries

The following libraries are needed for Playwright browsers:

### Core Libraries
- `glib` - GLib core library
- `nss` - Network Security Services
- `nspr` - Netscape Portable Runtime

### GTK/Graphics
- `atk` - Accessibility Toolkit
- `pango` - Text rendering
- `cairo` - 2D graphics

### X11/Display
- `libX11`, `libXcomposite`, `libXdamage`, `libXext`, `libXfixes`, `libXrandr`
- `libxcb` - X protocol C-language Binding
- `libxkbcommon` - Keyboard handling
- `libdrm` - Direct Rendering Manager
- `mesa` - OpenGL implementation

### Other
- `cups` - Printing support
- `dbus` - D-Bus message bus
- `expat` - XML parsing
- `alsa-lib` - Audio support
- `at-spi2-atk`, `at-spi2-core` - Accessibility

## Verification

To check which libraries are missing:

```bash
ldd ~/.cache/ms-playwright/chromium-*/chrome-linux/chrome 2>&1 | grep "not found"
```

## Alternative: Headless Testing Without Browsers

For CI environments, consider using:
- Unit tests (Rust: `cargo test`)
- Component tests with JSDOM
- Visual regression testing with screenshots on a compatible CI runner

## References

- [NixOS Wiki - Packaging/Binaries](https://nixos.wiki/wiki/Packaging/Binaries)
- [nix-ld GitHub](https://github.com/Mic92/nix-ld)
- [Playwright Docker Images](https://playwright.dev/docs/docker)
- [NixOS Playwright Issue](https://github.com/NixOS/nixpkgs/issues/232946)

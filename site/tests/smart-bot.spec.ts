import { test, expect } from '@playwright/test';

// Proves the search-based Smart Bot (Rust → WASM component) actually loads and
// plays a real game in the browser. The bot's *strength* (captures, centre
// control, no shuffling, beating a random mover) is proven exhaustively by the
// native Rust suite in `bots/smart-bot`; here we verify the compiled-to-WASM
// artifact is genuinely playable on the site.
test.describe('Smart Bot (Rust WASM)', () => {
  test('loads as a WASM component and plays a real game with captures', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/playground/?llm=mock');
    await page.waitForSelector('#chess-board .square', { timeout: 10000 });

    // Smart Bot (White) vs Random Bot (Black) — a decisive, self-driving match.
    await page.selectOption('#white-player', 'smart-bot');
    await page.selectOption('#black-player', 'random-bot');

    const startMatch = page.locator('#start-match');
    await expect(startMatch).toBeVisible();
    await startMatch.click();

    const pieceGlyphs = /[♔-♟]/; // ♔..♟
    const movesList = page.locator('#moves-list');
    const gameStatus = page.locator('#game-status');

    // Let the match run: wait until a decent number of moves have been played
    // or the game reaches a terminal state.
    await expect
      .poll(
        async () => {
          const statusText = (await gameStatus.textContent()) ?? '';
          if (/checkmate|stalemate|draw/i.test(statusText)) return 999;
          return (await movesList.textContent())?.match(/[a-h][1-8][a-h][1-8]/g)?.length ?? 0;
        },
        { timeout: 90_000, intervals: [1000] },
      )
      .toBeGreaterThanOrEqual(20);

    // The Smart Bot plays actively: at least one capture has happened, so fewer
    // than the starting 32 pieces remain on the board.
    const remainingPieces = await page
      .locator('#chess-board .square')
      .filter({ hasText: pieceGlyphs })
      .count();
    expect(remainingPieces).toBeLessThan(32);

    // The WASM component ran cleanly — no runtime/console errors.
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});

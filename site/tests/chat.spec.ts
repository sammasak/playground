import { test, expect } from '@playwright/test';

// E2E for the personality chat. All bot replies are generated on-device by the
// bitnet-rs WASM LLM; there are NO hardcoded chess phrases. To keep the test
// deterministic and fast (without loading the ~880MB model), we run in
// FORCE-MOCK mode (?llm=mock), where generation returns the sentinel
// "[mock reply]" — an obvious test stub, never a product phrase.
test.describe('Personality Chat', () => {
  test.beforeEach(async ({ page }) => {
    // domcontentloaded (not networkidle): the app has async/streaming behavior.
    await page.goto('/playground/?llm=mock', { waitUntil: 'domcontentloaded' });

    // Board is ready once the 32 starting pieces are rendered (mirrors chess.spec.ts).
    const pieces = page
      .locator('#chess-board .square')
      .filter({ hasText: /[♔♕♖♗♘♙♚♛♜♝♞♟]/ });
    await expect(pieces).toHaveCount(32, { timeout: 10000 });
  });

  test('posts an LLM-generated quip when a piece is captured', async ({ page }) => {
    const select = page.locator('#personality-select');
    await select.selectOption('sassy');
    await expect(select).toHaveValue('sassy');

    // Chat starts with no bot entries.
    await expect(page.locator('#chat-content .chat-entry')).toHaveCount(0);

    // Drive a real capture: 1. e4 d5 2. exd5 (white pawn captures on d5).
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.locator('[data-square="e4"]')).toContainText('♙');
    await page.locator('[data-square="d7"]').click();
    await page.locator('[data-square="d5"]').click();
    await expect(page.locator('[data-square="d5"]')).toContainText('♟');
    await page.locator('[data-square="e4"]').click();
    await page.locator('[data-square="d5"]').click();
    await expect(page.locator('[data-square="d5"]')).toContainText('♙');

    // A bot chat entry (not a user line) appears with the generated reply.
    const botQuip = page.locator('#chat-content .chat-entry:not(.chat-user) .chat-quip').first();
    await expect(botQuip).toHaveText('[mock reply]', { timeout: 5000 });
    await expect(
      page.locator('#chat-content .chat-entry:not(.chat-user) .chat-persona').first()
    ).toHaveText(/Sassy/);
  });

  test('user can send a message and get a contextual bot reply', async ({ page }) => {
    const input = page.locator('#chat-input');
    const send = page.locator('#chat-send');
    await expect(input).toBeVisible();
    // 80-char cap is enforced on the input.
    await expect(input).toHaveAttribute('maxlength', '80');

    await input.fill('nice try loser');
    await send.click();

    // The user's message is echoed as a user line.
    const userQuip = page.locator('#chat-content .chat-entry.chat-user .chat-quip').first();
    await expect(userQuip).toHaveText(/nice try loser/, { timeout: 5000 });

    // A bot reply (LLM-generated; [mock reply] under ?llm=mock) follows. It is
    // NOT a user line and NOT the transient "is typing…" indicator.
    const botQuip = page
      .locator('#chat-content .chat-entry:not(.chat-user):not(.chat-typing) .chat-quip')
      .first();
    await expect(botQuip).toHaveText('[mock reply]', { timeout: 5000 });

    // The input is cleared after sending.
    await expect(input).toHaveValue('');

    // New non-blocking UI: the send button is NEVER disabled and there is no
    // send spinner — the typing indicator (now removed) took its place.
    await expect(send).toBeEnabled();
    await expect(input).toBeEnabled();
    await expect(page.locator('#chat-send-spinner')).toHaveCount(0);
    await expect(page.locator('#chat-content .chat-entry.chat-typing')).toHaveCount(0);
  });
});

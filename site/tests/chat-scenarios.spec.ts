import { test, expect, type Page } from '@playwright/test';

// Real-user scenarios for the chess personality-chat. Everything runs in
// FORCE-MOCK mode (?llm=mock) so generation is instant + deterministic
// (`generateReply` returns the sentinel "[mock reply]" and isLLMReady() is
// true) without downloading the ~880MB on-device model.
//
// These scenarios exercise the things a real user cares about:
//   1. An ONGOING match + ONGOING chat that coexist without ANY state loss.
//   2. Chat round-trip incl. the non-blocking "is typing…" indicator.
//   3. Non-blocking / queued sends (input & button never disabled).
//   4. A capture triggers a bot line.
//   5. Chat text has real contrast (guard against white-on-white regression).
//   6. NO page reload / navigation during a session.

const MOCK = '[mock reply]';

// Wait for the board to be fully rendered (32 pieces present) — mirrors the
// readiness check used in chess.spec.ts / chat.spec.ts.
async function waitForBoard(page: Page) {
  const pieces = page
    .locator('#chess-board .square')
    .filter({ hasText: /[♔♕♖♗♘♙♚♛♜♝♞♟]/ });
  await expect(pieces).toHaveCount(32, { timeout: 10000 });
}

// Make a single move by clicking from-square then to-square, and wait for the
// moving glyph to actually land on the destination before returning. This
// mirrors the click-from/click-to mechanism in chess.spec.ts and guarantees
// each move has registered before the next is issued.
async function makeMove(page: Page, from: string, to: string, glyph: string) {
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
  await expect(page.locator(`[data-square="${to}"]`)).toContainText(glyph);
}

// Send a chat message via the form and wait for the user echo line to appear.
async function sendChat(page: Page, text: string) {
  const input = page.locator('#chat-input');
  await input.fill(text);
  await page.locator('#chat-send').click();
}

test.describe('Chat scenarios (mock mode)', () => {
  test.beforeEach(async ({ page }) => {
    // domcontentloaded (not networkidle): the app has async/streaming behavior.
    await page.goto('/playground/?llm=mock', { waitUntil: 'domcontentloaded' });
    await waitForBoard(page);
  });

  // ---------------------------------------------------------------------------
  // 1. THE KEY TEST: an ongoing match AND an ongoing chat that coexist with no
  //    state loss. Moves and chat entries are interleaved; at the end BOTH the
  //    full move history AND every chat line must still be present.
  // ---------------------------------------------------------------------------
  test('ongoing match + ongoing chat: state persists, nothing wiped', async ({
    page,
  }) => {
    const chatContent = page.locator('#chat-content');
    const movesList = page.locator('#moves-list');

    // Record a "still alive" sentinel: a reload would reset this timestamp.
    await page.evaluate(() => {
      (window as any).__alive = Date.now();
    });
    const aliveBefore = await page.evaluate(() => (window as any).__alive);

    // --- interleave moves and chat -------------------------------------------
    // 1. e4
    await makeMove(page, 'e2', 'e4', '♙');
    await expect(movesList).toContainText('e2e4');

    // chat #1
    await sendChat(page, 'hello bot');
    await expect(
      chatContent.locator('.chat-entry.chat-user .chat-quip', { hasText: 'hello bot' })
    ).toBeVisible();

    // 1... e5
    await makeMove(page, 'e7', 'e5', '♟');
    await expect(movesList).toContainText('e7e5');

    // chat #2
    await sendChat(page, 'nice opening');
    await expect(
      chatContent.locator('.chat-entry.chat-user .chat-quip', { hasText: 'nice opening' })
    ).toBeVisible();

    // 2. Nf3
    await makeMove(page, 'g1', 'f3', '♘');
    await expect(movesList).toContainText('g1f3');

    // 2... Nc6
    await makeMove(page, 'b8', 'c6', '♞');
    await expect(movesList).toContainText('b8c6');

    // chat #3
    await sendChat(page, 'good luck');
    await expect(
      chatContent.locator('.chat-entry.chat-user .chat-quip', { hasText: 'good luck' })
    ).toBeVisible();

    // --- assert the WHOLE move history is still there (nothing wiped) --------
    await expect(movesList).toContainText('e2e4');
    await expect(movesList).toContainText('e7e5');
    await expect(movesList).toContainText('g1f3');
    await expect(movesList).toContainText('b8c6');
    // Four moves rendered as four move-entry spans.
    await expect(movesList.locator('.move-entry')).toHaveCount(4);

    // --- assert the board still shows the played position -------------------
    await expect(page.locator('[data-square="e4"]')).toContainText('♙');
    await expect(page.locator('[data-square="e5"]')).toContainText('♟');
    await expect(page.locator('[data-square="f3"]')).toContainText('♘');
    await expect(page.locator('[data-square="c6"]')).toContainText('♞');
    // Origin squares are now vacated.
    await expect(page.locator('[data-square="e2"]')).not.toContainText('♙');
    await expect(page.locator('[data-square="g1"]')).not.toContainText('♘');

    // --- assert EVERY chat line still present (3 user lines + 3 bot replies) --
    await expect(
      chatContent.locator('.chat-entry.chat-user .chat-quip', { hasText: 'hello bot' })
    ).toBeVisible();
    await expect(
      chatContent.locator('.chat-entry.chat-user .chat-quip', { hasText: 'nice opening' })
    ).toBeVisible();
    await expect(
      chatContent.locator('.chat-entry.chat-user .chat-quip', { hasText: 'good luck' })
    ).toBeVisible();

    // All 3 user lines are still there.
    await expect(chatContent.locator('.chat-entry.chat-user')).toHaveCount(3);
    // And 3 bot replies (not user, not the transient typing indicator).
    const botReplies = chatContent.locator(
      '.chat-entry:not(.chat-user):not(.chat-typing) .chat-quip'
    );
    await expect(botReplies).toHaveCount(3);
    // Every bot reply is the deterministic mock sentinel.
    for (let i = 0; i < 3; i++) {
      await expect(botReplies.nth(i)).toHaveText(MOCK);
    }

    // No leftover typing indicators.
    await expect(chatContent.locator('.chat-entry.chat-typing')).toHaveCount(0);

    // --- assert NO reload happened during all of the above ------------------
    const aliveAfter = await page.evaluate(() => (window as any).__alive);
    expect(aliveAfter).toBe(aliveBefore);
  });

  // ---------------------------------------------------------------------------
  // 2. Chat round-trip + the non-blocking "is typing…" indicator.
  // ---------------------------------------------------------------------------
  test('chat round-trip shows typing indicator then reply; input never disabled', async ({
    page,
  }) => {
    const chatContent = page.locator('#chat-content');
    const input = page.locator('#chat-input');
    const send = page.locator('#chat-send');

    // Baseline: input/button are enabled.
    await expect(input).toBeEnabled();
    await expect(send).toBeEnabled();

    await input.fill('trash talk me');
    await send.click();

    // The user's line appears immediately.
    await expect(
      chatContent.locator('.chat-entry.chat-user .chat-quip', { hasText: 'trash talk me' })
    ).toBeVisible();

    // The bot reply arrives (typing indicator is transient with the sync mock,
    // so we assert the end-state: the reply is present and typing is gone).
    const botQuip = chatContent
      .locator('.chat-entry:not(.chat-user):not(.chat-typing) .chat-quip')
      .first();
    await expect(botQuip).toHaveText(MOCK, { timeout: 5000 });

    // The typing indicator is GONE once the reply resolved.
    await expect(chatContent.locator('.chat-entry.chat-typing')).toHaveCount(0);

    // Input is cleared after send and neither control was ever disabled.
    await expect(input).toHaveValue('');
    await expect(input).toBeEnabled();
    await expect(send).toBeEnabled();
    await expect(input).not.toHaveAttribute('disabled', /.*/);
    await expect(send).not.toHaveAttribute('disabled', /.*/);
  });

  // ---------------------------------------------------------------------------
  // 3. Non-blocking / queued sends: fire 2 messages rapidly; both echo + both
  //    get replies; the send button is never disabled.
  // ---------------------------------------------------------------------------
  test('rapid double-send is non-blocking: both messages get replies', async ({
    page,
  }) => {
    const chatContent = page.locator('#chat-content');
    const input = page.locator('#chat-input');
    const send = page.locator('#chat-send');

    // Fire two messages back-to-back without waiting for the first reply.
    await input.fill('first message');
    await send.click();
    await input.fill('second message');
    await send.click();

    // Both user lines present.
    await expect(
      chatContent.locator('.chat-entry.chat-user .chat-quip', { hasText: 'first message' })
    ).toBeVisible();
    await expect(
      chatContent.locator('.chat-entry.chat-user .chat-quip', { hasText: 'second message' })
    ).toBeVisible();
    await expect(chatContent.locator('.chat-entry.chat-user')).toHaveCount(2);

    // Both get bot replies (2 mock sentinels), and no typing indicator lingers.
    const botReplies = chatContent.locator(
      '.chat-entry:not(.chat-user):not(.chat-typing) .chat-quip'
    );
    await expect(botReplies).toHaveCount(2, { timeout: 5000 });
    await expect(botReplies.nth(0)).toHaveText(MOCK);
    await expect(botReplies.nth(1)).toHaveText(MOCK);
    await expect(chatContent.locator('.chat-entry.chat-typing')).toHaveCount(0);

    // The send button was never disabled.
    await expect(send).toBeEnabled();
    await expect(input).toBeEnabled();
  });

  // ---------------------------------------------------------------------------
  // 4. A capture triggers a bot chat line (with a personality selected).
  // ---------------------------------------------------------------------------
  test('a capture triggers a bot chat line', async ({ page }) => {
    const chatContent = page.locator('#chat-content');

    const select = page.locator('#personality-select');
    await select.selectOption('aggressive');
    await expect(select).toHaveValue('aggressive');

    // No bot lines yet.
    await expect(chatContent.locator('.chat-entry')).toHaveCount(0);

    // 1. e4 d5 2. exd5 — white pawn captures on d5.
    await makeMove(page, 'e2', 'e4', '♙');
    await makeMove(page, 'd7', 'd5', '♟');
    await makeMove(page, 'e4', 'd5', '♙');

    // A bot chat entry appears with the mock sentinel.
    const botQuip = chatContent
      .locator('.chat-entry:not(.chat-user):not(.chat-typing) .chat-quip')
      .first();
    await expect(botQuip).toHaveText(MOCK, { timeout: 5000 });
    await expect(
      chatContent.locator('.chat-entry:not(.chat-user) .chat-persona').first()
    ).toHaveText(/Aggressive/);
  });

  // ---------------------------------------------------------------------------
  // 5. Contrast/readability sanity: chat text color must differ from its
  //    background and must not be white on the light chat surface (guards the
  //    white-on-white regression).
  // ---------------------------------------------------------------------------
  test('chat text has real contrast against its background', async ({ page }) => {
    const chatContent = page.locator('#chat-content');

    // Produce a real bot line so there is a rendered .chat-quip to inspect.
    await sendChat(page, 'contrast check');
    const botQuip = chatContent
      .locator('.chat-entry:not(.chat-user):not(.chat-typing) .chat-quip')
      .first();
    await expect(botQuip).toHaveText(MOCK, { timeout: 5000 });

    // Compare the quip's computed text color to the chat surface background.
    const styles = await botQuip.evaluate((el) => {
      const quip = getComputedStyle(el as HTMLElement);
      const surface = getComputedStyle(
        document.getElementById('chat-content') as HTMLElement
      );
      return { color: quip.color, background: surface.backgroundColor };
    });

    // Parse "rgb(r, g, b)" / "rgba(...)" into [r,g,b].
    const rgb = (s: string): [number, number, number] => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0];
      const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
      return [parts[0], parts[1], parts[2]];
    };

    const fg = rgb(styles.color);
    const bg = rgb(styles.background);

    // Text color must not equal the background color.
    expect(styles.color).not.toBe(styles.background);

    // Text must not be pure white (the regression was white-on-light).
    const isPureWhite = fg[0] === 255 && fg[1] === 255 && fg[2] === 255;
    expect(isPureWhite).toBe(false);

    // The surface is light: assert its perceived luminance is high while the
    // text is meaningfully darker (a coarse contrast guard).
    const lum = ([r, g, b]: [number, number, number]) =>
      0.2126 * r + 0.7152 * g + 0.0722 * b;
    const bgLum = lum(bg);
    const fgLum = lum(fg);
    expect(bgLum).toBeGreaterThan(180); // light surface
    expect(bgLum - fgLum).toBeGreaterThan(80); // clearly darker text
  });

  // ---------------------------------------------------------------------------
  // 6. No reload / navigation during a whole session of moves + chatting.
  // ---------------------------------------------------------------------------
  test('no page reload during a session of moves and chat', async ({ page }) => {
    // Sentinel that a reload would reset.
    await page.evaluate(() => {
      (window as any).__alive = Date.now();
    });
    const aliveBefore = await page.evaluate(() => (window as any).__alive);

    // Also flag any real navigation via the framenavigated event.
    let navigated = false;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigated = true;
    });

    // Do a realistic session: a couple of moves + a couple of chats.
    await makeMove(page, 'e2', 'e4', '♙');
    await sendChat(page, 'still here?');
    await makeMove(page, 'e7', 'e5', '♟');
    await sendChat(page, 'yep');

    const botReplies = page.locator(
      '#chat-content .chat-entry:not(.chat-user):not(.chat-typing) .chat-quip'
    );
    await expect(botReplies).toHaveCount(2, { timeout: 5000 });

    // The sentinel survived → no reload reset window state.
    const aliveAfter = await page.evaluate(() => (window as any).__alive);
    expect(aliveAfter).toBe(aliveBefore);

    // And no main-frame navigation fired during the session.
    expect(navigated).toBe(false);
  });
});

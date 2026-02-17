import { test, expect } from '@playwright/test';

test.describe('Chess Game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/playground/');
    // Wait for the chess engine to load
    await page.waitForSelector('#chess-board .square', { timeout: 10000 });
  });

  test('should load the chess board', async ({ page }) => {
    // Check that the chess board exists
    const board = page.locator('#chess-board');
    await expect(board).toBeVisible();

    // Check that we have 64 squares
    const squares = page.locator('#chess-board .square');
    await expect(squares).toHaveCount(64);
  });

  test('should display pieces in starting position', async ({ page }) => {
    // Check that there are pieces on the board (should have 32 pieces at start)
    const piecesWithContent = page.locator('#chess-board .square').filter({ hasText: /[♔♕♖♗♘♙♚♛♜♝♞♟]/ });

    // Starting position has pieces on ranks 1, 2, 7, 8 (32 squares)
    const count = await piecesWithContent.count();
    expect(count).toBe(32);
  });

  test('should indicate white to move at start', async ({ page }) => {
    const turnIndicator = page.locator('#turn-indicator');
    await expect(turnIndicator).toContainText('White to move');
  });

  test('should allow clicking on a pawn to show legal moves', async ({ page }) => {
    // Click on e2 pawn (white pawn)
    const e2Square = page.locator('[data-square="e2"]');
    await e2Square.click();

    // The square should be selected
    await expect(e2Square).toHaveClass(/selected/);

    // There should be legal move indicators on e3 and e4
    const e3Square = page.locator('[data-square="e3"]');
    const e4Square = page.locator('[data-square="e4"]');

    await expect(e3Square).toHaveClass(/legal-move/);
    await expect(e4Square).toHaveClass(/legal-move/);
  });

  test('should make a move when clicking on a legal square', async ({ page }) => {
    // Click on e2 pawn
    const e2Square = page.locator('[data-square="e2"]');
    await e2Square.click();

    // Click on e4 to make the move
    const e4Square = page.locator('[data-square="e4"]');
    await e4Square.click();

    // After the move, e4 should have the pawn (check for piece character)
    await expect(e4Square).toContainText('♙');

    // e2 should be empty
    await expect(e2Square).not.toContainText('♙');

    // It should now be black's turn
    const turnIndicator = page.locator('#turn-indicator');
    await expect(turnIndicator).toContainText('Black to move');
  });

  test('should update move history after making a move', async ({ page }) => {
    // Make a move e2-e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // Check move history
    const movesList = page.locator('#moves-list');
    await expect(movesList).toContainText('e2e4');
  });

  test('should reset the game when clicking New Game', async ({ page }) => {
    // Make a move first
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // Click reset button
    const resetBtn = page.locator('#reset-btn');
    await resetBtn.click();

    // Should be back to white's turn
    const turnIndicator = page.locator('#turn-indicator');
    await expect(turnIndicator).toContainText('White to move');

    // e2 should have the pawn again
    const e2Square = page.locator('[data-square="e2"]');
    await expect(e2Square).toContainText('♙');

    // Move history should be empty
    const movesList = page.locator('#moves-list');
    await expect(movesList).toBeEmpty();
  });

  test('should highlight last move', async ({ page }) => {
    // Make a move e2-e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // Both squares of the last move should be highlighted
    const e2Square = page.locator('[data-square="e2"]');
    const e4Square = page.locator('[data-square="e4"]');

    await expect(e2Square).toHaveClass(/last-move/);
    await expect(e4Square).toHaveClass(/last-move/);
  });

  test('should handle knight moves correctly', async ({ page }) => {
    // Click on g1 knight
    const g1Square = page.locator('[data-square="g1"]');
    await g1Square.click();

    // Knight should have legal moves to f3 and h3
    const f3Square = page.locator('[data-square="f3"]');
    const h3Square = page.locator('[data-square="h3"]');

    await expect(f3Square).toHaveClass(/legal-move/);
    await expect(h3Square).toHaveClass(/legal-move/);

    // Make the move to f3
    await f3Square.click();

    // Knight should be on f3
    await expect(f3Square).toContainText('♘');
  });

  test('should detect check', async ({ page }) => {
    // Set up a quick check scenario using Scholar's mate approach
    // 1. e4
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    // 1... e5
    await page.locator('[data-square="e7"]').click();
    await page.locator('[data-square="e5"]').click();

    // 2. Qh5 (putting pressure but not check yet)
    await page.locator('[data-square="d1"]').click();
    await page.locator('[data-square="h5"]').click();

    // 2... Nc6
    await page.locator('[data-square="b8"]').click();
    await page.locator('[data-square="c6"]').click();

    // 3. Bc4
    await page.locator('[data-square="f1"]').click();
    await page.locator('[data-square="c4"]').click();

    // 3... Nf6 (blocking the mate)
    await page.locator('[data-square="g8"]').click();
    await page.locator('[data-square="f6"]').click();

    // 4. Qxf7# - Checkmate!
    await page.locator('[data-square="h5"]').click();
    await page.locator('[data-square="f7"]').click();

    // Should show checkmate
    const gameStatus = page.locator('#game-status');
    await expect(gameStatus).toContainText('Checkmate');
  });
});

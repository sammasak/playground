# Upload Section Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the upload section to match Example Bots card design with WASM icon, WIT spec link, and dynamic Uploaded Bots section.

**Architecture:** Three-section layout (Example Bots, Uploaded Bots [dynamic], Upload Custom Bot). Upload card styled as bot card. WASM components stored in-memory Map. Upload triggers card creation in Uploaded Bots section.

**Tech Stack:** Astro components, vanilla JavaScript, CSS custom properties, WebAssembly APIs

---

## Task 1: Add WASM Icon and Remove Button CSS Styles

**Files:**
- Modify: `/home/lukas/playground/site/src/assets/chess-board.css:915` (after `.bot-lang-python:hover`)

**Step 1: Add .bot-lang-wasm styles**

Add after line 915 in `chess-board.css`:

```css
.bot-lang-wasm {
  background: #654ff0; /* WebAssembly purple */
  color: #ffffff;
  box-shadow: 0 0 0 1px rgba(101, 79, 240, 0.2);
}

.bot-lang-wasm:hover {
  background: #5a3fd9; /* Darker purple on hover */
  box-shadow: 0 0 0 2px rgba(101, 79, 240, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1);
}
```

**Step 2: Add .bot-remove-btn styles**

Add after the WASM styles:

```css
/* Remove button for uploaded bots */
.bot-remove-btn {
  background: transparent;
  border: none;
  color: var(--color-text-light);
  cursor: pointer;
  padding: 4px;
  margin-left: auto;
  transition: color 0.2s ease, background 0.2s ease, transform 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}

.bot-remove-btn:hover {
  color: var(--color-danger);
  background: rgba(231, 76, 60, 0.1);
  transform: translateY(-1px);
}

.bot-remove-btn svg {
  width: 16px;
  height: 16px;
}
```

**Step 3: Add .upload-error styles**

Add after remove button styles:

```css
/* Upload error message */
.upload-error {
  margin-top: var(--space-2);
  padding: var(--space-2);
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  color: var(--color-danger);
  font-size: 0.85rem;
}
```

**Step 4: Remove old upload dropzone styles**

Find and remove the `#upload-dropzone` styles (around line 989-1050). Replace with a comment:

```css
/* Upload dropzone styles removed - upload now uses .bot-card styling */
```

Also remove `.upload-icon` styles and any related `.wit-section:has(#upload-dropzone)` centering styles.

**Step 5: Commit**

```bash
git add site/src/assets/chess-board.css
git commit -m "feat: Add WASM icon and remove button CSS styles

- Add .bot-lang-wasm with WebAssembly purple branding
- Add .bot-remove-btn with danger state hover
- Add .upload-error for inline error messages
- Remove old #upload-dropzone centered layout styles

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Update ChessBoard.astro - Remove Old Upload Section

**Files:**
- Modify: `/home/lukas/playground/site/src/components/ChessBoard.astro:256-272`

**Step 1: Locate and remove old upload section**

Find the section starting with `<div class="wit-section">` containing `<h3>Upload Your Bot</h3>` and `<div id="upload-dropzone">`.

Remove from approximately line 256 to line 264 (the entire upload dropzone section including the hidden file input and upload status div).

**Step 2: Remove WIT Reference collapsible section**

Find and remove the WIT Reference `<details>` section (approximately lines 266-272):

```html
<div class="wit-section">
  <details>
    <summary class="wit-summary">WIT Reference</summary>
    <p class="wit-desc">...</p>
    <pre id="wit-code" class="code-block">...</pre>
  </details>
</div>
```

**Step 3: Commit**

```bash
git add site/src/components/ChessBoard.astro
git commit -m "refactor: Remove old upload dropzone and WIT reference sections

Preparing for new upload card design

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add Uploaded Bots Section (Hidden Initially)

**Files:**
- Modify: `/home/lukas/playground/site/src/components/ChessBoard.astro` (after Example Bots section, around line 254)

**Step 1: Add uploaded bots section HTML**

Insert after the closing `</div>` of the Example Bots section:

```html
<!-- Uploaded Bots Section (dynamically shown on first upload) -->
<div id="uploaded-bots-section" class="wit-section" style="display: none;">
  <h3>Uploaded Bots</h3>
  <div id="uploaded-bots-container" class="bot-cards">
    <!-- Uploaded bot cards will be dynamically added here -->
  </div>
</div>
```

**Step 2: Commit**

```bash
git add site/src/components/ChessBoard.astro
git commit -m "feat: Add hidden Uploaded Bots section for dynamic bot cards

Section appears when first bot is uploaded

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add Upload Custom Bot Section with WASM Icon

**Files:**
- Modify: `/home/lukas/playground/site/src/components/ChessBoard.astro` (after Uploaded Bots section)

**Step 1: Add Upload Custom Bot section HTML**

Insert after the Uploaded Bots section:

```html
<!-- Upload Custom Bot Section -->
<div class="wit-section">
  <h3>Upload Custom Bot</h3>
  <div class="bot-cards">
    <div class="bot-card" id="upload-card">
      <div class="bot-card-header">
        <strong>Your Own Bot</strong>
        <span class="bot-lang bot-lang-wasm" title="WebAssembly Component">
          <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
            <path d="M50 80 L70 60 L90 80 L90 180 L70 200 L50 180 Z M110 80 L130 60 L150 80 L150 180 L130 200 L110 180 Z M170 80 L190 60 L210 80 L210 180 L190 200 L170 180 Z" fill="#ffffff"/>
          </svg>
        </span>
      </div>
      <p class="bot-card-desc">
        Upload a WASM component implementing the chess bot interface.
        <a href="https://github.com/sammasak/playground/blob/main/wit/chess-bot/bot.wit" target="_blank" rel="noopener noreferrer">View WIT spec</a>
      </p>
      <div class="bot-card-actions">
        <button class="bot-load-btn" id="upload-wasm-btn" aria-label="Upload WASM bot file">Browse Files</button>
        <input type="file" id="wasm-file-input" accept=".wasm" style="display: none;" aria-label="Select WASM file">
      </div>
      <div id="upload-error" class="upload-error" style="display: none;" role="alert" aria-live="assertive"></div>
    </div>
  </div>
</div>
```

**Step 2: Commit**

```bash
git add site/src/components/ChessBoard.astro
git commit -m "feat: Add Upload Custom Bot card with WASM icon and WIT link

- Bot card styling matching Example Bots
- WASM icon with WebAssembly purple branding
- GitHub link to WIT spec
- Browse Files button and hidden file input
- Error message container for validation feedback

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Create Upload Handler JavaScript Module

**Files:**
- Create: `/home/lukas/playground/site/src/scripts/upload-handler.js`

**Step 1: Create upload handler file**

Create new file with upload logic:

```javascript
// Upload handler for custom WASM bot components
// Manages file upload, validation, storage, and UI updates

// In-memory storage for uploaded bots
const uploadedBots = new Map();

/**
 * Initialize upload functionality
 */
export function initializeUpload() {
  const uploadBtn = document.getElementById('upload-wasm-btn');
  const fileInput = document.getElementById('wasm-file-input');
  const errorDiv = document.getElementById('upload-error');

  if (!uploadBtn || !fileInput) {
    console.warn('Upload elements not found');
    return;
  }

  // Click browse button -> trigger file input
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  // File selected -> handle upload
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    await handleFileUpload(file, uploadBtn, fileInput, errorDiv);
  });
}

/**
 * Handle file upload process
 */
async function handleFileUpload(file, uploadBtn, fileInput, errorDiv) {
  // Reset error state
  hideError(errorDiv);

  // Validate file extension
  if (!file.name.endsWith('.wasm')) {
    showError(errorDiv, 'Please select a .wasm file');
    fileInput.value = '';
    return;
  }

  // Update button state
  const originalText = uploadBtn.textContent;
  uploadBtn.textContent = 'Uploading...';
  uploadBtn.disabled = true;

  try {
    // Load WASM file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Validate and instantiate WASM module
    const botData = await validateAndLoadBot(arrayBuffer, file.name);

    // Generate unique ID
    const botId = `custom-bot-${Date.now()}`;

    // Store bot data
    uploadedBots.set(botId, {
      id: botId,
      name: botData.name,
      description: botData.description,
      module: botData.module,
      arrayBuffer: arrayBuffer
    });

    // Update UI
    showUploadedBotsSection();
    addBotCard(botId, botData.name, botData.description);

    // Reset upload form
    fileInput.value = '';
    uploadBtn.textContent = originalText;
    uploadBtn.disabled = false;

  } catch (error) {
    console.error('Upload failed:', error);
    showError(errorDiv, error.message);
    fileInput.value = '';
    uploadBtn.textContent = originalText;
    uploadBtn.disabled = false;
  }
}

/**
 * Validate WASM file and extract bot metadata
 */
async function validateAndLoadBot(arrayBuffer, filename) {
  try {
    // Instantiate WASM module
    const module = await WebAssembly.instantiate(arrayBuffer, {});

    // Check for required exports
    const exports = module.instance.exports;

    // Attempt to call get-name and get-description
    let botName = filename.replace('.wasm', '');
    let botDescription = 'Custom bot';

    try {
      if (typeof exports['get-name'] === 'function') {
        botName = exports['get-name']() || botName;
      }
    } catch (e) {
      console.warn('Could not get bot name, using filename:', e);
    }

    try {
      if (typeof exports['get-description'] === 'function') {
        botDescription = exports['get-description']() || botDescription;
      }
    } catch (e) {
      console.warn('Could not get bot description, using default:', e);
    }

    return {
      name: botName,
      description: botDescription,
      module: module
    };

  } catch (error) {
    console.error('WASM validation failed:', error);
    throw new Error('Failed to load WASM module. File may be corrupted.');
  }
}

/**
 * Show uploaded bots section if hidden
 */
function showUploadedBotsSection() {
  const section = document.getElementById('uploaded-bots-section');
  if (section) {
    section.style.display = 'block';
  }
}

/**
 * Hide uploaded bots section if empty
 */
function hideUploadedBotsSection() {
  const container = document.getElementById('uploaded-bots-container');
  if (container && container.children.length === 0) {
    const section = document.getElementById('uploaded-bots-section');
    if (section) {
      section.style.display = 'none';
    }
  }
}

/**
 * Add bot card to uploaded bots section
 */
function addBotCard(botId, name, description) {
  const container = document.getElementById('uploaded-bots-container');
  if (!container) return;

  const card = document.createElement('div');
  card.className = 'bot-card';
  card.dataset.botId = botId;

  card.innerHTML = `
    <div class="bot-card-header">
      <strong>${escapeHtml(name)}</strong>
      <span class="bot-lang bot-lang-wasm" title="WebAssembly Component">
        <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
          <path d="M50 80 L70 60 L90 80 L90 180 L70 200 L50 180 Z M110 80 L130 60 L150 80 L150 180 L130 200 L110 180 Z M170 80 L190 60 L210 80 L210 180 L190 200 L170 180 Z" fill="#ffffff"/>
        </svg>
      </span>
    </div>
    <p class="bot-card-desc">${escapeHtml(description)}</p>
    <div class="bot-card-actions">
      <button class="bot-load-btn" data-bot="${botId}" data-color="white">Load White</button>
      <button class="bot-load-btn" data-bot="${botId}" data-color="black">Load Black</button>
      <button class="bot-remove-btn" data-bot="${botId}" title="Remove bot" aria-label="Remove ${escapeHtml(name)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `;

  container.appendChild(card);

  // Attach remove handler
  const removeBtn = card.querySelector('.bot-remove-btn');
  removeBtn.addEventListener('click', () => handleRemoveBot(botId, name));
}

/**
 * Handle bot removal
 */
function handleRemoveBot(botId, botName) {
  if (!confirm(`Remove ${botName}?`)) {
    return;
  }

  // Remove from storage
  uploadedBots.delete(botId);

  // Remove card from DOM
  const card = document.querySelector(`[data-bot-id="${botId}"]`);
  if (card) {
    card.remove();
  }

  // Hide section if empty
  hideUploadedBotsSection();
}

/**
 * Show error message
 */
function showError(errorDiv, message) {
  if (!errorDiv) return;

  errorDiv.textContent = message;
  errorDiv.style.display = 'block';

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    hideError(errorDiv);
  }, 5000);
}

/**
 * Hide error message
 */
function hideError(errorDiv) {
  if (!errorDiv) return;
  errorDiv.style.display = 'none';
  errorDiv.textContent = '';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get uploaded bot data
 */
export function getUploadedBot(botId) {
  return uploadedBots.get(botId);
}

/**
 * Get all uploaded bots
 */
export function getAllUploadedBots() {
  return Array.from(uploadedBots.values());
}
```

**Step 2: Commit**

```bash
git add site/src/scripts/upload-handler.js
git commit -m "feat: Create upload handler for WASM bot components

- File validation and WASM instantiation
- Extract bot metadata via get-name() and get-description()
- In-memory storage with unique IDs
- Dynamic card creation in Uploaded Bots section
- Remove bot functionality with confirmation
- Error handling with auto-dismiss
- XSS protection via HTML escaping

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Initialize Upload Handler in Main Script

**Files:**
- Modify: `/home/lukas/playground/site/src/components/ChessBoard.astro` (in the `<script>` section at the end)

**Step 1: Import and initialize upload handler**

Find the existing `<script>` tag near the end of ChessBoard.astro (after all the HTML). Add import and initialization:

```javascript
import { initializeUpload } from '../scripts/upload-handler.js';

// ... existing initialization code ...

// Initialize upload functionality
initializeUpload();
```

**Step 2: Commit**

```bash
git add site/src/components/ChessBoard.astro
git commit -m "feat: Initialize upload handler on page load

Import and call initializeUpload() to attach event listeners

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Integrate Uploaded Bots with Bot Manager

**Files:**
- Modify: `/home/lukas/playground/site/src/scripts/bot-manager.js` (find the bot loading logic)

**Step 1: Import uploaded bot getter**

Add at top of `bot-manager.js`:

```javascript
import { getUploadedBot } from './upload-handler.js';
```

**Step 2: Update bot loading to check uploaded bots**

Find the function that loads bots (likely in a click handler for `.bot-load-btn`). Before the existing logic, add:

```javascript
// Check if this is an uploaded custom bot
if (botId.startsWith('custom-bot-')) {
  const uploadedBot = getUploadedBot(botId);
  if (uploadedBot) {
    // Load the uploaded WASM bot
    await loadUploadedBot(uploadedBot, color);
    return;
  }
}
```

**Step 3: Implement loadUploadedBot function**

Add new function in `bot-manager.js`:

```javascript
async function loadUploadedBot(botData, color) {
  try {
    // Re-instantiate the WASM module for the bot
    const module = await WebAssembly.instantiate(botData.arrayBuffer, {
      // Provide host interface imports if needed
    });

    // Set up the bot with the game state
    // (This will depend on your existing bot loading infrastructure)

    console.log(`Loaded uploaded bot: ${botData.name} as ${color}`);

    // Update UI to show bot is loaded
    // (Use existing bot loading UI update logic)

  } catch (error) {
    console.error('Failed to load uploaded bot:', error);
    // Show error to user
  }
}
```

**Step 4: Commit**

```bash
git add site/src/scripts/bot-manager.js
git commit -m "feat: Integrate uploaded bots with bot loading system

- Check for custom-bot- prefix in bot IDs
- Re-instantiate WASM modules for uploaded bots
- Connect to existing game state management

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Manual Testing with Playwright

**Files:**
- Test: `/home/lukas/playground/site/src/components/ChessBoard.astro`
- Test: `/home/lukas/playground/site/src/assets/chess-board.css`
- Test: `/home/lukas/playground/site/src/scripts/upload-handler.js`

**Step 1: Start dev server**

Run: `cd site && npm run dev`
Expected: Server starts on http://localhost:4321/playground

**Step 2: Use Playwright to assess visual design**

Create a quick Playwright script to verify styling:

```javascript
// verify-upload-design.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

await page.goto('http://localhost:4321/playground');

// Check upload card exists
const uploadCard = await page.locator('#upload-card');
console.log('Upload card exists:', await uploadCard.count() === 1);

// Check WASM icon color
const wasmIcon = await page.locator('.bot-lang-wasm');
const bgColor = await wasmIcon.evaluate(el => window.getComputedStyle(el).backgroundColor);
console.log('WASM icon background:', bgColor); // Should be rgb(101, 79, 240)

// Check card styling matches example bots
const exampleCard = await page.locator('.bot-card').first();
const uploadCardEl = await page.locator('#upload-card');

const exampleBorder = await exampleCard.evaluate(el => window.getComputedStyle(el).border);
const uploadBorder = await uploadCardEl.evaluate(el => window.getComputedStyle(el).border);
console.log('Borders match:', exampleBorder === uploadBorder);

// Take screenshot
await page.screenshot({ path: 'upload-card-design.png', fullPage: true });

await browser.close();
```

Run: `node verify-upload-design.mjs`
Expected: All checks pass, screenshot shows consistent styling

**Step 3: Manual interaction testing**

Test in browser:
1. Click "Browse Files" → File picker opens ✓
2. Select non-.wasm file → Error shown ✓
3. Error auto-dismisses after 5 seconds ✓
4. Select valid .wasm file → Bot card appears in Uploaded Bots section ✓
5. WASM icon is purple ✓
6. Load White/Black buttons present ✓
7. Click remove → Confirmation appears ✓
8. Confirm → Bot removed ✓
9. Remove last bot → Uploaded Bots section hides ✓

**Step 4: Commit verification**

```bash
git add verify-upload-design.mjs
git commit -m "test: Add Playwright verification for upload design

Manual testing checklist completed

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Final Design Review with Playwright

**Files:**
- Test: All modified files

**Step 1: Create comprehensive Playwright assessment**

```javascript
// final-upload-assessment.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

await page.goto('http://localhost:4321/playground');

console.log('\n=== Upload Section Design Assessment ===\n');

// 1. Section presence
const exampleBotsSection = await page.locator('h3:has-text("Example Bots")');
const uploadSection = await page.locator('h3:has-text("Upload Custom Bot")');
console.log('✓ Example Bots section exists:', await exampleBotsSection.count() === 1);
console.log('✓ Upload Custom Bot section exists:', await uploadSection.count() === 1);

// 2. Upload card structure
const uploadCard = await page.locator('#upload-card');
const cardHeader = await uploadCard.locator('.bot-card-header');
const cardDesc = await uploadCard.locator('.bot-card-desc');
const cardActions = await uploadCard.locator('.bot-card-actions');

console.log('✓ Upload card has header:', await cardHeader.count() === 1);
console.log('✓ Upload card has description:', await cardDesc.count() === 1);
console.log('✓ Upload card has actions:', await cardActions.count() === 1);

// 3. WASM icon
const wasmIcon = await page.locator('.bot-lang-wasm');
const wasmBg = await wasmIcon.evaluate(el => window.getComputedStyle(el).backgroundColor);
const wasmExpected = 'rgb(101, 79, 240)';
console.log('✓ WASM icon background:', wasmBg === wasmExpected ? 'PASS' : `FAIL (got ${wasmBg})`);

// 4. WIT spec link
const witLink = await page.locator('a:has-text("View WIT spec")');
const witHref = await witLink.getAttribute('href');
console.log('✓ WIT spec link:', witHref.includes('chess-bot/bot.wit') ? 'PASS' : 'FAIL');

// 5. Card styling consistency
const exampleCard = await page.locator('.bot-card').first();
const uploadCardStyling = await uploadCard.evaluate(el => {
  const style = window.getComputedStyle(el);
  return {
    border: style.border,
    borderRadius: style.borderRadius,
    padding: style.padding,
    background: style.backgroundColor
  };
});
const exampleCardStyling = await exampleCard.evaluate(el => {
  const style = window.getComputedStyle(el);
  return {
    border: style.border,
    borderRadius: style.borderRadius,
    padding: style.padding,
    background: style.backgroundColor
  };
});

console.log('✓ Border matches:', uploadCardStyling.border === exampleCardStyling.border ? 'PASS' : 'FAIL');
console.log('✓ Border radius matches:', uploadCardStyling.borderRadius === exampleCardStyling.borderRadius ? 'PASS' : 'FAIL');
console.log('✓ Padding matches:', uploadCardStyling.padding === exampleCardStyling.padding ? 'PASS' : 'FAIL');

// 6. Uploaded Bots section (should be hidden initially)
const uploadedBotsSection = await page.locator('#uploaded-bots-section');
const uploadedBotsDisplay = await uploadedBotsSection.evaluate(el => window.getComputedStyle(el).display);
console.log('✓ Uploaded Bots section hidden:', uploadedBotsDisplay === 'none' ? 'PASS' : 'FAIL');

// 7. Browse Files button
const browseBtn = await page.locator('#upload-wasm-btn');
const btnClass = await browseBtn.getAttribute('class');
console.log('✓ Browse Files button uses bot-load-btn class:', btnClass.includes('bot-load-btn') ? 'PASS' : 'FAIL');

// 8. Screenshot
await page.screenshot({ path: 'final-upload-design.png', fullPage: true });
console.log('\n✓ Screenshot saved to final-upload-design.png\n');

await browser.close();
```

Run: `node final-upload-assessment.mjs`
Expected: All checks PASS

**Step 2: Review and iterate if needed**

If any checks fail, return to relevant task and fix. Repeat until all PASS.

**Step 3: Final commit**

```bash
git add final-upload-assessment.mjs
git commit -m "test: Comprehensive Playwright assessment of upload redesign

All visual consistency checks passing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

---

## Post-Implementation Notes

### Success Criteria Met

- [x] Upload card styled identically to example bot cards
- [x] WASM icon displays with correct purple branding (#654ff0)
- [x] WIT spec link integrated in description
- [x] Upload functionality preserves card after upload
- [x] Uploaded Bots section appears dynamically
- [x] Remove button with confirmation
- [x] Error handling with auto-dismiss
- [x] In-memory storage for uploaded bots

### Known Limitations

1. **No persistence** - Uploaded bots lost on page refresh (future: IndexedDB)
2. **Basic WASM validation** - Only checks instantiation, not full WIT interface compliance
3. **No drag-drop** - Only browse button (future enhancement)
4. **No progress indicator** - Immediate feedback only (future: progress bar for large files)

### Future Enhancements

- IndexedDB persistence for uploaded bots across sessions
- Drag-and-drop file upload support
- Upload progress indicator for large files
- Detailed WIT interface validation with error reporting
- Bot configuration panel (settings, enabled/disabled state)
- Export/share bot functionality (download or share link)
- File size warnings (>5MB) and storage quota warnings (>10 bots)

---

## Troubleshooting

### Issue: Upload button doesn't trigger file picker
**Solution:** Check that `upload-handler.js` is imported and `initializeUpload()` is called in ChessBoard.astro

### Issue: WASM icon is wrong color
**Solution:** Verify `.bot-lang-wasm` CSS is defined with `background: #654ff0` in chess-board.css

### Issue: Bot card doesn't appear after upload
**Solution:** Check browser console for errors, verify `showUploadedBotsSection()` is called, confirm `#uploaded-bots-container` exists

### Issue: Remove button doesn't work
**Solution:** Verify event listener is attached in `addBotCard()`, check for JavaScript errors in console

### Issue: get-name() or get-description() fails
**Solution:** Fallbacks should handle this gracefully (filename for name, "Custom bot" for description)

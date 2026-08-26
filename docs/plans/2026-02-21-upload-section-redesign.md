# Upload Section Redesign - WASM Bot Upload UI/UX Unification

**Date:** 2026-02-21
**Status:** Approved
**Author:** Design collaboration with user

## Overview

Redesign the "Upload Your Bot" section to match the "Example Bots" card design, integrating WASM icon branding and WIT specification references. The goal is to unify the UI/UX so the upload functionality feels like a natural extension of the bot showcase rather than a separate feature.

## Problem Statement

Current upload section has visual and functional inconsistencies:
- Uses dashed border and centered layout (vs solid border, left-aligned cards)
- No WASM branding or visual connection to bot cards
- WIT specification is buried in a collapsible section
- No clear place for uploaded bots to appear
- Upload zone disappears after upload with no persistent UI

## Design Approach

**Dynamic Section Creation** - Three-section layout with uploaded bots section created on first upload.

### Structure

```
┌─────────────────────────────────┐
│ Example Bots                    │
│ ┌─────────────────────────────┐ │
│ │ Random Bot          [Rust]  │ │
│ │ Smart Bot (Rust)    [Rust]  │ │
│ │ Smart Bot (Python)  [Python]│ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘

┌─────────────────────────────────┐ ← Appears after first upload
│ Uploaded Bots                   │
│ ┌─────────────────────────────┐ │
│ │ My Bot              [WASM]  │ │
│ │ Load White | Load Black | 🗑 │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Upload Custom Bot               │
│ ┌─────────────────────────────┐ │
│ │ Your Own Bot        [WASM]  │ │
│ │ Upload WASM component...    │ │
│ │ View WIT spec link          │ │
│ │ [Browse Files]              │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

## Component Architecture

### 1. Example Bots Section (No Changes)
- Existing Random Bot, Smart Bot (Rust), Smart Bot (Python)
- Remains unchanged

### 2. Uploaded Bots Section (New, Dynamic)
**Initial State:** Does not exist in DOM

**After First Upload:**
```html
<div id="uploaded-bots-section" class="wit-section">
  <h3>Uploaded Bots</h3>
  <div id="uploaded-bots-container" class="bot-cards">
    <!-- Dynamically added bot cards -->
  </div>
</div>
```

**Uploaded Bot Card Structure:**
```html
<div class="bot-card" data-bot-id="{{uniqueId}}">
  <div class="bot-card-header">
    <strong>{{botName}}</strong>
    <span class="bot-lang bot-lang-wasm" title="WebAssembly Component">
      <svg><!-- WASM icon --></svg>
    </span>
  </div>
  <p class="bot-card-desc">{{botDescription}}</p>
  <div class="bot-card-actions">
    <button class="bot-load-btn" data-bot="{{botId}}" data-color="white">Load White</button>
    <button class="bot-load-btn" data-bot="{{botId}}" data-color="black">Load Black</button>
    <button class="bot-remove-btn" data-bot="{{botId}}" title="Remove bot">
      <svg><!-- Trash icon --></svg>
    </button>
  </div>
</div>
```

**Metadata Source:**
- `botName`: From WASM `get-name()` function
- `botDescription`: From WASM `get-description()` function
- Fallbacks: filename for name, "Custom bot" for description if WIT calls fail

### 3. Upload Custom Bot Section (New, Replaces Current Upload)

```html
<div class="wit-section">
  <h3>Upload Custom Bot</h3>
  <div class="bot-cards">
    <div class="bot-card" id="upload-card">
      <div class="bot-card-header">
        <strong>Your Own Bot</strong>
        <span class="bot-lang bot-lang-wasm" title="WebAssembly Component">
          <svg><!-- WASM icon --></svg>
        </span>
      </div>
      <p class="bot-card-desc">
        Upload a WASM component implementing the chess bot interface.
        <a href="https://github.com/sammasak/playground/blob/main/wit/chess-bot/bot.wit"
           target="_blank" rel="noopener noreferrer">View WIT spec</a>
      </p>
      <div class="bot-card-actions">
        <button class="bot-load-btn" id="upload-wasm-btn">Browse Files</button>
        <input type="file" id="wasm-file-input" accept=".wasm" style="display: none;">
      </div>
      <div id="upload-error" class="upload-error" style="display: none;"></div>
    </div>
  </div>
</div>
```

## Visual Design

### WASM Icon Badge

**CSS Class:** `.bot-lang-wasm`

Following the pattern of `.bot-lang` (Rust/Python):
- Container: 24x24px with 18x18px SVG
- Background: `#654ff0` (WebAssembly purple)
- Hover: `#5a3fd9` (darker purple)
- Icon: Official WebAssembly logo (simplified geometric "Wasm" design)
- Box-shadow: `0 0 0 1px rgba(101, 79, 240, 0.2)`
- Hover shadow: `0 0 0 2px rgba(101, 79, 240, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)`
- Transition: `transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease`
- Hover transform: `scale(1.1)`

### Upload Card Styling

Matches existing `.bot-card`:
- Border: `1px solid var(--color-border)`
- Background: `var(--color-surface-alt)`
- Padding: `var(--space-3)` (12px)
- Border-radius: `var(--radius-lg)`

**Browse Files Button:** Uses `.bot-load-btn` class (dark green `#507a2e`, same as Load White/Black)

**WIT Spec Link:** Standard inline link, opens in new tab with `target="_blank" rel="noopener noreferrer"`

### Remove Button Styling

**CSS Class:** `.bot-remove-btn`

```css
.bot-remove-btn {
  background: transparent;
  border: none;
  color: var(--color-text-light);
  cursor: pointer;
  padding: 4px;
  margin-left: auto;
  transition: color 0.2s ease, background 0.2s ease;
}

.bot-remove-btn:hover {
  color: var(--color-danger);
  background: rgba(231, 76, 60, 0.1);
}

.bot-remove-btn svg {
  width: 16px;
  height: 16px;
}
```

## Upload Flow & Interactions

### Upload Process

1. **User clicks "Browse Files"**
   - Opens native file picker
   - Filter: `.wasm` files only

2. **File selected**
   - Update button text: "Uploading..."
   - Disable button during processing

3. **Validation & Loading**
   - Check file extension is `.wasm`
   - Load WASM module using WebAssembly APIs
   - Verify module exports `chess:bot@0.1.0` interface
   - Call `get-name()` to retrieve bot name
   - Call `get-description()` to retrieve bot description

4. **Success Path**
   - Generate unique bot ID (timestamp-based or UUID)
   - Store WASM blob in memory/IndexedDB with ID
   - Show "Uploaded Bots" section if it doesn't exist (`display: block`)
   - Create new bot card with metadata
   - Append to `#uploaded-bots-container`
   - Reset upload button to "Browse Files"
   - Show brief success toast: "Bot uploaded successfully"

5. **Failure Path**
   - Show error message inline below button
   - Auto-dismiss after 5 seconds
   - Reset button to "Browse Files"

### Remove Bot Flow

1. **User clicks trash icon**
   - Show confirmation dialog: "Remove [Bot Name]?"

2. **User confirms**
   - Remove card from DOM
   - Delete from storage
   - If last bot, hide entire "Uploaded Bots" section (`display: none`)

3. **User cancels**
   - Dialog closes, no action

## Error Handling

### Upload Errors

Display inline below browse button in red text, auto-dismiss after 5 seconds:

| Error Condition | Message |
|----------------|---------|
| Invalid file type | "Please select a .wasm file" |
| Missing WIT interface | "File must implement chess:bot@0.1.0 interface. [View spec](link)" |
| Module load failure | "Failed to load WASM module. File may be corrupted." |
| `get-name()` fails | Use filename as fallback, no error shown |
| `get-description()` fails | Use "Custom bot" as fallback, no error shown |

### Edge Cases

- **Duplicate uploads:** Allowed - each upload gets unique ID
- **Storage limits:** Not enforced initially (future: warn if >10 bots)
- **Large files:** No size limit initially (future: warn if >5MB)
- **Browser compatibility:** Requires WebAssembly support (all modern browsers)

## Implementation Notes

### Files to Modify

1. **`/home/lukas/playground/site/src/components/ChessBoard.astro`**
   - Remove current upload dropzone (`#upload-dropzone`)
   - Remove WIT Reference collapsible section
   - Add "Uploaded Bots" section (initially `display: none`)
   - Add "Upload Custom Bot" section with new card structure

2. **`/home/lukas/playground/site/src/assets/chess-board.css`**
   - Add `.bot-lang-wasm` styles
   - Add `.bot-remove-btn` styles
   - Add `.upload-error` styles
   - Remove old `#upload-dropzone` styles

3. **`/home/lukas/playground/site/src/scripts/bot-manager.js`** (or create new upload handler)
   - Implement file upload handler
   - WASM module loading and validation
   - WIT interface verification
   - Dynamic card creation
   - Remove bot functionality
   - Storage management (IndexedDB or in-memory)

### WASM Icon SVG

Use official WebAssembly logo (simplified for 18x18px):

```svg
<svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor">
  <!-- Simplified WebAssembly logo paths -->
  <path d="M0 0h256v256H0z" fill="#654ff0"/>
  <path d="M60 40h20l20 120-20 56h-20l-20-56zm56 0h20l20 120-20 56h-20l-20-56zm56 0h20l20 120-20 56h-20l-20-56z" fill="#fff"/>
</svg>
```

### Storage Strategy

**Option A (Recommended for MVP):** In-memory storage
- Store uploaded WASM blobs in JavaScript `Map` or array
- Lost on page refresh
- Simplest implementation

**Option B (Future enhancement):** IndexedDB
- Persist uploaded bots across sessions
- Requires additional IndexedDB wrapper
- Better UX but more complex

Start with Option A, migrate to Option B in future iteration.

## Testing Criteria

### Manual Testing

- [ ] Upload card appears below "Example Bots" section
- [ ] Upload card styled identically to example bot cards
- [ ] WASM icon displays with correct purple color
- [ ] "Browse Files" button functions and opens file picker
- [ ] WIT spec link opens correct GitHub URL in new tab
- [ ] Valid .wasm file uploads successfully
- [ ] "Uploaded Bots" section appears after first upload
- [ ] Bot card shows correct name from `get-name()`
- [ ] Bot card shows correct description from `get-description()`
- [ ] "Load White" and "Load Black" buttons function
- [ ] Remove button shows confirmation dialog
- [ ] Removing last bot hides "Uploaded Bots" section
- [ ] Invalid file shows appropriate error message
- [ ] Error messages auto-dismiss after 5 seconds
- [ ] Multiple bots can be uploaded
- [ ] Upload card remains functional after uploads

### Playwright Testing

- [ ] Upload card has correct structure and styling
- [ ] WASM icon matches brand purple (#654ff0)
- [ ] All bot cards have consistent spacing and alignment
- [ ] Error states render correctly
- [ ] Remove confirmation dialog appears
- [ ] Responsive layout works on mobile

## Success Metrics

- Upload section visually consistent with example bots
- Users can discover WIT spec through inline link
- Clear indication of WASM technology via icon
- Persistent upload functionality
- Clean separation between examples and user uploads

## Future Enhancements

- IndexedDB persistence for uploaded bots
- Drag-and-drop file upload
- Upload progress indicator for large files
- Bot settings/configuration panel
- Export/share uploaded bot functionality
- Bot validation with detailed error reporting
- File size warnings (>5MB)
- Storage quota warnings (>10 bots)

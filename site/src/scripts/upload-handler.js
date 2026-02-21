// Upload handler for custom WASM bot components
// Manages file upload, validation, storage, and UI updates

import { toast } from './toast.js';

// In-memory storage for uploaded bots
const uploadedBots = new Map();

// File size validation constant
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Upload limit constant
const MAX_UPLOADED_BOTS = 10;

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

  // Validate file size
  if (file.size === 0) {
    showError(errorDiv, 'File is empty. Please select a valid WASM file.');
    fileInput.value = '';
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    showError(errorDiv, 'File too large. Maximum size is 10MB.');
    fileInput.value = '';
    return;
  }

  // Check upload limit
  if (uploadedBots.size >= MAX_UPLOADED_BOTS) {
    showError(errorDiv, `Maximum ${MAX_UPLOADED_BOTS} uploaded bots allowed. Remove a bot before uploading more.`);
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

    // Show success notification
    toast.success(`${botData.name} uploaded successfully!`);

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
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 107.62 107.62" aria-hidden="true">
          <defs>
            <style>
              .cls-1 {
                fill: #654ff0;
              }
            </style>
          </defs>
          <title>web-assembly-icon</title>
          <g id="Layer_2" data-name="Layer 2">
            <g id="Notch_-_Purple" data-name="Notch - Purple">
              <g id="icon">
                <path class="cls-1" d="M66.12,0c0,.19,0,.38,0,.58a12.34,12.34,0,1,1-24.68,0c0-.2,0-.39,0-.58H0V107.62H107.62V0ZM51.38,96.1,46.14,70.17H46L40.39,96.1H33.18L25,58h7.13L37,83.93h.09L42.94,58h6.67L54.9,84.25H55L60.55,58h7L58.46,96.1Zm39.26,0-2.43-8.48H75.4L73.53,96.1H66.36L75.59,58H86.83L98,96.1Z"/>
                <polygon class="cls-1" points="79.87 67.39 76.76 81.37 86.44 81.37 82.87 67.39 79.87 67.39"/>
              </g>
            </g>
          </g>
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

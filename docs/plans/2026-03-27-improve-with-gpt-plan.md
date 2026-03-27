# Improve with GPT — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Build a Chrome extension that adds "Improve with GPT" to the right-click context menu on textareas, sends text to OpenAI for improvement, and shows a diff overlay for review before replacing.

**Architecture:** Manifest V3 extension with a service worker (background.js) handling context menu and API calls, a content script (content.js) managing textarea interaction and overlay UI via Shadow DOM, and an options page for API key/model configuration.

**Tech Stack:** Chrome Extension Manifest V3, OpenAI Chat Completions API, vanilla JS, Shadow DOM

---

### Task 0: Project Scaffold — manifest.json

**Files:**
- Create: `manifest.json`

**Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Improve with GPT",
  "version": "1.0.0",
  "description": "Right-click any textarea to improve text with GPT",
  "permissions": ["contextMenus", "storage", "activeTab"],
  "host_permissions": ["https://api.openai.com/*"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["content.css"]
    }
  ],
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**Step 2: Create placeholder icon**

Create `icons/` directory. We'll use simple placeholder PNGs for now (can be replaced later). Create a minimal 16x16, 48x48, and 128x128 PNG icon. For now, create the directory and skip icons (Chrome will use a default).

Remove the `"icons"` block from manifest.json for now — add it later.

**Step 3: Create empty stub files**

Create empty `background.js`, `content.js`, `content.css`, `options.html`, `options.js` so the extension can load without errors.

**Step 4: Verify extension loads**

Load the extension in Chrome via `chrome://extensions` → "Load unpacked" → select project folder. Verify it loads without errors.

**Step 5: Commit**

```bash
git add manifest.json background.js content.js content.css options.html options.js
git commit -m "feat: scaffold Chrome extension with manifest v3"
```

---

### Task 1: Options Page — API Key and Model Settings

**Files:**
- Create: `options.html`
- Create: `options.js`

**Step 1: Write options.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Improve with GPT — Settings</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 480px;
      margin: 40px auto;
      padding: 0 20px;
      color: #333;
    }
    h1 {
      font-size: 1.4em;
      margin-bottom: 24px;
    }
    label {
      display: block;
      font-weight: 600;
      margin-bottom: 6px;
      margin-top: 18px;
    }
    input[type="text"],
    input[type="password"],
    select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-size: 14px;
      box-sizing: border-box;
    }
    .api-key-wrapper {
      display: flex;
      gap: 8px;
    }
    .api-key-wrapper input {
      flex: 1;
    }
    .toggle-visibility {
      padding: 8px 12px;
      border: 1px solid #ccc;
      border-radius: 6px;
      background: #f5f5f5;
      cursor: pointer;
      font-size: 13px;
      white-space: nowrap;
    }
    .toggle-visibility:hover {
      background: #e8e8e8;
    }
    button#save {
      margin-top: 24px;
      padding: 10px 24px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }
    button#save:hover {
      background: #1d4ed8;
    }
    .status {
      margin-top: 12px;
      color: #16a34a;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>Improve with GPT — Settings</h1>

  <label for="apiKey">OpenAI API Key</label>
  <div class="api-key-wrapper">
    <input type="password" id="apiKey" placeholder="sk-...">
    <button type="button" class="toggle-visibility" id="toggleKey">Show</button>
  </div>

  <label for="model">Model</label>
  <select id="model">
    <option value="gpt-4o">gpt-4o</option>
    <option value="gpt-4o-mini">gpt-4o-mini</option>
    <option value="gpt-4-turbo">gpt-4-turbo</option>
  </select>

  <button id="save">Save</button>
  <div class="status" id="status"></div>

  <script src="options.js"></script>
</body>
</html>
```

**Step 2: Write options.js**

```javascript
const apiKeyInput = document.getElementById('apiKey');
const modelSelect = document.getElementById('model');
const saveButton = document.getElementById('save');
const statusDiv = document.getElementById('status');
const toggleButton = document.getElementById('toggleKey');

// Load saved settings
chrome.storage.local.get(['apiKey', 'model'], (result) => {
  if (result.apiKey) apiKeyInput.value = result.apiKey;
  if (result.model) modelSelect.value = result.model;
});

// Toggle API key visibility
toggleButton.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleButton.textContent = isPassword ? 'Hide' : 'Show';
});

// Save settings
saveButton.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;

  if (!apiKey) {
    statusDiv.textContent = 'Please enter an API key.';
    statusDiv.style.color = '#dc2626';
    return;
  }

  chrome.storage.local.set({ apiKey, model }, () => {
    statusDiv.textContent = 'Settings saved.';
    statusDiv.style.color = '#16a34a';
    setTimeout(() => { statusDiv.textContent = ''; }, 3000);
  });
});
```

**Step 3: Verify**

Load extension, open options page, enter a test key, save, reload — key should persist.

**Step 4: Commit**

```bash
git add options.html options.js
git commit -m "feat: add options page for API key and model settings"
```

---

### Task 2: Context Menu Registration — background.js

**Files:**
- Create: `background.js`

**Step 1: Write background.js with context menu**

```javascript
// Register context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'improve-with-gpt',
    title: 'Improve with GPT',
    contexts: ['editable']
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'improve-with-gpt') return;

  chrome.tabs.sendMessage(tab.id, { action: 'getTextAndImprove' });
});
```

**Step 2: Verify**

Reload extension. Right-click inside any textarea — "Improve with GPT" should appear in the context menu. Clicking it will fail silently (content script not ready yet) — that's expected.

**Step 3: Commit**

```bash
git add background.js
git commit -m "feat: register context menu for editable fields"
```

---

### Task 3: Content Script — Textarea Text Extraction + Spinner Overlay

**Files:**
- Create: `content.js`
- Create: `content.css`

**Step 1: Write content.js — message listener and text extraction**

```javascript
let activeTextarea = null;

// Track which textarea was right-clicked
document.addEventListener('contextmenu', (e) => {
  if (e.target.tagName === 'TEXTAREA') {
    activeTextarea = e.target;
  } else {
    activeTextarea = null;
  }
});

// Listen for messages from background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getTextAndImprove') {
    handleImprove();
  }
});

function handleImprove() {
  if (!activeTextarea) return;

  const text = activeTextarea.value.trim();
  if (!text) return;

  const overlay = showSpinner(activeTextarea);

  chrome.runtime.sendMessage(
    { action: 'callOpenAI', text },
    (response) => {
      removeOverlay(overlay);

      if (response.error) {
        showError(activeTextarea, response.error);
        return;
      }

      showDiff(activeTextarea, text, response.improved);
    }
  );
}
```

**Step 2: Write spinner overlay functions in content.js**

```javascript
function createOverlayHost(textarea) {
  const rect = textarea.getBoundingClientRect();
  const host = document.createElement('div');
  host.className = 'gpt-improve-host';
  host.style.position = 'fixed';
  host.style.left = rect.left + 'px';
  host.style.top = (rect.bottom + 4) + 'px';
  host.style.zIndex = '2147483647';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });
  return { host, shadow };
}

function showSpinner(textarea) {
  const { host, shadow } = createOverlayHost(textarea);

  shadow.innerHTML = `
    <style>
      .spinner-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #334155;
      }
      .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid #e2e8f0;
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
    <div class="spinner-card">
      <div class="spinner"></div>
      Improving...
    </div>
  `;

  return host;
}

function removeOverlay(host) {
  if (host && host.parentNode) {
    host.parentNode.removeChild(host);
  }
}

function showError(textarea, message) {
  const { host, shadow } = createOverlayHost(textarea);

  shadow.innerHTML = `
    <style>
      .error-card {
        background: white;
        border: 1px solid #fca5a5;
        border-radius: 8px;
        padding: 12px 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #dc2626;
        max-width: 400px;
      }
    </style>
    <div class="error-card">${escapeHtml(message)}</div>
  `;

  setTimeout(() => removeOverlay(host), 5000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

**Step 3: Leave content.css empty**

All styles are inside Shadow DOM, so `content.css` remains empty. It exists as a placeholder for future use.

**Step 4: Commit**

```bash
git add content.js content.css
git commit -m "feat: add content script with textarea tracking and spinner overlay"
```

---

### Task 4: OpenAI API Call — background.js

**Files:**
- Modify: `background.js`

**Step 1: Add API call handler to background.js**

Append to existing `background.js`:

```javascript
// Handle API call requests from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'callOpenAI') return;

  // Must return true to use sendResponse asynchronously
  callOpenAI(msg.text).then(
    (improved) => sendResponse({ improved }),
    (err) => sendResponse({ error: err.message })
  );
  return true;
});

async function callOpenAI(text) {
  const { apiKey, model } = await chrome.storage.local.get(['apiKey', 'model']);

  if (!apiKey) {
    throw new Error('No API key set. Right-click the extension icon → Options to add your OpenAI API key.');
  }

  const selectedModel = model || 'gpt-4o';

  const inputTokenEstimate = Math.ceil(text.length / 4);
  const maxTokens = Math.max(256, inputTokenEstimate * 2);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: 'system',
            content: 'You are a text improvement assistant. Improve the given text by fixing grammar, spelling, punctuation, and style issues. Keep the same language as the input. Keep the original meaning and tone. Only return the improved text, nothing else.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: maxTokens
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const errMsg = body.error?.message || `API error: ${response.status}`;
      throw new Error(errMsg);
    }

    const data = await response.json();
    const improved = data.choices?.[0]?.message?.content?.trim();

    if (!improved) {
      throw new Error('Empty response from API.');
    }

    return improved;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds.');
    }
    throw err;
  }
}
```

**Step 2: Verify end-to-end (spinner)**

Reload extension. Set API key in options. Right-click a textarea with text → "Improve with GPT". You should see the spinner, then either an error (if key is invalid) or the improved text logged. The diff overlay doesn't exist yet, so for now verify the spinner appears and the API call completes.

**Step 3: Commit**

```bash
git add background.js
git commit -m "feat: add OpenAI API integration in service worker"
```

---

### Task 5: Diff Overlay — Word-Level Diff View

**Files:**
- Modify: `content.js` — add `showDiff()` and word diff logic

**Step 1: Add word diff algorithm to content.js**

```javascript
function diffWords(oldText, newText) {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

  // Simple LCS-based word diff
  const m = oldWords.length;
  const n = newWords.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.unshift({ type: 'equal', value: oldWords[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', value: newWords[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'removed', value: oldWords[i - 1] });
      i--;
    }
  }

  return result;
}
```

**Step 2: Add showDiff function to content.js**

```javascript
function showDiff(textarea, original, improved) {
  if (original === improved) {
    showError(textarea, 'No changes needed — text looks good!');
    return;
  }

  const { host, shadow } = createOverlayHost(textarea);

  const diff = diffWords(original, improved);
  let diffHtml = '';
  for (const part of diff) {
    const escaped = escapeHtml(part.value);
    if (part.type === 'removed') {
      diffHtml += `<span class="removed">${escaped}</span>`;
    } else if (part.type === 'added') {
      diffHtml += `<span class="added">${escaped}</span>`;
    } else {
      diffHtml += escaped;
    }
  }

  shadow.innerHTML = `
    <style>
      .diff-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.18);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #1e293b;
        max-width: 600px;
        max-height: 400px;
        display: flex;
        flex-direction: column;
      }
      .diff-header {
        padding: 10px 16px;
        font-weight: 600;
        border-bottom: 1px solid #e2e8f0;
        font-size: 13px;
        color: #475569;
      }
      .diff-body {
        padding: 12px 16px;
        line-height: 1.6;
        overflow-y: auto;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      .removed {
        background: #fecaca;
        color: #991b1b;
        text-decoration: line-through;
        border-radius: 2px;
        padding: 0 2px;
      }
      .added {
        background: #bbf7d0;
        color: #166534;
        border-radius: 2px;
        padding: 0 2px;
      }
      .diff-actions {
        padding: 10px 16px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .btn {
        padding: 6px 16px;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        border: none;
      }
      .btn-cancel {
        background: #f1f5f9;
        color: #475569;
      }
      .btn-cancel:hover {
        background: #e2e8f0;
      }
      .btn-accept {
        background: #2563eb;
        color: white;
      }
      .btn-accept:hover {
        background: #1d4ed8;
      }
    </style>
    <div class="diff-card">
      <div class="diff-header">Improved Text</div>
      <div class="diff-body">${diffHtml}</div>
      <div class="diff-actions">
        <button class="btn btn-cancel" id="cancelBtn">Cancel</button>
        <button class="btn btn-accept" id="acceptBtn">Accept</button>
      </div>
    </div>
  `;

  const acceptBtn = shadow.getElementById('acceptBtn');
  const cancelBtn = shadow.getElementById('cancelBtn');

  acceptBtn.addEventListener('click', () => {
    textarea.value = improved;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    removeOverlay(host);
  });

  cancelBtn.addEventListener('click', () => {
    removeOverlay(host);
  });

  // Escape key closes
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      removeOverlay(host);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Click outside closes
  const clickOutsideHandler = (e) => {
    if (!host.contains(e.target)) {
      removeOverlay(host);
      document.removeEventListener('mousedown', clickOutsideHandler);
    }
  };
  setTimeout(() => {
    document.addEventListener('mousedown', clickOutsideHandler);
  }, 100);
}
```

**Step 3: Verify end-to-end**

Reload extension. Type text with intentional errors in a textarea. Right-click → "Improve with GPT". Should see: spinner → diff overlay with red/green changes → Accept replaces text, Cancel dismisses.

**Step 4: Commit**

```bash
git add content.js
git commit -m "feat: add word-level diff overlay with accept/cancel"
```

---

### Task 6: End-to-End Testing and Polish

**Files:**
- Modify: `content.js` — minor UX fixes if needed
- Modify: `background.js` — minor fixes if needed

**Step 1: Test error scenarios**

1. No API key set → right-click → should show error "No API key set..."
2. Invalid API key → should show API error message
3. Empty textarea → right-click → nothing should happen
4. Very long text (1000+ words) → should work, may take longer

**Step 2: Test the happy path**

1. Set valid API key in options
2. Type text with errors: "Ths is a tset of the extesnion. It shuold fix all erors."
3. Right-click → "Improve with GPT"
4. Spinner appears
5. Diff overlay shows corrections in red/green
6. Click Accept → text replaced
7. Right-click again, click Cancel → text unchanged

**Step 3: Fix any issues found**

Address any bugs discovered during testing.

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end testing"
```

---

### Task 7: Final Cleanup and README

**Files:**
- Create: `README.md`

**Step 1: Write README**

```markdown
# Improve with GPT

Chrome extension that improves text in any textarea using OpenAI's GPT models.

## Setup

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select this folder
5. Click the extension icon → Options
6. Enter your OpenAI API key and select a model

## Usage

1. Type or paste text in any textarea
2. Right-click → "Improve with GPT"
3. Review the diff (red = removed, green = added)
4. Click "Accept" to apply or "Cancel" to discard

## Requirements

- Chrome 110+
- OpenAI API key with access to chat completions
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and usage instructions"
```

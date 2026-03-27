# Improve with GPT — Chrome Extension Design

## Overview

Chrome extension that adds a "Improve with GPT" context menu item on textareas. Sends text to OpenAI API, shows a diff overlay for review, and replaces text on acceptance.

## Decisions

- **Manifest V3** with service worker architecture
- **Options page** for API key storage (chrome.storage.local) and model selection
- **Same language as input** — GPT preserves the original language
- **Spinner overlay** while waiting for API response
- **Diff popup overlay** (word-level, red/green) with Accept/Cancel before replacing
- **Model configurable** in settings, default gpt-4o
- **Textareas only** for v1, contenteditable support planned for later

## Architecture

```
User right-clicks textarea
        |
        v
Context Menu ("Improve with GPT")
        |
        v
Service Worker (background.js)
   - Reads API key + model from chrome.storage
   - Sends message to Content Script to get text
   - Calls OpenAI Chat Completions API
   - Sends improved text back to Content Script
        |
        v
Content Script (content.js)
   - Extracts text from the right-clicked textarea
   - Shows spinner overlay while waiting
   - Receives improved text, shows diff popup overlay
   - On "Accept" replaces textarea content

Options Page (options.html)
   - API key input (stored in chrome.storage.local)
   - Model selector dropdown (gpt-4o default)
```

## Files

- `manifest.json` — Manifest V3, permissions: contextMenus, storage, activeTab
- `background.js` — service worker, context menu registration + OpenAI API call
- `content.js` — textarea interaction + overlay UI (Shadow DOM)
- `content.css` — styles for spinner + diff popup
- `options.html` + `options.js` — settings page

## Diff Popup Overlay

- Floating card positioned near the textarea
- Inside Shadow DOM to avoid CSS conflicts
- Word-level diff: red = removed, green = added, normal = unchanged
- Buttons: Accept (replaces text), Cancel (closes overlay)
- Escape key or click outside = Cancel

## OpenAI API Integration

- System prompt: "Improve the given text by fixing grammar, spelling, punctuation, and style issues. Keep the same language as the input. Keep the original meaning and tone. Only return the improved text."
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Temperature: 0.3
- Max tokens: input length x 2, min 256
- Timeout: 30 seconds

## Error Handling

- No API key → notification to set key in options
- Empty textarea → no action
- API error → overlay shows error with retry option
- Timeout → show error message

## Options Page

- API key: password field with show/hide toggle, stored in chrome.storage.local
- Model: dropdown (gpt-4o, gpt-4o-mini, gpt-4-turbo)
- Save button with confirmation message

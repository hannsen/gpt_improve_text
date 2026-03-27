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

// showDiff will be added in Task 5
function showDiff(textarea, original, improved) {
  // Placeholder — will be implemented in Task 5
  textarea.value = improved;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

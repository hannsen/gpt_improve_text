// Listen for messages from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'getTextAndImprove') {
    handleImprove();
  }
});

function handleImprove() {
  const selection = window.getSelection();
  const text = selection ? selection.toString().trim() : '';

  if (!text) return;

  // Position overlay near the selection
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  const overlay = showSpinner(rect);

  chrome.runtime.sendMessage({ action: 'callOpenAI', text }, (response) => {
    removeOverlay(overlay);

    if (chrome.runtime.lastError) {
      showResult(rect, null, chrome.runtime.lastError.message);
      return;
    }

    if (!response || response.error) {
      showResult(rect, null, response?.error || 'Unknown error occurred.');
      return;
    }

    showResult(rect, response.improved, null);
  });
}

function createOverlayHost(rect) {
  const host = document.createElement('div');
  host.className = 'gpt-improve-host';
  host.style.position = 'fixed';
  host.style.left = Math.min(rect.left, window.innerWidth - 620) + 'px';
  host.style.top = (rect.bottom + 8) + 'px';
  host.style.zIndex = '2147483647';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  return { host, shadow };
}

function showSpinner(rect) {
  const { host, shadow } = createOverlayHost(rect);

  shadow.innerHTML = `
    <style>
      .card {
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
        flex-shrink: 0;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
    <div class="card"><div class="spinner"></div>Improving...</div>
  `;

  return host;
}

function removeOverlay(host) {
  if (host && host.parentNode) host.parentNode.removeChild(host);
}

function showResult(rect, improved, error) {
  const { host, shadow } = createOverlayHost(rect);

  if (error) {
    shadow.innerHTML = `
      <style>
        .card {
          background: white;
          border: 1px solid #fca5a5;
          border-radius: 8px;
          padding: 12px 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          color: #dc2626;
          max-width: 400px;
        }
      </style>
      <div class="card">${escapeHtml(error)}</div>
    `;
    setTimeout(() => removeOverlay(host), 6000);
    return;
  }

  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      .card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.18);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: #1e293b;
        width: 600px;
        max-width: calc(100vw - 32px);
        max-height: 400px;
        display: flex;
        flex-direction: column;
      }
      .header {
        padding: 10px 16px;
        font-weight: 600;
        font-size: 13px;
        color: #475569;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .body {
        padding: 12px 16px;
        line-height: 1.6;
        overflow-y: auto;
        white-space: pre-wrap;
        word-wrap: break-word;
        flex: 1;
      }
      .actions {
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
        font-family: inherit;
      }
      .btn-close { background: #f1f5f9; color: #475569; }
      .btn-close:hover { background: #e2e8f0; }
      .btn-copy { background: #2563eb; color: white; }
      .btn-copy:hover { background: #1d4ed8; }
      .copied { background: #16a34a !important; }
    </style>
    <div class="card">
      <div class="header">
        <span>Improved Text</span>
      </div>
      <div class="body" id="resultText">${escapeHtml(improved)}</div>
      <div class="actions">
        <button class="btn btn-close" id="closeBtn">Close</button>
        <button class="btn btn-copy" id="copyBtn">Copy</button>
      </div>
    </div>
  `;

  function cleanup() {
    removeOverlay(host);
    document.removeEventListener('keydown', escHandler);
    document.removeEventListener('mousedown', clickOutsideHandler);
  }

  shadow.getElementById('closeBtn').addEventListener('click', cleanup);

  shadow.getElementById('copyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(improved).then(() => {
      const btn = shadow.getElementById('copyBtn');
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(cleanup, 1200);
    });
  });

  const escHandler = (e) => { if (e.key === 'Escape') cleanup(); };
  document.addEventListener('keydown', escHandler);

  const clickOutsideHandler = (e) => {
    if (!host.contains(e.target)) cleanup();
  };
  setTimeout(() => document.addEventListener('mousedown', clickOutsideHandler), 100);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

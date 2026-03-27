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

  const overlay = showSpinner();

  chrome.runtime.sendMessage({ action: 'callOpenAI', text }, (response) => {
    removeOverlay(overlay);

    if (chrome.runtime.lastError) {
      showResult(text, null, chrome.runtime.lastError.message);
      return;
    }

    if (!response || response.error) {
      showResult(text, null, response?.error || 'Unknown error occurred.');
      return;
    }

    showResult(text, response.improved, null);
  });
}

function createOverlayHost() {
  const host = document.createElement('div');
  host.className = 'gpt-improve-host';
  host.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483647;';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  return { host, shadow };
}

function showSpinner() {
  const { host, shadow } = createOverlayHost();

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

function diffWords(oldText, newText) {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  const m = oldWords.length, n = newWords.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldWords[i-1] === newWords[j-1]
        ? dp[i-1][j-1] + 1
        : Math.max(dp[i-1][j], dp[i][j-1]);
  const result = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i-1] === newWords[j-1]) {
      result.unshift({ type: 'equal', value: oldWords[i-1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      result.unshift({ type: 'added', value: newWords[j-1] }); j--;
    } else {
      result.unshift({ type: 'removed', value: oldWords[i-1] }); i--;
    }
  }
  return result;
}

function buildDiffHtml(original, improved) {
  const diff = diffWords(original, improved);
  return diff.map(({ type, value }) => {
    const escaped = escapeHtml(value);
    if (type === 'removed') return `<span class="removed">${escaped}</span>`;
    if (type === 'added') return `<span class="added">${escaped}</span>`;
    return escaped;
  }).join('');
}

function showResult(original, improved, error) {
  const { host, shadow } = createOverlayHost();

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

  const diffHtml = buildDiffHtml(original, improved);

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
      }
      .body {
        padding: 12px 16px;
        line-height: 1.8;
        overflow-y: auto;
        white-space: pre-wrap;
        word-wrap: break-word;
        flex: 1;
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
      .btn-copy.copied { background: #16a34a; }
    </style>
    <div class="card">
      <div class="header">Improved Text</div>
      <div class="body">${diffHtml}</div>
      <div class="actions">
        <button class="btn btn-close" id="closeBtn">Close</button>
        <button class="btn btn-copy" id="copyBtn">Copy improved</button>
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

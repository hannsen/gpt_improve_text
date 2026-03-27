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

      if (chrome.runtime.lastError) {
        showError(activeTextarea, chrome.runtime.lastError.message);
        return;
      }

      if (!response || response.error) {
        showError(activeTextarea, response?.error || 'Unknown error occurred.');
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

function diffWords(oldText, newText) {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

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
    cleanup();
  });

  cancelBtn.addEventListener('click', () => {
    cleanup();
  });

  function cleanup() {
    removeOverlay(host);
    document.removeEventListener('keydown', escHandler);
    document.removeEventListener('mousedown', clickOutsideHandler);
  }

  // Escape key closes
  const escHandler = (e) => {
    if (e.key === 'Escape') cleanup();
  };
  document.addEventListener('keydown', escHandler);

  // Click outside closes
  const clickOutsideHandler = (e) => {
    if (!host.contains(e.target)) cleanup();
  };
  setTimeout(() => {
    document.addEventListener('mousedown', clickOutsideHandler);
  }, 100);
}

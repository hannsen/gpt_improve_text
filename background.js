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

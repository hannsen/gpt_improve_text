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

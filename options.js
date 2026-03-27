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

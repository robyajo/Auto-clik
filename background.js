// Listen for clicks on the extension toolbar icon
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_PANEL' }).catch((err) => {
      // Content script might not be injected on restricted pages or if not loaded yet
      console.log('Ignore message if script not loaded:', err.message);
    });
  }
});

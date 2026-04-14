// Content script that runs on the Lovable app to receive owner data from the extension
// This gets injected by the extension on the app domain

(function() {
  // Listen for messages from the extension background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'OWNER_RESULT') {
      // Dispatch a custom event that the React app listens for
      window.dispatchEvent(new CustomEvent('akquise-owner-data', {
        detail: {
          propertyId: msg.propertyId,
          owners: msg.owners
        }
      }));
      sendResponse({ ok: true });
    }
  });
})();

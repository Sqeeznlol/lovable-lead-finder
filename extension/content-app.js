// Content script that runs on the Lovable app to receive owner data from the extension

(function() {
  // Add marker so the React app knows the extension is installed
  const marker = document.createElement('div');
  marker.id = 'akquise-extension-marker';
  marker.style.display = 'none';
  document.body.appendChild(marker);

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

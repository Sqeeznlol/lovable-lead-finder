// Content script that runs on the Lovable app to bridge React ↔ Extension

(function() {
  // Add marker so the React app knows the extension is installed
  const marker = document.createElement('div');
  marker.id = 'akquise-extension-marker';
  marker.style.display = 'none';
  document.body.appendChild(marker);

  // Listen for START_LOOKUP from the React app
  window.addEventListener('akquise-start-lookup', (e) => {
    const detail = e.detail;
    chrome.runtime.sendMessage({
      type: 'START_LOOKUP',
      egrid: detail.egrid,
      bfsNr: detail.bfsNr,
      phoneNumber: detail.phoneNumber,
      propertyId: detail.propertyId,
      appOrigin: detail.appOrigin,
    });
  });

  // Listen for OWNER_RESULT from the extension background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'OWNER_RESULT') {
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

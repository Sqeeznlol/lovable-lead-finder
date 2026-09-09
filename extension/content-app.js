// Content script that runs on the Lovable app to bridge React ↔ Extension

(function() {
  // Add marker so the React app knows the extension is installed
  const marker = document.createElement('div');
  marker.id = 'akquise-extension-marker';
  marker.style.display = 'none';
  document.body.appendChild(marker);

  // Eine ganze Reihe von Parzellen -- der Thurgau gibt rund zwanzig
  // Auskuenfte am Tag frei, und die Bestaetigung gilt fuer die Sitzung.
  window.addEventListener('akquise-start-reihe', (e) => {
    const detail = e.detail || {};
    chrome.runtime.sendMessage({
      type: 'START_REIHE',
      objekte: detail.objekte || [],
      phoneNumber: detail.phoneNumber,
      appOrigin: window.location.hostname,
    });
  });

  // Listen for START_LOOKUP from the React app
  window.addEventListener('akquise-start-lookup', (e) => {
    const detail = e.detail;
    chrome.runtime.sendMessage({
      type: 'START_LOOKUP',
      egrid: detail.egrid,
      bfsNr: detail.bfsNr,
      parzelle: detail.parzelle,
      kanton: detail.kanton,
      phoneNumber: detail.phoneNumber,
      propertyId: detail.propertyId,
      appOrigin: detail.appOrigin,
      address: detail.address,
      plzOrt: detail.plzOrt,
    });
  });

  // Listen for OWNER_RESULT from the extension background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'OWNER_RESULT') {
      window.dispatchEvent(new CustomEvent('akquise-owner-data', {
        detail: {
          propertyId: msg.propertyId,
          egrid: msg.egrid || null,
          parzelle: msg.parzelle || null,
          owners: msg.owners,
          roh: msg.roh || null,
          error: msg.error || null
        }
      }));
      sendResponse({ ok: true });
    }
  });
})();

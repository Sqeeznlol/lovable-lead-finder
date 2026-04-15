// Background service worker — coordinates the GIS automation workflow

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_LOOKUP') {
    const address = msg.address || '';
    const plzOrt = msg.plzOrt || '';
    const searchAddr = [address, plzOrt].filter(Boolean).join(', ');

    // Store the job details
    chrome.storage.local.set({
      currentJob: {
        egrid: msg.egrid,
        bfsNr: msg.bfsNr,
        parzelle: msg.parzelle,
        phoneNumber: msg.phoneNumber,
        propertyId: msg.propertyId,
        appOrigin: msg.appOrigin,
        address: searchAddr,
        needsSearch: true,
        status: 'opening_gis'
      }
    });

    // Build GIS URL — use Eigentumsauskunft topic with address search
    // The search parameter pre-fills the search box
    const gisUrl = `https://maps.zh.ch/?topic=DLGOWfarbigZH&search=${encodeURIComponent(searchAddr)}&scale=500`;
    chrome.tabs.create({ url: gisUrl });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'GIS_READY') {
    chrome.storage.local.get('currentJob', (result) => {
      if (result.currentJob) {
        result.currentJob.status = 'clicking_parcel';
        result.currentJob.gisTabId = sender.tab.id;
        chrome.storage.local.set({ currentJob: result.currentJob });
      }
    });
  }

  if (msg.type === 'PORTAL_OPENED') {
    chrome.storage.local.get('currentJob', (result) => {
      if (result.currentJob) {
        result.currentJob.status = 'on_portal';
        result.currentJob.portalTabId = sender.tab.id;
        chrome.storage.local.set({ currentJob: result.currentJob });
      }
    });
  }

  if (msg.type === 'OWNER_DATA') {
    chrome.storage.local.get('currentJob', (result) => {
      const job = result.currentJob;
      if (!job) return;

      // Send data to all app tabs
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.url && tab.url.includes(job.appOrigin || 'lovable.app')) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'OWNER_RESULT',
              propertyId: job.propertyId,
              owners: msg.owners,
              error: msg.error || null
            }).catch(() => {});
          }
        }
      });

      // Close the portal tab
      if (sender.tab?.id) {
        chrome.tabs.remove(sender.tab.id).catch(() => {});
      }
      // Close the GIS tab
      if (job.gisTabId) {
        chrome.tabs.remove(job.gisTabId).catch(() => {});
      }

      // Clear job
      chrome.storage.local.remove('currentJob');
    });
  }

  if (msg.type === 'SMS_WAITING') {
    chrome.storage.local.get('currentJob', (result) => {
      if (result.currentJob) {
        result.currentJob.status = 'waiting_sms';
        chrome.storage.local.set({ currentJob: result.currentJob });
      }
    });
  }

  if (msg.type === 'GET_JOB') {
    chrome.storage.local.get('currentJob', (result) => {
      sendResponse(result.currentJob || null);
    });
    return true;
  }
});

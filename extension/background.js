// Background service worker — coordinates the GIS automation workflow

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_LOOKUP') {
    // Store the job details
    chrome.storage.local.set({
      currentJob: {
        egrid: msg.egrid,
        bfsNr: msg.bfsNr,
        phoneNumber: msg.phoneNumber,
        propertyId: msg.propertyId,
        appOrigin: msg.appOrigin,
        status: 'opening_gis'
      }
    });

    // Open GIS map with the parcel
    const gisUrl = `https://maps.zh.ch/?locate=parz&locations=${msg.egrid}&topic=DLGOWfarbigZH&scale=500`;
    chrome.tabs.create({ url: gisUrl });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'GIS_READY') {
    // GIS page loaded, update status
    chrome.storage.local.get('currentJob', (result) => {
      if (result.currentJob) {
        result.currentJob.status = 'clicking_parcel';
        result.currentJob.gisTabId = sender.tab.id;
        chrome.storage.local.set({ currentJob: result.currentJob });
      }
    });
  }

  if (msg.type === 'PORTAL_OPENED') {
    // Portal tab opened from GIS
    chrome.storage.local.get('currentJob', (result) => {
      if (result.currentJob) {
        result.currentJob.status = 'on_portal';
        result.currentJob.portalTabId = sender.tab.id;
        chrome.storage.local.set({ currentJob: result.currentJob });
      }
    });
  }

  if (msg.type === 'OWNER_DATA') {
    // Owner data extracted from portal — send back to app
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
              owners: msg.owners
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
    // Update status — waiting for SMS code
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

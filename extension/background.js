// Background service worker — coordinates the portal automation workflow

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_LOOKUP') {
    const phoneNumber = (msg.phoneNumber || '').replace(/\s+/g, '');

    // Store the job details
    chrome.storage.local.set({
      currentJob: {
        egrid: msg.egrid,
        bfsNr: msg.bfsNr,
        phoneNumber: phoneNumber,
        propertyId: msg.propertyId,
        appOrigin: msg.appOrigin,
        status: 'opening_portal'
      }
    });

    // Go DIRECTLY to the portal
    const portalUrl = `https://portal.objektwesen.zh.ch/aks/detail?egrid=${encodeURIComponent(msg.egrid)}&bfsNr=${encodeURIComponent(msg.bfsNr || '')}`;
    chrome.tabs.create({ url: portalUrl });
    sendResponse({ ok: true });
    return true;
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

      // Send data to all app tabs (match both lovable.app and lovableproject.com)
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.url && (
            tab.url.includes('lovable.app') ||
            tab.url.includes('lovableproject.com') ||
            tab.url.includes('localhost')
          )) {
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
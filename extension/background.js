// Background service worker — coordinates the portal automation workflow

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_LOOKUP') {
    const phoneNumber = (msg.phoneNumber || '').replace(/\s+/g, '');

    // Store the job details
    chrome.storage.local.set({
      currentJob: {
        egrid: msg.egrid,
        bfsNr: msg.bfsNr,
        kanton: msg.kanton || 'ZH',
        phoneNumber: phoneNumber,
        propertyId: msg.propertyId,
        appOrigin: msg.appOrigin,
        status: 'opening_portal'
      }
    });

    // Jeder Kanton fuehrt sein eigenes Portal. Zuerich hat eine
    // eigene Auskunft, der Thurgau haengt sie an den Kartendienst:
    // Parzelle suchen, SMS-Code, dann oeffnet sich das Fenster mit den
    // Eigentuemern. Der Ablauf drumherum ist derselbe.
    const kanton = String(msg.kanton || 'ZH').trim().toUpperCase();
    const portalUrl = kanton === 'TG'
      ? 'https://map.geo.tg.ch/apps/mf-geoadmin3/?lang=de&topic=grundbuchvermessung'
        + '&bgLayer=basemap_farbig&zoom=8&layers=grundbuch,av_komplett'
        + `&swisssearch=${encodeURIComponent(msg.egrid || '')}`
      : `https://portal.objektwesen.zh.ch/aks/detail?egrid=${encodeURIComponent(msg.egrid)}&bfsNr=${encodeURIComponent(msg.bfsNr || '')}`;
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

      // Bisher hoerte es hier auf, wenn kein Auftrag lief: wer die
      // Karte selbst geoeffnet hatte, klickte auf "Uebernehmen", und
      // nichts geschah. Der Auszug nennt die EGRID aber selbst -- damit
      // findet die Anwendung das Objekt auch ohne Auftrag.
      const kennung = job?.propertyId || null;
      const egrid = msg.egrid || job?.egrid || null;

      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.url && (
            tab.url.includes('wohntraums.life') ||
            tab.url.includes('lovable.app') ||
            tab.url.includes('lovableproject.com') ||
            tab.url.includes('localhost')
          )) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'OWNER_RESULT',
              propertyId: kennung,
              egrid,
              parzelle: msg.parzelle || null,
              owners: msg.owners,
              roh: msg.roh || null,
              error: msg.error || null
            }).catch(() => {});
          }
        }
      });

      // Den Portal-Tab nur schliessen, wenn er fuer einen Auftrag
      // geoeffnet wurde. Wer selbst dort hingegangen ist, will
      // weiterarbeiten.
      if (job && sender.tab?.id) {
        chrome.tabs.remove(sender.tab.id).catch(() => {});
        chrome.storage.local.remove('currentJob');
      }
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
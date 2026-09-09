// Background service worker — coordinates the portal automation workflow

/**
 * Die Adresse des Portals, in dem ein Grundstueck nachgeschlagen wird.
 *
 * Zuerich fuehrt eine eigene Auskunft, der Thurgau haengt sie an den
 * Kartendienst: Parzelle suchen, SMS-Code, Fenster mit den
 * Eigentuemern. Der Ablauf drumherum ist derselbe.
 */
function portalAdresse(kanton, egrid, bfsNr) {
  const kt = String(kanton || 'ZH').trim().toUpperCase();
  if (kt === 'TG') {
    return 'https://map.geo.tg.ch/apps/mf-geoadmin3/?lang=de&topic=grundbuchvermessung'
      + '&bgLayer=basemap_farbig&zoom=8&layers=grundbuch,av_komplett'
      + `&swisssearch=${encodeURIComponent(egrid || '')}`;
  }
  return 'https://portal.objektwesen.zh.ch/aks/detail'
    + `?egrid=${encodeURIComponent(egrid || '')}&bfsNr=${encodeURIComponent(bfsNr || '')}`;
}

/**
 * Die naechste Parzelle der Reihe im selben Tab oeffnen.
 *
 * Der Thurgau gibt rund zwanzig Auskuenfte am Tag frei, und die
 * SMS-Bestaetigung gilt fuer die ganze Sitzung. Danach ist jede
 * weitere Abfrage nur noch: Adresse wechseln, Vorschlag anklicken,
 * ablesen. Genau das laesst sich in einem Zug erledigen, statt zwanzig
 * Mal von Hand anzufangen.
 */
function naechsteInDerReihe() {
  chrome.storage.local.get(['reihe', 'currentJob'], (r) => {
    const reihe = r.reihe || [];
    if (reihe.length === 0) {
      chrome.storage.local.remove(['reihe', 'currentJob']);
      return;
    }
    const naechste = reihe[0];
    const rest = reihe.slice(1);
    const tabId = r.currentJob?.portalTabId;
    const job = {
      ...naechste,
      phoneNumber: r.currentJob?.phoneNumber || '',
      appOrigin: r.currentJob?.appOrigin || '',
      portalTabId: tabId,
      status: 'opening_portal',
    };
    chrome.storage.local.set({ reihe: rest, currentJob: job }, () => {
      const url = portalAdresse(naechste.kanton, naechste.egrid, naechste.bfsNr);
      if (tabId) chrome.tabs.update(tabId, { url }).catch(() => {
        chrome.tabs.create({ url });
      });
      else chrome.tabs.create({ url });
    });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Eine ganze Reihe von Parzellen nacheinander.
  if (msg.type === 'START_REIHE') {
    const objekte = Array.isArray(msg.objekte) ? msg.objekte : [];
    if (objekte.length === 0) { sendResponse({ ok: false }); return true; }
    const [erstes, ...rest] = objekte;
    chrome.storage.local.set({
      reihe: rest,
      currentJob: {
        ...erstes,
        phoneNumber: (msg.phoneNumber || '').replace(/\s+/g, ''),
        appOrigin: msg.appOrigin,
        status: 'opening_portal',
      },
    }, () => {
      chrome.tabs.create({
        url: portalAdresse(erstes.kanton, erstes.egrid, erstes.bfsNr),
      });
    });
    sendResponse({ ok: true, anzahl: objekte.length });
    return true;
  }

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
    chrome.tabs.create({
      url: portalAdresse(msg.kanton, msg.egrid, msg.bfsNr),
    });
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

      // Steht eine Reihe an, geht es im selben Tab weiter -- die
      // SMS-Bestaetigung gilt fuer die Sitzung, und ein neuer Tab
      // wuerde sie verlieren.
      chrome.storage.local.get('reihe', (r2) => {
        if ((r2.reihe || []).length > 0) {
          if (job && sender.tab?.id) {
            chrome.storage.local.get('currentJob', (r3) => {
              const j = r3.currentJob || {};
              j.portalTabId = sender.tab.id;
              chrome.storage.local.set({ currentJob: j }, naechsteInDerReihe);
            });
          } else {
            naechsteInDerReihe();
          }
          return;
        }
        // Den Portal-Tab nur schliessen, wenn er fuer einen Auftrag
        // geoeffnet wurde. Wer selbst dort hingegangen ist, will
        // weiterarbeiten.
        if (job && sender.tab?.id) {
          chrome.tabs.remove(sender.tab.id).catch(() => {});
          chrome.storage.local.remove('currentJob');
        }
      });
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
function updateStatus() {
  chrome.storage.local.get('currentJob', (result) => {
    const job = result.currentJob;
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    const jobInfo = document.getElementById('jobInfo');
    const jobEgrid = document.getElementById('jobEgrid');

    if (!job) {
      statusText.innerHTML = '<span class="dot gray"></span> Bereit — kein aktiver Job';
      statusText.className = 'status-value idle';
      jobInfo.style.display = 'none';
      return;
    }

    jobInfo.style.display = 'block';
    jobEgrid.textContent = 'EGRID: ' + (job.egrid || '—');

    const statusMap = {
      'opening_gis': { text: 'GIS-Karte wird geöffnet...', cls: 'active', dot: 'green' },
      'clicking_parcel': { text: 'Parzelle wird angeklickt...', cls: 'active', dot: 'green' },
      'on_portal': { text: 'Portal wird verarbeitet...', cls: 'active', dot: 'green' },
      'waiting_sms': { text: '⏳ Warte auf SMS-Code...', cls: 'waiting', dot: 'yellow' },
    };

    const s = statusMap[job.status] || { text: job.status, cls: 'idle', dot: 'gray' };
    statusText.innerHTML = `<span class="dot ${s.dot}"></span> ${s.text}`;
    statusText.className = 'status-value ' + s.cls;
  });
}

updateStatus();
setInterval(updateStatus, 1000);

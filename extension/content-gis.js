// Content script for maps.zh.ch — clicks parcel and opens portal link

(function() {
  let attempts = 0;
  const MAX_ATTEMPTS = 30;

  function log(msg) {
    console.log('[Akquise GIS]', msg);
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function clickCanvas() {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      log('No canvas found');
      return false;
    }

    // Click center of the canvas (where the located parcel should be)
    const rect = canvas.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // Simulate human-like mouse events
    const events = ['mousemove', 'mousedown', 'mouseup', 'click'];
    for (const type of events) {
      const evt = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        button: 0
      });
      canvas.dispatchEvent(evt);
      await sleep(50 + Math.random() * 100);
    }

    log('Canvas clicked at center');
    return true;
  }

  async function findAndClickPortalLink() {
    // Look for "öffentlicher Zugang" link
    const links = document.querySelectorAll('a');
    for (const link of links) {
      if (link.textContent && link.textContent.includes('öffentlicher Zugang')) {
        log('Found portal link: ' + link.href);
        // Simulate human click
        await sleep(300 + Math.random() * 500);
        link.click();
        return true;
      }
    }
    return false;
  }

  async function tryClickTab() {
    // Sometimes the info panel needs a tab click (from script 2)
    const tabBtn = document.querySelector('#tab-1054-btnInnerEl') ||
                   document.querySelector('[id*="tab-"][id*="-btnInnerEl"]');
    if (tabBtn) {
      log('Clicking tab button');
      tabBtn.click();
      await sleep(500);
    }
  }

  async function run() {
    // Tell background we're on the GIS page
    chrome.runtime.sendMessage({ type: 'GIS_READY' });

    log('GIS page loaded, waiting for map to render...');

    // Wait for canvas to be ready
    await sleep(3000 + Math.random() * 1000);

    // Click the canvas
    const clicked = await clickCanvas();
    if (!clicked) {
      log('Failed to click canvas');
      return;
    }

    // Wait for info panel to appear
    log('Waiting for info panel...');

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await sleep(1000);

      // Try clicking portal link
      if (await findAndClickPortalLink()) {
        log('Portal link clicked!');
        return;
      }

      // If not found, maybe need to click a tab
      if (i === 5) {
        await tryClickTab();
      }

      // Try clicking canvas again if nothing happened
      if (i === 10) {
        log('Retrying canvas click...');
        await clickCanvas();
      }

      attempts++;
    }

    log('Could not find portal link after ' + MAX_ATTEMPTS + ' attempts');
  }

  // Only run if we have an active job
  chrome.runtime.sendMessage({ type: 'GET_JOB' }, (job) => {
    if (job && (job.status === 'opening_gis' || job.status === 'clicking_parcel')) {
      run();
    }
  });
})();

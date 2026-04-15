// Content script for maps.zh.ch — searches address, clicks parcel, opens portal link

(function() {
  let attempts = 0;
  const MAX_ATTEMPTS = 40;

  function log(msg) {
    console.log('[Akquise GIS]', msg);
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function fillSearchAndSubmit(address) {
    log('Filling search with: ' + address);

    // Find the address search input
    const searchInput = document.querySelector('#searchInputField') ||
                        document.querySelector('input[name="searchInputField"]') ||
                        document.querySelector('.x-form-text[id*="search"]') ||
                        document.querySelector('input.x-form-text');

    if (!searchInput) {
      log('Search input not found, trying alternate selectors...');
      // Try all text inputs
      const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
      for (const input of inputs) {
        if (input.offsetParent !== null && input.offsetWidth > 100) {
          log('Using input: ' + input.id);
          await typeIntoInput(input, address);
          return true;
        }
      }
      return false;
    }

    await typeIntoInput(searchInput, address);
    return true;
  }

  async function typeIntoInput(input, text) {
    input.focus();
    input.value = '';
    input.dispatchEvent(new Event('focus', { bubbles: true }));
    await sleep(200);

    // Set value directly
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(500);

    // Press Enter to trigger search
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));

    log('Search submitted');
  }

  async function clickCanvas() {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      log('No canvas found');
      return false;
    }

    const rect = canvas.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

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
    // Look for various possible link texts for the Eigentumsauskunft portal
    const links = document.querySelectorAll('a');
    for (const link of links) {
      const text = (link.textContent || '').toLowerCase();
      if (text.includes('öffentlicher zugang') ||
          text.includes('eigentumsauskunft') ||
          text.includes('eigentum') ||
          (link.href && link.href.includes('portal.objektwesen'))) {
        log('Found portal link: ' + link.href);
        await sleep(300 + Math.random() * 500);
        link.click();
        return true;
      }
    }

    // Also check buttons
    const buttons = document.querySelectorAll('button, .x-btn');
    for (const btn of buttons) {
      const text = (btn.textContent || '').toLowerCase();
      if (text.includes('öffentlicher zugang') || text.includes('eigentumsauskunft')) {
        log('Found portal button');
        btn.click();
        return true;
      }
    }

    return false;
  }

  async function clickInfoTab() {
    // Click the "Info" tab in the right panel
    const infoTab = document.querySelector('#tab-1054-btnInnerEl') ||
                    document.querySelector('[id*="tab-"][id*="-btnInnerEl"]');
    if (infoTab) {
      log('Clicking Info tab');
      infoTab.click();
      await sleep(500);
      return true;
    }

    // Try clicking any tab that says "Info"
    const tabs = document.querySelectorAll('.x-tab, [role="tab"]');
    for (const tab of tabs) {
      if ((tab.textContent || '').includes('Info')) {
        log('Clicking tab: ' + tab.textContent);
        tab.click();
        await sleep(500);
        return true;
      }
    }
    return false;
  }

  async function run() {
    chrome.runtime.sendMessage({ type: 'GIS_READY' });

    const job = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_JOB' }, resolve);
    });

    if (!job) {
      log('No active job');
      return;
    }

    log('GIS page loaded, job: ' + JSON.stringify({ egrid: job.egrid, address: job.address }));

    // Wait for page to fully render
    await sleep(3000);

    // If we have an address and need to search for it
    if (job.address && job.needsSearch) {
      const searched = await fillSearchAndSubmit(job.address);
      if (searched) {
        log('Waiting for search results...');
        await sleep(4000);
      }
    }

    // Wait a bit more for map to settle
    await sleep(2000);

    // Click the canvas to select the parcel
    const clicked = await clickCanvas();
    if (!clicked) {
      log('Failed to click canvas');
      return;
    }

    // Wait for info panel to appear
    log('Waiting for info panel...');

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await sleep(1500);

      // Try clicking portal link
      if (await findAndClickPortalLink()) {
        log('Portal link clicked!');
        return;
      }

      // Try clicking Info tab
      if (i === 3 || i === 8) {
        await clickInfoTab();
      }

      // Retry canvas click
      if (i === 6 || i === 15) {
        log('Retrying canvas click...');
        await clickCanvas();
      }

      attempts++;
    }

    log('Could not find portal link after ' + MAX_ATTEMPTS + ' attempts');
    // Send error back
    chrome.runtime.sendMessage({
      type: 'OWNER_DATA',
      owners: [],
      error: 'Portal-Link nicht gefunden'
    });
  }

  // Only run if we have an active job
  chrome.runtime.sendMessage({ type: 'GET_JOB' }, (job) => {
    if (job && (job.status === 'opening_gis' || job.status === 'clicking_parcel')) {
      run();
    }
  });
})();

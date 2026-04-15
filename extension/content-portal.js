// Content script for portal.objektwesen.zh.ch — handles SMS verification and owner data extraction

(function() {
  function log(msg) {
    console.log('[Akquise Portal]', msg);
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /**
   * Parse a raw owner string like:
   * "A. Bommer Immobilien AG, mit Sitz in Zürich, Aktiengesellschaft, Schweighofstrasse 409, 8055 Zürich, Schweiz, Alleineigentum"
   * Into structured { name, address, plz, ort, ownershipType }
   */
  function parseOwnerText(raw) {
    if (!raw) return { name: '', address: '', plz: '', ort: '', ownershipType: '' };

    // Split by comma
    const parts = raw.split(',').map(s => s.trim());

    let name = '';
    let streetAddress = '';
    let plzOrt = '';
    let ownershipType = '';
    const skipPhrases = ['mit sitz in', 'aktiengesellschaft', 'gesellschaft mit', 'schweiz', 'genossenschaft'];

    // Known ownership types
    const ownershipTypes = ['alleineigentum', 'miteigentum', 'stockwerkeigentum', 'gesamteigentum'];

    // First part is always the name
    name = parts[0] || '';

    for (let i = 1; i < parts.length; i++) {
      const p = parts[i];
      const pLower = p.toLowerCase();

      // Check ownership type
      if (ownershipTypes.some(t => pLower.includes(t))) {
        ownershipType = p;
        continue;
      }

      // Skip filler phrases
      if (skipPhrases.some(s => pLower.startsWith(s) || pLower === s)) {
        continue;
      }

      // Detect street address (contains a number)
      if (/\d/.test(p) && !streetAddress) {
        // Check if this is PLZ+Ort (4 digits + space + word)
        const plzMatch = p.match(/^(\d{4})\s+(.+)$/);
        if (plzMatch) {
          plzOrt = p;
        } else {
          streetAddress = p;
        }
        continue;
      }

      // Detect PLZ Ort pattern
      const plzCheck = p.match(/^(\d{4})\s+(.+)$/);
      if (plzCheck) {
        plzOrt = p;
        continue;
      }
    }

    // Parse PLZ and Ort from combined
    let plz = '';
    let ort = '';
    if (plzOrt) {
      const m = plzOrt.match(/^(\d{4})\s+(.+)$/);
      if (m) {
        plz = m[1];
        ort = m[2];
      }
    }

    return {
      name: name,
      address: streetAddress,
      plz: plz,
      ort: ort,
      ownershipType: ownershipType
    };
  }

  async function humanType(input, text) {
    input.focus();
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    for (const char of text) {
      await sleep(50 + Math.random() * 100);
      input.value += char;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function isSuccessPage() {
    // The success URL contains /success or shows owner data
    if (window.location.href.includes('/success')) return true;
    const body = document.body.innerText || '';
    if (body.includes('Eigentümerinnen und Eigentümer') || body.includes('Eigentümer')) {
      // Make sure we're past SMS verification
      if (!isPhoneInputPage() && !isCodeInputPage()) return true;
    }
    return false;
  }

  function isPhoneInputPage() {
    // Check for phone number input on the page
    const phoneInput = document.querySelector('input[type="tel"]') ||
                       document.querySelector('input[placeholder*="Mobil"]') ||
                       document.querySelector('input[placeholder*="Telefon"]');
    if (phoneInput && phoneInput.offsetParent !== null) return true;

    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = (btn.textContent || '').toLowerCase();
      if (text.includes('bestätigungscode') && text.includes('anfordern')) return true;
    }
    return false;
  }

  function isCodeInputPage() {
    const inputs = document.querySelectorAll('input');
    for (const input of inputs) {
      if (input.maxLength && input.maxLength <= 6 && input.maxLength >= 4) return true;
    }
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = (btn.textContent || '').toLowerCase();
      if ((text.includes('bestätigen') || text.includes('absenden')) &&
          !text.includes('bestätigungscode anfordern')) return true;
    }
    return false;
  }

  function extractOwners() {
    const owners = [];
    const body = document.body.innerText || '';

    // Strategy 1: Find the "Eigentümerinnen und Eigentümer" section
    const ownerSection = body.split(/Eigentümerinnen und Eigentümer|Grundeigentümer/i);
    if (ownerSection.length > 1) {
      // Take the text after the heading
      const afterHeading = ownerSection[1];
      // Split by newlines and filter meaningful lines
      const lines = afterHeading.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 5)
        .filter(l => !l.match(/^(E-GRID|Grundstücksnummer|Notariat|Grundstücksart|Verwaltungseinheit|BFS Nr)/i));

      // Each non-empty line after the heading that contains a name is an owner entry
      for (const line of lines) {
        // Stop at next section heading
        if (line.match(/^(Grundbuch|Bemerkung|Dienstbarkeit|Anmerkung|Pendente)/i)) break;

        // Skip very short or obviously non-owner lines
        if (line.length < 10) continue;

        // Parse this owner line
        const parsed = parseOwnerText(line);
        if (parsed.name) {
          owners.push(parsed);
        }
      }
    }

    // Strategy 2: Look for structured DOM elements
    if (owners.length === 0) {
      const elements = document.querySelectorAll('[class*="owner"], [class*="eigentum"], .detail-value, .attribute-value');
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 10) {
          const parsed = parseOwnerText(text);
          if (parsed.name) owners.push(parsed);
        }
      });
    }

    // Strategy 3: Find all text blocks that look like owner entries
    if (owners.length === 0) {
      const allText = document.querySelectorAll('p, li, dd, span.value, div.value');
      allText.forEach(el => {
        const text = (el.textContent || '').trim();
        // Owner entries typically contain: name + address + ownership type
        if (text.length > 20 && text.length < 500 &&
            (text.includes('eigentum') || text.includes('Eigentum') ||
             text.includes('Sitz in') || text.includes('sitz in'))) {
          const parsed = parseOwnerText(text);
          if (parsed.name) owners.push(parsed);
        }
      });
    }

    log('Extracted ' + owners.length + ' owners: ' + JSON.stringify(owners));
    return owners;
  }

  async function run() {
    chrome.runtime.sendMessage({ type: 'PORTAL_OPENED' });

    const job = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_JOB' }, resolve);
    });

    if (!job) {
      log('No active job');
      return;
    }

    log('Portal loaded. EGRID: ' + job.egrid + ', Phone: ' + job.phoneNumber);
    await sleep(2000);

    // Check if we're already on the success page (session still active)
    if (isSuccessPage()) {
      log('Success page detected! Extracting owners...');
      await sleep(1000);
      const owners = extractOwners();
      chrome.runtime.sendMessage({ type: 'OWNER_DATA', owners });
      return;
    }

    // Phone input page — enter phone number and request SMS code
    if (isPhoneInputPage()) {
      log('Phone input page detected');
      await sleep(500 + Math.random() * 500);

      const phoneInput = document.querySelector('input[type="tel"]') ||
                         document.querySelector('input[placeholder*="Mobil"]') ||
                         document.querySelector('input[placeholder*="Telefon"]') ||
                         document.querySelector('input:not([type="hidden"]):not([type="submit"])');

      if (phoneInput && job.phoneNumber) {
        log('Entering phone number: ' + job.phoneNumber);
        await humanType(phoneInput, job.phoneNumber);
        await sleep(500 + Math.random() * 300);

        // Click the "Bestätigungscode anfordern" button
        const buttons = document.querySelectorAll('button, input[type="submit"]');
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase();
          if (text.includes('bestätigungscode') || text.includes('anfordern') ||
              text.includes('code') || text.includes('senden')) {
            log('Clicking: ' + btn.textContent);
            btn.click();
            break;
          }
        }

        chrome.runtime.sendMessage({ type: 'SMS_WAITING' });
        log('SMS requested. Waiting for user to enter code or auto-redirect...');
      }

      // Now wait for the success page
      await waitForSuccess();
      return;
    }

    // Code input page (already past phone entry)
    if (isCodeInputPage()) {
      log('Code input page detected, waiting for user...');
      chrome.runtime.sendMessage({ type: 'SMS_WAITING' });
      await waitForSuccess();
      return;
    }

    // Unknown state — just poll
    log('Unknown page state, polling for success...');
    await waitForSuccess();
  }

  async function waitForSuccess() {
    // Poll for up to 4 minutes (user needs to enter SMS code)
    for (let i = 0; i < 120; i++) {
      await sleep(2000);

      if (isSuccessPage()) {
        log('Success page detected!');
        await sleep(1500);
        const owners = extractOwners();
        chrome.runtime.sendMessage({ type: 'OWNER_DATA', owners });
        return;
      }
    }

    log('Timeout waiting for success page');
    chrome.runtime.sendMessage({
      type: 'OWNER_DATA',
      owners: [],
      error: 'Timeout — SMS-Code nicht eingegeben'
    });
  }

  // Run immediately
  run();
})();

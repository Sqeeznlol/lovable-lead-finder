// Content script for portal.objektwesen.zh.ch — handles SMS verification and owner data extraction

(function() {
  function log(msg) {
    console.log('[Akquise Portal]', msg);
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
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

  function isLoginPage() {
    // Check if we see the phone number input (login/SMS page)
    const inputs = document.querySelectorAll('input');
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = (btn.textContent || '').toLowerCase();
      if (text.includes('bestätigungscode') || text.includes('anfordern') || text.includes('code')) {
        return true;
      }
    }
    // Check for any form with phone input
    const phoneInput = document.querySelector('input[type="tel"]') ||
                       document.querySelector('input[placeholder*="Telefon"]') ||
                       document.querySelector('input[placeholder*="Mobil"]');
    if (phoneInput) return true;
    return false;
  }

  function isCodePage() {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = (btn.textContent || '').toLowerCase();
      if ((text.includes('senden') || text.includes('bestätigen') || text.includes('absenden')) &&
          !text.includes('bestätigungscode anfordern')) {
        return true;
      }
    }
    // Also check for a short code input field
    const inputs = document.querySelectorAll('input');
    for (const input of inputs) {
      if (input.maxLength && input.maxLength <= 6 && input.maxLength >= 4) return true;
    }
    return false;
  }

  function isOwnerPage() {
    // Check for owner data on the page
    const body = document.body.innerText || '';
    // Look for common owner-related text patterns
    if (body.includes('Eigentümer') || body.includes('Grundeigentümer')) {
      // Make sure it's not just the login page mentioning it
      if (!isLoginPage() && !isCodePage()) return true;
    }
    return !!document.querySelector('.name-attribute') ||
           !!document.querySelector('.attribute-knot') ||
           !!document.querySelector('[class*="owner"]') ||
           !!document.querySelector('[class*="eigentum"]');
  }

  function extractOwners() {
    const owners = [];

    // Strategy 1: name-attribute spans
    const nameSpans = document.querySelectorAll('.name-attribute');
    if (nameSpans.length > 0) {
      nameSpans.forEach((span) => {
        const name = span.textContent?.trim() || '';
        // Try to find address near this name
        const parent = span.closest('.attribute-knot, .owner-entry, tr, li, div');
        const address = parent ?
          Array.from(parent.querySelectorAll('span, p, td'))
            .filter(el => el !== span)
            .map(el => el.textContent?.trim())
            .filter(t => t && t.length > 3 && t !== name)
            .join(', ') : '';
        if (name) owners.push({ name, address });
      });
    }

    // Strategy 2: look for structured owner sections
    if (owners.length === 0) {
      const sections = document.querySelectorAll('.ownership-section, .detail-section, [class*="owner"], [class*="eigentum"], .card, .panel');
      sections.forEach(section => {
        const headings = section.querySelectorAll('h2, h3, h4, strong, b');
        headings.forEach(h => {
          const text = h.textContent?.trim();
          if (text && text.length > 3 && text.length < 100) {
            owners.push({ name: text, address: '' });
          }
        });
      });
    }

    // Strategy 3: table-based layout
    if (owners.length === 0) {
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const label = (cells[0].textContent || '').trim().toLowerCase();
            if (label.includes('eigentümer') || label.includes('name') || label.includes('besitzer')) {
              const value = (cells[1].textContent || '').trim();
              if (value) owners.push({ name: value, address: '' });
            }
          }
        });
      });
    }

    // Strategy 4: fallback - any content in main area
    if (owners.length === 0) {
      const main = document.querySelector('main, .content, #content, article') || document.body;
      const paragraphs = main.querySelectorAll('p, div > span');
      const texts = [];
      paragraphs.forEach(p => {
        const text = p.textContent?.trim();
        if (text && text.length > 5 && text.length < 200 &&
            !text.includes('Bestätigungscode') && !text.includes('Telefonnummer')) {
          texts.push(text);
        }
      });
      if (texts.length > 0) {
        owners.push({ name: texts.slice(0, 3).join('; '), address: '' });
      }
    }

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

    log('Portal loaded, checking state...');
    await sleep(2000);

    // Case 1: Already logged in — owner data visible
    if (isOwnerPage()) {
      log('Already logged in! Extracting owners...');
      await sleep(1000);
      const owners = extractOwners();
      log('Extracted owners: ' + JSON.stringify(owners));
      chrome.runtime.sendMessage({ type: 'OWNER_DATA', owners });
      return;
    }

    // Case 2: Need to enter phone number
    if (isLoginPage()) {
      log('Login page detected, entering phone number...');
      await sleep(500 + Math.random() * 500);

      // Find the phone input - try multiple selectors
      const phoneInput = document.querySelector('input[type="tel"]') ||
                         document.querySelector('input[placeholder*="Telefon"]') ||
                         document.querySelector('input[placeholder*="Mobil"]') ||
                         document.querySelector('.form-field:nth-child(3) input') ||
                         document.querySelector('input:not([type="hidden"]):not([type="submit"])');

      if (phoneInput && job.phoneNumber) {
        await humanType(phoneInput, job.phoneNumber);
        await sleep(500 + Math.random() * 300);

        // Click submit button
        const buttons = document.querySelectorAll('button, input[type="submit"]');
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase();
          if (text.includes('bestätigungscode') || text.includes('anfordern') ||
              text.includes('code') || text.includes('senden')) {
            log('Clicking submit button: ' + text);
            btn.click();
            break;
          }
        }

        chrome.runtime.sendMessage({ type: 'SMS_WAITING' });
        log('Waiting for SMS code entry...');
        await waitForOwnerData();
      }
      return;
    }

    // Case 3: Code entry page
    if (isCodePage()) {
      chrome.runtime.sendMessage({ type: 'SMS_WAITING' });
      log('Code page already showing, waiting for user input...');
      await waitForOwnerData();
      return;
    }

    log('Unknown page state, polling...');
    for (let i = 0; i < 60; i++) {
      await sleep(2000);
      if (isOwnerPage()) {
        const owners = extractOwners();
        chrome.runtime.sendMessage({ type: 'OWNER_DATA', owners });
        return;
      }
      if (isLoginPage() || isCodePage()) {
        await run();
        return;
      }
    }
  }

  async function waitForOwnerData() {
    for (let i = 0; i < 120; i++) {
      await sleep(2000);

      if (isOwnerPage()) {
        log('Owner data appeared!');
        await sleep(1500);
        const owners = extractOwners();
        log('Extracted owners: ' + JSON.stringify(owners));
        chrome.runtime.sendMessage({ type: 'OWNER_DATA', owners });
        return;
      }
    }
    log('Timeout waiting for owner data');
    chrome.runtime.sendMessage({ type: 'OWNER_DATA', owners: [], error: 'Timeout' });
  }

  run();
})();

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
    const sendBtn = document.querySelector('button');
    return inputs.length > 0 && sendBtn &&
           (sendBtn.textContent?.includes('Bestätigungscode') ||
            sendBtn.textContent?.includes('anfordern'));
  }

  function isCodePage() {
    // Check if we're on the SMS code entry page
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent?.includes('Senden') && !btn.textContent?.includes('Bestätigungscode')) {
        return true;
      }
    }
    return false;
  }

  function isOwnerPage() {
    // Check if owner data is visible
    return !!document.querySelector('.name-attribute') ||
           !!document.querySelector('.attribute-knot');
  }

  function extractOwners() {
    const owners = [];

    // Try extracting from name-attribute spans
    const nameSpans = document.querySelectorAll('.name-attribute');
    const addressSpans = document.querySelectorAll('.attribute-knot > span:nth-child(2)');

    if (nameSpans.length > 0) {
      nameSpans.forEach((span, i) => {
        const name = span.textContent?.trim() || '';
        const address = addressSpans[i]?.textContent?.trim() || '';
        if (name) {
          owners.push({ name, address });
        }
      });
    }

    // Fallback: try to get all text from the ownership section
    if (owners.length === 0) {
      const sections = document.querySelectorAll('.ownership-section, .detail-section, [class*="owner"], [class*="eigentum"]');
      sections.forEach(section => {
        const text = section.textContent?.trim();
        if (text && text.length > 3) {
          owners.push({ name: text, address: '' });
        }
      });
    }

    // Fallback 2: get any p tags with spans inside the main content
    if (owners.length === 0) {
      const paragraphs = document.querySelectorAll('p');
      paragraphs.forEach(p => {
        const spans = p.querySelectorAll('span');
        if (spans.length >= 1) {
          const text = Array.from(spans).map(s => s.textContent?.trim()).filter(Boolean).join(', ');
          if (text.length > 3) {
            owners.push({ name: text, address: '' });
          }
        }
      });
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

      // Find the phone input
      const phoneInput = document.querySelector('.form-field:nth-child(3) input') ||
                         document.querySelector('input[type="tel"]') ||
                         document.querySelector('input');

      if (phoneInput && job.phoneNumber) {
        await humanType(phoneInput, job.phoneNumber);
        await sleep(500 + Math.random() * 300);

        // Click "Bestätigungscode anfordern"
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent?.includes('Bestätigungscode') || btn.textContent?.includes('anfordern')) {
            log('Clicking "Bestätigungscode anfordern"');
            btn.click();
            break;
          }
        }

        // Now wait for SMS code — user enters this manually
        chrome.runtime.sendMessage({ type: 'SMS_WAITING' });
        log('Waiting for SMS code entry...');

        // Poll for either: code page visible, or owner data visible
        await waitForCodeAndSubmit();
      }
      return;
    }

    // Case 3: Code entry page is already showing
    if (isCodePage()) {
      chrome.runtime.sendMessage({ type: 'SMS_WAITING' });
      log('Code page already showing, waiting for user input...');
      await waitForCodeAndSubmit();
      return;
    }

    log('Unknown page state, waiting...');
    // Keep polling
    for (let i = 0; i < 60; i++) {
      await sleep(2000);
      if (isOwnerPage()) {
        const owners = extractOwners();
        chrome.runtime.sendMessage({ type: 'OWNER_DATA', owners });
        return;
      }
      if (isLoginPage() || isCodePage()) {
        // Re-run the flow
        await run();
        return;
      }
    }
  }

  async function waitForCodeAndSubmit() {
    // Wait for user to enter SMS code and click Senden
    // OR wait for owner data to appear (if session was already valid)
    for (let i = 0; i < 120; i++) {
      await sleep(2000);

      // Check if owner data appeared (user manually submitted or session resumed)
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
  }

  run();
})();

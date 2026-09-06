// map.geo.tg.ch — die Eigentumsauskunft des Thurgaus
//
// Gebaut gegen den wirklichen Aufbau, nicht gegen eine Vermutung. So
// sieht die Auskunft aus (Liegenschaft 447, Diessenhofen):
//
//   <div class="gb-auszug">
//     <h3 class="eigentuemer">Eigentümerinformationen</h3>
//     <div class="eigentum">
//       <p><strong>Rudolf Gubler, </strong> Grabenstrasse 12,
//          8253 Diessenhofen, 1/1</p>
//     </div>
//     <div><strong>Grundstück:</strong> Liegenschaft Nr. 447
//          ( CH627728290920 )</div>
//     …
//
// Der Ablauf, ebenfalls beobachtet: der Link mit swisssearch zoomt
// nicht selbst, er öffnet ein Vorschlagsfeld -- der erste Vorschlag
// muss angeklickt werden. Danach ein Klick auf die Parzelle, und das
// Fenster "Objekt-Information" fragt nach der Mobilnummer (Feld
// #gb_sms, Knopf "Code anfordern"). Den Code tippt ein Mensch.

(function () {
  const log = m => console.log('[Akquise TG]', m);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /** Der Kasten mit dem Auszug, sobald er da ist. */
  const auszug = () => document.querySelector('.gb-auszug');

  /**
   * Die Eigentümer aus dem Auszug.
   *
   * Sie stehen in "div.eigentum" als Fliesstext: der Name fett, danach
   * Adresse und Anteil. Fehlt die Klasse einmal, tut es der Absatz
   * unter der Überschrift "Eigentümerinformationen" auch.
   */
  function eigentuemer() {
    const kasten = auszug();
    if (!kasten) return [];
    let absaetze = [...kasten.querySelectorAll('.eigentum p')];
    if (absaetze.length === 0) {
      absaetze = [...kasten.querySelectorAll('p')].filter(
        p => /\d{4}\s+\S/.test(p.innerText || ''));
    }
    return absaetze.map(p => {
      const roh = (p.innerText || '').replace(/\s+/g, ' ').trim();
      const teile = roh.split(',').map(t => t.trim()).filter(Boolean);
      // Der Anteil ("1/1") gehoert nicht in den Namen, mit dem
      // telefoniert wird.
      const name = (teile[0] || '').replace(/\s+\d+\/\d+\s*$/, '').trim();
      const plzOrt = teile.find(t => /^\d{4}\s+\S/.test(t)) || '';
      const strasse = teile.slice(1).find(
        t => /\d/.test(t) && !/^\d{4}\s/.test(t) && !/^\d+\/\d+$/.test(t)) || '';
      const m = plzOrt.match(/^(\d{4})\s+(.+)$/);
      return {
        name,
        address: strasse,
        plz: m ? m[1] : '',
        ort: m ? m[2] : '',
        ownershipType: teile.find(t => /^\d+\/\d+$/.test(t)) || '',
      };
    }).filter(o => o.name);
  }

  /**
   * Die EGRID, die der Auszug selbst nennt.
   *
   * Sie muss geprüft werden: gesucht wurde CH770977292983, die
   * Auskunft nannte CH627728290920 -- ein anderes Grundstück. Wer das
   * nicht prüft, speichert den Eigentümer des Nachbarn.
   */
  function egridImAuszug() {
    const kasten = auszug();
    const text = kasten ? (kasten.innerText || '') : '';
    const m = text.match(/\bCH\d{12}\b/);
    return m ? m[0] : '';
  }

  /**
   * Den richtigen Vorschlag im Suchfeld anklicken.
   *
   * Der Link mit swisssearch zoomt nicht selbst -- er öffnet ein
   * Vorschlagsfeld mit zwei Einträgen:
   *
   *     EGRID CH770977292983 (Gde. Diessenhofen)
   *     Projektierter EGRID CH770977292983 (Gde. Diessenhofen)
   *
   * Gemeint ist der erste. Der zweite ist ein geplanter Stand und
   * gehört einem Grundstück, das es so noch nicht gibt.
   *
   * Gesucht wird über den Text, nicht über Klassennamen: der Text
   * steht fest, die Klassen ändern sich mit jeder neuen Fassung der
   * Karte.
   */
  function vorschlagKlicken(egrid) {
    if (!egrid) return false;
    const kandidaten = [...document.querySelectorAll(
      'li, a, div[role="option"], .ga-search-result, .tt-suggestion')];
    const treffer = kandidaten.find(el => {
      const t = (el.innerText || '').trim();
      return t.includes(egrid) && !/^projektiert/i.test(t);
    });
    if (!treffer) return false;
    treffer.click();
    log('Vorschlag angeklickt');
    return true;
  }

  /**
   * In die Mitte der Karte klicken.
   *
   * Nach dem Zoom liegt die gesuchte Parzelle dort -- die Karte
   * zentriert auf das, was sie gefunden hat. Ein Klick darauf öffnet
   * die Objekt-Information.
   *
   * Das ist der einzige Teil, den ich von hier aus nicht prüfen kann:
   * ob die Karte den Klick eines Skripts annimmt, zeigt erst der
   * Versuch. Nimmt sie ihn nicht an, bleibt der Balken -- dann klickt
   * ein Mensch, und es geht trotzdem weiter.
   */
  function karteAnklicken() {
    const karte = document.querySelector(
      '.ol-viewport, canvas, #map, .ga-map');
    if (!karte) return false;
    const r = karte.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    for (const art of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      karte.dispatchEvent(new MouseEvent(art, {
        bubbles: true, cancelable: true, clientX: x, clientY: y,
        view: window, button: 0,
      }));
    }
    log('in die Karte geklickt');
    return true;
  }

  async function job() {
    return new Promise(r => chrome.runtime.sendMessage({ type: 'GET_JOB' }, r));
  }

  async function ablauf() {
    chrome.runtime.sendMessage({ type: 'PORTAL_OPENED' });
    const auftrag = await job();

    // Der Balken ist immer da: er ist der Weg, wenn die Automatik an
    // einer geänderten Seite scheitert.
    const melde = window.akquiseBalken?.(
      'Bauraum — die Parzelle wird gesucht und angeklickt. Geht das '
      + 'Fenster nicht auf: Parzelle anklicken, dann übernehmen.');

    if (!auftrag) { log('kein Auftrag'); return; }

    // Erst den Vorschlag anklicken, damit die Karte auf die Parzelle
    // zoomt. Das Feld braucht einen Moment, bis es die Vorschläge hat.
    let gezoomt = false;
    for (let i = 0; i < 20 && !gezoomt; i++) {
      gezoomt = vorschlagKlicken(auftrag.egrid);
      if (!gezoomt) await sleep(500);
    }
    if (gezoomt) {
      // Der Zoom braucht seine Zeit; erst danach liegt die Parzelle
      // in der Mitte.
      await sleep(2500);
      karteAnklicken();
    } else {
      log('kein Vorschlag gefunden -- Parzelle von Hand anklicken');
    }

    // Mobilnummer eintragen, sobald das Feld da ist.
    for (let i = 0; i < 240 && !auszug(); i++) {
      const feld = document.querySelector('#gb_sms');
      if (feld && !feld.value && auftrag.phoneNumber) {
        feld.value = auftrag.phoneNumber;
        feld.dispatchEvent(new Event('input', { bubbles: true }));
        feld.dispatchEvent(new Event('change', { bubbles: true }));
        log('Nummer eingetragen');
        const knopf = [...document.querySelectorAll('button, a, input[type="submit"]')]
          .find(b => /code\s*anfordern/i.test(b.textContent || b.value || ''));
        if (knopf) { knopf.click(); log('Code angefordert'); }
      }
      await sleep(1000);
    }

    if (!auszug()) {
      log('kein Auszug erschienen');
      return;
    }

    await sleep(500);
    const owners = eigentuemer();
    const gefunden = egridImAuszug();

    // Eine Auskunft zum falschen Grundstück ist schlimmer als keine:
    // sie sieht richtig aus. Dann lieber der Mensch.
    if (auftrag.egrid && gefunden && gefunden !== auftrag.egrid) {
      log(`EGRID weicht ab: erwartet ${auftrag.egrid}, gefunden ${gefunden}`);
      melde?.();
      chrome.runtime.sendMessage({
        type: 'OWNER_DATA',
        owners: [],
        error: `Der Auszug gehört zu ${gefunden}, gesucht war `
          + `${auftrag.egrid}. Bitte im Fenster prüfen und von Hand übernehmen.`,
      });
      return;
    }

    if (owners.length === 0) {
      log('keine Eigentümer erkannt');
      return;   // der Balken bleibt -- ein Klick übernimmt von Hand
    }

    chrome.runtime.sendMessage({
      type: 'OWNER_DATA',
      owners,
      roh: (auszug().innerText || ''),
    });
    log(owners);
  }

  if (document.body) ablauf();
  else document.addEventListener('DOMContentLoaded', ablauf);
})();

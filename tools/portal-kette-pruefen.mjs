/**
 * Was beim Klick auf "Abfragen" im Portal wirklich passiert.
 *
 * Gegen das echte ThurGIS laesst sich das von hier nicht pruefen -- es
 * gibt keine Verbindung dorthin, und eine Probeabfrage waere eine
 * echte. Gemessen wird deshalb das Skript, das die Erweiterung ins
 * Portal schickt (extension/content-thurgau.js), gegen eine Seite mit
 * denselben Merkmalen: Karte als ".ol-viewport", das Fenster
 * "Objekt-Information" erscheint erst nach dem Klick, und der Auszug
 * steht im Wortlaut des Thurgaus.
 *
 * Protokolliert wird jeder Schritt -- genau der Ablauf, der
 * automatisiert werden soll.
 *
 * Aufruf: node tools/portal-kette-pruefen.mjs
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const skript = readFileSync('extension/content-thurgau.js', 'utf8');

const AUFTRAG = { egrid: 'CH627728290920', parzelle: '447', phoneNumber: '' };

const portalSeite = `<!doctype html><meta charset="utf-8">
<title>ThurGIS (nachgebaut)</title>
<input id="suche" type="text" style="width:420px;height:26px" value="CH627728290920">
<ul id="treffer">
  <li>Projektierter Bestand CH627728290920 (Gde. Diessenhofen)</li>
  <li id="echt">CH627728290920 (Gde. Diessenhofen)</li>
</ul>
<div id="map" class="ol-viewport" style="width:600px;height:360px;background:#eef"></div>
<div id="info"></div>
<script>
// Die Karte steht schon auf der Parzelle (E/N in der Adresse). Ein
// Klick oeffnet das Fenster "Objekt-Information" -- mit Verzoegerung,
// wie im Portal.
document.getElementById('map').addEventListener('click', () => {
  setTimeout(() => {
    document.getElementById('info').innerText =
      'Objekt-Information\\nGrundbuch-Auszug\\nEigentümerinformationen\\n'
      + 'Rudolf Gubler,  Grabenstrasse 12, 8253 Diessenhofen, 1/1\\n'
      + 'Zusätzliche Informationen\\nGrundbuch: Nr. 4545 Diessenhofen\\n'
      + 'Grundstück: Liegenschaft Nr. 447 ( CH627728290920 )\\nDisclaimer';
  }, 900);
});
</script>`;

const server = createServer((q, a) => {
  a.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  a.end(portalSeite);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const basis = `http://127.0.0.1:${server.address().port}`;

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const seite = await b.newPage();

const protokoll = [];
seite.on('console', m => {
  const t = m.text();
  if (t.includes('[Akquise TG]')) protokoll.push(t);
});

// Die Adresse mit Koordinaten, so wie die Anwendung sie jetzt baut.
await seite.goto(`${basis}/?E=2698377.50&N=1282652.13&crosshair=marker`);

// chrome.runtime nachbilden: das Skript fragt den Auftrag ab und
// meldet das Ergebnis zurueck.
const gemeldet = [];
await seite.exposeFunction('_melde', d => { gemeldet.push(d); });
await seite.evaluate(auftrag => {
  window.chrome = {
    runtime: {
      sendMessage: (msg, antwort) => {
        if (msg.type === 'GET_JOB') { antwort && antwort(auftrag); return; }
        window._melde(msg);
      },
    },
    storage: { local: { get: (k, cb) => cb({ reihe: [] }) } },
  };
}, AUFTRAG);

await seite.evaluate(s => { (0, eval)(s); }, skript);

// Bis zu 60 Sekunden auf die Rueckmeldung warten.
const bis = Date.now() + 60000;
while (Date.now() < bis && !gemeldet.some(g => g.type === 'OWNER_DATA')) {
  await seite.waitForTimeout(500);
}

console.log('--- Was das Skript getan hat:');
for (const z of protokoll) console.log('   ', z);
console.log('--- Was es zurueckgemeldet hat:');
for (const g of gemeldet) {
  if (g.type === 'OWNER_DATA') {
    console.log('    OWNER_DATA  egrid:', g.egrid, '| parzelle:', g.parzelle,
                '| Eigentuemer:', JSON.stringify(g.owners), '| Fehler:', g.error || 'keiner');
  } else {
    console.log('   ', g.type);
  }
}
await b.close();
server.close();

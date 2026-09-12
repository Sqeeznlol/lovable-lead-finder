import { describe, it, expect, vi } from 'vitest';
import { lesezeichenCode } from '../lesezeichen';

/**
 * Das Lesezeichen wird als Text erzeugt und läuft später in einem
 * fremden Browser. Wenn dort etwas nicht stimmt, merkt es niemand --
 * es tut dann einfach nichts. Deshalb wird es hier ausgeführt.
 */
function ausfuehren(seitentext: string) {
  document.body.innerHTML = '';
  Object.defineProperty(document.body, 'innerText', {
    value: seitentext, configurable: true,
  });
  vi.useFakeTimers();
  const geoeffnet: string[] = [];
  const namen: string[] = [];
  const alt = window.open;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nachrichten: unknown[] = [];
  (window as any).open = (u: string, n: string) => {
    geoeffnet.push(u); namen.push(n);
    // Eine Attrappe der Anwendung: das Lesezeichen schickt ihr den
    // Auszug anschliessend als Nachricht, und hier wird gezaehlt, ob
    // das auch geschieht.
    return { focus() {}, postMessage(d: unknown) { nachrichten.push(d); } };
  };
  // Das Lesezeichen schliesst am Ende seinen eigenen Tab. In jsdom
  // wuerde das Dokument dabei verschwinden und jeder weitere Test
  // scheitern -- hier wird nur festgehalten, dass es versucht wurde.
  let geschlossen = 0;
  const altClose = window.close;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).close = () => { geschlossen += 1; };
  const gewarnt: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).alert = (m: string) => { gewarnt.push(m); };

  const code = decodeURIComponent(
    lesezeichenCode('https://www.wohntraums.life').replace(/^javascript:/, ''));
  // eslint-disable-next-line no-eval
  (0, eval)(code);

  // Ohne Auszug wartet es auf die Karte -- die Uhr vorstellen, damit
  // der Test nicht dreissig Sekunden dasteht.
  vi.advanceTimersByTime(40_000);
  vi.useRealTimers();
  window.open = alt;
  window.close = altClose;
  const daten = geoeffnet.length
    ? JSON.parse(decodeURIComponent(geoeffnet[0].split('#auskunft=')[1]))
    : null;
  return { daten, gewarnt, namen, geschlossen, nachrichten };
}

describe('lesezeichenCode', () => {
  it('liest den Thurgauer Auszug von der Seite', () => {
    // Wortlaut aus ThurGIS, Liegenschaft 669 Diessenhofen.
    const { daten } = ausfuehren(`Objekt-Information
Grundbuch-Auszug
Eigentümerinformationen
Simon Gränicher,  Widacherring 10, 6102 Malters, 1/1
Zusätzliche Informationen
Grundbuch: Nr. 4545 Diessenhofen
Grundstück: Liegenschaft Nr. 669 ( CH932977092161 )`);

    expect(daten).not.toBeNull();
    expect(daten.egrid).toBe('CH932977092161');
    expect(daten.parzelle).toBe('669');
    // Die Überschrift gehört nicht in den Block, die Zusatzangaben
    // erst recht nicht -- sie tragen Postleitzahlen und sähen sonst
    // wie weitere Eigentümer aus.
    expect(daten.text).toBe('Simon Gränicher,  Widacherring 10, 6102 Malters, 1/1');
  });

  it('öffnet die Anwendung immer im selben Tab', () => {
    // Sonst steht nach zehn Abfragen die Leiste voll und niemand
    // weiss mehr, welcher Tab welcher ist.
    const { namen } = ausfuehren(`Eigentümerinformationen
Simon Gränicher,  Widacherring 10, 6102 Malters, 1/1
Zusätzliche Informationen
Grundstück: Liegenschaft Nr. 669 ( CH932977092161 )`);
    expect(namen).toEqual(['bauraum-app']);
  });

  it('sagt es im Balken, wenn nichts erscheint', () => {
    // Ohne Auszug versucht es die Parzelle selbst auszuwählen. Kommt
    // nichts, steht das im Balken -- kein stiller Fehlschlag.
    const { daten } = ausfuehren('Irgendeine Seite ohne Auszug.');
    expect(daten).toBeNull();
    expect(document.getElementById('bauraum-hinweis')?.textContent)
      .toContain('kein Auszug erschienen');
  });

  it('trägt nichts an den Server -- alles steht hinter der Raute', () => {
    const roh = lesezeichenCode('https://www.wohntraums.life');
    expect(roh.startsWith('javascript:')).toBe(true);
    expect(decodeURIComponent(roh)).toContain('/#auskunft=');
    // Kein Schlüssel im Lesezeichen: gespeichert wird mit der
    // angemeldeten Sitzung auf der Seite.
    expect(roh.toLowerCase()).not.toContain('apikey');
    expect(roh).not.toContain('eyJ');
  });
});

describe('Nach dem Senden', () => {
  it('schickt den Auszug auch als Nachricht -- daran haengt der Weg zurueck', () => {
    const { daten, nachrichten } = ausfuehren(
      'Grundbuch-Auszug\nEigentümerinformationen\n'
      + 'Cetin Demirciler, Landenbergerstrasse 1, 8253 Diessenhofen, 1/1\n'
      + 'Zusätzliche Informationen\nGrundstück: Liegenschaft Nr. 540 ( CH610929297717 )');
    expect(daten?.egrid).toBe('CH610929297717');
    // An der Nachricht haengt die Absenderkennung; ueber sie schickt
    // die Anwendung diesen Tag zur naechsten Parzelle.
    const erste = nachrichten[0] as { bauraum?: string; daten?: { egrid?: string } };
    expect(erste?.bauraum).toBe('auskunft');
    expect(erste?.daten?.egrid).toBe('CH610929297717');
  });
});

describe('Die Nummer des Grundstuecks', () => {
  // Der Fall, der Rudolf Gubler bei der Alten Basadingerstrasse 3
  // hat landen lassen: oben auf der Seite steht noch die Nummer der
  // zuvor angezeigten Parzelle.
  const seite = 'CH770977292983 (Gde. Diessenhofen)\n'
    + 'Grundbuch-Auszug\nEigentümerinformationen\n'
    + 'Rudolf Gubler, Grabenstrasse 12, 8253 Diessenhofen, 1/1\n'
    + 'Zusätzliche Informationen\nGrundbuch: Nr. 4545 Diessenhofen\n'
    + 'Grundstück: Liegenschaft Nr. 447 ( CH627728290920 )\nDisclaimer';

  it('nimmt die aus dem Auszug, nicht die erste auf der Seite', () => {
    const { daten } = ausfuehren(seite);
    expect(daten?.egrid).toBe('CH627728290920');
    expect(daten?.parzelle).toBe('447');
  });

  it('schickt gar nichts, wenn zwei Nummern im Auszug stehen', () => {
    // Zwei verschiedene Nummern und keine Zeile, die eine davon der
    // Parzelle zuordnet: dann ist jede Wahl geraten.
    const { daten, namen } = ausfuehren(
      'Eigentümerinformationen\n'
      + 'Rudolf Gubler, Grabenstrasse 12, 8253 Diessenhofen, 1/1\n'
      + 'Zusätzliche Informationen\nCH770977292983\nCH627728290920\nDisclaimer');
    expect(daten).toBeNull();
    expect(namen).toEqual([]);
    expect(document.getElementById('bauraum-hinweis')?.textContent)
      .toContain('nicht eindeutig');
  });
});

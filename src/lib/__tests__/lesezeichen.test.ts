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
  const geoeffnet: string[] = [];
  const alt = window.open;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).open = (u: string) => { geoeffnet.push(u); return null; };
  const gewarnt: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).alert = (m: string) => { gewarnt.push(m); };

  const code = decodeURIComponent(
    lesezeichenCode('https://www.wohntraums.life').replace(/^javascript:/, ''));
  // eslint-disable-next-line no-eval
  (0, eval)(code);

  window.open = alt;
  const daten = geoeffnet.length
    ? JSON.parse(decodeURIComponent(geoeffnet[0].split('#auskunft=')[1]))
    : null;
  return { daten, gewarnt };
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

  it('sagt es, wenn nichts dasteht', () => {
    const { daten, gewarnt } = ausfuehren('Irgendeine Seite ohne Auszug.');
    expect(daten).toBeNull();
    expect(gewarnt[0]).toContain('keine Eigentümer gefunden');
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

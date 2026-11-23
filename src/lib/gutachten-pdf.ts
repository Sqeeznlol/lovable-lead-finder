/**
 * Den Text eines Gutachtens aus dem PDF lesen, im Browser (23. November,
 * Julian: «Wenn wir Daten haben wie hier anbei ... bitte hochladen bzw.
 * extrahieren»). Die Datei verlässt das Gerät nicht: ein Gutachten nennt
 * Eigentümer und Auftraggeber, und die gehören nicht auf einen Server.
 *
 * pdf.js liefert Textstücke mit ihrer Lage; daraus werden Zeilen wie im
 * Dokument: gleiche Grundlinie, von links nach rechts, mit grossem
 * Abstand zwei Leerzeichen dazwischen (so trennt der Leser Bezeichnung
 * und Wert, «Marktwert  Fr. 2'150'000»).
 */
type Stueck = { str: string; transform: number[]; width: number };
type Seite = { getTextContent: () => Promise<{ items: unknown[] }> };
export type PdfJs = {
  getDocument: (o: { data: Uint8Array; isEvalSupported?: boolean }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<Seite> }> };
};

export function zeilenAusStuecken(stuecke: Stueck[]): string[] {
  const zeilen: { y: number; teile: Stueck[] }[] = [];
  for (const s of stuecke) {
    if (!s.str) continue;
    const y = s.transform[5];
    const z = zeilen.find(x => Math.abs(x.y - y) < 2);
    if (z) z.teile.push(s); else zeilen.push({ y, teile: [s] });
  }
  return zeilen.sort((a, b) => b.y - a.y).map(z => {
    const teile = z.teile.sort((a, b) => a.transform[4] - b.transform[4]);
    let text = '', ende: number | null = null;
    for (const t of teile) {
      const x = t.transform[4];
      if (ende != null) {
        const luecke = x - ende;
        if (luecke > 8) text += '  ';
        else if (luecke > 1 && !/\s$/.test(text) && !/^\s/.test(t.str)) text += ' ';
      }
      text += t.str;
      ende = x + t.width;
    }
    return text.replace(/\s+$/, '');
  }).filter(z => z.trim());
}

export async function pdfText(daten: ArrayBuffer, pdfjs: PdfJs): Promise<string> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(daten), isEvalSupported: false }).promise;
  const seiten: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const inhalt = await (await doc.getPage(n)).getTextContent();
    seiten.push(zeilenAusStuecken(inhalt.items as Stueck[]).join('\n'));
  }
  return seiten.join('\n');
}

/** Im Browser: pdf.js wird erst beim Hochladen geladen, nicht mit der Seite. */
export async function gutachtenText(datei: File): Promise<string> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfText(await datei.arrayBuffer(), pdfjs as unknown as PdfJs);
}

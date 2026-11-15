/**
 * Machbarkeitsstudie: was sich auf einer Parzelle bauen lässt, und was
 * das wert ist.
 *
 * Julian, 15. November: "eine Machbarkeitsstudie mit Aurora, aber
 * richtig gute, die realistisch sind". Realistisch wird sie nicht durch
 * eine feinere Rechnung, sondern dadurch, dass jede Zahl sagt, woher
 * sie stammt:
 *
 *   amtlich    aus der Amtlichen Vermessung, dem Zonenplan des Kantons
 *              oder dem Gebäuderegister -- so steht es beim Amt
 *   berechnet  aus amtlichen Zahlen gerechnet, ohne eigene Annahme
 *   annahme    ein Erfahrungswert, den man ändern kann und im Einzelfall
 *              prüfen muss (Grenzabstand, Baukosten, Erlös)
 *
 * Zwei Grenzen bestimmen, wie viel gebaut werden darf, und die engere
 * gilt:
 *
 *   die Ziffer   Ausnützungs- oder Baumassenziffer mal Grundstücksfläche
 *   die Hülle    die bebaubare Grundfläche (Umriss minus Grenzabstand,
 *                höchstens die Überbauungsziffer) mal die erlaubten
 *                Vollgeschosse
 *
 * Wer nur die Ziffer rechnet, verspricht auf einem schmalen Grundstück
 * Flächen, die zwischen den Abständen keinen Platz haben. Darum beide.
 *
 * Diese Datei rechnet nur; geholt wird in machbarkeit-daten.ts.
 */

export type Art = 'amtlich' | 'berechnet' | 'annahme';

/** Was die Zone erlaubt. Leere Felder heissen: die Zone regelt es nicht über diese Zahl. */
export interface ZonenRegeln {
  bezeichnung: string | null;
  abkuerzung: string | null;
  gemeinde: string | null;
  az: number | null;
  bmz: number | null;
  uez: number | null;
  vollgeschosse: number | null;
  dachgeschosse: number | null;
  untergeschosse: number | null;
  /** Die strengste der Höhenangaben der Zone, in Metern, mit ihrem Namen. */
  hoehe: number | null;
  hoeheArt: string | null;
  wohnanteilMin: number | null;
  rechtsstatus: string | null;
  dokument: string | null;
  /** kanton: Zonenplan des Kantons (amtlich). bestand: aus der eigenen Liste, ohne Gewähr. */
  quelle: 'kanton' | 'bestand';
}

export interface Gebaeude { grundflaeche: number | null; geschosse: number | null; baujahr: number | null; wohnungen: number | null }

export interface Annahmen {
  /** Abstand zur Grenze rundum, Meter. Steht nur in der Bauordnung der Gemeinde. */
  grenzabstand: number;
  /** Mittlere Geschosshöhe, Meter -- rechnet Baumasse in Geschossfläche um. */
  geschosshoehe: number;
  /** Anteil Hauptnutzfläche an der Geschossfläche. */
  hnfFaktor: number;
  /** Ein Dach- oder Attikageschoss bringt diesen Anteil eines Vollgeschosses. */
  dachFaktor: number;
  /** Erstellungskosten je m² Geschossfläche, CHF. */
  baukosten: number;
  /** Abbruch je m² bestehender Geschossfläche, CHF. */
  abbruch: number;
  /** Erlös je m² Hauptnutzfläche, CHF. */
  erloes: number;
  /** Mittlere Wohnungsgrösse, m² Hauptnutzfläche. */
  wohnungM2: number;
  /** Was ein Entwickler vom Erlös als Marge erwartet (0 bis 1). */
  marge: number;
}

export const ANNAHMEN: Annahmen = {
  grenzabstand: 5, geschosshoehe: 3.2, hnfFaktor: 0.77, dachFaktor: 0.66,
  baukosten: 3200, abbruch: 250, erloes: 9500, wohnungM2: 90, marge: 0.15,
};

export interface Eingabe {
  /** Grundstücksfläche laut Amtlicher Vermessung, m². */
  flaeche: number | null;
  /** Anteil in der Bauzone, wenn bekannt und kleiner als die Fläche. */
  bauzoneM2?: number | null;
  /** Umriss minus Grenzabstand, m² (aus der Datenbank gerechnet). Null: kein Umriss. */
  bebaubarM2: number | null;
  zone: ZonenRegeln | null;
  gebaeude: Gebaeude[];
  annahmen: Annahmen;
}

export interface Posten { titel: string; wert: string; art: Art; quelle: string }
export interface Variante {
  titel: string; text: string;
  gf: number; hnf: number; wohnungen: number;
  kosten: number; erloes: number;
  /** Ersatzneubau: was für das Land bleibt. Erweiterung: was nach Kosten bleibt. */
  ergebnis: number; ergebnisTitel: string;
  /** Nur Ersatzneubau: Landwert je m² Grundstück. */
  jeM2?: number;
}

export interface Studie {
  rechenbar: boolean;
  /** Warum nicht, in einem Satz. */
  grund?: string;
  flaeche: number;
  ziffer: 'AZ' | 'BMZ' | null;
  gfNachZiffer: number | null;
  grundflaecheMax: number | null;
  gfNachHuelle: number | null;
  /** Welche Grenze gilt. */
  begrenzt: 'ziffer' | 'huelle' | null;
  gfVoll: number;
  gfDach: number;
  gfNeu: number;
  hnfNeu: number;
  gfBestand: number | null;
  reserve: number | null;
  /** Bestand geteilt durch das Mögliche, 0 bis 1 und darüber. */
  ausgenuetzt: number | null;
  wohnungen: number;
  varianten: Variante[];
  abschnitte: { titel: string; zeilen: Posten[] }[];
  /** Was eine Fachperson noch ansehen muss, bevor die Zahl hält. */
  pruefen: string[];
}

const de = (n: number, stellen = 0) => n.toLocaleString('de-CH', { maximumFractionDigits: stellen, minimumFractionDigits: 0 });
export const m2 = (n: number) => `${de(Math.round(n))} m²`;
export const chf = (n: number) => (Math.abs(n) >= 1e6 ? `CHF ${de(n / 1e6, 2)} Mio.` : `CHF ${de(Math.round(n / 1000) * 1000)}`);
const pos = (v: number | null | undefined): number | null => (v != null && Number.isFinite(v) && v > 0 ? v : null);

/** Geschossfläche des Bestands: Grundfläche mal Geschosse je Gebäude. Null, wenn nichts davon bekannt ist. */
export function bestandGf(gebaeude: Gebaeude[]): number | null {
  const mit = gebaeude.filter(g => pos(g.grundflaeche) && pos(g.geschosse));
  if (!mit.length) return null;
  return mit.reduce((s, g) => s + g.grundflaeche! * g.geschosse!, 0);
}

export function studieRechnen(e: Eingabe): Studie {
  const a = e.annahmen;
  const flaeche = pos(e.flaeche) ?? 0;
  const leer = (grund: string): Studie => ({
    rechenbar: false, grund, flaeche, ziffer: null, gfNachZiffer: null, grundflaecheMax: null, gfNachHuelle: null, begrenzt: null,
    gfVoll: 0, gfDach: 0, gfNeu: 0, hnfNeu: 0, gfBestand: bestandGf(e.gebaeude), reserve: null, ausgenuetzt: null, wohnungen: 0,
    varianten: [], abschnitte: [], pruefen: [],
  });
  if (!flaeche) return leer('Die Fläche der Parzelle ist nicht bekannt.');
  const z = e.zone;
  if (!z) return leer('Für diese Parzelle ist keine Zone bekannt.');

  // Nur was in der Bauzone liegt, zählt für die Ziffer.
  const bauzone = pos(e.bauzoneM2) && e.bauzoneM2! < flaeche * 0.98 ? e.bauzoneM2! : null;
  const anrechenbar = bauzone ?? flaeche;
  const amtlich: Art = z.quelle === 'kanton' ? 'amtlich' : 'annahme';
  const zonenQuelle = z.quelle === 'kanton' ? 'Zonenplan des Kantons' : 'eigene Liste, nicht amtlich';

  // ---- die Ziffer
  const az = pos(z.az), bmz = pos(z.bmz);
  const ziffer: Studie['ziffer'] = az ? 'AZ' : bmz ? 'BMZ' : null;
  const gfNachZiffer = az ? az * anrechenbar : bmz ? (bmz * anrechenbar) / a.geschosshoehe : null;

  // ---- die Hülle
  const vg = pos(z.vollgeschosse);
  const uez = pos(z.uez);
  const nachAbstand = e.bebaubarM2 != null ? Math.max(0, e.bebaubarM2) : null;
  const nachUez = uez ? uez * anrechenbar : null;
  const grundflaecheMax = nachAbstand != null && nachUez != null ? Math.min(nachAbstand, nachUez) : nachAbstand ?? nachUez;
  const dachErlaubt = (z.dachgeschosse ?? 0) >= 1;
  const huelleVoll = grundflaecheMax != null && vg ? grundflaecheMax * vg : null;
  const huelleDach = grundflaecheMax != null && vg && dachErlaubt ? grundflaecheMax * a.dachFaktor : 0;

  if (gfNachZiffer == null && huelleVoll == null) {
    return leer(vg ? 'Die Zone nennt keine Ziffer, und ohne Umriss lässt sich die Hülle nicht rechnen.'
      : 'Die Zone nennt weder eine Ziffer noch die Zahl der Vollgeschosse.');
  }

  // ---- beides zusammen. Die Ausnützungsziffer zählt nur Vollgeschosse,
  // das Dachgeschoss kommt dazu. Die Baumasse umfasst das ganze Volumen
  // über dem Boden, das Dach also schon inbegriffen.
  let gfVoll: number, gfDach: number, begrenzt: Studie['begrenzt'];
  if (ziffer === 'BMZ') {
    const huelleGanz = huelleVoll != null ? huelleVoll + huelleDach : null;
    const ganz = huelleGanz != null ? Math.min(gfNachZiffer!, huelleGanz) : gfNachZiffer!;
    begrenzt = huelleGanz != null && huelleGanz < gfNachZiffer! ? 'huelle' : 'ziffer';
    gfVoll = huelleVoll != null ? Math.min(ganz, huelleVoll) : ganz;
    gfDach = ganz - gfVoll;
  } else {
    gfVoll = gfNachZiffer != null && huelleVoll != null ? Math.min(gfNachZiffer, huelleVoll) : (gfNachZiffer ?? huelleVoll)!;
    begrenzt = gfNachZiffer == null ? 'huelle' : huelleVoll != null && huelleVoll < gfNachZiffer ? 'huelle' : 'ziffer';
    // Das Dachgeschoss sitzt auf der Grundfläche, die die Vollgeschosse wirklich brauchen.
    gfDach = vg && dachErlaubt ? (gfVoll / vg) * a.dachFaktor : 0;
  }
  const gfNeu = gfVoll + gfDach;
  const hnfNeu = gfNeu * a.hnfFaktor;
  const wohnungen = Math.floor(hnfNeu / a.wohnungM2);

  // ---- der Bestand
  const gfBestand = bestandGf(e.gebaeude);
  const reserve = gfBestand != null ? Math.max(0, gfNeu - gfBestand) : null;
  const ausgenuetzt = gfBestand != null && gfNeu > 0 ? gfBestand / gfNeu : null;

  // ---- was es wert ist
  const varianten: Variante[] = [];
  {
    const erloes = hnfNeu * a.erloes;
    const kosten = gfNeu * a.baukosten + (gfBestand ?? 0) * a.abbruch;
    const land = erloes - kosten - erloes * a.marge;
    varianten.push({
      titel: gfBestand ? 'Ersatzneubau' : 'Neubau',
      text: gfBestand ? 'Bestand abbrechen und das Mögliche neu bauen.' : 'Das Mögliche auf dem unbebauten Grundstück.',
      gf: gfNeu, hnf: hnfNeu, wohnungen, kosten, erloes,
      ergebnis: land, ergebnisTitel: 'Bleibt für das Land', jeM2: land / flaeche,
    });
  }
  if (gfBestand && reserve != null && reserve >= 100) {
    const hnf = reserve * a.hnfFaktor;
    const erloes = hnf * a.erloes, kosten = reserve * a.baukosten;
    varianten.push({
      titel: 'Aufstocken oder anbauen', text: 'Bestand behalten, nur die Reserve bauen.',
      gf: reserve, hnf, wohnungen: Math.floor(hnf / a.wohnungM2), kosten, erloes,
      ergebnis: erloes - kosten, ergebnisTitel: 'Bleibt nach Baukosten',
    });
  }

  // ---- jede Zahl mit ihrer Herkunft
  const zeilen = (...p: (Posten | null | false | undefined)[]) => p.filter(Boolean) as Posten[];
  const abschnitte: Studie['abschnitte'] = [
    { titel: 'Grundstück', zeilen: zeilen(
      { titel: 'Fläche', wert: m2(flaeche), art: 'amtlich', quelle: 'Amtliche Vermessung' },
      bauzone && { titel: 'davon in der Bauzone', wert: m2(bauzone), art: 'berechnet', quelle: 'Verschnitt Parzelle und Zonenplan' },
      { titel: 'Zone', wert: [z.bezeichnung, z.abkuerzung && `(${z.abkuerzung})`].filter(Boolean).join(' ') || '–', art: amtlich, quelle: zonenQuelle },
    ) },
    { titel: 'Was die Zone erlaubt', zeilen: zeilen(
      az && { titel: 'Ausnützungsziffer', wert: de(az, 2), art: amtlich, quelle: zonenQuelle },
      bmz && { titel: 'Baumassenziffer', wert: `${de(bmz, 2)} m³/m²`, art: amtlich, quelle: zonenQuelle },
      uez && { titel: 'Überbauungsziffer', wert: de(uez, 2), art: amtlich, quelle: zonenQuelle },
      vg && { titel: 'Vollgeschosse', wert: `höchstens ${de(vg)}`, art: amtlich, quelle: zonenQuelle },
      z.dachgeschosse != null && { titel: 'Dachgeschosse', wert: `höchstens ${de(z.dachgeschosse)}`, art: amtlich, quelle: zonenQuelle },
      pos(z.hoehe) && { titel: z.hoeheArt ?? 'Höhe', wert: `höchstens ${de(z.hoehe!, 1)} m`, art: amtlich, quelle: zonenQuelle },
      pos(z.wohnanteilMin) && { titel: 'Wohnanteil', wert: `mindestens ${de(z.wohnanteilMin!)} %`, art: amtlich, quelle: zonenQuelle },
    ) },
    { titel: 'Was Platz hat', zeilen: zeilen(
      gfNachZiffer != null && { titel: ziffer === 'AZ' ? 'Geschossfläche nach Ausnützung' : 'Geschossfläche nach Baumasse', wert: m2(gfNachZiffer),
        art: ziffer === 'BMZ' ? 'annahme' : z.quelle === 'kanton' ? 'berechnet' : 'annahme',
        quelle: ziffer === 'AZ' ? `${de(az!, 2)} × ${m2(anrechenbar)}` : `${de(bmz!, 2)} × ${m2(anrechenbar)} ÷ ${de(a.geschosshoehe, 1)} m Geschosshöhe` },
      nachAbstand != null && { titel: 'Bebaubare Grundfläche', wert: m2(nachAbstand), art: 'annahme', quelle: `Umriss minus ${de(a.grenzabstand, 1)} m Grenzabstand rundum` },
      nachUez != null && { titel: 'Grundfläche nach Überbauungsziffer', wert: m2(nachUez), art: z.quelle === 'kanton' ? 'berechnet' : 'annahme', quelle: `${de(uez!, 2)} × ${m2(anrechenbar)}` },
      huelleVoll != null && { titel: 'Geschossfläche nach Hülle', wert: m2(huelleVoll), art: 'annahme', quelle: `${m2(grundflaecheMax!)} × ${de(vg!)} Vollgeschosse` },
      { titel: 'Mögliche Geschossfläche', wert: m2(gfNeu), art: 'berechnet',
        quelle: `${begrenzt === 'huelle' ? 'Die Hülle begrenzt' : 'Die Ziffer begrenzt'}${gfDach > 0 ? `, davon ${m2(gfDach)} im Dachgeschoss` : ''}` },
      { titel: 'Hauptnutzfläche', wert: m2(hnfNeu), art: 'annahme', quelle: `${de(a.hnfFaktor * 100)} % der Geschossfläche` },
      { titel: 'Wohnungen', wert: `rund ${de(wohnungen)}`, art: 'annahme', quelle: `je ${de(a.wohnungM2)} m² Hauptnutzfläche` },
    ) },
    { titel: 'Was heute steht', zeilen: gfBestand != null ? zeilen(
      { titel: 'Geschossfläche Bestand', wert: m2(gfBestand), art: 'berechnet', quelle: 'Gebäuderegister: Grundfläche × Geschosse' },
      { titel: 'Ausgenützt', wert: `${de(Math.round(ausgenuetzt! * 100))} %`, art: 'berechnet', quelle: 'Bestand ÷ mögliche Geschossfläche' },
      { titel: 'Reserve', wert: m2(reserve!), art: 'berechnet', quelle: 'mögliche Geschossfläche minus Bestand' },
    ) : zeilen({ titel: 'Bestand', wert: e.gebaeude.length ? 'Flächen fehlen im Register' : 'kein Gebäude im Register', art: 'amtlich', quelle: 'Gebäuderegister' }) },
  ];

  // ---- was offen bleibt
  const pruefen: string[] = [];
  if (nachAbstand != null) pruefen.push(`Grenzabstand: gerechnet mit ${de(a.grenzabstand, 1)} m rundum. Die Bauordnung der Gemeinde kennt oft einen kleinen und einen grossen Grundabstand und Zuschläge für lange Fassaden.`);
  else pruefen.push('Kein Umriss: ob das Volumen zwischen den Grenzabständen Platz hat, ist nicht gerechnet.');
  if (ziffer === 'BMZ') pruefen.push(`Baumasse: in Geschossfläche umgerechnet mit ${de(a.geschosshoehe, 1)} m Geschosshöhe. Hohe Räume oder ein steiles Dach ändern das.`);
  if (!ziffer) pruefen.push('Die Zone nennt keine Ziffer (häufig in Kern- und Zentrumszonen): dort entscheiden Gestaltungsvorschriften und der Einzelfall.');
  if (z.quelle !== 'kanton') pruefen.push('Die Angaben zur Zone stammen aus der eigenen Liste, nicht aus dem Zonenplan des Kantons.');
  if (bauzone) pruefen.push('Die Parzelle liegt nur zum Teil in der Bauzone.');
  if (ausgenuetzt != null && ausgenuetzt > 1) pruefen.push('Der Bestand ist grösser als heute erlaubt (Besitzstand): ein Neubau dürfte kleiner ausfallen.');
  if (pos(z.wohnanteilMin)) pruefen.push(`Mindestens ${de(z.wohnanteilMin!)} % Wohnanteil vorgeschrieben.`);
  pruefen.push('Gestaltungsplan, Baulinien, Gewässerraum, Lärm, Ortsbild und Denkmal: im Kataster der Eigentumsbeschränkungen nachsehen.');
  pruefen.push('Baukosten und Erlös sind Erfahrungswerte, nicht die Zahlen dieses Ortes.');

  return { rechenbar: true, flaeche, ziffer, gfNachZiffer, grundflaecheMax, gfNachHuelle: huelleVoll, begrenzt, gfVoll, gfDach, gfNeu, hnfNeu,
    gfBestand, reserve, ausgenuetzt, wohnungen, varianten, abschnitte, pruefen };
}

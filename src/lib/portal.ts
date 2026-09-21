/**
 * Die Eigentumsauskunft des richtigen Kantons.
 *
 * Zürich führt ein eigenes Portal, der Thurgau hängt die Auskunft an
 * seinen Kartendienst: Parzelle suchen, Mobilnummer, SMS-Code, dann das
 * Fenster mit den Eigentümern -- rund zwanzig Auskünfte am Tag statt
 * fünf.
 *
 * Die Adresse stand bisher an drei Stellen im Code, jede für sich auf
 * Zürich festgelegt. Wer im Thurgau auf "Eigentümer abrufen" klickte,
 * landete deshalb im Zürcher Portal, das dieses Grundstück gar nicht
 * kennt. Jetzt steht sie an einer Stelle.
 */
export function portalUrl(
  kanton: string | null | undefined,
  egrid: string | null | undefined,
  bfsNr?: string | number | null,
  /**
   * Landeskoordinaten des Grundstuecks, wenn bekannt.
   *
   * Ohne sie steht die Karte irgendwo im Kanton: "swisssearch" oeffnet
   * nur das Vorschlagsfeld, es springt nichts. Wer dann in die Mitte
   * klickt, trifft eine fremde Parzelle oder gar nichts. Mit E und N
   * steht die Karte auf dem Grundstueck, und "crosshair=marker" setzt
   * die rote Nadel darauf -- genau dorthin muss der Klick.
   */
  koordinaten?: { e: number; n: number } | null,
): string {
  const e = String(egrid ?? '').trim();
  if (String(kanton ?? '').trim().toUpperCase() === 'TG') {
    const ort = koordinaten
      ? `&E=${koordinaten.e.toFixed(2)}&N=${koordinaten.n.toFixed(2)}&crosshair=marker`
      : '';
    return 'https://map.geo.tg.ch/apps/mf-geoadmin3/?lang=de'
      + '&topic=grundbuchvermessung&bgLayer=basemap_farbig&zoom=8'
      + '&layers=grundbuch,av_komplett'
      + `&swisssearch=${encodeURIComponent(e)}${ort}`;
  }
  const b = String(bfsNr ?? '').trim();
  return 'https://portal.objektwesen.zh.ch/aks/detail'
    + `?egrid=${encodeURIComponent(e)}&bfsNr=${encodeURIComponent(b)}`;
}

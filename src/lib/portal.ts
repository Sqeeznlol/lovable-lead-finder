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
): string {
  const e = String(egrid ?? '').trim();
  if (String(kanton ?? '').trim().toUpperCase() === 'TG') {
    return 'https://map.geo.tg.ch/apps/mf-geoadmin3/?lang=de'
      + '&topic=grundbuchvermessung&bgLayer=basemap_farbig&zoom=8'
      + '&layers=grundbuch,av_komplett'
      + `&swisssearch=${encodeURIComponent(e)}`;
  }
  const b = String(bfsNr ?? '').trim();
  return 'https://portal.objektwesen.zh.ch/aks/detail'
    + `?egrid=${encodeURIComponent(e)}&bfsNr=${encodeURIComponent(b)}`;
}

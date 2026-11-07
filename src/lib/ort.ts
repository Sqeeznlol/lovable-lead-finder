/**
 * Woher eine Anmeldung kommt: der Ort zur Adresse.
 *
 * Gefragt wird vom Browser aus, denn die Datenbank kann nach aussen
 * keine Anfrage stellen. Geprüft am 1. November ("Auswerten ->
 * ortsdienst"): get.geojs.io und ipwho.is antworten mit 200, erlauben
 * Anfragen aus dem Browser (CORS "*") und liefern city, region,
 * country und ip. ipapi.co antwortete mit 429 (Kontingent erschöpft) --
 * darum nicht.
 *
 * Beide Dienste sehen dabei die Adresse des Geräts; mehr geht nicht
 * hinaus, keine Kennung und kein Konto.
 */
export interface Ort { text: string; ip: string | null }

const DIENSTE = ['https://get.geojs.io/v1/ip/geo.json', 'https://ipwho.is/'];

/** Aus der Antwort eines der beiden Dienste ein lesbarer Ort: "Zürich, Zurich · CH". */
export function ortText(j: Record<string, unknown> | null | undefined): Ort | null {
  if (!j || j.success === false) return null;
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const stadt = s(j.city), region = s(j.region);
  const land = s(j.country_code) || s(j.country);
  const vorn = [stadt, region && region !== stadt ? region : ''].filter(Boolean).join(', ');
  const text = [vorn, land].filter(Boolean).join(' · ');
  if (!text) return null;
  return { text, ip: s(j.ip) || null };
}

/** Den Ort holen, höchstens drei Sekunden lang -- die Anmeldung wartet nicht darauf. */
export async function ortHolen(warten = 3000): Promise<Ort | null> {
  for (const url of DIENSTE) {
    try {
      const ab = new AbortController();
      const t = setTimeout(() => ab.abort(), warten);
      const r = await fetch(url, { signal: ab.signal });
      clearTimeout(t);
      if (!r.ok) continue;
      const o = ortText(await r.json());
      if (o) return o;
    } catch { /* nächster Dienst */ }
  }
  return null;
}

import { supabase } from '@/integrations/supabase/client';
import { esriRinge } from '@/lib/karte-ebenen';
import { umrissVomBund } from '@/hooks/use-portfolio';

/**
 * Arrondierung: zu jeder Parzelle eines Kundenportfolios die Nachbarn
 * finden, mit dem Bestand verbinden und als Gelegenheit ablegen --
 * Schritte 2 bis 4 von Tims Ablauf.
 *
 * Die Nachbarn kommen vom Bund (identify mit dem Umriss als Polygon),
 * genau wie im Objektfenster (NachbarnBund.tsx): gemessen am 1.
 * November liefert das für Zürcher Parzellen die angrenzenden mit EGRID
 * und Nummer, auch wo der Bestand keinen Umriss hat (Zürich: 0).
 */
export interface Nachbar { egrid: string; nummer: string }

const EGRID = /^CH[0-9A-Z]{12}$/;

export async function nachbarnVomBund(egrid: string): Promise<Nachbar[]> {
  const umriss = await umrissVomBund(egrid, '2056');
  if (!umriss || (umriss.type !== 'Polygon' && umriss.type !== 'MultiPolygon')) return [];
  const ringe = esriRinge(umriss as GeoJSON.Polygon | GeoJSON.MultiPolygon);
  const punkte = ringe.flat();
  const xs = punkte.map(p => p[0]), ys = punkte.map(p => p[1]);
  const p = new URLSearchParams({
    geometry: JSON.stringify({ rings: ringe }), geometryType: 'esriGeometryPolygon',
    sr: '2056', tolerance: '0', returnGeometry: 'false', layers: 'all:ch.kantone.cadastralwebmap-farbe',
    mapExtent: [Math.min(...xs) - 50, Math.min(...ys) - 50, Math.max(...xs) + 50, Math.max(...ys) + 50].join(','),
    imageDisplay: '600,600,96', lang: 'de',
  });
  const j = await (await fetch(`https://api3.geo.admin.ch/rest/services/all/MapServer/identify?${p}`)).json();
  const alle = ((j?.results ?? []) as { attributes?: Record<string, unknown> }[])
    .map(r => ({ egrid: String(r.attributes?.egris_egrid ?? ''), nummer: String(r.attributes?.number ?? '') }))
    .filter(t => EGRID.test(t.egrid) && t.egrid !== egrid);
  return [...new Map(alle.map(t => [t.egrid, t])).values()];
}

export interface NachbarImBestand {
  id: string; egrid: string; address: string | null; owner_name: string | null;
  area: number | null; marge_chf: number | null;
}

/**
 * Wie dringend eine Arrondierung ist. Absichtlich einfach und
 * erklärbar, damit ein Anrufer versteht, warum etwas oben steht:
 * - je Nachbar mit bekanntem Eigentümer 3 Punkte (man kann anrufen),
 * - je Nachbar im Bestand ohne Eigentümer 1 Punkt (man kann abfragen),
 * - die Fläche der Nachbarn im Bestand, je 1000 m² 1 Punkt,
 * - die Marge der Nachbarn, je Million 1 Punkt.
 */
export function prioritaet(nachbarn: NachbarImBestand[]): number {
  let p = 0;
  for (const n of nachbarn) {
    p += n.owner_name?.trim() ? 3 : 1;
    p += (Number(n.area) || 0) / 1000;
    p += Math.max(0, Number(n.marge_chf) || 0) / 1_000_000;
  }
  return Math.round(p * 10) / 10;
}

export function begruendung(nachbarn: NachbarImBestand[], fremde: Nachbar[]): string {
  const mitEigner = nachbarn.filter(n => n.owner_name?.trim()).length;
  const teile = [
    `${nachbarn.length} ${nachbarn.length === 1 ? 'Nachbar' : 'Nachbarn'} im Bestand`,
    mitEigner ? `${mitEigner} mit Eigentümer` : null,
    fremde.length ? `${fremde.length} weitere ausserhalb des Bestands` : null,
  ];
  return teile.filter(Boolean).join(', ') + '.';
}

// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export interface Position { parzelleId: string; egrid: string; adresse: string | null }

/**
 * Für alle Positionen eines Portfolios die Arrondierung prüfen und je
 * Parzelle höchstens eine Gelegenheit anlegen. Was schon da ist, wird
 * nicht doppelt angelegt -- der Ablauf darf beliebig oft laufen.
 */
export async function arrondierungErkennen(
  portfolioId: string, positionen: Position[],
  fortschritt: (fertig: number, gesamt: number) => void = () => {},
): Promise<{ neu: number; schon: number; ohneNachbarn: number; fehler: number }> {
  const pf = await db().from('portfolio').select('mandant_id').eq('id', portfolioId).single();
  if (pf.error) throw pf.error;
  const mandantId = pf.data.mandant_id as string;

  const ids = positionen.map(p => p.parzelleId);
  const vorh = await db().from('gelegenheit_parzelle')
    .select('parzelle_id, gelegenheit!inner(anlass, mandant_id)')
    .eq('rolle', 'ausloeser').in('parzelle_id', ids)
    .eq('gelegenheit.anlass', 'arrondierung').eq('gelegenheit.mandant_id', mandantId);
  if (vorh.error) throw vorh.error;
  const schonDa = new Set(((vorh.data ?? []) as { parzelle_id: string }[]).map(r => r.parzelle_id));

  const erg = { neu: 0, schon: 0, ohneNachbarn: 0, fehler: 0 };
  let fertig = 0;
  for (const pos of positionen) {
    try {
      if (schonDa.has(pos.parzelleId)) { erg.schon++; continue; }
      const nachbarn = await nachbarnVomBund(pos.egrid);
      if (!nachbarn.length) { erg.ohneNachbarn++; continue; }
      const imB = await db().from('properties')
        .select('id, egrid, address, owner_name, area, marge_chf').in('egrid', nachbarn.map(n => n.egrid));
      if (imB.error) throw imB.error;
      const bestand = (imB.data ?? []) as NachbarImBestand[];
      const bekannt = new Set(bestand.map(b => b.egrid));
      const fremde = nachbarn.filter(n => !bekannt.has(n.egrid));
      const g = await db().from('gelegenheit').insert({
        anlass: 'arrondierung', mandant_id: mandantId, zustand: 'erkannt',
        titel: `Arrondierung ${pos.adresse ?? pos.egrid}`,
        begruendung: begruendung(bestand, fremde),
        prioritaet: prioritaet(bestand), fremde_nachbarn: fremde,
      }).select('id').single();
      if (g.error) throw g.error;
      const zeilen = [
        { gelegenheit_id: g.data.id, parzelle_id: pos.parzelleId, rolle: 'ausloeser' },
        ...bestand.map(b => ({ gelegenheit_id: g.data.id, parzelle_id: b.id, rolle: 'nachbar' })),
      ];
      const z = await db().from('gelegenheit_parzelle').insert(zeilen);
      if (z.error) throw z.error;
      erg.neu++;
    } catch { erg.fehler++; } finally { fortschritt(++fertig, positionen.length); }
  }
  return erg;
}

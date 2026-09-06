import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { beurteile, type Empfehlung } from '@/lib/akquise';
import { calculatePotential } from '@/lib/potential';
import { gemeindeprofil, LAGE_LABEL, type Lagestufe } from '@/lib/gemeinden-zh';
import { verkauftNie, ARCHIV_STATUS } from '@/lib/grundbuch';
import { lesen, schreiben } from '@/lib/zwischenspeicher';

/** Felder, die für die Beurteilung gebraucht werden. */
const FELDER =
  'id, address, gemeinde, plz, parzelle, plot_number, egrid, owner_phone, bfs_nr, kanton, ' +
  'google_maps_url, gis_url, streetview_url, bebaubar_m2, kategorie, ' +
  'zone, ausnuetzung, area, gebaeudeflaeche, geschosse, ' +
  'vollgeschosse, baujahr, renovationsjahr, denkmalschutz, isos, wohnungen, ' +
  'owner_name, eigentuemer_name, gebaeude_anzahl, hnf_delta, marge_chf, ' +
  'score_tier, potenzial_score, preselection_status, ausgeschlossen';

export interface Chance {
  id: string;
  address: string;
  gemeinde: string | null;
  empfehlung: Empfehlung;
  punkte: number;
  hnfDelta: number | null;
  marge: number | null;
  lage: Lagestufe;
  baujahr: number | null;
  eigentuemer: string | null;
  /** Ohne Parzellennummer lässt sich das Grundstück nicht nachschlagen. */
  parzelle: string | null;
  bfsNr: string | null;
  /** Kanton -- jeder fuehrt seinen eigenen OEREB-Kataster. */
  kanton: string | null;
  egrid: string | null;
  plz: string | null;
  telefon: string | null;
  /** Links auf die Karten -- ohne Bild vom Ort bleibt eine Zeile abstrakt. */
  mapsUrl: string | null;
  gisUrl: string | null;
  /** Die Zahlen hinter der Empfehlung, damit sie nachvollziehbar ist. */
  zone: string | null;
  kategorie: string | null;
  bebaubar: number | null;
  az: number | null;
  geschosse: number | null;
  hnfBestand: number | null;
  hnfNeu: number | null;
  dafuer: string[];
}

export interface GemeindeChance {
  gemeinde: string;
  anrufen: number;
  /** Anrufen und Prüfen zusammen -- so viele Objekte tragen zur Summe bei. */
  chancen: number;
  margeSumme: number;
  lage: string;
}

export interface Uebersicht {
  total: number;
  bewertet: number;
  nachEmpfehlung: Record<Empfehlung, number>;
  margeSumme: number;
  topChancen: Chance[];
  /**
   * Die Objekte, für die sich eine Grundbuchabfrage heute am meisten lohnt.
   *
   * Das Portal des Kantons verlangt eine Bestätigung per SMS und gibt fünf
   * Auskünfte pro Tag frei. Diese fünf sollten die wertvollsten sein --
   * grösste Marge, Eigentümer noch unbekannt.
   */
  nachschlagen: Chance[];
  topGemeinden: GemeindeChance[];
  ohneEigentuemer: number;
}

/**
 * Wertet die Objekte für die Übersicht aus.
 *
 * Die Beurteilung liegt im Frontend, weil sie Erfahrungswerte einbezieht,
 * die sich häufiger ändern als das Datenbankschema -- Preisniveau je
 * Gemeinde, Verkaufsbereitschaft je Eigentümertyp. Deshalb wird hier
 * gelesen und gerechnet statt in der Datenbank abgefragt.
 *
 * Geladen wird nur, was nicht ausgeschlossen ist und wo überhaupt ein
 * Potenzial errechnet wurde; alles andere trägt zur Frage "wen rufe ich an"
 * nichts bei und würde die Abfrage unnötig gross machen.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const potenzialVon = (p: any) => calculatePotential(p);

export function useUebersicht(kanton?: string) {
  // Je Kanton ein eigener Schlüssel: sonst erscheinen beim Umschalten
  // für einen Moment die Zahlen des vorigen.
  const schluessel = `uebersicht.${kanton ?? 'alle'}`;
  return useQuery({
    queryKey: ['uebersicht', kanton ?? 'alle'],
    // Eine halbe Stunde: der Bestand ändert sich nicht im Minutentakt,
    // und jeder Aufruf kostete bisher vierzig Abfragen samt Neurechnung.
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    // Beim Öffnen steht sofort das Ergebnis der letzten Rechnung da.
    // Neu gerechnet wird im Hintergrund, ohne dass die Seite leer wird.
    initialData: () => lesen<Uebersicht>(schluessel),
    initialDataUpdatedAt: () => lesen<number>(`${schluessel}.zeit`),
    queryFn: async (): Promise<Uebersicht> => {
      // Auch hier genügt die Schätzung: die Zahl steht als Fussnote
      // ("259'000 Objekte im Bestand") und muss nicht auf die Zeile
      // genau stimmen, aber sofort dastehen.
      let zaehlung = supabase
        .from('properties')
        .select('id', { count: 'estimated', head: true });
      if (kanton) zaehlung = zaehlung.eq('kanton', kanton);
      const { count: total } = await zaehlung;

      const chancen: Chance[] = [];
      const nachEmpfehlung: Record<Empfehlung, number> = {
        anrufen: 0, pruefen: 0, zurueckstellen: 0, nein: 0,
      };
      const proGemeinde = new Map<string, { anrufen: number; chancen: number; marge: number }>();
      let margeSumme = 0;
      let bewertet = 0;
      let ohneEigentuemer = 0;

      // In Seiten lesen: die Beurteilung braucht die Rohdaten, und bei
      // Hunderttausenden Zeilen wäre eine einzelne Abfrage weder schnell
      // noch verlässlich.
      const SEITE = 1000;
      for (let von = 0; von < 40000; von += SEITE) {
        let abfrage = supabase
          .from('properties')
          .select(FELDER)
          .eq('ausgeschlossen', false);
        if (kanton) abfrage = abfrage.eq('kanton', kanton);
        const { data, error } = await abfrage
          .not('hnf_delta', 'is', null)
          .order('hnf_delta', { ascending: false, nullsFirst: false })
          .range(von, von + SEITE - 1);

        if (error || !data?.length) break;

        for (const roh of data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p = roh as any;
          // Archiviertes und die öffentliche Hand gehören nicht auf die
          // Anrufliste: das eine wurde entschieden, das andere verkauft nicht.
          if (p.preselection_status === ARCHIV_STATUS) continue;
          if (verkauftNie(p.owner_name ?? p.eigentuemer_name)) continue;

          const u = beurteile(p);
          // HNF und Marge müssen aus derselben Rechnung stammen. Der Wert in
          // der Datenbank kann älter sein als die aktuelle Formel; dann
          // stünden hier zwei Zahlen nebeneinander, die nicht zusammenpassen.
          const gerechnet = potenzialVon(p);
          bewertet++;
          nachEmpfehlung[u.empfehlung]++;
          if (!p.owner_name && !p.eigentuemer_name) ohneEigentuemer++;

          if (u.empfehlung === 'anrufen' || u.empfehlung === 'pruefen') {
            const marge = u.margeLagegerecht ?? 0;
            margeSumme += Math.max(marge, 0);

            if (p.gemeinde) {
              const g = proGemeinde.get(p.gemeinde) ?? { anrufen: 0, chancen: 0, marge: 0 };
              g.chancen++;
              if (u.empfehlung === 'anrufen') g.anrufen++;
              g.marge += Math.max(marge, 0);
              proGemeinde.set(p.gemeinde, g);
            }

            chancen.push({
              id: p.id,
              address: p.address,
              gemeinde: p.gemeinde,
              empfehlung: u.empfehlung,
              punkte: u.punkte,
              hnfDelta: gerechnet.hnfDelta,
              marge: u.margeLagegerecht,
              lage: u.lage,
              baujahr: p.baujahr,
              eigentuemer: p.owner_name ?? p.eigentuemer_name ?? null,
              parzelle: p.parzelle ?? p.plot_number ?? null,
              bfsNr: p.bfs_nr ?? null,
              kanton: p.kanton ?? null,
              egrid: p.egrid ?? null,
              plz: p.plz ?? null,
              telefon: p.owner_phone ?? null,
              mapsUrl: p.google_maps_url ?? null,
              gisUrl: p.gis_url ?? null,
              zone: p.zone ?? null,
              kategorie: p.kategorie ?? null,
              bebaubar: p.bebaubar_m2 ?? p.area ?? null,
              az: gerechnet.az,
              geschosse: gerechnet.vollgeschosse,
              hnfBestand: gerechnet.hnfBestand,
              hnfNeu: gerechnet.hnfNeu,
              dafuer: u.dafuer,
            });
          }
        }

        if (data.length < SEITE) break;
      }

      chancen.sort((a, b) => b.punkte - a.punkte || (b.marge ?? 0) - (a.marge ?? 0));

      const topGemeinden: GemeindeChance[] = [...proGemeinde.entries()]
        .map(([gemeinde, g]) => ({
          gemeinde,
          anrufen: g.anrufen,
          chancen: g.chancen,
          margeSumme: g.marge,
          lage: LAGE_LABEL[gemeindeprofil(gemeinde).stufe],
        }))
        .sort((a, b) => b.margeSumme - a.margeSumme)
        .slice(0, 8);

      const ergebnis: Uebersicht = {
        total: total ?? 0,
        bewertet,
        nachEmpfehlung,
        margeSumme,
        topChancen: chancen.slice(0, 15),
        nachschlagen: chancen.filter(c => !c.eigentuemer).slice(0, 5),
        topGemeinden,
        ohneEigentuemer,
      };
      // Nur das Ergebnis wird abgelegt, nicht die vierzigtausend Zeilen,
      // aus denen es entstand.
      schreiben(schluessel, ergebnis);
      schreiben(`${schluessel}.zeit`, Date.now());
      return ergebnis;
    },
  });
}

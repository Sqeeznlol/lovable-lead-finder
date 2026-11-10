// Rechnung für «Mögliche Arrondierungen»: eigene Liegenschaft und Nachbar zusammen.
export type Ring = number[][];
export type ZusammenDaten = {
  flaeche: number | null; gebaeude: number | null; baujahr: number | null; wohnungen: number | null; gf_heute: number | null;
  zone: string | null; umriss: Ring[] | null;
  haupt_flaeche: number | null; haupt_gebaeude: number | null; haupt_baujahr: number | null; haupt_wohnungen: number | null;
  haupt_gf_heute: number | null; haupt_zone: string | null; haupt_umriss: Ring[] | null;
};

// Hauptnutzfläche aus der Geschossfläche: Wände, Treppen, Technik und
// Erschliessung abgezogen bleiben im Wohnbau rund 80 %.
export const HNF_ANTEIL = 0.8;
// Ab dieser Fläche lassen die meisten Kantone eine Arealüberbauung mit Bonus zu.
export const AREAL_AB = 3000;

export function azAnnahme(zone: string | null): number {
  if (/Zentrum|Kern/i.test(zone ?? '')) return 1.3;
  if (/Misch/i.test(zone ?? '')) return 1.0;
  return 0.8;
}

export function zusammenRechnen(d: ZusammenDaten, az: number, bonus: number) {
  const fl = (d.haupt_flaeche ?? 0) + (d.flaeche ?? 0);
  const gfHeute = (d.haupt_gf_heute ?? 0) + (d.gf_heute ?? 0);
  const gfMoeglich = Math.round(fl * az * (1 + (fl >= AREAL_AB ? bonus : 0) / 100));
  return {
    fl, gfHeute, gfMoeglich,
    hnfHeute: Math.round(gfHeute * HNF_ANTEIL), hnfMoeglich: Math.round(gfMoeglich * HNF_ANTEIL),
    mehrHnf: Math.max(0, Math.round((gfMoeglich - gfHeute) * HNF_ANTEIL)),
    azHeute: fl ? gfHeute / fl : 0, areal: fl >= AREAL_AB,
  };
}


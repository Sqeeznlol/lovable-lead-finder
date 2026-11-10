/**
 * Rechnung für «Mögliche Arrondierungen»: die eigene Parzelle und die
 * dazugeklickten Nachbarn zusammen. Nur gemessene Werte (Amtliche
 * Vermessung, GWR); geschätzt wird nichts (Julian, 10. November: "damit
 * der Architekt das rechnen kann und die echten Zahlen sieht, nicht
 * irgendeine Schätzung"). Was möglich ist, rechnet sich erst mit der
 * Ausnützungsziffer, die man aus der BZO der Gemeinde einträgt.
 */
export type Ring = number[][];

/** Ein Gebäude, wie das GWR es führt. */
export type Gebaeude = {
  egid: string | null; adresse: string | null; baujahr: number | null; status: number | null;
  geschosse: number | null; grundflaeche: number | null; ebf: number | null; volumen: number | null;
  wohnungen: number | null; wohnflaeche: number | null; e: number | null; n: number | null;
};

export type Parzelle = {
  egrid: string; nummer: string | null; flaeche: number | null; zone: string | null;
  umriss: Ring[] | null; gebaeude: Gebaeude[];
};

/** GWR-Gebäudestatus, Codes laut Merkmalskatalog des BFS. */
export const GEB_STATUS: Record<number, string> = {
  1001: 'projektiert', 1002: 'bewilligt', 1003: 'im Bau', 1004: 'bestehend', 1005: 'nicht nutzbar',
};

const summe = (werte: (number | null | undefined)[]) => {
  const da = werte.filter((w): w is number => typeof w === 'number');
  return da.length ? da.reduce((s, w) => s + w, 0) : null;
};

export type Summe = {
  flaeche: number | null; gebaeude: number; grundflaeche: number | null; ebf: number | null; volumen: number | null;
  wohnungen: number | null; wohnflaeche: number | null; baujahr: number | null; geschosse: number | null;
  /** Überbauung heute: Grundfläche der Gebäude geteilt durch die Parzellenfläche. */
  ueberbauung: number | null;
  /** Gebäude ohne Angabe zählen nicht mit; so sieht man, wo eine Summe unvollständig ist. */
  ohneEbf: number; ohneWohnflaeche: number;
};

export function summieren(parzellen: Parzelle[]): Summe {
  const geb = parzellen.flatMap(p => p.gebaeude);
  const flaeche = summe(parzellen.map(p => p.flaeche));
  const grundflaeche = summe(geb.map(g => g.grundflaeche));
  const jahre = geb.map(g => g.baujahr).filter((j): j is number => !!j);
  const geschosse = geb.map(g => g.geschosse).filter((x): x is number => !!x);
  return {
    flaeche, gebaeude: geb.length, grundflaeche, ebf: summe(geb.map(g => g.ebf)), volumen: summe(geb.map(g => g.volumen)),
    wohnungen: summe(geb.map(g => g.wohnungen)), wohnflaeche: summe(geb.map(g => g.wohnflaeche)),
    baujahr: jahre.length ? Math.min(...jahre) : null, geschosse: geschosse.length ? Math.max(...geschosse) : null,
    ueberbauung: flaeche && grundflaeche != null ? grundflaeche / flaeche : null,
    ohneEbf: geb.filter(g => g.ebf == null).length, ohneWohnflaeche: geb.filter(g => g.wohnungen && g.wohnflaeche == null).length,
  };
}

/** Anrechenbare Geschossfläche nach BZO: Fläche mal AZ, mit Bonus in Prozent. Ohne AZ keine Zahl. */
export function moeglich(flaeche: number | null, az: number | null, bonusProzent: number | null): number | null {
  if (!flaeche || !az || az <= 0) return null;
  return Math.round(flaeche * az * (1 + Math.max(0, bonusProzent ?? 0) / 100));
}

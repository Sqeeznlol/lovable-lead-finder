/**
 * Ratgeber für Eigentümer: Artikel, die man gern liest und weitergibt.
 *
 * Tim, 7. November: Werbung auf Google ist umkämpft, Facebook ist "krass
 * bi Rentner", und dort laufen gerade die Seiten im Stil eines Magazins.
 * Ein Ratgeber passt dazu und hat einen zweiten Vorteil: Meta zählt
 * "Tips related to homeownership" nicht zur Sonderkategorie Wohnraum
 * (facebook.com/business/help/1198401317374558, abgerufen 7.11.2026).
 * Eine Anzeige für einen Artikel darf deshalb nach Alter und PLZ
 * ausgerichtet werden, eine Anzeige für den Check nicht.
 *
 * Darum gilt: Der Artikel ist ein echter Ratgeber und muss für sich
 * taugen. Der Check ist ein Angebot am Rand, kein Lockvogel. Jede
 * rechtliche Aussage hat eine Quelle, die nachgesehen wurde.
 *
 * Neuer Artikel = neuer Eintrag hier. Er erscheint auf jeder
 * Marken-Domain unter /ratgeber/<slug>.
 */
export interface Abschnitt {
  titel: string;
  absaetze: string[];
  /** Nach diesem Abschnitt den Kasten zum Check zeigen. */
  kasten?: boolean;
}

export interface Artikel {
  slug: string;
  /** Kleine Zeile über dem Titel. */
  rubrik: string;
  titel: string;
  lead: string;
  lesezeit: string;
  abschnitte: Abschnitt[];
  /** Was der Kasten zum Check sagt -- passend zum Artikel. */
  kasten: { titel: string; satz: string; knopf: string };
  quellen: { text: string; url: string }[];
  /** Wann zuletzt geprüft, als Datum für den Fuss des Artikels. */
  stand: string;
}

export const ARTIKEL: Artikel[] = [
  {
    slug: 'haus-zu-gross',
    rubrik: 'Wohnen im Alter',
    titel: 'Das Haus ist zu gross geworden. Fünf Wege, die Eigentümer haben',
    lead: 'Die Kinder sind ausgezogen, der Garten macht mehr Arbeit als Freude, die Treppe wird steiler. Früher oder später stellt sich die Frage, wie es mit dem Haus weitergeht. Verkaufen ist nur einer von mehreren Wegen. Hier sind die fünf häufigsten, mit dem, was Sie dafür wissen sollten.',
    lesezeit: '5 Minuten',
    abschnitte: [
      {
        titel: '1. Bleiben und eine Wohnung abtrennen',
        absaetze: [
          'Ein Teil des Hauses wird zu einer eigenen Wohnung, die Sie vermieten oder einem Ihrer Kinder überlassen. Sie bleiben in Ihrer gewohnten Umgebung, und das Haus wird wieder ganz genutzt.',
          'Dafür braucht es eine Baubewilligung, denn Bauten dürfen nur mit behördlicher Bewilligung errichtet oder geändert werden. Ob eine zweite Wohnung erlaubt ist, hängt von der Zone und der Bau- und Zonenordnung Ihrer Gemeinde ab.',
        ],
      },
      {
        titel: '2. Anbauen oder aufstocken',
        absaetze: [
          'Auf vielen Grundstücken dürfte mehr stehen, als heute darauf steht. Diese Reserve lässt sich nutzen: mit einem Anbau, einem zusätzlichen Geschoss oder einem zweiten Haus im Garten.',
          'Wie viel gebaut werden darf, legt Ihre Gemeinde fest, oft mit einer Ausnützungsziffer: der erlaubten Geschossfläche im Verhältnis zur Fläche des Grundstücks. Die Reserve zählt auch, wenn Sie selbst nicht bauen: Käufer rechnen mit ihr.',
        ],
        kasten: true,
      },
      {
        titel: '3. Das Haus aufteilen und einen Teil verkaufen',
        absaetze: [
          'Mit Stockwerkeigentum wird aus einem Haus mit mehreren Wohnungen ein Haus mit einzelnen Eigentumswohnungen. Sie behalten Ihre Wohnung und verkaufen die anderen. Das geht über das Notariat und das Grundbuch.',
          'Ist das Grundstück gross genug, lässt es sich unter Umständen auch teilen. Ein Teil wird als Bauland verkauft, Sie behalten Haus und Garten. Ob das geht, hängt von Zone, Fläche und Zufahrt ab.',
        ],
      },
      {
        titel: '4. An die Kinder übergeben',
        absaetze: [
          'Manche Eltern übergeben das Haus schon zu Lebzeiten an ihre Kinder. Mit einem Wohnrecht oder einer Nutzniessung können sie trotzdem darin wohnen bleiben.',
          'Eine Übergabe zu Lebzeiten hat Folgen für die spätere Erbteilung und für die Steuern. Lassen Sie sich vom Notariat und einer Steuerberatung begleiten, bevor Sie etwas unterschreiben.',
        ],
      },
      {
        titel: '5. Verkaufen und in eine Wohnung ziehen',
        absaetze: [
          'Mit dem Erlös aus dem Haus lässt sich eine kleinere Wohnung kaufen oder mieten, zum Beispiel näher am Dorfkern, mit Lift und ohne Garten.',
          'Auf dem Gewinn aus dem Verkauf fällt die Grundstückgewinnsteuer an. Haben Sie das Haus selbst bewohnt und kaufen Sie mit dem Erlös innert angemessener Frist wieder ein selbst bewohntes Haus oder eine Eigentumswohnung in der Schweiz, wird die Steuer für diesen Betrag aufgeschoben.',
        ],
      },
      {
        titel: 'Der erste Schritt: wissen, was Ihr Grundstück kann',
        absaetze: [
          'Welcher Weg passt, hängt vom Grundstück ab: wie gross es ist, in welcher Zone es liegt und wie viel darauf schon steht. Diese Angaben stehen in den amtlichen Registern von Bund und Kantonen. Für Ihre Adresse sehen Sie sie mit unserem Check in einer Minute, kostenlos.',
        ],
      },
    ],
    kasten: {
      titel: 'Wie viel Reserve hat Ihr Grundstück?',
      satz: 'Adresse eingeben und sehen, was die amtlichen Daten sagen: Fläche, Bauzone, Gebäude und Baujahr.',
      knopf: 'Grundstück kostenlos prüfen',
    },
    quellen: [
      { text: 'Raumplanungsgesetz, Art. 22 Abs. 1 (Baubewilligung)', url: 'https://www.fedlex.admin.ch/eli/cc/1979/1573_1573_1573/de#art_22' },
      { text: 'Steuerharmonisierungsgesetz, Art. 12 Abs. 3 Bst. e (Ersatzbeschaffung)', url: 'https://www.fedlex.admin.ch/eli/cc/1991/1256_1256_1256/de#art_12' },
    ],
    stand: '7. November 2026',
  },
];

export function artikelNachSlug(slug: string | null | undefined): Artikel | null {
  return ARTIKEL.find(a => a.slug === slug) ?? null;
}

/**
 * Wohin der Knopf zum Check führt: auf einer Marken-Domain die Startseite,
 * sonst die Vorschau. Die Werbekennungen der Anzeige reisen mit, damit der
 * Lead zeigt, dass er über den Ratgeber kam.
 */
export function zumCheck(o: { aufMarkenDomain: boolean; markeId: string; suche: string; slug: string }): string {
  const ziel = o.aufMarkenDomain ? '/' : `/check/${o.markeId}`;
  const u = new URLSearchParams(o.suche);
  if (!u.get('utm_content')) u.set('utm_content', `ratgeber-${o.slug}`);
  return `${ziel}?${u.toString()}`;
}

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
  /** Wohin der Knopf führt: der Grundstücks-Check (Vorgabe) oder der Heizungs-Check. */
  ziel?: 'check' | 'heizung';
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
        titel: 'Der erste Schritt: wissen, was auf Ihrem Grundstück möglich ist',
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
  {
    // Quellen am 15. November 2026 geöffnet: kantonale Energiegesetze (ZH, BS,
    // BL, UR, SH, ZG, TG, BE, LU, SG, GR, SZ), Kantonsmeldungen GL, AG, SO,
    // EnergieSchweiz, Gebäudeprogramm, DBG, Bundesrat, Gasnetze der Städte.
    slug: 'heizung-ersetzen',
    rubrik: 'Heizen und Energie',
    titel: 'Öl- oder Gasheizung ersetzen. Was gilt, was es kostet, wer mitzahlt',
    lead: 'Rund 20 Jahre hält eine Öl- oder Gasheizung. Danach steht ein Entscheid an, der für die nächsten 20 Jahre zählt. Hier steht, was Ihr Kanton beim Ersatz verlangt, was eine Wärmepumpe im Vergleich kostet und wo es Geld zurück gibt.',
    lesezeit: '7 Minuten',
    ziel: 'heizung',
    abschnitte: [
      {
        titel: 'Solange sie läuft, muss sie nicht weg',
        absaetze: [
          'Eine funktionierende Öl- oder Gasheizung müssen Sie nicht ersetzen. Die Vorschriften greifen erst, wenn der Wärmeerzeuger ersetzt wird. Öl- und Gasheizungen halten im Schnitt rund 20 Jahre.',
          'EnergieSchweiz rät, den Ersatz zu planen, sobald die Heizung älter als zehn Jahre ist. Fällt sie im Winter plötzlich aus, kommen Sie unter Zeitdruck, und die Regeln für den Ersatz gelten auch dann.',
        ],
      },
      {
        titel: 'Was beim Ersatz gilt: Das hängt vom Kanton ab',
        absaetze: [
          'Die Kantone haben gemeinsame Mustervorschriften, setzen sie aber verschieden streng um. Die Grundregel in vielen Kantonen: Beim Ersatz in einem Wohnhaus müssen mindestens 10 Prozent der Wärme erneuerbar sein. Das ist erfüllt mit einer Wärmepumpe, einer Holzheizung oder einem Anschluss an die Fernwärme, aber auch mit Sonnenkollektoren, neuen Fenstern oder einer Dämmung als sogenannte Standardlösung.',
          'Strenger sind einige Kantone. Zürich verlangt seit September 2022 erneuerbare Energie, wenn das technisch möglich ist und die Kosten über die Lebensdauer höchstens 5 Prozent höher sind. Basel-Stadt verlangt den Umstieg, wo er technisch möglich ist und keine Mehrkosten verursacht, Basel-Landschaft seit 2026 bei Heizungen über 15 Jahre, soweit technisch möglich und wirtschaftlich. Glarus verlangt bei Wohnbauten seit 2023 eine Heizung ganz ohne fossile Brennstoffe. In Uri gilt seit Oktober 2026: erneuerbar, soweit wirtschaftlich verhältnismässig, und ab 2030 keine neuen fossilen Heizungen mehr.',
          'Dazwischen liegen Schaffhausen mit 40 Prozent erneuerbarem Anteil, Zug mit 20 und Thurgau mit 15 Prozent. In Solothurn hat das Stimmvolk im Februar 2025 ein neues Energiegesetz abgelehnt; dort gibt es beim Heizungsersatz bis heute keine solche Vorgabe. Zürich kennt für finanzielle Härtefälle einen Aufschub, längstens bis drei Jahre nach der nächsten Handänderung, etwa einem Verkauf.',
        ],
      },
      {
        titel: 'Melden oder bewilligen lassen',
        absaetze: [
          'In den meisten Kantonen muss der Heizungsersatz gemeldet oder bewilligt werden, im Kanton Zürich ist jeder Ersatz ein bewilligungspflichtiger Umbau. Für eine Erdsonde braucht es immer eine Bewilligung, erste Anlaufstelle ist die Gemeinde. Für Luft-Wasser-Wärmepumpen im Freien verlangen manche Kantone einen Lärmschutznachweis. Klären Sie das mit dem Installateur, bevor Sie bestellen.',
        ],
      },
      {
        titel: 'Was es kostet: teurer am Anfang, günstiger über die Jahre',
        absaetze: [
          'EnergieSchweiz hat es für ein Einfamilienhaus im Kanton Bern mit 2\'400 Litern Heizöl im Jahr durchgerechnet. Eine neue Ölheizung kostet in der Anschaffung 23\'000 Franken, eine Luft-Wasser-Wärmepumpe 42\'000 Franken abzüglich 6\'000 Franken Förderung, eine Wärmepumpe mit Erdsonde 60\'000 Franken abzüglich 10\'000 Franken Förderung.',
          'Über 20 Jahre gerechnet dreht sich das Bild: Die Ölheizung kostet rund 96\'400 Franken, die Erdsonde rund 88\'700 und die Luft-Wasser-Wärmepumpe rund 79\'900 Franken. Für Ihr Haus rechnet der Heizkostenrechner von EnergieSchweiz mit Ihren eigenen Zahlen.',
        ],
        kasten: true,
      },
      {
        titel: 'Förderung: vor Baubeginn beantragen',
        absaetze: [
          'Das Gebäudeprogramm von Bund und Kantonen fördert den Ersatz fossiler Heizungen durch Heizungen mit erneuerbarer Energie oder durch einen Anschluss an ein Wärmenetz. Wie viel es gibt, legt jeder Kanton selbst fest. Wichtig: Das Gesuch muss vor Baubeginn eingereicht sein, sonst gibt es nichts.',
          'Dazu kommen oft Beiträge von Gemeinden und Energieversorgern. Auf energiefranken.ch sehen Sie mit Ihrer Postleitzahl alle Programme für Ihr Haus.',
        ],
      },
      {
        titel: 'Steuern: Der Abzug gilt nur noch bis Ende 2028',
        absaetze: [
          'Heute dürfen Sie Investitionen, die Energie sparen oder erneuerbare Energie nutzen, bei den Steuern wie Unterhaltskosten abziehen, abzüglich der Förderbeiträge. Ist der Betrag grösser als Ihr Einkommen in diesem Jahr, lässt er sich auf die zwei folgenden Steuerjahre verteilen.',
          'Mit der Abschaffung des Eigenmietwerts ab dem 1. Januar 2029 fällt dieser Abzug bei der direkten Bundessteuer weg. Die Kantone dürfen ihn noch eine Zeit lang behalten. Wer ohnehin bald ersetzen muss, hat damit einen Grund mehr, nicht bis nach 2028 zu warten.',
        ],
      },
      {
        titel: 'Gasheizung in der Stadt: Das Netz wird stillgelegt',
        absaetze: [
          'Mehrere Städte legen ihr Gasnetz still. In Basel-Stadt geschieht das schrittweise bis 2037, die IWB kündigen es drei bis vier Jahre im Voraus an. In der Stadt Zürich soll spätestens 2040 kein fossiles Gas mehr fliessen, die ersten Gebiete folgen ab 2030. In Winterthur müssen rund zwei Drittel der Häuser mit Gas bis Ende 2033 wechseln. Basel und Winterthur zahlen für jüngere Gasheizungen eine Entschädigung für den Restwert.',
        ],
      },
      {
        titel: 'Der erste Schritt: wissen, was im Register steht',
        absaetze: [
          'Welche Heizung im Gebäuderegister eingetragen ist, wie alt das Haus ist, ob eine Heizzentrale für Fernwärme in der Nähe liegt und wie gut sich Ihr Dach für Solarstrom eignet: Das zeigt der Heizungs-Check für Ihre Adresse in einer Minute, kostenlos. Mit diesen Angaben gehen Sie gut vorbereitet ins Gespräch mit Installateur und Energieberatung.',
        ],
      },
    ],
    kasten: {
      titel: 'Welche Heizung steht im Register?',
      satz: 'Adresse eingeben und sehen: Heizung und Baujahr laut Gebäuderegister, Fernwärme in der Nähe und wie gut sich Ihr Dach für Solarstrom eignet.',
      knopf: 'Heizung kostenlos prüfen',
    },
    quellen: [
      { text: 'EnergieSchweiz: Gesetzgebung der Kantone zum Heizungsersatz', url: 'https://www.energieschweiz.ch/modernisieren/gesetzgebung/' },
      { text: 'MuKEn 2014, Art. 1.29 bis 1.31 (Heizungsersatz, Standardlösungen)', url: 'https://energiehub-gebaeude.ch/energiepolitik-der-kantone/muken-2014/' },
      { text: 'Kanton Zürich: Heizungsersatz', url: 'https://www.zh.ch/de/planen-bauen/bauvorschriften/bauvorschriften-gebaeude-energie/heizungsersatz.html' },
      { text: 'Energiegesetz Basel-Stadt, § 7', url: 'https://www.gesetzessammlung.bs.ch/app/de/texts_of_law/772.100' },
      { text: 'Kanton Basel-Landschaft: Heizungsersatz', url: 'https://www.baselland.ch/politik-und-behorden/direktionen/bau-und-umweltschutzdirektion/umweltschutz-energie/energie/heizungsersatz/' },
      { text: 'Kanton Glarus: Vollzug des Energiegesetzes (21. Mai 2026)', url: 'https://www.gl.ch/public-newsroom.html/31/newsroomnews/15132/title/vollzug-des-energiegesetzes-im-kanton-glarus-verl%C3%A4uft-reibungslos' },
      { text: 'Energiegesetz Uri, Art. 11', url: 'https://rechtsbuch.ur.ch/app/de/texts_of_law/40.7211' },
      { text: 'Energiegesetz Zug, § 4c', url: 'https://bgs.zg.ch/app/de/texts_of_law/740.1' },
      { text: 'Energienutzungsgesetz Thurgau, § 8a', url: 'https://www.rechtsbuch.tg.ch/app/de/texts_of_law/731.1' },
      { text: 'Kanton Solothurn: Nein zum Energiegesetz (9. Februar 2025)', url: 'https://so.ch/verwaltung/staatskanzlei/medien/medienmitteilung/news/energiegesetz-mehrheit-sagt-nein/' },
      { text: 'EnergieSchweiz: Erdsondenbohrung', url: 'https://www.energieschweiz.ch/wohnen/heizungssysteme/erdsondenbohrung/' },
      { text: 'EnergieSchweiz: Erneuerung der Heizung, zu erwartende Kosten', url: 'https://www.energieschweiz.ch/stories/erneuerung-der-heizung-zu-erwartende-kosten/' },
      { text: 'Das Gebäudeprogramm: Förderung', url: 'https://www.dasgebaeudeprogramm.ch/de/das-gebaudeprogramm/forderung/' },
      { text: 'Energiefranken: Förderprogramme nach Postleitzahl', url: 'https://www.energiefranken.ch/de' },
      { text: 'DBG Art. 32 Abs. 2 (Abzug für Energiesparen)', url: 'https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de#art_32' },
      { text: 'Liegenschaftskostenverordnung, Art. 1', url: 'https://www.fedlex.admin.ch/eli/cc/2018/212/de' },
      { text: 'Bundesrat: Reform der Wohneigentumsbesteuerung ab 1. Januar 2029', url: 'https://www.news.admin.ch/de/newnsb/yGTqBPowRqyVh0zPokW-q' },
      { text: 'Basel-Stadt: Restwertentschädigung für Gasheizungen', url: 'https://www.bs.ch/wsu/aue/abteilung-energie/foerderbeitraege-energie/restwertentschaedigung' },
      { text: 'Stadt Zürich: Ablösung des Gasnetzes', url: 'https://www.stadt-zuerich.ch/de/umwelt-und-energie/energie/abloesung-gasnetz.html' },
      { text: 'Stadtwerk Winterthur: Zukunft des Gasnetzes', url: 'https://stadtwerk.winterthur.ch/Angebot/Gas/Zukunft-Winterthurer-Gasnetz' },
    ],
    stand: '15. November 2026',
  },
  {
    // Quellen am 15. November 2026 geöffnet: RPG und ZGB (Stand 1.7.2026),
    // OR, VMWG, IVHB (BPUK), PBG und EnerG ZH, BAFU, Wüest Partner/Lignum.
    // Einen seriösen Kostenrichtwert je m² für Aufstockungen gibt es nicht;
    // darum steht hier keine Zahl.
    slug: 'aufstocken',
    rubrik: 'Bauen und Erweitern',
    titel: 'Aufstocken. Wann es erlaubt ist und was Sie vorher klären sollten',
    lead: 'Ein Geschoss mehr auf dem bestehenden Haus schafft Wohnraum, ohne zusätzlichen Boden zu brauchen. Ob es erlaubt ist, entscheidet die Bau- und Zonenordnung Ihrer Gemeinde. Hier steht, welche Regeln zählen und was Sie vor dem ersten Plan klären sollten.',
    lesezeit: '6 Minuten',
    abschnitte: [
      {
        titel: 'Ohne Bewilligung geht es nicht',
        absaetze: [
          'Bauten dürfen nur mit behördlicher Bewilligung errichtet oder geändert werden. So steht es im Raumplanungsgesetz des Bundes, und eine Aufstockung ist eine solche Änderung. Bewilligt wird sie, wenn sie der Zone entspricht, das Land erschlossen ist und die Vorschriften von Kanton und Gemeinde eingehalten sind.',
          'Der Bund will, dass die Schweiz nach innen wächst. Seit 2014 verlangt das Raumplanungsgesetz, die Siedlungsentwicklung nach innen zu lenken und ungenügend genutzte Flächen in Bauzonen besser zu nutzen. Aufstocken ist genau das. Einen Anspruch darauf gibt es trotzdem nicht: Massgebend bleibt die Ordnung Ihrer Gemeinde.',
        ],
      },
      {
        titel: 'Erste Frage: Ist noch Fläche frei?',
        absaetze: [
          'Wie viel auf einem Grundstück stehen darf, legt die Gemeinde mit einer Nutzungsziffer fest. In vielen Kantonen ist das die Ausnützungsziffer: das Verhältnis der anrechenbaren Geschossfläche zur anrechenbaren Grundstücksfläche. Andere verwenden die Geschossflächenziffer oder die Baumassenziffer, die das Bauvolumen über dem Terrain misst.',
          'Ein Beispiel: Auf 600 m² Grundstück mit einer Ausnützungsziffer von 0,4 sind 240 m² anrechenbare Geschossfläche erlaubt. Hat das Haus heute 180 m², bleiben rechnerisch 60 m². Welche Flächen angerechnet werden, ist im Detail geregelt. Im Kanton Zürich etwa zählen Dach- und Attikageschosse nur, soweit sie einen bestimmten Anteil übersteigen.',
        ],
        kasten: true,
      },
      {
        titel: 'Zweite Frage: Geschosse, Höhe und Abstände',
        absaetze: [
          'Auch wenn Fläche frei ist, setzen weitere Regeln Grenzen: die zulässige Zahl der Vollgeschosse, die Gesamt- und die Fassadenhöhe sowie die Abstände zur Grenze und zu den Nachbarhäusern. Viele Zonen erlauben über den Vollgeschossen ein Dachgeschoss unter dem Schrägdach oder ein Attikageschoss auf dem Flachdach. Ein Attikageschoss muss mindestens auf einer ganzen Fassadenseite zurückversetzt sein.',
          'Wie diese Masse gemessen werden, haben die meisten Kantone der Deutschschweiz vereinheitlicht. Die Zahlen selbst setzen Kanton und Gemeinde. Steht das Haus in einem geschützten Ortsbild oder ist es selbst geschützt, nimmt die Behörde bei der Gestaltung besondere Rücksicht.',
        ],
      },
      {
        titel: 'Dritte Frage: Trägt das Haus ein Geschoss mehr?',
        absaetze: [
          'Ob der Bestand die zusätzliche Last trägt, prüft eine Bauingenieurin oder ein Bauingenieur nach der Norm SIA 269 für die Erhaltung von Tragwerken. Dazu kommt die Erdbebensicherheit: Laut Bundesamt für Umwelt sind Eigentümer seit 2003 verpflichtet, sie überprüfen zu lassen, spätestens bei einem grösseren Umbau. Eine Aufstockung ist ein solcher Anlass.',
        ],
      },
      {
        titel: 'Für das neue Geschoss gelten die Regeln für Neubauten',
        absaetze: [
          'Im Kanton Zürich verlangt das Energiegesetz ausdrücklich, dass Aufstockungen möglichst wenig Energie brauchen. Die neue Fläche muss ohne fossile Brennstoffe beheizt werden. Ausgenommen sind kleine Erweiterungen mit weniger als 50 m² neuer beheizter Fläche oder höchstens 20 Prozent des bestehenden Gebäudes. Andere Kantone kennen ähnliche Regeln aus den gemeinsamen Mustervorschriften der Kantone im Energiebereich.',
        ],
      },
      {
        titel: 'Stockwerkeigentum und Mieter',
        absaetze: [
          'Im Stockwerkeigentum gehören Dach und Tragwerk allen gemeinsam. Für bauliche Massnahmen gelten die Regeln des Miteigentums. Wertsteigernde Umbauten brauchen mindestens die Mehrheit der Eigentümer, die zugleich den grösseren Teil des Hauses vertritt. Ändern sich die Wertquoten, müssen alle direkt Betroffenen zustimmen und die Versammlung muss es genehmigen. Ob für Ihr Haus die Mehrheit genügt, klären Sie früh mit Verwaltung und Notariat.',
          'Ist das Haus vermietet, darf der Mietzins nach einer wertvermehrenden Investition steigen, aber erst, wenn die Arbeiten ausgeführt sind, und nur mit dem amtlichen Formular.',
        ],
      },
      {
        titel: 'Was kostet eine Aufstockung?',
        absaetze: [
          'Verlässliche Richtwerte pro Quadratmeter gibt es kaum, zu verschieden sind Häuser, Zugang und Ausbau. Eine Studie von Wüest Partner für Lignum und das Bundesamt für Umwelt kam 2024 zum Schluss, dass eine Aufstockung bei gleicher Fläche wirtschaftlich besser abschneidet als ein Neubau. Was es bei Ihrem Haus kostet, zeigt erst die Kostenschätzung einer Architektin oder eines Architekten.',
        ],
      },
      {
        titel: 'Der erste Schritt: wissen, was auf dem Grundstück erlaubt ist',
        absaetze: [
          'Ob noch Fläche frei ist, lässt sich mit den amtlichen Daten grob abschätzen: Grundstücksfläche, Bauzone und die Gebäude laut Register. Für Ihre Adresse sehen Sie das mit unserem Check in einer Minute, kostenlos. Die verbindliche Antwort gibt die Baubehörde Ihrer Gemeinde.',
        ],
      },
    ],
    kasten: {
      titel: 'Ist auf Ihrem Grundstück noch Fläche frei?',
      satz: 'Adresse eingeben und sehen, was die amtlichen Daten sagen: Fläche, Bauzone, Gebäude und ein Rechner für die Ausnützung.',
      knopf: 'Grundstück kostenlos prüfen',
    },
    quellen: [
      { text: 'Raumplanungsgesetz, Art. 22 (Baubewilligung)', url: 'https://www.fedlex.admin.ch/eli/cc/1979/1573_1573_1573/de#art_22' },
      { text: 'Raumplanungsgesetz, Art. 1 und 3 (Siedlungsentwicklung nach innen)', url: 'https://www.fedlex.admin.ch/eli/cc/1979/1573_1573_1573/de#art_1' },
      { text: 'IVHB, Anhang 1: Begriffe und Messweisen (BPUK)', url: 'https://www.bpuk.ch/fileadmin/Dokumente/bpuk/public/de/konkordate/ivhb/Begriffe%2Bund%2BMessweisen%2B%28Anhang%2B1%29.pdf' },
      { text: 'Kanton Zürich: Harmonisierung der Baubegriffe', url: 'https://www.zh.ch/de/planen-bauen/baubewilligung/infos-baubehoerden-fachstellen/harmonisierung-baubegriffe.html' },
      { text: 'Planungs- und Baugesetz ZH, §§ 238, 251, 255 (LS 700.1)', url: 'https://www.zh.ch/de/politik-staat/gesetze-beschluesse/gesetzessammlung/zhlex-ls/erlass-700_1-1975_09_07-1976_04_01-134.html' },
      { text: 'Energiegesetz ZH, § 10a (LS 730.1)', url: 'https://www.notes.zh.ch/appl/zhlex_r.nsf/WebView/52C0F42987AC41E1C1258CB40025CB78/$File/730.1_19.6.83_129.pdf' },
      { text: 'Kanton Zürich: Musterbewilligungen Energiegesetz (29.11.2022)', url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/planen-bauen/bauvorschriften/bauvorschriften-im-energiebereich/infos-fuer-gemeinden/Energiegesetz%20Musterbewilligungen_29.11.2022.pdf' },
      { text: 'Bundesamt für Umwelt: Erdbebensicherheit bestehender Bauten', url: 'https://www.bafu.admin.ch/de/bestehende-bauten' },
      { text: 'ZGB Art. 647d, 712b, 712e und 712g (Stockwerkeigentum)', url: 'https://www.fedlex.admin.ch/eli/cc/24/233_245_233/de#art_712_g' },
      { text: 'VMWG Art. 14 (Mehrleistungen des Vermieters)', url: 'https://www.fedlex.admin.ch/eli/cc/1990/835_835_835/de#art_14' },
      { text: 'Wüest Partner: Holzbaukennzahlen für Investoren (Lignum, BAFU, 2024)', url: 'https://timberfinance.ch/wp-content/uploads/2025/07/202504-Abschlussbericht_Holzbaukennzahlen_Wust-Partner.pdf' },
    ],
    stand: '15. November 2026',
  },
  {
    // Quellen am 15. November 2026 geöffnet: ZGB, StHG, DBG in der geltenden
    // Fassung (Fedlex), ESTV-Dossiers, EFD und Bundesrat zum Eigenmietwert.
    slug: 'liegenschaft-geerbt',
    rubrik: 'Erben',
    titel: 'Liegenschaft geerbt. Behalten, vermieten oder verkaufen?',
    lead: 'Mit dem Tod der Eltern gehört ihr Haus von einem Tag auf den anderen allen Erben gemeinsam. Bald stellt sich die Frage, was damit geschehen soll. Hier steht, was das Gesetz sagt, welche drei Wege es gibt und welche Steuern anfallen.',
    lesezeit: '6 Minuten',
    abschnitte: [
      {
        titel: 'Das Haus gehört allen Erben gemeinsam',
        absaetze: [
          'Die Erben erwerben die Erbschaft mit dem Tod kraft Gesetzes, das Haus eingeschlossen. Bis zur Teilung bilden sie eine Erbengemeinschaft und sind Gesamteigentümer. Sie entscheiden gemeinsam: Verkaufen oder belasten kann niemand allein.',
          'Ins Grundbuch kommen die Erben mit der Erbbescheinigung. Eigentümer sind sie schon vorher, verkaufen können sie aber erst nach dem Eintrag. Mit dem Haus gehen auch die Schulden über, etwa die Hypothek. Für sie haften die Erben gemeinsam, und zwar noch bis fünf Jahre nach der Teilung.',
        ],
      },
      {
        titel: 'Jeder Erbe kann die Teilung verlangen',
        absaetze: [
          'Die Erbengemeinschaft ist eine Lösung auf Zeit. Jeder Erbe kann jederzeit die Teilung verlangen, ausser ein Vertrag oder das Gesetz verpflichtet ihn zum Bleiben. Wie geteilt wird, können die Erben frei vereinbaren, sofern im Testament nichts anderes steht.',
          'Ein Haus lässt sich nicht in Stücke teilen, ohne an Wert zu verlieren. Das Gesetz sieht deshalb vor, dass es einem Erben ganz zugewiesen wird. Einigen sich die Erben nicht, wird es verkauft und der Erlös geteilt. Verlangt ein Erbe eine Versteigerung, wird versteigert. Lebt der überlebende Ehepartner im Haus, kann er verlangen, dass es ihm auf Anrechnung an seinen Erbteil zugeteilt wird.',
        ],
      },
      {
        titel: 'Weg 1: Ein Erbe übernimmt das Haus',
        absaetze: [
          'Oft möchte eines der Kinder das Elternhaus behalten. Es übernimmt das Haus zu einem Anrechnungswert, und was es damit mehr erhält als die Geschwister, gleicht es aus, zum Beispiel mit einer Auszahlung.',
          'Angerechnet wird das Haus zum Verkehrswert im Zeitpunkt der Teilung, nicht zum Wert am Todestag und nicht zum Steuerwert. Können sich die Erben über den Wert nicht einigen, schätzen ihn amtlich bestellte Sachverständige. Der Teilungsvertrag muss schriftlich sein. Mit ihm wird der neue Eigentümer im Grundbuch eingetragen.',
          'Viele Kantone erheben beim Erbgang keine Handänderungssteuer. Übernimmt ein Erbe das Haus aber erst nach der Teilung, kann auf den Anteil der Geschwister eine Steuer anfallen, so in St. Gallen und Appenzell Innerrhoden. Fragen Sie beim Grundbuchamt nach, bevor Sie unterschreiben.',
        ],
        kasten: true,
      },
      {
        titel: 'Weg 2: Gemeinsam behalten und vermieten',
        absaetze: [
          'Die Erben können das Haus auch gemeinsam behalten und vermieten. Die Mieteinnahmen sind steuerbares Einkommen. Für alles, was über die Verwaltung hinausgeht, braucht es die Zustimmung aller Erben, und jeder kann später doch noch die Teilung verlangen. Das geht gut, solange alle dasselbe wollen.',
          'Ab 2029 wird Wohneigentum anders besteuert: Das Stimmvolk hat die Reform am 28. September 2025 angenommen, der Bundesrat setzt sie auf den 1. Januar 2029 in Kraft. Für selbst bewohnte Häuser fallen dann der Eigenmietwert und der Abzug für den Unterhalt weg. Bei vermieteten Häusern bleibt der Unterhalt abziehbar, Schuldzinsen nur noch im Verhältnis zum Wert der vermieteten Liegenschaften.',
        ],
      },
      {
        titel: 'Weg 3: Verkaufen und den Erlös teilen',
        absaetze: [
          'Wollen die Erben das Haus nicht behalten, verkaufen sie es gemeinsam und teilen den Erlös. Auf dem Gewinn fällt die Grundstückgewinnsteuer an. Der Erbgang selbst löst sie nicht aus, sie wird aufgeschoben.',
          'Das hat eine Folge, die viele überrascht: Beim Verkauf zählt als Kaufpreis der Preis, den die Eltern einst bezahlt haben, nicht der Wert beim Erbgang. Wer ein Haus verkauft, das die Eltern vor Jahrzehnten gekauft haben, versteuert deshalb einen entsprechend grossen Gewinn. Kurzfristige Gewinne besteuern die Kantone stärker. Im Kanton Zürich zählt für die Besitzdauer der Kauf durch die Eltern, nicht der Erbgang.',
        ],
      },
      {
        titel: 'Erbschaftssteuer: für Kinder fast überall keine',
        absaetze: [
          'Der Bund erhebt keine Erbschaftssteuer, die Kantone schon. Ehepartner sind in allen Kantonen befreit, Kinder in fast allen Kantonen der Deutschschweiz. Schwyz und Obwalden kennen gar keine Erbschaftssteuer. Für das Haus gilt der Kanton, in dem es steht.',
          'Es gibt Ausnahmen. In Appenzell Innerrhoden zahlen Kinder 1 Prozent, nach einem Abzug von 300\'000 Franken je Kind. Im Kanton Luzern dürfen die Gemeinden eine Steuer auf Erbteile von Kindern erheben, die 100\'000 Franken übersteigen. Solothurn erhebt eine Nachlasssteuer auf dem ganzen Nachlass, auch wenn Kinder erben.',
        ],
      },
      {
        titel: 'Für Eltern: das Haus schon heute regeln',
        absaetze: [
          'Seit dem 1. Januar 2023 ist der Pflichtteil der Kinder kleiner: die Hälfte ihres gesetzlichen Erbteils statt drei Viertel. Eltern der Verstorbenen haben keinen Pflichtteil mehr. Wer möchte, dass ein bestimmtes Kind das Haus übernimmt, hat im Testament damit mehr Spielraum. Lassen Sie sich dafür vom Notariat beraten.',
        ],
      },
      {
        titel: 'Der erste Schritt: wissen, was im Grundstück steckt',
        absaetze: [
          'Welcher Weg passt, hängt auch vom Haus ab: wie gross das Grundstück ist, in welcher Zone es liegt und ob mehr gebaut werden dürfte. Reserve macht ein Grundstück für Käufer wertvoller, und für einen Erben, der bleibt, kann sie eine zweite Wohnung bedeuten. Die Angaben stehen in den amtlichen Registern. Für Ihre Adresse sehen Sie sie mit unserem Check in einer Minute, kostenlos.',
        ],
      },
    ],
    kasten: {
      titel: 'Was steckt im geerbten Grundstück?',
      satz: 'Adresse eingeben und sehen, was die amtlichen Daten sagen: Fläche, Bauzone, Gebäude, Baujahr und ob mehr gebaut werden dürfte.',
      knopf: 'Grundstück kostenlos prüfen',
    },
    quellen: [
      { text: 'ZGB Art. 560 (Erwerb mit dem Tod)', url: 'https://www.fedlex.admin.ch/eli/cc/24/233_245_233/de#art_560' },
      { text: 'ZGB Art. 602 (Erbengemeinschaft, Gesamteigentum)', url: 'https://www.fedlex.admin.ch/eli/cc/24/233_245_233/de#art_602' },
      { text: 'ZGB Art. 604 (Anspruch auf Teilung)', url: 'https://www.fedlex.admin.ch/eli/cc/24/233_245_233/de#art_604' },
      { text: 'ZGB Art. 612 und 612a (Zuweisung, Verkauf, Ehegatte)', url: 'https://www.fedlex.admin.ch/eli/cc/24/233_245_233/de#art_612' },
      { text: 'ZGB Art. 617 und 618 (Anrechnung zum Verkehrswert, Schätzung)', url: 'https://www.fedlex.admin.ch/eli/cc/24/233_245_233/de#art_617' },
      { text: 'ZGB Art. 634 (Teilungsvertrag schriftlich)', url: 'https://www.fedlex.admin.ch/eli/cc/24/233_245_233/de#art_634' },
      { text: 'ZGB Art. 639 (Haftung nach der Teilung)', url: 'https://www.fedlex.admin.ch/eli/cc/24/233_245_233/de#art_639' },
      { text: 'ZGB Art. 471 (Pflichtteil seit 1. Januar 2023)', url: 'https://www.fedlex.admin.ch/eli/cc/24/233_245_233/de#art_471' },
      { text: 'StHG Art. 12 (Grundstückgewinnsteuer, Aufschub bei Erbgang)', url: 'https://www.fedlex.admin.ch/eli/cc/1991/1256_1256_1256/de#art_12' },
      { text: 'ESTV: Erbschafts- und Schenkungssteuern (Stand 1.1.2025)', url: 'https://www.estv2.admin.ch/stp/ds/d-erbschaft-schenkung-de.pdf' },
      { text: 'ESTV: Besteuerung der Grundstückgewinne (Stand 1.1.2024)', url: 'https://www.estv2.admin.ch/stp/ds/d-besteuerung-grundstueckgewinne-de.pdf' },
      { text: 'ESTV: Handänderungssteuer (Stand 1.1.2022)', url: 'https://www.estv2.admin.ch/stp/ds/d-handaenderungssteuer-de.pdf' },
      { text: 'EFD: Abstimmung zur Wohneigentumsbesteuerung vom 28. September 2025', url: 'https://www.efd.admin.ch/de/abstimmung-reform-wohneigentumsbesteuerung' },
      { text: 'Bundesrat: Inkrafttreten am 1. Januar 2029 (1. April 2026)', url: 'https://www.admin.ch/de/newnsb/yGTqBPowRqyVh0zPokW-q' },
    ],
    stand: '15. November 2026',
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
export function zumCheck(o: { aufMarkenDomain: boolean; markeId: string; suche: string; slug: string; heizung?: boolean }): string {
  const ziel = o.aufMarkenDomain ? (o.heizung ? '/heizung' : '/') : `/check/${o.markeId}${o.heizung ? '/heizung' : ''}`;
  const u = new URLSearchParams(o.suche);
  if (!u.get('utm_content')) u.set('utm_content', `ratgeber-${o.slug}`);
  return `${ziel}?${u.toString()}`;
}

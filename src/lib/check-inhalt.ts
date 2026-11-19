// Texte der Check-Seite, die auch im festen HTML stehen (seo-marken.ts):
// so lesen Google und KI-Leser, die kein JavaScript ausführen, dasselbe wie
// ein Mensch. Ohne "@/"-Pfade, weil vite.config.ts diese Datei lädt.
import { BETREIBER } from './check-marken';

export const SCHRITTE: [string, string][] = [
  ['Adresse eingeben', 'Wir finden Ihre Parzelle in der amtlichen Vermessung, schweizweit.'],
  ['Daten sehen und rechnen', 'Fläche, Bauzone, Gebäude und Baujahr, dazu ein Rechner für die Ausnützung.'],
  ['Analyse erhalten', 'Fachleute prüfen die Bau- und Zonenordnung Ihrer Gemeinde und melden sich innert zwei Arbeitstagen, auf Wunsch mit einem unverbindlichen Kaufangebot.'],
];

export const DATENQUELLEN = ['Amtliche Vermessung', 'Bauzonen Schweiz (ARE)', 'Gebäude- und Wohnungsregister (BFS)', 'Luftbilder swisstopo'];

export const FRAGEN: [string, string][] = [
  ['Was kostet die Berechnung?', 'Nichts. Die Prüfung mit den amtlichen Daten, der Rechner und die ausführliche Analyse sind kostenlos und unverbindlich.'],
  ['Woher stammen die Daten?', 'Aus den amtlichen Registern: Parzellen aus der amtlichen Vermessung von Bund und Kantonen, Bauzonen aus den Bauzonen Schweiz des Bundesamts für Raumentwicklung, Gebäude aus dem Gebäude- und Wohnungsregister des Bundesamts für Statistik.'],
  ['Wie genau ist der Rechner?', 'Er rechnet mit der Ausnützung, die Sie einstellen, und mit Grundfläche und Geschossen der Gebäude laut Register. Das ergibt einen Richtwert. Unter der Rechnung steht jede Zahl mit Fundstelle: woher der Wert kommt und welcher Artikel des Baugesetzes sagt, wie er gemessen wird. Welche Ausnützung in Ihrer Gemeinde gilt und was davon nutzbar ist, prüfen unsere Fachleute in der Analyse.'],
  ['Wer steckt dahinter?', `${BETREIBER}. Wir begleiten Eigentümer bei Verkauf und Entwicklung von Liegenschaften und kaufen auch selbst. Die vollständigen Angaben finden Sie im Impressum.`],
  ['Machen Sie auch ein Angebot für mein Grundstück?', 'Auf Wunsch ja: ein schriftliches, unverbindliches Kaufangebot, kostenlos, ohne Makler und ohne Provision. Sie entscheiden danach in Ruhe, ob Sie darüber reden möchten.'],
  // Was ein Eigentümer als Erstes misstraut, ehrlich beantwortet (19. November, nach dem Vergleich mit
  // eigenheimkompass.ch: «Verdient ihr an Banken, Maklern oder Verkäufern?»).
  ['Warum ist der Check kostenlos?', 'Weil wir Eigentümer bei Verkauf und Entwicklung begleiten und Grundstücke auch selbst kaufen. Der Check ist unser Weg, Eigentümer kennenzulernen, die über ihr Grundstück nachdenken. Sie bezahlen nichts, auch nicht für die Analyse oder das Kaufangebot.'],
  ['Ersetzt der Check eine Bauanfrage oder einen Architekten?', 'Nein. Der Check zeigt, was die amtlichen Daten sagen und was die Bauzone erlaubt. Was hinter den Wänden steckt, sieht er nicht, und verbindlich entscheidet erst die Gemeinde über ein Baugesuch. Wie viel auf Ihrem Grundstück wirklich möglich ist, prüfen unsere Fachleute in der Analyse.'],
  ['Muss ich verkaufen?', 'Nein. Die Analyse verpflichtet Sie zu nichts. Viele Eigentümer möchten einfach wissen, was auf ihrem Grundstück möglich ist.'],
  ['Was passiert mit meinen Angaben?', 'Wir verwenden sie für Ihre Berechnung und Analyse und um Sie zu Ihrer Liegenschaft zu kontaktieren. An Dritte geben wir sie nicht weiter. Sie können Ihre Einwilligung jederzeit widerrufen.'],
];

/**
 * Wo der Check hingehört, neben Online-Bewertung und Makler (19. November,
 * nach dem Vergleich mit eigenheimkompass.ch, dort «Wo das Dossier
 * hingehört»). Ehrlich auch mit dem, was der Check nicht kann: er schaut
 * nicht vor Ort. Über die anderen nur, was für sie üblich ist, ohne Zahlen,
 * die wir nicht belegen können.
 */
export const VERGLEICH: { spalten: [string, string, string]; zeilen: [string, string, string, string][] } = {
  spalten: ['Online-Bewertung', 'Unser Check', 'Makler'],
  zeilen: [
    ['Kosten', 'meist kostenlos', 'kostenlos', 'Provision beim Verkauf'],
    ['Dauer', 'Minuten', 'Minuten, die Analyse innert zwei Arbeitstagen', 'Termin vor Ort, dann Tage'],
    ['Ergebnis', 'geschätzter Marktwert', 'was die Bauzone erlaubt und was davon noch frei ist', 'Verkaufspreis und Vermarktung'],
    ['Amtliche Daten zu Ihrer Parzelle', 'selten', 'Vermessung, Bauzone, Gebäuderegister, ÖREB-Kataster', 'auf Anfrage'],
    ['Jede Zahl mit Fundstelle', 'nein', 'ja, mit Gesetzesartikel und Zitat', 'selten'],
    ['Kaufangebot', 'nein', 'auf Wunsch, schriftlich und unverbindlich', 'nein, er sucht Käufer'],
    ['Blick vor Ort', 'nein', 'nein, amtliche Daten und Luftbild', 'ja'],
  ],
};

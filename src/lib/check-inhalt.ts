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
  ['Muss ich verkaufen?', 'Nein. Die Analyse verpflichtet Sie zu nichts. Viele Eigentümer möchten einfach wissen, was auf ihrem Grundstück möglich ist.'],
  ['Was passiert mit meinen Angaben?', 'Wir verwenden sie für Ihre Berechnung und Analyse und um Sie zu Ihrer Liegenschaft zu kontaktieren. An Dritte geben wir sie nicht weiter. Sie können Ihre Einwilligung jederzeit widerrufen.'],
];

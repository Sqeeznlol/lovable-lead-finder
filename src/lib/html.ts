/**
 * Text für Stellen, die HTML erwarten (Leaflet-Tooltips nehmen einen
 * String als HTML). Adressen, Zonen und Portfolionamen kommen aus der
 * Datenbank und von Kunden -- roh eingesetzt liefe ein eingeschleustes
 * Skript mit der Sitzung des Betrachters (Sicherheitsprüfung, 1. November).
 */
export const sicher = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/**
 * Der Benutzername darf ohne Domain eingegeben werden; die Anmeldung
 * bei Supabase erwartet eine Adresse. "AUI" wird zu aui@wohntraums.life.
 * Rein, damit der Test es prüfen kann, ohne den Supabase-Client zu laden.
 */
export function kennungZuAdresse(benutzer: string): string {
  const b = benutzer.trim();
  return b.includes('@') ? b : `${b.toLowerCase()}@wohntraums.life`;
}

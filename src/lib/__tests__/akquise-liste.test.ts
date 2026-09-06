import { describe, it, expect } from 'vitest';
import { gehoertInDenAkquiseModus, nurNummerFehlt } from '../akquise-liste';

describe('gehoertInDenAkquiseModus', () => {
  it('nimmt auf, wo der Eigentümer feststeht und die Nummer fehlt', () => {
    // Der Fall aus dem Bestand: Parzelle 454, Diessenhofen.
    expect(gehoertInDenAkquiseModus({
      status: 'Telefonnummer gesucht',
      owner_name: 'Heinz Ulmer Immobilien AG',
      owner_phone: null,
    })).toBe(true);

    // Derselbe Fall unter dem anderen Namen, den die Anwendung setzt.
    expect(gehoertInDenAkquiseModus({
      status: 'Eigentümer ermittelt',
      owner_name: 'Rudolf Gubler',
    })).toBe(true);
  });

  it('nimmt die unangetasteten auf', () => {
    expect(gehoertInDenAkquiseModus({ status: 'Neu' })).toBe(true);
    expect(gehoertInDenAkquiseModus({ status: 'Offen' })).toBe(true);
  });

  it('lässt aus, was fertig ist', () => {
    expect(gehoertInDenAkquiseModus({
      status: 'Telefon gefunden',
      owner_name: 'Hans Müller',
      owner_phone: '+41 79 123 45 67',
    })).toBe(false);
    expect(gehoertInDenAkquiseModus({ status: 'Exportiert' })).toBe(false);
    expect(gehoertInDenAkquiseModus({ status: 'Neu', is_queried: true })).toBe(false);
  });

  it('lässt das Archiv aus', () => {
    expect(gehoertInDenAkquiseModus({
      status: 'Eigentümer ermittelt',
      owner_name: 'Stadt Winterthur',
      preselection_status: 'Ausschliessen',
    })).toBe(false);
  });

  it('lässt ohne Eigentümer die halbfertigen Zustände aus', () => {
    // Die stehen in der Übersicht und warten auf die Abfrage.
    expect(gehoertInDenAkquiseModus({ status: 'Kontaktiert' })).toBe(false);
  });
});

describe('nurNummerFehlt', () => {
  it('erkennt den Zwischenstand', () => {
    expect(nurNummerFehlt({ owner_name: 'A. Meier' })).toBe(true);
    expect(nurNummerFehlt({ owner_name: 'A. Meier', owner_phone: '+41…' })).toBe(false);
    expect(nurNummerFehlt({})).toBe(false);
  });
});

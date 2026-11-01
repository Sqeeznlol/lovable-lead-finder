import { describe, expect, it } from 'vitest';
import { alsKartengruppen, type Gel } from '../use-gelegenheiten';

const p = (id: string, egrid: string | null) => ({ id, address: `Weg ${id}`, owner_name: null, area: 500, gemeinde: 'Kloten', egrid });
const g = (id: string, zustand: Gel['zustand'], teile: Gel['gelegenheit_parzelle']): Gel => ({
  id, anlass: 'arrondierung', zustand, titel: `Arrondierung ${id}`, begruendung: null, zustaendig: null,
  erkannt_am: '2026-11-01', gemeldet_am: null, abgeschlossen_am: null, ergebnis: null, prioritaet: 1,
  fremde_nachbarn: null, mandant: { id: 'm', akteur: { name: 'Test AG' } }, gelegenheit_parzelle: teile,
});

describe('Gelegenheiten als Kartengruppen', () => {
  it('nimmt nur offene, mit Rolle und Zustand', () => {
    const r = alsKartengruppen([
      g('a', 'erkannt', [{ rolle: 'ausloeser', parzelle: p('1', 'CH1') }, { rolle: 'nachbar', parzelle: p('2', 'CH2') }]),
      g('b', 'abgeschlossen', [{ rolle: 'ausloeser', parzelle: p('3', 'CH3') }]),
      g('c', 'gemeldet', []),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: 'a', eigner: 'Test AG', manager: ['Erkannt'] });
    expect(r[0].positionen.map(x => [x.parzelleId, x.rolle, x.egrid])).toEqual([['1', 'Auslöser', 'CH1'], ['2', 'Nachbar', 'CH2']]);
  });
});

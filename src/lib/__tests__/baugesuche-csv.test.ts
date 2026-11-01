import { describe, expect, it } from 'vitest';
import { csvLesen } from '../../../tools/baugesuche_laden';

describe('Baugesuche: CSV der Quelle lesen', () => {
  it('liest Anführungszeichen, Kommas und Zeilenumbrüche in Feldern', () => {
    const t = 'id,projectDescription,x\n1,"Umbau, Anbau ""Süd""\nmit Lift",a\r\n2,Neubau,b\n';
    expect(csvLesen(t)).toEqual([['id', 'projectDescription', 'x'], ['1', 'Umbau, Anbau "Süd"\nmit Lift', 'a'], ['2', 'Neubau', 'b']]);
  });
});

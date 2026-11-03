/**
 * Am 3. November blockierte die 3D-Karte den Browser vollständig: 40 von
 * 40 Sekunden Rechenzeit, Tippen ins Suchfeld hing (Julian: "Text kommt
 * nach"). Grund war minimumLevel 16 an einer Kartenquelle -- Cesium legt
 * dann für jede grobe Geländekachel alle Kacheln dieser Stufe darunter
 * an, über der Schweiz Hunderttausende. "Erst nah zeigen" gehört an die
 * Ebene (minimumTerrainLevel). Dieser Test lässt eine hohe Mindeststufe
 * an einer Quelle nicht mehr durch.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ORDNER = join(__dirname, '../../components/karte3d');

describe('Kartenquellen der 3D-Karte', () => {
  it('setzen keine Mindeststufe über 6 an einer Quelle', () => {
    const funde = readdirSync(ORDNER).filter(d => d.endsWith('.tsx')).flatMap(d =>
      [...readFileSync(join(ORDNER, d), 'utf8').matchAll(/minimumLevel:\s*(\d+)/g)]
        .filter(m => Number(m[1]) > 6).map(m => `${d}: ${m[0]}`));
    expect(funde).toEqual([]);
  });
});

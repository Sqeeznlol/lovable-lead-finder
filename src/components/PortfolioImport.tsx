import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { portfolioSpeichern, zeilenLesen, zuordnen, type Ergebnis } from '@/lib/portfolio-import';

/**
 * Ein Kundenportfolio hochladen: Liste einfügen oder Datei wählen,
 * zuordnen lassen, gegenlesen, speichern.
 *
 * Gespeichert wird erst nach dem Gegenlesen. Was nicht eindeutig
 * zugeordnet ist, bleibt mit dem Rohtext stehen (zuordnung "offen",
 * "mehrdeutig", "nicht gefunden") und verschwindet nicht still -- der
 * Kunde soll am Ende sehen, welche seiner Adressen fehlen.
 *
 * Gebaut in den Stil der Karte (Klassen aus Karte.tsx), weil es in
 * deren Tafel erscheint.
 */
const ARTEN: [string, string][] = [['institution', 'Institution'], ['firma', 'Firma'], ['person', 'Person']];
const FARBE: Record<string, string> = {
  zugeordnet: '#15803D', mehrdeutig: '#CA8A04', 'nicht gefunden': '#DC2626', offen: '#64748B',
};

export function PortfolioImport({ onFertig, onAbbrechen }: { onFertig: () => void; onAbbrechen: () => void }) {
  const qc = useQueryClient();
  const [eigner, setEigner] = useState('');
  const [art, setArt] = useState('institution');
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [ergebnisse, setErgebnisse] = useState<Ergebnis[] | null>(null);
  const [laeuft, setLaeuft] = useState<{ fertig: number; gesamt: number } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);

  const zeilen = zeilenLesen(text);

  const datei = async (f: File | undefined) => {
    if (!f) return;
    setText(await f.text());
    setErgebnisse(null);
  };

  const losZuordnen = async () => {
    setFehler(null);
    setLaeuft({ fertig: 0, gesamt: zeilen.length });
    const aus: Ergebnis[] = [];
    // Nacheinander, nicht alle zugleich: der Bund drosselt sonst, und
    // die Fortschrittsanzeige sagt dann, wo es hängt.
    for (const z of zeilen) {
      aus.push(await zuordnen(z));
      setLaeuft({ fertig: aus.length, gesamt: zeilen.length });
      setErgebnisse([...aus]);
    }
    setLaeuft(null);
  };

  const speichern = async () => {
    if (!ergebnisse) return;
    setSpeichert(true); setFehler(null);
    try {
      await portfolioSpeichern(eigner, name || `${eigner} Portfolio`, art, ergebnisse);
      await qc.invalidateQueries({ queryKey: ['portfolios'] });
      onFertig();
    } catch {
      setFehler('Nicht gespeichert. Angemeldet? Portfolios darf nur anlegen, wer angemeldet ist.');
    } finally { setSpeichert(false); }
  };

  const zaehle = (z: string) => ergebnisse?.filter(e => e.zuordnung === z).length ?? 0;

  return (
    <div className="import">
      <div className="kopf">
        <p className="ueber">Portfolio hochladen</p>
        <h2>Adressliste eines Kunden</h2>
        <p className="sanft">Eine Adresse oder EGRID je Zeile. Aus Excel einfach die Spalten kopieren, oder eine CSV-Datei wählen.</p>
      </div>

      <label className="feld"><span>Eigner</span>
        <input value={eigner} onChange={e => setEigner(e.target.value)} placeholder="z. B. Swisscanto" />
      </label>
      <div className="zwei">
        <label className="feld"><span>Art</span>
          <select value={art} onChange={e => setArt(e.target.value)}>
            {ARTEN.map(([w, t]) => <option key={w} value={w}>{t}</option>)}
          </select>
        </label>
        <label className="feld"><span>Name des Portfolios</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={eigner ? `${eigner} Portfolio` : 'z. B. Wohnen Zürich'} />
        </label>
      </div>
      <label className="feld"><span>Adressen</span>
        <textarea rows={6} value={text} onChange={e => { setText(e.target.value); setErgebnisse(null); }}
                  placeholder={'Seestrasse 1, 8002 Zürich\nBahnhofstrasse 9, 8001 Zürich\nCH507791809985'} />
      </label>
      <label className="knopf datei">
        Datei wählen (CSV, TXT)
        <input type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={e => void datei(e.target.files?.[0])} />
      </label>

      {!ergebnisse && (
        <div className="leiste-unten">
          <button type="button" className="knopf" onClick={onAbbrechen}>Abbrechen</button>
          <button type="button" className="knopf haupt" disabled={!eigner.trim() || zeilen.length === 0 || !!laeuft}
                  onClick={() => void losZuordnen()}>
            {zeilen.length ? `${zeilen.length} ${zeilen.length === 1 ? 'Adresse' : 'Adressen'} zuordnen` : 'Zuordnen'}
          </button>
        </div>
      )}

      {ergebnisse && (
        <>
          <p className="sanft block">
            {laeuft ? `Zuordnen … ${laeuft.fertig} von ${laeuft.gesamt}` :
              `${zaehle('zugeordnet')} zugeordnet · ${zaehle('mehrdeutig')} mehrdeutig · ${zaehle('nicht gefunden')} nicht gefunden`
              + (zaehle('offen') ? ` · ${zaehle('offen')} offen` : '')}
          </p>
          <div className="karten">
            {ergebnisse.map((e, i) => (
              <div key={i} className="eintrag still">
                <i style={{ background: FARBE[e.zuordnung] }} />
                <span className="text">
                  <b>{e.roh}</b>
                  <small>{[e.zuordnung, e.gefunden && e.gefunden !== e.roh ? e.gefunden : null, e.grund].filter(Boolean).join(' · ')}</small>
                </span>
              </div>
            ))}
          </div>
          {!laeuft && (
            <div className="leiste-unten">
              <button type="button" className="knopf" onClick={() => setErgebnisse(null)}>Zurück</button>
              <button type="button" className="knopf haupt" disabled={speichert} onClick={() => void speichern()}>
                {speichert ? 'Speichert …' : 'Portfolio speichern'}
              </button>
            </div>
          )}
        </>
      )}
      {fehler && <p className="fehlertext">{fehler}</p>}
    </div>
  );
}

import { Plus, X } from 'lucide-react';
import { FELD, KNOPF } from '@/components/rahmen';
import { leerePerson, ROLLE_TEXT, type Parzelle, type Person, type Rolle } from '@/lib/angebot';

/**
 * Was der Agent für das Angebot angibt (Julian, 19. November: «Er hat
 * die Daten der Parzelle, könnten auch mehrere sein, und Eigentümer,
 * vielleicht auch mehrere, er muss entscheiden, an wen es gerichtet
 * ist»): woher der Lead kam, welche Parzellen, welche Menschen, und wer
 * den Brief bekommt. Ohne Empfänger lässt die Datenbank nicht einreichen.
 */
const ETIKETT = 'text-[11px] uppercase tracking-wide text-muted-foreground';
const WAHL = (an: boolean) => `min-h-11 rounded-[3px] border px-3 text-sm transition-colors ${an ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-secondary'}`;

function Feld({ titel, wert, setWert, platz, art = 'text', breit }: { titel: string; wert: string; setWert: (t: string) => void; platz?: string; art?: string; breit?: boolean }) {
  return (
    <label className={`block space-y-1 ${breit ? 'sm:col-span-2' : ''}`}>
      <span className={ETIKETT}>{titel}</span>
      <input type={art} value={wert} placeholder={platz} onChange={e => setWert(e.target.value)} className={`${FELD} w-full text-base`} />
    </label>
  );
}

export function Empfaenger({ quelle, setQuelle, parzellen, setParzellen, personen, setPersonen }: {
  quelle: 'aurora' | 'mail'; setQuelle: (q: 'aurora' | 'mail') => void;
  parzellen: Parzelle[]; setParzellen: (p: Parzelle[]) => void;
  personen: Person[]; setPersonen: (p: Person[]) => void;
}) {
  const person = (i: number, teil: Partial<Person>) => setPersonen(personen.map((p, j) => (j === i ? { ...p, ...teil } : p)));
  const parzelle = (i: number, teil: Partial<Parzelle>) => setParzellen(parzellen.map((p, j) => (j === i ? { ...p, ...teil } : p)));
  const an = personen.filter(p => p.empfaenger).length;

  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-lg">Für das Angebot</h3>
        <p className="text-sm text-muted-foreground">Welche Parzellen, wem sie gehören und an wen der Brief geht. David wählt danach Firma und Vorlage (die Schrift gehört zur Firma).</p>
      </div>

      <div className="space-y-1.5">
        <p className={ETIKETT}>Der Lead kam</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={WAHL(quelle === 'aurora')} aria-pressed={quelle === 'aurora'} onClick={() => setQuelle('aurora')}>über Aurora</button>
          <button type="button" className={WAHL(quelle === 'mail')} aria-pressed={quelle === 'mail'} onClick={() => setQuelle('mail')}>per Mail</button>
        </div>
      </div>

      <div className="space-y-2">
        <p className={ETIKETT}>Parzellen im Angebot</p>
        <ul className="space-y-2">
          {parzellen.map((p, i) => (
            <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Feld titel="Kat.-Nr." wert={p.nummer} setWert={t => parzelle(i, { nummer: t })} platz="SE6956" />
              <Feld titel="Fläche m²" wert={p.flaeche != null ? String(p.flaeche) : ''} art="text"
                    setWert={t => { const n = Number(t.replace(/['’\s]/g, '')); parzelle(i, { flaeche: t.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : null }); }} />
              <div className="hidden sm:block"><Feld titel="GB Blatt" wert={p.gbBlatt ?? ''} setWert={t => parzelle(i, { gbBlatt: t || null })} /></div>
              <button type="button" className={`${KNOPF} h-11 w-11 justify-center px-0`} aria-label="Parzelle entfernen" onClick={() => setParzellen(parzellen.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        <button type="button" className={KNOPF} onClick={() => setParzellen([...parzellen, { nummer: '', flaeche: null }])}><Plus className="h-4 w-4" /> Parzelle</button>
      </div>

      <div className="space-y-2">
        <p className={ETIKETT}>Eigentümer und Vertretung {an ? `· ${an} Empfänger` : '· noch kein Empfänger'}</p>
        <ul className="space-y-3">
          {personen.map((p, i) => (
            <li key={i} className={`space-y-3 rounded-[3px] border p-3 ${p.empfaenger ? 'border-foreground' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-h-11 items-center gap-2.5 pr-2 text-[15px] font-medium">
                  <input type="checkbox" checked={p.empfaenger} onChange={e => person(i, { empfaenger: e.target.checked })} className="h-5 w-5 accent-foreground" />
                  Bekommt das Angebot
                </label>
                <span className="flex-1" />
                <button type="button" className={`${KNOPF} h-11 w-11 justify-center px-0`} aria-label="Person entfernen" onClick={() => setPersonen(personen.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['frau', 'herr', 'keine'] as const).map(a => (
                  <button key={a} type="button" className={WAHL(p.art === a)} aria-pressed={p.art === a} onClick={() => person(i, { art: a })}>{a === 'frau' ? 'Frau' : a === 'herr' ? 'Herr' : 'ohne Anrede'}</button>
                ))}
                <span className="w-2" />
                {(Object.keys(ROLLE_TEXT) as Rolle[]).map(r => (
                  <button key={r} type="button" className={WAHL(p.rolle === r)} aria-pressed={p.rolle === r} onClick={() => person(i, { rolle: r })}>{ROLLE_TEXT[r]}</button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Feld titel="Vorname" wert={p.vorname} setWert={t => person(i, { vorname: t })} />
                <Feld titel="Name" wert={p.name} setWert={t => person(i, { name: t })} />
                <Feld titel="Firma, Kanzlei oder Erbengemeinschaft" wert={p.firma} setWert={t => person(i, { firma: t })} breit />
                <Feld titel="Strasse" wert={p.strasse} setWert={t => person(i, { strasse: t })} />
                <Feld titel="PLZ und Ort" wert={p.plzOrt} setWert={t => person(i, { plzOrt: t })} platz="8302 Kloten" />
                <Feld titel="E-Mail" wert={p.email} setWert={t => person(i, { email: t })} art="email" />
                <Feld titel="Telefon" wert={p.telefon} setWert={t => person(i, { telefon: t })} art="tel" />
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className={KNOPF} onClick={() => setPersonen([...personen, leerePerson({ empfaenger: !personen.length })])}><Plus className="h-4 w-4" /> Person</button>
      </div>
    </section>
  );
}

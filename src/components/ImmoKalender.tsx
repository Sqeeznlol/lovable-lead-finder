import { useMemo } from 'react';
import { CalendarDays, CalendarPlus, ExternalLink, MapPin } from 'lucide-react';
import { useUrlWert } from '@/hooks/use-url-wert';
import { Leer, Marke, Reiter } from '@/components/rahmen';
import { FENSTER } from '@/lib/fenster';
import { ANLAESSE, ical, inTagen, land, ordnen, STAND, zeitraum, type Anlass, type AnlassArt } from '@/lib/immo-kalender';

const heute = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MARKE: Record<AnlassArt, 'heiss' | 'lila' | 'violett' | 'minze'> = { messe: 'heiss', kongress: 'lila', forum: 'violett', tagung: 'minze' };
const ART: Record<AnlassArt, string> = { messe: 'Messe', kongress: 'Kongress', forum: 'Forum', tagung: 'Tagung' };
type Sicht = 'alle' | 'messe' | 'treffen' | 'schweiz';
const passt = (a: Anlass, s: Sicht) => s === 'alle' || (s === 'messe' ? a.art === 'messe' : s === 'treffen' ? a.art !== 'messe' : a.land === 'CH');

const monatName = (m: string) => new Date(m + '-15T12:00:00').toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });
const monatKurz = (m: string) => new Date(m + '-15T12:00:00').toLocaleDateString('de-CH', { month: 'short' });

function bald(t: number | null) {
  if (t == null) return null;
  if (t <= 0) return 'läuft';
  if (t === 1) return 'morgen';
  if (t < 45) return `in ${t} Tagen`;
  return `in ${Math.round(t / 30.4)} Monaten`;
}

function eintragen(a: Anlass) {
  const url = URL.createObjectURL(new Blob([ical(a)], { type: 'text/calendar' }));
  const l = document.createElement('a');
  l.href = url; l.download = `${a.name.replace(/[^\wäöüÄÖÜ -]/g, '').slice(0, 60)}.ics`; l.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const KLEIN = 'inline-flex min-h-11 items-center gap-1.5 rounded-[3px] border bg-card px-3 text-sm hover:bg-secondary';

/** Ein Anlass als Zeile: Datumsblatt, Name, Ort und Adresse, Handlungen. */
function Zeile({ a, tag }: { a: Anlass; tag: string }) {
  const v = a.von ? new Date(a.von + 'T12:00:00') : null;
  const wo = [a.haus, a.adresse ?? a.ort].filter(Boolean).join(', ');
  const route = a.adresse ?? (a.haus && a.ort ? `${a.haus}, ${a.ort}` : null);
  const t = inTagen(a, tag);
  return (
    <li className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-[72px_minmax(0,1fr)_auto]">
      {/* Das Datumsblatt: wie ein Abreisskalender, Messen schwarz. */}
      <div className={`flex h-[72px] flex-col items-center justify-center rounded-[3px] ${a.art === 'messe' ? 'bg-foreground text-background' : 'border bg-card'}`}>
        {v ? <>
          <span className="text-[11px] font-medium uppercase tracking-wide opacity-70">{v.toLocaleDateString('de-CH', { month: 'short' })}</span>
          <span className="text-[28px] font-semibold leading-none">{v.getDate()}</span>
          <span className="text-[11px] opacity-70">{v.toLocaleDateString('de-CH', { weekday: 'short' })}</span>
        </> : <CalendarDays className="h-6 w-6 opacity-60" />}
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Marke art={MARKE[a.art]}>{ART[a.art]}</Marke>
          <span className="text-sm text-muted-foreground">{zeitraum(a)}</span>
          {bald(t) && <span className="text-sm text-accent">{bald(t)}</span>}
        </div>
        <p className="font-semibold leading-snug">{a.name}</p>
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">{wo || 'Ort noch offen'}{a.land !== 'CH' ? ` · ${land(a.land)}` : ''}</span>
        </p>
        <p className="text-sm text-muted-foreground">Für {a.fuer}</p>
        {a.bemerkung && <p className="text-sm text-muted-foreground/80">{a.bemerkung}</p>}
      </div>
      <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:flex-col sm:items-stretch">
        <a className={KLEIN} href={a.url} target={FENSTER.extern}><ExternalLink className="h-4 w-4" /> Webseite</a>
        {a.von && <button type="button" className={KLEIN} onClick={() => eintragen(a)}><CalendarPlus className="h-4 w-4" /> In Kalender</button>}
        {route && <a className={KLEIN} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(route)}`} target={FENSTER.karte}><MapPin className="h-4 w-4" /> Route</a>}
      </div>
    </li>
  );
}

/**
 * Der Immo-Kalender (Julian, 1. November): jede Immobilienmesse, wann,
 * wo, mit Adresse. Oben eine Monatsleiste als Überblick, darunter die
 * Anlässe nach Monat. `kurz` zeigt nur die nächsten -- für Wohntraums,
 * wo der Kalender eine Tafel unter vielen ist.
 */
export function ImmoKalender({ kurz }: { kurz?: number }) {
  const tag = heute();
  const [sichtWert, setSicht] = useUrlWert('anlass', 'alle');
  const sicht = sichtWert as Sicht;
  const alle = useMemo(() => ordnen(ANLAESSE, tag), [tag]);
  const gefiltert = useMemo(() => ordnen(ANLAESSE.filter(a => passt(a, sicht)), tag), [sicht, tag]);
  // Gezählt wird, was ein Datum hat -- dieselbe Zahl wie im Titel.
  const zahl = (s: Sicht) => alle.datiert.filter(a => passt(a, s)).length;

  if (kurz) {
    return (
      <ul className="divide-y rounded border bg-card">
        {alle.datiert.slice(0, kurz).map(a => <Zeile key={a.name} a={a} tag={tag} />)}
      </ul>
    );
  }

  const monate = [...gefiltert.monate.entries()];
  return (
    <div className="space-y-6">
      <Reiter<Sicht> wahl={sicht} setWahl={setSicht} optionen={([
        ['alle', 'Alle'], ['messe', 'Messen'], ['treffen', 'Kongresse und Foren'], ['schweiz', 'Schweiz'],
      ] as [Sicht, string][]).map(([w, t]) => ({ wert: w, titel: t, zahl: zahl(w) }))} />

      {/* Die Monatsleiste: ein Blick aufs ganze Jahr, ein Tipp springt hin. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0">
        {[...alle.monate.keys()].map(m => {
          const n = gefiltert.monate.get(m)?.length ?? 0;
          return (
            <button key={m} type="button" disabled={!n}
                    onClick={() => document.getElementById(`monat-${m}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className={`flex min-h-[64px] min-w-[64px] shrink-0 flex-col items-center justify-center rounded-[3px] border px-2 ${n ? 'bg-card hover:bg-secondary' : 'opacity-40'}`}>
              <span className="text-xs text-muted-foreground">{monatKurz(m)} {m.slice(2, 4)}</span>
              <span className="mt-1 flex gap-0.5">{Array.from({ length: Math.min(n, 4) }, (_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-foreground" />)}</span>
            </button>
          );
        })}
      </div>

      {monate.length === 0 ? <Leer titel="Keine Anlässe in dieser Auswahl." /> : monate.map(([m, liste]) => (
        <section key={m} id={`monat-${m}`} className="scroll-mt-24 space-y-2">
          <h3 className="text-lg font-semibold">{monatName(m)}</h3>
          <ul className="divide-y rounded border bg-card">{liste.map(a => <Zeile key={a.name} a={a} tag={tag} />)}</ul>
        </section>
      ))}

      {gefiltert.offen.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-lg font-semibold">Datum noch offen</h3>
          <p className="text-sm text-muted-foreground">Vom Veranstalter noch nicht publiziert -- hier steht kein geratenes Datum.</p>
          <ul className="divide-y rounded border bg-card">{gefiltert.offen.map(a => <Zeile key={a.name} a={a} tag={tag} />)}</ul>
        </section>
      )}
      <p className="text-xs text-muted-foreground">Stand {new Date(STAND + 'T12:00:00').toLocaleDateString('de-CH')}, von den Seiten der Veranstalter. Vor einer Reise dort nachsehen.</p>
    </div>
  );
}

/** Für Kopf und Kennzahlen der Seite. */
export function kalenderZahlen() {
  const o = ordnen(ANLAESSE, heute());
  const naechster = o.datiert[0];
  return {
    anzahl: o.datiert.length, offen: o.offen.length,
    messen: o.datiert.filter(a => a.art === 'messe').length,
    naechster, tage: naechster ? inTagen(naechster, heute()) : null,
  };
}

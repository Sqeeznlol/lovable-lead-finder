import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Auswahl } from '@/components/Auswahl';
import { KNOPF, Leer, LISTE, Reiter, Seite, Filterleiste } from '@/components/rahmen';
import { WunschFavoriten } from '@/components/WunschFavoriten';
import { useName } from '@/components/calc/name';
import { BILD, luftbildWgs } from '@/lib/luftbild';
import { FENSTER } from '@/lib/fenster';
import { useUrlWert } from '@/hooks/use-url-wert';
import { favoritAus, geoAdminLink, ohneFavoriten, STAND, WOHNEN, wunschCsv, ZONE_KURZ, type FavoritAngaben, type WunschFavorit, type WunschOrdner, type WunschParzelle } from '@/lib/parzellen-nach-wunsch';

/**
 * Parzellen nach Wunsch (Julian, 19. November: «mache ein extra Ordner bei
 * Aurora und nenne das Parzellen nach Wunsch, macht alle rein, die diese
 * Kriterien haben»). Ein Ordner ist eine feste Auswahl mit ihrem Kriterium,
 * gerechnet auf dem Runner aus der Vermessung beim Bund; die Seite liest
 * nur. Obwalden und Nidwalden stehen sonst nicht in der Datenbank, darum
 * führt der Weg zur Parzelle auf die Karte des Bundes, nicht in die
 * Objektansicht.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const ch = (n: number) => n.toLocaleString('de-CH');
// Vier Zahlen, die eine Auswahl auslösen. Seit «nur erschlossenes Bauland für Wohnen» (19. November)
// liegen alle Parzellen in Wohn-, Misch- oder Zentrumszonen; was zählt, ist die Zone und ob schon gebaut ist.
const KENNZAHLEN: { titel: string; zone: string; passt: (p: WunschParzelle) => boolean }[] = [
  { titel: 'Wohnzonen', zone: 'Wohnzonen', passt: p => p.zone === 'Wohnzonen' },
  { titel: 'Misch- und Zentrumszonen', zone: 'misch', passt: p => p.zone === 'Mischzonen' || p.zone === 'Zentrumszonen' },
  { titel: 'Unbebaut', zone: 'unbebaut', passt: p => p.bebaut === false },
  { titel: 'Bebaut', zone: 'bebaut', passt: p => p.bebaut === true },
];

export function ParzellenNachWunsch() {
  const [ordnerId, setOrdnerId] = useUrlWert('ordner', '');
  const [kanton, setKanton] = useUrlWert('kanton', '');
  const [gemeinde, setGemeinde] = useUrlWert('gemeinde', '');
  const [zone, setZone] = useUrlWert('zone', '');
  // Eigener Filter neben der Zone (Julian, 19. November: «Unbebaut/bebaut filter»).
  const [bebaut, setBebaut] = useUrlWert('bebaut', '');
  const [alle, setAlle] = useState(false);
  // Favoriten (Julian, 20. November): «ausfindig machen ... wo man die Daten ausfüllen kann, aber weg von der Filterseite».
  const [sicht, setSicht] = useUrlWert('sicht', '');
  const [name] = useName();
  const qc = useQueryClient();
  const [legtAn, setLegtAn] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const favoriten = useQuery({
    queryKey: ['wunsch-favoriten'],
    queryFn: async (): Promise<WunschFavorit[]> => {
      const { data, error } = await db.from('wunsch_favorit').select('*').order('geaendert_am', { ascending: false }).limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const favListe = favoriten.data ?? [];
  const ausfindig = async (p: WunschParzelle) => {
    setLegtAn(p.egrid); setFehler(null);
    const { error } = await db.from('wunsch_favorit').insert(favoritAus(p, name));
    // Schon da (jemand anders war schneller): dann einfach neu lesen.
    if (error && error.code !== '23505') setFehler('Nicht in die Favoriten gelegt. Ist die Migration eingespielt?');
    await qc.invalidateQueries({ queryKey: ['wunsch-favoriten'] });
    setLegtAn(null);
  };
  const speichern = async (egrid: string, a: FavoritAngaben) => {
    const { error } = await db.from('wunsch_favorit').update({ ...a, geaendert_am: new Date().toISOString() }).eq('egrid', egrid);
    if (error) throw new Error('Nicht gespeichert. Bitte noch einmal.');
    await qc.invalidateQueries({ queryKey: ['wunsch-favoriten'] });
  };
  const entfernen = async (egrid: string) => {
    const { error } = await db.from('wunsch_favorit').delete().eq('egrid', egrid);
    if (error) setFehler('Nicht zurückgelegt. Bitte noch einmal.');
    await qc.invalidateQueries({ queryKey: ['wunsch-favoriten'] });
  };

  const ordner = useQuery({
    queryKey: ['wunsch-ordner'],
    queryFn: async (): Promise<WunschOrdner[]> => {
      const { data, error } = await db.from('wunsch_ordner').select('id, name, kriterium, quelle, stand').order('erstellt_am');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 60 * 1000,
  });
  const o = ordner.data?.find(x => x.id === ordnerId) ?? ordner.data?.[0];

  // Ein Ordner hat einige hundert Parzellen: einmal ganz lesen, gefiltert wird hier.
  const parzellen = useQuery({
    queryKey: ['wunsch-parzellen', o?.id],
    enabled: !!o,
    queryFn: async (): Promise<WunschParzelle[]> => {
      const { data, error } = await db.from('wunsch_parzelle')
        .select('egrid, kanton, bfs, gemeinde, nummer, flaeche, zone, bauzone_anteil, e, n, lat, lon, bebaut, nachweis')
        .eq('ordner_id', o!.id).order('flaeche', { ascending: false }).limit(5000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 60 * 1000,
  });

  // Was jemand ausfindig macht, steht nicht mehr in der Filterliste, sondern bei den Favoriten.
  const z = useMemo(() => ohneFavoriten(parzellen.data ?? [], favoriten.data ?? []), [parzellen.data, favoriten.data]);
  const kantone = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of z) m.set(p.kanton, (m.get(p.kanton) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [z]);
  const imKanton = useMemo(() => z.filter(p => !kanton || p.kanton === kanton), [z, kanton]);
  const gemeinden = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of imKanton) m.set(p.gemeinde, (m.get(p.gemeinde) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de-CH'));
  }, [imKanton]);
  const zonen = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of imKanton) if (!gemeinde || p.gemeinde === gemeinde) m.set(p.zone, (m.get(p.zone) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [imKanton, gemeinde]);
  const inGemeinde = imKanton.filter(p => !gemeinde || p.gemeinde === gemeinde);
  const treffer = inGemeinde.filter(p => !bebaut || p.bebaut === (bebaut === 'ja')).filter(p => !zone || (KENNZAHLEN.find(k => k.zone === zone)?.passt(p) ?? (zone === 'wohnen' ? WOHNEN.has(p.zone) : p.zone === zone)));
  const wohnen = inGemeinde.filter(p => WOHNEN.has(p.zone)).length;
  const gezeigt = alle ? treffer : treffer.slice(0, 100);

  const herunterladen = () => {
    const url = URL.createObjectURL(new Blob(['﻿' + wunschCsv(treffer)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `parzellen-nach-wunsch-${(gemeinde || kanton || 'alle').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const reiter = (
    <Reiter wahl={sicht === 'favoriten' ? 'favoriten' : 'liste'} setWahl={w => setSicht(w === 'favoriten' ? 'favoriten' : '')}
            optionen={[{ wert: 'liste', titel: 'Parzellen', zahl: z.length }, { wert: 'favoriten', titel: 'Favoriten', zahl: favListe.length }]} />
  );

  if (sicht === 'favoriten') return (
    <Seite bild={BILD.wunsch} ueber="Parzellen nach Wunsch · Favoriten"
      titel={favoriten.data ? `${ch(favListe.length)} ${favListe.length === 1 ? 'Parzelle' : 'Parzellen'} ausfindig machen` : ' '}
      unter={<>Eigentümer, Kontakt und Stand je Parzelle. Was hier liegt, steht nicht mehr in der Liste.</>}
      kennzahlen={favoriten.data ? STAND.map(([w, t]) => ({ titel: t, wert: ch(favListe.filter(f => f.stand === w).length) })) : undefined}>
      {reiter}
      {favoriten.error && <p className="text-sm text-destructive">Favoriten nicht lesbar. Ist die Migration eingespielt?</p>}
      {fehler && <p className="text-sm text-destructive">{fehler}</p>}
      <WunschFavoriten liste={favListe} laedt={favoriten.isLoading} speichern={speichern} entfernen={entfernen} />
    </Seite>
  );

  return (
    <Seite bild={BILD.wunsch} ueber={o ? `Parzellen nach Wunsch · ${o.name}` : 'Parzellen nach Wunsch'}
      titel={parzellen.data ? `${ch(treffer.length)} Parzellen ${(o?.kriterium ?? '').replace(' m²', '\u00a0m²')}`.trim() : ' '}
      unter={o && <>{o.quelle} Stand {o.stand}.</>}
      kennzahlen={parzellen.data ? KENNZAHLEN.map(k => ({ titel: k.titel, wert: ch(inGemeinde.filter(k.passt).length), onClick: () => setZone(zone === k.zone ? '' : k.zone) })) : undefined}>
      {reiter}
      <Filterleiste aktiv={[kanton, gemeinde, zone, bebaut].filter(Boolean).length}>
        {(ordner.data?.length ?? 0) > 1 && (
          <Auswahl label="Ordner" wert={o?.id ?? ''} setWert={w => { setOrdnerId(w); setKanton(''); setGemeinde(''); setZone(''); setBebaut(''); }} className="min-w-[220px]"
                   optionen={(ordner.data ?? []).map(x => ({ wert: x.id, titel: x.name }))} />
        )}
        {kantone.length > 1 && (
          <Auswahl label="Kanton" wert={kanton || 'alle'} setWert={w => { setKanton(w === 'alle' ? '' : w); setGemeinde(''); setZone(''); }} className="min-w-[160px]"
                   optionen={[{ wert: 'alle', titel: `Alle Kantone · ${ch(z.length)}` }, ...kantone.map(([k, n]) => ({ wert: k, titel: `Kanton ${k} · ${ch(n)}` }))]} />
        )}
        <Auswahl label="Gemeinde" wert={gemeinde || 'alle'} setWert={w => { setGemeinde(w === 'alle' ? '' : w); setZone(''); }} className="min-w-[200px]"
                 optionen={[{ wert: 'alle', titel: `Alle Gemeinden · ${ch(imKanton.length)}` }, ...gemeinden.map(([g, n]) => ({ wert: g, titel: `${g} · ${ch(n)}` }))]} />
        <Auswahl label="Zone" wert={zone || 'alle'} setWert={w => setZone(w === 'alle' ? '' : w)} className="min-w-[240px]"
                 optionen={[{ wert: 'alle', titel: 'Alle Zonen' },
                   ...KENNZAHLEN.map(k => ({ wert: k.zone, titel: `${k.titel} · ${ch(inGemeinde.filter(k.passt).length)}` })),
                   ...zonen.filter(([k]) => !KENNZAHLEN.some(x => x.zone === k)).map(([k, n]) => ({ wert: k, titel: `${k} · ${ch(n)}` })),
                   ...(wohnen < inGemeinde.length ? [{ wert: 'wohnen', titel: `Wohnen, Misch- und Zentrumszonen · ${ch(wohnen)}` }] : [])]} />
        <Auswahl label="Bebauung" wert={bebaut || 'alle'} setWert={w => setBebaut(w === 'alle' ? '' : w)} className="min-w-[180px]"
                 optionen={[{ wert: 'alle', titel: 'Bebaut und unbebaut' },
                   { wert: 'nein', titel: `Unbebaut · ${ch(inGemeinde.filter(p => p.bebaut === false).length)}` },
                   { wert: 'ja', titel: `Bebaut · ${ch(inGemeinde.filter(p => p.bebaut === true).length)}` }]} />
        <button type="button" className={KNOPF} disabled={!treffer.length} onClick={herunterladen}>Als CSV ({ch(treffer.length)})</button>
      </Filterleiste>

      {fehler && <p className="text-sm text-destructive">{fehler}</p>}
      {(ordner.isLoading || parzellen.isLoading) && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird geladen …</p>}
      {(ordner.error || parzellen.error) && <p className="text-sm text-destructive">Parzellen nach Wunsch nicht lesbar. Ist die Migration eingespielt?</p>}
      {ordner.data && !ordner.data.length && <Leer titel="Noch kein Ordner angelegt." />}
      {parzellen.data && !treffer.length && <Leer titel="Keine Parzelle in dieser Auswahl.">Andere Gemeinde oder Zone wählen.</Leer>}
      {treffer.length > 0 && (
        <>
          <ul className={LISTE}>
            {gezeigt.map(p => (
              <li key={p.egrid} className="flex items-center gap-4 p-3 sm:p-4">
                <img src={luftbildWgs(p.lat, p.lon, Math.max(120, Math.sqrt(p.flaeche) * 2.2), 320)} alt="" loading="lazy"
                     className="h-14 w-24 shrink-0 rounded-[3px] bg-secondary object-cover sm:h-[72px] sm:w-32" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Parzelle {p.nummer} · {p.gemeinde}</span>
                  <span className="block text-sm text-muted-foreground">
                    {ch(p.flaeche)}{'\u00a0'}m² · {ZONE_KURZ[p.zone] ?? p.zone}{p.bauzone_anteil < 0.95 ? ` (${Math.round(p.bauzone_anteil * 100)}\u00a0% in der Bauzone)` : ''}{p.bebaut != null ? ` · ${p.bebaut ? 'bebaut' : 'unbebaut'}` : ''}
                  </span>
                  {p.nachweis && <span className="block text-xs text-muted-foreground">{p.nachweis}</span>}
                  <span className="block truncate text-xs text-muted-foreground">{p.egrid}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <button type="button" className={KNOPF} disabled={legtAn === p.egrid} onClick={() => void ausfindig(p)}>
                    {legtAn === p.egrid ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Ausfindig machen
                  </button>
                  <a className="inline-flex h-11 items-center text-sm underline underline-offset-2" target={FENSTER.karte} href={geoAdminLink(p)}>Karte</a>
                </span>
              </li>
            ))}
          </ul>
          {treffer.length > gezeigt.length && (
            <button type="button" className={KNOPF} onClick={() => setAlle(true)}>Alle {ch(treffer.length)} zeigen</button>
          )}
        </>
      )}
    </Seite>
  );
}

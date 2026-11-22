import { Suspense, useEffect, useRef, useState } from 'react';
import { nachladen } from '@/lib/neue-fassung';
import { Building2, X, Shield, Share, Plus, Map, Target, BarChart3, Gauge, HardHat, MoreHorizontal, Briefcase, LogOut, Orbit, CalendarDays, Inbox, Combine, Flame, Search, Calculator, FolderOpen } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { KontoMenu } from '@/components/KontoMenu';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { useParzelleZuEgrid } from '@/lib/egrid';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PropertyDetailDialog } from '@/components/PropertyDetailDialog';
import { useSchliessen, useUrlWert } from '@/hooks/use-url-wert';
import { Skeleton } from '@/components/ui/skeleton';
const Auswertung = nachladen(() => import('@/components/Auswertung'), 'Auswertung');
const Arrondierung = nachladen(() => import('@/components/Arrondierung'), 'Arrondierung');
const Leads = nachladen(() => import('@/components/Leads'), 'Leads');
const Cockpit = nachladen(() => import('@/components/Cockpit'), 'Cockpit');
const LeadListen = nachladen(() => import('@/components/LeadListen'), 'LeadListen');
const Baugesuche = nachladen(() => import('@/components/Baugesuche'), 'Baugesuche');
const Gelegenheiten = nachladen(() => import('@/components/Gelegenheiten'), 'Gelegenheiten');
const Karte3DSeite = nachladen(() => import('@/components/karte3d/Karte3DSeite'), 'Karte3DSeite');
const Kalender = nachladen(() => import('@/components/Kalender'), 'Kalender');
const Suche = nachladen(() => import('@/components/Suche'), 'Suche');
const CalcYouLater = nachladen(() => import('@/components/CalcYouLater'), 'CalcYouLater');
const ParzellenNachWunsch = nachladen(() => import('@/components/ParzellenNachWunsch'), 'ParzellenNachWunsch');
// Die Karte zieht Leaflet nach -- das gehoert nicht ins erste
// Buendel, sondern wird geholt, wenn jemand den Reiter oeffnet.
const Karte = nachladen(() => import('@/components/Karte'), 'Karte');
// Was nur ein Reiter braucht, kommt erst mit dem Reiter: das erste
// Bündel trägt nur den Rahmen und das Cockpit.
const Zentrale = nachladen(() => import('@/components/Zentrale'), 'Zentrale');
const Protokoll = nachladen(() => import('@/components/Protokoll'), 'Protokoll');
const Anmeldungen = nachladen(() => import('@/components/Anmeldungen'), 'Anmeldungen');
const Teams = nachladen(() => import('@/components/Teams'), 'Teams');
const AdminSettings = nachladen(() => import('@/components/AdminSettings'), 'AdminSettings');
// «Wer was tut» trägt nur ein Admin ein: darum hier, nicht auf der CALC-Seite (22. November).
const AblaufPersonen = nachladen(() => import('@/components/calc/AblaufPersonen'), 'AblaufPersonen');
import { Parzellensuche } from '@/components/Parzellensuche';
import { useCanton } from '@/hooks/use-canton';
import { AdminZugang } from '@/components/AdminZugang';
import { Auffang } from '@/components/Auffang';
import { useAuth } from '@/hooks/use-auth';
import { usePlatform } from '@/hooks/use-platform';

// Jeder Bereich ist eine Adresse: /zentrale, /baugesuche ... ("/" ist
// das Cockpit). So führt "Zurück" im Browser in den vorigen Bereich.
const TABS = ['cockpit', 'suche', 'leads', 'calc', 'zentrale', 'baugesuche', 'leadlisten', 'wunsch', 'karte', 'arrondierung', 'gelegenheiten', 'auswertung', 'kalender', 'karte3d', 'admin'] as const;
// Frühere Reiter, deren Links weiter gelten: «Nachbarschaft» steht seit dem
// 22. November oben in «Arrondierung» (Julian: «mach Nachbarschaft und
// Arrondierung zusammen»).
const FRUEHER: Record<string, (typeof TABS)[number]> = { nachbarschaft: 'arrondierung' };
type Tab = typeof TABS[number];
const istTab = (x: string | undefined): x is Tab => !!x && (TABS as readonly string[]).includes(x);

// Die Akquise mit ihren Reitern (Übersicht, Abfrage, Gebäudesuche,
// Nummern, Pipedrive und die stillgelegten) ist seit dem 7. November ein
// eigenes Programm, getrennt von dieser Webseite (src/App.tsx).
type Eintrag = { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> };

// Geordnet nach dem Weg, nicht nach Technik (Julian, 22. November: «kein
// roter Faden ... ein klarer Weg, der zeigt, wo man durch muss»): zuerst
// der Weg vom Lead zum Angebot, dann wo man Grundstücke findet, dann die
// Kunden, zuletzt Zahlen und Verwaltung.
const gruppen: { titel: string; eintraege: Eintrag[] }[] = [
  { titel: 'Der Weg', eintraege: [
    // Was heute zu tun ist, mit dem Weg vom Lead zum Angebot.
    { id: 'cockpit', label: 'Cockpit', icon: Gauge },
    // Die Leads der Check-Seiten (20 Webseiten, eine Liste), mit Zahlen je Webseite.
    { id: 'leads', label: 'Leads', icon: Inbox },
    // Vom Lead zur Kaufpreisempfehlung und in einem Tag zum Angebot (16. November).
    { id: 'calc', label: 'Calc You Later', icon: Calculator },
  ] },
  { titel: 'Grundstücke finden', eintraege: [
    // Ein Satz, eine Liste: «Alle W2 in Dietikon» (Julian, 16. November).
    { id: 'suche', label: 'Suche', icon: Search },
    { id: 'karte', label: 'Karte', icon: Map },
    // Feste Ordner mit Parzellen nach einem Kriterium, zuerst über 3000 m² (19. November).
    { id: 'wunsch', label: 'Parzellen nach Wunsch', icon: FolderOpen },
    { id: 'gelegenheiten', label: 'Gelegenheiten', icon: Target },
    { id: 'baugesuche', label: 'Baugesuche', icon: HardHat },
    // Wohngebäude mit Öl oder Gas, bis 1980 gebaut, Deutschschweiz (Gebäuderegister).
    { id: 'leadlisten', label: 'Lead-Listen', icon: Flame },
  ] },
  { titel: 'Kunden', eintraege: [
    // Jedes Kundenvorhaben an einem Ort, von der Adressliste an.
    { id: 'zentrale', label: 'Zentrale', icon: Briefcase },
    // Nachbarn jeder Parzelle und die Nachbarparzellen der Kundenfonds nach Potenzial.
    { id: 'arrondierung', label: 'Arrondierung', icon: Combine },
  ] },
  { titel: 'Zahlen', eintraege: [
    { id: 'auswertung', label: 'Auswertung', icon: BarChart3 },
    // Messen und Kongresse der Branche: wann, wo, mit Adresse.
    { id: 'kalender', label: 'Immo-Kalender', icon: CalendarDays },
  ] },
  { titel: 'Verwaltung', eintraege: [
    { id: 'admin', label: 'Admin', icon: Shield },
  ] },
];
const tabs: Eintrag[] = gruppen.flatMap(g => g.eintraege);

// Auf dem iPhone der Weg (Cockpit, Leads, Calc) und die Karte fest,
// alles andere unter «Mehr». Kurze Namen, damit nichts umbricht.
const mobileBottomTabs: Tab[] = ['cockpit', 'leads', 'calc', 'karte'];
const KURZ: Partial<Record<Tab, string>> = { calc: 'Calc' };

/** Ein Punkt der Icon-Leiste: Symbol, aktiv als schwarzes Quadrat, Name beim Überfahren. */
function LeistenPunkt({ t, an, onClick, imRollbereich }: { t: Eintrag; an: boolean; onClick: () => void; imRollbereich?: boolean }) {
  // Im rollbaren Teil der Leiste schneidet der Rand das eigene Namensschild
  // ab; dort zeigt der Browser den Namen.
  return (
    <button type="button" onClick={onClick} aria-label={t.label} aria-current={an ? 'page' : undefined} title={imRollbereich ? t.label : undefined}
            className={`group relative grid h-11 w-11 place-items-center rounded-[3px] transition-colors ${an ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
      <t.icon className="h-5 w-5" />
      {!imRollbereich && <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-[3px] bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {t.label}
      </span>}
    </button>
  );
}

export default function Index() {
  const { bereich } = useParams();
  const navigate = useNavigate();
  const active: Tab = istTab(bereich) ? bereich : (bereich && FRUEHER[bereich]) || 'cockpit';
  // Ein alter Link zeigt gleich den neuen Ort, auch in der Adresszeile.
  useEffect(() => {
    if (bereich && FRUEHER[bereich]) navigate(`/${FRUEHER[bereich]}${window.location.search}`, { replace: true });
  }, [bereich, navigate]);
  // Ein Fondsmanager-Konto gehört nach Wohntraums (/fonds) und sieht
  // die interne Oberfläche nie.
  const { data: fondsmanager } = useQuery({
    queryKey: ['ist-fondsmanager'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (supabase as any).rpc('ist_fondsmanager');
      return r.error ? false : Boolean(r.data);
    },
    staleTime: 10 * 60 * 1000,
  });
  useEffect(() => { if (fondsmanager) navigate('/fonds', { replace: true }); }, [fondsmanager, navigate]);
  // Die Objektansicht einer Parzelle -- eine für alle Bereiche, offen
  // über ?parzelle=..., damit auch sie "Zurück" kennt.
  const [parzelle] = useUrlWert('parzelle');
  const parzelleZu = useSchliessen('parzelle');
  // ?egrid=... öffnet dieselbe Objektansicht: aufgelöst und durch ?parzelle= ersetzt.
  const [egridWert] = useUrlWert('egrid');
  const [, setSuche] = useSearchParams();
  const egridAufloesung = useParzelleZuEgrid(egridWert);
  useEffect(() => {
    if (!egridWert || egridAufloesung.isLoading) return;
    const id = egridAufloesung.data;
    setSuche(alt => { const neu = new URLSearchParams(alt); neu.delete('egrid'); if (id) neu.set('parzelle', id); return neu; }, { replace: true });
    if (!id) toast({ title: 'Diese Parzelle ist nicht im Bestand', description: 'Aurora führt Zürich und Thurgau.' });
  }, [egridWert, egridAufloesung.isLoading, egridAufloesung.data, setSuche]);
  const [mehrAuf, setMehrAuf] = useState(false);
  const { current: kantonJetzt } = useCanton();
  const [wisch, setWisch] = useState<{ x: number; y: number } | null>(null);
  const { user, signOut } = useAuth();
  const konto = user?.email?.split('@')[0] ?? '';
  const platform = usePlatform();
  const [showInstallHint, setShowInstallHint] = useState(false);

  useEffect(() => {
    if (platform.shouldPromptInstall && !sessionStorage.getItem('bauraum-install-hint-dismissed')) {
      const t = setTimeout(() => setShowInstallHint(true), 1200);
      return () => clearTimeout(t);
    }
  }, [platform.shouldPromptInstall]);

  const dismissInstallHint = () => {
    sessionStorage.setItem('bauraum-install-hint-dismissed', '1');
    setShowInstallHint(false);
  };

  const gehe = (t: Tab, suche = '') => { navigate((t === 'cockpit' ? '/' : `/${t}`) + suche); setMehrAuf(false); window.scrollTo({ top: 0 }); };
  // Wischen auf dem iPhone: links/rechts wechselt zwischen den vier
  // Zielen der unteren Leiste. Nur waagrecht und deutlich -- sonst
  // stört es das Scrollen. Auf der Karte nicht: dort wischt man die Karte.
  const wischEnde = (e: React.TouchEvent) => {
    if (!wisch || active === 'karte') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - wisch.x, dy = t.clientY - wisch.y;
    setWisch(null);
    if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    const i = mobileBottomTabs.indexOf(active);
    if (i < 0) return;
    const j = i + (dx < 0 ? 1 : -1);
    if (j >= 0 && j < mobileBottomTabs.length) gehe(mobileBottomTabs[j]);
  };
  // Die Karten füllen den Bildschirm: ohne Kopfzeile und Ränder.
  const karteAktiv = active === 'karte' || active === 'karte3d';
  // Der gewählte Punkt steht nie halb am Rand der Leiste (22. November,
  // Julian: «abgehackt»): ist die Leiste niedriger als ihr Inhalt, rollt
  // sie ihn ganz ins Bild. Nur die Leiste rollt, nicht die Seite.
  const leiste = useRef<HTMLElement>(null);
  useEffect(() => {
    const n = leiste.current, el = n?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!n || !el) return;
    const r = el.getBoundingClientRect(), l = n.getBoundingClientRect();
    const oben = n.scrollTop + r.top - l.top - 8, unten = oben + r.height + 16 - n.clientHeight;
    if (n.scrollTop > oben) n.scrollTop = oben;
    else if (n.scrollTop < unten) n.scrollTop = unten;
  }, [active]);
  const titel = tabs.find(t => t.id === active)?.label ?? '';

  return (
    <div className="flex min-h-safe-screen bg-background">
      {/* Ein Fehler in der Objektansicht darf nicht die ganze Seite weiss
          werden lassen (gemessen mit tools/reiter-pruefen.cjs). */}
      <Auffang key={parzelle ?? 'zu'} bereich="Die Objektansicht">
        <PropertyDetailDialog id={parzelle} onClose={parzelleZu} />
      </Auffang>

      {/* Schmale Leiste nur mit Symbolen, wie in der Vorlage (DESIGN.md):
          der aktive Punkt als schwarzes Quadrat. Der Name steht beim
          Überfahren daneben und für Screenreader im Knopf. */}
      <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col items-center border-r bg-card py-5 lg:flex">
        <button type="button" onClick={() => gehe('cockpit')} aria-label="Cockpit"
                className="mb-3 grid h-11 w-11 shrink-0 place-items-center rounded-[3px] text-foreground">
          <Building2 className="h-7 w-7" strokeWidth={2.2} />
        </button>
        {/* Nur senkrecht rollbar: die Namensschilder ragten seitlich hinaus,
            und ein schräges Wischen auf dem Trackpad schob alle Symbole
            165 px aus dem Bild (22. November, Julian: «manchmal verschwindet
            das links beim Scrollen»). */}
        <nav ref={leiste} className="relative flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden overscroll-contain py-1 no-scrollbar" aria-label="Hauptnavigation">
          {gruppen.filter(g => g.titel !== 'Verwaltung').map((g, gi) => (
            <div key={g.titel} className={`flex flex-col items-center gap-1 ${gi > 0 ? 'mt-2 border-t pt-2' : ''}`}>
              {g.eintraege.map(t => (
                <LeistenPunkt key={t.id} t={t} an={active === t.id} onClick={() => gehe(t.id)} imRollbereich />
              ))}
            </div>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-1 pt-3">
          {/* Wohntraums ist ein eigenes Programm für Fondsleitungen --
              darum abgesetzt, unten, und es öffnet eine eigene Adresse. */}
          <LeistenPunkt t={{ id: 'admin', label: 'Wohntraums · Fonds', icon: Orbit }} an={false} onClick={() => navigate('/fonds')} />
          <span className="my-1 h-px w-6 bg-border" aria-hidden />
          {gruppen.find(g => g.titel === 'Verwaltung')!.eintraege.map(t => (
            <LeistenPunkt key={t.id} t={t} an={active === t.id} onClick={() => gehe(t.id)} />
          ))}
          <LeistenPunkt t={{ id: 'admin', label: 'Abmelden', icon: LogOut }} an={false} onClick={() => void signOut()} />
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col" onTouchStart={e => setWisch({ x: e.touches[0].clientX, y: e.touches[0].clientY })} onTouchEnd={wischEnde}>
        {/* Kopfzeile wie in der Vorlage: links die Suche (Parzelle,
            EGRID, Adresse), rechts die Hauptaktion und das Konto. Auf
            dem Handy Zeichen und Titel. Deckend, ohne Weichzeichner:
            Text bleibt scharf (DESIGN.md). */}
        {!karteAktiv && (
          <header className="sticky top-0 z-30 border-b bg-background pt-[env(safe-area-inset-top)] lg:border-b-0">
            <div className="flex h-16 items-center gap-3 px-4 lg:h-[76px] lg:px-10">
              <span className="grid h-9 w-9 place-items-center rounded-[3px] bg-foreground text-background lg:hidden">
                <Building2 className="h-5 w-5" />
              </span>
              <span className="min-w-0 shrink truncate text-lg font-semibold lg:hidden">{titel}</span>
              <div className="relative hidden h-11 w-[380px] lg:block">
                <div className="absolute inset-x-0 top-0 z-40"><Parzellensuche kanton={kantonJetzt} /></div>
              </div>
              {/* min-w-0: ohne darf der Kasten nicht schmaler werden als die
                  Kantone, das Wischen greift nie, und auf dem iPhone lag die
                  Kopfzeile 190 px über dem Rand (gemessen 3. November). */}
              {/* Auf dem iPhone gibt der Titel nach, nicht die Knöpfe: seit
                  dem Symbol der Suche schob ein langer Titel («Mögliche
                  Arrondierungen») das Konto 10 px über den Rand (Reiter
                  prüfen, 16. November). */}
              <div className="ml-auto flex shrink-0 items-center gap-3 lg:min-w-0 lg:shrink">
                {/* Auf dem iPhone fehlt die Leiste links: die Suche steht hier, von jeder Seite aus erreichbar. */}
                {active !== 'suche' && (
                  <button type="button" onClick={() => gehe('suche')} aria-label="Suche"
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-[3px] text-foreground hover:bg-secondary lg:hidden">
                    <Search className="h-5 w-5" />
                  </button>
                )}
                <button type="button" onClick={() => gehe('calc')}
                        className="hidden h-11 items-center gap-2 rounded-[3px] bg-accent px-4 text-[15px] font-medium text-accent-foreground transition-transform active:scale-[0.97] lg:inline-flex">
                  <Plus className="h-4 w-4" /> Neue Kalkulation
                </button>
                {/* Auf dem iPhone steht Hell/Dunkel unter «Mehr»: die Kopfzeile bleibt der Suche und dem Konto (22. November). */}
                <span className="hidden lg:inline-flex"><ThemeToggle /></span>
                <KontoMenu />
              </div>
            </div>
          </header>
        )}

        <div className={karteAktiv ? 'flex-1' : `w-full flex-1 overflow-x-clip px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 lg:px-10 lg:pb-12 lg:pt-4 animate-fade-in`} key={active}>
          <Auffang key={active} bereich={titel}>
          <Suspense fallback={
            <div className="space-y-4">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          }>
            {active === 'cockpit' && <Cockpit onGehe={z => gehe(z)} />}
            {active === 'suche' && <Suche />}
            {active === 'leads' && <Leads />}
            {active === 'calc' && <CalcYouLater />}
            {active === 'zentrale' && <Zentrale />}
            {active === 'baugesuche' && <Baugesuche />}
            {active === 'leadlisten' && <LeadListen />}
            {active === 'wunsch' && <ParzellenNachWunsch />}
            {active === 'karte' && <Karte onSchliessen={() => gehe('cockpit')} />}
            {active === 'arrondierung' && <Arrondierung />}
            {active === 'gelegenheiten' && <Gelegenheiten />}
            {active === 'kalender' && <Kalender />}
            {active === 'karte3d' && <Karte3DSeite />}
            {active === 'auswertung' && <Auswertung />}
            {active === 'admin' && (
              <AdminZugang>
              <div className="space-y-6">
                {/* Wer war von wo da -- das Erste, was der Admin sieht. */}
                <Anmeldungen />
                {/* Wer welchen Kunden sieht -- die Grenze zieht die Datenbank. */}
                <Teams />
                {/* Wer in CALC entscheidet, verschickt und unterschreibt. */}
                <AblaufPersonen />

                <div className="space-y-6">
                <AdminSettings />
                <Protokoll />
              </div>
              </div>
              </AdminZugang>
            )}
          </Suspense>
          </Auffang>
        </div>

        {/* iPhone: vier feste Ziele und "Mehr". Gleich gross, ein Feld. */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-safe lg:hidden" aria-label="Hauptnavigation">
          <div className="grid grid-cols-5 px-1 pt-1.5">
            {[...mobileBottomTabs.map(id => tabs.find(x => x.id === id)!), { id: 'mehr' as const, label: 'Mehr', icon: MoreHorizontal }].map(t => {
              const an = t.id === 'mehr' ? mehrAuf : active === t.id && !mehrAuf;
              return (
                <button key={t.id} type="button"
                        onClick={() => (t.id === 'mehr' ? setMehrAuf(v => !v) : gehe(t.id as Tab))}
                        className={`flex flex-col items-center gap-1 py-1.5 text-[11px] font-medium transition-colors ${an ? 'text-foreground' : 'text-muted-foreground'}`}>
                  <span className={`grid h-8 w-11 place-items-center rounded-[3px] transition-colors ${an ? 'bg-foreground text-background' : ''}`}>
                    <t.icon className="h-5 w-5" />
                  </span>
                  {KURZ[t.id as Tab] ?? t.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* "Mehr": alle Bereiche als Liste, von unten -- wie auf dem iPhone gewohnt. */}
        {mehrAuf && (
          <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setMehrAuf(false)}>
            <div className="absolute inset-0 bg-foreground/30" />
            <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-md bg-card px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 animate-fade-in"
                 onClick={e => e.stopPropagation()}>
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
              {gruppen.map(g => (
                <div key={g.titel} className="mb-4">
                  <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.titel}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {g.eintraege.map(t => (
                      <button key={t.id} type="button" onClick={() => gehe(t.id)}
                              className={`flex h-12 items-center gap-3 rounded-[3px] border px-3 text-sm font-medium ${active === t.id ? 'border-foreground bg-foreground text-background' : 'bg-card'}`}>
                        <t.icon className="h-4 w-4" /> {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => navigate('/fonds')}
                      className="mb-4 flex h-12 w-full items-center gap-3 rounded-[3px] border px-3 text-sm font-medium">
                <Orbit className="h-4 w-4" /> Wohntraums · Fonds <span className="ml-auto text-xs text-muted-foreground">eigenes Programm</span>
              </button>
              <div className="flex items-center justify-between border-t px-2 pt-4">
                <span className="flex items-center gap-2 text-sm text-muted-foreground"><ThemeToggle /> {konto}</span>
                <button type="button" onClick={() => void signOut()} className="text-sm font-semibold">Abmelden</button>
              </div>
            </div>
          </div>
        )}

        {/* iOS Safari: "Zum Home-Bildschirm". Nicht über der 3D-Karte: dort
            fehlt die untere Leiste, über der er sitzt -- er läge auf Legende
            und Tafel. */}
        {showInstallHint && active !== 'karte3d' && (
          <div className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 animate-fade-in lg:hidden">
            <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-ceramic-hover">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Aurora als App installieren</p>
                <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  Tippe auf <Share className="inline h-3.5 w-3.5" /> «Teilen» und dann <Plus className="inline h-3.5 w-3.5" /> «Zum Home-Bildschirm»
                </p>
              </div>
              <button type="button" onClick={dismissInstallHint} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Schliessen">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

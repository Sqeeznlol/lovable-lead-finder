# Werbeauswertung aller Checker für Gian Reto, als HTML für den Druck (A4).
#   python3 docs/kampagnenplan/auswertung.py   schreibt auswertung.html
#   node docs/kampagnenplan/pdf-auswertung.cjs  druckt Werbeauswertung-Checker.pdf
#
# Julian, 18. November: «über alle Checker eine Analyse ... wo es sich lohnt,
# Ads zu schalten, mit konkreten Anweisungen, wo wie viel investieren ...
# auf dem Schweizer Markt ... ein PDF für Gian Reto».
#
# Jede Zahl kommt aus einer Datei: Suchen und Gebote aus volumen.tsv (über
# plan.py, damit beide Unterlagen dieselben Kampagnen nennen), Gebäude je
# Kanton aus kantone.tsv (BFS), Besucher und Leads aus der Messung vom
# 18. November (Ablauf Auswerten «besucher»). Was Annahme ist, steht so da.
import contextlib, io, sys
from bausteine import CSS, DIR, balken, esc, lesen, tabelle, tsd

sys.path.insert(0, str(DIR))
with contextlib.redirect_stdout(io.StringIO()):
    import plan as P  # schreibt nebenbei kampagnenplan.html neu, mit denselben Daten

STAND = '18. November 2026'
CSS_EXTRA = ('.eng table { font-size: 7.9pt; } .eng td { padding-top: 1.15mm; padding-bottom: 1.15mm; }'
             '.kt td:nth-child(4) { white-space: nowrap; }'
             '.ck table { table-layout: fixed; } .ck th:nth-child(1) { width: 30mm; } .ck th:nth-child(2) { width: 34mm; }'
             '.ck th:nth-child(3) { width: 63mm; } .ck th:nth-child(4) { width: 13mm; } .ck th:nth-child(5) { width: 16mm; } .ck th:nth-child(6) { width: 14mm; }')

# ------------------------------------------------------------ Messung 18. November
# Auswerten «besucher», Lauf 102: 30 Tage, Sitzungen mit Aufruf, Leads gezählt
# gegen Tabelle anfrage (2 echte am 16. November, 3 Tests am 13. gekennzeichnet).
BESUCHER_30 = 72
LEADS_30 = 2
LEAD_DOMAIN = 'parzellenrechner.ch'

# ------------------------------------------------------------ Markt je Kanton
import csv
with (DIR / 'kantone.tsv').open(encoding='utf-8') as f:
    KT = {z['kanton']: {k: int(v) for k, v in z.items() if k != 'kanton'}
          for z in csv.DictReader((l for l in f if not l.startswith('#')), delimiter='\t')}
assert len(KT) == 26, len(KT)
ziel = lambda k: KT[k]['efh_vor1981'] + KT[k]['mfh_2_9_vor1981']
NAME = {'ZH': 'Zürich', 'BE': 'Bern', 'LU': 'Luzern', 'UR': 'Uri', 'SZ': 'Schwyz', 'OW': 'Obwalden', 'NW': 'Nidwalden', 'GL': 'Glarus', 'ZG': 'Zug',
        'FR': 'Freiburg', 'SO': 'Solothurn', 'BS': 'Basel-Stadt', 'BL': 'Basel-Landschaft', 'SH': 'Schaffhausen', 'AR': 'Appenzell A.', 'AI': 'Appenzell I.',
        'SG': 'St. Gallen', 'GR': 'Graubünden', 'AG': 'Aargau', 'TG': 'Thurgau', 'TI': 'Tessin', 'VD': 'Waadt', 'VS': 'Wallis', 'NE': 'Neuenburg',
        'GE': 'Genf', 'JU': 'Jura'}

# Was der Checker je Kanton zeigt, nachgesehen am 18. November:
#   Ziffer: Zonenplan des Kantons Zürich (WFS) und Tabelle zone_ziffer
#     (Ablauf Zonenziffern, 14. November: AG 23'338, LU 3'182 ohne Art,
#     SZ 2'509, SO 1'515, SH 1'227, ZG 977 Zonenflächen).
#   Preise: public/preise.json, ZH 160 und BL 61 Gemeinden.
#   Baugesuche: Statistisches Amt Zürich und Amtsblattportal (Rubriken BE,
#     BS, BL, ZG, AR, TI, SZ, SO, SH, NW, OW, VS); AG verbietet das
#     Einlesen, SG und LU erst auf Anfrage.
ZIFFER = {'ZH', 'AG', 'SZ', 'SO', 'SH', 'ZG', 'LU'}
PREISE = {'ZH', 'BL'}
BAUGESUCHE = {'ZH', 'BE', 'BS', 'BL', 'ZG', 'AR', 'TI', 'SZ', 'SO', 'SH', 'NW', 'OW', 'VS'}
# Die Check-Seiten gibt es nur auf Deutsch.
STUFE = {**{k: 'A' for k in ZIFFER},
         **{k: 'B' for k in ['BE', 'SG', 'BL', 'TG', 'GR', 'BS', 'AR', 'AI', 'GL', 'NW', 'OW', 'UR']},
         'FR': 'C', 'VS': 'C', **{k: 'nein' for k in ['TI', 'VD', 'GE', 'NE', 'JU']}}
assert set(STUFE) == set(KT)

A = sorted(ZIFFER, key=lambda k: -ziel(k))
A_SUMME = sum(ziel(k) for k in A)
DEUTSCH = [k for k in KT if STUFE[k] in ('A', 'B')]
ANTEIL_A = {k: ziel(k) / A_SUMME for k in A}

# Suchen bei Google, die einen Kanton oder seine Städte nennen (aus den 377
# Wörtern). «gis zh» zählt nicht: dort will man zur Karte des Kantons.
ORTSWORT = {'ZH': ['zürich', 'winterthur', 'uster'], 'AG': ['aargau'], 'BE': ['bern'], 'LU': ['luzern'], 'SG': ['st gallen'], 'TG': ['thurgau'],
            'SZ': ['schwyz'], 'SO': ['solothurn'], 'ZG': ['zug']}


def ortssuchen(kt):
    import re
    return sum(P.v(w) for w in P.vol if w != 'gis zh' and any(re.search(rf'(^|\s){re.escape(o)}($|\s)', w) for o in ORTSWORT.get(kt, [])))


def zeigt(k):
    t = ['Zone']
    if k in ZIFFER:
        t.append('Ausnützung' if k != 'LU' else 'Ziffer ohne Art')
    if k in PREISE:
        t.append('Preise')
    if k in BAUGESUCHE:
        t.append('Baugesuche')
    return ', '.join(t)


# ------------------------------------------------------------ Google
# Tagesbudgets aus dem Plan vom 16. November (GOOGLE_TEILUNG), Höchstgebote
# aus seinem Kasten «Gebote».
TAG = {z[0]: (z[2], z[3]) for z in P.GOOGLE_TEILUNG}
MAX_CPC = {'Erbe': 3.0, 'Steuer': 3.0, 'Ausbau': 4.0}


def klickpreis(woerter):
    """Mittlerer Klickpreis in Franken: Mitte aus tiefem und hohem Gebot, nach Suchen gewichtet.
    Ohne Gebot rechnen wir CHF 0.30 (Annahme: Google hat dann zu wenig Werbende für eine Angabe)."""
    s = sum(P.v(w) for w in woerter)
    return sum(P.v(w) * ((sum(P.gebot(w)) / 2) if P.gebot(w) else 0.30) for w in woerter) / s


K = {k['kurz']: k for k in P.KAMPAGNEN}
PREIS_ALLE = klickpreis(P.alle_google)
# Wie viel sich bei Google auf diesen Themen überhaupt ausgeben lässt: alle
# Suchen, ein Anteil davon klickt (Annahme 5 bis 8 %), zum mittleren Preis.
KLICK_TIEF, KLICK_HOCH = 0.05, 0.08
DECKE = (P.GOOGLE_SUMME * KLICK_TIEF * PREIS_ALLE, P.GOOGLE_SUMME * KLICK_HOCH * PREIS_ALLE)
GOOGLE_MONAT_PLAN = 43 * 30  # Tagesbudgets Woche 3 bis 6 zusammen: CHF 43

# ------------------------------------------------------------ Budget sechs Wochen (Plan 16. November)
BUDGET_ZEILEN = P.BUDGET
SECHS_WOCHEN = 5000
META_ANTEIL = round(100 * (2300 + 750 + 200) / SECHS_WOCHEN)
GOOGLE_ANTEIL = round(100 * 1550 / SECHS_WOCHEN)
BING_ANTEIL = round(100 * 200 / SECHS_WOCHEN)

# Meta: Ratgeber und Check je Woche, aufgeteilt auf die Anzeigen (Annahme:
# die breiteste Zielgruppe bekommt am meisten, die kleinste genug für Zahlen).
META_TEILUNG = [
    ('Ratgeber 60 plus', 'hauschecker.ch/ratgeber/haus-zu-gross', 'Alter 60 und älter', 18, 30),
    ('Ratgeber Erben', 'hauschecker.ch/ratgeber/liegenschaft-geerbt', 'Alter 45 bis 65', 12, 22),
    ('Ratgeber Aufstocken', 'hauschecker.ch/ratgeber/aufstocken', 'Alter 35 bis 60', 6, 12),
    ('Check «Wie viel dürfte hier stehen?»', 'parzellenchecker.ch, Zwillinge im Wechsel', 'Sonderkategorie Wohnraum: kein Alter', 11, 21),
    ('Zweite Anzeige', 'die Seite mit der geprüften Adresse', 'Wer geprüft und nichts hinterlassen hat', 0, 7),
]
assert sum(z[3] for z in META_TEILUNG[:3]) * 7 <= 252 and sum(z[4] for z in META_TEILUNG[:3]) * 7 <= 448
assert META_TEILUNG[3][3] * 7 <= 77 and META_TEILUNG[3][4] * 7 <= 150 and META_TEILUNG[4][4] * 7 <= 50


def seite(inhalt):
    return f'<section class="seite">{inhalt}</section>'


chf = lambda x: f"CHF {tsd(x)}"
pz = lambda x: f'{round(100 * x)} %'

# ============================================================ Seiten
titel = seite(f"""
<div class="titelseite">
  <div>
    <p class="ueber">Werbeauswertung · Stand {STAND} · für Gian Reto</p>
    <h1>Wo wir für die Checker<br>werben, und mit wie viel</h1>
    <p class="lead">Alle 23 Checker, der Schweizer Markt je Kanton, die Suchen bei Google und was jede Seite heute zeigt. Daraus: wo Anzeigen laufen, wo nicht, mit welchem Budget, und Schritt für Schritt, wie sie eingerichtet werden.</p>
    <div class="kern">
      <div><b>{chf(SECHS_WOCHEN)}</b><span>für den Test, sechs Wochen, danach Entscheid je Kanal und Seite</span></div>
      <div><b>{len(A)} Kantone</b><span>zum Start: {', '.join(A)}. Dort zeigt der Checker die Ausnützung.</span></div>
      <div><b>{tsd(A_SUMME)}</b><span>Häuser in diesen Kantonen, vor 1981 gebaut: Einfamilienhäuser und Häuser mit 2 bis 9 Wohnungen (BFS)</span></div>
    </div>
  </div>
  <div class="unten"><span class="klein">Bauraum · Check-Seiten</span><span class="klein">Grundlage: BFS, Google Ads, eigene Messung. Ergänzt den Kampagnenplan vom 16. November.</span></div>
</div>
""")

kurz = seite(f"""
<p class="ueber">Auf einer Seite</p>
<h2>Was wir schalten</h2>
<ol class="schritte">
  <li><div><b>Nur Deutschschweiz, zuerst {len(A)} Kantone.</b> {', '.join(NAME[k] for k in A)}: Dort steht die Ausnützungsziffer im Ergebnis, und genau sie löst den Wunsch nach der Berechnung aus. {pz(ANTEIL_A['ZH'])} der Häuser dieser Kantone stehen im Kanton Zürich, wo der Checker auch Preise und Baugesuche zeigt. Romandie und Tessin nicht: die Seiten gibt es nur auf Deutsch.</div></li>
  <li><div><b>Google auf fünf Fragen, die niemand bewirbt.</b> Zonenplan, Ausnützung, Parzelle, Baubewilligung und Erbe, je eine Domain. Auf allen Wörtern der Kampagnen zusammen {tsd(P.GOOGLE_SUMME)} Suchen im Monat; für {P.GUENSTIG_ANTEIL} % davon kostet ein Platz oben höchstens CHF 3. Aufstocken kommt in Woche 3 dazu, die Grundstückgewinnsteuer, sobald ihr Ratgeber steht.</div></li>
  <li><div><b>Facebook und Instagram für alle, die nicht suchen.</b> Wer 70 ist und ein zu grosses Haus hat, tippt nichts ein. Ihn erreicht der Ratgeber nach Alter und Kanton. Dahinter läuft die Check-Anzeige mit dem Luftbild seiner Gemeinde.</div></li>
  <li><div><b>Nicht schalten:</b> Hauswert und Bewertung bei Google (oben CHF {P.gebot('immobilienbewertung')[0]:.0f} bis {P.gebot('immobilienbewertung')[1]:.0f} je Klick, dort bieten Makler und Portale), die Namen der Domains (niemand sucht sie), Display, YouTube und Performance Max, TikTok und LinkedIn.</div></li>
  <li><div><b>{chf(SECHS_WOCHEN)} in sechs Wochen.</b> Facebook und Instagram {META_ANTEIL} %, Google {GOOGLE_ANTEIL} %, Bing {BING_ANTEIL} %. Die ersten zwei Wochen mit halber Kraft, bis die Messung stimmt.</div></li>
  <li><div><b>Entschieden wird an den Kosten je heissem Lead.</b> Heiss heisst: Eigentümer, will verkaufen oder bauen, innert zwölf Monaten. Unter CHF 150 Budget verdoppeln, über CHF 400 stoppen, dazwischen Text und Seite verbessern.</div></li>
</ol>
<div class="kasten">
  <p><b>Was heute gemessen ist.</b> In den letzten 30 Tagen hatten alle 23 Checker zusammen {BESUCHER_30} Besucher, alle ohne Werbung, und {LEADS_30} Leads, beide auf {LEAD_DOMAIN}. Welche Seite und welcher Kanal verkauft, weiss heute niemand. Der Test misst es je Domain ab dem ersten Klick; darum stehen unten feste Regeln statt Versprechen.</p>
</div>
""")

markt_zeilen = sorted(((NAME[k] + ('' if STUFE[k] in ('A', 'B') else ' *'), ziel(k), f'Stufe {STUFE[k]}' if STUFE[k] != 'nein' else 'nicht deutsch') for k in KT), key=lambda z: -z[1])
markt = seite(f"""
<p class="ueber">Der Markt</p>
<h2>Wo die Häuser stehen, um die es geht</h2>
<p class="grau" style="max-width:160mm">Gezählt sind Einfamilienhäuser und Häuser mit 2 bis 9 Wohnungen, gebaut vor 1981: Dort gehört das Haus meist einer Person oder Familie, und die Frage nach Sanierung, Ausbau oder Verkauf liegt am nächsten. Die Schweiz hat {tsd(sum(KT[k]['efh'] for k in KT))} Einfamilienhäuser, {tsd(sum(KT[k]['efh_vor1981'] for k in KT))} davon vor 1981 gebaut (BFS, 2023).</p>
{balken(markt_zeilen[:16], breite=176)}
<p class="klein">Häuser vor 1981 je Kanton, die 16 grössten. * Seiten nur deutsch, darum vorerst ohne Werbung. Stufe A: Start, Stufe B: ab Woche 3, Stufe C: nur die deutschsprachigen Bezirke, nach dem Test.</p>
<div class="kasten">
  <p><b>Bern hat mehr solche Häuser als Zürich</b> ({tsd(ziel('BE'))} gegen {tsd(ziel('ZH'))}), zeigt im Checker aber noch keine Ausnützung. Darum Stufe B: ab Woche 3 mit dabei, die Reserve rechnen wir dort persönlich. Werden die Berner Ziffern geladen, gehört Bern in Stufe A. Dasselbe gilt für St. Gallen und Thurgau.</p>
</div>
""")

kanton_zeilen = []
for k in sorted(KT, key=lambda x: (['A', 'B', 'C', 'nein'].index(STUFE[x]), -ziel(x))):
    s = ortssuchen(k)
    anteil = pz(ANTEIL_A[k]) if k in ANTEIL_A else ''
    kanton_zeilen.append([f'<b>{NAME[k]}</b>', tsd(KT[k]['efh']), tsd(ziel(k)), zeigt(k), tsd(s) if k in ORTSWORT else '', f'<span class="urteil">{STUFE[k] if STUFE[k] != "nein" else "nein"}</span>', anteil])
kantone = seite(f"""
<p class="ueber">Kanton für Kanton</p>
<h2>Was der Checker wo zeigt, und wo wir werben</h2>
<p class="grau" style="max-width:160mm">Je mehr der Checker für eine Adresse zeigt, desto eher hinterlässt jemand seinen Kontakt. Die Spalte «Anteil» verteilt das Budget der Stufe A nach Häusern; so werden die Anzeigengruppen bei Facebook und die Ortsberichte bei Google gelesen.</p>
<div class="eng kt">{tabelle(['Kanton', 'Einfamilien­häuser', 'Häuser vor 1981', 'Der Checker zeigt', 'Suchen mit Ortsname', 'Stufe', 'Anteil'], kanton_zeilen, rechts=(1, 2, 4, 6))}</div>
<p class="klein">Häuser vor 1981: Einfamilienhäuser und Häuser mit 2 bis 9 Wohnungen (BFS, Gebäude- und Wohnungsstatistik 2023). Suchen mit Ortsname: Google, Mittel der letzten zwölf Monate, nur die Wörter aus unserer Liste von 377, die den Kanton oder seine Städte nennen; leer heisst nicht abgefragt. Zone zeigt der Checker überall aus dem Bund, den ÖREB-Auszug verlinkt er, wo der Kanton ihn hat.</p>
""")

rolle_google = {k['domain']: k['kurz'] for k in P.KAMPAGNEN}
CHECKER = []
for k in P.KAMPAGNEN:
    w1, w3 = TAG[k['kurz']]
    wann = 'ab Tag 1' if w1 else ('ab Woche 3' if k['kurz'] != 'Steuer' else 'wenn der Ratgeber steht')
    CHECKER.append([f'<b>{k["domain"]}</b>', esc(k['frage']), f'Kampagne «{k["kurz"]}», {wann}', w1 or '–', w3, tsd(P.summe(k['woerter']))])
# Die Zwillinge je Gruppe in einer Zeile; der Einsatz kurz, wie im Plan (REST).
EINSATZ = {
    'bauzonencheck.ch': 'Ersatz für zonen-check.ch bei Google, nie beide zugleich.',
    'baurechner24.ch': 'Facebook: Check-Anzeige «Wie viel dürfen Sie bauen?», die Namen gegeneinander.',
    'ausbaupotenzial.ch': 'Facebook: Ziel der Anzeige zum Ratgeber «Aufstocken», im Wechsel.',
    'verdichtungscheck.ch': f'Keine Anzeigen: «verdichtung» wird {tsd(P.v("verdichtung"))} Mal im Monat gesucht.',
    'parzellencheck24.ch': 'Facebook: dieselbe Check-Anzeige auf vier Namen; nach vier Wochen bleibt der mit den meisten Kontakten.',
    'hauswertrechner.ch': 'Facebook: Check-Anzeige «Was ist Ihr Haus wert?», auf die drei Namen verteilt. Bei Google zu teuer.',
    'parzellenwert.ch': 'Später eine kleine Google-Gruppe «Baulandpreise», nur Zürich und Basel-Landschaft, wo der Check den Baulandpreis zeigt.',
    'eigentuemercheck.ch': 'Kurze Adresse für Inserate beim Hauseigentümerverband und für Facebook ohne Thema.',
}
for z in P.REST:
    erste = z[0].split('<br>')[0]
    CHECKER.append([z[0], esc(z[1]), EINSATZ[erste], '–', '–', ''])
checker = seite(f"""
<p class="ueber">Alle 23 Checker</p>
<h2>Welche Seite wo läuft</h2>
<p class="grau" style="max-width:160mm">Google wertet es als unfairen Vorteil, dieselbe Suche mit mehreren eigenen Seiten zu bewerben. Darum hat bei Google jedes Thema genau eine Domain. Die Zwillinge laufen bei Facebook gegeneinander, wo Name und Gestaltung verglichen werden dürfen, oder als kurze Adresse für Inserate.</p>
<div class="eng ck">{tabelle(['Domain', 'Frage oder Rolle', 'Einsatz', 'W 1, 2', 'W 3 bis 6', 'Suchen'], CHECKER, rechts=(3, 4, 5))}</div>
<p class="klein">W 1, 2 und W 3 bis 6: Tagesbudget bei Google in Franken, in den Wochen 1 und 2 und in den Wochen 3 bis 6. Suchen: im Monat, auf allen Wörtern der Kampagne. Die Facebook-Budgets stehen auf der Seite «Facebook und Instagram»; dort laufen die Zwillinge.</p>
""")


def kampagne(k):
    w = sorted(k['woerter'], key=lambda x: -P.v(x))
    oben = ', '.join(f'{esc(x)} ({tsd(P.v(x))})' for x in w[:8])
    ziel_url = f"https://www.{k['domain']}{k['pfad']}?utm_source=google&amp;utm_medium=cpc&amp;utm_campaign={k['utm']}&amp;utm_term={{keyword}}"
    w1, w3 = TAG[k['kurz']]
    return [f'<b>{k["kurz"]}</b><br><span class="klein">{esc(k["domain"])}</span>', f'{w1 or "–"}<br>{w3}', f'CHF {MAX_CPC.get(k["kurz"], 2.5):.2f}',
            f'{oben}<br><span class="klein"><b>Titel:</b> {esc(" | ".join(k["titel"]))}<br><b>Texte:</b> {esc(k["text"][0])} {esc(k["text"][1])}</span>'
            f'<br><span class="klein">Ziel: {ziel_url}</span><br><span class="klein">Ausschliessen: {esc(", ".join(k["aus"]))}</span>']


google = seite(f"""
<p class="ueber">Google Ads</p>
<h2>So einrichten</h2>
<ol class="schritte">
  <li><div><b>Ein Konto für alle Seiten,</b> Zahlung in Franken, Zeitzone Zürich. Automatisch übernommene Empfehlungen von Google ausschalten.</div></li>
  <li><div><b>Conversion «Lead»</b> als einziges Hauptziel: der abgeschickte Kontakt auf der Check-Seite. «Adresse geprüft» als Nebenziel zum Beobachten. Conversion-ID und Label an uns, wir bauen den Messpunkt ein; er lädt wie der von Meta erst nach Zustimmung.</div></li>
  <li><div><b>Je Kampagne:</b> nur Google-Suche, ohne Suchnetzwerk-Partner und ohne Display. Sprache Deutsch. Orte: die Kantone der Stufe A, Option «Präsenz: Personen an diesen Orten». Ab Woche 3 die Stufe B in einer Kopie, damit die Kosten getrennt bleiben.</div></li>
  <li><div><b>Gebote:</b> «Klicks maximieren» mit Höchstgebot aus der Tabelle. Auf «Conversions maximieren» erst, wenn eine Kampagne 30 Leads hat.</div></li>
  <li><div><b>Wörter</b> als Wortgruppe und genau, nie weitgehend passend. Die Liste zum Ausschliessen für das ganze Konto: {esc(', '.join(['mieten', 'miete', 'mietwohnung', 'wohnung kaufen', 'haus kaufen', 'bauland kaufen', 'ferienwohnung', 'stelle', 'job', 'lehre', 'ausbildung', 'gratis inserat', 'homegate', 'immoscout', 'newhome', 'comparis', 'deutschland', 'österreich']))}.</div></li>
  <li><div><b>Anzeigen:</b> eine responsive Suchanzeige je Kampagne mit den Titeln und Texten aus der Tabelle (Titel höchstens 30, Texte höchstens 90 Zeichen, geprüft), dazu Zusatzinfos «Kostenlos», «Amtliche Daten», «In einer Minute» und Sitelinks auf «So funktioniert's» und den passenden Ratgeber. Keine Anrufanzeige, solange die Nummer fehlt.</div></li>
</ol>
{tabelle(['Kampagne', 'CHF je Tag<br>W 1, 2 / W 3 bis 6', 'Höchst&shy;gebot', 'Die grössten Wörter (Suchen im Monat), Ziel und Ausschlüsse'], [kampagne(K[x]) for x in ['Zone', 'Ausnützung', 'Parzelle', 'Erbe', 'Bauen', 'Ausbau', 'Steuer']], rechts=(1, 2))}
<p class="klein">«{{keyword}}» setzt Google selbst ein; die Seite schreibt Quelle, Kampagne und Suchwort zu jedem Lead. Steuer startet erst mit dem Ratgeber Grundstückgewinnsteuer, der noch fehlt: heute führt der Link auf die Startseite von hauschecker.ch.</p>
""")

meta_zeilen = [[f'<b>{a}</b>', esc(b), esc(c), f'{d or "–"}', f'{e}'] for a, b, c, d, e in META_TEILUNG]
KLEIN = ['SZ', 'SH', 'ZG']
meta_regionen = [[NAME[k], pz(ANTEIL_A[k]), tsd(ziel(k))] for k in A if k not in KLEIN] + \
    [[', '.join(NAME[k] for k in KLEIN), pz(sum(ANTEIL_A[k] for k in KLEIN)), tsd(sum(ziel(k) for k in KLEIN))]]
meta = seite(f"""
<p class="ueber">Facebook und Instagram</p>
<h2>So einrichten</h2>
<div class="zwei">
  <div>
    <ol class="schritte">
      <li><div><b>Meta Business</b> mit bestätigten Domains (alle 23). Pixel-ID an uns: Wir tragen sie bei Vercel ein, das Pixel meldet «Lead», sobald jemand seinen Kontakt schickt, und lädt nur nach Zustimmung.</div></li>
      <li><div><b>Kampagnenziel «Leads»</b>, Conversion-Ort Website, Ereignis «Lead». Nie das Formular von Meta: nur auf der Seite prüft der Eigentümer seine Adresse.</div></li>
      <li><div><b>Ratgeber</b> ohne Sonderkategorie, nach Alter und Kanton. Stuft Meta eine Anzeige als Wohnraum ein, läuft sie dort weiter; nicht umformulieren, um die Prüfung zu umgehen.</div></li>
      <li><div><b>Check und Zweite Anzeige</b> in der Sonderkategorie Wohnraum: kein Alter, keine PLZ, Kanton oder Stadt mit 17 km Umkreis.</div></li>
      <li><div><b>Bilder:</b> Ratgeber mit einem Haus mit Garten aus der Region, ohne Text im Bild. Check mit dem Luftbild der Gemeinde und einer eingezeichneten Parzelle; die Bilder machen wir aus den Luftbildern des Bundes.</div></li>
    </ol>
  </div>
  <div>
    <h3 style="margin-top:0">Orte in Stufe A</h3>
    <p class="klein" style="margin-bottom:1mm">Je Anzeige eine Gruppe je Kanton, Budget nach Anteil. Unter CHF 3 am Tag lernt Meta zu wenig (Annahme): die kleinen Kantone darum in einer Gruppe.</p>
    {tabelle(['Kanton', 'Anteil', 'Häuser'], meta_regionen, rechts=(1, 2))}
  </div>
</div>
{tabelle(['Anzeige', 'Führt auf', 'Zielgruppe', 'CHF je Tag W 1, 2', 'W 3 bis 6'], meta_zeilen, rechts=(3, 4))}
<p class="klein">Die Aufteilung innerhalb von Ratgeber und Check ist eine Annahme: Die breiteste Gruppe bekommt am meisten, die kleinste genug für Zahlen. Nach zwei Wochen zählt nur noch, was Leads bringt.</p>
""")

budget = seite(f"""
<p class="ueber">Budget</p>
<h2>Wie viel, Woche für Woche</h2>
{tabelle(['', 'Ratgeber', 'Check', 'Zweite Anzeige', 'Google', 'Bing', 'Je Woche'], BUDGET_ZEILEN, rechts=(1, 2, 3, 4, 5, 6))}
<div class="zwei">
  <div>
    <h3>Bei Google ist die Menge begrenzt</h3>
    <p>Auf allen Wörtern der Kampagnen wird zusammen {tsd(P.GOOGLE_SUMME)} Mal im Monat gesucht, ein Klick kostet in der Mitte der Gebote rund CHF {PREIS_ALLE:.2f}. Klicken 5 bis 8 % der Suchenden (Annahme), lassen sich dort CHF {tsd(DECKE[0])} bis {tsd(DECKE[1])} im Monat ausgeben, für die ganze Deutschschweiz. Der Plan sieht ab Woche 3 CHF {tsd(GOOGLE_MONAT_PLAN)} vor. Mehr Geld bei Google kauft auf diesen Themen kaum mehr Besucher, nur teurere.</p>
  </div>
  <div>
    <h3>Wachsen kann Facebook</h3>
    <p>Bei Facebook und Instagram wächst die Reichweite mit dem Budget. Steht der Kanal nach sechs Wochen unter CHF 150 je heissem Lead, verdoppeln wir dort, Kanton für Kanton, und nehmen die Stufe B dazu. Bing übernimmt ab Woche 3 die zwei besten Google-Kampagnen mit einem Zehntel ihres Budgets.</p>
  </div>
</div>
<div class="kasten">
  <p><b>Zum Vergleich:</b> Gekaufte Verkäufer-Leads kosten in der Schweiz CHF 30 bis 150, wenn sie mehrere Makler bekommen, und CHF 150 bis 400 exklusiv und vorgeprüft (RealAdvisor 2026). Unsere Leads gehören nur uns und kommen mit Adresse, Parzelle und Absicht.</p>
</div>
""")

PRUEFEN = [
    ['Jeden Montag', 'Kosten je heissem Lead je Kanal, Domain und Kanton. Die Seite «Leads» in Aurora zählt Besucher, Adressen, Berechnungen und Leads je Domain; Quelle und Kampagne stehen bei jedem Lead.'],
    ['150 Klicks ohne Kontakt', 'Kampagne stoppen oder auf den Zwilling der Domain wechseln.'],
    ['Unter CHF 150 je heissem Lead', 'Budget des Kanals verdoppeln.'],
    ['CHF 150 bis 400', 'Anzeigentext und Seite verbessern, Budget halten.'],
    ['Über CHF 400', 'Stoppen.'],
    ['Viele Suchen, wenig Ergebnisse', 'Melden: dann findet die Seite die Adressen nicht. Am 18. November fiel die Adresssuche des Bundes aus; die Seiten fragen seither zusätzlich das Gebäuderegister.'],
]
VOR_START = [
    ['Werbekonten Google und Meta', 'Gian Reto', 'Konten anlegen, Domains bei Meta bestätigen'],
    ['Conversion-ID Google, Pixel-ID Meta', 'Gian Reto an uns', 'wir bauen beides ein, nur nach Zustimmung'],
    ['Impressum: E-Mail und UID', 'Julian', 'das Gesetz verlangt die E-Mail (UWG Art. 3 Abs. 1 lit. s)'],
    ['Datenschutz: Auftragsbearbeiter und Länder', 'Julian, dann wir', 'Hosting, Datenbank, Google, Meta (DSG Art. 19)'],
    ['Telefonnummer für Rückrufe', 'Julian', 'viele Ältere rufen lieber an; Rückruf innert einer Stunde'],
    ['Ratgeber Grundstückgewinnsteuer', 'wir', 'erst dann startet die Kampagne «Steuer»'],
    ['Bilder für Facebook', 'wir', 'Luftbild je Gemeinde mit Parzelle, Haus mit Garten je Region'],
]
QUELLEN = [
    'Gebäude je Kanton: BFS, Gebäude- und Wohnungsstatistik 2023, Tabelle px-x-0902010000_101 (STAT-TAB), abgefragt am 18. November 2026; Datei kantone.tsv.',
    f'Suchen und Gebote: Google Ads über DataForSEO, Schweiz, Deutsch, 377 Wörter, Mittel der letzten zwölf Monate, abgefragt am {P.STAND}; Datei volumen.tsv. Gebote in US-Dollar, umgerechnet mit {P.KURS}. Zahlen je Kanton liefert Google über diesen Weg nicht verlässlich (für den Kanton Zürich am 18. November überall 0), darum die Wörter mit Ortsnamen.',
    'Was der Checker je Kanton zeigt: Ablauf Zonenziffern vom 14. November (Zonenflächen mit Ziffer je Kanton), public/preise.json (ZH 160, BL 61 Gemeinden), Rubriken des Amtsblattportals in tools/baugesuche_amtsblatt.ts.',
    f'Besucher und Leads: Ablauf Auswerten «besucher» vom {STAND}, 30 Tage, Tabellen check_ereignis und anfrage, Tests ausgenommen.',
    'Budget, Kampagnen, Anzeigentexte, Regeln von Meta und Google, Preise gekaufter Leads: Kampagnenplan vom 16. November 2026 mit seinen Quellen.',
]
schluss = seite(f"""
<p class="ueber">Messen und starten</p>
<h2>Regeln, Liste vor dem Start, Quellen</h2>
{tabelle(['Wann', 'Was tun'], PRUEFEN)}
<h3>Vor dem ersten Franken</h3>
{tabelle(['Was', 'Wer', 'Warum'], VOR_START)}
<h3>Was diese Auswertung nicht weiss</h3>
<p>Wie viele Besucher aus Anzeigen eine Adresse prüfen und ihren Kontakt hinterlassen, zeigt erst der Test. Die Klickrate von 5 bis 8 % und der Preis von CHF 0.30 für Wörter ohne Gebote sind Annahmen. Wie viel ein Haus wert ist und damit ein Lead, kennen wir je Gemeinde nur in Zürich und Basel-Landschaft.</p>
<h3>Quellen</h3>
<ul class="quellen">{''.join(f'<li>{esc(q)}</li>' for q in QUELLEN)}</ul>
""")

HTML = f"""<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><title>Werbeauswertung Checker, {STAND}</title><style>{CSS}{CSS_EXTRA}</style></head>
<body>{titel}{kurz}{markt}{kantone}{checker}{google}{meta}{budget}{schluss}</body></html>"""

# Prüfungen: jede gekaufte Domain kommt vor, die Budgets stimmen mit dem Plan.
assert sum(len(z[0].replace('<b>', '').split('<br>')) for z in CHECKER) == 23, CHECKER
assert sum(int(TAG[k][1].split()[1]) for k in TAG) == 43
(DIR / 'auswertung.html').write_text(HTML, encoding='utf-8')
print('Stufe A', A, 'Häuser', A_SUMME, {k: round(100 * v) for k, v in ANTEIL_A.items()})
print('Klickpreis', round(PREIS_ALLE, 2), 'Decke', [round(x) for x in DECKE], 'Plan', GOOGLE_MONAT_PLAN, 'Anteile', META_ANTEIL, GOOGLE_ANTEIL, BING_ANTEIL)
print('Ortssuchen', {k: ortssuchen(k) for k in ORTSWORT})

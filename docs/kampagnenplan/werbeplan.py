# Werbeplan Google Ads für die Check-Seiten, als HTML für den Druck (A4).
#   python3 docs/kampagnenplan/werbeplan.py      schreibt werbeplan.html
#   node docs/kampagnenplan/pdf-werbeplan.cjs    druckt Werbeplan-Check-Seiten.pdf
#
# Geworben wird nur bei Google, Julian und Bauraum gemeinsam (Julian,
# 18. November). Kampagnen, Wörter, Budgets und Gebote kommen aus plan.py
# und google_ads.py (dieselben Zahlen wie in der Importdatei), die Häuser je
# Kanton aus kantone.tsv (BFS).
import contextlib, csv, io, sys
from bausteine import CSS, DIR, esc, tabelle, tsd

sys.path.insert(0, str(DIR))
with contextlib.redirect_stdout(io.StringIO()):
    import plan as P
    import google_ads as G

with (DIR / 'kantone.tsv').open(encoding='utf-8') as f:
    KT = {z['kanton']: {k: int(v) for k, v in z.items() if k != 'kanton'}
          for z in csv.DictReader((l for l in f if not l.startswith('#')), delimiter='\t')}
haeuser = lambda k: KT[k]['efh_vor1981'] + KT[k]['mfh_2_9_vor1981']
KUERZEL = {'Zürich': 'ZH', 'Aargau': 'AG', 'Solothurn': 'SO', 'Luzern': 'LU', 'Schwyz': 'SZ', 'Schaffhausen': 'SH', 'Zug': 'ZG'}
SUMME1 = sum(haeuser(KUERZEL[o]) for o in G.ORTE)
rund = lambda n, auf=1000: tsd(round(n / auf) * auf)

K = G.K
THEMA = {'Zone': 'Zonenplan, Bauzone', 'Ausnützung': 'Ausnützungsziffer', 'Erbe': 'Erbe, Erbengemeinschaft', 'Parzelle': 'Parzelle, Kataster',
         'Bauen': 'Baubewilligung, Baugesuch', 'Ausbau': 'Aufstocken, Anbau', 'Steuer': 'Grundstückgewinnsteuer'}
START = {'Ausbau': 'Woche 3', 'Steuer': 'Woche 3, mit dem Ratgeber'}
fr = lambda x: f"{x:.0f}" if x else '–'

# Budget: CHF 1'000 im Monat (google_ads.py). Woche 1 und 2 laufen fünf
# Kampagnen, ab Woche 3 alle sieben, mit denselben Tagesbudgets.
TAG_1 = sum(v for x, v in G.BUDGET.items() if x not in G.SPAETER)
TAG_3 = sum(G.BUDGET.values())
SECHS = TAG_1 * 14 + TAG_3 * 28
MONAT = TAG_3 * 30.4
assert (TAG_1, TAG_3) == (26, 32) and MONAT <= G.MONATSBUDGET, (TAG_1, TAG_3, MONAT)


def seite(inhalt):
    return f'<section class="seite">{inhalt}</section>'


titel = seite(f"""
<p class="ueber">Werbeplan · November 2026</p>
<h1>Google Ads für die<br>Check-Seiten</h1>
<p class="lead">Sieben Suchkampagnen, fertig zum Import. Wer von uns was macht, was es kostet und wann wir umstellen.</p>
<div class="kern">
  <div><b>CHF {tsd(G.MONATSBUDGET)}</b><span>im Monat, höchstens; Google hält das Monatsbudget ein</span></div>
  <div><b>7 Kampagnen</b><span>eine je Thema und Seite, alle bei der Google-Suche</span></div>
  <div><b>7 Kantone</b><span>zum Start, ab Woche 3 die übrige Deutschschweiz ohne Freiburg und Wallis</span></div>
</div>
<h3 style="margin-top:9mm">Kurz gesagt</h3>
<ul class="kurz">
  <li>Wir werben nur bei Google, und nur bei der Suche. Wer «Zonenplan Zürich», «Ausnützungsziffer berechnen» oder «Erbengemeinschaft auflösen» eingibt, hat ein Grundstück vor Augen. Diese Leute wollen wir.</li>
  <li>Diese Begriffe bewirbt kaum jemand: ein Klick kostet meist unter CHF 3. Teure Begriffe wie «Immobilienbewertung» (CHF {P.gebot('immobilienbewertung')[0]:.0f} bis {P.gebot('immobilienbewertung')[1]:.0f} pro Klick) lassen wir weg.</li>
  <li>Kampagnen, Keywords, Anzeigen, Ausschlüsse, Standorte und Sitelinks liegen in einer Datei für den Google Ads Editor. Sie kommen pausiert an: es kostet nichts, bevor wir sie einschalten.</li>
  <li>Gemessen wird jeder Lead: mit Zustimmung im Cookie-Hinweis meldet die Seite Google die Anfrage, und in unserer Datenbank steht zu jedem Lead Kampagne und Suchbegriff.</li>
  <li>Budget: CHF {tsd(G.MONATSBUDGET)} im Monat, als Tagesbudget je Kampagne, zusammen CHF {TAG_3:.0f} am Tag. Google gibt im Monat höchstens CHF {tsd(round(MONAT))} aus.</li>
  <li>Die ersten sechs Wochen sind ein Test. Jeden Montag zählen die Kosten pro guten Lead: was sich rechnet, bekommt mehr, der Rest wird gestoppt.</li>
</ul>
""")

JULIAN = [
    ('Zahlungsmittel', 'Im Google-Ads-Konto unter «Abrechnung» eine Karte oder Rechnung hinterlegen.'),
    ('Conversion «Lead»', 'Unter «Ziele», «Conversions» eine neue Conversion-Aktion für die Website anlegen (Seite 4). Die Zeile <code>send_to</code> mit Conversion-ID und Label an Bauraum schicken.'),
    ('Import', 'Den Google Ads Editor installieren (kostenlos), das Konto laden und die Datei <code>google-ads-import.csv</code> importieren. Vorschau ansehen, hochladen.'),
    ('Einschalten', 'Die fünf Kampagnen der ersten Woche einschalten, wenn Bauraum meldet, dass die Messung läuft.'),
    ('Montag', 'Jeden Montag mit Bauraum die Zahlen ansehen und entscheiden: mehr Budget, ändern oder stoppen.'),
]
BAURAUM = [
    ('Messpunkt', 'Conversion-ID und Label auf allen 23 Seiten eintragen, ausliefern und mit einem Testaufruf prüfen, dass Google den Lead erhält.'),
    ('Herkunft', 'Zu jedem Lead Kampagne, Suchbegriff und Klick-Kennung speichern. Seit dem 18. November gehen sie nicht mehr verloren, wenn die Seite ihren Link umschreibt.'),
    ('Ratgeber', 'Den Ratgeber «Grundstückgewinnsteuer» schreiben, mit amtlichen Quellen. Er ist die Zielseite der Kampagne Steuer.'),
    ('Auswertung', 'Jeden Montag: Leads je Kampagne und Suchbegriff aus der Datenbank, neben die Kosten aus Google Ads gelegt.'),
    ('Anpassen', 'Neue Keywords, Ausschlüsse und Texte als neue Importdatei. So bleibt jede Änderung nachvollziehbar.'),
]
werwas = seite(f"""
<p class="ueber">Zusammenarbeit</p>
<h2>Wer macht was</h2>
<p class="grau" style="max-width:160mm">Was Geld kostet oder das Konto betrifft, macht Julian. Seiten, Messung, Dateien und Auswertung macht Bauraum.</p>
<div class="zwei">
  <div><h3>Julian</h3><ol class="schritte">{''.join(f'<li><div><b>{t}:</b> {s}</div></li>' for t, s in JULIAN)}</ol></div>
  <div><h3>Bauraum</h3><ol class="schritte">{''.join(f'<li><div><b>{t}:</b> {s}</div></li>' for t, s in BAURAUM)}</ol></div>
</div>
""")

zeilen = [[f'<b>{K[x]["domain"]}</b>', THEMA[x], START.get(x, 'Woche 1'), fr(G.BUDGET[x]), tsd(round(G.BUDGET[x] * 30.4)),
           f'{G.MAX_CPC.get(x, 2.5):.2f}', rund(P.summe(K[x]['woerter']), 100)] for x in G.REIHE]
zeilen.append(['<b>Total</b>', '', '', f'<b>{TAG_3:.0f}</b>', f'<b>{tsd(round(MONAT))}</b>', '', f'<b>{rund(P.GOOGLE_SUMME, 100)}</b>'])
phasen = [
    ['<b>1</b>', ', '.join(G.ORTE), 'ab Woche 1', f'Der Check zeigt hier die Ziffer aus dem Zonenplan, also wie viel gebaut werden darf. Rund {rund(SUMME1)} ältere Häuser.'],
    ['<b>2</b>', ', '.join(G.ORTE_2), 'ab Woche 3', f'Viele Häuser, allein Bern hat rund {rund(haeuser("BE"))}. Der Check zeigt dort Zone und Parzelle, die Ziffer noch nicht.'],
    ['', 'Freiburg, Wallis, Westschweiz, Tessin', 'vorerst nicht', 'Die Seiten gibt es nur auf Deutsch.'],
]
kampagnen = seite(f"""
<p class="ueber">Die Kampagnen</p>
<h2>Sieben Themen, sieben Seiten</h2>
<p class="grau" style="max-width:160mm">Google zeigt bei einer Suche höchstens eine Anzeige desselben Werbenden, auch mit mehreren Websites. Darum bewerben wir jedes Thema mit genau einer Seite. Die übrigen 16 Seiten bleiben ohne Werbung.</p>
{tabelle(['Seite', 'Thema', 'Start', 'CHF<br>pro Tag', 'CHF im Monat<br>höchstens', 'Höchstgebot<br>CHF pro Klick', 'Suchen<br>im Monat'], zeilen, rechts=(3, 4, 5, 6))}
<h3>Wo die Anzeigen erscheinen</h3>
{tabelle(['Phase', 'Kantone', 'Ab wann', 'Warum'], phasen)}
<p class="klein">Ältere Häuser: Einfamilienhäuser und Häuser mit 2 bis 9 Wohnungen, gebaut vor 1981. Quelle: Bundesamt für Statistik, Gebäude- und Wohnungsstatistik 2023. Suchen: Google Ads, Schweiz, Deutsch, Durchschnitt der letzten zwölf Monate.</p>
""")


def kampagne(x):
    k = K[x]
    w = sorted(k['woerter'], key=lambda z: -P.v(z))
    return f"""<div class="domain">
<h3>{THEMA[x]} · {k['domain']}</h3>
<p class="rolle">{len(w)} Keywords, je als Wortgruppe und genau passend · {len(G.TITEL[x])} Titel, {len(G.TEXTE[x])} Texte · Ziel {esc(G.url(x).replace('https://', ''))}</p>
<p><b>Keywords:</b> {esc(', '.join(w))}</p>
<p><b>Titel, eine Auswahl:</b> {esc(' | '.join(G.TITEL[x][:5]))}</p>
<p><b>Text:</b> {esc(G.TEXTE[x][0])}</p>
<p class="klein"><b>Ausgeschlossen:</b> {esc(', '.join(k['aus']))}, dazu die Liste für alle Kampagnen</p>
</div>"""


inhalt = seite(f"""
<p class="ueber">Inhalt der Importdatei</p>
<h2>Keywords und Anzeigen</h2>
<p class="grau" style="max-width:160mm">Alle Texte sagen nur, was die Seite hält: kostenlos, amtliche Daten, in Sekunden. Ausnützung und Reserve gibt es gegen Name und E-Mail, darum steht nirgends «ohne Anmeldung». Jede Kampagne hat vier Sitelinks auf Ratgeber und Checks derselben Seite und die Hinweise {esc(', '.join('«' + h + '»' for h in G.HINWEISE))}.</p>
{''.join(kampagne(x) for x in G.REIHE)}
<p class="klein" style="margin-top:5mm"><b>Für alle Kampagnen ausgeschlossen:</b> {esc(', '.join(G.KONTO_AUS))}.</p>
""")

EINRICHTEN = [
    ('Conversion anlegen', 'In Google Ads: «Ziele», «Conversions», «Neue Conversion-Aktion», «Website». Domain zonen-check.ch eingeben, Aktion von Hand anlegen: Kategorie «Lead-Formular senden», Name «Lead», Wert «Keinen Wert verwenden», Zählung «Eine». Beim Tag «Selbst einrichten» wählen; dort steht die Zeile <code>send_to: \'AW-…/…\'</code>. Diese Zeile an Bauraum.'),
    ('Editor installieren', 'Google Ads Editor von ads.google.com/home/tools/ads-editor herunterladen, mit dem Google-Konto anmelden, das Werbekonto herunterladen.'),
    ('Datei importieren', 'Im Editor: «Konto», «Importieren», «Aus Datei», dann <code>google-ads-import.csv</code> wählen. Der Editor zeigt jede Kampagne, Anzeige und jedes Keyword, bevor etwas übernommen wird. Fragt er nach politischer Werbung in der EU: «Nein».'),
    ('Zwei Einstellungen von Hand', 'Alle sieben Kampagnen markieren: Standortoption «Präsenz» (nur Personen, die sich in den Kantonen aufhalten). Im Konto unter «Empfehlungen» die automatisch angewendeten Empfehlungen ausschalten, damit Google Keywords und Budgets nicht selbst ändert.'),
    ('Hochladen', 'Im Editor «Posten». Die Kampagnen sind jetzt im Konto, aber pausiert.'),
    ('Einschalten', 'Wenn Bauraum meldet, dass die Messung läuft: Zone, Ausnützung, Erbe, Parzelle und Bauen einschalten. In Woche 3 Ausbau und Steuer dazu und bei allen Kampagnen die Kantone der Phase 2. Die Budgets bleiben, wie sie sind.'),
    ('Nach 30 Leads', 'Gebotsstrategie von «Klicks maximieren» auf «Conversions maximieren» umstellen, Kampagne für Kampagne.'),
]
einrichten = seite(f"""
<p class="ueber">Schritt für Schritt</p>
<h2>So kommt alles ins Konto</h2>
<ol class="schritte">{''.join(f'<li><div><b>{t}:</b> {s}</div></li>' for t, s in EINRICHTEN)}</ol>
<h3>Was schon in der Datei steht</h3>
<p>Nur Google-Suche, ohne Suchnetzwerk-Partner und Display. Sprache Deutsch. Gebotsstrategie «Klicks maximieren» mit Höchstgebot je Kampagne. Keywords nur «Passende Wortgruppe» und «Genau passend», nie «Weitgehend passend». Hinter jedem Link stehen Kampagne und Suchbegriff (<code>utm_campaign</code>, <code>utm_term</code>), damit wir jeden Lead seiner Suche zuordnen.</p>
""")

budget = seite(f"""
<p class="ueber">Budget und Auswertung</p>
<h2>Wie viel, und wann wir umstellen</h2>
{tabelle(['', 'CHF pro Tag', 'CHF pro Woche', 'Kampagnen', 'Kantone'],
         [['Woche 1 und 2', fr(TAG_1), fr(TAG_1 * 7), '5', '7'], ['ab Woche 3', fr(TAG_3), fr(TAG_3 * 7), '7', '19'],
          ['<b>Sechs Wochen</b>', '', f"<b>{tsd(SECHS)}</b>", '', ''], ['<b>Ein Monat, höchstens</b>', '', f"<b>{tsd(round(MONAT))}</b>", '', '']], rechts=(1, 2, 3, 4))}
<p>Das Budget ist CHF {tsd(G.MONATSBUDGET)} im Monat. Google teilt das Tagesbudget über den Monat aus: an einem einzelnen Tag kann es bis doppelt so viel sein, im Monat nie mehr als das Tagesbudget mal 30.4.</p>
<h3>Jeden Montag</h3>
<p>Wir legen die Leads je Kampagne und Suchbegriff neben die Kosten. Ein guter Lead ist ein Eigentümer, der innerhalb von zwölf Monaten verkaufen oder bauen will.</p>
{tabelle(['Kosten pro guten Lead', 'Was wir tun'], [['unter CHF 150', 'Budget verdoppeln'], ['CHF 150 bis 400', 'Text oder Keywords verbessern, Budget halten'], ['über CHF 400', 'Kampagne stoppen'], ['150 Klicks ohne Lead', 'Kampagne stoppen oder Zielseite ändern'], ['Suchbegriff ohne Bezug', 'als Ausschluss eintragen']])}
<h3>Mehr Budget</h3>
<p>Bleibt Geld übrig, weil eine Kampagne ihr Budget nicht ausschöpft, verschieben wir es am Montag zur Kampagne mit den günstigsten guten Leads; das Monatsbudget bleibt bei CHF {tsd(G.MONATSBUDGET)}. Läuft der Test gut, testen wir als Nächstes «bzo» und «bzo zürich» ({tsd(P.summe(['bzo', 'bzo zürich']))} Suchen, Gebote bis CHF {P.gebot('bzo zürich')[1]:.0f}) und die Suchen nach «geoportal» und «gis zh» mit CHF 3 am Tag.</p>
<p class="klein">Zum Vergleich: Gekaufte Verkäufer-Leads kosten in der Schweiz CHF 30 bis 150, wenn mehrere Makler sie bekommen, exklusiv CHF 150 bis 400.</p>
""")

CHECKLISTE = [
    'Zahlungsmittel im Google-Ads-Konto (Julian)',
    'Conversion «Lead» angelegt, Zeile send_to an Bauraum (Julian)',
    'Messpunkt auf allen Seiten eingetragen und geprüft (Bauraum)',
    'Importdatei im Editor geprüft und hochgeladen (Julian)',
    'Standortoption «Präsenz», automatische Empfehlungen aus (Julian)',
    'Ratgeber «Grundstückgewinnsteuer» online (Bauraum)',
    'Impressum mit E-Mail-Adresse und UID-Nummer (Julian liefert die Angaben)',
    'Fünf Kampagnen eingeschaltet, erster Montagstermin',
]
start = seite(f"""
<p class="ueber">Vor dem Start</p>
<h2>Checkliste</h2>
<ul class="liste">{''.join(f'<li>{esc(c)}</li>' for c in CHECKLISTE)}</ul>
<p class="klein" style="margin-top:12mm">Grundlagen: Google Ads, Suchvolumen Schweiz, Durchschnitt der letzten zwölf Monate. Standorte nach Googles Liste der Zielgebiete vom Oktober 2026. Bundesamt für Statistik, Gebäude- und Wohnungsstatistik 2023.</p>
""")

CSS_EXTRA = """
ul.kurz { padding-left: 4.4mm; } ul.kurz li { margin-bottom: 2.4mm; font-size: 10pt; line-height: 1.5; }
ul.liste { list-style: none; padding: 0; } ul.liste li { padding: 3mm 0 3mm 9mm; border-top: 0.4pt solid #e2e5e8; position: relative; font-size: 10pt; }
ul.liste li::before { content: ''; position: absolute; left: 0; top: 3.3mm; width: 4mm; height: 4mm; border: 0.8pt solid #15181c; border-radius: 1mm; }
.domain p { margin-bottom: 1.4mm; }
.zwei { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8mm; }
code { font-family: 'Inter', sans-serif; font-size: 8.5pt; background: #f1f3f5; padding: 0 1mm; border-radius: 0.6mm; }
"""
HTML = f"""<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><title>Werbeplan Google Ads</title><style>{CSS}{CSS_EXTRA}</style></head>
<body>{titel}{werwas}{kampagnen}{einrichten}{inhalt}{budget}{start}</body></html>"""
(DIR / 'werbeplan.html').write_text(HTML, encoding='utf-8')
print('Budget', TAG_1, TAG_3, SECHS, 'Monat', round(MONAT), 'Häuser Phase 1', SUMME1)

# Werbeplan für die Check-Seiten in einfacher Sprache, als HTML für den Druck (A4).
#   python3 docs/kampagnenplan/werbeplan.py      schreibt werbeplan.html
#   node docs/kampagnenplan/pdf-werbeplan.cjs    druckt Werbeplan-Check-Seiten.pdf
#
# Für die Person, die die Kampagnen einrichtet: kurz, ohne Fachbegriffe der
# Entwicklung, ohne Namen. Kampagnen, Wörter, Texte und Budgets kommen aus
# plan.py (Suchzahlen in volumen.tsv), die Häuser je Kanton aus kantone.tsv
# (BFS), damit alle Unterlagen dieselben Zahlen nennen.
import contextlib, csv, io, sys
from bausteine import CSS, DIR, esc, tabelle, tsd

sys.path.insert(0, str(DIR))
with contextlib.redirect_stdout(io.StringIO()):
    import plan as P  # schreibt nebenbei kampagnenplan.html neu, mit denselben Daten

with (DIR / 'kantone.tsv').open(encoding='utf-8') as f:
    KT = {z['kanton']: {k: int(v) for k, v in z.items() if k != 'kanton'}
          for z in csv.DictReader((l for l in f if not l.startswith('#')), delimiter='\t')}
haeuser = lambda k: KT[k]['efh_vor1981'] + KT[k]['mfh_2_9_vor1981']
NAME = {'ZH': 'Zürich', 'AG': 'Aargau', 'SO': 'Solothurn', 'LU': 'Luzern', 'SZ': 'Schwyz', 'SH': 'Schaffhausen', 'ZG': 'Zug', 'BE': 'Bern'}
# Phase 1: Kantone, in denen der Check die Ausnützungsziffer zeigt (Zonenplan
# Zürich und die Nutzungsplanung von AG, SO, LU, SZ, SH, ZG).
PHASE1 = sorted(['ZH', 'AG', 'SO', 'LU', 'SZ', 'SH', 'ZG'], key=lambda k: -haeuser(k))
SUMME1 = sum(haeuser(k) for k in PHASE1)
ANTEIL = {k: haeuser(k) / SUMME1 for k in PHASE1}
KLEIN = ['SZ', 'SH', 'ZG']
assert haeuser('BE') > haeuser('ZH')
rund = lambda n, auf=1000: tsd(round(n / auf) * auf)

K = {k['kurz']: k for k in P.KAMPAGNEN}
TAG = {z[0]: (z[2], z[3]) for z in P.GOOGLE_TEILUNG}
MAX_CPC = {'Erbe': 3.0, 'Steuer': 3.0, 'Ausbau': 4.0}
THEMA = {'Zone': 'Zonenplan, Bauzone', 'Ausnützung': 'Ausnützungsziffer', 'Erbe': 'Erbe, Erbengemeinschaft', 'Parzelle': 'Parzelle, Kataster',
         'Bauen': 'Baubewilligung, Baugesuch', 'Ausbau': 'Aufstocken, Anbau', 'Steuer': 'Grundstückgewinnsteuer'}
START = {'Ausbau': 'ab Woche 3', 'Steuer': 'wenn der Ratgeber online ist'}
REIHE = ['Zone', 'Ausnützung', 'Erbe', 'Parzelle', 'Bauen', 'Ausbau', 'Steuer']
geld = lambda x: x.replace('CHF ', '') if x else '–'

# Facebook und Instagram: Franken pro Tag in Woche 1 und 2 und ab Woche 3.
# Summen wie im Kampagnenplan: Ratgeber CHF 250 und 450 pro Woche, Check
# CHF 75 und 150, Erinnerung CHF 50.
FACEBOOK = [
    ('Ratgeber «Haus zu gross»', 'Die Kinder sind ausgezogen, das Haus ist geblieben. Fünf Wege, die Eigentümer haben.', 'Alter 60 und älter', 'hauschecker.ch/ratgeber/haus-zu-gross', 18, 30),
    ('Ratgeber «Geerbt»', 'Das Elternhaus gehört jetzt allen Geschwistern gemeinsam. Was das Gesetz sagt und welche Wege es gibt.', 'Alter 45 bis 65', 'hauschecker.ch/ratgeber/liegenschaft-geerbt', 12, 22),
    ('Ratgeber «Aufstocken»', 'Ein Stockwerk mehr statt umziehen. Wann Aufstocken erlaubt ist und was Sie vorher klären sollten.', 'Alter 35 bis 60', 'ausbaupotenzial.ch und baupotenzialcheck.ch, je /ratgeber/aufstocken, im Wechsel', 6, 12),
    ('Check Grundstück', 'Wie viel dürfte auf Ihrem Grundstück in [Ort] stehen? Dazu ein Luftbild der Gemeinde.', 'Sonderkategorie Wohnraum', 'parzellencheck24.ch, parzellen-check.ch, parzellepruefen.ch, checkmyparcel.ch, im Wechsel', 6, 10),
    ('Check Bauen', 'Wie viel dürfen Sie auf Ihrem Grundstück bauen? Amtliche Daten, in einer Minute.', 'Sonderkategorie Wohnraum', 'baurechner24.ch und parzellenrechner.ch, im Wechsel', 3, 6),
    ('Check Hauswert', 'Was ist Ihr Haus wert? Zuerst die Fakten aus den amtlichen Registern.', 'Sonderkategorie Wohnraum', 'hauswertrechner.ch, hauswert24.ch, hauswertcheck.ch, im Wechsel', 2, 5),
    ('Erinnerung', 'Ihre Auswertung ist noch offen. Die Berechnung dauert eine Minute.', 'Wer eine Adresse geprüft und nichts hinterlassen hat', 'dieselbe Seite', 0, 7),
]
assert sum(z[4] for z in FACEBOOK[:3]) * 7 in range(245, 256) and sum(z[5] for z in FACEBOOK[:3]) * 7 in range(445, 456)
assert sum(z[4] for z in FACEBOOK[3:6]) * 7 in range(70, 80) and sum(z[5] for z in FACEBOOK[3:6]) * 7 in range(145, 155)
assert FACEBOOK[6][5] * 7 in range(45, 55)

# Alle 23 Seiten müssen genau einmal vorkommen.
NUR_FACEBOOK = [z[3] for z in FACEBOOK[2:6]]
OHNE = [
    ('bauzonencheck.ch', 'Reserve für zonen-check.ch, falls diese schwach läuft. Nie beide gleichzeitig bei Google schalten.'),
    ('verdichtungscheck.ch', f'Das Thema wird kaum gesucht (rund {tsd(P.v("verdichtung"))} Mal im Monat).'),
    ('parzellenwert.ch, landwert24.ch', 'Später eine kleine Google-Kampagne zu Baulandpreisen, nur in Zürich und Basel-Landschaft, wo der Check die Preise der Gemeinde zeigt.'),
    ('eigentuemercheck.ch', 'Kurze Adresse für Zeitungsinserate, zum Beispiel beim Hauseigentümerverband.'),
]
import re
domains = set(K[x]['domain'] for x in REIHE)
for t in NUR_FACEBOOK + [d for d, _ in OHNE]:
    domains |= set(re.findall(r'[a-z0-9-]+\.ch', t))
assert len(domains) == 23 and domains == P.GEKAUFT, sorted(domains ^ P.GEKAUFT)

AUSSCHLIESSEN = ['mieten', 'miete', 'mietwohnung', 'wohnung kaufen', 'haus kaufen', 'bauland kaufen', 'ferienwohnung', 'stelle', 'job', 'lehre',
                 'ausbildung', 'gratis inserat', 'homegate', 'immoscout', 'newhome', 'comparis', 'deutschland', 'österreich']


def seite(inhalt):
    return f'<section class="seite">{inhalt}</section>'


# ============================================================ Seiten
titel = seite(f"""
<p class="ueber">Werbeplan · November 2026</p>
<h1>Werbung für die<br>Check-Seiten</h1>
<p class="lead">Wo wir Anzeigen schalten, mit welchem Budget, und wie die Kampagnen Schritt für Schritt eingerichtet werden.</p>
<div class="kern">
  <div><b>CHF 5'000</b><span>Budget für die ersten sechs Wochen</span></div>
  <div><b>7 Kantone</b><span>zum Start, alle in der Deutschschweiz</span></div>
  <div><b>23 Seiten</b><span>7 mit Google-Anzeigen, 11 auf Facebook und Instagram, 5 vorerst ohne Werbung</span></div>
</div>
<h3 style="margin-top:9mm">Kurz gesagt</h3>
<ul class="kurz">
  <li>Wir starten in sieben Kantonen der Deutschschweiz: {', '.join(NAME[k] for k in PHASE1[:-1])} und {NAME[PHASE1[-1]]}. Hier zeigt der Check nicht nur Parzelle und Zone, sondern auch die Ziffer aus dem Zonenplan, also wie viel auf dem Grundstück gebaut werden darf. Das weckt bei Eigentümern am meisten Interesse.</li>
  <li>Google nutzen wir für Eigentümer, die selbst suchen: nach dem Zonenplan, der Ausnützungsziffer, ihrer Parzelle, einer Baubewilligung oder nach einem Erbe. Diese Begriffe bewirbt kaum jemand, ein Klick kostet meist unter CHF 3.</li>
  <li>Facebook und Instagram nutzen wir für Eigentümer, die nicht suchen, etwa ältere Paare, denen das Haus zu gross geworden ist. Sie erreichen wir mit Ratgeber-Artikeln.</li>
  <li>Teure Begriffe wie «Immobilienbewertung», für die Makler und Portale CHF {P.gebot('immobilienbewertung')[0]:.0f} bis {P.gebot('immobilienbewertung')[1]:.0f} pro Klick zahlen, bewerben wir nicht. Display, YouTube und TikTok lassen wir ebenfalls weg.</li>
  <li>Bisher lief keine Werbung. Die ersten sechs Wochen sind ein Test, danach zählen die Kosten pro Lead: Was sich rechnet, bekommt mehr Budget, der Rest wird gestoppt.</li>
</ul>
""")

google_zeilen = [[f'<b>{K[x]["domain"]}</b>', THEMA[x], START.get(x, 'sofort'), geld(TAG[x][0]), geld(TAG[x][1])] for x in REIHE]
fb_zeilen = [[esc(z[3]).replace(', im Wechsel', '').replace(' und ', ', ').replace(', je /ratgeber/aufstocken', ''), z[0], str(z[4] or '–'), str(z[5])] for z in FACEBOOK[2:6]]
seiten = seite(f"""
<p class="ueber">Die 23 Seiten</p>
<h2>Welche Seite wofür</h2>
<p class="grau" style="max-width:160mm">Google zeigt bei einer Suche höchstens eine Anzeige desselben Anbieters, auch wenn er mehrere Websites hat. Deshalb bewerben wir jedes Thema bei Google mit genau einer Seite. Die übrigen Seiten setzen wir auf Facebook und Instagram ein: Dort testen wir, welcher Name und welche Gestaltung mehr Anfragen bringen.</p>
<h3>Mit Google-Anzeigen</h3>
{tabelle(['Seite', 'Thema', 'Start', 'CHF pro Tag<br>Woche 1 und 2', 'CHF pro Tag<br>ab Woche 3'], google_zeilen, rechts=(3, 4))}
<h3>Nur auf Facebook und Instagram</h3>
{tabelle(['Seiten', 'Anzeige', 'CHF pro Tag<br>Woche 1 und 2', 'CHF pro Tag<br>ab Woche 3'], fb_zeilen, rechts=(2, 3))}
<h3>Vorerst ohne Werbung</h3>
{tabelle(['Seite', 'Wozu'], [[f'<b>{d}</b>', w] for d, w in OHNE])}
""")

phasen = [
    ['<b>1</b>', ', '.join(NAME[k] for k in PHASE1), 'Woche 1', f'Der Check zeigt hier, wie viel gebaut werden darf. Rund {rund(SUMME1)} ältere Häuser.'],
    ['<b>2</b>', 'Bern, St. Gallen, Basel-Landschaft, Thurgau, Graubünden und die übrige Deutschschweiz', 'Woche 3', f'Viele Häuser, allein Bern hat rund {rund(haeuser("BE"))}. Der Check zeigt dort aber noch nicht, wie viel gebaut werden darf.'],
    ['<b>3</b>', 'Deutschsprachige Teile von Freiburg und Wallis', 'nach dem Test', 'Kleinere Gebiete, gezielt nach Ort.'],
    ['', 'Westschweiz und Tessin', 'vorerst nicht', 'Die Seiten gibt es nur auf Deutsch.'],
]
kantone = [[NAME[k], rund(haeuser(k), 100), f'{round(100 * ANTEIL[k])} %'] for k in PHASE1 if k not in KLEIN]
kantone.append([', '.join(NAME[k] for k in KLEIN), rund(sum(haeuser(k) for k in KLEIN), 100), f'{round(100 * sum(ANTEIL[k] for k in KLEIN))} %'])
wo = seite(f"""
<p class="ueber">Regionen</p>
<h2>Wo wir werben</h2>
<p class="grau" style="max-width:160mm">Unsere Zielgruppe sind Eigentümer von Einfamilienhäusern und kleinen Mehrfamilienhäusern, die vor 1981 gebaut wurden. Bei diesen Häusern stehen Sanierung, Ausbau oder Verkauf am ehesten an. Wir werben in drei Phasen.</p>
{tabelle(['Phase', 'Kantone', 'Ab wann', 'Warum'], phasen)}
<h3>Phase 1: Budget pro Kanton</h3>
<p>Auf Facebook und Instagram erhält jeder Kanton eine eigene Anzeigengruppe, das Budget verteilen wir nach der Zahl der Häuser. Schwyz, Schaffhausen und Zug fassen wir zusammen, damit jede Gruppe genug Budget hat. Bei Google decken die Kampagnen alle sieben Kantone gemeinsam ab.</p>
<div style="max-width:120mm">{tabelle(['Kanton', 'Ältere Häuser', 'Anteil am Budget'], kantone, rechts=(1, 2))}</div>
<p class="klein">Häuser: Einfamilienhäuser und Häuser mit 2 bis 9 Wohnungen, gebaut vor 1981. Quelle: Bundesamt für Statistik, Gebäude- und Wohnungsstatistik 2023.</p>
""")


def kampagne(x):
    k = K[x]
    w = sorted(k['woerter'], key=lambda z: -P.v(z))
    w1, w3 = TAG[x]
    budget = f'CHF {geld(w1)} pro Tag, ab Woche 3 CHF {geld(w3)}' if w1 else f'CHF {geld(w3)} pro Tag, {START[x]}'
    link = f"https://www.{k['domain']}{k['pfad']}?utm_source=google&amp;utm_medium=cpc&amp;utm_campaign={k['utm']}"
    return f"""<div class="domain">
<h3>{THEMA[x]} · {k['domain']}</h3>
<p class="rolle">{budget} · Höchstgebot CHF {MAX_CPC.get(x, 2.5):.2f} pro Klick · rund {rund(P.summe(w), 100)} Suchen im Monat</p>
<p><b>Keywords:</b> {esc(', '.join(w))}</p>
<p><b>Titel:</b> {esc(' | '.join(k['titel']))}</p>
<p><b>Beschreibungen:</b> {esc(k['text'][0])} {esc(k['text'][1])}</p>
<p class="klein"><b>Link:</b> {link}<br><b>Ausschliessen:</b> {esc(', '.join(k['aus']))}</p>
</div>"""


google = seite(f"""
<p class="ueber">Google Ads</p>
<h2>So richten wir Google ein</h2>
<p class="grau" style="max-width:160mm">Alles läuft über das bestehende Google-Konto: Google Ads für die Anzeigen, die Search Console für die Seiten.</p>
<ol class="schritte">
  <li><div><b>Conversion:</b> In Google Ads unter «Ziele» eine Conversion «Lead» erstellen (Website, Kategorie «Lead-Formular senden»). Conversion-ID und Conversion-Label an Bauraum senden; wir hinterlegen sie auf allen Seiten.</div></li>
  <li><div><b>Search Console:</b> Alle 23 Domains hinzufügen und jeweils die Sitemap einreichen, zum Beispiel www.zonen-check.ch/sitemap.xml.</div></li>
  <li><div><b>Kampagnen:</b> Pro Seite eine Suchkampagne. Nur Google-Suche, ohne Suchnetzwerk-Partner und ohne Displaynetzwerk. Sprache Deutsch. Standorte: die sieben Kantone der Phase 1, Option «Präsenz».</div></li>
  <li><div><b>Gebote:</b> Strategie «Klicks maximieren» mit dem Höchstgebot der Kampagne. Nach 30 Leads auf «Conversions maximieren» umstellen.</div></li>
  <li><div><b>Keywords:</b> «Passende Wortgruppe» und «Genau passend», nie «Weitgehend passend». Im ganzen Konto ausschliessen: {esc(', '.join(AUSSCHLIESSEN))}.</div></li>
  <li><div><b>Anzeigen:</b> Pro Kampagne eine responsive Suchanzeige mit den Titeln und Beschreibungen auf den folgenden Seiten, dazu die Zusatzinformationen «Kostenlos», «Amtliche Daten» und «In einer Minute».</div></li>
  <li><div><b>Empfehlungen:</b> Automatisch angewendete Empfehlungen ausschalten, damit Google Keywords und Budgets nicht selbst ändert.</div></li>
</ol>
""")
google_kampagnen = seite(f"""
<p class="ueber">Google Ads</p>
<h2>Die sieben Kampagnen</h2>
{''.join(kampagne(x) for x in REIHE)}
""")

# In der Tabelle kurz; die Domains stehen vollständig auf der Seite «Welche Seite wofür».
SEITE_KURZ = {'Ratgeber «Aufstocken»': 'ausbaupotenzial.ch, baupotenzialcheck.ch, im Wechsel', 'Check Grundstück': 'die vier Grundstück-Seiten, im Wechsel',
              'Check Bauen': 'baurechner24.ch, parzellenrechner.ch, im Wechsel', 'Check Hauswert': 'die drei Hauswert-Seiten, im Wechsel'}
fb_tabelle = [[f'<b>{z[0]}</b>', esc(z[1]), esc(z[2]), esc(SEITE_KURZ.get(z[0], z[3])), str(z[4] or '–'), str(z[5])] for z in FACEBOOK]
# Schliesst direkt an die letzte Google-Kampagne an; sonst stünde sie allein auf einer Seite.
facebook = f"""<section class="weiter">
<p class="ueber">Facebook und Instagram</p>
<h2>So richten wir Meta ein</h2>
<ol class="schritte">
  <li><div><b>Meta Business:</b> Alle 23 Domains bestätigen und ein Pixel erstellen. Die Pixel-ID an Bauraum senden; wir hinterlegen sie auf allen Seiten.</div></li>
  <li><div><b>Ziel:</b> Kampagnenziel «Leads» mit Conversion auf der Website, Ereignis «Lead». Kein Sofortformular von Meta: Der Eigentümer soll seine Adresse auf unserer Seite prüfen.</div></li>
  <li><div><b>Zielgruppen:</b> Ratgeber-Anzeigen ohne Sonderkategorie, mit Alter und Kanton. Check-Anzeigen in der Sonderkategorie «Wohnraum»: Dort sind Alter und Postleitzahl gesperrt, möglich sind Land, Kanton oder Stadt mit mindestens 17 km Umkreis.</div></li>
  <li><div><b>Einstufung:</b> Stuft Meta eine Ratgeber-Anzeige als Wohnraum ein, läuft sie in der Sonderkategorie weiter. Nicht umformulieren, um die Einstufung zu umgehen.</div></li>
  <li><div><b>Bilder:</b> Für Ratgeber ein Einfamilienhaus mit Garten aus der Region, ohne Text im Bild. Für Check-Anzeigen ein Luftbild der Gemeinde mit eingezeichneter Parzelle; diese Bilder liefert Bauraum.</div></li>
</ol>
<h3>Die Anzeigen, Budget in Franken pro Tag</h3>
<div class="fb">{tabelle(['Anzeige', 'Text', 'Zielgruppe', 'Seite', 'Woche<br>1 und 2', 'ab<br>Woche 3'], fb_tabelle, rechts=(4, 5))}</div>
</section>"""

budget_zeilen = [['Woche 1 und 2', "CHF 325", "CHF 175", '–', "<b>CHF 500</b>"],
                 ['Woche 3 bis 6', "CHF 650", "CHF 300", "CHF 50", "<b>CHF 1'000</b>"],
                 ['<b>Sechs Wochen</b>', "CHF 3'250", "CHF 1'550", "CHF 200", "<b>CHF 5'000</b>"]]
# Gleiche Summen wie der Kampagnenplan (Ratgeber, Check und Erinnerung zusammen als Facebook).
assert [sum(int(x.replace('CHF ', '').replace("'", '')) for x in [r[1]]) for r in budget_zeilen] == [325, 650, 3250]
assert 2300 + 750 + 200 == 3250
budget = f"""<section class="weiter">
<p class="ueber">Budget und Auswertung</p>
<h2>Wie viel, und wann wir umstellen</h2>
{tabelle(['Pro Woche', 'Facebook und Instagram', 'Google', 'Bing', 'Total'], budget_zeilen, rechts=(1, 2, 3, 4))}
<p>Ab Woche 3 laufen die zwei besten Google-Kampagnen zusätzlich auf Bing (Microsoft Advertising). Sie lassen sich direkt aus Google Ads importieren.</p>
<h3>Jeden Montag</h3>
<p>Wir prüfen die Kosten pro guten Lead, je Kampagne und Kanton. Ein guter Lead ist ein Eigentümer, der innerhalb von zwölf Monaten verkaufen oder bauen will.</p>
{tabelle(['Kosten pro guten Lead', 'Was wir tun'], [['unter CHF 150', 'Budget verdoppeln'], ['CHF 150 bis 400', 'Text oder Bild verbessern, Budget halten'], ['über CHF 400', 'Kampagne stoppen'], ['150 Klicks ohne Lead', 'Kampagne stoppen oder auf die Ersatzseite wechseln']])}
<h3>Wohin zusätzliches Budget fliesst</h3>
<p>Bei Google ist die Nachfrage begrenzt: Auf allen unseren Themen gibt es zusammen rund {rund(P.GOOGLE_SUMME)} Suchen im Monat. Mehr als etwa CHF 1'300 pro Monat lassen sich dort kaum sinnvoll einsetzen. Läuft der Test gut, fliesst zusätzliches Budget in Facebook und Instagram und in die Kantone der Phase 2.</p>
<p class="klein">Zum Vergleich: Gekaufte Verkäufer-Leads kosten in der Schweiz CHF 30 bis 150, wenn mehrere Makler sie bekommen, exklusiv CHF 150 bis 400.</p>
</section>"""

CHECKLISTE = [
    'Google Ads: Conversion «Lead» erstellt, ID und Label an Bauraum gesendet',
    'Search Console: alle 23 Domains hinzugefügt, Sitemaps eingereicht',
    'Meta: alle Domains bestätigt, Pixel-ID an Bauraum gesendet',
    'Impressum: E-Mail-Adresse und UID-Nummer ergänzt',
    'Datenschutzerklärung: Google, Meta und Hosting ergänzt',
    'Telefonnummer für Rückrufe auf allen Seiten',
    'Bilder für Facebook und Instagram bereit',
    'Ratgeber «Grundstückgewinnsteuer» online (Voraussetzung für die Kampagne auf hauschecker.ch)',
]
start = seite(f"""
<p class="ueber">Vor dem Start</p>
<h2>Checkliste</h2>
<ul class="liste">{''.join(f'<li>{esc(c)}</li>' for c in CHECKLISTE)}</ul>
<p class="klein" style="margin-top:12mm">Grundlagen: Google Ads, Suchvolumen Schweiz, Durchschnitt der letzten zwölf Monate. Bundesamt für Statistik, Gebäude- und Wohnungsstatistik 2023.</p>
""")

CSS_EXTRA = """
ul.kurz { padding-left: 4.4mm; } ul.kurz li { margin-bottom: 2.4mm; font-size: 10pt; line-height: 1.5; }
ul.liste { list-style: none; padding: 0; } ul.liste li { padding: 3mm 0 3mm 9mm; border-top: 0.4pt solid #e2e5e8; position: relative; font-size: 10pt; }
ul.liste li::before { content: ''; position: absolute; left: 0; top: 3.3mm; width: 4mm; height: 4mm; border: 0.8pt solid #15181c; border-radius: 1mm; }
.domain p { margin-bottom: 1.4mm; }
.weiter { margin-top: 7mm; padding-top: 4mm; }
.fb table { table-layout: fixed; } .fb th:nth-child(1) { width: 25mm; } .fb th:nth-child(2) { width: 52mm; } .fb th:nth-child(3) { width: 26mm; }
.fb th:nth-child(4) { width: 39mm; } .fb th:nth-child(5) { width: 17mm; } .fb th:nth-child(6) { width: 17mm; }
"""
HTML = f"""<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><title>Werbeplan Check-Seiten</title><style>{CSS}{CSS_EXTRA}</style></head>
<body>{titel}{seiten}{wo}{google}{google_kampagnen}{facebook}{budget}{start}</body></html>"""
(DIR / 'werbeplan.html').write_text(HTML, encoding='utf-8')
print('Phase 1', PHASE1, SUMME1, {k: round(100 * v) for k, v in ANTEIL.items()}, 'Bern', haeuser('BE'))

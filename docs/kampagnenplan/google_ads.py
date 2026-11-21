# Importdatei für den Google Ads Editor: alle Kampagnen der Check-Seiten.
#   python3 docs/kampagnenplan/google_ads.py   schreibt google-ads-import.csv
#
# Geworben wird nur bei Google (Julian, 18. November). Keywords, Budgets und
# Höchstgebote kommen aus plan.py, damit Plan und Konto dieselben Zahlen
# nennen. Alle Kampagnen kommen pausiert an: es kostet nichts, bis sie im
# Editor geprüft, hochgeladen und eingeschaltet sind.
#
# Format nachgesehen am 18. November in der Hilfe des Editors ("Prepare a
# CSV file", "CSV file columns"): eine Zeile je Element, englische
# Spaltennamen, mehrere Werte mit Semikolon, Unicode empfohlen. Geschrieben
# wird UTF-16 mit Tabulator, wie der Editor selbst exportiert.
# Standort-IDs aus Googles Liste geotargets-2026-10-06 (Kantone der Schweiz).
import contextlib, csv, io, re, sys
from bausteine import DIR

sys.path.insert(0, str(DIR))
with contextlib.redirect_stdout(io.StringIO()):
    import plan as P

K = {k['kurz']: k for k in P.KAMPAGNEN}

# Budget: CHF 600 im Monat (Julian, 21. November: «Budget ist 500-700 Franken
# pro Monat», gerechnet mit der Mitte; vorher CHF 1'000). Google gibt im Monat
# höchstens das Tagesbudget mal 30.4 aus, an einzelnen Tagen bis doppelt so
# viel. Verteilt wie im Kampagnenplan nach Suchen und Absicht; Ausbau und
# Steuer starten in Woche 3, bis dahin bleibt ihr Anteil ungenutzt.
MONATSBUDGET = 600
BUDGET = {'Zone': 4.5, 'Ausnützung': 3, 'Erbe': 4, 'Parzelle': 2.5, 'Bauen': 2.5, 'Ausbau': 1.5, 'Steuer': 1.5}
SPAETER = {'Ausbau', 'Steuer'}
assert sum(BUDGET.values()) * 30.4 <= MONATSBUDGET, sum(BUDGET.values()) * 30.4

# Kantone der Phase 1: dort zeigt der Check die Ziffer aus dem Zonenplan.
ORTE = {'Zürich': 20151, 'Aargau': 20126, 'Solothurn': 20143, 'Luzern': 20137, 'Schwyz': 20144, 'Schaffhausen': 20142, 'Zug': 20150}
# Phase 2 ab Woche 3: übrige Deutschschweiz (zweisprachige Kantone erst nach dem Test).
ORTE_2 = {'Bern': 20129, 'St. Gallen': 20141, 'Basel-Landschaft': 20130, 'Thurgau': 20145, 'Graubünden': 20135, 'Basel-Stadt': 20131,
          'Glarus': 20134, 'Appenzell Ausserrhoden': 20128, 'Appenzell Innerrhoden': 20127, 'Nidwalden': 20139, 'Obwalden': 20140, 'Uri': 20147}

# Der Ratgeber der Kampagne Steuer erklärt Zürcher Recht (StG ZH), und die
# Anzeige sagt das. In Luzern oder Zug gelten andere Tarife: dort bezahlte
# Klicks fänden nicht, was sie suchen. Darum nur Zürich (18. November).
ORTE_JE = {'Steuer': {'Zürich': 20151}}

# Ein Keyword mit einem Kanton der Phase 2 («zonenplan bern») sucht jemand,
# der dort Land hat. In Phase 1 sehen die Anzeige nur Leute in den sieben
# Kantonen, und der Check zeigt dort noch keine Ziffer: bis Woche 3 pausiert.
PHASE_2_WOERTER = {'bern': 'Bern', 'st gallen': 'St. Gallen', 'st. gallen': 'St. Gallen', 'thurgau': 'Thurgau', 'basel': 'Basel',
                   'graubünden': 'Graubünden', 'glarus': 'Glarus', 'appenzell': 'Appenzell', 'nidwalden': 'Nidwalden',
                   'obwalden': 'Obwalden', 'uri': 'Uri'}
def phase_2(wort):
    return next((k for w, k in PHASE_2_WOERTER.items() if re.search(rf'(^|\s){re.escape(w)}($|\s)', wort)), None)

MAX_CPC = {'Erbe': 3.0, 'Steuer': 3.0, 'Ausbau': 4.0}
REIHE = ['Zone', 'Ausnützung', 'Erbe', 'Parzelle', 'Bauen', 'Ausbau', 'Steuer']

# Im ganzen Konto: wer mieten, kaufen oder eine Stelle sucht, ist kein Eigentümer.
KONTO_AUS = ['mieten', 'miete', 'mietwohnung', 'wohnung kaufen', 'haus kaufen', 'bauland kaufen', 'ferienwohnung', 'stelle', 'job', 'lehre',
             'ausbildung', 'gratis inserat', 'homegate', 'immoscout', 'newhome', 'comparis', 'deutschland', 'österreich']

# Anzeigentexte: nur, was die Seite hält (Etikett aller Seiten: «Kostenlos ·
# amtliche Daten · in Sekunden»; Ausnützung und Reserve gegen Kontaktangaben,
# darum nie «ohne Anmeldung»). Titel höchstens 30, Texte höchstens 90 Zeichen.
TITEL = {
    'Zone': ['Welche Zone gilt bei Ihnen?', 'Zonenplan für Ihre Adresse', 'Bauzone in Sekunden sehen', 'Kostenlos, amtliche Daten',
             'Zone, Parzelle und Fläche', 'Was erlaubt Ihre Zone?', 'Adresse eingeben, fertig', 'Wohnzone, Kernzone, Bauzone',
             'Daten von Bund und Kanton', 'Statt im Geoportal suchen', 'Zonen-Check'],
    'Ausnützung': ['Ausnützungsziffer berechnen', 'Wie viel dürfen Sie bauen?', 'Rechner mit amtlichen Daten', 'Für Ihre Adresse, kostenlos',
                   'Baureserve auf Ihrer Parzelle', 'Geschossfläche heute und neu', 'Ausnützung und Reserve', 'Fläche aus der Vermessung',
                   'Ziffer aus dem Zonenplan', 'Ausnützung-Check'],
    'Parzelle': ['Ihre Parzelle auf einen Blick', 'Fläche, Zone und Gebäude', 'Parzellennummer und EGRID', 'Amtliche Daten, kostenlos',
                 'Statt im Geoportal suchen', 'Grundstücksfläche sofort', 'Mit Link zum ÖREB-Auszug', 'Adresse eingeben, fertig', 'Parzellen-Checker'],
    'Bauen': ['Was können Sie bauen?', 'Bauzone und Regeln prüfen', 'Baugesuche in Ihrer Gemeinde', 'Kostenlos, in einer Minute',
              'Vor dem Baugesuch prüfen', 'Zone, Parzelle, Gebäude', 'Baugesuche in der Nähe', 'Amtliche Daten zur Adresse', 'Was kann ich bauen?'],
    'Ausbau': ['Ein Stockwerk mehr?', 'Aufstocken: zuerst prüfen', 'Anbau oder Einliegerwohnung', 'Ist noch Fläche frei?',
               'Nach oben bauen statt kaufen', 'Aufstockung prüfen', 'Zone und Ausnützung prüfen', 'Kostenlos, amtliche Daten', 'Aufstockungs-Check'],
    'Erbe': ['Liegenschaft geerbt?', 'Behalten oder verkaufen?', 'Zuerst die Fakten kennen', 'Vertraulich und kostenlos', 'Haus geerbt: was nun?',
             'Erbengemeinschaft: die Fakten', 'Grundstück und Gebäude prüfen', 'Wert einschätzen lassen', 'Ratgeber Liegenschaft geerbt'],
    'Steuer': ['Grundstückgewinnsteuer', 'Was bleibt beim Verkauf?', 'Einfach erklärt, mit Quelle', 'Vor dem Verkauf nachlesen',
               'Steuer beim Hausverkauf', 'Aufschub bei Ersatzkauf', 'Besitzdauer zählt', 'Ratgeber, kostenlos'],
}
TEXTE = {
    'Zone': K['Zone']['text'] + ['Mit Ausnützungsziffer und Reserve, wo der Kanton sie im Zonenplan führt.',
                                 'Amtliche Vermessung, Bauzonen und Gebäuderegister in einer Ansicht. Kostenlos.'],
    'Ausnützung': K['Ausnützung']['text'] + ['Wo der Kanton die Ziffer im Zonenplan führt, setzen wir sie ein. Sie sehen die Reserve.',
                                             'Kostenlos und unverbindlich. Die Gemeinde erlaubt oft mehr, als heute steht.'],
    'Parzelle': K['Parzelle']['text'] + ['Parzellennummer, EGRID, Fläche und Bauzone aus der amtlichen Vermessung, in Sekunden.',
                                         'Kostenlos und unverbindlich. Für Eigentümer in der ganzen Deutschschweiz.'],
    'Bauen': K['Bauen']['text'] + ['Die Gemeinde-Seiten zeigen Baugesuche und Gebäude je Gemeinde, aus amtlichen Daten.',
                                   'Was Ihre Gemeinde konkret erlaubt, klären wir auf Wunsch für Sie ab. Unverbindlich.'],
    'Ausbau': K['Ausbau']['text'] + ['Nach oben bauen statt neu kaufen: was Zone und Ausnützung auf Ihrer Parzelle zulassen.',
                                     'Mit Ratgeber: wann Aufstocken erlaubt ist und was Sie vor dem Gesuch klären sollten.'],
    'Erbe': K['Erbe']['text'] + ['Behalten, vermieten oder verkaufen? Sehen Sie zuerst, was auf dem Grundstück steht.',
                                 'Ratgeber: was das Gesetz zur Erbengemeinschaft sagt und welche Wege es gibt.'],
    'Steuer': K['Steuer']['text'] + ['Gewinn, Besitzdauer und Aufschub: die Regeln des Kantons Zürich, mit amtlicher Quelle.',
                                     'Kostenlos nachlesen, dann Ihr Haus mit den amtlichen Daten prüfen.'],
}
PFAD = {'Zone': ('Zonenplan', 'Ihre-Adresse'), 'Ausnützung': ('Ausnuetzung', 'Rechner'), 'Parzelle': ('Parzelle', 'EGRID'),
        'Bauen': ('Bauzone', 'Baugesuche'), 'Ausbau': ('Aufstocken', 'Anbau'), 'Erbe': ('Erbe', 'Liegenschaft'), 'Steuer': ('Verkauf', 'Steuer')}

# Sitelinks: echte, verschiedene Seiten derselben Domain (die Ratgeber und
# der Heizungs-Check gibt es auf jeder Marken-Domain). Text höchstens 25,
# Zeilen höchstens 35 Zeichen.
S_HAUS = ('Haus zu gross?', '/ratgeber/haus-zu-gross', 'Fünf Wege für Eigentümer', 'Ratgeber, kostenlos')
S_ERBE = ('Liegenschaft geerbt', '/ratgeber/liegenschaft-geerbt', 'Behalten, vermieten, verkaufen', 'Was das Gesetz sagt')
S_AUF = ('Ratgeber Aufstocken', '/ratgeber/aufstocken', 'Wann es erlaubt ist', 'Was Sie vorher klären')
S_HEIZ = ('Heizungs-Check', '/heizung', 'Heizung aus dem Register', 'Ersatz rechtzeitig planen')
S_GEM = ('Bauen in Ihrer Gemeinde', '/gemeinden', 'Baugesuche je Gemeinde', 'Aus den amtlichen Daten')
S_CHECK = ('Grundstück prüfen', '/', 'Zone, Fläche und Gebäude', 'Kostenlos, in Sekunden')
SITELINKS = {'Zone': [S_AUF, S_ERBE, S_HAUS, S_HEIZ], 'Ausnützung': [S_AUF, S_ERBE, S_HAUS, S_HEIZ], 'Parzelle': [S_AUF, S_ERBE, S_HAUS, S_HEIZ],
             'Bauen': [S_GEM, S_AUF, S_ERBE, S_HEIZ], 'Ausbau': [S_ERBE, S_HAUS, S_HEIZ, S_CHECK], 'Erbe': [S_HAUS, S_AUF, S_HEIZ, S_CHECK],
             'Steuer': [S_CHECK, S_ERBE, S_HAUS, S_AUF]}
HINWEISE = ['Kostenlos', 'Amtliche Daten', 'In Sekunden', 'Für Ihre Adresse', 'Unverbindlich']
HINWEISE_ERBE = ['Vertraulich', 'Kostenlos', 'Amtliche Daten', 'Unverbindlich']

# ------------------------------------------------------------ Prüfungen
for x in REIHE:
    t, d = TITEL[x], TEXTE[x]
    assert 5 <= len(t) <= 15 and len(set(t)) == len(t), (x, len(t))
    assert 2 <= len(d) <= 4 and len(set(d)) == len(d), (x, len(d))
    for s in t: assert len(s) <= 30 and '!' not in s, (x, len(s), s)
    for s in d: assert len(s) <= 90 and s.count('!') <= 1, (x, len(s), s)
    for p in PFAD[x]: assert len(p) <= 15 and re.fullmatch(r'[A-Za-z-]+', p), p
    assert len({s[1] for s in SITELINKS[x]}) == 4
    for s in SITELINKS[x]: assert len(s[0]) <= 25 and len(s[2]) <= 35 and len(s[3]) <= 35, s
for h in HINWEISE + HINWEISE_ERBE: assert len(h) <= 25
assert len(set(ORTE.values()) | set(ORTE_2.values())) == 19
# Kein Keyword darf an einem eigenen Ausschluss scheitern.
for x in REIHE:
    aus = K[x]['aus'] + KONTO_AUS
    for w in K[x]['woerter']:
        wort = f' {w} '
        assert not any(f' {a} ' in wort for a in aus), (x, w)
alle = [w for x in REIHE for w in K[x]['woerter']]
assert len(alle) == len(set(alle))

# ------------------------------------------------------------ Zeilen
SPALTEN = ['Campaign', 'Campaign Type', 'Networks', 'Budget', 'Budget type', 'Bid Strategy Type', 'Maximum CPC bid limit', 'Languages',
           'Campaign Status', 'Final URL suffix', 'EU political ads', 'Location ID', 'Ad Group', 'Max CPC', 'Ad Group Status', 'Keyword',
           'Criterion Type', 'Status', 'Ad type'] + [f'Headline {i}' for i in range(1, 16)] + [f'Description {i}' for i in range(1, 5)] + \
          ['Path 1', 'Path 2', 'Final URL', 'Link Text', 'Description Line 1', 'Description Line 2', 'Callout text', 'Comment']
zeilen = []
def zeile(**w):
    z = {s: '' for s in SPALTEN}
    for k, v in w.items():
        s = k.replace('_', ' ')
        assert s in z, s
        z[s] = v
    zeilen.append(z)

name = lambda x: f"{x} ({K[x]['domain']})"
url = lambda x, pfad='': f"https://www.{K[x]['domain']}{pfad or K[x]['pfad']}"
for x in REIHE:
    k, n = K[x], name(x)
    budget = BUDGET[x]
    cpc = f'{MAX_CPC.get(x, 2.5):.2f}'
    zeile(Campaign=n, Campaign_Type='Search', Networks='Google search', Budget=f'{budget:.2f}', Budget_type='Daily',
          Bid_Strategy_Type='Maximize clicks', Maximum_CPC_bid_limit=cpc, Languages='de', Campaign_Status='Paused',
          Final_URL_suffix=f"utm_source=google&utm_medium=cpc&utm_campaign={k['utm']}&utm_term={{keyword}}", EU_political_ads='No',
          Comment='einschalten in Woche 3' if x in SPAETER else 'einschalten in Woche 1')
    for ort, gid in ORTE_JE.get(x, ORTE).items():
        zeile(Campaign=n, Location_ID=str(gid), Comment=ort)
    zeile(Campaign=n, Ad_Group=x, Max_CPC=cpc, Ad_Group_Status='Enabled')
    for w in sorted(k['woerter'], key=lambda z: -P.v(z)):
        kanton = phase_2(w)
        for art in ('Phrase', 'Exact'):
            zeile(Campaign=n, Ad_Group=x, Keyword=w, Criterion_Type=art, Status='Paused' if kanton else 'Enabled',
                  Comment=f'einschalten mit Phase 2 ({kanton})' if kanton else '')
    for a in k['aus'] + KONTO_AUS:
        zeile(Campaign=n, Keyword=a, Criterion_Type='Campaign negative')
    anzeige = dict(Campaign=n, Ad_Group=x, Status='Enabled', Ad_type='Responsive search ad', Path_1=PFAD[x][0], Path_2=PFAD[x][1], Final_URL=url(x))
    for i, t in enumerate(TITEL[x], 1): anzeige[f'Headline_{i}'] = t
    for i, t in enumerate(TEXTE[x], 1): anzeige[f'Description_{i}'] = t
    zeile(**anzeige)
    for text, pfad, z1, z2 in SITELINKS[x]:
        zeile(Campaign=n, Link_Text=text, Final_URL=url(x, pfad), Description_Line_1=z1, Description_Line_2=z2)
    for h in (HINWEISE_ERBE if x == 'Erbe' else HINWEISE):
        zeile(Campaign=n, Callout_text=h)

with (DIR / 'google-ads-import.csv').open('w', encoding='utf-16', newline='') as f:
    w = csv.DictWriter(f, fieldnames=SPALTEN, delimiter='\t', lineterminator='\r\n')
    w.writeheader()
    w.writerows(zeilen)

zaehl = lambda f: sum(1 for z in zeilen if f(z))
print('Zeilen', len(zeilen), '| Kampagnen', zaehl(lambda z: z['Campaign Type']), '| Keywords', zaehl(lambda z: z['Criterion Type'] in ('Phrase', 'Exact')),
      '| Ausschlüsse', zaehl(lambda z: z['Criterion Type'] == 'Campaign negative'), '| Anzeigen', zaehl(lambda z: z['Ad type']),
      '| Sitelinks', zaehl(lambda z: z['Link Text']), '| Hinweise', zaehl(lambda z: z['Callout text']), '| Standorte', zaehl(lambda z: z['Location ID']))

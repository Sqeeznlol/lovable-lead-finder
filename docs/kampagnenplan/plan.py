# Kampagnenplan für die Check-Seiten, als HTML für den Druck (A4).
# Jede Zahl zu Suchen und Geboten kommt aus volumen.tsv (Google Ads über
# DataForSEO, Schweiz, Deutsch, abgefragt am 16. November 2026).
import statistics, sys
from bausteine import CSS, DIR, balken, esc, geld, lesen, tabelle, tsd, zahl

KURS = 0.83   # 1 US-Dollar in Franken, Mitte November 2026 (Migros Bank 0.81 bis 0.84, Wise 0.84)
STAND = '16. November 2026'

vol = {z['keyword']: z for z in lesen('volumen.tsv')}
gruppe = {z.split('\t')[0]: z.rstrip('\n').split('\t')[1] for z in open(DIR / 'keywords.tsv', encoding='utf-8')}
if len(vol) != 377:
    sys.exit(f'volumen.tsv: {len(vol)} statt 377 Zeilen')


def v(wort):
    return zahl(vol[wort]['search_volume']) or 0


def gebot(wort):
    """Gebot für einen Platz oben, tief und hoch, in Franken; None ohne Daten."""
    z = vol[wort]
    t, h = zahl(z['low_top_of_page_bid']), zahl(z['high_top_of_page_bid'])
    return (t * KURS, h * KURS) if t is not None and h is not None else None


def gebot_text(wort):
    g = gebot(wort)
    return 'keine Gebote' if g is None else f'CHF {g[0]:.2f} bis {g[1]:.2f}'


def summe(woerter):
    return sum(v(w) for w in woerter)


def hoch_median(woerter):
    """Median der hohen Gebote in Franken, gewichtet wird nicht: es geht um die Grössenordnung."""
    g = [gebot(w)[1] for w in woerter if gebot(w)]
    return statistics.median(g) if g else None


def hoechstes(woerter):
    return max(gebot(w)[1] for w in woerter if gebot(w))


ERBE_MAX = hoechstes(['erbengemeinschaft', 'erbteilung', 'erbvorbezug'])
STEUER = ['grundstückgewinnsteuer', 'grundstückgewinnsteuer zürich', 'grundstückgewinnsteuer berechnen']
GIS = ['geoportal', 'gis zh', 'gis browser']
BEWERTUNG = gebot('immobilienbewertung')

# --------------------------------------------------------------- Google: ein Thema je Seite
KAMPAGNEN = [
    dict(
        kurz='Zone', domain='zonen-check.ch', pfad='/', utm='zone',
        frage='Welche Zone gilt für mein Grundstück?',
        warum='Das grösste günstige Thema. Wer den Zonenplan seiner Gemeinde sucht, hat ein Grundstück vor Augen. Auf die meisten dieser Wörter bietet niemand.',
        woerter=['zonenplan zürich', 'zonenplan', 'zonenplan aargau', 'zonenplan bern', 'zonenplan luzern', 'zonenplan st gallen', 'zonenplan winterthur',
                 'zonenplan thurgau', 'zonenplan uster', 'bauzonenplan', 'baureglement', 'bau und zonenordnung', 'bauordnung', 'bauzone', 'bauzonen',
                 'wohnzone w2', 'kernzone', 'wohnzone', 'bauzonen schweiz'],
        ohne=['bzo zürich', 'bzo'], ohne_grund=f'«bzo» und «bzo zürich» ({tsd(summe(["bzo", "bzo zürich"]))} Suchen) kosten oben CHF {gebot("bzo zürich")[1]:.0f}: dort bietet jemand kräftig. Erst testen, wenn der Rest läuft.',
        aus=['pdf', 'download', 'karte drucken', 'stadtplan', 'ortsplan', 'öv', 'tarifzonen', 'zvv', 'parkzone', 'blaue zone'],
        titel=['Welche Zone gilt bei Ihnen?', 'Zonenplan für Ihre Adresse', 'Bauzone in Sekunden sehen', 'Kostenlos, amtliche Daten'],
        text=['Adresse eingeben und sofort sehen: Bauzone, Parzelle, Fläche und Gebäude. Kostenlos.',
              'Was die Zone erlaubt, steht im Zonenplan des Kantons. Für Ihre Adresse, in einer Minute.'],
    ),
    dict(
        kurz='Ausnützung', domain='ausnuetzung-check.ch', pfad='/', utm='ausnuetzung',
        frage='Wie viel darf ich bauen?',
        warum='Wer «Ausnützungsziffer berechnen» sucht, rechnet schon. Genau das tut der Rechner auf der Seite, mit den amtlichen Flächen.',
        woerter=['ausnützungsziffer', 'ausnützungsziffer berechnen', 'baumassenziffer', 'überbauungsziffer', 'grünflächenziffer', 'anrechenbare geschossfläche',
                 'geschossflächenziffer', 'ausnützungsziffer aargau', 'ausnutzungsziffer', 'baumassenziffer berechnen', 'anrechenbare grundstücksfläche',
                 'ausnützungsziffer st gallen', 'az berechnen', 'ausnützungsziffer zürich', 'ausnützungsziffer luzern', 'ausnützungsziffer thurgau',
                 'abparzellierung', 'parzellierung'],
        aus=['definition', 'studium', 'prüfung', 'wikipedia', 'englisch', 'deutschland', 'grz', 'gfz'],
        titel=['Ausnützungsziffer berechnen', 'Wie viel dürfen Sie bauen?', 'Rechner mit amtlichen Daten', 'Für Ihre Adresse, kostenlos'],
        text=['Fläche und Gebäude kommen aus den amtlichen Registern. Sie stellen nur die Ziffer ein.',
              'Sehen Sie, wie viel Geschossfläche heute steht und wie viel noch möglich wäre.'],
    ),
    dict(
        kurz='Parzelle', domain='parzellenchecker.ch', pfad='/', utm='parzelle',
        frage='Was steht über meine Parzelle in den amtlichen Daten?',
        warum='Kataster, ÖREB und EGRID sucht, wer mit einem bestimmten Grundstück zu tun hat. Kaum Gebote. Die Seite zeigt Parzelle, Fläche und Zone schneller als das Geoportal.',
        woerter=['katasterplan', 'öreb kataster', 'egrid', 'parzelle', 'oereb', 'amtliche vermessung', 'parzellenplan', 'egrid nummer', 'parzellennummer',
                 'öreb auszug', 'parzellengrenze', 'katasterauskunft', 'parzellennummer finden', 'grundstücksnummer', 'katasterplan online', 'grundstücksgrenze',
                 'parzellennummer herausfinden', 'grundstücksfläche herausfinden', 'grundstücksgrenzen online'],
        ohne=['geoportal', 'gis zh', 'gis browser', 'grundbuchauszug', 'grundbuchauszug bestellen', 'wem gehört das grundstück'],
        ohne_grund=f'«geoportal», «gis zh» und «gis browser» (zusammen {tsd(summe(GIS))} Suchen, Gebot unter 15 Rappen) sind ein eigener Test mit CHF 3 am Tag: sehr billig, aber die meisten wollen zum Kanton. «Grundbuchauszug» ({tsd(summe(["grundbuchauszug", "grundbuchauszug bestellen"]))} Suchen, oben bis CHF {hoechstes(["grundbuchauszug", "grundbuchauszug bestellen"]):.0f}) erst später: die Seite liefert den Auszug nicht. Eigentümer nennt die Seite nie, also kein «wem gehört».',
        aus=['kaufen', 'mieten', 'eigentümer', 'wem gehört', 'bestellen', 'kosten', 'grundbuchamt', 'landwirtschaft', 'schrebergarten', 'friedhof'],
        titel=['Ihre Parzelle auf einen Blick', 'Fläche, Zone und Gebäude', 'Parzellennummer und EGRID', 'Amtliche Daten, kostenlos'],
        text=['Adresse eingeben statt im Geoportal suchen: Parzelle, Fläche, Bauzone und Gebäude.',
              'Mit Link zum amtlichen ÖREB-Auszug des Kantons, wo es ihn gibt. Kostenlos.'],
    ),
    dict(
        kurz='Bauen', domain='was-kann-ich-bauen.ch', pfad='/', utm='bauen',
        frage='Brauche ich eine Bewilligung, und was bauen die Nachbarn?',
        warum='Baubewilligung und Baugesuch sucht, wer bauen will oder wessen Nachbar baut. Die Seite zeigt Zone und Parzelle, die Gemeinde-Seiten zeigen die Baugesuche.',
        woerter=['baubewilligung', 'baugesuch', 'baugesuche', 'baugesuche zürich', 'amtsblatt baugesuche', 'baugesuche einsehen', 'einsprache baugesuch',
                 'baupublikationen', 'baubewilligung gartenhaus', 'baugesuche aargau', 'baubewilligung carport', 'baugesuch einreichen', 'firsthöhe',
                 'grenzabstand', 'gebäudehöhe', 'vollgeschoss', 'grenzabstand aargau'],
        aus=['formular', 'vorlage', 'muster', 'anwalt', 'stelle', 'job', 'pool', 'zaun', 'solaranlage', 'wärmepumpe'],
        titel=['Was können Sie bauen?', 'Bauzone und Regeln prüfen', 'Baugesuche in Ihrer Gemeinde', 'Kostenlos, in einer Minute'],
        text=['Vor dem Baugesuch: Zone, Parzelle und Gebäude für Ihre Adresse sehen. Amtliche Daten.',
              'Wie viele Baugesuche gab es in Ihrer Nachbarschaft? Adresse eingeben und nachsehen.'],
    ),
    dict(
        kurz='Ausbau', domain='aufstockungscheck.ch', pfad='/', utm='ausbau',
        frage='Kann ich aufstocken, anbauen, eine Wohnung einbauen?',
        warum='Kleine Mengen, aber Eigentümer mit einem Vorhaben. Der Ratgeber «Aufstocken» steht bereit. Handwerker bieten mit, darum mittlere Gebote.',
        woerter=['einliegerwohnung', 'aufstockung', 'aufstocken', 'anbau haus', 'umbau haus', 'anbau', 'dachstock ausbauen', 'dachaufstockung', 'dachausbau',
                 'haus aufstocken', 'hausanbau', 'aufstockung einfamilienhaus', 'aufstockung holzbau', 'haus aufstocken kosten', 'anbau haus kosten', 'stöckli bauen'],
        ohne=['wintergarten anbau'], ohne_grund=f'«wintergarten anbau» sucht ein Produkt, und die Anbieter bieten bis CHF {gebot("wintergarten anbau")[1]:.0f}. Für diese Kampagne gilt eine Obergrenze von CHF 4 je Klick.',
        aus=['mieten', 'ferienwohnung', 'lager', 'personal', 'kapital', 'aktien', 'holzbau firma', 'offerte'],
        titel=['Ein Stockwerk mehr?', 'Aufstocken: zuerst prüfen', 'Anbau oder Einliegerwohnung', 'Ist noch Fläche frei?'],
        text=['Ob Aufstockung oder Anbau erlaubt sind, hängt von Zone und Ausnützung ab. Jetzt prüfen.',
              'Adresse eingeben und sehen, wie viel auf Ihrem Grundstück heute steht. Kostenlos.'],
    ),
    dict(
        kurz='Erbe', domain='erbliegenschaft.ch', pfad='/', utm='erbe',
        frage='Geerbt. Behalten, vermieten oder verkaufen?',
        warum=f'Die stärkste Verkaufsabsicht zum kleinsten Preis: Erbengemeinschaft, Erbteilung und Erbvorbezug kosten oben höchstens CHF {ERBE_MAX:.2f}. Der Ratgeber «Liegenschaft geerbt» steht bereit.',
        woerter=['nutzniessung', 'erbengemeinschaft', 'erbvorbezug', 'wohnrecht', 'erbteilung', 'erbengemeinschaft auflösen', 'wohnrecht oder nutzniessung',
                 'grundstückgewinnsteuer erbschaft', 'immobilie erben', 'haus überschreiben', 'haus erben', 'haus erben schweiz', 'erbengemeinschaft haus',
                 'erbteilung liegenschaft', 'schenkung haus'],
        aus=['anwalt', 'testament vorlage', 'muster', 'deutschland', 'österreich', 'erbschein', 'konto', 'auto', 'mietvertrag'],
        titel=['Liegenschaft geerbt?', 'Behalten oder verkaufen?', 'Zuerst die Fakten kennen', 'Vertraulich und kostenlos'],
        text=['Sehen Sie, was auf dem geerbten Grundstück steht und was darauf möglich wäre.',
              'Für die Erbteilung: Fläche, Zone, Gebäude und eine persönliche Einschätzung des Werts.'],
    ),
    dict(
        kurz='Steuer', domain='hauschecker.ch', pfad='/ratgeber/grundstueckgewinnsteuer', utm='steuer',
        frage='Was bleibt mir, wenn ich verkaufe?',
        warum=f'Nach der Grundstückgewinnsteuer fragt, wer einen Verkauf durchrechnet: {tsd(summe(STEUER))} Suchen im Monat, oben höchstens CHF {hoechstes(STEUER):.2f}. Günstiger kommt man bei Google nicht an Verkäufer. Dafür fehlt noch ein Ratgeber (siehe letzte Seite).',
        woerter=STEUER,
        aus=['formular', 'steuererklärung software', 'treuhänder job', 'deutschland'],
        titel=['Grundstückgewinnsteuer', 'Was bleibt beim Verkauf?', 'Einfach erklärt, mit Quelle', 'Vor dem Verkauf nachlesen'],
        text=['Wie die Steuer gerechnet wird, wann sie aufgeschoben wird und was Sie vorher klären.',
              'Dazu kostenlos: was die amtlichen Daten über Ihr Haus und Ihr Grundstück sagen.'],
    ),
]

for k in KAMPAGNEN:
    for w in k['woerter'] + k.get('ohne', []):
        assert w in vol, w
    # Google: Anzeigentitel höchstens 30, Beschreibung höchstens 90 Zeichen.
    for t in k['titel']:
        assert len(t) <= 30, (len(t), t)
    for t in k['text']:
        assert len(t) <= 90, (len(t), t)
alle_google = [w for k in KAMPAGNEN for w in k['woerter']]
assert len(alle_google) == len(set(alle_google)), 'ein Wort steht in zwei Kampagnen'
GOOGLE_SUMME = summe(alle_google)
GUENSTIG_ANTEIL = round(100 * sum(v(w) for w in alle_google if not gebot(w) or gebot(w)[1] <= 3) / GOOGLE_SUMME)
OHNE_GEBOT_ANTEIL = round(100 * sum(v(w) for w in alle_google if not gebot(w)) / GOOGLE_SUMME)

# Themen für das Diagramm: was die Leute suchen, über alle 377 Wörter.
THEMEN = [
    ('Zonenplan, Bauordnung', [w for w, g in gruppe.items() if g == 'bauen-zone' and ('zone' in w or w in ('bzo', 'bzo zürich', 'baureglement', 'bauordnung', 'baugesetz', 'bau und zonenordnung'))], None),
    ('Heizung, Energie', [w for w, g in gruppe.items() if g == 'heizung'], None),
    ('Verkaufen, Makler', ['haus verkaufen', 'immobilie verkaufen', 'immobilienmakler', 'immobilienmakler zürich', 'wohnung verkaufen', 'liegenschaft verkaufen',
                           'mehrfamilienhaus verkaufen', 'haus verkaufen schweiz', 'haus verkaufen ohne makler', 'einfamilienhaus verkaufen', 'haus verkaufen steuern',
                           'haus verkaufen tipps', 'renditeliegenschaft verkaufen'], None),
    ('Grundstückgewinnsteuer', ['grundstückgewinnsteuer', 'grundstückgewinnsteuer zürich', 'grundstückgewinnsteuer berechnen'], None),
    ('Kataster, ÖREB, Parzelle', [w for w, g in gruppe.items() if g == 'parzelle' and w not in ('geoportal', 'gis zh', 'gis browser') and 'grundbuch' not in w], None),
    ('Hauswert, Bewertung', [w for w, g in gruppe.items() if g == 'hauswert'], None),
    ('Ausnützung, Ziffern', [w for w, g in gruppe.items() if g == 'ausnuetzung'], None),
    ('Landwert, Bauland', [w for w, g in gruppe.items() if g == 'landwert'], None),
    ('Erben', [w for w, g in gruppe.items() if g == 'erbe'], None),
    ('Grundbuchauszug', [w for w in gruppe if 'grundbuch' in w], None),
    ('Baubewilligung, Baugesuch', [w for w, g in gruppe.items() if g == 'bauen-zone' and ('baubewilligung' in w or 'baugesuch' in w or 'baupublikation' in w)], None),
    ('Aufstocken, Anbau', [w for w, g in gruppe.items() if g == 'ausbau'], None),
    ('Wohnen im Alter', [w for w, g in gruppe.items() if g == 'alter'], None),
]


def gewichtete_mitte(woerter):
    """Hohes Gebot, bei dem die Hälfte der Suchen (mit Gebot) erreicht ist."""
    paare = sorted((gebot(w)[1], v(w)) for w in woerter if gebot(w) and v(w))
    halb, lauf = sum(x for _, x in paare) / 2, 0
    for g, x in paare:
        lauf += x
        if lauf >= halb:
            return g
    return None


def thema_zeile(name, woerter, hinweis):
    if hinweis:
        return (name, summe(woerter), hinweis)
    ohne = round(100 * sum(v(w) for w in woerter if not gebot(w)) / summe(woerter))
    m = gewichtete_mitte(woerter)
    if m is None:
        return (name, summe(woerter), 'keine Gebote')
    return (name, summe(woerter), (f'{ohne} % ohne Gebote, sonst um CHF {m:.2f}' if ohne >= 15 else f'Platz oben um CHF {m:.2f}'))


THEMEN_ZEILEN = sorted((thema_zeile(*t) for t in THEMEN), key=lambda z: -z[1])
MARKEN = ['neho', 'realadvisor', 'properti', 'houzy', 'iazi']

teuer = ['immobilienbewertung', 'immobilie bewerten', 'haus schätzen lassen', 'immobilienbewertung online', 'haus verkaufen', 'grundstück verkaufen']
guenstig = ['zonenplan', 'ausnützungsziffer berechnen', 'erbengemeinschaft', 'grundstückgewinnsteuer', 'katasterplan', 'baubewilligung']


# --------------------------------------------------------------- Seiten
def seite(inhalt):
    return f'<section class="seite">{inhalt}</section>'


def kampagne_block(k):
    w = sorted(k['woerter'], key=lambda x: -v(x))
    gross = [x for x in w if v(x) >= 40]
    klein = [x for x in w if v(x) < 40]
    chips = ''.join(f'<span>{esc(x)} <i>{tsd(v(x))}{" · " + gebot_text(x) if gebot(x) else ""}</i></span>' for x in gross)
    if klein:
        chips += f'<span class="rest">Dazu {len(klein)} kleinere: {esc(", ".join(klein))}.</span>'
    g = [gebot(x)[1] for x in w if gebot(x)]
    ziel = f"www.{k['domain']}{k['pfad'] if k['pfad'] != '/' else '/'}"
    link = f"https://{ziel}?utm_source=google&utm_medium=cpc&utm_campaign={k['utm']}"
    t = [f'<div class="domain"><h3>{esc(k["domain"])}{esc(k["pfad"]) if k["pfad"] != "/" else ""}</h3>',
         f'<p class="rolle">Kampagne «{esc(k["kurz"])}» · {esc(k["frage"])} · {tsd(summe(w))} Suchen im Monat'
         + (f' · Gebot oben bis CHF {max(g):.2f}' if g else '') + '</p>',
         f'<p>{esc(k["warum"])}</p>',
         f'<p class="woerter">{chips}</p>']
    if k.get('ohne'):
        t.append(f'<p class="klein"><b>Bewusst nicht oder später:</b> {esc(k["ohne_grund"])}</p>')
    t.append(f'<p class="klein"><b>Ausschliessen:</b> {esc(", ".join(k["aus"]))}</p>')
    t.append(f'<div class="anzeige"><div class="u">Anzeige · {esc(ziel)}</div><div class="t">{esc(" | ".join(k["titel"][:3]))}</div>'
             f'<div>{esc(k["text"][0])} {esc(k["text"][1])}</div></div>')
    t.append(f'<p class="klein" style="margin-top:1.6mm">Weitere Titel: {esc(k["titel"][3])}. Ziel: {esc(link)}</p></div>')
    return ''.join(t)


titel = seite(f"""
<div class="titelseite">
  <div>
    <p class="ueber">Kampagnenplan · Stand {STAND}</p>
    <h1>Wo Anzeigen für die<br>Check-Seiten am meisten bringen</h1>
    <p class="lead">Gesamtanalyse der Kanäle, die Suchwörter je Seite mit echten Schweizer Suchzahlen, Anzeigentexte, Budget und Reihenfolge. Für Julian und Tim.</p>
  </div>
  <div>
    <div class="kern">
      <div><b>{tsd(GOOGLE_SUMME)}</b><span>Suchen im Monat auf den {len(alle_google)} Wörtern, die zu sieben Check-Seiten passen (Google, Schweiz, deutsch)</span></div>
      <div><b>{GUENSTIG_ANTEIL} %</b><span>dieser Suchen kosten für einen Platz oben höchstens CHF 3, oder es bietet gar niemand. Bei «Immobilienbewertung» sind es CHF {BEWERTUNG[0]:.0f} bis {BEWERTUNG[1]:.0f}.</span></div>
      <div><b>7 von 23</b><span>Domains bekommen Google-Anzeigen, jede ein eigenes Thema. Google lässt nicht zu, dieselbe Suche mit mehreren eigenen Seiten zu belegen.</span></div>
    </div>
    <div class="unten klein" style="margin-top:8mm"><span>Bauraum · Check-Seiten für Eigentümer</span><span>Zahlen: Google Ads über DataForSEO, abgefragt am {STAND}</span></div>
  </div>
</div>""")

empfehlung = seite(f"""
<p class="ueber">Das Wichtigste</p>
<h2>Die Empfehlung in sechs Punkten</h2>
<ol class="schritte">
  <li><div><b>Facebook und Instagram bleiben der Hauptkanal.</b> Viele Eigentümer, die wir suchen, sind im Pensionsalter und suchen nicht nach uns. Der Ratgeber erreicht sie nach Alter und Region, der Check holt den Kontakt. Rund zwei Drittel des Budgets.</div></li>
  <li><div><b>Google lohnt sich, aber nur auf den Fragen, die niemand bewirbt.</b> Zonenplan, Ausnützungsziffer, Kataster, Erbengemeinschaft und Grundstückgewinnsteuer: zusammen {tsd(GOOGLE_SUMME)} Suchen im Monat. Für {GUENSTIG_ANTEIL} % davon kostet ein Platz oben höchstens CHF 3, bei {OHNE_GEBOT_ANTEIL} % bietet niemand. Rund 30 % des Budgets. Mehr lässt sich dort kaum ausgeben.</div></li>
  <li><div><b>Nicht auf Bewertung und Verkauf bieten.</b> «Immobilienbewertung» kostet oben CHF {gebot('immobilienbewertung')[0]:.0f} bis {gebot('immobilienbewertung')[1]:.0f} je Klick, «Haus verkaufen» bis CHF {gebot('haus verkaufen')[1]:.0f}. Dort bieten Makler, Portale und Banken, und unser Check nennt keinen Verkaufspreis.</div></li>
  <li><div><b>Eine Seite je Thema.</b> Sieben Domains bekommen bei Google je eine Kampagne. Die übrigen sechzehn laufen bei Facebook als Vergleich von Name und Gestaltung, als kurze Adresse in Inseraten und als Ersatz, falls eine Seite schwach läuft. Nie zwei eigene Seiten auf dieselbe Suche.</div></li>
  <li><div><b>Die Namen der Domains sucht niemand.</b> «parzelle prüfen» und «haus zu gross»: zu selten für eine Zahl. «was darf ich bauen», «hauswert rechner», «grundstückswert berechnen», «haus geerbt»: je 10 Suchen im Monat. Die Domain ist der Absender der Anzeige, nicht das Suchwort. Gesucht wird nach Zonenplan, Ziffern, Steuern und Ämtern.</div></li>
  <li><div><b>Messen an den Kosten je heissem Lead.</b> Heiss heisst: Eigentümer, will verkaufen oder bauen, innert zwölf Monaten. Nach zwei Wochen verschieben wir Budget dorthin, wo diese Zahl am tiefsten ist, je Seite und je Kanal.</div></li>
</ol>
<div class="kasten">
  <p><b>Was gemessen ist und was Annahme.</b> Gemessen: Suchen je Monat und Gebote für jedes der 377 geprüften Wörter (Google Ads, Schweiz, deutsch, Mittel der letzten zwölf Monate), Marktanteile der Suchmaschinen, Auflagen der Zeitschriften, die Regeln von Google und Meta. Annahme: Klickraten, Anteil der Besucher mit Kontakt und damit die Kosten je Lead. Die kennen wir erst nach den ersten zwei Wochen. Der Plan ist darum ein Test mit festen Regeln, kein Versprechen.</p>
</div>
<h3>Was vorher stehen muss</h3>
<p>Im Impressum fehlen E-Mail und UID, in der Datenschutzerklärung die Auftragsbearbeiter mit Ländern. Ohne Werbekonten bei Google und Meta, die Messung des Leads als Ziel und eine Telefonnummer für Rückrufe startet keine Kampagne. Die ganze Liste steht auf der letzten Seite.</p>
""")

KANAELE = [
    ['<b>Facebook, Instagram: Ratgeber</b>', 'Rund 5,9 Mio. Konten in der Schweiz, 8,5 % davon über 65. Ratgeber-Anzeigen dürfen nach Alter, Kanton und PLZ zielen.', 'Tausend Einblendungen CHF 4 bis 15 (Agenturwerte). Kosten je Lead offen.', '<span class="urteil">Hauptkanal</span><br>46 % des Budgets'],
    ['<b>Facebook, Instagram: Check</b>', 'Dieselben Leute, aber als Dienst rund um den Wert Sonderkategorie Wohnraum: kein Alter, keine PLZ, Umkreis ab 17 km.', 'Wie oben. Die Genauigkeit kommt aus Bild und Frage, nicht aus dem Zielen.', '<span class="urteil">Ja</span><br>15 %'],
    ['<b>Google Suche</b>', f'81 % aller Suchen in der Schweiz. {tsd(GOOGLE_SUMME)} Suchen im Monat auf unseren Wörtern, Spitze im März.', f'Platz oben meist unter CHF 3 auf unseren Themen, CHF {BEWERTUNG[0]:.0f} bis {BEWERTUNG[1]:.0f} bei «Immobilienbewertung».', '<span class="urteil">Ja, gezielt</span><br>31 %'],
    ['<b>Microsoft (Bing)</b>', '12 % der Suchen in der Schweiz, vor allem am Computer. Die Kampagnen von Google lassen sich übernehmen.', 'Keine eigenen Zahlen. Annahme: nicht teurer als Google.', '<span class="urteil">Test ab Woche 3</span><br>4 %'],
    ['<b>Retargeting</b>', 'Wer eine Adresse geprüft und keinen Kontakt hinterlassen hat. Braucht Zustimmung im Cookie-Hinweis.', 'Kleine Menge, darum kleine Kosten.', '<span class="urteil">Ja, ab Woche 3</span><br>4 %'],
    ['<b>Zeitschriften</b>', 'Zeitlupe: 46\'776 Exemplare, rund 112\'000 Leser. Zürcher Hauseigentümer (HEV): 57\'056 Exemplare. Genau unsere Leute.', 'Preise nicht öffentlich. Offerten einholen.', '<span class="urteil">Test nach Offerte</span><br>aus der Reserve'],
    ['<b>Gemeinde-Seiten bei Google</b>', '«zonenplan» mit Ortsname wird tausendfach gesucht. Die Gemeinde-Seiten auf was-kann-ich-bauen.ch antworten darauf ohne Anzeige.', 'Kostet nichts, wächst langsam.', '<span class="urteil">Weiter ausbauen</span>'],
    ['<b>YouTube, Display, Performance Max</b>', 'Grosse Reichweite, aber Google wählt selbst, wem es die Anzeige zeigt.', 'Billige Klicks, schwache Kontakte (Annahme aus der Branche).', '<span class="urteil">Nein</span><br>frühestens nach 30 Leads'],
    ['<b>TikTok, LinkedIn, Immobilienportale</b>', 'Zu jung, zu beruflich, oder der Besucher sucht dort eine Wohnung und keinen Käufer.', '', '<span class="urteil">Nein</span>'],
]

analyse = seite(f"""
<p class="ueber">Gesamtanalyse</p>
<h2>Wo Anzeigen am besten laufen</h2>
<p class="grau" style="max-width:160mm">Zwei Arten von Eigentümern: Die einen suchen selbst, weil sie bauen, erben oder verkaufen. Die erreicht Google, genau und in kleiner Zahl. Die anderen suchen nicht, haben aber das Haus, das zu gross geworden ist. Die erreicht Facebook, breit und nach Alter. In der Schweiz leben 1,4 Millionen Haushalte im eigenen Heim, es stehen rund eine Million Einfamilienhäuser.</p>
{tabelle(['Kanal', 'Wen er erreicht', 'Was es kostet', 'Urteil'], KANAELE)}
<div class="kasten">
  <p><b>Warum nicht einfach mehr Google?</b> Weil die Menge fehlt. Auf allen Wörtern, die zu den Check-Seiten passen, wird zusammen {tsd(GOOGLE_SUMME)} Mal im Monat gesucht. Klickt jeder Zwanzigste, sind das rund {tsd(GOOGLE_SUMME * 0.05)} Besucher im Monat (Annahme). Die Kanäle ergänzen sich: Google bringt wenige mit klarer Absicht, Facebook viele ohne.</p>
</div>
""")

nachfrage = seite(f"""
<p class="ueber">Nachfrage bei Google</p>
<h2>Wonach Eigentümer in der Schweiz suchen</h2>
<p class="grau" style="max-width:160mm">Suchen je Monat, Mittel der letzten zwölf Monate, alle 377 geprüften Wörter nach Thema. Daneben, was ein Platz oben kostet: das hohe Gebot, bei dem die Hälfte der Suchen des Themas erreicht ist.</p>
{balken(THEMEN_ZEILEN)}
<p class="klein">Nicht im Bild: «geoportal», «gis zh» und «gis browser» mit zusammen {tsd(summe(GIS))} Suchen im Monat. Dort will fast jeder zur Karte des Kantons. Dazu kommen die Namen der Anbieter, nach denen Verkäufer suchen: {", ".join(f"{m} {tsd(v(m))}" for m in MARKEN)}. Darauf bieten wir nicht.</p>
<div class="zwei" style="margin-top:5mm">
  <div>
    <h3 style="margin-top:0">Teuer: hier bieten Makler, Portale, Banken</h3>
    {tabelle(['Suchwort', 'Suchen', 'Gebot oben, CHF'], [[esc(w), tsd(v(w)), f'{gebot(w)[0]:.2f} bis {gebot(w)[1]:.2f}'] for w in teuer], rechts=(1, 2))}
  </div>
  <div>
    <h3 style="margin-top:0">Günstig: hier bietet kaum jemand</h3>
    {tabelle(['Suchwort', 'Suchen', 'Gebot oben, CHF'], [[esc(w), tsd(v(w)), f'{gebot(w)[0]:.2f} bis {gebot(w)[1]:.2f}' if gebot(w) else 'keine Gebote'] for w in guenstig], rechts=(1, 2))}
  </div>
</div>
<p class="klein">Gebot oben: was Werbende im unteren und im oberen Bereich für einen Platz über den Suchergebnissen bieten. Laut Datenanbieter in US-Dollar, umgerechnet mit {KURS}. «Keine Gebote» heisst: Google hat zu wenig Werbende für eine Angabe, der Klick kostet dann meist Rappen. Die meisten Themen haben ihre Spitze im März.</p>
""")

google1 = seite(f"""
<p class="ueber">Google Suche</p>
<h2>Die Wörter je Seite</h2>
<p class="grau" style="max-width:160mm">Ein Konto, sieben Kampagnen, jede mit einer Domain und einem Thema. Hinter jedem Wort stehen die Suchen im Monat und, wo es Gebote gibt, das Gebot für einen Platz oben. Passende Wortgruppe («phrase match»), Sprache Deutsch, nur deutschsprachige Kantone.</p>
{''.join(kampagne_block(k) for k in KAMPAGNEN)}
<div class="kasten" style="margin-top:7mm">
  <p><b>Für das ganze Konto ausschliessen:</b> mieten, miete, mietwohnung, wohnung kaufen, haus kaufen, bauland kaufen, ferienwohnung, stelle, job, lehre, ausbildung, gratis inserat, homegate, immoscout, newhome, comparis, deutschland, österreich.</p>
  <p><b>Gebote:</b> Start mit «Klicks maximieren» und einer Obergrenze von CHF 2.50 je Klick (Erbe und Steuer CHF 3, Ausbau CHF 4). Auf «Conversions maximieren» erst umstellen, wenn eine Kampagne 30 Leads gemessen hat. Vorher fehlt Google die Grundlage.</p>
</div>
""")

REST = [
    ['bauzonencheck.ch', 'Zwilling von zonen-check.ch', 'Löst zonen-check.ch nach vier Wochen ab, wenn dessen Anteil an Kontakten schwach ist. Nie beide zugleich bei Google.'],
    ['baurechner24.ch<br>parzellenrechner.ch', 'Zwillinge von ausnuetzung-check.ch', 'Bei Facebook als Check-Anzeige «Wie viel dürfen Sie bauen?» gegeneinander. Bei Google nur als Ersatz.'],
    ['ausbaupotenzial.ch<br>baupotenzialcheck.ch', 'Zwillinge von aufstockungscheck.ch', 'Facebook: Anzeige zum Ratgeber «Aufstocken» führt abwechselnd auf diese Namen.'],
    ['verdichtungscheck.ch', 'Eigenes Thema, kaum Suchen', f'«verdichtung» wird {tsd(v("verdichtung"))} Mal im Monat gesucht. Keine Anzeigen. Bleibt für Gemeinden, die gerade ihre Bauordnung ändern (Anzeige mit Ortsname bei Facebook).'],
    ['parzellencheck24.ch<br>parzellen-check.ch<br>parzellepruefen.ch<br>checkmyparcel.ch', 'Zwillinge von parzellenchecker.ch', 'Facebook: vier Namen, vier Gestaltungen, dieselbe Anzeige. Nach vier Wochen bleibt der Name mit den meisten Kontakten. Dazu kurze Adressen für Inserate.'],
    ['hauswertrechner.ch<br>hauswert24.ch<br>hauswertcheck.ch', 'Thema Hauswert', 'Bei Google zu teuer. Facebook: Check-Anzeige «Was ist Ihr Haus wert?» auf die drei Namen verteilt. Vorsicht im Text: der Check zeigt die Grundlagen, die Einschätzung kommt persönlich.'],
    ['parzellenwert.ch<br>landwert24.ch', 'Thema Landwert', f'«baulandpreise» und «bodenpreise» werden zusammen wenige hundert Mal im Monat gesucht. Kleine Google-Gruppe nur für Zürich und Basel-Landschaft, wo der Check den Baulandpreis der Gemeinde zeigt. Auf parzellenwert.ch, landwert24.ch als Ersatz.'],
    ['eigentuemercheck.ch', 'Für Eigentümer allgemein', 'Adresse für Inserate beim Hauseigentümerverband und für Facebook-Anzeigen ohne bestimmtes Thema.'],
]

rest = seite(f"""
<p class="ueber">Die übrigen Seiten</p>
<h2>Was die anderen sechzehn Domains tun</h2>
<p class="grau" style="max-width:160mm">Google nennt es einen unfairen Vorteil, mit mehreren Konten oder Seiten bei gleichen Suchen dasselbe zu bewerben, und verlangt, dass jede beworbene Seite etwas Eigenes bietet. Darum hat bei Google jedes Thema genau eine Seite. Die Zwillinge arbeiten dort, wo das erlaubt ist und etwas zeigt.</p>
{tabelle(['Domain', 'Rolle', 'Einsatz'], REST)}
<h3>Heizung: kleiner Test auf hauschecker.ch/heizung</h3>
<p>Zum Thema Heizung und Energie wird viel gesucht ({tsd(summe([w for w, g in gruppe.items() if g == 'heizung']))} Suchen im Monat auf 35 Wörtern), aber dort bieten Installateure: «wärmepumpe kosten» hat Wettbewerb 97 von 100. Wer nach der Heizung fragt, will selten verkaufen. Darum nur eine kleine Gruppe auf den Wörtern, die zum Heizungs-Check passen und wenig kosten:
{", ".join(f"{w} ({tsd(v(w))})" for w in ['fernwärme', 'energiefranken', 'gebäudeprogramm', 'ölheizung ersetzen', 'heizungsersatz'])}. Höchstens CHF 5 am Tag, und nur weiterführen, wenn daraus Gespräche werden.</p>
""")

META = [
    ['<b>Ratgeber 60 plus</b><br>keine Sonderkategorie', 'Alter 60 und älter, je Kanton oder PLZ, Deutschschweiz A zuerst', '«Die Kinder sind ausgezogen, das Haus ist geblieben. Fünf Wege, die Eigentümer haben, und was man dafür wissen muss.»', 'hauschecker.ch/ratgeber/haus-zu-gross'],
    ['<b>Ratgeber Erben</b><br>keine Sonderkategorie', 'Alter 45 bis 65, je Kanton', '«Das Elternhaus gehört jetzt allen Geschwistern gemeinsam. Was das Gesetz sagt und welche drei Wege es gibt.»', 'hauschecker.ch/ratgeber/liegenschaft-geerbt'],
    ['<b>Ratgeber Aufstocken</b><br>keine Sonderkategorie', 'Alter 35 bis 60, Eigentümer-Interessen, je Kanton', '«Ein Stockwerk mehr statt umziehen. Wann Aufstocken erlaubt ist und was Sie vorher klären sollten.»', 'hauschecker.ch/ratgeber/aufstocken'],
    ['<b>Check</b><br>Sonderkategorie Wohnraum', 'Kein Alter, keine PLZ. Stadt mit 17 km Umkreis oder Kanton', '«Wie viel dürfte auf Ihrem Grundstück in Uster stehen?» Luftbild des Orts mit eingezeichneter Parzelle.', 'parzellenchecker.ch und seine vier Zwillinge'],
    ['<b>Zweite Anzeige</b><br>Sonderkategorie Wohnraum', 'Wer eine Adresse geprüft und nichts hinterlassen hat', '«Ihre Auswertung ist noch offen. Die Berechnung der Baureserve dauert eine Minute.»', 'dieselbe Seite, mit der geprüften Adresse'],
]

meta = seite(f"""
<p class="ueber">Facebook und Instagram</p>
<h2>Der Hauptkanal: Ratgeber zuerst, Check dahinter</h2>
<p class="grau" style="max-width:160mm">Suchwörter gibt es hier nicht. Was zählt, sind Zielgruppe, Frage und Bild. Meta zählt Tipps rund ums Wohneigentum nicht zur Sonderkategorie Wohnraum, einen Dienst rund um den Wert schon. Darum zwei Arten von Anzeigen.</p>
{tabelle(['Anzeige', 'Zielgruppe', 'Text', 'Führt auf'], META)}
<div class="zwei">
  <div>
    <h3>Regeln, die wir einhalten</h3>
    <ul>
      <li>Der Artikel ist ein echter Ratgeber. Der Check steht darin als Angebot.</li>
      <li>Stuft Meta eine Ratgeber-Anzeige als Wohnraum ein, läuft sie in der Sonderkategorie weiter. Nicht umformulieren, um die Prüfung zu umgehen.</li>
      <li>Keine Check-Anzeigen an eine Zielgruppe, die nur aus den Lesern des Ratgebers 60 plus besteht. Das wäre Alter über einen Umweg.</li>
      <li>Ziel ist die Webseite, nicht das Formular von Meta: nur dort prüft der Eigentümer seine Adresse.</li>
    </ul>
  </div>
  <div>
    <h3>Bild und Ton</h3>
    <ul>
      <li>Ratgeber: ein Einfamilienhaus mit Garten aus der Region, ruhig, ohne Text im Bild. Knopf «Mehr dazu».</li>
      <li>Check: Luftbild der Gemeinde, eine Parzelle eingezeichnet. Man erkennt sein Quartier.</li>
      <li>Immer als Frage, die nur anspricht, wer ein Grundstück hat.</li>
      <li>Nie «neutral» oder «unabhängig» schreiben: wir vermitteln und kaufen selbst.</li>
    </ul>
  </div>
</div>
<h3>Microsoft und Zeitschriften</h3>
<p>Bing hat in der Schweiz 12 % der Suchen. Ab Woche 3 übernehmen wir die zwei besten Google-Kampagnen dorthin, mit einem Zehntel ihres Budgets. Für Zeitlupe und den Zürcher Hauseigentümer holen wir Offerten ein. Jedes Inserat bekommt eine eigene kurze Adresse, zum Beispiel parzellen-check.ch für die Zeitlupe und eigentuemercheck.ch für den Hauseigentümerverband. So sieht man am Lead, woher er kam.</p>
""")

BUDGET = [
    ['Woche 1 und 2', 'CHF 250', 'CHF 75', '', 'CHF 175', '', '<b>CHF 500</b>'],
    ['Woche 3 bis 6', 'CHF 450', 'CHF 150', 'CHF 50', 'CHF 300', 'CHF 50', '<b>CHF 1\'000</b>'],
    ['<b>Sechs Wochen</b>', 'CHF 2\'300', 'CHF 750', 'CHF 200', 'CHF 1\'550', 'CHF 200', '<b>CHF 5\'000</b>'],
]
GOOGLE_TEILUNG = [
    ['Zone', 'zonen-check.ch', 'CHF 6', 'CHF 9'], ['Ausnützung', 'ausnuetzung-check.ch', 'CHF 5', 'CHF 7'], ['Erbe', 'erbliegenschaft.ch', 'CHF 5', 'CHF 8'],
    ['Parzelle', 'parzellenchecker.ch', 'CHF 5', 'CHF 6'], ['Bauen', 'was-kann-ich-bauen.ch', 'CHF 4', 'CHF 5'], ['Ausbau', 'aufstockungscheck.ch', '', 'CHF 4'],
    ['Steuer', 'hauschecker.ch', '', 'CHF 4'],
]

budget = seite(f"""
<p class="ueber">Budget und Ablauf</p>
<h2>Sechs Wochen, CHF 5'000, feste Regeln</h2>
<p class="grau" style="max-width:160mm">Derselbe Rahmen wie im Werbeplan vom 7. November, neu verteilt nach den Suchzahlen. Je Woche:</p>
{tabelle(['', 'Ratgeber', 'Check', 'Zweite Anzeige', 'Google', 'Bing', 'Je Woche'], BUDGET, rechts=(1, 2, 3, 4, 5, 6))}
<div class="zwei">
  <div>
    <h3>Google: Tagesbudget je Kampagne</h3>
    {tabelle(['Kampagne', 'Seite', 'Woche 1, 2', 'Woche 3 bis 6'], GOOGLE_TEILUNG, rechts=(2, 3))}
    <p class="klein">«Ausbau» und «Steuer» starten in Woche 3, «Steuer» erst, wenn der Ratgeber steht.</p>
  </div>
  <div>
    <h3>Reihenfolge</h3>
    <ul>
      <li><b>Woche 0:</b> Impressum, Datenschutz, Konten, Messung, Telefonnummer.</li>
      <li><b>Woche 1 und 2:</b> Deutschschweiz A (ZH, AG, ZG, SZ, SO, SH, LU). Dort steht die Ausnützungsziffer schon im Ergebnis.</li>
      <li><b>Ab Woche 3:</b> Deutschschweiz B dazu, zweite Anzeige, Bing, zwei weitere Google-Kampagnen.</li>
      <li><b>Nach Woche 6:</b> Entscheid je Kanal und Seite.</li>
    </ul>
    <h3>Regeln zum Verschieben</h3>
    <ul>
      <li>Jeden Montag: Kosten je heissem Lead je Seite und Kanal.</li>
      <li>Kampagne mit 150 Klicks ohne Kontakt: stoppen oder Seite tauschen.</li>
      <li>Kanal unter CHF 150 je heissem Lead: Budget verdoppeln. Über CHF 400: stoppen. Dazwischen: Text und Seite verbessern.</li>
    </ul>
  </div>
</div>
<p class="klein">Zum Vergleich: gekaufte Verkäufer-Leads kosten in der Schweiz CHF 30 bis 150 geteilt, 150 bis 400 exklusiv und vorgeprüft (RealAdvisor 2026).</p>
<h3>Messen</h3>
<p>Jeder Link trägt seine Herkunft: <span class="grau">utm_source</span> (google, facebook, bing, zeitlupe), <span class="grau">utm_campaign</span> (zone, ausnuetzung, erbe ...) und bei Lesern des Ratgebers <span class="grau">utm_content=ratgeber-...</span>. Die Seite legt sie mit dem Lead ab, zusammen mit Marke, Domain und den drei Antworten. Der Reiter «Leads» zeigt je Seite Besucher, geprüfte Adressen und Kontakte.</p>
""")

VORHER = [
    ['Impressum: E-Mail und UID', 'Die Postadresse steht seit heute auf jeder Seite. Das Gesetz verlangt auch die E-Mail (UWG Art. 3 Abs. 1 lit. s).', 'Julian'],
    ['Datenschutzerklärung', 'Auftragsbearbeiter und Länder fehlen (Hosting, Datenbank, Google, Meta). DSG Art. 19.', 'Julian, dann bauen wir es ein'],
    ['Werbekonten', 'Google Ads (ein Konto für alle Seiten) und Meta Business mit bestätigter Domain.', 'Julian'],
    ['Messung des Leads', 'Der Meta-Messpunkt ist vorbereitet und lädt erst nach Zustimmung. Für Google fehlt der Messpunkt noch. Ziel ist der abgeschickte Kontakt, nicht der Seitenaufruf.', 'bauen wir, sobald die Konten stehen'],
    ['Telefonnummer', 'Viele Ältere rufen lieber an. Und: innert einer Stunde zurückrufen.', 'Julian'],
    ['Ratgeber Grundstückgewinnsteuer', f'Für die günstigste Verkaufsabsicht bei Google ({tsd(summe(["grundstückgewinnsteuer", "grundstückgewinnsteuer zürich", "grundstückgewinnsteuer berechnen"]))} Suchen im Monat). Mit Quellen wie die anderen vier Artikel.', 'schreiben wir'],
    ['Bilder für Facebook', 'Je Region ein Haus mit Garten, je Gemeinde ein Luftbild mit Parzelle.', 'machen wir aus den Luftbildern des Bundes'],
]
QUELLEN = [
    f'Suchen je Monat und Gebote: Google Ads über DataForSEO (Keyword search volume), Schweiz (Ort 2756), Sprache Deutsch, 377 Wörter, Mittel der letzten zwölf Monate, abgefragt am {STAND}. Die Tabelle wurde Feld für Feld gegen die Rohantwort geprüft.',
    f'Umrechnung: 1 US-Dollar = CHF {KURS} (Devisenkurse Migros Bank und Wise, Mitte November 2026).',
    'Suchmaschinen Schweiz: StatCounter, Oktober 2025 bis Oktober 2026: Google 81,25 %, Bing 11,55 %. gs.statcounter.com/search-engine-market-share/all/switzerland',
    'Google Ads, Richtlinie «Unfairer Vorteil», gelesen am 16. November 2026: support.google.com/adspolicy/answer/15936768',
    'Meta, Werbung für Wohnraum und Einschränkungen der Zielgruppen (abgerufen 7. November 2026): facebook.com/business/help/1198401317374558 und /2220749868045706',
    'Facebook-Konten Schweiz und Alter: NapoleonCat, Juni bis August 2026. napoleoncat.com/stats/facebook-users-in-switzerland',
    'Wohneigentum: Bundesamt für Statistik, 2024: 1,4 Millionen Haushalte im Eigentum (36 %). Gebäude- und Wohnungsstatistik 2025: 1,8 Millionen Gebäude mit Wohnnutzung. Einfamilienhäuser: 1\'000\'700 (BFS, zitiert bei EspaceSuisse).',
    'Zeitlupe, Mediadaten 2026 (46\'776 Exemplare). HEV Zürich, Mediadaten 2026 (57\'056 Exemplare, WEMF 2025).',
    'Preise gekaufter Leads: RealAdvisor 2026, realadvisor.ch/de/pro/blog/immobilien-leads-kaufen. Agenturwerte für Einblendungen: digitalm.ch.',
    'Regionen, Rechtliches und Ablauf nach dem Lead: Werbeplan vom 7. November 2026 (docs/werbeplan-eigentuemer.md).',
]

vorher = seite(f"""
<p class="ueber">Vor dem ersten Franken</p>
<h2>Was noch fehlt</h2>
{tabelle(['Was', 'Warum', 'Wer'], VORHER)}
<h3>Was dieser Plan nicht weiss</h3>
<p>Wie viele Besucher aus Anzeigen eine Adresse prüfen und ihren Kontakt hinterlassen, zeigt erst der Test. Der Reiter «Leads» zählt es je Seite ab dem ersten Klick. Suchzahlen unter 50 im Monat rundet Google grob. Für «zonenplan» mit Ortsname haben wir erst wenige Orte abgefragt; die ganze Liste wäre der nächste Schritt für die Gemeinde-Seiten.</p>
<h3>Quellen</h3>
<ul class="quellen">{''.join(f'<li>{esc(q)}</li>' for q in QUELLEN)}</ul>
""")

HTML = f"""<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><title>Kampagnenplan Check-Seiten, {STAND}</title><style>{CSS}</style></head>
<body>{titel}{empfehlung}{analyse}{nachfrage}{google1}{rest}{meta}{budget}{vorher}</body></html>"""

import re
marken_pfad = DIR.parent.parent / 'src/lib/check-marken.ts'
marken_ts = (marken_pfad if marken_pfad.exists() else __import__('pathlib').Path('/home/user/akquise/src/lib/check-marken.ts')).read_text(encoding='utf-8')
GEKAUFT = set(re.findall(r"'([a-z0-9-]+\.ch)'", marken_ts[marken_ts.index('export const GEKAUFT'):marken_ts.index('export const STANDARD_MARKE')]))
im_plan = [k['domain'] for k in KAMPAGNEN] + [d for z in REST for d in z[0].split('<br>')]
assert len(GEKAUFT) == 23 and sorted(im_plan) == sorted(GEKAUFT), (sorted(GEKAUFT - set(im_plan)), sorted(set(im_plan) - GEKAUFT), len(im_plan))
for wort in ['parzelle prüfen', 'haus zu gross']:
    assert vol[wort]['search_volume'] == '', wort
for wort in ['was darf ich bauen', 'hauswert rechner', 'grundstückswert berechnen', 'haus geerbt']:
    assert v(wort) == 10, (wort, v(wort))

(DIR / 'kampagnenplan.html').write_text(HTML, encoding='utf-8')
print('Anteil günstig', GUENSTIG_ANTEIL, 'ohne Gebot', OHNE_GEBOT_ANTEIL, 'Erbe max', round(ERBE_MAX, 2), 'Steuer', summe(STEUER), round(hoechstes(STEUER), 2))
print('Google-Wörter', len(alle_google), 'Summe', GOOGLE_SUMME)
for k in KAMPAGNEN:
    g = [gebot(x)[1] for x in k['woerter'] if gebot(x)]
    print(f"  {k['kurz']:11} {k['domain']:24} {int(summe(k['woerter'])):6}  Gebot oben bis {max(g) if g else 0:.2f}  ({len(g)} von {len(k['woerter'])} mit Gebot)")
for z in THEMEN_ZEILEN:
    print('  Thema', z)
print('Bewertung', gebot('immobilienbewertung'), 'haus verkaufen', gebot('haus verkaufen'))

# Bausteine des Kampagnenplans: Daten lesen, Gestaltung, Diagramm, Tabellen.
# Der Inhalt selbst steht in plan.py.
import csv, html, pathlib

DIR = pathlib.Path(__file__).parent
esc = html.escape


def lesen(name):
    """TSV als Liste von Zeilen; fehlt die Datei, eine leere Liste."""
    p = DIR / name
    if not p.exists():
        return []
    with p.open(encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f, delimiter='\t'))


def zahl(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def tsd(n):
    """1234567 -> 1'234'567 (Schweizer Schreibweise)."""
    if n is None:
        return '–'
    return f'{int(round(n)):,}'.replace(',', "'")


def geld(x, stellen=2):
    return '–' if x is None else f'{x:.{stellen}f}'


CSS = """
@page { size: A4; margin: 18mm 17mm 18mm 17mm; }
* { box-sizing: border-box; }
html { font-family: 'Inter', system-ui, sans-serif; font-size: 9.4pt; line-height: 1.5; color: #15181c;
       font-feature-settings: 'tnum' 1, 'ss01' 1; -webkit-font-smoothing: antialiased; }
body { margin: 0; overflow-wrap: break-word; }
h1 { font-family: 'Inter Display', 'Inter', sans-serif; font-size: 30pt; line-height: 1.08; letter-spacing: -0.025em; font-weight: 600; margin: 0 0 6mm; }
h2 { font-family: 'Inter Display', 'Inter', sans-serif; font-size: 17pt; line-height: 1.15; letter-spacing: -0.02em; font-weight: 600; margin: 0 0 3.5mm; }
h3 { font-size: 10.4pt; font-weight: 600; letter-spacing: -0.005em; margin: 6mm 0 1.6mm; }
p { margin: 0 0 2.6mm; }
.grau { color: #5b636d; }
.klein { font-size: 8pt; color: #5b636d; line-height: 1.45; overflow-wrap: anywhere; }
.ueber { font-size: 7.6pt; letter-spacing: 0.09em; text-transform: uppercase; color: #0E5A4E; font-weight: 600; margin: 0 0 2.2mm; }
.seite { break-before: page; }
.seite:first-child { break-before: auto; }
.weiter { margin-top: 11mm; padding-top: 6mm; border-top: 0.6pt solid #15181c; }
.weiter h2 { break-after: avoid; }
.lead { font-size: 12pt; line-height: 1.45; color: #2b3138; max-width: 150mm; }
.titelseite { height: 250mm; display: flex; flex-direction: column; justify-content: space-between; }
.titelseite .unten { border-top: 0.4pt solid #cfd4d9; padding-top: 4mm; display: flex; justify-content: space-between; }
.kern { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 7mm; border-top: 0.4pt solid #cfd4d9; margin: 7mm 0 0; padding-top: 4.5mm; }
.kern div b { display: block; font-family: 'Inter Display', 'Inter', sans-serif; font-size: 19pt; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; }
.kern div span { display: block; font-size: 8pt; color: #5b636d; margin-top: 1mm; line-height: 1.4; }
ol.schritte { margin: 0; padding: 0; list-style: none; counter-reset: s; }
ol.schritte li { counter-increment: s; display: grid; grid-template-columns: 8mm 1fr; padding: 2.6mm 0; border-top: 0.4pt solid #e2e5e8; break-inside: avoid; }
ol.schritte li::before { content: counter(s); font-family: 'Inter Display', 'Inter', sans-serif; font-size: 13pt; font-weight: 600; color: #0E5A4E; line-height: 1.15; }
ol.schritte li b { font-weight: 600; }
table { width: 100%; border-collapse: collapse; margin: 1.5mm 0 4mm; font-size: 8.4pt; line-height: 1.4; }
th { text-align: left; font-weight: 600; font-size: 7.3pt; letter-spacing: 0.05em; text-transform: uppercase; color: #5b636d; padding: 0 2.5mm 1.6mm 0; border-bottom: 0.6pt solid #15181c; vertical-align: bottom; }
td { padding: 1.7mm 2.5mm 1.7mm 0; border-bottom: 0.4pt solid #e2e5e8; vertical-align: top; }
th.r, td.r { text-align: right; padding-right: 0; padding-left: 2.5mm; white-space: nowrap; }
td.r + td, th.r + th { padding-left: 4mm; }
tr { break-inside: avoid; }
td b { font-weight: 600; }
.urteil { font-weight: 600; white-space: nowrap; }
.kasten { border-left: 2pt solid #0E5A4E; padding: 0.5mm 0 0.5mm 4.5mm; margin: 4mm 0 5mm; break-inside: avoid; }
.kasten p:last-child { margin-bottom: 0; }
.zwei { display: grid; grid-template-columns: 1fr 1fr; gap: 0 9mm; }
.domain { break-inside: avoid; border-top: 0.6pt solid #15181c; padding-top: 3mm; margin-top: 6mm; }
.domain h3 { margin: 0 0 0.8mm; font-size: 11.5pt; }
.domain .rolle { font-size: 8pt; color: #5b636d; margin: 0 0 2.4mm; }
.woerter { margin: 0 0 2.2mm; }
.woerter span { display: inline-block; white-space: nowrap; margin: 0 3.2mm 0.6mm 0; }
.woerter span i { font-style: normal; color: #5b636d; font-size: 7.6pt; margin-left: 1mm; }
.woerter span.rest { display: inline; white-space: normal; color: #5b636d; }
.anzeige { background: #f4f5f3; padding: 2.6mm 3.4mm; margin: 2mm 0 0; font-size: 8.4pt; break-inside: avoid; }
.anzeige .t { color: #1a4fb3; font-weight: 500; font-size: 9.4pt; }
.anzeige .u { color: #1c6b3c; font-size: 7.6pt; }
ul { margin: 0 0 3mm; padding-left: 4.2mm; }
li { margin: 0 0 1.1mm; }
.quellen li { font-size: 7.8pt; color: #3d444c; word-break: break-word; }
svg text { font-family: 'Inter', sans-serif; }
"""


def balken(zeilen, einheit='', breite=176, max_wert=None, zusatz=None):
    """Rangliste als waagrechte Balken: ein Farbton, Wert an der Spitze,
    Balken höchstens 5 mm dick, rundes Ende, eckig an der Grundlinie.
    zeilen: [(Name, Wert, Zusatztext)]. Masse in mm."""
    namen_b, wert_b = 48, 74
    platz = breite - namen_b - wert_b
    hoch = 7.6
    mx = max_wert or max(w for _, w, *_ in zeilen) or 1
    h = hoch * len(zeilen) + 2
    t = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{breite}mm" height="{h}mm" viewBox="0 0 {breite} {h}" role="img">']
    t.append(f'<line x1="{namen_b}" y1="0" x2="{namen_b}" y2="{h - 1}" stroke="#cfd4d9" stroke-width="0.25"/>')
    for i, z in enumerate(zeilen):
        name, w = z[0], z[1]
        extra = z[2] if len(z) > 2 else ''
        y = i * hoch + 1.6
        b = max(0.6, platz * w / mx)
        r = min(1.2, b / 2)
        t.append(f'<text x="{namen_b - 2.5}" y="{y + 3.3}" text-anchor="end" font-size="3" fill="#15181c">{esc(name)}</text>')
        # Rechteck mit rundem Datenende, eckig an der Grundlinie.
        t.append(f'<path d="M{namen_b},{y} h{b - r} a{r},{r} 0 0 1 {r},{r} v{4.4 - 2 * r} a{r},{r} 0 0 1 -{r},{r} h-{b - r} z" fill="#0E5A4E"/>')
        t.append(f'<text x="{namen_b + b + 1.8}" y="{y + 3.3}" font-size="3" font-weight="600" fill="#15181c">{tsd(w)}{esc(einheit)}'
                 + (f'<tspan font-weight="400" fill="#5b636d">  {esc(extra)}</tspan>' if extra else '') + '</text>')
    t.append('</svg>')
    return ''.join(t)


def tabelle(kopf, zeilen, rechts=()):
    """kopf: Spaltentitel; zeilen: Listen aus HTML-Zellen; rechts: Indizes rechtsbündiger Spalten."""
    k = lambda i: ' class="r"' if i in rechts else ''
    t = ['<table><thead><tr>', *[f'<th{k(i)}>{x}</th>' for i, x in enumerate(kopf)], '</tr></thead><tbody>']
    for z in zeilen:
        t.append('<tr>' + ''.join(f'<td{k(i)}>{x}</td>' for i, x in enumerate(z)) + '</tr>')
    t.append('</tbody></table>')
    return ''.join(t)

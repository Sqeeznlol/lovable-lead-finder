"""
Liegenschaftsinventare aus Jahresberichten von Immobilienfonds und
Anlagestiftungen lesen (Julian, 8. November: "alle regulierten Gefässe
... veröffentlichen im Jahresbericht alle Infos über alle Liegenschaften").

    python3 -I tools/fonds_inventar.py <fonds-liste.csv> <pdf-ordner> <ausgabe.csv> <bericht.txt>

fonds-liste.csv: name,typ,verwalter,berichtsdatum,sprache,pdf_url,...
Die PDF werden in <pdf-ordner> zwischengespeichert (Name aus der URL).

Warum ein eigener Leser und nicht ein Tabellenwerkzeug: Jeder Bericht
setzt die Tabelle anders (Ort und Adresse in einer oder zwei Spalten,
Adressen über zwei Zeilen, Tausender mit Leerschlag oder Apostroph,
Baujahr vor oder ohne Renovation). pdftotext -layout behält die Spalten;
erkannt wird eine Liegenschaft daran, dass ihre Zeile zwei Beträge ab
CHF 100'000 trägt (Gestehungskosten und Verkehrswert, in dieser
Reihenfolge, so verlangt es die KKV-FINMA).

Kontrolle statt Vertrauen: Für jeden Bericht wird die Summe der
gelesenen Verkehrswerte mit den Totalzeilen des Berichts verglichen.
Stimmt sie nicht auf 1 %, steht das im Bericht -- ganz lesen.
"""
import csv, hashlib, os, re, subprocess, sys, urllib.request

# Ein Betrag nutzt durchgehend dasselbe Trennzeichen: "121’646’678 131’030’000" sind zwei Beträge.
ZAHL = re.compile(r"(?<![\d,.’'])(?:\d{1,3}(?:’\d{3})+|\d{1,3}(?:'\d{3})+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?![\d,’'])")
JAHR = re.compile(r"\b(1[5-9]\d\d|20[0-3]\d)\b")
KOPF = re.compile(r"Ort,? +Adresse|Gemeinde +Adresse|Ort +Strasse|Liegenschaftsverzeichnis|Inventar der Liegenschaften|Inventaire des immeubles|Localit[ée],? +adresse|Commune +Adresse", re.I)
# Ein blosses "Total" mit Beträgen schliesst die Tabelle auch (SRPF); "Total Wohnbauten" nicht.
ENDE = re.compile(r"^(Gesamttotal|Total g[ée]n[ée]ral|Total Liegenschaften|Total Grundst|Total\s{2,})", re.I)
TOTAL = re.compile(r"^(Gesamt)?total|^Total|^Sous-total|^Zwischentotal|^Summe", re.I)
NICHT = re.compile(r"hypothek|darlehen|kredit|festvorsch|zinssatz|laufzeit|verbindlichkeit|bewertung|r[ée]partition|anteil", re.I)
SPALTE = re.compile(r"Verkehrs-?\s*wert|Gestehungs|Einstand|valeur v[ée]nale|prix de revient|Marktwert", re.I)
EIGENTUM = re.compile(r",?\s*(Alleineigentum|Miteigentum|Stockwerkeigentum|Baurecht|propri[ée]t[ée] (individuelle|par [ée]tages)|copropri[ée]t[ée])\b.*$", re.I)
ART = re.compile(r"^(Wohnbauten|Wohnliegenschaften|Gemischte Bauten|Kommerziell[a-z ]*|Gesch[äa]ftsliegenschaften|Bauland[a-z ,]*|Angefangene Bauten[a-z ,]*|Immeubles d.habitation|Immeubles commerciaux|Immeubles mixtes|Wohnen|Gemischt|Gewerbe)\b", re.I)


def betrag(t):
    return int(re.sub(r"\D", "", t))


def hole(url, ordner):
    pfad = os.path.join(ordner, hashlib.sha1(url.encode()).hexdigest()[:16] + ".pdf")
    if not os.path.exists(pfad):
        r = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Bauraum Fondsinventar)"})
        with urllib.request.urlopen(r, timeout=120) as a, open(pfad, "wb") as f:
            f.write(a.read())
    txt = pfad[:-4] + ".txt"
    if not os.path.exists(txt):
        subprocess.run(["pdftotext", "-layout", pfad, txt], check=True, capture_output=True)
    return open(txt, encoding="utf8", errors="replace").read().splitlines()


def lesen(zeilen):
    """Liefert (liegenschaften, totale): je Liegenschaft name, baujahr, gestehung, verkehrswert, sollmiete."""
    aus, totale = [], []
    drin = False
    warte = 0  # Zeilen nach einem Tabellentitel, in denen die Spaltenköpfe kommen müssen
    text_davor = []  # Textzeilen seit der letzten Liegenschaft (mehrzeilige Adressen)
    for i, z in enumerate(zeilen):
        roh = z.strip()
        # Ein Tabellentitel zählt nur, wenn in seiner Nähe die Spalten
        # Verkehrswert oder Gestehungskosten stehen: Inhaltsverzeichnis und
        # Kennzahlen nennen "Inventar der Liegenschaften" auch.
        if KOPF.search(z):
            warte, text_davor = 6, []
            # Spaltenköpfe stehen je nach Bericht über oder unter dem Titel.
            if SPALTE.search(" ".join(zeilen[max(0, i - 4): i + 1])):
                drin, warte = True, 0
            continue
        if warte:
            warte -= 1
            if SPALTE.search(z):
                drin, warte, text_davor = True, 0, []
            continue
        if not drin or not roh:
            continue
        grosse = [m for m in ZAHL.finditer(z) if betrag(m.group()) >= 100_000]
        if TOTAL.match(roh):
            totale += [betrag(m.group()) for m in grosse]
            text_davor = []
            if ENDE.match(roh):
                drin = False
            continue
        if len(grosse) < 2:
            # Reine Textzeile: Teil einer Adresse oder Zwischentitel.
            if not ZAHL.search(z) and not ART.match(roh) and len(roh) < 90 and not NICHT.search(roh) \
                    and re.search(r"[A-Za-zÄÖÜäöüéèàç]{3,}", roh):
                # Alle Textspalten ohne Kantonskürzel: "GE  Genf  Rue de Lyon 71" -> "Genf, Rue de Lyon 71".
                spalten = [t for t in re.split(r"\s{2,}", roh) if not re.fullmatch(r"[A-Z]{2}", t)]
                text_davor.append(", ".join(spalten[:2]))
                text_davor = text_davor[-2:]
            else:
                text_davor = []
            continue
        if NICHT.search(roh) or re.search(r"\bverkauft\b|\bvendu|, CHF\b", roh, re.I):
            text_davor = []
            continue
        links = z[: grosse[0].start()]
        teile = [t for t in re.split(r"\s{2,}", links.strip()) if t]
        # Spalten vor den Beträgen: Ort, Adresse, Kanton, Baujahr, Eigentumsform ...
        worte = [t for t in teile if re.search(r"[A-Za-zÄÖÜäöüéèàç]{3,}", t) and not ART.match(t)
                 and not re.fullmatch(r"(AE|ME|STWE|BR|Alleineigentum|Miteigentum|Stockwerkeigentum|Baurecht|Gemischt|Wohnbauten|Gewerbe)", t, re.I)]
        name = ", ".join(worte[:2]) if worte else ""
        if text_davor and (not name or name[0].islower() or text_davor[-1].rstrip().endswith((",", "/"))):
            name = (" ".join(text_davor) + " " + name).strip()
        elif not name and text_davor:
            name = text_davor[-1]
        name = EIGENTUM.sub("", name)
        name = re.sub(r"(\d[\w/–-]*)\s+\d(?:,\s*\d)*$", r"\1", name).strip(" ,")  # Fussnotenziffern
        jahr = JAHR.search(links)
        gest, wert = betrag(grosse[0].group()), betrag(grosse[1].group())
        rest = [betrag(m.group()) for m in ZAHL.finditer(z[grosse[1].end():]) if betrag(m.group()) >= 10_000]
        if name and re.match(r"[A-ZÄÖÜÉÈÂ]", name):
            aus.append({"name": name, "baujahr": jahr.group() if jahr else "", "gestehung": gest,
                        "verkehrswert": wert, "sollmiete": rest[0] if rest else ""})
        text_davor = []
    return aus, totale


def main():
    liste, ordner, ziel, bericht = sys.argv[1:5]
    os.makedirs(ordner, exist_ok=True)
    w = csv.writer(open(ziel, "w", newline="", encoding="utf8"))
    w.writerow(["gefaess", "typ", "berichtsdatum", "ort_adresse", "baujahr", "gestehung", "verkehrswert", "sollmiete", "brutto_rendite", "quelle"])
    b = open(bericht, "w", encoding="utf8")
    gut = n_ges = 0
    for f in csv.DictReader(open(liste, encoding="utf8")):
        if not f.get("pdf_url"):
            b.write(f"OHNE PDF  {f['name']}\n")
            continue
        try:
            ls, totale = lesen(hole(f["pdf_url"], ordner))
        except Exception as e:
            b.write(f"FEHLER    {f['name']}: {str(e)[:120]}\n")
            continue
        summe = sum(x["verkehrswert"] for x in ls)
        treffer = [t for t in totale if t and abs(summe - t) / t <= 0.01]
        naechst = min(totale, key=lambda t: abs(summe - t)) if totale else 0
        stimmt = bool(treffer)
        gut += stimmt
        n_ges += len(ls)
        b.write(f"{'OK' if stimmt else 'ABWEICHUNG':10}{f['name']}: {len(ls)} Liegenschaften, Summe {summe:,} "
                f"{'= Total' if stimmt else f'vs. nächstes Total {naechst:,}'}\n".replace(",", "'").replace("' Summe", ", Summe"))
        for x in ls:
            r = round(x["sollmiete"] / x["verkehrswert"] * 100, 2) if x["sollmiete"] and x["verkehrswert"] else ""
            w.writerow([f["name"], f.get("typ", ""), f.get("berichtsdatum", ""), x["name"], x["baujahr"], x["gestehung"],
                        x["verkehrswert"], x["sollmiete"], r, f["pdf_url"]])
    b.write(f"\nGefässe mit Summe = Total: {gut}\nLiegenschaften gelesen: {n_ges}\n")
    print(open(bericht, encoding="utf8").read().splitlines()[-2:])


if __name__ == "__main__":
    main()

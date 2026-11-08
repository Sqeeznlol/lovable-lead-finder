"""
Liegenschaften aus tools/fonds_inventar.py verorten: Adresse -> LV95,
Gemeinde, Kanton und EGRID der Parzelle, über die Dienste des Bundes
(api3.geo.admin.ch), wie die Check-Seiten.

    python3 -I tools/fonds_verorten.py <inventar.csv> <verortet.csv>

Gesucht wird mit der ersten Hausnummer ("Hofjüngerstrasse 26 / 28 / 30"
-> 26) und dem Ort. Der Treffer zählt nur, wenn Strasse und Ort im
Vorschlag wiederkommen; sonst bleibt die Zeile ohne Lage und steht im
Protokoll -- lieber keine Lage als eine falsche.
"""
import csv, json, re, sys, time, unicodedata, urllib.parse, urllib.request

API = "https://api3.geo.admin.ch/rest/services"


def norm(s):
    s = s.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
    s = unicodedata.normalize("NFD", s)
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn")).strip()


def hole(url):
    for versuch in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Bauraum Fondsinventar"}), timeout=40) as a:
                return json.load(a)
        except Exception:
            time.sleep(1.5 * (versuch + 1))
    return {}


# Berichte auf Deutsch nennen Westschweizer Orte deutsch; der Bund führt sie in der Ortssprache.
EXONYM = {"Genf": "Genève", "Freiburg": "Fribourg", "Neuenburg": "Neuchâtel", "Sitten": "Sion", "Delsberg": "Delémont",
          "Siders": "Sierre", "Pruntrut": "Porrentruy", "Murten": "Murten", "Biel": "Biel/Bienne", "Bienne": "Biel/Bienne"}


def zerlegen(ort_adresse):
    """"Basel, Birsigstrasse 80 / 82, Bachlettenstrasse 13" -> ("Basel", "Birsigstrasse", "80")."""
    teile = [t.strip() for t in ort_adresse.split(",")]
    ort, rest = teile[0], ", ".join(teile[1:])
    ort = re.sub(r"\s*\((?:[A-Z]{2})\)$", "", re.sub(r"-(Nord|Süd|Ost|West|Zentrum).*$", "", ort))
    ort = EXONYM.get(ort, ort)
    rest = rest.replace("’", "'")
    m = re.match(r"(.+?)\s+(\d+[a-z]?)\b", rest)
    if not m:
        return ort, rest.strip(), ""
    return ort, m.group(1).strip(), m.group(2)


def suchen(ort, strasse, nr):
    q = urllib.parse.quote(f"{strasse} {nr} {ort}".strip())
    j = hole(f"{API}/ech/SearchServer?type=locations&origins=address&limit=5&sr=2056&lang=de&searchText={q}")
    for r in j.get("results", []):
        a = r.get("attrs", {})
        lab = norm(re.sub(r"<[^>]+>", "", a.get("label", "")))
        # Mit der Strasse muss der Ort oder seine Postleitzahl-Ortschaft passen.
        if norm(strasse).split()[-1] in lab and any(w in lab for w in norm(ort).split()[:1]):
            return a.get("y"), a.get("x"), re.sub(r"<[^>]+>", "", a.get("label", ""))
    return None


def am_punkt(e, n, ebene):
    q = urllib.parse.urlencode({"geometryType": "esriGeometryPoint", "geometry": f"{e},{n}", "sr": "2056", "tolerance": "0",
                                "returnGeometry": "false", "layers": f"all:{ebene}", "mapExtent": f"{e-100},{n-100},{e+100},{n+100}",
                                "imageDisplay": "400,400,96", "lang": "de"})
    j = hole(f"{API}/all/MapServer/identify?{q}")
    return (j.get("results") or [{}])[0].get("attributes", {})


def main():
    quelle, ziel = sys.argv[1:3]
    zeilen = list(csv.DictReader(open(quelle, encoding="utf8")))
    felder = list(zeilen[0].keys()) + ["gemeinde", "kanton", "e", "n", "egrid", "treffer"]
    w = csv.DictWriter(open(ziel, "w", newline="", encoding="utf8"), fieldnames=felder)
    w.writeheader()
    gut = 0
    for i, z in enumerate(zeilen):
        ort, strasse, nr = zerlegen(z["ort_adresse"])
        t = suchen(ort, strasse, nr) if strasse else None
        z.update({"gemeinde": "", "kanton": "", "e": "", "n": "", "egrid": "", "treffer": ""})
        if t and t[0]:
            e, n, lab = float(t[0]), float(t[1]), t[2]
            g = am_punkt(e, n, "ch.swisstopo.swissboundaries3d-gemeinde-flaeche.fill")
            p = am_punkt(e, n, "ch.kantone.cadastralwebmap-farbe")
            egrid = p.get("egris_egrid") or ""
            z.update({"gemeinde": g.get("gemname", ""), "kanton": g.get("kanton", ""), "e": round(e, 1), "n": round(n, 1),
                      "egrid": egrid if re.fullmatch(r"CH[0-9A-Z]{12}", egrid or "") else "", "treffer": lab})
            gut += 1
        else:
            print("ohne Lage:", z["gefaess"][:30], "|", z["ort_adresse"])
        w.writerow(z)
        if (i + 1) % 50 == 0:
            print(f"{i + 1} von {len(zeilen)}, verortet {gut}", flush=True)
    print(f"Verortet: {gut} von {len(zeilen)}")


if __name__ == "__main__":
    main()

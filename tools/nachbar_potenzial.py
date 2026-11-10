"""
Nachbarparzellen eines Kundenportfolios auf Potenzial prüfen (Julian,
10. November: "mit dem Helvetica-Fonds eine Übersicht, welche die
Nachbarparzellen sind, damit wir sehen, welche Potenzial haben").

    python3 -I tools/nachbar_potenzial.py <migration-mit-positionen.sql> <portfolio> <ausgabe.csv> <ausgabe.sql>

Die Positionen und ihre Nachbar-EGRIDs stehen in der Migration, die
tools/fondsliste_migration.cjs gebaut hat (Zeilen "(nr, 'hsl', 'Adresse',
'EGRID', e, n, Fläche, 'Gemeinde', 'KT', array[...])").

Je Nachbarparzelle beim Bund, für jeden Kanton gleich:
  * Umriss und Nummer (Amtliche Vermessung, ch.kantone.cadastralwebmap-farbe)
  * Bauzone am Mittelpunkt (ch.are.bauzonen, harmonisiert)
  * Gebäude im Umriss (GWR): Baujahr, Geschosse, Grundfläche, Wohnungen

Warum das Arrondieren so wertvoll ist: Zwei Parzellen zusammen erlauben
oft mehr als beide einzeln (Grenzabstände fallen weg, Arealüberbauung
ab einer Mindestfläche). Eine Nachbarparzelle mit altem, niedrigem
Gebäude in der Bauzone ist darum für den Eigentümer nebenan mehr wert
als für jeden anderen Käufer.
"""
import csv, json, math, re, sys, time, urllib.parse, urllib.request

API = "https://api3.geo.admin.ch/rest/services"
BAUZONE_GUT = re.compile(r"Wohn|Misch|Zentrum|Kern", re.I)


class KeineAntwort(Exception):
    """Der Bund hat nicht geantwortet. Nie als «leer» werten: Wattwil
    Müller-Friedberg-Strasse 5 kam so als Parzelle ohne Gebäude heraus."""


def hole(url, daten=None):
    for versuch in range(3):
        try:
            r = urllib.request.Request(url, data=daten, headers={"User-Agent": "Bauraum Nachbarpotenzial"})
            with urllib.request.urlopen(r, timeout=30) as a:  # lieber neu fragen als hängen: ein Lauf stand mit 60 s 12 min still
                return json.load(a)
        except Exception:
            time.sleep(1.5 * (versuch + 1))
    raise KeineAntwort(url.split("?")[0])


def flaeche(ring):
    return abs(sum(ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1] for i in range(len(ring) - 1))) / 2


def mitte(ring):
    """Schwerpunkt des Umrisses; bei einem Umriss mit Einbuchtung kann er
    ausserhalb liegen, für die Zone genügt er fast immer."""
    a = cx = cy = 0.0
    for i in range(len(ring) - 1):
        k = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
        a += k; cx += (ring[i][0] + ring[i + 1][0]) * k; cy += (ring[i][1] + ring[i + 1][1]) * k
    if abs(a) < 1e-6:
        return ring[0]
    return [cx / (3 * a), cy / (3 * a)]


def parzelle(egrid):
    q = urllib.parse.urlencode({"layer": "ch.kantone.cadastralwebmap-farbe", "searchField": "egris_egrid", "searchText": egrid,
                                "returnGeometry": "true", "geometryFormat": "geojson", "sr": "2056"})  # mit contains=false antwortet der Dienst nach 90 s mit 504
    # Ohne contains=false sucht der Dienst "enthält": nur die exakte EGRID zählt.
    r = next((x for x in hole(f"{API}/all/MapServer/find?{q}").get("results", []) if x["properties"].get("egris_egrid") == egrid), None)
    if not r:
        return None
    g = r["geometry"]
    ringe = [g["coordinates"][0]] if g["type"] == "Polygon" else [p[0] for p in g["coordinates"]]
    return {"nummer": r["properties"].get("number"), "kanton": r["properties"].get("ak"), "ringe": ringe}


def am_punkt(e, n, ebene):
    q = urllib.parse.urlencode({"geometryType": "esriGeometryPoint", "geometry": f"{e},{n}", "sr": "2056", "tolerance": "0",
                                "returnGeometry": "false", "layers": f"all:{ebene}", "mapExtent": f"{e-100},{n-100},{e+100},{n+100}",
                                "imageDisplay": "400,400,96", "lang": "de"})
    return (hole(f"{API}/all/MapServer/identify?{q}").get("results") or [{}])[0].get("attributes", {})


def innen(pt, ring):
    x, y, drin = pt[0], pt[1], False
    for i in range(len(ring) - 1):
        (x1, y1), (x2, y2) = ring[i][:2], ring[i + 1][:2]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            drin = not drin
    return drin


def gebaeude(egrid, ringe):
    """Gebäude über die EGRID und über die Lage im Umriss: Das GWR führt
    nicht bei jedem Gebäude die EGRID der Parzelle (Zollikofen 301 kam so
    als «unbebaut» heraus, obwohl Häuser darauf stehen)."""
    q = urllib.parse.urlencode({"layer": "ch.bfs.gebaeude_wohnungs_register", "searchField": "egrid", "searchText": egrid,
                                "contains": "false", "returnGeometry": "false", "lang": "de"})
    aus = {}
    for x in hole(f"{API}/ech/MapServer/find?{q}").get("results", []):
        a = x.get("attributes", {})
        if a.get("egrid") == egrid:
            aus[a.get("egid")] = a
    for ring in ringe:
        xs, ys = [p[0] for p in ring], [p[1] for p in ring]
        box = f"{min(xs)},{min(ys)},{max(xs)},{max(ys)}"
        q = urllib.parse.urlencode({"geometryType": "esriGeometryEnvelope", "geometry": box, "sr": "2056", "tolerance": "0",
                                    "returnGeometry": "true", "geometryFormat": "geojson", "layers": "all:ch.bfs.gebaeude_wohnungs_register",
                                    "mapExtent": box, "imageDisplay": "400,400,96", "lang": "de"})
        for x in hole(f"{API}/all/MapServer/identify?{q}").get("results", []):
            g = x.get("geometry") or {}
            if g.get("type") == "Point" and innen(g["coordinates"], ring):
                a = x.get("properties", {})
                aus.setdefault(a.get("egid"), a)
    return [a for a in aus.values() if a.get("gstat") not in (1007, 1008)]  # abgebrochen, nicht realisiert


def kompaktheit(ring):
    """1 für einen Kreis, gegen 0 für einen Streifen: Strassen, Wege und
    Bäche sind eigene Parzellen und grenzen fast überall an."""
    u = sum(math.dist(ring[i][:2], ring[i + 1][:2]) for i in range(len(ring) - 1))
    return 4 * math.pi * flaeche(ring) / u ** 2 if u else 0


def bewerten(z, haupt_flaeche):
    """Punkte 0 bis 100 mit Gründen, damit man sieht, warum."""
    gruende, p = [], 0
    if not z["zone"] or not BAUZONE_GUT.search(z["zone"]):
        return 0, ["nicht in Wohn-, Misch- oder Zentrumszone" if z["zone"] else "ausserhalb der Bauzone"]
    if z["flaeche"] < 150:
        return 0, ["Splitter unter 150 m²"]
    if z["kompakt"] < 0.2:  # Basel 9144 (0,18) und Birr 627 (0,17) sind Strassen
        return 0, ["schmaler Streifen: Strasse, Weg oder Bach"]
    if not z["gebaeude"]:
        p += 50; gruende.append("unbebaut in der Bauzone")
    else:
        if z["baujahr"] and z["baujahr"] < 1960:
            p += 25; gruende.append(f"Gebäude von {z['baujahr']}")
        elif z["baujahr"] and z["baujahr"] < 1975:
            p += 15; gruende.append(f"Gebäude von {z['baujahr']}")
        if z["az_heute"] is not None and z["az_heute"] < 0.4:
            p += 20; gruende.append(f"Grundfläche × Geschosse nur {z['az_heute']:.2f} der Parzelle")
        elif z["az_heute"] is not None and z["az_heute"] < 0.6:
            p += 10; gruende.append(f"Grundfläche × Geschosse {z['az_heute']:.2f} der Parzelle")
        if z["wohnungen"] and z["wohnungen"] <= 2:
            p += 10; gruende.append("ein bis zwei Wohnungen: wenige Eigentümer, schneller Entscheid")
    if z["flaeche"] >= 800:
        p += 10; gruende.append(f"{z['flaeche']:,.0f} m² gross".replace(",", "'"))
    if haupt_flaeche and z["flaeche"] + haupt_flaeche >= 3000:
        p += 10; gruende.append(f"zusammen {z['flaeche'] + haupt_flaeche:,.0f} m²: Arealüberbauung denkbar".replace(",", "'"))
    return min(p, 100), gruende


def pruefen(eg):
    try:
        return pruefen_roh(eg)
    except KeineAntwort:
        return None  # bleibt offen und wird beim nächsten Lauf neu gefragt


def pruefen_roh(eg):
    par = parzelle(eg)
    if not par:
        return None
    ring = max(par["ringe"], key=flaeche)
    fl = round(sum(flaeche(r) for r in par["ringe"]))
    m = mitte(ring)
    zone = am_punkt(m[0], m[1], "ch.are.bauzonen")
    geb = gebaeude(eg, par["ringe"])
    jahre = [a["gbauj"] for a in geb if a.get("gbauj")]
    gf = sum((a.get("garea") or 0) * (a.get("gastw") or 1) for a in geb)
    return {"nummer": par["nummer"], "kanton": par["kanton"], "gemeinde": zone.get("name") or "", "zone": zone.get("ch_bez_d") or "",
            "flaeche": fl, "kompakt": round(kompaktheit(ring), 3), "e": round(m[0], 1), "n": round(m[1], 1), "gebaeude": len(geb),
            "baujahr": min(jahre) if jahre else None, "geschosse": max((a.get("gastw") or 0) for a in geb) if geb else None,
            "wohnungen": sum((a.get("ganzwhg") or 0) for a in geb) if geb else None,
            "gf_heute": round(gf) if geb else 0, "az_heute": round(gf / fl, 2) if fl and geb else (0.0 if fl else None),
            "umriss": [[[round(p[0], 1), round(p[1], 1)] for p in r] for r in par["ringe"]],
            # Jedes Gebäude einzeln mit den Werten des GWR, ungeschätzt (Julian: "damit
            # der Architekt das rechnen kann und die echten Zahlen sieht").
            "geb_liste": [gebaeude_zeile(a) for a in geb]}


def gebaeude_zeile(a):
    whg = [w for w, s in zip(a.get("warea") or [], a.get("wstat") or []) if s not in (3007, 3008)]  # aufgehoben, nicht realisiert
    return {"egid": a.get("egid"), "adresse": a.get("strname_deinr"), "baujahr": a.get("gbauj"), "status": a.get("gstat"),
            "geschosse": a.get("gastw"), "grundflaeche": a.get("garea"), "ebf": a.get("gebf"), "volumen": a.get("gvol"),
            "wohnungen": a.get("ganzwhg"), "wohnflaeche": sum(w for w in whg if w) if whg else None,
            "e": a.get("gkode"), "n": a.get("gkodn")}


def main():
    migration, portfolio, ziel_csv, ziel_sql = sys.argv[1:5]
    text = open(migration, encoding="utf8").read()
    zeile = re.compile(r"\((\d+), '(\w+)', '((?:[^']|'')+)', '(CH[0-9A-Z]{12})', ([\d.]+), ([\d.]+), (\d+), '((?:[^']|'')*)', '(\w\w)',\s*array\[([^\]]*)\]")
    positionen = [dict(nr=int(m[1]), gefaess=m[2], adresse=m[3].replace("''", "'"), egrid=m[4], flaeche=int(m[7]), gemeinde=m[8], kanton=m[9],
                       nachbarn=re.findall(r"CH[0-9A-Z]{12}", m[10])) for m in zeile.finditer(text)]
    eigene = {p["egrid"] for p in positionen}
    print(len(positionen), "Positionen,", sum(len(p["nachbarn"]) for p in positionen), "Nachbarn")
    gesehen, aus = {}, []
    # Zwischenstand auf der Platte: Der Bund antwortet mal in 0,2 s, mal erst
    # nach einer Minute; ein abgebrochener Lauf fängt so nicht von vorne an.
    zwischen = ziel_csv + ".zwischen.json"
    try:
        gesehen = json.load(open(zwischen, encoding="utf8"))
    except (OSError, ValueError):
        gesehen = {}
    from concurrent.futures import ThreadPoolExecutor, as_completed
    # Die eigenen Liegenschaften auch: Für «zusammen» braucht es beide Seiten.
    alle = sorted({eg for p in positionen for eg in p["nachbarn"]} | eigene)
    offen = [eg for eg in alle if gesehen.get(eg) is None or "geb_liste" not in gesehen[eg]]
    with ThreadPoolExecutor(16) as pool:
        auftrag = {pool.submit(pruefen, eg): eg for eg in offen}
        for i, fertig in enumerate(as_completed(auftrag), 1):
            gesehen[auftrag[fertig]] = fertig.result()
            if i % 25 == 0 or i == len(offen):
                json.dump(gesehen, open(zwischen, "w", encoding="utf8"))
                print(f"{i} von {len(offen)} geprüft", flush=True)
    print(len(alle), "Parzellen geprüft", flush=True)
    for p in positionen:
        h = gesehen.get(p["egrid"]) or {}
        for eg in p["nachbarn"]:
            if eg in eigene:
                continue  # gehört schon dem Portfolio
            z = gesehen[eg]
            if not z:
                continue
            punkte, gruende = bewerten(z, p["flaeche"])
            aus.append({"portfolio": portfolio, "gefaess": p["gefaess"], "position": p["nr"], "haupt_egrid": p["egrid"], "haupt_adresse": p["adresse"], "nachbar_egrid": eg,
                        **{k: v for k, v in z.items()}, "punkte": punkte, "gruende": " · ".join(gruende),
                        # Fläche der Liste (alle Parzellen der Zeile), Gebäude der Hauptparzelle laut GWR
                        "haupt_flaeche": h.get("flaeche") or p["flaeche"], "haupt_nummer": h.get("nummer"), "haupt_zone": h.get("zone"), "haupt_gebaeude": h.get("gebaeude"),
                        "haupt_baujahr": h.get("baujahr"), "haupt_wohnungen": h.get("wohnungen"), "haupt_gf_heute": h.get("gf_heute"),
                        "haupt_umriss": h.get("umriss"), "haupt_geb_liste": h.get("geb_liste")})
    felder = [k for k in aus[0] if "umriss" not in k and "geb_liste" not in k]
    w = csv.DictWriter(open(ziel_csv, "w", newline="", encoding="utf8"), fieldnames=felder, extrasaction="ignore")
    w.writeheader(); [w.writerow(x) for x in aus]
    q = lambda v: ("null" if v is None or v == "" else str(v) if isinstance(v, (int, float))
                   else "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb" if isinstance(v, list) else "'" + str(v).replace("'", "''") + "'")
    spalten = ["portfolio", "gefaess", "position", "haupt_egrid", "haupt_adresse", "nachbar_egrid", "nummer", "kanton", "gemeinde", "zone", "flaeche", "e", "n",
               "gebaeude", "baujahr", "geschosse", "wohnungen", "gf_heute", "az_heute", "punkte", "gruende", "umriss", "haupt_flaeche", "haupt_zone",
               "haupt_gebaeude", "haupt_baujahr", "haupt_wohnungen", "haupt_gf_heute", "haupt_umriss",
               "geb_liste", "haupt_geb_liste", "haupt_nummer"]
    with open(ziel_sql, "w", encoding="utf8") as f:
        f.write(f"-- Erzeugt mit tools/nachbar_potenzial.py: {len(aus)} Nachbarparzellen von {len(positionen)} Positionen ({portfolio}).\n")
        f.write(f"delete from public.nachbar_potenzial where portfolio = {q(portfolio)};\n")
        f.write(f"insert into public.nachbar_potenzial ({', '.join(spalten)}) values\n")
        f.write(",\n".join("(" + ", ".join(q(x[k]) for k in spalten) + ")" for x in aus) + ";\n")
    print(f"Fertig: {len(aus)} Nachbarparzellen, {sum(1 for x in aus if x['punkte'] >= 50)} mit 50 Punkten oder mehr, "
          f"{sum(1 for v in gesehen.values() if v is None)} ohne Antwort oder ohne Parzelle beim Bund (nächster Lauf fragt sie neu)")


if __name__ == "__main__":
    main()

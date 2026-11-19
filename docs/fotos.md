# Eigene Fotos auf den Check-Seiten

Julian, 19. November: «Wir müssen Metadaten verbessern bei den Fotos, weil
wir wollen eigene Fotos benutzen.» So kommt ein Foto auf eine Marke, mit
allem, was Google und ein Mensch über das Bild wissen sollen.

## 1. Eintrag in `src/lib/check-fotos.json`

```json
{
  "id": "einfamilienhaus-garten-meilen",
  "alt": "Einfamilienhaus mit Satteldach und grossem Garten an einem sonnigen Hang",
  "titel": "Einfamilienhaus mit Garten in Meilen",
  "gemeinde": "Meilen",
  "kanton": "ZH",
  "aufgenommen": "2026-11-19",
  "urheber": "Bauraum",
  "breite": 0,
  "hoehe": 0
}
```

* `id` ist der Dateiname: klein, mit Bindestrichen, was zu sehen ist und
  wo. Google liest den Namen mit; `IMG_4711` sagt nichts.
* `alt` beschreibt das Bild in einem ganzen Satz, so wie man es einem
  Menschen am Telefon beschreiben würde. Nicht mit «Bild von» oder «Foto»
  beginnen, keine Liste von Suchbegriffen.
* `breite` und `hoehe` trägt das Werkzeug ein.

## 2. Original ablegen und vorbereiten

Das Original heisst wie die `id` (`einfamilienhaus-garten-meilen.jpg`,
auch `.png`, `.webp`, `.tif`) und liegt in einem Ordner ausserhalb des
Repositorys. Dann:

    python3 -I tools/fotos_vorbereiten.py <ordner>

Das Werkzeug

* dreht das Bild nach der Angabe der Kamera,
* entfernt alle Kameradaten, auch GPS und Gerät,
* schreibt Titel, Beschreibung, Urheber, Bildnachweis, Rechte
  («© 2026 Bauraum»), Ort und Aufnahmetag als IPTC/XMP in jede Datei,
* legt in `public/fotos/` WebP und AVIF in 800 und 1600 Pixel Breite ab,
  dazu `<id>-teilen.jpg` in 1200 × 630 für das Vorschaubild beim Teilen,
* bricht ab, wenn eine Angabe fehlt, bevor eine Datei entsteht.

## 3. Der Marke zuweisen

In `src/lib/check-marken.ts` bei der Marke unter `design` den Eintrag
`foto: '<id>'` setzen. Das Foto ersetzt das Luftbild auf den Bühnen
`luftbild` und `geteilt`; für die übrigen Bühnen erst die Bühne wechseln.

Die Seite zeigt es dann als Bild mit Alt-Text, Breite und Höhe, die feste
Seite für Google trägt es als `og:image` und als `ImageObject` mit
Urheber, Rechten und Ort.

## Rechte

Nur Fotos, die Bauraum selbst gemacht oder mit Nutzungsrecht gekauft hat.
Keine erkennbaren Personen ohne deren Einverständnis, keine Hausnummern
oder Autonummern, die eine fremde Liegenschaft verraten.

`check-fotos.test.ts` wird rot, wenn ein Eintrag Angaben oder Dateien
vermissen lässt oder eine Datei noch Kameradaten trägt.

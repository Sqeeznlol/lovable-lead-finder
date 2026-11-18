#!/usr/bin/env bash
# Schreibt eine CSV-Datei stückweise in die Datenbank, die auch die Seite
# bedient (CLAUDE.md, «Die Datenbank bedient die Seite»).
#
# Je Stück eine eigene Sitzung mit einer Sitzungstabelle «eingang», die
# mit der Sitzung vergeht: keine Zwischentabelle in public, die ohne
# Zeilenschutz liegen bliebe (15. November: sechs solche Tabellen). Vor
# jedem Stück wird die Grösse gemessen; jede Anweisung trägt eine Frist;
# nach jedem Stück ruht die Datenbank so lange, wie es gedauert hat.
# Braucht ein Stück länger als LANGSAM Sekunden, endet der Lauf: dann
# ist das Guthaben der Platte knapp, und weiterschreiben brächte die
# Seite zum Stehen. Die Anweisungen schreiben nur, was fehlt; ein
# abgebrochener Lauf wird darum einfach wiederholt.
#
# Aufruf: tools/in_portionen.sh <datei.csv> "<create temp table eingang (...)>" "<Anweisung, die eine Zahl liefert>"
# Umgebung: DB (Pflicht), GRENZE_MB (4000), STUECK (2000 Zeilen), LANGSAM (60 s)
# Ausgegeben werden nur Zahlen.
set -euo pipefail
datei=$1
tabelle=$2
anweisung=$3
GRENZE_MB=${GRENZE_MB:-4000}
STUECK=${STUECK:-2000}
LANGSAM=${LANGSAM:-60}
[ -n "${DB:-}" ] || { echo "Kein Datenbankzugang."; exit 1; }

ordner=$(mktemp -d)
trap 'rm -rf "$ordner"' EXIT
# Zeilen ohne Umbruch im Feld (Zonen, Adressen): split darf zählen.
tail -n +2 "$datei" | split -l "$STUECK" -a 4 - "$ordner/teil_"
stuecke=$(find "$ordner" -name 'teil_*' | wc -l)
echo "Stücke zu je $STUECK: $stuecke"

# Das Protokoll ist öffentlich: eine Fehlermeldung von psql nennt bei
# einem Verbindungsfehler den Server. Er wird geschwärzt, ebenso jede
# Adresse in Klammern.
schwaerzen() {
  sed -E 's/"[A-Za-z0-9.-]+\.[A-Za-z]{2,}"/"(Server)"/g; s/\([0-9a-f.:]+\)/(Adresse)/g' "$1" | head -5 >&2
}

megabyte() {
  psql "$DB" -X -q -t -A -c "set statement_timeout = '30s';" \
    -c "select (pg_database_size(current_database())/1024/1024)::int;" 2>"$ordner/fehler" \
    || { schwaerzen "$ordner/fehler"; echo "FEHLER beim Messen der Grösse." >&2; return 1; }
}

gesamt=0
nummer=0
for f in "$ordner"/teil_*; do
  [ -e "$f" ] || continue
  nummer=$(( nummer + 1 ))
  mb=$(megabyte) || { echo "Geschrieben: $gesamt"; exit 1; }
  if [ "$mb" -ge "$GRENZE_MB" ]; then
    echo "ABBRUCH vor Stück $nummer/$stuecke: Datenbank bei $mb MB, Grenze $GRENZE_MB MB."
    echo "Geschrieben: $gesamt"
    exit 1
  fi
  t0=$(date +%s)
  if ! n=$(psql "$DB" -v ON_ERROR_STOP=1 -X -q -t -A \
      -c "set statement_timeout = '2min';" \
      -c "$tabelle" \
      -c "\\copy eingang from '$f' with (format csv)" \
      -c "$anweisung" 2>"$ordner/fehler"); then
    schwaerzen "$ordner/fehler"
    echo "FEHLER in Stück $nummer/$stuecke."
    echo "Geschrieben: $gesamt"
    exit 1
  fi
  gesamt=$(( gesamt + ${n:-0} ))
  dauer=$(( $(date +%s) - t0 ))
  if [ "$dauer" -gt "$LANGSAM" ]; then
    echo "ABBRUCH nach Stück $nummer/$stuecke: es brauchte $dauer s. Die Datenbank antwortet träge;"
    echo "neu starten, wenn sie ruht (geschrieben wird nur, was fehlt)."
    echo "Geschrieben: $gesamt"
    exit 1
  fi
  if [ "$dauer" -lt 2 ]; then dauer=2; fi
  sleep "$dauer"
  if [ $(( nummer % 10 )) -eq 0 ]; then
    echo "  Stück $nummer/$stuecke: $gesamt, Datenbank $mb MB"
  fi
done
echo "Geschrieben: $gesamt"

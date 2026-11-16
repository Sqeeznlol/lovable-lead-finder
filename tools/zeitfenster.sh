#!/usr/bin/env bash
# =====================================================================
# Zeitfenster: läuft dieser Lauf zur vorgesehenen Tageszeit?
# =====================================================================
# GitHub startet die geplanten Läufe dieses Repositorys Stunden nach
# Plan. Gemessen an «Baugesuche» (Plan 05:23 UTC), 4. bis 15. November:
# Start zwischen 11:47 und 14:00 Uhr, also 6 h 24 bis 8 h 37 zu spät;
# «Was ist live» (Plan 05:00) am 12. und 13. November um 13:38 und 12:57.
#
# Ein Zeitplan allein sagt darum nicht, wann ein Lauf arbeitet. Wer eine
# Tageszeit braucht (nachts schreiben, am Morgen prüfen), fragt diese
# Uhr und hat mehrere Einträge im Zeitplan, von denen bei jeder
# Verspätung einer ins Fenster trifft (zeitplan.test.ts rechnet es nach).
#
# Aufruf:  tools/zeitfenster.sh VON BIS     (UTC, HH:MM; BIS zählt nicht
#                                            mehr dazu und darf nach
#                                            Mitternacht liegen)
# Endet mit 0 im Fenster, mit 1 ausserhalb, mit 2 bei falschem Aufruf.
# JETZT=HH:MM ersetzt die Uhr -- nur für den Test.
# =====================================================================
set -euo pipefail

zeit='^([01][0-9]|2[0-3]):[0-5][0-9]$'
jetzt="${JETZT:-$(date -u +%H:%M)}"
for wert in "${1:-}" "${2:-}" "$jetzt"; do
  [[ "$wert" =~ $zeit ]] || { echo "Aufruf: zeitfenster.sh VON BIS (HH:MM, UTC)" >&2; exit 2; }
done

# 10#: «08» und «09» sind sonst ungültige Oktalzahlen.
minuten() { echo $(( 10#${1%%:*} * 60 + 10#${1##*:} )); }
von=$(minuten "$1"); bis=$(minuten "$2"); nun=$(minuten "$jetzt")

if [ "$von" -le "$bis" ]; then
  [ "$nun" -ge "$von" ] && [ "$nun" -lt "$bis" ] || exit 1
else
  # Über Mitternacht: 22:00 bis 02:00.
  [ "$nun" -ge "$von" ] || [ "$nun" -lt "$bis" ] || exit 1
fi

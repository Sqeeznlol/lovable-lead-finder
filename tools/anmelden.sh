#!/usr/bin/env bash
# Meldet die Abläufe als Konto "aui" an und gibt den Sitzungsschlüssel
# auf stdout aus.
#
# Warum: Der öffentliche Schlüssel (anon) darf seit dem 1. November
# nichts mehr lesen oder ändern -- vorher konnte jeder mit dem Schlüssel
# aus dem öffentlichen Repository den ganzen Bestand samt Eigentümern
# und Telefonnummern lesen und ändern. Die Abläufe arbeiten darum wie
# ein angemeldeter Mensch, mit denselben Regeln.
#
# Erwartet URL, KEY (aus .env) und KONTO_AUI (GitHub-Secret). Gibt nur
# den Schlüssel aus, nie das Passwort; Fehler ohne Inhalt der Antwort.
set -euo pipefail
[ -n "${KONTO_AUI:-}" ] || { echo "Secret KONTO_AUI fehlt." >&2; exit 1; }
antwort=$(curl -sS -X POST "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $KEY" -H 'Content-Type: application/json' \
  --data "$(jq -n --arg e 'aui@wohntraums.life' --arg p "$KONTO_AUI" '{email: $e, password: $p}')")
schluessel=$(jq -r '.access_token // empty' <<<"$antwort")
[ -n "$schluessel" ] || { echo "Anmeldung als aui fehlgeschlagen." >&2; exit 1; }
printf '%s' "$schluessel"

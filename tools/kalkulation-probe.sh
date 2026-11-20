#!/usr/bin/env bash
# Spielt die Migration von CALC YOU LATER in eine Wegwerf-Datenbank ein und
# prüft, was nur die Datenbank erzwingen kann: die Reihenfolge der
# Schritte, die Uhr und die Rechte (angemeldet, Fondsleitung, ohne
# Anmeldung). Die Datenbank der Seite wird dabei nicht berührt.
#
# Ende 0: alle Proben bestanden. Ende 1: eine Probe ist durchgefallen.
# Ende 77: hier lässt sich keine Datenbank starten (dann prüft der Runner).
set -u
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
[ -n "$BIN" ] && [ -x "$BIN/initdb" ] || { echo "Kein PostgreSQL gefunden."; exit 77; }

ORT=$(mktemp -d /tmp/kalkulation-probe.XXXXXX)
PORT=$(( 55000 + RANDOM % 5000 ))
# PostgreSQL läuft nicht als root: dann unter dem Konto postgres.
if [ "$(id -u)" = 0 ]; then
  id postgres >/dev/null 2>&1 || { echo "Als root ohne Konto postgres."; exit 77; }
  chown postgres "$ORT"; ALS="runuser -u postgres --"
else
  ALS=""
fi
ende() { $ALS "$BIN/pg_ctl" -D "$ORT/daten" -m immediate stop >/dev/null 2>&1; rm -rf "$ORT"; }
trap ende EXIT

$ALS "$BIN/initdb" -D "$ORT/daten" -A trust -U postgres >/dev/null 2>&1 || { echo "initdb gelingt hier nicht."; exit 77; }
$ALS "$BIN/pg_ctl" -D "$ORT/daten" -o "-p $PORT -k $ORT -c listen_addresses=''" -l "$ORT/log" -w start >/dev/null 2>&1 \
  || { echo "Die Datenbank startet hier nicht."; exit 77; }

P=( "$BIN/psql" -h "$ORT" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q )
"${P[@]}" -f tools/kalkulation-probe/attrappe.sql >/dev/null || exit 1
# Die Tabelle (16. November) und der Weg des Angebots (19. November), in dieser Reihenfolge.
for M in $(ls supabase/migrations/*_kalkulation.sql supabase/migrations/*_angebot.sql supabase/migrations/*_kalkulation_bemerkung.sql | sort); do
  "${P[@]}" -f "$M" >/dev/null 2>&1 || { echo "Die Migration $M lässt sich nicht einspielen."; "${P[@]}" -f "$M"; exit 1; }
done
# Eine alte Freigabe, wie sie vor dem 19. November entstand: sie muss zu Tim (visum).
"${P[@]}" -c "alter table public.kalkulation drop constraint kalkulation_zustand_check; insert into public.kalkulation (adresse, zustand) values ('TEST alte Freigabe', 'freigabe');" >/dev/null || exit 1
# Zweimal: die Migration muss sich wiederholen lassen.
for M in $(ls supabase/migrations/*_kalkulation.sql supabase/migrations/*_angebot.sql supabase/migrations/*_kalkulation_bemerkung.sql | sort); do
  "${P[@]}" -f "$M" >/dev/null 2>&1 || { echo "Die Migration $M lässt sich nicht zweimal einspielen."; "${P[@]}" -f "$M"; exit 1; }
done
[ "$("${P[@]}" -Atc "select zustand from public.kalkulation where adresse = 'TEST alte Freigabe'")" = visum ] || { echo "Eine alte Freigabe ist nicht bei Tim."; exit 1; }
"${P[@]}" -c "delete from public.kalkulation" >/dev/null || exit 1
AUS=$("${P[@]}" -f tools/kalkulation-probe/proben.sql 2>&1) || { echo "$AUS" | tail -5; exit 1; }
echo "$AUS" | grep -c "alle Proben bestanden" | grep -qx 5 || { echo "Nicht alle fünf Gruppen sind durchgelaufen."; echo "$AUS" | tail -5; exit 1; }
echo "Reihenfolge, Uhr und Rechte: alle Proben bestanden."

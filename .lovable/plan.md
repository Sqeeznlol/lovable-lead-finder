

## Sqeeztraum – Optimierungen

### Zusammenfassung
Drei Hauptänderungen: (1) Sortierung nach HNF/Fläche absteigend, (2) alle 70k+ Datensätze laden statt nur 1000, (3) Abfrage-Queue und Telefon-Workflow verbessern.

### Änderungen

#### 1. Sortierung: HNF (gebaeudeflaeche) & Fläche (area) absteigend
- **`use-properties.ts`**: `useProperties` und `useUnqueriedProperties` sortieren primär nach `gebaeudeflaeche` DESC NULLS LAST, sekundär nach `area` DESC NULLS LAST
- Grösste Liegenschaften erscheinen zuerst → beste Akquise-Targets oben

#### 2. Alle Liegenschaften laden (nicht nur 1000)
- **`use-properties.ts`**: Pagination serverseitig statt clientseitig. Supabase hat ein 1000-Row-Limit pro Query.
- Lösung: Neue `useProperties`-Hook mit serverseitiger Pagination – `range(from, to)` statt `limit(500)`. Lade jeweils 100 Einträge pro Seite direkt vom Server mit Offset.
- Separate Count-Query für Gesamtanzahl (`select('*', { count: 'exact', head: true })`)
- **`PropertyList.tsx`**: Page-Wechsel triggert neuen DB-Query statt Client-Slice. Filter (Gemeinde, Status, Suche) werden serverseitig angewendet.
- Spalte **"Eigentümer"** wird erweitert: Wenn `is_queried` true aber kein `owner_name`, zeige "Abgefragt – kein Ergebnis". Neue visuelle Spalte "Abgefragt" mit Häkchen/X.

#### 3. Telefon-Manager: Nummern speichern & wiederverwenden
- **`PhoneManager.tsx`** funktioniert bereits mit Add/Delete/Reset. Keine strukturelle Änderung nötig – Nummern sind persistent in der DB, unbegrenzt hinzufügbar. Nur UI-Text klarer machen.

#### 4. Abfrage-Queue optimieren
- **`QueryQueue.tsx`**: 
  - Sortierung der Queue nach HNF/Fläche absteigend (grösste zuerst)
  - Pro Telefonnummer 5 Liegenschaften zuweisen
  - "Portal öffnen"-Link öffnet direkt die EGRID-URL
  - Nach Eingabe von Eigentümer-Daten: Status automatisch auf "Eigentümer ermittelt", `is_queried = true`
  - Neue Spalte in PropertyList zeigt ob Eigentümer bereits abgefragt wurde

### Technische Details

**Serverseitige Pagination** (70k+ Rows):
```
// Count total
supabase.from('properties').select('*', { count: 'exact', head: true }).eq(...)

// Fetch page
supabase.from('properties').select('*')
  .order('gebaeudeflaeche', { ascending: false, nullsFirst: false })
  .order('area', { ascending: false, nullsFirst: false })
  .range(page * 50, (page + 1) * 50 - 1)
```

**Dateien die geändert werden:**
- `src/hooks/use-properties.ts` – Sortierung, serverseitige Pagination, Count
- `src/components/PropertyList.tsx` – Server-Pagination, neue "Abgefragt"-Spalte, Suche serverseitig
- `src/components/QueryQueue.tsx` – Sortierung nach HNF/Fläche
- `src/components/PhoneManager.tsx` – Kleinere UI-Verbesserungen


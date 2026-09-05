-- =====================================================================
-- Zugang auf angemeldete Personen beschränken
-- =====================================================================
-- Bisher gilt für die Objekte und die Telefonnummern:
--
--   CREATE POLICY "Allow all access to properties"
--     ON public.properties FOR ALL USING (true) WITH CHECK (true);
--
-- Das erlaubt jedem, der den öffentlichen Schlüssel hat, alles zu lesen,
-- zu ändern und zu löschen. Dieser Schlüssel steckt im JavaScript der
-- Webseite und ist damit für jeden Besucher sichtbar -- eine Anmeldung
-- davor wäre eine Tür ohne Wand.
--
-- In der Tabelle stehen Adressen, Eigentümernamen und Telefonnummern von
-- Menschen, die nie um ihre Aufnahme gebeten haben. Nach schweizerischem
-- Datenschutzrecht sind das Personendaten, und für die trägt der
-- Bearbeiter die Verantwortung -- auch dann, wenn nie jemand danach
-- fragt.
--
-- Nach dieser Migration braucht jeder Zugriff eine gültige Anmeldung.
-- =====================================================================

-- --------------------------------------------------------------- Objekte
DROP POLICY IF EXISTS "Allow all access to properties" ON public.properties;

CREATE POLICY "Angemeldete sehen die Objekte"
  ON public.properties FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Angemeldete pflegen die Objekte"
  ON public.properties FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Angemeldete ändern die Objekte"
  ON public.properties FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

-- Löschen bleibt bewusst aussen vor: ein Versehen in der Oberfläche
-- soll nicht Hunderttausende Zeilen entfernen können. Wer wirklich
-- löschen muss, tut es im SQL-Editor.

-- --------------------------------------------------- Telefonnummern
DROP POLICY IF EXISTS "Allow all access to phone_numbers" ON public.phone_numbers;

CREATE POLICY "Angemeldete sehen die Nummern"
  ON public.phone_numbers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Angemeldete pflegen die Nummern"
  ON public.phone_numbers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Angemeldete ändern die Nummern"
  ON public.phone_numbers FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

-- =====================================================================
-- Hinweis für den Tag, an dem diese Migration läuft
-- =====================================================================
-- Ab hier funktionieren die Abläufe bei GitHub nicht mehr, die mit dem
-- öffentlichen Schlüssel auf die Objekte zugreifen -- der Abgleich nach
-- Pipedrive und das Nachfüllen. Sie brauchen dann eine Anmeldung:
-- entweder ein eigenes Konto, dessen Zugangsdaten als Secret liegen,
-- oder den Dienstschlüssel, der die Regeln umgeht.
--
-- Der Dienstschlüssel gehört ausschliesslich in ein Secret und niemals
-- in den Code der Webseite: er hebt jede dieser Regeln auf.
-- =====================================================================

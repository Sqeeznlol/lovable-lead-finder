# Werbeplan: Eigentümer-Leads über die Check-Seiten

Stand 6. November 2026. Für Julian. Ziel: Eigentümer in Zürich, Zug,
Luzern und Thurgau prüfen ihre Parzelle auf einer unserer Check-Seiten
(ParzellenChecker, HausChecker, ...) und hinterlassen ihren Kontakt. Jeder
Lead landet mit Domain, Anzeige und Antworten in Bauraum.

Was hier steht, ist recherchiert (Quellen am Ende) oder ausdrücklich als
Annahme markiert. Klickpreise für Schweizer Verkäufer-Keywords gibt es
öffentlich nicht -- die liefert erst der Keyword-Planer und der Test.

## 1. Woran wir messen

| Stufe | Messgrösse |
|---|---|
| Anzeige | Klickrate, Kosten je Klick |
| Seite | Anteil der Besucher, die eine Adresse prüfen |
| Lead | Anteil der Prüfungen mit Kontakt |
| Qualifiziert | Eigentümer, will verkaufen oder bauen, innert 12 Monaten ("heiss") |
| Ergebnis | Gespräch, Mandat, Ankauf |

Die eine Zahl, nach der wir Budget verschieben: **Kosten je heissem
Lead**, je Domain, je Kanton, je Kanal. Nicht Kosten je Lead -- ein
Formular allein ist noch kein Geschäft.

Vergleich, damit wir wissen, ob es sich lohnt: Gekaufte Verkäufer-Leads
kosten in der Schweiz CHF 30 bis 150 (geteilt), 150 bis 400 (exklusiv,
vorqualifiziert), 400 bis 750 (Premium); 70 bis 80 % werden kein Mandat
(RealAdvisor 2026, Marktbeobachtung).

## 2. Regionen und Reihenfolge

1. **Zürich und Thurgau zuerst.** Dort kennt unser Bestand jede Parzelle
   mit Zone, Ausnützung und Reserve. Die "ausführliche Analyse", die wir
   versprechen, können wir am selben Tag liefern.
2. **Zug und Luzern ab Woche 3.** Hohe Werte, viel Verdichtungsdruck,
   aber die Analyse ist dort Handarbeit, bis der Bestand den Kanton kennt.

Je Kanton eigene Kampagnen, damit die Kosten je heissem Lead pro Kanton
sichtbar werden. Bei Google auf Gemeinden oder PLZ genau (in der Schweiz
erlaubt, 2'727 PLZ als Ziel verfügbar); bei Meta nur Kanton oder Stadt
mit mindestens 17 km Radius (Sonderkategorie Wohnraum, siehe 5).

## 3. Welche Seiten live gehen

Start mit vier Domains, je eine Frage, auf die Eigentümer selbst kommen:

| Domain | Frage | Wen sie anzieht |
|---|---|---|
| parzellenchecker.ch | Was ist auf meiner Parzelle möglich? | Grundstückbesitzer, Bauland |
| hauschecker.ch | Was steckt in meinem Haus? | Hausbesitzer, ältere Gebäude |
| wasdarfichbauen.ch | Was darf ich bauen? | Ausbau, Aufstockung, Ersatzneubau |
| erbliegenschaft.ch | Geerbt, und jetzt? | Erbengemeinschaften, stärkste Verkaufsabsicht |

Alle am 6. November laut Registry frei (rdap.nic.ch), ebenso 55 weitere
(Liste in `src/lib/check-marken.ts`). Gekauft ist keine. Nach vier Wochen
bleibt, was heisse Leads bringt; die übrigen Domains leiten wir um.

## 4. Google Ads (Hauptkanal für den Start)

Suchende haben die Absicht schon -- das passt am besten zu "ich will
wissen, was mein Grundstück kann".

**Kampagnen:** je Kanton eine Suchkampagne, darin Anzeigengruppen nach
Absicht:

- *Verkaufen:* grundstück verkaufen, haus verkaufen [Gemeinde],
  liegenschaft verkaufen, bauland verkaufen, mfh verkaufen
- *Wert:* hauswert berechnen, grundstückwert, landwert [Gemeinde],
  immobilienbewertung kostenlos
- *Bauen:* was darf ich bauen, ausnützungsziffer berechnen, aufstocken,
  anbau bewilligung, bauzone [Gemeinde], ersatzneubau
- *Erbe:* erbengemeinschaft haus verkaufen, liegenschaft geerbt,
  erbteilung haus

**Ausschliessen:** mieten, miete, wohnung kaufen, haus kaufen,
stelle, job, lehre, gratis inserat, homegate, immoscout -- sonst zahlen
wir für Käufer und Mieter.

**Anzeige zeigt auf die passende Domain**, mit UTM-Werten
(`utm_source=google&utm_campaign=zh-verkaufen`); die Seite legt sie mit
dem Lead ab.

**Rückmeldung an Google:** Heisse Leads als Ziel "qualified lead"
zurückspielen, damit Google auf Eigentümer statt auf Formulare
optimiert. Ab 15. Juni 2026 über die Data Manager API.

Performance Max erst, wenn die Suche vier Wochen läuft und heisse Leads
zurückgemeldet sind.

## 5. Meta (Facebook, Instagram)

**Die Schweiz fällt unter die Sonderkategorie Wohnraum.** Meta zählt
"home equity or appraisal services" ausdrücklich dazu. Folgen:

- Alter 18 bis 65+, alle Geschlechter, keine PLZ, keine Ausschlüsse
- Stadt oder Pin nur mit mindestens 17 km Radius
- Keine Advantage+-Lookalikes; Website-Besucher als Zielgruppe gehen

Darum kommt die Genauigkeit aus dem Inhalt, nicht aus dem Targeting:

- **Bild:** Luftbild der Gemeinde mit eingezeichneter Parzelle -- man
  erkennt sein Quartier.
- **Text als Frage:** "Wie viel dürfte auf Ihrem Grundstück in Uster
  stehen?" -- spricht nur an, wer eines hat.
- **Ziel Website**, nicht Meta-Formular: auf der Seite prüft der
  Eigentümer seine Adresse, wir bekommen Parzelle und EGRID dazu. Ein
  Meta-Formular ("Higher intent", mit Bestätigung) als Gegentest.
- **Retargeting:** Wer eine Adresse geprüft und nichts hinterlassen hat,
  sieht eine zweite Anzeige ("Ihre Analyse ist noch offen").

## 6. Budget für den Test (Annahme)

Öffentliche Schweizer Zahlen für Verkäufer-Keywords gibt es nicht;
branchenunabhängig nennen Agenturen CHF 5 bis 10 je Klick, für Meta in
der Schweiz CPM CHF 4 bis 15. Daraus als Startannahme:

| Woche | Kanäle | Budget je Woche |
|---|---|---|
| 1 und 2 | Google Suche ZH und TG | CHF 500 |
| 3 bis 6 | Google ZH, TG, ZG, LU; Meta ZH und LU | CHF 1'000 |

Zusammen rund CHF 5'000 für sechs Wochen. Nach Woche 6 entscheiden:
Kanäle mit Kosten je heissem Lead unter dem Kaufpreis eines exklusiven
Leads (CHF 150 bis 400) verdoppeln, die anderen stoppen.

## 7. Was nach dem Lead passiert

- **Innert einer Stunde anrufen.** RealAdvisor nennt Antwort in der
  ersten Stunde und Termin innert 48 Stunden als Merkmal guter Leads.
  Dafür braucht es eine Benachrichtigung aufs Telefon -- heute zeigt
  Bauraum neue Anfragen erst im Cockpit (siehe 9).
- **Heiss** (Eigentümer, verkaufen oder bauen, 12 Monate): Julian oder
  Tim ruft an, mit der Analyse aus dem Bestand.
- **Warm** (Eigentümer, Wert oder später): Analyse per Mail, Wiedervorlage
  in drei Monaten.
- **Normal:** Analyse per Mail, keine Wiedervorlage.
- Status in Pipedrive zurück an Google und Meta.

## 8. Recht (vor dem ersten Franken Werbung)

- **Impressum** mit Firma, Postadresse, E-Mail auf jeder Domain (UWG
  Art. 3 Abs. 1 lit. s).
- **Datenschutzerklärung** nach DSG Art. 19: wer, wozu, an wen, welche
  Länder (Supabase, Vercel, Google, Meta); USA nur mit Anbietern unter
  dem Swiss-US Data Privacy Framework.
- **Einwilligung im Formular** nennt den Zweck offen: Wir melden uns, auch
  zu einem möglichen Verkauf oder einer Entwicklung. Weitergabe an Dritte
  (Investoren, Fonds) separat abfragen, falls gewollt.
- **Nicht "neutral" oder "unabhängig" schreiben**, weil wir selbst
  vermitteln und ankaufen (UWG Art. 3 Abs. 1 lit. b). "Kostenlos" nur ohne
  Bedingung -- trifft zu.
- **Cookie-Banner mit echter Wahl:** Meta Pixel und Google-Ads-Tag erst
  nach Zustimmung laden, Ablehnen gleich einfach wie Zustimmen (EDÖB-
  Leitfaden vom 6. Oktober 2025).
- **Anrufe:** Sterneintrag im Telefonbuch beachten (lit. u) -- bei Leads,
  die selbst um Kontakt gebeten haben, liegt die Einwilligung vor.

## 9. Was gebaut ist und was fehlt

Gebaut: die Check-Seite für alle Marken, die Lead-Speicherung mit Marke,
Domain, Antworten, Priorität und UTM, die Anzeige in Bauraum.

Fehlt noch:

1. Domains kaufen und bei Vercel dem Projekt hinzufügen (Julian).
2. Impressum- und Datenschutzangaben: Firmenname, Adresse, UID (Julian).
3. Benachrichtigung bei heissem Lead aufs Telefon -- braucht einen
   Mail- oder SMS-Dienst (Konto bei Julian).
4. Cookie-Banner und Pixel, sobald die Werbekonten stehen.
5. Französische Fassung für die Romandie, falls gewollt.

## Quellen

- Meta, Länder der Sonderkategorie: https://www.facebook.com/business/help/1198401317374558
- Meta, Einschränkungen: https://www.facebook.com/business/help/2220749868045706
- Meta, Formulare mit höherer Absicht: https://www.facebook.com/business/help/252352181957512
- Google, Wohnraum-Richtlinie (nur USA, Kanada): https://support.google.com/adspolicy/answer/16701755
- Google, Geotargets (Datei vom 6.10.2026): https://developers.google.com/google-ads/api/data/geotargets
- Google, Offline-Conversions und Data Manager API: https://support.google.com/google-ads/answer/10029210, https://support.google.com/google-ads/answer/11021502
- Google, Einwilligungsrichtlinie: https://www.google.com/intl/en_uk/about/company/user-consent-policy-help/
- RealAdvisor, Leadpreise und Qualifizierung: https://realadvisor.ch/de/pro/blog/immobilien-leads-kaufen
- Agenturwerte CPC/CPM: https://www.gryps.ch/produkte/seo-agentur-39/, https://digitalm.ch/dienstleistungen/social-media-ads/
- DSG Art. 19: https://www.fedlex.admin.ch/eli/cc/2022/491/de#art_19
- EDÖB, Swiss-US Data Privacy Framework: https://www.edoeb.admin.ch/en/15082024-new-swiss-us-data-privacy-framework
- EDÖB, Cookie-Leitfaden V1.1: https://www.edoeb.admin.ch/dam/de/sd-web/brLL9rM3ny9d/Leitfaden%20des%20ED%C3%96B%20betreffend%20Datenbearbeitungen%20mittels%20Cookies%20und%20%C3%A4hnlichen%20Technologien%20V.%201.1%20vom%2006.10.2025_DE.pdf
- UWG Art. 3: https://www.fedlex.admin.ch/eli/cc/1988/223_223_223/de#art_3

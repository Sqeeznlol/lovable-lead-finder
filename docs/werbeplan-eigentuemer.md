# Werbeplan: Eigentümer-Leads über die Check-Seiten

Stand 7. November 2026. Für Julian und Tim. Ziel: Eigentümer in Zürich,
Zug, Luzern und Thurgau prüfen ihre Parzelle auf einer unserer
Check-Seiten (ParzellenChecker, HausChecker, ...) und hinterlassen ihren
Kontakt. Jeder Lead landet mit Domain, Anzeige und Antworten in Bauraum.

Was hier steht, ist recherchiert (Quellen am Ende) oder ausdrücklich als
Annahme markiert. Klickpreise für Schweizer Verkäufer-Keywords gibt es
öffentlich nicht -- die liefert erst der Keyword-Planer und der Test.

## 0. Entscheid vom 7. November (Tim)

Tim: Google ist umkämpft, Facebook ist bei Rentnern stark, und dort
laufen Seiten im Stil eines Magazins. Daraus folgt:

1. **Facebook zuerst, Google klein.** Auf "haus verkaufen" bieten
   Makler, Portale und Bewertungsseiten. Wir nehmen auf Google nur die
   Fragen, auf die kaum jemand bietet (siehe 4).
2. **Zwei Arten von Facebook-Anzeigen:**
   - **Ratgeber-Anzeigen** führen zu einem Artikel, zuerst "Das Haus ist
     zu gross geworden. Fünf Wege, die Eigentümer haben". Meta zählt
     "Tips related to homeownership" ausdrücklich *nicht* zur
     Sonderkategorie Wohnraum. Alter (60+), PLZ und Interessen sind
     damit erlaubt. Der Artikel muss ein echter Ratgeber sein; der Check
     steht darin als Angebot.
   - **Check-Anzeigen** werben direkt für die Prüfung. Das ist eine
     Dienstleistung rund um den Wert, also Sonderkategorie Wohnraum: kein
     Alter, keine PLZ, 17 km Radius. Die Rentner erreicht hier der
     Inhalt, nicht das Targeting.
3. **Ehrlich bleiben.** Stuft Meta eine Ratgeber-Anzeige als Wohnraum
   ein, läuft sie in der Sonderkategorie weiter. Nicht umformulieren,
   um die Prüfung zu umgehen. Und keine Check-Anzeigen an eine
   Zielgruppe, die nur aus den 60+-Lesern des Ratgebers besteht: Das
   wäre Altersausrichtung über einen Umweg, und die verbietet Meta in
   der Sonderkategorie.

## 1. Woran wir messen

| Stufe | Messgrösse |
|---|---|
| Anzeige | Klickrate, Kosten je Klick |
| Ratgeber | Anteil der Leser, die auf "Grundstück prüfen" klicken |
| Seite | Anteil der Besucher, die eine Adresse prüfen |
| Lead | Anteil der Prüfungen mit Kontakt |
| Qualifiziert | Eigentümer, will verkaufen oder bauen, innert 12 Monaten ("heiss") |
| Ergebnis | Gespräch, Mandat, Ankauf |

Die eine Zahl, nach der wir Budget verschieben: **Kosten je heissem
Lead**, je Domain, je Kanton, je Kanal. Nicht Kosten je Lead -- ein
Formular allein ist noch kein Geschäft.

Jeder Lead trägt seine Herkunft: `utm_source`, `utm_campaign`, `fbclid`
oder `gclid`, und bei Lesern des Ratgebers `utm_content=ratgeber-<artikel>`.
Damit ist sichtbar, ob Ratgeber oder Check-Anzeige die heissen Leads
bringt.

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
sichtbar werden. Ratgeber-Anzeigen und Google auf Gemeinden oder PLZ
genau; Check-Anzeigen auf Facebook nur Kanton oder Stadt mit mindestens
17 km Radius.

## 3. Welche Seiten live gehen

Start mit vier Domains, je eine Frage, auf die Eigentümer selbst kommen:

| Domain | Frage | Wen sie anzieht |
|---|---|---|
| parzellenchecker.ch | Was ist auf meiner Parzelle möglich? | Grundstückbesitzer, Bauland |
| hauschecker.ch | Was steckt in meinem Haus? | Hausbesitzer, ältere Gebäude |
| wasdarfichbauen.ch | Was darf ich bauen? | Ausbau, Aufstockung, Ersatzneubau |
| erbliegenschaft.ch | Geerbt, und jetzt? | Erbengemeinschaften, stärkste Verkaufsabsicht |

Der Ratgeber läuft auf jeder dieser Domains unter `/ratgeber/<artikel>`,
der erste Artikel also unter `hauschecker.ch/ratgeber/haus-zu-gross`.
Zur Vorschau: `www.wohntraums.life/check/hauschecker/ratgeber/haus-zu-gross`.

Alle am 6. November laut Registry frei (rdap.nic.ch), ebenso 55 weitere
(Liste in `src/lib/check-marken.ts`). Gekauft ist keine. Nach vier Wochen
bleibt, was heisse Leads bringt; die übrigen Domains leiten wir um.

## 4. Google Ads (klein, nur wenig umkämpfte Fragen)

Nach Tims Entscheid nicht mehr Hauptkanal. Wir bieten nur auf Fragen,
die Eigentümer stellen, Makler und Portale aber kaum bewerben:

- *Bauen:* ausnützungsziffer berechnen, was darf ich bauen, aufstocken
  bewilligung, anbau bewilligung, bauzone [Gemeinde], ersatzneubau
- *Erbe:* liegenschaft geerbt was tun, erbengemeinschaft haus

Ob sie wirklich günstiger sind, zeigt erst der Keyword-Planer (Annahme).

**Nicht mehr:** grundstück verkaufen, haus verkaufen, liegenschaft
verkaufen, immobilienbewertung kostenlos -- dort bieten alle.

**Ausschliessen:** mieten, miete, wohnung kaufen, haus kaufen,
stelle, job, lehre, gratis inserat, homegate, immoscout.

**Anzeige zeigt auf die passende Domain**, mit UTM-Werten
(`utm_source=google&utm_campaign=zh-bauen`); die Seite legt sie mit
dem Lead ab. Heisse Leads als Ziel "qualified lead" an Google
zurückspielen (Data Manager API).

## 5. Facebook und Instagram (Hauptkanal)

### Ratgeber-Anzeigen (keine Sonderkategorie)

- **Ziel:** ZH und TG über PLZ-Listen, Alter 60+, alle Geschlechter.
- **Bild:** ein Einfamilienhaus mit Garten aus der Region, ruhig, ohne
  Text im Bild.
- **Text:** "Die Kinder sind ausgezogen, das Haus ist geblieben. Fünf
  Wege, die Eigentümer haben, und was man dafür wissen muss."
- **Knopf:** "Mehr dazu". Ziel ist der Artikel, nicht der Check.
- **Link:** `hauschecker.ch/ratgeber/haus-zu-gross?utm_source=facebook&utm_campaign=zh-60plus`
- Weitere Artikel nach demselben Muster: geerbte Liegenschaft,
  Ausnützung einfach erklärt, Garten als Bauland.

### Check-Anzeigen (Sonderkategorie Wohnraum)

Meta zählt "home equity or appraisal services" zur Sonderkategorie, die
Schweiz gehört dazu. Folgen:

- Alter 18 bis 65+, alle Geschlechter, keine PLZ, keine Ausschlüsse
- Stadt oder Pin nur mit mindestens 17 km Radius
- Keine Advantage+-Lookalikes; Website-Besucher als Zielgruppe gehen

Darum kommt die Genauigkeit aus dem Inhalt:

- **Bild:** Luftbild der Gemeinde mit eingezeichneter Parzelle -- man
  erkennt sein Quartier.
- **Text als Frage:** "Wie viel dürfte auf Ihrem Grundstück in Uster
  stehen?" -- spricht nur an, wer eines hat.
- **Ziel Website**, nicht Meta-Formular: auf der Seite prüft der
  Eigentümer seine Adresse, wir bekommen Parzelle und EGRID dazu.
- **Retargeting:** Wer auf dem Check eine Adresse geprüft und nichts
  hinterlassen hat, sieht eine zweite Anzeige ("Ihre Analyse ist noch
  offen"). Gilt für alle Besucher des Checks, nicht für eine
  Altersgruppe.

## 6. Budget für den Test (Annahme)

Öffentliche Schweizer Zahlen für Verkäufer-Keywords gibt es nicht;
branchenunabhängig nennen Agenturen CHF 5 bis 10 je Klick, für Meta in
der Schweiz CPM CHF 4 bis 15. Daraus als Startannahme:

| Woche | Facebook Ratgeber | Facebook Check | Google | Je Woche |
|---|---|---|---|---|
| 1 und 2 | ZH, TG: CHF 300 | ZH, TG: CHF 100 | ZH, TG: CHF 100 | CHF 500 |
| 3 bis 6 | ZH, TG, ZG, LU: CHF 500 | CHF 300 | CHF 200 | CHF 1'000 |

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
  vermitteln und ankaufen (UWG Art. 3 Abs. 1 lit. b). Auch der Ratgeber
  sagt am Ende, wer ihn schreibt und dass wir selbst kaufen (ein Test
  prüft, dass die Wörter nicht vorkommen).
- **Ratgeber-Inhalte mit Quelle:** Jede rechtliche Aussage ist im
  Gesetzestext nachgesehen (RPG Art. 22, StHG Art. 12 Abs. 3 lit. e).
- **Cookie-Banner mit echter Wahl:** Meta Pixel und Google-Ads-Tag erst
  nach Zustimmung laden, Ablehnen gleich einfach wie Zustimmen (EDÖB-
  Leitfaden vom 6. Oktober 2025).
- **Anrufe:** Sterneintrag im Telefonbuch beachten (lit. u) -- bei Leads,
  die selbst um Kontakt gebeten haben, liegt die Einwilligung vor.

## 9. Was gebaut ist und was fehlt

Gebaut:

- die Check-Seite für alle Marken, mit gesperrtem Rechner, Pflichtangaben
  und geprüfter Schweizer Nummer;
- der Ratgeber mit dem ersten Artikel, auf jeder Marken-Domain;
- die Lead-Speicherung mit Marke, Domain, Antworten, Priorität und
  Herkunft (auch `utm_content=ratgeber-...`), die Anzeige in Bauraum.

Fehlt noch:

1. Domains kaufen und bei Vercel dem Projekt hinzufügen (Julian).
2. Impressum- und Datenschutzangaben: Firmenname, Adresse, UID (Julian).
3. Eine Telefonnummer für "Lieber anrufen?" -- viele Ältere rufen lieber
   an, als ein Formular auszufüllen (Julian).
4. Benachrichtigung bei heissem Lead aufs Telefon -- braucht einen
   Mail- oder SMS-Dienst (Konto bei Julian).
5. Cookie-Banner und Pixel, sobald die Werbekonten stehen.
6. Weitere Ratgeber-Artikel (Erbe, Ausnützung, Garten als Bauland).
7. Französische Fassung für die Romandie, falls gewollt.

## 10. Markt: parzellencheck.ch (Stand 7. November)

Die Seite ist umgebaut. Es gibt keinen Check für Eigentümer mehr und kein
Formular. Sie heisst jetzt "Acquisition Desk" und richtet sich an Käufer
(Investoren, Entwickler, Bestandshalter):

- CHF 3'000 pro Monat, Werbebudget inbegriffen;
- 0,5 % des Kaufpreises bei einem Ankauf;
- Eigentümer werden über Kampagnen gewonnen; auf die Frage "Sind das
  einfach Meta-Leads?" antworten sie: "Nein. Werbung ist nur ein Teil
  der Gewinnung."

Für uns heisst das zweierlei: Um "Parzelle prüfen" bei Eigentümern
konkurriert diese Seite nicht mehr. Und ihr Preismodell zeigt, was
Käufer für einen solchen Zugang bezahlen -- dasselbe könnten wir
Fondsleitungen wie Helvetica anbieten, mit unserem Bestand als Vorsprung.

## Quellen

- Meta, Werbung für Wohnraum, Länder und was dazu zählt (abgerufen 7.11.2026): https://www.facebook.com/business/help/1198401317374558
- Meta, Einschränkungen der Zielgruppen (abgerufen 7.11.2026): https://www.facebook.com/business/help/2220749868045706
- Meta, Formulare mit höherer Absicht: https://www.facebook.com/business/help/252352181957512
- Google, Wohnraum-Richtlinie (nur USA, Kanada): https://support.google.com/adspolicy/answer/16701755
- Google, Geotargets (Datei vom 6.10.2026): https://developers.google.com/google-ads/api/data/geotargets
- Google, Offline-Conversions und Data Manager API: https://support.google.com/google-ads/answer/10029210, https://support.google.com/google-ads/answer/11021502
- Google, Einwilligungsrichtlinie: https://www.google.com/intl/en_uk/about/company/user-consent-policy-help/
- RealAdvisor, Leadpreise und Qualifizierung: https://realadvisor.ch/de/pro/blog/immobilien-leads-kaufen
- Agenturwerte CPC/CPM: https://www.gryps.ch/produkte/seo-agentur-39/, https://digitalm.ch/dienstleistungen/social-media-ads/
- parzellencheck.ch, abgerufen 7.11.2026: https://parzellencheck.ch/
- RPG Art. 22: https://www.fedlex.admin.ch/eli/cc/1979/1573_1573_1573/de#art_22
- StHG Art. 12: https://www.fedlex.admin.ch/eli/cc/1991/1256_1256_1256/de#art_12
- DSG Art. 19: https://www.fedlex.admin.ch/eli/cc/2022/491/de#art_19
- EDÖB, Swiss-US Data Privacy Framework: https://www.edoeb.admin.ch/en/15082024-new-swiss-us-data-privacy-framework
- EDÖB, Cookie-Leitfaden V1.1: https://www.edoeb.admin.ch/dam/de/sd-web/brLL9rM3ny9d/Leitfaden%20des%20ED%C3%96B%20betreffend%20Datenbearbeitungen%20mittels%20Cookies%20und%20%C3%A4hnlichen%20Technologien%20V.%201.1%20vom%2006.10.2025_DE.pdf
- UWG Art. 3: https://www.fedlex.admin.ch/eli/cc/1988/223_223_223/de#art_3

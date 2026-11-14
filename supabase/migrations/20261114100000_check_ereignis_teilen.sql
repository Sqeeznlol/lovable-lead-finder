-- Die Check-Seiten zählen neu, wie oft ein Ergebnis geteilt und der
-- Bericht als PDF gezogen wird (Julian, 14. November: PDF-Bericht und
-- teilbarer Link). Sonst lehnt die Prüfregel die Ereignisse ab.
alter table public.check_ereignis drop constraint if exists check_ereignis_ereignis_check;
alter table public.check_ereignis add constraint check_ereignis_ereignis_check check (ereignis in (
  'aufruf', 'suche', 'ergebnis', 'rechner', 'kontakt', 'lead',
  'ratgeber', 'ratgeber_klick', 'teilen', 'bericht'));

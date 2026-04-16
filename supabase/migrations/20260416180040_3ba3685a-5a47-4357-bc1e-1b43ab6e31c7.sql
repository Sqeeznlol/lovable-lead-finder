-- Master Liste Finale Import: DB leeren und neue Liste anlegen
-- 1) Alle bestehenden Properties löschen (User hat explizit zugestimmt)
DELETE FROM public.export_logs;
DELETE FROM public.phone_search_logs;
DELETE FROM public.property_decisions;
DELETE FROM public.properties;

-- 2) Neue Master-Liste anlegen
INSERT INTO public.property_lists (name, priority, color)
VALUES ('Master Liste Finale', 100, '#3B82F6')
ON CONFLICT DO NOTHING;
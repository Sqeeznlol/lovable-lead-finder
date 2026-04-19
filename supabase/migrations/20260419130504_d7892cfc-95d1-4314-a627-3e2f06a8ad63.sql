-- Lösche leere Listen (verwaiste Gemeinde-Listen ohne Properties)
DELETE FROM public.property_lists 
WHERE id NOT IN (SELECT DISTINCT list_id FROM public.properties WHERE list_id IS NOT NULL);

-- Update counts
UPDATE public.property_lists 
SET property_count = (SELECT COUNT(*) FROM public.properties WHERE list_id = property_lists.id);

-- Master Liste 184k auf höchste Priorität (1)
UPDATE public.property_lists SET priority = 1 WHERE name = 'Master Liste 184k';
UPDATE public.property_lists SET priority = 2 WHERE name = 'Master Liste Finale';
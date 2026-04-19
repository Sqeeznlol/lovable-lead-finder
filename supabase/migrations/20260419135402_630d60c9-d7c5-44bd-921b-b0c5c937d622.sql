UPDATE public.property_lists 
SET property_count = (SELECT COUNT(*) FROM public.properties WHERE list_id = property_lists.id);

DROP TABLE IF EXISTS public.properties_staging;
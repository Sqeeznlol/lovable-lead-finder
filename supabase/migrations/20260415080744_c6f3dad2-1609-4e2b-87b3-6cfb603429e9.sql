
-- Create property_lists table
CREATE TABLE public.property_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  color text DEFAULT NULL,
  property_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.property_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read lists" ON public.property_lists FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert lists" ON public.property_lists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update lists" ON public.property_lists FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete lists" ON public.property_lists FOR DELETE TO authenticated USING (true);
CREATE POLICY "Anon can read lists" ON public.property_lists FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert lists" ON public.property_lists FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update lists" ON public.property_lists FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon can delete lists" ON public.property_lists FOR DELETE TO anon USING (true);

-- Add list_id to properties
ALTER TABLE public.properties ADD COLUMN list_id uuid REFERENCES public.property_lists(id) ON DELETE SET NULL DEFAULT NULL;

-- Create index for fast filtering
CREATE INDEX idx_properties_list_id ON public.properties(list_id);

-- Trigger for updated_at
CREATE TRIGGER update_property_lists_updated_at
  BEFORE UPDATE ON public.property_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

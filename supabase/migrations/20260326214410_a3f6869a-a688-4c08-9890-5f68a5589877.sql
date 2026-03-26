-- Create properties table for real estate listings
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  address TEXT NOT NULL,
  area NUMERIC,
  plot_number TEXT,
  egrid TEXT,
  bfs_nr TEXT,
  streetview_url TEXT,
  owner_name TEXT,
  owner_address TEXT,
  owner_phone TEXT,
  status TEXT NOT NULL DEFAULT 'Neu',
  notes TEXT,
  is_queried BOOLEAN NOT NULL DEFAULT false,
  queried_at TIMESTAMPTZ,
  queried_by_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create phone_numbers table for managing query phones
CREATE TABLE public.phone_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT NOT NULL,
  label TEXT,
  daily_queries_used INTEGER NOT NULL DEFAULT 0,
  last_query_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;

-- Allow all access (single-user tool, no auth needed)
CREATE POLICY "Allow all access to properties" ON public.properties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to phone_numbers" ON public.phone_numbers FOR ALL USING (true) WITH CHECK (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
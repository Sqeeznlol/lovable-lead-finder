-- =====================================================================
-- Bauraum Lead Finder — vollständiges Schema für eine neue Instanz
-- =====================================================================
-- Ein einziges Skript: Tabellen, Policies, Potenzial- und HNF-Rechnung,
-- der Trigger, der jedes Objekt automatisch durchrechnet, und die
-- Import-Funktion für den schnellen Massen-Import.
--
-- Auf einer leeren Supabase-Instanz im SQL-Editor ausführen.
-- Getestet gegen eine frische Postgres-16-Datenbank.
--
-- Hinweis: Zwei Zeilen zu pg_cron und pg_net (optionaler Tages-Digest)
-- schlagen fehl, wenn diese Extensions im Projekt nicht aktiviert sind.
-- Das ist unkritisch -- alles Übrige läuft unabhängig davon.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Quelle: 20260326214410_a3f6869a-a688-4c08-9890-5f68a5589877.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Quelle: 20260326215119_fa07114c-c8fa-44b8-8802-b781ab73b034.sql
-- ---------------------------------------------------------------------
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS plz TEXT,
  ADD COLUMN IF NOT EXISTS ortschaftsname TEXT,
  ADD COLUMN IF NOT EXISTS strassenname TEXT,
  ADD COLUMN IF NOT EXISTS hausnummer TEXT,
  ADD COLUMN IF NOT EXISTS gvz_nr TEXT,
  ADD COLUMN IF NOT EXISTS gwr_egid TEXT,
  ADD COLUMN IF NOT EXISTS gebaeudeart TEXT,
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
  ADD COLUMN IF NOT EXISTS zone TEXT,
  ADD COLUMN IF NOT EXISTS gemeinde TEXT,
  ADD COLUMN IF NOT EXISTS gebaeudeflaeche NUMERIC,
  ADD COLUMN IF NOT EXISTS baujahr INTEGER,
  ADD COLUMN IF NOT EXISTS kategorie TEXT,
  ADD COLUMN IF NOT EXISTS geschosse NUMERIC,
  ADD COLUMN IF NOT EXISTS wohnungen NUMERIC,
  ADD COLUMN IF NOT EXISTS parzelle TEXT,
  ADD COLUMN IF NOT EXISTS geb_status TEXT,
  ADD COLUMN IF NOT EXISTS bezirk TEXT,
  ADD COLUMN IF NOT EXISTS plz_ort TEXT;

CREATE INDEX IF NOT EXISTS idx_properties_egrid ON public.properties(egrid);
CREATE INDEX IF NOT EXISTS idx_properties_gemeinde ON public.properties(gemeinde);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_is_queried ON public.properties(is_queried);

-- ---------------------------------------------------------------------
-- Quelle: 20260326220209_b1e17c09-1259-4235-86ba-df263eb0acba.sql
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_properties_gebaeudeflaeche_area ON public.properties(gebaeudeflaeche DESC NULLS LAST, area DESC NULLS LAST);

-- ---------------------------------------------------------------------
-- Quelle: 20260405081423_5e8bc6f6-3276-4fc3-bed0-f624b00c2755.sql
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_properties_gebaeudeflaeche ON public.properties (gebaeudeflaeche DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_properties_area ON public.properties (area DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_properties_zone ON public.properties (zone);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties (status);
CREATE INDEX IF NOT EXISTS idx_properties_is_queried ON public.properties (is_queried);
CREATE INDEX IF NOT EXISTS idx_properties_geb_status ON public.properties (geb_status);
CREATE INDEX IF NOT EXISTS idx_properties_baujahr ON public.properties (baujahr);
CREATE INDEX IF NOT EXISTS idx_properties_egrid ON public.properties (egrid);

-- ---------------------------------------------------------------------
-- Quelle: 20260406093601_12bef1c3-0e13-492b-8b24-4e2d3a52ae44.sql
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_egrid_unique ON properties (egrid) WHERE egrid IS NOT NULL;

-- ---------------------------------------------------------------------
-- Quelle: 20260408074718_d376d573-cfa9-464d-a590-25fd645d0957.sql
-- ---------------------------------------------------------------------
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_name_2 text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_address_2 text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_phone_2 text;

-- ---------------------------------------------------------------------
-- Quelle: 20260408083152_b24d570c-6632-4de4-b96e-5291214dde8e.sql
-- ---------------------------------------------------------------------
ALTER TABLE public.properties ADD COLUMN owners_json jsonb DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------
-- Quelle: 20260414143822_9fa6a500-0ea0-4da5-95d6-d8c52db4135d.sql
-- ---------------------------------------------------------------------

-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'office', 'mobile_swipe');

-- 2. User roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS on user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Extend properties table
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS acquisition_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS phone_search_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS export_status text NOT NULL DEFAULT 'not_exported',
  ADD COLUMN IF NOT EXISTS ai_score numeric,
  ADD COLUMN IF NOT EXISTS ai_recommendation text,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_priority integer,
  ADD COLUMN IF NOT EXISTS ai_last_analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_by uuid,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_source text,
  ADD COLUMN IF NOT EXISTS pipedrive_deal_id text,
  ADD COLUMN IF NOT EXISTS last_export_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_phone_search_at timestamptz,
  ADD COLUMN IF NOT EXISTS duplicate_flag boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_group_id text;

-- 8. Property decisions (AI learning feedback)
CREATE TABLE public.property_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ai_score numeric,
  ai_recommendation text,
  ai_summary text,
  user_decision text NOT NULL,
  decision_matches_ai boolean,
  feedback_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.property_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read decisions"
  ON public.property_decisions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create decisions"
  ON public.property_decisions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 9. Phone search logs
CREATE TABLE public.phone_search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  phone_number_id uuid REFERENCES public.phone_numbers(id) ON DELETE SET NULL,
  owner_name text,
  search_query text,
  result text,
  status text NOT NULL DEFAULT 'pending',
  error_text text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.phone_search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read search logs"
  ON public.phone_search_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create search logs"
  ON public.phone_search_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update search logs"
  ON public.phone_search_logs FOR UPDATE TO authenticated
  USING (true);

-- 10. Export logs
CREATE TABLE public.export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pipedrive_deal_id text,
  pipedrive_lead_id text,
  status text NOT NULL DEFAULT 'pending',
  error_text text,
  notes_content text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read export logs"
  ON public.export_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create export logs"
  ON public.export_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- 11. Indexes on properties
CREATE INDEX IF NOT EXISTS idx_properties_review_status ON public.properties(review_status);
CREATE INDEX IF NOT EXISTS idx_properties_acquisition_status ON public.properties(acquisition_status);
CREATE INDEX IF NOT EXISTS idx_properties_phone_search_status ON public.properties(phone_search_status);
CREATE INDEX IF NOT EXISTS idx_properties_export_status ON public.properties(export_status);
CREATE INDEX IF NOT EXISTS idx_properties_gemeinde ON public.properties(gemeinde);
CREATE INDEX IF NOT EXISTS idx_properties_bezirk ON public.properties(bezirk);
CREATE INDEX IF NOT EXISTS idx_properties_address ON public.properties(address);
CREATE INDEX IF NOT EXISTS idx_properties_egrid ON public.properties(egrid);
CREATE INDEX IF NOT EXISTS idx_properties_gwr_egid ON public.properties(gwr_egid);
CREATE INDEX IF NOT EXISTS idx_properties_ai_score ON public.properties(ai_score);
CREATE INDEX IF NOT EXISTS idx_properties_ai_recommendation ON public.properties(ai_recommendation);

-- 12. Indexes on new tables
CREATE INDEX IF NOT EXISTS idx_property_decisions_property ON public.property_decisions(property_id);
CREATE INDEX IF NOT EXISTS idx_property_decisions_user ON public.property_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_search_logs_property ON public.phone_search_logs(property_id);
CREATE INDEX IF NOT EXISTS idx_phone_search_logs_status ON public.phone_search_logs(status);
CREATE INDEX IF NOT EXISTS idx_export_logs_property ON public.export_logs(property_id);
CREATE INDEX IF NOT EXISTS idx_export_logs_status ON public.export_logs(status);

-- 13. Update properties RLS to require auth
DROP POLICY IF EXISTS "Allow all access to properties" ON public.properties;

CREATE POLICY "Authenticated users can read properties"
  ON public.properties FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert properties"
  ON public.properties FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update properties"
  ON public.properties FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete properties"
  ON public.properties FOR DELETE TO authenticated
  USING (true);

-- 14. Update phone_numbers RLS to require auth
DROP POLICY IF EXISTS "Allow all access to phone_numbers" ON public.phone_numbers;

CREATE POLICY "Authenticated users can read phone_numbers"
  ON public.phone_numbers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage phone_numbers"
  ON public.phone_numbers FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);


-- ---------------------------------------------------------------------
-- Quelle: 20260414151031_ebe97115-65ed-4fa5-85a3-c73791ea8453.sql
-- ---------------------------------------------------------------------
-- Performance indexes for properties table
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties (status);
CREATE INDEX IF NOT EXISTS idx_properties_review_status ON public.properties (review_status);
CREATE INDEX IF NOT EXISTS idx_properties_acquisition_status ON public.properties (acquisition_status);
CREATE INDEX IF NOT EXISTS idx_properties_phone_search_status ON public.properties (phone_search_status);
CREATE INDEX IF NOT EXISTS idx_properties_export_status ON public.properties (export_status);
CREATE INDEX IF NOT EXISTS idx_properties_gemeinde ON public.properties (gemeinde);
CREATE INDEX IF NOT EXISTS idx_properties_bezirk ON public.properties (bezirk);
CREATE INDEX IF NOT EXISTS idx_properties_zone ON public.properties (zone);
CREATE INDEX IF NOT EXISTS idx_properties_geb_status ON public.properties (geb_status);
CREATE INDEX IF NOT EXISTS idx_properties_baujahr ON public.properties (baujahr);
CREATE INDEX IF NOT EXISTS idx_properties_ai_score ON public.properties (ai_score);
CREATE INDEX IF NOT EXISTS idx_properties_is_queried ON public.properties (is_queried);

-- Composite index for Vorauswahl workflow (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_properties_vorauswahl ON public.properties (is_queried, status, geb_status, zone) 
WHERE geb_status = 'Bestehend' AND zone LIKE 'W%';

-- Composite index for preselected properties
CREATE INDEX IF NOT EXISTS idx_properties_preselected ON public.properties (status, is_queried) 
WHERE status = 'Vorausgewählt' AND is_queried = false;

-- Add processing_error column
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS processing_error text;

-- Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  target_table text,
  target_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can create audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs (target_table, target_id);

-- ---------------------------------------------------------------------
-- Quelle: 20260414152532_6bc101f3-f685-4fdc-abd7-bbb79522bb89.sql
-- ---------------------------------------------------------------------

-- Allow anonymous (non-authenticated) users to read and write properties
CREATE POLICY "Anon users can read properties"
ON public.properties FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can insert properties"
ON public.properties FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon users can update properties"
ON public.properties FOR UPDATE TO anon USING (true);

CREATE POLICY "Anon users can delete properties"
ON public.properties FOR DELETE TO anon USING (true);

-- Allow anon access to phone_numbers
CREATE POLICY "Anon users can read phone_numbers"
ON public.phone_numbers FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can manage phone_numbers"
ON public.phone_numbers FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow anon access to phone_search_logs
CREATE POLICY "Anon users can read phone_search_logs"
ON public.phone_search_logs FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can insert phone_search_logs"
ON public.phone_search_logs FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon users can update phone_search_logs"
ON public.phone_search_logs FOR UPDATE TO anon USING (true);

-- Allow anon access to export_logs
CREATE POLICY "Anon users can read export_logs"
ON public.export_logs FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can insert export_logs"
ON public.export_logs FOR INSERT TO anon WITH CHECK (true);

-- Allow anon access to property_decisions
CREATE POLICY "Anon users can read property_decisions"
ON public.property_decisions FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can insert property_decisions"
ON public.property_decisions FOR INSERT TO anon WITH CHECK (true);

-- Allow anon access to audit_logs
CREATE POLICY "Anon users can read audit_logs"
ON public.audit_logs FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can insert audit_logs"
ON public.audit_logs FOR INSERT TO anon WITH CHECK (true);


-- ---------------------------------------------------------------------
-- Quelle: 20260415080744_c6f3dad2-1609-4e2b-87b3-6cfb603429e9.sql
-- ---------------------------------------------------------------------

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


-- ---------------------------------------------------------------------
-- Quelle: 20260415160227_94a22ab0-21d8-4e4b-bbe4-7d03ab18b924.sql
-- ---------------------------------------------------------------------
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS denkmalschutz text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS isos text;

-- ---------------------------------------------------------------------
-- Quelle: 20260416180040_3ba3685a-5a47-4357-bc1e-1b43ab6e31c7.sql
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Quelle: 20260416180115_a334fb3e-afa4-4189-a9a4-08cb83c00c0a.sql
-- ---------------------------------------------------------------------
UPDATE public.property_lists
SET property_count = (
  SELECT COUNT(*) FROM public.properties WHERE list_id = property_lists.id
)
WHERE name = 'Master Liste Finale';

-- ---------------------------------------------------------------------
-- Quelle: 20260419130230_30bc1c46-d768-405a-a853-700a865f3f0c.sql
-- ---------------------------------------------------------------------
-- 1. Neue Master-Liste anlegen
INSERT INTO public.property_lists (name, priority, color, property_count)
VALUES ('Master Liste 184k', 50, '#3b82f6', 0)
ON CONFLICT DO NOTHING;

-- 2. Alle Properties OHNE Telefon löschen (Smart Merge: Tel-Einträge bleiben)
DELETE FROM public.export_logs 
WHERE property_id IN (SELECT id FROM public.properties WHERE owner_phone IS NULL OR owner_phone = '');

DELETE FROM public.phone_search_logs 
WHERE property_id IN (SELECT id FROM public.properties WHERE owner_phone IS NULL OR owner_phone = '');

DELETE FROM public.property_decisions 
WHERE property_id IN (SELECT id FROM public.properties WHERE owner_phone IS NULL OR owner_phone = '');

DELETE FROM public.properties WHERE owner_phone IS NULL OR owner_phone = '';

-- 3. Unique-Index auf EGRID (falls noch nicht vorhanden)
CREATE UNIQUE INDEX IF NOT EXISTS properties_egrid_unique ON public.properties(egrid) WHERE egrid IS NOT NULL;

-- 4. Staging-Tabelle für Import
DROP TABLE IF EXISTS public.properties_staging;
CREATE TABLE public.properties_staging (
  address text,
  egrid text,
  plot_number text,
  parzelle text,
  bfs_nr text,
  gwr_egid text,
  gvz_nr text,
  gebaeudeart text,
  strassenname text,
  hausnummer text,
  plz text,
  plz_ort text,
  gemeinde text,
  ortschaftsname text,
  bezirk text,
  google_maps_url text,
  streetview_url text,
  zone text,
  area numeric,
  gebaeudeflaeche numeric,
  baujahr integer,
  kategorie text,
  geschosse numeric,
  wohnungen numeric,
  geb_status text,
  denkmalschutz text,
  isos text
);

-- ---------------------------------------------------------------------
-- Quelle: 20260419130504_d7892cfc-95d1-4314-a627-3e2f06a8ad63.sql
-- ---------------------------------------------------------------------
-- Lösche leere Listen (verwaiste Gemeinde-Listen ohne Properties)
DELETE FROM public.property_lists 
WHERE id NOT IN (SELECT DISTINCT list_id FROM public.properties WHERE list_id IS NOT NULL);

-- Update counts
UPDATE public.property_lists 
SET property_count = (SELECT COUNT(*) FROM public.properties WHERE list_id = property_lists.id);

-- Master Liste 184k auf höchste Priorität (1)
UPDATE public.property_lists SET priority = 1 WHERE name = 'Master Liste 184k';
UPDATE public.property_lists SET priority = 2 WHERE name = 'Master Liste Finale';

-- ---------------------------------------------------------------------
-- Quelle: 20260419135138_739606b0-d407-4c59-ae78-0ddba5f1a30b.sql
-- ---------------------------------------------------------------------
-- 1. Komplett-Reset: alle abhängigen Daten löschen
DELETE FROM public.export_logs;
DELETE FROM public.phone_search_logs;
DELETE FROM public.property_decisions;
DELETE FROM public.properties;
DELETE FROM public.property_lists;

-- 2. Neue Master-Liste anlegen
INSERT INTO public.property_lists (name, priority, color, property_count)
VALUES ('Lovable Master', 1, '#3b82f6', 0);

-- 3. Unique-Index auf EGRID sicherstellen
CREATE UNIQUE INDEX IF NOT EXISTS properties_egrid_unique ON public.properties(egrid) WHERE egrid IS NOT NULL;

-- 4. Staging-Tabelle für Bulk-Import
DROP TABLE IF EXISTS public.properties_staging;
CREATE TABLE public.properties_staging (
  address text,
  egrid text,
  plot_number text,
  parzelle text,
  bfs_nr text,
  gwr_egid text,
  gvz_nr text,
  gebaeudeart text,
  strassenname text,
  hausnummer text,
  plz text,
  plz_ort text,
  gemeinde text,
  ortschaftsname text,
  bezirk text,
  google_maps_url text,
  streetview_url text,
  zone text,
  area numeric,
  gebaeudeflaeche numeric,
  baujahr integer,
  kategorie text,
  geschosse numeric,
  wohnungen numeric,
  geb_status text,
  denkmalschutz text,
  isos text
);

-- ---------------------------------------------------------------------
-- Quelle: 20260419135402_630d60c9-d7c5-44bd-921b-b0c5c937d622.sql
-- ---------------------------------------------------------------------
UPDATE public.property_lists 
SET property_count = (SELECT COUNT(*) FROM public.properties WHERE list_id = property_lists.id);

DROP TABLE IF EXISTS public.properties_staging;

-- ---------------------------------------------------------------------
-- Quelle: 20260424082053_58a8d935-7339-42a7-abf5-0060ab25dbfc.sql
-- ---------------------------------------------------------------------
-- ===========================================
-- 1. PROPERTIES: Neue Felder für Master-Modell
-- ===========================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS hnf_schaetzung numeric,
  ADD COLUMN IF NOT EXISTS wohnflaeche numeric,
  ADD COLUMN IF NOT EXISTS nutzflaeche numeric,
  ADD COLUMN IF NOT EXISTS renovationsjahr integer,
  ADD COLUMN IF NOT EXISTS ausnuetzung numeric,
  ADD COLUMN IF NOT EXISTS preselection_status text NOT NULL DEFAULT 'Nicht geprüft',
  ADD COLUMN IF NOT EXISTS preselection_note text,
  ADD COLUMN IF NOT EXISTS preselection_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_to text,
  ADD COLUMN IF NOT EXISTS source_file text,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS denkmalschutz_titel text,
  ADD COLUMN IF NOT EXISTS isos_titel text,
  ADD COLUMN IF NOT EXISTS bezirksort text,
  ADD COLUMN IF NOT EXISTS objektadresse text,
  ADD COLUMN IF NOT EXISTS kanton text DEFAULT 'ZH',
  ADD COLUMN IF NOT EXISTS housing_stat_url text,
  ADD COLUMN IF NOT EXISTS gis_url text,
  ADD COLUMN IF NOT EXISTS contact_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz;

-- Add CHECK-like default for preselection_status (allow free-text but recommend set)
COMMENT ON COLUMN public.properties.preselection_status IS
  'Vorwahl/Vorselektion: Nicht geprüft | Sehr interessant | Potenzial vorhanden | Später prüfen | Kein Potenzial | Ausschliessen';

COMMENT ON COLUMN public.properties.status IS
  'Akquise-Status: Neu | In Prüfung | Interessant | Nicht interessant | Eigentümer gesucht | Eigentümer gefunden | Eigentümer ermittelt | Telefonnummer gesucht | Telefon gefunden | Kontaktiert | Kein Interesse | Interesse vorhanden | Termin vereinbart | Follow-up | Exportiert | Archiviert | Ausgeblendet | Vorausgewählt | Geringe Chance | Post';

-- ===========================================
-- 2. INDEXES für Master-Liste & Filter
-- ===========================================

-- Eindeutiger Index auf EGRID (verhindert Duplikate auf DB-Ebene)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_properties_egrid
  ON public.properties (egrid)
  WHERE egrid IS NOT NULL AND egrid <> '';

-- Filter-Indexe
CREATE INDEX IF NOT EXISTS idx_properties_gemeinde         ON public.properties (gemeinde);
CREATE INDEX IF NOT EXISTS idx_properties_bezirk           ON public.properties (bezirk);
CREATE INDEX IF NOT EXISTS idx_properties_plz              ON public.properties (plz);
CREATE INDEX IF NOT EXISTS idx_properties_status           ON public.properties (status);
CREATE INDEX IF NOT EXISTS idx_properties_preselection     ON public.properties (preselection_status);
CREATE INDEX IF NOT EXISTS idx_properties_kategorie        ON public.properties (kategorie);
CREATE INDEX IF NOT EXISTS idx_properties_baujahr          ON public.properties (baujahr);
CREATE INDEX IF NOT EXISTS idx_properties_geb_status       ON public.properties (geb_status);
CREATE INDEX IF NOT EXISTS idx_properties_gebaeudeflaeche  ON public.properties (gebaeudeflaeche);
CREATE INDEX IF NOT EXISTS idx_properties_area             ON public.properties (area);
CREATE INDEX IF NOT EXISTS idx_properties_imported_at      ON public.properties (imported_at);
CREATE INDEX IF NOT EXISTS idx_properties_follow_up_at     ON public.properties (follow_up_at);

-- Composite for typical Master-Liste Query (Gemeinde + Status)
CREATE INDEX IF NOT EXISTS idx_properties_gemeinde_status
  ON public.properties (gemeinde, status);

-- ===========================================
-- 3. IMPORT_LOGS Tabelle
-- ===========================================

CREATE TABLE IF NOT EXISTS public.import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  list_id uuid REFERENCES public.property_lists(id) ON DELETE SET NULL,
  list_name text,
  rows_total integer NOT NULL DEFAULT 0,
  rows_inserted integer NOT NULL DEFAULT 0,
  rows_updated integer NOT NULL DEFAULT 0,
  rows_duplicates integer NOT NULL DEFAULT 0,
  rows_invalid integer NOT NULL DEFAULT 0,
  new_gemeinden integer NOT NULL DEFAULT 0,
  user_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read import_logs" ON public.import_logs;
CREATE POLICY "Anyone can read import_logs"
  ON public.import_logs FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can insert import_logs" ON public.import_logs;
CREATE POLICY "Anyone can insert import_logs"
  ON public.import_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_import_logs_created_at ON public.import_logs (created_at DESC);

-- ===========================================
-- 4. SAVED_FILTERS Tabelle
-- ===========================================

CREATE TABLE IF NOT EXISTS public.saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'master', -- master | akquise | vorwahl
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read saved_filters" ON public.saved_filters;
CREATE POLICY "Anyone can read saved_filters"
  ON public.saved_filters FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can manage saved_filters" ON public.saved_filters;
CREATE POLICY "Anyone can manage saved_filters"
  ON public.saved_filters FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_saved_filters_updated_at ON public.saved_filters;
CREATE TRIGGER trg_saved_filters_updated_at
  BEFORE UPDATE ON public.saved_filters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- 5. EXPORT_LOGS: Filter-Snapshot ergänzen
-- ===========================================

ALTER TABLE public.export_logs
  ADD COLUMN IF NOT EXISTS export_name text,
  ADD COLUMN IF NOT EXISTS filters jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS row_count integer DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_export_logs_created_at ON public.export_logs (created_at DESC);

-- ---------------------------------------------------------------------
-- Quelle: 20260424161759_c758843f-e8bd-4b08-92f5-b091ce059e2a.sql
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.gemeinde_stats()
RETURNS TABLE (
  gemeinde text,
  total bigint,
  offen bigint,
  geprueft bigint,
  interessant bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(p.gemeinde, '— ohne Gemeinde —') AS gemeinde,
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (
      WHERE p.preselection_status = 'Nicht geprüft'
         OR p.status IN ('Neu','In Prüfung')
    )::bigint AS offen,
    COUNT(*) FILTER (
      WHERE NOT (
        p.preselection_status = 'Nicht geprüft'
         OR p.status IN ('Neu','In Prüfung')
      )
    )::bigint AS geprueft,
    COUNT(*) FILTER (
      WHERE p.preselection_status IN ('Sehr interessant','Potenzial vorhanden')
         OR p.status IN ('Interessant','Interesse vorhanden','Termin vereinbart')
    )::bigint AS interessant
  FROM public.properties p
  GROUP BY COALESCE(p.gemeinde, '— ohne Gemeinde —')
  ORDER BY total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.gemeinde_stats() TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_properties_gemeinde ON public.properties(gemeinde);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_preselection_status ON public.properties(preselection_status);


-- ---------------------------------------------------------------------
-- Quelle: 20260428103706_9ef40416-bc51-4f1a-a502-5e3394e6b862.sql
-- ---------------------------------------------------------------------
-- Add index to speed up gemeinde aggregation
CREATE INDEX IF NOT EXISTS idx_properties_gemeinde_status 
ON public.properties (gemeinde, preselection_status, status);

-- Materialized view for fast gemeinde stats
DROP MATERIALIZED VIEW IF EXISTS public.gemeinde_stats_mv;
CREATE MATERIALIZED VIEW public.gemeinde_stats_mv AS
SELECT
  COALESCE(p.gemeinde, '— ohne Gemeinde —') AS gemeinde,
  COUNT(*)::bigint AS total,
  COUNT(*) FILTER (
    WHERE p.preselection_status = 'Nicht geprüft'
       OR p.status IN ('Neu','In Prüfung')
  )::bigint AS offen,
  COUNT(*) FILTER (
    WHERE NOT (
      p.preselection_status = 'Nicht geprüft'
       OR p.status IN ('Neu','In Prüfung')
    )
  )::bigint AS geprueft,
  COUNT(*) FILTER (
    WHERE p.preselection_status IN ('Sehr interessant','Potenzial vorhanden')
       OR p.status IN ('Interessant','Interesse vorhanden','Termin vereinbart')
  )::bigint AS interessant
FROM public.properties p
GROUP BY COALESCE(p.gemeinde, '— ohne Gemeinde —');

CREATE UNIQUE INDEX idx_gemeinde_stats_mv_gemeinde ON public.gemeinde_stats_mv (gemeinde);

-- Replace RPC to read from materialized view (instant)
CREATE OR REPLACE FUNCTION public.gemeinde_stats()
RETURNS TABLE(gemeinde text, total bigint, offen bigint, geprueft bigint, interessant bigint)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT gemeinde, total, offen, geprueft, interessant
  FROM public.gemeinde_stats_mv
  ORDER BY total DESC;
$function$;

-- Refresh function (callable via RPC)
CREATE OR REPLACE FUNCTION public.refresh_gemeinde_stats()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.gemeinde_stats_mv;
$function$;

GRANT SELECT ON public.gemeinde_stats_mv TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_gemeinde_stats() TO anon, authenticated;

-- ---------------------------------------------------------------------
-- Quelle: 20260503134734_771708bd-93de-44c9-86a2-ebc6fe79bd70.sql
-- ---------------------------------------------------------------------

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_stage_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_stage_changed ON public.properties;
CREATE TRIGGER trg_properties_stage_changed
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_stage_changed_at();

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
CREATE POLICY "Anyone can read app_settings" ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can write app_settings" ON public.app_settings;
CREATE POLICY "Anyone can write app_settings" ON public.app_settings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.app_settings (key, value) VALUES
  ('automation', '{"sms_auto_confirm":false,"auto_advance":true,"daily_digest":false,"follow_up_days":3,"stagnation_days":7}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_properties_stage_changed_at ON public.properties (stage_changed_at);


-- ---------------------------------------------------------------------
-- Quelle: 20260503135036_944a84c2-91b3-42dc-a847-b4ba70672dca.sql
-- ---------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ---------------------------------------------------------------------
-- Quelle: 20260503140132_0811b0df-1714-46fb-a229-8a2581227f0d.sql
-- ---------------------------------------------------------------------
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS eigentuemer_name text,
  ADD COLUMN IF NOT EXISTS eigentuemer_adresse text,
  ADD COLUMN IF NOT EXISTS eigentuemer_plz_ort text,
  ADD COLUMN IF NOT EXISTS eigentuemer_fetched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_properties_eigentuemer_name ON public.properties(eigentuemer_name) WHERE eigentuemer_name IS NOT NULL;

-- ---------------------------------------------------------------------
-- Quelle: 20260825190000_potenzial_berechnung.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Automatische Potenzial- und Investitionsrechnung
-- =====================================================================
-- Füllt hnf_bestand / hnf_neu / hnf_delta / hnf_faktor / reserve_gf /
-- reserve_quote / ausnuetzung / deal_score / score_tier / score_killers /
-- score_reasons für alle Liegenschaften — einmalig für den Bestand und
-- danach automatisch per Trigger bei jedem Insert/Update.
--
-- Spiegelt src/lib/potential.ts. Wer die Annahmen ändert (AZ pro Zone,
-- Baukosten, Erlös), ändert sie in public.potenzial_config und ruft
-- public.recompute_potenzial() auf.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Zusätzliche Ergebnis-Spalten
-- ---------------------------------------------------------------------
-- Diese Kennzahlen-Spalten existierten in der Produktionsinstanz bereits von
-- Hand; auf einer frischen Instanz gibt es sie nicht. Deshalb hier vollständig
-- anlegen, damit das Skript auf einer leeren Datenbank durchläuft.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS vollgeschosse   numeric,
  ADD COLUMN IF NOT EXISTS geschosse       numeric,
  ADD COLUMN IF NOT EXISTS nutzflaeche     numeric,
  ADD COLUMN IF NOT EXISTS hnf_bestand     numeric,
  ADD COLUMN IF NOT EXISTS hnf_neu         numeric,
  ADD COLUMN IF NOT EXISTS hnf_delta       numeric,
  ADD COLUMN IF NOT EXISTS hnf_faktor      numeric,
  ADD COLUMN IF NOT EXISTS reserve_gf      numeric,
  ADD COLUMN IF NOT EXISTS reserve_quote   numeric,
  ADD COLUMN IF NOT EXISTS deal_score      numeric,
  ADD COLUMN IF NOT EXISTS score_tier      text,
  ADD COLUMN IF NOT EXISTS score_killers   jsonb,
  ADD COLUMN IF NOT EXISTS score_reasons   jsonb,
  ADD COLUMN IF NOT EXISTS scored_at       timestamptz,
  ADD COLUMN IF NOT EXISTS gf_zulaessig    numeric,
  ADD COLUMN IF NOT EXISTS gf_bestand      numeric,
  ADD COLUMN IF NOT EXISTS az_quelle       text,
  ADD COLUMN IF NOT EXISTS investition_chf numeric,
  ADD COLUMN IF NOT EXISTS erloes_chf      numeric,
  ADD COLUMN IF NOT EXISTS marge_chf       numeric,
  ADD COLUMN IF NOT EXISTS marge_quote     numeric,
  ADD COLUMN IF NOT EXISTS potenzial_score integer,
  ADD COLUMN IF NOT EXISTS confidence      text,
  ADD COLUMN IF NOT EXISTS ausgeschlossen  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ausschluss_grund text;

COMMENT ON COLUMN public.properties.gf_zulaessig    IS 'Zulässige anrechenbare Geschossfläche in m² (Grundstück × AZ)';
COMMENT ON COLUMN public.properties.gf_bestand      IS 'Heute genutzte Geschossfläche in m² (Gebäudefläche × Geschosse)';
COMMENT ON COLUMN public.properties.reserve_gf      IS 'Ungenutzte Reserve in m² aGF, nie negativ';
COMMENT ON COLUMN public.properties.reserve_quote   IS 'Reserve / zulässige aGF, 0–1';
COMMENT ON COLUMN public.properties.potenzial_score IS 'Automatischer Potenzial-Score 0–100 (siehe src/lib/potential.ts)';
COMMENT ON COLUMN public.properties.confidence      IS 'Verlässlichkeit der Rechnung: hoch | mittel | tief | keine';
COMMENT ON COLUMN public.properties.ausgeschlossen  IS 'Nicht kauf-/entwickelbar (Nicht-Bauzone oder Denkmalschutz) — aus allen Arbeitslisten ausgeblendet';

-- ---------------------------------------------------------------------
-- 2. Konfigurationstabelle (Annahmen, zentral änderbar)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.potenzial_config (
  id                 boolean PRIMARY KEY DEFAULT true CHECK (id),
  az_by_zone         jsonb   NOT NULL DEFAULT '{
    "W":0.35,"W2":0.45,"W2G":0.5,"W3":0.6,"W3G":0.65,"W4":0.75,"W4G":0.8,
    "W5":0.9,"W6":1.1,"W7":1.3,"WG":0.55,"WG2":0.55,"WG3":0.7,"WG4":0.85,
    "K":1.0,"Z":0.8
  }'::jsonb,
  hnf_faktor         numeric NOT NULL DEFAULT 0.8,
  baukosten_pro_m2   numeric NOT NULL DEFAULT 3200,
  erloes_pro_m2_hnf  numeric NOT NULL DEFAULT 9500,
  min_reserve_m2     numeric NOT NULL DEFAULT 80,
  ziel_reserve_quote numeric NOT NULL DEFAULT 0.35,
  -- Ziffer im Zonennamen ("Wohnzone 1.6"): Baumassenziffer oder Ausnützung?
  ziffer_als_bmz     boolean NOT NULL DEFAULT true,
  geschosshoehe      numeric NOT NULL DEFAULT 3.2,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.potenzial_config
  ADD COLUMN IF NOT EXISTS ziffer_als_bmz boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS geschosshoehe  numeric NOT NULL DEFAULT 3.2;

INSERT INTO public.potenzial_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.potenzial_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read potenzial_config" ON public.potenzial_config;
CREATE POLICY "Anyone can read potenzial_config"
  ON public.potenzial_config FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can update potenzial_config" ON public.potenzial_config;
CREATE POLICY "Authenticated can update potenzial_config"
  ON public.potenzial_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 3. Zone normalisieren ("W3 (3 Vollgeschosse)" -> "W3")
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.norm_zone(z text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN z IS NULL OR btrim(z) = '' THEN NULL
    ELSE COALESCE(
      (regexp_match(upper(regexp_replace(z, '\s+', '', 'g')), '^([WKZ]{1,2}G?[0-9]?G?)'))[1],
      upper(btrim(z))
    )
  END
$$;

-- ---------------------------------------------------------------------
-- 3b. Textfelder und Nicht-Bauzonen auswerten
-- ---------------------------------------------------------------------
-- Die Listen schreiben "nicht vorhanden" bzw. "Kein Denkmalschutzobjekt im
-- Perimeter" statt leer zu lassen. Eine Prüfung auf "Feld gefüllt" würde
-- deshalb fast jedes Objekt als geschützt aussortieren.
CREATE OR REPLACE FUNCTION public.ist_vorhanden(v text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN v IS NULL THEN false
    WHEN lower(btrim(v)) IN ('', 'none', 'null', '-') THEN false
    WHEN lower(btrim(v)) ~ '^(nicht vorhanden|kein|keine|nein|no|n/a)' THEN false
    ELSE true
  END
$$;

-- Landwirtschaft, Wald, Freihalte-/Erholungszonen: nicht bebaubar.
CREATE OR REPLACE FUNCTION public.ist_keine_bauzone(z text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    z ~* 'landwirtschaftszone|wald|freihaltezone|erholungszone|gew(ä|ae)sser|reservezone|verkehrszone',
    false
  )
$$;

-- ---------------------------------------------------------------------
-- 3c. Zonen-Freitext auswerten
-- ---------------------------------------------------------------------
-- Die ZH-Listen liefern Zonen als Fliesstext, nicht als "W3":
--   "Wohnzone 1.6 (rechtskräftig, 8460m², 95%)"  -> Ziffer 1.6
--   "3-geschossige Wohnzone 2.5"                 -> 3 Geschosse, Ziffer 2.5
--   "Wohnzone 2/50"                              -> 2 Geschosse, ÜZ 50%
-- Der Klammerzusatz nennt Flächen der Zone, nicht des Grundstücks, und
-- muss vor dem Parsen weg — sonst wird "8460" als Ziffer gelesen.
CREATE OR REPLACE FUNCTION public.zone_parse(z text)
RETURNS TABLE (ziffer numeric, geschosse numeric, ueberbauungsziffer numeric, kurz text)
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  t text;
  m text[];
BEGIN
  ziffer := NULL; geschosse := NULL; ueberbauungsziffer := NULL; kurz := NULL;
  IF z IS NULL OR btrim(z) = '' THEN RETURN NEXT; RETURN; END IF;

  t := btrim(regexp_replace(z, '\([^)]*\)', ' ', 'g'));

  -- Bereits normierte Kurzform, z.B. "W3" oder "W4G"
  m := regexp_match(upper(regexp_replace(t, '\s+', '', 'g')), '^([WKZ]{1,2}G?[0-9]?G?)$');
  IF m IS NOT NULL THEN kurz := m[1]; RETURN NEXT; RETURN; END IF;

  m := regexp_match(t, '([0-9]+)\s*-?\s*geschossig', 'i');
  IF m IS NOT NULL THEN geschosse := m[1]::numeric; END IF;

  m := regexp_match(t, '([0-9]+)\s*/\s*([0-9]{2,3})');
  IF m IS NOT NULL THEN
    geschosse := COALESCE(geschosse, m[1]::numeric);
    ueberbauungsziffer := m[2]::numeric;
  ELSE
    m := regexp_match(t, '([0-9]+[.,][0-9]+)');
    IF m IS NOT NULL THEN ziffer := replace(m[1], ',', '.')::numeric; END IF;
  END IF;

  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Kernrechnung — eine Zeile rein, alle Kennzahlen raus
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calc_potenzial(
  p_zone           text,
  p_ausnuetzung    numeric,
  p_area           numeric,
  p_gebaeudeflaeche numeric,
  p_geschosse      numeric,
  p_vollgeschosse  numeric,
  p_baujahr        integer,
  p_renovationsjahr integer,
  p_denkmalschutz  text,
  p_isos           text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  cfg           public.potenzial_config%ROWTYPE;
  v_zone        text;
  v_p           record;
  v_az          numeric;
  v_az_quelle   text;
  v_geschosse   numeric;
  v_gf_zul      numeric;
  v_gf_best     numeric;
  v_raw_reserve numeric;
  v_reserve     numeric;
  v_quote       numeric;
  v_hnf_best    numeric;
  v_hnf_neu     numeric;
  v_hnf_delta   numeric;
  v_invest      numeric;
  v_erloes      numeric;
  v_marge       numeric;
  v_marge_q     numeric;
  v_killer      text[] := ARRAY[]::text[];
  v_reasons     text[] := ARRAY[]::text[];
  v_conf        text := 'keine';
  v_score       numeric := 0;
  v_bj          integer;
  -- Fallback: zulässige Vollgeschosse pro Zone, falls keine AZ hinterlegt ist
  v_geschosse_zone jsonb := '{
    "W":2,"W2":2,"W2G":2,"W3":3,"W3G":3,"W4":4,"W4G":4,"W5":5,"W6":6,"W7":7,
    "WG":2,"WG2":2,"WG3":3,"WG4":4,"K":4,"Z":3
  }'::jsonb;
BEGIN
  SELECT * INTO cfg FROM public.potenzial_config WHERE id LIMIT 1;
  v_zone := public.norm_zone(p_zone);

  -- Ausnützungsziffer: Objektwert vor Zonentabelle vor Geschoss-Heuristik.
  -- Nicht-Bauzonen bekommen gar keine.
  IF public.ist_keine_bauzone(p_zone) THEN
    v_az := NULL;
  ELSIF p_ausnuetzung IS NOT NULL AND p_ausnuetzung > 0 AND p_ausnuetzung < 5 THEN
    v_az := p_ausnuetzung;
    v_az_quelle := 'objekt';
  ELSE
    SELECT * INTO v_p FROM public.zone_parse(p_zone);

    IF v_p.ziffer IS NOT NULL AND v_p.ziffer > 0 THEN
      -- Ziffer aus dem Zonennamen; als BMZ über die Geschosshöhe umrechnen
      v_az := CASE WHEN cfg.ziffer_als_bmz
                   THEN v_p.ziffer / NULLIF(cfg.geschosshoehe, 0)
                   ELSE v_p.ziffer END;
      v_az_quelle := 'zone';
    ELSIF v_p.geschosse IS NOT NULL AND v_p.ueberbauungsziffer IS NOT NULL THEN
      v_az := v_p.geschosse * (v_p.ueberbauungsziffer / 100);
      v_az_quelle := 'zone';
    ELSIF v_p.kurz IS NOT NULL AND cfg.az_by_zone ? v_p.kurz THEN
      v_az := (cfg.az_by_zone ->> v_p.kurz)::numeric;
      v_az_quelle := 'zone';
    ELSIF v_p.geschosse IS NOT NULL THEN
      v_az := v_p.geschosse * 0.3;
      v_az_quelle := 'geschosse';
    ELSIF v_p.kurz IS NOT NULL AND v_geschosse_zone ? v_p.kurz THEN
      v_az := (v_geschosse_zone ->> v_p.kurz)::numeric * 0.3;
      v_az_quelle := 'geschosse';
    END IF;
  END IF;

  IF v_az IS NOT NULL AND p_area IS NOT NULL AND p_area > 0 THEN
    v_gf_zul := p_area * v_az;
  END IF;

  v_geschosse := COALESCE(NULLIF(p_geschosse, 0), NULLIF(p_vollgeschosse, 0));
  IF p_gebaeudeflaeche IS NOT NULL AND p_gebaeudeflaeche > 0 THEN
    IF v_geschosse IS NOT NULL AND v_geschosse > 0 THEN
      v_gf_best := p_gebaeudeflaeche * v_geschosse;
    ELSE
      v_gf_best := p_gebaeudeflaeche * 2;   -- konservative Annahme
      v_reasons := v_reasons || 'Geschosse unbekannt — 2 Vollgeschosse angenommen'::text;
    END IF;
  END IF;

  IF v_gf_zul IS NOT NULL AND v_gf_best IS NOT NULL THEN
    v_raw_reserve := v_gf_zul - v_gf_best;
    v_reserve := GREATEST(v_raw_reserve, 0);
    IF v_gf_zul > 0 THEN v_quote := v_reserve / v_gf_zul; END IF;
    IF v_raw_reserve < 0 THEN
      v_killer := v_killer || 'Bestand überschreitet Zone (Besitzstand)'::text;
    END IF;
  END IF;

  v_hnf_best  := v_gf_best * cfg.hnf_faktor;
  v_hnf_neu   := v_gf_zul  * cfg.hnf_faktor;
  IF v_hnf_neu IS NOT NULL AND v_hnf_best IS NOT NULL THEN
    v_hnf_delta := GREATEST(v_hnf_neu - v_hnf_best, 0);
  END IF;

  v_invest := v_reserve   * cfg.baukosten_pro_m2;
  v_erloes := v_hnf_delta * cfg.erloes_pro_m2_hnf;
  v_marge  := v_erloes - v_invest;
  IF v_invest IS NOT NULL AND v_invest > 0 THEN
    v_marge_q := v_marge / v_invest;
  END IF;

  -- Killer-Kriterien
  IF public.ist_vorhanden(p_denkmalschutz) THEN
    v_killer := v_killer || 'Denkmalschutz'::text;
  END IF;
  IF public.ist_vorhanden(p_isos) THEN
    v_killer := v_killer || 'ISOS-Ortsbild'::text;
  END IF;
  IF public.ist_keine_bauzone(p_zone) THEN
    v_killer := v_killer || 'Keine Bauzone'::text;
  END IF;
  IF v_reserve IS NOT NULL AND v_reserve < cfg.min_reserve_m2 THEN
    v_killer := v_killer || ('Reserve < ' || cfg.min_reserve_m2 || ' m²')::text;
  END IF;

  -- Verlässlichkeit
  IF v_gf_zul IS NOT NULL AND v_gf_best IS NOT NULL THEN
    IF v_az_quelle = 'objekt' AND v_geschosse IS NOT NULL THEN v_conf := 'hoch';
    ELSIF v_az_quelle = 'zone' AND v_geschosse IS NOT NULL THEN v_conf := 'mittel';
    ELSE v_conf := 'tief';
    END IF;
  END IF;

  -- Score 0–100 (identisch zu potentialScore() im Frontend)
  IF v_reserve IS NOT NULL THEN
    v_score := LEAST(v_reserve / 1500, 1) * 35
             + LEAST(COALESCE(v_quote, 0) / NULLIF(cfg.ziel_reserve_quote, 0), 1) * 30
             + LEAST(GREATEST(COALESCE(v_marge_q, 0), 0) / 0.5, 1) * 15;

    v_bj := COALESCE(p_renovationsjahr, p_baujahr);
    IF v_bj IS NOT NULL THEN
      v_score := v_score + CASE
        WHEN v_bj <= 1930 THEN 15
        WHEN v_bj <= 1960 THEN 12
        WHEN v_bj <= 1975 THEN 8
        WHEN v_bj <= 1990 THEN 4
        ELSE 0 END;
    END IF;

    v_score := v_score + LEAST(COALESCE(v_az, 0) / 1.3, 1) * 5;
    v_score := v_score - COALESCE(array_length(v_killer, 1), 0) * 25;
    v_score := GREATEST(0, LEAST(100, v_score));
  END IF;

  IF v_az_quelle IS NOT NULL THEN
    v_reasons := v_reasons || ('AZ ' || v_az || ' (' || v_az_quelle || ')')::text;
  END IF;

  RETURN jsonb_build_object(
    'ausnuetzung',     v_az,
    'az_quelle',       v_az_quelle,
    'gf_zulaessig',    round(v_gf_zul),
    'gf_bestand',      round(v_gf_best),
    'reserve_gf',      round(v_reserve),
    'reserve_quote',   round(v_quote, 3),
    'hnf_faktor',      cfg.hnf_faktor,
    'hnf_bestand',     round(v_hnf_best),
    'hnf_neu',         round(v_hnf_neu),
    'hnf_delta',       round(v_hnf_delta),
    'investition_chf', round(v_invest),
    'erloes_chf',      round(v_erloes),
    'marge_chf',       round(v_marge),
    'marge_quote',     round(v_marge_q, 3),
    'potenzial_score', round(v_score)::int,
    'confidence',      v_conf,
    'killer',          to_jsonb(v_killer),
    'reasons',         to_jsonb(v_reasons)
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Trigger — jede neue/geänderte Zeile rechnet sich selbst
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_properties_potenzial()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  r := public.calc_potenzial(
    NEW.zone, NEW.ausnuetzung, NEW.area, NEW.gebaeudeflaeche,
    NEW.geschosse, NEW.vollgeschosse, NEW.baujahr, NEW.renovationsjahr,
    NEW.denkmalschutz, NEW.isos
  );

  NEW.ausnuetzung     := COALESCE(NEW.ausnuetzung, (r ->> 'ausnuetzung')::numeric);
  NEW.az_quelle       := r ->> 'az_quelle';
  NEW.gf_zulaessig    := (r ->> 'gf_zulaessig')::numeric;
  NEW.gf_bestand      := (r ->> 'gf_bestand')::numeric;
  NEW.reserve_gf      := (r ->> 'reserve_gf')::numeric;
  NEW.reserve_quote   := (r ->> 'reserve_quote')::numeric;
  NEW.hnf_faktor      := (r ->> 'hnf_faktor')::numeric;
  NEW.hnf_bestand     := (r ->> 'hnf_bestand')::numeric;
  NEW.hnf_neu         := (r ->> 'hnf_neu')::numeric;
  NEW.hnf_delta       := (r ->> 'hnf_delta')::numeric;
  NEW.hnf_schaetzung  := COALESCE(NEW.hnf_schaetzung, (r ->> 'hnf_bestand')::numeric);
  NEW.investition_chf := (r ->> 'investition_chf')::numeric;
  NEW.erloes_chf      := (r ->> 'erloes_chf')::numeric;
  NEW.marge_chf       := (r ->> 'marge_chf')::numeric;
  NEW.marge_quote     := (r ->> 'marge_quote')::numeric;
  NEW.potenzial_score := (r ->> 'potenzial_score')::int;
  NEW.confidence      := r ->> 'confidence';
  NEW.score_killers   := r -> 'killer';
  NEW.score_reasons   := r -> 'reasons';
  NEW.score_tier      := CASE
                           WHEN (r ->> 'potenzial_score')::int >= 70 THEN 'A'
                           WHEN (r ->> 'potenzial_score')::int >= 50 THEN 'B'
                           WHEN (r ->> 'potenzial_score')::int >= 30 THEN 'C'
                           ELSE 'D' END;
  NEW.ausgeschlossen   := public.ist_keine_bauzone(NEW.zone) OR public.ist_vorhanden(NEW.denkmalschutz);
  NEW.ausschluss_grund := CASE
                            WHEN public.ist_keine_bauzone(NEW.zone) THEN 'Keine Bauzone'
                            WHEN public.ist_vorhanden(NEW.denkmalschutz) THEN 'Denkmalschutz'
                            ELSE NULL END;
  -- Ausgeschlossene Objekte gar nicht erst in die Vorauswahl geben
  IF NEW.ausgeschlossen AND NEW.preselection_status = 'Nicht geprüft' THEN
    NEW.preselection_status := 'Ausschliessen';
    NEW.preselection_note   := COALESCE(NEW.preselection_note, 'Automatisch: ' || NEW.ausschluss_grund);
  END IF;
  NEW.scored_at       := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_potenzial ON public.properties;
CREATE TRIGGER trg_properties_potenzial
  BEFORE INSERT OR UPDATE OF zone, ausnuetzung, area, gebaeudeflaeche,
                             geschosse, vollgeschosse, baujahr, renovationsjahr,
                             denkmalschutz, isos
  ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.trg_properties_potenzial();

-- ---------------------------------------------------------------------
-- 6. Nachrechnen des Bestands — in Batches, damit nichts timeoutet
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_potenzial(p_batch integer DEFAULT 5000)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_done integer := 0;
  v_rows integer;
BEGIN
  LOOP
    WITH todo AS (
      SELECT id FROM public.properties
      WHERE scored_at IS NULL OR scored_at < (SELECT updated_at FROM public.potenzial_config WHERE id)
      LIMIT p_batch
      FOR UPDATE SKIP LOCKED
    ),
    calc AS (
      SELECT p.id, public.calc_potenzial(
               p.zone, p.ausnuetzung, p.area, p.gebaeudeflaeche, p.geschosse,
               p.vollgeschosse, p.baujahr, p.renovationsjahr, p.denkmalschutz, p.isos
             ) AS r
      FROM public.properties p JOIN todo t ON t.id = p.id
    )
    UPDATE public.properties p SET
      ausnuetzung     = COALESCE(p.ausnuetzung, (c.r ->> 'ausnuetzung')::numeric),
      az_quelle       = c.r ->> 'az_quelle',
      gf_zulaessig    = (c.r ->> 'gf_zulaessig')::numeric,
      gf_bestand      = (c.r ->> 'gf_bestand')::numeric,
      reserve_gf      = (c.r ->> 'reserve_gf')::numeric,
      reserve_quote   = (c.r ->> 'reserve_quote')::numeric,
      hnf_faktor      = (c.r ->> 'hnf_faktor')::numeric,
      hnf_bestand     = (c.r ->> 'hnf_bestand')::numeric,
      hnf_neu         = (c.r ->> 'hnf_neu')::numeric,
      hnf_delta       = (c.r ->> 'hnf_delta')::numeric,
      hnf_schaetzung  = COALESCE(p.hnf_schaetzung, (c.r ->> 'hnf_bestand')::numeric),
      investition_chf = (c.r ->> 'investition_chf')::numeric,
      erloes_chf      = (c.r ->> 'erloes_chf')::numeric,
      marge_chf       = (c.r ->> 'marge_chf')::numeric,
      marge_quote     = (c.r ->> 'marge_quote')::numeric,
      potenzial_score = (c.r ->> 'potenzial_score')::int,
      confidence      = c.r ->> 'confidence',
      score_killers   = c.r -> 'killer',
      score_reasons   = c.r -> 'reasons',
      ausgeschlossen  = public.ist_keine_bauzone(p.zone) OR public.ist_vorhanden(p.denkmalschutz),
      ausschluss_grund = CASE
                           WHEN public.ist_keine_bauzone(p.zone) THEN 'Keine Bauzone'
                           WHEN public.ist_vorhanden(p.denkmalschutz) THEN 'Denkmalschutz'
                           ELSE NULL END,
      preselection_status = CASE
                              WHEN (public.ist_keine_bauzone(p.zone) OR public.ist_vorhanden(p.denkmalschutz))
                                   AND p.preselection_status = 'Nicht geprüft'
                              THEN 'Ausschliessen' ELSE p.preselection_status END,
      score_tier      = CASE
                          WHEN (c.r ->> 'potenzial_score')::int >= 70 THEN 'A'
                          WHEN (c.r ->> 'potenzial_score')::int >= 50 THEN 'B'
                          WHEN (c.r ->> 'potenzial_score')::int >= 30 THEN 'C'
                          ELSE 'D' END,
      scored_at       = now()
    FROM calc c WHERE c.id = p.id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_done := v_done + v_rows;
    EXIT WHEN v_rows = 0;
  END LOOP;
  RETURN v_done;
END;
$$;

-- Indexe für die neuen Sortier-/Filterfelder
CREATE INDEX IF NOT EXISTS idx_properties_potenzial_score ON public.properties (potenzial_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_properties_reserve_gf      ON public.properties (reserve_gf DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_properties_score_tier      ON public.properties (score_tier);
CREATE INDEX IF NOT EXISTS idx_properties_ausgeschlossen   ON public.properties (ausgeschlossen) WHERE NOT ausgeschlossen;

-- Bestand einmalig durchrechnen
SELECT public.recompute_potenzial();


-- ---------------------------------------------------------------------
-- Quelle: 20260904120000_hnf_praxisformel.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- HNF nach der Praxisformel berechnen
-- =====================================================================
-- Bisher war die HNF schlicht 80% der zulässigen Geschossfläche. Massgebend
-- ist aber die Formel, mit der wir Objekte tatsächlich beurteilen:
--
--   Grundstück x Ausnutzung / Anzahl VG x (Anzahl VG + anrechenbare) x 0.77
--
-- Das Attikageschoss ist zusätzlich anrechenbar, zählt aber nur 0.66 eines
-- Vollgeschosses. Der Score richtet sich neu nach der zusätzlich erreichbaren
-- HNF statt nach der Geschossflächen-Reserve -- je mehr verkaufbare Fläche,
-- desto interessanter das Objekt.
-- =====================================================================

ALTER TABLE public.potenzial_config
  ADD COLUMN IF NOT EXISTS attika_faktor numeric NOT NULL DEFAULT 0.66,
  ADD COLUMN IF NOT EXISTS mit_attika    boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.potenzial_config.attika_faktor IS
  'Flächenanteil eines Attikageschosses gegenüber einem Vollgeschoss';

UPDATE public.potenzial_config SET hnf_faktor = 0.77, updated_at = now() WHERE hnf_faktor = 0.8;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS vollgeschosse_zulaessig numeric,
  ADD COLUMN IF NOT EXISTS anrechenbare_geschosse  numeric;

CREATE OR REPLACE FUNCTION public.calc_potenzial(
  p_zone           text,
  p_ausnuetzung    numeric,
  p_area           numeric,
  p_gebaeudeflaeche numeric,
  p_geschosse      numeric,
  p_vollgeschosse  numeric,
  p_baujahr        integer,
  p_renovationsjahr integer,
  p_denkmalschutz  text,
  p_isos           text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  cfg           public.potenzial_config%ROWTYPE;
  v_zone        text;
  v_p           record;
  v_az          numeric;
  v_az_quelle   text;
  v_geschosse   numeric;
  v_gf_zul      numeric;
  v_gf_best     numeric;
  v_raw_reserve numeric;
  v_reserve     numeric;
  v_quote       numeric;
  v_vg          numeric;
  v_anrechenbar numeric;
  v_hnf_best    numeric;
  v_hnf_neu     numeric;
  v_hnf_delta   numeric;
  v_invest      numeric;
  v_erloes      numeric;
  v_marge       numeric;
  v_marge_q     numeric;
  v_killer      text[] := ARRAY[]::text[];
  v_reasons     text[] := ARRAY[]::text[];
  v_conf        text := 'keine';
  v_score       numeric := 0;
  v_bj          integer;
  -- Fallback: zulässige Vollgeschosse pro Zone, falls keine AZ hinterlegt ist
  v_geschosse_zone jsonb := '{
    "W":2,"W2":2,"W2G":2,"W3":3,"W3G":3,"W4":4,"W4G":4,"W5":5,"W6":6,"W7":7,
    "WG":2,"WG2":2,"WG3":3,"WG4":4,"K":4,"Z":3
  }'::jsonb;
BEGIN
  SELECT * INTO cfg FROM public.potenzial_config WHERE id LIMIT 1;
  v_zone := public.norm_zone(p_zone);
  SELECT * INTO v_p FROM public.zone_parse(p_zone);

  -- Ausnützungsziffer: Objektwert vor Zonentabelle vor Geschoss-Heuristik.
  -- Nicht-Bauzonen bekommen gar keine.
  IF public.ist_keine_bauzone(p_zone) THEN
    v_az := NULL;
  ELSIF p_ausnuetzung IS NOT NULL AND p_ausnuetzung > 0 AND p_ausnuetzung < 5 THEN
    v_az := p_ausnuetzung;
    v_az_quelle := 'objekt';
  ELSE
    IF v_p.ziffer IS NOT NULL AND v_p.ziffer > 0 THEN
      -- Ziffer aus dem Zonennamen; als BMZ über die Geschosshöhe umrechnen
      v_az := CASE WHEN cfg.ziffer_als_bmz
                   THEN v_p.ziffer / NULLIF(cfg.geschosshoehe, 0)
                   ELSE v_p.ziffer END;
      v_az_quelle := 'zone';
    ELSIF v_p.geschosse IS NOT NULL AND v_p.ueberbauungsziffer IS NOT NULL THEN
      v_az := v_p.geschosse * (v_p.ueberbauungsziffer / 100);
      v_az_quelle := 'zone';
    ELSIF v_p.kurz IS NOT NULL AND cfg.az_by_zone ? v_p.kurz THEN
      v_az := (cfg.az_by_zone ->> v_p.kurz)::numeric;
      v_az_quelle := 'zone';
    ELSIF v_p.geschosse IS NOT NULL THEN
      v_az := v_p.geschosse * 0.3;
      v_az_quelle := 'geschosse';
    ELSIF v_p.kurz IS NOT NULL AND v_geschosse_zone ? v_p.kurz THEN
      v_az := (v_geschosse_zone ->> v_p.kurz)::numeric * 0.3;
      v_az_quelle := 'geschosse';
    END IF;
  END IF;

  IF v_az IS NOT NULL AND p_area IS NOT NULL AND p_area > 0 THEN
    v_gf_zul := p_area * v_az;
  END IF;

  v_geschosse := COALESCE(NULLIF(p_geschosse, 0), NULLIF(p_vollgeschosse, 0));
  IF p_gebaeudeflaeche IS NOT NULL AND p_gebaeudeflaeche > 0 THEN
    IF v_geschosse IS NOT NULL AND v_geschosse > 0 THEN
      v_gf_best := p_gebaeudeflaeche * v_geschosse;
    ELSE
      v_gf_best := p_gebaeudeflaeche * 2;   -- konservative Annahme
      v_reasons := v_reasons || 'Geschosse unbekannt — 2 Vollgeschosse angenommen'::text;
    END IF;
  END IF;

  IF v_gf_zul IS NOT NULL AND v_gf_best IS NOT NULL THEN
    v_raw_reserve := v_gf_zul - v_gf_best;
    v_reserve := GREATEST(v_raw_reserve, 0);
    IF v_gf_zul > 0 THEN v_quote := v_reserve / v_gf_zul; END IF;
    IF v_raw_reserve < 0 THEN
      v_killer := v_killer || 'Bestand überschreitet Zone (Besitzstand)'::text;
    END IF;
  END IF;

  -- HNF nach der Praxisformel:
  --   Grundstück x Ausnutzung / Anzahl VG x (Anzahl VG + anrechenbare) x 0.77
  -- Das Attikageschoss ist zusätzlich anrechenbar, bringt aber nur 0.66 der
  -- Fläche eines Vollgeschosses.
  v_vg := COALESCE(v_p.geschosse, v_geschosse, 2);
  v_anrechenbar := v_vg + CASE WHEN cfg.mit_attika THEN cfg.attika_faktor ELSE 0 END;

  v_hnf_best := v_gf_best * cfg.hnf_faktor;
  IF v_gf_zul IS NOT NULL AND v_vg > 0 THEN
    v_hnf_neu := (v_gf_zul / v_vg) * v_anrechenbar * cfg.hnf_faktor;
  END IF;
  IF v_hnf_neu IS NOT NULL AND v_hnf_best IS NOT NULL THEN
    v_hnf_delta := GREATEST(v_hnf_neu - v_hnf_best, 0);
  END IF;

  v_invest := v_reserve   * cfg.baukosten_pro_m2;
  v_erloes := v_hnf_delta * cfg.erloes_pro_m2_hnf;
  v_marge  := v_erloes - v_invest;
  IF v_invest IS NOT NULL AND v_invest > 0 THEN
    v_marge_q := v_marge / v_invest;
  END IF;

  -- Killer-Kriterien
  IF public.ist_vorhanden(p_denkmalschutz) THEN
    v_killer := v_killer || 'Denkmalschutz'::text;
  END IF;
  IF public.ist_vorhanden(p_isos) THEN
    v_killer := v_killer || 'ISOS-Ortsbild'::text;
  END IF;
  IF public.ist_keine_bauzone(p_zone) THEN
    v_killer := v_killer || 'Keine Bauzone'::text;
  END IF;
  IF v_reserve IS NOT NULL AND v_reserve < cfg.min_reserve_m2 THEN
    v_killer := v_killer || ('Reserve < ' || cfg.min_reserve_m2 || ' m²')::text;
  END IF;

  -- Verlässlichkeit
  IF v_gf_zul IS NOT NULL AND v_gf_best IS NOT NULL THEN
    IF v_az_quelle = 'objekt' AND v_geschosse IS NOT NULL THEN v_conf := 'hoch';
    ELSIF v_az_quelle = 'zone' AND v_geschosse IS NOT NULL THEN v_conf := 'mittel';
    ELSE v_conf := 'tief';
    END IF;
  END IF;

  -- Score 0–100 (identisch zu potentialScore() im Frontend)
  IF v_hnf_delta IS NOT NULL THEN
    v_score := LEAST(v_hnf_delta / 1200, 1) * 40
             + LEAST(CASE WHEN v_hnf_best > 0 THEN v_hnf_delta / v_hnf_best ELSE 1 END, 1) * 25
             + LEAST(GREATEST(COALESCE(v_marge_q, 0), 0) / 0.5, 1) * 15;

    v_bj := COALESCE(p_renovationsjahr, p_baujahr);
    IF v_bj IS NOT NULL THEN
      v_score := v_score + CASE
        WHEN v_bj <= 1930 THEN 15
        WHEN v_bj <= 1960 THEN 12
        WHEN v_bj <= 1975 THEN 8
        WHEN v_bj <= 1990 THEN 4
        ELSE 0 END;
    END IF;

    v_score := v_score + LEAST(COALESCE(v_az, 0) / 1.3, 1) * 5;
    v_score := v_score - COALESCE(array_length(v_killer, 1), 0) * 25;
    v_score := GREATEST(0, LEAST(100, v_score));
  END IF;

  IF v_az_quelle IS NOT NULL THEN
    v_reasons := v_reasons || ('AZ ' || v_az || ' (' || v_az_quelle || ')')::text;
  END IF;

  RETURN jsonb_build_object(
    'ausnuetzung',     v_az,
    'az_quelle',       v_az_quelle,
    'gf_zulaessig',    round(v_gf_zul),
    'gf_bestand',      round(v_gf_best),
    'reserve_gf',      round(v_reserve),
    'reserve_quote',   round(v_quote, 3),
    'hnf_faktor',      cfg.hnf_faktor,
    'vollgeschosse',   v_vg,
    'anrechenbar',     round(v_anrechenbar, 2),
    'hnf_bestand',     round(v_hnf_best),
    'hnf_neu',         round(v_hnf_neu),
    'hnf_delta',       round(v_hnf_delta),
    'investition_chf', round(v_invest),
    'erloes_chf',      round(v_erloes),
    'marge_chf',       round(v_marge),
    'marge_quote',     round(v_marge_q, 3),
    'potenzial_score', round(v_score)::int,
    'confidence',      v_conf,
    'killer',          to_jsonb(v_killer),
    'reasons',         to_jsonb(v_reasons)
  );
END;
$$;


-- Trigger und Nachrechnung um die neuen Felder ergänzen
CREATE OR REPLACE FUNCTION public.trg_properties_potenzial()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  r := public.calc_potenzial(
    NEW.zone, NEW.ausnuetzung, NEW.area, NEW.gebaeudeflaeche,
    NEW.geschosse, NEW.vollgeschosse, NEW.baujahr, NEW.renovationsjahr,
    NEW.denkmalschutz, NEW.isos
  );

  NEW.ausnuetzung             := COALESCE(NEW.ausnuetzung, (r ->> 'ausnuetzung')::numeric);
  NEW.az_quelle               := r ->> 'az_quelle';
  NEW.gf_zulaessig            := (r ->> 'gf_zulaessig')::numeric;
  NEW.gf_bestand              := (r ->> 'gf_bestand')::numeric;
  NEW.reserve_gf              := (r ->> 'reserve_gf')::numeric;
  NEW.reserve_quote           := (r ->> 'reserve_quote')::numeric;
  NEW.hnf_faktor              := (r ->> 'hnf_faktor')::numeric;
  NEW.vollgeschosse_zulaessig := (r ->> 'vollgeschosse')::numeric;
  NEW.anrechenbare_geschosse  := (r ->> 'anrechenbar')::numeric;
  NEW.hnf_bestand             := (r ->> 'hnf_bestand')::numeric;
  NEW.hnf_neu                 := (r ->> 'hnf_neu')::numeric;
  NEW.hnf_delta               := (r ->> 'hnf_delta')::numeric;
  NEW.hnf_schaetzung          := (r ->> 'hnf_neu')::numeric;
  NEW.investition_chf         := (r ->> 'investition_chf')::numeric;
  NEW.erloes_chf              := (r ->> 'erloes_chf')::numeric;
  NEW.marge_chf               := (r ->> 'marge_chf')::numeric;
  NEW.marge_quote             := (r ->> 'marge_quote')::numeric;
  NEW.potenzial_score         := (r ->> 'potenzial_score')::int;
  NEW.confidence              := r ->> 'confidence';
  NEW.score_killers           := r -> 'killer';
  NEW.score_reasons           := r -> 'reasons';
  NEW.score_tier              := CASE
                                   WHEN (r ->> 'potenzial_score')::int >= 70 THEN 'A'
                                   WHEN (r ->> 'potenzial_score')::int >= 50 THEN 'B'
                                   WHEN (r ->> 'potenzial_score')::int >= 30 THEN 'C'
                                   ELSE 'D' END;
  NEW.ausgeschlossen   := public.ist_keine_bauzone(NEW.zone) OR public.ist_vorhanden(NEW.denkmalschutz);
  NEW.ausschluss_grund := CASE
                            WHEN public.ist_keine_bauzone(NEW.zone) THEN 'Keine Bauzone'
                            WHEN public.ist_vorhanden(NEW.denkmalschutz) THEN 'Denkmalschutz'
                            ELSE NULL END;
  IF NEW.ausgeschlossen AND NEW.preselection_status = 'Nicht geprüft' THEN
    NEW.preselection_status := 'Ausschliessen';
    NEW.preselection_note   := COALESCE(NEW.preselection_note, 'Automatisch: ' || NEW.ausschluss_grund);
  END IF;
  NEW.scored_at := now();
  RETURN NEW;
END;
$$;

-- Sortierung nach erreichbarer HNF
CREATE INDEX IF NOT EXISTS idx_properties_hnf_delta ON public.properties (hnf_delta DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_properties_hnf_neu    ON public.properties (hnf_neu DESC NULLS LAST);

-- Bestand mit der neuen Formel nachrechnen
UPDATE public.potenzial_config SET updated_at = now() WHERE id;
SELECT public.recompute_potenzial();


-- "Wald" nur als eigenständiges Wort erkennen: es gibt die Gemeinde Wald (ZH)
-- und Flurnamen wie "Waldegg", die keine Waldzone bezeichnen.
CREATE OR REPLACE FUNCTION public.ist_keine_bauzone(z text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    z ~* '(landwirtschaftszone|\mwald\M|waldzone|freihaltezone|erholungszone|gew(ä|ae)sser|reservezone|verkehrszone)',
    false
  )
$$;


-- ---------------------------------------------------------------------
-- Quelle: 20260904140000_import_rpc.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Massen-Import in einem einzigen Aufruf
-- =====================================================================
-- Der Import lief bisher zeilenweise über die REST-Schnittstelle: pro
-- Zeile eine Abfrage, ob der EGRID schon existiert, dann ein Insert oder
-- Update, bei gesetzter Liste noch ein drittes Update. Bei 50'000 Zeilen
-- summiert sich das auf weit über 50'000 Roundtrips -- der Import lief
-- deshalb minutenlang.
--
-- Diese Funktion nimmt einen ganzen Block als JSON entgegen und erledigt
-- alles in einer einzigen Anweisung: neue Parzellen werden eingefügt,
-- bekannte ergänzt. Ergänzt heisst COALESCE -- vorhandene Werte bleiben
-- stehen, nur Lücken werden gefüllt. Der Akquise-Stand (Status, Notizen,
-- Eigentümer, Telefonnummern) wird nie angefasst.
-- =====================================================================

-- Wird von der Import-Funktion geschrieben und trägt, wie viele Gebäude
-- einer Parzelle in diese Zeile eingerechnet sind.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS gebaeude_anzahl integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.properties.gebaeude_anzahl IS
  'Anzahl Gebäude auf dieser Parzelle, die in diese Zeile eingerechnet sind';

CREATE OR REPLACE FUNCTION public.import_properties(
  p_rows            jsonb,
  p_list_id         uuid    DEFAULT NULL,
  p_update_existing boolean DEFAULT true
)
RETURNS TABLE (eingefuegt integer, ergaenzt integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ins integer := 0;
  v_upd integer := 0;
BEGIN
  CREATE TEMP TABLE _eingang ON COMMIT DROP AS
  SELECT * FROM jsonb_to_recordset(p_rows) AS x(
    address              text,
    egrid                text,
    parzelle             text,
    plot_number          text,
    gwr_egid             text,
    gvz_nr               text,
    gebaeude_anzahl      integer,
    strassenname         text,
    hausnummer           text,
    plz                  text,
    plz_ort              text,
    gemeinde             text,
    ortschaftsname       text,
    bezirk               text,
    bezirksort           text,
    kanton               text,
    area                 numeric,
    gebaeudeflaeche      numeric,
    hnf_schaetzung       numeric,
    wohnflaeche          numeric,
    nutzflaeche          numeric,
    baujahr              integer,
    renovationsjahr      integer,
    geschosse            numeric,
    wohnungen            numeric,
    ausnuetzung          numeric,
    zone                 text,
    kategorie            text,
    gebaeudeart          text,
    geb_status           text,
    denkmalschutz        text,
    denkmalschutz_titel  text,
    isos                 text,
    isos_titel           text,
    google_maps_url      text,
    streetview_url       text,
    housing_stat_url     text,
    gis_url              text,
    objektadresse        text,
    bfs_nr               text,
    source_file          text
  );

  -- Innerhalb eines Blocks kann derselbe EGRID nur einmal vorkommen, sonst
  -- kann ON CONFLICT die Zeile nicht zweimal behandeln.
  CREATE TEMP TABLE _dedup ON COMMIT DROP AS
  SELECT DISTINCT ON (COALESCE(NULLIF(egrid, ''), gen_random_uuid()::text)) *
  FROM _eingang
  ORDER BY COALESCE(NULLIF(egrid, ''), gen_random_uuid()::text),
           COALESCE(gebaeudeflaeche, 0) DESC;

  WITH eingefuegt AS (
    INSERT INTO public.properties AS p (
      address, egrid, parzelle, plot_number, gwr_egid, gvz_nr, gebaeude_anzahl,
      strassenname, hausnummer, plz, plz_ort, gemeinde, ortschaftsname,
      bezirk, bezirksort, kanton, area, gebaeudeflaeche, hnf_schaetzung,
      wohnflaeche, nutzflaeche, baujahr, renovationsjahr, geschosse, wohnungen,
      ausnuetzung, zone, kategorie, gebaeudeart, geb_status, denkmalschutz,
      denkmalschutz_titel, isos, isos_titel, google_maps_url, streetview_url,
      housing_stat_url, gis_url, objektadresse, bfs_nr, source_file,
      list_id, status, preselection_status, is_queried
    )
    SELECT
      COALESCE(NULLIF(d.address, ''), 'Parzelle ' || COALESCE(d.parzelle, d.egrid, '?')),
      NULLIF(d.egrid, ''), d.parzelle, COALESCE(d.plot_number, d.parzelle), d.gwr_egid,
      d.gvz_nr, COALESCE(d.gebaeude_anzahl, 1),
      d.strassenname, d.hausnummer, d.plz, d.plz_ort, d.gemeinde, d.ortschaftsname,
      d.bezirk, d.bezirksort, COALESCE(d.kanton, 'ZH'), d.area, d.gebaeudeflaeche,
      d.hnf_schaetzung, d.wohnflaeche, d.nutzflaeche, d.baujahr, d.renovationsjahr,
      d.geschosse, d.wohnungen, d.ausnuetzung, d.zone, d.kategorie, d.gebaeudeart,
      COALESCE(d.geb_status, 'Bestehend'), d.denkmalschutz, d.denkmalschutz_titel,
      d.isos, d.isos_titel, d.google_maps_url, d.streetview_url, d.housing_stat_url,
      d.gis_url, d.objektadresse, d.bfs_nr, d.source_file,
      p_list_id, 'Neu', 'Nicht geprüft', false
    FROM _dedup d
    ON CONFLICT (egrid) WHERE egrid IS NOT NULL AND egrid <> ''
    DO UPDATE SET
      -- Nur Lücken füllen: der bestehende Wert gewinnt immer.
      strassenname     = COALESCE(p.strassenname, EXCLUDED.strassenname),
      hausnummer       = COALESCE(p.hausnummer, EXCLUDED.hausnummer),
      plz              = COALESCE(p.plz, EXCLUDED.plz),
      plz_ort          = COALESCE(p.plz_ort, EXCLUDED.plz_ort),
      gemeinde         = COALESCE(p.gemeinde, EXCLUDED.gemeinde),
      bezirk           = COALESCE(p.bezirk, EXCLUDED.bezirk),
      kanton           = COALESCE(p.kanton, EXCLUDED.kanton),
      area             = COALESCE(p.area, EXCLUDED.area),
      gebaeudeflaeche  = COALESCE(p.gebaeudeflaeche, EXCLUDED.gebaeudeflaeche),
      hnf_schaetzung   = COALESCE(p.hnf_schaetzung, EXCLUDED.hnf_schaetzung),
      wohnflaeche      = COALESCE(p.wohnflaeche, EXCLUDED.wohnflaeche),
      nutzflaeche      = COALESCE(p.nutzflaeche, EXCLUDED.nutzflaeche),
      baujahr          = COALESCE(p.baujahr, EXCLUDED.baujahr),
      renovationsjahr  = COALESCE(p.renovationsjahr, EXCLUDED.renovationsjahr),
      geschosse        = COALESCE(p.geschosse, EXCLUDED.geschosse),
      wohnungen        = COALESCE(p.wohnungen, EXCLUDED.wohnungen),
      ausnuetzung      = COALESCE(p.ausnuetzung, EXCLUDED.ausnuetzung),
      zone             = COALESCE(p.zone, EXCLUDED.zone),
      kategorie        = COALESCE(p.kategorie, EXCLUDED.kategorie),
      gebaeudeart      = COALESCE(p.gebaeudeart, EXCLUDED.gebaeudeart),
      denkmalschutz    = COALESCE(p.denkmalschutz, EXCLUDED.denkmalschutz),
      isos             = COALESCE(p.isos, EXCLUDED.isos),
      google_maps_url  = COALESCE(p.google_maps_url, EXCLUDED.google_maps_url),
      streetview_url   = COALESCE(p.streetview_url, EXCLUDED.streetview_url),
      gis_url          = COALESCE(p.gis_url, EXCLUDED.gis_url),
      housing_stat_url = COALESCE(p.housing_stat_url, EXCLUDED.housing_stat_url),
      bfs_nr           = COALESCE(p.bfs_nr, EXCLUDED.bfs_nr),
      gebaeude_anzahl  = GREATEST(p.gebaeude_anzahl, EXCLUDED.gebaeude_anzahl),
      list_id          = COALESCE(p_list_id, p.list_id),
      source_file      = COALESCE(p.source_file, EXCLUDED.source_file)
    WHERE p_update_existing
    -- xmax = 0 kennzeichnet eine tatsächlich eingefügte Zeile
    RETURNING (xmax = 0) AS ist_neu
  )
  SELECT count(*) FILTER (WHERE ist_neu),
         count(*) FILTER (WHERE NOT ist_neu)
  INTO v_ins, v_upd
  FROM eingefuegt;

  RETURN QUERY SELECT v_ins, v_upd;
END;
$$;

COMMENT ON FUNCTION public.import_properties(jsonb, uuid, boolean) IS
  'Importiert einen Block Liegenschaften in einer Anweisung; bestehende Zeilen werden nur ergänzt, nie überschrieben';

GRANT EXECUTE ON FUNCTION public.import_properties(jsonb, uuid, boolean) TO anon, authenticated;

-- =====================================================================
-- Indizes für die Masterliste
-- =====================================================================
-- Gemessen am Bestand von 259'057 Zeilen (GitHub-Actions-Aufgabe
-- "tempo", 5. September):
--
--   ohne Sortierung, 50 Zeilen ............... 0.8 s
--   sortiert nach hnf_delta .................. Timeout
--   sortiert nach hnf_delta, nicht ausgeschl.  Timeout
--   sortiert nach marge_chf .................. Timeout
--
-- Die Masterliste sortiert standardmässig nach hnf_delta absteigend und
-- blendet ausgeschlossene Objekte aus -- also genau die Abfrage, die
-- abbricht. Ohne Index muss die Datenbank alle 259'000 Zeilen lesen und
-- sortieren, um die ersten fünfzig zu zeigen.
--
-- Die Indizes sind bewusst partiell: gesucht wird immer im kaufbaren
-- Bestand, ausgeschlossene Objekte interessieren beim Sortieren nie.
-- Das hält sie klein und schnell.
--
-- NULLS LAST entspricht der Leseweise der Liste: Objekte ohne Kennzahl
-- gehören ans Ende, nicht an den Anfang.
-- =====================================================================

-- Standardsortierung der Masterliste.
create index if not exists properties_hnf_delta_idx
  on public.properties (hnf_delta desc nulls last)
  where ausgeschlossen is not true;

-- Zweite Sortierung: Marge in Franken.
create index if not exists properties_marge_idx
  on public.properties (marge_chf desc nulls last)
  where ausgeschlossen is not true;

-- Sortierung nach Bewertungsstufe, mit der Marge als zweitem Kriterium.
create index if not exists properties_tier_idx
  on public.properties (score_tier, marge_chf desc nulls last)
  where ausgeschlossen is not true;

-- Zählungen der Übersicht liefen ebenfalls in den Timeout.
create index if not exists properties_ausgeschlossen_idx
  on public.properties (ausgeschlossen);

create index if not exists properties_scored_at_idx
  on public.properties (scored_at)
  where scored_at is null;

-- Filter nach Gemeinde in der Seitenleiste.
create index if not exists properties_gemeinde_idx
  on public.properties (gemeinde);

-- Damit der Planer die neuen Indizes auch nutzt, statt auf veralteten
-- Statistiken zu entscheiden.
analyze public.properties;


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

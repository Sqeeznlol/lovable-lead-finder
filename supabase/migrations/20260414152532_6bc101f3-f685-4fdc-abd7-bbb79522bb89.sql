
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

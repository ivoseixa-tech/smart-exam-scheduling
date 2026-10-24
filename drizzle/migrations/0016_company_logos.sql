ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url text;
CREATE POLICY "Company logos are readable" ON storage.objects FOR SELECT USING (bucket_id = 'company-logos');
CREATE POLICY "Masters upload company logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-logos' AND public.has_role(auth.uid(), 'master'));
CREATE POLICY "Masters update company logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'company-logos' AND public.has_role(auth.uid(), 'master'));
CREATE POLICY "Masters delete company logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'company-logos' AND public.has_role(auth.uid(), 'master'));
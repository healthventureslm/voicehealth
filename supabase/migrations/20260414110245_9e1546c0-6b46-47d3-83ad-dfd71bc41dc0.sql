-- 1. Fix consultation_scripts: restrict write to admin only
DROP POLICY IF EXISTS "consultation_scripts_insert" ON public.consultation_scripts;
DROP POLICY IF EXISTS "consultation_scripts_update" ON public.consultation_scripts;
DROP POLICY IF EXISTS "consultation_scripts_delete" ON public.consultation_scripts;

CREATE POLICY "consultation_scripts_insert_admin"
ON public.consultation_scripts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "consultation_scripts_update_admin"
ON public.consultation_scripts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "consultation_scripts_delete_admin"
ON public.consultation_scripts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Add DELETE and UPDATE policies for audio-recordings storage
CREATE POLICY "Users can delete own audio"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'audio-recordings'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own audio"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'audio-recordings'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'audio-recordings'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
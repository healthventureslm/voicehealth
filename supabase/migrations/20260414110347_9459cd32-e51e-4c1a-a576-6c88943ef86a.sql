-- Fix: recreate storage policies for authenticated role only
DROP POLICY IF EXISTS "Users can delete own audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own audio" ON storage.objects;

CREATE POLICY "Users can delete own audio"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'audio-recordings'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own audio"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'audio-recordings'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'audio-recordings'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
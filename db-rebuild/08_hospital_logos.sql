-- ============================================================================
-- 08_hospital_logos.sql
-- ----------------------------------------------------------------------------
-- Adiciona coluna logo_url em hospitals e cria bucket "hospital-logos" pra
-- armazenar imagens. Imagens são públicas (leitura), mas só super_admin ou
-- hospital_admin do próprio hospital podem fazer upload.
--
-- Idempotente.
-- ============================================================================

BEGIN;

-- 1) Coluna logo_url
ALTER TABLE hospitals
  ADD COLUMN IF NOT EXISTS logo_url text;

-- 2) Bucket público
INSERT INTO storage.buckets (id, name, public)
VALUES ('hospital-logos', 'hospital-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3) RLS policies — público lê, admin escreve
DROP POLICY IF EXISTS hospital_logos_read    ON storage.objects;
DROP POLICY IF EXISTS hospital_logos_write   ON storage.objects;
DROP POLICY IF EXISTS hospital_logos_update  ON storage.objects;
DROP POLICY IF EXISTS hospital_logos_delete  ON storage.objects;

-- Leitura: público (qualquer um pode ver, inclusive anon)
CREATE POLICY hospital_logos_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hospital-logos');

-- Escrita: super_admin OU hospital_admin do hospital cujo id é o 1º segmento
-- do path. Path esperado: <hospital_id>/<filename>.
CREATE POLICY hospital_logos_write
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'hospital-logos'
    AND (
      is_super_admin(auth.uid())
      OR is_hospital_admin_of(auth.uid(), (split_part(name, '/', 1))::uuid)
    )
  );

CREATE POLICY hospital_logos_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'hospital-logos'
    AND (
      is_super_admin(auth.uid())
      OR is_hospital_admin_of(auth.uid(), (split_part(name, '/', 1))::uuid)
    )
  );

CREATE POLICY hospital_logos_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'hospital-logos'
    AND (
      is_super_admin(auth.uid())
      OR is_hospital_admin_of(auth.uid(), (split_part(name, '/', 1))::uuid)
    )
  );

COMMIT;

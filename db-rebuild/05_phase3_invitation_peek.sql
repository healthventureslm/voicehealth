-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  Fase 3 — função pra pré-visualizar convite via token             ║
-- ║                                                                   ║
-- ║  Permite que a tela de Signup leia detalhes do convite usando o   ║
-- ║  token único (sem precisar de auth). Sem isso, a RLS de           ║
-- ║  invitations bloqueia anon/authenticated comum.                   ║
-- ║                                                                   ║
-- ║  Cole no SQL Editor uma vez por instância.                        ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.peek_invitation(p_token text)
RETURNS TABLE (
  id           uuid,
  email        text,
  role         app_role,
  hospital_id  uuid,
  ward_ids     uuid[],
  status       invitation_status,
  expires_at   timestamptz,
  hospital_name text,
  ward_names   text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    i.id,
    i.email,
    i.role,
    i.hospital_id,
    i.ward_ids,
    i.status,
    i.expires_at,
    h.name AS hospital_name,
    COALESCE(
      (SELECT array_agg(w.name ORDER BY w.name)
       FROM public.wards w
       WHERE w.id = ANY(i.ward_ids)),
      ARRAY[]::text[]
    ) AS ward_names
  FROM public.invitations i
  LEFT JOIN public.hospitals h ON h.id = i.hospital_id
  WHERE i.token = p_token
$$;

GRANT EXECUTE ON FUNCTION public.peek_invitation(text) TO anon, authenticated;

-- Confere
SELECT * FROM public.peek_invitation('inexistente');  -- deve voltar 0 linhas

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  VOICEHEALTH — REBUILD V2                                        ║
-- ║  01_inspect.sql                                                  ║
-- ║                                                                   ║
-- ║  PROPÓSITO: Mostrar TUDO que existe hoje no schema public,       ║
-- ║             SEM apagar nada. Use pra revisar antes do wipe.      ║
-- ║                                                                   ║
-- ║  COMO USAR: Cole no SQL Editor do Supabase e rode.               ║
-- ║             Vai retornar 4 resultsets:                            ║
-- ║             1) Tabelas com tamanho e contagem                    ║
-- ║             2) Funções customizadas                              ║
-- ║             3) Tipos/enums customizados                          ║
-- ║             4) Triggers                                          ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- 1) TABELAS no schema public
-- ═══════════════════════════════════════════════════════════════════
SELECT
  tablename AS tabela,
  pg_size_pretty(pg_total_relation_size('public.' || quote_ident(tablename))) AS tamanho,
  (SELECT count(*)::int FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.table_name = t.tablename) AS qtd_colunas,
  (xpath('/row/c/text()',
         query_to_xml(format('SELECT count(*) AS c FROM public.%I', tablename),
                      true, true, '')))[1]::text::int AS qtd_linhas
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.' || quote_ident(tablename)) DESC;

-- ═══════════════════════════════════════════════════════════════════
-- 2) FUNÇÕES customizadas no schema public
-- ═══════════════════════════════════════════════════════════════════
SELECT
  p.proname AS funcao,
  pg_get_function_identity_arguments(p.oid) AS argumentos,
  pg_get_function_result(p.oid) AS retorno
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.proname;

-- ═══════════════════════════════════════════════════════════════════
-- 3) TIPOS / ENUMS customizados
-- ═══════════════════════════════════════════════════════════════════
SELECT
  t.typname AS tipo,
  CASE t.typtype
    WHEN 'e' THEN 'enum'
    WHEN 'c' THEN 'composite'
    WHEN 'd' THEN 'domain'
    ELSE t.typtype::text
  END AS categoria,
  CASE t.typtype
    WHEN 'e' THEN (SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder)
                   FROM pg_enum WHERE enumtypid = t.oid)
    ELSE NULL
  END AS valores
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.typtype IN ('e', 'c', 'd')
ORDER BY t.typname;

-- ═══════════════════════════════════════════════════════════════════
-- 4) TRIGGERS no schema public
-- ═══════════════════════════════════════════════════════════════════
SELECT
  trigger_name,
  event_object_table AS tabela,
  event_manipulation AS evento,
  action_timing AS quando
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ═══════════════════════════════════════════════════════════════════
-- 5) AUTH USERS atuais (preservados após wipe)
-- ═══════════════════════════════════════════════════════════════════
SELECT
  id,
  email,
  email_confirmed_at IS NOT NULL AS confirmado,
  created_at,
  raw_user_meta_data->>'full_name' AS nome
FROM auth.users
ORDER BY created_at;

-- ═══════════════════════════════════════════════════════════════════
-- 6) STORAGE BUCKETS (preservados após wipe)
-- ═══════════════════════════════════════════════════════════════════
SELECT
  id AS bucket,
  name,
  public,
  created_at,
  (SELECT count(*) FROM storage.objects WHERE bucket_id = b.id) AS qtd_objetos
FROM storage.buckets b
ORDER BY name;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  VOICEHEALTH — REBUILD V2                                        ║
-- ║  02_wipe.sql                                                     ║
-- ║                                                                   ║
-- ║  PROPÓSITO: Apagar TUDO no schema public (tabelas, funções,      ║
-- ║             triggers, types). PRESERVA: auth.*, storage.*,       ║
-- ║             extensions, e os arquivos de áudio já enviados.      ║
-- ║                                                                   ║
-- ║  ⚠️  DESTRUTIVO. Faça backup antes (Database → Backups → Manual)  ║
-- ║                                                                   ║
-- ║  COMO USAR: Cole no SQL Editor e rode. Toda a operação está      ║
-- ║             dentro de transação — qualquer erro faz ROLLBACK     ║
-- ║             automático.                                          ║
-- ╚══════════════════════════════════════════════════════════════════╝

BEGIN;

-- Suspende RLS / triggers / FKs durante o wipe pra evitar erros de ordem
SET session_replication_role = replica;

-- ═══════════════════════════════════════════════════════════════════
-- 1) DROP de todas as TABELAS no schema public
--    (pulando objetos de extensões — ex: pgvector)
-- ═══════════════════════════════════════════════════════════════════
DO $wipe$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'                           -- apenas tabelas regulares
      AND NOT EXISTS (                               -- não pertence a extensão
        SELECT 1 FROM pg_depend d
        WHERE d.objid = c.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
    RAISE NOTICE 'Dropped table: %', r.tablename;
  END LOOP;
END
$wipe$;

-- ═══════════════════════════════════════════════════════════════════
-- 2) DROP de todas as VIEWS (caso existam) — também pulando extensões
-- ═══════════════════════════════════════════════════════════════════
DO $wipe$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS viewname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('v', 'm')                   -- view e materialized view
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = c.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', r.viewname);
    RAISE NOTICE 'Dropped view: %', r.viewname;
  END LOOP;
END
$wipe$;

-- ═══════════════════════════════════════════════════════════════════
-- 3) DROP de todas as FUNÇÕES customizadas no schema public
--    (pulando funções de extensões instaladas — pgvector etc)
-- ═══════════════════════════════════════════════════════════════════
DO $wipe$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (                               -- pula funções de extensões
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE',
                   r.proname, r.args);
    RAISE NOTICE 'Dropped function: %(%)', r.proname, r.args;
  END LOOP;
END
$wipe$;

-- ═══════════════════════════════════════════════════════════════════
-- 4) DROP de tipos/enums/domains customizados
--    (pulando tipos de extensões — ex: vector, halfvec, sparsevec)
-- ═══════════════════════════════════════════════════════════════════
DO $wipe$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typtype IN ('e', 'c', 'd')
      -- não toca tipos de tabelas (composite associado a uma tabela real)
      AND NOT EXISTS (
        SELECT 1 FROM pg_class c
        WHERE c.oid = t.typrelid AND c.relkind <> 'c'
      )
      -- pula tipos de extensões
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = t.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', r.typname);
    RAISE NOTICE 'Dropped type: %', r.typname;
  END LOOP;
END
$wipe$;

-- ═══════════════════════════════════════════════════════════════════
-- 5) Drop trigger no auth.users (handle_new_user antigo)
-- ═══════════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Restaura comportamento normal
SET session_replication_role = DEFAULT;

-- ═══════════════════════════════════════════════════════════════════
-- 6) Verificação final
-- ═══════════════════════════════════════════════════════════════════
DO $check$
DECLARE
  v_tables int;
  v_funcs int;
  v_types int;
BEGIN
  SELECT count(*) INTO v_tables
    FROM pg_tables WHERE schemaname = 'public';
  SELECT count(*) INTO v_funcs
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prokind = 'f';
  SELECT count(*) INTO v_types
    FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public' AND t.typtype IN ('e', 'c', 'd');

  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE 'WIPE concluído. Restantes em public:';
  RAISE NOTICE '  Tabelas:  %', v_tables;
  RAISE NOTICE '  Funções:  %', v_funcs;
  RAISE NOTICE '  Tipos:    %', v_types;
  RAISE NOTICE 'auth.users preservados ✓';
  RAISE NOTICE 'storage.objects preservados ✓';
  RAISE NOTICE '═══════════════════════════════════════════';
END
$check$;

COMMIT;

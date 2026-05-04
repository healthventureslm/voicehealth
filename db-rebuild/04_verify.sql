-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  VOICEHEALTH — REBUILD V2                                        ║
-- ║  04_verify.sql                                                   ║
-- ║                                                                   ║
-- ║  PROPÓSITO: Sanity checks após o create. Confirma que tudo       ║
-- ║             foi criado corretamente.                             ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- 1) Tabelas criadas (esperado: 24)
SELECT count(*) AS total_tabelas, '24 esperadas' AS esperado
FROM pg_tables WHERE schemaname = 'public';

SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 2) Enums criados (esperado: 8)
SELECT t.typname, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valores
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
LEFT JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'public' AND t.typtype = 'e'
GROUP BY t.typname
ORDER BY t.typname;

-- 3) Funções helper (esperado: ao menos is_super_admin, current_hospital_ids,
--    current_ward_ids, is_hospital_admin_of, has_role_in_hospital,
--    can_edit_consultation, handle_new_user, lock_consultations_on_transfer,
--    record_ward_transfer, update_updated_at)
SELECT p.proname AS funcao, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prokind = 'f'
ORDER BY p.proname;

-- 4) RLS está habilitado em todas tabelas
SELECT tablename, rowsecurity AS rls_on
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 5) Policies criadas (esperado: ~50+)
SELECT tablename, count(*) AS qtd_policies
FROM pg_policies WHERE schemaname = 'public'
GROUP BY tablename ORDER BY tablename;

-- 6) Seed verificado
SELECT 'hospitals'           AS tabela, count(*) FROM hospitals UNION ALL
SELECT 'wards'                AS tabela, count(*) FROM wards UNION ALL
SELECT 'medical_specialties'  AS tabela, count(*) FROM medical_specialties UNION ALL
SELECT 'ipsg_goals'           AS tabela, count(*) FROM ipsg_goals UNION ALL
SELECT 'report_templates'     AS tabela, count(*) FROM report_templates UNION ALL
SELECT 'profiles'             AS tabela, count(*) FROM profiles UNION ALL
SELECT 'user_roles'           AS tabela, count(*) FROM user_roles;

-- 7) Mapeamento atual de quem é o quê
SELECT
  u.email,
  p.full_name,
  string_agg(DISTINCT ur.role::text, ', ') AS roles,
  string_agg(DISTINCT h.name, ', ')         AS hospitais,
  string_agg(DISTINCT w.name, ', ')         AS wards
FROM auth.users u
LEFT JOIN profiles p           ON p.user_id = u.id
LEFT JOIN user_roles ur        ON ur.user_id = u.id
LEFT JOIN hospitals h          ON h.id = ur.hospital_id
LEFT JOIN ward_assignments wa  ON wa.user_id = u.id AND wa.ended_at IS NULL
LEFT JOIN wards w              ON w.id = wa.ward_id
GROUP BY u.email, p.full_name
ORDER BY u.email;

-- 8) Estrutura da Clínica São Vicente
SELECT
  h.name AS hospital,
  w.name AS ward,
  w.ward_type,
  w.bed_count
FROM hospitals h
JOIN wards w ON w.hospital_id = h.id
ORDER BY h.name, w.ward_type;

-- 9) Smoke test — função can_edit_consultation responde sem erro
SELECT can_edit_consultation(gen_random_uuid(), gen_random_uuid()) AS smoke_test;

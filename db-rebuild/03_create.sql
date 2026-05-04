-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  VOICEHEALTH — REBUILD V2                                        ║
-- ║  03_create.sql                                                   ║
-- ║                                                                   ║
-- ║  PROPÓSITO: Criar schema novo e limpo (24 tabelas), funções      ║
-- ║             helper, RLS policies, triggers e seed inicial.       ║
-- ║                                                                   ║
-- ║  PRÉ-REQUISITO: Rodar 02_wipe.sql antes (schema public vazio).   ║
-- ║                                                                   ║
-- ║  ESTRUTURA:                                                      ║
-- ║   A) Extensions                                                  ║
-- ║   B) Enums                                                       ║
-- ║   C) Tabelas (em ordem topológica)                               ║
-- ║   D) Funções helper / triggers                                   ║
-- ║   E) RLS policies                                                ║
-- ║   F) Seed (Clínica São Vicente + roles)                          ║
-- ╚══════════════════════════════════════════════════════════════════╝

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- A) EXTENSIONS
-- ═══════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════
-- B) ENUMS
-- ═══════════════════════════════════════════════════════════════════
CREATE TYPE app_role AS ENUM (
  'super_admin',     -- Health Ventures (operadora)
  'hospital_admin',  -- Gestor de hospital
  'doctor',          -- Médico
  'nurse',           -- Enfermeiro(a)
  'auditor'          -- Auditor de qualidade (read-only)
);

CREATE TYPE ward_type AS ENUM (
  'uti',
  'enfermaria',
  'centro_cirurgico',
  'pronto_socorro',
  'ambulatorio'
);

CREATE TYPE consultation_status AS ENUM (
  'recording',
  'transcribing',
  'transcribed',
  'editing',
  'completed'
);

CREATE TYPE patient_admission_status AS ENUM (
  'admitted',
  'discharged',
  'transferred'
);

CREATE TYPE invitation_status AS ENUM (
  'pending',
  'accepted',
  'expired',
  'revoked'
);

CREATE TYPE indicator_unit AS ENUM (
  'percent',
  'count',
  'rate',
  'days'
);

CREATE TYPE action_plan_status AS ENUM (
  'open',
  'in_progress',
  'done',
  'cancelled'
);

CREATE TYPE alert_severity AS ENUM (
  'info',
  'warning',
  'critical'
);

-- ═══════════════════════════════════════════════════════════════════
-- C) TABELAS  (24)
-- ═══════════════════════════════════════════════════════════════════

------------------------------------------------------------------
-- 1) hospitals  — TENANT (cliente da Health Ventures)
------------------------------------------------------------------
CREATE TABLE hospitals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  cnpj        text UNIQUE,
  plan        text NOT NULL DEFAULT 'free',
  is_active   boolean NOT NULL DEFAULT true,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

------------------------------------------------------------------
-- 2) wards  — Setores dentro de cada hospital
------------------------------------------------------------------
CREATE TABLE wards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id  uuid NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name         text NOT NULL,
  ward_type    ward_type NOT NULL DEFAULT 'enfermaria',
  bed_count    int NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, name)
);
CREATE INDEX idx_wards_hospital ON wards(hospital_id) WHERE is_active;

------------------------------------------------------------------
-- 3) medical_specialties — catalogo global
------------------------------------------------------------------
CREATE TABLE medical_specialties (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  slug          text NOT NULL UNIQUE,
  output_prompt text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

------------------------------------------------------------------
-- 4) profiles  — perfil estendido do auth.user
------------------------------------------------------------------
CREATE TABLE profiles (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name          text,
  professional_role  text,            -- "Médico Cardiologista", "Enf. Coordenadora", etc
  specialty_id       uuid REFERENCES medical_specialties(id),
  avatar_url         text,
  lgpd_consented_at  timestamptz,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

------------------------------------------------------------------
-- 5) user_roles — N:N papéis × hospitais
------------------------------------------------------------------
CREATE TABLE user_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id  uuid REFERENCES hospitals(id) ON DELETE CASCADE,
  role         app_role NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, hospital_id, role),
  CHECK (
    (role = 'super_admin' AND hospital_id IS NULL) OR
    (role <> 'super_admin' AND hospital_id IS NOT NULL)
  )
);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_hospital ON user_roles(hospital_id);

------------------------------------------------------------------
-- 6) ward_assignments — N:N usuário × ward (com histórico)
------------------------------------------------------------------
CREATE TABLE ward_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ward_id     uuid NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ward_assign_user_active ON ward_assignments(user_id) WHERE ended_at IS NULL;
CREATE INDEX idx_ward_assign_ward_active ON ward_assignments(ward_id) WHERE ended_at IS NULL;

------------------------------------------------------------------
-- 7) invitations — único caminho de entrada num hospital
------------------------------------------------------------------
CREATE TABLE invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        app_role NOT NULL,
  ward_ids    uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  token       text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status      invitation_status NOT NULL DEFAULT 'pending',
  invited_by  uuid REFERENCES auth.users(id),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (role <> 'super_admin')
);
CREATE INDEX idx_invitations_email ON invitations(lower(email));
CREATE INDEX idx_invitations_token ON invitations(token);

------------------------------------------------------------------
-- 8) patients
------------------------------------------------------------------
CREATE TABLE patients (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id       uuid NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
  full_name         text NOT NULL,
  initials          text,
  medical_record    text,
  bed               text,
  date_of_birth     date,
  current_ward_id   uuid REFERENCES wards(id) ON DELETE SET NULL,
  admission_status  patient_admission_status NOT NULL DEFAULT 'admitted',
  notes             text,
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,            -- soft-delete
  UNIQUE (hospital_id, medical_record)
);
CREATE INDEX idx_patients_hospital ON patients(hospital_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_ward ON patients(current_ward_id) WHERE deleted_at IS NULL;

------------------------------------------------------------------
-- 9) patient_ward_history
------------------------------------------------------------------
CREATE TABLE patient_ward_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  ward_id        uuid NOT NULL REFERENCES wards(id),
  admitted_at    timestamptz NOT NULL DEFAULT now(),
  discharged_at  timestamptz,
  discharged_by  uuid REFERENCES auth.users(id),
  reason         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pwh_patient ON patient_ward_history(patient_id);
CREATE INDEX idx_pwh_ward_active ON patient_ward_history(ward_id) WHERE discharged_at IS NULL;

------------------------------------------------------------------
-- 10) consultations  — gravação + transcrição
------------------------------------------------------------------
CREATE TABLE consultations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id            uuid NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id             uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  ward_id                uuid REFERENCES wards(id),  -- snapshot
  professional_id        uuid NOT NULL REFERENCES auth.users(id),
  specialty_id           uuid REFERENCES medical_specialties(id),
  template_id            uuid,                       -- FK adicionada após report_templates
  audio_url              text,
  audio_duration_seconds int,
  raw_transcription      text,
  edited_transcription   text,
  status                 consultation_status NOT NULL DEFAULT 'recording',
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  completed_at           timestamptz,
  locked_at              timestamptz                  -- setado quando paciente sai do ward do autor
);
CREATE INDEX idx_consultations_patient ON consultations(patient_id);
CREATE INDEX idx_consultations_professional ON consultations(professional_id);
CREATE INDEX idx_consultations_hospital ON consultations(hospital_id);
CREATE INDEX idx_consultations_ward ON consultations(ward_id);

------------------------------------------------------------------
-- 11) consultation_addenda — APPEND-ONLY
------------------------------------------------------------------
CREATE TABLE consultation_addenda (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id     uuid NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  author_id           uuid NOT NULL REFERENCES auth.users(id),
  author_role_at_time app_role NOT NULL,
  content             text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_addenda_consultation ON consultation_addenda(consultation_id);

------------------------------------------------------------------
-- 12) clinical_reports  — versionado
------------------------------------------------------------------
CREATE TABLE clinical_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  template_id     uuid,
  version         int NOT NULL DEFAULT 1,
  content         text NOT NULL,
  format          text NOT NULL DEFAULT 'markdown' CHECK (format IN ('markdown','html','plaintext')),
  generated_by    uuid REFERENCES auth.users(id),
  generated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consultation_id, version)
);

------------------------------------------------------------------
-- 13) report_templates
------------------------------------------------------------------
CREATE TABLE report_templates (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id            uuid REFERENCES hospitals(id) ON DELETE CASCADE,  -- NULL = global
  name                   text NOT NULL,
  description            text,
  prompt                 text NOT NULL,
  applicable_ward_types  ward_type[] NOT NULL DEFAULT ARRAY[]::ward_type[],
  applicable_specialties uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  applicable_roles       app_role[] NOT NULL DEFAULT ARRAY[]::app_role[],
  is_active              boolean NOT NULL DEFAULT true,
  version                int NOT NULL DEFAULT 1,
  created_by             uuid REFERENCES auth.users(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE consultations
  ADD CONSTRAINT fk_consultations_template
  FOREIGN KEY (template_id) REFERENCES report_templates(id);
ALTER TABLE clinical_reports
  ADD CONSTRAINT fk_reports_template
  FOREIGN KEY (template_id) REFERENCES report_templates(id);

------------------------------------------------------------------
-- 14) consultation_scripts — teleprompter
------------------------------------------------------------------
CREATE TABLE consultation_scripts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id           uuid REFERENCES hospitals(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  description           text,
  fields                jsonb NOT NULL DEFAULT '[]'::jsonb,
  applicable_ward_types ward_type[] NOT NULL DEFAULT ARRAY[]::ward_type[],
  is_active             boolean NOT NULL DEFAULT true,
  created_by            uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

------------------------------------------------------------------
-- 15) prompt_wizard_sessions  — TTL 30d
------------------------------------------------------------------
CREATE TABLE prompt_wizard_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id       uuid REFERENCES hospitals(id),
  messages          jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_prompt  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX idx_pws_user ON prompt_wizard_sessions(user_id);
CREATE INDEX idx_pws_expires ON prompt_wizard_sessions(expires_at);

------------------------------------------------------------------
-- 16) indicators
------------------------------------------------------------------
CREATE TABLE indicators (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id         uuid NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  code                text,
  name                text NOT NULL,
  description         text,
  unit                indicator_unit NOT NULL DEFAULT 'percent',
  target_value        numeric,
  threshold_warning   numeric,
  threshold_critical  numeric,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, code)
);

------------------------------------------------------------------
-- 17) indicator_values  — agregados por período
------------------------------------------------------------------
CREATE TABLE indicator_values (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id  uuid NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  numerator     numeric,
  denominator   numeric,
  value         numeric NOT NULL,
  collected_by  uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

------------------------------------------------------------------
-- 18) indicator_events
------------------------------------------------------------------
CREATE TABLE indicator_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id  uuid NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  hospital_id   uuid NOT NULL REFERENCES hospitals(id),
  patient_id    uuid REFERENCES patients(id) ON DELETE SET NULL,
  ward_id       uuid REFERENCES wards(id),
  event_data    jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  recorded_by   uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_ind_events_hospital ON indicator_events(hospital_id);

------------------------------------------------------------------
-- 19) ipsg_goals  — catalogo global JCI
------------------------------------------------------------------
CREATE TABLE ipsg_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text UNIQUE NOT NULL,
  name            text NOT NULL,
  description     text,
  checklist_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active       boolean NOT NULL DEFAULT true
);

------------------------------------------------------------------
-- 20) ipsg_audit_records
------------------------------------------------------------------
CREATE TABLE ipsg_audit_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id      uuid NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  ward_id          uuid REFERENCES wards(id),
  goal_id          uuid NOT NULL REFERENCES ipsg_goals(id),
  items            jsonb NOT NULL DEFAULT '[]'::jsonb,
  conformity_rate  numeric,
  notes            text,
  audited_by       uuid NOT NULL REFERENCES auth.users(id),
  audited_at       timestamptz NOT NULL DEFAULT now()
);

------------------------------------------------------------------
-- 21) ipsg_action_plans
------------------------------------------------------------------
CREATE TABLE ipsg_action_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id      uuid NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  audit_record_id  uuid REFERENCES ipsg_audit_records(id) ON DELETE SET NULL,
  title            text NOT NULL,
  description      text,
  owner_id         uuid REFERENCES auth.users(id),
  due_date         date,
  status           action_plan_status NOT NULL DEFAULT 'open',
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

------------------------------------------------------------------
-- 22) access_log — LGPD operacional
------------------------------------------------------------------
CREATE TABLE access_log (
  id             bigserial PRIMARY KEY,
  user_id        uuid REFERENCES auth.users(id),
  hospital_id    uuid REFERENCES hospitals(id),
  action         text NOT NULL,           -- 'view_patient','export_report', etc
  resource_type  text NOT NULL,
  resource_id    uuid,
  ip             text,
  user_agent     text,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_access_log_user_time ON access_log(user_id, created_at DESC);
CREATE INDEX idx_access_log_resource ON access_log(resource_type, resource_id);

------------------------------------------------------------------
-- 23) notifications
------------------------------------------------------------------
CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  title       text NOT NULL,
  body        text,
  url         text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;

------------------------------------------------------------------
-- 24) clinical_alerts
------------------------------------------------------------------
CREATE TABLE clinical_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id      uuid REFERENCES patients(id) ON DELETE CASCADE,
  hospital_id     uuid NOT NULL REFERENCES hospitals(id),
  kind            text NOT NULL,                   -- drug_interaction, allergy, abnormal_lab
  severity        alert_severity NOT NULL,
  title           text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- D) FUNÇÕES HELPER + TRIGGERS
-- ═══════════════════════════════════════════════════════════════════

-- updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DO $apply_updated_at$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'updated_at'
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
                   r.table_name, r.table_name);
  END LOOP;
END $apply_updated_at$;

-- helpers de RLS (todos SECURITY DEFINER para evitar recursão de policy)
CREATE OR REPLACE FUNCTION is_super_admin(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = uid AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION current_hospital_ids(uid uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT hospital_id), ARRAY[]::uuid[])
  FROM user_roles WHERE user_id = uid AND hospital_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION current_ward_ids(uid uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT ward_id), ARRAY[]::uuid[])
  FROM ward_assignments WHERE user_id = uid AND ended_at IS NULL
$$;

CREATE OR REPLACE FUNCTION is_hospital_admin_of(uid uuid, h_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = uid AND hospital_id = h_id AND role = 'hospital_admin'
  )
$$;

CREATE OR REPLACE FUNCTION has_role_in_hospital(uid uuid, r app_role, h_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = uid AND role = r AND hospital_id = h_id
  )
$$;

CREATE OR REPLACE FUNCTION can_edit_consultation(uid uuid, c_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v consultations%ROWTYPE;
  v_ward uuid;
BEGIN
  SELECT * INTO v FROM consultations WHERE id = c_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF is_super_admin(uid) THEN RETURN true; END IF;
  IF v.locked_at IS NOT NULL THEN RETURN false; END IF;
  IF v.professional_id <> uid THEN RETURN false; END IF;
  SELECT current_ward_id INTO v_ward FROM patients WHERE id = v.patient_id;
  RETURN v_ward = ANY (current_ward_ids(uid));
END $$;

-- handle_new_user — cria profile no signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (user_id, full_name)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name',
                   split_part(NEW.email, '@', 1)))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- lock automático de consultas quando paciente transfere
CREATE OR REPLACE FUNCTION lock_consultations_on_transfer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.current_ward_id IS DISTINCT FROM OLD.current_ward_id THEN
    UPDATE consultations
       SET locked_at = now()
     WHERE patient_id = NEW.id
       AND status = 'completed'
       AND locked_at IS NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_lock_on_transfer
  AFTER UPDATE OF current_ward_id ON patients
  FOR EACH ROW EXECUTE FUNCTION lock_consultations_on_transfer();

-- registra automaticamente patient_ward_history
CREATE OR REPLACE FUNCTION record_ward_transfer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.current_ward_id IS NOT NULL THEN
    INSERT INTO patient_ward_history (patient_id, ward_id, admitted_at)
    VALUES (NEW.id, NEW.current_ward_id, now());
  ELSIF TG_OP = 'UPDATE' AND NEW.current_ward_id IS DISTINCT FROM OLD.current_ward_id THEN
    IF OLD.current_ward_id IS NOT NULL THEN
      UPDATE patient_ward_history
         SET discharged_at = now(), discharged_by = auth.uid()
       WHERE patient_id = NEW.id AND ward_id = OLD.current_ward_id AND discharged_at IS NULL;
    END IF;
    IF NEW.current_ward_id IS NOT NULL THEN
      INSERT INTO patient_ward_history (patient_id, ward_id, admitted_at)
      VALUES (NEW.id, NEW.current_ward_id, now());
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_record_transfer
  AFTER INSERT OR UPDATE OF current_ward_id ON patients
  FOR EACH ROW EXECUTE FUNCTION record_ward_transfer();

-- ═══════════════════════════════════════════════════════════════════
-- E) RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════

DO $enable_rls$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $enable_rls$;

-- ───────── hospitals ─────────
CREATE POLICY hospitals_super ON hospitals FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY hospitals_member_select ON hospitals FOR SELECT TO authenticated
  USING (id = ANY (current_hospital_ids(auth.uid())));

-- ───────── wards ─────────
CREATE POLICY wards_super ON wards FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY wards_admin ON wards FOR ALL TO authenticated
  USING (is_hospital_admin_of(auth.uid(), hospital_id))
  WITH CHECK (is_hospital_admin_of(auth.uid(), hospital_id));
CREATE POLICY wards_member_select ON wards FOR SELECT TO authenticated
  USING (hospital_id = ANY (current_hospital_ids(auth.uid())));

-- ───────── medical_specialties (catalogo público) ─────────
CREATE POLICY ms_select ON medical_specialties FOR SELECT TO authenticated USING (true);
CREATE POLICY ms_super ON medical_specialties FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- ───────── profiles ─────────
CREATE POLICY profiles_self_select ON profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY profiles_self_update ON profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY profiles_self_insert ON profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY profiles_super ON profiles FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY profiles_hospital_member_select ON profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur1
      JOIN user_roles ur2 ON ur1.hospital_id = ur2.hospital_id
      WHERE ur1.user_id = profiles.user_id
        AND ur2.user_id = auth.uid()
        AND ur1.hospital_id IS NOT NULL
    )
  );

-- ───────── user_roles ─────────
CREATE POLICY ur_super ON user_roles FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY ur_self_select ON user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY ur_admin_manage ON user_roles FOR ALL TO authenticated
  USING (
    role <> 'super_admin'
    AND hospital_id IS NOT NULL
    AND is_hospital_admin_of(auth.uid(), hospital_id)
  )
  WITH CHECK (
    role <> 'super_admin'
    AND hospital_id IS NOT NULL
    AND is_hospital_admin_of(auth.uid(), hospital_id)
  );

-- ───────── ward_assignments ─────────
CREATE POLICY wa_super ON ward_assignments FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY wa_self_select ON ward_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY wa_admin ON ward_assignments FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM wards w WHERE w.id = ward_assignments.ward_id
            AND is_hospital_admin_of(auth.uid(), w.hospital_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM wards w WHERE w.id = ward_assignments.ward_id
            AND is_hospital_admin_of(auth.uid(), w.hospital_id))
  );

-- ───────── invitations ─────────
CREATE POLICY inv_super ON invitations FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY inv_admin ON invitations FOR ALL TO authenticated
  USING (is_hospital_admin_of(auth.uid(), hospital_id))
  WITH CHECK (is_hospital_admin_of(auth.uid(), hospital_id));

-- ───────── patients ─────────
CREATE POLICY patients_super ON patients FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY patients_admin ON patients FOR ALL TO authenticated
  USING (is_hospital_admin_of(auth.uid(), hospital_id))
  WITH CHECK (is_hospital_admin_of(auth.uid(), hospital_id));
CREATE POLICY patients_auditor_select ON patients FOR SELECT TO authenticated
  USING (has_role_in_hospital(auth.uid(), 'auditor', hospital_id));
CREATE POLICY patients_ward_select ON patients FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND current_ward_id = ANY (current_ward_ids(auth.uid()))
  );
CREATE POLICY patients_ward_insert ON patients FOR INSERT TO authenticated
  WITH CHECK (
    hospital_id = ANY (current_hospital_ids(auth.uid()))
    AND (current_ward_id IS NULL OR current_ward_id = ANY (current_ward_ids(auth.uid())))
  );
CREATE POLICY patients_ward_update ON patients FOR UPDATE TO authenticated
  USING (current_ward_id = ANY (current_ward_ids(auth.uid())))
  WITH CHECK (current_ward_id = ANY (current_ward_ids(auth.uid())));

-- ───────── patient_ward_history ─────────
CREATE POLICY pwh_super ON patient_ward_history FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY pwh_select ON patient_ward_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM patients p WHERE p.id = patient_ward_history.patient_id
      AND (
        is_hospital_admin_of(auth.uid(), p.hospital_id)
        OR has_role_in_hospital(auth.uid(), 'auditor', p.hospital_id)
        OR p.current_ward_id = ANY (current_ward_ids(auth.uid()))
        OR ward_id = ANY (current_ward_ids(auth.uid()))
      )
    )
  );

-- ───────── consultations ─────────
CREATE POLICY c_super ON consultations FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY c_admin ON consultations FOR ALL TO authenticated
  USING (is_hospital_admin_of(auth.uid(), hospital_id))
  WITH CHECK (is_hospital_admin_of(auth.uid(), hospital_id));
CREATE POLICY c_auditor_select ON consultations FOR SELECT TO authenticated
  USING (has_role_in_hospital(auth.uid(), 'auditor', hospital_id));
CREATE POLICY c_select_own_or_ward ON consultations FOR SELECT TO authenticated
  USING (
    professional_id = auth.uid()
    OR EXISTS (SELECT 1 FROM patients p WHERE p.id = consultations.patient_id
               AND p.current_ward_id = ANY (current_ward_ids(auth.uid())))
  );
CREATE POLICY c_insert ON consultations FOR INSERT TO authenticated
  WITH CHECK (
    professional_id = auth.uid()
    AND ward_id = ANY (current_ward_ids(auth.uid()))
    AND hospital_id = ANY (current_hospital_ids(auth.uid()))
  );
CREATE POLICY c_update_unlocked ON consultations FOR UPDATE TO authenticated
  USING (can_edit_consultation(auth.uid(), id))
  WITH CHECK (can_edit_consultation(auth.uid(), id));

-- ───────── consultation_addenda (APPEND-ONLY) ─────────
CREATE POLICY ad_super ON consultation_addenda FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY ad_select ON consultation_addenda FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM consultations c
            WHERE c.id = consultation_addenda.consultation_id
            AND (
              c.professional_id = auth.uid()
              OR is_hospital_admin_of(auth.uid(), c.hospital_id)
              OR has_role_in_hospital(auth.uid(), 'auditor', c.hospital_id)
              OR EXISTS (SELECT 1 FROM patients p WHERE p.id = c.patient_id
                         AND p.current_ward_id = ANY (current_ward_ids(auth.uid())))
            ))
  );
CREATE POLICY ad_insert ON consultation_addenda FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM consultations c
                WHERE c.id = consultation_addenda.consultation_id
                AND (
                  c.professional_id = auth.uid()
                  OR EXISTS (SELECT 1 FROM patients p WHERE p.id = c.patient_id
                             AND p.current_ward_id = ANY (current_ward_ids(auth.uid())))
                ))
  );
-- nem UPDATE nem DELETE — append-only

-- ───────── clinical_reports ─────────
CREATE POLICY cr_super ON clinical_reports FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY cr_select ON clinical_reports FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM consultations c WHERE c.id = clinical_reports.consultation_id
            AND (
              c.professional_id = auth.uid()
              OR is_hospital_admin_of(auth.uid(), c.hospital_id)
              OR has_role_in_hospital(auth.uid(), 'auditor', c.hospital_id)
              OR EXISTS (SELECT 1 FROM patients p WHERE p.id = c.patient_id
                         AND p.current_ward_id = ANY (current_ward_ids(auth.uid())))
            ))
  );
CREATE POLICY cr_insert ON clinical_reports FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM consultations c WHERE c.id = clinical_reports.consultation_id
            AND can_edit_consultation(auth.uid(), c.id))
  );

-- ───────── report_templates ─────────
CREATE POLICY rt_super ON report_templates FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY rt_admin ON report_templates FOR ALL TO authenticated
  USING (hospital_id IS NOT NULL AND is_hospital_admin_of(auth.uid(), hospital_id))
  WITH CHECK (hospital_id IS NOT NULL AND is_hospital_admin_of(auth.uid(), hospital_id));
CREATE POLICY rt_select ON report_templates FOR SELECT TO authenticated
  USING (
    is_active AND (
      hospital_id IS NULL
      OR hospital_id = ANY (current_hospital_ids(auth.uid()))
    )
  );

-- ───────── consultation_scripts ─────────
CREATE POLICY cs_super ON consultation_scripts FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY cs_admin ON consultation_scripts FOR ALL TO authenticated
  USING (hospital_id IS NOT NULL AND is_hospital_admin_of(auth.uid(), hospital_id))
  WITH CHECK (hospital_id IS NOT NULL AND is_hospital_admin_of(auth.uid(), hospital_id));
CREATE POLICY cs_select ON consultation_scripts FOR SELECT TO authenticated
  USING (
    is_active AND (
      hospital_id IS NULL
      OR hospital_id = ANY (current_hospital_ids(auth.uid()))
    )
  );

-- ───────── prompt_wizard_sessions ─────────
CREATE POLICY pws_super ON prompt_wizard_sessions FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY pws_self ON prompt_wizard_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ───────── indicators ─────────
CREATE POLICY ind_super ON indicators FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY ind_admin ON indicators FOR ALL TO authenticated
  USING (is_hospital_admin_of(auth.uid(), hospital_id))
  WITH CHECK (is_hospital_admin_of(auth.uid(), hospital_id));
CREATE POLICY ind_member_select ON indicators FOR SELECT TO authenticated
  USING (hospital_id = ANY (current_hospital_ids(auth.uid())));

-- ───────── indicator_values ─────────
CREATE POLICY iv_super ON indicator_values FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY iv_select ON indicator_values FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM indicators i WHERE i.id = indicator_values.indicator_id
                 AND i.hospital_id = ANY (current_hospital_ids(auth.uid()))));
CREATE POLICY iv_admin_or_auditor_write ON indicator_values FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM indicators i WHERE i.id = indicator_values.indicator_id
                 AND (is_hospital_admin_of(auth.uid(), i.hospital_id)
                      OR has_role_in_hospital(auth.uid(), 'auditor', i.hospital_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM indicators i WHERE i.id = indicator_values.indicator_id
                      AND (is_hospital_admin_of(auth.uid(), i.hospital_id)
                           OR has_role_in_hospital(auth.uid(), 'auditor', i.hospital_id))));

-- ───────── indicator_events ─────────
CREATE POLICY ie_super ON indicator_events FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY ie_select ON indicator_events FOR SELECT TO authenticated
  USING (hospital_id = ANY (current_hospital_ids(auth.uid())));
CREATE POLICY ie_insert ON indicator_events FOR INSERT TO authenticated
  WITH CHECK (
    hospital_id = ANY (current_hospital_ids(auth.uid()))
    AND (ward_id IS NULL OR ward_id = ANY (current_ward_ids(auth.uid())))
  );

-- ───────── ipsg_goals (catalogo público) ─────────
CREATE POLICY ig_select ON ipsg_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY ig_super ON ipsg_goals FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- ───────── ipsg_audit_records ─────────
CREATE POLICY iar_super ON ipsg_audit_records FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY iar_admin_or_auditor ON ipsg_audit_records FOR ALL TO authenticated
  USING (is_hospital_admin_of(auth.uid(), hospital_id)
         OR has_role_in_hospital(auth.uid(), 'auditor', hospital_id))
  WITH CHECK (is_hospital_admin_of(auth.uid(), hospital_id)
              OR has_role_in_hospital(auth.uid(), 'auditor', hospital_id));
CREATE POLICY iar_member_select ON ipsg_audit_records FOR SELECT TO authenticated
  USING (hospital_id = ANY (current_hospital_ids(auth.uid())));

-- ───────── ipsg_action_plans ─────────
CREATE POLICY iap_super ON ipsg_action_plans FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY iap_admin_or_auditor ON ipsg_action_plans FOR ALL TO authenticated
  USING (is_hospital_admin_of(auth.uid(), hospital_id)
         OR has_role_in_hospital(auth.uid(), 'auditor', hospital_id))
  WITH CHECK (is_hospital_admin_of(auth.uid(), hospital_id)
              OR has_role_in_hospital(auth.uid(), 'auditor', hospital_id));
CREATE POLICY iap_member_select ON ipsg_action_plans FOR SELECT TO authenticated
  USING (hospital_id = ANY (current_hospital_ids(auth.uid())));

-- ───────── access_log ─────────
CREATE POLICY al_super ON access_log FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY al_admin_select ON access_log FOR SELECT TO authenticated
  USING (hospital_id IS NOT NULL AND is_hospital_admin_of(auth.uid(), hospital_id));
CREATE POLICY al_self_insert ON access_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ───────── notifications ─────────
CREATE POLICY n_super ON notifications FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY n_self_select ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY n_self_update ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ───────── clinical_alerts ─────────
CREATE POLICY ca_super ON clinical_alerts FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY ca_admin ON clinical_alerts FOR ALL TO authenticated
  USING (is_hospital_admin_of(auth.uid(), hospital_id))
  WITH CHECK (is_hospital_admin_of(auth.uid(), hospital_id));
CREATE POLICY ca_select ON clinical_alerts FOR SELECT TO authenticated
  USING (
    has_role_in_hospital(auth.uid(), 'auditor', hospital_id)
    OR EXISTS (SELECT 1 FROM patients p WHERE p.id = clinical_alerts.patient_id
               AND p.current_ward_id = ANY (current_ward_ids(auth.uid())))
  );

-- ═══════════════════════════════════════════════════════════════════
-- F) SEED INICIAL
-- ═══════════════════════════════════════════════════════════════════

-- 1) Especialidades médicas (catalogo global)
INSERT INTO medical_specialties (name, slug) VALUES
  ('Clínica Médica',          'clinica-medica'),
  ('Cardiologia',              'cardiologia'),
  ('Cirurgia Geral',           'cirurgia-geral'),
  ('Pediatria',                'pediatria'),
  ('Ginecologia e Obstetrícia','ginecologia-obstetricia'),
  ('Ortopedia',                'ortopedia'),
  ('Neurologia',               'neurologia'),
  ('Oncologia',                'oncologia'),
  ('Anestesiologia',           'anestesiologia'),
  ('Medicina Intensiva',       'medicina-intensiva'),
  ('Medicina de Emergência',   'medicina-emergencia'),
  ('Enfermagem',               'enfermagem');

-- 2) IPSG goals (catalogo global JCI 8th ed.)
INSERT INTO ipsg_goals (code, name, description) VALUES
  ('IPSG.1', 'Identificar pacientes corretamente',
            'Usar pelo menos dois identificadores ao prestar cuidados.'),
  ('IPSG.2', 'Melhorar comunicação efetiva',
            'Padronizar handoffs, ordens verbais e resultados críticos.'),
  ('IPSG.3', 'Segurança em medicações de alta vigilância',
            'Identificar, rotular e estocar adequadamente medicações de alta vigilância.'),
  ('IPSG.4', 'Cirurgia segura',
            'Garantir local correto, procedimento correto, paciente correto.'),
  ('IPSG.5', 'Reduzir risco de infecções associadas aos cuidados',
            'Higiene das mãos e bundles de prevenção.'),
  ('IPSG.6', 'Reduzir risco de quedas',
            'Avaliação inicial e contínua de risco de queda em todos os pacientes.');

-- 3) Hospital de teste + 4) Wards (mesmo bloco pra capturar id)
DO $hospital_seed$
DECLARE
  v_hosp_id uuid;
BEGIN
  INSERT INTO hospitals (name, slug, plan)
  VALUES ('Clínica São Vicente', 'clinica-sao-vicente', 'demo')
  RETURNING id INTO v_hosp_id;

  INSERT INTO wards (hospital_id, name, ward_type, bed_count) VALUES
    (v_hosp_id, 'UTI',              'uti',              10),
    (v_hosp_id, 'Enfermaria',       'enfermaria',       30),
    (v_hosp_id, 'Pronto-Socorro',   'pronto_socorro',    8),
    (v_hosp_id, 'Centro Cirúrgico', 'centro_cirurgico',  4),
    (v_hosp_id, 'Ambulatório',      'ambulatorio',       0);

  RAISE NOTICE '✓ Hospital "Clínica São Vicente" criado com 5 wards';
END
$hospital_seed$;

-- 5) Templates globais (Health Ventures)
INSERT INTO report_templates (hospital_id, name, description, prompt, applicable_ward_types, applicable_roles) VALUES
  (NULL, 'Evolução Clínica (Internação)',
         'Evolução diária de paciente internado em enfermaria/UTI',
         'Você é um assistente clínico. A partir da transcrição de áudio do médico/enfermeiro, gere uma evolução clínica em formato SOAP (Subjetivo, Objetivo, Avaliação, Plano). Use linguagem técnica concisa. Cite achados relevantes do exame físico e sinais vitais quando mencionados. Não invente dados.',
         ARRAY['uti','enfermaria']::ward_type[],
         ARRAY['doctor','nurse']::app_role[]),
  (NULL, 'Consulta Ambulatorial',
         'Consulta de retorno ou primeira consulta ambulatorial',
         'Você é um assistente clínico. A partir da transcrição da consulta ambulatorial, gere um registro estruturado: Queixa principal, HDA, antecedentes, exame físico, hipóteses diagnósticas, conduta. Use linguagem médica formal, em português, sem inventar dados.',
         ARRAY['ambulatorio']::ward_type[],
         ARRAY['doctor']::app_role[]),
  (NULL, 'Admissão Hospitalar',
         'Anamnese de admissão (internação) — completa',
         'Você é um assistente clínico. A partir da transcrição da admissão, gere uma anamnese completa: Identificação, queixa principal, HDA detalhada, antecedentes patológicos/familiares/sociais, medicações em uso, alergias, exame físico segmentar, hipóteses diagnósticas, plano inicial. Português técnico, sem alucinação.',
         ARRAY['uti','enfermaria','pronto_socorro']::ward_type[],
         ARRAY['doctor','nurse']::app_role[]);

-- 6) Promover os 7 auth.users existentes — mapeamento já preenchido
DO $assign$
DECLARE
  v_hosp_id uuid;
  v_uti     uuid;
  v_enf     uuid;
  v_amb     uuid;
  v_ps      uuid;
  v_cc      uuid;
  r record;

  -- mapa de atribuição: email → role
  v_role_map text[][] := ARRAY[
    ['lfcfrontin@gmail.com',       'super_admin'],
    ['lfcfrontinw@outlook.com',    'hospital_admin'],
    ['marcelokal68@gmail.com',     'doctor'],
    ['marcilio.cortes@gmail.com',  'doctor'],
    ['gustavonobre5387@gmail.com', 'nurse'],
    ['marcotorelly@gmail.com',     'auditor'],
    ['medico.teste@gmail.com',     'nurse']
  ];

  -- mapa de atribuição: email → ward (ward_type)
  v_ward_map text[][] := ARRAY[
    ['marcelokal68@gmail.com',     'uti'],
    ['marcilio.cortes@gmail.com',  'ambulatorio'],
    ['gustavonobre5387@gmail.com', 'uti'],
    ['gustavonobre5387@gmail.com', 'enfermaria'],
    ['medico.teste@gmail.com',     'enfermaria']
  ];

  v_email   text;
  v_role    app_role;
  v_wt      ward_type;
  v_user_id uuid;
  v_ward_id uuid;
  v_target_hosp uuid;
  i int;
BEGIN
  SELECT id INTO v_hosp_id FROM hospitals WHERE slug = 'clinica-sao-vicente';
  SELECT id INTO v_uti FROM wards WHERE hospital_id = v_hosp_id AND ward_type = 'uti';
  SELECT id INTO v_enf FROM wards WHERE hospital_id = v_hosp_id AND ward_type = 'enfermaria';
  SELECT id INTO v_amb FROM wards WHERE hospital_id = v_hosp_id AND ward_type = 'ambulatorio';
  SELECT id INTO v_ps  FROM wards WHERE hospital_id = v_hosp_id AND ward_type = 'pronto_socorro';
  SELECT id INTO v_cc  FROM wards WHERE hospital_id = v_hosp_id AND ward_type = 'centro_cirurgico';

  -- Garante profile pra TODOS os auth.users
  FOR r IN SELECT id, email, raw_user_meta_data->>'full_name' AS full_name FROM auth.users LOOP
    INSERT INTO profiles (user_id, full_name)
    VALUES (r.id, COALESCE(r.full_name, split_part(r.email, '@', 1)))
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE '═══ Atribuindo papéis aos 7 usuários ═══';

  -- Atribui roles
  FOR i IN 1 .. array_length(v_role_map, 1) LOOP
    v_email := v_role_map[i][1];
    v_role  := v_role_map[i][2]::app_role;

    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email);
    IF v_user_id IS NULL THEN
      RAISE WARNING '  ✗ não encontrado: %', v_email;
      CONTINUE;
    END IF;

    v_target_hosp := CASE WHEN v_role = 'super_admin' THEN NULL ELSE v_hosp_id END;

    INSERT INTO user_roles (user_id, hospital_id, role)
    VALUES (v_user_id, v_target_hosp, v_role)
    ON CONFLICT (user_id, hospital_id, role) DO NOTHING;

    RAISE NOTICE '  ✓ % → %', v_email, v_role;
  END LOOP;

  -- Atribui wards
  RAISE NOTICE '═══ Atribuindo wards ═══';
  FOR i IN 1 .. array_length(v_ward_map, 1) LOOP
    v_email := v_ward_map[i][1];
    v_wt    := v_ward_map[i][2]::ward_type;

    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email);
    SELECT id INTO v_ward_id FROM wards
      WHERE hospital_id = v_hosp_id AND ward_type = v_wt;

    IF v_user_id IS NULL OR v_ward_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO ward_assignments (user_id, ward_id)
    VALUES (v_user_id, v_ward_id)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '  ✓ % → ward %', v_email, v_wt;
  END LOOP;

  RAISE NOTICE '═══ Atribuição concluída ═══';
END
$assign$;

-- 7) PLACEHOLDERS — descomente e ajuste o e-mail real de cada um
-- ─────────────────────────────────────────────────────────────────
-- Exemplo de como atribuir os outros usuários após você descobrir
-- os e-mails reais. Roda este bloco depois trocando os e-mails:
/*
DO $assign_team$
DECLARE
  v_hosp uuid; v_uti uuid; v_enf uuid; v_amb uuid;
  v_user uuid;
BEGIN
  SELECT id INTO v_hosp FROM hospitals WHERE slug = 'clinica-sao-vicente';
  SELECT id INTO v_uti  FROM wards WHERE hospital_id = v_hosp AND ward_type = 'uti';
  SELECT id INTO v_enf  FROM wards WHERE hospital_id = v_hosp AND ward_type = 'enfermaria';
  SELECT id INTO v_amb  FROM wards WHERE hospital_id = v_hosp AND ward_type = 'ambulatorio';

  -- Marcelo Kalichsztein → doctor (UTI)
  SELECT id INTO v_user FROM auth.users WHERE email = 'EMAIL_MARCELO@dominio.com';
  IF v_user IS NOT NULL THEN
    INSERT INTO user_roles (user_id, hospital_id, role) VALUES (v_user, v_hosp, 'doctor')
      ON CONFLICT DO NOTHING;
    INSERT INTO ward_assignments (user_id, ward_id) VALUES (v_user, v_uti)
      ON CONFLICT DO NOTHING;
  END IF;

  -- Marcilio Cortes → doctor (Ambulatório)
  SELECT id INTO v_user FROM auth.users WHERE email = 'EMAIL_MARCILIO@dominio.com';
  IF v_user IS NOT NULL THEN
    INSERT INTO user_roles (user_id, hospital_id, role) VALUES (v_user, v_hosp, 'doctor')
      ON CONFLICT DO NOTHING;
    INSERT INTO ward_assignments (user_id, ward_id) VALUES (v_user, v_amb)
      ON CONFLICT DO NOTHING;
  END IF;

  -- Gustavo Nobre → nurse (UTI + Enfermaria)
  SELECT id INTO v_user FROM auth.users WHERE email = 'EMAIL_GUSTAVO@dominio.com';
  IF v_user IS NOT NULL THEN
    INSERT INTO user_roles (user_id, hospital_id, role) VALUES (v_user, v_hosp, 'nurse')
      ON CONFLICT DO NOTHING;
    INSERT INTO ward_assignments (user_id, ward_id) VALUES (v_user, v_uti)
      ON CONFLICT DO NOTHING;
    INSERT INTO ward_assignments (user_id, ward_id) VALUES (v_user, v_enf)
      ON CONFLICT DO NOTHING;
  END IF;

  -- Marco Torelly → auditor (sem ward — read-only do hospital todo)
  SELECT id INTO v_user FROM auth.users WHERE email = 'EMAIL_MARCO@dominio.com';
  IF v_user IS NOT NULL THEN
    INSERT INTO user_roles (user_id, hospital_id, role) VALUES (v_user, v_hosp, 'auditor')
      ON CONFLICT DO NOTHING;
  END IF;
END
$assign_team$;
*/

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- 🎉 FIM. Schema novo está pronto.
-- ═══════════════════════════════════════════════════════════════════

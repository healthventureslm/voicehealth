// Auto-aligned with public schema rebuild v2 (24 tables, 8 enums).
// Hand-written from the SQL migration in db-rebuild/03_create.sql.
// Regenerate via `supabase gen types typescript --project-id paqwiibclhahzhbvbdlz` if you want.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      // ───────── Tenancy & Identidade ─────────
      hospitals: {
        Row: {
          id: string;
          name: string;
          slug: string;
          cnpj: string | null;
          plan: string;
          is_active: boolean;
          metadata: Json;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          cnpj?: string | null;
          plan?: string;
          is_active?: boolean;
          metadata?: Json;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["hospitals"]["Insert"]>;
        Relationships: [];
      };

      wards: {
        Row: {
          id: string;
          hospital_id: string;
          name: string;
          ward_type: Database["public"]["Enums"]["ward_type"];
          bed_count: number;
          is_active: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hospital_id: string;
          name: string;
          ward_type?: Database["public"]["Enums"]["ward_type"];
          bed_count?: number;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["wards"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "wards_hospital_id_fkey"; columns: ["hospital_id"]; referencedRelation: "hospitals"; referencedColumns: ["id"] },
        ];
      };

      medical_specialties: {
        Row: {
          id: string;
          name: string;
          slug: string;
          output_prompt: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          output_prompt?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["medical_specialties"]["Insert"]>;
        Relationships: [];
      };

      profiles: {
        Row: {
          user_id: string;
          full_name: string | null;
          professional_role: string | null;
          specialty_id: string | null;
          avatar_url: string | null;
          lgpd_consented_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          full_name?: string | null;
          professional_role?: string | null;
          specialty_id?: string | null;
          avatar_url?: string | null;
          lgpd_consented_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "profiles_specialty_id_fkey"; columns: ["specialty_id"]; referencedRelation: "medical_specialties"; referencedColumns: ["id"] },
        ];
      };

      user_roles: {
        Row: {
          id: string;
          user_id: string;
          hospital_id: string | null;
          role: Database["public"]["Enums"]["app_role"];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          hospital_id?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "user_roles_hospital_id_fkey"; columns: ["hospital_id"]; referencedRelation: "hospitals"; referencedColumns: ["id"] },
        ];
      };

      ward_assignments: {
        Row: {
          id: string;
          user_id: string;
          ward_id: string;
          started_at: string;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ward_id: string;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ward_assignments"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "ward_assignments_ward_id_fkey"; columns: ["ward_id"]; referencedRelation: "wards"; referencedColumns: ["id"] },
        ];
      };

      invitations: {
        Row: {
          id: string;
          hospital_id: string;
          email: string;
          role: Database["public"]["Enums"]["app_role"];
          ward_ids: string[];
          token: string;
          status: Database["public"]["Enums"]["invitation_status"];
          invited_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          hospital_id: string;
          email: string;
          role: Database["public"]["Enums"]["app_role"];
          ward_ids?: string[];
          token?: string;
          status?: Database["public"]["Enums"]["invitation_status"];
          invited_by?: string | null;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["invitations"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "invitations_hospital_id_fkey"; columns: ["hospital_id"]; referencedRelation: "hospitals"; referencedColumns: ["id"] },
        ];
      };

      // ───────── Clínica ─────────
      patients: {
        Row: {
          id: string;
          hospital_id: string;
          full_name: string;
          initials: string | null;
          medical_record: string | null;
          bed: string | null;
          date_of_birth: string | null;
          current_ward_id: string | null;
          admission_status: Database["public"]["Enums"]["patient_admission_status"];
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          hospital_id: string;
          full_name: string;
          initials?: string | null;
          medical_record?: string | null;
          bed?: string | null;
          date_of_birth?: string | null;
          current_ward_id?: string | null;
          admission_status?: Database["public"]["Enums"]["patient_admission_status"];
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["patients"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "patients_hospital_id_fkey"; columns: ["hospital_id"]; referencedRelation: "hospitals"; referencedColumns: ["id"] },
          { foreignKeyName: "patients_current_ward_id_fkey"; columns: ["current_ward_id"]; referencedRelation: "wards"; referencedColumns: ["id"] },
        ];
      };

      patient_ward_history: {
        Row: {
          id: string;
          patient_id: string;
          ward_id: string;
          admitted_at: string;
          discharged_at: string | null;
          discharged_by: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          ward_id: string;
          admitted_at?: string;
          discharged_at?: string | null;
          discharged_by?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["patient_ward_history"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "pwh_patient_id_fkey"; columns: ["patient_id"]; referencedRelation: "patients"; referencedColumns: ["id"] },
          { foreignKeyName: "pwh_ward_id_fkey"; columns: ["ward_id"]; referencedRelation: "wards"; referencedColumns: ["id"] },
        ];
      };

      consultations: {
        Row: {
          id: string;
          hospital_id: string;
          patient_id: string;
          ward_id: string | null;
          professional_id: string;
          specialty_id: string | null;
          template_id: string | null;
          audio_url: string | null;
          audio_duration_seconds: number | null;
          raw_transcription: string | null;
          edited_transcription: string | null;
          status: Database["public"]["Enums"]["consultation_status"];
          metadata: Json;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
          locked_at: string | null;
        };
        Insert: {
          id?: string;
          hospital_id: string;
          patient_id: string;
          ward_id?: string | null;
          professional_id: string;
          specialty_id?: string | null;
          template_id?: string | null;
          audio_url?: string | null;
          audio_duration_seconds?: number | null;
          raw_transcription?: string | null;
          edited_transcription?: string | null;
          status?: Database["public"]["Enums"]["consultation_status"];
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          locked_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["consultations"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "c_hospital_id_fkey"; columns: ["hospital_id"]; referencedRelation: "hospitals"; referencedColumns: ["id"] },
          { foreignKeyName: "c_patient_id_fkey"; columns: ["patient_id"]; referencedRelation: "patients"; referencedColumns: ["id"] },
          { foreignKeyName: "c_ward_id_fkey"; columns: ["ward_id"]; referencedRelation: "wards"; referencedColumns: ["id"] },
        ];
      };

      consultation_addenda: {
        Row: {
          id: string;
          consultation_id: string;
          author_id: string;
          author_role_at_time: Database["public"]["Enums"]["app_role"];
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          consultation_id: string;
          author_id: string;
          author_role_at_time: Database["public"]["Enums"]["app_role"];
          content: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["consultation_addenda"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "ad_consultation_id_fkey"; columns: ["consultation_id"]; referencedRelation: "consultations"; referencedColumns: ["id"] },
        ];
      };

      clinical_reports: {
        Row: {
          id: string;
          consultation_id: string | null;
          patient_id: string;
          source_consultation_ids: string[];
          template_id: string | null;
          version: number;
          content: string;
          format: string;
          filled_data: Json | null;
          generated_by: string | null;
          generated_at: string;
        };
        Insert: {
          id?: string;
          consultation_id?: string | null;
          patient_id: string;
          source_consultation_ids?: string[];
          template_id?: string | null;
          version?: number;
          content: string;
          format?: string;
          filled_data?: Json | null;
          generated_by?: string | null;
          generated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clinical_reports"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "cr_consultation_id_fkey"; columns: ["consultation_id"]; referencedRelation: "consultations"; referencedColumns: ["id"] },
          { foreignKeyName: "cr_patient_id_fkey"; columns: ["patient_id"]; referencedRelation: "patients"; referencedColumns: ["id"] },
        ];
      };

      // ───────── IA / Prompts ─────────
      report_templates: {
        Row: {
          id: string;
          hospital_id: string | null;
          name: string;
          description: string | null;
          prompt: string;
          schema: Json | null;
          display_layout: Json | null;
          applicable_ward_types: Database["public"]["Enums"]["ward_type"][];
          applicable_specialties: string[];
          applicable_roles: Database["public"]["Enums"]["app_role"][];
          is_active: boolean;
          version: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hospital_id?: string | null;
          name: string;
          description?: string | null;
          prompt: string;
          schema?: Json | null;
          display_layout?: Json | null;
          applicable_ward_types?: Database["public"]["Enums"]["ward_type"][];
          applicable_specialties?: string[];
          applicable_roles?: Database["public"]["Enums"]["app_role"][];
          is_active?: boolean;
          version?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["report_templates"]["Insert"]>;
        Relationships: [];
      };

      consultation_scripts: {
        Row: {
          id: string;
          hospital_id: string | null;
          name: string;
          description: string | null;
          fields: Json;
          applicable_ward_types: Database["public"]["Enums"]["ward_type"][];
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hospital_id?: string | null;
          name: string;
          description?: string | null;
          fields?: Json;
          applicable_ward_types?: Database["public"]["Enums"]["ward_type"][];
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["consultation_scripts"]["Insert"]>;
        Relationships: [];
      };

      prompt_wizard_sessions: {
        Row: {
          id: string;
          user_id: string;
          hospital_id: string | null;
          messages: Json;
          generated_prompt: string | null;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          hospital_id?: string | null;
          messages?: Json;
          generated_prompt?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["prompt_wizard_sessions"]["Insert"]>;
        Relationships: [];
      };

      // ───────── Indicadores ─────────
      indicators: {
        Row: {
          id: string;
          hospital_id: string;
          code: string | null;
          name: string;
          description: string | null;
          unit: Database["public"]["Enums"]["indicator_unit"];
          target_value: number | null;
          threshold_warning: number | null;
          threshold_critical: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hospital_id: string;
          code?: string | null;
          name: string;
          description?: string | null;
          unit?: Database["public"]["Enums"]["indicator_unit"];
          target_value?: number | null;
          threshold_warning?: number | null;
          threshold_critical?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["indicators"]["Insert"]>;
        Relationships: [];
      };

      indicator_values: {
        Row: {
          id: string;
          indicator_id: string;
          period_start: string;
          period_end: string;
          numerator: number | null;
          denominator: number | null;
          value: number;
          collected_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          indicator_id: string;
          period_start: string;
          period_end: string;
          numerator?: number | null;
          denominator?: number | null;
          value: number;
          collected_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["indicator_values"]["Insert"]>;
        Relationships: [];
      };

      indicator_events: {
        Row: {
          id: string;
          indicator_id: string;
          hospital_id: string;
          patient_id: string | null;
          ward_id: string | null;
          event_data: Json;
          occurred_at: string;
          recorded_by: string | null;
        };
        Insert: {
          id?: string;
          indicator_id: string;
          hospital_id: string;
          patient_id?: string | null;
          ward_id?: string | null;
          event_data?: Json;
          occurred_at?: string;
          recorded_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["indicator_events"]["Insert"]>;
        Relationships: [];
      };

      // ───────── IPSG ─────────
      ipsg_goals: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          checklist_items: Json;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          checklist_items?: Json;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["ipsg_goals"]["Insert"]>;
        Relationships: [];
      };

      ipsg_audit_records: {
        Row: {
          id: string;
          hospital_id: string;
          ward_id: string | null;
          goal_id: string;
          items: Json;
          conformity_rate: number | null;
          notes: string | null;
          audited_by: string;
          audited_at: string;
        };
        Insert: {
          id?: string;
          hospital_id: string;
          ward_id?: string | null;
          goal_id: string;
          items?: Json;
          conformity_rate?: number | null;
          notes?: string | null;
          audited_by: string;
          audited_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ipsg_audit_records"]["Insert"]>;
        Relationships: [];
      };

      ipsg_action_plans: {
        Row: {
          id: string;
          hospital_id: string;
          audit_record_id: string | null;
          title: string;
          description: string | null;
          owner_id: string | null;
          due_date: string | null;
          status: Database["public"]["Enums"]["action_plan_status"];
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hospital_id: string;
          audit_record_id?: string | null;
          title: string;
          description?: string | null;
          owner_id?: string | null;
          due_date?: string | null;
          status?: Database["public"]["Enums"]["action_plan_status"];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ipsg_action_plans"]["Insert"]>;
        Relationships: [];
      };

      // ───────── Sistema ─────────
      access_log: {
        Row: {
          id: number;
          user_id: string | null;
          hospital_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          ip: string | null;
          user_agent: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id?: string | null;
          hospital_id?: string | null;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          ip?: string | null;
          user_agent?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["access_log"]["Insert"]>;
        Relationships: [];
      };

      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          url: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          body?: string | null;
          url?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };

      clinical_alerts: {
        Row: {
          id: string;
          consultation_id: string | null;
          patient_id: string | null;
          hospital_id: string;
          kind: string;
          severity: Database["public"]["Enums"]["alert_severity"];
          title: string;
          payload: Json;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          consultation_id?: string | null;
          patient_id?: string | null;
          hospital_id: string;
          kind: string;
          severity: Database["public"]["Enums"]["alert_severity"];
          title: string;
          payload?: Json;
          resolved_at?: string | null;
          resolved_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clinical_alerts"]["Insert"]>;
        Relationships: [];
      };
    };

    Views: { [_ in never]: never };

    Functions: {
      is_super_admin: { Args: { uid: string }; Returns: boolean };
      current_hospital_ids: { Args: { uid: string }; Returns: string[] };
      current_ward_ids: { Args: { uid: string }; Returns: string[] };
      is_hospital_admin_of: { Args: { uid: string; h_id: string }; Returns: boolean };
      has_role_in_hospital: {
        Args: { uid: string; r: Database["public"]["Enums"]["app_role"]; h_id: string };
        Returns: boolean;
      };
      can_edit_consultation: { Args: { uid: string; c_id: string }; Returns: boolean };
      list_hospital_patients: {
        Args: Record<string, never>;
        Returns: Array<{
          id: string;
          hospital_id: string;
          full_name: string;
          current_ward_id: string | null;
          admission_status: Database["public"]["Enums"]["patient_admission_status"];
          ward_name: string | null;
          ward_type: Database["public"]["Enums"]["ward_type"] | null;
          created_at: string;
        }>;
      };
    };

    Enums: {
      app_role: "super_admin" | "hospital_admin" | "doctor" | "nurse" | "auditor";
      ward_type: "uti" | "enfermaria" | "centro_cirurgico" | "pronto_socorro" | "ambulatorio";
      consultation_status: "recording" | "transcribing" | "transcribed" | "editing" | "completed";
      patient_admission_status: "admitted" | "discharged" | "transferred";
      invitation_status: "pending" | "accepted" | "expired" | "revoked";
      indicator_unit: "percent" | "count" | "rate" | "days";
      action_plan_status: "open" | "in_progress" | "done" | "cancelled";
      alert_severity: "info" | "warning" | "critical";
    };

    CompositeTypes: { [_ in never]: never };
  };
};

// ─── Helpers públicos ────────────────────────────────────────────────────
type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends { Row: infer R }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends { Row: infer R }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends { Update: infer U }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema["Enums"] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never;

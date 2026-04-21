export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_whitelist: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      bundle_alerts: {
        Row: {
          created_at: string
          department_id: string
          event_id: string
          failed_items: Json
          id: string
          indicator_id: string
          is_resolved: boolean
          message: string
          notified_users: Json | null
          patient_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          subtype_id: string | null
          ward_id: string | null
        }
        Insert: {
          created_at?: string
          department_id: string
          event_id: string
          failed_items?: Json
          id?: string
          indicator_id: string
          is_resolved?: boolean
          message: string
          notified_users?: Json | null
          patient_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          subtype_id?: string | null
          ward_id?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string
          event_id?: string
          failed_items?: Json
          id?: string
          indicator_id?: string
          is_resolved?: boolean
          message?: string
          notified_users?: Json | null
          patient_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          subtype_id?: string | null
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bundle_alerts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "indicator_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_alerts_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_alerts_subtype_id_fkey"
            columns: ["subtype_id"]
            isOneToOne: false
            referencedRelation: "indicator_subtypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_alerts_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_alerts: {
        Row: {
          alert_type: string
          consultation_id: string
          created_at: string
          description: string
          id: string
          is_dismissed: boolean
          protocol_id: string | null
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          consultation_id: string
          created_at?: string
          description: string
          id?: string
          is_dismissed?: boolean
          protocol_id?: string | null
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          consultation_id?: string
          created_at?: string
          description?: string
          id?: string
          is_dismissed?: boolean
          protocol_id?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_alerts_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_alerts_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "clinical_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_protocols: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          is_active: boolean
          keywords: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_protocols_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_reports: {
        Row: {
          consultation_id: string
          content: string
          created_at: string
          generated_by: string | null
          id: string
          organization_id: string | null
          template_type: string
        }
        Insert: {
          consultation_id: string
          content: string
          created_at?: string
          generated_by?: string | null
          id?: string
          organization_id?: string | null
          template_type: string
        }
        Update: {
          consultation_id?: string
          content?: string
          created_at?: string
          generated_by?: string | null
          id?: string
          organization_id?: string | null
          template_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_reports_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_logs: {
        Row: {
          batch_id: string
          calculated_value: number | null
          created_at: string
          denominator: number | null
          department_id: string | null
          department_name: string
          error_message: string | null
          id: string
          indicator_id: string | null
          indicator_name: string
          numerator: number | null
          status: string
        }
        Insert: {
          batch_id?: string
          calculated_value?: number | null
          created_at?: string
          denominator?: number | null
          department_id?: string | null
          department_name?: string
          error_message?: string | null
          id?: string
          indicator_id?: string | null
          indicator_name?: string
          numerator?: number | null
          status?: string
        }
        Update: {
          batch_id?: string
          calculated_value?: number | null
          created_at?: string
          denominator?: number | null
          department_id?: string | null
          department_name?: string
          error_message?: string | null
          id?: string
          indicator_id?: string | null
          indicator_name?: string
          numerator?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_logs_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_scripts: {
        Row: {
          created_at: string
          description: string
          fields: Json
          id: string
          is_active: boolean
          linked_template_id: string | null
          name: string
          report_type: string | null
          sector: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          fields?: Json
          id?: string
          is_active?: boolean
          linked_template_id?: string | null
          name: string
          report_type?: string | null
          sector?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          fields?: Json
          id?: string
          is_active?: boolean
          linked_template_id?: string | null
          name?: string
          report_type?: string | null
          sector?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_scripts_linked_template_id_fkey"
            columns: ["linked_template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          ai_summary: string | null
          audio_url: string | null
          created_at: string
          department_id: string
          edited_transcription: string | null
          id: string
          organization_id: string | null
          patient_id: string
          professional_id: string
          raw_transcription: string | null
          selected_template_id: string | null
          specialty_id: string | null
          status: string
          updated_at: string
          ward_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          audio_url?: string | null
          created_at?: string
          department_id: string
          edited_transcription?: string | null
          id?: string
          organization_id?: string | null
          patient_id: string
          professional_id: string
          raw_transcription?: string | null
          selected_template_id?: string | null
          specialty_id?: string | null
          status?: string
          updated_at?: string
          ward_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          audio_url?: string | null
          created_at?: string
          department_id?: string
          edited_transcription?: string | null
          id?: string
          organization_id?: string | null
          patient_id?: string
          professional_id?: string
          raw_transcription?: string | null
          selected_template_id?: string | null
          specialty_id?: string | null
          status?: string
          updated_at?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_selected_template_id_fkey"
            columns: ["selected_template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "medical_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          hospital_name: string | null
          id: string
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hospital_name?: string | null
          id?: string
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hospital_name?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fhir_connections: {
        Row: {
          auth_type: string
          base_url: string
          created_at: string
          credentials: Json
          department_id: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          auth_type?: string
          base_url: string
          created_at?: string
          credentials?: Json
          department_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          auth_type?: string
          base_url?: string
          created_at?: string
          credentials?: Json
          department_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fhir_connections_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      fhir_resource_mappings: {
        Row: {
          connection_id: string
          created_at: string
          field_mappings: Json
          id: string
          is_active: boolean
          local_table: string
          resource_type: string
          updated_at: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          field_mappings?: Json
          id?: string
          is_active?: boolean
          local_table: string
          resource_type: string
          updated_at?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          field_mappings?: Json
          id?: string
          is_active?: boolean
          local_table?: string
          resource_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fhir_resource_mappings_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "fhir_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      fhir_sync_logs: {
        Row: {
          connection_id: string
          created_at: string
          direction: string
          error_message: string | null
          id: string
          resource_id: string | null
          resource_type: string
          status: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          resource_id?: string | null
          resource_type: string
          status?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          resource_id?: string | null
          resource_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fhir_sync_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "fhir_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      high_alert_medications: {
        Row: {
          category: string | null
          created_at: string
          department_id: string | null
          id: string
          is_active: boolean
          lasa_pairs: Json | null
          last_review_date: string | null
          name: string
          risk_level: string
          storage_requirements: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          lasa_pairs?: Json | null
          last_review_date?: string | null
          name: string
          risk_level?: string
          storage_requirements?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          lasa_pairs?: Json | null
          last_review_date?: string | null
          name?: string
          risk_level?: string
          storage_requirements?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "high_alert_medications_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_alerts: {
        Row: {
          created_at: string
          current_value: number | null
          department_id: string
          email_sent: boolean
          id: string
          indicator_id: string
          indicator_value_id: string | null
          is_read: boolean
          message: string
          severity: string
          target_value: number | null
        }
        Insert: {
          created_at?: string
          current_value?: number | null
          department_id: string
          email_sent?: boolean
          id?: string
          indicator_id: string
          indicator_value_id?: string | null
          is_read?: boolean
          message: string
          severity?: string
          target_value?: number | null
        }
        Update: {
          created_at?: string
          current_value?: number | null
          department_id?: string
          email_sent?: boolean
          id?: string
          indicator_id?: string
          indicator_value_id?: string | null
          is_read?: boolean
          message?: string
          severity?: string
          target_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicator_alerts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_alerts_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_alerts_indicator_value_id_fkey"
            columns: ["indicator_value_id"]
            isOneToOne: false
            referencedRelation: "indicator_values"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_events: {
        Row: {
          bundle_compliance: Json | null
          bundle_score: number | null
          corrective_action: string | null
          created_at: string
          department_id: string
          event_date: string
          id: string
          indicator_id: string
          notes: string | null
          patient_id: string | null
          recorded_by: string
          root_cause: string | null
          subtype_id: string | null
          updated_at: string
          ward_id: string | null
        }
        Insert: {
          bundle_compliance?: Json | null
          bundle_score?: number | null
          corrective_action?: string | null
          created_at?: string
          department_id: string
          event_date?: string
          id?: string
          indicator_id: string
          notes?: string | null
          patient_id?: string | null
          recorded_by: string
          root_cause?: string | null
          subtype_id?: string | null
          updated_at?: string
          ward_id?: string | null
        }
        Update: {
          bundle_compliance?: Json | null
          bundle_score?: number | null
          corrective_action?: string | null
          created_at?: string
          department_id?: string
          event_date?: string
          id?: string
          indicator_id?: string
          notes?: string | null
          patient_id?: string | null
          recorded_by?: string
          root_cause?: string | null
          subtype_id?: string | null
          updated_at?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicator_events_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_events_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_events_subtype_id_fkey"
            columns: ["subtype_id"]
            isOneToOne: false
            referencedRelation: "indicator_subtypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_events_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_subtypes: {
        Row: {
          bundle_items: Json
          code: string
          created_at: string
          critical_threshold: number | null
          description: string | null
          id: string
          indicator_id: string
          is_active: boolean
          name: string
          target_value: number | null
          updated_at: string
          warning_threshold: number | null
        }
        Insert: {
          bundle_items?: Json
          code: string
          created_at?: string
          critical_threshold?: number | null
          description?: string | null
          id?: string
          indicator_id: string
          is_active?: boolean
          name: string
          target_value?: number | null
          updated_at?: string
          warning_threshold?: number | null
        }
        Update: {
          bundle_items?: Json
          code?: string
          created_at?: string
          critical_threshold?: number | null
          description?: string | null
          id?: string
          indicator_id?: string
          is_active?: boolean
          name?: string
          target_value?: number | null
          updated_at?: string
          warning_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicator_subtypes_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_values: {
        Row: {
          calculated_value: number | null
          created_at: string
          denominator_value: number
          department_id: string
          id: string
          indicator_id: string
          notes: string | null
          numerator_value: number
          period_end: string
          period_start: string
          recorded_by: string | null
          source: string
          subtype_id: string | null
          updated_at: string
        }
        Insert: {
          calculated_value?: number | null
          created_at?: string
          denominator_value?: number
          department_id: string
          id?: string
          indicator_id: string
          notes?: string | null
          numerator_value?: number
          period_end: string
          period_start: string
          recorded_by?: string | null
          source?: string
          subtype_id?: string | null
          updated_at?: string
        }
        Update: {
          calculated_value?: number | null
          created_at?: string
          denominator_value?: number
          department_id?: string
          id?: string
          indicator_id?: string
          notes?: string | null
          numerator_value?: number
          period_end?: string
          period_start?: string
          recorded_by?: string | null
          source?: string
          subtype_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_values_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_values_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicator_values_subtype_id_fkey"
            columns: ["subtype_id"]
            isOneToOne: false
            referencedRelation: "indicator_subtypes"
            referencedColumns: ["id"]
          },
        ]
      }
      indicators: {
        Row: {
          auto_agg_column: string | null
          auto_denominator_filter: Json | null
          auto_enabled: boolean
          auto_numerator_filter: Json | null
          auto_operation: string
          auto_source: string | null
          calc_type: string
          category: string | null
          created_at: string
          created_by: string | null
          critical_threshold: number | null
          denominator_label: string
          department_id: string | null
          description: string | null
          formula_description: string | null
          frequency: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          numerator_label: string
          target_value: number | null
          unit: string
          updated_at: string
          warning_threshold: number | null
        }
        Insert: {
          auto_agg_column?: string | null
          auto_denominator_filter?: Json | null
          auto_enabled?: boolean
          auto_numerator_filter?: Json | null
          auto_operation?: string
          auto_source?: string | null
          calc_type?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          critical_threshold?: number | null
          denominator_label?: string
          department_id?: string | null
          description?: string | null
          formula_description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          numerator_label?: string
          target_value?: number | null
          unit?: string
          updated_at?: string
          warning_threshold?: number | null
        }
        Update: {
          auto_agg_column?: string | null
          auto_denominator_filter?: Json | null
          auto_enabled?: boolean
          auto_numerator_filter?: Json | null
          auto_operation?: string
          auto_source?: string | null
          calc_type?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          critical_threshold?: number | null
          denominator_label?: string
          department_id?: string | null
          description?: string | null
          formula_description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          numerator_label?: string
          target_value?: number | null
          unit?: string
          updated_at?: string
          warning_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicators_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      infection_surveillance: {
        Row: {
          bundle_compliance: Json | null
          created_at: string
          department_id: string
          device_type: string | null
          id: string
          infection_type: string
          is_device_related: boolean
          notes: string | null
          onset_date: string
          organism: string | null
          patient_id: string | null
          recorded_by: string
          updated_at: string
          ward_id: string | null
        }
        Insert: {
          bundle_compliance?: Json | null
          created_at?: string
          department_id: string
          device_type?: string | null
          id?: string
          infection_type: string
          is_device_related?: boolean
          notes?: string | null
          onset_date?: string
          organism?: string | null
          patient_id?: string | null
          recorded_by: string
          updated_at?: string
          ward_id?: string | null
        }
        Update: {
          bundle_compliance?: Json | null
          created_at?: string
          department_id?: string
          device_type?: string | null
          id?: string
          infection_type?: string
          is_device_related?: boolean
          notes?: string | null
          onset_date?: string
          organism?: string | null
          patient_id?: string | null
          recorded_by?: string
          updated_at?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "infection_surveillance_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infection_surveillance_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infection_surveillance_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          department_id: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ipsg_action_plans: {
        Row: {
          audit_record_id: string | null
          completed_at: string | null
          created_at: string
          department_id: string
          description: string | null
          due_date: string | null
          id: string
          ipsg_goal_id: string
          responsible_id: string | null
          status: string
          title: string
          updated_at: string
          ward_id: string | null
        }
        Insert: {
          audit_record_id?: string | null
          completed_at?: string | null
          created_at?: string
          department_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          ipsg_goal_id: string
          responsible_id?: string | null
          status?: string
          title: string
          updated_at?: string
          ward_id?: string | null
        }
        Update: {
          audit_record_id?: string | null
          completed_at?: string | null
          created_at?: string
          department_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          ipsg_goal_id?: string
          responsible_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ipsg_action_plans_audit_record_id_fkey"
            columns: ["audit_record_id"]
            isOneToOne: false
            referencedRelation: "ipsg_audit_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipsg_action_plans_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipsg_action_plans_ipsg_goal_id_fkey"
            columns: ["ipsg_goal_id"]
            isOneToOne: false
            referencedRelation: "ipsg_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipsg_action_plans_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      ipsg_audit_checklists: {
        Row: {
          applicable_ward_types: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          frequency: string
          id: string
          ipsg_goal_id: string
          is_active: boolean
          items: Json
          title: string
          updated_at: string
        }
        Insert: {
          applicable_ward_types?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency?: string
          id?: string
          ipsg_goal_id: string
          is_active?: boolean
          items?: Json
          title: string
          updated_at?: string
        }
        Update: {
          applicable_ward_types?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency?: string
          id?: string
          ipsg_goal_id?: string
          is_active?: boolean
          items?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ipsg_audit_checklists_ipsg_goal_id_fkey"
            columns: ["ipsg_goal_id"]
            isOneToOne: false
            referencedRelation: "ipsg_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      ipsg_audit_records: {
        Row: {
          audit_date: string
          auditor_id: string
          checklist_id: string | null
          conforming_items: number
          conformity_rate: number | null
          created_at: string
          department_id: string
          id: string
          ipsg_goal_id: string
          notes: string | null
          responses: Json
          status: string
          total_items: number
          updated_at: string
          ward_id: string | null
        }
        Insert: {
          audit_date?: string
          auditor_id: string
          checklist_id?: string | null
          conforming_items?: number
          conformity_rate?: number | null
          created_at?: string
          department_id: string
          id?: string
          ipsg_goal_id: string
          notes?: string | null
          responses?: Json
          status?: string
          total_items?: number
          updated_at?: string
          ward_id?: string | null
        }
        Update: {
          audit_date?: string
          auditor_id?: string
          checklist_id?: string | null
          conforming_items?: number
          conformity_rate?: number | null
          created_at?: string
          department_id?: string
          id?: string
          ipsg_goal_id?: string
          notes?: string | null
          responses?: Json
          status?: string
          total_items?: number
          updated_at?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ipsg_audit_records_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "ipsg_audit_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipsg_audit_records_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipsg_audit_records_ipsg_goal_id_fkey"
            columns: ["ipsg_goal_id"]
            isOneToOne: false
            referencedRelation: "ipsg_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipsg_audit_records_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      ipsg_events: {
        Row: {
          created_at: string
          department_id: string
          details: Json | null
          event_type: string
          id: string
          ipsg_goal_id: string
          is_conforming: boolean
          patient_id: string | null
          recorded_by: string
          ward_id: string | null
        }
        Insert: {
          created_at?: string
          department_id: string
          details?: Json | null
          event_type: string
          id?: string
          ipsg_goal_id: string
          is_conforming?: boolean
          patient_id?: string | null
          recorded_by: string
          ward_id?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string
          details?: Json | null
          event_type?: string
          id?: string
          ipsg_goal_id?: string
          is_conforming?: boolean
          patient_id?: string | null
          recorded_by?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ipsg_events_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipsg_events_ipsg_goal_id_fkey"
            columns: ["ipsg_goal_id"]
            isOneToOne: false
            referencedRelation: "ipsg_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipsg_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipsg_events_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      ipsg_goals: {
        Row: {
          code: string
          created_at: string
          critical_threshold: number | null
          description: string | null
          edition: string
          id: string
          is_active: boolean
          is_customizable: boolean
          name: string
          sort_order: number
          target_value: number | null
          unit: string
          updated_at: string
          warning_threshold: number | null
        }
        Insert: {
          code: string
          created_at?: string
          critical_threshold?: number | null
          description?: string | null
          edition?: string
          id?: string
          is_active?: boolean
          is_customizable?: boolean
          name: string
          sort_order?: number
          target_value?: number | null
          unit?: string
          updated_at?: string
          warning_threshold?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          critical_threshold?: number | null
          description?: string | null
          edition?: string
          id?: string
          is_active?: boolean
          is_customizable?: boolean
          name?: string
          sort_order?: number
          target_value?: number | null
          unit?: string
          updated_at?: string
          warning_threshold?: number | null
        }
        Relationships: []
      }
      knowledge_documents: {
        Row: {
          category: string | null
          chunks: Json | null
          content: string
          created_at: string
          id: string
          is_active: boolean
          search_vector: unknown
          source: string
          specialty_id: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          chunks?: Json | null
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          search_vector?: unknown
          source?: string
          specialty_id?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          chunks?: Json | null
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          search_vector?: unknown
          source?: string
          specialty_id?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "medical_specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          record_id: string | null
          table_name: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lgpd_consent_records: {
        Row: {
          consent_type: string
          created_at: string
          granted: boolean
          id: string
          ip_address: string | null
          revoked_at: string | null
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          consent_type: string
          created_at?: string
          granted?: boolean
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
          version?: string
        }
        Update: {
          consent_type?: string
          created_at?: string
          granted?: boolean
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      lgpd_data_requests: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          request_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          request_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          request_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lgpd_data_retention_policies: {
        Row: {
          anonymize_on_expiry: boolean
          created_at: string
          description: string | null
          id: string
          retention_days: number
          table_name: string
          updated_at: string
        }
        Insert: {
          anonymize_on_expiry?: boolean
          created_at?: string
          description?: string | null
          id?: string
          retention_days?: number
          table_name: string
          updated_at?: string
        }
        Update: {
          anonymize_on_expiry?: boolean
          created_at?: string
          description?: string | null
          id?: string
          retention_days?: number
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      medical_specialties: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          output_prompt: string
          prompt_variables: Json | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          output_prompt?: string
          prompt_variables?: Json | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          output_prompt?: string
          prompt_variables?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_ward_history: {
        Row: {
          admitted_at: string
          created_at: string
          discharged_at: string | null
          discharged_by: string | null
          id: string
          patient_id: string
          reason: string | null
          ward_id: string
        }
        Insert: {
          admitted_at?: string
          created_at?: string
          discharged_at?: string | null
          discharged_by?: string | null
          id?: string
          patient_id: string
          reason?: string | null
          ward_id: string
        }
        Update: {
          admitted_at?: string
          created_at?: string
          discharged_at?: string | null
          discharged_by?: string | null
          id?: string
          patient_id?: string
          reason?: string | null
          ward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_ward_history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_ward_history_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          admission_status: string
          bed: string | null
          created_at: string
          created_by: string | null
          current_ward_id: string | null
          date_of_birth: string | null
          department_id: string
          encounter_number: string | null
          full_name: string
          id: string
          initials: string | null
          medical_record: string | null
          notes: string | null
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          admission_status?: string
          bed?: string | null
          created_at?: string
          created_by?: string | null
          current_ward_id?: string | null
          date_of_birth?: string | null
          department_id: string
          encounter_number?: string | null
          full_name: string
          id?: string
          initials?: string | null
          medical_record?: string | null
          notes?: string | null
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          admission_status?: string
          bed?: string | null
          created_at?: string
          created_by?: string | null
          current_ward_id?: string | null
          date_of_birth?: string | null
          department_id?: string
          encounter_number?: string | null
          full_name?: string
          id?: string
          initials?: string | null
          medical_record?: string | null
          notes?: string | null
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_current_ward_id_fkey"
            columns: ["current_ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department_id: string | null
          digital_signature_enabled: boolean
          full_name: string | null
          id: string
          lgpd_consent_date: string | null
          lgpd_consent_given: boolean
          professional_registry: string | null
          professional_registry_type: string | null
          professional_role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          digital_signature_enabled?: boolean
          full_name?: string | null
          id?: string
          lgpd_consent_date?: string | null
          lgpd_consent_given?: boolean
          professional_registry?: string | null
          professional_registry_type?: string | null
          professional_role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          digital_signature_enabled?: boolean
          full_name?: string | null
          id?: string
          lgpd_consent_date?: string | null
          lgpd_consent_given?: boolean
          professional_registry?: string | null
          professional_registry_type?: string | null
          professional_role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_wizard_sessions: {
        Row: {
          context_description: string | null
          context_name: string | null
          context_type: string
          created_at: string
          generated_prompt: string | null
          id: string
          messages: Json
          question_number: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context_description?: string | null
          context_name?: string | null
          context_type?: string
          created_at?: string
          generated_prompt?: string | null
          id?: string
          messages?: Json
          question_number?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context_description?: string | null
          context_name?: string | null
          context_type?: string
          created_at?: string
          generated_prompt?: string | null
          id?: string
          messages?: Json
          question_number?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      report_templates: {
        Row: {
          applicable_roles: string[] | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean
          min_recordings: number
          name: string
          organization_id: string | null
          prompt_template: string
          requires_serial: boolean
          updated_at: string
        }
        Insert: {
          applicable_roles?: string[] | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          min_recordings?: number
          name: string
          organization_id?: string | null
          prompt_template: string
          requires_serial?: boolean
          updated_at?: string
        }
        Update: {
          applicable_roles?: string[] | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          min_recordings?: number
          name?: string
          organization_id?: string | null
          prompt_template?: string
          requires_serial?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      surgical_checklists: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          consultation_id: string | null
          created_at: string
          department_id: string
          first_timeout: Json | null
          id: string
          patient_id: string
          pre_op_verification: Json | null
          second_timeout: Json | null
          sign_out: Json | null
          site_marking: Json | null
          status: string
          updated_at: string
          ward_id: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          consultation_id?: string | null
          created_at?: string
          department_id: string
          first_timeout?: Json | null
          id?: string
          patient_id: string
          pre_op_verification?: Json | null
          second_timeout?: Json | null
          sign_out?: Json | null
          site_marking?: Json | null
          status?: string
          updated_at?: string
          ward_id?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          consultation_id?: string | null
          created_at?: string
          department_id?: string
          first_timeout?: Json | null
          id?: string
          patient_id?: string
          pre_op_verification?: Json | null
          second_timeout?: Json | null
          sign_out?: Json | null
          site_marking?: Json | null
          status?: string
          updated_at?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surgical_checklists_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surgical_checklists_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surgical_checklists_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surgical_checklists_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wards: {
        Row: {
          bed_count: number | null
          created_at: string
          department_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          ward_type: string
        }
        Insert: {
          bed_count?: number | null
          created_at?: string
          department_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          ward_type?: string
        }
        Update: {
          bed_count?: number | null
          created_at?: string
          department_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          ward_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wards_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_department: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_auditor_or_admin: { Args: { _user_id: string }; Returns: boolean }
      match_knowledge_chunks: {
        Args: {
          filter_specialty_id?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          document_source: string
          document_title: string
          id: string
          similarity: number
        }[]
      }
      update_cron_schedule: {
        Args: { new_schedule: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "medico"
        | "enfermeiro"
        | "tecnico"
        | "farmaceutico"
        | "auditor"
        | "fisioterapeuta"
        | "nutricionista"
        | "fonoaudiologo"
        | "psicologo"
        | "assistente_social"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "medico",
        "enfermeiro",
        "tecnico",
        "farmaceutico",
        "auditor",
        "fisioterapeuta",
        "nutricionista",
        "fonoaudiologo",
        "psicologo",
        "assistente_social",
      ],
    },
  },
} as const

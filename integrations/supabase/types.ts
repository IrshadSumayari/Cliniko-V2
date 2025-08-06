export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          arrived: boolean | null
          cancellation_date: string | null
          cancelled: boolean | null
          clinic_id: string | null
          created_at: string | null
          dna: boolean | null
          duration_minutes: number | null
          email_reminder_sent: boolean | null
          end_time: string
          external_id: string
          id: string
          invoice_generated: boolean | null
          location_id: string | null
          notes: string | null
          patient_id: string | null
          practitioner_id: string | null
          service_id: string | null
          source_created_at: string | null
          source_updated_at: string | null
          start_time: string
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_date: string
          arrived?: boolean | null
          cancellation_date?: string | null
          cancelled?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          dna?: boolean | null
          duration_minutes?: number | null
          email_reminder_sent?: boolean | null
          end_time: string
          external_id: string
          id?: string
          invoice_generated?: boolean | null
          location_id?: string | null
          notes?: string | null
          patient_id?: string | null
          practitioner_id?: string | null
          service_id?: string | null
          source_created_at?: string | null
          source_updated_at?: string | null
          start_time: string
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string
          arrived?: boolean | null
          cancellation_date?: string | null
          cancelled?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          dna?: boolean | null
          duration_minutes?: number | null
          email_reminder_sent?: boolean | null
          end_time?: string
          external_id?: string
          id?: string
          invoice_generated?: boolean | null
          location_id?: string | null
          notes?: string | null
          patient_id?: string | null
          practitioner_id?: string | null
          service_id?: string | null
          source_created_at?: string | null
          source_updated_at?: string | null
          start_time?: string
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          id: string
          email: string
          firstName: string
          lastName: string
          clinicName: string
          pmsType?: string
          isOnboarded: boolean
          needsOnboarding?: boolean
        }
        Insert: {
          email: string
          firstName: string
          lastName: string
          clinicName: string
          pmsType?: string
          isOnboarded: boolean
          needsOnboarding?: boolean
        }
        Update: {
          email?: string
          firstName?: string
          lastName?: string
          clinicName?: string
          pmsType?: string
          isOnboarded?: boolean
          needsOnboarding?: boolean
        }
        Relationships: []
      }
      clinics: {
        Row: {
          api_key_encrypted: string | null
          created_at: string | null
          id: string
          name: string
          system_type: string
          system_url: string | null
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          created_at?: string | null
          id?: string
          name: string
          system_type: string
          system_url?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          created_at?: string | null
          id?: string
          name?: string
          system_type?: string
          system_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      patients: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          address_line_3: string | null
          alert_notes: string | null
          city: string | null
          client_notes: string | null
          clinic_id: string | null
          country: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          external_id: string
          first_name: string
          gender: string | null
          home_phone: string | null
          id: string
          is_deceased: boolean | null
          last_name: string
          middle_name: string | null
          mobile: string | null
          nickname: string | null
          online_code: string | null
          opt_in_email: boolean | null
          opt_in_marketing_email: boolean | null
          opt_in_marketing_sms: boolean | null
          opt_in_sms: boolean | null
          postcode: string | null
          source_created_at: string | null
          source_updated_at: string | null
          state: string | null
          updated_at: string | null
          work_phone: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          address_line_3?: string | null
          alert_notes?: string | null
          city?: string | null
          client_notes?: string | null
          clinic_id?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          external_id: string
          first_name: string
          gender?: string | null
          home_phone?: string | null
          id?: string
          is_deceased?: boolean | null
          last_name: string
          middle_name?: string | null
          mobile?: string | null
          nickname?: string | null
          online_code?: string | null
          opt_in_email?: boolean | null
          opt_in_marketing_email?: boolean | null
          opt_in_marketing_sms?: boolean | null
          opt_in_sms?: boolean | null
          postcode?: string | null
          source_created_at?: string | null
          source_updated_at?: string | null
          state?: string | null
          updated_at?: string | null
          work_phone?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          address_line_3?: string | null
          alert_notes?: string | null
          city?: string | null
          client_notes?: string | null
          clinic_id?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          external_id?: string
          first_name?: string
          gender?: string | null
          home_phone?: string | null
          id?: string
          is_deceased?: boolean | null
          last_name?: string
          middle_name?: string | null
          mobile?: string | null
          nickname?: string | null
          online_code?: string | null
          opt_in_email?: boolean | null
          opt_in_marketing_email?: boolean | null
          opt_in_marketing_sms?: boolean | null
          opt_in_sms?: boolean | null
          postcode?: string | null
          source_created_at?: string | null
          source_updated_at?: string | null
          state?: string | null
          updated_at?: string | null
          work_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bulk_insert_records: {
        Args: {
          p_table_name: string
          p_records: Json
          p_conflict_field?: string
        }
        Returns: Json
      }
      // ... (include all other functions)
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Export utility types
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof DatabaseWithoutInternals, "public">]

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

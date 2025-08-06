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
      users: {
        Row: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          clinicName: string;
          pmsType?: string;
          isOnboarded: boolean;
          needsOnboarding?: boolean;
          auth_user_id?: string | null;
          clinic_id?: string | null;
          first_name?: string;
          last_name?: string;
          role?: string;
          is_onboarded?: boolean;
          external_physio_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Insert: {
          email: string;
          firstName: string;
          lastName: string;
          clinicName: string;
          pmsType?: string;
          isOnboarded: boolean;
          needsOnboarding?: boolean;
          auth_user_id?: string | null;
          clinic_id?: string | null;
          first_name?: string;
          last_name?: string;
          role?: string;
          is_onboarded?: boolean;
          external_physio_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          email?: string;
          firstName?: string;
          lastName?: string;
          clinicName?: string;
          pmsType?: string;
          isOnboarded?: boolean;
          needsOnboarding?: boolean;
          auth_user_id?: string | null;
          clinic_id?: string | null;
          first_name?: string;
          last_name?: string;
          role?: string;
          is_onboarded?: boolean;
          external_physio_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "users_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          }
        ];
      };
      clinics: {
        Row: {
          id: string;
          clinic_id: string;
          name: string;
          system_type: string | null;
          system_url: string | null;
          api_key_encrypted: string | null;
          subscription_status: string;
          trial_started_at: string | null;
          trial_expires_at: string | null;
          stripe_customer_id: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          name: string;
          system_type?: string | null;
          system_url?: string | null;
          api_key_encrypted?: string | null;
          subscription_status?: string;
          trial_started_at?: string | null;
          trial_expires_at?: string | null;
          stripe_customer_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          clinic_id?: string;
          name?: string;
          system_type?: string | null;
          system_url?: string | null;
          api_key_encrypted?: string | null;
          subscription_status?: string;
          trial_started_at?: string | null;
          trial_expires_at?: string | null;
          stripe_customer_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          clinic_id: string | null;
          stripe_subscription_id: string;
          stripe_customer_id: string;
          plan_id: string;
          status: string;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          clinic_id?: string | null;
          stripe_subscription_id: string;
          stripe_customer_id: string;
          plan_id: string;
          status: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          clinic_id?: string | null;
          stripe_subscription_id?: string;
          stripe_customer_id?: string;
          plan_id?: string;
          status?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          }
        ];
      };
      admin_users: {
        Row: {
          id: string;
          auth_user_id: string | null;
          email: string;
          role: string;
          permissions: Json;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          email: string;
          role?: string;
          permissions?: Json;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          email?: string;
          role?: string;
          permissions?: Json;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      developer_access: {
        Row: {
          id: string;
          developer_email: string;
          access_granted: boolean;
          granted_by: string | null;
          access_level: string;
          expires_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          developer_email: string;
          access_granted?: boolean;
          granted_by?: string | null;
          access_level?: string;
          expires_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          developer_email?: string;
          access_granted?: boolean;
          granted_by?: string | null;
          access_level?: string;
          expires_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "developer_access_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "admin_users";
            referencedColumns: ["id"];
          }
        ];
      };
      physio_matching: {
        Row: {
          id: string;
          clinic_id: string | null;
          external_physio_id: string;
          physio_name: string;
          user_id: string | null;
          matched: boolean;
          api_data: Json | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          clinic_id?: string | null;
          external_physio_id: string;
          physio_name: string;
          user_id?: string | null;
          matched?: boolean;
          api_data?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          clinic_id?: string | null;
          external_physio_id?: string;
          physio_name?: string;
          user_id?: string | null;
          matched?: boolean;
          api_data?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "physio_matching_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "physio_matching_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      appointments: {
        Row: {
          appointment_date: string;
          arrived: boolean | null;
          cancellation_date: string | null;
          cancelled: boolean | null;
          clinic_id: string | null;
          created_at: string | null;
          dna: boolean | null;
          duration_minutes: number | null;
          email_reminder_sent: boolean | null;
          end_time: string;
          external_id: string;
          id: string;
          invoice_generated: boolean | null;
          location_id: string | null;
          notes: string | null;
          patient_id: string | null;
          practitioner_id: string | null;
          service_id: string | null;
          source_created_at: string | null;
          source_updated_at: string | null;
          start_time: string;
          status: string | null;
          type: string | null;
          updated_at: string | null;
        };
        Insert: {
          appointment_date: string;
          arrived?: boolean | null;
          cancellation_date?: string | null;
          cancelled?: boolean | null;
          clinic_id?: string | null;
          created_at?: string | null;
          dna?: boolean | null;
          duration_minutes?: number | null;
          email_reminder_sent?: boolean | null;
          end_time: string;
          external_id: string;
          id?: string;
          invoice_generated?: boolean | null;
          location_id?: string | null;
          notes?: string | null;
          patient_id?: string | null;
          practitioner_id?: string | null;
          service_id?: string | null;
          source_created_at?: string | null;
          source_updated_at?: string | null;
          start_time: string;
          status?: string | null;
          type?: string | null;
          updated_at?: string | null;
        };
        Update: {
          appointment_date?: string;
          arrived?: boolean | null;
          cancellation_date?: string | null;
          cancelled?: boolean | null;
          clinic_id?: string | null;
          created_at?: string | null;
          dna?: boolean | null;
          duration_minutes?: number | null;
          email_reminder_sent?: boolean | null;
          end_time?: string;
          external_id?: string;
          id?: string;
          invoice_generated?: boolean | null;
          location_id?: string | null;
          notes?: string | null;
          patient_id?: string | null;
          practitioner_id?: string | null;
          service_id?: string | null;
          source_created_at?: string | null;
          source_updated_at?: string | null;
          start_time?: string;
          status?: string | null;
          type?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          }
        ];
      };
      patients: {
        Row: {
          address_line_1: string | null;
          address_line_2: string | null;
          address_line_3: string | null;
          alert_notes: string | null;
          city: string | null;
          client_notes: string | null;
          clinic_id: string | null;
          country: string | null;
          created_at: string | null;
          date_of_birth: string | null;
          email: string | null;
          external_id: string;
          first_name: string;
          gender: string | null;
          home_phone: string | null;
          id: string;
          is_deceased: boolean | null;
          last_name: string;
          middle_name: string | null;
          mobile: string | null;
          nickname: string | null;
          online_code: string | null;
          opt_in_email: boolean | null;
          opt_in_marketing_email: boolean | null;
          opt_in_marketing_sms: boolean | null;
          opt_in_sms: boolean | null;
          postcode: string | null;
          source_created_at: string | null;
          source_updated_at: string | null;
          state: string | null;
          updated_at: string | null;
          work_phone: string | null;
        };
        Insert: {
          address_line_1?: string | null;
          address_line_2?: string | null;
          address_line_3?: string | null;
          alert_notes?: string | null;
          city?: string | null;
          client_notes?: string | null;
          clinic_id?: string | null;
          country?: string | null;
          created_at?: string | null;
          date_of_birth?: string | null;
          email?: string | null;
          external_id: string;
          first_name: string;
          gender?: string | null;
          home_phone?: string | null;
          id?: string;
          is_deceased?: boolean | null;
          last_name: string;
          middle_name?: string | null;
          mobile?: string | null;
          nickname?: string | null;
          online_code?: string | null;
          opt_in_email?: boolean | null;
          opt_in_marketing_email?: boolean | null;
          opt_in_marketing_sms?: boolean | null;
          opt_in_sms?: boolean | null;
          postcode?: string | null;
          source_created_at?: string | null;
          source_updated_at?: string | null;
          state?: string | null;
          updated_at?: string | null;
          work_phone?: string | null;
        };
        Update: {
          address_line_1?: string | null;
          address_line_2?: string | null;
          address_line_3?: string | null;
          alert_notes?: string | null;
          city?: string | null;
          client_notes?: string | null;
          clinic_id?: string | null;
          country?: string | null;
          created_at?: string | null;
          date_of_birth?: string | null;
          email?: string | null;
          external_id?: string;
          first_name?: string;
          gender?: string | null;
          home_phone?: string | null;
          id?: string;
          is_deceased?: boolean | null;
          last_name?: string;
          middle_name?: string | null;
          mobile?: string | null;
          nickname?: string | null;
          online_code?: string | null;
          opt_in_email?: boolean | null;
          opt_in_marketing_email?: boolean | null;
          opt_in_marketing_sms?: boolean | null;
          opt_in_sms?: boolean | null;
          postcode?: string | null;
          source_created_at?: string | null;
          source_updated_at?: string | null;
          state?: string | null;
          updated_at?: string | null;
          work_phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          }
        ];
      };
      locations: {
        Row: {
          id: string;
          clinic_id: string | null;
          external_id: string;
          name: string;
          address: string | null;
          phone: string | null;
          email: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          clinic_id?: string | null;
          external_id: string;
          name: string;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          clinic_id?: string | null;
          external_id?: string;
          name?: string;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "locations_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          }
        ];
      };
      practitioners: {
        Row: {
          id: string;
          clinic_id: string | null;
          external_id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          specialization: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          clinic_id?: string | null;
          external_id: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
          specialization?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          clinic_id?: string | null;
          external_id?: string;
          first_name?: string;
          last_name?: string;
          email?: string | null;
          phone?: string | null;
          specialization?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "practitioners_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          }
        ];
      };
      services: {
        Row: {
          id: string;
          clinic_id: string | null;
          external_id: string;
          name: string;
          description: string | null;
          duration_minutes: number | null;
          price: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          clinic_id?: string | null;
          external_id: string;
          name: string;
          description?: string | null;
          duration_minutes?: number | null;
          price?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          clinic_id?: string | null;
          external_id?: string;
          name?: string;
          description?: string | null;
          duration_minutes?: number | null;
          price?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "services_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      bulk_insert_records: {
        Args: {
          p_table_name: string;
          p_records: Json;
          p_conflict_field?: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Export utility types
type DatabaseWithoutInternals = Database;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof DatabaseWithoutInternals,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
      DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

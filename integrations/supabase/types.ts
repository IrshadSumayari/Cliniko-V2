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
          auth_user_id: string;
          email: string;
          full_name: string | null;
          is_onboarded: boolean;
          subscription_status: string;
          trial_ends_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          email: string;
          full_name?: string | null;
          is_onboarded?: boolean;
          subscription_status?: string;
          trial_ends_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          auth_user_id?: string;
          email?: string;
          full_name?: string | null;
          is_onboarded?: boolean;
          subscription_status?: string;
          trial_ends_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      pms_api_keys: {
        Row: {
          id: string;
          user_id: string;
          pms_type: string;
          api_key_encrypted: string;
          api_url: string;
          clinic_id: string | null;
          is_active: boolean;
          last_sync_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          pms_type: string;
          api_key_encrypted: string;
          api_url: string;
          clinic_id?: string | null;
          is_active?: boolean;
          last_sync_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          pms_type?: string;
          api_key_encrypted?: string;
          api_url?: string;
          clinic_id?: string | null;
          is_active?: boolean;
          last_sync_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pms_api_keys_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      patients: {
        Row: {
          id: string;
          user_id: string;
          pms_patient_id: string;
          pms_type: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          date_of_birth: string | null;
          patient_type: string | null;
          is_active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          pms_patient_id: string;
          pms_type: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          patient_type?: string | null;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          pms_patient_id?: string;
          pms_type?: string;
          first_name?: string;
          last_name?: string;
          email?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          patient_type?: string | null;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "patients_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          id: string;
          user_id: string;
          patient_id: string | null;
          pms_appointment_id: string;
          pms_type: string;
          appointment_type: string | null;
          status: string;
          appointment_date: string;
          practitioner_name: string | null;
          notes: string | null;
          is_completed: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          patient_id?: string | null;
          pms_appointment_id: string;
          pms_type: string;
          appointment_type?: string | null;
          status: string;
          appointment_date: string;
          practitioner_name?: string | null;
          notes?: string | null;
          is_completed?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          patient_id?: string | null;
          pms_appointment_id?: string;
          pms_type?: string;
          appointment_type?: string | null;
          status?: string;
          appointment_date?: string;
          practitioner_name?: string | null;
          notes?: string | null;
          is_completed?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      appointment_types: {
        Row: {
          id: string;
          user_id: string;
          appointment_id: string;
          appointment_name: string;
          pms_type: string;
          code: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          appointment_id: string;
          appointment_name: string;
          pms_type: string;
          code: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          appointment_id?: string;
          appointment_name?: string;
          pms_type?: string;
          code?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_types_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_logs: {
        Row: {
          id: string;
          user_id: string;
          pms_type: string;
          sync_type: string;
          status: string;
          patients_synced: number;
          appointments_synced: number;
          errors_count: number;
          error_details: Json | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          pms_type: string;
          sync_type: string;
          status: string;
          patients_synced?: number;
          appointments_synced?: number;
          errors_count?: number;
          error_details?: Json | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          pms_type?: string;
          sync_type?: string;
          status?: string;
          patients_synced?: number;
          appointments_synced?: number;
          errors_count?: number;
          error_details?: Json | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sync_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_errors: {
        Row: {
          id: string;
          user_id: string;
          sync_log_id: string | null;
          pms_type: string;
          error_type: string;
          error_message: string;
          error_details: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          sync_log_id?: string | null;
          pms_type: string;
          error_type: string;
          error_message: string;
          error_details?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          sync_log_id?: string | null;
          pms_type?: string;
          error_type?: string;
          error_message?: string;
          error_details?: Json | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sync_errors_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sync_errors_sync_log_id_fkey";
            columns: ["sync_log_id"];
            isOneToOne: false;
            referencedRelation: "sync_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_controls: {
        Row: {
          id: string;
          user_id: string;
          pms_type: string;
          is_enabled: boolean;
          sync_frequency_hours: number;
          last_sync_at: string | null;
          next_sync_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          pms_type: string;
          is_enabled?: boolean;
          sync_frequency_hours?: number;
          last_sync_at?: string | null;
          next_sync_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          pms_type?: string;
          is_enabled?: boolean;
          sync_frequency_hours?: number;
          last_sync_at?: string | null;
          next_sync_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sync_controls_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

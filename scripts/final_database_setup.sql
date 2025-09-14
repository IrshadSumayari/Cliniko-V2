-- Final Database Setup Script for PMS Integration with Enhanced Duplicate Prevention
-- Run this script in your Supabase SQL editor
--
-- DUPLICATE PREVENTION FEATURES:
-- 1. Unique Constraints: Prevents duplicate records at database level
--    - patients: UNIQUE(user_id, pms_patient_id, pms_type)
--    - appointments: UNIQUE(user_id, pms_appointment_id, pms_type)
--    - appointment_types: UNIQUE(user_id, appointment_id, pms_type)
--
-- 2. Database Triggers: Automatically handle duplicates during sync operations
--    - handle_sync_duplicates(): Updates existing records instead of failing on duplicates
--    - Prevents sync failures when running the same sync multiple times
--
-- 3. Performance Indexes: Optimized for sync operations and duplicate detection
--    - Composite indexes on common sync lookup patterns
--    - Partial indexes for nullable fields
--
-- 4. Helper Functions: Provide insights into existing data
--    - check_existing_sync_data(): Shows what data already exists before sync
--    - get_sync_statistics(): Provides comprehensive sync statistics
--
-- 5. Nookal Appointment Type Mapping:
--    - For Nookal PMS, appointment_type field stores "WC" or "EPC" codes
--    - These codes are extracted from appointment names using determineAppointmentTypeFromName()
--    - Example: "Aquatic Physiotherapy WC" -> appointment_type = "WC"
--    - Example: "Physiotherapy 2A WC/CTP Initial Consultation" -> appointment_type = "WC"
--
-- 6. Batch Sync Progress Tracking:
--    - sync_progress JSONB field stores batch sync progress for Nookal and other PMS systems
--    - Tracks lastSyncedPatientId, totalPatients, patientsProcessed, hasMorePatients, etc.
--    - Enables automatic resume of batch sync operations across cron job runs
--    - Example: {"lastSyncedPatientId": 200, "totalPatients": 15290, "patientsProcessed": 200, "hasMorePatients": true}
--
-- This setup ensures that Cliniko sync operations can be run multiple times without
-- creating duplicate data, while maintaining optimal performance and data integrity.

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS sync_errors CASCADE;
DROP TABLE IF EXISTS sync_logs CASCADE;
DROP TABLE IF EXISTS sync_controls CASCADE;
DROP TABLE IF EXISTS cases CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS practitioners CASCADE;
DROP TABLE IF EXISTS pms_api_keys CASCADE;
DROP TABLE IF EXISTS pms_credentials CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
-- Don't drop users table as it might contain important data

-- Create users table (if not exists)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE NOT NULL,
    email TEXT NOT NULL,
    full_name TEXT,
    is_onboarded BOOLEAN DEFAULT FALSE,
    subscription_status TEXT DEFAULT 'inactive',
    stripe_customer_id TEXT, -- Stripe customer ID for subscription management
    pms_type TEXT,
    WC TEXT DEFAULT 'WC',
    EPC TEXT DEFAULT 'EPC',
    custom_email TEXT, 
    enable_email_alerts BOOLEAN DEFAULT TRUE, 
    session_quota_threshold INTEGER DEFAULT 2, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create profiles table for user profile information
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    clinic_name TEXT,
    pms_type TEXT,
    pms_connected BOOLEAN DEFAULT FALSE,
    pms_last_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create practitioners table for storing PMS practitioner data
CREATE TABLE practitioners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pms_practitioner_id TEXT NOT NULL, -- External practitioner ID from PMS
    pms_type TEXT NOT NULL CHECK (pms_type IN ('cliniko', 'nookal', 'halaxy')),
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    display_name TEXT, -- Full name for display purposes
    email TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Prevent duplicate practitioners per user and PMS
    UNIQUE(user_id, pms_practitioner_id, pms_type)
);

-- Create indexes for practitioners
CREATE INDEX IF NOT EXISTS idx_practitioners_user_id ON practitioners(user_id);
CREATE INDEX IF NOT EXISTS idx_practitioners_pms ON practitioners(pms_practitioner_id, pms_type);
CREATE INDEX IF NOT EXISTS idx_practitioners_active ON practitioners(user_id, is_active);

-- Create PMS credentials table for storing API keys securely
CREATE TABLE pms_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pms_type TEXT NOT NULL,
    api_key TEXT NOT NULL,
    api_url TEXT NOT NULL,
    clinic_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, pms_type)
);

-- Create pms_api_keys table
CREATE TABLE pms_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pms_type TEXT NOT NULL CHECK (pms_type IN ('cliniko', 'halaxy', 'nookal')),
    api_key_encrypted TEXT NOT NULL,
    api_url TEXT NOT NULL,
    clinic_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, pms_type)
);

-- Create patients table with enhanced duplicate prevention
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pms_patient_id TEXT NOT NULL,
    pms_type TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    date_of_birth DATE,
    patient_type TEXT CHECK (patient_type IN ('EPC', 'WC', 'Private')),
    physio_name TEXT,
    pms_last_modified TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    -- NEW: Patient status management columns
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'archived')),
    quota INTEGER DEFAULT 5, -- Default EPC quota, can be customized per patient
    sessions_used INTEGER DEFAULT 0, -- Track actual sessions used
    alert_preference INTEGER DEFAULT 2, -- 1 or 2 sessions before alert (clinic preference)
    last_status_change TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status_change_reason TEXT, -- Reason for status change (e.g., "GP renewal requested", "Discharged")
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Enhanced unique constraint to prevent duplicates
    UNIQUE(user_id, pms_patient_id, pms_type)
);

-- Cases table will be created after appointment_types table to avoid foreign key dependency issues

-- Create indexes for patient status management queries
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);
CREATE INDEX IF NOT EXISTS idx_patients_quota_sessions ON patients(quota, sessions_used);
CREATE INDEX IF NOT EXISTS idx_patients_user_status ON patients(user_id, status);
CREATE INDEX IF NOT EXISTS idx_patients_user_type ON patients(user_id, patient_type);

-- Add comments explaining the new columns
COMMENT ON COLUMN patients.status IS 'Patient workflow status: active, pending (waiting approval), archived (discharged)';
COMMENT ON COLUMN patients.quota IS 'Maximum sessions allowed for this patient (EPC=5, WC=8 or 1 if >3 months post-injury)';
COMMENT ON COLUMN patients.sessions_used IS 'Number of sessions already consumed by this patient';
COMMENT ON COLUMN patients.alert_preference IS 'Clinic preference: 1 or 2 sessions before alert (default: 2)';
COMMENT ON COLUMN patients.status_change_reason IS 'Reason for last status change (e.g., "GP renewal requested", "Discharged")';

-- Function to populate cases table will be added after all tables are created

-- Create appointments table with enhanced duplicate prevention
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    pms_appointment_id TEXT NOT NULL,
    pms_type TEXT NOT NULL,
    appointment_type TEXT, -- For Nookal: stores "WC" or "EPC" extracted from appointment name
    appointment_type_id TEXT, -- NEW: Stores the appointmentTypeID from PMS
    status TEXT NOT NULL,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    practitioner_id TEXT, -- NEW: Store PMS practitioner ID for proper linking
    practitioner_name TEXT,
    location_name TEXT, -- Clinic location where appointment takes place
    notes TEXT,
    duration_minutes INTEGER,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Enhanced unique constraint to prevent duplicates
    UNIQUE(user_id, pms_appointment_id, pms_type)
);

-- Create appointment_types table with enhanced duplicate prevention
CREATE TABLE appointment_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id TEXT NOT NULL,
    appointment_name TEXT NOT NULL,
    pms_type TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Enhanced unique constraint to prevent duplicates
    UNIQUE(user_id, appointment_id, pms_type)
);

-- Create cases table for dashboard listing (replaces patient dashboard functionality)
-- IMPORTANT: This table will ONLY store cases that match the user's custom WC/EPC tags
-- It will NOT store all patients - only the filtered ones matching user preferences
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    pms_type TEXT NOT NULL,
    
    -- Case identification
    case_number TEXT, -- Auto-generated or manual case number
    case_title TEXT, -- Descriptive title for the case
    
    -- Patient information (denormalized for performance)
    patient_first_name TEXT NOT NULL,
    patient_last_name TEXT NOT NULL,
    patient_email TEXT,
    patient_phone TEXT,
    patient_date_of_birth DATE,
    
    -- Location information
    location_id UUID, -- Reference to locations table if you have one
    location_name TEXT NOT NULL, -- e.g., "Main Clinic", "North Branch", "South Clinic"
    
    -- Practitioner/Physio information
    practitioner_id UUID REFERENCES practitioners(id), -- Reference to practitioners table
    physio_name TEXT, -- Kept for backward compatibility, will be populated from practitioner display_name
    
    -- Program/Appointment type
    appointment_type_id TEXT, -- Store the PMS appointment type ID as text (not UUID reference)
    appointment_type_name TEXT, -- e.g., "EPC", "Workers' Compensation" (nullable)
    program_type TEXT CHECK (program_type IN ('EPC', 'WC', 'Private')) NOT NULL,
    
    -- Session management
    quota INTEGER DEFAULT 5, -- Maximum sessions allowed (EPC=5, WC=8, customizable)
    sessions_used INTEGER DEFAULT 0, -- Number of sessions already consumed
    sessions_remaining INTEGER GENERATED ALWAYS AS (quota - sessions_used) STORED,
    
    -- Status and workflow
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'archived')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Dates
    next_visit_date DATE,
    last_visit_date DATE,
    case_start_date DATE DEFAULT CURRENT_DATE,
    case_end_date DATE,
    
    -- Alerts and notifications
    alert_preference INTEGER DEFAULT 2, -- 1 or 2 sessions before alert
    is_alert_active BOOLEAN DEFAULT FALSE,
    alert_message TEXT,
    
    -- Additional case details
    notes TEXT,
    tags TEXT[], -- Array of tags for flexible categorization
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_status_change TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status_change_reason TEXT,
    
    -- Unique constraints
    UNIQUE(user_id, patient_id, program_type, location_id),
    UNIQUE(user_id, case_number)
);

-- Create sync_logs table
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pms_type TEXT NOT NULL,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('initial', 'incremental', 'manual', 'batch', 'cases_population', 'cases_population_from_sync')),
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    patients_processed INTEGER DEFAULT 0,
    patients_added INTEGER DEFAULT 0,
    patients_synced INTEGER DEFAULT 0,
    appointments_synced INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    error_details JSONB,
    sync_progress JSONB, -- NEW: Stores batch sync progress details
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    last_modified_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment for sync_progress column
COMMENT ON COLUMN sync_logs.sync_progress IS 'Stores batch sync progress details like lastSyncedPatientId, totalPatients, patientsProcessed, hasMorePatients, etc.';

-- Create sync_errors table
CREATE TABLE sync_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sync_log_id UUID REFERENCES sync_logs(id) ON DELETE CASCADE,
    pms_type TEXT NOT NULL,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    error_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sync_controls table
CREATE TABLE sync_controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pms_type TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    sync_frequency_hours INTEGER DEFAULT 6,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    next_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, pms_type)
);

-- Create enhanced indexes for better performance and duplicate prevention
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX idx_profiles_user_id ON profiles(id);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_pms_credentials_user_id ON pms_credentials(user_id);
CREATE INDEX idx_pms_credentials_pms_type ON pms_credentials(pms_type);
CREATE INDEX idx_pms_api_keys_user_id ON pms_api_keys(user_id);
CREATE INDEX idx_patients_user_id ON patients(user_id);
CREATE INDEX idx_patients_type ON patients(patient_type);
CREATE INDEX idx_patients_pms_id ON patients(pms_patient_id, pms_type);
CREATE INDEX idx_patients_email ON patients(email);
CREATE INDEX idx_appointments_user_id ON appointments(user_id);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_pms_id ON appointments(pms_appointment_id, pms_type);
CREATE INDEX idx_appointments_patient_date ON appointments(patient_id, appointment_date);
CREATE INDEX idx_appointments_location ON appointments(location_name);
CREATE INDEX idx_appointment_types_user_id ON appointment_types(user_id);
CREATE INDEX idx_appointment_types_pms_id ON appointment_types(appointment_id, pms_type);
CREATE INDEX idx_appointment_types_name ON appointment_types(appointment_name, pms_type);

-- Create indexes for cases table
CREATE INDEX IF NOT EXISTS idx_cases_user_status ON cases(user_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_user_program ON cases(user_id, program_type);
CREATE INDEX IF NOT EXISTS idx_cases_user_location ON cases(user_id, location_id);
CREATE INDEX IF NOT EXISTS idx_cases_user_practitioner ON cases(user_id, practitioner_id);
CREATE INDEX IF NOT EXISTS idx_cases_quota_sessions ON cases(quota, sessions_used);
CREATE INDEX IF NOT EXISTS idx_cases_next_visit ON cases(next_visit_date);
CREATE INDEX IF NOT EXISTS idx_cases_alert_active ON cases(is_alert_active);

CREATE INDEX idx_sync_logs_user_id ON sync_logs(user_id);
CREATE INDEX idx_sync_errors_user_id ON sync_errors(user_id);
CREATE INDEX idx_sync_logs_sync_progress ON sync_logs USING GIN (sync_progress);

-- Create composite indexes for better query performance on common sync operations
CREATE INDEX idx_patients_sync_lookup ON patients(user_id, pms_type, pms_patient_id);
CREATE INDEX idx_appointments_sync_lookup ON appointments(user_id, pms_type, pms_appointment_id);
CREATE INDEX idx_appointment_types_sync_lookup ON appointment_types(user_id, pms_type, appointment_id);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_controls ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can view own record" ON users
    FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "Users can update own record" ON users
    FOR UPDATE USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert own record" ON users
    FOR INSERT WITH CHECK (auth_user_id = auth.uid());

-- Create RLS policies for profiles table
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for pms_credentials table
CREATE POLICY "Users can view own PMS credentials" ON pms_credentials
    FOR SELECT USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert own PMS credentials" ON pms_credentials
    FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update own PMS credentials" ON pms_credentials
    FOR UPDATE USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete own PMS credentials" ON pms_credentials
    FOR DELETE USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Create RLS policies for pms_api_keys table
CREATE POLICY "Users can manage own API keys" ON pms_api_keys
    FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Create RLS policies for pms_credentials table
CREATE POLICY "Users can manage own PMS credentials" ON pms_credentials
    FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Create RLS policies for patients table
CREATE POLICY "Users can manage own patients" ON patients
    FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Create RLS policies for appointments table
CREATE POLICY "Users can manage own appointments" ON appointments
    FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Create RLS policies for appointment_types table
CREATE POLICY "Users can manage own appointment types" ON appointment_types
    FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Create RLS policies for cases table
CREATE POLICY "Users can manage own cases" ON cases
    FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Create RLS policies for sync_logs table
CREATE POLICY "Users can view own sync logs" ON sync_logs
    FOR SELECT USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Create RLS policies for sync_errors table
CREATE POLICY "Users can view own sync errors" ON sync_errors
    FOR SELECT USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Create RLS policies for sync_controls table
CREATE POLICY "Users can manage own sync controls" ON sync_controls
    FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pms_credentials_updated_at
    BEFORE UPDATE ON pms_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pms_api_keys_updated_at
    BEFORE UPDATE ON pms_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointment_types_updated_at
    BEFORE UPDATE ON appointment_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cases_updated_at
    BEFORE UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_controls_updated_at
    BEFORE UPDATE ON sync_controls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle duplicate data gracefully during sync
CREATE OR REPLACE FUNCTION handle_sync_duplicates()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is an update operation, just return the new record
    IF TG_OP = 'UPDATE' THEN
        RETURN NEW;
    END IF;
    
    -- For insert operations, check if record already exists
    IF TG_TABLE_NAME = 'patients' THEN
        -- Check if patient already exists
        IF EXISTS (
            SELECT 1 FROM patients 
            WHERE user_id = NEW.user_id 
            AND pms_patient_id = NEW.pms_patient_id 
            AND pms_type = NEW.pms_type
        ) THEN
            -- Update existing record instead of inserting
            UPDATE patients SET
                first_name = NEW.first_name,
                last_name = NEW.last_name,
                email = COALESCE(NEW.email, email),
                phone = COALESCE(NEW.phone, phone),
                date_of_birth = COALESCE(NEW.date_of_birth, date_of_birth),
                patient_type = NEW.patient_type,
                physio_name = COALESCE(NEW.physio_name, physio_name),
                pms_last_modified = NEW.pms_last_modified,
                updated_at = NOW()
            WHERE user_id = NEW.user_id 
            AND pms_patient_id = NEW.pms_patient_id 
            AND pms_type = NEW.pms_type;
            
            RETURN NULL; -- Prevent insert
        END IF;
    ELSIF TG_TABLE_NAME = 'appointments' THEN
        -- Check if appointment already exists
        IF EXISTS (
            SELECT 1 FROM appointments 
            WHERE user_id = NEW.user_id 
            AND pms_appointment_id = NEW.pms_appointment_id 
            AND pms_type = NEW.pms_type
        ) THEN
            -- Update existing record instead of inserting
            UPDATE appointments SET
                patient_id = COALESCE(NEW.patient_id, patient_id),
                appointment_type = COALESCE(NEW.appointment_type, appointment_type),
                appointment_type_id = COALESCE(NEW.appointment_type_id, appointment_type_id),
                status = NEW.status,
                appointment_date = NEW.appointment_date,
                practitioner_id = COALESCE(NEW.practitioner_id, practitioner_id),
                practitioner_name = COALESCE(NEW.practitioner_name, practitioner_name),
                location_name = COALESCE(NEW.location_name, location_name),
                notes = COALESCE(NEW.notes, notes),
                duration_minutes = COALESCE(NEW.duration_minutes, duration_minutes),
                is_completed = NEW.is_completed,
                updated_at = NOW()
            WHERE user_id = NEW.user_id 
            AND pms_appointment_id = NEW.pms_appointment_id 
            AND pms_type = NEW.pms_type;
            
            RETURN NULL; -- Prevent insert
        END IF;
    ELSIF TG_TABLE_NAME = 'appointment_types' THEN
        -- Check if appointment type already exists
        IF EXISTS (
            SELECT 1 FROM appointment_types 
            WHERE user_id = NEW.user_id 
            AND appointment_id = NEW.appointment_id 
            AND pms_type = NEW.pms_type
        ) THEN
            -- Update existing record instead of inserting
            UPDATE appointment_types SET
                appointment_name = NEW.appointment_name,
                code = NEW.code,
                updated_at = NOW()
            WHERE user_id = NEW.user_id 
            AND appointment_id = NEW.appointment_id 
            AND pms_type = NEW.pms_type;
            
            RETURN NULL; -- Prevent insert
        END IF;
    END IF;
    
    -- If no duplicate found, allow the insert
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to check for existing sync data
CREATE OR REPLACE FUNCTION check_existing_sync_data(
    p_user_id UUID,
    p_pms_type TEXT
)
RETURNS TABLE(
    existing_patients BIGINT,
    existing_appointments BIGINT,
    existing_appointment_types BIGINT,
    last_sync_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(p.patient_count, 0)::BIGINT as existing_patients,
        COALESCE(a.appointment_count, 0)::BIGINT as existing_appointments,
        COALESCE(at.type_count, 0)::BIGINT as existing_appointment_types,
        COALESCE(sl.last_sync, u.last_sync_at) as last_sync_at
    FROM users u
    LEFT JOIN (
        SELECT user_id, COUNT(*) as patient_count
        FROM patients 
        WHERE user_id = p_user_id AND pms_type = p_pms_type
        GROUP BY user_id
    ) p ON p.user_id = u.id
    LEFT JOIN (
        SELECT user_id, COUNT(*) as appointment_count
        FROM appointments 
        WHERE user_id = p_user_id AND pms_type = p_pms_type
        GROUP BY user_id
    ) a ON a.user_id = u.id
    LEFT JOIN (
        SELECT user_id, COUNT(*) as type_count
        FROM appointment_types 
        WHERE user_id = p_user_id AND pms_type = p_pms_type
        GROUP BY user_id
    ) at ON at.user_id = u.id
    LEFT JOIN (
        SELECT user_id, MAX(completed_at) as last_sync
        FROM sync_logs 
        WHERE user_id = p_user_id AND pms_type = p_pms_type AND status = 'completed'
        GROUP BY user_id
    ) sl ON sl.user_id = u.id
    WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get sync statistics
CREATE OR REPLACE FUNCTION get_sync_statistics(
    p_user_id UUID,
    p_pms_type TEXT
)
RETURNS TABLE(
    total_patients BIGINT,
    epc_patients BIGINT,
    wc_patients BIGINT,
    total_appointments BIGINT,
    completed_appointments BIGINT,
    last_sync_status TEXT,
    last_sync_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(p.total_count, 0)::BIGINT as total_patients,
        COALESCE(p.epc_count, 0)::BIGINT as epc_patients,
        COALESCE(p.wc_count, 0)::BIGINT as wc_patients,
        COALESCE(a.total_count, 0)::BIGINT as total_appointments,
        COALESCE(a.completed_count, 0)::BIGINT as completed_appointments,
        COALESCE(sl.status, 'never')::TEXT as last_sync_status,
        COALESCE(sl.completed_at, u.last_sync_at) as last_sync_at
    FROM users u
    LEFT JOIN (
        SELECT 
            user_id,
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE patient_type = 'EPC') as epc_count,
            COUNT(*) FILTER (WHERE patient_type = 'WC') as wc_count
        FROM patients 
        WHERE user_id = p_user_id AND pms_type = p_pms_type
        GROUP BY user_id
    ) p ON p.user_id = u.id
    LEFT JOIN (
        SELECT 
            user_id,
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE is_completed = true) as completed_count
        FROM appointments 
        WHERE user_id = p_user_id AND pms_type = p_pms_type
        GROUP BY user_id
    ) a ON a.user_id = u.id
    LEFT JOIN (
        SELECT user_id, status, completed_at
        FROM sync_logs 
        WHERE user_id = p_user_id AND pms_type = p_pms_type
        ORDER BY completed_at DESC
        LIMIT 1
    ) sl ON sl.user_id = u.id
    WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to handle duplicates gracefully
CREATE TRIGGER handle_patient_duplicates
    BEFORE INSERT ON patients
    FOR EACH ROW
    EXECUTE FUNCTION handle_sync_duplicates();

CREATE TRIGGER handle_appointment_duplicates
    BEFORE INSERT ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION handle_sync_duplicates();

CREATE TRIGGER handle_appointment_type_duplicates
    BEFORE INSERT ON appointment_types
    FOR EACH ROW
    EXECUTE FUNCTION handle_sync_duplicates();

-- Trigger to automatically update patient status when appointments are completed
CREATE OR REPLACE FUNCTION update_patient_sessions_on_appointment()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process when appointment completion status changes
    IF OLD.is_completed = FALSE AND NEW.is_completed = TRUE THEN
        -- Update patient's sessions_used count
        UPDATE patients 
        SET 
            sessions_used = sessions_used + 1,
            updated_at = NOW()
        WHERE id = NEW.patient_id;
        
        -- Log the session update
        INSERT INTO sync_logs (
            user_id, 
            pms_type, 
            sync_type, 
            status, 
            patients_processed,
            error_details
        ) VALUES (
            (SELECT user_id FROM patients WHERE id = NEW.patient_id),
            'automatic',
            'session_update',
            'completed',
            1,
            jsonb_build_object(
                'action', 'session_completed',
                'patient_id', NEW.patient_id,
                'appointment_id', NEW.id,
                'timestamp', NOW()
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_patient_sessions
    AFTER UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_patient_sessions_on_appointment();

-- ============================================================================
-- PATIENT STATUS MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to update patient status and log changes
CREATE OR REPLACE FUNCTION update_patient_status(
    p_patient_id UUID,
    p_user_id UUID,
    p_new_status TEXT,
    p_reason TEXT DEFAULT NULL,
    p_quota INTEGER DEFAULT NULL,
    p_sessions_used INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_old_status TEXT;
    v_old_quota INTEGER;
    v_old_sessions_used INTEGER;
BEGIN
    -- Get current values
    SELECT status, quota, sessions_used INTO v_old_status, v_old_quota, v_old_sessions_used
    FROM patients 
    WHERE id = p_patient_id AND user_id = p_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Patient not found or access denied';
    END IF;
    
    -- Update patient
    UPDATE patients 
    SET 
        status = p_new_status,
        quota = COALESCE(p_quota, quota),
        sessions_used = COALESCE(p_sessions_used, sessions_used),
        status_change_reason = COALESCE(p_reason, status_change_reason),
        last_status_change = NOW(),
        updated_at = NOW()
    WHERE id = p_patient_id;
    
    -- Log the status change
    INSERT INTO sync_logs (
        user_id, 
        pms_type, 
        sync_type, 
        status, 
        patients_processed,
        error_details
    ) VALUES (
        p_user_id,
        'manual',
        'status_change',
        'completed',
        1,
        jsonb_build_object(
            'patient_id', p_patient_id,
            'old_status', v_old_status,
            'new_status', p_new_status,
            'old_quota', v_old_quota,
            'new_quota', COALESCE(p_quota, v_old_quota),
            'old_sessions_used', v_old_sessions_used,
            'new_sessions_used', COALESCE(p_sessions_used, v_old_sessions_used),
            'reason', p_reason,
            'timestamp', NOW()
        )
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get patients needing action (quota running low)
CREATE OR REPLACE FUNCTION get_patients_needing_action(p_user_id UUID)
RETURNS TABLE(
    patient_id UUID,
    patient_name TEXT,
    patient_type TEXT,
    current_status TEXT,
    quota INTEGER,
    sessions_used INTEGER,
    remaining_sessions INTEGER,
    alert_level TEXT,
    last_status_change TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as patient_id,
        (p.first_name || ' ' || p.last_name) as patient_name,
        p.patient_type,
        p.status as current_status,
        p.quota,
        p.sessions_used,
        (p.quota - p.sessions_used) as remaining_sessions,
        CASE 
            WHEN (p.quota - p.sessions_used) <= 0 THEN 'critical'
            WHEN (p.quota - p.sessions_used) <= p.alert_preference THEN 'warning'
            ELSE 'good'
        END as alert_level,
        p.last_status_change
    FROM patients p
    WHERE p.user_id = p_user_id 
    AND p.is_active = true
    AND p.status IN ('active', 'warning')
    AND (p.quota - p.sessions_used) <= p.alert_preference
    ORDER BY (p.quota - p.sessions_used) ASC, p.last_status_change DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically update patient statuses based on session usage
CREATE OR REPLACE FUNCTION auto_update_patient_statuses(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_critical_count INTEGER := 0;
    v_warning_count INTEGER := 0;
    v_total_count INTEGER := 0;
BEGIN
    -- Update patients who have exhausted their quota
    UPDATE patients 
    SET 
        status = 'critical',
        status_change_reason = 'Quota exhausted - automatic update',
        last_status_change = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id 
    AND is_active = true 
    AND status = 'active'
    AND (quota - sessions_used) <= 0;
    
    GET DIAGNOSTICS v_critical_count = ROW_COUNT;
    
    -- Update patients who are running low on sessions
    UPDATE patients 
    SET 
        status = 'warning',
        status_change_reason = 'Sessions running low - automatic update',
        last_status_change = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id 
    AND is_active = true 
    AND status = 'active'
    AND (quota - sessions_used) <= alert_preference
    AND (quota - sessions_used) > 0;
    
    GET DIAGNOSTICS v_warning_count = ROW_COUNT;
    
    -- Calculate total count
    v_total_count := v_critical_count + v_warning_count;
    
    -- Log the automatic updates
    IF v_total_count > 0 THEN
        INSERT INTO sync_logs (
            user_id, 
            pms_type, 
            sync_type, 
            status, 
            patients_processed,
            error_details
        ) VALUES (
            p_user_id,
            'automatic',
            'status_update',
            'completed',
            v_total_count,
            jsonb_build_object(
                'action', 'auto_status_update',
                'critical_patients', v_critical_count,
                'warning_patients', v_warning_count,
                'total_patients', v_total_count,
                'timestamp', NOW()
            )
        );
    END IF;
    
    RETURN v_total_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================================================
-- PATIENT STATUS MANAGEMENT INITIALIZATION
-- ============================================================================
-- This section handles existing data when upgrading an existing database

-- Initialize existing patients with proper status if upgrading
DO $$
BEGIN
    -- Set default status for existing patients
    UPDATE patients 
    SET status = 'active' 
    WHERE status IS NULL;
    
    -- Set default quotas based on patient type
    UPDATE patients 
    SET quota = CASE 
        WHEN patient_type = 'EPC' THEN 5
        WHEN patient_type = 'WC' THEN 8
        ELSE 5
    END
    WHERE quota IS NULL;
    
    -- Set default alert preference
    UPDATE patients 
    SET alert_preference = 2 
    WHERE alert_preference IS NULL;
    
    -- Initialize sessions_used from completed appointments if upgrading
    UPDATE patients 
    SET sessions_used = (
        SELECT COUNT(*) 
        FROM appointments 
        WHERE appointments.patient_id = patients.id 
        AND appointments.is_completed = true
    )
    WHERE sessions_used IS NULL;
    
    -- Set last_status_change for existing patients
    UPDATE patients 
    SET last_status_change = created_at 
    WHERE last_status_change IS NULL;
END $$;

-- ============================================================================
-- CASES TABLE POPULATION FUNCTION
-- ============================================================================

-- Function to populate cases table from existing patients and appointments data
CREATE OR REPLACE FUNCTION populate_cases_from_existing_data(p_user_id UUID DEFAULT NULL)
RETURNS void AS $$
DECLARE
    v_patient RECORD;
    v_appointment RECORD;
    v_case_count INTEGER := 0;
    v_location_name TEXT;
    v_physio_name TEXT;
    v_appointment_type_name TEXT;
    v_next_visit_date DATE;
    v_last_visit_date DATE;
    v_wc_tag TEXT;
    v_epc_tag TEXT;
    v_wc_type_ids TEXT[];
    v_epc_type_ids TEXT[];
BEGIN
    -- Get user's custom WC and EPC tags from users table
    SELECT wc, epc INTO v_wc_tag, v_epc_tag
    FROM users 
    WHERE id = COALESCE(p_user_id, (SELECT user_id FROM patients LIMIT 1));
    
    -- Get appointment type IDs that match the user's custom tags
    SELECT ARRAY_AGG(appointment_id) INTO v_wc_type_ids
    FROM appointment_types 
    WHERE user_id = COALESCE(p_user_id, (SELECT user_id FROM patients LIMIT 1))
    AND appointment_name ILIKE '%' || v_wc_tag || '%';
    
    SELECT ARRAY_AGG(appointment_id) INTO v_epc_type_ids
    FROM appointment_types 
    WHERE user_id = COALESCE(p_user_id, (SELECT user_id FROM patients LIMIT 1))
    AND appointment_name ILIKE '%' || v_epc_tag || '%';
    
    -- First, clear existing cases to prevent duplication
    DELETE FROM cases WHERE user_id = COALESCE(p_user_id, (SELECT user_id FROM patients LIMIT 1));
    
    -- Loop through ONLY patients that have WC or EPC appointments (not all patients)
    FOR v_patient IN 
        SELECT DISTINCT
            p.id as patient_id,
            p.user_id,
            p.pms_type,
            p.first_name,
            p.last_name,
            p.email,
            p.phone,
            p.date_of_birth,
            p.patient_type,
            p.physio_name,
            p.quota,
            p.sessions_used,
            p.status,
            p.alert_preference
        FROM patients p
        INNER JOIN appointments apt ON p.id = apt.patient_id
        WHERE p.user_id = COALESCE(p_user_id, (SELECT user_id FROM patients LIMIT 1))
        AND apt.appointment_type_id IN (
            SELECT unnest(v_wc_type_ids) UNION SELECT unnest(v_epc_type_ids)
        )
        AND p.user_id IS NOT NULL
    LOOP
        -- Get the most recent appointment for this patient to determine location and next visit
        SELECT 
            apt.appointment_date,
            apt.practitioner_name,
            apt.appointment_type,
            apt.appointment_type_id,
            apt.location_name,
            apt.practitioner_id
        INTO v_appointment
        FROM appointments apt
        WHERE apt.patient_id = v_patient.patient_id
        ORDER BY apt.appointment_date DESC
        LIMIT 1;
        
        -- Set default values if no appointment found
        v_location_name := COALESCE(v_appointment.location_name, 'Main Clinic');
        -- Get physio name from the most recent appointment's practitioner_name
        v_physio_name := COALESCE(v_appointment.practitioner_name, 'Unknown Practitioner');
        v_appointment_type_name := COALESCE(v_appointment.appointment_type, v_patient.patient_type);
        v_next_visit_date := COALESCE(v_appointment.appointment_date, CURRENT_DATE + INTERVAL '7 days');
        v_last_visit_date := v_appointment.appointment_date;
        
        -- Insert case record
        INSERT INTO cases (
            user_id,
            patient_id,
            pms_type,
            case_number,
            case_title,
            patient_first_name,
            patient_last_name,
            patient_email,
            patient_phone,
            patient_date_of_birth,
            location_name,
            physio_name,
            pms_practitioner_id,
            appointment_type_id,
            appointment_type_name,
            program_type,
            quota,
            sessions_used,
            status,
            next_visit_date,
            last_visit_date,
            alert_preference,
            is_alert_active,
            alert_message
        ) VALUES (
            v_patient.user_id,
            v_patient.patient_id,
            v_patient.pms_type,
            'CASE-' || v_patient.patient_id::text,
            v_patient.first_name || ' ' || v_patient.last_name || ' - ' || v_patient.patient_type,
            v_patient.first_name,
            v_patient.last_name,
            v_patient.email,
            v_patient.phone,
            v_patient.date_of_birth,
            v_location_name,
            v_physio_name,
            v_appointment.practitioner_id,
            v_appointment.appointment_type_id,
            v_appointment_type_name,
            v_patient.patient_type,
            v_patient.quota,
            v_patient.sessions_used,
            v_patient.status,
            v_next_visit_date,
            v_last_visit_date,
            v_patient.alert_preference,
            CASE WHEN v_patient.sessions_used >= (v_patient.quota - v_patient.alert_preference) THEN true ELSE false END,
            CASE WHEN v_patient.sessions_used >= (v_patient.quota - v_patient.alert_preference) THEN 'Sessions running low - Action needed' ELSE NULL END
        );
        v_case_count := v_case_count + 1;
    END LOOP;
    
    -- Log the population process
    INSERT INTO sync_logs (
        user_id, 
        pms_type, 
        sync_type, 
        status, 
        patients_processed,
        error_details
    ) VALUES (
        (SELECT user_id FROM patients LIMIT 1),
        'system',
        'cases_population',
        'completed',
        v_case_count,
        jsonb_build_object(
            'action', 'populate_cases_from_existing_data',
            'cases_created', v_case_count,
            'timestamp', NOW()
        )
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCRIPT COMPLETION
-- ============================================================================
-- Final database setup completed successfully!
-- Patient status management system is now active.
-- Cases table is ready for dashboard listing functionality.
-- You can now use the dashboard with full patient workflow functionality.

-- ============================================================================
-- SYNC DATA POPULATION FUNCTION
-- ============================================================================
-- Function to populate cases table from sync data (17 WC + 10 EPC patients)
-- This ensures no duplication when syncing again
CREATE OR REPLACE FUNCTION populate_cases_from_sync_data(p_user_id UUID DEFAULT NULL)
RETURNS void AS $$
DECLARE
    v_patient RECORD;
    v_appointment RECORD;
    v_case_count INTEGER := 0;
    v_location_name TEXT;
    v_physio_name TEXT;
    v_appointment_type_name TEXT;
    v_next_visit_date DATE;
    v_last_visit_date DATE;
    v_case_number TEXT;
    v_wc_tag TEXT;
    v_epc_tag TEXT;
    v_wc_type_ids TEXT[];
    v_epc_type_ids TEXT[];
BEGIN
    -- Get user's custom WC and EPC tags from users table
    SELECT wc, epc INTO v_wc_tag, v_epc_tag
    FROM users 
    WHERE id = COALESCE(p_user_id, (SELECT user_id FROM patients LIMIT 1));
    
    -- Get appointment type IDs that match the user's custom tags
    SELECT ARRAY_AGG(appointment_id) INTO v_wc_type_ids
    FROM appointment_types 
    WHERE user_id = COALESCE(p_user_id, (SELECT user_id FROM patients LIMIT 1))
    AND appointment_name ILIKE '%' || v_wc_tag || '%';
    
    SELECT ARRAY_AGG(appointment_id) INTO v_epc_type_ids
    FROM appointment_types 
    WHERE user_id = COALESCE(p_user_id, (SELECT user_id FROM patients LIMIT 1))
    AND appointment_name ILIKE '%' || v_epc_tag || '%';
    
    -- First, clear existing cases to prevent duplication
    DELETE FROM cases WHERE user_id = COALESCE(p_user_id, (SELECT user_id FROM patients LIMIT 1));
    
    FOR v_patient IN
        SELECT DISTINCT
            p.id as patient_id, 
            p.user_id, 
            pms_type, 
            p.first_name, 
            p.last_name, 
            p.email, 
            p.phone, 
            p.date_of_birth,
            p.patient_type, 
            p.physio_name, 
            p.quota, 
            p.sessions_used, 
            p.status, 
            p.alert_preference
        FROM patients p
        INNER JOIN appointments apt ON p.id = apt.patient_id
        WHERE p.user_id = COALESCE(p_user_id, (SELECT user_id FROM patients LIMIT 1))
        AND apt.appointment_type_id IN (
            SELECT unnest(v_wc_type_ids) UNION SELECT unnest(v_epc_type_ids)
        )
        AND p.user_id IS NOT NULL
    LOOP
        -- Get the most recent appointment for this patient
        SELECT
            apt.appointment_date, 
            apt.practitioner_name, 
            apt.appointment_type, 
            apt.appointment_type_id, 
            apt.location_name,
            apt.practitioner_id
        INTO v_appointment
        FROM appointments apt
        WHERE apt.patient_id = v_patient.patient_id
        ORDER BY apt.appointment_date DESC
        LIMIT 1;

        -- Set default values if no appointment found
        v_location_name := COALESCE(v_appointment.location_name, 'Main Clinic');
        -- Get physio name from the most recent appointment's practitioner_name
        v_physio_name := COALESCE(v_appointment.practitioner_name, 'Unknown Practitioner');
        v_appointment_type_name := COALESCE(v_appointment.appointment_type, v_patient.patient_type);
        v_next_visit_date := COALESCE(v_appointment.appointment_date, CURRENT_DATE + INTERVAL '7 days');
        v_last_visit_date := v_appointment.appointment_date;
        
        -- Generate unique case number
        v_case_number := 'CASE-' || v_patient.patient_id::text || '-' || v_patient.patient_type;

        -- Insert into cases table
        INSERT INTO cases (
            user_id, 
            patient_id, 
            pms_type, 
            case_number, 
            case_title, 
            patient_first_name, 
            patient_last_name,
            patient_email, 
            patient_phone, 
            patient_date_of_birth, 
            location_name, 
            physio_name,
            appointment_type_id, 
            appointment_type_name, 
            program_type, 
            quota, 
            sessions_used, 
            status,
            next_visit_date, 
            last_visit_date, 
            alert_preference, 
            is_alert_active, 
            alert_message,
            priority,
            case_start_date
        ) VALUES (
            v_patient.user_id, 
            v_patient.patient_id, 
            v_patient.pms_type, 
            v_case_number,
            v_patient.first_name || ' ' || v_patient.last_name || ' - ' || v_patient.patient_type,
            v_patient.first_name, 
            v_patient.last_name, 
            v_patient.email, 
            v_patient.phone, 
            v_patient.date_of_birth,
            v_location_name, 
            v_physio_name, 
            v_appointment.appointment_type_id, 
            v_appointment_type_name,
            v_patient.patient_type, 
            v_patient.quota, 
            v_patient.sessions_used, 
            v_patient.status,
            v_next_visit_date, 
            v_last_visit_date, 
            v_patient.alert_preference,
            CASE WHEN v_patient.sessions_used >= (v_patient.quota - v_patient.alert_preference) THEN true ELSE false END,
            CASE WHEN v_patient.sessions_used >= (v_patient.quota - v_patient.alert_preference) THEN 'Sessions running low - Action needed' ELSE NULL END,
            CASE 
                WHEN v_patient.sessions_used >= v_patient.quota THEN 'high'
                WHEN v_patient.sessions_used >= (v_patient.quota - 2) THEN 'high'
                WHEN v_patient.sessions_used >= (v_patient.quota - 3) THEN 'medium'
                ELSE 'low'
            END,
            COALESCE(v_last_visit_date, CURRENT_DATE)
        );
        
        v_case_count := v_case_count + 1;
    END LOOP;
    
    -- Log the population
    INSERT INTO sync_logs (
        user_id, 
        pms_type, 
        sync_type, 
        status, 
        patients_processed, 
        error_details
    ) VALUES (
        (SELECT user_id FROM patients LIMIT 1), 
        'system', 
        'cases_population_from_sync', 
        'completed', 
        v_case_count, 
        jsonb_build_object(
            'action', 'populate_cases_from_sync_data', 
            'cases_created', v_case_count, 
            'wc_patients', (SELECT COUNT(*) FROM cases WHERE program_type = 'WC'),
            'epc_patient_count', (SELECT COUNT(*) FROM cases WHERE program_type = 'EPC'),
            'timestamp', NOW()
        )
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- READY TO USE
-- ============================================================================
-- Your database is now ready with:
-- 1. Cases table for dashboard listing
-- 2. populate_cases_from_sync_data() function to populate from sync data
-- 3. No duplication when syncing again
-- 4. Support for user-defined WC and EPC tags

-- ============================================================================
-- PRACTITIONER NAME MIGRATION
-- ============================================================================
-- This section handles adding the pms_practitioner_id column and updating existing cases

-- Add pms_practitioner_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cases' AND column_name = 'pms_practitioner_id'
    ) THEN
        ALTER TABLE cases ADD COLUMN pms_practitioner_id TEXT;
        RAISE NOTICE '✅ Added pms_practitioner_id column to cases table';
    ELSE
        RAISE NOTICE '✅ pms_practitioner_id column already exists';
    END IF;
END $$;

-- Update existing cases with practitioner names from appointments (simplified)
UPDATE cases 
SET 
    physio_name = appointment_data.practitioner_name,
    pms_practitioner_id = appointment_data.practitioner_id,
    updated_at = NOW()
FROM (
    SELECT DISTINCT ON (apt.patient_id)
        apt.patient_id,
        apt.practitioner_name,
        apt.practitioner_id
    FROM appointments apt
    WHERE apt.practitioner_name IS NOT NULL 
    AND apt.practitioner_name != 'Unknown Practitioner'
    ORDER BY apt.patient_id, apt.appointment_date DESC
) AS appointment_data
WHERE cases.patient_id = appointment_data.patient_id
AND (cases.physio_name IS NULL OR cases.physio_name = 'Unknown Practitioner');

-- Create index for better performance on practitioner lookups
CREATE INDEX IF NOT EXISTS idx_cases_pms_practitioner_id ON cases(pms_practitioner_id);



-- ============================================================================
-- MANUAL SYNC PRACTITIONER NAME PRESERVATION FIX
-- ============================================================================
-- This section ensures that manual syncs preserve practitioner names

-- Recreate the duplicate handling trigger with proper practitioner field handling
CREATE OR REPLACE FUNCTION handle_sync_duplicates()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is an update operation, just return the new record
    IF TG_OP = 'UPDATE' THEN
        RETURN NEW;
    END IF;
    
    -- For insert operations, check if record already exists
    IF TG_TABLE_NAME = 'patients' THEN
        -- Check if patient already exists
        IF EXISTS (
            SELECT 1 FROM patients 
            WHERE user_id = NEW.user_id 
            AND pms_patient_id = NEW.pms_patient_id 
            AND pms_type = NEW.pms_type
        ) THEN
            -- Update existing record instead of inserting
            UPDATE patients SET
                first_name = NEW.first_name,
                last_name = NEW.last_name,
                email = COALESCE(NEW.email, email),
                phone = COALESCE(NEW.phone, phone),
                date_of_birth = COALESCE(NEW.date_of_birth, date_of_birth),
                patient_type = NEW.patient_type,
                physio_name = COALESCE(NEW.physio_name, physio_name),
                pms_last_modified = NEW.pms_last_modified,
                updated_at = NOW()
            WHERE user_id = NEW.user_id 
            AND pms_patient_id = NEW.pms_patient_id 
            AND pms_type = NEW.pms_type;
            
            RETURN NULL; -- Prevent insert
        END IF;
    ELSIF TG_TABLE_NAME = 'appointments' THEN
        -- Check if appointment already exists
        IF EXISTS (
            SELECT 1 FROM appointments 
            WHERE user_id = NEW.user_id 
            AND pms_appointment_id = NEW.pms_appointment_id 
            AND pms_type = NEW.pms_type
        ) THEN
            -- Update existing record instead of inserting
            -- CRITICAL: Preserve practitioner_id and practitioner_name if they exist
            UPDATE appointments SET
                patient_id = COALESCE(NEW.patient_id, patient_id),
                appointment_type = COALESCE(NEW.appointment_type, appointment_type),
                appointment_type_id = COALESCE(NEW.appointment_type_id, appointment_type_id),
                status = NEW.status,
                appointment_date = NEW.appointment_date,
                practitioner_id = COALESCE(NEW.practitioner_id, practitioner_id),
                practitioner_name = COALESCE(NEW.practitioner_name, practitioner_name),
                location_name = COALESCE(NEW.location_name, location_name),
                notes = COALESCE(NEW.notes, notes),
                duration_minutes = COALESCE(NEW.duration_minutes, duration_minutes),
                is_completed = NEW.is_completed,
                updated_at = NOW()
            WHERE user_id = NEW.user_id 
            AND pms_appointment_id = NEW.pms_appointment_id 
            AND pms_type = NEW.pms_type;
            
            RETURN NULL; -- Prevent insert
        END IF;
    ELSIF TG_TABLE_NAME = 'appointment_types' THEN
        -- Check if appointment type already exists
        IF EXISTS (
            SELECT 1 FROM appointment_types 
            WHERE user_id = NEW.user_id 
            AND appointment_id = NEW.appointment_id 
            AND pms_type = NEW.pms_type
        ) THEN
            -- Update existing record instead of inserting
            UPDATE appointment_types SET
                appointment_name = NEW.appointment_name,
                code = NEW.code,
                updated_at = NOW()
            WHERE user_id = NEW.user_id 
            AND appointment_id = NEW.appointment_id 
            AND pms_type = NEW.pms_type;
            
            RETURN NULL; -- Prevent insert
        END IF;
    END IF;
    
    -- If no duplicate found, allow the insert
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;



-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================
-- Database configured with:
-- • Cases table with practitioner names support
-- • Practitioner filtering in dashboard
-- • Manual sync practitioner name preservation
-- • Support for Cliniko and Nookal PMS systems

-- ============================================================================
-- EMAIL NOTIFICATION SYSTEM
-- ============================================================================
-- This section sets up the database tables for robust email notifications
-- Note: Email preferences are stored directly in users table

-- Email notifications queue table
CREATE TABLE IF NOT EXISTS email_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('quota_alert', 'pending_status', 'general')),
    patient_id VARCHAR(100),
    clinic_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System alerts table for monitoring
CREATE TABLE IF NOT EXISTS system_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message VARCHAR(500) NOT NULL,
    details JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Quota alerts tracking table
CREATE TABLE IF NOT EXISTS quota_alerts_sent (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id VARCHAR(100) NOT NULL,
    clinic_id VARCHAR(100) NOT NULL,
    email_id UUID REFERENCES email_notifications(id),
    sessions_remaining INTEGER NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status);
CREATE INDEX IF NOT EXISTS idx_email_notifications_clinic ON email_notifications(clinic_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_type ON email_notifications(type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_retry ON email_notifications(next_retry_at) WHERE status = 'retrying';
CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_patient ON quota_alerts_sent(patient_id);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_clinic ON quota_alerts_sent(clinic_id);

-- Function to increment email attempts atomically
CREATE OR REPLACE FUNCTION increment_email_attempts(email_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE email_notifications 
    SET attempts = attempts + 1,
        updated_at = NOW()
    WHERE id = email_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old successful emails (optional - for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_emails(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_notifications 
    WHERE status = 'sent' 
    AND sent_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get email statistics
CREATE OR REPLACE FUNCTION get_email_stats(
    clinic_filter VARCHAR(100) DEFAULT NULL,
    hours_back INTEGER DEFAULT 24
)
RETURNS TABLE(
    total_emails BIGINT,
    sent_emails BIGINT,
    failed_emails BIGINT,
    pending_emails BIGINT,
    retrying_emails BIGINT,
    success_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_emails,
        COUNT(*) FILTER (WHERE status = 'sent') as sent_emails,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_emails,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_emails,
        COUNT(*) FILTER (WHERE status = 'retrying') as retrying_emails,
        CASE 
            WHEN COUNT(*) = 0 THEN 100.0
            ELSE ROUND((COUNT(*) FILTER (WHERE status = 'sent')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
        END as success_rate
    FROM email_notifications
    WHERE created_at >= NOW() - INTERVAL '1 hour' * hours_back
    AND (clinic_filter IS NULL OR clinic_id = clinic_filter);
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies for notification tables
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_alerts_sent ENABLE ROW LEVEL SECURITY;

-- Policy for email_notifications - users can only see their own emails
CREATE POLICY email_notifications_user_policy ON email_notifications
    FOR ALL USING (
        clinic_id = (
            SELECT id::text FROM users 
            WHERE auth_user_id = auth.uid()
        )
    );

-- Policy for system_alerts - only admin users can see system alerts
CREATE POLICY system_alerts_admin_policy ON system_alerts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE auth_user_id = auth.uid() 
            AND subscription_status = 'admin'
        )
    );

-- Policy for quota_alerts_sent - users can only see their own alerts
CREATE POLICY quota_alerts_user_policy ON quota_alerts_sent
    FOR ALL USING (
        clinic_id = (
            SELECT id::text FROM users 
            WHERE auth_user_id = auth.uid()
        )
    );

-- Comments for documentation
COMMENT ON TABLE email_notifications IS 'Queue for email notifications with retry logic and failure tracking - uses user preferences from users table';
COMMENT ON TABLE system_alerts IS 'System-wide alerts and errors for admin monitoring';
COMMENT ON TABLE quota_alerts_sent IS 'Tracking table to prevent duplicate quota alerts';
COMMENT ON COLUMN users.custom_email IS 'Optional custom email for notifications (falls back to user.email if not set)';
COMMENT ON COLUMN users.enable_email_alerts IS 'Whether to send email notifications (default: false)';
COMMENT ON COLUMN users.session_quota_threshold IS 'Send alert when sessions remaining equals this number (default: 2)';

COMMENT ON COLUMN email_notifications.attempts IS 'Number of send attempts made';
COMMENT ON COLUMN email_notifications.max_attempts IS 'Maximum retry attempts before marking as failed';
COMMENT ON COLUMN email_notifications.next_retry_at IS 'When to retry sending this email';

-- Grant appropriate permissions
GRANT ALL ON email_notifications TO authenticated;
GRANT ALL ON system_alerts TO authenticated;
GRANT ALL ON quota_alerts_sent TO authenticated;

-- ============================================================================
-- DATABASE PERFORMANCE OPTIMIZATION
-- ============================================================================
-- This section optimizes the database for better performance and reduces timeout issues

-- Ensure the critical index for auth_user_id exists and is optimized
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id_optimized 
ON users(auth_user_id) 
WHERE auth_user_id IS NOT NULL;

-- Add a partial index for active users only (if you have a lot of inactive users)
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id_active 
ON users(auth_user_id) 
WHERE auth_user_id IS NOT NULL AND is_onboarded IS NOT NULL;

-- Optimize the users table query pattern used in auth context
CREATE INDEX IF NOT EXISTS idx_users_auth_onboarded 
ON users(auth_user_id, is_onboarded) 
WHERE auth_user_id IS NOT NULL;

-- Create a function to get user onboarding status efficiently
CREATE OR REPLACE FUNCTION get_user_onboarding_status(p_auth_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_onboarded BOOLEAN;
BEGIN
    -- Use a simple, fast query with proper indexing
    SELECT COALESCE(is_onboarded, FALSE) INTO v_is_onboarded
    FROM users 
    WHERE auth_user_id = p_auth_user_id
    LIMIT 1;
    
    -- Return false if user not found
    RETURN COALESCE(v_is_onboarded, FALSE);
EXCEPTION
    WHEN OTHERS THEN
        -- Return false on any error to prevent auth failures
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update table statistics to help query planner
ANALYZE users;







-- ============================================================================
-- FINAL SETUP COMPLETE
-- ============================================================================
-- Your database is now fully configured with:
-- 1. Complete PMS integration system
-- 2. Patient status management
-- 3. Cases table for dashboard functionality
-- 4. Email notification system with retry logic
-- 5. Row Level Security (RLS) policies
-- 6. Performance indexes and helper functions
-- 7. Duplicate prevention and sync management
-- 8. Database performance optimization for auth queries
-- 9. Stripe integration with customer ID tracking

-- All systems are ready for production use!

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
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
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
    subscription_status TEXT DEFAULT 'trial',
    trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    pms_type TEXT,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Enhanced unique constraint to prevent duplicates
    UNIQUE(user_id, pms_patient_id, pms_type)
);

-- Create appointments table with enhanced duplicate prevention
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    pms_appointment_id TEXT NOT NULL,
    pms_type TEXT NOT NULL,
    appointment_type TEXT, -- For Nookal: stores "WC" or "EPC" extracted from appointment name
    status TEXT NOT NULL,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    practitioner_name TEXT,
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

-- Create sync_logs table
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pms_type TEXT NOT NULL,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('initial', 'incremental', 'manual', 'batch')),
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
CREATE INDEX idx_appointment_types_user_id ON appointment_types(user_id);
CREATE INDEX idx_appointment_types_pms_id ON appointment_types(appointment_id, pms_type);
CREATE INDEX idx_appointment_types_name ON appointment_types(appointment_name, pms_type);
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
                status = NEW.status,
                appointment_date = NEW.appointment_date,
                practitioner_name = COALESCE(NEW.practitioner_name, practitioner_name),
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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

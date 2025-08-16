-- Add appointment_types table for storing Cliniko appointment types
CREATE TABLE IF NOT EXISTS appointment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id TEXT NOT NULL, -- Cliniko appointment type ID
    appointment_name TEXT NOT NULL, -- Name from Cliniko
    code TEXT, -- EPC or WC extracted from name
    pms_type TEXT NOT NULL DEFAULT 'cliniko',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, appointment_id, pms_type)
);

-- Enable RLS on appointment_types table
ALTER TABLE appointment_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for appointment_types
CREATE POLICY "Users can view their own appointment types" ON appointment_types
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own appointment types" ON appointment_types
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointment types" ON appointment_types
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own appointment types" ON appointment_types
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_appointment_types_user_id ON appointment_types(user_id);
CREATE INDEX IF NOT EXISTS idx_appointment_types_appointment_id ON appointment_types(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_types_code ON appointment_types(code);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_appointment_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointment_types_updated_at
    BEFORE UPDATE ON appointment_types
    FOR EACH ROW
    EXECUTE FUNCTION update_appointment_types_updated_at();

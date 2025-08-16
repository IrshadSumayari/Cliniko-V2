-- Fix RLS policies to allow service role access
-- Run this in your Supabase SQL editor

-- Drop the existing restrictive RLS policy for pms_api_keys
DROP POLICY IF EXISTS "Users can manage own API keys" ON pms_api_keys;

-- Create a new policy that allows service role access
CREATE POLICY "Service role can manage all API keys" ON pms_api_keys
    FOR ALL USING (true);

-- Also fix the other tables that the service role needs to access
DROP POLICY IF EXISTS "Users can manage own patients" ON patients;
CREATE POLICY "Service role can manage all patients" ON patients
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can manage own appointments" ON appointments;
CREATE POLICY "Service role can manage all appointments" ON appointments
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can view own sync logs" ON sync_logs;
CREATE POLICY "Service role can manage all sync logs" ON sync_logs
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can view own sync errors" ON sync_errors;
CREATE POLICY "Service role can manage all sync errors" ON sync_errors
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can manage own sync controls" ON sync_controls;
CREATE POLICY "Service role can manage all sync controls" ON sync_controls
    FOR ALL USING (true);

-- Keep the users table policies as they are for user authentication
-- The service role will still be able to access users table due to GRANT ALL permissions

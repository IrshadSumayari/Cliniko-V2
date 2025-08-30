import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { config } from '@/lib/config';

export function createAdminClient() {
  // Use environment variables if available, otherwise fall back to config
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || config.supabase.url;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || config.supabase.serviceRoleKey;

  console.log('[SERVER-ADMIN] Creating admin client with:', {
    url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'undefined',
    hasServiceKey: !!supabaseServiceKey,
  });

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration. Please check your environment variables.');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function encryptApiKey(apiKey: string): string {
  const algorithm = 'aes-256-ctr';
  const secretKey = process.env.ENCRYPTION_SECRET || config.encryption.secret;

  // Create a hash of the secret key to ensure it's 32 bytes
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptApiKey(encryptedData: string): string {
  const algorithm = 'aes-256-ctr';
  const secretKey = process.env.ENCRYPTION_SECRET || config.encryption.secret;

  // Create a hash of the secret key to ensure it's 32 bytes
  const key = crypto.createHash('sha256').update(secretKey).digest();

  const [ivHex, encrypted] = encryptedData.split(':');
  if (!ivHex || !encrypted) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(ivHex, 'hex');

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export async function storeEncryptedApiKey(
  userId: string,
  pmsType: 'cliniko' | 'halaxy' | 'nookal',
  apiKey: string,
  apiUrl?: string,
  clinicId?: string
) {
  try {
    console.log('[SERVER] Starting API key encryption...');
    console.log('[SERVER] User ID:', userId);
    console.log('[SERVER] PMS Type:', pmsType);
    console.log('[SERVER] API URL:', apiUrl);
    console.log('[SERVER] Clinic ID:', clinicId);

    const supabase = createAdminClient();
    console.log('[SERVER] Admin client created successfully');

    const encryptedKey = encryptApiKey(apiKey);
    console.log('[SERVER] API key encrypted successfully');

    // Now let's check if the pms_api_keys table exists and test a simple query
    console.log('[SERVER] Testing pms_api_keys table access...');
    const { data: testData, error: testError } = await supabase
      .from('pms_api_keys')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('[SERVER] Table access test failed:', testError);
      throw new Error(`Table access failed: ${testError.message}`);
    }
    console.log('[SERVER] Table access test successful');

    console.log('[SERVER] Attempting to insert/update API key with data:', {
      user_id: userId,
      pms_type: pmsType,
      api_key_encrypted: encryptedKey ? `${encryptedKey.substring(0, 20)}...` : 'missing',
      api_url: apiUrl,
      clinic_id: clinicId,
      is_active: true,
    });

    const { data, error } = await supabase
      .from('pms_api_keys')
      .upsert(
        {
          user_id: userId, // This is now the correct user ID from the users table
          pms_type: pmsType,
          api_key_encrypted: encryptedKey,
          api_url: apiUrl,
          clinic_id: clinicId,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,pms_type',
        }
      )
      .select();

    if (error) {
      console.error('[SERVER] Database error storing API key:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(`Database error: ${error.message}`);
    }

    console.log('[SERVER] API key stored successfully in database:', data);
    return true;
  } catch (error) {
    console.error('[SERVER] Error in storeEncryptedApiKey:', error);
    throw new Error(
      `Failed to encrypt and store API key: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

export async function getDecryptedApiKey(userId: string, pmsType: string) {
  try {
    const supabase = createAdminClient();

    const { data: keyData, error: fetchError } = await supabase
      .from('pms_api_keys')
      .select('api_key_encrypted, api_url, clinic_id')
      .eq('user_id', userId)
      .eq('pms_type', pmsType)
      .eq('is_active', true)
      .single();

    if (fetchError || !keyData) {
      return null;
    }

    const decryptedKey = decryptApiKey(keyData.api_key_encrypted);

    return {
      apiKey: decryptedKey,
      apiUrl: keyData.api_url,
      clinicId: keyData.clinic_id,
    };
  } catch (error) {
    console.error('Error in getDecryptedApiKey:', error);
    return null;
  }
}

export async function storeAppointmentTypes(
  userId: string,
  pmsType: 'cliniko' | 'halaxy' | 'nookal',
  appointmentTypes: Array<{
    appointment_id: string;
    appointment_name: string;
    code: string;
  }>
) {
  try {
    console.log('[SERVER] Starting appointment types storage...');
    const supabase = createAdminClient();

    // Use upsert instead of delete + insert to handle duplicates gracefully
    const appointmentTypesData = appointmentTypes.map((type) => ({
      user_id: userId,
      appointment_id: type.appointment_id,
      appointment_name: type.appointment_name,
      code: type.code,
      pms_type: pmsType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Upsert will insert new records or update existing ones based on the unique constraint
    const { data, error } = await supabase
      .from('appointment_types')
      .upsert(appointmentTypesData, {
        onConflict: 'user_id,appointment_id,pms_type', // Specify the conflict resolution
        ignoreDuplicates: false, // Update existing records instead of ignoring
      })
      .select();

    if (error) {
      console.error('[SERVER] Database error storing appointment types:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(
      `[SERVER] Successfully stored/updated ${data.length} appointment types in database`
    );
    return data;
  } catch (error) {
    console.error('[SERVER] Error in storeAppointmentTypes:', error);
    throw new Error(
      `Failed to store appointment types: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

export async function storeAppointment(appointmentData: {
  user_id: string;
  patient_id: number;
  pms_appointment_id: number;
  pms_type: string;
  appointment_date: string;
  appointment_type?: string;
  status: string;
  practitioner_name?: string;
  notes?: string;
  duration_minutes?: number;
  is_completed?: boolean;
}) {
  try {
    console.log('[SERVER] Starting appointment storage...');
    console.log('[SERVER] Appointment data:', JSON.stringify(appointmentData, null, 2));

    const supabase = createAdminClient();
    console.log('[SERVER] Admin client created successfully');

    // First, let's test if the appointments table is accessible
    console.log('[SERVER] Testing appointments table access...');
    const { data: testData, error: testError } = await supabase
      .from('appointments')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('[SERVER] Table access test failed:', testError);
      throw new Error(`Table access failed: ${testError.message}`);
    }
    console.log('[SERVER] Table access test successful');

    // Now try to store the appointment
    console.log('[SERVER] Attempting to store appointment...');
    const { data, error } = await supabase
      .from('appointments')
      .upsert(appointmentData, {
        onConflict: 'user_id,pms_appointment_id,pms_type',
      })
      .select();

    if (error) {
      console.error('[SERVER] Error storing appointment:', error);
      throw new Error(`Failed to store appointment: ${error.message}`);
    }

    console.log('[SERVER] Appointment stored successfully:', data);
    return data;
  } catch (error) {
    console.error('[SERVER] Error in storeAppointment:', error);
    throw error;
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server-admin';

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Create admin client to verify the token and get user info
    const supabase = createAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // First, check if user exists in users table
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error checking user record:', userError);
      return NextResponse.json({ error: 'Failed to verify user record' }, { status: 500 });
    }

    let userId = user.id;
    if (userRecord) {
      userId = userRecord.id;
    }

    // Fetch PMS credentials from the pms_api_keys table (where the data actually is)
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('pms_api_keys')
      .select('pms_type, api_key_encrypted, api_url, clinic_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (apiKeyError && apiKeyError.code !== 'PGRST116') {
      console.error('Error fetching PMS API keys:', apiKeyError);
      return NextResponse.json({ error: 'Failed to fetch PMS credentials' }, { status: 500 });
    }

    // Also check profiles table for PMS connection status
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('pms_type, pms_connected, pms_last_sync')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching profile PMS data:', profileError);
    }

    // Return the credentials if they exist
    if (apiKeyData) {
      return NextResponse.json({
        pms_type: apiKeyData.pms_type,
        api_key: apiKeyData.api_key_encrypted, // Note: This is encrypted
        api_url: apiKeyData.api_url,
        clinic_id: apiKeyData.clinic_id,
        pms_connected: profileData?.pms_connected || false,
        pms_last_sync: profileData?.pms_last_sync || null,
      });
    }

    // If no API key data, return profile PMS data if available
    if (profileData) {
      return NextResponse.json({
        pms_type: profileData.pms_type || null,
        api_key: null,
        api_url: null,
        clinic_id: null,
        pms_connected: profileData.pms_connected || false,
        pms_last_sync: profileData.pms_last_sync || null,
      });
    }

    // Return empty data if nothing found
    return NextResponse.json({
      pms_type: null,
      api_key: null,
      api_url: null,
      clinic_id: null,
      pms_connected: false,
      pms_last_sync: null,
    });
  } catch (error) {
    console.error('PMS credentials GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

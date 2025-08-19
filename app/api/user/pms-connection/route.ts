import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server-admin';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { pms_type, api_key } = body;

    // Validate required fields
    if (!pms_type || !api_key) {
      return NextResponse.json(
        {
          error: 'PMS type and API key are required',
        },
        { status: 400 }
      );
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

    // Update user profile with PMS connection info
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        pms_type,
        pms_connected: true,
        pms_last_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile with PMS connection:', updateError);
      return NextResponse.json({ error: 'Failed to save PMS connection' }, { status: 500 });
    }

    // Store the API key in pms_api_keys table (encrypted)
    const { error: apiKeyError } = await supabase.from('pms_api_keys').upsert(
      {
        user_id: userId,
        pms_type: pms_type.toLowerCase(),
        api_key_encrypted: api_key, // This should be encrypted by the client or we need to encrypt it here
        api_url: '', // You might want to get this from the request
        clinic_id: null,
        is_active: true,
        last_sync_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,pms_type',
      }
    );

    if (apiKeyError) {
      console.error('Error storing API key:', apiKeyError);
      // Don't fail the request if API key storage fails
      // You might want to handle this differently based on your security requirements
    }

    return NextResponse.json({
      message: 'PMS connection saved successfully',
      profile: updatedProfile,
    });
  } catch (error) {
    console.error('PMS connection POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    // Remove PMS connection from profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        pms_type: null,
        pms_connected: false,
        pms_last_sync: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error removing PMS connection:', updateError);
      return NextResponse.json({ error: 'Failed to remove PMS connection' }, { status: 500 });
    }

    // Remove stored API key from pms_api_keys table
    const { error: deleteApiKeyError } = await supabase
      .from('pms_api_keys')
      .delete()
      .eq('user_id', userId);

    if (deleteApiKeyError) {
      console.error('Error removing API key:', deleteApiKeyError);
      // Don't fail the request if API key removal fails
    }

    return NextResponse.json({
      message: 'PMS connection removed successfully',
      profile: updatedProfile,
    });
  } catch (error) {
    console.error('PMS connection DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

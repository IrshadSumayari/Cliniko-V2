import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getDecryptedApiKey } from '@/lib/supabase/server-admin';
import { PMSApiFactory } from '@/lib/pms/factory';
import type { PMSType } from '@/lib/pms/types';

export async function POST(request: NextRequest) {
  try {
    const { userId, pmsType } = await request.json();

    if (!userId || !pmsType) {
      return NextResponse.json({ error: 'Missing userId or pmsType' }, { status: 400 });
    }

    // Get decrypted API credentials
    const credentials = await getDecryptedApiKey(userId, pmsType);
    if (!credentials) {
      return NextResponse.json({ error: 'No API credentials found' }, { status: 404 });
    }

    // Create PMS API instance and test connection
    const api = PMSApiFactory.createApi(pmsType as PMSType, credentials);
    const isConnected = await api.testConnection();

    // Update test status in database
    const supabase = createAdminClient();
    await supabase
      .from('pms_api_keys')
      .update({
        last_tested_at: new Date().toISOString(),
        test_status: isConnected ? 'success' : 'failed',
        test_error_message: isConnected ? null : 'Connection test failed',
      })
      .eq('user_id', userId)
      .eq('pms_type', pmsType);

    return NextResponse.json({
      success: isConnected,
      message: isConnected ? 'Connection successful' : 'Connection failed',
    });
  } catch (error) {
    console.error('PMS connection test error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

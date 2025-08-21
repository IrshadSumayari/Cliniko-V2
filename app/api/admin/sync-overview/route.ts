import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server-admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    // Get all sync logs with user information
    const { data: syncLogs, error: logsError } = await supabase
      .from('sync_logs')
      .select(
        `
        *,
        users!inner(email, clinic_name)
      `
      )
      .order('started_at', { ascending: false })
      .limit(100);

    if (logsError) {
      return NextResponse.json({ error: 'Failed to fetch sync logs' }, { status: 500 });
    }

    // Get all sync controls with user information
    const { data: syncControls, error: controlsError } = await supabase.from('sync_controls')
      .select(`
        *,
        users!inner(email, clinic_name)
      `);

    if (controlsError) {
      return NextResponse.json({ error: 'Failed to fetch sync controls' }, { status: 500 });
    }

    // Get sync errors
    const { data: syncErrors, error: errorsError } = await supabase
      .from('sync_errors')
      .select(
        `
        *,
        users!inner(email, clinic_name)
      `
      )
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (errorsError) {
      return NextResponse.json({ error: 'Failed to fetch sync errors' }, { status: 500 });
    }

    return NextResponse.json({
      syncLogs: syncLogs || [],
      syncControls: syncControls || [],
      syncErrors: syncErrors || [],
    });
  } catch (error) {
    console.error('Admin sync overview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

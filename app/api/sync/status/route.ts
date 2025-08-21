import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const pmsType = searchParams.get('pmsType');
    const syncId = searchParams.get('syncId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // If syncId is provided, get specific sync status
    if (syncId) {
      const { data: syncLog, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('id', syncId)
        .eq('user_id', userId)
        .single();

      if (error || !syncLog) {
        return NextResponse.json({ error: 'Sync log not found' }, { status: 404 });
      }

      return NextResponse.json({ syncLog });
    }

    // Get recent sync logs for user
    let query = supabase
      .from('sync_logs')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(10);

    if (pmsType) {
      query = query.eq('pms_type', pmsType);
    }

    const { data: syncLogs, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch sync logs' }, { status: 500 });
    }

    // Get sync controls
    const { data: syncControls } = await supabase
      .from('sync_controls')
      .select('*')
      .eq('user_id', userId);

    return NextResponse.json({
      syncLogs: syncLogs || [],
      syncControls: syncControls || [],
    });
  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

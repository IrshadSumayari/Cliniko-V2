import { type NextRequest, NextResponse } from 'next/server';
import { getGlobalScheduler } from '@/lib/sync/scheduler';
import { createAdminClient } from '@/lib/supabase/server-admin';
import type { PMSType } from '@/lib/pms/types';

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Get user from token
    const { data: { user }, error: authError } = await createAdminClient().auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token.' },
        { status: 401 }
      );
    }

    // Get user data from database
    const { data: userData, error: userError } = await createAdminClient()
      .from('users')
      .select('id, pms_type')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Failed to fetch user data.' },
        { status: 500 }
      );
    }

    const { action } = await request.json();
    const userId = userData.id;
    const pmsType = userData.pms_type as PMSType;

    if (!action) {
      return NextResponse.json({ error: 'Missing action field' }, { status: 400 });
    }

    const scheduler = getGlobalScheduler();

    switch (action) {
      case 'pause':
        await scheduler.pauseUserSync(userId, pmsType as PMSType);
        return NextResponse.json({ success: true, message: 'Sync paused' });

      case 'resume':
        await scheduler.resumeUserSync(userId, pmsType as PMSType);
        return NextResponse.json({ success: true, message: 'Sync resumed' });

      case 'force_full':
        const syncId = await scheduler.forceFullSync(userId, pmsType as PMSType);
        return NextResponse.json({
          success: true,
          syncId,
          message: 'Full sync started',
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Sync control error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server-admin';
import { NotificationService } from '@/lib/notification-service';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication and get userId
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const {
      data: { user },
      error: authError,
    } = await createAdminClient().auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const { data: userRecord, error: userError } = await createAdminClient()
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();
    if (userError || !userRecord) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }
    const userId = userRecord.id;

    const notificationService = NotificationService.getInstance();
    const preferences = await notificationService.getUserEmailPreferences(userId);

    return NextResponse.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error('Error getting email preferences:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify authentication and get userId
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const {
      data: { user },
      error: authError,
    } = await createAdminClient().auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const { data: userRecord, error: userError } = await createAdminClient()
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();
    if (userError || !userRecord) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }
    const userId = userRecord.id;

    const body = await request.json();
    const { enableEmailAlerts, sessionQuotaThreshold, customEmail } = body;

    // Validate input
    if (typeof enableEmailAlerts !== 'boolean') {
      return NextResponse.json(
        {
          error: 'enableEmailAlerts must be a boolean',
        },
        { status: 400 }
      );
    }

    if (
      typeof sessionQuotaThreshold !== 'number' ||
      sessionQuotaThreshold < 1 ||
      sessionQuotaThreshold > 5
    ) {
      return NextResponse.json(
        {
          error: 'sessionQuotaThreshold must be a number between 1 and 5',
        },
        { status: 400 }
      );
    }

    if (customEmail && typeof customEmail !== 'string') {
      return NextResponse.json(
        {
          error: 'customEmail must be a string',
        },
        { status: 400 }
      );
    }

    const notificationService = NotificationService.getInstance();

    // Update all email preferences
    const success = await notificationService.updateUserEmailPreferences(
      userId,
      enableEmailAlerts,
      sessionQuotaThreshold,
      customEmail
    );

    if (!success) {
      return NextResponse.json(
        {
          error: 'Failed to update email preferences',
        },
        { status: 500 }
      );
    }

    // Get updated preferences
    const preferences = await notificationService.getUserEmailPreferences(userId);

    return NextResponse.json({
      success: true,
      message: 'Email preferences updated successfully',
      data: preferences,
    });
  } catch (error) {
    console.error('Error updating email preferences:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

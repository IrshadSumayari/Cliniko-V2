import { NextRequest, NextResponse } from 'next/server';
import EmailService from '@/lib/email-service';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';

// Initialize Supabase with environment variables
const supabaseUrl = config.supabase.url;
const supabaseKey = config.supabase.serviceRoleKey;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration. Please check your environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const url = new URL(request.url);
    const clinicId = url.searchParams.get('clinicId');
    const timeframe = url.searchParams.get('timeframe') || '24h';

    const emailService = EmailService.getInstance();

    // Get email statistics
    const stats = await emailService.getEmailStats(clinicId || undefined);

    // Get recent email failures
    const { data: recentFailures, error: failuresError } = await supabase
      .from('email_notifications')
      .select('*')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(10);

    if (failuresError) {
      console.error('Error fetching recent failures:', failuresError);
    }

    // Get system alerts
    const { data: systemAlerts, error: alertsError } = await supabase
      .from('system_alerts')
      .select('*')
      .eq('type', 'email_failure')
      .order('created_at', { ascending: false })
      .limit(5);

    if (alertsError) {
      console.error('Error fetching system alerts:', alertsError);
    }

    // Calculate success rate
    const successRate = stats.total > 0 ? (stats.sent / stats.total) * 100 : 100;

    // Get email volume over time
    let timeFilter = '24 hours';
    if (timeframe === '7d') timeFilter = '7 days';
    if (timeframe === '30d') timeFilter = '30 days';

    const { data: emailVolume, error: volumeError } = await supabase
      .from('email_notifications')
      .select('created_at, status')
      .gte('created_at', new Date(Date.now() - getTimeframeMs(timeframe)).toISOString())
      .order('created_at', { ascending: true });

    if (volumeError) {
      console.error('Error fetching email volume:', volumeError);
    }

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          ...stats,
          successRate: Math.round(successRate * 100) / 100,
        },
        recentFailures: recentFailures || [],
        systemAlerts: systemAlerts || [],
        emailVolume: emailVolume || [],
        timeframe,
      },
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

function getTimeframeMs(timeframe: string): number {
  switch (timeframe) {
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000; // 24h
  }
}

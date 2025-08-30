import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/notification-service';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase with fallback values for build time
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qolninjhutvsxjbvlhzl.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvbG5pbmpodXR2c3hqYnZsaHpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImiYXQiOjE3NTU0MjU1ODcsImV4cCI6MjA3MTAwMTU4N30.FbL9xNZhGvqX4x_Vaq7FwwtOnyzLq_l27nGOwJqm_Bg';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { type, patientId, clinicId, reason } = body;

    const notificationService = NotificationService.getInstance();

    switch (type) {
      case 'quota_alert':
        if (!patientId || !clinicId) {
          return NextResponse.json(
            {
              error: 'Missing required fields: patientId, clinicId',
            },
            { status: 400 }
          );
        }

        // Get patient data (this should come from your database)
        const patient = {
          name: 'Patient Name', // Fetch from database
          epc_number: '12345',
          sessionsRemaining: 2,
          totalSessions: 10,
          physio: 'Dr. Smith',
        };

        const clinic = {
          name: 'Clinic Name', // Fetch from database
          email: 'irshad.sumayari@ecoedgeai.com',
        };

        await notificationService.sendQuotaAlert(patient, clinic, {
          emailNotifications: true,
          quotaThreshold: 2,
          notifyOnPending: true,
          notifyOnQuota: true,
        });

        return NextResponse.json({
          success: true,
          message: 'Quota alert sent successfully',
        });

      case 'pending_status':
        if (!patientId || !clinicId) {
          return NextResponse.json(
            {
              error: 'Missing required fields: patientId, clinicId',
            },
            { status: 400 }
          );
        }

        // Get patient data
        const pendingPatient = {
          name: 'Patient Name', // Fetch from database
          epc_number: '12345',
          sessionsRemaining: 5,
          totalSessions: 10,
          physio: 'Dr. Smith',
        };

        await notificationService.sendPendingStatusAlert(pendingPatient, clinicId, reason);

        return NextResponse.json({
          success: true,
          message: 'Pending status alert sent successfully',
        });

      case 'test':
        const { email } = body;
        if (!email) {
          return NextResponse.json(
            {
              error: 'Email address required for test notification',
            },
            { status: 400 }
          );
        }

        const testResult = await notificationService.sendTestNotification(email);

        if (testResult) {
          return NextResponse.json({
            success: true,
            message: 'Test notification sent successfully',
          });
        } else {
          return NextResponse.json(
            {
              error: 'Failed to send test notification',
            },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json(
          {
            error: 'Invalid notification type',
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in notification API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

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

    // Get notification stats
    const notificationService = NotificationService.getInstance();

    // Process any pending notifications
    await notificationService.processNotifications();

    return NextResponse.json({
      success: true,
      message: 'Notification processing completed',
    });
  } catch (error) {
    console.error('Error processing notifications:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

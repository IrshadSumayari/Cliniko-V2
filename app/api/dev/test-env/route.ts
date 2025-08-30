import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    // Check environment variables (without exposing sensitive values)
    const envCheck = {
      // Supabase
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,

      // Email
      sendgridApiKey: !!process.env.SENDGRID_API_KEY,
      fromEmail: !!process.env.FROM_EMAIL,
      adminEmail: !!process.env.ADMIN_EMAIL,

      // App
      appUrl: !!process.env.NEXT_PUBLIC_APP_URL,

      // Encryption
      encryptionSecret: !!process.env.ENCRYPTION_SECRET,

      // Config values
      configSupabaseUrl: !!config.supabase.url,
      configSupabaseServiceKey: !!config.supabase.serviceRoleKey,
      configSendgridApiKey: !!config.sendgrid.apiKey,
      configFromEmail: !!config.sendgrid.fromEmail,
      configAdminEmail: !!config.sendgrid.adminEmail,
    };

    // Check if required tables exist
    const { createAdminClient } = await import('@/lib/supabase/server-admin');
    const supabase = createAdminClient();

    let tableCheck: {
      emailNotifications?: boolean;
      notificationLogs?: boolean;
      users?: boolean;
      patients?: boolean;
    } = {};
    try {
      // Test email_notifications table
      const { error: emailError } = await supabase
        .from('email_notifications')
        .select('id')
        .limit(1);
      tableCheck.emailNotifications = !emailError;
    } catch (e) {
      tableCheck.emailNotifications = false;
    }

    try {
      // Test notification_logs table
      const { error: logsError } = await supabase.from('notification_logs').select('id').limit(1);
      tableCheck.notificationLogs = !logsError;
    } catch (e) {
      tableCheck.notificationLogs = false;
    }

    try {
      // Test users table
      const { error: usersError } = await supabase.from('users').select('id').limit(1);
      tableCheck.users = !usersError;
    } catch (e) {
      tableCheck.users = false;
    }

    try {
      // Test patients table
      const { error: patientsError } = await supabase.from('patients').select('id').limit(1);
      tableCheck.patients = !patientsError;
    } catch (e) {
      tableCheck.patients = false;
    }

    return NextResponse.json({
      success: true,
      environment: envCheck,
      tables: tableCheck,
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
    });
  } catch (error) {
    console.error('Environment test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

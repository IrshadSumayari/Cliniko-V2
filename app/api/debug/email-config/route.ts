import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const envCheck = {
      SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
      FROM_EMAIL: !!process.env.FROM_EMAIL,
      ADMIN_EMAIL: !!process.env.ADMIN_EMAIL,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    // Check config values
    const configCheck = {
      sendgrid: {
        apiKey: !!config.sendgrid.apiKey,
        fromEmail: !!config.sendgrid.fromEmail,
        adminEmail: !!config.sendgrid.adminEmail,
      },
      supabase: {
        url: !!config.supabase.url,
        serviceRoleKey: !!config.supabase.serviceRoleKey,
      },
    };

    // Check SendGrid API key format (should start with SG.)
    const sendGridKeyFormat = process.env.SENDGRID_API_KEY?.startsWith('SG.') || false;

    // Check FROM_EMAIL format
    const fromEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.FROM_EMAIL || '');

    return NextResponse.json({
      success: true,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      checks: {
        environmentVariables: envCheck,
        configValues: configCheck,
        sendGridKeyFormat,
        fromEmailFormat,
      },
      recommendations: {
        missingEnvVars: Object.entries(envCheck)
          .filter(([_, exists]) => !exists)
          .map(([key]) => key),
        issues: [
          ...(!sendGridKeyFormat ? ['SendGrid API key format appears invalid (should start with SG.)'] : []),
          ...(!fromEmailFormat ? ['FROM_EMAIL format appears invalid'] : []),
        ],
      },
    });
  } catch (error) {
    console.error('Email config debug error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check email configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


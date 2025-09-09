import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/lib/notification-service';
import { EmailService } from '@/lib/email-service';
import { config } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, testType = 'full' } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      );
    }

    console.log('🧪 Starting email test for:', email);
    console.log('🧪 Test type:', testType);

    const results = {
      timestamp: new Date().toISOString(),
      email,
      testType,
      checks: {
        environmentVariables: {
          SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
          FROM_EMAIL: !!process.env.FROM_EMAIL,
          ADMIN_EMAIL: !!process.env.ADMIN_EMAIL,
        },
        configValues: {
          sendgrid: {
            apiKey: !!config.sendgrid.apiKey,
            fromEmail: !!config.sendgrid.fromEmail,
            adminEmail: !!config.sendgrid.adminEmail,
          },
        },
        sendGridKeyFormat: process.env.SENDGRID_API_KEY?.startsWith('SG.') || false,
        fromEmailFormat: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.FROM_EMAIL || ''),
      },
      tests: {} as any,
    };

    // Test 1: Basic email service initialization
    try {
      const emailService = EmailService.getInstance();
      results.tests.emailServiceInit = { success: true, message: 'Email service initialized' };
    } catch (error) {
      results.tests.emailServiceInit = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }

    // Test 2: Notification service initialization
    try {
      const notificationService = NotificationService.getInstance();
      results.tests.notificationServiceInit = { success: true, message: 'Notification service initialized' };
    } catch (error) {
      results.tests.notificationServiceInit = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }

    // Test 3: Send test email (if full test)
    if (testType === 'full') {
      try {
        const notificationService = NotificationService.getInstance();
        const testResult = await notificationService.sendTestNotification(email);
        results.tests.testEmailSend = { 
          success: testResult, 
          message: testResult ? 'Test email sent successfully' : 'Test email failed to send' 
        };
      } catch (error) {
        results.tests.testEmailSend = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    }

    // Test 4: Database connectivity (check if email_notifications table exists)
    try {
      const emailService = EmailService.getInstance();
      const stats = await emailService.getEmailStats();
      results.tests.databaseConnectivity = { 
        success: true, 
        message: 'Database connected successfully',
        stats 
      };
    } catch (error) {
      results.tests.databaseConnectivity = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }

    // Determine overall success
    const allTestsPassed = Object.values(results.tests).every((test: any) => test.success);
    results.overallSuccess = allTestsPassed;

    return NextResponse.json({
      success: true,
      results,
    });

  } catch (error) {
    console.error('Email test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run email tests',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Quick configuration check
    const config = {
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      sendGridConfigured: !!process.env.SENDGRID_API_KEY,
      fromEmailConfigured: !!process.env.FROM_EMAIL,
      adminEmailConfigured: !!process.env.ADMIN_EMAIL,
      sendGridKeyFormat: process.env.SENDGRID_API_KEY?.startsWith('SG.') || false,
      fromEmailFormat: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.FROM_EMAIL || ''),
    };

    return NextResponse.json({
      success: true,
      config,
      instructions: {
        testEmail: 'POST to this endpoint with { "email": "test@example.com", "testType": "full" }',
        quickCheck: 'GET this endpoint for quick configuration check',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check email configuration',
      },
      { status: 500 }
    );
  }
}


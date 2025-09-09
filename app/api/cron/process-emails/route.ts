import { NextRequest, NextResponse } from 'next/server';
import { EmailService } from '@/lib/email-service';
import { config } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const cronSecret = request.nextUrl.searchParams.get('secret');
    if (cronSecret !== config.cron.secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Cron job: Processing pending emails...');
    
    const emailService = EmailService.getInstance();
    
    // Process the retry queue (this will handle pending emails too)
    await emailService.processRetryQueue();
    
    // Get updated stats
    const stats = await emailService.getEmailStats();
    
    console.log('✅ Cron job completed. Email stats:', stats);
    
    return NextResponse.json({
      success: true,
      message: 'Email processing cron job completed',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in email processing cron job:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process emails in cron job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


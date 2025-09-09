import { NextRequest, NextResponse } from 'next/server';
import { EmailService } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Processing pending emails...');
    
    const emailService = EmailService.getInstance();
    
    // Process the retry queue (this will handle pending emails too)
    await emailService.processRetryQueue();
    
    // Get updated stats
    const stats = await emailService.getEmailStats();
    
    return NextResponse.json({
      success: true,
      message: 'Pending emails processing completed',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing pending emails:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process pending emails',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const emailService = EmailService.getInstance();
    const stats = await emailService.getEmailStats();
    
    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
      instructions: {
        processEmails: 'POST to this endpoint to process all pending emails',
        checkStats: 'GET this endpoint to see current email statistics',
      },
    });
  } catch (error) {
    console.error('Error getting email stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get email statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


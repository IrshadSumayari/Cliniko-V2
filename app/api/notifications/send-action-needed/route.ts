import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server-admin';
import { supabase } from '@/integrations/supabase/client';

interface ActionNeededPatient {
  id: string;
  first_name: string;
  last_name: string;
  patient_type: string;
  total_sessions: number;
  sessions_used: number;
  remaining_sessions: number;
}

interface NotificationData {
  patientId: string;
  patientName: string;
  patientType: string;
  remainingSessions: number;
  clinicEmail: string;
  clinicName: string;
}

export async function POST(req: NextRequest) {
  try {
    const { patientIds, clinicId } = await req.json();

    if (!patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
      return NextResponse.json(
        { error: 'Patient IDs array is required' },
        { status: 400 }
      );
    }

    if (!clinicId) {
      return NextResponse.json(
        { error: 'Clinic ID is required' },
        { status: 400 }
      );
    }

    // Get clinic information
    const { data: clinic, error: clinicError } = await supabase
      .from('users')
      .select('email, full_name, clinic_name')
      .eq('id', clinicId)
      .single();

    if (clinicError || !clinic) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      );
    }

    // Get patients needing action
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select(`
        id,
        first_name,
        last_name,
        patient_type,
        total_sessions,
        sessions_used
      `)
      .eq('user_id', clinicId)
      .in('id', patientIds)
      .eq('is_active', true);

    if (patientsError) {
      return NextResponse.json(
        { error: 'Failed to fetch patients' },
        { status: 500 }
      );
    }

    if (!patients || patients.length === 0) {
      return NextResponse.json(
        { error: 'No patients found' },
        { status: 404 }
      );
    }

    // Process notifications
    const notificationResults = [];
    let successCount = 0;
    let failureCount = 0;

    for (const patient of patients) {
      try {
        const remainingSessions = patient.total_sessions - patient.sessions_used;
        
        const notificationData: NotificationData = {
          patientId: patient.id,
          patientName: `${patient.first_name} ${patient.last_name}`,
          patientType: patient.patient_type,
          remainingSessions,
          clinicEmail: clinic.email,
          clinicName: clinic.clinic_name || clinic.full_name || 'Clinic'
        };

        // Send notification with retry logic
        const notificationResult = await sendNotificationWithRetry(notificationData);
        
        if (notificationResult.success) {
          successCount++;
          
          // Log successful notification
          await logNotification(patient.id, clinicId, 'sent', notificationData);
          
          notificationResults.push({
            patientId: patient.id,
            success: true,
            message: 'Notification sent successfully'
          });
        } else {
          failureCount++;
          
          // Log failed notification
          await logNotification(patient.id, clinicId, 'failed', notificationData, notificationResult.error);
          
          notificationResults.push({
            patientId: patient.id,
            success: false,
            error: notificationResult.error
          });
        }

      } catch (error) {
        failureCount++;
        console.error(`Error processing notification for patient ${patient.id}:`, error);
        
        notificationResults.push({
          patientId: patient.id,
          success: false,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Notifications processed: ${successCount} sent, ${failureCount} failed`,
      summary: {
        total: patients.length,
        successful: successCount,
        failed: failureCount
      },
      results: notificationResults
    });

  } catch (error) {
    console.error('Notification send error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to send notifications'
    }, { status: 500 });
  }
}

// Send notification with retry logic (3 attempts with exponential backoff)
async function sendNotificationWithRetry(notificationData: NotificationData, attempt = 1): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await sendEmailNotification(notificationData);
    
    if (result.success) {
      return { success: true };
    }
    
    // If failed and we haven't reached max attempts, retry
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
      
      console.log(`Notification failed for ${notificationData.patientName}, retrying in ${delay}ms (attempt ${attempt + 1}/3)`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendNotificationWithRetry(notificationData, attempt + 1);
    }
    
    return { success: false, error: result.error };
    
  } catch (error) {
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendNotificationWithRetry(notificationData, attempt + 1);
    }
    
    return { success: false, error: error.message };
  }
}

// Send email notification
async function sendEmailNotification(notificationData: NotificationData): Promise<{ success: boolean; error?: string }> {
  try {
    // In production, you would integrate with your email service (SendGrid, AWS SES, etc.)
    // For now, we'll simulate the email sending
    
    const subject = `⚠️ ${notificationData.remainingSessions} ${notificationData.patientType} session(s) left for ${notificationData.patientName}`;
    
    const body = `
Dear ${notificationData.clinicName},

This is an automated alert regarding patient ${notificationData.patientName}.

⚠️ ACTION NEEDED: ${notificationData.patientName} has ${notificationData.remainingSessions} ${notificationData.patientType} session(s) remaining.

Please take the following action:
${notificationData.remainingSessions === 0 
  ? '🚨 IMMEDIATE: Patient has exhausted their quota. Please request renewal immediately to avoid unpaid sessions.'
  : notificationData.remainingSessions === 1
    ? '⚠️ URGENT: Patient has only 1 session left. Please request renewal soon.'
    : '⚠️ WARNING: Patient is running low on sessions. Consider requesting renewal.'
}

Patient Details:
- Name: ${notificationData.patientName}
- Type: ${notificationData.patientType}
- Sessions Used: ${notificationData.totalSessions - notificationData.remainingSessions}
- Total Quota: ${notificationData.totalSessions}
- Sessions Remaining: ${notificationData.remainingSessions}

Please log into your dashboard to review this patient's status and take appropriate action.

Best regards,
PhysioFlow Team

---
This is an automated notification. Please do not reply to this email.
    `;

    // Simulate email sending (replace with actual email service)
    console.log('📧 SENDING EMAIL:');
    console.log('To:', notificationData.clinicEmail);
    console.log('Subject:', subject);
    console.log('Body:', body);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate 95% success rate
    if (Math.random() < 0.95) {
      console.log('✅ Email sent successfully');
      return { success: true };
    } else {
      console.log('❌ Email failed (simulated)');
      return { success: false, error: 'Email service temporarily unavailable' };
    }

  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
}

// Log notification attempt
async function logNotification(
  patientId: string, 
  clinicId: string, 
  status: 'sent' | 'failed', 
  notificationData: NotificationData, 
  error?: string
) {
  try {
    await supabase
      .from('notification_logs')
      .insert({
        patient_id: patientId,
        user_id: clinicId,
        notification_type: 'action_needed',
        status,
        recipient_email: notificationData.clinicEmail,
        subject: `⚠️ ${notificationData.remainingSessions} ${notificationData.patientType} session(s) left for ${notificationData.patientName}`,
        error_details: error ? { error } : null,
        sent_at: new Date().toISOString()
      });
  } catch (logError) {
    console.error('Failed to log notification:', logError);
  }
}

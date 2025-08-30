import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server-admin';
import EmailService from '@/lib/email-service';

interface ActionNeededPatient {
  id: string;
  first_name: string;
  last_name: string;
  patient_type: string;
  quota: number;
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
  clinicId: string;
}

export async function POST(req: NextRequest) {
  try {
    const { patientIds, clinicId, triggerOnboarding, userId } = await req.json();

    // Handle onboarding trigger case
    if (triggerOnboarding && userId) {
      console.log(`🚀 Onboarding trigger: Sending Action Needed notifications for user ${userId}`);

      // Get user information - check for custom email first, then default email
      const supabase = createAdminClient();
      const { data: user, error: userError } = await supabase
        .from('users')
        .select(
          `
          id,
          email,
          full_name,
          custom_email
        `
        )
        .eq('auth_user_id', userId)
        .single();

      if (userError || !user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Use custom email if available, otherwise use default email
      const userEmail = user.custom_email || user.email;
      const userName = user.full_name || 'Clinic';

      console.log(
        `📧 Sending notifications to: ${userEmail} (${user.custom_email ? 'custom' : 'default'} email)`
      );

      // Get ALL patients for this user that need action (1-2 sessions remaining)
      const { data: allPatients, error: allPatientsError } = await supabase
        .from('patients')
        .select(
          `
          id,
          first_name,
          last_name,
          patient_type,
          quota,
          sessions_used
        `
        )
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('status', 'active');

      if (allPatientsError) {
        return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 });
      }

      if (!allPatients || allPatients.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No patients found for this user',
          summary: { total: 0, successful: 0, failed: 0 },
        });
      }

      // Filter patients that meet the action needed criteria
      const actionNeededPatients = allPatients.filter((patient) => {
        const remainingSessions = patient.quota - patient.sessions_used;
        return remainingSessions <= 2 && remainingSessions > 0;
      });

      if (actionNeededPatients.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No patients currently meet Action Needed criteria',
          summary: { total: 0, successful: 0, failed: 0 },
        });
      }

      console.log(`Found ${actionNeededPatients.length} patients needing immediate action`);

      // Process notifications for all Action Needed patients
      const notificationResults = [];
      let successCount = 0;
      let failureCount = 0;

      for (const patient of actionNeededPatients) {
        try {
          const remainingSessions = patient.quota - patient.sessions_used;

          const notificationData: NotificationData = {
            patientId: patient.id,
            patientName: `${patient.first_name} ${patient.last_name}`,
            patientType: patient.patient_type,
            remainingSessions,
            clinicEmail: userEmail,
            clinicName: userName,
            clinicId: user.id,
          };

          // Send notification with retry logic
          const notificationResult = await sendNotificationWithRetry(notificationData);

          if (notificationResult.success) {
            successCount++;

            // Log successful notification
            await logNotification(patient.id, user.id, 'sent', notificationData);

            notificationResults.push({
              patientId: patient.id,
              success: true,
              message: 'Notification sent successfully',
            });
          } else {
            failureCount++;

            // Log failed notification
            await logNotification(
              patient.id,
              user.id,
              'failed',
              notificationData,
              notificationResult.error
            );

            notificationResults.push({
              patientId: patient.id,
              success: false,
              error: notificationResult.error,
            });
          }
        } catch (error) {
          failureCount++;
          console.error(`Error processing notification for patient ${patient.id}:`, error);

          notificationResults.push({
            patientId: patient.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `Onboarding notifications processed: ${successCount} sent, ${failureCount} failed`,
        summary: {
          total: actionNeededPatients.length,
          successful: successCount,
          failed: failureCount,
        },
        results: notificationResults,
      });
    }

    // Original logic for manual patient selection
    if (!patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
      return NextResponse.json({ error: 'Patient IDs array is required' }, { status: 400 });
    }

    if (!clinicId) {
      return NextResponse.json({ error: 'Clinic ID is required' }, { status: 400 });
    }

    // Get clinic information
    const supabase = createAdminClient();
    const { data: clinic, error: clinicError } = await supabase
      .from('users')
      .select('email, full_name, custom_email')
      .eq('id', clinicId)
      .single();

    if (clinicError || !clinic) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
    }

    // Get patients needing action
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select(
        `
        id,
        first_name,
        last_name,
        patient_type,
        quota,
        sessions_used
      `
      )
      .eq('user_id', clinicId)
      .in('id', patientIds)
      .eq('is_active', true);

    if (patientsError) {
      return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 });
    }

    if (!patients || patients.length === 0) {
      return NextResponse.json({ error: 'No patients found' }, { status: 404 });
    }

    // Process notifications
    const notificationResults = [];
    let successCount = 0;
    let failureCount = 0;

    for (const patient of patients) {
      try {
        const remainingSessions = patient.quota - patient.sessions_used;

        const notificationData: NotificationData = {
          patientId: patient.id,
          patientName: `${patient.first_name} ${patient.last_name}`,
          patientType: patient.patient_type,
          remainingSessions,
          clinicEmail: clinic.custom_email || clinic.email,
          clinicName: clinic.full_name || 'Clinic',
          clinicId: clinicId,
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
            message: 'Notification sent successfully',
          });
        } else {
          failureCount++;

          // Log failed notification
          await logNotification(
            patient.id,
            clinicId,
            'failed',
            notificationData,
            notificationResult.error
          );

          notificationResults.push({
            patientId: patient.id,
            success: false,
            error: notificationResult.error,
          });
        }
      } catch (error) {
        failureCount++;
        console.error(`Error processing notification for patient ${patient.id}:`, error);

        notificationResults.push({
          patientId: patient.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Notifications processed: ${successCount} sent, ${failureCount} failed`,
      summary: {
        total: patients.length,
        successful: successCount,
        failed: failureCount,
      },
      results: notificationResults,
    });
  } catch (error) {
    console.error('Notification send error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send notifications',
      },
      { status: 500 }
    );
  }
}

// Send notification with retry logic (3 attempts with exponential backoff)
async function sendNotificationWithRetry(
  notificationData: NotificationData,
  attempt = 1
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await sendEmailNotification(notificationData);

    if (result.success) {
      return { success: true };
    }

    // If failed and we haven't reached max attempts, retry
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s

      console.log(
        `Notification failed for ${notificationData.patientName}, retrying in ${delay}ms (attempt ${attempt + 1}/3)`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return sendNotificationWithRetry(notificationData, attempt + 1);
    }

    return { success: false, error: result.error };
  } catch (error) {
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return sendNotificationWithRetry(notificationData, attempt + 1);
    }

    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Send email notification
async function sendEmailNotification(
  notificationData: NotificationData
): Promise<{ success: boolean; error?: string }> {
  try {
    const subject = `⚠️ ${notificationData.remainingSessions} ${notificationData.patientType} session(s) left for ${notificationData.patientName}`;

    const actionMessage =
      notificationData.remainingSessions === 0
        ? '🚨 IMMEDIATE: Patient has exhausted their quota. Please request renewal immediately to avoid unpaid sessions.'
        : notificationData.remainingSessions === 1
          ? '⚠️ URGENT: Patient has only 1 session left. Please request renewal soon.'
          : '⚠️ WARNING: Patient is running low on sessions. Consider requesting renewal.';

    const textContent = `
Dear ${notificationData.clinicName},

This is an automated alert regarding patient ${notificationData.patientName}.

ACTION NEEDED: ${notificationData.patientName} has ${notificationData.remainingSessions} ${notificationData.patientType} session(s) remaining.

Please take the following action:
${actionMessage}

Patient Details:
- Name: ${notificationData.patientName}
- Type: ${notificationData.patientType}
- Sessions Remaining: ${notificationData.remainingSessions}

Please log into your dashboard to review this patient's status and take appropriate action.

Best regards,
PhysioFlow Team

---
This is an automated notification. Please do not reply to this email.
    `;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Action Needed Alert</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">⚠️ Action Needed Alert</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">PhysioFlow Notification System</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <p style="font-size: 18px; margin-bottom: 20px;">Dear <strong>${notificationData.clinicName}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">This is an automated alert regarding patient <strong>${notificationData.patientName}</strong>.</p>
            
            <div style="background: ${notificationData.remainingSessions <= 1 ? '#dc3545' : '#ffc107'}; color: ${notificationData.remainingSessions <= 1 ? 'white' : '#000'}; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <h2 style="margin: 0 0 10px 0; font-size: 20px;">⚠️ ACTION NEEDED</h2>
                <p style="margin: 0; font-size: 16px; font-weight: bold;">
                    ${notificationData.patientName} has ${notificationData.remainingSessions} ${notificationData.patientType} session(s) remaining.
                </p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #007bff;">Please take the following action:</h3>
                <p style="margin: 0; font-size: 16px;">${actionMessage}</p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #333;">Patient Details:</h3>
                <ul style="margin: 0; padding-left: 20px;">
                    <li><strong>Name:</strong> ${notificationData.patientName}</li>
                    <li><strong>Type:</strong> ${notificationData.patientType}</li>
                    <li><strong>Sessions Remaining:</strong> ${notificationData.remainingSessions}</li>
                </ul>
            </div>
            
           
            
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            
            <p style="font-size: 14px; color: #6c757d; text-align: center; margin: 0;">
                Best regards,<br>
                <strong>PhysioFlow Team</strong><br><br>
                <em>This is an automated notification. Please do not reply to this email.</em>
            </p>
        </div>
    </body>
    </html>
    `;

    console.log('📧 SENDING REAL EMAIL:');
    console.log('To:', notificationData.clinicEmail);
    console.log('Subject:', subject);

    // Use the real EmailService to send the email
    const emailService = EmailService.getInstance();

    const emailId = await emailService.queueEmail({
      to_email: notificationData.clinicEmail,
      subject: subject,
      html_content: htmlContent,
      text_content: textContent,
      type: 'quota_alert',
      patient_id: notificationData.patientId,
      clinic_id: notificationData.clinicId,
      max_attempts: 3,
    });

    console.log(`✅ Email queued successfully with ID: ${emailId}`);
    return { success: true };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
    const supabase = createAdminClient();
    await supabase.from('notification_logs').insert({
      patient_id: patientId,
      user_id: clinicId,
      notification_type: 'action_needed',
      status,
      recipient_email: notificationData.clinicEmail,
      subject: `⚠️ ${notificationData.remainingSessions} ${notificationData.patientType} session(s) left for ${notificationData.patientName}`,
      error_details: error ? { error } : null,
      sent_at: new Date().toISOString(),
    });
  } catch (logError) {
    console.error('Failed to log notification:', logError);
  }
}

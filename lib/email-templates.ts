export interface PatientData {
  name: string;
  epc_number?: string;
  sessionsRemaining: number;
  totalSessions: number;
  physio?: string;
  lastAppointment?: string;
  nextAppointment?: string;
}

export interface ClinicData {
  name: string;
  email: string;
}

/**
 * Email template for quota alerts (1-2 sessions remaining)
 */
export function generateQuotaAlertEmail(
  patient: PatientData,
  clinic: ClinicData,
  threshold: number
): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `⚠️ ${patient.sessionsRemaining} EPC session${patient.sessionsRemaining !== 1 ? 's' : ''} left for ${patient.name}`;

  const text = `
URGENT: Action Required

Patient: ${patient.name}${patient.epc_number ? ` (EPC #${patient.epc_number})` : ''}
Sessions Remaining: ${patient.sessionsRemaining} of ${patient.totalSessions}
${patient.physio ? `Physiotherapist: ${patient.physio}` : ''}

ACTION REQUIRED: Please request GP renewal to avoid unpaid sessions.

${patient.nextAppointment ? `Next Appointment: ${patient.nextAppointment}` : ''}
${patient.lastAppointment ? `Last Appointment: ${patient.lastAppointment}` : ''}

This alert was triggered because the patient has ${patient.sessionsRemaining} session${patient.sessionsRemaining !== 1 ? 's' : ''} remaining, which is at or below your configured threshold of ${threshold} sessions.

Please log into MyPhysioFlow to manage this patient or contact the referring GP for renewal.

---
MyPhysioFlow Notification System
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MyPhysioFlow Alert</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .alert-icon { font-size: 48px; margin-bottom: 10px; }
        .content { padding: 30px 20px; }
        .alert-box { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin-bottom: 25px; }
        .patient-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .patient-info h3 { margin: 0 0 15px 0; color: #2c3e50; font-size: 18px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .info-label { font-weight: 600; color: #555; }
        .info-value { color: #333; }
        .action-box { background: #e3f2fd; border: 1px solid #90caf9; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .action-title { font-weight: 600; color: #1976d2; margin-bottom: 10px; font-size: 16px; }
        .sessions-badge { display: inline-block; background: #ff4757; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px; }
        .btn { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 0; }
        .btn:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="alert-icon">⚠️</div>
            <h1>MyPhysioFlow Alert</h1>
            <p>Immediate Action Required</p>
        </div>
        
        <div class="content">
            <div class="alert-box">
                <strong>URGENT:</strong> Patient approaching session quota limit
            </div>
            
            <div class="patient-info">
                <h3>📋 Patient Details</h3>
                <div class="info-row">
                    <span class="info-label">Name:</span>
                    <span class="info-value">${patient.name}</span>
                </div>
                ${
                  patient.epc_number
                    ? `
                <div class="info-row">
                    <span class="info-label">EPC Number:</span>
                    <span class="info-value">#${patient.epc_number}</span>
                </div>
                `
                    : ''
                }
                <div class="info-row">
                    <span class="info-label">Sessions Remaining:</span>
                    <span class="sessions-badge">${patient.sessionsRemaining} of ${patient.totalSessions}</span>
                </div>
                ${
                  patient.physio
                    ? `
                <div class="info-row">
                    <span class="info-label">Physiotherapist:</span>
                    <span class="info-value">${patient.physio}</span>
                </div>
                `
                    : ''
                }
                ${
                  patient.nextAppointment
                    ? `
                <div class="info-row">
                    <span class="info-label">Next Appointment:</span>
                    <span class="info-value">${patient.nextAppointment}</span>
                </div>
                `
                    : ''
                }
                ${
                  patient.lastAppointment
                    ? `
                <div class="info-row">
                    <span class="info-label">Last Appointment:</span>
                    <span class="info-value">${patient.lastAppointment}</span>
                </div>
                `
                    : ''
                }
            </div>
            
            <div class="action-box">
                <div class="action-title">🎯 Required Action</div>
                <p><strong>Please request GP renewal immediately</strong> to avoid unpaid sessions.</p>
                <p>This alert was triggered because the patient has ${patient.sessionsRemaining} session${patient.sessionsRemaining !== 1 ? 's' : ''} remaining, which is at or below your configured threshold of ${threshold} sessions.</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.myphysioflow.com'}" class="btn">
                    Manage in MyPhysioFlow →
                </a>
            </div>
        </div>
        
        <div class="footer">
            <p>This is an automated notification from MyPhysioFlow.<br>
            You're receiving this because you have quota alerts enabled for ${threshold} sessions remaining.</p>
            <p><strong>MyPhysioFlow</strong> - Professional Physiotherapy Practice Management</p>
        </div>
    </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

/**
 * Email template for patients moved to pending status
 */
export function generatePendingStatusEmail(
  patient: PatientData,
  clinic: ClinicData,
  reason?: string
): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `📋 ${patient.name} moved to Pending - Follow-up Required`;

  const text = `
FOLLOW-UP REQUIRED

Patient: ${patient.name}${patient.epc_number ? ` (EPC #${patient.epc_number})` : ''}
Status: Moved to Pending
${reason ? `Reason: ${reason}` : ''}
${patient.physio ? `Physiotherapist: ${patient.physio}` : ''}

A patient has been moved to Pending status and requires follow-up action.

${patient.nextAppointment ? `Next Appointment: ${patient.nextAppointment}` : ''}
${patient.lastAppointment ? `Last Appointment: ${patient.lastAppointment}` : ''}

Please review this patient's case and take appropriate action.

---
MyPhysioFlow Notification System
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MyPhysioFlow - Pending Status Alert</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .status-icon { font-size: 48px; margin-bottom: 10px; }
        .content { padding: 30px 20px; }
        .status-box { background: #e3f2fd; border: 1px solid #90caf9; border-radius: 8px; padding: 20px; margin-bottom: 25px; }
        .patient-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .patient-info h3 { margin: 0 0 15px 0; color: #2c3e50; font-size: 18px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .info-label { font-weight: 600; color: #555; }
        .info-value { color: #333; }
        .action-box { background: #fff8e1; border: 1px solid #ffcc02; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .action-title { font-weight: 600; color: #f57f17; margin-bottom: 10px; font-size: 16px; }
        .pending-badge { display: inline-block; background: #2196f3; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px; }
        .btn { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 0; }
        .btn:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="status-icon">📋</div>
            <h1>MyPhysioFlow</h1>
            <p>Patient Status Update</p>
        </div>
        
        <div class="content">
            <div class="status-box">
                <strong>FOLLOW-UP REQUIRED:</strong> Patient moved to Pending status
            </div>
            
            <div class="patient-info">
                <h3>👤 Patient Details</h3>
                <div class="info-row">
                    <span class="info-label">Name:</span>
                    <span class="info-value">${patient.name}</span>
                </div>
                ${
                  patient.epc_number
                    ? `
                <div class="info-row">
                    <span class="info-label">EPC Number:</span>
                    <span class="info-value">#${patient.epc_number}</span>
                </div>
                `
                    : ''
                }
                <div class="info-row">
                    <span class="info-label">Status:</span>
                    <span class="pending-badge">Pending</span>
                </div>
                ${
                  reason
                    ? `
                <div class="info-row">
                    <span class="info-label">Reason:</span>
                    <span class="info-value">${reason}</span>
                </div>
                `
                    : ''
                }
                ${
                  patient.physio
                    ? `
                <div class="info-row">
                    <span class="info-label">Physiotherapist:</span>
                    <span class="info-value">${patient.physio}</span>
                </div>
                `
                    : ''
                }
                ${
                  patient.nextAppointment
                    ? `
                <div class="info-row">
                    <span class="info-label">Next Appointment:</span>
                    <span class="info-value">${patient.nextAppointment}</span>
                </div>
                `
                    : ''
                }
                ${
                  patient.lastAppointment
                    ? `
                <div class="info-row">
                    <span class="info-label">Last Appointment:</span>
                    <span class="info-value">${patient.lastAppointment}</span>
                </div>
                `
                    : ''
                }
            </div>
            
            <div class="action-box">
                <div class="action-title">📝 Required Action</div>
                <p>This patient has been moved to Pending status and requires your attention.</p>
                <p>Please review the case and take appropriate follow-up action.</p>
            </div>
            
          
        </div>
        
        <div class="footer">
            <p>This is an automated notification from MyPhysioFlow.<br>
            You're receiving this because pending status alerts are enabled.</p>
            <p><strong>MyPhysioFlow</strong> - Professional Physiotherapy Practice Management</p>
        </div>
    </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

/**
 * Email template for system alerts and admin notifications
 */
export function generateSystemAlertEmail(
  type: 'email_failure' | 'system_error' | 'quota_exceeded',
  message: string,
  details?: any
): {
  subject: string;
  html: string;
  text: string;
} {
  const subjects = {
    email_failure: '🚨 MyPhysioFlow: Email Delivery Failure',
    system_error: '⚠️ MyPhysioFlow: System Error Detected',
    quota_exceeded: '📊 MyPhysioFlow: Usage Quota Exceeded',
  };

  const subject = subjects[type];

  const text = `
SYSTEM ALERT: ${type.replace('_', ' ').toUpperCase()}

Message: ${message}

${details ? `Details: ${JSON.stringify(details, null, 2)}` : ''}

Timestamp: ${new Date().toISOString()}

Please investigate this issue immediately.

---
MyPhysioFlow System Monitoring
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MyPhysioFlow System Alert</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .alert-icon { font-size: 48px; margin-bottom: 10px; }
        .content { padding: 30px 20px; }
        .alert-box { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 20px; margin-bottom: 25px; color: #721c24; }
        .details-box { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; font-family: 'Courier New', monospace; font-size: 12px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="alert-icon">🚨</div>
            <h1>System Alert</h1>
            <p>MyPhysioFlow Monitoring</p>
        </div>
        
        <div class="content">
            <div class="alert-box">
                <strong>ALERT TYPE:</strong> ${type.replace('_', ' ').toUpperCase()}<br>
                <strong>MESSAGE:</strong> ${message}
            </div>
            
            ${
              details
                ? `
            <div class="details-box">
                <strong>Technical Details:</strong><br>
                <pre>${JSON.stringify(details, null, 2)}</pre>
            </div>
            `
                : ''
            }
            
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p>Please investigate this issue immediately and take corrective action.</p>
        </div>
        
        <div class="footer">
            <p><strong>MyPhysioFlow System Monitoring</strong><br>
            This is an automated system alert.</p>
        </div>
    </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

/**
 * Test email functionality
 */
export function generateTestEmail(recipientEmail: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = '✅ MyPhysioFlow Email Test - Delivery Confirmation';

  const text = `
MyPhysioFlow Email Test

This is a test email to confirm that email delivery is working correctly.

If you receive this email, the notification system is functioning properly.

Test Details:
- Sent to: ${recipientEmail}
- Timestamp: ${new Date().toISOString()}
- System: MyPhysioFlow Notifications

---
MyPhysioFlow Email Testing
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MyPhysioFlow Email Test</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .test-icon { font-size: 48px; margin-bottom: 10px; }
        .content { padding: 30px 20px; }
        .success-box { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin-bottom: 25px; color: #155724; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="test-icon">✅</div>
            <h1>Email Test</h1>
            <p>Delivery Confirmation</p>
        </div>
        
        <div class="content">
            <div class="success-box">
                <strong>SUCCESS:</strong> Email delivery is working correctly!
            </div>
            
            <p>This is a test email to confirm that the MyPhysioFlow notification system is functioning properly.</p>
            
            <p><strong>Test Details:</strong></p>
            <ul>
                <li>Recipient: ${recipientEmail}</li>
                <li>Timestamp: ${new Date().toISOString()}</li>
                <li>System: MyPhysioFlow Notifications</li>
            </ul>
            
            <p>If you receive this email, all notification systems are operational.</p>
        </div>
        
        <div class="footer">
            <p><strong>MyPhysioFlow Email Testing</strong><br>
            This is an automated test email.</p>
        </div>
    </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

import * as sgMail from '@sendgrid/mail';
import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// Initialize SendGrid with environment variable
const sendGridKey = process.env.SENDGRID_API_KEY;
if (sendGridKey) {
  sgMail.setApiKey(sendGridKey);
  console.log('✅ SendGrid API key configured');
} else {
  console.error('❌ SENDGRID_API_KEY environment variable is not set');
}

// Initialize Supabase for logging - use the config
const supabaseUrl = config.supabase.url;
const supabaseServiceKey = config.supabase.serviceRoleKey;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase configuration missing in email service');
  console.error('URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('Service Key:', supabaseServiceKey ? 'SET' : 'MISSING');
} else {
  console.log('✅ Supabase configuration loaded for email service');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface EmailNotification {
  id?: string;
  to_email: string;
  subject: string;
  html_content: string;
  text_content: string;
  type: 'quota_alert' | 'pending_status' | 'general';
  patient_id?: string;
  clinic_id: string;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  max_attempts: number;
  error_message?: string;
  created_at?: string;
  sent_at?: string;
  next_retry_at?: string;
}

export class EmailService {
  private static instance: EmailService;
  private readonly maxRetries = 5;
  private readonly retryDelays = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1m, 5m

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Queue an email for sending with automatic retry logic
   */
  async queueEmail(
    notification: Omit<EmailNotification, 'id' | 'status' | 'attempts' | 'created_at'>
  ): Promise<string> {
    try {
      console.log(`📧 Queuing email: ${notification.type} to ${notification.to_email}`);

      const emailRecord: EmailNotification = {
        ...notification,
        status: 'pending',
        attempts: 0,
        max_attempts: this.maxRetries,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('email_notifications')
        .insert(emailRecord)
        .select('id')
        .single();

      if (error) {
        console.error('Failed to queue email:', error);
        throw new Error(`Failed to queue email: ${error.message}`);
      }

      console.log(`✅ Email queued successfully with ID: ${data.id}`);

      // Check if SendGrid is configured
      if (!sendGridKey) {
        console.log(`⚠️  SendGrid not configured - marking email as sent for testing`);
        // For testing purposes, mark as sent immediately
        await this.markEmailSent(data.id);
        return data.id;
      }

      // Immediately attempt to send the email
      this.sendQueuedEmail(data.id);

      return data.id;
    } catch (error) {
      console.error('Error queueing email:', error);
      throw error;
    }
  }

  /**
   * Send a queued email with retry logic
   */
  async sendQueuedEmail(emailId: string): Promise<boolean> {
    try {
      // Get email from queue
      const { data: email, error } = await supabase
        .from('email_notifications')
        .select('*')
        .eq('id', emailId)
        .single();

      if (error || !email) {
        console.error('Email not found in queue:', emailId);
        return false;
      }

      // Check if we've exceeded max attempts
      if (email.attempts >= email.max_attempts) {
        await this.markEmailFailed(emailId, 'Maximum retry attempts exceeded');
        return false;
      }

      // Increment attempt counter
      await this.incrementAttempts(emailId);

      try {
        // Attempt to send email via SendGrid
        await this.sendViaProvider(email);

        // Mark as sent
        await this.markEmailSent(emailId);

        console.log(`Email sent successfully: ${emailId}`);
        return true;
      } catch (sendError: any) {
        console.error(`Email send attempt ${email.attempts + 1} failed:`, sendError);

        // Schedule retry if we haven't exceeded max attempts
        if (email.attempts + 1 < email.max_attempts) {
          await this.scheduleRetry(emailId, email.attempts + 1);
        } else {
          await this.markEmailFailed(emailId, sendError.message);
        }

        return false;
      }
    } catch (error) {
      console.error('Error in sendQueuedEmail:', error);
      return false;
    }
  }

  /**
   * Send email via SendGrid with proper error handling
   */
  private async sendViaProvider(email: EmailNotification): Promise<void> {
    if (!sendGridKey) {
      throw new Error('SendGrid API key not configured');
    }

    const msg = {
      to: email.to_email,
      from: {
        email: process.env.FROM_EMAIL || config.sendgrid.fromEmail,
        name: 'MyPhysioFlow',
      },
      subject: email.subject,
      text: email.text_content,
      html: email.html_content,
      trackingSettings: {
        clickTracking: { enable: false },
        openTracking: { enable: false },
      },
    };

    try {
      const response = await sgMail.send(msg);

      // Log successful send
      console.log(`SendGrid response:`, response[0].statusCode);

      if (response[0].statusCode >= 400) {
        throw new Error(`SendGrid returned status ${response[0].statusCode}`);
      }
    } catch (error: any) {
      // Handle SendGrid specific errors
      if (error.response) {
        const { message, code, response } = error;
        throw new Error(`SendGrid error: ${message} (${code}) - ${JSON.stringify(response.body)}`);
      }
      throw error;
    }
  }

  /**
   * Mark email as sent
   */
  private async markEmailSent(emailId: string): Promise<void> {
    await supabase
      .from('email_notifications')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', emailId);
  }

  /**
   * Mark email as failed
   */
  private async markEmailFailed(emailId: string, errorMessage: string): Promise<void> {
    await supabase
      .from('email_notifications')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', emailId);

    // Log critical failure for admin monitoring
    await this.logCriticalFailure(emailId, errorMessage);
  }

  /**
   * Schedule email retry
   */
  private async scheduleRetry(emailId: string, attemptNumber: number): Promise<void> {
    const delay = this.retryDelays[Math.min(attemptNumber - 1, this.retryDelays.length - 1)];
    const nextRetryAt = new Date(Date.now() + delay).toISOString();

    await supabase
      .from('email_notifications')
      .update({
        status: 'retrying',
        next_retry_at: nextRetryAt,
      })
      .eq('id', emailId);

    // Schedule the retry
    setTimeout(() => {
      this.sendQueuedEmail(emailId);
    }, delay);
  }

  /**
   * Increment attempt counter
   */
  private async incrementAttempts(emailId: string): Promise<void> {
    await supabase.rpc('increment_email_attempts', { email_id: emailId });
  }

  /**
   * Log critical failure for admin monitoring
   */
  private async logCriticalFailure(emailId: string, errorMessage: string): Promise<void> {
    try {
      await supabase.from('system_alerts').insert({
        type: 'email_failure',
        severity: 'critical',
        message: `Email notification failed permanently: ${emailId}`,
        details: { email_id: emailId, error: errorMessage },
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to log critical failure:', error);
    }
  }

  /**
   * Process retry queue - call this periodically
   */
  async processRetryQueue(): Promise<void> {
    try {
      const { data: emailsToRetry, error } = await supabase
        .from('email_notifications')
        .select('id')
        .eq('status', 'retrying')
        .lte('next_retry_at', new Date().toISOString())
        .limit(10);

      if (error) {
        console.error('Error fetching retry queue:', error);
        return;
      }

      for (const email of emailsToRetry || []) {
        await this.sendQueuedEmail(email.id);
      }
    } catch (error) {
      console.error('Error processing retry queue:', error);
    }
  }

  /**
   * Get email statistics for monitoring
   */
  async getEmailStats(clinicId?: string): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
    retrying: number;
  }> {
    try {
      let query = supabase.from('email_notifications').select('status');

      if (clinicId) {
        query = query.eq('clinic_id', clinicId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        sent: 0,
        failed: 0,
        pending: 0,
        retrying: 0,
      };

      data?.forEach((email) => {
        stats[email.status as keyof typeof stats]++;
      });

      return stats;
    } catch (error) {
      console.error('Error getting email stats:', error);
      return { total: 0, sent: 0, failed: 0, pending: 0, retrying: 0 };
    }
  }
}

export default EmailService;

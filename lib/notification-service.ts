import { createAdminClient } from './supabase/server-admin';
import EmailService from './email-service';
import { config } from './config';
import {
  generateQuotaAlertEmail,
  generatePendingStatusEmail,
  generateSystemAlertEmail,
  PatientData,
  ClinicData,
} from './email-templates';

export interface NotificationSettings {
  emailNotifications: boolean;
  quotaThreshold: number;
  customEmail?: string;
  notifyOnPending: boolean;
  notifyOnQuota: boolean;
}

export class NotificationService {
  private static instance: NotificationService;
  private emailService: EmailService;

  constructor() {
    this.emailService = EmailService.getInstance();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Check and send quota alerts for patients approaching their session limit
   */
  async checkAndSendQuotaAlerts(userId: string): Promise<void> {
    try {
      // Get user notification settings
      const settings: NotificationSettings = await this.getUserNotificationSettings(userId);

      if (!settings.emailNotifications || !settings.notifyOnQuota) {
        console.log('Quota notifications disabled for user:', userId);
        return;
      }

      // Get user details
      const user = await this.getUserDetails(userId);
      if (!user) {
        console.error('User not found:', userId);
        return;
      }

      // Get patients approaching quota threshold
      const patientsAtRisk = await this.getPatientsApproachingQuota(
        userId,
        settings.quotaThreshold
      );

      console.log(`Found ${patientsAtRisk.length} patients at quota risk for user ${userId}`);

      for (const patient of patientsAtRisk) {
        await this.sendQuotaAlert(patient, user, settings);
      }
    } catch (error) {
      console.error('Error checking quota alerts:', error);
      await this.logSystemError('quota_alert_check_failed', error);
    }
  }

  /**
   * Send quota alert for a specific patient
   */
  async sendQuotaAlert(
    patient: PatientData,
    user: ClinicData,
    settings: NotificationSettings
  ): Promise<void> {
    try {
      // Check if we've already sent an alert for this patient recently
      const recentAlert = await this.checkRecentQuotaAlert(patient, user);
      if (recentAlert) {
        console.log(`Quota alert already sent recently for patient ${patient.name}`);
        return;
      }

      // Generate email content
      const emailContent = generateQuotaAlertEmail(patient, user, settings.quotaThreshold);

      // Use custom_email as the primary recipient, fall back to user's default email if not set
      const recipientEmail = user.email; // This will be custom_email if set, otherwise user.email

      // Queue the email
      const emailId = await this.emailService.queueEmail({
        to_email: recipientEmail,
        subject: emailContent.subject,
        html_content: emailContent.html,
        text_content: emailContent.text,
        type: 'quota_alert',
        patient_id: patient.name, // We should use actual patient ID here
        clinic_id: user.name, // We should use actual clinic ID here
        max_attempts: 5,
      });

      // Record that we sent this alert
      await this.recordQuotaAlert(patient, user, emailId);

      console.log(`Quota alert queued for ${patient.name}: ${emailId}`);
    } catch (error) {
      console.error('Error sending quota alert:', error);
      await this.logSystemError('quota_alert_send_failed', error);
    }
  }

  /**
   * Send pending status alert for a patient
   */
  async sendPendingStatusAlert(
    patient: PatientData,
    userId: string,
    reason?: string
  ): Promise<void> {
    try {
      console.log(`🚀 Sending pending status alert for patient: ${patient.name}`);

      // Get user notification settings
      const settings: NotificationSettings = await this.getUserNotificationSettings(userId);

      if (!settings.emailNotifications || !settings.notifyOnPending) {
        console.log('Pending notifications disabled for user:', userId);
        return;
      }

      // Get user details
      const user = await this.getUserDetails(userId);
      if (!user) {
        console.error('User not found:', userId);
        return;
      }

      // Generate email content
      const emailContent = generatePendingStatusEmail(patient, user, reason);

      // Use custom_email as the primary recipient, fall back to user's default email if not set
      const recipientEmail = user.email; // This will be custom_email if set, otherwise user.email

      console.log(`📧 Queuing pending status email to: ${recipientEmail}`);

      // Queue the email
      const emailId = await this.emailService.queueEmail({
        to_email: recipientEmail,
        subject: emailContent.subject,
        html_content: emailContent.html,
        text_content: emailContent.text,
        type: 'pending_status',
        patient_id: patient.name, // We should use actual patient ID here
        clinic_id: user.name, // We should use actual clinic ID here
        max_attempts: 5,
      });

      console.log(`✅ Pending status alert queued for ${patient.name}: ${emailId}`);
    } catch (error) {
      console.error('Error sending pending status alert:', error);
      await this.logSystemError('pending_status_alert_failed', error);
    }
  }

  /**
   * Get user notification settings from users table
   */
  private async getUserNotificationSettings(userId: string): Promise<NotificationSettings> {
    try {
      // Get user's notification preferences from users table
      const supabase = createAdminClient();
      type UserSettings = {
        custom_email?: string;
        enable_email_alerts?: boolean;
        session_quota_threshold?: number;
      };
      const { data: user, error } = await supabase
        .from('users')
        .select('custom_email, enable_email_alerts, session_quota_threshold')
        .eq('id', userId)
        .single() as { data: UserSettings | null; error: any };

      if (error) {
        console.error('Error fetching user settings:', error);
        // Return safe defaults
        const defaultSettings: NotificationSettings = {
          emailNotifications: false,
          quotaThreshold: 2,
          customEmail: undefined,
          notifyOnPending: false,
          notifyOnQuota: false,
        };
        return defaultSettings;
      }

      // Return settings from users table
      const userSettings: NotificationSettings = {
        emailNotifications: user?.enable_email_alerts || false,
        quotaThreshold: user?.session_quota_threshold || 2,
        customEmail: user?.custom_email || undefined,
        notifyOnPending: user?.enable_email_alerts || false,
        notifyOnQuota: user?.enable_email_alerts || false,
      };
      return userSettings;
    } catch (error) {
      console.error('Error getting user settings:', error);
      // Return safe defaults
      const fallbackSettings: NotificationSettings = {
        emailNotifications: false,
        quotaThreshold: 2,
        customEmail: undefined,
        notifyOnPending: false,
        notifyOnQuota: false,
      };
      return fallbackSettings;
    }
  }

  /**
   * Get user details for email sending
   */
  private async getUserDetails(userId: string): Promise<ClinicData | null> {
    try {
      // Get user details from users table
      const supabase = createAdminClient();
      type UserDetails = {
        email?: string;
        full_name?: string;
        custom_email?: string;
      };
      const { data: user, error } = await supabase
        .from('users')
        .select('email, full_name, custom_email')
        .eq('id', userId)
        .single() as { data: UserDetails | null; error: any };

      if (error || !user) {
        console.error('User not found:', userId);
        return null;
      }

      // Use custom_email as the primary recipient, fall back to user's default email if not set
      const emailToUse = user.custom_email || user.email || '';

      return {
        name: user.full_name || 'Your Clinic',
        email: emailToUse,
      };
    } catch (error) {
      console.error('Error getting user details:', error);
      return null;
    }
  }

  /**
   * Get patients approaching their quota threshold
   */
  private async getPatientsApproachingQuota(
    userId: string,
    threshold: number
  ): Promise<PatientData[]> {
    try {
      // This should query your actual patient database
      // For now, returning mock data
      return [
        {
          name: 'John Doe',
          sessionsRemaining: 1,
          totalSessions: 10,
        },
      ];

      // In a real implementation, you'd do:
      // const { data, error } = await supabase
      //   .from('patients')
      //   .select('*')
      //   .eq('user_id', userId)
      //   .lte('sessions_remaining', threshold)
      //   .gt('sessions_remaining', 0);

      // return data || [];
    } catch (error) {
      console.error('Error getting patients approaching quota:', error);
      return [];
    }
  }

  /**
   * Check if we've sent a quota alert recently for this patient
   */
  private async checkRecentQuotaAlert(patient: PatientData, user: ClinicData): Promise<boolean> {
    try {
      // Check if we've sent an alert in the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const supabase = createAdminClient(); // Use the admin client
      const { data, error } = await supabase
        .from('email_notifications')
        .select('id')
        .eq('type', 'quota_alert')
        .eq('patient_id', patient.name) // Should use actual patient ID
        .eq('clinic_id', user.name) // Should use actual clinic ID
        .gte('created_at', twentyFourHoursAgo)
        .limit(1);

      if (error) {
        console.error('Error checking recent quota alert:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking recent quota alert:', error);
      return false;
    }
  }

  /**
   * Record that we sent a quota alert
   */
  private async recordQuotaAlert(
    patient: PatientData,
    user: ClinicData,
    emailId: string
  ): Promise<void> {
    try {
      const supabase = createAdminClient(); // Use the admin client
      await supabase.from('quota_alerts_sent').insert({
        patient_id: patient.name, // Should use actual patient ID
        clinic_id: user.name, // Should use actual clinic ID
        email_id: emailId,
        sessions_remaining: patient.sessionsRemaining,
      });
    } catch (error) {
      console.error('Error recording quota alert:', error);
    }
  }

  /**
   * Log system errors
   */
  private async logSystemError(errorType: string, error: any): Promise<void> {
    try {
      // Map error type to valid system alert type
      const alertType: 'email_failure' | 'system_error' | 'quota_exceeded' =
        errorType === 'email_failure'
          ? 'email_failure'
          : errorType === 'quota_exceeded'
            ? 'quota_exceeded'
            : 'system_error';

      const systemAlert = generateSystemAlertEmail(alertType, error.message || 'Unknown error', {
        error: error.toString(),
      });

      // Log to system alerts table
      const supabase = createAdminClient(); // Use the admin client
      await supabase.from('system_alerts').insert({
        type: errorType,
        severity: 'high',
        message: error.message || 'Unknown error',
        details: { error: error.toString() },
      });

      // Send admin notification
      await this.emailService.queueEmail({
        to_email: process.env.ADMIN_EMAIL || config.sendgrid.adminEmail,
        subject: systemAlert.subject,
        html_content: systemAlert.html,
        text_content: systemAlert.text,
        type: 'general',
        clinic_id: 'system',
        max_attempts: 3,
      });
    } catch (logError) {
      console.error('Error logging system error:', logError);
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(recipientEmail: string): Promise<boolean> {
    try {
      const testEmail = {
        subject: 'MyPhysioFlow Test Notification',
        html: '<h1>Test Email</h1><p>This is a test notification from MyPhysioFlow.</p>',
        text: 'Test Email\n\nThis is a test notification from MyPhysioFlow.',
      };

      const emailId = await this.emailService.queueEmail({
        to_email: recipientEmail,
        subject: 'MyPhysioFlow Test Notification',
        html_content: testEmail.html,
        text_content: testEmail.text,
        type: 'general',
        clinic_id: 'test',
        max_attempts: 3,
      });

      console.log(`Test notification queued: ${emailId}`);
      return true;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }

  /**
   * Process retry queue and check for alerts
   */
  async processNotifications(): Promise<void> {
    try {
      // Process any emails that need retrying
      await this.emailService.processRetryQueue();

      // Check quota alerts for all users
      // In a real implementation, you'd get all user IDs
      const userIds = ['user1', 'user2']; // This should come from your database

      for (const userId of userIds) {
        await this.checkAndSendQuotaAlerts(userId);
      }
    } catch (error) {
      console.error('Error processing notifications:', error);
    }
  }

  /**
   * Update user's email notification preferences
   */
  async updateUserEmailPreferences(
    userId: string,
    enableEmailAlerts: boolean,
    sessionQuotaThreshold: number,
    customEmail?: string
  ): Promise<boolean> {
    try {
      // Validate quota threshold
      if (sessionQuotaThreshold < 1 || sessionQuotaThreshold > 5) {
        throw new Error('Session quota threshold must be between 1 and 5');
      }

      // Validate custom email if provided
      if (customEmail && !this.isValidEmail(customEmail)) {
        throw new Error('Invalid email format');
      }

      // Update user's email notification preferences
      const supabase = createAdminClient();
      const updateData: any = {
        enable_email_alerts: enableEmailAlerts,
        session_quota_threshold: sessionQuotaThreshold,
        updated_at: new Date().toISOString(),
      };

      // Only update custom_email if provided
      if (customEmail !== undefined) {
        updateData.custom_email = customEmail;
      }

      const { error } = await supabase.from('users').update(updateData).eq('id', userId);

      if (error) {
        console.error('Error updating email preferences:', error);
        return false;
      }

      console.log(`Email preferences updated for user ${userId}:`, updateData);
      return true;
    } catch (error) {
      console.error('Error updating email preferences:', error);
      return false;
    }
  }

  /**
   * Get user's current email preferences
   */
  async getUserEmailPreferences(userId: string): Promise<{
    defaultEmail: string;
    customEmail?: string;
    isUsingCustomEmail: boolean;
    enableEmailAlerts: boolean;
    sessionQuotaThreshold: number;
  }> {
    try {
      const supabase = createAdminClient();
      const { data: user, error } = await supabase
        .from('users')
        .select('email, custom_email, enable_email_alerts, session_quota_threshold')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new Error('User not found');
      }

      return {
        defaultEmail: user.email,
        customEmail: user.custom_email || undefined,
        isUsingCustomEmail: !!user.custom_email,
        enableEmailAlerts: user.enable_email_alerts || false,
        sessionQuotaThreshold: user.session_quota_threshold || 2,
      };
    } catch (error) {
      console.error('Error getting user email preferences:', error);
      throw error;
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

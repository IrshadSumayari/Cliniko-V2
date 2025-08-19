import { createAdminClient } from '@/lib/supabase/server-admin';
import { PMSFactory } from '@/lib/pms/factory';
import { getDecryptedApiKey } from '@/lib/supabase/server-admin';
import type { PMSType } from '@/lib/pms/types';

interface SyncResult {
  success: boolean;
  syncId?: string;
  patientsUpdated?: number;
  appointmentsUpdated?: number;
  error?: string;
  details?: any;
}

class SyncScheduler {
  private supabase = createAdminClient();

  async pauseUserSync(userId: string, pmsType: PMSType): Promise<void> {
    console.log(`[SCHEDULER] Pausing sync for user ${userId}, PMS: ${pmsType}`);

    const { error } = await this.supabase.from('sync_controls').upsert(
      {
        user_id: userId,
        pms_type: pmsType,
        is_enabled: false,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,pms_type',
      }
    );

    if (error) {
      throw new Error(`Failed to pause sync: ${error.message}`);
    }
  }

  async resumeUserSync(userId: string, pmsType: PMSType): Promise<void> {
    console.log(`[SCHEDULER] Resuming sync for user ${userId}, PMS: ${pmsType}`);

    const { error } = await this.supabase.from('sync_controls').upsert(
      {
        user_id: userId,
        pms_type: pmsType,
        is_enabled: true,
        next_sync_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // Next sync in 6 hours
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,pms_type',
      }
    );

    if (error) {
      throw new Error(`Failed to resume sync: ${error.message}`);
    }
  }

  async forceFullSync(userId: string, pmsType: PMSType): Promise<string> {
    console.log(`[SCHEDULER] Starting force full sync for user ${userId}, PMS: ${pmsType}`);

    // Create sync log entry
    const { data: syncLog, error: logError } = await this.supabase
      .from('sync_logs')
      .insert({
        user_id: userId,
        pms_type: pmsType,
        sync_type: 'manual',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError || !syncLog) {
      throw new Error(`Failed to create sync log: ${logError?.message}`);
    }

    // Run the sync in the background
    this.performFullSync(userId, pmsType, syncLog.id).catch((error) => {
      console.error(`[SCHEDULER] Full sync failed for user ${userId}:`, error);
    });

    return syncLog.id;
  }

  async runManualSync(userId: string, pmsType: PMSType): Promise<string> {
    console.log(`[SCHEDULER] Starting manual sync for user ${userId}, PMS: ${pmsType}`);

    // Create sync log entry
    const { data: syncLog, error: logError } = await this.supabase
      .from('sync_logs')
      .insert({
        user_id: userId,
        pms_type: pmsType,
        sync_type: 'manual',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError || !syncLog) {
      throw new Error(`Failed to create sync log: ${logError?.message}`);
    }

    // Run the sync in the background
    this.performIncrementalSync(userId, pmsType, syncLog.id).catch((error) => {
      console.error(`[SCHEDULER] Manual sync failed for user ${userId}:`, error);
    });

    return syncLog.id;
  }

  private async performFullSync(
    userId: string,
    pmsType: PMSType,
    syncLogId: string
  ): Promise<void> {
    try {
      console.log(`[SCHEDULER] Performing full sync for user ${userId}`);

      // Get API credentials
      const credentials = await getDecryptedApiKey(userId, pmsType);
      if (!credentials) {
        throw new Error('No API credentials found');
      }

      // Create PMS client
      const pmsClient = PMSFactory.createClient(pmsType, credentials.apiKey);

      // Get all patients (full sync)
      const allPatients = await pmsClient.getAllPatients();
      console.log(`[SCHEDULER] Found ${allPatients.length} total patients`);

      let patientsUpdated = 0;
      let appointmentsUpdated = 0;
      const issues: string[] = [];

      for (const patient of allPatients) {
        try {
          const isEPC = pmsClient.isEPCPatient(patient);
          const isWC = pmsClient.isWCPatient(patient);

          if (isEPC || isWC) {
            const patientData = this.mapPatientProperties(patient, pmsType);

            // Upsert patient
            const { error: patientError } = await this.supabase.from('patients').upsert(
              {
                user_id: userId,
                pms_patient_id: patientData.id,
                pms_type: pmsType,
                first_name: patientData.first_name,
                last_name: patientData.last_name,
                email: patientData.email,
                phone: patientData.phone,
                date_of_birth: patientData.date_of_birth,
                patient_type: isEPC ? 'EPC' : 'WC',
                physio_name: patientData.physio_name,
                pms_last_modified: patientData.pms_last_modified,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: 'user_id,pms_patient_id,pms_type',
              }
            );

            if (!patientError) {
              patientsUpdated++;

              // Sync appointments for this patient
              try {
                const appointments = await pmsClient.getPatientAppointments(patientData.id);
                const completedAppointments = appointments.filter((apt: any) =>
                  pmsClient.isCompletedAppointment(apt)
                );

                for (const appointment of completedAppointments) {
                  const appointmentData = this.mapAppointmentProperties(appointment, pmsType);

                  const { error: appointmentError } = await this.supabase
                    .from('appointments')
                    .upsert(
                      {
                        user_id: userId,
                        patient_id: Number.parseInt(patientData.id),
                        pms_appointment_id: appointmentData.id,
                        pms_type: pmsType,
                        appointment_date: appointmentData.appointment_date,
                        appointment_type: appointmentData.appointment_type,
                        practitioner_name: appointmentData.practitioner_name,
                        status: appointmentData.status,
                        duration_minutes: appointmentData.duration_minutes,
                        is_completed: true,
                        updated_at: new Date().toISOString(),
                      },
                      {
                        onConflict: 'user_id,pms_appointment_id,pms_type',
                      }
                    );

                  if (!appointmentError) {
                    appointmentsUpdated++;
                  }
                }
              } catch (appointmentError) {
                issues.push(`Could not sync appointments for patient ${patientData.id}`);
              }
            } else {
              issues.push(`Could not update patient ${patientData.id}: ${patientError.message}`);
            }
          }
        } catch (patientError) {
          issues.push(`Error processing patient ${patient.id || 'unknown'}: ${patientError}`);
        }
      }

      // Update sync log with success
      await this.supabase
        .from('sync_logs')
        .update({
          status: 'completed',
          patients_synced: patientsUpdated,
          appointments_synced: appointmentsUpdated,
          completed_at: new Date().toISOString(),
          error_details: issues.length > 0 ? { issues } : null,
        })
        .eq('id', syncLogId);

      // Update last sync time
      await this.supabase.from('sync_controls').upsert(
        {
          user_id: userId,
          pms_type: pmsType,
          last_sync_at: new Date().toISOString(),
          next_sync_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,pms_type',
        }
      );

      console.log(
        `[SCHEDULER] Full sync completed for user ${userId}: ${patientsUpdated} patients, ${appointmentsUpdated} appointments`
      );
    } catch (error) {
      console.error(`[SCHEDULER] Full sync failed for user ${userId}:`, error);

      // Update sync log with failure
      await this.supabase
        .from('sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        })
        .eq('id', syncLogId);

      throw error;
    }
  }

  private async performIncrementalSync(
    userId: string,
    pmsType: PMSType,
    syncLogId: string
  ): Promise<void> {
    try {
      console.log(`[SCHEDULER] Performing incremental sync for user ${userId}`);

      // Get last sync time
      const { data: syncControl } = await this.supabase
        .from('sync_controls')
        .select('last_sync_at')
        .eq('user_id', userId)
        .eq('pms_type', pmsType)
        .single();

      const lastSyncAt = syncControl?.last_sync_at
        ? new Date(syncControl.last_sync_at)
        : new Date(0);

      // Get API credentials
      const credentials = await getDecryptedApiKey(userId, pmsType);
      if (!credentials) {
        throw new Error('No API credentials found');
      }

      // Create PMS client
      const pmsClient = PMSFactory.createClient(pmsType, credentials.apiKey);

      // Get modified patients since last sync
      const modifiedPatients = await pmsClient.getModifiedPatients(lastSyncAt);
      console.log(`[SCHEDULER] Found ${modifiedPatients.length} modified patients`);

      let patientsUpdated = 0;
      let appointmentsUpdated = 0;
      const issues: string[] = [];

      for (const patient of modifiedPatients) {
        try {
          const isEPC = pmsClient.isEPCPatient(patient);
          const isWC = pmsClient.isWCPatient(patient);

          if (isEPC || isWC) {
            const patientData = this.mapPatientProperties(patient, pmsType);

            // Upsert patient
            const { error: patientError } = await this.supabase.from('patients').upsert(
              {
                user_id: userId,
                pms_patient_id: patientData.id,
                pms_type: pmsType,
                first_name: patientData.first_name,
                last_name: patientData.last_name,
                email: patientData.email,
                phone: patientData.phone,
                date_of_birth: patientData.date_of_birth,
                patient_type: isEPC ? 'EPC' : 'WC',
                physio_name: patientData.physio_name,
                pms_last_modified: patientData.pms_last_modified,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: 'user_id,pms_patient_id,pms_type',
              }
            );

            if (!patientError) {
              patientsUpdated++;

              // Sync recent appointments for this patient
              try {
                const appointments = await pmsClient.getPatientAppointments(
                  patientData.id,
                  lastSyncAt
                );
                const completedAppointments = appointments.filter((apt: any) =>
                  pmsClient.isCompletedAppointment(apt)
                );

                for (const appointment of completedAppointments) {
                  const appointmentData = this.mapAppointmentProperties(appointment, pmsType);

                  const { error: appointmentError } = await this.supabase
                    .from('appointments')
                    .upsert(
                      {
                        user_id: userId,
                        patient_id: Number.parseInt(patientData.id),
                        pms_appointment_id: appointmentData.id,
                        pms_type: pmsType,
                        appointment_date: appointmentData.appointment_date,
                        appointment_type: appointmentData.appointment_type,
                        practitioner_name: appointmentData.practitioner_name,
                        status: appointmentData.status,
                        duration_minutes: appointmentData.duration_minutes,
                        is_completed: true,
                        updated_at: new Date().toISOString(),
                      },
                      {
                        onConflict: 'user_id,pms_appointment_id,pms_type',
                      }
                    );

                  if (!appointmentError) {
                    appointmentsUpdated++;
                  }
                }
              } catch (appointmentError) {
                issues.push(`Could not sync appointments for patient ${patientData.id}`);
              }
            } else {
              issues.push(`Could not update patient ${patientData.id}: ${patientError.message}`);
            }
          }
        } catch (patientError) {
          issues.push(`Error processing patient ${patient.id || 'unknown'}: ${patientError}`);
        }
      }

      // Update sync log with success
      await this.supabase
        .from('sync_logs')
        .update({
          status: 'completed',
          patients_synced: patientsUpdated,
          appointments_synced: appointmentsUpdated,
          completed_at: new Date().toISOString(),
          error_details: issues.length > 0 ? { issues } : null,
        })
        .eq('id', syncLogId);

      // Update last sync time
      await this.supabase.from('sync_controls').upsert(
        {
          user_id: userId,
          pms_type: pmsType,
          last_sync_at: new Date().toISOString(),
          next_sync_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,pms_type',
        }
      );

      console.log(
        `[SCHEDULER] Incremental sync completed for user ${userId}: ${patientsUpdated} patients, ${appointmentsUpdated} appointments`
      );
    } catch (error) {
      console.error(`[SCHEDULER] Incremental sync failed for user ${userId}:`, error);

      // Update sync log with failure
      await this.supabase
        .from('sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        })
        .eq('id', syncLogId);

      throw error;
    }
  }

  private mapPatientProperties(patient: any, pmsType: PMSType): any {
    if (pmsType === 'cliniko') {
      // Cliniko uses camelCase properties
      return {
        id: patient.id,
        first_name: patient.firstName || patient.first_name,
        last_name: patient.lastName || patient.last_name,
        email: patient.email,
        phone: patient.phone,
        date_of_birth: patient.dateOfBirth || patient.date_of_birth,
        physio_name: patient.physioName || patient.physio_name,
        pms_last_modified: patient.lastModified || patient.pms_last_modified || patient.updated_at,
      };
    } else {
      // Nookal and Halaxy use snake_case properties (matching database schema)
      return {
        id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        email: patient.email,
        phone: patient.phone,
        date_of_birth: patient.date_of_birth,
        physio_name: patient.physio_name,
        pms_last_modified: patient.pms_last_modified,
      };
    }
  }

  private mapAppointmentProperties(appointment: any, pmsType: PMSType): any {
    if (pmsType === 'cliniko') {
      // Cliniko uses different property names
      return {
        id: appointment.id,
        appointment_date: appointment.date || appointment.appointment_date,
        appointment_type: appointment.type || appointment.appointment_type,
        practitioner_name: appointment.physioName || appointment.practitioner_name,
        status: appointment.status,
        duration_minutes: appointment.duration_minutes || appointment.duration,
      };
    } else {
      // Nookal and Halaxy use snake_case properties (matching database schema)
      return {
        id: appointment.id,
        appointment_date: appointment.appointment_date,
        appointment_type: appointment.appointment_type,
        practitioner_name: appointment.practitioner_name,
        status: appointment.status,
        duration_minutes: appointment.duration_minutes,
      };
    }
  }
}

// Global scheduler instance
let globalScheduler: SyncScheduler | null = null;

export function getGlobalScheduler(): SyncScheduler {
  if (!globalScheduler) {
    globalScheduler = new SyncScheduler();
  }
  return globalScheduler;
}

export type { PMSType, SyncResult };

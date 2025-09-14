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

      // Create cases from synced data
      console.log(`[SCHEDULER] Creating cases for user ${userId}...`);
      let casesCreated = 0;
      let casesUpdated = 0;

      try {
        const casesResult = await this.createCasesFromSyncedData(userId, pmsType);
        casesCreated = casesResult.casesCreated;
        casesUpdated = casesResult.casesUpdated;
        console.log(`[SCHEDULER] Cases created: ${casesCreated}, updated: ${casesUpdated}`);
      } catch (caseError) {
        console.error(`[SCHEDULER] Error creating cases:`, caseError);
        issues.push(
          `Case creation failed: ${caseError instanceof Error ? caseError.message : 'Unknown error'}`
        );
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

      // Create cases from synced data
      console.log(`[SCHEDULER] Creating cases for user ${userId}...`);
      let casesCreated = 0;
      let casesUpdated = 0;

      try {
        const casesResult = await this.createCasesFromSyncedData(userId, pmsType);
        casesCreated = casesResult.casesCreated;
        casesUpdated = casesResult.casesUpdated;
        console.log(`[SCHEDULER] Cases created: ${casesCreated}, updated: ${casesUpdated}`);
      } catch (caseError) {
        console.error(`[SCHEDULER] Error creating cases:`, caseError);
        issues.push(
          `Case creation failed: ${caseError instanceof Error ? caseError.message : 'Unknown error'}`
        );
      }

      console.log(
        `[SCHEDULER] Incremental sync completed for user ${userId}: ${patientsUpdated} patients, ${appointmentsUpdated} appointments, ${casesCreated} cases created, ${casesUpdated} cases updated`
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
      // Nookal uses snake_case properties (matching database schema)
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
      // Nookal uses snake_case properties (matching database schema)
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

  // Method to create cases from synced patients and appointments data
  private async createCasesFromSyncedData(
    userId: string,
    pmsType: PMSType
  ): Promise<{ casesCreated: number; casesUpdated: number }> {
    try {
      console.log(`[SCHEDULER CASES] Starting case creation for user ${userId} (${pmsType})`);

      let casesCreated = 0;
      let casesUpdated = 0;
      const issues: string[] = [];

      // Get user's custom WC and EPC tags
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('wc, epc')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error(`[SCHEDULER CASES] Error fetching user tags:`, userError);
        return { casesCreated: 0, casesUpdated: 0 };
      }

      const wcTag = userData.wc || 'WC';
      const epcTag = userData.epc || 'EPC';

      console.log(`[SCHEDULER CASES] Using tags - WC: ${wcTag}, EPC: ${epcTag}`);

      // Determine the active year based on user's latest appointment
      const { data: latestAppointment } = await this.supabase
        .from('appointments')
        .select('appointment_date')
        .eq('user_id', userId)
        .in('status', ['completed', 'attended', 'finished'])
        .order('appointment_date', { ascending: false })
        .limit(1)
        .single();

      const activeYear = latestAppointment
        ? new Date(latestAppointment.appointment_date).getFullYear()
        : new Date().getFullYear();

      console.log(`[SCHEDULER CASES] Using active year: ${activeYear} for user ${userId}`);

      // Get all patients for this user that have appointments
      const { data: patients, error: patientsError } = await this.supabase
        .from('patients')
        .select(
          `
          id,
          pms_patient_id,
          first_name,
          last_name,
          email,
          phone,
          date_of_birth,
          patient_type,
          physio_name,
          quota,
          sessions_used,
          status,
          alert_preference
        `
        )
        .eq('user_id', userId)
        .eq('pms_type', pmsType);

      if (patientsError || !patients || patients.length === 0) {
        console.log(`[SCHEDULER CASES] No patients found for user ${userId}`);
        return { casesCreated: 0, casesUpdated: 0 };
      }

      console.log(`[SCHEDULER CASES] Found ${patients.length} patients to process for cases`);

      // Process each patient to create/update cases
      for (const patient of patients) {
        try {
          // Calculate actual sessions used based on funding scheme and year
          const sessionData = await this.calculatePatientSessions(
            patient.id,
            patient.patient_type,
            wcTag,
            epcTag,
            activeYear
          );

          console.log(
            `[SCHEDULER CASES] Patient ${patient.id} (${patient.patient_type}): ${sessionData.sessionsUsed}/${sessionData.quota} sessions, ${sessionData.sessionsRemaining} remaining`
          );

          // Update patient record with correct session count and quota
          await this.supabase
            .from('patients')
            .update({
              sessions_used: sessionData.sessionsUsed,
              quota: sessionData.quota,
              updated_at: new Date().toISOString(),
            })
            .eq('id', patient.id);

          // Get the most recent appointment for this patient
          const { data: latestPatientAppointment } = await this.supabase
            .from('appointments')
            .select(
              `
              appointment_date,
              practitioner_id,
              practitioner_name,
              appointment_type,
              location_name
            `
            )
            .eq('patient_id', patient.id)
            .order('appointment_date', { ascending: false })
            .limit(1)
            .single();

          // Set default values
          const locationName = latestPatientAppointment?.location_name || 'Main Clinic';
          const appointmentTypeName =
            latestPatientAppointment?.appointment_type || patient.patient_type;

          // Get practitioner ID and name from appointment data
          let practitionerId = null;
          let physioName = null;

          // Priority 1: Use practitioner name from appointment if available
          if (latestPatientAppointment?.practitioner_name) {
            physioName = latestPatientAppointment.practitioner_name;
            console.log(
              `[SCHEDULER CASES] Using practitioner name from appointment: ${physioName}`
            );

            // Try to find practitioner by name for ID
            const { data: practitioner } = await this.supabase
              .from('practitioners')
              .select('id, display_name, first_name, last_name')
              .eq('user_id', userId)
              .eq('pms_type', pmsType)
              .or(
                `display_name.eq.${physioName},first_name.eq.${physioName},last_name.eq.${physioName}`
              )
              .single();

            if (practitioner) {
              practitionerId = practitioner.id;
            }
          }

          // Priority 2: If no practitioner name, try to find by practitioner ID from appointment
          if (!physioName && latestPatientAppointment?.practitioner_id) {
            console.log(
              `[SCHEDULER CASES] Looking for practitioner by ID: ${latestPatientAppointment.practitioner_id}`
            );
            const { data: practitioner } = await this.supabase
              .from('practitioners')
              .select('id, display_name, first_name, last_name')
              .eq('user_id', userId)
              .eq('pms_type', pmsType)
              .eq('pms_practitioner_id', latestPatientAppointment.practitioner_id.toString())
              .single();

            if (practitioner) {
              practitionerId = practitioner.id;
              physioName =
                practitioner.display_name ||
                `${practitioner.first_name} ${practitioner.last_name}`.trim();
            } else {
              console.log(
                `[SCHEDULER CASES] No practitioner found by ID: ${latestPatientAppointment.practitioner_id}`
              );
            }
          }

          // Priority 3: If still no practitioner found, use patient's physio_name as fallback
          if (!physioName && patient.physio_name) {
            physioName = patient.physio_name;
            console.log(`[SCHEDULER CASES] Using patient's physio_name as fallback: ${physioName}`);
          }

          // Priority 4: Use the first available practitioner as final fallback
          if (!physioName) {
            const { data: fallbackPractitioner } = await this.supabase
              .from('practitioners')
              .select('id, display_name, first_name, last_name')
              .eq('user_id', userId)
              .eq('pms_type', pmsType)
              .limit(1)
              .single();

            if (fallbackPractitioner) {
              practitionerId = fallbackPractitioner.id;
              physioName =
                fallbackPractitioner.display_name ||
                `${fallbackPractitioner.first_name} ${fallbackPractitioner.last_name}`.trim();
              console.log(
                `[SCHEDULER CASES] Using first available practitioner as fallback: ${physioName} for patient ${patient.id}`
              );
            }
          }

          // Final fallback: Use a default name if nothing else works
          if (!physioName) {
            physioName = 'Unknown Practitioner';
            console.log(`[SCHEDULER CASES] No practitioner found, using default: ${physioName}`);
          }

          console.log(
            `[SCHEDULER CASES] Final physio_name for patient ${patient.id}: ${physioName}`
          );

          const nextVisitDate = latestPatientAppointment?.appointment_date
            ? new Date(latestPatientAppointment.appointment_date)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const lastVisitDate = latestPatientAppointment?.appointment_date || null;

          // Use calculated session data
          const programType = patient.patient_type;
          const quota = sessionData.quota;
          const sessionsUsed = sessionData.sessionsUsed;
          const sessionsRemaining = sessionData.sessionsRemaining;

          // Determine case status and priority
          let caseStatus = patient.status || 'active';
          let priority = 'low';
          let alertMessage = null;
          let isAlertActive = false;

          if (sessionsRemaining <= 0) {
            caseStatus = 'critical';
            priority = 'urgent';
            alertMessage = `${programType} quota exhausted - renewal needed immediately`;
            isAlertActive = true;
          } else if (sessionsRemaining <= 2) {
            caseStatus = 'warning';
            priority = 'high';
            alertMessage = `${programType} referral expires soon - ${sessionsRemaining} sessions left`;
            isAlertActive = true;
          } else if (sessionsRemaining <= 3) {
            caseStatus = 'warning';
            priority = 'normal';
            alertMessage = `${programType} sessions running low - ${sessionsRemaining} sessions left`;
            isAlertActive = true;
          }

          // Check if case already exists
          const { data: existingCase } = await this.supabase
            .from('cases')
            .select('id')
            .eq('user_id', userId)
            .eq('patient_id', patient.id)
            .eq('pms_type', pmsType)
            .single();

          const caseData = {
            user_id: userId,
            patient_id: patient.id,
            pms_type: pmsType,
            case_number: `CASE-${patient.pms_patient_id}`,
            case_title: `${patient.first_name} ${patient.last_name} - ${programType}`,
            patient_first_name: patient.first_name,
            patient_last_name: patient.last_name,
            patient_email: patient.email,
            patient_phone: patient.phone,
            patient_date_of_birth: patient.date_of_birth,
            location_name: locationName,
            practitioner_id: practitionerId,
            physio_name: physioName,
            appointment_type_name: appointmentTypeName,
            program_type: programType,
            quota: quota,
            sessions_used: sessionsUsed,
            status: caseStatus,
            priority: priority,
            next_visit_date: nextVisitDate.toISOString().split('T')[0],
            last_visit_date: lastVisitDate
              ? new Date(lastVisitDate).toISOString().split('T')[0]
              : null,
            case_start_date: new Date().toISOString().split('T')[0],
            alert_preference: patient.alert_preference || 2,
            is_alert_active: isAlertActive,
            alert_message: alertMessage,
            updated_at: new Date().toISOString(),
          };

          if (existingCase) {
            // Update existing case
            const { error: updateError } = await this.supabase
              .from('cases')
              .update(caseData)
              .eq('id', existingCase.id);

            if (updateError) {
              console.error(
                `[SCHEDULER CASES] Error updating case for patient ${patient.id}:`,
                updateError
              );
              issues.push(`Failed to update case for patient ${patient.id}`);
            } else {
              casesUpdated++;
              console.log(
                `[SCHEDULER CASES] ✅ Updated case for patient ${patient.id} - Sessions: ${sessionsUsed}/${quota} (${sessionsRemaining} remaining)`
              );
            }
          } else {
            // Create new case
            const { error: insertError } = await this.supabase.from('cases').insert({
              ...caseData,
              created_at: new Date().toISOString(),
            });

            if (insertError) {
              console.error(
                `[SCHEDULER CASES] Error creating case for patient ${patient.id}:`,
                insertError
              );
              issues.push(`Failed to create case for patient ${patient.id}`);
            } else {
              casesCreated++;
              console.log(
                `[SCHEDULER CASES] ✅ Created case for patient ${patient.id} - Sessions: ${sessionsUsed}/${quota} (${sessionsRemaining} remaining)`
              );
            }
          }
        } catch (error) {
          console.error(
            `[SCHEDULER CASES] Error processing patient ${patient.id} for case creation:`,
            error
          );
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          issues.push(`Error processing patient ${patient.id}: ${errorMessage}`);
        }
      }

      console.log(`[SCHEDULER CASES] Case creation completed for user ${userId}`);
      console.log(`[SCHEDULER CASES] Summary: ${casesCreated} created, ${casesUpdated} updated`);

      if (issues.length > 0) {
        console.log(`[SCHEDULER CASES] Issues encountered:`, issues);
      }

      return { casesCreated, casesUpdated };
    } catch (error) {
      console.error(`[SCHEDULER CASES] Case creation failed for user ${userId}:`, error);
      return { casesCreated: 0, casesUpdated: 0 };
    }
  }

  // Helper method to calculate patient sessions
  private async calculatePatientSessions(
    patientId: string,
    programType: string,
    wcTag: string,
    epcTag: string,
    activeYear: number
  ): Promise<{ sessionsUsed: number; quota: number; sessionsRemaining: number }> {
    let sessionsUsed = 0;
    let quota = 5; // Default EPC quota

    try {
      if (programType === 'WC') {
        // WorkCover: Count ALL completed WC sessions (injury-based, no year limit)
        let { count: wcSessionsTotal } = await this.supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('patient_id', patientId)
          .eq('appointment_type', wcTag)
          .in('status', ['completed', 'attended', 'finished']);

        // If no results, try without status filter (fallback)
        if (!wcSessionsTotal || wcSessionsTotal === 0) {
          const { count: wcSessionsFallback } = await this.supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('patient_id', patientId)
            .eq('appointment_type', wcTag);

          wcSessionsTotal = wcSessionsFallback || 0;
        }

        sessionsUsed = wcSessionsTotal || 0;
        quota = 8; // Default WC quota
      } else if (programType === 'EPC') {
        // EPC: Count only current active year sessions
        let { count: epcSessionsThisYear } = await this.supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('patient_id', patientId)
          .eq('appointment_type', epcTag)
          .in('status', ['completed', 'attended', 'finished'])
          .gte('appointment_date', `${activeYear}-01-01`)
          .lte('appointment_date', `${activeYear}-12-31`);

        // If no results, try without status filter (fallback)
        if (!epcSessionsThisYear || epcSessionsThisYear === 0) {
          const { count: epcSessionsFallback } = await this.supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('patient_id', patientId)
            .eq('appointment_type', epcTag)
            .gte('appointment_date', `${activeYear}-01-01`)
            .lte('appointment_date', `${activeYear}-12-31`);

          epcSessionsThisYear = epcSessionsFallback || 0;
        }

        sessionsUsed = epcSessionsThisYear || 0;
        quota = 5; // EPC quota per calendar year
      }
    } catch (error) {
      console.error(
        `[SCHEDULER CASES] Error calculating sessions for patient ${patientId}:`,
        error
      );
      sessionsUsed = 0;
    }

    const sessionsRemaining = Math.max(0, quota - sessionsUsed);

    return {
      sessionsUsed,
      quota,
      sessionsRemaining,
    };
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

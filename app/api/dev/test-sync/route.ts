import { type NextRequest, NextResponse } from 'next/server';
import { PMSFactory } from '@/lib/pms/factory';
import { config } from '@/lib/config';
import { createAdminClient } from '@/lib/supabase/server-admin';

export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    console.log('=== Starting Manual Dev Sync ===');

    const supabase = createAdminClient();

    const { data: credentials, error: credentialsError } = await supabase
      .from('pms_api_keys')
      .select('*')
      .eq('is_active', true);

    if (credentialsError) {
      console.error('Error fetching credentials:', credentialsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    console.log('=== CREDENTIALS DEBUG ===');
    console.log('Credentials found:', credentials?.length || 0);
    console.log('Credentials data:', JSON.stringify(credentials, null, 2));
    console.log('========================');

    if (!credentials || credentials.length === 0) {
      console.log('No active credentials found - returning early');
      return NextResponse.json({
        success: true,
        processedUsers: 0,
        results: [],
        message: 'No active credentials found in database',
      });
    }

    const syncResults = [];

    for (const credential of credentials || []) {
      try {
        console.log(`Syncing for user ${credential.user_id} (${credential.pms_type})`);

        // Decrypt the API key
        const { decryptApiKey } = await import('@/lib/supabase/server-admin');
        const decryptedApiKey = decryptApiKey(credential.api_key_encrypted);

        // For now, we'll use a default lastSyncAt since we don't have it in pms_api_keys
        const lastSyncAt = new Date(0); // Start from beginning

        const pmsClient = PMSFactory.createClient(credential.pms_type, decryptedApiKey, {
          apiUrl: credential.api_url,
          clinicId: credential.clinic_id,
        });

        let result;

        if (credential.pms_type === 'nookal') {
          // Special handling for Nookal - batch processing
          result = await performNookalBatchSync(
            supabase,
            credential.user_id,
            pmsClient,
            {} // Empty sync progress for now
          );
        } else {
          // Standard incremental sync for other PMS systems
          result = await performIncrementalSync(
            supabase,
            credential.user_id,
            pmsClient,
            credential.pms_type,
            lastSyncAt
          );
        }

        syncResults.push({
          userId: credential.user_id,
          pmsType: credential.pms_type,
          ...result,
        });

        await supabase.from('sync_logs').insert({
          user_id: credential.user_id,
          pms_type: credential.pms_type,
          sync_type: result.syncType || 'incremental',
          status: result.success ? 'completed' : 'failed',
          patients_synced: result.patientsUpdated || 0,
          appointments_synced: result.appointmentsUpdated || 0,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          details: result.details || {},
          error_message: result.error,
          sync_progress: result.details || {}, // Store sync progress for next run
        });
      } catch (error) {
        console.error(`Sync failed for user ${credential.user_id}:`, error);

        await supabase.from('sync_logs').insert({
          user_id: credential.user_id,
          pms_type: credential.pms_type,
          sync_type: 'incremental',
          status: 'failed',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });

        syncResults.push({
          userId: credential.user_id,
          pmsType: credential.pms_type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('=== Manual Dev Sync Complete ===');
    console.log(`Processed ${syncResults.length} users`);

    return NextResponse.json({
      success: true,
      processedUsers: syncResults.length,
      results: syncResults,
    });
  } catch (error) {
    console.error('Manual dev sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function performIncrementalSync(
  supabase: any,
  userId: string,
  pmsClient: any,
  pmsType: string,
  lastSyncAt: Date
) {
  try {
    let patientsUpdated = 0;
    let appointmentsUpdated = 0;
    const issues: string[] = [];

    const modifiedPatients = await pmsClient.getModifiedPatients(lastSyncAt);
    console.log(`Found ${modifiedPatients.length} modified patients for user ${userId}`);

    for (const patient of modifiedPatients) {
      // For Nookal, all patients are now fetched without EPC/WC filtering
      // We'll assign a default patient type based on the PMS type
      let patientType = 'EPC'; // Default to EPC (uppercase)

      // If the PMS client has specific logic for determining patient type, use it
      if (pmsClient.isEPCPatient && pmsClient.isWCPatient) {
        const isEPC = pmsClient.isEPCPatient(patient);
        const isWC = pmsClient.isWCPatient(patient);

        if (isEPC) {
          patientType = 'EPC';
        } else if (isWC) {
          patientType = 'WC';
        }
      }

      // For Nookal, we now process all patients regardless of type
      const { error: patientError } = await supabase.from('patients').upsert({
        user_id: userId,
        pms_patient_id: patient.id,
        pms_type: pmsType,
        first_name: patient.first_name,
        last_name: patient.last_name,
        email: patient.email,
        phone: patient.phone,
        date_of_birth: patient.date_of_birth,
        patient_type: patientType,
        updated_at: new Date().toISOString(),
      });

      if (!patientError) {
        patientsUpdated++;

        try {
          const appointments = await pmsClient.getPatientAppointments(patient.id, lastSyncAt);
          const completedAppointments = appointments.filter((apt: any) =>
            pmsClient.isCompletedAppointment(apt)
          );

          for (const appointment of completedAppointments) {
            // Resolve the patient's UUID from our patients table before inserting appointment
            const { data: patientRow, error: patientLookupError } = await supabase
              .from('patients')
              .select('id')
              .eq('user_id', userId)
              .eq('pms_type', pmsType)
              .eq('pms_patient_id', patient.id)
              .single();

            if (patientLookupError || !patientRow) {
              issues.push(`Could not resolve patient UUID for patient ${patient.id}`);
              continue;
            }

            const { error: appointmentError } = await supabase.from('appointments').upsert({
              user_id: userId,
              patient_id: patientRow.id,
              pms_appointment_id: appointment.id,
              pms_type: pmsType,
              appointment_date: appointment.appointment_start,
              appointment_type: appointment.appointment_type?.name,
              practitioner_name: appointment.practitioner?.name,
              status: appointment.status,
              duration_minutes: appointment.duration,
              updated_at: new Date().toISOString(),
            });

            if (!appointmentError) {
              appointmentsUpdated++;
            }
          }
        } catch (appointmentError) {
          issues.push(`Could not sync appointments for patient ${patient.id}`);
        }
      } else {
        issues.push(`Could not update patient ${patient.id}`);
      }
    }

    // Note: We're not updating last_sync_at since we don't have a users table
    // The sync progress is tracked in sync_logs instead

    return {
      success: true,
      patientsUpdated,
      appointmentsUpdated,
      details: { issues: issues.length > 0 ? issues : undefined },
    };
  } catch (error) {
    console.error('Incremental sync error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function performNookalBatchSync(
  supabase: any,
  userId: string,
  pmsClient: any,
  syncProgress: any
): Promise<any> {
  try {
    console.log(`[NOOKAL] Starting batch sync for user ${userId}`);

    // Get current sync progress from the latest sync log
    let currentPage = 1;
    let totalPatients = 0;
    let patientsProcessed = 0;

    // Get the latest sync log to check progress
    const { data: latestSyncLog } = await supabase
      .from('sync_logs')
      .select('sync_progress, patients_processed')
      .eq('user_id', userId)
      .eq('pms_type', 'nookal')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (latestSyncLog?.sync_progress) {
      currentPage = latestSyncLog.sync_progress.sync_page || 1;
      totalPatients = latestSyncLog.sync_progress.totalPatients || 0;
      patientsProcessed = latestSyncLog.sync_progress.patientsProcessed || 0;
      console.log(
        `[NOOKAL] Resuming from page ${currentPage}, progress: ${patientsProcessed}/${totalPatients}`
      );
    }

    // If this is the first run, check if we already have patients in the database
    if (totalPatients === 0) {
      console.log(`[NOOKAL] First run - checking database for existing patients...`);

      // Check how many patients we already have
      const { count: existingPatientsCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('pms_type', 'nookal');

      if (existingPatientsCount && existingPatientsCount > 0) {
        // Calculate which page we should start from based on existing patients
        currentPage = Math.floor(existingPatientsCount / 200) + 1;
        patientsProcessed = existingPatientsCount;
        console.log(
          `[NOOKAL] Found ${existingPatientsCount} existing patients, starting from page ${currentPage}`
        );
      }

      // Get total count from API
      console.log(`[NOOKAL] Getting total patient count from API...`);
      const totalCount = await pmsClient.getTotalPatientCount();
      totalPatients = totalCount;
      console.log(`[NOOKAL] Total patients available: ${totalPatients}`);
    }

    // Fetch current page of patients
    console.log(`[NOOKAL] Fetching page ${currentPage} with 200 patients...`);
    const patients = await pmsClient.getAllPatients(currentPage, 200);

    // DEBUG: Log the raw patients response
    console.log(`[NOOKAL] Raw patients response:`, JSON.stringify(patients, null, 2));
    console.log(`[NOOKAL] Patients type:`, typeof patients);
    console.log(`[NOOKAL] Patients is array:`, Array.isArray(patients));
    console.log(`[NOOKAL] Patients length:`, patients?.length || 0);

    if (!patients || patients.length === 0) {
      console.log(`[NOOKAL] No patients found on page ${currentPage} - sync complete`);
      return {
        success: true,
        syncType: 'batch',
        patientsUpdated: 0,
        appointmentsUpdated: 0,
        details: {
          message: 'No more patients to sync',
          sync_page: currentPage,
          totalPatients,
          patientsProcessed,
        },
      };
    }

    console.log(`[NOOKAL] Processing page ${currentPage}: ${patients.length} patients`);

    let patientsUpdated = 0;
    let appointmentsUpdated = 0;
    const issues: string[] = [];

    // Process patients in this page
    for (const patient of patients) {
      try {
        // DEBUG: Log each patient structure
        console.log(`[NOOKAL] Processing patient:`, JSON.stringify(patient, null, 2));
        console.log(`[NOOKAL] Patient ID:`, patient.id);
        console.log(`[NOOKAL] Patient firstName:`, patient.firstName);
        console.log(`[NOOKAL] Patient lastName:`, patient.lastName);

        console.log(
          `[NOOKAL] Processing patient ${patient.id}: ${patient.firstName} ${patient.lastName}`
        );

        // Validate and clean date_of_birth - convert empty strings to null
        let dateOfBirth = patient.dateOfBirth;
        if (dateOfBirth === '' || dateOfBirth === null || dateOfBirth === undefined) {
          dateOfBirth = null;
        } else {
          // Try to validate the date format
          try {
            const testDate = new Date(dateOfBirth);
            if (isNaN(testDate.getTime())) {
              console.log(
                `[NOOKAL] Invalid date format for patient ${patient.id}: ${dateOfBirth}, setting to null`
              );
              dateOfBirth = null;
            }
          } catch (error) {
            console.log(
              `[NOOKAL] Date parsing error for patient ${patient.id}: ${dateOfBirth}, setting to null`
            );
            dateOfBirth = null;
          }
        }

        const { error: patientError } = await supabase.from('patients').upsert(
          {
            user_id: userId,
            pms_patient_id: patient.id,
            pms_type: 'nookal',
            first_name: patient.firstName,
            last_name: patient.lastName,
            email: patient.email,
            phone: patient.phone,
            date_of_birth: dateOfBirth,
            patient_type: 'EPC', // Use uppercase to match database constraint
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,pms_patient_id,pms_type', // Use upsert to handle duplicates
          }
        );

        if (patientError) {
          console.error(`[NOOKAL] Patient insert error:`, patientError);
          issues.push(`Could not insert patient ${patient.id}: ${patientError.message}`);
        } else {
          console.log(`[NOOKAL] ✅ Patient ${patient.id} inserted successfully`);
          patientsUpdated++;

          // Fetch appointments for this patient
          try {
            const appointments = await pmsClient.getPatientAppointments(patient.id.toString());

            const completedAppointments = appointments.filter((apt: any) =>
              pmsClient.isCompletedAppointment(apt)
            );

            for (const appointment of completedAppointments) {
              // Resolve the patient's UUID from our patients table before inserting appointment
              const { data: patientRow, error: patientLookupError } = await supabase
                .from('patients')
                .select('id')
                .eq('user_id', userId)
                .eq('pms_type', 'nookal')
                .eq('pms_patient_id', patient.id)
                .single();

              if (patientLookupError || !patientRow) {
                issues.push(`Could not resolve patient UUID for patient ${patient.id}`);
                continue;
              }

              const { error: appointmentError } = await supabase.from('appointments').upsert(
                {
                  user_id: userId,
                  patient_id: patientRow.id,
                  pms_appointment_id: appointment.id,
                  pms_type: 'nookal',
                  appointment_date: appointment.appointment_date || appointment.date,
                  appointment_type: appointment.appointment_type?.name || appointment.type,
                  practitioner_name: appointment.practitioner?.name || appointment.physioName,
                  status: appointment.status,
                  duration_minutes: appointment.duration || appointment.durationMinutes,
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: 'user_id,pms_appointment_id,pms_type', // Use upsert to handle duplicates
                }
              );

              if (appointmentError) {
                console.error(`[NOOKAL] Appointment insert error:`, appointmentError);
              } else {
                console.log(`[NOOKAL] ✅ Appointment ${appointment.id} inserted successfully`);
                appointmentsUpdated++;
              }
            }
          } catch (appointmentError) {
            console.error(
              `[NOOKAL] Error fetching appointments for patient ${patient.id}:`,
              appointmentError
            );
            issues.push(`Could not sync appointments for patient ${patient.id}`);
          }
        }
      } catch (error) {
        console.error(`[NOOKAL] Error processing patient ${patient.id}:`, error);
        issues.push(`Error processing patient ${patient.id}: ${error}`);
      }
    }

    // Calculate next page and update progress
    const nextPage = currentPage + 1;
    const newPatientsProcessed = patientsProcessed + patientsUpdated;
    const hasMorePages = newPatientsProcessed < totalPatients;

    // Store progress details for next sync - SIMPLE PAGE-BASED APPROACH
    const progressDetails = {
      sync_page: nextPage, // Next page to fetch (1, 2, 3, etc.)
      totalPatients: totalPatients,
      patientsProcessed: newPatientsProcessed,
      hasMorePages: hasMorePages,
      lastPageSync: currentPage,
      lastBatchSync: new Date().toISOString(),
      pageSize: 200,
      patientsInThisPage: patientsUpdated,
      appointmentsInThisPage: appointmentsUpdated,
    };

    console.log(
      `[NOOKAL] Page ${currentPage} completed: ${patientsUpdated} patients, ${appointmentsUpdated} appointments`
    );
    console.log(`[NOOKAL] Progress: ${newPatientsProcessed}/${totalPatients} patients processed`);
    console.log(`[NOOKAL] Next page to fetch: ${nextPage}`);

    return {
      success: true,
      syncType: 'batch',
      patientsUpdated,
      appointmentsUpdated,
      details: {
        issues: issues.length > 0 ? issues : undefined,
        ...progressDetails,
      },
    };
  } catch (error) {
    console.error('Nookal batch sync error:', error);
    return {
      success: false,
      syncType: 'batch',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

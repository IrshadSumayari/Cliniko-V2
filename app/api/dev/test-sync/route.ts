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

        // Create cases after syncing patients and appointments
        if (result.success) {
          console.log(`Creating cases for user ${credential.user_id}...`);
          const casesResult = await createCasesFromSyncedData(
            supabase,
            credential.user_id,
            credential.pms_type
          );

          // Add cases info to the result
          result.casesCreated = casesResult.casesCreated;
          result.casesUpdated = casesResult.casesUpdated;

          console.log(
            `Cases created: ${casesResult.casesCreated}, updated: ${casesResult.casesUpdated}`
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
          details: {
            ...(result.details || {}),
            casesCreated: result.casesCreated || 0,
            casesUpdated: result.casesUpdated || 0,
          },
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

    // Calculate totals for summary
    const totalPatients = syncResults.reduce(
      (sum, result) => sum + (result.patientsUpdated || 0),
      0
    );
    const totalAppointments = syncResults.reduce(
      (sum, result) => sum + (result.appointmentsUpdated || 0),
      0
    );
    const totalCasesCreated = syncResults.reduce(
      (sum, result) => sum + (result.casesCreated || 0),
      0
    );
    const totalCasesUpdated = syncResults.reduce(
      (sum, result) => sum + (result.casesUpdated || 0),
      0
    );

    console.log(`📊 Sync Summary:`);
    console.log(`   Patients: ${totalPatients}`);
    console.log(`   Appointments: ${totalAppointments}`);
    console.log(`   Cases Created: ${totalCasesCreated}`);
    console.log(`   Cases Updated: ${totalCasesUpdated}`);

    return NextResponse.json({
      success: true,
      processedUsers: syncResults.length,
      summary: {
        totalPatients,
        totalAppointments,
        totalCasesCreated,
        totalCasesUpdated,
      },
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

// Function to create cases from synced patients and appointments data
async function createCasesFromSyncedData(
  supabase: any,
  userId: string,
  pmsType: string
) {
  try {
    console.log(`[CASES] Starting case creation for user ${userId} (${pmsType})`);
    
    let casesCreated = 0;
    let casesUpdated = 0;
    const issues: string[] = [];

    // Get user's custom WC and EPC tags
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('wc, epc')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error(`[CASES] Error fetching user tags:`, userError);
      return { casesCreated: 0, casesUpdated: 0, error: 'Failed to fetch user tags' };
    }

    const wcTag = userData.wc || 'WC';
    const epcTag = userData.epc || 'EPC';

    console.log(`[CASES] Using tags - WC: ${wcTag}, EPC: ${epcTag}`);

    // Determine the active year based on user's latest appointment
    const { data: latestAppointment } = await supabase
      .from('appointments')
      .select('appointment_date')
      .eq('user_id', userId)
      .in('status', ['completed', 'attended', 'finished']) // Use status field instead of is_completed
      .order('appointment_date', { ascending: false })
      .limit(1)
      .single();

    const activeYear = latestAppointment 
      ? new Date(latestAppointment.appointment_date).getFullYear()
      : new Date().getFullYear();

    console.log(`[CASES] Using active year: ${activeYear} for user ${userId}`);
    if (latestAppointment) {
      console.log(`[CASES] Latest appointment date: ${latestAppointment.appointment_date}`);
    } else {
      console.log(`[CASES] No appointments found, using current year: ${activeYear}`);
    }

    // Get all patients for this user that have appointments
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select(`
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
      `)
      .eq('user_id', userId)
      .eq('pms_type', pmsType);

    if (patientsError) {
      console.error(`[CASES] Error fetching patients:`, patientsError);
      return { casesCreated: 0, casesUpdated: 0, error: 'Failed to fetch patients' };
    }

    if (!patients || patients.length === 0) {
      console.log(`[CASES] No patients found for user ${userId}`);
      return { casesCreated: 0, casesUpdated: 0 };
    }

    console.log(`[CASES] Found ${patients.length} patients to process for cases`);

    // Process each patient to create/update cases
    for (const patient of patients) {
      try {
        // Calculate actual sessions used based on funding scheme and year
        const sessionData = await calculatePatientSessionsRobust(
          supabase,
          patient.id,
          patient.patient_type,
          wcTag,
          epcTag,
          activeYear
        );

        console.log(`[CASES] Patient ${patient.id} (${patient.patient_type}): ${sessionData.sessionsUsed}/${sessionData.quota} sessions, ${sessionData.sessionsRemaining} remaining`);

        // Update patient record with correct session count and quota
        await supabase
          .from('patients')
          .update({ 
            sessions_used: sessionData.sessionsUsed,
            quota: sessionData.quota,
            updated_at: new Date().toISOString()
          })
          .eq('id', patient.id);

        // Get the most recent appointment for this patient
        const { data: latestPatientAppointment, error: appointmentError } = await supabase
          .from('appointments')
          .select(`
            appointment_date,
            practitioner_name,
            appointment_type,
            location_name
          `)
          .eq('patient_id', patient.id)
          .order('appointment_date', { ascending: false })
          .limit(1)
          .single();

        if (appointmentError && appointmentError.code !== 'PGRST116') {
          console.error(
            `[CASES] Error fetching appointments for patient ${patient.id}:`,
            appointmentError
          );
          continue;
        }

        // Set default values
        const locationName = latestPatientAppointment?.location_name || 'Main Clinic';
        const physioName = latestPatientAppointment?.practitioner_name || patient.physio_name || null;
        const appointmentTypeName = latestPatientAppointment?.appointment_type || patient.patient_type;
        const nextVisitDate = latestPatientAppointment?.appointment_date
          ? new Date(latestPatientAppointment.appointment_date)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
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
        const { data: existingCase, error: caseLookupError } = await supabase
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
          const { error: updateError } = await supabase
            .from('cases')
            .update(caseData)
            .eq('id', existingCase.id);

          if (updateError) {
            console.error(`[CASES] Error updating case for patient ${patient.id}:`, updateError);
            issues.push(`Failed to update case for patient ${patient.id}`);
          } else {
            casesUpdated++;
            console.log(`[CASES] ✅ Updated case for patient ${patient.id} - Sessions: ${sessionsUsed}/${quota} (${sessionsRemaining} remaining)`);
          }
        } else {
          // Create new case
          const { error: insertError } = await supabase.from('cases').insert({
            ...caseData,
            created_at: new Date().toISOString(),
          });

          if (insertError) {
            console.error(`[CASES] Error creating case for patient ${patient.id}:`, insertError);
            issues.push(`Failed to create case for patient ${patient.id}`);
          } else {
            casesCreated++;
            console.log(`[CASES] ✅ Created case for patient ${patient.id} - Sessions: ${sessionsUsed}/${quota} (${sessionsRemaining} remaining)`);
          }
        }

      } catch (error) {
        console.error(`[CASES] Error processing patient ${patient.id} for case creation:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        issues.push(`Error processing patient ${patient.id}: ${errorMessage}`);
      }
    }

    console.log(`[CASES] Case creation completed for user ${userId}`);
    console.log(`[CASES] Summary: ${casesCreated} created, ${casesUpdated} updated`);

    if (issues.length > 0) {
      console.log(`[CASES] Issues encountered:`, issues);
    }

    return {
      casesCreated,
      casesUpdated,
      issues: issues.length > 0 ? issues : undefined
    };

  } catch (error) {
    console.error(`[CASES] Case creation failed for user ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Case creation failed';
    return {
      casesCreated: 0,
      casesUpdated: 0,
      error: errorMessage,
    };
  }
}

// Function to calculate patient sessions based on funding scheme and year
async function calculatePatientSessions(
  supabase: any,
  patientId: string,
  programType: string,
  wcTag: string,
  epcTag: string,
  activeYear: number
) {
  let sessionsUsed = 0;
  let quota = 5; // Default EPC quota
  
  if (programType === 'WC') {
    // WorkCover: Count ALL completed WC sessions (injury-based, no year limit)
    const { count: wcSessionsTotal } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', patientId)
      .eq('appointment_type', wcTag)
      .eq('is_completed', true);
    
    sessionsUsed = wcSessionsTotal || 0;
    quota = 8; // Default WC quota
    
    console.log(`[CASES] WC Patient ${patientId}: Found ${sessionsUsed} completed ${wcTag} sessions (quota: ${quota})`);
    
    // TODO: Add injury_date field to patients table for proper old injury logic
    // For now, we'll use the default 8 sessions
    // if (patient.injury_date && isOlderThan3Months(patient.injury_date)) {
    //   quota = 1; // Old injury
    // }
    
  } else if (programType === 'EPC') {
    // EPC: Count only current active year sessions
    const { count: epcSessionsThisYear } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', patientId)
      .eq('appointment_type', epcTag)
      .eq('is_completed', true)
      .gte('appointment_date', `${activeYear}-01-01`)
      .lte('appointment_date', `${activeYear}-12-31`);
    
    sessionsUsed = epcSessionsThisYear || 0;
    quota = 5; // EPC quota per calendar year
    
    console.log(`[CASES] EPC Patient ${patientId}: Found ${sessionsUsed} completed ${epcTag} sessions in ${activeYear} (quota: ${quota})`);
  }
  
  const sessionsRemaining = Math.max(0, quota - sessionsUsed);
  
  return {
    sessionsUsed,
    quota,
    sessionsRemaining
  };
}

// Enhanced function to calculate patient sessions with fallback for missing is_completed field
async function calculatePatientSessionsRobust(
  supabase: any,
  patientId: string,
  programType: string,
  wcTag: string,
  epcTag: string,
  activeYear: number
) {
  let sessionsUsed = 0;
  let quota = 5; // Default EPC quota
  
  try {
    if (programType === 'WC') {
      // WorkCover: Count ALL completed WC sessions (injury-based, no year limit)
      // First try with status field for completed appointments
      let { count: wcSessionsTotal } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', patientId)
        .eq('appointment_type', wcTag)
        .in('status', ['completed', 'attended', 'finished']);
      
      // If no results, try without status filter (fallback)
      if (!wcSessionsTotal || wcSessionsTotal === 0) {
        const { count: wcSessionsFallback } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('patient_id', patientId)
          .eq('appointment_type', wcTag);
        
        wcSessionsTotal = wcSessionsFallback || 0;
        console.log(`[CASES] WC Patient ${patientId}: Using fallback count (no status filter): ${wcSessionsTotal} ${wcTag} sessions`);
      }
      
      sessionsUsed = wcSessionsTotal || 0;
      quota = 8; // Default WC quota
      
      console.log(`[CASES] WC Patient ${patientId}: Found ${sessionsUsed} completed ${wcTag} sessions (quota: ${quota})`);
      
    } else if (programType === 'EPC') {
      // EPC: Count only current active year sessions
      // First try with status field for completed appointments
      let { count: epcSessionsThisYear } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', patientId)
        .eq('appointment_type', epcTag)
        .in('status', ['completed', 'attended', 'finished'])
        .gte('appointment_date', `${activeYear}-01-01`)
        .lte('appointment_date', `${activeYear}-12-31`);
      
      // If no results, try without status filter (fallback)
      if (!epcSessionsThisYear || epcSessionsThisYear === 0) {
        const { count: epcSessionsFallback } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('patient_id', patientId)
          .eq('appointment_type', epcTag)
          .gte('appointment_date', `${activeYear}-01-01`)
          .lte('appointment_date', `${activeYear}-12-31`);
        
        epcSessionsThisYear = epcSessionsFallback || 0;
        console.log(`[CASES] EPC Patient ${patientId}: Using fallback count (no status filter): ${epcSessionsThisYear} ${epcTag} sessions in ${activeYear}`);
      }
      
      sessionsUsed = epcSessionsThisYear || 0;
      quota = 5; // EPC quota per calendar year
      
      console.log(`[CASES] EPC Patient ${patientId}: Found ${sessionsUsed} completed ${epcTag} sessions in ${activeYear} (quota: ${quota})`);
    }
  } catch (error) {
    console.error(`[CASES] Error calculating sessions for patient ${patientId}:`, error);
    // Fallback to basic count without filters
    try {
      const { count: basicCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', patientId);
      
      sessionsUsed = basicCount || 0;
      console.log(`[CASES] Patient ${patientId}: Using basic fallback count: ${sessionsUsed} total appointments`);
    } catch (fallbackError) {
      console.error(`[CASES] Fallback count also failed for patient ${patientId}:`, fallbackError);
      sessionsUsed = 0;
    }
  }
  
  const sessionsRemaining = Math.max(0, quota - sessionsUsed);
  
  return {
    sessionsUsed,
    quota,
    sessionsRemaining
  };
}

// Helper function to check if an injury is older than 3 months
function isOlderThan3Months(injuryDate: Date): boolean {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  return injuryDate < threeMonthsAgo;
}

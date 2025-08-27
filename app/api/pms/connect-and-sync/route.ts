import { type NextRequest, NextResponse } from 'next/server';
import { PMSFactory } from '@/lib/pms/factory';
import {
  storeEncryptedApiKey,
  createAdminClient,
  storeAppointmentTypes,
} from '@/lib/supabase/server-admin';

export async function POST(request: NextRequest) {
  try {
    const { pmsType, apiKey } = await request.json();

    if (!pmsType || !apiKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    console.log('=== Auth Header Debug ===');
    console.log('Authorization header:', authHeader ? 'present' : 'missing');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return NextResponse.json(
        { error: 'Authentication required. Please provide a valid token.' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token extracted:', token ? `${token.substring(0, 20)}...` : 'missing');

    // Use createAdminClient for token-based authentication (NO COOKIES)
    const adminSupabase = createAdminClient();

    // Validate the token and get user
    const {
      data: { user },
      error: authError,
    } = await adminSupabase.auth.getUser(token);

    console.log('User data:', user ? `${user.email} (${user.id})` : 'missing');
    console.log('Auth error:', authError?.message || 'none');

    if (authError || !user) {
      console.error('Authentication failed - invalid token');
      return NextResponse.json(
        {
          error: 'Authentication failed. Please provide a valid token.',
        },
        { status: 401 }
      );
    }

    const userId = user.id;
    console.log('=== PMS Connect & Sync ===');
    console.log('PMS Type:', pmsType);
    console.log('Authenticated User ID:', userId);
    console.log('User Email:', user.email);
    console.log('API Key format:', apiKey ? `${apiKey.substring(0, 10)}...` : 'missing');

    console.log('Ensuring user record exists...');

    let userRecordData: any;

    const { data: existingUser, error: userCheckError } = await adminSupabase
      .from('users')
      .select('id, auth_user_id')
      .eq('auth_user_id', userId)
      .single();

    if (userCheckError || !existingUser) {
      console.log('User record not found, creating...');
      const { data: newUser, error: createUserError } = await adminSupabase
        .from('users')
        .insert({
          auth_user_id: userId,
          email: user.email,
          is_onboarded: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createUserError) {
        console.error('Error creating user record:', createUserError);
        return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
      }
      console.log('User record created successfully:', newUser);
      userRecordData = newUser;
    } else {
      console.log('User record exists:', existingUser);
      userRecordData = existingUser;
    }

    if (!PMSFactory.validateCredentials(pmsType, { apiKey })) {
      console.log('❌ API key validation failed for:', pmsType);
      return NextResponse.json(
        {
          error: `Invalid API key format for ${pmsType}. Please check your API key.`,
        },
        { status: 400 }
      );
    }

    console.log('✅ API key validation passed!');

    // Create PMS client
    console.log('Creating PMS client...');
    let pmsClient;
    try {
      pmsClient = PMSFactory.createClient(pmsType, apiKey);
    } catch (factoryError) {
      console.error('Error creating PMS client:', factoryError);
      return NextResponse.json(
        {
          error: `Failed to create ${pmsType} client: ${
            factoryError instanceof Error ? factoryError.message : 'Unknown error'
          }`,
        },
        { status: 400 }
      );
    }

    console.log('Testing PMS connection...');
    try {
      const isConnected = await pmsClient.testConnection();
      if (!isConnected) {
        return NextResponse.json(
          {
            error: `Failed to connect to ${pmsType}. Please verify your API key is correct.`,
          },
          { status: 400 }
        );
      }
      console.log('Connection test successful!');
    } catch (connectionError) {
      console.error('Connection test error:', connectionError);
      const errorMessage =
        connectionError instanceof Error ? connectionError.message : 'Unknown connection error';
      return NextResponse.json(
        {
          error: `Connection to ${pmsType} failed: ${errorMessage}`,
        },
        { status: 400 }
      );
    }

    console.log('Storing encrypted credentials...');
    try {
      const region = pmsType === 'cliniko' ? apiKey.split('-').pop() : undefined;
      let apiUrl: string;
      if (pmsType === 'cliniko') {
        apiUrl = `https://api.${region}.cliniko.com/v1`;
      } else if (pmsType === 'nookal') {
        apiUrl = 'https://api.nookal.com/production/v2';
      } else if (pmsType === 'halaxy') {
        apiUrl = 'https://api.halaxy.com/v1';
      } else {
        throw new Error(`Unsupported PMS type: ${pmsType}`);
      }

      await storeEncryptedApiKey(userRecordData.id, pmsType, apiKey, apiUrl);
      console.log('✅ Credentials stored successfully in database!');
    } catch (credentialsError) {
      console.error('❌ Error storing credentials:', credentialsError);
      return NextResponse.json(
        { error: 'Failed to store credentials in database' },
        { status: 500 }
      );
    }

    console.log('Fetching and storing appointment types...');
    try {
      const appointmentTypes = await pmsClient.getAppointmentTypes();
      const processedTypes = pmsClient.processAppointmentTypes(appointmentTypes);

      if (processedTypes.length > 0) {
        await storeAppointmentTypes(userRecordData.id, pmsType, processedTypes);
        console.log(`✅ Stored ${processedTypes.length} appointment types successfully!`);
      } else {
        console.log('⚠️ No EPC/WC appointment types found');
      }
    } catch (appointmentTypesError) {
      console.error('❌ Error with appointment types:', appointmentTypesError);
      // Don't fail the entire process, just log the error
    }

    console.log('Connection successful, starting practitioner sync FIRST...');

    // Step 1: Sync practitioners BEFORE anything else
    try {
      console.log('[SERVER] 🔍 Starting practitioner sync FIRST...');
      await syncPractitioners(adminSupabase, userRecordData.id, pmsClient, pmsType);
      console.log('[SERVER] ✅ Practitioner sync completed successfully');
    } catch (practitionerError) {
      console.error('[SERVER] ❌ Error syncing practitioners:', practitionerError);
      // Don't fail the whole sync if practitioners fail
    }

    console.log('Starting initial sync for patients and appointments...');

    // Verify that practitioners were synced successfully
    const { data: practitionerCount, error: practitionerCountError } = await adminSupabase
      .from('practitioners')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userRecordData.id)
      .eq('pms_type', pmsType);

    if (practitionerCountError) {
      console.log('[SERVER] ⚠️ Could not verify practitioner count:', practitionerCountError);
    } else {
      console.log(
        `[SERVER] ✅ Verified ${practitionerCount} practitioners in database before processing appointments`
      );
    }

    // Also show the actual practitioner data for debugging
    const { data: actualPractitioners, error: practitionersError } = await adminSupabase
      .from('practitioners')
      .select('pms_practitioner_id, display_name, first_name, last_name')
      .eq('user_id', userRecordData.id)
      .eq('pms_type', pmsType);

    if (practitionersError) {
      console.log('[SERVER] ⚠️ Could not fetch practitioner details:', practitionersError);
    } else {
      console.log('[SERVER] 📋 Actual practitioners in database:', actualPractitioners);
    }

    const syncResults = await performInitialSync(
      adminSupabase,
      userRecordData.id,
      pmsClient,
      pmsType
    );

    const appointmentTypesCount = await getAppointmentTypesCount(
      adminSupabase,
      userRecordData.id,
      pmsType
    );

    // Don't automatically update onboarding status - let user decide when to complete onboarding
    // await adminSupabase
    //   .from("users")
    //   .update({ is_onboarded: true })
    //   .eq("id", userRecordData.id);

    // Log sync completion
    await adminSupabase.from('sync_logs').insert({
      user_id: userRecordData.id,
      pms_type: pmsType,
      sync_type: 'initial',
      status: 'completed',
      patients_processed: syncResults.wcPatients + syncResults.epcPatients,
      patients_added: syncResults.wcPatients + syncResults.epcPatients,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      last_modified_sync: new Date().toISOString(),
    });

    return NextResponse.json({
      ...syncResults,
      appointmentTypesCount,
    });
  } catch (error) {
    console.error('PMS connect & sync error:', error);
    return NextResponse.json(
      {
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}

async function getAppointmentTypesCount(
  supabase: any,
  userId: string,
  pmsType: string
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('appointment_types')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('pms_type', pmsType);

    if (error) {
      console.error('Error getting appointment types count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getAppointmentTypesCount:', error);
    return 0;
  }
}

async function performInitialSync(supabase: any, userId: string, pmsClient: any, pmsType: string) {
  const issues: string[] = [];
  let wcPatients = 0;
  let epcPatients = 0;
  let totalAppointments = 0;

  try {
    console.log('[SERVER] Starting initial sync for user:', userId);
    console.log('[SERVER] PMS Type:', pmsType);
    console.log('[SERVER] Max appointments limit: Unlimited'); // Updated log message

    // First, get the stored appointment type IDs for this user and PMS
    const { data: userAppointmentTypes, error: typesError } = await supabase
      .from('appointment_types')
      .select('appointment_id')
      .eq('user_id', userId)
      .eq('pms_type', pmsType); //cliniko or nookal

    if (typesError) {
      console.error('[SERVER] Error fetching appointment types:', typesError);
      issues.push('Could not fetch stored appointment types');
    }

    const appointmentTypeIds = userAppointmentTypes?.map((t: any) => t.appointment_id) || [];
    console.log(
      `[SERVER] Found ${appointmentTypeIds.length} stored appointment types:`,
      appointmentTypeIds
    );

    let patients: any[] = [];
    let allAppointments: any[] = [];

    if (pmsType === 'cliniko' || pmsType === 'nookal') {
      const result = await pmsClient.getPatientsWithAppointments(undefined, appointmentTypeIds);
      patients = result.patients;
      allAppointments = result.appointments;
      console.log(
        `[SERVER] ✅ API call completed: ${patients.length} patients and ${allAppointments.length} appointments from ${pmsType}`
      );
    } else {
      // For other PMS systems
      patients = await pmsClient.getPatients(undefined, appointmentTypeIds);
      console.log(`[SERVER] Fetched ${patients.length} patients from ${pmsType}`);
    }

    const patientsToInsert = patients
      .filter((patient) => {
        const isValid = patient.patientType && patient.patientType.trim() !== '';
        if (!isValid) {
          console.log(
            `[SERVER] Filtered out patient ${patient.id} (${patient.firstName} ${patient.lastName}) - no patient type`
          );
        }
        return isValid;
      })
      .map((patient) => ({
        user_id: userId,
        pms_patient_id: String(patient.id),
        pms_type: pmsType,
        first_name: patient.firstName || '',
        last_name: patient.lastName || '',
        email: patient.email || null,
        phone: patient.phone || null,
        date_of_birth: patient.dateOfBirth || null,
        patient_type: patient.patientType,
        physio_name: patient.physioName || null,
        pms_last_modified: patient.lastModified || new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

    if (patientsToInsert.length > 0) {
      try {
        console.log(`[SERVER] Bulk inserting ${patientsToInsert.length} patients...`);
        const { data: insertedPatients, error: bulkPatientError } = await supabase
          .from('patients')
          .upsert(patientsToInsert, {
            onConflict: 'user_id,pms_patient_id,pms_type',
            ignoreDuplicates: false,
          })
          .select();

        if (bulkPatientError) {
          console.error('[SERVER] Bulk patient insert error:', bulkPatientError);
          issues.push('Failed to bulk insert patients');
        } else {
          console.log(
            `[SERVER] ✅ Successfully bulk inserted ${insertedPatients?.length || 0} patients`
          );
        }
      } catch (error) {
        console.error('[SERVER] Exception in bulk patient insert:', error);
        issues.push('Exception in bulk patient insert');
      }
    }

    // Now process ALL appointments that meet the 3 conditions (outside patient loop)
    let appointmentsToProcess: any[] = [];

    if (pmsType === 'cliniko' || pmsType === 'nookal') {
      appointmentsToProcess = allAppointments;
      console.log(
        `[SERVER] Using ${appointmentsToProcess.length} appointments from efficient ${pmsType} API call`
      );
    } else {
      // For other PMS systems, fetch appointments for each patient
      console.log('[SERVER] Fetching appointments for all patients...');
      for (const patient of patients) {
        try {
          const patientAppointments = await pmsClient.getPatientAppointments(patient.id);
          appointmentsToProcess.push(...patientAppointments);
        } catch (error) {
          console.error(`[SERVER] Error fetching appointments for patient ${patient.id}:`, error);
          issues.push(
            `Failed to fetch appointments for patient: ${patient.firstName} ${patient.lastName}`
          );
        }
      }
    }

    console.log(`[SERVER] Found ${appointmentsToProcess.length} total appointments to process`);

    // Apply the 3 conditions to ALL appointments
    const validCompletedAppointments = appointmentsToProcess.filter((apt: any) => {
      const today = new Date();
      const appointmentDate = new Date(apt.appointment_date || apt.date);

      return (
        apt.cancelled_at === null && // cancelled_at = null
        apt.did_not_arrive === false && // did_not_arrive = false
        appointmentDate <= today // appointment_date <= today
      );
    });

    console.log(
      `[SERVER] Found ${validCompletedAppointments.length} valid appointments after filtering`
    );

    // OPTIMIZATION: Get all patient IDs in one query to avoid individual lookups
    console.log('[SERVER] Fetching patient mappings for bulk appointment insert...');
    const { data: patientMappings, error: mappingError } = await supabase
      .from('patients')
      .select('id, pms_patient_id')
      .eq('user_id', userId)
      .eq('pms_type', pmsType);

    if (mappingError) {
      console.error('[SERVER] Error fetching patient mappings:', mappingError);
      issues.push('Failed to fetch patient mappings');
    } else {
      console.log(`[SERVER] Found ${patientMappings?.length || 0} patient mappings`);
    }

    // Create a fast lookup map
    const patientIdMap = new Map();
    if (patientMappings) {
      patientMappings.forEach((p: any) => {
        patientIdMap.set(String(p.pms_patient_id), p.id);
      });
    }

    // BULK INSERT: Prepare all appointments for bulk insert
    const appointmentsToInsert = await Promise.all(
      validCompletedAppointments.map(async (appointment) => {
        const appointmentPatientId = appointment.patientId || appointment.patient_id;
        const patientIdForAppointment = patientIdMap.get(String(appointmentPatientId)) || null;

        const appointmentId = appointment.id;
        if (!appointmentId) return null;

        // Convert appointment ID to number if it's a string
        let pmsAppointmentId: number;
        if (typeof appointmentId === 'string') {
          pmsAppointmentId = Number.parseInt(appointmentId, 10);
          if (isNaN(pmsAppointmentId)) return null;
        } else {
          pmsAppointmentId = appointmentId;
        }

        if (!appointment.date && !appointment.appointment_date) return null;

        // Get practitioner name from the practitioners table using practitioner_id
        let practitionerName = null;
        if (appointment.practitioner_id) {
          console.log(
            `[SERVER] 🔍 Looking up practitioner ID: ${appointment.practitioner_id} for appointment ${appointment.id}`
          );
          console.log(
            `[SERVER] 🔍 Appointment object practitioner_id:`,
            appointment.practitioner_id
          );
          console.log(`[SERVER] 🔍 Appointment object physioName:`, appointment.physioName);

          // Look up practitioner name from practitioners table
          const { data: practitioner, error: practitionerError } = await supabase
            .from('practitioners')
            .select('display_name, first_name, last_name')
            .eq('user_id', userId)
            .eq('pms_type', pmsType)
            .eq('pms_practitioner_id', appointment.practitioner_id.toString())
            .single();

          if (practitionerError) {
            console.log(
              `[SERVER] ⚠️ Practitioner lookup error for ID ${appointment.practitioner_id}:`,
              practitionerError
            );
          }

          if (practitioner) {
            practitionerName =
              practitioner.display_name ||
              `${practitioner.first_name} ${practitioner.last_name}`.trim();
            console.log(
              `[SERVER] ✅ Found practitioner: ${practitionerName} for appointment ${appointment.id}`
            );
          } else {
            console.log(
              `[SERVER] ⚠️ No practitioner found in database for ID: ${appointment.practitioner_id}`
            );
            console.log(
              `[SERVER] 🔍 Checking if practitioners exist for user ${userId} and pms_type ${pmsType}`
            );

            // Debug: Check if any practitioners exist for this user and PMS type
            const { data: allPractitioners, error: checkError } = await supabase
              .from('practitioners')
              .select('pms_practitioner_id, display_name, first_name, last_name')
              .eq('user_id', userId)
              .eq('pms_type', pmsType);

            // Fallback: Try to get practitioner name from appointment data if available
            if (appointment.physioName && appointment.physioName !== 'Unknown Practitioner') {
              practitionerName = appointment.physioName;
            }
          }
        }

        return {
          user_id: userId,
          patient_id: patientIdForAppointment,
          pms_appointment_id: pmsAppointmentId,
          pms_type: pmsType,
          appointment_date: appointment.date || appointment.appointment_date,
          appointment_type: appointment.type || appointment.appointment_type || null,
          appointment_type_id: appointment.appointment_type_id || null,
          status: appointment.status || 'unknown',
          practitioner_id: appointment.practitioner_id || null, // NEW: Store PMS practitioner ID
          // Use practitioner name from database lookup first, then fallback to appointment data, finally default to 'Unknown Practitioner'
          practitioner_name:
            practitionerName ||
            appointment.physioName ||
            appointment.practitioner_name ||
            'Unknown Practitioner',
          notes: appointment.notes || null,
          is_completed: appointment.status === 'completed' || appointment.status === 'Completed',
        };
      })
    ).then((results) => results.filter(Boolean)); // Remove null entries

    console.log(`[SERVER] Prepared ${appointmentsToInsert.length} appointments for bulk insert`);

    // BULK UPSERT: Insert or update all appointments at once to prevent duplicates
    if (appointmentsToInsert.length > 0) {
      try {
        console.log(`[SERVER] Bulk upserting ${appointmentsToInsert.length} appointments...`);

        // Use larger batch size for better performance
        const BATCH_SIZE = 200;
        const totalBatches = Math.ceil(appointmentsToInsert.length / BATCH_SIZE);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const startIndex = batchIndex * BATCH_SIZE;
          const endIndex = Math.min(startIndex + BATCH_SIZE, appointmentsToInsert.length);
          const batch = appointmentsToInsert.slice(startIndex, endIndex);

          console.log(
            `[SERVER] Processing batch ${batchIndex + 1}/${totalBatches} (${
              batch.length
            } appointments)`
          );

          // Use upsert with conflict resolution to prevent duplicates
          const { error: batchError } = await supabase.from('appointments').upsert(batch, {
            onConflict: 'user_id,pms_appointment_id,pms_type',
            ignoreDuplicates: false,
          });

          if (batchError) {
            console.error(`[SERVER] Batch ${batchIndex + 1} upsert error:`, batchError);
            issues.push(`Failed to upsert batch ${batchIndex + 1}`);
          } else {
            totalAppointments += batch.length;
            console.log(
              `[SERVER] ✅ Batch ${batchIndex + 1} completed: ${batch.length} appointments upserted`
            );
          }
        }

        console.log(
          `[SERVER] ✅ All appointments bulk upserted successfully: ${totalAppointments} total`
        );
      } catch (error) {
        console.error('[SERVER] Exception in bulk appointment upsert:', error);
        issues.push('Exception in bulk appointment upsert');
      }
    }

    // Set counts to 0 to indicate they need to be calculated after user sets tags
    wcPatients = 0;
    epcPatients = 0;

    // Practitioners are already synced before this function is called
    console.log('[SERVER] ✅ Practitioners already synced in previous step');

    // Add summary for verification
    const totalSyncedRecords = totalAppointments; // Only count appointments since patient counts are 0
    console.log(`[SERVER] 🎯 SYNC COMPLETED SUCCESSFULLY!`);
    console.log(`[SERVER] 📊 Final Results: ${totalAppointments} appointments synced successfully`);
    console.log(`[SERVER] 📋 Patient counts will be calculated after user sets custom WC/EPC tags`);

    // Create sync log entry for progress tracking
    try {
      console.log('[SERVER] Creating sync log entry for progress tracking...');

      let syncProgress = null;
      if (pmsType === 'nookal') {
        // For Nookal, create batch sync progress
        const totalPatients = wcPatients + epcPatients;
        syncProgress = {
          lastSyncedPatientId: totalPatients > 0 ? totalPatients : 0, // Mark as completed initial sync
          totalPatients: totalPatients,
          patientsProcessed: totalPatients,
          hasMorePatients: false, // Initial sync is complete
          lastBatchSync: new Date().toISOString(),
          batchSize: totalPatients,
          patientsInThisBatch: totalPatients,
          appointmentsInThisBatch: totalAppointments,
          syncType: 'initial',
        };
      }

      await supabase.from('sync_logs').insert({
        user_id: userId,
        pms_type: pmsType,
        sync_type: 'initial',
        status: 'completed',
        patients_processed: 0,
        patients_added: 0,
        patients_synced: 0,
        appointments_synced: totalAppointments,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        sync_progress: syncProgress,
        error_details: issues.length > 0 ? { issues } : null,
      });

      console.log('[SERVER] ✅ Sync log created successfully');
    } catch (logError) {
      console.error('[SERVER] Warning: Failed to create sync log:', logError);
      // Don't fail the sync if logging fails
    }

    return {
      wcPatients,
      epcPatients,
      totalAppointments,
      issues: issues.length > 0 ? issues : undefined,
    };
  } catch (error) {
    console.error('[SERVER] Sync error:', error);
    return {
      wcPatients: 0,
      epcPatients: 0,
      totalAppointments: 0,
      issues: [`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

// Sync practitioners from PMS and store in database
async function syncPractitioners(supabase: any, userId: string, pmsApi: any, pmsType: string) {
  try {
    console.log(`[PRACTITIONERS] 🔍 DEBUG: Function called with:`);
    console.log(`[PRACTITIONERS] 🔍 DEBUG: - userId: ${userId}`);
    console.log(`[PRACTITIONERS] 🔍 DEBUG: - pmsType: ${pmsType}`);
    console.log(`[PRACTITIONERS] 🔍 DEBUG: - pmsApi type: ${typeof pmsApi}`);
    console.log(
      `[PRACTITIONERS] 🔍 DEBUG: - pmsApi.getPractitioners: ${typeof pmsApi.getPractitioners}`
    );

    console.log(`[PRACTITIONERS] Starting practitioner sync for user ${userId} (${pmsType})...`);

    // Fetch practitioners from PMS API
    console.log(`[PRACTITIONERS] 🔍 DEBUG: About to call pmsApi.getPractitioners()...`);
    const practitioners = await pmsApi.getPractitioners();
    console.log(`[PRACTITIONERS] 🔍 DEBUG: getPractitioners() returned:`, practitioners);
    console.log(`[PRACTITIONERS] Found ${practitioners.length} practitioners from ${pmsType}`);

    if (practitioners.length === 0) {
      console.log('[PRACTITIONERS] No practitioners found, skipping sync');
      return;
    }

    let syncedCount = 0;
    let errorCount = 0;

    for (const practitioner of practitioners) {
      try {
        // Prepare practitioner data for database
        const practitionerData = {
          user_id: userId,
          pms_practitioner_id: practitioner.id.toString(),
          pms_type: pmsType,
          first_name: practitioner.first_name || null,
          last_name: practitioner.last_name || null,
          username: practitioner.username || null,
          display_name:
            practitioner.display_name ||
            `${practitioner.first_name || ''} ${practitioner.last_name || ''}`.trim(),
          email: practitioner.email || null,
          is_active: practitioner.is_active !== false,
          updated_at: new Date().toISOString(),
        };

        // Upsert practitioner (insert or update if exists)
        console.log(`[PRACTITIONERS] 🔍 Attempting to upsert practitioner:`, practitionerData);

        const { error: upsertError } = await supabase
          .from('practitioners')
          .upsert(practitionerData, {
            onConflict: 'user_id,pms_practitioner_id,pms_type',
          });

        if (upsertError) {
          console.error(
            `[PRACTITIONERS] Error upserting practitioner ${practitioner.id}:`,
            upsertError
          );
          errorCount++;
        } else {
          syncedCount++;
          console.log(
            `[PRACTITIONERS] ✅ Synced: ${practitionerData.display_name} (ID: ${practitioner.id})`
          );
        }
      } catch (error) {
        console.error(`[PRACTITIONERS] Error processing practitioner ${practitioner.id}:`, error);
        errorCount++;
      }
    }

    console.log(`[PRACTITIONERS] Sync completed: ${syncedCount} synced, ${errorCount} errors`);
  } catch (error) {
    console.error('[PRACTITIONERS] Error during practitioner sync:', error);
    throw error;
  }
}

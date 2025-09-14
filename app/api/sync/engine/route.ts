import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server-admin';
import { supabase } from '@/integrations/supabase/client';

interface SyncResult {
  success: boolean;
  patientsProcessed: number;
  patientsAdded: number;
  patientsUpdated: number;
  appointmentsSynced: number;
  errors: string[];
  lastSyncTime: string;
  nextSyncTime: string;
}

interface PatientData {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  patient_type?: string;
  physio_name?: string;
  pms_last_modified: string;
}

interface AppointmentData {
  id: string;
  patient_id: string;
  appointment_type: string;
  status: string;
  appointment_date: string;
  practitioner_name?: string;
  pms_last_modified: string;
}

export async function POST(req: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Get user from token
    const {
      data: { user },
      error: authError,
    } = await createAdminClient().auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 500 });
    }

    // Check subscription status
    const { data: userData, error: userError } = await createAdminClient()
      .from('users')
      .select('id, subscription_status, pms_type, WC, EPC')
      .eq('auth_user_id', user.id)
      .single();

    if (userError) {
      return NextResponse.json({ error: 'Failed to fetch user data.' }, { status: 500 });
    }

    // Check if user has active subscription
    if (userData.subscription_status !== 'active') {
      return NextResponse.json(
        {
          success: false,
          error: 'Active subscription required to sync data. Please choose a plan to continue.',
          dashboardLocked: true,
        },
        { status: 402 }
      );
    }

    const userId = userData.id;
    const pmsType = userData.pms_type;
    
    // Handle multiple WC and EPC tags - parse them as arrays
    const wcTags = userData.WC ? 
      (typeof userData.WC === 'string' ? userData.WC.split(',').map(tag => tag.trim()) : [userData.WC]) 
      : ['WC'];
    const epcTags = userData.EPC ? 
      (typeof userData.EPC === 'string' ? userData.EPC.split(',').map(tag => tag.trim()) : [userData.EPC]) 
      : ['EPC'];
    
    console.log(`[SYNC ENGINE] WC tags: ${JSON.stringify(wcTags)}`);
    console.log(`[SYNC ENGINE] EPC tags: ${JSON.stringify(epcTags)}`);

    // Get last sync time
    const { data: lastSync } = await createAdminClient()
      .from('sync_logs')
      .select('last_modified_sync')
      .eq('user_id', userId)
      .eq('pms_type', pmsType)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const lastSyncTime = lastSync?.last_modified_sync || new Date(0).toISOString();

    // Start sync log
    const { data: syncLog, error: syncLogError } = await createAdminClient()
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

    if (syncLogError) {
      return NextResponse.json({ error: 'Failed to create sync log.' }, { status: 500 });
    }

    try {
      // Step 1: Fetch data from database (patients and appointments already synced)
      const dbData = await fetchDataFromDatabase(userId, pmsType, lastSyncTime);

      // Step 2: Process and filter data
      const processedData = await processPMSData(
        dbData.patients,
        dbData.appointments,
        wcTags,
        epcTags,
        userId
      );

      // Step 3: Update database
      const dbResult = await updateDatabase(processedData, userId, pmsType);

      // Step 4: Create cases from synced data
      console.log(`Creating cases for user ${userId}...`);
      // Step 3.5: Sync practitioners from PMS
      console.log('[SYNC ENGINE] Syncing practitioners from PMS...');
      try {
        // We'll need to get the PMS API instance here
        // For now, we'll make a call to the PMS sync-data endpoint to handle practitioners
        const practitionerResponse = await fetch(`/api/pms/sync-practitioners?pmsType=${pmsType}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (practitionerResponse.ok) {
          console.log('[SYNC ENGINE] Practitioner sync completed successfully');
        } else {
          console.warn('[SYNC ENGINE] Practitioner sync failed, continuing with case creation');
        }
      } catch (practitionerError) {
        console.error('[SYNC ENGINE] Error syncing practitioners:', practitionerError);
        // Don't fail the whole sync if practitioners fail
      }

      const casesResult = await createCasesFromSyncedData(
        processedData,
        userId,
        pmsType,
        wcTags,
        epcTags
      );

      // Step 5: Check for Action Needed patients and send notifications
      const actionNeededPatients = await checkActionNeededPatients(userId);
      // Email notifications commented out per user request
      // await sendActionNeededNotifications(actionNeededPatients, userData);

      // Step 5.5: Calculate overdue patients
      const overduePatients = await calculateOverduePatients(userId);

      // Step 6: Update sync log
      await createAdminClient()
        .from('sync_logs')
        .update({
          status: 'completed',
          patients_processed: processedData.patients.length,
          patients_added: dbResult.patientsAdded,
          patients_synced: dbResult.patientsUpdated,
          appointments_synced: processedData.appointments.length,
          cases_created: casesResult.casesCreated || 0,
          cases_updated: casesResult.casesUpdated || 0,
          completed_at: new Date().toISOString(),
          last_modified_sync: new Date().toISOString(),
        })
        .eq('id', syncLog.id);

      // Calculate next sync time (4 hours from now)
      const nextSyncTime = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

      return NextResponse.json({
        success: true,
        patientsProcessed: processedData.patients.length,
        patientsAdded: dbResult.patientsAdded,
        patientsUpdated: dbResult.patientsUpdated,
        appointmentsSynced: processedData.appointments.length,
        casesCreated: casesResult.casesCreated || 0,
        casesUpdated: casesResult.casesUpdated || 0,
        actionNeededCount: actionNeededPatients.length,
        overduePatientsCount: overduePatients.length,
        errors: [],
        lastSyncTime: new Date().toISOString(),
        nextSyncTime,
        message: 'Sync completed successfully',
      });
    } catch (error) {
      // Update sync log with error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await createAdminClient()
        .from('sync_logs')
        .update({
          status: 'failed',
          errors_count: 1,
          error_details: { error: errorMessage },
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);

      throw error;
    }
  } catch (error) {
    console.error('Sync engine error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        patientsProcessed: 0,
        patientsAdded: 0,
        patientsUpdated: 0,
        appointmentsSynced: 0,
        errors: [errorMessage],
        lastSyncTime: new Date().toISOString(),
        nextSyncTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      },
      { status: 500 }
    );
  }
}

// Fetch data from database (patients and appointments already synced)
async function fetchDataFromDatabase(userId: string, pmsType: string, lastSyncTime: string) {
  try {
    console.log(`[SYNC ENGINE] Fetching data from database for user ${userId} (${pmsType})`);
    
    // Fetch patients from database
    const { data: patients, error: patientsError } = await createAdminClient()
      .from('patients')
      .select('*')
      .eq('user_id', userId)
      .eq('pms_type', pmsType)
      .gte('updated_at', lastSyncTime); // Only get patients updated since last sync

    if (patientsError) {
      throw new Error(`Failed to fetch patients: ${patientsError.message}`);
    }

    // Fetch appointments from database
    const { data: appointments, error: appointmentsError } = await createAdminClient()
      .from('appointments')
      .select('*')
      .eq('user_id', userId)
      .eq('pms_type', pmsType)
      .gte('created_at', lastSyncTime); // Only get appointments created since last sync

    if (appointmentsError) {
      throw new Error(`Failed to fetch appointments: ${appointmentsError.message}`);
    }

    console.log(`[SYNC ENGINE] Found ${patients?.length || 0} patients and ${appointments?.length || 0} appointments in database`);

    return {
      success: true,
      patients: patients || [],
      appointments: appointments || [],
    };
  } catch (error) {
    throw new Error(`Failed to fetch data from database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Process and filter PMS data
async function processPMSData(
  patients: PatientData[],
  appointments: AppointmentData[],
  wcTags: string[],
  epcTags: string[],
  userId: string
) {
  // Filter only completed appointments using status field
  const completedAppointments = appointments.filter(
    (apt) => apt.status === 'completed' || apt.status === 'attended' || apt.status === 'finished'
  );

  console.log(`[SYNC ENGINE] Total appointments: ${appointments.length}`);
  console.log(`[SYNC ENGINE] Completed appointments: ${completedAppointments.length}`);

  // Filter appointments by funding scheme - check against all WC and EPC tags
  const relevantAppointments = completedAppointments.filter(
    (apt) => wcTags.includes(apt.appointment_type) || epcTags.includes(apt.appointment_type)
  );

  console.log(
    `[SYNC ENGINE] Relevant appointments (WC: ${wcTags.join(',')} / EPC: ${epcTags.join(',')}): ${relevantAppointments.length}`
  );

  // Determine the active year based on user's latest appointment
  const activeYear = await determineActiveYear(userId);
  console.log(`[SYNC ENGINE] Using active year: ${activeYear} for user ${userId}`);

  // Process patients with their appointments
  const processedPatients = patients.map((patient: any) => {
    const patientAppointments = relevantAppointments.filter((apt: any) => apt.patient_id === patient.pms_patient_id);

    // Count sessions by type using smart counting logic
    const wcSessions = countWCSessions(patientAppointments, wcTags);
    const epcSessions = countEPCSessions(patientAppointments, epcTags, activeYear);

    // Determine patient type and calculate quota
    let patientType = patient.patient_type;
    let sessionsUsed = 0;
    let quota = 5; // Default EPC quota

    // Only process patients who have relevant appointments (WC or EPC sessions)
    if (wcSessions > 0) {
      patientType = 'WC';
      sessionsUsed = wcSessions;
      quota = 8; // Default WC quota

      // TODO: Add injury_date field to patients table for proper old injury logic
      // For now, we'll use the default 8 sessions
      // if (patient.injury_date && isOlderThan3Months(patient.injury_date)) {
      //   quota = 1; // Old injury
      // }
    } else if (epcSessions > 0) {
      patientType = 'EPC';
      sessionsUsed = epcSessions;
      quota = 5; // EPC quota per calendar year
    } else {
      // Patient has no WC or EPC appointments - keep their existing type or set to Private
      patientType = patient.patient_type || 'Private';
      sessionsUsed = 0;
      quota = 5; // Default
    }

    console.log(
      `[SYNC ENGINE] Patient ${patient.id} (${patientType || 'No Type'}): ${sessionsUsed}/${quota} sessions`
    );

    return {
      ...patient,
      patient_type: patientType,
      sessions_used: sessionsUsed,
      quota: quota,
      remaining_sessions: Math.max(0, quota - sessionsUsed),
    };
  });

  // Filter out patients who don't have any WC or EPC appointments
  const relevantPatients = processedPatients.filter(patient => 
    patient.patient_type === 'WC' || patient.patient_type === 'EPC'
  );

  console.log(`[SYNC ENGINE] Processing ${relevantPatients.length} patients with WC/EPC appointments out of ${processedPatients.length} total patients`);

  return {
    patients: relevantPatients,
    appointments: relevantAppointments,
  };
}

// Function to determine the active year based on user's latest appointment
async function determineActiveYear(userId: string): Promise<number> {
  try {
    // First try to get from existing appointments in database
    const { data: latestAppointment } = await createAdminClient()
      .from('appointments')
      .select('appointment_date')
      .eq('user_id', userId)
      .in('status', ['completed', 'attended', 'finished']) // Use status field instead of is_completed
      .order('appointment_date', { ascending: false })
      .limit(1)
      .single();

    if (latestAppointment) {
      const activeYear = new Date(latestAppointment.appointment_date).getFullYear();
      console.log(
        `[SYNC ENGINE] Latest appointment date: ${latestAppointment.appointment_date}, using year: ${activeYear}`
      );
      return activeYear;
    }

    // If no appointments in database, use current year
    const currentYear = new Date().getFullYear();
    console.log(
      `[SYNC ENGINE] No appointments found in database, using current year: ${currentYear}`
    );
    return currentYear;
  } catch (error) {
    console.error(`[SYNC ENGINE] Error determining active year:`, error);
    const currentYear = new Date().getFullYear();
    console.log(`[SYNC ENGINE] Error occurred, falling back to current year: ${currentYear}`);
    return currentYear;
  }
}

// Function to count WorkCover sessions (injury-based, no year limit)
function countWCSessions(appointments: AppointmentData[], wcTags: string[]): number {
  const wcCount = appointments.filter((apt) => wcTags.includes(apt.appointment_type)).length;
  console.log(`[SYNC ENGINE] Found ${wcCount} WC sessions for tags: ${wcTags.join(',')}`);
  return wcCount;
}

// Function to count EPC sessions (calendar year based)
function countEPCSessions(
  appointments: AppointmentData[],
  epcTags: string[],
  activeYear: number
): number {
  const epcCount = appointments.filter((apt) => {
    if (!epcTags.includes(apt.appointment_type)) return false;

    const appointmentYear = new Date(apt.appointment_date).getFullYear();
    return appointmentYear === activeYear;
  }).length;

  console.log(
    `[SYNC ENGINE] Found ${epcCount} EPC sessions for tags: ${epcTags.join(',')} in year: ${activeYear}`
  );
  return epcCount;
}

// Helper function to check if an injury is older than 3 months
function isOlderThan3Months(injuryDate: Date): boolean {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  return injuryDate < threeMonthsAgo;
}

// Update database with processed data
async function updateDatabase(processedData: any, userId: string, pmsType: string) {
  let patientsAdded = 0;
  let patientsUpdated = 0;

  for (const patient of processedData.patients) {
    try {
      // Check if patient exists
      const { data: existingPatient } = await createAdminClient()
        .from('patients')
        .select('id, sessions_used, total_sessions')
        .eq('user_id', userId)
        .eq('pms_patient_id', patient.id)
        .eq('pms_type', pmsType)
        .single();

      if (existingPatient) {
        // Update existing patient
        await createAdminClient()
          .from('patients')
          .update({
            first_name: patient.first_name,
            last_name: patient.last_name,
            email: patient.email,
            phone: patient.phone,
            date_of_birth: patient.date_of_birth,
            patient_type: patient.patient_type,
            physio_name: patient.physio_name,
            pms_last_modified: patient.pms_last_modified,
            sessions_used: patient.sessions_used,
            quota: patient.quota,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPatient.id);

        patientsUpdated++;
      } else {
        // Insert new patient
        await createAdminClient().from('patients').insert({
          user_id: userId,
          pms_patient_id: patient.id,
          pms_type: pmsType,
          first_name: patient.first_name,
          last_name: patient.last_name,
          email: patient.email,
          phone: patient.phone,
          date_of_birth: patient.date_of_birth,
          patient_type: patient.patient_type,
          physio_name: patient.physio_name,
          pms_last_modified: patient.pms_last_modified,
          sessions_used: patient.sessions_used,
          quota: patient.quota,
          is_active: true,
        });

        patientsAdded++;
      }
    } catch (error) {
      console.error(`Error updating patient ${patient.id}:`, error);
    }
  }

  // Update appointments
  for (const appointment of processedData.appointments) {
    try {
      const { data: existingAppointment } = await createAdminClient()
        .from('appointments')
        .select('id')
        .eq('user_id', userId)
        .eq('pms_appointment_id', appointment.id)
        .eq('pms_type', pmsType)
        .single();

      if (!existingAppointment) {
        await createAdminClient().from('appointments').insert({
          user_id: userId,
          patient_id: userId,
          pms_appointment_id: appointment.id,
          pms_type: pmsType,
          appointment_type: appointment.appointment_type,
          status: appointment.status,
          appointment_date: appointment.appointment_date,
          practitioner_name: appointment.practitioner_name,
        });
      }
    } catch (error) {
      console.error(`Error updating appointment ${appointment.id}:`, error);
    }
  }

  return { patientsAdded, patientsUpdated };
}

// Check for patients needing action
async function checkActionNeededPatients(userId: string) {
  const { data: patients } = await createAdminClient()
    .from('patients')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!patients) return [];

  return patients.filter((patient) => {
    const remainingSessions = patient.quota - patient.sessions_used;
    return remainingSessions <= 2; // Warning threshold
  });
}

// Calculate overdue patients (sessions used > quota)
async function calculateOverduePatients(userId: string) {
  const { data: patients } = await createAdminClient()
    .from('patients')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!patients) return [];

  return patients.filter((patient) => {
    const sessionsUsed = parseInt(patient.sessions_used) || 0;
    const quota = parseInt(patient.quota) || 0;
    return sessionsUsed > quota; // Overdue if sessions used exceeds quota
  });
}

// Send notifications for Action Needed patients
async function sendActionNeededNotifications(patients: any[], userData: any) {
  if (patients.length === 0) {
    console.log('No Action Needed patients to notify');
    return;
  }

  console.log(`Sending notifications for ${patients.length} Action Needed patients`);

  try {
    // Get patient IDs for notification
    const patientIds = patients.map(p => p.id);
    
    // Call the notification API to send emails to clinic staff only
    const notificationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/send-action-needed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        patientIds,
        clinicId: userData.id
      })
    });

    if (notificationResponse.ok) {
      const result = await notificationResponse.json();
      console.log(`✅ Action Needed notifications sent successfully:`, result.summary);
    } else {
      console.error('❌ Failed to send Action Needed notifications:', notificationResponse.statusText);
    }

  } catch (error) {
    console.error('Error sending Action Needed notifications:', error);
  }
}

// Function to create cases from synced patients and appointments data
async function createCasesFromSyncedData(
  processedData: any,
  userId: string,
  pmsType: string,
  wcTags: string[],
  epcTags: string[]
) {
  try {
    console.log(`[CASES] Starting case creation for user ${userId} (${pmsType})`);

    let casesCreated = 0;
    let casesUpdated = 0;
    const issues: string[] = [];

    if (!processedData.patients || processedData.patients.length === 0) {
      console.log(`[CASES] No patients found for user ${userId}`);
      return { casesCreated: 0, casesUpdated: 0 };
    }

    console.log(`[CASES] Found ${processedData.patients.length} patients to process for cases`);

    // Process each patient to create/update cases
    for (const patient of processedData.patients) {
      try {
        // Get the most recent appointment for this patient
        const patientAppointments = processedData.appointments.filter(
          (apt: any) => apt.patient_id === patient.id
        );

        const latestPatientAppointment =
          patientAppointments.length > 0
            ? patientAppointments.reduce((latest: any, current: any) =>
                new Date(current.appointment_date) > new Date(latest.appointment_date)
                  ? current
                  : latest
              )
            : null;

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
          console.log(`[CASES] Using practitioner name from appointment: ${physioName}`);

          // Try to find practitioner by name for ID
          const { data: practitioner } = await createAdminClient()
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
            console.log(
              `[CASES] Found practitioner by name: ${physioName} (ID: ${practitionerId})`
            );
          }
        }

        // Priority 2: If no practitioner name, try to find by practitioner ID from appointment
        if (!physioName && latestPatientAppointment?.practitioner_id) {
          console.log(
            `[CASES] Looking for practitioner by ID: ${latestPatientAppointment.practitioner_id}`
          );
          const { data: practitioner } = await createAdminClient()
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
            console.log(`[CASES] Found practitioner by ID: ${physioName} (ID: ${practitionerId})`);
          } else {
            console.log(
              `[CASES] No practitioner found by ID: ${latestPatientAppointment.practitioner_id}`
            );
          }
        }

        // Priority 3: If still no practitioner found, use patient's physio_name as fallback
        if (!physioName && patient.physio_name) {
          physioName = patient.physio_name;
          console.log(`[CASES] Using patient's physio_name as fallback: ${physioName}`);
        }

        // Priority 4: Use the first available practitioner as final fallback
        if (!physioName) {
          const { data: fallbackPractitioner } = await createAdminClient()
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
              `[CASES] Using first available practitioner as fallback: ${physioName} for patient ${patient.id}`
            );
          }
        }

        // Final fallback: Use a default name if nothing else works
        if (!physioName) {
          physioName = 'Unknown Practitioner';
          console.log(`[CASES] No practitioner found, using default: ${physioName}`);
        }

        console.log(`[CASES] Final physio_name for patient ${patient.id}: ${physioName}`);

        const nextVisitDate = latestPatientAppointment?.appointment_date
          ? new Date(latestPatientAppointment.appointment_date)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
        const lastVisitDate = latestPatientAppointment?.appointment_date || null;

        // Use processed session data
        const programType = patient.patient_type;
        const quota = patient.total_sessions;
        const sessionsUsed = patient.sessions_used;
        const sessionsRemaining = patient.remaining_sessions;

        // Determine case status and priority
        let caseStatus = 'active';
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
        const { data: existingCase, error: caseLookupError } = await createAdminClient()
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
          case_number: `CASE-${patient.id}`,
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
          alert_preference: 2, // Default alert preference
          is_alert_active: isAlertActive,
          alert_message: alertMessage,
          updated_at: new Date().toISOString(),
        };

        if (existingCase) {
          // Update existing case
          const { error: updateError } = await createAdminClient()
            .from('cases')
            .update(caseData)
            .eq('id', existingCase.id);

          if (updateError) {
            console.error(`[CASES] Error updating case for patient ${patient.id}:`, updateError);
            issues.push(`Failed to update case for patient ${patient.id}`);
          } else {
            casesUpdated++;
            console.log(
              `[CASES] ✅ Updated case for patient ${patient.id} - Sessions: ${sessionsUsed}/${quota} (${sessionsRemaining} remaining)`
            );
          }
        } else {
          // Create new case
          const { error: insertError } = await createAdminClient()
            .from('cases')
            .insert({
              ...caseData,
              created_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error(`[CASES] Error creating case for patient ${patient.id}:`, insertError);
            issues.push(`Failed to create case for patient ${patient.id}`);
          } else {
            casesCreated++;
            console.log(
              `[CASES] ✅ Created case for patient ${patient.id} - Sessions: ${sessionsUsed}/${quota} (${sessionsRemaining} remaining)`
            );
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
      issues: issues.length > 0 ? issues : undefined,
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

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
  is_completed: boolean;
  pms_last_modified: string;
}

export async function POST(req: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Get user from token
    const { data: { user }, error: authError } = await createAdminClient().auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token.' },
        { status: 500 }
      );
    }

    // Check subscription status
    const { data: userData, error: userError } = await createAdminClient()
      .from('users')
      .select('id, subscription_status, trial_ends_at, pms_type, WC, EPC')
      .eq('auth_user_id', user.id)
      .single();

    if (userError) {
      return NextResponse.json(
        { error: 'Failed to fetch user data.' },
        { status: 500 }
      );
    }

    // Check if trial expired and no subscription
    const now = new Date();
    const trialEndsAt = new Date(userData.trial_ends_at);
    const isTrialExpired = now > trialEndsAt && userData.subscription_status === 'trial';

    if (isTrialExpired) {
      return NextResponse.json({
        success: false,
        error: 'Trial expired. Please upgrade to continue syncing data.',
        dashboardLocked: true
      }, { status: 402 });
    }

    const userId = userData.id;
    const pmsType = userData.pms_type;
    const wcTag = userData.WC || 'WC';
    const epcTag = userData.EPC || 'EPC';

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
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (syncLogError) {
      return NextResponse.json(
        { error: 'Failed to create sync log.' },
        { status: 500 }
      );
    }

    try {
      // Step 1: Fetch PMS data (incremental)
      const pmsData = await fetchPMSData(pmsType, lastSyncTime, token);
      
      if (!pmsData.success) {
        throw new Error(pmsData.error);
      }

      // Step 2: Process and filter data
      const processedData = await processPMSData(
        pmsData.patients,
        pmsData.appointments,
        wcTag,
        epcTag,
        userId
      );

      // Step 3: Update database
      const dbResult = await updateDatabase(
        processedData,
        userId,
        pmsType
      );

      // Step 4: Check for Action Needed patients and send notifications
      const actionNeededPatients = await checkActionNeededPatients(userId);
      await sendActionNeededNotifications(actionNeededPatients, userData);

      // Step 5: Update sync log
      await createAdminClient()
        .from('sync_logs')
        .update({
          status: 'completed',
          patients_processed: processedData.patients.length,
          patients_added: dbResult.patientsAdded,
          patients_synced: dbResult.patientsUpdated,
          appointments_synced: processedData.appointments.length,
          completed_at: new Date().toISOString(),
          last_modified_sync: new Date().toISOString()
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
        actionNeededCount: actionNeededPatients.length,
        errors: [],
        lastSyncTime: new Date().toISOString(),
        nextSyncTime,
        message: 'Sync completed successfully'
      });

    } catch (error) {
      // Update sync log with error
      await createAdminClient()
        .from('sync_logs')
        .update({
          status: 'failed',
          errors_count: 1,
          error_details: { error: error.message },
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLog.id);

      throw error;
    }

  } catch (error) {
    console.error('Sync engine error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Sync failed',
      patientsProcessed: 0,
      patientsAdded: 0,
      patientsUpdated: 0,
      appointmentsSynced: 0,
      errors: [error.message],
      lastSyncTime: new Date().toISOString(),
      nextSyncTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
    }, { status: 500 });
  }
}

// Fetch data from PMS system
async function fetchPMSData(pmsType: string, lastSyncTime: string, token: string) {
  try {
    // This would integrate with your existing PMS API endpoints
    // For now, we'll simulate the data structure
    
    // In production, you would:
    // 1. Use the stored API key for the specific PMS
    // 2. Make API calls to fetch incremental data
    // 3. Handle rate limiting and pagination
    
    const response = await fetch(`/api/pms/sync-data?pmsType=${pmsType}&lastSync=${lastSyncTime}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`PMS API call failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to fetch PMS data: ${error.message}`);
  }
}

// Process and filter PMS data
async function processPMSData(
  patients: PatientData[],
  appointments: AppointmentData[],
  wcTag: string,
  epcTag: string,
  userId: string
) {
  // Filter only completed appointments
  const completedAppointments = appointments.filter(apt => apt.is_completed);
  
  // Filter appointments by funding scheme
  const relevantAppointments = completedAppointments.filter(apt => 
    apt.appointment_type === wcTag || apt.appointment_type === epcTag
  );

  // Process patients with their appointments
  const processedPatients = patients.map(patient => {
    const patientAppointments = relevantAppointments.filter(apt => apt.patient_id === patient.id);
    
    // Count sessions by type
    const wcSessions = patientAppointments.filter(apt => apt.appointment_type === wcTag).length;
    const epcSessions = patientAppointments.filter(apt => apt.appointment_type === epcTag).length;
    
    // Determine patient type and calculate quota
    let patientType = patient.patient_type;
    let sessionsUsed = 0;
    let totalSessions = 0;
    
    if (wcSessions > 0) {
      patientType = 'WC';
      sessionsUsed = wcSessions;
      totalSessions = 8; // Default WC quota
      
      // Check if > 3 months post-injury
      const isOldInjury = patient.date_of_birth && 
        new Date(patient.date_of_birth) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      if (isOldInjury) {
        totalSessions = 1;
      }
    } else if (epcSessions > 0) {
      patientType = 'EPC';
      sessionsUsed = epcSessions;
      totalSessions = 5; // Default EPC quota
    }

    return {
      ...patient,
      patient_type: patientType,
      sessions_used: sessionsUsed,
      total_sessions: totalSessions,
      remaining_sessions: Math.max(0, totalSessions - sessionsUsed)
    };
  });

  return {
    patients: processedPatients,
    appointments: relevantAppointments
  };
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
            total_sessions: patient.total_sessions,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPatient.id);
        
        patientsUpdated++;
      } else {
        // Insert new patient
        await createAdminClient()
          .from('patients')
          .insert({
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
            total_sessions: patient.total_sessions,
            is_active: true
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
        await createAdminClient()
          .from('appointments')
          .insert({
            user_id: userId,
            patient_id: userId,
            pms_appointment_id: appointment.id,
            pms_type: pmsType,
            appointment_type: appointment.appointment_type,
            status: appointment.status,
            appointment_date: appointment.appointment_date,
            practitioner_name: appointment.practitioner_name,
            is_completed: appointment.is_completed
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

  return patients.filter(patient => {
    const remainingSessions = patient.total_sessions - patient.sessions_used;
    return remainingSessions <= 2; // Warning threshold
  });
}

// Send notifications for Action Needed patients
async function sendActionNeededNotifications(patients: any[], userData: any) {
  // This would integrate with your email service
  // For now, we'll log the notifications
  
  for (const patient of patients) {
    const remainingSessions = patient.total_sessions - patient.sessions_used;
    
    console.log(`NOTIFICATION: ${remainingSessions} ${patient.patient_type} session(s) left for ${patient.first_name} ${patient.last_name}`);
    
    // In production, you would:
    // 1. Send email to clinic
    // 2. Use a queue system for reliability
    // 3. Retry failed emails
    // 4. Log all notifications
  }
}

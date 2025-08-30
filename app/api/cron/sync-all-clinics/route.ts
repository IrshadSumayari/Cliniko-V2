import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/integrations/supabase/client';

export async function GET(req: NextRequest) {
  try {
    // Verify this is a legitimate cron job request
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron job request' }, { status: 401 });
    }

    console.log('🔄 Starting automated sync for all active clinics...');

    // Get all active clinics with PMS connections
    const { data: activeClinics, error: clinicsError } = await supabase
      .from('users')
      .select(
        `
        id,
        auth_user_id,
        subscription_status,
        trial_ends_at,
        pms_type,
        WC,
        EPC
      `
      )
      .eq('is_onboarded', true)
      .not('pms_type', 'is', null);

    if (clinicsError) {
      throw new Error(`Failed to fetch active clinics: ${clinicsError.message}`);
    }

    if (!activeClinics || activeClinics.length === 0) {
      console.log('ℹ️ No active clinics found for sync');
      return NextResponse.json({
        success: true,
        message: 'No active clinics to sync',
        clinicsProcessed: 0,
      });
    }

    console.log(`📊 Found ${activeClinics.length} active clinics to sync`);

    const syncResults = [];
    let totalPatientsProcessed = 0;
    let totalPatientsAdded = 0;
    let totalPatientsUpdated = 0;
    let totalAppointmentsSynced = 0;
    let totalErrors = 0;

    // Process each clinic
    for (const clinic of activeClinics) {
      try {
        console.log(`🔄 Syncing clinic ${clinic.id} (${clinic.pms_type})...`);

        // Check if trial expired and no subscription
        const now = new Date();
        const trialEndsAt = new Date(clinic.trial_ends_at);
        const isTrialExpired = now > trialEndsAt && clinic.subscription_status === 'trial';

        if (isTrialExpired) {
          console.log(`⚠️ Clinic ${clinic.id} trial expired, skipping sync`);
          syncResults.push({
            clinicId: clinic.id,
            success: false,
            error: 'Trial expired',
            dashboardLocked: true,
          });
          continue;
        }

        // Get last sync time for this clinic
        const { data: lastSync } = await supabase
          .from('sync_logs')
          .select('last_modified_sync')
          .eq('user_id', clinic.id)
          .eq('pms_type', clinic.pms_type)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const lastSyncTime = lastSync?.last_modified_sync || new Date(0).toISOString();

        // Start sync log
        const { data: syncLog, error: syncLogError } = await supabase
          .from('sync_logs')
          .insert({
            user_id: clinic.id,
            pms_type: clinic.pms_type,
            sync_type: 'automated',
            status: 'running',
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (syncLogError) {
          throw new Error(`Failed to create sync log: ${syncLogError.message}`);
        }

        try {
          // Fetch PMS data (incremental)
          const pmsData = await fetchPMSDataForClinic(clinic, lastSyncTime);

          if (!pmsData.success) {
            throw new Error(pmsData.error);
          }

          // Process and filter data
          const processedData = await processPMSDataForClinic(
            pmsData.patients,
            pmsData.appointments,
            clinic.WC || 'WC',
            clinic.EPC || 'EPC',
            clinic.id
          );

          // Update database
          const dbResult = await updateDatabaseForClinic(processedData, clinic.id, clinic.pms_type);

          // Check for Action Needed patients
          const actionNeededPatients = await checkActionNeededPatientsForClinic(clinic.id);

          // Send notifications to both clinic and patients
          if (actionNeededPatients.length > 0) {
            console.log(
              `🔔 Clinic ${clinic.id} has ${actionNeededPatients.length} patients needing action`
            );

            try {
              // Get patient IDs for notification
              const patientIds = actionNeededPatients.map((p) => p.id);

              // Call the notification API to send emails to clinic staff only
              const notificationResponse = await fetch(
                `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/send-action-needed`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    patientIds,
                    clinicId: clinic.id,
                  }),
                }
              );

              if (notificationResponse.ok) {
                const result = await notificationResponse.json();
                console.log(
                  `✅ Action Needed notifications sent for clinic ${clinic.id}:`,
                  result.summary
                );
              } else {
                console.error(
                  `❌ Failed to send Action Needed notifications for clinic ${clinic.id}:`,
                  notificationResponse.statusText
                );
              }
            } catch (error) {
              console.error(
                `Error sending Action Needed notifications for clinic ${clinic.id}:`,
                error
              );
            }
          }

          // Update sync log
          await supabase
            .from('sync_logs')
            .update({
              status: 'completed',
              patients_processed: processedData.patients.length,
              patients_added: dbResult.patientsAdded,
              patients_synced: dbResult.patientsUpdated,
              appointments_synced: processedData.appointments.length,
              completed_at: new Date().toISOString(),
              last_modified_sync: new Date().toISOString(),
            })
            .eq('id', syncLog.id);

          // Update clinic's last sync time
          await supabase
            .from('users')
            .update({
              pms_last_sync: new Date().toISOString(),
            })
            .eq('id', clinic.id);

          const result = {
            clinicId: clinic.id,
            success: true,
            patientsProcessed: processedData.patients.length,
            patientsAdded: dbResult.patientsAdded,
            patientsUpdated: dbResult.patientsUpdated,
            appointmentsSynced: processedData.appointments.length,
            actionNeededCount: actionNeededPatients.length,
          };

          syncResults.push(result);

          // Update totals
          totalPatientsProcessed += result.patientsProcessed;
          totalPatientsAdded += result.patientsAdded;
          totalPatientsUpdated += result.patientsUpdated;
          totalAppointmentsSynced += result.appointmentsSynced;

          console.log(
            `✅ Clinic ${clinic.id} synced successfully: ${result.patientsProcessed} patients, ${result.appointmentsSynced} appointments`
          );
        } catch (error) {
          // Update sync log with error
          await supabase
            .from('sync_logs')
            .update({
              status: 'failed',
              errors_count: 1,
              error_details: { error: error.message },
              completed_at: new Date().toISOString(),
            })
            .eq('id', syncLog.id);

          const errorResult = {
            clinicId: clinic.id,
            success: false,
            error: error.message,
          };

          syncResults.push(errorResult);
          totalErrors++;

          console.error(`❌ Clinic ${clinic.id} sync failed: ${error.message}`);
        }
      } catch (error) {
        console.error(`❌ Error processing clinic ${clinic.id}:`, error);
        syncResults.push({
          clinicId: clinic.id,
          success: false,
          error: error.message,
        });
        totalErrors++;
      }
    }

    // Log summary
    console.log(`
🔄 Automated sync completed:
📊 Clinics processed: ${activeClinics.length}
✅ Successful: ${syncResults.filter((r) => r.success).length}
❌ Failed: ${totalErrors}
👥 Total patients processed: ${totalPatientsProcessed}
➕ New patients added: ${totalPatientsAdded}
🔄 Patients updated: ${totalPatientsUpdated}
📅 Appointments synced: ${totalAppointmentsSynced}
    `);

    return NextResponse.json({
      success: true,
      message: 'Automated sync completed',
      summary: {
        clinicsProcessed: activeClinics.length,
        successful: syncResults.filter((r) => r.success).length,
        failed: totalErrors,
        totalPatientsProcessed,
        totalPatientsAdded,
        totalPatientsUpdated,
        totalAppointmentsSynced,
      },
      results: syncResults,
      nextSyncTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error('❌ Automated sync failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Automated sync failed',
      },
      { status: 500 }
    );
  }
}

// Helper functions (similar to the manual sync engine)
async function fetchPMSDataForClinic(clinic: any, lastSyncTime: string) {
  // This would integrate with your PMS APIs
  // For now, return mock data structure
  return {
    success: true,
    patients: [],
    appointments: [],
  };
}

async function processPMSDataForClinic(
  patients: any[],
  appointments: any[],
  wcTag: string,
  epcTag: string,
  clinicId: string
) {
  // Process data similar to manual sync
  return {
    patients: [],
    appointments: [],
  };
}

async function updateDatabaseForClinic(processedData: any, clinicId: string, pmsType: string) {
  // Update database similar to manual sync
  return {
    patientsAdded: 0,
    patientsUpdated: 0,
  };
}

async function checkActionNeededPatientsForClinic(clinicId: string) {
  const { data: patients } = await supabase
    .from('patients')
    .select('*')
    .eq('user_id', clinicId)
    .eq('is_active', true);

  if (!patients) return [];

  return patients.filter((patient) => {
    const remainingSessions = patient.total_sessions - patient.sessions_used;
    return remainingSessions <= 2;
  });
}

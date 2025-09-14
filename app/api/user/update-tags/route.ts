import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server-admin';

export async function POST(request: NextRequest) {
  try {
    const { wcTag, epcTag, wcTags, epcTags } = await request.json();

    const wcTagArray = wcTags && wcTags.length > 0 ? wcTags : wcTag ? [wcTag] : ['WC'];
    const epcTagArray = epcTags && epcTags.length > 0 ? epcTags : epcTag ? [epcTag] : ['EPC'];

    if (!wcTagArray.length || !epcTagArray.length) {
      return NextResponse.json({ error: 'Both WC and EPC tags are required' }, { status: 400 });
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    const supabase = createAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Get the user ID from the users table
    const { data: userRecordForId, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userRecordForId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userRecordForId.id;

    // Update the user's tags using the same pattern as is_onboarded updates
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        wc: wcTagArray[0],
        epc: epcTagArray[0],
        wc_tags: wcTagArray,
        epc_tags: epcTagArray,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', user.id)
      .select('wc, epc, wc_tags, epc_tags');

    if (updateError) {
      console.error('Error updating user tags:', updateError);
      return NextResponse.json({ error: 'Failed to update tags' }, { status: 500 });
    }

    // Get the actual users table ID (not auth_user_id)
    const { data: userRecord, error: userRecordError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (userRecordError || !userRecord) {
      console.error('Error fetching user record:', userRecordError);
      return NextResponse.json({ error: 'Failed to fetch user record' }, { status: 500 });
    }

    // Recalculate counts based on new tags using appointment-types table

    // Initialize count variables
    let wcCount = 0;
    let epcCount = 0;
    let totalAppointmentsCount = 0;
    let actionNeededPatientsCount = 0;
    let overduePatientsCount = 0;

    try {
      // Debug: Let's see all appointment types for this user
      const { data: allAppointmentTypes, error: debugError } = await supabase
        .from('appointment_types')
        .select('appointment_id, appointment_name')
        .eq('user_id', userRecord.id);

      // Step 1: Find appointment types from appointment-types table by matching tag names

      const wcConditions = wcTagArray.map((tag) => `appointment_name.ilike.%${tag}%`).join(',');
      const { data: wcAppointmentTypes, error: wcTypesError } = await supabase
        .from('appointment_types')
        .select('appointment_id, appointment_name')
        .eq('user_id', userRecord.id)
        .or(wcConditions);

      const epcConditions = epcTagArray.map((tag) => `appointment_name.ilike.%${tag}%`).join(',');
      const { data: epcAppointmentTypes, error: epcTypesError } = await supabase
        .from('appointment_types')
        .select('appointment_id, appointment_name')
        .eq('user_id', userRecord.id)
        .or(epcConditions);

      if (wcTypesError || epcTypesError) {
        console.error('Error fetching appointment types for recount:', {
          wcTypesError,
          epcTypesError,
        });
        return NextResponse.json(
          { error: 'Failed to fetch appointment types for recount' },
          { status: 500 }
        );
      }

      // Extract appointment type IDs
      const wcTypeIds = wcAppointmentTypes?.map((type: any) => type.appointment_id) || [];
      const epcTypeIds = epcAppointmentTypes?.map((type: any) => type.appointment_id) || [];

      try {
        // Get all appointment type IDs that match user's custom tags
        const allMatchingTypeIds = [...wcTypeIds, ...epcTypeIds].filter(
          (id) => id && id !== null && id !== undefined
        );

        if (allMatchingTypeIds.length === 0) {
          wcCount = 0;
          epcCount = 0;
        } else {
          const { data: matchingPatients, error: countError } = await supabase
            .from('patients')
            .select(
              `
               id,
               patient_type,
               appointments!inner(
                 appointment_type_id
               )
             `
            )
            .eq('user_id', userRecord.id)
            .in('appointments.appointment_type_id', allMatchingTypeIds)
            .not('id', 'is', null);

          if (countError) {
            console.error('Error counting patients using cases table logic:', countError);
            wcCount = 0;
            epcCount = 0;
          } else {
            // Count patients by their appointment types, not by patient_type field
            // This matches exactly how the cases table population works
            const wcPatients =
              matchingPatients?.filter((p) => {
                // Check if patient has WC appointments
                return p.appointments?.some((apt) => wcTypeIds.includes(apt.appointment_type_id));
              }) || [];

            const epcPatients =
              matchingPatients?.filter((p) => {
                // Check if patient has EPC appointments
                return p.appointments?.some((apt) => epcTypeIds.includes(apt.appointment_type_id));
              }) || [];

            wcCount = wcPatients.length;
            epcCount = epcPatients.length;
          }
        }
      } catch (countError) {
        console.error('Error in patient counting using cases table logic:', countError);
        wcCount = 0;
        epcCount = 0;
      }

      // Calculate total appointments as sum of WC + EPC appointments
      // We need to get the actual appointment counts, not just unique patients
      let wcAppointmentCount = 0;
      let epcAppointmentCount = 0;

      if (wcTypeIds.length > 0) {
        try {
          const validWcTypeIds = wcTypeIds.filter((id) => id && id !== null && id !== undefined);
          if (validWcTypeIds.length > 0) {
            const { data: wcAppointmentsForCount, error: wcCountForTotalError } = await supabase
              .from('appointments')
              .select('id')
              .eq('user_id', userRecord.id)
              .in('appointment_type_id', validWcTypeIds);

            if (!wcCountForTotalError) {
              wcAppointmentCount = wcAppointmentsForCount?.length || 0;
            }
          }
        } catch (wcTotalError) {
          console.error('Error counting WC appointments for total:', wcTotalError);
        }
      }

      if (epcTypeIds.length > 0) {
        try {
          const validEpcTypeIds = epcTypeIds.filter((id) => id && id !== null && id !== undefined);
          if (validEpcTypeIds.length > 0) {
            const { data: epcAppointmentsForCount, error: epcCountForTotalError } = await supabase
              .from('appointments')
              .select('id')
              .eq('user_id', userRecord.id)
              .in('appointment_type_id', validEpcTypeIds);

            if (!epcCountForTotalError) {
              epcAppointmentCount = epcAppointmentsForCount?.length || 0;
            }
          }
        } catch (epcTotalError) {
          console.error('Error counting EPC appointments for total:', epcTotalError);
        }
      }

      // Total appointments is the sum of WC + EPC appointments
      totalAppointmentsCount = wcAppointmentCount + epcAppointmentCount;

      // Action needed patients calculation will be done after cases table is populated

      try {
        // Get all patients for this user
        const { data: allPatients, error: patientsError } = await supabase
          .from('patients')
          .select('id, pms_patient_id, pms_type, patient_type')
          .eq('user_id', userRecord.id);

        if (patientsError) {
          console.error('Error fetching patients for type update:', patientsError);
        } else if (allPatients && allPatients.length > 0) {
          // Get all appointments for these patients to determine their type
          const patientIds = allPatients.map((p) => p.id);
          const { data: allAppointments, error: appointmentsError } = await supabase
            .from('appointments')
            .select('patient_id, appointment_type_id')
            .eq('user_id', userRecord.id)
            .in('patient_id', patientIds);

          if (appointmentsError) {
            console.error(
              'Error fetching appointments for patient type update:',
              appointmentsError
            );
          } else {
            // Create a map of patient_id -> appointment_type_ids
            const patientAppointmentTypes = new Map();
            allAppointments?.forEach((apt) => {
              const patientId = apt.patient_id;
              if (!patientAppointmentTypes.has(patientId)) {
                patientAppointmentTypes.set(patientId, []);
              }
              patientAppointmentTypes.get(patientId).push(apt.appointment_type_id);
            });

            // Only update patients that actually have WC or EPC appointments (not all 200 patients)
            let updatedPatients = 0;
            for (const patient of allPatients) {
              const appointmentTypeIds = patientAppointmentTypes.get(patient.id) || [];

              // Determine patient type based on appointment types
              let newPatientType = null; // Will be determined based on appointments

              // Check if patient has WC appointments
              const hasWCAppointments = appointmentTypeIds.some((typeId: string | number) =>
                wcTypeIds.includes(typeId)
              );

              // Check if patient has EPC appointments
              const hasEPCAppointments = appointmentTypeIds.some((typeId: string | number) =>
                epcTypeIds.includes(typeId)
              );

              // Only process patients who have WC or EPC appointments
              if (hasWCAppointments || hasEPCAppointments) {
                if (hasWCAppointments && hasEPCAppointments) {
                  // If patient has both, prioritize WC (as per business logic)
                  newPatientType = wcTagArray[0];
                } else if (hasWCAppointments) {
                  newPatientType = wcTagArray[0];
                } else if (hasEPCAppointments) {
                  newPatientType = epcTagArray[0];
                }

                // Update patient type if it changed
                if (patient.patient_type !== newPatientType) {
                  const { error: updateError } = await supabase
                    .from('patients')
                    .update({
                      patient_type: newPatientType,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', patient.id);

                  if (updateError) {
                    console.error(`Error updating patient ${patient.id} type:`, updateError);
                  } else {
                    updatedPatients++;
                  }
                }
              }
            }

            console.log(
              `Successfully updated types for ${updatedPatients} patients with ${wcTagArray.join(',')}/${epcTagArray.join(',')} appointments`
            );
          }
        }
      } catch (patientUpdateError) {
        console.error('Error updating patient types:', patientUpdateError);
        // Don't fail the entire operation, just log the error
      }

      // NEW: Populate cases table after updating patient types
      console.log('Populating cases table with updated patient data...');
      try {
        // FIRST: Calculate and update actual sessions for all patients before populating cases
        console.log('Calculating actual sessions for all patients...');
        await calculateAndUpdatePatientSessions(supabase, userRecord.id, wcTagArray, epcTagArray);

        // SECOND: Now call the populate_cases_from_existing_data function to populate cases with user ID
        const { data: casesResult, error: casesError } = await supabase.rpc(
          'populate_cases_from_existing_data',
          {
            p_user_id: userRecord.id,
          }
        );

        if (casesError) {
          console.error('Error populating cases table:', casesError);
        } else {
          console.log('Cases table populated successfully');

          // Verify the cases were created and get the FINAL counts from cases table
          const { data: casesData, error: countError } = await supabase
            .from('cases')
            .select('id, program_type')
            .eq('user_id', userRecord.id);

          if (countError) {
            console.error('Error counting cases:', countError);
          } else {
            console.log(`Cases table now contains ${casesData?.length || 0} cases`);

            // IMPORTANT: Recalculate counts from the ACTUAL cases table data
            // This ensures the counts match exactly what's in the cases table
            const finalWcCount =
              casesData?.filter((c) => c.program_type === wcTagArray[0]).length || 0;
            const finalEpcCount =
              casesData?.filter((c) => c.program_type === epcTagArray[0]).length || 0;

            // Update the count variables to match the cases table
            wcCount = finalWcCount;
            epcCount = finalEpcCount;

            console.log(
              `Final counts from cases table: ${finalWcCount} WC + ${finalEpcCount} EPC = ${finalWcCount + finalEpcCount} total`
            );

            // Calculate action needed patients count using same logic as dashboard
            // This must be done AFTER cases table is populated
            try {
              const { data: actionNeededData, error: actionError } = await supabase
                .from('cases')
                .select('id, quota, sessions_used, status')
                .eq('user_id', userId)
                .eq('status', 'active');

              if (!actionError && actionNeededData) {
                actionNeededPatientsCount = actionNeededData.filter((caseItem: any) => {
                  const remainingSessions = caseItem.quota - caseItem.sessions_used;
                  // Use same logic as dashboard: warning status with remaining sessions > 0
                  return remainingSessions <= 2 && remainingSessions > 0;
                }).length;
              }
            } catch (actionError) {
              console.error('Error calculating action needed patients:', actionError);
            }

            // Calculate overdue patients count using same logic as dashboard
            try {
              const { data: overdueData, error: overdueError } = await supabase
                .from('cases')
                .select('id, quota, sessions_used, status')
                .eq('user_id', userId)
                .eq('status', 'active');

              if (!overdueError && overdueData) {
                // Use same logic as dashboard: sessionsUsed > totalSessions
                overduePatientsCount = overdueData.filter((caseItem: any) => {
                  const sessionsUsed = caseItem.sessions_used || 0;
                  const totalSessions = caseItem.quota || 5; // Use same default as dashboard
                  return sessionsUsed > totalSessions; // Overdue if sessions used exceeds total sessions
                }).length;
              }
            } catch (overdueError) {
              console.error('Error calculating overdue patients:', overdueError);
            }
          }
        }
      } catch (casesPopulationError) {
        console.error('Error in cases population:', casesPopulationError);
        // Don't fail the entire operation, just log the error
      }
    } catch (countingError) {
      console.error('Error in counting logic:', countingError);
      // Set default values if counting fails
      wcCount = 0;
      epcCount = 0;
      totalAppointmentsCount = 0;
      actionNeededPatientsCount = 0;
      overduePatientsCount = 0;
    }

    return NextResponse.json({
      success: true,
      message: 'Tags updated successfully',
      newCounts: {
        wcPatients: wcCount,
        epcPatients: epcCount,
        totalAppointments: totalAppointmentsCount,
        actionNeededPatients: actionNeededPatientsCount,
        overduePatientsCount: overduePatientsCount,
      },
    });
  } catch (error) {
    console.error('Update tags error:', error);
    return NextResponse.json(
      {
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}

// Function to calculate and update actual sessions for all patients
async function calculateAndUpdatePatientSessions(
  supabase: any,
  userId: string,
  wcTagArray: string[],
  epcTagArray: string[]
) {
  try {
    console.log(`[SESSIONS] Starting session calculation for user ${userId}`);

    // Get appointment type IDs that match the user's tags using array-based matching
    const wcConditions = wcTagArray.map((tag) => `appointment_name.ilike.%${tag}%`).join(',');
    const { data: wcAppointmentTypes } = await supabase
      .from('appointment_types')
      .select('appointment_id')
      .eq('user_id', userId)
      .or(wcConditions);

    const epcConditions = epcTagArray.map((tag) => `appointment_name.ilike.%${tag}%`).join(',');
    const { data: epcAppointmentTypes } = await supabase
      .from('appointment_types')
      .select('appointment_id')
      .eq('user_id', userId)
      .or(epcConditions);

    const wcTypeIds = wcAppointmentTypes?.map((type: any) => type.appointment_id) || [];
    const epcTypeIds = epcAppointmentTypes?.map((type: any) => type.appointment_id) || [];

    console.log(
      `[SESSIONS] Found WC type IDs: ${wcTypeIds.join(', ')}, EPC type IDs: ${epcTypeIds.join(', ')}`
    );

    // OPTIMIZATION: Only get patients that actually have WC or EPC appointments
    const allMatchingTypeIds = [...wcTypeIds, ...epcTypeIds].filter(
      (id) => id && id !== null && id !== undefined
    );

    if (allMatchingTypeIds.length === 0) {
      console.log(
        `[SESSIONS] No matching appointment types found for tags ${wcTagArray.join(',')}/${epcTagArray.join(',')}`
      );
      return;
    }

    // Get only patients that have appointments matching the user's tags
    const { data: relevantPatients, error: patientsError } = await supabase
      .from('patients')
      .select(
        `
        id,
        patient_type,
        appointments!inner(
          appointment_type_id,
          status,
          appointment_date
        )
      `
      )
      .eq('user_id', userId)
      .in('appointments.appointment_type_id', allMatchingTypeIds)
      .not('id', 'is', null);

    if (patientsError) {
      console.error(`[SESSIONS] Error fetching relevant patients:`, patientsError);
      return;
    }

    if (!relevantPatients || relevantPatients.length === 0) {
      console.log(
        `[SESSIONS] No patients found with ${wcTagArray.join(',')}/${epcTagArray.join(',')} appointments`
      );
      return;
    }

    console.log(
      `[SESSIONS] Found ${relevantPatients.length} patients with ${wcTagArray.join(',')}/${epcTagArray.join(',')} appointments (instead of all 200)`
    );

    let updatedPatients = 0;

    // Process only the relevant patients
    for (const patient of relevantPatients) {
      try {
        // Calculate actual sessions used based on funding scheme and year
        const sessionData = await calculatePatientSessionsOptimized(
          patient,
          wcTagArray[0],
          epcTagArray[0],
          wcTypeIds,
          epcTypeIds
        );

        console.log(
          `[SESSIONS] Patient ${patient.id} (${patient.patient_type}): ${sessionData.sessionsUsed}/${sessionData.quota} sessions, ${sessionData.sessionsRemaining} remaining`
        );

        // Update patient record with correct session count and quota
        const { error: updateError } = await supabase
          .from('patients')
          .update({
            sessions_used: sessionData.sessionsUsed,
            quota: sessionData.quota,
            updated_at: new Date().toISOString(),
          })
          .eq('id', patient.id);

        if (updateError) {
          console.error(`[SESSIONS] Error updating patient ${patient.id}:`, updateError);
        } else {
          updatedPatients++;
        }
      } catch (error) {
        console.error(`[SESSIONS] Error processing patient ${patient.id}:`, error);
      }
    }

    console.log(`[SESSIONS] Session calculation completed for user ${userId}`);
    console.log(
      `[SESSIONS] Updated ${updatedPatients} relevant patients with correct session counts (much faster!)`
    );
  } catch (error) {
    console.error(`[SESSIONS] Session calculation failed for user ${userId}:`, error);
  }
}

// Optimized function to calculate patient sessions using pre-fetched data
async function calculatePatientSessionsOptimized(
  patient: any,
  wcTag: string,
  epcTag: string,
  wcTypeIds: string[],
  epcTypeIds: string[]
) {
  let sessionsUsed = 0;
  let quota = 5; // Default EPC quota

  try {
    // Use the pre-fetched appointments data instead of making new database calls
    const patientAppointments = patient.appointments || [];

    if (patient.patient_type === 'WC') {
      // WorkCover: Count ALL completed WC sessions (injury-based, no year limit)
      if (wcTypeIds.length > 0) {
        sessionsUsed = patientAppointments.filter(
          (apt: any) =>
            wcTypeIds.includes(apt.appointment_type_id) &&
            ['completed', 'attended', 'finished'].includes(apt.status)
        ).length;

        console.log(
          `[SESSIONS] WC Patient ${patient.id}: Found ${sessionsUsed} completed ${wcTag} sessions from pre-fetched data`
        );
      }
      quota = 8; // Default WC quota
    } else if (patient.patient_type === 'EPC') {
      // EPC: Count sessions from the patient's most recent appointment year
      if (epcTypeIds.length > 0) {
        const allEpcAppointments = patientAppointments.filter(
          (apt: any) =>
            epcTypeIds.includes(apt.appointment_type_id) &&
            ['completed', 'attended', 'finished'].includes(apt.status)
        );

        if (allEpcAppointments.length > 0) {
          // Find the most recent EPC appointment year for THIS patient
          const latestEpcAppointment = allEpcAppointments.sort(
            (a, b) =>
              new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime()
          )[0];

          const patientActiveYear = new Date(latestEpcAppointment.appointment_date).getFullYear();

          // Count sessions from the patient's most recent appointment year
          sessionsUsed = allEpcAppointments.filter((apt: any) => {
            const appointmentYear = new Date(apt.appointment_date).getFullYear();
            return appointmentYear === patientActiveYear;
          }).length;

          console.log(
            `[SESSIONS] EPC Patient ${patient.id}: Using patient's active year ${patientActiveYear}, found ${sessionsUsed} completed sessions`
          );
        } else {
          sessionsUsed = 0;
          console.log(`[SESSIONS] EPC Patient ${patient.id}: No completed EPC appointments found`);
        }
      }
      quota = 5; // EPC quota per calendar year
    }
  } catch (error) {
    console.error(`[SESSIONS] Error calculating sessions for patient ${patient.id}:`, error);
    sessionsUsed = 0;
  }

  const sessionsRemaining = Math.max(0, quota - sessionsUsed);

  return {
    sessionsUsed,
    quota,
    sessionsRemaining,
  };
}

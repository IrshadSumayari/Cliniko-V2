import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server-admin';

export async function POST(request: NextRequest) {
  try {
    const { wcTag, epcTag } = await request.json();

    if (!wcTag || !epcTag) {
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

    // Update the user's tags using the same pattern as is_onboarded updates
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        wc: wcTag,
        epc: epcTag,
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', user.id)
      .select('wc, epc');

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

    try {
      // Debug: Let's see all appointment types for this user
      const { data: allAppointmentTypes, error: debugError } = await supabase
        .from('appointment_types')
        .select('appointment_id, appointment_name')
        .eq('user_id', userRecord.id);

      // Step 1: Find appointment types from appointment-types table by matching tag names

      const { data: wcAppointmentTypes, error: wcTypesError } = await supabase
        .from('appointment_types')
        .select('appointment_id, appointment_name')
        .eq('user_id', userRecord.id)
        .ilike('appointment_name', `%${wcTag}%`);

      const { data: epcAppointmentTypes, error: epcTypesError } = await supabase
        .from('appointment_types')
        .select('appointment_id, appointment_name')
        .eq('user_id', userRecord.id)
        .ilike('appointment_name', `%${epcTag}%`);

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
              let newPatientType = 'Private'; // Default

              // Check if patient has WC appointments
              const hasWCAppointments = appointmentTypeIds.some((typeId: string | number) =>
                wcTypeIds.includes(typeId)
              );

              // Check if patient has EPC appointments
              const hasEPCAppointments = appointmentTypeIds.some((typeId: string | number) =>
                epcTypeIds.includes(typeId)
              );

              // Only update if patient actually has WC or EPC appointments
              if (hasWCAppointments || hasEPCAppointments) {
                if (hasWCAppointments && hasEPCAppointments) {
                  // If patient has both, prioritize WC (as per business logic)
                  newPatientType = wcTag;
                } else if (hasWCAppointments) {
                  newPatientType = wcTag;
                } else if (hasEPCAppointments) {
                  newPatientType = epcTag;
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
              `Successfully updated types for ${updatedPatients} patients with ${wcTag}/${epcTag} appointments`
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
        // Call the populate_cases_from_existing_data function to populate cases with user ID
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
            const finalWcCount = casesData?.filter((c) => c.program_type === wcTag).length || 0;
            const finalEpcCount = casesData?.filter((c) => c.program_type === epcTag).length || 0;

            // Update the count variables to match the cases table
            wcCount = finalWcCount;
            epcCount = finalEpcCount;

            console.log(
              `Final counts from cases table: ${finalWcCount} WC + ${finalEpcCount} EPC = ${finalWcCount + finalEpcCount} total`
            );
          }
        }
      } catch (casesPopulationError) {
        console.error('Error in cases population:', casesPopulationError);
        // Don't fail the entire operation, just log the error
      }

      console.log('Final counts:', {
        [`${wcTag}Patients`]: wcCount,
        [`${epcTag}Patients`]: epcCount,
        totalAppointments: totalAppointmentsCount,
      });
    } catch (countingError) {
      console.error('Error in counting logic:', countingError);
      // Set default values if counting fails
      wcCount = 0;
      epcCount = 0;
      totalAppointmentsCount = 0;
    }

    return NextResponse.json({
      success: true,
      message: 'Tags updated successfully',
      newCounts: {
        [`${wcTag}Patients`]: wcCount,
        [`${epcTag}Patients`]: epcCount,
        totalAppointments: totalAppointmentsCount,
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

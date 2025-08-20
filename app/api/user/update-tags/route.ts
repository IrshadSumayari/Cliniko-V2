import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server-admin';

export async function POST(request: NextRequest) {
  try {
    const { wcTag, epcTag } = await request.json();
    console.log('Update tags request received:', { wcTag, epcTag });

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

    console.log('Authenticated user:', { id: user.id, email: user.email });

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

    console.log('Tags updated successfully:', updatedUser);

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

    console.log('User IDs:', { authUserId: user.id, usersTableId: userRecord.id });

    // Recalculate counts based on new tags using appointment-types table
    console.log('Recalculating counts using new tags:', { wcTag, epcTag });

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

    if (debugError) {
      console.error('Debug: Error fetching all appointment types:', debugError);
    } else {
      console.log('Debug: All appointment types for user:', allAppointmentTypes);
    }

    // Step 1: Find appointment types from appointment-types table by matching tag names
    console.log(`Searching for WC tag "${wcTag}" in appointment types...`);
    const { data: wcAppointmentTypes, error: wcTypesError } = await supabase
      .from('appointment_types')
      .select('appointment_id, appointment_name')
      .eq('user_id', userRecord.id)
      .ilike('appointment_name', `%${wcTag}%`);

    console.log(`Searching for EPC tag "${epcTag}" in appointment types...`);
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

    // Log what we found for debugging
    console.log('WC appointment types found:', wcAppointmentTypes);
    console.log('EPC appointment types found:', epcAppointmentTypes);

    // Extract appointment type IDs
    const wcTypeIds = wcAppointmentTypes?.map((type: any) => type.appointment_id) || [];
    const epcTypeIds = epcAppointmentTypes?.map((type: any) => type.appointment_id) || [];

    console.log('Found appointment type IDs:', { wcTypeIds, epcTypeIds });

    // Step 2: Filter appointments using those IDs to calculate unique patient counts
    if (wcTypeIds.length > 0) {
      try {
        console.log('Querying WC appointments with type IDs:', wcTypeIds);
        // Safety check: ensure we have valid IDs
        const validWcTypeIds = wcTypeIds.filter(id => id && id !== null && id !== undefined);
        if (validWcTypeIds.length === 0) {
          console.log('No valid WC type IDs found, skipping WC count');
          wcCount = 0;
        } else {
          const { data: wcAppointments, error: wcCountError } = await supabase
            .from('appointments')
            .select('patient_id')
            .eq('user_id', userRecord.id)
            .in('appointment_type_id', validWcTypeIds)
            .not('patient_id', 'is', null);

        if (wcCountError) {
          console.error('Error counting WC appointments:', wcCountError);
        } else {
          // Count unique patients (not appointments)
          const uniquePatientIds = new Set(
            wcAppointments?.map((apt) => apt.patient_id).filter(Boolean)
          );
          wcCount = uniquePatientIds.size;
          console.log(
            `WC: Found ${wcAppointments?.length || 0} appointments for ${wcCount} unique patients`
          );
        }
      }
    } catch (wcError) {
      console.error('Error in WC counting logic:', wcError);
      wcCount = 0;
    }
    } else {
      console.log(`No appointment types found matching WC tag: "${wcTag}"`);
      wcCount = 0;
    }

    if (epcTypeIds.length > 0) {
      try {
        console.log('Querying EPC appointments with type IDs:', epcTypeIds);
        // Safety check: ensure we have valid IDs
        const validEpcTypeIds = epcTypeIds.filter(id => id && id !== null && id !== undefined);
        if (validEpcTypeIds.length === 0) {
          console.log('No valid EPC type IDs found, skipping EPC count');
          epcCount = 0;
        } else {
          const { data: epcAppointments, error: epcCountError } = await supabase
            .from('appointments')
            .select('patient_id')
            .eq('user_id', userRecord.id)
            .in('appointment_type_id', validEpcTypeIds)
            .not('patient_id', 'is', null);

              if (epcCountError) {
          console.error('Error counting EPC appointments:', epcCountError);
        } else {
          // Count unique patients (not appointments)
          const uniquePatientIds = new Set(
            epcAppointments?.map((apt) => apt.patient_id).filter(Boolean)
          );
          epcCount = uniquePatientIds.size;
          console.log(
            `EPC: Found ${epcAppointments?.length || 0} appointments for ${epcCount} unique patients`
          );
        }
        }
      } catch (epcError) {
        console.error('Error in EPC counting logic:', epcError);
        epcCount = 0;
      }
    } else {
      console.log(`No appointment types found matching EPC tag: "${epcTag}"`);
      epcCount = 0;
    }

    // Calculate total appointments as sum of WC + EPC appointments
    // We need to get the actual appointment counts, not just unique patients
    let wcAppointmentCount = 0;
    let epcAppointmentCount = 0;
    
    if (wcTypeIds.length > 0) {
      try {
        const validWcTypeIds = wcTypeIds.filter(id => id && id !== null && id !== undefined);
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
        const validEpcTypeIds = epcTypeIds.filter(id => id && id !== null && id !== undefined);
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
    console.log('Appointment counts for total:', { wcAppointmentCount, epcAppointmentCount, totalAppointmentsCount });
    console.log('Final counts:', { 
      wcPatients: wcCount, 
      epcPatients: epcCount, 
      totalAppointments: totalAppointmentsCount 
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
        wcPatients: wcCount,
        epcPatients: epcCount,
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

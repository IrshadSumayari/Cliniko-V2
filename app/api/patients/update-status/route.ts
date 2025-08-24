import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabase/server-admin';

export async function POST(req: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required. Please provide a valid token.' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Get user from token
    const { data: { user }, error: authError } = await createAdminClient().auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token.' },
        { status: 401 }
      );
    }

    // Get user's ID from our users table
    const { data: userData, error: userError } = await createAdminClient()
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Failed to fetch user data.' },
        { status: 500 }
      );
    }

    const userId = userData.id;
    const { patientId, action, newData } = await req.json();

    if (!patientId || !action) {
      return NextResponse.json(
        { error: 'Patient ID and action are required.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    let updateData: any = { updated_at: new Date().toISOString() };

    switch (action) {
      case 'update_quota':
        // Update patient's quota and/or sessions used
        if (newData.quota !== undefined) {
          updateData.quota = newData.quota;
        }
        if (newData.sessions_used !== undefined) {
          updateData.sessions_used = newData.sessions_used;
        }
        updateData.status_change_reason = newData.reason || 'Quota updated';
        break;

      case 'move_to_pending':
        // Move patient to pending status
        updateData.status = 'pending';
        updateData.status_change_reason = newData.reason || 'Moved to pending';
        updateData.last_status_change = new Date().toISOString();
        break;

      case 'move_to_active':
        // Move patient back to active status
        updateData.status = 'active';
        updateData.status_change_reason = newData.reason || 'Moved to active';
        updateData.last_status_change = new Date().toISOString();
        break;

      case 'archive_patient':
        // Archive/discharge patient
        updateData.status = 'archived';
        updateData.status_change_reason = newData.reason || 'Patient discharged';
        updateData.last_status_change = new Date().toISOString();
        break;

      case 'update_alert_preference':
        // Update clinic's alert preference
        updateData.alert_preference = newData.alert_preference;
        updateData.status_change_reason = 'Alert preference updated';
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action specified.' },
          { status: 400 }
        );
    }

    // Update the case (not the patient directly)
    const { data: updatedCase, error: updateError } = await supabase
      .from('cases')
      .update(updateData)
      .eq('id', patientId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating patient:', updateError);
      return NextResponse.json(
        { error: 'Failed to update patient.' },
        { status: 500 }
      );
    }

    // Log the status change
    await supabase
      .from('sync_logs')
      .insert({
        user_id: userId,
        pms_type: 'manual',
        sync_type: 'status_change',
        status: 'completed',
        patients_processed: 1,
        error_details: {
          action,
          patient_id: patientId,
          reason: updateData.status_change_reason,
          timestamp: new Date().toISOString()
        }
      });

    return NextResponse.json({
      success: true,
      case: updatedCase,
      message: `Case ${action.replace(/_/g, ' ')} successfully`
    });

  } catch (error) {
    console.error('Patient status update error:', error);
    return NextResponse.json(
      { error: 'Failed to update patient status.' },
      { status: 500 }
    );
  }
}

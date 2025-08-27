import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server-admin';

export async function POST(request: NextRequest) {
  try {
    const { caseId, action, newData } = await request.json();

    if (!caseId || !action) {
      return NextResponse.json({ error: 'Case ID and action are required.' }, { status: 400 });
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
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !userRecord) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    const userId = userRecord.id;

    // Verify the case belongs to this user
    const { data: caseRecord, error: caseError } = await supabase
      .from('cases')
      .select('id, user_id, patient_id, program_type, quota, sessions_used')
      .eq('id', caseId)
      .eq('user_id', userId)
      .single();

    if (caseError || !caseRecord) {
      return NextResponse.json({ error: 'Case not found or access denied.' }, { status: 404 });
    }

    // Update case status based on action
    let updateData: any = { updated_at: new Date().toISOString() };

    switch (action) {
      case 'update_quota':
        // Update case's quota and/or sessions used
        if (newData.quota !== undefined) {
          updateData.quota = newData.quota;
        }
        if (newData.sessions_used !== undefined) {
          updateData.sessions_used = newData.sessions_used;
        }
        updateData.status_change_reason = newData.reason || 'Quota updated';
        break;

      case 'move_to_pending':
        // Move case to pending status
        updateData.status = 'pending';
        updateData.status_change_reason = newData.reason || 'Moved to pending';
        updateData.last_status_change = new Date().toISOString();
        break;

      case 'move_to_active':
        // Move case back to active status
        updateData.status = 'active';
        updateData.status_change_reason = newData.reason || 'Moved to active';
        updateData.last_status_change = new Date().toISOString();
        break;

      case 'archive_case':
        // Archive/close case
        updateData.status = 'archived';
        updateData.status_change_reason = newData.reason || 'Case closed';
        updateData.last_status_change = new Date().toISOString();
        break;

      case 'update_alert_preference':
        // Update case's alert preference
        updateData.alert_preference = newData.alert_preference;
        updateData.status_change_reason = 'Alert preference updated';
        break;

      case 'update_priority':
        // Update case priority
        updateData.priority = newData.priority;
        updateData.status_change_reason = 'Priority updated';
        break;

      case 'update_next_visit':
        // Update next visit date
        updateData.next_visit_date = newData.next_visit_date;
        updateData.status_change_reason = 'Next visit date updated';
        break;

      default:
        return NextResponse.json({ error: 'Invalid action specified.' }, { status: 400 });
    }

    // Update the case
    const { data: updatedCase, error: updateError } = await supabase
      .from('cases')
      .update(updateData)
      .eq('id', caseId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating case:', updateError);
      return NextResponse.json({ error: 'Failed to update case.' }, { status: 500 });
    }

    // Log the status change
    await supabase.from('sync_logs').insert({
      user_id: userId,
      pms_type: 'manual',
      sync_type: 'case_status_change',
      status: 'completed',
      patients_processed: 1,
      error_details: {
        action,
        case_id: caseId,
        patient_id: caseRecord.patient_id,
        reason: updateData.status_change_reason,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      case: updatedCase,
      message: `Case ${action.replace(/_/g, ' ')} successfully`,
    });
  } catch (error) {
    console.error('Case status update error:', error);
    return NextResponse.json({ error: 'Failed to update case status.' }, { status: 500 });
  }
}

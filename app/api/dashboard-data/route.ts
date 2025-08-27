import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../lib/supabase/server-admin';

export async function GET(req: NextRequest) {
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

    // Get filter parameters from URL
    const { searchParams } = new URL(req.url);
    const practitionerFilter = searchParams.get('practitioner'); // Get practitioner filter

    // Get user's custom tags and PMS type
    const { data: userData, error: userError } = await createAdminClient()
      .from('users')
      .select('id, pms_type')
      .eq('auth_user_id', user.id)
      .single();

    if (userError) {
      return NextResponse.json(
        { error: 'Failed to fetch user data.' },
        { status: 500 }
      );
    }

    const userId = userData.id;
    
    // Get user's custom WC and EPC tags from users table
    const { data: userTags, error: tagsError } = await createAdminClient()
      .from('users')
      .select('wc, epc')
      .eq('id', userId)
      .single();
    
    if (tagsError) {
      console.error('Failed to fetch user tags:', tagsError);
      return NextResponse.json(
        { error: 'Failed to fetch user configuration.' },
        { status: 500 }
      );
    }
    
    const wcTag = userTags.wc || 'WC'; // Use user's custom tag or fallback to default
    const epcTag = userTags.epc || 'EPC'; // Use user's custom tag or fallback to default



    // Fetch practitioners for filter dropdown
    const { data: practitioners, error: practitionersError } = await createAdminClient()
      .from('practitioners')
      .select('id, display_name, pms_practitioner_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('display_name');

    // Also get unique physio names from cases for practitioners not in practitioners table
    const { data: casePhysioNames, error: physioError } = await createAdminClient()
      .from('cases')
      .select('physio_name, pms_practitioner_id')
      .eq('user_id', userId)
      .not('physio_name', 'is', null)
      .not('physio_name', 'eq', 'Unknown Practitioner');

    // Build practitioner filter query
    let casesQuery = createAdminClient()
      .from('cases')
      .select(`
        id,
        case_number,
        case_title,
        patient_first_name,
        patient_last_name,
        patient_email,
        patient_phone,
        patient_date_of_birth,
        program_type,
        quota,
        sessions_used,
        sessions_remaining,
        status,
        priority,
        next_visit_date,
        last_visit_date,
        case_start_date,
        alert_preference,
        alert_message,
        appointment_type_name,
        physio_name,
        location_name,
        created_at,
        updated_at
      `)
      .eq('user_id', userId);

    // Apply practitioner filter if specified
    if (practitionerFilter && practitionerFilter !== 'all') {
      casesQuery = casesQuery.eq('physio_name', practitionerFilter);
    }

    // Fetch cases with filtering applied
    let { data: cases, error: casesError } = await casesQuery;

    if (casesError) {
      return NextResponse.json(
        { error: 'Failed to fetch cases.' },
        { status: 500 }
      );
    }

    // Ensure cases is an array
    if (!cases || !Array.isArray(cases)) {

      cases = [];
    }

    

    // Process data to create dashboard view from cases
    
    
    // Check if we have any cases first
    if (!cases || cases.length === 0) {
      // No cases exist yet - return empty dashboard
      return NextResponse.json({
        success: true,
        patients: [],
        kpiData: {
          totalPatients: 0,
          totalSessionsRemaining: 0,
          actionNeededPatients: 0,
          pendingPatients: 0
        },
        filters: {
          physios: [],
          locations: []
        },
        lastSync: new Date().toISOString(),
        message: 'No cases found. Please run the populate_cases_from_existing_data() function first.'
      });
    }

    const dashboardData = cases.map(caseItem => {
      // Use the case data directly - no need to fetch appointments separately
      let patientType = caseItem.program_type;
      let sessionsUsed = caseItem.sessions_used || 0;
      let totalSessions = caseItem.quota || 5;
      let remainingSessions = caseItem.sessions_remaining || Math.max(0, totalSessions - sessionsUsed);
      
      // Determine status based on sessions and case status
      let status = caseItem.status || 'active';
      let alert = caseItem.alert_message;
      let urgency = caseItem.priority || 'low';
      
      // Override status logic based on sessions remaining
      if (remainingSessions <= 0) {
        status = 'critical';
        alert = `${patientType} quota exhausted - renewal needed immediately`;
        urgency = 'critical';
      } else if (remainingSessions <= caseItem.alert_preference) {
        status = 'warning';
        alert = `${patientType} referral expires soon - ${remainingSessions} sessions left`;
        urgency = 'high';
      } else if (remainingSessions <= 3) {
        status = 'warning';
        alert = `${patientType} sessions running low - ${remainingSessions} sessions left`;
        urgency = 'medium';
      }
      
      // If case is pending or archived, override the status
      if (caseItem.status === 'pending') {
        status = 'pending';
        alert = 'Waiting for approval';
        urgency = 'medium';
      } else if (caseItem.status === 'archived') {
        status = 'archived';
        alert = 'Case closed';
        urgency = 'low';
      }

      // Determine status and alerts based on requirements
      if (remainingSessions <= 0) {
        status = 'critical';
        alert = `${patientType} quota exhausted - renewal needed immediately`;
        urgency = 'critical';
      } else if (remainingSessions <= 2) {
        status = 'warning';
        alert = `${patientType} referral expires soon - ${remainingSessions} sessions left`;
        urgency = 'high';
      } else if (remainingSessions <= 3) {
        status = 'warning';
        alert = `${patientType} sessions running low - ${remainingSessions} sessions left`;
        urgency = 'medium';
      }

      // Use case data for next appointment and other details
      const nextAppointment = caseItem.next_visit_date 
        ? new Date(caseItem.next_visit_date).toISOString().split('T')[0]
        : null;

      return {
        id: caseItem.id,
        caseNumber: caseItem.case_number,
        caseTitle: caseItem.case_title,
        name: `${caseItem.patient_first_name} ${caseItem.patient_last_name}`,
        program: patientType,
        sessionsUsed,
        totalSessions,
        remainingSessions,
        nextAppointment,
        physio: caseItem.physio_name || null,
        location: caseItem.location_name || 'Main Clinic',
        status,
        alert,
        urgency,
        lastSync: 'Just synced',
        email: caseItem.patient_email,
        phone: caseItem.patient_phone,
        dateOfBirth: caseItem.patient_date_of_birth,
        pmsLastModified: caseItem.updated_at,
        patientStatus: caseItem.status,
        quota: caseItem.quota,
        alertPreference: caseItem.alert_preference,
        appointmentType: caseItem.appointment_type_name,
        priority: caseItem.priority,
        caseStartDate: caseItem.case_start_date,
        lastVisitDate: caseItem.last_visit_date
      };
    });



    // Calculate KPI data
    const totalPatients = dashboardData.length;
    const actionNeededPatients = dashboardData.filter((p: any) => p.status === 'warning' || p.status === 'critical').length;
    const pendingPatients = dashboardData.filter((p: any) => p.status === 'pending').length;
    const totalSessionsRemaining = dashboardData.reduce((sum: number, p: any) => sum + p.remainingSessions, 0);
    
    // Calculate WC and EPC counts for display
    // Use the program_type from cases table to match exactly what's stored
    const wcPatients = dashboardData.filter((p: any) => p.program === wcTag).length;
    const epcPatients = dashboardData.filter((p: any) => p.program === epcTag).length;
    
    // Debug: Log what program types are actually in the data
    const uniquePrograms = Array.from(new Set(dashboardData.map((p: any) => p.program)));

    // Get unique physios and locations
    const uniquePhysios = Array.from(new Set(dashboardData.map((p: any) => p.physio)));
    const uniqueLocations = Array.from(new Set(dashboardData.map((p: any) => p.location)));

    return NextResponse.json({
      success: true,
      patients: dashboardData,
      kpiData: {
        totalPatients,
        totalSessionsRemaining,
        actionNeededPatients,
        pendingPatients,
        wcPatients,
        epcPatients
      },
      filters: {
        physios: uniquePhysios,
        locations: uniqueLocations
      },
      practitionerOptions: [
        { value: 'all', label: 'All' },
        // Add practitioners from practitioners table
        ...(practitioners || []).map((p: any) => ({
          value: p.display_name,
          label: p.display_name,
          id: p.id,
          pms_id: p.pms_practitioner_id
        })),
        // Add unique physio names from cases that aren't in practitioners table
        ...(casePhysioNames || [])
          .filter((c: any) => {
            // Only include if not already in practitioners list
            return !(practitioners || []).some((p: any) => 
              p.display_name === c.physio_name || 
              p.pms_practitioner_id === c.pms_practitioner_id
            );
          })
          .reduce((unique: any[], current: any) => {
            // Remove duplicates from cases
            if (!unique.some(u => u.physio_name === current.physio_name)) {
              unique.push(current);
            }
            return unique;
          }, [])
          .map((c: any) => ({
            value: c.physio_name,
            label: c.physio_name,
            id: null,
            pms_id: c.pms_practitioner_id
          }))
      ].sort((a, b) => {
        if (a.value === 'all') return -1;
        if (b.value === 'all') return 1;
        return a.label.localeCompare(b.label);
      }),
      currentFilter: practitionerFilter || 'all',
      lastSync: new Date().toISOString(),
      userTags: {
        wcTag,
        epcTag
      }
    });

  } catch (error) {
    console.error('Dashboard data fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data.' },
      { status: 500 }
    );
  }
}

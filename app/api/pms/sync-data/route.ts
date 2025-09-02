import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server-admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pmsType = searchParams.get('pmsType');
    const lastSync = searchParams.get('lastSync');

    if (!pmsType) {
      return NextResponse.json({ error: 'PMS type is required' }, { status: 400 });
    }

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase admin client
    const supabase = createAdminClient();

    // Get user from token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    // Get user's PMS credentials
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, pms_type')
      .eq('auth_user_id', user.id)
      .single();

    if (userError) {
      return NextResponse.json({ error: 'Failed to fetch user data.' }, { status: 500 });
    }

    // Get stored API key for the PMS
    const { data: pmsCredentials, error: credError } = await supabase
      .from('pms_api_keys')
      .select('api_key_encrypted, api_url, clinic_id')
      .eq('user_id', userData.id)
      .eq('pms_type', pmsType)
      .eq('is_active', true)
      .single();

    if (credError || !pmsCredentials) {
      return NextResponse.json(
        { error: 'PMS credentials not found or inactive.' },
        { status: 400 }
      );
    }

    // Fetch data from PMS based on type
    let pmsData;

    switch (pmsType.toLowerCase()) {
      case 'nookal':
        pmsData = await fetchNookalData(pmsCredentials, lastSync);
        break;
      case 'cliniko':
        pmsData = await fetchClinikoData(pmsCredentials, lastSync);
        break;
      case 'other':
        return NextResponse.json({ error: 'Custom PMS integration requires manual setup. Please contact support.' }, { status: 400 });
      default:
        return NextResponse.json({ error: 'Unsupported PMS type.' }, { status: 400 });
    }

    if (!pmsData.success) {
      return NextResponse.json({ error: pmsData.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      patients: pmsData.patients,
      appointments: pmsData.appointments,
      lastSync: new Date().toISOString(),
    });
  } catch (error) {
    console.error('PMS sync data error:', error);
    return NextResponse.json({ error: 'Failed to fetch PMS data.' }, { status: 500 });
  }
}

// Fetch data from Nookal
async function fetchNookalData(credentials: any, lastSync: string | null) {
  try {
    // Decrypt API key (you'll need to implement this)
    const apiKey = credentials.api_key_encrypted; // In production, decrypt this

    // Build query parameters for incremental sync
    const queryParams = new URLSearchParams();
    if (lastSync) {
      queryParams.append('modified_since', lastSync);
    }

    // Fetch patients
    const patientsResponse = await fetch(`${credentials.api_url}/patients?${queryParams}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!patientsResponse.ok) {
      throw new Error(`Nookal patients API failed: ${patientsResponse.statusText}`);
    }

    const patientsData = await patientsResponse.json();

    // Fetch appointments
    const appointmentsResponse = await fetch(`${credentials.api_url}/appointments?${queryParams}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!appointmentsResponse.ok) {
      throw new Error(`Nookal appointments API failed: ${appointmentsResponse.statusText}`);
    }

    const appointmentsData = await appointmentsResponse.json();

    // Transform Nookal data to our format
    const patients =
      patientsData.data?.map((patient: any) => ({
        id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        email: patient.email,
        phone: patient.phone,
        date_of_birth: patient.date_of_birth,
        patient_type: patient.patient_type,
        physio_name: patient.physio_name,
        pms_last_modified: patient.modified_at || patient.created_at,
      })) || [];

    const appointments =
      appointmentsData.data?.map((apt: any) => ({
        id: apt.id,
        patient_id: apt.patient_id,
        appointment_type: apt.appointment_type,
        status: apt.status,
        appointment_date: apt.start_time,
        practitioner_name: apt.practitioner_name,
        is_completed: apt.status === 'completed',
        pms_last_modified: apt.modified_at || apt.created_at,
      })) || [];

    return {
      success: true,
      patients,
      appointments,
    };
  } catch (error) {
    return {
      success: false,
      error: `Nookal sync failed: ${error.message}`,
    };
  }
}

// Fetch data from Cliniko
async function fetchClinikoData(credentials: any, lastSync: string | null) {
  try {
    const apiKey = credentials.api_key_encrypted;

    // Build query parameters for incremental sync
    const queryParams = new URLSearchParams();
    if (lastSync) {
      queryParams.append('since', lastSync);
    }

    // Fetch patients
    const patientsResponse = await fetch(`${credentials.api_url}/patients?${queryParams}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });

    if (!patientsResponse.ok) {
      throw new Error(`Cliniko patients API failed: ${patientsResponse.statusText}`);
    }

    const patientsData = await patientsResponse.json();

    // Fetch appointments
    const appointmentsResponse = await fetch(`${credentials.api_url}/appointments?${queryParams}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });

    if (!appointmentsResponse.ok) {
      throw new Error(`Cliniko appointments API failed: ${appointmentsResponse.statusText}`);
    }

    const appointmentsData = await appointmentsResponse.json();

    // Transform Cliniko data to our format
    const patients =
      patientsData.patients?.map((patient: any) => ({
        id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        email: patient.email,
        phone: patient.phone,
        date_of_birth: patient.date_of_birth,
        patient_type: patient.patient_type,
        physio_name: patient.practitioner_name,
        pms_last_modified: patient.updated_at || patient.created_at,
      })) || [];

    const appointments =
      appointmentsData.appointments?.map((apt: any) => ({
        id: apt.id,
        patient_id: apt.patient_id,
        appointment_type: apt.appointment_type,
        status: apt.status,
        appointment_date: apt.start_time,
        practitioner_name: apt.practitioner_name,
        is_completed: apt.status === 'completed',
        pms_last_modified: apt.updated_at || apt.created_at,
      })) || [];

    return {
      success: true,
      patients,
      appointments,
    };
  } catch (error) {
    return {
      success: false,
      error: `Cliniko sync failed: ${error.message}`,
    };
  }
}



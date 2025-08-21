import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server-admin';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pmsType, apiKey } = body;

    // Validate required fields
    if (!pmsType || !apiKey) {
      return NextResponse.json(
        {
          error: 'PMS type and API key are required',
        },
        { status: 400 }
      );
    }

    // Test the connection based on PMS type
    try {
      let isValid = false;
      let testMessage = '';

      switch (pmsType.toLowerCase()) {
        case 'cliniko':
          // Test Cliniko API connection
          const clinikoResponse = await fetch('https://api.cliniko.com/v1/patients', {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
              'User-Agent': 'LoveableApp/1.0',
            },
          });
          isValid = clinikoResponse.ok;
          testMessage = isValid ? 'Cliniko connection successful' : 'Cliniko connection failed';
          break;

        case 'halaxy':
          // Test Halaxy API connection
          const halaxyResponse = await fetch('https://api.halaxy.com/api/v1/patients', {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
              'User-Agent': 'LoveableApp/1.0',
            },
          });
          isValid = halaxyResponse.ok;
          testMessage = isValid ? 'Halaxy connection successful' : 'Halaxy connection failed';
          break;

        case 'nookal':
          // Test Nookal API connection
          const nookalResponse = await fetch('https://api.nookal.com/v1/patients', {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
              'User-Agent': 'LoveableApp/1.0',
            },
          });
          isValid = nookalResponse.ok;
          testMessage = isValid ? 'Nookal connection successful' : 'Nookal connection failed';
          break;

        default:
          return NextResponse.json(
            {
              error: 'Unsupported PMS type',
            },
            { status: 400 }
          );
      }

      if (!isValid) {
        return NextResponse.json(
          {
            error: `Failed to connect to ${pmsType}: ${testMessage}`,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        message: `Successfully connected to ${pmsType}`,
        pmsType,
        isValid: true,
      });
    } catch (error) {
      console.error(`Error testing ${pmsType} connection:`, error);
      return NextResponse.json(
        {
          error: `Failed to test connection to ${pmsType}. Please check your API key and try again.`,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Test connection error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

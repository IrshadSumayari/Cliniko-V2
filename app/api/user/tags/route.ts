import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server-admin';

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Create admin client to verify the token and get user info
    const supabase = createAdminClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Get user tags from the users table
    const { data: userTags, error: tagsError } = await supabase
      .from('users')
      .select('wc, epc')
      .eq('auth_user_id', user.id)
      .single();

    if (tagsError) {
      console.error('Error fetching user tags:', tagsError);
      if (tagsError.code === 'PGRST116') {
        // User doesn't exist in users table, return default values
        return NextResponse.json({
          wc: 'WC',
          epc: 'EPC'
        });
      }
      return NextResponse.json({ error: 'Failed to fetch user tags' }, { status: 500 });
    }

    return NextResponse.json({
      wc: userTags?.wc || 'WC',
      epc: userTags?.epc || 'EPC'
    });

  } catch (error) {
    console.error('Get user tags error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    // First, check if user exists in the users table
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    let userId: string;

    if (userError && userError.code === 'PGRST116') {
      // User doesn't exist in users table, create them first
      console.log('Creating new user in users table for auth user:', user.id);
      
      const { data: newUser, error: createUserError } = await supabase
        .from('users')
        .insert({
          auth_user_id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || 
                    `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 
                    user.email?.split('@')[0] || 'User',
          is_onboarded: false,
          subscription_status: 'trial',
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createUserError) {
        console.error('Error creating user in users table:', createUserError);
        return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 });
      }

      userId = newUser.id;
      console.log('Successfully created user with ID:', userId);
    } else if (userError) {
      console.error('Error checking user existence:', userError);
      return NextResponse.json({ error: 'Failed to verify user account' }, { status: 500 });
    } else {
      userId = existingUser.id;
      console.log('User already exists with ID:', userId);
    }

    // Now fetch user profile from the profiles table and user tags from users table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Also fetch user tags (WC and EPC) from the users table
    const { data: userTags, error: tagsError } = await supabase
      .from('users')
      .select('wc, epc')
      .eq('id', userId)
      .single();

    if (tagsError) {
      console.error('Error fetching user tags:', tagsError);
      // Don't fail the request if tags fetch fails
    }

    if (profileError) {
      console.error('Error fetching profile:', profileError);

      // If it's a "no rows" error, we'll create a profile
      if (profileError.code === 'PGRST116') {
        console.log('No profile found, creating default profile for user:', userId);
      } else {
        // For other errors, return an error response
        return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
      }
    }

    if (!profile) {
      // Create a default profile if none exists
      console.log('Creating default profile for user:', {
        id: userId,
        email: user.email,
        metadata: user.user_metadata,
      });

      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: userId, // Use the users table ID, not the auth user ID
          email: user.email || '',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          clinic_name: user.user_metadata?.clinic_name || '',
          pms_type: null,
          pms_connected: false,
          pms_last_sync: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
      }

      console.log('Successfully created profile:', newProfile);
      return NextResponse.json({
        ...newProfile,
        userTags: userTags || { wc: 'WC', epc: 'EPC' } // Default values if tags not found
      });
    }

    // Return profile with user tags
    return NextResponse.json({
      ...profile,
      userTags: userTags || { wc: 'WC', epc: 'EPC' } // Default values if tags not found
    });
  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

    // Get the user ID from the users table
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (userError || !existingUser) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    const body = await request.json();
    const { first_name, last_name } = body;

    // Validate required fields
    if (!first_name || !last_name) {
      return NextResponse.json(
        {
          error: 'First name and last name are required',
        },
        { status: 400 }
      );
    }

    // Update user profile - only first_name and last_name
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        first_name,
        last_name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingUser.id) // Use the users table ID
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    // Also update user metadata in auth.users
    const { error: metadataError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        first_name,
        last_name,
      },
    });

    if (metadataError) {
      console.error('Error updating user metadata:', metadataError);
      // Don't fail the request if metadata update fails
    }

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error('Profile PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

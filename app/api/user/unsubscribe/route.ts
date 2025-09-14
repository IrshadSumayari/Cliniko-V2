import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';
import Stripe from 'stripe';

const stripe = new Stripe(config.stripe.secretKey, {
  typescript: true,
});

const supabaseUrl = config.supabase.url;
const supabaseServiceKey = config.supabase.serviceRoleKey;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required. Please provide a valid token.' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication token.' }, { status: 401 });
    }

    // Get the database user record
    const { data: dbUser, error: dbUserError } = await supabase
      .from('users')
      .select('id, auth_user_id, email, subscription_status, stripe_customer_id')
      .eq('auth_user_id', user.id)
      .single();

    if (dbUserError || !dbUser) {
      return NextResponse.json({ error: 'User record not found in database' }, { status: 404 });
    }

    // Check if user has an active subscription
    if (dbUser.subscription_status !== 'active') {
      return NextResponse.json({ 
        error: 'No active subscription found to cancel' 
      }, { status: 400 });
    }

    // Cancel the Stripe subscription if customer ID exists
    if (dbUser.stripe_customer_id) {
      try {
        // Get active subscriptions for the customer
        const subscriptions = await stripe.subscriptions.list({
          customer: dbUser.stripe_customer_id,
          status: 'active',
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          // Cancel the subscription
          await stripe.subscriptions.cancel(subscriptions.data[0].id);
        }
      } catch (stripeError) {
        // Log the error but continue with database update
        console.error('Error canceling Stripe subscription:', stripeError);
      }
    }

    // Update user status in database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        subscription_status: 'canceled',
        is_onboarded: false, // Set to false so user can't access dashboard
        updated_at: new Date().toISOString(),
      })
      .eq('id', dbUser.id);

    if (updateError) {
      return NextResponse.json({ 
        error: 'Failed to update subscription status' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription canceled successfully. You will be redirected to the unsubscribe confirmation page.',
      redirect: '/unsubscribe-confirmation',
    });

  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to cancel subscription',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

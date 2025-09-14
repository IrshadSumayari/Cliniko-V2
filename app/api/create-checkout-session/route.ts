import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';
import { getPlan, getPrice, validatePricingConfig, getPricingConfig } from '@/lib/pricing-config';

const stripe = new Stripe(config.stripe.secretKey, {});

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication token.' }, { status: 401 });
    }

    const { userId, email, plan, isYearly, amount } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    if (!plan) {
      return NextResponse.json({ error: 'Plan is required' }, { status: 400 });
    }


    // Verify that the authenticated user matches the requested userId
    if (user.id !== userId) {
      return NextResponse.json(
        { error: "Unauthorized access to this user's data." },
        { status: 403 }
      );
    }

    // Get the database user record to use the correct internal ID
    const { data: dbUser, error: dbUserError } = await supabase
      .from('users')
      .select('id, auth_user_id, email')
      .eq('auth_user_id', user.id)
      .single();

    if (dbUserError || !dbUser) {
      return NextResponse.json({ error: 'User record not found in database' }, { status: 404 });
    }


    // Get pricing configuration
    const pricingConfig = getPricingConfig();
    
    // Validate pricing configuration
    if (!validatePricingConfig(pricingConfig)) {
      return NextResponse.json({ error: 'Pricing configuration error' }, { status: 500 });
    }

    // Get the selected plan
    const selectedPlan = getPlan(plan);
    if (!selectedPlan) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    // Use existing Stripe price ID if available
    const priceId = isYearly ? selectedPlan.stripePriceId?.yearly : selectedPlan.stripePriceId?.monthly;
    
    let session;
    
    if (priceId) {
      // Use existing Stripe price ID
      session = await stripe.checkout.sessions.create({
        customer_email: email,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${config.app.url}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.app.url}/`,
        metadata: {
          userId: dbUser.id,
          authUserId: user.id,
          plan: plan,
          isYearly: isYearly.toString(),
        },
        subscription_data: {
          metadata: {
            userId: dbUser.id,
            authUserId: user.id,
            plan: plan,
            isYearly: isYearly.toString(),
          },
        },
      });
    } else {
      // Fallback: Create price dynamically if no existing price ID
      const unitAmount = getPrice(selectedPlan, isYearly);
      const interval = isYearly ? 'year' : 'month';
      
      session = await stripe.checkout.sessions.create({
        customer_email: email,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'aud',
              product_data: {
                name: selectedPlan.name,
                description: selectedPlan.description,
              },
              unit_amount: unitAmount,
              recurring: {
                interval: interval,
              },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${config.app.url}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.app.url}/`,
        metadata: {
          userId: dbUser.id,
          authUserId: user.id,
          plan: plan,
          isYearly: isYearly.toString(),
        },
        subscription_data: {
          metadata: {
            userId: dbUser.id,
            authUserId: user.id,
            plan: plan,
            isYearly: isYearly.toString(),
          },
        },
      });
    }

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

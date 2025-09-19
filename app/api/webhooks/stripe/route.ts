import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';

// Configure the API route to handle raw body
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Use server-side Supabase client with service role key for webhooks
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-07-30.basil',
});

// Support multiple signing secrets (comma-separated) for rotations/multiple endpoints
const endpointSecrets = (config.stripe.webhookSecret || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function updateUserSubscription(
  updateData: Record<string, unknown>,
  identifiers: { id?: string | null; authUserId?: string | null; stripeCustomerId?: string | null }
): Promise<boolean> {
  // Try by database id
  if (identifiers.id) {
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', identifiers.id)
      .select('id');
    if (!error && data && data.length > 0) {
      return true;
    }
  }

  // Try by auth_user_id
  if (identifiers.authUserId) {
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('auth_user_id', identifiers.authUserId)
      .select('id');
    if (!error && data && data.length > 0) {
      return true;
    }
  }

  // Try by stripe_customer_id
  if (identifiers.stripeCustomerId) {
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('stripe_customer_id', identifiers.stripeCustomerId)
      .select('id');
    if (!error && data && data.length > 0) {
      return true;
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body as text
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('No Stripe signature found');
      return NextResponse.json({ error: 'No signature provided' }, { status: 400 });
    }

    if (endpointSecrets.length === 0) {
      console.error('Webhook secret not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    let event: Stripe.Event | null = null;
    let verificationError: any = null;

    for (let i = 0; i < endpointSecrets.length; i++) {
      const secret = endpointSecrets[i];
      try {
        event = stripe.webhooks.constructEvent(body, signature as string, secret);
        break;
      } catch (err: any) {
        verificationError = err;
      }
    }

    if (!event) {
      console.error('Webhook signature verification failed:', verificationError?.message);
      return NextResponse.json(
        {
          error: `Webhook signature verification failed: ${verificationError?.message || 'Unknown error'}`,
        },
        { status: 400 }
      );
    }


    // Handle the event
    switch ((event as Stripe.Event).type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;

        // Update user subscription status
        if (session.metadata?.userId) {
          // Try to update by database ID first
          let { error } = await supabase
            .from('users')
            .update({
              subscription_status: 'active',
              stripe_customer_id: session.customer as string,
            })
            .eq('id', session.metadata.userId);

          // If that fails and we have authUserId, try updating by auth_user_id
          if (error && session.metadata.authUserId) {
            ({ error } = await supabase
              .from('users')
              .update({
                subscription_status: 'active',
                stripe_customer_id: session.customer as string,
              })
              .eq('auth_user_id', session.metadata.authUserId));
          }

          if (error) {
            console.error('Error updating user subscription:', error);
          }
        }
        break;

      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;

        // If user cancels but Stripe keeps service until period end, we still deactivate immediately
        if ((subscription as any).cancel_at_period_end === true) {
          const updateData = { subscription_status: 'inactive', is_onboarded: false } as const;

          const stripeCustomerId =
            typeof subscription.customer === 'string'
              ? subscription.customer
              : (subscription.customer as Stripe.Customer | null)?.id;

          await updateUserSubscription(updateData, {
            id: subscription.metadata?.userId || null,
            authUserId: subscription.metadata?.authUserId || null,
            stripeCustomerId: stripeCustomerId || null,
          });
          break;
        }

        {
          let subscriptionStatus = 'inactive';
          let updateData: any = {};

          switch (subscription.status) {
            case 'active':
              subscriptionStatus = 'active';
              updateData = { subscription_status: subscriptionStatus };
              break;

            case 'past_due':
              subscriptionStatus = 'past_due';
              updateData = { subscription_status: subscriptionStatus };
              break;

            case 'unpaid':
              subscriptionStatus = 'unpaid';
              updateData = { subscription_status: subscriptionStatus };
              break;

            case 'canceled':
              subscriptionStatus = 'inactive';
              updateData = { subscription_status: subscriptionStatus, is_onboarded: false };
              break;

            default:
              subscriptionStatus = 'inactive';
              updateData = { subscription_status: subscriptionStatus };
          }

          const stripeCustomerId =
            typeof subscription.customer === 'string'
              ? subscription.customer
              : (subscription.customer as Stripe.Customer | null)?.id;

          await updateUserSubscription(updateData, {
            id: subscription.metadata?.userId || null,
            authUserId: subscription.metadata?.authUserId || null,
            stripeCustomerId: stripeCustomerId || null,
          });
        }
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;

        {
          const updateData = { subscription_status: 'inactive', is_onboarded: false } as const;

          const stripeCustomerId =
            typeof deletedSubscription.customer === 'string'
              ? deletedSubscription.customer
              : (deletedSubscription.customer as Stripe.Customer | null)?.id;

          await updateUserSubscription(updateData, {
            id: deletedSubscription.metadata?.userId || null,
            authUserId: deletedSubscription.metadata?.authUserId || null,
            stripeCustomerId: stripeCustomerId || null,
          });
        }
        break;

      default:
        // Unhandled event type
    }

    return NextResponse.json({ received: true, eventType: event.type });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

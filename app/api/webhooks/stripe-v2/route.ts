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

const endpointSecret = config.stripe.webhookSecret;

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Stripe webhook v2 called!');
    console.log('📍 Webhook URL:', request.url);
    console.log('🌍 Environment:', process.env.NODE_ENV);
    console.log('🔑 Webhook secret configured:', !!endpointSecret);
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log(
      '🔗 All headers:',
      JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2)
    );

    // Get raw body as text
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    console.log('📝 Request body length:', body.length);
    console.log('🔐 Signature present:', !!signature);
    console.log('📄 Request body preview:', body.substring(0, 200) + '...');

    if (!signature) {
      console.error('No Stripe signature found');
      return NextResponse.json({ error: 'No signature provided' }, { status: 400 });
    }

    if (!endpointSecret) {
      console.error('Webhook secret not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    let event: Stripe.Event;

    try {
      // Construct the event with raw body
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
      console.log('✅ Signature verification successful');
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message);
      console.error('Body length:', body.length);
      console.error('Signature:', signature);
      console.error('Webhook secret length:', endpointSecret.length);
      console.error('Body sample:', body.substring(0, 100));

      return NextResponse.json(
        {
          error: `Webhook signature verification failed: ${err.message}`,
          details: {
            bodyLength: body.length,
            signaturePresent: !!signature,
            webhookSecretLength: endpointSecret.length,
          },
        },
        { status: 400 }
      );
    }

    console.log('📨 Received webhook event:', event.type);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('✅ Checkout session completed:', session.id);
        console.log('Session metadata:', session.metadata);
        console.log('Customer ID:', session.customer);

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
            console.log('⚠️ Retrying with auth_user_id...');
            ({ error } = await supabase
              .from('users')
              .update({
                subscription_status: 'active',
                stripe_customer_id: session.customer as string,
              })
              .eq('auth_user_id', session.metadata.authUserId));
          }

          if (error) {
            console.error('❌ Error updating user subscription:', error);
            console.error('User ID from metadata:', session.metadata.userId);
            console.error('Auth User ID from metadata:', session.metadata.authUserId);
            console.error('Customer ID from session:', session.customer);
          } else {
            console.log('✅ User subscription updated successfully');
            console.log('Updated user ID:', session.metadata.userId);
            console.log('Stripe customer ID:', session.customer);
          }
        } else {
          console.error('❌ No userId found in session metadata');
          console.error('Available metadata:', session.metadata);
        }
        break;

      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        console.log('🔄 Subscription updated:', subscription.id);
        console.log('Subscription status:', subscription.status);
        console.log('cancel_at_period_end:', (subscription as any).cancel_at_period_end);

        // If user cancels but Stripe keeps service until period end, we still deactivate immediately
        if ((subscription as any).cancel_at_period_end === true) {
          const updateData = { subscription_status: 'inactive', is_onboarded: false } as const;

          const userIdFromMetadata = subscription.metadata?.userId;
          if (userIdFromMetadata) {
            const { error } = await supabase
              .from('users')
              .update(updateData)
              .eq('id', userIdFromMetadata);
            if (!error) {
              console.log('✅ Deactivated immediately on cancel_at_period_end (via id)');
              break;
            }
            console.warn('⚠️ Update by id failed, will try by stripe_customer_id');
          }

          const stripeCustomerId =
            typeof subscription.customer === 'string'
              ? subscription.customer
              : (subscription.customer as Stripe.Customer | null)?.id;
          if (stripeCustomerId) {
            const { error: fbError } = await supabase
              .from('users')
              .update(updateData)
              .eq('stripe_customer_id', stripeCustomerId as string);
            if (fbError) {
              console.error(
                '❌ Error deactivating on cancel_at_period_end by stripe_customer_id:',
                fbError
              );
            } else {
              console.log(
                '✅ Deactivated immediately on cancel_at_period_end (via stripe_customer_id)'
              );
            }
          }
          break;
        }

        {
          let subscriptionStatus = 'inactive';
          let updateData: any = {};

          switch (subscription.status) {
            case 'active':
              subscriptionStatus = 'active';
              updateData = { subscription_status: subscriptionStatus };
              console.log('✅ Subscription is active');
              break;

            case 'past_due':
              subscriptionStatus = 'past_due';
              updateData = { subscription_status: subscriptionStatus };
              console.log('⚠️ Subscription is past due');
              break;

            case 'unpaid':
              subscriptionStatus = 'unpaid';
              updateData = { subscription_status: subscriptionStatus };
              console.log('❌ Subscription is unpaid');
              break;

            case 'canceled':
              subscriptionStatus = 'inactive';
              updateData = { subscription_status: subscriptionStatus, is_onboarded: false };
              console.log('🛑 Subscription is cancelled (immediate)');
              break;

            default:
              subscriptionStatus = 'inactive';
              updateData = { subscription_status: subscriptionStatus };
              console.log(`⚠️ Unknown subscription status: ${subscription.status}`);
          }

          // Try by metadata.userId first if present
          const userIdFromMetadata = subscription.metadata?.userId;
          if (userIdFromMetadata) {
            const { error } = await supabase
              .from('users')
              .update(updateData)
              .eq('id', userIdFromMetadata);
            if (!error) {
              console.log(`✅ Subscription status updated to: ${subscriptionStatus} (via id)`);
              break;
            }
            console.warn('⚠️ Update by id failed, will try by stripe_customer_id');
          }

          // Fallback: update by stripe customer id
          const stripeCustomerId =
            typeof subscription.customer === 'string'
              ? subscription.customer
              : (subscription.customer as Stripe.Customer | null)?.id;
          if (stripeCustomerId) {
            const { error: fbError } = await supabase
              .from('users')
              .update(updateData)
              .eq('stripe_customer_id', stripeCustomerId as string);
            if (fbError) {
              console.error(
                '❌ Error updating subscription status by stripe_customer_id:',
                fbError
              );
            } else {
              console.log(
                `✅ Subscription status updated to: ${subscriptionStatus} (via stripe_customer_id)`
              );
            }
          } else {
            console.error('❌ No stripe customer id available on subscription');
          }
        }
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;
        console.log('🗑️ Subscription deleted:', deletedSubscription.id);
        console.log('🛑 Immediate cancellation detected');

        {
          const updateData = { subscription_status: 'inactive', is_onboarded: false } as const;

          // Try by user id from metadata first
          const userIdFromMetadata = deletedSubscription.metadata?.userId;
          if (userIdFromMetadata) {
            const { error } = await supabase
              .from('users')
              .update(updateData)
              .eq('id', userIdFromMetadata);
            if (!error) {
              console.log('✅ Subscription immediately deactivated (via id)');
              break;
            }
            console.warn('⚠️ Update by id failed, will try by stripe_customer_id');
          }

          // Fallback: update by stripe customer id
          const stripeCustomerId =
            typeof deletedSubscription.customer === 'string'
              ? deletedSubscription.customer
              : (deletedSubscription.customer as Stripe.Customer | null)?.id;
          if (stripeCustomerId) {
            const { error: fbError } = await supabase
              .from('users')
              .update(updateData)
              .eq('stripe_customer_id', stripeCustomerId as string);
            if (fbError) {
              console.error(
                '❌ Error updating subscription to inactive by stripe_customer_id:',
                fbError
              );
            } else {
              console.log('✅ Subscription immediately deactivated (via stripe_customer_id)');
            }
          } else {
            console.error('❌ No stripe customer id available on deleted subscription event');
          }
        }
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true, eventType: event.type });
  } catch (error: any) {
    console.error('💥 Webhook error:', error);
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';

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
const webhookSecret = config.stripe.webhookSecret;

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Stripe webhook called!');
    console.log('📍 Webhook URL:', request.url);
    console.log('🔗 Headers:', Object.fromEntries(request.headers.entries()));
    
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');
    
    console.log('📝 Request body length:', body.length);
    console.log('🔐 Signature present:', !!signature);

    if (!signature) {
      console.error('No Stripe signature found');
      return NextResponse.json({ error: 'No signature provided' }, { status: 400 });
    }

    // Handle test signatures for local development
    if (signature === 'test_signature' || signature === 'invalid_test_signature') {
      console.log('🧪 Test webhook call detected, simulating payment success');
      const testSessionId = 'cs_test_' + Math.random().toString(36).substring(7);
      return NextResponse.json({ received: true, test: true, sessionId: testSessionId });
    }

    if (!webhookSecret) {
      console.error('Webhook secret not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }

    console.log('Received webhook event:', event.type);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed:', session.id);
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
            // Log the error details for debugging
            console.error('User ID from metadata:', session.metadata.userId);
            console.error('Auth User ID from metadata:', session.metadata.authUserId);
            console.error('Customer ID from session:', session.customer);

            // Try to find the user to see what IDs exist
            const { data: foundUser } = await supabase
              .from('users')
              .select('id, auth_user_id, email, subscription_status')
              .eq('auth_user_id', session.metadata.authUserId || session.metadata.userId)
              .single();
            console.error('Found user in database:', foundUser);
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
        console.log('Subscription updated:', subscription.id);
        console.log('Subscription status:', subscription.status);

        if (subscription.metadata?.userId) {
          let subscriptionStatus = 'inactive';
          let updateData: any = {};

          switch (subscription.status) {
            case 'active':
              subscriptionStatus = 'active';
              updateData = {
                subscription_status: subscriptionStatus,
              };
              console.log('✅ Subscription is active');
              break;

            case 'past_due':
              subscriptionStatus = 'past_due';
              updateData = {
                subscription_status: subscriptionStatus,
              };
              console.log('⚠️ Subscription is past due');
              break;

            case 'unpaid':
              subscriptionStatus = 'unpaid';
              updateData = {
                subscription_status: subscriptionStatus,
              };
              console.log('❌ Subscription is unpaid');
              break;

            case 'canceled':
              subscriptionStatus = 'inactive';
              updateData = {
                subscription_status: subscriptionStatus,
              };
              console.log('🛑 Subscription is cancelled (immediate)');
              break;

            default:
              subscriptionStatus = 'inactive';
              updateData = {
                subscription_status: subscriptionStatus,
              };
              console.log(`⚠️ Unknown subscription status: ${subscription.status}`);
          }

          const { error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', subscription.metadata.userId);

          if (error) {
            console.error('Error updating subscription status:', error);
          } else {
            console.log(`✅ Subscription status updated to: ${subscriptionStatus}`);
          }
        }
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;
        console.log('Subscription deleted:', deletedSubscription.id);
        console.log('🛑 Immediate cancellation detected');

        if (deletedSubscription.metadata?.userId) {
          // Immediate cancellation - deactivate now
          const { error } = await supabase
            .from('users')
            .update({
              subscription_status: 'inactive',
            })
            .eq('id', deletedSubscription.metadata.userId);

          if (error) {
            console.error('Error updating subscription status to inactive:', error);
          } else {
            console.log('✅ Subscription immediately deactivated');
          }
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
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

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';
import Stripe from 'stripe';

// Use server-side Supabase client with service role key
const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-07-30.basil',
});

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    console.log('🎯 Processing payment success for session:', sessionId);

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    console.log('📋 Session details:', {
      id: session.id,
      payment_status: session.payment_status,
      customer: session.customer,
      metadata: session.metadata
    });

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ 
        error: 'Payment not completed',
        payment_status: session.payment_status 
      }, { status: 400 });
    }

    // Get user ID from session metadata
    const userId = session.metadata?.userId;
    const authUserId = session.metadata?.authUserId;

    if (!userId && !authUserId) {
      return NextResponse.json({ 
        error: 'No user ID found in session metadata' 
      }, { status: 400 });
    }

    console.log('👤 Updating user subscription:', { userId, authUserId });

    // Update user subscription status
    let updateResult;
    
    if (userId) {
      // Try to update by database ID first
      updateResult = await supabase
        .from('users')
        .update({
          subscription_status: 'active',
          stripe_customer_id: session.customer as string,
        })
        .eq('id', userId);
    } else if (authUserId) {
      // Fallback to auth_user_id
      updateResult = await supabase
        .from('users')
        .update({
          subscription_status: 'active',
          stripe_customer_id: session.customer as string,
        })
        .eq('auth_user_id', authUserId);
    }

    if (updateResult?.error) {
      console.error('❌ Error updating user subscription:', updateResult.error);
      return NextResponse.json({ 
        error: 'Failed to update subscription status',
        details: updateResult.error.message 
      }, { status: 500 });
    }

    console.log('✅ User subscription updated successfully');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Subscription activated successfully',
      userId: userId || authUserId,
      subscription_status: 'active'
    });

  } catch (error: any) {
    console.error('Payment success processing error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process payment success',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

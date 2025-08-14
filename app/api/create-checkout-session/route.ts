import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(config.stripe.secretKey, {});

// Create server-side Supabase client with service role key
import { config } from "@/lib/config";

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
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required. Please provide a valid token." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Verify the token and get user
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid authentication token." },
        { status: 401 }
      );
    }

    const { userId, email } = await request.json();
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Verify that the authenticated user matches the requested userId
    if (user.id !== userId) {
      return NextResponse.json(
        { error: "Unauthorized access to this user's data." },
        { status: 403 }
      );
    }

    // Get the professional plan price ID
    const priceId = config.stripe.priceIds.professional;

    if (!priceId) {
      console.error("NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID not configured");
      return NextResponse.json(
        { error: "Stripe configuration error - missing price ID" },
        { status: 500 }
      );
    }

    console.log("Using price ID:", priceId);

    // Create Stripe checkout session
    console.log("Creating Stripe checkout session...");
    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
              success_url: `${config.app.url}/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.app.url}/`,
      metadata: {
        userId: userId,
        planType: "professional",
      },
      subscription_data: {
        metadata: {
          userId: userId,
        },
      },
    });

    console.log("Checkout session created successfully:", session.id);
    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      {
        error: "Failed to create checkout session",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

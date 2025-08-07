import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/integrations/supabase/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

export async function POST(request: NextRequest) {
  try {
    const response = await request.json();
    const { priceId, userId } = response;

    console.log("Received request:", { priceId, userId });

    // Extract price ID if it's a full URL
    let cleanPriceId = priceId;
    if (
      priceId.includes("stripe.com") ||
      priceId.includes("dashboard.stripe.com")
    ) {
      const priceIdMatch = priceId.match(/price_[a-zA-Z0-9]+/);
      if (priceIdMatch) {
        cleanPriceId = priceIdMatch[0];
      }
    }

    console.log("Clean price ID:", cleanPriceId);

    // Validate price ID format
    if (!cleanPriceId.startsWith("price_")) {
      return NextResponse.json(
        { error: "Invalid price ID format" },
        { status: 400 }
      );
    }

    // Handle test mode - if userId is not a valid UUID, use test mode
    const isTestMode =
      !userId ||
      userId === "test-user-id-123" ||
      !userId.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );

    let customerEmail = "test@example.com";
    let customerName = "Test User";

    if (!isTestMode) {
      // Query for real user
      const { data: users, error } = await supabase
        .from("users")
        .select("id, email, first_name, last_name")
        .eq("id", userId);

      if (error) {
        console.error("Database error:", error);
        return NextResponse.json(
          { error: `Database error: ${error.message}` },
          { status: 500 }
        );
      }
      console.log(response, "pop");
      if (!users || users.length === 0) {
        return NextResponse.json(
          { error: `User not found: No user with ID ${userId}` },
          { status: 404 }
        );
      }

      const user = users[0];
      customerEmail = user.email;
      customerName = `${user.first_name} ${user.last_name}`;
    }

    console.log("Customer info:", { customerEmail, customerName, isTestMode });

    // Verify the price exists in Stripe
    try {
      await stripe.prices.retrieve(cleanPriceId);
    } catch (error) {
      console.error("Price not found in Stripe:", error);
      return NextResponse.json(
        { error: `Price not found: ${cleanPriceId}` },
        { status: 404 }
      );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: cleanPriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      }/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      }/pricing`,
      customer_email: customerEmail,
      metadata: {
        userId: userId,
        isTestMode: isTestMode.toString(),
      },
    });

    console.log("Checkout session created:", session.id);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      customer: customerName,
      isTestMode,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

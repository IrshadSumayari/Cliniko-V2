import Stripe from "stripe";
import { config } from "@/lib/config";

export const stripe = new Stripe(config.stripe.secretKey, {
  typescript: true,
});

export const STRIPE_PLANS = {
  professional: config.stripe.priceIds.professional,
};

export async function createStripeCustomer(email: string, name: string) {
  return await stripe.customers.create({
    email,
    name,
  });
}

export async function createSubscription(
  customerId: string,
  planId: keyof typeof STRIPE_PLANS
) {
  const plan = STRIPE_PLANS[planId];

  if (!plan) {
    throw new Error(`Invalid plan: ${planId}`);
  }

  // Create price if it doesn't exist
  const prices = await stripe.prices.list({
    lookup_keys: [planId],
    limit: 1,
  });

  let priceId: string;

  if (prices.data.length === 0) {
    const price = await stripe.prices.create({
      unit_amount: plan === "price_basic" ? 0 : 30,
      currency: "aud",
      recurring: {
        interval: "month",
      },
      product_data: {
        name: plan === "price_basic" ? "Basic" : "price_professional",
      },
      lookup_key: planId,
    });
    priceId = price.id;
  } else {
    priceId = prices.data[0].id;
  }

  return await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.payment_intent"],
  });
}

export async function createCheckoutSession(
  customerId: string,
  planId: keyof typeof STRIPE_PLANS,
  successUrl: string,
  cancelUrl: string
) {
  const plan = STRIPE_PLANS[planId];

  if (!plan) {
    throw new Error(`Invalid plan: ${planId}`);
  }

  // Create or get price
  const prices = await stripe.prices.list({
    lookup_keys: [planId],
    limit: 1,
  });

  let priceId: string;

  if (prices.data.length === 0) {
    const price = await stripe.prices.create({
      unit_amount:
        plan === "price_basic"
          ? 0
          : plan === "price_professional"
          ? 2900
          : 7900,
      currency: "aud",
      recurring: {
        interval: "month",
      },
      product_data: {
        name: plan === "price_basic" ? "Basic" : "price_professional",
      },
      lookup_key: planId,
    });
    priceId = price.id;
  } else {
    priceId = prices.data[0].id;
  }

  return await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        plan_id: planId,
      },
    },
  });
}

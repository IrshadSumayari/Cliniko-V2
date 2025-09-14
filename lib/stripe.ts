import Stripe from 'stripe';
import { config } from '@/lib/config';
import { getPricingConfig, getPlan } from '@/lib/pricing-config';

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

export async function createSubscription(customerId: string, planId: string, isYearly: boolean = false) {
  const plan = getPlan(planId);

  if (!plan) {
    throw new Error(`Invalid plan: ${planId}`);
  }

  // Use existing Stripe price ID if available
  const priceId = isYearly ? plan.stripePriceId?.yearly : plan.stripePriceId?.monthly;
  
  if (priceId) {
    // Use the existing price ID from environment
    return await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });
  }

  // Fallback: Create price if no existing price ID is found
  const lookupKey = `${planId}_${isYearly ? 'yearly' : 'monthly'}`;
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
  });

  let newPriceId: string;

  if (prices.data.length === 0) {
    const price = await stripe.prices.create({
      unit_amount: isYearly ? plan.yearlyPrice : plan.monthlyPrice,
      currency: 'aud',
      recurring: {
        interval: isYearly ? 'year' : 'month',
      },
      product_data: {
        name: plan.name,
        description: plan.description,
      },
      lookup_key: lookupKey,
    });
    newPriceId = price.id;
  } else {
    newPriceId = prices.data[0].id;
  }

  return await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: newPriceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
  });
}

export async function createCheckoutSession(
  customerId: string,
  planId: string,
  successUrl: string,
  cancelUrl: string,
  isYearly: boolean = false
) {
  const plan = getPlan(planId);

  if (!plan) {
    throw new Error(`Invalid plan: ${planId}`);
  }

  // Use existing Stripe price ID if available
  const priceId = isYearly ? plan.stripePriceId?.yearly : plan.stripePriceId?.monthly;
  
  if (priceId) {
    // Use the existing price ID from environment
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          plan_id: planId,
          is_yearly: isYearly.toString(),
        },
      },
    });
  }

  // Fallback: Create or get price if no existing price ID is found
  const lookupKey = `${planId}_${isYearly ? 'yearly' : 'monthly'}`;
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
  });

  let newPriceId: string;

  if (prices.data.length === 0) {
    const price = await stripe.prices.create({
      unit_amount: isYearly ? plan.yearlyPrice : plan.monthlyPrice,
      currency: 'aud',
      recurring: {
        interval: isYearly ? 'year' : 'month',
      },
      product_data: {
        name: plan.name,
        description: plan.description,
      },
      lookup_key: lookupKey,
    });
    newPriceId = price.id;
  } else {
    newPriceId = prices.data[0].id;
  }

  return await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: newPriceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        plan_id: planId,
        is_yearly: isYearly.toString(),
      },
    },
  });
}

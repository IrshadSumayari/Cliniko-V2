import { NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function GET() {
  const envVars = {
    STRIPE_SECRET_KEY: !!config.stripe.secretKey,
    STRIPE_WEBHOOK_SECRET: !!config.stripe.webhookSecret,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: !!config.stripe.publishableKey,
    NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID: !!config.stripe.priceIds.basic,
    NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID: !!config.stripe.priceIds.professional,
    NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID: !!config.stripe.priceIds.enterprise,
    NEXT_PUBLIC_APP_URL: config.app.url,
  };

  return NextResponse.json(envVars);
}

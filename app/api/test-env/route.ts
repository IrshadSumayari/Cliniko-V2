import { NextResponse } from "next/server";

export async function GET() {
  const envVars = {
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID:
      !!process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID,
    NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID:
      !!process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID,
    NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID:
      !!process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  };

  return NextResponse.json(envVars);
}

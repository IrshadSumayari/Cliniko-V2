import { NextResponse } from 'next/server'

export async function GET() {
  const envVars = {
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID: !!process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID,
    NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID: !!process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID,
    NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID: !!process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  }

  const missingVars = Object.entries(envVars)
    .filter(([key, value]) => !value && key !== 'NEXT_PUBLIC_APP_URL')
    .map(([key]) => key)

  return NextResponse.json({
    status: missingVars.length === 0 ? 'success' : 'warning',
    message: missingVars.length === 0 
      ? 'All environment variables are set' 
      : `Missing environment variables: ${missingVars.join(', ')}`,
    variables: envVars,
    missing: missingVars
  })
}

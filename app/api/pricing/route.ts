import { NextResponse } from 'next/server';
import { getPricingConfig, validatePricingConfig } from '@/lib/pricing-config';

export async function GET() {
  try {
    const pricingConfig = getPricingConfig();
    
    // Validate the configuration
    if (!validatePricingConfig(pricingConfig)) {
      return NextResponse.json(
        { error: 'Invalid pricing configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pricing: pricingConfig
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load pricing configuration' },
      { status: 500 }
    );
  }
}

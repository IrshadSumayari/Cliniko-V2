export interface PricingPlan {
  name: string;
  description: string;
  monthlyPrice: number; // in cents
  yearlyPrice: number; // in cents
  features: string[];
  popular?: boolean;
  stripePriceId?: {
    monthly?: string;
    yearly?: string;
  };
}

export interface PricingConfig {
  [key: string]: PricingPlan;
}

// Default pricing configuration - can be overridden by environment variables
const DEFAULT_PRICING: PricingConfig = {
  starter: {
    name: 'Starter Plan',
    description: 'Perfect for small clinics getting started',
    monthlyPrice: 4900, // $49.00 in cents
    yearlyPrice: 3700,  // $37.00 in cents
    features: [
      'Up to 50 patients',
      'Basic dashboard',
      'Standard EPC & WC tracking'
    ],
    popular: false,
    stripePriceId: {
      monthly: process.env.NEXT_PUBLIC_STARTER_MONTHLY_PRICE_ID,
      yearly: process.env.NEXT_PUBLIC_STARTER_YEARLY_PRICE_ID
    }
  },
  professional: {
    name: 'Professional Plan',
    description: 'The choice for most successful clinics',
    monthlyPrice: 9900, // $99.00 in cents
    yearlyPrice: 7400,  // $74.00 in cents
    features: [
      'Unlimited patients',
      'Full dashboard with analytics',
      'Smart email alerts',
      'Advanced compliance features'
    ],
    popular: true,
    stripePriceId: {
      monthly: process.env.NEXT_PUBLIC_PROFESSIONAL_MONTHLY_PRICE_ID,
      yearly: process.env.NEXT_PUBLIC_PROFESSIONAL_YEARLY_PRICE_ID
    }
  },
  enterprise: {
    name: 'Enterprise Plan',
    description: 'For multi-location clinic groups',
    monthlyPrice: 79900, // $799.00 in cents
    yearlyPrice: 59900,  // $599.00 in cents
    features: [
      'Everything in Professional',
      'Fully customisable dashboard',
      'Custom tracking for any clinic metric',
      'Multi-location support',
      'First access to NDIS/CTP/AHTR automation',
      'Dedicated account manager'
    ],
    popular: false,
    stripePriceId: {
      monthly: process.env.NEXT_PUBLIC_ENTERPRISE_MONTHLY_PRICE_ID,
      yearly: process.env.NEXT_PUBLIC_ENTERPRISE_YEARLY_PRICE_ID
    }
  }
};

// Parse pricing from environment variables if available
function parsePricingFromEnv(): PricingConfig {
  const pricingEnv = process.env.PRICING_CONFIG;
  if (!pricingEnv) {
    return DEFAULT_PRICING;
  }

  try {
    const envPricing = JSON.parse(pricingEnv);
    // Merge with defaults to ensure all required fields are present
    const mergedPricing: PricingConfig = {};
    
    for (const [key, defaultPlan] of Object.entries(DEFAULT_PRICING)) {
      const envPlan = envPricing[key];
      if (envPlan) {
        mergedPricing[key] = {
          ...defaultPlan,
          ...envPlan,
          // Ensure features array exists
          features: envPlan.features || defaultPlan.features,
          // Ensure stripePriceId object exists
          stripePriceId: {
            ...defaultPlan.stripePriceId,
            ...envPlan.stripePriceId
          }
        };
      } else {
        mergedPricing[key] = defaultPlan;
      }
    }
    
    return mergedPricing;
  } catch (error) {
    return DEFAULT_PRICING;
  }
}

// Get the current pricing configuration
export function getPricingConfig(): PricingConfig {
  return parsePricingFromEnv();
}

// Get a specific plan by key
export function getPlan(planKey: string): PricingPlan | null {
  const config = getPricingConfig();
  return config[planKey] || null;
}

// Get all available plan keys
export function getPlanKeys(): string[] {
  const config = getPricingConfig();
  return Object.keys(config);
}

// Validate pricing configuration
export function validatePricingConfig(config: PricingConfig): boolean {
  for (const [key, plan] of Object.entries(config)) {
    if (!plan.name || !plan.description || !Array.isArray(plan.features)) {
      return false;
    }
    
    if (typeof plan.monthlyPrice !== 'number' || typeof plan.yearlyPrice !== 'number') {
      return false;
    }
    
    if (plan.monthlyPrice < 0 || plan.yearlyPrice < 0) {
      return false;
    }
  }
  
  return true;
}

// Convert pricing to display format (cents to dollars)
export function formatPrice(priceInCents: number): string {
  return (priceInCents / 100).toFixed(2);
}

// Get monthly price in dollars
export function getMonthlyPriceInDollars(plan: PricingPlan): number {
  return plan.monthlyPrice / 100;
}

// Get yearly price in dollars
export function getYearlyPriceInDollars(plan: PricingPlan): number {
  return plan.yearlyPrice / 100;
}

// Get price based on billing interval
export function getPrice(plan: PricingPlan, isYearly: boolean): number {
  return isYearly ? plan.yearlyPrice : plan.monthlyPrice;
}

// Get price in dollars based on billing interval
export function getPriceInDollars(plan: PricingPlan, isYearly: boolean): number {
  return getPrice(plan, isYearly) / 100;
}

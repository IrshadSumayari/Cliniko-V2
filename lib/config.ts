export const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '', // server-only
  },
  encryption: {
    secret: process.env.ENCRYPTION_SECRET || '', // server-only
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '', // server-only
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '', // server-only
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    priceIds: {
      basic: process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID || '',
      professional: process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID || '',
      enterprise: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID || '',
    },
  },
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  cron: {
    secret: process.env.CRON_SECRET || '',
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.FROM_EMAIL || '',
    adminEmail: process.env.ADMIN_EMAIL || '',
  },
};

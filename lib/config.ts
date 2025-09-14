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
      starterMonthly: process.env.NEXT_PUBLIC_STARTER_MONTHLY_PRICE_ID || '',
      starterYearly: process.env.NEXT_PUBLIC_STARTER_YEARLY_PRICE_ID || '',
      professionalMonthly: process.env.NEXT_PUBLIC_PROFESSIONAL_MONTHLY_PRICE_ID || '',
      professionalYearly: process.env.NEXT_PUBLIC_PROFESSIONAL_YEARLY_PRICE_ID || '',
      enterpriseMonthly: process.env.NEXT_PUBLIC_ENTERPRISE_MONTHLY_PRICE_ID || '',
      enterpriseYearly: process.env.NEXT_PUBLIC_ENTERPRISE_YEARLY_PRICE_ID || '',
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

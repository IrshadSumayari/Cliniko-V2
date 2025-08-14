# 🚀 Loveable Backend - Production Deployment Guide

## Overview
This guide will walk you through deploying the Loveable Backend application with Cliniko API integration to production. The application is built with Next.js 14, Supabase, and includes comprehensive PMS integration capabilities.

## 📋 Prerequisites

### 1. Required Accounts
- [Supabase](https://supabase.com) account (for database and authentication)
- [Vercel](https://vercel.com) account (recommended for Next.js deployment)
- [Stripe](https://stripe.com) account (for payment processing)

### 2. Development Environment
- Node.js 18+ installed
- Git installed
- Code editor (VS Code recommended)

## 🗄️ Database Setup

### Step 1: Create Supabase Project
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `loveable-backend-prod`
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
5. Wait for project creation (5-10 minutes)

### Step 2: Run Database Script
1. In your Supabase project, go to **SQL Editor**
2. Copy the contents of `scripts/deploy-production.sql`
3. Paste and run the script
4. Verify all tables are created successfully

### Step 3: Get Database Credentials
1. Go to **Settings** → **API**
2. Copy the following values:
   - **Project URL**
   - **Anon Key**
   - **Service Role Key** (keep this secret!)

## 🔧 Environment Configuration

### Step 1: Create Environment File
Create `.env.local` in your project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Application Configuration
NEXTAUTH_SECRET=your_nextauth_secret_key
NEXTAUTH_URL=https://your-domain.com

# Optional: Analytics
NEXT_PUBLIC_GA_ID=your_google_analytics_id
```

### Step 2: Configure Stripe
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create a new product for your subscription
3. Set up webhook endpoint:
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.updated`

## 🚀 Application Deployment

### Option 1: Deploy to Vercel (Recommended)

#### Step 1: Connect Repository
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your Git repository
4. Configure build settings:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

#### Step 2: Configure Environment Variables
1. In your Vercel project, go to **Settings** → **Environment Variables**
2. Add all variables from your `.env.local` file
3. Set environment to **Production**

#### Step 3: Deploy
1. Click "Deploy"
2. Wait for build completion
3. Your app will be available at the provided URL

### Option 2: Deploy to Other Platforms

#### Netlify
```bash
# Build locally
npm run build

# Deploy
netlify deploy --prod --dir=.next
```

#### Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy
railway up
```

## 🔐 Authentication Setup

### Step 1: Configure Supabase Auth
1. In Supabase Dashboard, go to **Authentication** → **Settings**
2. Configure your site URL:
   - **Site URL**: `https://your-domain.com`
   - **Redirect URLs**: 
     - `https://your-domain.com/auth/callback`
     - `https://your-domain.com/login`
     - `https://your-domain.com/signup`

### Step 2: Test Authentication
1. Deploy your application
2. Test user registration and login
3. Verify email confirmation works

## 🔄 Cron Job Setup

### Option 1: Vercel Cron Jobs
1. Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-patients",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

### Option 2: External Cron Service
Use services like:
- [Cron-job.org](https://cron-job.org)
- [EasyCron](https://www.easycron.com)
- [SetCronJob](https://www.setcronjob.com)

Set the cron job to hit: `https://your-domain.com/api/cron/sync-patients`

## 🧪 Testing Deployment

### Step 1: Health Check
1. Visit your deployed application
2. Test basic navigation
3. Verify all pages load correctly

### Step 2: API Testing
1. Test authentication endpoints
2. Test Cliniko API connection
3. Verify sync functionality

### Step 3: Integration Testing
1. Connect a test Cliniko account
2. Run manual sync
3. Verify data appears in dashboard

## 📊 Monitoring & Maintenance

### Step 1: Set Up Logging
1. Configure error tracking (Sentry recommended)
2. Set up performance monitoring
3. Monitor database performance

### Step 2: Regular Maintenance
1. Monitor sync logs for errors
2. Check database performance
3. Update dependencies regularly

### Step 3: Backup Strategy
1. Enable Supabase point-in-time recovery
2. Regular database backups
3. Code repository backups

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Errors
- Verify environment variables are correct
- Check Supabase project status
- Verify RLS policies are properly configured

#### Authentication Issues
- Check Supabase auth settings
- Verify redirect URLs
- Check environment variables

#### Sync Failures
- Check API credentials
- Verify cron job is running
- Check sync logs for errors

#### Build Failures
- Check Node.js version compatibility
- Verify all dependencies are installed
- Check for TypeScript errors

### Getting Help
1. Check application logs
2. Review Supabase logs
3. Check Vercel build logs
4. Review error tracking service

## 📈 Performance Optimization

### Step 1: Database Optimization
1. Monitor query performance
2. Add missing indexes
3. Optimize RLS policies

### Step 2: Application Optimization
1. Enable Next.js optimizations
2. Implement proper caching
3. Optimize bundle size

### Step 3: CDN Configuration
1. Configure Vercel edge functions
2. Set up proper caching headers
3. Optimize static assets

## 🔒 Security Checklist

- [ ] Environment variables are secure
- [ ] RLS policies are properly configured
- [ ] API keys are encrypted
- [ ] HTTPS is enforced
- [ ] CORS is properly configured
- [ ] Rate limiting is implemented
- [ ] Input validation is in place

## 📝 Post-Deployment Checklist

- [ ] Database tables created successfully
- [ ] Authentication working
- [ ] Cliniko API integration tested
- [ ] Cron jobs configured
- [ ] Error tracking set up
- [ ] Performance monitoring active
- [ ] Backup strategy implemented
- [ ] Documentation updated

## 🎉 Deployment Complete!

Your Loveable Backend is now deployed and ready for production use. The Cliniko API integration will automatically sync patient and appointment data every 6 hours, and users can manually trigger syncs as needed.

### Next Steps
1. Monitor the application for any issues
2. Set up user onboarding process
3. Configure additional PMS integrations if needed
4. Implement advanced features based on user feedback

---

**Need Help?** Check the troubleshooting section or reach out to the development team.

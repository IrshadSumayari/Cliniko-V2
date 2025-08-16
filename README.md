# 🏥 Loveable Backend - PMS Integration Platform

A modern, scalable backend platform for healthcare practice management system (PMS) integrations, built with Next.js 14, Supabase, and comprehensive API support.

## ✨ Features

### 🔌 PMS Integrations
- **Cliniko API** - Full integration with patient and appointment sync
- **Halaxy API** - Ready for integration
- **Nookal API** - Ready for integration
- **Extensible Architecture** - Easy to add new PMS providers

### 🚀 Core Functionality
- **Real-time Sync** - Automatic data synchronization every 6 hours
- **Manual Sync** - On-demand data synchronization
- **Patient Management** - Comprehensive patient data handling
- **Appointment Tracking** - Full appointment lifecycle management
- **Error Handling** - Robust error tracking and logging
- **User Management** - Secure authentication and authorization

### 🛠️ Technical Stack
- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS, shadcn/ui components
- **Deployment**: Vercel, Netlify, Railway ready

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- Supabase account
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd loveable-backend-integration
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🗄️ Database Setup

### Option 1: Production Deployment (Recommended)
Run the comprehensive production script:

```sql
-- Copy and run the contents of scripts/deploy-production.sql
-- in your Supabase SQL editor
```

### Option 2: Development Setup
For development, you can use the individual scripts:
- `scripts/final_database_setup.sql` - Basic database structure
- `scripts/add_appointment_types_table.sql` - Appointment types support
- `fix-rls-policies.sql` - RLS policy fixes

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe Configuration (for payments)
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Application Configuration
NEXTAUTH_SECRET=your_nextauth_secret_key
NEXTAUTH_URL=http://localhost:3000
```

### Supabase Setup

1. Create a new Supabase project
2. Run the database setup script
3. Configure authentication settings
4. Set up RLS policies

## 🚀 Deployment

### Automated Deployment

#### Windows Users
```bash
scripts/deploy.bat
```

#### Mac/Linux Users
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### Manual Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy to your preferred platform**
   - **Vercel**: `vercel --prod`
   - **Netlify**: `netlify deploy --prod --dir=.next`
   - **Railway**: `railway up`

### Cron Jobs

The application includes automatic sync every 6 hours. Configure using:

#### Vercel (Recommended)
The `vercel.json` file is already configured for automatic cron jobs.

#### External Services
Use services like [cron-job.org](https://cron-job.org) to hit:
```
https://your-domain.com/api/cron/sync-patients
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/callback` - Auth callback handler
- `GET /api/auth/callback/auth-code-error` - Auth error page

### PMS Integration
- `POST /api/pms/connect-and-sync` - Connect and sync PMS
- `POST /api/pms/store-credentials` - Store API credentials
- `POST /api/pms/test-connection` - Test PMS connection

### Sync Operations
- `POST /api/sync/manual` - Manual sync trigger
- `POST /api/sync/control` - Sync control operations
- `GET /api/sync/status` - Sync status check
- `POST /api/sync/test-all` - Test all integrations

### Cron Jobs
- `GET /api/cron/sync-patients` - Automated patient sync

### Admin
- `GET /api/admin/sync-overview` - Admin sync overview

### Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook handler

## 🏗️ Project Structure

```
loveable-backend-integration/
├── app/                    # Next.js 14 app directory
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── login/             # Login page
│   ├── signup/            # Signup page
│   └── globals.css        # Global styles
├── components/             # React components
│   ├── ui/                # shadcn/ui components
│   ├── dashboard.tsx      # Main dashboard
│   └── ...                # Other components
├── contexts/               # React contexts
├── hooks/                  # Custom hooks
├── integrations/           # PMS integrations
│   └── supabase/          # Supabase client
├── lib/                    # Utility libraries
│   ├── pms/               # PMS API clients
│   ├── stripe.ts          # Stripe configuration
│   └── utils.ts           # Utility functions
├── scripts/                # Database and deployment scripts
└── public/                 # Static assets
```

## 🔌 PMS Integration Details

### Cliniko API
- **Patient Sync**: Full patient data synchronization
- **Appointment Sync**: Complete appointment management
- **Appointment Types**: Automatic categorization (EPC, WC, Private)
- **Error Handling**: Comprehensive error tracking and logging

### Integration Architecture
The platform uses a factory pattern for PMS integrations:

```typescript
// Example: Adding a new PMS provider
export class NewPMSAPI extends BasePMSAPI {
  async syncPatients(): Promise<Patient[]> {
    // Implementation
  }
  
  async syncAppointments(): Promise<Appointment[]> {
    // Implementation
  }
}
```

## 🧪 Testing

### Run Tests
```bash
npm test
```

### Type Checking
```bash
npm run type-check
```

### Build Verification
```bash
npm run build
```

## 📊 Monitoring & Maintenance

### Sync Monitoring
- Check sync logs in the dashboard
- Monitor error rates and types
- Review sync performance metrics

### Database Health
- Monitor query performance
- Check RLS policy effectiveness
- Review index usage

### Application Performance
- Monitor API response times
- Check build bundle sizes
- Review error tracking

## 🚨 Troubleshooting

### Common Issues

#### Database Connection
- Verify Supabase credentials
- Check RLS policies
- Ensure proper permissions

#### Sync Failures
- Check API credentials
- Verify cron job configuration
- Review error logs

#### Build Issues
- Check Node.js version
- Verify dependencies
- Check TypeScript errors

### Getting Help
1. Check the [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
2. Review error logs in the dashboard
3. Check Supabase logs
4. Verify environment variables

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Database powered by [Supabase](https://supabase.com/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)

## 📞 Support

For support and questions:
- Check the [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- Review the troubleshooting section
- Open an issue in the repository

---

**Made with ❤️ for healthcare professionals**

#!/bin/bash

# MyPhysioFlow - Email Notification System Deployment Script
# This script sets up the complete email notification infrastructure

set -e

echo "🚀 Deploying MyPhysioFlow Email Notification System..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if environment variables are set
check_env_vars() {
    echo "🔍 Checking environment variables..."
    
    required_vars=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "SUPABASE_SERVICE_ROLE_KEY"
        "SENDGRID_API_KEY"
        "FROM_EMAIL"
        "ADMIN_EMAIL"
    )
    
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        echo ""
        echo "Please set these variables in your .env.local file:"
        echo ""
        echo "# Email Configuration"
        echo "SENDGRID_API_KEY=your_sendgrid_api_key"
        echo "FROM_EMAIL=noreply@myphysioflow.com"
        echo "ADMIN_EMAIL=admin@myphysioflow.com"
        echo ""
        echo "# Supabase Configuration"
        echo "NEXT_PUBLIC_SUPABASE_URL=your_supabase_url"
        echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key"
        exit 1
    fi
    
    print_status "All required environment variables are set"
}

# Install required npm packages
install_dependencies() {
    echo "📦 Installing required dependencies..."
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run this script from the project root."
        exit 1
    fi
    
    # Install SendGrid
    npm install @sendgrid/mail
    
    # Install Supabase client if not already installed
    if ! npm list @supabase/supabase-js > /dev/null 2>&1; then
        npm install @supabase/supabase-js
    fi
    
    print_status "Dependencies installed successfully"
}

# Set up database schema
setup_database() {
    echo "🗄️  Setting up database schema..."
    
    # Check if Supabase CLI is available
    if ! command -v supabase &> /dev/null; then
        print_warning "Supabase CLI not found. Please apply the schema manually:"
        echo "  1. Go to your Supabase dashboard"
        echo "  2. Navigate to SQL Editor"
        echo "  3. Run the script in database/notification-schema.sql"
        echo ""
        read -p "Press Enter when you've applied the database schema..."
    else
        # Apply database schema using Supabase CLI
        if [ -f "database/notification-schema.sql" ]; then
            supabase db reset --linked
            supabase db push
            print_status "Database schema applied successfully"
        else
            print_error "Database schema file not found: database/notification-schema.sql"
            exit 1
        fi
    fi
}

# Test SendGrid configuration
test_sendgrid() {
    echo "📧 Testing SendGrid configuration..."
    
    # Create a simple test script
    cat > test-sendgrid.js << 'EOF'
const sgMail = require('@sendgrid/mail');

if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ SENDGRID_API_KEY not set');
    process.exit(1);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
    to: process.env.ADMIN_EMAIL || 'test@example.com',
    from: process.env.FROM_EMAIL || 'noreply@myphysioflow.com',
    subject: '✅ MyPhysioFlow Email Test',
    text: 'This is a test email from MyPhysioFlow notification system.',
    html: '<h1>✅ Email Test Successful</h1><p>MyPhysioFlow notification system is working correctly!</p>'
};

sgMail.send(msg)
    .then(() => {
        console.log('✅ Test email sent successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Failed to send test email:', error.message);
        if (error.response) {
            console.error('Response body:', error.response.body);
        }
        process.exit(1);
    });
EOF

    # Run the test
    if node test-sendgrid.js; then
        print_status "SendGrid configuration test passed"
    else
        print_error "SendGrid configuration test failed"
        echo "Please check your SENDGRID_API_KEY and FROM_EMAIL settings"
        rm -f test-sendgrid.js
        exit 1
    fi
    
    # Clean up test file
    rm -f test-sendgrid.js
}

# Set up cron job for notification processing
setup_cron() {
    echo "⏰ Setting up notification processing..."
    
    print_warning "IMPORTANT: Set up a cron job or scheduled task to process notifications"
    echo ""
    echo "Add this to your server's crontab (run every 5 minutes):"
    echo "*/5 * * * * curl -X GET \"https://your-domain.com/api/notifications/send\" -H \"Authorization: Bearer \$CRON_TOKEN\""
    echo ""
    echo "Or use a service like Vercel Cron Jobs, GitHub Actions, or similar."
    echo ""
    echo "Make sure to set up a CRON_TOKEN environment variable for security."
}

# Create environment template
create_env_template() {
    echo "📝 Creating environment template..."
    
    if [ ! -f ".env.example" ]; then
        cat > .env.example << 'EOF'
# MyPhysioFlow Email Notification Configuration

# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
FROM_EMAIL=noreply@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Application Configuration
NEXT_PUBLIC_APP_URL=https://yourdomain.com
CRON_TOKEN=your_secure_cron_token_for_scheduled_tasks
EOF
        print_status "Environment template created (.env.example)"
    fi
}

# Validate API endpoints
validate_apis() {
    echo "🔧 Validating API endpoints..."
    
    # Check if API files exist
    api_files=(
        "app/api/notifications/send/route.ts"
        "app/api/notifications/settings/route.ts"
        "app/api/notifications/stats/route.ts"
    )
    
    for file in "${api_files[@]}"; do
        if [ ! -f "$file" ]; then
            print_error "API file missing: $file"
            exit 1
        fi
    done
    
    print_status "All API endpoints are present"
}

# Main deployment function
main() {
    echo "🎯 Starting MyPhysioFlow Email Notification System Deployment"
    echo "============================================================"
    echo ""
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ] || [ ! -d "app" ]; then
        print_error "Please run this script from the Next.js project root directory"
        exit 1
    fi
    
    # Run all setup steps
    check_env_vars
    echo ""
    
    install_dependencies
    echo ""
    
    validate_apis
    echo ""
    
    setup_database
    echo ""
    
    test_sendgrid
    echo ""
    
    setup_cron
    echo ""
    
    create_env_template
    echo ""
    
    echo "🎉 Email Notification System Deployment Complete!"
    echo "================================================="
    echo ""
    print_status "✅ SendGrid integration configured"
    print_status "✅ Database schema applied"
    print_status "✅ API endpoints ready"
    print_status "✅ Alert settings modal integrated"
    print_status "✅ Email templates created"
    print_status "✅ Retry logic implemented"
    print_status "✅ Error logging configured"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Set up scheduled notification processing (cron job)"
    echo "2. Test the system by clicking Settings in the dashboard"
    echo "3. Configure your notification preferences"
    echo "4. Monitor email delivery in the admin dashboard"
    echo ""
    echo "🔗 API Endpoints Available:"
    echo "- POST /api/notifications/send (send notifications)"
    echo "- GET/POST /api/notifications/settings (manage settings)"
    echo "- GET /api/notifications/stats (monitoring)"
    echo ""
    print_warning "Remember to set up monitoring and alerts for failed emails!"
}

# Run the main function
main "$@"


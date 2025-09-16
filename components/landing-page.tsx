import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Users,
  User,
  Bell,
  Clock,
  Shield,
  CheckCircle,
  Star,
  TrendingUp,
  AlertTriangle,
  Calendar,
  DollarSign,
  Zap,
  Eye,
  Lock,
  UserCheck,
  ChevronDown,
  Lightbulb,
  ArrowDownRight,
  HelpCircle,
  Settings,
  MessageCircle,
} from 'lucide-react';
import Header from './header';
import AnimatedDashboard from './animated-dashboard';
import AnimatedEmailAlert from './animated-email-alert';
import FlowArrow from './flow-arrow';
import { useRouter } from 'next/navigation';

interface LandingPageProps {
  onGetStarted?: () => void;
  onLogin?: () => void;
  onSignup?: () => void;
}

const LandingPage = ({ onGetStarted, onLogin, onSignup }: LandingPageProps) => {
  const [isYearly, setIsYearly] = useState(true);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const router = useRouter();
  const handleGetStarted = () => {
    router.push('/signup');
  };

  // FAQ data
  const iconMap = {
    zap: Zap,
    shield: Shield,
    settings: Settings,
    trendingUp: TrendingUp,
    messageCircle: MessageCircle,
  };

  const faqCategories = [
    {
      title: 'Setup & Ease',
      icon: 'zap',
      questions: [
        {
          question: 'How quickly can I get started?',
          answer:
            'Most clinics are live in under 3 minutes. Just enter your PMS API key — no IT skills required.',
        },
        {
          question: 'Do I need technical skills or training?',
          answer:
            "No. It's plug-and-play. Once connected, it runs in the background automatically.",
        },
        {
          question: 'Will this add extra admin work?',
          answer:
            'No — it removes admin. MyPhysioFlow automates tracking and reminders so your team does less, not more.',
        },
      ],
    },
    {
      title: 'Security & Compliance',
      icon: 'shield',
      questions: [
        {
          question: 'Does MyPhysioFlow change or edit my data?',
          answer:
            "Never. We only read your data securely — we don't write, edit, or change anything in your PMS.",
        },
        {
          question: 'Where is my data stored?',
          answer:
            'In secure Australian servers, fully compliant with the Australian Privacy Act 1988.',
        },
      ],
    },
    {
      title: 'Functionality & Flexibility',
      icon: 'settings',
      questions: [
        {
          question: 'What if we have multiple locations or physios?',
          answer:
            'Each clinic gets one login with filters by physio and location, so everyone only sees what they need.',
        },
        {
          question: 'What if I run multiple booking systems?',
          answer:
            "MyPhysioFlow supports Cliniko, Nookal, and Halaxy today — and we're adding more. You can connect multiple PMS systems if needed.",
        },
        {
          question: "What happens if a patient type isn't recognised?",
          answer:
            'You can map it once (e.g. "WorkCover Initial" → WC) and the system remembers forever.',
        },
        {
          question: 'What if we need to edit quotas?',
          answer: 'You can manually adjust quotas in the dashboard at any time.',
        },
        {
          question: 'Will I still need spreadsheets?',
          answer: 'No. The system replaces spreadsheets completely.',
        },
      ],
    },
  ];

  // Smooth scrolling functionality
  useEffect(() => {
    const handleSmoothScroll = (e: Event) => {
      const target = e.target as HTMLAnchorElement;
      if (target.hash) {
        e.preventDefault();
        const element = document.querySelector(target.hash);
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      }
    };

    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach((link) => {
      link.addEventListener('click', handleSmoothScroll);
    });

    return () => {
      links.forEach((link) => {
        link.removeEventListener('click', handleSmoothScroll);
      });
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header onLogin={onLogin} onSignup={onSignup} />

      {/* Hero Section */}
      <section
        id="hero"
        className="landing-section py-24 bg-gradient-to-br from-background to-secondary/10 overflow-visible relative"
      >
        <div className="absolute inset-4 bg-card/60 backdrop-blur-sm border border-border/40 rounded-2xl shadow-lg max-w-7xl mx-auto"></div>
        {/* Subtle Background Elements */}
        <div className="absolute inset-0 opacity-[0.03] z-0">
          <div className="absolute top-1/3 left-1/5 w-80 h-80 bg-primary/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/3 right-1/4 w-60 h-60 bg-accent/30 rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-6 relative z-10 max-w-7xl">
          {/* Trust Badge */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-card border border-primary/20 rounded-full px-4 py-2 text-sm text-primary/80">
              <Shield className="w-4 h-4" />
              <span>Built for and Tested by Australian Physios</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
            {/* Main Content */}
            <div className="text-center lg:text-left">
              {/* Main Headline */}
              <div className="animate-fade-in mb-8">
                <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight">
                  <span className="text-foreground">Never Miss an</span>
                  <br />
                  <span className="text-primary">EPC or WorkCover</span>
                  <br />
                  <span className="text-foreground">Renewal Again</span>
                </h1>
              </div>

              {/* Loss Statement */}
              <div className="animate-fade-in delay-200 mb-8">
                <div className="inline-flex items-center gap-3 bg-destructive/10 rounded-lg px-6 py-3 mb-6">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <span className="text-lg font-medium">
                    Australian physio clinics lose{' '}
                    <span className="font-bold text-destructive">$8,400+ every year</span> from
                    preventable admin errors
                  </span>
                </div>
              </div>

              {/* Key Benefits */}
              <div className="animate-fade-in delay-300 mb-10">
                <p className="text-lg text-muted-foreground mb-6">
                  MyPhysioFlow connects to your booking system and:
                </p>

                <div className="space-y-6 max-w-2xl mx-auto lg:mx-0">
                  <div className="space-y-2">
                    <div className="flex items-start gap-4">
                      <Eye className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">
                          Shows exactly which patients need action now
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          No more guessing or digging through reports — see at a glance who is at
                          risk.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-4">
                      <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">
                          Tracks every EPC & WorkCover case automatically, 24/7
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Always up to date. No spreadsheets, no double handling, no stress.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-4">
                      <Bell className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">
                          Sends clear email alerts before deadlines hit
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Get actionable reminders when sessions are nearly used or referrals are
                          about to expire — so you never miss a renewal again.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="animate-fade-in delay-400">
                <p className="text-muted-foreground mb-6">
                  Never miss EPC renewals, WorkCover approvals, or session quotas —{' '}
                  <span className="font-semibold text-primary">without lifting a finger</span>.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <Button
                    size="lg"
                    onClick={handleGetStarted}
                    className="text-lg px-8 py-4 rounded-xl hover:scale-105 transition-all duration-300"
                  >
                    <Zap className="mr-2 h-5 w-5" />
                    See My Dashboard in 3 Minutes
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() =>
                      window.open(
                        'https://calendly.com/ryan-ryflow/myphysioflow-setup-walkthrough',
                        '_blank'
                      )
                    }
                    className="text-lg px-8 py-4 rounded-xl hover:scale-105 transition-all duration-300 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                  >
                    <Calendar className="mr-2 h-5 w-5" />
                    Book Setup Call
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">No setup fee • Cancel anytime</p>
              </div>
            </div>

            {/* Animated Dashboard Preview - Full Width */}
            <div className="lg:mt-8 animate-fade-in delay-500">
              <div className="max-w-2xl mx-auto lg:max-w-none">
                <AnimatedDashboard />
              </div>
            </div>
          </div>
        </div>

        <FlowArrow href="#integrations" label="See what works with it" />
      </section>

      {/* Works With - Integration Section */}
      <section
        id="integrations"
        className="py-20 bg-gradient-to-b from-background to-secondary/10 relative"
      >
        <div className="absolute inset-8 bg-card/50 backdrop-blur-sm border border-border/30 rounded-2xl shadow-md max-w-6xl mx-auto"></div>
        <div className="container mx-auto px-6 max-w-6xl relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-primary">Works With Your Current System</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Seamlessly integrates with all major Australian practice management systems
            </p>
          </div>

          {/* Integration Logos Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            <div className="bg-card border border-border rounded-lg p-6 flex flex-col items-center justify-center hover:shadow-md transition-all duration-300 hover:border-primary/20 gap-2">
              <img
                src="/assets/logos/1e81f829-2e0a-415a-87aa-c210e253f225.png"
                alt="Cliniko Logo"
                className="w-12 h-12 object-contain"
              />
              <span className="font-semibold text-sm text-foreground">Cliniko</span>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 flex flex-col items-center justify-center hover:shadow-md transition-all duration-300 hover:border-primary/20 gap-2">
              <img
                src="/assets/logos/dfb8c63a-716b-4e4a-8ff3-9f4670913635.png"
                alt="Nookal Logo"
                className="w-12 h-12 object-contain"
              />
              <span className="font-semibold text-sm text-foreground">Nookal</span>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 flex flex-col items-center justify-center hover:shadow-md transition-all duration-300 hover:border-primary/20 gap-2">
              <img
                src="/assets/logos/17584461-92d0-4daf-8073-229209026520.png"
                alt="Zanda Health Logo"
                className="w-12 h-12 object-contain"
              />
              <span className="font-semibold text-sm text-foreground">Zanda Health</span>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 flex flex-col items-center justify-center hover:shadow-md transition-all duration-300 hover:border-primary/20 gap-2">
              <img
                src="/assets/logos/cd6c2d0c-693b-486a-931b-782578c20123.png"
                alt="Halaxy Logo"
                className="w-12 h-12 object-contain"
              />
              <span className="font-semibold text-sm text-foreground">Halaxy</span>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 flex items-center justify-center hover:shadow-md transition-all duration-300 hover:border-primary/20">
              <span className="font-semibold text-lg text-foreground">+ More</span>
            </div>
          </div>
        </div>

        <FlowArrow href="#features" label="See what you get" />
      </section>

      {/* What You Get - Improved Layout */}
      <section
        id="features"
        className="landing-section py-20 bg-gradient-to-b from-secondary/20 to-background overflow-visible relative"
      >
        <div className="absolute inset-8 bg-card/55 backdrop-blur-sm border border-border/35 rounded-2xl shadow-md max-w-6xl mx-auto"></div>
        <div className="container mx-auto px-6 max-w-6xl relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-primary">What You Get</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              No spreadsheets, no data entry. Just one simple dashboard that stops you losing money.
            </p>

            {/* Highlight Box */}
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-6 text-center max-w-2xl mx-auto mt-8">
              <h3 className="text-xl font-semibold text-primary mb-2">
                Most clinics discover <span className="font-bold">$2,000+</span> in revenue at risk
              </h3>
              <p className="text-sm text-muted-foreground">within the first 5 minutes of usage</p>
            </div>
          </div>

          {/* Core Features - Centered 2 Column Layout */}
          <div className="grid md:grid-cols-2 gap-8 mb-20 max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-xl p-8 text-center hover:shadow-lg transition-all duration-300 hover:border-primary/20 hover:scale-105">
              <div className="w-16 h-16 bg-primary/10 rounded-xl mx-auto mb-6 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <h4 className="font-semibold text-xl mb-4 text-foreground">See All Your Patients</h4>
              <p className="text-muted-foreground leading-relaxed">
                See on the dashboard who needs action, who is pending session approval, and who is
                overdue. No more hunting through files.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-8 text-center hover:shadow-lg transition-all duration-300 hover:border-primary/20 hover:scale-105">
              <div className="w-16 h-16 bg-primary/10 rounded-xl mx-auto mb-6 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-primary" />
              </div>
              <h4 className="font-semibold text-xl mb-4 text-foreground">Smart Email Alerts</h4>
              <p className="text-muted-foreground leading-relaxed">
                Get email notifications when patients are 1-2 sessions away from quota limits or
                renewal deadlines.
              </p>
            </div>
          </div>

          {/* Email Alert Example Section */}
          <div className="bg-gradient-to-r from-card/50 to-secondary/10 border border-border/50 rounded-2xl p-8 mb-20">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-semibold mb-4 text-foreground">
                Email Alerts That Actually Help
              </h3>
              <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Get clear, actionable email notifications with patient names and exactly what needs
                to be done.
              </p>
            </div>

            {/* Email Alert Animation */}
            <div className="flex justify-center">
              <AnimatedEmailAlert />
            </div>
          </div>

          {/* Bottom Benefits - Enhanced */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-semibold text-foreground mb-2">Why MyPhysioFlow Works</h3>
            <p className="text-muted-foreground">
              Simple, secure, and designed for Australian practices
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-xl p-6 text-center hover:shadow-md transition-all duration-300 hover:border-primary/20">
              <div className="w-12 h-12 bg-primary/10 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-primary" />
              </div>
              <h4 className="font-semibold text-lg mb-3 text-foreground">Works With Your System</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Plugs straight into Cliniko, Nookal, and many other platforms
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 text-center hover:shadow-md transition-all duration-300 hover:border-primary/20">
              <div className="w-12 h-12 bg-primary/10 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h4 className="font-semibold text-lg mb-3 text-foreground">No Extra Work</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Updates itself. No typing, no data entry, no hassle.
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 text-center hover:shadow-md transition-all duration-300 hover:border-primary/20">
              <div className="w-12 h-12 bg-primary/10 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h4 className="font-semibold text-lg mb-3 text-foreground">Safe & Secure</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Australian servers, privacy protected, cancel anytime.
              </p>
            </div>
          </div>
        </div>

        <FlowArrow href="#how-it-works" label="See how it works" />
      </section>

      {/* How It Works Section */}
      <section
        id="how-it-works"
        className="landing-section py-16 bg-gradient-to-b from-background to-secondary/10 overflow-visible relative"
      >
        <div className="absolute inset-8 bg-card/50 backdrop-blur-sm border border-border/30 rounded-2xl shadow-md max-w-6xl mx-auto"></div>
        <div className="container mx-auto px-6 max-w-6xl relative z-10">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-2 text-primary">How It Works</h2>
            <h3 className="text-2xl font-semibold mb-2 text-foreground">
              3 Steps to Stop Revenue Loss & Stay 100% Compliant
            </h3>
            <p className="text-lg text-muted-foreground">Live in Under 3 Minutes</p>
          </div>

          {/* 3-Column Step Layout */}
          <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-xl font-bold text-white">1</span>
              </div>

              <h3 className="text-xl font-bold text-foreground mb-3">Connect Your System</h3>
              <p className="text-muted-foreground mb-3">
                Enter your Cliniko, Nookal, or many other platforms API key. Takes under 2 minutes —
                no extra training, no disruption to your team.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-xl font-bold text-white">2</span>
              </div>

              <h3 className="text-xl font-bold text-foreground mb-3">We Scan Everything for You</h3>
              <p className="text-muted-foreground mb-3">
                Our system instantly finds every EPC & WorkCover patient, checks their quotas, flags
                expiries, and calculates revenue at risk.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-xl font-bold text-white">3</span>
              </div>

              <h3 className="text-xl font-bold text-foreground mb-3">
                Get Your Live Dashboard & Alerts
              </h3>
              <p className="text-muted-foreground mb-3">
                See your full patient overview in one place. Get automatic email alerts before
                referrals expire or quotas run out — so you never miss a deadline again.
              </p>
            </div>
          </div>
        </div>

        <FlowArrow href="#security" label="See why it's secure" />
      </section>

      {/* Security & Compliance Section */}
      <section
        id="security"
        className="relative py-20 bg-gradient-to-b from-background to-secondary/20"
      >
        <div className="absolute inset-8 bg-card/50 backdrop-blur-sm border border-border/30 rounded-2xl shadow-md max-w-6xl mx-auto"></div>
        <div className="container mx-auto px-6 max-w-6xl relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-primary">Security & Compliance First</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
              Built for Australian healthcare with enterprise-grade security and full privacy
              compliance
            </p>
          </div>

          {/* Security Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <div className="bg-card border border-border rounded-xl p-8 text-center hover:shadow-lg transition-all duration-300 hover:border-primary/20">
              <div className="w-16 h-16 bg-primary/10 rounded-xl mx-auto mb-6 flex items-center justify-center">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h4 className="font-semibold text-xl mb-4 text-foreground">Privacy Act Compliant</h4>
              <p className="text-muted-foreground leading-relaxed">
                Full compliance with Australian Privacy Act 1988 and healthcare privacy standards
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-8 text-center hover:shadow-lg transition-all duration-300 hover:border-primary/20">
              <div className="w-16 h-16 bg-primary/10 rounded-xl mx-auto mb-6 flex items-center justify-center">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h4 className="font-semibold text-xl mb-4 text-foreground">Bank-Grade Encryption</h4>
              <p className="text-muted-foreground leading-relaxed">
                256-bit SSL encryption in transit and at rest. Your data is never accessible to
                anyone
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-8 text-center hover:shadow-lg transition-all duration-300 hover:border-primary/20">
              <div className="w-16 h-16 bg-primary/10 rounded-xl mx-auto mb-6 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <h4 className="font-semibold text-xl mb-4 text-foreground">Australian Hosted</h4>
              <p className="text-muted-foreground leading-relaxed">
                All data stored on Australian servers, never shared with third parties
              </p>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="grid md:grid-cols-5 gap-6">
            <div className="bg-card border border-border rounded-lg p-6 text-center hover:shadow-md transition-all duration-300 hover:border-primary/20 group">
              <div className="w-10 h-10 bg-primary/10 rounded-lg mx-auto mb-3 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2 text-foreground">Lightning Fast</h3>
              <p className="text-muted-foreground text-xs">Live in under 3 minutes</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 text-center hover:shadow-md transition-all duration-300 hover:border-primary/20 group">
              <div className="w-10 h-10 bg-primary/10 rounded-lg mx-auto mb-3 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2 text-foreground">Bank-Grade Secure</h3>
              <p className="text-muted-foreground text-xs">
                Australian servers, Privacy Act compliant
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 text-center hover:shadow-md transition-all duration-300 hover:border-primary/20 group">
              <div className="w-10 h-10 bg-primary/10 rounded-lg mx-auto mb-3 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2 text-foreground">Team Ready</h3>
              <p className="text-muted-foreground text-xs">
                One login per clinic, filters by physio & location
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 text-center hover:shadow-md transition-all duration-300 hover:border-primary/20 group">
              <div className="w-10 h-10 bg-primary/10 rounded-lg mx-auto mb-3 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2 text-foreground">Pays for Itself</h3>
              <p className="text-muted-foreground text-xs">
                One missed renewal costs more than a month's subscription
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 text-center hover:shadow-md transition-all duration-300 hover:border-primary/20 group">
              <div className="w-10 h-10 bg-primary/10 rounded-lg mx-auto mb-3 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-2 text-foreground">Aussie Built</h3>
              <p className="text-muted-foreground text-xs">
                Built for and Tested by Australian Physios
              </p>
            </div>
          </div>
        </div>

        <FlowArrow href="#pricing" label="See pricing" />
      </section>

      {/* Pricing Section - Clean SaaS Style */}
      <section
        id="pricing"
        className="py-20 bg-gradient-to-b from-background to-secondary/30 relative"
      >
        <div className="absolute inset-8 bg-card/55 backdrop-blur-sm border border-border/35 rounded-2xl shadow-md max-w-6xl mx-auto"></div>
        <div className="container mx-auto px-6 max-w-6xl relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-primary">Choose Your Plan</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-6">
              One missed renewal costs more than a month of MyPhysioFlow
            </p>

            {/* Annual Plan Bonus - Compact Version */}
            <div className="bg-card/80 border border-primary/30 rounded-lg p-4 max-w-3xl mx-auto mb-8">
              <div className="text-center">
                <h3 className="font-semibold text-lg mb-2 text-primary">Annual Plan Bonus</h3>
                <p className="text-base mb-3 text-foreground">
                  Pay yearly, get <span className="text-primary font-medium">3 months free</span> +
                  early access to new features
                </p>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground mb-2">
                  <span>• Future NDIS & CTP tracking</span>
                  <span>• Auto Report/AHTR Generator</span>
                  <span>• Cancel anytime</span>
                </div>
              </div>
            </div>

            {/* Monthly/Yearly Toggle */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <span
                className={`text-sm ${!isYearly ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
              >
                Monthly
              </span>
              <button
                onClick={() => setIsYearly(!isYearly)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  isYearly ? 'bg-primary' : 'bg-muted'
                }`}
                aria-pressed={isYearly}
              >
                <span
                  className={`${
                    isYearly ? 'translate-x-6' : 'translate-x-1'
                  } inline-block h-4 w-4 transform rounded-full bg-white transition`}
                />
              </button>
              <span
                className={`text-sm ${isYearly ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
              >
                Yearly
              </span>
              {isYearly && (
                <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full">
                  Save 3 months!
                </span>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {/* Starter Plan */}
            <div className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2 text-foreground">Starter</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-foreground">
                    ${isYearly ? '37' : '49'}
                  </span>
                  <span className="text-base text-muted-foreground">/month</span>
                  {isYearly && (
                    <div className="text-xs text-muted-foreground mt-1">Billed annually ($441)</div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Perfect for small clinics getting started
                </p>

                <div className="space-y-3 mb-8 text-left">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">Up to 50 patients</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">Basic dashboard</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">Standard EPC & WC tracking</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full hover:bg-card hover:text-foreground hover:border-primary/20"
                  onClick={handleGetStarted}
                >
                  Start Starter Plan
                </Button>
              </div>
            </div>

            {/* Professional Plan - Most Popular */}
            <div className="bg-card border-2 border-primary rounded-lg p-6 relative hover:shadow-lg transition-shadow">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary text-primary-foreground px-3 py-1 text-xs font-medium rounded-full">
                  Most Popular
                </span>
              </div>

              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2 text-foreground">Professional</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-primary">${isYearly ? '74' : '99'}</span>
                  <span className="text-base text-muted-foreground">/month</span>
                  {isYearly && (
                    <div className="text-xs text-muted-foreground mt-1">Billed annually ($891)</div>
                  )}
                </div>
                <p className="text-sm font-medium text-primary mb-6">
                  The choice for most successful clinics
                </p>

                <div className="space-y-3 mb-8 text-left">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium">Unlimited patients</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium">Full dashboard with analytics</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium">Smart email alerts</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium">Advanced compliance features</span>
                  </div>
                </div>

                <Button className="w-full" onClick={handleGetStarted}>
                  Start Professional Plan
                </Button>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2 text-foreground">Enterprise</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-foreground">
                    ${isYearly ? '599' : '799'}
                  </span>
                  <span className="text-base text-muted-foreground">/month</span>
                  {isYearly && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Billed annually ($7,191)
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  For multi-location clinic groups
                </p>

                <div className="space-y-3 mb-8 text-left">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">Everything in Professional</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">Fully customisable dashboard</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">Custom tracking for any clinic metric</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">Multi-location support</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">First access to NDIS/CTP/AHTR automation</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm">Dedicated account manager</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full hover:bg-card hover:text-foreground hover:border-primary/20"
                  onClick={handleGetStarted}
                >
                  Contact Sales
                </Button>
              </div>
            </div>
          </div>
        </div>

        <FlowArrow href="#faq" label="See common questions" />
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative py-20 bg-gradient-to-b from-secondary/20 to-background">
        <div className="absolute inset-8 bg-card/50 backdrop-blur-sm border border-border/30 rounded-2xl shadow-md max-w-4xl mx-auto"></div>
        <div className="container mx-auto px-6 max-w-4xl relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 text-primary">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-8">
            {faqCategories.map((category, categoryIndex) => (
              <div key={categoryIndex} className="space-y-3">
                {/* Category Header */}
                <div className="flex items-center justify-center gap-3 mb-6">
                  {(() => {
                    const IconComponent = iconMap[category.icon as keyof typeof iconMap];
                    return <IconComponent className="h-6 w-6 text-primary" />;
                  })()}
                  <h3 className="text-2xl font-semibold text-primary">{category.title}</h3>
                </div>

                {/* Questions in this category */}
                <div className="space-y-3 ml-8">
                  {category.questions.map((faq, questionIndex) => {
                    const globalIndex = categoryIndex * 10 + questionIndex; // Create unique index
                    return (
                      <div
                        key={globalIndex}
                        className="bg-card border border-border rounded-lg hover:shadow-md transition-all duration-300 overflow-hidden"
                      >
                        <button
                          onClick={() =>
                            setExpandedFAQ(expandedFAQ === globalIndex ? null : globalIndex)
                          }
                          className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
                        >
                          <h4 className="font-semibold text-base text-foreground pr-4">
                            {faq.question}
                          </h4>
                          <ChevronDown
                            className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
                              expandedFAQ === globalIndex ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        {expandedFAQ === globalIndex && (
                          <div className="px-6 pb-4">
                            <p className="text-muted-foreground leading-relaxed text-sm">
                              {faq.answer}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA - Clean SaaS Style */}
      <section className="py-20 bg-gradient-to-b from-secondary/30 to-background relative">
        <div className="absolute inset-8 bg-card/55 backdrop-blur-sm border border-border/35 rounded-2xl shadow-md max-w-4xl mx-auto"></div>
        <div className="container mx-auto px-6 max-w-4xl relative z-10">
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-6 text-primary">
              One missed renewal costs more than a month of MyPhysioFlow
            </h2>

            <div className="mb-8">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="default"
                  onClick={handleGetStarted}
                  className="text-base px-8 py-3 rounded-lg hover:scale-105 transition-all duration-300"
                >
                  Start Your Setup — See Your Dashboard in 3 Minutes
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                {/* <Button
                  size="default"
                  variant="outline"
                  onClick={() => window.open('https://calendly.com/ryan-ryflow/myphysioflow-setup-walkthrough', '_blank')}
                  className="text-base px-8 py-3 rounded-lg hover:scale-105 transition-all duration-300 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Book Setup Call
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button> */}
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <span>Hosted in Australia</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span>Privacy Act 1988 Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-border/50 py-12">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Company Info */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img
                  src="/assets/logos/0ed091e5-2cfd-4e42-9b90-641896ead380.png"
                  alt="MyPhysioFlow Logo"
                  className="h-10 w-auto max-w-[200px]"
                />
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                Built for Australian physiotherapy clinics to track EPC and WorkCover sessions,
                ensuring compliance and preventing revenue loss from missed renewals.
              </p>
              <div className="text-sm text-muted-foreground">
                <p>ryan@myphysioflow.com.au</p>
              </div>
            </div>

            {/* Legal Links */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Legal</h3>
              <div className="space-y-2">
                <a
                  href="/terms-of-service"
                  className="block text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Terms of Service
                </a>
                <a
                  href="/privacy-policy"
                  className="block text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Privacy Policy
                </a>
              </div>
            </div>

            {/* Support */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Support</h3>
              <div className="space-y-2">
                <a
                  href="mailto:support@myphysioflow.com.au"
                  className="block text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Contact Support
                </a>
                <a
                  href="mailto:privacy@myphysioflow.com.au"
                  className="block text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Privacy Officer
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-border/50 mt-8 pt-8 text-center">
            <p className="text-sm text-muted-foreground">
              © 2025 MyPhysioFlow. All rights reserved. Built for Australian physios.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

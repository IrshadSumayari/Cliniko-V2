"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Users,
  Bell,
  Shield,
  Zap,
  BarChart3,
  Check,
  Star,
  MessageCircle,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  UserCheck,
  Activity,
} from "lucide-react";
import Header from "./header";
import AnimatedDashboard from "./animated-dashboard";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { usePathname, useRouter } from "next/navigation";

interface LandingPageProps {
  onGetStarted?: () => void;
  onLogin?: () => void;
  onSignup?: () => void;
}

const LandingPage = ({ onGetStarted, onLogin, onSignup }: LandingPageProps) => {
  const [currentView, setCurrentView] = useState<string>("landing");
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Smooth scrolling functionality

  useEffect(() => {
    const handleSmoothScroll = (e: Event) => {
      const target = e.target as HTMLAnchorElement;
      if (target.hash) {
        e.preventDefault();
        const element = document.querySelector(target.hash);
        if (element) {
          element.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }
    };

    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach((link) => {
      link.addEventListener("click", handleSmoothScroll);
    });

    return () => {
      links.forEach((link) => {
        link.removeEventListener("click", handleSmoothScroll);
      });
    };
  }, []);
  const handleViewChange = (view: string) => {
    setCurrentView(view);
    if (view === "landing") {
      router.push("/");
    } else if (view === "login") {
      router.push("/login");
    } else if (view === "signup") {
      router.push("/signup");
    }
  };
  const features = [
    {
      icon: Users,
      title: "One Clear Dashboard",
      description:
        "Stop jumping between PMS reports and spreadsheets. MyPhysioFlow shows everything you need in one place.",
      gradient: "from-blue-500/20 to-cyan-500/20",
    },
    {
      icon: Bell,
      title: "Smart Alerts Before It's Too Late",
      description:
        "Know instantly when a patient is 1–2 sessions away from quota, a referral is expiring, or an insurer response is overdue.",
      gradient: "from-orange-500/20 to-red-500/20",
    },
    {
      icon: Zap,
      title: "No Extra Admin Work",
      description:
        "Connect your PMS once with your API key – MyPhysioFlow syncs automatically every few hours.",
      gradient: "from-green-500/20 to-emerald-500/20",
    },
    {
      icon: BarChart3,
      title: "Peace of Mind",
      description:
        "Never worry about missing EPC renewals, Workers' Compensation approvals or lost sessions again.",
      gradient: "from-purple-500/20 to-violet-500/20",
    },
    {
      icon: Shield,
      title: "HIPAA Compliant",
      description:
        "Enterprise-grade security with end-to-end encryption. Your patient data is always protected.",
      gradient: "from-indigo-500/20 to-blue-500/20",
    },
    {
      icon: Activity,
      title: "Real-Time Sync",
      description:
        "Automatic synchronization with your PMS ensures data is always current and accurate.",
      gradient: "from-pink-500/20 to-rose-500/20",
    },
  ];

  const plans = [
    {
      name: "Starter",
      price: "Free",
      period: "7-day trial",
      description:
        "Perfect for small clinics who want clarity without the admin stress",
      features: [
        "Up to 50 patients",
        "Basic session tracking",
        "Email alerts",
        "Standard support",
      ],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      name: "Professional",
      price: "$29",
      period: "per month",
      description:
        "Protect up to $10,000+ in revenue each month and keep your team in control",
      features: [
        "Up to 500 patients",
        "Advanced analytics",
        "SMS & email alerts",
        "Priority support",
        "Revenue reporting",
        "Custom alerts",
      ],
      cta: "Start Professional",
      popular: true,
    },
    {
      name: "Enterprise",
      price: "$79",
      period: "per month",
      description:
        "For large multi-site clinics needing full visibility across locations",
      features: [
        "Unlimited patients",
        "Multi-location support",
        "Custom integrations",
        "Dedicated support",
        "Advanced reporting",
        "White-label options",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ];

  const testimonials = [
    {
      name: "Dr. Sarah Mitchell",
      role: "Physiotherapist",
      clinic: "Mitchell Physio",
      content:
        "We used to constantly chase EPC renewals manually – it was stressful and things were missed. MyPhysioFlow removed that mental load completely.",
      rating: 5,
    },
    {
      name: "Mark Thompson",
      role: "Practice Manager",
      clinic: "Sydney Wellness Center",
      content:
        "Finally, a solution that actually works. Our session tracking is now 100% accurate and we never miss renewals.",
      rating: 5,
    },
    {
      name: "Dr. Emma Chen",
      role: "Allied Health Director",
      clinic: "Metro Health Group",
      content:
        "The analytics have helped us optimize our patient flow and increase revenue by 23% in just 3 months.",
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header onLogin={onLogin} onSignup={onSignup} />

      {/* Hero Section */}
      <section className="min-h-screen bg-gradient-to-b from-background to-accent/30 flex items-center">
        <div className="container mx-auto px-6 py-20">
          <div className="text-center max-w-4xl mx-auto animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Track EPC & Workers' Compensation Patients
              <span className="block bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Stay on Top of Sessions, Renewals, and Approvals
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground mb-6 leading-relaxed max-w-3xl mx-auto">
              MyPhysioFlow connects to your clinic software and automatically
              tracks EPC & Workers' Compensation sessions, renewals and
              approvals – so nothing slips through the cracks and your team can
              finally breathe.
            </p>

            <div className="bg-accent/50 border border-primary/20 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                <strong>No extra admin work</strong> – connect your PMS once and
                MyPhysioFlow runs in the background.
              </p>
              <p className="text-sm text-muted-foreground">
                CTP tracking and other funding schemes are coming soon – early
                access for annual plans.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <Button
                variant="default"
                size="lg"
                className="hover-scale"
                asChild
              >
                <Link href="/signup">
                  See Your Patients in One Clear Dashboard in 3 Minutes
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="hover-scale bg-transparent"
              >
                <Calendar className="mr-2 h-5 w-5" />
                Book a Demo
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mb-8">
              Try it free for 7 days – no credit card. After your trial, choose
              monthly or discounted annual plans.
            </p>
            <p className="text-xs text-muted-foreground mb-16">
              Your data is locked until you subscribe – no surprises.
            </p>

            {/* Pain-Point Banner */}
            <div
              className="mb-16 animate-fade-in max-w-4xl mx-auto"
              style={{ animationDelay: "0.3s" }}
            >
              <div className="luxury-card p-8 bg-gradient-to-r from-destructive/5 to-warning/5 border border-destructive/20">
                <div className="text-center space-y-3">
                  <p className="text-xl font-semibold text-foreground">
                    Most clinics are overwhelmed with admin – and it&apos;s
                    costing them patients and revenue.
                  </p>
                  <p className="text-lg text-muted-foreground">
                    MyPhysioFlow removes the stress by flagging exactly who
                    needs action before things go wrong.
                  </p>
                </div>
              </div>
            </div>

            {/* Trust Badges - Seamless Integration */}
            <div
              className="mb-20 animate-fade-in"
              style={{ animationDelay: "0.4s" }}
            >
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                  <p className="text-lg font-semibold text-foreground mb-3">
                    Works securely with leading practice management systems
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">
                    Trusted by 500+ Australian Physio Clinics Who Value Clarity
                    & Control
                  </p>
                  <p className="text-sm font-semibold text-primary">
                    $2.3M+ revenue protected & counting
                  </p>
                </div>

                <div className="flex items-center justify-center gap-20">
                  <div className="group text-center space-y-4">
                    <div className="w-24 h-24 mx-auto rounded-full overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.12)] border-3 border-white/20 backdrop-blur-sm bg-white/10 group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.2)] transition-all duration-500 hover:scale-110 hover:border-white/40">
                      <img
                        src="/assets/logos/halaxy.png"
                        alt="Halaxy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      Halaxy
                    </p>
                  </div>

                  <div className="group text-center space-y-4">
                    <div className="w-24 h-24 mx-auto rounded-full overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.12)] border-3 border-white/20 backdrop-blur-sm bg-white/10 group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.2)] transition-all duration-500 hover:scale-110 hover:border-white/40">
                      <img
                        src="/assets/logos/cliniko.png"
                        alt="Cliniko"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      Cliniko
                    </p>
                  </div>

                  <div className="group text-center space-y-4">
                    <div className="w-24 h-24 mx-auto rounded-full overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.12)] border-3 border-white/20 backdrop-blur-sm bg-white/10 group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.2)] transition-all duration-500 hover:scale-110 hover:border-white/40">
                      <img
                        src="/assets/logos/nookal.png"
                        alt="Nookal"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      Nookal
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Animated Dashboard Mockup */}
            <div className="animate-fade-in" style={{ animationDelay: "0.6s" }}>
              <div className="text-center mb-8">
                <h2 className="text-4xl font-bold mb-4">
                  Four Dashboard Sections. Complete Clarity.
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Filter by physio or clinic location instantly to see only the
                  patients relevant to you.
                </p>

                {/* Dashboard Sections Explanation */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto mb-8">
                  <div className="bg-card/50 border border-border rounded-lg p-4">
                    <div className="h-3 w-3 bg-primary rounded-full mx-auto mb-2"></div>
                    <h4 className="font-semibold text-sm mb-1">All Patients</h4>
                    <p className="text-xs text-muted-foreground">
                      All active EPC & Workers' Compensation patients
                    </p>
                  </div>
                  <div className="bg-card/50 border border-warning/20 rounded-lg p-4">
                    <div className="h-3 w-3 bg-warning rounded-full mx-auto mb-2"></div>
                    <h4 className="font-semibold text-sm mb-1">
                      Action Needed
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Patients 1-2 sessions from quota
                    </p>
                  </div>
                  <div className="bg-card/50 border border-blue-500/20 rounded-lg p-4">
                    <div className="h-3 w-3 bg-blue-500 rounded-full mx-auto mb-2"></div>
                    <h4 className="font-semibold text-sm mb-1">Pending</h4>
                    <p className="text-xs text-muted-foreground">
                      Waiting on GP renewal or approval
                    </p>
                  </div>
                  <div className="bg-card/50 border border-muted/20 rounded-lg p-4">
                    <div className="h-3 w-3 bg-muted rounded-full mx-auto mb-2"></div>
                    <h4 className="font-semibold text-sm mb-1">Archived</h4>
                    <p className="text-xs text-muted-foreground">
                      Discharged patients for reference
                    </p>
                  </div>
                </div>

                {/* Calibration Callout */}
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
                  <p className="text-sm font-medium text-primary mb-2">
                    One-time setup calibration
                  </p>
                  <p className="text-xs text-muted-foreground">
                    During setup, you'll review our initial sync and confirm
                    quotas so the system starts perfectly accurate.
                  </p>
                </div>
              </div>
              <div className="relative max-w-6xl mx-auto">
                <AnimatedDashboard />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section - Moved Higher */}
      <section className="py-24 bg-gradient-to-b from-accent/30 to-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Trusted by{" "}
              <span className="text-primary">healthcare professionals</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              See how clinics are saving thousands with automated session
              tracking
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="luxury-card p-8 animate-fade-in hover-scale"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <div className="flex mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-5 w-5 fill-primary text-primary"
                    />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 leading-relaxed italic">
                  "{testimonial.content}"
                </p>
                <div>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role}
                  </div>
                  <div className="text-sm text-primary">
                    {testimonial.clinic}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Email Notifications Section */}
      <section className="py-16 bg-gradient-to-r from-primary/5 to-accent/5 border-y border-border/20">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-8">
              <Mail className="h-16 w-16 mx-auto mb-4 text-primary" />
              <h2 className="text-3xl font-bold mb-4">
                Never Miss a Deadline Again
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Get instant email alerts when a patient is close to their quota
                or pending approvals – never miss a deadline again.
              </p>
            </div>

            {/* Sample Email Screenshot Placeholder */}
            <div className="bg-card border border-border rounded-lg p-6 max-w-2xl mx-auto shadow-lg">
              <div className="border border-border rounded p-4 bg-background/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-2 h-2 bg-warning rounded-full"></div>
                  <span className="text-sm font-semibold">
                    MyPhysioFlow Alert
                  </span>
                </div>
                <p className="text-sm text-left">
                  <strong>Action Required:</strong> Sarah Johnson (EPC #12345)
                  has 1 session remaining. Referral expires in 5 days. Consider
                  booking renewal appointment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <Shield className="h-16 w-16 mx-auto mb-4 text-primary" />
            <h2 className="text-3xl font-bold mb-4">
              Australian Servers. Uncompromising Security.
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Your data never leaves Australia – hosted on encrypted Australian
              servers with Privacy Act 1988 compliance.
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-card/50 border border-border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Australian Hosted</h4>
                <p className="text-sm text-muted-foreground">
                  All data stored on secure Australian servers
                </p>
              </div>
              <div className="bg-card/50 border border-border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Privacy Act 1988</h4>
                <p className="text-sm text-muted-foreground">
                  Full compliance with Australian privacy laws
                </p>
              </div>
              <div className="bg-card/50 border border-border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Your Control</h4>
                <p className="text-sm text-muted-foreground">
                  Revoke API keys anytime – you stay in control
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Finally Feel in{" "}
              <span className="text-primary">Control of Your Clinic</span> Again
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Stop feeling overwhelmed by admin work. MyPhysioFlow gives you
              clarity and peace of mind every single day.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`luxury-card p-8 hover-scale animate-fade-in bg-gradient-to-br ${feature.gradient}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="mb-6">
                  <feature.icon
                    className="h-12 w-12 text-primary mb-4"
                    strokeWidth={1.5}
                  />
                  <h3 className="text-xl font-semibold mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Stats Section */}
          <div className="mt-24 grid md:grid-cols-3 gap-8 text-center">
            {[
              { value: "$2.3M+", label: "Revenue Protected", icon: TrendingUp },
              { value: "500+", label: "Clinics Using", icon: UserCheck },
              { value: "99.9%", label: "Uptime Guarantee", icon: Shield },
            ].map((stat, index) => (
              <div
                key={index}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <stat.icon className="h-8 w-8 mx-auto mb-4 text-primary" />
                <div className="text-4xl font-bold mb-2">{stat.value}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section
        id="pricing"
        className="py-24 bg-gradient-to-b from-background to-accent/30"
      >
        <div className="container mx-auto px-6">
          <div className="text-center mb-8">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              One Missed Renewal Costs More Than a{" "}
              <span className="text-primary">Month of MyPhysioFlow</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-6">
              Choose the plan that fits your clinic size. All plans include our
              core session tracking features.
            </p>

            {/* Pricing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <span className="text-sm text-muted-foreground">Monthly</span>
              <div className="relative">
                <div className="w-12 h-6 bg-muted rounded-full cursor-pointer">
                  <div className="w-5 h-5 bg-primary rounded-full transform translate-x-6 translate-y-0.5"></div>
                </div>
              </div>
              <span className="text-sm font-semibold">
                Annual <span className="text-primary">(20% off)</span>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`luxury-card p-8 relative hover-scale animate-fade-in ${
                  plan.popular ? "ring-2 ring-primary" : ""
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">
                      /{plan.period}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{plan.description}</p>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.popular ? "default" : "outline"}
                  size="lg"
                  className="w-full"
                  asChild
                >
                  <Link href="/test-stripe">{plan.cta}</Link>
                </Button>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">
              Need a custom solution? We offer enterprise packages for large
              healthcare networks.
            </p>
            <Button variant="link">Contact our sales team →</Button>
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section id="support" className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              We're here to{" "}
              <span className="text-primary">help you succeed</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Get the support you need, when you need it. Our team of healthcare
              technology experts is ready to assist.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto mb-16">
            {[
              {
                icon: MessageCircle,
                title: "Live Chat",
                description: "Instant support during business hours",
                action: "Start chatting",
              },
              {
                icon: Mail,
                title: "Email Support",
                description: "Detailed help within 2 hours",
                action: "Send email",
              },
              {
                icon: Phone,
                title: "Phone Support",
                description: "Speak directly with our experts",
                action: "Schedule call",
              },
              {
                icon: Calendar,
                title: "Setup Assistance",
                description: "Free onboarding for all plans",
                action: "Book session",
              },
            ].map((support, index) => (
              <div
                key={index}
                className="luxury-card p-6 text-center hover-scale animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <support.icon className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-semibold mb-2">{support.title}</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {support.description}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-transparent"
                >
                  {support.action}
                </Button>
              </div>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-center mb-12">
              Frequently Asked Questions
            </h3>
            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  question: "How quickly can I get started?",
                  answer:
                    "Most clinics are up and running within 3 minutes. Simply enter your practice management software API key and we'll handle the rest.",
                },
                {
                  question: "Which practice management systems do you support?",
                  answer:
                    "We integrate with all major PMS including Halaxy, Cliniko, Power Diary, TM3, and many others. Don't see yours? Contact us for custom integration.",
                },
                {
                  question: "Is my patient data secure?",
                  answer:
                    "Absolutely. We're HIPAA compliant with enterprise-grade encryption. Your data never leaves Australia and we follow strict healthcare privacy standards.",
                },
                {
                  question: "Can I cancel anytime?",
                  answer:
                    "Yes, there are no long-term contracts. Cancel anytime with one click. Your data export is always available if you choose to leave.",
                },
                {
                  question: "Do you offer training?",
                  answer:
                    "Every plan includes free onboarding and training. We also provide ongoing support and regular check-ins to ensure you're maximizing value.",
                },
                {
                  question: "What happens during the free trial?",
                  answer:
                    "You get full access to all features for 7 days. No credit card required. If you love it, upgrade seamlessly. If not, no worries at all.",
                },
                {
                  question: "What is Workers' Compensation tracking?",
                  answer:
                    "Workers' Compensation (known as WorkCover, WorkSafe, ReturnToWork, etc. depending on your state) tracking helps you monitor approved sessions and renewal dates for work injury patients.",
                },
                {
                  question: "Can we filter by physio or location?",
                  answer:
                    "Yes, the dashboard has filters to view patients by specific physio or clinic location, perfect for multi-user clinics.",
                },
                {
                  question: "What if we need to edit quotas?",
                  answer:
                    "MyPhysioFlow includes Edit Quota, Pending, and Discharge buttons for each patient, giving you full control over patient management.",
                },
                {
                  question: "Will this add more admin work?",
                  answer:
                    "No. MyPhysioFlow is designed to remove admin work. It runs in the background and only flags what needs attention.",
                },
                {
                  question: "Is this just about revenue?",
                  answer:
                    "No – this is about giving your clinic clarity and peace of mind. Clinics use MyPhysioFlow to stay organized and in control every single day.",
                },
              ].map((faq, index) => (
                <div
                  key={index}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <h4 className="font-semibold mb-2">{faq.question}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Coming Soon Section */}
      <section className="py-20 bg-gradient-to-r from-secondary/10 to-accent/10 border-y border-border/20">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/10 to-primary/20 rounded-full border border-primary/20 mb-6">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-primary">
                Early Access
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              CTP Tracking, NDIS & Auto-Generated Reports
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              We're developing comprehensive CTP tracking, NDIS management, and
              automated insurer report generation to complete your clinic's
              needs.
            </p>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 mb-8">
              <p className="text-sm font-semibold text-primary mb-2">
                🎯 Early Access Benefit
              </p>
              <p className="text-sm text-muted-foreground">
                Annual plans get first access to new features like CTP tracking
                and auto-generated insurer reports.
              </p>
            </div>
            <Button
              variant="outline"
              className="text-base px-8 py-3 border-2 hover:bg-primary/5 bg-transparent"
            >
              Get Early Access with Annual Plan
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-gradient-to-r from-primary/10 to-secondary/10">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Clarity. Control. Less Chaos. Start in Minutes.
            </h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-3xl mx-auto">
              Join hundreds of Australian clinics who no longer feel overwhelmed
              by session tracking and compliance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                variant="default"
                size="lg"
                className="hover-scale"
                asChild
              >
                <Link href="/signup">
                  Start Your Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="hover-scale bg-transparent"
              >
                Book a Demo
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              Setup takes 3 minutes • 7-day free trial • No credit card required
            </p>
          </div>
        </div>
      </section>
      {!user && (
        <div className="fixed bottom-4 right-4 z-50 flex gap-2">
          <button
            onClick={() => handleViewChange("landing")}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              currentView === "landing"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-foreground border-border hover:bg-muted"
            }`}
          >
            Landing
          </button>
          <button
            onClick={() => handleViewChange("login")}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              currentView === "login"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-foreground border-border hover:bg-muted"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => handleViewChange("signup")}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              currentView === "signup"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-foreground border-border hover:bg-muted"
            }`}
          >
            Signup
          </button>
        </div>
      )}
      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="text-xl font-bold mb-4">MyPhysioFlow</div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Automated session tracking for healthcare practices. Never lose
                revenue on expired sessions again.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="#features"
                    className="hover:text-foreground transition-colors"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="hover:text-foreground transition-colors"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Integrations
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    API
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="#support"
                    className="hover:text-foreground transition-colors"
                  >
                    Help Center
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Contact Us
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    System Status
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Training
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Blog
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Privacy
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>
              &copy; 2024 MyPhysioFlow. All rights reserved. Made with ❤️ for
              healthcare professionals.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

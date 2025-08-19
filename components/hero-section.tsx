'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, Users, Bell, Clock } from 'lucide-react';
import Header from './header';

interface HeroSectionProps {
  onGetStarted?: () => void;
  onLogin?: () => void;
  onSignup?: () => void;
}

const HeroSection = ({ onGetStarted, onLogin, onSignup }: HeroSectionProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent">
      <Header onLogin={onLogin} onSignup={onSignup} />
      <div className="container mx-auto px-6 py-16">
        {/* Hero Content */}
        <div className="text-center max-w-4xl mx-auto fade-in">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Track Workers Compensation & EPC Sessions
            <span className="block text-primary">Automatically</span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
            Connect your clinic software in minutes and never lose session revenue or miss renewals
            again.
          </p>

          <div className="mb-6 p-4 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl">
            <p className="text-lg font-medium text-primary">
              🚀 NDIS tracking/reminders beta coming soon
            </p>
          </div>

          <Button variant="default" size="lg" className="mb-4" onClick={onGetStarted}>
            Start Tracking Your Patient Sessions
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          <p className="text-sm text-muted-foreground">7-day free trial – no card required.</p>
        </div>

        {/* Dashboard Mockup */}
        <div className="mt-16 slide-up">
          <div className="relative max-w-5xl mx-auto">
            <div className="bg-card p-8 rounded-lg border border-border shadow-lg">
              <div className="rounded-lg overflow-hidden shadow-lg">
                <div className="bg-card border-b border-border p-4 flex items-center gap-3">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive"></div>
                    <div className="w-3 h-3 rounded-full bg-warning"></div>
                    <div className="w-3 h-3 rounded-full bg-success"></div>
                  </div>
                  <div className="text-sm text-muted-foreground">MyPhysioFlow Dashboard</div>
                </div>

                <div className="p-6 space-y-4">
                  {/* Mock KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Active Clients', value: '142', icon: Users },
                      {
                        label: 'Sessions Remaining',
                        value: '1,234',
                        icon: Clock,
                      },
                      {
                        label: 'Clients Needing Action',
                        value: '8',
                        icon: Bell,
                      },
                      {
                        label: 'Last Sync',
                        value: '2 min ago',
                        icon: ArrowRight,
                      },
                    ].map((stat, index) => (
                      <div
                        key={index}
                        className="bg-card p-4 text-center rounded-lg border border-border"
                      >
                        <stat.icon className="h-6 w-6 mx-auto mb-2 text-primary" />
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <div className="text-sm text-muted-foreground">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Mock Table */}
                  <div className="space-y-2">
                    {[
                      {
                        name: 'Sarah M***',
                        program: 'EPC',
                        sessions: '3/5',
                        status: 'good',
                      },
                      {
                        name: 'John D***',
                        program: 'Workers Comp',
                        sessions: '8/12',
                        status: 'good',
                      },
                      {
                        name: 'Emma W***',
                        program: 'Workers Comp',
                        sessions: '1/10',
                        status: 'warning',
                      },
                    ].map((patient, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="font-medium">{patient.name}</div>
                          <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                            {patient.program}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm">{patient.sessions}</div>
                          <div
                            className={`w-2 h-2 rounded-full ${patient.status === 'warning' ? 'bg-warning' : 'bg-success'}`}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Benefits */}
        <div className="mt-20 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            {
              icon: Users,
              title: 'All clients, one view',
              description: 'See all your Workers Compensation & EPC patients in a single dashboard',
            },
            {
              icon: Bell,
              title: 'Instant alerts before quota ends',
              description: 'Never miss a renewal or lose revenue from expired sessions',
            },
            {
              icon: Clock,
              title: 'Set up in under 3 minutes',
              description: 'Connect your practice management software with just your API key',
            },
          ].map((benefit, index) => (
            <div
              key={index}
              className="text-center fade-in"
              style={{ animationDelay: `${index * 0.2}s` }}
            >
              <benefit.icon className="h-12 w-12 mx-auto mb-4 text-primary" strokeWidth={1} />
              <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <Button variant="default" size="lg" onClick={onGetStarted}>
            Start Tracking Now
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;

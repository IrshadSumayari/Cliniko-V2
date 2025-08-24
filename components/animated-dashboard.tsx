'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Clock, 
  Bell, 
  CheckCircle, 
  TrendingUp, 
  Activity,
  ArrowRight,
  Calendar,
  Target,
  Zap
} from 'lucide-react';

interface AnimatedDashboardProps {
  onNavigate?: (view: 'settings' | 'onboarding') => void;
}

export function AnimatedDashboard({ onNavigate }: AnimatedDashboardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentMetric, setCurrentMetric] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    
    const interval = setInterval(() => {
      setCurrentMetric((prev) => (prev + 1) % 4);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const metrics = [
    { label: 'Active Patients', value: '127', icon: Users, color: 'text-blue-600', change: '+12%' },
    { label: 'Sessions This Week', value: '89', icon: Clock, color: 'text-green-600', change: '+8%' },
    { label: 'Pending Approvals', value: '23', icon: Bell, color: 'text-orange-600', change: '-5%' },
    { label: 'Completion Rate', value: '94%', icon: CheckCircle, color: 'text-purple-600', change: '+2%' }
  ];

  const quickActions = [
    { title: 'Add Patient', description: 'Register new patient', icon: Users, color: 'bg-blue-500' },
    { title: 'Schedule Session', description: 'Book appointment', icon: Calendar, color: 'bg-green-500' },
    { title: 'Review Cases', description: 'Check pending items', icon: Target, color: 'bg-orange-500' },
    { title: 'Generate Report', description: 'Export data', icon: TrendingUp, color: 'bg-purple-500' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-accent/10 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className={`text-center space-y-4 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            Welcome to PhysioFlow
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Streamline your physiotherapy practice with intelligent patient management and automated workflows
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => (
            <Card 
              key={metric.label}
              className={`transition-all duration-700 hover:scale-105 hover:shadow-xl ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${metric.color.replace('text-', 'bg-')} bg-opacity-10`}>
                    <metric.icon className={`h-6 w-6 ${metric.color}`} />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {metric.change}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{ transitionDelay: '600ms' }}>
          <h2 className="text-2xl font-semibold text-foreground mb-6 text-center">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action, index) => (
              <Card 
                key={action.title}
                className="group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg border-border/50 hover:border-primary/30"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6 text-center space-y-4">
                  <div className={`w-16 h-16 ${action.color} rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300`}>
                    <action.icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors duration-300">
                      {action.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                    <ArrowRight className="h-4 w-4 mr-2 group-hover:translate-x-1 transition-transform duration-300" />
                    Action
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{ transitionDelay: '900ms' }}>
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/15 to-secondary/15 rounded-xl flex items-center justify-center">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Recent Activity</CardTitle>
                    <CardDescription>Latest updates from your practice</CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  View All
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { action: 'New patient registered', time: '2 minutes ago', type: 'success' },
                  { action: 'Session completed', time: '15 minutes ago', type: 'info' },
                  { action: 'Appointment rescheduled', time: '1 hour ago', type: 'warning' },
                  { action: 'Payment received', time: '2 hours ago', type: 'success' }
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors duration-200">
                    <div className={`w-2 h-2 rounded-full ${
                      item.type === 'success' ? 'bg-green-500' : 
                      item.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{item.action}</p>
                      <p className="text-xs text-muted-foreground">{item.time}</p>
                    </div>
                    <Zap className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <div className={`text-center space-y-6 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} style={{ transitionDelay: '1200ms' }}>
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-foreground">Ready to get started?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Set up your practice profile, connect your PMS system, and start managing patients efficiently
            </p>
          </div>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" className="gap-2">
              <Activity className="h-5 w-5" />
              Get Started
            </Button>
            {onNavigate && (
              <Button variant="outline" size="lg" onClick={() => onNavigate('onboarding')}>
                View Tutorial
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

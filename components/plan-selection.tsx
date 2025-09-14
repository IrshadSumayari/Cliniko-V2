'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';
import { getPricingConfig, getPriceInDollars, PricingPlan } from '@/lib/pricing-config';

interface PlanSelectionProps {
  onBack: () => void;
  onPlanSelected: (plan: string, amount: number, isYearly: boolean) => void;
}

// This will be replaced with dynamic pricing from the config

export default function PlanSelection({ onBack, onPlanSelected }: PlanSelectionProps) {
  const [isYearly, setIsYearly] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [plans, setPlans] = useState<Record<string, PricingPlan>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { getAccessToken } = useAuth();

  // Load pricing configuration
  useEffect(() => {
    const loadPricing = async () => {
      try {
        const pricingConfig = getPricingConfig();
        setPlans(pricingConfig);
        setIsLoading(false);
      } catch (error) {
        toast.error('Failed to load pricing information');
        setIsLoading(false);
      }
    };

    loadPricing();
  }, []);

  const handlePlanSelect = async (planKey: string) => {
    if (planKey === 'enterprise') {
      // For enterprise, show contact sales message
      toast.info('Please contact our sales team for Enterprise pricing and setup.');
      return;
    }

    setSelectedPlan(planKey);
    setIsProcessing(true);

    try {
      const plan = plans[planKey];
      if (!plan) {
        throw new Error('Plan not found');
      }
      
      const amount = getPriceInDollars(plan, isYearly);
      
      // Get auth token
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Get user profile to get email
      const profileResponse = await fetch('/api/user/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!profileResponse.ok) {
        throw new Error('Failed to get user profile');
      }

      const profileData = await profileResponse.json();
      const userEmail = profileData.user?.email || '';

      // Get the auth user ID from the token
      // Decode the JWT token to get the user ID
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const tokenPayload = JSON.parse(atob(tokenParts[1]));
      const authUserId = tokenPayload.sub;

      if (!authUserId) {
        throw new Error('User ID not found in token');
      }

      // Create checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: authUserId, // Pass the auth user ID from token
          email: userEmail,
          plan: planKey,
          isYearly,
          amount: plan.monthlyPrice, // Pass the price in cents directly from the plan
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe checkout
      window.location.href = url;
    } catch (error) {
      toast.error('Failed to start checkout process. Please try again.');
      setIsProcessing(false);
      setSelectedPlan(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading pricing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="space-y-8 fade-in">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4 text-primary">
              Choose Your Plan
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-6">
              Ready to see your complete dashboard? Select a plan to unlock all features and start tracking your patients.
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              One missed renewal costs more than a month of MyPhysioFlow
            </p>
            
            {/* Annual Plan Bonus */}
            <div className="bg-card/80 border border-primary/30 rounded-lg p-4 max-w-3xl mx-auto mb-8">
              <div className="text-center">
                <h3 className="font-semibold text-lg mb-2 text-primary">Annual Plan Bonus</h3>
                <p className="text-base mb-3 text-foreground">
                  Pay yearly, get <span className="text-primary font-medium">3 months free</span> + early access to new features
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
              <span className={`text-sm ${!isYearly ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
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
              <span className={`text-sm ${isYearly ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                Yearly
              </span>
              {isYearly && (
                <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full">
                  Save 3 months!
                </span>
              )}
            </div>
          </div>


          {/* Pricing Plans */}
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {Object.entries(plans).map(([key, plan]) => (
                <Card 
                  key={key}
                  className={`p-6 hover:shadow-lg transition-shadow ${
                    plan.popular 
                      ? 'border-2 border-primary relative' 
                      : 'border border-border'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground px-3 py-1 text-xs font-medium rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-2 text-foreground">{plan.name}</h3>
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-foreground">
                        ${getPriceInDollars(plan, isYearly).toFixed(0)}
                      </span>
                      <span className="text-base text-muted-foreground">/month</span>
                      {isYearly && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Billed annually (${(getPriceInDollars(plan, isYearly) * 12).toFixed(0)})
                        </div>
                      )}
                    </div>
                    <p className={`text-sm mb-6 ${plan.popular ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                      {plan.description}
                    </p>
                    
                    <div className="space-y-3 mb-8 text-left">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className={`text-sm ${plan.popular ? 'font-medium' : ''}`}>
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    <Button 
                      variant={plan.popular ? "default" : "outline"} 
                      className="w-full" 
                      onClick={() => handlePlanSelect(key)}
                      disabled={isProcessing}
                    >
                      {isProcessing && selectedPlan === key ? (
                        'Processing...'
                      ) : key === 'enterprise' ? (
                        'Contact Sales'
                      ) : (
                        `Start ${plan.name} Plan`
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Back Button */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={onBack}
              disabled={isProcessing}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sync Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

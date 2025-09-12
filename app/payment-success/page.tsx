'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUserData } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your payment...');
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const processPayment = async () => {
      try {
        const sessionId = searchParams?.get('session_id');

        if (!sessionId) {
          setStatus('error');
          setMessage('No payment session found');
          return;
        }

        console.log('🎯 Processing payment success for session:', sessionId);

        // Call our API to update subscription status
        const response = await fetch('/api/payment-success', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          setStatus('success');
          setMessage('Payment successful! Your subscription is now active!');
          try {
            await refreshUserData();
          } catch (error) {
            console.error('Failed to refresh user data:', error);
          }

          // Don't auto-redirect, let user click the button
        } else {
          setStatus('error');
          setMessage(result.error || 'Failed to activate subscription');
        }
      } catch (error) {
        console.error('Payment processing error:', error);
        setStatus('error');
        setMessage('An error occurred while processing your payment');
      }
    };

    processPayment();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 mb-4">
            {status === 'loading' && <Loader2 className="h-6 w-6 animate-spin" />}
            {status === 'success' && <CheckCircle className="h-6 w-6 text-green-500" />}
            {status === 'error' && <XCircle className="h-6 w-6 text-red-500" />}
            Payment Status
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'success' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Your subscription is now active!</p>
              <Button
                onClick={async () => {
                  if (isRedirecting) return;

                  setIsRedirecting(true);
                  try {
                    // Clear any cached onboarding status to force fresh fetch
                    try {
                      localStorage.removeItem('user_onboarding_status');
                      localStorage.removeItem('user_onboarding_status_timestamp');
                    } catch (e) {
                      console.warn('Failed to clear localStorage:', e);
                    }

                    await refreshUserData();

                    // Add a small delay to ensure the context is updated
                    setTimeout(() => {
                      router.push('/');
                    }, 1000);
                  } catch (error) {
                    console.error('Failed to refresh user data:', error);
                    // Still redirect even if refresh fails
                    router.push('/');
                  }
                }}
                className="w-full"
                disabled={isRedirecting}
              >
                {isRedirecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  'Continue to Dashboard'
                )}
              </Button>
            </div>
          )}
          {status === 'error' && (
            <div className="space-y-4">
              <Button onClick={() => router.push('/')} variant="outline" className="w-full">
                Go to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 mb-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            Loading...
          </CardTitle>
          <CardDescription>Preparing payment verification...</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}

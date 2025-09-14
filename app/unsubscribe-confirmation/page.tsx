'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

export default function UnsubscribeConfirmationPage() {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleBackToHome = async () => {
    // Sign out the user first
    await signOut();
    // Then redirect to homepage
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <Card className="text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-700">Successfully Unsubscribed</CardTitle>
            <CardDescription className="text-base">
              Your subscription has been canceled and you have been signed out.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <p className="font-medium">What happens next:</p>
              <ul className="space-y-1 text-muted-foreground text-left">
                <li>• Your subscription has been canceled</li>
                <li>• You will not be charged again</li>
                <li>• You have been signed out of your account</li>
                <li>• You can sign in again anytime to resubscribe</li>
                <li>• Your data will be preserved for future resubscription</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Button onClick={handleBackToHome} className="w-full" size="lg">
                <Home className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                If you have any questions or need assistance, please contact our support team.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

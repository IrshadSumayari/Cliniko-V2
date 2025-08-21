import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

export default function AuthCodeError() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <CardTitle className="text-red-700">Authentication Error</CardTitle>
          </div>
          <CardDescription>There was a problem with the authentication process</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The authentication callback failed. This could be due to:
            </AlertDescription>
          </Alert>

          <ul className="text-sm text-gray-600 space-y-1 ml-4">
            <li>• Invalid OAuth configuration</li>
            <li>• Expired or invalid authorization code</li>
            <li>• Network connectivity issues</li>
            <li>• Supabase configuration problems</li>
          </ul>

          <div className="flex gap-3 pt-4">
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/signup">Try Again</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

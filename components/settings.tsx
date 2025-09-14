'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  SettingsIcon,
  User,
  Building2,
  Plug,
  Save,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Crown,
  AlertTriangle,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';
import { authenticatedFetch } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface PMSConnection {
  software: string;
  apiKey: string;
  connected: boolean;
  lastSync: string;
}

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  clinic_name: string;
  pms_type?: string;
  pms_connected?: boolean;
  pms_last_sync?: string;
  subscription_status?: string;
  trial_ends_at?: string;
  stripe_customer_id?: string;
  created_at: string;
  updated_at: string;
}

import { config } from '@/lib/config';

const Settings = ({ onBack }: { onBack: () => void }) => {
  const { user, signOut, refreshUserData } = useAuth();
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [showUnsubscribeConfirm, setShowUnsubscribeConfirm] = useState(false);

  const [profile, setProfile] = useState<UserProfile>({
    id: '',
    first_name: '',
    last_name: '',
    email: '',
    clinic_name: '',
    pms_type: '',
    pms_connected: false,
    pms_last_sync: '',
    created_at: '',
    updated_at: '',
  });

  const [pmsConnection, setPmsConnection] = useState<PMSConnection>({
    software: '',
    apiKey: '',
    connected: false,
    lastSync: '',
  });

  const [subscriptionStatus, setSubscriptionStatus] = useState({
    plan: 'Free Trial',
    daysLeft: 7,
    usage: 45,
    limit: 100,
  });

  // Fetch user profile from database
  const fetchUserProfile = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const response = await authenticatedFetch(`/api/user/profile`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const responseData = await response.json();
      const userData = responseData.user || responseData;

      // Update profile state with database data
      setProfile(userData);

      if (userData.subscription_status) {
        const isActive = userData.subscription_status === 'active';
        setSubscriptionStatus({
          plan: isActive ? 'Professional' : 'Free Trial',
          daysLeft: isActive ? 0 : 7,
          usage: isActive ? 0 : 45,
          limit: isActive ? 0 : 100,
        });
      }

      // Now fetch PMS credentials with the updated profile data
      await fetchPMSCredentials(userData);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch PMS credentials from database
  const fetchPMSCredentials = async (profileData?: UserProfile) => {
    if (!user?.id) return;

    try {
      const response = await authenticatedFetch(`/api/user/pms-credentials`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch PMS credentials');
      }

      const credentials = await response.json();

      console.log('PMS credentials received:', credentials);
      console.log('Profile data for PMS update:', profileData || profile);

      // Update PMS connection state with credentials from database
      setPmsConnection({
        software: credentials.pms_type
          ? credentials.pms_type.charAt(0).toUpperCase() + credentials.pms_type.slice(1)
          : '',
        apiKey: credentials.api_key ? '••••••••••••••••' : '', // Show masked version for encrypted key
        connected: !!credentials.pms_type,
        lastSync: credentials.pms_last_sync || '',
      });

      console.log('Updated PMS connection state:', {
        software: credentials.pms_type
          ? credentials.pms_type.charAt(0).toUpperCase() + credentials.pms_type.slice(1)
          : '',
        connected: !!credentials.pms_type,
        lastSync: credentials.pms_last_sync || '',
      });
    } catch (error) {
      console.error('Error fetching PMS credentials:', error);
      // Don't show error toast for credentials, just log it
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, [user?.id]);

  // Refresh data when component becomes visible (e.g., after returning from payment)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.id) {
        fetchUserProfile();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user?.id]);

  const handleProfileSave = async () => {
    if (!user?.id) return;

    try {
      setIsSaving(true);

      const response = await authenticatedFetch('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          first_name: profile.first_name,
          last_name: profile.last_name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      toast.success('Profile information has been saved successfully!');

      // Refresh profile data
      await fetchUserProfile();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePMSConnect = async () => {
    if (!pmsConnection.software || !pmsConnection.apiKey) {
      toast.error('Please select your software and enter an API key.');
      return;
    }

    // Validate API key format based on PMS type
    if (pmsConnection.software === 'Nookal') {
      const nookalPattern =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      if (!nookalPattern.test(pmsConnection.apiKey)) {
        toast.error(
          'Invalid Nookal API key format. Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
        );
        return;
      }
    }

    try {
      setIsConnecting(true);

      // Test the connection first
      const testResponse = await authenticatedFetch('/api/pms/test-connection', {
        method: 'POST',
        body: JSON.stringify({
          pmsType: pmsConnection.software.toLowerCase(),
          apiKey: pmsConnection.apiKey,
        }),
      });

      if (!testResponse.ok) {
        const errorData = await testResponse.json();
        throw new Error(errorData.error || 'Failed to connect to PMS');
      }

      // If connection test passes, save to database
      const saveResponse = await authenticatedFetch('/api/user/pms-connection', {
        method: 'POST',
        body: JSON.stringify({
          pms_type: pmsConnection.software.toLowerCase(), // Convert to lowercase for database
          api_key: pmsConnection.apiKey,
        }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.error || 'Failed to save PMS connection');
      }

      // Update local state
      const updatedConnection = {
        ...pmsConnection,
        connected: true,
        lastSync: new Date().toLocaleString(),
        apiKey: '', // Clear API key from state for security
      };

      setPmsConnection(updatedConnection);

      // Update profile state
      setProfile((prev) => ({
        ...prev,
        pms_type: pmsConnection.software,
        pms_connected: true,
        pms_last_sync: new Date().toISOString(),
      }));

      // Refresh profile and credentials data
      await fetchUserProfile();

      toast.success(`Successfully connected to ${pmsConnection.software}.`);
    } catch (error) {
      console.error('Error connecting PMS:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to connect to PMS');
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePMSDisconnect = async () => {
    try {
      const response = await authenticatedFetch('/api/user/pms-connection', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to disconnect PMS');
      }

      // Update local state
      const updatedConnection = {
        ...pmsConnection,
        connected: false,
        lastSync: '',
        apiKey: '',
      };

      setPmsConnection(updatedConnection);

      // Update profile state
      setProfile((prev) => ({
        ...prev,
        pms_type: '',
        pms_connected: false,
        pms_last_sync: '',
      }));

      // Refresh profile and credentials data
      await fetchUserProfile();

      toast.success('Your practice management software has been disconnected.');
    } catch (error) {
      console.error('Error disconnecting PMS:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to disconnect PMS');
    }
  };

  async function handleUpgrade() {
    setUpgradeLoading(true);
    try {
      const res = await authenticatedFetch('/api/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({
          email: user?.email,
          userId: user?.id,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Expected JSON, got ${contentType}. Possible HTML error page.`);
      }

      const data = await res.json();

      if (!res.ok) {
        console.error('Upgrade failed:', data.error);
        toast.error(data.error || 'Upgrade failed');
        setUpgradeLoading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setUpgradeLoading(false);
    }
  }

  const handleUnsubscribe = async () => {
    try {
      setIsUnsubscribing(true);

      const response = await authenticatedFetch('/api/user/unsubscribe', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unsubscribe');
      }

      const data = await response.json();

      if (data.success) {
        toast.success('Subscription canceled successfully');

        await signOut();

        window.location.href = '/unsubscribe-confirmation';
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to unsubscribe');
    } finally {
      setIsUnsubscribing(false);
      setShowUnsubscribeConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-accent flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <SettingsIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground">Manage your account and preferences</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Profile Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Profile Information</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">First Name</label>
                  <Input
                    value={profile.first_name}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        first_name: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                  <Input
                    value={profile.last_name}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        last_name: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <Input type="email" value={profile.email} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
              </div>

              <Button onClick={handleProfileSave} className="w-full" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSaving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </Card>

          {/* Account Actions */}
          <Card className="p-6 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Account Actions</h2>
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Plug className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">PMS Connection Status</span>
                </div>
                {pmsConnection.connected ? (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 border-green-200"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
              </div>

              <hr className="border-border" />
            </div>

            <div className="mt-auto space-y-3">
              <Button variant="outline" onClick={signOut} className="w-full">
                Sign Out
              </Button>
            </div>
          </Card>
        </div>

        {/* Subscription Card - Full Width at Bottom */}
        <div className="mt-8">
          {subscriptionStatus.plan === 'Professional' ||
          profile.subscription_status === 'active' ? (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <Crown className="h-5 w-5 text-green-600" />
                  Professional Plan Active
                </CardTitle>
                <CardDescription className="text-green-600">
                  You have unlimited access to all features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-green-700">$30</span>
                    <span className="text-green-600">/month</span>
                  </div>
                  <ul className="space-y-1 text-sm text-green-600">
                    <li>✅ Unlimited patient matching</li>
                    <li>✅ Advanced analytics and reporting</li>
                    <li>✅ Priority support</li>
                  </ul>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <p className="text-sm text-green-700 font-medium">
                    🎉 Thank you for being a Professional subscriber!
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  Upgrade to Professional
                </CardTitle>
                <CardDescription>Unlock all features and get unlimited access</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">$30</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>Unlimited patient matching</li>
                    <li>Advanced analytics and reporting</li>
                  </ul>
                </div>
                <Button
                  onClick={handleUpgrade}
                  disabled={upgradeLoading}
                  className="w-full"
                  size="lg"
                >
                  {upgradeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Upgrade Now
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Unsubscribe Section - Only show for active subscribers */}
        {(subscriptionStatus.plan === 'Professional' ||
          profile.subscription_status === 'active') && (
          <div className="mt-8">
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Cancel Subscription
                </CardTitle>
                <CardDescription className="text-red-600">
                  Cancel your subscription and deactivate your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-red-100 rounded-lg p-4">
                  <p className="text-sm text-red-700 font-medium mb-2">
                    ⚠️ Warning: This action cannot be undone
                  </p>
                  <ul className="space-y-1 text-sm text-red-600">
                    <li>• Your subscription will be canceled immediately</li>
                    <li>• You will lose access to all features</li>
                    <li>• Your account will be deactivated</li>
                    <li>• You can resubscribe anytime in the future</li>
                  </ul>
                </div>

                {!showUnsubscribeConfirm ? (
                  <Button
                    variant="destructive"
                    onClick={() => setShowUnsubscribeConfirm(true)}
                    className="w-full"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cancel Subscription
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                      <p className="text-sm text-red-700 font-medium mb-2">
                        Are you sure you want to cancel your subscription?
                      </p>
                      <p className="text-xs text-red-600">
                        This will immediately cancel your subscription and deactivate your account.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={handleUnsubscribe}
                        disabled={isUnsubscribing}
                        className="flex-1"
                      >
                        {isUnsubscribing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <LogOut className="mr-2 h-4 w-4" />
                        )}
                        {isUnsubscribing ? 'Canceling...' : 'Yes, Cancel Subscription'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowUnsubscribeConfirm(false)}
                        className="flex-1"
                      >
                        Keep Subscription
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;

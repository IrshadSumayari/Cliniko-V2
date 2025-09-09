'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowRight,
  ArrowLeft,
  Shield,
  Loader2,
  CheckCircle,
  Settings,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { authenticatedFetch } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type OnboardingStep = 'pms' | 'api' | 'syncing' | 'sync-results' | 'tag-config' | 'tag-complete';

interface SyncResults {
  wcPatients: number;
  epcPatients: number;
  totalAppointments: number;
  actionNeededPatients: number;
  issues?: string[];
  customTags?: {
    wc: string;
    epc: string;
  };
}

export default function OnboardingFlow() {
  const { updateUserOnboardingStatus, completeDashboardSetup, isLoading, user, getAccessToken } =
    useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('pms');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [syncProgress, setSyncProgress] = useState({
    progress: 0,
    message: '',
    currentStage: '',
  });
  const [formData, setFormData] = useState({
    selectedPMS: '',
    apiKey: '',
  });
  const [showOtherPopup, setShowOtherPopup] = useState(false);
  const [otherPMSData, setOtherPMSData] = useState({
    softwareName: '',
    softwareUrl: '',
  });
  const [websiteError, setWebsiteError] = useState('');
  const [syncResults, setSyncResults] = useState<SyncResults>({
    wcPatients: 0,
    epcPatients: 0,
    totalAppointments: 0,
    actionNeededPatients: 0,
    issues: [],
    customTags: {
      wc: 'WC',
      epc: 'EPC',
    },
  });

  const [customTags, setCustomTags] = useState({
    wc: 'WC',
    epc: 'EPC',
  });

  useEffect(() => {
    const fetchUserTags = async () => {
      try {
        const token = getAccessToken();

        if (!token) return;

        // Fetch current user tags from the API
        const response = await fetch('/api/user/tags', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userTags = await response.json();
          setCustomTags({
            wc: userTags.wc || 'WC',
            epc: userTags.epc || 'EPC',
          });
          console.log('Fetched user tags:', userTags);
        } else {
          console.log('Using default WC/EPC tags');
        }
      } catch (error) {
        console.error('Error fetching user tags:', error);
        console.log('Using default WC/EPC tags');
      }
    };

    fetchUserTags();
  }, [getAccessToken]);

  const validateWebsiteUrl = (url: string): boolean => {
    try {
      // Basic URL validation
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(url)) {
        setWebsiteError('Please enter a valid URL starting with http:// or https://');
        return false;
      }

      // Try to create a URL object to validate the format
      new URL(url);
      setWebsiteError('');
      return true;
    } catch (error) {
      setWebsiteError('Please enter a valid website URL (e.g., https://example.com)');
      return false;
    }
  };

  const handlePMSSelect = (pms: string) => {
    if (pms === 'Other') {
      setShowOtherPopup(true);
    } else {
      setFormData({ ...formData, selectedPMS: pms });
    }
  };

  const handleOtherPMSSubmit = async () => {
    if (!otherPMSData.softwareName.trim() || !otherPMSData.softwareUrl.trim()) {
      toast.error('Please fill in both software name and software URL');
      return;
    }

    // Validate website URL
    if (!validateWebsiteUrl(otherPMSData.softwareUrl)) {
      return;
    }

    try {
      setIsProcessing(true);

      // Get the access token from auth context
      const token = getAccessToken();
      if (!token) {
        toast.error('Authentication token not found. Please try logging in again.');
        return;
      }

      // Send the custom PMS setup request using direct fetch with manual headers
      const response = await fetch('/api/pms/pms-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          softwareName: otherPMSData.softwareName,
          softwareUrl: otherPMSData.softwareUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit request');
      }

      const result = await response.json();

      toast.success(result.message || 'Custom PMS integration request submitted successfully!');

      // Close popup and skip to completion
      setShowOtherPopup(false);
      setOtherPMSData({ softwareName: '', softwareUrl: '' });

      // Skip the normal flow and go to a completion step
      setCurrentStep('tag-complete');
    } catch (error) {
      console.error('Error submitting custom PMS request:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit request. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOtherPMSCancel = () => {
    setShowOtherPopup(false);
    setOtherPMSData({ softwareName: '', softwareUrl: '' });
    setWebsiteError('');
  };

  const resetSyncProgress = () => {
    setSyncProgress({
      progress: 0,
      message: '',
      currentStage: '',
    });
  };

  const handleConnectAndSync = async () => {
    if (!formData.apiKey.trim()) {
      toast.error('Please enter your API key');
      return;
    }

    // Validate API key format based on PMS type
    if (formData.selectedPMS === 'Nookal') {
      const nookalPattern =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      if (!nookalPattern.test(formData.apiKey)) {
        toast.error(
          'Invalid Nookal API key format. Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
        );
        return;
      }
    }

    // Remove session check - we're using token-based auth now
    setIsProcessing(true);
    setCurrentStep('syncing');
    resetSyncProgress();

    try {
      // Start with 0% progress
      setSyncProgress({
        progress: 0,
        message: 'Initializing connection...',
        currentStage: 'initializing',
      });

      // Make the API call immediately at 0%
      const apiCallPromise = authenticatedFetch('/api/pms/connect-and-sync', {
        method: 'POST',
        body: JSON.stringify({
          pmsType: formData.selectedPMS.toLowerCase(),
          apiKey: formData.apiKey,
        }),
      });

      // Start progress simulation
      setSyncProgress({
        progress: 10,
        message: 'Connecting to PMS...',
        currentStage: 'connecting',
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSyncProgress({
        progress: 25,
        message: 'Fetching appointment types...',
        currentStage: 'appointment-types',
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSyncProgress({
        progress: 30,
        message: 'Fetching patients...',
        currentStage: 'patients',
      });

      for (let progress = 31; progress <= 90; progress++) {
        try {
          const result = await Promise.race([
            apiCallPromise,
            new Promise((resolve) => setTimeout(resolve, 1600)),
          ]);

          if (result && typeof result === 'object' && 'ok' in result) {
            setSyncProgress({
              progress: 100,
              message: 'Sync completed successfully!',
              currentStage: 'complete',
            });

            await new Promise((resolve) => setTimeout(resolve, 500));

            // Process the API response
            const response = result as Response;
            const responseData = await response.json();

            if (!response.ok) {
              if (response.status === 401) {
                toast.error('Authentication expired. Please refresh the page and try again.');
                return;
              }
              throw new Error(responseData.error || 'Failed to connect to PMS');
            }

            setSyncResults({
              wcPatients: responseData.wcPatients || 0,
              epcPatients: responseData.epcPatients || 0,
              totalAppointments: responseData.totalAppointments || 0,
              actionNeededPatients: responseData.actionNeededPatients || 0,
              issues: responseData.issues || [],
            });

            toast.success('Successfully connected and synced data!');
            setCurrentStep('tag-config');
            return;
          }
        } catch (error) {
          if (error && typeof error === 'object' && 'message' in error) {
            throw error;
          }
        }

        setSyncProgress({
          progress: progress,
          message: progress < 60 ? 'Processing patient data...' : 'Processing appointment data...',
          currentStage: progress < 60 ? 'patients-processing' : 'appointments-processing',
        });
      }

      setSyncProgress({
        progress: 90,
        message: 'Waiting for sync to complete...',
        currentStage: 'waiting',
      });

      // Wait for the API call to complete
      const response = await apiCallPromise;

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Authentication expired. Please refresh the page and try again.');
          return;
        }
        throw new Error(result.error || 'Failed to connect to PMS');
      }

      // Success - complete the progress
      setSyncProgress({
        progress: 100,
        message: 'Sync completed successfully!',
        currentStage: 'complete',
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSyncResults({
        wcPatients: result.wcPatients || 0,
        epcPatients: result.epcPatients || 0,
        totalAppointments: result.totalAppointments || 0,
        actionNeededPatients: result.actionNeededPatients || 0,
        issues: result.issues || [],
      });

      toast.success('Successfully connected and synced data!');
      setCurrentStep('tag-config');
    } catch (error) {
      console.error('Error during sync:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sync data');

      // Reset progress on error
      resetSyncProgress();
      setCurrentStep('api');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    if (isCompleting) return; // Prevent multiple clicks

    setIsCompleting(true);
    try {
      // Use the new optimized function for dashboard setup
      const success = await completeDashboardSetup();
      if (success) {
        // Email notifications commented out per user request
        // Trigger Action Needed notifications for all patients
        // try {
        //   const token = getAccessToken();
        //   if (token) {
        //     const response = await fetch('/api/notifications/send-action-needed', {
        //       method: 'POST',
        //       headers: {
        //         'Content-Type': 'application/json',
        //         Authorization: `Bearer ${token}`,
        //       },
        //       body: JSON.stringify({
        //         triggerOnboarding: true,
        //         userId: user?.id,
        //       }),
        //     });

        //     if (response.ok) {
        //       const result = await response.json();
        //       console.log(
        //         'Action Needed notifications triggered on onboarding completion:',
        //         result
        //       );
        //     } else {
        //       console.error('Failed to trigger Action Needed notifications:', response.statusText);
        //     }
        //   }
        // } catch (notificationError) {
        //   console.error('Error triggering notifications:', notificationError);
        // }

        toast.success('Setup complete! Welcome to your dashboard.');
      } else {
        toast.error('Failed to complete setup. Please try again.');
      }
    } catch (error) {
      console.error('Error completing onboarding catch:', error);
      toast.error('Failed to complete setup. Please try again !');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleSkip = async () => {
    if (isCompleting) return; // Prevent multiple clicks

    setIsCompleting(true);
    try {
      toast.info('You can connect your PMS later in settings.');
      const success = await updateUserOnboardingStatus(false);
      if (success) {
      } else {
        toast.error('Failed to update status. Please try again.');
      }
    } catch (error) {
      console.error('Error skipping onboarding:', error);
      toast.error('Failed to update status. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleBack = () => {
    const steps: OnboardingStep[] = ['pms', 'api', 'syncing', 'tag-config', 'tag-complete'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);

      // Reset progress when going back to API step
      if (steps[currentIndex - 1] === 'api') {
        resetSyncProgress();
      }
    }
  };

  const getPMSInstructions = (pms: string) => {
    const instructions = {
      cliniko: [
        'Log into your Cliniko account',
        'Go to Settings → Developer → API Keys',
        "Click 'Generate new API key'",
        'Copy the key and paste it below',
      ],
      nookal: [
        'Log into your Nookal account',
        'Go to Settings → API → Generate Key',
        'Create a new API key',
        'Copy the key and paste it below',
      ],
      other: [
        'Contact your PMS provider for API access',
        'Request API key or integration credentials',
        'Provide the API key to our support team',
        'Our team will reach out to you to set up the integration',
      ],
    };
    return instructions[pms.toLowerCase() as keyof typeof instructions] || instructions.other;
  };

  const handleSaveTags = async () => {
    try {
      setIsSavingTags(true);

      // Get the access token from auth context
      const token = getAccessToken();

      if (!token) {
        toast.error('Authentication token not found. Please try logging in again.');
        return;
      }

      const response = await authenticatedFetch('/api/user/update-tags', {
        method: 'POST',
        body: JSON.stringify({
          wcTag: customTags.wc,
          epcTag: customTags.epc,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update tags');
      }

      const result = await response.json();
      console.log('Tags API response:', result);

      // Update the sync results with new counts
      // The API returns dynamic property names based on user's custom tags
      const wcKey = `${customTags.wc}Patients`;
      const epcKey = `${customTags.epc}Patients`;

      console.log('Looking for count keys:', { wcKey, epcKey });
      console.log('Available keys in newCounts:', Object.keys(result.newCounts || {}));

      setSyncResults((prev) => ({
        ...prev,
        wcPatients: result.newCounts[wcKey] || 0,
        epcPatients: result.newCounts[epcKey] || 0,
        totalAppointments: result.newCounts.totalAppointments || 0,
        actionNeededPatients: result.newCounts.actionNeededPatients || 0,
        customTags: {
          wc: customTags.wc,
          epc: customTags.epc,
        },
      }));

      toast.success('Tags updated successfully!');
      setCurrentStep('tag-complete');
    } catch (error) {
      console.error('Error saving tags:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save tags');
    } finally {
      setIsSavingTags(false);
    }
  };
  // const handleTest = async () => {
  //   const { data: userData, error: userError } = await supabase
  //     .from('users')
  //     .select('wc, epc')
  //     // .eq('id', '4b896674-fbb9-47b5-80d4-54061212ef8f')
  //     .single();
  //   console.log(userData, 'User Data for Testing');
  //   const wcTag = 'W/C';
  //   const epcTag = 'EPC';
  //   const { data: wcAppointmentTypes, error: wcTypesError } = await supabase
  //     .from('appointment_types')
  //     .select('appointment_id, appointment_name')
  //     .eq('user_id', '4b896674-fbb9-47b5-80d4-54061212ef8f')
  //     .eq('pms_type', 'nookal')
  //     .ilike('appointment_name', `%${wcTag}%`);

  //   const { data: epcAppointmentTypes, error: epcTypesError } = await supabase
  //     .from('appointment_types')
  //     .select('appointment_id, appointment_name')
  //     .eq('user_id', '4b896674-fbb9-47b5-80d4-54061212ef8f')
  //     .eq('pms_type', 'nookal')
  //     .ilike('appointment_name', `%${epcTag}%`);

  //   console.log(epcAppointmentTypes, 'Crack', wcAppointmentTypes);
  // };
  const renderStep = () => {
    switch (currentStep) {
      case 'pms':
        return (
          <div className="min-h-screen flex items-center justify-center px-6">
            <div className="space-y-6 fade-in w-full max-w-2xl">
              {/* Progress Indicator */}
              <div className="flex justify-center mb-8">
                <div className="flex items-center gap-2">
                  {['pms', 'api', 'syncing'].map((step, index) => {
                    const steps: OnboardingStep[] = ['pms', 'api', 'syncing'];
                    const currentIndex = steps.indexOf(currentStep);
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex;

                    return (
                      <div key={step} className="flex items-center">
                        <div
                          className={`w-3 h-3 rounded-full transition-colors ${
                            isCompleted ? 'bg-primary' : isCurrent ? 'bg-primary' : 'bg-muted'
                          }`}
                        />
                        {index < 2 && (
                          <div className={`w-8 h-0.5 ${isCompleted ? 'bg-primary' : 'bg-muted'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-3xl font-bold mb-2">
                  Connect Your Practice Management Software
                </h2>
                <p className="text-muted-foreground">Choose your current system</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {['Cliniko', 'Nookal', 'Other'].map((pms) => (
                  <div
                    key={pms}
                    className={`luxury-card p-6 text-center cursor-pointer transition-all hover:scale-105 ${
                      formData.selectedPMS === pms ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handlePMSSelect(pms)}
                  >
                    <div className="text-4xl font-bold mb-2">{pms[0]}</div>
                    <div className="font-semibold">{pms}</div>
                  </div>
                ))}
              </div>

              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                  <Shield className="h-4 w-4" />
                  Your data will stay encrypted and secure at all times.
                </div>

                <Button
                  variant="default"
                  size="lg"
                  onClick={() => setCurrentStep('api')}
                  disabled={!formData.selectedPMS || isProcessing || isLoading}
                  className="min-w-[280px] h-12"
                >
                  Continue with Selected System
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                <div className="pt-4">
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    disabled={isProcessing || isLoading}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'api':
        return (
          <div className="space-y-8 fade-in">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <div className="w-8 h-0.5 bg-primary"></div>
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <div className="w-8 h-0.5 bg-muted"></div>
                <div className="w-3 h-3 rounded-full bg-muted"></div>
              </div>
              <h2 className="text-3xl font-bold mb-2">Get Your {formData.selectedPMS} API Key</h2>
              <p className="text-muted-foreground">
                Follow these step-by-step instructions to connect your practice management system
              </p>
            </div>

            <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
              {/* Instructions Card */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Settings className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Step-by-Step Instructions</h3>
                </div>

                <div className="space-y-4">
                  {getPMSInstructions(formData.selectedPMS).map((instruction, index) => (
                    <div key={index} className="flex gap-3">
                      <Badge
                        variant="outline"
                        className="rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0"
                      >
                        {index + 1}
                      </Badge>
                      <p className="text-sm flex-1">{instruction}</p>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-6 w-full bg-transparent"
                  onClick={() =>
                    window.open(
                      `https://${formData.selectedPMS.toLowerCase()}.com/docs/api`,
                      '_blank'
                    )
                  }
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open {formData.selectedPMS} Documentation
                </Button>

                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    Your API key will look like: ck_abc123def456...
                  </div>
                </div>
              </Card>

              {/* API Key Input Card */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Enter Your API Key</h3>
                </div>

                <div className="space-y-4">
                  <Input
                    type="password"
                    placeholder={`Paste your ${formData.selectedPMS} API key here`}
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    className="font-mono text-sm"
                  />

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    Your API key is encrypted and stored securely
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">What happens next?</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• We'll securely connect to your {formData.selectedPMS} account</li>
                      <li>• Import your patient data and appointment history</li>
                      <li>• Set up your personalized dashboard</li>
                      <li>• You'll be ready to use the system immediately</li>
                    </ul>
                  </div>

                  <Button
                    variant="default"
                    size="lg"
                    className="w-full"
                    onClick={handleConnectAndSync}
                    disabled={!formData.apiKey.trim() || isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      'Connect & Sync Data'
                    )}
                    {!isProcessing && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </div>
              </Card>
            </div>

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={handleBack} disabled={isProcessing}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to PMS Selection
              </Button>
              <Button variant="outline" onClick={handleSkip} disabled={isProcessing}>
                Back to Home
              </Button>
            </div>
          </div>
        );

      case 'syncing':
        return (
          <div className="space-y-8 fade-in text-center">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-8">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <div className="w-8 h-0.5 bg-primary"></div>
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <div className="w-8 h-0.5 bg-primary"></div>
                <div className="w-3 h-3 rounded-full bg-primary"></div>
              </div>
              <h2 className="text-3xl font-bold mb-2">Setting Up Your Dashboard</h2>
              <p className="text-muted-foreground mb-8">
                We're connecting to your clinic's data and mapping your patients, quotas and
                appointments...
              </p>
            </div>

            <div className="max-w-md mx-auto">
              <div className="text-center mb-4">
                <span className="text-2xl font-bold text-primary">{syncProgress.progress}%</span>
              </div>

              <div className="w-full bg-muted rounded-full h-2 mb-6">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${syncProgress.progress}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                {syncProgress.message}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Current stage: {syncProgress.currentStage}
              </p>
            </div>

            <Button variant="outline" onClick={handleSkip} disabled={isProcessing}>
              Back to Home
            </Button>
          </div>
        );

      case 'tag-config':
        return (
          <div className="space-y-8 fade-in">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h2 className="text-3xl font-bold mb-2">Sync Complete!</h2>
              <p className="text-muted-foreground">
                Now let's configure how to categorize your patients
              </p>
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Configure Patient Tags</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Customize how patients are categorized in your dashboard. These tags help track
                  quota usage.
                </p>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Workers Compensation Tag
                    </label>
                    <Input
                      value={customTags.wc}
                      onChange={(e) => setCustomTags((prev) => ({ ...prev, wc: e.target.value }))}
                      className="mb-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      What do you call Workers Compensation patients in your system?
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">EPC Tag</label>
                    <Input
                      value={customTags.epc}
                      onChange={(e) => setCustomTags((prev) => ({ ...prev, epc: e.target.value }))}
                      className="mb-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      How do you identify EPC patients in your practice?
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveTags} className="px-6" disabled={isSavingTags}>
                    {isSavingTags ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Tags'
                    )}
                  </Button>
                </div>
              </Card>

              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('api')}
                  disabled={isSavingTags}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Sync
                </Button>
              </div>
            </div>
          </div>
        );

      case 'tag-complete':
        return (
          <div className="space-y-8 fade-in">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h2 className="text-3xl font-bold mb-2">Setup Complete!</h2>
              <p className="text-muted-foreground">
                Here's what we found in your {formData.selectedPMS} data
              </p>
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6 text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {syncResults.wcPatients}
                  </div>
                  <div className="text-sm text-muted-foreground">Workers Compensation Patients</div>
                </Card>
                <Card className="p-6 text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">
                    {syncResults.epcPatients}
                  </div>
                  <div className="text-sm text-muted-foreground">EPC Patients</div>
                </Card>
                <Card className="p-6 text-center">
                  <div className="text-4xl font-bold text-purple-600 mb-2">
                    {syncResults.totalAppointments}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Appointments</div>
                </Card>
                <Card className="p-6 text-center">
                  <div className="text-4xl font-bold text-orange-600 mb-2">
                    {syncResults.actionNeededPatients}
                  </div>
                  <div className="text-sm text-muted-foreground">Action Needed Patients</div>
                </Card>
              </div>

              {syncResults.issues && syncResults.issues.length > 0 && (
                <Card className="p-6 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-orange-600" />
                    <h3 className="font-semibold text-orange-800 dark:text-orange-200">
                      Issues Found During Sync
                    </h3>
                  </div>
                  <ul className="space-y-1 text-sm text-orange-700 dark:text-orange-300">
                    {syncResults.issues.map((issue, index) => (
                      <li key={index}>• {issue}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-3">
                    These issues won't affect your dashboard functionality, but you may want to
                    review them.
                  </p>
                </Card>
              )}

              <div className="flex justify-center">
                <Button
                  variant="default"
                  size="lg"
                  onClick={handleCompleteOnboarding}
                  disabled={isProcessing || isLoading || isCompleting}
                >
                  {isCompleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    'Continue to Dashboard'
                  )}
                  {!isCompleting && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-5xl">{renderStep()}</div>

      {/* Other PMS Popup */}
      <Dialog open={showOtherPopup} onOpenChange={setShowOtherPopup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Manual Setup Required
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Settings className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Custom Practice Management Software</h3>
              <p className="text-sm text-muted-foreground">
                Our team will reach out to you to set up your custom integration. Please provide
                your software details below.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Management Software Name</label>
                <Input
                  placeholder="e.g., MyClinic Pro, PracticeMax, etc."
                  value={otherPMSData.softwareName}
                  onChange={(e) =>
                    setOtherPMSData({ ...otherPMSData, softwareName: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Software URL</label>
                <Input
                  type="url"
                  placeholder="https://your-software.com"
                  value={otherPMSData.softwareUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    setOtherPMSData({ ...otherPMSData, softwareUrl: url });
                    // Clear error when user starts typing
                    if (websiteError) {
                      setWebsiteError('');
                    }
                  }}
                  onBlur={(e) => {
                    // Validate on blur if there's a value
                    if (e.target.value.trim()) {
                      validateWebsiteUrl(e.target.value);
                    }
                  }}
                  className={`text-sm ${websiteError ? 'border-red-500 focus:border-red-500' : ''}`}
                />
                {websiteError ? (
                  <p className="text-xs text-red-500 mt-1">{websiteError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the URL where your software is hosted
                  </p>
                )}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-2">What happens next?</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Our team will review your software details</li>
                <li>• We'll reach out to you to discuss the integration process</li>
                <li>• We'll create a custom integration for your software</li>
                <li>• You'll receive an email confirmation once ready</li>
                <li>• Your dashboard will be set up automatically</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleOtherPMSCancel} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleOtherPMSSubmit}
                className="flex-1"
                disabled={
                  !otherPMSData.softwareName.trim() ||
                  !otherPMSData.softwareUrl.trim() ||
                  !!websiteError ||
                  isProcessing
                }
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Request
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
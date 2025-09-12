'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { VideoPlayer } from '@/components/ui/video-player';
import { MultiTagInput } from '@/components/ui/multi-tag-input';
import {
  ArrowRight,
  ArrowLeft,
  Shield,
  Loader2,
  CheckCircle,
  Settings,
  ExternalLink,
  Clock,
  Copy,
  Eye,
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
  overduePatients?: number;
  issues?: string[];
  customTags?: {
    wc: string[];
    epc: string[];
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
    phoneNumber: '',
  });
  const [phoneError, setPhoneError] = useState('');
  const [syncResults, setSyncResults] = useState<SyncResults>({
    wcPatients: 0,
    epcPatients: 0,
    totalAppointments: 0,
    actionNeededPatients: 0,
    issues: [],
    customTags: {
      wc: ['WC'],
      epc: ['EPC'],
    },
  });

  const [customTags, setCustomTags] = useState({
    wc: ['WC'],
    epc: ['EPC'],
  });

  // Function to get appropriate syncing subtext based on progress percentage
  const getSyncingSubtext = (progress: number): string => {
    if (progress >= 40 && progress < 60) {
      return 'Securely syncing with your booking system to prepare your live dashboard.';
    } else if (progress >= 60 && progress < 75) {
      return 'Setting up your patient overview and session tracking — securely and automatically.';
    } else if (progress >= 75 && progress < 90) {
      return 'Loading your dashboard — your data stays private and read-only.';
    } else {
      return 'Securely syncing with your booking system to prepare your live dashboard.';
    }
  };

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
            wc: Array.isArray(userTags.wc) ? userTags.wc : [userTags.wc || 'WC'],
            epc: Array.isArray(userTags.epc) ? userTags.epc : [userTags.epc || 'EPC'],
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

  const validatePhoneNumber = (phone: string): boolean => {
    // Basic phone number validation - allow various formats
    const phonePattern = /^[\+]?[\d\s\-\(\)]{10,}$/;
    if (!phonePattern.test(phone)) {
      setPhoneError('Please enter a valid phone number (at least 10 digits)');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handlePMSSelect = (pms: string) => {
    if (pms === 'Other') {
      setShowOtherPopup(true);
    } else {
      setFormData({ ...formData, selectedPMS: pms });
    }
  };

  const handleOtherPMSSubmit = async () => {
    if (!otherPMSData.softwareName.trim() || !otherPMSData.phoneNumber.trim()) {
      toast.error('Please fill in both software name and phone number');
      return;
    }

    // Validate phone number
    if (!validatePhoneNumber(otherPMSData.phoneNumber)) {
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
          phoneNumber: otherPMSData.phoneNumber,
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
      setOtherPMSData({ softwareName: '', phoneNumber: '' });

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
    setOtherPMSData({ softwareName: '', phoneNumber: '' });
    setPhoneError('');
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
              overduePatients: responseData.overduePatientsCount || 0,
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
        overduePatients: result.overduePatientsCount || 0,
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

      // Validate that at least one tag is provided for each category
      if (!customTags.wc.length || !customTags.epc.length) {
        toast.error('Please add at least one tag for both WC and EPC categories');
        return;
      }

      // Get the access token from auth context
      const token = getAccessToken();

      if (!token) {
        toast.error('Authentication token not found. Please try logging in again.');
        return;
      }

      const response = await authenticatedFetch('/api/user/update-tags', {
        method: 'POST',
        body: JSON.stringify({
          wcTags: customTags.wc,
          epcTags: customTags.epc,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update tags');
      }

      const result = await response.json();
      console.log('Tags API response:', result);

      // Update the sync results with new counts
      // The API returns counts for WC and EPC patients
      setSyncResults((prev) => ({
        ...prev,
        wcPatients: result.newCounts.wcPatients || 0,
        epcPatients: result.newCounts.epcPatients || 0,
        totalAppointments: result.newCounts.totalAppointments || 0,
        actionNeededPatients: result.newCounts.actionNeededPatients || 0,
        overduePatients: result.newCounts.overduePatientsCount || 0,
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
        const getVideoInfo = (pms: string) => {
          switch (pms.toLowerCase()) {
            case 'cliniko':
              return {
                videoId: 'mnOw1RxSBlY',
                title: 'How to get your Cliniko API key',
                duration: '2 min',
              };
            case 'nookal':
              return {
                videoId: 'GY3lWkzGgrg',
                title: 'How to get your Nookal API key',
                duration: '2 min',
              };
            default:
              return null;
          }
        };

        const videoInfo = getVideoInfo(formData.selectedPMS);

        return (
          <div className="min-h-screen bg-background">
            <div className="container mx-auto px-6 py-8">
              <div className="space-y-8 fade-in">
                {/* Header */}
                <div className="text-center pt-4 pb-4 max-w-xl mx-auto px-6">
                  {/* Step Progress Indicator */}
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                    <div className="w-8 h-0.5 bg-primary"></div>
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                    <div className="w-8 h-0.5 bg-muted"></div>
                    <div className="w-3 h-3 rounded-full bg-muted"></div>
                  </div>

                  <div className="inline-flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full text-xs font-medium text-primary mb-2">
                    <Clock className="h-3 w-3" />
                    One-time setup
                  </div>
                  <h1 className="text-xl font-bold mb-2">
                    Get Your {formData.selectedPMS} API Key
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Paste your API key to securely link your practice data. An API key is like a
                    special password that lets apps talk to each other safely. It's much safer than
                    using your {formData.selectedPMS} username and password because it only allows
                    specific data access and can be revoked anytime without changing your main
                    login.
                  </p>
                </div>

                {/* Main Content */}
                <div className="max-w-5xl mx-auto px-6 pb-8">
                  <div className="grid lg:grid-cols-2 gap-6 items-start">
                    {/* Left Column - Steps */}
                    <div className="space-y-6">
                      {/* Step Progress Bar */}
                      <Card className="p-3">
                        <h3 className="font-medium mb-3 text-xs">Follow these steps:</h3>
                        <div className="space-y-2">
                          {(() => {
                            const steps =
                              formData.selectedPMS === 'Cliniko'
                                ? [
                                    {
                                      step: '1',
                                      title: 'Go to My Info',
                                      desc: 'Click small arrow next to your name (bottom left)',
                                    },
                                    { step: '2', title: 'Scroll down', desc: 'Enable API Keys' },
                                    {
                                      step: '3',
                                      title: 'Save changes',
                                      desc: 'Click Save Changes',
                                    },
                                    {
                                      step: '4',
                                      title: 'Click manage API keys',
                                      desc: 'Then manage API keys',
                                    },
                                    {
                                      step: '5',
                                      title: 'Create new API key',
                                      desc: 'Click Create new API key',
                                    },
                                    { step: '6', title: 'Name the key', desc: 'MyPhysioFlow' },
                                    {
                                      step: '7',
                                      title: 'Copy and paste',
                                      desc: 'Copy key to MyPhysioFlow',
                                    },
                                  ]
                                : [
                                    {
                                      step: '1',
                                      title: 'Log in to Nookal',
                                      desc: 'Use your usual clinic login',
                                    },
                                    {
                                      step: '2',
                                      title: 'Go to Setup',
                                      desc: 'Gear icon in top menu - opens clinic settings',
                                    },
                                    {
                                      step: '3',
                                      title: 'Click Connections',
                                      desc: 'In left sidebar, then select API Keys',
                                    },
                                    {
                                      step: '4',
                                      title: 'Generate new key',
                                      desc: 'Click + Generate API Key',
                                    },
                                    {
                                      step: '5',
                                      title: 'Select locations',
                                      desc: 'Choose your clinic locations',
                                    },
                                    {
                                      step: '6',
                                      title: 'Leave unchecked',
                                      desc: 'Clinical Notes/Invoices/Documents',
                                    },
                                    {
                                      step: '7',
                                      title: 'Save changes',
                                      desc: 'Click Save Changes',
                                    },
                                    {
                                      step: '8',
                                      title: 'Copy API key',
                                      desc: 'Copy for the key text box',
                                    },
                                    {
                                      step: '9',
                                      title: 'Paste in MyPhysioFlow',
                                      desc: 'Connect Securely screen & click Connect',
                                    },
                                  ];
                            return steps.map((item, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30 transition-colors"
                              >
                                <div className="w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                                  {item.step}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-xs">{item.title}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {item.desc}
                                  </div>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </Card>

                      {/* Quick Access Button */}
                      <Button variant="outline" size="default" className="w-full text-sm" asChild>
                        <a
                          href={`https://${formData.selectedPMS.toLowerCase()}.com/docs/api`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open {formData.selectedPMS} Settings
                        </a>
                      </Button>
                    </div>

                    {/* Right Column - Video & API Input */}
                    <div className="space-y-5">
                      {/* Video Player */}
                      {videoInfo && (
                        <VideoPlayer
                          videoId={videoInfo.videoId}
                          title={videoInfo.title}
                          duration={videoInfo.duration}
                          className="w-full"
                        />
                      )}

                      {/* API Key Input */}
                      <Card className="p-4">
                        <div className="space-y-3">
                          <div className="text-center">
                            <h3 className="font-medium mb-2 text-sm">Step 2: Paste Your API Key</h3>
                            <p className="text-xs text-muted-foreground">
                              An API key is like a secure password that lets MyPhysioFlow safely
                              read your {formData.selectedPMS} data. Copy it from step 1 and paste
                              it here.
                            </p>
                          </div>

                          <div className="space-y-3">
                            <div className="relative">
                              <Input
                                type="text"
                                placeholder="ck_1234abcd5678..."
                                value={formData.apiKey}
                                onChange={(e) =>
                                  setFormData({ ...formData, apiKey: e.target.value })
                                }
                                className="font-mono text-xs h-10 pr-16"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1 h-8 px-2 text-xs"
                                onClick={async () => {
                                  try {
                                    const text = await navigator.clipboard.readText();
                                    setFormData({ ...formData, apiKey: text.trim() });
                                  } catch (err) {
                                    console.error('Failed to read clipboard:', err);
                                  }
                                }}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Paste
                              </Button>
                            </div>

                            <Button
                              variant="default"
                              size="default"
                              className="w-full bg-black hover:bg-gray-800 text-white text-sm h-10"
                              onClick={handleConnectAndSync}
                              disabled={!formData.apiKey.trim() || isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Shield className="mr-2 h-3 w-3" />
                                  Connect Securely
                                </>
                              )}
                            </Button>

                            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                              <Shield className="h-3 w-3 text-green-500" />
                              API keys are like a permission slip - we get read-only access only
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>

                  {/* Reassurance Section */}
                  <div className="mt-12 pt-6 border-t">
                    <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                          <Shield className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">Encrypted & Secure</h4>
                          <p className="text-xs text-muted-foreground">
                            Your data is protected with enterprise-grade encryption
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                          <Eye className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">Read-only Access</h4>
                          <p className="text-xs text-muted-foreground">
                            We can only view your data, never edit or delete anything
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
                          <Clock className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">Done in 2 Minutes</h4>
                          <p className="text-xs text-muted-foreground">
                            Most clinics complete this setup in under 2 minutes
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FAQ Section */}
                  <div className="mt-10 max-w-2xl mx-auto">
                    <h3 className="font-medium text-center mb-4 text-sm">
                      Frequently Asked Questions
                    </h3>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="item-1">
                        <AccordionTrigger>What is an API key?</AccordionTrigger>
                        <AccordionContent>
                          An API key is like a secure password that allows MyPhysioFlow to read data
                          from your {formData.selectedPMS} account. It's completely safe and gives
                          us read-only access - we can see your data but never change or delete
                          anything.
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-2">
                        <AccordionTrigger>Is this safe?</AccordionTrigger>
                        <AccordionContent>
                          Absolutely! API keys are the industry standard for secure data access. We
                          use enterprise-grade encryption and only get read-only permissions. Your
                          patient data stays 100% private and secure in your {formData.selectedPMS}{' '}
                          account.
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-3">
                        <AccordionTrigger>
                          Why can't you just log in with my username/password?
                        </AccordionTrigger>
                        <AccordionContent>
                          API keys are much safer than passwords! They can be revoked instantly if
                          needed, give limited permissions (read-only), and follow security best
                          practices. This way, you maintain full control over your account.
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-4">
                        <AccordionTrigger>What if I get stuck?</AccordionTrigger>
                        <AccordionContent>
                          No worries! Watch the video tutorial above, or contact our support team.
                          We're here to help you get connected quickly and easily. Most issues are
                          resolved in just a few minutes.
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </div>
              </div>
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
                {getSyncingSubtext(syncProgress.progress)}
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
                  quota usage. You can add multiple variations or keep just one - it's up to you!
                </p>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <MultiTagInput
                    tags={customTags.wc}
                    onTagsChange={(tags) => setCustomTags((prev) => ({ ...prev, wc: tags }))}
                    label="Workers Compensation Tags"
                    placeholder="Type and press Enter to add tags (e.g., WC, Workers Comp, W/C)"
                    description="Add variations you use for Workers Compensation patients (optional - you can keep just one)"
                    maxTags={5}
                  />
                  <MultiTagInput
                    tags={customTags.epc}
                    onTagsChange={(tags) => setCustomTags((prev) => ({ ...prev, epc: tags }))}
                    label="EPC Tags"
                    placeholder="Type and press Enter to add tags (e.g., EPC, Enhanced Primary Care)"
                    description="Add variations you use for EPC patients (optional - you can keep just one)"
                    maxTags={5}
                  />
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
              <div className="grid md:grid-cols-4 gap-6">
                <Card className="p-6 text-center bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/30 border-red-200 dark:border-red-800">
                  <div className="text-3xl font-bold text-red-700 dark:text-red-300 mb-2">
                    {syncResults.overduePatients || 0}
                  </div>
                  <div className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">
                    Overdue Patients
                  </div>
                  <div className="text-xs text-red-500 dark:text-red-500">
                    Urgent action required
                  </div>
                </Card>

                <Card className="p-6 text-center bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border-orange-200 dark:border-orange-800">
                  <div className="text-3xl font-bold text-orange-700 dark:text-orange-300 mb-2">
                    {syncResults.actionNeededPatients}
                  </div>
                  <div className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-1">
                    Action Needed
                  </div>
                  <div className="text-xs text-orange-500 dark:text-orange-500">
                    Approaching quota limits
                  </div>
                </Card>

                <Card className="p-6 text-center bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 border-green-200 dark:border-green-800">
                  <div className="text-3xl font-bold text-green-700 dark:text-green-300 mb-2">
                    {syncResults.epcPatients}
                  </div>
                  <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                    EPC Patients
                  </div>
                  <div className="text-xs text-green-500 dark:text-green-500">
                    Active care plans tracked
                  </div>
                </Card>

                <Card className="p-6 text-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
                  <div className="text-3xl font-bold text-blue-700 dark:text-blue-300 mb-2">
                    {syncResults.wcPatients}
                  </div>
                  <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                    Workers Comp
                  </div>
                  <div className="text-xs text-blue-500 dark:text-blue-500">
                    Ready for quota tracking
                  </div>
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

              <div className="text-center mt-8">
                <p className="text-muted-foreground mb-6">
                  Your practice data has been successfully synced and analyzed. You're ready to
                  start tracking your quota compliance!
                </p>

                <Button
                  variant="default"
                  size="lg"
                  onClick={handleCompleteOnboarding}
                  disabled={isProcessing || isLoading || isCompleting}
                  className="bg-black hover:bg-gray-800 text-white"
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
                Our team will reach out to you to set up your custom integration within 3 hours for
                the same price. Please provide your software details below.
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
                <label className="text-sm font-medium mb-2 block">Phone Number</label>
                <Input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={otherPMSData.phoneNumber}
                  onChange={(e) => {
                    const phone = e.target.value;
                    setOtherPMSData({ ...otherPMSData, phoneNumber: phone });
                    // Clear error when user starts typing
                    if (phoneError) {
                      setPhoneError('');
                    }
                  }}
                  onBlur={(e) => {
                    // Validate on blur if there's a value
                    if (e.target.value.trim()) {
                      validatePhoneNumber(e.target.value);
                    }
                  }}
                  className={`text-sm ${phoneError ? 'border-red-500 focus:border-red-500' : ''}`}
                />
                {phoneError ? (
                  <p className="text-xs text-red-500 mt-1">{phoneError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    We'll call you to discuss the integration details
                  </p>
                )}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-2">What happens next?</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Our team will review your software details</li>
                <li>• We'll call you within 3 hours to discuss the integration process</li>
                <li>• We'll create a custom integration for your software at the same price</li>
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
                  !otherPMSData.phoneNumber.trim() ||
                  !!phoneError ||
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

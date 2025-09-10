'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Users,
  Bell,
  Clock,
  RefreshCw,
  Settings,
  Filter,
  Send,
  AlertTriangle,
  CheckCircle,
  Search,
  Edit,
  UserX,
  LogOut,
  User,
  Calendar,
  Timer,
  RotateCcw,
  HelpCircle,
  Check,
  X,
  Mail,
  Activity,
  Archive,
  TrendingUp,
  Plus,
  SlidersHorizontal,
  ChevronDown,
  Crown,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { QuotaEditModal } from './quota-edit-modal';
import AlertSettings from './alert-settings';

interface DashboardProps {
  onNavigate?: (view: 'settings' | 'onboarding') => void;
}

const Dashboard = ({ onNavigate }: DashboardProps) => {
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const route = useRouter();
  const [isSync, setIsSync] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedPhysio, setSelectedPhysio] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedPractitioner, setSelectedPractitioner] = useState('all');
  const [practitionerOptions, setPractitionerOptions] = useState([]);
  const [physioPopoverOpen, setPhysioPopoverOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all-patients');
  const [userSubscription, setUserSubscription] = useState<{
    subscription_status: string;
    trial_ends_at: string;
    daysRemaining: number;
  } | null>({
    subscription_status: 'trial', // Default to trial to prevent premium access during loading
    trial_ends_at: '',
    daysRemaining: 0,
  });
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [showApiHelp, setShowApiHelp] = useState(false);
  const [showPendingReason, setShowPendingReason] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [clientsData, setClientsData] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Modal states for patient actions
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  // Loading states for action buttons
  const [loadingActions, setLoadingActions] = useState<{ [key: string]: boolean }>({});

  const [archivedClients, setArchivedClients] = useState([]);

  const [kpiData, setKpiData] = useState([
    {
      label: 'Active Patients',
      value: '0',
      icon: Users,
      color: 'text-primary',
    },
    {
      label: 'Sessions Remaining (All)',
      value: '0',
      icon: Clock,
      color: 'text-primary',
    },
    {
      label: 'Patients Needing Action',
      value: '0',
      icon: Bell,
      color: 'text-warning',
    },
    {
      label: 'Last Sync Status',
      value: 'Never',
      icon: CheckCircle,
      color: 'text-success',
    },
  ]);
  const handleSignOut = () => {
    localStorage.clear();
    setTimeout(() => {
      // route.push("/");
      window.location.reload();
    }, 800);
  };

  // Patient action handlers
  const handleUpdateQuota = (patient: any) => {
    setSelectedPatient(patient);
    setShowQuotaModal(true);
  };

  const handleMoveToPending = async (patient: any) => {
    const actionKey = `pending_${patient.id}`;
    setLoadingActions((prev) => ({ ...prev, [actionKey]: true }));

    try {
      const response = await fetch('/api/cases/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth-token')}`,
        },
        body: JSON.stringify({
          caseId: patient.id,
          action: 'move_to_pending',
          newData: { reason: 'Moved to pending' },
        }),
      });

      if (response.ok) {
        toast({
          title: 'Patient Moved to Pending',
          description: `${patient.name} has been moved to pending status`,
        });

        // Add a small delay to ensure the database update is complete
        setTimeout(() => {
          fetchDashboardData(); // Refresh data
        }, 500);
      } else {
        throw new Error('Failed to move patient to pending');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to move patient to pending',
        variant: 'destructive',
      });
    } finally {
      setLoadingActions((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleMoveBackToActive = async (caseId: string, patientName: string) => {
    const actionKey = `active_${caseId}`;
    setLoadingActions((prev) => ({ ...prev, [actionKey]: true }));

    try {
      const response = await fetch('/api/cases/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth-token')}`,
        },
        body: JSON.stringify({
          caseId,
          action: 'move_to_active',
          newData: { reason: 'Moved back to active' },
        }),
      });

      if (response.ok) {
        toast({
          title: 'Case Activated',
          description: `${patientName} has been moved back to active status`,
        });

        // Add a small delay to ensure the database update is complete
        setTimeout(() => {
          fetchDashboardData(); // Refresh data
        }, 500);
      } else {
        throw new Error('Failed to update case status');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update case status',
        variant: 'destructive',
      });
    } finally {
      setLoadingActions((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleDischarge = async (caseId: string, patientName: string) => {
    const actionKey = `discharge_${caseId}`;
    setLoadingActions((prev) => ({ ...prev, [actionKey]: true }));

    try {
      const response = await fetch('/api/cases/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth-token')}`,
        },
        body: JSON.stringify({
          caseId,
          action: 'archive_case',
          newData: { reason: 'Case closed' },
        }),
      });

      if (response.ok) {
        toast({
          title: 'Case Closed',
          description: `${patientName} has been moved to archived`,
        });

        // Add a small delay to ensure the database update is complete
        setTimeout(() => {
          fetchDashboardData(); // Refresh data
        }, 500);
      } else {
        const errorData = await response.json();
        throw new Error(`Failed to close case: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to close case',
        variant: 'destructive',
      });
    } finally {
      setLoadingActions((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleQuotaUpdate = async (data: {
    quota: number;
    sessionsUsed: number;
    reason: string;
  }) => {
    if (!selectedPatient) return;

    const actionKey = `quota_${selectedPatient.id}`;
    setLoadingActions((prev) => ({ ...prev, [actionKey]: true }));

    try {
      const response = await fetch('/api/cases/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth-token')}`,
        },
        body: JSON.stringify({
          caseId: selectedPatient.id,
          action: 'update_quota',
          newData: data,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Quota Updated',
          description: `Quota updated for ${selectedPatient.name}`,
        });

        // Add a small delay to ensure the database update is complete
        setTimeout(() => {
          fetchDashboardData(); // Refresh data
        }, 500);
      } else {
        throw new Error('Failed to update quota');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update quota',
        variant: 'destructive',
      });
    } finally {
      setLoadingActions((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  // Fetch user subscription data
  const fetchUserSubscription = async () => {
    try {
      const accessToken = localStorage.getItem('auth-token');
      if (!accessToken) return;

      const response = await fetch('/api/user/profile', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          const trialEndDate = new Date(data.user.trial_ends_at);
          const currentDate = new Date();
          const timeDiff = trialEndDate.getTime() - currentDate.getTime();
          const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

          setUserSubscription({
            subscription_status: data.user.subscription_status,
            trial_ends_at: data.user.trial_ends_at,
            daysRemaining: Math.max(0, daysRemaining), // Don't show negative days
          });
          setSubscriptionLoaded(true);
        }
      }
    } catch (error) {
      console.error('Error fetching user subscription:', error);
    }
  };

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setIsLoadingData(true);
      setDataError(null);

      // Get token from localStorage
      const accessToken = localStorage.getItem('auth-token');
      if (!accessToken) {
        setDataError('Authentication token not found. Please log in again.');
        return;
      }

      // Build URL with practitioner filter
      const url = new URL('/api/dashboard-data', window.location.origin);
      if (selectedPractitioner && selectedPractitioner !== 'all') {
        url.searchParams.set('practitioner', selectedPractitioner);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();

      if (data.success) {
        // Separate active and archived patients
        const activePatients = data.patients.filter(
          (patient: any) => patient.status !== 'archived'
        );
        const archivedPatients = data.patients.filter(
          (patient: any) => patient.status === 'archived'
        );

        setClientsData(activePatients);
        setArchivedClients(archivedPatients);

        // Set practitioner options from API response
        if (data.practitionerOptions) {
          setPractitionerOptions(data.practitionerOptions);
        }

        // Update KPI data
        setKpiData([
          {
            label: 'Active Patients',
            value: activePatients.length.toString(),
            icon: Users,
            color: 'text-primary',
          },
          {
            label: 'Sessions Remaining (All)',
            value: data.kpiData.totalSessionsRemaining.toString(),
            icon: Clock,
            color: 'text-primary',
          },
          {
            label: 'Patients Needing Action',
            value: data.kpiData.actionNeededPatients.toString(),
            icon: Bell,
            color: 'text-warning',
          },
          {
            label: 'Last Sync Status',
            value: 'Just synced',
            icon: CheckCircle,
            color: 'text-success',
          },
        ]);

        if (activePatients.length > 0 || archivedPatients.length > 0) {
          toast({
            title: 'Data Updated',
            description: `Successfully loaded ${activePatients.length} active and ${archivedPatients.length} archived patients`,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setDataError('Failed to load dashboard data. Please try again.');
      toast({
        title: 'Data Fetch Error',
        description: 'Failed to load dashboard data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchDashboardData();
    fetchUserSubscription();
  }, []);

  // Refresh data when practitioner filter changes
  useEffect(() => {
    fetchDashboardData();
  }, [selectedPractitioner]);

  const handleSync = async () => {
    setIsSync(true);
    try {
      // Get token from localStorage
      const accessToken = localStorage.getItem('auth-token');
      if (!accessToken) {
        toast({
          title: 'Authentication Error',
          description: 'Please log in again to sync data.',
          variant: 'destructive',
        });
        return;
      }

      // Call the sync engine
      const syncResponse = await fetch('/api/sync/engine', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!syncResponse.ok) {
        const errorData = await syncResponse.json();

        if (syncResponse.status === 402 && errorData.dashboardLocked) {
          toast({
            title: 'Trial Expired',
            description: 'Please upgrade your subscription to continue syncing data.',
            variant: 'destructive',
          });
          return;
        }

        throw new Error(errorData.error || 'Sync failed');
      }

      const syncResult = await syncResponse.json();

      if (syncResult.success) {
        // Refresh dashboard data after successful sync
        await fetchDashboardData();

        const syncTime = new Date().toLocaleString();
        localStorage.setItem('last_sync', syncTime);

        toast({
          title: 'Sync Completed Successfully',
          description: `Processed ${syncResult.patientsProcessed} patients, ${syncResult.appointmentsSynced} appointments. ${syncResult.actionNeededCount} patients need action.`,
        });
      } else {
        throw new Error(syncResult.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to sync data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSync(false);
    }
  };

  const handleSendReminder = (clientName: string) => {
    toast({
      title: 'Reminder Sent',
      description: `Reminder sent to ${clientName}'s email`,
    });
  };

  const handleBulkReminders = () => {
    const selectedNames = clientsData
      .filter((client) => selectedClients.includes(client.id))
      .map((client) => client.name);

    toast({
      title: `Reminders Sent`,
      description: `Bulk reminders sent to ${selectedNames.length} patients`,
    });
    setSelectedClients([]);
  };

  const handleClientSelection = (clientId: number, checked: boolean) => {
    if (checked) {
      setSelectedClients((prev) => [...prev, clientId]);
    } else {
      setSelectedClients((prev) => prev.filter((id) => id !== clientId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClients(filteredClients.map((client) => client.id));
    } else {
      setSelectedClients([]);
    }
  };

  const getProgressBarColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'bg-destructive';
      case 'warning':
        return 'bg-warning';
      case 'pending':
        return 'bg-gradient-to-r from-blue-400 to-cyan-400';
      default:
        return 'bg-primary';
    }
  };

  const getProgressPercentage = (used: number, total: number) => {
    return (used / total) * 100;
  };

  const getProgramBadgeClass = (program: string) => {
    switch (program?.toLowerCase()) {
      case 'epc':
        return 'program-badge-epc';
      case 'wc':
        return 'program-badge-workcover';
      case 'ctp':
        return 'program-badge-ctp';
      case "workers' compensation":
        return 'program-badge-workcover';
      default:
        return 'program-badge-epc';
    }
  };

  const getUniquePhysios = () => {
    const allPhysios = [...clientsData, ...archivedClients]
      .map((client) => client.physio)
      .filter((physio) => physio !== null && physio !== undefined); // Filter out null/undefined values
    return [...new Set(allPhysios)];
  };

  const getUniqueLocations = () => {
    const allLocations = [...clientsData, ...archivedClients].map((client) => client.location);
    return [...new Set(allLocations)];
  };

  const getFilteredClients = (tabFilter: string) => {
    let baseClients = [];

    switch (tabFilter) {
      case 'all-patients':
        baseClients = clientsData;
        break;
      case 'action-needed':
        baseClients = clientsData.filter(
          (client) => client.status === 'warning' && client.remainingSessions <= 2
        );
        break;
      case 'pending':
        baseClients = clientsData.filter((client) => client.status === 'pending');
        break;
      case 'overdue':
        baseClients = clientsData.filter((client) => {
          // Check if patient has exceeded their quota
          const sessionsUsed = parseInt(client.sessionsUsed) || 0;
          const quota = parseInt(client.quota) || 0;
          return sessionsUsed > quota;
        });
        break;
      case 'archived':
        baseClients = archivedClients;
        break;
      default:
        baseClients = clientsData;
    }

    return baseClients.filter((client) => {
      const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProgram =
        selectedFilter === 'all' || client.program?.toLowerCase() === selectedFilter.toLowerCase();
      const matchesPhysio = selectedPhysio === 'all' || client.physio === selectedPhysio;
      const matchesLocation = selectedLocation === 'all' || client.location === selectedLocation;

      return matchesSearch && matchesProgram && matchesPhysio && matchesLocation;
    });
  };

  const filteredClients = getFilteredClients(activeTab);

  const renderClientList = (tabType: string) => {
    const clients = getFilteredClients(tabType);

    return (
      <div className="space-y-6">
        {/* Bulk Actions */}
        {selectedClients.length > 0 && (
          <div className="p-6 bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/20 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Check className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="font-semibold text-lg">
                    {selectedClients.length} patients selected
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Choose an action to apply to selected patients
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleBulkReminders}
                  className="gap-2 h-12 px-6 hover:bg-primary/10 hover:border-primary/50"
                >
                  <Mail className="h-5 w-5" />
                  Send Bulk Reminders
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setSelectedClients([])}
                  className="h-12 px-4"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Select All Header */}
        {clients.length > 0 && (
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/40">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedClients.length === clients.length && clients.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedClients(clients.map((client) => client.id));
                  } else {
                    setSelectedClients([]);
                  }
                }}
              />
              <span className="text-base font-medium text-foreground">
                Select All ({clients.length} patients)
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Showing {clients.length} of{' '}
              {tabType === 'archived' ? archivedClients.length : clientsData.length} total
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoadingData && (
          <div className="text-center py-20 space-y-6">
            <div className="w-32 h-32 bg-gradient-to-br from-muted/20 to-muted/40 rounded-3xl flex items-center justify-center mx-auto">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold text-foreground">Loading patients...</h3>
              <p className="text-muted-foreground text-lg">Fetching data from your PMS system</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {dataError && !isLoadingData && (
          <div className="text-center py-20 space-y-6">
            <div className="w-32 h-32 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/30 rounded-3xl flex items-center justify-center mx-auto">
              <AlertTriangle className="h-16 w-16 text-red-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold text-foreground">Failed to load data</h3>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">{dataError}</p>
            </div>
            <Button variant="outline" size="lg" onClick={fetchDashboardData} className="gap-2 mt-4">
              <RotateCcw className="h-5 w-5" />
              Try Again
            </Button>
          </div>
        )}

        {/* Client Cards */}
        {!isLoadingData && !dataError && (
          <div className="space-y-6" data-tutorial="patient-cards">
            {clients.map((client, index) => (
              <div
                key={client.id}
                className="group relative overflow-hidden bg-gradient-to-br from-background via-background/95 to-accent/10 border border-border/30 rounded-2xl p-6 hover:shadow-[0_20px_70px_-10px_hsl(var(--primary)_/_0.3)] transition-all duration-700 hover:scale-[1.01] hover:border-primary/40 fade-in-up hover:bg-gradient-to-br hover:from-primary/5 hover:to-secondary/5 w-full"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Decorative gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                <div className="relative grid grid-cols-12 gap-4 items-center w-full">
                  {/* Selection Checkbox */}
                  <div className="col-span-1 flex justify-center">
                    <Checkbox
                      checked={selectedClients.includes(client.id)}
                      onCheckedChange={(checked) =>
                        handleClientSelection(client.id, checked as boolean)
                      }
                      className="w-5 h-5 border-2 border-primary/30 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-primary data-[state=checked]:to-primary/80"
                    />
                  </div>

                  {/* Patient Avatar & Info */}
                  <div className="col-span-3">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-16 h-16 bg-gradient-to-br from-primary/15 via-primary/10 to-secondary/15 rounded-2xl flex items-center justify-center shadow-lg border-2 border-primary/20 group-hover:border-primary/40 transition-all duration-500">
                          <User className="h-8 w-8 text-primary group-hover:text-primary/80 transition-colors duration-300" />
                        </div>
                        <div
                          className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-background shadow-lg ${
                            client.status === 'critical'
                              ? 'bg-gradient-to-br from-red-500 to-red-600'
                              : client.status === 'warning'
                                ? 'bg-gradient-to-br from-amber-500 to-orange-500'
                                : client.status === 'pending'
                                  ? 'bg-gradient-to-br from-blue-500 to-indigo-500'
                                  : 'bg-gradient-to-br from-emerald-500 to-green-500'
                          } flex items-center justify-center`}
                        >
                          {client.status === 'critical' && (
                            <AlertTriangle className="h-3 w-3 text-white" />
                          )}
                          {client.status === 'warning' && <Clock className="h-3 w-3 text-white" />}
                          {client.status === 'pending' && <Timer className="h-3 w-3 text-white" />}
                          {client.status === 'good' && (
                            <CheckCircle className="h-3 w-3 text-white" />
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-all duration-300 truncate">
                            {client.name}
                          </h3>
                          {client.alert && (
                            <Tooltip>
                              <TooltipTrigger>
                                <div
                                  className={`p-1 rounded-full backdrop-blur-sm ${
                                    client.urgency === 'critical'
                                      ? 'bg-red-500/20 animate-pulse border border-red-500/30'
                                      : client.urgency === 'high'
                                        ? 'bg-amber-500/20 border border-amber-500/30'
                                        : 'bg-blue-500/20 border border-blue-500/30'
                                  } hover:scale-110 transition-transform duration-300`}
                                >
                                  <AlertTriangle
                                    className={`h-3 w-3 ${
                                      client.urgency === 'critical'
                                        ? 'text-red-600'
                                        : client.urgency === 'high'
                                          ? 'text-amber-600'
                                          : 'text-blue-600'
                                    }`}
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs bg-gradient-to-r from-background to-accent/20 border border-border/50"
                              >
                                <p className="font-medium text-xs">{client.alert}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-muted-foreground font-medium text-sm">
                            {client.physio}
                          </p>
                          <Badge
                            variant="outline"
                            className={`px-2 py-1 text-xs font-bold border ${
                              client.program === 'EPC'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-700 dark:text-emerald-300'
                                : 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-300'
                            }`}
                          >
                            {client.program}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Section */}
                  <div className="col-span-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Sessions</span>
                        <span className="text-lg font-bold text-foreground">
                          {client.sessionsUsed}/{client.totalSessions}
                        </span>
                      </div>
                      <div className="relative w-full bg-gradient-to-r from-muted/50 to-muted/30 rounded-full h-3 overflow-hidden shadow-inner border border-border/30">
                        <div
                          className={`h-3 rounded-full transition-all duration-[2000ms] ease-out shadow-lg relative overflow-hidden ${
                            client.status === 'critical'
                              ? 'bg-gradient-to-r from-red-500 to-red-600'
                              : client.status === 'warning'
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                                : client.status === 'pending'
                                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                                  : 'bg-gradient-to-r from-emerald-500 to-green-500'
                          }`}
                          style={{
                            width: `${getProgressPercentage(
                              client.sessionsUsed,
                              client.totalSessions
                            )}%`,
                            animationDelay: `${index * 0.1}s`,
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_3s_infinite]"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sessions Remaining */}
                  <div className="col-span-2 text-center">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Sessions Left</p>
                    <div
                      className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl font-bold text-xl shadow-lg border-2 backdrop-blur-sm ${
                        client.remainingSessions <= 2
                          ? 'bg-gradient-to-br from-amber-100/80 to-orange-100/80 text-amber-700 border-amber-300/50 dark:from-amber-950/50 dark:to-orange-950/50 dark:text-amber-300 dark:border-amber-700/50'
                          : 'bg-gradient-to-br from-emerald-100/80 to-green-100/80 text-emerald-700 border-emerald-300/50 dark:from-emerald-950/50 dark:to-green-950/50 dark:text-emerald-300 dark:border-emerald-700/50'
                      } hover:scale-105 transition-transform duration-300`}
                    >
                      {client.remainingSessions}
                    </div>
                  </div>

                  {/* Next Appointment */}
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Last Appointment
                    </p>
                    <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-accent/40 to-secondary/30 rounded-xl border border-border/40 backdrop-blur-sm">
                      <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-bold text-foreground">
                        {client.nextAppointment}
                      </span>
                    </div>
                  </div>

                  {/* 3-Button Actions */}
                  <div className="col-span-1 flex flex-col gap-2">
                    {client.status === 'pending' ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMoveBackToActive(client.id, client.name)}
                          disabled={loadingActions[`active_${client.id}`]}
                          className="justify-center gap-2 h-8 px-3 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-300 text-emerald-700 hover:from-emerald-100 hover:to-green-100 hover:border-emerald-400 text-xs font-medium dark:from-emerald-950/30 dark:to-green-950/30 dark:border-emerald-700 dark:text-emerald-300"
                        >
                          {loadingActions[`active_${client.id}`] ? (
                            <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          {loadingActions[`active_${client.id}`] ? 'Activating...' : 'Active'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateQuota(client)}
                          disabled={loadingActions[`quota_${client.id}`]}
                          className="justify-center gap-2 h-8 px-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-400 text-xs font-medium dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-700 dark:text-blue-300"
                        >
                          {loadingActions[`quota_${client.id}`] ? (
                            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Edit className="h-3 w-3" />
                          )}
                          {loadingActions[`quota_${client.id}`] ? 'Updating...' : 'Edit Quota'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDischarge(client.id, client.name)}
                          disabled={loadingActions[`discharge_${client.id}`]}
                          className="justify-center gap-2 h-8 px-3 bg-gradient-to-r from-red-50 to-rose-50 border border-red-300 text-red-700 hover:from-red-100 hover:to-rose-100 hover:border-red-400 text-xs font-medium dark:from-red-950/30 dark:to-rose-950/30 dark:border-red-700 dark:text-red-300"
                        >
                          {loadingActions[`discharge_${client.id}`] ? (
                            <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <UserX className="h-3 w-3" />
                          )}
                          {loadingActions[`discharge_${client.id}`] ? 'Archiving...' : 'Discharge'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateQuota(client)}
                          disabled={loadingActions[`quota_${client.id}`]}
                          className="justify-center gap-2 h-8 px-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-400 text-xs font-medium dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-700 dark:text-blue-300"
                        >
                          {loadingActions[`quota_${client.id}`] ? (
                            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Edit className="h-3 w-3" />
                          )}
                          {loadingActions[`quota_${client.id}`] ? 'Updating...' : 'Edit Quota'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMoveToPending(client)}
                          disabled={loadingActions[`pending_${client.id}`]}
                          className="justify-center gap-2 h-8 px-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 text-amber-700 hover:from-amber-100 hover:to-orange-100 hover:border-amber-400 text-xs font-medium dark:from-amber-950/30 dark:to-indigo-950/30 dark:border-amber-700 dark:text-amber-300"
                        >
                          {loadingActions[`pending_${client.id}`] ? (
                            <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Timer className="h-3 w-3" />
                          )}
                          {loadingActions[`pending_${client.id}`] ? 'Moving...' : 'Pending'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDischarge(client.id, client.name)}
                          disabled={loadingActions[`discharge_${client.id}`]}
                          className="justify-center gap-2 h-8 px-3 bg-gradient-to-r from-red-50 to-rose-50 border border-red-300 text-red-700 hover:from-red-100 hover:to-rose-100 hover:border-red-400 text-xs font-medium dark:from-red-950/30 dark:to-rose-950/30 dark:border-red-700 dark:text-red-300"
                        >
                          {loadingActions[`discharge_${client.id}`] ? (
                            <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <UserX className="h-3 w-3" />
                          )}
                          {loadingActions[`discharge_${client.id}`] ? 'Archiving...' : 'Discharge'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Enhanced Empty State */}
        {!isLoadingData && !dataError && clients.length === 0 && (
          <div className="text-center py-20 space-y-6">
            <div className="w-32 h-32 bg-gradient-to-br from-muted/20 to-muted/40 rounded-3xl flex items-center justify-center mx-auto">
              <Users className="h-16 w-16 text-muted-foreground/60" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold text-foreground">No patients found</h3>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                {tabType === 'archived'
                  ? 'No archived patients match your current filters.'
                  : "Try adjusting your search terms or filters to find the patients you're looking for."}
              </p>
            </div>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setSearchTerm('');
                setSelectedFilter('all');
                setSelectedPhysio('all');
                setSelectedLocation('all');
                setSelectedPractitioner('all');
              }}
              className="gap-2 mt-4"
            >
              <RotateCcw className="h-5 w-5" />
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-gradient-to-br from-background to-accent">
        {/* Header */}
        <div className="bg-background/95 backdrop-blur-sm border-b border-border/30 sticky top-0 z-50">
          <div className="container mx-auto px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-primary/20 rounded-2xl flex items-center justify-center shadow-sm">
                  <Activity className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">PhysioFlow</h1>
                  <p className="text-muted-foreground text-sm">Welcome back, {user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* <Button
                  variant="outline"
                  size="lg"
                  onClick={handleSync}
                  disabled={isSync}
                  className="gap-2 h-12 px-6 border-border/60 hover:border-primary/60 hover:bg-primary/5"
                >
                  <RefreshCw className={`h-5 w-5 ${isSync ? 'animate-spin' : ''}`} />
                  {isSync ? 'Syncing...' : 'Sync Data'}
                </Button> */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => onNavigate?.('settings')}
                  className="gap-2 h-12 px-6 border-border/60 hover:border-secondary/60 hover:bg-secondary/5"
                >
                  <Settings className="h-5 w-5" />
                  Settings
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={handleSignOut}
                  className="gap-2 h-12 px-4 text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-8 py-10">
          {/* Trial Banner - Only show for trial users */}
          {subscriptionLoaded &&
            userSubscription &&
            userSubscription.subscription_status === 'trial' && (
              <div
                className={`p-6 mb-10 rounded-2xl shadow-sm ${
                  userSubscription.daysRemaining <= 1
                    ? 'bg-gradient-to-r from-red-50 to-red-100 border border-red-200 dark:from-red-950/20 dark:to-red-900/20 dark:border-red-800/30'
                    : userSubscription.daysRemaining <= 3
                      ? 'bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 dark:from-orange-950/20 dark:to-orange-900/20 dark:border-orange-800/30'
                      : 'bg-gradient-to-r from-warning/5 to-warning/10 border border-warning/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-xl ${
                        userSubscription.daysRemaining <= 1
                          ? 'bg-red-100 dark:bg-red-900/30'
                          : userSubscription.daysRemaining <= 3
                            ? 'bg-orange-100 dark:bg-orange-900/30'
                            : 'bg-warning/10'
                      }`}
                    >
                      <AlertTriangle
                        className={`h-5 w-5 ${
                          userSubscription.daysRemaining <= 1
                            ? 'text-red-600 dark:text-red-400'
                            : userSubscription.daysRemaining <= 3
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-warning'
                        }`}
                      />
                    </div>
                    {/* <div>
                      <span className="font-semibold text-foreground">
                        {userSubscription.daysRemaining === 0
                          ? 'Your free trial expires today'
                          : userSubscription.daysRemaining === 1
                            ? '1 day left in your free trial'
                            : `${userSubscription.daysRemaining} days left in your free trial`}
                      </span>
                      <p className="text-sm text-muted-foreground">
                        {userSubscription.daysRemaining <= 1
                          ? 'Upgrade now to avoid service interruption'
                          : 'Unlock unlimited features and advanced analytics'}
                      </p>
                    </div> */}
                  </div>
                  <Button
                    className={`transition-transform hover:scale-105 ${
                      userSubscription.daysRemaining <= 1
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800'
                        : userSubscription.daysRemaining <= 3
                          ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white hover:from-orange-700 hover:to-orange-800'
                          : 'bg-gradient-to-r from-warning to-warning/90 text-warning-foreground'
                    }`}
                    onClick={() => onNavigate?.('settings')}
                  >
                    {userSubscription.daysRemaining <= 1 ? 'Upgrade Now!' : 'Upgrade Now'}
                  </Button>
                </div>
              </div>
            )}

          {/* KPI Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {kpiData.map((kpi, index) => (
              <div
                key={index}
                className="p-8 bg-[#f0ebde] dark:bg-gray-900 border border-border/30 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group cursor-pointer"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-accent to-secondary rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <kpi.icon className={`h-7 w-7 ${kpi.color}`} strokeWidth={1.8} />
                  </div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">{kpi.label}</p>
                  <p className="text-3xl font-bold text-foreground tracking-tight">{kpi.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Full Page Client Overview */}
        <div className="bg-gradient-to-br from-background/80 to-accent/5 min-h-screen">
          {/* Modern Header with Actions */}
          <div className="bg-background/95 backdrop-blur-sm border-b border-border/30 sticky top-0 z-10">
            <div className="container mx-auto px-8 py-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-primary/20 rounded-3xl flex items-center justify-center shadow-sm">
                    <Activity className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-bold text-foreground tracking-tight">
                      Client Overview
                    </h2>
                    <p className="text-muted-foreground text-lg mt-1">
                      Monitor patient progress and session management
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 h-12 px-6 border-border/60 hover:border-primary/60 hover:bg-primary/5"
                  >
                    <Plus className="h-5 w-5" />
                    Add Patient
                  </Button> */}
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 h-12 px-6 border-border/60 hover:border-secondary/60 hover:bg-secondary/5"
                    onClick={() => setShowSettingsModal(true)}
                  >
                    <Settings className="h-5 w-5" />
                    Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Search and Filters Bar */}
          <div className="bg-gradient-to-r from-accent/5 to-secondary/5 border-b border-border/20">
            <div className="container mx-auto px-8 py-6">
              <div className="flex items-center justify-between gap-8">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                  <Input
                    placeholder="Search patients by name..."
                    className="pl-12 h-12 bg-background/80 border-border/60 focus:border-primary/80 text-base"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Filter Controls */}
                <div className="flex items-center gap-6">
                  {/* Program Filter */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">Program:</span>
                    <div className="flex gap-2">
                      <Button
                        variant={selectedFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedFilter('all')}
                        className="h-10 px-4"
                      >
                        All
                      </Button>
                      <Button
                        variant={selectedFilter === 'epc' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedFilter('epc')}
                        className="h-10 px-4"
                      >
                        EPC
                      </Button>
                      <Button
                        variant={selectedFilter === 'wc' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedFilter('wc')}
                        className="h-10 px-4"
                      >
                        WC
                      </Button>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-border/60" />

                  {/* Practitioner Filter - Show if there are practitioner options */}
                  {practitionerOptions.length > 1 && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground">Physio:</span>
                      <Popover open={physioPopoverOpen} onOpenChange={setPhysioPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={physioPopoverOpen}
                            className="w-[200px] h-10 justify-between"
                          >
                            {selectedPractitioner === 'all'
                              ? 'All Physios'
                              : practitionerOptions.find(
                                  (option: any) => option.value === selectedPractitioner
                                )?.label || 'Select Physio'}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0">
                          <Command>
                            <CommandInput placeholder="Search physios..." />
                            <CommandList>
                              <CommandEmpty>No physio found.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="all"
                                  onSelect={() => {
                                    setSelectedPractitioner('all');
                                    setPhysioPopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      selectedPractitioner === 'all' ? 'opacity-100' : 'opacity-0'
                                    }`}
                                  />
                                  All Physios
                                </CommandItem>
                                {practitionerOptions
                                  .filter((option: any) => option.value !== 'all') // Remove duplicate "All" option
                                  .map((option: any) => (
                                    <CommandItem
                                      key={option.value}
                                      value={option.value}
                                      onSelect={() => {
                                        setSelectedPractitioner(option.value);
                                        setPhysioPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${
                                          selectedPractitioner === option.value
                                            ? 'opacity-100'
                                            : 'opacity-0'
                                        }`}
                                      />
                                      {option.label}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {/* Location Filter */}
                  {/* <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">Location:</span>
                    <div className="flex gap-2">
                      <Button
                        variant={selectedLocation === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedLocation('all')}
                        className="h-10 px-4"
                      >
                        All
                      </Button>
                      {getUniqueLocations().map((location) => (
                        <Button
                          key={location}
                          variant={selectedLocation === location ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedLocation(location)}
                          className="h-10 px-4"
                        >
                          {location}
                        </Button>
                      ))}
                    </div>
                  </div> */}
                </div>
              </div>
            </div>

            {/* Modern Tabs Interface */}
            <div className="container mx-auto px-8 py-8">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-5 mb-8 h-14 bg-muted/30 rounded-2xl p-2">
                  <TabsTrigger
                    value="all-patients"
                    className="text-base font-semibold h-10 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Users className="h-5 w-5 mr-2" />
                    All Patients
                    <Badge variant="secondary" className="ml-2">
                      {clientsData.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="action-needed"
                    className="text-base font-semibold h-10 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm relative"
                    disabled={
                      !subscriptionLoaded || userSubscription?.subscription_status === 'trial'
                    }
                  >
                    <Bell className="h-5 w-5 mr-2" />
                    Action Needed
                    <Badge variant="destructive" className="ml-2 animate-pulse">
                      {
                        clientsData.filter(
                          (c) => c.status === 'warning' && c.remainingSessions <= 2
                        ).length
                      }
                    </Badge>
                    {(!subscriptionLoaded || userSubscription?.subscription_status === 'trial') && (
                      <div className="absolute -top-1 -right-1">
                        <Crown className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      </div>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="pending"
                    className="text-base font-semibold h-10 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Timer className="h-5 w-5 mr-2" />
                    Pending
                    <Badge variant="outline" className="ml-2 border-blue-500 text-blue-600">
                      {clientsData.filter((c) => c.status === 'pending').length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="overdue"
                    className="text-base font-semibold h-10 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm relative"
                    disabled={
                      !subscriptionLoaded || userSubscription?.subscription_status === 'trial'
                    }
                  >
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    Overdue
                    <Badge variant="destructive" className="ml-2">
                      {
                        clientsData.filter((c) => {
                          // Check if patient has exceeded their quota
                          const sessionsUsed = parseInt(c.sessionsUsed) || 0;
                          const quota = parseInt(c.quota) || 0;
                          return sessionsUsed > quota;
                        }).length
                      }
                    </Badge>
                    {(!subscriptionLoaded || userSubscription?.subscription_status === 'trial') && (
                      <div className="absolute -top-1 -right-1">
                        <Crown className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      </div>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="archived"
                    className="text-base font-semibold h-10 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Archive className="h-5 w-5 mr-2" />
                    Archived
                    <Badge variant="outline" className="ml-2">
                      {archivedClients.length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>

                {/* Shared Content for All Tabs */}
                <TabsContent value="all-patients" className="mt-0">
                  {renderClientList('all-patients')}
                </TabsContent>

                <TabsContent value="action-needed" className="mt-0">
                  {renderClientList('action-needed')}
                </TabsContent>

                <TabsContent value="pending" className="mt-0">
                  {renderClientList('pending')}
                </TabsContent>

                <TabsContent value="overdue" className="mt-0">
                  {renderClientList('overdue')}
                </TabsContent>

                <TabsContent value="archived" className="mt-0">
                  {renderClientList('archived')}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>

      {/* Patient Action Modals */}
      {selectedPatient && (
        <>
          <QuotaEditModal
            isOpen={showQuotaModal}
            onClose={() => {
              setShowQuotaModal(false);
              setSelectedPatient(null);
            }}
            patient={selectedPatient}
            onSave={handleQuotaUpdate}
          />
        </>
      )}

      {/* Alert Settings Modal */}
      {showSettingsModal && <AlertSettings onClose={() => setShowSettingsModal(false)} />}
    </TooltipProvider>
  );
};

export default Dashboard;

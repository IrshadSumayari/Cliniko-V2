'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

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
  const [activeTab, setActiveTab] = useState('all-patients');
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [showApiHelp, setShowApiHelp] = useState(false);
  const [showPendingReason, setShowPendingReason] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [clientsData, setClientsData] = useState([
    {
      id: 1,
      name: 'Sarah Mitchell',
      program: 'EPC',
      sessionsUsed: 3,
      totalSessions: 5,
      remainingSessions: 2,
      nextAppointment: '2024-01-25',
      physio: 'Dr. Smith',
      location: 'Main Clinic',
      status: 'warning',
      alert: 'EPC referral expires in 3 days',
      urgency: 'high',
      lastSync: '2 mins ago',
    },
    {
      id: 2,
      name: 'John Davidson',
      program: "Workers' Compensation",
      sessionsUsed: 8,
      totalSessions: 12,
      remainingSessions: 4,
      nextAppointment: '2024-01-26',
      physio: 'Dr. Jones',
      location: 'North Branch',
      status: 'good',
      alert: null,
      urgency: 'low',
      lastSync: '5 mins ago',
    },
    {
      id: 3,
      name: 'Emma Wilson',
      program: "Workers' Compensation",
      sessionsUsed: 1,
      totalSessions: 10,
      remainingSessions: 9,
      nextAppointment: '2024-01-27',
      physio: 'Dr. Brown',
      location: 'South Clinic',
      status: 'pending',
      alert: 'Insurer approval pending',
      urgency: 'medium',
      lastSync: '1 min ago',
    },
    {
      id: 4,
      name: 'Michael Chen',
      program: 'EPC',
      sessionsUsed: 4,
      totalSessions: 5,
      remainingSessions: 1,
      nextAppointment: '2024-01-24',
      physio: 'Dr. Smith',
      location: 'Main Clinic',
      status: 'critical',
      alert: 'Final session - renewal needed immediately',
      urgency: 'critical',
      lastSync: '3 mins ago',
    },
    {
      id: 5,
      name: 'Lisa Taylor',
      program: "Workers' Compensation",
      sessionsUsed: 18,
      totalSessions: 20,
      remainingSessions: 2,
      nextAppointment: '2024-01-28',
      physio: 'Dr. Jones',
      location: 'North Branch',
      status: 'warning',
      alert: 'Pre-approval for additional sessions required',
      urgency: 'medium',
      lastSync: '4 mins ago',
    },
  ]);

  const [archivedClients, setArchivedClients] = useState([]);

  const kpiData = [
    {
      label: 'Active Patients',
      value: '142',
      icon: Users,
      color: 'text-primary',
    },
    {
      label: 'Sessions Remaining (All)',
      value: '1,234',
      icon: Clock,
      color: 'text-primary',
    },
    {
      label: 'Patients Needing Action',
      value: '8',
      icon: Bell,
      color: 'text-warning',
    },
    {
      label: 'Last Sync Status',
      value: '2 min ago',
      icon: CheckCircle,
      color: 'text-success',
    },
  ];
  const handleSignOut = () => {
    localStorage.clear();
    setTimeout(() => {
      // route.push("/");
      window.location.reload();
    }, 800);
  };
  const handleSync = async () => {
    setIsSync(true);
    // Simulate progress animation
    setTimeout(() => {
      const syncTime = new Date().toLocaleString();
      localStorage.setItem('last_sync', syncTime);
      setIsSync(false);
      toast({
        title: 'Sync Completed',
        description: 'Your client data has been updated successfully.',
      });
    }, 2000);
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

  const handleUpdateQuota = (clientName: string) => {
    toast({
      title: 'Quota Updated',
      description: `${clientName}'s quota has been updated successfully`,
    });
  };

  const handleDischarge = (clientId: number, clientName: string) => {
    const clientToArchive = clientsData.find((client) => client.id === clientId);
    if (clientToArchive) {
      setArchivedClients((prev) => [...prev, { ...clientToArchive, status: 'archived' }]);
      setClientsData((prev) => prev.filter((client) => client.id !== clientId));
      toast({
        title: 'Client Discharged',
        description: `${clientName} has been discharged and moved to archived`,
      });
    }
  };

  const handleMoveToPending = (clientId: number, clientName: string) => {
    setClientsData((prev) =>
      prev.map((client) => (client.id === clientId ? { ...client, status: 'pending' } : client))
    );
    toast({
      title: 'Moved to Pending',
      description: `${clientName} moved to pending - no immediate action required`,
    });
  };

  const handleMoveBackToActive = (clientId: number, clientName: string) => {
    setClientsData((prev) =>
      prev.map((client) => (client.id === clientId ? { ...client, status: 'good' } : client))
    );
    toast({
      title: 'Moved Back to Active',
      description: `${clientName} is now back in active status`,
    });
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
    switch (program.toLowerCase()) {
      case 'epc':
        return 'program-badge-epc';
      case 'ctp':
        return 'program-badge-ctp';
      case "workers' compensation":
        return 'program-badge-workcover';
      default:
        return 'program-badge-epc';
    }
  };

  const getUniquePhysios = () => {
    const allPhysios = [...clientsData, ...archivedClients].map((client) => client.physio);
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
          (client) => client.status === 'warning' || client.status === 'critical'
        );
        break;
      case 'pending':
        baseClients = clientsData.filter((client) => client.status === 'pending');
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
        selectedFilter === 'all' || client.program.toLowerCase() === selectedFilter.toLowerCase();
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

        {/* Client Cards */}
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
                        {client.status === 'good' && <CheckCircle className="h-3 w-3 text-white" />}
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
                        <p className="text-muted-foreground font-medium text-sm">{client.physio}</p>
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
                  <p className="text-xs font-medium text-muted-foreground mb-2">Next Visit</p>
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
                        className="justify-center gap-2 h-8 px-3 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-300 text-emerald-700 hover:from-emerald-100 hover:to-green-100 hover:border-emerald-400 text-xs font-medium dark:from-emerald-950/30 dark:to-green-950/30 dark:border-emerald-700 dark:text-emerald-300"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Active
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateQuota(client.name)}
                        className="justify-center gap-2 h-8 px-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-400 text-xs font-medium dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-700 dark:text-blue-300"
                      >
                        <Edit className="h-3 w-3" />
                        Edit Quota
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDischarge(client.id, client.name)}
                        className="justify-center gap-2 h-8 px-3 bg-gradient-to-r from-red-50 to-rose-50 border border-red-300 text-red-700 hover:from-red-100 hover:to-rose-100 hover:border-red-400 text-xs font-medium dark:from-red-950/30 dark:to-rose-950/30 dark:border-red-700 dark:text-red-300"
                      >
                        <UserX className="h-3 w-3" />
                        Discharge
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateQuota(client.name)}
                        className="justify-center gap-2 h-8 px-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-400 text-xs font-medium dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-700 dark:text-blue-300"
                      >
                        <Edit className="h-3 w-3" />
                        Edit Quota
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMoveToPending(client.id, client.name)}
                        className="justify-center gap-2 h-8 px-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 text-amber-700 hover:from-amber-100 hover:to-orange-100 hover:border-amber-400 text-xs font-medium dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-700 dark:text-amber-300"
                      >
                        <Timer className="h-3 w-3" />
                        Pending
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDischarge(client.id, client.name)}
                        className="justify-center gap-2 h-8 px-3 bg-gradient-to-r from-red-50 to-rose-50 border border-red-300 text-red-700 hover:from-red-100 hover:to-rose-100 hover:border-red-400 text-xs font-medium dark:from-red-950/30 dark:to-rose-950/30 dark:border-red-700 dark:text-red-300"
                      >
                        <UserX className="h-3 w-3" />
                        Discharge
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Enhanced Empty State */}
        {clients.length === 0 && (
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
      <div className="min-h-screen bg-gradient-to-br from-background to-accent">
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
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleSync}
                  disabled={isSync}
                  className="gap-2 h-12 px-6 border-border/60 hover:border-primary/60 hover:bg-primary/5"
                >
                  <RefreshCw className={`h-5 w-5 ${isSync ? 'animate-spin' : ''}`} />
                  {isSync ? 'Syncing...' : 'Sync Data'}
                </Button>
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
          {/* Trial Banner */}
          <div className="p-6 mb-10 bg-gradient-to-r from-warning/5 to-warning/10 border border-warning/20 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-warning/10 rounded-xl">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <span className="font-semibold text-foreground">
                    4 days left in your free trial
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Unlock unlimited features and advanced analytics
                  </p>
                </div>
              </div>
              <Button
                className="bg-gradient-to-r from-warning to-warning/90 text-warning-foreground hover:scale-105 transition-transform"
                onClick={() => onNavigate?.('settings')}
              >
                Upgrade Now
              </Button>
            </div>
          </div>

          {/* KPI Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            {kpiData.map((kpi, index) => (
              <div
                key={index}
                className="p-8 bg-gradient-to-br from-background via-background/95 to-accent/10 border border-border/30 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group cursor-pointer"
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
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 h-12 px-6 border-border/60 hover:border-primary/60 hover:bg-primary/5"
                  >
                    <Plus className="h-5 w-5" />
                    Add Patient
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 h-12 px-6 border-border/60 hover:border-secondary/60 hover:bg-secondary/5"
                    onClick={() => setShowAlertSettings(true)}
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
                        variant={selectedFilter === "workers' compensation" ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedFilter("workers' compensation")}
                        className="h-10 px-4"
                      >
                        WC
                      </Button>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-border/60" />

                  {/* Physio Filter */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">Physio:</span>
                    <div className="flex gap-2">
                      <Button
                        variant={selectedPhysio === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedPhysio('all')}
                        className="h-10 px-4"
                      >
                        All
                      </Button>
                      {getUniquePhysios().map((physio) => (
                        <Button
                          key={physio}
                          variant={selectedPhysio === physio ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedPhysio(physio)}
                          className="h-10 px-4"
                        >
                          {physio}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="h-8 w-px bg-border/60" />

                  {/* Location Filter */}
                  <div className="flex items-center gap-3">
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
                  </div>
                </div>
              </div>
            </div>

            {/* Modern Tabs Interface */}
            <div className="container mx-auto px-8 py-8">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-8 h-14 bg-muted/30 rounded-2xl p-2">
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
                    className="text-base font-semibold h-10 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Bell className="h-5 w-5 mr-2" />
                    Action Needed
                    <Badge variant="destructive" className="ml-2 animate-pulse">
                      {
                        clientsData.filter((c) => c.status === 'warning' || c.status === 'critical')
                          .length
                      }
                    </Badge>
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

                <TabsContent value="archived" className="mt-0">
                  {renderClientList('archived')}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Dashboard;

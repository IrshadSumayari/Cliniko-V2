import { useEffect, useState } from "react";
import { Users, Calendar, DollarSign, Activity, Bell, AlertCircle, AlertTriangle, Clock } from "lucide-react";

const AnimatedDashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    // Simulate loading progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setIsLoading(false);
          setTimeout(() => setShowStats(true), 300);
          setTimeout(() => setShowAlerts(true), 800);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    return () => clearInterval(progressInterval);
  }, []);

  const stats = [
    { label: "Active Patients", value: "284", icon: Users, color: "text-blue-500" },
    { label: "Action Needed", value: "7", icon: AlertTriangle, color: "text-warning" },
    { label: "Pending", value: "23", icon: Calendar, color: "text-blue-500" },
    { label: "Overdue", value: "3", icon: Clock, color: "text-destructive" }
  ];

  const alerts = [
    { patient: "Emma Wilson", type: "WC", message: "1 session remaining", urgent: false },
    { patient: "Sarah Mitchell", type: "EPC", message: "2 sessions remaining", urgent: false },
    { patient: "John Davidson", type: "WC", message: "2 sessions over quota", urgent: true, overdue: true }
  ];

  return (
    <div className="luxury-card p-8 bg-gradient-to-br from-card to-secondary/50">
      <div className="rounded-lg overflow-hidden shadow-[var(--shadow-float)]">
        {/* Browser Header */}
        <div className="bg-card border-b border-border p-4 flex items-center gap-3">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive"></div>
            <div className="w-3 h-3 rounded-full bg-warning"></div>
            <div className="w-3 h-3 rounded-full bg-success"></div>
          </div>
          <div className="text-sm text-muted-foreground">MyPhysioFlow Dashboard</div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                <span className="text-sm text-muted-foreground">Syncing patient data...</span>
              </div>
              <div className="bg-muted/30 rounded-lg h-2 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-100 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-xs text-muted-foreground text-center">{progress}% complete</div>
            </div>
          )}

          {/* Stats Grid */}
          {showStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((stat, index) => (
                <div 
                  key={index} 
                  className="luxury-card p-4 animate-count-up opacity-0"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    <span className="text-xs text-success font-medium">Live</span>
                  </div>
                  <div className="text-2xl font-bold mb-1">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Patient Alerts */}
          {showAlerts && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium">Patient Alerts</span>
              </div>
              {alerts.map((alert, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50 animate-alert-slide opacity-0"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                   <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2">
                        <AlertCircle className={`h-4 w-4 ${alert.overdue ? 'text-destructive' : 'text-warning'}`} />
                        <div className="font-medium">{alert.patient}</div>
                        <span className={alert.type === 'EPC' ? 'program-badge-epc' : 'program-badge-wc'}>
                          {alert.type}
                        </span>
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                     <div className="text-sm text-muted-foreground">{alert.message}</div>
                     <div className={`w-2 h-2 rounded-full ${alert.overdue ? 'bg-destructive animate-pulse' : 'bg-warning'}`}></div>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnimatedDashboard;
'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Settings, LogOut, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DashboardHeaderProps {
  onSync: () => void;
  isSync: boolean;
  onNavigate?: (view: 'settings' | 'onboarding') => void;
  onSignOut: () => void;
}

export function DashboardHeader({ onSync, isSync, onNavigate, onSignOut }: DashboardHeaderProps) {
  const { user } = useAuth();

  return (
    <div className="bg-[#f1ede5] dark:bg-[#0f0f0f] backdrop-blur-sm border-b border-border/30 sticky top-0 z-50">
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
            {/* <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={onSync}
                    disabled={isSync}
                    className="gap-2 h-12 px-6 border-border/60 hover:border-primary/60 hover:bg-primary/5"
                  >
                    <RefreshCw className={`h-5 w-5 ${isSync ? 'animate-spin' : ''}`} />
                    {isSync ? 'Syncing...' : 'Sync Data'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Manually sync your latest data from your PMS</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider> */}

            {onNavigate && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => onNavigate('settings')}
                className="gap-2 h-12 px-6 border-border/60 hover:border-secondary/60 hover:bg-secondary/5"
              >
                <Settings className="h-5 w-5" />
                Settings
              </Button>
            )}

            <Button
              variant="ghost"
              size="lg"
              onClick={onSignOut}
              className="gap-2 h-12 px-4 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

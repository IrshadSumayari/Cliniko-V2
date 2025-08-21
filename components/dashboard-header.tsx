'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme-toggle';
import { RefreshCw, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

interface DashboardHeaderProps {
  onNavigate?: (view: 'settings' | 'onboarding') => void;
  isSync?: boolean;
  onSync?: () => void;
}

export default function DashboardHeader({ onNavigate, isSync, onSync }: DashboardHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <TooltipProvider>
      <header className="border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-2xl font-bold">MyPhysioFlow</div>
              <div className="text-sm text-muted-foreground">
                {user?.clinicName} • Welcome back, {user?.firstName}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-6">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={onSync}
                    disabled={isSync}
                    className="bg-gradient-to-r from-primary/10 to-primary/20 text-primary hover:from-primary/20 hover:to-primary/30 transition-all duration-300"
                  >
                    <RefreshCw className={`h-5 w-5 mr-3 ${isSync ? 'animate-spin' : ''}`} />
                    {isSync ? 'Syncing...' : 'Sync Now'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh patient data from your practice management system</p>
                </TooltipContent>
              </Tooltip>

              <ThemeToggle />

              <Button
                variant="ghost"
                size="lg"
                onClick={() => onNavigate?.('settings')}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                size="lg"
                onClick={logout}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}

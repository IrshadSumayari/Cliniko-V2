'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Settings, LogOut, Activity, Bell, User, HelpCircle } from 'lucide-react';
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
    <div className="bg-gradient-to-r from-background/95 to-card/95 backdrop-blur-md border-b border-border/50 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left Section - Brand & User Info */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">MyPhysioFlow</div>
                <div className="text-xs text-muted-foreground -mt-1">Practice Management</div>
              </div>
            </div>
            
            {/* User Info */}
            <div className="hidden md:flex items-center gap-3 pl-4 border-l border-border/50">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">{user?.email?.split('@')[0] || 'User'}</div>
                <div className="text-xs text-muted-foreground">Dashboard</div>
              </div>
            </div>
          </div>
          
          {/* Right Section - Actions */}
          <div className="flex items-center gap-3">
            {/* Sync Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSync}
                    disabled={isSync}
                    className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 text-primary hover:from-primary/10 hover:to-primary/20 hover:border-primary/30 transition-all duration-300 shadow-sm"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isSync ? 'animate-spin' : ''}`} />
                    {isSync ? 'Syncing...' : 'Sync'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh patient data from your practice management system</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Notifications */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 w-9 h-9 p-0"
                  >
                    <Bell className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Notifications</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Settings */}
            {onNavigate && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onNavigate('settings')}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 w-9 h-9 p-0"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Settings</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Help */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 w-9 h-9 p-0"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Help & Support</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Logout */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={onSignOut}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 w-9 h-9 p-0"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sign Out</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}

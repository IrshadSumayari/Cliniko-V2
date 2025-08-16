"use client";

import { useAuth } from "@/contexts/auth-context";
import LandingPage from "@/components/landing-page";
import OnboardingFlow from "@/components/onboarding-flow";
import Dashboard from "@/components/dashboard";
import Settings from "@/components/settings";
import { useState, useMemo, useEffect } from "react";

/**
 * A wrapper for the main application view after a user is authenticated and onboarded.
 * It handles navigation between the dashboard, settings, and onboarding.
 */
function AuthenticatedApp() {
  const [view, setView] = useState<"dashboard" | "settings" | "onboarding">(
    "dashboard"
  );

  if (view === "settings") {
    return <Settings onBack={() => setView("dashboard")} />;
  }

  if (view === "onboarding") {
    return <OnboardingFlow />;
  }

  return <Dashboard onNavigate={setView} />;
}

export default function HomePage() {
  const { user, loading } = useAuth();

  // REMOVED: localStorage clearing logic that was causing logout issues
  //
  // Previous issue: The page was clearing localStorage after 10 seconds of loading,
  // which caused users to be logged out during long operations like sync.
  //
  // Solution: The auth context now properly handles:
  // 1. User authentication status from Supabase
  // 2. User onboarding status from database (is_onboarded field)
  // 3. Proper loading states without clearing user data
  //
  // This ensures users stay logged in even after refresh or during long operations.

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!user) {
      return <LandingPage />;
    }

    // Check if user is onboarded based on database status
    // This ensures users stay logged in even after refresh
    if (user && !user.isOnboarded) {
      return <OnboardingFlow />;
    }

    return <AuthenticatedApp />;
  }, [user, loading]);

  return <div key={`${user?.id || "no-user"}-${loading}`}>{content}</div>;
}

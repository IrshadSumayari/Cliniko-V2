"use client";

import { useAuth } from "@/contexts/auth-context";
import LandingPage from "@/components/landing-page";
import OnboardingFlow from "@/components/onboarding-flow";
import Dashboard from "@/components/dashboard";
import Settings from "@/components/settings";
import { useState, useMemo, useEffect } from "react";

/**
 * A wrapper for the main application view after a user is authenticated and onboarded.
 * It handles navigation between the dashboard and settings.
 */
function AuthenticatedApp() {
  const [view, setView] = useState<"dashboard" | "settings">("dashboard");

  if (view === "settings") {
    return <Settings onBack={() => setView("dashboard")} />;
  }

  // The Dashboard component can now navigate to settings.
  return <Dashboard onNavigate={setView} />;
}

export default function HomePage() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.warn("Loader stuck >10s, clearing storage and reloading...");
        localStorage.clear();
        window.location.reload();
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [loading]);

  // Memoize the component to prevent unnecessary re-renders
  const content = useMemo(() => {
    // While the auth state is being determined, show a loading indicator.
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
        </div>
      );
    }

    // If there is no user session, the user is not logged in.
    if (!user) {
      return <LandingPage />;
    }

    // If a user is logged in, but they haven't completed onboarding.
    if (user && !user.isOnboarded) {
      return <OnboardingFlow />;
    }

    // If the user is logged in and has completed onboarding, show main app.
    return <AuthenticatedApp />;
  }, [user, loading]);

  return <div key={`${user?.id || "no-user"}-${loading}`}>{content}</div>;
}

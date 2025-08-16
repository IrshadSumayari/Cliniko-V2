"use client";

import { useAuth } from "@/contexts/auth-context";
import LandingPage from "@/components/landing-page";
import OnboardingFlow from "@/components/onboarding-flow";
import Dashboard from "@/components/dashboard";
import Settings from "@/components/settings";
import { useState, useMemo } from "react";

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

  // Memoize the component to prevent unnecessary re-renders
  const content = useMemo(() => {
    // While the auth state is being determined, show a loading indicator.
    // This prevents a flash of the wrong content.
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
        </div>
      );
    }

    // If there is no user session, the user is not logged in.
    // ALWAYS show the landing page.
    if (!user) {
      return <LandingPage />;
    }

    // If a user is logged in, but they haven't completed the onboarding process.
    // Show the onboarding flow to connect their Practice Management Software.
    if (user && !user.isOnboarded) {
      return <OnboardingFlow />;
    }

    // If the user is logged in and has completed onboarding, show the main application.
    return <AuthenticatedApp />;
  }, [user, loading]);

  return <div key={`${user?.id || "no-user"}-${loading}`}>{content}</div>;
}

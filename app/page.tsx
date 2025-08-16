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
  const [view, setView] = useState<"dashboard" | "settings" | "onboarding">("dashboard");

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

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        console.warn("Auth loading too long → clearing storage & reloading");
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      }, 10000); // 10 seconds

      return () => clearTimeout(timer);
    }
  }, [loading]);

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

    if (user && !user.isOnboarded) {
      return <OnboardingFlow />;
    }

    return <AuthenticatedApp />;
  }, [user, loading]);

  return <div key={`${user?.id || "no-user"}-${loading}`}>{content}</div>;
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  ArrowLeft,
  Shield,
  Loader2,
  CheckCircle,
  Settings,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type OnboardingStep = "pms" | "api" | "syncing" | "sync-results";

interface SyncResults {
  wcPatients: number;
  epcPatients: number;
  totalAppointments: number;
  issues?: string[];
}

export default function OnboardingFlow() {
  const { updateUserOnboardingStatus, isLoading, user } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("pms");
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    selectedPMS: "",
    apiKey: "",
  });
  const [syncResults, setSyncResults] = useState<SyncResults>({
    wcPatients: 0,
    epcPatients: 0,
    totalAppointments: 0,
    issues: [],
  });

  const handlePMSSelect = (pms: string) => {
    setFormData({ ...formData, selectedPMS: pms });
  };

  const handleConnectAndSync = async () => {
    if (!formData.apiKey.trim()) {
      toast.error("Please enter your API key");
      return;
    }

    console.log("Checking client-side session before API call...");
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error(
        "Client-side session missing:",
        sessionError?.message || "No session"
      );
      toast.error("Session expired. Please refresh the page and try again.");
      return;
    }

    console.log("Client-side session found:", session.user.email);

    setIsProcessing(true);
    setCurrentStep("syncing");

    try {
      const response = await fetch("/api/pms/connect-and-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pmsType: formData.selectedPMS.toLowerCase(),
          apiKey: formData.apiKey,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          toast.error(
            "Authentication expired. Please refresh the page and sign in again."
          );
          return;
        }
        throw new Error(result.error || "Failed to connect to PMS");
      }

      setSyncResults({
        wcPatients: result.wcPatients || 0,
        epcPatients: result.epcPatients || 0,
        totalAppointments: result.totalAppointments || 0,
        issues: result.issues || [],
      });

      toast.success("Successfully connected and synced data!");
      setCurrentStep("sync-results");
    } catch (error) {
      console.error("Sync error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to connect to PMS"
      );
      setCurrentStep("api");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    try {
      const success = await updateUserOnboardingStatus(true);
      if (success) {
        toast.success("Setup complete! Welcome to your dashboard.");
      } else {
        toast.error("Failed to complete setup. Please try again.");
      }
    } catch (error) {
      console.error("Error completing onboarding:", error);
      toast.error("Failed to complete setup. Please try again.");
    }
  };

  const handleSkip = async () => {
    try {
      toast.info("You can connect your PMS later in settings.");
      const success = await updateUserOnboardingStatus(false);
      if (!success) {
        toast.error("Failed to update status. Please try again.");
      }
    } catch (error) {
      console.error("Error skipping onboarding:", error);
      toast.error("Failed to update status. Please try again.");
    }
  };

  const handleBack = () => {
    const steps: OnboardingStep[] = ["pms", "api", "syncing", "sync-results"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const getPMSInstructions = (pms: string) => {
    const instructions = {
      cliniko: [
        "Log into your Cliniko account",
        "Go to Settings → Developer → API Keys",
        "Click 'Generate new API key'",
        "Copy the key and paste it below",
      ],
      halaxy: [
        "Log into your Halaxy account",
        "Go to Settings → Integrations → API Access",
        "Generate a new API token",
        "Copy the token and paste it below",
      ],
      nookal: [
        "Log into your Nookal account",
        "Go to Settings → API → Generate Key",
        "Create a new API key",
        "Copy the key and paste it below",
      ],
    };
    return (
      instructions[pms.toLowerCase() as keyof typeof instructions] ||
      instructions.cliniko
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case "pms":
        return (
          <div className="space-y-6 fade-in">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">
                Connect Your Practice Management Software
              </h2>
              <p className="text-muted-foreground">
                Choose your current system
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-2xl mx-auto">
              {[
                { name: "Cliniko", letter: "C" },
                { name: "Nookal", letter: "N" },
                { name: "Halaxy", letter: "H" },
              ].map((pms) => (
                <Card
                  key={pms.name}
                  className={`p-8 text-center cursor-pointer transition-all hover:scale-105 ${
                    formData.selectedPMS === pms.name
                      ? "ring-2 ring-primary border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => handlePMSSelect(pms.name)}
                >
                  <div className="text-6xl font-bold mb-4 text-primary">
                    {pms.letter}
                  </div>
                  <div className="font-semibold text-lg">{pms.name}</div>
                </Card>
              ))}
            </div>

            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                Your data will stay encrypted and secure at all times.
              </div>

              <Button
                variant="default"
                size="lg"
                onClick={() => setCurrentStep("api")}
                disabled={!formData.selectedPMS || isProcessing || isLoading}
                className="min-w-[280px]"
              >
                Continue with Selected System
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <div className="pt-4">
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  disabled={isProcessing || isLoading}
                >
                  Back to Home
                </Button>
              </div>
            </div>
          </div>
        );

      case "api":
        return (
          <div className="space-y-8 fade-in">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <div className="w-8 h-0.5 bg-primary"></div>
                <div className="w-3 h-3 rounded-full bg-primary"></div>
              </div>
              <h2 className="text-3xl font-bold mb-2">
                Get Your {formData.selectedPMS} API Key
              </h2>
              <p className="text-muted-foreground">
                Follow these step-by-step instructions to connect your practice
                management system
              </p>
            </div>

            <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
              {/* Instructions Card */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Settings className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Step-by-Step Instructions</h3>
                </div>

                <div className="space-y-4">
                  {getPMSInstructions(formData.selectedPMS).map(
                    (instruction, index) => (
                      <div key={index} className="flex gap-3">
                        <Badge
                          variant="outline"
                          className="rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0"
                        >
                          {index + 1}
                        </Badge>
                        <p className="text-sm flex-1">{instruction}</p>
                      </div>
                    )
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-6 w-full bg-transparent"
                  onClick={() =>
                    window.open(
                      `https://${formData.selectedPMS.toLowerCase()}.com/docs/api`,
                      "_blank"
                    )
                  }
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open {formData.selectedPMS} Documentation
                </Button>

                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    Your API key will look like: ck_abc123def456...
                  </div>
                </div>
              </Card>

              {/* API Key Input Card */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Enter Your API Key</h3>
                </div>

                <div className="space-y-4">
                  <Input
                    type="password"
                    placeholder={`Paste your ${formData.selectedPMS} API key here`}
                    value={formData.apiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, apiKey: e.target.value })
                    }
                    className="font-mono text-sm"
                  />

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    Your API key is encrypted and stored securely
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">
                      What happens next?
                    </h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>
                        • We'll securely connect to your {formData.selectedPMS}{" "}
                        account
                      </li>
                      <li>
                        • Import your patient data and appointment history
                      </li>
                      <li>• Set up your personalized dashboard</li>
                      <li>• You'll be ready to use the system immediately</li>
                    </ul>
                  </div>

                  <Button
                    variant="default"
                    size="lg"
                    className="w-full"
                    onClick={handleConnectAndSync}
                    disabled={!formData.apiKey.trim() || isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Connect & Sync Data"
                    )}
                    {!isProcessing && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </div>
              </Card>
            </div>

            <div className="flex justify-center gap-4">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isProcessing}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to PMS Selection
              </Button>
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={isProcessing}
              >
                Back to Home
              </Button>
            </div>
          </div>
        );

      case "syncing":
        return (
          <div className="space-y-8 fade-in text-center">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-8">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <div className="w-8 h-0.5 bg-primary"></div>
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <div className="w-8 h-0.5 bg-primary"></div>
                <div className="w-3 h-3 rounded-full bg-primary"></div>
              </div>
              <h2 className="text-3xl font-bold mb-2">
                Setting Up Your Dashboard
              </h2>
              <p className="text-muted-foreground mb-8">
                We're connecting to your clinic's data and mapping your
                patients, quotas and appointments...
              </p>
            </div>

            <div className="max-w-md mx-auto">
              <div className="w-full bg-muted rounded-full h-2 mb-6">
                <div
                  className="bg-primary h-2 rounded-full animate-pulse"
                  style={{ width: "75%" }}
                ></div>
              </div>

              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Connecting to {formData.selectedPMS}...
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                This usually takes under a minute - please keep this window
                open.
              </p>
            </div>

            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={isProcessing}
            >
              Back to Home
            </Button>
          </div>
        );

      case "sync-results":
        return (
          <div className="space-y-8 fade-in">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h2 className="text-3xl font-bold mb-2">Sync Complete!</h2>
              <p className="text-muted-foreground">
                Here's what we found in your {formData.selectedPMS} data
              </p>
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                <Card className="p-6 text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {syncResults.wcPatients}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Workers Compensation Patients
                  </div>
                </Card>
                <Card className="p-6 text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">
                    {syncResults.epcPatients}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    EPC Patients
                  </div>
                </Card>
                <Card className="p-6 text-center">
                  <div className="text-4xl font-bold text-purple-600 mb-2">
                    {syncResults.totalAppointments}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Appointments
                  </div>
                </Card>
              </div>

              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Configure Patient Tags</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Customize how patients are categorized in your dashboard.
                  These tags help track quota usage.
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Workers Compensation Tag
                    </label>
                    <Input defaultValue="Workers Comp" className="mb-2" />
                    <p className="text-xs text-muted-foreground">
                      What do you call Workers Compensation patients in your
                      system?
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      EPC Tag
                    </label>
                    <Input defaultValue="EPC Plan" className="mb-2" />
                    <p className="text-xs text-muted-foreground">
                      How do you identify EPC patients in your practice?
                    </p>
                  </div>
                </div>
              </Card>

              {syncResults.issues && syncResults.issues.length > 0 && (
                <Card className="p-6 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-orange-600" />
                    <h3 className="font-semibold text-orange-800 dark:text-orange-200">
                      Issues Found During Sync
                    </h3>
                  </div>
                  <ul className="space-y-1 text-sm text-orange-700 dark:text-orange-300">
                    {syncResults.issues.map((issue, index) => (
                      <li key={index}>• {issue}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-3">
                    These issues won't affect your dashboard functionality, but
                    you may want to review them.
                  </p>
                </Card>
              )}

              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep("api")}
                  disabled={isProcessing || isLoading}
                >
                  Back to Sync
                </Button>
                <Button
                  variant="default"
                  size="lg"
                  onClick={handleCompleteOnboarding}
                  disabled={isProcessing || isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Continue to Dashboard"
                  )}
                  {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-5xl">{renderStep()}</div>
    </div>
  );
}

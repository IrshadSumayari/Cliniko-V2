"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import ApiHelpTooltip from "./api-help-tooltip";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type OnboardingStep = "pms" | "api" | "mapping" | "sync-results";

export default function OnboardingFlow() {
  const router = useRouter();
  const { updateUserOnboardingStatus, isLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("pms");
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    selectedPMS: "",
    apiKey: "",
  });

  const [syncResults, setSyncResults] = useState({
    wcPatients: 0,
    epcPatients: 0,
    totalAppointments: 0,
  });

  useEffect(() => {
    if (currentStep === "mapping") {
      setIsProcessing(true);
      toast.info("Connecting to your clinic's data...");
      setTimeout(() => {
        const mockResults = {
          wcPatients: Math.floor(Math.random() * 25) + 5,
          epcPatients: Math.floor(Math.random() * 40) + 10,
          totalAppointments: Math.floor(Math.random() * 200) + 100,
        };
        setSyncResults(mockResults);
        localStorage.setItem(
          "pms_connection",
          JSON.stringify({
            software: formData.selectedPMS,
            apiKey: formData.apiKey,
            connected: true,
            lastSync: new Date().toISOString(),
          })
        );
        setIsProcessing(false);
        setCurrentStep("sync-results");
        toast.success("Sync complete!");
      }, 3000);
    }
  }, [currentStep, formData.selectedPMS, formData.apiKey]);

  const handleNext = () => {
    const steps: OnboardingStep[] = ["pms", "api", "mapping", "sync-results"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: OnboardingStep[] = ["pms", "api", "mapping", "sync-results"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleCompleteOnboarding = async () => {
    await updateUserOnboardingStatus(true);
    // The parent component `app/page.tsx` will automatically re-render.
  };

  const handleSkip = async () => {
    localStorage.clear();

    toast.info(
      "Skipping for now... You can connect your PMS later in settings."
    );
    router.push("/");
    await updateUserOnboardingStatus(true); // Still mark as onboarded
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
              {["Cliniko", "Nookal", "Halaxy"].map((pms) => (
                <div
                  key={pms}
                  className={`bg-card p-6 text-center cursor-pointer transition-all hover:scale-105 rounded-lg border ${
                    formData.selectedPMS === pms
                      ? "ring-2 ring-primary border-primary"
                      : "border-border"
                  }`}
                  onClick={() => setFormData({ ...formData, selectedPMS: pms })}
                >
                  <div className="text-4xl font-bold mb-2">{pms[0]}</div>
                  <div className="font-semibold">{pms}</div>
                </div>
              ))}
            </div>
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                <Shield className="h-4 w-4" />
                Your data will stay encrypted and secure at all times.
              </div>
              <Button
                variant="default"
                size="lg"
                onClick={handleNext}
                disabled={!formData.selectedPMS || isProcessing || isLoading}
              >
                Continue with {formData.selectedPMS || "Selected System"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <div className="pt-4">
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  disabled={isProcessing || isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Skip for now"
                  )}
                </Button>
              </div>
            </div>
          </div>
        );
      case "api":
        return (
          <div className="space-y-8 fade-in">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">
                Get Your {formData.selectedPMS} API Key
              </h2>
              <p className="text-muted-foreground">
                Follow these step-by-step instructions to connect your practice
                management system
              </p>
            </div>
            <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-8">
              <Card className="p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Step-by-Step Instructions</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Badge
                      variant="outline"
                      className="rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    >
                      1
                    </Badge>
                    <p className="text-sm flex-1">
                      Log into your {formData.selectedPMS} account
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Badge
                      variant="outline"
                      className="rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    >
                      2
                    </Badge>
                    <p className="text-sm flex-1">
                      Go to Settings → Developer → API Keys
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Badge
                      variant="outline"
                      className="rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    >
                      3
                    </Badge>
                    <p className="text-sm flex-1">
                      Click 'Generate new API key'
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Badge
                      variant="outline"
                      className="rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    >
                      4
                    </Badge>
                    <p className="text-sm flex-1">
                      Copy the key and paste it below
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Enter Your API Key</h3>
                  <ApiHelpTooltip pmsName={formData.selectedPMS} />
                </div>
                <div className="space-y-4">
                  <Input
                    type="text"
                    placeholder={`Paste your ${formData.selectedPMS} API key here`}
                    value={formData.apiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, apiKey: e.target.value })
                    }
                    className="font-mono text-sm pr-10"
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3" />
                    Your API key is encrypted and stored securely
                  </div>
                  <Button
                    variant="default"
                    size="lg"
                    className="w-full"
                    onClick={handleNext}
                    disabled={!formData.apiKey || isProcessing || isLoading}
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
                disabled={isProcessing || isLoading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to PMS Selection
              </Button>
            </div>
          </div>
        );
      case "mapping":
        return (
          <div className="space-y-6 fade-in text-center">
            <div>
              <h2 className="text-3xl font-bold mb-2">
                Setting Up Your Dashboard
              </h2>
              <p className="text-muted-foreground">
                We're connecting to your clinic's data and mapping your
                patients, quotas and appointments…
              </p>
            </div>
            <div className="max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Connecting to {formData.selectedPMS}... This may take a minute.
              </div>
            </div>
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
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {syncResults.wcPatients}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Workers Compensation Patients
                  </div>
                </Card>
                <Card className="p-6 text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {syncResults.epcPatients}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    EPC Patients
                  </div>
                </Card>
                <Card className="p-6 text-center">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {syncResults.totalAppointments}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Appointments
                  </div>
                </Card>
              </div>
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={isProcessing || isLoading}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
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
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-4xl">
        {currentStep !== "sync-results" && currentStep !== "mapping" && (
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2">
              {["pms", "api"].map((step, index) => {
                const steps: OnboardingStep[] = ["pms", "api", "mapping"];
                const currentIndex = steps.indexOf(currentStep);
                const isCompleted = index < currentIndex;
                const isCurrent = index === currentIndex;
                return (
                  <div key={step} className="flex items-center">
                    <div
                      className={`w-3 h-3 rounded-full transition-colors ${
                        isCompleted || isCurrent ? "bg-primary" : "bg-muted"
                      }`}
                    />
                    {index < 1 && (
                      <div
                        className={`w-8 h-0.5 ${
                          isCompleted ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {renderStep()}
      </div>
    </div>
  );
}

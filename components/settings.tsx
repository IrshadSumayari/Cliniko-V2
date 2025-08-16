"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SettingsIcon,
  User,
  Building2,
  Plug,
  Save,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Crown,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/utils";

interface PMSConnection {
  software: string;
  apiKey: string;
  connected: boolean;
  lastSync: string;
}
import { config } from "@/lib/config";

// Get the professional plan price ID
const priceId = config.stripe.priceIds.professional;
const Settings = ({ onBack }: { onBack: () => void }) => {
  const { user, signOut } = useAuth();
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [profile, setProfile] = useState({
    firstName: user?.user_metadata?.first_name || "",
    lastName: user?.user_metadata?.last_name || "",
    email: user?.email || "",
    clinicName: user?.user_metadata?.clinic_name || "",
  });

  const [pmsConnection, setPmsConnection] = useState<PMSConnection>({
    software: "",
    apiKey: "",
    connected: false,
    lastSync: "",
  });

  const [subscriptionStatus] = useState({
    plan: "Free Trial",
    daysLeft: 7,
    usage: 45,
    limit: 100,
  });

  useEffect(() => {
    // Load PMS connection from localStorage
    const savedConnection = localStorage.getItem("pms_connection");
    if (savedConnection) {
      setPmsConnection(JSON.parse(savedConnection));
    }
  }, []);

  const handleProfileSave = () => {
    // In a real app, this would save to backend
    toast.success("Profile information has been saved.");
  };

  const handlePMSConnect = () => {
    if (!pmsConnection.software || !pmsConnection.apiKey) {
      toast.error("Please select your software and enter an API key.");
      return;
    }

    const updatedConnection = {
      ...pmsConnection,
      connected: true,
      lastSync: new Date().toLocaleString(),
    };

    setPmsConnection(updatedConnection);
    localStorage.setItem("pms_connection", JSON.stringify(updatedConnection));

    toast.success(`Successfully connected to ${pmsConnection.software}.`);
  };
  async function handleUpgrade() {
    setUpgradeLoading(true);
    try {
      const res = await authenticatedFetch("/api/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({
          email: user?.email,
          userId: user?.id,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          `Expected JSON, got ${contentType}. Possible HTML error page.`
        );
      }

      const data = await res.json();

      if (!res.ok) {
        console.error("Upgrade failed:", data.error);
        toast.error(data.error || "Upgrade failed");
        setUpgradeLoading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setUpgradeLoading(false);
    }
  }

  const handlePMSDisconnect = () => {
    const updatedConnection = {
      ...pmsConnection,
      connected: false,
      lastSync: "",
    };

    setPmsConnection(updatedConnection);
    localStorage.setItem("pms_connection", JSON.stringify(updatedConnection));

    toast.success("Your practice management software has been disconnected.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <SettingsIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground">
                Manage your account and preferences
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Profile Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Profile Information</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    First Name
                  </label>
                  <Input
                    value={profile.firstName}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        firstName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Last Name
                  </label>
                  <Input
                    value={profile.lastName}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        lastName: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  value={profile.email}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Clinic Name
                </label>
                <Input
                  value={profile.clinicName}
                  onChange={(e) =>
                    setProfile((prev) => ({
                      ...prev,
                      clinicName: e.target.value,
                    }))
                  }
                />
              </div>

              <Button onClick={handleProfileSave} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Save Profile
              </Button>
            </div>
          </Card>

          {/* PMS Connection */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Plug className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">PMS Connection</h2>
              </div>
              {pmsConnection.connected ? (
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800 border-green-200"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="bg-red-100 text-red-800 border-red-200"
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Practice Management Software
                </label>
                <select
                  className="w-full mt-1 p-2 border border-border rounded-md bg-background"
                  value={pmsConnection.software}
                  onChange={(e) =>
                    setPmsConnection((prev) => ({
                      ...prev,
                      software: e.target.value,
                    }))
                  }
                  disabled={pmsConnection.connected}
                >
                  <option value="">Select your clinic</option>
                  <option value="OptiPlex">Cliniko</option>
                  <option value="HeroHealth">Halaxy</option>
                  <option value="Nookal">Nookal</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  API Key
                </label>
                <Input
                  type="password"
                  placeholder="Enter your API key"
                  value={pmsConnection.apiKey}
                  onChange={(e) =>
                    setPmsConnection((prev) => ({
                      ...prev,
                      apiKey: e.target.value,
                    }))
                  }
                  disabled={pmsConnection.connected}
                />
              </div>

              {pmsConnection.connected && pmsConnection.lastSync && (
                <div className="text-sm text-muted-foreground">
                  Last sync: {pmsConnection.lastSync}
                </div>
              )}

              {pmsConnection.connected ? (
                <Button
                  variant="outline"
                  onClick={handlePMSDisconnect}
                  className="w-full"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              ) : (
                <Button onClick={handlePMSConnect} className="w-full">
                  <Plug className="h-4 w-4 mr-2" />
                  Connect PMS
                </Button>
              )}
            </div>
          </Card>

          {/* Subscription Status */}
          {/* <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Subscription</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current Plan</span>
                <Badge variant="outline">{subscriptionStatus.plan}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Days Remaining</span>
                <span className="text-sm text-muted-foreground">
                  {subscriptionStatus.daysLeft} days
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Usage</span>
                  <span className="text-sm text-muted-foreground">
                    {subscriptionStatus.usage}/{subscriptionStatus.limit}{" "}
                    patients
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        (subscriptionStatus.usage / subscriptionStatus.limit) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>

              <Button onClick={handleUpgrade} className="w-full">
                <CreditCard className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
            </div>
          </Card> */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Upgrade to Professional
              </CardTitle>
              <CardDescription>
                Unlock all features and get unlimited access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">$30</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>✓ Unlimited patient matching</li>
                  <li>✓ Advanced analytics and reporting</li>
                </ul>
              </div>
              <Button
                onClick={handleUpgrade}
                disabled={upgradeLoading}
                className="w-full"
                size="lg"
              >
                {upgradeLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Upgrade Now
              </Button>
            </CardContent>
          </Card>
          {/* Account Actions */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Account Actions</h2>
            </div>

            <div className="space-y-3">
              <Button variant="outline" onClick={signOut} className="w-full">
                Sign Out
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;

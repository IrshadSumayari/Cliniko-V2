"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  CreditCard,
  Webhook,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface TestResult {
  name: string;
  status: "success" | "error" | "warning" | "pending";
  message: string;
  details?: any;
}

export default function StripeTestPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [envStatus, setEnvStatus] = useState<any>(null);
  console.log("user", user?.id);
  useEffect(() => {
    checkEnvironmentVariables();
  }, []);

  const addTestResult = (result: TestResult) => {
    setTestResults((prev) => [...prev, result]);
  };

  const clearResults = (value: boolean) => {
    window.localStorage.clear();
    if (value) {
      router.push("/");
    }

    setTestResults([]);
  };

  const checkEnvironmentVariables = async () => {
    try {
      const response = await fetch("/api/test-env");
      const data = await response.json();
      setEnvStatus(data);

      addTestResult({
        name: "Environment Variables Check",
        status: data.status === "success" ? "success" : "warning",
        message: data.message,
        details: data,
      });
    } catch (error) {
      addTestResult({
        name: "Environment Variables Check",
        status: "error",
        message: "Failed to check environment variables",
        details: error,
      });
    }
  };

  const testStripeConnection = async () => {
    try {
      addTestResult({
        name: "Stripe Connection Test",
        status: "pending",
        message: "Testing Stripe API connection...",
      });

      // Test creating a checkout session
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId:
            process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID || "price_test",
          userId: user?.id || "test-user-id",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        addTestResult({
          name: "Stripe Connection Test",
          status: "success",
          message: "Successfully created checkout session",
          details: { sessionId: data.sessionId },
        });
      } else {
        addTestResult({
          name: "Stripe Connection Test",
          status: "error",
          message: data.error || "Failed to create checkout session",
          details: data,
        });
      }
    } catch (error) {
      addTestResult({
        name: "Stripe Connection Test",
        status: "error",
        message: "Network error testing Stripe connection",
        details: error,
      });
    }
  };

  const testWebhookEndpoint = async () => {
    try {
      addTestResult({
        name: "Webhook Endpoint Test",
        status: "pending",
        message: "Testing webhook endpoint...",
      });

      const response = await fetch("/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "invalid_test_signature",
        },
        body: JSON.stringify({
          type: "test_event",
          data: { object: { id: "test_id" } },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        addTestResult({
          name: "Webhook Endpoint Test",
          status: "success",
          message: "Webhook endpoint is responding correctly",
          details: data,
        });
      } else {
        addTestResult({
          name: "Webhook Endpoint Test",
          status: "error",
          message: "Webhook endpoint returned an error",
          details: data,
        });
      }
    } catch (error) {
      addTestResult({
        name: "Webhook Endpoint Test",
        status: "error",
        message: "Failed to reach webhook endpoint",
        details: error,
      });
    }
  };

  const testCheckoutFlow = async (priceId: string, planName: string) => {
    if (!user) {
      addTestResult({
        name: `${planName} Checkout Test`,
        status: "error",
        message: "User must be logged in to test checkout",
      });
      return;
    }

    try {
      addTestResult({
        name: `${planName} Checkout Test`,
        status: "pending",
        message: `Creating ${planName} checkout session...`,
      });

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.sessionId) {
        addTestResult({
          name: `${planName} Checkout Test`,
          status: "success",
          message: `${planName} checkout session created successfully`,
          details: { sessionId: data.sessionId },
        });

        // Optionally redirect to Stripe Checkout
        // window.open(data.url, '_blank')
      } else {
        addTestResult({
          name: `${planName} Checkout Test`,
          status: "error",
          message:
            data.error || `Failed to create ${planName} checkout session`,
          details: data,
        });
      }
    } catch (error) {
      addTestResult({
        name: `${planName} Checkout Test`,
        status: "error",
        message: `Network error creating ${planName} checkout`,
        details: error,
      });
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    clearResults(false);

    await checkEnvironmentVariables();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await testStripeConnection();
    await new Promise((resolve) => setTimeout(resolve, 500));

    await testWebhookEndpoint();
    await new Promise((resolve) => setTimeout(resolve, 500));

    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: "default",
      error: "destructive",
      warning: "secondary",
      pending: "outline",
    };
    return variants[status] || "outline";
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Stripe Integration Test Suite
        </h1>
        <p className="text-muted-foreground">
          Test your Stripe integration, environment variables, and webhook
          endpoints
        </p>
      </div>

      {/* Environment Status */}
      {envStatus && (
        <Alert className="mb-6">
          <Settings className="h-4 w-4" />
          <AlertDescription>
            <strong>Environment Status:</strong> {envStatus.message}
            {envStatus.missing && envStatus.missing.length > 0 && (
              <div className="mt-2">
                <strong>Missing variables:</strong>{" "}
                {envStatus.missing.join(", ")}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Test Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Automated Tests
            </CardTitle>
            <CardDescription>
              Run comprehensive tests for your Stripe integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={runAllTests}
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? "Running Tests..." : "Run All Tests"}
            </Button>
            <Button
              onClick={() => clearResults(true)}
              variant="outline"
              className="w-full"
            >
              Clear Results
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Manual Checkout Tests
            </CardTitle>
            <CardDescription>
              Test individual checkout flows for each plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={() =>
                testCheckoutFlow(
                  process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID ||
                    "price_basic",
                  "Basic"
                )
              }
              variant="outline"
              size="sm"
              className="w-full"
            >
              Test Basic Plan
            </Button>
            <Button
              onClick={() =>
                testCheckoutFlow(
                  process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID ||
                    "price_professional",
                  "Professional"
                )
              }
              variant="outline"
              size="sm"
              className="w-full"
            >
              Test Professional Plan
            </Button>
            <Button
              onClick={() =>
                testCheckoutFlow(
                  process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID ||
                    "price_enterprise",
                  "Enterprise"
                )
              }
              variant="outline"
              size="sm"
              className="w-full"
            >
              Test Enterprise Plan
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Test Results
          </CardTitle>
          <CardDescription>
            Results from your Stripe integration tests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {testResults.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No tests run yet. Click "Run All Tests" to get started.
            </p>
          ) : (
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 border rounded-lg"
                >
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{result.name}</h4>
                      <Badge variant={getStatusBadge(result.status)}>
                        {result.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {result.message}
                    </p>
                    {result.details && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View Details
                        </summary>
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Info */}
      {user && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Current User</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <strong>ID:</strong> {user.id}
              </div>
              <div>
                <strong>Email:</strong> {user.email}
              </div>
              <div>
                <strong>Created:</strong>{" "}
                {new Date(user.created_at).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

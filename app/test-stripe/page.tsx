"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";

interface TestResult {
  name: string;
  status: "success" | "error" | "pending";
  message: string;
  details?: any;
}

export default function StripeTestPage() {
  const router = useRouter();
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { user } = useAuth();

  const updateResult = (
    name: string,
    status: "success" | "error" | "pending",
    message: string,
    details?: any
  ) => {
    setResults((prev) => {
      const existing = prev.find((r) => r.name === name);
      if (existing) {
        existing.status = status;
        existing.message = message;
        existing.details = details;
        return [...prev];
      }
      return [...prev, { name, status, message, details }];
    });
  };
  const clearResults = (value: boolean) => {
    window.localStorage.clear();
    if (value) {
      router.push("/");
    }
  };
  const testEnvironmentVariables = async () => {
    updateResult(
      "Environment Variables",
      "pending",
      "Checking environment variables..."
    );

    try {
      const response = await fetch("/api/test-env");
      const data = await response.json();

      const missing = Object.entries(data).filter(
        ([key, value]) =>
          typeof value === "string" && value.includes("✗ Missing")
      );

      if (missing.length > 0) {
        updateResult(
          "Environment Variables",
          "error",
          `Missing variables: ${missing.map(([key]) => key).join(", ")}`,
          data
        );
      } else {
        updateResult(
          "Environment Variables",
          "success",
          "All environment variables are set",
          data
        );
      }
    } catch (error) {
      updateResult(
        "Environment Variables",
        "error",
        `Failed to check environment variables: ${error}`
      );
    }
  };

  const testCheckoutSession = async (planName: string, priceId: string) => {
    const testName = `${planName} Checkout`;
    updateResult(testName, "pending", "Creating checkout session...");

    try {
      const userId = user?.id || "test-user-id-123";

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId,
          userId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        updateResult(
          testName,
          "success",
          `Checkout session created successfully`,
          {
            sessionId: data.sessionId,
            url: data.url,
            customer: data.customer,
            isTestMode: data.isTestMode,
          }
        );
      } else {
        updateResult(
          testName,
          "error",
          `Failed to create checkout session: ${data.error}`,
          data
        );
      }
    } catch (error) {
      updateResult(testName, "error", `Network error: ${error}`);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setResults([]);

    await testEnvironmentVariables();

    // Test all three plans
    await testCheckoutSession(
      "Basic Plan",
      process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID ||
        "price_1Rt6YfIJX4ete5hNsKN3AMf3"
    );
    await testCheckoutSession(
      "Professional Plan",
      process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID ||
        "price_1Rt5hgIJX4ete5hNG48LhVPM"
    );
    await testCheckoutSession(
      "Enterprise Plan",
      process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID ||
        "price_1Rt5i4IJX4ete5hNIUKmyZXA"
    );

    setIsRunning(false);
  };

  const openCheckoutUrl = (url: string) => {
    window.open(url, "_blank");
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Stripe Integration Test Suite
        </h1>
        <p className="text-muted-foreground">
          Test your Stripe integration and environment configuration
        </p>
        {user ? (
          <Badge variant="outline" className="mt-2">
            Testing as: {user.email}
          </Badge>
        ) : (
          <Badge variant="secondary" className="mt-2">
            Testing in anonymous mode
          </Badge>
        )}
      </div>

      <div className="grid gap-6">
        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Test Controls</CardTitle>
            <CardDescription>
              Run comprehensive tests on your Stripe integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={runAllTests}
              disabled={isRunning}
              className="w-full"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                "Run All Tests"
              )}
            </Button>
            <Button
              onClick={() => clearResults(true)}
              variant="outline"
              className="w-full"
            >
              Clear Results
            </Button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={testEnvironmentVariables}
                disabled={isRunning}
              >
                Test Environment
              </Button>

              <Button
                variant="outline"
                onClick={() =>
                  testCheckoutSession(
                    "Basic Plan",
                    process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID ||
                      "price_1Rt6YfIJX4ete5hNsKN3AMf3"
                  )
                }
                disabled={isRunning}
              >
                Test Basic Plan
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  testCheckoutSession(
                    "Professional Plan",
                    process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID ||
                      "price_1Rt5hgIJX4ete5hNG48LhVPM"
                  )
                }
                disabled={isRunning}
              >
                Test Professional Plan
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  testCheckoutSession(
                    "Enterprise Plan",
                    process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID ||
                      "price_1Rt5i4IJX4ete5hNIUKmyZXA"
                  )
                }
                disabled={isRunning}
              >
                Test Enterprise Plan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                Results from your Stripe integration tests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        {result.status === "success" && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                        {result.status === "error" && (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        {result.status === "pending" && (
                          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                        )}
                        {result.name}
                      </h3>
                      <Badge
                        variant={
                          result.status === "success"
                            ? "default"
                            : result.status === "error"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {result.status}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">
                      {result.message}
                    </p>

                    {result.details && (
                      <div className="mt-2">
                        {result.details.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCheckoutUrl(result.details.url)}
                            className="mr-2 mb-2"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Open Checkout
                          </Button>
                        )}

                        <Separator className="my-2" />

                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            View Details
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Environment Info */}
        <Card>
          <CardHeader>
            <CardTitle>Environment Information</CardTitle>
            <CardDescription>Current environment configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Supabase URL:</strong>
                <br />
                <code className="text-xs bg-muted p-1 rounded">
                  {process.env.NEXT_PUBLIC_SUPABASE_URL || "Not set"}
                </code>
              </div>
              <div>
                <strong>App URL:</strong>
                <br />
                <code className="text-xs bg-muted p-1 rounded">
                  {process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}
                </code>
              </div>
              <div>
                <strong>Basic Price ID:</strong>
                <br />
                <code className="text-xs bg-muted p-1 rounded">
                  {process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID || "Not set"}
                </code>
              </div>
              <div>
                <strong>Professional Price ID:</strong>
                <br />
                <code className="text-xs bg-muted p-1 rounded">
                  {process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID ||
                    "Not set"}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

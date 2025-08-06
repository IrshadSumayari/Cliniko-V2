"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, SettingsIcon, User, CheckCircle, AlertCircle, Zap, Bell } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import ApiHelpTooltip from "@/components/api-help-tooltip"

interface SettingsProps {
  onBack?: () => void
}

export default function Settings({ onBack }: SettingsProps) {
  const { user } = useAuth()
  const [selectedPMS, setSelectedPMS] = useState(user?.pmsType || "")
  const [apiKey, setApiKey] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle")

  const pmsOptions = [
    { value: "cliniko", label: "Cliniko", description: "Popular practice management system" },
    { value: "nookal", label: "Nookal", description: "Comprehensive clinic management" },
    { value: "halaxy", label: "Halaxy", description: "All-in-one practice solution" },
    { value: "other", label: "Other", description: "Contact us for custom integration" },
  ]

  const handleConnect = async () => {
    if (!selectedPMS || !apiKey) return

    setIsConnecting(true)

    // Simulate API connection
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Simulate success/failure
    const success = Math.random() > 0.3
    setConnectionStatus(success ? "success" : "error")
    setIsConnecting(false)
  }

  const handleTestConnection = async () => {
    setIsConnecting(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setConnectionStatus("success")
    setIsConnecting(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Header */}
      <header className="border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              <h1 className="text-xl font-semibold">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="integration" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px] bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <TabsTrigger value="integration">PMS Integration</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="integration" className="space-y-6">
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Practice Management System Integration
                </CardTitle>
                <CardDescription>Connect your PMS to sync patient data and appointments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* PMS Selection */}
                <div className="space-y-2">
                  <Label htmlFor="pms-select">Select your PMS</Label>
                  <Select value={selectedPMS} onValueChange={setSelectedPMS}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose your practice management system" />
                    </SelectTrigger>
                    <SelectContent>
                      {pmsOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            <span className="text-xs text-muted-foreground">{option.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* API Key Input */}
                {selectedPMS && selectedPMS !== "other" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="api-key">API Key</Label>
                      <ApiHelpTooltip pmsName={pmsOptions.find((p) => p.value === selectedPMS)?.label || ""} />
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="api-key"
                        type="password"
                        placeholder="Enter your API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={handleConnect} disabled={!apiKey || isConnecting} className="min-w-[100px]">
                        {isConnecting ? "Connecting..." : "Connect"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Connection Status */}
                {connectionStatus === "success" && (
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      Successfully connected to {pmsOptions.find((p) => p.value === selectedPMS)?.label}! Your data will
                      sync automatically.
                    </AlertDescription>
                  </Alert>
                )}

                {connectionStatus === "error" && (
                  <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 dark:text-red-200">
                      Failed to connect. Please check your API key and try again.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Test Connection */}
                {connectionStatus === "success" && (
                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="default"
                        className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                      <span className="text-sm">{pmsOptions.find((p) => p.value === selectedPMS)?.label}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleTestConnection}>
                      Test Connection
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>Update your personal and clinic information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" defaultValue={user?.firstName} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" defaultValue={user?.lastName} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={user?.email} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clinicName">Clinic Name</Label>
                  <Input id="clinicName" defaultValue={user?.clinicName} />
                </div>

                <Button>Save Changes</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>Configure how you want to receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center py-12">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Notification Settings</h3>
                  <p className="text-muted-foreground">
                    Notification preferences will be available after PMS integration
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Users, Calendar, TrendingUp, Clock, CheckCircle, AlertCircle, User, Phone, Mail } from "lucide-react"
import DashboardHeader from "@/components/dashboard-header"

interface DashboardProps {
  onNavigate?: (view: "settings" | "onboarding") => void
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [isSync, setIsSync] = useState(false)

  const handleSync = async () => {
    setIsSync(true)
    // Simulate sync process
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsSync(false)
  }

  // Mock data for demonstration
  const stats = [
    {
      title: "Total Patients",
      value: "1,234",
      change: "+12%",
      icon: Users,
      trend: "up",
    },
    {
      title: "Today's Appointments",
      value: "28",
      change: "+5%",
      icon: Calendar,
      trend: "up",
    },
    {
      title: "Revenue This Month",
      value: "$45,678",
      change: "+18%",
      icon: TrendingUp,
      trend: "up",
    },
    {
      title: "Avg Session Duration",
      value: "45 min",
      change: "-2%",
      icon: Clock,
      trend: "down",
    },
  ]

  const recentSessions = [
    {
      id: 1,
      patient: "Sarah Johnson",
      time: "2:30 PM",
      type: "Initial Assessment",
      status: "completed",
      duration: "60 min",
    },
    {
      id: 2,
      patient: "Mike Chen",
      time: "3:45 PM",
      type: "Follow-up",
      status: "in-progress",
      duration: "45 min",
    },
    {
      id: 3,
      patient: "Emma Davis",
      time: "4:30 PM",
      type: "Treatment",
      status: "scheduled",
      duration: "30 min",
    },
  ]

  const upcomingAppointments = [
    {
      id: 1,
      patient: "John Smith",
      time: "9:00 AM",
      date: "Tomorrow",
      type: "Initial Assessment",
      phone: "+1 (555) 123-4567",
      email: "john.smith@email.com",
    },
    {
      id: 2,
      patient: "Lisa Wilson",
      time: "10:30 AM",
      date: "Tomorrow",
      type: "Follow-up",
      phone: "+1 (555) 987-6543",
      email: "lisa.wilson@email.com",
    },
    {
      id: 3,
      patient: "David Brown",
      time: "2:00 PM",
      date: "Tomorrow",
      type: "Treatment",
      phone: "+1 (555) 456-7890",
      email: "david.brown@email.com",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      <DashboardHeader onNavigate={onNavigate} isSync={isSync} onSync={handleSync} />

      <main className="container mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <Card
                key={index}
                className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className={`text-xs ${stat.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                    {stat.change} from last month
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px] bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="patients">Patients</TabsTrigger>
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Sessions */}
              <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Sessions
                  </CardTitle>
                  <CardDescription>Today's completed and ongoing sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-4">
                      {recentSessions.map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <span className="font-medium">{session.patient}</span>
                              <span className="text-sm text-muted-foreground">{session.type}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                session.status === "completed"
                                  ? "default"
                                  : session.status === "in-progress"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {session.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                              {session.status === "in-progress" && <AlertCircle className="h-3 w-3 mr-1" />}
                              {session.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">{session.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Performance Metrics
                  </CardTitle>
                  <CardDescription>This month's key performance indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Patient Satisfaction</span>
                      <span>94%</span>
                    </div>
                    <Progress value={94} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Appointment Utilization</span>
                      <span>87%</span>
                    </div>
                    <Progress value={87} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Treatment Success Rate</span>
                      <span>91%</span>
                    </div>
                    <Progress value={91} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Revenue Target</span>
                      <span>76%</span>
                    </div>
                    <Progress value={76} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="patients" className="space-y-6">
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Patient Management
                </CardTitle>
                <CardDescription>Manage your patient database and records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Patient Management</h3>
                  <p className="text-muted-foreground mb-4">Connect your PMS to view and manage patient records</p>
                  <Button onClick={() => onNavigate?.("settings")}>Configure PMS Integration</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appointments" className="space-y-6">
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Appointments
                </CardTitle>
                <CardDescription>Tomorrow's scheduled appointments</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {upcomingAppointments.map((appointment, index) => (
                      <div key={appointment.id}>
                        <div className="flex items-start justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                          <div className="flex items-start gap-4">
                            <div className="p-2 rounded-full bg-primary/10">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="font-medium">{appointment.patient}</h4>
                              <p className="text-sm text-muted-foreground">{appointment.type}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {appointment.phone}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {appointment.email}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{appointment.time}</div>
                            <div className="text-sm text-muted-foreground">{appointment.date}</div>
                          </div>
                        </div>
                        {index < upcomingAppointments.length - 1 && <Separator className="my-4" />}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

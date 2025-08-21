"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Calendar,
  Clock,
  Bell,
  AlertTriangle,
  CheckCircle,
  User,
  Edit,
  Archive,
  MoreHorizontal,
} from "lucide-react";

const AnimatedDashboard = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [animationStep, setAnimationStep] = useState(0);

  // Mock patient data for the animated dashboard
  const patients = [
    {
      id: 1,
      name: "Sarah Johnson",
      program: "EPC",
      sessions: "4/5",
      nextAppt: "Dec 15",
      status: "warning",
      physio: "Dr. Smith",
      location: "Main Clinic",
    },
    {
      id: 2,
      name: "Michael Chen",
      program: "Workers Comp",
      sessions: "8/12",
      nextAppt: "Dec 18",
      status: "good",
      physio: "Dr. Wilson",
      location: "North Branch",
    },
    {
      id: 3,
      name: "Emma Davis",
      program: "EPC",
      sessions: "1/5",
      nextAppt: "Dec 20",
      status: "good",
      physio: "Dr. Smith",
      location: "Main Clinic",
    },
    {
      id: 4,
      name: "James Wilson",
      program: "Workers Comp",
      sessions: "9/10",
      nextAppt: "Dec 22",
      status: "critical",
      physio: "Dr. Brown",
      location: "South Branch",
    },
  ];

  const stats = [
    {
      label: "Active Patients",
      value: "142",
      icon: Users,
      color: "text-blue-600",
    },
    {
      label: "Sessions This Week",
      value: "89",
      icon: Calendar,
      color: "text-green-600",
    },
    {
      label: "Action Needed",
      value: "8",
      icon: Bell,
      color: "text-orange-600",
    },
    {
      label: "Pending Approvals",
      value: "3",
      icon: Clock,
      color: "text-purple-600",
    },
  ];

  const tabs = [
    { id: "all", label: "All Patients", count: 142, color: "bg-primary" },
    { id: "action", label: "Action Needed", count: 8, color: "bg-warning" },
    { id: "pending", label: "Pending", count: 3, color: "bg-blue-500" },
    { id: "archived", label: "Archived", count: 24, color: "bg-muted" },
  ];

  // Animation cycle
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationStep((prev) => (prev + 1) % 4);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <Bell className="h-4 w-4 text-orange-500" />;
      case "good":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getProgramBadgeClass = (program: string) => {
    switch (program) {
      case "EPC":
        return "bg-green-100 text-green-800 border-green-200";
      case "Workers Comp":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Dashboard Container */}
      <Card className="shadow-2xl border-0 bg-white/95 dark:bg-slate-800/80 backdrop-blur-sm">
        <CardContent className="p-0">
          {/* Dashboard Header */}
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-6 border-b border-border/50">
            {/* Browser Header */}
            <div className="bg-card border-b border-border p-4 flex items-center gap-3 mb-2">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive"></div>
                <div className="w-3 h-3 rounded-full bg-warning"></div>
                <div className="w-3 h-3 rounded-full bg-success"></div>
              </div>
              <div className="text-sm text-muted-foreground">
                MyPhysioFlow Dashboard
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className={`bg-white/80 dark:bg-gray-500/10 p-4 rounded-lg border border-border/30 transition-all duration-500 ${
                    animationStep === index ? "scale-105 shadow-lg" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    <div>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className="text-xs text-muted-foreground">
                        {stat.label}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="p-6 pb-0">
            <div className="flex gap-1 mb-6 bg-muted/30 p-1 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-white dark:bg-gray-600/15 shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${tab.color}`}></div>
                  <span>{tab.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {tab.count}
                  </Badge>
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Filter by:
                </span>
                <select className="text-sm border border-border rounded px-2 py-1 bg-background">
                  <option>All Physios</option>
                  <option>Dr. Smith</option>
                  <option>Dr. Wilson</option>
                  <option>Dr. Brown</option>
                </select>
                <select className="text-sm border border-border rounded px-2 py-1 bg-background">
                  <option>All Locations</option>
                  <option>Main Clinic</option>
                  <option>North Branch</option>
                  <option>South Branch</option>
                </select>
              </div>
            </div>
          </div>

          {/* Patient List */}
          <div className="px-6 pb-6">
            <div className="space-y-3">
              {patients.map((patient, index) => (
                <div
                  key={patient.id}
                  className={`bg-card border border-border rounded-lg p-4 transition-all duration-500 hover:shadow-md ${
                    animationStep === 1 && index === 0
                      ? "ring-2 ring-primary/20 bg-primary/5"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-muted/50 rounded-full">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-semibold">{patient.name}</h4>
                          <Badge
                            className={`text-xs ${getProgramBadgeClass(
                              patient.program
                            )}`}
                          >
                            {patient.program}
                          </Badge>
                          {getStatusIcon(patient.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Sessions: {patient.sessions}</span>
                          <span>Next: {patient.nextAppt}</span>
                          <span>{patient.physio}</span>
                          <span>{patient.location}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 bg-transparent"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 bg-transparent"
                      >
                        <Archive className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 bg-transparent"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Callout */}
            {animationStep === 2 && (
              <div className="mt-6 p-4 bg-gradient-to-r from-warning/10 to-warning/5 border border-warning/20 rounded-lg animate-fade-in">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <div>
                    <p className="font-semibold text-warning">
                      Action Required
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Sarah Johnson has 1 session remaining. Consider booking
                      renewal appointment.
                    </p>
                  </div>
                  <Button size="sm" className="ml-auto">
                    Book Renewal
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Feature Highlights */}
      {/* <div className="mt-8 grid md:grid-cols-3 gap-4 text-center">
        <div className="p-4">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <h4 className="font-semibold mb-2">Patient Overview</h4>
          <p className="text-sm text-muted-foreground">
            See all patients with session counts and status at a glance
          </p>
        </div>
        <div className="p-4">
          <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Bell className="h-6 w-6 text-warning" />
          </div>
          <h4 className="font-semibold mb-2">Smart Alerts</h4>
          <p className="text-sm text-muted-foreground">
            Automatic notifications when patients need attention
          </p>
        </div>
        <div className="p-4">
          <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-6 w-6 text-green-500" />
          </div>
          <h4 className="font-semibold mb-2">Easy Actions</h4>
          <p className="text-sm text-muted-foreground">
            Quick edit, archive, and manage patient quotas
          </p>
        </div>
      </div> */}
    </div>
  );
};

export default AnimatedDashboard;

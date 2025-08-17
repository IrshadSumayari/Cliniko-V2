"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Users,
  Search,
  Filter,
  Activity,
} from "lucide-react";

export default function TutorialCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const sections = [
    {
      icon: Activity,
      title: "KPI Stats",
      description:
        "Monitor your practice's key metrics - active patients, remaining sessions, and urgent actions needed.",
    },
    {
      icon: Search,
      title: "Search & Filters",
      description:
        "Quickly find patients by name or filter by program (EPC/WC), physio, or location.",
    },
    {
      icon: Filter,
      title: "Patient Tabs",
      description:
        "Organize by priority: All Patients, Action Needed (urgent), Pending (awaiting approval), and Archived.",
    },
    {
      icon: Users,
      title: "Patient Cards",
      description:
        "Complete view with sessions used/remaining, next appointment, alerts, and quick actions. Color-coded for instant status recognition.",
    },
  ];

  if (!isVisible) return null;

  return (
    <Card className="mb-6 border-primary/20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Dashboard Guide</CardTitle>
              </div>
              <Button variant="ghost" size="sm">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid gap-4 md:grid-cols-2">
              {sections.map((section, index) => (
                <div
                  key={index}
                  className="flex gap-3 p-3 rounded-lg bg-muted/20 border border-border/50"
                >
                  <section.icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-sm mb-1">
                      {section.title}
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {section.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

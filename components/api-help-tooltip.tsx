"use client";

import { HelpCircle, ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface ApiHelpTooltipProps {
  pmsName: string;
}

export default function ApiHelpTooltip({ pmsName }: ApiHelpTooltipProps) {
  const getHelpContent = () => {
    switch (pmsName) {
      case "Cliniko":
        return {
          steps: [
            "Login to Cliniko → Settings",
            "Go to Developer → API Keys",
            "Click 'Generate new API key'",
            "Copy the key (starts with 'ck_')",
          ],
          url: "https://support.cliniko.com/hc/en-us/articles/115003485526-API-Keys",
        };
      case "Nookal":
        return {
          steps: [
            "Login to Nookal → Setup",
            "Go to System → API Management",
            "Click 'Create API Key'",
            "Copy the generated key (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)",
          ],
          url: "https://help.nookal.com/article/api-access",
        };
      case "Halaxy":
        return {
          steps: [
            "Login to Halaxy → Settings",
            "Go to Integrations → API",
            "Click 'Generate API Key'",
            "Copy the key (starts with 'hx_')",
          ],
          url: "https://help.halaxy.com/api-integration",
        };
      default:
        return {
          steps: ["Contact your PMS provider for API access"],
          url: "",
        };
    }
  };

  const helpContent = getHelpContent();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
            <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-4">
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">
              Where to find your {pmsName} API key:
            </h4>
            <ol className="text-xs space-y-1">
              {helpContent.steps.map((step, index) => (
                <li key={index} className="flex gap-2">
                  <span className="font-medium">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            {helpContent.url && (
              <a
                href={helpContent.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View documentation
              </a>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

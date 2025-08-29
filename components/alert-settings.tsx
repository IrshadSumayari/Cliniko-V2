import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Settings, Bell, Mail, Clock, Users, Save, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AlertSettingsProps {
  onClose: () => void;
}

const AlertSettings = ({ onClose }: AlertSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    quotaThreshold: 2,
    customEmail: "",
    notifyOnPending: true,
    notifyOnQuota: true,
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth-token');
      if (!token) {
        throw new Error('No auth token found');
      }

      const response = await fetch('/api/notifications/settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load settings');
      }

      const result = await response.json();
      if (result.success) {
        setSettings(result.data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "Error Loading Settings",
        description: "Using default settings. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('auth-token');
      if (!token) {
        throw new Error('No auth token found');
      }

      const response = await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      const result = await response.json();
      if (result.success) {
        toast({
          title: "Alert Settings Saved",
          description: "Your notification preferences have been updated successfully.",
        });
        onClose();
      } else {
        throw new Error(result.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error Saving Settings",
        description: "Failed to save your settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[100] animate-fade-in">
        <Card className="w-full max-w-2xl mx-4 bg-background border-border shadow-luxury">
          <div className="p-6 flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading notification settings...</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[100] animate-fade-in">
      <Card className="w-full max-w-2xl mx-4 bg-background border-border shadow-luxury">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/20 rounded-lg">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Alert Settings</h2>
                <p className="text-sm text-muted-foreground">
                  Configure when you receive notifications
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-6">
            {/* Email Notifications */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <h3 className="font-medium">Email Notifications</h3>
              </div>

              <div className="grid gap-4 pl-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Enable Email Alerts</p>
                    <p className="text-xs text-muted-foreground">
                      Receive email notifications for important events
                    </p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) =>
                      handleSettingChange("emailNotifications", checked)
                    }
                  />
                </div>

                {settings.emailNotifications && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          Session Quota Threshold
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Alert when sessions remaining equals this number
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          max="5"
                          value={settings.quotaThreshold}
                          onChange={(e) =>
                            handleSettingChange(
                              "quotaThreshold",
                              parseInt(e.target.value),
                            )
                          }
                          className="w-16 text-center"
                        />
                        <span className="text-xs text-muted-foreground">
                          sessions
                        </span>
                      </div>
                    </div>

                    <div className="bg-muted/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="text-xs space-y-1">
                          <p className="font-medium">Email Preview:</p>
                          <div className="bg-background border rounded p-3 text-xs">
                            <p className="font-semibold">
                              ⚠️ MyPhysioFlow Alert
                            </p>
                            <p className="mt-1">
                              <strong>Action Required:</strong> Sarah Johnson
                              (EPC #12345) has {settings.quotaThreshold} session
                              {settings.quotaThreshold !== 1 ? "s" : ""}{" "}
                              remaining.
                              {settings.quotaThreshold <= 2 &&
                                " Referral may need renewal soon."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          Custom Email Address
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Override default notification email (optional)
                        </p>
                      </div>
                      <Input
                        type="email"
                        placeholder="alerts@clinic.com"
                        value={settings.customEmail}
                        onChange={(e) =>
                          handleSettingChange("customEmail", e.target.value)
                        }
                        className="w-48"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-border">
            <div className="text-xs text-muted-foreground">
              Changes will apply to future notifications
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AlertSettings;

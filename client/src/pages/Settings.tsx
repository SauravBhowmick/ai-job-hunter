import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "wouter";
import { 
  Briefcase, Zap, User, BarChart3, Settings as SettingsIcon, Sparkles,
  Save, Bell, Mail, RefreshCw, Shield
} from "lucide-react";
import { useState, useEffect } from "react";

function Sidebar() {
  return (
    <aside className="w-64 border-r border-border bg-card/50 p-4 flex flex-col h-screen sticky top-0">
      <div className="mb-8">
        <h1 className="text-xl font-bold gradient-text flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Job Hunter
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Smart job matching & auto-apply</p>
      </div>
      
      <nav className="flex-1 space-y-1">
        <Link href="/">
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Briefcase className="h-4 w-4" />
            Job Dashboard
          </Button>
        </Link>
        <Link href="/applications">
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Zap className="h-4 w-4" />
            Applications
          </Button>
        </Link>
        <Link href="/analytics">
          <Button variant="ghost" className="w-full justify-start gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
        </Link>
        <Link href="/profile">
          <Button variant="ghost" className="w-full justify-start gap-2">
            <User className="h-4 w-4" />
            Profile
          </Button>
        </Link>
        <Link href="/settings">
          <Button variant="ghost" className="w-full justify-start gap-2 bg-primary/10">
            <SettingsIcon className="h-4 w-4" />
            Settings
          </Button>
        </Link>
      </nav>
    </aside>
  );
}

export default function Settings() {
  const { isAuthenticated } = useAuth();
  
  const { data: profile, isLoading, refetch } = trpc.profile.get.useQuery(undefined, { enabled: isAuthenticated });
  const { data: patterns } = trpc.autoApply.getPatterns.useQuery(undefined, { enabled: isAuthenticated });
  
  const [notificationEmail, setNotificationEmail] = useState("bhowmick.saurav@outlook.com");
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(false);
  const [relevanceThreshold, setRelevanceThreshold] = useState(50);
  
  useEffect(() => {
    if (profile) {
      setNotificationEmail(profile.notificationEmail || "bhowmick.saurav@outlook.com");
      setAutoApplyEnabled(profile.autoApplyEnabled || false);
      setRelevanceThreshold(profile.relevanceThreshold || 50);
    }
  }, [profile]);
  
  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Settings saved!");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const testNotificationMutation = trpc.notifications.sendTest.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Test notification sent to ${data.email}`);
      } else {
        toast.error("Failed to send test notification");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const runAutoApplyMutation = trpc.autoApply.run.useMutation({
    onSuccess: (data) => {
      toast.success(`Auto-apply complete: ${data.applied} applied, ${data.skipped} skipped`);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const handleSave = () => {
    updateMutation.mutate({
      notificationEmail,
      autoApplyEnabled,
      relevanceThreshold,
    });
  };
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please sign in to view settings</p>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Settings</h2>
            <p className="text-muted-foreground">Configure notifications and auto-apply preferences</p>
          </div>
          
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Email Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Email Notifications
                  </CardTitle>
                  <CardDescription>
                    Receive alerts when new matching jobs are found
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="notificationEmail">Notification Email</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          id="notificationEmail"
                          type="email"
                          className="pl-9"
                          value={notificationEmail}
                          onChange={(e) => setNotificationEmail(e.target.value)}
                          placeholder="your@email.com"
                        />
                      </div>
                      <Button 
                        variant="outline"
                        onClick={() => testNotificationMutation.mutate()}
                        disabled={testNotificationMutation.isPending}
                      >
                        {testNotificationMutation.isPending ? "Sending..." : "Test"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You'll receive email alerts when new jobs matching your profile are found
                    </p>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <RefreshCw className="h-4 w-4" />
                      <span><strong>Refresh Interval:</strong> Every 5 hours</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Jobs are automatically checked every 5 hours and you'll be notified of new matches
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              {/* Auto-Apply Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Auto-Apply
                  </CardTitle>
                  <CardDescription>
                    Automatically apply to jobs that match your application patterns
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Auto-Apply</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically submit applications to similar jobs
                      </p>
                    </div>
                    <Switch 
                      checked={autoApplyEnabled}
                      onCheckedChange={setAutoApplyEnabled}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Minimum Relevance Score: {relevanceThreshold}%</Label>
                    <Slider 
                      value={[relevanceThreshold]}
                      onValueChange={([v]) => setRelevanceThreshold(v)}
                      min={0}
                      max={100}
                      step={5}
                    />
                    <p className="text-xs text-muted-foreground">
                      Only jobs with a relevance score above this threshold will be considered for auto-apply
                    </p>
                  </div>
                  
                  {autoApplyEnabled && (
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <p className="text-sm font-medium mb-2">How Auto-Apply Works:</p>
                      <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Apply to jobs manually to teach the system your preferences</li>
                        <li>The system learns patterns from your manual applications</li>
                        <li>Similar jobs are automatically applied to based on learned patterns</li>
                        <li>All auto-applications are tracked separately in your history</li>
                      </ol>
                    </div>
                  )}
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => runAutoApplyMutation.mutate()}
                    disabled={runAutoApplyMutation.isPending || !autoApplyEnabled}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {runAutoApplyMutation.isPending ? "Running..." : "Run Auto-Apply Now"}
                  </Button>
                </CardContent>
              </Card>
              
              {/* Learned Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Learned Application Patterns
                  </CardTitle>
                  <CardDescription>
                    Patterns learned from your manual applications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {patterns && patterns.length > 0 ? (
                    <div className="space-y-3">
                      {patterns.map((pattern, i) => (
                        <div key={i} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline">{pattern.patternType}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {pattern.applicationCount} applications
                            </span>
                          </div>
                          {pattern.keywords && pattern.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {pattern.keywords.slice(0, 5).map((kw, j) => (
                                <Badge key={j} variant="secondary" className="text-xs">
                                  {kw}
                                </Badge>
                              ))}
                              {pattern.keywords.length > 5 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{pattern.keywords.length - 5} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No patterns learned yet</p>
                      <p className="text-xs mt-1">Apply to jobs manually to start building patterns</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Save Button */}
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

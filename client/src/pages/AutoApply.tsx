import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Link } from "wouter";
import { 
  Zap, Play, Settings2, History, Eye, Building2, MapPin, 
  Sparkles, Briefcase, BarChart3, User, Clock, Plus, X,
  CheckCircle2, XCircle, AlertCircle, TrendingUp
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
            <CheckCircle2 className="h-4 w-4" />
            Applications
          </Button>
        </Link>
        <Link href="/auto-apply">
          <Button variant="ghost" className="w-full justify-start gap-2 bg-primary/10">
            <Zap className="h-4 w-4" />
            Auto-Apply
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
      </nav>
    </aside>
  );
}

function CandidateCard({ candidate, onWhitelist, onBlacklist }: { 
  candidate: any; 
  onWhitelist: (company: string) => void;
  onBlacklist: (company: string) => void;
}) {
  const job = candidate.job;
  
  return (
    <Card className={`${candidate.wouldAutoApply ? 'border-green-500/50' : 'border-yellow-500/50'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-2">{job.title}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Building2 className="h-3.5 w-3.5" />
              <span className="truncate">{job.company || "Company not specified"}</span>
            </CardDescription>
          </div>
          <Badge className={candidate.wouldAutoApply ? "bg-green-500" : "bg-yellow-500"}>
            {candidate.autoApplyConfidence}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <MapPin className="h-3.5 w-3.5" />
          {job.location || "Location not specified"}
        </div>
        
        <div className="flex flex-wrap gap-2 mb-3">
          {candidate.wouldAutoApply ? (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Will Auto-Apply
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
              <AlertCircle className="h-3 w-3 mr-1" />
              Below Threshold
            </Badge>
          )}
          {candidate.isWhitelisted && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600">Whitelisted</Badge>
          )}
        </div>
        
        {job.company && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={() => onWhitelist(job.company)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Whitelist
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs text-destructive"
              onClick={() => onBlacklist(job.company)}
            >
              <X className="h-3 w-3 mr-1" />
              Blacklist
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompanyList({ 
  companies, 
  onRemove, 
  emptyMessage,
  variant 
}: { 
  companies: string[]; 
  onRemove: (company: string) => void;
  emptyMessage: string;
  variant: "whitelist" | "blacklist";
}) {
  if (companies.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  
  return (
    <div className="flex flex-wrap gap-2">
      {companies.map((company, i) => (
        <Badge 
          key={i} 
          variant="secondary" 
          className={`gap-1 ${variant === "whitelist" ? "bg-green-500/10" : "bg-red-500/10"}`}
        >
          {company}
          <button onClick={() => onRemove(company)} className="hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}

export default function AutoApply() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  
  const [newWhitelistCompany, setNewWhitelistCompany] = useState("");
  const [newBlacklistCompany, setNewBlacklistCompany] = useState("");
  
  const { data: stats, isLoading: statsLoading } = trpc.autoApply.getStats.useQuery(
    undefined, 
    { enabled: isAuthenticated }
  );
  
  const { data: candidates, isLoading: candidatesLoading } = trpc.autoApply.getCandidates.useQuery(
    undefined, 
    { enabled: isAuthenticated }
  );
  
  const { data: history, isLoading: historyLoading } = trpc.autoApply.getHistory.useQuery(
    { limit: 10 }, 
    { enabled: isAuthenticated }
  );
  
  const { data: profile } = trpc.profile.get.useQuery(undefined, { enabled: isAuthenticated });
  
  const [settings, setSettings] = useState({
    autoApplyEnabled: false,
    autoApplyConfidenceThreshold: 70,
    autoApplyMaxPerDay: 5,
    autoApplyNotifyEmail: true,
  });
  
  useEffect(() => {
    if (profile) {
      setSettings({
        autoApplyEnabled: profile.autoApplyEnabled || false,
        autoApplyConfidenceThreshold: profile.autoApplyConfidenceThreshold || 70,
        autoApplyMaxPerDay: profile.autoApplyMaxPerDay || 5,
        autoApplyNotifyEmail: profile.autoApplyNotifyEmail !== false,
      });
    }
  }, [profile]);
  
  const runMutation = trpc.autoApply.run.useMutation({
    onSuccess: (result) => {
      toast.success(`Auto-applied to ${result.applied} jobs!`);
      utils.autoApply.getStats.invalidate();
      utils.autoApply.getCandidates.invalidate();
      utils.autoApply.getHistory.invalidate();
      utils.applications.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const updateSettingsMutation = trpc.autoApply.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Settings updated");
      utils.profile.get.invalidate();
      utils.autoApply.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const addToWhitelistMutation = trpc.autoApply.addToWhitelist.useMutation({
    onSuccess: () => {
      toast.success("Company added to whitelist");
      utils.profile.get.invalidate();
      utils.autoApply.getCandidates.invalidate();
      setNewWhitelistCompany("");
    }
  });
  
  const addToBlacklistMutation = trpc.autoApply.addToBlacklist.useMutation({
    onSuccess: () => {
      toast.success("Company added to blacklist");
      utils.profile.get.invalidate();
      utils.autoApply.getCandidates.invalidate();
      setNewBlacklistCompany("");
    }
  });
  
  const removeFromWhitelistMutation = trpc.autoApply.removeFromWhitelist.useMutation({
    onSuccess: () => {
      utils.profile.get.invalidate();
      utils.autoApply.getCandidates.invalidate();
    }
  });
  
  const removeFromBlacklistMutation = trpc.autoApply.removeFromBlacklist.useMutation({
    onSuccess: () => {
      utils.profile.get.invalidate();
      utils.autoApply.getCandidates.invalidate();
    }
  });
  
  const handleSaveSettings = () => {
    updateSettingsMutation.mutate(settings);
  };
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please sign in to use auto-apply</p>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Zap className="h-6 w-6 text-primary" />
                Auto-Apply
              </h2>
              <p className="text-muted-foreground">
                Automatically apply to jobs matching your patterns
              </p>
            </div>
            <Button 
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending || !stats?.isEnabled}
            >
              <Play className="h-4 w-4 mr-2" />
              {runMutation.isPending ? "Running..." : "Run Auto-Apply"}
            </Button>
          </div>
          
          {/* Stats Cards */}
          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${stats?.isEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm text-muted-foreground">Status</span>
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {stats?.isEnabled ? "Enabled" : "Disabled"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">Applied Today</div>
                  <div className="text-2xl font-bold">
                    {stats?.appliedToday || 0} / {stats?.maxPerDay || 5}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">Learned Patterns</div>
                  <div className="text-2xl font-bold">{stats?.patternsCount || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">Last 30 Days</div>
                  <div className="text-2xl font-bold">{stats?.totalAppliedLast30Days || 0}</div>
                </CardContent>
              </Card>
            </div>
          )}
          
          <Tabs defaultValue="preview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>
            
            {/* Preview Tab */}
            <TabsContent value="preview">
              <Card>
                <CardHeader>
                  <CardTitle>Auto-Apply Candidates</CardTitle>
                  <CardDescription>
                    Jobs that match your learned patterns. Green = will auto-apply, Yellow = below confidence threshold.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {candidatesLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[1,2,3,4].map(i => <Skeleton key={i} className="h-48" />)}
                    </div>
                  ) : candidates && candidates.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {candidates.map((candidate: any, i: number) => (
                        <CandidateCard 
                          key={i} 
                          candidate={candidate}
                          onWhitelist={(c) => addToWhitelistMutation.mutate({ company: c })}
                          onBlacklist={(c) => addToBlacklistMutation.mutate({ company: c })}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No candidates found</h3>
                      <p className="text-muted-foreground">
                        Apply to some jobs manually to help the system learn your preferences.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Settings Tab */}
            <TabsContent value="settings">
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Auto-Apply Settings</CardTitle>
                    <CardDescription>Configure how auto-apply works for you</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="enabled">Enable Auto-Apply</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically apply to matching jobs
                        </p>
                      </div>
                      <Switch 
                        id="enabled"
                        checked={settings.autoApplyEnabled}
                        onCheckedChange={(checked) => setSettings(s => ({ ...s, autoApplyEnabled: checked }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Confidence Threshold: {settings.autoApplyConfidenceThreshold}%</Label>
                      <p className="text-sm text-muted-foreground">
                        Only auto-apply to jobs with confidence above this threshold
                      </p>
                      <Slider
                        value={[settings.autoApplyConfidenceThreshold]}
                        onValueChange={([v]) => setSettings(s => ({ ...s, autoApplyConfidenceThreshold: v }))}
                        min={50}
                        max={100}
                        step={5}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Max Applications Per Day: {settings.autoApplyMaxPerDay}</Label>
                      <p className="text-sm text-muted-foreground">
                        Limit how many auto-applications per day
                      </p>
                      <Slider
                        value={[settings.autoApplyMaxPerDay]}
                        onValueChange={([v]) => setSettings(s => ({ ...s, autoApplyMaxPerDay: v }))}
                        min={1}
                        max={20}
                        step={1}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="notify">Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified when auto-apply runs
                        </p>
                      </div>
                      <Switch 
                        id="notify"
                        checked={settings.autoApplyNotifyEmail}
                        onCheckedChange={(checked) => setSettings(s => ({ ...s, autoApplyNotifyEmail: checked }))}
                      />
                    </div>
                    
                    <Button onClick={handleSaveSettings} disabled={updateSettingsMutation.isPending}>
                      Save Settings
                    </Button>
                  </CardContent>
                </Card>
                
                {/* Company Lists */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-600">Company Whitelist</CardTitle>
                      <CardDescription>
                        Always auto-apply to these companies (lower confidence threshold)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Company name"
                          value={newWhitelistCompany}
                          onChange={(e) => setNewWhitelistCompany(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newWhitelistCompany) {
                              addToWhitelistMutation.mutate({ company: newWhitelistCompany });
                            }
                          }}
                        />
                        <Button 
                          onClick={() => addToWhitelistMutation.mutate({ company: newWhitelistCompany })}
                          disabled={!newWhitelistCompany}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <CompanyList 
                        companies={profile?.companyWhitelist || []}
                        onRemove={(c) => removeFromWhitelistMutation.mutate({ company: c })}
                        emptyMessage="No whitelisted companies"
                        variant="whitelist"
                      />
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-600">Company Blacklist</CardTitle>
                      <CardDescription>
                        Never auto-apply to these companies
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Company name"
                          value={newBlacklistCompany}
                          onChange={(e) => setNewBlacklistCompany(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newBlacklistCompany) {
                              addToBlacklistMutation.mutate({ company: newBlacklistCompany });
                            }
                          }}
                        />
                        <Button 
                          variant="destructive"
                          onClick={() => addToBlacklistMutation.mutate({ company: newBlacklistCompany })}
                          disabled={!newBlacklistCompany}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <CompanyList 
                        companies={profile?.companyBlacklist || []}
                        onRemove={(c) => removeFromBlacklistMutation.mutate({ company: c })}
                        emptyMessage="No blacklisted companies"
                        variant="blacklist"
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
            
            {/* History Tab */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Auto-Apply History</CardTitle>
                  <CardDescription>Recent auto-apply runs</CardDescription>
                </CardHeader>
                <CardContent>
                  {historyLoading ? (
                    <div className="space-y-4">
                      {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
                    </div>
                  ) : history && history.length > 0 ? (
                    <div className="space-y-4">
                      {history.map((log: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {new Date(log.runAt).toLocaleString()}
                              </span>
                              <Badge variant={log.status === "success" ? "default" : "secondary"}>
                                {log.status}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Scanned: {log.jobsScanned} | Matched: {log.jobsMatched} | 
                              Applied: {log.jobsApplied} | Skipped: {log.jobsSkipped}
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-green-600">
                            +{log.jobsApplied}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No history yet</h3>
                      <p className="text-muted-foreground">
                        Run auto-apply to see your history here.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

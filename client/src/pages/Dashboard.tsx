import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Link } from "wouter";
import { 
  Briefcase, MapPin, Building2, Clock, RefreshCw, Search, 
  Filter, Zap, Bell, BarChart3, User, Settings, LogOut,
  ExternalLink, ChevronRight, Sparkles
} from "lucide-react";
import { useState, useMemo } from "react";

function formatTimeAgo(date: Date | null): string {
  if (!date) return "Unknown";
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}

function getScoreClass(score: number | null): string {
  if (!score) return "score-low";
  if (score >= 70) return "score-high";
  if (score >= 40) return "score-medium";
  return "score-low";
}

function getSourceClass(source: string): string {
  return `source-${source}`;
}

function JobCard({ job, score, matchedKeywords, hasApplied }: { 
  job: any; 
  score: number | null; 
  matchedKeywords: string[] | null;
  hasApplied?: boolean;
}) {
  return (
    <Link href={`/job/${job.id}`}>
      <Card className="job-card cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg line-clamp-2">{job.title}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Building2 className="h-3.5 w-3.5" />
                <span className="truncate">{job.company || "Company not specified"}</span>
              </CardDescription>
            </div>
            <Badge className={`${getScoreClass(score)} shrink-0`}>
              {score || 0}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {job.location || "Location not specified"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatTimeAgo(job.postedAt)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={getSourceClass(job.source)}>
              {job.source.replace('_', ' ')}
            </Badge>
            {hasApplied && (
              <Badge variant="secondary" className="text-xs">Applied</Badge>
            )}
          </div>
          
          {matchedKeywords && matchedKeywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {matchedKeywords.slice(0, 3).map((kw, i) => (
                <Badge key={i} variant="outline" className="text-xs bg-primary/5">
                  {kw}
                </Badge>
              ))}
              {matchedKeywords.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{matchedKeywords.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function Sidebar({ user, onLogout }: { user: any; onLogout: () => void }) {
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
          <Button variant="ghost" className="w-full justify-start gap-2 bg-primary/10">
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
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </Link>
      </nav>
      
      <div className="border-t border-border pt-4 mt-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}

function RefreshStatus() {
  const { data: status, isLoading } = trpc.refresh.getStatus.useQuery();
  
  if (isLoading) return null;
  
  const nextRefresh = status?.nextRefresh ? new Date(status.nextRefresh) : null;
  const timeUntilRefresh = nextRefresh ? Math.max(0, Math.floor((nextRefresh.getTime() - Date.now()) / (1000 * 60))) : null;
  
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="relative">
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <div className="absolute inset-0 h-2 w-2 rounded-full bg-green-500 animate-ping opacity-75" />
      </div>
      <span>
        {status?.status === "overdue" 
          ? "Refresh available" 
          : timeUntilRefresh !== null 
            ? `Next refresh in ${Math.floor(timeUntilRefresh / 60)}h ${timeUntilRefresh % 60}m`
            : "Ready to refresh"
        }
      </span>
    </div>
  );
}

export default function Dashboard() {
  const { user, loading: authLoading, logout, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [minScore, setMinScore] = useState(0);
  const [maxAge, setMaxAge] = useState(48);
  
  const utils = trpc.useUtils();
  
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = trpc.jobs.list.useQuery(
    { 
      sources: selectedSource !== "all" ? [selectedSource] : undefined,
      minScore: minScore > 0 ? minScore : undefined,
      maxAgeHours: maxAge,
      limit: 50 
    },
    { enabled: isAuthenticated }
  );
  
  const { data: stats } = trpc.applications.getStats.useQuery(undefined, { enabled: isAuthenticated });
  
  const refreshMutation = trpc.jobs.refresh.useMutation({
    onSuccess: (data) => {
      toast.success(`Found ${data.jobsFound} jobs, ${data.newJobs} new!`);
      refetchJobs();
      utils.refresh.getStatus.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to refresh jobs: " + error.message);
    }
  });
  
  const notifyMutation = trpc.notifications.checkAndSend.useMutation({
    onSuccess: (data) => {
      if (data.notified) {
        toast.success(`Email sent with ${data.jobCount} matching jobs!`);
      } else {
        toast.info("No new jobs to notify about");
      }
    },
    onError: (error) => {
      toast.error("Failed to send notification: " + error.message);
    }
  });
  
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    if (!searchQuery) return jobs;
    
    const query = searchQuery.toLowerCase();
    return jobs.filter(j => 
      j.job.title.toLowerCase().includes(query) ||
      j.job.company?.toLowerCase().includes(query) ||
      j.job.location?.toLowerCase().includes(query)
    );
  }, [jobs, searchQuery]);
  
  if (authLoading) {
    return (
      <div className="flex h-screen">
        <div className="w-64 border-r border-border bg-card/50 p-4">
          <Skeleton className="h-8 w-32 mb-8" />
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </div>
        <main className="flex-1 p-6">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48" />)}
          </div>
        </main>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">AI Job Hunter</CardTitle>
            <CardDescription>
              Smart job matching and auto-apply platform for data science and energy sector roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <a href={getLoginUrl()}>Sign in to continue</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar user={user} onLogout={logout} />
      
      <main className="flex-1 p-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Job Dashboard</h2>
            <RefreshStatus />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => notifyMutation.mutate()}
              disabled={notifyMutation.isPending}
            >
              <Bell className="h-4 w-4 mr-2" />
              Send Alert
            </Button>
            <Button 
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
              Refresh Jobs
            </Button>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{filteredJobs.length}</div>
              <p className="text-xs text-muted-foreground">Available Jobs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">Total Applications</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats?.automatic || 0}</div>
              <p className="text-xs text-muted-foreground">Auto-Applied</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats?.interview || 0}</div>
              <p className="text-xs text-muted-foreground">Interviews</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-1.5 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search jobs..." 
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="w-40">
                <label className="text-sm font-medium mb-1.5 block">Source</label>
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="indeed">Indeed</SelectItem>
                    <SelectItem value="stepstone">StepStone</SelectItem>
                    <SelectItem value="energy_jobline">Energy Jobline</SelectItem>
                    <SelectItem value="datacareer">DataCareer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-48">
                <label className="text-sm font-medium mb-1.5 block">Min Score: {minScore}%</label>
                <Slider 
                  value={[minScore]} 
                  onValueChange={([v]) => setMinScore(v)}
                  max={100}
                  step={5}
                />
              </div>
              
              <div className="w-48">
                <label className="text-sm font-medium mb-1.5 block">Max Age: {maxAge}h</label>
                <Slider 
                  value={[maxAge]} 
                  onValueChange={([v]) => setMaxAge(v)}
                  max={168}
                  step={6}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Job Grid */}
        {jobsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No jobs found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your filters or refresh to find new opportunities
              </p>
              <Button onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Jobs
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.map(({ job, score, matchedKeywords }) => (
              <JobCard 
                key={job.id} 
                job={job} 
                score={score} 
                matchedKeywords={matchedKeywords}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

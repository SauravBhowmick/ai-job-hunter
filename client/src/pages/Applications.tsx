import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Link } from "wouter";
import { 
  Briefcase, MapPin, Building2, Clock, Zap, User, 
  CheckCircle2, XCircle, Calendar, ArrowLeft, Sparkles,
  BarChart3, Settings
} from "lucide-react";

function formatDate(date: Date | null): string {
  if (!date) return "Unknown";
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { class: string; label: string }> = {
    pending: { class: "status-pending", label: "Pending" },
    submitted: { class: "status-submitted", label: "Submitted" },
    viewed: { class: "bg-blue-500/20 text-blue-400", label: "Viewed" },
    interview: { class: "status-interview", label: "Interview" },
    accepted: { class: "status-accepted", label: "Accepted" },
    rejected: { class: "status-rejected", label: "Rejected" },
  };
  
  const config = statusConfig[status] || statusConfig.pending;
  return <Badge className={config.class}>{config.label}</Badge>;
}

function ApplicationCard({ application, job, onStatusChange }: { 
  application: any; 
  job: any;
  onStatusChange: (id: number, status: string) => void;
}) {
  return (
    <Card className="job-card">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Link href={`/job/${job.id}`}>
              <h3 className="font-semibold hover:text-primary transition-colors line-clamp-1">
                {job.title}
              </h3>
            </Link>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {job.company || "Unknown"}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {job.location || "Unknown"}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {getStatusBadge(application.status)}
            <Badge variant="outline" className={application.applicationType === 'automatic' ? 'bg-primary/10' : ''}>
              {application.applicationType === 'automatic' ? (
                <><Zap className="h-3 w-3 mr-1" /> Auto</>
              ) : (
                <><User className="h-3 w-3 mr-1" /> Manual</>
              )}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Applied {formatDate(application.appliedAt)}
            </span>
            {application.responseAt && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Response {formatDate(application.responseAt)}
              </span>
            )}
          </div>
          
          <Select 
            value={application.status} 
            onValueChange={(value) => onStatusChange(application.id, value)}
          >
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="interview">Interview</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {application.notes && (
          <p className="text-sm text-muted-foreground mt-3 p-2 bg-muted/50 rounded">
            {application.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

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
          <Button variant="ghost" className="w-full justify-start gap-2 bg-primary/10">
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
    </aside>
  );
}

export default function Applications() {
  const { isAuthenticated } = useAuth();
  
  const { data: applications, isLoading, refetch } = trpc.applications.list.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  
  const { data: stats } = trpc.applications.getStats.useQuery(undefined, { enabled: isAuthenticated });
  
  const updateStatusMutation = trpc.applications.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const handleStatusChange = (applicationId: number, status: string) => {
    updateStatusMutation.mutate({ 
      applicationId, 
      status: status as any 
    });
  };
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please sign in to view applications</p>
      </div>
    );
  }
  
  const manualApps = applications?.filter(a => a.application.applicationType === 'manual') || [];
  const autoApps = applications?.filter(a => a.application.applicationType === 'automatic') || [];
  
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Applications</h2>
          <p className="text-muted-foreground">Track your job applications and their status</p>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats?.manual || 0}</div>
              <p className="text-xs text-muted-foreground">Manual</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats?.automatic || 0}</div>
              <p className="text-xs text-muted-foreground">Automatic</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-500">{stats?.interview || 0}</div>
              <p className="text-xs text-muted-foreground">Interviews</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-primary">{stats?.accepted || 0}</div>
              <p className="text-xs text-muted-foreground">Accepted</p>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="all">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All ({applications?.length || 0})</TabsTrigger>
            <TabsTrigger value="manual">Manual ({manualApps.length})</TabsTrigger>
            <TabsTrigger value="automatic">Automatic ({autoApps.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            {isLoading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : applications?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No applications yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start applying to jobs to track your progress
                  </p>
                  <Button asChild>
                    <Link href="/">Browse Jobs</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {applications?.map(({ application, job }) => (
                  <ApplicationCard 
                    key={application.id}
                    application={application}
                    job={job}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="manual">
            {manualApps.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No manual applications</h3>
                  <p className="text-muted-foreground">
                    Apply to jobs manually to see them here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {manualApps.map(({ application, job }) => (
                  <ApplicationCard 
                    key={application.id}
                    application={application}
                    job={job}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="automatic">
            {autoApps.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No automatic applications</h3>
                  <p className="text-muted-foreground">
                    Enable auto-apply in settings to automatically apply to matching jobs
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {autoApps.map(({ application, job }) => (
                  <ApplicationCard 
                    key={application.id}
                    application={application}
                    job={job}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

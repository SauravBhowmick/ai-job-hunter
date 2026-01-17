import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Link, useParams, useLocation } from "wouter";
import { 
  ArrowLeft, MapPin, Building2, Clock, ExternalLink, 
  Briefcase, DollarSign, Send, Sparkles
} from "lucide-react";
import { useState } from "react";

function formatTimeAgo(date: Date | null): string {
  if (!date) return "Unknown";
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  }
}

function getScoreClass(score: number): string {
  if (score >= 70) return "score-high";
  if (score >= 40) return "score-medium";
  return "score-low";
}

export default function JobDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [notes, setNotes] = useState("");
  
  const jobId = parseInt(params.id || "0");
  
  const { data: job, isLoading } = trpc.jobs.getById.useQuery(
    { jobId },
    { enabled: isAuthenticated && jobId > 0 }
  );
  
  const applyMutation = trpc.applications.submitApplication.useMutation({
    onSuccess: () => {
      toast.success("Application submitted successfully!");
      setLocation("/applications");
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please sign in to view job details</p>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }
  
  if (!job) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Job not found</h2>
          <p className="text-muted-foreground mb-4">This job may have been removed or is no longer available.</p>
          <Button asChild>
            <Link href="/">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Jobs
            </Button>
          </Link>
          
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-2">{job.title}</h1>
              <div className="flex flex-wrap gap-4 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  {job.company || "Company not specified"}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {job.location || "Location not specified"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Posted {formatTimeAgo(job.postedAt)}
                </span>
              </div>
            </div>
            
            <Badge className={`${getScoreClass(job.relevanceScore)} text-lg px-3 py-1`}>
              {job.relevanceScore}% Match
            </Badge>
          </div>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Job Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{job.description || "No description available."}</p>
              </CardContent>
            </Card>
            
            {job.requirements && (
              <Card>
                <CardHeader>
                  <CardTitle>Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{job.requirements}</p>
                </CardContent>
              </Card>
            )}
            
            {job.matchedKeywords && job.matchedKeywords.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Matched Keywords
                  </CardTitle>
                  <CardDescription>
                    These keywords from your profile match this job
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {job.matchedKeywords.map((kw, i) => (
                      <Badge key={i} variant="secondary" className="bg-primary/10">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Job Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Source</p>
                  <Badge variant="outline" className={`source-${job.source} mt-1`}>
                    {job.source.replace('_', ' ')}
                  </Badge>
                </div>
                
                {job.jobType && (
                  <div>
                    <p className="text-sm text-muted-foreground">Job Type</p>
                    <p className="font-medium">{job.jobType}</p>
                  </div>
                )}
                
                {job.salary && (
                  <div>
                    <p className="text-sm text-muted-foreground">Salary</p>
                    <p className="font-medium flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {job.salary}
                    </p>
                  </div>
                )}
                
                {job.url && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={job.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Original
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Apply to this Job</CardTitle>
                <CardDescription>
                  {job.hasApplied 
                    ? "You have already applied to this job"
                    : "Submit your application with optional notes"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {job.hasApplied ? (
                  <div className="text-center py-4">
                    <Badge className="status-submitted">Already Applied</Badge>
                    <p className="text-sm text-muted-foreground mt-2">
                      Check your applications page for status updates
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Textarea 
                      placeholder="Add notes about this application (optional)..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                    />
                    <Button 
                      className="w-full" 
                      onClick={() => applyMutation.mutate({ jobId: job.id, notes })}
                      disabled={applyMutation.isPending}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {applyMutation.isPending ? "Submitting..." : "Apply Now"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      This will be tracked as a manual application
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

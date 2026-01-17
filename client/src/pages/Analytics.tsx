import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { 
  Briefcase, Zap, User, BarChart3, Settings, Sparkles,
  TrendingUp, Clock, CheckCircle2, XCircle, Calendar
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

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
          <Button variant="ghost" className="w-full justify-start gap-2 bg-primary/10">
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

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export default function Analytics() {
  const { isAuthenticated } = useAuth();
  
  const { data: overview, isLoading: overviewLoading } = trpc.analytics.getOverview.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  
  const { data: trend, isLoading: trendLoading } = trpc.analytics.getApplicationTrend.useQuery(
    { days: 30 },
    { enabled: isAuthenticated }
  );
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please sign in to view analytics</p>
      </div>
    );
  }
  
  const statusData = overview ? [
    { name: 'Pending', value: overview.pendingApplications, color: 'hsl(var(--muted-foreground))' },
    { name: 'Interview', value: overview.interviewsScheduled, color: 'hsl(142 76% 36%)' },
    { name: 'Accepted', value: overview.acceptedOffers, color: 'hsl(var(--primary))' },
    { name: 'Rejected', value: overview.rejectedApplications, color: 'hsl(var(--destructive))' },
  ].filter(d => d.value > 0) : [];
  
  const typeData = overview ? [
    { name: 'Manual', value: overview.manualApplications },
    { name: 'Automatic', value: overview.automaticApplications },
  ] : [];
  
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Analytics</h2>
          <p className="text-muted-foreground">Track your job search performance</p>
        </div>
        
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Applications</p>
                  <p className="text-2xl font-bold">{overview?.totalApplications || 0}</p>
                </div>
                <Briefcase className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold text-green-500">{overview?.successRate || 0}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Response</p>
                  <p className="text-2xl font-bold">{overview?.avgResponseDays || 0} days</p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Interviews</p>
                  <p className="text-2xl font-bold text-primary">{overview?.interviewsScheduled || 0}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Application Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Application Trend</CardTitle>
              <CardDescription>Applications over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {trendLoading ? (
                <Skeleton className="h-64" />
              ) : trend && trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="manual" 
                      stackId="1"
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary) / 0.3)" 
                      name="Manual"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="automatic" 
                      stackId="1"
                      stroke="hsl(var(--chart-2))" 
                      fill="hsl(var(--chart-2) / 0.3)" 
                      name="Automatic"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <p>No application data yet</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Application Types */}
          <Card>
            <CardHeader>
              <CardTitle>Application Types</CardTitle>
              <CardDescription>Manual vs Automatic applications</CardDescription>
            </CardHeader>
            <CardContent>
              {overviewLoading ? (
                <Skeleton className="h-64" />
              ) : typeData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={typeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <p>No application data yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Status Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Status Breakdown</CardTitle>
              <CardDescription>Current status of all applications</CardDescription>
            </CardHeader>
            <CardContent>
              {overviewLoading ? (
                <Skeleton className="h-64" />
              ) : statusData.length > 0 ? (
                <div className="flex items-center gap-8">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {statusData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-sm">{entry.name}: {entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <p>No application data yet</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Refresh Info */}
          <Card>
            <CardHeader>
              <CardTitle>Job Monitoring</CardTitle>
              <CardDescription>Automatic job refresh status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Last Refresh</p>
                      <p className="text-sm text-muted-foreground">
                        {overview?.lastRefresh 
                          ? new Date(overview.lastRefresh).toLocaleString()
                          : "Never"
                        }
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Next Refresh</p>
                      <p className="text-sm text-muted-foreground">
                        {overview?.nextRefresh 
                          ? new Date(overview.nextRefresh).toLocaleString()
                          : "Not scheduled"
                        }
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm">
                    <strong>Refresh Interval:</strong> Every 5 hours
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Jobs are automatically refreshed from LinkedIn, Indeed, StepStone, Energy Jobline, and DataCareer.de
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

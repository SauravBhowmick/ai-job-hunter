import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Link } from "wouter";
import { 
  Briefcase, Zap, User, BarChart3, Settings, Sparkles,
  Save, Plus, X, MapPin, Mail, Phone, GraduationCap
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
          <Button variant="ghost" className="w-full justify-start gap-2 bg-primary/10">
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

function TagInput({ 
  value, 
  onChange, 
  placeholder 
}: { 
  value: string[]; 
  onChange: (value: string[]) => void; 
  placeholder: string;
}) {
  const [inputValue, setInputValue] = useState("");
  
  const addTag = () => {
    if (inputValue.trim() && !value.includes(inputValue.trim())) {
      onChange([...value, inputValue.trim()]);
      setInputValue("");
    }
  };
  
  const removeTag = (tag: string) => {
    onChange(value.filter(t => t !== tag));
  };
  
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={addTag}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  const { isAuthenticated, user } = useAuth();
  
  const { data: profile, isLoading } = trpc.profile.get.useQuery(undefined, { enabled: isAuthenticated });
  
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    location: "",
    cvSummary: "",
    skills: [] as string[],
    preferredTitles: [] as string[],
    preferredLocations: [] as string[],
    experienceYears: 0,
    education: "",
  });
  
  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.fullName || user?.name || "",
        email: profile.email || user?.email || "",
        phone: profile.phone || "",
        location: profile.location || "",
        cvSummary: profile.cvSummary || "",
        skills: profile.skills || [],
        preferredTitles: profile.preferredTitles || [],
        preferredLocations: profile.preferredLocations || [],
        experienceYears: profile.experienceYears || 0,
        education: profile.education || "",
      });
    } else if (user) {
      setFormData(prev => ({
        ...prev,
        fullName: user.name || "",
        email: user.email || "",
      }));
    }
  }, [profile, user]);
  
  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully!");
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please sign in to view your profile</p>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Profile</h2>
            <p className="text-muted-foreground">Manage your CV data and job preferences</p>
          </div>
          
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Your basic contact details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          id="fullName"
                          className="pl-9"
                          value={formData.fullName}
                          onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                          placeholder="Your full name"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          id="email"
                          type="email"
                          className="pl-9"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="your@email.com"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          id="phone"
                          className="pl-9"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="+49 123 456 7890"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          id="location"
                          className="pl-9"
                          value={formData.location}
                          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                          placeholder="Berlin, Germany"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="education">Education</Label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea 
                        id="education"
                        className="pl-9 min-h-[80px]"
                        value={formData.education}
                        onChange={(e) => setFormData(prev => ({ ...prev, education: e.target.value }))}
                        placeholder="M.Sc. in Data Science, Technical University..."
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="experienceYears">Years of Experience</Label>
                    <Input 
                      id="experienceYears"
                      type="number"
                      min="0"
                      max="50"
                      className="w-32"
                      value={formData.experienceYears}
                      onChange={(e) => setFormData(prev => ({ ...prev, experienceYears: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </CardContent>
              </Card>
              
              {/* CV Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>CV Summary</CardTitle>
                  <CardDescription>A brief overview of your professional background</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea 
                    value={formData.cvSummary}
                    onChange={(e) => setFormData(prev => ({ ...prev, cvSummary: e.target.value }))}
                    placeholder="Data Scientist with 5+ years of experience in energy systems, machine learning, and time-series analysis..."
                    className="min-h-[150px]"
                  />
                </CardContent>
              </Card>
              
              {/* Skills */}
              <Card>
                <CardHeader>
                  <CardTitle>Skills</CardTitle>
                  <CardDescription>Technical skills and competencies for job matching</CardDescription>
                </CardHeader>
                <CardContent>
                  <TagInput 
                    value={formData.skills}
                    onChange={(skills) => setFormData(prev => ({ ...prev, skills }))}
                    placeholder="Add a skill (e.g., Python, Machine Learning)"
                  />
                </CardContent>
              </Card>
              
              {/* Job Preferences */}
              <Card>
                <CardHeader>
                  <CardTitle>Job Preferences</CardTitle>
                  <CardDescription>Preferred job titles and locations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Preferred Job Titles</Label>
                    <TagInput 
                      value={formData.preferredTitles}
                      onChange={(preferredTitles) => setFormData(prev => ({ ...prev, preferredTitles }))}
                      placeholder="Add a job title (e.g., Data Scientist)"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Preferred Locations</Label>
                    <TagInput 
                      value={formData.preferredLocations}
                      onChange={(preferredLocations) => setFormData(prev => ({ ...prev, preferredLocations }))}
                      placeholder="Add a location (e.g., Berlin)"
                    />
                  </div>
                </CardContent>
              </Card>
              
              {/* Save Button */}
              <div className="flex justify-end">
                <Button type="submit" disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUpload } from "@/components/FileUpload";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { 
  Sparkles, Upload, FileText, User, CheckCircle2, 
  ArrowRight, ArrowLeft, MapPin, Plus, X, Briefcase
} from "lucide-react";
import { useState, useEffect } from "react";

type OnboardingStep = "upload" | "review" | "preferences" | "complete";

/**
 * Renders a horizontal onboarding step indicator with visual states for active, completed, and upcoming steps.
 *
 * Displays three steps (Upload CV, Review Info, Preferences), shows a check icon for completed steps, highlights the active step, and renders arrows between steps.
 *
 * @param currentStep - The id of the currently active onboarding step (`"upload" | "review" | "preferences"`).
 * @returns The JSX element representing the step indicator.
 */
function StepIndicator({ currentStep }: { currentStep: OnboardingStep }) {
  const steps = [
    { id: "upload", label: "Upload CV", icon: Upload },
    { id: "review", label: "Review Info", icon: FileText },
    { id: "preferences", label: "Preferences", icon: User },
  ];
  
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  
  return (
    <div className="flex items-center justify-center gap-4 mb-8">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = step.id === currentStep;
        const isCompleted = index < currentIndex;
        
        return (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
              isActive 
                ? "bg-primary text-primary-foreground" 
                : isCompleted 
                  ? "bg-green-500/20 text-green-600"
                  : "bg-muted text-muted-foreground"
            }`}>
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders a tag-input control that lets users add unique tags and remove existing tags.
 *
 * @param value - Current list of tags.
 * @param onChange - Callback invoked with the updated list of tags after additions or removals.
 * @param placeholder - Placeholder text shown in the text input.
 * @returns The rendered JSX element for the tag input control.
 */
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

/**
 * Render the multi-step onboarding UI that guides authenticated users through CV upload, AI parsing, profile review, and job preference setup.
 *
 * The component handles authentication states (sign-in prompt, loading skeleton), redirects users who have already completed onboarding, pre-fills basic profile fields from the authenticated user, and provides interactive steps for uploading/pasting a CV, reviewing and editing extracted profile information, and selecting job preferences. It performs server mutations to upload and parse CVs, save profile updates, and mark onboarding as complete, and displays success/error toasts for those operations.
 *
 * @returns The React element for the onboarding page UI.
 */
export default function Onboarding() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<OnboardingStep>("upload");
  const [cvText, setCvText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  
  const [profileData, setProfileData] = useState({
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

  const { data: existingProfile } = trpc.profile.get.useQuery(undefined, { 
    enabled: isAuthenticated 
  });

  // Redirect if onboarding already completed
  useEffect(() => {
    if (existingProfile?.onboardingCompleted) {
      navigate("/");
    }
  }, [existingProfile, navigate]);

  // Pre-fill with user data
  useEffect(() => {
    if (user) {
      setProfileData(prev => ({
        ...prev,
        fullName: user.name || prev.fullName,
        email: user.email || prev.email,
      }));
    }
  }, [user]);

  const uploadMutation = trpc.profile.uploadCV.useMutation({
    onSuccess: (data) => {
      toast.success("CV uploaded successfully!");
      setIsUploading(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsUploading(false);
    }
  });

  const parseMutation = trpc.profile.parseCV.useMutation({
    onSuccess: (data) => {
      const parsed = data.parsedData;
      setProfileData(prev => ({
        ...prev,
        fullName: parsed.fullName || prev.fullName,
        email: parsed.email || prev.email,
        phone: parsed.phone || prev.phone || "",
        location: parsed.location || prev.location || "",
        cvSummary: parsed.summary || "",
        skills: parsed.skills || [],
        preferredTitles: parsed.preferredTitles || [],
        experienceYears: parsed.experienceYears || 0,
        education: parsed.education || "",
      }));
      if (parsed.success) {
        toast.success("CV parsed successfully!");
      } else {
        toast.warning("CV parsing had issues. Please review and complete your information manually.");
      }
      setIsParsing(false);
      setStep("review");
    },
    onError: (error) => {
      toast.error("Failed to parse CV: " + error.message);
      setIsParsing(false);
      // Still move to review step but with manual entry
      setStep("review");
    }
  });

  const updateMutation = trpc.profile.update.useMutation();
  const completeMutation = trpc.profile.completeOnboarding.useMutation({
    onSuccess: () => {
      toast.success("Profile setup complete! Redirecting to dashboard...");
      setStep("complete");
      setTimeout(() => navigate("/"), 1500);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const handleFileSelect = async (file: File, base64: string) => {
    setUploadedFileName(file.name);
    setIsUploading(true);
    
    // Get MIME type
    const mimeType = file.type || "application/pdf";
    
    // Upload the file
    uploadMutation.mutate({
      fileData: base64,
      fileName: file.name,
      mimeType,
    });
  };

  const handleParseCV = () => {
    if (!cvText.trim()) {
      toast.error("Please paste your CV text to continue");
      return;
    }
    setIsParsing(true);
    parseMutation.mutate({ cvText });
  };

  const handleSkipParsing = () => {
    setStep("review");
  };

  const handleSaveAndContinue = async () => {
    try {
      await updateMutation.mutateAsync(profileData);
      setStep("preferences");
    } catch (error) {
      toast.error(`Failed to save profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCompleteOnboarding = async () => {
    try {
      // Save final preferences
      await updateMutation.mutateAsync({
        ...profileData,
        preferredLocations: profileData.preferredLocations,
      });
      // Mark onboarding as complete
      completeMutation.mutate();
    } catch (error) {
      toast.error(`Failed to complete onboarding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-2xl p-6">
          <Skeleton className="h-12 w-64 mx-auto mb-8" />
          <Skeleton className="h-96" />
        </div>
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
              Please sign in to set up your profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <a href={getLoginUrl()}>Sign in with Google</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold gradient-text">AI Job Hunter</h1>
          </div>
          <p className="text-muted-foreground">
            Let's set up your profile to find the perfect job matches
          </p>
        </div>

        <StepIndicator currentStep={step} />

        {/* Step 1: Upload CV */}
        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Your CV
              </CardTitle>
              <CardDescription>
                Upload your CV file and paste the text content for AI parsing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FileUpload
                onFileSelect={handleFileSelect}
                onClear={() => setUploadedFileName(null)}
                uploading={isUploading}
                uploaded={!!uploadedFileName}
                currentFileName={uploadedFileName || undefined}
              />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Then paste your CV text below
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cvText">CV Text Content</Label>
                <Textarea
                  id="cvText"
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  placeholder="Paste your CV text here for AI parsing. You can copy the text from your PDF or Word document..."
                  className="min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  Our AI will extract your skills, experience, and education to help match you with relevant jobs.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="ghost" onClick={handleSkipParsing}>
                  Skip & Enter Manually
                </Button>
                <Button 
                  onClick={handleParseCV} 
                  disabled={isParsing || !cvText.trim()}
                >
                  {isParsing ? (
                    <>Parsing...</>
                  ) : (
                    <>
                      Parse CV with AI
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Review Information */}
        {step === "review" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Review Your Information
              </CardTitle>
              <CardDescription>
                Verify and edit the extracted information from your CV
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={profileData.fullName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+49 123 456 7890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Current Location</Label>
                  <Input
                    id="location"
                    value={profileData.location}
                    onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Berlin, Germany"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="education">Education</Label>
                <Input
                  id="education"
                  value={profileData.education}
                  onChange={(e) => setProfileData(prev => ({ ...prev, education: e.target.value }))}
                  placeholder="M.Sc. in Computer Science, TU Berlin"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="experienceYears">Years of Experience</Label>
                <Input
                  id="experienceYears"
                  type="number"
                  min="0"
                  max="50"
                  className="w-32"
                  value={profileData.experienceYears}
                  onChange={(e) => setProfileData(prev => ({ ...prev, experienceYears: parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cvSummary">Professional Summary</Label>
                <Textarea
                  id="cvSummary"
                  value={profileData.cvSummary}
                  onChange={(e) => setProfileData(prev => ({ ...prev, cvSummary: e.target.value }))}
                  placeholder="Brief overview of your professional background..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Skills</Label>
                <TagInput
                  value={profileData.skills}
                  onChange={(skills) => setProfileData(prev => ({ ...prev, skills }))}
                  placeholder="Add a skill (e.g., Python, Machine Learning)"
                />
              </div>

              <div className="space-y-2">
                <Label>Target Job Titles</Label>
                <TagInput
                  value={profileData.preferredTitles}
                  onChange={(preferredTitles) => setProfileData(prev => ({ ...prev, preferredTitles }))}
                  placeholder="Add a job title (e.g., Data Scientist)"
                />
              </div>

              <div className="flex gap-3 justify-between">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleSaveAndContinue} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Continue"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Preferences */}
        {step === "preferences" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Job Preferences
              </CardTitle>
              <CardDescription>
                Set your location preferences for job matching
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Preferred Locations</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Add cities or countries where you'd like to work. We'll prioritize Schengen area jobs and highlight VISA sponsorship for other locations.
                  </p>
                  <TagInput
                    value={profileData.preferredLocations}
                    onChange={(preferredLocations) => setProfileData(prev => ({ ...prev, preferredLocations }))}
                    placeholder="Add a location (e.g., Berlin, Germany)"
                  />
                </div>

                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Job Matching Preview
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Based on your profile, we'll search for jobs matching:
                  </p>
                  <ul className="text-sm space-y-1 ml-4">
                    <li>• Titles: {profileData.preferredTitles.join(", ") || "Any"}</li>
                    <li>• Skills: {profileData.skills.slice(0, 5).join(", ")}{profileData.skills.length > 5 ? "..." : ""}</li>
                    <li>• Locations: {profileData.preferredLocations.join(", ") || "Schengen area"}</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3 justify-between">
                <Button variant="outline" onClick={() => setStep("review")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleCompleteOnboarding} disabled={completeMutation.isPending}>
                  {completeMutation.isPending ? "Completing..." : "Complete Setup"}
                  <CheckCircle2 className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step Complete */}
        {step === "complete" && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2">You're all set!</h3>
              <p className="text-muted-foreground mb-4">
                Redirecting you to the job dashboard...
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
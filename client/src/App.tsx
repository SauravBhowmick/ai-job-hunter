import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import JobDetail from "./pages/JobDetail";
import Applications from "./pages/Applications";
import Analytics from "./pages/Analytics";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Onboarding from "./pages/Onboarding";
import AutoApply from "./pages/AutoApply";

/**
 * Renders the application's route switch, mapping URL paths to their respective page components.
 *
 * Includes explicit routes for dashboard, onboarding, job details (with dynamic `id`), applications,
 * auto-apply, analytics, profile, settings, a 404 page, and a catch-all fallback to the NotFound page.
 *
 * @returns A JSX element that renders the route switch with the app's route definitions
 */
function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/job/:id" component={JobDetail} />
      <Route path="/applications" component={Applications} />
      <Route path="/auto-apply" component={AutoApply} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/profile" component={Profile} />
      <Route path="/settings" component={Settings} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
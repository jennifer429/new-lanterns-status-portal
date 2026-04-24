import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useRoute, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import PlatformAdmin from "./pages/PlatformAdmin";
import IntakeNewRedesign from "./pages/IntakeNewRedesign";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SetPassword from "./pages/SetPassword";
import Tasks from "./pages/Tasks";
import IntakeComplete from "./pages/IntakeComplete";
import CreateOrganization from "./pages/CreateOrganization";
import Implementation from "./pages/Implementation";
import SwimlaneMockup from "./pages/SwimlaneMockup";
import Validation from "./pages/Validation";
import Workflows from "./pages/Workflows";
import Specifications from "./pages/Specifications";
import Connectivity from "./pages/Connectivity";
import ProceduralLibrary from "./pages/ProceduralLibrary";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";

/**
 * Redirect legacy 2-segment sub-page URLs to canonical 3-segment URLs.
 * e.g. /org/boulder/intake → /org/RadOne/boulder/intake
 *
 * Without this, /org/boulder/intake matches /org/:clientSlug/:slug (Home)
 * with clientSlug="boulder" and slug="intake", producing broken navigation.
 */
function LegacySubPageRedirect({ subPath }: { subPath: string }) {
  const [, params] = useRoute(`/org/:slug/${subPath}`);
  const [, setLocation] = useLocation();
  const slug = params?.slug ?? "";
  const { data: org } = trpc.organizations.getBySlug.useQuery(
    { slug },
    { enabled: !!slug }
  );

  useEffect(() => {
    if (org?.clientSlug) {
      setLocation(`/org/${org.clientSlug}/${slug}/${subPath}`, { replace: true });
    }
  }, [org?.clientSlug, slug, subPath, setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto" />
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/swimlane-mockup" component={SwimlaneMockup} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/set-password" component={SetPassword} />
      {/* Legacy /admin redirects to the unified /org/admin page */}
      <Route path="/admin">{() => { window.location.replace("/org/admin"); return null; }}</Route>
      <Route path="/org/admin/create" component={CreateOrganization} />
      {/* Partner admin create org - supports any partner slug */}
      <Route path="/org/:partner/admin/create" component={CreateOrganization} />
      {/* Unified admin page - works for all admin roles (Platform, SRV, RadOne, etc.) */}
      {/* Backend automatically filters data by the logged-in user's clientId */}
      <Route path="/org/admin/users">
        {() => <PlatformAdmin />}
      </Route>
      <Route path="/org/admin">
        {() => <PlatformAdmin />}
      </Route>
      <Route path="/org/admin/library" component={ProceduralLibrary} />
      {/* Partner admin routes - :slug matches any partner (SRV, RadOne, etc.) */}
      <Route path="/org/:slug/admin/users">
        {() => <PlatformAdmin />}
      </Route>
      <Route path="/org/:slug/admin">
        {() => <PlatformAdmin />}
      </Route>
      <Route path="/org/:slug/admin/library" component={ProceduralLibrary} />
      {/* Org routes — all require partner prefix: /org/:clientSlug/:orgSlug */}
      <Route path="/org/:clientSlug/:slug/intake" component={IntakeNewRedesign} />
      <Route path="/org/:clientSlug/:slug/implement" component={Implementation} />
      <Route path="/org/:clientSlug/:slug/validation" component={Validation} />
      <Route path="/org/:clientSlug/:slug/workflows" component={Workflows} />
      <Route path="/org/:clientSlug/:slug/specs" component={Specifications} />
      <Route path="/org/:clientSlug/:slug/connectivity" component={Connectivity} />
      <Route path="/org/:clientSlug/:slug/tasks" component={Tasks} />
      <Route path="/org/:clientSlug/:slug/complete" component={IntakeComplete} />
      <Route path="/org/:clientSlug/:slug/library" component={ProceduralLibrary} />
      {/*
       * Legacy sub-page redirects — catch old 2-segment URLs like /org/boulder/intake
       * and redirect to canonical /org/:clientSlug/:slug/:subPath.
       * These MUST appear before the generic /org/:clientSlug/:slug route
       * to avoid mismatching (e.g. treating "intake" as an orgSlug).
       */}
      <Route path="/org/:slug/intake">{() => <LegacySubPageRedirect subPath="intake" />}</Route>
      <Route path="/org/:slug/implement">{() => <LegacySubPageRedirect subPath="implement" />}</Route>
      <Route path="/org/:slug/validation">{() => <LegacySubPageRedirect subPath="validation" />}</Route>
      <Route path="/org/:slug/workflows">{() => <LegacySubPageRedirect subPath="workflows" />}</Route>
      <Route path="/org/:slug/specs">{() => <LegacySubPageRedirect subPath="specs" />}</Route>
      <Route path="/org/:slug/connectivity">{() => <LegacySubPageRedirect subPath="connectivity" />}</Route>
      <Route path="/org/:slug/tasks">{() => <LegacySubPageRedirect subPath="tasks" />}</Route>
      <Route path="/org/:slug/complete">{() => <LegacySubPageRedirect subPath="complete" />}</Route>
      <Route path="/org/:slug/library">{() => <LegacySubPageRedirect subPath="library" />}</Route>
      <Route path="/org/:clientSlug/:slug" component={Home} />
      {/* Legacy route — redirects to canonical /org/:clientSlug/:slug via Home's useEffect */}
      <Route path="/org/:slug" component={Home} />
      <Route path="/">{() => { window.location.href = '/login'; return null; }}</Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

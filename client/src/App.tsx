import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
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
import Validation from "./pages/Validation";
import Workflows from "./pages/Workflows";
import Specifications from "./pages/Specifications";
import Connectivity from "./pages/Connectivity";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/set-password" component={SetPassword} />
      <Route path="/admin" component={Admin} />
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
      <Route path="/org/SRV/admin/users">
        {() => <PlatformAdmin />}
      </Route>
      <Route path="/org/SRV/admin">
        {() => <PlatformAdmin />}
      </Route>
      <Route path="/org/RadOne/admin/users">
        {() => <PlatformAdmin />}
      </Route>
      <Route path="/org/RadOne/admin">
        {() => <PlatformAdmin />}
      </Route>
      {/* Generic partner admin routes - supports any partner slug (e.g. /org/rads-inc/admin) */}
      <Route path="/org/:slug/admin/users">
        {() => <PlatformAdmin />}
      </Route>
      <Route path="/org/:slug/admin">
        {() => <PlatformAdmin />}
      </Route>
      <Route path="/org/:slug/intake" component={IntakeNewRedesign} />
      <Route path="/org/:slug/implement" component={Implementation} />
      <Route path="/org/:slug/validation" component={Validation} />
      <Route path="/org/:slug/workflows" component={Workflows} />
      <Route path="/org/:slug/specs" component={Specifications} />
      <Route path="/org/:slug/connectivity" component={Connectivity} />
      <Route path="/org/:slug/complete" component={IntakeComplete} />
      <Route path="/org/:slug/tasks" component={Tasks} />
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

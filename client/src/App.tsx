import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import PlatformAdmin from "./pages/PlatformAdmin";
import PartnerAdmin from "./pages/PartnerAdmin";
import IntakeNewRedesign from "./pages/IntakeNewRedesign";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Tasks from "./pages/Tasks";
import CreateOrganization from "./pages/CreateOrganization";
import ManageUsers from "./pages/ManageUsers";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/admin" component={Admin} />
      <Route path="/org/admin/create" component={CreateOrganization} />
      <Route path="/org/admin/users">
        {() => <ManageUsers />}
      </Route>
      <Route path="/org/admin">
        {() => <PlatformAdmin />}
      </Route>
      <Route path="/org/SRV/admin/users">
        {() => <ManageUsers partnerName="SRV" />}
      </Route>
      <Route path="/org/SRV/admin">
        {() => <PartnerAdmin partnerName="SRV" allowedDomain="@srv.com" />}
      </Route>
      <Route path="/org/RadOne/admin/users">
        {() => <ManageUsers partnerName="RadOne" />}
      </Route>
      <Route path="/org/RadOne/admin">
        {() => <PartnerAdmin partnerName="RadOne" allowedDomain="@radone.com" />}
      </Route>
      <Route path="/org/:slug/intake" component={IntakeNewRedesign} />
      <Route path="/org/:slug/tasks" component={Tasks} />
      <Route path="/org/:slug" component={Home} />
      <Route path={"/"} component={Login} />
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

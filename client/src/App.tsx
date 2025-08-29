import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Lotes from "@/pages/lotes";
import ZoneDetail from "@/pages/zona-detail";
import Seguimiento from "@/pages/seguimiento";
import Trazabilidad from "@/pages/trazabilidad";
import PublicTrace from "@/pages/public-trace";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/trace/:token" component={PublicTrace} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/lotes" component={Lotes} />
      <ProtectedRoute path="/zona/:stage/:id" component={ZoneDetail} />
      <ProtectedRoute path="/seguimiento" component={Seguimiento} />
      <ProtectedRoute path="/trazabilidad" component={Trazabilidad} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

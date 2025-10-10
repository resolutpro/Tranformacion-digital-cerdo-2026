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
import PublicTraceability from "@/pages/public-traceability";
import InformacionAdicional from "@/pages/informacion-adicional";
import CriaPage from "@/pages/cria";
import EngordePage from "@/pages/engorde";
import MataderoPage from "@/pages/matadero";
import SecaderoPage from "@/pages/secadero";
import DistribucionPage from "@/pages/distribucion";
import ZoneMovementPage from "@/pages/zona-movimiento";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/trazabilidad/:token" component={PublicTraceability} />
      <Route path="/zona-movimiento/:token" component={ZoneMovementPage} />
      <Route path="/informacion-adicional" component={InformacionAdicional} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/lotes" component={Lotes} />
      <ProtectedRoute path="/cria" component={CriaPage} />
      <ProtectedRoute path="/engorde" component={EngordePage} />
      <ProtectedRoute path="/matadero" component={MataderoPage} />
      <ProtectedRoute path="/secadero" component={SecaderoPage} />
      <ProtectedRoute path="/distribucion" component={DistribucionPage} />
      <ProtectedRoute path="/zona/:id" component={ZoneDetail} />
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

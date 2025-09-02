import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Home, LogOut, Menu, Heart, TrendingUp, Factory, Wind, Truck, Route, QrCode, Layers } from "lucide-react";
import { Link, useLocation } from "wouter";

const navigationItems = [
  { icon: Home, label: "Inicio", href: "/" },
  { icon: Layers, label: "Lotes", href: "/lotes" },
  { icon: Heart, label: "Cría", href: "/cria" },
  { icon: TrendingUp, label: "Engorde", href: "/engorde" },
  { icon: Factory, label: "Matadero", href: "/matadero" },
  { icon: Wind, label: "Secadero", href: "/secadero" },
  { icon: Truck, label: "Distribución", href: "/distribucion" },
  { icon: Route, label: "Seguimiento de Lotes", href: "/seguimiento" },
  { icon: QrCode, label: "Trazabilidad Pública", href: "/trazabilidad" },
];

export function Header() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-card border-b border-border px-4 md:px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="md:hidden" data-testid="button-mobile-menu">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
                  <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 100 100">
                    <path d="M50,15 C65,15 78,25 78,38 C78,45 75,50 70,53 L70,60 C70,70 62,78 50,78 C38,78 30,70 30,60 L30,53 C25,50 22,45 22,38 C22,25 35,15 50,15 Z"/>
                    <circle cx="42" cy="35" r="3" fill="white"/>
                    <circle cx="58" cy="35" r="3" fill="white"/>
                    <ellipse cx="50" cy="45" rx="8" ry="5" fill="white" opacity="0.8"/>
                    <circle cx="46" cy="43" r="1.5" fill="currentColor"/>
                    <circle cx="54" cy="43" r="1.5" fill="currentColor"/>
                    <path d="M35,25 Q30,20 25,25 Q30,30 35,25" fill="currentColor"/>
                    <path d="M65,25 Q70,20 75,25 Q70,30 65,25" fill="currentColor"/>
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-foreground text-sm">Gemelo Digital</h2>
                  <p className="text-xs text-muted-foreground">Cerdo Ibérico</p>
                </div>
              </div>
            </div>
            
            <nav className="p-2 space-y-1">
              {navigationItems.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      isActive 
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent/50 text-foreground"
                    }`}>
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="hidden md:block">
          <Button variant="ghost" size="sm" data-testid="button-home">
            <Home className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground hidden md:block" data-testid="text-user-email">
          {user?.email}
        </span>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Cerrar sesión</span>
        </Button>
      </div>
    </header>
  );
}

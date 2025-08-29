import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Home, 
  Layers, 
  Sprout, 
  TrendingUp, 
  Factory, 
  Wind, 
  Truck,
  Route,
  QrCode,
  Menu,
  ChevronLeft,
  Microchip
} from "lucide-react";

interface SidebarProps {
  className?: string;
}

const navigationItems = [
  { icon: Home, label: "Inicio", href: "/" },
  { icon: Layers, label: "Lotes", href: "/lotes" },
  { icon: Sprout, label: "Cría", href: "/zona/cria" },
  { icon: TrendingUp, label: "Engorde", href: "/zona/engorde" },
  { icon: Factory, label: "Matadero", href: "/zona/matadero" },
  { icon: Wind, label: "Secadero", href: "/zona/secadero" },
  { icon: Truck, label: "Distribución", href: "/zona/distribucion" },
  { icon: Route, label: "Seguimiento de Lotes", href: "/seguimiento" },
  { icon: QrCode, label: "Trazabilidad Pública", href: "/trazabilidad" },
];

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();

  return (
    <div 
      className={cn(
        "fixed left-0 top-0 z-50 h-full bg-card border-r border-border transition-all duration-300",
        collapsed ? "w-16" : "w-64",
        className
      )}
      data-testid="sidebar"
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Microchip className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground text-sm">Gemelo Digital</h2>
                <p className="text-xs text-muted-foreground">Cerdo Ibérico</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 p-0"
            data-testid="button-toggle-sidebar"
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 p-2">
        <nav className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = location === item.href || 
              (item.href.startsWith('/zona/') && location.startsWith('/zona/') && location.includes(item.href.split('/')[2]));
            
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "w-full justify-start gap-3 h-10",
                    collapsed && "px-2",
                    isActive && "bg-primary text-primary-foreground"
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Button>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}

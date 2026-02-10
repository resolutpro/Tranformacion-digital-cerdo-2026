import { useSidebarState } from "./main-layout";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Home,
  Layers,
  Heart,
  TrendingUp,
  Factory,
  Wind,
  Truck,
  Route,
  QrCode,
  Menu,
  ChevronLeft,
  BrainCircuit,
} from "lucide-react";

interface SidebarProps {
  className?: string;
}

const navigationItems = [
  { icon: Home, label: "Inicio", href: "/dashboard" },
  { icon: Layers, label: "Lotes", href: "/lotes" },
  { icon: Heart, label: "Cría", href: "/cria" },
  { icon: TrendingUp, label: "Engorde", href: "/engorde" },
  { icon: Factory, label: "Matadero", href: "/matadero" },
  { icon: Wind, label: "Secadero", href: "/secadero" },
  { icon: Truck, label: "Distribución", href: "/distribucion" },
  { icon: Route, label: "Seguimiento de Lotes", href: "/seguimiento" },
  { icon: QrCode, label: "Trazabilidad Pública", href: "/trazabilidad" },
  { icon: BrainCircuit, label: "IA y Análisis", href: "/ia-prediccion" },
];

export function Sidebar({ className }: SidebarProps) {
  const { collapsed, setCollapsed } = useSidebarState();
  const [location] = useLocation();

  return (
    <div
      className={cn(
        "fixed left-0 top-0 z-50 h-full bg-card border-r border-border transition-all duration-300",
        collapsed ? "w-0 md:w-16" : "w-64",
        collapsed ? "-translate-x-full md:translate-x-0" : "translate-x-0",
        className,
      )}
      data-testid="sidebar"
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
                {/* Pig SVG Icon */}
                <svg
                  className="h-4 w-4 text-white"
                  fill="currentColor"
                  viewBox="0 0 100 100"
                >
                  <path d="M50,15 C65,15 78,25 78,38 C78,45 75,50 70,53 L70,60 C70,70 62,78 50,78 C38,78 30,70 30,60 L30,53 C25,50 22,45 22,38 C22,25 35,15 50,15 Z" />
                  <circle cx="42" cy="35" r="3" fill="white" />
                  <circle cx="58" cy="35" r="3" fill="white" />
                  <ellipse
                    cx="50"
                    cy="45"
                    rx="8"
                    ry="5"
                    fill="white"
                    opacity="0.8"
                  />
                  <circle cx="46" cy="43" r="1.5" fill="currentColor" />
                  <circle cx="54" cy="43" r="1.5" fill="currentColor" />
                  <path
                    d="M35,25 Q30,20 25,25 Q30,30 35,25"
                    fill="currentColor"
                  />
                  <path
                    d="M65,25 Q70,20 75,25 Q70,30 65,25"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-foreground text-sm">
                  Gemelo Digital
                </h2>
                <p className="text-xs text-muted-foreground">Cerdo Ibérico</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 p-2">
        <nav className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = location === item.href;

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "w-full justify-start gap-3 h-10",
                    collapsed && "px-2",
                    isActive && "bg-primary text-primary-foreground",
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
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

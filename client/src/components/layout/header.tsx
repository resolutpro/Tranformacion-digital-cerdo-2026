import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, Home, Menu } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useSidebarState } from "./main-layout";

export function Header() {
  const { user, logoutMutation } = useAuth();
  const { setCollapsed, collapsed } = useSidebarState();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/alerts/unread-count"],
    refetchInterval: 30000,
  });

  return (
    <header className="bg-card border-b border-border px-4 md:px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2 md:gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="md:hidden p-0 h-8 w-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Link href="/">
          <Button variant="ghost" size="sm" className="hidden sm:flex">
            <Home className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="font-bold text-base md:text-lg truncate">
          Gemelo Digital Ibérico
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/alertas">
          <Button variant="ghost" size="sm" className="relative">
            <Bell
              className={`h-5 w-5 ${unreadData?.count && unreadData.count > 0 ? "text-red-500 fill-red-500" : ""}`}
            />
            {unreadData?.count && unreadData.count > 0 ? (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 rounded-full">
                {unreadData.count}
              </span>
            ) : null}
          </Button>
        </Link>

        <span className="text-sm text-muted-foreground hidden sm:block">
          {user?.email}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Salir
        </Button>
      </div>
    </header>
  );
}

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, Home } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

export function Header() {
  const { user, logoutMutation } = useAuth();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/alerts/unread-count"],
    refetchInterval: 30000,
  });

  return (
    <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <Home className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="font-bold text-lg hidden md:block">
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

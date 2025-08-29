import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Home, LogOut } from "lucide-react";
import { Link } from "wouter";

export function Header() {
  const { user, logoutMutation } = useAuth();

  return (
    <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="sm" data-testid="button-home">
            <Home className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground" data-testid="text-user-email">
          {user?.email}
        </span>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4 mr-1" />
          Cerrar sesión
        </Button>
      </div>
    </header>
  );
}

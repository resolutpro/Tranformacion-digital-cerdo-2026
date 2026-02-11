import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { ZoneQrButton } from "@/components/zone-qr-button";
import type { Zone } from "@shared/schema";

export default function EngordePage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");
  const { toast } = useToast();

  const { data: zones = [], isLoading } = useQuery<Zone[]>({
    queryKey: ["/api/zones", { stage: "engorde" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/zones?stage=engorde");
      return res.json();
    },
  });

  const createZoneMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/zones", {
        name,
        stage: "engorde",
        isActive: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zones"] });
      toast({
        title: "Zona creada",
        description: "La zona de engorde ha sido creada correctamente",
      });
      setIsCreateModalOpen(false);
      setNewZoneName("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la zona",
        variant: "destructive",
      });
    },
  });

  const deleteZoneMutation = useMutation({
    mutationFn: async (zoneId: string) => {
      await apiRequest("DELETE", `/api/zones/${zoneId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zones"] });
      toast({
        title: "Zona eliminada",
        description: "La zona ha sido eliminada correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description:
          error.message ||
          "No se pudo eliminar la zona (puede tener estancias activas)",
        variant: "destructive",
      });
    },
  });

  const handleCreateZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    createZoneMutation.mutate(newZoneName.trim());
  };

  const handleDeleteZone = (zone: Zone) => {
    if (
      confirm(`¿Estás seguro de que quieres eliminar la zona "${zone.name}"?`)
    ) {
      deleteZoneMutation.mutate(zone.id);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Engorde</h1>
            <p className="text-muted-foreground">
              Gestiona las zonas de engorde para cerdos en crecimiento
            </p>
          </div>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-zone">
                <Plus className="h-4 w-4 mr-2" />
                Crear Zona
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nueva Zona de Engorde</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateZone} className="space-y-4">
                <div>
                  <Label htmlFor="zoneName">Nombre de la zona *</Label>
                  <Input
                    id="zoneName"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    placeholder="Ej: Zona B1, Nave Central, etc."
                    required
                    data-testid="input-zone-name"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createZoneMutation.isPending || !newZoneName.trim()
                    }
                    className="flex-1"
                    data-testid="button-save-zone"
                  >
                    {createZoneMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Crear Zona
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-2/3"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-4 bg-muted rounded w-full"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : zones.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  No hay zonas de engorde creadas
                </p>
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
                  data-testid="button-create-first-zone"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primera zona
                </Button>
              </CardContent>
            </Card>
          ) : (
            zones.map((zone) => (
              <Card
                key={zone.id}
                className="relative group"
                data-testid={`zone-card-${zone.id}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle
                      className="text-lg"
                      data-testid={`zone-name-${zone.id}`}
                    >
                      {zone.name}
                    </CardTitle>
                    <div className="flex gap-1">
                      <ZoneQrButton
                        zone={zone}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteZone(zone)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={deleteZoneMutation.isPending}
                        data-testid={`button-delete-zone-${zone.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      Estado:{" "}
                      <span className="text-foreground font-medium">
                        {zone.isActive ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                    {zone.temperatureTarget && (
                      <div className="text-sm text-muted-foreground">
                        Temperatura objetivo:{" "}
                        <span className="text-foreground font-medium">
                          {zone.temperatureTarget.min}°C -{" "}
                          {zone.temperatureTarget.max}°C
                        </span>
                      </div>
                    )}
                    {zone.humidityTarget && (
                      <div className="text-sm text-muted-foreground">
                        Humedad objetivo:{" "}
                        <span className="text-foreground font-medium">
                          {zone.humidityTarget.min}% - {zone.humidityTarget.max}
                          %
                        </span>
                      </div>
                    )}
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          (window.location.href = `/zona/${zone.id}`)
                        }
                        data-testid={`button-zone-details-${zone.id}`}
                      >
                        Ver Detalles
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}

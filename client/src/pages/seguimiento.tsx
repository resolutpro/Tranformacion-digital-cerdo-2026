import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDragAndDrop } from "@/lib/drag-drop";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Filter, 
  MoreVertical,
  Sprout,
  TrendingUp,
  Factory,
  Wind,
  Truck,
  Check,
  MapPin
} from "lucide-react";
import type { Lote, Zone } from "@shared/schema";

interface TrackingBoard {
  cria: { zones: Zone[]; lotes: Array<Lote & { currentZone: Zone; totalDays: number }> };
  engorde: { zones: Zone[]; lotes: Array<Lote & { currentZone: Zone; totalDays: number }> };
  matadero: { zones: Zone[]; lotes: Array<Lote & { currentZone: Zone; totalDays: number }> };
  secadero: { zones: Zone[]; lotes: Array<Lote & { currentZone: Zone; totalDays: number }> };
  distribucion: { zones: Zone[]; lotes: Array<Lote & { currentZone: Zone; totalDays: number }> };
  finalizado: { zones: Zone[]; lotes: Lote[] };
}

const stageConfig = {
  cria: { 
    title: "Cría", 
    icon: Sprout, 
    color: "bg-secondary/5 border-secondary/20",
    headerColor: "bg-secondary/10"
  },
  engorde: { 
    title: "Engorde", 
    icon: TrendingUp, 
    color: "bg-primary/5 border-primary/20",
    headerColor: "bg-primary/10"
  },
  matadero: { 
    title: "Matadero", 
    icon: Factory, 
    color: "bg-accent/5 border-accent/20",
    headerColor: "bg-accent/10"
  },
  secadero: { 
    title: "Secadero", 
    icon: Wind, 
    color: "bg-chart-3/5 border-chart-3/20",
    headerColor: "bg-chart-3/10"
  },
  distribucion: { 
    title: "Distribución", 
    icon: Truck, 
    color: "bg-chart-4/5 border-chart-4/20",
    headerColor: "bg-chart-4/10"
  },
  finalizado: { 
    title: "Finalizado", 
    icon: Check, 
    color: "bg-muted/5 border-muted/20",
    headerColor: "bg-muted/10"
  }
};

export default function Seguimiento() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLote, setSelectedLote] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: board, isLoading } = useQuery<TrackingBoard>({
    queryKey: ["/api/tracking/board"],
  });

  const moveMutation = useMutation({
    mutationFn: async ({ loteId, zoneId, entryTime }: { loteId: string; zoneId: string; entryTime: string }) => {
      const res = await apiRequest("POST", `/api/lotes/${loteId}/move`, {
        zoneId,
        entryTime,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tracking/board"] });
      toast({
        title: "Movimiento registrado",
        description: "El lote ha sido movido correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo mover el lote",
        variant: "destructive",
      });
    },
  });

  const { draggedItem, dragHandlers } = useDragAndDrop({
    onDrop: (draggedLoteId: string, targetZoneId: string) => {
      if (targetZoneId === 'finalizado') {
        // Handle finishing lote
        moveMutation.mutate({
          loteId: draggedLoteId,
          zoneId: targetZoneId,
          entryTime: new Date().toISOString(),
        });
      } else {
        // Regular zone movement
        moveMutation.mutate({
          loteId: draggedLoteId,
          zoneId: targetZoneId,
          entryTime: new Date().toISOString(),
        });
      }
    }
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">Seguimiento de Lotes</h1>
            <p className="text-muted-foreground">Tablero de control de movimientos</p>
          </div>
          <div className="h-96 bg-muted/20 rounded-lg animate-pulse"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Seguimiento de Lotes</h1>
            <p className="text-muted-foreground">Tablero de control de movimientos</p>
          </div>
          <div className="flex gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar lotes activos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
                data-testid="input-search-tracking"
              />
            </div>
            <Button variant="outline" data-testid="button-filters">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-6 gap-4 kanban-column">
          {Object.entries(stageConfig).map(([stage, config]) => {
            const stageData = board?.[stage as keyof TrackingBoard];
            if (!stageData) return null;

            return (
              <Card key={stage} className={config.color} data-testid={`column-${stage}`}>
                <CardHeader className={`p-4 border-b border-border ${config.headerColor}`}>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <config.icon className="h-4 w-4" />
                    {config.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {stageData.lotes.length} lotes
                  </p>
                </CardHeader>
                <CardContent className="p-3 space-y-3">
                  {stage === 'finalizado' ? (
                    <div 
                      className="kanban-zone text-center p-4"
                      {...dragHandlers.getDropZoneProps('finalizado')}
                      data-testid="drop-zone-finalizado"
                    >
                      <div className="text-xs text-muted-foreground">
                        Arrastrar aquí para finalizar
                      </div>
                    </div>
                  ) : (
                    stageData.zones.map((zone) => {
                      const zoneLotes = stageData.lotes.filter(l => l.currentZone.id === zone.id);
                      
                      return (
                        <div 
                          key={zone.id}
                          className="kanban-zone p-2"
                          {...dragHandlers.getDropZoneProps(zone.id)}
                          data-testid={`drop-zone-${zone.id}`}
                        >
                          <div className="text-xs text-muted-foreground mb-2" data-testid={`zone-label-${zone.id}`}>
                            {zone.name}
                          </div>
                          <div className="space-y-2">
                            {zoneLotes.map((lote) => (
                              <div
                                key={lote.id}
                                className={`batch-card bg-background border border-border rounded-md p-3 cursor-move ${
                                  draggedItem === lote.id ? 'batch-card-dragging' : ''
                                } ${selectedLote === lote.id ? 'ring-2 ring-primary' : ''}`}
                                {...dragHandlers.getDraggableProps(lote.id)}
                                onClick={() => setSelectedLote(lote.id === selectedLote ? null : lote.id)}
                                data-testid={`lote-card-${lote.id}`}
                              >
                                <div className="font-medium text-sm" data-testid={`lote-name-${lote.id}`}>
                                  {lote.identification}
                                </div>
                                <div className="text-xs text-muted-foreground" data-testid={`lote-animals-${lote.id}`}>
                                  {lote.initialAnimals} animales
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                  <span className="text-xs text-muted-foreground" data-testid={`lote-days-${lote.id}`}>
                                    {lote.totalDays} días
                                  </span>
                                  {selectedLote === lote.id && (
                                    <div className="w-2 h-2 bg-primary rounded-full flex items-center justify-center">
                                      <MapPin className="h-1 w-1" />
                                    </div>
                                  )}
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-auto p-1"
                                    data-testid={`button-lote-menu-${lote.id}`}
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}
